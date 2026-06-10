# SpeakRight Desktop

SpeakRight Desktop is a Tauri desktop pronunciation-training app for Chinese
learners. American English (`en-US`) is the stable baseline. Spanish (`es-ES`),
French (`fr-FR`), and Russian (`ru-RU`) are experimental modules. Japanese is
not included in this release track.

## Current Product Boundary

- Desktop-only release track. Do not mix this repository with older browser-app workspaces.
- The installed app loads the static Tauri bundle, not a localhost dev server.
- API keys are stored through the desktop secure/local credential layer where
  supported; they are never committed and are excluded from learning-data
  exports.
- Spanish, French, and Russian word/phrase audio is bundled under
  `public/audio/language-packs/`; users do not install these packs separately.
- Local articulation assets live under `public/videos/language-assets/`.

## Development

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:dev
```

The dev build uses the Tauri `devUrl` configured in `src-tauri/tauri.conf.json`.
Release builds must use the static export in `out/`.

For manual QA and user testing, launch the Release EXE instead of dev mode:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:launch-release
```

If the Release EXE is missing or stale:

```bat
npm run desktop:run-release
```

For the daily desktop startup checklist, see
`docs/operations/DESKTOP_STARTUP_RUNBOOK.md`.

## Validation

```bat
npm run test
npm run typecheck
npm run lint
npm run build:desktop-frontend
npm run desktop:live-validation
npm run validate:internal-release
```

Use `npm run desktop:build` when you need fresh Windows artifacts. Use
`npm run validate:public-release` only after Windows code signing is configured.

The live validation command checks bundled audio/video assets and a high-coverage
Azure pronunciation-assessment sample. It queries ElevenLabs usage only; it does
not generate new audio unless an explicit smoke flag is set outside the normal
release checklist.

## Release Notes

- The current Windows artifacts are for controlled testing unless code signing
  is complete.
- Last controlled-test verification: 2026-06-11, from commit `94be1d4`
  (`chore: tighten desktop release validation`).
- Verified bundled assets: English word audio `1464/1464`, Spanish language-pack
  audio `398/398`, French language-pack audio `509/509`, Russian language-pack
  audio `407/407`, local videos `210/210`.
- Verified Azure live sample: `220/220` pronunciation-assessment calls passed.
- ElevenLabs was usage-checked only during validation; estimated TTS characters
  used were `0`.
- Non-English pronunciation scoring remains experimental; `evidenceMastery`
  stays disabled for `es-ES`, `fr-FR`, and `ru-RU` until provider probes and
  language-specific evidence gates are finished.
