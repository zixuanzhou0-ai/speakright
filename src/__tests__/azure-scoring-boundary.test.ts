import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LANGUAGE_PROFILES } from "@/lib/language-profiles";

const projectRoot = process.cwd();

function read(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

describe("Azure scoring boundary", () => {
  it("maps every public language to its matching Azure Speech locale", () => {
    expect(LANGUAGE_PROFILES["en-US"].azureLocale).toBe("en-US");
    expect(LANGUAGE_PROFILES["es-ES"].azureLocale).toBe("es-ES");
    expect(LANGUAGE_PROFILES["fr-FR"].azureLocale).toBe("fr-FR");
    expect(LANGUAGE_PROFILES["ru-RU"].azureLocale).toBe("ru-RU");
  });

  it("sends the selected locale to Azure Speech pronunciation assessment", () => {
    const apiClient = read("src/lib/api-client.ts");
    const azureHook = read("src/hooks/use-azure-assessment.ts");

    expect(apiClient).toContain("language=");
    expect(apiClient).toContain("encodeURIComponent(language)");
    expect(apiClient).toContain("&format=detailed");
    expect(apiClient).toContain('"Pronunciation-Assessment"');
    expect(azureHook).toContain("assessPronunciation(");
    expect(azureHook).toContain("language,");
    expect(azureHook).toContain("setResult(assessed)");
  });

  it("uses languageProfile.azureLocale in user-facing recording flows", () => {
    for (const path of [
      "src/app/phonemes/[phoneme]/phoneme-detail-page.tsx",
      "src/app/sentences/page.tsx",
      "src/app/assessment/page.tsx",
      "src/app/assessment/passage/page.tsx",
      "src/app/drill/contrast/page.tsx",
      "src/app/drill/prosody/page.tsx",
      "src/app/drill/scenarios/page.tsx",
      "src/app/drill/pack/[packId]/pack-runner-client.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toContain("languageProfile.azureLocale");
      expect(source, path).toContain(".assess(");
    }

    for (const path of [
      "src/app/drill/word/page.tsx",
      "src/app/drill/sentence/page.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toContain("azureLocale: languageProfile.azureLocale");
    }
  });

  it("keeps LLM feedback downstream of Azure results instead of producing numeric scores", () => {
    const phonemePage = read("src/app/phonemes/[phoneme]/phoneme-detail-page.tsx");
    const sentencesPage = read("src/app/sentences/page.tsx");
    const llmPrompt = read("src/lib/llm-prompt.ts");

    expect(phonemePage).toContain("const result = await azure.assess(");
    expect(phonemePage).toContain("llm.requestFeedback(");
    expect(phonemePage).toContain("result,");
    expect(sentencesPage).toContain("const result = await azure.assess(");
    expect(sentencesPage).toContain("llm.requestFeedback(");
    expect(sentencesPage).toContain("result,");
    expect(llmPrompt).toContain("Azure 发音评估结果");
    expect(llmPrompt).toContain("声学判断只能来自 Azure JSON");
    expect(llmPrompt).toContain("不能当成某个目标音素已经掌握的证据");
  });

  it("keeps score fixtures behind explicit smoke-only query parameters", () => {
    const phonemePage = read("src/app/phonemes/[phoneme]/phoneme-detail-page.tsx");
    const smoke = read("scripts/desktop-ui-smoke.mjs");

    expect(phonemePage).toContain("SMOKE_SCORE_SUMMARY_RESULT");
    expect(phonemePage).toContain('searchParams.get("smokeScoreSummary") === "1"');
    expect(phonemePage).toContain("azure.result ??");
    expect(phonemePage).not.toContain(
      "scoreSummaryResult = SMOKE_SCORE_SUMMARY_RESULT",
    );
    expect(smoke).toContain("/phonemes/ee?smokeScoreSummary=1");
  });
});
