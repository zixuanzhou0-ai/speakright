import { describe, expect, it } from "vitest";
import { parseFeedback } from "@/hooks/use-llm-feedback";

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
});
