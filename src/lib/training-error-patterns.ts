import type { DiagnosisIssue } from "@/types/diagnosis";
import type { ErrorPattern, RemediationPath } from "@/types/training";

export interface ErrorPatternDetectionInput {
  packId: string;
  targetPhonemes: string[];
  targetScore: number;
  overallScore: number;
  issueType?: DiagnosisIssue["type"];
  isFinalPosition?: boolean;
}

export const TRAINING_ERROR_PATTERNS: ErrorPattern[] = [
  {
    id: "target-low-overall-high",
    title: "整体能听懂，但关键音没改掉",
    appliesToPackIds: [
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
    ],
    detection: { targetPhonemes: [], maxTargetScore: 74, minTargetScoreDrop: 12 },
    coachExplanation:
      "整词分被上下文和其他音拉高了，但训练目标本身还没有稳定。下一轮只盯一个动作，不追求速度。",
    immediateCue: "先慢下来，把目标音单独做清楚，再放回词里。",
    remediationPathId: "rebuild-target",
  },
  {
    id: "tongue-between-teeth",
    title: "齿间音缩回去了",
    appliesToPackIds: ["s-th"],
    detection: { targetPhonemes: ["th"], maxTargetScore: 76 },
    coachExplanation:
      "/θ/ 的舌尖需要轻轻伸到齿间。舌尖缩在齿后时，think 会靠近 sink。",
    immediateCue: "露出一点舌尖，只吹气，不要让声带振动。",
    remediationPathId: "th-rebuild",
  },
  {
    id: "voiced-th-z",
    title: "浊齿间音读成了 /z/ 或 /d/",
    appliesToPackIds: ["z-dh"],
    detection: { targetPhonemes: ["dh"], maxTargetScore: 76 },
    coachExplanation:
      "/ð/ 既要舌尖在齿间，又要声带振动。只摩擦会像 /θ/，缩回去会像 /z/ 或 /d/。",
    immediateCue: "舌尖轻夹住，手摸喉咙确认有震动。",
    remediationPathId: "dh-rebuild",
  },
  {
    id: "lip-teeth-round-lips",
    title: "唇齿音和圆唇音混在一起",
    appliesToPackIds: ["v-w"],
    detection: { targetPhonemes: ["v", "w"], maxTargetScore: 76 },
    coachExplanation:
      "/v/ 是上齿轻碰下唇，/w/ 是双唇收圆向前推。两个动作不能用同一个嘴型。",
    immediateCue: "读 /v/ 先咬一点下唇；读 /w/ 先把嘴唇收圆。",
    remediationPathId: "vw-rebuild",
  },
  {
    id: "vowel-length-ee-ih",
    title: "长短元音没有拉开",
    appliesToPackIds: ["ee-ih"],
    detection: { targetPhonemes: ["ee", "ih"], maxTargetScore: 76 },
    coachExplanation:
      "/iː/ 要紧且长，/ɪ/ 要松且短。两者都读成中文“衣”时，ship/sheep 会靠上下文猜。",
    immediateCue: "/iː/ 拉长，/ɪ/ 立刻收住。",
    remediationPathId: "length-rebuild",
  },
  {
    id: "open-jaw-ae",
    title: "/æ/ 开口不够",
    appliesToPackIds: ["eh-ae"],
    detection: { targetPhonemes: ["ae"], maxTargetScore: 76 },
    coachExplanation:
      "/æ/ 需要下巴真的打开。嘴型太小会让 bad/man/sat 靠近 bed/men/set。",
    immediateCue: "下巴向下掉，舌前部放平，不要挤成 /e/。",
    remediationPathId: "ae-rebuild",
  },
  {
    id: "tongue-l-r",
    title: "/l/ 和 /r/ 舌位没有分开",
    appliesToPackIds: ["l-r"],
    detection: { targetPhonemes: ["l", "r"], maxTargetScore: 76 },
    coachExplanation:
      "/l/ 舌尖碰齿龈，/r/ 舌头悬空后卷。只要舌尖乱碰，就会不稳定。",
    immediateCue: "/l/ 明确碰一下；/r/ 悬空，不碰上颚。",
    remediationPathId: "lr-rebuild",
  },
  {
    id: "final-consonant-release",
    title: "词尾辅音丢失或加元音",
    appliesToPackIds: ["final-consonants"],
    detection: {
      targetPhonemes: ["p", "b", "t", "d", "k", "g", "f", "v", "s", "z", "l", "n", "ng"],
      maxTargetScore: 76,
      requiresFinalPosition: true,
      issueTypes: ["final-consonant"],
    },
    coachExplanation:
      "英语词尾需要干净收住。吞掉会少信息，加一个中文式尾音会显得很重。",
    immediateCue: "结尾只做闭合或轻释放，不额外加“呃”。",
    remediationPathId: "final-rebuild",
  },
  {
    id: "weak-forms-rhythm",
    title: "虚词过重，句子每词等重",
    appliesToPackIds: ["stress-rhythm"],
    detection: {
      targetPhonemes: ["schwa"],
      maxTargetScore: 78,
      issueTypes: ["stress", "rhythm", "connected-speech"],
    },
    coachExplanation:
      "美式英语不是每个词都一样重。虚词要弱，内容词要顶出来，句子才有自然节奏。",
    immediateCue: "把 to/of/a/the 变轻，把内容词读清楚。",
    remediationPathId: "rhythm-rebuild",
  },
  {
    id: "rounded-vowel-oo-uh",
    title: "/uː/ 和 /ʊ/ 时长、圆唇不清",
    appliesToPackIds: ["oo-uh"],
    detection: { targetPhonemes: ["oo", "uh"], maxTargetScore: 76 },
    coachExplanation:
      "/uː/ 更圆更长，/ʊ/ 更短更松。look 被拖长时会像 Luke。",
    immediateCue: "/uː/ 圆唇拉长；/ʊ/ 少圆唇、短促收住。",
    remediationPathId: "u-rebuild",
  },
  {
    id: "back-nasal-ng",
    title: "前鼻音和后鼻音混淆",
    appliesToPackIds: ["n-ng"],
    detection: { targetPhonemes: ["n", "ng"], maxTargetScore: 76 },
    coachExplanation:
      "/n/ 是舌尖在前，/ŋ/ 是舌根在后。sing 不要读成 sin，也不要额外加 /g/。",
    immediateCue: "读 /ŋ/ 时舌尖放下，舌根抬起贴软腭。",
    remediationPathId: "ng-rebuild",
  },
];

export const DEFAULT_REMEDIATION_PATHS: RemediationPath[] = [
  {
    id: "rebuild-target",
    title: "关键音重建",
    steps: [
      { kind: "listen", prompt: "只听目标词的关键音", text: "practice", targetPhonemes: [] },
      { kind: "isolate", prompt: "慢速读关键词，先不追求速度", text: "practice", targetPhonemes: [] },
      { kind: "slow-repeat", prompt: "把目标音放回短语里", text: "practice slowly", targetPhonemes: [] },
      { kind: "retry", prompt: "恢复正常速度再录", text: "practice", targetPhonemes: [] },
    ],
  },
  {
    id: "th-rebuild",
    title: "/θ/ 慢速拆解",
    steps: [
      { kind: "listen", prompt: "听 think，只盯开头气流", text: "think", targetPhonemes: ["th"] },
      { kind: "isolate", prompt: "舌尖轻露，只吹气", text: "thin", targetPhonemes: ["th"] },
      { kind: "word-rebuild", prompt: "慢速拼回单词", text: "think", targetPhonemes: ["th"] },
      { kind: "contrast", prompt: "和 sink 拉开", text: "sink think", targetPhonemes: ["s", "th"] },
      { kind: "retry", prompt: "原速再录一次", text: "think", targetPhonemes: ["th"] },
    ],
  },
  {
    id: "dh-rebuild",
    title: "/ð/ 声带拆解",
    steps: [
      { kind: "listen", prompt: "听 this 的开头震动", text: "this", targetPhonemes: ["dh"] },
      { kind: "isolate", prompt: "舌尖齿间，手摸喉咙确认震动", text: "then", targetPhonemes: ["dh"] },
      { kind: "word-rebuild", prompt: "慢速拼回 this", text: "this", targetPhonemes: ["dh"] },
      { kind: "retry", prompt: "原速再录一次", text: "this", targetPhonemes: ["dh"] },
    ],
  },
  {
    id: "vw-rebuild",
    title: "/v/ 与 /w/ 嘴型重建",
    steps: [
      { kind: "isolate", prompt: "/v/ 上齿碰下唇", text: "very", targetPhonemes: ["v"] },
      { kind: "isolate", prompt: "/w/ 双唇收圆向前推", text: "well", targetPhonemes: ["w"] },
      { kind: "contrast", prompt: "嘴型切换要明显", text: "vest west", targetPhonemes: ["v", "w"] },
      { kind: "retry", prompt: "原速再录一次", text: "very well", targetPhonemes: ["v", "w"] },
    ],
  },
  {
    id: "length-rebuild",
    title: "长短元音重建",
    steps: [
      { kind: "isolate", prompt: "/iː/ 拉长两拍", text: "sheep", targetPhonemes: ["ee"] },
      { kind: "isolate", prompt: "/ɪ/ 一拍收住", text: "ship", targetPhonemes: ["ih"] },
      { kind: "contrast", prompt: "长短对比", text: "sheep ship", targetPhonemes: ["ee", "ih"] },
      { kind: "retry", prompt: "原速再录一次", text: "ship", targetPhonemes: ["ih"] },
    ],
  },
  {
    id: "ae-rebuild",
    title: "/æ/ 开口重建",
    steps: [
      { kind: "isolate", prompt: "下巴向下打开", text: "bad", targetPhonemes: ["ae"] },
      { kind: "word-rebuild", prompt: "慢速拼回 bad", text: "bad", targetPhonemes: ["ae"] },
      { kind: "contrast", prompt: "和 bed 拉开", text: "bed bad", targetPhonemes: ["eh", "ae"] },
      { kind: "retry", prompt: "原速再录一次", text: "bad", targetPhonemes: ["ae"] },
    ],
  },
  {
    id: "lr-rebuild",
    title: "/l/ 与 /r/ 舌位重建",
    steps: [
      { kind: "isolate", prompt: "/l/ 舌尖碰齿龈", text: "light", targetPhonemes: ["l"] },
      { kind: "isolate", prompt: "/r/ 舌头悬空后卷", text: "right", targetPhonemes: ["r"] },
      { kind: "contrast", prompt: "碰与不碰要清楚", text: "light right", targetPhonemes: ["l", "r"] },
      { kind: "retry", prompt: "原速再录一次", text: "right", targetPhonemes: ["r"] },
    ],
  },
  {
    id: "final-rebuild",
    title: "词尾辅音重建",
    steps: [
      { kind: "listen", prompt: "听结尾，只听收住", text: "back", targetPhonemes: ["k"] },
      { kind: "slow-repeat", prompt: "慢速闭合，不加尾音", text: "back", targetPhonemes: ["k"] },
      { kind: "contrast", prompt: "比较无尾和有尾", text: "bay bake", targetPhonemes: ["k"] },
      { kind: "retry", prompt: "原速再录一次", text: "bake", targetPhonemes: ["k"] },
    ],
  },
  {
    id: "rhythm-rebuild",
    title: "弱读节奏重建",
    steps: [
      { kind: "listen", prompt: "听内容词重音", text: "I want to talk about it.", targetPhonemes: ["schwa"] },
      { kind: "slow-repeat", prompt: "弱化 to/about 开头", text: "want to talk about it", targetPhonemes: ["schwa"] },
      { kind: "contrast", prompt: "内容词重，虚词轻", text: "WANT to TALK about IT", targetPhonemes: ["schwa"] },
      { kind: "retry", prompt: "自然速度再录", text: "I want to talk about it.", targetPhonemes: ["schwa"] },
    ],
  },
  {
    id: "u-rebuild",
    title: "/uː/ 与 /ʊ/ 重建",
    steps: [
      { kind: "isolate", prompt: "/uː/ 圆唇拉长", text: "pool", targetPhonemes: ["oo"] },
      { kind: "isolate", prompt: "/ʊ/ 放松短促", text: "pull", targetPhonemes: ["uh"] },
      { kind: "contrast", prompt: "长短对比", text: "pool pull", targetPhonemes: ["oo", "uh"] },
      { kind: "retry", prompt: "原速再录一次", text: "look", targetPhonemes: ["uh"] },
    ],
  },
  {
    id: "ng-rebuild",
    title: "/n/ 与 /ŋ/ 重建",
    steps: [
      { kind: "isolate", prompt: "/n/ 舌尖在前", text: "sin", targetPhonemes: ["n"] },
      { kind: "isolate", prompt: "/ŋ/ 舌根在后", text: "sing", targetPhonemes: ["ng"] },
      { kind: "contrast", prompt: "前后鼻音对比", text: "sin sing", targetPhonemes: ["n", "ng"] },
      { kind: "retry", prompt: "原速再录一次", text: "sing", targetPhonemes: ["ng"] },
    ],
  },
];

export function detectErrorPatterns(
  input: ErrorPatternDetectionInput,
): ErrorPattern[] {
  return TRAINING_ERROR_PATTERNS.filter((pattern) => {
    if (!pattern.appliesToPackIds.includes(input.packId)) return false;
    const detection = pattern.detection;
    if (
      detection.issueTypes &&
      input.issueType &&
      !detection.issueTypes.includes(input.issueType)
    ) {
      return false;
    }
    if (detection.requiresFinalPosition && !input.isFinalPosition) return false;
    if (
      detection.targetPhonemes.length > 0 &&
      !detection.targetPhonemes.some((phoneme) =>
        input.targetPhonemes.includes(phoneme),
      )
    ) {
      return false;
    }
    if (
      detection.maxTargetScore != null &&
      input.targetScore > detection.maxTargetScore
    ) {
      return false;
    }
    if (
      detection.minTargetScoreDrop != null &&
      input.overallScore - input.targetScore < detection.minTargetScoreDrop
    ) {
      return false;
    }
    return true;
  });
}

export function getErrorPatternIdsForIssue(issue: DiagnosisIssue): string[] {
  return TRAINING_ERROR_PATTERNS.filter((pattern) => {
    if (!issue.recommendedPackIds.some((packId) => pattern.appliesToPackIds.includes(packId))) {
      return false;
    }
    if (
      pattern.detection.issueTypes &&
      !pattern.detection.issueTypes.includes(issue.type)
    ) {
      return false;
    }
    return pattern.detection.targetPhonemes.length === 0
      ? true
      : pattern.detection.targetPhonemes.some((phoneme) =>
          issue.targetPhonemes.includes(phoneme),
        );
  }).map((pattern) => pattern.id);
}

export function getRemediationPath(pathId: string): RemediationPath | null {
  return DEFAULT_REMEDIATION_PATHS.find((path) => path.id === pathId) ?? null;
}
