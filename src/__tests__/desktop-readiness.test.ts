import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDesktopReadinessSummary,
  DESKTOP_MIC_CHECK_KEY,
  DESKTOP_MIC_CHECK_MAX_AGE_MS,
  isDesktopMicCheckFresh,
  parseDesktopMicCheck,
  readDesktopMicCheck,
  saveDesktopMicCheck,
} from "@/lib/desktop-readiness";

describe("desktop readiness", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("parses only valid microphone check records", () => {
    expect(
      parseDesktopMicCheck(
        JSON.stringify({
          version: 1,
          passedAt: 1000,
          deviceLabel: "Studio Mic",
        }),
      ),
    ).toEqual({
      version: 1,
      passedAt: 1000,
      deviceLabel: "Studio Mic",
    });
    expect(parseDesktopMicCheck(null)).toBeNull();
    expect(parseDesktopMicCheck("{bad json")).toBeNull();
    expect(parseDesktopMicCheck(JSON.stringify({ version: 2 }))).toBeNull();
  });

  it("treats microphone checks as fresh for 30 days", () => {
    const now = 1_000_000;
    expect(
      isDesktopMicCheckFresh({ version: 1, passedAt: now - 1000 }, now),
    ).toBe(true);
    expect(
      isDesktopMicCheckFresh(
        { version: 1, passedAt: now - DESKTOP_MIC_CHECK_MAX_AGE_MS - 1 },
        now,
      ),
    ).toBe(false);
    expect(
      isDesktopMicCheckFresh({ version: 1, passedAt: now + 1 }, now),
    ).toBe(false);
  });

  it("saves and reads the latest desktop microphone check", () => {
    saveDesktopMicCheck({ passedAt: 2000, deviceLabel: "USB Mic" });

    expect(localStorage.getItem(DESKTOP_MIC_CHECK_KEY)).toContain("USB Mic");
    expect(readDesktopMicCheck(2001)).toEqual({
      version: 1,
      passedAt: 2000,
      deviceLabel: "USB Mic",
    });
  });

  it("summarizes first-run readiness steps", () => {
    const summary = buildDesktopReadinessSummary({
      azureReady: true,
      microphoneReady: false,
      hasDiagnosis: false,
    });

    expect(summary.readyCount).toBe(1);
    expect(summary.complete).toBe(false);
    expect(summary.steps).toEqual([
      {
        id: "azure",
        label: "评分密钥",
        ready: true,
        actionHref: undefined,
      },
      {
        id: "microphone",
        label: "麦克风",
        ready: false,
      },
      {
        id: "diagnosis",
        label: "诊断档案",
        ready: false,
        actionHref: "/assessment",
      },
    ]);
  });
});
