import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarPhonemeList } from "@/components/layout/sidebar-phoneme-list";

const languageMock = vi.hoisted(() => ({
  languageId: "fr-FR" as "en-US" | "es-ES" | "fr-FR" | "ru-RU",
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({
    languageId: languageMock.languageId,
  }),
}));

afterEach(() => cleanup());

function renderWithLanguage(
  languageId: "en-US" | "es-ES" | "fr-FR" | "ru-RU",
  currentSlug: string,
) {
  languageMock.languageId = languageId;
  render(<SidebarPhonemeList currentSlug={currentSlug} />);
}

describe("SidebarPhonemeList layout", () => {
  it("keeps English sound units compact on one row", () => {
    renderWithLanguage("en-US", "ee");

    const englishItem = screen.getByText("/iː/").closest("a");
    const englishExample = screen.getByText("green");

    expect(englishItem).toHaveClass("flex");
    expect(englishItem).not.toHaveClass("whitespace-nowrap");
    expect(englishExample).toHaveClass("text-center");
    expect(englishExample).toHaveClass("break-words");
  });

  it("hides French rule units from phoneme practice while keeping schwa visible", () => {
    renderWithLanguage("fr-FR", "fr-schwa");

    expect(screen.queryByText("词尾静音")).not.toBeInTheDocument();
    expect(screen.queryByText("连诵")).not.toBeInTheDocument();
    expect(screen.queryByText("连读")).not.toBeInTheDocument();
    expect(screen.queryByText("省音")).not.toBeInTheDocument();
    expect(screen.queryByText("短语末突出")).not.toBeInTheDocument();
    expect(screen.getByText("弱读 /ə/")).toBeInTheDocument();
  });

  it("hides Spanish stress and rhythm rule units from phoneme practice", () => {
    renderWithLanguage("es-ES", "es-diphthongs-j");

    expect(screen.queryByText("鼻音位置")).not.toBeInTheDocument();
    expect(screen.queryByText("词重音")).not.toBeInTheDocument();
    expect(screen.queryByText("音节节奏")).not.toBeInTheDocument();
    expect(screen.getByText("双元音 /j/")).toBeInTheDocument();
    expect(screen.getByText("双元音 /w/")).toBeInTheDocument();
  });

  it("hides Russian aggregate rule units from phoneme practice", () => {
    renderWithLanguage("ru-RU", "ru-t-tj");

    expect(screen.queryByText("重音弱化")).not.toBeInTheDocument();
    expect(screen.queryByText("非重读 O/A")).not.toBeInTheDocument();
    expect(screen.queryByText("带 /j/ 元音")).not.toBeInTheDocument();
    expect(screen.queryByText("词尾清化")).not.toBeInTheDocument();
    expect(screen.queryByText("清浊同化")).not.toBeInTheDocument();
    expect(screen.queryByText("辅音丛")).not.toBeInTheDocument();
    expect(screen.getByText("T/Tь")).toBeInTheDocument();
  });

  it("labels Spanish realization units as allophones in the sidebar", () => {
    renderWithLanguage("es-ES", "es-bv");

    const item = screen.getByText("B/V 对比").closest("a");
    expect(item).toBeTruthy();
    if (!item) return;

    const layerBadge = within(item).getByText("实现音");
    expect(layerBadge).toHaveAttribute("data-smoke", "sidebar-phonology-layer");
    expect(layerBadge).toHaveAttribute("data-phonology-layer", "allophone");
  });

  it("labels visible Russian hard-soft pair units as contrasts", () => {
    renderWithLanguage("ru-RU", "ru-t-tj");

    const item = screen.getByText("T/Tь").closest("a");
    expect(item).toBeTruthy();
    if (!item) return;

    const layerBadge = within(item).getByText("对比/变体");
    expect(layerBadge).toHaveAttribute("data-smoke", "sidebar-phonology-layer");
    expect(layerBadge).toHaveAttribute("data-phonology-layer", "contrast");
    expect(screen.queryByText("软音符号")).not.toBeInTheDocument();
  });
});
