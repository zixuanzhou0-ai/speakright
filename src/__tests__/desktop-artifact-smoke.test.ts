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
    expect(smokeScript).toContain("dragDropEnabled");
    expect(smokeScript).toContain("drill.html");
    expect(smokeScript).toContain("settings.html");
    expect(smokeScript).toContain("assessment.html");
    expect(smokeScript).toContain("_next");
    expect(smokeScript).toContain("sheep.mp3");
    expect(smokeScript).toContain("sheep.png");
    expect(smokeScript).toContain("findNewestGeneratedCapabilities");
    expect(smokeScript).toContain("generated Tauri capabilities.json");
    expect(smokeScript).toContain("devtools");
    expect(smokeScript).toContain("assertStaticExportPolicy");
    expect(smokeScript).toContain("fonts.googleapis.com");
    expect(smokeScript).toContain("fonts.gstatic.com");
    expect(smokeScript).toContain("http://dict.youdao.com");
    expect(smokeScript).toContain("/api/azure");
    expect(smokeScript).toContain("/api/elevenlabs");
    expect(smokeScript).toContain("/api/llm");
    expect(smokeScript).toContain("/api/pronunciation");
    expect(smokeScript).toContain("/api/merriam-webster");
    expect(smokeScript).toContain("core:default");
    expect(smokeScript).toContain("store:default");
    expect(smokeScript).toContain("http://");
    expect(smokeScript).toContain("https://**");
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

  it("checks the release executable writes runtime diagnostics during smoke", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/desktop-smoke.mjs"),
      "utf8",
    );

    expect(smokeScript).toContain("captureRuntimeLogEvidence");
    expect(smokeScript).toContain("Page.captureScreenshot");
    expect(smokeScript).toContain("speakright-webview.png");
    expect(smokeScript).toContain("createSmokeProfileRoot");
    expect(smokeScript).toContain("WEBVIEW2_USER_DATA_FOLDER");
    expect(smokeScript).toContain("tauriGlobalExposed");
    expect(smokeScript).toContain("tauriInvokeAvailable");
    expect(smokeScript).toContain("locationProtocol");
    expect(smokeScript).toContain("locationHostname");
    expect(smokeScript).toContain("releaseServedFromDevServer");
    expect(smokeScript).toContain("桌面端准备状态");
    expect(smokeScript).toContain("检测麦克风");
    expect(smokeScript).toContain("建立诊断");
    expect(smokeScript).toContain("导出学习数据");
    expect(smokeScript).toContain("speakright-data-");
    expect(smokeScript).toContain("desktop-smoke-secret");
    expect(smokeScript).toContain("exportedApiKey");
    expect(smokeScript).toContain("desktop-smoke-preserve-key");
    expect(smokeScript).toContain("learningDeletePreservedKey");
    expect(smokeScript).toContain("desktop-smoke-azure-key");
    expect(smokeScript).toContain("apiKeysDeleted");
    expect(smokeScript).toContain("desktop-smoke-reset-preserve-key");
    expect(smokeScript).toContain("localResetPreservedKey");
    expect(smokeScript).toContain("desktop-smoke-benchmark-audio");
    expect(smokeScript).toContain("benchmarkAudioCleared");
    expect(smokeScript).toContain("internal");
    expect(smokeScript).toContain("NotSigned");
    expect(smokeScript).toContain("可控内测");
    expect(smokeScript).toContain("<local-app-data>/");
    expect(smokeScript).toContain("local user profile path");
    expect(smokeScript).toContain("com.speakright.desktop");
    expect(smokeScript).toContain("speakright.log");
    expect(smokeScript).toContain("SpeakRight desktop runtime initialized");
  });

  it("keeps Windows desktop CI bounded by explicit timeouts", () => {
    const workflow = readFileSync(
      join(projectRoot, ".github/workflows/build-windows.yml"),
      "utf8",
    );

    expect(workflow).toContain("concurrency:");
    expect(workflow).toMatch(
      /group:\s+\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.ref\s*\}\}/,
    );
    expect(workflow).toMatch(
      /cancel-in-progress:\s+\$\{\{\s*!startsWith\(github\.ref,\s*'refs\/tags\/v'\)\s*\}\}/,
    );
    expect(workflow).toContain("timeout-minutes: 45");
    expect(workflow).toContain("timeout-minutes: 30");
    expect(workflow).toContain("Validate desktop build");
    expect(workflow).toContain("npm run validate:desktop-ci");
  });
});
