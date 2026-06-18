import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrillPhonemeLesson } from "@/components/drill/drill-phoneme-lesson";
import type { PhonemeData } from "@/types/phoneme";

vi.mock("@/components/phoneme/video-player", () => ({
  VideoPlayer: () => <div data-testid="video-player" />,
}));

vi.mock("@/components/phoneme/phoneme-play-button", () => ({
  PhonemePlayButton: () => <button type="button">播放发音</button>,
}));

const phraseUnit: PhonemeData = {
  languageId: "fr-FR",
  ipa: "enchaînement",
  symbol: "enchaînement",
  slug: "fr-enchainement",
  name: "French enchaînement",
  category: "prosody",
  soundUnitType: "connected-speech-rule",
  example: "il arrive",
  difficulty: "medium",
  description: "前一个词尾辅音接到下一个元音开头词上。",
  keywords: Array.from({ length: 8 }, (_, index) => ({
    word: `phrase example ${index + 1}`,
    ipa: `/example-${index + 1}/`,
  })),
};

describe("DrillPhonemeLesson", () => {
  it("shows every keyword example and uses a text-safe label", () => {
    const onPlayExample = vi.fn();

    render(
      <DrillPhonemeLesson
        phoneme={phraseUnit}
        itemCount={5}
        kind="sentence"
        onReady={vi.fn()}
        onPlayExample={onPlayExample}
        isPlayingExample={false}
        isLoadingExample={false}
      />,
    );

    expect(screen.getByText("示例文本（点击听发音）")).toBeInTheDocument();
    expect(
      document.querySelectorAll('[data-smoke="drill-lesson-example"]'),
    ).toHaveLength(8);

    for (const entry of phraseUnit.keywords) {
      expect(screen.getByText(entry.word)).toBeInTheDocument();
      expect(screen.getByText(entry.ipa)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByText("phrase example 8"));

    expect(onPlayExample).toHaveBeenCalledWith("phrase example 8");
  });
});
