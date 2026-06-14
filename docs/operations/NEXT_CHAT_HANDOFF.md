# Next Chat Handoff

Date: 2026-06-14

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

- `es-ES`, `fr-FR`, and `ru-RU` remain experimental. They can provide training
  feedback, but `evidenceMastery` remains disabled.
- Do not generate ElevenLabs audio or spend TTS credits unless the user
  explicitly confirms it.
- Windows artifacts are still unsigned; this remains the public-release blocker.
- The current Release Candidate evidence matrix is
  `docs/operations/RC_EVIDENCE_AUDIT.md`.

## Current Local Worktree

At the time of this handoff, the branch was ahead of `origin/main` by local
commits and also had uncommitted work for non-English practice-card readability.
Do not revert these changes unless the user explicitly asks.

Expected modified areas:

- `docs/operations/RC_EVIDENCE_AUDIT.md`
- `src/components/phoneme/phoneme-study-card.tsx`
- `src/components/layout/sidebar-phoneme-list.tsx`
- `src/components/phoneme/video-player.tsx`
- `src/components/phoneme/spanish-sounds-of-speech-video-panel.tsx`
- `src/components/scoring/phoneme-highlight.tsx`
- `src/components/settings/language-config-card.tsx`
- `src/components/settings/usage-monitor.tsx`
- `src/hooks/use-audio-player.ts`
- `src/hooks/use-word-pronunciation.ts`
- `src/app/drill/pack/[packId]/pack-runner-client.tsx`
- `src/lib/audio-normalization.ts`
- `src/lib/audio-playback-policy.ts`
- `src/lib/practice-text-presentation.ts`
- `src/lib/mastery-language-policy.ts`
- `src/lib/detail-assessment-breakdown.ts`
- `src/lib/assessment-evidence-engine.ts`
- `src/lib/diagnosis-engine.ts`
- `src/lib/language-keyword-expansions.ts`
- `src/lib/language-sound-units/spanish.ts`
- `src/lib/language-sound-units/french.ts`
- `src/lib/language-source-alignment.ts`
- `src/types/diagnosis.ts`
- focused tests under `src/__tests__/`

Run this first in the next chat:

```bat
cd /d E:\SpeakRightDesktopRepo
git status --short --branch
```

## Latest Local Fixes To Preserve

- Non-English practice cards now prioritize the text the user must read.
  Words, phrases, and sentences should be visible in full instead of using
  ellipsis.
- Practice target text and IPA are not only visually wrapped but also enforced
  as centered at runtime. `desktop:ui-smoke` now checks computed
  `text-align: center` on detail-page reading targets.
- The shared target-text presentation tests now also lock long Cyrillic rule
  text and all centered target-text class helpers against `truncate`,
  `line-clamp`, and `whitespace-nowrap` regressions.
- Non-English rule/prosody units use Chinese labels such as `规则训练 · 音节节奏`
  rather than raw English rule names like `syllable timing`.
- Header speaker buttons should appear only when there is real local target
  audio. If no local target audio exists, do not show a speaker icon that jumps
  to an external page. The `PhonemePlayButton` component now enforces this too:
  external-only references and browser-TTS fallback audio render no header
  speaker.
- Spanish `词重音` and `音节节奏`, and French `词尾静音`, had duplicate examples
  reduced. Continue auditing all Spanish/French/Russian units for repeated text.
- Spanish video buttons were shortened and allowed to wrap so they do not crowd
  the practice card.
- Settings language cards and Azure usage history targets now wrap instead of
  truncating long learner-facing text.
- Settings pronunciation-test controls now wrap as a row in narrow windows, so
  the test button and connection status do not crowd each other. Release EXE
  smoke now checks this row exists at runtime, wraps, avoids horizontal
  overflow, and has no overlapping child controls.
- Scoring phoneme tiles now use stable duplicate-safe keys, clean up delayed
  click timers on unmount, and stop/unload the previous short audio safely when
  another tile is played.
- Header speakers use short local clips only. Non-English scoring-breakdown
  phoneme tiles now reuse the exact same left/detail sound-unit header clip
  (`phonemeAudio.localSrc`) or stay visible but unclickable. They no longer use
  bundled word examples, rule/prosody clips, proxy media, or video audio as
  single-phoneme playback sources.
- Exact assessment audio aliases are now stored with local language assets.
  Spanish allophone clips stay narrow: `es-bv` maps to `/β/`, `es-d` to `/ð/`,
  and `es-g` to `/ɣ/`; they do not pretend to be plain `/b/ /d/ /g/`.
  Proxy/rule units such as Spanish nasal position and Russian hard/soft,
  reduction, devoicing, assimilation, and cluster units cannot become clickable
  scoring-tile audio.
- Source policy now prevents local video files from being exposed as
  phoneme-audio `localSrc`, and the shared `useAudioPlayer` hook refuses
  video-backed sources as a final guard. The header speaker component also
  refuses non-local fallback audio at render time.
- Scoring-breakdown tiles now also reject video-backed audio URLs before
  constructing a `Howl`, so they cannot play a full teaching-video track even if
  an upstream assessment-audio mapping regresses.
- Scoring-breakdown tile playback windows now come from the same local header
  playback policy as the left/detail speaker. English chart clicks are capped at
  `560ms`; local non-English header and scoring sound-unit clips are capped at
  `500ms` with a short fade. The old bundled-word fallback path for
  non-English scoring tiles has been removed.
- Recording replay and benchmark playback now use `useAudioPlayer.playBlob`
  instead of raw `new Audio(...)`, so repeated replay clicks stop the previous
  blob and object URL cleanup stays centralized.
- Bundled English and Spanish/French/Russian A/B word audio uses peak-safe Web
  Audio `GainNode` playback gain for louder, closer-to-video local playback
  without regenerating MP3s, calling ElevenLabs, or allowing obvious clipping.
  Very quiet decoded local word clips can use up to `12x` peak-safe gain when
  their peaks permit it; this specifically covers low-level French pink samples.
- IPA chart normal/slow word audio now uses the shared chart-word playback
  policy, so the English list-card illustration and detail-card chart icon no
  longer bypass the local word-audio loudness pass.
- Free-practice/read-along playback now keeps the same language-pack fallback
  gain when it serves bundled local language-pack audio, including replay. This
  prevents a local file from losing its gain after being fetched as a blob.
- The cached normalization helper now keeps the same language-pack fallback gain
  as the active Web Audio playback hook, including decode-failure fallback, so
  future local-audio usage does not regress A/B volume matching.
- Detail-page A/B voice selectors and word-audio buttons now have dedicated
  smoke hooks. Release EXE smoke checks that A and B both exist, are visible,
  do not overlap, and that the word-audio speaker button is visible, is not
  disabled, and exposes the `播放单词发音` label at runtime.
- Detail-page video selectors now have stronger runtime smoke coverage: when a
  selector is present, the Release EXE smoke checks the selector and all option
  buttons are visible, labels are not ellipsized, buttons do not overlap, and
  the selector does not overflow horizontally.
- Detail-page scoring breakdowns keep runtime smoke coverage for the empty
  placeholder and target IPA reference: the checked element must be visible,
  non-empty, readable, and not horizontally overflowing. Non-English
  phrase/sentence assessment collection uses all returned words instead of only
  the first word.
- Non-English diagnosis now records omission/insertion/mispronunciation counts
  in the evidence summary. Omission or insertion miscues block trusted overall
  scores and produce an insufficient-evidence retest message.
- `desktop:ui-smoke` now includes both `narrowViewport=ok` and
  `lowHeightViewport=ok`, covering Settings, long rule detail pages, drill, free
  practice, and diagnosis from the Release EXE. The narrow and low-height detail
  passes also require scoring-breakdown placeholder/IPA-reference readiness.
- Formal mastery recording is English-only. Non-English free practice and
  advanced drill pages may score and provide feedback, but they should not write
  formal mastery/evidenceMastery while the languages remain experimental.
  Advanced pack-runner and HVPT perception writes are gated by
  `canRecordFormalMastery(languageId)`.

## Latest Verification

The latest local verification after the RC evidence audit, centered-text,
audio-playback, small-bug smoke tightening, and exact header-clip scoring-audio
pass passed:

```bat
npm.cmd exec vitest run src/__tests__/assessment-segment-audio.test.ts src/__tests__/phoneme-highlight.test.tsx src/__tests__/azure-phoneme-map-language-parity.test.ts src/__tests__/language-phoneme-resources.test.ts src/__tests__/phoneme-play-button.test.tsx src/__tests__/audio-playback-policy.test.ts --reporter=verbose
npm.cmd exec vitest run src/__tests__/desktop-preflight-ui-smoke.test.ts --reporter=verbose
npm.cmd exec vitest run src/__tests__/desktop-preflight-ui-smoke.test.ts src/__tests__/language-source-alignment.test.ts src/__tests__/phoneme-study-card.test.tsx src/__tests__/practice-text-presentation.test.ts --reporter=verbose
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:desktop-frontend
npm.cmd run desktop:preflight
npm.cmd run desktop:build
npm.cmd run desktop:ui-smoke
npm.cmd run audio:parity:dry-run
npm.cmd run audio:loudness:dry-run
npm.cmd run desktop:launch-release
```

Results:

- Focused exact scoring-audio tests: 6 files / 57 tests passed, including
  left/right header-clip parity, Spanish/French/Russian exact alias inventory,
  unclickable unverified tiles, and header/scoring short playback.
- Desktop UI smoke script self-test: 1 file / 7 tests passed after the scoring
  tile policy was updated to require at least one exact playable header clip and
  at least one locked unverified tile.
- Focused UI/source/text tests: 4 files / 18 tests passed.
- Full tests: 89 files / 489 tests passed.
- Typecheck: passed.
- Lint: passed; Biome checked 341 files.
- Static desktop frontend build: passed; 144 static pages generated.
- Desktop release build: passed; rebuilt `speakright.exe`, MSI, and NSIS.
- Desktop preflight: passed; Release EXE exists and no localhost is started.
- Desktop UI smoke: passed from Release EXE, including centered reading-target
  text, no ellipsis/nowrap, no practice-button overlap, expected header-audio
  visibility/clickability readiness, video selector
  wrapping/no-overlap/no-overflow, Settings/usage
  long-text wrapping, Settings pronunciation-test row wrapping/no-overlap, A/B
  selector and word-audio button visibility/clickability/label runtime checks,
  scoring-breakdown visibility/readability/no-overflow runtime checks in
  normal, narrow, and low-height detail windows, scoring tile exact-audio policy
  runtime checks with one playable exact header clip and one locked unverified
  tile, `scoringTileAudioPolicy=ok`, `narrowViewport=ok`,
  `lowHeightViewport=ok`, and `releaseServedFromDevServer=false`.
- Audio parity dry-run: passed; Spanish 880 existing / 0 missing, French 1090 /
  0 missing, Russian 920 / 0 missing; no ElevenLabs calls.
- Audio loudness dry-run: latest recorded pass; reference video mean `-14.7 dB`, word floor
  `-21.6 dB`; representative English, Spanish, French, Russian A/B word
  samples and IPA chart normal/slow word samples passed after playback-layer
  gain; no ElevenLabs calls. It was not rerun during the exact-header
  scoring-tile pass because that pass did not change loudness math.
- Release EXE launch: passed; latest manual-test process PID was `70112`.

For tomorrow's manual test session, start with:

```bat
cd /d E:\SpeakRightDesktopRepo
git status --short --branch
npm.cmd run desktop:preflight
npm.cmd run desktop:launch-release
```

If `desktop:preflight` says `speakright.exe` is already running, close the
existing SpeakRight window and run `npm.cmd run desktop:preflight` again before
launching.

## Next Manual QA Focus

Start with the Release EXE and inspect these areas before adding new features:

- Spanish: `词重音`, `音节节奏`, long phrases, duplicate examples, A/B playback.
- French: `liaison`, `enchainement`, `elision`, `schwa`, `词尾静音`, long text
  wrapping, hidden speaker icons for units without local target audio.
- Russian: rule units, spelling-to-sound units, long Cyrillic text, local audio
  playback.
- Drill, free practice, and diagnosis: confirm no English content leaks into
  non-English training and low-evidence diagnosis does not show trusted perfect
  scores.
- RC evidence: confirm `docs/operations/RC_EVIDENCE_AUDIT.md` still maps every
  quality claim to a test, smoke check, validation command, or source file.

## 2026-06-14 IPA Display Audit Handoff

- Added `docs/operations/IPA_DISPLAY_AUDIT_STRATEGY.md` after reading the two
  GPT Research reports on Spanish, French, and Russian IPA display policy.
- Locked the product policy to two-layer IPA display:
  - Spanish `es-ES`: phoneme-first Castilian course layer, with allophones as
    training realization where appropriate.
  - French `fr-FR`: dictionary pronunciation for words, connected-speech
    realization for phrases/sentences when liaison, enchainement, elision,
    schwa, or final-consonant behavior matters.
  - Russian `ru-RU`: stress and broad learner-facing realization must be visible;
    lexical/phoneme display can be secondary.
- Generated the GitHub-tracked audit input file:
  `docs/operations/non-english-ipa-audit-input.json`. A local generated copy may
  also exist at
  `E:/SpeakRightDesktopRepo/src-tauri/target/ipa-audit/non-english-ipa-audit-input.json`.
  It contains `988` rows: Spanish `263`, French `353`, Russian `372`.
- The next audit step is not bulk editing. Send that JSON through GPT Research
  or expert review using the prompt in `IPA_DISPLAY_AUDIT_STRATEGY.md`, then
  only apply rows with sourced `update` or `variant-accepted` verdicts.

## Prompt For The Next Codex Chat

Copy this into a new Codex chat:

```text
请继续 SpeakRight Desktop 的发布前收紧工作。工作仓库是：
E:\SpeakRightDesktopRepo

请先阅读这三个文件：
README.md
docs/operations/DESKTOP_STARTUP_RUNBOOK.md
docs/operations/NEXT_CHAT_HANDOFF.md
docs/operations/IPA_DISPLAY_AUDIT_STRATEGY.md

重要要求：
1. 不要切到旧的 E:\SpeakRight 网页端仓库；当前桌面端仓库是 E:\SpeakRightDesktopRepo。
2. 不要用 localhost/dev server 当作桌面端验收入口；用户测试默认启动 Release EXE。
3. 先运行 git status --short --branch，保留当前未提交改动，不要回退。
4. 不要调用 ElevenLabs 生成音频，不要消耗 TTS 额度，除非我明确确认。
5. 西语、法语、俄语仍是 experimental，不能宣称 mastery 已完成。

请先执行：
cd /d E:\SpeakRightDesktopRepo
npm.cmd run desktop:preflight
npm.cmd run desktop:launch-release

然后继续检查并修复：
- 西语/法语/俄语发音单位详情页里是否还有省略号、文本看不全、排版丑、按钮重叠。
- 西语词重音/音节节奏、法语 liaison/enchainement/elision/schwa/词尾静音、俄语规则单位是否有重复词、错误视频、无效小喇叭。
- 没有本地目标音频的非英语规则单位不要显示可点击小喇叭。
- 词、短语、句子必须完整可见，用户能照着复述。
- 修完后跑对应测试、typecheck、lint，并用 Release EXE 复查。

最终请汇报：改了哪些文件、跑了哪些命令、测试结果、还有哪些限制。
```
