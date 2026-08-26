import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const HERMES_BRIDGE_URL = "http://127.0.0.1:17831";
const SHORT_AUDIO_FIXTURE = resolve(
  process.cwd(),
  "apps/browser/public/audio/words/blue/explosion.mp3",
);
const LONG_AUDIO_FIXTURE = resolve(
  process.cwd(),
  "apps/browser/public/audio/language-packs/es-ES/mi-perro-corre-por-la-plaza-la-nina-compra-4d4bed99c7.mp3",
);
const LONG_SENTENCE =
  "Repeat repeat clearly and calmly while keeping every word visible for the learner. ".padEnd(
    150,
    "Practice ",
  );

function buildSilentWavBase64(durationSeconds = 0.8, sampleRate = 16_000) {
  const sampleCount = Math.round(durationSeconds * sampleRate);
  const dataBytes = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataBytes, 40);
  return wav.toString("base64");
}

const completedViewports = [
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-360", width: 360, height: 800 },
] as const;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers":
    "Accept, Authorization, Content-Type, X-SpeakRight-Bridge-Token, xi-api-key",
};

async function configureHermesFixture(
  page: Page,
  audioFixture: "short" | "long" = "short",
  ttsErrorStatus?: number,
  alignedText?: string,
) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "speakright_standard_tts_config",
      JSON.stringify({ provider: "hermes-grok" }),
    );
  });

  await page.route(`${HERMES_BRIDGE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (url.pathname === "/health") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          available: true,
          provider: "xai",
          protocolVersion: 1,
          sessionToken: "free-practice-e2e-token",
        }),
      });
      return;
    }

    if (url.pathname === "/tts") {
      expect(request.headers()["x-speakright-bridge-token"]).toBe(
        "free-practice-e2e-token",
      );
      if (ttsErrorStatus) {
        await route.fulfill({
          status: ttsErrorStatus,
          contentType: "application/json",
          headers: corsHeaders,
          body: JSON.stringify({ error: "deterministic fixture failure" }),
        });
        return;
      }
      if (alignedText) {
        const characters = Array.from(alignedText);
        const characterStartTimes = characters.map((_, index) => index * 0.04);
        const characterEndTimes = characterStartTimes.map((start) => start + 0.04);
        const audioBase64 = readFileSync(
          audioFixture === "long" ? LONG_AUDIO_FIXTURE : SHORT_AUDIO_FIXTURE,
        ).toString("base64");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: corsHeaders,
          body: JSON.stringify({
            audioBase64,
            mimeType: "audio/mpeg",
            alignment: {
              characters,
              character_start_times_seconds: characterStartTimes,
              character_end_times_seconds: characterEndTimes,
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        headers: corsHeaders,
        path:
          audioFixture === "long" ? LONG_AUDIO_FIXTURE : SHORT_AUDIO_FIXTURE,
      });
      return;
    }

    await route.fulfill({ status: 404, headers: corsHeaders });
  });
}

async function configureVertexFixture(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "speakright_standard_tts_config",
      JSON.stringify({ provider: "vertex-gemini" }),
    );
    localStorage.setItem(
      "speakright_vertex_gemini_tts_config",
      JSON.stringify({ voiceName: "Kore" }),
    );
  });

  await page.route(`${HERMES_BRIDGE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (url.pathname === "/vertex/health") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          available: true,
          model: "gemini-3.1-flash-tts-preview",
          authReady: true,
          projectConfigured: true,
          protocolVersion: 1,
          sessionToken: "vertex-free-practice-e2e-token",
        }),
      });
      return;
    }

    if (url.pathname === "/vertex/tts") {
      expect(request.headers()["x-speakright-bridge-token"]).toBe(
        "vertex-free-practice-e2e-token",
      );
      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        headers: corsHeaders,
        path: SHORT_AUDIO_FIXTURE,
      });
      return;
    }

    await route.fulfill({ status: 404, headers: corsHeaders });
  });
}

function buildAlignment(text: string, durationSeconds: number) {
  const characters = Array.from(text);
  const step = durationSeconds / Math.max(characters.length, 1);
  return {
    characters,
    character_start_times_seconds: characters.map((_, index) => index * step),
    character_end_times_seconds: characters.map(
      (_, index) => (index + 1) * step,
    ),
  };
}

async function configureElevenLabsFixture(page: Page, text: string) {
  const audioBase64 = readFileSync(SHORT_AUDIO_FIXTURE).toString("base64");

  await page.addInitScript(() => {
    localStorage.setItem(
      "speakright_standard_tts_config",
      JSON.stringify({ provider: "elevenlabs" }),
    );
    sessionStorage.setItem(
      "speakright_elevenlabs_config",
      JSON.stringify({
        apiKey: "e2e-fixture-key",
        voiceId: "RaFzMbMIfqBcIurH6XF9",
        voiceName: "Eryn",
        modelId: "eleven_flash_v2_5",
      }),
    );
  });

  await page.route("https://api.elevenlabs.io/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    expect(request.url()).toContain("/with-timestamps");
    expect(request.headers()["xi-api-key"]).toBe("e2e-fixture-key");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({
        audio_base64: audioBase64,
        alignment: buildAlignment(text, 0.55),
      }),
    });
  });
}

async function configureMiniMaxFixture(page: Page, text: string) {
  const audioHex = readFileSync(LONG_AUDIO_FIXTURE).toString("hex");
  const subtitleUrl =
    "https://filecdn.minimax.chat/subtitles/speakright-e2e.json";
  const words = text.trim().split(/\s+/u);

  await page.addInitScript(() => {
    localStorage.setItem(
      "speakright_standard_tts_config",
      JSON.stringify({ provider: "minimax" }),
    );
    sessionStorage.setItem(
      "speakright_minimax_tts_config",
      JSON.stringify({
        apiKey: "minimax-e2e-key",
        modelId: "speech-2.8-turbo",
        voiceId: "English_expressive_narrator",
      }),
    );
  });

  await page.route("https://api.minimaxi.com/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    expect(request.headers().authorization).toBe("Bearer minimax-e2e-key");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({
        data: { audio: audioHex, subtitle_file: subtitleUrl },
        base_resp: { status_code: 0, status_msg: "success" },
      }),
    });
  });
  await page.route(subtitleUrl, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify(
        words.map((word, index) => ({
          text: word,
          time_begin: index * 180,
          time_end: index * 180 + 150,
        })),
      ),
    });
  });
}

async function configureMimoFixture(page: Page) {
  const audioBase64 = buildSilentWavBase64(2.5);
  await page.addInitScript(() => {
    localStorage.setItem(
      "speakright_standard_tts_config",
      JSON.stringify({ provider: "mimo" }),
    );
    sessionStorage.setItem(
      "speakright_mimo_tts_config",
      JSON.stringify({
        apiKey: "mimo-e2e-key",
        modelId: "mimo-v2.5-tts",
        voiceId: "Mia",
      }),
    );
  });

  await page.route("https://api.xiaomimimo.com/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    expect(request.headers().authorization).toBe("Bearer mimo-e2e-key");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({
        choices: [{ message: { audio: { data: audioBase64 } } }],
      }),
    });
  });
}

async function fillAndPlay(page: Page, text: string) {
  await page.goto("/sentences");
  await page.waitForLoadState("networkidle");
  const input = page.getByPlaceholder("输入单词或句子");
  await expect(input).toBeVisible();
  await input.fill(text);

  const listen = page.locator('[data-smoke="free-practice-listen-control"]');
  await expect(listen).toHaveAttribute("aria-label", "听标准发音");
  await expect(listen).toBeEnabled();
  await listen.click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    JSON.stringify(dimensions),
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectCardsDoNotIntersect(page: Page) {
  const input = page.locator('[data-smoke="sentence-input-card"]');
  const recording = page.locator('[data-smoke="sentence-recording-card"]');
  await expect(input).toBeVisible();
  await expect(recording).toBeAttached();

  const boxes = await Promise.all([
    input.boundingBox(),
    recording.boundingBox(),
  ]);
  const [inputBox, recordingBox] = boxes;
  expect(inputBox).not.toBeNull();
  expect(recordingBox).not.toBeNull();
  if (!inputBox || !recordingBox) return;

  const separated =
    inputBox.y + inputBox.height <= recordingBox.y + 1 ||
    recordingBox.y + recordingBox.height <= inputBox.y + 1;
  expect(
    separated,
    `input=${JSON.stringify(inputBox)} recording=${JSON.stringify(recordingBox)}`,
  ).toBe(true);
}

async function expectReplayDoesNotCoverWords(page: Page) {
  const result = await page
    .locator('[data-smoke="free-practice-tts-output"]')
    .evaluate((output) => {
      const replay = output.querySelector<HTMLElement>(
        '[data-smoke="free-practice-tts-replay"]',
      );
      const words = Array.from(
        output.querySelectorAll<HTMLElement>("[data-word-index]"),
      );
      if (!replay) return { replayFound: false, overlaps: [] as number[] };

      const replayRect = replay.getBoundingClientRect();
      const overlaps = words.flatMap((word, index) => {
        const wordRect = word.getBoundingClientRect();
        const horizontalOverlap =
          Math.max(replayRect.left, wordRect.left) <
          Math.min(replayRect.right, wordRect.right) - 0.5;
        const verticalOverlap =
          Math.max(replayRect.top, wordRect.top) <
          Math.min(replayRect.bottom, wordRect.bottom) - 0.5;
        return horizontalOverlap && verticalOverlap ? [index] : [];
      });
      return { replayFound: true, overlaps };
    });

  expect(result.replayFound).toBe(true);
  expect(result.overlaps, JSON.stringify(result)).toEqual([]);
}

async function expectRecordingAreaReachable(page: Page, desktop: boolean) {
  const leftColumn = page.locator('[data-smoke="free-practice-left-column"]');
  const recording = page.locator('[data-smoke="sentence-recording-card"]');

  if (desktop) {
    await leftColumn.evaluate((column) => {
      column.scrollTop = column.scrollHeight;
    });
    const visibleHeight = await recording.evaluate((card) => {
      const cardRect = card.getBoundingClientRect();
      const columnRect = card.parentElement?.getBoundingClientRect();
      if (!columnRect) return 0;
      return Math.max(
        0,
        Math.min(cardRect.bottom, columnRect.bottom) -
          Math.max(cardRect.top, columnRect.top),
      );
    });
    expect(visibleHeight).toBeGreaterThan(20);
    await leftColumn.evaluate((column) => {
      column.scrollTop = 0;
    });
  } else {
    await recording.scrollIntoViewIfNeeded();
    await expect(recording).toBeInViewport({ ratio: 0.1 });
    await page.locator("#main-content").evaluate((main) => {
      main.scrollTop = 0;
    });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
}

async function settleVisual(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.getByPlaceholder("输入单词或句子").evaluate((input) => {
    input.blur();
    input.scrollTop = 0;
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())),
    );
    document.querySelectorAll("nextjs-portal").forEach((portal) => {
      portal.remove();
    });
  });
}

test("Hermes untimed playback exposes a real sentence-level motion state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await configureHermesFixture(page, "long");
  await fillAndPlay(page, LONG_SENTENCE);

  const readAlong = page.locator('[data-smoke="read-along-text"]');
  await expect(readAlong).toHaveAttribute(
    "data-playback-mode",
    "sentence-untimed",
  );
  await expect(readAlong).toHaveAttribute("data-playing", "true");
  await expect(
    page.locator('[data-smoke="read-along-untimed-status"]'),
  ).toContainText("整句播放中");
  await expect(
    page.locator('[data-smoke="read-along-waveform-bar"]'),
  ).toHaveCount(4);
  await expect(
    page.locator('[data-smoke="read-along-waveform-bar"]').first(),
  ).toHaveAttribute("data-motion", "animated");
});

test("Hermes real alignment uses word-timed highlighting", async ({ page }) => {
  const text = "Repeat repeat clearly.";
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await configureHermesFixture(page, "short", undefined, text);
  await fillAndPlay(page, text);

  const readAlong = page.locator('[data-smoke="read-along-text"]');
  await expect(readAlong).toHaveAttribute("data-playback-mode", "word-timed");
  await expect(readAlong.locator("[data-word-index]")).toHaveCount(3);
  await expect(
    page.locator('[data-smoke="read-along-untimed-status"]'),
  ).toHaveCount(0);
});

for (const viewport of completedViewports) {
  test(`Hermes untimed completion remains unobscured at ${viewport.name}`, async ({
    page,
  }) => {
    expect(LONG_SENTENCE).toHaveLength(150);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(viewport);
    await configureHermesFixture(page);
    await fillAndPlay(page, LONG_SENTENCE);

    const output = page.locator('[data-smoke="free-practice-tts-output"]');
    const readAlong = page.locator('[data-smoke="read-along-text"]');
    const replay = page.locator('[data-smoke="free-practice-tts-replay"]');
    await expect(output).toBeVisible();
    await expect(readAlong).toHaveAttribute(
      "data-playback-mode",
      "sentence-untimed",
    );
    await expect(replay).toBeVisible({ timeout: 10_000 });
    await expect(readAlong).toHaveAttribute("data-playing", "false");
    await expect(
      page.locator('[data-smoke="read-along-untimed-status"]'),
    ).toBeHidden();

    await expectReplayDoesNotCoverWords(page);
    await expectCardsDoNotIntersect(page);
    await expectNoHorizontalOverflow(page);
    await expectRecordingAreaReachable(page, viewport.width >= 1024);
    await settleVisual(page);
    await expect(page).toHaveScreenshot(
      `free-practice-tts-complete-${viewport.name}.png`,
      { animations: "disabled", fullPage: false },
    );
  });
}

test("changing speed clears stale replay audio before a fresh generation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await configureHermesFixture(page);
  await fillAndPlay(page, "Keep this sentence ready for a clean speed change.");

  const output = page.locator('[data-smoke="free-practice-tts-output"]');
  const replay = page.locator('[data-smoke="free-practice-tts-replay"]');
  await expect(replay).toBeVisible({ timeout: 10_000 });

  const speed = page.getByRole("slider", { name: "语速" });
  await speed.focus();
  await page.keyboard.press("ArrowRight");
  await expect(speed).toHaveValue("0.9");
  await expect(output).toBeHidden();
  await expect(replay).toBeHidden();

  const listen = page.locator('[data-smoke="free-practice-listen-control"]');
  await listen.click();
  await expect(output).toBeVisible();
  await expect(replay).toBeVisible({ timeout: 10_000 });
});

test("Vertex untimed completion uses the same unobscured presentation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await configureVertexFixture(page);
  await fillAndPlay(
    page,
    "Vertex keeps this complete sentence visible after playback.",
  );

  const card = page.locator('[data-smoke="sentence-input-card"]');
  const readAlong = page.locator('[data-smoke="read-along-text"]');
  await expect(card).toHaveAttribute("data-tts-provider", "vertex-gemini");
  await expect(readAlong).toHaveAttribute(
    "data-playback-mode",
    "sentence-untimed",
  );
  await expect(
    page.locator('[data-smoke="free-practice-tts-replay"]'),
  ).toBeVisible({ timeout: 10_000 });
  await expect(readAlong).toHaveAttribute("data-playing", "false");
  await expectReplayDoesNotCoverWords(page);
  await expectCardsDoNotIntersect(page);
  await expectNoHorizontalOverflow(page);
  await settleVisual(page);
  await expect(page).toHaveScreenshot(
    "free-practice-tts-complete-vertex-desktop-1280.png",
    { animations: "disabled", fullPage: false },
  );
});

test("Hermes failure stays readable and never exposes stale replay", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await configureHermesFixture(page, "short", 500);
  await fillAndPlay(page, "Show a recoverable standard voice error clearly.");

  const error = page.locator('[data-smoke="free-practice-tts-error"]');
  await expect(error).toBeVisible();
  await expect(error).toContainText("生成失败");
  await expect(
    page.locator('[data-smoke="free-practice-tts-output"]'),
  ).toBeHidden();
  await expect(
    page.locator('[data-smoke="free-practice-tts-replay"]'),
  ).toBeHidden();
  await expectCardsDoNotIntersect(page);
  await expectNoHorizontalOverflow(page);
  await settleVisual(page);
  await expect(
    page.locator('[data-smoke="sentence-input-card"]'),
  ).toHaveScreenshot("free-practice-tts-error-hermes-desktop-1280.png", {
    animations: "disabled",
  });
});

test("ElevenLabs alignment keeps repeated words in word-timed mode", async ({
  page,
}) => {
  const text = "Repeat repeat clearly.";
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await configureElevenLabsFixture(page, text);
  await fillAndPlay(page, text);

  const readAlong = page.locator('[data-smoke="read-along-text"]');
  await expect(readAlong).toHaveAttribute("data-playback-mode", "word-timed");
  await expect(readAlong.locator("[data-word-index]")).toHaveCount(3);
  await expect(
    page.locator('[data-smoke="free-practice-tts-replay"]'),
  ).toBeVisible({ timeout: 10_000 });
  await expectReplayDoesNotCoverWords(page);
  await expectNoHorizontalOverflow(page);
});

test("MiniMax official subtitles drive exact word-timed playback", async ({
  page,
}) => {
  const text = "Repeat repeat clearly.";
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await configureMiniMaxFixture(page, text);
  await fillAndPlay(page, text);

  const card = page.locator('[data-smoke="sentence-input-card"]');
  const readAlong = page.locator('[data-smoke="read-along-text"]');
  await expect(card).toHaveAttribute("data-tts-provider", "minimax");
  await expect(readAlong).toHaveAttribute("data-playback-mode", "word-timed");
  await expect(readAlong).toHaveAttribute("data-playing", "true");
  await expect(readAlong.locator("[data-word-index]")).toHaveCount(3);
  await expect(
    readAlong.locator('[data-word-state="current"], [data-word-state="past"]'),
  ).not.toHaveCount(0);
  await expect(
    page.locator('[data-smoke="free-practice-tts-replay"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-smoke="read-along-untimed-status"]'),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("MiMo uses the honest sentence-level playback state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await configureMimoFixture(page);
  await fillAndPlay(page, "MiMo reads this complete sentence clearly.");

  const card = page.locator('[data-smoke="sentence-input-card"]');
  const readAlong = page.locator('[data-smoke="read-along-text"]');
  await expect(card).toHaveAttribute("data-tts-provider", "mimo");
  await expect(readAlong).toHaveAttribute(
    "data-playback-mode",
    "sentence-untimed",
  );
  await expect(readAlong).toHaveAttribute("data-playing", "true");
  await expect(
    page.locator('[data-smoke="read-along-untimed-status"]'),
  ).toContainText("整句播放中");
  await expect(readAlong.locator("[data-word-index]")).toHaveCount(6);
  await expect(readAlong.locator("[data-word-index]").first()).toHaveAttribute(
    "data-word-motion",
    "color-only",
  );
  await expect(
    page.locator('[data-smoke="free-practice-tts-replay"]'),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
