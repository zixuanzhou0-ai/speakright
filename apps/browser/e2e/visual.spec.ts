import { expect, test } from "@playwright/test";

async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finiteAnimations = document.getAnimations().filter((animation) => {
      const iterations = animation.effect?.getTiming().iterations;
      return iterations !== Infinity;
    });
    await Promise.all(
      finiteAnimations.map((animation) =>
        animation.finished.catch(() => undefined),
      ),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          resolve();
        }),
      ),
    );
  });
}

test("mobile drill above the fold visual contract", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/drill");
  await settle(page);
  await expect(page).toHaveScreenshot("drill-mobile-390.png", {
    animations: "allow",
    fullPage: false,
  });
});

test("desktop drill preserves sidebar hierarchy", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/drill");
  await settle(page);
  await expect(page).toHaveScreenshot("drill-desktop-1280.png", {
    fullPage: false,
  });
});

test("mobile settings keeps progressive disclosure above the fold", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await settle(page);
  await expect(page).toHaveScreenshot("settings-mobile-390.png", {
    fullPage: false,
  });
});

test("dark progress evidence ladder visual contract", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/progress");
  await settle(page);
  await expect(page).toHaveScreenshot("progress-dark-1280.png", {
    fullPage: false,
  });
});

test("mobile guided lesson keeps the start action above the fold", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/drill");
  await page.locator('[data-smoke="drill-primary-action"]').click();
  await expect(page).toHaveURL(/\/drill\/pack\//);
  await expect(
    page.locator('[data-smoke="pack-runner-intro-card"]'),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("guided-intro-mobile-390.png", {
    fullPage: false,
  });
});

test("active offline ABX makes the task and answer controls obvious", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/drill");
  await page.locator('[data-smoke="drill-primary-action"]').click();
  await expect(page).toHaveURL(/\/drill\/pack\//);
  await expect(
    page.locator('[data-smoke="pack-runner-intro-card"]'),
  ).toBeVisible();
  await page
    .locator('[data-smoke="pack-runner-intro-card"]')
    .getByRole("button")
    .first()
    .click();
  const firstAudioControl = page.getByRole("button", {
    name: "A",
    exact: true,
  });
  await expect(firstAudioControl).toBeVisible();
  const firstAudioBox = await firstAudioControl.boundingBox();
  expect(
    (firstAudioBox?.y ?? 9999) + (firstAudioBox?.height ?? 0),
  ).toBeLessThanOrEqual(844);
  await settle(page);
  await expect(page).toHaveScreenshot("guided-abx-mobile-390.png", {
    fullPage: false,
  });
});

test("mobile phoneme selector is searchable and grouped", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const localVideoRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/videos/phonemes/ih.mp4") {
      localVideoRequests.push(pathname);
    }
  });
  const missingVideoResponse = await page.request.get(
    "/videos/phonemes/ih.mp4",
  );
  expect(missingVideoResponse.status()).toBe(404);
  await page.goto("/phonemes/ih");
  expect(localVideoRequests).toEqual([]);
  await expect(
    page.getByText("外部 IPA / 发音教学资源", { exact: true }),
  ).toBeVisible();
  const selector = page.locator('[data-smoke="phoneme-mobile-selector"]');
  await selector.getByText("切换发音单位").click();
  await expect(selector).toHaveAttribute("open", "");
  await expect(selector.getByRole("textbox")).toBeVisible();
  await expect(selector.getByRole("region", { name: "元音" })).toBeVisible();
  await expect(selector.getByRole("region", { name: "辅音" })).toBeVisible();
  await settle(page);
  await expect(selector).toHaveScreenshot("phoneme-selector-mobile-390.png");
});

test("free practice empty state stays compact", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sentences");
  await settle(page);
  await expect(page).toHaveScreenshot("sentences-empty-mobile-390.png", {
    fullPage: false,
  });
});

test("Spanish direct training route preserves the Labs boundary", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "speakright_language_config",
      JSON.stringify({ languageId: "es-ES" }),
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/drill/pack/ee-ih");
  await settle(page);
  await expect(page).toHaveScreenshot("labs-training-mobile-390.png", {
    fullPage: false,
  });
});
