# COMEBACK OS 2.0

A phone-first, local-first PWA prototype with a hybrid-intelligence architecture.

## Deploy/update on GitHub Pages
1. Back up v1 data from the Profile screen before updating.
2. Extract this ZIP.
3. Upload/replace the files in the root of the existing `comeback-os` repository.
4. Commit the changes. Keep the repository and GitHub Pages settings unchanged.
5. Open the existing Pages site in Brave. Refresh; if an older shell remains, close the installed app and reopen it after the service worker updates.

## Data preservation
The app retains the v1 localStorage key `comeback-os` and migrates common v1 fields. Nevertheless, export a JSON backup first. Browser storage can be cleared by Android/Brave, so keep a backup somewhere safe.

## Current capabilities
- Mobile-first holographic-style interface and animated core
- Local quests, study evidence, chapter records, XP and level progression
- Local rule-based recommendations
- JSON export/import
- Offline shell through service worker
- Backend endpoint setting placeholder

## Important: what is and is not "fully AI"
This build is **AI-ready, not connected to a live AI model**. It includes a local rules-based intelligence layer. Real model reasoning requires a separately hosted secure backend and an API credential. GitHub Pages is static hosting and cannot securely hold that secret. Do not paste API keys into `app.js`, GitHub, or this app's public files. Do not create paid API billing without parent/guardian approval.

The backend starter folder contains an architecture contract and example request/response schema. It is not a deployed backend and does not call a model yet.

## Mastery safeguards
The current prototype stores user-entered PYQ verification flags. It does not independently validate the question, solution, answer key, or difficulty. A production mastery engine must require reviewed evidence and apply deterministic app-side gates. Do not treat a self-entered flag as proof of mastery.

## Data model
See `docs/DATA_MODEL.md` and `docs/AI_CONTRACT.md`.
