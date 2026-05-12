"use client";

import type {
  ErrorPatternMastery,
  MasteryProfile,
  PackMastery,
  PhonemeMastery,
  TrainingLevelProgress,
  TrainingSessionSummary,
} from "@/types/training";
import { getTrainingPack } from "./training-packs";

export const MASTERY_STORAGE_KEY = "speakright_mastery_profile_v2";
export const TRAINING_SESSIONS_STORAGE_KEY = "speakright_training_sessions_v2";
const LEGACY_MASTERY_STORAGE_KEY = "speakright_mastery_profile_v1";

const DAY_MS = 24 * 60 * 60 * 1000;

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

export function loadMasteryProfile(): MasteryProfile {
  if (typeof window === "undefined") return createEmptyMasteryProfile();
  const current = parseProfile(localStorage.getItem(MASTERY_STORAGE_KEY));
  if (current) return current;
  const migrated = migrateLegacyProfile(localStorage.getItem(LEGACY_MASTERY_STORAGE_KEY));
  if (migrated) {
    saveMasteryProfile(migrated);
    return migrated;
  }
  return createEmptyMasteryProfile();
}

export function saveMasteryProfile(profile: MasteryProfile): void {
  if (typeof window === "undefined") return;
  const nextProfile = { ...profile, version: 2 as const, updatedAt: Date.now() };
  localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(nextProfile));
  localStorage.setItem(
    TRAINING_SESSIONS_STORAGE_KEY,
    JSON.stringify(nextProfile.sessions),
  );
  window.dispatchEvent(new StorageEvent("storage", { key: MASTERY_STORAGE_KEY }));
}

export function isReviewDue(mastery?: PackMastery, now = Date.now()): boolean {
  return !!mastery?.nextReviewAt && mastery.nextReviewAt <= now;
}

function scoreAverage(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function evaluateSessionMastery(session: TrainingSessionSummary): boolean {
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
  const requiredKinds = new Set(["perception", "word", "sentence", "mixed-review"]);
  const requiredLevelsPassed =
    !session.levelSummaries ||
    [...requiredKinds].every((kind) =>
      session.levelSummaries?.some((level) => level.kind === kind && level.passed),
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
  const mastered = evaluateSessionMastery(session);
  const existing = profile.packs[session.packId];
  const completedSessions = (existing?.completedSessions ?? 0) + 1;
  const bestTargetScore = Math.max(
    existing?.bestTargetScore ?? 0,
    ...session.targetScores,
    0,
  );
  const perceptionRate =
    session.perceptionTotal > 0
      ? session.perceptionCorrect / session.perceptionTotal
      : 0;
  const wasDueMastered =
    existing?.status === "mastered" && isReviewDue(existing, session.completedAt);
  const failureStreak = mastered ? 0 : (existing?.failureStreak ?? 0) + 1;
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
        mastered,
        reviewItems: session.reviewItems ?? [],
      },
      ...profile.sessions,
    ].slice(0, 80),
    packs: {
      ...profile.packs,
      [session.packId]: {
        packId: session.packId,
        status,
        levelProgress: buildLevelProgress(existing?.levelProgress, session),
        bestTargetScore,
        perceptionBestRate: Math.max(
          existing?.perceptionBestRate ?? 0,
          perceptionRate,
        ),
        completedSessions,
        failureStreak,
        lastPracticedAt: session.completedAt,
        nextReviewAt: mastered
          ? session.completedAt + nextReviewDelay(completedSessions)
          : existing?.nextReviewAt,
      },
    },
    phonemes: { ...profile.phonemes },
    errorPatterns: updateErrorPatterns(profile.errorPatterns, session),
  };

  if (pack) {
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
