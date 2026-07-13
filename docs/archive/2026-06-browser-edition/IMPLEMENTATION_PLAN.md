# Browser Edition Implementation Plan

This is the staged work plan for converting the old browser scaffold into a
real Browser Edition that matches the latest Windows Desktop product boundary.

## Phase 0: Freeze Baselines

1. Record the latest desktop source branch, commit SHA, and status from
   `<repository-root>`.
2. Record this repository status before edits. Do not revert unrelated dirty
   files.
3. Read:
   - `docs/browser-edition/README.md`
   - `docs/browser-edition/ARCHITECTURE_AND_SEPARATION.md`
   - `docs/browser-edition/VALIDATION_AND_RELEASE.md`
   - `docs/operations/NEXT_BROWSER_EDITION_GOALS.md`
4. Confirm the old browser scaffold exists at `apps/web`.
5. Confirm whether `apps/browser` already exists. If it does not, create it.

Exit criteria:

- Baseline notes are written to the implementation log or commit message.
- No desktop release artifact, EXE, MSI, NSIS, private key, recording, or local
  credential is staged.

## Phase 1: Create The Browser Folder

Target final app:

```text
apps/browser
```

Recommended steps:

1. Seed `apps/browser` from the old `apps/web` only where it helps:
   package scripts, Next config, public asset layout, route shell.
2. Rename app metadata from `speakright-web` to `speakright-browser`.
3. Add `apps/browser/README.md` explaining that this is the browser app.
4. Keep `apps/web` temporarily only as `legacy web scaffold` or remove it after
   Browser Edition passes validation.
5. Ensure root scripts distinguish all editions:
   - `dev:browser`
   - `build:browser`
   - `serve:browser` or documented static-server command
   - `dev:desktop`
   - `desktop:build`

Exit criteria:

- A developer can run Browser Edition without opening the desktop app.
- A developer can run Desktop without opening the browser app.
- README/docs name both paths plainly.

## Phase 2: Port Shared Product Surface

Port or recreate the latest desktop product surface in Browser Edition:

| Route | Browser target |
| --- | --- |
| `/` | Browser landing or direct app entry that does not look like a marketing-only placeholder. |
| `/settings` | Provider setup, key storage choice, browser privacy warning, provider tests where possible. |
| `/phonemes` | Language-aware sound-unit list. |
| `/phonemes/[phoneme]` | Current compact left-column practice layout, demos, recording, score summary, detailed analysis. |
| `/sentences` | Free practice with text input, audio/read-along where available, recording, scoring, AI feedback. |
| `/drill` | English advanced drill entry and available subroutes. |
| `/assessment` | English diagnosis first; non-English diagnosis remains experimental/gated. |
| `/progress` | Browser-local progress/evidence if storage permits. |

Port these supporting areas:

- language profile data for English, Spanish, French, Russian
- local audio/video asset maps
- scoring UI and Azure result rendering
- LLM feedback renderer and coach-mode rules
- storage/history/progress utilities
- browser-safe error messages in Chinese
- responsive layouts verified at desktop and narrow browser widths

Exit criteria:

- Browser routes exist and do not import Tauri.
- Missing features show honest "not available in Browser Edition yet" states
  only while the migration is in progress.

## Phase 3: Browser Azure Scoring Spike

This is the highest-risk technical step.

Tasks:

1. Check current official Azure Speech browser documentation before coding.
2. Implement a browser assessment adapter under `apps/browser/src/platform`.
3. Record audio through browser APIs and feed it to Azure using the selected
   language locale.
4. Verify at least one real assessment per supported language profile:
   - English `en-US`
   - Spanish `es-ES`
   - French `fr-FR`
   - Russian `ru-RU`
5. Add tests that prove LLM code cannot be the scoring source.

Exit criteria:

- A real browser recording produces Azure numeric scores.
- The UI labels those scores as Azure-derived.
- LLM feedback can be disabled while scoring still works.
- If Azure browser scoring fails, the blocker is written down and no fake
  scoring path is merged.

## Phase 4: Browser Storage And Settings

Tasks:

1. Implement browser key storage with an explicit persistence toggle.
2. Keep provider keys out of URLs, screenshots, logs, tests, and docs.
3. Add storage failure handling for localStorage/IndexedDB quota or privacy
   mode failures.
4. Preserve current result rendering when history cannot be saved.
5. Add Settings copy that distinguishes:
   - Azure Speech scoring
   - ElevenLabs optional TTS
   - LLM coaching
   - dictionary fallback providers

Exit criteria:

- Missing key, invalid key, network failure, quota/rate-limit, and timeout have
  Chinese recovery messages.
- Browser Edition opens without keys.
- Browser Edition does not commit or generate credential files.

## Phase 5: Static Build And Browser Smoke

Tasks:

1. Make `npm run build:browser` produce a browser build.
2. If static export is supported, produce `apps/browser/out`.
3. Serve the export through localhost for microphone testing.
4. Add browser smoke coverage:
   - home/app entry opens
   - settings opens
   - English phoneme detail opens
   - Spanish/French/Russian sound-unit pages open
   - recording controls render
   - score summary layout can render from a guarded smoke fixture
   - no Tauri global/API is required
   - browser route is not using desktop port/runtime
5. Add visual screenshots for README and release docs.

Exit criteria:

- Browser smoke passes on a local static or production server.
- Screenshots are captured from the Browser Edition, not the desktop app.

## Phase 6: GitHub Documentation And Release Polish

Tasks:

1. Rewrite README so the first screen tells users:
   - choose Windows Desktop if you want the installer/app
   - choose Browser Edition if you want cross-platform browser usage
   - where each folder lives
   - which commands belong to each edition
2. Add Browser Edition screenshots.
3. Update install/run docs:
   - Windows Desktop installation
   - Browser Edition local run/static run
   - source build expectations
4. Update credits and third-party notices:
   - APIs
   - teaching videos
   - audio assets
   - dictionary providers
   - phonetics references
5. Update release notes with separate artifact sections:
   - Windows Desktop artifacts
   - Browser Edition source/static artifact
   - known limitations
   - scoring boundary
6. Make GitHub labels/issues/templates clear for desktop vs browser bugs.

Exit criteria:

- A new GitHub visitor can decide which edition to use within 60 seconds.
- No release note implies unsigned Windows artifacts are signed.
- Browser Edition is not described as SaaS.

## Phase 7: Final Cleanup

Tasks:

1. Remove ambiguous generated files, old screenshots, stale docs, and obsolete
   old web artifacts only after confirming they are not referenced.
2. If `apps/web` is retained, label it as legacy in README and docs.
3. If `apps/web` is removed, update scripts and links.
4. Run a broken-link check over Markdown.
5. Run secret scan over staged docs and source.
6. Commit in clear slices:
   - scaffold/separation
   - browser feature sync
   - browser validation
   - docs/release cleanup

Exit criteria:

- `git status` contains only intentional files.
- No stale docs tell users to use the wrong folder.
- Browser and Desktop can be validated independently.
