import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function read(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

describe("open-source readiness files", () => {
  it("keeps the core public repository governance files present", () => {
    for (const path of [
      "LICENSE",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "THIRD_PARTY_NOTICES.md",
      ".env.example",
      ".github/ISSUE_TEMPLATE/bug_report.md",
      ".github/ISSUE_TEMPLATE/ipa_audit.md",
      ".github/ISSUE_TEMPLATE/feature_request.md",
      ".github/pull_request_template.md",
    ]) {
      expect(existsSync(join(projectRoot, path)), path).toBe(true);
    }
  });

  it("keeps the asset license boundary explicit", () => {
    const license = read("LICENSE");
    const notices = read("THIRD_PARTY_NOTICES.md");

    expect(license).toContain("Bundled audio, video, image, voice");
    expect(notices).toMatch(
      /does not\s+automatically relicense bundled third-party media/,
    );
    expect(notices).toContain("Do not add new ElevenLabs-generated audio");
  });

  it("keeps contribution rules aligned with release constraints", () => {
    const contributing = read("CONTRIBUTING.md");
    const security = read("SECURITY.md");

    expect(contributing).toContain("Release EXE");
    expect(contributing).toContain("Do not generate ElevenLabs audio");
    expect(contributing).toContain("Spanish, French, and Russian are experimental");
    expect(security).toContain("Windows artifacts are currently unsigned");
  });

  it("keeps current handoff docs from claiming stale local dirty state", () => {
    const docs = [
      read("docs/INSTALLATION.md"),
      read("docs/operations/DESKTOP_STARTUP_RUNBOOK.md"),
      read("docs/operations/NEXT_CHAT_HANDOFF.md"),
      read("docs/operations/RC_EVIDENCE_AUDIT.md"),
    ].join("\n");

    expect(docs).not.toContain("known uncommitted work");
    expect(docs).not.toContain("ahead of `origin/main` by local commits");
    expect(docs).not.toContain("main...origin/main [ahead 5]");
    expect(docs).not.toContain("documented uncommitted release-tightening");
  });

  it("keeps validation result counts centralized in the RC evidence audit", () => {
    const readme = read("README.md");
    const installation = read("docs/INSTALLATION.md");
    const handoffDocs = [
      readme,
      installation,
      read("docs/operations/DESKTOP_STARTUP_RUNBOOK.md"),
      read("docs/operations/NEXT_CHAT_HANDOFF.md"),
    ].join("\n");

    expect(readme).toContain("docs/operations/RC_EVIDENCE_AUDIT.md");
    expect(installation).toContain("docs/operations/RC_EVIDENCE_AUDIT.md");
    expect(handoffDocs).not.toMatch(/89\s+(?:files|test files).*489\s+tests/);
    expect(handoffDocs).not.toContain("Biome checked 341 files");
    expect(handoffDocs).not.toContain("PID was `70112`");
  });
});
