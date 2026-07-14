import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platforms = [
  { id: "desktop", publicRoot: resolve(root, "public") },
  { id: "browser", publicRoot: resolve(root, "apps/browser/public") },
];
const issues = [];
let checkedFiles = 0;

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function checkFile(relativePath) {
  const resolved = platforms.map((platform) => ({
    platform,
    path: resolve(platform.publicRoot, relativePath.replace(/^\//, "")),
  }));
  for (const item of resolved) {
    if (!existsSync(item.path)) {
      issues.push(`${item.platform.id}: missing ${relativePath}`);
      continue;
    }
    if (statSync(item.path).size === 0) {
      issues.push(`${item.platform.id}: empty ${relativePath}`);
    }
    checkedFiles += 1;
  }
  if (
    resolved.every((item) => existsSync(item.path)) &&
    sha256(resolved[0].path) !== sha256(resolved[1].path)
  ) {
    issues.push(`platform mismatch: ${relativePath}`);
  }
}

const phonemeData = readFileSync(
  resolve(root, "src/lib/phoneme-data.ts"),
  "utf8",
);
const wordBank = readFileSync(resolve(root, "src/lib/word-bank.ts"), "utf8");
const chartWords = new Set(
  [...phonemeData.matchAll(/chartWord:\s*"([^"]+)"/g)].map((match) =>
    match[1].toLowerCase(),
  ),
);
for (const word of chartWords) {
  checkFile(`/audio/ipa/phoneme/${encodeURIComponent(word)}.mp3`);
}

const englishWords = new Set(
  [...`${phonemeData}\n${wordBank}`.matchAll(/word:\s*"([^"]+)"/g)].map(
    (match) => match[1].toLowerCase(),
  ),
);
for (const word of englishWords) {
  checkFile(`/audio/words/blue/${encodeURIComponent(word)}.mp3`);
  checkFile(`/audio/words/pink/${encodeURIComponent(word)}.mp3`);
}

let languagePackItems = 0;
for (const languageId of ["es-ES", "fr-FR", "ru-RU"]) {
  const manifestPath = resolve(
    root,
    `public/audio/language-packs/${languageId}/manifest.json`,
  );
  if (!existsSync(manifestPath)) {
    issues.push(`desktop: missing language pack manifest ${languageId}`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const item of manifest.items ?? []) {
    languagePackItems += 1;
    for (const slot of ["blue", "pink"]) {
      const src = item.audioByVoice?.[slot];
      if (!src) {
        issues.push(
          `${languageId}/${item.text}: missing ${slot} voice mapping`,
        );
      } else {
        checkFile(src);
      }
    }
  }
}

for (const languageId of ["es-ES", "fr-FR", "ru-RU"]) {
  const base = resolve(
    root,
    `public/audio/language-assets/${languageId}/header-clips`,
  );
  if (!existsSync(base)) {
    issues.push(`desktop: missing header clips ${languageId}`);
    continue;
  }
  for (const name of readdirSync(base)) {
    if (![".m4a", ".mp3", ".ogg"].includes(extname(name).toLowerCase()))
      continue;
    checkFile(`/audio/language-assets/${languageId}/header-clips/${name}`);
  }
}

if (issues.length > 0) {
  console.error("Guided-repeat audio gate failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(
  `Guided-repeat audio gate passed (${chartWords.size} English anchors, ${englishWords.size} English words, ${languagePackItems} multilingual items, ${checkedFiles} platform files).`,
);
