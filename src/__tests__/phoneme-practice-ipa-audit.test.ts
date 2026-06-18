import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IPA_FIELD_PATTERN,
  buildPhonemePracticeIpaAuditInput,
  buildPhonemePracticeIpaAuditRows,
} from "@/lib/phoneme-practice-ipa-audit";
import { getLanguagePhonemePracticeGroups } from "@/lib/language-sound-unit-groups";
import type { LanguageId } from "@/types/language";

const LANGUAGE_IDS = ["en-US", "es-ES", "fr-FR", "ru-RU"] as const;

function expectedVisibleKeywordCount(languageId: LanguageId): number {
  return getLanguagePhonemePracticeGroups(languageId).reduce(
    (sum, group) =>
      sum +
      group.units.reduce(
        (groupSum, unit) => groupSum + unit.keywords.length,
        0,
      ),
    0,
  );
}

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("phoneme practice IPA audit", () => {
  it("exports exactly the visible phoneme-practice corpus for all languages", () => {
    const rows = buildPhonemePracticeIpaAuditRows();
    const counts = Object.fromEntries(
      LANGUAGE_IDS.map((languageId) => [
        languageId,
        rows.filter((row) => row.languageId === languageId).length,
      ]),
    );

    expect(rows).toHaveLength(2814);
    expect(counts).toEqual({
      "en-US": expectedVisibleKeywordCount("en-US"),
      "es-ES": expectedVisibleKeywordCount("es-ES"),
      "fr-FR": expectedVisibleKeywordCount("fr-FR"),
      "ru-RU": expectedVisibleKeywordCount("ru-RU"),
    });
  });

  it("does not reintroduce hidden non-English rule units into IPA audit scope", () => {
    const hiddenSlugs = new Set([
      "es-nasal-place",
      "es-lexical-stress",
      "es-syllable-rhythm",
      "fr-final-consonant-silence",
      "fr-liaison",
      "fr-enchainement",
      "fr-elision",
      "fr-phrase-final-prominence",
      "ru-hard-soft",
      "ru-soft-t-d",
      "ru-soft-s-z",
      "ru-soft-n-l-r",
      "ru-soft-labials",
      "ru-soft-sign",
      "ru-stress-reduction",
      "ru-unstressed-o-a",
      "ru-unstressed-e-ya",
      "ru-iotated-vowels",
      "ru-final-devoicing",
      "ru-voicing-assimilation",
      "ru-clusters",
    ]);

    const auditedSlugs = new Set(
      buildPhonemePracticeIpaAuditRows().map((row) => row.unitSlug),
    );

    for (const slug of hiddenSlugs) {
      expect(auditedSlugs.has(slug), slug).toBe(false);
    }
  });

  it("keeps every visible IPA row delimited and classifies words, phrases, and sentences", () => {
    const rows = buildPhonemePracticeIpaAuditRows();

    for (const row of rows) {
      expect(row.currentIpa, `${row.languageId}:${row.unitSlug}:${row.text}`).toMatch(
        IPA_FIELD_PATTERN,
      );
    }

    expect(rows.find((row) => row.text === "see")?.currentDisplayType).toBe(
      "word",
    );
    expect(
      rows.find((row) => row.text === "banco blanco")?.currentDisplayType,
    ).toBe("phrase");
    expect(
      rows.find((row) => row.text === "Beto busca un banco.")
        ?.currentDisplayType,
    ).toBe("sentence");
  });

  it("marks deck sentence focus hints without treating them as full IPA transcriptions", () => {
    const rows = buildPhonemePracticeIpaAuditRows();
    const russianFocusHint = rows.find(
      (row) =>
        row.languageId === "ru-RU" &&
        row.unitSlug === "ru-e" &&
        row.text === "Это билет в театр.",
    );

    expect(russianFocusHint).toMatchObject({
      auditRole: "deck-focus-hint",
      currentIpa: "/e i/",
      sourceFile: "src/lib/language-learning-decks.ts",
    });
  });

  it("keeps Spanish visible practice rows phoneme-first outside explicit allophone units", () => {
    const rows = buildPhonemePracticeIpaAuditRows().filter(
      (row) => row.languageId === "es-ES",
    );
    const allophoneUnits = new Set(["es-bv", "es-d", "es-g"]);
    const ordinaryRows = rows.filter((row) => !allophoneUnits.has(row.unitSlug));

    expect(
      rows
        .filter((row) => /[ŋɱ]/.test(row.currentIpa))
        .map((row) => `${row.unitSlug}:${row.text}:${row.currentIpa}`),
    ).toEqual([]);
    expect(
      ordinaryRows
        .filter((row) => /[βðɣ]/.test(row.currentIpa))
        .map((row) => `${row.unitSlug}:${row.text}:${row.currentIpa}`),
    ).toEqual([]);
  });

  it("keeps Russian visible phrase IPA stress-visible unless it is only a deck focus hint", () => {
    const rows = buildPhonemePracticeIpaAuditRows().filter(
      (row) =>
        row.languageId === "ru-RU" &&
        row.auditRole === "ipa-transcription" &&
        row.currentDisplayType !== "word",
    );

    expect(
      rows
        .filter((row) => !row.currentIpa.includes("ˈ"))
        .map((row) => `${row.unitSlug}:${row.text}:${row.currentIpa}`),
    ).toEqual([]);
  });

  it("wires the phoneme-practice IPA audit export command", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const script = readProjectFile(
      "scripts/export-phoneme-practice-ipa-audit-input.mjs",
    );

    expect(packageJson.scripts["ipa:practice:audit:export"]).toContain(
      "export-phoneme-practice-ipa-audit-input.mjs",
    );
    expect(script).toContain("phoneme-practice-ipa-audit-input.json");
    expect(script).toContain("buildPhonemePracticeIpaAuditInput");
  });

  it("documents conservative audit policy in the generated input", () => {
    const input = buildPhonemePracticeIpaAuditInput("2026-06-18T00:00:00.000Z");

    expect(input.rowCount).toBe(input.rows.length);
    expect(input.confirmedPolicy.spanish).toContain("phoneme-first");
    expect(input.confirmedPolicy.russian).toContain("Stress");
    expect(input.requiredOutputFields).toContain("recommendedIpa");
    expect(input.requiredOutputFields).toContain("evidence");
  });
});
