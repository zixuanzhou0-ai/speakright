"use client";

import { normalizeTrainingMaterialContent } from "@speakright/core/training/exposure";
import {
  buildGuidedRepeatSessionPlan,
  type GuidedRepeatMode,
  type GuidedRepeatRhythm,
  type GuidedRepeatSessionPlan,
  resolveGuidedRepeatVoicePolicy,
  validateGuidedRepeatSessionPlan,
} from "@speakright/core/training/guided-repeat";
import { getEnglishWordAudioSrc } from "@/hooks/use-word-pronunciation";
import { getEnglishHeaderPhonemeAudioSrc } from "@/lib/audio-playback-policy";
import { getStaticLanguageAudioPackEntry } from "@/lib/static-language-audio-pack";
import type { LanguageId } from "@/types/language";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

export interface BuildGuidedRepeatPlanInput {
  languageId: LanguageId;
  phoneme: PhonemeData;
  wordPool: readonly KeywordEntry[];
  currentWord: KeywordEntry;
  rhythm: GuidedRepeatRhythm;
  mode: GuidedRepeatMode;
}

export function isGuidedRepeatEligible(
  phoneme: Pick<PhonemeData, "soundUnitType">,
): boolean {
  const type = phoneme.soundUnitType ?? "phoneme";
  return type === "phoneme" || type === "allophone";
}

export function guidedRepeatMaterialId(
  languageId: LanguageId,
  soundUnitSlug: string,
  word: string,
): string {
  return `guided-repeat:${languageId}:${soundUnitSlug}:${normalizeTrainingMaterialContent(word)}`;
}

export async function buildLocalGuidedRepeatPlan(
  input: BuildGuidedRepeatPlanInput,
): Promise<GuidedRepeatSessionPlan> {
  if (!isGuidedRepeatEligible(input.phoneme)) {
    throw new Error("该页面不是单音标或单音位变体练习。");
  }
  if (input.wordPool.length === 0) {
    throw new Error("当前音标没有可用于强化跟读的单词。");
  }

  const voicePolicy = resolveGuidedRepeatVoicePolicy(input.languageId);
  const currentMaterialId = guidedRepeatMaterialId(
    input.languageId,
    input.phoneme.slug,
    input.currentWord.word,
  );
  const queueEntries = input.wordPool.map((entry) => ({
    entry,
    materialId: guidedRepeatMaterialId(
      input.languageId,
      input.phoneme.slug,
      entry.word,
    ),
  }));
  const queue = await Promise.all(
    queueEntries.map(async ({ entry, materialId }) => {
      let masculineAudioSrc: string;
      let feminineAudioSrc: string;
      if (input.languageId === "en-US") {
        masculineAudioSrc = getEnglishWordAudioSrc(
          entry.word,
          voicePolicy.masculine.assetSlot,
        );
        feminineAudioSrc = getEnglishWordAudioSrc(
          entry.word,
          voicePolicy.feminine.assetSlot,
        );
      } else {
        const [masculine, feminine] = await Promise.all([
          getStaticLanguageAudioPackEntry(
            input.languageId,
            entry.word,
            voicePolicy.masculine.assetSlot,
          ),
          getStaticLanguageAudioPackEntry(
            input.languageId,
            entry.word,
            voicePolicy.feminine.assetSlot,
          ),
        ]);
        if (!masculine || !feminine) {
          throw new Error(
            `${input.phoneme.ipa} 的“${entry.word}”缺少本地男声或女声音频。`,
          );
        }
        masculineAudioSrc = masculine.audioSrc;
        feminineAudioSrc = feminine.audioSrc;
      }
      return {
        materialId,
        word: entry.word,
        ipa: entry.ipa,
        targetUnits: [input.phoneme.slug],
        masculineAudioSrc,
        feminineAudioSrc,
      };
    }),
  );

  const anchorSrc =
    input.languageId === "en-US"
      ? (input.phoneme.phonemeAudio?.localSrc ??
        getEnglishHeaderPhonemeAudioSrc(input.phoneme.chartWord))
      : input.phoneme.phonemeAudio?.localSrc;
  if (!anchorSrc) {
    throw new Error(`音标 ${input.phoneme.ipa} 缺少本地音标本体音频。`);
  }
  const anchorAudio = { single: anchorSrc };
  const plan = buildGuidedRepeatSessionPlan({
    languageId: input.languageId,
    soundUnitSlug: input.phoneme.slug,
    rhythm: input.rhythm,
    mode: input.mode,
    anchorAudio,
    pool: queue,
    currentMaterialId,
  });
  const validation = validateGuidedRepeatSessionPlan(plan);
  if (!validation.valid) {
    throw new Error(`强化跟读资产不完整：${validation.issues.join("；")}`);
  }
  return plan;
}
