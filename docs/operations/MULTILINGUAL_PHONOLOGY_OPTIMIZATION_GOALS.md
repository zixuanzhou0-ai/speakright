# Multilingual Phonology Optimization Goals

Status: planning goals
Applies to: `es-ES`, `fr-FR`, `ru-RU`
Product status: all three remain experimental
Last updated: 2026-06-17

## 总目标

把西语、法语、俄语从"英语音标页迁移版"收紧成真正按目标语言音系建模的发音训练
模块。三种语言都有成熟 IPA/音系描述；当前产品的风险不是"没有音标体系"，而是把
相同 IPA 符号误当成相同英语发音、把语流规则误当成单音标、把没有验证的音频做成
可点击 speaker。

最终目标是：每个非英语 sound unit 都能明确属于 phoneme、allophone/realization、
contrast、connected-speech rule、orthographic rule、dialect/variant 或 prosody
之一。用户看到的课程、评分、反馈和音频都必须忠于这个层级。

## 最终计划文档位置

- 西语最终优化计划：
  [`docs/operations/SPANISH_PHONOLOGY_OPTIMIZATION_PLAN.md`](./SPANISH_PHONOLOGY_OPTIMIZATION_PLAN.md)
- 法语最终优化计划：
  [`docs/operations/FRENCH_PHONOLOGY_OPTIMIZATION_PLAN.md`](./FRENCH_PHONOLOGY_OPTIMIZATION_PLAN.md)
- 俄语最终优化计划：
  [`docs/operations/RUSSIAN_PHONOLOGY_OPTIMIZATION_PLAN.md`](./RUSSIAN_PHONOLOGY_OPTIMIZATION_PLAN.md)

## 共同原则

1. `es-ES`, `fr-FR`, `ru-RU` 继续标记为 experimental，不宣称 mastery、
   evidenceMastery 或完整 coverage。
2. 课程锚点层可以先覆盖学习路径，训练实现层必须忠于实际发音。
3. scoring tile 只有在复用同一 sound unit 的 verified short local header clip
   时可点击。规则、proxy、视频、整词、句子、字典 fallback、生成 TTS 都不能冒充
   单音标。
4. 不生成 ElevenLabs 或付费 provider 音频，除非维护者明确确认。
5. `needs-review` 行不硬改，除非有两处权威证据，或一处权威证据加可信 source
   audio/词典一致。

## 语言目标

西语：保持 phoneme-first，五元音稳定，`/p t k/` 少送气，`/t d/` 位置更靠前，
`/ɾ/` 和 `/r/` 强对比，Castilian `/θ/` profile 化。`/b d g/` 要拆成音位锚点和
`[β ð ɣ]` 实现层，双元音、鼻音同化、词重音和音节节奏放在词/短语/句子层。

法语：口元音、鼻化元音、前圆唇元音、`/j ɥ w/`、小舌 `/ʁ/`、`/ʃ ʒ ɲ/` 和常见
辅音作为库存层；liaison、enchainement、elision、e caduc/schwa、词尾静音和
phrase-final prominence 作为短语/语流/韵律层，不做假单音频。

俄语：stress-first。元音、`/ɨ/`、硬/软辅音 pair、常硬/常软音、`ь`、iotated
vowels、弱化、词尾清化、清浊同化和 clusters 必须分层。硬软 pair 可以先
score-only，不得在无 exact clip 时播放。

## 实施目标

1. 建立每语言 source-backed inventory table：IPA、层级、变体范围、source refs、
   audio status、tile policy、known gaps。
2. 更新 `language-sound-units` 和学习 deck，让 UI 文案说清"这是音位、实现、规则
   还是韵律"。
3. 只在本地 exact short header clip 存在时更新 `local-language-assets` 和
   `assessment-segment-audio`。
4. feedback rules 必须命名目标语言问题，不再借英语假设解释西语、法语、俄语。
5. 补 inventory、source alignment、audio policy、phrase/rule feedback 测试。
6. 验收只走 Release EXE gates：`test`, `typecheck`, `lint`,
   `build:desktop-frontend`, `desktop:preflight`, `desktop:ui-smoke`,
   `desktop:launch-release`。音频只跑 dry-run。

## Done Definition

用户能清楚知道哪些目标是真实单音、哪些是上下文实现、哪些是变体、哪些是语流规则；
界面不把 experimental 语言包装成已完成产品；所有 speaker 都真实、短、同源、可追溯。
