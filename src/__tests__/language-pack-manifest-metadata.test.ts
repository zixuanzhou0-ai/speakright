import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAudioPackText } from "@/lib/language-audio-pack-cache";
import {
  getMultilingualPracticeItems,
  MULTILINGUAL_AUDIO_PARITY_LANGUAGES,
  type MultilingualAudioParityLanguageId,
} from "@/lib/multilingual-audio-parity";

const cwd = process.cwd();
const REPO_ROOT = basename(cwd) === "browser" ? resolve(cwd, "../..") : cwd;

const PREVIOUSLY_PAIRED_ITEMS: Record<
  MultilingualAudioParityLanguageId,
  readonly string[]
> = {
  "es-ES": [
    "baca",
    "bono",
    "cana",
    "caña",
    "caza",
    "ciclo",
    "lata",
    "llama",
    "peso",
    "piso",
    "ven",
  ],
  "fr-FR": ["anneau", "fil", "in", "les livres", "lu", "ptit", "su", "vent"],
  "ru-RU": ["а", "дома", "дуба", "и", "мат", "сам", "шить", "ы"],
};

interface LanguagePackManifest {
  items: Array<{
    key: string;
    text: string;
    ipa: string;
  }>;
}

function manifestPath(
  target: "desktop" | "browser",
  languageId: MultilingualAudioParityLanguageId,
) {
  const publicRoot =
    target === "desktop"
      ? resolve(REPO_ROOT, "public")
      : resolve(REPO_ROOT, "apps/browser/public");
  return resolve(
    publicRoot,
    "audio",
    "language-packs",
    languageId,
    "manifest.json",
  );
}

describe("multilingual single-audio IPA metadata", () => {
  it("keeps practice items and both platform manifests free of pair-level IPA", () => {
    for (const languageId of MULTILINGUAL_AUDIO_PARITY_LANGUAGES) {
      for (const item of getMultilingualPracticeItems(languageId)) {
        expect(
          item.ipa,
          `${languageId} practice item ${item.text}`,
        ).not.toContain("~");
      }

      const desktopRaw = readFileSync(
        manifestPath("desktop", languageId),
        "utf8",
      );
      const browserRaw = readFileSync(
        manifestPath("browser", languageId),
        "utf8",
      );
      expect(browserRaw).toBe(desktopRaw);

      const manifest = JSON.parse(desktopRaw) as LanguagePackManifest;
      for (const item of manifest.items) {
        expect(
          item.ipa,
          `${languageId} manifest item ${item.text}`,
        ).not.toContain("~");
      }
    }
  });

  it("maps every previously polluted item to its own split contrast IPA", () => {
    for (const languageId of MULTILINGUAL_AUDIO_PARITY_LANGUAGES) {
      const contrastIpaByText = new Map<string, Set<string>>();
      for (const item of getMultilingualPracticeItems(languageId)) {
        if (item.source !== "contrast") continue;
        const key = normalizeAudioPackText(item.text);
        const ipas = contrastIpaByText.get(key) ?? new Set<string>();
        ipas.add(item.ipa);
        contrastIpaByText.set(key, ipas);
      }

      const manifest = JSON.parse(
        readFileSync(manifestPath("desktop", languageId), "utf8"),
      ) as LanguagePackManifest;
      const manifestByText = new Map(
        manifest.items.map((item) => [normalizeAudioPackText(item.text), item]),
      );

      for (const text of PREVIOUSLY_PAIRED_ITEMS[languageId]) {
        const key = normalizeAudioPackText(text);
        const expectedIpas = contrastIpaByText.get(key);
        expect(expectedIpas?.size, `${languageId} ${text}`).toBe(1);
        expect(manifestByText.get(key)?.ipa, `${languageId} ${text}`).toBe(
          [...(expectedIpas ?? [])][0],
        );
      }
    }
  });
});
