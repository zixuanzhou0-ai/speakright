# Spanish Phonology Optimization Plan

Status: alignment implementation plan
Language profile: `es-ES`
Product status: experimental
Last updated: 2026-06-17

## 结论

西班牙语有成熟、稳定、可用 IPA 描写体系。SpeakRight 现在的问题不是
"西语没有音标"，而是不能把英语产品里的"每个 IPA tile = 一个孤立发音按钮 =
一个可直接评分的音素"模型照搬过来。

正确答案是：西语主课程继续 phoneme-first，但训练实现层必须把音位、变体、语流
实现和韵律拆开。尤其是 `/b d g/`，它们在学习产品里应该是同一音位的不同实现：
停顿后、鼻音后，`/d/` 还包括 `/l/` 后，常见塞音实现为 `[b d g]`；元音间和多数
连续语流中弱化为近音 `[β̞ ð̞ ɣ̞]`。这些不是英语 `/v/`、`/ð/`、`/g/` 的直接搬运。

## 依据

- RAE/ASALE, `Nueva gramatica de la lengua espanola: Fonetica y fonologia`
  (2011): https://www.rae.es/obras-academicas/gramatica/nueva-gramatica-de-la-lengua-espanola
- Martinez-Celdran, Fernandez-Planas, Carrera-Sabate, "Castilian Spanish",
  `Journal of the International Phonetic Association`, 33(2), 255-259:
  https://doi.org/10.1017/S0025100303001373
- `Handbook of the International Phonetic Association`, Cambridge University
  Press, 1999: https://www.internationalphoneticassociation.org/content/handbook-ipa
- 当前实现：
  `src/lib/language-sound-units/spanish.ts`,
  `src/lib/local-language-assets.ts`,
  `src/lib/assessment-segment-audio.ts`,
  `src/__tests__/assessment-segment-audio.test.ts`.

## 当前状态判断

当前 `SPANISH_PHONEMES` 是一个可继续打磨的 experimental 课程锚点层，不能宣称
mastery 或完整 evidenceMastery。

已覆盖：

- 五个稳定单元音 `/a e i o u/`。
- 常见清塞音和普通辅音锚点 `/p t k f m n l s/`。
- Castilian `es-ES` 目标里的 `/θ/`、`/x/`、`/ɲ/`、`/tʃ/`、`/ʝ/`。
- 西语强关键对比 `/ɾ/` vs `/r/`。
- `/b d g/` 的停顿/鼻音位置塞音锚点：`es-b-stop`, `es-d-stop`, `es-g-stop`。
- `/b d g/` 的语流近音实现：`es-bv`, `es-d`, `es-g`。
- 双元音 glide `/j w/`、鼻音位置同化、词重音、音节节奏。

仍不齐或不能宣称完成：

- `/p t k f m n b d g/` 等普通锚点虽已进课程和评分，但多数没有 verified short
  local header clip，右侧 scoring tile 必须保持不可点击。
- `/ʎ/` 目前只能作为 `yeismo`/地区变体说明，不能在 `es-ES` 默认 profile 中当作
  全局必修错误项。
- 拉美 `seseo`、不同地区 `yeismo`、/s/ 变体需要未来 dialect/profile 开关，不能
  混进 Castilian baseline。
- 词、短语、句子的 IPA 仍需持续审计，`needs-review` 行不得凭直觉硬改。

## 正确拆分模型

| 层 | 西语内容 | 产品处理 |
| --- | --- | --- |
| phoneme | `/a e i o u p t k b d g f s θ x tʃ m n ɲ l ɾ r ʝ/` | 主音标列表、诊断标签、可评分单位 |
| allophone/realization | `[β̞ ð̞ ɣ̞]`, 鼻音位置变化 `[m n ɲ ŋ]` | 训练层解释上下文，不宣称独立 mastery |
| dialect | Castilian `/θ/`, `seseo`, `yeismo`, `/ʎ/` 保留 | profile/变体说明，不能直接判错 |
| connected speech | 双元音 `/j w/`, 跨词连读、鼻音同化 | 词/短语/句子层训练，不冒充单音标音频 |
| prosody | 词重音、音节节奏、稳定非重读元音 | word/sentence drill 和反馈 |

## 修改计划

1. 数据模型
   - 为非英语 sound unit 增加或等价表达 `soundUnitLayer`：
     `phoneme`, `realization`, `contrast`, `connectedSpeech`, `prosody`,
     `dialectVariant`。
   - 若第一轮不改类型，先用 `soundUnitType`, `notes`, `isProxyForAssessment`
     和测试锁住同样边界。

2. 课程内容
   - 保持五元音短、纯、稳定，避免英语 `/eɪ/`, `/oʊ/`, `/iː/`, `/uː/` 迁移。
   - `/p t k/` 标注"少送气"，`/t d/` 标注 dental/denti-alveolar 倾向。
   - `/b d g/` 每个音位拆成"音位锚点 + 近音实现 + 例词上下文"。
   - `/ɾ/` 和 `/r/` 保持强对比；不要用英语 r 作为参考。
   - Castilian `/θ/` 明确为 `es-ES` profile 目标；拉美 `seseo` 写入变体说明。

3. 示例与训练
   - 增加 `papa/papa`, `hablo/hablo`, `camino/camino` 等重音对比。
   - 双元音和鼻音同化只在 word/phrase/sentence 层训练。
   - 每条短语和句子要说明它训练的是音位、实现、重音还是语流。

4. 音频策略
   - scoring tile 只有在存在同一 sound unit 的短本地 header clip 时可点击。
   - `[β ð ɣ]` 音频不得映射到 plain `/b d g/` 停顿位置锚点。
   - 不用视频音频、整词整句、字典 fallback、规则讲解或生成 TTS 冒充单音标。
   - 不生成 ElevenLabs 音频，除非维护者明确确认。

5. 测试
   - `spanish-language-content.test.ts`: 锁定核心 inventory、`/b d g/` 双层说明、
     Castilian `/θ/` profile 口径。
   - `assessment-segment-audio.test.ts`: 锁定普通锚点无 clip 时不可点击，
     `[β ð ɣ]` 不冒充 `/b d g/`。
   - `non-english-ipa-audit.test.ts`: 保持西语转写 phoneme-first，同时允许实现层
     显示 `[β ð ɣ]`。

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

## 西语完成目标

西语进入 public beta 的条件不是"每个符号都有按钮"，而是用户能清楚区分：
音位、语流实现、方言变体、重音和节奏。所有可点击声音都必须是真实、短、同源的
本地目标音频；所有无验证音频的 tile 只能显示分数或教学说明，不能播放冒充音频。
