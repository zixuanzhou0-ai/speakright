import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCacheKey,
  captureTtsCacheEpoch,
  clearTtsCache,
  setTtsToCache,
  subscribeToTtsCacheInvalidation,
} from "@/lib/tts-cache";

interface ControlledOpenRequest {
  result?: IDBDatabase;
  error: Error | null;
  onsuccess?: () => void;
  onerror?: () => void;
  onupgradeneeded?: () => void;
}

function installControlledIndexedDb(): ControlledOpenRequest[] {
  const requests: ControlledOpenRequest[] = [];
  vi.stubGlobal("indexedDB", {
    open: vi.fn(() => {
      const request: ControlledOpenRequest = { error: null };
      requests.push(request);
      return request;
    }),
  });
  return requests;
}

function resolveOpen(request: ControlledOpenRequest, db: IDBDatabase): void {
  request.result = db;
  request.onsuccess?.();
}

function createClearDb() {
  const tx: Partial<IDBTransaction> = {};
  const put = vi.fn();
  const clear = vi.fn(() => {
    queueMicrotask(() => {
      const oncomplete = tx.oncomplete as
        | ((event: Event) => void)
        | null
        | undefined;
      oncomplete?.(new Event("complete"));
    });
  });
  const store = { clear, put };
  tx.objectStore = vi.fn(() => store as unknown as IDBObjectStore);
  const transaction = vi.fn(() => tx as IDBTransaction);
  return {
    db: {
      transaction,
      close: vi.fn(),
    } as unknown as IDBDatabase,
    clear,
    put,
  };
}

function createDeferredClearDb() {
  const tx: Partial<IDBTransaction> = {};
  const clear = vi.fn();
  const put = vi.fn();
  const store = { clear, put };
  tx.objectStore = vi.fn(() => store as unknown as IDBObjectStore);
  return {
    db: {
      transaction: vi.fn(() => tx as IDBTransaction),
      close: vi.fn(),
    } as unknown as IDBDatabase,
    put,
    complete: () => {
      const oncomplete = tx.oncomplete as
        | ((event: Event) => void)
        | null
        | undefined;
      oncomplete?.(new Event("complete"));
    },
  };
}

function createPendingSetDb(epochRecord: unknown) {
  const tx: Partial<IDBTransaction> = {};
  let getRequest: Partial<IDBRequest<unknown>> | null = null;
  let getAllRequest: Partial<IDBRequest<unknown[]>> | null = null;
  let completionScheduled = false;
  const scheduleCompletion = () => {
    if (!getRequest || !getAllRequest || completionScheduled) return;
    completionScheduled = true;
    queueMicrotask(() => {
      const getSuccess = getRequest?.onsuccess as
        | ((event: Event) => void)
        | null
        | undefined;
      const getAllSuccess = getAllRequest?.onsuccess as
        | ((event: Event) => void)
        | null
        | undefined;
      const oncomplete = tx.oncomplete as
        | ((event: Event) => void)
        | null
        | undefined;
      getSuccess?.(new Event("success"));
      getAllSuccess?.(new Event("success"));
      oncomplete?.(new Event("complete"));
    });
  };
  const get = vi.fn(() => {
    getRequest = { result: epochRecord };
    scheduleCompletion();
    return getRequest as IDBRequest<unknown>;
  });
  const getAll = vi.fn(() => {
    getAllRequest = { result: [epochRecord] };
    scheduleCompletion();
    return getAllRequest as IDBRequest<unknown[]>;
  });
  const put = vi.fn();
  const store = { get, getAll, put, delete: vi.fn() };
  tx.objectStore = vi.fn(() => store as unknown as IDBObjectStore);
  const transaction = vi.fn(() => tx as IDBTransaction);
  return {
    db: {
      transaction,
      close: vi.fn(),
    } as unknown as IDBDatabase,
    put,
    transaction,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TTS cache key format", () => {
  it("normalizes surrounding whitespace, Unicode, and speed", () => {
    expect(
      buildCacheKey(
        "  Cafe\u0301  ",
        "elevenlabs:voice1:eleven_flash_v2_5",
        0.85,
      ),
    ).toBe("v3:en-US:Café:elevenlabs:voice1:eleven_flash_v2_5:0.85");
  });

  it("preserves meaningful text case", () => {
    expect(buildCacheKey("US", "voice1", 1)).not.toBe(
      buildCacheKey("us", "voice1", 1),
    );
    expect(buildCacheKey("Polish", "voice1", 1)).not.toBe(
      buildCacheKey("polish", "voice1", 1),
    );
  });

  it("includes voiceId in key", () => {
    const key1 = buildCacheKey("hello", "voice1", 1.0);
    const key2 = buildCacheKey("hello", "voice2", 1.0);

    expect(key1).not.toBe(key2);
  });

  it("separates identical text by language", () => {
    const english = buildCacheKey("Bonjour", "voice1", 0.84, "en-US");
    const french = buildCacheKey("Bonjour", "voice1", 0.84, "fr-FR");

    expect(english).toBe("v3:en-US:Bonjour:voice1:0.84");
    expect(french).toBe("v3:fr-FR:Bonjour:voice1:0.84");
    expect(english).not.toBe(french);
  });

  it("separates identical audio requests by provider, voice, and model", () => {
    const elevenLabs = buildCacheKey(
      "hello",
      "elevenlabs:voice1:eleven_flash_v2_5",
      1,
    );
    const hermes = buildCacheKey("hello", "hermes-grok:local-config", 1);
    const otherModel = buildCacheKey(
      "hello",
      "elevenlabs:voice1:eleven_multilingual_v2",
      1,
    );

    expect(new Set([elevenLabs, hermes, otherModel]).size).toBe(3);
  });

  it("surfaces IndexedDB clear failures", async () => {
    const requests = installControlledIndexedDb();
    const clearPromise = clearTtsCache();
    const failure = new Error("indexeddb clear failed");
    requests[0].error = failure;
    requests[0].onerror?.();

    await expect(clearPromise).rejects.toBe(failure);
  });

  it("notifies the current document as soon as cache clearing starts", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTtsCacheInvalidation(listener);
    const requests = installControlledIndexedDb();
    const clearPromise = clearTtsCache();

    expect(listener).toHaveBeenCalledOnce();
    const clearDb = createClearDb();
    resolveOpen(requests[0], clearDb.db);
    await clearPromise;
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("notifies a subscriber mounted while cache clearing is pending", async () => {
    const requests = installControlledIndexedDb();
    const clearPromise = clearTtsCache();
    const listener = vi.fn();
    const unsubscribe = subscribeToTtsCacheInvalidation(listener);

    const clearDb = createClearDb();
    resolveOpen(requests[0], clearDb.db);
    await clearPromise;
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("notifies another tab when the shared cache generation changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTtsCacheInvalidation(listener);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "speakright-cache-epoch:tts",
        oldValue: "old-generation",
        newValue: "new-generation",
      }),
    );
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "speakright-cache-epoch:tts",
        oldValue: "new-generation",
        newValue: "newer-generation",
      }),
    );
    expect(listener).toHaveBeenCalledOnce();
  });

  it("does not refill the cache from a write that started before clear", async () => {
    const requests = installControlledIndexedDb();
    const pendingWrite = setTtsToCache(
      "Pending audio",
      "elevenlabs:voice:model",
      0.85,
      new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
      null,
      "en-US",
    );
    const clearPromise = clearTtsCache();

    const clearDb = createClearDb();
    resolveOpen(requests[1], clearDb.db);
    await clearPromise;

    const epochRecord = clearDb.put.mock.calls[0]?.[0];
    const setDb = createPendingSetDb(epochRecord);
    resolveOpen(requests[0], setDb.db);
    await pendingWrite;

    expect(clearDb.clear).toHaveBeenCalledOnce();
    expect(setDb.transaction).toHaveBeenCalledOnce();
    expect(setDb.put).not.toHaveBeenCalled();
  });

  it("rejects a late onload write carrying a token captured before clear", async () => {
    const requests = installControlledIndexedDb();
    const staleEpochToken = captureTtsCacheEpoch();
    const clearPromise = clearTtsCache();
    const clearDb = createClearDb();
    resolveOpen(requests[0], clearDb.db);
    await clearPromise;

    const lateWrite = setTtsToCache(
      "Late decoded audio",
      "elevenlabs:voice:model",
      0.85,
      new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
      null,
      "en-US",
      staleEpochToken,
    );
    const epochRecord = clearDb.put.mock.calls[0]?.[0];
    const setDb = createPendingSetDb(epochRecord);
    resolveOpen(requests[1], setDb.db);
    await lateWrite;

    expect(setDb.put).not.toHaveBeenCalled();
  });

  it("uses unique generations and converges after concurrent tab clears", async () => {
    const tokens = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
    ];
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => tokens.shift()),
    });
    const requests = installControlledIndexedDb();
    const firstClear = clearTtsCache();
    const secondClear = clearTtsCache();
    const firstDb = createDeferredClearDb();
    const secondDb = createDeferredClearDb();

    // The second tab opens its transaction first; the first tab finishes last.
    resolveOpen(requests[1], secondDb.db);
    resolveOpen(requests[0], firstDb.db);
    await Promise.resolve();
    await Promise.resolve();
    const firstCommittedToken = firstDb.put.mock.calls[0]?.[0]?.epoch;
    const secondCommittedToken = secondDb.put.mock.calls[0]?.[0]?.epoch;
    expect(firstCommittedToken).not.toBe(secondCommittedToken);

    secondDb.complete();
    await secondClear;
    expect(captureTtsCacheEpoch()).toBe(secondCommittedToken);

    firstDb.complete();
    await firstClear;
    expect(captureTtsCacheEpoch()).toBe(firstCommittedToken);
  });
});
