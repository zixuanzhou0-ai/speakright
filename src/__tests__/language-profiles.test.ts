import { describe, expect, it } from "vitest";
import { getLanguageProfile, getLanguageProfiles } from "@/lib/language-profiles";
import { languageScopedStorageKey } from "@/lib/language-storage";

describe("language profiles", () => {
  it("keeps en-US as the active evidence-driven baseline", () => {
    const profile = getLanguageProfile("en-US");

    expect(profile.azureLocale).toBe("en-US");
    expect(profile.status).toBe("active");
    expect(profile.readiness).toMatchObject({
      diagnosis: true,
      training: true,
      evidenceMastery: true,
      requiresAzureProbe: false,
    });
    expect(profile.assessmentWords).toHaveLength(10);
  });

  it("registers Spanish as experimental and French/Russian as planned", () => {
    expect(getLanguageProfiles().map((profile) => profile.id)).toEqual([
      "en-US",
      "es-ES",
      "fr-FR",
      "ru-RU",
    ]);

    const spanish = getLanguageProfile("es-ES");
    expect(spanish.azureLocale).toBe("es-ES");
    expect(spanish.status).toBe("experimental");
    expect(spanish.readiness.training).toBe(false);
    expect(spanish.starterTrainingPlans.map((plan) => plan.id)).toContain(
      "es-tap-trill-r",
    );

    expect(getLanguageProfile("fr-FR").status).toBe("planned");
    expect(getLanguageProfile("ru-RU").status).toBe("planned");
  });

  it("preserves accents and Cyrillic tokens in profile tokenizers", () => {
    expect(getLanguageProfile("es-ES").tokenizer.splitWords("año y jamón")).toEqual([
      "año",
      "y",
      "jamón",
    ]);
    expect(getLanguageProfile("ru-RU").tokenizer.splitWords("мир и щётка")).toEqual([
      "мир",
      "и",
      "щётка",
    ]);
  });
});

describe("language scoped storage keys", () => {
  it("keeps legacy English keys unchanged and scopes non-English keys", () => {
    expect(languageScopedStorageKey("speakright_mastery_profile_v2", "en-US")).toBe(
      "speakright_mastery_profile_v2",
    );
    expect(languageScopedStorageKey("speakright_mastery_profile_v2", "es-ES")).toBe(
      "speakright_mastery_profile_v2:es-ES",
    );
  });
});
