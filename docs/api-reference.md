# API Reference

All external API integrations. Each is called through server-side `/api/*` routes (keys never exposed to client).

## Azure Speech — Pronunciation Assessment

**SDK**: `microsoft-cognitiveservices-speech-sdk`

**Runtime**: Node.js (SDK 不支持 Edge)

**Auth**: Subscription Key + Region (from localStorage)

**Assessment config**:
```typescript
{
  referenceText: string,           // 目标文本
  gradingSystem: "HundredMark",
  granularity: "Phoneme",          // 音素级评分
  dimension: "Comprehensive",       // 准确度+流利度+完整度
  enableMiscue: true,              // 错读/漏读/多读
  enableProsodyAssessment: isSentence(referenceText)  // 韵律评估，仅句子模式启用（单词模式关闭以避免拖低总分）
}
```

**Response shape** (关键字段):
```typescript
interface AzureAssessmentResult {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;           // 韵律评分（句子模式）
  words: Array<{
    word: string;
    accuracyScore: number;
    errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
    phonemes: Array<{
      phoneme: string;
      accuracyScore: number;
    }>;
    syllables: Array<{             // 音节级评分
      syllable: string;
      grapheme?: string;
      accuracyScore: number;
    }>;
  }>;
}
```

**Audio format**: PCM 16kHz 16bit mono WAV (best accuracy)

**Pricing**: Standard STT rate (~$1/hour), F0 free tier = 5 hours/month

**Usage tracking**: 每次评估后在 localStorage 记录秒数（从 WAV blob 大小估算），用于设置页用量监控

**API Routes**:
| Route | Method | Function |
|-------|--------|----------|
| `/api/azure/assess` | POST | FormData(audio + referenceText) + headers(x-azure-key, x-azure-region) → 评分 JSON |
| `/api/azure/test` | POST | Token fetch 测试连接 |

## ElevenLabs — Text to Speech

**Auth**: `xi-api-key` header

**两个 TTS 端点**:

| Endpoint | 用途 | 返回 |
|----------|------|------|
| `POST /v1/text-to-speech/{voice_id}` | 标准 TTS | audio/mpeg binary |
| `POST /v1/text-to-speech/{voice_id}/with-timestamps` | 带时间戳 TTS（用于逐词高亮） | `{ audio_base64, alignment: { characters, character_start_times_seconds, character_end_times_seconds } }` |

**Voice settings (sentence mode)**:
```json
{
  "stability": 0.75,
  "similarity_boost": 0.80,
  "style": 0.25,
  "use_speaker_boost": true
}
```

**Voice settings (word mode, pre-generated)**:
```json
{
  "stability": 0.85,
  "similarity_boost": 0.85,
  "style": 0,
  "speed": 0.9
}
```

**Usage endpoint**: `GET /v1/user/subscription` → 需要 API Key 有 `user_read` 权限
- `character_count`: 本月已用字符数
- `character_limit`: 本月总额度
- `next_character_count_reset_unix`: 重置时间

**API Routes**:
| Route | Method | Function |
|-------|--------|----------|
| `/api/elevenlabs/tts` | POST | 标准 TTS，流式返回 audio/mpeg |
| `/api/elevenlabs/tts-aligned` | POST | 带时间戳 TTS，返回 JSON (audio_base64 + alignment) |
| `/api/elevenlabs/usage` | GET | 查询用量（proxy to /v1/user/subscription） |
| `/api/elevenlabs/voices` | POST | 获取 voice 列表 |
| `/api/elevenlabs/test` | POST | 测试连接 |

## LLM — Multi-Provider Chinese Feedback

All providers use OpenAI-compatible `/v1/chat/completions` endpoint.

**SDK**: `openai` npm package

**Streaming**: SSE with `stream_options: { include_usage: true }` — 最后一个 chunk 包含 `usage.prompt_tokens` 和 `usage.completion_tokens`，客户端解析后记录到 localStorage 用量追踪。

**Preset providers**:
| Provider | Base URL | Models |
|----------|----------|--------|
| Claude | https://api.anthropic.com/v1 | claude-sonnet-4-6, claude-haiku-4-5-20251001 |
| GPT | https://api.openai.com/v1 | gpt-5.4-mini, o3-mini |
| Gemini | https://generativelanguage.googleapis.com/v1beta/openai | gemini-2.5-pro, gemini-2.5-flash |
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat, deepseek-reasoner |
| Qwen | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen3-max, qwen3.5-flash |
| GLM | https://open.bigmodel.cn/api/paas/v4 | glm-5, glm-4-flash |
| Kimi | https://api.moonshot.cn/v1 | kimi-k2.5, kimi-k2-thinking |
| Doubao | https://ark.cn-beijing.volces.com/api/v3 | doubao-seed-2-0-pro, doubao-seed-2-0-lite |
| Custom | (user fills) | (user fills) |

**Note**: Claude API 需特殊 header 适配（`x-api-key` + `anthropic-version`），其他全部兼容 OpenAI SDK。Model 字段为自由输入框 + 预设 chips。

**Prompt**: 严格教练风格，六大分析维度。完整模板见 `src/lib/llm-prompt.ts`。

**API Routes**:
| Route | Method | Function |
|-------|--------|----------|
| `/api/llm/feedback` | POST | SSE 流式返回中文反馈 + 末尾 usage 数据 |
| `/api/llm/test` | POST | 简单 prompt 测试连接 |

## 单词发音 — 统一代理路由

**Route**: `POST /api/pronunciation`

根据用户在设置页选择的发音音源，代理请求到对应上游服务。

**Request**:
- Body: `{ "word": "hello" }`
- Headers:
  - `x-pronunciation-source`: `"youdao"` (default) 或 `"merriam-webster"`
  - `x-mw-key`: 韦氏词典 API Key（仅 source=merriam-webster 时需要）

**音源上游**:
| Source | Upstream URL |
|--------|-------------|
| youdao | `http://dict.youdao.com/dictvoice?type=0&audio={word}` |
| merriam-webster | MW Dictionary API → `media.merriam-webster.com` 音频文件 |

**Response**: `audio/mpeg` 音频流，`Cache-Control: public, max-age=86400`

**Fallback**: 客户端 hook (`useMwPronunciation`) 在 API 失败时 fallback 到本地 `/audio/words/blue/{word}.mp3`
