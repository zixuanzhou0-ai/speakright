# Installation Guide

## Download

Download the latest installer from the GitHub Releases page.

Recommended file:

```text
SpeakRight_1.0.0_x64-setup.exe
```

Alternative MSI package:

```text
SpeakRight_1.0.0_x64_en-US.msi
```

## Install on Windows

1. Run the installer.
2. If Windows SmartScreen appears, choose **More info** and then **Run anyway**.
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

Used for standard pronunciation demos and read-along audio.

Required value:

- ElevenLabs API key

### LLM Provider

Used for Chinese AI coach feedback.

Supported providers are OpenAI-compatible, including OpenAI, Gemini-compatible proxy, DeepSeek, Qwen, GLM, Kimi, Doubao, and custom providers.

Required values:

- Provider
- API key
- Model
- Base URL when using a custom provider

## Local Data

Phase 1 stores user data locally:

- API key settings
- usage tracking
- pronunciation history
- diagnosis results
- training mastery profile
- training sessions and review queue

No Supabase backend is required for this release.

## Troubleshooting

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
- Try the default voice first.
