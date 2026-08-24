import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ignorePath = ".gitleaksignore";
const workflowPath = ".github/workflows/security.yml";
const reviewedTestVoiceId = ["Voice", "Id", "12345"].join("");

const reviewedFindings = [
  {
    fingerprint:
      "94bd84fa264009eb97c8d914b47dea663dcd7538:apps/browser/src/__tests__/api-client-audio.test.ts:generic-api-key:68",
    marker: `elevenLabsTts("secret", "${reviewedTestVoiceId}"`,
  },
  {
    fingerprint:
      "94bd84fa264009eb97c8d914b47dea663dcd7538:apps/browser/src/__tests__/api-client-audio.test.ts:generic-api-key:80",
    marker: `elevenLabsTtsAligned("secret", "${reviewedTestVoiceId}"`,
  },
  {
    fingerprint:
      "8f7c240005cbdf0810edd7360705c8fe7964d8df:src/__tests__/api-client-audio.test.ts:generic-api-key:68",
    marker: `elevenLabsTts("secret", "${reviewedTestVoiceId}"`,
  },
  {
    fingerprint:
      "8f7c240005cbdf0810edd7360705c8fe7964d8df:src/__tests__/api-client-audio.test.ts:generic-api-key:80",
    marker: `elevenLabsTtsAligned("secret", "${reviewedTestVoiceId}"`,
  },
  {
    fingerprint:
      "d2db217d8b14f595416aff8d96ee691d2afd7aa5:docs/operations/api-docs.md:curl-auth-header:230",
    marker: "x-azure-key: YOUR_AZURE_KEY",
  },
  {
    fingerprint:
      "d2db217d8b14f595416aff8d96ee691d2afd7aa5:docs/operations/api-docs.md:curl-auth-header:328",
    marker: "x-elevenlabs-key: YOUR_ELEVENLABS_KEY",
  },
  {
    fingerprint:
      "d2db217d8b14f595416aff8d96ee691d2afd7aa5:docs/operations/api-docs.md:curl-auth-header:519",
    marker: "x-llm-key: YOUR_LLM_KEY",
  },
];

const ignoreEntries = readFileSync(ignorePath, "utf8")
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

assert.deepEqual(
  ignoreEntries,
  reviewedFindings.map(({ fingerprint }) => fingerprint),
  "The secret-history exception set changed without an explicit policy review",
);

for (const { fingerprint, marker } of reviewedFindings) {
  const [commit, file, rule, startLineText] = fingerprint.split(":");
  const startLine = Number.parseInt(startLineText, 10);

  assert.match(commit, /^[0-9a-f]{40}$/u);
  assert.ok(file, "Every exception must identify one historical file");
  assert.ok(rule, "Every exception must identify one Gitleaks rule");
  assert.ok(Number.isSafeInteger(startLine) && startLine > 0);

  const historicalFile = execFileSync("git", ["show", `${commit}:${file}`], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  const reviewWindow = historicalFile
    .split(/\r?\n/u)
    .slice(startLine - 1, startLine + 7)
    .join("\n");

  assert.ok(
    reviewWindow.includes(marker),
    `${fingerprint} no longer resolves to its reviewed fake value or documentation placeholder`,
  );
}

const workflow = readFileSync(workflowPath, "utf8");
const policyStep = workflow.indexOf(
  "node scripts/gitleaks-history-policy.contract.mjs",
);
const downloadStep = workflow.indexOf("Download and verify pinned Gitleaks");
const scanStep = workflow.search(/"\$\{RUNNER_TEMP\}\/gitleaks" detect/u);

assert.match(workflow, /fetch-depth:\s*0/u);
assert.ok(
  policyStep >= 0,
  "Secret-history CI must validate its exception policy",
);
assert.ok(
  downloadStep > policyStep && scanStep > downloadStep,
  "Secret-history CI must validate exceptions, verify the scanner, then scan",
);
assert.match(
  workflow,
  /GITLEAKS_VERSION:\s*"8\.24\.3"/u,
  "The Gitleaks CLI version must stay explicit",
);
assert.match(
  workflow,
  /GITLEAKS_LINUX_X64_SHA256:\s*"9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c"/u,
  "The Gitleaks archive must stay pinned to the reviewed release digest",
);
assert.match(
  workflow,
  /github\.com\/gitleaks\/gitleaks\/releases\/download\/v\$\{GITLEAKS_VERSION\}/u,
  "The scanner must come from the official pinned Gitleaks release",
);
assert.match(workflow, /sha256sum --check -/u);
assert.match(workflow, /--report-format=sarif/u);
assert.match(workflow, /--report-path=results\.sarif/u);
assert.match(workflow, /--redact/u);
assert.doesNotMatch(
  workflow,
  /--log-opts/u,
  "Omitting log-opts is required so Gitleaks uses --full-history --all",
);
assert.doesNotMatch(
  workflow,
  /^\s*uses:\s*gitleaks\/gitleaks-action@/mu,
  "The event-scoped action must not replace the raw full-history scan",
);

console.log(
  "Gitleaks history policy passed: exactly 7 immutable fake-value/placeholder fingerprints are reviewed; new findings remain denied.",
);
