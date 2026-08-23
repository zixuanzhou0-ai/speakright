import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sha256File } from "./lib/pronunciation-audit-core.mjs";

const root = process.cwd();
const regenerationRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates",
);
const analysisRoot = path.join(
  regenerationRoot,
  "vertex-gemini-3.1-tts",
  "analysis",
);
const planPath = path.join(analysisRoot, "promotion-plan.json");
const ledgerPath = path.join(analysisRoot, "promotion-ledger.json");
const gatePath = path.join(analysisRoot, "vertex-candidate-gate.json");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

const issues = [];
if (!existsSync(planPath)) issues.push("promotion-plan-missing");
if (!existsSync(ledgerPath)) issues.push("promotion-ledger-missing");

const plan = issues.length === 0 ? readJson(planPath) : null;
const ledger = issues.length === 0 ? readJson(ledgerPath) : null;
if (plan && ledger) {
  if (plan.replacementCount !== ledger.replacementCount)
    issues.push("replacement-count-mismatch");
  if (ledger.status !== "machine-replaced-pending-human")
    issues.push("unsafe-verification-status");
  for (const replacement of ledger.replacements) {
    if (replacement.status !== "machine-replaced-pending-human")
      issues.push(`unsafe-item-status:${replacement.sourceAssetId}`);
    if (replacement.languageId === "en-US")
      issues.push(
        `english-promoted-without-pronunciation-gate:${replacement.sourceAssetId}`,
      );
    if (
      !["exact", "accepted-homophone", "orthographic-variant"].includes(
        replacement.blindOutcomes?.whisper,
      ) ||
      !["exact", "accepted-homophone", "orthographic-variant"].includes(
        replacement.blindOutcomes?.azure,
      ) ||
      !["exact", "accepted-homophone", "orthographic-variant"].includes(
        replacement.blindOutcomes?.vertexGemini,
      )
    ) {
      issues.push(`blind-gate-failed:${replacement.sourceAssetId}`);
    }
    const desktopPath = path.resolve(root, replacement.desktopPath);
    const browserPath = path.resolve(root, replacement.browserPath);
    if (!existsSync(desktopPath) || !existsSync(browserPath)) {
      issues.push(`formal-file-missing:${replacement.sourceAssetId}`);
      continue;
    }
    if (
      sha256File(desktopPath) !== replacement.candidateSha256 ||
      sha256File(browserPath) !== replacement.candidateSha256
    ) {
      issues.push(`formal-sha-mismatch:${replacement.sourceAssetId}`);
    }
  }
  const safeDocuments = JSON.stringify({ plan, ledger });
  if (
    /subscriptionKey|authorization|api[_-]?key|bearer\s+[a-z0-9]/iu.test(
      safeDocuments,
    )
  ) {
    issues.push("secret-like-field-present");
  }
}

const gate = {
  version: 1,
  generatedAt: new Date().toISOString(),
  passed: issues.length === 0,
  issues,
  replacementCount: ledger?.replacementCount ?? 0,
  blockedCount: plan?.blockedCount ?? 0,
  status: ledger?.status ?? null,
};
writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
console.log(JSON.stringify(gate, null, 2));
if (!gate.passed) process.exitCode = 1;
