# SpeakRight 开发者入门指南

> 面向中国市场的美式英语发音矫正 Web App。用户听标准示范、跟读、获得 AI 评分与中文反馈。

---

## 目录

- [1. 技术栈概览](#1-技术栈概览)
- [2. 环境搭建](#2-环境搭建)
  - [2.1 前置要求](#21-前置要求)
  - [2.2 安装依赖](#22-安装依赖)
  - [2.3 启动开发服务器](#23-启动开发服务器)
- [3. NPM 脚本](#3-npm-脚本)
- [4. 项目结构](#4-项目结构)
  - [4.1 目录树](#41-目录树)
  - [4.2 App Router 页面](#42-app-router-页面)
  - [4.3 组件分层](#43-组件分层)
  - [4.4 Hooks](#44-hooks)
  - [4.5 Lib 工具库](#45-lib-工具库)
  - [4.6 类型定义](#46-类型定义)
- [5. 核心架构模式](#5-核心架构模式)
  - [5.1 API 代理模式](#51-api-代理模式)
  - [5.2 双音频系统](#52-双音频系统)
  - [5.3 存储策略（Phase 1 = localStorage）](#53-存储策略phase-1--localstorage)
  - [5.4 自定义 ThemeProvider](#54-自定义-themeprovider)
  - [5.5 LLM 流式反馈（SSE）](#55-llm-流式反馈sse)
- [6. 外部 API 集成](#6-外部-api-集成)
  - [6.1 Azure Speech（发音评估）](#61-azure-speech发音评估)
  - [6.2 ElevenLabs（TTS 语音合成）](#62-elevenlabstts-语音合成)
  - [6.3 LLM 多厂商（AI 反馈）](#63-llm-多厂商ai-反馈)
  - [6.4 发音音源（有道 / 韦氏词典）](#64-发音音源有道--韦氏词典)
- [7. 音标数据管理](#7-音标数据管理)
  - [7.1 数据结构](#71-数据结构)
  - [7.2 添加新音标或单词](#72-添加新音标或单词)
  - [7.3 选词算法](#73-选词算法)
- [8. UI 与样式约定](#8-ui-与样式约定)
  - [8.1 品牌色与主题](#81-品牌色与主题)
  - [8.2 字体系统](#82-字体系统)
  - [8.3 shadcn/ui 组件](#83-shadcnui-组件)
  - [8.4 Motion v12 动画](#84-motion-v12-动画)
  - [8.5 双栏布局模式](#85-双栏布局模式)
- [9. 代码规范与工具链](#9-代码规范与工具链)
  - [9.1 Biome（Lint + Format）](#91-biomelint--format)
  - [9.2 TypeScript 配置](#92-typescript-配置)
  - [9.3 React Compiler](#93-react-compiler)
- [10. 常见问题与排错](#10-常见问题与排错)
- [11. 构建脚本](#11-构建脚本)

---

## 1. 技术栈概览

| 分类 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router, Turbopack) | 16.2.1 |
| 视图层 | React + React Compiler | 19.2.4 |
| 语言 | TypeScript (strict mode) | ^5 |
| UI 组件 | shadcn/ui v4 (Base UI primitives, @base-ui/react) | ^1.3.0 |
| CSS | Tailwind CSS v4 + @tailwindcss/postcss + @tailwindcss/typography | ^4 |
| 动画 | Motion (import from `motion/react`) | ^12.38.0 |
| 音频播放 | Howler.js | ^2.2.4 |
| 波形显示 | wavesurfer.js | ^7.12.4 |
| 语音评估 | microsoft-cognitiveservices-speech-sdk | ^1.48.0 |
| LLM 客户端 | OpenAI SDK (OpenAI-compatible format) | ^6.32.0 |
| Markdown 渲染 | react-markdown + remark-gfm | ^10.1.0 / ^4.0.1 |
| Toast 通知 | Sonner | ^2.0.7 |
| 图标 | Lucide React | ^1.0.1 |
| Lint + Format | Biome | ^2.4.8 |
| 字体 | Manrope (标题) + Inter (正文) + Geist Mono (IPA/代码) | Google Fonts |

---

## 2. 环境搭建

### 2.1 前置要求

- **Node.js** >= 20（推荐 LTS 版本）
- **npm** >= 10
- **Git**
- **Rust toolchain**（桌面端开发必需）
- **Windows 桌面端额外要求**：Microsoft C++ Build Tools + WebView2

### 2.2 安装依赖

```bash
git clone <repo-url>
cd SpeakRight
npm install
```

### 2.3 启动开发服务器

```bash
npm run dev
```

Turbopack 开发服务器默认在 `http://localhost:3000` 启动。

桌面端开发模式：

```bash
npm run desktop:dev
```

该命令会通过 Tauri 启动桌面窗口，并自动在 `http://localhost:1420` 拉起 Next.js 开发服务器。
首次运行前需先安装 Tauri 桌面开发依赖：Rust，以及 Windows 下的 Microsoft C++ Build Tools 和 WebView2。

> 注意：本项目不需要 `.env` 文件。所有 API Key 由用户在设置页（`/settings`）通过浏览器 localStorage 配置，通过 HTTP headers 传递给 API Routes。

---

## 3. NPM 脚本

```bash
npm run dev           # next dev --turbopack — 启动开发服务器
npm run desktop:dev   # tauri dev — 启动桌面端开发模式
npm run build         # next build — 生产构建
npm run desktop:build # tauri build — 打包桌面端应用
npm run start         # next start — 启动生产服务器
npm run lint          # biome check . — 代码检查（不自动修复）
npm run lint:fix      # biome check --fix . — 自动修复 lint + format 问题
npm run generate:audio  # node scripts/generate-word-audio.mjs — 批量生成 ElevenLabs 单词音频
```

其他手动命令：

```bash
npx shadcn@latest add <component>          # 添加 shadcn/ui 组件
node scripts/download-word-emoji.mjs       # 下载 Fluent Emoji 3D PNG 图片
npx biome check --fix .                    # 等同 npm run lint:fix
```

---

## 4. 项目结构

### 4.1 目录树

```
src/
├── app/                    App Router 页面 + API 路由
│   ├── layout.tsx         根布局 (ThemeProvider + Navbar + Toaster)
│   ├── page.tsx           首页 (Hero + 功能卡片)
│   ├── globals.css        全局样式 (Tailwind v4 + 自定义 CSS 变量)
│   ├── phonemes/
│   │   ├── page.tsx       音标列表页 (元音/辅音 Tabs)
│   │   └── [phoneme]/
│   │       └── page.tsx   音标详情页 (双栏练习布局)
│   ├── sentences/
│   │   └── page.tsx       自由练习页 (双栏练习布局)
│   ├── settings/
│   │   └── page.tsx       设置页 (API 配置 + 用量监控)
│   └── api/               服务端 API 代理路由
│       ├── azure/         assess (发音评估) + test (连通测试)
│       ├── elevenlabs/    tts + tts-aligned + usage + voices + test
│       ├── llm/           feedback (SSE 流式) + test
│       ├── merriam-webster/  pronunciation + test
│       └── pronunciation/ 统一发音代理 (有道/韦氏自动切换)
├── components/
│   ├── audio/             录音与播放组件
│   ├── phoneme/           音标卡片与单词展示
│   ├── scoring/           评分展示与 AI 反馈
│   ├── settings/          配置卡片组件
│   ├── layout/            导航栏 + 主题切换
│   ├── home/              首页特有组件 (hero-wave, feature-cards 等)
│   ├── feedback/          反馈展示组件
│   └── ui/                shadcn/ui 基础组件
├── hooks/                 自定义 React Hooks
├── lib/                   工具函数 + 数据文件
├── types/                 TypeScript 类型定义
public/
├── audio/
│   ├── ipa/               IPA chart 音频 (phoneme/normal/slow 三个子目录)
│   └── words/             ElevenLabs 预生成单词音频 (blue/pink 两个子目录)
├── images/
│   ├── ipa/               Fluent Emoji 3D PNG (音标列表卡片)
│   └── words/             (已弃用)
scripts/                   构建脚本 (generate-word-audio, download-ipa-assets 等)
docs/                      项目文档 (PRD, API 参考, 数据库设计等)
```

### 4.2 App Router 页面

| 路径 | 功能 | 布局特点 |
|------|------|---------|
| `/` | 首页 | Hero 波浪背景 + 功能卡片 + 统计栏 |
| `/phonemes` | 音标列表 | 元音/辅音 Tabs，3 列网格卡片 |
| `/phonemes/[phoneme]` | 音标详情（练习） | 双栏：左操作 + 右分析，max-w-[1600px] |
| `/sentences` | 自由练习 | 双栏：左操作 + 右分析，max-w-[1600px] |
| `/settings` | 设置 | 用量监控 + 四张配置卡片，max-w-5xl |

### 4.3 组件分层

```
components/
├── audio/
│   ├── record-button.tsx        录音按钮 (Motion 脉冲动画 + Teal 渐变)
│   ├── recording-actions.tsx    录音操作区 (回放/清除/评分 三按钮)
│   ├── waveform-display.tsx     波形显示 (wavesurfer.js)
│   ├── audio-player.tsx         通用音频播放按钮 (Howler.js)
│   └── read-along-text.tsx      卡拉 OK 逐词高亮 (句子页)
├── phoneme/
│   ├── phoneme-card.tsx         音标卡片 (列表页)
│   ├── phoneme-grid.tsx         音标网格 (共享单个 useAudioPlayer)
│   ├── phoneme-play-button.tsx  IPA 播放按钮
│   ├── word-card.tsx            单词卡片 (详情页，含发音 + 高亮动画)
│   └── video-player.tsx         视频播放器
├── scoring/
│   ├── score-display.tsx        评分数字展示
│   ├── score-breakdown.tsx      分数细项拆解
│   ├── score-summary.tsx        评分摘要 (grid-cols-[100px_1fr])
│   ├── score-trend.tsx          迷你趋势图 (SVG sparkline)
│   ├── word-highlight.tsx       逐词高亮
│   ├── phoneme-highlight.tsx    音素高亮 (含 Tooltip)
│   └── llm-feedback.tsx         AI 教练反馈 (Markdown 渲染)
├── settings/
│   ├── azure-config-card.tsx    Azure 配置卡片
│   ├── elevenlabs-config-card.tsx  ElevenLabs 配置卡片
│   ├── llm-config-card.tsx      LLM 配置卡片
│   ├── pronunciation-config-card.tsx  发音音源卡片
│   ├── mw-config-card.tsx       韦氏词典 API Key 输入
│   └── usage-monitor.tsx        用量监控面板
├── layout/
│   ├── navbar.tsx               顶部导航栏
│   ├── theme-provider.tsx       自定义 ThemeProvider (非 next-themes)
│   └── theme-toggle.tsx         明暗主题切换按钮
└── ui/                          shadcn/ui 组件 (button, card, input, slider 等)
```

### 4.4 Hooks

| Hook | 文件 | 功能 |
|------|------|------|
| `useRecorder` | `use-recorder.ts` | MediaRecorder 封装，30 秒限时，输出 PCM 16kHz 16bit mono WAV |
| `useAzureAssessment` | `use-azure-assessment.ts` | 调用 `/api/azure/assess`，返回评分结果 |
| `useAudioPlayer` | `use-audio-player.ts` | Howler.js 封装，支持播放/暂停/状态管理 |
| `useTts` | `use-tts.ts` | ElevenLabs 基础 TTS 调用 |
| `useTtsAligned` | `use-tts-aligned.ts` | TTS + 时间戳对齐 + IndexedDB 缓存 + 速度调节 |
| `useLlmFeedback` | `use-llm-feedback.ts` | SSE 流式 LLM 反馈 |
| `useMwPronunciation` | `use-mw-pronunciation.ts` | 韦氏词典发音 API 调用 |
| `useSessionState` | `use-session-state.ts` | sessionStorage 持久化，替代 useState，标签页关闭自动清除 |
| `useSyllableStress` | `use-syllable-stress.ts` | 音节重音标注：静态词库 → localStorage → MW API 三层查找 |
| `useWordIpa` | `use-word-ipa.ts` | 单词 IPA 获取：静态 800+ 词 → localStorage → MW API（debounce 300ms） |

### 4.5 Lib 工具库

| 文件 | 职责 |
|------|------|
| `phoneme-data.ts` | 40 个音标的完整数据（16 元音 + 24 辅音），每个含 8 个关键词 |
| `word-bank.ts` | 扩展词库，每音标 12 个额外词（含 IPA） |
| `word-pool.ts` | 合并 `phoneme-data` + `word-bank`，去重 |
| `word-selector.ts` | 加权随机选词算法（未练习 3x / 已练习 1x 权重） |
| `practice-tracker.ts` | 练习记录追踪（localStorage，反馈给选词权重） |
| `api-keys.ts` | localStorage CRUD（Azure / ElevenLabs / LLM / 韦氏 / 发音配置） |
| `azure-speech.ts` | Azure SDK 响应解析器 |
| `llm-providers.ts` | 9 个预设 LLM 厂商及其 base URL / 模型列表 |
| `llm-prompt.ts` | LLM 反馈 prompt 模板构建（严格教练风格，中文输出） |
| `score-utils.ts` | 评分计算辅助函数 |
| `score-history.ts` | 评分历史（localStorage，最近 5 次趋势） |
| `tts-cache.ts` | IndexedDB TTS 音频缓存（最多 50 条 LRU） |
| `usage-tracker.ts` | 用量统计（ElevenLabs / Azure / LLM） |
| `utils.ts` | 通用工具函数：`cn()` (Tailwind class 合并)、`isSentence()` |
| `rate-limit.ts` | IP 级速率限制器（60 次/分钟，Edge 兼容，内存 Map） |
| `azure-phoneme-map.ts` | Azure SAPI 编码 ↔ IPA 映射（40 音素）+ chartWord 音频路径 |
| `syllable-stress.ts` | IPA/MW 发音字符串重音解析 + 静态词库 stress map |
| `static-ipa-map.ts` | 全量 word → IPA 静态映射（~800+ 词，含单音节词） |

### 4.6 类型定义

```typescript
// src/types/phoneme.ts
type PhonemeCategory = "vowel" | "consonant";
type Difficulty = "high" | "medium" | "easy";

interface KeywordEntry {
  word: string;
  ipa: string;
  emoji?: string;
}

interface PhonemeData {
  ipa: string;           // 显示用 IPA，如 "/iː/"
  symbol: string;        // 纯符号，如 "iː"
  slug: string;          // URL slug，如 "ee"
  name: string;          // 语音学名称
  category: PhonemeCategory;
  example: string;       // 典型例词
  keywords: KeywordEntry[];  // 8 个关键词
  difficulty: Difficulty;
  chartWord?: string;    // IPA chart 关联词
  chartImage?: string;   // Fluent Emoji 图片名
  chartIpa?: string;     // IPA chart 原始标注
  chartIpaHighlight?: string;  // 需要高亮的 IPA 部分
  description?: string;  // 中文发音指导
}

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

> **注意**：`AzureSyllable` 现在包含可选的 `stress?: StressLevel` 字段，其中 `StressLevel = "primary" | "secondary" | "none"`。

---

## 5. 核心架构模式

### 5.1 API 代理模式

**核心原则：客户端永远不直接调用外部 API。** 所有外部服务请求通过 Next.js API Routes (`/api/*`) 代理，API Key 通过自定义 HTTP headers 传递，绝不放在 JSON body 中。

```
客户端 → /api/azure/assess (headers: x-azure-key, x-azure-region)
客户端 → /api/elevenlabs/tts (headers: x-elevenlabs-key, x-elevenlabs-voice)
客户端 → /api/llm/feedback (headers: x-llm-key, x-llm-provider, x-llm-base-url, x-llm-model)
客户端 → /api/pronunciation (headers: 根据音源不同而异)
```

API Routes 的安全措施：
- ElevenLabs voice ID 白名单校验（仅允许 7 个预设 ID）
- 文本长度限制（Azure: 500 字符，ElevenLabs: 500 字符）
- Azure Speech SDK 必须使用 Node.js runtime（`export const runtime = "nodejs"`）

### 5.2 双音频系统

项目中有两套独立的音频系统：

**系统 1 — IPA Chart 音频（音标列表页卡片播放）**

```
public/audio/ipa/
├── phoneme/    # 音素发音 (39 个 + 1 个 extra)
├── normal/     # 正常语速单词
└── slow/       # 慢速单词
```

- 来源：americanipachart.com（已下载到本地）
- 每个词 3 种音频：phoneme（音素）、normal（正常）、slow（慢速）
- 39 个 IPA chart 单词 + 1 个额外词（cup for /ʌ/）
- 交互：点击 IPA 符号播放音素音频，点击插图交替播放 normal/slow

**系统 2 — ElevenLabs 预生成音频（音标详情页示例单词）**

```
public/audio/words/
├── blue/       # Max 语音 (voice ID: Gfpl8Yo74Is0W6cPUWWT)
└── pink/       # Nichalia 语音 (voice ID: XfNU2rGpBa01ckF309OY)
```

- 268 个唯一单词 x 2 种语音 = 536 个音频文件
- voice_settings (word mode): stability 0.85, similarity 0.85, style 0, speed 0.9
- 作为发音音源的 fallback 方案

### 5.3 存储策略（Phase 1 = localStorage）

当前阶段（Phase 1）全部使用浏览器本地存储，Phase 2 计划接入 Supabase。

| localStorage Key | 内容 | 类型 |
|------------------|------|------|
| `speakright_azure_config` | Azure 凭证 (subscriptionKey + region) | `AzureConfig` |
| `speakright_elevenlabs_config` | ElevenLabs 凭证 | `ElevenLabsConfig` |
| `speakright_llm_config` | LLM 厂商配置 | `LLMConfig` |
| `speakright_mw_config` | 韦氏词典 API Key | `MerriamWebsterConfig` |
| `speakright_pronunciation_config` | 发音音源选择 | `PronunciationConfig` |
| `speakright_usage` | 用量追踪（月度重置） | 自定义结构 |
| `speakright_score_history` | 每个词最近 5 次评分 | 自定义结构 |
| `speakright_practice_history` | 每个音标已练习的词 | 自定义结构 |
| `theme` | 主题偏好 | `"light"` \| `"dark"` |

| IndexedDB | 内容 |
|-----------|------|
| `speakright_tts_cache` | TTS 音频缓存，最多 50 条，LRU 淘汰。Key = `text:voiceId:speed` |

所有 localStorage 操作封装在 `src/lib/api-keys.ts`，提供 `get/set` + `subscribeToStorage`（用于 `useSyncExternalStore`）。

### 5.4 自定义 ThemeProvider

本项目使用**自定义 ThemeProvider**，而非 `next-themes`（避免 React 19 script 警告）。

```typescript
// 导入路径
import { ThemeProvider, useTheme } from "@/components/layout/theme-provider";
```

防止 FOUC（Flash of Unstyled Content）：`layout.tsx` 的 `<head>` 中注入了一段内联脚本，在页面渲染前根据 `localStorage.getItem("theme")` 或系统偏好立即设置 `<html>` 的 class。

### 5.5 LLM 流式反馈（SSE）

AI 教练反馈采用 Server-Sent Events (SSE) 流式传输：

1. 客户端通过 `useLlmFeedback` hook 调用 `/api/llm/feedback`
2. 服务端使用 OpenAI SDK（OpenAI-compatible format）发起流式请求
3. `stream_options: { include_usage: true }` 追踪 token 消耗
4. 响应格式：`text/event-stream`，每个 chunk 为 `data: {"content": "..."}\n\n`
5. 客户端使用 `react-markdown` + `remark-gfm` 实时渲染 Markdown
6. LLM prompt 采用严格教练风格（不鼓励、不客套），详见 `src/lib/llm-prompt.ts`

支持的 LLM 厂商（9 个预设 + 自定义）：

| 厂商 | Base URL |
|------|----------|
| Claude | `https://api.anthropic.com/v1` |
| GPT | `https://api.openai.com/v1` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` |
| DeepSeek | `https://api.deepseek.com/v1` |
| Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| GLM | `https://open.bigmodel.cn/api/paas/v4` |
| Kimi | `https://api.moonshot.cn/v1` |
| Doubao | `https://ark.cn-beijing.volces.com/api/v3` |
| Custom | 用户自定义 |

### 5.6 音节重音系统

重音数据来源（按优先级）：
1. 静态词库 IPA — `phoneme-data.ts` + `word-bank.ts` 中约 800+ 词已标注 ˈ/ˌ
2. localStorage 缓存 — `speakright_stress_cache` 键值对
3. 韦氏词典 API — `/api/merriam-webster/stress` 返回 MW 发音标注

单音节词（`syllables.length ≤ 1`）自动隐藏音节区域。

### 5.7 页面状态保持

`useSessionState<T>(key, initialValue)` 替代 `useState`，自动同步到 sessionStorage。
Hook 内部状态（azure.result, llm.feedback）通过 `restore()` 方法 + mount 时恢复。
sessionStorage 在关闭标签页时自动清除。

---

## 6. 外部 API 集成

### 6.1 Azure Speech（发音评估）

- **用途**：发音评分（accuracy / fluency / completeness / prosody）+ 音素级 + 音节级分析
- **API Route**：`/api/azure/assess` (POST, `runtime = "nodejs"`)
- **客户端 Hook**：`useAzureAssessment`
- **输入**：PCM 16kHz 16bit mono WAV 音频 + 参考文本
- **Headers**：`x-azure-key`, `x-azure-region`
- **韵律评估**：仅在句子模式下启用（`isSentence(text)` 返回 true 时）
- **限制**：参考文本最长 500 字符

### 6.2 ElevenLabs（TTS 语音合成）

- **用途**：自由练习页实时 TTS + 逐词高亮时间戳
- **API Routes**：
  - `/api/elevenlabs/tts` — 基础 TTS
  - `/api/elevenlabs/tts-aligned` — 带时间戳的 TTS（用于卡拉 OK 高亮）
  - `/api/elevenlabs/usage` — 用量查询
  - `/api/elevenlabs/voices` — 可用语音列表
  - `/api/elevenlabs/test` — 连通测试
- **Headers**：`x-elevenlabs-key`, `x-elevenlabs-voice`, `x-elevenlabs-model`
- **Voice ID 白名单**（仅允许以下 7 个）：

| 名称 | Voice ID |
|------|----------|
| Eryn | `RaFzMbMIfqBcIurH6XF9` |
| Daphne | `cR39HTrtXbjvEP4CNYFx` |
| Nichalia | `XfNU2rGpBa01ckF309OY` |
| Liz | `wvk9Caj0nEx4l3I9LaR6` |
| Brian | `G0yjIg3xY8gEJZkHpjVm` |
| Micheal Scott | `ashjVK50jp28G73AUTnb` |
| Max | `Gfpl8Yo74Is0W6cPUWWT` |

- **voice_settings (句子模式)**：stability 0.65, similarity 0.85, style 0.35, speed 0.85
- **速度调节**：0.7x ~ 1.2x，步进 0.1
- **缓存**：IndexedDB `speakright_tts_cache`，key = `text:voiceId:speed`，最多 50 条 LRU

### 6.3 LLM 多厂商（AI 反馈）

- **用途**：根据 Azure 评分生成中文教练反馈
- **API Route**：`/api/llm/feedback` (POST, SSE 流式响应)
- **客户端 Hook**：`useLlmFeedback`
- **Headers**：`x-llm-key`, `x-llm-provider`, `x-llm-base-url`, `x-llm-model`
- **协议**：OpenAI-compatible chat completions API
- **特殊处理**：Claude 厂商需要额外的 `x-api-key` 和 `anthropic-version` headers

### 6.4 发音音源（有道 / 韦氏词典）

- **用途**：音标详情页单词发音
- **统一路由**：`/api/pronunciation`
- **音源选择**：设置页切换，存储在 `speakright_pronunciation_config`
  - **有道词典**（默认）：国内访问快，无需 API Key
  - **韦氏词典**：海外访问快，需要 API Key
- **Fallback**：两者都失败时，使用本地预生成音频 `/audio/words/blue/{word}.mp3`
- **客户端 Hook**：`useMwPronunciation`

---

## 7. 音标数据管理

### 7.1 数据结构

项目包含 40 个音标（16 元音 + 24 辅音），数据分布在三个文件中：

| 文件 | 内容 | 每音标数据量 |
|------|------|------------|
| `src/lib/phoneme-data.ts` | 核心音标数据 + 8 个关键词 | 完整 `PhonemeData` |
| `src/lib/word-bank.ts` | 扩展词库 | 12 个额外词（含 IPA） |
| `src/lib/word-pool.ts` | 合并去重后的完整词池 | ~20 个词 |

IPA 标注约定：
- keyword IPA 对齐欧陆词典美式音标（`/e/` 而非 `/ɛ/`，`/ɜːr/` 而非 `/ɝː/`，省略音节尾 schwa）
- chartIpa 保留 americanipachart.com 原始标注（简化记法，无长音标记）

### 7.2 添加新音标或单词

**添加关键词**（修改 `src/lib/phoneme-data.ts`）：

```typescript
// 在对应音标的 keywords 数组中添加
{
  word: "beach",
  ipa: "/biːtʃ/",
  emoji: "🏖️",  // 可选
}
```

**添加扩展词**（修改 `src/lib/word-bank.ts`）：

```typescript
// 在对应音标的扩展词数组中添加
{ word: "dream", ipa: "/driːm/" }
```

`word-pool.ts` 会自动合并两个来源并去重。

**添加新音标**（修改 `src/lib/phoneme-data.ts`）：

在 `PHONEMES` 数组中添加一个完整的 `PhonemeData` 对象，必须包含：`ipa`, `symbol`, `slug`（URL 路径用），`name`, `category`, `example`, `keywords`（8 个），`difficulty`。

### 7.3 选词算法

`src/lib/word-selector.ts` 中的 `selectNextWord()` 实现加权随机选词：

- **未练习过的词**：权重 3x（优先推荐新词）
- **已练习过的词**：权重 1x
- **当前正在练习的词**：排除
- 练习记录通过 `practice-tracker.ts` 追踪，存储在 `speakright_practice_history`

导航模型：
- 右箭头 → 随机选新词
- 左箭头 → 历史回退（`wordHistory` 栈）
- 进度显示：`已练 X/Y`（X = 已练词数，Y = 总词数）

---

## 8. UI 与样式约定

### 8.1 品牌色与主题

品牌主色为 **Teal**，通过 CSS 变量 `--primary` 全局生效：

| 模式 | 色值 |
|------|------|
| Light | `oklch(0.55 0.15 175)` |
| Dark | `oklch(0.70 0.12 175)` |

评分色规则（ScoreSummary 总分区块背景）：
- >= 80 分：品牌 Teal（`bg-primary`）
- 60~79 分：黄色
- < 60 分：红色

PhonemeHighlight 评分色统一使用品牌 Teal（`bg-primary/text-primary`），不用绿色。

### 8.2 字体系统

```
--font-heading: Manrope    # 标题字体
--font-sans: Inter         # 正文字体
--font-geist-mono: Geist Mono  # IPA 符号 + 代码
```

在 `layout.tsx` 中通过 `next/font/google` 加载，设为 CSS 变量后在 Tailwind 中使用。

### 8.3 shadcn/ui 组件

```bash
# 添加新的 shadcn 组件
npx shadcn@latest add <component-name>
```

组件安装到 `src/components/ui/`。注意：
- Slider 是**自定义实现**（非 @base-ui 原生），避免 React 19 script 警告
- shadcn/ui v4 基于 Base UI primitives（`@base-ui/react ^1.3.0`）

### 8.4 Motion v12 动画

```typescript
// 正确的 import 路径
import { motion } from "motion/react";
```

约定：
- 所有使用 `motion` 的组件**必须**有 `"use client"` 指令
- 全站按钮统一：`whileTap: { scale: 0.95 }` (spring 弹性动画)
- `AudioPlayerButton`：`motion.div` wrapper，含 `whileHover` + `whileTap`
- 录音按钮：脉冲动画 + Teal 渐变背景 + `shadow-lg shadow-primary/25`
- `PhonemeHighlight` 中的 `PhonemeBlock`：`whileHover: { scale: 1.05 }`, `whileTap: { scale: 0.95 }`
- `WordCard` 播放时：单词文字 `scale(1.08)` + primary 背景色高亮
- 全局 CSS 规则：所有 `button`, `a`, `[role="button"]` 元素自动 `cursor-pointer`

### 8.5 双栏布局模式

音标详情页 (`/phonemes/[phoneme]`) 和自由练习页 (`/sentences`) 共享统一的双栏布局：

**桌面端**（lg 及以上）：
```
lg:grid-cols-[1fr_2fr]  — 左窄右宽
lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden  — 视窗约束，无页面级滚动
左右栏各自 lg:overflow-y-auto scrollbar-thin  — 独立滚动
```

**移动端**（lg 以下）：
- 单栏，正常文档流滚动

**左栏内容**（从上到下）：
1. 页面特有内容（音标页: IPA 卡片 + Video + WordCard / 句子页: Textarea + TTS 按钮 + 速度滑块 + 卡拉 OK + 重播）
2. 录音区（RecordButton）
3. RecordingActions（3 个圆形按钮：回放 / 清除 / 评分，始终显示）
4. ScoreSummary + ScoreTrend

**右栏内容**（flex 布局）：
1. `shrink-0` 分析区（音素拆解 / 逐词高亮）
2. `flex-1` AI 反馈（动态填充剩余高度，内部滚动）

未评分时显示结构化空框架占位。

---

## 9. 代码规范与工具链

### 9.1 Biome（Lint + Format）

本项目使用 [Biome](https://biomejs.dev/) v2.4.8 替代 ESLint + Prettier。

核心配置（`biome.json`）：
- **VCS**：Git 集成，使用 `.gitignore` 排除文件
- **Formatter**：空格缩进（非 Tab），JavaScript 使用双引号
- **Linter**：启用 recommended 规则集
- **Assist**：自动组织 imports

```bash
# 检查（只报告，不修改）
npm run lint

# 自动修复
npm run lint:fix

# 等价命令
npx biome check .          # 检查
npx biome check --fix .    # 修复
```

### 9.2 TypeScript 配置

核心 `tsconfig.json` 设置：

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

关键点：
- **strict mode** 开启 — 所有类型检查最严格
- **路径别名** `@/*` 映射到 `./src/*` — import 时使用 `@/components/...` 而非相对路径
- **bundler resolution** — 适配 Next.js / Turbopack 的模块解析方式

### 9.3 React Compiler

本项目启用了 React Compiler（自动优化 re-render）：

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  reactCompiler: true,
};
```

需要 `babel-plugin-react-compiler` 作为 devDependency（已安装）。

---

## 10. 常见问题与排错

### Azure Speech SDK 必须使用 Node.js Runtime

Azure Speech SDK 不兼容 Edge Runtime。相关 API Route 必须声明：

```typescript
export const runtime = "nodejs";
```

否则构建时会报错。

### React 19 与 next-themes 不兼容

React 19 + `next-themes` 会产生 `<script>` 相关的 hydration 警告。解决方案：使用项目自定义的 `ThemeProvider`（`@/components/layout/theme-provider`），而非安装 `next-themes`。

### Turbopack 配置变更后需要重启

修改 `next.config.ts`、`tsconfig.json`、`biome.json` 等配置文件后，Turbopack dev server 可能不会自动生效，需要手动重启：

```bash
# Ctrl+C 停止后重新启动
npm run dev
```

### Motion v12 组件缺少 "use client"

所有使用 `motion` 的组件文件顶部必须添加 `"use client"` 指令，否则会触发服务端组件序列化错误。

### ElevenLabs Voice ID 不在白名单中

`/api/elevenlabs/tts` 路由对 voice ID 做白名单校验。如需添加新的 voice，需修改路由文件中的 `ALLOWED_VOICE_IDS` 集合。

### 录音超时

录音限时 30 秒。超时后自动停止并触发评分。最后 5 秒进度条变红提示用户。

### babel-plugin-react-compiler 缺失

React Compiler 需要 `babel-plugin-react-compiler` 包。确认 `devDependencies` 中已包含该包：

```bash
npm install --save-dev babel-plugin-react-compiler
```

---

## 11. 构建脚本

位于 `scripts/` 目录下的辅助脚本：

### 批量生成单词音频

```bash
npm run generate:audio
# 等同于: node scripts/generate-word-audio.mjs
```

使用 ElevenLabs API 为词库中的单词批量生成 TTS 音频（需要 ElevenLabs API Key）。生成的音频存放到 `public/audio/words/` 下。

### 下载 Fluent Emoji

```bash
node scripts/download-word-emoji.mjs
```

从 Microsoft Fluent Emoji 仓库下载 3D PNG 图片，用于音标列表页的卡片展示。图片存放到 `public/images/ipa/`。

### 下载 IPA Chart 音频

```bash
node scripts/download-ipa-assets.mjs
```

从 americanipachart.com 下载 IPA 音频素材到 `public/audio/ipa/`。

---

> 本文档最后更新：2026-03-28
