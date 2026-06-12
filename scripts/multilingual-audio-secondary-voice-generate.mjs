#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LANGUAGE_IDS = ["es-ES", "fr-FR", "ru-RU"];
const DEFAULT_MAX_ITEMS = 1600;
const DEFAULT_MAX_ESTIMATED_CREDITS = 40000;

const SECONDARY_VOICE_SELECTION = {
  "es-ES": {
    selected: {
      slot: "pink",
      voiceId: "SDVJaMLoJa7wc3s2sn7d",
      voiceName: "Lydia",
      modelId: "eleven_multilingual_v2",
      reason:
        "Female Peninsular Spanish educational voice; clear short-word diction and complementary timbre to Marco Cruz.",
    },
    candidates: [
      {
        voiceId: "SDVJaMLoJa7wc3s2sn7d",
        voiceName: "Lydia",
        reason: "Peninsular Spanish educational voice.",
      },
      {
        voiceId: "AxFLn9byyiDbMn5fmyqu",
        voiceName: "Aitana",
        reason: "Peninsular Spanish narrative voice.",
      },
      {
        voiceId: "5jTLciGr7JGMshpxjhek",
        voiceName: "Diego",
        reason: "Deep multilingual Spanish voice.",
      },
    ],
  },
  "fr-FR": {
    selected: {
      slot: "pink",
      voiceId: "or4EV8aZq78KWcXw48wd",
      voiceName: "Rachel",
      modelId: "eleven_multilingual_v2",
      reason:
        "Standard French female voice; clean educational contrast to the primary Clement voice.",
    },
    candidates: [
      {
        voiceId: "or4EV8aZq78KWcXw48wd",
        voiceName: "Rachel",
        reason: "Standard French female voice.",
      },
      {
        voiceId: "n1u6R6yj3qEpDLH3liBh",
        voiceName: "Alex - natif Francais",
        reason: "Native French male narrative voice.",
      },
      {
        voiceId: "aQROLel5sQbj1vuIVi6B",
        voiceName: "Nicolas Petit",
        reason: "Parisian French narration voice.",
      },
    ],
  },
  "ru-RU": {
    selected: {
      slot: "pink",
      voiceId: "XuEV9VY3VUASYgJVNBh0",
      voiceName: "Sergey",
      modelId: "eleven_multilingual_v2",
      reason:
        "Standard Russian male voice; stable low-noise complement to the primary Valeria voice.",
    },
    candidates: [
      {
        voiceId: "XuEV9VY3VUASYgJVNBh0",
        voiceName: "Sergey",
        reason: "Standard Russian male voice.",
      },
      {
        voiceId: "MWyJiWDobXN8FX3CJTdE",
        voiceName: "Oleg",
        reason: "Young Russian narrative voice.",
      },
      {
        voiceId: "d60rsXo2p0OwikDR5bS7",
        voiceName: "Olga Orlova",
        reason: "Russian female documentary voice.",
      },
    ],
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    confirm: false,
    dryRun: false,
    samplesOnly: false,
    maxItems: DEFAULT_MAX_ITEMS,
    maxEstimatedCredits: DEFAULT_MAX_ESTIMATED_CREDITS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--confirm") parsed.confirm = true;
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--samples-only") parsed.samplesOnly = true;
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
    return {
      apiKey: windowsConfig.apiKey,
      source: "windows-credential-manager",
    };
  }

  return { apiKey: null, source: "unavailable" };
}

function manifestPath(languageId) {
  return resolve(
    ROOT,
    "public",
    "audio",
    "language-packs",
    languageId,
    "manifest.json",
  );
}

function packDir(languageId) {
  return resolve(ROOT, "public", "audio", "language-packs", languageId);
}

function readManifest(languageId) {
  return JSON.parse(readFileSync(manifestPath(languageId), "utf8"));
}

function srcToPath(audioSrc) {
  return resolve(ROOT, "public", audioSrc.replace(/^\//, ""));
}

function hashText(text) {
  return createHash("sha1").update(text).digest("hex").slice(0, 10);
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

function makeVoiceFileName(languageId, voiceSlot, text) {
  return `${fileSlug(text)}-${voiceSlot}-${hashText(`${languageId}:${voiceSlot}:${text}`)}.mp3`;
}

function getPrimaryVoice(manifest) {
  return {
    slot: "blue",
    voiceId: manifest.voices?.blue?.voiceId ?? manifest.voiceId,
    voiceName: manifest.voices?.blue?.voiceName ?? manifest.voiceName,
    modelId: manifest.voices?.blue?.modelId ?? manifest.modelId,
    speed: manifest.voices?.blue?.speed ?? manifest.speed,
    voiceSettings: manifest.voices?.blue?.voiceSettings ?? manifest.voiceSettings,
  };
}

function getSecondaryVoice(languageId, manifest) {
  const selected = SECONDARY_VOICE_SELECTION[languageId].selected;
  return {
    slot: "pink",
    voiceId: manifest.voices?.pink?.voiceId ?? selected.voiceId,
    voiceName: manifest.voices?.pink?.voiceName ?? selected.voiceName,
    modelId: manifest.voices?.pink?.modelId ?? selected.modelId,
    speed: manifest.voices?.pink?.speed ?? manifest.speed,
    voiceSettings: manifest.voices?.pink?.voiceSettings ?? manifest.voiceSettings,
    reason: selected.reason,
  };
}

function readBytes(audioSrc) {
  try {
    return statSync(srcToPath(audioSrc)).size;
  } catch {
    return undefined;
  }
}

function migrateItem(languageId, item) {
  const blueSrc = item.audioByVoice?.blue ?? item.audioSrc;
  const blueFileName = item.fileNameByVoice?.blue ?? item.fileName;
  const pinkFileName =
    item.fileNameByVoice?.pink ?? makeVoiceFileName(languageId, "pink", item.text);
  const pinkSrc =
    item.audioByVoice?.pink ?? `/audio/language-packs/${languageId}/${pinkFileName}`;

  return {
    ...item,
    audioSrc: blueSrc,
    fileName: blueFileName,
    audioByVoice: {
      blue: blueSrc,
      pink: pinkSrc,
    },
    fileNameByVoice: {
      blue: blueFileName,
      pink: pinkFileName,
    },
    bytesByVoice: {
      ...(item.bytesByVoice ?? {}),
      blue: item.bytesByVoice?.blue ?? item.bytes ?? readBytes(blueSrc),
      pink: item.bytesByVoice?.pink ?? readBytes(pinkSrc),
    },
  };
}

function migrateManifest(languageId, manifest) {
  const blue = getPrimaryVoice(manifest);
  const pink = getSecondaryVoice(languageId, manifest);
  const items = (manifest.items ?? []).map((item) => migrateItem(languageId, item));

  return {
    ...manifest,
    version: Math.max(2, manifest.version ?? 1),
    voiceSlots: ["blue", "pink"],
    voices: {
      blue,
      pink,
    },
    secondaryVoiceSelection: {
      selected: {
        voiceId: pink.voiceId,
        voiceName: pink.voiceName,
        reason: pink.reason,
      },
      candidates: SECONDARY_VOICE_SELECTION[languageId].candidates,
    },
    itemCount: items.length,
    items,
  };
}

function missingPinkItems(languageId, manifest) {
  const migrated = migrateManifest(languageId, manifest);
  const missing = [];
  const missingBlue = [];

  for (const item of migrated.items) {
    const blueSrc = item.audioByVoice?.blue;
    const pinkSrc = item.audioByVoice?.pink;
    if (!blueSrc || !existsSync(srcToPath(blueSrc))) {
      missingBlue.push(item.text);
    }
    if (!pinkSrc || !existsSync(srcToPath(pinkSrc))) {
      missing.push(item);
    }
  }

  return {
    manifest: migrated,
    missing,
    missingBlue,
  };
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

async function generateAudio(apiKey, voice, text) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: voice.modelId,
        voice_settings: {
          ...voice.voiceSettings,
          speed: voice.speed,
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

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function generateWithRetry(apiKey, voice, text) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await generateAudio(apiKey, voice, text);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "RATE_LIMITED" ||
        attempt === 3
      ) {
        throw error;
      }
      await delay(1000 * 2 ** (attempt + 1));
    }
  }
  throw new Error("Retry loop exhausted");
}

function writeManifest(languageId, manifest) {
  writeFileSync(manifestPath(languageId), `${JSON.stringify(manifest, null, 2)}\n`);
}

function printPlan(plan) {
  let totalMissing = 0;
  let totalCredits = 0;
  for (const item of plan) {
    totalMissing += item.missing.length;
    totalCredits += item.estimatedCredits;
    console.log(
      `${item.languageId}: pink missing ${item.missing.length}, blue missing ${item.missingBlue.length}, ~${item.estimatedCredits} chars, secondary ${item.voice.voiceName}`,
    );
  }
  console.log(
    `Total secondary voice generation: ${totalMissing} files, ~${totalCredits} chars.`,
  );
  return { totalMissing, totalCredits };
}

function buildPlan() {
  return LANGUAGE_IDS.map((languageId) => {
    const current = readManifest(languageId);
    const { manifest, missing, missingBlue } = missingPinkItems(languageId, current);
    const voice = getSecondaryVoice(languageId, manifest);
    return {
      languageId,
      manifest,
      voice,
      missing,
      missingBlue,
      estimatedCredits: missing.reduce(
        (sum, item) => sum + Array.from(item.text).length,
        0,
      ),
    };
  });
}

async function main() {
  const args = parseArgs();
  if (!args.confirm && !args.dryRun) {
    throw new Error("Refusing to generate without --confirm. Use --dry-run to inspect.");
  }
  if (args.samplesOnly) {
    throw new Error(
      "Sample generation was intentionally disabled for release tightening; candidate metadata is stored in each manifest.",
    );
  }

  const plan = buildPlan();
  const { totalMissing, totalCredits } = printPlan(plan);
  const totalBlueMissing = plan.reduce(
    (sum, item) => sum + item.missingBlue.length,
    0,
  );
  if (totalBlueMissing > 0) {
    throw new Error(
      `Primary voice files missing before secondary generation: ${totalBlueMissing}`,
    );
  }
  if (totalMissing > args.maxItems) {
    throw new Error(`Refusing to generate ${totalMissing} files; max is ${args.maxItems}.`);
  }
  if (totalCredits > args.maxEstimatedCredits) {
    throw new Error(
      `Refusing to generate ~${totalCredits} chars; max is ${args.maxEstimatedCredits}.`,
    );
  }
  if (args.dryRun) {
    console.log("Dry run only. No files generated and manifests were not changed.");
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
    mkdirSync(packDir(languagePlan.languageId), { recursive: true });
    for (const item of languagePlan.missing) {
      const pinkSrc = item.audioByVoice.pink;
      const outPath = srcToPath(pinkSrc);
      if (existsSync(outPath)) {
        skipped += 1;
        item.bytesByVoice.pink = statSync(outPath).size;
        continue;
      }

      try {
        const audio = await generateWithRetry(
          apiKey,
          languagePlan.voice,
          item.text,
        );
        writeFileSync(outPath, audio);
        item.bytesByVoice.pink = statSync(outPath).size;
        generated += 1;
        console.log(
          `[${generated}/${totalMissing}] ${languagePlan.languageId} ${item.text} -> ${pinkSrc}`,
        );
      } catch (error) {
        failures.push({
          languageId: languagePlan.languageId,
          text: item.text,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(
          `FAILED ${languagePlan.languageId} ${item.text}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }

      await delay(225);
    }

    const completedManifest = {
      ...languagePlan.manifest,
      updatedAt: new Date().toISOString(),
      secondaryVoiceGeneratedAt: new Date().toISOString(),
      secondaryVoiceGenerated: (languagePlan.manifest.secondaryVoiceGenerated ?? 0) +
        languagePlan.missing.length,
      secondaryVoiceEstimatedCredits:
        (languagePlan.manifest.secondaryVoiceEstimatedCredits ?? 0) +
        languagePlan.estimatedCredits,
    };
    writeManifest(languagePlan.languageId, completedManifest);
  }

  const afterUsage = await fetchElevenLabsUsage(apiKey);
  const used =
    beforeUsage.ok && afterUsage.ok
      ? Math.max(
          0,
          (afterUsage.characterCount ?? 0) - (beforeUsage.characterCount ?? 0),
        )
      : null;

  const summary = {
    generatedAt: new Date().toISOString(),
    generated,
    skipped,
    failed: failures.length,
    estimatedCharacters: totalCredits,
    elevenLabsCharacterDelta: used,
    beforeUsage,
    afterUsage,
    languages: plan.map((item) => ({
      languageId: item.languageId,
      secondaryVoice: item.voice.voiceName,
      generatedOrPresentPinkFiles: item.missing.length,
      estimatedCharacters: item.estimatedCredits,
    })),
    failures,
  };
  const outPath = resolve(
    ROOT,
    ".runlogs",
    "multilingual-secondary-voice-generation-summary.json",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(
    `Done. Generated: ${generated}, skipped: ${skipped}, failed: ${failures.length}.`,
  );
  console.log(`ElevenLabs characters used: ${used ?? "unknown"}`);
  console.log(`Summary written: ${outPath}`);
  if (failures.length > 0) {
    throw new Error(`Generation finished with ${failures.length} failures.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
