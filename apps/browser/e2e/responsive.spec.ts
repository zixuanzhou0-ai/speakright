import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "wide-1920", width: 1920, height: 1080 },
] as const;

const routes = [
  "/drill",
  "/sentences",
  "/assessment",
  "/settings",
  "/progress",
  "/phonemes/ee",
];

async function expectNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden")
          return false;
        const rect = element.getBoundingClientRect();
        // Fixed toast viewports and other portals can keep a zero-height
        // measurement node outside the content box. They cannot cover or
        // widen visible content, so only positive-area elements are offenders.
        if (rect.width <= 0 || rect.height <= 0) return false;
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        text: element.textContent?.trim().slice(0, 80),
        rect: element.getBoundingClientRect().toJSON(),
      }));
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders,
    };
  });

  expect(
    result.documentWidth,
    JSON.stringify(result, null, 2),
  ).toBeLessThanOrEqual(result.viewportWidth + 1);
  expect(result.offenders, JSON.stringify(result, null, 2)).toEqual([]);
}

for (const viewport of viewports) {
  test(`${viewport.name} core routes do not overflow horizontally`, async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
}

test("mobile navigation is full-width, keyboard dismissible, and touch safe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/drill");

  const openButton = page.getByRole("button", { name: "打开学习导航" });
  await expect(openButton).toBeVisible();
  const openBox = await openButton.boundingBox();
  expect(openBox?.width).toBeGreaterThanOrEqual(44);
  expect(openBox?.height).toBeGreaterThanOrEqual(44);

  await openButton.click();
  const dialog = page.getByRole("dialog", { name: "学习导航" });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "关闭导航" }).last(),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const primaryAction = page.locator('[data-smoke="drill-primary-action"]');
  await expect(primaryAction).toBeVisible();
  const actionBox = await primaryAction.boundingBox();
  expect(actionBox?.height).toBeGreaterThanOrEqual(44);
});

test("desktop keeps the familiar sidebar and hides the mobile trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/drill");
  await expect(page.getByRole("button", { name: "打开学习导航" })).toBeHidden();
  await expect(
    page.locator("aside").filter({ hasText: "刻意练习" }),
  ).toBeVisible();
});

test("desktop settings responds to mouse-wheel scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto("/settings");
  await page.getByRole("tab").nth(1).click();

  const main = page.locator("#main-content");
  await expect(main).toBeVisible();
  const dimensions = await main.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

  const box = await main.boundingBox();
  if (!box) {
    throw new Error("Main content bounding box is unavailable");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 600);

  await expect
    .poll(() => main.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(dimensions.scrollTop);
});

test("200 percent zoom equivalent remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto("/settings");
  await expect(page.getByRole("tab", { name: "基础设置" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("mobile settings keeps all five TTS providers and domestic panels usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings?section=services#standard-tts");

  const selector = page.locator('[data-smoke="tts-provider-selector"]');
  await expect(selector).toBeVisible();
  await expect(selector.locator('button[aria-pressed]')).toHaveCount(5);

  for (const provider of ["minimax", "mimo"] as const) {
    await page.locator(`[data-smoke="tts-provider-${provider}"]`).click();
    const panel = page.locator(
      `[data-smoke="tts-provider-panel-${provider}"]`,
    );
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-smoke$="-model-select"]')).toHaveCount(1);
    await expect(panel.locator('[data-smoke$="-voice-select"]')).toHaveCount(1);
    await expect(
      panel.locator(`[data-smoke="${provider}-config-actions"]`),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
