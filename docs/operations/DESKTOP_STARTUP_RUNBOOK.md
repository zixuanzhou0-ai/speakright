# Desktop Startup Runbook

Last verified: 2026-06-11

This repository is the current SpeakRight Desktop workspace:

```bat
E:\SpeakRightDesktopRepo
```

Do not use the older browser workspace or an `apps\desktop` path when testing the
current desktop app. If Microsoft Edge shows `localhost refused`, that is not the
desktop app by itself; it usually means a browser tab is pointed at a dev URL
while the dev server is not running.

## Start Tomorrow: 2026-06-12

For user testing and release acceptance, start the static Release EXE. This is
the same runtime shape as the packaged desktop app and does not depend on
`localhost` or the Next dev server.

1. Confirm the repository is clean and on the current desktop repo:

```bat
cd /d E:\SpeakRightDesktopRepo
git status --short --branch
npm run desktop:preflight
```

Expected result:

```text
## main...origin/main
Desktop preflight passed.
```

2. Start the already-built Release EXE:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:launch-release
```

3. Use the app window that opens from Tauri. Do not use a browser tab pointed at
   `localhost`.

4. Begin manual QA with this order:

- Settings: confirm language switch, Azure, ElevenLabs, LLM, data/privacy, and
  release info are visible.
- English: open phoneme list, then five phoneme detail pages; play target sound,
  example word, record, replay the recording, and score once.
- Spanish, French, and Russian: switch each language, open the sound-unit list,
  then three detail pages; play target sound, example word, video, record,
  replay the recording, and score once.
- Drill, free practice, and diagnosis: check that missing/low evidence never
  presents a confident perfect diagnosis for experimental languages.

If the release executable is missing or you intentionally need fresh artifacts,
build and launch it in one step:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:preflight:build
npm run desktop:run-release
```

Before rebuilding release artifacts, close any currently running SpeakRight
window. On Windows, a running `speakright.exe` locks the executable and Tauri
cannot overwrite it during `npm run desktop:build` or `npm run validate:desktop`.
`desktop:preflight` and `desktop:preflight:build` report this condition and then
stop; they do not automatically close the user's app window. If needed, close
the window from the taskbar or stop the `speakright` process before starting the
build.

Expected process after startup:

- `speakright.exe`

The desktop window should open through Tauri. A browser tab at
`http://localhost:3002` is only a dev frontend view and should not be treated as
the installed or release desktop app.

## If The Window Shows Localhost Refused

1. Confirm the command was run from `E:\SpeakRightDesktopRepo`.
2. Close stale browser tabs that show `localhost refused`.
3. Start the release app, not the browser tab:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:launch-release
```

If the release app itself is missing, use `npm run desktop:run-release`.

## Dev Mode Is Debug-Only

Use dev mode only when actively debugging code changes:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:dev
```

Dev mode runs `next dev --turbopack --port 3002` and can spend a long time on
`compiling...` after large multilingual asset or route changes. Do not use it as
the release-readiness or user-testing entrypoint.

## Current Resource Boundary

- English word-card audio is bundled in `public/audio/words/` with `blue` and
  `pink` voice variants; Youdao is only the online fallback.
- Spanish, French, and Russian word/phrase audio is bundled in
  `public/audio/language-packs/` with `blue` and `pink` voice variants.
- Spanish, French, and Russian audio density is now tracked by
  `npm run audio:parity:dry-run`; the target is 24 practice items per sound
  unit with two local voice files per item, and the latest report has no missing
  language-pack audio.
- Multilingual audio packs are not installed from Settings anymore.
- Local articulation/video assets live under `public/videos/language-assets/`.
- API keys are not stored in Git and are excluded from learning-data export.

## Validation Before Ending A Session

Use this short validation set after UI/content work:

```bat
npm run test
npm run typecheck
npm run lint
npm run build:desktop-frontend
npm run desktop:preflight
npm run desktop:ui-smoke
```

Use this full controlled-internal release gate before publishing internal-test
installers:

```bat
npm run validate:internal-release
```

Run the live pronunciation/resource gate when checking multilingual readiness:

```bat
npm run desktop:live-validation
```

This command validates bundled audio/video paths and a high-coverage Azure
sample. It queries ElevenLabs usage but does not generate audio in the normal
release checklist.

Run the non-English audio-density dry-run before deciding whether to generate
new language-pack audio:

```bat
npm run audio:parity:dry-run
```

The dry-run writes `src-tauri\target\audio-parity\gap-report.json`, checks
Spanish/French/Russian audio coverage, and makes zero ElevenLabs API calls.

Use `desktop:ui-smoke` for release-window page coverage. It opens Settings,
English, Spanish, French, Russian, drill, free practice, and diagnosis routes,
checks that the runtime is not `localhost`, and avoids recording, Azure live
scoring, and ElevenLabs TTS generation.

Do not run ElevenLabs TTS smoke or audio generation scripts during routine
startup or manual QA. If bundled audio is missing, record the missing item first
and ask for confirmation before generating replacement audio.

Use the public release gate only after Windows code signing is configured:

```bat
npm run validate:public-release
```

Unsigned artifacts are acceptable for controlled internal testing only when the
release notes and installation guide keep the unsigned warning visible.

## 2026-06-10 Handoff Notes

- English remains the stable baseline.
- `es-ES`, `fr-FR`, and `ru-RU` remain experimental; `evidenceMastery` is still
  disabled for these languages.
- The Settings language-pack installer UI has been removed because multilingual
  audio is bundled.
- The phoneme sidebar uses compact rows for English and two-line wrapping rows
  for non-English sound units to avoid overlapping long rule labels.
- Spanish Sounds of Speech videos use original-ratio sizing with small side
  previous/next controls.
- `desktop:artifact-smoke` scans source policy and static artifacts for retired
  pronunciation sources while ignoring build directories such as `target`,
  `.next`, and `out`.
- Manual testing should start from `npm run desktop:launch-release` or
  `npm run desktop:run-release`, not `npm run desktop:dev`.
- No real API key was found in the repository during the final secret scan.

## 2026-06-10 Stabilization Result

- GitHub Actions passed for pushed commit `78118e9`.
- A clean rebuild was done after removing the old `src-tauri\target` directory.
- `npm.cmd run validate:desktop` passed after the clean rebuild.
- `npm.cmd run validate:release` ran through desktop validation and failed only
  at the public release gate because EXE/MSI/NSIS artifacts are unsigned.
- Current public-release blocker remains Windows code signing; controlled
  internal testing may continue with the unsigned warning visible.

## 2026-06-11 Release-Validation Result

- Current validation update: commit `94be1d4` (`chore: tighten desktop release
  validation`).
- `npm.cmd run test`: 72 test files and 363 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed; Biome checked 308 files.
- `npm.cmd run build:desktop-frontend`: passed; 144 static pages generated.
- `npm.cmd run desktop:live-validation`: passed.
- First `npm.cmd run validate:desktop` attempt found a real process-lock issue:
  an already-running `speakright.exe` prevented Tauri from overwriting the
  release executable. After closing the release process, the full validation
  passed.
- Bundled audio validated: English `1464/1464`, Spanish `398/398`, French
  `509/509`, Russian `407/407`.
- Bundled videos validated: `210/210`.
- Azure live pronunciation-assessment sample: `220/220` passed.
- ElevenLabs usage was checked before and after validation; no TTS smoke was run
  and estimated generated characters used were `0`.
- Keep using `npm run desktop:launch-release` for tomorrow's manual testing;
  dev mode remains debug-only.

## 2026-06-11 Preflight/UI-Smoke Hardening Result

- Added `npm run desktop:preflight`; it detected an already-running
  `speakright.exe` process during validation and failed with an actionable
  "close the app first" message instead of silently killing the window.
- Added `npm run desktop:ui-smoke`; it launched the Release EXE and verified
  Settings, English `/phonemes/ee`, Spanish `/phonemes/es-a`, French
  `/phonemes/fr-i`, Russian `/phonemes/ru-a`, drill, free practice, and
  diagnosis from the Tauri runtime.
- Added docs-only GitHub Actions path filtering: README/docs-only changes use
  the lightweight Docs Check workflow; code/resource/Tauri/package changes still
  run the Windows desktop build.
- Non-English diagnosis now withholds trusted overall scores for silence, too
  few word-level items, target-text mismatch, missing phoneme alignment, invalid
  recordings, or partial/low-evidence readings.
- Validation results after the fixes:
  - `npm.cmd run test`: 74 files and 374 tests passed.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed; Biome checked 312 files.
  - `npm.cmd run build:desktop-frontend`: passed; 144 static pages generated.
  - `npm.cmd run desktop:preflight`: passed after closing the stale release
    process.
  - `npm.cmd run desktop:ui-smoke`: passed, not served from `localhost`.
  - `npm.cmd run desktop:live-validation`: passed; English `1464`, Spanish
    `398`, French `509`, Russian `407`, videos `210`, Azure `220/220`,
    ElevenLabs generated characters `0`.
  - `npm.cmd run validate:desktop`: passed.
- `npm.cmd run desktop:release-gate`: failed only because EXE/MSI/NSIS
    artifacts are unsigned, which remains the public-release blocker.

## 2026-06-12 First Task

- Start with `npm run desktop:preflight`, then `npm run desktop:launch-release`.
- If the window does not appear, check for an existing `speakright.exe` process,
  close it, then run `npm run desktop:launch-release` again.
- If the app opens, spend the first pass on manual QA rather than new features:
  settings, English, Spanish, French, Russian, drill, free practice, diagnosis.
- If a bug appears, capture the language, page, sound unit or word, action taken,
  and whether it is audio, video, scoring, recording replay, layout, or wording.
- Only rebuild with `npm run desktop:run-release` after code changes or if the
  release executable is missing.

## 2026-06-11 Multilingual Audio Parity Dry-Run

- Added `npm run audio:parity:dry-run`.
- The density contract now checks Spanish, French, and Russian at 24 practice
  items per sound unit; rule/prosody units must be phrase-heavy rather than
  word-only.
- Initial dry-run before generation:
  - Spanish: `398` existing local audio items, `42` pending.
  - French: `509` existing local audio items, `36` pending.
  - Russian: `407` existing local audio items, `53` pending.
  - Total pending single-voice audio items: `131`.
  - Estimated ElevenLabs characters/credits before generation: about `2418`.
- After user confirmation, generated the missing single-voice language-pack
  audio and updated manifests:
  - Spanish: `440/440`, missing `0`.
  - French: `545/545`, missing `0`.
  - Russian: `460/460`, missing `0`.
- Routine dry-run checks still make zero ElevenLabs API calls.

## 2026-06-11 Multilingual Dual-Voice Expansion

- Upgraded Spanish, French, and Russian language-pack manifests to v2 with
  `blue` and `pink` local audio variants for every bundled item.
- Primary voices remain:
  - Spanish: `Marco Cruz`
  - French: `Clément`
  - Russian: `Valeria`
- Secondary voices selected from ElevenLabs voices metadata and generated once:
  - Spanish: `Lydia`
  - French: `Rachel`
  - Russian: `Sergey`
- Final zero-cost dry-run results:
  - Spanish: `880` existing audio files, `0` missing.
  - French: `1090` existing audio files, `0` missing.
  - Russian: `920` existing audio files, `0` missing.
  - Total missing: `0`.
- Estimated approved one-time generation size: about `10645` characters.
  Routine validation must not regenerate these files.
- The phoneme detail card now has a compact A/B standard-voice selector. Manual
  QA should check both voices for at least a few words in each language.
- Validation after the dual-voice expansion:
  - `npm.cmd run test`: `75` files and `380` tests passed.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed; Biome checked `317` files.
  - `npm.cmd run build:desktop-frontend`: passed; `144` static pages generated.
  - `npm.cmd run audio:parity:dry-run`: Spanish `880`, French `1090`, Russian
    `920`, total missing `0`.
  - `npm.cmd run desktop:live-validation`: English `1464`, Spanish `880`,
    French `1090`, Russian `920`, videos `210`, Azure `220/220`, ElevenLabs
    generated characters `0`.
  - `npm.cmd run validate:desktop`: passed, including Tauri build, UI smoke,
    release smoke, release report, and installer smoke.
  - `npm.cmd run desktop:release-gate`: failed only because EXE/MSI/NSIS
    artifacts are unsigned.
