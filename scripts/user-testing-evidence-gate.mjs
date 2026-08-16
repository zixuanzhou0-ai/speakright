import fs from "node:fs";
import path from "node:path";

const DEFAULT_SUMMARY = "docs/validation/USER_TESTING_SUMMARY.md";
const COMPLETE_STATUS =
  "complete — real anonymized aggregate evidence verified.";

const REQUIRED_FIELDS = [
  "Study owner",
  "Study window, with dates and timezone",
  "Recruitment source and inclusion criteria",
  "Consent method and approved data uses",
  "Participants invited",
  "Participants who consented",
  "Consented adult Chinese-speaking learners (age 18+)",
  "Participants who completed each task",
  "Desktop vs Browser participant distribution",
  "Edition, commit/release, OS, and browser mix",
  "Device and microphone environment categories, with a count for each",
  "Languages and learner-background categories",
  "Tasks and predeclared success criteria",
  "Task results as numerator/denominator, not percentage alone",
  "Blocking defects and severity definitions",
  "Qualitative themes, with theme counts or marked unquantified",
  "Exclusions, dropouts, missing data, and reasons",
  "Known sampling and measurement limitations",
  "Independent review 1: reviewer, date, scope, and outcome",
  "Independent review 2: reviewer, date, scope, and outcome",
  "Location of private source evidence and access owner",
];

const EXPECTED_PUBLICATION_CHECKS = [
  "A maintainer has verified that the observations came from real participants rather than automated tests, developer sessions, or synthetic audio.",
  "Participants consented to the documented testing and aggregate reporting.",
  "At least 20 consented adult Chinese-speaking learners completed the documented required tasks.",
  "At least three distinct device or microphone environment categories are documented with non-zero participant counts.",
  "Two independent reviews are documented with reviewer, date, scope, and outcome; neither review is inferred from an automated test run.",
  "Counts have a defined unit, denominator, study window, and deduplication rule.",
  "Raw recordings, free-text responses, account identifiers, IP addresses, API keys, and local profile paths are excluded from the public file.",
  "Small cells that could identify a participant are suppressed or combined.",
  "Quotes are omitted unless separately consented and de-identified.",
  "A reviewer recalculated reported percentages from the source counts.",
  "Limitations and adverse findings are reported alongside positive findings.",
  "The summary does not convert usability observations into causal learning-efficacy claims.",
];

const NARRATIVE_FIELD_RULES = new Map([
  ["Study owner", { minCharacters: 4, minUnits: 1 }],
  [
    "Recruitment source and inclusion criteria",
    { minCharacters: 24, minUnits: 4 },
  ],
  ["Consent method and approved data uses", { minCharacters: 24, minUnits: 4 }],
  [
    "Edition, commit/release, OS, and browser mix",
    { minCharacters: 20, minUnits: 4 },
  ],
  [
    "Languages and learner-background categories",
    { minCharacters: 16, minUnits: 3 },
  ],
  [
    "Tasks and predeclared success criteria",
    { minCharacters: 24, minUnits: 4 },
  ],
  [
    "Blocking defects and severity definitions",
    { minCharacters: 16, minUnits: 3 },
  ],
  [
    "Qualitative themes, with theme counts or marked unquantified",
    { minCharacters: 16, minUnits: 3 },
  ],
  [
    "Exclusions, dropouts, missing data, and reasons",
    { minCharacters: 12, minUnits: 3 },
  ],
  [
    "Known sampling and measurement limitations",
    { minCharacters: 20, minUnits: 4 },
  ],
  [
    "Location of private source evidence and access owner",
    { minCharacters: 20, minUnits: 4 },
  ],
]);

const PLACEHOLDER_VALUE_PATTERNS = [
  /<[^>\r\n]+>/u,
  /\b(?:pending|placeholder|tbd|todo|not supplied|awaiting input)\b/iu,
  /待(?:维护者|补充|填写|提供|确认|定)/u,
  /^\s*(?:n\/?a|none|unknown|[-—–]+)\s*$/iu,
  /^[\p{P}\p{S}\s]+$/u,
];

const NUMERIC_SIGN_PATTERN =
  /(?:[+\-\u2010-\u2014\u2212\uFE62\uFE63\uFF0B\uFF0D]\s*\d|\d\s*[+\-\u2010-\u2014\u2212\uFE62\uFE63\uFF0B\uFF0D])/u;

function normalize(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function isPlaceholder(value) {
  const normalized = normalize(value);
  return (
    normalized.length === 0 ||
    PLACEHOLDER_VALUE_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function semanticProfile(value) {
  const normalized = normalize(value);
  const meaningfulCharacters = normalized.match(/[\p{L}\p{N}]/gu) ?? [];
  const letters = normalized.match(/\p{L}/gu) ?? [];
  const cjkCharacters =
    normalized.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
    ) ?? [];
  const nonCjkWords =
    normalized
      .replace(
        /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,
        " ",
      )
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  return {
    characters: meaningfulCharacters.length,
    letters: letters.length,
    units: cjkCharacters.length + nonCjkWords.length,
  };
}

function isSubstantiveText(value, { minCharacters, minUnits }) {
  if (isPlaceholder(value)) return false;
  const profile = semanticProfile(value);
  return (
    profile.characters >= minCharacters &&
    profile.letters >= Math.min(4, minCharacters) &&
    profile.units >= minUnits
  );
}

function normalizeControlledText(value) {
  return normalize(value)
    .replace(/[*_`]/gu, "")
    .normalize("NFKC")
    .toLowerCase();
}

function containsSignedNumber(value) {
  return NUMERIC_SIGN_PATTERN.test(value);
}

function sectionLines(markdown, title) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex(
    (line) => normalize(line).toLowerCase() === `## ${title}`.toLowerCase(),
  );
  if (start < 0) return null;

  const endOffset = lines
    .slice(start + 1)
    .findIndex((line) => /^#{1,2}\s+/u.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end);
}

function splitMarkdownTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;

  const cells = [];
  let cell = "";
  let escaped = false;
  for (const character of trimmed.slice(1, -1)) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(normalize(cell));
      cell = "";
    } else {
      cell += character;
    }
  }
  if (escaped) cell += "\\";
  cells.push(normalize(cell));
  return cells;
}

function parseRequiredFields(lines, errors) {
  const fields = new Map();
  const duplicates = new Set();

  for (const line of lines ?? []) {
    const cells = splitMarkdownTableRow(line);
    if (!cells || cells.length < 2) continue;
    const [field, value] = cells;
    if (
      field.toLowerCase() === "field" ||
      /^:?-{3,}:?$/u.test(field) ||
      /^:?-{3,}:?$/u.test(value)
    ) {
      continue;
    }
    if (fields.has(field)) duplicates.add(field);
    fields.set(field, value);
  }

  for (const field of duplicates) {
    errors.push(`Required study field is duplicated: "${field}".`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!fields.has(field)) {
      errors.push(`Missing required study field: "${field}".`);
      continue;
    }
    if (isPlaceholder(fields.get(field) ?? "")) {
      errors.push(
        `Required study field is empty or a placeholder: "${field}".`,
      );
    }
  }
  return fields;
}

function parseSingleCount(value) {
  if (
    isPlaceholder(value) ||
    /[%/]/u.test(value) ||
    containsSignedNumber(value)
  ) {
    return null;
  }
  const matches =
    value.replace(/(?<=\d),(?=\d)/gu, "").match(/\b\d+\b/gu) ?? [];
  if (matches.length !== 1) return null;
  const count = Number(matches[0]);
  return Number.isSafeInteger(count) ? count : null;
}

function parseSingleRatio(value) {
  if (isPlaceholder(value) || containsSignedNumber(value)) return null;
  const matches = [...value.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/gu)];
  if (matches.length !== 1) return null;
  const numerator = Number(matches[0][1]);
  const denominator = Number(matches[0][2]);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    return null;
  }
  return { numerator, denominator };
}

function parseAllRatios(value) {
  if (containsSignedNumber(value)) return [];
  return [...value.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/gu)].map((match) => ({
    numerator: Number(match[1]),
    denominator: Number(match[2]),
  }));
}

function parseNamedCounts(value) {
  if (containsSignedNumber(value)) {
    return { entries: [], invalid: [value], containsSignedNumber: true };
  }
  const segments = value
    .replace(/<br\s*\/?\s*>/giu, ";")
    .split(/[;；\n]+/u)
    .map((entry) => normalize(entry))
    .filter(Boolean);
  const entries = [];
  const invalid = [];
  for (const segment of segments) {
    const match =
      segment.match(/^(.+?)\s*(?::|：|=|[-–—])\s*(?:n\s*=\s*)?(\d+)\s*$/iu) ??
      segment.match(/^(.+?)\s*\(\s*(?:n\s*=\s*)?(\d+)\s*\)\s*$/iu);
    if (!match) {
      invalid.push(segment);
      continue;
    }
    entries.push({
      name: normalize(match[1]),
      normalizedName: normalizeControlledText(match[1]),
      count: Number(match[2]),
    });
  }
  return { entries, invalid, containsSignedNumber: false };
}

function parseStrictDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return date.toISOString().startsWith(value) ? date : null;
}

function validateStudyWindow(value, errors) {
  const dates = value.match(/\b\d{4}-\d{2}-\d{2}\b/gu) ?? [];
  if (dates.length !== 2) {
    errors.push(
      "Study window must contain exactly two explicit YYYY-MM-DD dates.",
    );
    return;
  }
  const start = parseStrictDate(dates[0]);
  const end = parseStrictDate(dates[1]);
  if (!start || !end) {
    errors.push("Study window contains an invalid calendar date.");
  } else if (start.getTime() > end.getTime()) {
    errors.push("Study window start date must be on or before the end date.");
  }
  if (
    !/(?:\b(?:UTC|GMT)(?:[+-]\d{1,2}(?::\d{2})?)?\b|[A-Za-z_]+\/[A-Za-z_]+|[+-]\d{2}:\d{2})/u.test(
      value,
    )
  ) {
    errors.push("Study window must include an explicit timezone.");
  }
}

function parseReview(value) {
  const reviewer =
    value.match(/(?:reviewer|审核人|审阅人)\s*[:：]\s*([^;；,，]+)/iu)?.[1] ??
    "";
  const date =
    value.match(/(?:date|日期)\s*[:：]\s*(\d{4}-\d{2}-\d{2})/iu)?.[1] ?? "";
  const scope = value.match(/(?:scope|范围)\s*[:：]\s*([^;；]+)/iu)?.[1] ?? "";
  const outcome =
    value.match(/(?:outcome|结果|结论)\s*[:：]\s*([^;；]+)/iu)?.[1] ?? "";

  return {
    reviewer: normalize(reviewer),
    valid:
      isSubstantiveText(reviewer, { minCharacters: 2, minUnits: 1 }) &&
      Boolean(parseStrictDate(date)) &&
      isSubstantiveText(scope, { minCharacters: 8, minUnits: 3 }) &&
      isSubstantiveText(outcome, { minCharacters: 2, minUnits: 1 }) &&
      !/(?:automated test|test fixture|synthetic review|自动化测试)/iu.test(
        value,
      ),
  };
}

function validatePublicationGate(lines, errors) {
  if (!lines) {
    errors.push('Missing "Publication gate" section.');
    return;
  }

  const checkboxes = lines
    .map((line) => line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/u))
    .filter((match) => match !== null)
    .map((match) => ({
      checked: match[1].toLowerCase() === "x",
      text: match[2],
    }));

  if (checkboxes.length !== EXPECTED_PUBLICATION_CHECKS.length) {
    errors.push(
      `Publication gate has ${checkboxes.length} checklist items; exactly ${EXPECTED_PUBLICATION_CHECKS.length} canonical items are required.`,
    );
  }
  const actualTexts = checkboxes.map(({ text }) =>
    normalizeControlledText(text),
  );
  for (const expectedText of EXPECTED_PUBLICATION_CHECKS) {
    const normalizedExpected = normalizeControlledText(expectedText);
    if (!actualTexts.includes(normalizedExpected)) {
      errors.push(
        `Missing exact publication gate criterion: "${expectedText}".`,
      );
    }
  }
  const expectedTexts = new Set(
    EXPECTED_PUBLICATION_CHECKS.map((text) => normalizeControlledText(text)),
  );
  const unexpected = actualTexts.filter((text) => !expectedTexts.has(text));
  if (unexpected.length > 0) {
    errors.push(
      `${unexpected.length} publication gate item(s) do not exactly match the canonical template.`,
    );
  }
  const unchecked = checkboxes.filter(({ checked }) => !checked);
  if (unchecked.length > 0) {
    errors.push(
      `${unchecked.length} publication gate checkbox(es) remain unchecked.`,
    );
  }
}

export function analyzeUserTestingEvidence(markdown) {
  const errors = [];
  const status = markdown.match(/^Status:\s*(.+)$/imu)?.[1] ?? "";
  if (normalizeControlledText(status) !== COMPLETE_STATUS) {
    errors.push(
      `Status must exactly be "Status: **${COMPLETE_STATUS.slice(0, -1)}**." after evidence is verified.`,
    );
  }

  const unresolvedAnglePlaceholders = [...markdown.matchAll(/<([^>\r\n]+)>/gu)]
    .map((match) => match[0])
    .filter((token) => !/^<br\s*\/?\s*>$/iu.test(token));
  if (unresolvedAnglePlaceholders.length > 0) {
    errors.push(
      `Unresolved angle-bracket placeholder(s) remain (${unresolvedAnglePlaceholders.length}).`,
    );
  }

  const fields = parseRequiredFields(
    sectionLines(markdown, "Required study fields"),
    errors,
  );

  for (const [field, rule] of NARRATIVE_FIELD_RULES) {
    const value = fields.get(field) ?? "";
    if (!isSubstantiveText(value, rule)) {
      errors.push(
        `Narrative study field is not substantive enough: "${field}" (minimum ${rule.minCharacters} letters/numbers and ${rule.minUnits} semantic units).`,
      );
    }
  }

  validateStudyWindow(
    fields.get("Study window, with dates and timezone") ?? "",
    errors,
  );

  const invitedValue = fields.get("Participants invited") ?? "";
  const consentedValue = fields.get("Participants who consented") ?? "";
  const adultValue =
    fields.get("Consented adult Chinese-speaking learners (age 18+)") ?? "";
  const completedValue =
    fields.get("Participants who completed each task") ?? "";
  for (const [field, value] of [
    ["Participants invited", invitedValue],
    ["Participants who consented", consentedValue],
    ["Consented adult Chinese-speaking learners (age 18+)", adultValue],
    ["Participants who completed each task", completedValue],
  ]) {
    if (containsSignedNumber(value)) {
      errors.push(
        `Signed numbers are forbidden in participant field: "${field}".`,
      );
    }
  }

  const invitedCount = parseSingleCount(invitedValue);
  const consentedCount = parseSingleCount(consentedValue);
  const adultCount = parseSingleCount(adultValue);
  const completed = parseSingleRatio(completedValue);

  if (invitedCount === null) {
    errors.push(
      "Participants invited must contain exactly one explicit count.",
    );
  }
  if (consentedCount === null) {
    errors.push(
      "Participants who consented must contain exactly one explicit count.",
    );
  }
  if (adultCount === null || adultCount < 20) {
    errors.push(
      "Consented adult Chinese-speaking learner count must be an explicit integer of at least 20.",
    );
  }
  if (!completed) {
    errors.push(
      "Participants who completed each task must use an explicit completed/consented ratio.",
    );
  }
  if (
    invitedCount !== null &&
    consentedCount !== null &&
    invitedCount < consentedCount
  ) {
    errors.push("Participant counts must satisfy invited >= consented.");
  }
  if (
    consentedCount !== null &&
    adultCount !== null &&
    consentedCount < adultCount
  ) {
    errors.push(
      "Participant counts must satisfy consented >= consented adult Chinese-speaking learners.",
    );
  }
  if (completed) {
    if (completed.numerator > completed.denominator) {
      errors.push(
        "Completed participant numerator cannot exceed its denominator.",
      );
    }
    if (completed.numerator < 20) {
      errors.push(
        "At least 20 eligible adults must complete every required task.",
      );
    }
    if (adultCount !== null && completed.numerator > adultCount) {
      errors.push(
        "Completed participant count cannot exceed the eligible adult count.",
      );
    }
    if (consentedCount !== null && completed.denominator !== consentedCount) {
      errors.push(
        "The completed-task denominator must equal the consented participant count.",
      );
    }
  }

  const editionDistribution = parseNamedCounts(
    fields.get("Desktop vs Browser participant distribution") ?? "",
  );
  if (editionDistribution.containsSignedNumber) {
    errors.push(
      "Signed numbers are forbidden in Desktop/Browser distribution.",
    );
  }
  if (editionDistribution.invalid.length > 0) {
    errors.push(
      "Desktop/Browser distribution contains an entry without an explicit name and count.",
    );
  }
  const desktopEntries = editionDistribution.entries.filter(
    ({ normalizedName }) =>
      /^(?:desktop|desktop edition)$/u.test(normalizedName),
  );
  const browserEntries = editionDistribution.entries.filter(
    ({ normalizedName }) =>
      /^(?:browser|browser edition)$/u.test(normalizedName),
  );
  if (
    editionDistribution.entries.length !== 2 ||
    desktopEntries.length !== 1 ||
    browserEntries.length !== 1
  ) {
    errors.push(
      "Desktop/Browser distribution must contain exactly one explicit Desktop count and one explicit Browser count.",
    );
  } else if (
    consentedCount !== null &&
    desktopEntries[0].count + browserEntries[0].count !== consentedCount
  ) {
    errors.push(
      "Desktop and Browser participant counts must sum to the consented participant count.",
    );
  }

  const deviceField =
    fields.get(
      "Device and microphone environment categories, with a count for each",
    ) ?? "";
  const parsedDeviceCategories = parseNamedCounts(deviceField);
  if (parsedDeviceCategories.containsSignedNumber) {
    errors.push("Signed numbers are forbidden in device/microphone counts.");
  }
  const positiveDeviceCategories = new Map();
  let deviceNamesAreSemantic = true;
  for (const category of parsedDeviceCategories.entries) {
    if (
      !isSubstantiveText(category.name, { minCharacters: 5, minUnits: 2 }) ||
      /^(?:device|category|mic|test)?\s*[a-z0-9]?$/iu.test(category.name)
    ) {
      deviceNamesAreSemantic = false;
    }
    if (category.count > 0) {
      positiveDeviceCategories.set(category.normalizedName, category.count);
    }
  }
  if (
    parsedDeviceCategories.invalid.length > 0 ||
    !deviceNamesAreSemantic ||
    positiveDeviceCategories.size < 3
  ) {
    errors.push(
      "Document at least three semantically named, distinct device/microphone categories with non-zero counts using `Category: count; Category: count; Category: count`.",
    );
  }
  const deviceParticipantTotal = [...positiveDeviceCategories.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  if (consentedCount !== null && deviceParticipantTotal !== consentedCount) {
    errors.push(
      "Device/microphone category counts must sum to the consented participant count.",
    );
  }

  const taskResultsValue =
    fields.get("Task results as numerator/denominator, not percentage alone") ??
    "";
  if (containsSignedNumber(taskResultsValue)) {
    errors.push("Signed numbers are forbidden in task-result ratios.");
  }
  const taskResultRatios = parseAllRatios(taskResultsValue);
  if (taskResultRatios.length === 0) {
    errors.push(
      "Task results must include at least one explicit numerator/denominator ratio.",
    );
  } else {
    if (
      taskResultRatios.some(
        ({ numerator, denominator }) =>
          numerator > denominator ||
          (consentedCount !== null && denominator !== consentedCount),
      )
    ) {
      errors.push(
        "Every task-result ratio must be valid and use the consented participant count as denominator.",
      );
    }
    if (
      completed &&
      !taskResultRatios.some(
        ({ numerator, denominator }) =>
          numerator === completed.numerator &&
          denominator === completed.denominator,
      )
    ) {
      errors.push(
        "Task results must include the same completed/consented ratio reported in the completion field.",
      );
    }
  }

  const review1 = parseReview(
    fields.get("Independent review 1: reviewer, date, scope, and outcome") ??
      "",
  );
  const review2 = parseReview(
    fields.get("Independent review 2: reviewer, date, scope, and outcome") ??
      "",
  );
  if (!review1.valid) {
    errors.push(
      "Independent review 1 must include a reviewer, a real YYYY-MM-DD date, scope, and outcome.",
    );
  }
  if (!review2.valid) {
    errors.push(
      "Independent review 2 must include a reviewer, a real YYYY-MM-DD date, scope, and outcome.",
    );
  }
  if (
    review1.valid &&
    review2.valid &&
    review1.reviewer.toLowerCase() === review2.reviewer.toLowerCase()
  ) {
    errors.push("The two independent reviews must name distinct reviewers.");
  }

  validatePublicationGate(sectionLines(markdown, "Publication gate"), errors);

  return {
    ok: errors.length === 0,
    errors,
    metrics: {
      invitedParticipants: invitedCount,
      consentedParticipants: consentedCount,
      adultLearners: adultCount,
      completedParticipants: completed?.numerator ?? null,
      positiveDeviceCategories: positiveDeviceCategories.size,
      independentReviews: Number(review1.valid) + Number(review2.valid),
    },
  };
}

function parseArguments(argv) {
  let summaryPath = DEFAULT_SUMMARY;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--summary") {
      summaryPath = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--summary=")) {
      summaryPath = argument.slice("--summary=".length);
    } else if (argument === "--help") {
      console.log(
        "Usage: node scripts/user-testing-evidence-gate.mjs [--summary <markdown-file>]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!summaryPath) throw new Error("--summary requires a file path.");
  return path.resolve(process.cwd(), summaryPath);
}

function runCli() {
  let summaryPath;
  try {
    summaryPath = parseArguments(process.argv.slice(2));
    if (!fs.existsSync(summaryPath)) {
      throw new Error(`User-testing summary does not exist: ${summaryPath}`);
    }
    const result = analyzeUserTestingEvidence(
      fs.readFileSync(summaryPath, "utf8"),
    );
    if (!result.ok) {
      console.error(`User-testing evidence gate failed for ${summaryPath}:`);
      for (const error of result.errors) console.error(`- ${error}`);
      console.error(
        "Release and application readiness remain blocked. Supply only real, consented, anonymized aggregate evidence; never estimates or synthetic data.",
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      `User-testing evidence gate passed: ${result.metrics.adultLearners} adult Chinese-speaking learners, ${result.metrics.positiveDeviceCategories} device/microphone categories, ${result.metrics.independentReviews} independent reviews, and every publication checkbox complete.`,
    );
  } catch (error) {
    console.error(
      `User-testing evidence gate failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

runCli();
