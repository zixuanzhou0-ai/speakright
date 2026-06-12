import type { LanguageId } from "@/types/language";

export interface AssessmentSegmentAudioInfo {
  languageId: Exclude<LanguageId, "en-US">;
  displayIpa: string;
  audioUrl: string;
  kind: "word-example";
  exampleText: string;
  note: string;
}

interface AssessmentSegmentAudioEntry extends AssessmentSegmentAudioInfo {
  aliases: string[];
}

function normalizeSegment(segment: string): string {
  return segment
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[/[\]]/g, "")
    .replace(/[ˈˌ.]/g, "")
    .replace(/[͜͡]/g, "");
}

const SEGMENT_AUDIO_ENTRIES: AssessmentSegmentAudioEntry[] = [
  {
    languageId: "es-ES",
    displayIpa: "/k/",
    aliases: ["k", "c"],
    audioUrl: "/audio/language-packs/es-ES/casa-81bce1f3bf.mp3",
    kind: "word-example",
    exampleText: "casa",
    note: "西语 /k/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "es-ES",
    displayIpa: "/p/",
    aliases: ["p"],
    audioUrl: "/audio/language-packs/es-ES/papa-bec5e7268a.mp3",
    kind: "word-example",
    exampleText: "papá",
    note: "西语 /p/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "es-ES",
    displayIpa: "/t/",
    aliases: ["t"],
    audioUrl: "/audio/language-packs/es-ES/todo-05f20a7178.mp3",
    kind: "word-example",
    exampleText: "todo",
    note: "西语 /t/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "es-ES",
    displayIpa: "/m/",
    aliases: ["m"],
    audioUrl: "/audio/language-packs/es-ES/mano-abf1aa4a5e.mp3",
    kind: "word-example",
    exampleText: "mano",
    note: "西语 /m/ 用本地短词示范，不作为鼻音位置规则的 mastery 证据。",
  },
  {
    languageId: "es-ES",
    displayIpa: "/n/",
    aliases: ["n"],
    audioUrl: "/audio/language-packs/es-ES/nada-a3fcfe3a3b.mp3",
    kind: "word-example",
    exampleText: "nada",
    note: "西语 /n/ 用本地短词示范，不作为鼻音位置规则的 mastery 证据。",
  },
  {
    languageId: "es-ES",
    displayIpa: "/f/",
    aliases: ["f"],
    audioUrl: "/audio/language-packs/es-ES/foto-0eb57679c4.mp3",
    kind: "word-example",
    exampleText: "foto",
    note: "西语 /f/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/k/",
    aliases: ["k", "c"],
    audioUrl: "/audio/language-packs/fr-FR/cafe-f424452a96.mp3",
    kind: "word-example",
    exampleText: "café",
    note: "法语 /k/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/p/",
    aliases: ["p"],
    audioUrl: "/audio/language-packs/fr-FR/pere-f7cb1f68a4.mp3",
    kind: "word-example",
    exampleText: "père",
    note: "法语 /p/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/t/",
    aliases: ["t"],
    audioUrl: "/audio/language-packs/fr-FR/tout-0450a82763.mp3",
    kind: "word-example",
    exampleText: "tout",
    note: "法语 /t/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/d/",
    aliases: ["d"],
    audioUrl: "/audio/language-packs/fr-FR/deux-503c02f0c4.mp3",
    kind: "word-example",
    exampleText: "deux",
    note: "法语 /d/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/b/",
    aliases: ["b"],
    audioUrl: "/audio/language-packs/fr-FR/bon-3b4f14403e.mp3",
    kind: "word-example",
    exampleText: "bon",
    note: "法语 /b/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/g/",
    aliases: ["g", "ɡ"],
    audioUrl: "/audio/language-packs/fr-FR/garcon-442edb21c4.mp3",
    kind: "word-example",
    exampleText: "garçon",
    note: "法语 /g/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/f/",
    aliases: ["f"],
    audioUrl: "/audio/language-packs/fr-FR/fou-cc98dfae01.mp3",
    kind: "word-example",
    exampleText: "fou",
    note: "法语 /f/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/v/",
    aliases: ["v"],
    audioUrl: "/audio/language-packs/fr-FR/velo-60d6c4b5bc.mp3",
    kind: "word-example",
    exampleText: "vélo",
    note: "法语 /v/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/m/",
    aliases: ["m"],
    audioUrl: "/audio/language-packs/fr-FR/maman-50d7436039.mp3",
    kind: "word-example",
    exampleText: "maman",
    note: "法语 /m/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/n/",
    aliases: ["n"],
    audioUrl: "/audio/language-packs/fr-FR/nous-fd6392d045.mp3",
    kind: "word-example",
    exampleText: "nous",
    note: "法语 /n/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/s/",
    aliases: ["s"],
    audioUrl: "/audio/language-packs/fr-FR/sel-c7c752379a.mp3",
    kind: "word-example",
    exampleText: "sel",
    note: "法语 /s/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/z/",
    aliases: ["z"],
    audioUrl: "/audio/language-packs/fr-FR/zero-efc58ff149.mp3",
    kind: "word-example",
    exampleText: "zéro",
    note: "法语 /z/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "fr-FR",
    displayIpa: "/l/",
    aliases: ["l"],
    audioUrl: "/audio/language-packs/fr-FR/lit-f12ecf748a.mp3",
    kind: "word-example",
    exampleText: "lit",
    note: "法语 /l/ 课程未单列为主单位，使用本地短词示范。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/p/",
    aliases: ["p"],
    audioUrl: "/audio/language-packs/ru-RU/word-918d73538e.mp3",
    kind: "word-example",
    exampleText: "папа",
    note: "俄语 /p/ 评分拆解使用本地短词示范，避免误用硬软辅音规则代理。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/b/",
    aliases: ["b"],
    audioUrl: "/audio/language-packs/ru-RU/word-88bdf28486.mp3",
    kind: "word-example",
    exampleText: "банк",
    note: "俄语 /b/ 评分拆解使用本地短词示范，避免误用硬软辅音规则代理。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/t/",
    aliases: ["t"],
    audioUrl: "/audio/language-packs/ru-RU/word-fd8f30079c.mp3",
    kind: "word-example",
    exampleText: "там",
    note: "俄语 /t/ 评分拆解使用本地短词示范，避免误用硬软辅音规则代理。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/d/",
    aliases: ["d"],
    audioUrl: "/audio/language-packs/ru-RU/word-8e35c31399.mp3",
    kind: "word-example",
    exampleText: "дом",
    note: "俄语 /d/ 评分拆解使用本地短词示范，避免误用硬软辅音规则代理。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/k/",
    aliases: ["k"],
    audioUrl: "/audio/language-packs/ru-RU/word-9e7f48584c.mp3",
    kind: "word-example",
    exampleText: "кот",
    note: "俄语 /k/ 评分拆解使用本地短词示范。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/g/",
    aliases: ["g", "ɡ"],
    audioUrl: "/audio/language-packs/ru-RU/word-b5ca894035.mp3",
    kind: "word-example",
    exampleText: "город",
    note: "俄语 /g/ 评分拆解使用本地短词示范。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/f/",
    aliases: ["f"],
    audioUrl: "/audio/language-packs/ru-RU/word-17b39be17d.mp3",
    kind: "word-example",
    exampleText: "фото",
    note: "俄语 /f/ 评分拆解使用本地短词示范。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/m/",
    aliases: ["m"],
    audioUrl: "/audio/language-packs/ru-RU/word-2241a273ca.mp3",
    kind: "word-example",
    exampleText: "мама",
    note: "俄语 /m/ 评分拆解使用本地短词示范，避免误用硬软辅音规则代理。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/n/",
    aliases: ["n"],
    audioUrl: "/audio/language-packs/ru-RU/word-8032e32d60.mp3",
    kind: "word-example",
    exampleText: "нос",
    note: "俄语 /n/ 评分拆解使用本地短词示范，避免误用硬软辅音规则代理。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/l/",
    aliases: ["l"],
    audioUrl: "/audio/language-packs/ru-RU/word-f82b5ea4e7.mp3",
    kind: "word-example",
    exampleText: "лес",
    note: "俄语 /l/ 评分拆解使用本地短词示范，避免误用硬软辅音规则代理。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/s/",
    aliases: ["s"],
    audioUrl: "/audio/language-packs/ru-RU/word-e6e87d6d5f.mp3",
    kind: "word-example",
    exampleText: "сон",
    note: "俄语 /s/ 评分拆解使用本地短词示范，避免误用硬软辅音规则代理。",
  },
  {
    languageId: "ru-RU",
    displayIpa: "/z/",
    aliases: ["z"],
    audioUrl: "/audio/language-packs/ru-RU/word-8361c0dfdb.mp3",
    kind: "word-example",
    exampleText: "зима",
    note: "俄语 /z/ 评分拆解使用本地短词示范，避免误用硬软辅音规则代理。",
  },
];

export function getAssessmentSegmentAudioInfo(
  segment: string,
  languageId: LanguageId,
): AssessmentSegmentAudioInfo | null {
  if (languageId === "en-US") return null;

  const normalized = normalizeSegment(segment);
  if (!normalized) return null;

  const entry = SEGMENT_AUDIO_ENTRIES.find(
    (candidate) =>
      candidate.languageId === languageId &&
      candidate.aliases.map(normalizeSegment).includes(normalized),
  );

  if (!entry) return null;
  const { aliases: _aliases, ...info } = entry;
  return info;
}

export function getAllAssessmentSegmentAudioEntries(): AssessmentSegmentAudioInfo[] {
  return SEGMENT_AUDIO_ENTRIES.map(({ aliases: _aliases, ...info }) => info);
}
