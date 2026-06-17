# Spanish Phonology Optimization Plan

Status: source-aligned implementation plan
Language profile: `es-ES`
Product status: experimental
Last updated: 2026-06-18

## 核心判断

西班牙语当然有成熟的音标和音系体系。正确结论不是“西语没有成熟 IPA”，而是
SpeakRight 不能把英语页的拆分方式直接迁移过去。英语页可以较自然地做成“一个
phoneme tile 对应一个短音频、一个例词、一个评分目标”；西语也可以 phoneme-first，
但训练层必须再解释真实语流中的实现、重音、音节节奏和方言范围。

产品口径：课程锚点层保持 `/a e i o u/`、核心辅音、tap/trill、Castilian
`/θ/` 等音位目标；训练实现层解释 `[β̞ ð̞ ɣ̞]`、鼻音位置同化、双元音 glide、
词重音和音节节奏。相同 IPA 符号不自动等于英语同音，也不能复用英语音频。

## 权威依据

- RAE/ASALE, `Nueva gramatica de la lengua espanola: Fonetica y fonologia`
  (2011): https://www.rae.es/obras-academicas/gramatica/nueva-gramatica-fonetica-y-fonologia
- Martinez-Celdran, Fernandez-Planas, Carrera-Sabate, "Castilian Spanish",
  `Journal of the International Phonetic Association`, 33(2), 255-259:
  https://doi.org/10.1017/S0025100303001373
- International Phonetic Association, `Handbook of the International Phonetic
  Association`: https://www.internationalphoneticassociation.org/content/handbook-ipa
- University of Iowa, Sounds of Speech Spanish:
  https://soundsofspeech.uiowa.edu/spanish/spanish.html
- 当前实现入口：`src/lib/language-sound-units/spanish.ts`,
  `src/lib/language-phonology-inventory.ts`,
  `src/lib/language-feedback-rules.ts`,
  `src/lib/assessment-segment-audio.ts`。

## 当前覆盖结论

当前 `SPANISH_PHONEMES` 是可公开试用的 experimental 课程锚点层，但不是
mastery/evidenceMastery 完成状态。

已进入课程/诊断模型的内容：

- 五个核心元音 `/a e i o u/`，重点是短、纯、稳定，不迁移英语双元音化。
- 普通辅音锚点：`/p t k f m n l s/` 与 `/b d g/` 的塞音位置锚点。
- 西班牙本土 `es-ES` profile：`/θ/`、`/x/`、`/ɲ/`、`/tʃ/`、`/ʝ/`。
- 西语高价值对比：tap `/ɾ/` 与 trill `/r/`。
- 实现层：`/b d g/` 在元音间的 `[β̞ ð̞ ɣ̞]`。
- 语流/韵律：鼻音位置同化、双元音 `/j w/`、词重音、音节节奏。

仍不能宣称完成的内容：

- 许多普通辅音还没有 verified exact local short header clip，右侧评分 tile 必须
  score-only。
- `[β̞ ð̞ ɣ̞]` 不能被说成英语 `/v/`、英语 `/ð/` 或普通 `/g/` 的同音替代。
- `/ʎ/` 只能作为地区/yeismo 变体说明；默认 `es-ES` 不把它做成全局必修。
- `seseo`、`distincion`、地区 `/s/` 变体需要后续 dialect/profile switch。
- `needs-review` IPA 行只有在两处权威证据，或一处权威证据加可信音频/词典一致时修改。

生成的完整 inventory 表见
[`SPANISH_PHONOLOGY_INVENTORY_TABLE.md`](./SPANISH_PHONOLOGY_INVENTORY_TABLE.md)。

## 母语者学习方式到产品模型

西语发音学习通常先建立稳定拼写-发音关系和紧凑五元音系统，再进入重音规则、r
对比、b/d/g 语流实现和地区差异。产品因此分成两层：第一层让用户知道“这个语言有
哪些稳定目标”；第二层告诉用户“同一个目标在什么环境下听起来不同”。

| 层 | 西语内容 | 产品处理 |
| --- | --- | --- |
| phoneme | `/a e i o u p t k b d g f s θ x tʃ m n ɲ l ɾ r ʝ/` | 主课程、诊断标签、评分标签 |
| allophone/realization | `[β̞ ð̞ ɣ̞]`、鼻音位置 `[m n ɲ ŋ]` | 在词/短语内解释上下文，不冒充独立音位 |
| contrast | `/ɾ/` vs `/r/`、Castilian `/s/` vs `/θ/`、`y/ll` | 最小对立或 profile-aware drill |
| connected-speech rule | 双元音 `/j w/`、鼻音同化、跨词连接 | 短语/句子训练，不做假单音频 |
| prosody | 词重音、音节节奏、非重读元音仍清晰 | word/sentence feedback |

## 具体拆分规则

1. 元音：只保留 `/a e i o u/` 五元音核心。不要把英语 `/eɪ oʊ iː uː æ ɑː/`
   引入西语。
2. 清塞音：`/p t k/` 是少送气目标；`/t d/` 比英语更靠前，说明为 dental 或
   denti-alveolar 倾向。
3. `/b d g/`：课程锚点保留音位和塞音位置；训练层展示元音间 `[β̞ ð̞ ɣ̞]`。
4. `r` 系统：`/ɾ/` 与 `/r/` 必须分开建模，不能用英语 rhotic 解释。
5. Castilian profile：`/θ/` 只属于当前 `es-ES`，未来 profile 要允许拉美 `seseo`。
6. `y/ll`：默认常见 yeismo `/ʝ/`，保留 `/ʎ/` 作为变体知识，不硬判。
7. 鼻音：单独 `/m n ɲ/` 和位置同化规则分开；`un gato` 的 [ŋ] 是环境结果。
8. 重音：`papá/papa`、`habló/hablo` 等用 word-level 对比训练，不做单音 speaker。

## 修改计划

1. Inventory 与数据层
   - 继续维护 `language-phonology-inventory.ts`，每行都有 IPA、层级、source refs、
     audio status、tile policy、aliases 和 gaps。
   - 把所有西语 unit 明确归入 phoneme、allophone、contrast、connected-speech
     rule、prosody 之一。
   - `es-b-stop/es-d-stop/es-g-stop` 与 `es-bv/es-d/es-g` 保持双层，不合并。

2. UI 与中文文案
   - 卡片上清楚显示“音位/实现/对比/规则/韵律”。
   - 对 `/b d g/`、`/ɾ r/`、`/θ s/`、双元音、鼻音同化给出西语专属说明。
   - 对实验性语言继续显示 experimental，不出现 mastery 或完整证据承诺。

3. 内容审计
   - 复查所有西语词、短语、句子的 IPA、重音标记、双元音、鼻音同化和 `/b d g/`
     实现。
   - 示例词优先覆盖：五元音纯度、tap/trill、b/v 拼写同音位、Castilian
     `/s θ/`、重音最小对比。
   - `needs-review` 行按证据流程处理。

4. 音频策略
   - 只有同一 sound unit 的 exact local short header clip 可以点击。
   - 不用视频音频、整词、整句、字典 fallback、生成 TTS 或规则讲解冒充单音标。
   - `[β̞ ð̞ ɣ̞]` 不得映射到 stop-position `/b d g/` 音频。
   - 未经明确确认，不生成 ElevenLabs 或付费 provider 西语音频。

5. 测试与验收
   - `spanish-language-content.test.ts` 锁定五元音、`/b d g/` 双层、Castilian
     `/θ/`、tap/trill、experimental 口径。
   - `language-phonology-inventory.test.ts` 锁定层级、source refs、audio status。
   - `assessment-segment-audio.test.ts` 锁定 exact clip 才可点击。
   - `language-feedback-rules.test.ts` 锁定西语重音、音节节奏、实现层反馈。
   - 稳定后只用 Release EXE gates 验收。

## Done Definition

西语达到 public experimental 标准时，用户能区分稳定音位、上下文实现、方言变体、
重音和节奏；所有可点击 speaker 都是真实、短、同源、可追溯的本地目标音频，其余只
显示分数或规则说明。
