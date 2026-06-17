import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhonemeCard } from "@/components/phoneme/phoneme-card";
import type { UseAudioPlayerReturn } from "@/hooks/use-audio-player";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import type { PhonemeData } from "@/types/phoneme";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockPlayer(): UseAudioPlayerReturn {
  return {
    isPlaying: false,
    isLoading: false,
    error: null,
    play: vi.fn(),
    playBlob: vi.fn(),
    stop: vi.fn(),
    clearError: vi.fn(),
  };
}

function phoneme(overrides: Partial<PhonemeData> = {}): PhonemeData {
  return {
    ipa: "/ae/",
    symbol: "ae",
    slug: "ae",
    name: "AA",
    category: "vowel",
    example: "cat",
    keywords: [{ word: "cat", ipa: "/kaet/" }],
    difficulty: "medium",
    description: "Test sound",
    ...overrides,
  };
}

function expectHeaderAudioMetadata(
  element: Element | null,
  expected: {
    kind: "chart" | "sound-unit";
    src: string;
    startMs: string;
    maxDurationMs: string;
    fadeOutMs: string;
  },
) {
  expect(element).toHaveAttribute("data-audio-playable", "true");
  expect(element).toHaveAttribute("data-audio-kind", expected.kind);
  expect(element).toHaveAttribute("data-audio-src", expected.src);
  expect(element).toHaveAttribute("data-audio-start-ms", expected.startMs);
  expect(element).toHaveAttribute(
    "data-audio-max-duration-ms",
    expected.maxDurationMs,
  );
  expect(element).toHaveAttribute("data-audio-fade-out-ms", expected.fadeOutMs);
  expect(element).toHaveAttribute("aria-disabled", "false");
}

function expectHeaderAudioLocked(element: Element) {
  expect(element).toHaveAttribute("data-audio-playable", "false");
  expect(element).toHaveAttribute("data-audio-kind", "none");
  expect(element).toHaveAttribute("data-audio-src", "");
  expect(element).toHaveAttribute("data-audio-start-ms", "");
  expect(element).toHaveAttribute("data-audio-max-duration-ms", "");
  expect(element).toHaveAttribute("data-audio-fade-out-ms", "");
  expect(element).toHaveAttribute("aria-disabled", "true");
  expect(element).toHaveAttribute("tabindex", "-1");
  expect(element).not.toHaveAttribute("role", "button");
}

describe("PhonemeCard header audio", () => {
  it("uses one-shot playback options when the IPA symbol plays English chart audio", () => {
    const player = mockPlayer();
    render(
      <PhonemeCard
        player={player}
        phoneme={phoneme({
          chartWord: "cat",
          chartIpa: "/kaet/",
        })}
      />,
    );

    const ipa = screen.getByText("/ae/");
    expectHeaderAudioMetadata(ipa, {
      kind: "chart",
      src: "/audio/ipa/phoneme/cat.mp3",
      startMs: "25",
      maxDurationMs: "560",
      fadeOutMs: "55",
    });
    expect(ipa).toHaveAttribute("data-smoke", "phoneme-card-ipa-audio");
    expect(ipa).toHaveAttribute("role", "button");
    expect(ipa).toHaveAttribute("tabindex", "0");

    const speaker = document.querySelector(
      '[data-smoke="phoneme-card-header-audio-button"]',
    );
    expectHeaderAudioMetadata(speaker, {
      kind: "chart",
      src: "/audio/ipa/phoneme/cat.mp3",
      startMs: "25",
      maxDurationMs: "560",
      fadeOutMs: "55",
    });

    fireEvent.click(ipa);

    expect(player.play).toHaveBeenCalledWith("/audio/ipa/phoneme/cat.mp3", {
      startMs: 25,
      maxDurationMs: 560,
      fadeOutMs: 55,
    });
  });

  it("does not expose unsafe English chart-word stems from the list card", () => {
    const player = mockPlayer();
    render(
      <PhonemeCard
        player={player}
        phoneme={phoneme({
          chartWord: "fr-schwa",
          chartImage: "cat",
          chartIpa: "/kaet/",
        })}
      />,
    );

    const ipa = screen.getByText("/ae/");
    expectHeaderAudioLocked(ipa);
    expect(
      document.querySelector('[data-smoke="phoneme-card-header-audio-button"]'),
    ).not.toBeInTheDocument();

    fireEvent.click(ipa);
    fireEvent.click(screen.getByAltText("fr-schwa"));

    expect(player.play).not.toHaveBeenCalled();
  });

  it("uses one-shot playback options for local non-English header clips", () => {
    const player = mockPlayer();
    render(
      <PhonemeCard
        player={player}
        phoneme={phoneme({
          languageId: "fr-FR",
          ipa: "/e/",
          symbol: "fr-e",
          slug: "fr-e",
          example: "ete",
          keywords: [{ word: "ete", ipa: "/ete/" }],
          phonemeAudio: {
            kind: "local",
            label: "French local clip",
            source: "local",
            localSrc: "/audio/language-assets/fr-FR/header-clips/fr-e.m4a",
          },
        })}
      />,
    );

    const ipa = screen.getByText("/e/");
    expectHeaderAudioMetadata(ipa, {
      kind: "sound-unit",
      src: "/audio/language-assets/fr-FR/header-clips/fr-e.m4a",
      startMs: "15",
      maxDurationMs: "500",
      fadeOutMs: "60",
    });
    const speaker = document.querySelector(
      '[data-smoke="phoneme-card-header-audio-button"]',
    );
    expectHeaderAudioMetadata(speaker, {
      kind: "sound-unit",
      src: "/audio/language-assets/fr-FR/header-clips/fr-e.m4a",
      startMs: "15",
      maxDurationMs: "500",
      fadeOutMs: "60",
    });

    fireEvent.click(ipa);

    expect(player.play).toHaveBeenCalledWith(
      "/audio/language-assets/fr-FR/header-clips/fr-e.m4a",
      {
        startMs: 15,
        maxDurationMs: 500,
        fadeOutMs: 60,
      },
    );
  });

  it("does not play video-backed sources from the IPA symbol", () => {
    const player = mockPlayer();
    render(
      <PhonemeCard
        player={player}
        phoneme={phoneme({
          languageId: "fr-FR",
          ipa: "/e/",
          symbol: "fr-e",
          slug: "fr-e",
          example: "ete",
          keywords: [{ word: "ete", ipa: "/ete/" }],
          phonemeAudio: {
            kind: "local",
            label: "Video reference",
            source: "local",
            localSrc: "/videos/language-assets/fr-FR/articulation/fr-e.mp4",
          },
        })}
      />,
    );

    const ipa = screen.getByText("/e/");
    expectHeaderAudioLocked(ipa);
    expect(
      document.querySelector('[data-smoke="phoneme-card-header-audio-button"]'),
    ).not.toBeInTheDocument();

    fireEvent.click(ipa);

    expect(player.play).not.toHaveBeenCalled();
  });

  it("does not play whole-word local sources from the IPA symbol", () => {
    const player = mockPlayer();
    render(
      <PhonemeCard
        player={player}
        phoneme={phoneme({
          languageId: "fr-FR",
          ipa: "/e/",
          symbol: "fr-e",
          slug: "fr-e",
          example: "ete",
          keywords: [{ word: "ete", ipa: "/ete/" }],
          phonemeAudio: {
            kind: "local",
            label: "Language pack word",
            source: "local",
            localSrc: "/audio/language-packs/fr-FR/ete.mp3",
          },
        })}
      />,
    );

    const ipa = screen.getByText("/e/");
    expectHeaderAudioLocked(ipa);
    expect(
      document.querySelector('[data-smoke="phoneme-card-header-audio-button"]'),
    ).not.toBeInTheDocument();

    fireEvent.click(ipa);

    expect(player.play).not.toHaveBeenCalled();
  });

  it("does not present English fallback whole-word audio as clickable IPA header audio", () => {
    const player = mockPlayer();
    render(
      <PhonemeCard
        player={player}
        phoneme={phoneme({
          ipa: "/x/",
          symbol: "x",
          slug: "fallback-word-audio",
          example: "test",
          keywords: [{ word: "test", ipa: "/test/" }],
          phonemeAudio: {
            kind: "local",
            label: "Whole-word fallback",
            source: "local word audio",
            localSrc: "/audio/words/blue/test.mp3",
            languageId: "en-US",
          },
        })}
      />,
    );

    const ipa = screen.getByText("/x/");
    expect(ipa).toHaveClass("cursor-default");
    expect(ipa).not.toHaveClass("cursor-pointer");
    expectHeaderAudioLocked(ipa);
    expect(
      document.querySelector('[data-smoke="phoneme-card-header-audio-button"]'),
    ).not.toBeInTheDocument();

    fireEvent.click(ipa);

    expect(player.play).not.toHaveBeenCalled();
  });

  it("plays verified header audio from the keyboard with the same one-shot policy", () => {
    const player = mockPlayer();
    render(
      <PhonemeCard
        player={player}
        phoneme={phoneme({
          chartWord: "cat",
          chartIpa: "/kaet/",
        })}
      />,
    );

    fireEvent.keyDown(screen.getByText("/ae/"), { key: " " });

    expect(player.play).toHaveBeenCalledWith("/audio/ipa/phoneme/cat.mp3", {
      startMs: 25,
      maxDurationMs: 560,
      fadeOutMs: 55,
    });
  });

  it("uses boosted chart-word playback options when the illustration plays normal or slow word audio", () => {
    const player = mockPlayer();
    render(
      <PhonemeCard
        player={player}
        phoneme={phoneme({
          chartWord: "cat",
          chartImage: "cat",
          chartIpa: "/kaet/",
        })}
      />,
    );

    fireEvent.click(screen.getByAltText("cat"));

    expect(player.play).toHaveBeenCalledWith("/audio/ipa/normal/cat.mp3", {
      volume: 1.6,
    });
  });

  it("shows experimental phonology inventory badges for non-English realization units", () => {
    const player = mockPlayer();
    const spanishBv = getLanguagePhonemeBySlug("es-ES", "es-bv");
    expect(spanishBv).toBeDefined();
    if (!spanishBv) return;

    render(<PhonemeCard player={player} phoneme={spanishBv} />);

    const badges = document.querySelector(
      '[data-smoke="phonology-inventory-card-badges"]',
    );
    expect(badges).toHaveAttribute("data-phonology-layer", "allophone");
    expect(badges).toHaveAttribute("data-tile-policy", "clickable-exact-header");
    expect(screen.getByText("实验")).toBeInTheDocument();
    expect(screen.getByText("实现音")).toBeInTheDocument();
    expect(screen.getByText("精确短音频")).toBeInTheDocument();
  });

  it("shows rule inventory badges without implying playable single-sound audio", () => {
    const player = mockPlayer();
    const spanishStress = getLanguagePhonemeBySlug("es-ES", "es-lexical-stress");
    expect(spanishStress).toBeDefined();
    if (!spanishStress) return;

    render(<PhonemeCard player={player} phoneme={spanishStress} />);

    const badges = document.querySelector(
      '[data-smoke="phonology-inventory-card-badges"]',
    );
    expect(badges).toHaveAttribute("data-phonology-layer", "prosody");
    expect(badges).toHaveAttribute("data-tile-policy", "rule-guidance-only");
    expect(screen.getByText("韵律/重音")).toBeInTheDocument();
    expect(screen.getByText("规则说明")).toBeInTheDocument();
    expect(
      document.querySelector('[data-smoke="phoneme-card-header-audio-button"]'),
    ).not.toBeInTheDocument();
  });
});
