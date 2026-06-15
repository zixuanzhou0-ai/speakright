import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAudioPackText } from "@/lib/language-audio-pack-cache";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";

const PROJECT_ROOT = process.cwd();
const PACK_LANGUAGES = ["es-ES", "fr-FR", "ru-RU"] as const;

interface StaticPackManifest {
  languageId: (typeof PACK_LANGUAGES)[number];
  itemCount: number;
  voiceSlots?: Array<"blue" | "pink">;
  voices?: Partial<
    Record<
      "blue" | "pink",
      {
        voiceId: string;
        voiceName: string;
        modelId: string;
      }
    >
  >;
  items: Array<{
    key: string;
    text: string;
    ipa?: string;
    audioSrc: string;
    audioByVoice?: Partial<Record<"blue" | "pink", string>>;
  }>;
}

function loadManifest(languageId: (typeof PACK_LANGUAGES)[number]) {
  const manifestPath = join(
    PROJECT_ROOT,
    "public",
    "audio",
    "language-packs",
    languageId,
    "manifest.json",
  );
  return JSON.parse(readFileSync(manifestPath, "utf8")) as StaticPackManifest;
}

describe("static multilingual language audio packs", () => {
  it("bundles a manifest and local audio files for each experimental language", () => {
    for (const languageId of PACK_LANGUAGES) {
      const manifest = loadManifest(languageId);

      expect(manifest.languageId).toBe(languageId);
      expect(manifest.itemCount).toBe(manifest.items.length);
      expect(manifest.itemCount).toBeGreaterThan(300);
      expect(manifest.voiceSlots).toEqual(["blue", "pink"]);
      expect(manifest.voices?.blue?.voiceId).toBeTruthy();
      expect(manifest.voices?.pink?.voiceId).toBeTruthy();

      const keys = new Set<string>();
      for (const item of manifest.items) {
        expect(item.key).toBeTruthy();
        expect(item.text).toBeTruthy();
        expect(item.audioSrc).toMatch(
          new RegExp(`^/audio/language-packs/${languageId}/.+\\.mp3$`),
        );
        expect(keys.has(item.key)).toBe(false);
        keys.add(item.key);
        expect(item.audioByVoice?.blue).toBe(item.audioSrc);
        expect(item.audioByVoice?.pink).toMatch(
          new RegExp(`^/audio/language-packs/${languageId}/.+\\.mp3$`),
        );

        for (const voiceSlot of ["blue", "pink"] as const) {
          const audioSrc = item.audioByVoice?.[voiceSlot];
          expect(audioSrc).toMatch(
            new RegExp(`^/audio/language-packs/${languageId}/.+\\.mp3$`),
          );
          const filePath = join(
            PROJECT_ROOT,
            "public",
            String(audioSrc).replace(/^\//, ""),
          );
          expect(existsSync(filePath)).toBe(true);
        }
      }
    }
  });

  it("normalizes multilingual apostrophes, accents, punctuation, and spacing for lookup", () => {
    expect(normalizeAudioPackText(" j’aime ")).toBe("j'aime");
    expect(normalizeAudioPackText("J’ AIME")).toBe("j'aime");
    expect(normalizeAudioPackText("cafe\u0301")).toBe("café");
    expect(normalizeAudioPackText("да́")).toBe("да");
    expect(normalizeAudioPackText("Les   amis")).toBe("les amis");
    expect(normalizeAudioPackText("Нож тупой.")).toBe("нож тупой");
    expect(normalizeAudioPackText("Bonjour !")).toBe("bonjour");
  });

  it("covers every non-English diagnostic word with static local audio", () => {
    for (const languageId of PACK_LANGUAGES) {
      const manifest = loadManifest(languageId);
      const keys = new Set(
        manifest.items.flatMap((item) =>
          (["blue", "pink"] as const).flatMap((voiceSlot) => {
            if (!item.audioByVoice?.[voiceSlot]) return [];
            return [
              `${voiceSlot}:${normalizeAudioPackText(item.key)}`,
              `${voiceSlot}:${normalizeAudioPackText(item.text)}`,
            ];
          }),
        ),
      );

      const missing = LANGUAGE_LEARNING_DECKS[
        languageId
      ].diagnosticWords.filter(
        (word) =>
          !(["blue", "pink"] as const).every((voiceSlot) =>
            keys.has(`${voiceSlot}:${normalizeAudioPackText(word.text)}`),
          ),
      );

      expect(missing.map((word) => word.text)).toEqual([]);
    }
  });

  it("covers multilingual contrast drill words with static local audio", () => {
    for (const languageId of PACK_LANGUAGES) {
      const manifest = loadManifest(languageId);
      const keys = new Set(
        manifest.items.flatMap((item) =>
          (["blue", "pink"] as const).flatMap((voiceSlot) => {
            if (!item.audioByVoice?.[voiceSlot]) return [];
            return [
              `${voiceSlot}:${normalizeAudioPackText(item.key)}`,
              `${voiceSlot}:${normalizeAudioPackText(item.text)}`,
            ];
          }),
        ),
      );
      const deck = LANGUAGE_LEARNING_DECKS[languageId];
      const requiredTexts = [
        ...deck.contrastDeck.flatMap((item) => [item.left, item.right]),
      ];
      const missing = Array.from(new Set(requiredTexts)).filter(
        (text) =>
          !(["blue", "pink"] as const).every((voiceSlot) =>
            keys.has(`${voiceSlot}:${normalizeAudioPackText(text)}`),
          ),
      );

      expect(missing).toEqual([]);
    }
  });

  it("keeps multilingual sentence and passage texts available for TTS preview", () => {
    for (const languageId of PACK_LANGUAGES) {
      const deck = LANGUAGE_LEARNING_DECKS[languageId];
      expect(deck.diagnosticPassage.text.trim().length).toBeGreaterThan(0);
      expect(deck.sentenceDeck.map((item) => item.text.trim())).not.toContain("");
    }
  });

  it("keeps language-pack IPA metadata aligned with sourced reviewed findings", () => {
    const expectations: Array<{
      languageId: (typeof PACK_LANGUAGES)[number];
      text: string;
      ipa: string;
    }> = [
      { languageId: "fr-FR", text: "l'homme écoute", ipa: "/lɔmekut/" },
      { languageId: "fr-FR", text: "l'école ouvre", ipa: "/lekɔluvʁ/" },
      { languageId: "ru-RU", text: "друг дома", ipa: "/drug ˈdomə/" },
      {
        languageId: "ru-RU",
        text: "город большой",
        ipa: "/ˈgorəd bɐlʲˈʂoj/",
      },
      { languageId: "ru-RU", text: "нож острый", ipa: "/noʐ ˈostrɨj/" },
      { languageId: "ru-RU", text: "снег идёт", ipa: "/snʲeg ɪˈdʲot/" },
      { languageId: "ru-RU", text: "класс большой", ipa: "/klaz bɐlʲˈʂoj/" },
      {
        languageId: "ru-RU",
        text: "хлеб на кухне",
        ipa: "/xlʲeb nɐ ˈkuxnʲe/",
      },
      {
        languageId: "ru-RU",
        text: "поезд идёт",
        ipa: "/ˈpojɪst ɪˈdʲot/",
      },
    ];

    for (const { languageId, text, ipa } of expectations) {
      const item = loadManifest(languageId).items.find(
        (entry) => normalizeAudioPackText(entry.text) === normalizeAudioPackText(text),
      );

      expect(item, `${languageId}:${text}`).toBeDefined();
      expect(item?.ipa).toBe(ipa);
    }
  });
});
