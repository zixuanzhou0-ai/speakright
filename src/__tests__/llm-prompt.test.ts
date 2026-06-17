import { describe, expect, it } from "vitest";
import { buildFeedbackPrompt } from "@/lib/llm-prompt";
import type { AzureAssessmentResult } from "@/types/azure";

const SAMPLE_RESULT: AzureAssessmentResult = {
  pronunciationScore: 78,
  accuracyScore: 76,
  fluencyScore: 84,
  completenessScore: 100,
  prosodyScore: 82,
  words: [
    {
      word: "sample",
      accuracyScore: 76,
      errorType: "None",
      phonemes: [
        { phoneme: "a", accuracyScore: 72 },
        { phoneme: "m", accuracyScore: 88 },
      ],
      syllables: [{ syllable: "sample", accuracyScore: 76 }],
    },
  ],
};

describe("LLM feedback prompt", () => {
  it("keeps English feedback on the American English baseline", () => {
    const prompt = buildFeedbackPrompt(
      "think",
      SAMPLE_RESULT,
      "phoneme",
      "normal",
      "en-US",
    );

    expect(prompt).toContain("当前练习语言：美式英语 en-US");
    expect(prompt).toContain("Azure SAPI 编码");
    expect(prompt).not.toContain("当前语言仍是实验评分链路");
  });

  it("makes Spanish feedback language-specific and evidence-bound", () => {
    const prompt = buildFeedbackPrompt(
      "Buenos días.",
      SAMPLE_RESULT,
      "sentence",
      "normal",
      "es-ES",
    );

    expect(prompt).toContain("当前练习语言：西班牙语 es-ES");
    expect(prompt).toContain("不能把英语发音规则套进来");
    expect(prompt).toContain("当前语言仍是实验评分链路");
    expect(prompt).toContain("不能强行按英语 SAPI 解释");
    expect(prompt).toContain("papa/papá");
    expect(prompt).toContain("/p t k/");
    expect(prompt).toContain("不强送气");
    expect(prompt).not.toContain("stress-timed");
    expect(prompt).not.toContain("sink / think");
    expect(prompt).not.toContain("really 的第二个音节");
  });

  it("uses French prosody and rule constraints instead of English weak forms", () => {
    const prompt = buildFeedbackPrompt(
      "Les amis arrivent.",
      SAMPLE_RESULT,
      "sentence",
      "normal",
      "fr-FR",
    );

    expect(prompt).toContain("当前练习语言：法语 fr-FR");
    expect(prompt).toContain("liaison");
    expect(prompt).toContain("enchaînement");
    expect(prompt).toContain("法语连诵和省音是短语级规则");
    expect(prompt).toContain("/p t k/");
    expect(prompt).toContain("少送气");
    expect(prompt).not.toContain("want to →");
    expect(prompt).not.toContain('"not at all"');
    expect(prompt).not.toContain("sink vs think");
  });

  it("uses Russian stress and palatalization constraints conservatively", () => {
    const prompt = buildFeedbackPrompt(
      "Привет, Москва.",
      SAMPLE_RESULT,
      "sentence",
      "normal",
      "ru-RU",
    );

    expect(prompt).toContain("当前练习语言：俄语 ru-RU");
    expect(prompt).toContain("重音与元音弱化");
    expect(prompt).toContain("硬/软辅音");
    expect(prompt).toContain("不能用单个整体分数证明");
    expect(prompt).toContain("当前证据不足");
    expect(prompt).not.toContain("sink / think");
    expect(prompt).not.toContain("really 的第二个音节");
  });

  it("keeps non-English AI coach feedback tied to target text, language, and evidence strength", () => {
    const prompt = buildFeedbackPrompt(
      "canción",
      SAMPLE_RESULT,
      "phoneme",
      "hard",
      "es-ES",
    );

    expect(prompt).toContain("学生练习内容：canción");
    expect(prompt).toContain("当前语言：es-ES");
    expect(prompt).toContain('"word": "sample"');
    expect(prompt).toContain('"phoneme": "a"');
    expect(prompt).toContain("单次录音只能给本次反馈");
    expect(prompt).toContain("不能说\"你已经掌握\"");
    expect(prompt).toContain("当前语言仍是实验评分链路");
    expect(prompt).toContain(
      "非英语音素、单次录音、规则/语流目标默认最多只能写\"中\"或\"薄\"",
    );
  });

  it("adds targeted Spanish deck rules when the practice text matches audited evidence", () => {
    const prompt = buildFeedbackPrompt(
      "Un gato duerme en un banco.",
      SAMPLE_RESULT,
      "sentence",
      "normal",
      "es-ES",
    );

    expect(prompt).toContain("当前练习材料命中的专项规则");
    expect(prompt).toContain("spanish-nasal-place-assimilation");
    expect(prompt).toContain("sentence: Un gato duerme en un banco.");
    expect(prompt).toContain("es-nasal-place");
    expect(prompt).toContain("只有 Azure 结果提供证据时");
  });

  it("adds targeted French phrase rules from audited sentence evidence", () => {
    const prompt = buildFeedbackPrompt(
      "L’ami arrive à huit heures.",
      SAMPLE_RESULT,
      "sentence",
      "normal",
      "fr-FR",
    );

    expect(prompt).toContain("当前练习材料命中的专项规则");
    expect(prompt).toContain("french-elision");
    expect(prompt).toContain("french-enchainement");
    expect(prompt).toContain("french-glide-contrast");
    expect(prompt).toContain("fr-glide-hui");
  });

  it("adds targeted Russian rule evidence from explicit sound-unit slugs", () => {
    const prompt = buildFeedbackPrompt(
      "Russian rule-unit probe",
      SAMPLE_RESULT,
      "sentence",
      "normal",
      "ru-RU",
      { targetUnitSlugs: ["ru-voicing-assimilation", "ru-clusters"] },
    );

    expect(prompt).toContain("当前练习材料命中的专项规则");
    expect(prompt).toContain("russian-voicing-assimilation");
    expect(prompt).toContain("russian-cluster-epenthesis");
    expect(prompt).toContain("target slugs: ru-voicing-assimilation");
    expect(prompt).toContain("target slugs: ru-clusters");
  });

  it("does not let perfect-score instructions overclaim non-English mastery", () => {
    const spanishPrompt = buildFeedbackPrompt(
      "canción",
      SAMPLE_RESULT,
      "phoneme",
      "normal",
      "es-ES",
    );
    const englishPrompt = buildFeedbackPrompt(
      "think",
      SAMPLE_RESULT,
      "phoneme",
      "normal",
      "en-US",
    );

    expect(spanishPrompt).toContain(
      "即使所有分数都满分，summary 也只能写\"本次录音没有发现明显问题\"",
    );
    expect(spanishPrompt).toContain("不要写\"完美\"");
    expect(spanishPrompt).toContain("不要说\"已掌握\"");
    expect(spanishPrompt).not.toContain('summary 写"完美。没有问题。"');

    expect(englishPrompt).toContain('summary 写"完美。没有问题。"');
  });
});
