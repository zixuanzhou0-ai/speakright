import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SentenceResultsColumn } from "@/components/sentences/sentence-results-column";
import type { FeedbackData } from "@/hooks/use-llm-feedback";
import type { FreePracticeTransferSummary } from "@/lib/free-practice-transfer";

const emptyFeedback: FeedbackData = {
  summary: "",
  topIssues: "",
  practiceNow: "",
  priorityFixes: "",
  dimensions: "",
  details: "",
};

function expectBadgeWraps(element: HTMLElement | null) {
  expect(element).not.toBeNull();
  expect(element).toHaveClass("h-auto");
  expect(element).toHaveClass("min-h-5");
  expect(element).toHaveClass("max-w-full");
  expect(element).toHaveClass("whitespace-normal");
  expect(element).toHaveClass("break-words");
  expect(element).toHaveClass("text-center");
  expect(element).toHaveClass("[overflow-wrap:anywhere]");
  expect(element).not.toHaveClass("whitespace-nowrap");
}

describe("SentenceResultsColumn transfer evidence layout", () => {
  it("keeps transfer badges and long pack titles wrap-ready", () => {
    const transferSummary: FreePracticeTransferSummary = {
      generatedAt: 1,
      text: "The thoughtful author thanked three theater teachers.",
      mode: "sentence",
      transferLayer: "spontaneous",
      recorded: true,
      evidences: [
        {
          packId: "s-th",
          packTitle:
            "极长训练包标题：/s/ 与 /θ/ 自由练习迁移证据需要完整显示不能省略",
          levelId: "sentence-ladder",
          targetPhonemes: ["s", "th"],
          matchedWords: [
            "thoughtful",
            "thanked",
            "three",
            "think",
            "mouth",
            "health",
            "path",
            "thick",
          ],
          targetScore: 86,
          overallScore: 91,
          threshold: 80,
          passed: true,
          source: "review",
          reason:
            "这条迁移证据来自一个很长的复习理由，也需要在窄窗口完整换行展示。",
          nextCue: "把舌尖收回齿后，不要用 /s/ 替代 /θ/。",
          patternIds: ["s-th"],
        },
      ],
    };

    render(
      <SentenceResultsColumn
        hasResult
        result={null}
        selectedWord={null}
        stressedSyllables={[]}
        onWordClick={vi.fn()}
        feedback={emptyFeedback}
        isStreaming={false}
        hasFeedback={false}
        llmError={null}
        transferSummary={transferSummary}
      />,
    );

    expect(
      screen.getByText(
        "极长训练包标题：/s/ 与 /θ/ 自由练习迁移证据需要完整显示不能省略",
      ),
    ).toHaveClass("break-words");
    expect(
      screen.getByText(
        "这条迁移证据来自一个很长的复习理由，也需要在窄窗口完整换行展示。",
      ),
    ).toHaveClass("break-words");
    expectBadgeWraps(
      document.querySelector(
        '[data-smoke="free-practice-transfer-status-badge"]',
      ),
    );
    expectBadgeWraps(
      document.querySelector(
        '[data-smoke="free-practice-transfer-score-badge"]',
      ),
    );
    const matchedWords = document.querySelector(
      '[data-smoke="free-practice-transfer-matched-words"]',
    );
    expect(matchedWords).not.toBeNull();
    expect(matchedWords).toHaveTextContent(
      "thoughtful, thanked, three, think, mouth, health, path, thick",
    );
    expect(matchedWords).toHaveClass("text-center");
    expect(matchedWords).not.toHaveClass("truncate");
  });
});
