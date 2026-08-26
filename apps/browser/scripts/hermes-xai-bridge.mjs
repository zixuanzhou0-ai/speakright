import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ProxyAgent } from "undici";

export const HERMES_BRIDGE_HOST = "127.0.0.1";
export const HERMES_BRIDGE_PORT = 17831;
export const HERMES_BRIDGE_PROTOCOL_VERSION = 1;

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_VERTEX_RESPONSE_BYTES =
  Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 1024 * 1024;
const PYTHON_TIMEOUT_MS = 75_000;
const STATUS_TIMEOUT_MS = 20_000;
const VERTEX_TIMEOUT_MS = 75_000;
const MAX_CONCURRENT_TTS = 2;
const RATE_LIMIT_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_SPEAKRIGHT_PORTS = [3000, 4173, 4174, 4175, 4176, 4177, 4178];
const LANGUAGE_MAP = new Map([
  ["en-US", "en"],
  ["es-ES", "es-ES"],
  ["fr-FR", "fr"],
  ["ru-RU", "ru"],
]);
const VERTEX_LANGUAGE_IDS = new Set(["en-US", "es-ES", "fr-FR", "ru-RU"]);
const VERTEX_VOICE_NAMES = new Map(
  [
    "Zephyr",
    "Puck",
    "Charon",
    "Kore",
    "Fenrir",
    "Leda",
    "Orus",
    "Aoede",
    "Callirrhoe",
    "Autonoe",
    "Enceladus",
    "Iapetus",
    "Umbriel",
    "Algieba",
    "Despina",
    "Erinome",
    "Algenib",
    "Rasalgethi",
    "Laomedeia",
    "Achernar",
    "Alnilam",
    "Schedar",
    "Gacrux",
    "Pulcherrima",
    "Achird",
    "Zubenelgenubi",
    "Vindemiatrix",
    "Sadachbia",
    "Sadaltager",
    "Sulafat",
  ].map((voiceName) => [voiceName.toLowerCase(), voiceName]),
);

export const VERTEX_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
export const VERTEX_GEMINI_TTS_LOCATION = "global";
export const VERTEX_GEMINI_TTS_SAMPLE_RATE = 24_000;

const GCLOUD_WINDOWS_SCRIPT =
  "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.ps1";
let vertexProxyDispatcher;

const STATUS_SCRIPT = `
import json
try:
    from tools.tts_tool import _load_tts_config, DEFAULT_XAI_VOICE_ID
    from tools.xai_http import resolve_xai_http_credentials
    config = _load_tts_config()
    xai = dict(config.get("xai") or {})
    voice = str(xai.get("voice_id") or DEFAULT_XAI_VOICE_ID).strip()
    credentials = resolve_xai_http_credentials()
    configured = bool(str(credentials.get("api_key") or "").strip())
    print(json.dumps({"available": configured, "provider": "xai", "voiceId": voice, "configured": configured}))
except Exception:
    print(json.dumps({"available": False, "provider": "xai", "configured": False}))
`;

const TTS_SCRIPT = `
import base64
import copy
import json
import math
import sys
try:
    from tools import tts_tool
    from tools.xai_http import resolve_xai_http_credentials
    import requests

    text = sys.stdin.read()
    output_path, language, speed_text = sys.argv[1], sys.argv[2], sys.argv[3]
    config = copy.deepcopy(tts_tool._load_tts_config())
    xai = copy.deepcopy(config.get("xai") or {})
    credentials = resolve_xai_http_credentials()
    api_key = str(credentials.get("api_key") or "").strip()
    if not api_key:
        raise ValueError("No xAI credentials found")

    voice_id = str(
        xai.get("voice_id") or tts_tool.DEFAULT_XAI_VOICE_ID
    ).strip() or tts_tool.DEFAULT_XAI_VOICE_ID
    base_url = str(
        xai.get("base_url")
        or credentials.get("base_url")
        or tts_tool.DEFAULT_XAI_BASE_URL
    ).strip().rstrip("/")
    speed = max(
        tts_tool.DEFAULT_XAI_SPEED_MIN,
        min(tts_tool.DEFAULT_XAI_SPEED_MAX, float(speed_text)),
    )
    sample_rate = int(
        xai.get("sample_rate", tts_tool.DEFAULT_XAI_SAMPLE_RATE)
    )
    bit_rate = int(xai.get("bit_rate", tts_tool.DEFAULT_XAI_BIT_RATE))

    # SpeakRight needs the graphemes to match the visible practice text exactly,
    # so this bridge intentionally does not apply Hermes' optional speech-tag
    # rewrite before asking xAI for timestamps.
    payload = {
        "text": text,
        "voice_id": voice_id,
        "language": language,
        "with_timestamps": True,
    }
    if (
        sample_rate != tts_tool.DEFAULT_XAI_SAMPLE_RATE
        or bit_rate != tts_tool.DEFAULT_XAI_BIT_RATE
    ):
        payload["output_format"] = {
            "codec": "mp3",
            "sample_rate": sample_rate,
            "bit_rate": bit_rate,
        }
    if speed != tts_tool.DEFAULT_XAI_SPEED_DEFAULT:
        payload["speed"] = speed

    optimize_latency = xai.get(
        "optimize_streaming_latency",
        config.get("optimize_streaming_latency"),
    )
    if optimize_latency is not None and optimize_latency != "":
        try:
            optimize_latency = max(0, min(2, int(optimize_latency)))
        except (TypeError, ValueError):
            optimize_latency = 0
        if optimize_latency != tts_tool.DEFAULT_XAI_OPTIMIZE_STREAMING_LATENCY_DEFAULT:
            payload["optimize_streaming_latency"] = optimize_latency

    user_agent = getattr(tts_tool, "hermes_xai_user_agent", None)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": user_agent() if callable(user_agent) else "SpeakRight",
    }
    response = requests.post(
        f"{base_url}/tts",
        headers=headers,
        json=payload,
        timeout=60,
    )

    # Some older xAI-compatible endpoints reject the timestamp flag. Preserve
    # their previous audio-only behavior without changing the Hermes install.
    if response.status_code in (400, 422):
        xai["language"] = language
        xai["speed"] = speed
        config["xai"] = xai
        config["provider"] = "xai"
        tts_tool._generate_xai_tts(text, output_path, config)
        print(json.dumps({
            "mimeType": "audio/mpeg",
            "duration": None,
            "alignment": None,
        }))
        sys.exit(0)

    response.raise_for_status()
    content_type = str(response.headers.get("Content-Type") or "").split(";", 1)[0].strip()
    response_data = None
    try:
        response_data = response.json()
    except (ValueError, json.JSONDecodeError):
        response_data = None

    if isinstance(response_data, dict) and isinstance(response_data.get("audio"), str):
        audio = base64.b64decode(response_data["audio"], validate=True)
        if not audio:
            raise ValueError("xAI returned empty audio")
        with open(output_path, "wb") as audio_file:
            audio_file.write(audio)

        alignment = None
        timestamp_data = response_data.get("audio_timestamps")
        if not isinstance(timestamp_data, dict):
            timestamp_data = response_data.get("audioTimestamps")
        if isinstance(timestamp_data, dict):
            characters = timestamp_data.get("graph_chars")
            if not isinstance(characters, list):
                characters = timestamp_data.get("graphChars")
            graph_times = timestamp_data.get("graph_times")
            if not isinstance(graph_times, list):
                graph_times = timestamp_data.get("graphTimes")
            if (
                isinstance(characters, list)
                and isinstance(graph_times, list)
                and len(characters) > 0
                and len(characters) == len(graph_times)
            ):
                starts = []
                ends = []
                valid = True
                previous_start = -1.0
                for character, time_range in zip(characters, graph_times):
                    if (
                        not isinstance(character, str)
                        or not isinstance(time_range, (list, tuple))
                        or len(time_range) != 2
                    ):
                        valid = False
                        break
                    try:
                        start = float(time_range[0])
                        end = float(time_range[1])
                    except (TypeError, ValueError):
                        valid = False
                        break
                    if (
                        not math.isfinite(start)
                        or not math.isfinite(end)
                        or start < 0
                        or end < start
                        or start < previous_start
                    ):
                        valid = False
                        break
                    starts.append(start)
                    ends.append(end)
                    previous_start = start
                if valid:
                    alignment = {
                        "characters": characters,
                        "character_start_times_seconds": starts,
                        "character_end_times_seconds": ends,
                    }

        duration = response_data.get("duration")
        if not isinstance(duration, (int, float)) or not math.isfinite(float(duration)) or duration <= 0:
            duration = None
        print(json.dumps({
            "mimeType": response_data.get("content_type") or response_data.get("contentType") or content_type or "audio/mpeg",
            "duration": duration,
            "alignment": alignment,
        }, ensure_ascii=False))
    else:
        # A successful legacy endpoint may still return raw audio even when it
        # ignores the timestamp flag. Keep it playable and report no alignment.
        if not response.content:
            raise ValueError("xAI returned empty audio")
        with open(output_path, "wb") as audio_file:
            audio_file.write(response.content)
        print(json.dumps({
            "mimeType": content_type or "audio/mpeg",
            "duration": None,
            "alignment": None,
        }))
except Exception as exc:
    message = str(exc).lower()
    status = getattr(getattr(exc, "response", None), "status_code", None)
    if "credential" in message or "api key" in message or status in (401, 403):
        sys.exit(20 if status not in (401, 403) else 21)
    if status == 429 or "rate limit" in message:
        sys.exit(22)
    sys.exit(23)
`;

function hermesPaths() {
  const roots = [];
  if (process.env.HERMES_AGENT_HOME) {
    roots.push(resolve(process.env.HERMES_AGENT_HOME));
  }
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    roots.push(join(process.env.LOCALAPPDATA, "hermes", "hermes-agent"));
  }

  for (const agentRoot of roots) {
    const pythonCandidates =
      process.platform === "win32"
        ? [join(agentRoot, "venv", "Scripts", "python.exe")]
        : [
            join(agentRoot, "venv", "bin", "python3"),
            join(agentRoot, "venv", "bin", "python"),
          ];
    const python = pythonCandidates.find((candidate) => existsSync(candidate));
    if (python && existsSync(join(agentRoot, "tools", "tts_tool.py"))) {
      return { agentRoot, python };
    }
  }
  return null;
}

function defaultAllowedOrigins() {
  const origins = new Set();
  for (const port of DEFAULT_SPEAKRIGHT_PORTS) {
    origins.add(`http://127.0.0.1:${port}`);
    origins.add(`http://localhost:${port}`);
  }
  return origins;
}

export function isAllowedSpeakRightOrigin(origin, additionalOrigins = []) {
  if (typeof origin !== "string") return false;
  const allowed = defaultAllowedOrigins();
  for (const candidate of additionalOrigins) {
    try {
      const parsed = new URL(candidate);
      if (
        parsed.protocol === "http:" &&
        (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") &&
        parsed.port &&
        parsed.pathname === "/" &&
        !parsed.search &&
        !parsed.hash
      ) {
        allowed.add(parsed.origin);
      }
    } catch {
      // Ignore malformed caller-provided origins.
    }
  }
  return allowed.has(origin);
}

export function isAllowedBridgeHost(host) {
  return (
    host === `${HERMES_BRIDGE_HOST}:${HERMES_BRIDGE_PORT}` ||
    host === `localhost:${HERMES_BRIDGE_PORT}`
  );
}

export function validateTtsPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, status: 400, error: "请求格式无效。" };
  }
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) return { ok: false, status: 400, error: "请输入需要朗读的文字。" };
  if ([...text].length > 500) {
    return {
      ok: false,
      status: 400,
      error: "标准示范文本过长，请控制在 500 个字符以内。",
    };
  }
  const language = LANGUAGE_MAP.get(payload.languageId);
  if (!language) {
    return {
      ok: false,
      status: 400,
      error: "当前语言暂不支持爱马仕 Grok TTS。",
    };
  }
  if (
    typeof payload.speed !== "number" ||
    !Number.isFinite(payload.speed) ||
    payload.speed < 0.7 ||
    payload.speed > 1.5
  ) {
    return { ok: false, status: 400, error: "语速必须在 0.7 到 1.5 之间。" };
  }
  return { ok: true, value: { text, language, speed: payload.speed } };
}

export function validateVertexTtsPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, status: 400, error: "请求格式无效。" };
  }
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) return { ok: false, status: 400, error: "请输入需要朗读的文字。" };
  if ([...text].length > 500) {
    return {
      ok: false,
      status: 400,
      error: "标准示范文本过长，请控制在 500 个字符以内。",
    };
  }
  if (!VERTEX_LANGUAGE_IDS.has(payload.languageId)) {
    return {
      ok: false,
      status: 400,
      error: "当前语言暂不支持 Vertex Gemini TTS。",
    };
  }
  if (
    typeof payload.speed !== "number" ||
    !Number.isFinite(payload.speed) ||
    payload.speed < 0.7 ||
    payload.speed > 1.5
  ) {
    return { ok: false, status: 400, error: "语速必须在 0.7 到 1.5 之间。" };
  }
  const requestedVoice =
    typeof payload.voiceName === "string" ? payload.voiceName.trim() : "Kore";
  const voiceName = VERTEX_VOICE_NAMES.get(requestedVoice.toLowerCase());
  if (!voiceName) {
    return {
      ok: false,
      status: 400,
      error: "当前 Vertex Gemini TTS 音色不受支持。",
    };
  }
  return {
    ok: true,
    value: {
      text,
      languageId: payload.languageId,
      speed: payload.speed,
      voiceName,
    },
  };
}

export function createSlidingWindowRateLimiter({
  limit = RATE_LIMIT_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_MS,
} = {}) {
  let timestamps = [];
  return {
    take(now = Date.now()) {
      timestamps = timestamps.filter((timestamp) => now - timestamp < windowMs);
      if (timestamps.length >= limit) return false;
      timestamps.push(now);
      return true;
    },
  };
}

function tokenMatches(candidate, expected) {
  if (typeof candidate !== "string" || !candidate) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

function runPython({
  script,
  args = [],
  input = "",
  timeoutMs,
  captureStdout = false,
}) {
  const paths = hermesPaths();
  if (
    !paths ||
    !existsSync(paths.python) ||
    !existsSync(join(paths.agentRoot, "tools", "tts_tool.py"))
  ) {
    return Promise.reject(
      Object.assign(new Error("HERMES_NOT_FOUND"), {
        code: "HERMES_NOT_FOUND",
      }),
    );
  }

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(paths.python, ["-c", script, ...args], {
      cwd: paths.agentRoot,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let settled = false;
    let timedOut = false;
    let timer;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    child.stdout.on("data", (chunk) => {
      if (captureStdout && stdout.length < 64 * 1024)
        stdout += chunk.toString("utf8");
    });
    // Drain diagnostics so a full pipe cannot block Python, but never log them.
    child.stderr.on("data", () => {});
    child.once("error", (error) => finish(() => rejectRun(error)));
    child.once("close", (code) =>
      finish(() => {
        if (timedOut) {
          rejectRun(
            Object.assign(new Error("HERMES_TIMEOUT"), {
              code: "HERMES_TIMEOUT",
            }),
          );
          return;
        }
        resolveRun({ code, stdout });
      }),
    );
    child.stdin.end(input, "utf8");

    timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      child.kill();
    }, timeoutMs);
  });
}

async function inspectHermes() {
  const paths = hermesPaths();
  if (
    !paths ||
    !existsSync(paths.python) ||
    !existsSync(join(paths.agentRoot, "tools", "tts_tool.py"))
  ) {
    return {
      available: false,
      provider: "xai",
      message: "未找到本机爱马仕。请先安装并配置 Hermes Agent。",
    };
  }
  try {
    const result = await runPython({
      script: STATUS_SCRIPT,
      timeoutMs: STATUS_TIMEOUT_MS,
      captureStdout: true,
    });
    const lastLine = result.stdout.trim().split(/\r?\n/).at(-1);
    const status = lastLine ? JSON.parse(lastLine) : null;
    if (result.code === 0 && status?.available === true) {
      return {
        available: true,
        provider: "xai",
        voiceId:
          typeof status.voiceId === "string" ? status.voiceId : undefined,
        message: "已连接本机爱马仕 Grok TTS。",
      };
    }
    return {
      available: false,
      provider: "xai",
      voiceId: typeof status?.voiceId === "string" ? status.voiceId : undefined,
      message: "已找到爱马仕，但尚未检测到可用的 xAI 登录凭据。",
    };
  } catch {
    return {
      available: false,
      provider: "xai",
      message: "爱马仕状态检查失败，请确认本机 Hermes Agent 配置完整。",
    };
  }
}

export function normalizeHermesAlignment(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value;
  const nested =
    record.alignment ?? record.audioTimestamps ?? record.audio_timestamps;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return null;
  }

  const characters = Array.isArray(nested.characters)
    ? nested.characters
    : Array.isArray(nested.graphChars)
      ? nested.graphChars
      : nested.graph_chars;
  if (!Array.isArray(characters) || characters.length === 0) return null;

  let starts = nested.character_start_times_seconds;
  let ends = nested.character_end_times_seconds;
  const graphTimes = Array.isArray(nested.graphTimes)
    ? nested.graphTimes
    : nested.graph_times;
  if (
    (!Array.isArray(starts) || !Array.isArray(ends)) &&
    Array.isArray(graphTimes)
  ) {
    starts = graphTimes.map((timeRange) =>
      Array.isArray(timeRange) ? timeRange[0] : undefined,
    );
    ends = graphTimes.map((timeRange) =>
      Array.isArray(timeRange) ? timeRange[1] : undefined,
    );
  }
  if (
    !Array.isArray(starts) ||
    !Array.isArray(ends) ||
    characters.length !== starts.length ||
    characters.length !== ends.length ||
    characters.length > 2_000
  ) {
    return null;
  }

  let previousStart = -1;
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const start = starts[index];
    const end = ends[index];
    if (
      typeof character !== "string" ||
      typeof start !== "number" ||
      !Number.isFinite(start) ||
      typeof end !== "number" ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      start < previousStart
    ) {
      return null;
    }
    previousStart = start;
  }

  return {
    characters: [...characters],
    character_start_times_seconds: [...starts],
    character_end_times_seconds: [...ends],
  };
}

function parseHermesMetadata(stdout) {
  const lastLine = stdout.trim().split(/\r?\n/).at(-1);
  if (!lastLine) return {};
  try {
    const value = JSON.parse(lastLine);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const mimeType =
      typeof value.mimeType === "string" &&
      /^audio\/[a-z0-9.+-]+(?:\s*;[^\r\n]*)?$/iu.test(value.mimeType) &&
      value.mimeType.length <= 128
        ? value.mimeType
        : "audio/mpeg";
    const duration =
      typeof value.duration === "number" &&
      Number.isFinite(value.duration) &&
      value.duration > 0
        ? value.duration
        : undefined;
    return {
      mimeType,
      duration,
      alignment: normalizeHermesAlignment(value),
    };
  } catch {
    return {};
  }
}

async function generateHermesAudio({ text, language, speed }) {
  const tempPrefix = join(tmpdir(), "speakright-hermes-");
  const tempDirectory = await mkdtemp(tempPrefix);
  const outputPath = join(tempDirectory, "speech.mp3");
  try {
    const result = await runPython({
      script: TTS_SCRIPT,
      args: [outputPath, language, String(speed)],
      input: text,
      timeoutMs: PYTHON_TIMEOUT_MS,
      captureStdout: true,
    });
    if (result.code !== 0) {
      const error = new Error("HERMES_TTS_FAILED");
      error.exitCode = result.code;
      throw error;
    }
    const metadata = await stat(outputPath);
    if (metadata.size <= 0) throw new Error("HERMES_EMPTY_AUDIO");
    if (metadata.size > MAX_AUDIO_BYTES)
      throw new Error("HERMES_AUDIO_TOO_LARGE");
    const audio = await readFile(outputPath);
    const generationMetadata = parseHermesMetadata(result.stdout);
    return {
      audio,
      mimeType: generationMetadata.mimeType ?? "audio/mpeg",
      alignment: generationMetadata.alignment ?? null,
      duration: generationMetadata.duration,
    };
  } finally {
    const resolvedTemp = resolve(tempDirectory);
    const resolvedPrefix = resolve(tmpdir(), "speakright-hermes-");
    if (resolvedTemp.startsWith(resolvedPrefix)) {
      await rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function gcloudInvocation(args) {
  if (process.platform !== "win32") {
    return { command: "gcloud", args };
  }
  if (existsSync(GCLOUD_WINDOWS_SCRIPT)) {
    return {
      command: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        GCLOUD_WINDOWS_SCRIPT,
        ...args,
      ],
    };
  }
  return { command: "gcloud.cmd", args };
}

function runGcloudValue(args, { spawnImpl = spawn } = {}) {
  const invocation = gcloudInvocation(args);
  return new Promise((resolveValue, rejectValue) => {
    const child = spawnImpl(invocation.command, invocation.args, {
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const chunks = [];
    let outputLength = 0;
    let settled = false;
    let timedOut = false;
    let outputTooLarge = false;
    let timer;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    child.stdout.on("data", (chunk) => {
      if (outputLength + chunk.length > 64 * 1024) {
        outputTooLarge = true;
        child.kill();
        return;
      }
      outputLength += chunk.length;
      chunks.push(chunk);
    });
    // Authentication diagnostics may contain local details. Drain but never log them.
    child.stderr.on("data", () => {});
    child.once("error", () =>
      finish(() =>
        rejectValue(
          Object.assign(new Error("GCLOUD_UNAVAILABLE"), {
            code: "GCLOUD_UNAVAILABLE",
          }),
        ),
      ),
    );
    child.once("close", (code) =>
      finish(() => {
        if (timedOut) {
          rejectValue(
            Object.assign(new Error("GCLOUD_TIMEOUT"), {
              code: "GCLOUD_TIMEOUT",
            }),
          );
          return;
        }
        if (outputTooLarge) {
          rejectValue(
            Object.assign(new Error("GCLOUD_OUTPUT_TOO_LARGE"), {
              code: "GCLOUD_OUTPUT_TOO_LARGE",
            }),
          );
          return;
        }
        if (code !== 0) {
          rejectValue(
            Object.assign(new Error("GCLOUD_COMMAND_FAILED"), {
              code: "GCLOUD_COMMAND_FAILED",
            }),
          );
          return;
        }
        resolveValue(Buffer.concat(chunks).toString("utf8").trim());
      }),
    );
    timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      child.kill();
    }, STATUS_TIMEOUT_MS);
  });
}

export async function resolveVertexProjectId({
  env = process.env,
  readGcloudValue = runGcloudValue,
} = {}) {
  const configured = env.GOOGLE_CLOUD_PROJECT?.trim();
  let projectId = configured;
  if (!projectId) {
    try {
      projectId = await readGcloudValue(["config", "get-value", "project"]);
    } catch {
      throw Object.assign(new Error("VERTEX_PROJECT_UNCONFIGURED"), {
        code: "VERTEX_PROJECT_UNCONFIGURED",
      });
    }
  }
  if (!projectId || projectId === "(unset)") {
    throw Object.assign(new Error("VERTEX_PROJECT_UNCONFIGURED"), {
      code: "VERTEX_PROJECT_UNCONFIGURED",
    });
  }
  return projectId;
}

export async function readVertexAccessToken({
  env = process.env,
  readGcloudValue = runGcloudValue,
} = {}) {
  const provided = env.GOOGLE_OAUTH_ACCESS_TOKEN?.trim();
  let accessToken = provided;
  if (!accessToken) {
    try {
      accessToken = await readGcloudValue([
        "auth",
        "application-default",
        "print-access-token",
      ]);
    } catch {
      throw Object.assign(new Error("VERTEX_ADC_UNAVAILABLE"), {
        code: "VERTEX_ADC_UNAVAILABLE",
      });
    }
  }
  if (!accessToken) {
    throw Object.assign(new Error("VERTEX_ADC_UNAVAILABLE"), {
      code: "VERTEX_ADC_UNAVAILABLE",
    });
  }
  return accessToken;
}

export async function inspectVertexGemini({
  resolveProjectId = resolveVertexProjectId,
  resolveAccessToken = readVertexAccessToken,
} = {}) {
  try {
    await resolveProjectId();
  } catch {
    const detail =
      "未检测到 Vertex AI 项目配置，请先在本机 gcloud 中选择项目。";
    return {
      available: false,
      provider: "vertex-gemini",
      model: VERTEX_GEMINI_TTS_MODEL,
      modelId: VERTEX_GEMINI_TTS_MODEL,
      configured: false,
      projectConfigured: false,
      authReady: false,
      detail,
      message: detail,
    };
  }
  try {
    await resolveAccessToken();
  } catch {
    const detail =
      "Vertex AI 项目已配置，但本机 ADC 授权尚不可用，请先完成应用默认登录。";
    return {
      available: false,
      provider: "vertex-gemini",
      model: VERTEX_GEMINI_TTS_MODEL,
      modelId: VERTEX_GEMINI_TTS_MODEL,
      configured: false,
      projectConfigured: true,
      authReady: false,
      detail,
      message: detail,
    };
  }
  const detail = "本机 Vertex AI 项目与 ADC 授权已就绪。";
  return {
    available: true,
    provider: "vertex-gemini",
    model: VERTEX_GEMINI_TTS_MODEL,
    modelId: VERTEX_GEMINI_TTS_MODEL,
    configured: true,
    projectConfigured: true,
    authReady: true,
    detail,
    message: detail,
  };
}

function describeVertexSpeed(speed) {
  if (speed <= 0.8) return "a slow, deliberate teaching pace";
  if (speed < 0.95) return "a slightly slower than natural pace";
  if (speed <= 1.05) return "a natural, deliberate pace";
  if (speed <= 1.25) return "a moderately brisk but clear pace";
  return "a fast but still clearly articulated pace";
}

function resolveVertexProxyDispatcher() {
  const proxyUrl =
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.ALL_PROXY?.trim();
  if (!proxyUrl) return undefined;
  vertexProxyDispatcher ??= new ProxyAgent(proxyUrl);
  return vertexProxyDispatcher;
}

export function buildVertexTtsRequest({ text, languageId, speed, voiceName }) {
  const prompt = [
    `Speak the content inside <speak> in ${languageId}.`,
    `Use ${describeVertexSpeed(speed)} (approximately ${speed.toFixed(1)}x).`,
    "Use a clear, neutral pronunciation suitable for a language learner.",
    "Read only the content inside <speak> and </speak>.",
    "Do not speak the tags, instructions, labels, or any extra sound.",
    `<speak>${text}</speak>`,
  ].join(" ");
  return {
    contents: {
      role: "user",
      parts: { text: prompt },
    },
    generation_config: {
      speech_config: {
        language_code: languageId.toLowerCase(),
        voice_config: {
          prebuilt_voice_config: {
            voice_name: voiceName.toLowerCase(),
          },
        },
      },
    },
  };
}

async function readResponseBytes(
  response,
  maxBytes = MAX_VERTEX_RESPONSE_BYTES,
) {
  const contentLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw Object.assign(new Error("VERTEX_RESPONSE_TOO_LARGE"), {
      code: "VERTEX_RESPONSE_TOO_LARGE",
    });
  }
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) {
      throw Object.assign(new Error("VERTEX_RESPONSE_TOO_LARGE"), {
        code: "VERTEX_RESPONSE_TOO_LARGE",
      });
    }
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel().catch(() => {});
      throw Object.assign(new Error("VERTEX_RESPONSE_TOO_LARGE"), {
        code: "VERTEX_RESPONSE_TOO_LARGE",
      });
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, length);
}

function decodeStrictBase64(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(value)
  ) {
    throw Object.assign(new Error("VERTEX_INVALID_AUDIO"), {
      code: "VERTEX_INVALID_AUDIO",
    });
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw Object.assign(new Error("VERTEX_INVALID_AUDIO"), {
      code: "VERTEX_INVALID_AUDIO",
    });
  }
  return bytes;
}

export function extractVertexPcm(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find(
    (part) => part?.inlineData?.data || part?.inline_data?.data,
  );
  const inline = audioPart?.inlineData ?? audioPart?.inline_data;
  if (!inline?.data) {
    throw Object.assign(new Error("VERTEX_NO_AUDIO"), {
      code: "VERTEX_NO_AUDIO",
    });
  }
  const mimeType = String(
    inline.mimeType ?? inline.mime_type ?? "audio/L16;rate=24000",
  );
  if (!/^audio\/L16(?:;|$)/iu.test(mimeType)) {
    throw Object.assign(new Error("VERTEX_UNSUPPORTED_AUDIO"), {
      code: "VERTEX_UNSUPPORTED_AUDIO",
    });
  }
  const rateMatch = /(?:^|;)\s*rate=(\d+)(?:;|$)/iu.exec(mimeType);
  if (rateMatch && Number(rateMatch[1]) !== VERTEX_GEMINI_TTS_SAMPLE_RATE) {
    throw Object.assign(new Error("VERTEX_UNSUPPORTED_AUDIO"), {
      code: "VERTEX_UNSUPPORTED_AUDIO",
    });
  }
  const pcm = decodeStrictBase64(inline.data);
  if (pcm.length <= 0 || pcm.length % 2 !== 0) {
    throw Object.assign(new Error("VERTEX_INVALID_AUDIO"), {
      code: "VERTEX_INVALID_AUDIO",
    });
  }
  if (pcm.length > MAX_AUDIO_BYTES) {
    throw Object.assign(new Error("VERTEX_AUDIO_TOO_LARGE"), {
      code: "VERTEX_AUDIO_TOO_LARGE",
    });
  }
  return pcm;
}

export function pcm16leToWav(
  pcm,
  { sampleRate = VERTEX_GEMINI_TTS_SAMPLE_RATE, channels = 1 } = {},
) {
  const pcmBytes = Buffer.from(pcm);
  if (pcmBytes.length <= 0 || pcmBytes.length % (channels * 2) !== 0) {
    throw Object.assign(new Error("VERTEX_INVALID_AUDIO"), {
      code: "VERTEX_INVALID_AUDIO",
    });
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcmBytes.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcmBytes.length, 40);
  return Buffer.concat([header, pcmBytes]);
}

export async function generateVertexAudio(
  { text, languageId, speed, voiceName },
  {
    resolveProjectId = resolveVertexProjectId,
    resolveAccessToken = readVertexAccessToken,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  const projectId = await resolveProjectId();
  const accessToken = await resolveAccessToken();
  const endpoint =
    `https://aiplatform.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}` +
    `/locations/${VERTEX_GEMINI_TTS_LOCATION}/publishers/google/models/` +
    `${VERTEX_GEMINI_TTS_MODEL}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERTEX_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-goog-user-project": projectId,
        },
        body: JSON.stringify(
          buildVertexTtsRequest({ text, languageId, speed, voiceName }),
        ),
        dispatcher: resolveVertexProxyDispatcher(),
        signal: controller.signal,
      });
    } catch {
      throw Object.assign(new Error("VERTEX_NETWORK_ERROR"), {
        code: controller.signal.aborted
          ? "VERTEX_TTS_TIMEOUT"
          : "VERTEX_NETWORK_ERROR",
      });
    }
    const responseBytes = await readResponseBytes(response);
    let payload;
    try {
      payload = JSON.parse(responseBytes.toString("utf8"));
    } catch {
      throw Object.assign(new Error("VERTEX_INVALID_RESPONSE"), {
        code: "VERTEX_INVALID_RESPONSE",
      });
    }
    if (!response.ok) {
      throw Object.assign(new Error("VERTEX_TTS_FAILED"), {
        code: "VERTEX_TTS_FAILED",
        status: response.status,
      });
    }
    return pcm16leToWav(extractVertexPcm(payload));
  } finally {
    clearTimeout(timer);
  }
}

function corsHeaders(origin, request) {
  const headers = {
    "Access-Control-Allow-Headers":
      "Accept, Content-Type, X-SpeakRight-Bridge-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
  if (request.headers["access-control-request-private-network"] === "true") {
    headers["Access-Control-Allow-Private-Network"] = "true";
  }
  return headers;
}

function sendJson(response, status, body, headers = {}) {
  const data = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    ...headers,
    "Content-Length": String(data.length),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(data);
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let length = 0;
    let rejected = false;
    request.on("data", (chunk) => {
      if (rejected) return;
      length += chunk.length;
      if (length > MAX_REQUEST_BYTES) {
        rejected = true;
        rejectBody(
          Object.assign(new Error("REQUEST_TOO_LARGE"), { status: 413 }),
        );
        return;
      }
      chunks.push(chunk);
    });
    request.once("end", () => {
      if (rejected) return;
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        rejectBody(Object.assign(new Error("INVALID_JSON"), { status: 400 }));
      }
    });
    request.once("error", rejectBody);
  });
}

function ttsFailure(error) {
  if (error?.code === "HERMES_NOT_FOUND") {
    return {
      status: 503,
      message: "未找到本机爱马仕，请先安装并配置 Hermes Agent。",
    };
  }
  if (error?.code === "HERMES_TIMEOUT") {
    return {
      status: 504,
      message: "爱马仕 Grok TTS 响应超时，请检查网络后重试。",
    };
  }
  if (error?.message === "HERMES_AUDIO_TOO_LARGE") {
    return { status: 502, message: "爱马仕返回的音频超过 8MB 安全上限。" };
  }
  if (error?.exitCode === 20 || error?.exitCode === 21) {
    return {
      status: 401,
      message: "爱马仕的 xAI 登录已失效，请先在爱马仕中重新登录。",
    };
  }
  if (error?.exitCode === 22) {
    return {
      status: 429,
      message: "xAI TTS 请求过于频繁或额度不足，请稍后重试。",
    };
  }
  return {
    status: 502,
    message: "爱马仕 Grok TTS 生成失败，请检查爱马仕配置后重试。",
  };
}

function vertexTtsFailure(error) {
  if (error?.code === "VERTEX_PROJECT_UNCONFIGURED") {
    return {
      status: 503,
      message: "尚未配置 Vertex AI 项目，请先在本机 gcloud 中选择项目。",
    };
  }
  if (error?.code === "VERTEX_ADC_UNAVAILABLE") {
    return {
      status: 401,
      message: "Vertex AI 的本机 ADC 授权不可用，请先完成应用默认登录。",
    };
  }
  if (error?.code === "VERTEX_TTS_TIMEOUT") {
    return {
      status: 504,
      message: "Vertex Gemini TTS 响应超时，请检查网络后重试。",
    };
  }
  if (
    error?.code === "VERTEX_AUDIO_TOO_LARGE" ||
    error?.code === "VERTEX_RESPONSE_TOO_LARGE"
  ) {
    return { status: 502, message: "Vertex 返回的音频超过 8MB 安全上限。" };
  }
  if (error?.status === 401 || error?.status === 403) {
    return {
      status: 401,
      message: "Vertex AI 授权已失效或权限不足，请重新完成本机 ADC 登录。",
    };
  }
  if (error?.status === 429) {
    return {
      status: 429,
      message: "Vertex Gemini TTS 请求过于频繁或额度不足，请稍后重试。",
    };
  }
  if (error?.status === 400 || error?.status === 404) {
    return {
      status: 502,
      message:
        "Vertex Gemini 3.1 Flash TTS 当前不可用，请检查项目区域与模型权限。",
    };
  }
  return {
    status: 502,
    message: "Vertex Gemini TTS 生成失败，请检查本机 Vertex AI 配置后重试。",
  };
}

async function probeCompatibleBridge(origin) {
  return await new Promise((resolveProbe) => {
    const request = httpRequest(
      {
        hostname: HERMES_BRIDGE_HOST,
        port: HERMES_BRIDGE_PORT,
        path: "/vertex/health",
        method: "GET",
        headers: { Accept: "application/json", Origin: origin },
        timeout: 2_000,
      },
      (response) => {
        const chunks = [];
        let length = 0;
        response.on("data", (chunk) => {
          length += chunk.length;
          if (length <= 64 * 1024) chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            resolveProbe(
              response.statusCode === 200 &&
                body?.protocolVersion === HERMES_BRIDGE_PROTOCOL_VERSION &&
                body?.model === VERTEX_GEMINI_TTS_MODEL &&
                typeof body?.sessionToken === "string" &&
                body.sessionToken.length >= 32,
            );
          } catch {
            resolveProbe(false);
          }
        });
      },
    );
    request.once("timeout", () => {
      request.destroy();
      resolveProbe(false);
    });
    request.once("error", () => resolveProbe(false));
    request.end();
  });
}

export async function startHermesXaiBridge({
  additionalOrigins = [],
  hermesAudioGenerator = generateHermesAudio,
  vertexInspector = inspectVertexGemini,
  vertexAudioGenerator = generateVertexAudio,
} = {}) {
  const sessionToken = randomBytes(32).toString("base64url");
  const limiter = createSlidingWindowRateLimiter();
  const statusLimiter = createSlidingWindowRateLimiter({ limit: 60 });
  let activeTts = 0;
  let cachedStatus = null;
  let cachedStatusAt = 0;
  let pendingStatus = null;
  let cachedVertexStatus = null;
  let cachedVertexStatusAt = 0;
  let pendingVertexStatus = null;

  const getStatus = async () => {
    const now = Date.now();
    if (cachedStatus && now - cachedStatusAt < 5_000) return cachedStatus;
    if (!pendingStatus) {
      pendingStatus = inspectHermes()
        .then((status) => {
          cachedStatus = status;
          cachedStatusAt = Date.now();
          return status;
        })
        .finally(() => {
          pendingStatus = null;
        });
    }
    return await pendingStatus;
  };

  const getVertexStatus = async () => {
    const now = Date.now();
    if (cachedVertexStatus && now - cachedVertexStatusAt < 5_000) {
      return cachedVertexStatus;
    }
    if (!pendingVertexStatus) {
      pendingVertexStatus = vertexInspector()
        .catch(() => {
          const detail = "Vertex AI 状态检查失败，请确认本机 gcloud 配置完整。";
          return {
            available: false,
            provider: "vertex-gemini",
            model: VERTEX_GEMINI_TTS_MODEL,
            modelId: VERTEX_GEMINI_TTS_MODEL,
            configured: false,
            projectConfigured: false,
            authReady: false,
            detail,
            message: detail,
          };
        })
        .then((status) => {
          cachedVertexStatus = status;
          cachedVertexStatusAt = Date.now();
          return status;
        })
        .finally(() => {
          pendingVertexStatus = null;
        });
    }
    return await pendingVertexStatus;
  };

  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (
      !isAllowedBridgeHost(request.headers.host) ||
      !isAllowedSpeakRightOrigin(origin, additionalOrigins)
    ) {
      sendJson(response, 403, { error: "拒绝非 SpeakRight 本机页面的访问。" });
      return;
    }
    const headers = corsHeaders(origin, request);
    const pathname = (request.url || "").split("?")[0];

    if (
      request.method === "OPTIONS" &&
      ["/health", "/tts", "/vertex/health", "/vertex/tts"].includes(pathname)
    ) {
      response.writeHead(204, headers);
      response.end();
      return;
    }

    if (request.method === "GET" && pathname === "/health") {
      if (!statusLimiter.take()) {
        sendJson(
          response,
          429,
          {
            protocolVersion: HERMES_BRIDGE_PROTOCOL_VERSION,
            sessionToken,
            available: false,
            provider: "xai",
            message: "本机桥接状态检查过于频繁，请稍后重试。",
          },
          headers,
        );
        return;
      }
      const status = await getStatus();
      sendJson(
        response,
        200,
        {
          protocolVersion: HERMES_BRIDGE_PROTOCOL_VERSION,
          sessionToken,
          ...status,
        },
        headers,
      );
      return;
    }

    if (request.method === "GET" && pathname === "/vertex/health") {
      if (!statusLimiter.take()) {
        sendJson(
          response,
          429,
          {
            protocolVersion: HERMES_BRIDGE_PROTOCOL_VERSION,
            sessionToken,
            available: false,
            provider: "vertex-gemini",
            model: VERTEX_GEMINI_TTS_MODEL,
            modelId: VERTEX_GEMINI_TTS_MODEL,
            configured: false,
            projectConfigured: false,
            authReady: false,
            detail: "本机桥接状态检查过于频繁，请稍后重试。",
            message: "本机桥接状态检查过于频繁，请稍后重试。",
          },
          headers,
        );
        return;
      }
      const status = await getVertexStatus();
      sendJson(
        response,
        200,
        {
          protocolVersion: HERMES_BRIDGE_PROTOCOL_VERSION,
          sessionToken,
          ...status,
        },
        headers,
      );
      return;
    }

    const isHermesTts = request.method === "POST" && pathname === "/tts";
    const isVertexTts = request.method === "POST" && pathname === "/vertex/tts";
    if (!isHermesTts && !isVertexTts) {
      sendJson(response, 404, { error: "接口不存在。" }, headers);
      return;
    }
    const contentType = request.headers["content-type"] || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      sendJson(
        response,
        415,
        { error: "本机 TTS 桥接只接受 JSON 请求。" },
        headers,
      );
      return;
    }
    if (
      !tokenMatches(request.headers["x-speakright-bridge-token"], sessionToken)
    ) {
      sendJson(
        response,
        401,
        { error: "本机桥接会话已失效，请刷新 SpeakRight 页面后重试。" },
        headers,
      );
      return;
    }
    if (!limiter.take()) {
      sendJson(
        response,
        429,
        { error: "本机 TTS 请求过于频繁，请稍后重试。" },
        headers,
      );
      return;
    }
    if (activeTts >= MAX_CONCURRENT_TTS) {
      sendJson(
        response,
        429,
        { error: "已有两个 TTS 任务正在生成，请稍后重试。" },
        headers,
      );
      return;
    }

    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      if (!response.destroyed) {
        sendJson(
          response,
          error?.status ?? 400,
          { error: "请求内容无效。" },
          headers,
        );
      }
      return;
    }
    const validation = isVertexTts
      ? validateVertexTtsPayload(payload)
      : validateTtsPayload(payload);
    if (!validation.ok) {
      sendJson(
        response,
        validation.status,
        { error: validation.error },
        headers,
      );
      return;
    }

    activeTts += 1;
    try {
      if (isVertexTts) {
        const audio = await vertexAudioGenerator(validation.value);
        response.writeHead(200, {
          ...headers,
          "Content-Length": String(audio.length),
          "Content-Type": "audio/wav",
        });
        response.end(audio);
      } else {
        const generated = await hermesAudioGenerator(validation.value);
        const audio = Buffer.isBuffer(generated) ? generated : generated.audio;
        if (!Buffer.isBuffer(audio) || audio.length === 0) {
          throw new Error("HERMES_EMPTY_AUDIO");
        }
        if (audio.length > MAX_AUDIO_BYTES) {
          throw new Error("HERMES_AUDIO_TOO_LARGE");
        }
        const mimeType =
          !Buffer.isBuffer(generated) &&
          typeof generated.mimeType === "string" &&
          /^audio\/[a-z0-9.+-]+(?:\s*;[^\r\n]*)?$/iu.test(generated.mimeType)
            ? generated.mimeType
            : "audio/mpeg";
        const alignment = Buffer.isBuffer(generated)
          ? null
          : normalizeHermesAlignment({ alignment: generated.alignment });
        const duration =
          !Buffer.isBuffer(generated) &&
          typeof generated.duration === "number" &&
          Number.isFinite(generated.duration) &&
          generated.duration > 0
            ? generated.duration
            : undefined;
        sendJson(
          response,
          200,
          {
            audioBase64: audio.toString("base64"),
            mimeType,
            alignment,
            ...(duration === undefined ? {} : { duration }),
          },
          headers,
        );
      }
    } catch (error) {
      const failure = isVertexTts ? vertexTtsFailure(error) : ttsFailure(error);
      sendJson(response, failure.status, { error: failure.message }, headers);
    } finally {
      activeTts -= 1;
    }
  });

  return await new Promise((resolveStart, rejectStart) => {
    server.once("error", async (error) => {
      if (error?.code !== "EADDRINUSE") {
        rejectStart(error);
        return;
      }
      const probeOrigin = additionalOrigins[0] || "http://127.0.0.1:4173";
      const compatible = await probeCompatibleBridge(probeOrigin);
      resolveStart({
        owned: false,
        compatible,
        close: async () => {},
      });
    });
    server.listen(HERMES_BRIDGE_PORT, HERMES_BRIDGE_HOST, () => {
      // Warm the read-only status check while the Browser Edition page loads.
      // No TTS request is made here.
      void getStatus();
      void getVertexStatus();
      resolveStart({
        owned: true,
        compatible: true,
        close: () => new Promise((resolveClose) => server.close(resolveClose)),
      });
    });
  });
}
