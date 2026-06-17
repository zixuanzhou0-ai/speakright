import {
  getSoundUnitCardLabel,
  isRuleLikeSoundUnit,
} from "@/lib/language-sound-unit-groups";
import type { LanguageId } from "@/types/language";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

export type PracticeTextMode = "word" | "phrase" | "sentence" | "rule";
export type PracticeTextDensity = "short" | "medium" | "long" | "sentence";

export interface PracticeTextPresentation {
  mode: PracticeTextMode;
  density: PracticeTextDensity;
  titleLabel: string;
  primaryText: string;
  secondaryText: string;
  textAlign: "center" | "left";
  isNonEnglish: boolean;
}

const SOUND_UNIT_LABELS: Record<string, string> = {
  "es-bv": "B/V 对比",
  "es-d": "D 近音",
  "es-g": "G 近音",
  "es-y-ll": "Y/LL",
  "es-nasal-place": "鼻音位置",
  "es-diphthongs-j": "双元音 /j/",
  "es-diphthongs-w": "双元音 /w/",
  "es-lexical-stress": "词重音",
  "es-syllable-rhythm": "音节节奏",
  "fr-schwa": "弱读 /ə/",
  "fr-final-consonant-silence": "词尾静音",
  "fr-liaison": "连诵",
  "fr-enchainement": "连读",
  "fr-elision": "省音",
  "fr-phrase-final-prominence": "短语末突出",
  "ru-hard-soft": "硬软辅音",
  "ru-soft-t-d": "软 T/D",
  "ru-soft-s-z": "软 S/Z",
  "ru-soft-n-l-r": "软 N/L/R",
  "ru-soft-labials": "软双唇音",
  "ru-t-tj": "T/Tь",
  "ru-d-dj": "D/Dь",
  "ru-s-sj": "S/Sь",
  "ru-z-zj": "Z/Zь",
  "ru-n-nj": "N/Nь",
  "ru-l-lj": "L/Lь",
  "ru-r-rj": "R/Rь",
  "ru-p-pj": "P/Pь",
  "ru-b-bj": "B/Bь",
  "ru-m-mj": "M/Mь",
  "ru-f-fj": "F/Fь",
  "ru-v-vj": "V/Vь",
  "ru-k-kj": "K/Kь",
  "ru-g-gj": "G/Gь",
  "ru-x-xj": "X/Xь",
  "ru-soft-sign": "软音符号",
  "ru-stress-reduction": "重音弱化",
  "ru-unstressed-o-a": "非重读 O/A",
  "ru-unstressed-e-ya": "非重读 E/Я",
  "ru-iotated-vowels": "带 /j/ 元音",
  "ru-final-devoicing": "词尾清化",
  "ru-voicing-assimilation": "清浊同化",
  "ru-clusters": "辅音丛",
};

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function getPracticeTextDensity(
  text: string,
  mode: PracticeTextMode = "word",
): PracticeTextDensity {
  const normalized = text.trim();
  const length = Array.from(normalized).length;
  const words = wordCount(normalized);

  if (
    mode === "sentence" ||
    /[.!?。！？]$/.test(normalized) ||
    words >= 6 ||
    length >= 48
  ) {
    return "sentence";
  }

  if (mode === "rule" && (words >= 4 || length >= 30)) {
    return "long";
  }

  if (mode === "phrase" || words >= 2 || length >= 22) {
    return length >= 34 || words >= 4 ? "long" : "medium";
  }

  return length >= 14 ? "medium" : "short";
}

const CENTERED_TEXT_BASE =
  "mx-auto max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

const READABLE_TEXT_SIZE: Record<PracticeTextDensity, string> = {
  short: "text-2xl leading-tight",
  medium: "text-xl leading-snug",
  long: "text-lg leading-snug",
  sentence: "text-base leading-relaxed",
};

const PROMINENT_TEXT_SIZE: Record<PracticeTextDensity, string> = {
  short: "text-4xl leading-tight",
  medium: "text-3xl leading-tight",
  long: "text-2xl leading-snug",
  sentence: "text-xl leading-relaxed",
};

const MONO_TEXT_SIZE: Record<PracticeTextDensity, string> = {
  short: "text-sm leading-tight",
  medium: "text-xs leading-relaxed",
  long: "text-xs leading-relaxed",
  sentence: "text-xs leading-relaxed",
};

const COMPACT_TEXT_SIZE: Record<PracticeTextDensity, string> = {
  short: "text-sm leading-tight",
  medium: "text-xs leading-snug",
  long: "text-xs leading-snug",
  sentence: "text-xs leading-snug",
};

export function getCenteredReadableTextClassName(
  density: PracticeTextDensity,
): string {
  return `${CENTERED_TEXT_BASE} ${READABLE_TEXT_SIZE[density]}`;
}

export function getCenteredProminentTextClassName(
  density: PracticeTextDensity,
): string {
  return `${CENTERED_TEXT_BASE} ${PROMINENT_TEXT_SIZE[density]}`;
}

export function getCenteredMonoTextClassName(
  density: PracticeTextDensity,
): string {
  return `${CENTERED_TEXT_BASE} ${MONO_TEXT_SIZE[density]}`;
}

export function getCenteredCompactTextClassName(
  density: PracticeTextDensity,
): string {
  return `${CENTERED_TEXT_BASE} ${COMPACT_TEXT_SIZE[density]}`;
}

function inferMode(
  text: string,
  phoneme: PhonemeData,
  languageId: LanguageId,
): PracticeTextMode {
  if (languageId === "en-US") return "word";
  if (isRuleLikeSoundUnit(phoneme)) return "rule";

  const words = wordCount(text);
  if (/[.!?。！？]/.test(text) || words >= 6 || text.length >= 48) {
    return "sentence";
  }
  if (words >= 2 || text.length >= 22) {
    return "phrase";
  }
  return "word";
}

export function getSoundUnitReadableLabel(phoneme: PhonemeData): string {
  const languageId = phoneme.languageId ?? "en-US";
  if (languageId === "en-US") return phoneme.name;

  const explicit = SOUND_UNIT_LABELS[phoneme.slug];
  if (explicit) return explicit;

  if (phoneme.soundUnitType === "phoneme") return phoneme.ipa;
  if (phoneme.category === "vowel" || phoneme.category === "consonant") {
    return phoneme.ipa;
  }

  return phoneme.ipa || phoneme.name;
}

export function getPracticeTextPresentation(
  currentWord: KeywordEntry | null,
  phoneme: PhonemeData,
  languageId: LanguageId,
): PracticeTextPresentation {
  const isNonEnglish = languageId !== "en-US";
  const primaryText = currentWord?.stressText ?? currentWord?.word ?? "";
  const secondaryText = currentWord?.ipa ?? "";
  const mode = inferMode(primaryText, phoneme, languageId);
  const density = getPracticeTextDensity(primaryText, mode);
  const unitLabel = getSoundUnitReadableLabel(phoneme);

  if (!isNonEnglish) {
    return {
      mode,
      density,
      titleLabel: phoneme.name,
      primaryText,
      secondaryText,
      textAlign: "center",
      isNonEnglish,
    };
  }

  return {
    mode,
    density,
    titleLabel: `${getSoundUnitCardLabel(phoneme)}训练 · ${unitLabel}`,
    primaryText,
    secondaryText,
    textAlign: "center",
    isNonEnglish,
  };
}
