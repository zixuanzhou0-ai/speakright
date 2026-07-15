import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const instanceId = randomBytes(16).toString("hex");
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const address = probe.address();
    const selectedPort = typeof address === "object" ? address.port : null;
    probe.close((error) =>
      error || !selectedPort ? reject(error) : resolve(selectedPort),
    );
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const outputDirectory = path.resolve(
  root,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
  "promoted-review-qa",
);
const decisionsFileName = `promoted-human-auditory-decisions-visual-smoke-${instanceId}.json`;
const decisionsPath = path.resolve(
  root,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
  "regenerated-candidates",
  decisionsFileName,
);
const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

await mkdir(outputDirectory, { recursive: true });
await rm(decisionsPath, { force: true });

const server = spawn(
  process.execPath,
  [
    "scripts/promoted-audio-review-server.mjs",
    `--port=${port}`,
    `--decisions-file=${decisionsFileName}`,
    `--instance-id=${instanceId}`,
  ],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
let serverExited = false;
let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString("utf8");
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString("utf8");
});
const serverExit = new Promise((resolve) => {
  server.once("exit", (code, signal) => {
    serverExited = true;
    resolve({ code, signal });
  });
});

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const health = response.ok ? await response.json() : null;
      if (health?.instanceId === instanceId) return;
    } catch {}
    if (serverExited) {
      throw new Error(`Review server exited early:\n${serverOutput}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Promoted review server did not become ready");
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  const audioStatuses = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/audio/")) {
      audioStatuses.push(response.status());
    }
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const progress = document.querySelector("#progress")?.textContent?.trim();
    const audioSource = document.querySelector("audio")?.getAttribute("src");
    return Boolean(progress && audioSource);
  });
  await page.waitForFunction(() => {
    const audio = document.querySelector("audio");
    return Boolean(
      audio &&
        audio.readyState >= HTMLMediaElement.HAVE_METADATA &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0,
    );
  });
  const playback = await page.locator("#audio").evaluate(async (audio) => {
    audio.muted = true;
    await audio.play();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const currentTime = audio.currentTime;
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    return { duration: audio.duration, currentTime };
  });
  const blindApiPayload = await page.evaluate(async () => {
    const source = document.querySelector("audio")?.getAttribute("src");
    const reviewId = source?.split("/").at(-1);
    return fetch(`/api/item?reviewId=${encodeURIComponent(reviewId)}`).then(
      (response) => response.json(),
    );
  });
  const blindApiText = JSON.stringify(blindApiPayload);
  const forbiddenBlindFields = [
    "text",
    "canonicalIpa",
    "targetUnits",
    "phonemePageIds",
    "candidateId",
    "finalDecision",
  ];
  if (
    forbiddenBlindFields.some((field) =>
      Object.hasOwn(blindApiPayload, field),
    ) ||
    blindApiText.includes("machine-replaced-pending-human")
  ) {
    throw new Error(`Blind API leaked review evidence: ${blindApiText}`);
  }
  const blindSnapshot = await page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector("h1")?.textContent,
    progress: document.querySelector("#progress")?.textContent,
    revealHidden: document
      .querySelector("#reveal")
      ?.classList.contains("hidden"),
    horizontalOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    audioSource: document.querySelector("audio")?.getAttribute("src"),
    audioDuration: document.querySelector("audio")?.duration,
  }));
  if (
    blindSnapshot.heading !== "只根据耳朵判断" ||
    !blindSnapshot.revealHidden ||
    blindSnapshot.horizontalOverflow ||
    !blindSnapshot.audioSource ||
    !(playback.currentTime > 0) ||
    !(playback.duration > 0) ||
    audioStatuses.some((status) => status >= 400)
  ) {
    throw new Error(`Invalid blind UI: ${JSON.stringify(blindSnapshot)}`);
  }
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-blind.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
  ) {
    throw new Error("Promoted review UI overflows at 390px");
  }
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-blind.png"),
    fullPage: true,
  });
  await page.getByLabel("你实际听到的词").fill("visual-smoke-answer");
  await page.getByRole("button", { name: "提交盲听，再揭示答案" }).click();
  await page.locator("#reveal:not(.hidden)").waitFor();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: path.join(outputDirectory, "desktop-reveal.png"),
    fullPage: true,
  });
  const revealSnapshot = await page.evaluate(() => ({
    word: document.querySelector("#word")?.textContent,
    ipa: document.querySelector("#ipa")?.textContent,
    machine: document.querySelector("#signals")?.textContent,
    outcomeValue: document.querySelector("#outcome")?.value,
    alternateVisible: !document
      .querySelector("#alternate")
      ?.classList.contains("hidden"),
    horizontalOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  }));
  if (
    !revealSnapshot.word ||
    !revealSnapshot.ipa ||
    !revealSnapshot.machine?.includes("whisper") ||
    revealSnapshot.outcomeValue !== "" ||
    revealSnapshot.horizontalOverflow
  ) {
    throw new Error(`Invalid reveal UI: ${JSON.stringify(revealSnapshot)}`);
  }
  await page.getByLabel("真人听觉结论").selectOption("uncertain");
  await page.getByRole("button", { name: "保存结论并进入下一条" }).click();
  await page.waitForFunction(() =>
    document.querySelector("#progress")?.textContent?.includes("定稿 1/64"),
  );
  const savedDecisions = JSON.parse(await readFile(decisionsPath, "utf8"));
  const backupDecisions = JSON.parse(
    await readFile(`${decisionsPath}.bak`, "utf8"),
  );
  const [savedBlind] = Object.values(savedDecisions.blindReviews);
  const [savedFinal] = Object.values(savedDecisions.assets);
  if (
    savedDecisions.version !== 2 ||
    !/^[a-f0-9]{64}$/u.test(savedDecisions.bundleDigest) ||
    !savedBlind?.assetSha256 ||
    !savedBlind?.candidateId ||
    savedBlind.bundleDigest !== savedDecisions.bundleDigest ||
    !savedFinal?.assetSha256 ||
    savedFinal.assetSha256 !== savedBlind.assetSha256 ||
    savedFinal.candidateId !== savedBlind.candidateId ||
    savedFinal.bundleDigest !== savedDecisions.bundleDigest ||
    backupDecisions.version !== 2 ||
    Object.keys(backupDecisions.blindReviews).length !== 1
  ) {
    throw new Error("Saved human review evidence is not SHA/batch bound");
  }
  const tokenMatch = (await page.content()).match(
    /const reviewToken='([a-f0-9]+)'/u,
  );
  if (!tokenMatch) throw new Error("Review token was not found in local page");
  const mutationHeaders = {
    Origin: baseUrl,
    "X-Review-Token": tokenMatch[1],
    "Content-Type": "application/json",
  };
  for (let step = 0; step < 200; step += 1) {
    const progress = await fetch(`${baseUrl}/api/progress`).then((response) =>
      response.json(),
    );
    if (!progress.nextReviewId) break;
    const item = await fetch(
      `${baseUrl}/api/item?reviewId=${progress.nextReviewId}`,
    ).then((response) => response.json());
    const blindResponse = await fetch(`${baseUrl}/api/blind`, {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        reviewId: item.reviewId,
        heardText: `smoke-${item.reviewId}`,
        confidence: "medium",
      }),
    });
    if (!blindResponse.ok) {
      throw new Error(`Synthetic blind review failed: ${blindResponse.status}`);
    }
    const revealed = await blindResponse.json();
    if (!revealed.duplicate) {
      const finalResponse = await fetch(`${baseUrl}/api/final`, {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({
          reviewId: item.reviewId,
          humanOutcome: "uncertain",
        }),
      });
      if (!finalResponse.ok) {
        throw new Error(
          `Synthetic final review failed: ${finalResponse.status}`,
        );
      }
    }
  }
  const inconsistentProgress = await fetch(`${baseUrl}/api/progress`).then(
    (response) => response.json(),
  );
  if (
    !inconsistentProgress.recheckAvailable ||
    inconsistentProgress.inconsistentAssetIds.length !== 3
  ) {
    throw new Error("Hidden-repeat inconsistency did not reach recheck state");
  }
  const recheckResponse = await fetch(`${baseUrl}/api/recheck`, {
    method: "POST",
    headers: mutationHeaders,
  });
  const recheckProgress = await recheckResponse.json();
  if (
    !recheckResponse.ok ||
    recheckProgress.revisionCount !== 3 ||
    recheckProgress.blindCompleted !== 61 ||
    recheckProgress.finalCompleted !== 61 ||
    !recheckProgress.nextReviewId
  ) {
    throw new Error(
      `Hidden-repeat recheck recovery failed: ${JSON.stringify(recheckProgress)}`,
    );
  }
  if (errors.length > 0) {
    throw new Error(`Browser console errors: ${errors.join("; ")}`);
  }
  console.log(
    JSON.stringify(
      {
        passed: true,
        blindSnapshot,
        revealSnapshot,
        screenshots: [
          path.join(outputDirectory, "desktop-blind.png"),
          path.join(outputDirectory, "mobile-blind.png"),
          path.join(outputDirectory, "desktop-reveal.png"),
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  if (!serverExited) server.kill();
  await Promise.race([
    serverExit,
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (!serverExited) {
    server.kill("SIGKILL");
    await Promise.race([
      serverExit,
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
  if (!serverExited) {
    console.error("Visual smoke review server did not exit after SIGKILL");
    process.exitCode = 1;
  }
  await Promise.all(
    [decisionsPath, `${decisionsPath}.tmp`, `${decisionsPath}.bak`].map(
      (filePath) => rm(filePath, { force: true }),
    ),
  );
}
