import { getExactTeachingVideosForSoundUnit } from "@/lib/language-teaching-videos";
import { getLocalLanguagePhonemeAsset } from "@/lib/local-language-assets";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import { isRuleLikeSoundUnit } from "@/lib/language-sound-unit-groups";
import { isPlayableHeaderAudioSrc } from "@/lib/audio-playback-policy";
import type { LanguageId } from "@/types/language";
import type { PhonemeData } from "@/types/phoneme";

export type PrimaryVideoCoverage = "exact" | "reference" | "proxy" | "none";

export interface SoundUnitSourceAlignment {
  languageId: Exclude<LanguageId, "en-US">;
  slug: string;
  sourceRefs: string[];
  ruleSummary: string;
  primaryVideoCoverage: PrimaryVideoCoverage;
  localVideoIsExact: boolean;
  exactTeachingVideoIds: string[];
  note: string;
}

const NON_EXACT_LOCAL_VIDEO_SLUGS = new Set([
  "ru-hard-soft",
  "ru-soft-t-d",
  "ru-soft-s-z",
  "ru-soft-n-l-r",
  "ru-soft-labials",
  "ru-soft-sign",
  "ru-sh-zh",
  "ru-ts-ch-shch",
  "ru-ch",
  "ru-shch",
  "ru-iotated-vowels",
  "ru-stress-reduction",
  "ru-unstressed-o-a",
  "ru-unstressed-e-ya",
  "ru-final-devoicing",
  "ru-voicing-assimilation",
  "ru-clusters",
]);

const RULE_SUMMARIES: Record<string, string> = {
  "es-lexical-stress":
    "西语词重音由重音符号和词尾规则共同决定；先找重读音节，再保持五个纯元音稳定。",
  "es-syllable-rhythm":
    "西语节奏更接近音节计时；不要把非重读音节像英语那样强烈弱化。",
  "fr-liaison":
    "法语 liaison 只在特定词组中触发；练习时看前词词尾辅音是否在后面元音前重新发出。",
  "fr-enchainement":
    "enchaînement 是词尾已发音辅音自然连到下一个元音，不等同于新增一个音。",
  "fr-elision":
    "elision 是元音省略并用撇号连接，如 je aime -> j’aime；练习重点是短语整体流动。",
  "fr-final-consonant-silence":
    "很多法语词尾辅音在孤立词中不发音，但在派生形式或连读环境中可能重新出现。",
  "fr-schwa":
    "法语 schwa 是否发出受语速、地区和短语结构影响；不要把每个 e 都读成完整元音。",
  "ru-iotated-vowels":
    "я/е/ё/ю 在词首、元音后或 ь/ъ 后通常带 /j/；在辅音后主要标记前一个辅音软化。",
  "ru-final-devoicing":
    "俄语词尾有声辅音在停顿或清辅音前常清化，如 друг 单独读作 /druk/；连到浊辅音、响音或元音前要按语流处理，不要把每个词都孤立清化。",
  "ru-voicing-assimilation":
    "相邻辅音会互相影响清浊，如 встреча 中 в 在清辅音前读成 [f]。",
  "ru-clusters":
    "俄语辅音丛要保留辅音顺序，不要自动插入汉语式过渡元音。",
  "ru-stress-reduction":
    "俄语重音会改变元音质量；先找重音，再判断非重读元音是否弱化。",
  "ru-unstressed-o-a":
    "非重读 о/а 常弱化到 [ɐ]/[ə] 附近；不能按字母逐个读满。",
  "ru-unstressed-e-ya":
    "非重读 е/я 常趋向 [ɪ]/[ə]，并伴随明显软化环境。",
};

function defaultRuleSummary(languageId: LanguageId, slug: string): string {
  const unit = getLanguagePhonemeBySlug(languageId, slug);
  if (!unit) return "该发音单位需要按当前语言的发音规则和示例词一起练习。";
  return (
    unit.description ??
    `${unit.ipa} 需要结合示例词、IPA 和当前语言规则一起练习。`
  );
}

export function shouldShowLocalVideoAsPrimary(
  languageId: LanguageId,
  slug: string,
): boolean {
  if (languageId === "en-US") return true;
  if (NON_EXACT_LOCAL_VIDEO_SLUGS.has(slug)) return false;
  return Boolean(getLocalLanguagePhonemeAsset(languageId, slug));
}

export function shouldShowSoundUnitHeaderAudio(
  languageId: LanguageId,
  phoneme: PhonemeData,
): boolean {
  if (languageId === "en-US") {
    return Boolean(
      phoneme.chartWord ||
        isPlayableHeaderAudioSrc(phoneme.phonemeAudio?.localSrc),
    );
  }

  if (!isPlayableHeaderAudioSrc(phoneme.phonemeAudio?.localSrc)) return false;

  if (isRuleLikeSoundUnit(phoneme)) {
    return shouldShowLocalVideoAsPrimary(languageId, phoneme.slug);
  }

  return true;
}

export function getSoundUnitSourceAlignment(
  languageId: LanguageId,
  slug: string,
): SoundUnitSourceAlignment | null {
  if (languageId === "en-US") return null;

  const unit = getLanguagePhonemeBySlug(languageId, slug);
  const localVideoIsExact = shouldShowLocalVideoAsPrimary(languageId, slug);
  const exactTeachingVideos = getExactTeachingVideosForSoundUnit(languageId, slug);
  const hasAnyLocalVideo = Boolean(getLocalLanguagePhonemeAsset(languageId, slug));
  const primaryVideoCoverage: PrimaryVideoCoverage =
    localVideoIsExact || exactTeachingVideos.length > 0
      ? "exact"
      : hasAnyLocalVideo
        ? "proxy"
        : "none";

  return {
    languageId,
    slug,
    sourceRefs: unit?.sourceRefs ?? [],
    ruleSummary: RULE_SUMMARIES[slug] ?? defaultRuleSummary(languageId, slug),
    primaryVideoCoverage,
    localVideoIsExact,
    exactTeachingVideoIds: exactTeachingVideos.map((video) => video.id),
    note:
      primaryVideoCoverage === "exact"
        ? "当前主视频和发音单位匹配。"
        : "暂无精准本地视频；先按规则说明、本地标准音频和练习词训练。",
  };
}
