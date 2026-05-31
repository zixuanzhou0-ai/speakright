import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("desktop public release gate", () => {
  it("wires release validation to the signed-artifact gate while keeping internal validation separate", () => {
    const packageJson = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["desktop:release-gate"]).toContain(
      "desktop-release-gate.mjs",
    );
    expect(packageJson.scripts["validate:desktop"]).not.toContain(
      "desktop:release-gate",
    );
    expect(packageJson.scripts["validate:internal-release"]).toContain(
      "validate:desktop",
    );
    expect(packageJson.scripts["validate:internal-release"]).not.toContain(
      "desktop:release-gate",
    );
    expect(packageJson.scripts["validate:release"]).toContain(
      "validate:desktop",
    );
    expect(packageJson.scripts["validate:release"]).toContain(
      "desktop:release-gate",
    );
    expect(packageJson.scripts["validate:public-release"]).toBe(
      "npm run validate:release",
    );
  });

  it("fails public release when any desktop artifact is unsigned", () => {
    const gateScript = readFileSync(
      join(projectRoot, "scripts/desktop-release-gate.mjs"),
      "utf8",
    );

    expect(gateScript).toContain("unsignedArtifacts");
    expect(gateScript).toContain("allValid");
    expect(gateScript).toContain("controlled internal testing only");
  });
});
