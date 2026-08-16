import { describe, expect, it } from "vitest";

import {
  DESKTOP_RELEASE_INFO,
  DESKTOP_RELEASE_VERSION,
} from "@/lib/release-info";

describe("desktop release info", () => {
  it("keeps the installed app aligned with the v1.1.0 release manifest", () => {
    expect(DESKTOP_RELEASE_VERSION).toBe("1.1.0");
    expect(DESKTOP_RELEASE_INFO.version).toBe(DESKTOP_RELEASE_VERSION);
    expect(DESKTOP_RELEASE_INFO.currentVersion).toBe(DESKTOP_RELEASE_VERSION);
    expect(DESKTOP_RELEASE_INFO.edition).toBe("desktop");
    expect(DESKTOP_RELEASE_INFO.repositoryUrl).toBe(
      "https://github.com/zixuanzhou0-ai/speakright",
    );
    expect(DESKTOP_RELEASE_INFO.releaseUrl).toContain(
      `v${DESKTOP_RELEASE_VERSION}-desktop-preview.1`,
    );
    expect(DESKTOP_RELEASE_INFO.issuesUrl).toBe(
      `${DESKTOP_RELEASE_INFO.repositoryUrl}/issues`,
    );
    expect(DESKTOP_RELEASE_INFO.privacyUrl).toBe(
      `${DESKTOP_RELEASE_INFO.repositoryUrl}/blob/main/PRIVACY.md`,
    );
    expect(DESKTOP_RELEASE_INFO.licenseUrl).toBe(
      `${DESKTOP_RELEASE_INFO.repositoryUrl}/blob/main/LICENSE`,
    );
    expect("installers" in DESKTOP_RELEASE_INFO).toBe(false);
  });

  it("truthfully documents the unsigned community preview", () => {
    expect(DESKTOP_RELEASE_INFO.signed).toBe(false);
    expect(DESKTOP_RELEASE_INFO.build.signed).toBe(false);
    expect(DESKTOP_RELEASE_INFO.build.signatureStatus).toBe("NotSigned");
    expect(DESKTOP_RELEASE_INFO.build.signatureLabel).toBe("未签名");
    expect(DESKTOP_RELEASE_INFO.channel).toBe("preview");
    expect(DESKTOP_RELEASE_INFO.channelLabel).toBe("社区预览版");
    expect(DESKTOP_RELEASE_INFO.build.releaseReportFileName).toBe(
      `SpeakRight_${DESKTOP_RELEASE_VERSION}_release-report.json`,
    );
    expect(DESKTOP_RELEASE_INFO.notes.status).toContain("未知发布者");
    expect(DESKTOP_RELEASE_INFO.notes.status).toContain("SHA-256");
    expect(DESKTOP_RELEASE_INFO.notes.artifacts).toContain("Pre-release");
    expect(DESKTOP_RELEASE_INFO.notes.releasePage).toContain("Desktop Preview");
    expect(DESKTOP_RELEASE_INFO.notes.checksum).toContain("SHA-256");
    expect(DESKTOP_RELEASE_INFO.notes.checksum).toContain("NSIS");
    expect(DESKTOP_RELEASE_INFO.notes.checksum).toContain(
      "MSI 仅作本地构建元数据检查",
    );
    expect(DESKTOP_RELEASE_INFO.notes.checksum).toContain("不进入报告");
    expect(DESKTOP_RELEASE_INFO.notes.artifacts).toContain("不发布 MSI");
  });

  it("exposes build provenance without pretending local builds are releases", () => {
    expect(DESKTOP_RELEASE_INFO.commitSha).toBeTruthy();
    expect(DESKTOP_RELEASE_INFO.builtAt).toBeTruthy();
    expect(DESKTOP_RELEASE_INFO.lastValidatedAt).toBeTruthy();
  });
});
