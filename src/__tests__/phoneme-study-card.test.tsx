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
  wordAudioError,
  chartAudioError,
}: {
  phoneme: PhonemeData;
  currentWord: { word: string; ipa: string; stressText?: string };
  wordAudioError?: string | null;
  chartAudioError?: string | null;
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
      wordAudioError={wordAudioError}
      chartAudioError={chartAudioError}
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
      screen.getByRole("button", { name: "播放规则句子发音" }),
    ).toHaveAttribute("data-smoke", "practice-word-audio");
    expect(
      screen.queryByRole("button", { name: "播放单词发音" }),
    ).not.toBeInTheDocument();

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

  it("labels long Russian rule playback as a sentence and keeps the full text visible", () => {
    const russianStressUnit = getLanguagePhonemeBySlug(
      "ru-RU",
      "ru-stress-reduction",
    );

    expect(russianStressUnit).toBeDefined();
    if (!russianStressUnit) return;

    renderCard({
      phoneme: russianStressUnit,
      currentWord: {
        word: "Здравствуйте, встретиться с сестрой трудно.",
        ipa: "/ˈzdrastvʊjtʲe ˈfstrʲetʲɪt͡sə s sʲɪˈstroj ˈtrudnə/",
      },
    });

    const fullTask = screen.getByText(
      "Здравствуйте, встретиться с сестрой трудно.",
    );
    expect(fullTask).toBeInTheDocument();
    expect(fullTask).toHaveClass("break-words");
    expect(fullTask).toHaveClass("text-center");
    expect(fullTask).not.toHaveClass("truncate");

    expect(
      screen.getByRole("button", { name: "播放规则句子发音" }),
    ).toHaveAttribute("data-smoke", "practice-word-audio");
    expect(
      screen.queryByRole("button", { name: "播放单词发音" }),
    ).not.toBeInTheDocument();
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

  it("shows non-English missing local audio errors below the practice controls", () => {
    renderCard({
      phoneme: spanishRhythmUnit,
      currentWord: {
        word: "perdon",
        ipa: "/peɾˈdon/",
      },
      wordAudioError: "暂无「perdon」的本地标准发音。",
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("暂无「perdon」的本地标准发音。");
    expect(alert).toHaveAttribute("data-smoke", "practice-word-audio-error");
    expect(alert).toHaveClass("break-words");
    expect(alert).toHaveClass("[overflow-wrap:anywhere]");
  });

  it("shows English dictionary fallback errors below the practice controls", () => {
    renderCard({
      phoneme: {
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
      },
      currentWord: { word: "cat", ipa: "/kaet/" },
      wordAudioError: "在线发音兜底失败，请检查网络后重试。",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "在线发音兜底失败，请检查网络后重试。",
    );
    expect(screen.getByRole("alert")).toHaveClass("break-words");
    expect(screen.getByRole("alert")).toHaveClass("[overflow-wrap:anywhere]");
  });

  it("shows chart illustration audio errors below the English practice controls", () => {
    renderCard({
      phoneme: {
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
      },
      currentWord: { word: "cat", ipa: "/kaet/" },
      chartAudioError:
        "本地音频加载失败：发布包音频可能缺失或被系统拦截，请重新安装应用。",
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-smoke", "practice-chart-audio-error");
    expect(alert).toHaveTextContent("本地音频加载失败");
    expect(alert).toHaveClass("break-words");
    expect(alert).toHaveClass("[overflow-wrap:anywhere]");
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

    const button = screen.getByRole("button", { name: "播放发音" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-audio-playable", "true");
    expect(button).toHaveAttribute("data-audio-kind", "sound-unit");
    expect(button).toHaveAttribute(
      "data-audio-src",
      "/audio/language-assets/fr-FR/header-clips/fr-schwa.m4a",
    );
    expect(button).toHaveAttribute("data-audio-start-ms", "15");
    expect(button).toHaveAttribute("data-audio-max-duration-ms", "500");
    expect(button).toHaveAttribute("data-audio-fade-out-ms", "60");
  });

  it("shows source-backed inventory details for exact non-English sound units", () => {
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

    const detail = document.querySelector(
      '[data-smoke="phonology-inventory-detail"]',
    );
    expect(detail).toHaveAttribute("data-phonology-layer", "prosody");
    expect(detail).toHaveAttribute("data-tile-policy", "clickable-exact-header");
    expect(detail).toHaveAttribute("data-audio-status", "exact-local-header");
    expect(screen.getByText("实验模块")).toBeInTheDocument();
    expect(screen.getByText("韵律/重音")).toBeInTheDocument();
    expect(screen.getByText("精确短音频")).toBeInTheDocument();
    expect(
      screen.getByText("评分 tile 可播放同源本地短音频。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/法语 e caduc .*可听见/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("待补：仍有 1 项音频/方言/规则证据缺口。"),
    ).toBeInTheDocument();
  });

  it("shows inventory rule guidance for phrase-level units instead of implying single-sound playback", () => {
    const frenchLiaison = getLanguagePhonemeBySlug("fr-FR", "fr-liaison");

    expect(frenchLiaison).toBeDefined();
    if (!frenchLiaison) return;

    renderCard({
      phoneme: frenchLiaison,
      currentWord: {
        word: "les amis",
        ipa: "/lezami/",
      },
    });

    const detail = document.querySelector(
      '[data-smoke="phonology-inventory-detail"]',
    );
    expect(detail).toHaveAttribute(
      "data-phonology-layer",
      "connected-speech-rule",
    );
    expect(detail).toHaveAttribute("data-tile-policy", "rule-guidance-only");
    expect(detail).toHaveAttribute("data-audio-status", "rule-only");
    expect(screen.getByText("语流规则")).toBeInTheDocument();
    expect(screen.getByText("规则说明")).toBeInTheDocument();
    expect(
      screen.getByText("按规则/短语证据训练，不作单音播放。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "播放发音" }),
    ).not.toBeInTheDocument();
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
