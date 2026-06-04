import { beforeEach, describe, expect, it } from "vitest";
import {
  benchmarkGroupKey,
  encodeBenchmarkAudioBlob,
  exportBenchmarkRecordings,
  listBenchmarkRecordings,
  saveBenchmarkRecording,
  summarizeBenchmarkGroups,
  summarizeBenchmarkTrend,
} from "@/lib/benchmark-archive";

describe("benchmark archive", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("summarizes before/after score trend", () => {
    const trend = summarizeBenchmarkTrend([
      {
        id: "a",
        languageId: "en-US",
        createdAt: 1000,
        source: "prosody",
        title: "first",
        text: "hello",
        score: 68,
        targetLabel: "stress",
      },
      {
        id: "b",
        languageId: "en-US",
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
        languageId: "en-US",
        createdAt: 1000,
        source: "prosody",
        title: "first",
        text: "Hello, world!",
        score: 70,
        targetLabel: "stress",
      },
      {
        id: "b",
        languageId: "en-US",
        createdAt: 2000,
        source: "prosody",
        title: "second",
        text: "hello world",
        score: 80,
        targetLabel: "stress",
      },
      {
        id: "c",
        languageId: "en-US",
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

  it("normalizes target label order for scenario trend grouping", () => {
    const first = benchmarkGroupKey({
      id: "a",
      languageId: "en-US",
      createdAt: 1000,
      source: "scenario",
      title: "scenario",
      text: "I worked late.",
      score: 80,
      targetLabel: "v-w, final-consonants",
    });
    const second = benchmarkGroupKey({
      id: "b",
      languageId: "en-US",
      createdAt: 2000,
      source: "scenario",
      title: "scenario",
      text: "I worked late.",
      score: 85,
      targetLabel: "final-consonants, v-w",
    });

    expect(first).toBe(second);
  });

  it("isolates benchmark recording metadata by language and exports all languages", async () => {
    await saveBenchmarkRecording(
      new Blob(["en"], { type: "audio/webm" }),
      {
        id: "bench-en",
        createdAt: 1_000,
        source: "spontaneous",
        title: "English",
        text: "I think so.",
        score: 86,
        targetLabel: "s-th",
      },
      "en-US",
    );
    await saveBenchmarkRecording(
      new Blob(["es"], { type: "audio/webm" }),
      {
        id: "bench-es",
        createdAt: 2_000,
        source: "spontaneous",
        title: "Spanish",
        text: "pero perro",
        score: 74,
        targetLabel: "es-r",
      },
      "es-ES",
    );

    expect(listBenchmarkRecordings("en-US").map((item) => item.id)).toEqual([
      "bench-en",
    ]);
    expect(listBenchmarkRecordings("es-ES").map((item) => item.id)).toEqual([
      "bench-es",
    ]);
    expect(
      exportBenchmarkRecordings().then((archive) =>
        archive.meta.map((item) => [item.id, item.languageId]),
      ),
    ).resolves.toEqual([
      ["bench-es", "es-ES"],
      ["bench-en", "en-US"],
    ]);
  });

  it("encodes benchmark audio blobs for data export", async () => {
    const encoded = await encodeBenchmarkAudioBlob(
      "bench-1",
      new Blob(["abc"], { type: "audio/webm" }),
    );

    expect(encoded).toEqual({
      id: "bench-1",
      mimeType: "audio/webm",
      bytes: 3,
      dataBase64: "YWJj",
    });
  });
});
