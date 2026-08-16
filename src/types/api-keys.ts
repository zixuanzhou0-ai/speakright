export interface AzureConfig {
  subscriptionKey: string;
  region: string;
}

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  voiceName?: string;
  modelId: string;
}

export type StandardTtsProvider =
  | "elevenlabs"
  | "hermes-grok"
  | "vertex-gemini";

/**
 * Non-sensitive preference that selects the standard demonstration voice
 * backend. Provider credentials remain in their own secure/local owner.
 */
export interface StandardTtsConfig {
  provider: StandardTtsProvider;
}

/** Non-sensitive local Vertex Gemini TTS preferences. */
export interface VertexGeminiTtsConfig {
  voiceName: string;
}

export interface LLMConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface PronunciationConfig {
  source: "youdao";
}

export type { LanguageConfig } from "@/types/language";
