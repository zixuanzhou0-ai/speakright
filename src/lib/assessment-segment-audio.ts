import { isPlayableHeaderAudioSrc } from "@/lib/audio-playback-policy";
import { LOCAL_LANGUAGE_PHONEME_ASSETS } from "@/lib/local-language-assets";
import type { LanguageId } from "@/types/language";

export interface AssessmentSegmentAudioInfo {
  languageId: Exclude<LanguageId, "en-US">;
  displayIpa: string;
  audioUrl: string;
  kind: "sound-unit";
  soundUnitSlug: string;
  soundUnitLabel: string;
  note: string;
}

export interface AssessmentSegmentAudioEntry
  extends AssessmentSegmentAudioInfo {
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

function displayIpaFor(audioIpa: string): string {
  const trimmed = audioIpa.trim();
  if (trimmed.startsWith("/") && trimmed.endsWith("/")) return trimmed;
  return `/${trimmed.replace(/[/[\]]/g, "")}/`;
}

const LANGUAGE_NAMES: Record<Exclude<LanguageId, "en-US">, string> = {
  "es-ES": "西语",
  "fr-FR": "法语",
  "ru-RU": "俄语",
};

const SEGMENT_AUDIO_ENTRIES: AssessmentSegmentAudioEntry[] =
  LOCAL_LANGUAGE_PHONEME_ASSETS.flatMap((asset) => {
    if (asset.isProxyForAssessment) return [];
    if (!asset.audioSrc || !asset.audioIpa) return [];
    if (!asset.exactAssessmentAliases?.length) return [];
    if (!isPlayableHeaderAudioSrc(asset.audioSrc)) return [];

    const displayIpa = displayIpaFor(asset.audioIpa);
    return [
      {
        languageId: asset.languageId,
        displayIpa,
        aliases: asset.exactAssessmentAliases,
        audioUrl: asset.audioSrc,
        kind: "sound-unit",
        soundUnitSlug: asset.slug,
        soundUnitLabel: asset.label,
        note: `${LANGUAGE_NAMES[asset.languageId]} ${displayIpa} 复用左侧/详情页同一发音单位的本地小喇叭音频；评分拆解不会回退到示例词、规则、视频或代理素材。`,
      },
    ];
  });

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

export function getAllAssessmentSegmentAudioRegistryEntries(): AssessmentSegmentAudioEntry[] {
  return SEGMENT_AUDIO_ENTRIES.map((entry) => ({
    ...entry,
    aliases: [...entry.aliases],
  }));
}
