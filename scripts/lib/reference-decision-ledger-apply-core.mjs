import { createHash } from "node:crypto";

export const REFERENCE_LEDGER_APPLY_POLICY_VERSION = 1;

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireString(value, label) {
  const normalized = String(value ?? "")
    .normalize("NFC")
    .trim();
  if (
    !normalized ||
    Array.from(normalized).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint <= 31 || codePoint === 127;
    })
  ) {
    throw new Error(`${label} must be a non-empty string without controls`);
  }
  return normalized;
}

function decisionKey(entry) {
  const languageId = requireString(entry?.languageId, "Decision languageId");
  const text = requireString(entry?.text, "Decision text");
  return `${languageId}\u0000${text.toLocaleLowerCase(languageId)}`;
}

function buildUniqueDecisionMap(entries, label) {
  if (!Array.isArray(entries))
    throw new Error(`${label} entries must be an array`);
  const map = new Map();
  for (const entry of entries) {
    const key = decisionKey(entry);
    if (map.has(key))
      throw new Error(`${label} contains duplicate decision: ${key}`);
    map.set(key, entry);
  }
  return map;
}

function validateConfirmedDecision(entry, label) {
  requireString(entry.canonicalIpa, `${label} canonicalIpa`);
  if (entry.status !== "two-source-confirmed") {
    throw new Error(`${label} must have status=two-source-confirmed`);
  }
  if (!Array.isArray(entry.sources) || entry.sources.length < 2) {
    throw new Error(`${label} must contain at least two reference sources`);
  }
  const independenceGroups = new Set();
  for (const [index, source] of entry.sources.entries()) {
    const sourceLabel = `${label} source ${index + 1}`;
    requireString(source.publisherId, `${sourceLabel} publisherId`);
    independenceGroups.add(
      requireString(
        source.independenceGroup,
        `${sourceLabel} independenceGroup`,
      ).toLocaleLowerCase("en-US"),
    );
    requireString(source.revisionOrDate, `${sourceLabel} revisionOrDate`);
    requireString(source.value, `${sourceLabel} value`);
  }
  if (independenceGroups.size < 2) {
    throw new Error(`${label} does not contain two independent source groups`);
  }
}

function validateSemanticPlanSha(plan, fileDigests) {
  const claimed = requireString(plan.planSha256, "Decision plan SHA-256");
  if (!/^[0-9a-f]{64}$/u.test(claimed)) {
    throw new Error(
      "Decision plan SHA-256 must be 64 lowercase hex characters",
    );
  }
  const {
    planSha256: _claimed,
    networkRequestsMade: _networkRequestsMade,
    paidCallsMade: _paidCallsMade,
    ...deterministic
  } = plan;
  const computed = sha256(stableStringify(deterministic));
  if (computed !== claimed) {
    throw new Error(
      "Decision plan SHA-256 does not match its immutable payload",
    );
  }
  if (plan.networkRequestsMade !== 0 || plan.paidCallsMade !== 0) {
    throw new Error(
      "Decision plan must record zero network requests and paid calls",
    );
  }
  if (plan.expectedLedgerSha256 !== undefined) {
    assertExactSha(
      "Decision plan expected ledger SHA-256",
      plan.expectedLedgerSha256,
      fileDigests?.ledgerFileSha256,
    );
  }
  if (plan.inputManifestSha256 !== undefined) {
    assertExactSha(
      "Decision plan input manifest SHA-256",
      plan.inputManifestSha256,
      fileDigests?.inputManifestFileSha256,
    );
  }
  return claimed;
}

function assertPatchBindings(patch, plan) {
  for (const key of [
    "sourceProposalSha256",
    "expectedLedgerSha256",
    "inputManifestSha256",
  ]) {
    if (plan[key] !== undefined && patch[key] !== plan[key]) {
      throw new Error(
        "Ledger patch " + key + " is not bound to the decision plan",
      );
    }
  }
}

function assertPatchMatchesPlan(patchEntries, planEntries) {
  const patchMap = buildUniqueDecisionMap(patchEntries, "Ledger patch");
  const planMap = buildUniqueDecisionMap(planEntries, "Decision plan");
  if (patchMap.size !== planMap.size) {
    throw new Error(
      "Ledger patch entry count does not match the decision plan",
    );
  }
  for (const [key, planned] of planMap) {
    const patched = patchMap.get(key);
    if (!patched || stableStringify(patched) !== stableStringify(planned)) {
      throw new Error(`Ledger patch differs from the reviewed plan for ${key}`);
    }
  }
  return patchMap;
}

function sortDecisions(entries) {
  return [...entries].sort(
    (left, right) =>
      left.languageId.localeCompare(right.languageId, "en") ||
      left.text.localeCompare(right.text, left.languageId),
  );
}

export function buildReferenceLedgerApplication({
  ledger,
  patch,
  plan,
  fileDigests = {},
}) {
  if (ledger?.version !== 1 || patch?.version !== 1 || plan?.version !== 1) {
    throw new Error("Ledger, patch, and decision plan must all use version 1");
  }
  const planSha256 = validateSemanticPlanSha(plan, fileDigests);
  if (!String(patch.revision ?? "").endsWith(planSha256.slice(0, 12))) {
    throw new Error(
      "Ledger patch revision is not bound to the decision plan SHA",
    );
  }
  assertPatchBindings(patch, plan);
  if (!Array.isArray(plan.decisions)) {
    throw new Error("Decision plan must expose a decisions array");
  }
  const patchMap = assertPatchMatchesPlan(patch.entries, plan.decisions);
  for (const [key, entry] of patchMap) {
    validateConfirmedDecision(entry, `Ledger patch decision ${key}`);
  }

  const ledgerMap = buildUniqueDecisionMap(ledger.entries, "Formal ledger");
  for (const [key, entry] of ledgerMap) {
    validateConfirmedDecision(entry, `Formal ledger decision ${key}`);
  }
  const addedKeys = [];
  const unchangedKeys = [];
  for (const [key, entry] of patchMap) {
    const existing = ledgerMap.get(key);
    if (!existing) {
      ledgerMap.set(key, entry);
      addedKeys.push(key);
    } else if (stableStringify(existing) === stableStringify(entry)) {
      unchangedKeys.push(key);
    } else {
      throw new Error(
        `Formal ledger contains a conflicting decision for ${key}`,
      );
    }
  }

  const entries = sortDecisions(ledgerMap.values());
  const entriesSha256 = sha256(stableStringify(entries));
  const mergedLedger = {
    version: 1,
    revision: `reference-decisions-${planSha256.slice(0, 12)}-${entriesSha256.slice(0, 12)}`,
    warning: requireString(ledger.warning, "Formal ledger warning"),
    entries,
  };
  const deterministic = {
    version: REFERENCE_LEDGER_APPLY_POLICY_VERSION,
    effect: "formal-ledger-application",
    planSha256,
    patchRevision: patch.revision,
    fileDigests,
    existingEntryCount: ledgerMap.size - addedKeys.length,
    patchEntryCount: patchMap.size,
    addedEntryCount: addedKeys.length,
    unchangedEntryCount: unchangedKeys.length,
    mergedEntryCount: entries.length,
    addedKeys: addedKeys.sort((left, right) => left.localeCompare(right, "en")),
    unchangedKeys: unchangedKeys.sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
    mergedLedgerSha256: sha256(stableStringify(mergedLedger)),
  };
  return {
    ...deterministic,
    applicationSha256: sha256(stableStringify(deterministic)),
    mergedLedger,
    networkRequestsMade: 0,
    paidCallsMade: 0,
  };
}

function assertExactSha(label, expected, actual) {
  if (!/^[0-9a-f]{64}$/u.test(String(expected ?? ""))) {
    throw new Error(`${label} is required as 64 lowercase hex characters`);
  }
  if (expected !== actual)
    throw new Error(`${label} does not match current input`);
}

export function assertReferenceLedgerApplyAuthorization({
  command,
  confirm,
  expectedPlanSha256,
  expectedPatchSha256,
  expectedLedgerSha256,
  actualPlanSha256,
  actualPatchSha256,
  actualLedgerSha256,
}) {
  if (command === "plan") {
    if (confirm)
      throw new Error("--confirm is invalid for the read-only plan command");
    return "plan";
  }
  if (command !== "apply") {
    throw new Error("Use plan or apply");
  }
  if (!confirm) throw new Error("Formal ledger apply requires --confirm");
  assertExactSha("--plan-sha", expectedPlanSha256, actualPlanSha256);
  assertExactSha("--patch-sha", expectedPatchSha256, actualPatchSha256);
  assertExactSha("--ledger-sha", expectedLedgerSha256, actualLedgerSha256);
  return "apply";
}
