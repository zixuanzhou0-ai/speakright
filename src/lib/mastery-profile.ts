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
import { DEFAULT_LANGUAGE_ID } from "./language-profiles";
import { evaluateMasteryStage } from "./mastery-state";
import { getTrainingPack } from "./training-packs";

export const MASTERY_STORAGE_KEY = "speakright_mastery_profile_v2";
export const TRAINING_SESSIONS_STORAGE_KEY = "speakright_training_sessions_v2";
const LEGACY_MASTERY_STORAGE_KEY = "speakright_mastery_profile_v1";

const DAY_MS = 24 * 60 * 60 * 1000;

export function masteryStorageKey(
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): string {
  return `${MASTERY_STORAGE_KEY}:${languageId}`;
}

export function trainingSessionsStorageKey(
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): string {
  return `${TRAINING_SESSIONS_STORAGE_KEY}:${languageId}`;
}

export function createEmptyMasteryProfile(
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): MasteryProfile {
  return {
    version: 2,
    languageId,
    updatedAt: Date.now(),
    packs: {},
    phonemes: {},
    errorPatterns: {},
    sessions: [],
  };
}

function normalizeProfile(
  profile: MasteryProfile,
  languageId: LanguageId,
): MasteryProfile {
  return {
    ...profile,
    languageId,
    sessions: (profile.sessions ?? []).map((session) => ({
      ...session,
      languageId: session.languageId ?? languageId,
    })),
  };
}

function parseProfile(
  raw: string | null,
  languageId: LanguageId,
): MasteryProfile | null {
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
    if (parsed.languageId && parsed.languageId !== languageId) return null;
    return normalizeProfile(parsed, languageId);
  } catch {
    return null;
  }
}

function migrateLegacyProfile(
  raw: string | null,
  languageId: LanguageId,
): MasteryProfile | null {
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
      languageId,
      updatedAt: legacy.updatedAt ?? Date.now(),
      packs,
      phonemes: legacy.phonemes,
      errorPatterns: {},
      sessions: (legacy.sessions ?? []).map((session) => ({
        ...session,
        languageId: session.languageId ?? languageId,
      })),
    };
  } catch {
    return null;
  }
}

export function loadMasteryProfile(
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): MasteryProfile {
  if (typeof window === "undefined") return createEmptyMasteryProfile(languageId);
  const current = parseProfile(
    localStorage.getItem(masteryStorageKey(languageId)),
    languageId,
  );
  if (current) return current;
  const legacyCurrent =
    languageId === DEFAULT_LANGUAGE_ID
      ? parseProfile(localStorage.getItem(MASTERY_STORAGE_KEY), languageId)
      : null;
  if (legacyCurrent) {
    saveMasteryProfile(legacyCurrent, languageId);
    return legacyCurrent;
  }
  const migrated =
    languageId === DEFAULT_LANGUAGE_ID
      ? migrateLegacyProfile(
          localStorage.getItem(LEGACY_MASTERY_STORAGE_KEY),
          languageId,
        )
      : null;
  if (migrated) {
    saveMasteryProfile(migrated, languageId);
    return migrated;
  }
  return createEmptyMasteryProfile(languageId);
}

export function saveMasteryProfile(
  profile: MasteryProfile,
  languageId: LanguageId = profile.languageId ?? DEFAULT_LANGUAGE_ID,
): void {
  if (typeof window === "undefined") return;
  const nextProfile = {
    ...profile,
    version: 2 as const,
    languageId,
    updatedAt: Date.now(),
    sessions: profile.sessions.map((session) => ({
      ...session,
      languageId: session.languageId ?? languageId,
    })),
  };
  const profileKey = masteryStorageKey(languageId);
  const sessionsKey = trainingSessionsStorageKey(languageId);
  localStorage.setItem(profileKey, JSON.stringify(nextProfile));
  localStorage.setItem(
    sessionsKey,
    JSON.stringify(nextProfile.sessions),
  );
  window.dispatchEvent(new StorageEvent("storage", { key: profileKey }));
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
  if (session.languageId !== DEFAULT_LANGUAGE_ID) return false;
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
  const profileLanguageId = profile.languageId ?? DEFAULT_LANGUAGE_ID;
  const sessionLanguageId = session.languageId ?? profileLanguageId;
  if (
    profileLanguageId !== DEFAULT_LANGUAGE_ID ||
    sessionLanguageId !== DEFAULT_LANGUAGE_ID ||
    profileLanguageId !== sessionLanguageId
  ) {
    return profile;
  }
  const normalizedSession = { ...session, languageId: sessionLanguageId };
  const pack = getTrainingPack(session.packId);
  const canPromote = reliabilityAllowsPromotion(normalizedSession);
  const mastered = evaluateSessionMastery(normalizedSession);
  const existing = profile.packs[normalizedSession.packId];
  const contributesTargetScores =
    canPromote && session.modality !== "perception";
  const completedSessions = (existing?.completedSessions ?? 0) + 1;
  const bestTargetScore = Math.max(
    existing?.bestTargetScore ?? 0,
    ...(contributesTargetScores ? normalizedSession.targetScores : []),
    0,
  );
  const perceptionRate =
    canPromote && session.perceptionTotal > 0
      ? session.perceptionCorrect / session.perceptionTotal
      : 0;
  const wasDueMastered =
    existing?.status === "mastered" &&
    isReviewDue(existing, normalizedSession.completedAt);
  const observableFailure =
    (normalizedSession.failedItems?.length ?? 0) > 0 ||
    (normalizedSession.stuckPatternIds?.length ?? 0) > 0;
  const failureStreak = mastered
    ? 0
    : canPromote || observableFailure
      ? (existing?.failureStreak ?? 0) + 1
      : (existing?.failureStreak ?? 0);
  const stage = canPromote
    ? evaluateMasteryStage(existing, normalizedSession, mastered, failureStreak)
    : nonPromotingStage(existing, normalizedSession);
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
      [normalizedSession.packId]: {
        packId: normalizedSession.packId,
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
            ? (normalizedSession.transferEvidence?.filter((item) => item.passed).length ??
              0)
            : 0),
        levelProgress: canPromote
          ? buildLevelProgress(existing?.levelProgress, normalizedSession)
          : (existing?.levelProgress ?? {}),
        bestTargetScore,
        perceptionBestRate: Math.max(
          existing?.perceptionBestRate ?? 0,
          perceptionRate,
        ),
        completedSessions,
        failureStreak,
        lastPracticedAt: normalizedSession.completedAt,
        nextReviewAt:
          mastered && canPromote
            ? normalizedSession.completedAt + nextReviewDelay(completedSessions)
            : existing?.nextReviewAt,
      },
    },
    phonemes: { ...profile.phonemes },
    errorPatterns: updateErrorPatterns(profile.errorPatterns, normalizedSession),
  };

  if (pack && canPromote && canUpdateProductionPhonemes(session)) {
    for (const phoneme of pack.targetPhonemes) {
      nextProfile.phonemes[phoneme] = updatePhoneme(
        profile.phonemes[phoneme],
        phoneme,
        normalizedSession.targetScores,
      );
    }
  }

  return nextProfile;
}
