export const DESKTOP_RELEASE_VERSION = "1.0.1";

const repositoryUrl = "https://github.com/zixuanzhou0-ai/speakright-desktop";
const releaseTag = `v${DESKTOP_RELEASE_VERSION}`;
const releaseUrl = `${repositoryUrl}/releases/tag/${releaseTag}`;

export const DESKTOP_RELEASE_INFO = {
  productName: "SpeakRight",
  currentVersion: DESKTOP_RELEASE_VERSION,
  channel: "internal",
  releasedAt: "2026-05-13",
  repositoryUrl,
  releaseUrl,
  build: {
    framework: "Tauri 2 + Next.js 16 static export",
    target: "Windows x64",
    signed: false,
    signatureStatus: "NotSigned",
    releaseReportFileName: `SpeakRight_${DESKTOP_RELEASE_VERSION}_release-report.json`,
  },
  notes: {
    artifacts: "安装包只作为 GitHub Release/CI 产物提供，不在已安装 App 内展示或下载。",
    unsigned:
      "当前安装包暂未做代码签名，Windows 可能显示未知发布者提示；仅建议用于可控内测，公开发布前必须完成代码签名。",
    checksum:
      "每次桌面构建都会生成 release report，记录 EXE/MSI/NSIS 的 SHA-256 digest 与签名状态。",
  },
} as const;
