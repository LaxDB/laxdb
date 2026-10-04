# Alchemy and Infisical

The stack uses Alchemy `2.0.0-beta.80` and Effect `4.0.0`.

## Secret selection

Alchemy reads the LaxDB Infisical project `8fecebf6-c68b-4bf3-a3c6-e3255cf27996`.

| Operation | Infisical environment |
| --- | --- |
| Local `alchemy dev`, with any stage name | `dev` |
| Deployment to stage `dev` | `dev` |
| Deployment to stage `prod` | `prod` |
| Other deployed stages, including `pr-*` | `staging` |

Each selection reads `/` only. Subfolders and imported secrets are excluded.
Preview stages do not fall back to development or production secrets.
Create and populate the restricted `staging` environment before preview deployment.

The explicit process-environment provider comes last. Shell values override Infisical values, including empty strings.
Do not wrap `bun run dev` in `infisical run`; injected values would override the native provider.
Alchemy does not write downloaded secrets into `process.env`.
Application code must use Effect Config or explicit Worker bindings.

## Local authentication

From this worktree, run:

```sh
bun alchemy profile edit --add Infisical
bun run dev
```

Use a machine identity with read access to the LaxDB development environment.
Alchemy accepts Universal Auth credentials or a user token through its profile command.
The Infisical CLI login does not configure an Alchemy profile.
Never put credentials in source files or command arguments.

Standalone pipeline commands still require `infisical run --env=dev --`.
They do not load the Alchemy stack's secret provider.

## GitHub Actions setup

Before merging or deploying:

1. Populate the LaxDB `prod` and restricted `staging` Infisical environments at `/`.
2. Include Cloudflare deployment credentials and the application configuration previously stored in GitHub environment secrets.
3. Configure separate Infisical machine identities for production and staging.
4. Restrict each identity to read-only access to its environment and secret path.
5. Configure OIDC trust for GitHub Actions, repository `LaxDB/laxdb`, and the corresponding GitHub environment.
6. Set the GitHub environment variable `INFISICAL_IDENTITY_ID` in both `prod` and `staging`.

Use issuer `https://token.actions.githubusercontent.com` and these exact subjects:

- Production: `repo:LaxDB/laxdb:environment:prod`
- Preview deployment and cleanup: `repo:LaxDB/laxdb:environment:staging`

Configure the expected audience to match Alchemy's GitHub OIDC request.
Review GitHub environment protection rules before enabling production access.
Do not grant the staging identity access to production secrets.

Deploy and cleanup jobs have `id-token: write` permission.
Alchemy exchanges the GitHub token for a short-lived Infisical token.
The workflows no longer export application or Cloudflare secrets from GitHub.
GitHub's generated `GITHUB_TOKEN` remains available for preview comments.
Fork pull requests cannot run preview deployment or cleanup.
Draft pull requests do not deploy. Marking a pull request ready starts the deployment checks.

Required deployment credentials are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
Application configuration includes `EMAIL_SENDER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `RESEND_API_KEY`.
Set `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` only when overriding the stage-derived defaults.
Local development still disables Resend delivery.

These code changes do not create environments, configure identities, copy secrets, or deploy resources.
Secret rotation requires a new deployment; deployed Workers do not refresh secrets automatically.

## Compatibility

- Effect imports use the stable module paths, including `effect/http`, `effect/http-api`, and `effect/cli`.
- Effect Config, CLI flags, and schema transformations use their stable API names.
- The D1 and Durable Object SQL adapters are pinned to `4.0.0` to avoid conflicting Drizzle peer instances.
- Better Auth has a minimum version of `1.7.5` for the updated Alchemy adapter.
- Vitest uses version `5.0.2`, as required by `@effect/vitest` version `4.0.0`.
- The unused Cloudflare Vitest pool was removed; it does not support Vitest 5.
- The existing AWS Worker export patch now targets Distilled `1.0.0-rc.13`. It keeps Node-only authentication imports out of Worker bundles.
