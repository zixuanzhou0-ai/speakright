# French Phonology Inventory Table

Generated from `src/lib/language-phonology-inventory.ts`. Do not edit the table by hand; run `npm.cmd run phonology:inventory:export` after changing language sound units, source refs, audio status, tile policy, or gaps.

Language profile: `fr-FR`
Product status: experimental

## Current Stable-Before-Release Gaps

- /p b t d k g f v s z m n l/ 精确短音频: These French phoneme units now exist, but the current local header inventory has not verified exact standalone clips for them. Source refs: jipa-french, ipa-handbook.
- liaison / enchainement / elision / final silence / phrase-final prominence: Phrase rules and phrase-final prominence are modeled in content, but no exact local rule/prosody audio exists for clickable scoring tiles. Source refs: jipa-french, ipa-handbook.

## Inventory

| slug | IPA | layer | variant scope | source refs | audio status | tile policy | gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fr-i | /i/ | phoneme | Core oral vowel /i/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-y | /y/ | phoneme | Front rounded /y/; keep /i/ tongue position with rounded lips. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-u | /u/ | phoneme | Back rounded /u/ distinct from front rounded /y/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-e | /e/ | phoneme | Close-mid front oral vowel /e/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-e-open | /ɛ/ | phoneme | Open-mid front oral vowel /ɛ/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-eu-close | /ø/ | phoneme | Close-mid front rounded /ø/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-eu-open | /œ/ | phoneme | Open-mid front rounded /œ/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-an | /ɑ̃/ | phoneme | Nasal vowel /ɑ̃/ without a clear final nasal consonant. | jipa-french, ipa-handbook, lawless-french-ipa, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-in | /ɛ̃/ | phoneme | Nasal vowel /ɛ̃/; contrast with /ɑ̃/ and /ɔ̃/. | jipa-french, ipa-handbook, lawless-french-ipa, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-on | /ɔ̃/ | phoneme | Rounded nasal vowel /ɔ̃/. | jipa-french, ipa-handbook, lawless-french-ipa, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-r | /ʁ/ | phoneme | Uvular /ʁ/ target, not English rhotic or Spanish trill. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-p | /p/ | phoneme | Plain French /p/ is a voiceless bilabial stop; keep it short and avoid English-style aspiration. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /p/ header clip exists yet. |
| fr-b | /b/ | phoneme | Plain French /b/ is a voiced bilabial stop and contrasts with /p/ by voicing. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /b/ header clip exists yet. |
| fr-t | /t/ | phoneme | Plain French /t/ is a short coronal stop with less aspiration than English word-initial t. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /t/ header clip exists yet. |
| fr-d | /d/ | phoneme | Plain French /d/ is a voiced coronal stop; do not turn it into an English-style flap. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /d/ header clip exists yet. |
| fr-k | /k/ | phoneme | Plain French /k/ is a voiceless velar stop and may be spelled c, qu, or k. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /k/ header clip exists yet. |
| fr-g | /g/ | phoneme | Plain French hard /g/ is a voiced velar stop; soft g before front vowels belongs to /ʒ/. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /g/ header clip exists yet. |
| fr-f | /f/ | phoneme | Plain French /f/ is a voiceless labiodental fricative and contrasts with /v/. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /f/ header clip exists yet. |
| fr-v | /v/ | phoneme | Plain French /v/ is a voiced labiodental fricative; avoid /w/ or /f/ transfer. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /v/ header clip exists yet. |
| fr-s | /s/ | phoneme | Plain French /s/ is a voiceless alveolar fricative; intervocalic spelling s may instead map to /z/. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /s/ header clip exists yet. |
| fr-z | /z/ | phoneme | Plain French /z/ is the voiced counterpart of /s/ and occurs in z, intervocalic s, and some final spellings. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /z/ header clip exists yet. |
| fr-m | /m/ | phoneme | Plain French /m/ is a bilabial nasal; keep it separate from nasal vowel spelling. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /m/ header clip exists yet. |
| fr-n | /n/ | phoneme | Plain French /n/ is an alveolar nasal; do not pronounce silent nasal letters after nasal vowels as full /n/. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /n/ header clip exists yet. |
| fr-l | /l/ | phoneme | Plain French /l/ stays clear and forward; avoid English word-final dark-L transfer. | jipa-french, ipa-handbook, phonetique-ca | gap-no-local-clip | score-only-unverified | No verified exact local /l/ header clip exists yet. |
| fr-liaison | /‿/ | connected-speech-rule | Latent final consonants surface only in licensed phrase contexts. | jipa-french, ipa-handbook, openipa-fr, lawless-french-ipa | rule-only | rule-guidance-only | No exact local single-click liaison rule clip exists yet. |
| fr-a | /a/ | phoneme | Core /a/; modern /ɑ/ merger is treated as a variant. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-schwa | /ə/ | prosody | E caduc /ə/ is context-sensitive and may be present, reduced, or deleted. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | Sentence-level schwa deletion rules still need fuller coaching coverage. |
| fr-o-close | /o/ | phoneme | Close-mid rounded /o/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-o-open | /ɔ/ | phoneme | Open-mid rounded /ɔ/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-un | /œ̃/ | contrast | Traditional /œ̃/ target; many modern accents merge it with /ɛ̃/. | jipa-french, ipa-handbook, lawless-french-ipa, phonetique-ca | exact-local-header | clickable-exact-header | Merge-aware scoring is planned; do not mark merged native accents as simply wrong. |
| fr-sh | /ʃ/ | phoneme | Fricative /ʃ/ for ch, not /tʃ/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-zh | /ʒ/ | phoneme | Voiced fricative /ʒ/ for j/soft g, not /dʒ/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-ny | /ɲ/ | phoneme | Palatal nasal /ɲ/ for gn. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-glide-j | /j/ | contrast | Short yod glide /j/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-glide-hui | /ɥ/ | contrast | Front rounded glide /ɥ/, distinct from /w/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-glide-w | /w/ | contrast | Back rounded glide /w/. | jipa-french, ipa-handbook, phonetique-ca | exact-local-header | clickable-exact-header | none |
| fr-final-consonant-silence | silent final C | connected-speech-rule | Many written final consonants are silent in isolation but can reappear in liaison or derived forms. | jipa-french, ipa-handbook, openipa-fr, lawless-french-ipa | rule-only | rule-guidance-only | No exact local single-click final-silence rule clip exists yet. |
| fr-enchainement | enchaînement | connected-speech-rule | Pronounced final consonants resyllabify onto following vowel-initial words. | jipa-french, ipa-handbook, openipa-fr | rule-only | rule-guidance-only | No exact local single-click enchainement rule clip exists yet. |
| fr-elision | elision | connected-speech-rule | Weak vowel deletion before vowel-initial words creates forms such as j'aime and l'ami. | jipa-french, ipa-handbook, openipa-fr | rule-only | rule-guidance-only | No exact local single-click elision rule clip exists yet. |
| fr-phrase-final-prominence | accent final | prosody | French prominence is rhythmic-group/phrase-final rather than English-style lexical stress on each content word. | jipa-french, ipa-handbook, phonetique-ca | rule-only | rule-guidance-only | No exact local sentence-rhythm evidence clip exists for clickable scoring tiles yet. |
