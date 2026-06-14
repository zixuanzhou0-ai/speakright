export type ProviderName =
  | "claude"
  | "gpt"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "glm"
  | "moonshot"
  | "doubao"
  | "minimax"
  | "mimo"
  | "custom";

export type PresetProviderStatus = "ready" | "needsManualConfig";

export interface PresetProvider {
  label: string;
  baseUrl: string;
  models: string[];
  status?: PresetProviderStatus;
  docsUrl?: string;
  baseUrlEditable?: boolean;
}
