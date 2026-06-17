# Multilingual Phonology Optimization Goals

Status: planning goals
Applies to: `es-ES`, `fr-FR`, `ru-RU`
Product status: all three remain experimental
Last updated: 2026-06-17

## Goal

Turn Spanish, French, and Russian from English-template migrations into
language-specific pronunciation modules. Each module must follow its own
phonology, separate phonemes from realizations and phrase rules, and keep
playback honest.

## Planning Documents

- Spanish:
  [`docs/operations/SPANISH_PHONOLOGY_OPTIMIZATION_PLAN.md`](./SPANISH_PHONOLOGY_OPTIMIZATION_PLAN.md)
- French:
  [`docs/operations/FRENCH_PHONOLOGY_OPTIMIZATION_PLAN.md`](./FRENCH_PHONOLOGY_OPTIMIZATION_PLAN.md)
- Russian:
  [`docs/operations/RUSSIAN_PHONOLOGY_OPTIMIZATION_PLAN.md`](./RUSSIAN_PHONOLOGY_OPTIMIZATION_PLAN.md)

## Shared Rules

1. Keep `es-ES`, `fr-FR`, and `ru-RU` experimental. Do not claim mastery,
   evidenceMastery, or full inventory coverage.
2. Model every non-English unit as one of: phoneme, allophone/realization,
   contrast, connected-speech rule, or prosody.
3. A scoring tile is clickable only when it uses the same local short header
   clip as the left/detail sound unit. Rule, proxy, word, sentence, dictionary,
   generated TTS, or video-track material stays unclickable.
4. No ElevenLabs or paid-provider generation without explicit maintainer
   confirmation after a dry-run estimate.
5. `needs-review` rows stay unchanged unless backed by two authorities, or one
   authority plus matching dictionary/source audio.

## Language Goals

Spanish goal: five stable vowels, tap/trill, Castilian `/θ/`,
dialect-aware `seseo/yeismo`, `/b d g/` stop-vs-approximant realizations,
unaspirated `/p t k/`, dental `/t d/`, lexical stress, syllable rhythm,
diphthongs, and nasal place assimilation. Standalone `/p t k f m n b d g/`
anchors now exist; `/b d g/` stop anchors are separate from `[β ð ɣ]`, but
the plain anchors still need verified local clips before becoming clickable.

French goal: oral vowels, nasal vowels, front rounded vowels, glides `/j ɥ w/`,
uvular `/ʁ/`, common consonants, liaison, enchainement, elision, schwa, final
consonant silence, and phrase-final prominence. Standalone
`/p b t d k g f v s z m n l/` anchors and `fr-phrase-final-prominence` now
exist, but need exact local clips or sentence-rhythm evidence before any new
scoring-tile audio becomes clickable.

Russian goal: vowels including `/ɨ/`, hard/soft consonant pairs, always-hard
and always-soft consonants, mobile stress, vowel reduction, final devoicing,
regressive voicing assimilation, iotated vowels, soft sign behavior, and
clusters. First coronal stop, sibilant, sonorant, labial, and velar hard/soft
pair anchors now exist as score-only contrast units; Russian is still not a
full inventory and these anchors have no verified short local clips.

## Implementation Goals

1. Add a source-backed inventory table per language: layer, IPA, variant scope,
   source refs, audio status, tile policy, and gaps.
2. Update `language-sound-units` to match each language model.
3. Update `local-language-assets` and `assessment-segment-audio` only when a
   short exact local clip exists.
4. Update feedback rules so coaching names the target-language issue instead of
   importing English assumptions.
5. Add tests for inventory coverage, source alignment, audio policy, and phrase
   rules.
6. Validate through Release EXE gates only: `test`, `typecheck`, `lint`,
   `build:desktop-frontend`, `desktop:preflight`, `desktop:ui-smoke`, and
   `desktop:launch-release`. Optional dry-runs: `audio:parity:dry-run` and
   `audio:loudness:dry-run`.

## Done

Users can tell exact sounds, contextual realizations, dialect variants, and
phrase-level rules apart. The UI never implies that a non-English module is
production-ready merely because an English-style IPA grid exists.
