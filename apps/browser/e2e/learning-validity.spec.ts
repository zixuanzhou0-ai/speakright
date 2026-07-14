import { expect, test } from "@playwright/test";

test("a new user reaches a valid offline ABX in two clicks with local audio only", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const audioUrls: string[] = [];
  const onlineFallbacks: string[] = [];
  const pronunciationWarnings: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/audio/words/") && url.endsWith(".mp3")) {
      audioUrls.push(url);
    }
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/pronunciation")) {
      onlineFallbacks.push(request.url());
    }
  });
  page.on("console", (message) => {
    if (
      message.type() === "warning" &&
      message.text().includes("Pronunciation")
    ) {
      pronunciationWarnings.push(message.text());
    }
  });

  await page.goto("/drill");
  await expect(page.getByText("离线辨音可开始")).toBeVisible();
  await page.locator('[data-smoke="drill-primary-action"]').click();

  const intro = page.locator('[data-smoke="pack-runner-intro-card"]');
  await expect(intro).toBeVisible();
  const startButton = intro.getByRole("button").first();
  const startBox = await startButton.boundingBox();
  expect(startBox).not.toBeNull();
  expect((startBox?.y ?? 9999) + (startBox?.height ?? 0)).toBeLessThanOrEqual(
    844,
  );
  await startButton.click();

  await expect(
    page.getByRole("heading", { name: "先听准，再说准" }),
  ).toBeVisible();
  for (const slot of ["A", "B", "X"] as const) {
    await page.getByRole("button", { name: slot, exact: true }).click();
    await expect
      .poll(() => audioUrls.length)
      .toBeGreaterThanOrEqual(slot === "A" ? 1 : slot === "B" ? 2 : 3);
  }

  expect(new Set(audioUrls).size).toBeGreaterThanOrEqual(3);
  const paths = audioUrls.map((url) => new URL(url).pathname);
  expect(paths[0]).not.toBe(paths[1]);
  expect(paths[0]).not.toBe(paths[2]);
  expect(paths[1]).not.toBe(paths[2]);
  expect(onlineFallbacks).toEqual([]);
  expect(pronunciationWarnings).toEqual([]);
  for (const label of ["X = A", "X = B"]) {
    const answerBox = await page
      .getByRole("button", { name: label })
      .boundingBox();
    expect(answerBox).not.toBeNull();
    expect(answerBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button", { name: "X = A" }).click();
  const evidence = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("speakright_learning_evidence_v3") ?? "{}"),
  );
  expect(evidence.evidence?.[0]).toMatchObject({
    version: 3,
    taskType: "perception",
    recordingQuality: { status: "not-applicable" },
    alignmentQuality: { status: "not-applicable" },
    evidenceStage: "introduced",
  });
});

test("mobile phoneme directory and selector can browse and switch to /ɪ/", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/phonemes");
  await expect(page.locator('[data-smoke="phoneme-directory"]')).toBeVisible();
  await page.getByPlaceholder("搜索 /ɪ/、短元音或 sit").fill("sit");
  await page.getByRole("link", { name: /ɪ/ }).first().click();

  await expect(page).toHaveURL(/\/phonemes\/ih$/);
  const selector = page.locator('[data-smoke="phoneme-mobile-selector"]');
  await expect(selector).toBeVisible();
  await selector.getByText("切换发音单位").click();
  await expect(selector.getByPlaceholder("搜索音标或示例词")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "上一个示例词" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "下一个示例词" }),
  ).toBeVisible();
});

test("free practice starts compact and Spanish deep routes retain Labs boundaries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sentences");
  await expect(page.getByRole("list", { name: "自由练习步骤" })).toBeVisible();
  await expect(page.getByText("AI 教练反馈")).toBeHidden();

  await page.goto("/settings");
  await page.locator('[data-language-id="es-ES"]').click();
  await page.goto("/drill/pack/ee-ih");
  await expect(page.getByText(/Labs/).first()).toBeVisible();
  await expect(
    page.getByText(/不会生成正式 mastery|不生成.*掌握/).first(),
  ).toBeVisible();
  await page.goto("/assessment");
  await expect(page.getByText(/Labs/).first()).toBeVisible();
});

test("a due retention task takes priority and does not reveal the answer", async ({
  page,
}) => {
  const now = Date.now();
  await page.addInitScript(
    ({ observedAt, dueAt }) => {
      localStorage.setItem(
        "speakright_retention_schedule_v1",
        JSON.stringify({
          version: 1,
          updatedAt: observedAt,
          tasks: [
            {
              id: `ee-ih-retention-24-${observedAt}`,
              packId: "ee-ih",
              sourceTransferEvidenceId: "transfer-e2e",
              scheduledDelayHours: 24,
              dueAt,
              materialIds: [
                "ee-ih-retention-24-word",
                "ee-ih-retention-24-word-2",
                "ee-ih-retention-24-sentence",
                "ee-ih-retention-24-prompt",
              ],
              attempts: [],
            },
          ],
        }),
      );
      localStorage.setItem(
        "speakright_training_exposure_v1",
        JSON.stringify({ version: 1, updatedAt: observedAt, exposures: [] }),
      );
    },
    {
      observedAt: now - 25 * 60 * 60 * 1_000,
      dueAt: now - 60 * 60 * 1_000,
    },
  );

  await page.goto("/drill");
  await expect(page.getByText("保持复测已到期")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "开始到期复测" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "开始到期复测" }).click();

  await expect(page).toHaveURL(/[/]drill[/]retention$/);
  await expect(page.locator('[data-smoke="retention-review"]')).toBeVisible();
  await expect(page.getByText("feature")).toBeVisible();
  await expect(page.getByText("不预播答案")).toBeVisible();
  await expect(page.getByRole("button", { name: /播放.*示范/ })).toHaveCount(0);
});

test("articulation cannot be completed by clicking through without motor work", async ({
  page,
}) => {
  const now = Date.now();
  await page.addInitScript(
    ({ timestamp }) => {
      localStorage.setItem(
        "speakright_deep_training_session_v1:ee-ih",
        JSON.stringify({
          version: 1,
          packId: "ee-ih",
          startedAt: timestamp,
          updatedAt: timestamp,
          phase: {
            type: "course",
            position: { levelIndex: 1, itemIndex: 0 },
          },
          perceptionTrials: [],
          perceptionCorrect: 0,
          perceptionTotal: 0,
          perceptionExtraRemaining: 0,
          levelStats: {},
        }),
      );
    },
    { timestamp: now },
  );

  await page.goto("/drill/pack/ee-ih");
  await expect(page.getByText("动作自检", { exact: true })).toBeVisible();
  const continueButton = page.getByRole("button", {
    name: "我能做出这个动作，下一步",
  });
  await expect(continueButton).toBeDisabled();

  for (const label of [
    "舌位与目标音提示一致",
    "双唇和下颌没有额外用力",
    "能感受到两个目标音的音质差异",
  ]) {
    await page.getByText(label, { exact: true }).click();
  }

  await expect(continueButton).toBeDisabled();
  await expect(page.getByText(/至少录制 2 段本人样本/)).toBeVisible();
  await expect(page.getByText("100")).toHaveCount(0);
});
