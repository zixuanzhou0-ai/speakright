import { toIpa } from "@/lib/azure-phoneme-map";
import type { AzureAssessmentResult, AzureWord } from "@/types/azure";
import type {
  DiagnosisEvidence,
  DiagnosisEvidenceSummary,
  EvidenceRecommendedAction,
  EvidenceStrength,
  RecordingQualitySnapshot,
} from "@/types/diagnosis";

export interface EvidenceQualityCheck {
  score: number;
  tier: "poor" | "fair" | "good";
  invalid: boolean;
  reasons: string[];
}

export interface EvidenceToken {
  text: string;
  score: number;
  phoneme: string;
  ipa: string;
  position: "initial" | "medial" | "final" | "unknown";
  source: DiagnosisEvidence["source"];
  valid: boolean;
  invalidationReason?: string;
}

export interface PhonemeEvidenceSummary {
  phoneme: string;
  score: number;
  sampleCount: number;
  lowTokenCount: number;
  contextCount: number;
  scoreSpread: number;
  strength: EvidenceStrength;
  confidence: "low" | "medium" | "high";
  recommendedAction: EvidenceRecommendedAction;
}

export interface AssessmentEvidenceAnalysis {
  label: string;
  source: DiagnosisEvidence["source"];
  referenceText: string;
  audioQuality: EvidenceQualityCheck;
  alignment: EvidenceQualityCheck & {
    expectedWordCount: number;
    observedWordCount: number;
    miscueRate: number;
    omissionCount: number;
    insertionCount: number;
    mispronunciationCount: number;
  };
  usable: boolean;
  invalidationReason?: string;
  tokens: EvidenceToken[];
  phonemeEvidence: Record<string, PhonemeEvidenceSummary>;
  recordingStrength: EvidenceStrength;
  recommendedAction: EvidenceRecommendedAction;
  notes: string[];
}

interface AnalyzeAssessmentEvidenceInput {
  result: AzureAssessmentResult;
  referenceText: string;
  label: string;
  source: DiagnosisEvidence["source"];
  recordingQuality?: RecordingQualitySnapshot;
}

const AZURE_TO_SLUG: Record<string, string> = {
  iy: "ee",
  ih: "ih",
  ey: "ey",
  eh: "eh",
  ae: "ae",
  aa: "ah",
  ao: "aw",
  ow: "oh",
  uh: "uh",
  uw: "oo",
  ah: "uh2",
  ax: "schwa",
  er: "er",
  ay: "ai",
  aw: "au",
  oy: "oi",
  p: "p",
  b: "b",
  t: "t",
  d: "d",
  k: "k",
  g: "g",
  f: "f",
  v: "v",
  th: "th",
  dh: "dh",
  s: "s",
  z: "z",
  sh: "sh",
  zh: "zh",
  ch: "ch",
  jh: "dj",
  m: "m",
  n: "n",
  ng: "ng",
  l: "l",
  r: "r",
  w: "w",
  y: "y",
  hh: "h",
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function wordsIn(text: string): string[] {
  return text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
}

function tierFromScore(score: number): EvidenceQualityCheck["tier"] {
  if (score < 55) return "poor";
  if (score < 78) return "fair";
  return "good";
}

function actionFromStrength(
  strength: EvidenceStrength,
): EvidenceRecommendedAction {
  if (strength === "invalid") return "request-retry";
  if (strength === "thin") return "request-more-samples";
  if (strength === "fair") return "use-with-caution";
  return "use-for-diagnosis";
}

function confidenceFromStrength(
  strength: EvidenceStrength,
): PhonemeEvidenceSummary["confidence"] {
  if (strength === "strong") return "high";
  if (strength === "fair") return "medium";
  return "low";
}

function positionFor(index: number, total: number): EvidenceToken["position"] {
  if (total <= 0) return "unknown";
  if (index === 0) return "initial";
  if (index === total - 1) return "final";
  return "medial";
}

function qualityFromCompleteness(
  result: AzureAssessmentResult,
  recordingQuality?: RecordingQualitySnapshot,
): EvidenceQualityCheck {
  const reasons: string[] = [];
  const wordCount = result.words.length;
  const completeness = clamp(Math.round(result.completenessScore ?? 0));
  if (wordCount === 0) reasons.push("没有识别到可评分单词");
  if (completeness < 45)
    reasons.push("完整度过低，可能漏读、静音或录音质量不稳定");
  if (completeness < 70 && completeness >= 45) {
    reasons.push("完整度偏低，诊断结论需要谨慎");
  }
  if (recordingQuality) {
    for (const issue of recordingQuality.issues) {
      reasons.push(`录音质量：${issue.title}`);
    }
  }
  const qualityScore =
    recordingQuality != null
      ? Math.min(wordCount === 0 ? 0 : completeness, recordingQuality.score)
      : wordCount === 0
        ? 0
        : completeness;

  return {
    score: qualityScore,
    tier: tierFromScore(qualityScore),
    invalid:
      wordCount === 0 ||
      completeness < 45 ||
      recordingQuality?.canSubmit === false,
    reasons,
  };
}

function alignmentFromWords(
  result: AzureAssessmentResult,
  referenceText: string,
): AssessmentEvidenceAnalysis["alignment"] {
  const expectedWordCount = Math.max(wordsIn(referenceText).length, 1);
  const observedWordCount = result.words.length;
  const omissionCount = result.words.filter(
    (word) => word.errorType === "Omission",
  ).length;
  const insertionCount = result.words.filter(
    (word) => word.errorType === "Insertion",
  ).length;
  const mispronunciationCount = result.words.filter(
    (word) => word.errorType === "Mispronunciation",
  ).length;
  const hardMiscues = omissionCount + insertionCount;
  const miscueRate =
    hardMiscues / Math.max(expectedWordCount, observedWordCount, 1);
  const wordCountDrift =
    Math.abs(expectedWordCount - observedWordCount) / expectedWordCount;
  const score = clamp(Math.round(100 - miscueRate * 85 - wordCountDrift * 35));
  const reasons: string[] = [];
  if (miscueRate > 0.35)
    reasons.push("漏读或多读比例过高，不能直接诊断发音弱点");
  if (wordCountDrift > 0.45) reasons.push("识别词数和参考文本差异过大");
  if (miscueRate > 0.15 && miscueRate <= 0.35) {
    reasons.push("有一定漏读或多读，证据强度会降低");
  }

  return {
    score,
    tier: tierFromScore(score),
    invalid: miscueRate > 0.35 || wordCountDrift > 0.45,
    reasons,
    expectedWordCount,
    observedWordCount,
    miscueRate,
    omissionCount,
    insertionCount,
    mispronunciationCount,
  };
}

function slugFromAzure(code: string): string | null {
  return AZURE_TO_SLUG[code.toLowerCase()] ?? null;
}

function validWordForEvidence(word: AzureWord): boolean {
  return word.errorType !== "Omission" && word.errorType !== "Insertion";
}

function buildTokens(
  result: AzureAssessmentResult,
  source: DiagnosisEvidence["source"],
  recordingUsable: boolean,
  invalidationReason?: string,
): EvidenceToken[] {
  const tokens: EvidenceToken[] = [];
  for (const word of result.words) {
    const wordValid = recordingUsable && validWordForEvidence(word);
    for (let index = 0; index < word.phonemes.length; index++) {
      const phoneme = word.phonemes[index];
      const slug = slugFromAzure(phoneme.phoneme);
      if (!slug) continue;
      tokens.push({
        text: word.word,
        score: Math.round(phoneme.accuracyScore),
        phoneme: slug,
        ipa: toIpa(phoneme.phoneme),
        position: positionFor(index, word.phonemes.length),
        source,
        valid: wordValid,
        invalidationReason: wordValid
          ? undefined
          : (invalidationReason ?? "该词存在漏读或多读，不能作为稳定发音证据"),
      });
    }
  }
  return tokens;
}

function summarizePhonemeEvidence(
  tokens: EvidenceToken[],
): Record<string, PhonemeEvidenceSummary> {
  const groups: Record<string, EvidenceToken[]> = {};
  for (const token of tokens.filter((item) => item.valid)) {
    groups[token.phoneme] ??= [];
    groups[token.phoneme].push(token);
  }

  const summaries: Record<string, PhonemeEvidenceSummary> = {};
  for (const [phoneme, phonemeTokens] of Object.entries(groups)) {
    const scores = phonemeTokens.map((token) => token.score);
    const score = avg(scores);
    const lowTokenCount = scores.filter((item) => item < 82).length;
    const contextCount = new Set(
      phonemeTokens.map((token) => `${token.text}:${token.position}`),
    ).size;
    const scoreSpread =
      scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 100;
    const stableLow =
      phonemeTokens.length >= 2 && lowTokenCount >= 2 && score < 78;
    const strength: EvidenceStrength =
      phonemeTokens.length >= 4 &&
      contextCount >= 2 &&
      stableLow &&
      scoreSpread <= 28
        ? "strong"
        : phonemeTokens.length >= 2 && (stableLow || score < 82)
          ? "fair"
          : "thin";

    summaries[phoneme] = {
      phoneme,
      score,
      sampleCount: phonemeTokens.length,
      lowTokenCount,
      contextCount,
      scoreSpread,
      strength,
      confidence: confidenceFromStrength(strength),
      recommendedAction: actionFromStrength(strength),
    };
  }
  return summaries;
}

function recordingStrength(
  tokens: EvidenceToken[],
  usable: boolean,
): EvidenceStrength {
  if (!usable) return "invalid";
  const validCount = tokens.filter((token) => token.valid).length;
  if (validCount >= 30) return "strong";
  if (validCount >= 10) return "fair";
  return "thin";
}

export function analyzeAssessmentEvidence({
  result,
  referenceText,
  label,
  source,
  recordingQuality,
}: AnalyzeAssessmentEvidenceInput): AssessmentEvidenceAnalysis {
  const audioQuality = qualityFromCompleteness(result, recordingQuality);
  const alignment = alignmentFromWords(result, referenceText);
  const usable = !audioQuality.invalid && !alignment.invalid;
  const invalidationReason = usable
    ? undefined
    : ([...audioQuality.reasons, ...alignment.reasons][0] ?? "证据不可用");
  const tokens = buildTokens(result, source, usable, invalidationReason);
  const phonemeEvidence = summarizePhonemeEvidence(tokens);
  const strength = recordingStrength(tokens, usable);
  const notes = [...audioQuality.reasons, ...alignment.reasons];

  return {
    label,
    source,
    referenceText,
    audioQuality,
    alignment,
    usable,
    invalidationReason,
    tokens,
    phonemeEvidence,
    recordingStrength: strength,
    recommendedAction: actionFromStrength(strength),
    notes,
  };
}

export function mergePhonemeEvidence(
  analyses: AssessmentEvidenceAnalysis[],
): Record<string, PhonemeEvidenceSummary> {
  return summarizePhonemeEvidence(
    analyses.flatMap((analysis) =>
      analysis.tokens.filter((token) => token.valid),
    ),
  );
}

export function summarizeAssessmentAnalyses(
  analyses: AssessmentEvidenceAnalysis[],
): DiagnosisEvidenceSummary {
  const usableRecordings = analyses.filter(
    (analysis) => analysis.usable,
  ).length;
  const invalidRecordings = analyses.length - usableRecordings;
  const merged = Object.values(mergePhonemeEvidence(analyses));
  const lowConfidenceFeatures = merged
    .filter((item) => item.score < 78 && item.strength === "thin")
    .map((item) => item.phoneme)
    .sort();
  const thinFeatureCount = merged.filter(
    (item) => item.strength === "thin" && item.score < 82,
  ).length;
  const totalValidTokens = analyses.flatMap((analysis) =>
    analysis.tokens.filter((token) => token.valid),
  ).length;
  const overallStrength: EvidenceStrength =
    usableRecordings === 0
      ? "invalid"
      : totalValidTokens >= 40 && invalidRecordings === 0
        ? "strong"
        : totalValidTokens >= 14
          ? "fair"
          : "thin";
  const notes = analyses.flatMap((analysis) =>
    analysis.notes.map((note) => `${analysis.label}: ${note}`),
  );

  return {
    overallStrength,
    recommendedAction:
      overallStrength === "invalid"
        ? "request-retry"
        : lowConfidenceFeatures.length > 0
          ? "request-more-samples"
          : actionFromStrength(overallStrength),
    usableRecordings,
    invalidRecordings,
    thinFeatureCount,
    lowConfidenceFeatures,
    notes: notes.slice(0, 6),
  };
}
