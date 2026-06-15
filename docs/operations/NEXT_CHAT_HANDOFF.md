# Next Chat Handoff

Date: 2026-06-15

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
  `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`,
  issue templates, PR template, and `.env.example`. The MIT license covers source
  code and source documentation; bundled media assets are explicitly documented
  as a separate rights boundary.
- The public issue templates now include a dedicated audio/provider request
  path for missing bundled audio, wrong clickable audio sources, loudness
  mismatches, and quota-impacting provider requests.
- The public conduct policy keeps accent, learner-recording, IPA, and
  experimental-language discussion respectful and evidence-first; vulnerabilities,
  leaked credentials, private recordings, and private learning-data exports are
  routed to `SECURITY.md`, not public issues.
- `SUPPORT.md` now routes Release EXE bugs, IPA audit disputes, private
  security/privacy reports, audio/provider requests, and paid-provider/audio
  generation requests to the right public or private channel.
- Open-source readiness tests now include a tracked-text-file guard for obvious
  real private-key/API-token formats; failures report only path, line, and
  pattern name, not the matched secret text.
- Sourced non-English IPA review decisions now have a tracked structured ledger
  at `docs/operations/non-english-ipa-reviewed-findings.json`. It records which
  GPT Research/high-risk rows were applied, which broad variants were accepted,
  and which rows remain `needs-review`.
- French rule sentence hints now show connected-speech IPA for liaison,
  enchaînement, elision, and final-consonant silence; Russian final-devoicing
  sentence practice now uses `Нож тупой` so the target boundary is a clear
  voiceless-consonant context rather than `Друг ждёт`.
- The Russian final-devoicing local asset note is now explicitly marked as a
  proxy anchor and points maintainers to current `Нож тупой /noʂ tʊˈpoj/`
  practice instead of stale `current example друг` wording.
- `audio:parity:dry-run` now reports Russian `918` normalized lookup items with
  `0` missing because terminal punctuation is normalized before local-pack
  lookup; the bundled Russian manifest/file total remains `460 x 2`.
- Language-pack audio manifests now keep their IPA metadata aligned with the
  sourced reviewed findings for applied French connected-speech rows and Russian
  connected-speech voicing rows. The Russian `поезд идёт` manifest entry remains
  unchanged because that row is still `needs-review`.
- Open-source readiness tests also lock the public developer/release npm
  scripts, including `test`, `typecheck`, `lint`, `desktop:preflight`,
  `desktop:launch-release`, dry-run audio audits, and the public release gate.
  Routine validation scripts are checked so they do not call audio generation.
- Drill feedback action buttons now wrap and stay centered after three failed
  attempts, so the `再听一遍` / `跳过此词` controls do not force horizontal
  overflow in narrow windows.
- Diagnosis-report action buttons now wrap as well; long prescription CTA titles
  such as `开始：...` keep `whitespace-normal`, `break-words`, and centered text.
- Free-practice input/listen controls now use a wrapping action row with a
  readable textarea minimum width; the word-mode icon button also has the
  explicit `播放单词发音` accessible label.
- Installation docs now include a source-build Release EXE path and first-launch
  expectations for no API keys, no network, no microphone permission, and
  missing bundled local audio. The runbook mirrors those degraded-state checks
  for manual QA.
- `npm run build` and `npm run desktop:build` now route through
  `scripts/desktop-build.mjs`. On Windows it defaults `CARGO_BUILD_JOBS=1`
  unless the environment already sets a value, reducing Rust/LLVM release-build
  memory spikes while still allowing CI/developers to opt into more parallelism.
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
- Detail-page practice speakers now render `wordAudio.error` inline under the
  word/phrase/sentence controls. Missing non-English local pack audio and
  English online dictionary fallback failures should be visible to learners
  instead of looking like a no-op.
- Free-practice word mode now also renders `wordAudio.error` inline under the
  input/listen controls and clears stale word-audio errors when the learner
  changes text or clears the session.
- Settings usage monitor now shows an explicit first-run ElevenLabs empty state:
  sentence/phrase demos need an API Key, while local word audio and built-in
  language-pack audio can still be used.
- Settings data/privacy center now keeps export, diagnostics, delete, and reset
  results visible inline. Storage/keychain/IndexedDB/quota/permission failures
  are converted to Chinese recovery messages with `role="alert"` instead of
  relying only on a short toast.
- Settings language availability now distinguishes bundled language-pack
  `检查中` from true `缺失或不可读`. Spanish/French/Russian users should not see a
  false missing-pack state while the local manifest is still loading; unreadable
  local resources give a Chinese reinstall/Release EXE feedback hint.
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
- Settings Azure, ElevenLabs, and AI coach config action rows now use the same
  wrap-ready layout. Their connection status text keeps long Chinese
  provider/network messages visible, and Release EXE smoke checks the rows for
  wrapping plus child-control overlap.
- Settings data/privacy reset-all-data dialog now keeps the `同时删除 API keys`
  explanation readable beside or above the switch. Release EXE smoke opens the
  dialog and checks the toggle row for readable text and child-control overlap.
- Prosody drill exercise headers now stack on narrow screens: the exercise
  title/pass-line stays readable and the `听示范` button no longer competes for
  the same row. Release EXE smoke covers `/drill/prosody` in main, narrow, and
  low-height route passes.
- Progress benchmark rows now stack score/date above replay/delete controls on
  narrow screens. Release EXE smoke seeds English benchmark metadata locally,
  checks those rows in main/narrow/low-height passes, and confirms missing local
  benchmark audio shows a Chinese warning without generating audio.
- Progress recent-session rows now wrap pack title, stage badge, target-score
  average, and completion time. Release EXE smoke seeds an English mastery
  profile locally so these rows are checked in main/narrow/low-height passes
  without touching experimental-language mastery.
- Quick diagnosis word and paragraph recording cards now show recorder startup
  errors and Azure scoring errors inline with `role="alert"`, so missing
  microphone permission, missing Azure keys, network failure, or quota failure
  does not look like a frozen assessment step.
- Full-passage diagnosis now follows the same failure standard: recorder errors
  render inline with `role="alert"`, and Azure scoring failures use the latest
  hook error immediately so missing keys or network/provider failures do not
  collapse into a stale generic `评估失败` message.
- Word and sentence drill sessions now use that same latest Azure failure reason
  during scoring, with an actionable Chinese Azure key/region/network fallback
  instead of a generic `评分失败，请重试`.
- Prosody and scenario transfer pages now render standard-demo TTS failures
  inline, and their recording/assessment error panels are `role="alert"`.
  Spontaneous transfer now also shows `recorder.error` instead of only its own
  transcription/scoring error state, so microphone failure is not invisible.
- Contrast, perception, and English pack-runner deep-practice pages now render
  playback, recorder, and Azure assessment failures inline. Pack-runner clears
  stale reference-audio errors before starting a new reference/perception clip,
  so an old failed speaker click does not mask the current task.
- Contrast A/B scoring now keeps a failed recording available and shows
  `重新评分`; after fixing Azure keys/network, the learner can retry the same
  A/B recording instead of being forced into an immediate re-record.
- Shared word pronunciation playback now also ignores stale online-dictionary
  fallback failures after a newer word starts playing, so fast A/B or free
  practice speaker clicks do not inherit an old failed request.
- Perception ABX now clears stale pronunciation errors when starting/restarting
  a session, advancing to the next question, or completing the run, so one
  failed speaker click does not pollute the following question.
- Pack-runner now uses one `clearReferenceAudioState()` path before starting or
  restarting a course, moving items/levels, retrying, and starting normal or
  remediation recording, so stale reference-audio/TTS errors do not linger into
  the scoring card.
- Pack-runner normal scoring and remediation scoring buttons now switch to
  `重新评分` / `重新评分这一步` when an Azure assessment error is visible, making
  same-recording retry explicit.
- Recorder runtime interruptions are no longer treated as usable recordings.
  If `MediaRecorder.onerror` fires after recording starts, the hook stops the
  stream, discards any partial audio, and shows a Chinese recovery message about
  microphone permission/device/busy-state interruption.
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
- Progress archive benchmark playback now shows a Chinese inline warning if the
  metadata exists but the local IndexedDB audio blob is missing, and delete/clear
  failures show inline archive-status errors instead of failing silently. The
  icon-only play/delete buttons have accessible labels.
- Prosody, scenario, and spontaneous transfer now show a Chinese warning if
  benchmark audio cannot be saved to local IndexedDB/quota storage after scoring
  succeeds. The scored result stays visible, but spontaneous transfer no longer
  claims the recording was saved when archive persistence failed.
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
- AI coach prompts now keep full-score non-English feedback conservative:
  Spanish, French, and Russian may say `本次录音没有发现明显问题`, but they must not
  write `完美` or `已掌握`, and they still keep a light retest or practice
  suggestion because the language modules remain experimental.
- Diagnosis issue cards now keep formal mastery stage badges for English only.
  Spanish/French/Russian reports show `experimental 练习观察` plus the
  experimental mastery blocker instead of `阶段` / `下一层` / `阶段分`, so scoring
  feedback does not imply formal non-English mastery.
- Russian final-devoicing wording is now aligned across the course card, AI
  coach rules, and source-alignment summaries: final voiced obstruents devoice
  before pauses or voiceless consonants, but connected speech before voiced
  consonants, sonorants, or vowels must be treated as connected-speech
  realization rather than isolated word-final devoicing.
- French and Russian language-pack manifest IPA metadata now matches the same
  applied reviewed findings as the course/audit corpus for `l'homme écoute`,
  `l'école ouvre`, `друг дома`, `город большой`, `нож острый`, `снег идёт`,
  `класс большой`, and `хлеб на кухне`. The static audio-pack asset test guards
  those rows and also confirms `поезд идёт` stays on its `needs-review` IPA.
- `desktop:ui-smoke` now includes both `narrowViewport=ok` and
  `lowHeightViewport=ok`, covering Settings, long rule detail pages, drill, free
  practice, and diagnosis from the Release EXE. The narrow and low-height detail
  passes also require scoring-breakdown placeholder/IPA-reference readiness.
- Formal mastery recording is English-only. Non-English free practice and
  advanced drill pages may score and provide feedback, but they should not write
  formal mastery/evidenceMastery while the languages remain experimental.
  Direct English advanced pack-runner routes now show the
  `pack-runner-experimental-blocker` page for Spanish/French/Russian instead of
  loading English pack content in an experimental-language context. HVPT
  perception writes and any remaining formal mastery writes are gated by
  `canRecordFormalMastery(languageId)`.
- Direct progress-archive access is language-gated too: English still shows the
  formal archive, while Spanish/French/Russian show
  `progress-experimental-blocker` instead of English mastery archive metrics or
  stage wording. The blocker path also avoids loading the formal mastery profile
  or benchmark archive data for experimental languages.
- Recording startup failures now surface actionable Chinese messages instead of
  a generic permission prompt: denied permission, missing microphone, busy
  device, unsupported recorder runtime, and generic startup failure are
  separated. Word and sentence drill recording cards render `recorderError`
  inline, so a failed microphone start is visible to the learner instead of
  leaving the drill card in a quiet idle state.
- First-run microphone readiness failures now show actionable Chinese hints in
  the readiness checklist. Unsupported microphone checking, denied permission,
  low input signal, and too-short samples no longer rely on English exceptions
  or a short status label alone.
- Azure Speech connection, assessment, and transcription failures now surface
  Chinese action messages instead of raw English service errors. The client
  separates no-speech recordings, key/region auth mismatch, unreachable
  network/proxy, timeout, quota/rate-limit, service failures, and empty
  transcription responses before those errors reach phoneme detail, assessment,
  sentences, or drill UI.
- AI coach LLM connection tests and stream failures now surface Chinese action
  messages for auth mismatch, invalid provider/model/base URL, network/proxy,
  timeout, quota/rate-limit, service failure, and desktop endpoint-policy
  blocks. `useLlmFeedback` now handles `data: {"error": ...}` SSE chunks, so a
  provider failure no longer finishes silently with no feedback and no visible
  error.
- ElevenLabs and online dictionary audio failures now surface Chinese action
  messages. Standard-demo TTS separates missing configuration, invalid key,
  unavailable voice/model, network/proxy, timeout, quota/rate-limit, service
  failure, and too-long text. English online dictionary fallback separates empty
  text, too-long text, missing dictionary entry, network failure, timeout,
  rate-limit, and provider outage while keeping bundled local audio as the
  first-choice path.
- Settings connection-test status now preserves actionable Chinese provider
  messages for Azure, ElevenLabs, AI coach, and Youdao, replaces raw English
  fetch failures with Chinese network/proxy guidance, and wraps long status
  messages in narrow Settings layouts.
- Non-English detail A/B playback labels now match the task type. Rule,
  phrase, and sentence practice no longer expose a word-only "播放单词发音"
  accessible label; long Russian Cyrillic rule sentences remain centered,
  wrap-ready, and untruncated.

## Latest Verification

The latest settled-main command results are centralized in
`docs/operations/RC_EVIDENCE_AUDIT.md` so README, installation notes, and this
handoff do not drift apart.

Current gate summary:

- Focused AI-coach trust tests passed: `3` files and `20` tests, including the
  non-English full-score guard against `完美` / `已掌握` overclaims.
- Focused advanced-training boundary tests passed: `2` files and `7` tests,
  including direct English pack-route blocking for experimental languages.
- Focused progress-archive boundary tests passed: `3` files and `13` tests,
  including the direct `/progress` experimental blocker and updated Release
  smoke route coverage.
- Open-source handoff/readiness plus IPA audit export drift tests passed.
- Static language-pack manifest IPA drift tests passed for the applied French
  and Russian reviewed findings.
- Focused recorder-startup tests passed: `2` files and `11` tests, covering
  actionable microphone error messages, stream cleanup after recorder
  initialization failure, and visible drill-card errors.
- Focused desktop-readiness microphone tests passed: `2` files and `8` tests,
  covering low-signal/too-short Chinese errors plus unsupported and denied
  microphone-check checklist hints.
- Focused Azure failure-message tests passed: `1` file and `10` tests, covering
  Chinese auth, network, no-speech, NoMatch, and empty-transcription errors.
- Focused LLM failure-message tests passed: `3` files and `20` tests, covering
  Chinese Settings connection errors, stream provider/network errors, and
  visible `useLlmFeedback` error handling for SSE error chunks.
- Focused audio failure-message tests passed: `3` files and `23` tests,
  covering Chinese ElevenLabs connection/TTS errors, no-provider standard-demo
  guidance, and online dictionary fallback failure reasons.
- Focused Settings connection-status tests passed: `2` files and `8` tests,
  covering Azure, ElevenLabs, AI coach, Youdao, raw English fetch fallback, and
  long status wrapping.
- Focused phoneme detail presentation tests passed: `2` files and `9` tests,
  covering non-English full text visibility, Russian long Cyrillic rule text,
  and task-accurate A/B playback labels.
- Full tests passed: `100` files and `557` tests.
- Typecheck, lint (`357` files checked), and static desktop frontend build
  passed.
- Release EXE build passed and rebuilt EXE, MSI, and NSIS artifacts.
- Release EXE preflight passed; no localhost startup is part of the release
  path. During the pre-commit verification run it correctly reported the
  expected dirty worktree from this local fix.
- Release EXE UI smoke passed with `scoringTileAudioPolicy=ok`,
  `practiceAudioLabels=ok`, `freePracticeSmoke=ok`, `assessmentSmoke=ok`,
  `narrowViewport=ok`, `lowHeightViewport=ok`, and
  `releaseServedFromDevServer=false`; the smoke script now includes `/progress`
  in the main, narrow-window, and low-height route passes, `/sentences` waits
  for the actual free-practice page plus input/recording cards, and
  `/assessment` waits for the intro card plus start/passage actions instead of
  only checking the page container.
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
