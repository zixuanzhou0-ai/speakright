// This file is generated from release.config.json by scripts/release-config.mjs.
// Run `npm run release:config:generate` after changing the release manifest.

export type ReleaseInfo = {
  version: string;
  edition: "browser" | "desktop";
  channel: "stable" | "preview";
  commitSha: string;
  builtAt: string;
  signed: boolean;
  repositoryUrl: string;
  issuesUrl: string;
  privacyUrl: string;
  licenseUrl: string;
};

export const BROWSER_RELEASE_VERSION = "1.1.0";

const commitSha =
  process.env.NEXT_PUBLIC_SPEAKRIGHT_COMMIT_SHA?.trim() || "development";
const builtAt =
  process.env.NEXT_PUBLIC_SPEAKRIGHT_BUILD_TIMESTAMP?.trim() || "local build";
const lastValidatedAt =
  process.env.NEXT_PUBLIC_SPEAKRIGHT_VALIDATED_AT?.trim() ||
  "待 v1.1.0 完整验收";
const repositoryUrl = "https://github.com/zixuanzhou0-ai/speakright";
const releaseTag = "v1.1.0";
const releaseUrl = `${repositoryUrl}/releases/tag/${releaseTag}`;
const issuesUrl = `${repositoryUrl}/issues`;
const privacyUrl = `${repositoryUrl}/blob/main/PRIVACY.md`;
const licenseUrl = `${repositoryUrl}/blob/main/LICENSE`;

export const BROWSER_RELEASE_INFO = {
  productName: "SpeakRight Browser Edition",
  version: BROWSER_RELEASE_VERSION,
  currentVersion: BROWSER_RELEASE_VERSION,
  edition: "browser",
  channel: "stable",
  channelLabel: "稳定版",
  commitSha,
  builtAt,
  signed: false,
  lastValidatedAt,
  repositoryUrl,
  releaseUrl,
  issuesUrl,
  privacyUrl,
  licenseUrl,
  build: {
    framework: "Next.js 16 static export",
    target: "Windows / macOS / Linux browser",
    signed: false,
    signatureStatus: "NotApplicable",
    signatureLabel: "不适用",
    distributionLabel: "静态浏览器构建",
    releaseReportFileName: "SpeakRight_Browser_1.1.0_validation-report.json",
  },
  notes: {
    artifacts:
      "浏览器稳定版提供源码和从标识 commit 构建的静态包，可在 localhost 或 HTTPS 环境运行。",
    releasePage:
      "此页面指向 Browser Stable 与源码发行记录；Windows Desktop Preview 使用独立预发行标签。",
    status:
      "浏览器版通过源码和静态构建发行，不包含 EXE、MSI 或 NSIS 安装包，因此代码签名不适用。麦克风权限需要 localhost 或 HTTPS。",
    checksum:
      "发行附件提供 Browser 静态包、SHA-256、npm/Cargo SBOM 和验证摘要。",
  },
} as const satisfies ReleaseInfo & Record<string, unknown>;
