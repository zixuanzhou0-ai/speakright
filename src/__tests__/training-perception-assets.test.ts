import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TRAINING_PERCEPTION_CATALOG } from "@/lib/training-perception";

describe("core perception audio manifest", () => {
  it("has at least four local pairs and two non-empty voices per pack", () => {
    const publicRoot = resolve(process.cwd(), "public");

    for (const pack of TRAINING_PERCEPTION_CATALOG) {
      expect(pack.examples.length, pack.packId).toBeGreaterThanOrEqual(4);
      for (const pair of pack.examples) {
        for (const word of [pair.wordA, pair.wordB]) {
          for (const speaker of ["blue", "pink"]) {
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
