# Russian Phonology Optimization Plan

Status: alignment implementation plan
Language profile: `ru-RU`
Product status: experimental
Last updated: 2026-06-17

## 结论

俄语有成熟 IPA 描写、正音传统和外语教学体系。SpeakRight 不能把俄语拆成英语式
"普通辅音列表"，因为俄语学习的核心是重音、元音弱化、硬/软辅音系统、常硬/常软
音、词尾清化、清浊同化和复杂辅音丛。

正确答案是：俄语必须 stress-first。没有重音，就不能可靠判断元音质量；没有硬软
系统，就不能正确训练大部分辅音；没有跨词环境，就不能正确解释 final devoicing
和 voicing assimilation。`/ɨ/` 是否作为独立音位在理论上可讨论，但对学习者必须
作为独立听辨/发音目标，因为它和 `/i/` 的产出差异非常关键。

## 依据

- Yanushevskaya and Buncic, "Russian", `Journal of the International Phonetic
  Association`, 45(2), 221-228:
  https://doi.org/10.1017/S0025100314000395
- Rogers and d'Archangeli, "Russian", earlier JIPA IPA illustration.
- `Handbook of the International Phonetic Association`, Cambridge University
  Press, 1999: https://www.internationalphoneticassociation.org/content/handbook-ipa
- Russian orthoepy/phonology anchors: Avanesov, `Russkoe literaturnoe
  proiznoshenie`; Jones and Ward, `The Phonetics of Russian`; Timberlake,
  `A Reference Grammar of Russian`; Moscow/St. Petersburg standard descriptions.
- 当前实现：
  `src/lib/language-sound-units/russian.ts`,
  `src/lib/local-language-assets.ts`,
  `src/lib/assessment-segment-audio.ts`,
  `src/__tests__/russian-language-content.test.ts`.

## 当前状态判断

当前 `RUSSIAN_PHONEMES` 是一个 stress-aware 的 experimental 课程锚点层，方向对，
但不能宣称完整俄语音系或 mastery。

已覆盖：

- 元音目标 `/a o i ɨ u e/`，并在说明中强调重音和弱化。
- learner-facing `/ɨ/`。
- `/r/`, `/x/`, `/ts/`, `/tɕ/`, `/ɕː/`, `/j/`。
- 常硬/常软和特殊音：`/ʂ ʐ/`, `/ts/`, `/tɕ/`, `/ɕː/`, `/j/`。
- 硬/软系统入口：`ru-hard-soft`, `ru-soft-t-d`, `ru-soft-s-z`,
  `ru-soft-n-l-r`, `ru-soft-labials`, `ru-soft-sign`, `ru-iotated-vowels`。
- 独立硬软 pair 锚点：`ru-t-tj`, `ru-d-dj`, `ru-s-sj`, `ru-z-zj`,
  `ru-n-nj`, `ru-l-lj`, `ru-r-rj`, `ru-p-pj`, `ru-b-bj`, `ru-m-mj`,
  `ru-f-fj`, `ru-v-vj`, `ru-k-kj`, `ru-g-gj`, `ru-x-xj`。
- 规则层：stress/reduction、unstressed `o/a`、unstressed `e/ya`、
  final devoicing、voicing assimilation、clusters。

仍不齐或不能宣称完成：

- 这些硬软 pair 多数是 score-only contrast anchors，没有 verified short local
  single-segment clip。
- `[ɐ ə ɪ]` 是弱化实现，不应作为独立已掌握音素 tile。
- `/ʐ/` 暂无 exact header clip，不能用 `/ʂ/` 或规则说明冒充。
- 俄语完整辅音体系和所有最小对立仍需更细 source-backed pair map。
- 所有多音节俄语例词必须保留 `stressText` 或明确重音，不然训练不可信。

## 正确拆分模型

| 层 | 俄语内容 | 产品处理 |
| --- | --- | --- |
| phoneme | `/a o u e i ɨ r x ts tɕ ɕː j/` 等 learner targets | 主课程和诊断标签 |
| hardSoftPair | `/t tʲ/`, `/d dʲ/`, `/s sʲ/`, labials, velars 等 | 对比卡和 pair drill，默认 score-only |
| unpairedConsonant | always hard `/ʂ ʐ ts/`, always soft `/tɕ ɕː j/` | 单独标注，不套普通硬软规则 |
| orthographicRule | `ь`, `я/е/ё/ю` | 拼写到发音规则，不是单独元音/音节 |
| reductionRule | unstressed `о/а`, `е/я` -> `[ɐ ə ɪ]` 等 | word-level implementation |
| connectedSpeechRule | final devoicing, regressive voicing assimilation | phrase/sentence feedback |
| cluster | `встреча`, `здравствуйте`, `текст` | 慢到快的词/短语训练 |

## 修改计划

1. 数据模型
   - 为俄语加入最严格的 layer 区分：`phoneme`, `hardSoftPair`,
     `unpairedConsonant`, `orthographicRule`, `reductionRule`,
     `connectedSpeechRule`, `cluster`, `prosody`。
   - 建立 source-backed hard/soft pair table，记录每个 pair 的例词、重音、是否
     learner-facing、是否有 exact audio。

2. 课程内容
   - 俄语所有多音节例词必须带 `stressText`。
   - `/ɨ/` 保持独立学习目标，但文档标注理论争议，避免过度宣称。
   - 软辅音解释为 palatalization，不写成"硬辅音 + 完整 /j/"。
   - `ь` 是前一辅音软化标记，不是独立音节。
   - `я/е/ё/ю` 按位置解释：词首/元音后/符号后可有 `/j/`，辅音后常软化前辅音。

3. 规则和短语
   - 弱化先找重音，再解释 `о/а` 和 `е/я` 的实现。
   - final devoicing 只在停顿、词尾、清辅音前等环境解释，跨词到浊音、响音、元音
     时要另行处理。
   - voicing assimilation 以 regressiveness 为核心，同时保留 `/v/` 的特殊说明。
   - clusters 不允许自动插入元音，训练从慢速保留每个辅音到自然速度。

4. 音频策略
   - 只有 verified `/audio/language-assets/ru-RU/header-clips/*.m4a` 同源短 clip
     可点击。
   - 硬软 pair、弱化、词尾清化、清浊同化、clusters 默认 score-only。
   - Seeing Speech 或其他视频素材只能标为 reference/proxy，不能当 exact audio。
   - 整词、句子、字典或生成 TTS 不得冒充单音标。
   - 不生成 ElevenLabs 俄语音频，除非维护者明确确认。

5. 测试
   - `russian-language-content.test.ts`: 锁定硬软 pair、stressText、常硬/常软、
     palatalization 口径。
   - `assessment-segment-audio.test.ts`: `[ɐ ə ɪ]`, palatalized aliases,
     final devoicing, cluster 保持不可点击，除非以后有 exact clip。
   - `azure-phoneme-map-language-parity.test.ts`: pair aliases 可评分，但音频为 null。
   - `language-feedback-rules.test.ts`: feedback 覆盖重音、弱化、硬软、清化、同化、
     clusters。

## 验收

稳定改动后只用 Release EXE 验收：

```bat
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:desktop-frontend
npm.cmd run desktop:preflight
npm.cmd run desktop:ui-smoke
npm.cmd run desktop:launch-release
```

可选音频 dry-run：

```bat
npm.cmd run audio:parity:dry-run
npm.cmd run audio:loudness:dry-run
```

## 俄语完成目标

俄语进入 public beta 的条件是：source-backed hard/soft map 完成，所有多音节内容
可见重音，弱化和清浊规则都按词/短语环境解释；规则类 tile 不播放假单音频；用户
能看出哪些是音素、哪些是硬软 pair、哪些是弱化或语流规则。
