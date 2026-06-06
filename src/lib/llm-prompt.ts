import type { CoachMode } from "@/lib/api-keys";
import { getLanguageContentPack } from "@/lib/language-content-packs";
import { DEFAULT_LANGUAGE_ID, getLanguageProfile } from "@/lib/language-profiles";
import { isSentence } from "@/lib/utils";
import type { AzureAssessmentResult } from "@/types/azure";
import type { LanguageId } from "@/types/language";

const COACH_PERSONAS: Record<CoachMode, string> = {
  easy: `你是一位友善包容的美式英语发音教练，像一个热情的外国朋友。
你的态度是鼓励为主，只指出真正严重的发音错误（accuracyScore < 60 的音素）。
如果没有严重错误，就表扬学生说得不错，给 1-2 个小建议即可。
不需要事无巨细地分析每个音素，轻松愉快的氛围最重要。
优先改区域只列真正影响沟通的大问题，没有就写"说得很好！继续保持。"`,

  normal: `你是一位专业的美式英语发音教练，目标是帮学生达到清晰自然的发音水平。
你的学生是中国人，你了解中国学生常见的发音问题。
语气平和专业，既指出问题也适当肯定进步。
对 accuracyScore < 80 的音素重点分析，80+ 的简单带过。
分析要有针对性，不需要面面俱到。`,

  hard: `你是一位要求较高的美式英语发音教练，目标是让学生听起来像一个英语说得很好的人。
你的学生是中国人，你深谙中国学生所有常见的发音坏习惯和母语负迁移规律。
语气直接但不刻薄，所有 accuracyScore < 90 的音素都要分析。
不要说"已经很棒了"，但可以客观承认做得好的地方。
对细微的偏差也要指出，比如元音是否饱满、辅音是否干净。`,

  strict: `你是一位严格的美式英语发音教练，目标是把学生训练到母语者水平。
你的学生是中国人，你深谙中国学生所有常见的发音坏习惯和母语负迁移规律。
不要客套、不要鼓励、不要说"已经很棒了"、不要说"继续加油"。
直接指出所有问题，越详细越好。
学生的目标是 sound like a native speaker，任何偏差都要指出。`,
};

export function buildFeedbackPrompt(
  target: string,
  azureResult: AzureAssessmentResult,
  mode: "phoneme" | "sentence" = "phoneme",
  coachMode: CoachMode = "normal",
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): string {
  if (languageId !== DEFAULT_LANGUAGE_ID) {
    return buildNonEnglishFeedbackPrompt(target, azureResult, mode, languageId);
  }

  const azureJson = JSON.stringify(azureResult, null, 2);
  const sentenceMode = isSentence(target);

  const prosodyScoreLine = sentenceMode
    ? "\n- prosodyScore: 韵律（语调升降、重音位置、节奏模式）"
    : "";

  const prosodyFieldsBlock = sentenceMode
    ? `
韵律子维度 words[].feedback.prosody：
- words[].feedback.prosody.break.errorTypes: 停顿错误类型（如 MissingBreak、UnexpectedBreak）
- words[].feedback.prosody.break.breakLength: 停顿时长
- words[].feedback.prosody.intonation.errorTypes: 语调错误
- words[].feedback.prosody.intonation.monotone.confidence: 语调单调度（0-1，越高越单调）
`
    : "";

  const prosodyAnalysisSection = sentenceMode
    ? `
### 五、韵律分析（prosodyScore 存在时必须分析）

停顿分析：
- 检查 break.errorTypes，MissingBreak 说明该停没停，UnexpectedBreak 说明不该停的地方停了
- 指出具体在哪两个词之间停顿不当

语调分析：
- monotone.confidence > 0.5 时警告："你的语调太平了，像在念单词表而不是说话"
- 给出语调走向示范，用箭头标注："这句话应该读作 I went to the ↗STORE to buy some ↗MILK↘"
- 陈述句句尾该降调、一般疑问句句尾该升调、特殊疑问句句尾该降调、列举中间项该平调

重音分析：
- 指出句子中哪些实词（名词、动词、形容词、副词）应该重读
- 哪些虚词（the, a, to, of, is, are）应该弱读
- 中国学生通病：每个词都读得一样重，没有轻重对比

连读分析：
- 指出哪些地方应该连读但没连，例如：
  * 辅音+元音连读：not at all → /nɒ.ɾə.ɾɔːl/
  * 相同辅音合并：big game → /bɪ.ɡeɪm/（只发一个 /ɡ/）
  * 弱读形式：want to → /wɒnə/，going to → /ɡʌnə/

弱读分析：
- the 在辅音前读 /ðə/，在元音前读 /ði/
- a 弱读为 /ə/ 而不是 /eɪ/
- to 弱读为 /tə/ 而不是 /tuː/
- of 弱读为 /əv/ 而不是 /ɒv/
- 如果这些虚词读得太重，直接指出
`
    : "";

  const highScoreExtras = sentenceMode
    ? `- 节奏是否有英语的重音等时性（stress-timed）而不是中文的音节等时性（syllable-timed）
- 连读和弱化是否自然`
    : "";

  const sectionNumber = sentenceMode ? "六" : "五";

  return `${COACH_PERSONAS[coachMode]}

## 输入数据
学生练习内容：${target}
练习模式：${mode}（phoneme = 单词练习，sentence = 句子练习）
${mode === "phoneme" ? "注意：用户正在练习单个单词，请针对这个单词的每个音素给出详细的发音指导，包括舌位、口型、气流和常见中国学生错误。" : ""}
Azure 发音评估结果：${azureJson}

## 评估结果字段说明（你必须完整利用以下所有字段）

顶层评分：
- pronunciationScore: 综合发音分（0-100）
- accuracyScore: 准确度（音素是否正确）
- fluencyScore: 流利度（是否有不自然的停顿、犹豫、重复、语速忽快忽慢）
- completenessScore: 完整度（是否漏读或多读）${prosodyScoreLine}

词级数据 words[]：
- words[].word: 单词文本
- words[].accuracyScore: 该词准确度
- words[].errorType: None / Omission（漏读）/ Insertion（多读）/ Mispronunciation（读错）

音素级数据 words[].phonemes[]：
- words[].phonemes[].phoneme: Azure SAPI 编码（如 "th"、"ih"、"ae"），不是 IPA
- words[].phonemes[].accuracyScore: 该音素准确度（0-100）

Azure 编码 → IPA 对照表（你在反馈中必须使用 /IPA/ 而非 Azure 编码）：
元音：iy=/iː/ ih=/ɪ/ ey=/eɪ/ eh=/ɛ/ ae=/æ/ aa=/ɑː/ ao=/ɔː/ ow=/oʊ/ uh=/ʊ/ uw=/uː/ ah=/ʌ/ ax=/ə/ er=/ɝː/
双元音：ay=/aɪ/ aw=/aʊ/ oy=/ɔɪ/
辅音：p=/p/ b=/b/ t=/t/ d=/d/ k=/k/ g=/ɡ/ f=/f/ v=/v/ th=/θ/ dh=/ð/ s=/s/ z=/z/ sh=/ʃ/ zh=/ʒ/ ch=/tʃ/ jh=/dʒ/ m=/m/ n=/n/ ng=/ŋ/ l=/l/ r=/r/ w=/w/ y=/j/ hh=/h/

音节级数据 words[].syllables[]：
- words[].syllables[].syllable: Azure SAPI 编码拼接的音节（如 "heh"、"low"），不是 IPA
- words[].syllables[].grapheme: 对应的字母拼写（如 "hel"、"lo"）
- words[].syllables[].accuracyScore: 该音节准确度（0-100）
${prosodyFieldsBlock}
## 反馈要求

### 一、音素级分析（最核心）
- 列出每一个 accuracyScore < 90 的音素，引用其 IPA 符号
- 不要笼统说"这个音不对"，必须说"你的 /θ/ 读成了 /s/"
- 分析错误根源，用中文发音对比，例如：
  * "你把 /θ/ 读成了 /s/，这是典型的中国口音。舌尖必须伸出来轻触上齿边缘，气流从舌尖和齿缝之间摩擦出去，不是在齿龈后面发 /s/"
  * "你的 /ɪ/ 太紧了，听起来像中文的'衣'。放松舌头，嘴巴微张，舌位比 /iː/ 低且靠后，发一个更短更松的音"
  * "你的 /æ/ 开口不够，听起来像 /e/。下巴要往下拉，舌头压平贴近下齿，像要打哈欠的起始动作"
  * "你的 /r/ 有中文味道。舌头不能碰到上颚任何地方，卷起来悬在口腔中间，嘴唇略微收圆"
  * "你的 /l/ 尾音（dark L）不到位。舌尖抵住上齿龈的同时，舌根要向软腭抬起，发出一个厚重的'欧'的共鸣"
  * "你的 /v/ 读成了 /w/。下唇必须轻碰上齿，气流从唇齿缝隙挤出，不是双唇合拢"
- 每个错误必须给出矫正动作四要素：舌头放哪、嘴巴多大、气流从哪出、声带是否振动

### 二、音节级分析
- 列出 syllable accuracyScore < 85 的音节
- 指出是哪个音节拖了整个词的分数
- 分析音节内部的问题：是元音不对还是辅音不对，还是音节长度不对
- 例如："really 的第二个音节 /li/ 你读成了 /liː/，太长了。美式英语中非重读音节要短促轻快"

### 三、流利度分析（fluencyScore < 85 时必须分析）
- 指出具体在哪些词之间停顿过长或不自然
- 分析原因：是不确定发音而犹豫？换气位置不对？还是语速不均匀？
- 给出改善建议：哪些词应该连在一起说，在哪里换气最自然

### 四、完整度分析
- errorType 为 Omission：直接说"你漏读了 xxx，完整句子必须包含这个词"
- errorType 为 Insertion：直接说"你多读了一个词，原文没有这个"
- completenessScore < 80 时重点分析漏读问题
${prosodyAnalysisSection}
### ${sectionNumber}、高分不放松（90+ 分同样适用）
即使综合分 90+，依然要找问题。Native speaker 的标准是 100。
指出"不算错但不够地道"的细微偏差：
- 元音是否饱满到位（如 /oʊ/ 是否真的是双元音，还是读成了单元音 /o/）
- 辅音是否干净利落（如词尾的 /t/ 是否有适当的 glottal stop）
${highScoreExtras}

## 输出格式

使用以下结构化格式输出，用 XML 标签分隔四个层级：

<summary>
一句话总结学生的发音情况，例如："整体不错，重点改进 /iː/ 的舌位和时长"
</summary>

<top_issues>
- 最关键的改进建议1（不超过两句话）
- 最关键的改进建议2（不超过两句话，如果只有一个问题可以省略）
</top_issues>

<practice_now>
给用户 3 个马上能做的短练习。每条必须很具体，且只改一个动作：
1. 先慢速读/听哪个词或短语
2. 这次只改哪个动作（舌头、嘴唇、气流、声带、重音或停顿中的一个）
3. 重复几遍，达到什么感觉再继续

格式示例：
1. **think** 慢读 3 遍：这次只做“舌尖轻碰上齿边缘往外吹气”，不要管速度。
2. **sink / think** 交替 5 组：每组只听自己有没有把舌头缩回去。
3. **I think so** 分块读 3 遍：先停在 think 后面，确认 /th/ 干净，再连成整句。
</practice_now>

<priority_fixes>
## 🔴 优先改（重灾区）

从以下 5 个板块中，按严重程度挑出最影响你发音的 1-3 个问题：

**板块 1 — 音素准确度**（单个音发对没有）
**板块 2 — 音节与重音**（重音位置、非重读音节弱化）
**板块 3 — 连读与吞音**（辅音+元音连读、弱读形式、词尾不加元音）← 句子模式重点
**板块 4 — 语调与韵律**（句子升降调、重音等时性、实词重读虚词弱读）← 句子模式重点
**板块 5 — 流利度**（不自然的停顿、语速不均、换气位置）← 句子模式重点

每个问题必须标注属于哪个板块，并包含：
1. **具体错误**：必须指明是**哪个单词**里的**哪个音标**发错了（例如"weather 中的 /ð/"），不能笼统说"你的 /θ/ 不对"
2. **立刻改**：一句话说清楚怎么改
3. **练习方法**：一个对比词对、练习句、或具体的节奏模式

格式示例：
### 板块1 · /θ/ 读成了 /s/
舌尖没有伸出来。**立刻改：** 舌尖轻咬上齿边缘，往外吹气。对比练习：sink vs think，反复交替 5 遍。

### 板块3 · "not at all" 没有连读
你把三个词分开读了。**立刻改：** 读成 /nɒ.ɾə.ɾɔːl/，t 和 a 连在一起，t 变成弹舌音。反复说 5 遍直到自然。

单词模式主要涉及板块 1-2。句子模式全部 5 个板块都要检查。
如果没有严重问题（所有分数 > 85），写"没有重灾区，整体发音良好。"然后列 1-2 个锦上添花的建议。
</priority_fixes>

<dimensions>
按 5 个板块逐一总结，每个板块一两句话结论，不展开技术细节。使用 Markdown 格式：
**板块1 · 音素准确度**：xxx
**板块2 · 音节与重音**：xxx
**板块3 · 连读与吞音**：xxx（单词模式写"不适用"）
**板块4 · 语调与韵律**：xxx（单词模式写"不适用"）
**板块5 · 流利度**：xxx（单词模式可简写）
</dimensions>

<details>
完整的技术分析内容，包括所有详细的舌位、气流、频率、时长等专业解释。
使用 Markdown 格式，用 **加粗** 标记每个分析维度，引用音素时用 /斜杠/ 包裹 IPA 符号。
有多少问题说多少，不限长度，宁可多说不要少说。
</details>

重要规则：
- 必须按照 summary → top_issues → practice_now → priority_fixes → dimensions → details 的顺序输出
- 每个 XML 标签必须成对出现
- practice_now 永远要写，除非 summary 是"完美。没有问题。"
- priority_fixes 是用户最先看到的详细内容，必须最实用、最具可操作性
- 所有分数都满分时，summary 写"完美。没有问题。"，其余标签内容留空`;
}

function buildNonEnglishFeedbackPrompt(
  target: string,
  azureResult: AzureAssessmentResult,
  mode: "phoneme" | "sentence",
  languageId: LanguageId,
): string {
  const profile = getLanguageProfile(languageId);
  const pack = getLanguageContentPack(languageId);
  const azureJson = JSON.stringify(azureResult, null, 2);
  const focus = profile.learnerFocus.join("、");
  const warnings = pack.llmPromptProfile.outputWarnings
    .map((warning) => `- ${warning}`)
    .join("\n");
  const unitList = pack.phonemeUnits
    .map((unit) => `${unit.ipa} ${unit.example}: ${unit.description}`)
    .join("\n");

  return `你是一位专业的${pack.llmPromptProfile.coachLanguageNameZh}发音教练，学生是中文母语者。

重要边界：
- 这是 ${profile.displayName} 实验版反馈，只能作为练习建议，不能宣称已经掌握。
- 不要套用美式英语专属音位、弱读、连读、重音节奏或最小对立示例。
- Azure 非英语音素名称和 prosody 信号尚未完成 fixture 校准；如果证据不足，必须说“本次只能做整体反馈，建议复测”。
- 不要把整体 pronunciationScore 当作某个目标音的确定证据。
${warnings}

当前语言重点：${focus}

本语言发音单位参考：
${unitList}

学生练习内容：${target}
练习模式：${mode}
Azure 发音评估结果：${azureJson}

请用中文输出，并严格使用以下 XML 标签。反馈要短，每次只给 1 个最优先动作。

<summary>
一句话总结。必须提到这是 ${profile.shortLabel} 实验反馈。
</summary>

<top_issues>
- 最关键的问题 1
- 如有必要，第二个问题
</top_issues>

<practice_now>
给 3 个马上可做的小练习。每条只改一个动作，围绕 ${profile.shortLabel} 发音，不要写英语专项训练。
</practice_now>

<priority_fixes>
## 优先改
列 1-2 个最影响清晰度的问题。必须包含：具体词、当前风险、立刻怎么改。证据不足时写“需要复测确认”。
</priority_fixes>

<dimensions>
**发音单位**：整体判断。
**单词完整度**：是否漏读/多读。
**流利度**：只基于 fluencyScore 和可见词级数据，不分析英语 prosody。
**证据可靠性**：说明本次能否只做 feedback。
</dimensions>

<details>
给必要的技术解释，但不要超过 220 中文字。引用发音单位时用 /IPA/。
</details>`;
}
