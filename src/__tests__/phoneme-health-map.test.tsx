import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhonemeHealthMap } from "@/components/assessment/phoneme-health-map";

afterEach(() => cleanup());

function linkForSlug(slug: string): HTMLAnchorElement {
  const link = document.querySelector<HTMLAnchorElement>(
    `a[href="/phonemes/${slug}"]`,
  );
  expect(link).toBeTruthy();
  if (!link) throw new Error(`Missing link for ${slug}`);
  return link;
}

describe("PhonemeHealthMap language policy", () => {
  it("keeps English high scores labeled as mastery", () => {
    render(
      <PhonemeHealthMap
        languageId="en-US"
        scores={{ ee: { score: 92, sampleCount: 3 } }}
      />,
    );

    expect(screen.getByLabelText(/掌握/)).toHaveAttribute(
      "href",
      "/phonemes/ee",
    );
  });

  it("does not call Spanish allophone high scores mastery", () => {
    render(
      <PhonemeHealthMap
        languageId="es-ES"
        scores={{ "es-bv": { score: 91, sampleCount: 2 } }}
      />,
    );

    const link = linkForSlug("es-bv");
    expect(link).toHaveAccessibleName(/高分/);
    expect(link).toHaveAccessibleName(/实现音/);
    expect(link).toHaveAccessibleName(/experimental 练习观察/);
    expect(link).not.toHaveAccessibleName(/掌握/);
    expect(
      document.querySelector(
        '[data-smoke="phoneme-health-cell"][data-phonology-layer="allophone"]',
      ),
    ).toBeInTheDocument();
  });

  it("labels French phrase rules as connected-speech observations", () => {
    render(
      <PhonemeHealthMap
        languageId="fr-FR"
        scores={{ "fr-liaison": { score: 84, sampleCount: 1 } }}
      />,
    );

    const link = linkForSlug("fr-liaison");
    expect(link).toHaveAccessibleName(/高分/);
    expect(link).toHaveAccessibleName(/语流规则/);
    expect(link).toHaveAccessibleName(/experimental 练习观察/);
    expect(link).not.toHaveAccessibleName(/掌握/);
    expect(
      document.querySelector(
        '[data-smoke="phoneme-health-cell"][data-phonology-layer="connected-speech-rule"]',
      ),
    ).toBeInTheDocument();
  });

  it("labels Russian hard-soft units as contrast observations", () => {
    render(
      <PhonemeHealthMap
        languageId="ru-RU"
        scores={{ "ru-hard-soft": { score: 88, sampleCount: 4 } }}
      />,
    );

    const link = linkForSlug("ru-hard-soft");
    expect(link).toHaveAccessibleName(/高分/);
    expect(link).toHaveAccessibleName(/对比\/变体/);
    expect(link).toHaveAccessibleName(/experimental 练习观察/);
    expect(link).not.toHaveAccessibleName(/掌握/);
    expect(
      document.querySelector(
        '[data-smoke="phoneme-health-cell"][data-phonology-layer="contrast"]',
      ),
    ).toBeInTheDocument();
  });
});
