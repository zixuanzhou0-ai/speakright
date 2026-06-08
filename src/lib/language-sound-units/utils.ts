import type { LanguageId } from "@/types/language";
import type { Difficulty, PhonemeCategory, PhonemeData, SoundUnitType } from "@/types/phoneme";

export interface SoundUnitInput {
  languageId: LanguageId;
  slug: string;
  ipa: string;
  name: string;
  category: PhonemeCategory;
  example: string;
  keywords: PhonemeData["keywords"];
  difficulty: Difficulty;
  description: string;
  notes?: string[];
  soundUnitType?: SoundUnitType;
}

export function unit(input: SoundUnitInput): PhonemeData {
  return {
    ...input,
    symbol: input.ipa,
    soundUnitType: input.soundUnitType ?? "phoneme",
  };
}
