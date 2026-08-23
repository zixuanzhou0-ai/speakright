export type TrainingMaterialRole =
  | "baseline"
  | "instruction"
  | "practice"
  | "near-transfer"
  | "far-transfer"
  | "retention";

export type TrainingMaterialPosition = "initial" | "medial" | "final" | "mixed";

export interface TrainingMaterialDescriptor {
  id: string;
  packId: string;
  role: TrainingMaterialRole;
  targetUnits: string[];
  position?: TrainingMaterialPosition;
  phoneticContext?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  speakerIds?: string[];
}

export interface TrainingMaterialPartitionResult {
  valid: boolean;
  conflicts: Array<{
    materialId: string;
    roles: TrainingMaterialRole[];
  }>;
}

export function validateTrainingMaterialPartitions(
  materials: readonly TrainingMaterialDescriptor[],
): TrainingMaterialPartitionResult {
  const rolesByMaterial = new Map<string, Set<TrainingMaterialRole>>();
  for (const material of materials) {
    const roles = rolesByMaterial.get(material.id) ?? new Set();
    roles.add(material.role);
    rolesByMaterial.set(material.id, roles);
  }

  const conflicts = Array.from(rolesByMaterial.entries())
    .filter(([, roles]) => roles.size > 1)
    .map(([materialId, roles]) => ({
      materialId,
      roles: Array.from(roles).sort(),
    }));

  return { valid: conflicts.length === 0, conflicts };
}

export function isUntrainedMaterialRole(role: TrainingMaterialRole): boolean {
  return (
    role === "near-transfer" || role === "far-transfer" || role === "retention"
  );
}
