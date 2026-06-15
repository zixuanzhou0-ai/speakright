import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import type { RecordingQualityReport } from "@/lib/recording-quality";

function report(
  overrides: Partial<RecordingQualityReport> = {},
): RecordingQualityReport {
  return {
    durationMs: 1200,
    peak: 0.2,
    rms: 0.04,
    silentRatio: 0.12,
    clippedRatio: 0,
    canSubmit: true,
    score: 92,
    issues: [],
    ...overrides,
  };
}

describe("RecordingQualityPanel", () => {
  it("renders blocker quality failures as an alert with Chinese recovery copy", () => {
    render(
      <RecordingQualityPanel
        report={report({
          canSubmit: false,
          score: 0,
          issues: [
            {
              code: "too-short",
              severity: "blocker",
              title: "录音太短",
              detail: "这段录音短到无法稳定评分，请至少完整读出目标词或句子。",
            },
          ],
        })}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-smoke", "recording-quality-panel");
    expect(alert).toHaveTextContent("建议重录");
    expect(alert).toHaveTextContent("录音太短");
    expect(alert).toHaveTextContent("无法稳定评分");
  });

  it("renders submit-ready quality feedback as status instead of an alert", () => {
    render(
      <RecordingQualityPanel
        report={report({
          issues: [
            {
              code: "low-level",
              severity: "warning",
              title: "音量偏低",
              detail:
                "可以评分，但分数可能偏低；下次靠近麦克风或说得更稳一点。",
            },
          ],
        })}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-smoke", "recording-quality-panel");
    expect(status).toHaveTextContent("可评分，有提示");
    expect(status).toHaveTextContent("音量偏低");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not render anything before a recording quality report exists", () => {
    const { container } = render(<RecordingQualityPanel report={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
