# Desktop Startup Runbook

Last verified: 2026-06-14

This repository is the current SpeakRight Desktop workspace:

```bat
E:\SpeakRightDesktopRepo
```

Do not use the older browser workspace or an `apps\desktop` path when testing the
current desktop app. If Microsoft Edge shows `localhost refused`, that is not the
desktop app by itself; it usually means a browser tab is pointed at a dev URL
while the dev server is not running.

## Start Next Chat

For user testing and release acceptance, start the static Release EXE. This is
the same runtime shape as the packaged desktop app and does not depend on
`localhost` or the Next dev server.

1. Read the current handoff before changing code:

```bat
cd /d E:\SpeakRightDesktopRepo
type docs\operations\NEXT_CHAT_HANDOFF.md
type docs\operations\RC_EVIDENCE_AUDIT.md
```

2. Confirm the repository and current worktree state:

```bat
cd /d E:\SpeakRightDesktopRepo
git status --short --branch
npm run desktop:preflight
```

Expected result for a fully settled release branch:

```text
## main...origin/main
Desktop preflight passed.
```

Recent settled handoffs may instead show `main...origin/main [ahead N]` after a
GitHub Git Data API push fallback. In that case, compare the GitHub `main` ref
and the local-vs-remote tree SHA before assuming content is unpushed. Do not use
`git reset` only to make the local tracking ref look tidy.

If `git status` shows local edits, preserve them unless the user explicitly asks
to discard them. Treat the current handoff as the source of truth and continue
the work rather than cleaning it for cosmetic reasons.

3. Start the already-built Release EXE:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:launch-release
```

4. Use the app window that opens from Tauri. Do not use a browser tab pointed at
   `localhost`.

5. Begin manual QA with this order:

- Settings: confirm language switch, Azure, ElevenLabs, LLM, data/privacy, and
  release info are visible; data/privacy export, diagnostics, delete, and reset
  operations should keep success or failure visible inline in Chinese rather
  than relying only on a short toast. For Spanish/French/Russian, the language
  availability card should show local-pack `检查中` while it reads bundled
  resources, then either the bundled item count or a Chinese `缺失或不可读`
  reinstall/Release EXE feedback hint.
- English: open phoneme list, then five phoneme detail pages; play target sound,
  example word, record, replay the recording, and score once.
- Spanish, French, and Russian: switch each language, open the sound-unit list,
  then three detail pages; play target sound, example word, video, record,
  replay the recording, and score once.
- Drill, free practice, and diagnosis: check that missing/low evidence never
  presents a confident perfect diagnosis for experimental languages.

If the release executable is missing or you intentionally need fresh artifacts,
build and launch it in one step:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:preflight:build
npm run desktop:run-release
```

On Windows, `desktop:build` and `desktop:run-release` go through
`scripts/desktop-build.mjs`, which defaults `CARGO_BUILD_JOBS=1` when the
variable is not already set. This keeps Rust/LLVM release builds less likely to
hit workstation memory spikes while still allowing CI or developers to opt into
more parallelism explicitly.

Before rebuilding release artifacts, close any currently running SpeakRight
window. On Windows, a running `speakright.exe` locks the executable and Tauri
cannot overwrite it during `npm run desktop:build` or `npm run validate:desktop`.
`desktop:preflight` and `desktop:preflight:build` report this condition and then
stop; they do not automatically close the user's app window. If needed, close
the window from the taskbar or stop the `speakright` process before starting the
build.

Expected process after startup:

- `speakright.exe`

The desktop window should open through Tauri. A browser tab at
`http://localhost:3002` is only a dev frontend view and should not be treated as
the installed or release desktop app.

## If The Window Shows Localhost Refused

1. Confirm the command was run from `E:\SpeakRightDesktopRepo`.
2. Close stale browser tabs that show `localhost refused`.
3. Start the release app, not the browser tab:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:launch-release
```

If the release app itself is missing, use `npm run desktop:run-release`.

## Dev Mode Is Debug-Only

Use dev mode only when actively debugging code changes:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:dev
```

Dev mode runs `next dev --turbopack --port 3002` and can spend a long time on
`compiling...` after large multilingual asset or route changes. Do not use it as
the release-readiness or user-testing entrypoint.

## Current Resource Boundary

- English word-card audio is bundled in `public/audio/words/` with `blue` and
  `pink` voice variants; Youdao is only the online fallback.
- Spanish, French, and Russian word/phrase audio is bundled in
  `public/audio/language-packs/` with `blue` and `pink` voice variants.
- Spanish, French, and Russian audio density is now tracked by
  `npm run audio:parity:dry-run`; the target is 24 practice items per sound
  unit with two local voice files per item, and the latest report has no missing
  language-pack audio.
- Multilingual audio packs are not installed from Settings anymore.
- Local articulation/video assets live under `public/videos/language-assets/`.
- API keys are not stored in Git and are excluded from learning-data export.

## Validation Before Ending A Session

Use this short validation set after UI/content work:

```bat
npm run test
npm run typecheck
npm run lint
npm run build:desktop-frontend
npm run desktop:preflight
npm run desktop:ui-smoke
```

Use this full controlled-internal release gate before publishing internal-test
installers:

```bat
npm run validate:internal-release
```

Run the live pronunciation/resource gate when checking multilingual readiness:

```bat
npm run desktop:live-validation
```

This command validates bundled audio/video paths and a high-coverage Azure
sample. It queries ElevenLabs usage but does not generate audio in the normal
release checklist.

Run the non-English audio-density dry-run before deciding whether to generate
new language-pack audio:

```bat
npm run audio:parity:dry-run
```

The dry-run writes `src-tauri\target\audio-parity\gap-report.json`, checks
Spanish/French/Russian audio coverage, and makes zero ElevenLabs API calls.

Run the local A/B loudness dry-run after playback-gain changes:

```bat
npm run audio:loudness:dry-run
```

The loudness dry-run uses local ffmpeg `volumedetect` on representative teaching
videos, bundled A/B word audio, and IPA chart normal/slow word audio, writes
`src-tauri\target\audio-loudness\report.json`, and makes zero ElevenLabs API
calls.

Use `desktop:ui-smoke` for release-window page coverage. It opens Settings,
English, Spanish, French, Russian, drill, free practice, and diagnosis routes,
checks that the runtime is not `localhost`, and avoids recording, Azure live
scoring, and ElevenLabs TTS generation. It also checks detail-page reading
targets for centered text, no ellipsis/nowrap, no practice-button overlap,
expected header-audio visibility/clickability readiness, wrapping video selector labels plus selector
no-overlap/no-overflow runtime checks, Settings/usage long-text wrapping,
Settings pronunciation-test row wrapping/no-overlap runtime checks, A/B voice
selector and word-audio button visibility/clickability/label runtime checks,
scoring-breakdown visibility/readability/no-overflow runtime checks, scoring
tile short-audio policy checks, and a narrow desktop window plus low-height
window pass that also check scoring-breakdown readiness.

Do not run ElevenLabs TTS smoke or audio generation scripts during routine
startup or manual QA. If bundled audio is missing, record the missing item first
and ask for confirmation before generating replacement audio.

Use the public release gate only after Windows code signing is configured:

```bat
npm run validate:public-release
```

Unsigned artifacts are acceptable for controlled internal testing only when the
release notes and installation guide keep the unsigned warning visible.

## 2026-06-10 Handoff Notes

- English remains the stable baseline.
- `es-ES`, `fr-FR`, and `ru-RU` remain experimental; `evidenceMastery` is still
  disabled for these languages.
- The Settings language-pack installer UI has been removed because multilingual
  audio is bundled.
- The phoneme sidebar uses compact rows for English and two-line wrapping rows
  for non-English sound units to avoid overlapping long rule labels.
- Spanish Sounds of Speech videos use original-ratio sizing with small side
  previous/next controls.
- `desktop:artifact-smoke` scans source policy and static artifacts for retired
  pronunciation sources while ignoring build directories such as `target`,
  `.next`, and `out`.
- Manual testing should start from `npm run desktop:launch-release` or
  `npm run desktop:run-release`, not `npm run desktop:dev`.
- No real API key was found in the repository during the final secret scan.

## 2026-06-10 Stabilization Result

- GitHub Actions passed for pushed commit `78118e9`.
- A clean rebuild was done after removing the old `src-tauri\target` directory.
- `npm.cmd run validate:desktop` passed after the clean rebuild.
- `npm.cmd run validate:release` ran through desktop validation and failed only
  at the public release gate because EXE/MSI/NSIS artifacts are unsigned.
- Current public-release blocker remains Windows code signing; controlled
  internal testing may continue with the unsigned warning visible.

## 2026-06-11 Release-Validation Result

- Current validation update: commit `94be1d4` (`chore: tighten desktop release
  validation`).
- `npm.cmd run test`: 72 test files and 363 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed; Biome checked 308 files.
- `npm.cmd run build:desktop-frontend`: passed; 144 static pages generated.
- `npm.cmd run desktop:live-validation`: passed.
- First `npm.cmd run validate:desktop` attempt found a real process-lock issue:
  an already-running `speakright.exe` prevented Tauri from overwriting the
  release executable. After closing the release process, the full validation
  passed.
- Bundled audio validated: English `1464/1464`, Spanish `398/398`, French
  `509/509`, Russian `407/407`.
- Bundled videos validated: `210/210`.
- Azure live pronunciation-assessment sample: `220/220` passed.
- ElevenLabs usage was checked before and after validation; no TTS smoke was run
  and estimated generated characters used were `0`.
- Keep using `npm run desktop:launch-release` for tomorrow's manual testing;
  dev mode remains debug-only.

## 2026-06-11 Preflight/UI-Smoke Hardening Result

- Added `npm run desktop:preflight`; it detected an already-running
  `speakright.exe` process during validation and failed with an actionable
  "close the app first" message instead of silently killing the window.
- Added `npm run desktop:ui-smoke`; it launched the Release EXE and verified
  Settings, English `/phonemes/ee`, Spanish `/phonemes/es-a`, French
  `/phonemes/fr-i`, Russian `/phonemes/ru-a`, drill, free practice, and
  diagnosis from the Tauri runtime.
- Added docs-only GitHub Actions path filtering: README/docs-only changes use
  the lightweight Docs Check workflow; code/resource/Tauri/package changes still
  run the Windows desktop build.
- Non-English diagnosis now withholds trusted overall scores for silence, too
  few word-level items, target-text mismatch, missing phoneme alignment, invalid
  recordings, or partial/low-evidence readings.
- Validation results after the fixes:
  - `npm.cmd run test`: 74 files and 374 tests passed.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed; Biome checked 312 files.
  - `npm.cmd run build:desktop-frontend`: passed; 144 static pages generated.
  - `npm.cmd run desktop:preflight`: passed after closing the stale release
    process.
  - `npm.cmd run desktop:ui-smoke`: passed, not served from `localhost`.
  - `npm.cmd run desktop:live-validation`: passed; English `1464`, Spanish
    `398`, French `509`, Russian `407`, videos `210`, Azure `220/220`,
    ElevenLabs generated characters `0`.
  - `npm.cmd run validate:desktop`: passed.
- `npm.cmd run desktop:release-gate`: failed only because EXE/MSI/NSIS
    artifacts are unsigned, which remains the public-release blocker.

## 2026-06-12 First Task

- Start with `npm run desktop:preflight`, then `npm run desktop:launch-release`.
- If the window does not appear, check for an existing `speakright.exe` process,
  close it, then run `npm run desktop:launch-release` again.
- If the app opens, spend the first pass on manual QA rather than new features:
  settings, English, Spanish, French, Russian, drill, free practice, diagnosis.
- If a bug appears, capture the language, page, sound unit or word, action taken,
  and whether it is audio, video, scoring, recording replay, layout, or wording.
- Only rebuild with `npm run desktop:run-release` after code changes or if the
  release executable is missing.

## 2026-06-12 Non-English Layout Handoff

- Current local work has moved from layout-only fixes to RC evidence auditing.
  The proof matrix lives in `docs\operations\RC_EVIDENCE_AUDIT.md`.
- Latest local changes make practice targets show the full word, phrase, or
  sentence to read; long IPA and hints wrap instead of truncating.
- Non-English rule units now use Chinese labels such as `规则训练 · 音节节奏`
  and `规则训练 · 词尾静音` rather than large raw labels like `syllable timing`
  or `silent final C`.
- Header speaker buttons are hidden when a non-English sound unit has no real
  local target-sound audio; the UI should not jump to external reference pages
  from a fake speaker control.
- Spanish `词重音` and `音节节奏`, plus French `词尾静音`, had repeated or same-root
  examples reduced. Continue checking all non-English sound units for duplicate
  training text and ugly wrapping before calling the UI stable.
- Focused verification already run for this local pass:
  - `npm.cmd run test -- phoneme-study-card language-learning-decks practice-text-presentation sidebar video-player`
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run desktop:build`
  - `npm.cmd run desktop:launch-release`
- The latest Release EXE path remains:
  `E:\SpeakRightDesktopRepo\src-tauri\target\release\speakright.exe`.

## 2026-06-12 RC Evidence Audit

- Added `docs\operations\RC_EVIDENCE_AUDIT.md` as the release-candidate proof
  matrix. It maps each RC requirement to source files, tests, smoke checks, or
  validation commands.
- Formal mastery recording remains English-only. Spanish, French, and Russian
  can practice, score, and receive feedback, but they stay experimental and do
  not write formal mastery/evidenceMastery.
- `desktop:ui-smoke` is the authoritative Release EXE smoke for UI regressions:
  it checks Settings, English, Spanish, French, Russian, drill, free practice,
  diagnosis, direct progress-archive access, detail task text readability,
  expected header-audio visibility/clickability readiness, no practice-button
  overlap, wrapping video selector labels, and that the app is not served from
  localhost.
- Use `audio:parity:dry-run` for the non-English audio gate; it must remain a
  zero-generation audit.

## 2026-06-14 Tomorrow Test Readiness

- Release EXE was rebuilt after the RC audio/playback, mastery-gating,
  small-bug smoke tightening, and exact header-clip scoring-audio pass:
  `E:\SpeakRightDesktopRepo\src-tauri\target\release\speakright.exe`.
- The Release EXE smoke now covers centered/wrapping target text, scoring
  breakdown hooks, Settings/usage long text, Settings pronunciation-test row
  wrapping/no-overlap runtime checks, A/B voice selector and word-audio button
  visibility/clickability/label runtime checks, video selector
  no-overlap/no-overflow runtime checks, a
  narrow desktop window, and a low-height desktop window.
- Non-English diagnosis remains experimental and now treats omission/insertion
  miscues as insufficient evidence for trusted overall scores.
- Bundled local A/B word audio now uses peak-safe Web Audio gain at playback
  time so English and Spanish/French/Russian local word examples are closer to
  teaching video loudness without regenerating TTS or allowing obvious clipping.
  The cached normalization helper uses the same language-pack fallback gain as
  the active playback hook, and very quiet decoded clips can reach up to `12x`
  peak-safe gain when their peaks permit it, so future local-audio call sites do
  not bypass A/B loudness compensation. Bundled language-pack read-along
  playback now keeps that boost on first play and replay instead of losing it
  after converting a local file to a blob.
- Header speakers and scoring-breakdown phoneme tiles use short local clips.
  Right-side assessment tiles for Spanish, French, and Russian now reuse the
  exact same left/detail sound-unit header clip (`phonemeAudio.localSrc`) when
  a verified single-IPA alias exists. Unverified, proxy, rule, prosody, or
  composite segments stay visible but unclickable; they do not fall back to
  word examples, rule audio, proxy media, or teaching-video audio. Source policy
  forbids exposing video files as phoneme-audio `localSrc`. The shared
  audio-player hook also refuses video-backed sources as a final guard against
  long teaching-video audio playing from a speaker button. Scoring tiles also
  reject video-backed audio URLs before constructing a `Howl`, so a missed
  upstream guard cannot play a full teaching-video track from the assessment
  breakdown. The header speaker component also refuses external-only references
  and browser-TTS fallback audio, so page-level filtering is no longer the only
  guard.
- Advanced pack-runner and HVPT perception mastery writes are now gated by
  `canRecordFormalMastery(languageId)`, keeping Spanish, French, and Russian
  practice/feedback-only while experimental.
- Direct progress-archive access is also language-gated: English can show the
  formal archive, while Spanish, French, and Russian see an experimental blocker
  instead of English mastery archive wording.
- Latest local verification:
  - Focused exact scoring-audio tests: `6` files and `57` tests passed,
    including left/right header-clip parity, Spanish/French/Russian exact alias
    inventory, unclickable unverified tiles, and header/scoring short playback.
  - Desktop UI smoke script self-test: `1` file and `7` tests passed after the
    smoke policy was updated to require one exact playable header clip and one
    locked unverified tile.
  - Focused audio/playback tests: `9` files and `65` tests passed, including
    list-card IPA one-shot playback, chart-word volume policy, bundled
    language-pack read-along gain, and replay gain.
  - Additional low-level audio guard tests are now included in the focused
    audio/playback set.
  - Focused UI/source/text tests: `4` files and `18` tests passed.
  - Additional audio/resource/mastery focused tests: `6` files and `44` tests,
    then `6` files and `28` tests, passed.
  - Mastery/HVPT policy focused tests: `4` files and `22` tests passed.
  - Progress-archive boundary focused tests: `3` files and `13` tests passed,
    including the direct `/progress` experimental blocker and updated Release
    smoke route coverage.
  - Latest settled-main validation results are centralized in
    `docs/operations/RC_EVIDENCE_AUDIT.md` to avoid stale counts across
    multiple handoff documents.
  - `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
    `npm.cmd run build:desktop-frontend` passed in the latest settled-main
    gate.
  - `npm.cmd run desktop:build`: passed; rebuilt Release EXE, MSI, and NSIS.
  - `npm.cmd run desktop:preflight`: passed.
  - `npm.cmd run desktop:ui-smoke`: passed from Release EXE with centered target
    text assertions, scoring-breakdown visibility/readability checks in normal,
    narrow, and low-height detail windows,
    `/progress` experimental blocker route coverage,
    `scoringTileAudioPolicy=ok`,
    Settings/usage wrapping,
    `narrowViewport=ok`, `lowHeightViewport=ok`, and
    `releaseServedFromDevServer=false`.
  - `npm.cmd run audio:parity:dry-run`: Spanish `880`, French `1090`, Russian
    `920`, total missing `0`, no ElevenLabs calls.
  - Latest recorded `npm.cmd run audio:loudness:dry-run`: reference video mean `-14.7 dB`,
    word floor `-21.6 dB`; representative English, Spanish, French, Russian
    A/B word samples, plus IPA chart normal/slow word samples, passed after
    playback-layer gain; no ElevenLabs calls. It was not rerun during the
    exact-header scoring-tile pass because that pass did not change loudness
    math.
- IPA display and audit policy is now documented in
  `docs/operations/IPA_DISPLAY_AUDIT_STRATEGY.md`. The non-English audit input
  generated from the current source data is tracked at
  `docs/operations/non-english-ipa-audit-input.json` with the final expanded UI
  corpus: `1736` rows, Spanish `516`, French `599`, Russian `621`. A generated
  local copy may also exist in `src-tauri/target/ipa-audit/`. Use the prompt in
  that document for GPT Research or expert review before changing IPA strings
  in bulk.
- The first public-repo GPT Research pass was applied only where it produced
  clear high-impact guidance: final Spanish keyword IPA is now normalized to the
  phoneme display layer for `/b d g/`, while `[β ð ɣ]` remains available in
  allophone teaching/scoring resources. French and Russian changes still need
  row-level sourced audit output before bulk edits.
- The second GPT Research pass produced high-confidence row-level fixes:
  French phrase rows now use connected-speech IPA for enchainement, and Russian
  high-risk phrase rows now use broad connected-speech voicing before voiced,
  sonorant, or vowel-onset words. `поезд идёт` remains `needs-review`, and deck
  focus hints such as `/s sʲ zʲ/` should not be mistaken for full sentence IPA.
- Tomorrow's manual test should start with:

```bat
cd /d E:\SpeakRightDesktopRepo
git status --short --branch
npm.cmd run desktop:preflight
npm.cmd run desktop:launch-release
```

- If `desktop:preflight` reports an existing `speakright.exe`, close that app
  window first. Do not switch to localhost or dev mode for acceptance testing.

## 2026-06-11 Multilingual Audio Parity Dry-Run

- Added `npm run audio:parity:dry-run`.
- The density contract now checks Spanish, French, and Russian at 24 practice
  items per sound unit; rule/prosody units must be phrase-heavy rather than
  word-only.
- Initial dry-run before generation:
  - Spanish: `398` existing local audio items, `42` pending.
  - French: `509` existing local audio items, `36` pending.
  - Russian: `407` existing local audio items, `53` pending.
  - Total pending single-voice audio items: `131`.
  - Estimated ElevenLabs characters/credits before generation: about `2418`.
- After user confirmation, generated the missing single-voice language-pack
  audio and updated manifests:
  - Spanish: `440/440`, missing `0`.
  - French: `545/545`, missing `0`.
  - Russian: `460/460`, missing `0`.
- Routine dry-run checks still make zero ElevenLabs API calls.

## 2026-06-11 Multilingual Dual-Voice Expansion

- Upgraded Spanish, French, and Russian language-pack manifests to v2 with
  `blue` and `pink` local audio variants for every bundled item.
- Primary voices remain:
  - Spanish: `Marco Cruz`
  - French: `Clément`
  - Russian: `Valeria`
- Secondary voices selected from ElevenLabs voices metadata and generated once:
  - Spanish: `Lydia`
  - French: `Rachel`
  - Russian: `Sergey`
- Final zero-cost dry-run results:
  - Spanish: `880` existing audio files, `0` missing.
  - French: `1090` existing audio files, `0` missing.
  - Russian: `920` existing audio files, `0` missing.
  - Total missing: `0`.
- Estimated approved one-time generation size: about `10645` characters.
  Routine validation must not regenerate these files.
- The phoneme detail card now has a compact A/B standard-voice selector. Manual
  QA should check both voices for at least a few words in each language.
- Validation after the dual-voice expansion:
  - `npm.cmd run test`: `75` files and `380` tests passed.
  - `npm.cmd run typecheck`: passed.
  - `npm.cmd run lint`: passed; Biome checked `317` files.
  - `npm.cmd run build:desktop-frontend`: passed; `144` static pages generated.
  - `npm.cmd run audio:parity:dry-run`: Spanish `880`, French `1090`, Russian
    `920`, total missing `0`.
  - `npm.cmd run desktop:live-validation`: English `1464`, Spanish `880`,
    French `1090`, Russian `920`, videos `224`, Azure `220/220`, ElevenLabs
    generated characters `0`.
  - `npm.cmd run validate:desktop`: passed, including Tauri build, UI smoke,
    release smoke, release report, and installer smoke.
  - `npm.cmd run desktop:release-gate`: failed only because EXE/MSI/NSIS
    artifacts are unsigned.
