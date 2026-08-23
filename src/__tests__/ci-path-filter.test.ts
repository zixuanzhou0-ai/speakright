import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("GitHub Actions path filtering", () => {
  it("skips the full Windows desktop build for docs-only changes", () => {
    const workflow = readFileSync(
      join(projectRoot, ".github/workflows/build-windows.yml"),
      "utf8",
    );

    expect(workflow).toContain("paths-ignore:");
    expect(workflow).toContain('"*.md"');
    expect(workflow).toContain('"docs/**"');
    expect(workflow).toContain("npm run validate:desktop-ci");
    expect(workflow).toContain("NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: \"0\"");
    expect(workflow).not.toContain("    tags:");
  });

  it("runs a lightweight docs check for README and docs changes", () => {
    const workflow = readFileSync(
      join(projectRoot, ".github/workflows/docs.yml"),
      "utf8",
    );

    expect(workflow).toContain("name: Docs Check");
    expect(workflow).toContain("paths:");
    expect(workflow).toContain('"*.md"');
    expect(workflow).toContain('"docs/**"');
    expect(workflow).toContain("npm run docs:check-links");
    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("skipped the full Tauri desktop build");
  });
});
