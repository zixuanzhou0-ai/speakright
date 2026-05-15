import type {
  MasteryStageSnapshot,
  MasteryState,
  MasteryTaskLayer,
  PackMastery,
  TrainingLevelKind,
  TrainingSessionSummary,
} from "@/types/training";

const LAYER_ORDER: Record<MasteryTaskLayer, number> = {
  isolated: 0,
  perception: 1,
  articulation: 2,
  word: 3,
  sentence: 4,
  connected: 5,
  guided: 6,
  spontaneous: 7,
};

const STATE_ORDER: Record<MasteryState, number> = {
  unknown: 0,
  suspected: 1,
  learning: 2,
  controlled: 3,
  integrated: 4,
  retained: 5,
  transferred: 6,
};

export const LAYER_CEILINGS: Record<MasteryTaskLayer, number> = {
  isolated: 30,
  perception: 30,
  articulation: 35,
  word: 45,
  sentence: 65,
  connected: 75,
  guided: 85,
  spontaneous: 100,
};

function average(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length,
  );
}

function layerFromLevelKind(kind: TrainingLevelKind): MasteryTaskLayer {
  if (kind === "perception") return "perception";
  if (kind === "articulation" || kind === "syllable") return "articulation";
  if (kind === "word" || kind === "minimal-pair") return "word";
  if (kind === "sentence") return "sentence";
  if (kind === "shadowing" || kind === "mixed-review") return "connected";
  return "isolated";
}

function strongerLayer(
  current: MasteryTaskLayer,
  candidate: MasteryTaskLayer,
): MasteryTaskLayer {
  return LAYER_ORDER[candidate] > LAYER_ORDER[current] ? candidate : current;
}

export function highestPassedLayer(
  session: TrainingSessionSummary,
): MasteryTaskLayer {
  let layer: MasteryTaskLayer = "isolated";

  for (const level of session.levelSummaries ?? []) {
    if (!level.passed) continue;
    layer = strongerLayer(layer, layerFromLevelKind(level.kind));
  }

  for (const transfer of session.transferEvidence ?? []) {
    if (!transfer.passed) continue;
    layer = strongerLayer(layer, transfer.layer);
  }

  if (
    layer === "isolated" &&
    session.perceptionTotal > 0 &&
    session.perceptionCorrect > 0
  ) {
    layer = "perception";
  }

  if (
    layer === "isolated" &&
    (session.wordScores.length > 0 || session.targetScores.length > 0)
  ) {
    layer = "word";
  }

  if (layer === "isolated" && session.sentenceScores.length > 0) {
    layer = "sentence";
  }

  return layer;
}

function stateFromLayer(layer: MasteryTaskLayer): MasteryState {
  if (layer === "spontaneous") return "transferred";
  if (layer === "guided") return "retained";
  if (layer === "connected" || layer === "sentence") return "integrated";
  if (layer === "word") return "controlled";
  if (layer === "perception" || layer === "articulation") return "learning";
  return "suspected";
}

function nextLayerAfter(layer: MasteryTaskLayer): MasteryTaskLayer {
  if (layer === "isolated") return "perception";
  if (layer === "perception") return "articulation";
  if (layer === "articulation") return "word";
  if (layer === "word") return "sentence";
  if (layer === "sentence") return "connected";
  if (layer === "connected") return "guided";
  if (layer === "guided") return "spontaneous";
  return "spontaneous";
}

function downgradeState(state: MasteryState): MasteryState {
  if (state === "transferred") return "retained";
  if (state === "retained") return "integrated";
  if (state === "integrated") return "controlled";
  if (state === "controlled") return "learning";
  if (state === "learning") return "suspected";
  return state;
}

function layerForState(state: MasteryState): MasteryTaskLayer {
  if (state === "transferred") return "spontaneous";
  if (state === "retained") return "guided";
  if (state === "integrated") return "connected";
  if (state === "controlled") return "sentence";
  if (state === "learning") return "word";
  return "perception";
}

function betterState(a: MasteryState, b: MasteryState): MasteryState {
  return STATE_ORDER[a] >= STATE_ORDER[b] ? a : b;
}

function sessionScore(session: TrainingSessionSummary): number {
  return average([
    ...session.targetScores,
    ...session.wordScores,
    ...session.sentenceScores,
    ...(session.mixedReviewScores ?? []),
    ...(session.transferEvidence ?? []).map((item) => item.score),
  ]);
}

function isRetainedReview(
  existing: PackMastery | undefined,
  session: TrainingSessionSummary,
  mastered: boolean,
): boolean {
  if (!mastered) return false;
  if (session.isReviewSession) return true;
  if (existing?.status === "mastered" && existing.nextReviewAt) {
    return existing.nextReviewAt <= session.completedAt;
  }
  return false;
}

export function evaluateMasteryStage(
  existing: PackMastery | undefined,
  session: TrainingSessionSummary,
  mastered: boolean,
  failureStreak: number,
): MasteryStageSnapshot {
  const layer = highestPassedLayer(session);
  let state = stateFromLayer(layer);

  if (isRetainedReview(existing, session, mastered)) {
    state = betterState(state, "retained");
  }
  if (mastered && state === "controlled") {
    state = "integrated";
  }

  if (!mastered && failureStreak >= 2 && existing?.masteryState) {
    state = downgradeState(existing.masteryState);
  }

  const stageCeiling = LAYER_CEILINGS[layer];
  const rawScore = sessionScore(session);
  const stageScore = Math.min(stageCeiling, rawScore || stageCeiling);
  const nextRequiredLayer =
    state === "transferred"
      ? "spontaneous"
      : nextLayerAfter(layerForState(state));
  const rationale =
    failureStreak >= 2 && existing?.masteryState && !mastered
      ? `连续 ${failureStreak} 次未过线，从 ${existing.masteryState} 降级到 ${state}`
      : mastered
        ? `本轮达到 ${layer} 层级，通过状态为 ${state}`
        : `本轮最高证据层级是 ${layer}，下一步进入 ${nextRequiredLayer}`;

  return {
    state,
    stageScore,
    stageCeiling,
    highestLayer: layer,
    nextRequiredLayer,
    rationale,
  };
}
