import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "out");
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");
const tauriReleaseBuildDir = path.join(
  root,
  "src-tauri",
  "target",
  "release",
  "build",
);

function fail(message) {
  throw new Error(`Desktop artifact smoke failed: ${message}`);
}

function assertFile(filePath, { minBytes = 1 } = {}) {
  if (!existsSync(filePath)) {
    fail(`missing file ${path.relative(root, filePath)}`);
  }
  const size = statSync(filePath).size;
  if (size < minBytes) {
    fail(
      `${path.relative(root, filePath)} is too small (${size} bytes, expected at least ${minBytes})`,
    );
  }
}

async function assertTextFile(filePath, options = {}) {
  assertFile(filePath, options);
  const text = await readFile(filePath, "utf8");
  for (const marker of options.markers ?? []) {
    if (!text.includes(marker)) {
      fail(`${path.relative(root, filePath)} does not contain "${marker}"`);
    }
  }
  return text;
}

function countFiles(dirPath) {
  if (!existsSync(dirPath)) return 0;
  let count = 0;
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const itemPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(itemPath);
    } else {
      count += 1;
    }
  }
  return count;
}

function textArtifactFiles(dirPath) {
  if (!existsSync(dirPath)) return [];
  const files = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const itemPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...textArtifactFiles(itemPath));
    } else if ([".css", ".html", ".js", ".json", ".txt"].includes(path.extname(entry.name))) {
      files.push(itemPath);
    }
  }
  return files;
}

function findNewestGeneratedCapabilities() {
  if (!existsSync(tauriReleaseBuildDir)) {
    fail("Tauri release build directory is missing");
  }

  const candidates = [];
  for (const buildEntry of readdirSync(tauriReleaseBuildDir, {
    withFileTypes: true,
  })) {
    if (!buildEntry.isDirectory() || !buildEntry.name.startsWith("speakright-")) {
      continue;
    }
    const capabilitiesPath = path.join(
      tauriReleaseBuildDir,
      buildEntry.name,
      "out",
      "capabilities.json",
    );
    if (existsSync(capabilitiesPath)) {
      candidates.push({
        path: capabilitiesPath,
        mtimeMs: statSync(capabilitiesPath).mtimeMs,
      });
    }
  }

  if (candidates.length === 0) {
    fail("generated Tauri capabilities.json is missing");
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0].path;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertTauriConfig() {
  const config = await readJson(tauriConfigPath);
  if (config.productName !== "SpeakRight") {
    fail("Tauri productName is not SpeakRight");
  }
  if (config.build?.frontendDist !== "../out") {
    fail("Tauri frontendDist must point at ../out");
  }
  if (config.app?.withGlobalTauri !== false) {
    fail("Tauri global API must remain disabled");
  }
  const mainWindow = config.app?.windows?.[0];
  if (mainWindow?.title !== "SpeakRight") {
    fail("Tauri main window title is not SpeakRight");
  }
  if ((mainWindow?.minWidth ?? 0) < 1024 || (mainWindow?.minHeight ?? 0) < 800) {
    fail("Tauri main window minimum size is below the desktop layout floor");
  }
  if (mainWindow?.dragDropEnabled !== false) {
    fail("Tauri main window drag and drop must remain disabled");
  }
}

async function assertGeneratedCapabilities() {
  const generatedCapabilitiesPath = findNewestGeneratedCapabilities();
  const generated = await readJson(generatedCapabilitiesPath);
  const permissions = generated.default?.permissions ?? [];
  const stringPermissions = permissions.filter(
    (permission) => typeof permission === "string",
  );
  const scopedUrls = permissions.flatMap((permission) =>
    typeof permission === "string"
      ? []
      : (permission.allow ?? []).map((item) => item.url ?? ""),
  );

  for (const forbiddenPermission of ["core:default", "store:default"]) {
    if (stringPermissions.includes(forbiddenPermission)) {
      fail(
        `${path.relative(root, generatedCapabilitiesPath)} contains broad ${forbiddenPermission}`,
      );
    }
  }

  const permissionText = JSON.stringify(permissions).toLowerCase();
  if (permissionText.includes("devtools")) {
    fail(`${path.relative(root, generatedCapabilitiesPath)} exposes a devtools permission`);
  }

  if (scopedUrls.some((url) => url.startsWith("http://"))) {
    fail(
      `${path.relative(root, generatedCapabilitiesPath)} contains plaintext HTTP capability URLs`,
    );
  }
  if (scopedUrls.includes("https://**")) {
    fail(
      `${path.relative(root, generatedCapabilitiesPath)} allows arbitrary HTTPS capability URLs`,
    );
  }

  const requiredScopedUrls = [
    "https://dict.youdao.com/**",
    "https://dictionaryapi.com/**",
    "https://media.merriam-webster.com/**",
  ];
  for (const url of requiredScopedUrls) {
    if (!scopedUrls.includes(url)) {
      fail(
        `${path.relative(root, generatedCapabilitiesPath)} is missing required pronunciation capability URL "${url}"`,
      );
    }
  }
}

async function assertStaticExport() {
  if (!existsSync(outDir)) {
    fail("Next static export directory out/ is missing");
  }

  const requiredPages = [
    {
      file: "drill.html",
      markers: ["今日学习计划", "桌面端准备状态", "配置评分密钥"],
    },
    {
      file: "settings.html",
      markers: ["设置", "数据与隐私中心", "Azure Speech"],
    },
    {
      file: "assessment.html",
      markers: ["DOCTYPE"],
    },
    {
      file: path.join("drill", "pack", "ee-ih.html"),
      markers: ["DOCTYPE"],
    },
    {
      file: path.join("phonemes", "ee.html"),
      markers: ["DOCTYPE"],
    },
  ];

  for (const page of requiredPages) {
    await assertTextFile(path.join(outDir, page.file), {
      minBytes: 1000,
      markers: page.markers,
    });
  }

  const nextStaticCount = countFiles(path.join(outDir, "_next", "static"));
  if (nextStaticCount < 10) {
    fail(`expected Next static chunks, found ${nextStaticCount}`);
  }

  assertFile(path.join(outDir, "favicon.ico"), { minBytes: 1000 });
  assertFile(path.join(outDir, "audio", "ipa", "normal", "sheep.mp3"), {
    minBytes: 1000,
  });
  assertFile(path.join(outDir, "images", "ipa", "sheep.png"), {
    minBytes: 1000,
  });
}

async function assertStaticExportPolicy() {
  if (existsSync(path.join(outDir, "api"))) {
    fail("Next static export must not contain out/api routes for the desktop bundle");
  }

  const forbiddenMarkers = [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "http://dict.youdao.com",
    "/api/azure",
    "/api/elevenlabs",
    "/api/llm",
    "/api/pronunciation",
    "/api/merriam-webster",
  ];

  for (const filePath of textArtifactFiles(outDir)) {
    const text = await readFile(filePath, "utf8");
    for (const marker of forbiddenMarkers) {
      if (text.includes(marker)) {
        fail(
          `${path.relative(root, filePath)} contains forbidden desktop remote marker "${marker}"`,
        );
      }
    }
  }
}

async function main() {
  await assertTauriConfig();
  await assertGeneratedCapabilities();
  await assertStaticExport();
  await assertStaticExportPolicy();
  console.log("Desktop artifact smoke passed: Tauri config, generated capabilities, static export policy, routes, chunks and core assets are present.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
