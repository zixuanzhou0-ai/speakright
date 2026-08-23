import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { TRAINING_SPEAKERS } from "@speakright/core/training/speakers";
import { describe, expect, it } from "vitest";
import { TRAINING_PERCEPTION_CATALOG } from "@/lib/training-perception";

describe("core perception audio manifest", () => {
  it("has local assets for every reviewed speaker in every core pair", () => {
    const reviewedSpeakers = TRAINING_SPEAKERS.filter(
      (speaker) => speaker.reviewStatus === "reviewed",
    );
    expect(reviewedSpeakers.length).toBeGreaterThanOrEqual(2);
    const publicRoot = resolve(process.cwd(), "public");

    for (const pack of TRAINING_PERCEPTION_CATALOG) {
      expect(pack.examples.length, pack.packId).toBeGreaterThanOrEqual(4);
      for (const pair of pack.examples) {
        for (const word of [pair.wordA, pair.wordB]) {
          for (const speakerEntry of reviewedSpeakers) {
            const speaker = speakerEntry.assetDirectory;
            const asset = resolve(
              publicRoot,
              "audio",
              "words",
              speaker,
              `${word.toLowerCase()}.mp3`,
            );
            expect(existsSync(asset), asset).toBe(true);
            expect(statSync(asset).size, asset).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
