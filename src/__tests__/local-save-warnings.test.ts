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
});
