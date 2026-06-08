import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpanishSoundExampleStrip } from "@/components/phoneme/spanish-sound-example-strip";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

const phoneme: PhonemeData = {
  languageId: "es-ES",
  slug: "es-p-test",
  ipa: "/p/",
  symbol: "/p/",
  name: "voiceless bilabial stop",
  category: "consonant",
  example: "paso",
  keywords: [],
  difficulty: "easy",
};

const examples: KeywordEntry[] = [
  { word: "paso", ipa: "/ˈpaso/" },
  { word: "pico", ipa: "/ˈpiko/" },
  { word: "sopa", ipa: "/ˈsopa/" },
  { word: "capa", ipa: "/ˈkapa/" },
];

describe("SpanishSoundExampleStrip", () => {
  it("renders target sound and Spanish example word audio chips", () => {
    render(
      <SpanishSoundExampleStrip
        phoneme={phoneme}
        currentWord={examples[0]}
        exampleWords={examples}
        onPlayTarget={vi.fn()}
        onPlayWord={vi.fn()}
      />,
    );

    expect(screen.getByText("Escucha y compara")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /播放目标音 \/p\// }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /播放 paso/ })).toBeInTheDocument();
    expect(screen.getByText("paso")).toBeInTheDocument();
    expect(screen.getByText("pico")).toBeInTheDocument();
    expect(screen.getByText("sopa")).toBeInTheDocument();
    expect(screen.getByText("capa")).toBeInTheDocument();
  });

  it("calls the correct playback handlers", () => {
    const onPlayTarget = vi.fn();
    const onPlayWord = vi.fn();

    render(
      <SpanishSoundExampleStrip
        phoneme={phoneme}
        currentWord={examples[0]}
        exampleWords={examples}
        onPlayTarget={onPlayTarget}
        onPlayWord={onPlayWord}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /播放目标音/ }));
    expect(onPlayTarget).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /播放 pico/ }));
    expect(onPlayWord).toHaveBeenCalledWith("pico");
  });

  it("marks the current word chip", () => {
    render(
      <SpanishSoundExampleStrip
        phoneme={phoneme}
        currentWord={examples[2]}
        exampleWords={examples}
        onPlayTarget={vi.fn()}
        onPlayWord={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /播放 sopa/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
