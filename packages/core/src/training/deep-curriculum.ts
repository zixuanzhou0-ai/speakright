import type {
  TrainingMaterialDescriptor,
  TrainingMaterialRole,
} from "./materials";
import { validateTrainingMaterialPartitions } from "./materials";

export const ENGLISH_DEPTH_PILOT_CALIBRATION_VERSION = "english-depth-pilot-v1";

export type DeepTrainingMaterialKind =
  | "motor-check"
  | "syllable"
  | "word"
  | "minimal-pair"
  | "sentence"
  | "shadowing"
  | "guided-prompt";

export interface DeepTrainingMaterial extends TrainingMaterialDescriptor {
  kind: DeepTrainingMaterialKind;
  text: string;
  ipa?: string;
  contrastText?: string;
  scheduledDelayHours?: 24 | 168 | 504;
}

export interface EnglishDepthCurriculum {
  packId: string;
  targetUnits: string[];
  estimatedMinutesPerSession: number;
  materials: DeepTrainingMaterial[];
}

function material(
  id: string,
  role: TrainingMaterialRole,
  kind: DeepTrainingMaterialKind,
  text: string,
  options: Partial<
    Omit<DeepTrainingMaterial, "id" | "packId" | "role" | "kind" | "text">
  > = {},
): DeepTrainingMaterial {
  return {
    id,
    packId: "ee-ih",
    role,
    kind,
    text,
    targetUnits: ["ee", "ih"],
    difficulty: 1,
    ...options,
  };
}

export const EE_IH_GOLD_CURRICULUM: EnglishDepthCurriculum = {
  packId: "ee-ih",
  targetUnits: ["ee", "ih"],
  estimatedMinutesPerSession: 12,
  materials: [
    material(
      "ee-ih-motor-tongue",
      "instruction",
      "motor-check",
      "Tongue height and frontness",
    ),
    material(
      "ee-ih-motor-tension",
      "instruction",
      "motor-check",
      "Muscular tension and vowel quality",
    ),
    material(
      "ee-ih-motor-duration",
      "instruction",
      "motor-check",
      "Natural duration as a secondary cue",
    ),

    material("ee-ih-syllable-01", "practice", "syllable", "see sit", {
      phoneticContext: "s_",
      difficulty: 1,
    }),
    material("ee-ih-syllable-02", "practice", "syllable", "tea tip", {
      phoneticContext: "t_",
      difficulty: 1,
    }),
    material("ee-ih-syllable-03", "practice", "syllable", "fee fit", {
      phoneticContext: "f_",
      difficulty: 1,
    }),
    material("ee-ih-syllable-04", "practice", "syllable", "key kit", {
      phoneticContext: "k_",
      difficulty: 2,
    }),
    material("ee-ih-syllable-05", "practice", "syllable", "bead bid", {
      phoneticContext: "_m",
      difficulty: 2,
    }),
    material("ee-ih-syllable-06", "practice", "syllable", "seen sin", {
      phoneticContext: "_n",
      difficulty: 2,
    }),
    material("ee-ih-syllable-07", "practice", "syllable", "feel fill", {
      phoneticContext: "_l",
      difficulty: 3,
    }),
    material("ee-ih-syllable-08", "practice", "syllable", "feast fist", {
      phoneticContext: "_st",
      difficulty: 3,
    }),

    material("ee-ih-word-01", "practice", "word", "sheep", {
      position: "medial",
      phoneticContext: "sh_p",
      difficulty: 1,
    }),
    material("ee-ih-word-02", "practice", "word", "deep", {
      position: "medial",
      phoneticContext: "d_p",
      difficulty: 1,
    }),
    material("ee-ih-word-03", "practice", "word", "need", {
      position: "medial",
      phoneticContext: "n_d",
      difficulty: 1,
    }),
    material("ee-ih-word-04", "practice", "word", "keep", {
      position: "medial",
      phoneticContext: "k_p",
      difficulty: 2,
    }),
    material("ee-ih-word-05", "practice", "word", "clean", {
      position: "medial",
      phoneticContext: "kl_n",
      difficulty: 2,
    }),
    material("ee-ih-word-06", "practice", "word", "week", {
      position: "medial",
      phoneticContext: "w_k",
      difficulty: 2,
    }),
    material("ee-ih-word-07", "practice", "word", "field", {
      position: "medial",
      phoneticContext: "f_ld",
      difficulty: 3,
    }),
    material("ee-ih-word-08", "practice", "word", "evening", {
      position: "mixed",
      phoneticContext: "multisyllabic",
      difficulty: 3,
    }),
    material("ee-ih-word-09", "practice", "word", "fish", {
      position: "medial",
      phoneticContext: "f_sh",
      difficulty: 1,
    }),
    material("ee-ih-word-10", "practice", "word", "pick", {
      position: "medial",
      phoneticContext: "p_k",
      difficulty: 1,
    }),
    material("ee-ih-word-11", "practice", "word", "kitchen", {
      position: "mixed",
      phoneticContext: "multisyllabic",
      difficulty: 2,
    }),
    material("ee-ih-word-12", "practice", "word", "quick", {
      position: "medial",
      phoneticContext: "kw_k",
      difficulty: 2,
    }),
    material("ee-ih-word-13", "practice", "word", "visit", {
      position: "mixed",
      phoneticContext: "multisyllabic",
      difficulty: 3,
    }),
    material("ee-ih-word-14", "practice", "word", "finish", {
      position: "mixed",
      phoneticContext: "multisyllabic",
      difficulty: 3,
    }),
    material("ee-ih-word-15", "practice", "word", "printer", {
      position: "mixed",
      phoneticContext: "cluster",
      difficulty: 4,
    }),
    material("ee-ih-word-16", "practice", "word", "decision", {
      position: "mixed",
      phoneticContext: "unstressed",
      difficulty: 4,
    }),

    material("ee-ih-pair-01", "practice", "minimal-pair", "seat", {
      contrastText: "sit",
      difficulty: 2,
    }),
    material("ee-ih-pair-02", "practice", "minimal-pair", "feet", {
      contrastText: "fit",
      difficulty: 2,
    }),
    material("ee-ih-pair-03", "practice", "minimal-pair", "leak", {
      contrastText: "lick",
      difficulty: 2,
    }),
    material("ee-ih-pair-04", "practice", "minimal-pair", "beat", {
      contrastText: "bit",
      difficulty: 2,
    }),
    material("ee-ih-pair-05", "practice", "minimal-pair", "green", {
      contrastText: "grin",
      difficulty: 3,
    }),
    material("ee-ih-pair-06", "practice", "minimal-pair", "least", {
      contrastText: "list",
      difficulty: 3,
    }),
    material("ee-ih-pair-07", "practice", "minimal-pair", "heat", {
      contrastText: "hit",
      difficulty: 3,
    }),
    material("ee-ih-pair-08", "practice", "minimal-pair", "reach", {
      contrastText: "rich",
      difficulty: 4,
    }),

    material(
      "ee-ih-sentence-01",
      "practice",
      "sentence",
      "The seat is near the ship.",
      { position: "mixed", difficulty: 2 },
    ),
    material(
      "ee-ih-sentence-02",
      "practice",
      "sentence",
      "Please sit in this seat.",
      { position: "mixed", difficulty: 2 },
    ),
    material(
      "ee-ih-sentence-03",
      "practice",
      "sentence",
      "I will leave it in the kitchen.",
      { position: "mixed", difficulty: 3 },
    ),
    material(
      "ee-ih-sentence-04",
      "practice",
      "sentence",
      "Keep this list with me.",
      { position: "mixed", difficulty: 3 },
    ),
    material(
      "ee-ih-sentence-05",
      "practice",
      "sentence",
      "The team fixed the printer.",
      { position: "mixed", difficulty: 4 },
    ),
    material(
      "ee-ih-sentence-06",
      "practice",
      "sentence",
      "She needs a quick decision.",
      { position: "mixed", difficulty: 4 },
    ),
    material(
      "ee-ih-sentence-07",
      "practice",
      "sentence",
      "This meeting will finish in fifteen minutes.",
      { position: "mixed", difficulty: 5 },
    ),
    material(
      "ee-ih-sentence-08",
      "practice",
      "sentence",
      "We need six clean sheets.",
      { position: "mixed", difficulty: 5 },
    ),

    material(
      "ee-ih-shadow-01",
      "practice",
      "shadowing",
      "Please sit in this seat and keep your feet still.",
      { position: "mixed", difficulty: 4 },
    ),
    material(
      "ee-ih-shadow-02",
      "practice",
      "shadowing",
      "The meeting is brief, but this decision is important.",
      { position: "mixed", difficulty: 4 },
    ),
    material(
      "ee-ih-shadow-03",
      "practice",
      "shadowing",
      "She will leave the list in the kitchen this evening.",
      { position: "mixed", difficulty: 5 },
    ),
    material(
      "ee-ih-shadow-04",
      "practice",
      "shadowing",
      "We need to finish this brief meeting in fifteen minutes.",
      { position: "mixed", difficulty: 5 },
    ),

    material("ee-ih-near-01", "near-transfer", "word", "ceiling", {
      position: "mixed",
      difficulty: 3,
    }),
    material("ee-ih-near-02", "near-transfer", "word", "limit", {
      position: "mixed",
      difficulty: 3,
    }),
    material("ee-ih-near-03", "near-transfer", "word", "secret", {
      position: "mixed",
      difficulty: 3,
    }),
    material("ee-ih-near-04", "near-transfer", "word", "ticket", {
      position: "mixed",
      difficulty: 3,
    }),
    material(
      "ee-ih-near-05",
      "near-transfer",
      "sentence",
      "The clinic needs a new seating plan.",
      { position: "mixed", difficulty: 4 },
    ),
    material(
      "ee-ih-near-06",
      "near-transfer",
      "sentence",
      "Please finish the email before the meeting.",
      { position: "mixed", difficulty: 4 },
    ),

    material("ee-ih-far-01", "far-transfer", "word", "equal", {
      position: "initial",
      difficulty: 4,
    }),
    material("ee-ih-far-02", "far-transfer", "word", "image", {
      position: "initial",
      difficulty: 4,
    }),
    material(
      "ee-ih-far-03",
      "far-transfer",
      "sentence",
      "A quick decision will keep the team moving.",
      { position: "mixed", difficulty: 5 },
    ),
    material(
      "ee-ih-far-04",
      "far-transfer",
      "guided-prompt",
      "Explain a recent decision at work or school.",
      { position: "mixed", difficulty: 5 },
    ),

    material("ee-ih-retention-24-word", "retention", "word", "feature", {
      position: "mixed",
      difficulty: 3,
      scheduledDelayHours: 24,
    }),
    material("ee-ih-retention-24-word-2", "retention", "word", "briefing", {
      position: "mixed",
      difficulty: 4,
      scheduledDelayHours: 24,
    }),
    material(
      "ee-ih-retention-24-sentence",
      "retention",
      "sentence",
      "This feature will keep the screen clear.",
      { position: "mixed", difficulty: 4, scheduledDelayHours: 24 },
    ),
    material(
      "ee-ih-retention-24-prompt",
      "retention",
      "guided-prompt",
      "Describe a useful feature in an app.",
      { position: "mixed", difficulty: 4, scheduledDelayHours: 24 },
    ),

    material("ee-ih-retention-168-word", "retention", "word", "district", {
      position: "mixed",
      difficulty: 3,
      scheduledDelayHours: 168,
    }),
    material("ee-ih-retention-168-word-2", "retention", "word", "sequence", {
      position: "mixed",
      difficulty: 4,
      scheduledDelayHours: 168,
    }),
    material(
      "ee-ih-retention-168-sentence",
      "retention",
      "sentence",
      "The district team will meet this evening.",
      { position: "mixed", difficulty: 4, scheduledDelayHours: 168 },
    ),
    material(
      "ee-ih-retention-168-prompt",
      "retention",
      "guided-prompt",
      "Describe a meeting that finished quickly.",
      { position: "mixed", difficulty: 4, scheduledDelayHours: 168 },
    ),

    material("ee-ih-retention-504-word", "retention", "word", "efficient", {
      position: "mixed",
      difficulty: 4,
      scheduledDelayHours: 504,
    }),
    material("ee-ih-retention-504-word-2", "retention", "word", "specific", {
      position: "mixed",
      difficulty: 4,
      scheduledDelayHours: 504,
    }),
    material(
      "ee-ih-retention-504-sentence",
      "retention",
      "sentence",
      "An efficient system keeps each list visible.",
      { position: "mixed", difficulty: 5, scheduledDelayHours: 504 },
    ),
    material(
      "ee-ih-retention-504-prompt",
      "retention",
      "guided-prompt",
      "Explain how you keep a busy week efficient.",
      { position: "mixed", difficulty: 5, scheduledDelayHours: 504 },
    ),
  ],
};

export interface DeepCurriculumValidation {
  valid: boolean;
  issues: string[];
  counts: Record<TrainingMaterialRole, number>;
}

function normalizedMaterialContent(material: DeepTrainingMaterial): string {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const parts = [material.text, material.contrastText]
    .filter((value): value is string => Boolean(value))
    .map(normalize);
  if (material.kind === "minimal-pair") parts.sort();
  return `${material.kind}:${parts.join("|")}`;
}

export function validateEnglishDepthCurriculum(
  curriculum: EnglishDepthCurriculum,
): DeepCurriculumValidation {
  const partition = validateTrainingMaterialPartitions(curriculum.materials);
  const issues = partition.conflicts.map(
    (conflict) =>
      `${conflict.materialId} appears in multiple roles: ${conflict.roles.join(", ")}`,
  );
  const rolesByContent = new Map<string, Set<TrainingMaterialRole>>();
  for (const material of curriculum.materials) {
    if (material.role === "instruction") continue;
    const fingerprint = normalizedMaterialContent(material);
    const roles = rolesByContent.get(fingerprint) ?? new Set();
    roles.add(material.role);
    rolesByContent.set(fingerprint, roles);
  }
  for (const [fingerprint, roles] of rolesByContent) {
    if (roles.size > 1) {
      issues.push(
        `${fingerprint} repeats across material roles: ${Array.from(roles)
          .sort()
          .join(", ")}`,
      );
    }
  }

  const counts = {
    baseline: 0,
    instruction: 0,
    practice: 0,
    "near-transfer": 0,
    "far-transfer": 0,
    retention: 0,
  } satisfies Record<TrainingMaterialRole, number>;
  for (const item of curriculum.materials) counts[item.role] += 1;

  const practiceByKind = new Map<DeepTrainingMaterialKind, number>();
  for (const item of curriculum.materials.filter(
    (candidate) => candidate.role === "practice",
  )) {
    practiceByKind.set(item.kind, (practiceByKind.get(item.kind) ?? 0) + 1);
  }
  const requiredPracticeCounts: Partial<
    Record<DeepTrainingMaterialKind, number>
  > = {
    syllable: 8,
    word: 16,
    "minimal-pair": 8,
    sentence: 8,
    shadowing: 4,
  };
  for (const [kind, required] of Object.entries(requiredPracticeCounts)) {
    if (
      (practiceByKind.get(kind as DeepTrainingMaterialKind) ?? 0) < required
    ) {
      issues.push(`Need at least ${required} ${kind} practice materials`);
    }
  }
  if (counts["near-transfer"] < 6) {
    issues.push("Need at least 6 near-transfer materials");
  }
  if (counts["far-transfer"] < 3) {
    issues.push("Need at least 3 far-transfer materials");
  }
  for (const delay of [24, 168, 504] as const) {
    const atDelay = curriculum.materials.filter(
      (item) => item.role === "retention" && item.scheduledDelayHours === delay,
    ).length;
    if (atDelay < 3) {
      issues.push(`Need at least 3 retention materials at ${delay} hours`);
    }
  }
  return { valid: issues.length === 0, issues, counts };
}
