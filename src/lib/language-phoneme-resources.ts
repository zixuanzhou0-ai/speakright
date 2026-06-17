import { getEnglishHeaderPhonemeAudioSrc } from "@/lib/audio-playback-policy";
import { getLocalLanguagePhonemeAsset } from "@/lib/local-language-assets";
import type { LanguageId } from "@/types/language";
import type {
  PhonemeAudioSource,
  PhonemeData,
  PhonemeTeachingResource,
} from "@/types/phoneme";

const LANGUAGE_RESOURCE_STACKS: Record<
  Exclude<LanguageId, "en-US">,
  PhonemeTeachingResource[]
> = {
  "es-ES": [
    {
      title: "Sounds of Speech Spanish：看口型/舌位动画",
      url: "https://soundsofspeech.uiowa.edu/spanish",
      kind: "articulation",
      source: "University of Iowa",
      description:
        "西语音素的发音部位、动画、视频和音频样本，适合作为教学视频入口。",
    },
    {
      title: "EasyPronunciation 西语 IPA 转写 + 音频",
      url: "https://easypronunciation.com/en/spanish-phonetic-transcription-converter",
      kind: "ipa",
      source: "EasyPronunciation",
      description: "把任意西语词/句转成 IPA，用来核对示例词和听语音。",
    },
    {
      title: "SpanishDict Pronunciation：西班牙/拉美读音",
      url: "https://www.spanishdict.com/pronunciation",
      kind: "dictionary",
      source: "SpanishDict",
      description: "用于检查单词读音、地区差异和字母发音规则。",
    },
  ],
  "fr-FR": [
    {
      title: "Phonetique.ca：法语音素训练模块",
      url: "https://www.phonetique.ca/",
      kind: "articulation",
      source: "Phonetique.ca",
      description: "法语元音、辅音、听辨和发音训练模块，适合替代本地视频占位。",
    },
    {
      title: "Lawless French IPA Guide：法语 IPA 总表",
      url: "https://www.lawlessfrench.com/pronunciation/ipa/",
      kind: "ipa",
      source: "Lawless French",
      description: "解释法语 IPA、元音/辅音和常见拼写读音关系。",
    },
    {
      title: "Open IPA French：连诵/省音分析",
      url: "https://www.openipa.org/transcription/french",
      kind: "ipa",
      source: "Open IPA",
      description: "将法语文本转 IPA，并可辅助分析 liaison/elision。",
    },
  ],
  "ru-RU": [
    {
      title: "EasyPronunciation 俄语训练器：HD 单词音频",
      url: "https://easypronunciation.com/en/practice-russian-pronunciation-online",
      kind: "audio",
      source: "EasyPronunciation",
      description: "带俄语单词音频、速度控制和转写，适合重音/弱化训练。",
    },
    {
      title: "Wiktionary 俄语发音附录：硬软音/弱化规则",
      url: "https://en.wiktionary.org/wiki/Appendix:Russian_pronunciation",
      kind: "ipa",
      source: "Wiktionary",
      description: "俄语元音、辅音、硬软对立、重音和 IPA 映射规则参考。",
    },
    {
      title: "IPAtics Russian to IPA：俄语 IPA 转写",
      url: "https://www.ipatics.com/tools/russian-to-ipa",
      kind: "ipa",
      source: "IPAtics",
      description: "检查俄语词句 IPA，特别注意重音、软化和非重读元音。",
    },
  ],
};

const LANGUAGE_SOURCE_REFS: Record<Exclude<LanguageId, "en-US">, string[]> = {
  "es-ES": [
    "easypronunciation-es-ipa",
    "ipatics-es-ipa",
    "spanishdict-pronunciation",
    "wiktionary-es",
    "forvo-es",
    "sounds-of-speech-es",
    "rae-ngle-phonology",
    "jipa-castilian-spanish",
    "ipa-handbook",
  ],
  "fr-FR": [
    "easypronunciation-fr-ipa",
    "openipa-fr",
    "ipatics-fr-ipa",
    "wiktionary-fr",
    "forvo-fr",
    "lawless-french-ipa",
    "phonetique-ca",
    "jipa-french",
    "ipa-handbook",
  ],
  "ru-RU": [
    "easypronunciation-ru-ipa",
    "ipatics-ru-ipa",
    "easypronunciation-ru-trainer",
    "forvo-ru",
    "wiktionary-ru-pronunciation-appendix",
    "wiktionary-ru",
    "jipa-russian",
    "ipa-handbook",
  ],
};

const SOUND_SPECIFIC_SOURCE_REFS: Record<string, string[]> = {
  "es-tap-r": ["ipatics-es-ipa", "sounds-of-speech-es"],
  "es-trill-r": ["ipatics-es-ipa", "sounds-of-speech-es"],
  "es-bv": ["spanishdict-pronunciation", "ipatics-es-ipa"],
  "es-theta": ["easypronunciation-es-ipa", "ipatics-es-ipa"],
  "fr-an": ["lawless-french-ipa", "phonetique-ca"],
  "fr-in": ["lawless-french-ipa", "phonetique-ca"],
  "fr-on": ["lawless-french-ipa", "phonetique-ca"],
  "fr-liaison": ["openipa-fr", "lawless-french-ipa"],
  "ru-hard-soft": ["wiktionary-ru-pronunciation-appendix"],
  "ru-p-pj": ["wiktionary-ru-pronunciation-appendix", "jipa-russian", "ipa-handbook"],
  "ru-b-bj": ["wiktionary-ru-pronunciation-appendix", "jipa-russian", "ipa-handbook"],
  "ru-m-mj": ["wiktionary-ru-pronunciation-appendix", "jipa-russian", "ipa-handbook"],
  "ru-f-fj": ["wiktionary-ru-pronunciation-appendix", "jipa-russian", "ipa-handbook"],
  "ru-v-vj": ["wiktionary-ru-pronunciation-appendix", "jipa-russian", "ipa-handbook"],
  "ru-stress-reduction": [
    "easypronunciation-ru-trainer",
    "wiktionary-ru-pronunciation-appendix",
  ],
  "ru-clusters": ["ipatics-ru-ipa", "wiktionary-ru-pronunciation-appendix"],
};

const SOUND_SPECIFIC_RESOURCES: Partial<
  Record<string, PhonemeTeachingResource[]>
> = {
  "es-tap-r": [
    {
      title: "IPAtics：tap /ɾ/ vs trill /r/ 学习陷阱",
      url: "https://www.ipatics.com/tools/spanish-to-ipa",
      kind: "ipa",
      source: "IPAtics",
      description: "用 pero/perro 等词核对单击 r 与颤音 rr。",
    },
  ],
  "es-trill-r": [
    {
      title: "IPAtics：tap /ɾ/ vs trill /r/ 学习陷阱",
      url: "https://www.ipatics.com/tools/spanish-to-ipa",
      kind: "ipa",
      source: "IPAtics",
      description: "用 pero/perro 等词核对单击 r 与颤音 rr。",
    },
  ],
  "es-bv": [
    {
      title: "SpanishDict：b/v 合并与地区发音",
      url: "https://www.spanishdict.com/pronunciation",
      kind: "dictionary",
      source: "SpanishDict",
      description: "核对 b/v 不按英语 /v/ 读的规则。",
    },
  ],
  "fr-an": [
    {
      title: "Lawless French：法语鼻化元音",
      url: "https://www.lawlessfrench.com/pronunciation/ipa/",
      kind: "ipa",
      source: "Lawless French",
      description: "对照 /ɑ̃/、/ɛ̃/、/ɔ̃/ 的口型和 IPA。",
    },
  ],
  "fr-in": [
    {
      title: "Lawless French：法语鼻化元音",
      url: "https://www.lawlessfrench.com/pronunciation/ipa/",
      kind: "ipa",
      source: "Lawless French",
      description: "对照 /ɑ̃/、/ɛ̃/、/ɔ̃/ 的口型和 IPA。",
    },
  ],
  "fr-on": [
    {
      title: "Lawless French：法语鼻化元音",
      url: "https://www.lawlessfrench.com/pronunciation/ipa/",
      kind: "ipa",
      source: "Lawless French",
      description: "对照 /ɑ̃/、/ɛ̃/、/ɔ̃/ 的口型和 IPA。",
    },
  ],
  "fr-liaison": [
    {
      title: "Open IPA French：liaison / elision 分析",
      url: "https://www.openipa.org/transcription/french",
      kind: "ipa",
      source: "Open IPA",
      description: "用 les amis / vous avez 等短语检查连诵。",
    },
  ],
  "ru-hard-soft": [
    {
      title: "Wiktionary：俄语硬/软辅音规则",
      url: "https://en.wiktionary.org/wiki/Appendix:Russian_pronunciation#Consonants",
      kind: "ipa",
      source: "Wiktionary",
      description: "系统核对 C/Cʲ 硬软辅音对。",
    },
  ],
  "ru-stress-reduction": [
    {
      title: "EasyPronunciation：俄语重音和弱化音频训练",
      url: "https://easypronunciation.com/en/practice-russian-pronunciation-online",
      kind: "audio",
      source: "EasyPronunciation",
      description: "用带重音的单词音频练 /o/ 弱化到 [ɐ]/[ə]。",
    },
  ],
};

const RUSSIAN_STRESS_TEXT: Record<string, string> = {
  автобус: "авто́бус",
  вода: "вода́",
  волк: "волк",
  восемь: "во́семь",
  время: "вре́мя",
  город: "го́род",
  год: "год",
  дорога: "доро́га",
  дом: "дом",
  друг: "друг",
  жить: "жить",
  звук: "звук",
  икра: "икра́",
  книга: "кни́га",
  кот: "кот",
  красный: "кра́сный",
  лед: "лёд",
  лес: "лес",
  любовь: "любо́вь",
  магазин: "магази́н",
  мама: "ма́ма",
  машина: "маши́на",
  мед: "мёд",
  метро: "метро́",
  минута: "мину́та",
  мир: "мир",
  молоко: "молоко́",
  Москва: "Москва́",
  нос: "нос",
  новый: "но́вый",
  окно: "окно́",
  отец: "оте́ц",
  писать: "писа́ть",
  пять: "пять",
  работа: "рабо́та",
  река: "река́",
  рис: "рис",
  рот: "рот",
  рука: "рука́",
  рыба: "ры́ба",
  сад: "сад",
  сахар: "са́хар",
  семь: "семь",
  семья: "семья́",
  сестра: "сестра́",
  синий: "си́ний",
  сибирь: "Сиби́рь",
  слово: "сло́во",
  собака: "соба́ка",
  спасибо: "спаси́бо",
  стол: "стол",
  сумка: "су́мка",
  сыр: "сыр",
  телефон: "телефо́н",
  театр: "теа́тр",
  три: "три",
  хорошо: "хорошо́",
  хоккей: "хокке́й",
  чай: "чай",
  четыре: "четы́ре",
  школа: "шко́ла",
  это: "э́то",
  язык: "язы́к",
  адрес: "а́дрес",
  Анна: "А́нна",
  аптека: "апте́ка",
  автор: "а́втор",
  билет: "биле́т",
  быстро: "бы́стро",
  бумага: "бума́га",
  варенье: "варе́нье",
  вечер: "ве́чер",
  видеть: "ви́деть",
  вокзал: "вокза́л",
  вторник: "вто́рник",
  выпить: "вы́пить",
  выбор: "вы́бор",
  гараж: "гара́ж",
  группа: "гру́ппа",
  холод: "хо́лод",
  характер: "хара́ктер",
  химия: "хи́мия",
  хочу: "хочу́",
  часто: "ча́сто",
  часы: "часы́",
  чашка: "ча́шка",
  человек: "челове́к",
  читать: "чита́ть",
  директор: "дире́ктор",
  фото: "фо́то",
  идти: "идти́",
  имя: "и́мя",
  интернет: "интерне́т",
  интересно: "интере́сно",
  июнь: "ию́нь",
  жена: "жена́",
  живот: "живо́т",
  ужин: "у́жин",
  жалко: "жа́лко",
  завтра: "за́втра",
  зима: "зима́",
  здравствуйте: "здра́вствуйте",
  журнал: "журна́л",
  карта: "ка́рта",
  кино: "кино́",
  кошка: "ко́шка",
  крыло: "крыло́",
  красивый: "краси́вый",
  купить: "купи́ть",
  кухня: "ку́хня",
  лампа: "ла́мпа",
  линия: "ли́ния",
  лиса: "лиса́",
  ложка: "ло́жка",
  луна: "луна́",
  лыжи: "лы́жи",
  море: "мо́ре",
  много: "мно́го",
  мост: "мост",
  муха: "му́ха",
  музыка: "му́зыка",
  музей: "музе́й",
  мыло: "мы́ло",
  номер: "но́мер",
  около: "о́коло",
  орех: "оре́х",
  осень: "о́сень",
  отдых: "о́тдых",
  папа: "па́па",
  плохо: "пло́хо",
  поезд: "по́езд",
  погода: "пого́да",
  понедельник: "понеде́льник",
  помощь: "по́мощь",
  проблема: "пробле́ма",
  привет: "приве́т",
  праздник: "пра́здник",
  письмо: "письмо́",
  пирог: "пиро́г",
  площадь: "пло́щадь",
  рамка: "ра́мка",
  Россия: "Росси́я",
  русский: "ру́сский",
  рынок: "ры́нок",
  сказать: "сказа́ть",
  сегодня: "сего́дня",
  сколько: "ско́лько",
  страна: "страна́",
  старый: "ста́рый",
  строить: "стро́ить",
  студент: "студе́нт",
  сухой: "сухо́й",
  сырой: "сыро́й",
  тихо: "ти́хо",
  товарищ: "това́рищ",
  транспорт: "тра́нспорт",
  трава: "трава́",
  урок: "уро́к",
  успех: "успе́х",
  утро: "у́тро",
  учитель: "учи́тель",
  учить: "учи́ть",
  улица: "у́лица",
  умный: "у́мный",
  утка: "у́тка",
  ухо: "у́хо",
  цена: "цена́",
  конец: "коне́ц",
  щука: "щу́ка",
  шапка: "ша́пка",
  широкий: "широ́кий",
  шоссе: "шоссе́",
  встреча: "встре́ча",
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function countRussianVowels(word: string): number {
  return Array.from(word.toLowerCase()).filter((char) =>
    "аеёиоуыэюя".includes(char),
  ).length;
}

function russianStressTextFor(word: string): string | undefined {
  return (
    RUSSIAN_STRESS_TEXT[word] ??
    (countRussianVowels(word) <= 1 ? word : undefined)
  );
}

function defaultLearnerNotes(
  languageId: Exclude<LanguageId, "en-US">,
  phoneme: PhonemeData,
): string[] {
  if (languageId === "es-ES") {
    return [
      phoneme.category === "vowel"
        ? "西语元音要短、纯、稳定，不像英语元音那样滑动。"
        : "西语辅音要结合拼写位置练习，优先核对 b/v、r/rr、c/z/s 等规则。",
    ];
  }

  if (languageId === "fr-FR") {
    return [
      phoneme.category === "vowel"
        ? "法语元音要注意唇形；鼻化元音是从口腔元音过渡到鼻腔共鸣，不要加 /n/ 尾音。"
        : "法语辅音要和静音词尾、连诵、enchaînement 一起练，不能只按孤立音读。",
    ];
  }

  return [
    phoneme.soundUnitType === "prosody"
      ? "俄语重音会改变元音质量，练习词必须同时看重音和 IPA。"
      : "俄语辅音要区分硬/软，元音要结合重音位置检查弱化。",
  ];
}

function withKeywordMetadata(
  languageId: Exclude<LanguageId, "en-US">,
  phoneme: PhonemeData,
) {
  const languageRefs = LANGUAGE_SOURCE_REFS[languageId];
  const specificRefs = SOUND_SPECIFIC_SOURCE_REFS[phoneme.slug] ?? [];

  return phoneme.keywords.map((keyword) => ({
    ...keyword,
    dialect: keyword.dialect ?? languageId,
    sourceRefs: unique([
      ...(keyword.sourceRefs ?? []),
      ...specificRefs,
      ...languageRefs.slice(0, 3),
    ]),
    stressText:
      keyword.stressText ??
      (languageId === "ru-RU" ? russianStressTextFor(keyword.word) : undefined),
  }));
}

function wiktionaryUrl(languageId: LanguageId, word: string): string {
  const anchor: Partial<Record<LanguageId, string>> = {
    "es-ES": "Spanish",
    "fr-FR": "French",
    "ru-RU": "Russian",
  };

  return `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#${anchor[languageId] ?? "English"}`;
}

function audioReferenceUrl(languageId: LanguageId, word: string): string {
  if (languageId === "es-ES") {
    return `https://www.spanishdict.com/pronunciation/${encodeURIComponent(word)}`;
  }

  if (languageId === "fr-FR") {
    return wiktionaryUrl(languageId, word);
  }

  if (languageId === "ru-RU") {
    return `https://forvo.com/word/${encodeURIComponent(word)}/#ru`;
  }

  return wiktionaryUrl(languageId, word);
}

function phonemeAudioFor(
  languageId: Exclude<LanguageId, "en-US">,
  phoneme: PhonemeData,
): PhonemeAudioSource {
  const referenceWord =
    phoneme.example || phoneme.keywords[0]?.word || phoneme.name;
  const languageName: Record<Exclude<LanguageId, "en-US">, string> = {
    "es-ES": "西班牙语",
    "fr-FR": "法语",
    "ru-RU": "俄语",
  };

  return {
    kind: "tts-example",
    label: `${languageName[languageId]}示范：${referenceWord}`,
    source: "Browser SpeechSynthesis + vetted external reference fallback",
    description:
      "优先用浏览器目标语言 TTS 播放示范词；不可用时打开外部母语音频/IPA 页面。",
    text: referenceWord,
    languageId,
    url: audioReferenceUrl(languageId, referenceWord),
  };
}

export function attachLanguagePhonemeResources(
  languageId: LanguageId,
  phonemes: PhonemeData[],
): PhonemeData[] {
  if (languageId === "en-US") {
    return phonemes.map((phoneme) => {
      const localSrc = getEnglishHeaderPhonemeAudioSrc(phoneme.chartWord);

      return {
        ...phoneme,
        phonemeAudio: localSrc
          ? {
              kind: "local",
              label: `IPA Chart 本地音频：/${phoneme.ipa}/`,
              source: "americanipachart.com local mirror",
              localSrc,
              languageId,
            }
          : phoneme.phonemeAudio,
      };
    });
  }

  const languageResources = LANGUAGE_RESOURCE_STACKS[languageId];
  const languageRefs = LANGUAGE_SOURCE_REFS[languageId];

  return phonemes.map((phoneme) => {
    const localAsset = getLocalLanguagePhonemeAsset(languageId, phoneme.slug);
    const specificResources = SOUND_SPECIFIC_RESOURCES[phoneme.slug] ?? [];
    const sourceRefs = unique([
      ...(phoneme.sourceRefs ?? []),
      ...(SOUND_SPECIFIC_SOURCE_REFS[phoneme.slug] ?? []),
      ...languageRefs,
    ]);

    return {
      ...phoneme,
      keywords: withKeywordMetadata(languageId, phoneme),
      notes: unique([
        ...(phoneme.notes ?? []),
        ...defaultLearnerNotes(languageId, phoneme),
      ]),
      sourceRefs,
      teachingResources: [...specificResources, ...languageResources],
      phonemeAudio: localAsset
        ? {
            kind: "local",
            label: `${localAsset.label}：${phoneme.ipa}`,
            source: localAsset.source,
            description: "本地授权素材，优先用于该发音单位的播放按钮。",
            localSrc: localAsset.audioSrc,
            url: localAsset.sourceUrl,
            languageId,
          }
        : phonemeAudioFor(languageId, phoneme),
      video: {
        ...phoneme.video,
        localSrc: localAsset?.videoSrc ?? phoneme.video?.localSrc,
        status: localAsset ? "ready" : (phoneme.video?.status ?? "planned"),
        label:
          localAsset?.label ??
          specificResources[0]?.title ??
          languageResources[0]?.title ??
          phoneme.video?.label ??
          "外部授权教学资源",
        source: localAsset?.source ?? phoneme.video?.source,
        sourceUrl: localAsset?.sourceUrl ?? phoneme.video?.sourceUrl,
        license: localAsset?.license ?? phoneme.video?.license,
        attribution: localAsset?.attribution ?? phoneme.video?.attribution,
        notes: localAsset?.notes ?? phoneme.video?.notes,
      },
    };
  });
}
