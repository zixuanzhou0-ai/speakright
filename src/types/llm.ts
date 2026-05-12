export type ProviderName =
  | "claude"
  | "gpt"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "glm"
  | "moonshot"
  | "doubao"
  | "custom";

export interface PresetProvider {
  label: string;
  baseUrl: string;
  models: string[];
}
