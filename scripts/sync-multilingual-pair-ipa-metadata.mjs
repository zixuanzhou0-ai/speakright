#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import Module from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function installTypeScriptRequireHook() {
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function resolveAlias(
    request,
    parent,
    isMain,
    options,
  ) {
    if (typeof request === "string" && request.startsWith("@/")) {
      return originalResolve.call(
        this,
        resolve(ROOT, "src", request.slice(2)),
        parent,
        isMain,
        options,
      );
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
  Module._extensions[".ts"] = function compileTypeScript(module, filename) {
    const source = readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    });
    module._compile(output.outputText, filename);
  };
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  for (const arg of args) {
    if (arg !== "--write" && arg !== "--check") {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.has("--write") && args.has("--check")) {
    throw new Error("Choose either --write or --check, not both.");
  }
  return { write: args.has("--write") };
}

function buildPracticeMetadata(items, normalizeAudioPackText) {
  const grouped = new Map();
  for (const item of items) {
    if (item.ipa.includes("~")) {
      throw new Error(
        `Practice item still contains pair-level IPA: ${item.languageId} ${item.text} ${item.ipa}`,
      );
    }
    const key = normalizeAudioPackText(item.text);
    const current = grouped.get(key) ?? [];
    current.push({ ipa: item.ipa, source: item.source });
    grouped.set(key, current);
  }
  return grouped;
}

function resolveSplitIpa(languageId, item, entries) {
  if (!String(item.ipa ?? "").includes("~")) return item.ipa;
  if (!entries) {
    throw new Error(
      `${languageId} ${item.text}: pair-level IPA has no current practice item`,
    );
  }

  const contrastIpas = new Set(
    entries
      .filter((entry) => entry.source === "contrast")
      .map((entry) => entry.ipa),
  );
  if (contrastIpas.size === 1) return [...contrastIpas][0];

  const allIpas = new Set(entries.map((entry) => entry.ipa));
  if (allIpas.size === 1) return [...allIpas][0];

  throw new Error(
    `${languageId} ${item.text}: pair-level IPA is ambiguous (${[...allIpas].join(" | ")})`,
  );
}

function synchronizeManifest(
  languageId,
  manifest,
  practiceMetadata,
  normalizeAudioPackText,
) {
  let changedItems = 0;
  const items = (manifest.items ?? []).map((item) => {
    const textKey = normalizeAudioPackText(item.text ?? "");
    const itemKey = normalizeAudioPackText(item.key ?? "");
    const entries =
      practiceMetadata.get(textKey) ?? practiceMetadata.get(itemKey);
    const ipa = resolveSplitIpa(languageId, item, entries);
    if (ipa === item.ipa) return item;
    changedItems += 1;
    return { ...item, ipa };
  });
  return { manifest: { ...manifest, items }, changedItems };
}

function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function main() {
  const args = parseArgs();
  installTypeScriptRequireHook();
  const { MULTILINGUAL_AUDIO_PARITY_LANGUAGES, getMultilingualPracticeItems } =
    Module.createRequire(import.meta.url)(
      resolve(ROOT, "src", "lib", "multilingual-audio-parity.ts"),
    );
  const { normalizeAudioPackText } = Module.createRequire(import.meta.url)(
    resolve(ROOT, "src", "lib", "language-audio-pack-cache.ts"),
  );

  const drift = [];
  let totalChanged = 0;
  for (const languageId of MULTILINGUAL_AUDIO_PARITY_LANGUAGES) {
    const desktopPath = resolve(
      ROOT,
      "public/audio/language-packs",
      languageId,
      "manifest.json",
    );
    const browserPath = resolve(
      ROOT,
      "apps/browser/public/audio/language-packs",
      languageId,
      "manifest.json",
    );
    const desktopRaw = readFileSync(desktopPath, "utf8");
    const browserRaw = readFileSync(browserPath, "utf8");
    const practiceMetadata = buildPracticeMetadata(
      getMultilingualPracticeItems(languageId),
      normalizeAudioPackText,
    );
    const result = synchronizeManifest(
      languageId,
      JSON.parse(desktopRaw),
      practiceMetadata,
      normalizeAudioPackText,
    );
    const nextRaw = serializeManifest(result.manifest);
    totalChanged += result.changedItems;

    if (desktopRaw !== nextRaw)
      drift.push(`${languageId}: desktop metadata stale`);
    if (browserRaw !== nextRaw)
      drift.push(`${languageId}: browser metadata stale`);
    if (args.write) {
      writeFileSync(desktopPath, nextRaw);
      writeFileSync(browserPath, nextRaw);
    }
  }

  if (!args.write && drift.length > 0) {
    console.error("Multilingual single-audio IPA metadata gate failed:");
    for (const issue of drift) console.error(`- ${issue}`);
    console.error(
      `Run with --write to synchronize ${totalChanged} stale items.`,
    );
    process.exit(1);
  }

  console.log(
    args.write
      ? `Synchronized multilingual single-audio IPA metadata (${totalChanged} item updates).`
      : "Multilingual single-audio IPA metadata gate passed.",
  );
}

main();
