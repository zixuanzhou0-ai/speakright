# SpeakRight Desktop IPA Display And Audit Strategy

Last updated: 2026-06-14

## Current Decision

Use a two-layer IPA policy for Spanish, French, and Russian:

- Layer 1: the stable course anchor, usually the official phoneme or dictionary pronunciation.
- Layer 2: the learner-facing training realization, used when context changes what the learner should actually say.

Do not collapse these into a single always-official or always-narrow IPA line. The UI should make the layer explicit with labels such as `音位`, `词典发音`, `实际发音`, `短语发音`, `语流`, and `地区变体`.

## Language Policy

Spanish `es-ES`:

- Main course layer is phoneme-first Castilian Spanish.
- Keep `/θ/` as valid for `ce/ci/z` in the `es-ES` course.
- Use yeismo as the default learner target.
- Show `[β ð ɣ]` as realization/allophone guidance where useful, but do not pretend these are independent main course phonemes unless the unit is explicitly training that realization.
- Stress and syllable rhythm units should focus on stress placement and rhythm, not on inventing extra clickable single-phoneme audio.

2026-06-14 applied audit result:

- The final learner-facing Spanish keyword IPA is normalized to the phoneme
  layer for `/b d g/`; keyword IPA should not expose `[β ð ɣ]` as the default
  main display.
- Spanish `/b/ -> [β]`, `/d/ -> [ð]`, and `/g/ -> [ɣ]` units may still teach the
  allophone realization in labels, descriptions, assessment aliases, and exact
  header clips.
- Right-side scoring tiles may still map recognized `[β ð ɣ]` segments to their
  verified exact local header clips, but word cards should remain phoneme-first.

French `fr-FR`:

- Word cards should show dictionary-style pronunciation.
- Phrase and sentence cards may show connected-speech realization when liaison, enchainement, elision, schwa, or final-consonant behavior changes what the learner should say.
- Rule units are training rules, not exact single-phoneme audio sources.

2026-06-14 applied audit result:

- High-risk phrase rows now use connected-speech display for enchainement where
  the learner should not pause at the written word boundary:
  `l'homme écoute` -> `/lɔmekut/`, `l'école ouvre` -> `/lekɔluvʁ/`, and
  `d'accord avec elle` remains `/dakɔʁ avɛkɛl/`.
- Schwa-sensitive variants such as `petit ami` remain a follow-up UI/design
  task. They should be represented as careful-anchor plus natural-speech
  variants rather than forced into one narrow answer.

Russian `ru-RU`:

- Stress and broad training realization must be visible because spelling-only or abstract phoneme-only display hides vowel reduction, palatalization, devoicing, and assimilation.
- A lexical/phoneme layer may be secondary, but the learner-facing line must tell the user what to pronounce.
- Stress marks are required for ambiguous or training-critical words.

2026-06-14 applied audit result:

- High-risk phrase rows now preserve/restore voiced obstruents before voiced,
  sonorant, or vowel-onset words in broad connected-speech display:
  `Сад зимой синий.`, `друг дома`, `город большой`, `нож острый`, `снег идёт`,
  `класс большой`, and `хлеб на кухне`.
- `поезд идёт` remains `needs-review`; do not force it to a single answer until
  a direct正音/source confirmation is available for the course standard.
- Some deck sentence entries intentionally use compact focus hints such as
  `/s sʲ zʲ/` instead of full sentence IPA. Future audit exports should treat
  those as `focus-hint`, not as a full `recommendedIpa` candidate.

## Scoring Alignment

Use `phoneme alignment, realization judgment`:

- First align the recognized segment to the expected phoneme or slot.
- Then judge whether the realization is acceptable in this word or phrase context.
- Regional or normative variants should not be marked as hard errors when they are accepted for the selected course standard.
- Low-confidence evidence should be phrased as a practice suggestion, not as a definitive failure.

For right-side assessment tiles:

- A clickable IPA tile must play the same exact local header clip used by the matching left-side/detail sound unit.
- If there is no exact local sound-unit clip, the tile remains visible but not clickable.
- Do not use word-example audio, rule audio, proxy audio, video audio, or long explanation audio for a single IPA tile.

## Audit Input

The GitHub-tracked audit input file is:

`docs/operations/non-english-ipa-audit-input.json`

The tracked reviewed-findings ledger is:

`docs/operations/non-english-ipa-reviewed-findings.json`

A generated local copy may also exist at:

`E:/SpeakRightDesktopRepo/src-tauri/target/ipa-audit/non-english-ipa-audit-input.json`

It now contains the final expanded UI corpus rather than only the base source
arrays. Current count: 1736 rows.

- `es-ES`: 516 rows
- `fr-FR`: 599 rows
- `ru-RU`: 621 rows

The earlier 988-row audit input covered only base sound-unit arrays. The current
file is generated from the final expanded learner-facing corpus assembled by
`src/lib/language-phonemes.ts`, including base sound units, keyword expansions,
and learning-deck entries.

Each row includes `languageId`, `unitSlug`, `unitDisplayIpa`, `text`, `currentIpa`, `currentDisplayType`, and source file location.
Each row also includes `auditRole`:

- `ipa-transcription`: the row is intended to be reviewed as a current IPA
  transcription for the displayed word, phrase, or sentence.
- `deck-focus-hint`: the row comes from `language-learning-decks`
  `sentenceDeck.ipaHint`; it is a practice-focus cue and must not be treated as
  a full sentence transcription or a `recommendedIpa` candidate unless a later
  sourced audit explicitly promotes it.

Regenerate the tracked file after source-data changes with:

```powershell
npm.cmd run ipa:audit:export
```

After applying a sourced review result, record the row in
`non-english-ipa-reviewed-findings.json` before or with the code change. This
ledger separates `update`, `variant-accepted`, and `needs-review` rows and is
checked by `src/__tests__/non-english-ipa-reviewed-findings.test.ts`. Rows such
as Russian `поезд идёт` stay unchanged until the ledger is updated with stronger
evidence; Spanish source-unit allophone rows may keep `[β ð ɣ]`, but the final
audit corpus must remain phoneme-first.

## GPT Research Prompt

Use this prompt with the exported JSON:

```text
请基于我提供的 SpeakRight Desktop IPA audit JSON，逐条审计西班牙语 es-ES、法语 fr-FR、俄语 ru-RU 的词、短语、句子 IPA 标注。

产品口径已经确认：
1. 全局采用双层显示：官方音位/词典发音 + 学习者实际训练发音。
2. 西班牙语 es-ES：主层偏音位，采用卡斯蒂利亚标准；/θ/ 是有效目标；默认 yeismo；[β ð ɣ] 等只作为语境实现或明确训练单位，不随意当作独立课程音位。
3. 法语 fr-FR：单词显示词典式发音；短语/句子需要在 liaison、enchaînement、elision、schwa、词尾静音等影响实际读法时显示语流实现。
4. 俄语 ru-RU：必须显示重音和学习者实际读法；需要体现非重读元音弱化、硬软辅音、词尾清化、清浊同化等训练关键点。
5. 如果无法用两个独立权威来源确认，不要猜测；标记为 needs-review。

请优先使用权威资料：
- 西班牙语：RAE/ASALE/DPD、权威西语音系教材或词典。
- 法语：CNRTL/TLFi、Larousse、Wiktionnaire、主流法语音系/语流资料。
- 俄语：Gramota、Большой орфоэпический словарь、权威俄语正音/重音资料、可信 IPA 词典资料。

请输出 CSV 或 Markdown 表格，字段必须包含：
languageId, unitSlug, text, currentIpa, auditRole, recommendedIpa, ipaType, accentStandard, source1Name, source1Url, source1Evidence, source2Name, source2Url, source2Evidence, verdict, notes

verdict 只能使用：
- ok
- update
- needs-review
- variant-accepted

ipaType 只能使用：
- phoneme
- dictionary
- training-realization
- connected-speech
- variant

审计要求：
1. 每条都判断 currentIpa 是否适合该语言、该单位、该 UI 层级。
2. 不要把极窄实验室转写强行塞给初学者；推荐 broad/practical IPA。
3. 对短语和句子，说明是否需要 connected-speech 版本。
4. 对西语地区差异、法语可选 schwa/liaison、俄语正音变体，明确是否是可接受变体。
5. 对不能确认的条目写 needs-review，并说明需要查哪个词典或专家确认。
6. 如果 auditRole 是 deck-focus-hint，请先判断它作为“训练焦点提示”是否误导；不要默认把它当作完整句子 IPA 去纠错。
```

## Implementation Rule After Research Returns

Do not bulk-replace IPA blindly. Import the returned audit as a reviewed table,
then apply only rows with `verdict = update` or `variant-accepted` after the
evidence fields are checked:

- `update` rows should have two independent source URLs or one primary authority
  plus one dictionary/textbook corroboration.
- `variant-accepted` rows should name the accepted variant, the UI layer it
  belongs to, and at least one strong source explaining why the current display
  is acceptable for learners.
- `needs-review` rows must stay unchanged until a later manual review supplies
  stronger evidence.
- Spanish `currentIpa` in the exported learner-facing audit corpus should remain
  phoneme-first for `/b d g/`; `[β ð ɣ]` may appear in explicit allophone unit
  labels and scoring aliases, but not as leaked default keyword IPA.

After applying changes, run:

```powershell
npm.cmd exec vitest run src/__tests__/language-learning-decks.test.ts src/__tests__/language-phoneme-resources.test.ts src/__tests__/assessment-segment-audio.test.ts --reporter=verbose
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run desktop:preflight
npm.cmd run desktop:launch-release
```
