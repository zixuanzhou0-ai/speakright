const CJK_TEXT_PATTERN = /[\u3400-\u9fff]/;

function truncateAzureDetail(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

export function normalizeAzureSpeechError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error);
  const message = truncateAzureDetail(raw);

  if (!message) {
    return "Azure Speech 评分失败，请检查 Azure Speech API 密钥、区域、网络或代理后重试。";
  }

  if (CJK_TEXT_PATTERN.test(message)) return message;

  if (/no speech|silence|nomatch|initialsilencetimeout/i.test(message)) {
    return "没有检测到清晰语音，请靠近麦克风、读完目标内容后重新录音。";
  }

  if (/401|403|auth|unauthorized|forbidden|subscription|api key|invalid key/i.test(message)) {
    return "Azure Speech 认证失败，请检查设置页里的 Subscription Key 和区域是否匹配。";
  }

  if (/429|quota|rate limit|too many requests|insufficient/i.test(message)) {
    return "Azure Speech 请求过于频繁或额度已用尽，请稍后重试或检查 Azure 配额。";
  }

  if (/400|404|region|endpoint|not found|bad request/i.test(message)) {
    return "Azure Speech 请求配置无效，请检查设置页里的 Azure 区域和评分语言。";
  }

  if (
    /fetch|network|dns|timeout|timed out|connection|offline|refused/i.test(
      message,
    )
  ) {
    return "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。";
  }

  if (/json|parse|unexpected token|syntax/i.test(message)) {
    return "Azure Speech 返回的数据暂时无法解析，请重新录音后重试；如果持续失败，请检查网络或 Azure 区域。";
  }

  return "Azure Speech 评分失败，请检查 Azure Speech API 密钥、区域、网络或代理后重试。";
}
