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
  it("keeps non-English modules labeled experimental instead of beta", () => {
    render(<LanguageConfigCard />);

    expect(
      screen.getByText(/西语、法语、俄语仍为 experimental 实验板块/),
    ).toBeInTheDocument();
    expect(screen.getByText(/部分练习音频随桌面端内置/)).toBeInTheDocument();
    expect(screen.getByText(/exact 短音频缺口会在下方标出/)).toBeInTheDocument();
    expect(screen.queryByText(/开放 beta/)).not.toBeInTheDocument();
    expect(screen.queryByText(/单词\/短语音频已随桌面端内置/)).not.toBeInTheDocument();

    for (const languageId of ["es-ES", "fr-FR", "ru-RU"] as const) {
      const profile = LANGUAGE_PROFILES[languageId];

      expect(profile.status).toBe("experimental");
      expect(profile.readiness.evidenceMastery).toBe(false);
      expect(profile.knownGaps.join("\n")).not.toMatch(/作为 beta|开放 beta/);
    }
  });

  it("surfaces non-English phonology gaps separately from service capability gaps", () => {
    render(<LanguageConfigCard />);

    const gapSummaries = document.querySelectorAll(
      '[data-smoke="language-option-phonology-gaps"]',
    );
    expect(gapSummaries).toHaveLength(3);
    for (const summary of gapSummaries) {
      expect(summary).toHaveAttribute("data-phonology-gap-count", "2");
    }

    expect(
      screen.getByText(/音系\/短音频待补：\/p t k f m n b d g\//),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/音系\/短音频待补：\/p b t d k g f v s z m n l\//),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/音系\/短音频待补：complete hard\/soft consonant pairs/),
    ).toBeInTheDocument();

    const englishOption = document.querySelector(
      '[data-smoke="language-option"][data-language-id="en-US"]',
    );
    expect(englishOption).not.toBeNull();
    expect(englishOption?.textContent).not.toContain("音系/短音频待补");
  });
});
