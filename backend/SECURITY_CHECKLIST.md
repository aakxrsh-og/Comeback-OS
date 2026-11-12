# Security checklist

- [ ] Revoke the previously exposed Gemini API key.
- [ ] Create a fresh provider key under adult/guardian supervision.
- [ ] Store it only as Cloudflare Worker Secret `GEMINI_API_KEY`.
- [ ] Never store the key in GitHub Pages, frontend source, localStorage, or chat.
- [ ] Restrict `ALLOWED_ORIGINS` to the exact published app origin.
- [ ] Configure Cloudflare rate limiting / abuse protection before public use.
- [ ] Configure provider budget/usage alerts and limits where available.
- [ ] Send only the minimum study context needed; no names, contact details, passwords or secrets.
- [ ] Keep a local-only fallback when the backend is offline.
- [ ] Test errors and provider quota exhaustion without exposing upstream details.
