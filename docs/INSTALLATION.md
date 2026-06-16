# Installation Guide

## Controlled-Test Installer Boundary

Do not treat GitHub Releases as a public signed download page yet. If you are a
maintainer or tester in the controlled-test track, use the installer filename
named by the current release notes and verify it against
`docs/operations/RC_EVIDENCE_AUDIT.md`.

This build is not code-signed yet. Use it only for controlled testing until the
Windows EXE/MSI/NSIS artifacts are signed.
If you are evaluating the public source repository without joining that
controlled-test track, prefer **Build From Source** below or wait for a signed
public Windows release.
Published GitHub Release assets can lag behind the current `main` branch; check
the release notes and `docs/operations/RC_EVIDENCE_AUDIT.md` before treating an
installer as the latest validated RC.

Controlled-test setup filename currently referenced by the release notes:

```text
SpeakRight_1.0.1_x64-setup.exe
```

Controlled-test MSI filename currently referenced by the release notes:

```text
SpeakRight_1.0.1_x64_en-US.msi
```

## Install on Windows

1. Run the installer.
2. If Windows SmartScreen appears, stop and confirm this is the expected
   controlled-test build from the project GitHub Release before choosing
   **More info** and **Run anyway**.
3. Launch SpeakRight.
4. Open **Settings** and configure API keys.

## Build From Source

Use this path when you are testing a source checkout instead of a downloaded
installer. Run it from the current desktop repository only:

```bat
cd /d E:\SpeakRightDesktopRepo
npm ci
npm run desktop:build
npm run desktop:preflight
npm run desktop:launch-release
```

The Release EXE should open from:

```text
E:\SpeakRightDesktopRepo\src-tauri\target\release\speakright.exe
```

Do not use a browser `localhost` tab as release acceptance. `npm run
desktop:dev` is for code debugging only.

## Required Configuration

SpeakRight can open without API keys, but scoring and AI feedback require external services.

### Azure Speech

Used for pronunciation assessment.

Required values:

- Azure Speech key
- Azure region

### ElevenLabs

Used for standard pronunciation demos and read-along audio that are not already
covered by bundled local resources.

Required value:

- ElevenLabs API key

English word-card audio is bundled in the desktop app under `audio/words` and
uses the online dictionary only as a fallback. Spanish, French, and Russian
word/phrase audio is already bundled in the desktop app. Users do not install
language audio packs separately.

Spanish, French, and Russian are bundled at the current 24-item-per-sound-unit
learning-density target with two local voice variants per item. The parity
dry-run is still useful as a zero-cost audit: it does not call ElevenLabs and
should report no missing language-pack audio.

Release validation is intentionally conservative with ElevenLabs credits:
normal validation checks the usage endpoint only and does not generate fresh
audio. Free-form read-along TTS can still use ElevenLabs after the user enters a
key, but bundled word and language-pack audio should work without spending
additional ElevenLabs credits.

### LLM Provider

Used for Chinese AI coach feedback.

Supported desktop providers are the preset providers shown in Settings:
Claude, GPT, Gemini-compatible, DeepSeek, Qwen, GLM, Kimi, and Doubao.
Custom endpoints are disabled in the desktop build until their domains are added
to the Tauri allowlist and CSP.

Required values:

- Provider
- API key
- Model
- Base URL is managed by the selected preset provider in the desktop build

## Local Data

This release stores user data locally. API keys are stored through the desktop
credential store where supported; learning data stays local to the app.

- usage tracking
- pronunciation history
- diagnosis results
- training mastery profile
- training sessions and review queue

No cloud backend is required for this release.
If local storage is full or blocked, pronunciation scoring should still show the
current result. Phoneme detail, free practice, and drill practice surfaces show a
Chinese warning if the local score trend, practice history, or transfer evidence
for that attempt could not be saved.

## First Launch Expectations

The desktop app should open even when no API keys have been configured yet.
Settings should show the missing-key state instead of blocking startup.

If the network is unavailable, local pages and bundled audio should still load
where the desktop bundle includes the relevant assets. Azure scoring, AI coach
feedback, online dictionary fallback, and non-bundled TTS should show
actionable Chinese network/provider messages rather than raw English exceptions
or silent loading states.

If microphone permission is denied, the microphone is missing, or another app is
using the device, recording controls should show an inline Chinese recovery
message and should not leave the learner stuck in a recording/scoring state.

If bundled local audio is missing or unreadable, Settings should show the
language-pack `缺失或不可读` state with a reinstall or Release EXE feedback hint.
Practice pages should avoid pretending that browser TTS, teaching-video audio,
proxy rule audio, or unrelated samples are exact local sound-unit audio.

Installation verification should not generate ElevenLabs audio or spend TTS
credits. Use the dry-run audio audits when you need to inspect bundled audio
coverage.

## Current Internal-Test Status

Current controlled-test track: Release Candidate evidence audit, documented in
`docs/operations/RC_EVIDENCE_AUDIT.md`. Use that audit for the latest command
results, Release EXE smoke coverage, and known blockers before treating a
downloaded installer as the latest validated RC.

- Recommended launch path: `npm run desktop:launch-release`.
- Build shape: Tauri static bundle, not `localhost`.
- Bundled audio/video and multilingual parity counts are validated in
  `docs/operations/RC_EVIDENCE_AUDIT.md`; keep that audit as the source of truth
  instead of copying exact asset totals into the installation guide.
- Multilingual audio parity remains a zero-generation audit for current local
  coverage across Spanish, French, and Russian.
- Secondary voices selected for the experimental packs: Spanish `Lydia`, French
  `Rachel`, Russian `Sergey`; the original primary voices remain bundled.
- Azure live validation: `220/220` sampled pronunciation assessments passed.
- ElevenLabs validation usage: usage query only, `0` generated TTS characters.
  The approved one-time secondary-voice expansion is separate from routine
  validation and is not rerun during installer testing.
- Release UI smoke: Settings, English, Spanish, French, Russian, drill, free
  practice, diagnosis, and direct progress-archive access opened from the
  Release EXE; runtime was not
  `localhost`. The current smoke also checks detail task text readability,
  centered reading targets, expected header-audio visibility, no
  practice-button overlap, wrapping video selector labels, Settings/usage
  long-text wrapping, scoring-breakdown smoke hooks, exact scoring-tile audio
  policy, narrow-window layout, and low-height layout.
- Local word and language-pack A/B audio now uses playback-layer, peak-safe Web
  Audio gain for loudness matching with teaching videos. IPA chart normal/slow
  word audio also uses a shared playback boost, and bundled language-pack
  read-along playback keeps that boost on replay; online fallback audio is
  unchanged and routine validation still does not generate ElevenLabs audio.
- Latest settled-main validation results are centralized in
  `docs/operations/RC_EVIDENCE_AUDIT.md`. The current RC gate covers full tests,
  typecheck, lint, static desktop frontend build, Release EXE preflight,
  Release EXE UI smoke, and Release EXE launch from the static Tauri bundle.
- Non-English diagnosis keeps scoring experimental: omission/insertion evidence
  blocks trusted overall scores and asks for retest instead of implying mastery.
- AI coach feedback keeps Spanish, French, and Russian full-score recordings
  conservative: it may report that no obvious issue was found in the recording,
  but it must not call the result perfect or mastered.
- Spanish, French, and Russian advanced training remains feedback-only for
  formal mastery; direct English pack-runner routes and direct progress-archive
  access show experimental blockers for these languages, and HVPT perception
  plus formal mastery writes stay gated by the English-only formal mastery
  policy.
- Public-release blocker: Windows EXE/MSI/NSIS artifacts are still unsigned.

For the 2026-06-16 internal-test pass, use the installed app or Release EXE
first. Only rebuild if the executable is missing, stale after code changes, or
manual QA finds a bug that needs a code fix.

For the next Codex chat, first read:

```text
docs/operations/NEXT_CHAT_HANDOFF.md
docs/operations/DESKTOP_STARTUP_RUNBOOK.md
```

That handoff records the latest local non-English layout fixes, the validation
commands already run, and any current local worktree caveats. A settled RC
branch should have no uncommitted file edits before you start new changes.
If `git status` still reports `main...origin/main [ahead N]` after recent
GitHub API fallback pushes, verify the GitHub `main` ref and local-vs-remote
tree SHA before treating the content as unpushed.

Recommended developer launch order for release-style testing:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:preflight
npm run desktop:launch-release
```

If `desktop:preflight` reports that `speakright.exe` is already running, close
the app window first. The preflight command is intentionally non-destructive and
does not stop the process for you.
`desktop:launch-release` has the same non-destructive duplicate-process guard:
it refuses to open another Release EXE, prints the running PID list, and leaves
the existing SpeakRight window untouched.
On a normal launch it prints the Release EXE path, the child process PID, and a
reminder that the command does not start localhost or the Next dev server.

## Troubleshooting

For developer startup issues, especially `localhost refused`, first check
`docs/operations/DESKTOP_STARTUP_RUNBOOK.md` and confirm you are using
`E:\SpeakRightDesktopRepo`. For release-style testing, use
`npm run desktop:launch-release` or `npm run desktop:run-release`; do not treat a
browser `localhost` tab as the desktop app.

For automated release-window smoke, run:

```bat
npm run desktop:ui-smoke
```

The UI smoke opens the Release EXE, checks key pages, verifies the runtime is
not `localhost`, and does not record audio or call ElevenLabs TTS.

If `npm run desktop:build` fails with a Rust/LLVM out-of-memory error on a
Windows workstation, retry the same command after closing other memory-heavy
apps. The project build wrapper already defaults `CARGO_BUILD_JOBS=1` on
Windows; advanced users can override that environment variable explicitly when a
larger CI runner can tolerate more parallel Rust jobs.

If recording does not work:

- Read the in-app Chinese error message first. It distinguishes denied
  permission, missing microphone, device-busy startup failure, unsupported
  recorder runtime, and generic startup failure.
- The first-run checklist also shows a Chinese microphone-check hint for
  unsupported desktop microphone access, denied permission, low input signal,
  or a sample that was too short to trust.
- Check Windows microphone permission and confirm SpeakRight is allowed to use
  the microphone.
- If the device is busy, close other apps that may be using the microphone.
- Restart SpeakRight after changing microphone permissions or reconnecting the
  microphone.

If pronunciation scoring fails:

- Read the in-app Chinese error message first. It distinguishes missing speech,
  invalid key/region, unreachable network/proxy, timeout, quota/rate-limit, and
  temporary Azure service failure.
- If a Settings test button fails, the status line should keep the same
  actionable Chinese reason instead of a generic "network error" or raw English
  exception.
- Confirm Azure key and region match the same Azure Speech resource.
- Confirm network access and proxy/firewall settings.
- Try a short word first.

If AI coach feedback fails:

- Read the in-app Chinese error message first. It distinguishes missing LLM
  key, desktop endpoint policy blocks, invalid key/provider/model, unreachable
  network/proxy, timeout, quota/rate-limit, and temporary provider failure.
- The Settings test button preserves actionable Chinese provider errors and
  keeps long messages wrap-ready in narrow windows.
- Confirm the selected provider, model, and API key match the same provider.
- For desktop builds, custom arbitrary LLM domains are blocked until the domain
  is added to the Tauri allowlist and CSP.
- Scoring can still work without AI coach feedback because Azure Speech provides
  the numeric assessment.

If TTS fails:

- Read the in-app Chinese error message first. It distinguishes missing
  ElevenLabs configuration, invalid key, unavailable voice/model, network/proxy
  failure, timeout, quota/rate-limit, service failure, and too-long text.
- The Settings test button preserves actionable Chinese provider errors; raw
  English fetch exceptions are replaced with a Chinese network/proxy hint.
- Confirm ElevenLabs key.
- Check quota/usage in Settings.
- Confirm the installed desktop build includes `audio/words` and
  `audio/language-packs` assets.
- Try a short bundled word before testing a long free-form sentence.
- Online dictionary fallback for English words can fail separately; when it
  does, bundled local word audio and bundled language-pack audio are still the
  first-choice resources.
