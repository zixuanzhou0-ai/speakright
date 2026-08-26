import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildVertexTtsRequest,
  createSlidingWindowRateLimiter,
  extractVertexPcm,
  generateVertexAudio,
  inspectVertexGemini,
  isAllowedBridgeHost,
  isAllowedSpeakRightOrigin,
  normalizeHermesAlignment,
  pcm16leToWav,
  readStableHermesAudio,
  readVertexAccessToken,
  resolveVertexProjectId,
  startHermesXaiBridge,
  VERTEX_GEMINI_TTS_MODEL,
  validateTtsPayload,
  validateVertexTtsPayload,
} from "./hermes-xai-bridge.mjs";

test("reads the checked Hermes audio through one stable file handle", async () => {
  const directory = await mkdtemp(join(tmpdir(), "speakright-hermes-read-"));
  const audioPath = join(directory, "speech.mp3");
  const expected = Buffer.from([0x49, 0x44, 0x33, 0x04]);
  try {
    await writeFile(audioPath, expected);
    assert.deepEqual(await readStableHermesAudio(audioPath), expected);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a Hermes audio file that changes while its handle is read", async () => {
  const stable = {
    isFile: () => true,
    dev: 1n,
    ino: 2n,
    mode: 3n,
    nlink: 1n,
    size: 3n,
    mtimeNs: 4n,
    ctimeNs: 5n,
  };
  let statCalls = 0;
  let closed = false;
  const handle = {
    stat: async () => {
      statCalls += 1;
      return statCalls === 1 ? stable : { ...stable, mtimeNs: 6n };
    },
    read: async (buffer, offset, length) => {
      const source = Buffer.from("ID3");
      const bytesRead = Math.min(source.length, length);
      source.copy(buffer, offset, 0, bytesRead);
      return { bytesRead };
    },
    close: async () => {
      closed = true;
    },
  };

  await assert.rejects(
    readStableHermesAudio("ignored", {
      openImpl: async () => handle,
    }),
    /HERMES_AUDIO_CHANGED/u,
  );
  assert.equal(closed, true);
});

test("normalizes xAI graph timestamps without inventing missing alignment", () => {
  assert.deepEqual(
    normalizeHermesAlignment({
      audio_timestamps: {
        graph_chars: ["H", "i"],
        graph_times: [
          [0, 0.08],
          [0.08, 0.2],
        ],
      },
    }),
    {
      characters: ["H", "i"],
      character_start_times_seconds: [0, 0.08],
      character_end_times_seconds: [0.08, 0.2],
    },
  );
  assert.equal(
    normalizeHermesAlignment({
      audio_timestamps: {
        graph_chars: ["H", "i"],
        graph_times: [[0, 0.08]],
      },
    }),
    null,
  );
  assert.equal(normalizeHermesAlignment({ alignment: null }), null);
});

test("accepts only exact SpeakRight loopback origins and bridge hosts", () => {
  assert.equal(isAllowedSpeakRightOrigin("http://127.0.0.1:3000"), true);
  assert.equal(isAllowedSpeakRightOrigin("http://localhost:4173"), true);
  assert.equal(
    isAllowedSpeakRightOrigin("http://localhost.evil.test:4173"),
    false,
  );
  assert.equal(isAllowedSpeakRightOrigin("null"), false);
  assert.equal(isAllowedBridgeHost("127.0.0.1:17831"), true);
  assert.equal(isAllowedBridgeHost("127.0.0.1:17832"), false);
});

test("validates and maps the supported TTS request", () => {
  assert.deepEqual(
    validateTtsPayload({ text: " Hola ", languageId: "es-ES", speed: 0.9 }),
    {
      ok: true,
      value: { text: "Hola", language: "es-ES", speed: 0.9 },
    },
  );
  assert.equal(
    validateTtsPayload({ text: "x".repeat(501), languageId: "en-US", speed: 1 })
      .ok,
    false,
  );
  assert.equal(
    validateTtsPayload({ text: "hello", languageId: "ja-JP", speed: 1 }).ok,
    false,
  );
  assert.equal(
    validateTtsPayload({ text: "hello", languageId: "en-US", speed: 1.6 }).ok,
    false,
  );
});

test("validates Vertex languages, speeds, and the official voice allowlist", () => {
  assert.deepEqual(
    validateVertexTtsPayload({
      text: " Bonjour ",
      languageId: "fr-FR",
      speed: 0.8,
      voiceName: "aoede",
    }),
    {
      ok: true,
      value: {
        text: "Bonjour",
        languageId: "fr-FR",
        speed: 0.8,
        voiceName: "Aoede",
      },
    },
  );
  assert.equal(
    validateVertexTtsPayload({
      text: "hello",
      languageId: "en-US",
      speed: 1,
      voiceName: "unknown",
    }).ok,
    false,
  );
  assert.equal(
    validateVertexTtsPayload({
      text: "hello",
      languageId: "ja-JP",
      speed: 1,
      voiceName: "Kore",
    }).ok,
    false,
  );
});

test("builds the existing Vertex Gemini 3.1 TTS request contract", () => {
  const request = buildVertexTtsRequest({
    text: "дом",
    languageId: "ru-RU",
    speed: 0.9,
    voiceName: "Charon",
  });
  assert.equal(request.contents.role, "user");
  assert.match(request.contents.parts.text, /<speak>дом<\/speak>/u);
  assert.match(request.contents.parts.text, /0\.9x/u);
  assert.equal(request.generation_config.speech_config.language_code, "ru-ru");
  assert.equal(
    request.generation_config.speech_config.voice_config.prebuilt_voice_config
      .voice_name,
    "charon",
  );
  assert.equal(JSON.stringify(request).includes("responseModalities"), false);
});

test("checks local Vertex configuration without exposing local identifiers", async () => {
  const projectCalls = [];
  const tokenCalls = [];
  assert.equal(
    await resolveVertexProjectId({
      env: {},
      readGcloudValue: async (args) => {
        projectCalls.push(args);
        return "private-project-id";
      },
    }),
    "private-project-id",
  );
  assert.equal(
    await readVertexAccessToken({
      env: {},
      readGcloudValue: async (args) => {
        tokenCalls.push(args);
        return "private-access-token";
      },
    }),
    "private-access-token",
  );
  assert.deepEqual(projectCalls, [["config", "get-value", "project"]]);
  assert.deepEqual(tokenCalls, [
    ["auth", "application-default", "print-access-token"],
  ]);

  const healthy = await inspectVertexGemini({
    resolveProjectId: async () => "private-project-id",
    resolveAccessToken: async () => "private-access-token",
  });
  assert.equal(healthy.available, true);
  assert.equal(healthy.projectConfigured, true);
  assert.equal(healthy.authReady, true);
  const serialized = JSON.stringify(healthy);
  assert.equal(serialized.includes("private-project-id"), false);
  assert.equal(serialized.includes("private-access-token"), false);

  const unauthenticated = await inspectVertexGemini({
    resolveProjectId: async () => "private-project-id",
    resolveAccessToken: async () => {
      throw new Error("secret-account@example.test private-access-token");
    },
  });
  assert.equal(unauthenticated.projectConfigured, true);
  assert.equal(unauthenticated.authReady, false);
  assert.equal(
    JSON.stringify(unauthenticated).includes("secret-account@example.test"),
    false,
  );
});

test("parses raw Vertex PCM and wraps it as 24 kHz mono WAV", () => {
  const pcm = Buffer.from([0x00, 0x00, 0xff, 0x7f]);
  assert.deepEqual(
    extractVertexPcm({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: pcm.toString("base64"),
                  mimeType: "audio/L16;rate=24000",
                },
              },
            ],
          },
        },
      ],
    }),
    pcm,
  );
  const wav = pcm16leToWav(pcm);
  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(wav.subarray(8, 12).toString("ascii"), "WAVE");
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24_000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.deepEqual(wav.subarray(44), pcm);
});

test("calls only the global Vertex endpoint when TTS is explicitly requested", async () => {
  const pcm = Buffer.from([0x00, 0x00, 0xff, 0x7f]);
  let capturedUrl = "";
  let capturedOptions;
  const wav = await generateVertexAudio(
    {
      text: "hello",
      languageId: "en-US",
      speed: 1,
      voiceName: "Kore",
    },
    {
      resolveProjectId: async () => "private-project-id",
      resolveAccessToken: async () => "private-access-token",
      fetchImpl: async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inline_data: {
                        data: pcm.toString("base64"),
                        mime_type: "audio/L16;rate=24000",
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );
  assert.match(
    capturedUrl,
    new RegExp(
      `/locations/global/publishers/google/models/${VERTEX_GEMINI_TTS_MODEL}:generateContent$`,
      "u",
    ),
  );
  assert.equal(
    capturedOptions.headers.Authorization,
    "Bearer private-access-token",
  );
  assert.equal(
    capturedOptions.headers["x-goog-user-project"],
    "private-project-id",
  );
  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");
});

test("limits requests inside one sliding window", () => {
  const limiter = createSlidingWindowRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.take(1000), true);
  assert.equal(limiter.take(1100), true);
  assert.equal(limiter.take(1200), false);
  assert.equal(limiter.take(2101), true);
});

test("serves token-protected loopback endpoints with mocked audio", async (context) => {
  const origin = "http://127.0.0.1:3000";
  let hermesGenerationCalls = 0;
  let vertexGenerationCalls = 0;
  const bridge = await startHermesXaiBridge({
    additionalOrigins: [origin],
    hermesAudioGenerator: async () => {
      hermesGenerationCalls += 1;
      return {
        audio: Buffer.from([0x49, 0x44, 0x33]),
        mimeType: "audio/mpeg",
        duration: 0.2,
        alignment: {
          characters: ["H", "i"],
          character_start_times_seconds: [0, 0.08],
          character_end_times_seconds: [0.08, 0.2],
        },
      };
    },
    vertexInspector: async () => ({
      available: true,
      provider: "vertex-gemini",
      model: VERTEX_GEMINI_TTS_MODEL,
      modelId: VERTEX_GEMINI_TTS_MODEL,
      configured: true,
      projectConfigured: true,
      authReady: true,
      detail: "本机 Vertex AI 项目与 ADC 授权已就绪。",
      message: "本机 Vertex AI 项目与 ADC 授权已就绪。",
    }),
    vertexAudioGenerator: async () => {
      vertexGenerationCalls += 1;
      return pcm16leToWav(Buffer.from([0x00, 0x00]));
    },
  });
  if (!bridge.owned) {
    context.skip("port 17831 is already owned by another process");
    return;
  }
  try {
    const health = await fetch("http://127.0.0.1:17831/health", {
      headers: { Origin: origin },
    });
    assert.equal(health.status, 200);
    const status = await health.json();
    assert.equal(status.protocolVersion, 1);
    assert.equal(typeof status.sessionToken, "string");
    assert.ok(status.sessionToken.length >= 32);

    const vertexHealth = await fetch("http://127.0.0.1:17831/vertex/health", {
      headers: { Origin: origin },
    });
    assert.equal(vertexHealth.status, 200);
    const vertexStatus = await vertexHealth.json();
    assert.equal(vertexStatus.available, true);
    assert.equal(vertexStatus.model, VERTEX_GEMINI_TTS_MODEL);
    assert.equal(vertexStatus.sessionToken, status.sessionToken);
    assert.equal("projectId" in vertexStatus, false);
    assert.equal("account" in vertexStatus, false);
    assert.equal("accessToken" in vertexStatus, false);

    const preflight = await fetch("http://127.0.0.1:17831/tts", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Private-Network": "true",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-private-network"),
      "true",
    );

    const unauthenticated = await fetch("http://127.0.0.1:17831/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        text: "This must not run.",
        languageId: "en-US",
        speed: 1,
      }),
    });
    assert.equal(unauthenticated.status, 401);

    const hermesAudio = await fetch("http://127.0.0.1:17831/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        "X-SpeakRight-Bridge-Token": status.sessionToken,
      },
      body: JSON.stringify({
        text: "Hi",
        languageId: "en-US",
        speed: 1,
      }),
    });
    assert.equal(hermesAudio.status, 200);
    assert.match(
      hermesAudio.headers.get("content-type") ?? "",
      /^application\/json/u,
    );
    const hermesPayload = await hermesAudio.json();
    assert.equal(hermesPayload.audioBase64, "SUQz");
    assert.equal(hermesPayload.mimeType, "audio/mpeg");
    assert.equal(hermesPayload.duration, 0.2);
    assert.deepEqual(hermesPayload.alignment, {
      characters: ["H", "i"],
      character_start_times_seconds: [0, 0.08],
      character_end_times_seconds: [0.08, 0.2],
    });
    assert.equal(hermesGenerationCalls, 1);

    const vertexAudio = await fetch("http://127.0.0.1:17831/vertex/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        "X-SpeakRight-Bridge-Token": status.sessionToken,
      },
      body: JSON.stringify({
        text: "This is mocked audio.",
        languageId: "en-US",
        speed: 1,
        voiceName: "Kore",
      }),
    });
    assert.equal(vertexAudio.status, 200);
    assert.equal(vertexAudio.headers.get("content-type"), "audio/wav");
    assert.equal(vertexGenerationCalls, 1);
  } finally {
    await bridge.close();
  }
});
