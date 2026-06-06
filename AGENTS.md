# SpeakRight — 英语发音学习 App

面向中国市场的美式英语发音矫正 Web App。用户听标准示范、跟读、获得 AI 评分与中文反馈。

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack, `"use cache"`)
- **React**: 19 with React Compiler enabled (`reactCompiler: true`)
- **UI**: shadcn/ui CLI v4 (Maia style, Base UI primitives) + Tailwind CSS v4
- **Typography**: Manrope (headlines, via `--font-heading`) + Inter (body, via `--font-sans`) + Geist Mono (IPA/code)
- **Animation**: Motion v12 (`import { motion } from "motion/react"`) + View Transitions
- **Markdown**: react-markdown + remark-gfm (LLM feedback rendering) + @tailwindcss/typography (prose styles, headings with primary left border)
- **Audio**: MediaRecorder API (recording), wavesurfer.js v7 (waveform), howler.js (playback)
- **Theme**: Custom ThemeProvider (替换 next-themes，避免 React 19 script 警告) + anti-FOUC `<head>` script
- **Backend**: Next.js API Routes as proxy (Azure 用 Node.js runtime，其余可 Edge)
- **Storage**: Phase 1 全部使用 localStorage（API Keys + 用量数据），Phase 2 计划接入 Supabase
- **Lint/Format**: Biome (replaces ESLint + Prettier)
- **Language**: TypeScript strict mode, Chinese UI, English content only

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # Biome check
npx biome check --fix .  # Auto-fix lint + format
npx shadcn@latest add <component>  # Add shadcn component
npx vitest run           # Run unit tests (score-utils, word-selector, utils, tts-cache)
npm run generate:audio   # Batch generate ElevenLabs word audio (needs API key)
node scripts/download-word-emoji.mjs  # Download Fluent Emoji 3D PNGs for keyword words
```

## Architecture

Four external APIs, all proxied through `/api/*` routes (keys never exposed to client):

1. **Azure Speech** → Pronunciation assessment (scoring + phoneme + syllable + prosody analysis，韵律仅句子模式启用)
2. **ElevenLabs** → American English TTS demos (自由练习页实时调用 + with-timestamps 逐词高亮 + IndexedDB 缓存 + 速度调节 0.7x-1.2x)
3. **LLM (multi-provider)** → Chinese text feedback from Azure scores
4. **单词发音** → 统一 `/api/pronunciation` 代理路由，支持有道词典（默认，国内快）和韦氏词典（需 API Key，海外快），设置页切换音源，fallback 到本地预生成音频
5. **韦氏词典** → `/api/merriam-webster/` 下 `pronunciation/`、`stress/`、`test/` 三个子路由

所有 API 路由使用 `src/lib/rate-limit.ts` 内存速率限制（60 次/分钟/IP）。

LLM uses OpenAI-compatible format. Users configure their own API keys in settings page.
Supported providers: Codex, GPT, Gemini, DeepSeek, Qwen, GLM, Kimi (原 Moonshot), Doubao, Custom.
LLM 设置页 Model 字段为自由输入框 + 预设 chips 快速选择。

### Audio architecture (two systems)

**1. IPA Chart audio (音标列表页卡片)**
- Source: americanipachart.com（已下载到本地）
- 3 types per word: `public/audio/ipa/{phoneme,normal,slow}/{word}.mp3`
- 39 words from IPA chart + 1 extra (cup for /ʌ/)
- Click IPA symbol → play phoneme audio; Click illustration → alternate normal/slow

**2. ElevenLabs pre-generated audio (音标详情页示例单词)**
- 2 voices: Max (blue, `Gfpl8Yo74Is0W6cPUWWT`) + Nichalia (pink, `XfNU2rGpBa01ckF309OY`)
- Path: `public/audio/words/{blue,pink}/{word}.mp3`
- 268 unique words × 2 voices = 536 files
- voice_settings (word mode): stability 0.85, similarity 0.85, style 0, speed 0.9
- voice_settings (sentence mode / API route): stability 0.65, similarity 0.85, style 0.35, speed 0.85

### ElevenLabs voices (fixed list in settings)

| Name | ID |
|------|-----|
| Eryn | RaFzMbMIfqBcIurH6XF9 |
| Daphne | cR39HTrtXbjvEP4CNYFx |
| Nichalia | XfNU2rGpBa01ckF309OY |
| Liz | wvk9Caj0nEx4l3I9LaR6 |
| Brian | G0yjIg3xY8gEJZkHpjVm |
| Micheal Scott | ashjVK50jp28G73AUTnb |
| Max | Gfpl8Yo74Is0W6cPUWWT |

## Project structure

```
src/app/              — Pages (App Router)
  phonemes/           — Phoneme list + [phoneme] detail pages (双栏布局)
  drill/              — 刻意练习模块（/drill 入口 + /drill/word 单词训练 + /drill/sentence 句子训练 + /drill/contrast 对比训练 + /drill/perception 辨音训练）
  assessment/         — 发音诊断测试（10 词 + 1 段短文 → 音标健康图 + 五维雷达图 + 薄弱音标推荐）
  sentences/          — 自由练习页 (双栏布局, 150 字符限制 + 录音倒计时, 支持单词/句子模式自动检测)
  settings/           — API key configuration (Azure, ElevenLabs, 发音音源, LLM)
  api/                — API route proxies (azure/, elevenlabs/{tts,tts-aligned,usage,test,voices}/, llm/, merriam-webster/{pronunciation,stress,test}/, pronunciation/)
src/components/       — React components
  audio/              — record-button, recording-actions, waveform-display, audio-player, read-along-text
  assessment/         — assessment-report, phoneme-health-map（诊断结果可视化）
  drill/              — drill-config, drill-teaching, drill-recording, drill-feedback, drill-summary, drill-progress, drill-phoneme-lesson（刻意练习 UI 组件）
  phoneme/            — phoneme-card, phoneme-grid, phoneme-play-button, phoneme-study-card, word-card, video-player
  scoring/            — score-display, score-breakdown, score-summary, score-trend, word-highlight, phoneme-highlight, llm-feedback
  sentences/          — sentence-input-card, sentence-recording-card, sentence-results-column（自由练习拆分组件）
  settings/           — azure/elevenlabs/llm/pronunciation/coach-mode config cards, connection-status, usage-monitor
  common/             — error-boundary（React Error Boundary）
  layout/             — sidebar, sidebar-phoneme-list, titlebar, theme-provider (custom, exports useTheme), theme-toggle
  ui/                 — shadcn/ui components
src/lib/              — SDK wrappers + data (phoneme-data.ts, word-bank.ts, llm-providers.ts, usage-tracker.ts, score-utils.ts, score-history.ts, tts-cache.ts, word-pool.ts, word-selector.ts, practice-tracker.ts, rate-limit.ts, azure-phoneme-map.ts, syllable-stress.ts, static-ipa-map.ts, drill-utils.ts, sentence-bank.ts, minimal-pairs.ts, perception-pairs.ts, l1-error-patterns.ts, connected-speech.ts, assessment-texts.ts, etc.)
src/hooks/            — Custom hooks (useRecorder, useAzureAssessment, useAudioPlayer, useTts, useTtsAligned, useLlmFeedback, useMwPronunciation, useSessionState, useSyllableStress, useWordIpa, useDrillSession)
src/types/            — TypeScript interfaces (phoneme.ts, azure.ts, api-keys.ts, llm.ts, drill.ts, assessment.ts)
src/__tests__/        — Unit tests (vitest: score-utils, word-selector, utils, tts-cache)
public/audio/ipa/     — IPA chart audio (phoneme/normal/slow subdirs, from americanipachart.com)
public/audio/words/   — ElevenLabs pre-generated word audio (blue/pink subdirs)
public/images/ipa/    — Microsoft Fluent Emoji 3D PNGs for phoneme list cards (40 张)
public/videos/phonemes/ — Rachel's English 教学视频（40 个 mp4，.gitignore 排除，约 230MB）
scripts/              — Build scripts (generate-word-audio, download-ipa-assets, download-word-emoji)
docs/                 — PRD.md, api-reference.md
```

## Key conventions

- All API calls go through server-side `/api/*` routes, never direct from client
- Motion v12 components must use `"use client"` directive
- AudioPlayerButton uses motion.div wrapper with spring animation (whileHover + whileTap), supports sizes: sm(h-5)/default(h-4)/icon(h-4)/lg(h-6), 所有按钮加 cursor-pointer
- `PhonemeGrid` 共享单个 `useAudioPlayer` 实例传给所有 PhonemeCard（避免 N 个 Howl 实例）
- 品牌色为 Teal（Light: oklch(0.55 0.15 175)，Dark: oklch(0.70 0.12 175)），通过 CSS 变量 `--primary` 全局生效
- LLM API 凭证通过 HTTP headers 传输（x-llm-key/x-llm-provider/x-llm-base-url/x-llm-model），不放在 JSON body 中
- ElevenLabs TTS 路由有 voice ID 允许列表校验 + 文本长度限制（500 字符）
- Azure best input: PCM 16kHz 16bit mono WAV
- LLM feedback uses streaming (SSE) with `stream_options: { include_usage: true }` for token tracking, rendered as Markdown (react-markdown + remark-gfm + prose styles)
- LLM prompt 支持 4 档教练模式（简单/正常/略难/严师），通过 `CoachMode` 类型 + `COACH_PERSONAS` 映射表切换人设，详见 `src/lib/llm-prompt.ts`
- LLM 反馈输出 5 层结构：summary → top_issues → priority_fixes（优先改/重灾区，5 板块分析）→ dimensions → details
- 5 个发音分析板块：音素准确度 / 音节与重音 / 连读与吞音 / 语调与韵律 / 流利度
- 教练模式存储在 `speakright_coach_mode`（localStorage），类型 `CoachMode`，默认 "normal"
- 自由练习页 TTS 使用 `useTtsAligned` hook（IndexedDB 缓存 + 速度调节 + replay）+ `ReadAlongText` 组件（text-2xl 卡拉 OK 逐词高亮）
- 音标详情页：音标+单词合并为一张卡片（IPA+PlayButton+emoji 上排，单词导航下排），WordCard 不再独立使用
- 音频互斥播放：录音回放、示范发音（mw）、IPA 音频（chartAudio）三者同时只能播一个
- 自由练习页逐词评分点击单词可播放该词发音（调用 `mw.playWord`）
- 用量监控：ElevenLabs（API 查询，TTS 调用后自动刷新）、Azure（localStorage 按次追踪秒数）、LLM（localStorage 追踪 token 消耗）
- 全局 cursor-pointer CSS 规则覆盖所有 button/a/[role="button"] 元素
- 全站 motion 按钮统一 `whileTap: { scale: 0.95 }` Q 弹动画
- Slider 组件为自定义实现（非 @base-ui，避免 React 19 script 警告）
- ThemeProvider 是自定义实现（非 next-themes），导入路径 `@/components/layout/theme-provider`，导出 `useTheme`
- layout.tsx `<head>` 中有 anti-FOUC 脚本防止主题闪烁
- Phoneme data in `src/lib/phoneme-data.ts` includes: IPA chart word mapping (`chartWord`, `chartImage`, `chartIpa`, `chartIpaHighlight`), 8 example keywords per phoneme with IPA and optional `emoji` field, `description` field (中文发音指导), `difficulty` field (easy/medium/high)。扩展词库在 `src/lib/word-bank.ts`（每音标 12 个额外词，含 IPA）
- 40 phonemes total: 16 vowels (including diphthongs) + 24 consonants
- Keyword IPA 标注统一对齐欧陆词典美式音标（/e/ 而非 /ɛ/，/ɜːr/ 而非 /ɝː/，省略音节尾 schwa）
- chartIpa 保留 americanipachart.com 原始标注（简化记法，无长音标记）
- 录音限时 30 秒，超时自动停止并触发评分（音标页无倒计时条，句子页有倒计时条）
- 波形图高度 40px（`waveform-display.tsx`），录音和回放互斥渲染（clearContainer 防叠加）
- 自由练习页文本输入限制 150 字符，实时计数 + 接近上限警告色
- Azure 音素编码使用 `azure-phoneme-map.ts` 转换为 IPA 显示（`toIpa()`, `syllableToIpa()`），音素方块点击可播放 IPA Chart 本地音频。该模块还提供 `getPhonemeAccuracy(result, slug)` 用于从 Azure 评分结果中抽取特定音素的平均 accuracyScore（对比训练达标判定的核心信号）
- Phoneme slug 统一命名：40 个音素统一使用简写 slug（如 /θ/ 用 `"th"`、/ʃ/ 用 `"sh"`、/ʌ/ 用 `"uh2"`），全项目对齐 `phoneme-data.ts` 的 slug 字段
- 音节重音标注：`useSyllableStress` hook 三层查找（静态词库 → localStorage → MW API），单音节词隐藏音节区域
- 页面状态保持：`useSessionState` hook 将关键状态存入 sessionStorage，页面间切换不丢失评分和反馈数据
- 所有 API 路由统一速率限制 60 次/分钟/IP（`src/lib/rate-limit.ts`，Edge + Node.js 兼容）

### 练习页双栏布局（/phonemes/[phoneme] 和 /sentences）

- 桌面端：左右双栏 `lg:grid-cols-[1fr_2fr]`（左操作窄、右分析宽）
- 两栏各自 `lg:overflow-y-auto scrollbar-thin`，无页面级滚动条
- 移动端：单栏，正常滚动
- 两页保持统一的"两卡片"设计语言（学习区 + 练习区）
- **左栏 — 学习区卡片**（rounded-xl border bg-card shadow-sm）：
  - 音标页：Rachel 教学视频（顶部）→ IPA+单词导航（合并卡片）
  - 句子页：Textarea+TTS 按钮 → 速度滑块 → 卡拉 OK 文字
- **左栏 — 练习区卡片**（rounded-xl border bg-card shadow-sm）：
  - 录音按钮 → 波形图(40px) → RecordingActions → ScoreSummary（评分后出现，border-t 分隔）
- **右栏**：音标拆解卡片（rounded-xl border bg-card shadow-sm）→ AI 教练反馈（flex-1 填充）
- 未评分时显示虚线占位框
- 录音按钮有 motion 缩放动画 + Teal 渐变背景 + 阴影（shadow-lg shadow-primary/25）

### 音标列表页卡片设计

- 整张卡片是 Link，点击进入详情页
- 布局：顶部 IPA 大字(text-4xl) + 难度 Badge（简单/中等/困难）；中部分类标签 + 中文发音描述(line-clamp-2)；底部 Fluent Emoji 3D 图片 + chartWord + chartIpa + play 按钮
- 网格：`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`，gap-5
- Hover: `hover:shadow-lg hover:-translate-y-1 transition-all duration-300`
- Play 按钮点击时 `e.preventDefault()` 阻止 Link 跳转

### 评分布局

**ScoreSummary（练习区卡片内，两页统一）** `grid-cols-[100px_1fr]`：
- 左列（100px）：总分圆角方块（rounded-xl text-4xl），背景色随分数变化（≥80 品牌 Teal/60-79 黄/<60 红）
- 右列：准确度/流利度/完整度/韵律（句子页）竖排紧凑条，每条含标签(text-sm)+数字(text-base)+h-1.5 进度条
- 下方：ScoreTrend 迷你趋势图（SVG sparkline，最近 5 次评分，`src/lib/score-history.ts` localStorage 存储）

**PhonemeHighlight（右栏详细分析）**：
- PhonemeBlock 含 Tooltip + cursor-pointer + Q 弹动画（whileHover 1.05, whileTap 0.95）
- 好评音素使用品牌 Teal（bg-primary/text-primary），差评音素使用 destructive 主题色（bg-destructive/10）

**共享逻辑**：
- `isSentence(text)` 工具函数（`src/lib/utils.ts`）：多于 1 个单词返回 true
- 动画：useSpring 计数 + motion 进度条

### AI 反馈容器

- 卡片容器：`flex flex-col h-full rounded-xl border bg-card shadow-sm overflow-hidden`
- Header（shrink-0 固定不滚动，py-4）：MessageSquareText 图标 + "AI 教练反馈" + 流式 pill badge
- 内容区：`flex-1 min-h-0 overflow-y-auto scrollbar-thin`（动态填充右栏剩余高度）
- 分层展示：summary（一句话）→ top_issues（要点）→ **优先改/重灾区**（始终可见，`border-destructive/20 bg-destructive/5` 红色框）→ 详细分析（可展开）→ 完整技术分析（可展开）
- 优先改从 5 个板块中按严重程度挑 1-3 个问题，每个标注板块+具体单词+立刻改+练习方法
- Markdown 样式：ReactMarkdown 自定义组件（h2/h3 左边条，hr 分隔线），prose 增强间距
- 自定义 `.scrollbar-thin` CSS 类：4px 细滚动条，半透明，hover 变深，支持深色模式

### 设置页

- 用量监控在 API 配置卡片**上方**（优先展示），ElevenLabs 用量在 TTS 调用后自动刷新
- 五张配置卡片：Azure → ElevenLabs → **发音音源** → **AI 教练模式**（4 档：简单/正常/略难/严师）→ LLM
- 发音音源卡片：有道词典（默认）/ 韦氏词典 单选，选韦氏时展开 API Key 输入框（复用 `MerriamWebsterConfig`），「测试发音」按钮播放 "hello" 验证音源
- 音源配置存储在 `speakright_pronunciation_config`（localStorage），类型 `PronunciationConfig { source: "youdao" | "merriam-webster" }`
- LLM 卡片有 LIVE 绿色脉冲 badge + 2x2 grid 统计布局
- 页面宽度 max-w-5xl

### 示例单词与发音

- 混合词池：静态 8 个关键词（`phoneme-data.ts`）+ 扩展词库 12 个（`word-bank.ts`）= 每音标约 20 个词，合并去重（`word-pool.ts`）
- 加权随机选词：`selectNextWord()`（`word-selector.ts`），未练习 3x / 已练习 1x，排除当前词
- 练习记录通过 `practice-tracker.ts` 追踪（localStorage `speakright_practice_history`），反馈给选词权重
- 导航模型：右箭头 → 随机新词，左箭头 → 历史回退（`wordHistory` 栈），分页圆点改为进度计数器 `已练 X/Y`
- 发音音源：设置页配置有道词典（默认）或韦氏词典，统一通过 `/api/pronunciation` 代理路由，hook 为 `useMwPronunciation`
- fallback 到本地预生成音频 `/audio/words/blue/{word}.mp3`
- 韦氏词典 API 配置后显示 "Powered by Merriam-Webster" 归属标识

### 刻意练习模块（/drill）

- **四种训练模式**：
  - 单词训练（`/drill/word`）— 状态机驱动，三振跳过
  - 句子训练（`/drill/sentence`）— 句子库 + TTS 带读
  - 对比训练（`/drill/contrast`）— 最小对立对连续录音（A 词 + B 词），按**目标音素** accuracyScore 判定达标（见 `getPhonemeAccuracy` in `azure-phoneme-map.ts`）
  - 辨音训练（`/drill/perception`）— 一词三音辨识（见 perception-triples.ts 数据源，PR2 重构中）
- **单词训练流程**：选音标 → 选数量（5/10/15/20）→ 状态机驱动训练循环
- **状态机**（discriminated union + useReducer）：configuring → teaching → readyToRecord → recording → assessing → feedback → completed
- **核心 hook**：`useDrillSession`（`src/hooks/use-drill-session.ts`），编排 useRecorder + useAzureAssessment
- **达标分数联动教练模式**：简单 60 / 正常 70 / 略难 80 / 严师 85（`src/lib/drill-utils.ts` getPassThreshold）
- **三振跳过机制**：同一词 3 次未达标 → 可选"看发音要领"或"跳过此词"（标记为待加强）
- **训练完成**：confetti 庆祝动画（motion 库粒子）+ 摘要卡片（总词数/一次通过率/平均分/薄弱词 Top 3）
- **句子库**：`src/lib/sentence-bank.ts`，46 句预置内容（绕口令/最小对立句/日常场景/面试句），按音标 slug 分类
- **最小对立对库**：`src/lib/minimal-pairs.ts`，10 音素组 × 5 对 = 50 对（ee/ih、eh/ae、s/th、l/r、v/w、n/l、oo/uh、sh/ch、f/th、z/dh）。⚠️ 本地音频仅覆盖约 24%，所有发音走 `/api/pronunciation` 代理（有道默认 / 韦氏可选），fallback 链路见 `useMwPronunciation` 的 `tryLocalFallback`——失败时 console.warn，不再 silent fail
- **类型定义**：`src/types/drill.ts`（DrillPhase/DrillItem/DrillAttempt/DrillSummary/DrillState/DrillEvent）
- **侧边栏导航**：Target 图标 + "刻意练习" 标签，位于音标练习和自由练习之间
- **复用组件**：RecordButton、WaveformDisplay、PhonemeHighlight 等全部复用，不重复实现

### 自由练习页 TTS

- 「听标准发音」按钮与 Textarea 并排（h-[100px] w-[100px] 渐变色大按钮）
- 重听按钮为圆形小图标（RotateCcw h-3.5）嵌入方框右下角，不占外部空间
- 速度滑块：0.7x-1.2x，步进 0.1，自定义 Slider 组件
- TTS 音频 + alignment 数据缓存到 IndexedDB（`src/lib/tts-cache.ts`，max 50 entries LRU）
- 不同速度的同一句子分别缓存（key = text:voiceId:speed）
- 卡拉 OK 文字 text-2xl，下方有「重听一遍」重播按钮（复用缓存，不调 API）
