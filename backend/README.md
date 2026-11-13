# COMEBACK OS 2.5 — Cloudflare Worker

The PWA calls this Worker for THE SYSTEM mentor. The Worker holds the provider key, validates and bounds requests and responses, limits actions to a small schema, and requires a rate-limit binding. The app continues to work offline when the service is unavailable.

## Configuration

- Set `ALLOWED_ORIGINS` to the exact GitHub Pages origin (no path or trailing slash).
- Set `GEMINI_MODEL` to a model enabled for the provider project.
- Add `GEMINI_API_KEY` as an encrypted Worker secret. If a key was previously exposed, revoke it and create a replacement directly in the provider console. Never share a key in chat, commit it, or print it in a terminal.
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

## Release boundary

This release branch has not been deployed. Before deployment, configure the encrypted provider secret, confirm the Pages origin and account rate-limit namespace, and exercise `/health` and `/api/mentor` from the hosted app. CORS is not authentication; do not treat this personal endpoint as safe for broad public sharing without an appropriate access-control design.
