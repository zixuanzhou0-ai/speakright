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
- Public repository governance files now exist: `LICENSE`, `CONTRIBUTING.md`,
  `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, issue templates, PR template, and
  `.env.example`. The MIT license covers source code and source documentation;
  bundled media assets are explicitly documented as a separate rights boundary.
- Open-source readiness tests now include a tracked-text-file guard for obvious
  real private-key/API-token formats; failures report only path, line, and
  pattern name, not the matched secret text.
- Sourced non-English IPA review decisions now have a tracked structured ledger
  at `docs/operations/non-english-ipa-reviewed-findings.json`. It records which
  GPT Research/high-risk rows were applied, which broad variants were accepted,
  and which rows remain `needs-review`.
- Open-source readiness tests also lock the public developer/release npm
  scripts, including `test`, `typecheck`, `lint`, `desktop:preflight`,
  `desktop:launch-release`, dry-run audio audits, and the public release gate.
  Routine validation scripts are checked so they do not call audio generation.
- Issue and PR templates now keep the same public-maintenance boundaries visible:
  Release EXE for user-facing desktop checks, no API keys/raw recordings/private
  exports, no unconfirmed ElevenLabs generation, and Spanish/French/Russian as
  experimental unless a separate evidence plan exists.

## Current Local Worktree

At the time of the latest settled handoff, the working tree had no local file
edits and no local `speakright.exe` process was expected to be running. The
local branch may still show `main...origin/main [ahead N]` because several
recent rounds used the GitHub Git Data API push fallback after HTTPS
push/fetch failed or rejected a non-fast-forward update. Treat the GitHub `main`
ref and a local-vs-remote tree SHA comparison as authoritative before assuming
content is unpushed. Do not use `git reset` merely to make the local tracking
ref look tidy.

If `git status --short --branch` shows local file edits in a future chat,
preserve them unless the user explicitly asks to discard them; do not clean the
worktree just to make the status look tidy.

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
- Diagnosis issue cards now keep formal mastery stage badges for English only.
  Spanish/French/Russian reports show `experimental 练习观察` plus the
  experimental mastery blocker instead of `阶段` / `下一层` / `阶段分`, so scoring
  feedback does not imply formal non-English mastery.
- Russian final-devoicing wording is now aligned across the course card, AI
  coach rules, and source-alignment summaries: final voiced obstruents devoice
  before pauses or voiceless consonants, but connected speech before voiced
  consonants, sonorants, or vowels must be treated as connected-speech
  realization rather than isolated word-final devoicing.
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

The latest settled-main command results are centralized in
`docs/operations/RC_EVIDENCE_AUDIT.md` so README, installation notes, and this
handoff do not drift apart.

Current gate summary:

- Open-source handoff/readiness plus IPA audit export drift tests passed.
- Full tests, typecheck, lint, and static desktop frontend build passed.
- Release EXE preflight passed; no localhost startup is part of the release
  path.
- Release EXE UI smoke passed with `scoringTileAudioPolicy=ok`,
  `narrowViewport=ok`, `lowHeightViewport=ok`, and
  `releaseServedFromDevServer=false`.
- Release EXE launch passed from the static Tauri bundle, and the test process
  was closed after verification.
- No ElevenLabs generation or TTS spend is part of this validation path.

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
  It now contains the final expanded UI corpus with `1736` rows: Spanish `516`,
  French `599`, Russian `621`. The earlier `988`-row file covered only base
  sound-unit arrays.
- The audit input is now reproducible with `npm.cmd run ipa:audit:export`.
  Rows include `auditRole`: `ipa-transcription` for real IPA rows and
  `deck-focus-hint` for `language-learning-decks` sentence `ipaHint` rows. The
  current export keeps the same `1736` total rows and marks `34` deck focus
  hints so GPT Research does not mistake compact cues such as `/s sʲ zʲ/` for
  complete sentence IPA.
- The reviewed-findings ledger is now checked by
  `src/__tests__/non-english-ipa-reviewed-findings.test.ts`. It locks the
  high-risk Spanish source-leak guardrails, French connected-speech updates,
  French accepted broad variants, Russian connected-speech updates, and the
  Russian `поезд идёт` `needs-review` hold.
- The next audit step is not bulk editing. Send that JSON through GPT Research
  or expert review using the prompt in `IPA_DISPLAY_AUDIT_STRATEGY.md`, then
  only apply rows with sourced `update` or `variant-accepted` verdicts.
- First GPT Research pass after the repo became public confirmed the high-risk
  trend: Spanish was mixing `/b d g/` phoneme-layer targets with `[β ð ɣ]`
  realization-layer IPA in learner-facing keyword rows. The code now normalizes
  final Spanish keyword IPA to the phoneme layer while preserving allophone
  teaching labels, assessment aliases, and exact header clips for scoring.
- Remaining audit work: continue from the new `1736`-row final UI corpus and
  ask GPT Research for a full row-level table, especially for French schwa
  style variants and Russian broad-vs-finer accepted variants.
- Second GPT Research pass was applied for high-confidence rows:
  - French connected-speech/enchainement rows now use `/lɔmekut/`,
    `/lekɔluvʁ/`, and `/dakɔʁ avɛkɛl/`.
  - French extra keyword source rows now also use the same connected-speech
    forms, and the non-English audit test rejects stale word-boundary IPA such
    as `/lɔm ekut/` and `/dakɔʁ avɛk ɛl/`.
  - Russian connected-speech rows now preserve/restore voiced obstruents in
    `Сад зимой синий.`, `друг дома`, `город большой`, `нож острый`,
    `снег идёт`, `класс большой`, and `хлеб на кухне`.
  - The Russian `词尾清化` learner-facing description now says final voiced
    obstruents devoice before pauses or voiceless consonants, but connected
    speech before voiced consonants, sonorants, or vowels must be handled as
    connected-speech realization rather than isolated word-final devoicing.
  - `поезд идёт` remains `needs-review`; do not auto-change it without a more
    direct source.
  - Some final UI rows are compact deck focus hints rather than full IPA. Treat
    those as practice-focus hints during future audit passes.

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
