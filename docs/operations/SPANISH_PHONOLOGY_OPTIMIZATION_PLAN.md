# Spanish Phonology Optimization Plan

Status: source-aligned implementation plan
Language profile: `es-ES`
Product status: experimental
Last updated: 2026-06-18

## 结论

西班牙语有成熟、稳定、可用于教学和产品实现的 IPA/音系描述。SpeakRight 的问题不是
"西语没有音标体系"，而是不能把英语页的模型直接搬过来：英语式"每个 IPA tile =
一个孤立发音按钮 = 一个已掌握音素"对西语过于扁平。

正确方案是：课程锚点层继续 phoneme-first，因为西语学习者确实可以从紧凑音位表和
拼写-发音关系入门；训练实现层必须再拆出真实发音环境。重点包括：五个纯元音稳定、
`/p t k/` 少送气、`/t d/` 更靠前、`/b d g/` 在不同环境中有塞音和近音实现、
`/ɾ/` 与 `/r/` 是独立学习目标，Castilian `/θ/` 是当前 `es-ES` profile 目标而
不是全西语通用目标。

## 权威依据

- RAE/ASALE, `Nueva gramatica de la lengua espanola: Fonetica y fonologia`
  (2011): https://www.rae.es/obras-academicas/gramatica/nueva-gramatica-de-la-lengua-espanola
- Martinez-Celdran, Fernandez-Planas, Carrera-Sabate, "Castilian Spanish",
  `Journal of the International Phonetic Association`, 33(2), 255-259:
  https://doi.org/10.1017/S0025100303001373
- International Phonetic Association, `Handbook of the International Phonetic
  Association`: https://www.internationalphoneticassociation.org/content/handbook-ipa
- University of Iowa, Sounds of Speech Spanish:
  https://soundsofspeech.uiowa.edu/spanish
- 当前实现：`src/lib/language-sound-units/spanish.ts`,
  `src/lib/language-phonology-inventory.ts`,
  `src/lib/language-phoneme-resources.ts`,
  `src/lib/assessment-segment-audio.ts`。

## Source-backed Inventory Table

西语 inventory 表的权威入口在 `src/lib/language-phonology-inventory.ts`：
`getLanguagePhonologyInventoryTableRows("es-ES")` 和
`formatLanguagePhonologyInventoryMarkdownTable("es-ES")`。每一行必须包含
`slug`、`IPA`、`layer`、`variant scope`、`source refs`、`audio status`、
`tile policy`、`gaps`。对应测试在
`src/__tests__/language-phonology-inventory.test.ts`，用于防止文档口径、课程单位、
音频策略和 source refs 漂移。

## 当前产品状态

当前 `SPANISH_PHONEMES` 是可继续打磨的 experimental 课程锚点层，不能宣称 mastery、
evidenceMastery 或完整 coverage。

已覆盖：

- 五个核心元音 `/a e i o u/`。
- 常见辅音 `/p t k f m n l s b d g/`。
- Castilian profile 里的 `/θ/`、`/x/`、`/ɲ/`、`/tʃ/`、`/ʝ/`。
- tap `/ɾ/` 与 trill `/r/`。
- `/b d g/` 的塞音锚点：`es-b-stop`, `es-d-stop`, `es-g-stop`。
- `/b d g/` 的语流实现/对比：`es-bv`, `es-d`, `es-g`。
- 双元音 glide、鼻音位置同化、词重音、音节节奏。

仍未完成：

- 很多普通辅音没有 verified exact local short header clip，scoring tile 必须保持
  score-only。
- `[β̞ ð̞ ɣ̞]` 是真实西语实现，但不是英语 `/v/`、英语 `/ð/` 或英语式 `/g/`。
- `/ʎ/` 暂不进入默认全局目标，只能作为 yeismo/地区变体说明。
- 拉美 `seseo`、地区 `yeismo`、/s/ 变体需要未来 dialect/profile 开关。
- `needs-review` IPA 行不能凭直觉硬改。

## 正确拆分模型

| 层 | 西语内容 | 产品处理 |
| --- | --- | --- |
| phoneme | `/a e i o u p t k b d g f s θ x tʃ m n ɲ l ɾ r ʝ/` | 主课程、诊断标签、评分标签 |
| allophone/realization | `[β̞ ð̞ ɣ̞]`、鼻音位置 `[m n ɲ ŋ]` | 解释上下文，在词/短语内比较 |
| contrast | `/ɾ/` vs `/r/`、Castilian `/s/` vs `/θ/`、`y/ll` | 最小对立或 profile-aware drill |
| connected-speech rule | 双元音 `/j w/`、鼻音同化、跨词连接 | 词/短语/句子训练，不冒充单音频 |
| prosody | 词重音、音节节奏、非重读元音仍保持清晰 | word/sentence feedback |

## 修改计划

1. Inventory 与 UI
   - 保持西语 experimental。
   - `language-phonology-inventory.ts` 中每个西语 unit 必须有层级、source refs、
     audio status 和 tile policy。
   - UI 文案要让用户看出这是音位、实现、对比、规则还是韵律。

2. 课程内容
   - 五元音保持短、纯、稳定，防止英语 `/eɪ oʊ iː uː/` 迁移。
   - `/p t k/` 标注不强送气；`/t d/` 标注 dental/denti-alveolar 倾向。
   - `/b d g/` 拆成音位锚点和 `[β̞ ð̞ ɣ̞]` 语流实现。
   - `/ɾ/` 与 `/r/` 作为高优先级对比。
   - `/θ/` 保持在 `es-ES`，未来用 dialect switch 处理 `seseo`。

3. 示例与 IPA
   - 增加/复核重音对比，例如 `papa/papa`、`hablo/hablo` 等。
   - 复查短语/句子的双元音、音节边界、鼻音同化和 `/b d g/` 实现。
   - `needs-review` 只在有证据时修改。

4. 音频策略
   - 只有同一 sound unit 的 exact local short header clip 才能点击。
   - 不用视频音频、整词、整句、字典 fallback、生成 TTS 或规则讲解冒充单音标。
   - `[β̞ ð̞ ɣ̞]` 不得映射到 stop-position `/b d g/` 音频。
   - 未经明确确认，不生成 ElevenLabs 或付费 provider 西语音频。

5. 测试
   - `spanish-language-content.test.ts`：锁定 inventory、`/b d g/` 双层模型、
     Castilian `/θ/`、`/ɾ r/`、experimental 口径。
   - `language-phonology-inventory.test.ts`：锁定层级、source refs、audio status。
   - `assessment-segment-audio.test.ts`：无 exact clip 不可点击，不冒充音频。
   - `non-english-ipa-audit.test.ts`：词/短语/句子 IPA 保持西语专属。

## Done Definition

西语达到 public experimental 标准时，用户能区分稳定音位、上下文实现、方言变体、
重音和节奏；每个可点击 speaker 都是真实、短、同源、可追溯的本地目标音频，其余只
能 score-only 或 rule-guidance-only。
