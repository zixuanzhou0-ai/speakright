import { expect, type Page, test } from "@playwright/test";

interface GuidedRepeatVisualEvent {
  phase: string;
  contentKind: string;
  speaking: string;
  text: string;
}

async function installPhaseRecorder(page: Page) {
  await page.evaluate(() => {
    const target = window as unknown as {
      __guidedRepeatPhases?: string[];
      __guidedRepeatPhaseEvents?: { phase: string; at: number }[];
      __guidedRepeatVisualEvents?: GuidedRepeatVisualEvent[];
      __guidedRepeatObserver?: MutationObserver;
    };
    target.__guidedRepeatPhases = [];
    target.__guidedRepeatPhaseEvents = [];
    target.__guidedRepeatVisualEvents = [];
    const record = () => {
      const phase = document
        .querySelector('[data-smoke="guided-repeat-phase"]')
        ?.getAttribute("data-phase");
      const phases = target.__guidedRepeatPhases ?? [];
      if (phase && phases.at(-1) !== phase) {
        phases.push(phase);
        target.__guidedRepeatPhaseEvents?.push({
          phase,
          at: performance.now(),
        });
      }
      target.__guidedRepeatPhases = phases;

      const hero = document.querySelector('[data-smoke="guided-repeat-hero"]');
      if (!phase || !hero) return;
      const mainText = hero.querySelector(
        '[data-smoke="guided-repeat-phoneme"], [data-smoke="guided-repeat-word"]',
      );
      const event: GuidedRepeatVisualEvent = {
        phase,
        contentKind: hero.getAttribute("data-content-kind") ?? "",
        speaking: hero.getAttribute("data-speaking") ?? "false",
        text: mainText?.textContent?.trim() ?? "",
      };
      const visualEvents = target.__guidedRepeatVisualEvents ?? [];
      const previous = visualEvents.at(-1);
      if (
        !previous ||
        previous.phase !== event.phase ||
        previous.contentKind !== event.contentKind ||
        previous.speaking !== event.speaking ||
        previous.text !== event.text
      ) {
        visualEvents.push(event);
      }
      target.__guidedRepeatVisualEvents = visualEvents;
    };
    target.__guidedRepeatObserver?.disconnect();
    target.__guidedRepeatObserver = new MutationObserver(record);
    target.__guidedRepeatObserver.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ["data-phase", "data-content-kind", "data-speaking"],
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

async function phaseEvents(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __guidedRepeatPhaseEvents?: { phase: string; at: number }[];
        }
      ).__guidedRepeatPhaseEvents ?? [],
  );
}

async function visualEvents(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __guidedRepeatVisualEvents?: GuidedRepeatVisualEvent[];
        }
      ).__guidedRepeatVisualEvents ?? [],
  );
}

async function startGuidedRepeat(
  dialog: import("@playwright/test").Locator,
  mode: "quick" | "standard" | "intensive" = "standard",
) {
  await expect(
    dialog.locator('[data-smoke="guided-repeat-setup"]'),
  ).toBeVisible();
  await dialog.locator(`[data-smoke="guided-repeat-mode-${mode}"]`).click();
  await dialog.locator('[data-smoke="guided-repeat-start"]').click();
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
  const chartWordAudioRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/pronunciation") ||
      request.url().includes("/api/elevenlabs")
    ) {
      onlineFallbacks.push(request.url());
    }
    if (
      request.url().includes("/audio/ipa/normal/") ||
      request.url().includes("/audio/ipa/slow/")
    ) {
      chartWordAudioRequests.push(request.url());
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
  await startGuidedRepeat(dialog);
  const hero = dialog.locator('[data-smoke="guided-repeat-hero"]');
  await expect(hero).toHaveAttribute("data-content-kind", "ipa");
  await expect(
    dialog.locator('[data-smoke="guided-repeat-phoneme"]'),
  ).toBeVisible();
  await expect(hero).toHaveAttribute("data-speaking", "true", {
    timeout: 5_000,
  });
  await dialog.locator('[data-rhythm="flow"]').click();

  await expect
    .poll(async () => (await phases(page)).includes("word-feminine-1"), {
      timeout: 20_000,
    })
    .toBe(true);
  expectSubsequence(await phases(page), [
    "anchor-single-1",
    "gap-anchor-imitation",
    "anchor-single-2",
    "gap-anchor-imitation",
    "word-masculine-1",
    "gap-imitation",
    "word-feminine-1",
  ]);
  const events = await phaseEvents(page);
  const expectedSpeakingPhases = [
    ["anchor-single-1", "ipa"],
    ["anchor-single-2", "ipa"],
    ["word-masculine-1", "word"],
    ["word-feminine-1", "word"],
  ] as const;
  await expect
    .poll(
      async () => {
        const log = await visualEvents(page);
        return expectedSpeakingPhases.every(([expectedPhase, kind]) =>
          log.some(
            (event) =>
              event.phase === expectedPhase &&
              event.contentKind === kind &&
              event.speaking === "true",
          ),
        );
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  const visualLog = await visualEvents(page);
  expect(
    visualLog.some(
      (event) =>
        event.phase === "gap-anchor-imitation" &&
        event.contentKind === "ipa" &&
        event.speaking === "false",
    ),
  ).toBe(true);
  expect(
    visualLog.some(
      (event) =>
        event.phase === "gap-imitation" &&
        event.contentKind === "word" &&
        event.speaking === "false",
    ),
  ).toBe(true);
  expect(
    visualLog.some(
      (event) =>
        event.phase === "word-masculine-1" && event.text === visibleWord,
    ),
  ).toBe(true);
  await expect(
    dialog.locator('[data-smoke="guided-repeat-actions"]'),
  ).toHaveAttribute("data-action-stage", "word");
  await expect(
    dialog.locator('[data-smoke="guided-repeat-repeat-word"]'),
  ).toContainText("本词再练一轮");
  await expect(
    dialog.locator('[data-smoke="guided-repeat-next-word"]'),
  ).toContainText("完成本词，下一个");
  await expect(dialog).not.toContainText("会了，下一个");

  const firstAnchorGap = events.find(
    (event) => event.phase === "gap-anchor-imitation",
  );
  const secondAnchor = events.find(
    (event) =>
      event.phase === "anchor-single-2" &&
      (!firstAnchorGap || event.at > firstAnchorGap.at),
  );
  const secondAnchorGap = events.find(
    (event) =>
      event.phase === "gap-anchor-imitation" &&
      (!secondAnchor || event.at > secondAnchor.at),
  );
  const firstWord = events.find(
    (event) =>
      event.phase === "word-masculine-1" &&
      (!secondAnchorGap || event.at > secondAnchorGap.at),
  );
  expect(firstAnchorGap).toBeDefined();
  expect(secondAnchor).toBeDefined();
  expect(secondAnchorGap).toBeDefined();
  expect(firstWord).toBeDefined();
  expect(
    (secondAnchor?.at ?? 0) - (firstAnchorGap?.at ?? 0),
  ).toBeGreaterThanOrEqual(750);
  expect(
    (firstWord?.at ?? 0) - (secondAnchorGap?.at ?? 0),
  ).toBeGreaterThanOrEqual(750);
  expect(onlineFallbacks).toEqual([]);
  expect(chartWordAudioRequests).toEqual([]);

  const pauseButton = dialog.locator('[data-smoke="guided-repeat-pause"]');
  await expect(pauseButton).toBeVisible();
  await pauseButton.click();
  await expect(
    dialog.locator('[data-smoke="guided-repeat-phase"]'),
  ).toHaveAttribute("data-phase", "paused");
  await expect(hero).toHaveAttribute("data-speaking", "false");
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
    await startGuidedRepeat(dialog);
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
    expectSubsequence(log, [
      "anchor-single-1",
      "gap-anchor-imitation",
      "anchor-single-2",
    ]);
    await dialog.locator('[data-smoke="guided-repeat-end"]').click();
    await expect(
      dialog.locator('[data-smoke="guided-repeat-exit-summary"]'),
    ).toBeVisible();
    await expect(dialog).toContainText("不代表已经掌握或评分达标");
    await dialog.locator('[data-smoke="guided-repeat-save-exit"]').click();
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
  await expect(dialog.locator('input[value="standard"]')).toBeFocused();
  await startGuidedRepeat(dialog);
  await expect(
    dialog.locator('[data-smoke="guided-repeat-pause"]'),
  ).toBeFocused();
  await expect(
    dialog.locator('[data-smoke="guided-repeat-actions"]'),
  ).toHaveAttribute("data-action-stage", "anchor");
  await expect(
    dialog.locator('[data-smoke="guided-repeat-replay"]'),
  ).toContainText("重听音标");
  await expect(
    dialog.locator('[data-smoke="guided-repeat-repeat-word"]'),
  ).toHaveCount(0);
  await expect(
    dialog.locator('[data-smoke="guided-repeat-next-word"]'),
  ).toHaveCount(0);

  await page.keyboard.press("Escape");
  const exitSummary = dialog.locator(
    '[data-smoke="guided-repeat-exit-summary"]',
  );
  await expect(dialog).toBeVisible();
  await expect(exitSummary).toBeVisible();
  await expect(exitSummary).toHaveAttribute("data-completed-words", "0");
  await expect(exitSummary).toContainText("剩余");
  await expect(exitSummary).toContainText("不代表已经掌握或评分达标");
  await dialog.locator('[data-smoke="guided-repeat-continue"]').click();
  await expect(exitSummary).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(exitSummary).toBeVisible();
  await dialog.locator('[data-smoke="guided-repeat-save-exit"]').click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/phonemes\/ih$/);

  await page.locator('[data-smoke="guided-repeat-trigger"]').click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/phonemes\/ih$/);
});
