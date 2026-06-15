import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canRecordFormalMastery,
  getExperimentalMasteryBlocker,
} from "@/lib/mastery-language-policy";
import type { LanguageId } from "@/types/language";

const EXPERIMENTAL_LANGUAGES: LanguageId[] = ["es-ES", "fr-FR", "ru-RU"];

describe("mastery language policy", () => {
  it("keeps formal mastery recording English-only", () => {
    expect(canRecordFormalMastery("en-US")).toBe(true);

    for (const languageId of EXPERIMENTAL_LANGUAGES) {
      expect(canRecordFormalMastery(languageId), languageId).toBe(false);
    }
  });

  it("returns an explicit experimental blocker for non-English languages", () => {
    expect(getExperimentalMasteryBlocker("en-US")).toBeNull();

    for (const languageId of EXPERIMENTAL_LANGUAGES) {
      expect(getExperimentalMasteryBlocker(languageId), languageId).toContain(
        "experimental",
      );
    }
  });

  it("keeps advanced pack-runner mastery writes behind the formal policy", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/drill/pack/[packId]/pack-runner-client.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("canRecordFormalMastery(languageId)");
    expect(source).toContain("!canRecordFormalMastery(languageId)");
    expect(source).toContain("pack-runner-experimental-blocker");
    expect(source).toContain("const mastered = canPromoteMastery &&");
    expect(source).toContain("if (canPromoteMastery) {");
    expect(source).toContain("saveMasteryProfile(profile)");
  });

  it("keeps HVPT perception mastery writes behind the formal policy", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/drill/perception/page.tsx"),
      "utf8",
    );

    expect(source).toContain("canRecordFormalMastery(languageId)");
    expect(source).toContain("const canRecordHvptMastery =");
    expect(source).toContain("!canRecordHvptMastery");
    expect(source).toContain("saveMasteryProfile(nextProfile)");
  });

  it("keeps formal evidence archives behind the English-only policy", () => {
    const evidencePage = readFileSync(
      join(process.cwd(), "src/app/drill/evidence/page.tsx"),
      "utf8",
    );
    const coveragePassagePage = readFileSync(
      join(process.cwd(), "src/app/assessment/passage/page.tsx"),
      "utf8",
    );

    expect(evidencePage).toContain("canRecordFormalMastery(languageId)");
    expect(evidencePage).toContain("const canShowFormalEvidence =");
    expect(evidencePage).toContain("if (!canShowFormalEvidence)");
    expect(evidencePage).toContain("setProfile(null)");
    expect(evidencePage).toContain("evidence-experimental-blocker");
    expect(evidencePage).toContain("不读取或显示正式英语 mastery");

    expect(coveragePassagePage).toContain("canRecordFormalMastery(languageId)");
    expect(coveragePassagePage).toContain("const canUseCoveragePassage =");
    expect(coveragePassagePage).toContain("if (!canUseCoveragePassage)");
    expect(coveragePassagePage).toContain(
      "assessment-passage-experimental-blocker",
    );
    expect(coveragePassagePage).toContain("不加载英语全音覆盖文章");
  });
});
