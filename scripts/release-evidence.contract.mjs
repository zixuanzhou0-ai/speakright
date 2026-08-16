import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isExactWindowsSettingsStorePath } from "./capture-desktop-release-evidence.mjs";
import { releaseEvidenceAssetSet } from "./lib/release-evidence-assets.mjs";
import {
  BROWSER_EVIDENCE_VIEWPORTS,
  DESKTOP_EVIDENCE_BROWSER_ARGUMENTS,
  DESKTOP_EVIDENCE_VIEWPORTS,
  EXAMPLE_SCORE_DISCLOSURE,
  RELEASE_EVIDENCE_SHOTS,
  RELEASE_EVIDENCE_STORAGE,
  RELEASE_EVIDENCE_VERSION,
} from "./lib/release-evidence-fixtures.mjs";
import {
  releaseEvidenceGeneratorDigest,
  releaseEvidenceGeneratorGitProvenance,
  releaseEvidenceGitProvenance,
  releaseEvidenceSourceDigest,
} from "./lib/release-evidence-source-digest.mjs";

const root = process.cwd();
const requireArtifacts = process.argv.includes("--artifacts");
const requireBrowserArtifacts = process.argv.includes("--browser-artifacts");
assert.equal(
  requireArtifacts && requireBrowserArtifacts,
  false,
  "Choose --artifacts or --browser-artifacts, not both",
);
const unknownArguments = process.argv
  .slice(2)
  .filter(
    (argument) =>
      argument !== "--artifacts" && argument !== "--browser-artifacts",
  );
assert.deepEqual(unknownArguments, [], "Unknown release evidence arguments");

for (const contract of [
  "release-evidence-assets.contract.mjs",
  "release-evidence-generator.contract.mjs",
  "release-evidence-output-tree.contract.mjs",
]) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts", contract)],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  assert.equal(
    result.status,
    0,
    `${contract} failed:\n${result.stderr || result.stdout}`,
  );
}

assert.deepEqual(
  BROWSER_EVIDENCE_VIEWPORTS.map((item) => item.id),
  ["1280x800", "390x844", "360x800"],
);
assert.deepEqual(
  DESKTOP_EVIDENCE_VIEWPORTS.map((item) => item.id),
  ["1280x920", "1024x800"],
);
assert.deepEqual(
  RELEASE_EVIDENCE_SHOTS.map((item) => item.id),
  [
    "guided-repeat",
    "free-practice",
    "diagnosis-example",
    "settings",
    "progress-example",
    "no-key",
  ],
);
assert.equal(
  EXAMPLE_SCORE_DISCLOSURE,
  "示例数据 / Example data — not a live Azure score",
);
assert.deepEqual(Object.keys(RELEASE_EVIDENCE_STORAGE).sort(), [
  "speakright_assessment_result_v2:en-US",
  "speakright_language_config",
  "speakright_learning_evidence_v3",
  "speakright_mastery_profile_v2",
  "speakright_training_sessions_v2",
  "theme",
]);
const learningEvidence = JSON.parse(
  RELEASE_EVIDENCE_STORAGE.speakright_learning_evidence_v3,
);
assert.equal(learningEvidence.version, 3);
assert.equal(learningEvidence.evidence.length, 3);
assert.ok(
  learningEvidence.evidence.every(
    (item) =>
      item.calibrationVersion === "release-evidence-fixture-v1" &&
      item.source === "training",
  ),
);

for (const sourcePath of [
  "src/app/phonemes/[phoneme]/phoneme-detail-page.tsx",
  "apps/browser/src/app/phonemes/[phoneme]/phoneme-detail-page.tsx",
]) {
  const source = await readFile(path.join(root, sourcePath), "utf8");
  assert.match(
    source,
    /process\.env\.NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES === "1"/,
    `${sourcePath} must retain the compile-time fixture gate`,
  );
}

for (const scriptPath of [
  "scripts/capture-browser-release-evidence.mjs",
  "scripts/capture-desktop-release-evidence.mjs",
]) {
  const source = await readFile(path.join(root, scriptPath), "utf8");
  assert.match(source, /proveFixtureBuild/);
  assert.match(source, /smokeScoreSummary=1/);
  assert.match(source, /EXAMPLE_SCORE_DISCLOSURE/);
}

const browserCaptureSource = await readFile(
  path.join(root, "scripts/capture-browser-release-evidence.mjs"),
  "utf8",
);
assert.match(browserCaptureSource, /GUIDED_REPEAT_CAPTURE_SAFE_MARGIN = 12/);
assert.match(browserCaptureSource, /guidedRepeatFocus/);
assert.match(browserCaptureSource, /Guided-repeat CTA capture is clipped/);

const canonicalSettingsDirectory = "C:\\Temp\\speakright-run\\settings";
for (const accepted of [
  "C:\\Temp\\speakright-run\\settings\\speakright-settings.json",
  "\\\\?\\C:\\Temp\\speakright-run\\settings\\speakright-settings.json",
  "c:/TEMP/SPEAKRIGHT-RUN/SETTINGS/SPEAKRIGHT-SETTINGS.JSON",
]) {
  assert.equal(
    isExactWindowsSettingsStorePath(accepted, canonicalSettingsDirectory),
    true,
    `Expected the canonical settings identity to be accepted: ${accepted}`,
  );
}
for (const rejected of [
  "C:\\Temp\\speakright-run\\settings-other\\speakright-settings.json",
  "C:\\Temp\\speakright-run\\settings\\sibling.json",
  "C:\\Temp\\speakright-run\\settings\\..\\settings\\speakright-settings.json",
  "\\\\server\\share\\speakright-settings.json",
  "\\\\?\\UNC\\server\\share\\speakright-settings.json",
  "C:\\Temp\\speakright-run\\settings-prefix\\speakright-settings.json",
]) {
  assert.equal(
    isExactWindowsSettingsStorePath(rejected, canonicalSettingsDirectory),
    false,
    `Expected the non-canonical settings identity to be rejected: ${rejected}`,
  );
}

function pngDimensions(buffer) {
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    "Invalid PNG signature",
  );
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function assertRecord(value, label) {
  assert.equal(
    typeof value === "object" && value !== null && !Array.isArray(value),
    true,
    `${label} must be an object`,
  );
}

function assertExactKeys(value, expected, label) {
  assertRecord(value, label);
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expected].sort(),
    `${label} has an unexpected schema`,
  );
}

function assertSha256(value, label) {
  assert.match(value, /^[0-9a-f]{64}$/, `${label} must be a SHA-256 digest`);
}

function repositoryPath(relativePath, label) {
  assert.equal(typeof relativePath, "string", `${label} must be a string`);
  assert.equal(relativePath, relativePath.trim(), `${label} has whitespace`);
  assert.equal(relativePath.includes("\\"), false, `${label} uses backslashes`);
  assert.doesNotMatch(relativePath, /[:\0]/, `${label} has unsafe characters`);
  assert.equal(
    path.posix.isAbsolute(relativePath),
    false,
    `${label} is absolute`,
  );
  assert.equal(
    path.win32.isAbsolute(relativePath),
    false,
    `${label} is absolute`,
  );
  assert.equal(
    path.posix.normalize(relativePath),
    relativePath,
    `${label} is not normalized`,
  );
  assert.equal(
    relativePath.split("/").some((segment) => segment === ".." || !segment),
    false,
    `${label} escapes the repository`,
  );
  const absolute = path.resolve(root, ...relativePath.split("/"));
  const rootPrefix = `${path.resolve(root).toLowerCase()}${path.sep}`;
  assert.equal(
    absolute.toLowerCase().startsWith(rootPrefix),
    true,
    `${label} escapes the repository`,
  );
  return absolute;
}

async function pngFilesBelow(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(
        ...(await pngFilesBelow(path.join(directory, entry.name), relative)),
      );
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      files.push(relative);
    }
  }
  return files.sort();
}

function assertStringArray(value, label) {
  assert.equal(Array.isArray(value), true, `${label} must be an array`);
  assert.equal(
    value.every((item) => typeof item === "string"),
    true,
    `${label} must contain strings`,
  );
}

async function validateScreenshotManifest(edition, viewports) {
  const editionRelativeRoot = `docs/assets/screenshots/release/v${RELEASE_EVIDENCE_VERSION}/${edition}`;
  const editionRoot = repositoryPath(
    editionRelativeRoot,
    `${edition} evidence root`,
  );
  const manifestRelativePath = `${editionRelativeRoot}/manifest.json`;
  const manifest = JSON.parse(
    await readFile(
      repositoryPath(manifestRelativePath, `${edition} manifest path`),
      "utf8",
    ),
  );
  assertRecord(manifest, `${edition} manifest`);
  assertExactKeys(
    manifest,
    edition === "browser"
      ? [
          "schemaVersion",
          "version",
          "edition",
          "fixtureBuildRequired",
          "paidApiCalls",
          "assetSet",
          "generatorSnapshot",
          "outputTree",
          "sourceCommit",
          "sourceWorktreeClean",
          "sourceSnapshot",
          "buildManifestSha256",
          "browserVersion",
          "blockedExternalOrigins",
          "artifacts",
        ]
      : [
          "schemaVersion",
          "version",
          "edition",
          "fixtureBuildRequired",
          "paidApiCalls",
          "assetSet",
          "generatorSnapshot",
          "captureTransport",
          "sourceCommit",
          "sourceWorktreeClean",
          "sourceSnapshot",
          "buildManifestSha256",
          "credentialNamespace",
          "nativeHttpAttempts",
          "secureStoreSlotsEmpty",
          "runtimeIsolation",
          "networkGuard",
          "executable",
          "networkPolicy",
          "attemptedExternalOrigins",
          "successfulExternalOrigins",
          "artifacts",
        ],
    `${edition} manifest`,
  );
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.version, RELEASE_EVIDENCE_VERSION);
  assert.equal(manifest.edition, edition);
  assert.equal(manifest.fixtureBuildRequired, true);
  assert.equal(manifest.paidApiCalls, false);
  const currentProvenance = releaseEvidenceGitProvenance(
    root,
    edition,
    manifest.sourceCommit,
  );
  assert.equal(manifest.sourceCommit, currentProvenance.commit);
  assert.equal(manifest.sourceWorktreeClean, true);
  assertSha256(manifest.buildManifestSha256, `${edition} build manifest`);
  assertExactKeys(
    manifest.sourceSnapshot,
    ["schemaVersion", "sha256", "fileCount"],
    `${edition} source snapshot`,
  );
  assert.equal(manifest.sourceSnapshot.schemaVersion, 1);
  assertSha256(manifest.sourceSnapshot.sha256, `${edition} source snapshot`);
  assert.equal(Number.isInteger(manifest.sourceSnapshot.fileCount), true);
  assert.ok(manifest.sourceSnapshot.fileCount > 0);
  assert.deepEqual(
    manifest.sourceSnapshot,
    await releaseEvidenceSourceDigest(root, edition),
    `${edition} evidence was not built from the current source snapshot`,
  );
  assertExactKeys(
    manifest.generatorSnapshot,
    ["schemaVersion", "sha256", "fileCount", "totalBytes"],
    `${edition} generator snapshot`,
  );
  assert.equal(manifest.generatorSnapshot.schemaVersion, 1);
  assertSha256(manifest.generatorSnapshot.sha256, `${edition} generators`);
  assert.ok(manifest.generatorSnapshot.fileCount > 0);
  assert.ok(manifest.generatorSnapshot.totalBytes > 0);
  releaseEvidenceGeneratorGitProvenance(root, manifest.sourceCommit);
  assert.deepEqual(
    manifest.generatorSnapshot,
    await releaseEvidenceGeneratorDigest(root),
    `${edition} generator snapshot differs from sourceCommit`,
  );
  assertExactKeys(
    manifest.assetSet,
    [
      "schemaVersion",
      "fileCount",
      "totalBytes",
      "pathDigestSha256",
      "pathHashDigestSha256",
      "registrySha256",
    ],
    `${edition} asset set`,
  );
  assert.equal(manifest.assetSet.schemaVersion, 1);
  assert.equal(Number.isInteger(manifest.assetSet.fileCount), true);
  assert.ok(manifest.assetSet.fileCount > 0);
  assert.equal(Number.isSafeInteger(manifest.assetSet.totalBytes), true);
  assert.ok(manifest.assetSet.totalBytes > 0);
  assertSha256(manifest.assetSet.pathDigestSha256, `${edition} asset paths`);
  assertSha256(
    manifest.assetSet.pathHashDigestSha256,
    `${edition} asset path/hash pairs`,
  );
  assertSha256(manifest.assetSet.registrySha256, `${edition} asset registry`);
  assert.deepEqual(
    manifest.assetSet,
    (await releaseEvidenceAssetSet(root, edition, manifest.sourceCommit))
      .summary,
    `${edition} evidence asset set differs from current tracked release assets`,
  );

  if (edition === "browser") {
    assertExactKeys(
      manifest.outputTree,
      ["schemaVersion", "sha256", "fileCount", "totalBytes"],
      "browser output tree",
    );
    assert.equal(manifest.outputTree.schemaVersion, 1);
    assertSha256(manifest.outputTree.sha256, "browser output tree");
    assert.ok(manifest.outputTree.fileCount > 0);
    assert.ok(manifest.outputTree.totalBytes > 0);
    assert.equal(typeof manifest.browserVersion, "string");
    assert.match(manifest.browserVersion, /^\d+(?:\.\d+){1,3}$/);
    assertStringArray(
      manifest.blockedExternalOrigins,
      "browser blockedExternalOrigins",
    );
  } else {
    assertExactKeys(
      manifest.captureTransport,
      ["additionalBrowserArgsSha256", "mode", "portFile"],
      "desktop captureTransport",
    );
    assert.deepEqual(manifest.captureTransport, {
      additionalBrowserArgsSha256: digest(
        Buffer.from(DESKTOP_EVIDENCE_BROWSER_ARGUMENTS),
      ),
      mode: "ephemeral-loopback-cdp",
      portFile: "WebView2/EBWebView/DevToolsActivePort",
    });
    assert.match(
      manifest.credentialNamespace,
      /^com\.speakright\.desktop\.release-evidence-[0-9a-f]{16}$/,
    );
    assert.equal(manifest.nativeHttpAttempts, 0);
    assert.equal(manifest.secureStoreSlotsEmpty, true);
    assertExactKeys(
      manifest.runtimeIsolation,
      [
        "logDirectory",
        "logInitialized",
        "logRetained",
        "settingsStorePath",
        "settingsStoreRetained",
        "webViewProfile",
        "profileRetained",
      ],
      "desktop runtimeIsolation",
    );
    assert.deepEqual(manifest.runtimeIsolation, {
      logDirectory: "os-temp-child",
      logInitialized: true,
      logRetained: false,
      settingsStorePath: "os-temp-child",
      settingsStoreRetained: false,
      webViewProfile: "os-temp-child",
      profileRetained: false,
    });
    assertRecord(manifest.networkGuard, "desktop networkGuard");
    assertExactKeys(
      manifest.networkGuard,
      [
        "nativeHttp",
        "nativeHttpCapability",
        "externalConnectCsp",
        "rustExternalProviders",
        "tauriHttpGuardSha256",
        "rustGuardSha256",
      ],
      "desktop networkGuard",
    );
    assert.equal(manifest.networkGuard.nativeHttp, "fail-closed");
    assert.equal(manifest.networkGuard.nativeHttpCapability, false);
    assert.equal(manifest.networkGuard.externalConnectCsp, false);
    assert.equal(manifest.networkGuard.rustExternalProviders, "fail-closed");
    assertSha256(
      manifest.networkGuard.tauriHttpGuardSha256,
      "desktop Tauri HTTP guard",
    );
    assertSha256(manifest.networkGuard.rustGuardSha256, "desktop Rust guard");
    assert.deepEqual(manifest.successfulExternalOrigins, []);
    assertStringArray(
      manifest.attemptedExternalOrigins,
      "desktop attemptedExternalOrigins",
    );
    assertRecord(manifest.executable, "desktop executable");
    assertExactKeys(
      manifest.executable,
      ["fileName", "sha256"],
      "desktop executable",
    );
    assert.equal(manifest.executable.fileName, "speakright.exe");
    assertSha256(manifest.executable.sha256, "desktop executable");
    assert.equal("path" in manifest.executable, false);
  }

  const expected = new Map();
  for (const viewport of viewports) {
    for (const shot of RELEASE_EVIDENCE_SHOTS) {
      const key = `${edition}/${viewport.id}/${shot.id}`;
      expected.set(key, { shot, viewport });
    }
  }
  assert.equal(Array.isArray(manifest.artifacts), true);
  assert.equal(
    manifest.artifacts.length,
    expected.size,
    `${edition} manifest must contain exactly ${expected.size} artifacts`,
  );
  const actualKeys = new Set();
  const validated = new Map();
  for (const entry of manifest.artifacts) {
    assertRecord(entry, `${edition} artifact`);
    assertExactKeys(
      entry,
      [
        "edition",
        "viewport",
        "id",
        "path",
        "width",
        "height",
        "sha256",
        "geometry",
        "scoreDisclosure",
      ],
      `${edition} artifact`,
    );
    const key = `${entry.edition}/${entry.viewport}/${entry.id}`;
    assert.equal(actualKeys.has(key), false, `Duplicate artifact key: ${key}`);
    actualKeys.add(key);
    const specification = expected.get(key);
    assert.ok(specification, `Unexpected artifact key: ${key}`);
    const { shot, viewport } = specification;
    const expectedPath = `${editionRelativeRoot}/${viewport.id}/${shot.id}.png`;
    assert.equal(entry.edition, edition);
    assert.equal(entry.viewport, viewport.id);
    assert.equal(entry.id, shot.id);
    assert.equal(entry.path, expectedPath);
    assert.equal(entry.width, viewport.width);
    assert.equal(entry.height, viewport.height);
    assertSha256(entry.sha256, `${key} screenshot`);
    const imagePath = repositoryPath(entry.path, `${key} screenshot path`);
    assert.equal(
      existsSync(imagePath),
      true,
      `Missing screenshot: ${entry.path}`,
    );
    const buffer = await readFile(imagePath);
    assert.deepEqual(pngDimensions(buffer), {
      width: viewport.width,
      height: viewport.height,
    });
    assert.equal(entry.sha256, digest(buffer));
    assertRecord(entry.geometry, `${key} geometry`);
    assertExactKeys(
      entry.geometry,
      edition === "browser"
        ? [
            "banner",
            "bannerCollisions",
            "bannerWithinViewport",
            "bannerOccludedPoints",
            "heading",
            "titlebar",
            "desktopSidebar",
            "mobileNavigation",
            "navigationTitleOverlap",
            "globalChromeWithinViewport",
            "windowScroll",
            "mainScrollTop",
            "guidedRepeatFocus",
          ]
        : [
            "banner",
            "bannerCollisions",
            "bannerWithinViewport",
            "bannerOccludedPoints",
          ],
      `${key} geometry`,
    );
    assertExactKeys(
      entry.geometry.banner,
      ["left", "top", "right", "bottom"],
      `${key} banner rectangle`,
    );
    const banner = entry.geometry.banner;
    assert.equal(
      [banner.left, banner.top, banner.right, banner.bottom].every(
        Number.isFinite,
      ),
      true,
    );
    assert.ok(banner.left >= 0 && banner.top >= 0);
    assert.ok(
      banner.right <= viewport.width && banner.bottom <= viewport.height,
    );
    assert.ok(banner.right > banner.left && banner.bottom > banner.top);
    assert.equal(entry.geometry.bannerCollisions, 0);
    assert.equal(entry.geometry.bannerWithinViewport, true);
    assert.equal(entry.geometry.bannerOccludedPoints, 0);
    if (edition === "browser") {
      assert.equal(entry.geometry.globalChromeWithinViewport, true);
      assert.deepEqual(entry.geometry.windowScroll, { x: 0, y: 0 });
      assert.equal(Number.isFinite(entry.geometry.mainScrollTop), true);
      assert.ok(entry.geometry.mainScrollTop >= 0);
      assertRecord(entry.geometry.titlebar, `${key} titlebar`);
      assert.ok(entry.geometry.titlebar.top >= -0.75);
      assert.ok(entry.geometry.titlebar.bottom <= viewport.height + 0.75);
      if (viewport.width < 1024) {
        assertRecord(entry.geometry.mobileNavigation, `${key} mobile nav`);
      } else {
        assertRecord(entry.geometry.desktopSidebar, `${key} desktop sidebar`);
      }
    }
    if (edition === "browser" && viewport.width < 1024) {
      assert.equal(entry.geometry.navigationTitleOverlap, false);
    }
    const expectsGuidedRepeatFocus =
      edition === "browser" &&
      viewport.width < 1024 &&
      shot.id === "guided-repeat";
    if (expectsGuidedRepeatFocus) {
      assertRecord(entry.geometry.guidedRepeatFocus, `${key} guided focus`);
      assertExactKeys(
        entry.geometry.guidedRepeatFocus,
        [
          "cta",
          "plan",
          "ctaSafetyMarginPx",
          "requiredSafetyMarginPx",
          "ctaWithinViewport",
          "planWithinViewport",
          "setupScrollTop",
        ],
        `${key} guided focus`,
      );
      for (const [label, rectangle] of [
        ["CTA", entry.geometry.guidedRepeatFocus.cta],
        ["plan", entry.geometry.guidedRepeatFocus.plan],
      ]) {
        assertRecord(rectangle, `${key} guided ${label}`);
        assertExactKeys(
          rectangle,
          ["left", "top", "right", "bottom", "width", "height"],
          `${key} guided ${label}`,
        );
      }
      assert.equal(entry.geometry.guidedRepeatFocus.requiredSafetyMarginPx, 12);
      assert.ok(entry.geometry.guidedRepeatFocus.ctaSafetyMarginPx >= 12);
      assert.equal(entry.geometry.guidedRepeatFocus.ctaWithinViewport, true);
      assert.equal(entry.geometry.guidedRepeatFocus.planWithinViewport, true);
      assert.ok(entry.geometry.guidedRepeatFocus.setupScrollTop > 0);
    } else if (edition === "browser") {
      assert.equal(entry.geometry.guidedRepeatFocus, null);
    }
    assert.equal(
      entry.scoreDisclosure,
      shot.bannerKind === "example-score" ? EXAMPLE_SCORE_DISCLOSURE : null,
    );
    validated.set(key, { ...entry, buffer });
  }
  assert.deepEqual([...actualKeys].sort(), [...expected.keys()].sort());
  assert.deepEqual(
    await pngFilesBelow(editionRoot),
    [...expected.values()]
      .map(({ shot, viewport }) => `${viewport.id}/${shot.id}.png`)
      .sort(),
    `${edition} screenshot directory contains an unexpected PNG set`,
  );
  return {
    entries: validated,
    sourceCommit: manifest.sourceCommit,
  };
}

const EXPECTED_DEMO_FRAMES = [
  { id: "title", durationSeconds: 5, source: null },
  {
    id: "browser-guided-repeat",
    durationSeconds: 8,
    source: { edition: "browser", viewport: "1280x800", id: "guided-repeat" },
  },
  {
    id: "browser-free-practice",
    durationSeconds: 8,
    source: { edition: "browser", viewport: "1280x800", id: "free-practice" },
  },
  {
    id: "browser-diagnosis",
    durationSeconds: 8,
    source: {
      edition: "browser",
      viewport: "1280x800",
      id: "diagnosis-example",
    },
    scoreDisclosureOverlay: true,
  },
  {
    id: "browser-progress",
    durationSeconds: 8,
    source: {
      edition: "browser",
      viewport: "1280x800",
      id: "progress-example",
    },
    scoreDisclosureOverlay: true,
  },
  {
    id: "browser-settings",
    durationSeconds: 8,
    source: { edition: "browser", viewport: "1280x800", id: "settings" },
  },
  {
    id: "desktop-guided-repeat",
    durationSeconds: 8,
    source: { edition: "desktop", viewport: "1280x920", id: "guided-repeat" },
  },
  {
    id: "desktop-diagnosis",
    durationSeconds: 8,
    source: {
      edition: "desktop",
      viewport: "1280x920",
      id: "diagnosis-example",
    },
    scoreDisclosureOverlay: true,
  },
  {
    id: "desktop-no-key",
    durationSeconds: 8,
    source: { edition: "desktop", viewport: "1280x920", id: "no-key" },
  },
  { id: "end", durationSeconds: 5, source: null },
];

function parseTimestamp(value, separator, label) {
  const escapedSeparator = separator === "." ? "\\." : separator;
  const match = value.match(
    new RegExp(`^(\\d{2}):(\\d{2}):(\\d{2})${escapedSeparator}(\\d{3})$`),
  );
  assert.ok(match, `${label} has an invalid timestamp`);
  const [, hours, minutes, seconds, milliseconds] = match.map(Number);
  assert.ok(minutes < 60 && seconds < 60, `${label} timestamp is out of range`);
  return hours * 3_600_000 + minutes * 60_000 + seconds * 1000 + milliseconds;
}

function parseSrt(document) {
  const normalized = document.replaceAll("\r\n", "\n").trimEnd();
  assert.equal(
    normalized.startsWith("\uFEFF"),
    false,
    "SRT must not contain BOM",
  );
  const blocks = normalized.split(/\n{2,}/);
  assert.equal(blocks.length, 10, "SRT must contain exactly 10 cues");
  return blocks.map((block, index) => {
    const lines = block.split("\n");
    assert.equal(lines.length, 3, `SRT cue ${index + 1} must have three lines`);
    assert.equal(
      lines[0],
      String(index + 1),
      "SRT cue numbers must be ordered",
    );
    const match = lines[1].match(
      /^(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})$/,
    );
    assert.ok(match, `SRT cue ${index + 1} has an invalid timeline`);
    return {
      start: parseTimestamp(match[1], ",", `SRT cue ${index + 1}`),
      end: parseTimestamp(match[2], ",", `SRT cue ${index + 1}`),
      caption: lines[2],
    };
  });
}

function parseVtt(document) {
  const normalized = document.replaceAll("\r\n", "\n").trimEnd();
  assert.equal(
    normalized.startsWith("\uFEFF"),
    false,
    "VTT must not contain BOM",
  );
  assert.equal(normalized.startsWith("WEBVTT\n\n"), true, "Invalid VTT header");
  const blocks = normalized.slice("WEBVTT\n\n".length).split(/\n{2,}/);
  assert.equal(blocks.length, 10, "VTT must contain exactly 10 cues");
  return blocks.map((block, index) => {
    const lines = block.split("\n");
    assert.equal(lines.length, 2, `VTT cue ${index + 1} must have two lines`);
    const match = lines[0].match(
      /^(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})$/,
    );
    assert.ok(match, `VTT cue ${index + 1} has an invalid timeline`);
    return {
      start: parseTimestamp(match[1], ".", `VTT cue ${index + 1}`),
      end: parseTimestamp(match[2], ".", `VTT cue ${index + 1}`),
      caption: lines[1],
    };
  });
}

function validateCueTimeline(cues, frames, label) {
  assert.equal(cues.length, 10, `${label} must contain 10 cues`);
  let cursor = 0;
  for (const [index, cue] of cues.entries()) {
    const expectedEnd = cursor + frames[index].durationSeconds * 1000;
    assert.equal(
      cue.start,
      cursor,
      `${label} cue ${index + 1} is not continuous`,
    );
    assert.equal(
      cue.end,
      expectedEnd,
      `${label} cue ${index + 1} has wrong end`,
    );
    assert.equal(cue.caption, frames[index].caption);
    assert.ok(cue.end > cue.start, `${label} cue ${index + 1} is empty`);
    cursor = cue.end;
  }
  assert.equal(cursor, 74_000, `${label} must cover 0–74 seconds`);
}

function probeDemo(videoPath) {
  const executable = process.env.FFPROBE_PATH?.trim() || "ffprobe";
  const result = spawnSync(
    executable,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=index,codec_type,codec_name,width,height",
      "-of",
      "json",
      videoPath,
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `ffprobe artifact validation failed (exit ${result.status ?? "unavailable"}).`,
    );
  }
  let media;
  try {
    media = JSON.parse(result.stdout);
  } catch {
    throw new Error("ffprobe artifact validation returned invalid JSON.");
  }
  const streams = Array.isArray(media.streams) ? media.streams : [];
  const videos = streams.filter((stream) => stream.codec_type === "video");
  const audios = streams.filter((stream) => stream.codec_type === "audio");
  assert.equal(streams.length, 1, "Demo must contain exactly one media stream");
  assert.equal(videos.length, 1, "Demo must contain exactly one video stream");
  assert.equal(audios.length, 0, "Demo must contain zero audio streams");
  assert.equal(videos[0].codec_name, "h264");
  assert.equal(videos[0].width, 1280);
  assert.equal(videos[0].height, 720);
  const duration = Number(media.format?.duration);
  assert.equal(Number.isFinite(duration), true, "Demo duration is invalid");
  assert.ok(Math.abs(duration - 74) <= 0.15, "Demo duration must be about 74s");
  return { duration, video: videos[0] };
}

async function validateDemo(screenshotEntries, evidenceSourceCommit) {
  const demoRootRelative = "docs/assets/demo";
  const manifest = JSON.parse(
    await readFile(
      repositoryPath(`${demoRootRelative}/manifest.json`, "demo manifest path"),
      "utf8",
    ),
  );
  assertRecord(manifest, "demo manifest");
  assertExactKeys(
    manifest,
    [
      "schemaVersion",
      "version",
      "edition",
      "durationSeconds",
      "dimensions",
      "codec",
      "videoStreams",
      "audioStreams",
      "subtitleLanguage",
      "burnedCaptions",
      "subtitles",
      "scoreDisclosure",
      "paidApiCalls",
      "userData",
      "sourceCommit",
      "generatorSnapshot",
      "path",
      "sha256",
      "frames",
    ],
    "demo manifest",
  );
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.version, RELEASE_EVIDENCE_VERSION);
  assert.equal(manifest.edition, "browser-and-desktop");
  assert.deepEqual(manifest.dimensions, { width: 1280, height: 720 });
  assert.equal(manifest.codec, "h264");
  assert.equal(manifest.videoStreams, 1);
  assert.equal(manifest.audioStreams, 0);
  assert.equal(manifest.subtitleLanguage, "en");
  assert.equal(manifest.burnedCaptions, true);
  assert.equal(manifest.paidApiCalls, false);
  assert.equal(manifest.userData, false);
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(
    manifest.sourceCommit,
    evidenceSourceCommit,
    "Demo sourceCommit must match both screenshot manifests",
  );
  releaseEvidenceGeneratorGitProvenance(root, manifest.sourceCommit);
  assertExactKeys(
    manifest.generatorSnapshot,
    ["schemaVersion", "sha256", "fileCount", "totalBytes"],
    "demo generator snapshot",
  );
  assert.deepEqual(
    manifest.generatorSnapshot,
    await releaseEvidenceGeneratorDigest(root),
  );
  assert.equal(manifest.scoreDisclosure, EXAMPLE_SCORE_DISCLOSURE);
  assert.equal(typeof manifest.durationSeconds, "number");
  assert.equal(Number.isFinite(manifest.durationSeconds), true);
  const expectedVideoPath = `${demoRootRelative}/speakright-v${RELEASE_EVIDENCE_VERSION}-overview.mp4`;
  assert.equal(manifest.path, expectedVideoPath);
  assertSha256(manifest.sha256, "demo video");
  const videoPath = repositoryPath(manifest.path, "demo video path");
  const videoBuffer = await readFile(videoPath);
  assert.equal(digest(videoBuffer), manifest.sha256);
  const probed = probeDemo(videoPath);
  assert.ok(Math.abs(manifest.durationSeconds - probed.duration) <= 0.001);

  assert.equal(Array.isArray(manifest.frames), true);
  assert.equal(manifest.frames.length, EXPECTED_DEMO_FRAMES.length);
  for (const [index, frame] of manifest.frames.entries()) {
    const expected = EXPECTED_DEMO_FRAMES[index];
    assertRecord(frame, `demo frame ${index + 1}`);
    assertExactKeys(
      frame,
      [
        "edition",
        "id",
        "durationSeconds",
        "caption",
        "path",
        "width",
        "height",
        "sha256",
        "scoreDisclosureOverlay",
        "sourceEvidence",
      ],
      `demo frame ${index + 1}`,
    );
    assert.equal(frame.edition, "demo");
    assert.equal(frame.id, expected.id);
    assert.equal(frame.durationSeconds, expected.durationSeconds);
    assert.equal(frame.width, 1280);
    assert.equal(frame.height, 720);
    assert.equal(typeof frame.caption, "string");
    assert.equal(frame.caption, frame.caption.trim());
    assert.ok(frame.caption.length > 0);
    assert.doesNotMatch(frame.caption, /\breproduc(?:e|ible|ibility)\b/i);
    const expectedFramePath = `${demoRootRelative}/frames/${String(index + 1).padStart(2, "0")}-${expected.id}.png`;
    assert.equal(frame.path, expectedFramePath);
    assertSha256(frame.sha256, `demo frame ${index + 1}`);
    const frameBuffer = await readFile(
      repositoryPath(frame.path, `demo frame ${index + 1} path`),
    );
    assert.deepEqual(pngDimensions(frameBuffer), { width: 1280, height: 720 });
    assert.equal(digest(frameBuffer), frame.sha256);
    assert.equal(
      frame.scoreDisclosureOverlay,
      expected.scoreDisclosureOverlay === true,
    );
    if (!expected.source) {
      assert.equal(frame.sourceEvidence, null);
      continue;
    }
    assertRecord(frame.sourceEvidence, `demo frame ${index + 1} source`);
    assertExactKeys(
      frame.sourceEvidence,
      ["edition", "id", "path", "sha256", "viewport", "width", "height"],
      `demo frame ${index + 1} source`,
    );
    const sourceKey = `${expected.source.edition}/${expected.source.viewport}/${expected.source.id}`;
    const sourceEntry = screenshotEntries.get(sourceKey);
    assert.ok(sourceEntry, `Demo source is missing: ${sourceKey}`);
    const expectedSourcePath = `docs/assets/screenshots/release/v${RELEASE_EVIDENCE_VERSION}/${expected.source.edition}/${expected.source.viewport}/${expected.source.id}.png`;
    assert.deepEqual(frame.sourceEvidence, {
      edition: expected.source.edition,
      id: expected.source.id,
      path: expectedSourcePath,
      sha256: sourceEntry.sha256,
      viewport: expected.source.viewport,
      width: sourceEntry.width,
      height: sourceEntry.height,
    });
    repositoryPath(
      frame.sourceEvidence.path,
      `demo frame ${index + 1} source path`,
    );
    assert.equal(digest(sourceEntry.buffer), frame.sourceEvidence.sha256);
  }
  assert.equal(
    manifest.frames.reduce((total, frame) => total + frame.durationSeconds, 0),
    74,
  );
  assert.deepEqual(
    await pngFilesBelow(
      repositoryPath(`${demoRootRelative}/frames`, "demo frame root"),
    ),
    EXPECTED_DEMO_FRAMES.map(
      (frame, index) => `${String(index + 1).padStart(2, "0")}-${frame.id}.png`,
    ),
  );

  assert.equal(Array.isArray(manifest.subtitles), true);
  assert.equal(manifest.subtitles.length, 2);
  const expectedSubtitles = [
    {
      format: "srt",
      path: `${demoRootRelative}/speakright-v${RELEASE_EVIDENCE_VERSION}-overview.en.srt`,
    },
    {
      format: "webvtt",
      path: `${demoRootRelative}/speakright-v${RELEASE_EVIDENCE_VERSION}-overview.en.vtt`,
    },
  ];
  const documents = [];
  for (const [index, subtitle] of manifest.subtitles.entries()) {
    assertRecord(subtitle, `demo subtitle ${index + 1}`);
    assertExactKeys(
      subtitle,
      ["format", "path", "sha256"],
      `demo subtitle ${index + 1}`,
    );
    assert.equal(subtitle.format, expectedSubtitles[index].format);
    assert.equal(subtitle.path, expectedSubtitles[index].path);
    assertSha256(subtitle.sha256, `demo subtitle ${index + 1}`);
    const subtitleBuffer = await readFile(
      repositoryPath(subtitle.path, `demo subtitle ${index + 1} path`),
    );
    assert.equal(digest(subtitleBuffer), subtitle.sha256);
    documents.push(subtitleBuffer.toString("utf8"));
  }
  const srtCues = parseSrt(documents[0]);
  const vttCues = parseVtt(documents[1]);
  validateCueTimeline(srtCues, manifest.frames, "SRT");
  validateCueTimeline(vttCues, manifest.frames, "VTT");
  assert.deepEqual(srtCues, vttCues);
}

if (requireArtifacts || requireBrowserArtifacts) {
  const screenshotEntries = new Map();
  const browserEvidence = await validateScreenshotManifest(
    "browser",
    BROWSER_EVIDENCE_VIEWPORTS,
  );
  for (const [key, entry] of browserEvidence.entries)
    screenshotEntries.set(key, entry);
  if (requireArtifacts) {
    const desktopEvidence = await validateScreenshotManifest(
      "desktop",
      DESKTOP_EVIDENCE_VIEWPORTS,
    );
    assert.equal(
      desktopEvidence.sourceCommit,
      browserEvidence.sourceCommit,
      "Browser and Desktop screenshot manifests must share one sourceCommit",
    );
    for (const [key, entry] of desktopEvidence.entries)
      screenshotEntries.set(key, entry);
    await validateDemo(screenshotEntries, browserEvidence.sourceCommit);
  }
}

console.log(
  `Release evidence contract passed${
    requireArtifacts
      ? " with all generated artifacts"
      : requireBrowserArtifacts
        ? " with Browser artifacts"
        : ""
  }.`,
);
