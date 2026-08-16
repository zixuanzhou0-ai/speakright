# SpeakRight Desktop learning parity release evidence

Date: 2026-07-13

> Historical snapshot. Its counts and unsigned-artifact policy describe the
> dated branch below, not the v1.1.0 release candidate. Current distribution
> rules live in `README.md` and `docs/INSTALLATION.md`.

Branch: `codex/desktop-learning-parity`

Baseline: `c9e4f8ea8ef1ff8b8c49bc79c4d7e1be3c355857`

## Scope completed

- Shared `TrainingCriterion`, deterministic cross-speaker ABX catalog, and V3 evidence store/builders now live in `packages/core` and are consumed by both desktop and browser apps.
- The ten English packs use 48 shared perception pairs. Every core word has non-empty local blue and pink recordings in both apps, and core ABX never needs an online pronunciation fallback.
- Desktop guided training is offline-first for perception. Production scoring is requested only when a recording task needs it; unscored comparison does not advance formal evidence.
- Guided, HVPT, contrast, prosody, free-practice, scenario, spontaneous, and phoneme observations use the V3 evidence boundary. A single attempt does not produce mastery, transfer, or retention.
- The progress page presents discriminated, controlled, varied, transfer, and delayed-retention evidence. Legacy mastery remains visible only as unvalidated history.
- Desktop settings, phoneme directory/detail, free-practice empty state, microphone selection, titlebar accessibility, Labs policy, and content guidance were aligned with the validated browser experience while keeping Tauri storage and direct-service boundaries.
- The close control now invokes an explicit local Tauri application exit command. Closing the final Release window was verified to remove the process, and the unused `core:window:allow-close` permission was removed.

## Automated evidence

- Desktop Biome: 857 files passed.
- Desktop TypeScript: passed.
- Desktop Vitest: 150 files, 834 tests passed.
- Browser Biome and TypeScript: passed.
- Browser Vitest: 125 files, 669 tests passed.
- Browser production build: 197 static pages passed.
- Browser static smoke: 9 routes and 2 assets passed.
- Browser Playwright: 25 tests passed.
- Shared-core parity: 17 pairs passed.
- Training audio gate: 10 packs, 48 pairs, both platforms, two speakers passed.
- Tauri `cargo check`: passed.
- Tauri tests: 8 passed, including secure storage and diagnostics redaction.
- Desktop static/Tauri artifact smoke: passed.
- Desktop installer smoke: passed.

## Final artifacts

The generated report is kept under the ignored Tauri build directory.

| Artifact | Bytes | SHA-256 | Signature |
| --- | ---: | --- | --- |
| EXE | 674338304 | `f5d71e79d785a2a1f685ebeeecf34cf344f1e9682f1fe9cd5ac34dbc144595db` | NotSigned |
| MSI | 664170496 | `230a050f1c52ccb2f0d1ad98775de466412a59c05e2cfdc2284e82e1b93afdef` | NotSigned |
| NSIS | 668600726 | `7a980c2a7ccafdccc28c11779f5cb52378192ca5d4171ad52e1292df2bc7a4a5` | NotSigned |

## Real Release-window acceptance

Computer Use exercised the actual Release EXE rather than a browser substitute.

- Default 1280×920 and maximized layouts rendered without blocking overlap or horizontal overflow.
- The primary “开始今天训练” action was visible without an Azure precondition.
- The first lesson correctly stated that it is the first level and did not claim a prerequisite had passed.
- The ABX task showed the 8-trial, four-pair, cross-speaker criterion; all A/B/X local audio controls played without an error state.
- Non-phoneme targets displayed public labels such as “无目标词尾 / 有词尾辅音”; internal slugs were absent.
- Settings basic/services/privacy/Labs panels, secure-provider policy, disabled Custom endpoint, unsigned-release warning, phoneme directory/detail, and compact free-practice empty state were visible and usable.
- The final close action removed the SpeakRight process instead of leaving a headless process that locks the executable.

## Release limits and remaining external evidence

- `desktop:ui-smoke` and `desktop:smoke` cannot establish their legacy CDP connection because the installed WebView2 150 runtime does not expose the requested Release remote-debugging port. Process inspection confirmed that the app and isolated WebView start, while the debugging argument is absent. Release DevTools remain disabled by policy. The same final binary was therefore inspected with Computer Use; the CDP scripts were not weakened or marked as passing.
- The public release gate correctly fails because EXE, MSI, and NSIS are unsigned. These artifacts are suitable only for controlled internal testing until code signing is added.
- Live Azure, ElevenLabs, and LLM calls and uploading a real test recording were not run. They require explicit confirmation immediately before using stored credentials and audio.
- A complete manual matrix at Windows 125%, 150%, and 200% scaling still requires dedicated OS-level runs. Automated browser 200% zoom, responsive contracts, default desktop size, and maximized desktop layout passed, but these are not represented as substitutes for all three Windows scale settings.
