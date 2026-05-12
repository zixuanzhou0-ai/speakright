const STORAGE_KEY = "speakright_usage";

// ===== Types =====

interface AzureCallRecord {
  timestamp: string;
  durationSeconds: number;
  target: string;
}

interface AzureUsage {
  month: string;
  totalSeconds: number;
  totalRequests: number;
  lastUpdated: string;
  history: AzureCallRecord[];
}

interface LlmUsage {
  month: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  estimatedCostYuan: number;
}

interface UsageData {
  azure: AzureUsage;
  llm: LlmUsage;
}

// Azure F0 free tier: 5 hours/month = 18,000 seconds
export const AZURE_FREE_TIER_SECONDS = 18_000;

// Qwen pricing (per 1M tokens, in yuan)
const QWEN_INPUT_PRICE = 0.5; // ¥0.5 / 1M input tokens
const QWEN_OUTPUT_PRICE = 2.0; // ¥2.0 / 1M output tokens

// ===== Helpers =====

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function emptyAzure(): AzureUsage {
  return {
    month: getCurrentMonth(),
    totalSeconds: 0,
    totalRequests: 0,
    lastUpdated: new Date().toISOString(),
    history: [],
  };
}

function emptyLlm(): LlmUsage {
  return {
    month: getCurrentMonth(),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalRequests: 0,
    estimatedCostYuan: 0,
  };
}

function load(): UsageData {
  if (typeof window === "undefined") {
    return { azure: emptyAzure(), llm: emptyLlm() };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { azure: emptyAzure(), llm: emptyLlm() };
    const data = JSON.parse(raw) as UsageData;
    const month = getCurrentMonth();
    if (data.azure.month !== month) data.azure = emptyAzure();
    if (data.llm.month !== month) data.llm = emptyLlm();
    return data;
  } catch {
    return { azure: emptyAzure(), llm: emptyLlm() };
  }
}

function save(data: UsageData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ===== Azure =====

export function trackAzureUsage(durationSeconds: number, target: string): void {
  const data = load();
  data.azure.totalSeconds += durationSeconds;
  data.azure.totalRequests += 1;
  data.azure.lastUpdated = new Date().toISOString();
  data.azure.history = [
    { timestamp: new Date().toISOString(), durationSeconds, target },
    ...data.azure.history,
  ].slice(0, 10);
  save(data);
}

export function getAzureUsage(): AzureUsage {
  return load().azure;
}

export function getAzureRemainingSeconds(): number {
  return Math.max(0, AZURE_FREE_TIER_SECONDS - load().azure.totalSeconds);
}

export function resetAzureUsage(): void {
  const data = load();
  data.azure = emptyAzure();
  save(data);
}

// ===== LLM =====

export function trackLlmUsage(inputTokens: number, outputTokens: number): void {
  const data = load();
  data.llm.totalInputTokens += inputTokens;
  data.llm.totalOutputTokens += outputTokens;
  data.llm.totalRequests += 1;
  data.llm.estimatedCostYuan =
    (data.llm.totalInputTokens / 1_000_000) * QWEN_INPUT_PRICE +
    (data.llm.totalOutputTokens / 1_000_000) * QWEN_OUTPUT_PRICE;
  save(data);
}

export function getLlmUsage(): LlmUsage {
  return load().llm;
}

export function resetLlmUsage(): void {
  const data = load();
  data.llm = emptyLlm();
  save(data);
}
