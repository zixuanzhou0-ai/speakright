# SpeakRight Desktop RC Evidence Audit

Date: 2026-06-19

This audit records the evidence used for the Release Candidate quality gate. It
is intentionally evidence-first: if an item is not covered by a file, automated
test, Release EXE smoke, validation command, screenshot, or source note, it
should not be claimed as complete.

## Current Boundary

- Current workspace: `E:\SpeakRightDesktopRepo`.
- Release testing uses the packaged Release EXE, not localhost.
- English `en-US` is the stable baseline.
- Spanish `es-ES`, French `fr-FR`, and Russian `ru-RU` remain experimental:
  phoneme/sound-unit practice and free practice are visible; advanced drills,
  diagnosis, progress/archive, and formal mastery/evidence surfaces remain
  English-only.
- Numeric pronunciation scores come from Azure Speech Pronunciation Assessment
  using the selected language locale. LLM feedback is downstream Chinese
  coaching only.
- Routine validation must not generate ElevenLabs audio or spend TTS credits.
- Public release remains blocked until Windows code signing is complete.

## Evidence Matrix

| Requirement | Evidence source |
| --- | --- |
| The public README explains the product, screenshots, language scope, API/provider roles, privacy, limitations, and credits | `README.md`, `THIRD_PARTY_NOTICES.md`, `docs/assets/screenshots/*.png` |
| Current startup instructions point to the Release EXE and no longer depend on obsolete NEXT_RC handoff files | `docs/operations/DESKTOP_STARTUP_RUNBOOK.md`, `docs/operations/NEXT_CHAT_HANDOFF.md` |
| Signed-public-download status is honest; unsigned EXE/MSI/NSIS artifacts remain controlled-test only | `README.md`, `docs/INSTALLATION.md`, `docs/operations/DESKTOP_STARTUP_RUNBOOK.md`, `.github/ISSUE_TEMPLATE/installation_startup.md` |
| Language configuration maps public languages to Azure locales | `src/lib/language-profiles.ts`, `src/__tests__/azure-scoring-boundary.test.ts` |
| Phoneme detail, free practice, drill, and assessment flows pass `languageProfile.azureLocale` to Azure instead of hard-coding `en-US` | `src/app/phonemes/[phoneme]/phoneme-detail-page.tsx`, `src/app/sentences/page.tsx`, `src/app/assessment/page.tsx`, `src/app/assessment/passage/page.tsx`, `src/app/drill/**`, `src/hooks/use-drill-session.ts`, `src/__tests__/azure-scoring-boundary.test.ts` |
| LLM feedback is downstream of Azure result JSON and cannot fabricate numeric scores | `src/lib/llm-prompt.ts`, `src/hooks/use-llm-feedback.ts`, `src/__tests__/azure-scoring-boundary.test.ts`, `src/__tests__/llm-prompt.test.ts` |
| Smoke/test score fixtures are explicit and do not run in normal user paths | `src/app/phonemes/[phoneme]/phoneme-detail-page.tsx`, `scripts/desktop-ui-smoke.mjs`, `src/__tests__/azure-scoring-boundary.test.ts` |
| Spanish/French/Russian local dual-voice language-pack coverage is zero-generation and currently has no missing required items | `scripts/multilingual-audio-parity-report.mjs`, `src/__tests__/multilingual-audio-parity.test.ts`, `src/__tests__/static-language-audio-pack-assets.test.ts`, `npm.cmd run audio:parity:dry-run` |
| Non-English modules stay experimental and do not claim formal mastery/evidence completion | `src/lib/mastery-language-policy.ts`, `src/components/assessment/assessment-report.tsx`, `src/app/progress/page.tsx`, `src/app/drill/**`, `src/__tests__/mastery-language-policy.test.ts`, `src/__tests__/desktop-preflight-ui-smoke.test.ts` |
| Phoneme practice left column fits the `1280 x 920` launch window in the score state | `src/components/phoneme/video-player.tsx`, `src/components/scoring/score-summary.tsx`, `src/app/phonemes/[phoneme]/phoneme-detail-page.tsx`, `scripts/desktop-ui-smoke.mjs` (`phonemeLeftColumn=ok`) |
| Public repository has governance, support routing, no-secret scanning, and asset-boundary documentation | `LICENSE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SUPPORT.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, `.env.example`, `.github/ISSUE_TEMPLATE/*.md`, `.github/pull_request_template.md`, `src/__tests__/open-source-readiness.test.ts` |

## Required RC Commands

Run from `E:\SpeakRightDesktopRepo`:

```bat
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:desktop-frontend
npm.cmd run desktop:build
npm.cmd run desktop:preflight
npm.cmd run desktop:ui-smoke
npm.cmd run audio:parity:dry-run
npm.cmd run phonology:audio-policy:check
npm.cmd run desktop:launch-release
```

`desktop:ui-smoke` must launch the Release EXE and confirm
`releaseServedFromDevServer=false`. `audio:parity:dry-run` and
`phonology:audio-policy:check` must not call ElevenLabs generation.

## Latest Local Command Results

Latest local full gate for this documentation pass:

```text
git status --short --branch
  ## main...origin/main with the release-documentation, screenshot,
  scoring-boundary-test, and stale-doc cleanup edits present before final commit.

npm.cmd run test -- --run src/__tests__/azure-scoring-boundary.test.ts
  1 file / 5 tests passed.

npm.cmd run test -- --run src/__tests__/open-source-readiness.test.ts src/__tests__/azure-scoring-boundary.test.ts
  2 files / 16 tests passed.

npm.cmd run test
  136 files / 797 tests passed.

npm.cmd run typecheck
  passed.

npm.cmd run lint
  passed; Biome checked 410 files and reported only the tracked
  non-english-ipa-audit-input.json size info.

npm.cmd run build:desktop-frontend
  passed; 197 static pages generated.

npm.cmd run desktop:build
  passed; generated 197 static pages, compiled the Tauri release app in 6m 31s,
  built src-tauri\target\release\speakright.exe, and generated fresh MSI/NSIS
  bundles.

npm.cmd run desktop:preflight
  passed; Release EXE exists, is not older than out/, no running speakright.exe
  process was detected, and release launch remains static.

npm.cmd run desktop:ui-smoke
  passed from the Release EXE; summary included settings=ok,
  phonemeLeftColumn=ok, hiddenRuleRoutes=ok, phonemePracticeSidebar=ok,
  scoringTileAudioPolicy=ok, freePracticeSmoke=ok, assessmentSmoke=ok,
  narrowViewport=ok, lowHeightViewport=ok, and releaseServedFromDevServer=false.

npm.cmd run audio:parity:dry-run
  passed; Spanish 1094 existing / 0 missing, French 1482 existing / 0 missing,
  Russian 1640 existing / 0 missing, total missing 0, estimated characters 0.
  No ElevenLabs calls were made.

npm.cmd run phonology:audio-policy:check
  passed; assessment audio policy tables are up to date.

node scripts/capture-release-screenshots.mjs
  passed; refreshed all README screenshots from the Release EXE with a temporary
  WebView2 profile.

npm.cmd run desktop:launch-release
  passed; command printed the Release EXE path, confirmed it does not start
  localhost or the Next dev server, and launched PID 14888.
```

## Screenshot Evidence

Release EXE screenshots are tracked under `docs/assets/screenshots/`:

- `settings.png`
- `english-phoneme-score.png`
- `free-practice.png`
- `english-assessment.png`
- `spanish-phoneme.png`
- `french-phoneme.png`
- `russian-phoneme.png`

Screenshots must not expose API keys, private recordings, full diagnostics
bundles, or user-specific local paths.

## Limits

- Windows artifacts are unsigned; controlled internal testing may continue only
  with the unsigned warning visible.
- Spanish, French, and Russian are experimental and must not be described as
  formally mastered.
- The RC gate does not generate new TTS audio.
- Azure live-provider behavior still depends on the user's Azure Speech account,
  region, locale support, network, microphone quality, and quota.
