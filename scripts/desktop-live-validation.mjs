import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const reportDir = path.join(root, "src-tauri", "target", "live-validation");
const languageIds = ["en-US", "es-ES", "fr-FR", "ru-RU"];
const languageLocales = {
  "en-US": "en-US",
  "es-ES": "es-ES",
  "fr-FR": "fr-FR",
  "ru-RU": "ru-RU",
};
const secureStoreKeys = {
  azure: "speakright_azure_config",
  elevenlabs: "speakright_elevenlabs_config",
};

const args = new Set(process.argv.slice(2));
const azureModeArg =
  process.argv.find((arg) => arg.startsWith("--azure-mode=")) ?? "";
const azureMode = azureModeArg.split("=")[1] || "high";
const azureConcurrency = Math.max(
  1,
  Number(process.env.SPEAKRIGHT_LIVE_AZURE_CONCURRENCY ?? "1"),
);
const elevenLabsTtsSmoke =
  process.env.SPEAKRIGHT_ALLOW_ELEVENLABS_TTS_SMOKE === "1" ||
  args.has("--elevenlabs-tts-smoke");
const elevenLabsEnabled = !args.has("--no-elevenlabs");
const maxElevenLabsTtsChars = Math.min(
  1000,
  Math.max(0, Number(process.env.SPEAKRIGHT_MAX_ELEVENLABS_TTS_CHARS ?? "8")),
);
const liveAzureEnabled = !args.has("--no-live-azure");

function executablePath() {
  if (process.platform === "win32") {
    return path.join(root, "src-tauri", "target", "release", "speakright.exe");
  }
  if (process.platform === "darwin") {
    return path.join(
      root,
      "src-tauri",
      "target",
      "release",
      "bundle",
      "macos",
      "SpeakRight.app",
      "Contents",
      "MacOS",
      "SpeakRight",
    );
  }
  return path.join(root, "src-tauri", "target", "release", "speakright");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not reserve a WebView2 debugging port."));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function createSmokeProfileRoot() {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "speakright-live-validation-"),
  );
  await mkdir(path.join(rootDir, "WebView2"), { recursive: true });
  return rootDir;
}

async function removeTempProfile(profileRoot) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(profileRoot, { recursive: true, force: true });
      return null;
    } catch (error) {
      if (attempt === 7) {
        return error instanceof Error ? error.message : String(error);
      }
      await delay(500);
    }
  }
  return null;
}

function buildSmokeEnv(debuggingPort, smokeProfileRoot) {
  if (process.platform !== "win32") return process.env;
  const existingArgs = process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS ?? "";
  const smokeArgs = [
    `--remote-debugging-port=${debuggingPort}`,
    "--remote-allow-origins=*",
  ].join(" ");
  return {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: [existingArgs, smokeArgs]
      .filter(Boolean)
      .join(" "),
    WEBVIEW2_USER_DATA_FOLDER: path.join(smokeProfileRoot, "WebView2"),
  };
}

async function waitForDevtoolsTarget(debuggingPort) {
  const deadline = Date.now() + 12_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${debuggingPort}/json/list`,
      );
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find(
          (item) => item.type === "page" && item.webSocketDebuggerUrl,
        );
        if (target) return target;
      }
      lastError = new Error(
        `WebView2 devtools returned HTTP ${response.status}`,
      );
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(
    `WebView2 devtools target was not available: ${lastError instanceof Error ? lastError.message : lastError}`,
  );
}

function normalizeWebSocketData(data) {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return String(data);
}

function createCdpClient(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    const pending = new Map();
    let nextId = 1;
    let opened = false;

    const rejectPending = (error) => {
      for (const { reject: rejectCommand } of pending.values()) {
        rejectCommand(error);
      }
      pending.clear();
    };

    socket.addEventListener("open", () => {
      opened = true;
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          const payload = JSON.stringify({ id, method, params });
          return new Promise((resolveCommand, rejectCommand) => {
            const timeout = setTimeout(() => {
              pending.delete(id);
              rejectCommand(new Error(`CDP command timed out: ${method}`));
            }, 8_000);
            pending.set(id, {
              resolve: (value) => {
                clearTimeout(timeout);
                resolveCommand(value);
              },
              reject: (error) => {
                clearTimeout(timeout);
                rejectCommand(error);
              },
            });
            socket.send(payload);
          });
        },
        close() {
          socket.close();
        },
      });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(normalizeWebSocketData(event.data));
      if (!message.id || !pending.has(message.id)) return;
      const command = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        command.reject(
          new Error(
            `CDP command failed: ${message.error.message ?? JSON.stringify(message.error)}`,
          ),
        );
      } else {
        command.resolve(message.result);
      }
    });

    socket.addEventListener("error", () => {
      const error = new Error("CDP WebSocket connection failed.");
      if (!opened) reject(error);
      rejectPending(error);
    });

    socket.addEventListener("close", () => {
      rejectPending(new Error("CDP WebSocket connection closed."));
    });
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.text || "Runtime.evaluate failed",
    );
  }
  return result.result?.value;
}

async function readSecureStoreSnapshot() {
  const exe = executablePath();
  if (!existsSync(exe)) return { snapshot: {}, warning: "release exe missing" };

  const debuggingPort = await getOpenPort();
  const profileRoot = await createSmokeProfileRoot();
  const child = spawn(exe, [], {
    cwd: root,
    env: buildSmokeEnv(debuggingPort, profileRoot),
    stdio: "ignore",
    detached: process.platform !== "win32",
  });

  try {
    const target = await waitForDevtoolsTarget(debuggingPort);
    const cdp = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await cdp.send("Runtime.enable");
      const snapshot = await evaluate(
        cdp,
        `
(async () => {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== "function") {
    return { error: "tauri invoke unavailable" };
  }
  const keys = ${JSON.stringify(Object.values(secureStoreKeys))};
  const result = {};
  for (const key of keys) {
    result[key] = await invoke("secure_store_get", { key });
  }
  return result;
})()
`,
      );
      return { snapshot };
    } finally {
      cdp.close();
    }
  } catch (error) {
    return {
      snapshot: {},
      warning: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (!child.killed) child.kill();
    await delay(750);
    const cleanupWarning = await removeTempProfile(profileRoot);
    if (cleanupWarning) {
      console.warn(`Temporary WebView profile cleanup warning: ${cleanupWarning}`);
    }
  }
}

async function readWindowsCredentialStoreSnapshot() {
  if (process.platform !== "win32") {
    return { snapshot: {}, warning: "Windows credential fallback unavailable" };
  }
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
$targets = @{
  "speakright_azure_config" = "speakright_azure_config.com.speakright.desktop"
  "speakright_elevenlabs_config" = "speakright_elevenlabs_config.com.speakright.desktop"
}
$result = @{}
foreach ($key in $targets.Keys) {
  $result[$key] = [SpeakRightCredMan]::Read($targets[$key])
}
$result | ConvertTo-Json -Compress
`;
  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      script,
    ]);
    return { snapshot: JSON.parse(stdout.trim() || "{}") };
  } catch (error) {
    return {
      snapshot: {},
      warning:
        error instanceof Error
          ? error.message
          : "Windows credential fallback failed",
    };
  }
}

function parseJsonSecret(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadSecrets() {
  const envAzureKey = process.env.SPEAKRIGHT_AZURE_KEY;
  const envAzureRegion = process.env.SPEAKRIGHT_AZURE_REGION;
  const envElevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const envAzure =
    envAzureKey && envAzureRegion
      ? { subscriptionKey: envAzureKey, region: envAzureRegion }
      : null;
  const envElevenLabs = envElevenLabsKey ? { apiKey: envElevenLabsKey } : null;

  if (envAzure || envElevenLabs) {
    return {
      azure: envAzure,
      elevenlabs: envElevenLabs,
      source: "environment",
      warning: null,
    };
  }

  const { snapshot, warning } = await readSecureStoreSnapshot();
  const azureRaw = snapshot[secureStoreKeys.azure];
  const elevenLabsRaw = snapshot[secureStoreKeys.elevenlabs];
  if (azureRaw || elevenLabsRaw) {
    return {
      azure: parseJsonSecret(azureRaw),
      elevenlabs: parseJsonSecret(elevenLabsRaw),
      source: "tauri-secure-store",
      warning,
    };
  }

  const fallback = await readWindowsCredentialStoreSnapshot();
  return {
    azure: parseJsonSecret(fallback.snapshot.speakright_azure_config),
    elevenlabs: parseJsonSecret(fallback.snapshot.speakright_elevenlabs_config),
    source: "windows-credential-manager",
    warning: warning ?? fallback.warning,
  };
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function localPathFromPublicSrc(src) {
  return path.join(root, "public", src.replace(/^\//, ""));
}

async function fileInfo(filePath) {
  try {
    const info = await stat(filePath);
    return { exists: true, bytes: info.size };
  } catch {
    return { exists: false, bytes: 0 };
  }
}

async function auditEnglishAudio() {
  const manifest = await readJson("public/audio/words/manifest.json");
  const failures = [];
  let checked = 0;
  for (const voice of Object.keys(manifest.files ?? {})) {
    for (const [word, entry] of Object.entries(manifest.files[voice] ?? {})) {
      checked += 1;
      const info = await fileInfo(localPathFromPublicSrc(entry.path));
      if (!info.exists || info.bytes <= 0) {
        failures.push({ voice, word, path: entry.path, reason: "missing" });
      }
    }
  }
  return {
    words: manifest.words?.length ?? 0,
    voices: Object.keys(manifest.files ?? {}).length,
    filesChecked: checked,
    failures,
  };
}

async function auditLanguagePack(languageId) {
  const manifest = await readJson(
    `public/audio/language-packs/${languageId}/manifest.json`,
  );
  const failures = [];
  let filesChecked = 0;
  for (const item of manifest.items ?? []) {
    const audioByVoice = item.audioByVoice ?? { blue: item.audioSrc };
    for (const [voiceSlot, audioSrc] of Object.entries(audioByVoice)) {
      filesChecked += 1;
      const info = await fileInfo(localPathFromPublicSrc(audioSrc));
      if (!info.exists || info.bytes <= 0) {
        failures.push({
          key: item.key,
          text: item.text,
          voiceSlot,
          path: audioSrc,
          reason: "missing",
        });
      }
    }
  }
  return {
    languageId,
    itemCount: manifest.items?.length ?? 0,
    filesChecked,
    voiceSlots: manifest.voiceSlots ?? ["blue"],
    manifestItemCount: manifest.itemCount,
    voiceName: manifest.voiceName,
    voices: manifest.voices ?? null,
    modelId: manifest.modelId,
    failures,
  };
}

async function walk(dir, predicate, output = []) {
  const entries = await import("node:fs/promises").then((fs) =>
    fs.readdir(dir, { withFileTypes: true }),
  );
  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(filePath, predicate, output);
    } else if (predicate(filePath)) {
      output.push(filePath);
    }
  }
  return output;
}

async function auditVideos() {
  const videoRoot = path.join(root, "public", "videos");
  const files = await walk(videoRoot, (filePath) => /\.mp4$/i.test(filePath));
  const failures = [];
  for (const filePath of files) {
    const info = await fileInfo(filePath);
    if (!info.exists || info.bytes <= 0) {
      failures.push({ path: path.relative(root, filePath), reason: "missing" });
    }
  }
  return {
    filesChecked: files.length,
    failures,
    byLanguage: Object.fromEntries(
      languageIds.map((languageId) => [
        languageId,
        files.filter((filePath) =>
          filePath.includes(path.join("language-assets", languageId)),
        ).length,
      ]),
    ),
  };
}

function englishAzureSamples(manifest, mode) {
  const blue = manifest.files?.blue ?? {};
  const all = Object.entries(blue).map(([word, entry]) => ({
    languageId: "en-US",
    locale: "en-US",
    text: word,
    audioSrc: entry.path,
    kind: "english-word",
  }));
  return mode === "full" ? all : all.slice(0, 40);
}

async function collectAzureSamples(mode) {
  const englishManifest = await readJson("public/audio/words/manifest.json");
  const samples = englishAzureSamples(englishManifest, mode);
  for (const languageId of ["es-ES", "fr-FR", "ru-RU"]) {
    const manifest = await readJson(
      `public/audio/language-packs/${languageId}/manifest.json`,
    );
    const items = (manifest.items ?? []).map((item) => ({
      languageId,
      locale: languageLocales[languageId],
      text: item.text,
      audioSrc: item.audioSrc,
      kind: "language-pack-item",
    }));
    samples.push(...(mode === "full" ? items : items.slice(0, 60)));
  }
  return samples;
}

async function convertToAzureWav(sample, index) {
  const input = localPathFromPublicSrc(sample.audioSrc);
  const output = path.join(reportDir, "wav-cache", `${index}.wav`);
  await mkdir(path.dirname(output), { recursive: true });
  await execFileAsync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    input,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-sample_fmt",
    "s16",
    output,
  ]);
  return output;
}

function base64Json(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

async function assessAzure({ azure, sample, wavPath }) {
  const pronConfig = {
    ReferenceText: sample.text,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: true,
    ...(sample.text.trim().includes(" ")
      ? { EnableProsodyAssessment: true }
      : {}),
  };
  const url =
    `https://${azure.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
    `?language=${encodeURIComponent(sample.locale)}&format=detailed`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": azure.subscriptionKey,
      "Content-Type": "audio/wav",
      "Pronunciation-Assessment": base64Json(pronConfig),
      Accept: "application/json",
    },
    body: await readFile(wavPath),
  });
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, error: text.slice(0, 500) };
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, status: response.status, error: "invalid json" };
  }
  const best = json.NBest?.[0];
  const assessment = best?.PronunciationAssessment ?? {};
  const words = Array.isArray(best?.Words) ? best.Words : [];
  const wordAssessments = words
    .map((word) => word?.PronunciationAssessment ?? {})
    .filter((item) => typeof item.AccuracyScore === "number");
  const averageWordAccuracy =
    wordAssessments.length > 0
      ? wordAssessments.reduce((sum, item) => sum + item.AccuracyScore, 0) /
        wordAssessments.length
      : null;
  const pronScore =
    assessment.PronScore ??
    best?.PronScore ??
    (wordAssessments.length > 0 ? averageWordAccuracy : null);
  const accuracyScore =
    assessment.AccuracyScore ?? best?.AccuracyScore ?? averageWordAccuracy;
  const completenessScore =
    assessment.CompletenessScore ??
    best?.CompletenessScore ??
    wordAssessments[0]?.CompletenessScore ??
    null;
  return {
    ok:
      json.RecognitionStatus !== "NoMatch" &&
      json.RecognitionStatus !== "InitialSilenceTimeout" &&
      typeof pronScore === "number" &&
      words.length > 0,
    recognitionStatus: json.RecognitionStatus,
    pronScore,
    accuracyScore,
    completenessScore,
    wordCount: words.length,
  };
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

async function runAzureValidation(azure) {
  if (!liveAzureEnabled) {
    return { skipped: true, reason: "--no-live-azure" };
  }
  if (!azure?.subscriptionKey || !azure?.region) {
    return { skipped: true, reason: "Azure credentials unavailable" };
  }
  const samples = await collectAzureSamples(azureMode);
  const failures = [];
  const results = await runPool(samples, azureConcurrency, async (sample, index) => {
    try {
      const wavPath = await convertToAzureWav(sample, index);
      const result = await assessAzure({ azure, sample, wavPath });
      if (!result.ok) {
        failures.push({
          index,
          languageId: sample.languageId,
          text: sample.text,
          audioSrc: sample.audioSrc,
          result,
        });
      }
      return { sample, result };
    } catch (error) {
      const result = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      failures.push({
        index,
        languageId: sample.languageId,
        text: sample.text,
        audioSrc: sample.audioSrc,
        result,
      });
      return { sample, result };
    }
  });
  const byLanguage = {};
  for (const { sample, result } of results) {
    byLanguage[sample.languageId] ??= { checked: 0, passed: 0, failed: 0 };
    byLanguage[sample.languageId].checked += 1;
    if (result.ok) byLanguage[sample.languageId].passed += 1;
    else byLanguage[sample.languageId].failed += 1;
  }
  return {
    mode: azureMode,
    checked: samples.length,
    passed: results.filter((item) => item.result.ok).length,
    failed: failures.length,
    byLanguage,
    failures: failures.slice(0, 50),
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

async function runElevenLabsValidation(elevenlabs) {
  if (!elevenLabsEnabled) {
    return { skipped: true, reason: "--no-elevenlabs" };
  }
  if (!elevenlabs?.apiKey) {
    return { skipped: true, reason: "ElevenLabs credentials unavailable" };
  }
  const before = await fetchElevenLabsUsage(elevenlabs.apiKey);
  let ttsSmoke = { skipped: true, reason: "TTS smoke disabled to save credits" };
  if (elevenLabsTtsSmoke && maxElevenLabsTtsChars > 0) {
    const text = "ok".slice(0, maxElevenLabsTtsChars);
    const response = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/Gfpl8Yo74Is0W6cPUWWT",
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenlabs.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: false,
          },
        }),
      },
    );
    ttsSmoke = {
      ok: response.ok,
      status: response.status,
      characters: text.length,
      modelId: "eleven_flash_v2_5",
    };
    if (!response.ok) {
      ttsSmoke.error = (await response.text()).slice(0, 500);
    } else {
      await response.arrayBuffer();
    }
  }
  const after = await fetchElevenLabsUsage(elevenlabs.apiKey);
  return {
    before,
    after,
    ttsSmoke,
    estimatedCharactersUsed:
      before.ok && after.ok
        ? Math.max(0, (after.characterCount ?? 0) - (before.characterCount ?? 0))
        : null,
  };
}

function sanitizeReport(report) {
  return JSON.parse(
    JSON.stringify(report).replace(
      /(subscriptionKey|apiKey|Ocp-Apim-Subscription-Key|xi-api-key)":"[^"]+"/g,
      '$1":"[REDACTED]"',
    ),
  );
}

async function main() {
  await mkdir(reportDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const [englishAudio, ...packs] = await Promise.all([
    auditEnglishAudio(),
    ...["es-ES", "fr-FR", "ru-RU"].map(auditLanguagePack),
  ]);
  const videos = await auditVideos();
  const secrets =
    liveAzureEnabled || elevenLabsEnabled
      ? await loadSecrets()
      : {
          azure: null,
          elevenlabs: null,
          source: "not-read",
          warning: null,
        };
  const azure = await runAzureValidation(secrets.azure);
  const elevenlabs = await runElevenLabsValidation(secrets.elevenlabs);
  const report = sanitizeReport({
    startedAt,
    finishedAt: new Date().toISOString(),
    repo: root,
    options: {
      azureMode,
      azureConcurrency,
      liveAzureEnabled,
      elevenLabsEnabled,
      elevenLabsTtsSmoke,
      maxElevenLabsTtsChars,
    },
    secretSource: secrets.source,
    secretReadWarning: secrets.warning,
    localAudio: {
      english: englishAudio,
      languagePacks: packs,
    },
    videos,
    azure,
    elevenlabs,
  });
  const reportPath = path.join(reportDir, "desktop-live-validation-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const localFailures =
    englishAudio.failures.length +
    packs.reduce((sum, pack) => sum + pack.failures.length, 0) +
    videos.failures.length;
  const azureFailures = azure.skipped ? 0 : azure.failed;
  const failed = localFailures > 0 || azureFailures > 0;

  console.log(`Desktop live validation report: ${reportPath}`);
  console.log(
    `Local audio checked: English ${englishAudio.filesChecked}, language packs ${packs
      .map((pack) => `${pack.languageId}:${pack.filesChecked}`)
      .join(", ")}`,
  );
  console.log(`Videos checked: ${videos.filesChecked}`);
  if (azure.skipped) console.log(`Azure skipped: ${azure.reason}`);
  else console.log(`Azure checked: ${azure.checked}, failed: ${azure.failed}`);
  if (elevenlabs.skipped) console.log(`ElevenLabs skipped: ${elevenlabs.reason}`);
  else {
    console.log(
      `ElevenLabs usage checked; estimated chars used: ${elevenlabs.estimatedCharactersUsed ?? "unknown"}`,
    );
  }
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
