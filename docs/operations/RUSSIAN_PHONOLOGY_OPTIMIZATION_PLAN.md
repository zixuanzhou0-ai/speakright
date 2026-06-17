# Russian Phonology Optimization Plan

Status: source-aligned implementation plan
Language profile: `ru-RU`
Product status: experimental
Last updated: 2026-06-18

## 结论

俄语有成熟 IPA 描写、正音传统和外语发音教学体系。SpeakRight 不能把俄语做成"英语
辅音列表 + 西里尔例词"。俄语必须 stress-first，并且 hard/soft-first。

没有重音，就不能可靠判断元音质量；没有腭化，就不能正确训练多数辅音；没有短语环境，
就不能诚实解释词尾清化和逆行清浊同化。`/ɨ/` 的音位地位在理论上可讨论，但对学习者
必须保留为独立听辨/发音目标，因为它和 `/i/` 的产出差异非常关键。

## 权威依据

- Yanushevskaya and Buncic, "Russian", `Journal of the International Phonetic
  Association`, 45(2), 221-228:
  https://doi.org/10.1017/S0025100314000395
- Rogers and d'Archangeli, "Russian", earlier IPA illustration.
- International Phonetic Association, `Handbook of the International Phonetic
  Association`: https://www.internationalphoneticassociation.org/content/handbook-ipa
- Avanesov, `Russkoe literaturnoe proiznoshenie`; Jones and Ward,
  `The Phonetics of Russian`; Timberlake, `A Reference Grammar of Russian`。
- University of Iowa, Sounds of Speech Russian:
  https://soundsofspeech.uiowa.edu/russian
- 当前实现：`src/lib/language-sound-units/russian.ts`,
  `src/lib/language-phonology-inventory.ts`,
  `src/lib/local-language-assets.ts`,
  `src/lib/assessment-segment-audio.ts`。

## 当前产品状态

当前 `RUSSIAN_PHONEMES` 是 stress-aware experimental 锚点层，方向正确，但不是完整
俄语音系产品。

已覆盖：

- 元音目标 `/a o i ɨ u e/`，并包含重音/弱化说明。
- learner-facing `/ɨ/`。
- source-backed 硬辅音 exact anchors：`/p b t d k g f v s z m n l ʂ ʐ/`。
- `/r/`、`/x/`、`/ts/`、`/tɕ/`、`/ɕː/`、`/j/`。
- 常硬/常软目标，如 `/ʂ ʐ ts/`、`/tɕ ɕː j/`。
- 硬/软系统、软 `/tʲ dʲ/`、软 `/sʲ zʲ/`、软响音、软唇音、软音符号、
  iotated vowels。
- 多组硬软 pair 锚点。
- stress/reduction、unstressed `o/a`、unstressed `e/ya`、final devoicing、
  voicing assimilation、clusters。

仍未完成：

- 很多硬软 pair 仍是 score-only contrast anchor；硬音 exact clip 不等于软音或 pair
  lesson 已完成。
- `[ɐ ə ɪ]` 是弱化实现，不是独立已掌握音素 tile。
- `/ʐ/` 不能借 `/ʂ/` 音频或规则说明冒充可点击音频。
- 完整俄语辅音 map 还需要 source-backed pair coverage 和已验证例词。
- 所有多音节俄语例词必须显示 `stressText`，否则训练不可信。

## 正确拆分模型

| 层 | 俄语内容 | 产品处理 |
| --- | --- | --- |
| phoneme | 重读元音、learner `/ɨ/`、`/p b t d k g f v s z m n l ʂ ʐ/`、`/r x ts tɕ ɕː j/`、已有 exact 单音锚点 | 课程和诊断标签 |
| contrast | 硬/软 pair、常硬/常软、软音符号 | pair drill；无 exact clip 时 score-only |
| allophone/realization | `[ɐ ə ɪ]`、位置性元音质量、清化输出 | 词/短语实现说明 |
| connected-speech rule | iotated vowels、词尾清化、逆行清浊同化、clusters | 短语/句子反馈 |
| prosody | 词重音和弱化依赖 | 俄语第一优先级反馈信号 |

## 修改计划

1. Inventory 与 UI
   - 保持俄语 experimental。
   - 实现层只收敛为 phoneme、allophone/realization、contrast、
     connected-speech rule、prosody。
   - `ь` 归入硬软 contrast；`я/е/ё/ю`、clusters、清化、同化归入语流/规则。
   - 建立 source-backed hard/soft pair table：例词、重音、assessment aliases、
     audio status、known gaps。

2. 课程内容
   - 所有多音节俄语例词必须有 `stressText`。
   - `/ɨ/` 保持 learner-facing，同时说明理论边界。
   - 软辅音是 palatalized consonant，不是硬辅音 + 完整 `/j/`。
   - `ь` 是前一辅音软化标记，不是独立音节。
   - `я/е/ё/ю` 按位置解释：词首/元音后/符号后可带 `/j/`；辅音后主要标记软化加元音。

3. 词、短语、句子规则
   - 先找重音，再判断元音弱化。
   - 非重读 `о/а`、`е/я` 的实现受重音和前一辅音硬软影响。
   - final devoicing 只按停顿、词尾、清辅音前等环境解释，不能跨每个词边界机械清化。
   - voicing assimilation 以逆行为主，同时保留 `/v/` 特殊行为。
   - clusters 训练为辅音序列，不能自动插入过渡元音。

4. 音频策略
   - 只有 `/audio/language-assets/ru-RU/header-clips/` 中 verified exact local
     short clip 能让 tile 可点击。
   - 硬软 pair、弱化输出、清化、同化、clusters 默认 score-only，除非有 exact clip。
   - Seeing Speech 或其他视觉材料只能作为 reference/proxy，除非明确映射为 exact clip。
   - 整词、句子、字典 fallback、生成 TTS、视频轨和规则讲解都不能替代单音频。
   - 未经明确确认，不生成 ElevenLabs 或付费 provider 俄语音频。

5. 测试
   - `russian-language-content.test.ts`：硬软 pair、stressText、常硬/常软、
     palatalization 口径、experimental 口径。
   - `language-phonology-inventory.test.ts`：层级、source refs、audio status、
     tile policy。
   - `assessment-segment-audio.test.ts`：弱化符号、软音 aliases、清化、同化、clusters
     无 exact clip 不可点击。
   - `azure-phoneme-map-language-parity.test.ts`：aliases 可评分，音频可为 null。
   - `language-feedback-rules.test.ts`：重音、弱化、硬软、清化、同化、clusters 分开。

## Done Definition

俄语达到 public experimental 标准时，所有多音节例词可见重音；硬软系统有 source-backed
map；弱化和同化按环境解释；规则类 tile 不播放假单音频。
