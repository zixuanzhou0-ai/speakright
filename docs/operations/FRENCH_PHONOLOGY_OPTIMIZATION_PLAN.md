# French Phonology Optimization Plan

Status: source-aligned implementation plan
Language profile: `fr-FR`
Product status: experimental
Last updated: 2026-06-18

## 结论

法语有成熟 IPA 描写和成熟的外语发音教学传统。SpeakRight 不能把法语做成英语式孤立
音标按钮表，因为法语学习的核心不仅是单音，还包括前圆唇元音、鼻化元音、`/ɥ/`、
小舌 `/ʁ/`、词尾静音、liaison、enchaînement、elision、e caduc/schwa、节奏组和
短语末突出。

很多法语辅音符号看起来和英语相同，例如 `/p t k f v s z m n l/`，但发音位置、送气、
释放、词尾行为和短语连接都不同。相同 IPA 符号不等于可以复用英语音频或英语课程
讲法。

## 权威依据

- Fougeron and Smith, "French", `Journal of the International Phonetic
  Association`, 23(2), 73-76:
  https://doi.org/10.1017/S0025100300004874
- International Phonetic Association, `Handbook of the International Phonetic
  Association`: https://www.internationalphoneticassociation.org/content/handbook-ipa
- PFC, `Phonologie du Francais Contemporain`: https://www.projet-pfc.net/
- Phonetique.ca French pronunciation modules: https://www.phonetique.ca/
- 当前实现：`src/lib/language-sound-units/french.ts`,
  `src/lib/language-feedback-rules.ts`,
  `src/lib/language-phonology-inventory.ts`,
  `src/lib/local-language-assets.ts`。

## Source-backed Inventory Table

法语 inventory 表的权威入口在 `src/lib/language-phonology-inventory.ts`：
`getLanguagePhonologyInventoryTableRows("fr-FR")` 和
`formatLanguagePhonologyInventoryMarkdownTable("fr-FR")`。每一行必须包含
`slug`、`IPA`、`layer`、`variant scope`、`source refs`、`audio status`、
`tile policy`、`gaps`。对应测试在
`src/__tests__/language-phonology-inventory.test.ts`，用于防止文档口径、课程单位、
音频策略和 source refs 漂移。

## 当前产品状态

当前 `FRENCH_PHONEMES` 是 experimental 法语课程方向，不是完整法语发音产品。

已覆盖：

- 口元音和鼻化元音：`/i y u e ɛ ø œ ə o ɔ a ɑ̃ ɛ̃ ɔ̃ œ̃/`。
- 前圆唇重点 `/y ø œ/` 与 glide `/ɥ/`。
- 小舌 `/ʁ/`、`/ʃ/`、`/ʒ/`、`/ɲ/`、glides `/j ɥ w/`。
- 常见辅音 `/p b t d k g f v s z m n l/`。
- liaison、enchaînement、elision、final consonant silence、schwa/e caduc、
  phrase-final prominence。

仍未完成：

- 很多常见辅音没有 verified exact short local header clip，scoring tile 必须保持
  不可点击。
- `/ɑ/` 先作为历史/地区/高级变体，默认 profile 不强行必修。
- `/ŋ/` 主要在 loanwords 中出现，不作为核心初学单元。
- `/œ̃/` 需要保留传统对比说明，同时承认许多现代口音与 `/ɛ̃/` 合并。
- phrase/sentence IPA 必须继续审计 liaison、enchaînement、elision、schwa 和词尾
  静音。

## 正确拆分模型

| 层 | 法语内容 | 产品处理 |
| --- | --- | --- |
| phoneme | 口元音、鼻化元音、核心辅音、`/ʁ ʃ ʒ ɲ/` | 课程和诊断标签 |
| contrast | `/i y u/`、`/e ɛ/`、`/ø œ/`、`/j ɥ w/`、`/ʃ ʒ/` | 对比训练 |
| allophone/variant | `/œ̃/`、可选 `/ɑ/`、loan `/ŋ/` | 变体说明，谨慎评分 |
| connected-speech rule | liaison、enchaînement、elision、词尾静音 | 短语/句子训练，不做假单音频 |
| prosody | 节奏组、phrase-final prominence | 句子级反馈 |

## 修改计划

1. Inventory 与 UI
   - 保持法语 experimental。
   - 每个 unit 标清 phoneme、realization/variant、contrast、connected-speech
     rule 或 prosody。
   - `fr-schwa` 必须双层说明：`/ə/` 是教学目标，e caduc 是语流规则入口。

2. 课程内容
   - `/y ø œ ɥ/` 高优先级，核心提示是"前舌位 + 圆唇"。
   - 鼻化元音是鼻化的元音，不是在后面加完整 `/n/` 或 `/ŋ/`。
   - `/ʁ/` 是法语小舌目标，不是英语 rhotic，也不是西语 trill。
   - `ch = /ʃ/`，`j/soft g = /ʒ/`，不能写成英语 affricate `/tʃ dʒ/`。
   - 词尾辅音要解释为孤立词中通常静音，但 liaison、派生或词汇例外中可能出现。

3. 短语和句子规则
   - liaison：潜在词尾辅音在合适句法/语音环境中出现。
   - enchaînement：本来就发出的词尾辅音重新切到下一个元音。
   - elision：弱元音省略，常在拼写中用撇号体现。
   - schwa/e caduc：是否保留受语速、地区、语体和辅音丛环境影响。
   - phrase-final prominence：法语突出在节奏组末，不是英语式每个内容词重读。

4. 音频策略
   - 只有 `/audio/language-assets/fr-FR/header-clips/` 里的 exact local short clip
     才能让 tile 可点击。
   - liaison、enchaînement、elision、词尾静音、schwa 规则和短语末突出只能用短语/
     句子证据，不显示成单音标 speaker。
   - 字典音频、生成 TTS、视频轨、整词、整句、规则讲解都不能替代单音频。
   - 未经明确确认，不生成 ElevenLabs 或付费 provider 法语音频。

5. 测试
   - `french-language-content.test.ts`：元音、鼻化元音、前圆唇、`/ʁ/`、`/ʃ ʒ/`、
     `/œ̃/` 合并说明、experimental 口径。
   - `language-feedback-rules.test.ts`：liaison、enchaînement、elision、schwa、
     词尾静音、phrase-final prominence 分开。
   - `assessment-segment-audio.test.ts`：规则类和无验证辅音保持不可点击。
   - `non-english-ipa-audit.test.ts`：phrase/sentence IPA 尊重法语语流。

## Done Definition

法语达到 public experimental 标准时，用户能区分单音库存、对比、短语规则和韵律；
AI feedback 不套英语 stress/rhotic 假设；所有可点击 speaker 都是 exact same-unit
local short clip。
