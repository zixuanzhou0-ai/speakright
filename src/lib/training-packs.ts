import type { DrillItem } from "@/types/drill";
import {
  DEFAULT_REMEDIATION_PATHS,
  TRAINING_ERROR_PATTERNS,
} from "./training-error-patterns";
import type {
  LevelPassRule,
  MasteryRule,
  MinimalPairItem,
  TrainingCourseItem,
  TrainingLevel,
  TrainingPack,
} from "@/types/training";

const DEFAULT_RULE: MasteryRule = {
  perceptionCorrectRate: 0.85,
  targetPassScore: 82,
  wordRecentPasses: 2,
  wordRecentWindow: 3,
  sentencePasses: 2,
  mixedReviewAverage: 82,
  maxStuckCount: 0,
};

const PASS_RULES: Record<string, LevelPassRule> = {
  perception: { minCorrectRate: 0.85 },
  articulation: { requiredPasses: 1 },
  syllable: { minTargetScore: 78, requiredPasses: 5 },
  word: { minTargetScore: 82, requiredPasses: 9 },
  "minimal-pair": { minTargetScore: 82, requiredPasses: 6 },
  sentence: { minTargetScore: 82, requiredPasses: 6 },
  shadowing: { minTargetScore: 82, requiredPasses: 2 },
  "mixed-review": { minAverageScore: 82, requiredPasses: 5 },
};

function item(
  text: string,
  ipa: string,
  phoneme: string,
  description: string,
): DrillItem {
  return { text, ipa, phoneme, description };
}

export const DEFAULT_RECOMMENDED_PACK_IDS = [
  "final-consonants",
  "ee-ih",
  "eh-ae",
  "stress-rhythm",
  "v-w",
];

export const TRAINING_PACKS: TrainingPack[] = [
  {
    id: "ee-ih",
    title: "区分 sheep / ship",
    focus: "/iː/ 要拉长绷紧，/ɪ/ 要短促放松",
    targetPhonemes: ["ee", "ih"],
    contrastPhonemes: ["ee", "ih"],
    l1Problem: "中文里没有 /ɪ/，很多学习者会把 ship 读得像 sheep。",
    mouthCue:
      "/iː/ 嘴角向两边拉、舌位高且紧；/ɪ/ 嘴巴微张、舌头放松，声音立刻收住。",
    perceptionItems: [
      {
        wordA: "sheep",
        wordB: "ship",
        audioA: "/audio/words/blue/sheep.mp3",
        audioB: "/audio/words/pink/ship.mp3",
      },
      {
        wordA: "seat",
        wordB: "sit",
        audioA: "/audio/words/blue/seat.mp3",
        audioB: "/audio/words/pink/sit.mp3",
      },
      {
        wordA: "feet",
        wordB: "fit",
        audioA: "/audio/words/blue/feet.mp3",
        audioB: "/audio/words/pink/fit.mp3",
      },
      {
        wordA: "beach",
        wordB: "bit",
        audioA: "/audio/words/blue/beach.mp3",
        audioB: "/audio/words/pink/bit.mp3",
      },
    ],
    wordLadder: [
      item("sheep", "/ʃiːp/", "ee", "先把 /iː/ 拉满，再干净收住 /p/。"),
      item("ship", "/ʃɪp/", "ih", "/ɪ/ 不要拖长，像短促的轻声。"),
      item("green", "/ɡriːn/", "ee", "舌位保持高，声音持续到 /n/ 前。"),
      item("give", "/ɡɪv/", "ih", "嘴巴放松，/v/ 用上齿轻碰下唇。"),
    ],
    minimalPairs: [
      {
        wordA: "sheep",
        ipaA: "/ʃiːp/",
        phonemeA: "ee",
        wordB: "ship",
        ipaB: "/ʃɪp/",
        phonemeB: "ih",
      },
      {
        wordA: "seat",
        ipaA: "/siːt/",
        phonemeA: "ee",
        wordB: "sit",
        ipaB: "/sɪt/",
        phonemeB: "ih",
      },
      {
        wordA: "feet",
        ipaA: "/fiːt/",
        phonemeA: "ee",
        wordB: "fit",
        ipaB: "/fɪt/",
        phonemeB: "ih",
      },
      {
        wordA: "leave",
        ipaA: "/liːv/",
        phonemeA: "ee",
        wordB: "live",
        ipaB: "/lɪv/",
        phonemeB: "ih",
      },
    ],
    sentenceLadder: [
      item(
        "The sheep is on the ship.",
        "",
        "ee",
        "交替拉长 sheep，缩短 ship。",
      ),
      item("Please sit in this seat.", "", "ih", "seat 拉长，sit 和 this 放短。"),
      item("I will leave it in the kitchen.", "", "ih", "leave 长，it/in 短。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 15,
  },
  {
    id: "eh-ae",
    title: "打开 bad / bed",
    focus: "/æ/ 要打开下巴，不能读成 /e/",
    targetPhonemes: ["ae", "eh"],
    contrastPhonemes: ["ae", "eh"],
    l1Problem: "中文学习者常把 /æ/ 收得太小，man 听起来像 men。",
    mouthCue:
      "/æ/ 下巴向下打开，舌前部抬起但舌面放平；/e/ 开口更小，声音更靠前。",
    perceptionItems: [
      {
        wordA: "bed",
        wordB: "bad",
        audioA: "/audio/words/blue/bed.mp3",
        audioB: "/audio/words/pink/bad.mp3",
      },
      {
        wordA: "men",
        wordB: "man",
        audioA: "/audio/words/blue/men.mp3",
        audioB: "/audio/words/pink/man.mp3",
      },
      {
        wordA: "pen",
        wordB: "pan",
        audioA: "/audio/words/blue/pen.mp3",
        audioB: "/audio/words/pink/pan.mp3",
      },
      {
        wordA: "set",
        wordB: "sat",
        audioA: "/audio/words/blue/set.mp3",
        audioB: "/audio/words/pink/sat.mp3",
      },
    ],
    wordLadder: [
      item("bad", "/bæd/", "ae", "像打哈欠开头，下巴真的往下掉。"),
      item("bed", "/bed/", "eh", "开口较小，别把下巴拉太低。"),
      item("man", "/mæn/", "ae", "/æ/ 要饱满，不要读成 men。"),
      item("better", "/ˈbetər/", "eh", "重音在第一个音节，/e/ 清楚短促。"),
    ],
    minimalPairs: [
      {
        wordA: "bed",
        ipaA: "/bed/",
        phonemeA: "eh",
        wordB: "bad",
        ipaB: "/bæd/",
        phonemeB: "ae",
      },
      {
        wordA: "men",
        ipaA: "/men/",
        phonemeA: "eh",
        wordB: "man",
        ipaB: "/mæn/",
        phonemeB: "ae",
      },
      {
        wordA: "pen",
        ipaA: "/pen/",
        phonemeA: "eh",
        wordB: "pan",
        ipaB: "/pæn/",
        phonemeB: "ae",
      },
      {
        wordA: "set",
        ipaA: "/set/",
        phonemeA: "eh",
        wordB: "sat",
        ipaB: "/sæt/",
        phonemeB: "ae",
      },
    ],
    sentenceLadder: [
      item("The bad man sat on the bed.", "", "ae", "bad/man/sat 要打开。"),
      item("Ben packed a red bag.", "", "ae", "packed/bag 开口更大。"),
      item("That answer made sense.", "", "ae", "that/answer 和 sense 对比。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 14,
  },
  {
    id: "s-th",
    title: "把 think 读出 /θ/",
    focus: "舌尖必须伸到齿间，不能缩回去读 /s/",
    targetPhonemes: ["th"],
    contrastPhonemes: ["s"],
    l1Problem: "中文没有齿间擦音，think 很容易读成 sink。",
    mouthCue:
      "舌尖轻轻伸出，上下齿夹住一点点，气流从舌尖和齿缝之间摩擦出去，声带不振动。",
    perceptionItems: [
      {
        wordA: "sink",
        wordB: "think",
        audioA: "/audio/words/blue/sink.mp3",
        audioB: "/audio/words/pink/think.mp3",
      },
      {
        wordA: "mouse",
        wordB: "mouth",
        audioA: "/audio/words/blue/mouse.mp3",
        audioB: "/audio/words/pink/mouth.mp3",
      },
      {
        wordA: "pass",
        wordB: "path",
        audioA: "/audio/words/blue/pass.mp3",
        audioB: "/audio/words/pink/path.mp3",
      },
      {
        wordA: "sick",
        wordB: "thick",
        audioA: "/audio/words/blue/sick.mp3",
        audioB: "/audio/words/pink/thick.mp3",
      },
    ],
    wordLadder: [
      item("think", "/θɪŋk/", "th", "先伸舌，再送气，最后收 /ŋk/。"),
      item("three", "/θriː/", "th", "/θ/ 后直接接 /r/，不要加元音。"),
      item("mouth", "/maʊθ/", "th", "词尾 /θ/ 也要有气流，不要吞掉。"),
      item("health", "/helθ/", "th", "先读清 /l/，再伸舌发 /θ/。"),
    ],
    minimalPairs: [
      {
        wordA: "sink",
        ipaA: "/sɪŋk/",
        phonemeA: "s",
        wordB: "think",
        ipaB: "/θɪŋk/",
        phonemeB: "th",
      },
      {
        wordA: "mouse",
        ipaA: "/maʊs/",
        phonemeA: "s",
        wordB: "mouth",
        ipaB: "/maʊθ/",
        phonemeB: "th",
      },
      {
        wordA: "pass",
        ipaA: "/pæs/",
        phonemeA: "s",
        wordB: "path",
        ipaB: "/pæθ/",
        phonemeB: "th",
      },
      {
        wordA: "sick",
        ipaA: "/sɪk/",
        phonemeA: "s",
        wordB: "thick",
        ipaB: "/θɪk/",
        phonemeB: "th",
      },
    ],
    sentenceLadder: [
      item("I think three things are important.", "", "th", "think/three/things 都要伸舌。"),
      item("The path is narrow but smooth.", "", "th", "path 词尾 /θ/ 不要读成 /s/。"),
      item("Thank you for the thoughtful answer.", "", "th", "thank/thoughtful 保持气流。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 16,
  },
  {
    id: "z-dh",
    title: "分清 then / zen",
    focus: "/ð/ 是有声齿间音，不是 /z/ 或 /d/",
    targetPhonemes: ["dh"],
    contrastPhonemes: ["z"],
    l1Problem: "the、this、weather 常被读成 ze、zis、wezzer。",
    mouthCue:
      "舌尖像 /θ/ 一样放在齿间，但声带要振动。手摸喉咙，应能感觉震动。",
    perceptionItems: [
      {
        wordA: "zen",
        wordB: "then",
        audioA: "/audio/words/blue/zen.mp3",
        audioB: "/audio/words/pink/then.mp3",
      },
      {
        wordA: "breeze",
        wordB: "breathe",
        audioA: "/audio/words/blue/breeze.mp3",
        audioB: "/audio/words/pink/breathe.mp3",
      },
      {
        wordA: "tease",
        wordB: "teethe",
        audioA: "/audio/words/blue/tease.mp3",
        audioB: "/audio/words/pink/teethe.mp3",
      },
      {
        wordA: "clothes",
        wordB: "clothe",
        audioA: "/audio/words/blue/clothes.mp3",
        audioB: "/audio/words/pink/clothe.mp3",
      },
    ],
    wordLadder: [
      item("then", "/ðen/", "dh", "伸舌加声带震动，不要缩回读 /z/。"),
      item("this", "/ðɪs/", "dh", "this 的开头不是 zis。"),
      item("father", "/ˈfɑːðər/", "dh", "中间 /ð/ 要轻，不要爆破成 /d/。"),
      item("breathe", "/briːð/", "dh", "词尾 /ð/ 仍然要有振动。"),
    ],
    minimalPairs: [
      {
        wordA: "zen",
        ipaA: "/zen/",
        phonemeA: "z",
        wordB: "then",
        ipaB: "/ðen/",
        phonemeB: "dh",
      },
      {
        wordA: "breeze",
        ipaA: "/briːz/",
        phonemeA: "z",
        wordB: "breathe",
        ipaB: "/briːð/",
        phonemeB: "dh",
      },
      {
        wordA: "tease",
        ipaA: "/tiːz/",
        phonemeA: "z",
        wordB: "teethe",
        ipaB: "/tiːð/",
        phonemeB: "dh",
      },
      {
        wordA: "close",
        ipaA: "/kloʊz/",
        phonemeA: "z",
        wordB: "clothe",
        ipaB: "/kloʊð/",
        phonemeB: "dh",
      },
    ],
    sentenceLadder: [
      item("This is the best way.", "", "dh", "this/the 都要轻触齿间。"),
      item("My father said the weather was pleasant.", "", "dh", "father/the/weather 连续保持 /ð/。"),
      item("Breathe in and then breathe out.", "", "dh", "breathe/then 都要有声。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 15,
  },
  {
    id: "v-w",
    title: "分清 very / wary",
    focus: "/v/ 用上齿咬下唇，/w/ 是双唇收圆",
    targetPhonemes: ["v", "w"],
    contrastPhonemes: ["v", "w"],
    l1Problem: "很多中文学习者把 very 读成 wery，或者把 water 开头读得太硬。",
    mouthCue:
      "/v/ 是唇齿摩擦，气流从上齿和下唇缝里挤出；/w/ 双唇收圆向前推出。",
    perceptionItems: [
      {
        wordA: "vest",
        wordB: "west",
        audioA: "/audio/words/blue/vest.mp3",
        audioB: "/audio/words/pink/west.mp3",
      },
      {
        wordA: "vine",
        wordB: "wine",
        audioA: "/audio/words/blue/vine.mp3",
        audioB: "/audio/words/pink/wine.mp3",
      },
      {
        wordA: "voice",
        wordB: "water",
        audioA: "/audio/words/blue/voice.mp3",
        audioB: "/audio/words/pink/water.mp3",
      },
      {
        wordA: "very",
        wordB: "walk",
        audioA: "/audio/words/blue/very.mp3",
        audioB: "/audio/words/pink/walk.mp3",
      },
    ],
    wordLadder: [
      item("very", "/ˈveri/", "v", "上齿轻碰下唇，声音持续摩擦。"),
      item("water", "/ˈwɔːtər/", "w", "双唇收圆后快速打开。"),
      item("voice", "/vɔɪs/", "v", "/v/ 有声带震动，不是 /f/。"),
      item("world", "/wɝːld/", "w", "/w/ 后接卷舌元音，再读 dark L。"),
    ],
    minimalPairs: [
      {
        wordA: "vest",
        ipaA: "/vest/",
        phonemeA: "v",
        wordB: "west",
        ipaB: "/west/",
        phonemeB: "w",
      },
      {
        wordA: "vine",
        ipaA: "/vaɪn/",
        phonemeA: "v",
        wordB: "wine",
        ipaB: "/waɪn/",
        phonemeB: "w",
      },
      {
        wordA: "vet",
        ipaA: "/vet/",
        phonemeA: "v",
        wordB: "wet",
        ipaB: "/wet/",
        phonemeB: "w",
      },
      {
        wordA: "veil",
        ipaA: "/veɪl/",
        phonemeA: "v",
        wordB: "whale",
        ipaB: "/weɪl/",
        phonemeB: "w",
      },
    ],
    sentenceLadder: [
      item("Very few visitors waited outside.", "", "v", "very/visitors 用 /v/，waited 用 /w/。"),
      item("We watched a video about waves.", "", "w", "we/watched/waves 双唇收圆。"),
      item("The voice was warm and vivid.", "", "v", "voice/vivid 是 /v/，warm 是 /w/。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 14,
  },
  {
    id: "l-r",
    title: "分清 light / right",
    focus: "/l/ 舌尖要碰齿龈，/r/ 舌头卷起但不碰",
    targetPhonemes: ["l", "r"],
    contrastPhonemes: ["l", "r"],
    l1Problem: "部分学习者会把 /r/ 读成 /l/，或词尾 dark L 直接吞掉。",
    mouthCue:
      "/l/ 舌尖碰上齿龈；/r/ 舌尖卷起悬空，嘴唇略收圆，不能碰到上颚。",
    perceptionItems: [
      {
        wordA: "light",
        wordB: "right",
        audioA: "/audio/words/blue/light.mp3",
        audioB: "/audio/words/pink/right.mp3",
      },
      {
        wordA: "glass",
        wordB: "grass",
        audioA: "/audio/words/blue/glass.mp3",
        audioB: "/audio/words/pink/grass.mp3",
      },
      {
        wordA: "fly",
        wordB: "fry",
        audioA: "/audio/words/blue/fly.mp3",
        audioB: "/audio/words/pink/fry.mp3",
      },
      {
        wordA: "long",
        wordB: "run",
        audioA: "/audio/words/blue/long.mp3",
        audioB: "/audio/words/pink/run.mp3",
      },
    ],
    wordLadder: [
      item("light", "/laɪt/", "l", "舌尖先顶上齿龈，再放开。"),
      item("right", "/raɪt/", "r", "舌头悬空卷起，不碰上颚。"),
      item("world", "/wɝːld/", "l", "词尾 dark L 要厚，不要吞。"),
      item("really", "/ˈriːəli/", "r", "开头 /r/ 悬空，后面轻读。"),
    ],
    minimalPairs: [
      {
        wordA: "light",
        ipaA: "/laɪt/",
        phonemeA: "l",
        wordB: "right",
        ipaB: "/raɪt/",
        phonemeB: "r",
      },
      {
        wordA: "glass",
        ipaA: "/ɡlæs/",
        phonemeA: "l",
        wordB: "grass",
        ipaB: "/ɡræs/",
        phonemeB: "r",
      },
      {
        wordA: "fly",
        ipaA: "/flaɪ/",
        phonemeA: "l",
        wordB: "fry",
        ipaB: "/fraɪ/",
        phonemeB: "r",
      },
      {
        wordA: "lead",
        ipaA: "/liːd/",
        phonemeA: "l",
        wordB: "read",
        ipaB: "/riːd/",
        phonemeB: "r",
      },
    ],
    sentenceLadder: [
      item("The red light is really bright.", "", "r", "red/really/bright 和 light 对比。"),
      item("Please read the long list clearly.", "", "l", "read 是 /r/，long/list/clearly 有 /l/。"),
      item("The world feels larger after travel.", "", "l", "world/feels/larger 保持 L 和 R 区分。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 16,
  },
  {
    id: "final-consonants",
    title: "词尾别吞",
    focus: "把 /t d k g p b s z l/ 收干净，不额外加元音",
    targetPhonemes: ["t", "d", "k", "g", "p", "b", "s", "z", "l"],
    l1Problem: "中文音节很少以爆破音结尾，asked、world、help 容易吞尾或加成 help-uh。",
    mouthCue:
      "词尾辅音要形成口腔闭合或摩擦，但不要加中文式的“呃”。短、轻、干净。",
    perceptionItems: [
      {
        wordA: "ask",
        wordB: "asked",
        audioA: "/audio/words/blue/ask.mp3",
        audioB: "/audio/words/pink/asked.mp3",
      },
      {
        wordA: "fee",
        wordB: "feel",
        audioA: "/audio/words/blue/fee.mp3",
        audioB: "/audio/words/pink/feel.mp3",
      },
      {
        wordA: "bay",
        wordB: "bake",
        audioA: "/audio/words/blue/bay.mp3",
        audioB: "/audio/words/pink/bake.mp3",
      },
      {
        wordA: "lie",
        wordB: "light",
        audioA: "/audio/words/blue/lie.mp3",
        audioB: "/audio/words/pink/light.mp3",
      },
    ],
    wordLadder: [
      item("asked", "/æskt/", "t", "最后 /skt/ 是一串短闭合，不要加元音。"),
      item("world", "/wɝːld/", "l", "dark L 后还有 /d/，不要停在 wor。"),
      item("help", "/help/", "p", "双唇闭合收住，不读 help-uh。"),
      item("books", "/bʊks/", "s", "/ks/ 一口气收干净。"),
    ],
    minimalPairs: [
      {
        wordA: "fee",
        ipaA: "/fiː/",
        phonemeA: "ee",
        wordB: "feel",
        ipaB: "/fiːl/",
        phonemeB: "l",
      },
      {
        wordA: "lie",
        ipaA: "/laɪ/",
        phonemeA: "ai",
        wordB: "light",
        ipaB: "/laɪt/",
        phonemeB: "t",
      },
      {
        wordA: "bay",
        ipaA: "/beɪ/",
        phonemeA: "ey",
        wordB: "bake",
        ipaB: "/beɪk/",
        phonemeB: "k",
      },
      {
        wordA: "row",
        ipaA: "/roʊ/",
        phonemeA: "oh",
        wordB: "road",
        ipaB: "/roʊd/",
        phonemeB: "d",
      },
    ],
    sentenceLadder: [
      item("I asked for help with the books.", "", "t", "asked/help/books 词尾都要收住。"),
      item("The world looked quiet and cold.", "", "d", "world/looked/cold 不要吞尾。"),
      item("Please keep the cup on the desk.", "", "p", "keep/cup/desk 结尾短促。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 17,
  },
  {
    id: "stress-rhythm",
    title: "重音、弱读和连读",
    focus: "实词重、虚词轻，让英语有节奏",
    targetPhonemes: ["schwa", "t", "d"],
    l1Problem: "中文倾向每个字等长，英语需要重音等时、虚词弱读和词间连接。",
    mouthCue:
      "名词动词形容词拉开，the/to/of/a 等虚词轻读成 /ə/；辅音接元音要连起来。",
    perceptionItems: [
      {
        wordA: "to",
        wordB: "today",
        audioA: "/audio/words/blue/to.mp3",
        audioB: "/audio/words/pink/today.mp3",
      },
      {
        wordA: "a",
        wordB: "away",
        audioA: "/audio/words/blue/a.mp3",
        audioB: "/audio/words/pink/away.mp3",
      },
      {
        wordA: "of",
        wordB: "off",
        audioA: "/audio/words/blue/of.mp3",
        audioB: "/audio/words/pink/off.mp3",
      },
      {
        wordA: "can",
        wordB: "can't",
        audioA: "/audio/words/blue/can.mp3",
        audioB: "/audio/words/pink/can't.mp3",
      },
    ],
    wordLadder: [
      item("today", "/təˈdeɪ/", "schwa", "to 弱读成 /tə/，重音落在 day。"),
      item("about", "/əˈbaʊt/", "schwa", "开头 /ə/ 很轻，不要读 /eɪ/。"),
      item("water", "/ˈwɔːtər/", "t", "美式 t 可轻弹成 [ɾ]。"),
      item("important", "/ɪmˈpɔːrtənt/", "schwa", "重音在 por，末尾轻收。"),
    ],
    minimalPairs: [
      {
        wordA: "can",
        ipaA: "/kən/",
        phonemeA: "schwa",
        wordB: "can't",
        ipaB: "/kænt/",
        phonemeB: "ae",
      },
      {
        wordA: "to",
        ipaA: "/tə/",
        phonemeA: "schwa",
        wordB: "two",
        ipaB: "/tuː/",
        phonemeB: "oo",
      },
      {
        wordA: "of",
        ipaA: "/əv/",
        phonemeA: "schwa",
        wordB: "off",
        ipaB: "/ɔːf/",
        phonemeB: "aw",
      },
      {
        wordA: "a",
        ipaA: "/ə/",
        phonemeA: "schwa",
        wordB: "ay",
        ipaB: "/eɪ/",
        phonemeB: "ey",
      },
    ],
    sentenceLadder: [
      item("I want to talk about it.", "", "schwa", "want to 连成 wanna 的感觉，about 开头弱。"),
      item("She is going to pick it up.", "", "schwa", "going to 弱化，pick it up 连读。"),
      item("A cup of coffee is on the table.", "", "schwa", "a/of/the 弱读，coffee/table 重读。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 18,
  },
  {
    id: "oo-uh",
    title: "分清 pool / pull",
    focus: "/uː/ 长且圆，/ʊ/ 短且放松",
    targetPhonemes: ["oo", "uh"],
    contrastPhonemes: ["oo", "uh"],
    l1Problem: "很多学习者把 look 拉得太长，听起来像 Luke。",
    mouthCue:
      "/uː/ 嘴唇更圆更突出，声音拉长；/ʊ/ 嘴唇少突出，声音短、松、快。",
    perceptionItems: [
      {
        wordA: "pool",
        wordB: "pull",
        audioA: "/audio/words/blue/pool.mp3",
        audioB: "/audio/words/pink/pull.mp3",
      },
      {
        wordA: "fool",
        wordB: "full",
        audioA: "/audio/words/blue/fool.mp3",
        audioB: "/audio/words/pink/full.mp3",
      },
      {
        wordA: "Luke",
        wordB: "look",
        audioA: "/audio/words/blue/luke.mp3",
        audioB: "/audio/words/pink/look.mp3",
      },
      {
        wordA: "food",
        wordB: "foot",
        audioA: "/audio/words/blue/food.mp3",
        audioB: "/audio/words/pink/foot.mp3",
      },
    ],
    wordLadder: [
      item("pool", "/puːl/", "oo", "/uː/ 拉长，最后 dark L 收住。"),
      item("pull", "/pʊl/", "uh", "/ʊ/ 短，不要拖长。"),
      item("food", "/fuːd/", "oo", "嘴唇圆，声音持续到 /d/。"),
      item("look", "/lʊk/", "uh", "短促，结尾 /k/ 干净。"),
    ],
    minimalPairs: [
      {
        wordA: "pool",
        ipaA: "/puːl/",
        phonemeA: "oo",
        wordB: "pull",
        ipaB: "/pʊl/",
        phonemeB: "uh",
      },
      {
        wordA: "fool",
        ipaA: "/fuːl/",
        phonemeA: "oo",
        wordB: "full",
        ipaB: "/fʊl/",
        phonemeB: "uh",
      },
      {
        wordA: "Luke",
        ipaA: "/luːk/",
        phonemeA: "oo",
        wordB: "look",
        ipaB: "/lʊk/",
        phonemeB: "uh",
      },
      {
        wordA: "food",
        ipaA: "/fuːd/",
        phonemeA: "oo",
        wordB: "foot",
        ipaB: "/fʊt/",
        phonemeB: "uh",
      },
    ],
    sentenceLadder: [
      item("Look at the pool near the school.", "", "uh", "look 短，pool/school 长。"),
      item("The full moon looked blue.", "", "oo", "full/looked 短，moon/blue 长。"),
      item("Put the food on the wooden table.", "", "uh", "put/wooden 短，food 长。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 14,
  },
  {
    id: "n-ng",
    title: "分清 sin / sing",
    focus: "/n/ 舌尖抵齿龈，/ŋ/ 舌根抵软腭",
    targetPhonemes: ["n", "ng"],
    contrastPhonemes: ["n", "ng"],
    l1Problem: "前后鼻音混淆会让 sing、long、language 听起来不清楚。",
    mouthCue:
      "/n/ 舌尖抵上齿龈，气从鼻子出；/ŋ/ 舌尖放下，舌根抬起贴软腭。",
    perceptionItems: [
      {
        wordA: "sin",
        wordB: "sing",
        audioA: "/audio/words/blue/sin.mp3",
        audioB: "/audio/words/pink/sing.mp3",
      },
      {
        wordA: "thin",
        wordB: "thing",
        audioA: "/audio/words/blue/thin.mp3",
        audioB: "/audio/words/pink/thing.mp3",
      },
      {
        wordA: "ban",
        wordB: "bang",
        audioA: "/audio/words/blue/ban.mp3",
        audioB: "/audio/words/pink/bang.mp3",
      },
      {
        wordA: "ran",
        wordB: "rang",
        audioA: "/audio/words/blue/ran.mp3",
        audioB: "/audio/words/pink/rang.mp3",
      },
    ],
    wordLadder: [
      item("sing", "/sɪŋ/", "ng", "舌根抬起，结尾不要加 /g/。"),
      item("sin", "/sɪn/", "n", "舌尖顶上齿龈。"),
      item("language", "/ˈlæŋɡwɪdʒ/", "ng", "第一个音节有 /ŋɡ/，不要读成 lan。"),
      item("long", "/lɔːŋ/", "ng", "词尾 /ŋ/ 在后面，不加元音。"),
    ],
    minimalPairs: [
      {
        wordA: "sin",
        ipaA: "/sɪn/",
        phonemeA: "n",
        wordB: "sing",
        ipaB: "/sɪŋ/",
        phonemeB: "ng",
      },
      {
        wordA: "thin",
        ipaA: "/θɪn/",
        phonemeA: "n",
        wordB: "thing",
        ipaB: "/θɪŋ/",
        phonemeB: "ng",
      },
      {
        wordA: "ban",
        ipaA: "/bæn/",
        phonemeA: "n",
        wordB: "bang",
        ipaB: "/bæŋ/",
        phonemeB: "ng",
      },
      {
        wordA: "ran",
        ipaA: "/ræn/",
        phonemeA: "n",
        wordB: "rang",
        ipaB: "/ræŋ/",
        phonemeB: "ng",
      },
    ],
    sentenceLadder: [
      item("I can sing a long song.", "", "ng", "sing/long/song 都是后鼻音。"),
      item("The language sounds interesting.", "", "ng", "language 和 interesting 有 /ŋ/。"),
      item("Bring the ring in the morning.", "", "ng", "bring/ring/morning 保持后鼻音。"),
    ],
    masteryRule: DEFAULT_RULE,
    estimatedMinutes: 14,
  },
];

function courseItem(
  id: string,
  text: string,
  targetPhonemes: string[],
  focusPoint: string,
  commonMistake: string,
  successCue: string,
  difficulty: TrainingCourseItem["difficulty"],
  ipa?: string,
  contrastText?: string,
  options: Partial<
    Pick<
      TrainingCourseItem,
      | "displayText"
      | "referenceText"
      | "playbackText"
      | "position"
      | "isRecordable"
    >
  > = {},
): TrainingCourseItem {
  return {
    id,
    text,
    displayText: options.displayText,
    referenceText: options.referenceText,
    playbackText: options.playbackText,
    ipa,
    targetPhonemes,
    focusPoint,
    commonMistake,
    successCue,
    difficulty,
    position: options.position,
    isRecordable: options.isRecordable,
    contrastText,
  };
}

function cycle<T>(items: T[], count: number): T[] {
  if (items.length === 0) return [];
  return Array.from({ length: count }, (_, index) => items[index % items.length]);
}

function phonemeLabel(phoneme: string): string {
  return `/${phoneme}/`;
}

type CourseSeed = {
  text: string;
  targetPhonemes: string[];
  focusPoint: string;
  commonMistake: string;
  successCue: string;
  difficulty: TrainingCourseItem["difficulty"];
  ipa?: string;
  position?: TrainingCourseItem["position"];
};

type PairSeed = {
  wordA: string;
  wordB: string;
  phonemeA: string;
  phonemeB: string;
  ipaA?: string;
  ipaB?: string;
};

interface CuratedCourseBank {
  syllables: CourseSeed[];
  words: CourseSeed[];
  pairs: PairSeed[];
  sentences: CourseSeed[];
  shadowing: CourseSeed[];
}

function seed(
  text: string,
  targetPhonemes: string[],
  focusPoint: string,
  commonMistake: string,
  successCue: string,
  difficulty: TrainingCourseItem["difficulty"],
  position?: TrainingCourseItem["position"],
  ipa?: string,
): CourseSeed {
  return {
    text,
    targetPhonemes,
    focusPoint,
    commonMistake,
    successCue,
    difficulty,
    position,
    ipa,
  };
}

function pair(
  wordA: string,
  wordB: string,
  phonemeA: string,
  phonemeB: string,
  ipaA = "",
  ipaB = "",
): PairSeed {
  return { wordA, wordB, phonemeA, phonemeB, ipaA, ipaB };
}

const CURATED_COURSE_BANK: Record<string, CuratedCourseBank> = {
  "ee-ih": {
    syllables: [
      seed("see", ["ee"], "拉长 /iː/，嘴角向两边收紧。", "把长音读短，听起来像 sit 的短元音。", "声音能保持两拍，结尾不塌。", 1, "final", "/siː/"),
      seed("sit", ["ih"], "/ɪ/ 短促放松，嘴不要横向拉太开。", "拖长成 seat，词义会变。", "一拍收住，声音轻而短。", 1, "medial", "/sɪt/"),
      seed("feel", ["ee"], "长音进入 /l/ 前不要变短。", "一进词尾就把长音吞掉。", "feel 的元音清楚长于 fill。", 2, "medial", "/fiːl/"),
      seed("fill", ["ih"], "短音后立刻收 /l/。", "把 fill 拉成 feel。", "短音和词尾都干净。", 2, "medial", "/fɪl/"),
      seed("green tea", ["ee"], "短语里两个 /iː/ 都保持紧和长。", "为了流利把 green 读短。", "长音在自然语速里仍明显。", 3, "mixed"),
      seed("quick decision", ["ih"], "quick 和 decision 里的 /ɪ/ 都短。", "把短音读成中文“衣”。", "短音轻快，不抢重音。", 3, "mixed"),
    ],
    words: [
      seed("sheep", ["ee"], "先把 /iː/ 拉满，再收 /p/。", "读太短会接近 ship。", "长音清楚，词尾轻收。", 1, "medial", "/ʃiːp/"),
      seed("ship", ["ih"], "/ɪ/ 立刻收住。", "拖长会变成 sheep。", "短促但不含糊。", 1, "medial", "/ʃɪp/"),
      seed("seat", ["ee"], "seat 的元音拉长。", "短成 sit。", "长音结束后再碰 /t/。", 2, "medial", "/siːt/"),
      seed("sit", ["ih"], "sit 保持短音。", "下意识读成 seat。", "一拍完成。", 2, "medial", "/sɪt/"),
      seed("leave", ["ee"], "长音后接 /v/，不要提前收。", "把 leave 读成 live。", "元音长，/v/ 有摩擦。", 2, "medial", "/liːv/"),
      seed("live", ["ih"], "live 的 /ɪ/ 短。", "拖成长音。", "短音加 /v/ 都清楚。", 2, "medial", "/lɪv/"),
      seed("beach", ["ee"], "beach 里的 /iː/ 长且紧。", "读短会接近另一个词。", "长音后 /tʃ/ 干净。", 3, "medial", "/biːtʃ/"),
      seed("bit", ["ih"], "bit 是短音，不要拉开嘴角。", "读成 beat。", "短音后 /t/ 清楚。", 3, "medial", "/bɪt/"),
      seed("meeting", ["ee"], "第一个音节的 /iː/ 要稳定。", "快读时长音塌掉。", "meeting 的长音仍能听出。", 4, "medial"),
      seed("business", ["ih"], "business 第一个元音短而轻。", "把每个音节都读重。", "短音自然融进词里。", 4, "medial"),
      seed("keep it", ["ee", "ih"], "keep 长，it 短，差异要大。", "两个词都读成长音。", "短语里长短分明。", 4, "mixed"),
      seed("this week", ["ih", "ee"], "this 短，week 长。", "this 被拖长，week 又不够长。", "一短一长很清楚。", 5, "mixed"),
    ],
    pairs: [
      pair("sheep", "ship", "ee", "ih", "/ʃiːp/", "/ʃɪp/"),
      pair("seat", "sit", "ee", "ih", "/siːt/", "/sɪt/"),
      pair("feet", "fit", "ee", "ih", "/fiːt/", "/fɪt/"),
      pair("leave", "live", "ee", "ih", "/liːv/", "/lɪv/"),
      pair("beat", "bit", "ee", "ih", "/biːt/", "/bɪt/"),
      pair("green", "grin", "ee", "ih", "/ɡriːn/", "/ɡrɪn/"),
      pair("least", "list", "ee", "ih", "/liːst/", "/lɪst/"),
      pair("heat", "hit", "ee", "ih", "/hiːt/", "/hɪt/"),
    ],
    sentences: [
      seed("The sheep is on the ship.", ["ee", "ih"], "sheep 拉长，ship 缩短。", "两个词读成一样长。", "不用上下文也能分出两个词。", 2, "mixed"),
      seed("Please sit in this seat.", ["ee", "ih"], "please/seat 长，sit/this 短。", "this 被读得太长。", "长短交替自然。", 2, "mixed"),
      seed("I will leave it in the kitchen.", ["ee", "ih"], "leave 长，it/in/kitchen 短。", "句子一快就把 leave 读短。", "重音词和弱读词分开。", 3, "mixed"),
      seed("Keep this list with me.", ["ee", "ih"], "keep/me 长，this/list 短。", "list 被拉成 least。", "list 的短音和 /st/ 都清楚。", 3, "mixed"),
      seed("The team fixed the printer.", ["ee", "ih"], "team 长，fixed/printer 短。", "fixed 的 /ɪ/ 读成 /iː/。", "短音轻快，词尾不丢。", 4, "mixed"),
      seed("She needs a quick decision.", ["ee", "ih"], "needs 长，quick/decision 短。", "decision 的弱音节读太重。", "节奏里仍保留短音。", 4, "mixed"),
      seed("This meeting will finish in fifteen minutes.", ["ee", "ih"], "meeting 长，finish/fifteen 里短音要短。", "所有 i 都读成一种音。", "多音节里长短稳定。", 5, "mixed"),
      seed("We need six clean sheets.", ["ee", "ih"], "we/need/clean/sheets 长，six 短。", "six 被拉长。", "six 的短音和 /ks/ 干净。", 5, "mixed"),
    ],
    shadowing: [
      seed("Please sit in this seat and keep your feet still.", ["ee", "ih"], "跟读时保持 seat/feet 长，sit/this/still 短。", "只模仿速度，长短全丢。", "自然语速里长短仍清楚。", 4, "mixed"),
      seed("The meeting is brief, but this decision is important.", ["ee", "ih"], "brief 长，this/decision 短。", "多音节词里把短音拖长。", "重音和长短一起稳定。", 4, "mixed"),
      seed("She will leave the list in the kitchen this evening.", ["ee", "ih"], "leave/evening 长，list/kitchen/this 短。", "快读时 list 变成 least。", "句子速度上来后仍不混。", 5, "mixed"),
    ],
  },
  "eh-ae": {
    syllables: [
      seed("bed", ["eh"], "/e/ 开口小，声音靠前。", "下巴开太大变成 bad。", "短而清楚。", 1, "medial", "/bed/"),
      seed("bad", ["ae"], "/æ/ 下巴真的往下打开。", "开口太小像 bed。", "声音宽，舌前部放平。", 1, "medial", "/bæd/"),
      seed("men", ["eh"], "men 的 /e/ 不要过宽。", "读成 man。", "前元音短促。", 2, "medial", "/men/"),
      seed("man", ["ae"], "man 要打开下巴。", "收窄成 men。", "下巴打开但不要拖长。", 2, "medial", "/mæn/"),
      seed("red bag", ["eh", "ae"], "red 小开口，bag 大开口。", "两个元音开口差不够。", "短语里开口切换明显。", 3, "mixed"),
      seed("packed desk", ["ae", "eh"], "packed 大，desk 小。", "packed 的 /æ/ 被挤小。", "词尾和元音都清楚。", 3, "mixed"),
    ],
    words: [
      seed("bed", ["eh"], "小开口，声音靠前。", "下巴开太大。", "短促清楚。", 1, "medial", "/bed/"),
      seed("bad", ["ae"], "下巴向下打开。", "读成 bed。", "开口能被听出。", 1, "medial", "/bæd/"),
      seed("men", ["eh"], "men 开口别太大。", "读成 man。", "嘴型小而稳。", 2, "medial", "/men/"),
      seed("man", ["ae"], "man 的 /æ/ 要宽。", "收成 men。", "下巴放松打开。", 2, "medial", "/mæn/"),
      seed("pen", ["eh"], "pen 是 /e/。", "变成 pan。", "短音轻快。", 2, "medial", "/pen/"),
      seed("pan", ["ae"], "pan 打开。", "变成 pen。", "元音宽而短。", 2, "medial", "/pæn/"),
      seed("better", ["eh"], "重音第一个音节 /e/。", "读得过宽或过长。", "better 清楚不拖。", 3, "medial", "/ˈbetər/"),
      seed("answer", ["ae"], "answer 开头 /æ/ 打开。", "读成 enter 的开口。", "第一音节饱满。", 3, "initial", "/ˈænsər/"),
      seed("family", ["ae"], "family 开头要打开。", "收窄成 /e/。", "重音里 /æ/ 明显。", 4, "initial"),
      seed("message", ["eh"], "message 的 /e/ 小而短。", "开口过大。", "弱读不丢。", 4, "medial"),
      seed("red bag", ["eh", "ae"], "red 和 bag 开口对比。", "两个词嘴型一样。", "小开口到大开口切换清楚。", 4, "mixed"),
      seed("happy ending", ["ae", "eh"], "happy 大，ending 小。", "happy 被读成 heppy。", "短语里两个音不混。", 5, "mixed"),
    ],
    pairs: [
      pair("bed", "bad", "eh", "ae", "/bed/", "/bæd/"),
      pair("men", "man", "eh", "ae", "/men/", "/mæn/"),
      pair("pen", "pan", "eh", "ae", "/pen/", "/pæn/"),
      pair("set", "sat", "eh", "ae", "/set/", "/sæt/"),
      pair("said", "sad", "eh", "ae", "/sed/", "/sæd/"),
      pair("guess", "gas", "eh", "ae", "/ɡes/", "/ɡæs/"),
      pair("met", "mat", "eh", "ae", "/met/", "/mæt/"),
      pair("lend", "land", "eh", "ae", "/lend/", "/lænd/"),
    ],
    sentences: [
      seed("The bad man sat on the bed.", ["ae", "eh"], "bad/man/sat 大开口，bed 小开口。", "全都读成 /e/。", "开口差异贯穿整句。", 2, "mixed"),
      seed("Ben packed a red bag.", ["eh", "ae"], "Ben/red 小，packed/bag 大。", "packed 的 /æ/ 开口不足。", "短句里切换自然。", 2, "mixed"),
      seed("That answer made sense.", ["ae", "eh"], "that/answer 大，sense 小。", "answer 的开头太窄。", "关键词开口稳定。", 3, "mixed"),
      seed("The manager checked the plan.", ["ae", "eh"], "manager/plan 大，checked 小。", "plan 变成 plen。", "多音节和单音节都稳。", 3, "mixed"),
      seed("Every family has a better plan.", ["ae", "eh"], "family/has/plan 大，every/better 小。", "family 开口不够。", "自然语速也不混。", 4, "mixed"),
      seed("The red jacket is in the black bag.", ["eh", "ae"], "red 小，jacket/black/bag 大。", "black/bag 收太窄。", "连续 /æ/ 都打开。", 4, "mixed"),
      seed("Send the package back after ten.", ["eh", "ae"], "send/ten 小，package/back/after 大。", "package 的 /æ/ 被弱化过头。", "节奏里开口仍清楚。", 5, "mixed"),
      seed("Dan read the message and felt happy.", ["ae", "eh"], "Dan/happy 大，read/message/felt 小。", "happy 的 /æ/ 像 /e/。", "尾句自然但对比明确。", 5, "mixed"),
    ],
    shadowing: [
      seed("Ben packed a red bag and left it on the desk.", ["eh", "ae"], "小开口和大开口交替，不要一快就合并。", "句子速度上来后全变 /e/。", "bag/desk 对比稳定。", 4, "mixed"),
      seed("That manager has a better answer for the team.", ["ae", "eh"], "that/manager/has/answer 大，better 小。", "answer 开口不足。", "多音节里也能打开。", 4, "mixed"),
      seed("The family checked the map before they went back.", ["ae", "eh"], "family/map/back 大，checked/went 小。", "map 变成 mep。", "信息词都清楚。", 5, "mixed"),
    ],
  },
  "s-th": {
    syllables: [
      seed("thin", ["th"], "舌尖轻露，先吹气。", "舌头缩回读成 sin。", "开头气流有摩擦。", 1, "initial", "/θɪn/"),
      seed("think", ["th"], "先 /θ/ 再接 /ɪŋk/。", "直接用 /s/ 开头。", "舌尖位置不变形。", 1, "initial", "/θɪŋk/"),
      seed("thanks", ["th"], "/θ/ 后接 /æ/，不要加中文尾音。", "舌尖不出来。", "开头清楚，词尾 /ks/ 收住。", 2, "initial", "/θæŋks/"),
      seed("birthday", ["th"], "中间 /θ/ 也要伸舌。", "读成 burs-day。", "齿间音在中间仍清楚。", 2, "medial"),
      seed("health", ["th"], "词尾 /θ/ 只送气，不加元音。", "health 末尾被吞。", "结尾有轻摩擦。", 3, "final", "/helθ/"),
      seed("mouth", ["th"], "双元音后保留词尾 /θ/。", "mouth 读成 mouse。", "尾音短而明确。", 3, "final", "/maʊθ/"),
    ],
    words: [
      seed("think", ["th"], "开头伸舌送气。", "读成 sink。", "先气流，再进元音。", 1, "initial", "/θɪŋk/"),
      seed("thin", ["th"], "轻触齿间，不要咬紧。", "舌尖缩回。", "气流细而稳定。", 1, "initial", "/θɪn/"),
      seed("three", ["th", "r"], "/θ/ 后直接接 /r/。", "中间加元音。", "three 一口气连上。", 2, "initial", "/θriː/"),
      seed("thanks", ["th"], "开头 /θ/ 和词尾 /ks/ 都清楚。", "只读成 sanks。", "开头齿间，结尾干净。", 2, "initial", "/θæŋks/"),
      seed("thick", ["th"], "齿间音后接短 /ɪ/。", "读成 sick。", "开头差异明显。", 2, "initial", "/θɪk/"),
      seed("path", ["th"], "词尾 /θ/ 不要吞。", "读成 pass。", "末尾仍有气流。", 3, "final", "/pæθ/"),
      seed("mouth", ["th"], "词尾短促送气。", "读成 mouse。", "尾音能被听见。", 3, "final", "/maʊθ/"),
      seed("health", ["th"], "/l/ 后伸舌发 /θ/。", "health 末尾消失。", "词尾轻但完整。", 3, "final", "/helθ/"),
      seed("birthday", ["th"], "中间 /θ/ 不要换成 /s/。", "读成 birsday。", "中间齿间动作清楚。", 4, "medial"),
      seed("method", ["th"], "method 中间 /θ/ 保持轻。", "读成 messod。", "弱音节也保留目标音。", 4, "medial"),
      seed("think through", ["th"], "两个词开头都要伸舌。", "through 被读成 srough。", "连续 /θ/ 不偷懒。", 5, "mixed"),
      seed("healthy teeth", ["th"], "health 词尾和 teeth 词尾都清楚。", "尾音吞掉。", "词尾齿间音稳定。", 5, "mixed"),
    ],
    pairs: [
      pair("sink", "think", "s", "th", "/sɪŋk/", "/θɪŋk/"),
      pair("mouse", "mouth", "s", "th", "/maʊs/", "/maʊθ/"),
      pair("pass", "path", "s", "th", "/pæs/", "/pæθ/"),
      pair("sick", "thick", "s", "th", "/sɪk/", "/θɪk/"),
      pair("sum", "thumb", "s", "th", "/sʌm/", "/θʌm/"),
      pair("saw", "thaw", "s", "th", "/sɔː/", "/θɔː/"),
      pair("sin", "thin", "s", "th", "/sɪn/", "/θɪn/"),
      pair("tense", "tenth", "s", "th", "/tens/", "/tenθ/"),
    ],
    sentences: [
      seed("I think three things are important.", ["th"], "think/three/things 都要伸舌。", "连续目标音时偷成 /s/。", "每个 /θ/ 都能听出气流。", 2, "mixed"),
      seed("The path is narrow but smooth.", ["th"], "path 词尾保留 /θ/。", "path 读成 pass。", "尾音轻而清楚。", 2, "final"),
      seed("Thank you for the thoughtful answer.", ["th"], "thank/thoughtful 保持气流。", "thank 开头不伸舌。", "开头齿间音自然。", 3, "initial"),
      seed("Her birthday is on Thursday.", ["th"], "birthday/Thursday 里的 /θ/ 都清楚。", "中间目标音被 /s/ 替代。", "多音节里不丢动作。", 3, "mixed"),
      seed("The math method looks simple.", ["th"], "math/method 都要齿间摩擦。", "math 末尾吞掉。", "词尾和词中都稳定。", 4, "mixed"),
      seed("Think through the third question.", ["th"], "think/through/third 三连 /θ/。", "through 前加元音。", "连读时仍有清楚气流。", 4, "initial"),
      seed("Healthy teeth need careful cleaning.", ["th"], "healthy/teeth 两处目标音。", "teeth 尾音变 /s/。", "词尾 /θ/ 不被吞。", 5, "mixed"),
      seed("Both authors thanked the theater staff.", ["th"], "both/authors/thanked/theater 多位置练习。", "复杂句里回到 /s/。", "多位置齿间音都保住。", 5, "mixed"),
    ],
    shadowing: [
      seed("I think three things are worth thinking through.", ["th"], "连续 /θ/ 里每次都伸舌，但不要停太久。", "为了速度全读成 /s/。", "自然速度仍能听出 think/through。", 4, "mixed"),
      seed("The path near the theater is smooth and narrow.", ["th"], "path 词尾和 theater 开头都要清楚。", "path 末尾被吞。", "词尾到词首切换稳定。", 4, "mixed"),
      seed("Healthy teeth and thoughtful habits matter.", ["th"], "healthy/teeth/thoughtful 都保留齿间气流。", "多音节里齿间音消失。", "句子有节奏，目标音不丢。", 5, "mixed"),
    ],
  },
  "z-dh": {
    syllables: [
      seed("then", ["dh"], "舌尖齿间，同时声带振动。", "缩回读成 zen。", "喉咙有震动。", 1, "initial", "/ðen/"),
      seed("this", ["dh"], "this 开头不是 zis。", "舌尖缩回。", "轻触齿间且有声。", 1, "initial", "/ðɪs/"),
      seed("they", ["dh"], "功能词轻读但 /ð/ 不消失。", "读成 day 或 zay。", "开头轻但可辨。", 2, "initial", "/ðeɪ/"),
      seed("other", ["dh"], "中间 /ð/ 不爆破。", "读成 odder。", "中间有轻摩擦。", 2, "medial"),
      seed("breathe", ["dh"], "词尾 /ð/ 有声。", "读成 breeze。", "尾音有振动。", 3, "final", "/briːð/"),
      seed("smooth", ["dh"], "词尾 /ð/ 轻而不断。", "smooth 末尾变 /z/。", "结尾保持齿间振动。", 3, "final", "/smuːð/"),
    ],
    words: [
      seed("then", ["dh"], "舌尖齿间加振动。", "读成 zen。", "有声齿间音清楚。", 1, "initial", "/ðen/"),
      seed("this", ["dh"], "轻触齿间。", "读成 zis。", "开头有震动。", 1, "initial", "/ðɪs/"),
      seed("they", ["dh"], "弱读也保留 /ð/。", "读成 day。", "轻而清楚。", 2, "initial", "/ðeɪ/"),
      seed("those", ["dh"], "开头有声，词尾 /z/ 也清楚。", "开头缩成 /z/。", "两个有声音位置分开。", 2, "initial", "/ðoʊz/"),
      seed("father", ["dh"], "中间 /ð/ 轻摩擦。", "读成 fadder。", "不爆破。", 3, "medial", "/ˈfɑːðər/"),
      seed("weather", ["dh"], "weather 中间目标音轻。", "读成 wezzer。", "中间齿间震动。", 3, "medial"),
      seed("breathe", ["dh"], "词尾 /ð/ 有振动。", "读成 breeze。", "尾音不是 /z/。", 3, "final", "/briːð/"),
      seed("smooth", ["dh"], "结尾 /ð/ 不吞。", "smooth 末尾消失。", "尾音轻而有声。", 4, "final", "/smuːð/"),
      seed("rather", ["dh"], "rather 中间 /ð/。", "读成 rader。", "中间不爆破。", 4, "medial"),
      seed("together", ["dh"], "弱音节里保留 /ð/。", "读成 togezzer。", "自然但不含糊。", 4, "medial"),
      seed("then breathe", ["dh"], "开头和结尾 /ð/ 都要有声。", "breathe 末尾读成 /z/。", "两处有声齿间都清楚。", 5, "mixed"),
      seed("this weather", ["dh"], "this 开头和 weather 中间目标音。", "两个都读成 /z/。", "功能词和内容词都稳定。", 5, "mixed"),
    ],
    pairs: [
      pair("zen", "then", "z", "dh", "/zen/", "/ðen/"),
      pair("breeze", "breathe", "z", "dh", "/briːz/", "/briːð/"),
      pair("tease", "teethe", "z", "dh", "/tiːz/", "/tiːð/"),
      pair("close", "clothe", "z", "dh", "/kloʊz/", "/kloʊð/"),
      pair("zay", "they", "z", "dh", "", "/ðeɪ/"),
      pair("zose", "those", "z", "dh", "", "/ðoʊz/"),
      pair("doze", "those", "z", "dh", "/doʊz/", "/ðoʊz/"),
      pair("wizzer", "weather", "z", "dh", "", "/ˈweðər/"),
    ],
    sentences: [
      seed("This is the best way.", ["dh"], "this/the 都轻触齿间。", "this 读成 zis。", "功能词轻但清楚。", 2, "initial"),
      seed("My father said the weather was pleasant.", ["dh"], "father/the/weather 三处 /ð/。", "中间读成 /d/ 或 /z/。", "目标音轻而不断。", 3, "mixed"),
      seed("Breathe in and then breathe out.", ["dh"], "breathe 词尾和 then 开头都要有声。", "breathe 末尾变 /z/。", "尾音有震动。", 3, "mixed"),
      seed("They went there together.", ["dh"], "they/there/together 都是有声齿间。", "they 读成 day。", "弱读仍可辨。", 3, "initial"),
      seed("Those clothes feel smooth.", ["dh"], "those 开头和 smooth 结尾。", "smooth 末尾吞掉。", "句尾目标音不丢。", 4, "mixed"),
      seed("Rather than rushing, say this slowly.", ["dh"], "rather/than/this 都要轻。", "than 读成 zan。", "节奏自然但目标音在。", 4, "mixed"),
      seed("The other team solved the problem.", ["dh"], "the/other/the 都轻触齿间。", "other 中间爆破。", "轻读里仍有摩擦。", 5, "mixed"),
      seed("This weather makes breathing easier.", ["dh"], "this/weather/breathing 三处练习。", "weather 变成 wezzer。", "多音节中稳定。", 5, "mixed"),
    ],
    shadowing: [
      seed("This weather is better than the weather yesterday.", ["dh"], "功能词轻读，weather 中间 /ð/ 不变 /z/。", "所有 the/this 都缩回。", "自然连贯且有齿间振动。", 4, "mixed"),
      seed("They went there together and breathed slowly.", ["dh"], "there/together/breathed 都保留有声齿间。", "breathed 结尾变成 /z/。", "句尾仍有振动。", 4, "mixed"),
      seed("My father said this method was smoother than before.", ["dh"], "father/this/smoother/than 多位置。", "中间目标音爆破成 /d/。", "多位置有声齿间稳定。", 5, "mixed"),
    ],
  },
  "v-w": {
    syllables: [
      seed("vest", ["v"], "/v/ 上齿轻碰下唇。", "双唇收圆读成 west。", "有唇齿摩擦。", 1, "initial", "/vest/"),
      seed("west", ["w"], "/w/ 双唇收圆向前推。", "咬下唇读成 vest。", "圆唇滑入元音。", 1, "initial", "/west/"),
      seed("very", ["v"], "very 开头先咬一点下唇。", "读成 wery。", "摩擦声清楚。", 2, "initial", "/ˈveri/"),
      seed("water", ["w"], "water 开头圆唇，不要咬唇。", "读得像 vater。", "圆唇后快速放开。", 2, "initial", "/ˈwɔːtər/"),
      seed("every voice", ["v"], "every/voice 的 /v/ 都要唇齿摩擦。", "voice 开头变 /w/。", "连续 /v/ 都清楚。", 3, "mixed"),
      seed("warm wave", ["w"], "两个 /w/ 都先圆唇。", "圆唇不足，像 /v/。", "开头滑音自然。", 3, "mixed"),
    ],
    words: [
      seed("very", ["v"], "上齿轻碰下唇。", "读成 wery。", "开头摩擦稳定。", 1, "initial", "/ˈveri/"),
      seed("west", ["w"], "双唇收圆。", "咬唇变成 vest。", "圆唇滑音自然。", 1, "initial", "/west/"),
      seed("voice", ["v"], "voice 开头 /v/ 有摩擦。", "变成 woice。", "齿唇位置明确。", 2, "initial", "/vɔɪs/"),
      seed("water", ["w"], "water 开头只圆唇。", "读成 vater。", "开头轻滑。", 2, "initial", "/ˈwɔːtər/"),
      seed("vine", ["v"], "vine 开头有声摩擦。", "读成 wine。", "唇齿位置持续。", 2, "initial", "/vaɪn/"),
      seed("wine", ["w"], "wine 不咬唇。", "读成 vine。", "圆唇后接双元音。", 2, "initial", "/waɪn/"),
      seed("every", ["v"], "中间 /v/ 不要变 /w/。", "弱音节中丢摩擦。", "every 中间清楚。", 3, "medial", "/ˈevri/"),
      seed("away", ["w"], "away 中间 /w/ 圆唇。", "读得太硬像 /v/。", "滑音自然。", 3, "medial"),
      seed("travel", ["v"], "travel 中 /v/ 保持唇齿。", "快读时变成 /w/。", "中间摩擦不丢。", 4, "medial"),
      seed("wonderful", ["w"], "wonderful 开头圆唇。", "开头像 /v/。", "开头滑入自然。", 4, "initial"),
      seed("very well", ["v", "w"], "very 用 /v/，well 用 /w/。", "两个开头同一个嘴型。", "咬唇到圆唇切换明显。", 5, "mixed"),
      seed("warm voice", ["w", "v"], "warm 圆唇，voice 咬唇。", "voice 变成 /w/。", "两个动作分开。", 5, "mixed"),
    ],
    pairs: [
      pair("vest", "west", "v", "w", "/vest/", "/west/"),
      pair("vine", "wine", "v", "w", "/vaɪn/", "/waɪn/"),
      pair("veil", "whale", "v", "w", "/veɪl/", "/weɪl/"),
      pair("verse", "worse", "v", "w", "/vɜːrs/", "/wɜːrs/"),
      pair("viper", "wiper", "v", "w", "", ""),
      pair("vet", "wet", "v", "w", "/vet/", "/wet/"),
      pair("very", "wary", "v", "w", "/ˈveri/", "/ˈweri/"),
      pair("vow", "wow", "v", "w", "/vaʊ/", "/waʊ/"),
    ],
    sentences: [
      seed("Very warm water is waiting.", ["v", "w"], "very 是 /v/，warm/water/waiting 是 /w/。", "全部开头用同一嘴型。", "唇齿和圆唇能切换。", 2, "mixed"),
      seed("We visited a very quiet village.", ["v", "w"], "we 是 /w/，visited/very/village 是 /v/。", "village 开头变 /w/。", "多处 /v/ 摩擦稳定。", 3, "mixed"),
      seed("The voice on the video was wonderful.", ["v", "w"], "voice/video 用 /v/，was/wonderful 用 /w/。", "video 变成 wideo。", "自然句里不混。", 3, "mixed"),
      seed("Victor waited by the window.", ["v", "w"], "Victor /v/，waited/window /w/。", "waited 读成 vaited。", "人名和动作词都清楚。", 3, "mixed"),
      seed("Every week we review vocabulary.", ["v", "w"], "every/review/vocabulary 有 /v/，week/we 有 /w/。", "review 中间 /v/ 丢掉。", "快读也保留对比。", 4, "mixed"),
      seed("Vivian wore a white vest.", ["v", "w"], "Vivian/vest 用 /v/，wore/white 用 /w/。", "white 开头像 /v/。", "两种嘴型切换明确。", 4, "mixed"),
      seed("The warm wave moved very slowly.", ["w", "v"], "warm/wave 用 /w/，moved/very 用 /v/。", "moved 结尾 /v/ 不清楚。", "词首词尾都稳定。", 5, "mixed"),
      seed("We value clear vowels and word stress.", ["v", "w"], "value/vowels 是 /v/，we/word 是 /w/。", "value 开头不咬唇。", "句子主题词都清楚。", 5, "mixed"),
    ],
    shadowing: [
      seed("Very warm water was waiting by the window.", ["v", "w"], "v 和 w 高频切换，先慢后自然。", "所有开头同一个嘴型。", "唇齿和圆唇切换稳定。", 4, "mixed"),
      seed("We reviewed the video and voted on Wednesday.", ["v", "w"], "we/Wednesday 圆唇，reviewed/video/voted 唇齿。", "reviewed 的 /v/ 弱化丢失。", "连读时 /v/ 不消失。", 4, "mixed"),
      seed("Vivian's voice was very warm and welcoming.", ["v", "w"], "voice/very 用 /v/，was/warm/welcoming 用 /w/。", "voice 开头变 /w/。", "整句温和但对比清楚。", 5, "mixed"),
    ],
  },
  "l-r": {
    syllables: [
      seed("light", ["l"], "/l/ 舌尖碰齿龈。", "舌尖不碰，靠近 right。", "开头有清楚接触。", 1, "initial", "/laɪt/"),
      seed("right", ["r"], "/r/ 舌头悬空后卷。", "舌尖碰上颚变 /l/。", "开头圆而不碰。", 1, "initial", "/raɪt/"),
      seed("lead", ["l"], "开头 /l/ 轻碰一下。", "读成 read。", "接触后进入长音。", 2, "initial", "/liːd/"),
      seed("read", ["r"], "读 /r/ 时舌尖悬空。", "舌尖碰成 lead。", "圆唇加舌位稳定。", 2, "initial", "/riːd/"),
      seed("clear glass", ["l"], "cluster 里的 /l/ 不要丢。", "glass 读成 grass。", "辅音群里 /l/ 清楚。", 3, "mixed"),
      seed("fresh rice", ["r"], "fresh/rice 的 /r/ 都不碰上颚。", "rice 读成 lice。", "连续 /r/ 稳定。", 3, "mixed"),
    ],
    words: [
      seed("light", ["l"], "舌尖碰齿龈。", "读成 right。", "开头接触清楚。", 1, "initial", "/laɪt/"),
      seed("right", ["r"], "舌尖悬空后卷。", "读成 light。", "开头不碰上颚。", 1, "initial", "/raɪt/"),
      seed("lead", ["l"], "开头 /l/ 接触。", "读成 read。", "舌尖轻点。", 2, "initial", "/liːd/"),
      seed("read", ["r"], "开头 /r/ 不碰。", "读成 lead。", "圆唇后进入长音。", 2, "initial", "/riːd/"),
      seed("glass", ["l"], "辅音群 /gl/ 里的 /l/ 保留。", "读成 grass。", "g 后舌尖及时碰。", 3, "medial", "/ɡlæs/"),
      seed("grass", ["r"], "辅音群 /gr/ 中 /r/ 悬空。", "读成 glass。", "g 后舌尖不碰。", 3, "medial", "/ɡræs/"),
      seed("collect", ["l"], "中间 /l/ 轻碰。", "快读时丢 /l/。", "多音节里 /l/ 清楚。", 3, "medial"),
      seed("correct", ["r"], "中间 /r/ 悬空。", "读成 collect。", "弱音节后 /r/ 稳。", 3, "medial"),
      seed("world", ["r", "l"], "world 里 /r/ 到 /l/ 要切换。", "末尾 /ld/ 吞掉。", "卷舌到舌尖接触都完成。", 4, "mixed", "/wɜːrld/"),
      seed("really", ["r", "l"], "开头 /r/，中间 /l/。", "两个位置混成一种音。", "r-l 切换自然。", 4, "mixed"),
      seed("clear road", ["l", "r"], "clear 末尾 /r/ 与 road 开头 /r/。", "clear 的 /l/ 丢失。", "辅音群和 /r/ 都清楚。", 5, "mixed"),
      seed("local rule", ["l", "r"], "local 多个 /l/，rule 开头 /r/。", "rule 被读成 lule。", "两种舌位切换明确。", 5, "mixed"),
    ],
    pairs: [
      pair("light", "right", "l", "r", "/laɪt/", "/raɪt/"),
      pair("lead", "read", "l", "r", "/liːd/", "/riːd/"),
      pair("glass", "grass", "l", "r", "/ɡlæs/", "/ɡræs/"),
      pair("lock", "rock", "l", "r", "/lɑːk/", "/rɑːk/"),
      pair("long", "wrong", "l", "r", "/lɔːŋ/", "/rɔːŋ/"),
      pair("lace", "race", "l", "r", "/leɪs/", "/reɪs/"),
      pair("collect", "correct", "l", "r", "", ""),
      pair("alive", "arrive", "l", "r", "", ""),
    ],
    sentences: [
      seed("Turn right at the light.", ["l", "r"], "right 不碰，light 舌尖碰。", "两个词开头混。", "方向词和灯都清楚。", 2, "mixed"),
      seed("Please read the long list.", ["l", "r"], "read 是 /r/，long/list 是 /l/。", "read 变成 lead。", "三处舌位分开。", 2, "mixed"),
      seed("The glass is on the green grass.", ["l", "r"], "glass /l/，green/grass /r/。", "glass 和 grass 混。", "辅音群稳定。", 3, "mixed"),
      seed("Laura wrote a really clear report.", ["l", "r"], "Laura/clear 有 /l/，wrote/really/report 有 /r/。", "really 的 r-l 切换不清楚。", "多位置切换自然。", 4, "mixed"),
      seed("The local rule is rarely clear.", ["l", "r"], "local/rule/rarely/clear 多次切换。", "rule 开头变 /l/。", "重复也不混。", 4, "mixed"),
      seed("Fresh rice and cold lemon tea are ready.", ["l", "r"], "fresh/rice/ready 用 /r/，cold/lemon 用 /l/。", "rice 变 lice。", "食物词都清楚。", 4, "mixed"),
      seed("Her world feels larger after every lesson.", ["l", "r"], "world/larger/lesson 练 r-l 过渡。", "world 末尾吞掉。", "复杂词仍完成舌位。", 5, "mixed"),
      seed("Really listen before you reply.", ["l", "r"], "really 的 r-l，listen 的 /l/，reply 的 /r/。", "reply 开头像 /l/。", "自然建议句里不混。", 5, "mixed"),
    ],
    shadowing: [
      seed("Turn right at the light and read the long list.", ["l", "r"], "right/light/read/long/list 连续切换。", "开头音互换。", "句子里每个关键词清楚。", 4, "mixed"),
      seed("The glass on the grass looked really clear.", ["l", "r"], "glass/grass/really/clear 是核心。", "辅音群里 /l/ 或 /r/ 丢。", "自然跟读时不混。", 4, "mixed"),
      seed("Laura rarely writes long reports after lunch.", ["l", "r"], "Laura/rarely/writes/long/reports/lunch 多位置。", "速度上来后舌位塌掉。", "多位置切换稳定。", 5, "mixed"),
    ],
  },
  "final-consonants": {
    syllables: [
      seed("back", ["k"], "结尾 /k/ 只轻收，不加“呃”。", "back 读成 back-uh。", "结尾短而完整。", 1, "final", "/bæk/"),
      seed("bad", ["d"], "词尾 /d/ 闭合到位。", "尾音吞掉。", "结尾能被听见。", 1, "final", "/bæd/"),
      seed("help", ["p"], "help 的 /lp/ 都要收住。", "加尾音 help-uh。", "闭合干净。", 2, "final", "/help/"),
      seed("asked", ["k", "t"], "asked 结尾 /skt/ 不要全部吞。", "只读 ask。", "辅音群短而清楚。", 3, "final", "/æskt/"),
      seed("world", ["r", "l", "d"], "world 末尾 /ld/ 收住。", "读成 wor。", "尾部信息完整。", 3, "final", "/wɜːrld/"),
      seed("next week", ["k", "t"], "next 的 /kst/ 和 week 的 /k/。", "next 结尾丢失。", "短语里尾音仍在。", 4, "mixed"),
    ],
    words: [
      seed("back", ["k"], "结尾 /k/ 干净闭合。", "加中文式尾音。", "短促收住。", 1, "final", "/bæk/"),
      seed("bad", ["d"], "结尾 /d/ 保留。", "尾音消失。", "词义不靠上下文猜。", 1, "final", "/bæd/"),
      seed("help", ["p"], "/lp/ 两个动作都完成。", "读成 hell。", "p 轻收。", 2, "final", "/help/"),
      seed("make", ["k"], "结尾 /k/ 不加元音。", "make-uh。", "尾音短。", 2, "final", "/meɪk/"),
      seed("job", ["b"], "结尾 /b/ 闭合。", "尾音吞掉像 jaw。", "有声结尾轻收。", 2, "final", "/dʒɑːb/"),
      seed("safe", ["f"], "结尾 /f/ 有气流。", "读成 say。", "摩擦轻而清楚。", 3, "final", "/seɪf/"),
      seed("leave", ["v"], "结尾 /v/ 有声摩擦。", "读成 lee。", "尾音有振动。", 3, "final", "/liːv/"),
      seed("asked", ["k", "t"], "辅音群短但完整。", "asked 末尾只剩 /s/。", "结尾不拖不加元音。", 4, "final", "/æskt/"),
      seed("world", ["l", "d"], "/ld/ 收住。", "world 变 wor。", "舌尖动作完成。", 4, "final", "/wɜːrld/"),
      seed("first", ["r", "s", "t"], "词尾 /rst/ 不要丢 /t/。", "只读 firs。", "结尾轻触。", 4, "final", "/fɜːrst/"),
      seed("next week", ["k", "t"], "next 和 week 结尾都清楚。", "next 丢 /t/。", "短语里尾音不重但完整。", 5, "mixed"),
      seed("helped Mark", ["p", "t", "k"], "helped 的 /pt/ 和 Mark 的 /k/。", "helped 读成 help。", "连续词尾都收住。", 5, "mixed"),
    ],
    pairs: [
      pair("bay", "bake", "ey", "k", "", "/beɪk/"),
      pair("say", "safe", "ey", "f", "", "/seɪf/"),
      pair("lie", "light", "ai", "t", "", "/laɪt/"),
      pair("go", "goat", "oh", "t", "", "/ɡoʊt/"),
      pair("job", "jaw", "b", "aw", "/dʒɑːb/", "/dʒɔː/"),
      pair("back", "bag", "k", "g", "/bæk/", "/bæɡ/"),
      pair("leave", "leaf", "v", "f", "/liːv/", "/liːf/"),
      pair("world", "word", "l", "d", "/wɜːrld/", "/wɜːrd/"),
    ],
    sentences: [
      seed("I will be back next week.", ["k", "t"], "back/next/week 词尾都收。", "next 只剩 nex。", "连续尾音轻而完整。", 2, "mixed"),
      seed("Please help Mark with the task.", ["p", "k"], "help/Mark/task 的词尾。", "help 加尾音或吞 /p/。", "每个结尾都短。", 3, "mixed"),
      seed("She asked for a safe job.", ["k", "t", "f", "b"], "asked/safe/job 都有尾音。", "asked 的辅音群塌掉。", "复杂结尾不拖。", 3, "mixed"),
      seed("The first world map looked old.", ["t", "d"], "first/world/looked/old 词尾信息。", "world 末尾丢 /ld/。", "句末也完整。", 4, "mixed"),
      seed("Make it short and keep it clear.", ["k", "t", "r"], "make/it/short/keep/it 结尾。", "it 的 /t/ 不见。", "虚词尾音轻收。", 4, "mixed"),
      seed("I left my bag on the black desk.", ["t", "g", "k"], "left/bag/black/desk 多结尾。", "black 末尾加元音。", "尾音轻但不缺。", 4, "mixed"),
      seed("We helped the team finish the project.", ["p", "t"], "helped/project 的结尾群。", "helped 少 /t/。", "辅音群完整。", 5, "mixed"),
      seed("Don't add a vowel after the final sound.", ["d", "l"], "final sound 后不加额外元音。", "每个结尾都拖成中文式尾音。", "收住就停。", 5, "mixed"),
    ],
    shadowing: [
      seed("I will be back next week, so keep the task short.", ["k", "t"], "back/next/week/keep/task/short 全部短收。", "词尾越多越容易吞。", "尾音完整但不重。", 4, "mixed"),
      seed("She asked Mark to help with the first draft.", ["k", "t", "p"], "asked/Mark/help/first/draft 是重点。", "asked 和 draft 结尾丢。", "复杂辅音群稳定。", 4, "mixed"),
      seed("The old world map looked perfect on the black desk.", ["d", "k", "t"], "old/world/looked/perfect/black/desk 多结尾。", "加元音让节奏变重。", "自然语速仍短收。", 5, "mixed"),
    ],
  },
  "stress-rhythm": {
    syllables: [
      seed("about", ["schwa"], "a 弱成 /ə/，重音在 bout。", "每个音节等重。", "弱音节轻，重音顶出来。", 1, "initial"),
      seed("today", ["schwa"], "to 弱，day 重。", "to 读得太满。", "轻重有落差。", 1, "initial"),
      seed("a cup of tea", ["schwa"], "a/of 弱，cup/tea 重。", "虚词过重。", "内容词突出。", 2, "mixed"),
      seed("want to go", ["schwa"], "to 轻读，want/go 重。", "to 读成完整 too。", "节奏向内容词走。", 2, "mixed"),
      seed("talk about it", ["schwa"], "about 开头弱，talk/it 清楚。", "about 两音节等重。", "弱读自然连接。", 3, "mixed"),
      seed("one of the best", ["schwa"], "of/the 弱，one/best 重。", "of/the 太重。", "短语有强弱层次。", 3, "mixed"),
    ],
    words: [
      seed("about", ["schwa"], "第一音节弱，第二音节重。", "a 读满。", "重音落在 bout。", 1, "initial"),
      seed("today", ["schwa"], "to 弱读。", "两个音节一样重。", "day 明显更重。", 1, "initial"),
      seed("again", ["schwa"], "a 弱，gain 重。", "a 太饱满。", "重音自然后移。", 2, "initial"),
      seed("support", ["schwa"], "sup 弱，port 重。", "support 两拍一样重。", "弱强节奏清楚。", 2, "initial"),
      seed("banana", ["schwa"], "中间 na 重，前后轻。", "三个音节等重。", "重音峰值明确。", 3, "mixed"),
      seed("computer", ["schwa"], "第二音节重，其他弱。", "每个音节都用力。", "多音节有中心。", 3, "mixed"),
      seed("a cup", ["schwa"], "a 弱到很轻。", "a 抢重音。", "cup 是中心。", 3, "mixed"),
      seed("of course", ["schwa"], "of 弱，course 重。", "of 读成完整 /ʌv/ 很重。", "course 顶出来。", 3, "mixed"),
      seed("want to", ["schwa"], "to 弱读连接。", "to 读成 too。", "短语变轻快。", 4, "mixed"),
      seed("going to", ["schwa"], "to 弱，不抢 going。", "to 过重。", "going 是中心。", 4, "mixed"),
      seed("kind of", ["schwa"], "of 弱化并连接。", "of 太重。", "短语自然收尾。", 4, "mixed"),
      seed("a lot of", ["schwa"], "a/of 弱，lot 重。", "每个小词都重读。", "强弱层次清楚。", 5, "mixed"),
    ],
    pairs: [
      pair("two days", "today", "oo", "schwa"),
      pair("a boat", "about", "oh", "schwa"),
      pair("want two", "want to", "oo", "schwa"),
      pair("cup of tea", "cuppa tea", "v", "schwa"),
      pair("can go", "can go now", "ae", "schwa"),
      pair("for you", "for ya", "r", "schwa"),
      pair("of course", "of course", "v", "schwa"),
      pair("the best", "the very best", "dh", "schwa"),
    ],
    sentences: [
      seed("I want to talk about it.", ["schwa"], "want/talk/about/it 是骨架，to 弱。", "逐词等重。", "句子有轻重波峰。", 2, "mixed"),
      seed("It's one of the best ideas.", ["schwa"], "one/best/ideas 重，of/the 弱。", "of/the 太重。", "虚词轻带过。", 3, "mixed"),
      seed("I'm going to call you today.", ["schwa"], "going/call/today 重，to 弱。", "to 读成 too。", "连接自然。", 3, "mixed"),
      seed("Can you give me a cup of tea?", ["schwa"], "give/cup/tea 重，a/of 弱。", "a/of 太用力。", "问句轻重自然。", 3, "mixed"),
      seed("We need to finish it before noon.", ["schwa"], "need/finish/noon 重，to/it/before 弱。", "所有词平均用力。", "内容词更突出。", 4, "mixed"),
      seed("The answer is in the middle of the page.", ["schwa"], "answer/middle/page 重，the/of 弱。", "虚词抢节奏。", "长句里仍有主干。", 4, "mixed"),
      seed("I was trying to think about the next step.", ["schwa"], "trying/think/next/step 重。", "to/about/the 过重。", "节奏有推进。", 5, "mixed"),
      seed("A lot of people are going to ask about it.", ["schwa"], "lot/people/going/ask 重。", "a/of/are/to/about 逐词重读。", "长句轻重分层。", 5, "mixed"),
    ],
    shadowing: [
      seed("I want to talk about it, but I need a minute.", ["schwa"], "want/talk/need/minute 重，to/about/a 弱。", "虚词全部抢重音。", "听起来像英语节拍而不是逐词读。", 4, "mixed"),
      seed("It's one of the best ways to practice every day.", ["schwa"], "one/best/ways/practice/day 是中心。", "of/the/to/every 过重。", "长句有强弱波动。", 4, "mixed"),
      seed("A lot of people are going to ask about the answer.", ["schwa"], "lot/people/going/ask/answer 重。", "弱读缺失。", "弱读和连读自然。", 5, "mixed"),
    ],
  },
  "oo-uh": {
    syllables: [
      seed("pool", ["oo"], "/uː/ 圆唇拉长。", "读短像 pull。", "长而圆。", 1, "medial", "/puːl/"),
      seed("pull", ["uh"], "/ʊ/ 短促放松。", "拖长像 pool。", "短而松。", 1, "medial", "/pʊl/"),
      seed("Luke", ["oo"], "长音后收 /k/。", "读成 look。", "长音清楚。", 2, "medial", "/luːk/"),
      seed("look", ["uh"], "短音后收 /k/。", "拖成长音。", "look 短促。", 2, "medial", "/lʊk/"),
      seed("blue book", ["oo", "uh"], "blue 长，book 短。", "book 被拖长。", "长短对比明显。", 3, "mixed"),
      seed("good food", ["uh", "oo"], "good 短，food 长。", "两个都读长。", "短语里切换稳定。", 3, "mixed"),
    ],
    words: [
      seed("pool", ["oo"], "圆唇拉长。", "读成 pull。", "长音两拍。", 1, "medial", "/puːl/"),
      seed("pull", ["uh"], "放松短促。", "读成 pool。", "短音收住。", 1, "medial", "/pʊl/"),
      seed("Luke", ["oo"], "长音清楚。", "读成 look。", "长音后 /k/。", 2, "medial", "/luːk/"),
      seed("look", ["uh"], "短音不拖。", "读成 Luke。", "一拍完成。", 2, "medial", "/lʊk/"),
      seed("food", ["oo"], "food 长而圆。", "读成 foot。", "尾音 /d/ 清楚。", 2, "medial", "/fuːd/"),
      seed("foot", ["uh"], "foot 短。", "拖成 food。", "短音加 /t/。", 2, "medial", "/fʊt/"),
      seed("school", ["oo"], "school 中 /uː/ 拉长。", "长音不够。", "辅音群后长音仍稳。", 3, "medial"),
      seed("good", ["uh"], "good 短，不要圆太久。", "读成 goood。", "短促自然。", 3, "medial"),
      seed("music", ["oo"], "music 开头长而圆。", "长音塌成短音。", "第一音节清楚。", 4, "initial"),
      seed("wooden", ["uh"], "wooden 的 /ʊ/ 短。", "读得过长。", "短音进入弱音节。", 4, "initial"),
      seed("blue book", ["oo", "uh"], "blue 长，book 短。", "book 拖长。", "短语里一长一短。", 5, "mixed"),
      seed("good news", ["uh", "oo"], "good 短，news 长。", "两个音时长一样。", "自然语速有对比。", 5, "mixed"),
    ],
    pairs: [
      pair("pool", "pull", "oo", "uh", "/puːl/", "/pʊl/"),
      pair("Luke", "look", "oo", "uh", "/luːk/", "/lʊk/"),
      pair("food", "foot", "oo", "uh", "/fuːd/", "/fʊt/"),
      pair("fool", "full", "oo", "uh", "/fuːl/", "/fʊl/"),
      pair("suit", "soot", "oo", "uh", "/suːt/", "/sʊt/"),
      pair("cooed", "could", "oo", "uh", "/kuːd/", "/kʊd/"),
      pair("shooed", "should", "oo", "uh", "/ʃuːd/", "/ʃʊd/"),
      pair("who'd", "hood", "oo", "uh", "/huːd/", "/hʊd/"),
    ],
    sentences: [
      seed("Look at the pool near the school.", ["uh", "oo"], "look 短，pool/school 长。", "look 被拖成长音。", "长短分明。", 2, "mixed"),
      seed("The full moon looked blue.", ["uh", "oo"], "full/looked 短，moon/blue 长。", "full 读成 fool。", "句子里长短稳定。", 3, "mixed"),
      seed("Put the food on the wooden table.", ["uh", "oo"], "put/wooden 短，food 长。", "food 短成 foot。", "短词和长词分开。", 3, "mixed"),
      seed("Good students choose useful tools.", ["uh", "oo"], "good 短，students/useful/tools 长。", "good 拖长。", "多音节里仍分明。", 4, "mixed"),
      seed("Could you move the blue book?", ["uh", "oo"], "could/book 短，move/blue 长。", "could 读成长 /uː/。", "问句自然。", 4, "mixed"),
      seed("The cook used a wooden spoon.", ["uh", "oo"], "cook/wooden 短，used/spoon 长。", "cook 读成 kook。", "厨房词不混。", 4, "mixed"),
      seed("Luke took the full box to school.", ["oo", "uh"], "Luke/school 长，took/full 短。", "took 拖长。", "多处长短稳定。", 5, "mixed"),
      seed("The new music sounded good in the room.", ["oo", "uh"], "new/music/room 长，good 短。", "good 过长。", "自然语流里对比清楚。", 5, "mixed"),
    ],
    shadowing: [
      seed("Look at the blue book near the school pool.", ["oo", "uh"], "blue/school/pool 长，look/book 短。", "短音拖成长音。", "长短在同一句里稳定。", 4, "mixed"),
      seed("The cook put good food on the wooden table.", ["oo", "uh"], "cook/put/good/wooden 短，food 长。", "food 和 foot 混。", "语速自然但长短分明。", 4, "mixed"),
      seed("Luke chose useful tools for the full room.", ["oo", "uh"], "Luke/chose/useful/tools/room 长，full 短。", "full 拉成长音。", "多音节里时长稳定。", 5, "mixed"),
    ],
  },
  "n-ng": {
    syllables: [
      seed("sin", ["n"], "/n/ 舌尖抵齿龈。", "舌根抬起读成 sing。", "前鼻音清楚。", 1, "final", "/sɪn/"),
      seed("sing", ["ng"], "/ŋ/ 舌根抬起，舌尖放下。", "读成 sin 或 sing-g。", "后鼻音不加 /g/。", 1, "final", "/sɪŋ/"),
      seed("thin", ["n"], "结尾 /n/ 在前面。", "读成 thing。", "舌尖接触。", 2, "final", "/θɪn/"),
      seed("thing", ["ng"], "结尾 /ŋ/ 在后面。", "额外加 /g/。", "舌根收住。", 2, "final", "/θɪŋ/"),
      seed("long song", ["ng"], "两个词尾都是 /ŋ/。", "读成 lon son。", "后鼻音连续稳定。", 3, "mixed"),
      seed("nine rings", ["n", "ng"], "nine 前鼻音，rings 后鼻音。", "两个鼻音位置混。", "舌尖和舌根分开。", 3, "mixed"),
    ],
    words: [
      seed("sing", ["ng"], "舌根抬起，不加 /g/。", "读成 sin 或 sing-g。", "后鼻音干净。", 1, "final", "/sɪŋ/"),
      seed("sin", ["n"], "舌尖抵齿龈。", "读成 sing。", "前鼻音短收。", 1, "final", "/sɪn/"),
      seed("thing", ["ng"], "词尾 /ŋ/ 在后。", "读成 thin。", "舌根闭合。", 2, "final", "/θɪŋ/"),
      seed("thin", ["n"], "词尾 /n/ 在前。", "读成 thing。", "舌尖清楚。", 2, "final", "/θɪn/"),
      seed("long", ["ng"], "long 结尾不加元音。", "读成 lon。", "后鼻音完整。", 2, "final", "/lɔːŋ/"),
      seed("loan", ["n"], "loan 结尾 /n/。", "读成 long。", "舌尖收。", 2, "final", "/loʊn/"),
      seed("language", ["ng"], "第一个音节含 /ŋɡ/。", "读成 lan-guage。", "后鼻音再接 /g/。", 3, "medial", "/ˈlæŋɡwɪdʒ/"),
      seed("morning", ["ng"], "morning 两处鼻音，最后 /ŋ/。", "结尾加 /g/。", "后鼻音轻收。", 3, "final"),
      seed("interesting", ["ng"], "结尾 /ŋ/ 轻，不加 /g/。", "读成 interesting-g。", "多音节末尾自然。", 4, "final"),
      seed("running", ["n", "ng"], "running 中 /n/ 和词尾 /ŋ/ 都有。", "全部变成 /n/。", "前后鼻音切换。", 4, "mixed"),
      seed("nine rings", ["n", "ng"], "nine 前，rings 后。", "rings 读成 rins。", "两个位置分明。", 5, "mixed"),
      seed("singing in the morning", ["ng"], "singing/morning 都有 /ŋ/。", "每个 /ŋ/ 后加 /g/。", "长短语里后鼻音稳定。", 5, "mixed"),
    ],
    pairs: [
      pair("sin", "sing", "n", "ng", "/sɪn/", "/sɪŋ/"),
      pair("thin", "thing", "n", "ng", "/θɪn/", "/θɪŋ/"),
      pair("ban", "bang", "n", "ng", "/bæn/", "/bæŋ/"),
      pair("ran", "rang", "n", "ng", "/ræn/", "/ræŋ/"),
      pair("win", "wing", "n", "ng", "/wɪn/", "/wɪŋ/"),
      pair("kin", "king", "n", "ng", "/kɪn/", "/kɪŋ/"),
      pair("loan", "long", "n", "ng", "/loʊn/", "/lɔːŋ/"),
      pair("sun", "sung", "n", "ng", "/sʌn/", "/sʌŋ/"),
    ],
    sentences: [
      seed("I can sing a long song.", ["ng"], "sing/long/song 都是后鼻音。", "后鼻音变前鼻音。", "每个 /ŋ/ 不加 /g/。", 2, "final"),
      seed("The language sounds interesting.", ["ng"], "language/interesting 有 /ŋ/。", "language 开头读成 lan。", "多音节里后鼻音清楚。", 3, "mixed"),
      seed("Bring the ring in the morning.", ["ng"], "bring/ring/morning 词尾 /ŋ/。", "ring 加 /g/。", "词尾轻收。", 3, "final"),
      seed("Nine singers sang one song.", ["n", "ng"], "nine/one 前鼻，singers/sang/song 后鼻。", "前后鼻音混。", "两种鼻音分开。", 4, "mixed"),
      seed("The king ran in the rain.", ["n", "ng"], "king 后鼻，ran/in/rain 前鼻。", "king 读成 kin。", "对比清楚。", 4, "mixed"),
      seed("Running in the morning feels relaxing.", ["n", "ng"], "running/morning/relaxing 结尾 /ŋ/。", "每个 ing 加 /g/。", "自然语流不加爆破。", 4, "final"),
      seed("The young engineer is learning English.", ["ng"], "young/engineer/learning/English 多处 /ŋ/。", "English 开头鼻音位置不稳。", "复杂词稳定。", 5, "mixed"),
      seed("Hang the green sign near the window.", ["n", "ng"], "hang/green/sign 的鼻音不同。", "sign 结尾加 /g/。", "前后鼻音按词切换。", 5, "mixed"),
    ],
    shadowing: [
      seed("I can sing a long song in the morning.", ["n", "ng"], "sing/long/song/morning 后鼻，in 前鼻。", "所有鼻音读成 /n/。", "后鼻音不加 /g/。", 4, "mixed"),
      seed("Nine singers are learning English together.", ["n", "ng"], "nine 前鼻，singers/learning/English 后鼻。", "ing 结尾加 /g/。", "长句鼻音位置稳定。", 4, "mixed"),
      seed("The young king ran along the green wing.", ["n", "ng"], "young/king/along/green/wing 多处后鼻。", "king/wing 读成 kin/win。", "多处后鼻音轻收。", 5, "mixed"),
    ],
  },
};

function bankForPack(pack: TrainingPack): CuratedCourseBank | null {
  return CURATED_COURSE_BANK[pack.id] ?? null;
}

function courseItemFromSeed(
  prefix: string,
  index: number,
  source: CourseSeed,
): TrainingCourseItem {
  return courseItem(
    `${prefix}-${index + 1}`,
    source.text,
    source.targetPhonemes,
    source.focusPoint,
    source.commonMistake,
    source.successCue,
    source.difficulty,
    source.ipa,
    undefined,
    {
      displayText: source.text,
      referenceText: source.text,
      playbackText: source.text,
      position: source.position,
      isRecordable: true,
    },
  );
}

function pairSeedToMinimalPair(source: PairSeed): MinimalPairItem {
  return {
    wordA: source.wordA,
    ipaA: source.ipaA ?? "",
    phonemeA: source.phonemeA,
    wordB: source.wordB,
    ipaB: source.ipaB ?? "",
    phonemeB: source.phonemeB,
  };
}

function naturalPairText(pair: MinimalPairItem | PairSeed): string {
  return `${pair.wordA} ${pair.wordB}`;
}

function buildPerceptionLevel(pack: TrainingPack): TrainingLevel {
  const bank = bankForPack(pack);
  const pairs =
    bank?.pairs.map(pairSeedToMinimalPair) ??
    cycle(pack.perceptionItems, 8).map((perceptionItem, index) => ({
      wordA: perceptionItem.wordA,
      ipaA: "",
      phonemeA: pack.contrastPhonemes?.[0] ?? pack.targetPhonemes[0] ?? "",
      wordB: perceptionItem.wordB,
      ipaB: "",
      phonemeB:
        pack.contrastPhonemes?.[1] ??
        pack.targetPhonemes[index % pack.targetPhonemes.length] ??
        "",
    }));
  return {
    id: "perception-abx",
    title: "听辨 ABX",
    kind: "perception",
    goal: "先听出目标差异，再进入发音动作。",
    coachCue: "不要急着读。先判断 X 更像 A 还是 B，听不准就会练成旧习惯。",
    passRule: PASS_RULES.perception,
    items: pairs.slice(0, 8).map((item, index) =>
      courseItem(
        `perception-${index + 1}`,
        item.wordA,
        [item.phonemeA, item.phonemeB],
        `听清 ${item.wordA} 和 ${item.wordB} 的目标差异。`,
        "只听首尾辅音或靠猜，会跳过真正要改的音。",
        "能在不看文字时稳定分辨 A/B/X。",
        index < 4 ? 1 : 2,
        undefined,
        item.wordB,
        {
          displayText: `${item.wordA} / ${item.wordB}`,
          referenceText: item.wordA,
          playbackText: item.wordA,
          isRecordable: false,
        },
      ),
    ),
  };
}

function buildArticulationLevel(pack: TrainingPack): TrainingLevel {
  const targets = pack.targetPhonemes;
  const first = targets[0] ?? "";
  const second = targets[1] ?? first;
  const items = [
    courseItem(
      "action-1",
      phonemeLabel(first),
      [first],
      pack.mouthCue,
      pack.l1Problem,
      "先做口型，再出声音，声音不要抢在动作前面。",
      1,
      undefined,
      undefined,
      { isRecordable: false },
    ),
    courseItem(
      "action-2",
      phonemeLabel(second),
      [second],
      pack.contrastPhonemes
        ? `和 ${pack.contrastPhonemes.map(phonemeLabel).join("、")} 明确分开。`
        : "把目标音做得短、清、稳。",
      "用中文里最接近的音替代，听起来会含混。",
      "能说出两种嘴型/舌位的差别。",
      1,
      undefined,
      undefined,
      { isRecordable: false },
    ),
    courseItem(
      "action-3",
      `${phonemeLabel(first)} → word`,
      targets,
      "从单音过渡到词，不要一进单词就回到旧动作。",
      "单音会，单词里立刻变形。",
      "目标音进入词里仍然保持同一个动作。",
      2,
      undefined,
      undefined,
      { isRecordable: false },
    ),
    courseItem(
      "mistake-1",
      "错误对比 1",
      targets,
      "故意做一次常见错误，再做一次正确动作，建立身体差异。",
      pack.l1Problem,
      "能感觉到错误动作和正确动作的位置不同。",
      2,
      undefined,
      undefined,
      { isRecordable: false },
    ),
    courseItem(
      "mistake-2",
      "错误对比 2",
      targets,
      "慢速读，观察目标音有没有被周围音拖走。",
      "为了流利而牺牲目标音。",
      "慢速时每次都能把目标音放准。",
      2,
      undefined,
      undefined,
      { isRecordable: false },
    ),
  ];
  return {
    id: "articulation",
    title: "发音动作",
    kind: "articulation",
    goal: "建立可执行的嘴型/舌位动作。",
    coachCue: pack.mouthCue,
    passRule: PASS_RULES.articulation,
    items,
  };
}

function buildSyllableLevel(pack: TrainingPack): TrainingLevel {
  const bank = bankForPack(pack);
  return {
    id: "syllable-bridge",
    title: "音节桥接",
    kind: "syllable",
    goal: "把单音放进短音节，防止进词后动作塌掉。",
    coachCue: "每条都慢读两遍，目标音位置不变再进入下一条。",
    passRule: PASS_RULES.syllable,
    items: (
      bank?.syllables ??
      pack.wordLadder.slice(0, 6).map((word, index) =>
        seed(
          word.text,
          [word.phoneme],
          word.description ?? pack.focus,
          pack.l1Problem,
          "目标音能独立听出来，后面的音不拖它。",
          index < 3 ? 2 : 3,
          "mixed",
          word.ipa,
        ),
      )
    ).map((source, index) => courseItemFromSeed("syllable", index, source)),
  };
}

function wordItemsFromPack(pack: TrainingPack): TrainingCourseItem[] {
  const bank = bankForPack(pack);
  if (bank) {
    return bank.words
      .slice(0, 12)
      .map((source, index) => courseItemFromSeed("word", index, source));
  }
  const fromWords = pack.wordLadder.map((word, index) =>
    courseItem(
      `word-base-${index + 1}`,
      word.text,
      [word.phoneme],
      word.description ?? pack.focus,
      pack.l1Problem,
      "目标音清楚，词尾也收干净。",
      Math.min(5, 2 + Math.floor(index / 3)) as TrainingCourseItem["difficulty"],
      word.ipa,
      undefined,
      {
        displayText: word.text,
        referenceText: word.text,
        playbackText: word.text,
        isRecordable: true,
      },
    ),
  );
  const fromPairs = pack.minimalPairs.flatMap((pair) => [
    pairWordItem(pair, "A"),
    pairWordItem(pair, "B"),
  ]);
  return cycle([...fromWords, ...fromPairs], 12).map((item, index) => ({
    ...item,
    id: `word-${index + 1}`,
    referenceText: item.referenceText ?? item.text,
    playbackText: item.playbackText ?? item.text,
    isRecordable: true,
    difficulty: Math.min(5, 1 + Math.floor(index / 3)) as TrainingCourseItem["difficulty"],
  }));
}

function pairWordItem(
  pair: MinimalPairItem,
  side: "A" | "B",
): TrainingCourseItem {
  const isA = side === "A";
  return courseItem(
    `pair-word-${side}-${isA ? pair.wordA : pair.wordB}`,
    isA ? pair.wordA : pair.wordB,
    [isA ? pair.phonemeA : pair.phonemeB],
    `把 ${isA ? pair.ipaA : pair.ipaB} 里的目标音做清楚。`,
    `不要读成 ${isA ? pair.wordB : pair.wordA}。`,
    "听起来能和另一边明显区分。",
    3,
    isA ? pair.ipaA : pair.ipaB,
    undefined,
    {
      displayText: isA ? pair.wordA : pair.wordB,
      referenceText: isA ? pair.wordA : pair.wordB,
      playbackText: isA ? pair.wordA : pair.wordB,
      isRecordable: true,
    },
  );
}

function buildWordLevel(pack: TrainingPack): TrainingLevel {
  return {
    id: "word-ladder",
    title: "单词阶梯",
    kind: "word",
    goal: "覆盖短词、长词、词首、词中和词尾位置。",
    coachCue: "每个词只盯一个目标动作，通过后再加速度。",
    passRule: PASS_RULES.word,
    items: wordItemsFromPack(pack),
  };
}

function buildPairLevel(pack: TrainingPack): TrainingLevel {
  const bank = bankForPack(pack);
  const pairs = bank?.pairs.map(pairSeedToMinimalPair) ?? cycle(pack.minimalPairs, 8);
  return {
    id: "minimal-pair-ladder",
    title: "最小对立对",
    kind: "minimal-pair",
    goal: "把容易混的两个词读成两个不同的词。",
    coachCue: "先慢读 A，再慢读 B，中间停半拍，让嘴型真的切换。",
    passRule: PASS_RULES["minimal-pair"],
    items: pairs.slice(0, 8).map((pair, index) =>
      courseItem(
        `pair-${index + 1}`,
        naturalPairText(pair),
        [pair.phonemeA, pair.phonemeB],
        `${pair.wordA} 和 ${pair.wordB} 的目标音必须拉开。`,
        "两个词用同一个嘴型读，系统可能给整词分，但对比训练不算过。",
        "不用上下文也能听出是两个词。",
        Math.min(5, 2 + Math.floor(index / 2)) as TrainingCourseItem["difficulty"],
        `${pair.ipaA} / ${pair.ipaB}`,
        `${pair.wordA} / ${pair.wordB}`,
        {
          displayText: `${pair.wordA} / ${pair.wordB}`,
          referenceText: naturalPairText(pair),
          playbackText: naturalPairText(pair),
          position: "mixed",
          isRecordable: true,
        },
      ),
    ),
  };
}

function buildSentenceLevel(pack: TrainingPack): TrainingLevel {
  const bank = bankForPack(pack);
  if (bank) {
    return {
      id: "sentence-ladder",
      title: "句子迁移",
      kind: "sentence",
      goal: "把目标音放进短句和自然句，避免一说快就退回旧习惯。",
      coachCue: "先读慢，目标音过线后再恢复自然速度。",
      passRule: PASS_RULES.sentence,
      items: bank.sentences
        .slice(0, 8)
        .map((source, index) => courseItemFromSeed("sentence", index, source)),
    };
  }
  const generated = pack.minimalPairs.slice(0, 5).map((pair, _index) =>
    item(
      `Say ${pair.wordA}, then ${pair.wordB}, and keep them clear.`,
      "",
      pair.phonemeB,
      `在句子里保持 ${pair.wordA}/${pair.wordB} 的差异。`,
    ),
  );
  return {
    id: "sentence-ladder",
    title: "句子迁移",
    kind: "sentence",
    goal: "把目标音放进短句和自然句，避免一说快就退回旧习惯。",
    coachCue: "先读慢，目标音过线后再恢复自然速度。",
    passRule: PASS_RULES.sentence,
    items: cycle([...pack.sentenceLadder, ...generated], 8).map((sentence, index) =>
      courseItem(
        `sentence-${index + 1}`,
        sentence.text,
        pack.targetPhonemes,
        sentence.description ?? pack.focus,
        "句子里只顾流利，目标音会被吞掉或替换。",
        "目标音、词尾和句子节奏都能同时保住。",
        Math.min(5, 2 + Math.floor(index / 2)) as TrainingCourseItem["difficulty"],
        undefined,
        undefined,
        {
          displayText: sentence.text,
          referenceText: sentence.text,
          playbackText: sentence.text,
          isRecordable: true,
        },
      ),
    ),
  };
}

function buildShadowingLevel(pack: TrainingPack): TrainingLevel {
  const bank = bankForPack(pack);
  const sourceSentences =
    bank?.shadowing ??
    cycle(pack.sentenceLadder, 3).map((sentence, index) =>
      seed(
        sentence.text,
        pack.targetPhonemes,
        `跟读时保留：${sentence.description ?? pack.focus}`,
        "模仿速度但丢掉目标音。",
        "语速自然时目标音仍然能被听出来。",
        Math.min(5, 3 + index) as TrainingCourseItem["difficulty"],
        "mixed",
      ),
    );
  return {
    id: "shadowing-transfer",
    title: "影子跟读",
    kind: "shadowing",
    goal: "从单句读准，过渡到自然语流里的稳定。",
    coachCue: "听一句，慢半拍跟读；不要每个词等重，目标音仍然要清楚。",
    passRule: PASS_RULES.shadowing,
    items: sourceSentences
      .slice(0, 3)
      .map((source, index) => courseItemFromSeed("shadow", index, source)),
  };
}

function buildMixedReviewLevel(pack: TrainingPack): TrainingLevel {
  const words = wordItemsFromPack(pack).slice(0, 2);
  const pairs = buildPairLevel(pack).items.slice(0, 2);
  const sentences = buildSentenceLevel(pack).items.slice(0, 2);
  return {
    id: "mixed-review",
    title: "混合复测",
    kind: "mixed-review",
    goal: "不按题型提示，检查目标音是否真的稳定。",
    coachCue: "这一步是掌握度判定核心。目标音不过线，训练包不算掌握。",
    passRule: PASS_RULES["mixed-review"],
    items: [...words, ...pairs, ...sentences].map((item, index) => ({
      ...item,
      id: `review-${index + 1}`,
      referenceText: item.referenceText ?? item.text,
      playbackText: item.playbackText ?? item.referenceText ?? item.text,
      isRecordable: true,
      difficulty: Math.min(5, 3 + Math.floor(index / 2)) as TrainingCourseItem["difficulty"],
    })),
  };
}

function buildCourse(pack: TrainingPack) {
  const paths = DEFAULT_REMEDIATION_PATHS.filter((path) => {
    if (path.id === "rebuild-target") return true;
    return TRAINING_ERROR_PATTERNS.some(
      (pattern) =>
        pattern.appliesToPackIds.includes(pack.id) &&
        pattern.remediationPathId === path.id,
    );
  });
  return {
    packId: pack.id,
    levels: [
      buildPerceptionLevel(pack),
      buildArticulationLevel(pack),
      buildSyllableLevel(pack),
      buildWordLevel(pack),
      buildPairLevel(pack),
      buildSentenceLevel(pack),
      buildShadowingLevel(pack),
      buildMixedReviewLevel(pack),
    ],
    errorPatterns: TRAINING_ERROR_PATTERNS.filter((pattern) =>
      pattern.appliesToPackIds.includes(pack.id),
    ),
    remediation: paths,
  };
}

for (const pack of TRAINING_PACKS) {
  pack.course = buildCourse(pack);
}

export function getTrainingPack(packId: string): TrainingPack | null {
  return TRAINING_PACKS.find((pack) => pack.id === packId) ?? null;
}

export function getPackForPhoneme(phoneme: string): TrainingPack | null {
  return (
    TRAINING_PACKS.find((pack) => pack.targetPhonemes.includes(phoneme)) ?? null
  );
}

export function getPackPrimaryTarget(pack: TrainingPack): string {
  return pack.targetPhonemes[0] ?? "";
}
