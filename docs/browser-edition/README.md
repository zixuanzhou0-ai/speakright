# SpeakRight Browser Edition

The Browser Edition is the cross-platform, browser-runnable SpeakRight app in
`apps/browser`. It is no longer a migration plan or an `apps/web` prototype.
It shares pure learning contracts with the Windows Desktop edition while
keeping browser storage, recording, provider, and release boundaries explicit.

[`v1.1.0` Browser Stable](https://github.com/zixuanzhou0-ai/speakright/releases/tag/v1.1.0)
is public. Release ID `375494273` was published on 2026-08-24 from commit
`61c506af5c1f0b9b8397c74f69470c0da1e9f382`. Anonymous verification matched
all 20 contracted assets, their checksum entries, and the public download URLs;
the exact observations are recorded in the
[post-publication record](../validation/V1.1.0_RELEASE_VERIFICATION.md).

## Product Boundary

- Runs on Windows, macOS, and Linux in a current Chrome or Edge browser.
- Runs from a local development server or the static export served on localhost
  or HTTPS; direct `file://` launch is not supported.
- Uses a bring-your-own-key model. SpeakRight does not operate a hosted account,
  scoring backend, recording store, or SaaS user database for this edition.
- Keeps provider keys in the session by default. Persistent browser storage is
  used only when the learner explicitly enables it.
- Sends text, recordings, or prompts only when the learner starts a configured
  Azure, TTS, dictionary, or LLM action. The data flow is documented in
  [`PRIVACY.md`](../../PRIVACY.md).
- Uses Azure Speech as the numeric pronunciation-scoring authority. LLM output
  remains downstream coaching and cannot replace score evidence.

## Five-Minute Start

Requirements: Node.js 22 and a current Chrome or Edge browser.

```bat
cd /d <repository-root>
npm ci --prefix apps/browser
npm --prefix apps/browser run dev
```

Open `http://localhost:3000`.

To build and serve the production-style static export:

```bat
cd /d <repository-root>
npm ci
npm ci --prefix apps/browser
npm run build:browser
npm run serve:browser
```

The public `SpeakRight_Browser_1.1.0.zip` contains the production static output.
Extract it and serve the extracted directory from localhost or HTTPS instead of
opening `index.html` directly.

## Current Scope

| Area | Browser Edition boundary |
| --- | --- |
| Language support | American English is the stable baseline. Spanish, French, and Russian sound-unit/free-practice modules are experimental. |
| Sound practice | Language-specific units, eligible local demos, recording, Azure score summaries, detailed analysis, and Chinese coaching. |
| Guided repeat | Intensity modes use the full available word set; phase-safe controls and exit summaries do not claim mastery. |
| Free practice | Text input, standard demonstration audio, browser recording, Azure scoring, AI feedback, replay, and stale-request isolation. |
| Standard-demo TTS | ElevenLabs can provide word timing. Hermes/xAI and Vertex AI use honest sentence-level playback feedback when no word timeline exists. Local adapters remain machine-configured services. |
| English advanced routes | Diagnosis, word/sentence/contrast/perception and related drills, progress, and evidence views where the current source exposes them. |
| Storage | Browser-local settings, progress, caches, and score history; no project-operated cloud sync. |
| Media | Only registry-approved distributable files enter the Browser mirror. Reference-only Rachel's English videos are not bundled and use an official-source fallback. |

## Desktop Separation

Windows Desktop remains at the repository root under `src` and `src-tauri`.
Browser code must not import Tauri APIs, desktop credential storage, installer
scripts, or Windows runtime assumptions. Desktop code must not depend on a
Browser localhost server. Pure shared contracts are checked by the core-parity
gate rather than hidden behind runtime branching.

The unsigned Desktop Preview has its own tag, workflow, assets, validation
report, and safety warning. A Browser static smoke result is never a substitute
for Release EXE or NSIS install/start/exit/uninstall acceptance.

## Validation

Run from the repository root:

```bat
npm run lint:browser
npm run typecheck:browser
npm run test:browser
npm run validate:browser:e2e
npm run build:browser:production
npm run assets:sync:browser:check
npm run browser:smoke:static
npm run e2e:browser:production-fixture-guard
npm run docs:check-links
```

The release-commit main-push Browser E2E run contained 47 tests: 46 passed, one
intentional production-fixture-guard skip, zero flaky, and zero failed. Its
unit-test phase also passed 146 files and 788 tests. The Browser release workflow
[`32696723273`](https://github.com/zixuanzhou0-ai/speakright/actions/runs/32696723273)
completed successfully, including build job `97340113767` and publish job
`97343927873`. Public Release identity, assets, checksums, SBOM parsing, and
anonymous downloads are separately captured in the post-publication record;
none of these results is treated as learner-outcome evidence.

Automated fixtures do not represent a real Azure learner score, paid-provider
availability, broad device compatibility, adoption, or learning efficacy.
Routine release evidence uses deterministic fixtures and makes no paid TTS or
live scoring call.

## Documentation

- [Architecture and separation](ARCHITECTURE_AND_SEPARATION.md)
- [Validation and release contract](VALIDATION_AND_RELEASE.md)
- [v1.1.0 release notes](RELEASE_NOTES.md)
- [Browser third-party notices](THIRD_PARTY_NOTICES.md)
- [Cross-platform user guide](../WEB.md)
- [Immutable v1.1.0 candidate record](../validation/V1.1.0_RELEASE_CANDIDATE.md)
- [v1.1.0 post-publication verification](../validation/V1.1.0_RELEASE_VERIFICATION.md)
- [Archived migration documents](../archive/2026-06-browser-edition/)

## Known Limitations

- Microphone access depends on browser, OS, permission, secure-context, and
  device behavior.
- External provider availability, account quota, locale behavior, and billing
  remain outside SpeakRight's control.
- Spanish, French, and Russian cannot be described as having the same mastery
  evidence as the English baseline.
- Missing or reference-only media intentionally shows a bounded fallback; it
  must not be replaced by an unrelated local clip or an HTML response disguised
  as media.
