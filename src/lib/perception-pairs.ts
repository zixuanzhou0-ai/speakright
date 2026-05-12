/**
 * Perception training (ABX ear training) data.
 * Uses blue (Max) and pink (Nichalia) voices for multi-speaker sampling.
 * ALL audio files verified to exist in public/audio/words/{blue,pink}/.
 */

export interface PerceptionPair {
  phonemeA: string;
  phonemeB: string;
  label: string;
  items: Array<{
    wordA: string;
    wordB: string;
    audioA: string;
    audioB: string;
  }>;
}

export const PERCEPTION_PAIRS: PerceptionPair[] = [
  {
    phonemeA: "ee",
    phonemeB: "ih",
    label: "/i\u02D0/ vs /\u026A/",
    items: [
      {
        wordA: "see",
        wordB: "sit",
        audioA: "/audio/words/blue/see.mp3",
        audioB: "/audio/words/pink/sit.mp3",
      },
      {
        wordA: "eat",
        wordB: "big",
        audioA: "/audio/words/blue/eat.mp3",
        audioB: "/audio/words/pink/big.mp3",
      },
      {
        wordA: "beach",
        wordB: "ship",
        audioA: "/audio/words/blue/beach.mp3",
        audioB: "/audio/words/pink/ship.mp3",
      },
      {
        wordA: "sleep",
        wordB: "swim",
        audioA: "/audio/words/blue/sleep.mp3",
        audioB: "/audio/words/pink/swim.mp3",
      },
      {
        wordA: "green",
        wordB: "give",
        audioA: "/audio/words/blue/green.mp3",
        audioB: "/audio/words/pink/give.mp3",
      },
    ],
  },
  {
    phonemeA: "eh",
    phonemeB: "ae",
    label: "/e/ vs /\u00E6/",
    items: [
      {
        wordA: "bed",
        wordB: "bad",
        audioA: "/audio/words/blue/bed.mp3",
        audioB: "/audio/words/pink/bad.mp3",
      },
      {
        wordA: "pen",
        wordB: "man",
        audioA: "/audio/words/blue/pen.mp3",
        audioB: "/audio/words/pink/man.mp3",
      },
      {
        wordA: "best",
        wordB: "back",
        audioA: "/audio/words/blue/best.mp3",
        audioB: "/audio/words/pink/back.mp3",
      },
      {
        wordA: "help",
        wordB: "cat",
        audioA: "/audio/words/blue/help.mp3",
        audioB: "/audio/words/pink/cat.mp3",
      },
      {
        wordA: "red",
        wordB: "map",
        audioA: "/audio/words/blue/red.mp3",
        audioB: "/audio/words/pink/map.mp3",
      },
    ],
  },
  {
    phonemeA: "s",
    phonemeB: "th",
    label: "/s/ vs /\u03B8/",
    items: [
      {
        wordA: "see",
        wordB: "think",
        audioA: "/audio/words/blue/see.mp3",
        audioB: "/audio/words/pink/think.mp3",
      },
      {
        wordA: "sun",
        wordB: "three",
        audioA: "/audio/words/blue/sun.mp3",
        audioB: "/audio/words/pink/three.mp3",
      },
      {
        wordA: "safe",
        wordB: "bath",
        audioA: "/audio/words/blue/safe.mp3",
        audioB: "/audio/words/pink/bath.mp3",
      },
      {
        wordA: "slow",
        wordB: "thought",
        audioA: "/audio/words/blue/slow.mp3",
        audioB: "/audio/words/pink/thought.mp3",
      },
      {
        wordA: "smile",
        wordB: "health",
        audioA: "/audio/words/blue/smile.mp3",
        audioB: "/audio/words/pink/health.mp3",
      },
    ],
  },
  {
    phonemeA: "l",
    phonemeB: "r",
    label: "/l/ vs /r/",
    items: [
      {
        wordA: "light",
        wordB: "right",
        audioA: "/audio/words/blue/light.mp3",
        audioB: "/audio/words/pink/right.mp3",
      },
      {
        wordA: "glass",
        wordB: "green",
        audioA: "/audio/words/blue/glass.mp3",
        audioB: "/audio/words/pink/green.mp3",
      },
      {
        wordA: "fly",
        wordB: "free",
        audioA: "/audio/words/blue/fly.mp3",
        audioB: "/audio/words/pink/free.mp3",
      },
      {
        wordA: "long",
        wordB: "run",
        audioA: "/audio/words/blue/long.mp3",
        audioB: "/audio/words/pink/run.mp3",
      },
      {
        wordA: "love",
        wordB: "rain",
        audioA: "/audio/words/blue/love.mp3",
        audioB: "/audio/words/pink/rain.mp3",
      },
    ],
  },
  {
    phonemeA: "v",
    phonemeB: "w",
    label: "/v/ vs /w/",
    items: [
      {
        wordA: "very",
        wordB: "walk",
        audioA: "/audio/words/blue/very.mp3",
        audioB: "/audio/words/pink/walk.mp3",
      },
      {
        wordA: "view",
        wordB: "wash",
        audioA: "/audio/words/blue/view.mp3",
        audioB: "/audio/words/pink/wash.mp3",
      },
      {
        wordA: "voice",
        wordB: "water",
        audioA: "/audio/words/blue/voice.mp3",
        audioB: "/audio/words/pink/water.mp3",
      },
      {
        wordA: "vision",
        wordB: "warm",
        audioA: "/audio/words/blue/vision.mp3",
        audioB: "/audio/words/pink/warm.mp3",
      },
      {
        wordA: "give",
        wordB: "swim",
        audioA: "/audio/words/blue/give.mp3",
        audioB: "/audio/words/pink/swim.mp3",
      },
    ],
  },
];
