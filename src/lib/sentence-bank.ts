import type { SentenceBankEntry } from "./drill-utils";

/**
 * Pre-built sentence bank for deliberate practice.
 * Each sentence is tagged with relevant phoneme slugs.
 * Categories: tongue-twister, minimal-pair, daily, interview
 */
export const SENTENCE_BANK: SentenceBankEntry[] = [
  // -- /th/ Voiceless dental fricative --
  {
    text: "I think three thin thieves thought a thousand thoughts.",
    phonemes: ["th"],
    category: "tongue-twister",
  },
  {
    text: "The thought I thought I thought was not the thought I thought.",
    phonemes: ["th"],
    category: "tongue-twister",
  },
  {
    text: "Thank you for thinking things through thoroughly.",
    phonemes: ["th"],
    category: "daily",
  },
  {
    text: "Both math and health require a lot of thought.",
    phonemes: ["th"],
    category: "daily",
  },
  {
    text: "Is it sink or think? Mouse or mouth?",
    phonemes: ["th", "s"],
    category: "minimal-pair",
  },

  // -- /dh/ Voiced dental fricative --
  {
    text: "They breathed the breeze through the smooth heather.",
    phonemes: ["dh"],
    category: "tongue-twister",
  },
  {
    text: "This is the weather that mother and father like together.",
    phonemes: ["dh"],
    category: "tongue-twister",
  },
  {
    text: "Would you rather go there or stay with the others?",
    phonemes: ["dh"],
    category: "daily",
  },

  // -- /r/ vs /l/ --
  {
    text: "Jerry's jelly berry is really rare and really red.",
    phonemes: ["r", "l"],
    category: "tongue-twister",
  },
  {
    text: "Red lorry, yellow lorry, red lorry, yellow lorry.",
    phonemes: ["r", "l"],
    category: "tongue-twister",
  },
  {
    text: "The light on the right is bright tonight.",
    phonemes: ["r", "l"],
    category: "minimal-pair",
  },
  {
    text: "Please reply to the email about the relay race.",
    phonemes: ["r", "l"],
    category: "daily",
  },
  {
    text: "I'd like to learn more about the role in your laboratory.",
    phonemes: ["r", "l"],
    category: "interview",
  },

  // -- /ee/ vs /ih/ --
  {
    text: "He eats cheap chips and sips thick shakes.",
    phonemes: ["ee", "ih"],
    category: "tongue-twister",
  },
  {
    text: "The sheep on the ship didn't sleep a bit.",
    phonemes: ["ee", "ih"],
    category: "minimal-pair",
  },
  {
    text: "Please sit in this seat and feel free to eat.",
    phonemes: ["ee", "ih"],
    category: "minimal-pair",
  },
  {
    text: "I need to pick the green beans from the field.",
    phonemes: ["ee", "ih"],
    category: "daily",
  },

  // -- /eh/ vs /ae/ --
  {
    text: "A fat cat sat on a mat and ate a bad rat.",
    phonemes: ["ae", "eh"],
    category: "tongue-twister",
  },
  {
    text: "The man in bed had a bad headache.",
    phonemes: ["ae", "eh"],
    category: "minimal-pair",
  },
  {
    text: "Can you send the bag to the desk by ten?",
    phonemes: ["ae", "eh"],
    category: "daily",
  },

  // -- /s/ vs /sh/ --
  {
    text: "She sells seashells by the seashore.",
    phonemes: ["s", "sh"],
    category: "tongue-twister",
  },
  {
    text: "The sun shall shine soon on the silver ship.",
    phonemes: ["s", "sh"],
    category: "minimal-pair",
  },
  {
    text: "I saw a shoe shop with special sandals on sale.",
    phonemes: ["s", "sh"],
    category: "daily",
  },

  // -- /p/ vs /b/ --
  {
    text: "Peter Piper picked a peck of pickled peppers.",
    phonemes: ["p", "b"],
    category: "tongue-twister",
  },
  {
    text: "A big black bug bit a big brown bear.",
    phonemes: ["b"],
    category: "tongue-twister",
  },
  {
    text: "Put the blue pen back in the brown paper bag.",
    phonemes: ["p", "b"],
    category: "daily",
  },

  // -- /v/ vs /w/ --
  {
    text: "Vivien believes Wayne vanished with very valuable velvet.",
    phonemes: ["v", "w"],
    category: "tongue-twister",
  },
  {
    text: "We went west while Victor visited the village.",
    phonemes: ["v", "w"],
    category: "minimal-pair",
  },
  {
    text: "The view from the window was wonderful and vivid.",
    phonemes: ["v", "w"],
    category: "daily",
  },

  // -- /n/ vs /l/ --
  {
    text: "Nine nice night nurses nursing nicely.",
    phonemes: ["n", "l"],
    category: "tongue-twister",
  },
  {
    text: "No one knows the name of the lion in the lane.",
    phonemes: ["n", "l"],
    category: "minimal-pair",
  },

  // -- /sh/ vs /ch/ --
  {
    text: "Charles chose cheap cherry cheese from the shop.",
    phonemes: ["sh", "ch"],
    category: "tongue-twister",
  },
  {
    text: "Did you choose the shoes or the shirt with the charm?",
    phonemes: ["sh", "ch"],
    category: "minimal-pair",
  },

  // -- /f/ vs /th/ --
  {
    text: "The first three free throws were fierce and fast.",
    phonemes: ["f", "th"],
    category: "tongue-twister",
  },
  {
    text: "My friend thinks the fish is fresh from the sea.",
    phonemes: ["f", "th"],
    category: "minimal-pair",
  },

  // -- /oo/ vs /uh/ --
  {
    text: "The fool thought he was full but he could eat more food.",
    phonemes: ["oo", "uh"],
    category: "minimal-pair",
  },
  {
    text: "Look at the moon, it looks so cool and smooth.",
    phonemes: ["oo", "uh"],
    category: "daily",
  },

  // -- /uh2/ --
  {
    text: "My brother loves nothing but running in the sun.",
    phonemes: ["uh2"],
    category: "tongue-twister",
  },
  {
    text: "Come on, let's have some fun under the summer sun.",
    phonemes: ["uh2"],
    category: "daily",
  },

  // -- /er/ --
  {
    text: "She works hard and learns fast at her first job.",
    phonemes: ["er"],
    category: "interview",
  },

  // -- Interview sentences --
  {
    text: "I believe my strengths align well with your team's objectives.",
    phonemes: ["ee", "l", "r"],
    category: "interview",
  },
  {
    text: "Could you tell me more about the growth opportunities in this position?",
    phonemes: ["r", "th", "dh"],
    category: "interview",
  },
  {
    text: "I thrive in challenging environments that require creative thinking.",
    phonemes: ["th", "r", "ch"],
    category: "interview",
  },

  // -- Daily conversation --
  {
    text: "Excuse me, where is the nearest subway station?",
    phonemes: ["s", "z", "w"],
    category: "daily",
  },
  {
    text: "I'd like a large coffee with cream and sugar, please.",
    phonemes: ["l", "r", "s"],
    category: "daily",
  },
  {
    text: "What time does the meeting start tomorrow morning?",
    phonemes: ["t", "m", "s"],
    category: "daily",
  },
];

/** Get all unique phoneme slugs that have sentences */
export function getSentencePhonemes(): string[] {
  const slugs = new Set<string>();
  for (const entry of SENTENCE_BANK) {
    for (const p of entry.phonemes) {
      slugs.add(p);
    }
  }
  return Array.from(slugs).sort();
}

/** Get sentence count for a specific phoneme */
export function getSentenceCount(phonemeSlug: string): number {
  return SENTENCE_BANK.filter((s) => s.phonemes.includes(phonemeSlug)).length;
}
