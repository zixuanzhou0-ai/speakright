# Browser Edition v1.1.0 release notes

Status: public and anonymously verified on 2026-08-24.

Public page:
[`v1.1.0` Browser Stable](https://github.com/zixuanzhou0-ai/speakright/releases/tag/v1.1.0).
At the 2026-08-24 verification, Release ID `375494273` was non-draft,
non-prerelease, and `/releases/latest` resolved to it. Its annotated tag peeled
to commit
`61c506af5c1f0b9b8397c74f69470c0da1e9f382`; the
[post-publication record](../validation/V1.1.0_RELEASE_VERIFICATION.md) captures
the observed workflow, 20-asset inventory, checksums, SBOMs, and anonymous
download results.

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
- Made reference-only Rachel's English videos unavailable from the first
  Browser render, return a real 404 for absent static media instead of the HTML
  app shell, and show the official-source fallback without a transient player.

## Windows Desktop

Windows Desktop remains a separate Tauri app in the repository root / `src` /
`src-tauri` in this public repo, with the latest settled desktop source also
tracked in `<repository-root>`. Windows installer/Release EXE
validation, unsigned artifact warnings, and Tauri permissions belong to the
desktop release flow.

The separate
[`v1.1.0-desktop-preview.1` track](https://github.com/zixuanzhou0-ai/speakright/releases/tag/v1.1.0-desktop-preview.1)
is a public, verified, unsigned pre-release and must not be called Desktop
Stable. Release ID `375511263` contains 16 contracted assets. Its public binary
contract includes only the bare Release EXE and the NSIS setup bound to
install/start/exit/uninstall round-trip evidence; no MSI is published. A locally
generated MSI remains metadata-smoke input, not a public preview asset.

## Validation

Current source-bound Browser Edition gates:

```text
npm run lint:browser
npm run typecheck:browser
npm run test:browser
npm run build:browser
npm run browser:smoke:static
npm run validate:browser:e2e
npm run e2e:browser:production-fixture-guard
npm run docs:check-links
```

The release-commit main-push Browser E2E run contained 47 tests: 46 passed, one
intentional production-fixture-guard skip, zero flaky, and zero failed; its
unit-test phase passed 146 files and 788 tests. The production fixture guard
passed against the publishable static build. Browser release workflow
[`32696723273`](https://github.com/zixuanzhou0-ai/speakright/actions/runs/32696723273)
completed successfully; build job `97340113767` and publish job `97343927873`
both succeeded. The post-publication record separately verifies the public
Release object and downloaded bytes.

The [June validation log](../archive/2026-06-browser-edition/VALIDATION_LOG.md)
is historical. Automated fixtures and synthetic/provider checks must not be
described as real learner microphone testing, provider-wide reliability, or
learning-outcome evidence. Routine release evidence makes no paid TTS or live
Azure scoring call.

## Known Limitations

- Browser Edition must be served from localhost or HTTPS for reliable microphone
  access. `file://` is not supported.
- Spanish, French, and Russian are experimental. They expose sound-unit and
  free-practice flows but should not be marketed as having the same formal
  mastery evidence as English unless separately validated.
- Every bundled media family must pass the machine-readable rights registry and
  SHA-256 gate. Reference-only files remain outside the bundle and use explicit
  fallback UI; unmatched distributable files are release failures.
- Versioned screenshots and example-score fixtures demonstrate deterministic UI
  states only. They do not prove live Azure availability, learner microphone
  usability, or real-user outcomes for any locale.

## Credits

See [Third-Party Notices](THIRD_PARTY_NOTICES.md).
