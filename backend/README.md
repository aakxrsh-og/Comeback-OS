# COMEBACK OS 2.5 — Secure AI Backend Starter

This ZIP contains a **backend starter**, not a full replacement for the current PWA. It provides a small Cloudflare Worker proxy for Gemini so the provider key is not exposed in browser JavaScript or GitHub Pages.

## Before deploying

- The previously shared Gemini key should be treated as compromised. Revoke it in the provider console and create a fresh one. Do not paste either key into ChatGPT, GitHub files, screenshots, or this ZIP.
- Because this is for a teenage student, have a parent/guardian supervise the provider account, its terms, billing settings and usage limits.
- The current public app does not yet call this endpoint. Deploying this Worker alone does **not** make The System live; the frontend integration is a separate step.
- Add an effective per-IP rate limit / abuse protection in Cloudflare before exposing the endpoint publicly. CORS is not authentication and does not stop non-browser clients.

## Deploy through the Cloudflare dashboard

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a Worker named `comeback-os-ai`.
3. Choose the option to edit/upload code, then add `src/index.js` as the Worker entry point. If using Wrangler, deploy this folder with `npx wrangler deploy`.
4. In Worker **Settings → Variables and Secrets**, add a variable named `ALLOWED_ORIGINS` with value `https://aakxrsh-og.github.io` (or your exact Pages origin).
5. Add `GEMINI_MODEL` as a normal variable. Start with the model configured in `wrangler.toml`; if it is unavailable to your API project, choose a currently enabled text-generation model in Google AI Studio.
6. Under **Variables and Secrets**, add `GEMINI_API_KEY` and choose type **Secret**. Paste the newly generated key directly into the secret field. Do not send it to ChatGPT or commit it to GitHub.
7. Deploy the Worker.
8. Open `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/health`. It should return `ok: true` and `providerConfigured: true`. This checks configuration only, not a live generation request.

Cloudflare's encrypted secret instructions:
https://developers.cloudflare.com/workers/configuration/secrets/

Gemini REST API reference:
https://ai.google.dev/api/generate-content

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
  "model": "model-version"
}
```

The Worker accepts only the configured browser origin, caps request sizes, uses a fixed educational system instruction, and never sends the API key to the browser.

## Important production work still required

- Add Cloudflare rate limiting / abuse protection and monitor provider usage.
- Add a proper authentication/session design before sharing the endpoint beyond this personal app.
- Connect the frontend chat UI to `/api/mentor`, show loading/error states, and avoid sending unnecessary personal data.
- Test the endpoint from the deployed Pages origin and check the browser console/network panel.
- Keep local-first quest, calendar and mastery logic functional if AI is unavailable.
- The existing JEE chapter catalogue is only a 30-chapter starter set, not a complete official syllabus.
