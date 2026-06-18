import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhonemeGrid } from "@/components/phoneme/phoneme-grid";
import { getLanguagePhonemes } from "@/lib/language-phonemes";

const mocks = vi.hoisted(() => ({
  playerError: null as string | null,
}));

vi.mock("@/hooks/use-audio-player", () => ({
  useAudioPlayer: () => ({
    isPlaying: false,
    isLoading: false,
    error: mocks.playerError,
    play: vi.fn(),
    playBlob: vi.fn(),
    stop: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
  mocks.playerError = null;
});

describe("PhonemeGrid language grouping", () => {
  it("keeps English as vowels and consonants", () => {
    render(<PhonemeGrid phonemes={getLanguagePhonemes("en-US")} />);

    expect(screen.getByRole("heading", { name: "元音" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "辅音" })).toBeInTheDocument();
  });

  it("renders Spanish phoneme-practice groups without stress or rhythm rule cards", () => {
    render(<PhonemeGrid phonemes={getLanguagePhonemes("es-ES")} />);

    for (const label of [
      "纯元音",
      "核心辅音",
      "对比/变体",
      "双元音/滑音",
    ]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("heading", { name: "重音与节奏" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("词重音")).not.toBeInTheDocument();
    expect(screen.queryByText("音节节奏")).not.toBeInTheDocument();
  });

  it("renders French phoneme-practice groups without connected-speech rule cards", () => {
    render(<PhonemeGrid phonemes={getLanguagePhonemes("fr-FR")} />);

    for (const label of ["口腔元音", "鼻化元音", "辅音与滑音"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("heading", { name: "连读/静音规则" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "短语韵律" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("/ə/")).toBeInTheDocument();
    expect(screen.queryByText("连诵")).not.toBeInTheDocument();
    expect(screen.queryByText("词尾静音")).not.toBeInTheDocument();
  });

  it("renders Russian phoneme-practice groups without aggregate rule cards", () => {
    render(<PhonemeGrid phonemes={getLanguagePhonemes("ru-RU")} />);

    for (const label of ["元音", "硬软辅音", "核心辅音"]) {
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("heading", { name: "重音与弱化" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "拼写到发音规则" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("/t tʲ/")).toBeInTheDocument();
    expect(screen.getAllByText("硬软辅音")).toHaveLength(1);
    expect(screen.queryByText("重音弱化")).not.toBeInTheDocument();
    expect(screen.queryByText("词尾清化")).not.toBeInTheDocument();
  });

  it("shows shared local audio playback failures above the grid", () => {
    mocks.playerError = "本地音频加载失败：发布包音频可能缺失。";

    render(<PhonemeGrid phonemes={getLanguagePhonemes("en-US")} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-smoke", "phoneme-grid-audio-error");
    expect(alert).toHaveTextContent("本地音频加载失败");
  });
});
