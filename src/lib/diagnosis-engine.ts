import { toIpa } from "@/lib/azure-phoneme-map";
import { PHONEMES } from "@/lib/phoneme-data";
import { getErrorPatternIdsForIssue } from "@/lib/training-error-patterns";
import { buildTrainingPrescription } from "@/lib/training-prescription";
import type { AssessmentWord } from "@/types/assessment";
import type { AzureAssessmentResult } from "@/types/azure";
import type {
  DiagnosisBuildInput,
  DiagnosisEvidence,
  DiagnosisIssue,
  DiagnosisIssueSeverity,
  DiagnosisReport,
} from "@/types/diagnosis";

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

const VOWELS = new Set(
  PHONEMES.filter((phoneme) => phoneme.category === "vowel").map(
    (phoneme) => phoneme.slug,
  ),
);

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
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function severityFromScore(score: number): DiagnosisIssueSeverity {
  if (score < 60) return "critical";
  if (score < 75) return "major";
  return "minor";
}

function slugFromAzure(code: string): string | null {
  return AZURE_TO_SLUG[code.toLowerCase()] ?? null;
}

function collectPhonemes(
  result: AzureAssessmentResult,
  text: string,
  source: DiagnosisEvidence["source"],
  phonemeBuckets: Record<string, number[]>,
  rawEvidence: DiagnosisEvidence[],
) {
  for (const word of result.words) {
    for (let index = 0; index < word.phonemes.length; index++) {
      const phoneme = word.phonemes[index];
      const slug = slugFromAzure(phoneme.phoneme);
      if (!slug) continue;
      if (!phonemeBuckets[slug]) phonemeBuckets[slug] = [];
      phonemeBuckets[slug].push(phoneme.accuracyScore);

      if (phoneme.accuracyScore < 85) {
        const finalHint =
          index === word.phonemes.length - 1 && FINAL_CONSONANTS.has(slug)
            ? "，且这个音在词尾，可能存在吞尾或加元音"
            : "";
        rawEvidence.push({
          text: word.word || text,
          score: Math.round(phoneme.accuracyScore),
          detail: `${word.word || text} 中的 ${toIpa(phoneme.phoneme)} 得分偏低${finalHint}`,
          phoneme: slug,
          ipa: toIpa(phoneme.phoneme),
          source,
        });
      }
    }

    if (word.errorType !== "None" || word.accuracyScore < 75) {
      rawEvidence.push({
        text: word.word || text,
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
      });
    }
  }
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
    .filter((entry) => entry.phoneme && rule.triggerPhonemes.includes(entry.phoneme))
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

function buildRhythmIssue(result: AzureAssessmentResult): DiagnosisIssue | null {
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

function evidenceStrength(
  issue: DiagnosisIssue,
  phonemeScores: DiagnosisReport["phonemeScores"],
): "thin" | "fair" | "strong" {
  const sampleCount = issue.targetPhonemes.reduce(
    (sum, phoneme) => sum + (phonemeScores[phoneme]?.sampleCount ?? 0),
    0,
  );
  const evidenceScores = issue.evidence.map((entry) => entry.score);
  const spread =
    evidenceScores.length > 1
      ? Math.max(...evidenceScores) - Math.min(...evidenceScores)
      : 100;
  const repeatsAcrossWords = new Set(issue.evidence.map((entry) => entry.text)).size;
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
  if (sampleCount >= 2 || issue.evidence.length >= 2 || stableLowPattern) return "fair";
  return "thin";
}

function confidenceFromStrength(
  strength: "thin" | "fair" | "strong",
): "low" | "medium" | "high" {
  if (strength === "strong") return "high";
  if (strength === "fair") return "medium";
  return "low";
}

function nextLessonForIssue(issue: DiagnosisIssue): DiagnosisIssue["nextLesson"] {
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
  wordRecordings,
  paragraphResult,
}: DiagnosisBuildInput): DiagnosisReport {
  const phonemeBuckets: Record<string, number[]> = {};
  const rawEvidence: DiagnosisEvidence[] = [];

  for (const recording of wordRecordings) {
    collectPhonemes(
      recording.result,
      recording.prompt.word,
      recording.source,
      phonemeBuckets,
      rawEvidence,
    );
  }
  collectPhonemes(
    paragraphResult,
    "短文朗读",
    "paragraph",
    phonemeBuckets,
    rawEvidence,
  );

  const phonemeScores: DiagnosisReport["phonemeScores"] = {};
  for (const [slug, scores] of Object.entries(phonemeBuckets)) {
    phonemeScores[slug] = { score: avg(scores), sampleCount: scores.length };
  }

  const vowelScores = Object.entries(phonemeScores)
    .filter(([slug]) => VOWELS.has(slug))
    .map(([, value]) => value.score);
  const consonantScores = Object.entries(phonemeScores)
    .filter(([slug]) => !VOWELS.has(slug))
    .map(([, value]) => value.score);
  const syllableScores = [
    ...wordRecordings.flatMap((recording) =>
      recording.result.words.flatMap((word) =>
        word.syllables.map((syllable) => syllable.accuracyScore),
      ),
    ),
    ...paragraphResult.words.flatMap((word) =>
      word.syllables.map((syllable) => syllable.accuracyScore),
    ),
  ];
  const fluencyScores = [
    ...wordRecordings.map((recording) => recording.result.fluencyScore),
    paragraphResult.fluencyScore,
  ].filter((score) => score > 0);

  const dimensions = {
    vowels: avg(vowelScores),
    consonants: avg(consonantScores),
    stress: avg(syllableScores),
    rhythm: Math.round(paragraphResult.prosodyScore ?? paragraphResult.fluencyScore),
    fluency: avg(fluencyScores),
    connectedSpeech: avg([
      paragraphResult.prosodyScore ?? paragraphResult.fluencyScore,
      paragraphResult.fluencyScore,
    ]),
  };
  const allPhonemeScores = Object.values(phonemeScores).map((item) => item.score);
  const overallScore = avg([
    avg(allPhonemeScores),
    dimensions.fluency,
    dimensions.rhythm,
  ].filter((score) => score > 0));

  const issues = [
    ...ISSUE_RULES.map((rule) =>
      issueFromRule(rule, phonemeScores, rawEvidence),
    ).filter((issue): issue is DiagnosisIssue => issue !== null),
    buildFinalConsonantIssue(rawEvidence),
    buildRhythmIssue(paragraphResult),
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
    timestamp: Date.now(),
    overallScore,
    dimensions,
    phonemeScores,
    issues,
    prescription: buildTrainingPrescription(issues, "diagnosis"),
    rawEvidence: rawEvidence.sort((a, b) => a.score - b.score).slice(0, 18),
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
  if (report.issues.length === 0) {
    return "没有明显重灾区，可以直接进入高频问题维护训练。";
  }
  const top = report.issues[0];
  return `最优先处理：${top.title}。${top.fixCue}`;
}
