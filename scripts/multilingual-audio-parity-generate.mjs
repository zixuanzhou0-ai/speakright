#!/usr/bin/env node

import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import Module from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import ts from "typescript";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_MAX_ITEMS = 200;
const DEFAULT_MAX_ESTIMATED_CREDITS = 5000;
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    confirm: false,
    dryRun: false,
    maxItems: DEFAULT_MAX_ITEMS,
    maxEstimatedCredits: DEFAULT_MAX_ESTIMATED_CREDITS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--confirm") parsed.confirm = true;
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--max-items" && args[index + 1]) {
      parsed.maxItems = Number(args[++index]);
    } else if (arg === "--max-estimated-credits" && args[index + 1]) {
      parsed.maxEstimatedCredits = Number(args[++index]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

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

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function parseJsonSecret(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readWindowsCredentialStoreSnapshot() {
  if (process.platform !== "win32") return {};
  const script = String.raw`
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class SpeakRightCredMan {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredRead(string target, UInt32 type, int reservedFlag, out IntPtr credentialPtr);

  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr buffer);

  public static string Read(string target) {
    IntPtr credentialPtr;
    if (!CredRead(target, 1, 0, out credentialPtr)) {
      return null;
    }
    try {
      CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(credentialPtr, typeof(CREDENTIAL));
      if (credential.CredentialBlobSize == 0) {
        return "";
      }
      byte[] bytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, bytes, 0, (int)credential.CredentialBlobSize);
      return System.Text.Encoding.Unicode.GetString(bytes).TrimEnd('\0');
    } finally {
      CredFree(credentialPtr);
    }
  }
}
"@
$result = @{
  "speakright_elevenlabs_config" = [SpeakRightCredMan]::Read("speakright_elevenlabs_config.com.speakright.desktop")
}
$result | ConvertTo-Json -Compress
`;

  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      script,
    ]);
    return JSON.parse(stdout.trim() || "{}");
  } catch {
    return {};
  }
}

async function loadElevenLabsKey() {
  if (process.env.ELEVENLABS_API_KEY) {
    return {
      apiKey: process.env.ELEVENLABS_API_KEY,
      source: "environment",
    };
  }

  const windowsSnapshot = await readWindowsCredentialStoreSnapshot();
  const windowsConfig = parseJsonSecret(windowsSnapshot.speakright_elevenlabs_config);
  if (windowsConfig?.apiKey) {
    return { apiKey: windowsConfig.apiKey, source: "windows-credential-manager" };
  }

  return { apiKey: null, source: "unavailable" };
}

function readManifest(languageId) {
  const manifestPath = resolve(
    ROOT,
    "public",
    "audio",
    "language-packs",
    languageId,
    "manifest.json",
  );
  return {
    manifestPath,
    manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
  };
}

function existingKeys(manifest, normalizeAudioPackText) {
  return new Set(
    (manifest.items ?? []).flatMap((item) => [
      normalizeAudioPackText(item.key),
      normalizeAudioPackText(item.text),
    ]),
  );
}

function hashText(text) {
  return Module.createRequire(import.meta.url)("node:crypto")
    .createHash("sha1")
    .update(text)
    .digest("hex")
    .slice(0, 10);
}

function fileSlug(text) {
  const ascii = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return ascii || "item";
}

function makeFileName(languageId, text) {
  return `${fileSlug(text)}-${hashText(`${languageId}:${text}`)}.mp3`;
}

function mergeMissingItems(items, keys, normalizeAudioPackText) {
  const missing = new Map();

  for (const item of items) {
    const key = normalizeAudioPackText(item.text);
    if (keys.has(key)) continue;
    const current = missing.get(key);
    if (!current) {
      missing.set(key, {
        key,
        text: item.text,
        ipa: item.ipa,
        soundUnitSlugs: new Set(item.soundUnitSlugs),
        kinds: new Set([item.kind]),
        sources: new Set([item.source]),
      });
      continue;
    }
    for (const slug of item.soundUnitSlugs) current.soundUnitSlugs.add(slug);
    current.kinds.add(item.kind);
    current.sources.add(item.source);
  }

  return [...missing.values()]
    .map((item) => ({
      ...item,
      soundUnitSlugs: [...item.soundUnitSlugs].sort(),
      kinds: [...item.kinds].sort(),
      sources: [...item.sources].sort(),
    }))
    .sort((a, b) => a.text.localeCompare(b.text));
}

async function fetchElevenLabsUsage(apiKey) {
  const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": apiKey },
  });
  if (!response.ok) {
    return { ok: false, status: response.status, error: await response.text() };
  }
  const json = await response.json();
  return {
    ok: true,
    characterCount: json.character_count ?? null,
    characterLimit: json.character_limit ?? null,
    remaining:
      typeof json.character_limit === "number" &&
      typeof json.character_count === "number"
        ? json.character_limit - json.character_count
        : null,
  };
}

async function generateAudio(apiKey, config, text) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: config.modelId,
        voice_settings: {
          ...config.voiceSettings,
          speed: config.speed,
        },
      }),
    },
  );

  if (response.status === 429) throw new Error("RATE_LIMITED");
  if (!response.ok) {
    throw new Error(
      `ElevenLabs error ${response.status}: ${(await response.text()).slice(0, 400)}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function generateWithRetry(apiKey, config, text) {
  let attempt = 0;
  while (attempt < 4) {
    try {
      return await generateAudio(apiKey, config, text);
    } catch (error) {
      attempt += 1;
      if (!(error instanceof Error) || error.message !== "RATE_LIMITED" || attempt >= 4) {
        throw error;
      }
      await delay(1000 * 2 ** attempt);
    }
  }
  throw new Error("Retry loop exhausted");
}

function updateManifest(manifest, generatedItems) {
  const nextItems = [...(manifest.items ?? []), ...generatedItems].sort((a, b) =>
    String(a.key).localeCompare(String(b.key)),
  );
  return {
    ...manifest,
    updatedAt: new Date().toISOString(),
    itemCount: nextItems.length,
    generated: (manifest.generated ?? 0) + generatedItems.length,
    estimatedCredits:
      (manifest.estimatedCredits ?? 0) +
      generatedItems.reduce((sum, item) => sum + Array.from(item.text).length, 0),
    items: nextItems,
  };
}

function manifestItem(languageId, item, fileName, outPath) {
  return {
    key: item.key,
    text: item.text,
    ipa: item.ipa,
    soundUnitSlugs: item.soundUnitSlugs,
    kinds: item.kinds,
    sources: item.sources,
    fileName,
    audioSrc: `/audio/language-packs/${languageId}/${fileName}`,
    bytes: statSync(outPath).size,
  };
}

async function main() {
  const args = parseArgs();
  if (!args.confirm && !args.dryRun) {
    throw new Error("Refusing to generate without --confirm. Use --dry-run to inspect.");
  }

  installTypeScriptRequireHook();
  const {
    MULTILINGUAL_AUDIO_PARITY_LANGUAGES,
    getMultilingualPracticeItems,
  } = Module.createRequire(import.meta.url)(
    resolve(ROOT, "src", "lib", "multilingual-audio-parity.ts"),
  );
  const { normalizeAudioPackText } = Module.createRequire(import.meta.url)(
    resolve(ROOT, "src", "lib", "language-audio-pack-cache.ts"),
  );

  const plan = [];
  let estimatedCredits = 0;
  for (const languageId of MULTILINGUAL_AUDIO_PARITY_LANGUAGES) {
    const { manifest } = readManifest(languageId);
    const missing = mergeMissingItems(
      getMultilingualPracticeItems(languageId),
      existingKeys(manifest, normalizeAudioPackText),
      normalizeAudioPackText,
    );
    plan.push({ languageId, manifest, missing });
    estimatedCredits += missing.reduce(
      (sum, item) => sum + Array.from(item.text).length,
      0,
    );
  }

  const totalItems = plan.reduce((sum, item) => sum + item.missing.length, 0);
  console.log(
    `Planned multilingual audio generation: ${totalItems} items, ~${estimatedCredits} chars.`,
  );
  for (const item of plan) {
    console.log(`${item.languageId}: ${item.missing.length} missing`);
  }

  if (totalItems > args.maxItems) {
    throw new Error(`Refusing to generate ${totalItems} items; max is ${args.maxItems}.`);
  }
  if (estimatedCredits > args.maxEstimatedCredits) {
    throw new Error(
      `Refusing to generate ~${estimatedCredits} chars; max is ${args.maxEstimatedCredits}.`,
    );
  }
  if (args.dryRun) {
    console.log("Dry run only. No files generated.");
    return;
  }

  const { apiKey, source } = await loadElevenLabsKey();
  if (!apiKey) {
    throw new Error("ElevenLabs API key unavailable in env or Windows Credential Manager.");
  }
  console.log(`Using ElevenLabs key source: ${source}`);
  const beforeUsage = await fetchElevenLabsUsage(apiKey);

  let generated = 0;
  let skipped = 0;
  const failures = [];

  for (const languagePlan of plan) {
    const languageId = languagePlan.languageId;
    const { manifestPath } = readManifest(languageId);
    const outDir = resolve(ROOT, "public", "audio", "language-packs", languageId);
    mkdirSync(outDir, { recursive: true });

    const generatedManifestItems = [];
    for (const item of languagePlan.missing) {
      const fileName = makeFileName(languageId, item.text);
      const outPath = resolve(outDir, fileName);

      if (existsSync(outPath)) {
        skipped += 1;
        generatedManifestItems.push(
          manifestItem(languageId, item, fileName, outPath),
        );
        continue;
      }

      try {
        const audio = await generateWithRetry(apiKey, languagePlan.manifest, item.text);
        writeFileSync(outPath, audio);
        generated += 1;
        generatedManifestItems.push(
          manifestItem(languageId, item, fileName, outPath),
        );
        console.log(
          `[${generated}/${totalItems}] ${languageId} ${item.text} -> ${fileName}`,
        );
      } catch (error) {
        failures.push({
          languageId,
          text: item.text,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(
          `FAILED ${languageId} ${item.text}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }

      await delay(250);
    }

    if (generatedManifestItems.length > 0) {
      const nextManifest = updateManifest(
        languagePlan.manifest,
        generatedManifestItems,
      );
      writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
    }
  }

  const afterUsage = await fetchElevenLabsUsage(apiKey);
  const used =
    beforeUsage.ok && afterUsage.ok
      ? Math.max(
          0,
          (afterUsage.characterCount ?? 0) - (beforeUsage.characterCount ?? 0),
        )
      : null;

  console.log(
    `Done. Generated: ${generated}, skipped: ${skipped}, failed: ${failures.length}.`,
  );
  console.log(`ElevenLabs estimated characters used: ${used ?? "unknown"}`);
  if (failures.length > 0) {
    throw new Error(`Generation finished with ${failures.length} failures.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
