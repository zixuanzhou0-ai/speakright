import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("desktop artifact smoke wiring", () => {
  it("runs artifact smoke after desktop build and before launching the release exe", () => {
    const packageJson = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["desktop:artifact-smoke"]).toContain(
      "desktop-artifact-smoke.mjs",
    );
    const desktopValidation = packageJson.scripts["validate:desktop"];
    expect(desktopValidation).toContain("desktop:build");
    expect(desktopValidation).toContain("desktop:artifact-smoke");
    expect(desktopValidation.indexOf("desktop:build")).toBeLessThan(
      desktopValidation.indexOf("desktop:artifact-smoke"),
    );
    expect(desktopValidation.indexOf("desktop:artifact-smoke")).toBeLessThan(
      desktopValidation.indexOf("desktop:smoke"),
    );
    expect(desktopValidation).toContain("desktop:release-report");
    expect(desktopValidation).toContain("desktop:installer-smoke");
    expect(desktopValidation.indexOf("desktop:release-report")).toBeLessThan(
      desktopValidation.indexOf("desktop:installer-smoke"),
    );
    const desktopCiValidation = packageJson.scripts["validate:desktop-ci"];
    expect(desktopCiValidation).toContain("desktop:installer-smoke");
  });

  it("checks the desktop static export and core local assets", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/desktop-artifact-smoke.mjs"),
      "utf8",
    );

    expect(smokeScript).toContain("frontendDist");
    expect(smokeScript).toContain("drill.html");
    expect(smokeScript).toContain("settings.html");
    expect(smokeScript).toContain("assessment.html");
    expect(smokeScript).toContain("_next");
    expect(smokeScript).toContain("sheep.mp3");
    expect(smokeScript).toContain("sheep.png");
  });

  it("checks Windows installer metadata before artifacts are trusted", () => {
    const installerSmokeScript = readFileSync(
      join(projectRoot, "scripts/desktop-installer-smoke.mjs"),
      "utf8",
    );

    expect(installerSmokeScript).toContain("ProductName");
    expect(installerSmokeScript).toContain("ProductVersion");
    expect(installerSmokeScript).toContain("Manufacturer");
    expect(installerSmokeScript).toContain("ProductCode");
    expect(installerSmokeScript).toContain("UpgradeCode");
    expect(installerSmokeScript).toContain("SHA-256");
  });
});
