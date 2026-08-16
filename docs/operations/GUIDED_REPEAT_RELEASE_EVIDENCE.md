# Guided Repeat vNext release evidence

Date: 2026-07-14
Branch: `codex/guided-repeat-vnext`
Protected baseline tag: `pre-guided-repeat-upgrade-2026-07-14`
Baseline commit: `453fd5a70b26e9d61016b37d5edaab6dbe4880dd`
Correction commit: `caa7cf2` (`fix(audio): use isolated phoneme anchors in guided repeat`)
Latest UX/timing commit: `965878c` (`fix(ux): center voice controls and lengthen phoneme pauses`)

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
- Both anchor playbacks now have a dedicated imitation window: 900 ms in flow,
  1,200 ms in standard, and 1,600 ms in relaxed rhythm.
- The A/B selector and word playback action form one centered control cluster
  beneath the current word in both browser and desktop builds.
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
8. `965878c` - `fix(ux): center voice controls and lengthen phoneme pauses`

No branch or tag was pushed as part of this work.

## Automated verification after the correction

| Gate | Result |
|---|---|
| Root Biome lint | Passed, 907 files |
| Browser Biome lint | Passed, 420 files |
| Root TypeScript | Passed |
| Browser TypeScript | Passed |
| Root Vitest | Passed, 160 files / 876 tests |
| Browser Vitest | Passed, 135 files / 711 tests |
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
`/audio/ipa/slow/`. The real flow-rhythm journey records phase timestamps and
verifies that both anchor imitation windows remain visible for at least 750 ms;
the shared configuration is 900 ms.

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
3. `02a-english-anchor-imitation-gap.png`
4. `03-english-anchor-2.png`
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
The labels read `听音标 · 1/2`, `轮到你 · 跟读音标`, and
`听音标 · 2/2`, with no normal/slow claim. The new A/B plus playback capsule
is centered beneath the word and aligned with the word-navigation axis. The
390px dark paused state and completion state were also reviewed: primary
controls remain visible, there is no clipping or horizontal overflow, and
completion makes no scoring or mastery claim.

## Desktop artifacts after the correction

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `speakright.exe` | 677,710,848 | `990CEEA06D03F8DB67A65EC03EEA1A8748E8CEF7E236DE085FC7CAA536E21AD4` |
| MSI | 667,525,120 | `6D8183EBD204C842601BC3D8624A4A86658CB514F24A3FB02C4411F7F29E4776` |
| NSIS setup | 671,994,029 | `411F10946931895517DCC25067C48CF4621C446387508CA3D423E7CBDA1F708C` |

The corrected Release executable was rebuilt from the shared source and passed
artifact and installer consistency checks. It still requires a human-operated
native desktop journey for auditory sign-off; the earlier pre-correction manual
journey is intentionally not counted as evidence for the corrected sequence.

## Known blockers and residual risk

### Signed Desktop Stable blocker

EXE, MSI, and NSIS artifacts are not code signed. `desktop:release-gate`
correctly fails for the signed Stable channel. They may be distributed only by
the separate preview gate as a clearly labelled unsigned community pre-release,
with SHA-256 checksums, SBOM, SmartScreen warning, and validation evidence.

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
semantic defect, the detached A/B layout, and the too-short first anchor gap are
fixed and protected by contract, layout, timestamp, and E2E assertions. The
feature is ready for controlled user testing. It may enter the explicitly
unsigned community-preview channel after the remaining native acceptance steps;
code signing remains required before it can be called Desktop Stable.
