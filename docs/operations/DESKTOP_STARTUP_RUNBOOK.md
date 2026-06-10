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

## Start Tomorrow

For user testing and release acceptance, start the static Release EXE. This is
the same runtime shape as the packaged desktop app and does not depend on
`localhost` or the Next dev server.

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:launch-release
```

If the release executable is missing or you need fresh artifacts, build and
launch it in one step:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:run-release
```

Before rebuilding release artifacts, close any currently running SpeakRight
window. On Windows, a running `speakright.exe` locks the executable and Tauri
cannot overwrite it during `npm run desktop:build` or `npm run validate:desktop`.
If needed, close the window from the taskbar or stop the `speakright` process
before starting the build.

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
  `public/audio/language-packs/`.
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
