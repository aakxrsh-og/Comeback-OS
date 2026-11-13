# COMEBACK OS 2.5 — Cloudflare Worker

The PWA calls this Worker for THE SYSTEM mentor. The Worker holds the provider key, validates and bounds requests and responses, limits actions to a small schema, and requires a rate-limit binding. The app continues to work offline when the service is unavailable.

## Configuration

- `ALLOWED_ORIGINS` is validated at runtime: exact origins only; no wildcard, credentials, path, query, fragment, duplicate, or non-local insecure HTTP origin. The checked-in value `https://aakxrsh-og.github.io` is the origin for the Pages project URL `https://aakxrsh-og.github.io/Comeback-OS/` (the project path must not appear in the origin).
- Set `GEMINI_MODEL` to a model enabled for the provider project.
- Add `GEMINI_API_KEY` as an encrypted Worker secret. If a key was previously exposed, revoke it and create a replacement directly in the provider console. Never share a key in chat, commit it, or print it in a terminal.
- Configure `GOOGLE_CLIENT_ID` as the public OAuth 2.0 Web client ID. The browser signs in through Google Identity Services; the Worker verifies RS256 signature against Google's published signing keys and checks issuer, audience, verified email, issued-at and expiry. It never trusts an identity claim sent separately from the bearer token.
- This repository has no Cloudflare account access and does not claim a configured namespace ID. The Worker fails closed with HTTP 503 until `MENTOR_RATE_LIMIT` is bound.
- Cloudflare's built-in rate limits are approximate and location-scoped, not strict global quotas. The account owner must confirm that the chosen ID is unique.

Before deployment, add this exact binding shape to `wrangler.toml`, replacing the placeholder with a positive integer namespace ID that the Cloudflare account owner confirms is unique:

```toml
[[ratelimits]]
name = "MENTOR_RATE_LIMIT"
namespace_id = "<ACCOUNT_UNIQUE_POSITIVE_INTEGER>"

  [ratelimits.simple]
  limit = 10
  period = 60
```

Cloudflare rate-limit bindings use developer-defined integer namespace IDs; there is no repository-side value to verify without account access. See [Cloudflare rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

### Account-owner setup (no deployment performed)

1. In Google Cloud Console, create an OAuth 2.0 **Web application** client for Google Identity Services. Add `https://aakxrsh-og.github.io` under Authorized JavaScript origins (no project path). Add a localhost origin only for local development. This client ID is public; do not use a client secret in the static app.
2. In the Cloudflare account that owns `comeback-os-ai`, confirm the Worker account and select an unused positive integer for a unique rate-limit namespace. Use the exact `[[ratelimits]]` block above; do not copy a namespace ID from an example or another account. The rate limit is approximate and per Cloudflare location.
3. Set the real Google Web client ID in `GOOGLE_CLIENT_ID` in `backend/wrangler.toml`. Keep `ALLOWED_ORIGINS` exactly equal to the published origin and do not add the `/Comeback-OS/` path.
4. From `backend/`, run `npx wrangler whoami` to confirm the intended account. Run `npx wrangler secret list` to verify that a secret named `GEMINI_API_KEY` exists; this lists metadata only, never the value. If it is absent, use `npx wrangler secret put GEMINI_API_KEY` and paste the key only into Wrangler's interactive prompt.
5. Run `npx wrangler deploy --dry-run` to validate the prepared bundle/configuration. This does not deploy. Before any real deployment, explicitly review `wrangler.toml`, confirm the origin, OAuth client, unique namespace, and secret presence, then separately approve deployment. No deploy was performed for this branch.

This checkout has no Cloudflare account session or account-provided namespace ID, Google OAuth client ID, or secret metadata. Therefore the encrypted secret's presence and the live Cloudflare binding cannot be independently verified here. `wrangler.toml` intentionally leaves the OAuth client ID blank and the rate-limit ID unset; the Worker fails closed until both are correctly supplied.

### Identity and data boundary

`/api/mentor` and `/api/dev-tasks/propose` require a Google ID token in `Authorization: Bearer ...`; signature and claims are checked on every request. Rate limiting keys off a SHA-256 digest of the verified Google subject, never `CF-Connecting-IP`. `/health` and `/api/auth/config` are deliberately public; the latter returns only the public OAuth client ID and only to an allowed origin. Preflight is not authentication. All other API paths return 404. The browser keeps the ID token in memory only, clears it at expiry/sign-out, and requires sign-in again after reload. Sharing study context is opt-in and unchecked by default.

Study history remains in the browser's localStorage and is not encrypted or isolated by Google account; this is a single-browser-profile local-first app, not remote per-user storage. Anyone with access to that browser profile can access local data. The Worker does not persist study content. Mentor actions are schema-limited, carry an account-bound owner digest, are checked against the current signed-in identity, and still require explicit in-app approval. CORS and rate limiting are defense-in-depth only and are not authentication.

### Development task boundary

The signed-in Profile page has a proposal-only development task panel. It sends one explicitly approved source snippet and task description to `/api/dev-tasks/propose`; the Worker bounds inputs, rejects likely credentials and unsafe paths, asks Gemini for a diff only against the supplied path, and validates diff headers. The UI renders the diff as text and requires same-account, unexpired approval before downloading a `.patch`. Gemini output is never executed, the patch is never auto-applied, and approval/download does not write to the repository. Local audit metadata records approval/rejection without storing source or patch.

This is not a live GitHub integration: the model sees only the snippet a user supplies, not the full working tree or current GitHub branch. A GitHub App is still required for direct repository inspection or any branch/PR write. An owner must create an App restricted to the target repository, grant read-only contents for inspection, and add only the narrow write permission needed for branch/PR creation after approval. Keep its private key as a Worker secret; never use a broad personal access token. Require branch/path allowlists, diff review, test evidence, idempotency, audit records, and a separate approval step before push/PR/deployment. No GitHub App credential or repository write bridge is configured.

For secret setup, see [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/) and the [Cloudflare rate-limit binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Endpoint contract

`POST https://YOUR-WORKER.../api/mentor`

JSON body:
```json
{
  "message": "Help me understand my next JEE study step.",
  "studyContext": "Optional short, non-sensitive study summary"
}
```

Successful response:
```json
{
  "reply": "Mentor response...",
  "actions": [],
  "model": "model-version"
}
```

The Worker accepts only the configured browser origin, caps inbound and provider response sizes, uses a fixed educational system instruction, and never sends the API key to the browser. AI actions are proposals; the app validates them again and requires explicit approval.

Each returned action has a Worker-generated unique ID, a short expiry, a validation marker, and a reason/effect preview. The browser validates chapter and quest IDs against the current local database, persists lifecycle transitions and audit events, and executes only after explicit approval. The Worker cannot verify those IDs against application ownership because it has no application database. Frontend idempotency is local to the user's browser profile; it is not a server-side transaction ledger.

CORS and rate limiting are not user authentication. The Worker verifies Google ID tokens; rate limiting is defense-in-depth. Local browser records remain available to users of that browser profile and are not encrypted or separated by Google account.

The Worker never executes source code, shell commands, Git operations, merges, or deployments. Development task proposals are review-only downloads. Direct GitHub read/write and actual frontend-to-live-Worker authentication remain unverified until account configuration and deployment are approved.

## Release boundary

This release branch has not been deployed. The previously checked live Worker is still the older unauthenticated build; do not treat this branch's authentication as protecting that deployed endpoint. Before any deployment, configure the encrypted provider secret, OAuth client and account rate-limit namespace, verify them without printing secret values, and exercise sign-in, `/health`, `/api/mentor`, action approval and development proposals from the hosted app. CORS is not authentication; do not treat a personal endpoint as safe for broad public sharing without appropriate access control. No deploy or merge was performed.
