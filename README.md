# SpeakRight Desktop

SpeakRight Desktop is a Windows desktop app for American English pronunciation practice, focused on Chinese learners. It combines phoneme lessons, free speaking practice, pronunciation diagnosis, deliberate training packs, mastery tracking, and AI coach feedback.

The desktop app is built with Tauri 2, Next.js 16, React 19, Tailwind CSS 4, and TypeScript.

## Download

Installers are published in GitHub Releases:

- `SpeakRight_1.0.0_x64-setup.exe` - recommended Windows installer
- `SpeakRight_1.0.0_x64_en-US.msi` - MSI installer for Windows deployment

If Windows SmartScreen warns about an unknown publisher, choose **More info** and then **Run anyway**. The current build is unsigned.

## Main Features

- American English phoneme practice with IPA guidance
- Free sentence/word practice with recording, waveform playback, and scoring
- Azure pronunciation assessment integration
- ElevenLabs TTS demo audio and aligned read-along
- AI coach feedback with OpenAI-compatible LLM providers
- Diagnostic report with evidence, confidence, issues, and training prescription
- 10 deep deliberate-training courses for common Chinese learner problems
- Training memory, review queue, mastery profile, and spaced review
- Local-first storage with `localStorage` and Tauri store helpers

## Requirements

For users:

- Windows 10/11 x64
- Network access for cloud scoring/TTS/AI feedback
- API keys configured inside the app settings page

For developers:

- Node.js 20+
- npm
- Rust stable toolchain
- Tauri prerequisites for Windows

## Quick Start for Development

```powershell
npm install
npm run dev
```

Build the static frontend used by Tauri:

```powershell
npm run build:desktop-frontend
```

Build the Windows desktop installers:

```powershell
npm run build
```

Build output:

```text
src-tauri/target/release/bundle/nsis/SpeakRight_1.0.0_x64-setup.exe
src-tauri/target/release/bundle/msi/SpeakRight_1.0.0_x64_en-US.msi
```

## API Keys

Users configure API keys in the Settings page. Keys are not committed to the repository.

Supported services:

- Azure Speech for pronunciation assessment
- ElevenLabs for TTS
- OpenAI-compatible LLM providers for AI coach feedback
- Merriam-Webster optional pronunciation source

See [Installation Guide](docs/INSTALLATION.md) and [Development Guide](docs/DEVELOPMENT.md).

## Repository Layout

```text
src/                 Next.js app, components, hooks, and training logic
src-tauri/           Tauri Rust shell and desktop packaging config
public/              Static audio/images/assets
docs/                Product and developer documentation
scripts/             Local helper scripts
```

## Release Status

Current release: `v1.0.0`

See [Release Notes](docs/RELEASE_NOTES_v1.0.0.md).
