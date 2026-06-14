# SpeakRight Desktop

SpeakRight Desktop is a Tauri desktop pronunciation-training app for Chinese
learners. American English (`en-US`) is the stable baseline. Spanish (`es-ES`),
French (`fr-FR`), and Russian (`ru-RU`) are experimental modules. Japanese is
not included in this release track.

## Current Product Boundary

- Desktop-only release track. Do not mix this repository with older browser-app workspaces.
- The installed app loads the static Tauri bundle, not a localhost dev server.
- This repository is public source code. `package.json` remains `private: true`
  to prevent accidental npm publication; releases are desktop artifacts, not an
  npm package.
- API keys are stored through the desktop secure/local credential layer where
  supported; they are never committed and are excluded from learning-data
  exports.
- Spanish, French, and Russian word/phrase audio is bundled under
  `public/audio/language-packs/`; users do not install these packs separately.
  Each bundled item now has `blue` and `pink` voice variants, matching the
  English local-audio model.
- Local articulation assets live under `public/videos/language-assets/`.

## Development

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:dev
```

The dev build uses the Tauri `devUrl` configured in `src-tauri/tauri.conf.json`.
Release builds must use the static export in `out/`.

For manual QA and user testing, launch the Release EXE instead of dev mode:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:preflight
npm run desktop:launch-release
```

If the Release EXE is missing or stale:

```bat
npm run desktop:run-release
```

For the daily desktop startup checklist, see
`docs/operations/DESKTOP_STARTUP_RUNBOOK.md`.

For the next Codex chat or manual-testing pass, start with
`docs/operations/NEXT_CHAT_HANDOFF.md` and the runbook's `Start Next Chat`
checklist. The first pass should use the Release EXE and cover Settings,
English, Spanish, French, Russian, drill, free practice, and diagnosis before
adding new work.

For the current Release Candidate evidence matrix, see
`docs/operations/RC_EVIDENCE_AUDIT.md`.

## Open Source

- Code and source documentation are licensed under the MIT license. See
  `LICENSE`.
- Bundled audio, video, image, voice, and third-party educational media assets
  are not automatically relicensed by MIT. See `THIRD_PARTY_NOTICES.md` before
  redistributing packaged builds.
- Contribution rules are in `CONTRIBUTING.md`.
- Security reporting and secret-handling guidance are in `SECURITY.md`.
- `.env.example` is documentation only; do not commit real API keys, recordings,
  learning-data exports, tokens, or private user data.

## Validation

```bat
npm run test
npm run typecheck
npm run lint
npm run build:desktop-frontend
npm run desktop:preflight
npm run desktop:ui-smoke
npm run desktop:live-validation
npm run audio:parity:dry-run
npm run audio:loudness:dry-run
npm run ipa:audit:export
npm run validate:internal-release
```

Use `npm run desktop:build` when you need fresh Windows artifacts. Use
`npm run validate:public-release` only after Windows code signing is configured.

The live validation command checks bundled audio/video assets and a high-coverage
Azure pronunciation-assessment sample. It queries ElevenLabs usage only; it does
not generate new audio unless an explicit smoke flag is set outside the normal
release checklist.

`audio:parity:dry-run` checks the Spanish, French, and Russian learning-density
and dual-voice audio contract without calling ElevenLabs. It writes
`src-tauri/target/audio-parity/gap-report.json` and verifies that every required
language-pack item has both `blue` and `pink` local files.

`audio:loudness:dry-run` uses local ffmpeg analysis to compare representative
word A/B audio and IPA chart normal/slow word audio against teaching-video
loudness after playback-layer gain. It writes
`src-tauri/target/audio-loudness/report.json` and makes zero ElevenLabs calls.

`ipa:audit:export` regenerates the tracked Spanish/French/Russian IPA audit
input under `docs/operations/non-english-ipa-audit-input.json`, including
`auditRole` markers that separate full IPA rows from deck focus hints.

`desktop:preflight` checks the active workspace, release executable, and running
`speakright.exe` process before release-style testing. It never closes the app
for you; close SpeakRight manually before building. `desktop:ui-smoke` launches
the Release EXE, opens Settings, English, Spanish, French, Russian, drill, free
practice, and diagnosis routes, and confirms the runtime is not served from
`localhost`.

GitHub Actions are split by change type: source, public asset, script,
`src-tauri`, or package changes still run the full Windows desktop build, while
README/docs-only changes run the lightweight Docs Check workflow.

## Release Notes

- The current Windows artifacts are for controlled testing unless code signing
  is complete.
- Last controlled-test verification: 2026-06-13, after the RC audio playback,
  multilingual layout, evidence, and Release EXE smoke tightening pass.
- Previous release-validation baseline: `94be1d4`
  (`chore: tighten desktop release validation`).
- Latest release-hardening pass added non-English low-evidence diagnosis gates,
  `desktop:preflight`, `desktop:ui-smoke`, and docs-only CI path filtering; the
  final local `validate:desktop` pass completed successfully.
- Verified bundled assets after the multilingual dual-voice expansion: English
  word audio `1464/1464`, Spanish language-pack audio `880/880`, French
  language-pack audio `1090/1090`, Russian language-pack audio `920/920`, local
  videos `224/224`.
- Multilingual audio-density expansion target: 24 practice items per Spanish,
  French, and Russian sound unit. The latest dry-run after generation reports
  Spanish `440 x 2`, French `545 x 2`, Russian `460 x 2`, total missing `0`.
- Secondary voices selected for the experimental language packs: Spanish
  `Lydia`, French `Rachel`, Russian `Sergey`; the original primary voices
  remain Spanish `Marco Cruz`, French `Clément`, Russian `Valeria`.
- Latest settled-main validation results are centralized in
  `docs/operations/RC_EVIDENCE_AUDIT.md`. The current RC gate covers full tests,
  typecheck, lint, static desktop frontend build, Release EXE preflight,
  Release EXE UI smoke, and Release EXE launch from the static Tauri bundle.
- Verified Azure live sample: `220/220` pronunciation-assessment calls passed.
- ElevenLabs usage during normal validation remains `0` generated characters.
  The one-time multilingual secondary-voice generation was approved separately
  and estimated at about `10645` characters.
- Public release gate still fails only because EXE/MSI/NSIS artifacts are
  unsigned.
- Non-English pronunciation scoring remains experimental; `evidenceMastery`
  stays disabled for `es-ES`, `fr-FR`, and `ru-RU` until provider probes and
  language-specific evidence gates are finished.
- Latest local RC handoff on 2026-06-14 tightened non-English practice-card
  readability, one-shot sound-unit speakers across detail and list cards,
  exact scoring-breakdown sound-unit audio,
  local A/B word-audio gain, and formal mastery gating. Long words, phrases,
  sentences, and IPA are shown in full; rule units use Chinese labels; speaker
  buttons are hidden when no local target audio exists, and the header speaker
  component now refuses external-only or browser-TTS fallback audio. This pass
  is documented in `docs/operations/NEXT_CHAT_HANDOFF.md`.
- The current RC evidence audit is tracked in
  `docs/operations/RC_EVIDENCE_AUDIT.md`. It records the proof matrix for
  Release EXE testing, experimental-language boundaries, non-English audio and
  video honesty, centered/wrapping target text, and the English-only formal
  mastery policy.
- The latest Release EXE smoke enforces centered reading targets in addition to
  no ellipsis/nowrap, no practice-button overlap, honest clickable header audio,
  wrapping
  video selector labels plus selector no-overlap/no-overflow runtime checks,
  Settings/usage long-text wrapping, Settings pronunciation-test row
  wrapping/no-overlap runtime checks, A/B voice selector and word-audio button
  visibility/clickability/label runtime checks, scoring-breakdown
  visibility/readability/no-overflow runtime checks plus scoring-tile
  short-audio policy checks including narrow-window and low-height detail
  passes, and
  `releaseServedFromDevServer=false`.
- Non-English diagnosis now treats omission/insertion miscues as insufficient
  evidence for a trusted overall score while preserving practice feedback.
- Local bundled word and language-pack A/B audio now uses peak-safe Web Audio
  gain for playback-level loudness matching; very quiet local word clips can use
  up to `12x` peak-safe gain when decoded peaks permit it. IPA chart normal/slow
  word audio now gets a shared playback-layer boost as well. Free-practice
  read-along playback keeps the same boost when it serves a bundled
  language-pack clip, including replay. Online fallback audio is unchanged and
  no ElevenLabs generation is part of this validation path.
- The shared audio-player hook now refuses video-backed sources, so a missed
  upstream guard cannot make a speaker button play a teaching-video track.
- Scoring-breakdown phoneme tiles now reuse the exact same left/detail
  sound-unit header clip (`phonemeAudio.localSrc`) when a verified single-IPA
  alias exists. Unverified, proxy, rule, prosody, or composite segments stay
  visible but unclickable; they no longer fall back to word examples, rule
  audio, proxy media, or teaching-video audio. English chart clicks are capped
  at `560ms`, and local non-English header/scoring clips are capped at `500ms`
  through the shared header playback policy.
- Recording replay and benchmark playback now use the shared audio-player hook,
  so repeated replay clicks stop the previous blob and cleanup stays centralized.
- Advanced pack-runner and HVPT perception mastery writes are gated by the
  English-only formal mastery policy, so Spanish, French, and Russian remain
  practice/feedback-only experimental modules.
