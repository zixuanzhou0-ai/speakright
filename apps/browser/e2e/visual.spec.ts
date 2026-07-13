import { expect, test } from "@playwright/test";

async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test("mobile drill above the fold visual contract", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/drill");
  await settle(page);
  await expect(page).toHaveScreenshot("drill-mobile-390.png", {
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
