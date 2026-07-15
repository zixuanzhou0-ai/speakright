import { createHash } from "node:crypto";
import path from "node:path";

export const PROMOTED_LOUDNESS_V2_POLICY_VERSION = "promoted-loudness-safe-v2";
export const PROMOTED_LOUDNESS_V2_EXPECTED_ASSET_COUNT = 28;
export const PROMOTED_LOUDNESS_V2_TARGET_LUFS = -23;
export const PROMOTED_LOUDNESS_V2_TARGET_LRA_LU = 7;
export const PROMOTED_LOUDNESS_V2_TRUE_PEAK_DBTP = -2;

export const PROMOTED_LOUDNESS_V2_GATE_POLICY = Object.freeze({
  masterLoudnessToleranceLu: 0.5,
  deliveryLoudnessToleranceLu: 1,
  maximumTruePeakDbtp: -1.8,
  maximumSamplePeakDbfs: -1,
  maximumMasterDurationDeltaSeconds: 0.01,
  maximumDeliveryDurationDeltaSeconds: 0.06,
  maximumSilenceRatio: 0.7,
  maximumEdgeSilenceSeconds: 0.9,
  maximumMasterDeliverySilenceDeltaSeconds: 0.2,
  maximumMasterSpectrumRelativeDelta: 0.04,
  maximumDeliverySpectrumRelativeDelta: 0.12,
  // FFmpeg aspectralstats flatness is not gain-invariant on very quiet frames.
  // Centroid/spread/rolloff and SI-SDR remain the hard spectral/fidelity guards.
  maximumMasterFlatnessAbsoluteDelta: 0.15,
  maximumDeliveryFlatnessAbsoluteDelta: 0.12,
  minimumSourceMasterSiSdrDb: 35,
  minimumMasterDeliverySiSdrDb: 15,
});

const FORMAL_DESKTOP_PREFIX = "public/audio/";
const FORMAL_BROWSER_PREFIX = "apps/browser/public/audio/";
const OUTPUT_PREFIX =
  "outputs/phoneme-word-auditory-audit-2026-07-14/loudness-normalization-v2/";

export function finiteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Canonical JSON rejects non-finite numbers");
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function digestJson(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function normalizeRelativePath(value, label = "path") {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  if (value.includes("\0") || path.isAbsolute(value)) {
    throw new Error(`${label} must be relative`);
  }
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === ".." || segment === "")) {
    throw new Error(`${label} contains an unsafe segment`);
  }
  return segments.join("/");
}

export function resolveWithin(baseDirectory, relativePath, label = "path") {
  const normalized = normalizeRelativePath(relativePath, label);
  const base = path.resolve(baseDirectory);
  const resolved = path.resolve(base, ...normalized.split("/"));
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error(`${label} escapes its allowed root`);
  }
  return resolved;
}

export function assertFormalAudioPaths({ desktopPath, browserPath }) {
  const desktop = normalizeRelativePath(desktopPath, "desktopPath");
  const browser = normalizeRelativePath(browserPath, "browserPath");
  if (!desktop.startsWith(FORMAL_DESKTOP_PREFIX) || !desktop.endsWith(".mp3")) {
    throw new Error(`Unsafe formal desktop path: ${desktop}`);
  }
  if (!browser.startsWith(FORMAL_BROWSER_PREFIX) || !browser.endsWith(".mp3")) {
    throw new Error(`Unsafe formal browser path: ${browser}`);
  }
  return { desktopPath: desktop, browserPath: browser };
}

export function assertIgnoredOutputPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath, "outputPath");
  if (!normalized.startsWith(OUTPUT_PREFIX)) {
    throw new Error(
      `Candidate output is outside the ignored v2 root: ${normalized}`,
    );
  }
  return normalized;
}

function safeSlug(value, label) {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replaceAll(/[^a-zA-Z0-9._-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
  if (!slug) throw new Error(`${label} cannot be converted to a safe slug`);
  return slug;
}

export function buildArtifactPaths(asset) {
  if (!/^[a-f0-9]{20}$/u.test(asset.assetId)) {
    throw new Error(`Invalid promoted asset ID: ${asset.assetId}`);
  }
  const languageId = safeSlug(asset.languageId, "languageId");
  const voiceName = safeSlug(asset.voiceName, "voiceName");
  const base = `assets/${languageId}/${voiceName}/${asset.assetId}`;
  return {
    decodedSourceWav: `${base}.decoded-source.wav`,
    normalizedMasterWav: `${base}.normalized-master.wav`,
    deliveryCandidateMp3: `${base}.delivery-candidate.mp3`,
  };
}

export function selectPromotedLoudnessAnomalies({ bundle, report }) {
  if (report.bundleDigest !== bundle.digest) {
    throw new Error("Promoted loudness report bundle digest is stale");
  }
  if (!Array.isArray(report.rows) || !Array.isArray(report.crossVoice)) {
    throw new Error("Promoted loudness report is incomplete");
  }
  const assetsById = new Map(
    bundle.assets.map((asset) => [asset.assetId, asset]),
  );
  const selectedGroups = [];
  for (const comparison of report.crossVoice) {
    if (comparison.status !== "fail") continue;
    const voices = [...(comparison.voices ?? [])].sort(
      (left, right) =>
        finiteNumber(left.medianIntegratedLufs, "voice.medianIntegratedLufs") -
        finiteNumber(right.medianIntegratedLufs, "voice.medianIntegratedLufs"),
    );
    if (voices.length < 2) {
      throw new Error(
        `${comparison.languageId}: failed comparison has fewer than two voices`,
      );
    }
    const quietest = voices[0];
    const loudest = voices.at(-1);
    const spreadLufs =
      finiteNumber(loudest.medianIntegratedLufs, "loudest median") -
      finiteNumber(quietest.medianIntegratedLufs, "quietest median");
    if (spreadLufs <= 6) {
      throw new Error(
        `${comparison.languageId}: fail status is inconsistent with its spread`,
      );
    }
    selectedGroups.push({
      languageId: comparison.languageId,
      voiceName: quietest.voiceName,
      quietVoiceMedianIntegratedLufs: quietest.medianIntegratedLufs,
      comparisonVoiceMedianIntegratedLufs: loudest.medianIntegratedLufs,
      spreadLufs,
    });
  }
  const groupByKey = new Map(
    selectedGroups.map((group) => [
      `${group.languageId}\0${group.voiceName}`,
      group,
    ]),
  );
  const selected = report.rows
    .filter((row) => groupByKey.has(`${row.languageId}\0${row.voiceName}`))
    .map((row) => {
      const asset = assetsById.get(row.assetId);
      if (!asset) throw new Error(`Missing promoted asset ${row.assetId}`);
      if (asset.sha256 !== row.sha256) {
        throw new Error(
          `${row.assetId}: loudness report SHA does not match the promoted asset`,
        );
      }
      const paths = assertFormalAudioPaths(asset);
      const measurements = {
        inputI: finiteNumber(row.inputI, `${row.assetId}.inputI`),
        inputTp: finiteNumber(row.inputTp, `${row.assetId}.inputTp`),
        inputLra: finiteNumber(row.inputLra, `${row.assetId}.inputLra`),
        inputThreshold: finiteNumber(
          row.inputThreshold,
          `${row.assetId}.inputThreshold`,
        ),
        targetOffset: finiteNumber(
          row.targetOffset,
          `${row.assetId}.targetOffset`,
        ),
      };
      return {
        ...asset,
        ...paths,
        anomaly: groupByKey.get(`${row.languageId}\0${row.voiceName}`),
        reportMeasurements: measurements,
        artifacts: buildArtifactPaths(asset),
      };
    })
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
  if (selected.length !== PROMOTED_LOUDNESS_V2_EXPECTED_ASSET_COUNT) {
    throw new Error(
      `Expected ${PROMOTED_LOUDNESS_V2_EXPECTED_ASSET_COUNT} dynamic loudness anomalies, received ${selected.length}`,
    );
  }
  return selected;
}

export function buildImmutablePlan({
  bundle,
  loudnessReportPath,
  loudnessReportSha256,
  selected,
}) {
  const plan = {
    version: 2,
    policyVersion: PROMOTED_LOUDNESS_V2_POLICY_VERSION,
    immutable: true,
    candidateOnly: true,
    formalAssetsModified: false,
    networkCallsPerformed: false,
    sourceBundleDigest: bundle.digest,
    loudnessReport: {
      path: normalizeRelativePath(loudnessReportPath, "loudnessReport.path"),
      sha256: loudnessReportSha256,
    },
    audioPipeline: {
      source: "current-formal-mp3-bound-by-sha256",
      decode: "pcm_s24le-wav",
      normalize: "ebu-r128-two-pass-pcm_s24le-wav",
      deliveryEncode: "single-libmp3lame-192k-encode-from-normalized-master",
      forbiddenInput: "prior-lossy-normalization-candidate",
    },
    targets: {
      integratedLufs: PROMOTED_LOUDNESS_V2_TARGET_LUFS,
      loudnessRangeLu: PROMOTED_LOUDNESS_V2_TARGET_LRA_LU,
      truePeakDbtp: PROMOTED_LOUDNESS_V2_TRUE_PEAK_DBTP,
    },
    gatePolicy: PROMOTED_LOUDNESS_V2_GATE_POLICY,
    assetCount: selected.length,
    assets: selected.map((asset) => ({
      assetId: asset.assetId,
      languageId: asset.languageId,
      text: asset.text,
      voiceName: asset.voiceName,
      voiceGender: asset.voiceGender,
      source: {
        desktopPath: asset.desktopPath,
        browserPath: asset.browserPath,
        sha256: asset.sha256,
      },
      anomaly: asset.anomaly,
      reportMeasurements: asset.reportMeasurements,
      sourceAnalysis: asset.sourceAnalysis,
      artifacts: asset.artifacts,
    })),
  };
  return { ...plan, planSha256: digestJson(plan) };
}

export function verifyImmutablePlan(document) {
  const { planSha256, ...plan } = document ?? {};
  if (!/^[a-f0-9]{64}$/u.test(planSha256 ?? "")) {
    throw new Error("Immutable plan SHA is missing or invalid");
  }
  const actual = digestJson(plan);
  if (actual !== planSha256) throw new Error("Immutable plan digest mismatch");
  if (plan.policyVersion !== PROMOTED_LOUDNESS_V2_POLICY_VERSION) {
    throw new Error("Immutable plan policy version mismatch");
  }
  if (plan.assetCount !== PROMOTED_LOUDNESS_V2_EXPECTED_ASSET_COUNT) {
    throw new Error("Immutable plan asset count mismatch");
  }
  return planSha256;
}

export function buildFfmpegStages({
  sourcePath,
  decodedWavPath,
  normalizedMasterPath,
  deliveryCandidatePath,
  sampleRate,
  channels,
  measurements,
}) {
  for (const [label, value] of Object.entries(measurements)) {
    finiteNumber(value, `measurements.${label}`);
  }
  if (!Number.isInteger(sampleRate) || sampleRate < 8_000) {
    throw new Error("sampleRate must be a valid integer");
  }
  if (!Number.isInteger(channels) || channels < 1 || channels > 2) {
    throw new Error("channels must be 1 or 2");
  }
  const filter = [
    `I=${PROMOTED_LOUDNESS_V2_TARGET_LUFS}`,
    `LRA=${PROMOTED_LOUDNESS_V2_TARGET_LRA_LU}`,
    `TP=${PROMOTED_LOUDNESS_V2_TRUE_PEAK_DBTP}`,
    `measured_I=${measurements.inputI}`,
    `measured_LRA=${measurements.inputLra}`,
    `measured_TP=${measurements.inputTp}`,
    `measured_thresh=${measurements.inputThreshold}`,
    `offset=${measurements.targetOffset}`,
    "linear=true",
    "print_format=json",
  ].join(":");
  return [
    {
      name: "decode-formal-source-to-lossless-wav",
      inputPath: sourcePath,
      outputPath: decodedWavPath,
      lossyEncodeCount: 0,
      args: [
        "-hide_banner",
        "-nostdin",
        "-n",
        "-i",
        sourcePath,
        "-map_metadata",
        "-1",
        "-vn",
        "-codec:a",
        "pcm_s24le",
        "-ar",
        String(sampleRate),
        "-ac",
        String(channels),
        decodedWavPath,
      ],
    },
    {
      name: "normalize-lossless-master",
      inputPath: decodedWavPath,
      outputPath: normalizedMasterPath,
      lossyEncodeCount: 0,
      args: [
        "-hide_banner",
        "-nostdin",
        "-n",
        "-i",
        decodedWavPath,
        "-map_metadata",
        "-1",
        "-vn",
        "-af",
        `loudnorm=${filter}`,
        "-codec:a",
        "pcm_s24le",
        "-ar",
        String(sampleRate),
        "-ac",
        String(channels),
        normalizedMasterPath,
      ],
    },
    {
      name: "encode-delivery-mp3-once",
      inputPath: normalizedMasterPath,
      outputPath: deliveryCandidatePath,
      lossyEncodeCount: 1,
      args: [
        "-hide_banner",
        "-nostdin",
        "-n",
        "-i",
        normalizedMasterPath,
        "-map_metadata",
        "-1",
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "192k",
        "-write_xing",
        "1",
        deliveryCandidatePath,
      ],
    },
  ];
}

function relativeDelta(left, right) {
  const denominator = Math.max(Math.abs(left), 1e-9);
  return Math.abs(left - right) / denominator;
}

function siSdrValue(metric, label) {
  if (metric?.infinite === true) return Number.POSITIVE_INFINITY;
  return finiteNumber(metric?.valueDb, label);
}

function validateSpectrum({
  left,
  right,
  prefix,
  relativeLimit,
  flatnessLimit,
  reasons,
}) {
  for (const key of ["centroidHz", "spreadHz", "rolloffHz"]) {
    const delta = relativeDelta(
      finiteNumber(left[key], `${prefix}.left.${key}`),
      finiteNumber(right[key], `${prefix}.right.${key}`),
    );
    if (delta > relativeLimit) {
      reasons.push(
        `${prefix} ${key} relative delta ${delta.toFixed(4)} exceeds ${relativeLimit}`,
      );
    }
  }
  const flatnessDelta = Math.abs(
    finiteNumber(left.flatness, `${prefix}.left.flatness`) -
      finiteNumber(right.flatness, `${prefix}.right.flatness`),
  );
  if (flatnessDelta > flatnessLimit) {
    reasons.push(
      `${prefix} flatness delta ${flatnessDelta.toFixed(4)} exceeds ${flatnessLimit}`,
    );
  }
}

export function validateV2CandidateQuality({
  source,
  decoded,
  master,
  delivery,
  sourceMasterSiSdr,
  masterDeliverySiSdr,
  policy = PROMOTED_LOUDNESS_V2_GATE_POLICY,
}) {
  const reasons = [];
  const sourceDuration = finiteNumber(
    source.probe.durationSeconds,
    "source duration",
  );
  const decodedDuration = finiteNumber(
    decoded.probe.durationSeconds,
    "decoded duration",
  );
  const masterDuration = finiteNumber(
    master.probe.durationSeconds,
    "master duration",
  );
  const deliveryDuration = finiteNumber(
    delivery.probe.durationSeconds,
    "delivery duration",
  );
  if (
    Math.abs(decodedDuration - sourceDuration) >
    policy.maximumMasterDurationDeltaSeconds
  ) {
    reasons.push("decoded WAV duration differs from the formal source");
  }
  if (
    Math.abs(masterDuration - sourceDuration) >
    policy.maximumMasterDurationDeltaSeconds
  ) {
    reasons.push("normalized master duration differs from the formal source");
  }
  if (
    Math.abs(deliveryDuration - masterDuration) >
    policy.maximumDeliveryDurationDeltaSeconds
  ) {
    reasons.push("delivery MP3 duration differs from the normalized master");
  }
  if (
    decoded.probe.codecName !== "pcm_s24le" ||
    master.probe.codecName !== "pcm_s24le"
  ) {
    reasons.push("lossless WAV stages are not 24-bit PCM");
  }
  if (delivery.probe.codecName !== "mp3")
    reasons.push("delivery candidate is not MP3");
  for (const [label, analysis, tolerance] of [
    ["master", master, policy.masterLoudnessToleranceLu],
    ["delivery", delivery, policy.deliveryLoudnessToleranceLu],
  ]) {
    const loudness = finiteNumber(
      analysis.loudness.integratedLufs,
      `${label} loudness`,
    );
    const truePeak = finiteNumber(
      analysis.loudness.truePeakDbtp,
      `${label} true peak`,
    );
    if (Math.abs(loudness - PROMOTED_LOUDNESS_V2_TARGET_LUFS) > tolerance) {
      reasons.push(`${label} integrated loudness is outside tolerance`);
    }
    if (truePeak > policy.maximumTruePeakDbtp) {
      reasons.push(`${label} true peak exceeds the ceiling`);
    }
    if (
      finiteNumber(analysis.timeDomain.peakLevelDbfs, `${label} sample peak`) >
      policy.maximumSamplePeakDbfs
    ) {
      reasons.push(`${label} sample peak exceeds the clipping guard`);
    }
    for (const key of ["nanCount", "infiniteCount", "denormalCount"]) {
      if (finiteNumber(analysis.timeDomain[key], `${label}.${key}`) !== 0) {
        reasons.push(`${label} contains invalid PCM samples (${key})`);
      }
    }
    const silence = analysis.silence;
    if (
      finiteNumber(silence.ratio, `${label}.silence.ratio`) >
      policy.maximumSilenceRatio
    ) {
      reasons.push(`${label} silence ratio is excessive`);
    }
    if (
      finiteNumber(silence.leadingSeconds, `${label}.silence.leadingSeconds`) >
        policy.maximumEdgeSilenceSeconds ||
      finiteNumber(
        silence.trailingSeconds,
        `${label}.silence.trailingSeconds`,
      ) > policy.maximumEdgeSilenceSeconds
    ) {
      reasons.push(`${label} edge silence is excessive`);
    }
  }
  if (
    Math.abs(
      finiteNumber(master.silence.totalSeconds, "master silence") -
        finiteNumber(delivery.silence.totalSeconds, "delivery silence"),
    ) > policy.maximumMasterDeliverySilenceDeltaSeconds
  ) {
    reasons.push("delivery encoding changed detected silence excessively");
  }
  validateSpectrum({
    left: source.spectrum,
    right: master.spectrum,
    prefix: "source/master spectrum",
    relativeLimit: policy.maximumMasterSpectrumRelativeDelta,
    flatnessLimit: policy.maximumMasterFlatnessAbsoluteDelta,
    reasons,
  });
  validateSpectrum({
    left: master.spectrum,
    right: delivery.spectrum,
    prefix: "master/delivery spectrum",
    relativeLimit: policy.maximumDeliverySpectrumRelativeDelta,
    flatnessLimit: policy.maximumDeliveryFlatnessAbsoluteDelta,
    reasons,
  });
  if (
    siSdrValue(sourceMasterSiSdr, "source/master SI-SDR") <
    policy.minimumSourceMasterSiSdrDb
  ) {
    reasons.push("source/master SI-SDR is below the fidelity threshold");
  }
  if (
    siSdrValue(masterDeliverySiSdr, "master/delivery SI-SDR") <
    policy.minimumMasterDeliverySiSdrDb
  ) {
    reasons.push("master/delivery SI-SDR is below the fidelity threshold");
  }
  return { passed: reasons.length === 0, reasons };
}
