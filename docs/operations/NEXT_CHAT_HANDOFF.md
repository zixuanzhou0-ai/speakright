# Next Chat Handoff

Date: 2026-06-17

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
- The PR template now also requires IPA/pronunciation disputes, audio gaps,
  paid-provider/quota requests, and security/private-data concerns to link to
  the matching issue or private-report route instead of being buried in release
  evidence.
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
- French diagnostic coverage no longer repeats `petit` for both schwa and
  final-consonant silence. Final-consonant silence now uses `trop /tʁo/`, and
  the content audit rejects duplicate non-English reading targets inside one
  sound unit or one diagnostic/contrast/sentence deck section.
- French now includes `fr-phrase-final-prominence` as an experimental
  sentence/prosody unit for rhythmic-group final prominence. It is deliberately
  score/rule guidance only: no Azure single-phoneme alias and no clickable
  header/scoring tile audio until exact sentence-rhythm evidence exists.
- The Russian final-devoicing local asset note is now explicitly marked as a
  proxy anchor and points maintainers to current `Нож тупой /noʂ tʊˈpoj/`
  practice instead of stale `current example друг` wording.
- `audio:parity:dry-run` now reports explicit experimental audio gaps without
  generating audio: Spanish `880` existing / `214` missing, French `1090`
  existing / `392` missing, Russian `918` existing / `466` missing, total
  missing `1072`, estimated `9772` characters. Do not generate ElevenLabs audio
  unless the maintainer explicitly confirms after reviewing that dry-run.
- Language-pack audio manifests now keep their IPA metadata aligned with the
  sourced reviewed findings for applied French connected-speech rows and Russian
  connected-speech voicing rows. The Russian `поезд идёт` manifest entry remains
  unchanged because that row is still `needs-review`.
- Open-source readiness tests also lock the public developer/release npm
  scripts, including `test`, `typecheck`, `lint`, `desktop:preflight`,
  `desktop:launch-release`, dry-run audio audits, and the public release gate.
  Routine validation scripts are checked so they do not call audio generation.
- `desktop:launch-release` has its own Release-process guard. On Windows it
  refuses to open a second `speakright.exe`, prints the running PID list, and on
  normal launch prints a visible launch request, Release EXE path, child PID,
  and no-localhost reminder before detaching the app process.
- `desktop:preflight` and `desktop:launch-release` now also compare the packaged
  Release EXE against the static export in `out/`. If `out/` is newer, they stop
  and ask for `npm run desktop:build` so a stale EXE cannot pass Release
  validation after a frontend-only build.
- Drill feedback action buttons now wrap and stay centered after three failed
  attempts, so the `再听一遍` / `跳过此词` controls do not force horizontal
  overflow in narrow windows.
- Drill completion summaries now render weak-item text and IPA in a wrap-safe
  grid, so long multilingual phrases do not crowd the score column.
- Diagnosis-report action buttons now wrap as well; long prescription CTA titles
  such as `开始：...` keep `whitespace-normal`, `break-words`, and centered text.
- Diagnosis reports now render every generated `rawEvidence` row and every
  `errorPatternId` badge instead of showing only the first 8 evidence rows or
  first 2 pattern IDs; `assessment-report-evidence-row` guards the evidence list.
- Training Evidence now renders every generated evidence card, pattern, and
  remediation row instead of only the first 8 / 6 / 6 items; the page exposes
  `evidence-card-row`, `evidence-pattern-row`, and `evidence-remediation-row`.
- Free-practice input/listen controls now use a wrapping action row with a
  readable textarea minimum width; the word-mode icon button also has the
  explicit `播放单词发音` accessible label.
- Free-practice page header, clear-session action, session-storage warning, and
  transfer-evidence status/score badges now use wrap-safe classes so long state
  text does not force horizontal overflow in narrow windows.
- Phoneme detail session-storage, recorder, Azure, local-save, chart-audio, and
  word-audio warnings now also use break-word/overflow-wrap classes so long
  Chinese recovery text stays inside the practice card.
- Free-practice target preview pack badges now wrap long training-pack titles,
  so suggested or matched practice targets do not inherit the base badge nowrap
  behavior.
- Free-practice transfer evidence now preserves and displays every matched
  target word in a wrap-safe centered line; `free-practice-transfer.ts` and
  `SentenceResultsColumn` tests reject the old first-six-word display.
- Free-practice suggestion cards now render every suggested target word instead
  of only the first four, and the preview builder now preserves the full
  generated suggestion-word list instead of cutting it off before UI rendering;
  `free-practice-suggestion-word` and static smoke tests reject the old
  source/UI suggestion-word caps.
- The `/drill` landing page now stacks its header actions on narrow windows and
  uses wrap-safe classes for top CTA buttons, status badges, today-plan badges,
  training-memory badges, and training-pack metadata badges.
- The non-English `/drill` landing page now exposes
  `drill-experimental-boundary-warning` as a visible `role="status"` warning
  and Release EXE smoke verifies that it says experimental practice does not
  generate formal mastery or use whole-word scores as fake mastery evidence.
- Full-passage diagnosis badges for target packs, feature labels, evidence
  words, and benchmark deltas now use the same wrap-safe badge treatment.
- Quick assessment action buttons and full-passage diagnosis segment text now
  use wrap-safe classes too, including intro/retry/submit buttons, segment
  focus/cue copy, segment titles, and the main passage prompt.
- Full-passage stage retest comparison now shows every score dimension delta
  under `各维度变化` instead of hiding the lower-magnitude dimensions behind a
  top-three UI cap.
- Scenario and spontaneous transfer pages now also wrap scenario kind/status
  badges, score badges, demo/template buttons, processing copy, and retry
  actions so advanced transfer tasks keep controls visible in narrow windows.
- Spontaneous transfer now shows every current review/active target pack badge
  instead of only the first three; `spontaneous-target-pack-badge` and the
  page-rendering test lock the complete target-pack list.
- Settings provider action rows now use wrap-safe save/test buttons for Azure,
  ElevenLabs, AI coach, and pronunciation fallback checks, so narrow Settings
  layouts do not inherit one-line button defaults.
- Settings language cards now render the full `missingCapabilities` list for
  each language instead of showing only the first three items followed by an
  ellipsis; the static smoke guard rejects `missingPreview` and `…` in that
  component.
- Experimental-language module gates now render the full
  `missingCapabilities` and `knownGaps` lists instead of only the first three
  items, so learners see the complete reason a module is still gated.
- Audio/provider issue, PR, SUPPORT, CONTRIBUTING, and README guidance now
  require provider-quota requests to include zero-generation dry-run evidence or
  a clear not-applicable reason, expected text/audio scope, and explicit
  maintainer approval before any ElevenLabs or paid-provider work.
- Contrast-drill set cards now show every preview word pair in a wrap-safe list
  instead of only the first pair followed by `...`; the component and desktop
  static smoke tests lock the full preview.
- Release status and language availability cards now wrap version/channel
  badges, release links, build facts, language status badges, detail text, and
  recommendations without losing desktop external-link behavior.
- ElevenLabs voice/model selects now use wrap-safe trigger/value/item text, and
  Release EXE smoke checks `tts-voice-select` plus `tts-model-select` so long
  model labels do not fall back to one-line clipping in Settings.
- Shared `Badge` now defaults to a wrap-safe, max-width-bounded label with an
  explicit `data-slot="badge"` hook; Settings Release EXE smoke checks visible
  badges at runtime so future status labels do not silently return to nowrap.
- Shared `Button` now defaults text buttons to centered, wrap-safe labels with
  `min-h-*` sizing; fixed square icon variants still use `size-*`. Settings
  Release EXE smoke checks visible text buttons at runtime.
- Advanced pack-runner badges for intro metadata, course-map status, course
  header, level titles, remediation, and debrief next-level labels now also use
  wrap-safe badge classes.
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

- The Release launch script is now self-contained: even if a maintainer skips
  `desktop:preflight`, `desktop:launch-release` refuses stale static-export
  packages and duplicate `speakright.exe` processes, reports PIDs, and writes
  visible terminal status before detaching the Release process so the command
  does not look like a blank no-op.
- Non-English practice cards now prioritize the text the user must read.
  Words, phrases, and sentences should be visible in full instead of using
  ellipsis.
- Drill teaching cards now render every bundled keyword/example for the current
  sound unit instead of the first six only, and label the section as `示例文本`
  so phrase, sentence, and rule units are not described as single-word examples.
- Drill landing review cards, today-prescription cards, and training-memory
  weakness cards now render every item from their already bounded source lists,
  instead of re-capping the page to the first two review tasks or first three
  active weaknesses.
- Advanced transfer practice now keeps generated practice targets visible:
  `/drill/scenarios` renders every `plan.targetWords` badge, and
  `/drill/prosody` renders every `exercise.weakWords` badge instead of applying
  extra page-level caps.
- Diagnosis reports now render every generated issue card from the bounded
  diagnosis-engine issue list instead of showing only the first three; the
  section is labeled `学习处方与补测` rather than `Top 3`. Each issue card also
  renders every bounded evidence snippet from `issue.evidence`, not only the
  first row.
- Practice target text and IPA are not only visually wrapped but also enforced
  as centered at runtime. `desktop:ui-smoke` now checks computed
  `text-align: center` on detail-page reading targets.
- The shared target-text presentation tests now also lock long Cyrillic rule
  text and all centered target-text class helpers against `truncate`,
  `line-clamp`, and `whitespace-nowrap` regressions.
- Non-English rule/prosody units use Chinese labels such as `规则训练 · 音节节奏`
  rather than raw English rule names like `syllable timing`.
- When a sound unit has no precise local teaching video, the fallback reference
  panel now renders every external teaching resource from `resources`, not only
  the first three. The card hook is `video-fallback-resource-card`; local
  teaching lessons still take priority over external fallback cards.
- Header speaker buttons should appear only when there is real local target
  audio. If no local target audio exists, do not show a speaker icon that jumps
  to an external page. The `PhonemePlayButton` component now enforces this too:
  external-only references and browser-TTS fallback audio render no header
  speaker. Verified header speakers also expose `data-audio-*` metadata so
  Release EXE smoke can compare the detail header clip against right-side
  scoring tiles.
- Detail-page practice speakers now render `wordAudio.error` inline under the
  word/phrase/sentence controls. Missing non-English local pack audio and
  English online dictionary fallback failures should be visible to learners
  instead of looking like a no-op.
- Free-practice word mode now also renders `wordAudio.error` inline under the
  input/listen controls and clears stale word-audio errors when the learner
  changes text or clears the session.
- Free-practice word-mode help text is language-aware: English can still say
  local audio first with Youdao fallback, while Spanish/French/Russian say local
  language-pack audio first and explicitly warn that missing local entries will
  not be replaced by online audio pretending to be exact local audio.
- Free-practice sentence TTS, microphone/recorder, Azure assessment, and missing
  AI coach LLM configuration failures now render visible Chinese inline alerts.
  The smoke/test hooks are `free-practice-tts-error`,
  `free-practice-recorder-error`, and `free-practice-assess-error`; the LLM
  missing-config message tells learners the Azure numeric score was retained.
- Settings usage monitor now shows an explicit first-run ElevenLabs empty state:
  sentence/phrase demos need an API Key, while local word audio and built-in
  language-pack audio can still be used.
- Settings data/privacy center now keeps export, diagnostics, delete, and reset
  results visible inline. Storage/keychain/IndexedDB/quota/permission failures
  are converted to Chinese recovery messages with `role="alert"` instead of
  relying only on a short toast.
- Settings data/privacy center also fails soft when the local data summary
  cannot be read. It shows a Chinese `data-control-summary-warning` and keeps
  the diagnostic export plus `重置本机数据` controls visible.
- Settings data/privacy center also shows quarantined corrupt local data as a
  visible Chinese `role="alert"` with guidance to export learning data or a
  diagnostics bundle before using `重置本机数据`; the alert notes that API keys
  are not deleted by default.
- Desktop diagnostics bundles are now schema v2 and include a privacy-safe
  quarantined-data summary (`key`, `reason`, `detectedAt`, `schemaVersion`,
  `rawCharacters`) while still excluding raw quarantined local data values.
- Startup local-data migration now fails soft: if local storage/quarantine work
  throws during `KeyHydrator`, the app shows a fixed Chinese warning and still
  continues API key hydration instead of letting the startup effect abort.
- Theme preference persistence is now best-effort: blocked or invalid
  `localStorage` falls back to the system theme without blanking the shell, and
  live theme toggles still update the current window even if persistence fails.
- Phoneme detail, free practice, and word/sentence drill scoring now treat local
  score-trend/practice-history/mastery-transfer writes as best-effort but
  visible: if localStorage is full or blocked, the score result and feedback
  flow still continue, and the practice surface shows a Chinese `role="alert"`
  warning that local trend/history or transfer evidence was not saved.
- Free practice and phoneme detail now also surface temporary `sessionStorage`
  failures. If page-level text, selected word, score, or AI-feedback state
  cannot be saved/restored for navigation, the current practice still continues,
  but the page shows `free-practice-session-storage-warning` or
  `phoneme-session-storage-warning` with Chinese reset/export guidance.
- Advanced English training surfaces now follow the same visible local-save
  policy for mastery/profile writes: pack-runner completion, HVPT perception,
  prosody, scenario transfer, and spontaneous transfer keep the completed result
  visible but show a Chinese `role="alert"` if local mastery, review queue, or
  transfer evidence could not be saved.
- Quick diagnosis and full-passage diagnosis now also treat local report history
  and coverage benchmark saves as best-effort: the generated report stays
  visible, and blocked localStorage writes or retake/delete failures show a
  Chinese `role="alert"` instead of interrupting the flow.
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
  without touching experimental-language mastery. The Progress page now renders
  every locally retained training session and shows the retained count instead
  of applying a second six-row UI cap on top of the mastery-profile storage
  limit.
- Perception ABX focused-review and completion action rows now wrap instead of
  forcing all result buttons onto one narrow-window row. Release EXE smoke also
  covers `/drill/perception` in main, narrow, and low-height route passes under
  an experimental-language context, where it must show the blocker instead of
  loading English-only HVPT material.
- English scenario/spontaneous transfer pages now have page/prompt/recording
  smoke hooks and wrap-ready page headers. Release EXE smoke opens
  `/drill/scenarios` and `/drill/spontaneous` in English context during main,
  narrow, and low-height passes and checks their prompt/recording cards plus
  horizontal overflow.
- The final `desktop:ui-smoke` summary now builds its `routes=` field from
  `smokeSummaryRoutes`, so `/drill/scenarios` and `/drill/spontaneous` appear
  in the human-readable output instead of being hidden behind only
  `englishTransferRoutes=ok`.
- English word/sentence/contrast drill routes now have page/config smoke hooks
  and wrap-ready page headers. Release EXE smoke opens `/drill/word`,
  `/drill/sentence`, and `/drill/contrast` in English context during main,
  narrow, and low-height passes and checks the initial config cards plus
  horizontal overflow.
- Full-passage diagnosis and training evidence are now protected as English
  advanced/formal-evidence surfaces. Direct `/assessment/passage` and
  `/drill/evidence` access under Spanish/French/Russian shows experimental
  blockers instead of loading English coverage passages, English training-pack
  evidence, or formal mastery archives; English direct routes keep page hooks
  and wrap-ready headers for Release smoke.
- Corrupt English mastery profile storage now falls back to a temporary empty
  profile with a visible Chinese recovery alert instead of silently showing a
  blank archive. `/progress` and `/drill/evidence` show the alert; corrupt
  full-passage diagnosis history on `/assessment/passage` is ignored with a
  Chinese alert, and retaking or saving a valid report clears the stale warning.
  Release EXE smoke seeds corrupt localStorage and expects
  `corruptLocalDataWarnings=ok`.
- Corrupt `/drill` diagnosis-report storage now follows that same visible
  recovery standard. The `/drill` home page falls back to the not-yet-diagnosed
  plan and shows `drill-report-storage-warning` with Chinese reset/export
  guidance instead of silently treating a broken report as missing.
- Corrupt quick diagnosis report storage now also shows a visible recovery
  warning. `/assessment` falls back to the intro state and renders
  `assessment-storage-warning` for unreadable current or legacy reports, with
  Chinese reset/export guidance instead of silently hiding the broken history.
- English training-pack direct routes now have page/intro/course-map smoke hooks
  and wrap-ready headers. Release EXE smoke opens `/drill/pack/ee-ih` in English
  and checks French direct access shows `pack-runner-experimental-blocker`
  instead of English pack content.
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
  single-phoneme playback sources. `desktop:ui-smoke` now verifies at runtime
  that a playable scoring tile matches the detail header speaker by
  `data-audio-kind`, `data-audio-src`, `data-audio-start-ms`,
  `data-audio-max-duration-ms`, and `data-audio-fade-out-ms`.
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
- Header/scoring single-sound playback policy now requires local `/audio/`
  paths. If a future source mistakenly puts an external URL into `localSrc`,
  the detail/list speaker and scoring tile stay hidden or unclickable instead
  of treating that URL as verified single-sound audio.
- English chart-word header speakers now also require a simple local filename
  stem before constructing `/audio/ipa/phoneme/{stem}.mp3`; path fragments,
  query strings, extensions, spaces, or non-phoneme stems keep the speaker
  hidden instead of accidentally producing a clickable fake single-sound source.
  The English resource layer and list-card IPA/illustration handlers reuse the
  same known chart-audio stem guard, so future consumers do not receive or play
  hand-built unsafe chart audio paths.
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
- Russian now exposes the first standalone hard/soft coronal stop, sibilant,
  sonorant, labial, and velar pair anchors: `ru-t-tj`, `ru-d-dj`,
  `ru-s-sj`, `ru-z-zj`, `ru-n-nj`, `ru-l-lj`, `ru-r-rj`, `ru-p-pj`,
  `ru-b-bj`, `ru-m-mj`, `ru-f-fj`, `ru-v-vj`, `ru-k-kj`, `ru-g-gj`,
  and `ru-x-xj`. They are source-backed score-only contrast units with
  diagnostic, contrast, and sentence deck coverage; they intentionally have no
  clickable single-segment audio until verified short local header clips are
  added.
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
- Recording waveform rendering now fails soft. If live waveform setup cannot
  create a Web Audio context, or if the saved recording waveform cannot load,
  the shared `WaveformDisplay` shows a Chinese `waveform-display-warning`
  status while keeping the recording usable for replay, re-recording, or
  scoring.
- Blocking recording-quality checks now use standard alert semantics. The shared
  `RecordingQualityPanel` renders `data-smoke="recording-quality-panel"` and
  uses `role="alert"` when a recording is too short, silent, unreadable, or
  otherwise cannot be submitted; submit-ready quality feedback remains
  `role="status"`.
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

Current gate summary is intentionally compact here:

- Current command-by-command results, including exact test counts, live in
  `docs/operations/RC_EVIDENCE_AUDIT.md`.
- The routine gate remains `npm.cmd run test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, `npm.cmd run build:desktop-frontend`,
  `npm.cmd run desktop:build`, `npm.cmd run desktop:preflight`,
  `npm.cmd run desktop:ui-smoke`, and `npm.cmd run desktop:launch-release`.
- Focused suites cover open-source governance, no-secret scans, source-build
  docs, IPA audit exports, centered/wrapping target text, failure-state Chinese
  alerts, experimental-language blockers, audio-source policy, and local-save
  warnings.
- Release EXE smoke covers Settings, English, Spanish, French, Russian, drill,
  free practice, diagnosis, progress, narrow-window layout, low-height layout,
  scoring tile audio policy, detail-header/scoring-tile source parity, corrupt
  local-data warnings, and confirms `releaseServedFromDevServer=false`.
- Release EXE launch opens the static Tauri bundle and the verification process
  should be closed afterward.
- No ElevenLabs generation or TTS spend is part of this validation path.

For the next manual test session, start with:

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
  It now contains the final expanded UI corpus with `2641` rows: Spanish `732`,
  French `935`, Russian `974`. The earlier `988`-row file covered only base
  sound-unit arrays.
- The audit input is now reproducible with `npm.cmd run ipa:audit:export`.
  Rows include `auditRole`: `ipa-transcription` for real IPA rows and
  `deck-focus-hint` for `language-learning-decks` sentence `ipaHint` rows. The
  current export contains `2641` total rows and marks `36` deck focus
  hints so GPT Research does not mistake compact cues such as `/s sʲ zʲ/` for
  complete sentence IPA. Recent source-synced rows also replaced generic
  `elision + nasal vowels` / `clusters` sentence labels with full IPA for
  `J’aime le bon vin blanc.`, `Здравствуйте, студент.`, and
  `Текст простой, но группа большая.`.
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
- Spanish stop-position anchors now exist as `es-b-stop`, `es-d-stop`, and
  `es-g-stop`. Plain `/b d g/` scoring aliases point to those score-only
  phoneme anchors, while `[β ð ɣ]` stay on `es-bv`, `es-d`, and `es-g` with the
  existing exact realization clips. Do not map plain stops to the realization
  clips unless exact stop-position header clips are added later.
- Remaining audit work: continue from the new `2641`-row final UI corpus and
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
- 西语/法语/俄语音标练习里是否还有省略号、文本看不全、排版丑、按钮重叠。
- 音标练习只应显示真实单音、实现音、对比或可独立练习的发音单位；西语词重音/音节节奏、法语 liaison/enchainement/elision/词尾静音/短语韵律、俄语弱化/清化/同化/辅音丛等规则内容不要作为音标卡片出现。
- 直接打开旧规则 URL 时，应显示中文说明：“该内容属于规则/短语训练，不属于单音标练习”，不能出现小喇叭、录音区或发音拆解伪界面。
- 词、短语、句子必须完整可见，用户能照着复述。
- 修完后跑对应测试、typecheck、lint，并用 Release EXE 复查。

最终请汇报：改了哪些文件、跑了哪些命令、测试结果、还有哪些限制。
```
