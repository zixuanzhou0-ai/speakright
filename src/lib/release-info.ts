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

export const DESKTOP_RELEASE_VERSION = "1.1.0";

const commitSha =
  process.env.NEXT_PUBLIC_SPEAKRIGHT_COMMIT_SHA?.trim() || "development";
const builtAt =
  process.env.NEXT_PUBLIC_SPEAKRIGHT_BUILD_TIMESTAMP?.trim() || "local build";
const lastValidatedAt =
  process.env.NEXT_PUBLIC_SPEAKRIGHT_VALIDATED_AT?.trim() || "2026-08-23";
const repositoryUrl = "https://github.com/zixuanzhou0-ai/speakright";
const releaseTag = "v1.1.0-desktop-preview.1";
const releaseUrl = `${repositoryUrl}/releases/tag/${releaseTag}`;
const issuesUrl = `${repositoryUrl}/issues`;
const privacyUrl = `${repositoryUrl}/blob/main/PRIVACY.md`;
const licenseUrl = `${repositoryUrl}/blob/main/LICENSE`;

export const DESKTOP_RELEASE_INFO = {
  productName: "SpeakRight Desktop",
  version: DESKTOP_RELEASE_VERSION,
  currentVersion: DESKTOP_RELEASE_VERSION,
  edition: "desktop",
  channel: "preview",
  channelLabel: "社区预览版",
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
    framework: "Tauri 2 + Next.js 16 static export",
    target: "Windows x64",
    signed: false,
    signatureStatus: "NotSigned",
    signatureLabel: "未签名",
    distributionLabel: "未签名 Windows NSIS 安装包",
    releaseReportFileName: "SpeakRight_1.1.0_release-report.json",
  },
  notes: {
    artifacts:
      "GitHub Pre-release 仅发布裸 Release EXE 与通过安装、启动、退出、卸载往返验收的 NSIS 安装包；v1.1.0 不发布 MSI。已安装应用内不提供自动下载或静默更新。",
    releasePage:
      "此页面指向独立的 Desktop Preview 发行记录，不与 Browser Stable 混称为签名桌面稳定版。",
    status:
      "这是未签名的 Windows 社区预览版。Windows SmartScreen 可能显示“未知发布者”；请只从项目 Release 下载，并核对 SHA-256。",
    checksum:
      "发行报告记录公开裸 EXE 与 NSIS 的 SHA-256 和实际 Authenticode 状态；MSI 仅作本地构建元数据检查，不进入报告或公开附件。",
  },
} as const satisfies ReleaseInfo & Record<string, unknown>;
