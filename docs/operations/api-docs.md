# SpeakRight API 参考文档

> 本文档覆盖 SpeakRight 项目全部 14 个 API 端点，按 5 个服务类别组织。
> 所有请求均通过 Next.js API Routes 代理，API 密钥绝不暴露给客户端。

---

## 目录

- [概述](#概述)
  - [认证方式](#认证方式)
  - [错误格式](#错误格式)
  - [参数验证限制](#参数验证限制)
  - [运行时环境](#运行时环境)
- [类型定义](#类型定义)
- [Azure Speech 语音评估](#azure-speech-语音评估)
  - [POST /api/azure/assess — 发音评估](#post-apiazureassess--发音评估)
  - [POST /api/azure/test — 连接测试](#post-apiazuretest--连接测试)
- [ElevenLabs 语音合成](#elevenlabs-语音合成)
  - [POST /api/elevenlabs/tts — 文本转语音](#post-apielevenlabstts--文本转语音)
  - [POST /api/elevenlabs/tts-aligned — 带时间戳的 TTS](#post-apielevenlabstts-aligned--带时间戳的-tts)
  - [POST /api/elevenlabs/test — 连接测试](#post-apielevenlabstest--连接测试)
  - [POST /api/elevenlabs/voices — 获取声音列表](#post-apielevenlabsvoices--获取声音列表)
  - [GET /api/elevenlabs/usage — 用量查询](#get-apielevenlabsusage--用量查询)
- [LLM AI 反馈](#llm-ai-反馈)
  - [POST /api/llm/feedback — AI 教练反馈（流式）](#post-apillmfeedback--ai-教练反馈流式)
  - [POST /api/llm/test — 连接测试](#post-apillmtest--连接测试)
- [韦氏词典发音](#韦氏词典发音)
  - [POST /api/merriam-webster/pronunciation — 获取发音音频](#post-apimerriam-websterpronunciation--获取发音音频)
  - [POST /api/merriam-webster/test — 连接测试](#post-apimerriam-webstertest--连接测试)
  - [POST /api/merriam-webster/stress — 音节重音查询](#post-apimerriam-websterstress--音节重音查询)
- [统一发音代理](#统一发音代理)
  - [POST /api/pronunciation — 统一发音路由](#post-apipronunciation--统一发音路由)

---

## 概述

SpeakRight 共有 **14 个 API 端点**，分属 5 个服务类别。所有端点均通过 Next.js API Routes 代理外部服务，客户端永远不会直接接触第三方 API 密钥。

- **认证**：通过自定义 HTTP Headers 传递凭证（绝不放在请求 body 中）
- **响应格式**：JSON（音频端点返回二进制 `audio/mpeg`）
- **错误格式**：统一返回 `{ "error": "message string" }`
- **速率限制**：所有端点均有 IP 级速率限制（60 次/分钟），超过返回 429

### 认证方式

所有 API 密钥和配置信息通过 HTTP 请求头（Headers）传递：

| 服务 | Header | 类型 | 必填 |
|------|--------|------|------|
| Azure | `x-azure-key` | string | Yes |
| Azure | `x-azure-region` | string | Yes |
| ElevenLabs | `x-elevenlabs-key` | string | Yes |
| ElevenLabs | `x-elevenlabs-voice` | string (voice ID) | TTS 路由必填 |
| ElevenLabs | `x-elevenlabs-model` | string | No（默认 `eleven_flash_v2_5`） |
| LLM | `x-llm-key` | string | Yes |
| LLM | `x-llm-provider` | string（`"claude"` 或省略） | No |
| LLM | `x-llm-base-url` | string | Yes |
| LLM | `x-llm-model` | string | Yes |
| Merriam-Webster | `x-mw-key` | string | Yes |
| Pronunciation | `x-pronunciation-source` | `"youdao"` \| `"merriam-webster"` | No（默认 `youdao`） |
| Pronunciation | `x-mw-key` | string | 仅 source 为 merriam-webster 时必填 |

### 错误格式

所有端点在出错时返回统一的 JSON 格式：

```json
{
  "error": "错误描述信息"
}
```

### 参数验证限制

| 参数 | 限制 | 端点 |
|------|------|------|
| `referenceText` | 最大 500 字符 | `/api/azure/assess` |
| `text`（TTS 文本） | 最大 500 字符 | `/api/elevenlabs/tts`、`/api/elevenlabs/tts-aligned` |
| `word` | 最大 50 字符，不允许空格 | `/api/pronunciation`、`/api/merriam-webster/pronunciation`、`/api/merriam-webster/stress` |
| `speed` | 0.7–1.2（超范围自动钳制），默认 0.85 | `/api/elevenlabs/tts`、`/api/elevenlabs/tts-aligned` |

### 运行时环境

| 运行时 | 端点 | 说明 |
|--------|------|------|
| **Node.js**（显式声明） | `/api/azure/assess`、`/api/azure/test` | Azure Speech SDK 需要 Node.js 环境 |
| **Edge** | `/api/pronunciation`、`/api/merriam-webster/pronunciation`、`/api/merriam-webster/test` | 轻量代理，适合边缘运行 |
| **默认（Node.js）** | 所有 ElevenLabs 路由、所有 LLM 路由 | 无显式 runtime 声明 |

---

## 类型定义

以下类型定义来自项目源码，被多个端点共享使用。

### Azure 评估结果类型

```typescript
// src/types/azure.ts

interface AzurePhoneme {
  phoneme: string;
  accuracyScore: number;
}

interface AzureSyllable {
  syllable: string;
  grapheme?: string;
  accuracyScore: number;
}

interface AzureWord {
  word: string;
  accuracyScore: number;
  errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
  phonemes: AzurePhoneme[];
  syllables: AzureSyllable[];
}

interface AzureAssessmentResult {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;       // 仅句子模式返回
  words: AzureWord[];
}
```

### API 配置类型

```typescript
// src/types/api-keys.ts

interface AzureConfig {
  subscriptionKey: string;
  region: string;
}

interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  voiceName?: string;
  modelId: string;
}

interface LLMConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface MerriamWebsterConfig {
  apiKey: string;
}

type PronunciationSource = "youdao" | "merriam-webster";

interface PronunciationConfig {
  source: PronunciationSource;
}
```

---

## Azure Speech 语音评估

### POST `/api/azure/assess` — 发音评估

核心评估端点。接收用户录音和参考文本，返回多维度发音评分（准确度、流利度、完整度、韵律）及音素级详细分析。

- **Runtime**: `nodejs`（Azure Speech SDK 需要）
- **认证**: `x-azure-key`、`x-azure-region`

#### 请求

- **Content-Type**: `multipart/form-data`
- **FormData 字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `audio` | File（WAV） | Yes | PCM 16kHz 16bit 单声道 WAV 格式（上传时跳过 44 字节 WAV 头） |
| `referenceText` | string | Yes | 目标文本，最大 500 字符 |

> **自动韵律评估**：当 `referenceText` 包含多于 1 个单词时（由 `isSentence()` 判定），自动启用韵律（prosody）评估维度。

#### 成功响应 (200)

返回 `AzureAssessmentResult` 对象：

```json
{
  "pronunciationScore": 85.5,
  "accuracyScore": 88.0,
  "fluencyScore": 82.0,
  "completenessScore": 100.0,
  "prosodyScore": 75.0,
  "words": [
    {
      "word": "hello",
      "accuracyScore": 88.0,
      "errorType": "None",
      "phonemes": [
        { "phoneme": "h", "accuracyScore": 95.0 }
      ],
      "syllables": [
        { "syllable": "hɛ", "grapheme": "he", "accuracyScore": 90.0 }
      ]
    }
  ]
}
```

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 400 | `"Missing Azure credentials"` | 缺少 `x-azure-key` 或 `x-azure-region` |
| 400 | `"Missing audio or referenceText"` | FormData 中缺少必需字段 |
| 400 | `"Reference text too long (max 500 chars)"` | 参考文本超过 500 字符 |
| 422 | `"No speech detected. Please try again."` | 录音中未检测到语音 |
| 500 | Azure SDK 错误信息 | Azure Speech SDK 内部错误 |

#### cURL 示例

```bash
curl -X POST http://localhost:3000/api/azure/assess \
  -H "x-azure-key: YOUR_AZURE_KEY" \
  -H "x-azure-region: eastus" \
  -F "audio=@recording.wav" \
  -F "referenceText=Hello world"
```

---

### POST `/api/azure/test` — 连接测试

验证 Azure Speech 凭证是否有效。通过请求 Azure STS 端点获取 token 来验证。

- **认证**: `x-azure-key`、`x-azure-region`
- **请求 Body**: 无

#### 成功响应 (200)

```json
{ "success": true }
```

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 400 | `"Missing Azure credentials"` | 缺少凭证 |
| 401 | `"Azure auth failed (status): details"` | 认证失败，附带 HTTP 状态码和详情 |
| 500 | 错误信息 | 其他错误 |

---

## ElevenLabs 语音合成

### POST `/api/elevenlabs/tts` — 文本转语音

将文本转换为美式英语语音音频。支持速度调节，内置 voice ID 白名单校验。

- **认证**: `x-elevenlabs-key`、`x-elevenlabs-voice`、`x-elevenlabs-model`（可选）

#### 允许的 Voice ID（白名单）

| Voice 名称 | Voice ID |
|------------|----------|
| Eryn | `RaFzMbMIfqBcIurH6XF9` |
| Daphne | `cR39HTrtXbjvEP4CNYFx` |
| Nichalia | `XfNU2rGpBa01ckF309OY` |
| Liz | `wvk9Caj0nEx4l3I9LaR6` |
| Brian | `G0yjIg3xY8gEJZkHpjVm` |
| Micheal Scott | `ashjVK50jp28G73AUTnb` |
| Max | `Gfpl8Yo74Is0W6cPUWWT` |

#### 固定 Voice Settings

```json
{
  "stability": 0.65,
  "similarity_boost": 0.85,
  "style": 0.35,
  "use_speaker_boost": true
}
```

#### 请求

- **Content-Type**: `application/json`

```json
{
  "text": "Hello, how are you?",
  "speed": 0.85
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | Yes | 要合成的文本，最大 500 字符 |
| `speed` | number | No | 语速，0.7–1.2，超范围自动钳制，默认 0.85 |

#### 成功响应 (200)

- **Content-Type**: `audio/mpeg`
- **Cache-Control**: `no-store`
- 返回二进制 MP3 音频流

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 400 | `"Missing ElevenLabs credentials"` | 缺少 API key 或 voice ID |
| 400 | `"Invalid voice ID"` | voice ID 不在白名单内 |
| 400 | `"Missing text"` | 请求中缺少 text 字段 |
| 400 | `"Text too long (max 500 chars)"` | 文本超过 500 字符 |
| 4xx/5xx | `"ElevenLabs TTS error (status): details"` | ElevenLabs API 返回错误 |

#### cURL 示例

```bash
curl -X POST http://localhost:3000/api/elevenlabs/tts \
  -H "Content-Type: application/json" \
  -H "x-elevenlabs-key: YOUR_ELEVENLABS_KEY" \
  -H "x-elevenlabs-voice: Gfpl8Yo74Is0W6cPUWWT" \
  -d '{"text": "The quick brown fox jumps over the lazy dog.", "speed": 0.9}' \
  --output output.mp3
```

---

### POST `/api/elevenlabs/tts-aligned` — 带时间戳的 TTS

与 `/tts` 端点功能相同，但使用 ElevenLabs `/with-timestamps` 接口，额外返回逐词时间戳对齐数据，用于卡拉 OK 式逐词高亮。

- **认证**: 与 `/tts` 相同（`x-elevenlabs-key`、`x-elevenlabs-voice`、`x-elevenlabs-model`）
- **请求**: 与 `/tts` 相同

#### 成功响应 (200)

返回 JSON，包含 base64 编码的音频数据和逐词时间戳对齐信息：

```json
{
  "audio_base64": "//uQxAAAAAANIAAAAAE...",
  "alignment": {
    "characters": ["H", "e", "l", "l", "o"],
    "character_start_times_seconds": [0.0, 0.05, 0.1, 0.15, 0.2],
    "character_end_times_seconds": [0.05, 0.1, 0.15, 0.2, 0.3]
  }
}
```

#### 错误响应

与 `/tts` 端点相同。

---

### POST `/api/elevenlabs/test` — 连接测试

验证 ElevenLabs API 密钥是否有效。通过请求 `/v1/voices` 端点验证。

- **认证**: `x-elevenlabs-key`
- **请求 Body**: 无

#### 成功响应 (200)

```json
{ "success": true }
```

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 400 | `"Missing ElevenLabs API key"` | 缺少 API key |
| 401 | `"ElevenLabs auth failed (status)"` | 认证失败 |

---

### POST `/api/elevenlabs/voices` — 获取声音列表

获取账户下可用的声音列表。

- **认证**: `x-elevenlabs-key`
- **请求 Body**: 无

#### 成功响应 (200)

```json
{
  "voices": [
    { "voice_id": "Gfpl8Yo74Is0W6cPUWWT", "name": "Max" },
    { "voice_id": "XfNU2rGpBa01ckF309OY", "name": "Nichalia" }
  ]
}
```

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 400 | `"Missing ElevenLabs API key"` | 缺少 API key |
| 4xx/5xx | `"ElevenLabs voices error (status): details"` | API 请求失败 |

---

### GET `/api/elevenlabs/usage` — 用量查询

查询当前 ElevenLabs 账户的字符用量和配额信息。

- **方法**: `GET`
- **认证**: `x-elevenlabs-key`

#### 成功响应 (200)

```json
{
  "characterCount": 1234,
  "characterLimit": 10000,
  "nextResetUnix": 1234567890
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `characterCount` | number | 当前周期已使用字符数 |
| `characterLimit` | number | 当前周期字符上限 |
| `nextResetUnix` | number | 下次重置时间（Unix 时间戳） |

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 400 | `"Missing ElevenLabs API key"` | 缺少 API key |
| 4xx/5xx | `"ElevenLabs usage error (status): details"` | API 请求失败 |

---

## LLM AI 反馈

### POST `/api/llm/feedback` — AI 教练反馈（流式）

基于 Azure 发音评估结果，通过 LLM 生成中文教练反馈。使用 SSE（Server-Sent Events）流式返回。

支持多种 LLM 提供商（Claude、GPT、Gemini、DeepSeek、Qwen 等），均使用 OpenAI 兼容格式。Claude 提供商会使用专用的认证头格式。

- **认证**: `x-llm-key`、`x-llm-base-url`、`x-llm-model`、`x-llm-provider`（可选）

> **Claude 提供商特殊处理**：当 `x-llm-provider` 为 `"claude"` 时，使用 `x-api-key` 头 + `anthropic-version: 2023-06-01` 头。其他提供商使用标准 OpenAI 兼容客户端。

#### 请求

- **Content-Type**: `application/json`

```json
{
  "target": "hello",
  "azureResult": {
    "pronunciationScore": 85.5,
    "accuracyScore": 88.0,
    "fluencyScore": 82.0,
    "completenessScore": 100.0,
    "words": [
      {
        "word": "hello",
        "accuracyScore": 88.0,
        "errorType": "None",
        "phonemes": [{ "phoneme": "h", "accuracyScore": 95.0 }],
        "syllables": [{ "syllable": "hɛ", "grapheme": "he", "accuracyScore": 90.0 }]
      }
    ]
  },
  "mode": "phoneme"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `target` | string | Yes | 评估的目标文本 |
| `azureResult` | AzureAssessmentResult | Yes | 完整的 Azure 评估结果对象 |
| `mode` | `"phoneme"` \| `"sentence"` | No | 评估模式，默认 `"phoneme"` |

#### 成功响应 (200)

- **Content-Type**: `text/event-stream`
- 返回 SSE 流：

```
data: {"content":"AI 反馈文本..."}\n\n
data: {"content":"更多文本..."}\n\n
data: {"usage":{"prompt_tokens":100,"completion_tokens":50}}\n\n
data: [DONE]\n\n
```

| 事件类型 | 说明 |
|----------|------|
| `{"content": "..."}` | 增量文本内容 |
| `{"usage": {...}}` | token 用量统计（`prompt_tokens`、`completion_tokens`） |
| `[DONE]` | 流结束标志 |

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 400 | `"Missing required fields"` | 缺少 target 或 azureResult |
| 500 | 错误信息 | LLM API 调用失败 |

#### cURL 示例

```bash
curl -X POST http://localhost:3000/api/llm/feedback \
  -H "Content-Type: application/json" \
  -H "x-llm-key: YOUR_LLM_KEY" \
  -H "x-llm-base-url: https://api.openai.com/v1" \
  -H "x-llm-model: gpt-4o-mini" \
  -d '{
    "target": "hello world",
    "azureResult": {
      "pronunciationScore": 75.0,
      "accuracyScore": 80.0,
      "fluencyScore": 70.0,
      "completenessScore": 100.0,
      "words": [
        {
          "word": "hello",
          "accuracyScore": 80.0,
          "errorType": "None",
          "phonemes": [{"phoneme": "h", "accuracyScore": 90.0}],
          "syllables": [{"syllable": "hɛ", "grapheme": "he", "accuracyScore": 85.0}]
        },
        {
          "word": "world",
          "accuracyScore": 70.0,
          "errorType": "Mispronunciation",
          "phonemes": [{"phoneme": "w", "accuracyScore": 60.0}],
          "syllables": [{"syllable": "wɝːld", "grapheme": "world", "accuracyScore": 70.0}]
        }
      ]
    },
    "mode": "sentence"
  }'
```

---

### POST `/api/llm/test` — 连接测试

验证 LLM 配置是否有效。发送简单测试消息 `"Say hello in Chinese, one sentence only."`，`max_tokens` 限制为 50。

- **认证**: `x-llm-key`、`x-llm-base-url`、`x-llm-model`、`x-llm-provider`（可选）
- **请求 Body**: 无

#### 成功响应 (200)

```json
{ "success": true, "reply": "你好！" }
```

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 400 | `"Missing LLM config"` | 缺少必需的 LLM 配置 |
| 500 | 错误信息 | LLM API 调用失败 |

---

## 韦氏词典发音

### POST `/api/merriam-webster/pronunciation` — 获取发音音频

从韦氏词典 API 获取单词发音音频。先查询词典获取音频文件名，再代理下载音频文件。

- **Runtime**: `edge`
- **认证**: `x-mw-key`

#### 音频子目录逻辑

韦氏词典音频文件存储在不同子目录下，规则如下：

| 条件 | 子目录 |
|------|--------|
| 文件名以 `bix` 开头 | `bix` |
| 文件名以 `gg` 开头 | `gg` |
| 文件名以数字或非字母字符开头 | `number` |
| 其他 | 文件名首字符 |

#### 请求

- **Content-Type**: `application/json`

```json
{ "word": "hello" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `word` | string | Yes | 要查询的单词，1–50 字符，不含空格（自动 trim 并转小写） |

#### 成功响应 (200)

- **Content-Type**: `audio/mpeg`
- **Cache-Control**: `public, max-age=86400`
- 返回二进制音频数据

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 400 | `"Invalid JSON body"` | 请求体 JSON 解析失败 |
| 400 | `"Missing word parameter"` | 缺少 word 参数 |
| 400 | `"Word too long (max 50 chars)"` | 单词超过 50 字符 |
| 400 | `"Only single words allowed"` | 输入包含空格 |
| 401 | `"Missing x-mw-key header"` | 缺少 API key |
| 404 | `"Word not found in dictionary"` | 词典中未找到该单词 |
| 404 | `"No pronunciation audio available"` | 该单词无可用发音音频 |
| 502 | `"MW API error: {status}"` | 韦氏词典 API 返回错误 |
| 502 | `"Failed to fetch audio from MW"` | 音频文件下载失败 |

---

### POST `/api/merriam-webster/test` — 连接测试

验证韦氏词典 API 密钥是否有效。使用单词 `"hello"` 进行测试。

- **认证**: `x-mw-key`
- **请求 Body**: 无

#### 成功响应 (200)

```json
{ "success": true, "word": "hello", "hasAudio": true }
```

#### 错误响应

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 401 | `"Missing x-mw-key header"` | 缺少 API key |
| 401 | `"Invalid API key or unexpected response"` | API key 无效或响应格式异常 |
| 502 | `"MW API returned {status}"` | 韦氏词典 API 返回错误状态码 |
| 502 | `"Unexpected API response format"` | API 响应格式不符合预期 |
| 502 | `"Network error"` | 网络请求失败 |

---

### POST `/api/merriam-webster/stress` — 音节重音查询

获取单词的音节重音标注数据。

**运行时**：Edge

**请求头**：

| Header | 类型 | 必填 |
|--------|------|------|
| `x-mw-key` | string | No（无 key 时返回 `{ stress: null, mw: null }`） |

**请求体** (JSON)：
```json
{
  "word": "afternoon"
}
```

- word: 1-50 字符，不含空格，自动 trim + lowercase

**成功响应 (200)**：
```json
{
  "stress": ["secondary", "none", "primary"],
  "mw": "ˌaf-tər-ˈnün"
}
```

- `stress`: StressLevel 数组（`"primary"` | `"secondary"` | `"none"`），每项对应一个音节。无重音标记时为 `null`。
- `mw`: 韦氏词典发音标注字符串。无数据时为 `null`。

**无数据响应 (200)**：
```json
{
  "stress": null,
  "mw": null
}
```

当 MW API Key 缺失、单词无效、或词典中无发音数据时返回此响应。

**错误响应**：
- 400: `"Invalid JSON body"`
- 429: `"Too many requests. Please try again later."` (速率限制)

---

## 统一发音代理

### POST `/api/pronunciation` — 统一发音路由

统一的单词发音代理路由，根据用户在设置页选择的音源自动路由到对应的发音服务。

- **Runtime**: `edge`
- **认证**: `x-pronunciation-source`（可选）、`x-mw-key`（韦氏词典时必填）

#### 路由规则

| 音源 | 说明 | 认证 |
|------|------|------|
| `youdao`（默认） | 有道词典 `http://dict.youdao.com/dictvoice?type=0&audio={word}`，无需 API key，国内访问快 | 无 |
| `merriam-webster` | 转发至 `/api/merriam-webster/pronunciation` 的相同逻辑 | 需要 `x-mw-key` |

#### 请求

- **Content-Type**: `application/json`

```json
{ "word": "hello" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `word` | string | Yes | 要查询的单词，1–50 字符，不含空格 |

#### 成功响应 (200)

- **Content-Type**: `audio/mpeg`
- **Cache-Control**: `public, max-age=86400`
- 返回二进制音频数据

#### 错误响应

包含韦氏词典端点的所有错误，以及：

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| 401 | `"Missing x-mw-key header for Merriam-Webster"` | 选择韦氏词典但未提供 API key |
| 502 | `"Youdao returned {status}"` | 有道词典返回错误状态码 |
| 502 | `"Network error fetching pronunciation"` | 网络请求失败 |
