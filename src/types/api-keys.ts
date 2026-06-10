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
