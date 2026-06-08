import { describe, expect, it } from "vitest";
import {
  LANGUAGE_RESOURCE_SITES,
  getLanguageResourceSites,
  hasLanguageResourceKind,
} from "@/lib/language-resource-sites";
import type { LanguageId } from "@/types/language";

const NON_ENGLISH_LANGUAGES: LanguageId[] = ["es-ES", "fr-FR", "ru-RU"];

describe("language resource sites", () => {
  it("keeps resource ids unique and URLs safe to open", () => {
    const ids = LANGUAGE_RESOURCE_SITES.map((site) => site.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const site of LANGUAGE_RESOURCE_SITES) {
      expect(site.url).toMatch(/^https:\/\//);
      expect(site.title.trim()).not.toBe("");
      expect(site.strengths.length).toBeGreaterThan(0);
      expect(site.limitations.length).toBeGreaterThan(0);
      expect([
        "reference-only",
        "link-out",
        "manual-verification",
      ]).toContain(site.usagePolicy);
    }
  });

  it("gives every non-English language the minimum verification stack", () => {
    for (const languageId of NON_ENGLISH_LANGUAGES) {
      const sites = getLanguageResourceSites(languageId);

      expect(sites.length).toBeGreaterThanOrEqual(3);
      expect(hasLanguageResourceKind(languageId, ["ipa-converter"])).toBe(
        true,
      );
      expect(
        hasLanguageResourceKind(languageId, ["dictionary", "native-audio"]),
      ).toBe(true);
      expect(
        hasLanguageResourceKind(languageId, [
          "articulation-guide",
          "phonology-rules",
          "pronunciation-trainer",
        ]),
      ).toBe(true);
    }
  });
});
