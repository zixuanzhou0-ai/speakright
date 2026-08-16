import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "outputs/guided-repeat-qa-2026-07-14/browser",
);

function output(name: string) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  return path.join(OUTPUT_DIR, name);
}

async function openGuidedRepeat(
  page: import("@playwright/test").Page,
  route: string,
  options: {
    mode?: "quick" | "standard" | "intensive";
    start?: boolean;
  } = {},
) {
  await page.goto(route);
  await page.locator('[data-smoke="guided-repeat-trigger"]').click();
  const dialog = page.locator('[data-smoke="guided-repeat-dialog"]');
  await expect(dialog).toBeVisible();
  if (options.start !== false) {
    await startGuidedRepeat(dialog, options.mode);
  }
  return dialog;
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

async function waitForPhase(
  dialog: import("@playwright/test").Locator,
  phase: string,
  timeout = 12_000,
) {
  await expect(
    dialog.locator('[data-smoke="guided-repeat-phase"]'),
  ).toHaveAttribute("data-phase", phase, { timeout });
  if (phase.startsWith("anchor-single") || phase.startsWith("word-")) {
    await expect(
      dialog.locator('[data-smoke="guided-repeat-hero"]'),
    ).toHaveAttribute("data-speaking", "true", { timeout });
  } else if (phase.startsWith("gap-") || phase.endsWith("paused")) {
    await expect(
      dialog.locator('[data-smoke="guided-repeat-hero"]'),
    ).toHaveAttribute("data-speaking", "false", { timeout });
  }
}

test.describe
  .serial("guided repeat visual evidence", () => {
    test("captures the English sequence and recovery states", async ({
      page,
    }) => {
      test.setTimeout(70_000);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/phonemes/ee");
      await page.screenshot({
        path: output("01-entry-1280-light.png"),
        fullPage: true,
      });

      const dialog = await openGuidedRepeat(page, "/phonemes/ee", {
        start: false,
      });
      await page.screenshot({ path: output("01a-mode-setup.png") });
      await startGuidedRepeat(dialog);

      await waitForPhase(dialog, "anchor-single-1");
      await page.screenshot({ path: output("02-english-anchor-1.png") });
      await waitForPhase(dialog, "gap-anchor-imitation");
      await page.screenshot({
        path: output("02a-english-anchor-imitation-gap.png"),
      });
      await waitForPhase(dialog, "anchor-single-2");
      await page.screenshot({ path: output("03-english-anchor-2.png") });
      await waitForPhase(dialog, "word-masculine-1");
      await page.screenshot({ path: output("04-english-masculine.png") });
      await waitForPhase(dialog, "word-feminine-1");
      await page.screenshot({ path: output("05-english-feminine.png") });
      await waitForPhase(dialog, "gap-imitation");
      await page.screenshot({ path: output("06-imitation-gap.png") });

      const pause = dialog.locator('[data-smoke="guided-repeat-pause"]');
      await pause.click();
      await waitForPhase(dialog, "paused");
      await page.waitForTimeout(250);
      await page.screenshot({ path: output("07-manual-pause.png") });
      await pause.click();

      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await waitForPhase(dialog, "auto-paused");
      await page.waitForTimeout(250);
      await page.screenshot({ path: output("08-auto-pause.png") });
    });

    test("captures mobile, dark, reduced-motion and zoom layouts", async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      await page.setViewportSize({ width: 390, height: 844 });
      let dialog = await openGuidedRepeat(page, "/phonemes/ih");
      await waitForPhase(dialog, "anchor-single-1");
      await dialog.locator('[data-smoke="guided-repeat-pause"]').click();
      await waitForPhase(dialog, "paused");
      await page.waitForTimeout(250);
      await page.screenshot({ path: output("09-mobile-390-dark-paused.png") });

      await page.keyboard.press("Escape");
      await page.emulateMedia({
        colorScheme: "light",
        reducedMotion: "reduce",
      });
      await page.setViewportSize({ width: 640, height: 400 });
      dialog = await openGuidedRepeat(page, "/phonemes/uh2", {
        start: false,
      });
      await expect(
        dialog.locator('[data-smoke="guided-repeat-start"]'),
      ).toBeVisible();
      await page.screenshot({ path: output("10a-compact-mode-setup.png") });
      await startGuidedRepeat(dialog);
      await waitForPhase(dialog, "anchor-single-1");
      const pause = dialog.locator('[data-smoke="guided-repeat-pause"]');
      await expect(pause).toBeVisible();
      const phoneme = dialog.locator('[data-smoke="guided-repeat-phoneme"]');
      const transform = await phoneme.evaluate(
        (element) => getComputedStyle(element).transform,
      );
      expect(transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.y ?? -1) + (box?.height ?? 999)).toBeLessThanOrEqual(400);
      await page.screenshot({ path: output("10-zoom-200-reduced-motion.png") });
    });

    test("captures Spanish, French and Russian voice semantics", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      for (const sample of [
        { route: "/phonemes/es-a", file: "11-spanish.png" },
        { route: "/phonemes/fr-i", file: "12-french.png" },
        { route: "/phonemes/ru-a", file: "13-russian.png" },
      ]) {
        const dialog = await openGuidedRepeat(page, sample.route);
        await waitForPhase(dialog, "word-masculine-1");
        await dialog.locator('[data-smoke="guided-repeat-pause"]').click();
        await waitForPhase(dialog, "paused");
        await page.waitForTimeout(250);
        await page.screenshot({ path: output(sample.file) });
        await page.keyboard.press("Escape");
      }
    });

    test("captures completion and restart without scoring language", async ({
      page,
    }) => {
      test.setTimeout(45_000);
      await page.setViewportSize({ width: 1280, height: 800 });
      const dialog = await openGuidedRepeat(
        page,
        "/phonemes/ee?smokeGuidedRepeatSingleWord=1",
      );
      await dialog.locator('[data-rhythm="flow"]').click();
      await waitForPhase(dialog, "completed", 30_000);
      await expect(
        dialog.getByRole("button", { name: "\u518d\u6765\u4e00\u8f6e" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", {
          name: "\u8fd4\u56de\u97f3\u6807\u7ec3\u4e60",
        }),
      ).toBeVisible();
      await expect(dialog).toContainText("不代表系统已经判定掌握");
      await page.screenshot({ path: output("15-completed.png") });

      await dialog
        .getByRole("button", { name: "\u518d\u6765\u4e00\u8f6e" })
        .click();
      await waitForPhase(dialog, "anchor-single-1");
    });

    test("captures a local audio preparation error without an online fallback", async ({
      page,
    }) => {
      await page.route("**/audio/ipa/**", (route) => route.abort());
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/phonemes/ee");
      await page.locator('[data-smoke="guided-repeat-trigger"]').click();
      const dialog = page.locator('[data-smoke="guided-repeat-dialog"]');
      await expect(dialog).toBeVisible();
      await startGuidedRepeat(dialog);
      await expect(dialog.getByRole("alert")).toBeVisible();
      await page.screenshot({ path: output("14-local-audio-error.png") });
    });
  });
