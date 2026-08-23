import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadAlongText } from "@/components/audio/read-along-text";
import type { WordTiming } from "@/hooks/use-tts-aligned";

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    useReducedMotion: () => motionPreference.reduced,
  };
});

const wordTimings: WordTiming[] = [
  { word: "echo", start: 0, end: 0.5 },
  { word: "echo", start: 0.5, end: 1 },
  { word: "now", start: 1, end: 1.5 },
];

beforeEach(() => {
  motionPreference.reduced = false;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ReadAlongText playback feedback", () => {
  it("keeps precise word timing states without showing the untimed indicator", () => {
    render(
      <ReadAlongText
        text="echo echo now"
        wordTimings={wordTimings}
        isPlaying
        currentTime={0.75}
      />,
    );

    const root = document.querySelector('[data-smoke="read-along-text"]');
    expect(root).toHaveAttribute("data-playback-mode", "word-timed");
    expect(root).toHaveAttribute("data-playing", "true");
    expect(screen.queryByText("整句播放中")).not.toBeInTheDocument();

    const repeatedWords = screen.getAllByText("echo");
    expect(repeatedWords[0]).toHaveAttribute("data-word-index", "0");
    expect(repeatedWords[0]).toHaveAttribute("data-word-state", "past");
    expect(repeatedWords[1]).toHaveAttribute("data-word-index", "1");
    expect(repeatedWords[1]).toHaveAttribute("data-word-state", "current");
    expect(screen.getByText("now")).toHaveAttribute(
      "data-word-state",
      "future",
    );
  });

  it("shows a Teal whole-sentence state and animated waveform without timings", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ReadAlongText
        text="echo echo clearly"
        wordTimings={[]}
        isPlaying
        currentTime={0}
      />,
    );

    const root = document.querySelector('[data-smoke="read-along-text"]');
    expect(root).toHaveAttribute("data-playback-mode", "sentence-untimed");
    expect(root).toHaveAttribute("data-playing", "true");
    expect(root).toHaveAttribute("data-motion", "full");
    expect(root).toHaveClass("border-primary/30", "bg-primary/5");
    expect(screen.getByRole("status")).toHaveTextContent("整句播放中");

    const bars = document.querySelectorAll(
      '[data-smoke="read-along-waveform-bar"]',
    );
    expect(bars).toHaveLength(4);
    for (const bar of bars) {
      expect(bar).toHaveAttribute("data-motion", "animated");
    }

    const repeatedWords = screen.getAllByText("echo");
    expect(repeatedWords[0]).toHaveAttribute("data-word-index", "0");
    expect(repeatedWords[1]).toHaveAttribute("data-word-index", "1");
    expect(repeatedWords[0]).toHaveAttribute("data-word-state", "speaking");
    expect(repeatedWords[0]).toHaveClass("text-primary");
    const hasDuplicateKeyWarning = errorSpy.mock.calls.some((call) =>
      call.some((value) => String(value).includes("same key")),
    );
    expect(hasDuplicateKeyWarning).toBe(false);
  });

  it("returns untimed text to its static state when playback stops", async () => {
    const view = render(
      <ReadAlongText
        text="Practice the complete sentence"
        wordTimings={[]}
        isPlaying
        currentTime={0}
      />,
    );

    view.rerender(
      <ReadAlongText
        text="Practice the complete sentence"
        wordTimings={[]}
        isPlaying={false}
        currentTime={0}
      />,
    );

    const root = document.querySelector('[data-smoke="read-along-text"]');
    expect(root).toHaveAttribute("data-playing", "false");
    expect(root).not.toHaveClass("border-primary/30", "bg-primary/5");
    expect(screen.getByText("Practice")).toHaveAttribute(
      "data-word-state",
      "future",
    );
    expect(screen.getByText("Practice")).toHaveClass("text-foreground");
    await waitFor(() => {
      expect(screen.queryByText("整句播放中")).not.toBeInTheDocument();
    });
  });

  it("keeps a clear static status when reduced motion is preferred", () => {
    motionPreference.reduced = true;

    render(
      <ReadAlongText
        text="Listen without looping motion"
        wordTimings={[]}
        isPlaying
        currentTime={0}
      />,
    );

    const root = document.querySelector('[data-smoke="read-along-text"]');
    expect(root).toHaveAttribute("data-motion", "reduced");
    expect(screen.getByRole("status")).toHaveTextContent("整句播放中");
    const bars = document.querySelectorAll(
      '[data-smoke="read-along-waveform-bar"]',
    );
    expect(bars).toHaveLength(4);
    for (const bar of bars) {
      expect(bar).toHaveAttribute("data-motion", "static");
    }
  });

  it("reserves mobile and wide-screen safe space for the replay control", () => {
    render(
      <ReadAlongText
        text="A long final line remains readable beside replay"
        wordTimings={[]}
        isPlaying={false}
        currentTime={0}
        reserveReplaySpace
      />,
    );

    const root = document.querySelector('[data-smoke="read-along-text"]');
    expect(root).toHaveAttribute("data-replay-space", "reserved");
    expect(root).toHaveClass("pb-16", "sm:pb-12");
    expect(root).not.toHaveClass("pr-16", "sm:pr-12");
  });
});
