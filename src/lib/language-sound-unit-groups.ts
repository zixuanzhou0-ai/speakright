import { getLanguagePhonemes } from "@/lib/language-phonemes";
import type { LanguageId } from "@/types/language";
import type { PhonemeData, SoundUnitType } from "@/types/phoneme";

export type SoundUnitDisplayType =
  | "phoneme"
  | "contrast"
  | "rule"
  | "flow";

export interface SoundUnitGroupDefinition {
  id: string;
  label: string;
  description: string;
  displayType: SoundUnitDisplayType;
  slugs: string[];
}

export interface SoundUnitGroup
  extends Omit<SoundUnitGroupDefinition, "slugs"> {
  units: PhonemeData[];
}

export const LANGUAGE_SOUND_UNIT_GROUPS: Record<
  LanguageId,
  SoundUnitGroupDefinition[]
> = {
  "en-US": [
    {
      id: "vowels",
      label: "元音",
      description: "美式英语元音与双元音。",
      displayType: "phoneme",
      slugs: [
        "ee",
        "ih",
        "ey",
        "eh",
        "ae",
        "ah",
        "aw",
        "oh",
        "uh",
        "oo",
        "uh2",
        "schwa",
        "er",
        "ai",
        "au",
        "oi",
      ],
    },
    {
      id: "consonants",
      label: "辅音",
      description: "美式英语核心辅音。",
      displayType: "phoneme",
      slugs: [
        "p",
        "b",
        "t",
        "d",
        "k",
        "g",
        "f",
        "v",
        "th",
        "dh",
        "s",
        "z",
        "sh",
        "zh",
        "ch",
        "dj",
        "m",
        "n",
        "ng",
        "l",
        "r",
        "w",
        "y",
        "h",
      ],
    },
  ],
  "es-ES": [
    {
      id: "pure-vowels",
      label: "纯元音",
      description: "西班牙语五个稳定、清晰的纯元音。",
      displayType: "phoneme",
      slugs: ["es-a", "es-e", "es-i", "es-o", "es-u"],
    },
    {
      id: "core-consonants",
      label: "核心辅音",
      description: "需要单独建立口型和舌位的西语核心辅音。",
      displayType: "phoneme",
      slugs: [
        "es-p",
        "es-t",
        "es-k",
        "es-f",
        "es-m",
        "es-n",
        "es-b-stop",
        "es-d-stop",
        "es-g-stop",
        "es-theta",
        "es-x",
        "es-ny",
        "es-tap-r",
        "es-trill-r",
        "es-s",
        "es-ch",
        "es-l",
      ],
    },
    {
      id: "contrasts-variants",
      label: "对比/变体",
      description: "字母到发音、位置变体和学习者易混对比。",
      displayType: "contrast",
      slugs: ["es-bv", "es-d", "es-g", "es-y-ll", "es-nasal-place"],
    },
    {
      id: "diphthongs-glides",
      label: "双元音/滑音",
      description: "i/u 形成的滑音和双元音组合。",
      displayType: "flow",
      slugs: ["es-diphthongs-j", "es-diphthongs-w"],
    },
    {
      id: "stress-rhythm",
      label: "重音与节奏",
      description: "词重音、音节节奏和短语层面的清晰度。",
      displayType: "rule",
      slugs: ["es-lexical-stress", "es-syllable-rhythm"],
    },
  ],
  "fr-FR": [
    {
      id: "oral-vowels",
      label: "口腔元音",
      description: "法语口腔元音和央元音对比。",
      displayType: "phoneme",
      slugs: [
        "fr-i",
        "fr-y",
        "fr-u",
        "fr-e",
        "fr-e-open",
        "fr-eu-close",
        "fr-eu-open",
        "fr-a",
        "fr-o-close",
        "fr-o-open",
      ],
    },
    {
      id: "nasal-vowels",
      label: "鼻化元音",
      description: "法语鼻化元音，重点区分口腔元音加鼻辅音。",
      displayType: "phoneme",
      slugs: ["fr-an", "fr-in", "fr-on", "fr-un"],
    },
    {
      id: "consonants-glides",
      label: "辅音与滑音",
      description: "法语核心辅音、小舌 r、腭音和半元音。",
      displayType: "phoneme",
      slugs: [
        "fr-r",
        "fr-p",
        "fr-b",
        "fr-t",
        "fr-d",
        "fr-k",
        "fr-g",
        "fr-f",
        "fr-v",
        "fr-s",
        "fr-z",
        "fr-m",
        "fr-n",
        "fr-l",
        "fr-sh",
        "fr-zh",
        "fr-ny",
        "fr-glide-j",
        "fr-glide-hui",
        "fr-glide-w",
      ],
    },
    {
      id: "liaison-silent-rules",
      label: "连读/静音规则",
      description: "连诵、联诵、省音和词尾辅音静音，按短语证据训练。",
      displayType: "rule",
      slugs: [
        "fr-schwa",
        "fr-final-consonant-silence",
        "fr-liaison",
        "fr-enchainement",
        "fr-elision",
      ],
    },
    {
      id: "phrase-prosody",
      label: "短语韵律",
      description: "法语节奏组末尾突出，不按英语给每个内容词加重音。",
      displayType: "rule",
      slugs: ["fr-phrase-final-prominence"],
    },
  ],
  "ru-RU": [
    {
      id: "vowels",
      label: "元音",
      description: "俄语元音及其在重音位置的清晰发音。",
      displayType: "phoneme",
      slugs: ["ru-a", "ru-o", "ru-e", "ru-i", "ru-y", "ru-u"],
    },
    {
      id: "hard-soft-consonants",
      label: "硬软辅音",
      description: "硬辅音与软辅音对比，包括软音符号提示。",
      displayType: "contrast",
      slugs: [
        "ru-hard-soft",
        "ru-soft-t-d",
        "ru-t-tj",
        "ru-d-dj",
        "ru-soft-s-z",
        "ru-soft-n-l-r",
        "ru-s-sj",
        "ru-z-zj",
        "ru-n-nj",
        "ru-l-lj",
        "ru-r-rj",
        "ru-soft-labials",
        "ru-p-pj",
        "ru-b-bj",
        "ru-m-mj",
        "ru-f-fj",
        "ru-v-vj",
        "ru-k-kj",
        "ru-g-gj",
        "ru-x-xj",
        "ru-soft-sign",
      ],
    },
    {
      id: "core-consonants",
      label: "核心辅音",
      description: "俄语需要重点建立舌位的核心辅音。",
      displayType: "phoneme",
      slugs: [
        "ru-p",
        "ru-b",
        "ru-t",
        "ru-d",
        "ru-k",
        "ru-g",
        "ru-f",
        "ru-v",
        "ru-s",
        "ru-z",
        "ru-m",
        "ru-n",
        "ru-l",
        "ru-r",
        "ru-x",
        "ru-sh-zh",
        "ru-sh",
        "ru-zh",
        "ru-ts-ch-shch",
        "ru-ts",
        "ru-ch",
        "ru-shch",
        "ru-j",
      ],
    },
    {
      id: "stress-reduction",
      label: "重音与弱化",
      description: "词重音与非重读元音弱化。",
      displayType: "rule",
      slugs: [
        "ru-stress-reduction",
        "ru-unstressed-o-a",
        "ru-unstressed-e-ya",
      ],
    },
    {
      id: "spelling-to-speech",
      label: "拼写到发音规则",
      description: "字母组合、清浊同化、词尾清化和辅音丛语流规则。",
      displayType: "rule",
      slugs: [
        "ru-iotated-vowels",
        "ru-final-devoicing",
        "ru-voicing-assimilation",
        "ru-clusters",
      ],
    },
  ],
};

const DISPLAY_TYPE_LABELS: Record<SoundUnitDisplayType, string> = {
  phoneme: "音素",
  contrast: "对比",
  rule: "规则",
  flow: "语流",
};

const SOUND_UNIT_TYPE_LABELS: Record<SoundUnitType, string> = {
  phoneme: "音素",
  allophone: "实现",
  contrast: "对比",
  "connected-speech-rule": "规则",
  prosody: "规则",
};

export function getLanguageSoundUnitGroups(
  languageId: LanguageId,
): SoundUnitGroup[] {
  const unitsBySlug = new Map(
    getLanguagePhonemes(languageId).map((unit) => [unit.slug, unit]),
  );

  return LANGUAGE_SOUND_UNIT_GROUPS[languageId].map((group) => ({
    ...group,
    units: group.slugs
      .map((slug) => unitsBySlug.get(slug))
      .filter((unit): unit is PhonemeData => Boolean(unit)),
  }));
}

export function getSoundUnitGroupForSlug(
  languageId: LanguageId,
  slug: string,
): SoundUnitGroup | undefined {
  return getLanguageSoundUnitGroups(languageId).find((group) =>
    group.units.some((unit) => unit.slug === slug),
  );
}

export function getSoundUnitDisplayTypeLabel(
  displayType: SoundUnitDisplayType,
): string {
  return DISPLAY_TYPE_LABELS[displayType];
}

export function getSoundUnitCardLabel(phoneme: PhonemeData): string {
  const languageId = phoneme.languageId ?? "en-US";

  if (languageId === "en-US") {
    return phoneme.category === "vowel" ? "元音" : "辅音";
  }

  const type = phoneme.soundUnitType ?? "phoneme";
  return SOUND_UNIT_TYPE_LABELS[type];
}

export function isRuleLikeSoundUnit(phoneme: PhonemeData): boolean {
  return (
    phoneme.soundUnitType === "connected-speech-rule" ||
    phoneme.soundUnitType === "prosody" ||
    phoneme.category === "prosody"
  );
}
