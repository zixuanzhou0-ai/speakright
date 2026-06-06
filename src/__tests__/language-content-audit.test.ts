import { describe, expect, it } from "vitest";
import { auditAllLanguages, auditLanguageCoverage } from "@/lib/language-content-audit";
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

  it("exposes that non-English languages are not complete learning systems yet", () => {
    const audits = auditAllLanguages().filter(
      (audit) => audit.languageId !== "en-US",
    );

    for (const audit of audits) {
      expect(audit.soundUnits).toBeGreaterThanOrEqual(10);
      expect(audit.averageKeywordsPerUnit).toBeGreaterThanOrEqual(6);
      expect(audit.missingCapabilities).toContain("证据驱动 mastery");
      expect(audit.missingCapabilities).toContain("本地授权教学视频");
      expect(audit.coverageScore).toBeLessThan(100);
    }
  });

  it("ensures every language default slug exists in its inventory", () => {
    for (const profile of getEnabledLanguageProfiles()) {
      const defaultSlug = getDefaultPhonemeSlug(profile.id);

      expect(profile.phonemeInventory.some((unit) => unit.slug === defaultSlug)).toBe(
        true,
      );
    }
  });
});
