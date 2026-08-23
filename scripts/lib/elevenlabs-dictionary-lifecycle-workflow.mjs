import {
  assertDictionaryLifecycleClear,
  beginDictionaryLifecycleSession,
  dictionaryLifecycleEvent,
  findOpenDictionaryEntries,
  getActiveDictionaryLocator,
  markDictionaryActive,
  markDictionaryArchived,
  markDictionaryArchiving,
  markDictionaryCleanupRequired,
  normalizeDictionaryLifecycleRegistry,
} from "./elevenlabs-dictionary-lifecycle-core.mjs";

function lifecycleEntry(registry, sessionId, languageId) {
  const session = registry.sessions.find(
    (item) => item.sessionId === sessionId,
  );
  const dictionary = session?.dictionaries.find(
    (item) => item.languageId === languageId,
  );
  if (!session || !dictionary) {
    throw new Error(`Missing lifecycle entry ${sessionId}/${languageId}`);
  }
  return {
    sessionId,
    basePlanSha256: session.basePlanSha256,
    thirdPlanSha256: session.thirdPlanSha256,
    dictionaryPlanSha256: session.dictionaryPlanSha256,
    ...dictionary,
  };
}

async function persistedTransition(
  state,
  type,
  { persistRegistry, appendEvent },
) {
  await persistRegistry(state.registry);
  if (state.entry) {
    await appendEvent(
      dictionaryLifecycleEvent(type, state.entry, state.detail),
    );
  }
}

function activeRemoteDictionaries(response) {
  return (response?.pronunciationDictionaries ?? []).filter(
    (dictionary) => !(Number(dictionary.archivedTimeUnix) > 0),
  );
}

async function archiveKnownEntry({
  registry,
  entry,
  apiKey,
  archiveDictionary,
  persistRegistry,
  appendEvent,
}) {
  let current = markDictionaryArchiving(registry, entry);
  let currentEntry = lifecycleEntry(current, entry.sessionId, entry.languageId);
  await persistedTransition(
    { registry: current, entry: currentEntry },
    "dictionary-archive-started",
    { persistRegistry, appendEvent },
  );
  try {
    await archiveDictionary({
      apiKey,
      pronunciationDictionaryId: currentEntry.dictionaryId,
    });
    current = markDictionaryArchived(current, entry);
    currentEntry = lifecycleEntry(current, entry.sessionId, entry.languageId);
    await persistedTransition(
      { registry: current, entry: currentEntry },
      "dictionary-archived",
      { persistRegistry, appendEvent },
    );
    return current;
  } catch (error) {
    current = markDictionaryCleanupRequired(current, { ...entry, error });
    currentEntry = lifecycleEntry(current, entry.sessionId, entry.languageId);
    await persistedTransition(
      {
        registry: current,
        entry: currentEntry,
        detail: { error: currentEntry.lastError },
      },
      "dictionary-cleanup-required",
      { persistRegistry, appendEvent },
    );
    const cleanup = new Error(currentEntry.cleanupInstruction);
    cleanup.cause = error;
    cleanup.registry = current;
    throw cleanup;
  }
}

function oneDictionaryRecoveryPlan(dictionaryPlan, plannedDictionary) {
  return {
    ...dictionaryPlan,
    dictionaries: [plannedDictionary],
    dictionaryCount: 1,
  };
}

async function adoptRemoteDictionary({
  registry,
  dictionaryPlan,
  plannedDictionary,
  remote,
  sessionId,
  persistRegistry,
  appendEvent,
}) {
  const result = beginDictionaryLifecycleSession(
    registry,
    oneDictionaryRecoveryPlan(dictionaryPlan, plannedDictionary),
    sessionId,
  );
  let current = result.registry;
  current = markDictionaryActive(current, {
    sessionId,
    languageId: plannedDictionary.languageId,
    dictionaryId: remote.id,
    versionId: remote.latestVersionId,
  });
  const entry = lifecycleEntry(
    current,
    sessionId,
    plannedDictionary.languageId,
  );
  await persistedTransition(
    {
      registry: current,
      entry,
      detail: { recoveredByExactName: true },
    },
    "dictionary-recovered",
    { persistRegistry, appendEvent },
  );
  return current;
}

async function discoverEntryDictionary({
  registry,
  entry,
  apiKey,
  listDictionaries,
  persistRegistry,
  appendEvent,
}) {
  const response = await listDictionaries({ apiKey, exactName: entry.name });
  const active = activeRemoteDictionaries(response);
  if (active.length === 0) {
    const current = markDictionaryArchived(registry, entry);
    await persistedTransition(
      {
        registry: current,
        entry: lifecycleEntry(current, entry.sessionId, entry.languageId),
        detail: { noRemoteDictionaryFound: true },
      },
      "dictionary-creation-not-observed",
      { persistRegistry, appendEvent },
    );
    return { registry: current, additional: [] };
  }
  const [first, ...additional] = active;
  const current = markDictionaryActive(registry, {
    sessionId: entry.sessionId,
    languageId: entry.languageId,
    dictionaryId: first.id,
    versionId: first.latestVersionId,
  });
  await persistedTransition(
    {
      registry: current,
      entry: lifecycleEntry(current, entry.sessionId, entry.languageId),
      detail: { recoveredByExactName: true },
    },
    "dictionary-recovered",
    { persistRegistry, appendEvent },
  );
  return { registry: current, additional };
}

export async function cleanupTemporaryDictionaries({
  registry,
  dictionaryPlan,
  apiKey,
  listDictionaries,
  archiveDictionary,
  persistRegistry,
  appendEvent,
  onlySessionId = null,
  discoverPlannedNames = true,
}) {
  let current = normalizeDictionaryLifecycleRegistry(registry);
  const open = findOpenDictionaryEntries(current).filter(
    (entry) => !onlySessionId || entry.sessionId === onlySessionId,
  );
  for (const initialEntry of open) {
    let entry = initialEntry;
    let additional = [];
    if (!entry.dictionaryId) {
      const discovered = await discoverEntryDictionary({
        registry: current,
        entry,
        apiKey,
        listDictionaries,
        persistRegistry,
        appendEvent,
      });
      current = discovered.registry;
      additional = discovered.additional;
      entry = lifecycleEntry(current, entry.sessionId, entry.languageId);
    }
    if (entry.status !== "archived") {
      current = await archiveKnownEntry({
        registry: current,
        entry,
        apiKey,
        archiveDictionary,
        persistRegistry,
        appendEvent,
      });
    }
    for (const [index, remote] of additional.entries()) {
      const planned = dictionaryPlan.dictionaries.find(
        (item) => item.name === entry.name,
      );
      if (!planned) {
        throw new Error(
          `Cannot bind recovered dictionary to current rules: ${entry.name}`,
        );
      }
      const recoverySessionId = `recovered-${remote.id}-${index}`;
      current = await adoptRemoteDictionary({
        registry: current,
        dictionaryPlan,
        plannedDictionary: planned,
        remote,
        sessionId: recoverySessionId,
        persistRegistry,
        appendEvent,
      });
      current = await archiveKnownEntry({
        registry: current,
        entry: lifecycleEntry(current, recoverySessionId, planned.languageId),
        apiKey,
        archiveDictionary,
        persistRegistry,
        appendEvent,
      });
    }
  }

  if (discoverPlannedNames && !onlySessionId) {
    for (const planned of dictionaryPlan.dictionaries) {
      const response = await listDictionaries({
        apiKey,
        exactName: planned.name,
      });
      const knownIds = new Set(
        current.sessions.flatMap((session) =>
          session.dictionaries.map((dictionary) => dictionary.dictionaryId),
        ),
      );
      const unknown = activeRemoteDictionaries(response).filter(
        (remote) => !knownIds.has(remote.id),
      );
      for (const [index, remote] of unknown.entries()) {
        const recoverySessionId = `recovered-${remote.id}-${index}`;
        current = await adoptRemoteDictionary({
          registry: current,
          dictionaryPlan,
          plannedDictionary: planned,
          remote,
          sessionId: recoverySessionId,
          persistRegistry,
          appendEvent,
        });
        current = await archiveKnownEntry({
          registry: current,
          entry: lifecycleEntry(current, recoverySessionId, planned.languageId),
          apiKey,
          archiveDictionary,
          persistRegistry,
          appendEvent,
        });
      }
    }
  }
  return current;
}

export async function withTemporaryPronunciationDictionaries({
  registry,
  dictionaryPlan,
  sessionId,
  apiKey,
  clients,
  persistRegistry,
  appendEvent,
  worker,
}) {
  let current = await cleanupTemporaryDictionaries({
    registry,
    dictionaryPlan,
    apiKey,
    listDictionaries: clients.listDictionaries,
    archiveDictionary: clients.archiveDictionary,
    persistRegistry,
    appendEvent,
  });
  assertDictionaryLifecycleClear(current);
  const begun = beginDictionaryLifecycleSession(
    current,
    dictionaryPlan,
    sessionId,
  );
  current = begun.registry;
  await persistRegistry(current);
  const bindingByLanguage = new Map();
  let workerError = null;
  let result;
  try {
    for (const planned of dictionaryPlan.dictionaries) {
      const created = await clients.createDictionary({
        apiKey,
        name: planned.name,
        description: planned.description,
        rules: planned.rules,
      });
      current = markDictionaryActive(current, {
        sessionId,
        languageId: planned.languageId,
        dictionaryId: created.id,
        versionId: created.versionId,
      });
      const entry = lifecycleEntry(current, sessionId, planned.languageId);
      await persistedTransition(
        {
          registry: current,
          entry,
          detail: { versionRulesNum: created.versionRulesNum },
        },
        "dictionary-created",
        { persistRegistry, appendEvent },
      );
      bindingByLanguage.set(planned.languageId, {
        sessionId,
        thirdPlanSha256: dictionaryPlan.thirdPlanSha256,
        dictionaryPlanSha256: dictionaryPlan.dictionaryPlanSha256,
        rulesSha256: planned.rulesSha256,
        dictionaryId: created.id,
        versionId: created.versionId,
        locator: getActiveDictionaryLocator(current, {
          sessionId,
          languageId: planned.languageId,
        }),
      });
    }
    result = await worker({ bindingByLanguage });
  } catch (error) {
    workerError = error;
  }

  let cleanupError = null;
  try {
    current = await cleanupTemporaryDictionaries({
      registry: current,
      dictionaryPlan,
      apiKey,
      listDictionaries: clients.listDictionaries,
      archiveDictionary: clients.archiveDictionary,
      persistRegistry,
      appendEvent,
      onlySessionId: sessionId,
      discoverPlannedNames: false,
    });
  } catch (error) {
    cleanupError = error;
    current = error.registry ?? current;
  }
  if (cleanupError) {
    const failure = new Error(
      `Round-C dictionary cleanup failed; select/promote are blocked. ${cleanupError.message}`,
    );
    failure.cause = cleanupError;
    failure.workerError = workerError;
    failure.registry = current;
    throw failure;
  }
  if (workerError) throw workerError;
  assertDictionaryLifecycleClear(current);
  return { result, registry: current, bindingByLanguage };
}
