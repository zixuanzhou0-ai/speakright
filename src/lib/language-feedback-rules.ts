import type { LanguageId } from "@/types/language";

export interface LanguageFeedbackRule {
  id: string;
  languageId: Exclude<LanguageId, "en-US">;
  title: string;
  triggerSlugs: string[];
  guidance: string;
  practiceCue: string;
}

export const LANGUAGE_FEEDBACK_RULES: LanguageFeedbackRule[] = [
  {
    id: "spanish-vowel-diphthongization",
    languageId: "es-ES",
    title: "Spanish pure vowels",
    triggerSlugs: ["es-a", "es-e", "es-i", "es-o", "es-u"],
    guidance: "西语 /a e i o u/ 要短、纯、稳定，不能滑成英语式 /eɪ/ 或 /oʊ/。",
    practiceCue: "慢读 casa, mesa, sí, sol, luna；每个元音只保持一个口型。",
  },
  {
    id: "spanish-r-tap-trill-confusion",
    languageId: "es-ES",
    title: "tap /ɾ/ vs trill /r/",
    triggerSlugs: ["es-tap-r", "es-trill-r"],
    guidance: "单 r 是一次舌尖轻弹 /ɾ/；rr 或词首 r 是连续颤动 /r/，不能用英语卷舌 r 代替。",
    practiceCue: "pero/perro, caro/carro 交替，先保证一次轻弹，再练连续颤动。",
  },
  {
    id: "spanish-bv-english-v",
    languageId: "es-ES",
    title: "b/v merger",
    triggerSlugs: ["es-bv"],
    guidance: "西语 b/v 不读英语 /v/；词首或鼻音后更像 /b/，元音间放松成双唇近音 [β]。",
    practiceCue: "boca, vida, uva 逐个读，避免上齿咬下唇。",
  },
  {
    id: "spanish-plain-stops-unaspirated",
    languageId: "es-ES",
    title: "plain /p t k/",
    triggerSlugs: ["es-p", "es-t", "es-k"],
    guidance:
      "西语 /p t k/ 是短促清塞音，词首也不强送气；/t/ 更靠近牙齿，不能套英语 alveolar t 或喷气 p/k。",
    practiceCue:
      "pan, taza, casa 分开慢读；手放嘴前检查没有明显喷气，再放进 para ti, casa pequeña。",
  },
  {
    id: "spanish-common-consonant-anchors",
    languageId: "es-ES",
    title: "plain consonant anchors",
    triggerSlugs: ["es-f", "es-m", "es-n", "es-l"],
    guidance:
      "西语 /f m n l/ 看起来像英语符号，但目标是西语音系：/f/ 清唇齿摩擦，/m/ 双唇鼻音，/n/ 可随后音变换部位，/l/ 保持清晰前舌音。",
    practiceCue:
      "familia, mano, nada, lado 慢读；/n/ 再对比 en casa, un gesto，区分单音锚点和鼻音同化规则。",
  },
  {
    id: "spanish-approximant-too-hard",
    languageId: "es-ES",
    title: "intervocalic approximants",
    triggerSlugs: ["es-bv", "es-d", "es-g"],
    guidance: "元音间 b/d/g 通常放松成 [β ð ɣ]；如果每次都强爆破，会有很重的外语感。",
    practiceCue: "la vida, nada, agua 慢读，元音间只轻轻接近，不完全堵住气流。",
  },
  {
    id: "spanish-theta-s-dialect",
    languageId: "es-ES",
    title: "Castilian /θ/ vs /s/",
    triggerSlugs: ["es-theta", "es-s"],
    guidance: "当前 es-ES 目标区分 c/z 的 /θ/ 和 s 的 /s/；拉美 seseo 把两者合并为 /s/，这是方言差异，不是绝对错误。",
    practiceCue: "cielo/sol, caza/casa 对比；如果目标是 es-ES，c/z 轻触齿间。",
  },
  {
    id: "spanish-x-too-weak",
    languageId: "es-ES",
    title: "Spanish /x/",
    triggerSlugs: ["es-x"],
    guidance: "/x/ 是软腭摩擦音，比英语 /h/ 更靠后、更有摩擦感。",
    practiceCue: "jamón, juego, rojo 慢读，舌后靠近软腭但不完全闭塞。",
  },
  {
    id: "spanish-ny-split",
    languageId: "es-ES",
    title: "palatal nasal /ɲ/",
    triggerSlugs: ["es-ny"],
    guidance: "/ɲ/ 是一个硬腭鼻音，不是 /n/ + /j/ 两个音。",
    practiceCue: "niño/año/señor，舌面贴近硬腭，鼻腔出气。",
  },
  {
    id: "spanish-stress-error",
    languageId: "es-ES",
    title: "Spanish lexical stress",
    triggerSlugs: ["es-lexical-stress", "es-syllable-rhythm"],
    guidance: "重音位置和重音符号会改变词义；西语节奏更按音节推进，不要像英语一样大量弱读吞音。",
    practiceCue: "papa/papá, hablo/habló 对比，然后读 Buenos días, muchas gracias。",
  },
  {
    id: "french-front-rounded-vowel-collapse",
    languageId: "fr-FR",
    title: "front rounded vowels",
    triggerSlugs: ["fr-y", "fr-eu-close", "fr-eu-open"],
    guidance: "/y ø œ/ 的舌位在前面，嘴唇收圆；不要塌成 /u o e ɛ/。",
    practiceCue: "tu/vous, deux/sœur 交替，先摆 /i e ɛ/ 的舌位，再圆唇。",
  },
  {
    id: "french-nasal-vowel-with-n-tail",
    languageId: "fr-FR",
    title: "nasal vowels",
    triggerSlugs: ["fr-an", "fr-in", "fr-on", "fr-un"],
    guidance: "鼻化是元音本身，不是在后面补 /n/ 或 /ŋ/；/œ̃/ 在现代口音中可能与 /ɛ̃/ 合并。",
    practiceCue: "sans, vin, bon, un 慢读，停在鼻化元音上，不加尾音。",
  },
  {
    id: "french-uvular-r-replaced",
    languageId: "fr-FR",
    title: "uvular r",
    triggerSlugs: ["fr-r"],
    guidance: "法语 /ʁ/ 在舌根/小舌附近，不卷舌，也不弹舌。",
    practiceCue: "rue, Paris, frère；先轻摩擦，再放进短句。",
  },
  {
    id: "french-plain-stops-unaspirated",
    languageId: "fr-FR",
    title: "plain /p b t d k g/",
    triggerSlugs: ["fr-p", "fr-b", "fr-t", "fr-d", "fr-k", "fr-g"],
    guidance:
      "法语 /p t k/ 通常比英语词首更少送气，/b d g/ 要保持清楚声带振动；/t d/ 不要读成美式 flap，也不要加英语式爆破拖尾。",
    practiceCue:
      "pas/bas, tout/doux, cou/goût 交替；每组只检查清浊和短促闭塞，不练英语式重音。",
  },
  {
    id: "french-common-consonant-anchors",
    languageId: "fr-FR",
    title: "plain consonant anchors",
    triggerSlugs: ["fr-f", "fr-v", "fr-s", "fr-z", "fr-m", "fr-n", "fr-l"],
    guidance:
      "法语 /f v s z m n l/ 是普通辅音锚点，但不能直接照英语习惯读：/v z/ 要保留声带振动，/l/ 保持清晰前舌音，不做英语词尾 dark L。",
    practiceCue:
      "fou/vous, sous/zoo, ami/année, la lune 分组慢读；先稳住清浊和清晰 /l/，再放进短语。",
  },
  {
    id: "french-final-consonant-silence",
    languageId: "fr-FR",
    title: "silent final consonants",
    triggerSlugs: ["fr-final-consonant-silence"],
    guidance: "孤立词尾常静音；只有 liaison、enchaînement 或派生形式里才可能出现。",
    practiceCue: "petit, grand, trop, chaud 读短，不把拼写尾音读出来。",
  },
  {
    id: "french-liaison",
    languageId: "fr-FR",
    title: "liaison",
    triggerSlugs: ["fr-liaison"],
    guidance:
      "liaison 是潜在词尾辅音在合适短语环境中出现；不要把每个静音词尾都读出，也不要漏掉必须连的词组。",
    practiceCue: "les amis, vous avez, petit ami；先找限定词/代词等常见可连环境。",
  },
  {
    id: "french-enchainement",
    languageId: "fr-FR",
    title: "enchaînement",
    triggerSlugs: ["fr-enchainement"],
    guidance:
      "enchaînement 是已经发出来的词尾辅音接到下一个元音开头词上，和把静音词尾复活的 liaison 不是同一机制。",
    practiceCue: "il arrive, elle aime, avec elle；保留原本发音的尾辅音，再顺接到后面的元音。",
  },
  {
    id: "french-elision",
    languageId: "fr-FR",
    title: "elision",
    triggerSlugs: ["fr-elision"],
    guidance:
      "elision 是弱元音在元音开头词前省去并写成撇号形式，不能按完整孤立词逐字读。",
    practiceCue: "j'aime, l'ami, c'est；看到撇号时直接连成一个节奏块。",
  },
  {
    id: "french-schwa-e-caduc",
    languageId: "fr-FR",
    title: "schwa / e caduc",
    triggerSlugs: ["fr-schwa"],
    guidance:
      "法语 /ə/ 是 e caduc：有些位置可听见，有些位置弱化或脱落；反馈应看短语环境，不能把它当成永远稳定的孤立元音。",
    practiceCue: "ce matin, je te le dis, petit cheval；先慢读保留节奏，再练自然省略。",
  },
  {
    id: "french-phrase-final-prominence",
    languageId: "fr-FR",
    title: "phrase-final prominence",
    triggerSlugs: ["fr-phrase-final-prominence"],
    guidance:
      "法语突出通常在节奏组最后一个可发音音节，不像英语那样给每个内容词单独加重音。",
    practiceCue: "读 Le musée ferme à six heures. 时让 six heures 收束短语，前面的词保持平稳。",
  },
  {
    id: "russian-missing-stress-or-reduction",
    languageId: "ru-RU",
    title: "stress and reduction",
    triggerSlugs: ["ru-stress-reduction", "ru-unstressed-o-a", "ru-unstressed-e-ya"],
    guidance: "俄语必须先找重音；非重读 о/а/e/я 会弱化，不能逐字母读。",
    practiceCue: "молоко, Москва, семья, минута；先标重音，再读弱化。",
  },
  {
    id: "russian-i-vs-y-collapse",
    languageId: "ru-RU",
    title: "/ɨ/ vs /i/",
    triggerSlugs: ["ru-y", "ru-i"],
    guidance: "/ɨ/ 舌身更靠后更紧，不是 /i/；ы 和 и 必须保持对比。",
    practiceCue: "и/ы, мир/мы, сыр/синий 交替。",
  },
  {
    id: "russian-palatalization-missing",
    languageId: "ru-RU",
    title: "palatalization",
    triggerSlugs: [
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
    guidance: "软辅音是辅音本身带 [ʲ]，不是硬辅音后面加一个 /j/。",
    practiceCue: "мат/мать, лук/люк, сад/сядь；慢速保持辅音硬软差异。",
  },
  {
    id: "russian-final-devoicing",
    languageId: "ru-RU",
    title: "final devoicing",
    triggerSlugs: ["ru-final-devoicing"],
    guidance: "停顿或清辅音前，词尾 б/д/г/ж/з 常清化；但连到浊辅音、响音或元音前时要按语流判断，不能把每个词都孤立清化。",
    practiceCue: "друг, город, нож, гараж；再对比 друг дома, снег идёт，先看后面的音再决定清化或保持浊音。",
  },
  {
    id: "russian-voicing-assimilation",
    languageId: "ru-RU",
    title: "voicing assimilation",
    triggerSlugs: ["ru-voicing-assimilation"],
    guidance: "相邻辅音会影响清浊，例如 встреча 的 в 接清辅音读 [f]。",
    practiceCue: "встреча, сделать, просьба；圈出相邻辅音再读。",
  },
  {
    id: "russian-cluster-epenthesis",
    languageId: "ru-RU",
    title: "consonant clusters",
    triggerSlugs: ["ru-clusters"],
    guidance: "俄语辅音丛中不要插入额外元音，先慢速保留每个辅音再加速。",
    practiceCue: "встреча, здравствуйте, текст, группа 慢到快。",
  },
  {
    id: "russian-sh-zh-ch-shch-confusion",
    languageId: "ru-RU",
    title: "ш/ж/ч/щ",
    triggerSlugs: ["ru-sh-zh", "ru-ts", "ru-ch", "ru-shch"],
    guidance: "ш/ж 厚而偏硬，ч/щ 偏软；ц 是硬 /ts/，不要全部用同一个中文近似音。",
    practiceCue: "шум/жук/чай/щи/царь 分组读，先分硬软再分清浊。",
  },
];

export function getFeedbackRulesForLanguage(
  languageId: LanguageId,
): LanguageFeedbackRule[] {
  if (languageId === "en-US") return [];
  return LANGUAGE_FEEDBACK_RULES.filter((rule) => rule.languageId === languageId);
}

export function getFeedbackRulesForSlugs(
  languageId: LanguageId,
  slugs: string[],
): LanguageFeedbackRule[] {
  const slugSet = new Set(slugs);
  return getFeedbackRulesForLanguage(languageId).filter((rule) =>
    rule.triggerSlugs.some((slug) => slugSet.has(slug)),
  );
}

export function getLanguageFeedbackRules(languageId: LanguageId): LanguageFeedbackRule[] {
  return getFeedbackRulesForLanguage(languageId);
}

export function matchLanguageFeedbackRules(
  languageId: LanguageId,
  slugs: string[],
) {
  const slugSet = new Set(slugs);
  return getFeedbackRulesForSlugs(languageId, slugs).map((rule) => ({
    rule,
    matchedSlugs: rule.triggerSlugs.filter((slug) => slugSet.has(slug)),
  }));
}

export function buildLanguageFeedbackContext(languageId: LanguageId): string {
  const rules = getFeedbackRulesForLanguage(languageId);
  if (rules.length === 0) return "";

  return [
    "",
    "## 当前练习语言的专项发音规则",
    ...rules.map(
      (rule) =>
        `- ${rule.title}: ${rule.guidance} 练习提示：${rule.practiceCue}`,
    ),
  ].join("\n");
}

export const buildLanguageFeedbackPromptContext = buildLanguageFeedbackContext;
