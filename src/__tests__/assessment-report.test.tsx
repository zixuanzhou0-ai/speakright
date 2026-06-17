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

  it("wraps report actions so long prescription titles stay visible", () => {
    render(<AssessmentReport result={reportFor("en-US")} onRetake={vi.fn()} />);

    const actions = document.querySelector(
      '[data-smoke="assessment-report-actions"]',
    );
    expect(actions).toHaveClass("flex-wrap");
    expect(actions).toHaveClass("justify-center");
    expect(actions).toHaveClass("max-w-full");

    const primaryAction = document.querySelector(
      '[data-smoke="assessment-report-primary-action"]',
    );
    expect(primaryAction).toHaveClass("whitespace-normal");
    expect(primaryAction).toHaveClass("break-words");
    expect(primaryAction).toHaveClass("text-center");
    expect(primaryAction).toHaveClass("max-w-full");
    expect(screen.getByRole("button", { name: /开始：/ })).toBeInTheDocument();
  });

  it("keeps long diagnosis issue badges and evidence text wrap-ready", () => {
    const result = reportFor("es-ES");
    const longTitle =
      "跨词边界清浊同化与长短语证据需要继续复核 cross-boundary-voicing-assimilation";
    const longPattern =
      "ru-cross-word-voicing-assimilation-before-sonorant-needs-practice";
    result.issues[0] = {
      ...result.issues[0],
      title: longTitle,
      confidence: "medium",
      evidenceStrength: "thin",
      errorPatternIds: [longPattern],
      suspectedSubstitution: "/druɡ doma/ -> /druk doma/",
      impact:
        "这类长短语证据如果被截断，学习者会看不到为什么需要补测或继续练习。",
      fixCue:
        "先完整读出跨词边界，再用短句复查同化位置，不能只看单词末尾。",
      evidence: [
        {
          text: "друг дома",
          score: 58,
          detail:
            "跨词边界证据较薄，需要更多样本确认，而不是把一次结果当成正式 mastery。",
        },
      ],
    };

    render(<AssessmentReport result={result} onRetake={vi.fn()} />);

    const titleNodes = screen.getAllByText(longTitle);
    const titleBadge = titleNodes.find(
      (node) => node.tagName.toLowerCase() === "span",
    );
    const titleHeading = titleNodes.find(
      (node) => node.tagName.toLowerCase() === "h3",
    );
    expect(titleBadge).toHaveClass("h-auto");
    expect(titleBadge).toHaveClass("whitespace-normal");
    expect(titleBadge).toHaveClass("break-words");
    expect(titleBadge).toHaveClass("[overflow-wrap:anywhere]");
    expect(titleBadge).not.toHaveClass("whitespace-nowrap");
    expect(titleHeading).toHaveClass("break-words");
    expect(titleHeading).toHaveClass("[overflow-wrap:anywhere]");

    const patternBadge = screen.getByText(longPattern);
    expect(patternBadge).toHaveClass("h-auto");
    expect(patternBadge).toHaveClass("max-w-full");
    expect(patternBadge).toHaveClass("whitespace-normal");
    expect(patternBadge).toHaveClass("break-words");
    expect(patternBadge).toHaveClass("[overflow-wrap:anywhere]");

    expect(screen.getByText("置信度 medium")).toHaveClass("whitespace-normal");
    expect(screen.getByText("证据 thin")).toHaveClass("whitespace-normal");
    expect(screen.getByText(/跨词边界证据较薄/).parentElement).toHaveClass(
      "break-words",
    );
  });

  it("renders every generated evidence row and error pattern badge", () => {
    const result = reportFor("en-US");
    result.rawEvidence = Array.from({ length: 10 }, (_, index) => ({
      text: `evidence word ${index + 1}`,
      score: 80 - index,
      detail: `第 ${index + 1} 条诊断证据需要完整显示`,
      source: "word",
    }));
    result.issues[0] = {
      ...result.issues[0],
      errorPatternIds: [
        "first-pattern",
        "second-pattern",
        "third-pattern-must-stay-visible",
      ],
    };

    render(<AssessmentReport result={result} onRetake={vi.fn()} />);

    const evidenceRows = document.querySelectorAll(
      '[data-smoke="assessment-report-evidence-row"]',
    );
    expect(evidenceRows).toHaveLength(10);
    expect(screen.getByText("evidence word 9")).toBeInTheDocument();
    expect(screen.getByText("evidence word 10")).toBeInTheDocument();
    expect(screen.getByText("第 10 条诊断证据需要完整显示")).toHaveClass(
      "break-words",
    );
    expect(
      screen.getByText("third-pattern-must-stay-visible"),
    ).toBeInTheDocument();
  });
});
