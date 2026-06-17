# French Phonology Optimization Plan

Status: draft implementation plan
Language profile: `fr-FR`
Product status: experimental
Last updated: 2026-06-17

This plan defines how SpeakRight should tighten French pronunciation content so
it follows French phonology and French-as-a-foreign-language pronunciation
training. French cannot be modeled as a flat list of isolated IPA symbols.

## Source Basis

Primary model:

- Fougeron and Smith, "French", `Journal of the International Phonetic
  Association`, 23(2), 73-76; reprinted in the `Handbook of the International
  Phonetic Association`, pp. 78-81:
  <https://doi.org/10.1017/S0025100300004874>
- `Handbook of the International Phonetic Association`, Cambridge University
  Press, 1999:
  <https://www.internationalphoneticassociation.org/content/handbook-ipa>
- French phonetics/FLE references used as model anchors: Pierre Leon,
  `Phonetisme et prononciations du francais`; Pierre Fouche, `Traite de
  prononciation francaise`; PFC project for contemporary French variation.
- Current app implementation:
  `src/lib/language-sound-units/french.ts`,
  `src/lib/local-language-assets.ts`,
  `src/lib/assessment-segment-audio.ts`,
  `src/lib/language-source-alignment.ts`.

Pedagogical stance:

- Teach the French sound inventory and the French phrase rhythm separately.
- Treat liaison, enchainement, elision, schwa behavior, and final consonant
  silence as phrase/sentence rules, not as clickable single-phoneme tiles.
- Keep mergers and regional variation visible. Do not punish common French
  varieties for `/œ̃/` -> `/ɛ̃/` or `/ɑ/` -> `/a/` mergers unless the learner
  selected a target that requires the distinction.

## Correct French Model

French has a mature IPA and phonological description, but the product must use
several layers:

| Layer | French target | Product meaning |
| --- | --- | --- |
| Oral vowels | `/i y u e ɛ ø œ ə o ɔ a/` plus variant `/ɑ/` where taught | Main vowel units and vowel contrasts |
| Nasal vowels | `/ɑ̃ ɛ̃ ɔ̃ œ̃/`, with `/œ̃/` often merged into `/ɛ̃/` | Dedicated nasal-vowel training and variant notes |
| Consonants | `/p b t d k g f v s z ʃ ʒ m n ɲ l ʁ/` plus `/ŋ/` in loans | Inventory anchors; common consonants now have standalone course units, exact clips pending |
| Glides | `/j ɥ w/` | Contrast training, especially `/ɥ/` vs `/w/` |
| Phrase phonology | liaison, enchainement, elision, schwa, final consonant silence | Phrase/sentence lessons and scoring feedback |
| Prosody | no English-like lexical stress; prominence is phrase-final/rhythmic-group based | Sentence-level coaching |

Core content requirements:

- `/y/`, `/ø/`, `/œ/`, and `/ɥ/` must be front rounded targets, not English-like
  `/u/` or `/w/`.
- Nasal vowels must not add a full final `/n/` or `/ŋ/`.
- `/ʁ/` is uvular, not English rhotic and not Spanish trill.
- French `ch` is `/ʃ/`, not `/tʃ/`; French `j` and soft `g` are `/ʒ/`, not `/dʒ/`.
- Liaison and enchainement must be separated:
  - Liaison: latent final consonant appears before vowel/h muet in licensed
    syntactic environments.
  - Enchainement: already pronounced final consonant resyllabifies into the
    following vowel.
- Schwa `/ə/` is unstable and context-dependent. It must be trained as sound
  plus rule, not just one stable isolated vowel.
- Final consonants require lexical and phrase context. A mnemonic like C-R-F-L
  helps learners, but exceptions must be visible.

## Current SpeakRight State

Current `FRENCH_PHONEMES` contains 40 course sound units:

- Vowels and nasal vowels: `fr-i`, `fr-y`, `fr-u`, `fr-e`, `fr-e-open`,
  `fr-eu-close`, `fr-eu-open`, `fr-an`, `fr-in`, `fr-on`, `fr-a`,
  `fr-schwa`, `fr-o-close`, `fr-o-open`, `fr-un`.
- Consonants and glides: `fr-r`, `fr-p`, `fr-b`, `fr-t`, `fr-d`, `fr-k`,
  `fr-g`, `fr-f`, `fr-v`, `fr-s`, `fr-z`, `fr-m`, `fr-n`, `fr-l`,
  `fr-sh`, `fr-zh`, `fr-ny`, `fr-glide-j`, `fr-glide-hui`, `fr-glide-w`.
- Phrase/rule units: `fr-liaison`, `fr-final-consonant-silence`,
  `fr-enchainement`, `fr-elision`.
- Prosody unit: `fr-phrase-final-prominence`, a sentence/rhythmic-group target
  for phrase-final prominence rather than English-style lexical stress.

Current exact scoring-tile audio:

- Playable exact header clips include the vowel, nasal vowel, `/ʁ ʃ ʒ ɲ j ɥ w/`
  units listed in `assessment-segment-audio.test.ts`.
- Phrase/rule units have no exact single-phoneme tile audio and should stay
  unclickable.
- Common consonants `/p b t d k g f v s z m n l/` are now standalone course
  units, but they still have no verified short local header clips.

This is a strong experimental French-specific anchor set, but it is not a
stable/mastery-ready French phonology module.

## Target Data Model

French needs explicit layer separation:

| `soundUnitLayer` target | Examples | UI/audio rule |
| --- | --- | --- |
| `phoneme` | `/i y u e ɛ ø œ o ɔ a p b t d k g f v s z ʃ ʒ m n ɲ l ʁ/` | May have exact speaker when verified |
| `variantPhoneme` | `/œ̃/`, `/ɑ/`, `/ŋ/` loanword target | Shows variation note and profile scope |
| `glide` | `/j ɥ w/` | Contrast drills; may be playable when exact |
| `rule` | liaison, final consonant silence, elision | No single speaker; sentence demo only |
| `connectedSpeech` | enchainement, schwa deletion/retention | Phrase/sentence scoring and feedback |
| `prosody` | phrase-final prominence, syllable timing | Sentence-level coaching |

## Required Content Changes

1. Inventory completion
   - Add standalone French units for `/p b t d k g f v s z m n l/`. Done in
     source; exact short local header clips remain pending.
   - Decide whether `/ɑ/` is an optional variant note under `/a/` or a separate
     advanced regional target.
   - Keep `/ŋ/` as loanword/reference-only unless a clear training need exists.

2. Vowel and nasal-vowel quality
   - Keep `/y ø œ ɥ/` as priority targets for Chinese learners.
   - Keep `/œ̃/` visible as a traditional/contrast unit, but mark the common
     modern merger with `/ɛ̃/`.
   - Add minimal-pair or near-pair drills for `/e/` vs `/ɛ/`, `/o/` vs `/ɔ/`,
     `/ø/` vs `/œ/`, `/ɑ̃/` vs `/ɔ̃/` vs `/ɛ̃/`.

3. Phrase-rule split
   - Split `fr-liaison` and `fr-enchainement` in copy and tests. The current
     combined lesson title should not imply the same mechanism.
   - `fr-final-consonant-silence` should include "normally silent", "liaison can
     revive it", and "lexical exceptions".
   - `fr-elision` should stay phrase-level and include apostrophe examples.
   - `fr-schwa` should be dual-layer: it is a vowel in the inventory and also a
     deletion/retention rule in connected speech.

4. Prosody
   - Add a French sentence-rhythm unit: phrase-final accent, not English lexical
     stress. Done in source as `fr-phrase-final-prominence`; exact sentence-
     rhythm evidence audio remains pending and unclickable.
   - Update feedback rules so learners are not asked to stress every content word
     as in English.

5. Example IPA audit
   - Re-check phrase and sentence IPA for liaison, enchainement, elision,
     schwa, and silent final consonants.
   - Do not hard-edit `needs-review` rows without at least two source-backed
     confirmations.

## Audio Policy

French audio must follow the existing honest-playback rule:

- Exact clips may be clickable only when the audio is a verified short
  `/audio/language-assets/fr-FR/header-clips/*.m4a` clip tied to the same sound
  unit.
- Rule/prosody units such as liaison, enchainement, elision, final consonant
  silence, and phrase-final prominence must not expose a single-symbol tile
  speaker.
- If a rule has a sentence demo later, label it "短语/句子示范", not "音标发音".
- Common consonants whose exact local clips are not yet verified should show
  labels and scores but stay unclickable.
- Do not generate ElevenLabs audio for French without explicit maintainer
  approval.

## Test Plan

Add or update tests in these areas:

- `src/__tests__/french-language-content.test.ts`
  - Inventory includes the required common consonant anchors or marks them as
    known gaps.
  - `/œ̃/` merger note remains visible.
  - `/ʃ/` and `/ʒ/` are not described as affricates.
- `src/__tests__/language-source-alignment.test.ts`
  - `fr-liaison`, `fr-enchainement`, `fr-elision`, and
    `fr-final-consonant-silence` are rule/phrase units and hide header speakers.
- `src/__tests__/assessment-segment-audio.test.ts`
  - Phrase symbols such as `‿` and words such as `liaison` remain unclickable.
  - Exact clips only map to verified header-clip assets.
- `src/__tests__/language-feedback-rules.test.ts`
  - French sentence feedback includes liaison, enchainement, elision, schwa, and
    final consonant silence when evidence is present.

Acceptance gate:

```bat
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:desktop-frontend
npm.cmd run desktop:preflight
npm.cmd run desktop:ui-smoke
npm.cmd run desktop:launch-release
```

Optional audio-only gates, still dry-run:

```bat
npm.cmd run audio:parity:dry-run
npm.cmd run audio:loudness:dry-run
```

## French Completion Goal

French is ready to move from experimental content toward public beta only when:

- The inventory covers common French consonants, core oral vowels, nasal vowels,
  glides, and variant notes.
- Phrase-level rules are modeled separately from single sound units.
- All clickable speakers use exact local short clips.
- French feedback does not impose English stress or English rhotic assumptions.
- Tests lock liaison, enchainement, elision, schwa, final consonant silence, and
  phrase-final prominence alongside nasal-vowel behavior.
