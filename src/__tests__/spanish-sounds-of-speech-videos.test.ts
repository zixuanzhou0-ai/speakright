import { describe, expect, it } from "vitest";
import {
  getAllSpanishSoundVideoSets,
  getSpanishSoundVideoSet,
} from "@/lib/spanish-sounds-of-speech-videos";

describe("spanish Sounds of Speech video manifest", () => {
  it("returns target sound and four official examples for es-a", () => {
    const videoSet = getSpanishSoundVideoSet("es-a");

    expect(videoSet).toBeDefined();
    expect(videoSet?.targetClip.localSrc).toBe(
      "/videos/language-assets/es-ES/examples/es-a/sound.mp4",
    );
    expect(videoSet?.exampleClips).toHaveLength(4);
    expect(videoSet?.exampleClips.map((clip) => clip.word)).toEqual([
      "arma",
      "año",
      "pato",
      "boca",
    ]);
  });

  it("covers at least 20 Spanish slugs", () => {
    expect(getAllSpanishSoundVideoSets()).toHaveLength(20);
  });

  it("only returns browser-public local paths under the downloaded asset roots", () => {
    for (const videoSet of getAllSpanishSoundVideoSets()) {
      expect(videoSet.animationSrc).toBe(
        `/videos/language-assets/es-ES/animation/${videoSet.slug}.mp4`,
      );
      expect(videoSet.targetClip.localSrc).toMatch(
        /^\/videos\/language-assets\/es-ES\/examples\//,
      );
      for (const clip of videoSet.exampleClips) {
        expect(clip.localSrc).toMatch(
          /^\/videos\/language-assets\/es-ES\/examples\//,
        );
      }
    }
  });
});
