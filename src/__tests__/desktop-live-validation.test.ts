import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const script = readFileSync(
  join(projectRoot, "scripts", "desktop-live-validation.mjs"),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(join(projectRoot, "package.json"), "utf8"),
) as { scripts: Record<string, string> };

describe("desktop live validation", () => {
  it("is wired as a separate release validation command", () => {
    expect(packageJson.scripts["desktop:live-validation"]).toContain(
      "desktop-live-validation.mjs",
    );
    expect(packageJson.scripts["desktop:live-validation"]).toContain(
      "--azure-mode=high",
    );
    expect(packageJson.scripts["desktop:live-validation:full"]).toContain(
      "--azure-mode=full",
    );
  });

  it("does not batch-generate ElevenLabs audio during validation", () => {
    expect(script).not.toContain("generate-word-audio");
    expect(script).not.toContain("generate-language-pack");
    expect(script).toContain(
      "if (elevenLabsTtsSmoke && maxElevenLabsTtsChars > 0)",
    );
    expect(script).toContain("SPEAKRIGHT_ALLOW_ELEVENLABS_TTS_SMOKE");
    expect(script).toContain("--no-elevenlabs");
    expect(script).toContain("TTS smoke disabled to save credits");
  });

  it("caps optional ElevenLabs TTS smoke and uses a low-cost model", () => {
    expect(script).toContain("Math.min(");
    expect(script).toContain("1000");
    expect(script).toContain("eleven_flash_v2_5");
    expect(script).toContain("maxElevenLabsTtsChars");
  });

  it("redacts secrets from the generated report", () => {
    expect(script).toContain("sanitizeReport");
    expect(script).toContain("[REDACTED]");
    expect(script).toContain("subscriptionKey");
    expect(script).toContain("xi-api-key");
  });

  it("can fall back to Windows Credential Manager without printing secrets", () => {
    expect(script).toContain("readWindowsCredentialStoreSnapshot");
    expect(script).toContain("CredRead");
    expect(script).toContain("windows-credential-manager");
    expect(script).not.toContain("console.log(snapshot");
  });

  it("writes reports under build artifacts rather than source docs", () => {
    expect(script).toContain(
      'path.join(root, "src-tauri", "target", "live-validation")',
    );
  });
});
