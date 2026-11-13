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

Before migrating older schemas, the app copies the exact original serialized value to a versioned localStorage backup (`comeback-os.backup.pre-2.5` for older pre-2.5 data, or `comeback-os.backup.pre-v8` for later schemas). Migration merges legacy chapters and record arrays; schema v8 adds preparation targets and the approval/action ledger. Profile offers a downloadable copy. Import keeps a timestamped copy of current data first. Browser storage can still be cleared; export regularly.

The catalog crosswalks the 20 Physics, 20 Chemistry and 14 Mathematics units in the official 2027 NTA JEE Main Paper 1 syllabus and the latest published 2026 JEE Advanced syllabus. It labels each chapter as included, partial, or not listed and stores separate exam-specific topic checklists. It is a chapter-level study aid, not an official clause-by-clause equivalence; review the linked source documents. No 2027 Advanced syllabus is claimed.

## Engines and limitations

Daily quests use available minutes, backlog, priorities, evidence and revision due dates. Mastery requires topic logs and multiple independent Main and Advanced PYQ sets. The 21-day evaluation defers when evidence is limited. Revision dates follow recorded revision sessions. The planner blocks overlapping timed quests.

Study logs and PYQ results are student-entered and are not externally authenticated. XP tracks logged effort and never stands in for academic mastery. AI guidance is advisory, application-changing proposals require approval, and it cannot grant mastery or fabricate study evidence. Sharing a bounded progress summary is optional. The static frontend and Worker do not provide user authentication; CORS is not authentication. No autonomous repository-editing bridge is included.

## Backend secrets

Add encrypted Worker secret GEMINI_API_KEY with Cloudflare dashboard or Wrangler secret management. Never put a secret value in wrangler.toml, commit history, frontend source, logs, or issue reports. Review account limits and configure rate limiting before enabling broad access. Worker URL and model name are public configuration, not credentials.

## Official syllabus sources

- NTA JEE Main 2027: https://jeemain.nta.nic.in/document/syllabus-2027/
- JEE Advanced 2026 syllabus: https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf
