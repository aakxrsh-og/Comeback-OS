# COMEBACK OS 2.5

Mobile-first local-first JEE preparation PWA. Browser data remains under the legacy-compatible localStorage key comeback-os. Planning, evidence logging, progress, and backup work offline.

## Run and deploy

Serve the repository root over HTTP(S). GitHub Pages serves this project at https://aakxrsh-og.github.io/Comeback-OS/. The manifest, service-worker scope, and assets use relative paths for the project subpath.

1. Export a JSON backup from Profile before updating an existing install.
2. Publish the repository root with GitHub Pages.
3. Keep the Worker API key as a Cloudflare encrypted secret named GEMINI_API_KEY. Set GEMINI_MODEL and ALLOWED_ORIGINS as Worker variables.
4. Restrict ALLOWED_ORIGINS to https://aakxrsh-og.github.io. CORS only controls browsers and is not authentication. Configure Cloudflare rate limiting / abuse controls before public exposure.
5. Deploy backend/ with Wrangler or the Cloudflare dashboard. Confirm /health and /api/mentor from the Pages origin.
6. Never put credentials in frontend files, localStorage, repository history, diagnostics, or chat.

## Data safety and migration

Before migrating an older schema, the app copies the original serialized value to comeback-os.backup.pre-2.5 and merges legacy chapters and record arrays. Profile offers a downloadable copy. Import keeps a timestamped copy of current data first. Browser storage can still be cleared; export regularly.

JEE Main coverage is labeled against the official 2027 NTA syllabus. Advanced uses the latest official 2026 syllabus verified for this release. Chapter-level flags aid navigation and are not a clause-by-clause crosswalk. Review the official syllabus for exact boundaries; no 2027 Advanced syllabus is claimed.

## Engines and limitations

Daily quests use available minutes, backlog, priorities, evidence and revision due dates. Mastery requires topic logs and multiple independent Main and Advanced PYQ sets. The 21-day evaluation defers when evidence is limited. Revision dates follow recorded revision sessions. The planner blocks overlapping timed quests.

Study logs and PYQ results are student-entered and are not externally authenticated. XP tracks logged effort and never stands in for academic mastery. AI guidance is advisory and cannot create study evidence or modify mastery. Sharing a compact progress summary is optional.

## Backend secrets

Add encrypted Worker secret GEMINI_API_KEY with Cloudflare dashboard or Wrangler secret management. Never put a secret value in wrangler.toml, commit history, frontend source, logs, or issue reports. Review account limits and configure rate limiting before enabling broad access. Worker URL and model name are public configuration, not credentials.

## Official syllabus sources

- NTA JEE Main 2027: https://jeemain.nta.nic.in/document/syllabus-2027/
- JEE Advanced 2026 syllabus: https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf
