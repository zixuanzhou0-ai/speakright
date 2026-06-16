import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("phoneme word card layout", () => {
  it("keeps target words and IPA wrap-ready inside the animated card", () => {
    const source = readProjectFile("src/components/phoneme/word-card.tsx");

    expect(source).toContain("getPracticeTextDensity(displayWord)");
    expect(source).toContain("getCenteredReadableTextClassName(textDensity)");
    expect(source).toContain("getCenteredMonoTextClassName(textDensity)");
    expect(source).not.toContain("text-3xl font-bold");
    expect(source).not.toContain("font-mono text-base");
    expect(source).not.toContain("truncate");
    expect(source).not.toContain("line-clamp");
    expect(source).not.toContain("whitespace-nowrap");
  });
});
