import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDictionaryLifecycleClear,
  assertGeneratedDictionaryBinding,
  assertThirdRoundDictionaryPlan,
  beginDictionaryLifecycleSession,
  buildThirdRoundDictionaryPlan,
  computeDictionaryPlanSha256,
  findOpenDictionaryEntries,
  markDictionaryActive,
  markDictionaryArchived,
  markDictionaryCleanupRequired,
} from "./lib/elevenlabs-dictionary-lifecycle-core.mjs";
import {
  cleanupTemporaryDictionaries,
  withTemporaryPronunciationDictionaries,
} from "./lib/elevenlabs-dictionary-lifecycle-workflow.mjs";

const BASE_SHA = "a".repeat(64);
const THIRD_SHA = "b".repeat(64);

function candidate(languageId, index, overrides = {}) {
  const text =
    languageId === "en-US" ? `english-${index}` : `français-${index}`;
  return {
    candidateId: `${languageId}-${index}-C`,
    sourceAssetId: `${languageId}-${index}`,
    languageId,
    text,
    modelId: "eleven_v3",
    generationRound: 3,
    pronunciationDictionary: {
      alphabet: "ipa",
      stringToReplace: text,
      phoneme: languageId === "en-US" ? `ˈɪŋɡlɪʃ${index}` : `fʁɑ̃sɛ${index}`,
    },
    ...overrides,
  };
}

function thirdPlan() {
  return {
    version: 1,
    basePlanSha256: BASE_SHA,
    thirdPlanSha256: THIRD_SHA,
    candidates: [
      ...Array.from({ length: 11 }, (_, index) => candidate("en-US", index)),
      ...Array.from({ length: 96 }, (_, index) => candidate("fr-FR", index)),
    ],
  };
}

function fakeClients({
  archiveFailureId = null,
  createFailureLanguage = null,
} = {}) {
  const remote = [];
  const calls = { create: [], archive: [], list: [] };
  return {
    calls,
    remote,
    clients: {
      async createDictionary({ name, rules }) {
        calls.create.push({ name, rules });
        const language = name.includes("en-us") ? "en-US" : "fr-FR";
        const item = {
          id: `dictionary-${calls.create.length}`,
          latestVersionId: `version-${calls.create.length}`,
          latestVersionRulesNum: rules.length,
          name,
          archivedTimeUnix: null,
        };
        remote.push(item);
        if (createFailureLanguage === language) {
          throw new Error(`injected create failure for ${language}`);
        }
        return {
          id: item.id,
          versionId: item.latestVersionId,
          versionRulesNum: item.latestVersionRulesNum,
        };
      },
      async listDictionaries({ exactName }) {
        calls.list.push(exactName);
        return {
          pronunciationDictionaries: remote.filter(
            (item) => item.name === exactName,
          ),
          pageCount: 1,
        };
      },
      async archiveDictionary({ pronunciationDictionaryId }) {
        calls.archive.push(pronunciationDictionaryId);
        if (pronunciationDictionaryId === archiveFailureId) {
          throw new Error("injected archive failure");
        }
        const item = remote.find(
          (dictionary) => dictionary.id === pronunciationDictionaryId,
        );
        if (item) item.archivedTimeUnix = 123;
        return { id: pronunciationDictionaryId, archivedTimeUnix: 123 };
      },
    },
  };
}

function persistence(initial = null) {
  let registry = initial;
  const events = [];
  return {
    get registry() {
      return registry;
    },
    events,
    persistRegistry(value) {
      registry = structuredClone(value);
    },
    appendEvent(value) {
      events.push(structuredClone(value));
    },
  };
}

test("round-C uses one shared dictionary per language with the locked 11/96 rules", () => {
  const plan = buildThirdRoundDictionaryPlan(thirdPlan());
  assert.equal(plan.dictionaryCount, 2);
  assert.equal(plan.candidateCount, 107);
  assert.deepEqual(
    Object.fromEntries(
      plan.dictionaries.map((item) => [item.languageId, item.ruleCount]),
    ),
    { "en-US": 11, "fr-FR": 96 },
  );
  assertThirdRoundDictionaryPlan(plan, thirdPlan(), {
    expectedRulesByLanguage: { "en-US": 11, "fr-FR": 96 },
  });
  assert.equal(plan.dictionaryPlanSha256, computeDictionaryPlanSha256(plan));
});

test("same-language candidates reuse one rule and conflicting IPA is rejected", () => {
  const base = thirdPlan();
  const duplicate = {
    ...candidate("en-US", 0),
    candidateId: "en-US-duplicate-voice-C",
    sourceAssetId: "en-US-duplicate-voice",
  };
  const plan = buildThirdRoundDictionaryPlan({
    ...base,
    candidates: [...base.candidates, duplicate],
  });
  assert.equal(
    plan.dictionaries.find((item) => item.languageId === "en-US").ruleCount,
    11,
  );
  assert.throws(
    () =>
      buildThirdRoundDictionaryPlan({
        ...base,
        candidates: [
          ...base.candidates,
          {
            ...duplicate,
            pronunciationDictionary: {
              ...duplicate.pronunciationDictionary,
              phoneme: "wrong",
            },
          },
        ],
      }),
    /Conflicting pronunciation rules/u,
  );
});

test("non-eleven_v3 round-C candidates are blocked before network work", () => {
  const base = thirdPlan();
  assert.throws(
    () =>
      buildThirdRoundDictionaryPlan({
        ...base,
        candidates: [
          { ...base.candidates[0], modelId: "eleven_multilingual_v2" },
        ],
      }),
    /non-eleven_v3/u,
  );
});

test("checkpoint binds plan, rules, dictionary and version until archive", () => {
  const plan = buildThirdRoundDictionaryPlan(thirdPlan());
  let { registry } = beginDictionaryLifecycleSession(null, plan, "session-a");
  assert.equal(findOpenDictionaryEntries(registry).length, 2);
  registry = markDictionaryActive(registry, {
    sessionId: "session-a",
    languageId: "en-US",
    dictionaryId: "dictionary-en",
    versionId: "version-en",
  });
  assert.throws(
    () => assertDictionaryLifecycleClear(registry),
    /cleanup is incomplete/u,
  );
  registry = markDictionaryArchived(registry, {
    sessionId: "session-a",
    languageId: "en-US",
  });
  registry = markDictionaryArchived(registry, {
    sessionId: "session-a",
    languageId: "fr-FR",
  });
  assertDictionaryLifecycleClear(registry);
  const tampered = structuredClone(plan);
  tampered.dictionaries[0].rules[0].phoneme = "tampered";
  assert.throws(
    () => assertThirdRoundDictionaryPlan(tampered, thirdPlan()),
    /SHA does not match/u,
  );
});

test("happy path creates exactly two dictionaries, reuses locators and archives in finally", async () => {
  const plan = buildThirdRoundDictionaryPlan(thirdPlan());
  const fake = fakeClients();
  const store = persistence();
  let generated = null;
  const result = await withTemporaryPronunciationDictionaries({
    registry: null,
    dictionaryPlan: plan,
    sessionId: "happy",
    apiKey: "not-logged",
    clients: fake.clients,
    persistRegistry: store.persistRegistry,
    appendEvent: store.appendEvent,
    async worker({ bindingByLanguage }) {
      assert.equal(bindingByLanguage.size, 2);
      assert.equal(
        bindingByLanguage.get("en-US").locator.pronunciation_dictionary_id,
        "dictionary-1",
      );
      generated = {
        pronunciationDictionaryLifecycle: bindingByLanguage.get("en-US"),
      };
      return "generated";
    },
  });
  assert.equal(result.result, "generated");
  assert.equal(fake.calls.create.length, 2);
  assert.equal(fake.calls.archive.length, 2);
  assertDictionaryLifecycleClear(result.registry);
  assertGeneratedDictionaryBinding({
    candidate: thirdPlan().candidates[0],
    generated,
    dictionaryPlan: plan,
    registry: result.registry,
  });
});

test("worker failure still archives both dictionaries without retrying POST/PATCH", async () => {
  const fake = fakeClients();
  const store = persistence();
  await assert.rejects(
    withTemporaryPronunciationDictionaries({
      registry: null,
      dictionaryPlan: buildThirdRoundDictionaryPlan(thirdPlan()),
      sessionId: "worker-failure",
      apiKey: "not-logged",
      clients: fake.clients,
      persistRegistry: store.persistRegistry,
      appendEvent: store.appendEvent,
      async worker() {
        throw new Error("injected generation failure");
      },
    }),
    /injected generation failure/u,
  );
  assert.equal(fake.calls.create.length, 2);
  assert.equal(fake.calls.archive.length, 2);
  assertDictionaryLifecycleClear(store.registry);
});

test("a crash-window dictionary is recovered by exact name before a new session", async () => {
  const plan = buildThirdRoundDictionaryPlan(thirdPlan());
  const fake = fakeClients();
  const store = persistence();
  const planned = plan.dictionaries[0];
  fake.remote.push({
    id: "orphan-en",
    latestVersionId: "orphan-version",
    latestVersionRulesNum: planned.ruleCount,
    name: planned.name,
    archivedTimeUnix: null,
  });
  const cleaned = await cleanupTemporaryDictionaries({
    registry: null,
    dictionaryPlan: plan,
    apiKey: "not-logged",
    listDictionaries: fake.clients.listDictionaries,
    archiveDictionary: fake.clients.archiveDictionary,
    persistRegistry: store.persistRegistry,
    appendEvent: store.appendEvent,
  });
  assert.deepEqual(fake.calls.archive, ["orphan-en"]);
  assertDictionaryLifecycleClear(cleaned);
  assert(store.events.some((event) => event.type === "dictionary-recovered"));
});

test("create response loss is recovered and archived without a second create call", async () => {
  const fake = fakeClients({ createFailureLanguage: "en-US" });
  const store = persistence();
  await assert.rejects(
    withTemporaryPronunciationDictionaries({
      registry: null,
      dictionaryPlan: buildThirdRoundDictionaryPlan(thirdPlan()),
      sessionId: "create-response-loss",
      apiKey: "not-logged",
      clients: fake.clients,
      persistRegistry: store.persistRegistry,
      appendEvent: store.appendEvent,
      async worker() {
        throw new Error("must not run");
      },
    }),
    /injected create failure/u,
  );
  assert.equal(fake.calls.create.length, 1);
  assert.deepEqual(fake.calls.archive, ["dictionary-1"]);
  assertDictionaryLifecycleClear(store.registry);
});

test("archive failure records actionable cleanup and blocks every downstream gate", async () => {
  const fake = fakeClients({ archiveFailureId: "dictionary-1" });
  const store = persistence();
  await assert.rejects(
    withTemporaryPronunciationDictionaries({
      registry: null,
      dictionaryPlan: buildThirdRoundDictionaryPlan(thirdPlan()),
      sessionId: "archive-failure",
      apiKey: "not-logged",
      clients: fake.clients,
      persistRegistry: store.persistRegistry,
      appendEvent: store.appendEvent,
      async worker() {
        return "generated";
      },
    }),
    /select\/promote are blocked/u,
  );
  assert.equal(
    fake.calls.archive.filter((id) => id === "dictionary-1").length,
    1,
  );
  assert.throws(
    () => assertDictionaryLifecycleClear(store.registry),
    /cleanup is incomplete/u,
  );
  const failed = findOpenDictionaryEntries(store.registry).find(
    (entry) => entry.dictionaryId === "dictionary-1",
  );
  assert.equal(failed.status, "cleanup-required");
  assert.match(
    failed.cleanupInstruction,
    /Archive ElevenLabs pronunciation dictionary/u,
  );
});

test("cleanup-required state remains an immutable downstream blocker", () => {
  const plan = buildThirdRoundDictionaryPlan(thirdPlan());
  let { registry } = beginDictionaryLifecycleSession(null, plan, "blocked");
  registry = markDictionaryCleanupRequired(registry, {
    sessionId: "blocked",
    languageId: "en-US",
    error: new Error("archive timeout"),
  });
  assert.throws(
    () => assertDictionaryLifecycleClear(registry),
    /cleanup is incomplete/u,
  );
});
