import type {
  AttemptAnalysis,
  TrainingCourseItem,
  TrainingPack,
} from "@/types/training";
import { TRAINING_ERROR_PATTERNS } from "./training-error-patterns";

export interface DeepPracticeStep {
  label: string;
  instruction: string;
  text: string;
}

export interface DeepPracticeCoach {
  status: "lock-in" | "repair" | "stuck-prep";
  title: string;
  diagnosis: string;
  bodyCheck: string;
  listeningCheck: string;
  microDrill: DeepPracticeStep[];
  moveOnRule: string;
  reflectionPrompt: string;
}

interface DeepPracticeCoachInput {
  pack: TrainingPack;
  item: TrainingCourseItem;
  analysis: AttemptAnalysis;
  failedAttempts: number;
}

interface DeepPracticeRecipe {
  bodyCheck: string;
  listeningCheck: string;
  microDrill: DeepPracticeStep[];
}

const GENERIC_RECIPE: DeepPracticeRecipe = {
  bodyCheck: "把速度降下来，只确认目标音的口型和气流，不急着读完整句。",
  listeningCheck: "回听时只问一个问题：目标音有没有比上一遍更清楚。",
  microDrill: [
    {
      label: "单独目标",
      instruction: "先把目标音或关键词慢速做清楚。",
      text: "target sound",
    },
    {
      label: "放回单词",
      instruction: "保持同一个动作，把它放回原词。",
      text: "target word",
    },
    {
      label: "原题复测",
      instruction: "恢复正常速度，但只保留刚才那个动作。",
      text: "retry",
    },
  ],
};

const RECIPES: Record<string, DeepPracticeRecipe> = {
  "target-low-overall-high": {
    bodyCheck: "整词能听懂，但关键音没有变。先把目标动作放大 20%，再读完整词。",
    listeningCheck: "回听时忽略整句顺不顺，只听目标音有没有被清楚地听见。",
    microDrill: [
      {
        label: "抽出来",
        instruction: "只读目标音所在的最小片段，速度降到一半。",
        text: "target",
      },
      {
        label: "接回去",
        instruction: "目标动作不变，把前后音接上。",
        text: "target word",
      },
      {
        label: "不加速复测",
        instruction: "复测时宁可慢，也不要丢掉关键动作。",
        text: "retry slowly",
      },
    ],
  },
  "tongue-between-teeth": {
    bodyCheck: "舌尖轻轻露出一点点，牙齿只夹住边缘，气流从舌尖齿缝出去。",
    listeningCheck: "think 不能像 sink；如果听到尖锐 /s/，说明舌尖缩回去了。",
    microDrill: [
      {
        label: "吹气",
        instruction: "只做无声齿间气流，舌尖不要收回。",
        text: "thin",
      },
      {
        label: "接词尾",
        instruction: "保留舌尖位置，再接后面的 vowel/consonant。",
        text: "think",
      },
      {
        label: "对比",
        instruction: "交替读 sink/think，把 /s/ 和 /θ/ 拉开。",
        text: "sink think",
      },
    ],
  },
  "voiced-th-z": {
    bodyCheck: "舌尖在齿间，同时手摸喉咙确认有震动。",
    listeningCheck: "this 不能像 zis 或 dis；如果太尖，舌尖可能缩回去了。",
    microDrill: [
      {
        label: "震动",
        instruction: "先读 then，确认喉咙震动。",
        text: "then",
      },
      {
        label: "轻夹",
        instruction: "舌尖轻夹，不要爆破成 /d/。",
        text: "this",
      },
      {
        label: "短语",
        instruction: "把 /ð/ 放进短语，仍然保留震动。",
        text: "this one",
      },
    ],
  },
  "lip-teeth-round-lips": {
    bodyCheck: "/v/ 用上齿轻碰下唇；/w/ 双唇收圆向前推，两个嘴型必须分开。",
    listeningCheck: "very 不能像 wary；west 不能像 vest。",
    microDrill: [
      {
        label: "唇齿",
        instruction: "先咬一点下唇，读 /v/。",
        text: "very",
      },
      {
        label: "圆唇",
        instruction: "双唇收圆，再推出 /w/。",
        text: "well",
      },
      {
        label: "切换",
        instruction: "一口气切换两种嘴型。",
        text: "vest west",
      },
    ],
  },
  "vowel-length-ee-ih": {
    bodyCheck:
      "/iː/ 舌位高前、舌体较紧；/ɪ/ 略低略后、舌体放松。时长只作辅助检查。",
    listeningCheck:
      "换说话人和词后，仍应先靠音质与舌位对应的听感区分两类元音。",
    microDrill: [
      {
        label: "高前紧音质",
        instruction: "保持 /iː/ 的高前舌位和较紧舌体。",
        text: "sleep",
      },
      {
        label: "略低后松音质",
        instruction: "让 /ɪ/ 的舌位略低后并放松，不只追求短。",
        text: "ship",
      },
      {
        label: "音质对比",
        instruction: "先稳定舌位和音质，再回到自然语速检查时长。",
        text: "sleep ship",
      },
    ],
  },
  "open-jaw-ae": {
    bodyCheck: "下巴真的向下打开，舌前部放平，不要挤成小口型 /e/。",
    listeningCheck: "bad/man/sat 不能听起来像 bed/men/set。",
    microDrill: [
      {
        label: "开口",
        instruction: "像打哈欠开头一样打开 /æ/。",
        text: "bad",
      },
      {
        label: "保持",
        instruction: "开口保持到词尾，不要中途收小。",
        text: "man",
      },
      {
        label: "对比",
        instruction: "一大一小，开口差距要听得出来。",
        text: "bed bad",
      },
    ],
  },
  "tongue-l-r": {
    bodyCheck: "/l/ 舌尖碰齿龈；/r/ 舌头悬空后卷，不碰上颚。",
    listeningCheck: "light/right 的开头要靠舌尖碰与不碰区分。",
    microDrill: [
      {
        label: "碰",
        instruction: "舌尖明确碰一下。",
        text: "light",
      },
      {
        label: "悬空",
        instruction: "舌头后卷但不要碰上颚。",
        text: "right",
      },
      {
        label: "切换",
        instruction: "碰与不碰连续切换。",
        text: "light right",
      },
    ],
  },
  "final-consonant-release": {
    bodyCheck: "词尾只做闭合或轻释放，不加中文式尾音。",
    listeningCheck: "back 不能变成 ba，也不能变成 back-uh。",
    microDrill: [
      {
        label: "闭合",
        instruction: "慢速收住词尾，不额外加元音。",
        text: "back",
      },
      {
        label: "轻释放",
        instruction: "轻轻放开，不要读成第二个音节。",
        text: "bake",
      },
      {
        label: "短语",
        instruction: "放进短语仍然收住尾音。",
        text: "take it back",
      },
    ],
  },
  "weak-forms-rhythm": {
    bodyCheck: "内容词顶出来，to/of/a/the 这类虚词变轻、变短。",
    listeningCheck: "如果每个词一样重，句子会像逐词朗读而不是自然英语。",
    microDrill: [
      {
        label: "标重音",
        instruction: "只突出内容词。",
        text: "WANT TALK IT",
      },
      {
        label: "加虚词",
        instruction: "虚词轻轻滑过去。",
        text: "want to talk about it",
      },
      {
        label: "自然句",
        instruction: "保持重轻对比，不要每词等重。",
        text: "I want to talk about it.",
      },
    ],
  },
  "rounded-vowel-oo-uh": {
    bodyCheck:
      "/uː/ 舌位高后、圆唇充分；/ʊ/ 略低前、更放松少圆唇。时长只作辅助。",
    listeningCheck:
      "先听音质与圆唇差异，再观察重音和相邻音造成的自然时长变化。",
    microDrill: [
      {
        label: "高后圆唇",
        instruction: "保持高后舌位和充分圆唇。",
        text: "pool",
      },
      {
        label: "略低前放松",
        instruction: "舌位略低前、圆唇较少并放松。",
        text: "pull",
      },
      {
        label: "对比",
        instruction: "先拉开音质、舌位和圆唇，再检查自然时长。",
        text: "pool pull",
      },
    ],
  },
  "back-nasal-ng": {
    bodyCheck: "/n/ 舌尖在前；/ŋ/ 舌尖放下，舌根抬到软腭。",
    listeningCheck: "sing 不能像 sin，也不要额外加 /g/。",
    microDrill: [
      {
        label: "前鼻音",
        instruction: "舌尖在前，读 /n/。",
        text: "sin",
      },
      {
        label: "后鼻音",
        instruction: "舌根在后，别加 /g/。",
        text: "sing",
      },
      {
        label: "对比",
        instruction: "前后位置切换要明显。",
        text: "sin sing",
      },
    ],
  },
};

function primaryPatternId(analysis: AttemptAnalysis): string {
  return (
    analysis.primaryPatternId ??
    analysis.detectedPatternIds[0] ??
    "target-low-overall-high"
  );
}

function recipeFor(patternId: string): DeepPracticeRecipe {
  return RECIPES[patternId] ?? GENERIC_RECIPE;
}

function statusFor(
  analysis: AttemptAnalysis,
  failedAttempts: number,
): DeepPracticeCoach["status"] {
  if (analysis.passed) return "lock-in";
  if (failedAttempts >= 2) return "stuck-prep";
  return "repair";
}

function titleFor(status: DeepPracticeCoach["status"]): string {
  if (status === "lock-in") return "锁定这次过线的手感";
  if (status === "stuck-prep") return "先拆开，不要硬刷下一遍";
  return "本次失败要这样修";
}

function diagnosisFor(
  pack: TrainingPack,
  item: TrainingCourseItem,
  analysis: AttemptAnalysis,
  patternId: string,
): string {
  const pattern = TRAINING_ERROR_PATTERNS.find(
    (entry) => entry.id === patternId,
  );
  const targetText = item.displayText ?? item.referenceText ?? item.text;
  if (analysis.passed) {
    return `${targetText} 的目标音已经过线。现在要记住刚才的动作，而不是立刻换速度。`;
  }
  if (analysis.scoreGap >= 12) {
    return `${targetText} 的整词/整句分比目标音高 ${analysis.scoreGap} 分，说明整体可懂，但「${pack.focus}」还没有真正改掉。`;
  }
  return pattern
    ? `${targetText} 暴露出「${pattern.title}」。这不是多读几遍的问题，要先把动作拆开。`
    : `${targetText} 的目标音还没过线。先慢速定位，再回到原题。`;
}

function moveOnRuleFor(
  analysis: AttemptAnalysis,
  failedAttempts: number,
): string {
  if (analysis.passed) {
    return "再复现 1 遍同样动作，如果仍过线，就进入下一题。";
  }
  if (failedAttempts >= 2) {
    return "先完成慢速拆解，再回到原题复测；不要直接用原速硬刷。";
  }
  return "下一遍只改上面的身体检查点，目标音过线再继续。";
}

function reflectionPromptFor(
  analysis: AttemptAnalysis,
  failedAttempts: number,
): string {
  if (analysis.passed) {
    return "刚才哪一个动作让分数上来了？下一题继续复制它。";
  }
  if (failedAttempts >= 2) {
    return "如果只能改一个动作，你下一遍会改舌位、嘴型、气流、时长，还是词尾？";
  }
  return "回听上一遍时，目标音是太像母语替代音、太短、太重，还是被吞掉了？";
}

export function buildDeepPracticeCoach({
  pack,
  item,
  analysis,
  failedAttempts,
}: DeepPracticeCoachInput): DeepPracticeCoach {
  const patternId = primaryPatternId(analysis);
  const recipe = recipeFor(patternId);
  const status = statusFor(analysis, failedAttempts);

  return {
    status,
    title: titleFor(status),
    diagnosis: diagnosisFor(pack, item, analysis, patternId),
    bodyCheck: analysis.passed ? item.successCue : recipe.bodyCheck,
    listeningCheck: recipe.listeningCheck,
    microDrill: recipe.microDrill,
    moveOnRule: moveOnRuleFor(analysis, failedAttempts),
    reflectionPrompt: reflectionPromptFor(analysis, failedAttempts),
  };
}
