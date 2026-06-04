"use client";

import type {
  ErrorPatternMastery,
  MasteryProfile,
  PackMastery,
  PhonemeMastery,
  TrainingLevelProgress,
  TrainingSessionSummary,
} from "@/types/training";
import type { LanguageId } from "@/types/language";
import { getCurrentLanguageId } from "./api-keys";
import { languageScopedStorageKey } from "./language-storage";
import { evaluateMasteryStage } from "./mastery-state";
import { getTrainingPack } from "./training-packs";

export const MASTERY_STORAGE_KEY = "speakright_mastery_profile_v2";
export const TRAINING_SESSIONS_STORAGE_KEY = "speakright_training_sessions_v2";
const LEGACY_MASTERY_STORAGE_KEY = "speakright_mastery_profile_v1";

const DAY_MS = 24 * 60 * 60 * 1000;

function masteryStorageKey(languageId?: LanguageId): string {
  return languageScopedStorageKey(MASTERY_STORAGE_KEY, languageId);
}

function sessionsStorageKey(languageId?: LanguageId): string {
  return languageScopedStorageKey(TRAINING_SESSIONS_STORAGE_KEY, languageId);
}

function legacyMasteryStorageKey(languageId?: LanguageId): string {
  return languageScopedStorageKey(LEGACY_MASTERY_STORAGE_KEY, languageId);
}

export function createEmptyMasteryProfile(): MasteryProfile {
  return {
    version: 2,
    updatedAt: Date.now(),
    packs: {},
    phonemes: {},
    errorPatterns: {},
    sessions: [],
  };
}

function parseProfile(raw: string | null): MasteryProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MasteryProfile;
    if (
      parsed.version !== 2 ||
      !parsed.packs ||
      !parsed.phonemes ||
      !parsed.errorPatterns
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function migrateLegacyProfile(raw: string | null): MasteryProfile | null {
  if (!raw) return null;
  try {
    const legacy = JSON.parse(raw) as {
      version?: number;
      updatedAt?: number;
      packs?: Record<
        string,
        Omit<PackMastery, "levelProgress" | "status"> & {
          status?: PackMastery["status"] | "recommended";
        }
      >;
      phonemes?: Record<string, PhonemeMastery>;
      sessions?: TrainingSessionSummary[];
    };
    if (legacy.version !== 1 || !legacy.packs || !legacy.phonemes) return null;
    const packs: Record<string, PackMastery> = {};
    for (const [packId, mastery] of Object.entries(legacy.packs)) {
      packs[packId] = {
        ...mastery,
        status:
          !mastery.status || mastery.status === "recommended"
            ? "new"
            : mastery.status,
        levelProgress: {},
      };
    }
    return {
      version: 2,
      updatedAt: legacy.updatedAt ?? Date.now(),
      packs,
      phonemes: legacy.phonemes,
      errorPatterns: {},
      sessions: legacy.sessions ?? [],
    };
  } catch {
    return null;
  }
}

export function loadMasteryProfile(languageId?: LanguageId): MasteryProfile {
  if (typeof window === "undefined") return createEmptyMasteryProfile();
  const current = parseProfile(localStorage.getItem(masteryStorageKey(languageId)));
  if (current) return current;
  const migrated = migrateLegacyProfile(
    localStorage.getItem(legacyMasteryStorageKey(languageId)),
  );
  if (migrated) {
    saveMasteryProfile(migrated, languageId);
    return migrated;
  }
  return createEmptyMasteryProfile();
}

export function saveMasteryProfile(
  profile: MasteryProfile,
  languageId?: LanguageId,
): void {
  if (typeof window === "undefined") return;
  const nextProfile = {
    ...profile,
    version: 2 as const,
    updatedAt: Date.now(),
  };
  const profileKey = masteryStorageKey(languageId);
  localStorage.setItem(profileKey, JSON.stringify(nextProfile));
  localStorage.setItem(
    sessionsStorageKey(languageId),
    JSON.stringify(nextProfile.sessions),
  );
  window.dispatchEvent(
    new StorageEvent("storage", { key: profileKey }),
  );
}

export function isReviewDue(mastery?: PackMastery, now = Date.now()): boolean {
  return !!mastery?.nextReviewAt && mastery.nextReviewAt <= now;
}

function scoreAverage(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function evaluateSessionMastery(
  session: TrainingSessionSummary,
): boolean {
  if (
    session.assessmentReliability?.canPromoteMastery === false ||
    hasPromotionBlockers(session)
  ) {
    return false;
  }
  const pack = getTrainingPack(session.packId);
  if (!pack) return false;
  const rule = pack.masteryRule;
  const perceptionRate =
    session.perceptionTotal > 0
      ? session.perceptionCorrect / session.perceptionTotal
      : 0;
  const recentWordScores = session.wordScores.slice(-rule.wordRecentWindow);
  const wordPasses = recentWordScores.filter(
    (score) => score >= rule.targetPassScore,
  ).length;
  const sentencePasses = session.sentenceScores.filter(
    (score) => score >= rule.targetPassScore,
  ).length;
  const mixedAverage = scoreAverage(session.mixedReviewScores ?? []);
  const stuckCount = session.stuckPatternIds?.length ?? 0;
  const requiredKinds = new Set([
    "perception",
    "word",
    "sentence",
    "mixed-review",
  ]);
  const requiredLevelsPassed =
    !session.levelSummaries ||
    [...requiredKinds].every((kind) =>
      session.levelSummaries?.some(
        (level) => level.kind === kind && level.passed,
      ),
    );

  return (
    requiredLevelsPassed &&
    perceptionRate >= rule.perceptionCorrectRate &&
    wordPasses >= rule.wordRecentPasses &&
    sentencePasses >= rule.sentencePasses &&
    mixedAverage >= (rule.mixedReviewAverage ?? rule.targetPassScore) &&
    stuckCount <= (rule.maxStuckCount ?? 0)
  );
}

function nextReviewDelay(completedSessions: number): number {
  if (completedSessions <= 1) return DAY_MS;
  if (completedSessions === 2) return 3 * DAY_MS;
  if (completedSessions === 3) return 7 * DAY_MS;
  return 14 * DAY_MS;
}

function updatePhoneme(
  current: PhonemeMastery | undefined,
  phoneme: string,
  scores: number[],
): PhonemeMastery {
  const recentScores = [...(current?.recentScores ?? []), ...scores].slice(-8);
  const bestScore = Math.max(current?.bestScore ?? 0, ...scores, 0);
  const avg = scoreAverage(recentScores);
  const status =
    bestScore >= 85 && avg >= 80
      ? "mastered"
      : avg >= 72
        ? "stable"
        : avg > 0
          ? "weak"
          : "new";

  return { phoneme, bestScore, recentScores, status };
}

function buildLevelProgress(
  existing: Record<string, TrainingLevelProgress> | undefined,
  session: TrainingSessionSummary,
): Record<string, TrainingLevelProgress> {
  const progress = { ...(existing ?? {}) };
  for (const level of session.levelSummaries ?? []) {
    const current = progress[level.levelId];
    progress[level.levelId] = {
      passed: level.passed || current?.passed === true,
      bestScore: Math.max(current?.bestScore ?? 0, level.bestScore),
      attempts: (current?.attempts ?? 0) + level.attempts,
    };
  }
  return progress;
}

function hasPromotionBlockers(session: TrainingSessionSummary): boolean {
  return (session.promotionBlockers?.length ?? 0) > 0;
}

function promotionBlockerNote(
  session: TrainingSessionSummary,
): string | undefined {
  const blockers = session.promotionBlockers ?? [];
  return blockers.length > 0 ? blockers.join("；") : undefined;
}

function reliabilityAllowsPromotion(session: TrainingSessionSummary): boolean {
  return (
    session.assessmentReliability?.canPromoteMastery !== false &&
    !hasPromotionBlockers(session)
  );
}

function canUpdateProductionPhonemes(session: TrainingSessionSummary): boolean {
  return session.modality !== "perception" && session.modality !== "prosody";
}

function nonPromotingStage(
  existing: PackMastery | undefined,
  session: TrainingSessionSummary,
): ReturnType<typeof evaluateMasteryStage> {
  return {
    state:
      existing?.masteryState ??
      (session.failedItems?.length || session.stuckPatternIds?.length
        ? "learning"
        : "suspected"),
    stageScore: existing?.stageScore ?? 0,
    stageCeiling: existing?.stageCeiling ?? 30,
    highestLayer: existing?.highestLayer ?? "isolated",
    nextRequiredLayer: existing?.nextRequiredLayer ?? "perception",
    rationale:
      promotionBlockerNote(session) ??
      session.assessmentReliability?.note ??
      "本次证据可靠性不足，只作为观察记录，不提升掌握度。",
  };
}

function updateErrorPatterns(
  current: Record<string, ErrorPatternMastery>,
  session: TrainingSessionSummary,
): Record<string, ErrorPatternMastery> {
  const next = { ...current };
  const stuckIds = new Set(session.stuckPatternIds ?? []);
  for (const patternId of stuckIds) {
    const existing = next[patternId];
    const stuckCount = (existing?.stuckCount ?? 0) + 1;
    next[patternId] = {
      patternId,
      seenCount: (existing?.seenCount ?? 0) + 1,
      stuckCount,
      lastSeenAt: session.completedAt,
      status: stuckCount >= 2 ? "active" : "improving",
    };
  }
  for (const [patternId, existing] of Object.entries(next)) {
    if (!stuckIds.has(patternId) && existing.status === "active") {
      next[patternId] = { ...existing, status: "improving" };
    }
  }
  return next;
}

export function recordTrainingSession(
  profile: MasteryProfile,
  session: TrainingSessionSummary,
): MasteryProfile {
  const pack = getTrainingPack(session.packId);
  const sessionLanguageId = session.languageId ?? getCurrentLanguageId();
  const canPromote = reliabilityAllowsPromotion(session);
  const mastered = evaluateSessionMastery(session);
  const existing = profile.packs[session.packId];
  const contributesTargetScores =
    canPromote && session.modality !== "perception";
  const completedSessions = (existing?.completedSessions ?? 0) + 1;
  const bestTargetScore = Math.max(
    existing?.bestTargetScore ?? 0,
    ...(contributesTargetScores ? session.targetScores : []),
    0,
  );
  const perceptionRate =
    canPromote && session.perceptionTotal > 0
      ? session.perceptionCorrect / session.perceptionTotal
      : 0;
  const wasDueMastered =
    existing?.status === "mastered" &&
    isReviewDue(existing, session.completedAt);
  const observableFailure =
    (session.failedItems?.length ?? 0) > 0 ||
    (session.stuckPatternIds?.length ?? 0) > 0;
  const failureStreak = mastered
    ? 0
    : canPromote || observableFailure
      ? (existing?.failureStreak ?? 0) + 1
      : (existing?.failureStreak ?? 0);
  const stage = canPromote
    ? evaluateMasteryStage(existing, session, mastered, failureStreak)
    : nonPromotingStage(existing, session);
  const status: PackMastery["status"] = mastered
    ? "mastered"
    : wasDueMastered && failureStreak >= 2
      ? "practicing"
      : completedSessions > 0
        ? "practicing"
        : "new";

  const nextProfile: MasteryProfile = {
    ...profile,
    version: 2,
    updatedAt: Date.now(),
    sessions: [
      {
        ...session,
        languageId: sessionLanguageId,
        mastered,
        masteryStateAfter: stage.state,
        masteryStageScore: stage.stageScore,
        reviewItems: session.reviewItems ?? [],
      },
      ...profile.sessions,
    ].slice(0, 80),
    packs: {
      ...profile.packs,
      [session.packId]: {
        packId: session.packId,
        status,
        masteryState: stage.state,
        stageScore: stage.stageScore,
        stageCeiling: stage.stageCeiling,
        highestLayer: stage.highestLayer,
        nextRequiredLayer: stage.nextRequiredLayer,
        stateRationale: stage.rationale,
        retainedReviewCount:
          stage.state === "retained"
            ? (existing?.retainedReviewCount ?? 0) + 1
            : (existing?.retainedReviewCount ?? 0),
        transferEvidenceCount:
          (existing?.transferEvidenceCount ?? 0) +
          (canPromote
            ? (session.transferEvidence?.filter((item) => item.passed).length ??
              0)
            : 0),
        levelProgress: canPromote
          ? buildLevelProgress(existing?.levelProgress, session)
          : (existing?.levelProgress ?? {}),
        bestTargetScore,
        perceptionBestRate: Math.max(
          existing?.perceptionBestRate ?? 0,
          perceptionRate,
        ),
        completedSessions,
        failureStreak,
        lastPracticedAt: session.completedAt,
        nextReviewAt:
          mastered && canPromote
            ? session.completedAt + nextReviewDelay(completedSessions)
            : existing?.nextReviewAt,
      },
    },
    phonemes: { ...profile.phonemes },
    errorPatterns: updateErrorPatterns(profile.errorPatterns, session),
  };

  if (pack && canPromote && canUpdateProductionPhonemes(session)) {
    for (const phoneme of pack.targetPhonemes) {
      nextProfile.phonemes[phoneme] = updatePhoneme(
        profile.phonemes[phoneme],
        phoneme,
        session.targetScores,
      );
    }
  }

  return nextProfile;
}
