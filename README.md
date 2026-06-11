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
npm run desktop:preflight
npm run desktop:launch-release
```

If the Release EXE is missing or stale:

```bat
npm run desktop:run-release
```

For the daily desktop startup checklist, see
`docs/operations/DESKTOP_STARTUP_RUNBOOK.md`.

For the next manual-testing pass on 2026-06-12, start with the runbook's
`Start Tomorrow: 2026-06-12` checklist. The first pass should use the Release EXE
and cover Settings, English, Spanish, French, Russian, drill, free practice, and
diagnosis before adding new work.

## Validation

```bat
npm run test
npm run typecheck
npm run lint
npm run build:desktop-frontend
npm run desktop:preflight
npm run desktop:ui-smoke
npm run desktop:live-validation
npm run audio:parity:dry-run
npm run validate:internal-release
```

Use `npm run desktop:build` when you need fresh Windows artifacts. Use
`npm run validate:public-release` only after Windows code signing is configured.

The live validation command checks bundled audio/video assets and a high-coverage
Azure pronunciation-assessment sample. It queries ElevenLabs usage only; it does
not generate new audio unless an explicit smoke flag is set outside the normal
release checklist.

`audio:parity:dry-run` checks the Spanish, French, and Russian learning-density
contract without calling ElevenLabs. It writes
`src-tauri/target/audio-parity/gap-report.json` and verifies that every required
single-voice language-pack audio item is present.

`desktop:preflight` checks the active workspace, release executable, and running
`speakright.exe` process before release-style testing. It never closes the app
for you; close SpeakRight manually before building. `desktop:ui-smoke` launches
the Release EXE, opens Settings, English, Spanish, French, Russian, drill, free
practice, and diagnosis routes, and confirms the runtime is not served from
`localhost`.

GitHub Actions are split by change type: source, public asset, script,
`src-tauri`, or package changes still run the full Windows desktop build, while
README/docs-only changes run the lightweight Docs Check workflow.

## Release Notes

- The current Windows artifacts are for controlled testing unless code signing
  is complete.
- Last controlled-test verification: 2026-06-11, after the preflight/UI-smoke
  hardening pass.
- Previous release-validation baseline: `94be1d4`
  (`chore: tighten desktop release validation`).
- Latest release-hardening pass added non-English low-evidence diagnosis gates,
  `desktop:preflight`, `desktop:ui-smoke`, and docs-only CI path filtering; the
  final local `validate:desktop` pass completed successfully.
- Verified bundled assets before the audio-density expansion: English word audio
  `1464/1464`, Spanish language-pack audio `398/398`, French language-pack
  audio `509/509`, Russian language-pack audio `407/407`, local videos `210/210`.
- Multilingual audio-density expansion target: 24 practice items per Spanish,
  French, and Russian sound unit. The latest dry-run after generation reports
  Spanish `440/440`, French `545/545`, Russian `460/460`, total missing `0`.
- Verified Azure live sample: `220/220` pronunciation-assessment calls passed.
- ElevenLabs was usage-checked only during validation; estimated TTS characters
  used were `0`.
- Public release gate still fails only because EXE/MSI/NSIS artifacts are
  unsigned.
- Non-English pronunciation scoring remains experimental; `evidenceMastery`
  stays disabled for `es-ES`, `fr-FR`, and `ru-RU` until provider probes and
  language-specific evidence gates are finished.
