import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { loadCmuDictReference } from "./lib/cmudict-reference.mjs";
import { classifyBlindTranscript } from "./lib/phoneme-word-audit-core.mjs";
import {
  transcribeVertexGeminiAudio,
  VERTEX_GEMINI_AUDIO_MODEL,
} from "./lib/vertex-gemini-audio-client.mjs";
import {
  readVertexAccessToken,
  resolveVertexProjectId,
} from "./lib/vertex-gemini-tts-client.mjs";

const root = process.cwd();
const vertexRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates/vertex-gemini-3.1-tts",
);
const analysisRoot = path.join(vertexRoot, "analysis");
const planPath = path.join(analysisRoot, "third-listener-plan.json");
const observationsPath = path.join(analysisRoot, "vertex-gemini-blind.jsonl");
const failuresPath = path.join(
  analysisRoot,
  "vertex-gemini-blind-failures.jsonl",
);
const summaryPath = path.join(analysisRoot, "vertex-gemini-blind-summary.json");
const homophonesPath = path.resolve(
  root,
  "scripts/data/phoneme-word-audit-homophones.json",
);

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

async function withRetry(worker) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await worker();
    } catch (error) {
      const retryable =
        error?.status === 429 ||
        (typeof error?.status === "number" && error.status >= 500) ||
        /fetch|network|timeout|abort/i.test(String(error?.message ?? error));
      if (!retryable || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
    }
  }
  throw new Error("Vertex audio retry loop exhausted");
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    throw new Error("Vertex third-listener validation requires --confirm");
  }
  const limitArgument = process.argv.find((value) =>
    value.startsWith("--limit="),
  );
  const limit = Number(limitArgument?.split("=")[1] ?? 0);
  const plan = readJson(planPath);
  const homophoneGroups = readJson(homophonesPath).groups;
  const cmuReference = loadCmuDictReference();
  const existing = new Map(
    readJsonl(observationsPath).map((row) => [row.candidateSha256, row]),
  );
  const pending = plan.candidates
    .filter((candidate) => !existing.has(candidate.candidateSha256))
    .slice(0, limit > 0 ? limit : plan.candidates.length);
  const projectId = resolveVertexProjectId();
  const accessToken = readVertexAccessToken();
  let completed = 0;
  for (const candidate of pending) {
    let result;
    try {
      result = await withRetry(() =>
        transcribeVertexGeminiAudio({
          languageId: candidate.languageId,
          audioPath: path.resolve(root, candidate.desktopPath),
          projectId,
          accessToken,
          signal: AbortSignal.timeout(30_000),
        }),
      );
    } catch (error) {
      appendFileSync(
        failuresPath,
        `${JSON.stringify({
          version: 1,
          candidateId: candidate.candidateId,
          sourceAssetId: candidate.sourceAssetId,
          candidateSha256: candidate.candidateSha256,
          listener: VERTEX_GEMINI_AUDIO_MODEL,
          errorType: error?.name ?? "Error",
          failedAt: new Date().toISOString(),
        })}\n`,
        "utf8",
      );
      completed += 1;
      console.warn(`Vertex blind failed ${completed}/${pending.length}`);
      continue;
    }
    const row = {
      version: 1,
      candidateId: candidate.candidateId,
      sourceAssetId: candidate.sourceAssetId,
      candidateSha256: candidate.candidateSha256,
      listener: VERTEX_GEMINI_AUDIO_MODEL,
      heardText: result.heardText,
      heardIpa: result.heardIpa,
      uncertain: result.uncertain,
      outcome: result.uncertain
        ? "uncertain"
        : classifyBlindTranscript({
            expected: candidate.text,
            actual: result.heardText,
            languageId: candidate.languageId,
            homophoneGroups,
            cmuReference,
          }),
      targetAnswerSent: false,
      answerLeakage: false,
      usageMetadata: result.usageMetadata,
      createdAt: new Date().toISOString(),
    };
    appendFileSync(observationsPath, `${JSON.stringify(row)}\n`, "utf8");
    existing.set(candidate.candidateSha256, row);
    completed += 1;
    console.log(`Vertex blind ${completed}/${pending.length}`);
  }

  const currentRows = plan.candidates
    .map((candidate) => existing.get(candidate.candidateSha256))
    .filter(Boolean);
  const outcomes = {};
  for (const row of currentRows) {
    outcomes[row.outcome] = (outcomes[row.outcome] ?? 0) + 1;
  }
  const summary = {
    version: 1,
    generatedAt: new Date().toISOString(),
    modelId: VERTEX_GEMINI_AUDIO_MODEL,
    plannedCandidateCount: plan.selectedCandidateCount,
    observationCount: currentRows.length,
    outcomes,
    targetAnswerSent: false,
  };
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
