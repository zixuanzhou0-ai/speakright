import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const assessmentPage = readFileSync(
  resolve(process.cwd(), "src/app/assessment/page.tsx"),
  "utf8",
);

describe("quick diagnosis baseline protection", () => {
  it("defaults to an independent first attempt and makes preview an explicit request", () => {
    expect(assessmentPage).toContain('"需要提示？听示范"');
    expect(assessmentPage).toContain(
      'variant={recorder.audioBlob ? "outline" : "ghost"}',
    );
    expect(assessmentPage).toContain("wordAttemptSupportRef.current =");
    expect(assessmentPage).toContain("wordPreviewPlayedRef.current");
    expect(assessmentPage).toContain(
      "supportLevel: wordAttemptSupportRef.current",
    );
  });

  it("keeps comparison playback available after recording without relabeling the attempt", () => {
    expect(assessmentPage).toContain('"听示范做对比"');
    expect(assessmentPage).toContain(
      "本次为独立首答；录音后可以听示范做对比。",
    );
    expect(assessmentPage).toContain("仅作辅助对比，不计入独立诊断基线。");
    expect(assessmentPage).toContain(
      'data-smoke="assessment-word-support-state"',
    );
  });
});
