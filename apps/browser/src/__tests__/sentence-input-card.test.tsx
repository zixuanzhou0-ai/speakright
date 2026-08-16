import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SentenceInputCard } from "@/components/sentences/sentence-input-card";
import type { FreePracticeTargetPreview } from "@/lib/free-practice-transfer";
import type { LanguageId } from "@/types/language";

function renderCard({
  isWordMode = false,
  sentence = "I want to practice this sentence clearly.",
  languageId = "en-US",
  ttsError = null,
  ttsHasAudio = false,
  ttsIsLoading = false,
  ttsIsPlaying = false,
  ttsWordTimings = [],
  targetPreview = null,
  hasPlayedWord = false,
}: {
  isWordMode?: boolean;
  sentence?: string;
  languageId?: LanguageId;
  ttsError?: string | null;
  ttsHasAudio?: boolean;
  ttsIsLoading?: boolean;
  ttsIsPlaying?: boolean;
  ttsWordTimings?: { word: string; start: number; end: number }[];
  targetPreview?: FreePracticeTargetPreview | null;
  hasPlayedWord?: boolean;
} = {}) {
  return render(
    <SentenceInputCard
      sentence={sentence}
      onSentenceChange={vi.fn()}
      speed={0.85}
      onSpeedChange={vi.fn()}
      languageId={languageId}
      isWordMode={isWordMode}
      trimmedText={sentence}
      wordIpa={isWordMode ? "/ˈpræktɪs/" : null}
      hasPlayedWord={hasPlayedWord}
      wordAudioIsPlaying={false}
      wordAudioIsLoading={false}
      onWordAudioPlay={vi.fn()}
      ttsIsPlaying={ttsIsPlaying}
      ttsIsLoading={ttsIsLoading}
      ttsHasAudio={ttsHasAudio}
      ttsError={ttsError}
      ttsWordTimings={ttsWordTimings}
      ttsCurrentTime={0}
      onTtsReplay={vi.fn()}
      targetPreview={targetPreview}
      onListen={vi.fn()}
    />,
  );
}

function expectBadgeWraps(element: HTMLElement | null) {
  expect(element).toHaveClass("h-auto");
  expect(element).toHaveClass("min-h-5");
  expect(element).toHaveClass("max-w-full");
  expect(element).toHaveClass("whitespace-normal");
  expect(element).toHaveClass("break-words");
  expect(element).toHaveClass("text-center");
  expect(element).toHaveClass("[overflow-wrap:anywhere]");
  expect(element).not.toHaveClass("whitespace-nowrap");
}

describe("SentenceInputCard narrow layout", () => {
  it("keeps untimed TTS text and replay control visible after playback", () => {
    renderCard({ ttsHasAudio: true });

    expect(screen.getByText("I")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重听标准发音" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-smoke="free-practice-tts-output"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重听标准发音" })).toHaveClass(
      "h-11",
      "w-11",
      "sm:h-7",
      "sm:w-7",
    );
    expect(
      document.querySelector('[data-smoke="sentence-input-card"]'),
    ).toHaveAttribute("data-tts-state", "ready");
  });

  it("keeps the input card intact and delegates overflow to the page column", () => {
    renderCard({ ttsHasAudio: true });

    const card = document.querySelector('[data-smoke="sentence-input-card"]');
    expect(card).toHaveClass("shrink-0");
    expect(card).not.toHaveClass("min-h-0");
    expect(card).not.toHaveClass("overflow-hidden");
  });

  it("does not reveal a static output or replay action while audio is still loading", () => {
    renderCard({
      ttsHasAudio: true,
      ttsIsLoading: true,
      ttsWordTimings: [{ word: "Clear", start: 0, end: 0.3 }],
    });

    expect(
      document.querySelector('[data-smoke="free-practice-tts-output"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "重听标准发音" }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-smoke="sentence-input-card"]'),
    ).toHaveAttribute("data-tts-state", "loading");
  });

  it("shows the playback panel as soon as untimed audio really starts", () => {
    renderCard({ ttsIsPlaying: true });

    expect(
      document.querySelector('[data-smoke="free-practice-tts-output"]'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "重听标准发音" }),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-smoke="sentence-input-card"]'),
    ).toHaveAttribute("data-tts-state", "playing");
  });

  it("keeps a 150-character sentence available without clipping the card", () => {
    const sentence = "Clear speech needs patient daily practice. "
      .repeat(4)
      .slice(0, 150);
    renderCard({ sentence, ttsHasAudio: true });

    expect(screen.getByPlaceholderText("输入单词或句子")).toHaveValue(sentence);
    const characterCount = document.querySelector(
      '[data-smoke="free-practice-character-count"]',
    );
    expect(characterCount).toHaveTextContent("150/150");
    expect(characterCount).not.toHaveClass("absolute");
    expect(
      document.querySelector('[data-smoke="sentence-input-card"]'),
    ).toHaveClass("shrink-0");
  });

  it("lets the free-practice input and sentence listen button wrap on narrow widths", () => {
    renderCard();

    const actionRow = document.querySelector(
      '[data-smoke="sentence-input-actions"]',
    );
    expect(actionRow).toHaveClass("flex-wrap");
    expect(actionRow).toHaveClass("justify-center");

    const textareaWrapper =
      screen.getByPlaceholderText("输入单词或句子").parentElement;
    expect(textareaWrapper).toHaveClass("min-w-[min(100%,16rem)]");
    expect(textareaWrapper).toHaveClass("flex-1");

    const listenControl = screen.getByRole("button", { name: "听标准发音" });
    expect(listenControl).toHaveAttribute(
      "data-smoke",
      "free-practice-listen-control",
    );
    expect(listenControl).toHaveClass("self-center");
  });

  it("keeps the word-mode listen control accessible when the row wraps", () => {
    renderCard({ isWordMode: true, sentence: "practice" });

    const listenControl = screen.getByRole("button", { name: "播放单词发音" });
    expect(listenControl).toHaveAttribute(
      "data-smoke",
      "free-practice-listen-control",
    );
    expect(
      document.querySelector('[data-smoke="sentence-input-actions"]'),
    ).toHaveClass("flex-wrap");
  });

  it("shows the current sentence TTS provider as a direct settings shortcut", () => {
    renderCard();

    expect(screen.getByRole("textbox", { name: "练习文本" })).toBeInTheDocument();
    const shortcut = screen.getByRole("link", {
      name: "当前标准示范为 ElevenLabs，前往更换",
    });
    expect(shortcut).toHaveAttribute(
      "href",
      "/settings?section=services#standard-tts",
    );
    expect(shortcut).toHaveClass("min-h-11", "sm:min-h-9");
    expect(
      document.querySelector(
        '[data-smoke="free-practice-tts-provider-shortcut"]',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "语速" })).toBeInTheDocument();
  });

  it("gives the word replay control a touch-safe size and accessible name", () => {
    renderCard({ isWordMode: true, sentence: "practice", hasPlayedWord: true });

    const replay = screen.getByRole("button", { name: "重听单词发音" });
    expect(replay).toHaveClass("h-11", "w-11", "sm:h-7", "sm:w-7");
    expect(replay).toHaveAttribute(
      "data-smoke",
      "free-practice-word-replay",
    );
  });

  it("does not advertise online dictionary fallback for experimental languages", () => {
    renderCard({
      isWordMode: true,
      languageId: "fr-FR",
      sentence: "bonjour",
    });

    expect(
      screen.getByText(
        "单词模式 · 本地语言包音频优先，无本地条目时不会用在线音频冒充",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("单词模式 · 本地音频优先，有道兜底"),
    ).not.toBeInTheDocument();
  });

  it("marks sentence TTS failures for Browser smoke checks", () => {
    renderCard({
      sentence: "I want to practice this sentence clearly.",
      ttsError: "未配置 ElevenLabs API Key，句子示范暂时不可用。",
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-smoke", "free-practice-tts-error");
    expect(alert).toHaveTextContent(
      "未配置 ElevenLabs API Key，句子示范暂时不可用。",
    );
    expect(
      document.querySelector('[data-smoke="sentence-input-card"]'),
    ).toHaveAttribute("data-tts-state", "error");
  });

  it("keeps long free-practice target preview pack titles wrap-ready", () => {
    renderCard({
      sentence: "The thoughtful author thanked three theater teachers.",
      targetPreview: {
        generatedAt: 1,
        text: "The thoughtful author thanked three theater teachers.",
        targets: [
          {
            packId: "s-th",
            packTitle:
              "极长训练包标题：/s/ 与 /θ/ 在句子迁移里的复习任务需要完整显示",
            levelId: "sentence-ladder",
            targetPhonemes: ["s", "th"],
            matchedWords: ["thoughtful", "thanked", "three"],
            source: "review",
            reason: "review queue",
            priority: "critical",
          },
        ],
        suggestions: [],
      },
    });

    expectBadgeWraps(
      document.querySelector('[data-smoke="free-practice-target-pack-badge"]'),
    );
  });

  it("keeps long free-practice suggestion pack titles and every suggested word visible", () => {
    const suggestedWords = [
      "very",
      "voice",
      "window",
      "away",
      "weather",
      "vivid",
    ];

    renderCard({
      sentence: "I want to practice this sentence clearly.",
      targetPreview: {
        generatedAt: 1,
        text: "I want to practice this sentence clearly.",
        targets: [],
        suggestions: [
          {
            packId: "v-w",
            packTitle:
              "建议训练包：V/W 对比到自由句子迁移的长标题也必须完整换行显示",
            levelId: "word-ladder",
            words: suggestedWords,
            prompt: "Try a sentence with very and window.",
            reason: "active pack",
          },
        ],
      },
    });

    expectBadgeWraps(
      document.querySelector(
        '[data-smoke="free-practice-suggestion-pack-badge"]',
      ),
    );
    const wordBadges = document.querySelectorAll(
      '[data-smoke="free-practice-suggestion-word"]',
    );
    expect(wordBadges).toHaveLength(suggestedWords.length);
    for (const word of suggestedWords) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
    for (const wordBadge of wordBadges) {
      expectBadgeWraps(wordBadge as HTMLElement);
    }
  });
});
