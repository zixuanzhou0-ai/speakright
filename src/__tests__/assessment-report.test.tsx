import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssessmentReport } from "@/components/assessment/assessment-report";
import type { DiagnosisReport } from "@/types/diagnosis";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/assessment/phoneme-health-map", () => ({
  PhonemeHealthMap: () => <div data-testid="phoneme-health-map" />,
}));

vi.mock("@/lib/mastery-profile", () => ({
  loadMasteryProfile: () => null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function reportFor(languageId: DiagnosisReport["languageId"]): DiagnosisReport {
  return {
    version: 2,
    languageId,
    source: "quick-word-check",
    timestamp: 1_718_000_000_000,
    overallScore: 72,
    scoreStatus: "scored",
    dimensions: {
      vowels: 72,
      consonants: 74,
      stress: 65,
      rhythm: 68,
      fluency: 80,
      connectedSpeech: 70,
    },
    phonemeScores: {
      th: { score: 62, sampleCount: 2 },
    },
    issues: [
      {
        id: `${languageId ?? "en-US"}:test-issue`,
        severity: "major",
        type: "phoneme",
        title: "目标音需要巩固",
        targetPhonemes: ["th"],
        evidence: [{ text: "think", score: 62, detail: "目标音偏低" }],
        impact: "会影响清晰度。",
        fixCue: "先慢速复述，再进入短句。",
        recommendedPackIds: ["s-th"],
        confidence: "medium",
        evidenceStrength: "fair",
      },
    ],
    prescription: {
      generatedAt: 1_718_000_000_000,
      source: "diagnosis",
      days: [
        {
          day: 1,
          title: "第 1 天",
          items: [
            {
              packId: "s-th",
              levelId: "sentence-bridge",
              reason: "诊断命中目标音",
              priority: "major",
              estimatedMinutes: 8,
              currentMasteryState: "controlled",
              nextRequiredLayer: "sentence",
              stageScore: 3,
              stageCeiling: 5,
              learningObjective: "把目标音放回短句。",
            },
          ],
        },
      ],
    },
    rawEvidence: [],
  };
}

describe("AssessmentReport mastery display", () => {
  it("keeps formal mastery badges visible for English diagnosis reports", () => {
    render(<AssessmentReport result={reportFor("en-US")} onRetake={vi.fn()} />);

    expect(screen.getByText("阶段 可控")).toBeInTheDocument();
    expect(screen.getByText("下一层 句子整合")).toBeInTheDocument();
    expect(screen.getByText("阶段分 3/5")).toBeInTheDocument();
    expect(
      screen.queryByText("experimental 练习观察"),
    ).not.toBeInTheDocument();
  });

  it("does not present formal mastery stages for experimental language diagnosis reports", () => {
    render(<AssessmentReport result={reportFor("es-ES")} onRetake={vi.fn()} />);

    expect(screen.getByText("experimental 练习观察")).toBeInTheDocument();
    expect(
      screen.getByText(/不生成正式 mastery/),
    ).toBeInTheDocument();
    expect(screen.queryByText("阶段 可控")).not.toBeInTheDocument();
    expect(screen.queryByText("下一层 句子整合")).not.toBeInTheDocument();
    expect(screen.queryByText("阶段分 3/5")).not.toBeInTheDocument();
    expect(screen.getByText("置信度 medium")).toBeInTheDocument();
    expect(screen.getByText("证据 fair")).toBeInTheDocument();
  });
});
