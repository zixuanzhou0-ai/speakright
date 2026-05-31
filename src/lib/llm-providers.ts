import type { PresetProvider, ProviderName } from "@/types/llm";

export const PRESET_PROVIDERS: Record<ProviderName, PresetProvider> = {
  claude: {
    label: "Claude",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  },
  gpt: {
    label: "GPT",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.4-mini", "o3-mini"],
  },
  gemini: {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  qwen: {
    label: "Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen3-max", "qwen3.5-flash"],
  },
  glm: {
    label: "GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-5", "glm-4-flash"],
  },
  moonshot: {
    label: "Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["kimi-k2.5", "kimi-k2-thinking"],
  },
  doubao: {
    label: "Doubao",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: ["doubao-seed-2-0-pro", "doubao-seed-2-0-lite"],
  },
  custom: {
    label: "Custom",
    baseUrl: "",
    models: [],
  },
};

export const PROVIDER_NAMES = Object.keys(PRESET_PROVIDERS) as ProviderName[];

const DESKTOP_ALLOWED_LLM_ORIGINS = new Set(
  Object.entries(PRESET_PROVIDERS)
    .filter(([provider]) => provider !== "custom")
    .map(([, preset]) => new URL(preset.baseUrl).origin),
);

export const DESKTOP_LLM_POLICY_MESSAGE =
  "桌面版出于安全只允许预设 LLM provider；Custom endpoint 需要先加入 Tauri allowlist 和 CSP 后才能启用。";

export function getDesktopLlmPolicyError(
  provider: string,
  baseUrl: string,
): string | null {
  if (provider === "custom") return DESKTOP_LLM_POLICY_MESSAGE;
  try {
    const origin = new URL(baseUrl).origin;
    return DESKTOP_ALLOWED_LLM_ORIGINS.has(origin)
      ? null
      : DESKTOP_LLM_POLICY_MESSAGE;
  } catch {
    return DESKTOP_LLM_POLICY_MESSAGE;
  }
}
