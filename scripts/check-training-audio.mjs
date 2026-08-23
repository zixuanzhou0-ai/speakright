import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const targetArg =
  process.argv.find((argument) => argument.startsWith("--target=")) ??
  "--target=all";
const target = targetArg.slice("--target=".length);
if (!["desktop", "browser", "all"].includes(target)) {
  throw new Error(`Unknown training audio target: ${target}`);
}

const catalog = JSON.parse(
  await readFile(
    path.join(
      projectRoot,
      "packages",
      "core",
      "src",
      "content",
      "training-perception-catalog.json",
    ),
    "utf8",
  ),
);
const speakerManifest = JSON.parse(
  await readFile(
    path.join(
      projectRoot,
      "packages",
      "core",
      "src",
      "content",
      "training-speaker-manifest.json",
    ),
    "utf8",
  ),
);
const reviewedSpeakers = speakerManifest.filter(
  (speaker) => speaker.reviewStatus === "reviewed",
);

// Isolated TTS can select the wrong pronunciation for these homographs.
// Core perception material must use an unambiguous word or a reviewed sentence.
const AMBIGUOUS_ISOLATED_WORDS = new Set([
  "close",
  "lead",
  "live",
  "read",
  "tear",
  "wind",
]);
const roots = {
  desktop: path.join(projectRoot, "public"),
  browser: path.join(projectRoot, "apps", "browser", "public"),
};
const selected =
  target === "all" ? Object.entries(roots) : [[target, roots[target]]];
const invalid = [];
if (reviewedSpeakers.length < 2) {
  invalid.push("核心听辨至少需要两名已审听说话人");
}
const missing = [];
const hashes = new Map();

async function hashFile(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

for (const entry of catalog) {
  if (!Array.isArray(entry.examples) || entry.examples.length < 4) {
    invalid.push(`${entry.packId}: 至少需要 4 组不同对比`);
    continue;
  }
  const ids = new Set();
  for (const example of entry.examples) {
    if (ids.has(example.id)) {
      invalid.push(`${entry.packId}: 重复 id ${example.id}`);
    }
    ids.add(example.id);
    for (const word of [example.wordA, example.wordB]) {
      if (AMBIGUOUS_ISOLATED_WORDS.has(word.toLowerCase())) {
        invalid.push(
          `${entry.packId}: ${word} 是容易产生歧义的同形异音词，不得进入核心听辨材料`,
        );
      }
      for (const speakerEntry of reviewedSpeakers) {
        const speaker = speakerEntry.assetDirectory;
        const relativePath = path.join(
          "audio",
          "words",
          speaker,
          `${word.toLowerCase()}.mp3`,
        );
        for (const [platform, publicRoot] of selected) {
          const filePath = path.join(publicRoot, relativePath);
          try {
            const metadata = await stat(filePath);
            if (!metadata.isFile() || metadata.size === 0) {
              missing.push(
                `${entry.packId}: ${platform}/${speaker}/${word}.mp3`,
              );
              continue;
            }
            const key = relativePath.replaceAll("\\", "/");
            const hash = await hashFile(filePath);
            const existing = hashes.get(key);
            if (existing && existing.hash !== hash) {
              invalid.push(
                `${entry.packId}: ${key} 在 ${existing.platform} 与 ${platform} 内容不一致`,
              );
            } else if (!existing) {
              hashes.set(key, { hash, platform });
            }
          } catch {
            missing.push(`${entry.packId}: ${platform}/${speaker}/${word}.mp3`);
          }
        }
      }
    }
  }
}

if (invalid.length > 0 || missing.length > 0) {
  console.error("SpeakRight 核心听辨音频门禁失败。");
  for (const issue of [...invalid, ...missing]) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  const examples = catalog.reduce(
    (sum, entry) => sum + entry.examples.length,
    0,
  );
  console.log(
    `核心听辨音频门禁通过：${catalog.length} 个训练包，${examples} 组对比，${selected.length} 个平台 × ${reviewedSpeakers.length} 名已审听说话人资产完整。`,
  );
}
