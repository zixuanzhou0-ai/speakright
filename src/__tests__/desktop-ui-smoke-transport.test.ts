import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("desktop UI smoke transport", () => {
  it("builds the fixture executable with the reviewed Tauri smoke config", () => {
    const builder = read("scripts/build-with-test-fixtures.mjs");

    expect(builder).toContain('"src-tauri/tauri.smoke.conf.json"');
    expect(builder).toContain('"--no-bundle"');
    expect(builder).toContain('"--speakright-ui-smoke-artifact"');
    expect(builder).toContain('NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "1"');
  });

  it("keeps CDP in the fixture-only config and runtime data in TEMP", () => {
    const config = JSON.parse(read("src-tauri/tauri.smoke.conf.json"));
    const mainWindow = config.app.windows.find(
      (windowConfig: { label?: string }) => windowConfig.label === "main",
    );
    const smoke = read("scripts/desktop-ui-smoke.mjs");
    const productionSmoke = read("scripts/desktop-smoke.mjs");
    const productionSmokeBuilder = read(
      "scripts/build-desktop-production-smoke.mjs",
    );
    const productionConfig = read("src-tauri/tauri.conf.json");

    expect(mainWindow.additionalBrowserArgs).toContain(
      "--remote-debugging-port=19337",
    );
    expect(mainWindow.additionalBrowserArgs).toContain(
      "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection",
    );
    expect(mainWindow).not.toHaveProperty("dataDirectory");
    expect(productionConfig).not.toContain("remote-debugging-port");
    expect(smoke).toContain("readConfiguredDebuggingPort");
    expect(smoke).toContain("desktopSmokeConfiguredDebuggingPort");
    expect(smoke).toContain("WEBVIEW2_USER_DATA_FOLDER");
    expect(smoke).toContain(
      "delete isolatedEnvironment.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    );
    expect(productionSmokeBuilder).toContain(
      'NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "0"',
    );
    expect(productionSmokeBuilder).toContain(
      '"src-tauri/tauri.smoke.conf.json"',
    );
    expect(productionSmokeBuilder).toContain('"--no-bundle"');
    expect(productionSmokeBuilder).toContain(
      '"--speakright-production-smoke-artifact"',
    );
    expect(productionSmoke).toContain("readConfiguredDebuggingPort");
    expect(productionSmoke).toContain(
      "delete isolatedEnvironment.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    );
  });

  it("rebuilds the publishable executable after interactive validation", () => {
    const scripts = JSON.parse(read("package.json")).scripts;
    const validation = scripts["validate:desktop"]
      .split("&&")
      .map((step: string) => step.trim().replace(/^npm run\s+/u, ""));

    expect(validation.indexOf("desktop:build:production-smoke")).toBeLessThan(
      validation.indexOf("desktop:smoke"),
    );
    expect(validation.indexOf("desktop:smoke")).toBeLessThan(
      validation.indexOf("desktop:build"),
    );
    expect(validation.indexOf("desktop:build")).toBeLessThan(
      validation.indexOf("desktop:artifact-smoke"),
    );
    expect(validation.indexOf("desktop:artifact-smoke")).toBeLessThan(
      validation.indexOf("desktop:installer-roundtrip"),
    );
  });

  it("forces the default desktop build to be fixture-off and publishable", () => {
    const builder = read("scripts/desktop-build.mjs");

    expect(builder).toContain('artifactMode === "ui-smoke" ? "1" : "0"');
    expect(builder).toContain('artifactMode === "publishable" ? "0" : "1"');
    expect(builder).toContain(
      "argument !== uiSmokeFlag && argument !== productionSmokeFlag",
    );
    expect(builder).toContain('artifactMode !== "publishable" &&');
    expect(builder).toContain('!argumentsForTauri.includes("--no-bundle")');
    expect(builder).toContain('endsWith("/tauri.smoke.conf.json")');
  });
});
