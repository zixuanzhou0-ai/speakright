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
  {
    name: "github-token",
    regex: /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{30,})/,
  },
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
      ".gitattributes",
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
    const notice = read("NOTICE.md");
    const notices = read("THIRD_PARTY_NOTICES.md");

    expect(license).toMatch(/^MIT License/);
    expect(license).not.toContain("Additional project notice");
    expect(notice).toContain("not automatically relicensed under MIT");
    expect(notice).toContain("docs/assets/asset-rights-registry.json");
    expect(notices).toContain("does not relicense bundled third-party");
    expect(notices).toContain("Add no third-party media");
  });

  it("keeps the retired dictionary integration out of public release inputs", () => {
    const registry = read("docs/assets/asset-rights-registry.json");
    const retiredProviderName = ["Merriam", "Webster"].join("-");
    const retiredProviderSlug = retiredProviderName.toLowerCase();
    const retiredDictionaryHost = ["dictionaryapi", "com"].join(".");
    const retiredLogoName = ["mw-logo", "svg"].join(".");
    const retiredHookName = ["useMw", "Pronunciation"].join("");
    const retiredChineseName = ["韦", "氏"].join("");
    const publicStatements = [
      read("AGENTS.md"),
      read("NOTICE.md"),
      read("THIRD_PARTY_NOTICES.md"),
      read("PRIVACY.md"),
      read("README.md"),
      read("docs/browser-edition/ARCHITECTURE_AND_SEPARATION.md"),
      read("docs/browser-edition/THIRD_PARTY_NOTICES.md"),
    ].join("\n");

    expect(
      existsSync(join(projectRoot, "public/images", retiredLogoName)),
    ).toBe(false);
    for (const marker of [
      `${retiredProviderSlug}-mark`,
      retiredDictionaryHost,
      retiredLogoName,
    ]) {
      expect(registry.toLowerCase()).not.toContain(marker.toLowerCase());
    }
    for (const marker of [
      retiredProviderName,
      retiredChineseName,
      retiredDictionaryHost,
      retiredLogoName,
      retiredHookName,
    ]) {
      expect(publicStatements.toLowerCase()).not.toContain(
        marker.toLowerCase(),
      );
    }
  });

  it("keeps clean checkouts byte-stable across Windows and CI", () => {
    const attributes = read(".gitattributes");

    expect(attributes).toContain("* text=auto eol=lf");
    for (const extension of ["png", "mp3", "wav", "mp4", "zip", "exe", "msi"]) {
      expect(attributes).toContain(`*.${extension} -text`);
    }
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
    expect(contributing).toContain(
      "`Installation or startup help` issue template",
    );
    expect(contributing).toContain("`Bug report` issue template");
    expect(contributing).toContain(
      "`IPA or pronunciation audit` issue template",
    );
    expect(contributing).toContain(
      "`Audio gap or provider request` issue template",
    );
    expect(contributing).toContain("`SECURITY.md` private report");
    expect(contributing).toContain("quota-impacting provider work");
    expect(contributing).toContain("latest dry-run result");
    expect(contributing).toContain("text/audio scope");
    expect(contributing).toContain("approval owner");
    expect(contributing).toContain(
      "Spanish, French, and Russian are experimental",
    );
    expect(support).toContain("Release EXE");
    expect(support).toContain("installation/startup issue template");
    expect(support).toContain("SmartScreen");
    expect(support).toContain("SECURITY.md");
    expect(support).toContain("needs-review");
    expect(support).toContain("audio/provider issue template");
    expect(support).toContain(
      "Do not ask contributors to generate ElevenLabs audio",
    );
    expect(support).toContain(
      "Provider-quota requests should include the dry-run result",
    );
    expect(support).toContain("estimate the text/audio scope");
    expect(support).toContain("approval before anyone runs");
    expect(support).toContain(
      "Log excerpts only if they are short and redacted",
    );
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
    const audioProvider = read(
      ".github/ISSUE_TEMPLATE/audio_provider_request.md",
    );
    const issueRouting = read(".github/ISSUE_TEMPLATE/README.md");
    const pullRequest = read(".github/pull_request_template.md");

    expect(issueConfig).toContain("blank_issues_enabled: false");
    expect(issueConfig).toContain("Support routing guide");
    expect(issueConfig).toContain("SUPPORT.md");
    expect(issueConfig).toContain("Security report");
    expect(installationStartup).toContain("Installation or startup help");
    expect(installationStartup).toContain(
      "Downloaded installer or Release EXE",
    );
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
    expect(installationStartup).toContain(
      "Spanish, French, and Russian remain experimental",
    );
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
    expect(audioProvider).toContain(
      "Spanish, French, and Russian remain experimental",
    );
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
    expect(issueRouting).toContain(
      "Do not ask contributors to generate ElevenLabs audio",
    );
    expect(issueRouting).toContain(
      "include the dry-run result plus expected text/audio scope",
    );
    expect(issueRouting).toContain(
      "Spanish, French, and Russian remain experimental",
    );
    expect(issueRouting).toContain("evidenceMastery");
    expect(pullRequest).toContain("I did not use localhost/dev server");
    expect(pullRequest).toContain("I did not generate ElevenLabs audio");
    expect(pullRequest).toContain(
      "Spanish, French, and Russian remain experimental",
    );
    expect(pullRequest).toContain("`IPA or pronunciation audit`");
    expect(pullRequest).toContain("source evidence");
    expect(pullRequest).toContain("`Audio gap or provider");
    expect(pullRequest).toContain("paid-provider/quota request");
    expect(pullRequest).toContain(
      "Any provider-quota work includes a dry-run result",
    );
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

  it("keeps Browser Stable and unsigned Desktop Preview release channels separate", () => {
    const validationWorkflow = read(".github/workflows/build-windows.yml");
    const browserRelease = read(".github/workflows/release-browser.yml");
    const desktopPreview = read(
      ".github/workflows/release-desktop-preview.yml",
    );

    expect(validationWorkflow).toContain("Upload desktop validation reports");
    expect(validationWorkflow).toContain(
      "speakright-windows-validation-reports",
    );
    expect(validationWorkflow).not.toContain("target/release/speakright.exe");
    expect(validationWorkflow).not.toContain("bundle/nsis/*.exe");
    expect(validationWorkflow).not.toContain("    tags:");
    expect(browserRelease).toContain("Release Browser Stable");
    expect(browserRelease).toContain("--edition browser");
    expect(browserRelease).not.toContain("--prerelease --title");
    expect(desktopPreview).toContain("Release Desktop Preview");
    expect(desktopPreview).toContain("--edition desktop");
    expect(desktopPreview).toContain("desktop:preview-release-gate");
    expect(desktopPreview).toContain("--prerelease");
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
    expect(archiveIndex).toMatch(
      /must not be used\s+as current implementation/,
    );
    expect(currentDocs).not.toContain("current release-hardening proof matrix");
    expect(currentDocs).not.toContain("docs/operations/RC_EVIDENCE_AUDIT.md");
    expect(currentDocs).not.toMatch(/\btomorrow(?:'s)?\b/i);
  });

  it("keeps README release evidence current and present", () => {
    const readme = read("README.md");
    const representativeEvidence = [
      "docs/assets/screenshots/release/v1.1.0/browser/1280x800/guided-repeat.png",
      "docs/assets/screenshots/release/v1.1.0/browser/1280x800/free-practice.png",
      "docs/assets/screenshots/release/v1.1.0/browser/1280x800/diagnosis-example.png",
      "docs/assets/screenshots/release/v1.1.0/browser/1280x800/settings.png",
      "docs/assets/screenshots/release/v1.1.0/desktop/1280x920/guided-repeat.png",
      "docs/assets/screenshots/release/v1.1.0/desktop/1280x920/free-practice.png",
      "docs/assets/screenshots/release/v1.1.0/desktop/1280x920/diagnosis-example.png",
      "docs/assets/screenshots/release/v1.1.0/desktop/1280x920/settings.png",
      "docs/assets/demo/speakright-v1.1.0-overview.mp4",
      "docs/assets/demo/speakright-v1.1.0-overview.en.vtt",
    ];

    for (const markdownPath of representativeEvidence) {
      expect(readme).toContain(markdownPath);
      expect(existsSync(join(projectRoot, markdownPath)), markdownPath).toBe(
        true,
      );
    }

    const matrices = [
      {
        edition: "browser",
        viewports: ["1280x800", "390x844", "360x800"],
      },
      { edition: "desktop", viewports: ["1280x920", "1024x800"] },
    ];
    const shots = [
      "guided-repeat",
      "free-practice",
      "diagnosis-example",
      "settings",
      "progress-example",
      "no-key",
    ];

    for (const { edition, viewports } of matrices) {
      for (const viewport of viewports) {
        for (const shot of shots) {
          const screenshotPath =
            `docs/assets/screenshots/release/v1.1.0/${edition}/` +
            `${viewport}/${shot}.png`;
          expect(
            existsSync(join(projectRoot, screenshotPath)),
            screenshotPath,
          ).toBe(true);
        }
      }
    }

    expect(readme).toContain("Example data — not a live Azure score");
    expect(readme).toContain("real user scores come from Azure");
  });

  it("keeps installation and startup docs portable and privacy-safe", () => {
    const rootInstallation = read("INSTALLATION.md");
    const rootRunbook = read("DESKTOP_STARTUP_RUNBOOK.md");
    const rootHandoff = read("NEXT_CHAT_HANDOFF.md");
    const installation = read("docs/INSTALLATION.md");
    const docs = [
      rootInstallation,
      rootRunbook,
      rootHandoff,
      installation,
    ].join("\n");

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

  it("does not imply that an ordinary desktop uninstall deletes user data", () => {
    const privacy = read("PRIVACY.md");

    expect(privacy).toContain(
      "An ordinary uninstall may retain local learning data, preferences, and caches",
    );
    expect(privacy).toContain("Settings → Data & privacy → Reset local data");
    expect(privacy).toContain("choose whether to also delete API keys");
    expect(privacy).toContain("Delete app data");
    expect(privacy).toContain(
      "does not claim to validate deletion of user data",
    );
    expect(privacy).toContain(
      "must be deleted separately in the relevant provider account",
    );
    expect(privacy).not.toMatch(
      /uninstall(?:ing|s|ed)?[^.]{0,80}(?:deletes?|removes?) all local data/i,
    );
  });

  it("keeps the maintainer-attested user-testing claim narrow and privacy-safe", () => {
    const summary = read("docs/validation/USER_TESTING_SUMMARY.md");

    expect(summary).toContain(
      "The SpeakRight maintainer reports that 20 people tested SpeakRight offline.",
    );
    expect(summary).toContain("not an independently audited study result");
    expect(summary).toContain(
      "No participant names, raw recordings, contact details",
    );
    expect(summary).toContain(
      "No private source-evidence path or participant-level proof is required",
    );
    expect(summary).toContain("optional, not a prerequisite");
    expect(summary).not.toContain("Participants invited");
    expect(summary).not.toContain("Independent review 1");
    expect(summary).not.toContain("application-readiness gate remains open");
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
      "build:browser:production",
      "desktop:build",
      "desktop:preflight",
      "desktop:launch-release",
      "desktop:ui-smoke",
      "audio:parity:dry-run",
      "audio:loudness:dry-run",
      "ipa:audit:export",
      "validate:internal-release",
      "validate:public-release",
      "check:release-version",
      "release:evidence:check",
      "user-testing:claims:check",
      "user-testing:claims:test",
      "security:audit:npm",
      "security:sbom:cargo",
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
    expect(scripts["validate:release"]).toContain("validate:desktop-preview");
    expect(scripts["validate:release"]).toContain("user-testing:claims:check");
    expect(scripts["validate:release"]).not.toContain(
      "user-testing:evidence:check",
    );
    expect(scripts["validate:signed-desktop-release"]).toContain(
      "desktop:release-gate",
    );

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
