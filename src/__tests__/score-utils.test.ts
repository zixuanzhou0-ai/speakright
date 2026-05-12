import { describe, expect, it } from "vitest";
import {
  getBarColor,
  getScoreBg,
  getScoreColor,
  getScoreLabel,
} from "@/lib/score-utils";

describe("getScoreColor", () => {
  it("returns primary for scores >= 80", () => {
    expect(getScoreColor(80)).toBe("text-primary");
    expect(getScoreColor(100)).toBe("text-primary");
  });

  it("returns yellow for scores 60-79", () => {
    expect(getScoreColor(60)).toContain("yellow");
    expect(getScoreColor(79)).toContain("yellow");
  });

  it("returns red for scores < 60", () => {
    expect(getScoreColor(59)).toContain("red");
    expect(getScoreColor(0)).toContain("red");
  });
});

describe("getBarColor", () => {
  it("returns primary for scores >= 80", () => {
    expect(getBarColor(80)).toBe("bg-primary");
  });

  it("returns yellow for scores 60-79", () => {
    expect(getBarColor(70)).toBe("bg-yellow-500");
  });

  it("returns red for scores < 60", () => {
    expect(getBarColor(40)).toBe("bg-red-500");
  });
});

describe("getScoreBg", () => {
  it("returns primary for scores >= 80", () => {
    expect(getScoreBg(90)).toBe("bg-primary");
  });

  it("returns yellow for scores 60-79", () => {
    expect(getScoreBg(65)).toContain("yellow");
  });

  it("returns red for scores < 60", () => {
    expect(getScoreBg(30)).toContain("red");
  });
});

describe("getScoreLabel", () => {
  it("returns 非常好 for scores >= 90", () => {
    expect(getScoreLabel(90)).toBe("非常好");
    expect(getScoreLabel(100)).toBe("非常好");
  });

  it("returns 不错 for scores 80-89", () => {
    expect(getScoreLabel(80)).toBe("不错");
    expect(getScoreLabel(89)).toBe("不错");
  });

  it("returns 还行 for scores 60-79", () => {
    expect(getScoreLabel(60)).toBe("还行");
    expect(getScoreLabel(79)).toBe("还行");
  });

  it("returns 需加油 for scores < 60", () => {
    expect(getScoreLabel(59)).toBe("需加油");
    expect(getScoreLabel(0)).toBe("需加油");
  });
});
