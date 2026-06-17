# French Phonology Optimization Plan

Status: source-aligned implementation plan
Language profile: `fr-FR`
Product status: experimental
Last updated: 2026-06-18

## 核心判断

法语有成熟 IPA 描写和成熟外语发音教学传统。SpeakRight 的关键错误风险不是“法语
没有音标体系”，而是把法语做成英语式孤立音标按钮表。法语当然需要单音库存，但真实
学习路径还必须包括鼻化元音、前圆唇元音、glides、小舌 `/ʁ/`、词尾静音、liaison、
enchaînement、elision、e caduc/schwa 和节奏组末突出。

产品口径：法语要采用“库存 + 对比 + 短语规则 + 韵律”的模型。很多辅音符号看起来和
英语相同，例如 `/p t k f v s z m n l/`，但发音位置、送气、释放、词尾行为和短语连接
不同；相同 IPA 符号不等于可以复用英语音频或英语课程讲法。

## 权威依据

- Fougeron and Smith, "French", `Journal of the International Phonetic
  Association`, 23(2), 73-76:
  https://doi.org/10.1017/S0025100300004874
- International Phonetic Association, `Handbook of the International Phonetic
  Association`: https://www.internationalphoneticassociation.org/content/handbook-ipa
- PFC, `Phonologie du Francais Contemporain`: https://www.projet-pfc.net/
- Phonetique.ca French pronunciation modules: https://www.phonetique.ca/
- 当前实现入口：`src/lib/language-sound-units/french.ts`,
  `src/lib/language-feedback-rules.ts`,
  `src/lib/language-phonology-inventory.ts`,
  `src/lib/local-language-assets.ts`。

## 当前覆盖结论

当前 `FRENCH_PHONEMES` 是 experimental 法语课程方向，不是完整法语发音产品。

已进入课程/诊断模型的内容：

- 口元音：`/i y u e ɛ ø œ ə o ɔ a/`，并把 `/ɑ/` 作为历史/地区/高级变体处理。
- 鼻化元音：`/ɑ̃ ɛ̃ ɔ̃ œ̃/`，其中 `/œ̃/` 要保留传统对比并承认现代合并。
- 高优先级难点：前圆唇 `/y ø œ/` 与 glide `/ɥ/`。
- 小舌 `/ʁ/`、`/ʃ/`、`/ʒ/`、`/ɲ/`、glides `/j ɥ w/`。
- 常见辅音 `/p b t d k g f v s z m n l/`。
- 短语/句子规则：liaison、enchaînement、elision、final consonant silence、
  schwa/e caduc、phrase-final prominence。

仍不能宣称完成的内容：

- 很多常见辅音没有 verified exact short local header clip，scoring tile 必须保持
  不可点击。
- `/ŋ/` 主要在 loanwords 中出现，不作为核心初学单元。
- `/œ̃/` 需要 merge-aware feedback，不把合并口音直接判错。
- phrase/sentence IPA 必须继续审计 liaison、enchaînement、elision、schwa 和词尾
  静音。
- 规则类单位不能显示成单音标 speaker。

生成的完整 inventory 表见
[`FRENCH_PHONOLOGY_INVENTORY_TABLE.md`](./FRENCH_PHONOLOGY_INVENTORY_TABLE.md)。

## 母语者学习方式到产品模型

法语学习不能只靠“每个字母读什么音”。学习者需要先建立元音/鼻化元音/辅音库存，再用
短语级规则解释为什么词尾有时不读、有时在后面元音前出现，为什么拼写里的 e 有时可读
有时消失，以及为什么法语重音更像节奏组末突出而不是英语式词重音。

| 层 | 法语内容 | 产品处理 |
| --- | --- | --- |
| phoneme | 口元音、鼻化元音、核心辅音、`/ʁ ʃ ʒ ɲ/` | 课程、诊断标签、单音对比 |
| contrast | `/i y u/`、`/e ɛ/`、`/ø œ/`、`/j ɥ w/`、`/ʃ ʒ/` | 对比训练 |
| allophone/variant | `/œ̃/` 合并、可选 `/ɑ/`、loan `/ŋ/` | 变体说明，谨慎评分 |
| connected-speech rule | liaison、enchaînement、elision、词尾静音 | 短语/句子训练，不做假单音频 |
| prosody | schwa/e caduc、节奏组、phrase-final prominence | 句子级反馈 |

## 具体拆分规则

1. 元音库存：把 `/i y u e ɛ ø œ ə o ɔ a ɑ̃ ɛ̃ ɔ̃ œ̃/` 当成核心学习入口，但标明
   `/œ̃/` 和 `/ɑ/` 的地区/现代变体边界。
2. 前圆唇：`/y ø œ ɥ/` 是中文学习者重点。提示应写成“前舌位 + 圆唇”，不能退成
   `/u o w/`。
3. 鼻化元音：鼻化的是元音本身，不是在后面补一个完整 `/n/` 或 `/ŋ/`。
4. `/ʁ/`：法语小舌目标，不是英语 rhotic，也不是西语 trill。
5. `ch/j`：`ch = /ʃ/`，`j/soft g = /ʒ/`，不能写成英语 affricate `/tʃ dʒ/`。
6. 词尾辅音：孤立词中常静音，但 liaison、派生形式或词汇例外中可能出现。
7. liaison：潜在词尾辅音只在合适句法/语音环境中出现。
8. enchaînement：本来就发出的词尾辅音重新切到下一个元音，不是新增音素。
9. elision：弱元音省略，常在拼写中用撇号体现。
10. schwa/e caduc：是否保留受语速、地区、语体和辅音丛环境影响。
11. phrase-final prominence：突出落在节奏组末，不是英语式每个内容词重读。

## 修改计划

1. Inventory 与数据层
   - 继续维护 `language-phonology-inventory.ts`，每行都有 IPA、层级、source refs、
     audio status、tile policy、aliases 和 gaps。
   - 把 `fr-schwa` 明确写成双层：`/ə/` 是教学锚点，e caduc 是语流规则入口。
   - 把 `/œ̃/` 作为 contrast/variant，不做“所有现代法语必须保留”的硬承诺。

2. UI 与中文文案
   - 卡片上清楚显示“音位/对比/变体/规则/韵律”。
   - 对 nasal vowels、front rounded vowels、`/ʁ/`、`/ʃ ʒ/`、glides、词尾静音
     给出法语专属中文提示。
   - 规则单位显示为 phrase/sentence lesson，不出现单音 speaker 误导。

3. 内容审计
   - 逐条复查短语和句子的 liaison、enchaînement、elision、schwa、词尾静音。
   - 对每个例词区分拼写提示和 IPA 事实，避免按拼写机械读音。
   - 优先补 `/i y u/`、`/ø œ/`、鼻化元音、`/j ɥ w/`、`/ʃ ʒ/` 对比素材。

4. 音频策略
   - 只有 `/audio/language-assets/fr-FR/header-clips/` 中同一 sound unit 的 exact
     local short clip 才能点击。
   - liaison、enchaînement、elision、词尾静音、schwa 和 phrase-final prominence
     只能用短语/句子证据训练，不显示成单音 speaker。
   - 字典音频、生成 TTS、视频轨、整词、整句、规则讲解都不能替代单音频。
   - 未经明确确认，不生成 ElevenLabs 或付费 provider 法语音频。

5. 测试与验收
   - `french-language-content.test.ts` 锁定元音、鼻化元音、前圆唇、`/ʁ/`、
     `/ʃ ʒ/`、`/œ̃/` 合并说明、experimental 口径。
   - `language-feedback-rules.test.ts` 分开锁定 liaison、enchaînement、elision、
     schwa、词尾静音、phrase-final prominence。
   - `assessment-segment-audio.test.ts` 锁定规则类和无验证辅音不可点击。
   - `language-phonology-inventory.test.ts` 锁定层级、source refs、audio status。
   - 稳定后只用 Release EXE gates 验收。

## Done Definition

法语达到 public experimental 标准时，用户能区分单音库存、对比、变体、短语规则和
韵律；AI feedback 不套英语 stress/rhotic 假设；所有可点击 speaker 都是 exact
same-unit local short clip，其余只显示分数或规则说明。
