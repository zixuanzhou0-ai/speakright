# Guided Repeat vNext release evidence

Date: 2026-07-14
Branch: `codex/guided-repeat-vnext`
Protected baseline tag: `pre-guided-repeat-upgrade-2026-07-14`
Baseline commit: `453fd5a70b26e9d61016b37d5edaab6dbe4880dd`
Implementation head before this report: `e40c17e9d91d335c04add2ce8ca247f3ef8be440`

## Scope delivered

- One shared deterministic session planner drives browser and desktop ordering, rhythm, voice semantics, retry/defer behavior, and completion rules.
- English runs `normal anchor -> slow anchor -> masculine -> feminine -> masculine -> feminine` for every word.
- Spanish, French, and Russian run the same single anchor twice, followed by the four alternating word voices.
- The queue starts at the word currently displayed, freezes its pool for the session, and completes one rotation without random selection.
- The session is local-audio-only. No Azure, LLM, online dictionary, or TTS fallback is allowed.
- Pause/resume, interval pause, background/focus auto-pause, explicit resume, browser Back, Escape, retry, defer-once, replay, and cleanup are implemented.
- Practice exposure is written when the first masculine word audio starts. The mode does not create scores, mastery, retention, or LearningEvidenceV3 progression.
- The immersive dialog and compact entry button were added to eligible four-language sound-unit pages without changing the existing visual system.

## Commits

1. `caa4c0f4` - `feat(core): add deterministic guided repeat sessions`
2. `e7f40d92` - `feat(audio): complete guided repeat offline assets`
3. `b7ef5a65` - `feat(audio): add offline guided repeat playback`
4. `59f7f1724` - `feat(phonemes): add immersive guided repeat mode`
5. `3fac03dc` - `test(e2e): validate guided repeat across browser and desktop`
6. `e40c17e9` - `test(e2e): cover guided repeat completion state`

No branch or tag was pushed as part of this work.

## Automated verification

| Gate | Result |
|---|---|
| Root Biome lint | Passed, 907 files |
| Browser Biome lint | Passed, 420 files |
| Root TypeScript | Passed |
| Browser TypeScript | Passed |
| Root Vitest | Passed, 160 files / 875 tests |
| Browser Vitest | Passed, 135 files / 710 tests |
| Shared-core parity | Passed, 28 parity pairs |
| Guided-repeat audio gate | Passed, 40 English anchors, 732 English word entries, 2,109 multilingual entries, 11,714 platform files |
| Browser production build | Passed, 198 static pages |
| Browser static smoke | Passed, 9 routes / 2 assets |
| Browser Playwright | Passed, 35/35 tests |
| Rust `cargo check` | Passed |
| Rust `cargo test` | Passed, 8 tests |
| Desktop production build | Passed |
| Desktop artifact smoke | Passed |
| Desktop installer smoke | Passed |

The audio gate verifies required paths, non-empty files, semantic voice-slot mapping, and byte parity between browser and desktop. It does not replace a full waveform/decode/loudness audit or a human listening sign-off.

## Asset evidence

The missing English `/ʌ/` `cup` anchors were added from the Wikimedia Commons US-English recording. The slow version is a pitch-preserving 0.78x derivative. Author, license, source URL, modification, and checksums are recorded in `NOTICE.md`, `THIRD_PARTY_NOTICES.md`, and `docs/operations/GUIDED_REPEAT_AUDIO_SOURCES.md`.

The Russian mapping is intentionally semantic rather than color-based: masculine uses the pink asset slot and feminine uses the blue asset slot. Contract tests cover this reversal.

## Browser screenshot review

Ignored evidence directory: `outputs/guided-repeat-qa-2026-07-14/browser/`

1. `01-entry-1280-light.png`
2. `02-english-normal.png`
3. `03-english-slow.png`
4. `04-english-masculine.png`
5. `05-english-feminine.png`
6. `06-imitation-gap.png`
7. `07-manual-pause.png`
8. `08-auto-pause.png`
9. `09-mobile-390-dark-paused.png`
10. `10-zoom-200-reduced-motion.png`
11. `11-spanish.png`
12. `12-french.png`
13. `13-russian.png`
14. `14-local-audio-error.png`
15. `15-completed.png`

Each image was opened at original resolution. The current word remains the visual focus, phase and voice labels remain stable, pause and exit stay visible, Teal is reserved for primary state/action, and the reviewed light, dark, 390px, 200%-equivalent, reduced-motion, error, and completion states showed no clipping, horizontal overflow, or unbalanced empty state. The completion state intentionally has no score, confetti, badge, or mastery claim.

## Real desktop program review

The real Tauri Release executable was operated directly, not through Playwright or Chrome.

Verified:

- Opened English `/i:/`, selected a non-first word, started guided repeat, and observed progression through normal, slow, and alternating voice phases.
- Manual pause and resume worked.
- Minimizing the window produced auto-pause; restoring did not auto-resume.
- Escape closed the dialog; the parent page remained on the last displayed word.
- Spanish, French, and Russian dialogs started and progressed across at least two words.
- Closing the last window removed SpeakRight from the running application list.

The real-program pass used an approximately 1280x920 window. The complete 1024/maximized and Windows 125/150/200% screenshot matrix was not captured as local image files in this run; browser automation covers equivalent layout states, but it is not a substitute for that remaining Windows acceptance matrix.

## Desktop artifacts

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `speakright.exe` | 677,702,144 | `6440BBE51FE5455CA0AF23ABAC6BABEE4807D75F35F10D08AF74FBFE85EA5B7B` |
| MSI | 667,529,216 | `D8D6B973A261739E50866636694403702422EE3FE79D6D11F9DD0A952325A29C` |
| NSIS setup | 672,028,255 | `E43A4CED129FE4A3AA266FE9197E9575AFD5FEB17800DA936A2C885D575C3BFE` |

The built executable contains the functional guided-repeat implementation. Commit `e40c17e9` adds test-only smoke selection and completion-state selectors used by the browser regression suite; it does not alter the normal user journey.

## Known blockers and residual risk

### Release blockers

- EXE, MSI, and NSIS artifacts are not code signed. `desktop:release-gate` correctly fails for this reason. These artifacts are suitable only for internal testing.
- `desktop:ui-smoke` and `desktop:smoke` cannot attach to the installed WebView2 runtime in this environment (`WebView2 devtools target was not available: fetch failed`). This was not counted as a pass.

### External tool blocker

- The bundled Chrome control extension failed to initialize with `Cannot redefine property: process`. Playwright used a separate browser channel and passed, but the requested Chrome-extension manual journey remains unverified.

### Listening and matrix sign-off still required

- Asset coverage and representative playback were exercised, but this agent has no returned system-audio stream and therefore cannot truthfully claim a human auditory judgement of all anchors or all representative voice files. A human listener must still sign off target sound correctness, gender/voice perception, truncation, loudness transitions, slow-anchor quality, and rhythm comfort.
- The remaining native Windows 1024/maximized, 125/150/200% scale, dark, and reduced-motion screenshot matrix should be captured after resolving the desktop automation attachment issue or by a human tester.

## Quality conclusion

No known feature P0 or P1 defect remains in the implemented code or the automated browser journeys. The feature is functionally complete for source and internal desktop testing. It is not declared production-release-ready until code signing, the remaining native Windows matrix, and human auditory sign-off are completed.
