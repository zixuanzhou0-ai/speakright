import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhonemeStudyCard } from "@/components/phoneme/phoneme-study-card";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import { getLanguageProfile } from "@/lib/language-profiles";
import type { PhonemeData } from "@/types/phoneme";

vi.mock("@/components/phoneme/video-player", () => ({
  VideoPlayer: () => <div data-testid="video-player" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const noop = vi.fn();

const spanishRhythmUnit: PhonemeData = {
  languageId: "es-ES",
  ipa: "syllable timing",
  symbol: "syllable timing",
  slug: "es-syllable-rhythm",
  name: "Spanish syllable timing",
  category: "prosody",
  soundUnitType: "prosody",
  example: "Buenos dias",
  keywords: [],
  difficulty: "medium",
};

function renderCard({
  phoneme,
  currentWord,
}: {
  phoneme: PhonemeData;
  currentWord: { word: string; ipa: string; stressText?: string };
}) {
  render(
    <PhonemeStudyCard
      phoneme={phoneme}
      languageProfile={getLanguageProfile(phoneme.languageId ?? "en-US")}
      currentWord={currentWord}
      wordDirection={1}
      wordPoolSize={24}
      practicedCount={3}
      isWordActive={false}
      wordIsLoading={false}
      lastChartPlay="normal"
      onPrevious={noop}
      onNext={noop}
      onSetWordDirection={noop}
      onSetLastChartPlay={noop}
      onPlayWord={noop}
      onPlayChartAudio={noop}
      onStopPlayback={noop}
      onStopWordAudio={noop}
      onStopChartAudio={noop}
      wordHistoryLength={1}
    />,
  );
}

describe("PhonemeStudyCard non-English reading layout", () => {
  it("shows the full non-English reading task without truncating the main text", () => {
    renderCard({
      phoneme: spanishRhythmUnit,
      currentWord: {
        word: "Buenos dias, muchas gracias.",
        ipa: "/ˈbwenos ˈdias ˈmutʃas ˈɣɾaθjas/",
      },
    });

    expect(screen.getByText("请朗读")).toBeInTheDocument();
    expect(screen.getAllByText("规则训练 · 音节节奏").length).toBeGreaterThan(0);
    expect(screen.queryByText("syllable timing")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "播放发音" }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-smoke="practice-voice-selector"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用A声线" })).toHaveAttribute(
      "data-smoke",
      "practice-voice-a",
    );
    expect(screen.getByRole("button", { name: "使用B声线" })).toHaveAttribute(
      "data-smoke",
      "practice-voice-b",
    );
    expect(
      document.querySelector('[data-smoke="practice-word-audio"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "播放单词发音" }),
    ).toHaveAttribute("data-smoke", "practice-word-audio");

    const fullTask = screen.getByText("Buenos dias, muchas gracias.");
    expect(fullTask).toBeInTheDocument();
    expect(fullTask).not.toHaveClass("truncate");
    expect(fullTask).toHaveClass("break-words");
    expect(fullTask).toHaveClass("text-center");
    expect(fullTask).toHaveStyle({ textAlign: "center" });

    const ipa = screen.getByText("/ˈbwenos ˈdias ˈmutʃas ˈɣɾaθjas/");
    expect(ipa).toBeInTheDocument();
    expect(ipa).toHaveClass("text-center");
    expect(ipa).toHaveStyle({ textAlign: "center" });
  });

  it("hides proxy header audio for non-English rule units", () => {
    const russianFinalDevoicing = getLanguagePhonemeBySlug(
      "ru-RU",
      "ru-final-devoicing",
    );

    expect(russianFinalDevoicing).toBeDefined();
    if (!russianFinalDevoicing) return;

    renderCard({
      phoneme: russianFinalDevoicing,
      currentWord: {
        word: "друг",
        ipa: "/druk/",
      },
    });

    expect(screen.queryByTestId("video-player")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "播放发音" }),
    ).not.toBeInTheDocument();
  });

  it("keeps exact local header audio for non-English units with target assets", () => {
    const frenchSchwa = getLanguagePhonemeBySlug("fr-FR", "fr-schwa");

    expect(frenchSchwa).toBeDefined();
    if (!frenchSchwa) return;

    renderCard({
      phoneme: frenchSchwa,
      currentWord: {
        word: "ce matin",
        ipa: "/sə matɛ̃/",
      },
    });

    expect(screen.getByRole("button", { name: "播放发音" })).toBeInTheDocument();
  });

  it("passes boosted chart-word playback options from the English detail illustration", () => {
    const onPlayChartAudio = vi.fn();
    render(
      <PhonemeStudyCard
        phoneme={{
          languageId: "en-US",
          ipa: "/ae/",
          symbol: "ae",
          slug: "ae",
          name: "AA",
          category: "vowel",
          example: "cat",
          chartWord: "cat",
          chartImage: "cat",
          keywords: [{ word: "cat", ipa: "/kaet/" }],
          difficulty: "medium",
        }}
        languageProfile={getLanguageProfile("en-US")}
        currentWord={{ word: "cat", ipa: "/kaet/" }}
        wordDirection={1}
        wordPoolSize={24}
        practicedCount={3}
        isWordActive={false}
        wordIsLoading={false}
        lastChartPlay="normal"
        onPrevious={noop}
        onNext={noop}
        onSetWordDirection={noop}
        onSetLastChartPlay={noop}
        onPlayWord={noop}
        onPlayChartAudio={onPlayChartAudio}
        onStopPlayback={noop}
        onStopWordAudio={noop}
        onStopChartAudio={noop}
        wordHistoryLength={1}
      />,
    );

    fireEvent.click(screen.getByAltText("cat"));

    expect(onPlayChartAudio).toHaveBeenCalledWith(
      "/audio/ipa/slow/cat.mp3",
      { volume: 1.6 },
    );
  });
});
