# Browser Edition Completion Audit

Date: 2026-06-23

This audit maps the Browser Edition goal to current proof. It is intentionally
stricter than a progress summary: an item is complete only when current evidence
proves it.

## Evidence Sources

- Goal text: `[personal attachment path removed]`
- Browser Edition plan: `docs/browser-edition/README.md`
- Architecture and release checklists: `docs/browser-edition/ARCHITECTURE_AND_SEPARATION.md`, `docs/browser-edition/VALIDATION_AND_RELEASE.md`
- Local validation log: `docs/browser-edition/VALIDATION_LOG.md`
- Browser app source: `apps/browser`
- Desktop source of truth inspected read-only: `<repository-root>` at `aaa5db2 Fix desktop smoke release channel`
- Current GitHub merge evidence: PR #1 merged to `origin/main` as `8669834c Merge pull request #1 from zixuanzhou0-ai/codex/browser-edition-release-pr`; follow-up scoring validation pushed as `3e900c3 Validate browser Azure scoring release gate`

## Requirement Audit

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Browser Edition is separated from Windows Desktop. | Browser app is under `apps/browser`; local isolation scan found no Tauri imports, desktop secure-store dependency, desktop port dependency, or desktop release-script dependency in Browser Edition source. | Proven locally |
| Windows Desktop and Browser Edition are clear to GitHub users. | Public README first screen shows two choices. Current desktop code remains in repository root / `src` / `src-tauri`; `apps/browser` is the cross-platform Browser Edition. | Proven as clear documentation; strict `apps/desktop` folder migration is not implemented |
| Browser Edition is not SaaS and uses BYOK. | Browser docs and Settings copy describe local/browser key storage; API-key persistence is session-first with explicit local persistence. | Proven locally |
| Core routes build and open from a browser/static server. | Final `npm.cmd run validate:browser` passed: Browser lint, TypeScript, 113 Vitest files / 639 tests, Next production build with 197 routes, and static smoke for 9 routes plus 2 assets. A clean follow-up static smoke also passed on `http://127.0.0.1:4174` after the known already-occupied 4173 cleanup noise. | Proven locally |
| User-facing numeric pronunciation scores come from Azure Speech, not LLM. | Browser adapter uses Microsoft Speech SDK pronunciation assessment; tests cover scoring boundary and smoke-only fixture guards; docs state LLM is feedback-only. Current SDK use calls `PronunciationAssessmentConfig.applyTo(recognizer)` and sets `enableProsodyAssessment` from `isSentence(referenceText)`, matching the installed 1.50.0 source/type declarations. Low-cost synthetic-audio live checks also returned Azure REST scores for `es-ES`, `fr-FR`, and `ru-RU`. | Proven by source/tests and live Azure service checks |
| Browser Azure implementation follows official SDK path. | Context7/Microsoft Learn and Azure Speech SDK sample checks confirmed `PronunciationAssessmentConfig.applyTo(recognizer)`, `PronunciationAssessmentResult.fromResult`, `SpeechServiceResponse_JsonResult`, `AudioConfig.fromWavFileInput`, and microphone input are official JavaScript/browser SDK surfaces. | Proven by official docs/source check |
| English, Spanish, French, and Russian use the right Azure locales. | Source/tests route language-specific practice through the active language profile and locale; multilingual static smoke passes. The ignored live log records `en-US`, `es-ES`, `fr-FR`, and `ru-RU` with language-specific Azure locale calls. | Proven by source/tests and live log evidence |
| Screenshots are current and separated from desktop screenshots. | Browser screenshots are stored under `docs/assets/screenshots/browser/`; desktop screenshots stay under `docs/assets/screenshots/`. | Proven locally |
| README/docs/release notes explain Desktop vs Browser Edition. | README, `docs/WEB.md`, and `docs/browser-edition/*` document the split, commands, limitations, providers, and credits. Current follow-up `npm.cmd run docs:check-links` passed, and root/browser lint plus Browser typecheck passed again in the goal continuation rerun. | Proven locally |
| Stale docs/assets are cleaned or ignored after reference checks. | Public docs link check passes. Local agent/runtime artifacts and old root screenshots are ignored and not part of the public tracked docs surface. | Partially proven; continue reviewing before final release |
| Secret handling is safe for public release. | Text secret scan over tracked Browser Edition source, public docs, Browser package metadata, and `scripts/browser-azure-live-log.mjs` found no Azure/OpenAI/ElevenLabs/Gemini-style key literals. The current staged secret scan also passed for the 13 planned follow-up files. Live-log helper rejects key-shaped input. | Proven locally |
| Browser Azure live scoring is verified for `en-US`, `es-ES`, `fr-FR`, `ru-RU`. | `.runlogs/browser-azure-live-check.md` records `en-US` as pass from the current Browser Edition page (`/sentences`, total 100, word `hello` 100). It also records low-cost synthetic ElevenLabs `eleven_flash_v2_5` samples scored by Azure REST for `es-ES` (`casa`, 89), `fr-FR` (`si`, 10), and `ru-RU` (`да`, 100). The synthetic checks consumed about 24 short text characters across probes/reruns and did not log keys, recordings, raw payloads, or account IDs. | Proven for Azure scoring chain; human microphone parity remains a separate manual QA note |
| Final commit and push to GitHub `main`. | Browser Edition PR #1 was merged and pushed to GitHub `main`; this follow-up scoring validation was also committed and pushed as `3e900c3 Validate browser Azure scoring release gate`, and remote `refs/heads/main` was verified immediately after that push. | Proven |

## Remaining Release Notes And Separate Follow-Ups

1. Browser Azure live checks:
   - `en-US` human/browser-page scoring is recorded in the ignored live log.
   - `es-ES`, `fr-FR`, and `ru-RU` are recorded with low-cost synthetic ElevenLabs audio passed through real Azure REST scoring.
   - These checks prove the provider/key/locale/scoring path. They do not replace a separate human microphone UX pass for release notes that explicitly claim microphone parity.

2. Repository shape decision:
   - Current public repository is clear but still uses repository root / `src` / `src-tauri` for Windows Desktop.
   - A strict physical `apps/desktop` migration remains a separate high-risk restructuring task and should not be claimed complete until implemented and validated.

## Completion Decision

The Browser Edition scoring-validation release gate is complete for the current Browser Edition scope. The app is locally validated, merged to GitHub `main`, and the follow-up `3e900c3 Validate browser Azure scoring release gate` is pushed to `origin/main`. The ignored live log covers `en-US` from the current Browser Edition page and `es-ES`/`fr-FR`/`ru-RU` through low-cost ElevenLabs synthetic audio scored by real Azure REST calls. A strict physical `apps/desktop` migration remains documented as a separate high-risk restructuring task rather than claimed in this Browser Edition release.
