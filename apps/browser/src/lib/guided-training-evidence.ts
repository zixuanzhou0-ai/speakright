import type {
  EvidenceTaskType,
  LearningEvidenceV3,
  LearningLanguageId,
} from "@speakright/core/evidence/types";
import type { TrainingLevel, TrainingPack } from "@/types/training";
import { DEFAULT_CALIBRATION_VERSION } from "./learning-evidence";
import type { CourseAttemptSnapshot } from "./training-course-session";
import { hasLevelPassed } from "./training-course-session";

interface GuidedLevelEvidenceInput {
  level: TrainingLevel;
  snapshot: CourseAttemptSnapshot;
}

interface GuidedTrainingEvidenceInput {
  sessionId: string;
  languageId: LearningLanguageId;
  pack: TrainingPack;
  levels: GuidedLevelEvidenceInput[];
  createdAt: number;
}

function taskTypeFor(level: TrainingLevel): EvidenceTaskType {
  switch (level.kind) {
    case "perception":
      return "perception";
    case "articulation":
      return "articulation";
    case "minimal-pair":
      return "minimal-pair";
    case "sentence":
      return "sentence";
    case "shadowing":
      return "connected-speech";
    case "mixed-review":
      return "sentence";
    default:
      return "controlled-word";
  }
}

function statusFromValidity(
  value: boolean | undefined,
  notApplicable: boolean,
): "good" | "invalid" | "unknown" | "not-applicable" {
  if (notApplicable) return "not-applicable";
  if (value === true) return "good";
  if (value === false) return "invalid";
  return "unknown";
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

export function buildGuidedTrainingEvidence({
  sessionId,
  languageId,
  pack,
  levels,
  createdAt,
}: GuidedTrainingEvidenceInput): LearningEvidenceV3[] {
  return levels
    .filter(({ snapshot }) => snapshot.attempts > 0)
    .map(({ level, snapshot }) => {
      const passed = hasLevelPassed(level, snapshot);
      const notApplicable =
        level.kind === "perception" || level.kind === "articulation";
      const recordingStatus = statusFromValidity(
        snapshot.recordingQualityValid,
        notApplicable,
      );
      const alignmentStatus = statusFromValidity(
        snapshot.alignmentValid,
        notApplicable,
      );
      const materialIds =
        snapshot.contextIds && snapshot.contextIds.length > 0
          ? Array.from(new Set(snapshot.contextIds))
          : level.items.slice(0, snapshot.attempts).map((item) => item.id);
      const contextCount = materialIds.length;
      const sampleCount =
        snapshot.validSampleCount ??
        (notApplicable ? snapshot.attempts : snapshot.scores.length);
      const targetAverage = average(snapshot.scores);
      const observations: LearningEvidenceV3["observations"] =
        level.kind === "perception"
          ? [
              {
                metric: "perception-rate",
                score:
                  snapshot.attempts > 0
                    ? Math.round(
                        (snapshot.passedCount / snapshot.attempts) * 100,
                      )
                    : 0,
                source: "task",
              },
            ]
          : targetAverage == null
            ? [{ metric: "task-completion", source: "task" }]
            : [
                {
                  metric: "target-unit",
                  score: targetAverage,
                  source: "azure",
                },
              ];
      const evidenceStage =
        level.kind === "perception" && passed
          ? "discriminated"
          : passed &&
              (level.kind === "sentence" ||
                level.kind === "shadowing" ||
                level.kind === "mixed-review")
            ? "varied"
            : passed && !notApplicable
              ? "controlled"
              : "introduced";
      const confidence =
        passed &&
        (notApplicable ||
          (recordingStatus === "good" && alignmentStatus === "good"))
          ? "medium"
          : "low";

      return {
        id: `${sessionId}-${level.id}-aggregate`,
        version: 3,
        languageId,
        taskType: taskTypeFor(level),
        targetUnits: pack.targetPhonemes,
        observations,
        recordingQuality: {
          status: recordingStatus,
          reasons:
            recordingStatus === "not-applicable"
              ? ["This task does not use learner recording quality."]
              : recordingStatus === "good"
                ? ["All counted samples passed the recording-quality gate."]
                : [
                    "No calibrated valid recording-quality aggregate was available.",
                  ],
        },
        alignmentQuality: {
          status: alignmentStatus,
          reasons:
            alignmentStatus === "not-applicable"
              ? ["This task does not use speech alignment."]
              : alignmentStatus === "good"
                ? ["All counted samples contained target-unit alignment."]
                : ["No valid target-unit alignment aggregate was available."],
        },
        sampleCount,
        contextCount,
        source: "training",
        confidence,
        evidenceStage,
        calibrationVersion: DEFAULT_CALIBRATION_VERSION,
        createdAt,
        trace: {
          sessionId,
          levelId: level.id,
          materialIds,
          criterionKind: level.criterion.kind,
          aggregate: true,
        },
      } satisfies LearningEvidenceV3;
    });
}
