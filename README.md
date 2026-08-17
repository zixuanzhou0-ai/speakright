# SpeakRight

[简体中文](README.zh-CN.md)

[![Docs Check](https://github.com/zixuanzhou0-ai/speakright/actions/workflows/docs.yml/badge.svg)](https://github.com/zixuanzhou0-ai/speakright/actions/workflows/docs.yml)
[![Windows Desktop Checks](https://github.com/zixuanzhou0-ai/speakright/actions/workflows/build-windows.yml/badge.svg)](https://github.com/zixuanzhou0-ai/speakright/actions/workflows/build-windows.yml)

SpeakRight is an open-source pronunciation practice project for Chinese-speaking learners. It now has two deliberately separated editions so users can choose the right runtime without guessing which folder matters.

> **Current target: SpeakRight v1.1.0 release candidate.** It is still under
> final validation and has not been published as `v1.1.0` or
> `v1.1.0-desktop-preview.1`. The learner-facing product remains Chinese-first;
> this English README is the public project and contributor entry.

[Watch the 90-second overview (74 seconds, silent, with burned-in English captions)](docs/assets/demo/speakright-v1.1.0-overview.mp4)
· [English WebVTT captions](docs/assets/demo/speakright-v1.1.0-overview.en.vtt)
· [Five-minute local start](#five-minute-local-start)

| Edition | Folder | Best for | Status |
| --- | --- | --- | --- |
| Windows Desktop | repository root | Windows users who want the installed Tauri app and Release EXE workflow. | `v1.1.0-desktop-preview.1` candidate; unsigned, not yet published, SmartScreen warning required. |
| Browser Edition | `apps/browser` | Windows, macOS, and Linux users who want to run SpeakRight in Chrome/Edge from a local server or static export. | `v1.1.0` Stable candidate; not yet published, BYOK, no hosted SaaS account. |

The Browser Edition is not a SaaS product. Users run it locally from source or a static export, then configure their own provider keys in the app. The Windows Desktop edition remains the packaged Tauri release track.

## Five-Minute Local Start

Requirements: Node.js 22 and a current Chrome or Edge browser. From a fresh
clone, the Browser Edition is the shortest review path and does not require a
hosted SpeakRight account:

Browser Edition development:

```sh
npm ci --prefix apps/browser
npm --prefix apps/browser run dev
```

Open:

```text
http://localhost:3000
```

Static Browser Edition:

```sh
npm run build:browser
npm run serve:browser
```

Windows Desktop development:

```bat
cd /d <repository-root>
npm ci
npm run desktop:dev
```

The Windows installer/Release EXE route is documented separately in the desktop docs. The `v1.1.0-desktop-preview.1` channel is intentionally unsigned and may be published only as a clearly labelled community pre-release with checksums, an SBOM, validation evidence, and a SmartScreen warning. Its public binaries are the bare Release EXE and the NSIS setup only; the NSIS package must pass install/start/exit/uninstall round-trip validation. MSI may still be built for local metadata checks, but it is not a v1.1.0 release asset. This channel must not be described as Desktop Stable.

## Repository Map

| Path | Purpose |
| --- | --- |
| `apps/browser` | Cross-platform Browser Edition. No Tauri imports, no Windows installer scripts, no desktop runtime dependency. |
| repository root / `src` / `src-tauri` | Windows Desktop app. Tauri, Rust commands, Windows packaging, and desktop release gates belong here. |
| `docs/browser-edition` | Browser architecture, implementation plan, validation checklist, release notes, and third-party notices. |
| `docs/oss` | Public open-source readiness, scope, and application-evidence boundaries. |
| `docs/validation` | Validation layers, claim-to-evidence mapping, and the privacy-safe user-testing attestation. |
| `docs/assets/screenshots/release/v1.1.0/browser` | Versioned Browser screenshot matrix and manifest. |
| `docs/assets/screenshots/release/v1.1.0/desktop` | Versioned Desktop screenshot matrix and manifest. |
| `docs/assets/demo` | Versioned overview video, captions, frames, and media manifest. |

## Browser Edition Features

- Sound-unit practice for English, Spanish, French, and Russian.
- Recording, waveform playback, Azure pronunciation score cards, and detailed word/phoneme breakdowns.
- Chinese AI coach feedback based on Azure evidence.
- Free-practice text input with recording and scoring.
- English assessment and advanced drill routes ported from the latest desktop app where browser constraints allow.
- Browser-local progress, score history, and settings.
- BYOK provider setup with session-first API key storage. Keys are persisted to `localStorage` only when the user explicitly enables local persistence.
- Standard demonstration TTS can switch among ElevenLabs, a locally configured Hermes Agent using xAI/Grok, and Vertex AI Gemini 3.1 Flash TTS using the machine's gcloud project and ADC. The local Browser Edition launcher starts its own authenticated loopback adapter; it does not require the Windows Desktop app.
- Microphone device selection for Chrome systems with multiple input devices.

Browser docs start at [`docs/browser-edition/README.md`](docs/browser-edition/README.md). The cross-platform user entry is [`docs/WEB.md`](docs/WEB.md).

## Browser v1.1.0 Candidate Screenshots

These screenshots come from the isolated v1.1.0 evidence build. Scored views
are labelled **Example data — not a live Azure score**; real user scores come from Azure after the learner explicitly starts an assessment with their own
configuration.

| Guided repeat | Free practice |
| --- | --- |
| ![Browser guided repeat](docs/assets/screenshots/release/v1.1.0/browser/1280x800/guided-repeat.png) | ![Browser free practice](docs/assets/screenshots/release/v1.1.0/browser/1280x800/free-practice.png) |

| Diagnosis example | Settings and release information |
| --- | --- |
| ![Browser diagnosis example data](docs/assets/screenshots/release/v1.1.0/browser/1280x800/diagnosis-example.png) | ![Browser settings](docs/assets/screenshots/release/v1.1.0/browser/1280x800/settings.png) |

The complete Browser matrix also covers `390 x 844` and `360 x 800`; see the
[Browser evidence manifest](docs/assets/screenshots/release/v1.1.0/browser/manifest.json).

## Browser Validation

```bat
cd /d <repository-root>
npm run lint:browser
npm run typecheck:browser
npm run test:browser
npm run build:browser
npm run browser:smoke:static
```

Route-level smoke against an already running server is also available:

```bat
cd /d <repository-root>
npm run browser:smoke
```

## Windows Desktop

SpeakRight Desktop is a Tauri + Next.js pronunciation-training app for Chinese learners. It combines local teaching media, microphone recording, real Azure Speech pronunciation assessment, and Chinese AI coaching feedback in one desktop workflow.

American English (`en-US`) is the stable baseline. Spanish (`es-ES`), French (`fr-FR`), and Russian (`ru-RU`) are experimental modules: they expose sound-unit practice and free practice, while formal diagnosis, advanced drills, progress archives, and mastery/evidence views remain English-only until each language has its own release evidence gates.

### Desktop v1.1.0 Candidate Screenshots

Screenshots below are captured from the isolated packaged Desktop evidence EXE,
not a browser localhost session. Scored views are labelled **Example data — not
a live Azure score**; real user scores come from Azure Speech Pronunciation Assessment.

| Guided repeat | Free practice |
| --- | --- |
| ![Desktop guided repeat](docs/assets/screenshots/release/v1.1.0/desktop/1280x920/guided-repeat.png) | ![Desktop free practice](docs/assets/screenshots/release/v1.1.0/desktop/1280x920/free-practice.png) |

| Diagnosis example | Settings and release information |
| --- | --- |
| ![Desktop diagnosis example data](docs/assets/screenshots/release/v1.1.0/desktop/1280x920/diagnosis-example.png) | ![Desktop settings](docs/assets/screenshots/release/v1.1.0/desktop/1280x920/settings.png) |

The complete Desktop matrix also covers the minimum supported `1024 x 800`
window; see the
[Desktop evidence manifest](docs/assets/screenshots/release/v1.1.0/desktop/manifest.json).

### Desktop Product Boundary

- Desktop release track. The installed app loads the static Tauri bundle, not a localhost dev server.
- Public review, source builds, and a clearly labelled unsigned Desktop Preview are supported. The v1.1.0 preview publishes only the unsigned bare EXE and round-trip-validated NSIS setup; neither may be described as Desktop Stable. A locally generated MSI is metadata-smoke input, not a public preview asset.
- The app defaults to a `1280 x 920` launch window with `800px` minimum height.
- API keys are configured locally in Settings and must never be committed.
- Spanish, French, and Russian word/phrase audio is bundled under `public/audio/language-packs/` with two local voice variants per item.
- Local articulation media lives under `public/videos/language-assets/`.
- Bundled media is not automatically relicensed by MIT. See `THIRD_PARTY_NOTICES.md` before redistributing packaged builds.

### Desktop Distribution Status

There is not yet a published `v1.1.0-desktop-preview.1` download in this repository snapshot. The release candidate is intentionally unsigned; after its native acceptance gates pass, the bare Release EXE and the NSIS setup may be published as a GitHub pre-release with checksums, an SBOM, an NSIS install/start/exit/uninstall report, and an explicit SmartScreen warning. MSI is not published in this preview.

Users should verify the published checksum and release provenance before evaluating the preview. Do not bypass SmartScreen, antivirus, or enterprise policy on a managed device only to try an unsigned artifact; build from source or wait for a future signed Desktop Stable release instead.

Maintainers should keep Release EXE validation as the acceptance path, but they must not describe an unsigned artifact as a stable public download.

## Language Support

| Language | Status | What is open now |
| --- | --- | --- |
| American English `en-US` | Stable baseline | Full phoneme practice, local word demos, free practice, word/sentence/contrast/prosody drills, diagnosis, progress evidence, replay/archive workflows, and AI coach feedback. |
| Spanish `es-ES` | Experimental | Sound-unit practice, local A/B word and phrase demos, Sounds of Speech articulation media where bundled, free practice, and Azure-scored recordings using `es-ES`. Stress/rhythm and other rule units remain teaching/practice guidance rather than formal mastery. |
| French `fr-FR` | Experimental | Sound-unit practice, local A/B demos, connected-speech teaching for liaison, enchainement, elision, schwa, final consonant silence, free practice, and Azure-scored recordings using `fr-FR`. Rule units do not masquerade as single-phoneme audio. |
| Russian `ru-RU` | Experimental | Sound-unit practice, local A/B demos, hard/soft consonant and stress/reduction practice material, free practice, and Azure-scored recordings using `ru-RU`. Stress, reduction, devoicing, assimilation, and cluster rules remain experimental evidence. |

## What The App Does

- Shows a language-specific sound-unit list with local teaching video or a source-backed fallback panel.
- Plays verified short target clips only when a real local target-sound asset exists.
- Provides A/B local example audio for practice words, phrases, and sentences.
- Records learner audio and sends it to Azure Speech Pronunciation Assessment with the selected language locale.
- Displays Azure-derived score summaries: total score, accuracy, fluency, completeness, and prosody when Azure provides it.
- Shows word, phoneme, syllable, stress, rhythm, and prosody analysis where the provider evidence is available.
- Generates Chinese AI coaching feedback from the Azure result, target text, language rules, and source-alignment constraints.
- Keeps English advanced drills, diagnosis, and progress evidence separate from experimental non-English modules.
- Handles missing keys, network failures, microphone failures, storage failures, and missing local assets with Chinese inline messages instead of silent no-ops.

## Real Scoring Boundary

SpeakRight does not ask an LLM to invent pronunciation scores. Numeric scores in user-facing practice flows come from Azure Speech Pronunciation Assessment, or from explicit test/smoke fixtures guarded by query parameters during automated smoke.

The selected language profile maps directly to Azure locales:

- `en-US` -> `en-US`
- `es-ES` -> `es-ES`
- `fr-FR` -> `fr-FR`
- `ru-RU` -> `ru-RU`

The LLM layer is downstream only. It explains structured evidence and suggests one verification action, but it must not overwrite numeric observations or turn a single recording into a mastery or substitution claim. The current product contract lives in `docs/PRD.md`; the evidence architecture is recorded in `docs/architecture/0001-evidence-first-learning-loop.md`. The archived 2026-06 release audit is historical evidence, not the current source of truth.

## APIs And Providers

- **Azure Speech**: real pronunciation scoring and speech analysis. The app sends the active language locale to Azure for assessment.
- **ElevenLabs**: optional standard-demo TTS and previously approved bundled local language-pack audio. Routine validation queries usage only and does not generate new audio. Do not generate ElevenLabs audio without explicit maintainer approval.
- **Hermes/xAI**: optional local standard-demo TTS that reuses the Hermes Agent's Grok configuration without exposing its credential to browser code.
- **Vertex AI Gemini TTS**: optional local standard-demo TTS using `gemini-3.1-flash-tts-preview`, the selected gcloud project, and Application Default Credentials. Status checks do not synthesize audio; generation is user initiated and billable under the configured Google Cloud project.
- **LLM providers**: OpenAI-compatible providers can be configured for Chinese coaching feedback. They are not the scoring authority.
- **Youdao pronunciation**: English online dictionary fallback for word pronunciation when local English word audio is unavailable.

## Install And Run

For Windows installer use, source builds, and first-launch expectations, see `docs/INSTALLATION.md`.

Source build:

```bat
cd /d <repository-root>
npm ci
npm run desktop:build
npm run desktop:preflight
npm run desktop:launch-release
```

Manual QA should start from the Release EXE:

```bat
cd /d <repository-root>
npm run desktop:preflight
npm run desktop:launch-release
```

Developer mode is for debugging only:

```bat
cd /d <repository-root>
npm run desktop:dev
```

For current development state, rollback information, and release work, see `docs/operations/NEXT_CHAT_HANDOFF.md`. Historical desktop startup and Release Candidate records are retained under `docs/archive/2026-06-desktop-release/`.

## Desktop Validation

Run from `<repository-root>`:

```bat
npm run test
npm run typecheck
npm run lint
npm run build:desktop-frontend
npm run desktop:build
npm run desktop:preflight
npm run desktop:ui-smoke
npm run desktop:launch-release
```

Supporting zero-generation audits:

```bat
npm run audio:parity:dry-run
npm run phonology:audio-policy:check
```

`desktop:ui-smoke` launches the Release EXE, checks Settings, English full-flow routes, Spanish/French/Russian core routes, non-English boundary routes, left-column phoneme scoring layout, and confirms the runtime is not served from `localhost`.

`audio:parity:dry-run` checks Spanish, French, and Russian local language-pack coverage and makes zero ElevenLabs calls. Record new counts in the active validation report; the archived 2026-06 audit remains immutable historical evidence.

## Repository And Privacy

- Source code and source documentation are MIT licensed. See `LICENSE`.
- `package.json` remains `private: true` to prevent accidental npm publication; releases are desktop/browser artifacts, not an npm package.
- `.env.example` is documentation only. Do not commit real API keys, recordings, learning-data exports, tokens, or private user data.
- Browser Edition API keys and practice data stay in the user's browser storage unless the user exports them manually.
- Do not upload private recordings, full diagnostics bundles, API keys, bearer tokens, or local paths containing user names to public issues.
- Security reporting and secret-handling guidance are in `SECURITY.md`.
- Contribution rules are in `CONTRIBUTING.md`; community behavior expectations are in `CODE_OF_CONDUCT.md`; support routing is in `SUPPORT.md`.
- The complete data-flow and retention boundary is in [`PRIVACY.md`](PRIVACY.md).

## Project Health And Evidence

- [`docs/oss/README.md`](docs/oss/README.md) indexes public OSS-readiness evidence, including the Codex for Open Source readiness note.
- [`docs/validation/README.md`](docs/validation/README.md) separates repository checks, runtime/provider validation, maintainer attestation, and any future consented user study.
- [`docs/validation/USER_TESTING_SUMMARY.md`](docs/validation/USER_TESTING_SUMMARY.md) records the maintainer's report that 20 people tested SpeakRight offline. It is explicitly not independently audited, requests no participant-level proof, and supports no active-user, task-success, retention, satisfaction, or learning-outcome claim.
- [`CHANGELOG.md`](CHANGELOG.md), [`ROADMAP.md`](ROADMAP.md), and [`MAINTAINERS.md`](MAINTAINERS.md) document change history, planned work, and public ownership without promising dates or response-time guarantees.

## Current Limitations

- The Windows community preview is unsigned and may trigger SmartScreen; code signing is still required before any future Desktop Stable release.
- Browser Edition microphone access should be tested from localhost or HTTPS; direct `file://` launch is not the supported path.
- Spanish, French, and Russian remain experimental and must not be described as formal mastery or `evidenceMastery`.
- Some rule, prosody, or composite sound units intentionally do not show speaker buttons until exact local short audio exists.
- Release validation does not record live learner audio, call Azure live scoring, or generate ElevenLabs TTS in routine smoke.
- Provider availability, Azure locale behavior, browser media-device behavior, and WebView2 behavior can vary by machine, network, and account quota.

## Credits And Source Notes

SpeakRight depends on careful third-party educational and provider ecosystems:

- Rachel's English materials inform the English teaching-video experience. Optional maintainer-local clips are excluded from public release assets; when absent, the app links to the official source instead of presenting a broken player.
- American IPA Chart / americanipachart.com provides the source family for the English IPA chart audio mirrored in the app.
- University of Iowa Sounds of Speech Spanish materials are used for bundled Spanish articulation references where exact local assets exist.
- Seeing Speech / University of Glasgow and related phonetics references inform selected source-ledger decisions and some local articulation media.
- EasyPronunciation and similar pronunciation resources are used as reference material or source-ledger context where noted; they are not automatically bundled or treated as a redistribution license.
- Microsoft Fluent Emoji assets are used for English phoneme cards.
- Azure Speech, ElevenLabs, and user-configured LLM providers power optional credentialed capabilities. Youdao is the credential-free online fallback when requested English word playback has no eligible bundled recording. Each service remains subject to its own terms.

See `THIRD_PARTY_NOTICES.md` and `docs/browser-edition/THIRD_PARTY_NOTICES.md` for the full media and provider boundary.

## License

MIT.

## Copyright And Disclaimer

Copyright © 2026 Zixuan Zhou and SpeakRight contributors.

Unless a file says otherwise, source code and source documentation are available under the MIT License. Third-party services, media, brands, and trademarks remain subject to their own terms; review `NOTICE.md` and `THIRD_PARTY_NOTICES.md` before redistributing packaged assets.

SpeakRight is not an official language examination, medical diagnosis, speech-therapy service, or certified scoring tool. Numeric pronunciation scores come from the learner's configured Azure Speech Pronunciation Assessment account; AI coaching is learning guidance only.

Users manage their own provider credentials. Never post API keys, account information, private recordings, or private learning data in a public repository, issue, screenshot, or document.

Open-source repository: [github.com/zixuanzhou0-ai/speakright](https://github.com/zixuanzhou0-ai/speakright)
