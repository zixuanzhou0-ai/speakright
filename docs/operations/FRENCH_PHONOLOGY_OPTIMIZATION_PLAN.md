# French Phonology Optimization Plan

Status: alignment implementation plan
Language profile: `fr-FR`
Product status: experimental
Last updated: 2026-06-17

## 结论

法语有成熟 IPA 和外语发音教学体系。SpeakRight 不能把法语拆成一张孤立 IPA
按钮表，因为法语学习的核心不只在单音，还在鼻化元音、前圆唇元音、glide、词尾
静音、liaison、enchainement、elision、e caduc/schwa 和短语末突出。

正确答案是：法语要用"库存音位 + 短语规则 + 语流实现 + 韵律"四层模型。很多
辅音符号看起来和英语相同，例如 `/p t k f v s z m n l/`，但发音位置、送气、
释放、词尾行为、与元音/短语的关系都不等同于英语。相同 IPA 符号不等于可以直接
复用英语课程讲法或英语音频。

## 依据

- Fougeron and Smith, "French", `Journal of the International Phonetic
  Association`, 23(2), 73-76; also reprinted in the IPA Handbook:
  https://doi.org/10.1017/S0025100300004874
- `Handbook of the International Phonetic Association`, Cambridge University
  Press, 1999: https://www.internationalphoneticassociation.org/content/handbook-ipa
- PFC, `Phonologie du Francais Contemporain`, contemporary variation reference:
  https://www.projet-pfc.net/
- FLE/phonetics anchors: Pierre Leon, Pierre Fouche, Bernard Tranel, plus
  standard descriptions of liaison, enchainement, elision, e caduc and French
  prosody.
- 当前实现：
  `src/lib/language-sound-units/french.ts`,
  `src/lib/language-feedback-rules.ts`,
  `src/lib/local-language-assets.ts`,
  `src/__tests__/language-feedback-rules.test.ts`.

## 当前状态判断

当前 `FRENCH_PHONEMES` 是一个可继续打磨的 experimental 法语专属课程锚点层，
不能宣称 mastery 或完整 coverage。

已覆盖：

- 口元音和鼻化元音：`/i y u e ɛ ø œ ə o ɔ a ɑ̃ ɛ̃ ɔ̃ œ̃/`。
- 前圆唇重点：`/y ø œ ɥ/`。
- 小舌 `/ʁ/`，法语 `/ʃ/` 和 `/ʒ/`，`/ɲ/`，glides `/j ɥ w/`。
- 常见辅音课程锚点 `/p b t d k g f v s z m n l/`。
- 词尾静音、liaison、enchainement、elision、phrase-final prominence。
- feedback rules 已拆开 `french-liaison`, `french-enchainement`,
  `french-elision`, `french-schwa-e-caduc`，避免把不同机制混成一个建议。

仍不齐或不能宣称完成：

- 常见辅音锚点多数没有 verified short local header clip，scoring tile 应显示
  分数但不可点击。
- `/ɑ/` 应先作为 `/a/` 的高级/地区变体处理，不能在默认 `fr-FR` 里强行当必修。
- `/ŋ/` 主要出现在 loanwords，暂不应作为核心初学单元。
- `/œ̃/` 需要保留传统/对比说明，同时承认现代许多口音与 `/ɛ̃/` 合并。
- phrase/sentence IPA 必须继续审计 liaison、enchainement、elision、schwa 和词尾
  静音，不得靠拼写机械生成。

## 正确拆分模型

| 层 | 法语内容 | 产品处理 |
| --- | --- | --- |
| phoneme | 口元音、鼻化元音、核心辅音、`/ʁ ʃ ʒ ɲ/` | 主课程和诊断标签，可有 exact clip |
| glide | `/j ɥ w/` | 对比训练，尤其 `/ɥ/` vs `/w/` |
| variantPhoneme | `/œ̃/`, 可选 `/ɑ/`, loan `/ŋ/` | 显示变体/地区/寄存说明，谨慎评分 |
| phraseRule | liaison, final consonant silence, elision | 不做单音标 speaker，做短语/句子训练 |
| connectedSpeech | enchainement, e caduc/schwa 保留或脱落 | phrase/sentence feedback |
| prosody | rhythm group, phrase-final prominence | 句子级训练，不套英语词重音模型 |

## 修改计划

1. 数据模型
   - 法语 sound unit 必须能区分 `phoneme`, `glide`, `variantPhoneme`,
     `phraseRule`, `connectedSpeech`, `prosody`。
   - `fr-schwa` 需要双层说明：它既是 `/ə/` 这个教学目标，也是 e caduc 在语流中
     可保留、弱化或脱落的规则入口。

2. 课程内容
   - `/y ø œ ɥ/` 放在高优先级，明确"前舌位 + 圆唇"，避免退成 `/u o w/`。
   - 鼻化元音必须标注"鼻化元音，不加完整 /n/ 或 /ŋ/"。
   - `/ʁ/` 标注小舌目标，不等于英语 rhotic，也不等于西语 trill。
   - `ch = /ʃ/`, `j/soft g = /ʒ/`，不得写成英语 affricate `/tʃ dʒ/`。
   - `fr-final-consonant-silence` 要写"通常静音、liaison 可恢复、词汇例外存在"。

3. 短语规则
   - liaison: 潜在词尾辅音只在合适句法/语音环境中出现。
   - enchainement: 已经发出来的词尾辅音重新切到下一个元音开头词。
   - elision: 弱元音在元音前省略并常由撇号显示。
   - schwa/e caduc: 慢速/教学读法可出现，自然语流中依语速、地区和环境变化。
   - phrase-final prominence: 法语不是英语式每个内容词重读，而是节奏组末尾突出。

4. 音频策略
   - 只有 `/audio/language-assets/fr-FR/header-clips/*.m4a` 中 verified exact
     clip 才能让 scoring tile 可点击。
   - liaison、enchainement、elision、final consonant silence、phrase-final
     prominence 只能用短语/句子示范，不可显示成单音标小喇叭。
   - 常见辅音无 clip 时继续 score-only。
   - 不生成 ElevenLabs 法语音频，除非维护者明确确认。

5. 测试
   - `french-language-content.test.ts`: 锁定核心 inventory、前圆唇、鼻化元音、
     `/œ̃/` merge note、`/ʃ ʒ/` 非 affricate 说明。
   - `language-feedback-rules.test.ts`: 锁定 liaison、enchainement、elision、
     schwa/e caduc 分拆。
   - `assessment-segment-audio.test.ts`: phrase rule 和未验证辅音保持不可点击。
   - `non-english-ipa-audit.test.ts`: phrase/sentence 行不得退化成 stale
     word-boundary IPA。

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

## 法语完成目标

法语进入 public beta 的条件是：用户能区分单音库存、变体、短语规则和句子韵律；
AI feedback 不再套英语 stress/rhotic 习惯；所有可点击 speaker 都是同源本地短
clip；所有规则类 tile 都清楚显示为短语/句子规则，而不是假装成单音标。
