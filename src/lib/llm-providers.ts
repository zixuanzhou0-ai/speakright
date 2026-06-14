import type { PresetProvider, ProviderName } from "@/types/llm";

export const PRESET_PROVIDERS: Record<ProviderName, PresetProvider> = {
  claude: {
    label: "Claude",
    baseUrl: "https://api.anthropic.com/v1",
    models: [
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
    ],
    status: "ready",
    docsUrl: "https://docs.anthropic.com/en/docs/about-claude/models/overview",
  },
  gpt: {
    label: "GPT",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
    status: "ready",
    docsUrl: "https://developers.openai.com/api/docs/models",
  },
  gemini: {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-3.5-flash", "gemini-3.1-pro", "gemini-3.1-flash-lite"],
    status: "ready",
    docsUrl: "https://ai.google.dev/gemini-api/docs/models",
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-v4-pro", "deepseek-v4-flash"],
    status: "ready",
    docsUrl: "https://api-docs.deepseek.com/",
  },
  qwen: {
    label: "Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen3-max", "qwen3.5-plus", "qwen3.5-flash"],
    status: "ready",
    docsUrl: "https://www.alibabacloud.com/help/en/model-studio/models",
  },
  glm: {
    label: "GLM / Z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    models: ["glm-5.1", "glm-5", "glm-5-turbo"],
    status: "ready",
    docsUrl: "https://docs.z.ai/guides/llm/glm-5.1",
  },
  moonshot: {
    label: "Kimi",
    baseUrl: "https://api.moonshot.ai/v1",
    models: ["kimi-k2.7-code", "kimi-k2.6", "kimi-k2.5"],
    status: "ready",
    docsUrl: "https://platform.kimi.ai/docs/models",
  },
  doubao: {
    label: "Doubao",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: ["doubao-seed-2-0-pro", "doubao-seed-2-0-lite"],
    status: "ready",
    docsUrl: "https://www.volcengine.com/docs/82379/1330310",
  },
  minimax: {
    label: "MiniMax",
    baseUrl: "",
    models: [],
    status: "needsManualConfig",
    docsUrl: "https://www.minimax.io/",
    baseUrlEditable: true,
  },
  mimo: {
    label: "Xiaomi MiMo",
    baseUrl: "",
    models: [],
    status: "needsManualConfig",
    docsUrl: "https://mimo.xiaomi.com/",
    baseUrlEditable: true,
  },
  custom: {
    label: "Custom",
    baseUrl: "",
    models: [],
    status: "needsManualConfig",
    baseUrlEditable: true,
  },
};

export const PROVIDER_NAMES = Object.keys(PRESET_PROVIDERS) as ProviderName[];

export function isProviderName(value: unknown): value is ProviderName {
  return (
    typeof value === "string" &&
    (PROVIDER_NAMES as readonly string[]).includes(value)
  );
}

export function normalizeStoredProvider(
  value: unknown,
  isDesktop = false,
): ProviderName {
  if (!isProviderName(value)) return "claude";
  return isDesktop && value === "custom" ? "claude" : value;
}

const DESKTOP_ALLOWED_LLM_ORIGINS = new Set(
  [
    ...Object.entries(PRESET_PROVIDERS)
      .filter(
        ([provider, preset]) =>
          provider !== "custom" &&
          preset.status !== "needsManualConfig" &&
          preset.baseUrl,
      )
      .map(([, preset]) => new URL(preset.baseUrl).origin),
    // Keep previously saved Kimi/GLM configs working while new presets move
    // to the current official endpoints.
    "https://api.moonshot.cn",
    "https://open.bigmodel.cn",
  ],
);

export const DESKTOP_LLM_POLICY_MESSAGE =
  "桌面版出于安全只允许预设 LLM provider；Custom endpoint 需要先加入 Tauri allowlist 和 CSP 后才能启用。";

export function getDesktopLlmPolicyError(
  provider: string,
  baseUrl: string,
): string | null {
  if (!isProviderName(provider) || provider === "custom") {
    return DESKTOP_LLM_POLICY_MESSAGE;
  }
  try {
    const origin = new URL(baseUrl).origin;
    return DESKTOP_ALLOWED_LLM_ORIGINS.has(origin)
      ? null
      : DESKTOP_LLM_POLICY_MESSAGE;
  } catch {
    return DESKTOP_LLM_POLICY_MESSAGE;
  }
}
