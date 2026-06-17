# Multilingual Phonology Optimization Goals

Status: planning goals
Applies to: `es-ES`, `fr-FR`, `ru-RU`
Product status: all three remain experimental
Last updated: 2026-06-18

## 总目标

把西语、法语、俄语从"英语音标页迁移版"收紧成按目标语言音系建模的发音训练模块。
调研结论很明确：三种语言都有成熟 IPA/音系描述和学习传统；风险不是"没有音标体系"，
而是把相同 IPA 符号误当成英语同音、把语流规则误当成单音标、把未验证音频做成
speaker。

最终实现必须把每个非英语 sound unit 收敛到五类之一：phoneme、
allophone/realization、contrast、connected-speech rule、prosody。课程、评分、
反馈和音频都必须忠于这个层级。

## 最终计划文档位置

- 西语：
  [`docs/operations/SPANISH_PHONOLOGY_OPTIMIZATION_PLAN.md`](./SPANISH_PHONOLOGY_OPTIMIZATION_PLAN.md)
- 法语：
  [`docs/operations/FRENCH_PHONOLOGY_OPTIMIZATION_PLAN.md`](./FRENCH_PHONOLOGY_OPTIMIZATION_PLAN.md)
- 俄语：
  [`docs/operations/RUSSIAN_PHONOLOGY_OPTIMIZATION_PLAN.md`](./RUSSIAN_PHONOLOGY_OPTIMIZATION_PLAN.md)

## 共同规则

1. `es-ES`、`fr-FR`、`ru-RU` 继续标记为 experimental，不宣称 mastery、
   evidenceMastery 或 full coverage。
2. 课程锚点层可以先覆盖学习路径；训练实现层必须忠于实际发音。
3. scoring tile 只有在复用同一 sound unit 的 verified local short header clip 时
   可点击。
4. 规则讲解、proxy 音频、视频轨、字典 fallback、整词、整句、生成 TTS 都不能冒充
   单音标。
5. 未经明确确认，不生成 ElevenLabs 或其他付费 provider 音频。
6. `needs-review` 行不硬改，除非有两处权威证据，或一处权威证据加可信 source
   audio/词典一致。

## 语言目标

西语保持 phoneme-first。五元音短纯稳定；`/p t k/` 少送气；`/t d/` 更靠前；
`/ɾ/` 与 `/r/` 强对比；Castilian `/θ/` 属于 `es-ES` profile。`/b d g/` 拆成
音位锚点和 `[β̞ ð̞ ɣ̞]` 语流实现；双元音、鼻音同化、词重音和音节节奏放到词/
短语/句子层。

法语用"库存 + 对比 + 短语规则 + 韵律"模型。口元音、鼻化元音、前圆唇元音、
`/j ɥ w/`、小舌 `/ʁ/`、`/ʃ ʒ ɲ/` 和常见辅音是库存/对比层；liaison、
enchaînement、elision、e caduc/schwa、词尾静音和 phrase-final prominence 是
语流或韵律层，不做假单音频。

俄语 stress-first、hard/soft-first。元音、learner-facing `/ɨ/`、硬/软 pair、
常硬/常软、`ь`、iotated vowels、弱化、词尾清化、逆行清浊同化和 clusters 必须
分层。当前已把 `/p b t d k g f v s z m n l ʂ ʐ/` 的硬音锚点接到 exact local
header clips；硬软 pair 可以先 score-only，但无 exact pair/soft clip 时不能播放。

## 实施目标

1. 每种语言维护 source-backed inventory table：IPA、层级、变体范围、source refs、
   audio status、tile policy、aliases、gaps。
2. 更新 language sound units 和 UI 文案，让用户知道当前卡片是音位、实现、对比、
   规则还是韵律。
3. 只有 exact same-unit short clip 存在时才更新 local assets 和
   assessment-segment audio。
4. feedback rules 必须目标语言专属：西语重音/实现，法语短语规则，俄语重音/弱化/
   硬软/同化。
5. 补 inventory、source alignment、audio policy、phrase/rule feedback 和
   non-English IPA audit 测试。
6. 稳定改动只用 Release EXE gates 验收：`test`、`typecheck`、`lint`、
   `build:desktop-frontend`、`desktop:preflight`、`desktop:ui-smoke`、
   `desktop:launch-release`。音频只跑 dry-run。

## Done Definition

用户能看清哪些是真实单音、哪些是上下文实现、哪些是对比、哪些是短语规则、哪些是
韵律；experimental 语言不被包装成已完成产品；所有 speaker 都真实、短、同源、可
追溯，其余只显示分数或规则说明。
