import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhonemeCard } from "@/components/phoneme/phoneme-card";
import type { UseAudioPlayerReturn } from "@/hooks/use-audio-player";
import type { PhonemeData } from "@/types/phoneme";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockPlayer(): UseAudioPlayerReturn {
  return {
    isPlaying: false,
    isLoading: false,
    play: vi.fn(),
    playBlob: vi.fn(),
    stop: vi.fn(),
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

    fireEvent.click(screen.getByText("/ae/"));

    expect(player.play).toHaveBeenCalledWith("/audio/ipa/phoneme/cat.mp3", {
      startMs: 25,
      maxDurationMs: 560,
      fadeOutMs: 55,
    });
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

    fireEvent.click(screen.getByText("/e/"));

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

    fireEvent.click(screen.getByText("/e/"));

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

    fireEvent.click(screen.getByText("/e/"));

    expect(player.play).not.toHaveBeenCalled();
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
});
