import { expect, type Page, test } from "@playwright/test";

async function installPhaseRecorder(page: Page) {
  await page.evaluate(() => {
    const target = window as unknown as {
      __guidedRepeatPhases?: string[];
      __guidedRepeatObserver?: MutationObserver;
    };
    target.__guidedRepeatPhases = [];
    const record = () => {
      const phase = document
        .querySelector('[data-smoke="guided-repeat-phase"]')
        ?.getAttribute("data-phase");
      const phases = target.__guidedRepeatPhases ?? [];
      if (phase && phases.at(-1) !== phase) phases.push(phase);
      target.__guidedRepeatPhases = phases;
    };
    target.__guidedRepeatObserver?.disconnect();
    target.__guidedRepeatObserver = new MutationObserver(record);
    target.__guidedRepeatObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    record();
  });
}

async function phases(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __guidedRepeatPhases?: string[];
        }
      ).__guidedRepeatPhases ?? [],
  );
}

function expectSubsequence(actual: string[], expected: string[]) {
  let cursor = 0;
  for (const value of actual) {
    if (value === expected[cursor]) cursor += 1;
  }
  expect(cursor, `phase log: ${actual.join(" -> ")}`).toBe(expected.length);
}

test("English guided repeat starts at the visible word and follows the exact offline sequence", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const onlineFallbacks: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/pronunciation") ||
      request.url().includes("/api/elevenlabs")
    ) {
      onlineFallbacks.push(request.url());
    }
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/phonemes/ee");
  const next = page.locator('[data-smoke="phoneme-next-word"]').last();
  const currentWord = page
    .locator('[data-smoke="phoneme-current-word"]')
    .last();
  const initialWord = (await currentWord.textContent())?.trim() ?? "";
  await next.click();
  await expect(currentWord).not.toHaveText(initialWord);
  const visibleWord = (await currentWord.textContent())?.trim();
  expect(visibleWord).toBeTruthy();

  await installPhaseRecorder(page);
  await page.locator('[data-smoke="guided-repeat-trigger"]').click();
  const dialog = page.locator('[data-smoke="guided-repeat-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-smoke="guided-repeat-word"]')).toHaveText(
    visibleWord ?? "",
  );
  await dialog.locator('[data-rhythm="flow"]').click();

  await expect
    .poll(async () => (await phases(page)).includes("word-feminine-2"), {
      timeout: 20_000,
    })
    .toBe(true);
  expectSubsequence(await phases(page), [
    "anchor-normal",
    "gap-cue",
    "anchor-slow",
    "gap-imitation",
    "word-masculine-1",
    "gap-imitation",
    "word-feminine-1",
    "gap-imitation",
    "word-masculine-2",
    "gap-imitation",
    "word-feminine-2",
  ]);
  expect(onlineFallbacks).toEqual([]);

  const pauseButton = dialog.locator('[data-smoke="guided-repeat-pause"]');
  await expect(pauseButton).toBeVisible();
  await pauseButton.click();
  await expect(
    dialog.locator('[data-smoke="guided-repeat-phase"]'),
  ).toHaveAttribute("data-phase", "paused");
  await pauseButton.click();

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(
    page.locator('[data-smoke="phoneme-detail-page"]'),
  ).toBeVisible();
});

test("Spanish, French and Russian use a double single-anchor sequence while preserving Labs routes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const route of [
    { path: "/phonemes/es-a", languageId: "es-ES" },
    { path: "/phonemes/fr-i", languageId: "fr-FR" },
    { path: "/phonemes/ru-a", languageId: "ru-RU" },
  ]) {
    await page.goto(route.path);
    await expect(
      page.locator('[data-smoke="phoneme-detail-page"]'),
    ).toHaveAttribute("data-language-id", route.languageId);
    await installPhaseRecorder(page);
    await page.locator('[data-smoke="guided-repeat-trigger"]').click();
    const dialog = page.locator('[data-smoke="guided-repeat-dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-rhythm="flow"]').click();
    await expect
      .poll(
        async () =>
          (await phases(page)).some((phase) =>
            phase.startsWith("word-masculine"),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
    const log = await phases(page);
    expectSubsequence(log, ["anchor-single-1", "gap-cue", "anchor-single-2"]);
    await dialog.locator('[data-smoke="guided-repeat-end"]').click();
    await expect(dialog).toBeHidden();
  }
});

test("mobile guided repeat is near-full-screen, keyboard operable and browser Back closes only the overlay", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/phonemes/ih");
  await page.locator('[data-smoke="guided-repeat-trigger"]').click();
  const dialog = page.locator('[data-smoke="guided-repeat-dialog"]');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x ?? 99).toBeLessThanOrEqual(12);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(368);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(810);
  await expect(
    dialog.locator('[data-smoke="guided-repeat-pause"]'),
  ).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/phonemes\/ih$/);

  await page.locator('[data-smoke="guided-repeat-trigger"]').click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/phonemes\/ih$/);
});
