import { beforeEach, describe, expect, it, vi } from "vitest";

describe("local data migrations", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("marks the current local data schema version", async () => {
    const {
      LOCAL_DATA_SCHEMA_VERSION,
      LOCAL_DATA_SCHEMA_VERSION_KEY,
      getLocalDataSchemaStatus,
      runLocalDataMigrations,
    } = await import("@/lib/local-data-migrations");

    const result = runLocalDataMigrations();

    expect(result.previousVersion).toBe(0);
    expect(result.currentVersion).toBe(LOCAL_DATA_SCHEMA_VERSION);
    expect(localStorage.getItem(LOCAL_DATA_SCHEMA_VERSION_KEY)).toBe(
      String(LOCAL_DATA_SCHEMA_VERSION),
    );
    expect(getLocalDataSchemaStatus().needsMigration).toBe(false);
  });

  it("migrates legacy mastery v1 into profile v2 and session snapshots", async () => {
    const { runLocalDataMigrations } = await import(
      "@/lib/local-data-migrations"
    );
    localStorage.setItem(
      "speakright_mastery_profile_v1",
      JSON.stringify({
        version: 1,
        updatedAt: 123,
        packs: {
          "th-s": {
            packId: "th-s",
            status: "recommended",
            completedSessions: 1,
            bestTargetScore: 70,
          },
        },
        phonemes: {
          th: {
            phoneme: "th",
            bestScore: 70,
            recentScores: [70],
            status: "weak",
          },
        },
        sessions: [{ id: "s1", packId: "th-s" }],
      }),
    );

    const result = runLocalDataMigrations();
    const profile = JSON.parse(
      localStorage.getItem("speakright_mastery_profile_v2") ?? "{}",
    );
    const sessions = JSON.parse(
      localStorage.getItem("speakright_training_sessions_v2") ?? "[]",
    );

    expect(result.migratedKeys).toContain("speakright_mastery_profile_v2");
    expect(profile.version).toBe(2);
    expect(profile.packs["th-s"].status).toBe("new");
    expect(profile.packs["th-s"].levelProgress).toEqual({});
    expect(profile.errorPatterns).toEqual({});
    expect(sessions).toEqual([
      { id: "s1", languageId: "en-US", packId: "th-s" },
    ]);
  });

  it("backfills training session snapshots from existing mastery v2", async () => {
    const { runLocalDataMigrations } = await import(
      "@/lib/local-data-migrations"
    );
    localStorage.setItem(
      "speakright_mastery_profile_v2",
      JSON.stringify({
        version: 2,
        updatedAt: 123,
        packs: {},
        phonemes: {},
        errorPatterns: {},
        sessions: [{ id: "s1" }, { id: "s2" }],
      }),
    );

    const result = runLocalDataMigrations();

    expect(result.migratedKeys).toEqual(["speakright_training_sessions_v2"]);
    expect(
      JSON.parse(localStorage.getItem("speakright_training_sessions_v2") ?? "[]"),
    ).toEqual([{ id: "s1" }, { id: "s2" }]);
  });

  it("quarantines malformed learning JSON and removes the broken source key", async () => {
    const {
      CORRUPT_LOCAL_DATA_KEY,
      getLocalDataSchemaStatus,
      readCorruptLocalData,
      runLocalDataMigrations,
    } = await import("@/lib/local-data-migrations");
    localStorage.setItem("speakright_usage", "{not json");
    localStorage.setItem("speakright_mw_words_th", "{also bad");

    const result = runLocalDataMigrations();

    expect(result.quarantinedKeys).toEqual([
      "speakright_usage",
      "speakright_mw_words_th",
    ]);
    expect(localStorage.getItem("speakright_usage")).toBeNull();
    expect(localStorage.getItem("speakright_mw_words_th")).toBeNull();
    expect(localStorage.getItem(CORRUPT_LOCAL_DATA_KEY)).not.toBeNull();
    expect(readCorruptLocalData().map((item) => item.key)).toEqual([
      "speakright_mw_words_th",
      "speakright_usage",
    ]);
    expect(getLocalDataSchemaStatus().corruptItems).toBe(2);
  });
});
