# Malvern

## API routing

Cloudflare routes `/api/auth/*` and `/api/report-images/*` directly to the API worker on Malvern's domain. Other paths use the Malvern app worker. `api-paths.ts` defines both API path prefixes.

The browser keeps the same origin for cookies and authentication callbacks. Better Auth and image authorization remain in the API worker. Server functions still use the generated API client and the `API` service binding.

Malvern's `workers.dev` URLs are disabled because these path routes only apply to the custom domain. PR previews use `malvern.<stage>.dev.laxdb.io`.

## Local development

From the repository root:

```sh
infisical run --env=dev -- bun run dev
```

Open http://localhost:1438/. Vite's built-in proxy sends the same API paths to `http://localhost:1437`. It preserves the original Host, Origin, cookies, body, and response headers. `API_PORT` overrides the local API port.

## Checks

```sh
bun run --cwd packages/malvern test
bun run --cwd packages/malvern typecheck
bun run --cwd packages/malvern build
```

Cloudflare path routing needs a deployed preview check before production use. Check sign-in, its callback, session cookies, and authorized image loading on that domain.
