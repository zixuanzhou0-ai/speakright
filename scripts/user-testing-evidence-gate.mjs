import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_SUMMARY = "docs/validation/USER_TESTING_SUMMARY.md";
const EXPECTED_PUBLIC_SUMMARY_SHA256 =
  "48545edd6ca630272fb746e147a077b43cd20ff1147cfb773bfe63953b0702ba";
const EXPECTED_STATUS = "maintainer-attested — not independently audited.";
const EXPECTED_ATTESTATION =
  "The SpeakRight maintainer reports that 20 people tested SpeakRight offline.";
const EXPECTED_ATTESTATION_BOUNDARY =
  "This is a maintainer-provided statement, not an independently audited study result. It supports only the narrow statement that offline testing occurred with the reported aggregate count. It does not establish active-user adoption, task-completion rates, broad device coverage, satisfaction, retention, pronunciation improvement, or learning efficacy.";

const REQUIRED_BOUNDARIES = [
  "This is a maintainer-provided statement, not an independently audited study result.",
  "No participant names, raw recordings, contact details, account identifiers, IP addresses, free-text responses, or local profile paths are requested or published.",
  "Exact study dates, participant ages, learner backgrounds, Desktop-versus-Browser distribution, device or microphone distribution, task results, and reviewer identities were not supplied and are not inferred.",
  "No private source-evidence path or participant-level proof is required for the v1.1.0 release or a Codex for Open Source application.",
  "Publishing a more detailed anonymized aggregate study is optional, not a prerequisite for releasing v1.1.0 or submitting a Codex for Open Source application.",
  "Missing details must be omitted rather than estimated.",
];

const REQUIRED_UNSUPPORTED_CLAIMS = [
  "active, registered, unique, or paying users",
  "a completion, success, satisfaction, or retention rate",
  "representative hardware or microphone coverage",
  "measured pronunciation improvement caused by SpeakRight",
  "clinical, therapeutic, examination, certification, or language-mastery validity",
];

const RETIRED_DETAILED_GATE_MARKERS = [
  "Required study fields",
  "Participants invited",
  "Consented adult Chinese-speaking learners (age 18+)",
  "Independent review 1",
  "Independent review 2",
  "At least 20 consented adult Chinese-speaking learners",
  "At least three distinct device or microphone environment categories",
  "application-readiness gate remains open",
];

const SENSITIVE_VALUE_PATTERNS = [
  {
    label: "email address",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  },
  {
    label: "Windows user-profile path",
    regex: /\b[A-Z]:\\(?:Users|Documents and Settings)\\[^\s|]+/iu,
  },
  {
    label: "POSIX user-profile path",
    regex: /\/(?:Users|home)\/[^\s|/]+/u,
  },
  {
    label: "participant recording link",
    regex: /https?:\/\/[^\s)]+\.(?:mp3|wav|m4a|ogg|webm)(?:\?[^\s)]*)?/iu,
  },
];

const FORBIDDEN_OUTCOME_ASSERTIONS = [
  /\b(?:all|most|every)\s+(?:testers?|participants?|people)\s+(?:completed|succeeded|improved|were\s+satisfied)\b/iu,
  /\b(?:testing|study|results?)\s+(?:proved|demonstrated|confirmed|validated|verified)\s+(?:that\s+)?SpeakRight\b/iu,
  /\bSpeakRight\s+(?:improved|increased|caused)\b/iu,
];

function normalize(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeControlledText(value) {
  return normalize(value)
    .replace(/[*_`]/gu, "")
    .normalize("NFKC")
    .toLowerCase();
}

function sectionText(markdown, title) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex(
    (line) => normalize(line).toLowerCase() === `## ${title}`.toLowerCase(),
  );
  if (start < 0) return null;

  const endOffset = lines
    .slice(start + 1)
    .findIndex((line) => /^#{1,2}\s+/u.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join("\n");
}

function includesControlled(markdown, expected) {
  return normalizeControlledText(markdown).includes(
    normalizeControlledText(expected),
  );
}

export function analyzeUserTestingEvidence(markdown) {
  const errors = [];
  const summarySha256 = createHash("sha256")
    .update(markdown, "utf8")
    .digest("hex");
  if (summarySha256 !== EXPECTED_PUBLIC_SUMMARY_SHA256) {
    errors.push(
      "The public user-testing summary must exactly match the privacy-reviewed canonical document; unreviewed additions are forbidden.",
    );
  }
  const status = markdown.match(/^Status:\s*(.+)$/imu)?.[1] ?? "";
  if (normalizeControlledText(status) !== EXPECTED_STATUS) {
    errors.push(
      `Status must exactly remain "Status: **${EXPECTED_STATUS.slice(0, -1)}**."; the public statement is maintainer-attested, not independently audited.`,
    );
  }

  const attestation = sectionText(markdown, "Maintainer attestation");
  if (!attestation) {
    errors.push('Missing "Maintainer attestation" section.');
  } else {
    const expectedAttestationSection = `${EXPECTED_ATTESTATION}\n\n${EXPECTED_ATTESTATION_BOUNDARY}`;
    if (
      normalizeControlledText(attestation) !==
      normalizeControlledText(expectedAttestationSection)
    ) {
      errors.push(
        "Maintainer attestation must retain only the exact, bounded offline-testing statement and audit limitation.",
      );
    }
  }

  const humanCountClaims = [
    ...markdown.matchAll(
      /\b(\d+)\s+(?:people|persons?|participants?|learners?|users?)\b/giu,
    ),
  ];
  if (
    humanCountClaims.length !== 1 ||
    Number(humanCountClaims[0]?.[1]) !== 20
  ) {
    errors.push(
      "The summary must contain exactly one human-count claim: the maintainer-reported offline count of 20 people.",
    );
  }

  for (const required of REQUIRED_BOUNDARIES) {
    if (!includesControlled(markdown, required)) {
      errors.push(`Missing required evidence/privacy boundary: "${required}"`);
    }
  }

  const claimLimits = sectionText(markdown, "Claim limits");
  if (!claimLimits) {
    errors.push('Missing "Claim limits" section.');
  } else {
    for (const claim of REQUIRED_UNSUPPORTED_CLAIMS) {
      if (!includesControlled(claimLimits, claim)) {
        errors.push(`Missing unsupported-claim boundary: "${claim}"`);
      }
    }
  }

  if (/\b\d+(?:\.\d+)?\s*%|\b\d+\s*\/\s*\d+\b/u.test(markdown)) {
    errors.push(
      "Task-success percentages and numerator/denominator results are not supported by the maintainer attestation.",
    );
  }

  const unresolvedPlaceholders = [...markdown.matchAll(/<([^>\r\n]+)>/gu)];
  if (unresolvedPlaceholders.length > 0) {
    errors.push(
      `Unresolved angle-bracket placeholder(s) remain (${unresolvedPlaceholders.length}); missing details must be omitted, not requested or estimated.`,
    );
  }

  for (const marker of RETIRED_DETAILED_GATE_MARKERS) {
    if (includesControlled(markdown, marker)) {
      errors.push(
        `Retired detailed-study release requirement must not return: "${marker}".`,
      );
    }
  }

  for (const { label, regex } of SENSITIVE_VALUE_PATTERNS) {
    if (regex.test(markdown)) {
      errors.push(`Public user-testing summary contains a ${label}.`);
    }
  }

  for (const pattern of FORBIDDEN_OUTCOME_ASSERTIONS) {
    if (pattern.test(markdown)) {
      errors.push(
        "The maintainer attestation must not be expanded into a task-success, satisfaction, or learning-outcome claim.",
      );
      break;
    }
  }

  if (
    /(?:evidence|results?|study)\s+(?:is|are|was|were)?\s*(?:independently\s+)?(?:verified|validated|audited)/iu.test(
      markdown,
    )
  ) {
    errors.push(
      "The maintainer statement must not be described as verified, validated, or independently audited evidence.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    metrics: {
      maintainerReportedOfflineParticipants: 20,
      independentlyAudited: false,
      outcomeMetricsPublished: false,
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
  try {
    const summaryPath = parseArguments(process.argv.slice(2));
    if (!fs.existsSync(summaryPath)) {
      throw new Error(`User-testing summary does not exist: ${summaryPath}`);
    }
    const result = analyzeUserTestingEvidence(
      fs.readFileSync(summaryPath, "utf8"),
    );
    if (!result.ok) {
      console.error(
        `User-testing claim-safety gate failed for ${summaryPath}:`,
      );
      for (const error of result.errors) console.error(`- ${error}`);
      console.error(
        "Release is blocked only until the public claim and privacy boundary is corrected; no participant-level proof or additional study detail is required.",
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      "User-testing claim-safety gate passed: maintainer-reported offline testing with 20 people is labelled not independently audited; no outcome metric or participant-level proof is published.",
    );
  } catch (error) {
    console.error(
      `User-testing claim-safety gate failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

runCli();
