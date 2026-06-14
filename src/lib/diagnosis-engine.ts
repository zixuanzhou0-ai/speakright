import {
  type AssessmentEvidenceAnalysis,
  analyzeAssessmentEvidence,
  summarizeAssessmentAnalyses,
} from "@/lib/assessment-evidence-engine";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import { getErrorPatternIdsForIssue } from "@/lib/training-error-patterns";
import { buildTrainingPrescription } from "@/lib/training-prescription";
import type { AssessmentWord } from "@/types/assessment";
import type { AzureAssessmentResult } from "@/types/azure";
import type {
  CoveragePassageBuildInput,
  DiagnosisBuildInput,
  DiagnosisEvidence,
  DiagnosisIssue,
  DiagnosisIssueSeverity,
  DiagnosisReport,
  RecordingQualitySnapshot,
} from "@/types/diagnosis";
import type { LanguageId } from "@/types/language";

const FINAL_CONSONANTS = new Set([
  "p",
  "b",
  "t",
  "d",
  "k",
  "g",
  "f",
  "v",
  "th",
  "dh",
  "s",
  "z",
  "l",
  "r",
  "m",
  "n",
  "ng",
]);

interface IssueRule {
  id: string;
  packId: string;
  type: DiagnosisIssue["type"];
  targetPhonemes: string[];
  triggerPhonemes: string[];
  title: string;
  suspectedSubstitution?: string;
  impact: string;
  fixCue: string;
}

const ISSUE_RULES: IssueRule[] = [
  {
    id: "ee-ih",
    packId: "ee-ih",
    type: "contrast",
    targetPhonemes: ["ee", "ih"],
    triggerPhonemes: ["ih", "ee"],
    title: "/iː/ 和 /ɪ/ 没拉开",
    suspectedSubstitution: "/ɪ/ → /iː/",
    impact: "ship/sheep、sit/seat 这类词会被听成另一个词。",
    fixCue: "/iː/ 拉长绷紧，/ɪ/ 短促放松，别用中文“衣”替代。",
  },
  {
    id: "eh-ae",
    packId: "eh-ae",
    type: "contrast",
    targetPhonemes: ["eh", "ae"],
    triggerPhonemes: ["ae", "eh"],
    title: "/æ/ 开口不够",
    suspectedSubstitution: "/æ/ → /e/",
    impact: "bad/man/sat 会听起来像 bed/men/set。",
    fixCue: "下巴往下打开，舌头压平贴近下齿，像打哈欠的起始动作。",
  },
  {
    id: "s-th",
    packId: "s-th",
    type: "contrast",
    targetPhonemes: ["th"],
    triggerPhonemes: ["th"],
    title: "/θ/ 容易读成 /s/",
    suspectedSubstitution: "/θ/ → /s/",
    impact: "think、three、mouth 的辨识度会明显下降。",
    fixCue: "舌尖伸到齿间，气流从舌尖和齿缝摩擦出去。",
  },
  {
    id: "z-dh",
    packId: "z-dh",
    type: "contrast",
    targetPhonemes: ["dh"],
    triggerPhonemes: ["dh"],
    title: "/ð/ 容易读成 /z/ 或 /d/",
    suspectedSubstitution: "/ð/ → /z/",
    impact: "this、the、father 会带明显中文口音。",
    fixCue: "舌尖齿间轻触，同时让声带振动。",
  },
  {
    id: "v-w",
    packId: "v-w",
    type: "contrast",
    targetPhonemes: ["v", "w"],
    triggerPhonemes: ["v", "w"],
    title: "/v/ 和 /w/ 混在一起",
    suspectedSubstitution: "/v/ ↔ /w/",
    impact: "very/wary、voice/water 会听起来含混。",
    fixCue: "/v/ 用上齿轻碰下唇，/w/ 用双唇收圆向前推。",
  },
  {
    id: "l-r",
    packId: "l-r",
    type: "contrast",
    targetPhonemes: ["l", "r"],
    triggerPhonemes: ["l", "r"],
    title: "/l/ 和 /r/ 区分不稳定",
    suspectedSubstitution: "/r/ ↔ /l/",
    impact: "light/right、glass/grass 会被听错，词尾 L 也容易丢。",
    fixCue: "/l/ 舌尖碰齿龈，/r/ 舌头卷起悬空不碰上颚。",
  },
  {
    id: "oo-uh",
    packId: "oo-uh",
    type: "contrast",
    targetPhonemes: ["oo", "uh"],
    triggerPhonemes: ["oo", "uh"],
    title: "/uː/ 和 /ʊ/ 时长不清楚",
    suspectedSubstitution: "/ʊ/ → /uː/",
    impact: "look/Luke、pull/pool 会靠上下文猜。",
    fixCue: "/uː/ 圆唇拉长，/ʊ/ 少圆唇、短促收住。",
  },
  {
    id: "n-ng",
    packId: "n-ng",
    type: "contrast",
    targetPhonemes: ["n", "ng"],
    triggerPhonemes: ["n", "ng"],
    title: "前后鼻音不稳",
    suspectedSubstitution: "/ŋ/ → /n/",
    impact: "sing、long、language 的结尾会不清楚。",
    fixCue: "/n/ 舌尖抵齿龈，/ŋ/ 舌根抬起贴软腭。",
  },
];

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function severityFromScore(score: number): DiagnosisIssueSeverity {
  if (score < 60) return "critical";
  if (score < 75) return "major";
  return "minor";
}

function collectPhonemes(
  result: AzureAssessmentResult,
  label: string,
  source: DiagnosisEvidence["source"],
  phonemeBuckets: Record<string, number[]>,
  rawEvidence: DiagnosisEvidence[],
  languageId: LanguageId,
  referenceText = label,
  recordingQuality?: RecordingQualitySnapshot,
): AssessmentEvidenceAnalysis {
  const analysis = analyzeAssessmentEvidence({
    result,
    referenceText,
    label,
    source,
    languageId,
    recordingQuality,
  });

  if (!analysis.usable) {
    rawEvidence.push({
      text: label,
      score: Math.round(
        Math.min(analysis.audioQuality.score, analysis.alignment.score),
      ),
      detail: `这段录音未进入诊断：${analysis.invalidationReason ?? "证据不可用"}`,
      source,
      evidenceStrength: "invalid",
      recommendedAction: "request-retry",
      invalidationReason: analysis.invalidationReason,
    });
    return analysis;
  }

  for (const token of analysis.tokens.filter((item) => item.valid)) {
    if (!phonemeBuckets[token.phoneme]) phonemeBuckets[token.phoneme] = [];
    phonemeBuckets[token.phoneme].push(token.score);

    if (token.score < 85) {
      const finalHint =
        token.position === "final" && FINAL_CONSONANTS.has(token.phoneme)
          ? "，且这个音在词尾，可能存在吞尾或加元音"
          : "";
      const phonemeSummary = analysis.phonemeEvidence[token.phoneme];
      rawEvidence.push({
        text: token.text || label,
        score: token.score,
        detail: `${token.text || label} 中的 ${token.ipa} 得分偏低${finalHint}`,
        phoneme: token.phoneme,
        ipa: token.ipa,
        position: token.position,
        source,
        evidenceStrength: phonemeSummary?.strength,
        recommendedAction: phonemeSummary?.recommendedAction,
      });
    }
  }

  for (const word of result.words) {
    if (word.errorType !== "None" || word.accuracyScore < 75) {
      rawEvidence.push({
        text: word.word || label,
        score: Math.round(word.accuracyScore),
        detail:
          word.errorType === "Omission"
            ? "存在漏读"
            : word.errorType === "Insertion"
              ? "存在多读"
              : word.errorType === "Mispronunciation"
                ? "整词发音被判定为读错"
                : "整词准确度偏低",
        source,
        evidenceStrength:
          word.errorType === "Omission" || word.errorType === "Insertion"
            ? "invalid"
            : analysis.recordingStrength,
        recommendedAction:
          word.errorType === "Omission" || word.errorType === "Insertion"
            ? "request-retry"
            : analysis.recommendedAction,
      });
    }
  }

  return analysis;
}

function vowelSlugsFor(languageId: LanguageId): Set<string> {
  return new Set(
    getLanguagePhonemes(languageId)
      .filter((phoneme) => phoneme.category === "vowel")
      .map((phoneme) => phoneme.slug),
  );
}

function scoreStatusForReport(
  languageId: LanguageId,
  summary: ReturnType<typeof summarizeAssessmentAnalyses>,
  phonemeScores: DiagnosisReport["phonemeScores"],
): Pick<DiagnosisReport, "scoreStatus" | "scoreStatusReason"> {
  if (languageId === "en-US") {
    return { scoreStatus: "scored" };
  }

  const mappedTokenCount = Object.values(phonemeScores).reduce(
    (sum, item) => sum + item.sampleCount,
    0,
  );
  if (
    summary.wordLevelEvidenceCount >= 4 &&
    summary.totalExpectedWords >= 4 &&
    summary.referenceMatchRatio < 0.45
  ) {
    return {
      scoreStatus: "insufficient-evidence",
      scoreStatusReason:
        "证据不足：识别文本和目标语言材料不匹配，可能漏读、乱读或读错语言，请重新测试。",
    };
  }
  if (summary.overallStrength === "invalid") {
    return {
      scoreStatus: "insufficient-evidence",
      scoreStatusReason: "证据不足：录音无效或漏读比例过高，请重新测试。",
    };
  }
  if (summary.invalidRecordings > 0) {
    return {
      scoreStatus: "insufficient-evidence",
      scoreStatusReason:
        "证据不足：存在漏读、多读或低质量录音，本次不生成综合分。",
    };
  }
  if (summary.omissionCount > 0 || summary.insertionCount > 0) {
    return {
      scoreStatus: "insufficient-evidence",
      scoreStatusReason:
        "证据不足：存在漏读或多读，本次只保留练习反馈，不生成可信综合分。",
    };
  }
  if (
    summary.wordLevelEvidenceCount < 4 ||
    summary.totalObservedWords < 4
  ) {
    return {
      scoreStatus: "insufficient-evidence",
      scoreStatusReason:
        "证据不足：Azure 返回的可用 word-level 证据太少，请先练基础词/短语后复测。",
    };
  }
  if (summary.overallStrength === "thin" || mappedTokenCount < 8) {
    return {
      scoreStatus: "insufficient-evidence",
      scoreStatusReason:
        "证据不足：Azure 返回的可用发音单位太少，本次只保留反馈并建议复测。",
    };
  }
  return { scoreStatus: "scored" };
}

function buildLanguageIssue(
  languageId: LanguageId,
  slug: string,
  score: number,
  sampleCount: number,
  rawEvidence: DiagnosisEvidence[],
): DiagnosisIssue | null {
  const unit = getLanguagePhonemes(languageId).find((item) => item.slug === slug);
  if (!unit || score >= 78) return null;
  const evidence = rawEvidence
    .filter((entry) => entry.phoneme === slug)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((entry) => ({
      text: entry.text,
      score: entry.score,
      detail: entry.detail,
    }));

  return {
    id: `${languageId}:${slug}`,
    severity: severityFromScore(score),
    type: unit.category === "prosody" ? "rhythm" : "phoneme",
    title: `${unit.ipa} 需要复测`,
    targetPhonemes: [slug],
    evidence:
      evidence.length > 0
        ? evidence
        : [
            {
              text: unit.example,
              score,
              detail: `${unit.name} 当前样本平均 ${score} 分，样本数 ${sampleCount}。`,
            },
          ],
    impact: "当前证据显示这个发音单位可能影响清晰度，但仍需更多样本确认。",
    fixCue: unit.description ?? "先听标准发音，再慢速录 2-3 个不同词复测。",
    recommendedPackIds: [],
  };
}

function buildLanguageIssues(
  languageId: LanguageId,
  phonemeScores: DiagnosisReport["phonemeScores"],
  rawEvidence: DiagnosisEvidence[],
): DiagnosisIssue[] {
  if (languageId === "en-US") return [];
  return Object.entries(phonemeScores)
    .map(([slug, value]) =>
      buildLanguageIssue(languageId, slug, value.score, value.sampleCount, rawEvidence),
    )
    .filter((issue): issue is DiagnosisIssue => issue !== null);
}

function issueFromRule(
  rule: IssueRule,
  phonemeScores: DiagnosisReport["phonemeScores"],
  rawEvidence: DiagnosisEvidence[],
): DiagnosisIssue | null {
  const matchingScores = rule.triggerPhonemes
    .map((phoneme) => phonemeScores[phoneme]?.score)
    .filter((score): score is number => score != null && score > 0);
  if (matchingScores.length === 0) return null;
  const weakestScore = Math.min(...matchingScores);
  if (weakestScore >= 82) return null;

  const evidence = rawEvidence
    .filter(
      (entry) => entry.phoneme && rule.triggerPhonemes.includes(entry.phoneme),
    )
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((entry) => ({
      text: entry.text,
      score: entry.score,
      detail: entry.detail,
    }));

  return {
    id: rule.id,
    severity: severityFromScore(weakestScore),
    type: rule.type,
    title: rule.title,
    targetPhonemes: rule.targetPhonemes,
    suspectedSubstitution: rule.suspectedSubstitution,
    evidence:
      evidence.length > 0
        ? evidence
        : [
            {
              text: rule.targetPhonemes.join(", "),
              score: weakestScore,
              detail: `${rule.title}，当前样本平均 ${weakestScore} 分`,
            },
          ],
    impact: rule.impact,
    fixCue: rule.fixCue,
    recommendedPackIds: [rule.packId],
  };
}

function buildFinalConsonantIssue(
  rawEvidence: DiagnosisEvidence[],
): DiagnosisIssue | null {
  const finalEvidence = rawEvidence
    .filter(
      (entry) =>
        entry.phoneme &&
        FINAL_CONSONANTS.has(entry.phoneme) &&
        entry.detail.includes("词尾"),
    )
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);

  if (finalEvidence.length < 2) return null;
  const weakest = Math.min(...finalEvidence.map((entry) => entry.score));
  return {
    id: "final-consonants",
    severity: severityFromScore(weakest),
    type: "final-consonant",
    title: "词尾辅音有吞音风险",
    targetPhonemes: ["t", "d", "k", "p", "s", "z", "l"],
    evidence: finalEvidence.map((entry) => ({
      text: entry.text,
      score: entry.score,
      detail: entry.detail,
    })),
    impact: "asked、world、help 这类词会听起来不完整，甚至改变词义。",
    fixCue: "词尾辅音短、轻、干净地收住，不要加中文式的“呃”。",
    recommendedPackIds: ["final-consonants"],
  };
}

function buildRhythmIssue(
  result: AzureAssessmentResult,
): DiagnosisIssue | null {
  const prosody = result.prosodyScore ?? 0;
  const fluency = result.fluencyScore ?? 0;
  if (Math.max(prosody, fluency) >= 82) return null;
  const score = prosody > 0 ? Math.min(prosody, fluency || prosody) : fluency;
  return {
    id: "stress-rhythm",
    severity: severityFromScore(score),
    type: prosody < 75 ? "rhythm" : "fluency",
    title: "句子节奏、弱读或连读不够自然",
    targetPhonemes: ["schwa"],
    evidence: [
      {
        text: "短文朗读",
        score: Math.round(score),
        detail: `韵律 ${prosody || "未返回"}，流利度 ${fluency || "未返回"}，说明句子层面的轻重和连接需要训练`,
      },
    ],
    impact: "即使单个音发对，句子也可能听起来像逐词朗读。",
    fixCue: "实词重读，the/to/of/a 弱读；辅音接元音要连起来说。",
    recommendedPackIds: ["stress-rhythm"],
  };
}

function buildCoverageRhythmIssue(
  recordings: CoveragePassageBuildInput["recordings"],
): DiagnosisIssue | null {
  const candidates = recordings
    .map((recording) => {
      const prosody = recording.result.prosodyScore ?? 0;
      const fluency = recording.result.fluencyScore ?? 0;
      const score =
        prosody > 0 ? Math.min(prosody, fluency || prosody) : fluency;
      return {
        label: recording.label ?? "覆盖短文朗读",
        prosody,
        fluency,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => a.score - b.score);

  const weakest = candidates.find(
    (item) => Math.max(item.prosody, item.fluency) < 82,
  );
  if (!weakest) return null;

  return {
    id: "stress-rhythm",
    severity: severityFromScore(weakest.score),
    type: weakest.prosody < 75 ? "rhythm" : "fluency",
    title: "句子节奏、弱读或连读不够自然",
    targetPhonemes: ["schwa"],
    evidence: [
      {
        text: weakest.label,
        score: Math.round(weakest.score),
        detail: `韵律 ${weakest.prosody || "未返回"}，流利度 ${
          weakest.fluency || "未返回"
        }，说明整段朗读的轻重、停顿或连接需要训练`,
      },
    ],
    impact: "单词可能能读对，但整段会听起来像逐词朗读，英语节奏感不足。",
    fixCue: "先按意群停顿，实词重读，can/to/of/and 弱读；辅音接元音要连起来。",
    recommendedPackIds: ["stress-rhythm"],
  };
}

function evidenceStrength(
  issue: DiagnosisIssue,
  phonemeScores: DiagnosisReport["phonemeScores"],
): "thin" | "fair" | "strong" {
  if (
    issue.type === "rhythm" ||
    issue.type === "stress" ||
    issue.type === "fluency" ||
    issue.type === "connected-speech"
  ) {
    return issue.evidence.length >= 2 ? "strong" : "fair";
  }
  const sampleCount = issue.targetPhonemes.reduce(
    (sum, phoneme) => sum + (phonemeScores[phoneme]?.sampleCount ?? 0),
    0,
  );
  const evidenceScores = issue.evidence.map((entry) => entry.score);
  const spread =
    evidenceScores.length > 1
      ? Math.max(...evidenceScores) - Math.min(...evidenceScores)
      : 100;
  const repeatsAcrossWords = new Set(issue.evidence.map((entry) => entry.text))
    .size;
  const stableLowPattern =
    evidenceScores.length >= 2 && spread <= 18 && avg(evidenceScores) < 78;

  if (
    sampleCount >= 5 &&
    issue.evidence.length >= 3 &&
    repeatsAcrossWords >= 2 &&
    stableLowPattern
  ) {
    return "strong";
  }
  if (sampleCount >= 2 || issue.evidence.length >= 2 || stableLowPattern)
    return "fair";
  return "thin";
}

function confidenceFromStrength(
  strength: "thin" | "fair" | "strong",
): "low" | "medium" | "high" {
  if (strength === "strong") return "high";
  if (strength === "fair") return "medium";
  return "low";
}

function nextLessonForIssue(
  issue: DiagnosisIssue,
): DiagnosisIssue["nextLesson"] {
  const packId = issue.recommendedPackIds[0];
  if (!packId) return undefined;
  const levelId =
    issue.type === "contrast"
      ? "perception-abx"
      : issue.type === "rhythm" ||
          issue.type === "stress" ||
          issue.type === "connected-speech"
        ? "shadowing-transfer"
        : issue.type === "final-consonant"
          ? "word-ladder"
          : "articulation";
  return {
    packId,
    levelId,
    reason:
      issue.type === "contrast"
        ? "先确认能听出差异，再进入口型和录音。"
        : "先从最小动作开始修正，避免直接句子里硬练。",
  };
}

function enrichIssue(
  issue: DiagnosisIssue,
  phonemeScores: DiagnosisReport["phonemeScores"],
): DiagnosisIssue {
  const strength = evidenceStrength(issue, phonemeScores);
  return {
    ...issue,
    confidence: confidenceFromStrength(strength),
    evidenceStrength: strength,
    errorPatternIds: getErrorPatternIdsForIssue(issue),
    nextLesson: nextLessonForIssue(issue),
  };
}

export function buildDiagnosisReport({
  languageId = "en-US",
  wordRecordings,
  paragraphResult,
  paragraphText,
  paragraphRecordingQuality,
}: DiagnosisBuildInput): DiagnosisReport {
  const phonemeBuckets: Record<string, number[]> = {};
  const rawEvidence: DiagnosisEvidence[] = [];
  const analyses: AssessmentEvidenceAnalysis[] = [];
  const usableWordRecordings: typeof wordRecordings = [];

  for (const recording of wordRecordings) {
    const analysis = collectPhonemes(
      recording.result,
      recording.prompt.word,
      recording.source,
      phonemeBuckets,
      rawEvidence,
      languageId,
      recording.prompt.word,
      recording.recordingQuality,
    );
    analyses.push(analysis);
    if (analysis.usable) usableWordRecordings.push(recording);
  }
  const paragraphAnalysis = collectPhonemes(
    paragraphResult,
    "短文朗读",
    "paragraph",
    phonemeBuckets,
    rawEvidence,
    languageId,
    paragraphText,
    paragraphRecordingQuality,
  );
  analyses.push(paragraphAnalysis);
  const usableParagraphResult = paragraphAnalysis.usable
    ? paragraphResult
    : null;

  const phonemeScores: DiagnosisReport["phonemeScores"] = {};
  for (const [slug, scores] of Object.entries(phonemeBuckets)) {
    phonemeScores[slug] = { score: avg(scores), sampleCount: scores.length };
  }

  const languageVowels = vowelSlugsFor(languageId);
  const vowelScores = Object.entries(phonemeScores)
    .filter(([slug]) => languageVowels.has(slug))
    .map(([, value]) => value.score);
  const consonantScores = Object.entries(phonemeScores)
    .filter(([slug]) => !languageVowels.has(slug))
    .map(([, value]) => value.score);
  const syllableScores = [
    ...usableWordRecordings.flatMap((recording) =>
      recording.result.words.flatMap((word) =>
        word.syllables.map((syllable) => syllable.accuracyScore),
      ),
    ),
    ...(usableParagraphResult?.words.flatMap((word) =>
      word.syllables.map((syllable) => syllable.accuracyScore),
    ) ?? []),
  ];
  const fluencyScores = [
    ...usableWordRecordings.map((recording) => recording.result.fluencyScore),
    usableParagraphResult?.fluencyScore ?? 0,
  ].filter((score) => score > 0);

  const dimensions = {
    vowels: avg(vowelScores),
    consonants: avg(consonantScores),
    stress: avg(syllableScores),
    rhythm: usableParagraphResult
      ? Math.round(
          usableParagraphResult.prosodyScore ??
            usableParagraphResult.fluencyScore,
        )
      : avg(fluencyScores),
    fluency: avg(fluencyScores),
    connectedSpeech: usableParagraphResult
      ? avg([
          usableParagraphResult.prosodyScore ??
            usableParagraphResult.fluencyScore,
          usableParagraphResult.fluencyScore,
        ])
      : avg(fluencyScores),
  };
  const allPhonemeScores = Object.values(phonemeScores).map(
    (item) => item.score,
  );
  const evidenceSummary = summarizeAssessmentAnalyses(analyses);
  const scoreStatus = scoreStatusForReport(
    languageId,
    evidenceSummary,
    phonemeScores,
  );
  const calculatedOverallScore = avg(
    [avg(allPhonemeScores), dimensions.fluency, dimensions.rhythm].filter(
      (score) => score > 0,
    ),
  );
  const overallScore =
    scoreStatus.scoreStatus === "scored" ? calculatedOverallScore : 0;

  const languageSpecificIssues =
    languageId === "en-US"
      ? [
          ...ISSUE_RULES.map((rule) =>
            issueFromRule(rule, phonemeScores, rawEvidence),
          ).filter((issue): issue is DiagnosisIssue => issue !== null),
          buildFinalConsonantIssue(rawEvidence),
          usableParagraphResult ? buildRhythmIssue(usableParagraphResult) : null,
        ]
      : buildLanguageIssues(languageId, phonemeScores, rawEvidence);

  const issues = languageSpecificIssues
    .filter((issue): issue is DiagnosisIssue => issue !== null)
    .map((issue) => enrichIssue(issue, phonemeScores))
    .sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 6);

  return {
    version: 2,
    languageId,
    source: "quick-word-check",
    timestamp: Date.now(),
    overallScore,
    ...scoreStatus,
    dimensions,
    phonemeScores,
    issues,
    prescription: buildTrainingPrescription(issues, "diagnosis"),
    rawEvidence: rawEvidence.sort((a, b) => a.score - b.score).slice(0, 18),
    evidenceSummary,
  };
}

export function buildCoveragePassageDiagnosisReport({
  recordings,
}: CoveragePassageBuildInput): DiagnosisReport {
  const languageId: LanguageId = "en-US";
  const phonemeBuckets: Record<string, number[]> = {};
  const rawEvidence: DiagnosisEvidence[] = [];
  const analyses: AssessmentEvidenceAnalysis[] = [];
  const usableRecordings: typeof recordings = [];

  for (const recording of recordings) {
    const analysis = collectPhonemes(
      recording.result,
      recording.label ?? recording.text,
      recording.source,
      phonemeBuckets,
      rawEvidence,
      languageId,
      recording.text,
      recording.recordingQuality,
    );
    analyses.push(analysis);
    if (analysis.usable) usableRecordings.push(recording);
  }

  const phonemeScores: DiagnosisReport["phonemeScores"] = {};
  for (const [slug, scores] of Object.entries(phonemeBuckets)) {
    phonemeScores[slug] = { score: avg(scores), sampleCount: scores.length };
  }

  const results = usableRecordings.map((recording) => recording.result);
  const languageVowels = vowelSlugsFor(languageId);
  const vowelScores = Object.entries(phonemeScores)
    .filter(([slug]) => languageVowels.has(slug))
    .map(([, value]) => value.score);
  const consonantScores = Object.entries(phonemeScores)
    .filter(([slug]) => !languageVowels.has(slug))
    .map(([, value]) => value.score);
  const syllableScores = results.flatMap((result) =>
    result.words.flatMap((word) =>
      word.syllables.map((syllable) => syllable.accuracyScore),
    ),
  );
  const fluencyScores = results
    .map((result) => result.fluencyScore)
    .filter((score) => score > 0);
  const prosodyScores = results
    .map((result) => result.prosodyScore ?? 0)
    .filter((score) => score > 0);

  const dimensions = {
    vowels: avg(vowelScores),
    consonants: avg(consonantScores),
    stress: avg(syllableScores),
    rhythm: avg(prosodyScores.length > 0 ? prosodyScores : fluencyScores),
    fluency: avg(fluencyScores),
    connectedSpeech: avg([...prosodyScores, ...fluencyScores]),
  };
  const allPhonemeScores = Object.values(phonemeScores).map(
    (item) => item.score,
  );
  const evidenceSummary = summarizeAssessmentAnalyses(analyses);
  const scoreStatus = scoreStatusForReport(
    languageId,
    evidenceSummary,
    phonemeScores,
  );
  const calculatedOverallScore = avg(
    [avg(allPhonemeScores), dimensions.fluency, dimensions.rhythm].filter(
      (score) => score > 0,
    ),
  );
  const overallScore =
    scoreStatus.scoreStatus === "scored" ? calculatedOverallScore : 0;

  const issues = [
    ...ISSUE_RULES.map((rule) =>
      issueFromRule(rule, phonemeScores, rawEvidence),
    ).filter((issue): issue is DiagnosisIssue => issue !== null),
    buildFinalConsonantIssue(rawEvidence),
    buildCoverageRhythmIssue(usableRecordings),
  ]
    .filter((issue): issue is DiagnosisIssue => issue !== null)
    .map((issue) => enrichIssue(issue, phonemeScores))
    .sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 6);

  return {
    version: 2,
    languageId,
    source: "coverage-passage",
    timestamp: Date.now(),
    overallScore,
    ...scoreStatus,
    dimensions,
    phonemeScores,
    issues,
    prescription: buildTrainingPrescription(issues, "diagnosis"),
    rawEvidence: rawEvidence.sort((a, b) => a.score - b.score).slice(0, 24),
    evidenceSummary,
  };
}

export function selectAdaptiveAssessmentWords(
  report: DiagnosisReport,
  candidates: AssessmentWord[],
  usedWords: string[],
): AssessmentWord[] {
  const used = new Set(usedWords.map((word) => word.toLowerCase()));
  const weakInsufficient = Object.entries(report.phonemeScores)
    .filter(([, value]) => value.score < 76 && value.sampleCount < 2)
    .map(([slug]) => slug);
  if (weakInsufficient.length === 0) return [];

  return candidates
    .filter((candidate) => !used.has(candidate.word.toLowerCase()))
    .filter((candidate) =>
      candidate.targetPhonemes.some((phoneme) =>
        weakInsufficient.includes(phoneme),
      ),
    )
    .slice(0, 4);
}

export function getDiagnosisSummary(report: DiagnosisReport): string {
  if (report.scoreStatus === "insufficient-evidence") {
    return report.scoreStatusReason ?? "证据不足，请补测后再生成诊断结论。";
  }
  if (report.issues.length === 0) {
    return "没有明显重灾区，可以直接进入高频问题维护训练。";
  }
  const top = report.issues[0];
  return `最优先处理：${top.title}。${top.fixCue}`;
}
