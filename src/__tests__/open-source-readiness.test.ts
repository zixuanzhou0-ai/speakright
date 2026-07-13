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
      "CODE_OF_CONDUCT.md",
      "CONTRIBUTING.md",
      "SUPPORT.md",
      "SECURITY.md",
      "THIRD_PARTY_NOTICES.md",
      "INSTALLATION.md",
      "DESKTOP_STARTUP_RUNBOOK.md",
      "NEXT_CHAT_HANDOFF.md",
      ".env.example",
      ".github/ISSUE_TEMPLATE/installation_startup.md",
      ".github/ISSUE_TEMPLATE/bug_report.md",
      ".github/ISSUE_TEMPLATE/ipa_audit.md",
      ".github/ISSUE_TEMPLATE/audio_provider_request.md",
      ".github/ISSUE_TEMPLATE/feature_request.md",
      ".github/ISSUE_TEMPLATE/README.md",
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
    const codeOfConduct = read("CODE_OF_CONDUCT.md");
    const contributing = read("CONTRIBUTING.md");
    const security = read("SECURITY.md");
    const support = read("SUPPORT.md");

    expect(codeOfConduct).toContain("evidence-first");
    expect(codeOfConduct).toContain("Do not post API keys");
    expect(codeOfConduct).toContain("Spanish, French, and Russian");
    expect(contributing).toContain("CODE_OF_CONDUCT.md");
    expect(contributing).toContain("SUPPORT.md");
    expect(contributing).toContain("Release EXE");
    expect(contributing).toContain("Do not generate ElevenLabs audio");
    expect(contributing).toContain("Triage Routing");
    expect(contributing).toContain("`Installation or startup help` issue template");
    expect(contributing).toContain("`Bug report` issue template");
    expect(contributing).toContain("`IPA or pronunciation audit` issue template");
    expect(contributing).toContain("`Audio gap or provider request` issue template");
    expect(contributing).toContain("`SECURITY.md` private report");
    expect(contributing).toContain("quota-impacting provider work");
    expect(contributing).toContain("latest dry-run result");
    expect(contributing).toContain("text/audio scope");
    expect(contributing).toContain("approval owner");
    expect(contributing).toContain("Spanish, French, and Russian are experimental");
    expect(support).toContain("Release EXE");
    expect(support).toContain("installation/startup issue template");
    expect(support).toContain("SmartScreen");
    expect(support).toContain("SECURITY.md");
    expect(support).toContain("needs-review");
    expect(support).toContain("audio/provider issue template");
    expect(support).toContain("Do not ask contributors to generate ElevenLabs audio");
    expect(support).toContain("Provider-quota requests should include the dry-run result");
    expect(support).toContain("estimate the text/audio scope");
    expect(support).toContain("approval before anyone runs");
    expect(support).toContain("Log excerpts only if they are short and redacted");
    expect(support).toContain("Full diagnostics bundles");
    expect(security).toContain("Windows artifacts are currently unsigned");
  });

  it("keeps public issue and PR templates aligned with release and privacy boundaries", () => {
    const issueConfig = read(".github/ISSUE_TEMPLATE/config.yml");
    const installationStartup = read(
      ".github/ISSUE_TEMPLATE/installation_startup.md",
    );
    const bugReport = read(".github/ISSUE_TEMPLATE/bug_report.md");
    const featureRequest = read(".github/ISSUE_TEMPLATE/feature_request.md");
    const ipaAudit = read(".github/ISSUE_TEMPLATE/ipa_audit.md");
    const audioProvider = read(".github/ISSUE_TEMPLATE/audio_provider_request.md");
    const issueRouting = read(".github/ISSUE_TEMPLATE/README.md");
    const pullRequest = read(".github/pull_request_template.md");

    expect(issueConfig).toContain("blank_issues_enabled: false");
    expect(issueConfig).toContain("Support routing guide");
    expect(issueConfig).toContain("SUPPORT.md");
    expect(issueConfig).toContain("Security report");
    expect(installationStartup).toContain("Installation or startup help");
    expect(installationStartup).toContain("Downloaded installer or Release EXE");
    expect(installationStartup).toContain("Built from source");
    expect(installationStartup).toContain("npm run desktop:build");
    expect(installationStartup).toContain("speakright.exe");
    expect(installationStartup).toContain("SmartScreen");
    expect(installationStartup).toContain("API keys configured");
    expect(installationStartup).toContain("Network state");
    expect(installationStartup).toContain("Microphone permission/device");
    expect(installationStartup).toContain("Settings local-audio state");
    expect(installationStartup).toContain("缺失或不可读");
    expect(installationStartup).toContain("Chinese inline error or warning");
    expect(installationStartup).toContain("localhost/dev-server tab is not");
    expect(installationStartup).toContain("Keep evidence minimal and redacted");
    expect(installationStartup).toContain("diagnostics bundles");
    expect(installationStartup).toContain("C:\\Users\\name");
    expect(installationStartup).toContain("ElevenLabs");
    expect(installationStartup).toContain("Spanish, French, and Russian remain experimental");
    expect(bugReport).toContain("Release EXE");
    expect(bugReport).toContain("Spanish, French, or Russian");
    expect(bugReport).toContain("Network state");
    expect(bugReport).toContain("API keys configured");
    expect(bugReport).toContain("Microphone permission/device");
    expect(bugReport).toContain("缺失或不可读");
    expect(bugReport).toContain("Chinese inline error or warning");
    expect(bugReport).toContain("Keep evidence minimal and redacted");
    expect(bugReport).toContain("bearer tokens");
    expect(bugReport).toContain("C:\\Users\\name");
    expect(bugReport).toContain("full diagnostic bundles");
    expect(bugReport).toContain("CODE_OF_CONDUCT.md");
    expect(featureRequest).toContain("Release EXE");
    expect(featureRequest).toContain("experimental-language boundary");
    expect(featureRequest).toContain("ElevenLabs");
    expect(featureRequest).toContain("CODE_OF_CONDUCT.md");
    expect(ipaAudit).toContain("Audit role");
    expect(ipaAudit).toContain("one primary");
    expect(ipaAudit).toContain("dictionary/textbook corroboration");
    expect(ipaAudit).toContain("deck-focus-hint");
    expect(ipaAudit).toContain("needs-review");
    expect(ipaAudit).toContain("CODE_OF_CONDUCT.md");
    expect(audioProvider).toContain("Missing bundled local audio");
    expect(audioProvider).toContain("wrong source");
    expect(audioProvider).toContain("Loudness or clipping mismatch");
    expect(audioProvider).toContain("paid provider");
    expect(audioProvider).toContain("Release EXE or installer");
    expect(audioProvider).toContain("Settings language-pack state");
    expect(audioProvider).toContain("Network state during the check");
    expect(audioProvider).toContain("UI stayed non-clickable");
    expect(audioProvider).toContain("teaching-video audio");
    expect(audioProvider).toContain("Latest zero-generation audit run");
    expect(audioProvider).toContain("Dry-run report path or summary");
    expect(audioProvider).toContain("Estimated text/character/audio scope");
    expect(audioProvider).toContain("Keep evidence minimal and redacted");
    expect(audioProvider).toContain("bearer tokens");
    expect(audioProvider).toContain("private practice text");
    expect(audioProvider).toContain("C:\\Users\\name");
    expect(audioProvider).toContain("without explicit maintainer approval");
    expect(audioProvider).toContain("included a dry-run result");
    expect(audioProvider).toContain("expected text/audio scope");
    expect(audioProvider).toContain("Spanish, French, and Russian remain experimental");
    expect(issueRouting).toContain("Issue Routing");
    expect(issueRouting).toContain("Installation or startup help");
    expect(issueRouting).toContain("unsigned Windows artifact");
    expect(issueRouting).toContain("Bug report");
    expect(issueRouting).toContain("Audio gap or provider request");
    expect(issueRouting).toContain("IPA or pronunciation audit");
    expect(issueRouting).toContain("Feature request");
    expect(issueRouting).toContain("SECURITY.md");
    expect(issueRouting).toContain("SUPPORT.md");
    expect(issueRouting).toContain("Release EXE or installer");
    expect(issueRouting).toContain("localhost/dev-server tab is not");
    expect(issueRouting).toContain("Keep public evidence minimal and redacted");
    expect(issueRouting).toContain("bearer tokens");
    expect(issueRouting).toContain("C:\\Users\\name");
    expect(issueRouting).toContain("Full diagnostics bundles");
    expect(issueRouting).toContain("Do not ask contributors to generate ElevenLabs audio");
    expect(issueRouting).toContain("include the dry-run result plus expected text/audio scope");
    expect(issueRouting).toContain("Spanish, French, and Russian remain experimental");
    expect(issueRouting).toContain("evidenceMastery");
    expect(pullRequest).toContain("I did not use localhost/dev server");
    expect(pullRequest).toContain("I did not generate ElevenLabs audio");
    expect(pullRequest).toContain("Spanish, French, and Russian remain experimental");
    expect(pullRequest).toContain("`IPA or pronunciation audit`");
    expect(pullRequest).toContain("source evidence");
    expect(pullRequest).toContain("`Audio gap or provider");
    expect(pullRequest).toContain("paid-provider/quota request");
    expect(pullRequest).toContain("Any provider-quota work includes a dry-run result");
    expect(pullRequest).toContain("expected text/audio scope");
    expect(pullRequest).toContain("explicit maintainer approval");
    expect(pullRequest).toContain("private recording");
    expect(pullRequest).toContain("full diagnostics bundle");
    expect(pullRequest).toContain("private learning-data export");
    expect(pullRequest).toContain("unsafe desktop permission");
    expect(pullRequest).toContain("SECURITY.md");
    expect(pullRequest).toContain("SUPPORT.md");
    expect(pullRequest).toContain("two independent sources");
    expect(pullRequest).toContain("non-english-ipa-reviewed-findings.json");
    expect(pullRequest).toContain("verdict/status contract");
    expect(pullRequest).toContain("I did not change `needs-review` IPA rows");
    expect(pullRequest).toContain("I followed `CODE_OF_CONDUCT.md`");
  });

  it("keeps Windows workflow artifacts separated by controlled-test and signed-release status", () => {
    const workflow = read(".github/workflows/build-windows.yml");

    expect(workflow).toContain("Enforce public release signing");
    expect(workflow).toContain("npm run desktop:release-gate");
    expect(workflow).toContain("Upload controlled-test artifacts");
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain("speakright-windows-controlled-test-artifacts");
    expect(workflow).toContain("Upload signed release artifacts");
    expect(workflow).toContain("startsWith(github.ref, 'refs/tags/v')");
    expect(workflow).toContain("speakright-windows-signed-release-artifacts");
    expect(workflow).not.toContain("name: speakright-windows-installers");
  });

  it("keeps the current handoff aligned with the evidence-first contract", () => {
    const handoff = read("docs/operations/NEXT_CHAT_HANDOFF.md");
    const prd = read("docs/PRD.md");
    const decision = read(
      "docs/architecture/0001-evidence-first-learning-loop.md",
    );
    const docs = [handoff, prd, decision, read("README.md")].join("\n");

    expect(docs).not.toContain("known uncommitted work");
    expect(docs).not.toContain("ahead of `origin/main` by local commits");
    expect(docs).not.toContain("E:\\SpeakRightDesktopRepo");
    expect(handoff).toContain("Azure results are noisy observations");
    expect(handoff).toContain("LLM coaching cannot invent or overwrite");
    expect(prd).toContain("A single recording cannot establish mastery");
    expect(decision).toContain("treated as fallible observations");
  });

  it("archives superseded release evidence instead of treating it as current", () => {
    const archive = read(
      "docs/archive/2026-06-desktop-release/RC_EVIDENCE_AUDIT.md",
    );
    const archiveIndex = read("docs/archive/README.md");
    const currentDocs = [
      read("README.md"),
      read("docs/PRD.md"),
      read("docs/operations/NEXT_CHAT_HANDOFF.md"),
    ].join("\n");

    expect(archive).toContain("Latest local full gate");
    expect(archive).toContain("No ElevenLabs calls were made");
    expect(archiveIndex).toMatch(/must not be used\s+as current implementation/);
    expect(currentDocs).not.toContain("current release-hardening proof matrix");
    expect(currentDocs).not.toContain("docs/operations/RC_EVIDENCE_AUDIT.md");
    expect(currentDocs).not.toMatch(/\btomorrow(?:'s)?\b/i);
  });

  it("keeps README screenshot assets present", () => {
    const readme = read("README.md");
    for (const screenshot of [
      "settings.png",
      "english-phoneme-score.png",
      "free-practice.png",
      "english-assessment.png",
      "spanish-phoneme.png",
      "french-phoneme.png",
      "russian-phoneme.png",
    ]) {
      const markdownPath = `docs/assets/screenshots/${screenshot}`;
      expect(readme).toContain(markdownPath);
      expect(existsSync(join(projectRoot, markdownPath)), markdownPath).toBe(
        true,
      );
    }
    expect(readme).toMatch(/smoke-only demo\s+state/);
    expect(readme).toContain("real user scores come from Azure");
  });

  it("keeps installation and startup docs portable and privacy-safe", () => {
    const rootInstallation = read("INSTALLATION.md");
    const rootRunbook = read("DESKTOP_STARTUP_RUNBOOK.md");
    const rootHandoff = read("NEXT_CHAT_HANDOFF.md");
    const installation = read("docs/INSTALLATION.md");
    const docs = [rootInstallation, rootRunbook, rootHandoff, installation].join(
      "\n",
    );

    expect(rootInstallation).toContain("docs/INSTALLATION.md");
    expect(rootInstallation).toContain("npm run desktop:preflight");
    expect(rootInstallation).toContain("npm run desktop:launch-release");
    expect(rootInstallation).toContain("calibration data");
    expect(rootRunbook).toContain("git status --short --branch");
    expect(rootRunbook).toContain("localhost");
    expect(rootHandoff).toContain("docs/operations/NEXT_CHAT_HANDOFF.md");
    expect(installation).toContain("Build From Source");
    expect(docs).not.toContain("E:\\SpeakRightDesktopRepo");
    expect(docs).not.toContain("C:\\Users\\Administrator");
  });

  it("keeps public developer and release npm scripts explicit and zero-generation by default", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      private?: boolean;
      repository?: { url?: string };
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};

    expect(packageJson.private).toBe(true);
    expect(packageJson.repository?.url).toContain("zixuanzhou0-ai/speakright");

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
    expect(scripts.build).toContain("desktop-build");
    expect(scripts["desktop:build"]).toContain("desktop-build");
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
      if (!existsSync(join(projectRoot, path))) continue;
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
  }, 30_000);
});
