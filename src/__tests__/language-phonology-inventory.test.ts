import { describe, expect, it } from "vitest";
import { getAllAssessmentSegmentAudioRegistryEntries } from "@/lib/assessment-segment-audio";
import { getAssessmentAliasesForSlug } from "@/lib/azure-phoneme-map";
import { REQUIRED_LANGUAGE_UNITS } from "@/lib/language-critical-units";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import {
  getLanguagePhonologyGaps,
  getLanguagePhonologyInventory,
  getLanguagePhonologyInventoryTableRows,
  getPhonologyInventoryEntry,
  getVisibleLanguagePhonologyGaps,
  formatLanguagePhonologyInventoryMarkdownTable,
  type NonEnglishLanguageId,
  type PhonologyInventoryLayer,
} from "@/lib/language-phonology-inventory";
import { getLanguageResourceSite } from "@/lib/language-resource-sites";

const LANGUAGE_IDS = ["es-ES", "fr-FR", "ru-RU"] as const;

const PRIMARY_SOURCE_IDS: Record<NonEnglishLanguageId, string[]> = {
  "es-ES": ["rae-ngle-phonology", "jipa-castilian-spanish", "ipa-handbook"],
  "fr-FR": ["jipa-french", "ipa-handbook"],
  "ru-RU": ["jipa-russian", "ipa-handbook"],
};

const ALLOWED_GOAL_LAYERS = new Set<PhonologyInventoryLayer>([
  "phoneme",
  "allophone",
  "contrast",
  "connected-speech-rule",
  "prosody",
]);

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

  it("keeps every critical unit represented by a source-backed inventory row", () => {
    for (const languageId of LANGUAGE_IDS) {
      const inventory = getLanguagePhonologyInventory(languageId);
      const inventoryBySlug = new Map(
        inventory.map((entry) => [entry.slug, entry]),
      );
      const requiredUnits = REQUIRED_LANGUAGE_UNITS[languageId] ?? [];

      expect(requiredUnits.length, languageId).toBeGreaterThan(0);

      for (const slug of requiredUnits) {
        const entry = inventoryBySlug.get(slug);

        expect(entry, `${languageId}:${slug}`).toBeDefined();
        expect(entry?.ipa, `${languageId}:${slug}`).toBeTruthy();
        expect(entry?.variantScope, `${languageId}:${slug}`).toBeTruthy();
        expect(entry?.sourceRefs.length, `${languageId}:${slug}`).toBeGreaterThanOrEqual(
          2,
        );
        expect(entry?.audioStatus, `${languageId}:${slug}`).toMatch(
          /^(exact-local-header|proxy-local-reference|rule-only|gap-no-local-clip)$/,
        );
        expect(entry?.tilePolicy, `${languageId}:${slug}`).toMatch(
          /^(clickable-exact-header|score-only-unverified|rule-guidance-only)$/,
        );
      }
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
    for (const slug of [
      "es-p",
      "es-t",
      "es-k",
      "es-f",
      "es-m",
      "es-n",
      "es-b-stop",
      "es-d-stop",
      "es-g-stop",
    ]) {
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
    expect(getPhonologyInventoryEntry("es-ES", "es-bv")?.soundUnitType).toBe(
      "allophone",
    );
    expect(getPhonologyInventoryEntry("es-ES", "es-d")?.layer).toBe(
      "allophone",
    );
    expect(getPhonologyInventoryEntry("es-ES", "es-d")?.soundUnitType).toBe(
      "allophone",
    );
    expect(getPhonologyInventoryEntry("es-ES", "es-g")?.layer).toBe(
      "allophone",
    );
    expect(getPhonologyInventoryEntry("es-ES", "es-g")?.soundUnitType).toBe(
      "allophone",
    );
    expect(
      getPhonologyInventoryEntry("es-ES", "es-nasal-place")?.soundUnitType,
    ).toBe("connected-speech-rule");
    expect(getPhonologyInventoryEntry("es-ES", "es-lexical-stress")?.layer).toBe(
      "prosody",
    );
    expect(getPhonologyInventoryEntry("fr-FR", "fr-liaison")?.layer).toBe(
      "connected-speech-rule",
    );
    expect(getPhonologyInventoryEntry("fr-FR", "fr-liaison")?.soundUnitType).toBe(
      "connected-speech-rule",
    );
    expect(getPhonologyInventoryEntry("fr-FR", "fr-un")?.layer).toBe(
      "contrast",
    );
    expect(
      getPhonologyInventoryEntry("fr-FR", "fr-phrase-final-prominence")?.layer,
    ).toBe("prosody");
    expect(getPhonologyInventoryEntry("ru-RU", "ru-hard-soft")?.layer).toBe(
      "contrast",
    );
    for (const slug of [
      "ru-p",
      "ru-b",
      "ru-t",
      "ru-d",
      "ru-k",
      "ru-g",
      "ru-f",
      "ru-v",
      "ru-s",
      "ru-z",
      "ru-m",
      "ru-n",
      "ru-l",
      "ru-sh",
      "ru-zh",
    ]) {
      expect(getPhonologyInventoryEntry("ru-RU", slug)?.layer).toBe("phoneme");
    }
    expect(getPhonologyInventoryEntry("ru-RU", "ru-final-devoicing")?.layer).toBe(
      "connected-speech-rule",
    );
    expect(
      getPhonologyInventoryEntry("ru-RU", "ru-final-devoicing")?.soundUnitType,
    ).toBe("connected-speech-rule");
    expect(getPhonologyInventoryEntry("ru-RU", "ru-clusters")?.layer).toBe(
      "connected-speech-rule",
    );
    expect(getPhonologyInventoryEntry("ru-RU", "ru-clusters")?.soundUnitType).toBe(
      "connected-speech-rule",
    );
  });

  it("keeps every non-English unit inside the goal-approved layer model", () => {
    for (const languageId of LANGUAGE_IDS) {
      for (const entry of getLanguagePhonologyInventory(languageId)) {
        expect(ALLOWED_GOAL_LAYERS.has(entry.layer), entry.slug).toBe(true);
        expect(entry.soundUnitType, `${languageId}:${entry.slug}`).toBe(
          entry.layer,
        );
      }
    }
  });

  it("exports maintainable source-backed inventory table rows for each language", () => {
    for (const languageId of LANGUAGE_IDS) {
      const inventory = getLanguagePhonologyInventory(languageId);
      const rows = getLanguagePhonologyInventoryTableRows(languageId);

      expect(rows).toHaveLength(inventory.length);

      for (const row of rows) {
        expect(row.slug).toBeTruthy();
        expect(row.ipa).toBeTruthy();
        expect(ALLOWED_GOAL_LAYERS.has(row.layer), row.slug).toBe(true);
        expect(row.variantScope, row.slug).toBeTruthy();
        expect(row.sourceRefs.split(", ").length, row.slug).toBeGreaterThanOrEqual(
          2,
        );
        expect(row.audioStatus, row.slug).toMatch(
          /^(exact-local-header|proxy-local-reference|rule-only|gap-no-local-clip)$/,
        );
        expect(row.tilePolicy, row.slug).toMatch(
          /^(clickable-exact-header|score-only-unverified|rule-guidance-only)$/,
        );
        expect(row.gaps, row.slug).toBeTruthy();
      }
    }
  });

  it("formats inventory tables with the required open-source audit columns", () => {
    for (const languageId of LANGUAGE_IDS) {
      const table = formatLanguagePhonologyInventoryMarkdownTable(languageId);
      const inventory = getLanguagePhonologyInventory(languageId);

      expect(table).toContain(
        "| slug | IPA | layer | variant scope | source refs | audio status | tile policy | gaps |",
      );
      expect(table.split("\n")).toHaveLength(inventory.length + 2);

      for (const entry of inventory) {
        expect(table, entry.slug).toContain(`| ${entry.slug} |`);
      }
    }
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
      ["fr-FR", "fr-phrase-final-prominence", "rule-only"],
      ["ru-RU", "ru-hard-soft", "proxy-local-reference"],
      ["ru-RU", "ru-sh-zh", "proxy-local-reference"],
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
          gap.label.includes("/p t k f m n b d g/") &&
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
    for (const slug of [
      "es-p",
      "es-t",
      "es-k",
      "es-f",
      "es-m",
      "es-n",
      "es-b-stop",
      "es-d-stop",
      "es-g-stop",
    ]) {
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
      "ru-s-sj",
      "ru-z-zj",
      "ru-n-nj",
      "ru-l-lj",
      "ru-r-rj",
      "ru-p-pj",
      "ru-b-bj",
      "ru-m-mj",
      "ru-f-fj",
      "ru-v-vj",
      "ru-k-kj",
      "ru-g-gj",
      "ru-x-xj",
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

  it("documents Russian hard-soft pair gaps as missing soft or pair clips, not missing hard anchors", () => {
    for (const [slug, hardIpa, softIpa] of [
      ["ru-t-tj", "/t/", "/tʲ/"],
      ["ru-d-dj", "/d/", "/dʲ/"],
      ["ru-s-sj", "/s/", "/sʲ/"],
      ["ru-z-zj", "/z/", "/zʲ/"],
      ["ru-n-nj", "/n/", "/nʲ/"],
      ["ru-l-lj", "/l/", "/lʲ/"],
      ["ru-r-rj", "/r/", "/rʲ/"],
      ["ru-p-pj", "/p/", "/pʲ/"],
      ["ru-b-bj", "/b/", "/bʲ/"],
      ["ru-m-mj", "/m/", "/mʲ/"],
      ["ru-f-fj", "/f/", "/fʲ/"],
      ["ru-v-vj", "/v/", "/vʲ/"],
      ["ru-k-kj", "/k/", "/kʲ/"],
      ["ru-g-gj", "/g/", "/gʲ/"],
      ["ru-x-xj", "/x/", "/xʲ/"],
    ] as const) {
      const entry = getPhonologyInventoryEntry("ru-RU", slug);
      const gapText = entry?.gaps.join(" ") ?? "";

      expect(gapText, slug).toContain(`Hard ${hardIpa} now has a standalone exact clip`);
      expect(gapText, slug).toContain(`soft ${softIpa} and pair-lesson clips are still missing`);
      expect(gapText, slug).not.toContain(`No verified exact single-segment ${hardIpa}`);
    }
  });

  it("promotes exact Russian hard consonant anchors to clickable same-unit header clips", () => {
    for (const [slug, alias] of [
      ["ru-p", "p"],
      ["ru-b", "b"],
      ["ru-t", "t"],
      ["ru-d", "d"],
      ["ru-k", "k"],
      ["ru-g", "g"],
      ["ru-f", "f"],
      ["ru-v", "v"],
      ["ru-s", "s"],
      ["ru-z", "z"],
      ["ru-m", "m"],
      ["ru-n", "n"],
      ["ru-l", "l"],
      ["ru-sh", "ʂ"],
      ["ru-zh", "ʐ"],
    ] as const) {
      const entry = getPhonologyInventoryEntry("ru-RU", slug);

      expect(entry?.layer, slug).toBe("phoneme");
      expect(entry?.audioStatus, slug).toBe("exact-local-header");
      expect(entry?.tilePolicy, slug).toBe("clickable-exact-header");
      expect(entry?.exactAssessmentAliases, slug).toContain(alias);
      expect(entry?.headerAudioSrc, slug).toBe(
        `/audio/language-assets/ru-RU/header-clips/${slug}.m4a`,
      );
    }
  });
});
