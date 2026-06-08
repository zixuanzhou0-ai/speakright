import { describe, expect, it } from "vitest";
import {
  auditAllLanguages,
  auditLanguageCoverage,
} from "@/lib/language-content-audit";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import {
  getDefaultPhonemeSlug,
  getEnabledLanguageProfiles,
} from "@/lib/language-profiles";

describe("language content audit", () => {
  it("keeps English as the complete baseline", () => {
    const audit = auditLanguageCoverage("en-US");

    expect(audit.soundUnits).toBeGreaterThanOrEqual(40);
    expect(audit.unitsWithTooFewKeywords).toHaveLength(0);
    expect(audit.missingCapabilities).toHaveLength(0);
    expect(audit.coverageScore).toBe(100);
  });

  it("exposes non-English beta systems without hiding unfinished capabilities", () => {
    const audits = auditAllLanguages().filter(
      (audit) => audit.languageId !== "en-US",
    );

    for (const audit of audits) {
      expect(audit.soundUnits).toBeGreaterThanOrEqual(10);
      expect(audit.averageKeywordsPerUnit).toBeGreaterThanOrEqual(6);
      expect(audit.missingCapabilities).not.toContain("专用单词音频");
      expect(audit.missingCapabilities).not.toContain("单词训练闭环");
      expect(audit.missingCapabilities).not.toContain("句子训练闭环");
      expect(audit.missingCapabilities).not.toContain("发音诊断");
      expect(audit.missingCapabilities).toContain("证据驱动 mastery");
      expect(audit.missingCapabilities).not.toContain("本地授权教学视频");
      expect(audit.unitsWithoutTeachingResources).toHaveLength(0);
      expect(audit.unitsWithoutPhonemeAudio).toHaveLength(0);
      expect(audit.unitsWithoutSourceRefs).toHaveLength(0);
      expect(audit.unitsWithUnknownSourceRefs).toHaveLength(0);
      expect(audit.unitsWithoutLearnerNotes).toHaveLength(0);
      expect(audit.keywordsWithoutSourceRefs).toHaveLength(0);
      expect(audit.keywordsNeedingReview).toHaveLength(0);
      expect(audit.coverageScore).toBeLessThan(100);
    }
  });

  it("ensures every language default slug exists in its inventory", () => {
    for (const profile of getEnabledLanguageProfiles()) {
      const defaultSlug = getDefaultPhonemeSlug(profile.id);

      expect(
        profile.phonemeInventory.some((unit) => unit.slug === defaultSlug),
      ).toBe(true);
    }
  });

  it("keeps every non-English sound unit at or above 20 pronunciation options", () => {
    const underfilledUnits = (["es-ES", "fr-FR", "ru-RU"] as const).flatMap(
      (languageId) =>
        getLanguagePhonemes(languageId)
          .filter((soundUnit) => soundUnit.keywords.length < 20)
          .map(
            (soundUnit) =>
              `${languageId}:${soundUnit.slug}:${soundUnit.keywords.length}`,
          ),
    );

    expect(underfilledUnits).toEqual([]);
  });

  it("covers language-critical beta units for Spanish, French, and Russian", () => {
    for (const languageId of ["es-ES", "fr-FR", "ru-RU"] as const) {
      const audit = auditLanguageCoverage(languageId);
      expect(audit.missingLanguageCriticalUnits).toEqual([]);
    }
  });

  it("marks every required Russian core word with visible stress text", () => {
    const russianAudit = auditLanguageCoverage("ru-RU");
    expect(russianAudit.russianKeywordsWithoutStress).toEqual([]);
  });
});
