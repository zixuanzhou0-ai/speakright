import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BROWSER_PRODUCTION_OUTPUT_SNAPSHOT_RELATIVE_PATH,
  createBrowserProductionOutputSnapshot,
  verifyBrowserProductionOutputSnapshot,
} from "../../scripts/browser-production-output-snapshot.mjs";

const projectRoot = process.cwd();
const commitSha = "a".repeat(40);
const temporaryRoots: string[] = [];

async function fixture() {
  const workspaceRoot = await mkdtemp(
    path.join(os.tmpdir(), "speakright-browser-output-snapshot-"),
  );
  temporaryRoots.push(workspaceRoot);
  const outputRoot = path.join(workspaceRoot, "apps", "browser", "out");
  await mkdir(path.join(outputRoot, "_next"), { recursive: true });
  await writeFile(path.join(outputRoot, "index.html"), "<main>stable</main>");
  await writeFile(path.join(outputRoot, "_next", "app.js"), "alpha");
  return { outputRoot, workspaceRoot };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((temporaryRoot) =>
        rm(temporaryRoot, { force: true, recursive: true }),
      ),
  );
});

describe("browser production output snapshot", () => {
  it("binds the complete output tree and release commit", async () => {
    const { workspaceRoot } = await fixture();
    const snapshot = await createBrowserProductionOutputSnapshot({
      commitSha,
      createdAt: "2026-08-17T00:00:00.000Z",
      workspaceRoot,
    });

    await expect(
      verifyBrowserProductionOutputSnapshot({
        commitSha,
        expectedTreeSha256: snapshot.outputTree.sha256,
        workspaceRoot,
      }),
    ).resolves.toEqual(snapshot);

    const persisted = JSON.parse(
      await readFile(
        path.join(
          workspaceRoot,
          BROWSER_PRODUCTION_OUTPUT_SNAPSHOT_RELATIVE_PATH,
        ),
        "utf8",
      ),
    );
    expect(persisted).toEqual(snapshot);
    expect(JSON.stringify(snapshot)).not.toContain(workspaceRoot);
  });

  it("rejects output byte changes after the validated snapshot", async () => {
    const { outputRoot, workspaceRoot } = await fixture();
    const snapshot = await createBrowserProductionOutputSnapshot({
      commitSha,
      workspaceRoot,
    });
    await writeFile(path.join(outputRoot, "_next", "app.js"), "bravo");

    await expect(
      verifyBrowserProductionOutputSnapshot({
        commitSha,
        expectedTreeSha256: snapshot.outputTree.sha256,
        workspaceRoot,
      }),
    ).rejects.toThrow(/output tree changed/i);
  });

  it("rejects output path changes after the validated snapshot", async () => {
    const { outputRoot, workspaceRoot } = await fixture();
    const snapshot = await createBrowserProductionOutputSnapshot({
      commitSha,
      workspaceRoot,
    });
    await rename(
      path.join(outputRoot, "_next", "app.js"),
      path.join(outputRoot, "_next", "renamed.js"),
    );

    await expect(
      verifyBrowserProductionOutputSnapshot({
        commitSha,
        expectedTreeSha256: snapshot.outputTree.sha256,
        workspaceRoot,
      }),
    ).rejects.toThrow(/output tree changed/i);
  });

  it("anchors the snapshot digest outside the mutable snapshot file", async () => {
    const { outputRoot, workspaceRoot } = await fixture();
    const original = await createBrowserProductionOutputSnapshot({
      commitSha,
      workspaceRoot,
    });
    await writeFile(path.join(outputRoot, "_next", "app.js"), "bravo");
    await createBrowserProductionOutputSnapshot({
      commitSha,
      workspaceRoot,
    });

    await expect(
      verifyBrowserProductionOutputSnapshot({
        commitSha,
        expectedTreeSha256: original.outputTree.sha256,
        workspaceRoot,
      }),
    ).rejects.toThrow(/anchored output-tree digest/i);
  });

  it("rejects a snapshot bound to another release commit", async () => {
    const { workspaceRoot } = await fixture();
    const snapshot = await createBrowserProductionOutputSnapshot({
      commitSha,
      workspaceRoot,
    });

    await expect(
      verifyBrowserProductionOutputSnapshot({
        commitSha: "b".repeat(40),
        expectedTreeSha256: snapshot.outputTree.sha256,
        workspaceRoot,
      }),
    ).rejects.toThrow(/commit does not match/i);
  });

  it("revalidates after SBOM generation and immediately before packaging", () => {
    const workflow = readFileSync(
      path.join(projectRoot, ".github", "workflows", "release-browser.yml"),
      "utf8",
    );
    const initialGuard = workflow.indexOf(
      "Prove smoke query fixtures are unavailable",
    );
    const snapshot = workflow.indexOf(
      "Snapshot validated Browser production output",
    );
    const cargoSbom = workflow.indexOf("Generate Cargo CycloneDX SBOM");
    const postSbomSmoke = workflow.indexOf(
      "Re-run static Browser smoke after SBOM generation",
    );
    const postSbomGuard = workflow.indexOf(
      "Re-prove fixtures are unavailable after SBOM generation",
    );
    const verification = workflow.indexOf(
      "Verify Browser production output is unchanged",
    );
    const packaging = workflow.indexOf(
      "Package Browser Stable and validation evidence",
    );

    expect(initialGuard).toBeGreaterThan(-1);
    expect(snapshot).toBeGreaterThan(initialGuard);
    expect(cargoSbom).toBeGreaterThan(snapshot);
    expect(postSbomSmoke).toBeGreaterThan(cargoSbom);
    expect(postSbomGuard).toBeGreaterThan(postSbomSmoke);
    expect(verification).toBeGreaterThan(postSbomGuard);
    expect(packaging).toBeGreaterThan(verification);
    expect(workflow).toContain(
      "steps.browser_output_snapshot.outputs.tree_sha256",
    );
    const snapshotScript = readFileSync(
      path.join(
        projectRoot,
        "scripts",
        "browser-production-output-snapshot.mjs",
      ),
      "utf8",
    );
    expect(snapshotScript).toContain(
      "outputs/release/browser-production-output-snapshot.json",
    );
    expect(
      readFileSync(path.join(projectRoot, ".gitignore"), "utf8"),
    ).toContain("/outputs/");
  });
});
