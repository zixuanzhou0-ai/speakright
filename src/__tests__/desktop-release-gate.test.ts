import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyReportedArtifacts } from "../../scripts/lib/desktop-preview-release-gate-core.mjs";

const projectRoot = process.cwd();
const temporaryRoots: string[] = [];

function digest(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function createArtifactFixture() {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "speakright-preview-gate-"));
  temporaryRoots.push(workspaceRoot);
  const definitions = [
    {
      type: "exe",
      path: join(
        workspaceRoot,
        "src-tauri",
        "target",
        "release",
        "speakright.exe",
      ),
      contents: "desktop-exe",
    },
    {
      type: "nsis",
      path: join(
        workspaceRoot,
        "src-tauri",
        "target",
        "release",
        "bundle",
        "nsis",
        "SpeakRight_1.1.0_x64-setup.exe",
      ),
      contents: "desktop-nsis",
    },
  ] as const;

  const artifacts = definitions.map((definition) => {
    mkdirSync(resolve(definition.path, ".."), { recursive: true });
    writeFileSync(definition.path, definition.contents);
    return {
      type: definition.type,
      path: relative(workspaceRoot, definition.path).replaceAll("\\", "/"),
      bytes: Buffer.byteLength(definition.contents),
      sha256: digest(definition.contents),
    };
  });
  return { workspaceRoot, artifacts };
}

afterEach(() => {
  for (const temporaryRoot of temporaryRoots.splice(0)) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

describe("desktop release channels", () => {
  it("keeps signed stable and unsigned preview validation separate", () => {
    const packageJson = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["desktop:release-gate"]).toContain(
      "desktop-release-gate.mjs",
    );
    expect(packageJson.scripts["desktop:preview-release-gate"]).toContain(
      "desktop-preview-release-gate.mjs",
    );
    expect(packageJson.scripts["validate:desktop-preview"]).toContain(
      "desktop:preview-release-gate",
    );
    expect(packageJson.scripts["validate:signed-desktop-release"]).toContain(
      "desktop:release-gate",
    );
    expect(packageJson.scripts["validate:internal-release"]).not.toContain(
      "desktop:release-gate",
    );
  });

  it("retains a strict gate for any future signed desktop stable release", () => {
    const gateScript = readFileSync(
      join(projectRoot, "scripts/desktop-release-gate.mjs"),
      "utf8",
    );

    expect(gateScript).toContain("unsignedArtifacts");
    expect(gateScript).toContain("allValid");
    expect(gateScript).toContain("controlled internal testing only");
  });

  it("requires hashes and an actually unsigned state for Desktop Preview", () => {
    const gateScript = readFileSync(
      join(projectRoot, "scripts/desktop-preview-release-gate.mjs"),
      "utf8",
    );
    const validationWorkflow = readFileSync(
      join(projectRoot, ".github/workflows/build-windows.yml"),
      "utf8",
    );
    const releaseWorkflow = readFileSync(
      join(projectRoot, ".github/workflows/release-desktop-preview.yml"),
      "utf8",
    );

    expect(gateScript).toContain("SHA-256");
    expect(gateScript).toContain("verifyReportedArtifacts");
    expect(gateScript).toContain('artifact.signature?.Status !== "NotSigned"');
    expect(gateScript).toContain("report.signing.allValid !== false");
    expect(validationWorkflow).toContain("Upload desktop validation reports");
    expect(validationWorkflow).toContain(
      "speakright-windows-validation-reports",
    );
    expect(validationWorkflow).toContain("*_installer-roundtrip.json");
    expect(validationWorkflow).not.toContain("target/release/speakright.exe");
    expect(validationWorkflow).not.toContain("bundle/nsis/*.exe");
    expect(validationWorkflow).not.toContain("bundle/msi/*.msi");
    expect(validationWorkflow).not.toContain("    tags:");
    expect(releaseWorkflow).toContain('tags:\n      - "v*-desktop-preview.*"');
    expect(releaseWorkflow).toContain("npm run desktop:preview-release-gate");
    const sbomGeneration = releaseWorkflow.indexOf(
      "npm run security:sbom:cargo",
    );
    const finalPreviewGate = releaseWorkflow.lastIndexOf(
      "npm run desktop:preview-release-gate",
    );
    const stagingCopy = releaseWorkflow.indexOf(
      "Copy-Item -LiteralPath $releaseExecutable -Destination $stage",
    );
    const stagedIdentityCheck = releaseWorkflow.indexOf(
      "Staged $artifactType artifact does not match the final release report.",
    );
    const checksumGeneration = releaseWorkflow.indexOf(
      "$checksumLines = Get-ChildItem -LiteralPath $stage -File | Sort-Object Name",
    );
    expect(sbomGeneration).toBeGreaterThan(-1);
    expect(finalPreviewGate).toBeGreaterThan(sbomGeneration);
    expect(stagingCopy).toBeGreaterThan(finalPreviewGate);
    expect(stagedIdentityCheck).toBeGreaterThan(stagingCopy);
    expect(checksumGeneration).toBeGreaterThan(stagedIdentityCheck);
    expect(releaseWorkflow).toContain(
      "Staged $artifactType artifact does not match the final release report.",
    );
    expect(releaseWorkflow).toContain(
      "Staged installer round-trip evidence does not match the final release report.",
    );
    expect(releaseWorkflow).toContain("--prerelease");
    expect(releaseWorkflow).toContain("Unknown publisher");
    expect(releaseWorkflow).toContain(
      "bundle/nsis/SpeakRight_$($env:RELEASE_VERSION)_x64-setup.exe",
    );
    expect(releaseWorkflow).not.toContain("bundle/nsis/*.exe");
    expect(releaseWorkflow).not.toContain("bundle/msi/*.msi");
    expect(releaseWorkflow).toContain("MSI is not published in v1.1.0");

    const releaseReport = readFileSync(
      join(projectRoot, "scripts/desktop-release-report.mjs"),
      "utf8",
    );
    expect(releaseReport).not.toContain('type: "msi"');
    expect(releaseReport).toContain('publishedArtifactTypes: ["exe", "nsis"]');
    expect(releaseReport).toContain('excludedArtifactTypes: ["msi"]');
  });
});

describe("desktop preview artifact integrity", () => {
  it("accepts exactly the published bare EXE and NSIS artifacts", async () => {
    const fixture = createArtifactFixture();

    await expect(verifyReportedArtifacts(fixture)).resolves.toEqual([
      expect.objectContaining({ type: "exe" }),
      expect.objectContaining({ type: "nsis" }),
    ]);
  });

  it("rejects an MSI because v1.1.0 does not publish it", async () => {
    const fixture = createArtifactFixture();
    const msiPath = join(
      fixture.workspaceRoot,
      "src-tauri",
      "target",
      "release",
      "bundle",
      "msi",
      "SpeakRight_1.1.0_x64_en-US.msi",
    );
    const contents = "desktop-msi";
    mkdirSync(resolve(msiPath, ".."), { recursive: true });
    writeFileSync(msiPath, contents);

    await expect(
      verifyReportedArtifacts({
        workspaceRoot: fixture.workspaceRoot,
        artifacts: [
          ...fixture.artifacts,
          {
            type: "msi",
            path: relative(fixture.workspaceRoot, msiPath).replaceAll(
              "\\",
              "/",
            ),
            bytes: Buffer.byteLength(contents),
            sha256: digest(contents),
          },
        ],
      }),
    ).rejects.toThrow(/unexpected artifact type msi/);
  });

  it("rejects report byte-size and SHA-256 mismatches", async () => {
    const fixture = createArtifactFixture();
    const hashMismatch = fixture.artifacts.map((artifact, index) =>
      index === 0 ? { ...artifact, sha256: "0".repeat(64) } : artifact,
    );
    await expect(
      verifyReportedArtifacts({
        workspaceRoot: fixture.workspaceRoot,
        artifacts: hashMismatch,
      }),
    ).rejects.toThrow(/SHA-256 mismatch/);

    const bytesMismatch = fixture.artifacts.map((artifact, index) =>
      index === 0 ? { ...artifact, bytes: artifact.bytes + 1 } : artifact,
    );
    await expect(
      verifyReportedArtifacts({
        workspaceRoot: fixture.workspaceRoot,
        artifacts: bytesMismatch,
      }),
    ).rejects.toThrow(/byte-size mismatch/);
  });

  it("rejects traversal, external paths, and files outside release boundaries", async () => {
    const fixture = createArtifactFixture();
    const traversal = fixture.artifacts.map((artifact, index) =>
      index === 0 ? { ...artifact, path: "../outside.exe" } : artifact,
    );
    await expect(
      verifyReportedArtifacts({
        workspaceRoot: fixture.workspaceRoot,
        artifacts: traversal,
      }),
    ).rejects.toThrow(/escapes workspace/);

    const external = fixture.artifacts.map((artifact, index) =>
      index === 0
        ? { ...artifact, path: resolve(fixture.workspaceRoot, "..", "x.exe") }
        : artifact,
    );
    await expect(
      verifyReportedArtifacts({
        workspaceRoot: fixture.workspaceRoot,
        artifacts: external,
      }),
    ).rejects.toThrow(/escapes workspace/);

    const outsideReleasePath = join(fixture.workspaceRoot, "other.exe");
    writeFileSync(outsideReleasePath, "other-exe");
    const outsideRelease = fixture.artifacts.map((artifact, index) =>
      index === 0
        ? {
            ...artifact,
            path: relative(fixture.workspaceRoot, outsideReleasePath),
            bytes: Buffer.byteLength("other-exe"),
            sha256: digest("other-exe"),
          }
        : artifact,
    );
    await expect(
      verifyReportedArtifacts({
        workspaceRoot: fixture.workspaceRoot,
        artifacts: outsideRelease,
      }),
    ).rejects.toThrow(/immediate child/);
  });
});
