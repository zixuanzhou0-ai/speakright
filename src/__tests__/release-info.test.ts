import { describe, expect, it } from "vitest";

import {
  DESKTOP_RELEASE_INFO,
  DESKTOP_RELEASE_VERSION,
} from "@/lib/release-info";

describe("desktop release info", () => {
  it("keeps installer URLs aligned with the current version", () => {
    expect(DESKTOP_RELEASE_INFO.currentVersion).toBe(DESKTOP_RELEASE_VERSION);
    expect(DESKTOP_RELEASE_INFO.releaseUrl).toContain(
      `v${DESKTOP_RELEASE_VERSION}`,
    );

    for (const installer of DESKTOP_RELEASE_INFO.installers) {
      expect(installer.fileName).toContain(DESKTOP_RELEASE_VERSION);
      expect(installer.downloadUrl).toContain(`v${DESKTOP_RELEASE_VERSION}`);
      expect(installer.downloadUrl).toContain(installer.fileName);
    }
  });

  it("documents the unsigned installer status", () => {
    expect(DESKTOP_RELEASE_INFO.build.signed).toBe(false);
    expect(DESKTOP_RELEASE_INFO.build.signatureStatus).toBe("NotSigned");
    expect(DESKTOP_RELEASE_INFO.build.releaseReportFileName).toBe(
      `SpeakRight_${DESKTOP_RELEASE_VERSION}_release-report.json`,
    );
    expect(DESKTOP_RELEASE_INFO.notes.unsigned).toContain("未知发布者");
  });
});
