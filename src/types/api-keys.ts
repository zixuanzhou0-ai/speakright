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

export interface MerriamWebsterConfig {
  apiKey: string;
}

export type PronunciationSource = "youdao" | "merriam-webster";

export interface PronunciationConfig {
  source: PronunciationSource;
}
