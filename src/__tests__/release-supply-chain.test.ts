import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(read(relativePath)) as T;
}

describe("v1.1.0 release and supply-chain contracts", () => {
  it("keeps one truthful release identity for both editions", () => {
    const config = readJson<{
      version: string;
      repositoryUrl: string;
      editions: {
        browser: {
          channel: string;
          releaseTag: string;
          signatureStatus: string;
        };
        desktop: {
          channel: string;
          releaseTag: string;
          signatureStatus: string;
        };
      };
    }>("release.config.json");
    const rootPackage = readJson<{ version: string }>("package.json");
    const rootPackageLock = readJson<{
      version: string;
      packages: Record<string, { version?: string }>;
    }>("package-lock.json");
    const browserPackage = readJson<{ version: string }>(
      "apps/browser/package.json",
    );
    const browserPackageLock = readJson<{
      version: string;
      packages: Record<string, { version?: string }>;
    }>("apps/browser/package-lock.json");

    expect(config).toEqual(
      expect.objectContaining({
        version: "1.1.0",
        repositoryUrl: "https://github.com/zixuanzhou0-ai/speakright",
      }),
    );
    expect(rootPackage.version).toBe(config.version);
    expect(rootPackageLock.version).toBe(config.version);
    expect(rootPackageLock.packages[""]?.version).toBe(config.version);
    expect(browserPackage.version).toBe(config.version);
    expect(browserPackageLock.version).toBe(config.version);
    expect(browserPackageLock.packages[""]?.version).toBe(config.version);
    expect(config.editions.browser).toEqual(
      expect.objectContaining({
        channel: "stable",
        releaseTag: "v1.1.0",
        signatureStatus: "NotApplicable",
      }),
    );
    expect(config.editions.desktop).toEqual(
      expect.objectContaining({
        channel: "preview",
        releaseTag: "v1.1.0-desktop-preview.1",
        signatureStatus: "NotSigned",
      }),
    );

    for (const generatedPath of [
      "src/lib/release-info.ts",
      "apps/browser/src/lib/release-info.ts",
    ]) {
      const generated = read(generatedPath);
      expect(generated).toContain(
        "generated from release.config.json by scripts/release-config.mjs",
      );
      expect(generated).toContain(config.repositoryUrl);
      expect(generated).toMatch(/RELEASE_VERSION = "1\.1\.0"/);
    }
  });

  it("uses the patched Next line and keeps development-only tooling out of production dependencies", () => {
    type PackageShape = {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    for (const relativePath of ["package.json", "apps/browser/package.json"]) {
      const manifest = readJson<PackageShape>(relativePath);
      expect(manifest.dependencies.next).toBe("16.3.1");
      expect(manifest.dependencies).not.toHaveProperty("shadcn");
      expect(manifest.devDependencies.shadcn).toBeTruthy();
    }
  });

  it("pins every GitHub Action to a full commit SHA", () => {
    const workflowDir = join(root, ".github", "workflows");
    const workflowPaths = readdirSync(workflowDir)
      .filter((name) => /\.ya?ml$/.test(name))
      .map((name) => join(workflowDir, name));

    for (const workflowPath of workflowPaths) {
      const workflow = readFileSync(workflowPath, "utf8");
      for (const line of workflow.split(/\r?\n/)) {
        const action = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/)?.[1];
        if (!action || action.startsWith("./")) continue;
        expect(action, `${workflowPath}: ${line.trim()}`).toMatch(
          /^[^@\s]+@[0-9a-f]{40}$/,
        );
      }
    }
  });

  it("keeps executable security and dependency update coverage", () => {
    for (const path of [
      ".github/workflows/security.yml",
      ".github/workflows/codeql.yml",
      ".github/workflows/dependency-review.yml",
      ".github/dependabot.yml",
    ]) {
      expect(existsSync(join(root, path)), path).toBe(true);
    }

    const security = read(".github/workflows/security.yml");
    expect(security).toContain("npm run security:audit:npm");
    expect(security).toContain("cargo audit --file src-tauri/Cargo.lock");
    expect(security).toContain("fetch-depth: 0");
    expect(security).toContain("gitleaks/gitleaks-action@");

    const codeql = read(".github/workflows/codeql.yml");
    expect(codeql).toContain("security-events: write");
    expect(codeql).toContain("languages: javascript-typescript");
    expect(codeql).toContain("queries: security-extended");

    const dependencyReview = read(".github/workflows/dependency-review.yml");
    expect(dependencyReview).toContain("fail-on-severity: high");
    expect(dependencyReview).toContain("permissions:\n  contents: read");

    const dependabot = read(".github/dependabot.yml");
    expect(dependabot.match(/package-ecosystem: npm/g)).toHaveLength(2);
    expect(dependabot).toContain("package-ecosystem: cargo");
    expect(dependabot).toContain("package-ecosystem: github-actions");
  });

  it("isolates test fixtures from both publishable release artifacts", () => {
    const browserRelease = read(".github/workflows/release-browser.yml");
    const desktopRelease = read(
      ".github/workflows/release-desktop-preview.yml",
    );
    const fixtureBuilder = read("scripts/build-with-test-fixtures.mjs");
    const productionGuard = read("scripts/run-production-fixture-guard.mjs");
    const productionBuilder = read("scripts/build-browser-production.mjs");

    expect(fixtureBuilder).toContain(
      'NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "1"',
    );
    expect(fixtureBuilder).toContain("This artifact must never be published");
    expect(browserRelease).toContain(
      "Rebuild publishable Browser Edition without test fixtures",
    );
    expect(browserRelease).toContain(
      "Prove smoke query fixtures are unavailable",
    );
    expect(browserRelease).toContain(
      'NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "0"',
    );
    expect(productionGuard).toContain(
      "Production fixture guard refuses to run",
    );
    expect(productionBuilder).toContain(
      'NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "0"',
    );
    expect(browserRelease).toContain("npm run build:browser:production");
    expect(desktopRelease).toContain(
      'NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "0"',
    );
    expect(desktopRelease).toContain("desktop:preview-release-gate");
    expect(desktopRelease).toContain("--prerelease");
    expect(desktopRelease.indexOf("npm run validate:desktop")).toBeLessThan(
      desktopRelease.indexOf("npm run desktop:preview-release-gate"),
    );

    const desktopSmoke = read("scripts/desktop-smoke.mjs");
    expect(desktopSmoke).toContain("smokeScoreSummary=1");
    expect(desktopSmoke).toContain("smokeAssessmentTiles=1");
    expect(desktopSmoke).toContain("smokeGuidedRepeatSingleWord=1");
    expect(desktopSmoke).toContain("guidedRepeatState.totalWords <= 1");
    expect(desktopSmoke).toContain("fixtureQueriesUnavailable=");
  });

  it("keeps validate-only dispatches free of downloadable release binaries", () => {
    const browserRelease = read(".github/workflows/release-browser.yml");
    const desktopRelease = read(
      ".github/workflows/release-desktop-preview.yml",
    );

    for (const workflow of [browserRelease, desktopRelease]) {
      expect(workflow).toContain("npm run docs:check-links");
      expect(workflow).toContain("npm run release:evidence:check");
    }

    expect(browserRelease).toMatch(
      /Upload verified Browser release assets\n\s+if: github\.event_name == 'push'/,
    );
    expect(desktopRelease).toMatch(
      /Upload verified Desktop Preview assets\n\s+if: github\.event_name == 'push'/,
    );

    expect(browserRelease).toContain(
      "Run static Browser smoke against the publishable build",
    );
    expect(browserRelease).toContain("npm run browser:smoke:static");
    expect(browserRelease).toContain("Upload Browser validation reports");
    expect(browserRelease).toContain("speakright-browser-validation-reports");
    const browserValidationOnlyUpload = browserRelease.slice(
      browserRelease.indexOf("Upload Browser validation reports"),
      browserRelease.indexOf("\n\n  publish:"),
    );
    expect(browserValidationOnlyUpload).not.toContain(".zip");

    expect(desktopRelease).toContain(
      "Upload Desktop Preview validation reports",
    );
    expect(desktopRelease).toContain(
      "speakright-desktop-preview-validation-reports",
    );
    const validationOnlyUpload = desktopRelease.slice(
      desktopRelease.indexOf("Upload Desktop Preview validation reports"),
      desktopRelease.indexOf("\n\n  publish:"),
    );
    expect(validationOnlyUpload).not.toContain("speakright.exe");
    expect(validationOnlyUpload).not.toContain("_x64-setup.exe");
  });

  it("binds both release workflows to an exact tag on origin/main", () => {
    for (const workflowPath of [
      ".github/workflows/release-browser.yml",
      ".github/workflows/release-desktop-preview.yml",
    ]) {
      const workflow = read(workflowPath);
      expect(workflow).toContain("fetch-depth: 0");
      expect(workflow).toContain(
        "ref: $" +
          "{{ github.event_name == 'workflow_dispatch' && inputs.tag || github.ref }}",
      );
      expect(workflow).toContain(
        "$config.editions.PSObject.Properties[$env:RELEASE_EDITION].Value.releaseTag",
      );
      expect(workflow).toContain(
        'git rev-parse --verify "$' + '{tagRef}^{commit}"',
      );
      expect(workflow).toContain("if ($headSha -cne $tagSha)");
      expect(workflow).toContain(
        "git merge-base --is-ancestor $headSha refs/remotes/origin/main",
      );
      expect(workflow).toContain(
        '"NEXT_PUBLIC_SPEAKRIGHT_COMMIT_SHA=$headSha" >> $env:GITHUB_ENV',
      );
      expect(workflow).toContain("npm run check:core-parity");
      expect(workflow).not.toMatch(
        /run:\s*[^\n]*\$\{\{[^\n]*(?:tag|release_tag)/i,
      );

      const publishJob = workflow.slice(workflow.indexOf("\n  publish:"));
      expect(workflow).toContain(
        "commit_sha: $" + "{{ steps.release.outputs.commit_sha }}",
      );
      expect(publishJob).toContain(
        "BUILT_COMMIT_SHA: $" + "{{ needs.build.outputs.commit_sha }}",
      );
      expect(publishJob).toContain(
        'git fetch --force --no-tags origin "+refs/tags/$env:RELEASE_TAG:refs/tags/$env:RELEASE_TAG"',
      );
      expect(publishJob).toContain(
        'git rev-parse --verify "$' + '{tagRef}^{commit}"',
      );
      expect(publishJob).toContain("if ($tagSha -cne $env:BUILT_COMMIT_SHA)");
      expect(publishJob).toContain("Release tag moved after validation");
      expect(publishJob).toContain(
        "git merge-base --is-ancestor $tagSha refs/remotes/origin/main",
      );
    }

    const browserRelease = read(".github/workflows/release-browser.yml");
    expect(browserRelease).toContain("cargo audit --file src-tauri/Cargo.lock");
    expect(browserRelease).toContain(
      "Get-ChildItem -LiteralPath $stage -File | Sort-Object Name",
    );
    expect(
      browserRelease.indexOf("Copy-Item -Path outputs/release/sbom/*.json"),
    ).toBeLessThan(
      browserRelease.indexOf("Get-ChildItem -LiteralPath $stage -File"),
    );
  });

  it("does not claim byte-for-byte reproducibility without a reproducible-build proof", () => {
    const generator = read("scripts/release-config.mjs");
    const browserReleaseInfo = read("apps/browser/src/lib/release-info.ts");
    expect(generator).toContain("从标识 commit 构建的静态包");
    expect(generator).not.toContain("可复现静态导出");
    expect(browserReleaseInfo).not.toContain("可复现静态导出");
  });
});
