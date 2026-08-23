import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageConfigCard } from "@/components/settings/language-config-card";
import { LANGUAGE_PROFILES } from "@/lib/language-profiles";
import type { LanguageId } from "@/types/language";

const mocks = vi.hoisted(() => ({
  languageId: "fr-FR" as LanguageId,
  setLanguageConfig: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: mocks.languageId }),
}));

vi.mock("@/lib/api-keys", () => ({
  setLanguageConfig: mocks.setLanguageConfig,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
  },
}));

describe("language config card", () => {
  it("derives non-English Labs boundaries from the shared capability policy", () => {
    render(<LanguageConfigCard />);

    expect(screen.getByText(/当前：法语 · Labs/)).toBeInTheDocument();
    expect(screen.getAllByText(/核心公开：发音单位、自由练习/)).toHaveLength(4);
    expect(screen.getAllByText(/Labs：引导训练、探索性诊断/)).toHaveLength(4);
    expect(screen.getAllByText(/正式证据关闭/)).toHaveLength(4);
    expect(screen.queryByText(/开放 beta/)).not.toBeInTheDocument();
    expect(screen.queryByText(/exact/)).not.toBeInTheDocument();
    expect(screen.queryByText(/待补/)).not.toBeInTheDocument();

    for (const languageId of ["es-ES", "fr-FR", "ru-RU"] as const) {
      const profile = LANGUAGE_PROFILES[languageId];

      expect(profile.status).toBe("experimental");
      expect(profile.readiness.evidenceMastery).toBe(false);
      expect(profile.knownGaps.join("\n")).not.toMatch(/作为 beta|开放 beta/);
    }
  });

  it("keeps non-English audio gaps user-facing instead of exposing internal labels", () => {
    render(<LanguageConfigCard />);

    const gapSummaries = document.querySelectorAll(
      '[data-smoke="language-option-phonology-gaps"]',
    );
    expect(gapSummaries).toHaveLength(3);
    expect(gapSummaries[0]).toHaveAttribute("data-phonology-gap-count", "1");
    expect(gapSummaries[1]).toHaveAttribute("data-phonology-gap-count", "1");
    expect(gapSummaries[2]).toHaveAttribute("data-phonology-gap-count", "2");

    expect(
      screen.getAllByText(/部分进阶发音规则或单个音标仍在核验中/),
    ).toHaveLength(3);
    expect(screen.getAllByText(/不会播放替代音频/)).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(
      /音系\/短音频待补|seseo \/ yeismo|liaison \/ enchainement|complete hard\/soft/,
    );

    const englishOption = document.querySelector(
      '[data-smoke="language-option"][data-language-id="en-US"]',
    );
    expect(englishOption).not.toBeNull();
    expect(englishOption?.textContent).not.toContain("不会播放替代音频");
  });
});
