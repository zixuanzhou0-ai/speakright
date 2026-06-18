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

## 明确答案

- 西语有成熟 IPA/音系体系；问题不是“西语没有音标”，而是 SpeakRight 不能用英语
  inventory 当成跨语言总表。
- 当前西语课程锚点对 `es-ES` experimental 试用基本够用，但音频、语流实现和方言
  profile 不齐；不能宣称 mastery、evidenceMastery 或 full coverage。
- 西语可以继续按 phoneme-first 拆，但必须同时维护 realization/rule 层：`/b d g/`
  的停音环境和 `[β̞ ð̞ ɣ̞]` 近音环境分开，`/ɾ r/` 分开，`/s θ/` 只按
  Castilian profile 建模。
- 看起来和英语一样的 `/p t k f m n l s/` 也不能直接等同。西语 `/p t k/` 少送气，
  `/t d/` 更靠前，`/l/`、`/s/` 和鼻音在语流中的部位/同化不同；英语音频不能作为
  西语单音证据。
- 之前没有把某些“拆解出来的音标”放进来，通常不是因为它们不存在，而是因为它们属于
  上下文实现、方言变体、语流规则，或没有 verified exact local short clip。

## 权威来源与本轮查证结论

本轮查证使用了 ASALE/RAE 官方页面、JIPA/IPA illustration、University of Iowa
Sounds of Speech 和 IPA Handbook。结论很明确：西语有成熟音系和 IPA 描写，但
教学产品不能把英语的“一个符号 = 一个英语式按钮”迁移过去。

2026-06-18 实时复核再次确认：Castilian Spanish 的 `/b d g/` 必须按停音环境和
近音实现 `[β̞ ð̞ ɣ̞]` 分层；`/t d/`、少送气清塞音、tap/trill 和
`distincion/seseo/yeismo` 都需要 profile-aware 教学，不能用英语同符号音频替代。

- RAE/ASALE, `Nueva gramatica de la lengua espanola: Fonetica y fonologia`
  (2011): https://www.asale.org/obras-academicas/gramatica/nueva-gramatica-fonetica-y-fonologia
  - 官方说明该卷专门处理西语音声、音系和地域变体；它是 pan-Hispanic 参照，不是
    单一口音清单。
  - 对产品的约束：文档和 UI 必须说明 `es-ES` 是当前 profile，不把 Castilian
    目标写成所有西语地区的唯一正确答案。
- Martinez-Celdran, Fernandez-Planas, Carrera-Sabate, "Castilian Spanish",
  `Journal of the International Phonetic Association`, 33(2), 255-259:
  https://doi.org/10.1017/S0025100303001373
  - 确认五元音 `/a e i o u/` 是西语核心锚点。
  - 确认 Castilian profile 中 `/s/` 与 `/θ/` 可形成地区性音位对比。
  - 确认 `/b d g/` 需要区分塞音环境和元音间近音实现 `[β̞ ð̞ ɣ̞]`。
- University of Iowa, Sounds of Speech Spanish:
  https://soundsofspeech.uiowa.edu/spanish
  - 以发音部位、发音方式和可视化 articulatory model 组织教学，适合转化为
    SpeakRight 的“发音动作 + 例词 + 训练上下文”层。
  - 对产品的约束：西语 `/t d/`、鼻音、双元音和 liquids 需要用西语部位说明，不能
    只写“和英语相同”。
- International Phonetic Association, `Handbook of the International Phonetic
  Association`: https://www.internationalphoneticassociation.org/content/handbook-ipa
  - 提供 IPA illustration 的共同标注框架。
  - 对产品的约束：IPA 是标注体系，不等于每个符号都天然有可点击单音频。
- 当前实现入口：`src/lib/language-sound-units/spanish.ts`,
  `src/lib/language-phonology-inventory.ts`,
  `src/lib/language-feedback-rules.ts`,
  `src/lib/assessment-segment-audio.ts`。

## 证据等级与实现约束

| 等级 | 可用于什么 | 本计划如何使用 |
| --- | --- | --- |
| A: 官方/IPA illustration | 决定课程锚点、profile 边界、不得夸大的声明 | ASALE/RAE 约束 pan-Hispanic 口径；JIPA 约束 Castilian `es-ES` 核心库存和 `[β̞ ð̞ ɣ̞]` 实现 |
| B: 大学教学/发音项目 | 转化为中文动作说明、练习顺序和可视化提示 | University of Iowa 用于描述部位、方式、少送气、tap/trill、鼻音和 glide 的学习路径 |
| C: 当前代码/本地资产 | 决定 UI 是否可点击、测试覆盖和缺口列表 | 只有本仓库 verified local short clip 能让 speaker 可点击；代码缺口只能写成 TODO/score-only |

落地原则：A级来源可以修改课程锚点；B级来源可以修改教学文案和练习顺序；C级资产只决定
当前可播放性，不能反过来证明语言里“不存在”某个音或规则。

## 正确拆分答案

西语主层应继续 phoneme-first，但训练层必须 language-specific：

- 课程锚点：五元音、核心辅音、`/ɾ r/`、Castilian `/s θ/`、`/x ɲ tʃ ʝ/`。
- 实现层：`/b d g/` 的 stop-position 和 `[β̞ ð̞ ɣ̞]` 分开解释、分开评分提示。
- 规则层：鼻音位置同化、双元音 `/j w/`、词重音和音节节奏放到词/短语/句子里。
- 方言层：`/θ/`、`/ʎ/`、seseo/yeismo 只按 profile 或 variant 显示，不做全局硬判。
- 音频层：只有 exact same-unit local short clip 可点击；普通英语同符号音频、整词、
  句子、视频或 TTS 都不能冒充西语单音。

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
- 当前 `es-y-ll` 本地短音频只作为 `/ʝ/` exact clip 使用；`/ʎ/`、字母 `y` 和
  `ll` 只能进入变体/拼写说明或 score-only 处理，不能点同一个 speaker。
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

## 代码落点清单

- `src/lib/language-sound-units/spanish.ts`: 保持 phoneme-first，同时给
  `/b d g/`、`[β̞ ð̞ ɣ̞]`、tap/trill、Castilian `/θ/`、鼻音同化、双元音和重音
  明确 `unitType`。
- `src/lib/language-phonology-inventory.ts`: 每个西语 unit 必须有 source refs、
  audio status、tile policy、known gaps。
- `src/lib/language-feedback-rules.ts`: feedback 按西语少送气、五元音稳定、
  `[β̞ ð̞ ɣ̞]` 环境、词重音和音节节奏生成，不套英语 stress/rhotic 规则。
- `src/lib/assessment-segment-audio.ts`: 只有 exact same-unit local short clip 可播放；
  allophone 或 rule unit 默认不可点击，除非有同单元短音频证据。
- `src/__tests__/*spanish*` 与 audio policy 测试：锁住 experimental、profile-aware
  `/θ/`、`/ɾ r/`、`/b d g/` 双层和不可点击策略。

## Done Definition

西语达到 public experimental 标准时，用户能区分稳定音位、上下文实现、方言变体、
重音和节奏；所有可点击 speaker 都是真实、短、同源、可追溯的本地目标音频，其余只
显示分数或规则说明。
