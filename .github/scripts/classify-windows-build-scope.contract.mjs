import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  areDocumentationOnly,
  classifyWorkflowScope,
  isDocumentationPath,
} from "./classify-windows-build-scope.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "../..");
const classifierPath = join(
  projectRoot,
  ".github/scripts/classify-windows-build-scope.mjs",
);
const workflowPath = join(projectRoot, ".github/workflows/build-windows.yml");
const workflow = readFileSync(workflowPath, "utf8");

const documentationPathCases = [
  ["README.md", true],
  [".md", true],
  ["docs/report.json", true],
  [".github/README.md", true],
  [".github/.md", true],
  [".github/templates/review.md", true],
  [".github/CODEOWNERS", true],
  ["README.MD", false],
  ["DOCS/report.json", false],
  [".github/codeowners", false],
  ["nested/README.md", false],
  ["src/app.ts", false],
  [".github/scripts/classify-windows-build-scope.mjs", false],
  [".github/workflows/build-windows.yml", false],
];

for (const [changedPath, expected] of documentationPathCases) {
  assert.equal(
    isDocumentationPath(changedPath),
    expected,
    `Unexpected documentation classification for ${changedPath}`,
  );
}
assert.equal(areDocumentationOnly([]), false);
assert.equal(areDocumentationOnly(["README.md", "docs/report.json"]), true);
assert.equal(areDocumentationOnly(["README.md", "src/app.ts"]), false);

const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const scopeCases = [
  {
    name: "manual dispatch",
    eventName: "workflow_dispatch",
    baseSha,
    headSha,
    diffPaths: ["README.md"],
    expected: false,
    expectedLoadCalls: 0,
  },
  {
    name: "unknown event",
    eventName: "schedule",
    baseSha,
    headSha,
    diffPaths: ["README.md"],
    expected: false,
    expectedLoadCalls: 0,
  },
  {
    name: "missing base",
    eventName: "pull_request",
    baseSha: "",
    headSha,
    diffPaths: ["README.md"],
    expected: false,
    expectedLoadCalls: 0,
  },
  {
    name: "all-zero base",
    eventName: "push",
    baseSha: "0".repeat(40),
    headSha,
    diffPaths: ["README.md"],
    expected: false,
    expectedLoadCalls: 0,
  },
  {
    name: "missing head",
    eventName: "pull_request",
    baseSha,
    headSha: "",
    diffPaths: ["README.md"],
    expected: false,
    expectedLoadCalls: 0,
  },
  {
    name: "all-zero head",
    eventName: "pull_request",
    baseSha,
    headSha: "0".repeat(40),
    diffPaths: ["README.md"],
    expected: false,
    expectedLoadCalls: 0,
  },
  {
    name: "invalid base",
    eventName: "pull_request",
    baseSha: "not-a-commit",
    headSha,
    diffPaths: ["README.md"],
    expected: false,
    expectedLoadCalls: 0,
  },
  {
    name: "invalid head",
    eventName: "pull_request",
    baseSha,
    headSha: "not-a-commit",
    diffPaths: ["README.md"],
    expected: false,
    expectedLoadCalls: 0,
  },
  {
    name: "empty comparison",
    eventName: "pull_request",
    baseSha,
    headSha,
    diffPaths: [],
    expected: false,
    expectedLoadCalls: 1,
  },
  {
    name: "non-array comparison",
    eventName: "pull_request",
    baseSha,
    headSha,
    diffPaths: undefined,
    expected: false,
    expectedLoadCalls: 1,
  },
  {
    name: "documentation-only comparison",
    eventName: "pull_request",
    baseSha,
    headSha,
    diffPaths: ["README.md", ".github/.md"],
    expected: true,
    expectedLoadCalls: 1,
  },
  {
    name: "mixed comparison",
    eventName: "pull_request",
    baseSha,
    headSha,
    diffPaths: ["README.md", "src/app.ts"],
    expected: false,
    expectedLoadCalls: 1,
  },
  {
    name: "git diff failure",
    eventName: "pull_request",
    baseSha,
    headSha,
    error: new Error("unexpected failure"),
    expected: false,
    expectedLoadCalls: 1,
  },
];

for (const scopeCase of scopeCases) {
  let loadCalls = 0;
  const result = classifyWorkflowScope({
    eventName: scopeCase.eventName,
    baseSha: scopeCase.baseSha,
    headSha: scopeCase.headSha,
    loadDiffPaths: () => {
      loadCalls += 1;
      if (scopeCase.error) throw scopeCase.error;
      return scopeCase.diffPaths;
    },
  });
  assert.equal(result.docsOnly, scopeCase.expected, scopeCase.name);
  assert.equal(loadCalls, scopeCase.expectedLoadCalls, scopeCase.name);
}

function getStepBlock(stepName) {
  const marker = `      - name: ${stepName}`;
  const start = workflow.indexOf(marker);
  assert.ok(start >= 0, `Missing workflow step: ${stepName}`);
  const next = workflow.indexOf("\n      - name:", start + marker.length);
  return workflow.slice(start, next === -1 ? undefined : next);
}

function getStepCondition(stepName) {
  return getStepBlock(stepName).match(/^ {8}if:\s*(.+)$/m)?.[1];
}

const pullRequestTrigger = workflow.slice(
  workflow.indexOf("  pull_request:"),
  workflow.indexOf("  push:"),
);
const pushTrigger = workflow.slice(
  workflow.indexOf("  push:"),
  workflow.indexOf("  workflow_dispatch:"),
);
assert.ok(!pullRequestTrigger.includes("paths-ignore:"));
assert.ok(pushTrigger.includes("paths-ignore:"));
for (const boundary of [
  '- "*.md"',
  '- "docs/**"',
  '- ".github/**/*.md"',
  '- ".github/CODEOWNERS"',
]) {
  assert.ok(
    pushTrigger.includes(boundary),
    `Missing push boundary: ${boundary}`,
  );
}

const contractStep = getStepBlock("Verify Windows build scope contract");
const classifierStep = getStepBlock("Classify documentation-only change");
assert.ok(
  contractStep.includes(
    "run: node .github/scripts/classify-windows-build-scope.contract.mjs",
  ),
);
assert.ok(
  classifierStep.includes(
    "run: node .github/scripts/classify-windows-build-scope.mjs",
  ),
);
assert.ok(!contractStep.includes("\n        if:"));
assert.ok(workflow.indexOf(contractStep) < workflow.indexOf(classifierStep));

const ordinaryBuildSteps = [
  "Setup Node",
  "Setup Rust",
  "Verify release media tooling contract",
  "Install pinned release media tooling",
  "Record build timestamp",
  "Install dependencies",
  "Validate release evidence with pinned media tooling",
  "Verify release manifest",
  "Verify release validation attachment contract",
  "Verify release staging contract",
  "Verify GitHub Release metadata contract",
  "Validate publishable desktop build",
];
for (const stepName of ordinaryBuildSteps) {
  assert.equal(
    getStepCondition(stepName),
    "steps.scope.outputs.docs_only != 'true'",
    stepName,
  );
}
for (const stepName of [
  "Verify unsigned preview evidence",
  "Upload desktop validation reports",
]) {
  assert.equal(
    getStepCondition(stepName),
    "github.event_name == 'workflow_dispatch' && steps.scope.outputs.docs_only != 'true'",
    stepName,
  );
}
assert.equal(
  getStepCondition("Confirm documentation-only build context"),
  "steps.scope.outputs.docs_only == 'true'",
);

const runtime = spawnSync(process.execPath, [classifierPath], {
  cwd: projectRoot,
  encoding: "utf8",
  env: {
    ...process.env,
    EVENT_NAME: "workflow_dispatch",
    BASE_SHA: "",
    HEAD_SHA: "",
    GITHUB_OUTPUT: "",
    GITHUB_STEP_SUMMARY: "",
  },
});
assert.equal(runtime.status, 0, runtime.stderr);
assert.match(runtime.stdout, /^docs_only=false$/m);
assert.match(runtime.stdout, /^Documentation-only change: false$/m);

console.log(
  `Windows build scope contract passed: ${documentationPathCases.length} path cases, ${scopeCases.length} scope cases, and every guarded workflow step.`,
);
