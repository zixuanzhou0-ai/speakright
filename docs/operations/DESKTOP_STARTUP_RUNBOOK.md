# Desktop Startup Runbook

Last verified: 2026-06-19

This repository is the current SpeakRight Desktop workspace:

```bat
E:\SpeakRightDesktopRepo
```

Do not use the older browser workspace or an `apps\desktop` path when testing
the current desktop app. If Microsoft Edge shows `localhost refused`, that is
not the desktop app by itself; it usually means a browser tab is pointed at a
dev URL while the dev server is not running.

## Start Next Chat

For user testing and release acceptance, start the static Release EXE. This is
the same runtime shape as the packaged desktop app and does not depend on
`localhost` or the Next dev server.

1. Read the current public overview, release evidence, and handoff before
   changing code:

```bat
cd /d E:\SpeakRightDesktopRepo
type README.md
type docs\operations\RC_EVIDENCE_AUDIT.md
type docs\operations\NEXT_CHAT_HANDOFF.md
```

2. Confirm the repository and current worktree state:

```bat
cd /d E:\SpeakRightDesktopRepo
git status --short --branch
npm run desktop:preflight
```

Expected result for a fully settled release branch:

```text
## main...origin/main
Desktop preflight passed.
```

If `git status` shows local edits, preserve them unless the user explicitly asks
to discard them. Treat the current handoff as the source of truth and continue
the work rather than cleaning it for cosmetic reasons.

3. Start the already-built Release EXE:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:launch-release
```

If `desktop:launch-release` reports that `speakright.exe` is already running,
use the existing SpeakRight window or close it before launching another Release
EXE. On a normal launch, it prints the Release EXE path, the child process PID,
and a reminder that it does not start localhost or the Next dev server.

If `desktop:preflight` or `desktop:launch-release` reports that the Release EXE
is older than the static export in `out/`, run `npm run desktop:build` before
continuing. Do not validate a localhost/dev-server view in place of the packaged
Release EXE.

## Manual QA Order

- Settings: confirm language switch, Azure, ElevenLabs, AI coach, pronunciation
  fallback, data/privacy, and release status are visible. Missing-key,
  network/provider, usage, storage, diagnostics, delete, and reset states should
  remain visible inline in Chinese.
- First Launch Expectations: the app should open even when no API keys are
  configured; bundled local audio should remain usable where assets exist; if
  network is unavailable, online scoring/TTS/fallback should show actionable
  Chinese network/provider messages; if microphone permission is denied,
  missing, or busy, recording controls should show an inline Chinese recovery
  message.
- Missing local audio: the app may show `缺失或不可读` and a reinstall/Release
  EXE feedback hint. It must not replace missing local sound-unit audio with
  browser TTS, teaching-video audio, proxy rule audio, or unrelated samples.
- English: open phoneme practice, then several detail pages; play target sound,
  example word, record, replay the recording, score once, and inspect AI coach
  feedback. Check free practice, drills, diagnosis, and progress archive.
- Spanish/French/Russian: switch each language, open phoneme/sound-unit practice
  and free practice, record and score once if Azure keys are configured. Direct
  drill, diagnosis, progress, and advanced pack routes should show the shared
  experimental core-only boundary instead of English mastery surfaces.
- Scoring boundary: numeric scores must come from Azure Speech assessment using
  the selected language locale (`en-US`, `es-ES`, `fr-FR`, `ru-RU`). LLM feedback
  may explain the result, but must not invent or override score numbers.

## Current Resource Boundary

- English word-card audio is bundled in `public/audio/words/` with `blue` and
  `pink` voice variants; Youdao is only the online fallback.
- Spanish, French, and Russian word/phrase audio is bundled in
  `public/audio/language-packs/` with `blue` and `pink` voice variants.
- The latest zero-generation parity report for the current bundle showed
  Spanish `1094` existing / `0` missing, French `1482` existing / `0` missing,
  and Russian `1640` existing / `0` missing. If a future dry-run reports gaps,
  stop and request explicit approval before any ElevenLabs generation.
- Multilingual audio packs are not installed from Settings anymore.
- Local articulation/video assets live under `public/videos/language-assets/`.
- API keys are not stored in Git and are excluded from learning-data export.

## Validation Before Ending A Session

Use this release-oriented gate after UI/content work:

```bat
npm run test
npm run typecheck
npm run lint
npm run build:desktop-frontend
npm run desktop:build
npm run desktop:preflight
npm run desktop:ui-smoke
npm run desktop:launch-release
```

Use this full controlled-internal release gate before publishing internal-test
installers:

```bat
npm run validate:internal-release
```

Supporting checks:

```bat
npm run audio:parity:dry-run
npm run phonology:audio-policy:check
```

`desktop:ui-smoke` opens the Release EXE, checks Settings, English full-flow
routes, Spanish/French/Russian core routes, non-English core-only boundary
routes, phoneme detail left-column score layout, narrow and low-height windows,
and confirms that the runtime is not `localhost`. It avoids recording, Azure
live scoring, and ElevenLabs TTS generation.

Do not run ElevenLabs TTS smoke or audio generation scripts during routine
startup or manual QA. If bundled audio is missing, record the missing item first
and ask for confirmation before generating replacement audio.

## Dev Mode Is Debug-Only

Use dev mode only when actively debugging code changes:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:dev
```

Dev mode can spend time on `compiling...` after large multilingual asset or
route changes. Do not use it as the release-readiness or user-testing entrypoint.

Use the public release gate only after Windows code signing is configured:

```bat
npm run validate:public-release
```

Unsigned artifacts are acceptable for controlled internal testing only when the
release notes and installation guide keep the unsigned warning visible. Do not
publish workflow-dispatch artifacts, local Release EXE builds, or unsigned
GitHub Release assets as a stable public download. If SmartScreen, antivirus, or
enterprise policy blocks an unsigned artifact, capture the exact message for
the installation/startup template instead of bypassing managed-device policy.

## Troubleshooting

- Duplicate app process: close the existing SpeakRight window before building or
  launching another Release EXE. `desktop:preflight` and `desktop:launch-release`
  report running PIDs and do not silently kill the user's app window.
- Localhost browser tab: close the tab and start the release app with
  `npm run desktop:launch-release`. Dev mode is debug-only.
- Missing Release EXE: run `npm run desktop:run-release`.
- Stale Release EXE after frontend changes: run `npm run desktop:build`.
- Provider failures: read the Chinese inline message first; it distinguishes
  missing keys, auth mismatch, network/proxy failure, quota/rate limits,
  unavailable provider services, and unsupported runtime states where possible.
