# Guided Repeat vNext release evidence

Date: 2026-07-14
Branch: `codex/guided-repeat-vnext`
Protected baseline tag: `pre-guided-repeat-upgrade-2026-07-14`
Baseline commit: `453fd5a70b26e9d61016b37d5edaab6dbe4880dd`
Correction commit: `caa7cf2` (`fix(audio): use isolated phoneme anchors in guided repeat`)

## Corrected audio semantics

The earlier implementation incorrectly treated English chart-word `normal` and
`slow` recordings as two phoneme anchors. Those files pronounce the example
word; they are not the isolated phoneme. The correction makes all four languages
follow the same anchor rule:

1. play the same standalone sound-unit/phoneme recording;
2. play that same recording a second time;
3. play the current word with the masculine voice;
4. play it with the feminine voice;
5. repeat the masculine and feminine word voices once.

English `normal` and `slow` word recordings remain available to the ordinary
IPA-chart example-word controls, but guided repeat never requests them.

The English `/ʌ/` page was the only English sound-unit page missing a standalone
phoneme file. A CC BY-SA 4.0 standalone recording was added to both platform
asset trees. Source, conversion details, and hashes are recorded in
`docs/operations/GUIDED_REPEAT_AUDIO_SOURCES.md`.

## Scope delivered

- One shared deterministic session planner drives browser and desktop ordering,
  rhythm, voice semantics, retry/defer behavior, and completion rules.
- English, Spanish, French, and Russian all play the same local phoneme/sound-unit
  anchor twice, followed by masculine, feminine, masculine, feminine word audio.
- The queue starts at the word currently displayed, freezes its pool for the
  session, and completes one rotation without random selection.
- The session is local-audio-only. No Azure, LLM, online dictionary, or TTS
  fallback is allowed.
- Pause/resume, interval pause, background/focus auto-pause, explicit resume,
  browser Back, Escape, retry, defer-once, replay, and cleanup are implemented.
- Practice exposure is written when the first masculine word audio starts. The
  mode does not create scores, mastery, retention, or LearningEvidenceV3
  progression.
- The immersive dialog and compact entry button were added to eligible
  four-language sound-unit pages without changing the existing visual system.

## Commits

1. `caa4c0f4` - `feat(core): add deterministic guided repeat sessions`
2. `e7f40d92` - `feat(audio): complete guided repeat offline assets`
3. `b7ef5a65` - `feat(audio): add offline guided repeat playback`
4. `59f7f1724` - `feat(phonemes): add immersive guided repeat mode`
5. `3fac03dc` - `test(e2e): validate guided repeat across browser and desktop`
6. `e40c17e9` - `test(e2e): cover guided repeat completion state`
7. `caa7cf2` - `fix(audio): use isolated phoneme anchors in guided repeat`

No branch or tag was pushed as part of this work.

## Automated verification after the correction

| Gate | Result |
|---|---|
| Root Biome lint | Passed, 907 files |
| Browser Biome lint | Passed, 420 files |
| Root TypeScript | Passed |
| Browser TypeScript | Passed |
| Root Vitest | Passed, 160 files / 875 tests |
| Browser Vitest | Passed, 135 files / 710 tests |
| Shared-core parity | Passed, 28 parity pairs |
| Guided-repeat audio gate | Passed, 40 English phoneme anchors, 732 English word entries, 2,109 multilingual entries, 11,634 platform files |
| Browser production build | Passed, 198 static pages |
| Browser static smoke | Passed, 9 routes / 2 assets |
| Browser Playwright | Passed, 35/35 tests |
| Rust `cargo check` | Passed |
| Rust `cargo test` | Passed, 8 tests |
| Desktop Tauri Release build | Passed |
| Desktop artifact smoke | Passed |
| Desktop installer smoke | Passed |

The English browser journey additionally asserts that the first and second
anchor phases use the same `/audio/ipa/phoneme/...` source and that guided
repeat makes zero requests to `/audio/ipa/normal/` or
`/audio/ipa/slow/`.

The audio gate verifies required paths, non-empty files, semantic voice-slot
mapping, and byte parity between browser and desktop. It does not replace a full
waveform/decode/loudness audit or human auditory sign-off.

## Asset evidence

The new standalone `/ʌ/` bundle asset is based on Wikimedia Commons
`PR-open-mid back unrounded vowel2.ogg` by RoachPeter, licensed CC BY-SA 4.0.
The bundled desktop and browser copies are byte-identical:

- `public/audio/ipa/phoneme/cup.mp3`
- `apps/browser/public/audio/ipa/phoneme/cup.mp3`
- SHA-256:
  `AAD0B34212A5AAA122E818A4FCBD82E27C8A98718746FFC2B3BAC940DF3D2BCD`

The existing `cup` normal/slow files remain example-word recordings derived
from `En-us-cup.ogg`; they are explicitly not phoneme anchors.

The Russian mapping remains intentionally semantic rather than color-based:
masculine uses the pink asset slot and feminine uses the blue asset slot.
Contract tests cover this reversal.

## Browser screenshot review

Ignored evidence directory:
`outputs/guided-repeat-qa-2026-07-14/browser/`

1. `01-entry-1280-light.png`
2. `02-english-anchor-1.png`
3. `03-english-anchor-2.png`
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

The correction-specific desktop-width screenshots were opened and reviewed.
The labels now read `听音标 · 1/2` and `听音标 · 2/2`, with no normal/slow
claim. The 390px dark paused state and completion state were also reviewed:
the primary controls remain visible, there is no clipping or horizontal
overflow, and completion makes no scoring or mastery claim.

## Desktop artifacts after the correction

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `speakright.exe` | 677,706,752 | `EC4C18B07859421C09DE8B1C4763E51BE8B4C670901DB08DBD35C73DCC56D82D` |
| MSI | 667,529,216 | `89D337006BD19DD4E952D2C36BEDF7FCF1724E9B76F4B4C23C7D9044F3EDB9B7` |
| NSIS setup | 672,035,726 | `D95FEE3FDEDFA469BC0DE831F343E5698B5324C5FF8CD8BABDBE4C4E7F63E495` |

The corrected Release executable was rebuilt from the shared source and passed
artifact and installer consistency checks. It still requires a human-operated
native desktop journey for auditory sign-off; the earlier pre-correction manual
journey is intentionally not counted as evidence for the corrected sequence.

## Known blockers and residual risk

### Public release blocker

EXE, MSI, and NSIS artifacts are not code signed. `desktop:release-gate`
correctly fails for this reason. These artifacts are suitable only for controlled
internal testing.

### Native UI automation limitation

The existing WebView2 UI-smoke attachment issue remains environment-specific.
Browser Playwright is not presented as a replacement for final native Windows
auditory and window-matrix acceptance.

### Listening and matrix sign-off still required

Automated asset coverage, source identity, and the full browser sequence passed.
A human listener must still confirm the standalone `/ʌ/` sound, voice
perception, truncation, loudness transitions, and rhythm comfort in the real
Release program. The complete native Windows 1024/maximized, 125/150/200% scale,
dark, and reduced-motion matrix also remains a manual release acceptance step.

## Quality conclusion

No known feature P0 or P1 defect remains in the corrected shared code, asset
gate, builds, or automated browser journeys. The previous English normal/slow
semantic defect is fixed and protected by contract and E2E assertions. The
feature is ready for controlled user testing, but it is not declared
public-release-ready until code signing and the remaining human native acceptance
steps are completed.
