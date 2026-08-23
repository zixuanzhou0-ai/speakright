import type {
  EvidenceObservation,
  LearningEvidenceStoreV3,
  LearningEvidenceV3,
} from "./types";

const DEFAULT_MAX_EVIDENCE_ITEMS = 2000;

function isObservation(value: unknown): value is EvidenceObservation {
  if (!value || typeof value !== "object") return false;
  const observation = value as Partial<EvidenceObservation>;
  return (
    typeof observation.metric === "string" &&
    typeof observation.source === "string" &&
    (observation.score === undefined ||
      typeof observation.score === "number") &&
    (observation.text === undefined || typeof observation.text === "string")
  );
}

export function isLearningEvidenceV3(
  value: unknown,
): value is LearningEvidenceV3 {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LearningEvidenceV3>;
  return (
    item.version === 3 &&
    typeof item.id === "string" &&
    typeof item.languageId === "string" &&
    typeof item.taskType === "string" &&
    Array.isArray(item.targetUnits) &&
    item.targetUnits.every((target) => typeof target === "string") &&
    Array.isArray(item.observations) &&
    item.observations.every(isObservation) &&
    typeof item.sampleCount === "number" &&
    typeof item.contextCount === "number" &&
    typeof item.calibrationVersion === "string" &&
    typeof item.createdAt === "number"
  );
}

export function emptyLearningEvidenceStore(
  now = Date.now(),
): LearningEvidenceStoreV3 {
  return { version: 3, updatedAt: now, evidence: [] };
}

export function parseLearningEvidenceStore(
  raw: string | null | undefined,
  now = Date.now(),
): LearningEvidenceStoreV3 {
  if (!raw) return emptyLearningEvidenceStore(now);
  try {
    const parsed = JSON.parse(raw) as Partial<LearningEvidenceStoreV3>;
    if (parsed.version !== 3 || !Array.isArray(parsed.evidence)) {
      return emptyLearningEvidenceStore(now);
    }
    return {
      version: 3,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : now,
      evidence: parsed.evidence.filter(isLearningEvidenceV3),
    };
  } catch {
    return emptyLearningEvidenceStore(now);
  }
}

export function upsertLearningEvidence(
  store: LearningEvidenceStoreV3,
  evidence: LearningEvidenceV3,
  options: { now?: number; maxItems?: number } = {},
): LearningEvidenceStoreV3 {
  const maxItems = Math.max(1, options.maxItems ?? DEFAULT_MAX_EVIDENCE_ITEMS);
  return {
    version: 3,
    updatedAt: options.now ?? Date.now(),
    evidence: [
      evidence,
      ...store.evidence.filter((item) => item.id !== evidence.id),
    ].slice(0, maxItems),
  };
}

interface LegacyPack {
  masteryState?: unknown;
  bestTargetScore?: number;
  completedSessions?: number;
}

export function migrateLegacyMasteryStore(
  raw: string | null | undefined,
  now = Date.now(),
): LearningEvidenceStoreV3 | null {
  if (!raw) return null;
  try {
    const legacy = JSON.parse(raw) as {
      updatedAt?: number;
      packs?: Record<string, LegacyPack>;
    };
    if (!legacy.packs || typeof legacy.packs !== "object") return null;
    const createdAt =
      typeof legacy.updatedAt === "number" ? legacy.updatedAt : now;
    const evidence = Object.entries(legacy.packs).map(
      ([packId, pack]): LearningEvidenceV3 => ({
        id: `legacy-${packId}-${createdAt}`,
        version: 3,
        languageId: "en-US",
        taskType: "controlled-word",
        targetUnits: [packId],
        observations: [
          ...(typeof pack.bestTargetScore === "number"
            ? [
                {
                  metric: "target-unit" as const,
                  score: pack.bestTargetScore,
                  source: "legacy" as const,
                },
              ]
            : []),
          {
            metric: "task-completion",
            text:
              typeof pack.masteryState === "string"
                ? `旧版状态：${pack.masteryState}`
                : "旧版训练记录",
            source: "legacy",
          },
        ],
        recordingQuality: {
          status: "unknown",
          reasons: ["Legacy profile did not retain recording quality."],
        },
        alignmentQuality: {
          status: "unknown",
          reasons: ["Legacy profile did not retain alignment quality."],
        },
        sampleCount:
          typeof pack.completedSessions === "number"
            ? pack.completedSessions
            : 0,
        contextCount: 0,
        source: "legacy-migration",
        confidence: "low",
        evidenceStage: "introduced",
        calibrationVersion: "legacy-unvalidated",
        createdAt,
      }),
    );
    if (evidence.length === 0) return null;
    return { version: 3, updatedAt: now, evidence };
  } catch {
    return null;
  }
}
