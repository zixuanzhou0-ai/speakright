import { expect, test } from "@playwright/test";

test("settings progressively discloses services, privacy, and Labs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");

  await expect(page.locator('[data-smoke="language-option"]')).toHaveCount(4);
  await expect(page.locator('[data-smoke="azure-scoring-card"]')).toBeHidden();

  await page.getByRole("tab", { name: "服务连接" }).click();
  await expect(page.locator('[data-smoke="azure-scoring-card"]')).toBeVisible();
  await expect(
    page.locator('[data-smoke="azure-missing-key-guidance"]'),
  ).toBeVisible();

  await page.getByRole("tab", { name: "数据与隐私" }).click();
  await expect(
    page.locator('[data-smoke="data-privacy-center"]'),
  ).toBeVisible();

  await page.getByRole("tab", { name: "高级 / Labs" }).click();
  await expect(page.locator('[data-smoke="release-status"]')).toBeVisible();
  await expect(
    page.locator('[data-smoke="language-availability-public-scope"]'),
  ).toBeVisible();
});

test("Spanish deep links remain explicitly inside Labs boundaries", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "speakright_language_config",
      JSON.stringify({ languageId: "es-ES" }),
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/drill");

  await expect(
    page.getByRole("heading", { name: /西语发音实验室 Labs/ }),
  ).toBeVisible();
  await expect(page.getByText(/不生成正式 mastery/)).toBeVisible();

  await page.getByRole("button", { name: "打开学习导航" }).click();
  const dialog = page.getByRole("dialog", { name: "学习导航" });
  await expect(dialog.getByRole("link", { name: "发音实验室" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "实验诊断" })).toBeVisible();

  await page.goto("/phonemes/es-a");
  await expect(
    page.getByText("Labs 仅显示整体与词级观测，不展示未校准的音素细分"),
  ).toBeVisible();
});

test("microphone denial shows a recoverable Chinese error", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) return;
    Object.defineProperty(mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/sentences");
  await page
    .getByPlaceholder("输入单词或句子")
    .fill("Please sit in this seat.");
  await page.getByRole("button", { name: "开始录音" }).click();
  await expect(
    page.locator('[data-smoke="free-practice-recorder-error"]'),
  ).toContainText("麦克风权限被拒绝");
  await expect(page.getByRole("button", { name: "开始录音" })).toBeEnabled();
});

test("keyboard skip link and settings tabs keep visible focus", async ({
  page,
}) => {
  await page.goto("/settings");
  const skipLink = page.getByRole("link", { name: "跳转到主内容" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const basic = page.getByRole("tab", { name: "基础设置" });
  const services = page.getByRole("tab", { name: "服务连接" });
  await basic.focus();
  await expect(basic).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(services).toBeFocused();
  await expect(services).toHaveAttribute("aria-selected", "true");
  await expect(services).toHaveAttribute(
    "aria-controls",
    "settings-panel-services",
  );
});

test("free-practice TTS shortcut deep-links to the provider selector", async ({
  page,
}) => {
  await page.goto("/settings?section=services#standard-tts");

  await expect(
    page.getByRole("tab", { name: "服务连接" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#standard-tts")).toBeVisible();
  await expect(
    page.locator('[data-smoke="tts-provider-selector"]'),
  ).toBeVisible();
});

test("cloud-processing disclosure deep-links to the privacy details", async ({
  page,
}) => {
  await page.goto("/settings?section=data#privacy-details");

  await expect(page.getByRole("tab", { name: "数据与隐私" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#privacy-details")).toBeVisible();
  await expect(page.getByText("SpeakRight 不运营第一方录音收集服务器")).toBeVisible();
});

test("dark mode and reduced motion do not block the primary flow", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/drill");

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.locator('[data-smoke="drill-primary-action"]'),
  ).toBeVisible();
  await page.locator('[data-smoke="drill-primary-action"]').focus();
  await expect(
    page.locator('[data-smoke="drill-primary-action"]'),
  ).toBeFocused();
});
