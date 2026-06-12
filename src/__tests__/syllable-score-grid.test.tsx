import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyllableScoreGrid } from "@/components/scoring/syllable-score-grid";

describe("SyllableScoreGrid", () => {
  it("shows explicit syllable scores and stress status", () => {
    render(
      <SyllableScoreGrid
        syllables={[
          { syllable: "ka", accuracyScore: 97, stress: "primary" },
          { syllable: "sa", accuracyScore: 88 },
        ]}
      />,
    );

    expect(screen.getByText("ˈka")).toBeInTheDocument();
    expect(screen.getByText("97")).toBeInTheDocument();
    expect(screen.getByText("sa")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("主重音")).toBeInTheDocument();
    expect(screen.getByText("重音未标注")).toBeInTheDocument();
  });

  it("explains when Azure returned syllable scores without stress labels", () => {
    render(
      <SyllableScoreGrid
        syllables={[
          { syllable: "ka", accuracyScore: 97 },
          { syllable: "sa", accuracyScore: 88 },
        ]}
      />,
    );

    expect(
      screen.getByText("Azure 音节分数；重音未标注。"),
    ).toBeInTheDocument();
  });
});
