## Public Publishing

- This is the sanitized public checkout for `LaxDB/laxdb`. Keep its history and remotes separate from any private backup checkout.
- Never publish with personal GitHub credentials, `gh`, the GitHub web UI, or a modified remote push URL. Public publishing must use the `laxdb-publisher` GitHub App so activity and commits remain unlinked to a personal identity.
- Publish branches with `~/.config/laxdb-publisher/push.sh`. Create pull requests with `~/.config/laxdb-publisher/create-pr.sh`. Merge pull requests with `~/.config/laxdb-publisher/merge-pr.sh`.
- Standard merges must wait for the helper's required CI checks and use squash merge.
- When the user explicitly instructs the agent to force-merge a specific PR, the agent may use a force/bypass option without waiting for CI. A general request to merge is not authorization to force. Never force after a required check has failed unless the user explicitly confirms that failure may be bypassed.
- A forced merge may bypass only CI completion/success requirements. It must preserve every identity, authentication, authorization, clean-checkout, forbidden-path, blocked-identity, neutral-metadata, unlinked-tip, published-SHA, and branch-deletion safeguard.
- Report which checks were pending or failed when a force merge was performed. Do not claim the change was validated by checks that were bypassed.
- Keep checkout commit identity set to `LaxDB <noreply@laxdb.io>` with `user.useConfigOnly=true`, and verify public commits remain unlinked to a GitHub user.
- When migrating work from a private checkout, copy only the final patch/state. Never copy private history, submodule configuration, vendored private dependencies, local secret configuration, secrets, or personal metadata into this checkout.
- The public checkout intentionally has a disabled push URL; do not change it.
