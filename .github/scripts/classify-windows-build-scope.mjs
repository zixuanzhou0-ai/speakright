import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ZERO_SHA_PATTERN = /^0+$/;
const COMMIT_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

export function isDocumentationPath(inputPath) {
  const normalizedPath = inputPath.replaceAll("\\", "/");

  return (
    /^[^/]*\.md$/.test(normalizedPath) ||
    /^docs\//.test(normalizedPath) ||
    /^\.github\/(?:.*\/)?[^/]*\.md$/.test(normalizedPath) ||
    normalizedPath === ".github/CODEOWNERS"
  );
}

export function areDocumentationOnly(paths) {
  return paths.length > 0 && paths.every(isDocumentationPath);
}

export function classifyWorkflowScope({
  eventName,
  baseSha,
  headSha,
  loadDiffPaths,
}) {
  if (eventName === "workflow_dispatch") {
    return {
      docsOnly: false,
      paths: [],
      reason: "Manual runs always perform the complete Windows validation.",
    };
  }

  if (eventName !== "pull_request" && eventName !== "push") {
    return {
      docsOnly: false,
      paths: [],
      reason: `Unknown event ${eventName || "(empty)"}; using the complete build.`,
    };
  }

  if (!baseSha || ZERO_SHA_PATTERN.test(baseSha)) {
    return {
      docsOnly: false,
      paths: [],
      reason:
        "No comparable base commit was available; using the complete build.",
    };
  }

  if (!headSha || ZERO_SHA_PATTERN.test(headSha)) {
    return {
      docsOnly: false,
      paths: [],
      reason:
        "No comparable head commit was available; using the complete build.",
    };
  }

  if (!COMMIT_SHA_PATTERN.test(baseSha) || !COMMIT_SHA_PATTERN.test(headSha)) {
    return {
      docsOnly: false,
      paths: [],
      reason: "The comparison commits were invalid; using the complete build.",
    };
  }

  let paths;
  try {
    paths = loadDiffPaths(baseSha, headSha);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      docsOnly: false,
      paths: [],
      reason: `Change classification failed (${detail}); using the complete build.`,
    };
  }

  if (!Array.isArray(paths) || paths.length === 0) {
    return {
      docsOnly: false,
      paths: [],
      reason: "The comparison returned no paths; using the complete build.",
    };
  }

  const normalizedPaths = paths.map((changedPath) =>
    changedPath.replaceAll("\\", "/"),
  );
  const docsOnly = areDocumentationOnly(normalizedPaths);

  return {
    docsOnly,
    paths: normalizedPaths,
    reason: docsOnly
      ? "Every changed path is covered by the documentation-only boundary."
      : "At least one changed path requires the complete Windows validation.",
  };
}

function loadGitDiffPaths(baseSha, headSha) {
  const result = spawnSync(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", baseSha, headSha, "--"],
    { encoding: "utf8" },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || `git diff exited ${result.status}`;
    throw new Error(detail);
  }

  return result.stdout.split("\0").filter(Boolean);
}

function appendWorkflowLine(filePath, line) {
  if (filePath) {
    appendFileSync(filePath, `${line}\n`, "utf8");
    return;
  }

  console.log(line);
}

function run() {
  const result = classifyWorkflowScope({
    eventName: process.env.EVENT_NAME ?? "",
    baseSha: process.env.BASE_SHA ?? "",
    headSha: process.env.HEAD_SHA ?? "",
    loadDiffPaths: loadGitDiffPaths,
  });
  const docsOnly = String(result.docsOnly);

  appendWorkflowLine(process.env.GITHUB_OUTPUT, `docs_only=${docsOnly}`);
  appendWorkflowLine(
    process.env.GITHUB_STEP_SUMMARY,
    `Documentation-only change: ${docsOnly}`,
  );
  appendWorkflowLine(process.env.GITHUB_STEP_SUMMARY, result.reason);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  run();
}
