const CJK_TEXT_PATTERN = /[\u3400-\u9fff]/;

export const STANDARD_TTS_UNAVAILABLE_MESSAGE =
  "无法播放标准示范：请先在设置页选择并完成一个标准示范 TTS（ElevenLabs、爱马仕 Grok 或 Vertex Gemini），或改用随应用提供示范音频的练习内容。单词词典发音只负责单词复读。";

function truncateTtsDetail(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

export function normalizeStandardTtsError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error);
  const message = truncateTtsDetail(raw);

  if (!message) return STANDARD_TTS_UNAVAILABLE_MESSAGE;

  if (CJK_TEXT_PATTERN.test(message)) {
    return `${STANDARD_TTS_UNAVAILABLE_MESSAGE}（${message}）`;
  }

  if (
    /401|403|auth|unauthorized|forbidden|api key|invalid key/i.test(message)
  ) {
    return `${STANDARD_TTS_UNAVAILABLE_MESSAGE}（当前标准示范服务认证失败，请检查所选服务的登录或 API 配置。）`;
  }

  if (/429|quota|rate limit|too many requests|insufficient/i.test(message)) {
    return `${STANDARD_TTS_UNAVAILABLE_MESSAGE}（当前标准示范服务请求过于频繁或额度不足，请稍后重试并检查对应服务用量。）`;
  }

  if (/400|404|voice|model|not found|bad request/i.test(message)) {
    return `${STANDARD_TTS_UNAVAILABLE_MESSAGE}（当前标准示范服务配置无效，请检查声音、模型和文本长度。）`;
  }

  if (
    /fetch|network|dns|timeout|timed out|connection|offline|refused/i.test(
      message,
    )
  ) {
    return `${STANDARD_TTS_UNAVAILABLE_MESSAGE}（无法连接当前标准示范服务；使用爱马仕时，请同时确认本机桥接服务正在运行。）`;
  }

  if (/indexeddb|database|storage|cache|transaction|quota/i.test(message)) {
    return `${STANDARD_TTS_UNAVAILABLE_MESSAGE}（本地标准示范缓存不可用，请重试；如果持续失败，可在设置页清理本地数据。）`;
  }

  return `${STANDARD_TTS_UNAVAILABLE_MESSAGE}（标准示范服务异常，请稍后重试；如果持续失败，请检查当前所选 TTS 配置。）`;
}
