export type RecordingQualitySeverity = "blocker" | "warning" | "info";

export type RecordingQualityIssueCode =
  | "decode-failed"
  | "too-short"
  | "silent"
  | "very-low-level"
  | "low-level"
  | "clipping"
  | "long-silence";

export interface RecordingQualityIssue {
  code: RecordingQualityIssueCode;
  severity: RecordingQualitySeverity;
  title: string;
  detail: string;
}

export interface RecordingQualityReport {
  durationMs: number;
  peak: number;
  rms: number;
  silentRatio: number;
  clippedRatio: number;
  canSubmit: boolean;
  score: number;
  issues: RecordingQualityIssue[];
}

export interface AnalyzeRecordingQualityOptions {
  minDurationMs?: number;
  expectedMode?: "word" | "sentence" | "paragraph";
}

export interface RecordingQualityMetricsInput
  extends AnalyzeRecordingQualityOptions {
  durationMs: number;
  peak: number;
  rms: number;
  silentRatio: number;
  clippedRatio: number;
}

const DEFAULT_MIN_DURATION_MS = 500;

function issue(
  code: RecordingQualityIssueCode,
  severity: RecordingQualitySeverity,
  title: string,
  detail: string,
): RecordingQualityIssue {
  return { code, severity, title, detail };
}

function channelData(buffer: AudioBuffer): Float32Array {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  if (channels.length === 1) return channels[0];

  const length = channels[0]?.length ?? 0;
  const mixed = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    mixed[i] =
      channels.reduce((sum, channel) => sum + (channel[i] ?? 0), 0) /
      channels.length;
  }
  return mixed;
}

function metrics(samples: Float32Array): {
  peak: number;
  rms: number;
  silentRatio: number;
  clippedRatio: number;
} {
  if (samples.length === 0) {
    return { peak: 0, rms: 0, silentRatio: 1, clippedRatio: 0 };
  }

  let peak = 0;
  let sumSquares = 0;
  let silent = 0;
  let clipped = 0;

  for (const sample of samples) {
    const abs = Math.abs(sample);
    peak = Math.max(peak, abs);
    sumSquares += sample * sample;
    if (abs < 0.006) silent += 1;
    if (abs > 0.985) clipped += 1;
  }

  return {
    peak,
    rms: Math.sqrt(sumSquares / samples.length),
    silentRatio: silent / samples.length,
    clippedRatio: clipped / samples.length,
  };
}

function scoreFromMetrics(
  report: Omit<RecordingQualityReport, "score">,
): number {
  let score = 100;
  for (const item of report.issues) {
    if (item.severity === "blocker") score -= 80;
    if (item.severity === "warning") score -= 18;
    if (item.severity === "info") score -= 6;
  }
  if (report.peak < 0.08) score -= 12;
  if (report.silentRatio > 0.45) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildIssues({
  durationMs,
  peak,
  rms,
  silentRatio,
  clippedRatio,
  minDurationMs,
  expectedMode,
}: {
  durationMs: number;
  peak: number;
  rms: number;
  silentRatio: number;
  clippedRatio: number;
  minDurationMs: number;
  expectedMode: AnalyzeRecordingQualityOptions["expectedMode"];
}): RecordingQualityIssue[] {
  const issues: RecordingQualityIssue[] = [];

  if (durationMs < minDurationMs) {
    issues.push(
      issue(
        "too-short",
        "blocker",
        "录音太短",
        "这段录音短到无法稳定评分，请至少完整读出目标词或句子。",
      ),
    );
  }

  if (peak < 0.012 || rms < 0.0025) {
    issues.push(
      issue(
        "silent",
        "blocker",
        "几乎没有声音",
        "系统没有检测到有效语音，请检查麦克风或靠近一点再录。",
      ),
    );
  } else if (peak < 0.04 || rms < 0.008) {
    issues.push(
      issue(
        "very-low-level",
        "blocker",
        "音量过低",
        "声音太小，Azure 很可能无法对齐文本，请靠近麦克风重录。",
      ),
    );
  } else if (peak < 0.08 || rms < 0.014) {
    issues.push(
      issue(
        "low-level",
        "warning",
        "音量偏低",
        "可以评分，但分数可能偏低；下次靠近麦克风或说得更稳一点。",
      ),
    );
  }

  if (clippedRatio > 0.012) {
    issues.push(
      issue(
        "clipping",
        "warning",
        "可能有爆音",
        "录音峰值过高，个别辅音可能被压扁；下次离麦克风稍远一点。",
      ),
    );
  }

  if (silentRatio > 0.68 && expectedMode !== "word") {
    issues.push(
      issue(
        "long-silence",
        "warning",
        "静音比例偏高",
        "句子里停顿太长可能影响流利度评分；下次分块读，但不要每个词都停。",
      ),
    );
  } else if (silentRatio > 0.82) {
    issues.push(
      issue(
        "long-silence",
        "warning",
        "静音太多",
        "录音里大部分时间没有语音，评分可能不稳定。",
      ),
    );
  }

  return issues;
}

async function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) throw new Error("AudioContext is not available");
  const context = new AudioContextClass();
  try {
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await context.close();
  }
}

export async function analyzeRecordingQuality(
  blob: Blob,
  options: AnalyzeRecordingQualityOptions = {},
): Promise<RecordingQualityReport> {
  try {
    const buffer = await decodeAudio(blob);
    const samples = channelData(buffer);
    const sampleMetrics = metrics(samples);
    return buildRecordingQualityReportFromMetrics({
      durationMs: Math.round(buffer.duration * 1000),
      ...sampleMetrics,
      ...options,
    });
  } catch {
    return {
      durationMs: 0,
      peak: 0,
      rms: 0,
      silentRatio: 1,
      clippedRatio: 0,
      canSubmit: false,
      score: 0,
      issues: [
        issue(
          "decode-failed",
          "blocker",
          "音频无法读取",
          "录音文件无法解码，请重新录一次。",
        ),
      ],
    };
  }
}

export function buildRecordingQualityReportFromMetrics({
  durationMs,
  peak,
  rms,
  silentRatio,
  clippedRatio,
  minDurationMs = DEFAULT_MIN_DURATION_MS,
  expectedMode,
}: RecordingQualityMetricsInput): RecordingQualityReport {
  const issues = buildIssues({
    durationMs,
    peak,
    rms,
    silentRatio,
    clippedRatio,
    minDurationMs,
    expectedMode,
  });
  const canSubmit = !issues.some((item) => item.severity === "blocker");
  const reportWithoutScore = {
    durationMs,
    peak,
    rms,
    silentRatio,
    clippedRatio,
    canSubmit,
    issues,
  };

  return {
    ...reportWithoutScore,
    score: scoreFromMetrics(reportWithoutScore),
  };
}
