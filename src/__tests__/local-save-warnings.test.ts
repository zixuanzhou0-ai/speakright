import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

describe("local-save warning wiring", () => {
  it("wires free-practice score and mastery persistence failures into the recording card", () => {
    const page = readProjectFile("src/app/sentences/page.tsx");

    expect(page).toContain("const scoreSaved = addScore");
    expect(page).toContain("masterySaved = saveMasteryProfile");
    expect(page).toContain("setLocalSaveError(");
    expect(page).toContain("localSaveError={localSaveError}");
    expect(page).toContain("本机趋势图、练习记录或迁移证据未保存");
  });

  it("wires drill score persistence warnings into word and sentence drill pages", () => {
    const hook = readProjectFile("src/hooks/use-drill-session.ts");
    const wordPage = readProjectFile("src/app/drill/word/page.tsx");
    const sentencePage = readProjectFile("src/app/drill/sentence/page.tsx");

    expect(hook).toContain("const scoreSaved = addScore");
    expect(hook).toContain("localSaveError");
    expect(hook).toContain("本机训练趋势记录未保存");
    expect(wordPage).toContain('data-smoke="drill-local-save-error"');
    expect(sentencePage).toContain('data-smoke="drill-local-save-error"');
  });

  it("wires advanced mastery persistence failures into visible drill warnings", () => {
    const warning = readProjectFile("src/lib/local-save-warning.ts");
    const pages = [
      {
        path: "src/app/drill/pack/[packId]/pack-runner-client.tsx",
        marker: 'data-smoke="pack-runner-local-save-warning"',
        saveCall: "const profileSaved = saveMasteryProfile(profile)",
      },
      {
        path: "src/app/drill/perception/page.tsx",
        marker: 'data-smoke="perception-local-save-warning"',
        saveCall: "const profileSaved = saveMasteryProfile(nextProfile)",
      },
      {
        path: "src/app/drill/prosody/page.tsx",
        marker: 'data-smoke="prosody-local-save-warning"',
        saveCall: "const profileSaved = saveMasteryProfile(profile)",
      },
      {
        path: "src/app/drill/scenarios/page.tsx",
        marker: 'data-smoke="scenario-local-save-warning"',
        saveCall: "const profileSaved = saveMasteryProfile(recorded.profile)",
      },
      {
        path: "src/app/drill/spontaneous/page.tsx",
        marker: 'data-smoke="spontaneous-local-save-warning"',
        saveCall: "const profileSaved = saveMasteryProfile(recorded.profile)",
      },
    ];

    expect(warning).toContain("本机掌握度、复习队列或迁移证据未保存");

    for (const page of pages) {
      const source = readProjectFile(page.path);
      expect(source).toContain("LOCAL_MASTERY_SAVE_WARNING");
      expect(source).toContain(page.saveCall);
      expect(source).toContain("setLocalSaveWarning(");
      expect(source).toContain(page.marker);
    }
  });

  it("wires assessment report persistence failures into visible warnings without blocking reports", () => {
    const warning = readProjectFile("src/lib/local-save-warning.ts");
    const assessmentPage = readProjectFile("src/app/assessment/page.tsx");
    const passagePage = readProjectFile("src/app/assessment/passage/page.tsx");

    expect(warning).toContain("本机历史报告或复测基线未保存");
    expect(warning).toContain("本机历史诊断报告没有删除成功");

    expect(assessmentPage).toContain("LOCAL_ASSESSMENT_SAVE_WARNING");
    expect(assessmentPage).toContain(
      "function saveReport(report: DiagnosisReport, languageId: string): boolean",
    );
    expect(assessmentPage).toContain("const reportSaved = saveReport");
    expect(assessmentPage).toContain("setSavedReport(report)");
    expect(assessmentPage).toContain(
      'data-smoke="assessment-local-save-warning"',
    );

    expect(passagePage).toContain("LOCAL_ASSESSMENT_SAVE_WARNING");
    expect(passagePage).toContain(
      "function saveReport(report: DiagnosisReport, languageId: string): boolean",
    );
    expect(passagePage).toContain("const reportSaved = saveReport");
    expect(passagePage).toContain("compareCoverageReportToHistory(report, [])");
    expect(passagePage).toContain("setBenchmarkComparison(comparison)");
    expect(passagePage).toContain(
      'data-smoke="assessment-passage-local-save-warning"',
    );
  });
});
