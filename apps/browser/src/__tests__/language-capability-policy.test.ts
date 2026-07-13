import { describe, expect, it } from "vitest";
import {
  getCapabilityNavigationLabel,
  getLanguageCapabilityPolicy,
  isFormalEvidenceEnabled,
} from "@/lib/language-capability-policy";

describe("language capability policy", () => {
  it("keeps English as the calibrated stable baseline", () => {
    const policy = getLanguageCapabilityPolicy("en-US");
    expect(policy.productStatus).toBe("stable");
    expect(policy.formalEvidence).toBe("stable");
    expect(policy.precisePhonemeEvidence).toBe(true);
  });

  it.each([
    "es-ES",
    "fr-FR",
    "ru-RU",
  ] as const)("keeps %s core practice public while advanced evidence remains Labs", (languageId) => {
    const policy = getLanguageCapabilityPolicy(languageId);
    expect(policy.phonemes).toBe("core");
    expect(policy.freePractice).toBe("core");
    expect(policy.guidedTraining).toBe("labs");
    expect(policy.diagnosis).toBe("labs");
    expect(policy.formalEvidence).toBe("unavailable");
    expect(policy.precisePhonemeEvidence).toBe(false);
    expect(isFormalEvidenceEnabled(languageId)).toBe(false);
    expect(getCapabilityNavigationLabel("guidedTraining", languageId)).toBe(
      "\u53d1\u97f3\u5b9e\u9a8c\u5ba4",
    );
  });
});
