import { expect, test } from "@playwright/test";

test.describe("production fixture guard", () => {
  test.skip(
    process.env.SPEAKRIGHT_VERIFY_PRODUCTION_FIXTURES !== "1",
    "Runs only against a production build with test fixtures disabled.",
  );

  test("ignores smoke score query parameters in the publishable build", async ({
    page,
  }) => {
    await page.goto(
      "/phonemes/ee?smokeScoreSummary=1&smokeAssessmentTiles=1&smokeGuidedRepeatSingleWord=1",
    );

    await expect(
      page.locator('[data-smoke="phoneme-detail-page"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-smoke="assessment-breakdown-placeholder"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-smoke="assessment-phoneme-tile-fixture"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-smoke="phoneme-score-summary"]'),
    ).toHaveCount(0);
  });
});
