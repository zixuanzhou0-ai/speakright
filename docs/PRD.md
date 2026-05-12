# PRD — SpeakRight 产品需求文档

## 两大核心模块

### 模块一：音标练习（/phonemes）

**音标列表页**：所有美式英语音标按元音/辅音分类，每个音标一张卡片，显示 IPA 符号 + 示例单词 + 用户历史最高分。

**单个音标页**（/phonemes/[phoneme]）— 桌面端左右双栏布局：

左栏：
- 音标名称（大字）+ 语音学描述 + 大喇叭按钮（播放 IPA chart 音频）
- 教学视频嵌入区域（口型/舌位视频，视频就绪前显示占位）
- 示例单词翻页卡片（8 张，左右箭头切换 + 分页指示点 + 键盘方向键）
  - 卡片纯文字居中：单词（大字）+ IPA + 蓝色/粉色双喇叭
  - 有边框(border-2) + 阴影，箭头/喇叭/麦克风均有 cursor-pointer + motion 缩放动画
- 跟读区：跟读提示跟随当前卡片单词变化
- 大麦克风按钮 → 录音（Motion 脉冲动画）+ 30 秒倒计时进度条（最后 5 秒变红）
- 波形图（wavesurfer.js，录音后可点击回放）+ "回放录音"按钮

右栏（sticky 跟随滚动）：
- 四维评分（准确度/流利度/完整度/发音总分）
- 音素级准确度高亮
- LLM 中文反馈（流式打字机效果）
- 未评分时显示引导占位提示

移动端：单栏布局，反馈在下方。

**交互流程**：
1. 用户看视频学口型
2. 翻页选择想练习的单词 → 点喇叭听标准发音
3. 点击麦克风 → 浏览器录音（实时波形 + 倒计时进度条）
4. 手动停止或 30 秒自动停止 → 波形显示录音（可回放）
5. 点击"开始评分"（30 秒自动停止时自动触发）→ Azure 评分
6. 右栏显示评分结果 + 音素高亮 + LLM 中文反馈
7. 切换单词卡片 → 自动清空旧录音/评分/反馈

### 模块二：句子练习（/sentences）

页面结构：
- 文本输入框（上限 150 字符，右下角实时计数，120+ 字符警告色，150 禁止输入）
- 🔊 听标准发音按钮 → ElevenLabs TTS (with-timestamps) + 卡拉 OK 逐词高亮
- 🎤 录音按钮 + 30 秒倒计时进度条（最后 5 秒变红）+ 波形可视化区域
- 多维评分：准确度 + 流利度 + 完整度
- 逐词高亮（正确/错误/漏读/多读）
- LLM 中文反馈面板（发音问题 + 连读分析 + 句子地道度）

**交互流程**：
1. 用户输入英语句子（最多 150 字符）
2. 🔊 → ElevenLabs 朗读（with-timestamps 端点，逐词卡拉 OK 高亮）
3. 🎤 → 录音（30 秒倒计时）→ 手动停止或超时自动停止
4. 超时自动停止时自动触发 Azure 评估；手动停止后点"开始评分"
5. Azure 返回逐词评分 + 错读/漏读检测
6. 评分 JSON + 句子 → LLM → 中文反馈（流式 SSE）

---

## API 集成

### Azure Speech Pronunciation Assessment

```typescript
// microsoft-cognitiveservices-speech-sdk
const config = {
  referenceText: "...",
  gradingSystem: "HundredMark",
  granularity: "Phoneme",
  dimension: "Comprehensive",
  enableMiscue: true,
  enableProsodyAssessment: isSentence(referenceText)  // 仅句子模式
};

// 返回结构
interface AzureResult {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;
  words: Array<{
    word: string;
    accuracyScore: number;
    errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
    phonemes: Array<{ phoneme: string; accuracyScore: number }>;
    syllables: Array<{ syllable: string; grapheme?: string; accuracyScore: number }>;
  }>;
}
```

计费：按标准 STT 计费（~$1/小时），不是 TTS。最佳格式：PCM 16kHz 16bit mono。

### ElevenLabs TTS

**标准 TTS**: POST `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` → 返回 audio/mpeg
**带时间戳 TTS**: POST `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps` → 返回 `{ audio_base64, alignment }` 用于逐词高亮
**用量查询**: GET `https://api.elevenlabs.io/v1/user/subscription` → 需要 `user_read` 权限

Phase 1 不缓存音频。

### LLM 多 Provider（Cherry Studio 风格）

统一 OpenAI 兼容接口，只切换三个变量：baseUrl / apiKey / model。

```typescript
const PRESET_PROVIDERS = {
  claude:   { baseUrl: "https://api.anthropic.com/v1", models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
  gpt:      { baseUrl: "https://api.openai.com/v1", models: ["gpt-5.4-mini", "o3-mini"] },
  gemini:   { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", models: ["gemini-2.5-pro", "gemini-2.5-flash"] },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", models: ["deepseek-chat", "deepseek-reasoner"] },
  qwen:     { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen3-max", "qwen3.5-flash"] },
  glm:      { baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-5", "glm-4-flash"] },
  moonshot: { label: "Kimi", baseUrl: "https://api.moonshot.cn/v1", models: ["kimi-k2.5", "kimi-k2-thinking"] },
  doubao:   { baseUrl: "https://ark.cn-beijing.volces.com/api/v3", models: ["doubao-seed-2-0-pro", "doubao-seed-2-0-lite"] },
  custom:   { baseUrl: "", models: [] }
};
```

Model 字段为自由输入框，预设模型以 chips 形式显示在输入框下方，点击快速填入。用户可以输入任意模型 ID。

注意：Claude API 格式略有不同，需单独适配。其他全部兼容 OpenAI SDK。

### LLM Prompt 模板

严格教练风格（不鼓励、不客套），六大分析维度：音素级分析、音节级分析、流利度分析、完整度分析、韵律分析（句子模式）、高分挑刺（90+ 分仍找问题）。

完整模板见 `src/lib/llm-prompt.ts`。

---

## 后台设置页（/settings）

四个卡片，每个都有"测试连接/测试发音"按钮和状态指示灯：

**Azure Speech**：Subscription Key + Region 下拉
**ElevenLabs**：API Key + Default Voice 下拉（从 API 动态获取）
**发音音源**：有道词典（默认）/ 韦氏词典 单选。选韦氏时展开 API Key 输入框。「测试发音」按钮播放 "hello" 验证音源可用。
**LLM Provider**：横排 chip 选择器 → 选预设自动填 Base URL → 只需填 Key。选 Custom 三字段全部手动填。

Phase 1：API Key 存入 localStorage（浏览器本地）。Phase 2 计划：加密存入 Supabase。

设置页底部有"用量监控"区域，三列卡片：
- **ElevenLabs**：环形进度条显示字符用量（API 实时查询，需 `user_read` 权限）
- **Azure Speech**：环形进度条显示时长用量（本地追踪，F0 免费层 5 小时/月）
- **LLM Provider**：Token 消耗统计 + 估算费用（本地追踪）

---

## 数据存储

**Phase 1（当前）**：localStorage
- API Keys: `speakright_azure_config` / `speakright_elevenlabs_config` / `speakright_llm_config`
- 用量数据: `speakright_usage`（Azure 秒数 + LLM token 数，按月自动重置）

**Phase 2（计划）**：Supabase PostgreSQL + Auth + RLS（详见 docs/database.md）

---

## UI 设计指导

- 现代简洁，shadcn Maia 风格（圆角、温和色调）
- 深色/浅色模式切换
- 中文 UI，英文仅音标和练习内容
- 移动端响应式

**动画运用**：
- 录音按钮：Motion 脉冲呼吸效果
- 评分展示：数字从 0 滚动到实际分数（弹簧动画）
- 音素高亮：正确滑入绿色，错误抖动变红
- 页面切换：View Transitions 卡片展开效果
- LLM 反馈：流式打字机效果

---

## 开发优先级

### Phase 1: MVP
1. 项目脚手架（Next.js 16 + shadcn + Supabase）
2. 后台设置页（三个 API 配置卡片）
3. 音标列表页（静态数据渲染）
4. 单个音标页（ElevenLabs + 录音 + Azure 评分 + LLM 反馈）
5. 句子练习页（输入 + ElevenLabs + 录音 + 评分 + 反馈）

### Phase 2: 体验优化
- 用户认证 + 练习记录
- 音频缓存
- 评分趋势图表

### Phase 3: 进阶
- 单词练习模块
- AI 对话练习
- 发音弱点报告

---

## 依赖安装

```bash
npx create-next-app@latest pronunciation-app --typescript --tailwind --eslint --app --src-dir

npm install motion microsoft-cognitiveservices-speech-sdk openai wavesurfer.js howler
npm install -D @types/howler @biomejs/biome

npx shadcn@latest init    # Maia style, Base UI
npx shadcn@latest add button input card tabs dialog select badge toast
npx biome init
```
