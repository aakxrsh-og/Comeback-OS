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

Before migrating older schemas, the app copies the exact original serialized value to a versioned localStorage backup (`comeback-os.backup.pre-2.5` for older pre-2.5 data, or `comeback-os.backup.pre-v9` for schema versions 6–8). Schema v9 adds topic-linked evidence, per-topic mastery, and persisted engine-run summaries. Migration merges legacy chapters and record arrays. Profile offers a downloadable copy; import keeps a timestamped copy of current data first. Browser storage can still be cleared; export regularly.

The catalog crosswalks the 20 Physics, 20 Chemistry and 14 Mathematics units in the official 2027 NTA JEE Main Paper 1 syllabus and the latest published 2026 JEE Advanced syllabus. It labels each chapter as included, partial, or not listed and stores separate exam-specific topic checklists. It is a chapter-level study aid, not an official clause-by-clause equivalence; review the linked source documents. No 2027 Advanced syllabus is claimed.

## Engines and limitations

Daily quests use available minutes, backlog, priorities, evidence and revision due dates. Mastery requires topic logs and multiple independent Main and Advanced PYQ sets. The 21-day evaluation defers when evidence is limited. When eligible, its 100-point score weights consistency 25, quest completion 15, PYQ accuracy 25, chapter mastery 10, completed syllabus topics 5, assessment accuracy 10, and revisions 10; minimum evidence is 5 sessions, 2 independent sets/20 questions, and 1 assessment. Academic rank cutoffs are Initiate (0), Cadet (35), Analyst (50), Strategist (65), Elite Strategist (80), and JEE Vanguard (90), and rank history is separate from XP level. Revision dates follow recorded revision sessions. The planner blocks overlapping timed quests.

Study logs and PYQ results are student-entered and are not externally authenticated. XP tracks logged effort and never stands in for academic mastery. AI guidance is advisory, application-changing proposals require approval, and it cannot grant mastery or fabricate study evidence. Sharing a bounded progress summary is opt-in and unchecked by default. THE SYSTEM now requires a Google ID token verified by the Worker; its bearer credential is held in memory only and expires with the identity token. Local records remain in browser localStorage, are not encrypted or isolated by Google account, and are accessible to anyone using that browser profile.

Worker auth, origin validation, namespace, secret verification and the account-owner setup checklist are documented in [backend/README.md](backend/README.md). The Google OAuth Web client ID is configured as a public Worker variable in this branch, but the currently deployed Worker still returns `/api/auth/config` 503 (`configured:false`). The repository has no `MENTOR_RATE_LIMIT` binding, and the latest secret listing was empty. A dry-run passes but does not configure production. Do not treat CORS or rate limiting as identity.

The signed-in Profile page supports source-snippet development proposals: Gemini may return a validated, reviewable diff and suggested tests, but never executes code or modifies the repository. Explicit approval only downloads a patch; there is no direct GitHub inspection or repository write integration. Any later GitHub App integration must be narrowly scoped, audited and separately approved before branch/PR writes, pushes, merges or deployments.

## Backend secrets

Add encrypted Worker secret GEMINI_API_KEY with Cloudflare dashboard or Wrangler secret management. Never put a secret value in wrangler.toml, commit history, frontend source, logs, or issue reports. Review account limits and configure rate limiting before enabling broad access. Worker URL and model name are public configuration, not credentials.

## Official syllabus sources

- NTA JEE Main 2027: https://jeemain.nta.nic.in/document/syllabus-2027/
- JEE Advanced 2026 syllabus: https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf
