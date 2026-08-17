import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProsodyPage from "@/app/drill/prosody/page";

const mocks = vi.hoisted(() => ({ languageId: "fr-FR" }));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: mocks.languageId }),
}));

describe("ProsodyPage language boundary", () => {
  beforeEach(() => {
    mocks.languageId = "fr-FR";
  });

  it("keeps English prosody material out of experimental languages", () => {
    render(<ProsodyPage />);

    expect(
      document.querySelector('[data-smoke="prosody-experimental-blocker"]'),
    ).toBeInTheDocument();
    expect(screen.getByText("Labs · experimental")).toBeInTheDocument();
    expect(screen.getByText(/不会混入英语训练材料/)).toBeInTheDocument();
    expect(screen.getByText(/不生成正式 mastery/)).toBeInTheDocument();
    expect(
      document.querySelector('[data-smoke="prosody-exercise-header"]'),
    ).not.toBeInTheDocument();
  });
});
