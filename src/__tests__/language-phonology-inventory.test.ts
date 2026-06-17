import { describe, expect, it } from "vitest";
import { getAllAssessmentSegmentAudioRegistryEntries } from "@/lib/assessment-segment-audio";
import { getAssessmentAliasesForSlug } from "@/lib/azure-phoneme-map";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import {
  getLanguagePhonologyGaps,
  getLanguagePhonologyInventory,
  getPhonologyInventoryEntry,
  getVisibleLanguagePhonologyGaps,
  type NonEnglishLanguageId,
} from "@/lib/language-phonology-inventory";
import { getLanguageResourceSite } from "@/lib/language-resource-sites";

const LANGUAGE_IDS = ["es-ES", "fr-FR", "ru-RU"] as const;

const PRIMARY_SOURCE_IDS: Record<NonEnglishLanguageId, string[]> = {
  "es-ES": ["rae-ngle-phonology", "jipa-castilian-spanish", "ipa-handbook"],
  "fr-FR": ["jipa-french", "ipa-handbook"],
  "ru-RU": ["jipa-russian", "ipa-handbook"],
};

describe("language phonology inventory", () => {
  it("covers every non-English sound unit exactly once", () => {
    for (const languageId of LANGUAGE_IDS) {
      const soundUnitSlugs = getLanguagePhonemes(languageId).map(
        (unit) => unit.slug,
      );
      const inventorySlugs = getLanguagePhonologyInventory(languageId).map(
        (entry) => entry.slug,
      );

      expect(new Set(inventorySlugs).size).toBe(inventorySlugs.length);
      expect(inventorySlugs.sort()).toEqual(soundUnitSlugs.sort());
    }
  });

  it("keeps every inventory row source-backed by registered references", () => {
    for (const languageId of LANGUAGE_IDS) {
      for (const entry of getLanguagePhonologyInventory(languageId)) {
        expect(entry.sourceRefs.length, entry.slug).toBeGreaterThanOrEqual(2);
        expect(
          entry.sourceRefs.some((ref) =>
            PRIMARY_SOURCE_IDS[languageId].includes(ref),
          ),
          entry.slug,
        ).toBe(true);

        for (const ref of entry.sourceRefs) {
          expect(getLanguageResourceSite(ref), `${entry.slug}:${ref}`).toBeDefined();
        }
      }
    }
  });

  it("classifies language-specific units by phonology layer instead of English template categories", () => {
    for (const slug of ["es-p", "es-t", "es-k", "es-f", "es-m", "es-n"]) {
      expect(getPhonologyInventoryEntry("es-ES", slug)?.layer).toBe("phoneme");
    }
    for (const slug of [
      "fr-p",
      "fr-b",
      "fr-t",
      "fr-d",
      "fr-k",
      "fr-g",
      "fr-f",
      "fr-v",
      "fr-s",
      "fr-z",
      "fr-m",
      "fr-n",
      "fr-l",
    ]) {
      expect(getPhonologyInventoryEntry("fr-FR", slug)?.layer).toBe("phoneme");
    }
    expect(getPhonologyInventoryEntry("es-ES", "es-bv")?.layer).toBe(
      "allophone",
    );
    expect(getPhonologyInventoryEntry("es-ES", "es-lexical-stress")?.layer).toBe(
      "prosody",
    );
    expect(getPhonologyInventoryEntry("fr-FR", "fr-liaison")?.layer).toBe(
      "connected-speech-rule",
    );
    expect(getPhonologyInventoryEntry("fr-FR", "fr-un")?.layer).toBe(
      "contrast",
    );
    expect(getPhonologyInventoryEntry("ru-RU", "ru-hard-soft")?.layer).toBe(
      "contrast",
    );
    expect(getPhonologyInventoryEntry("ru-RU", "ru-final-devoicing")?.layer).toBe(
      "connected-speech-rule",
    );
  });

  it("allows scoring tile playback only for exact local header clips", () => {
    const exactSlugs = new Set(
      getAllAssessmentSegmentAudioRegistryEntries().map(
        (entry) => `${entry.languageId}:${entry.soundUnitSlug}`,
      ),
    );

    for (const languageId of LANGUAGE_IDS) {
      for (const entry of getLanguagePhonologyInventory(languageId)) {
        const key = `${languageId}:${entry.slug}`;
        if (exactSlugs.has(key)) {
          expect(entry.audioStatus, key).toBe("exact-local-header");
          expect(entry.tilePolicy, key).toBe("clickable-exact-header");
          expect(entry.exactAssessmentAliases.length, key).toBeGreaterThan(0);
          expect(entry.headerAudioSrc, key).toMatch(
            new RegExp(`^/audio/language-assets/${languageId}/header-clips/`),
          );
        } else {
          expect(entry.tilePolicy, key).not.toBe("clickable-exact-header");
          expect(entry.exactAssessmentAliases, key).toEqual([]);
        }
      }
    }
  });

  it("keeps known rule/proxy rows unclickable while preserving their teaching status", () => {
    const expected = [
      ["es-ES", "es-nasal-place", "proxy-local-reference"],
      ["es-ES", "es-lexical-stress", "rule-only"],
      ["fr-FR", "fr-liaison", "rule-only"],
      ["fr-FR", "fr-final-consonant-silence", "rule-only"],
      ["ru-RU", "ru-hard-soft", "proxy-local-reference"],
      ["ru-RU", "ru-final-devoicing", "proxy-local-reference"],
      ["ru-RU", "ru-voicing-assimilation", "proxy-local-reference"],
    ] as const;

    for (const [languageId, slug, audioStatus] of expected) {
      const entry = getPhonologyInventoryEntry(languageId, slug);

      expect(entry?.audioStatus, `${languageId}:${slug}`).toBe(audioStatus);
      expect(entry?.tilePolicy, `${languageId}:${slug}`).not.toBe(
        "clickable-exact-header",
      );
    }
  });

  it("documents current language-level gaps instead of implying full coverage", () => {
    expect(
      getLanguagePhonologyGaps("es-ES").some(
        (gap) =>
          gap.label.includes("/p t k f m n/") &&
          gap.reason.includes("phoneme units now exist"),
      ),
    ).toBe(
      true,
    );
    expect(getLanguagePhonologyGaps("fr-FR").map((gap) => gap.label)).toContain(
      "/p b t d k g f v s z m n l/ 精确短音频",
    );
    expect(getLanguagePhonologyGaps("ru-RU").map((gap) => gap.label)).toContain(
      "complete hard/soft consonant pairs",
    );

    for (const languageId of LANGUAGE_IDS) {
      expect(
        getLanguagePhonologyGaps(languageId).some(
          (gap) => gap.expectedBeforeStable,
        ),
      ).toBe(true);
    }
  });

  it("only exposes phonology gap summaries for experimental non-English modules", () => {
    expect(getVisibleLanguagePhonologyGaps("en-US")).toEqual([]);

    for (const languageId of LANGUAGE_IDS) {
      const gaps = getVisibleLanguagePhonologyGaps(languageId);

      expect(gaps.length, languageId).toBeGreaterThan(0);
      expect(gaps.every((gap) => gap.sourceRefs.length >= 2), languageId).toBe(
        true,
      );
    }
  });

  it("keeps newly added plain Spanish consonants score-only until exact clips exist", () => {
    for (const slug of ["es-p", "es-t", "es-k", "es-f", "es-m", "es-n"]) {
      const entry = getPhonologyInventoryEntry("es-ES", slug);

      expect(entry?.audioStatus, slug).toBe("gap-no-local-clip");
      expect(entry?.tilePolicy, slug).toBe("score-only-unverified");
      expect(getAssessmentAliasesForSlug(slug).length, slug).toBeGreaterThan(0);
      expect(entry?.exactAssessmentAliases, slug).toEqual([]);
      expect(entry?.headerAudioSrc, slug).toBeUndefined();
    }
  });

  it("keeps newly added plain French consonants score-only until exact clips exist", () => {
    for (const slug of [
      "fr-p",
      "fr-b",
      "fr-t",
      "fr-d",
      "fr-k",
      "fr-g",
      "fr-f",
      "fr-v",
      "fr-s",
      "fr-z",
      "fr-m",
      "fr-n",
      "fr-l",
    ]) {
      const entry = getPhonologyInventoryEntry("fr-FR", slug);

      expect(entry?.audioStatus, slug).toBe("gap-no-local-clip");
      expect(entry?.tilePolicy, slug).toBe("score-only-unverified");
      expect(getAssessmentAliasesForSlug(slug).length, slug).toBeGreaterThan(0);
      expect(entry?.exactAssessmentAliases, slug).toEqual([]);
      expect(entry?.headerAudioSrc, slug).toBeUndefined();
    }
  });

  it("keeps newly added Russian hard-soft pairs score-only until exact clips exist", () => {
    for (const slug of [
      "ru-t-tj",
      "ru-d-dj",
      "ru-p-pj",
      "ru-b-bj",
      "ru-m-mj",
      "ru-f-fj",
      "ru-v-vj",
    ]) {
      const entry = getPhonologyInventoryEntry("ru-RU", slug);

      expect(entry?.layer, slug).toBe("contrast");
      expect(entry?.audioStatus, slug).toBe("gap-no-local-clip");
      expect(entry?.tilePolicy, slug).toBe("score-only-unverified");
      expect(getAssessmentAliasesForSlug(slug).length, slug).toBeGreaterThan(0);
      expect(entry?.exactAssessmentAliases, slug).toEqual([]);
      expect(entry?.headerAudioSrc, slug).toBeUndefined();
    }
  });
});
