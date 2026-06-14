import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function read(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: projectRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

const SCANNED_TEXT_EXTENSIONS = new Set([
  "",
  ".bat",
  ".cjs",
  ".css",
  ".example",
  ".html",
  ".js",
  ".json",
  ".lock",
  ".md",
  ".mjs",
  ".rs",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const SECRET_PATTERNS = [
  { name: "private-key-block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "openai-key", regex: /sk-(?:proj-)?[A-Za-z0-9_-]{40,}/ },
  { name: "anthropic-key", regex: /sk-ant-[A-Za-z0-9_-]{40,}/ },
  { name: "elevenlabs-key", regex: /sk_[A-Za-z0-9]{32,}/ },
  { name: "github-token", regex: /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{30,})/ },
  { name: "google-api-key", regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "aws-access-key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "slack-token", regex: /xox[baprs]-[A-Za-z0-9-]{30,}/ },
];

function shouldScanTrackedFile(path: string): boolean {
  if (path.startsWith("public/audio/")) return false;
  if (path.startsWith("public/images/")) return false;
  if (path.startsWith("public/videos/")) return false;
  if (path.startsWith("src-tauri/icons/")) return false;

  return SCANNED_TEXT_EXTENSIONS.has(extname(path));
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

  it("keeps public developer and release npm scripts explicit and zero-generation by default", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      private?: boolean;
      repository?: { url?: string };
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};

    expect(packageJson.private).toBe(true);
    expect(packageJson.repository?.url).toContain("speakright-desktop");

    for (const scriptName of [
      "test",
      "typecheck",
      "lint",
      "build:desktop-frontend",
      "desktop:build",
      "desktop:preflight",
      "desktop:launch-release",
      "desktop:ui-smoke",
      "audio:parity:dry-run",
      "audio:loudness:dry-run",
      "ipa:audit:export",
      "validate:internal-release",
      "validate:public-release",
    ]) {
      expect(scripts[scriptName], scriptName).toEqual(expect.any(String));
    }

    expect(scripts["desktop:preflight"]).toContain("desktop-preflight");
    expect(scripts["desktop:launch-release"]).toContain(
      "desktop-launch-release",
    );
    expect(scripts["audio:parity:dry-run"]).toContain("--dry-run");
    expect(scripts["audio:loudness:dry-run"]).toContain("--dry-run");
    expect(scripts["validate:public-release"]).toContain("validate:release");
    expect(scripts["validate:release"]).toContain("desktop:release-gate");

    const routineValidationScripts = [
      scripts.validate,
      scripts["validate:desktop"],
      scripts["validate:desktop-ci"],
      scripts["validate:internal-release"],
      scripts["validate:public-release"],
    ].join("\n");

    expect(routineValidationScripts).not.toContain("audio:parity:generate");
    expect(routineValidationScripts).not.toContain(
      "audio:parity:generate-secondary",
    );
    expect(routineValidationScripts).not.toContain("generate-word-audio");
  });

  it("keeps tracked source files free of obvious real secret formats", () => {
    const findings: string[] = [];

    for (const path of trackedFiles().filter(shouldScanTrackedFile)) {
      const text = read(path);
      if (text.includes("\0")) continue;

      for (const pattern of SECRET_PATTERNS) {
        const match = pattern.regex.exec(text);
        if (!match) continue;

        const line = text.slice(0, match.index).split(/\r?\n/).length;
        findings.push(`${path}:${line}:${pattern.name}`);
      }
    }

    expect(findings).toEqual([]);
  });
});
