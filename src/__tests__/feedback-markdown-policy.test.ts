import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return sourceFiles(fullPath);
    if (![".ts", ".tsx"].includes(extname(fullPath))) return [];
    return [fullPath];
  });
}

describe("feedback markdown policy", () => {
  it("routes every ReactMarkdown renderer through desktop-safe components", () => {
    const markdownRenderers = sourceFiles(sourceRoot).filter((file) => {
      if (file.includes(`${join("src", "__tests__")}`)) return false;
      return readFileSync(file, "utf8").includes("<ReactMarkdown");
    });

    expect(markdownRenderers.length).toBeGreaterThan(0);

    for (const file of markdownRenderers) {
      const source = readFileSync(file, "utf8");
      const rendererCount = source.match(/<ReactMarkdown\b/g)?.length ?? 0;
      const safeComponentsCount =
        source.match(/components=\{\s*feedbackMarkdownComponents\s*\}/g)
          ?.length ?? 0;

      expect(
        safeComponentsCount,
        `${relative(projectRoot, file)} must pass feedbackMarkdownComponents to every ReactMarkdown renderer`,
      ).toBe(rendererCount);
    }
  });
});
