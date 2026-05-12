# Development Guide

## Stack

- Tauri 2 desktop shell
- Next.js 16 App Router
- React 19
- TypeScript strict mode
- Tailwind CSS 4
- Motion
- Azure Speech, ElevenLabs, and OpenAI-compatible LLM providers

## Install Dependencies

```powershell
npm install
```

## Run in Development

```powershell
npm run dev
```

The Tauri dev command starts the desktop shell and the Next.js dev frontend.

## Static Export for Desktop

Tauri packages static files from:

```text
out/
```

`next.config.ts` enables static export during the `build:desktop-frontend` lifecycle.

```powershell
npm run build:desktop-frontend
```

The dynamic training-pack route is statically generated from the 10 training pack IDs.

## Build Desktop Installers

```powershell
npm run build
```

Expected output:

```text
src-tauri/target/release/bundle/nsis/SpeakRight_1.0.0_x64-setup.exe
src-tauri/target/release/bundle/msi/SpeakRight_1.0.0_x64_en-US.msi
```

## Validation Commands

```powershell
npm exec tsc -- --noEmit
npm exec vitest run
npm run build:desktop-frontend
npm run build
```

## Desktop Packaging Notes

- Build target: Windows x64
- Current installer is unsigned
- Tauri warning about `com.speakright.app` ending in `.app` is harmless for the current Windows build, but should be renamed before macOS distribution
- The app uses local storage for Phase 1 data persistence

## Important Paths

```text
src/app/assessment/                 diagnosis
src/app/drill/                      deliberate practice
src/app/drill/pack/[packId]/        course runner
src/app/phonemes/                   phoneme practice
src/app/sentences/                  free practice
src/lib/training-packs.ts           10 core training courses
src/lib/diagnosis-engine.ts         diagnosis aggregation
src/lib/review-queue.ts             review task generation
src/lib/training-memory.ts          training memory snapshot
src-tauri/tauri.conf.json           desktop packaging config
```
