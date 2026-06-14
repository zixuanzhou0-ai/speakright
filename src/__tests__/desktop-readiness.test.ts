import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDesktopReadinessSummary,
  DESKTOP_MIC_CHECK_KEY,
  DESKTOP_MIC_CHECK_MAX_AGE_MS,
  DESKTOP_MIC_MIN_SAMPLE_MS,
  DESKTOP_MIC_MIN_PEAK_LEVEL,
  DESKTOP_MIC_MIN_RMS_LEVEL,
  evaluateDesktopMicSignal,
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
          rmsLevel: 0.025,
          peakLevel: 0.08,
          sampledMs: 1200,
        }),
      ),
    ).toEqual({
      version: 1,
      passedAt: 1000,
      deviceLabel: "Studio Mic",
      rmsLevel: 0.025,
      peakLevel: 0.08,
      sampledMs: 1200,
    });
    expect(parseDesktopMicCheck(null)).toBeNull();
    expect(parseDesktopMicCheck("{bad json")).toBeNull();
    expect(parseDesktopMicCheck(JSON.stringify({ version: 2 }))).toBeNull();
    expect(
      parseDesktopMicCheck(
        JSON.stringify({
          version: 1,
          passedAt: 1000,
          deviceLabel: "Legacy Ready Without Signal",
        }),
      ),
    ).toBeNull();
  });

  it("treats microphone checks as fresh for 30 days", () => {
    const now = 1_000_000;
    const check = {
      version: 1 as const,
      passedAt: now - 1000,
      rmsLevel: 0.02,
      peakLevel: 0.09,
      sampledMs: 1200,
    };
    expect(
      isDesktopMicCheckFresh(check, now),
    ).toBe(true);
    expect(
      isDesktopMicCheckFresh(
        {
          ...check,
          passedAt: now - DESKTOP_MIC_CHECK_MAX_AGE_MS - 1,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isDesktopMicCheckFresh({ ...check, passedAt: now + 1 }, now),
    ).toBe(false);
  });

  it("requires real microphone signal before considering desktop audio ready", () => {
    expect(
      evaluateDesktopMicSignal({
        rmsLevel: DESKTOP_MIC_MIN_RMS_LEVEL,
        peakLevel: 0,
        sampledMs: DESKTOP_MIC_MIN_SAMPLE_MS,
      }),
    ).toEqual({ passed: true });
    expect(
      evaluateDesktopMicSignal({
        rmsLevel: 0,
        peakLevel: DESKTOP_MIC_MIN_PEAK_LEVEL,
        sampledMs: DESKTOP_MIC_MIN_SAMPLE_MS,
      }),
    ).toEqual({ passed: true });
    expect(
      evaluateDesktopMicSignal({
        rmsLevel: 0.001,
        peakLevel: 0.002,
        sampledMs: DESKTOP_MIC_MIN_SAMPLE_MS,
      }),
    ).toEqual({ passed: false, reason: "low-signal" });
    expect(
      evaluateDesktopMicSignal({
        rmsLevel: DESKTOP_MIC_MIN_RMS_LEVEL,
        peakLevel: DESKTOP_MIC_MIN_PEAK_LEVEL,
        sampledMs: DESKTOP_MIC_MIN_SAMPLE_MS - 1,
      }),
    ).toEqual({ passed: false, reason: "too-short" });
  });

  it("saves and reads the latest desktop microphone check", () => {
    saveDesktopMicCheck({
      passedAt: 2000,
      deviceLabel: "USB Mic",
      rmsLevel: 0.02,
      peakLevel: 0.09,
      sampledMs: 1200,
    });

    expect(localStorage.getItem(DESKTOP_MIC_CHECK_KEY)).toContain("USB Mic");
    expect(readDesktopMicCheck(2001)).toEqual({
      version: 1,
      passedAt: 2000,
      deviceLabel: "USB Mic",
      rmsLevel: 0.02,
      peakLevel: 0.09,
      sampledMs: 1200,
    });
  });

  it("refuses to save microphone checks without enough measured signal", () => {
    expect(() =>
      saveDesktopMicCheck({
        rmsLevel: 0.001,
        peakLevel: 0.002,
        sampledMs: DESKTOP_MIC_MIN_SAMPLE_MS,
      }),
    ).toThrow("麦克风输入太低");
    expect(() =>
      saveDesktopMicCheck({
        rmsLevel: DESKTOP_MIC_MIN_RMS_LEVEL,
        peakLevel: DESKTOP_MIC_MIN_PEAK_LEVEL,
        sampledMs: DESKTOP_MIC_MIN_SAMPLE_MS - 1,
      }),
    ).toThrow("麦克风检测时间太短");
    expect(localStorage.getItem(DESKTOP_MIC_CHECK_KEY)).toBeNull();
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
        label: "Azure Speech 评分密钥",
        ready: true,
        actionHref: undefined,
      },
      {
        id: "microphone",
        label: "麦克风检测",
        ready: false,
      },
      {
        id: "diagnosis",
        label: "3 分钟诊断",
        ready: false,
        actionHref: "/assessment",
      },
      {
        id: "training",
        label: "开始今日训练",
        ready: false,
        actionHref: "/drill",
      },
    ]);
  });
});
