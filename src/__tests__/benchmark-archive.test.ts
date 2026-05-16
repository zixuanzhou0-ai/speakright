import { describe, expect, it } from "vitest";
import {
  benchmarkGroupKey,
  summarizeBenchmarkGroups,
  summarizeBenchmarkTrend,
} from "@/lib/benchmark-archive";

describe("benchmark archive", () => {
  it("summarizes before/after score trend", () => {
    const trend = summarizeBenchmarkTrend([
      {
        id: "a",
        createdAt: 1000,
        source: "prosody",
        title: "first",
        text: "hello",
        score: 68,
        targetLabel: "stress",
      },
      {
        id: "b",
        createdAt: 2000,
        source: "prosody",
        title: "second",
        text: "hello",
        score: 82,
        targetLabel: "stress",
      },
    ]);

    expect(trend.latestScore).toBe(82);
    expect(trend.bestScore).toBe(82);
    expect(trend.deltaFromFirst).toBe(14);
    expect(trend.count).toBe(2);
  });

  it("handles empty trend safely", () => {
    expect(summarizeBenchmarkTrend([])).toEqual({
      latestScore: 0,
      bestScore: 0,
      deltaFromFirst: 0,
      count: 0,
    });
  });

  it("groups trends by source, target and normalized text", () => {
    const groups = summarizeBenchmarkGroups([
      {
        id: "a",
        createdAt: 1000,
        source: "prosody",
        title: "first",
        text: "Hello, world!",
        score: 70,
        targetLabel: "stress",
      },
      {
        id: "b",
        createdAt: 2000,
        source: "prosody",
        title: "second",
        text: "hello world",
        score: 80,
        targetLabel: "stress",
      },
      {
        id: "c",
        createdAt: 3000,
        source: "scenario",
        title: "scenario",
        text: "hello world",
        score: 95,
        targetLabel: "stress",
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(
      groups.find((group) => group.source === "prosody")?.trend,
    ).toMatchObject({
      latestScore: 80,
      deltaFromFirst: 10,
      count: 2,
    });
    expect(benchmarkGroupKey(groups[0].recordings[0])).toContain("stress");
  });
});
