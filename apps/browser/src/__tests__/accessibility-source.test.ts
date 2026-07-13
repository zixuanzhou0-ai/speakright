import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? collectSourceFiles(path)
      : /\.(ts|tsx)$/.test(name)
        ? [path]
        : [];
  });
}

describe("browser accessibility source contracts", () => {
  it("does not ship literal unicode escape sequences as accessible names", () => {
    const violations = collectSourceFiles(join(process.cwd(), "src")).filter(
      (file) =>
        /aria-(?:label|description)=["'][^"']*\\u[0-9a-f]{4}/i.test(
          readFileSync(file, "utf8"),
        ),
    );

    expect(violations).toEqual([]);
  });

  it("gives icon-only training back links an accessible name", () => {
    const files = [
      "src/app/drill/word/page.tsx",
      "src/app/drill/sentence/page.tsx",
      "src/app/drill/contrast/page.tsx",
      "src/app/drill/perception/page.tsx",
      "src/app/drill/prosody/page.tsx",
      "src/app/drill/scenarios/page.tsx",
      "src/app/drill/spontaneous/page.tsx",
      "src/app/drill/evidence/page.tsx",
      "src/app/drill/pack/[packId]/pack-runner-client.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toContain('aria-label="返回训练首页"');
    }
  });
});
