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

## 明确答案

- 法语有成熟 IPA/音系体系；真正难点是法语学习不能被压成英语式“孤立音标按钮表”。
- 当前法语 inventory 覆盖了 public experimental 所需的核心学习入口，但 phrase/
  sentence 规则、speaker/profile 变体和 exact short clips 还不齐；不能宣称
  mastery、evidenceMastery 或 full coverage。
- 法语拆分必须是 inventory + contrast + connected-speech rule + prosody：
  鼻化元音、前圆唇元音和 `/ʁ ʃ ʒ ɲ j ɥ w/` 可以做课程锚点；liaison、
  enchaînement、elision、final consonant silence、e caduc/schwa 必须在短语/句子
  层训练。
- 看起来和英语一样的 `/p t k f v s z m n l/` 也不能直接复用英语发音。法语送气、
  齿/齿龈位置、词尾释放、词尾静音、liaison 和音节重切分都会改变真实训练目标。
- 之前没放进来的很多“音标”不是没有依据，而是不适合做单音 tile：有些是短语级潜在
  辅音，有些是 schwa/e caduc 的保留或脱落，有些是 speaker/profile 变体。

## 权威来源与本轮查证结论

本轮查证使用了 JIPA/IPA illustration、PFC、Phonetique.ca 和 IPA Handbook。结论：
法语不缺成熟音标体系；真正的产品难点是不能把法语拆成孤立英语式 tile。法语的可懂度
高度依赖短语级连接、词尾静音、e caduc/schwa 和节奏组。

2026-06-18 实时复核再次确认：Fougeron/Smith 的 French IPA illustration 支持口元音、
鼻化元音、前圆唇元音、小舌 `/ʁ/` 和 glides 作为库存/对比层；PFC/IPFC 路线把
liaison、schwa/e caduc 和真实口语变体放在短语/语体层。因此法语 speaker 策略必须
继续把规则类单位与单音 exact clip 分开。

- Fougeron and Smith, "French", `Journal of the International Phonetic
  Association`, 23(2), 73-76:
  https://doi.org/10.1017/S0025100300004874
  - 提供现代法语 IPA illustration，并说明元音库存存在 speaker/profile 差异。
  - 确认前圆唇元音 `/y ø œ/`、鼻化元音 `/ɑ̃ ɛ̃ ɔ̃ œ̃/`、小舌 `/ʁ/` 和
    glides `/j ɥ w/` 是法语学习关键。
  - 对产品的约束：`/œ̃/`、`/ɑ/` 等不能写成所有现代法语 speaker 必须稳定区分。
- PFC, `Phonologie du Francais Contemporain`: https://www.projet-pfc.net/
  - 以真实口语语料研究 liaison、schwa/e caduc 和地域/语体差异。
  - 对产品的约束：liaison 要区分 obligatory、optional、forbidden；schwa 不能
    按固定单音规则硬判。
- Phonetique.ca French pronunciation modules: https://www.phonetique.ca/
  - 教学上强调先听辨口元音/鼻化元音和最小对立，再进入发音。
  - 对产品的约束：法语 drill 需要“听辨 + 产出”双阶段，不能只给 IPA 读法。
- International Phonetic Association, `Handbook of the International Phonetic
  Association`: https://www.internationalphoneticassociation.org/content/handbook-ipa
  - 提供 IPA illustration 的共同标注框架。
  - 对产品的约束：IPA 符号是标注，不授权我们用整词或规则讲解当单音频。
- 当前实现入口：`src/lib/language-sound-units/french.ts`,
  `src/lib/language-feedback-rules.ts`,
  `src/lib/language-phonology-inventory.ts`,
  `src/lib/local-language-assets.ts`。

## 证据等级与实现约束

| 等级 | 可用于什么 | 本计划如何使用 |
| --- | --- | --- |
| A: IPA/JIPA illustration | 决定库存、对比和明确的 profile 限制 | Fougeron/Smith 约束 Parisian/French illustration，不把单一 speaker 描写扩大成所有法语 |
| A: 语料项目 | 决定 phrase/sentence 规则的可变性 | PFC 约束 liaison、schwa/e caduc、地区/语体差异和 FLE 教学口径 |
| B: 教学发音项目 | 转化为听辨顺序、中文动作提示和练习路径 | Phonetique.ca 支持先听辨口元音、鼻化元音、前圆唇和 glide 对比 |
| C: 当前代码/本地资产 | 决定 UI 是否可点击、测试覆盖和缺口列表 | 只有本仓库 verified local short clip 能让 speaker 可点击；规则类单位只能进入短语/句子训练 |

落地原则：法语规则的真实单位通常不是孤立单音。liaison、enchaînement、elision、
final consonant silence、schwa/e caduc 和 phrase-final prominence 必须落在短语/句子
层；没有 exact clip 时不能为了 UI 整齐显示单音 speaker。

## 正确拆分答案

法语应采用“库存 + 对比 + 短语规则 + 韵律”的模型：

- 课程锚点：口元音、鼻化元音、核心辅音、`/ʁ ʃ ʒ ɲ/`、glides `/j ɥ w/`。
- 对比层：`/i y u/`、`/e ɛ/`、`/ø œ/`、鼻化元音、`/ʃ ʒ/`、`/j ɥ w/`。
- 规则层：liaison、enchaînement、elision、final consonant silence、schwa/e
  caduc 必须在 phrase/sentence 里训练。
- 变体层：`/œ̃/` 合并、`/ɑ/` 保留/合并和地域 schwa 行为只能作为 profile-aware
  提示，不做全局硬判。
- 音频层：只有 exact same-unit local short clip 可点击；liaison、elision、
  enchaînement、schwa 规则和词尾静音不能做假单音 speaker。

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

## 代码落点清单

- `src/lib/language-sound-units/french.ts`: 给口元音、鼻化元音、前圆唇、glides、
  `/ʁ ʃ ʒ ɲ/`、liaison、enchaînement、elision、schwa/e caduc、词尾静音分别标层。
- `src/lib/language-phonology-inventory.ts`: `/œ̃/`、`/ɑ/`、loan `/ŋ/` 必须带
  variant/profile 说明，不写成全体 speaker 必修。
- `src/lib/language-feedback-rules.ts`: phrase/sentence feedback 必须显式处理
  liaison obligatory/optional/forbidden、enchaînement、elision、e caduc、节奏组。
- `src/lib/assessment-segment-audio.ts`: 规则类和无验证辅音不可点击；只能复用同一
  sound unit 的本地短音频。
- `src/__tests__/*french*` 与 audio policy 测试：锁住 nasal/front-rounded/glide
  对比、规则层不可点击、experimental 和 merge-aware `/œ̃/` 口径。

## Done Definition

法语达到 public experimental 标准时，用户能区分单音库存、对比、变体、短语规则和
韵律；AI feedback 不套英语 stress/rhotic 假设；所有可点击 speaker 都是 exact
same-unit local short clip，其余只显示分数或规则说明。
