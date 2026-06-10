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

Last controlled-test verification: 2026-06-11.

- Recommended launch path: `npm run desktop:launch-release`.
- Build shape: Tauri static bundle, not `localhost`.
- Bundled asset check: English `1464/1464`, Spanish `398/398`, French
  `509/509`, Russian `407/407`, videos `210/210`.
- Azure live validation: `220/220` sampled pronunciation assessments passed.
- ElevenLabs validation usage: usage query only, `0` generated TTS characters.
- Public-release blocker: Windows EXE/MSI/NSIS artifacts are still unsigned.

## Troubleshooting

For developer startup issues, especially `localhost refused`, first check
`docs/operations/DESKTOP_STARTUP_RUNBOOK.md` and confirm you are using
`E:\SpeakRightDesktopRepo`. For release-style testing, use
`npm run desktop:launch-release` or `npm run desktop:run-release`; do not treat a
browser `localhost` tab as the desktop app.

If recording does not work:

- Check Windows microphone permission.
- Restart the app after changing microphone permissions.

If pronunciation scoring fails:

- Confirm Azure key and region.
- Confirm network access.
- Try a short word first.

If TTS fails:

- Confirm ElevenLabs key.
- Check quota/usage.
- Confirm the installed desktop build includes `audio/words` and
  `audio/language-packs` assets.
- Try a short bundled word before testing a long free-form sentence.
