import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const pairs = [
  "lib/assessment-evidence-engine.ts",
  "lib/diagnosis-engine.ts",
  "lib/drill-utils.ts",
  "lib/learning-evidence.ts",
  "lib/training-score.ts",
  "types/diagnosis.ts",
];

function normalized(path) {
  return readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
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
];
for (const path of wrappers) {
  if (!normalized(path).includes("@speakright/core/")) {
    mismatches.push(`${path} no longer delegates to packages/core`);
  }
}

if (mismatches.length > 0) {
  console.error("Shared-core parity gate failed:");
  for (const mismatch of mismatches) console.error(`- ${mismatch}`);
  process.exit(1);
}

console.log(`Shared-core parity gate passed (${pairs.length} parity pairs).`);
