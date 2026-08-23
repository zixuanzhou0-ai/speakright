import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const gatePath = path.join(
  projectRoot,
  "scripts",
  "user-testing-evidence-gate.mjs",
);
const sourceSummaryPath = path.join(
  projectRoot,
  "docs",
  "validation",
  "USER_TESTING_SUMMARY.md",
);
const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "speakright-user-claims-"),
);

function replaceOnce(markdown, before, after) {
  assert.ok(
    markdown.includes(before),
    `fixture source must include: ${before}`,
  );
  return markdown.replace(before, after);
}

async function writeFixture(name, markdown) {
  const fixturePath = path.join(tempRoot, `${name}.md`);
  await fs.writeFile(fixturePath, markdown, "utf8");
  return fixturePath;
}

function runGate(summaryPath) {
  return spawnSync(process.execPath, [gatePath, "--summary", summaryPath], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

function combinedOutput(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function assertRejected(result, expectedText) {
  assert.notEqual(result.status, 0, "unsafe public claim must fail closed");
  assert.match(combinedOutput(result), expectedText);
}

try {
  const source = await fs.readFile(sourceSummaryPath, "utf8");
  const sourcePath = await writeFixture("maintainer-attestation", source);
  const sourceResult = runGate(sourcePath);
  assert.equal(
    sourceResult.status,
    0,
    `canonical maintainer attestation should pass:\n${combinedOutput(sourceResult)}`,
  );
  assert.match(sourceResult.stdout, /20 people/u);
  assert.match(sourceResult.stdout, /not independently audited/u);
  assert.doesNotMatch(source, /Participants invited/u);
  assert.doesNotMatch(source, /Independent review [12]/u);
  assert.doesNotMatch(
    source,
    /^- (?!No\b).*participant-level proof is required/imu,
  );

  const wrongStatus = replaceOnce(
    source,
    "Status: **maintainer-attested — not independently audited**.",
    "Status: **complete — independently verified**.",
  );
  assertRejected(
    runGate(await writeFixture("wrong-status", wrongStatus)),
    /Status must exactly remain/u,
  );

  const changedCount = replaceOnce(
    source,
    "20 people tested SpeakRight offline",
    "21 people tested SpeakRight offline",
  );
  assertRejected(
    runGate(await writeFixture("changed-count", changedCount)),
    /exactly one human-count claim/u,
  );

  const secondCount = replaceOnce(
    source,
    "The repository publishes only the aggregate maintainer statement above.",
    "The repository publishes only the aggregate maintainer statement above. It has 100 users.",
  );
  assertRejected(
    runGate(await writeFixture("second-count", secondCount)),
    /exactly one human-count claim/u,
  );

  const removedAuditBoundary = replaceOnce(
    source,
    "This is a maintainer-provided statement, not an independently audited study result.",
    "This is a maintainer-provided statement.",
  );
  assertRejected(
    runGate(await writeFixture("removed-audit-boundary", removedAuditBoundary)),
    /Missing required evidence\/privacy boundary/u,
  );

  const percentageClaim = `${source}\n\nTask success was 95%.\n`;
  assertRejected(
    runGate(await writeFixture("percentage-claim", percentageClaim)),
    /percentages and numerator\/denominator/u,
  );

  const ratioClaim = `${source}\n\nAll required tasks were completed by 20/20.\n`;
  assertRejected(
    runGate(await writeFixture("ratio-claim", ratioClaim)),
    /percentages and numerator\/denominator/u,
  );

  const unsupportedOutcome = `${source}\n\nAll testers completed every required task.\n`;
  assertRejected(
    runGate(await writeFixture("unsupported-outcome", unsupportedOutcome)),
    /must not be expanded into a task-success/u,
  );

  const emailLeak = `${source}\n\nParticipant contact: learner@example.com\n`;
  assertRejected(
    runGate(await writeFixture("email-leak", emailLeak)),
    /email address/u,
  );

  for (const [name, disclosure] of [
    ["participant-name", "Participant name: Alice Smith."],
    ["participant-phone", "Participant phone: +1-555-123-4567."],
    ["participant-quote", "Participant quote: This app helped me."],
    [
      "private-drive-link",
      "Private interview notes: https://drive.google.com/file/d/example/view",
    ],
  ]) {
    assertRejected(
      runGate(await writeFixture(name, `${source}\n\n${disclosure}\n`)),
      /privacy-reviewed canonical document/u,
    );
  }

  const localPathLeak = `${source}\n\nPrivate source: C:\\Users\\Example\\testing.xlsx\n`;
  assertRejected(
    runGate(await writeFixture("local-path-leak", localPathLeak)),
    /Windows user-profile path/u,
  );

  const placeholder = `${source}\n\nFuture detail: <pending maintainer input>\n`;
  assertRejected(
    runGate(await writeFixture("placeholder", placeholder)),
    /placeholder/u,
  );

  const retiredHardGate = `${source}\n\n## Required study fields\n\nParticipants invited: 20\n`;
  assertRejected(
    runGate(await writeFixture("retired-hard-gate", retiredHardGate)),
    /Retired detailed-study release requirement/u,
  );

  const requiredProof = replaceOnce(
    source,
    "No private source-evidence path or participant-level proof is required for the v1.1.0 release or a Codex for Open Source application.",
    "A private source-evidence path and participant-level proof are required for the v1.1.0 release.",
  );
  assertRejected(
    runGate(await writeFixture("required-proof", requiredProof)),
    /Missing required evidence\/privacy boundary/u,
  );

  const requiredDetailedStudy = replaceOnce(
    source,
    "Publishing a more detailed anonymized aggregate study is optional, not a prerequisite for releasing v1.1.0 or submitting a Codex for Open Source application.",
    "Publishing a more detailed anonymized aggregate study is required before releasing v1.1.0.",
  );
  assertRejected(
    runGate(
      await writeFixture("required-detailed-study", requiredDetailedStudy),
    ),
    /Missing required evidence\/privacy boundary/u,
  );

  console.log(
    "User-testing claim-safety contract passed (the maintainer attestation passes; unsupported metrics, detailed-proof requirements, and sensitive values fail closed).",
  );
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
