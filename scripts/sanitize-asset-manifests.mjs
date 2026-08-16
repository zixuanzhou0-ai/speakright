import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const write = process.argv.includes("--write");
const unknownArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--write");
if (unknownArguments.length > 0) {
  throw new Error("Usage: node scripts/sanitize-asset-manifests.mjs [--write]");
}

const targets = [
  path.join("public", "audio", "language-packs", "summary.json"),
  path.join(
    "public",
    "videos",
    "language-assets",
    "ru-RU",
    "russian-local-pronunciation-assets.manifest.json",
  ),
];

function sanitizeSummary(document) {
  for (const result of document.results ?? []) {
    const base = `public/audio/language-packs/${result.languageId}`;
    result.outputDir = base;
    result.manifestPath = `${base}/manifest.json`;
  }
  return document;
}

function sanitizeRussianManifest(document) {
  document.rightsDetailsContract = "asset-file-rights-v1";
  document.purpose =
    "Local Russian IPA/articulation video and audio assets packaged under the licenses and separately recorded redistribution permissions identified by the asset-rights registry.";
  document.rightsEvidenceRef = "SR-EVIDENCE-2026-RUSSIAN-LOCAL-ASSETS-001";
  document.notes = (document.notes ?? []).map((note) =>
    note ===
    "For public GitHub redistribution, keep attribution/license metadata and do not remove source URLs."
      ? "For public redistribution, preserve attribution, source URLs, per-file hashes, and the evidence references in docs/assets/asset-rights-registry.json."
      : note,
  );
  for (const asset of document.assets ?? []) {
    delete asset.absolutePath;
    if (
      asset.license ===
      "CC BY-NC-ND 4.0; user-stated noncommercial educational local use; preserve unmodified file and attribution"
    ) {
      asset.license =
        "CC BY-NC-ND 4.0 plus separately recorded written redistribution permission (SR-EVIDENCE-2026-SEEING-SPEECH-001); preserve the unmodified source performance and attribution";
    } else if (
      asset.license ===
      "Commons license; verify exact attribution from file page"
    ) {
      asset.license =
        "LicenseRef-SpeakRight-Wikimedia-RU-Written-Permission (SR-EVIDENCE-2026-WIKIMEDIA-RU-001); preserve the linked Commons source page and attribution";
    }
  }
  return document;
}

function containsAbsolutePath(value) {
  if (typeof value === "string") return /^[A-Za-z]:[\\/]/u.test(value);
  if (Array.isArray(value)) return value.some(containsAbsolutePath);
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, entry]) => key === "absolutePath" || containsAbsolutePath(entry),
    );
  }
  return false;
}

let changed = 0;
for (const relativePath of targets) {
  const filePath = path.join(projectRoot, relativePath);
  const original = await fs.readFile(filePath, "utf8");
  const document = JSON.parse(original);
  const sanitized = relativePath.endsWith("summary.json")
    ? sanitizeSummary(document)
    : sanitizeRussianManifest(document);
  const next = `${JSON.stringify(sanitized, null, 2)}\n`;
  if (containsAbsolutePath(sanitized)) {
    throw new Error(`${relativePath} still contains a local absolute path.`);
  }
  if (next !== original) {
    changed += 1;
    if (write) await fs.writeFile(filePath, next, "utf8");
  }
}

if (changed > 0 && !write) {
  console.error(
    `${changed} asset manifests require sanitization. Run with --write and review the diff.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    write
      ? `Sanitized ${changed} asset manifests.`
      : "Asset manifests contain repository-relative paths only.",
  );
}
