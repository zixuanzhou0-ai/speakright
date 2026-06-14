import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildNonEnglishIpaAuditInput,
  buildNonEnglishIpaAuditRows,
  type NonEnglishIpaAuditInput,
} from "@/lib/non-english-ipa-audit";
import { getLanguagePhonemes } from "@/lib/language-phonemes";

describe("non-English IPA audit input", () => {
  it("exports the final expanded Spanish/French/Russian UI corpus", () => {
    const rows = buildNonEnglishIpaAuditRows();
    const expectedRowCount = (["es-ES", "fr-FR", "ru-RU"] as const)
      .flatMap((languageId) => getLanguagePhonemes(languageId))
      .reduce((total, soundUnit) => total + soundUnit.keywords.length, 0);

    expect(rows).toHaveLength(expectedRowCount);
    expect(rows).toHaveLength(1736);
  });

  it("marks deck sentence IPA hints as focus cues instead of full transcriptions", () => {
    const rows = buildNonEnglishIpaAuditRows();
    const russianSofteningHint = rows.find(
      (row) =>
        row.languageId === "ru-RU" &&
        row.unitSlug === "ru-soft-s-z" &&
        row.text === "Сад зимой синий." &&
        row.currentIpa === "/s sʲ zʲ/",
    );

    expect(russianSofteningHint).toMatchObject({
      auditRole: "deck-focus-hint",
      sourceFile: "src/lib/language-learning-decks.ts",
      currentDisplayType: "sentence",
    });
    expect(russianSofteningHint?.sourceNotes).toContain(
      "do not treat currentIpa as a full sentence transcription",
    );

    const russianConnectedSpeechRow = rows.find(
      (row) =>
        row.languageId === "ru-RU" &&
        row.unitSlug === "ru-final-devoicing" &&
        row.text === "Сад зимой синий." &&
        row.currentIpa === "/sad zʲɪˈmoj ˈsʲinʲɪj/",
    );

    expect(russianConnectedSpeechRow).toMatchObject({
      auditRole: "ipa-transcription",
      sourceFile: "src/lib/language-phonemes.ts",
      currentDisplayType: "sentence",
    });
  });

  it("keeps high-risk French connected-speech rows out of stale word-boundary IPA", () => {
    const rows = buildNonEnglishIpaAuditRows();
    const expectedFrenchRows = new Map([
      ["l'homme écoute", "/lɔmekut/"],
      ["l'école ouvre", "/lekɔluvʁ/"],
      ["d'accord avec elle", "/dakɔʁ avɛkɛl/"],
    ]);
    const staleIpa = new Set(["/lɔm ekut/", "/lekɔl uvʁ/", "/dakɔʁ avɛk ɛl/"]);

    for (const [text, expectedIpa] of expectedFrenchRows) {
      const matches = rows.filter(
        (row) =>
          row.languageId === "fr-FR" &&
          row.unitSlug === "fr-elision" &&
          row.text === text &&
          row.auditRole === "ipa-transcription",
      );

      expect(matches.map((row) => row.currentIpa), text).toContain(expectedIpa);
      expect(
        matches.some((row) => staleIpa.has(row.currentIpa)),
        text,
      ).toBe(false);
    }
  });

  it("asks external reviewers to echo auditRole in returned tables", () => {
    const input = buildNonEnglishIpaAuditInput("2026-06-14T00:00:00.000Z");

    expect(input.requiredOutputFields).toContain("auditRole");
    expect(input.rowCount).toBe(input.rows.length);
    expect(input.rows.some((row) => row.auditRole === "deck-focus-hint")).toBe(
      true,
    );
    expect(input.rows.some((row) => row.auditRole === "ipa-transcription")).toBe(
      true,
    );
  });

  it("keeps the tracked audit JSON synchronized with current source data", () => {
    const trackedPath = resolve(
      process.cwd(),
      "docs",
      "operations",
      "non-english-ipa-audit-input.json",
    );
    const tracked = JSON.parse(
      readFileSync(trackedPath, "utf8"),
    ) as NonEnglishIpaAuditInput;
    const current = buildNonEnglishIpaAuditInput(tracked.generatedAt);

    expect(tracked).toEqual(current);
  });
});
