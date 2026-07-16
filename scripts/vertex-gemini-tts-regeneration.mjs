import { execFile } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { sha256Bytes, sha256File } from "./lib/pronunciation-audit-core.mjs";
import {
  readVertexAccessToken,
  resolveVertexProjectId,
  synthesizeVertexGeminiTts,
  VERTEX_GEMINI_TTS_MODEL,
  VERTEX_GEMINI_TTS_SAMPLE_RATE,
} from "./lib/vertex-gemini-tts-client.mjs";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const regenerationRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates",
);
const vertexRoot = path.join(regenerationRoot, "vertex-gemini-3.1-tts");
const audioRoot = path.join(vertexRoot, "audio");
const smokeRoot = path.join(vertexRoot, "smoke");
const planPath = path.join(vertexRoot, "vertex-plan.json");
const generatedPath = path.join(vertexRoot, "generated.jsonl");
const generationFailuresPath = path.join(
  vertexRoot,
  "generation-failures.jsonl",
);
const smokeReportPath = path.join(vertexRoot, "smoke-report.json");
const sourcePlanPath = path.join(regenerationRoot, "regeneration-plan.json");
const selectionPath = path.join(regenerationRoot, "candidate-selection.json");

const VOICE_BY_GENDER = {
  masculine: "Charon",
  feminine: "Kore",
};
const OUTPUT_PRICE_PER_SECOND_USD = (25 * 20) / 1_000_000;

function parseArgs(values) {
  const flags = new Set(
    values.filter((value) => value.startsWith("--") && !value.includes("=")),
  );
  const valueFor = (name, fallback = null) =>
    values
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? fallback;
  return { command: values[0], flags, valueFor };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  rmSync(filePath, { force: true });
  renameSync(temporary, filePath);
}

function stableSha(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(value), "utf8"));
}

function requireInputs() {
  if (!existsSync(sourcePlanPath) || !existsSync(selectionPath)) {
    throw new Error(
      "Current regeneration plan and candidate selection are required",
    );
  }
  return {
    sourcePlan: readJson(sourcePlanPath),
    selection: readJson(selectionPath),
  };
}

function buildPlan() {
  const { sourcePlan, selection } = requireInputs();
  const promoted = new Set(selection.promotedSourceAssetIds ?? []);
  const unresolved = sourcePlan.sourceAssets.filter(
    (source) => !promoted.has(source.sourceAssetId),
  );
  const candidates = unresolved.flatMap((source) =>
    ["A", "B"].map((variant) => ({
      candidateId: `vertex-${source.sourceAssetId}-${variant.toLowerCase()}`,
      sourceAssetId: source.sourceAssetId,
      sourceSha256: source.sourceSha256,
      languageId: source.languageId,
      text: source.text,
      synthesisText:
        source.languageId === "ru-RU" && source.text === "пять"
          ? "5"
          : source.languageId === "ru-RU" && source.text === "пятьдесят"
            ? "50"
            : source.text,
      canonicalIpa: source.canonicalIpa,
      omitIpaHint:
        source.languageId === "ru-RU" &&
        (source.text === "пять" || source.text === "пятьдесят"),
      targetUnits: source.targetUnits,
      referenceStatus: source.referenceStatus,
      referenceDigest: source.referenceDigest,
      voiceGender: source.voiceGender,
      voiceSlot: source.voiceSlot,
      replacedVoiceId: source.voiceId,
      replacedVoiceName: source.voiceName,
      vertexVoiceName: VOICE_BY_GENDER[source.voiceGender],
      modelId: VERTEX_GEMINI_TTS_MODEL,
      promptPolicyVersion: "vertex-word-ipa-v3",
      provider: "google-vertex-ai",
      generationRound: variant === "A" ? 3 : 4,
      variant,
      status: "planned",
    })),
  );
  const estimatedOutputSeconds = unresolved.reduce(
    (sum, source) =>
      sum + Math.max(0.8, Number(source.durationSeconds) || 0) * 2,
    0,
  );
  const byLanguage = Object.fromEntries(
    ["en-US", "es-ES", "fr-FR", "ru-RU"].map((languageId) => [
      languageId,
      {
        sourceAssets: unresolved.filter(
          (item) => item.languageId === languageId,
        ).length,
        candidates: candidates.filter((item) => item.languageId === languageId)
          .length,
      },
    ]),
  );
  const plan = {
    version: 1,
    provider: "google-vertex-ai",
    modelId: VERTEX_GEMINI_TTS_MODEL,
    promptPolicyVersion: "vertex-word-ipa-v3",
    location: "global",
    generatedAt: new Date().toISOString(),
    sourcePlanSha256: sourcePlan.planSha256,
    inputSelectionSha256: selection.selectionSha256,
    sourceAssetCount: unresolved.length,
    candidateCount: candidates.length,
    referenceConfirmedCount: unresolved.filter((item) =>
      ["two-source-confirmed", "variant-confirmed"].includes(
        item.referenceStatus,
      ),
    ).length,
    referenceBlockedCount: unresolved.filter(
      (item) =>
        !["two-source-confirmed", "variant-confirmed"].includes(
          item.referenceStatus,
        ),
    ).length,
    estimatedOutputSeconds: Number(estimatedOutputSeconds.toFixed(3)),
    estimatedOutputCostUsd: Number(
      (estimatedOutputSeconds * OUTPUT_PRICE_PER_SECOND_USD).toFixed(4),
    ),
    voicePolicy: {
      masculine: "Charon",
      feminine: "Kore",
      note: "Gemini prebuilt voices preserve gender semantics but do not clone ElevenLabs identities.",
    },
    byLanguage,
    candidates,
  };
  plan.planSha256 = stableSha(plan);
  return plan;
}

async function withRetry(worker) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await worker();
    } catch (error) {
      const retryable =
        error?.status === 429 ||
        (typeof error?.status === "number" && error.status >= 500) ||
        /fetch|network|timeout|abort/i.test(String(error?.message ?? error));
      if (!retryable || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
    }
  }
  throw new Error("Retry loop exhausted");
}

async function pcmToMp3(pcmBytes, outputPath) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const pcmPath = `${outputPath}.pcm`;
  writeFileSync(pcmPath, pcmBytes);
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "s16le",
        "-ar",
        String(VERTEX_GEMINI_TTS_SAMPLE_RATE),
        "-ac",
        "1",
        "-i",
        pcmPath,
        "-ar",
        "44100",
        "-ac",
        "1",
        "-b:a",
        "128k",
        outputPath,
      ],
      { windowsHide: true },
    );
  } finally {
    rmSync(pcmPath, { force: true });
  }
}

async function inspectAudio(filePath) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=sample_rate,channels,codec_name",
      "-of",
      "json",
      filePath,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  const parsed = JSON.parse(stdout);
  return {
    durationSeconds: Number(parsed?.format?.duration ?? 0),
    sampleRate: Number(parsed?.streams?.[0]?.sample_rate ?? 0),
    channels: Number(parsed?.streams?.[0]?.channels ?? 0),
    codecName: parsed?.streams?.[0]?.codec_name ?? null,
  };
}

async function synthesizeCandidate(candidate, outputPath, context) {
  const result = await withRetry(() =>
    synthesizeVertexGeminiTts({
      languageId: candidate.languageId,
      text: candidate.synthesisText ?? candidate.text,
      voiceName: candidate.vertexVoiceName,
      expectedIpa: candidate.omitIpaHint ? undefined : candidate.canonicalIpa,
      variant: candidate.variant,
      projectId: context.projectId,
      accessToken: context.accessToken,
    }),
  );
  await pcmToMp3(result.bytes, outputPath);
  const audio = await inspectAudio(outputPath);
  if (!(audio.durationSeconds > 0.15) || audio.channels !== 1) {
    throw new Error(`Invalid generated audio for ${candidate.candidateId}`);
  }
  return {
    ...candidate,
    status: "generated-pending-validation",
    candidateSha256: sha256File(outputPath),
    relativePath: path.relative(root, outputPath).replaceAll("\\", "/"),
    audio,
    usageMetadata: result.usageMetadata,
    generatedAt: new Date().toISOString(),
    projectFingerprint: stableSha(context.projectId).slice(0, 12),
  };
}

async function runPool(items, concurrency, worker) {
  let index = 0;
  let fatal;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (!fatal) {
        const current = index;
        index += 1;
        if (current >= items.length) return;
        try {
          await worker(items[current], current);
        } catch (error) {
          fatal = error;
        }
      }
    },
  );
  await Promise.all(runners);
  if (fatal) throw fatal;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === "plan") {
    const plan = buildPlan();
    writeJson(planPath, plan);
    console.log(
      JSON.stringify(
        {
          planSha256: plan.planSha256,
          sourceAssetCount: plan.sourceAssetCount,
          candidateCount: plan.candidateCount,
          referenceBlockedCount: plan.referenceBlockedCount,
          estimatedOutputSeconds: plan.estimatedOutputSeconds,
          estimatedOutputCostUsd: plan.estimatedOutputCostUsd,
          byLanguage: plan.byLanguage,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!existsSync(planPath)) throw new Error("Run vertex plan first");
  const plan = readJson(planPath);
  if (parsed.valueFor("--plan-sha") !== plan.planSha256) {
    throw new Error("Exact --plan-sha is required");
  }
  if (!parsed.flags.has("--confirm"))
    throw new Error("Paid Vertex calls require --confirm");
  const context = {
    projectId: resolveVertexProjectId(),
    accessToken: readVertexAccessToken(),
  };

  if (parsed.command === "smoke") {
    const selected = [];
    for (const languageId of ["en-US", "es-ES", "fr-FR", "ru-RU"]) {
      for (const gender of ["masculine", "feminine"]) {
        const match = plan.candidates.find(
          (item) =>
            item.languageId === languageId &&
            item.voiceGender === gender &&
            item.variant === "A",
        );
        if (match) selected.push(match);
      }
    }
    const results = [];
    for (const candidate of selected) {
      const outputPath = path.join(smokeRoot, `${candidate.candidateId}.mp3`);
      let row;
      try {
        row = await synthesizeCandidate(candidate, outputPath, context);
      } catch (error) {
        const wrapped = new Error(
          `${candidate.candidateId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        wrapped.status = error?.status;
        throw wrapped;
      }
      results.push(row);
      console.log(
        `Vertex smoke ${results.length}/${selected.length}: ${candidate.languageId} ${candidate.voiceGender}`,
      );
    }
    const report = {
      version: 1,
      generatedAt: new Date().toISOString(),
      planSha256: plan.planSha256,
      count: results.length,
      allDecoded: results.every((item) => item.audio.durationSeconds > 0.15),
      results,
    };
    writeJson(smokeReportPath, report);
    console.log(
      JSON.stringify(
        { count: report.count, allDecoded: report.allDecoded },
        null,
        2,
      ),
    );
    return;
  }

  if (parsed.command === "generate") {
    const existing = new Map(
      readJsonl(generatedPath).map((row) => [row.candidateId, row]),
    );
    const limit = Number(parsed.valueFor("--limit", plan.candidates.length));
    const pending = plan.candidates
      .filter((candidate) => {
        const row = existing.get(candidate.candidateId);
        const outputPath = path.join(audioRoot, `${candidate.candidateId}.mp3`);
        return (
          !row ||
          row.promptPolicyVersion !== candidate.promptPolicyVersion ||
          !existsSync(outputPath) ||
          sha256File(outputPath) !== row.candidateSha256
        );
      })
      .slice(0, limit);
    let completed = 0;
    await runPool(pending, 1, async (candidate) => {
      const outputPath = path.join(audioRoot, `${candidate.candidateId}.mp3`);
      let row;
      try {
        row = await synthesizeCandidate(candidate, outputPath, context);
      } catch (error) {
        if (error?.status === 400) {
          appendFileSync(
            generationFailuresPath,
            `${JSON.stringify({
              candidateId: candidate.candidateId,
              sourceAssetId: candidate.sourceAssetId,
              languageId: candidate.languageId,
              status: "vertex-invalid-argument",
              promptPolicyVersion: candidate.promptPolicyVersion,
              failedAt: new Date().toISOString(),
            })}\n`,
            "utf8",
          );
          completed += 1;
          console.warn(
            `Vertex skipped invalid request: ${candidate.candidateId}`,
          );
          return;
        }
        const wrapped = new Error(
          `${candidate.candidateId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        wrapped.status = error?.status;
        throw wrapped;
      }
      appendFileSync(generatedPath, `${JSON.stringify(row)}\n`, "utf8");
      completed += 1;
      if (completed % 20 === 0 || completed === pending.length) {
        console.log(`Vertex generated ${completed}/${pending.length}`);
      }
    });
    console.log(
      JSON.stringify(
        { generatedThisRun: completed, remaining: pending.length - completed },
        null,
        2,
      ),
    );
    return;
  }

  throw new Error(
    "Usage: node scripts/vertex-gemini-tts-regeneration.mjs plan|smoke|generate",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
