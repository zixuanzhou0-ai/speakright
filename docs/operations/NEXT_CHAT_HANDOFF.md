# Next Chat Handoff

Date: 2026-06-19

This file exists so the next Codex chat can continue without relying on the long
conversation history.

## Current Workspace

```text
E:\SpeakRightDesktopRepo
```

Use this repository for SpeakRight Desktop. Do not switch to the older
`E:\SpeakRight` browser/dev workspace unless the user explicitly asks for it.

## Current Product Boundary

- User testing should start from the Release EXE, not a browser tab or Next dev
  server.
- Release EXE path:

```text
E:\SpeakRightDesktopRepo\src-tauri\target\release\speakright.exe
```

- The app is a desktop pronunciation trainer for Chinese learners.
- English `en-US` is the stable baseline.
- Spanish `es-ES`, French `fr-FR`, and Russian `ru-RU` remain experimental.
  Their public navigation is core-only: phoneme/sound-unit practice and free
  practice are visible; drill, diagnosis, progress/archive, and formal
  mastery/evidence surfaces stay English-only.
- Numeric pronunciation scores must come from Azure Speech Pronunciation
  Assessment using the selected language locale. LLM feedback is downstream
  Chinese coaching only and must not invent or override score numbers.
- Do not generate ElevenLabs audio or spend TTS credits unless the user
  explicitly confirms it.
- Windows artifacts are still unsigned; this remains the public-release blocker.
- The current Release Candidate evidence matrix is
  `docs/operations/RC_EVIDENCE_AUDIT.md`.

## Current Git Checkpoints

- `057c7e7 Increase default desktop window height` raised the default desktop
  window height to `920`.
- `39709fe Fit phoneme practice left column at launch height` preserved the
  accepted compact phoneme-detail left-column layout.
- A final release-documentation commit is expected after docs, screenshots,
  Release EXE gates, and GitHub release metadata are updated.

## Latest Local Changes To Preserve

- Added `src/__tests__/azure-scoring-boundary.test.ts` to lock the real scoring
  boundary:
  - all public language profiles map to `en-US`, `es-ES`, `fr-FR`, and `ru-RU`;
  - user-facing recording flows pass `languageProfile.azureLocale` to Azure;
  - LLM feedback remains downstream of Azure results;
  - smoke-only score fixtures stay behind explicit query parameters.
- Rewrote `README.md` as an open-source project homepage with language support,
  real scoring boundary, provider/API explanation, installation, validation,
  privacy, limitations, screenshots, and credits.
- Rewrote `THIRD_PARTY_NOTICES.md` with clearer media/provider attribution and
  redistribution boundaries.
- Removed the obsolete audio/settings RC operations handoff files.

## Current Verification Notes

- `npm.cmd run test -- --run src/__tests__/azure-scoring-boundary.test.ts`:
  passed, `1` file / `5` tests.
- `npm.cmd run audio:parity:dry-run`: passed with no ElevenLabs calls:
  Spanish `1094` existing / `0` missing, French `1482` existing / `0` missing,
  Russian `1640` existing / `0` missing.
- Full Release EXE gate still needs to be rerun after screenshots and final docs
  updates:

```bat
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:desktop-frontend
npm.cmd run desktop:build
npm.cmd run desktop:preflight
npm.cmd run desktop:ui-smoke
npm.cmd run phonology:audio-policy:check
npm.cmd run desktop:launch-release
```

## Next Steps

1. Capture Release EXE screenshots into `docs/assets/screenshots/`:
   `settings.png`, `english-phoneme-score.png`, `free-practice.png`,
   `english-assessment.png`, `spanish-phoneme.png`, `french-phoneme.png`, and
   `russian-phoneme.png`.
2. Update `docs/operations/RC_EVIDENCE_AUDIT.md` with the current date,
   real-scoring boundary evidence, fresh parity count, screenshot evidence, and
   final command results.
3. Update open-source readiness tests so they lock current facts instead of old
   audio-gap or handoff-progress text.
4. Run the full Release EXE gate.
5. Update GitHub release notes/draft with the same unsigned controlled-test and
   experimental-language boundary as the README.
6. Commit with `Prepare open source release documentation` and push `main`.

## Guardrails

- Do not use localhost/dev server as desktop acceptance.
- Do not discard user edits or unrelated local changes.
- Do not generate ElevenLabs audio without explicit approval.
- Do not claim Spanish, French, or Russian formal mastery/evidence completion.
- Do not publish unsigned Windows artifacts as stable public downloads.
- Do not expose API keys, private recordings, full diagnostics bundles, or local
  user paths in README, screenshots, issues, or release notes.
