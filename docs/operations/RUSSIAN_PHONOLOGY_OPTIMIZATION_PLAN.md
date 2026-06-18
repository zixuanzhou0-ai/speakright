# Russian Phonology Optimization Plan

Status: source-aligned implementation plan
Language profile: `ru-RU`
Product status: experimental
Last updated: 2026-06-18

## 核心判断

俄语有成熟 IPA 描写、正音传统和外语发音教学体系。SpeakRight 不能把俄语做成“英语
辅音列表 + 西里尔例词”。俄语必须 stress-first，并且 hard/soft-first：没有重音，
就不能可靠判断元音质量；没有腭化，就不能正确训练多数辅音；没有短语环境，就不能
诚实解释词尾清化、逆行清浊同化和辅音丛。

产品口径：俄语拆分不是“每个字母一个按钮”，也不是“每个弱化符号一个单音标”。课程
锚点层覆盖元音、learner-facing `/ɨ/`、硬辅音、常硬/常软和已有硬软对比；训练实现层
把 `[ɐ]`/`[ʌ]`、`[ə]`、`[ɪ]` 等弱化实现、final devoicing、voicing assimilation、
iotated vowels 和 clusters 放到词/短语/句子环境中处理。

## 明确答案

- 俄语有成熟 IPA/音系和正音体系；问题不是“俄语没有成熟音标”，而是俄语不能按英语
  辅音表或西里尔字母表逐项迁移。
- 当前俄语 inventory 是 stress-aware experimental 锚点层，方向正确，但 hard/soft
  pair、弱化、同化、cluster 和 exact short clips 不齐；不能宣称 mastery、
  evidenceMastery 或 full coverage。
- 俄语拆分必须 stress-first、hard/soft-first：先标重音，再判断元音弱化；先区分硬
  辅音和软辅音，再解释 `ь`、iotated vowels、词尾清化、逆行清浊同化和辅音丛。
- 看起来和英语一样的 `/p b t d k g f v s z m n l/` 也不能直接复用。俄语有硬/软、
  清浊同化、词尾清化、不同的 `/r x ɨ/` 和常硬/常软限制；硬音 exact clip 不等于软音
  或 pair lesson 已完成。
- 之前没有放进来的许多“拆解音标”属于环境实现或规则输出，例如 `[ɐ ə ɪ]`、清化结果、
  同化结果、软化 pair 和 cluster 训练；没有 exact same-unit clip 时只能 score-only
  或 rule-guidance-only。

## 权威来源与本轮查证结论

本轮查证使用了 JIPA/IPA illustration、Vinogradov Institute/Ruslang 官方入口、
Gramota 俄语正音词典入口线索和 IPA Handbook。结论：俄语有成熟 IPA 描写和正音体系；
产品不能把俄语拆成英语辅音表。俄语必须先处理重音、弱化和硬软，再谈单音播放。

2026-06-18 实时复核再次确认：Yanushevskaya/Buncic 的 Russian IPA illustration 和
俄语正音传统都把重音、元音弱化、硬/软辅音、词尾清化、逆行清浊同化放在核心位置。
因此俄语的产品拆分必须 stress-first、hard/soft-first；硬音 exact clip 不能代表软音、
弱化输出或同化规则。

- Yanushevskaya and Buncic, "Russian", `Journal of the International Phonetic
  Association`, 45(2), 221-228:
  https://doi.org/10.1017/S0025100314000395
  - 确认现代俄语 IPA illustration 的核心：重音、元音弱化、硬/软辅音对立、词尾清化
    和逆行清浊同化。
  - 对产品的约束：`[ɐ]`/`[ʌ]`、`[ə]`、`[ɪ]` 是重音、口音 profile 和环境驱动的实现，
    不是独立“已掌握音素”。
  - 对产品的约束：软辅音 `[Cʲ]` 不能解释成硬辅音 + 完整 `/j/`。
- V. V. Vinogradov Russian Language Institute: https://ruslang.ru/
  - 是俄语规范、词典和语文研究的重要官方机构入口。
  - 对产品的约束：stressText、正音变体和争议词必须走词典/正音来源，不靠直觉补写。
- Gramota.ru dictionary entry for `Bolshoy Orthoepic Dictionary`:
  https://gramota.ru/slovari/bolshoy-orfoepicheskiy-slovar-russkogo-yazyka
  - 本轮批量读取未能完整抓取页面内容，但搜索结果确认其为俄语正音词典入口。
  - 对产品的约束：它可作为后续逐词 stress/orthoepy 复核入口；不能把未读到的页面内容
    当作具体 IPA 规则证据。
- Rogers and d'Archangeli, "Russian", earlier IPA illustration; Avanesov,
  `Russkoe literaturnoe proiznoshenie`; Jones and Ward, `The Phonetics of
  Russian`; Timberlake, `A Reference Grammar of Russian`。
  - 作为二级/背景来源，用来交叉确认 Moscow/St. Petersburg 和传统正音差异。
- International Phonetic Association, `Handbook of the International Phonetic
  Association`: https://www.internationalphoneticassociation.org/content/handbook-ipa
  - 提供 IPA illustration 的共同标注框架。
- 当前实现入口：`src/lib/language-sound-units/russian.ts`,
  `src/lib/language-phonology-inventory.ts`,
  `src/lib/local-language-assets.ts`,
  `src/lib/assessment-segment-audio.ts`。

## 证据等级与实现约束

| 等级 | 可用于什么 | 本计划如何使用 |
| --- | --- | --- |
| A: IPA/JIPA illustration | 决定核心音系、hard/soft、stress/reduction、assimilation 边界 | Yanushevskaya/Buncic 约束现代俄语 IPA 描写，同时提醒 St. Petersburg/Moscow profile 差异 |
| A: 官方/正音机构 | 决定逐词重音、规范变体和争议读音的复核入口 | Vinogradov Institute、Gramota/正音词典入口用于后续 stressText 和正音 variant 审计 |
| B: 参考语法/传统正音研究 | 交叉验证规则说明和学习顺序 | Avanesov、Jones/Ward、Timberlake 等只作为二级交叉证据，不单独硬改 needs-review |
| C: 当前代码/本地资产 | 决定 UI 是否可点击、测试覆盖和缺口列表 | 只有本仓库 verified exact local short clip 能让 speaker 可点击；硬音 clip 不能代表软音 |

落地原则：俄语所有多音节例词先看重音，再谈弱化；所有辅音先看硬软，再谈 IPA 对齐。
弱化、清化、同化和 cluster 是环境输出，不能反过来做成孤立“单音标已完成”。

## 正确拆分答案

俄语应采用“重音优先 + 硬软优先 + 规则环境”的模型：

- 课程锚点：`/a o i ɨ u e/`、硬辅音、常硬/常软、`/r x ts tɕ ɕː j/` 和核心
  hard/soft pair。
- 对比层：硬/软 pair 是独立训练目标；软辅音是 palatalized consonant，不是额外加
  `/j/`。
- 实现层：`[ɐ ə ɪ]`、清化输出、位置性软化要依赖词重音和上下文。
- 规则层：iotated vowels、`ь`、词尾清化、逆行清浊同化和 clusters 放到词/短语/句子
  训练里。
- 音频层：硬音 exact clip 不能代表软音；弱化、清化、同化和 cluster 没有 exact
  same-unit clip 时只显示分数/规则，不播放假单音。

## 当前覆盖结论

当前 `RUSSIAN_PHONEMES` 是 stress-aware experimental 锚点层，方向正确，但不是完整
俄语音系产品。

已进入课程/诊断模型的内容：

- 元音目标 `/a o i ɨ u e/`，并包含重音/弱化说明。
- learner-facing `/ɨ/`，即使理论音位地位可讨论，也必须作为学习者独立听辨/发音目标。
- source-backed 硬辅音 exact anchors：`/p b t d k g f v s z m n l ʂ ʐ/`。
- `/r/`、`/x/`、`/ts/`、`/tɕ/`、`/ɕː/`、`/j/`。
- 常硬/常软目标，如 `/ʂ ʐ ts/`、`/tɕ ɕː j/`。
- 硬/软系统、软 `/tʲ dʲ/`、软 `/sʲ zʲ/`、软响音、软唇音、软音符号、
  iotated vowels。
- 多组 hard/soft pair 锚点。
- stress/reduction、unstressed `o/a`、unstressed `e/ya`、final devoicing、
  voicing assimilation、clusters。

仍不能宣称完成的内容：

- 很多 hard/soft pair 仍是 score-only contrast anchor；硬音 exact clip 不等于软音
  或 pair lesson 已完成。
- `[ɐ ə ɪ]` 是弱化实现，不是独立已掌握音素 tile。
- `/ʐ/`、软辅音、弱化、同化、clusters 不能借相近硬音、视频或规则讲解冒充可点击音频。
- 完整俄语辅音 map 还需要 source-backed pair coverage 和已验证例词。
- 所有多音节俄语例词必须显示 `stressText`，否则训练不可信。

生成的完整 inventory 表见
[`RUSSIAN_PHONOLOGY_INVENTORY_TABLE.md`](./RUSSIAN_PHONOLOGY_INVENTORY_TABLE.md)。

## 母语者学习方式到产品模型

俄语学习者通常先学字母和重音，再学硬软对立、元音弱化、清浊变化和辅音丛。对产品
来说，最重要的不是把所有 IPA 符号平铺成 tile，而是让每个评分目标知道自己属于哪一层：
稳定音位、硬软对比、位置性实现、语流规则还是韵律。

| 层 | 俄语内容 | 产品处理 |
| --- | --- | --- |
| phoneme | 重读元音、learner `/ɨ/`、硬辅音 exact anchors、`/r x ts tɕ ɕː j/` | 课程和诊断标签 |
| contrast | 硬/软 pair、常硬/常软、软音符号 | pair drill；无 exact clip 时 score-only |
| allophone/realization | `[ɐ ə ɪ]`、位置性元音质量、清化输出 | 词/短语实现说明 |
| connected-speech rule | iotated vowels、词尾清化、逆行清浊同化、clusters | 短语/句子反馈 |
| prosody | 词重音和弱化依赖 | 俄语第一优先级反馈信号 |

## 具体拆分规则

1. 重音先行：所有多音节例词必须有 `stressText`；没有重音就不判断元音弱化。
2. 元音：`/a o i ɨ u e/` 作为教学锚点；`[ɐ ə ɪ]` 是非重读实现，不做独立单音 speaker。
3. `/ɨ/`：保留 learner-facing 目标，因为它和 `/i/` 的产出差异对学习者很关键。
4. 硬软：软辅音是 palatalized consonant，不是硬辅音 + 完整 `/j/`。
5. `ь`：前一辅音软化标记，不是独立元音或独立音节。
6. `я/е/ё/ю`：词首、元音后、`ь/ъ` 后常带 `/j/`；辅音后主要标记软化加元音。
7. 弱化：非重读 `о/а`、`е/я` 的实现受重音距离和前一辅音硬软影响。
8. 词尾清化：只按停顿、词尾、清辅音前等环境解释，不能跨每个词边界机械清化。
9. 清浊同化：以逆行为主，同时保留 `/v/` 的特殊行为。
10. clusters：保留辅音序列，不自动插入汉语式过渡元音。

## 修改计划

1. Inventory 与数据层
   - 继续维护 `language-phonology-inventory.ts`，每行都有 IPA、层级、source refs、
     audio status、tile policy、aliases 和 gaps。
   - `ь` 归入 hard/soft contrast；`я/е/ё/ю`、clusters、清化、同化归入语流/规则。
   - 建立 source-backed hard/soft pair table：例词、重音、assessment aliases、
     audio status、known gaps。

2. UI 与中文文案
   - 卡片上清楚显示“音位/硬软对比/实现/语流规则/重音韵律”。
   - 所有多音节例词显示重音，避免用户按西里尔拼写逐字读。
   - 对软辅音提示“舌面抬向硬腭”，避免误导为额外 `/j/`。

3. 内容审计
   - 复查所有俄语词、短语、句子的 stressText、IPA、弱化、软硬、词尾清化、
     清浊同化和跨词边界。
   - 优先补 hard/soft minimal pairs、`/ɨ i/`、常硬/常软、清化/复浊对比。
   - `needs-review` 行按证据流程处理。

4. 音频策略
   - 只有 `/audio/language-assets/ru-RU/header-clips/` 中 verified exact local
     short clip 能让 tile 可点击。
   - hard/soft pair、弱化输出、清化、同化、clusters 默认 score-only 或
     rule-guidance-only，除非有 exact same-unit clip。
   - Seeing Speech 或其他视觉材料只能作为 reference/proxy，不能替代 exact clip。
   - 整词、句子、字典 fallback、生成 TTS、视频轨和规则讲解都不能替代单音频。
   - 未经明确确认，不生成 ElevenLabs 或付费 provider 俄语音频。

5. 测试与验收
   - `russian-language-content.test.ts` 锁定 hard/soft pair、stressText、常硬/常软、
     palatalization 口径、experimental 口径。
   - `language-phonology-inventory.test.ts` 锁定层级、source refs、audio status、
     tile policy。
   - `assessment-segment-audio.test.ts` 锁定弱化符号、软音 aliases、清化、同化、
     clusters 无 exact clip 不可点击。
   - `azure-phoneme-map-language-parity.test.ts` 锁定 aliases 可评分，音频可为 null。
   - `language-feedback-rules.test.ts` 锁定重音、弱化、硬软、清化、同化、clusters
     分开。
   - 稳定后只用 Release EXE gates 验收。

## 代码落点清单

- `src/lib/language-sound-units/russian.ts`: 给元音、`/ɨ/`、硬辅音、软辅音、
  hard/soft pair、常硬/常软、`ь`、iotated vowels、弱化、清化、同化和 clusters 标层。
- `src/lib/language-phonology-inventory.ts`: 每个俄语 unit 必须有 stress requirement、
  source refs、audio status、tile policy、aliases、known gaps；多音节词没有
  `stressText` 不得作为稳定例词。
- `src/lib/language-feedback-rules.ts`: feedback 先指出重音/弱化，再指出硬软、
  final devoicing、regressive voicing assimilation、cluster 插元音风险。
- `src/lib/assessment-segment-audio.ts`: 硬音、软音、pair lesson 不能互相借 speaker；
  弱化符号和规则输出默认 score-only/rule-guidance-only。
- `src/__tests__/*russian*` 与 audio policy 测试：锁住 stress-first、hard/soft-first、
  `[ɐ]`/`[ʌ]` profile-aware 口径、不可点击规则和 experimental 状态。

## Done Definition

俄语达到 public experimental 标准时，所有多音节例词可见重音；hard/soft 系统有
source-backed map；弱化、清化和同化按环境解释；规则类 tile 不播放假单音频；所有
可点击 speaker 都是 exact same-unit local short clip。
