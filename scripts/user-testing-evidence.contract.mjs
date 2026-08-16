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
  path.join(os.tmpdir(), "speakright-user-evidence-"),
);

const fieldValues = new Map([
  ["Study owner", "SpeakRight maintainer"],
  [
    "Study window, with dates and timezone",
    "2026-07-01 to 2026-08-10 (America/Los_Angeles)",
  ],
  [
    "Recruitment source and inclusion criteria",
    "Adult Chinese-speaking English learners recruited from two study groups",
  ],
  [
    "Consent method and approved data uses",
    "Written consent covered testing and anonymized aggregate publication",
  ],
  ["Participants invited", "24 learners"],
  ["Participants who consented", "22 learners"],
  ["Consented adult Chinese-speaking learners (age 18+)", "22 learners"],
  ["Participants who completed each task", "22/22 learners"],
  ["Desktop vs Browser participant distribution", "Desktop: 12; Browser: 10"],
  [
    "Edition, commit/release, OS, and browser mix",
    "SpeakRight v1.1.0 RC; Windows 11 desktop: 12; Chrome browser: 10",
  ],
  [
    "Device and microphone environment categories, with a count for each",
    "Laptop built-in microphone: 8; USB microphone: 7; Wired headset microphone: 7",
  ],
  [
    "Languages and learner-background categories",
    "Chinese-speaking adult learners of English; beginner: 7; intermediate: 15",
  ],
  [
    "Tasks and predeclared success criteria",
    "Complete guided repeat, free practice, and diagnosis without a blocking defect",
  ],
  [
    "Task results as numerator/denominator, not percentage alone",
    "22/22 completed all three required tasks",
  ],
  [
    "Blocking defects and severity definitions",
    "0 blocking defects; blocking meant inability to complete a required task",
  ],
  [
    "Qualitative themes, with theme counts or marked unquantified",
    "Clear mode labels: 18; replay discoverability issue: 4",
  ],
  [
    "Exclusions, dropouts, missing data, and reasons",
    "2 declined consent; 0 dropouts",
  ],
  [
    "Known sampling and measurement limitations",
    "Convenience sample, Windows and Chrome only, no causal efficacy claim",
  ],
  [
    "Independent review 1: reviewer, date, scope, and outcome",
    "Reviewer: Reviewer A; Date: 2026-08-11; Scope: consent and aggregate counts; Outcome: approved",
  ],
  [
    "Independent review 2: reviewer, date, scope, and outcome",
    "Reviewer: Reviewer B; Date: 2026-08-12; Scope: anonymization and calculations; Outcome: approved",
  ],
  [
    "Location of private source evidence and access owner",
    "Evidence reference UT-2026-01; access owner: SpeakRight maintainer",
  ],
]);

function replaceField(markdown, field, value) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const index = lines.findIndex((line) => line.startsWith(`| ${field} |`));
  assert.notEqual(index, -1, `fixture source must include field: ${field}`);
  lines[index] = `| ${field} | ${value} |`;
  return lines.join("\n");
}

function validSummary(source) {
  let markdown = source.replace(
    /^Status:.*$/mu,
    "Status: **complete — real anonymized aggregate evidence verified**.",
  );
  for (const [field, value] of fieldValues) {
    markdown = replaceField(markdown, field, value);
  }
  markdown = markdown.replace(/^\s*[-*]\s+\[ \]/gmu, (line) =>
    line.replace("[ ]", "[x]"),
  );
  markdown = markdown.replace(
    /## Future aggregate summary template[\s\S]*?(?=## What must not be counted as a user)/u,
    "",
  );
  return markdown;
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

function assertRejected(result, expectedText) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  assert.notEqual(result.status, 0, "invalid evidence must fail closed");
  assert.match(output, expectedText);
}

try {
  const source = await fs.readFile(sourceSummaryPath, "utf8");
  const valid = validSummary(source);
  const validPath = await writeFixture("valid", valid);
  const validResult = runGate(validPath);
  assert.equal(
    validResult.status,
    0,
    `complete real-evidence fixture should pass:\n${validResult.stderr}`,
  );
  assert.match(validResult.stdout, /22 adult Chinese-speaking learners/u);

  const placeholder = replaceField(
    valid,
    "Study owner",
    "<pending maintainer input>",
  );
  assertRejected(
    runGate(await writeFixture("placeholder", placeholder)),
    /placeholder/u,
  );

  const tooFewAdults = replaceField(
    valid,
    "Consented adult Chinese-speaking learners (age 18+)",
    "19 learners",
  );
  assertRejected(
    runGate(await writeFixture("too-few-adults", tooFewAdults)),
    /at least 20/u,
  );

  let signedParticipantCounts = replaceField(
    valid,
    "Participants invited",
    "-24 learners",
  );
  signedParticipantCounts = replaceField(
    signedParticipantCounts,
    "Participants who consented",
    "−22 learners",
  );
  signedParticipantCounts = replaceField(
    signedParticipantCounts,
    "Consented adult Chinese-speaking learners (age 18+)",
    "+20 learners",
  );
  assertRejected(
    runGate(
      await writeFixture("signed-participant-counts", signedParticipantCounts),
    ),
    /Signed numbers are forbidden in participant field/u,
  );

  const signedDeviceCount = replaceField(
    valid,
    "Device and microphone environment categories, with a count for each",
    "Laptop built-in microphone: -8; USB microphone: 7; Wired headset microphone: 23",
  );
  assertRejected(
    runGate(await writeFixture("signed-device-count", signedDeviceCount)),
    /Signed numbers are forbidden in device\/microphone counts/u,
  );

  let signedRatios = replaceField(
    valid,
    "Participants who completed each task",
    "−20/22 learners",
  );
  signedRatios = replaceField(
    signedRatios,
    "Task results as numerator/denominator, not percentage alone",
    "20/−22 completed all three required tasks",
  );
  const signedRatioResult = runGate(
    await writeFixture("signed-ratios", signedRatios),
  );
  assertRejected(
    signedRatioResult,
    /Signed numbers are forbidden in participant field/u,
  );
  assertRejected(
    signedRatioResult,
    /Signed numbers are forbidden in task-result ratios/u,
  );

  const tooFewDevices = replaceField(
    valid,
    "Device and microphone environment categories, with a count for each",
    "Laptop built-in microphone: 12; USB microphone: 10; Wired headset microphone: 0",
  );
  assertRejected(
    runGate(await writeFixture("too-few-devices", tooFewDevices)),
    /at least three semantically named, distinct device\/microphone categories/u,
  );

  const incompleteReview = replaceField(
    valid,
    "Independent review 2: reviewer, date, scope, and outcome",
    "Reviewer B; 2026-08-12; anonymization scope",
  );
  assertRejected(
    runGate(await writeFixture("incomplete-review", incompleteReview)),
    /review 2 must include/u,
  );

  const sameReviewer = replaceField(
    valid,
    "Independent review 2: reviewer, date, scope, and outcome",
    fieldValues.get("Independent review 1: reviewer, date, scope, and outcome"),
  );
  assertRejected(
    runGate(await writeFixture("same-reviewer", sameReviewer)),
    /distinct reviewers/u,
  );

  const unchecked = valid.replace(/^\s*([-*]\s+)\[x\]/mu, "$1[ ]");
  assertRejected(
    runGate(await writeFixture("unchecked", unchecked)),
    /remain unchecked/u,
  );

  const missingPublicationCriterion = valid
    .split("\n")
    .filter((line) => !line.includes("Small cells that could identify"))
    .join("\n");
  assertRejected(
    runGate(
      await writeFixture(
        "missing-publication-criterion",
        missingPublicationCriterion,
      ),
    ),
    /Missing exact publication gate criterion/u,
  );

  let contradictoryCounts = replaceField(
    valid,
    "Participants invited",
    "21 learners",
  );
  contradictoryCounts = replaceField(
    contradictoryCounts,
    "Desktop vs Browser participant distribution",
    "Desktop: 11; Browser: 10",
  );
  contradictoryCounts = replaceField(
    contradictoryCounts,
    "Participants who completed each task",
    "23/21 learners",
  );
  const contradictionResult = runGate(
    await writeFixture("contradictory-counts", contradictoryCounts),
  );
  assertRejected(contradictionResult, /invited >= consented/u);
  assertRejected(
    contradictionResult,
    /Desktop and Browser participant counts must sum/u,
  );
  assertRejected(
    contradictionResult,
    /Completed participant numerator cannot exceed/u,
  );

  const invalidWindow = replaceField(
    valid,
    "Study window, with dates and timezone",
    "2026-02-30 to 2026-01-01 (UTC)",
  );
  assertRejected(
    runGate(await writeFixture("invalid-study-window", invalidWindow)),
    /invalid calendar date/u,
  );

  let garbage = valid.replace(/^Status:.*$/mu, "Status: .");
  for (const field of [
    "Study owner",
    "Recruitment source and inclusion criteria",
    "Consent method and approved data uses",
    "Edition, commit/release, OS, and browser mix",
    "Languages and learner-background categories",
    "Tasks and predeclared success criteria",
    "Blocking defects and severity definitions",
    "Qualitative themes, with theme counts or marked unquantified",
    "Exclusions, dropouts, missing data, and reasons",
    "Known sampling and measurement limitations",
    "Location of private source evidence and access owner",
  ]) {
    garbage = replaceField(garbage, field, ".");
  }
  garbage = replaceField(garbage, "Participants invited", "20");
  garbage = replaceField(garbage, "Participants who consented", "20");
  garbage = replaceField(
    garbage,
    "Consented adult Chinese-speaking learners (age 18+)",
    "20",
  );
  garbage = replaceField(
    garbage,
    "Participants who completed each task",
    "20/20",
  );
  garbage = replaceField(
    garbage,
    "Desktop vs Browser participant distribution",
    "Desktop: 10; Browser: 10",
  );
  garbage = replaceField(
    garbage,
    "Device and microphone environment categories, with a count for each",
    "a: 1; b: 1; c: 1",
  );
  garbage = replaceField(
    garbage,
    "Independent review 1: reviewer, date, scope, and outcome",
    "Reviewer: A; Date: 2026-08-11; Scope: x; Outcome: y",
  );
  garbage = replaceField(
    garbage,
    "Independent review 2: reviewer, date, scope, and outcome",
    "Reviewer: B; Date: 2026-08-12; Scope: x; Outcome: y",
  );
  const minimalChecklist = [
    "real participants",
    "consented",
    "20 learners",
    "three devices",
    "two reviews",
    "counts",
    "raw recordings",
    "small cells",
    "quotes",
    "percentages",
    "limitations",
    "causal claims",
  ];
  let checklistIndex = 0;
  garbage = garbage.replace(
    /^(\s*[-*]\s+\[x\]\s+).+$/gmu,
    (_line, prefix) => `${prefix}${minimalChecklist[checklistIndex++]}`,
  );
  const garbageResult = runGate(await writeFixture("garbage-bypass", garbage));
  assertRejected(garbageResult, /Status must exactly be/u);
  assertRejected(garbageResult, /Narrative study field is not substantive/u);
  assertRejected(garbageResult, /semantically named/u);
  assertRejected(garbageResult, /Missing exact publication gate criterion/u);

  const missingField = valid
    .split("\n")
    .filter((line) => !line.startsWith("| Study owner |"))
    .join("\n");
  assertRejected(
    runGate(await writeFixture("missing-field", missingField)),
    /Missing required study field/u,
  );

  const unresolvedPlaceholder = `${valid}\n\n<replace with verified result>\n`;
  assertRejected(
    runGate(
      await writeFixture("unresolved-placeholder", unresolvedPlaceholder),
    ),
    /Unresolved angle-bracket placeholder/u,
  );

  console.log(
    "User-testing evidence contract passed (all negative fixtures fail closed and a complete fixture passes).",
  );
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
