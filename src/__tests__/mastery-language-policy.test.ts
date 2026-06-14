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
});
