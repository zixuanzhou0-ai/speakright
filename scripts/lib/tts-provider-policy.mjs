export const REGENERATION_PROVIDER_IDS = [
  "elevenlabs",
  "vortex-gemini-3.1-tts",
];

export function selectRegenerationProvider({
  languageId,
  estimatedCharacters,
  elevenLabsRemainingCharacters,
  safetyReserveCharacters = 5_000,
  vortexConfigured = false,
}) {
  const required = Math.max(0, Number(estimatedCharacters) || 0);
  const remaining = Number.isFinite(Number(elevenLabsRemainingCharacters))
    ? Math.max(0, Number(elevenLabsRemainingCharacters))
    : null;
  const usableElevenLabs =
    remaining === null
      ? null
      : Math.max(0, remaining - safetyReserveCharacters);

  if (usableElevenLabs === null || usableElevenLabs >= required) {
    return {
      providerId: "elevenlabs",
      status: remaining === null ? "usage-unknown" : "ready",
      requiredCharacters: required,
      remainingCharacters: remaining,
      safetyReserveCharacters,
    };
  }

  if (languageId !== "en-US") {
    return {
      providerId: null,
      status: "blocked-insufficient-elevenlabs-non-english",
      requiredCharacters: required,
      remainingCharacters: remaining,
      safetyReserveCharacters,
    };
  }

  return {
    providerId: vortexConfigured ? "vortex-gemini-3.1-tts" : null,
    status: vortexConfigured ? "ready" : "needs-vortex-configuration",
    requiredCharacters: required,
    remainingCharacters: remaining,
    safetyReserveCharacters,
  };
}

export function assertRegenerationProviderAllowed(providerId, languageId) {
  if (!REGENERATION_PROVIDER_IDS.includes(providerId)) {
    throw new Error(`Unsupported regeneration provider: ${providerId}`);
  }
  if (providerId === "vortex-gemini-3.1-tts" && languageId !== "en-US") {
    throw new Error(
      "Vortex Gemini 3.1 TTS fallback is approved only for en-US candidates.",
    );
  }
}
