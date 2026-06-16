import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrillFeedback } from "@/components/drill/drill-feedback";
import type { DrillAttempt, DrillItem } from "@/types/drill";

const longItem: DrillItem = {
  text: "Здравствуйте, встретиться с сестрой трудно.",
  ipa: "/ˈzdrastvʊjtʲe ˈfstrʲetʲɪt͡sə s sʲɪˈstroj ˈtrudnə/",
  phoneme: "ru-clusters",
  description:
    "先保留每个辅音，不要在辅音丛中间加汉语式过渡元音，然后再加快速度。",
};

const failedAttempt: DrillAttempt = {
  attemptNumber: 3,
  passed: false,
  score: {
    pronunciationScore: 58,
    accuracyScore: 60,
    targetScore: 52,
    overallScore: 66,
  },
};

function renderFeedback(audioError?: string) {
  return render(
    <DrillFeedback
      item={longItem}
      index={2}
      total={5}
      attempt={failedAttempt}
      passed={false}
      attemptCount={3}
      maxAttempts={3}
      passThreshold={70}
      onNext={vi.fn()}
      onRetry={vi.fn()}
      onSkip={vi.fn()}
      onPlayReference={vi.fn()}
      audioError={audioError}
    />,
  );
}

describe("DrillFeedback", () => {
  it("keeps long failed-target feedback visible and wraps narrow action buttons", () => {
    renderFeedback();

    const target = screen.getByText(
      "Здравствуйте, встретиться с сестрой трудно.",
    );
    expect(target).toBeInTheDocument();
    expect(target).toHaveClass("break-words");
    expect(target).toHaveClass("text-center");

    const actions = document.querySelector(
      '[data-smoke="drill-feedback-actions"]',
    );
    expect(actions).toHaveClass("flex-wrap");
    expect(actions).toHaveClass("justify-center");
    expect(actions).toHaveClass("max-w-full");

    const decisionActions = document.querySelector(
      '[data-smoke="drill-feedback-decision-actions"]',
    );
    expect(decisionActions).toHaveClass("flex-wrap");
    expect(decisionActions).toHaveClass("justify-center");

    expect(screen.getByRole("button", { name: "再听一遍" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "跳过此词" })).toBeInTheDocument();
  });

  it("keeps long reference-audio errors visible in the feedback card", () => {
    renderFeedback(
      "本地标准示范缓存不可用：这是一个很长的文件系统或网络错误提示，需要在窄窗口内完整换行显示。",
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-smoke", "drill-feedback-audio-error");
    expect(alert).toHaveClass("break-words");
    expect(alert).toHaveClass("[overflow-wrap:anywhere]");
    expect(alert).toHaveTextContent("本地标准示范缓存不可用");
  });
});
