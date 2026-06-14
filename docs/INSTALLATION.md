# Installation Guide

## Download

Download the latest internal-test installer from the GitHub Releases page.

This build is not code-signed yet. Use it only for controlled testing until the
Windows EXE/MSI/NSIS artifacts are signed.

Recommended file:

```text
SpeakRight_1.0.1_x64-setup.exe
```

Alternative MSI package:

```text
SpeakRight_1.0.1_x64_en-US.msi
```

## Install on Windows

1. Run the installer.
2. If Windows SmartScreen appears, stop and confirm this is the expected
   internal-test build from the project GitHub Release before choosing
   **More info** and **Run anyway**.
3. Launch SpeakRight.
4. Open **Settings** and configure API keys.

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

## Current Internal-Test Status

Current controlled-test track: Release Candidate evidence audit, documented in
`docs/operations/RC_EVIDENCE_AUDIT.md`. Previous release-validation baseline
before the local RC audit: `94be1d4`.

- Recommended launch path: `npm run desktop:launch-release`.
- Build shape: Tauri static bundle, not `localhost`.
- Bundled asset check after the latest audio expansion: English `1464/1464`,
  Spanish `880/880`, French `1090/1090`, Russian `920/920`, videos `224/224`.
- Multilingual audio parity after generation: Spanish `440 x 2`, French
  `545 x 2`, Russian `460 x 2`, total missing `0`.
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

For the 2026-06-14 internal-test pass, use the installed app or Release EXE
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

If recording does not work:

- Read the in-app Chinese error message first. It distinguishes denied
  permission, missing microphone, device-busy startup failure, unsupported
  recorder runtime, and generic startup failure.
- Check Windows microphone permission and confirm SpeakRight is allowed to use
  the microphone.
- If the device is busy, close other apps that may be using the microphone.
- Restart SpeakRight after changing microphone permissions or reconnecting the
  microphone.

If pronunciation scoring fails:

- Read the in-app Chinese error message first. It distinguishes missing speech,
  invalid key/region, unreachable network/proxy, timeout, quota/rate-limit, and
  temporary Azure service failure.
- Confirm Azure key and region match the same Azure Speech resource.
- Confirm network access and proxy/firewall settings.
- Try a short word first.

If TTS fails:

- Confirm ElevenLabs key.
- Check quota/usage.
- Confirm the installed desktop build includes `audio/words` and
  `audio/language-packs` assets.
- Try a short bundled word before testing a long free-form sentence.
