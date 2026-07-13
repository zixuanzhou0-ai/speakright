import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const catalogPath = path.join(
  projectRoot,
  "src",
  "data",
  "training-perception-catalog.json",
);
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const missing = [];
const invalid = [];

for (const entry of catalog) {
  if (!Array.isArray(entry.examples) || entry.examples.length < 4) {
    invalid.push(`${entry.packId}: 至少需要 4 组不同对比`);
    continue;
  }
  const ids = new Set();
  for (const example of entry.examples) {
    if (ids.has(example.id))
      invalid.push(`${entry.packId}: 重复 id ${example.id}`);
    ids.add(example.id);
    for (const word of [example.wordA, example.wordB]) {
      for (const speaker of ["blue", "pink"]) {
        const filePath = path.join(
          projectRoot,
          "public",
          "audio",
          "words",
          speaker,
          `${word.toLowerCase()}.mp3`,
        );
        try {
          const metadata = await stat(filePath);
          if (!metadata.isFile() || metadata.size === 0) {
            missing.push(`${entry.packId}: ${speaker}/${word}.mp3`);
          }
        } catch {
          missing.push(`${entry.packId}: ${speaker}/${word}.mp3`);
        }
      }
    }
  }
}

if (invalid.length > 0 || missing.length > 0) {
  console.error("Browser Edition 核心听辨音频门禁失败。");
  for (const issue of [...invalid, ...missing]) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  const examples = catalog.reduce(
    (sum, entry) => sum + entry.examples.length,
    0,
  );
  console.log(
    `核心听辨音频门禁通过：${catalog.length} 个训练包，${examples} 组对比，双说话人资产完整。`,
  );
}
