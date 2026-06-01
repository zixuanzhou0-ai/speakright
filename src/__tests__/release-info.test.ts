import { describe, expect, it } from "vitest";

import {
  DESKTOP_RELEASE_INFO,
  DESKTOP_RELEASE_VERSION,
} from "@/lib/release-info";

describe("desktop release info", () => {
  it("keeps installed-app release metadata aligned with the current version", () => {
    expect(DESKTOP_RELEASE_INFO.currentVersion).toBe(DESKTOP_RELEASE_VERSION);
    expect(DESKTOP_RELEASE_INFO.releaseUrl).toContain(
      `v${DESKTOP_RELEASE_VERSION}`,
    );
    expect(DESKTOP_RELEASE_INFO.repositoryUrl).toContain(
      "speakright-desktop",
    );
    expect("installers" in DESKTOP_RELEASE_INFO).toBe(false);
  });

  it("documents the unsigned installer status", () => {
    expect(DESKTOP_RELEASE_INFO.build.signed).toBe(false);
    expect(DESKTOP_RELEASE_INFO.build.signatureStatus).toBe("NotSigned");
    expect(DESKTOP_RELEASE_INFO.channel).toBe("internal");
    expect(DESKTOP_RELEASE_INFO.channel).not.toBe("stable");
    expect(DESKTOP_RELEASE_INFO.build.releaseReportFileName).toBe(
      `SpeakRight_${DESKTOP_RELEASE_VERSION}_release-report.json`,
    );
    expect(DESKTOP_RELEASE_INFO.notes.unsigned).toContain("未知发布者");
    expect(DESKTOP_RELEASE_INFO.notes.unsigned).toContain("可控内测");
    expect(DESKTOP_RELEASE_INFO.notes.artifacts).toContain("不在已安装 App 内");
    expect(DESKTOP_RELEASE_INFO.notes.checksum).toContain("release report");
    expect(DESKTOP_RELEASE_INFO.notes.checksum).toContain("SHA-256");
  });
});
