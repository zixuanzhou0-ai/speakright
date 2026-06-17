import { getAllAssessmentSegmentAudioRegistryEntries } from "@/lib/assessment-segment-audio";
import { getLocalLanguagePhonemeAsset } from "@/lib/local-language-assets";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import { isRuleLikeSoundUnit } from "@/lib/language-sound-unit-groups";
import { shouldShowSoundUnitHeaderAudio } from "@/lib/language-source-alignment";
import type { LanguageId } from "@/types/language";
import type { PhonemeData } from "@/types/phoneme";

export type NonEnglishLanguageId = Exclude<LanguageId, "en-US">;

export type PhonologyInventoryLayer =
  | "phoneme"
  | "allophone"
  | "contrast"
  | "connected-speech-rule"
  | "prosody"
  | "cluster";

export type PhonologyInventoryAudioStatus =
  | "exact-local-header"
  | "proxy-local-reference"
  | "rule-only"
  | "gap-no-local-clip";

export type PhonologyInventoryTilePolicy =
  | "clickable-exact-header"
  | "score-only-unverified"
  | "rule-guidance-only";

interface PhonologyInventoryBaseEntry {
  slug: string;
  layer: PhonologyInventoryLayer;
  variantScope: string;
  sourceRefs: string[];
  gaps?: string[];
}

export interface LanguagePhonologyInventoryEntry
  extends PhonologyInventoryBaseEntry {
  languageId: NonEnglishLanguageId;
  ipa: string;
  soundUnitType: NonNullable<PhonemeData["soundUnitType"]>;
  audioStatus: PhonologyInventoryAudioStatus;
  tilePolicy: PhonologyInventoryTilePolicy;
  exactAssessmentAliases: string[];
  gaps: string[];
  headerAudioSrc?: string;
}

export interface LanguagePhonologyGap {
  id: string;
  label: string;
  layer: PhonologyInventoryLayer;
  reason: string;
  expectedBeforeStable: boolean;
  sourceRefs: string[];
}

const LAYER_LABELS: Record<PhonologyInventoryLayer, string> = {
  phoneme: "音素",
  allophone: "实现音",
  contrast: "对比/变体",
  "connected-speech-rule": "语流规则",
  prosody: "韵律/重音",
  cluster: "辅音丛",
};

const AUDIO_STATUS_LABELS: Record<PhonologyInventoryAudioStatus, string> = {
  "exact-local-header": "精确短音频",
  "proxy-local-reference": "代理参考",
  "rule-only": "规则说明",
  "gap-no-local-clip": "缺少短音频",
};

const TILE_POLICY_SHORT_LABELS: Record<PhonologyInventoryTilePolicy, string> = {
  "clickable-exact-header": "精确短音频",
  "score-only-unverified": "音频未验证",
  "rule-guidance-only": "规则说明",
};

const TILE_POLICY_DESCRIPTIONS: Record<PhonologyInventoryTilePolicy, string> = {
  "clickable-exact-header": "评分 tile 可播放同源本地短音频。",
  "score-only-unverified": "评分 tile 只显示分数，不播放未验证音频。",
  "rule-guidance-only": "按规则/短语证据训练，不作单音播放。",
};

const SHARED_SOURCES = ["ipa-handbook"];
const SPANISH_CORE_SOURCES = [
  "rae-ngle-phonology",
  "jipa-castilian-spanish",
  ...SHARED_SOURCES,
];
const FRENCH_CORE_SOURCES = ["jipa-french", ...SHARED_SOURCES];
const RUSSIAN_CORE_SOURCES = ["jipa-russian", ...SHARED_SOURCES];

function row(
  slug: string,
  layer: PhonologyInventoryLayer,
  variantScope: string,
  sourceRefs: string[],
  gaps?: string[],
): PhonologyInventoryBaseEntry {
  return { slug, layer, variantScope, sourceRefs, gaps };
}

const SPANISH_INVENTORY_BASE: PhonologyInventoryBaseEntry[] = [
  row(
    "es-a",
    "phoneme",
    "Core Castilian Spanish vowel; short, pure, and stable across stress positions.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-e",
    "phoneme",
    "Core five-vowel system; learner target is monophthongal /e/, not English /eɪ/.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-i",
    "phoneme",
    "Core high front vowel; keep it short and avoid English-style length transfer.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-o",
    "phoneme",
    "Core back rounded vowel; learner target is monophthongal /o/, not English /oʊ/.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-u",
    "phoneme",
    "Core high back rounded vowel; short target without English /uː/ length.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-p",
    "phoneme",
    "Plain Spanish /p/ is unaspirated; keep it short and separate from English aspirated word-initial p.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["No verified exact local /p/ header clip exists yet."],
  ),
  row(
    "es-t",
    "phoneme",
    "Plain Spanish /t/ is dental and unaspirated; do not import English alveolar aspiration.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["No verified exact local /t/ header clip exists yet."],
  ),
  row(
    "es-k",
    "phoneme",
    "Plain Spanish /k/ is unaspirated and can be spelled c, qu, or k depending on context.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["No verified exact local /k/ header clip exists yet."],
  ),
  row(
    "es-f",
    "phoneme",
    "Plain Spanish /f/ is a voiceless labiodental fricative, not an English /v/ substitute.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["No verified exact local /f/ header clip exists yet."],
  ),
  row(
    "es-m",
    "phoneme",
    "Plain Spanish /m/ is a bilabial nasal; contextual nasal place changes remain a separate rule unit.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["No verified exact local /m/ header clip exists yet."],
  ),
  row(
    "es-n",
    "phoneme",
    "Plain Spanish /n/ is a dental/alveolar nasal anchor; place assimilation is trained separately.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["No verified exact local /n/ header clip exists yet."],
  ),
  row(
    "es-b-stop",
    "phoneme",
    "Plain Spanish /b/ phoneme anchor for stop-position realizations after pause or nasal; b/v spelling does not split into English /b/ vs /v/.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es", "spanishdict-pronunciation"],
    ["No verified exact local stop-position /b/ header clip exists yet."],
  ),
  row(
    "es-d-stop",
    "phoneme",
    "Plain Spanish /d/ phoneme anchor for dental stop-position realizations after pause, /n/, or /l/.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["No verified exact local dental stop-position /d/ header clip exists yet."],
  ),
  row(
    "es-g-stop",
    "phoneme",
    "Plain Spanish /g/ phoneme anchor for stop-position realizations after pause or nasal; separate from /x/ for j/ge/gi.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["No verified exact local stop-position /g/ header clip exists yet."],
  ),
  row(
    "es-bv",
    "allophone",
    "Spanish /b/ grapheme b/v has stop [b] after pause or nasal and approximant [β̞] between vowels.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es", "spanishdict-pronunciation"],
  ),
  row(
    "es-d",
    "allophone",
    "Spanish /d/ alternates between dental stop [d] and intervocalic approximant [ð̞].",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-g",
    "allophone",
    "Spanish /g/ alternates between stop [g] and intervocalic approximant [ɣ̞].",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-theta",
    "phoneme",
    "Castilian /θ/ for c/z before front vowels or z; seseo dialects merge this target with /s/.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es", "ipatics-es-ipa"],
    ["Dialect selector for seseo vs distincion is still planned."],
  ),
  row(
    "es-x",
    "phoneme",
    "Velar fricative /x/ for j and ge/gi in the current es-ES target.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-ny",
    "phoneme",
    "Palatal nasal /ɲ/ is a single consonant target, not /n/ plus /j/.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-tap-r",
    "phoneme",
    "Tap /ɾ/ is a single tongue contact and contrasts with trilled /r/.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es", "ipatics-es-ipa"],
  ),
  row(
    "es-trill-r",
    "phoneme",
    "Trill /r/ requires sustained apical vibration and contrasts with tap /ɾ/.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es", "ipatics-es-ipa"],
  ),
  row(
    "es-s",
    "phoneme",
    "Castilian /s/ remains distinct from /θ/ in this profile; seseo is a dialect variant.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["Dialect-aware feedback for seseo is still planned."],
  ),
  row(
    "es-ch",
    "phoneme",
    "Affricate /tʃ/ for ch; keep it compact and separate from /x/.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-y-ll",
    "contrast",
    "Yeismo target /ʝ/ for y/ll, with /ʎ/ preserved as a regional contrast to describe, not overclaim.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["Regional /ʎ/ training and dialect selector are not implemented."],
  ),
  row(
    "es-l",
    "phoneme",
    "Clear Spanish /l/ without English word-final dark-L transfer.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-nasal-place",
    "connected-speech-rule",
    "Nasal place changes before following consonants; this is a contextual rule, not one clickable phoneme.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
    ["Exact separate /m n ŋ/ short clips are not fully verified for tile playback."],
  ),
  row(
    "es-diphthongs-j",
    "prosody",
    "Front glide /j/ inside Spanish diphthongs; keep neighboring vowels pure.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-diphthongs-w",
    "prosody",
    "Back rounded glide /w/ inside Spanish diphthongs; avoid swallowing either vowel.",
    [...SPANISH_CORE_SOURCES, "sounds-of-speech-es"],
  ),
  row(
    "es-lexical-stress",
    "prosody",
    "Lexical stress can change meaning and must be trained at word level, not as a standalone segment.",
    [...SPANISH_CORE_SOURCES, "easypronunciation-es-ipa", "ipatics-es-ipa"],
    ["No exact local single-click stress lesson audio exists yet."],
  ),
  row(
    "es-syllable-rhythm",
    "prosody",
    "Spanish rhythm is syllable-forward; avoid importing English stress-timed reduction.",
    [...SPANISH_CORE_SOURCES],
    ["No exact local rhythm lesson clip exists yet."],
  ),
];

const FRENCH_INVENTORY_BASE: PhonologyInventoryBaseEntry[] = [
  row("fr-i", "phoneme", "Core oral vowel /i/.", [...FRENCH_CORE_SOURCES, "phonetique-ca"]),
  row(
    "fr-y",
    "phoneme",
    "Front rounded /y/; keep /i/ tongue position with rounded lips.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
  ),
  row("fr-u", "phoneme", "Back rounded /u/ distinct from front rounded /y/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-e", "phoneme", "Close-mid front oral vowel /e/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-e-open", "phoneme", "Open-mid front oral vowel /ɛ/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-eu-close", "phoneme", "Close-mid front rounded /ø/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-eu-open", "phoneme", "Open-mid front rounded /œ/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-an", "phoneme", "Nasal vowel /ɑ̃/ without a clear final nasal consonant.", [
    ...FRENCH_CORE_SOURCES,
    "lawless-french-ipa",
    "phonetique-ca",
  ]),
  row("fr-in", "phoneme", "Nasal vowel /ɛ̃/; contrast with /ɑ̃/ and /ɔ̃/.", [
    ...FRENCH_CORE_SOURCES,
    "lawless-french-ipa",
    "phonetique-ca",
  ]),
  row("fr-on", "phoneme", "Rounded nasal vowel /ɔ̃/.", [
    ...FRENCH_CORE_SOURCES,
    "lawless-french-ipa",
    "phonetique-ca",
  ]),
  row(
    "fr-r",
    "phoneme",
    "Uvular /ʁ/ target, not English rhotic or Spanish trill.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
  ),
  row(
    "fr-p",
    "phoneme",
    "Plain French /p/ is a voiceless bilabial stop; keep it short and avoid English-style aspiration.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /p/ header clip exists yet."],
  ),
  row(
    "fr-b",
    "phoneme",
    "Plain French /b/ is a voiced bilabial stop and contrasts with /p/ by voicing.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /b/ header clip exists yet."],
  ),
  row(
    "fr-t",
    "phoneme",
    "Plain French /t/ is a short coronal stop with less aspiration than English word-initial t.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /t/ header clip exists yet."],
  ),
  row(
    "fr-d",
    "phoneme",
    "Plain French /d/ is a voiced coronal stop; do not turn it into an English-style flap.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /d/ header clip exists yet."],
  ),
  row(
    "fr-k",
    "phoneme",
    "Plain French /k/ is a voiceless velar stop and may be spelled c, qu, or k.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /k/ header clip exists yet."],
  ),
  row(
    "fr-g",
    "phoneme",
    "Plain French hard /g/ is a voiced velar stop; soft g before front vowels belongs to /ʒ/.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /g/ header clip exists yet."],
  ),
  row(
    "fr-f",
    "phoneme",
    "Plain French /f/ is a voiceless labiodental fricative and contrasts with /v/.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /f/ header clip exists yet."],
  ),
  row(
    "fr-v",
    "phoneme",
    "Plain French /v/ is a voiced labiodental fricative; avoid /w/ or /f/ transfer.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /v/ header clip exists yet."],
  ),
  row(
    "fr-s",
    "phoneme",
    "Plain French /s/ is a voiceless alveolar fricative; intervocalic spelling s may instead map to /z/.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /s/ header clip exists yet."],
  ),
  row(
    "fr-z",
    "phoneme",
    "Plain French /z/ is the voiced counterpart of /s/ and occurs in z, intervocalic s, and some final spellings.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /z/ header clip exists yet."],
  ),
  row(
    "fr-m",
    "phoneme",
    "Plain French /m/ is a bilabial nasal; keep it separate from nasal vowel spelling.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /m/ header clip exists yet."],
  ),
  row(
    "fr-n",
    "phoneme",
    "Plain French /n/ is an alveolar nasal; do not pronounce silent nasal letters after nasal vowels as full /n/.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /n/ header clip exists yet."],
  ),
  row(
    "fr-l",
    "phoneme",
    "Plain French /l/ stays clear and forward; avoid English word-final dark-L transfer.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No verified exact local /l/ header clip exists yet."],
  ),
  row(
    "fr-liaison",
    "connected-speech-rule",
    "Latent final consonants surface only in licensed phrase contexts.",
    [...FRENCH_CORE_SOURCES, "openipa-fr", "lawless-french-ipa"],
    ["No exact local single-click liaison rule clip exists yet."],
  ),
  row("fr-a", "phoneme", "Core /a/; modern /ɑ/ merger is treated as a variant.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row(
    "fr-schwa",
    "prosody",
    "E caduc /ə/ is context-sensitive and may be present, reduced, or deleted.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["Sentence-level schwa deletion rules still need fuller coaching coverage."],
  ),
  row("fr-o-close", "phoneme", "Close-mid rounded /o/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-o-open", "phoneme", "Open-mid rounded /ɔ/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row(
    "fr-un",
    "contrast",
    "Traditional /œ̃/ target; many modern accents merge it with /ɛ̃/.",
    [...FRENCH_CORE_SOURCES, "lawless-french-ipa", "phonetique-ca"],
    ["Merge-aware scoring is planned; do not mark merged native accents as simply wrong."],
  ),
  row("fr-sh", "phoneme", "Fricative /ʃ/ for ch, not /tʃ/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-zh", "phoneme", "Voiced fricative /ʒ/ for j/soft g, not /dʒ/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-ny", "phoneme", "Palatal nasal /ɲ/ for gn.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-glide-j", "contrast", "Short yod glide /j/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-glide-hui", "contrast", "Front rounded glide /ɥ/, distinct from /w/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row("fr-glide-w", "contrast", "Back rounded glide /w/.", [
    ...FRENCH_CORE_SOURCES,
    "phonetique-ca",
  ]),
  row(
    "fr-final-consonant-silence",
    "connected-speech-rule",
    "Many written final consonants are silent in isolation but can reappear in liaison or derived forms.",
    [...FRENCH_CORE_SOURCES, "openipa-fr", "lawless-french-ipa"],
    ["No exact local single-click final-silence rule clip exists yet."],
  ),
  row(
    "fr-enchainement",
    "connected-speech-rule",
    "Pronounced final consonants resyllabify onto following vowel-initial words.",
    [...FRENCH_CORE_SOURCES, "openipa-fr"],
    ["No exact local single-click enchainement rule clip exists yet."],
  ),
  row(
    "fr-elision",
    "connected-speech-rule",
    "Weak vowel deletion before vowel-initial words creates forms such as j'aime and l'ami.",
    [...FRENCH_CORE_SOURCES, "openipa-fr"],
    ["No exact local single-click elision rule clip exists yet."],
  ),
  row(
    "fr-phrase-final-prominence",
    "prosody",
    "French prominence is rhythmic-group/phrase-final rather than English-style lexical stress on each content word.",
    [...FRENCH_CORE_SOURCES, "phonetique-ca"],
    ["No exact local sentence-rhythm evidence clip exists for clickable scoring tiles yet."],
  ),
];

const RUSSIAN_INVENTORY_BASE: PhonologyInventoryBaseEntry[] = [
  row("ru-a", "phoneme", "Russian /a/ with stress-sensitive quality.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row("ru-o", "phoneme", "Stressed /o/; unstressed о belongs to reduction rules.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row("ru-i", "phoneme", "Front /i/ often paired with consonant palatalization.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row("ru-y", "phoneme", "Learner-facing /ɨ/ target for ы.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row("ru-u", "phoneme", "Russian /u/ with stress-sensitive reduction.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row(
    "ru-hard-soft",
    "contrast",
    "Systemic hard/soft consonant contrast, not one added /j/ sound.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["Grouped proxy video only; per-consonant hard/soft exact clips are incomplete."],
  ),
  row("ru-r", "phoneme", "Russian trill /r/ with hard and soft variants.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row("ru-x", "phoneme", "Velar fricative /x/.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row(
    "ru-sh-zh",
    "contrast",
    "Always-hard retroflex-like /ʂ ʐ/ contrast.",
    [...RUSSIAN_CORE_SOURCES, "seeing-speech-ru"],
    ["The current exact tile audio covers /ʂ/ only; /ʐ/ remains unclickable."],
  ),
  row(
    "ru-ts-ch-shch",
    "contrast",
    "Affricate/fricative set /ts tɕ ɕː/ grouped for learning.",
    [...RUSSIAN_CORE_SOURCES, "seeing-speech-ru"],
    ["Grouped unit is a proxy; individual /ts/, /tɕ/, /ɕː/ units carry exact tile audio."],
  ),
  row(
    "ru-stress-reduction",
    "prosody",
    "Mobile stress changes vowel quality; score at word/phrase level.",
    [...RUSSIAN_CORE_SOURCES, "easypronunciation-ru-trainer"],
    ["No exact single-click stress-reduction lesson audio exists yet."],
  ),
  row(
    "ru-clusters",
    "cluster",
    "Russian consonant clusters should not gain inserted vowels.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No exact single-click cluster lesson audio exists yet."],
  ),
  row("ru-e", "phoneme", "Stressed /e/ with spelling-dependent palatalization context.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row(
    "ru-soft-t-d",
    "contrast",
    "Hard/soft coronal stop contrast /t tʲ d dʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["Proxy anchor only; exact per-segment soft stop clips are incomplete."],
  ),
  row(
    "ru-t-tj",
    "contrast",
    "Hard/soft coronal stop contrast /t tʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /t/ or /tʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-d-dj",
    "contrast",
    "Hard/soft voiced coronal stop contrast /d dʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /d/ or /dʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-soft-s-z",
    "contrast",
    "Hard/soft sibilant contrast /s sʲ z zʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["Proxy anchor only; exact per-segment soft fricative clips are incomplete."],
  ),
  row(
    "ru-soft-n-l-r",
    "contrast",
    "Hard/soft sonorant contrast /n nʲ l lʲ r rʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["Proxy anchor only; exact per-segment soft sonorant clips are incomplete."],
  ),
  row(
    "ru-s-sj",
    "contrast",
    "Hard/soft voiceless sibilant contrast /s sʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /s/ or /sʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-z-zj",
    "contrast",
    "Hard/soft voiced sibilant contrast /z zʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /z/ or /zʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-n-nj",
    "contrast",
    "Hard/soft nasal contrast /n nʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /n/ or /nʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-l-lj",
    "contrast",
    "Hard/soft lateral contrast /l lʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /l/ or /lʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-r-rj",
    "contrast",
    "Hard/soft rhotic contrast /r rʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /r/ or /rʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-soft-labials",
    "contrast",
    "Soft labial contrast /pʲ bʲ mʲ fʲ vʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["Proxy anchor only; exact per-segment soft labial clips are incomplete."],
  ),
  row(
    "ru-p-pj",
    "contrast",
    "Hard/soft labial stop contrast /p pʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /p/ or /pʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-b-bj",
    "contrast",
    "Hard/soft voiced labial stop contrast /b bʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /b/ or /bʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-m-mj",
    "contrast",
    "Hard/soft labial nasal contrast /m mʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /m/ or /mʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-f-fj",
    "contrast",
    "Hard/soft labiodental fricative contrast /f fʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /f/ or /fʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-v-vj",
    "contrast",
    "Hard/soft voiced labiodental fricative contrast /v vʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /v/ or /vʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-k-kj",
    "contrast",
    "Hard/soft velar stop contrast /k kʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /k/ or /kʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-g-gj",
    "contrast",
    "Hard/soft voiced velar stop contrast /g gʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /g/ or /gʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-x-xj",
    "contrast",
    "Hard/soft velar fricative contrast /x xʲ/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["No verified exact single-segment /x/ or /xʲ/ short clip is bundled yet."],
  ),
  row(
    "ru-soft-sign",
    "contrast",
    "Soft sign marks palatalization and is not an independent vowel or /j/.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["Proxy /j/ articulatory reference stays unclickable for assessment tiles."],
  ),
  row("ru-ts", "phoneme", "Always-hard affricate /ts/.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row("ru-ch", "phoneme", "Always-soft affricate /tɕ/.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row("ru-shch", "phoneme", "Long soft fricative /ɕː/.", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row("ru-j", "phoneme", "Short /j/ glide; separate from palatalization [ʲ].", [
    ...RUSSIAN_CORE_SOURCES,
    "seeing-speech-ru",
  ]),
  row(
    "ru-iotated-vowels",
    "connected-speech-rule",
    "я/е/ё/ю mark /j/ onset or preceding-consonant palatalization depending on position.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["Rule unit uses proxy material only; exact tile audio stays disabled."],
  ),
  row(
    "ru-unstressed-o-a",
    "prosody",
    "Unstressed о/а reduce toward [ɐ]/[ə] depending on stress distance and context.",
    [...RUSSIAN_CORE_SOURCES, "easypronunciation-ru-trainer"],
    ["Current reduction clips are references, not full exact rule lessons."],
  ),
  row(
    "ru-unstressed-e-ya",
    "prosody",
    "Unstressed е/я reduce toward [ɪ]/[ə] with palatalization context.",
    [...RUSSIAN_CORE_SOURCES, "easypronunciation-ru-trainer"],
    ["Current reduction clips are references, not full exact rule lessons."],
  ),
  row(
    "ru-final-devoicing",
    "connected-speech-rule",
    "Word-final voiced obstruents devoice before pause or voiceless consonants, but resurface in some linked contexts.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["Proxy clip remains unclickable; rule needs phrase-level audio evidence."],
  ),
  row(
    "ru-voicing-assimilation",
    "connected-speech-rule",
    "Regressive voicing assimilation across adjacent obstruents, with /v/ behavior needing careful treatment.",
    [...RUSSIAN_CORE_SOURCES, "wiktionary-ru-pronunciation-appendix"],
    ["Proxy clip remains unclickable; /v/ caveat still needs richer coaching."],
  ),
];

const PHONOLOGY_INVENTORY_BASE: Record<
  NonEnglishLanguageId,
  PhonologyInventoryBaseEntry[]
> = {
  "es-ES": SPANISH_INVENTORY_BASE,
  "fr-FR": FRENCH_INVENTORY_BASE,
  "ru-RU": RUSSIAN_INVENTORY_BASE,
};

export const LANGUAGE_PHONOLOGY_GAPS: Record<
  NonEnglishLanguageId,
  LanguagePhonologyGap[]
> = {
  "es-ES": [
    {
      id: "es-common-plain-consonants",
      label: "/p t k f m n b d g/ 精确短音频",
      layer: "phoneme",
      reason:
        "These Spanish phoneme units now exist as course/scoring anchors, but the current local header inventory has not verified exact standalone clips for them.",
      expectedBeforeStable: true,
      sourceRefs: SPANISH_CORE_SOURCES,
    },
    {
      id: "es-dialect-selector",
      label: "seseo / yeismo variants",
      layer: "contrast",
      reason:
        "The es-ES target describes Castilian distincion and common yeismo, but dialect-aware scoring UI is not implemented.",
      expectedBeforeStable: false,
      sourceRefs: SPANISH_CORE_SOURCES,
    },
  ],
  "fr-FR": [
    {
      id: "fr-common-consonants",
      label: "/p b t d k g f v s z m n l/ 精确短音频",
      layer: "phoneme",
      reason:
        "These French phoneme units now exist, but the current local header inventory has not verified exact standalone clips for them.",
      expectedBeforeStable: true,
      sourceRefs: FRENCH_CORE_SOURCES,
    },
    {
      id: "fr-phrase-rule-clips",
      label:
        "liaison / enchainement / elision / final silence / phrase-final prominence",
      layer: "connected-speech-rule",
      reason:
        "Phrase rules and phrase-final prominence are modeled in content, but no exact local rule/prosody audio exists for clickable scoring tiles.",
      expectedBeforeStable: true,
      sourceRefs: FRENCH_CORE_SOURCES,
    },
  ],
  "ru-RU": [
    {
      id: "ru-full-hard-soft-inventory",
      label: "complete hard/soft consonant pairs",
      layer: "contrast",
      reason:
        "Russian hard/soft consonants are systemic. Standalone coronal stop, sibilant, sonorant, labial, and velar pair anchors now exist, but the full per-consonant exact audio inventory is still incomplete.",
      expectedBeforeStable: true,
      sourceRefs: RUSSIAN_CORE_SOURCES,
    },
    {
      id: "ru-phrase-rule-evidence",
      label: "reduction / devoicing / assimilation / clusters",
      layer: "connected-speech-rule",
      reason:
        "The rule units are useful, but exact phrase-level evidence and tile playback remain incomplete.",
      expectedBeforeStable: true,
      sourceRefs: RUSSIAN_CORE_SOURCES,
    },
  ],
};

const exactAssessmentSlugs = new Map<NonEnglishLanguageId, Set<string>>(
  (["es-ES", "fr-FR", "ru-RU"] as const).map((languageId) => [
    languageId,
    new Set(
      getAllAssessmentSegmentAudioRegistryEntries()
        .filter((entry) => entry.languageId === languageId)
        .map((entry) => entry.soundUnitSlug),
    ),
  ]),
);

function audioStatusFor(
  languageId: NonEnglishLanguageId,
  unit: PhonemeData,
): PhonologyInventoryAudioStatus {
  const asset = getLocalLanguagePhonemeAsset(languageId, unit.slug);
  const hasExactAssessment = exactAssessmentSlugs
    .get(languageId)
    ?.has(unit.slug);

  if (hasExactAssessment && shouldShowSoundUnitHeaderAudio(languageId, unit)) {
    return "exact-local-header";
  }

  if (asset?.audioSrc) return "proxy-local-reference";
  if (isRuleLikeSoundUnit(unit)) return "rule-only";
  return "gap-no-local-clip";
}

function tilePolicyFor(
  languageId: NonEnglishLanguageId,
  unit: PhonemeData,
  audioStatus: PhonologyInventoryAudioStatus,
): PhonologyInventoryTilePolicy {
  if (
    audioStatus === "exact-local-header" &&
    exactAssessmentSlugs.get(languageId)?.has(unit.slug)
  ) {
    return "clickable-exact-header";
  }

  return isRuleLikeSoundUnit(unit)
    ? "rule-guidance-only"
    : "score-only-unverified";
}

function exactAliasesFor(
  languageId: NonEnglishLanguageId,
  slug: string,
): string[] {
  return getAllAssessmentSegmentAudioRegistryEntries()
    .filter((entry) => entry.languageId === languageId && entry.soundUnitSlug === slug)
    .flatMap((entry) => entry.aliases);
}

function buildLanguageInventory(
  languageId: NonEnglishLanguageId,
): LanguagePhonologyInventoryEntry[] {
  const units = new Map(
    getLanguagePhonemes(languageId).map((unit) => [unit.slug, unit]),
  );

  return PHONOLOGY_INVENTORY_BASE[languageId].map((base) => {
    const unit = units.get(base.slug);
    if (!unit) {
      throw new Error(`Missing sound unit for inventory row ${languageId}:${base.slug}`);
    }

    const asset = getLocalLanguagePhonemeAsset(languageId, base.slug);
    const audioStatus = audioStatusFor(languageId, unit);

    return {
      ...base,
      languageId,
      ipa: unit.ipa,
      soundUnitType: unit.soundUnitType ?? "phoneme",
      audioStatus,
      tilePolicy: tilePolicyFor(languageId, unit, audioStatus),
      exactAssessmentAliases: exactAliasesFor(languageId, base.slug),
      headerAudioSrc: asset?.audioSrc,
      gaps: base.gaps ?? [],
    };
  });
}

export const LANGUAGE_PHONOLOGY_INVENTORY: Record<
  NonEnglishLanguageId,
  LanguagePhonologyInventoryEntry[]
> = {
  "es-ES": buildLanguageInventory("es-ES"),
  "fr-FR": buildLanguageInventory("fr-FR"),
  "ru-RU": buildLanguageInventory("ru-RU"),
};

export function getLanguagePhonologyInventory(
  languageId: NonEnglishLanguageId,
): LanguagePhonologyInventoryEntry[] {
  return LANGUAGE_PHONOLOGY_INVENTORY[languageId];
}

export function getPhonologyInventoryEntry(
  languageId: NonEnglishLanguageId,
  slug: string,
): LanguagePhonologyInventoryEntry | undefined {
  return LANGUAGE_PHONOLOGY_INVENTORY[languageId].find(
    (entry) => entry.slug === slug,
  );
}

export function getLanguagePhonologyGaps(
  languageId: NonEnglishLanguageId,
): LanguagePhonologyGap[] {
  return LANGUAGE_PHONOLOGY_GAPS[languageId];
}

export function getVisibleLanguagePhonologyGaps(
  languageId: LanguageId,
): LanguagePhonologyGap[] {
  return languageId === "en-US" ? [] : LANGUAGE_PHONOLOGY_GAPS[languageId];
}

export function getPhonologyLayerLabel(
  layer: PhonologyInventoryLayer,
): string {
  return LAYER_LABELS[layer];
}

export function getPhonologyAudioStatusLabel(
  audioStatus: PhonologyInventoryAudioStatus,
): string {
  return AUDIO_STATUS_LABELS[audioStatus];
}

export function getPhonologyTilePolicyLabel(
  tilePolicy: PhonologyInventoryTilePolicy,
): string {
  return TILE_POLICY_SHORT_LABELS[tilePolicy];
}

export function getPhonologyTilePolicyDescription(
  tilePolicy: PhonologyInventoryTilePolicy,
): string {
  return TILE_POLICY_DESCRIPTIONS[tilePolicy];
}
