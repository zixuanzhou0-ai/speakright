import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVertexTtsRequest,
  createSlidingWindowRateLimiter,
  extractVertexPcm,
  generateVertexAudio,
  inspectVertexGemini,
  isAllowedBridgeHost,
  isAllowedSpeakRightOrigin,
  pcm16leToWav,
  readVertexAccessToken,
  resolveVertexProjectId,
  startHermesXaiBridge,
  VERTEX_GEMINI_TTS_MODEL,
  validateTtsPayload,
  validateVertexTtsPayload,
} from "./hermes-xai-bridge.mjs";

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

test("serves token-protected loopback endpoints without generating audio", async (context) => {
  const origin = "http://127.0.0.1:3000";
  let vertexGenerationCalls = 0;
  const bridge = await startHermesXaiBridge({
    additionalOrigins: [origin],
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
