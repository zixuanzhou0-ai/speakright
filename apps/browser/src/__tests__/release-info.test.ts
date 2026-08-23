import { describe, expect, it } from "vitest";

import {
  BROWSER_RELEASE_INFO,
  BROWSER_RELEASE_VERSION,
} from "@/lib/release-info";

describe("browser release info", () => {
  it("keeps Browser Edition aligned with the stable v1.1.0 manifest", () => {
    expect(BROWSER_RELEASE_VERSION).toBe("1.1.0");
    expect(BROWSER_RELEASE_INFO.version).toBe(BROWSER_RELEASE_VERSION);
    expect(BROWSER_RELEASE_INFO.currentVersion).toBe(BROWSER_RELEASE_VERSION);
    expect(BROWSER_RELEASE_INFO.edition).toBe("browser");
    expect(BROWSER_RELEASE_INFO.channel).toBe("stable");
    expect(BROWSER_RELEASE_INFO.channelLabel).toBe("稳定版");
    expect(BROWSER_RELEASE_INFO.repositoryUrl).toBe(
      "https://github.com/zixuanzhou0-ai/speakright",
    );
    expect(BROWSER_RELEASE_INFO.releaseUrl).toContain(
      `v${BROWSER_RELEASE_VERSION}`,
    );
    expect(BROWSER_RELEASE_INFO.issuesUrl).toBe(
      `${BROWSER_RELEASE_INFO.repositoryUrl}/issues`,
    );
    expect(BROWSER_RELEASE_INFO.privacyUrl).toBe(
      `${BROWSER_RELEASE_INFO.repositoryUrl}/blob/main/PRIVACY.md`,
    );
    expect(BROWSER_RELEASE_INFO.licenseUrl).toBe(
      `${BROWSER_RELEASE_INFO.repositoryUrl}/blob/main/LICENSE`,
    );
  });

  it("marks installer signing as not applicable instead of unsigned", () => {
    expect(BROWSER_RELEASE_INFO.signed).toBe(false);
    expect(BROWSER_RELEASE_INFO.build.signatureStatus).toBe("NotApplicable");
    expect(BROWSER_RELEASE_INFO.build.signatureLabel).toBe("不适用");
    expect(BROWSER_RELEASE_INFO.build.distributionLabel).toBe("静态浏览器构建");
    expect(BROWSER_RELEASE_INFO.notes.status).toContain("代码签名不适用");
    expect(BROWSER_RELEASE_INFO.notes.status).not.toContain("未知发布者");
    expect(BROWSER_RELEASE_INFO.notes.artifacts).toContain("标识 commit");
    expect(BROWSER_RELEASE_INFO.notes.artifacts).not.toContain("可复现");
  });
});
