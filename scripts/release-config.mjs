import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const biomeCli = path.join(
  root,
  "node_modules",
  "@biomejs",
  "biome",
  "bin",
  "biome",
);
const generatedTargets = {
  desktop: path.join(root, "src", "lib", "release-info.ts"),
  browser: path.join(root, "apps", "browser", "src", "lib", "release-info.ts"),
};

function fail(message) {
  throw new Error(`Release configuration error: ${message}`);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} must be a non-empty string`);
  }
}

function validateConfig(config) {
  if (config.schemaVersion !== 1) fail("schemaVersion must be 1");
  assertString(config.productName, "productName");
  assertString(config.version, "version");
  if (!/^\d+\.\d+\.\d+$/.test(config.version)) {
    fail(`version must be plain semver, received ${config.version}`);
  }
  assertString(config.repositoryUrl, "repositoryUrl");
  if (config.repositoryUrl !== "https://github.com/zixuanzhou0-ai/speakright") {
    fail("repositoryUrl must point to zixuanzhou0-ai/speakright");
  }
  assertString(config.lastValidatedAt, "lastValidatedAt");

  for (const editionName of ["browser", "desktop"]) {
    const edition = config.editions?.[editionName];
    if (!edition) fail(`missing ${editionName} edition`);
    for (const field of [
      "productName",
      "edition",
      "channel",
      "channelLabel",
      "releaseTag",
      "framework",
      "target",
      "signatureStatus",
      "signatureLabel",
    ]) {
      assertString(edition[field], `editions.${editionName}.${field}`);
    }
    if (edition.edition !== editionName) {
      fail(`editions.${editionName}.edition must be ${editionName}`);
    }
    if (typeof edition.signed !== "boolean") {
      fail(`editions.${editionName}.signed must be boolean`);
    }
  }

  if (config.editions.browser.channel !== "stable") {
    fail("Browser Edition must use the stable channel");
  }
  if (config.editions.browser.releaseTag !== `v${config.version}`) {
    fail("Browser stable tag must match v<version>");
  }
  if (
    config.editions.browser.signed !== false ||
    config.editions.browser.signatureStatus !== "NotApplicable"
  ) {
    fail("Browser signing must be explicitly marked NotApplicable");
  }
  if (config.editions.desktop.channel !== "preview") {
    fail("Desktop Edition must use the preview channel");
  }
  if (
    config.editions.desktop.releaseTag !==
    `v${config.version}-desktop-preview.1`
  ) {
    fail("Desktop preview tag must match v<version>-desktop-preview.1");
  }
  if (
    config.editions.desktop.signed !== false ||
    config.editions.desktop.signatureStatus !== "NotSigned"
  ) {
    fail("Desktop preview must be explicitly marked unsigned");
  }
}

function quote(value) {
  return JSON.stringify(value);
}

function formatGeneratedSource(source, target) {
  const result = spawnSync(
    process.execPath,
    [biomeCli, "format", "--stdin-file-path", target],
    {
      cwd: root,
      encoding: "utf8",
      input: source,
    },
  );
  if (result.error || result.status !== 0) {
    fail(
      `unable to format generated release info: ${result.error?.message ?? result.stderr.trim()}`,
    );
  }
  return result.stdout;
}

function generatedSource(config, editionName) {
  const edition = config.editions[editionName];
  const exportPrefix = editionName === "desktop" ? "DESKTOP" : "BROWSER";
  const statusNote =
    editionName === "desktop"
      ? "这是未签名的 Windows 社区预览版。Windows SmartScreen 可能显示“未知发布者”；请只从项目 Release 下载，并核对 SHA-256。"
      : "浏览器版通过源码和静态构建发行，不包含 EXE、MSI 或 NSIS 安装包，因此代码签名不适用。麦克风权限需要 localhost 或 HTTPS。";
  const artifactsNote =
    editionName === "desktop"
      ? "GitHub Pre-release 仅发布裸 Release EXE 与通过安装、启动、退出、卸载往返验收的 NSIS 安装包；v1.1.0 不发布 MSI。已安装应用内不提供自动下载或静默更新。"
      : "浏览器稳定版提供源码和从标识 commit 构建的静态包，可在 localhost 或 HTTPS 环境运行。";
  const releasePageNote =
    editionName === "desktop"
      ? "此页面指向独立的 Desktop Preview 发行记录，不与 Browser Stable 混称为签名桌面稳定版。"
      : "此页面指向 Browser Stable 与源码发行记录；Windows Desktop Preview 使用独立预发行标签。";
  const checksumNote =
    editionName === "desktop"
      ? "发行报告记录公开裸 EXE 与 NSIS 的 SHA-256 和实际 Authenticode 状态；MSI 仅作本地构建元数据检查，不进入报告或公开附件。"
      : "发行附件提供 Browser 静态包、SHA-256、npm/Cargo SBOM 和验证摘要。";
  const distributionLabel =
    editionName === "desktop" ? "未签名 Windows NSIS 安装包" : "静态浏览器构建";

  return `// This file is generated from release.config.json by scripts/release-config.mjs.\n// Run \`npm run release:config:generate\` after changing the release manifest.\n\nexport type ReleaseInfo = {\n  version: string;\n  edition: "browser" | "desktop";\n  channel: "stable" | "preview";\n  commitSha: string;\n  builtAt: string;\n  signed: boolean;\n  repositoryUrl: string;\n  issuesUrl: string;\n  privacyUrl: string;\n  licenseUrl: string;\n};\n\nexport const ${exportPrefix}_RELEASE_VERSION = ${quote(config.version)};\n\nconst commitSha =\n  process.env.NEXT_PUBLIC_SPEAKRIGHT_COMMIT_SHA?.trim() || "development";\nconst builtAt =\n  process.env.NEXT_PUBLIC_SPEAKRIGHT_BUILD_TIMESTAMP?.trim() || "local build";\nconst lastValidatedAt =\n  process.env.NEXT_PUBLIC_SPEAKRIGHT_VALIDATED_AT?.trim() || ${quote(config.lastValidatedAt)};\nconst repositoryUrl = ${quote(config.repositoryUrl)};\nconst releaseTag = ${quote(edition.releaseTag)};\nconst releaseUrl = \`\${repositoryUrl}/releases/tag/\${releaseTag}\`;\nconst issuesUrl = \`\${repositoryUrl}/issues\`;\nconst privacyUrl = \`\${repositoryUrl}/blob/main/PRIVACY.md\`;\nconst licenseUrl = \`\${repositoryUrl}/blob/main/LICENSE\`;\n\nexport const ${exportPrefix}_RELEASE_INFO = {\n  productName: ${quote(edition.productName)},\n  version: ${exportPrefix}_RELEASE_VERSION,\n  currentVersion: ${exportPrefix}_RELEASE_VERSION,\n  edition: ${quote(edition.edition)},\n  channel: ${quote(edition.channel)},\n  channelLabel: ${quote(edition.channelLabel)},\n  commitSha,\n  builtAt,\n  signed: ${edition.signed},\n  lastValidatedAt,\n  repositoryUrl,\n  releaseUrl,\n  issuesUrl,\n  privacyUrl,\n  licenseUrl,\n  build: {\n    framework: ${quote(edition.framework)},\n    target: ${quote(edition.target)},\n    signed: ${edition.signed},\n    signatureStatus: ${quote(edition.signatureStatus)},\n    signatureLabel: ${quote(edition.signatureLabel)},\n    distributionLabel: ${quote(distributionLabel)},\n    releaseReportFileName: ${quote(
    editionName === "desktop"
      ? `SpeakRight_${config.version}_release-report.json`
      : `SpeakRight_Browser_${config.version}_validation-report.json`,
  )},\n  },\n  notes: {\n    artifacts: ${quote(artifactsNote)},\n    releasePage: ${quote(releasePageNote)},\n    status: ${quote(statusNote)},\n    checksum: ${quote(checksumNote)},\n  },\n} as const satisfies ReleaseInfo & Record<string, unknown>;\n`;
}

async function verifyManifestVersions(config) {
  const rootPackage = await readJson("package.json");
  const rootPackageLock = await readJson("package-lock.json");
  const browserPackage = await readJson("apps/browser/package.json");
  const browserPackageLock = await readJson("apps/browser/package-lock.json");
  const tauriConfig = await readJson("src-tauri/tauri.conf.json");
  const cargoToml = await readFile(
    path.join(root, "src-tauri", "Cargo.toml"),
    "utf8",
  );
  const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  const cargoRepository = cargoToml.match(/^repository\s*=\s*"([^"]+)"/m)?.[1];
  const cargoLicense = cargoToml.match(/^license\s*=\s*"([^"]+)"/m)?.[1];

  const versions = {
    "package.json": rootPackage.version,
    "package-lock.json": rootPackageLock.version,
    'package-lock.json packages[""]': rootPackageLock.packages?.[""]?.version,
    "apps/browser/package.json": browserPackage.version,
    "apps/browser/package-lock.json": browserPackageLock.version,
    'apps/browser/package-lock.json packages[""]':
      browserPackageLock.packages?.[""]?.version,
    "src-tauri/Cargo.toml": cargoVersion,
    "src-tauri/tauri.conf.json": tauriConfig.version,
  };
  const mismatches = Object.entries(versions).filter(
    ([, version]) => version !== config.version,
  );
  if (mismatches.length > 0) {
    fail(
      `version ${config.version} does not match ${mismatches
        .map(([file, version]) => `${file} (${version ?? "missing"})`)
        .join(", ")}`,
    );
  }
  if (cargoRepository !== config.repositoryUrl) {
    fail("Cargo repository does not match release.config.json");
  }
  if (cargoLicense !== "MIT") {
    fail("Cargo license must be MIT");
  }
  for (const [file, packageJson] of [
    ["package.json", rootPackage],
    ["apps/browser/package.json", browserPackage],
  ]) {
    const normalizedRepository = packageJson.repository?.url?.replace(
      /\.git$/,
      "",
    );
    if (normalizedRepository !== config.repositoryUrl) {
      fail(`${file} repository does not match release.config.json`);
    }
  }
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const config = await readJson("release.config.json");
  validateConfig(config);
  await verifyManifestVersions(config);

  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  if (write === check) {
    fail("pass exactly one of --write or --check");
  }

  const expectedSources = Object.fromEntries(
    Object.keys(generatedTargets).map((editionName) => [
      editionName,
      formatGeneratedSource(
        generatedSource(config, editionName),
        generatedTargets[editionName],
      ),
    ]),
  );

  if (write) {
    for (const [editionName, target] of Object.entries(generatedTargets)) {
      await writeFile(target, expectedSources[editionName], "utf8");
      console.log(`Generated ${path.relative(root, target)}`);
    }
  } else {
    const drift = [];
    for (const [editionName, target] of Object.entries(generatedTargets)) {
      const current = await readFile(target, "utf8");
      if (current !== expectedSources[editionName]) {
        drift.push(path.relative(root, target));
      }
    }
    if (drift.length > 0) {
      fail(
        `generated release info is stale: ${drift.join(", ")}. Run npm run release:config:generate.`,
      );
    }
  }

  const editionName = readArgument("--edition");
  const tag = readArgument("--tag");
  if (editionName || tag) {
    if (!editionName || !tag || !config.editions[editionName]) {
      fail(
        "--edition <browser|desktop> and --tag <tag> must be provided together",
      );
    }
    if (config.editions[editionName].releaseTag !== tag) {
      fail(
        `${editionName} release expects ${config.editions[editionName].releaseTag}, received ${tag}`,
      );
    }
  }

  console.log(
    `Release configuration verified: SpeakRight ${config.version} (Browser stable, Desktop preview).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
