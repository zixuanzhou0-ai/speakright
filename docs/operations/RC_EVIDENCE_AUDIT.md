# SpeakRight Desktop RC Evidence Audit

Date: 2026-06-14

This audit records the evidence used for the Release Candidate quality gate.
It is intentionally evidence-first: if an item is not covered by a file,
automated test, release-window smoke, or validation command, it should not be
claimed as complete.

## Evidence Matrix

| RC requirement | Evidence source |
| --- | --- |
| Current workspace is `E:\SpeakRightDesktopRepo`; release testing uses the Release EXE, not localhost | `README.md`, `docs/INSTALLATION.md`, `docs/operations/DESKTOP_STARTUP_RUNBOOK.md`, `scripts/desktop-preflight.mjs`, `scripts/desktop-ui-smoke.mjs`, `npm.cmd run desktop:preflight`, `npm.cmd run desktop:ui-smoke` |
| English is the stable baseline; Spanish, French, and Russian remain experimental | `README.md`, `docs/INSTALLATION.md`, `docs/operations/NEXT_CHAT_HANDOFF.md`, `src/app/drill/page.tsx`, `src/lib/mastery-language-policy.ts`, `src/__tests__/mastery-language-policy.test.ts` |
| Non-English practice can score and provide feedback but cannot load English advanced training packs, write formal mastery/evidenceMastery, display diagnosis issues as formal mastery stages, or show/read English progress archives | `src/lib/mastery-language-policy.ts`, `src/components/assessment/assessment-report.tsx`, `src/app/sentences/page.tsx`, `src/app/progress/page.tsx`, `src/app/drill/pack/[packId]/pack-runner-client.tsx`, `src/app/drill/perception/page.tsx`, `src/app/drill/prosody/page.tsx`, `src/app/drill/scenarios/page.tsx`, `src/app/drill/spontaneous/page.tsx`, `src/__tests__/assessment-report.test.tsx`, `src/__tests__/drill-pack-runner.test.tsx`, `src/__tests__/progress-page.test.tsx`, `src/__tests__/mastery-language-policy.test.ts`, `src/__tests__/mastery-profile.test.ts`; direct English pack-runner routes show `pack-runner-experimental-blocker` for Spanish/French/Russian instead of loading English pack content; direct `/progress` access shows `progress-experimental-blocker` for Spanish/French/Russian instead of English mastery archive metrics, and the blocker path does not call the formal mastery profile or benchmark archive loaders; diagnosis issue cards keep formal mastery badges for English but show `experimental 练习观察` plus the experimental blocker for Spanish/French/Russian instead of `阶段` / `下一层` / `阶段分` badges |
| Words, phrases, sentences, IPA, and examples are centered, wrap in full, avoid ellipsis/truncation, and use accurate playback labels | `src/lib/practice-text-presentation.ts`, `src/components/phoneme/phoneme-study-card.tsx`, `src/components/layout/sidebar-phoneme-list.tsx`, `src/components/audio/read-along-text.tsx`, `src/components/sentences/sentence-input-card.tsx`, `src/components/scoring/word-highlight.tsx`, `src/components/settings/language-config-card.tsx`, `src/components/settings/usage-monitor.tsx`, `src/__tests__/practice-text-presentation.test.ts`, `src/__tests__/phoneme-study-card.test.tsx`, `src/__tests__/sidebar-phoneme-list.test.tsx`, `src/__tests__/desktop-preflight-ui-smoke.test.ts`, `scripts/desktop-ui-smoke.mjs`; non-English detail A/B playback buttons label rule sentences as rule/sentence playback instead of saying word playback, while long Cyrillic rule text remains centered, wrap-ready, and untruncated |
| Non-English rule units without local target audio do not show clickable speaker buttons | `src/lib/language-source-alignment.ts`, `src/components/phoneme/phoneme-study-card.tsx`, `src/components/drill/drill-phoneme-lesson.tsx`, `src/components/phoneme/phoneme-card.tsx`, `src/__tests__/phoneme-study-card.test.tsx`, `src/__tests__/language-source-alignment.test.ts`, `scripts/desktop-ui-smoke.mjs` |
| Proxy or generic videos are not presented as exact teaching videos | `src/lib/language-source-alignment.ts`, `src/lib/language-teaching-videos.ts`, `src/components/phoneme/video-player.tsx`, `src/components/drill/drill-phoneme-lesson.tsx`, `src/__tests__/language-teaching-videos.test.ts`, `src/__tests__/video-player.test.tsx`, `scripts/desktop-ui-smoke.mjs` |
| Spanish/French/Russian local dual-voice audio has zero missing required items and dry-run makes no ElevenLabs calls | `scripts/multilingual-audio-parity-report.mjs`, `src/__tests__/multilingual-audio-parity.test.ts`, `src/__tests__/static-language-audio-pack-assets.test.ts`, `npm.cmd run audio:parity:dry-run` |
| Local A/B word audio, IPA chart normal/slow word audio, and bundled language-pack read-along playback are louder and closer to video playback without regenerating TTS or allowing obvious clipping | `src/hooks/use-word-pronunciation.ts`, `src/hooks/use-audio-player.ts`, `src/hooks/use-tts-aligned.ts`, `src/lib/audio-normalization.ts`, `src/lib/audio-playback-policy.ts`, `src/components/phoneme/phoneme-card.tsx`, `src/components/phoneme/phoneme-study-card.tsx`, `scripts/audio-loudness-audit.mjs`, `src/__tests__/audio-normalization.test.ts`, `src/__tests__/use-word-pronunciation.test.tsx`, `src/__tests__/use-audio-player.test.tsx`, `src/__tests__/use-tts-aligned.test.tsx`, `src/__tests__/phoneme-card.test.tsx`, `src/__tests__/phoneme-study-card.test.tsx`, `npm.cmd run audio:loudness:dry-run`; the cached normalization helper, active playback hook, and read-along local-pack path preserve language-pack fallback gain before peak-safe limiting where applicable, very quiet decoded local word clips can reach up to `12x` peak-safe gain when peaks permit it, IPA chart normal/slow word playback uses a shared boost, bundled read-along replay keeps its gain, and representative A/B plus chart-word samples are compared against teaching-video loudness without ElevenLabs calls |
| Standard-demo TTS, local detail/free-practice word audio gaps, and online dictionary fallback failures show actionable Chinese messages without generating audio during validation | `src/lib/api-client.ts`, `src/hooks/use-tts.ts`, `src/hooks/use-tts-aligned.ts`, `src/hooks/use-word-pronunciation.ts`, `src/components/phoneme/phoneme-study-card.tsx`, `src/components/sentences/sentence-input-card.tsx`, `src/components/settings/elevenlabs-config-card.tsx`, `src/components/settings/usage-monitor.tsx`, `src/app/drill/prosody/page.tsx`, `src/app/drill/scenarios/page.tsx`, `src/app/drill/contrast/page.tsx`, `src/app/drill/perception/page.tsx`, `src/app/drill/pack/[packId]/pack-runner-client.tsx`, `src/__tests__/api-client-audio.test.ts`, `src/__tests__/desktop-preflight-ui-smoke.test.ts`, `src/__tests__/phoneme-study-card.test.tsx`, `src/__tests__/settings-key-hydration.test.tsx`, `src/__tests__/use-tts-aligned.test.tsx`, `src/__tests__/use-word-pronunciation.test.tsx`; ElevenLabs connection tests, usage checks, voice queries, TTS, aligned TTS, non-English local-pack gaps, and English online dictionary fallback map invalid keys, unavailable voice/model, network/proxy failures, timeout, quota/rate-limit, service failure, empty/too-long text, missing local detail/free-practice word audio, and missing dictionary entries to Chinese messages; detail-page, free-practice word speakers, prosody demos, scenario demos, contrast word demos, perception playback, and pack-runner reference/perception playback render the failure inline instead of silently clearing the loading state, while bundled local word and language-pack audio remain the first-choice path and validation still makes no TTS generation calls |
| Settings connection-test failures and first-run usage empty states preserve actionable Chinese reasons and avoid raw English exceptions or nowrap overflow | `src/components/settings/azure-config-card.tsx`, `src/components/settings/elevenlabs-config-card.tsx`, `src/components/settings/llm-config-card.tsx`, `src/components/settings/pronunciation-config-card.tsx`, `src/components/settings/usage-monitor.tsx`, `src/components/settings/connection-status.tsx`, `src/components/settings/user-facing-error.ts`, `src/__tests__/desktop-preflight-ui-smoke.test.ts`, `src/__tests__/settings-connection-errors.test.tsx`, `src/__tests__/settings-key-hydration.test.tsx`; Azure, ElevenLabs, AI coach, and Youdao test buttons keep Chinese provider/client messages when available, replace raw English fetch errors with Chinese network/proxy guidance, explain that bundled local practice audio is unaffected by online dictionary test failure, the ElevenLabs usage card explains on first run that sentence/phrase standard demos need a key while local word and built-in language-pack audio can still be used, and long status text remains wrap-ready |
| Spanish 22, French 26, and Russian 27 sound units are covered by diagnosis and sentence practice; contrast and sentence decks meet launch-density targets | `src/lib/language-learning-decks.ts`, `src/lib/language-sound-units/*.ts`, `src/__tests__/language-learning-decks.test.ts`, `src/__tests__/spanish-language-content.test.ts`, `src/__tests__/french-language-content.test.ts`, `src/__tests__/russian-language-content.test.ts`; the Russian final-devoicing unit now explains that final voiced obstruents devoice before pauses or voiceless consonants but connected speech before voiced consonants, sonorants, or vowels must be handled as connected-speech realization rather than isolated word-final devoicing |
| Non-English IPA audit exports are reproducible, distinguish full IPA rows from deck focus hints, keep sourced review decisions machine-checkable, and keep bundled language-pack IPA metadata aligned | `src/lib/non-english-ipa-audit.ts`, `scripts/export-non-english-ipa-audit-input.mjs`, `docs/operations/non-english-ipa-audit-input.json`, `docs/operations/non-english-ipa-reviewed-findings.json`, `docs/operations/IPA_DISPLAY_AUDIT_STRATEGY.md`, `public/audio/language-packs/fr-FR/manifest.json`, `public/audio/language-packs/ru-RU/manifest.json`, `src/__tests__/non-english-ipa-audit.test.ts`, `src/__tests__/non-english-ipa-reviewed-findings.test.ts`, `src/__tests__/static-language-audio-pack-assets.test.ts`, `npm.cmd run ipa:audit:export`; the current tracked export contains `1736` rows and marks `34` `deck-focus-hint` rows so compact practice cues are not mistaken for complete sentence IPA, the test compares the tracked JSON against the current source-built output to catch stale audit exports, high-risk French connected-speech rows reject stale word-boundary IPA, Spanish audit `currentIpa` rows stay phoneme-first for `/b d g/` while explicit allophone unit labels may keep `[β ð ɣ]`, the static language-pack asset test locks applied French/Russian manifest IPA metadata against stale word-boundary or isolated-devoicing strings, and the reviewed-findings ledger locks applied `update`, accepted `variant-accepted`, and unchanged `needs-review` rows such as Russian `поезд идёт` against accidental drift |
| Repeated or noisy non-English practice text is constrained | `src/lib/language-keyword-expansions.ts`, `src/__tests__/language-learning-decks.test.ts`, `src/__tests__/spanish-sound-examples.test.ts` |
| Non-English diagnosis avoids trusted perfect scores when evidence is thin, mismatched, omitted, or inserted | `src/lib/diagnosis-engine.ts`, `src/lib/assessment-evidence-engine.ts`, `src/types/diagnosis.ts`, `src/__tests__/diagnosis-engine.test.ts`, `src/__tests__/assessment-evidence-engine.test.ts`, `scripts/desktop-ui-smoke.mjs` |
| Recording startup, mid-session recorder interruptions, and first-run microphone readiness failures show actionable Chinese messages and do not leave drill or diagnosis users stuck without visible feedback | `src/hooks/use-recorder.ts`, `src/components/drill/drill-recording.tsx`, `src/components/drill/desktop-readiness-card.tsx`, `src/lib/desktop-readiness.ts`, `src/app/drill/word/page.tsx`, `src/app/drill/sentence/page.tsx`, `src/app/drill/spontaneous/page.tsx`, `src/app/drill/contrast/page.tsx`, `src/app/drill/pack/[packId]/pack-runner-client.tsx`, `src/components/sentences/sentence-recording-card.tsx`, `src/app/phonemes/[phoneme]/phoneme-detail-page.tsx`, `src/app/assessment/page.tsx`, `src/app/assessment/passage/page.tsx`, `src/__tests__/use-recorder.test.tsx`, `src/__tests__/drill-recording.test.tsx`, `src/__tests__/desktop-readiness.test.ts`, `src/__tests__/desktop-readiness-card.test.tsx`, `src/__tests__/desktop-preflight-ui-smoke.test.ts`; denied permission, missing microphone, busy device, unsupported recorder runtime, unsupported microphone access, mid-recording permission/device/busy interruptions, low input signal, too-short readiness samples, and generic startup failures map to separate Chinese messages, recorder initialization failure stops any opened stream, runtime recorder errors stop the stream and discard untrusted partial audio, word/sentence/spontaneous/contrast/pack-runner drill cards and quick diagnosis word/paragraph cards render recorder failures inline, and the first-run readiness card shows an inline Chinese microphone hint instead of only a short status label |
| Azure Speech failures show actionable Chinese messages instead of raw provider/network errors | `src/lib/api-client.ts`, `src/hooks/use-azure-assessment.ts`, `src/app/phonemes/[phoneme]/phoneme-detail-page.tsx`, `src/app/assessment/page.tsx`, `src/app/assessment/passage/page.tsx`, `src/app/sentences/page.tsx`, `src/app/drill/prosody/page.tsx`, `src/app/drill/scenarios/page.tsx`, `src/app/drill/spontaneous/page.tsx`, `src/app/drill/contrast/page.tsx`, `src/app/drill/pack/[packId]/pack-runner-client.tsx`, `src/hooks/use-drill-session.ts`, `src/__tests__/api-client-azure.test.ts`, `src/__tests__/desktop-preflight-ui-smoke.test.ts`; Azure connection tests, pronunciation assessment, and transcription now map no-speech recordings, key/region auth mismatch, missing local Azure config, unreachable network/proxy, timeout, quota/rate-limit, temporary service failure, and empty transcription responses to Chinese messages before they reach UI; quick diagnosis word/paragraph stages plus prosody, scenario, spontaneous transfer, contrast, and pack-runner recording pages render Azure failures inline, and paragraph-stage failures keep the user on the current card rather than replacing the screen with a generic fallback |
| AI coach feedback stays tied to the selected language, target text, IPA/evidence boundaries, and conservative non-English status; desktop LLM provider selection does not allow arbitrary endpoints or paid live calls during routine validation; LLM failures show actionable Chinese messages instead of silently finishing | `src/lib/llm-prompt.ts`, `src/lib/language-feedback-rules.ts`, `src/lib/language-source-alignment.ts`, `src/lib/llm-providers.ts`, `src/lib/api-client.ts`, `src/hooks/use-llm-feedback.ts`, `src/components/settings/llm-config-card.tsx`, `src-tauri/tauri.conf.json`, `docs/api-reference.md`, `src/__tests__/llm-prompt.test.ts`, `src/__tests__/language-feedback-rules.test.ts`, `src/__tests__/language-source-alignment.test.ts`, `src/__tests__/llm-desktop-policy.test.ts`, `src/__tests__/llm-config-card.test.tsx`, `src/__tests__/llm-feedback-parser.test.ts`, `src/__tests__/use-llm-feedback.test.tsx`, `src/__tests__/desktop-preflight-ui-smoke.test.ts`; prompts include the target text, current `languageId`, Azure JSON evidence, language-specific coaching rules, explicit non-English experimental evidence limits, and a ban on claiming mastery from a single recording; non-English full-score feedback must say only `本次录音没有发现明显问题`, must not say `完美` or `已掌握`, and must keep a light retest or practice suggestion; Russian final-devoicing coach guidance and source summaries distinguish pause/voiceless-consonant devoicing from connected speech before voiced consonants, sonorants, or vowels; MiniMax and Xiaomi MiMo remain manual-config providers until exact official OpenAI-compatible endpoint/model information is confirmed; Settings connection tests and feedback streams map auth, invalid provider/model/base URL, network/proxy, timeout, quota/rate-limit, service failure, and desktop policy-block errors to Chinese messages, and `useLlmFeedback` renders SSE error chunks instead of ignoring them |
| Detail-page scoring breakdowns, detail header speakers, and list-card IPA clicks show honest target reference and stable clickable short-audio tiles | `src/lib/detail-assessment-breakdown.ts`, `src/components/scoring/phoneme-highlight.tsx`, `src/components/phoneme/phoneme-play-button.tsx`, `src/components/phoneme/phoneme-card.tsx`, `src/hooks/use-audio-player.ts`, `src/lib/assessment-segment-audio.ts`, `src/lib/azure-phoneme-map.ts`, `src/lib/audio-playback-policy.ts`, `src/lib/language-phoneme-resources.ts`, `src/lib/local-language-assets.ts`, `src/__tests__/detail-assessment-breakdown.test.ts`, `src/__tests__/phoneme-highlight.test.tsx`, `src/__tests__/phoneme-play-button.test.tsx`, `src/__tests__/phoneme-card.test.tsx`, `src/__tests__/assessment-segment-audio.test.ts`, `src/__tests__/audio-playback-policy.test.ts`, `src/__tests__/use-audio-player.test.tsx`, `src/__tests__/azure-phoneme-map-language-parity.test.ts`, `src/__tests__/language-phoneme-resources.test.ts`, `scripts/desktop-ui-smoke.mjs`; non-English scoring tiles reuse the exact same left/detail sound-unit header clip (`phonemeAudio.localSrc`) or stay visible but unclickable, never falling back to word examples, rule/prosody clips, proxy media, or video audio; Spanish `/β/ /ð/ /ɣ/` allophone clips do not masquerade as plain `/b/ /d/ /g/`; English chart clicks are capped at `560ms`, and local non-English header/scoring sound-unit clips are capped at `500ms` through the shared header playback policy |
| Recording replay and benchmark playback use centralized audio cleanup | `src/app/drill/prosody/page.tsx`, `src/app/drill/scenarios/page.tsx`, `src/app/drill/spontaneous/page.tsx`, `src/app/progress/page.tsx`, `src/hooks/use-audio-player.ts`, `src/__tests__/desktop-preflight-ui-smoke.test.ts`; source policy forbids raw `new Audio(...)` replay in these user-facing pages |
| Benchmark recording archive save failures are visible without blocking the completed scoring result | `src/lib/benchmark-archive.ts`, `src/app/drill/prosody/page.tsx`, `src/app/drill/scenarios/page.tsx`, `src/app/drill/spontaneous/page.tsx`, `src/__tests__/benchmark-archive.test.ts`, `src/__tests__/desktop-preflight-ui-smoke.test.ts`; prosody, scenario, and spontaneous transfer keep the scored result/feedback after a successful assessment, but if IndexedDB/quota/local storage prevents benchmark audio from being archived, they show a Chinese warning that the recording was not saved instead of only writing `console.warn`; spontaneous transfer also avoids claiming "录音已作为 benchmark 保存" when archive persistence failed |
| Release-window smoke covers likely user-visible regressions | `scripts/desktop-ui-smoke.mjs`: settings, English detail, Spanish `/es-a`, Spanish stress/rhythm, French `/fr-i`, schwa, liaison, enchainement, elision, final consonant silence, Russian `/ru-a`, stress/reduction/rule units, `/drill`, `/sentences`, `/assessment`, `/progress`; verifies not localhost, no text ellipsis/nowrap on detail task text, no practice-button overlap, expected header-audio visibility/clickability readiness, A/B voice selector and word-audio button visibility/clickability/label runtime readiness, rule/prosody A/B playback labels do not regress to word-only labels, free-practice page/input/recording cards render in main, narrow, and low-height route passes, assessment page/intro card/start/passage actions render in main, narrow, and low-height route passes, video selector visibility/no-overlap/no-overflow and wrapping labels, Settings/usage/pronunciation-test long-control wrapping and pronunciation-test row no-overlap, scoring-breakdown placeholder or target IPA reference visibility/readability/no-overflow readiness in normal, narrow, and low-height detail windows, scoring tile exact-audio policy runtime readiness with one playable exact header clip, one locked unverified tile, `progress-experimental-blocker`, `scoringTileAudioPolicy=ok`, `practiceAudioLabels=ok`, `freePracticeSmoke=ok`, `assessmentSmoke=ok`, `narrowViewport=ok`, and `lowHeightViewport=ok` |
| Public repository has basic open-source governance, asset-boundary documentation, support routing, release-script guardrails, issue/PR template guardrails, conduct/privacy expectations, and a tracked-file secret-format guard | `LICENSE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SUPPORT.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, `.env.example`, `.github/ISSUE_TEMPLATE/*.md`, `.github/pull_request_template.md`, `README.md`, `package.json`, `scripts/desktop-build.mjs`, `src/__tests__/desktop-artifact-smoke.test.ts`, `src/__tests__/open-source-readiness.test.ts`; source code is MIT-licensed while bundled media is explicitly not automatically relicensed, public developer/release npm scripts remain explicit, the desktop build wrapper defaults Windows release packaging to `CARGO_BUILD_JOBS=1` unless the environment already overrides it, issue and PR templates keep Release EXE/privacy/experimental-language boundaries visible, IPA audit reports require `auditRole` plus sourced update/variant evidence and keep `needs-review` rows unchanged without stronger follow-up evidence, `SUPPORT.md` routes Release EXE bugs, IPA audits, private reports, and paid-provider boundaries to the correct channel, `CODE_OF_CONDUCT.md` keeps accent/learner/IPA discussion respectful and evidence-first while routing secrets or private recordings away from public issues, routine validation scripts do not call audio generation, and tracked text files are checked for obvious real private-key/API-token formats without printing matched secret text |
| Public release remains blocked until Windows signing is complete | `README.md`, `docs/INSTALLATION.md`, `docs/operations/DESKTOP_STARTUP_RUNBOOK.md` |

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
npm.cmd run audio:loudness:dry-run
npm.cmd run desktop:launch-release
```

`audio:parity:dry-run` must report zero missing language-pack items and must not
call ElevenLabs generation. `audio:loudness:dry-run` is a local ffmpeg-based
playback-gain audit for representative A/B word audio and IPA chart normal/slow
word audio versus teaching-video loudness; it also makes zero ElevenLabs calls.
`desktop:live-validation` remains a provider/resource gate for full controlled
release checks; the previous Azure live baseline was `220/220`, but it was not
rerun during this playback/UI RC pass.

## Latest Local Command Results

Latest settled-main RC pass for tomorrow's manual testing:

```text
git status --short --branch
  local tracking ref may show main...origin/main [ahead N] after GitHub API
  push fallback; verify GitHub main ref and local-vs-remote tree SHA before
  treating the content as unpushed

npm.cmd exec vitest run src/__tests__/non-english-ipa-audit.test.ts src/__tests__/language-learning-decks.test.ts src/__tests__/open-source-readiness.test.ts --reporter=verbose
  3 files / 27 tests passed

npm.cmd exec vitest run src/__tests__/russian-language-content.test.ts src/__tests__/language-learning-decks.test.ts src/__tests__/non-english-ipa-audit.test.ts --reporter=verbose
  3 files / 24 tests passed

npm.cmd exec vitest run src/__tests__/language-feedback-rules.test.ts src/__tests__/language-source-alignment.test.ts src/__tests__/russian-language-content.test.ts --reporter=verbose
  3 files / 13 tests passed

npm.cmd exec vitest run src/__tests__/assessment-report.test.tsx src/__tests__/mastery-language-policy.test.ts src/__tests__/diagnosis-engine.test.ts --reporter=verbose
  3 files / 16 tests passed

npm.cmd exec vitest run src/__tests__/non-english-ipa-reviewed-findings.test.ts src/__tests__/non-english-ipa-audit.test.ts src/__tests__/language-learning-decks.test.ts --reporter=verbose
  3 files / 22 tests passed

npm.cmd exec vitest run src/__tests__/open-source-readiness.test.ts --reporter=verbose
  1 file / 8 tests passed

npm.cmd exec vitest run src/__tests__/static-language-audio-pack-assets.test.ts src/__tests__/multilingual-audio-parity.test.ts src/__tests__/non-english-ipa-reviewed-findings.test.ts --reporter=verbose
  3 files / 14 tests passed; language-pack manifest IPA metadata is aligned
  with applied French/Russian reviewed findings while Russian поезд идёт
  remains unchanged as needs-review

npm.cmd exec vitest run src/__tests__/llm-prompt.test.ts src/__tests__/llm-desktop-policy.test.ts src/__tests__/llm-config-card.test.tsx src/__tests__/desktop-preflight-ui-smoke.test.ts --reporter=verbose
  4 files / 25 tests passed

npm.cmd exec vitest run src/__tests__/llm-prompt.test.ts src/__tests__/language-feedback-rules.test.ts src/__tests__/llm-desktop-policy.test.ts --reporter=verbose
  3 files / 20 tests passed; non-English full-score prompts remain conservative
  and do not ask the AI coach to write "完美" or "已掌握"

npm.cmd exec vitest run src/__tests__/drill-pack-runner.test.tsx src/__tests__/mastery-language-policy.test.ts --reporter=verbose
  2 files / 7 tests passed; direct English pack routes are blocked for
  experimental languages before English pack content renders

npm.cmd exec vitest run src/__tests__/progress-page.test.tsx src/__tests__/desktop-preflight-ui-smoke.test.ts src/__tests__/mastery-language-policy.test.ts --reporter=verbose
  3 files / 13 tests passed; direct progress-archive access shows the
  experimental blocker for Spanish/French/Russian and desktop UI smoke now
  covers /progress in main, narrow-window, and low-height route passes; the
  experimental path does not read the formal mastery profile or benchmark
  archive

npm.cmd exec vitest run src/__tests__/use-recorder.test.tsx src/__tests__/drill-recording.test.tsx --reporter=verbose
  Recorder startup failures map to actionable Chinese messages, opened streams
  are stopped after recorder initialization failure, mid-session recorder
  errors discard untrusted partial audio, and word/sentence drill recording
  cards render recorder errors inline

npm.cmd exec vitest run src/__tests__/desktop-readiness.test.ts src/__tests__/desktop-readiness-card.test.tsx --reporter=verbose
  2 files / 8 tests passed; first-run microphone readiness rejects low-signal
  and too-short checks with Chinese messages, and the desktop readiness card
  shows actionable Chinese hints for unsupported microphone access and denied
  permission

npm.cmd exec vitest run src/__tests__/api-client-azure.test.ts --reporter=verbose
  1 file / 10 tests passed; Azure auth, network, no-speech, NoMatch, and
  empty-transcription failures map to actionable Chinese messages

npm.cmd exec vitest run src/__tests__/llm-feedback-parser.test.ts src/__tests__/use-llm-feedback.test.tsx src/__tests__/llm-desktop-policy.test.ts --reporter=verbose
  3 files / 20 tests passed; LLM Settings connection failures, stream provider
  and network failures, and useLlmFeedback SSE error chunks surface actionable
  Chinese messages

npm.cmd exec vitest run src/__tests__/api-client-audio.test.ts src/__tests__/use-tts-aligned.test.tsx src/__tests__/use-word-pronunciation.test.tsx --reporter=verbose
  3 files / 23 tests passed; ElevenLabs connection/TTS failures, missing
  standard-demo provider guidance, and online dictionary fallback errors surface
  actionable Chinese messages without generating audio

npm.cmd exec vitest run src/__tests__/settings-connection-errors.test.tsx src/__tests__/llm-config-card.test.tsx --reporter=verbose
  2 files / 8 tests passed; Settings connection-test status preserves
  actionable Chinese Azure, ElevenLabs, AI coach, and Youdao errors, replaces
  raw English fetch failures with Chinese guidance, and keeps long status text
  wrap-ready

npm.cmd exec vitest run src/__tests__/phoneme-study-card.test.tsx src/__tests__/practice-text-presentation.test.ts --reporter=verbose
  2 files / 9 tests passed; non-English detail practice text stays centered
  and untruncated, Russian long Cyrillic rule sentences stay visible, and A/B
  playback buttons no longer label phrase/sentence/rule tasks as word playback

npm.cmd run test
  100 files / 557 tests passed

npm.cmd run typecheck
  passed

npm.cmd run lint
  passed; 357 files checked

npm.cmd run build:desktop-frontend
  passed; 144 static pages generated

npm.cmd run desktop:build
  passed; rebuilt Release EXE, MSI, and NSIS artifacts

npm.cmd run desktop:preflight
  passed; Release EXE exists, no running speakright.exe, no localhost startup;
  during the pre-commit verification run it correctly reported the expected
  dirty worktree from this local fix

npm.cmd run desktop:ui-smoke
  passed; Release EXE runtime, centered target text, no target-text ellipsis,
  no practice-button overlap, expected header-audio visibility/clickability readiness,
  A/B selector and word-audio button visibility/clickability/label runtime
  checks, video selector
  visibility/no-overlap/no-overflow, Settings/usage long-text wrapping,
  Settings pronunciation-test row no-overlap, scoring-breakdown
  visibility/readability/no-overflow runtime checks in normal, narrow, and
  low-height detail windows,
  /progress experimental blocker route coverage in main, narrow-window, and
  low-height route passes,
  exact scoring-tile audio policy with a playable header clip and a locked
  unverified tile,
  scoringTileAudioPolicy=ok,
  narrowViewport=ok, lowHeightViewport=ok,
  releaseServedFromDevServer=false

npm.cmd run audio:parity:dry-run
  Spanish 880 existing / 0 missing; French 1090 existing / 0 missing;
  Russian 920 existing / 0 missing; no ElevenLabs calls

npm.cmd run desktop:launch-release
  passed; Release EXE opened from the static Tauri bundle and the verification
  process was closed afterward
```

For tomorrow, start from:

```bat
cd /d E:\SpeakRightDesktopRepo
npm.cmd run desktop:preflight
npm.cmd run desktop:launch-release
```

## Limits

- `audio:loudness:dry-run` was not rerun during the exact-header scoring-tile
  pass; the latest recorded loudness pass remains the previous playback-layer
  gain audit.
- `es-ES`, `fr-FR`, and `ru-RU` are experimental and must not be described as
  formally mastered.
- The RC gate does not generate new TTS audio.
- Controlled internal testing may continue with unsigned Windows artifacts;
  public release still requires code signing.
