#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  assertFormalAudioPaths,
  assertIgnoredOutputPath,
  buildFfmpegStages,
  buildImmutablePlan,
  digestJson,
  finiteNumber,
  PROMOTED_LOUDNESS_V2_TARGET_LRA_LU,
  PROMOTED_LOUDNESS_V2_TARGET_LUFS,
  PROMOTED_LOUDNESS_V2_TRUE_PEAK_DBTP,
  resolveWithin,
  selectPromotedLoudnessAnomalies,
  validateV2CandidateQuality,
  verifyImmutablePlan,
} from "./lib/promoted-audio-loudness-v2-core.mjs";
import { buildPromotedReviewBundle } from "./lib/promoted-audio-review-core.mjs";

const root = process.cwd();
const auditRelative = "outputs/phoneme-word-auditory-audit-2026-07-14";
const auditRoot = resolveWithin(root, auditRelative, "auditRoot");
const regenerationRoot = path.join(auditRoot, "regenerated-candidates");
const reviewRoot = path.join(auditRoot, "assistant-auditory-audit-v1");
const outputRelativeRoot = `${auditRelative}/loudness-normalization-v2`;
const outputRoot = resolveWithin(root, outputRelativeRoot, "outputRoot");
const ffmpegExecutable = process.env.SPEAKRIGHT_FFMPEG_PATH ?? "ffmpeg";
const ffprobeExecutable = process.env.SPEAKRIGHT_FFPROBE_PATH ?? "ffprobe";
const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function toRepoRelative(filePath) {
  const value = path.relative(root, filePath).replaceAll("\\", "/");
  if (value.startsWith("../") || path.isAbsolute(value)) {
    throw new Error(`Path is outside the repository: ${filePath}`);
  }
  return value;
}

function run(executable, args, label) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${label} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`,
    );
  }
  return result;
}

function median(values, label) {
  const finite = values
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (finite.length === 0)
    throw new Error(`${label} has no finite observations`);
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 === 0
    ? (finite[middle - 1] + finite[middle]) / 2
    : finite[middle];
}

function probeAudio(filePath) {
  const result = run(
    ffprobeExecutable,
    [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_name,sample_rate,channels,bit_rate:format=duration,bit_rate",
      "-of",
      "json",
      filePath,
    ],
    `FFprobe ${filePath}`,
  );
  const payload = JSON.parse(result.stdout);
  const stream = payload.streams?.[0];
  if (!stream) throw new Error(`No audio stream found in ${filePath}`);
  const sampleRate = Number(stream.sample_rate);
  const channels = Number(stream.channels);
  const durationSeconds = Number(payload.format?.duration);
  if (!Number.isInteger(sampleRate) || !Number.isInteger(channels)) {
    throw new Error(`Invalid audio stream metadata in ${filePath}`);
  }
  finiteNumber(durationSeconds, `${filePath}.durationSeconds`);
  return {
    codecName: stream.codec_name,
    sampleRate,
    channels,
    durationSeconds,
    bitRate: Number(stream.bit_rate ?? payload.format?.bit_rate ?? 0) || null,
  };
}

function parseLoudnorm(stderr, label) {
  const matches = [...stderr.matchAll(/\{\s*"input_i"[\s\S]*?\}/gu)];
  const match = matches.at(-1)?.[0];
  if (!match) throw new Error(`${label}: FFmpeg emitted no loudnorm JSON`);
  const metrics = JSON.parse(match);
  return {
    integratedLufs: finiteNumber(Number(metrics.input_i), `${label}.input_i`),
    truePeakDbtp: finiteNumber(Number(metrics.input_tp), `${label}.input_tp`),
    loudnessRangeLu: finiteNumber(
      Number(metrics.input_lra),
      `${label}.input_lra`,
    ),
    thresholdLufs: finiteNumber(
      Number(metrics.input_thresh),
      `${label}.input_thresh`,
    ),
    targetOffsetLu: finiteNumber(
      Number(metrics.target_offset),
      `${label}.target_offset`,
    ),
  };
}

function analyzeLoudness(filePath) {
  const result = run(
    ffmpegExecutable,
    [
      "-hide_banner",
      "-nostats",
      "-i",
      filePath,
      "-af",
      `loudnorm=I=${PROMOTED_LOUDNESS_V2_TARGET_LUFS}:LRA=${PROMOTED_LOUDNESS_V2_TARGET_LRA_LU}:TP=${PROMOTED_LOUDNESS_V2_TRUE_PEAK_DBTP}:print_format=json`,
      "-f",
      "null",
      nullDevice,
    ],
    `EBU R128 analysis ${filePath}`,
  );
  return parseLoudnorm(result.stderr, filePath);
}

function parseLastOverallMetric(overall, name, label) {
  const matches = [
    ...overall.matchAll(new RegExp(`${name}:\\s*([^\\r\\n]+)`, "gu")),
  ];
  const raw = matches.at(-1)?.[1]?.trim();
  const value = Number(raw);
  return finiteNumber(value, `${label}.${name}`);
}

function parseOptionalOverallCount(overall, name, label) {
  const matches = [
    ...overall.matchAll(new RegExp(`${name}:\\s*([^\\r\\n]+)`, "gu")),
  ];
  if (matches.length === 0) return 0;
  return finiteNumber(Number(matches.at(-1)[1].trim()), `${label}.${name}`);
}

function analyzeTimeDomain(filePath) {
  const result = run(
    ffmpegExecutable,
    [
      "-hide_banner",
      "-nostats",
      "-i",
      filePath,
      "-af",
      "astats=metadata=0:reset=0",
      "-f",
      "null",
      nullDevice,
    ],
    `PCM statistics ${filePath}`,
  );
  const overallIndex = result.stderr.lastIndexOf("Overall");
  if (overallIndex < 0)
    throw new Error(`${filePath}: astats emitted no Overall block`);
  const overall = result.stderr.slice(overallIndex);
  return {
    dcOffset: parseLastOverallMetric(overall, "DC offset", filePath),
    peakLevelDbfs: parseLastOverallMetric(overall, "Peak level dB", filePath),
    rmsLevelDbfs: parseLastOverallMetric(overall, "RMS level dB", filePath),
    nanCount: parseOptionalOverallCount(overall, "Number of NaNs", filePath),
    infiniteCount: parseOptionalOverallCount(
      overall,
      "Number of Infs",
      filePath,
    ),
    denormalCount: parseOptionalOverallCount(
      overall,
      "Number of denormals",
      filePath,
    ),
  };
}

function analyzeSilence(filePath, durationSeconds) {
  const result = run(
    ffmpegExecutable,
    [
      "-hide_banner",
      "-nostats",
      "-i",
      filePath,
      "-af",
      "silencedetect=noise=-50dB:d=0.05",
      "-f",
      "null",
      nullDevice,
    ],
    `Silence analysis ${filePath}`,
  );
  const events = [
    ...result.stderr.matchAll(/silence_(start|end):\s*([\d.]+)/gu),
  ].map((match) => ({ kind: match[1], seconds: Number(match[2]) }));
  const intervals = [];
  let start = null;
  for (const event of events) {
    finiteNumber(event.seconds, `${filePath}.silence.${event.kind}`);
    if (event.kind === "start") start = event.seconds;
    if (event.kind === "end" && start !== null) {
      intervals.push({ start, end: Math.min(event.seconds, durationSeconds) });
      start = null;
    }
  }
  if (start !== null) intervals.push({ start, end: durationSeconds });
  const totalSeconds = intervals.reduce(
    (sum, interval) => sum + Math.max(0, interval.end - interval.start),
    0,
  );
  const first = intervals[0];
  const last = intervals.at(-1);
  return {
    thresholdDbfs: -50,
    minimumEventSeconds: 0.05,
    intervalCount: intervals.length,
    totalSeconds: Number(totalSeconds.toFixed(6)),
    ratio: Number((totalSeconds / durationSeconds).toFixed(6)),
    leadingSeconds:
      first && first.start <= 0.02 ? Number(first.end.toFixed(6)) : 0,
    trailingSeconds:
      last && last.end >= durationSeconds - 0.02
        ? Number((durationSeconds - last.start).toFixed(6))
        : 0,
  };
}

function analyzeSpectrum(filePath) {
  const result = run(
    ffmpegExecutable,
    [
      "-hide_banner",
      "-nostats",
      "-i",
      filePath,
      "-af",
      "aspectralstats=win_size=2048:overlap=0.5:measure=centroid+spread+flatness+rolloff,ametadata=print:file=-",
      "-f",
      "null",
      nullDevice,
    ],
    `Spectrum analysis ${filePath}`,
  );
  const combined = `${result.stdout}\n${result.stderr}`;
  const collect = (name) =>
    [
      ...combined.matchAll(
        new RegExp(`aspectralstats\\.\\d+\\.${name}=([^\\r\\n]+)`, "gu"),
      ),
    ].map((match) => Number(match[1]));
  return {
    aggregation: "median-per-frame",
    centroidHz: median(collect("centroid"), `${filePath}.centroid`),
    spreadHz: median(collect("spread"), `${filePath}.spread`),
    flatness: median(collect("flatness"), `${filePath}.flatness`),
    rolloffHz: median(collect("rolloff"), `${filePath}.rolloff`),
  };
}

function analyzeAudio(filePath) {
  const probe = probeAudio(filePath);
  return {
    probe,
    loudness: analyzeLoudness(filePath),
    timeDomain: analyzeTimeDomain(filePath),
    silence: analyzeSilence(filePath, probe.durationSeconds),
    spectrum: analyzeSpectrum(filePath),
  };
}

function analyzeSiSdr(leftPath, rightPath, label) {
  const result = run(
    ffmpegExecutable,
    [
      "-hide_banner",
      "-nostats",
      "-i",
      leftPath,
      "-i",
      rightPath,
      "-filter_complex",
      "[0:a][1:a]asisdr",
      "-f",
      "null",
      nullDevice,
    ],
    `SI-SDR ${label}`,
  );
  const match = result.stderr.match(/SI-SDR ch0:\s*(inf|[-\d.]+)\s*dB/iu);
  if (!match) throw new Error(`${label}: FFmpeg emitted no SI-SDR metric`);
  if (match[1].toLowerCase() === "inf")
    return { infinite: true, valueDb: null };
  return {
    infinite: false,
    valueDb: finiteNumber(Number(match[1]), `${label}.siSdrDb`),
  };
}

function loadReviewInputs() {
  const plan = readJson(path.join(regenerationRoot, "regeneration-plan.json"));
  const ledger = readJson(path.join(regenerationRoot, "promotion-ledger.json"));
  const selection = readJson(
    path.join(regenerationRoot, "candidate-selection.json"),
  );
  const bundle = buildPromotedReviewBundle({ plan, ledger, selection });
  const reportPath = path.join(
    reviewRoot,
    bundle.digest.slice(0, 16),
    "promoted-loudness-report.json",
  );
  if (!existsSync(reportPath)) {
    throw new Error(`Promoted loudness report is missing: ${reportPath}`);
  }
  return { bundle, report: readJson(reportPath), reportPath };
}

function assertOwnedPath(candidatePath, allowedRoot, label) {
  const resolved = path.resolve(candidatePath);
  const base = path.resolve(allowedRoot);
  if (!resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error(`${label} is outside its allowed output root`);
  }
  return resolved;
}

function temporaryPathFor(targetPath) {
  const extension = path.extname(targetPath);
  const stem = targetPath.slice(0, -extension.length);
  return `${stem}.partial-${randomUUID()}${extension}`;
}

function publishOwnTemporaryFile(temporaryPath, targetPath, allowedRoot) {
  const temporary = assertOwnedPath(
    temporaryPath,
    allowedRoot,
    "temporaryPath",
  );
  const target = assertOwnedPath(targetPath, allowedRoot, "targetPath");
  if (!path.basename(temporary).includes(".partial-")) {
    throw new Error(
      "Refusing to unlink a file that is not an owned temporary artifact",
    );
  }
  if (!existsSync(temporary))
    throw new Error(`Temporary artifact is missing: ${temporary}`);
  if (existsSync(target)) {
    if (sha256File(temporary) !== sha256File(target)) {
      throw new Error(
        `Immutable artifact already exists with different bytes: ${target}`,
      );
    }
    unlinkSync(temporary);
    return;
  }
  linkSync(temporary, target);
  unlinkSync(temporary);
}

function writeImmutableText(targetPath, content, allowedRoot) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  if (existsSync(targetPath)) {
    if (readFileSync(targetPath, "utf8") !== content) {
      throw new Error(
        `Immutable document already exists with different content: ${targetPath}`,
      );
    }
    return;
  }
  const temporary = temporaryPathFor(targetPath);
  const descriptor = openSync(temporary, "wx");
  try {
    writeFileSync(descriptor, content, "utf8");
  } finally {
    closeSync(descriptor);
  }
  publishOwnTemporaryFile(temporary, targetPath, allowedRoot);
}

function generateFfmpegArtifact(stage, allowedRoot) {
  mkdirSync(path.dirname(stage.outputPath), { recursive: true });
  const temporary = temporaryPathFor(stage.outputPath);
  const args = [...stage.args];
  args[args.length - 1] = temporary;
  run(ffmpegExecutable, args, stage.name);
  publishOwnTemporaryFile(temporary, stage.outputPath, allowedRoot);
}

function createPlan() {
  const { bundle, report, reportPath } = loadReviewInputs();
  const selected = selectPromotedLoudnessAnomalies({ bundle, report }).map(
    (asset) => {
      const desktopPath = path.resolve(root, asset.desktopPath);
      const browserPath = path.resolve(root, asset.browserPath);
      if (!existsSync(desktopPath) || !existsSync(browserPath)) {
        throw new Error(`${asset.assetId}: formal source is missing`);
      }
      const desktopSha256 = sha256File(desktopPath);
      const browserSha256 = sha256File(browserPath);
      if (
        desktopSha256 !== asset.sha256 ||
        browserSha256 !== asset.sha256 ||
        desktopSha256 !== browserSha256
      ) {
        throw new Error(
          `${asset.assetId}: formal source SHA/parity check failed`,
        );
      }
      const sourceAnalysis = analyzeAudio(desktopPath);
      if (
        Math.abs(
          sourceAnalysis.loudness.integratedLufs -
            asset.reportMeasurements.inputI,
        ) > 0.1
      ) {
        throw new Error(
          `${asset.assetId}: fresh loudness analysis differs from the source report`,
        );
      }
      return { ...asset, sourceAnalysis };
    },
  );
  const document = buildImmutablePlan({
    bundle,
    loudnessReportPath: toRepoRelative(reportPath),
    loudnessReportSha256: sha256File(reportPath),
    selected,
  });
  const planRelativePath = `${outputRelativeRoot}/${document.planSha256.slice(0, 16)}/immutable-plan.json`;
  assertIgnoredOutputPath(planRelativePath);
  const planPath = resolveWithin(root, planRelativePath, "immutable plan");
  writeImmutableText(
    planPath,
    `${JSON.stringify(document, null, 2)}\n`,
    outputRoot,
  );
  console.log(
    JSON.stringify(
      {
        mode: "immutable-plan",
        planSha256: document.planSha256,
        planPath: toRepoRelative(planPath),
        assetCount: document.assetCount,
        formalAssetsModified: false,
        networkCallsPerformed: false,
        next: `node scripts/promoted-audio-loudness-v2.mjs generate --plan-sha=${document.planSha256}`,
      },
      null,
      2,
    ),
  );
}

function parsePlanSha() {
  const value = process.argv
    .find((argument) => argument.startsWith("--plan-sha="))
    ?.slice(11);
  if (!/^[a-f0-9]{64}$/u.test(value ?? "")) {
    throw new Error(
      "generate requires --plan-sha=<exact 64-character immutable plan SHA>",
    );
  }
  return value;
}

function generateCandidates() {
  const requestedPlanSha = parsePlanSha();
  const planRelativePath = `${outputRelativeRoot}/${requestedPlanSha.slice(0, 16)}/immutable-plan.json`;
  assertIgnoredOutputPath(planRelativePath);
  const planPath = resolveWithin(root, planRelativePath, "immutable plan");
  if (!existsSync(planPath))
    throw new Error(`Immutable plan is missing: ${planPath}`);
  const document = readJson(planPath);
  const actualPlanSha = verifyImmutablePlan(document);
  if (actualPlanSha !== requestedPlanSha)
    throw new Error("Requested plan SHA is not exact");
  const planRoot = path.dirname(planPath);
  const reportPath = path.resolve(root, document.loudnessReport.path);
  if (sha256File(reportPath) !== document.loudnessReport.sha256) {
    throw new Error("Loudness source report changed after immutable planning");
  }
  const lossyEncodeCountPerAsset = document.assets.reduce((count, asset) => {
    const sourcePaths = assertFormalAudioPaths(asset.source);
    const sourcePath = path.resolve(root, sourcePaths.desktopPath);
    const browserPath = path.resolve(root, sourcePaths.browserPath);
    if (
      sha256File(sourcePath) !== asset.source.sha256 ||
      sha256File(browserPath) !== asset.source.sha256
    ) {
      throw new Error(
        `${asset.assetId}: formal source changed after immutable planning`,
      );
    }
    return count;
  }, 0);
  if (lossyEncodeCountPerAsset !== 0) {
    throw new Error("Internal encode accounting invariant failed");
  }
  const results = [];
  for (const asset of document.assets) {
    const sourcePath = path.resolve(root, asset.source.desktopPath);
    const decodedPath = resolveWithin(
      planRoot,
      asset.artifacts.decodedSourceWav,
      `${asset.assetId}.decodedSourceWav`,
    );
    const masterPath = resolveWithin(
      planRoot,
      asset.artifacts.normalizedMasterWav,
      `${asset.assetId}.normalizedMasterWav`,
    );
    const deliveryPath = resolveWithin(
      planRoot,
      asset.artifacts.deliveryCandidateMp3,
      `${asset.assetId}.deliveryCandidateMp3`,
    );
    const stages = buildFfmpegStages({
      sourcePath,
      decodedWavPath: decodedPath,
      normalizedMasterPath: masterPath,
      deliveryCandidatePath: deliveryPath,
      sampleRate: asset.sourceAnalysis.probe.sampleRate,
      channels: asset.sourceAnalysis.probe.channels,
      measurements: {
        inputI: asset.sourceAnalysis.loudness.integratedLufs,
        inputTp: asset.sourceAnalysis.loudness.truePeakDbtp,
        inputLra: asset.sourceAnalysis.loudness.loudnessRangeLu,
        inputThreshold: asset.sourceAnalysis.loudness.thresholdLufs,
        targetOffset: asset.sourceAnalysis.loudness.targetOffsetLu,
      },
    });
    if (stages.reduce((sum, stage) => sum + stage.lossyEncodeCount, 0) !== 1) {
      throw new Error(
        `${asset.assetId}: pipeline must contain exactly one lossy encode`,
      );
    }
    for (const stage of stages) generateFfmpegArtifact(stage, planRoot);
    const decoded = analyzeAudio(decodedPath);
    const master = analyzeAudio(masterPath);
    const delivery = analyzeAudio(deliveryPath);
    const sourceMasterSiSdr = analyzeSiSdr(
      sourcePath,
      masterPath,
      `${asset.assetId} source/master`,
    );
    const masterDeliverySiSdr = analyzeSiSdr(
      masterPath,
      deliveryPath,
      `${asset.assetId} master/delivery`,
    );
    const validation = validateV2CandidateQuality({
      source: asset.sourceAnalysis,
      decoded,
      master,
      delivery,
      sourceMasterSiSdr,
      masterDeliverySiSdr,
    });
    results.push({
      assetId: asset.assetId,
      languageId: asset.languageId,
      text: asset.text,
      voiceName: asset.voiceName,
      sourceSha256: asset.source.sha256,
      artifacts: {
        decodedSourceWav: {
          path: toRepoRelative(decodedPath),
          sha256: sha256File(decodedPath),
        },
        normalizedMasterWav: {
          path: toRepoRelative(masterPath),
          sha256: sha256File(masterPath),
        },
        deliveryCandidateMp3: {
          path: toRepoRelative(deliveryPath),
          sha256: sha256File(deliveryPath),
        },
      },
      analyses: {
        decoded,
        master,
        delivery,
        sourceMasterSiSdr,
        masterDeliverySiSdr,
      },
      validation,
      status: validation.passed ? "candidate-passed" : "candidate-failed",
    });
  }
  const reportCore = {
    version: 2,
    planSha256: requestedPlanSha,
    policyVersion: document.policyVersion,
    assetCount: results.length,
    passedCount: results.filter((item) => item.validation.passed).length,
    failedCount: results.filter((item) => !item.validation.passed).length,
    candidateOnly: true,
    formalAssetsModified: false,
    networkCallsPerformed: false,
    pipeline: document.audioPipeline,
    results,
  };
  const generationReport = {
    ...reportCore,
    reportSha256: digestJson(reportCore),
  };
  const generationReportPath = path.join(planRoot, "generation-report.json");
  writeImmutableText(
    generationReportPath,
    `${JSON.stringify(generationReport, null, 2)}\n`,
    planRoot,
  );
  console.log(
    JSON.stringify(
      {
        mode: "candidate-generation",
        planSha256: requestedPlanSha,
        reportSha256: generationReport.reportSha256,
        reportPath: toRepoRelative(generationReportPath),
        assetCount: results.length,
        passedCount: generationReport.passedCount,
        failedCount: generationReport.failedCount,
        formalAssetsModified: false,
        networkCallsPerformed: false,
      },
      null,
      2,
    ),
  );
  if (generationReport.failedCount > 0) process.exitCode = 1;
}

const command = process.argv[2] ?? "plan";
if (command === "plan") createPlan();
else if (command === "generate") generateCandidates();
else {
  throw new Error(
    "Usage: node scripts/promoted-audio-loudness-v2.mjs plan | generate --plan-sha=<sha256>",
  );
}
