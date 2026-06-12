#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import Module from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_OUT = resolve(
  ROOT,
  "src-tauri",
  "target",
  "audio-parity",
  "gap-report.json",
);

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    out: DEFAULT_OUT,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--out" && args[i + 1]) {
      parsed.out = resolve(process.cwd(), args[++i]);
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--dry-run") {
      // Dry-run is the only mode for this report script.
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function installTypeScriptRequireHook() {
  const originalResolve = Module._resolveFilename;

  Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
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

function loadManifestAudioKeys(languageId, getAudioParityKey) {
  const manifestPath = resolve(
    ROOT,
    "public",
    "audio",
    "language-packs",
    languageId,
    "manifest.json",
  );

  if (!existsSync(manifestPath)) {
    return new Set();
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const keys = new Set();

  for (const item of manifest.items ?? []) {
    const audioByVoice = item.audioByVoice ?? {
      blue: item.audioSrc,
    };
    for (const [voiceSlot, audioSrc] of Object.entries(audioByVoice)) {
      if (!audioSrc) continue;
      const audioPath = resolve(ROOT, "public", String(audioSrc).replace(/^\//, ""));
      if (!existsSync(audioPath)) continue;
      keys.add(getAudioParityKey(voiceSlot, item.key));
      keys.add(getAudioParityKey(voiceSlot, item.text));
    }
  }

  return keys;
}

function main() {
  const args = parseArgs();
  installTypeScriptRequireHook();

  const {
    MULTILINGUAL_AUDIO_PARITY_LANGUAGES,
    buildMultilingualAudioParityReport,
    getAudioParityKey,
  } = Module.createRequire(import.meta.url)(
    resolve(ROOT, "src", "lib", "multilingual-audio-parity.ts"),
  );

  const audioKeysByLanguage = Object.fromEntries(
    MULTILINGUAL_AUDIO_PARITY_LANGUAGES.map((languageId) => [
      languageId,
      loadManifestAudioKeys(languageId, getAudioParityKey),
    ]),
  );
  const report = buildMultilingualAudioParityReport(audioKeysByLanguage);
  const output = {
    ...report,
    mode: "dry-run",
    elevenLabs: {
      willGenerateAudio: false,
      estimatedCallsBeforeDedupe: report.totals.missingAudioItems,
      estimatedCredits: report.totals.estimatedNewCharacters,
      note: "No ElevenLabs API call is made by this dry-run. Generate only after user confirmation.",
    },
  };

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Multilingual audio parity dry-run written: ${args.out}`);
  console.log(
    `Languages: ${report.languages
      .map(
        (language) =>
          `${language.languageId} ${language.existingAudioItems} existing, ${language.missingAudioItems} missing, ~${language.estimatedNewCharacters} chars`,
      )
      .join(" | ")}`,
  );
  console.log(
    `Total missing audio items: ${report.totals.missingAudioItems}; estimated characters/credits: ${report.totals.estimatedNewCharacters}`,
  );
  console.log("No ElevenLabs calls were made.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
