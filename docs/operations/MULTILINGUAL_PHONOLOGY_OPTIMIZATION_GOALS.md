# Multilingual Phonology Optimization Goals

Status: planning goals
Applies to: `es-ES`, `fr-FR`, `ru-RU`
Product status: all three remain experimental
Last updated: 2026-06-18

## 总目标

把西语、法语、俄语从“英语音标页迁移版”收紧成按目标语言音系建模的发音训练模块。
权威资料和当前代码审计结论一致：三种语言都有成熟 IPA/音系描述和学习传统；真正风险
不是“没有音标体系”，而是把相同 IPA 符号误当成英语同音、把语流规则误当成单音标、
把未验证音频做成 speaker。

最终实现必须让每个非英语 sound unit 都落到五类之一：phoneme、
allophone/realization、contrast、connected-speech rule、prosody。课程、评分、
反馈和音频必须忠于这个层级，不能为了 UI 整齐而把语言事实压平。

## 本轮明确结论

西语、法语、俄语都有成熟 IPA/音系和母语者/外语学习传统。正确答案不是“它们没有
音标体系”，而是 SpeakRight 要停止把英语 inventory 当作跨语言模板。相同 IPA 符号
只表示同一类 IPA 记号，不自动表示英语同音、同发音动作、同音频、同评分目标。

2026-06-18 实时复核结果与三份计划一致：西语应 phoneme-first 加实现层，法语应
inventory/contrast 加短语规则层，俄语应 stress-first、hard/soft-first。三语都必须把
“语言里真实存在”和“当前有 exact local short clip 可点击”分开判断。

当前三语都只能定位为 public experimental：课程锚点层已经可继续打磨，但单音音频、
phrase/sentence 规则、speaker/profile 变体、hard/soft 或 realization 覆盖都没有齐到
可以宣称 mastery/evidenceMastery/full coverage。被拆解出来但暂时没有 speaker 的单位，
如果是真实存在的语言单位，应归入 phoneme、realization、contrast、rule 或 prosody；
没有 verified exact same-unit short clip 时只显示分数/规则，不做可点击单音频。

## 最终计划文档位置

- 西语最终优化计划：
  [`docs/operations/SPANISH_PHONOLOGY_OPTIMIZATION_PLAN.md`](./SPANISH_PHONOLOGY_OPTIMIZATION_PLAN.md)
- 法语最终优化计划：
  [`docs/operations/FRENCH_PHONOLOGY_OPTIMIZATION_PLAN.md`](./FRENCH_PHONOLOGY_OPTIMIZATION_PLAN.md)
- 俄语最终优化计划：
  [`docs/operations/RUSSIAN_PHONOLOGY_OPTIMIZATION_PLAN.md`](./RUSSIAN_PHONOLOGY_OPTIMIZATION_PLAN.md)

这三份文档是本轮的落地依据：每份都包含权威来源、当前覆盖结论、母语/外语学习路径、
正确拆分规则、代码落点、音频策略、测试计划和 Done Definition。

## 共同产品边界

1. `es-ES`、`fr-FR`、`ru-RU` 继续标记为 experimental，不宣称 mastery、
   evidenceMastery 或 full coverage。
2. 音标练习只展示真实单音、实现音、对比或可独立练习的发音单位；连读、静音、
   重音、弱化、短语韵律和拼写规则保留在规则/短语/句子训练与 AI 反馈层，不再作为
   `/phonemes/*` 中的单音标卡片出现。
3. 课程锚点层可以先覆盖学习路径；训练实现层必须忠于实际发音。
4. scoring tile 只有在复用同一 sound unit 的 verified local short header clip 时
   可点击。
5. 规则讲解、proxy 音频、视频轨、字典 fallback、整词、整句、生成 TTS 都不能冒充
   单音标。
6. 未经明确确认，不生成 ElevenLabs 或其他付费 provider 音频。
7. `needs-review` 行不硬改，除非有两处权威证据，或一处权威证据加可信 source
   audio/词典一致。

## 证据使用规则

A 级来源用于改课程锚点和产品边界：IPA/JIPA illustration、ASALE/RAE、PFC、
Vinogradov/Gramota 正音入口。B 级来源用于教学文案和练习顺序：大学发音项目、
教学型发音资料、参考语法。C 级来源是当前代码和本地音频资产，只决定现在能否播放和
测试怎么锁，不证明某个语言单位不存在。

任何新增 sound unit 必须同时回答三件事：它在目标语言中属于 phoneme、realization、
contrast、rule 还是 prosody；它是否受 profile/方言/语体限制；它有没有 exact same-unit
local short clip。第三个答案为否时，UI 只能显示分数或规则说明，不显示可点击 speaker。

## 三语目标摘要

西语保持 phoneme-first。五元音短纯稳定；`/p t k/` 少送气；`/t d/` 更靠前；
`/ɾ/` 与 `/r/` 强对比；Castilian `/θ/` 属于当前 `es-ES` profile。`/b d g/`
拆成音位锚点和 `[β̞ ð̞ ɣ̞]` 语流实现；双元音、鼻音同化、词重音和音节节奏放到
词/短语/句子层。

法语采用“库存 + 对比 + 短语规则 + 韵律”模型。口元音、鼻化元音、前圆唇元音、
`/j ɥ w/`、小舌 `/ʁ/`、`/ʃ ʒ ɲ/` 和常见辅音是库存/对比层；`/ə/` 可作为
音标练习里的单音入口，但 liaison、enchaînement、elision、词尾静音和
phrase-final prominence 只属于短语/句子规则层，不做假单音频。

俄语必须 stress-first、hard/soft-first。元音、learner-facing `/ɨ/`、硬/软 pair、
常硬/常软、`ь`、iotated vowels、弱化、词尾清化、逆行清浊同化和 clusters 必须
分层。硬音 exact clip 不等于软音或 pair lesson 已完成；无 exact pair/soft clip 时
只能 score-only 或 rule-guidance-only。

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

## 下一轮优先级

1. 做三语 phrase/sentence IPA audit：西语重音/实现，法语 liaison/schwa，俄语重音/
   弱化/同化。
2. 补 UI 显示：卡片层级、不可点击原因、experimental 状态、长 IPA/例句不截断。
3. 继续补 exact same-unit header clips，但只在有本地短音频证据时更新可点击策略。

## Done Definition

用户能看清哪些是真实单音、哪些是上下文实现、哪些是对比、哪些是短语规则、哪些是
韵律；experimental 语言不被包装成已完成产品；所有 speaker 都真实、短、同源、可
追溯，其余只显示分数或规则说明。
