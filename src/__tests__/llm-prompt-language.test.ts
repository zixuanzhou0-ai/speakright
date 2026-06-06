import { describe, expect, it } from "vitest";
import { buildFeedbackPrompt } from "@/lib/llm-prompt";
import type { AzureAssessmentResult } from "@/types/azure";

const EMPTY_RESULT: AzureAssessmentResult = {
  pronunciationScore: 72,
  accuracyScore: 72,
  fluencyScore: 80,
  completenessScore: 100,
  words: [],
};

describe("language-aware LLM feedback prompts", () => {
  it("uses a Spanish beta prompt instead of the American English coach prompt", () => {
    const prompt = buildFeedbackPrompt(
      "casa",
      EMPTY_RESULT,
      "phoneme",
      "normal",
      "es-ES",
    );

    expect(prompt).toContain("西班牙语");
    expect(prompt).toContain("实验版反馈");
    expect(prompt).toContain("不能宣称已经掌握");
    expect(prompt).toContain("不要套用美式英语专属");
    expect(prompt).toContain("本语言发音单位参考");
    expect(prompt).not.toContain("你是一位专业的美式英语发音教练");
    expect(prompt).not.toContain("Azure 编码 → IPA 对照表");
    expect(prompt).not.toContain("ship/sheep");
    expect(prompt).not.toContain("dark L");
    expect(prompt).not.toContain("stress-timed rhythm");
  });
});
