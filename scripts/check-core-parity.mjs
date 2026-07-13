import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const pairs = [
  "lib/assessment-evidence-engine.ts",
  "lib/diagnosis-engine.ts",
  "lib/drill-utils.ts",
  "lib/learning-evidence.ts",
  "lib/training-score.ts",
  "lib/azure-attempt-evidence.ts",
  "lib/free-practice-evidence.ts",
  "lib/training-packs.ts",
  "lib/training-error-patterns.ts",
  "lib/training-perception.ts",
  "lib/training-criteria.ts",
  "lib/guided-attempt-evidence.ts",
  "lib/guided-training-evidence.ts",
  "lib/perception-attempt-evidence.ts",
  "lib/hvpt-evidence.ts",
  "types/diagnosis.ts",
  "types/training.ts",
];

function normalized(filePath) {
  return readFileSync(resolve(root, filePath), "utf8").replace(/\r\n/g, "\n");
}

const mismatches = [];
for (const relative of pairs) {
  const desktopPath = `src/${relative}`;
  const browserPath = `apps/browser/src/${relative}`;
  if (normalized(desktopPath) !== normalized(browserPath)) {
    mismatches.push(`${desktopPath} != ${browserPath}`);
  }
}

const wrappers = [
  "src/types/learning-evidence.ts",
  "apps/browser/src/types/learning-evidence.ts",
  "src/lib/language-capability-policy.ts",
  "apps/browser/src/lib/language-capability-policy.ts",
  "src/lib/training-perception.ts",
  "apps/browser/src/lib/training-perception.ts",
  "src/lib/training-criteria.ts",
  "apps/browser/src/lib/training-criteria.ts",
  "src/lib/learning-evidence.ts",
  "apps/browser/src/lib/learning-evidence.ts",
];
for (const filePath of wrappers) {
  if (!normalized(filePath).includes("@speakright/core/")) {
    mismatches.push(`${filePath} no longer delegates to packages/core`);
  }
}

const retiredCatalog = "apps/browser/src/data/training-perception-catalog.json";
if (existsSync(resolve(root, retiredCatalog))) {
  mismatches.push(
    `${retiredCatalog} must not duplicate the shared core catalog`,
  );
}

if (mismatches.length > 0) {
  console.error("Shared-core parity gate failed:");
  for (const mismatch of mismatches) console.error(`- ${mismatch}`);
  process.exit(1);
}

console.log(`Shared-core parity gate passed (${pairs.length} parity pairs).`);
