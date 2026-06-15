import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SentenceRecordingCard } from "@/components/sentences/sentence-recording-card";

function renderCard(localSaveError: string | null) {
  render(
    <SentenceRecordingCard
      sentence="I want to practice clearly."
      isRecording={false}
      elapsedSeconds={0}
      maxDurationSeconds={60}
      audioBlob={new Blob(["audio"], { type: "audio/wav" })}
      stream={null}
      qualityReport={null}
      recorderError={null}
      onRecordStart={vi.fn()}
      onRecordStop={vi.fn()}
      isPlaying={false}
      onReplay={vi.fn()}
      isAssessing={false}
      assessError={null}
      localSaveError={localSaveError}
      result={null}
      onClear={vi.fn()}
      onAssess={vi.fn()}
    />,
  );
}

describe("SentenceRecordingCard local persistence warning", () => {
  it("shows a Chinese alert when free-practice local history cannot be saved", () => {
    renderCard("本次评分已完成，但本机趋势图、练习记录或迁移证据未保存。");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-smoke", "free-practice-local-save-error");
    expect(alert).toHaveTextContent("本次评分已完成");
    expect(alert).toHaveTextContent("未保存");
  });

  it("does not render a local-save alert when there is no persistence warning", () => {
    renderCard(null);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
