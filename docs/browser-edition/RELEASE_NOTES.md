# Browser Edition v1.1.0 release notes

Status: release candidate; not yet published.

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
  `docs/assets/screenshots/release/v1.1.0/browser/`, kept separate from desktop
  screenshots and marked as deterministic example data where applicable.
- Added a markdown relative-link checker for public README/docs assets.
- Added an ignored live Azure validation log helper so final microphone checks
  can record sanitized locale/route/pass-fail evidence without storing provider
  keys, recordings, or raw Azure payloads.
- Added ElevenLabs aligned playback and honest sentence-level playback feedback
  for Hermes/xAI and Vertex AI when word timing is unavailable.
- Added guided-repeat intensity selection, phase-safe controls, and an exit
  summary without turning practice completion into a mastery claim.
- Added stale-request/session guards for free practice and separated independent
  diagnosis samples from prompted comparison samples.
- Added the cloud-processing disclosure, local-data controls, release metadata,
  and the public privacy/license/security links used by v1.1.0.

## Windows Desktop

Windows Desktop remains a separate Tauri app in the repository root / `src` /
`src-tauri` in this public repo, with the latest settled desktop source also
tracked in `<repository-root>`. Windows installer/Release EXE
validation, unsigned artifact warnings, and Tauri permissions belong to the
desktop release flow.

The separate `v1.1.0-desktop-preview.1` track is unsigned and must not be called
Desktop Stable. If its gates pass, it publishes only the bare Release EXE and
the NSIS setup bound to install/start/exit/uninstall round-trip evidence. A
locally generated MSI is metadata-smoke input, not a public preview asset.

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

The [June validation log](../archive/2026-06-browser-edition/VALIDATION_LOG.md)
is historical. Current v1.1.0 results belong in the versioned release-candidate
record and CI run. Automated fixtures and synthetic/provider checks must not be
described as real learner microphone testing or learning-outcome evidence.

## Known Limitations

- Browser Edition must be served from localhost or HTTPS for reliable microphone
  access. `file://` is not supported.
- Spanish, French, and Russian are experimental. They expose sound-unit and
  free-practice flows but should not be marketed as having the same formal
  mastery evidence as English unless separately validated.
- Every bundled media family must pass the machine-readable rights registry and
  SHA-256 gate. Reference-only or unmatched files are release failures.
- Browser screenshots are captured, and Azure provider/locale scoring evidence
  is recorded for all supported language locales. Separate release notes should
  still be honest when a check used synthetic audio rather than a human
  microphone sample.

## Credits

See [Third-Party Notices](THIRD_PARTY_NOTICES.md).
