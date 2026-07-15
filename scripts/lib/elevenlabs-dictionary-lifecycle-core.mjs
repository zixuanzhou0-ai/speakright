import { createHash } from "node:crypto";

export const DICTIONARY_LIFECYCLE_VERSION = 1;

const OPEN_DICTIONARY_STATES = new Set([
  "creating",
  "active",
  "archiving",
  "cleanup-required",
]);

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

function normalizedRule(rule) {
  return {
    type: "phoneme",
    alphabet: String(rule?.alphabet ?? "")
      .trim()
      .toLocaleLowerCase("en-US"),
    stringToReplace: String(rule?.stringToReplace ?? "")
      .normalize("NFKC")
      .trim(),
    phoneme: String(rule?.phoneme ?? "").trim(),
  };
}

function rulePayload(rules) {
  return [...rules]
    .map(normalizedRule)
    .sort((left, right) =>
      [left.stringToReplace, left.alphabet, left.phoneme]
        .join("\u0000")
        .localeCompare(
          [right.stringToReplace, right.alphabet, right.phoneme].join("\u0000"),
          "en-US",
        ),
    );
}

export function computeDictionaryRulesSha256(rules) {
  return digest(rulePayload(rules));
}

function dictionaryPlanPayload(plan) {
  return {
    version: plan.version,
    basePlanSha256: plan.basePlanSha256,
    thirdPlanSha256: plan.thirdPlanSha256,
    dictionaryCount: plan.dictionaryCount,
    candidateCount: plan.candidateCount,
    dictionaries: plan.dictionaries.map((dictionary) => ({
      languageId: dictionary.languageId,
      name: dictionary.name,
      ruleCount: dictionary.ruleCount,
      rulesSha256: dictionary.rulesSha256,
      rules: dictionary.rules,
      candidateIds: dictionary.candidateIds,
    })),
  };
}

export function computeDictionaryPlanSha256(plan) {
  return digest(dictionaryPlanPayload(plan));
}

function safeLanguageToken(languageId) {
  return String(languageId)
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-");
}

export function buildThirdRoundDictionaryPlan(thirdPlan) {
  if (!thirdPlan?.thirdPlanSha256) {
    throw new Error("Dictionary planning requires an immutable third-plan SHA");
  }
  const candidates = thirdPlan.candidates ?? [];
  const byLanguage = new Map();
  for (const candidate of candidates) {
    if (candidate.generationRound !== 3 || candidate.modelId !== "eleven_v3") {
      throw new Error(
        `Dictionary plan contains a non-eleven_v3 round-C candidate: ${candidate.candidateId}`,
      );
    }
    if (!candidate.pronunciationDictionary) {
      throw new Error(
        `Round-C candidate is missing a dictionary rule: ${candidate.candidateId}`,
      );
    }
    const values = byLanguage.get(candidate.languageId) ?? [];
    values.push(candidate);
    byLanguage.set(candidate.languageId, values);
  }

  const dictionaries = [...byLanguage.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([languageId, languageCandidates]) => {
      const ruleByText = new Map();
      for (const candidate of languageCandidates) {
        const rule = normalizedRule(candidate.pronunciationDictionary);
        if (!rule.alphabet || !rule.stringToReplace || !rule.phoneme) {
          throw new Error(
            `Incomplete dictionary rule: ${candidate.candidateId}`,
          );
        }
        const key = rule.stringToReplace
          .normalize("NFKC")
          .toLocaleLowerCase(languageId);
        const prior = ruleByText.get(key);
        if (prior && JSON.stringify(prior) !== JSON.stringify(rule)) {
          throw new Error(
            `Conflicting pronunciation rules for ${languageId}:${rule.stringToReplace}`,
          );
        }
        ruleByText.set(key, rule);
      }
      const rules = rulePayload([...ruleByText.values()]);
      const candidateIds = languageCandidates
        .map((candidate) => candidate.candidateId)
        .sort((left, right) => left.localeCompare(right, "en-US"));
      return {
        languageId,
        name: `SpeakRight-round-c-${safeLanguageToken(languageId)}-${thirdPlan.thirdPlanSha256.slice(0, 16)}`,
        description: `Temporary SpeakRight round-C dictionary for ${languageId}; thirdPlan=${thirdPlan.thirdPlanSha256}`,
        ruleCount: rules.length,
        rulesSha256: computeDictionaryRulesSha256(rules),
        rules,
        candidateIds,
      };
    });

  const plan = {
    version: DICTIONARY_LIFECYCLE_VERSION,
    generatedAt: new Date().toISOString(),
    basePlanSha256: thirdPlan.basePlanSha256,
    thirdPlanSha256: thirdPlan.thirdPlanSha256,
    dictionaryCount: dictionaries.length,
    candidateCount: candidates.length,
    dictionaries,
  };
  return { ...plan, dictionaryPlanSha256: computeDictionaryPlanSha256(plan) };
}

export function assertThirdRoundDictionaryPlan(
  plan,
  thirdPlan,
  { expectedRulesByLanguage = null } = {},
) {
  const rebuilt = buildThirdRoundDictionaryPlan(thirdPlan);
  if (computeDictionaryPlanSha256(plan) !== plan.dictionaryPlanSha256) {
    throw new Error("Dictionary plan SHA does not match its immutable payload");
  }
  if (rebuilt.dictionaryPlanSha256 !== plan.dictionaryPlanSha256) {
    throw new Error(
      "Dictionary plan no longer matches the current third-round plan",
    );
  }
  if (expectedRulesByLanguage) {
    const actual = Object.fromEntries(
      plan.dictionaries.map((item) => [item.languageId, item.ruleCount]),
    );
    if (JSON.stringify(actual) !== JSON.stringify(expectedRulesByLanguage)) {
      throw new Error(
        `Dictionary rule counts changed: expected ${JSON.stringify(expectedRulesByLanguage)}, received ${JSON.stringify(actual)}`,
      );
    }
  }
  return plan;
}

function emptyRegistry() {
  return {
    version: DICTIONARY_LIFECYCLE_VERSION,
    updatedAt: new Date().toISOString(),
    sessions: [],
  };
}

export function normalizeDictionaryLifecycleRegistry(registry) {
  if (!registry) return emptyRegistry();
  if (registry.version !== DICTIONARY_LIFECYCLE_VERSION) {
    throw new Error(
      `Unsupported dictionary lifecycle version: ${registry.version}`,
    );
  }
  return {
    ...registry,
    sessions: [...(registry.sessions ?? [])],
  };
}

export function findOpenDictionaryEntries(
  registry,
  { excludingSessionId = null } = {},
) {
  const current = normalizeDictionaryLifecycleRegistry(registry);
  return current.sessions.flatMap((session) =>
    (session.dictionaries ?? [])
      .filter((dictionary) => OPEN_DICTIONARY_STATES.has(dictionary.status))
      .filter(() => session.sessionId !== excludingSessionId)
      .map((dictionary) => ({
        sessionId: session.sessionId,
        thirdPlanSha256: session.thirdPlanSha256,
        dictionaryPlanSha256: session.dictionaryPlanSha256,
        ...dictionary,
      })),
  );
}

export function beginDictionaryLifecycleSession(registry, plan, sessionId) {
  const current = normalizeDictionaryLifecycleRegistry(registry);
  if (!sessionId) throw new Error("Dictionary lifecycle requires a session ID");
  if (current.sessions.some((session) => session.sessionId === sessionId)) {
    throw new Error(
      `Dictionary lifecycle session already exists: ${sessionId}`,
    );
  }
  const now = new Date().toISOString();
  const session = {
    sessionId,
    basePlanSha256: plan.basePlanSha256,
    thirdPlanSha256: plan.thirdPlanSha256,
    dictionaryPlanSha256: plan.dictionaryPlanSha256,
    status: "creating",
    createdAt: now,
    completedAt: null,
    dictionaries: plan.dictionaries.map((dictionary) => ({
      languageId: dictionary.languageId,
      name: dictionary.name,
      rulesSha256: dictionary.rulesSha256,
      ruleCount: dictionary.ruleCount,
      dictionaryId: null,
      versionId: null,
      status: "creating",
      createdAt: null,
      archivedAt: null,
      lastError: null,
      cleanupInstruction: null,
    })),
  };
  return {
    registry: {
      ...current,
      updatedAt: now,
      sessions: [...current.sessions, session],
    },
    session,
  };
}

function updateDictionaryEntry(registry, sessionId, languageId, updater) {
  const current = normalizeDictionaryLifecycleRegistry(registry);
  let matched = false;
  const sessions = current.sessions.map((session) => {
    if (session.sessionId !== sessionId) return session;
    const dictionaries = session.dictionaries.map((dictionary) => {
      if (dictionary.languageId !== languageId) return dictionary;
      matched = true;
      return updater(dictionary);
    });
    return { ...session, dictionaries };
  });
  if (!matched) {
    throw new Error(
      `Unknown dictionary lifecycle entry: ${sessionId}/${languageId}`,
    );
  }
  return { ...current, updatedAt: new Date().toISOString(), sessions };
}

export function markDictionaryActive(
  registry,
  { sessionId, languageId, dictionaryId, versionId },
) {
  if (!dictionaryId || !versionId) {
    throw new Error("Active dictionary requires dictionary and version IDs");
  }
  return updateDictionaryEntry(registry, sessionId, languageId, (entry) => ({
    ...entry,
    dictionaryId,
    versionId,
    status: "active",
    createdAt: new Date().toISOString(),
    lastError: null,
    cleanupInstruction: null,
  }));
}

export function markDictionaryArchiving(registry, { sessionId, languageId }) {
  return updateDictionaryEntry(registry, sessionId, languageId, (entry) => ({
    ...entry,
    status: "archiving",
    lastError: null,
  }));
}

export function markDictionaryArchived(registry, { sessionId, languageId }) {
  const updated = updateDictionaryEntry(
    registry,
    sessionId,
    languageId,
    (entry) => ({
      ...entry,
      status: "archived",
      archivedAt: new Date().toISOString(),
      lastError: null,
      cleanupInstruction: null,
    }),
  );
  const sessions = updated.sessions.map((session) => {
    if (session.sessionId !== sessionId) return session;
    const completed = session.dictionaries.every(
      (entry) => entry.status === "archived",
    );
    return completed
      ? {
          ...session,
          status: "archived",
          completedAt: new Date().toISOString(),
        }
      : session;
  });
  return { ...updated, sessions };
}

export function markDictionaryCleanupRequired(
  registry,
  { sessionId, languageId, error },
) {
  const message = error instanceof Error ? error.message : String(error);
  return updateDictionaryEntry(registry, sessionId, languageId, (entry) => ({
    ...entry,
    status: "cleanup-required",
    lastError: message,
    cleanupInstruction: entry.dictionaryId
      ? `Archive ElevenLabs pronunciation dictionary ${entry.dictionaryId} (version ${entry.versionId ?? "unknown"}) before select/promote.`
      : `Find the temporary ElevenLabs dictionary named ${entry.name}, archive it, then record its dictionary/version IDs before select/promote.`,
  }));
}

export function getActiveDictionaryLocator(
  registry,
  { sessionId, languageId },
) {
  const current = normalizeDictionaryLifecycleRegistry(registry);
  const session = current.sessions.find((item) => item.sessionId === sessionId);
  const dictionary = session?.dictionaries.find(
    (item) => item.languageId === languageId,
  );
  if (!dictionary || dictionary.status !== "active") {
    throw new Error(`No active dictionary for ${sessionId}/${languageId}`);
  }
  if (!dictionary.dictionaryId || !dictionary.versionId) {
    throw new Error(
      `Active dictionary locator is incomplete for ${languageId}`,
    );
  }
  return {
    pronunciation_dictionary_id: dictionary.dictionaryId,
    version_id: dictionary.versionId,
  };
}

export function assertDictionaryLifecycleClear(registry) {
  const open = findOpenDictionaryEntries(registry);
  if (open.length > 0) {
    const detail = open
      .map(
        (entry) =>
          `${entry.languageId}:${entry.status}:${entry.dictionaryId ?? entry.name}`,
      )
      .join(", ");
    throw new Error(
      `Pronunciation dictionary cleanup is incomplete: ${detail}`,
    );
  }
  return true;
}

export function assertGeneratedDictionaryBinding({
  candidate,
  generated,
  dictionaryPlan,
  registry,
}) {
  if (candidate?.generationRound !== 3 || candidate?.modelId !== "eleven_v3") {
    throw new Error(
      "Generated dictionary binding requires an eleven_v3 round-C candidate",
    );
  }
  if (
    !dictionaryPlan?.dictionaryPlanSha256 ||
    computeDictionaryPlanSha256(dictionaryPlan) !==
      dictionaryPlan.dictionaryPlanSha256
  ) {
    throw new Error(
      "Generated dictionary binding references an invalid dictionary plan",
    );
  }

  const planned = dictionaryPlan.dictionaries.find(
    (dictionary) => dictionary.languageId === candidate.languageId,
  );
  if (!planned || !planned.candidateIds.includes(candidate.candidateId)) {
    throw new Error(
      `Generated candidate is not present in the dictionary plan: ${candidate.candidateId}`,
    );
  }

  const binding = generated?.pronunciationDictionaryLifecycle;
  if (!binding || typeof binding !== "object") {
    throw new Error(
      `Generated candidate is missing dictionary lifecycle binding: ${candidate.candidateId}`,
    );
  }
  if (binding.thirdPlanSha256 !== dictionaryPlan.thirdPlanSha256) {
    throw new Error(
      "Generated dictionary binding third-plan SHA does not match",
    );
  }
  if (binding.dictionaryPlanSha256 !== dictionaryPlan.dictionaryPlanSha256) {
    throw new Error("Generated dictionary binding plan SHA does not match");
  }
  if (binding.rulesSha256 !== planned.rulesSha256) {
    throw new Error("Generated dictionary binding rules SHA does not match");
  }
  if (!binding.sessionId || !binding.dictionaryId || !binding.versionId) {
    throw new Error(
      "Generated dictionary binding is missing lifecycle identifiers",
    );
  }

  const current = normalizeDictionaryLifecycleRegistry(registry);
  const session = current.sessions.find(
    (entry) => entry.sessionId === binding.sessionId,
  );
  if (!session) {
    throw new Error(
      `Generated dictionary lifecycle session is missing: ${binding.sessionId}`,
    );
  }
  if (
    session.thirdPlanSha256 !== dictionaryPlan.thirdPlanSha256 ||
    session.dictionaryPlanSha256 !== dictionaryPlan.dictionaryPlanSha256
  ) {
    throw new Error(
      "Generated dictionary lifecycle session does not match the immutable plan",
    );
  }
  if (session.status !== "archived") {
    throw new Error(
      `Generated dictionary lifecycle session is not archived: ${session.status}`,
    );
  }

  const dictionary = session.dictionaries.find(
    (entry) => entry.languageId === candidate.languageId,
  );
  if (!dictionary) {
    throw new Error(
      `Generated dictionary lifecycle entry is missing: ${candidate.languageId}`,
    );
  }
  if (
    dictionary.dictionaryId !== binding.dictionaryId ||
    dictionary.versionId !== binding.versionId
  ) {
    throw new Error(
      "Generated dictionary lifecycle identifiers do not match the registry",
    );
  }
  if (
    dictionary.rulesSha256 !== planned.rulesSha256 ||
    dictionary.rulesSha256 !== binding.rulesSha256
  ) {
    throw new Error(
      "Generated dictionary lifecycle rules do not match the registry",
    );
  }
  if (dictionary.status !== "archived" || !dictionary.archivedAt) {
    throw new Error(
      `Generated dictionary lifecycle entry is not archived: ${dictionary.status}`,
    );
  }

  const locator = binding.locator;
  if (
    !locator ||
    locator.pronunciation_dictionary_id !== binding.dictionaryId ||
    locator.version_id !== binding.versionId
  ) {
    throw new Error(
      "Generated dictionary binding locator does not match its lifecycle identifiers",
    );
  }
  return true;
}
export function dictionaryLifecycleEvent(type, entry, detail = {}) {
  return {
    version: DICTIONARY_LIFECYCLE_VERSION,
    type,
    createdAt: new Date().toISOString(),
    sessionId: entry.sessionId,
    basePlanSha256: entry.basePlanSha256 ?? null,
    thirdPlanSha256: entry.thirdPlanSha256,
    dictionaryPlanSha256: entry.dictionaryPlanSha256,
    languageId: entry.languageId ?? null,
    rulesSha256: entry.rulesSha256 ?? null,
    dictionaryId: entry.dictionaryId ?? null,
    versionId: entry.versionId ?? null,
    status: entry.status ?? null,
    ...detail,
  };
}
