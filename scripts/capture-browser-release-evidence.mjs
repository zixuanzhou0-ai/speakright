import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import { releaseEvidenceAssetSet } from "./lib/release-evidence-assets.mjs";
import {
  BROWSER_EVIDENCE_VIEWPORTS,
  EXAMPLE_SCORE_DISCLOSURE,
  evidenceBannerExpression,
  FREE_PRACTICE_DEMO_TEXT,
  RELEASE_EVIDENCE_SHOTS,
  RELEASE_EVIDENCE_VERSION,
  storageSeedExpression,
} from "./lib/release-evidence-fixtures.mjs";
import { releaseEvidenceOutputTree } from "./lib/release-evidence-output-tree.mjs";
import {
  releaseEvidenceGeneratorDigest,
  releaseEvidenceGeneratorGitProvenance,
  releaseEvidenceGitProvenance,
  releaseEvidenceSourceDigest,
} from "./lib/release-evidence-source-digest.mjs";

const root = process.cwd();
const GUIDED_REPEAT_CAPTURE_SAFE_MARGIN = 12;
const evidenceTempRoot = path.join(
  path.dirname(root),
  `${path.basename(root)}ReleaseEvidenceTemp`,
);
const defaultOutputRoot = path.join(
  root,
  "docs",
  "assets",
  "screenshots",
  "release",
  `v${RELEASE_EVIDENCE_VERSION}`,
  "browser",
);
const defaultBuildManifestPath = path.join(
  evidenceTempRoot,
  "browser-fixture-workspace",
  "build-manifest.json",
);

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function browserExecutable() {
  const explicit = readArgument("--browser-executable", "");
  const candidates = [
    explicit,
    path.join(
      process.env["ProgramFiles(x86)"] ?? "",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe",
    ),
    path.join(
      process.env.ProgramFiles ?? "",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe",
    ),
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe",
    ),
  ].filter(Boolean);
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(
      "No local Edge/Chrome executable found. Pass --browser-executable; do not install a browser only for evidence capture.",
    );
  }
  return match;
}

function assertLoopbackBaseUrl(value) {
  const parsed = new URL(value);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    !["127.0.0.1", "localhost", "::1"].includes(hostname)
  ) {
    throw new Error("Release evidence capture only accepts a loopback URL.");
  }
  return parsed.origin;
}

function assertOutputRoot(value) {
  const resolved = path.resolve(value);
  if (path.relative(defaultOutputRoot, resolved) !== "") {
    throw new Error(
      `Browser evidence output must be exactly ${defaultOutputRoot}.`,
    );
  }
  return resolved;
}

function assertEvidenceTempPath(value, label) {
  const resolved = path.resolve(value);
  const relative = path.relative(evidenceTempRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside ${evidenceTempRoot}.`);
  }
  return resolved;
}

function assertBuildManifest(manifest) {
  if (
    manifest.schemaVersion !== 1 ||
    manifest.version !== RELEASE_EVIDENCE_VERSION ||
    manifest.edition !== "browser" ||
    manifest.fixtureBuild !== true ||
    manifest.paidApiCalls !== false ||
    manifest.assetSet?.schemaVersion !== 1 ||
    !Number.isInteger(manifest.assetSet?.fileCount) ||
    manifest.assetSet.fileCount <= 0 ||
    !Number.isSafeInteger(manifest.assetSet?.totalBytes) ||
    manifest.assetSet.totalBytes <= 0 ||
    !/^[a-f0-9]{64}$/.test(manifest.assetSet?.pathDigestSha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(manifest.assetSet?.pathHashDigestSha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(manifest.assetSet?.registrySha256 ?? "") ||
    manifest.generatorSnapshot?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.generatorSnapshot?.sha256 ?? "") ||
    !Number.isInteger(manifest.generatorSnapshot?.fileCount) ||
    !Number.isSafeInteger(manifest.generatorSnapshot?.totalBytes) ||
    manifest.outputTree?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.outputTree?.sha256 ?? "") ||
    !Number.isInteger(manifest.outputTree?.fileCount) ||
    !Number.isSafeInteger(manifest.outputTree?.totalBytes) ||
    !/^[a-f0-9]{40}$/.test(manifest.sourceCommit ?? "") ||
    manifest.sourceWorktreeClean !== true ||
    manifest.sourceSnapshot?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.sourceSnapshot?.sha256 ?? "") ||
    !Number.isInteger(manifest.sourceSnapshot?.fileCount) ||
    manifest.sourceSnapshot.fileCount <= 0 ||
    manifest.output !== "apps/browser/out"
  ) {
    throw new Error("Browser evidence build provenance check failed.");
  }
}

async function assertCurrentGeneratorSnapshot(expected, expectedCommit) {
  releaseEvidenceGeneratorGitProvenance(root, expectedCommit);
  const current = await releaseEvidenceGeneratorDigest(root);
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error(
      "Release-evidence generator snapshot changed; rebuild first.",
    );
  }
  return current;
}

async function assertCurrentAssetSet(expected, expectedCommit) {
  const current = (
    await releaseEvidenceAssetSet(root, "browser", expectedCommit)
  ).summary;
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error(
      "Browser tracked release asset set changed after the isolated evidence build; rebuild before capture.",
    );
  }
  return current;
}

async function assertCurrentSourceSnapshot(expected, expectedCommit) {
  const provenance = releaseEvidenceGitProvenance(
    root,
    "browser",
    expectedCommit,
  );
  const current = await releaseEvidenceSourceDigest(root, "browser");
  if (
    current.schemaVersion !== expected.schemaVersion ||
    current.sha256 !== expected.sha256 ||
    current.fileCount !== expected.fileCount
  ) {
    throw new Error(
      "Browser source changed after the isolated evidence build; rebuild before capture.",
    );
  }
  return provenance;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function pngDimensions(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("Captured evidence is not a PNG image.");
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function settle(page) {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const image of document.images) {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}

async function assertFreePracticeText(page, label) {
  const textbox = page.getByRole("textbox", { name: "练习文本" });
  await page.waitForFunction((expected) => {
    const textarea = document.querySelector('textarea[aria-label="练习文本"]');
    return (
      textarea instanceof HTMLTextAreaElement && textarea.value === expected
    );
  }, FREE_PRACTICE_DEMO_TEXT);
  const inputValue = await textbox.inputValue();
  if (inputValue !== FREE_PRACTICE_DEMO_TEXT) {
    throw new Error(
      `${label} free-practice text mismatch: ${JSON.stringify(inputValue)}`,
    );
  }
}

async function focusMobileGuidedRepeat(page, shot, viewport) {
  if (shot.id !== "guided-repeat" || viewport.width >= 1024) return;
  await page.evaluate(async () => {
    const setup = document.querySelector('[data-smoke="guided-repeat-setup"]');
    const cta = document.querySelector('[data-smoke="guided-repeat-start"]');
    if (!(setup instanceof HTMLElement) || !(cta instanceof HTMLElement)) {
      throw new Error("Guided-repeat mobile capture target is missing.");
    }
    setup.scrollTo({
      behavior: "instant",
      left: 0,
      top: Math.max(0, setup.scrollHeight - setup.clientHeight),
    });
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}

async function prepareShot(page, shot, viewport) {
  await page.goto(shot.route, { waitUntil: "load" });

  if (shot.id === "guided-repeat") {
    await page.locator('[data-smoke="guided-repeat-trigger"]').click();
  } else if (shot.id === "free-practice") {
    const textbox = page.getByRole("textbox", { name: "练习文本" });
    await textbox.waitFor({ state: "visible" });
    await settle(page);
    await page.waitForTimeout(250);
    await textbox.fill(FREE_PRACTICE_DEMO_TEXT);
    await assertFreePracticeText(page, "post-fill");
  } else if (shot.id === "diagnosis-example") {
    await page.getByRole("button", { name: "查看上次报告" }).click();
  }

  const ready = page.locator(shot.readySelector).first();
  await ready.waitFor({ state: "visible" });
  await settle(page);
  await page.waitForTimeout(150);
  const bannerPlacement = await page.evaluate(
    evidenceBannerExpression(shot.bannerKind, shot.id, shot.readySelector),
  );
  if (!bannerPlacement?.ok) {
    throw new Error(
      `Evidence banner overlaps content on ${shot.id}: ${JSON.stringify(bannerPlacement)}`,
    );
  }

  await focusMobileGuidedRepeat(page, shot, viewport);

  if (shot.bannerKind === "example-score") {
    const banner = page.locator(
      '[data-release-evidence-banner="example-score"]',
    );
    await banner.waitFor({ state: "visible" });
    if ((await banner.textContent()) !== EXAMPLE_SCORE_DISCLOSURE) {
      throw new Error(`Missing score disclosure on ${shot.id}.`);
    }
  }
  if (shot.id === "free-practice") {
    await assertFreePracticeText(page, "pre-screenshot");
  }
  return bannerPlacement;
}

async function measureLayoutGeometry(page, shot, viewport) {
  return page.evaluate(
    ({ captureGuidedRepeat, guidedRepeatSafeMargin }) => {
      const rectangle = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const overlaps = (left, right) =>
        Boolean(
          left &&
            right &&
            Math.max(left.left, right.left) <
              Math.min(left.right, right.right) &&
            Math.max(left.top, right.top) < Math.min(left.bottom, right.bottom),
        );
      const heading = rectangle(document.querySelector("#main-content h1"));
      const main = document.querySelector("#main-content");
      const appShell = main?.parentElement;
      const titlebar = rectangle(appShell?.previousElementSibling);
      const desktopSidebar = rectangle(
        [...(appShell?.querySelectorAll("aside") ?? [])].find((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && rect.width > 0 && rect.height > 0;
        }),
      );
      const mobileNavigationCandidate = rectangle(
        document.querySelector('[aria-label="打开学习导航"]')?.closest("div"),
      );
      const mobileNavigation =
        mobileNavigationCandidate?.width > 0 &&
        mobileNavigationCandidate?.height > 0
          ? mobileNavigationCandidate
          : null;
      const tolerance = 0.75;
      const rectangleInsideViewport = (rect) =>
        Boolean(
          rect &&
            rect.left >= -tolerance &&
            rect.top >= -tolerance &&
            rect.right <= window.innerWidth + tolerance &&
            rect.bottom <= window.innerHeight + tolerance,
        );
      const titlebarComplete =
        rectangleInsideViewport(titlebar) &&
        Math.abs(titlebar.left) <= tolerance &&
        Math.abs(titlebar.top) <= tolerance &&
        Math.abs(titlebar.right - window.innerWidth) <= tolerance &&
        titlebar.height >= 35;
      const navigationComplete = mobileNavigation
        ? rectangleInsideViewport(mobileNavigation) &&
          mobileNavigation.top >= titlebar.bottom - tolerance &&
          mobileNavigation.height >= 47
        : desktopSidebar
          ? rectangleInsideViewport(desktopSidebar) &&
            desktopSidebar.top >= titlebar.bottom - tolerance
          : false;
      let guidedRepeatFocus = null;
      if (captureGuidedRepeat) {
        const ctaElement = document.querySelector(
          '[data-smoke="guided-repeat-start"]',
        );
        const planElement = ctaElement?.parentElement;
        const setupElement = document.querySelector(
          '[data-smoke="guided-repeat-setup"]',
        );
        const cta = rectangle(ctaElement);
        const plan = rectangle(planElement);
        const ctaSafetyMarginPx = cta
          ? Math.min(
              cta.left,
              cta.top,
              window.innerWidth - cta.right,
              window.innerHeight - cta.bottom,
            )
          : Number.NEGATIVE_INFINITY;
        guidedRepeatFocus = {
          cta,
          plan,
          ctaSafetyMarginPx,
          requiredSafetyMarginPx: guidedRepeatSafeMargin,
          ctaWithinViewport:
            rectangleInsideViewport(cta) &&
            ctaSafetyMarginPx >= guidedRepeatSafeMargin,
          planWithinViewport: rectangleInsideViewport(plan),
          setupScrollTop:
            setupElement instanceof HTMLElement ? setupElement.scrollTop : null,
        };
      }
      return {
        heading,
        titlebar,
        desktopSidebar,
        mobileNavigation,
        navigationTitleOverlap: overlaps(heading, mobileNavigation),
        globalChromeWithinViewport: titlebarComplete && navigationComplete,
        windowScroll: { x: window.scrollX, y: window.scrollY },
        mainScrollTop: main?.scrollTop ?? null,
        guidedRepeatFocus,
      };
    },
    {
      captureGuidedRepeat: shot.id === "guided-repeat" && viewport.width < 1024,
      guidedRepeatSafeMargin: GUIDED_REPEAT_CAPTURE_SAFE_MARGIN,
    },
  );
}

async function proveFixtureBuild(page) {
  await page.goto("/phonemes/ee?smokeScoreSummary=1&smokeAssessmentTiles=1", {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator('[data-smoke="phoneme-score-summary"]')
    .waitFor({ state: "visible" });
  await page
    .locator('[data-smoke="assessment-phoneme-tile-fixture"]')
    .waitFor({ state: "visible" });
}

async function main() {
  const baseURL = assertLoopbackBaseUrl(
    readArgument("--base-url", "http://127.0.0.1:4173"),
  );
  const outputRoot = assertOutputRoot(
    readArgument("--output-root", defaultOutputRoot),
  );
  const buildManifestPath = assertEvidenceTempPath(
    readArgument("--build-manifest", defaultBuildManifestPath),
    "Browser evidence build manifest",
  );
  const buildManifestBuffer = await readFile(buildManifestPath);
  const buildManifest = JSON.parse(buildManifestBuffer.toString("utf8"));
  assertBuildManifest(buildManifest);
  await assertCurrentSourceSnapshot(
    buildManifest.sourceSnapshot,
    buildManifest.sourceCommit,
  );
  await assertCurrentAssetSet(
    buildManifest.assetSet,
    buildManifest.sourceCommit,
  );
  await assertCurrentGeneratorSnapshot(
    buildManifest.generatorSnapshot,
    buildManifest.sourceCommit,
  );
  const isolatedOutputRoot = assertEvidenceTempPath(
    path.join(path.dirname(buildManifestPath), buildManifest.output),
    "Browser evidence output",
  );
  const outputTree = await releaseEvidenceOutputTree(isolatedOutputRoot);
  if (JSON.stringify(outputTree) !== JSON.stringify(buildManifest.outputTree)) {
    throw new Error("Browser output tree differs from its build manifest.");
  }
  const servedTreeResponse = await fetch(
    new URL("/.well-known/speakright-release-evidence-tree.json", baseURL),
  );
  if (
    !servedTreeResponse.ok ||
    JSON.stringify(await servedTreeResponse.json()) !==
      JSON.stringify(outputTree)
  ) {
    throw new Error(
      "Browser evidence server is not serving the bound output tree.",
    );
  }
  const servedIndexResponse = await fetch(new URL("/index.html", baseURL));
  if (!servedIndexResponse.ok) {
    throw new Error(
      "Browser evidence server did not return its index document.",
    );
  }
  await servedIndexResponse.arrayBuffer();
  const browser = await chromium.launch({
    args: [
      "--disable-background-networking",
      "--disable-component-update",
      "--no-first-run",
    ],
    executablePath: browserExecutable(),
    headless: true,
  });
  const browserVersion = browser.version();
  const blockedRequests = new Set();
  const artifacts = [];

  try {
    const context = await browser.newContext({
      baseURL,
      colorScheme: "light",
      locale: "zh-CN",
      reducedMotion: "reduce",
      serviceWorkers: "block",
      timezoneId: "America/Los_Angeles",
    });
    await context.addInitScript(storageSeedExpression());
    await context.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (
        ["http:", "https:"].includes(requestUrl.protocol) &&
        requestUrl.origin !== baseURL
      ) {
        blockedRequests.add(requestUrl.origin);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.setViewportSize(BROWSER_EVIDENCE_VIEWPORTS[0]);
    await proveFixtureBuild(page);

    for (const viewport of BROWSER_EVIDENCE_VIEWPORTS) {
      await page.setViewportSize(viewport);
      const viewportDir = path.join(outputRoot, viewport.id);
      await mkdir(viewportDir, { recursive: true });

      for (const shot of RELEASE_EVIDENCE_SHOTS) {
        const bannerGeometry = await prepareShot(page, shot, viewport);
        const layoutGeometry = await measureLayoutGeometry(
          page,
          shot,
          viewport,
        );
        const expectsGuidedRepeatFocus =
          shot.id === "guided-repeat" && viewport.width < 1024;
        if (
          expectsGuidedRepeatFocus &&
          (!layoutGeometry.guidedRepeatFocus?.ctaWithinViewport ||
            !layoutGeometry.guidedRepeatFocus?.planWithinViewport ||
            layoutGeometry.guidedRepeatFocus.ctaSafetyMarginPx <
              GUIDED_REPEAT_CAPTURE_SAFE_MARGIN)
        ) {
          throw new Error(
            `Guided-repeat CTA capture is clipped on ${viewport.id}: ${JSON.stringify(layoutGeometry.guidedRepeatFocus)}`,
          );
        }
        if (
          !expectsGuidedRepeatFocus &&
          layoutGeometry.guidedRepeatFocus !== null
        ) {
          throw new Error(
            `Unexpected guided-repeat mobile focus geometry on ${viewport.id} ${shot.id}.`,
          );
        }
        if (layoutGeometry.navigationTitleOverlap) {
          throw new Error(
            `Mobile navigation overlaps the page title on ${viewport.id} ${shot.id}: ${JSON.stringify(layoutGeometry)}`,
          );
        }
        if (!layoutGeometry.globalChromeWithinViewport) {
          throw new Error(
            `Global Browser chrome is clipped on ${viewport.id} ${shot.id}: ${JSON.stringify(layoutGeometry)}`,
          );
        }
        if (
          layoutGeometry.windowScroll.x !== 0 ||
          layoutGeometry.windowScroll.y !== 0
        ) {
          throw new Error(
            `Browser evidence scrolled the outer window on ${viewport.id} ${shot.id}: ${JSON.stringify(layoutGeometry.windowScroll)}`,
          );
        }
        const buffer = await page.screenshot({
          animations: "disabled",
          fullPage: false,
          type: "png",
        });
        const dimensions = pngDimensions(buffer);
        if (
          dimensions.width !== viewport.width ||
          dimensions.height !== viewport.height
        ) {
          throw new Error(
            `${shot.id} captured at ${dimensions.width}x${dimensions.height}; expected ${viewport.id}.`,
          );
        }
        const outputPath = path.join(viewportDir, `${shot.id}.png`);
        await writeFile(outputPath, buffer);
        artifacts.push({
          edition: "browser",
          viewport: viewport.id,
          id: shot.id,
          path: path.relative(root, outputPath).replaceAll("\\", "/"),
          width: dimensions.width,
          height: dimensions.height,
          sha256: sha256(buffer),
          geometry: {
            banner: bannerGeometry.rect,
            bannerCollisions: bannerGeometry.collisions.length,
            bannerWithinViewport: bannerGeometry.withinViewport,
            bannerOccludedPoints: bannerGeometry.occludedPoints.length,
            ...layoutGeometry,
          },
          scoreDisclosure:
            shot.bannerKind === "example-score"
              ? EXAMPLE_SCORE_DISCLOSURE
              : null,
        });
        console.log(`Captured Browser ${viewport.id} ${shot.id}`);
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }
  await assertCurrentSourceSnapshot(
    buildManifest.sourceSnapshot,
    buildManifest.sourceCommit,
  );
  const assetSet = await assertCurrentAssetSet(
    buildManifest.assetSet,
    buildManifest.sourceCommit,
  );
  const generatorSnapshot = await assertCurrentGeneratorSnapshot(
    buildManifest.generatorSnapshot,
    buildManifest.sourceCommit,
  );
  const postCaptureOutputTree =
    await releaseEvidenceOutputTree(isolatedOutputRoot);
  if (JSON.stringify(postCaptureOutputTree) !== JSON.stringify(outputTree)) {
    throw new Error("Browser output tree changed during evidence capture.");
  }

  const manifestPath = path.join(outputRoot, "manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        version: RELEASE_EVIDENCE_VERSION,
        edition: "browser",
        fixtureBuildRequired: true,
        paidApiCalls: false,
        assetSet,
        generatorSnapshot,
        outputTree,
        sourceCommit: buildManifest.sourceCommit,
        sourceWorktreeClean: true,
        sourceSnapshot: buildManifest.sourceSnapshot,
        buildManifestSha256: sha256(buildManifestBuffer),
        browserVersion,
        blockedExternalOrigins: [...blockedRequests].sort(),
        artifacts,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Browser release evidence manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
