import { describe, expect, it } from "vitest";
import {
  getAssessmentPhonemeLabel,
  getAssessmentAliasesForSlug,
  getAssessmentExemptionForSlug,
  getPhonemeAudioUrl,
  getPhonemeAccuracy,
  normalizeAssessmentPhoneme,
} from "@/lib/azure-phoneme-map";
import { getLanguagePhonemes } from "@/lib/language-phonemes";

const NON_ENGLISH_LANGUAGES = ["es-ES", "fr-FR", "ru-RU"] as const;

function result(phonemes: Array<{ phoneme: string; accuracyScore: number }>) {
  return { words: [{ phonemes }] };
}

describe("multilingual Azure phoneme map parity", () => {
  it("normalizes assessment phoneme spellings without losing palatalization/nasalization", () => {
    expect(normalizeAssessmentPhoneme("/t͡ɕ/")).toBe("tɕ");
    expect(normalizeAssessmentPhoneme("[ɕː]")).toBe("ɕː");
    expect(normalizeAssessmentPhoneme("ˈɛ̃")).toBe("ɛ̃");
    expect(normalizeAssessmentPhoneme("tʲ")).toBe("tʲ");
  });

  it("keeps every non-English sound unit either scorable or explicitly exempted", () => {
    const gaps = NON_ENGLISH_LANGUAGES.flatMap((languageId) =>
      getLanguagePhonemes(languageId).flatMap((unit) => {
        const aliases = getAssessmentAliasesForSlug(unit.slug);
        const exemption = getAssessmentExemptionForSlug(unit.slug);
        return aliases.length > 0 || exemption
          ? []
          : [`${languageId}:${unit.slug}`];
      }),
    );

    expect(gaps).toEqual([]);
  });

  it("does not keep aliases or exemptions for deleted or renamed non-English slugs", () => {
    const obsolete = [
      "es-ll-y",
      "fr-epsilon",
      "fr-j",
      "fr-hui",
      "fr-w",
    ];

    for (const slug of obsolete) {
      expect(getAssessmentAliasesForSlug(slug)).toEqual([]);
      expect(getAssessmentExemptionForSlug(slug)).toBeUndefined();
    }
  });

  it("scores representative Spanish, French, and Russian target units", () => {
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "θ", accuracyScore: 77 }]),
        "es-theta",
      ),
    ).toBe(77);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "ʝ", accuracyScore: 81 }]),
        "es-y-ll",
      ),
    ).toBe(81);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "j", accuracyScore: 83 }]),
        "es-diphthongs-j",
      ),
    ).toBe(83);
    expect(
      getPhonemeAccuracy(result([{ phoneme: "p", accuracyScore: 79 }]), "es-p"),
    ).toBe(79);
    expect(
      getPhonemeAccuracy(result([{ phoneme: "k", accuracyScore: 76 }]), "es-k"),
    ).toBe(76);
    expect(
      getPhonemeAccuracy(result([{ phoneme: "m", accuracyScore: 82 }]), "es-m"),
    ).toBe(82);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "b", accuracyScore: 84 }]),
        "es-b-stop",
      ),
    ).toBe(84);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "d", accuracyScore: 72 }]),
        "es-d-stop",
      ),
    ).toBe(72);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "g", accuracyScore: 75 }]),
        "es-g-stop",
      ),
    ).toBe(75);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "β", accuracyScore: 86 }]),
        "es-bv",
      ),
    ).toBe(86);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "ð", accuracyScore: 80 }]),
        "es-d",
      ),
    ).toBe(80);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "ɣ", accuracyScore: 78 }]),
        "es-g",
      ),
    ).toBe(78);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "ɛ", accuracyScore: 74 }]),
        "fr-e-open",
      ),
    ).toBe(74);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "ɥ", accuracyScore: 69 }]),
        "fr-glide-hui",
      ),
    ).toBe(69);
    expect(
      getPhonemeAccuracy(result([{ phoneme: "p", accuracyScore: 71 }]), "fr-p"),
    ).toBe(71);
    expect(
      getPhonemeAccuracy(result([{ phoneme: "v", accuracyScore: 78 }]), "fr-v"),
    ).toBe(78);
    expect(
      getPhonemeAccuracy(result([{ phoneme: "z", accuracyScore: 73 }]), "fr-z"),
    ).toBe(73);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "ɨ", accuracyScore: 88 }]),
        "ru-y",
      ),
    ).toBe(88);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "t͡ɕ", accuracyScore: 64 }]),
        "ru-ch",
      ),
    ).toBe(64);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "tʲ", accuracyScore: 75 }]),
        "ru-t-tj",
      ),
    ).toBe(75);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "d", accuracyScore: 68 }]),
        "ru-d-dj",
      ),
    ).toBe(68);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "sʲ", accuracyScore: 74 }]),
        "ru-s-sj",
      ),
    ).toBe(74);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "z", accuracyScore: 69 }]),
        "ru-z-zj",
      ),
    ).toBe(69);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "nʲ", accuracyScore: 77 }]),
        "ru-n-nj",
      ),
    ).toBe(77);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "l", accuracyScore: 78 }]),
        "ru-l-lj",
      ),
    ).toBe(78);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "rʲ", accuracyScore: 79 }]),
        "ru-r-rj",
      ),
    ).toBe(79);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "pʲ", accuracyScore: 72 }]),
        "ru-p-pj",
      ),
    ).toBe(72);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "v", accuracyScore: 70 }]),
        "ru-v-vj",
      ),
    ).toBe(70);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "kʲ", accuracyScore: 76 }]),
        "ru-k-kj",
      ),
    ).toBe(76);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "g", accuracyScore: 73 }]),
        "ru-g-gj",
      ),
    ).toBe(73);
    expect(
      getPhonemeAccuracy(
        result([{ phoneme: "xʲ", accuracyScore: 71 }]),
        "ru-x-xj",
      ),
    ).toBe(71);
  });

  it("resolves multilingual assessment phonemes to local playback assets", () => {
    expect(getPhonemeAudioUrl("a", "es-ES")).toBe(
      "/audio/language-assets/es-ES/header-clips/es-a.m4a",
    );
    expect(getPhonemeAudioUrl("u", "es-ES")).toBe(
      "/audio/language-assets/es-ES/header-clips/es-u.m4a",
    );
    expect(getPhonemeAudioUrl("eh", "fr-FR")).toBe(
      "/audio/language-assets/fr-FR/header-clips/fr-e-open.m4a",
    );
    expect(getPhonemeAudioUrl("ax", "fr-FR")).toBe(
      "/audio/language-assets/fr-FR/header-clips/fr-schwa.m4a",
    );
    expect(getPhonemeAudioUrl("ʁ", "fr-FR")).toBe(
      "/audio/language-assets/fr-FR/header-clips/fr-r.m4a",
    );
    expect(getPhonemeAudioUrl("ɨ", "ru-RU")).toBe(
      "/audio/language-assets/ru-RU/header-clips/ru-y.m4a",
    );
    expect(getPhonemeAudioUrl("v", "ru-RU")).toBe(
      "/audio/language-assets/ru-RU/header-clips/ru-v.m4a",
    );
    expect(getPhonemeAudioUrl("ʐ", "ru-RU")).toBe(
      "/audio/language-assets/ru-RU/header-clips/ru-zh.m4a",
    );
    expect(getPhonemeAudioUrl("k", "es-ES")).toBeNull();
    expect(getPhonemeAudioUrl("b", "es-ES")).toBeNull();
    expect(getPhonemeAudioUrl("d", "es-ES")).toBeNull();
    expect(getPhonemeAudioUrl("g", "es-ES")).toBeNull();
    expect(getPhonemeAudioUrl("p", "fr-FR")).toBeNull();
    expect(getPhonemeAudioUrl("tʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("dʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("sʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("zʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("nʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("lʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("rʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("pʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("kʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("gʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("xʲ", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("ɱ", "es-ES")).toBeNull();
    expect(getPhonemeAudioUrl("final devoicing", "ru-RU")).toBeNull();
    expect(getPhonemeAudioUrl("iy", "en-US")).toBe(
      "/audio/ipa/phoneme/green.mp3",
    );
    expect(getPhonemeAudioUrl("not-a-real-code", "es-ES")).toBeNull();
  });

  it("keeps non-English assessment phoneme labels visible instead of empty slashes", () => {
    expect(getAssessmentPhonemeLabel("", "fr-FR")).toBe("—");
    expect(getAssessmentPhonemeLabel("m", "es-ES")).toBe("/m/");
    expect(getAssessmentPhonemeLabel("n", "es-ES")).toBe("/n/");
    expect(getAssessmentPhonemeLabel("eh", "fr-FR")).toBe("/ɛ/");
    expect(getAssessmentPhonemeLabel("ax", "fr-FR")).toBe("/ə/");
    expect(getAssessmentPhonemeLabel("ʁ", "fr-FR")).toBe("/ʁ/");
    expect(getAssessmentPhonemeLabel("ˈɛ̃", "fr-FR")).toBe("/ɛ̃/");
    expect(getAssessmentPhonemeLabel("[ɕː]", "ru-RU")).toBe("/ɕː/");
    expect(getAssessmentPhonemeLabel("th", "en-US")).toBe("/θ/");
  });

  it("keeps rule/prosody units explicit instead of pretending they are single phonemes", () => {
    for (const slug of [
      "es-lexical-stress",
      "es-syllable-rhythm",
      "fr-liaison",
      "fr-final-consonant-silence",
      "fr-enchainement",
      "fr-elision",
      "fr-phrase-final-prominence",
      "ru-stress-reduction",
      "ru-final-devoicing",
      "ru-voicing-assimilation",
      "ru-clusters",
    ]) {
      expect(getAssessmentAliasesForSlug(slug)).toEqual([]);
      expect(getAssessmentExemptionForSlug(slug)?.reason).toMatch(
        /rule|prosody|context|stress|phrase|cluster/i,
      );
    }
  });
});
