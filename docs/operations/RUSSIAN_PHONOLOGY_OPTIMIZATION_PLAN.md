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
把 `[ɐ ə ɪ]`、final devoicing、voicing assimilation、iotated vowels 和 clusters
放到词/短语/句子环境中处理。

## 权威依据

- Yanushevskaya and Buncic, "Russian", `Journal of the International Phonetic
  Association`, 45(2), 221-228:
  https://doi.org/10.1017/S0025100314000395
- Rogers and d'Archangeli, "Russian", earlier IPA illustration.
- International Phonetic Association, `Handbook of the International Phonetic
  Association`: https://www.internationalphoneticassociation.org/content/handbook-ipa
- Avanesov, `Russkoe literaturnoe proiznoshenie`; Jones and Ward,
  `The Phonetics of Russian`; Timberlake, `A Reference Grammar of Russian`。
- 当前实现入口：`src/lib/language-sound-units/russian.ts`,
  `src/lib/language-phonology-inventory.ts`,
  `src/lib/local-language-assets.ts`,
  `src/lib/assessment-segment-audio.ts`。

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

## Done Definition

俄语达到 public experimental 标准时，所有多音节例词可见重音；hard/soft 系统有
source-backed map；弱化、清化和同化按环境解释；规则类 tile 不播放假单音频；所有
可点击 speaker 都是 exact same-unit local short clip。
