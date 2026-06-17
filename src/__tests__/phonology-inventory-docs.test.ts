import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatLanguagePhonologyInventoryMarkdownDocument,
  type NonEnglishLanguageId,
} from "@/lib/language-phonology-inventory";

const DOCS: Array<[NonEnglishLanguageId, string]> = [
  ["es-ES", "SPANISH_PHONOLOGY_INVENTORY_TABLE.md"],
  ["fr-FR", "FRENCH_PHONOLOGY_INVENTORY_TABLE.md"],
  ["ru-RU", "RUSSIAN_PHONOLOGY_INVENTORY_TABLE.md"],
];

describe("phonology inventory table docs", () => {
  it("keeps generated language inventory docs in sync with the source-backed inventory", () => {
    for (const [languageId, filename] of DOCS) {
      const actual = readFileSync(
        path.join(process.cwd(), "docs", "operations", filename),
        "utf8",
      ).replace(/\r\n/g, "\n");
      const expected =
        formatLanguagePhonologyInventoryMarkdownDocument(languageId);

      expect(actual, filename).toBe(expected);
    }
  });
});
