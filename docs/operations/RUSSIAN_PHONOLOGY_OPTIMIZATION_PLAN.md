# Russian Phonology Optimization Plan

Status: draft implementation plan
Language profile: `ru-RU`
Product status: experimental
Last updated: 2026-06-17

This plan defines how SpeakRight should tighten Russian pronunciation content so
it follows Russian phonology and Russian orthoepy. Russian is not a flat list of
English-like consonants. Its learning model depends on stress, vowel reduction,
hard/soft consonant contrast, and connected-speech voicing rules.

## Source Basis

Primary model:

- Yanushevskaya and Buncic, "Russian", `Journal of the International Phonetic
  Association`, 45(2), 221-228:
  <https://doi.org/10.1017/S0025100314000395>
- Rogers and d'Archangeli, "Russian", `Journal of the International Phonetic
  Association`, 34(1), earlier IPA illustration for Russian.
- Russian orthoepy and phonology references used as model anchors: Avanesov,
  `Russkoe literaturnoe proiznoshenie`; Jones and Ward, `The Phonetics of
  Russian`; Timberlake, `A Reference Grammar of Russian`; modern
  Moscow/St. Petersburg school descriptions.
- Current app implementation:
  `src/lib/language-sound-units/russian.ts`,
  `src/lib/local-language-assets.ts`,
  `src/lib/assessment-segment-audio.ts`,
  `src/lib/language-source-alignment.ts`.

Pedagogical stance:

- Teach stress before unstressed vowel quality.
- Teach hard/soft consonants as a system, not as a single "soft sign" trick.
- Treat reduction, final devoicing, voicing assimilation, and clusters as
  word/phrase rules. They should not become fake single-phoneme speaker buttons.
- Keep the `/i/` vs `/ɨ/` phonological debate visible in maintainer docs, while
  still teaching `/ɨ/` as a separate learner target because learners hear and
  produce it as a distinct sound.

## Correct Russian Model

Russian needs several explicit layers:

| Layer | Russian target | Product meaning |
| --- | --- | --- |
| Vowel inventory | `/a o u e i ɨ/` as learner-facing targets | Must be paired with stress state |
| Hard/soft consonants | most consonants contrast `C` vs `Cʲ` | Core contrast engine and minimal-pair training |
| Unpaired consonants | always hard `/ʂ ʐ ts/`; always soft `/tɕ ɕː j/` | Special inventory notes and drills |
| Stress | mobile and meaning-changing | Required on words and sentence examples |
| Vowel reduction | unstressed `/o a/` -> `[ɐ ə]`; unstressed front vowels often -> `[ɪ]` style targets | Word-level implementation, not isolated phoneme mastery |
| Voicing rules | final devoicing and regressive voicing assimilation | Connected-speech feedback |
| Clusters | complex consonant sequences without inserted vowels | Phrase/word drills |

Core content requirements:

- `/ɨ/` must be taught as a learner-facing sound even if sources debate whether
  it is a separate phoneme or an allophone of `/i/`.
- Soft consonants are palatalized consonants. They are not hard consonant plus a
  full `/j/`.
- `ь` changes the preceding consonant; it is not an independent vowel or
  syllable.
- `я/е/ё/ю` are positional: word-initial/after vowel or signs may include `/j/`;
  after consonants they usually mark softening plus vowel.
- Stress must be shown because vowel quality cannot be predicted without it.
- Final devoicing applies in pause/word-final contexts and before voiceless
  obstruents, but connected speech before voiced consonants, sonorants, or
  vowels needs separate treatment.
- Voicing assimilation is usually regressive. `/v/` needs careful handling:
  sources describe it as undergoing assimilation without always triggering it
  like other obstruents.

## Current SpeakRight State

Current `RUSSIAN_PHONEMES` contains 34 course sound units:

- Vowels: `ru-a`, `ru-o`, `ru-i`, `ru-y`, `ru-u`, `ru-e`.
- Core consonant/special units: `ru-r`, `ru-x`, `ru-sh-zh`, `ru-ts`,
  `ru-ch`, `ru-shch`, `ru-j`.
- Hard/soft and orthographic-rule units: `ru-hard-soft`, `ru-soft-t-d`,
  `ru-soft-s-z`, `ru-soft-n-l-r`, `ru-soft-labials`, `ru-soft-sign`,
  `ru-iotated-vowels`.
- First standalone hard/soft stop and labial pair anchors: `ru-t-tj`,
  `ru-d-dj`, `ru-p-pj`, `ru-b-bj`, `ru-m-mj`, `ru-f-fj`, `ru-v-vj`.
- Prosody/rule units: `ru-stress-reduction`, `ru-unstressed-o-a`,
  `ru-unstressed-e-ya`, `ru-final-devoicing`, `ru-voicing-assimilation`,
  `ru-clusters`.

Current exact scoring-tile audio:

- Playable exact header clips include `/a o i ɨ u e r x ʂ ts tɕ ɕː j/` and
  aliases recorded in `assessment-segment-audio.test.ts`.
- Many Russian course units are intentionally `isProxyForAssessment` because
  they are contrast/rule groups rather than exact single sounds.
- The app now exposes the first standalone hard/soft stop and labial pair
  anchors as score-only contrast units. It does not yet expose every hard/soft
  consonant pair, and none of the new pair anchors has verified short local
  single-segment audio.

This is the right experimental direction, but it is not a full Russian inventory
or mastery system.

## Target Data Model

Russian needs the strongest layer separation of the three experimental
languages:

| `soundUnitLayer` target | Examples | UI/audio rule |
| --- | --- | --- |
| `phoneme` | `/a o u e i ɨ r x ts tɕ ɕː j/` | May have exact short speaker when verified |
| `hardSoftPair` | `/t tʲ/`, `/d dʲ/`, `/s sʲ/`, `/n nʲ/`, `/l lʲ/`, labials | Contrast cards and pair drills |
| `unpairedConsonant` | `/ʂ ʐ ts tɕ ɕː j/` | Inventory note plus examples |
| `orthographicRule` | `ь`, `я/е/ё/ю` | Rule lesson, not standalone scoring audio unless exact |
| `reductionRule` | unstressed `о/а`, `е/я` | Word-level and phrase-level scoring |
| `connectedSpeechRule` | final devoicing, voicing assimilation | Phrase/sentence feedback |
| `cluster` | `встреча`, `здравствуйте`, `текст` | Slow-to-fast phrase drills |

## Required Content Changes

1. Inventory and pair map
   - Build an explicit Russian hard/soft pair table for maintainers:
     `/p pʲ b bʲ m mʲ f fʲ v vʲ t tʲ d dʲ s sʲ z zʲ n nʲ l lʲ r rʲ k kʲ g gʲ x xʲ/`
     where applicable and source-supported.
   - Mark always-hard and always-soft units separately.
   - Decide which pairs become learner-facing first. Start with high-impact
     pairs already present: `t/d`, `s/z`, `n/l/r`, labials.
   - Current implementation note: the first stop and labial pair anchors
     `ru-t-tj`, `ru-d-dj`, `ru-p-pj`, `ru-b-bj`, `ru-m-mj`, `ru-f-fj`, and
     `ru-v-vj` are now learner-facing score-only contrast units. The full
     hard/soft pair table and exact single-segment audio remain open.

2. Stress-first words
   - Require `stressText` for Russian examples where stress is not visually
     obvious.
   - Add tests that reject Russian reduction examples without stress marks.
   - Keep IPA and Cyrillic stress display visible and untruncated.

3. Reduction rules
   - Keep `ru-unstressed-o-a` and `ru-unstressed-e-ya` as rule units.
   - Do not expose `[ɐ]`, `[ə]`, or `[ɪ]` as if they are independent mastered
     phonemes unless the UI labels them as reduced realizations.

4. Devoicing and assimilation
   - Keep `ru-final-devoicing` connected-speech aware. Do not teach "every final
     voiced letter is always devoiced in every phrase".
   - Add more phrase examples showing different following environments:
     pause, voiceless obstruent, voiced obstruent, sonorant, vowel.
   - Keep `ru-voicing-assimilation` as phrase-level feedback.

5. Audio and video alignment
   - Preserve existing proxy warnings for Seeing Speech resources.
   - Add exact audio only when the asset is a short local clip for the same
     Russian target.
   - Rule-group videos may be shown as references, but not as exact teaching
     videos unless the content matches the unit.

## Audio Policy

Russian audio must follow the existing honest-playback rule:

- Exact clips may be clickable only when they are verified
  `/audio/language-assets/ru-RU/header-clips/*.m4a` clips tied to the same
  sound unit.
- Hard/soft pair groups, reduction rules, final devoicing, assimilation, and
  clusters should keep scores visible but stay unclickable unless a precise
  local target clip exists.
- Proxy videos must remain labeled as proxy/reference material.
- Whole-word, sentence, dictionary, or generated TTS audio must never masquerade
  as a single phoneme.
- No new ElevenLabs generation may run without explicit maintainer approval.

## Test Plan

Add or update tests in these areas:

- `src/__tests__/russian-language-content.test.ts`
  - Russian examples with reduction include stress text or explicit stress IPA.
  - Hard/soft descriptions say palatalization, not hard consonant plus full `/j/`.
  - Always-hard and always-soft units are labeled correctly.
  - Standalone stop and labial pair anchors exist, stay contrast-layer, and
    keep enough examples for training.
- `src/__tests__/assessment-segment-audio.test.ts`
  - `[ɐ ə ɪ]`, `final devoicing`, `cluster`, and palatalized aliases such as
    `tʲ` remain unclickable unless exact clips are added.
- `src/__tests__/language-phonology-inventory.test.ts`
  - New hard/soft stop and labial pair anchors stay `score-only-unverified`
    until exact local clips exist.
- `src/__tests__/azure-phoneme-map-language-parity.test.ts`
  - New hard/soft labial pair aliases score correctly while `getPhonemeAudioUrl`
    remains `null`.
- `src/__tests__/language-source-alignment.test.ts`
  - Rule/proxy Russian units do not show exact header speakers.
  - `ru-final-devoicing` remains connected-speech aware.
- `src/__tests__/language-feedback-rules.test.ts`
  - Russian feedback includes stress, weak vowels, hard/soft, final devoicing,
    voicing assimilation, and clusters when evidence is present.

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

## Russian Completion Goal

Russian is ready to move from experimental content toward public beta only when:

- The app has a source-backed hard/soft inventory and pair map.
- Stress and reduced vowels are modeled as a connected system.
- Rule units never pretend to be exact phoneme speakers.
- Russian feedback distinguishes isolated words from connected speech.
- Tests lock the hard/soft, reduction, devoicing, assimilation, and cluster
  boundaries.
