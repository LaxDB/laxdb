# Fetching lab

This route isolates the Effect Atom data path from the tournament pages.

It always reads the live endpoint. It does not use the archived tournament mode.

The route is not a proposed final user interface.

## Pipeline

```text
fetch
  -> decode and validate
  -> retry and timeout
  -> request atom
  -> SWR and focus refresh
  -> adaptive polling
  -> AsyncResult
  -> presentation boundary
  -> route data
```

`-data.ts` owns acquisition and cache policy.

`-boundary.tsx` owns only async presentation.

`index.tsx` reads and refreshes the atom explicitly.

## Current behavior

| Event | Result |
| --- | --- |
| First request | Show loading. |
| First failure | Retry once, then show unavailable. |
| Manual retry | Start a new request. |
| Refresh with old data | Keep old data and show refreshing. |
| Refresh failure | Keep old data and show the failure. |
| Active game | Poll after 30 seconds. |
| No active game | Poll after 60 seconds. |
| Hidden document | Do not start the due poll. |
| Visible document | SWR refreshes stale data. |
| Route unmount | Stop the polling wrapper. Keep the request atom alive. |
| Server render | Start an independent request and render loading. |

## Review findings

### 1. Atom lifetime is not defined clearly

`Atom.keepAlive` keeps the request and its value for the registry lifetime.

This supports navigation cache retention. It also lets active work continue after route unmount.

Choose one policy before production use:

- Use automatic disposal for route-owned data.
- Use `Atom.setIdleTTL` for a short navigation cache.
- Use `Atom.keepAlive` only for application-owned tournament authority.

### 2. Server rendering can make a duplicate request

The server reads the atom but cannot use the later async result in its HTML.

The client creates another registry and starts another request.

Disable server reads for this route, or seed the client registry with server data.

### 3. Hidden polling depends on focus revalidation

A polling timer is consumed when the document is hidden.

This setup recovers because focus refresh is enabled and stale time is 15 seconds.

The polling helper is unsafe as a general helper without that policy.

Keep it schedule-specific, or resume an overdue poll when visibility returns.

### 4. The transport still crosses through Promise code

`Effect.tryPromise` safely wraps the request. Effect 4 also has a native HTTP client.

A later iteration should test `HttpClient` with `FetchHttpClient.layer`.

That change can combine request errors, status checks, schema decoding, timeout, and interruption.

### 5. The custom query helper was too early

The production helper copied a query-library option object for one endpoint.

The lab now keeps the concrete request atom and only extracts the polling transform.

Do not add a general query abstraction until a second endpoint proves the shared behavior.

### 6. Production converts async state twice

`AsyncResult` already models initial, waiting, success, failure, and retained success.

`CurrentTournamentState` creates another loading and failure state machine.

This adds translation code and can create conflicting states.

### 7. Transport data is not the final domain value

Routes must not use `LiveSchedule` as the final production model.

The integrity and detail reconciliation in `buildLiveTournamentSnapshot` must remain.

### 8. The lab route is public

The generated route tree includes `/fetching-lab` in all builds.

Keep it only while this architecture work is active. Remove it before the final merge.

## Recommended production shape

Use one atom with this conceptual type:

```ts
Atom.Atom<AsyncResult.AsyncResult<CurrentTournamentSnapshot, FetchError>>
```

The live path fetches, validates, and maps `LiveSchedule` to `CurrentTournamentSnapshot`.

The archived path returns an immediate successful archived snapshot.

Do not represent archived mode as a permanent initial result.

A migrated route should keep acquisition explicit:

```tsx
const result = useAtomValue(currentTournamentAtom)
const refresh = useAtomRefresh(currentTournamentAtom)

<TournamentData result={result} refresh={refresh}>
  {(snapshot) => <Page snapshot={snapshot} />}
</TournamentData>
```

`TournamentData` must remain a presentation component. It must not read the atom.

This keeps data ownership visible at the route.

## Better process

1. Write the behavior table before the abstraction.
2. Implement one concrete endpoint atom.
3. Test the atom with a controlled loader and fake time.
4. Test unmount, remount, visibility, retry, timeout, and retained success.
5. Add the domain snapshot map.
6. Add a presentation-only boundary.
7. Exercise the pipeline in this small route.
8. Migrate one real route.
9. Extract shared helpers only after a second endpoint needs them.
10. Remove this public lab route before the final merge.

## Required tests

- Initial success and initial failure.
- One delayed retry.
- Manual recovery after failure.
- Retained data during refresh and refresh failure.
- Active and inactive polling intervals.
- Hidden and visible document changes.
- Request interruption under the selected lifetime policy.
- Timeout interruption and retry count.
- Server rendering without duplicate work.
- Immediate archived success.
