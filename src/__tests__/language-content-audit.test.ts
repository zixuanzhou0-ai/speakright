import { describe, expect, it } from "vitest";
import { auditAllLanguages, auditLanguageCoverage } from "@/lib/language-content-audit";
import {
  countLanguageTrainingWords,
  getLanguageContentPack,
} from "@/lib/language-content-packs";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import {
  getDefaultPhonemeSlug,
  getEnabledLanguageProfiles,
  getLanguageProfile,
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

  it("ships Spanish beta as real content, not only a language toggle", () => {
    const profile = getLanguageProfile("es-ES");
    const pack = getLanguageContentPack("es-ES");

    expect(profile.readiness.wordPractice).toBe(true);
    expect(profile.readiness.sentencePractice).toBe(true);
    expect(profile.readiness.diagnosis).toBe(true);
    expect(profile.readiness.evidenceMastery).toBe(false);
    expect(pack.assessment.screeningWords).toHaveLength(10);
    expect(pack.assessment.paragraph.length).toBeGreaterThan(120);
    expect(pack.sentenceBank.length).toBeGreaterThanOrEqual(12);
    expect(pack.minimalPairs.length).toBeGreaterThanOrEqual(5);
    expect(countLanguageTrainingWords("es-ES")).toBeGreaterThan(100);
  });

  it("keeps Spanish beta pronunciation references linguistically sane", () => {
    const pack = getLanguageContentPack("es-ES");
    const tapR = pack.wordBank["es-tap-r"]?.map((item) => item.word) ?? [];
    const trillR = pack.wordBank["es-trill-r"]?.map((item) => item.word) ?? [];
    const allMinimalPairWords = pack.minimalPairs.flatMap((set) =>
      set.pairs.flatMap((pair) => [pair.wordA, pair.wordB]),
    );
    const oU = pack.minimalPairs.find((set) => set.id === "es-o-u");
    const theta = getLanguagePhonemeBySlug("es-ES", "es-theta");

    expect(tapR).not.toContain("arroz");
    expect(trillR).toContain("arroz");
    expect(allMinimalPairWords).not.toContain("ano");
    expect(allMinimalPairWords).not.toContain("litchi");
    expect(allMinimalPairWords).toContain("peña");
    expect(oU?.kind).toBe("near-contrast");
    expect(theta?.description).not.toContain("送气");
  });

  it("keeps Spanish diagnosis and contrast references inside the Spanish inventory", () => {
    const pack = getLanguageContentPack("es-ES");
    const slugs = new Set(pack.phonemeUnits.map((unit) => unit.slug));
    const referenced = new Set<string>();

    for (const word of [
      ...pack.assessment.screeningWords,
      ...pack.assessment.adaptiveWords,
    ]) {
      for (const slug of word.targetPhonemes) referenced.add(slug);
    }
    for (const set of pack.minimalPairs) {
      referenced.add(set.phonemeA);
      referenced.add(set.phonemeB);
    }
    for (const slug of pack.assessment.trackedPhonemes) referenced.add(slug);

    expect([...referenced].filter((slug) => !slugs.has(slug))).toHaveLength(0);
  });

  it("keeps French and Russian gated until content and Azure evidence are ready", () => {
    for (const languageId of ["fr-FR", "ru-RU"] as const) {
      const profile = getLanguageProfile(languageId);
      const pack = getLanguageContentPack(languageId);

      expect(profile.readiness.wordPractice).toBe(false);
      expect(profile.readiness.sentencePractice).toBe(false);
      expect(profile.readiness.diagnosis).toBe(false);
      expect(profile.readiness.evidenceMastery).toBe(false);
      expect(pack.assessment.screeningWords).toHaveLength(0);
      expect(pack.sentenceBank).toHaveLength(0);
      expect(pack.minimalPairs).toHaveLength(0);
    }
  });
});
