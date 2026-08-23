# Browser Edition Architecture And Separation

This document defines how the Browser Edition stays clean while reusing the best
parts of the current Windows Desktop app.

## Folder Ownership

| Folder | Owner | Allowed platform APIs | Release output |
| --- | --- | --- | --- |
| repository root / `src` / `src-tauri` | Windows Desktop today | Tauri, Rust commands, Tauri store, Tauri HTTP/plugin APIs, Windows installer scripts. | Local builds may produce EXE/MSI/NSIS; v1.1.0 Desktop Preview publishes the bare EXE and round-trip-validated NSIS only. |
| `apps/desktop` | Future desktop folder target | Same desktop-only APIs after a validated physical move. | Not the current public entry until migrated. |
| `apps/browser` | Browser Edition | Web APIs only: MediaRecorder, Web Audio, IndexedDB/localStorage, fetch, optional Azure Speech browser SDK. | Static export or browser dev/build output. |
| `packages/shared` | Shared pure code | No Tauri, no browser globals at module load, no process/env secrets. | Imported by both apps. |
| `apps/web` | Legacy seed only | Temporary old browser code during migration. | No final production claim unless renamed/converted. |

The final public README must name these folders directly. Users should never
need to guess whether `web`, `desktop`, `src-tauri`, or root-level scripts are
the right path.

## Import Rules

Allowed:

```text
apps/browser -> packages/shared
apps/desktop -> packages/shared
apps/browser -> apps/browser/*
apps/desktop -> apps/desktop/*
```

Forbidden:

```text
apps/browser -> apps/desktop/*
apps/browser -> @tauri-apps/*
apps/browser -> src-tauri/*
desktop root or apps/desktop -> apps/browser/*
packages/shared -> @tauri-apps/*
packages/shared -> browser-only code that runs at import time
```

If logic must exist in both editions, move the pure part into
`packages/shared` and keep runtime-specific adapters inside each app.

## Platform Adapter Pattern

Use explicit adapters instead of hidden runtime branching.

```text
apps/browser/src/platform/
  api-keys.ts          Browser storage for BYOK keys.
  speech-assessment.ts Browser Azure Pronunciation Assessment adapter.
  audio-recording.ts   Browser MediaRecorder/Web Audio adapter.
  file-runtime.ts      Static asset URL/runtime helpers.

desktop root today, or apps/desktop after migration:
  src/platform/
  api-keys.ts          Tauri secure store adapter.
  speech-assessment.ts Desktop Azure/Tauri-safe assessment adapter.
  audio-recording.ts   Desktop microphone/runtime adapter.
  file-runtime.ts      Tauri bundle asset helpers.
```

Shared UI should call an injected or imported platform adapter from its own app
folder. It should not check `window.__TAURI__` in random components.

## Real Scoring Boundary

All user-facing numeric scoring must be backed by Azure Speech Pronunciation
Assessment.

The browser implementation must pass these rules:

- The active language profile maps to the Azure locale used for assessment:
  `en-US`, `es-ES`, `fr-FR`, or `ru-RU`.
- Browser recording is converted to an Azure-compatible audio format according
  to the browser SDK or officially supported request path.
- Score summary numbers, word scores, phoneme/syllable evidence, completeness,
  fluency, accuracy, and prosody must be copied from Azure responses or derived
  deterministically from Azure fields.
- LLM output may reference Azure evidence but cannot invent score values.
- Smoke/demo fixtures must be explicitly guarded by test-only flags and must not
  appear in normal user flows.

If a browser-only Azure route cannot be proven, stop and document the blocker.
Do not quietly replace scoring with LLM feedback.

## API And Key Handling

Browser Edition is BYOK: users configure their own API keys locally.

Recommended browser storage policy:

- Default: session storage for sensitive provider keys, with an option to
  persist locally after clear warning text.
- Local persistence: IndexedDB or localStorage, never committed files.
- No hidden hosted proxy in the first Browser Edition.
- No API keys in URL query strings.
- No keys in screenshots, smoke logs, GitHub issues, or release notes.

The optional Hermes/xAI and Vertex AI Gemini TTS integrations use an
authenticated loopback adapter started by the local Browser Edition launcher.
They are activated by choosing the corresponding provider in Settings. The
adapter never returns Hermes credentials, Google Cloud project identifiers,
accounts, or ADC access tokens to browser code, and is not available to
remotely hosted pages. Core Browser Edition features and the static export
remain usable without this adapter.

## Static Export Constraint

Browser Edition should support a static/exportable build where possible.

That means:

- Core features cannot depend on Next API routes.
- Routes like `/api/maintenance-start-desktop` must be removed or isolated from
  Browser Edition.
- Static assets must resolve under the exported app path.
- Microphone flows must be tested from `localhost` or HTTPS. A direct `file://`
  launch should not be presented as the supported path.

## Media And Credits Boundary

Browser Edition can only include media that is already allowed for open-source
redistribution or clearly documented as a local/development asset.

Required credits and source notes:

- Azure Speech: pronunciation assessment provider.
- ElevenLabs: optional TTS and previously generated local demo audio where
  redistribution is allowed by project policy.
- Rachel's English: English teaching-video inspiration/source notes where
  bundled clips are used.
- American IPA Chart / americanipachart.com: English IPA chart audio source
  family where mirrored assets exist.
- University of Iowa Sounds of Speech: Spanish articulation references where
  bundled exact assets exist.
- Seeing Speech / University of Glasgow and related phonetics references:
  source-ledger context where applicable.
- Youdao: credential-free online fallback when requested English word playback
  has no eligible bundled recording.
- Microsoft Fluent Emoji-style assets: English phoneme card images where used.

The final release docs must distinguish "used as reference", "bundled locally",
and "called as API provider". Those are different legal and product claims.

## User Data

Browser Edition stores learning data locally unless a later version explicitly
introduces sync.

Expected local data:

- provider settings and key persistence preference
- practice history
- score trends
- diagnosis results
- drill sessions and review queue
- progress/evidence archives where browser storage is sufficient

The app must remain usable when storage fails. It should still show the current
Azure result and show a Chinese warning if history/progress could not be saved.

## Migration Principle

Prefer deliberate duplication over accidental coupling. It is acceptable for
Desktop and Browser Edition to have similar components while the platform split
is being stabilized. After the browser app passes validation, extract pure
duplication into `packages/shared` only when that reduces real maintenance risk.
