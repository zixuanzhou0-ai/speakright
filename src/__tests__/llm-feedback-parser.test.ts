import { describe, expect, it } from "vitest";
import {
  normalizeLlmFeedbackError,
  parseFeedback,
} from "@/hooks/use-llm-feedback";

describe("llm feedback parser", () => {
  it("extracts the practice_now action layer", () => {
    const parsed = parseFeedback(
      `<summary>重点改 /th/。</summary>
<top_issues>- /th/ 缩回成 /s/</top_issues>
<practice_now>1. **think** 慢读 3 遍。</practice_now>
<priority_fixes>### 板块1</priority_fixes>
<dimensions>音素准确度偏低。</dimensions>
<details>舌尖需要到齿边。</details>`,
      false,
    );

    expect(parsed.practiceNow).toContain("think");
    expect(parsed.priorityFixes).toContain("板块1");
  });

  it("keeps streaming partial practice_now content", () => {
    const parsed = parseFeedback(
      "<summary>继续</summary><practice_now>1. 慢读",
      true,
    );

    expect(parsed.practiceNow).toBe("1. 慢读");
  });

  it("falls back to summary for unstructured final text", () => {
    const parsed = parseFeedback("plain feedback", false);

    expect(parsed.summary).toBe("plain feedback");
    expect(parsed.practiceNow).toBe("");
  });

  it("normalizes raw LLM provider errors to Chinese user-facing messages", () => {
    expect(
      normalizeLlmFeedbackError("LLM test failed (401): invalid key"),
    ).toBe(
      "AI 教练认证失败，请检查设置页里的 LLM API Key、Provider 和模型是否匹配。",
    );
    expect(normalizeLlmFeedbackError("TypeError: Failed to fetch")).toBe(
      "无法连接 AI 教练服务，请检查网络、代理或 LLM provider 配置后重试。",
    );
    expect(normalizeLlmFeedbackError("rate limit exceeded")).toBe(
      "AI 教练请求过于频繁或额度不足，请稍后重试或检查 provider 额度。",
    );
  });
});
