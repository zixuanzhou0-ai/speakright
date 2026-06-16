import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isScoringTileAudioPlayable,
  PhonemeHighlight,
} from "@/components/scoring/phoneme-highlight";

type MockHowlInstance = {
  play: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  fade: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  unload: ReturnType<typeof vi.fn>;
};

const howlerMock = vi.hoisted(() => ({
  Howl: vi.fn(),
  instances: [] as MockHowlInstance[],
}));

vi.mock("howler", () => ({
  Howl: howlerMock.Howl,
}));

beforeEach(() => {
  howlerMock.instances.length = 0;
  howlerMock.Howl.mockImplementation(function MockHowl(options: {
    onstop?: () => void;
  }) {
    const instance: MockHowlInstance = {
      play: vi.fn(() => 9),
      seek: vi.fn(),
      fade: vi.fn(),
      stop: vi.fn(() => options.onstop?.()),
      unload: vi.fn(),
    };
    howlerMock.instances.push(instance);
    return instance;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PhonemeHighlight", () => {
  it("refuses video-backed scoring tile audio urls as a final playback guard", () => {
    expect(
      isScoringTileAudioPlayable(
        "/videos/language-assets/fr-FR/schwa-reference.mp4",
      ),
    ).toBe(false);
    expect(
      isScoringTileAudioPlayable(
        "/videos/language-assets/es-ES/rhythm-reference.webm?clip=1",
      ),
    ).toBe(false);
    expect(
      isScoringTileAudioPlayable(
        "/videos/language-assets/ru-RU/cluster-reference.m4v",
      ),
    ).toBe(false);
    expect(
      isScoringTileAudioPlayable(
        "/audio/language-assets/es-ES/header-clips/es-a.m4a",
      ),
    ).toBe(true);
    expect(
      isScoringTileAudioPlayable("https://example.com/audio/es-a.m4a"),
    ).toBe(false);
  });

  it("shows the target IPA reference for non-English phrase breakdowns", () => {
    render(
      <PhonemeHighlight
        languageId="fr-FR"
        expectedText="Trop grand, trop lent, trop fort."
        expectedIpa="/tʁo gʁɑ̃ tʁo lɑ̃ tʁo fɔʁ/"
        phonemes={[
          { phoneme: "t", accuracyScore: 72 },
          { phoneme: "ʁ", accuracyScore: 70 },
        ]}
      />,
    );

    expect(screen.getByText("目标 IPA 参考")).toBeInTheDocument();
    expect(
      screen.getByText("Trop grand, trop lent, trop fort."),
    ).toBeInTheDocument();
    expect(screen.getByText("/tʁo gʁɑ̃ tʁo lɑ̃ tʁo fɔʁ/")).toBeInTheDocument();
    expect(screen.getByText(/下方是本次录音识别到的片段/)).toBeInTheDocument();
  });

  it("exposes scoring tile short-audio policy metadata for release smoke", () => {
    render(
      <PhonemeHighlight
        languageId="es-ES"
        phonemes={[
          { phoneme: "a", accuracyScore: 72 },
          { phoneme: "θ", accuracyScore: 68 },
        ]}
      />,
    );

    const tiles = document.querySelectorAll(
      '[data-smoke="assessment-phoneme-tile"]',
    );

    expect(tiles).toHaveLength(2);
    for (const tile of tiles) {
      expect(tile).toHaveAttribute("data-audio-playable", "true");
      expect(tile).toHaveAttribute("aria-disabled", "false");
      expect(tile.getAttribute("aria-label")).toContain("播放音标");
      expect(tile).toHaveAttribute("data-audio-kind", "sound-unit");
      expect(tile.getAttribute("data-audio-src")).toContain(
        "/audio/language-assets/es-ES/header-clips/",
      );
      expect(
        Number(tile.getAttribute("data-audio-max-duration-ms")),
      ).toBeGreaterThan(0);
      expect(
        Number(tile.getAttribute("data-audio-max-duration-ms")),
      ).toBeLessThanOrEqual(560);
      expect(
        Number(tile.getAttribute("data-audio-fade-out-ms")),
      ).toBeGreaterThan(0);
      expect(tile.getAttribute("data-audio-src")).not.toMatch(
        /\.(mp4|m4v|webm)(?:$|\?)/i,
      );
    }
  });

  it("shows Spanish nasal assessment segments as visible but unclickable /n/ tiles", () => {
    render(
      <PhonemeHighlight
        languageId="es-ES"
        expectedText="canción"
        expectedIpa="/kanˈθjon/"
        phonemes={[
          { phoneme: "k", accuracyScore: 77 },
          { phoneme: "a", accuracyScore: 79 },
          { phoneme: "n", accuracyScore: 50 },
          { phoneme: "θ", accuracyScore: 52 },
          { phoneme: "j", accuracyScore: 83 },
          { phoneme: "o", accuracyScore: 81 },
          { phoneme: "n", accuracyScore: 46 },
        ]}
      />,
    );

    expect(screen.getByText("有本地音频的片段可点击")).toHaveAttribute(
      "data-smoke",
      "assessment-phoneme-audio-hint",
    );
    expect(screen.queryByText("点击可听发音")).not.toBeInTheDocument();
    expect(screen.getAllByText("/n/")).toHaveLength(2);
    expect(screen.queryByText(/m n/)).not.toBeInTheDocument();

    const nasalTiles = Array.from(
      document.querySelectorAll('[aria-label="播放音标 /n/"]'),
    );
    expect(nasalTiles).toHaveLength(0);

    const visibleNasalTiles = screen
      .getAllByText("/n/")
      .map((label) => label.closest('[data-smoke="assessment-phoneme-tile"]'));
    for (const tile of visibleNasalTiles) {
      expect(tile).toHaveAttribute("data-audio-playable", "false");
      expect(tile).toHaveAttribute("aria-disabled", "true");
      expect(tile).toHaveAttribute("data-audio-kind", "none");
      expect(tile?.getAttribute("data-audio-src")).toBe("");
    }
  });

  it("uses exact Spanish header clips for every clickable canción tile", () => {
    render(
      <PhonemeHighlight
        languageId="es-ES"
        expectedText="canción"
        expectedIpa="/kanˈθjon/"
        phonemes={[
          { phoneme: "k", accuracyScore: 77 },
          { phoneme: "a", accuracyScore: 73 },
          { phoneme: "n", accuracyScore: 46 },
          { phoneme: "θ", accuracyScore: 35 },
          { phoneme: "j", accuracyScore: 69 },
          { phoneme: "o", accuracyScore: 88 },
          { phoneme: "n", accuracyScore: 66 },
        ]}
      />,
    );

    const exactSources = [
      ["播放音标 /a/", "/audio/language-assets/es-ES/header-clips/es-a.m4a"],
      [
        "播放音标 /θ/",
        "/audio/language-assets/es-ES/header-clips/es-theta.m4a",
      ],
      [
        "播放音标 /j/",
        "/audio/language-assets/es-ES/header-clips/es-diphthongs-j.m4a",
      ],
      ["播放音标 /o/", "/audio/language-assets/es-ES/header-clips/es-o.m4a"],
    ] as const;

    for (const [ariaLabel, source] of exactSources) {
      const tile = document.querySelector(`[aria-label="${ariaLabel}"]`);
      expect(tile, ariaLabel).not.toBeNull();
      expect(tile).toHaveAttribute("data-audio-kind", "sound-unit");
      expect(tile?.getAttribute("data-audio-src")).toBe(source);
      expect(tile?.getAttribute("data-audio-src")).not.toContain(
        "/audio/language-packs/",
      );
      expect(Number(tile?.getAttribute("data-audio-max-duration-ms"))).toBe(
        500,
      );
    }

    for (const label of ["/k/", "/n/"] as const) {
      const tile = screen
        .getAllByText(label)[0]
        .closest('[data-smoke="assessment-phoneme-tile"]');
      expect(tile).toHaveAttribute("data-audio-playable", "false");
      expect(tile).toHaveAttribute("data-audio-kind", "none");
    }
  });

  it("uses exact French header clips for nasal, glide, and consonant scoring tiles", () => {
    render(
      <PhonemeHighlight
        languageId="fr-FR"
        expectedText="un bon vin blanc"
        expectedIpa="/œ̃ bɔ̃ vɛ̃ blɑ̃/"
        phonemes={[
          { phoneme: "œ̃", accuracyScore: 72 },
          { phoneme: "ɔ̃", accuracyScore: 78 },
          { phoneme: "ɛ̃", accuracyScore: 80 },
          { phoneme: "ɑ̃", accuracyScore: 66 },
          { phoneme: "ʁ", accuracyScore: 70 },
          { phoneme: "ɥ", accuracyScore: 74 },
          { phoneme: "w", accuracyScore: 77 },
        ]}
      />,
    );

    const expectedSources = [
      ["播放音标 /œ̃/", "/audio/language-assets/fr-FR/header-clips/fr-un.m4a"],
      ["播放音标 /ɔ̃/", "/audio/language-assets/fr-FR/header-clips/fr-on.m4a"],
      ["播放音标 /ɛ̃/", "/audio/language-assets/fr-FR/header-clips/fr-in.m4a"],
      ["播放音标 /ɑ̃/", "/audio/language-assets/fr-FR/header-clips/fr-an.m4a"],
      ["播放音标 /ʁ/", "/audio/language-assets/fr-FR/header-clips/fr-r.m4a"],
      [
        "播放音标 /ɥ/",
        "/audio/language-assets/fr-FR/header-clips/fr-glide-hui.m4a",
      ],
      [
        "播放音标 /w/",
        "/audio/language-assets/fr-FR/header-clips/fr-glide-w.m4a",
      ],
    ] as const;

    for (const [ariaLabel, source] of expectedSources) {
      const tile = document.querySelector(`[aria-label="${ariaLabel}"]`);
      expect(tile, ariaLabel).not.toBeNull();
      expect(tile).toHaveAttribute("data-audio-kind", "sound-unit");
      expect(tile?.getAttribute("data-audio-src")).toBe(source);
      expect(tile?.getAttribute("data-audio-src")).not.toContain(
        "/audio/language-packs/",
      );
      expect(Number(tile?.getAttribute("data-audio-max-duration-ms"))).toBe(
        500,
      );
    }
  });

  it("uses exact Russian header clips for affricates and leaves proxy soft/reduction tiles unclickable", () => {
    render(
      <PhonemeHighlight
        languageId="ru-RU"
        expectedText="чай, щи, день"
        expectedIpa="/tɕaj ɕːi dʲenʲ/"
        phonemes={[
          { phoneme: "tɕ", accuracyScore: 68 },
          { phoneme: "ɕː", accuracyScore: 62 },
          { phoneme: "dʲ", accuracyScore: 70 },
          { phoneme: "nʲ", accuracyScore: 73 },
          { phoneme: "ɨ", accuracyScore: 75 },
          { phoneme: "ɐ", accuracyScore: 64 },
          { phoneme: "ʂ", accuracyScore: 80 },
          { phoneme: "ʐ", accuracyScore: 55 },
        ]}
      />,
    );

    const expectedSources = [
      ["播放音标 /tɕ/", "/audio/language-assets/ru-RU/header-clips/ru-ch.m4a"],
      [
        "播放音标 /ɕː/",
        "/audio/language-assets/ru-RU/header-clips/ru-shch.m4a",
      ],
      ["播放音标 /ɨ/", "/audio/language-assets/ru-RU/header-clips/ru-y.m4a"],
      ["播放音标 /ʂ/", "/audio/language-assets/ru-RU/header-clips/ru-sh.m4a"],
    ] as const;

    for (const [ariaLabel, source] of expectedSources) {
      const tile = document.querySelector(`[aria-label="${ariaLabel}"]`);
      expect(tile, ariaLabel).not.toBeNull();
      expect(tile).toHaveAttribute("data-audio-kind", "sound-unit");
      expect(tile?.getAttribute("data-audio-src")).toBe(source);
      expect(tile?.getAttribute("data-audio-src")).not.toContain(
        "/audio/language-packs/",
      );
      expect(Number(tile?.getAttribute("data-audio-max-duration-ms"))).toBe(
        500,
      );
    }

    for (const label of ["/dʲ/", "/nʲ/", "/ɐ/", "/ʐ/"] as const) {
      const tile = screen
        .getByText(label)
        .closest('[data-smoke="assessment-phoneme-tile"]');
      expect(tile).toHaveAttribute("data-audio-playable", "false");
      expect(tile).toHaveAttribute("data-audio-kind", "none");
    }
  });

  it("does not add the target IPA reference to English phoneme breakdowns", () => {
    render(
      <PhonemeHighlight
        languageId="en-US"
        expectedText="green"
        expectedIpa="/griːn/"
        phonemes={[{ phoneme: "iy", accuracyScore: 88 }]}
      />,
    );

    expect(screen.queryByText("目标 IPA 参考")).not.toBeInTheDocument();
  });

  it("shows a clear empty-state message when Azure returns no usable phonemes", () => {
    render(<PhonemeHighlight languageId="fr-FR" phonemes={[]} />);

    expect(screen.getByText("暂无本地音频")).toHaveAttribute(
      "data-smoke",
      "assessment-phoneme-audio-hint",
    );
    expect(screen.getByText(/没有返回可用的分段音素标签/)).toBeInTheDocument();
  });

  it("renders repeated same-score phonemes without duplicate-key warnings", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PhonemeHighlight
        languageId="es-ES"
        phonemes={[
          { phoneme: "a", accuracyScore: 72 },
          { phoneme: "a", accuracyScore: 72 },
          { phoneme: "a", accuracyScore: 72 },
        ]}
      />,
    );

    const errors = errorSpy.mock.calls.flat().join("\n");
    expect(errors).not.toContain("Encountered two children with the same key");
  });

  it("stops and unloads the previous scoring-tile audio when another tile is played", () => {
    vi.useFakeTimers();
    render(
      <PhonemeHighlight
        languageId="es-ES"
        phonemes={[
          { phoneme: "a", accuracyScore: 72 },
          { phoneme: "θ", accuracyScore: 68 },
        ]}
      />,
    );

    fireEvent.click(screen.getByText("/a/").closest("div") as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(130);
    });

    expect(howlerMock.instances).toHaveLength(1);
    expect(howlerMock.instances[0].play).toHaveBeenCalledTimes(1);
    expect(howlerMock.instances[0].seek).toHaveBeenCalledWith(0.015, 9);

    fireEvent.click(screen.getByText("/θ/").closest("div") as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(130);
    });

    expect(howlerMock.instances).toHaveLength(2);
    expect(howlerMock.instances[0].stop).toHaveBeenCalledTimes(1);
    expect(howlerMock.instances[0].unload).toHaveBeenCalledTimes(1);
    expect(howlerMock.instances[1].play).toHaveBeenCalledTimes(1);
  });

  it("short-stops scoring-tile phoneme audio on the same header-clip window", () => {
    vi.useFakeTimers();
    render(
      <PhonemeHighlight
        languageId="es-ES"
        phonemes={[{ phoneme: "a", accuracyScore: 72 }]}
      />,
    );

    fireEvent.click(screen.getByText("/a/").closest("div") as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(130);
    });

    expect(howlerMock.instances).toHaveLength(1);
    expect(howlerMock.instances[0].seek).toHaveBeenCalledWith(0.015, 9);

    act(() => {
      vi.advanceTimersByTime(440);
    });
    expect(howlerMock.instances[0].fade).toHaveBeenCalledWith(1, 0, 60, 9);
    expect(howlerMock.instances[0].stop).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(howlerMock.instances[0].stop).toHaveBeenCalledWith(9);
    expect(howlerMock.instances[0].unload).toHaveBeenCalledTimes(1);
  });

  it("keeps unverified non-English scoring tiles visible but unclickable", () => {
    vi.useFakeTimers();
    render(
      <PhonemeHighlight
        languageId="es-ES"
        phonemes={[{ phoneme: "ɱ", accuracyScore: 72 }]}
      />,
    );

    const tile = document.querySelector(
      '[data-smoke="assessment-phoneme-tile"]',
    ) as HTMLElement;
    expect(screen.getByText("/ɱ/")).toBeInTheDocument();
    expect(tile).toHaveAttribute("data-audio-playable", "false");
    expect(tile).toHaveAttribute("aria-disabled", "true");
    expect(tile).toHaveAttribute("data-audio-kind", "none");
    expect(tile.getAttribute("aria-label")).toBeNull();
    expect(tile.getAttribute("role")).toBeNull();
    expect(tile.getAttribute("tabindex")).toBe("-1");
    expect(tile.getAttribute("title")).toContain("暂无本地音频");

    fireEvent.click(tile);
    act(() => {
      vi.advanceTimersByTime(130);
    });

    expect(howlerMock.instances).toHaveLength(0);
  });

  it("clears pending click playback and active audio on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <PhonemeHighlight
        languageId="es-ES"
        phonemes={[{ phoneme: "a", accuracyScore: 72 }]}
      />,
    );

    fireEvent.click(screen.getByText("/a/").closest("div") as HTMLElement);
    unmount();
    act(() => {
      vi.advanceTimersByTime(130);
    });
    expect(howlerMock.instances).toHaveLength(0);

    const mounted = render(
      <PhonemeHighlight
        languageId="es-ES"
        phonemes={[{ phoneme: "a", accuracyScore: 72 }]}
      />,
    );
    fireEvent.click(screen.getByText("/a/").closest("div") as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(130);
    });
    mounted.unmount();

    expect(howlerMock.instances).toHaveLength(1);
    expect(howlerMock.instances[0].stop).toHaveBeenCalledTimes(1);
    expect(howlerMock.instances[0].unload).toHaveBeenCalledTimes(1);
  });
});
