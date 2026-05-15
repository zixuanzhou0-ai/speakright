import type { DiagnosisReport } from "@/types/diagnosis";

export type CoverageFeature =
  | "ee-ih"
  | "eh-ae"
  | "s-th"
  | "z-dh"
  | "v-w"
  | "l-r"
  | "oo-uh"
  | "n-ng"
  | "final-consonants"
  | "stress-rhythm"
  | "weak-forms"
  | "linking";

export interface CoveragePassageItem {
  id: string;
  title: string;
  text: string;
  focus: string;
  coachCue: string;
  targetPhonemes: string[];
  targetFeatures: CoverageFeature[];
  evidenceWords: string[];
}

export interface CoverageAdaptiveProbe extends CoveragePassageItem {
  triggerPhonemes: string[];
  triggerIssueIds: string[];
  reason: string;
}

export interface CoveragePassage {
  id: string;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  segments: CoveragePassageItem[];
  probes: CoverageAdaptiveProbe[];
}

export const COVERAGE_TARGET_PACKS = [
  "ee-ih",
  "eh-ae",
  "s-th",
  "z-dh",
  "v-w",
  "l-r",
  "final-consonants",
  "stress-rhythm",
  "oo-uh",
  "n-ng",
] as const;

export const COVERAGE_PASSAGE: CoveragePassage = {
  id: "american-core-coverage-v1",
  title: "A Clear Morning Practice",
  subtitle:
    "覆盖中国学习者最常见的美音问题：元音长短、齿间音、V/W、L/R、前后鼻音、词尾辅音、弱读、连读和句子重音。",
  estimatedMinutes: 5,
  segments: [
    {
      id: "segment-1-vowels-th-lr",
      title: "清晨街道",
      text: "This morning, Ethan and Lily left their little apartment before the city was fully awake. A small ship on the sign sat beside a calm sheep, and the thin gray light over the river made every street feel still.",
      focus: "先看 /ɪ/ 和 /iː/ 是否拉开，同时观察 /θ/、/l/、/r/ 的稳定性。",
      coachCue:
        "ship 要短，sheep 要长；thin 的舌尖轻轻放到齿间，不要缩回去读成 sin。",
      targetPhonemes: ["ih", "ee", "th", "l", "r"],
      targetFeatures: ["ee-ih", "s-th", "l-r"],
      evidenceWords: [
        "This",
        "Lily",
        "little",
        "ship",
        "sheep",
        "thin",
        "light",
        "river",
        "street",
        "still",
      ],
    },
    {
      id: "segment-2-ae-eh",
      title: "面包店",
      text: "At the bakery, Maya asked for a fresh black bagel, a small cup of milk, and a basket of apples. The clerk smiled and said the warm bread would be ready in ten minutes.",
      focus:
        "检测 /æ/ 开口、/e/ 的短促，以及 asked、fresh、black 这类词尾是否收住。",
      coachCue:
        "black、bagel、basket、apples 的 /æ/ 要把下巴打开；said、bread、ten 不要读得太扁。",
      targetPhonemes: ["ae", "eh", "k", "t", "s"],
      targetFeatures: ["eh-ae", "final-consonants"],
      evidenceWords: [
        "At",
        "asked",
        "fresh",
        "black",
        "bagel",
        "basket",
        "apples",
        "said",
        "bread",
        "ten",
      ],
    },
    {
      id: "segment-3-vw-dh",
      title: "窗边等待",
      text: "Victor waited near the west window while Wendy read a very short review of the new village museum. Every voice in the room was quiet, but the wind outside was wild.",
      focus:
        "检测 /v/ 和 /w/ 的唇形差异，同时观察 the、while、weather 类功能词的弱读。",
      coachCue:
        "Victor、very、review、voice 用上齿碰下唇；west、window、Wendy、wind 双唇收圆向前。",
      targetPhonemes: ["v", "w", "dh"],
      targetFeatures: ["v-w", "z-dh", "weak-forms"],
      evidenceWords: [
        "Victor",
        "waited",
        "west",
        "window",
        "Wendy",
        "very",
        "review",
        "village",
        "voice",
        "wind",
        "wild",
      ],
    },
    {
      id: "segment-4-oo-uh-lr",
      title: "午餐桌",
      text: "The school cook put good soup, blue fruit, and a full bowl of noodles on the long wooden table. Luke looked at the menu and took only a little sugar.",
      focus: "检测 /uː/ 与 /ʊ/，并顺带看 /l/、/r/ 和词中弱元音。",
      coachCue:
        "soup、blue、Luke 拉长圆唇；good、full、looked、took 短而收住。",
      targetPhonemes: ["oo", "uh", "l", "r"],
      targetFeatures: ["oo-uh", "l-r", "weak-forms"],
      evidenceWords: [
        "school",
        "cook",
        "put",
        "good",
        "soup",
        "blue",
        "fruit",
        "full",
        "bowl",
        "Luke",
        "looked",
        "took",
      ],
    },
    {
      id: "segment-5-n-ng",
      title: "傍晚会议",
      text: "During the evening meeting, Ken kept asking why the young singer was running late. The team wrote down one strong plan, then rang the manager to confirm it.",
      focus:
        "检测 /n/ 和 /ŋ/ 的舌尖/舌根差异，以及 meeting、running、strong 等结尾。",
      coachCue:
        "Ken、one、plan 用舌尖；singing、running、strong、rang 用舌根抬起，别把 /ŋ/ 读成 /n/。",
      targetPhonemes: ["n", "ng"],
      targetFeatures: ["n-ng", "final-consonants"],
      evidenceWords: [
        "During",
        "evening",
        "meeting",
        "Ken",
        "asking",
        "young",
        "singer",
        "running",
        "one",
        "strong",
        "then",
        "rang",
      ],
    },
    {
      id: "segment-6-final-clusters",
      title: "整理箱子",
      text: "After lunch, Jack asked Mark to help lift the next box of texts, masks, and maps. They stopped at the desk, checked the list, and thanked the staff.",
      focus:
        "集中检测词尾辅音和辅音群：asked、lift、next、texts、masks、checked、thanked。",
      coachCue: "词尾要短、轻、干净，不要吞掉，也不要加中文式的“呃”。",
      targetPhonemes: ["k", "t", "s", "p", "d", "th"],
      targetFeatures: ["final-consonants", "s-th"],
      evidenceWords: [
        "Jack",
        "asked",
        "Mark",
        "help",
        "lift",
        "next",
        "texts",
        "masks",
        "maps",
        "stopped",
        "desk",
        "checked",
        "list",
        "thanked",
        "staff",
      ],
    },
    {
      id: "segment-7-stress-linking",
      title: "连起来说",
      text: "In the last round, say this in thought groups, not word by word: We can pick it up, turn it off, and move on with a better rhythm.",
      focus:
        "检测句子重音、弱读、停顿、pick it up / turn it off 这类辅音接元音的连读。",
      coachCue:
        "重读 pick、turn、move、better、rhythm；can、it、and、with 要轻，辅音接元音要连起来。",
      targetPhonemes: ["schwa", "r", "t", "k", "v"],
      targetFeatures: [
        "stress-rhythm",
        "weak-forms",
        "linking",
        "final-consonants",
      ],
      evidenceWords: [
        "last",
        "thought",
        "groups",
        "word",
        "can",
        "pick it up",
        "turn it off",
        "move on",
        "better",
        "rhythm",
      ],
    },
  ],
  probes: [
    {
      id: "probe-ee-ih",
      title: "补测：ship / sheep",
      text: "The small ship is still beside the clean sheep.",
      focus: "确认 /ɪ/ 和 /iː/ 是否真的分开。",
      coachCue: "ship、still 短；clean、sheep 长，不要全部读成中文“衣”。",
      targetPhonemes: ["ih", "ee"],
      targetFeatures: ["ee-ih"],
      triggerPhonemes: ["ih", "ee"],
      triggerIssueIds: ["ee-ih"],
      evidenceWords: ["ship", "still", "clean", "sheep"],
      reason: "长短元音证据不足或分数波动较大。",
    },
    {
      id: "probe-eh-ae",
      title: "补测：bad / bed",
      text: "The bad red bag fell beside the desk.",
      focus: "确认 /æ/ 开口是否足够，以及 /e/ 是否短促。",
      coachCue: "bad、bag 下巴打开；red、desk 保持短、前、稳。",
      targetPhonemes: ["ae", "eh"],
      targetFeatures: ["eh-ae"],
      triggerPhonemes: ["ae", "eh"],
      triggerIssueIds: ["eh-ae"],
      evidenceWords: ["bad", "red", "bag", "desk"],
      reason: "/æ/ 或 /e/ 证据偏薄。",
    },
    {
      id: "probe-s-th",
      title: "补测：thin / think",
      text: "Think through the thin path with both teeth showing.",
      focus: "确认 /θ/ 是否缩回成 /s/。",
      coachCue: "每个 th 都让舌尖轻轻露到齿间，气流从齿缝走。",
      targetPhonemes: ["th"],
      targetFeatures: ["s-th"],
      triggerPhonemes: ["th"],
      triggerIssueIds: ["s-th"],
      evidenceWords: ["Think", "through", "thin", "path", "both", "teeth"],
      reason: "齿间清辅音低分或样本数不足。",
    },
    {
      id: "probe-z-dh",
      title: "补测：this / those",
      text: "This weather is smoother than those other days.",
      focus: "确认 /ð/ 是否读成 /z/ 或 /d/。",
      coachCue: "this、weather、than、those 的 th 要有声带振动，舌尖仍在齿间。",
      targetPhonemes: ["dh"],
      targetFeatures: ["z-dh"],
      triggerPhonemes: ["dh"],
      triggerIssueIds: ["z-dh"],
      evidenceWords: ["This", "weather", "smoother", "than", "those", "other"],
      reason: "齿间浊辅音证据偏弱。",
    },
    {
      id: "probe-v-w",
      title: "补测：V / W",
      text: "Victor watched Wendy wave from the west window.",
      focus: "确认 /v/ 和 /w/ 是否混淆。",
      coachCue: "Victor 用齿碰唇，watched、Wendy、wave、west、window 用圆唇。",
      targetPhonemes: ["v", "w"],
      targetFeatures: ["v-w"],
      triggerPhonemes: ["v", "w"],
      triggerIssueIds: ["v-w"],
      evidenceWords: ["Victor", "watched", "Wendy", "wave", "west", "window"],
      reason: "/v/ 或 /w/ 分数危险。",
    },
    {
      id: "probe-l-r",
      title: "补测：light / right",
      text: "Lily read the right line slowly near the river.",
      focus: "确认 /l/ 舌尖触点和 /r/ 悬空卷舌是否分开。",
      coachCue:
        "Lily、line、slowly 舌尖碰上齿龈；read、right、river 舌头悬空。",
      targetPhonemes: ["l", "r"],
      targetFeatures: ["l-r"],
      triggerPhonemes: ["l", "r"],
      triggerIssueIds: ["l-r"],
      evidenceWords: ["Lily", "read", "right", "line", "slowly", "river"],
      reason: "/l/ 或 /r/ 证据不够稳。",
    },
    {
      id: "probe-oo-uh",
      title: "补测：Luke / look",
      text: "Luke took a full spoon of good soup.",
      focus: "确认 /uː/ 与 /ʊ/ 的时长和圆唇程度。",
      coachCue: "Luke、spoon、soup 拉长；took、full、good 短促收住。",
      targetPhonemes: ["oo", "uh"],
      targetFeatures: ["oo-uh"],
      triggerPhonemes: ["oo", "uh"],
      triggerIssueIds: ["oo-uh"],
      evidenceWords: ["Luke", "took", "full", "spoon", "good", "soup"],
      reason: "后高元音证据偏薄。",
    },
    {
      id: "probe-n-ng",
      title: "补测：N / NG",
      text: "Ken is singing a strong song in the morning.",
      focus: "确认 /n/ 和 /ŋ/ 的舌尖/舌根差异。",
      coachCue: "Ken、in 用舌尖；singing、strong、song、morning 用舌根。",
      targetPhonemes: ["n", "ng"],
      targetFeatures: ["n-ng"],
      triggerPhonemes: ["n", "ng"],
      triggerIssueIds: ["n-ng"],
      evidenceWords: ["Ken", "singing", "strong", "song", "in", "morning"],
      reason: "前后鼻音证据不足或差异不稳定。",
    },
    {
      id: "probe-final-consonants",
      title: "补测：词尾辅音",
      text: "Jack asked Mark to lift the next box of texts.",
      focus: "确认词尾辅音和辅音群是否吞掉或加元音。",
      coachCue: "asked、lift、next、box、texts 都要轻轻收住，不能变成 ask-uh。",
      targetPhonemes: ["k", "t", "s", "d"],
      targetFeatures: ["final-consonants"],
      triggerPhonemes: ["k", "t", "s", "d", "p", "z"],
      triggerIssueIds: ["final-consonants"],
      evidenceWords: ["Jack", "asked", "Mark", "lift", "next", "box", "texts"],
      reason: "词尾辅音证据不足或吞尾风险较高。",
    },
    {
      id: "probe-stress-rhythm",
      title: "补测：弱读与连读",
      text: "We can pick it up and turn it off again.",
      focus: "确认弱读、连读和句子轻重是否自然。",
      coachCue:
        "重读 pick、turn、off、again；can、it、and 要轻，pick it up 连起来。",
      targetPhonemes: ["schwa", "k", "t", "r"],
      targetFeatures: ["stress-rhythm", "weak-forms", "linking"],
      triggerPhonemes: ["schwa"],
      triggerIssueIds: ["stress-rhythm"],
      evidenceWords: ["can", "pick it up", "turn it off", "again"],
      reason: "句子节奏、弱读或连读证据偏弱。",
    },
  ],
};

export function getCoveragePassageText(): string {
  return COVERAGE_PASSAGE.segments.map((segment) => segment.text).join("\n\n");
}

export function selectCoverageAdaptiveProbes(
  report: DiagnosisReport,
  usedProbeIds: string[] = [],
): CoverageAdaptiveProbe[] {
  const used = new Set(usedProbeIds);
  const weakThinPhonemes = Object.entries(report.phonemeScores)
    .filter(([, value]) => value.score < 78 && value.sampleCount < 2)
    .map(([phoneme]) => phoneme);
  const highPriorityIssues = report.issues.filter(
    (issue) =>
      issue.severity !== "minor" ||
      issue.evidenceStrength === "thin" ||
      issue.confidence === "low",
  );
  const issueIds = new Set(highPriorityIssues.map((issue) => issue.id));
  const issuePhonemes = highPriorityIssues.flatMap(
    (issue) => issue.targetPhonemes,
  );
  const targets = new Set([...weakThinPhonemes, ...issuePhonemes]);

  if (targets.size === 0 && issueIds.size === 0) return [];

  return COVERAGE_PASSAGE.probes
    .filter((probe) => !used.has(probe.id))
    .filter(
      (probe) =>
        probe.triggerPhonemes.some((phoneme) => targets.has(phoneme)) ||
        probe.triggerIssueIds.some((issueId) => issueIds.has(issueId)),
    )
    .sort((a, b) => {
      const aIssue = a.triggerIssueIds.some((issueId) => issueIds.has(issueId));
      const bIssue = b.triggerIssueIds.some((issueId) => issueIds.has(issueId));
      if (aIssue !== bIssue) return aIssue ? -1 : 1;
      return a.id.localeCompare(b.id);
    })
    .slice(0, 4);
}
