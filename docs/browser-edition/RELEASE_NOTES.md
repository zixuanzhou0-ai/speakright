# Browser Edition Release Notes

## Browser Edition

- Added `apps/browser` as the cross-platform Browser Edition app.
- Removed Browser Edition runtime dependency on Tauri APIs, Windows installer
  scripts, desktop secure store, and the desktop `localhost:3002` runtime.
- Added browser Speech SDK pronunciation assessment adapter under
  `src/platform/speech-assessment.ts`.
- Browser recording uses MediaRecorder, converts audio to 16 kHz mono WAV, and
  sends it to Azure Speech with the active language locale through the browser Speech SDK.
- Added session-first API key storage. Provider keys persist to local browser
  storage only when the user explicitly enables that setting.
- Added static export support and local static server script.
- Added Browser Edition route smoke script covering settings, English sound
  practice, Spanish/French/Russian sound-unit pages, free practice, assessment,
  and drill entry.
- Fixed direct multilingual sound-unit URLs so `/phonemes/es-*`,
  `/phonemes/fr-*`, and `/phonemes/ru-*` resolve their route language before
  local browser language preferences.
- Added Browser Edition screenshots under
  `docs/assets/screenshots/browser/`, kept separate from desktop screenshots.
- Added a markdown relative-link checker for public README/docs assets.
- Added an ignored live Azure validation log helper so final microphone checks
  can record sanitized locale/route/pass-fail evidence without storing provider
  keys, recordings, or raw Azure payloads.

## Windows Desktop

Windows Desktop remains a separate Tauri app in the repository root / `src` /
`src-tauri` in this public repo, with the latest settled desktop source also
tracked in `<repository-root>`. Windows installer/Release EXE
validation, unsigned artifact warnings, and Tauri permissions belong to the
desktop release flow.

Current public Windows artifacts should not be described as signed. They remain
controlled-test artifacts until code signing and public release gates are
complete.

## Validation

Latest local Browser Edition checks in this worktree:

```text
npm run lint:browser
npm run typecheck:browser
npm run test:browser
npm run build:browser
npm run browser:smoke:static
npm run docs:check-links
npm run browser:azure-live-log
```

See [Validation Log](../archive/2026-06-browser-edition/VALIDATION_LOG.md) for the current local run evidence.

Real Azure scoring evidence is recorded in the private ignored validation log:
`en-US` from the current Browser Edition page, plus `es-ES`, `fr-FR`, and
`ru-RU` from low-cost ElevenLabs `eleven_flash_v2_5` synthetic audio scored by
real Azure REST calls. The synthetic checks prove the provider, locale, and
scoring path; they must not be described as a replacement for separate human
microphone UX parity checks.

## Known Limitations

- Browser Edition must be served from localhost or HTTPS for reliable microphone
  access. `file://` is not supported.
- Spanish, French, and Russian are experimental. They expose sound-unit and
  free-practice flows but should not be marketed as having the same formal
  mastery evidence as English unless separately validated.
- Some teaching media has licensing/source-ledger risk. Unclear assets should be
  removed, linked externally, or represented as unavailable before public
  release.
- Browser screenshots are captured, and Azure provider/locale scoring evidence
  is recorded for all supported language locales. Separate release notes should
  still be honest when a check used synthetic audio rather than a human
  microphone sample.

## Credits

See [Third-Party Notices](THIRD_PARTY_NOTICES.md).
