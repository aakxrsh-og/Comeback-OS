# COMEBACK OS 2.1 — Hybrid Intelligence

Phone-first, local-first PWA. This release adds five cooperating deterministic engines while preserving the existing `comeback-os` localStorage key and import/export workflow.

## Deploy/update on GitHub Pages
1. In the currently installed app, open Profile → Export Backup first.
2. Extract this ZIP.
3. Upload/replace the contents of `COMEBACK_OS_2_0` in the root of the existing `comeback-os` repository.
4. Commit the changes; keep the repository and GitHub Pages settings unchanged.
5. Reopen the existing Pages URL in Brave. If the old shell remains, close and reopen the installed PWA after the service worker refreshes.
6. Import the JSON backup only if the browser's local data is missing. The app also migrates the existing `comeback-os` data automatically.

## Five engines
1. **Daily Quest Engine:** generates a small daily mission set using chapter priorities, backlog and retention needs.
2. **Mastery Engine:** uses recorded independent PYQ sessions, accuracy, topic coverage and separate Main/Advanced evidence. It does not accept a manual mastery toggle.
3. **21-Day Evaluation:** reviews the rolling 21-day record. It defers when evidence is insufficient rather than treating missing data as failure.
4. **Retention Engine:** flags mastered chapters whose last revision is overdue.
5. **Progress Intelligence:** produces explainable recommendations from local records.

## Important limitations
- The included chapter list is a **30-chapter starter catalogue**, not the complete official JEE Main + Advanced syllabus. Do not treat it as complete coverage.
- PYQ evidence is user-entered and not externally authenticated. The mastery gate is a useful progress rule, not an independent verification of question authenticity or answer correctness.
- The evaluation score is a transparent prototype metric, not a predicted JEE rank or an official academic grade.
- No live AI provider is connected. The backend URL field only saves an address; no student data is transmitted. Review provider terms for the actual student end user before enabling any external AI. Keep API credentials on a secure backend, never in `app.js`, GitHub Pages, or screenshots.

## Data safety
Export a JSON backup regularly. Browser storage can be cleared by Android/Brave. See `docs/DATA_MODEL.md`, `docs/AI_CONTRACT.md`, and `backend-starter/README.md`.
