export type LanguageId = "en-US" | "es-ES" | "fr-FR" | "ru-RU";
export type CapabilityLevel = "stable" | "core" | "labs" | "unavailable";
export type LanguageCapabilityRoute =
  | "phonemes"
  | "freePractice"
  | "guidedTraining"
  | "diagnosis"
  | "formalEvidence";

export interface LanguageCapabilityPolicy {
  languageId: LanguageId;
  productStatus: "stable" | "labs";
  phonemes: CapabilityLevel;
  freePractice: CapabilityLevel;
  guidedTraining: CapabilityLevel;
  diagnosis: CapabilityLevel;
  formalEvidence: CapabilityLevel;
  precisePhonemeEvidence: boolean;
  prosodyEvidence: boolean;
}

const ENGLISH_POLICY: LanguageCapabilityPolicy = {
  languageId: "en-US",
  productStatus: "stable",
  phonemes: "stable",
  freePractice: "stable",
  guidedTraining: "stable",
  diagnosis: "stable",
  formalEvidence: "stable",
  precisePhonemeEvidence: true,
  prosodyEvidence: true,
};

function labsPolicy(
  languageId: Exclude<LanguageId, "en-US">,
): LanguageCapabilityPolicy {
  return {
    languageId,
    productStatus: "labs",
    phonemes: "core",
    freePractice: "core",
    guidedTraining: "labs",
    diagnosis: "labs",
    formalEvidence: "unavailable",
    precisePhonemeEvidence: false,
    prosodyEvidence: false,
  };
}

export const LANGUAGE_CAPABILITY_POLICIES: Record<
  LanguageId,
  LanguageCapabilityPolicy
> = {
  "en-US": ENGLISH_POLICY,
  "es-ES": labsPolicy("es-ES"),
  "fr-FR": labsPolicy("fr-FR"),
  "ru-RU": labsPolicy("ru-RU"),
};

export function getLanguageCapabilityPolicy(
  languageId: LanguageId,
): LanguageCapabilityPolicy {
  return LANGUAGE_CAPABILITY_POLICIES[languageId];
}

export function getRouteCapability(
  policy: LanguageCapabilityPolicy,
  route: LanguageCapabilityRoute,
): CapabilityLevel {
  return policy[route];
}

export function isFormalEvidenceEnabled(languageId: LanguageId): boolean {
  return getLanguageCapabilityPolicy(languageId).formalEvidence === "stable";
}

export function getCapabilityNavigationLabel(
  route: "guidedTraining" | "diagnosis",
  languageId: LanguageId,
): string {
  const labs = getLanguageCapabilityPolicy(languageId).productStatus === "labs";
  if (route === "guidedTraining") {
    return labs ? "\u53d1\u97f3\u5b9e\u9a8c\u5ba4" : "\u523b\u610f\u7ec3\u4e60";
  }
  return labs ? "\u5b9e\u9a8c\u8bca\u65ad" : "\u53d1\u97f3\u8bca\u65ad";
}
