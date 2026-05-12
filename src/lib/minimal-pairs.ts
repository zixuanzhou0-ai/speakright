/**
 * Minimal pair sets for Chinese L1 speakers.
 * Each set targets two commonly confused phonemes.
 */

export interface MinimalPairSet {
  id: string;
  phonemeA: string;
  phonemeB: string;
  label: string;
  pairs: Array<{ wordA: string; ipaA: string; wordB: string; ipaB: string }>;
}

export const MINIMAL_PAIR_SETS: MinimalPairSet[] = [
  {
    id: "ee-ih",
    phonemeA: "ee",
    phonemeB: "ih",
    label: "/i\u02D0/ vs /\u026A/",
    pairs: [
      {
        wordA: "sheep",
        ipaA: "/\u0283i\u02D0p/",
        wordB: "ship",
        ipaB: "/\u0283\u026Ap/",
      },
      { wordA: "seat", ipaA: "/si\u02D0t/", wordB: "sit", ipaB: "/s\u026At/" },
      { wordA: "feet", ipaA: "/fi\u02D0t/", wordB: "fit", ipaB: "/f\u026At/" },
      { wordA: "beat", ipaA: "/bi\u02D0t/", wordB: "bit", ipaB: "/b\u026At/" },
      {
        wordA: "cheap",
        ipaA: "/t\u0283i\u02D0p/",
        wordB: "chip",
        ipaB: "/t\u0283\u026Ap/",
      },
    ],
  },
  {
    id: "eh-ae",
    phonemeA: "eh",
    phonemeB: "ae",
    label: "/e/ vs /\u00E6/",
    pairs: [
      { wordA: "bed", ipaA: "/bed/", wordB: "bad", ipaB: "/b\u00E6d/" },
      { wordA: "men", ipaA: "/men/", wordB: "man", ipaB: "/m\u00E6n/" },
      { wordA: "pen", ipaA: "/pen/", wordB: "pan", ipaB: "/p\u00E6n/" },
      { wordA: "set", ipaA: "/set/", wordB: "sat", ipaB: "/s\u00E6t/" },
      { wordA: "met", ipaA: "/met/", wordB: "mat", ipaB: "/m\u00E6t/" },
    ],
  },
  {
    id: "s-th",
    phonemeA: "s",
    phonemeB: "th",
    label: "/s/ vs /\u03B8/",
    pairs: [
      {
        wordA: "sink",
        ipaA: "/s\u026A\u014Bk/",
        wordB: "think",
        ipaB: "/\u03B8\u026A\u014Bk/",
      },
      {
        wordA: "mouse",
        ipaA: "/ma\u028As/",
        wordB: "mouth",
        ipaB: "/ma\u028A\u03B8/",
      },
      {
        wordA: "pass",
        ipaA: "/p\u00E6s/",
        wordB: "path",
        ipaB: "/p\u00E6\u03B8/",
      },
      {
        wordA: "sum",
        ipaA: "/s\u028Cm/",
        wordB: "thumb",
        ipaB: "/\u03B8\u028Cm/",
      },
      {
        wordA: "sick",
        ipaA: "/s\u026Ak/",
        wordB: "thick",
        ipaB: "/\u03B8\u026Ak/",
      },
    ],
  },
  {
    id: "l-r",
    phonemeA: "l",
    phonemeB: "r",
    label: "/l/ vs /r/",
    pairs: [
      {
        wordA: "light",
        ipaA: "/la\u026At/",
        wordB: "right",
        ipaB: "/ra\u026At/",
      },
      {
        wordA: "glass",
        ipaA: "/\u0261l\u00E6s/",
        wordB: "grass",
        ipaB: "/\u0261r\u00E6s/",
      },
      { wordA: "fly", ipaA: "/fla\u026A/", wordB: "fry", ipaB: "/fra\u026A/" },
      {
        wordA: "lead",
        ipaA: "/li\u02D0d/",
        wordB: "read",
        ipaB: "/ri\u02D0d/",
      },
      {
        wordA: "lane",
        ipaA: "/le\u026An/",
        wordB: "rain",
        ipaB: "/re\u026An/",
      },
    ],
  },
  {
    id: "v-w",
    phonemeA: "v",
    phonemeB: "w",
    label: "/v/ vs /w/",
    pairs: [
      { wordA: "vest", ipaA: "/vest/", wordB: "west", ipaB: "/west/" },
      {
        wordA: "vine",
        ipaA: "/va\u026An/",
        wordB: "wine",
        ipaB: "/wa\u026An/",
      },
      { wordA: "vet", ipaA: "/vet/", wordB: "wet", ipaB: "/wet/" },
      {
        wordA: "veil",
        ipaA: "/ve\u026Al/",
        wordB: "whale",
        ipaB: "/we\u026Al/",
      },
      {
        wordA: "verse",
        ipaA: "/v\u025D\u02D0s/",
        wordB: "worse",
        ipaB: "/w\u025D\u02D0s/",
      },
    ],
  },
  {
    id: "n-l",
    phonemeA: "n",
    phonemeB: "l",
    label: "/n/ vs /l/",
    pairs: [
      {
        wordA: "night",
        ipaA: "/na\u026At/",
        wordB: "light",
        ipaB: "/la\u026At/",
      },
      { wordA: "no", ipaA: "/no\u028A/", wordB: "low", ipaB: "/lo\u028A/" },
      {
        wordA: "nine",
        ipaA: "/na\u026An/",
        wordB: "line",
        ipaB: "/la\u026An/",
      },
      {
        wordA: "need",
        ipaA: "/ni\u02D0d/",
        wordB: "lead",
        ipaB: "/li\u02D0d/",
      },
      { wordA: "net", ipaA: "/net/", wordB: "let", ipaB: "/let/" },
    ],
  },
  {
    id: "oo-uh",
    phonemeA: "oo",
    phonemeB: "uh",
    label: "/u\u02D0/ vs /\u028A/",
    pairs: [
      { wordA: "pool", ipaA: "/pu\u02D0l/", wordB: "pull", ipaB: "/p\u028Al/" },
      { wordA: "fool", ipaA: "/fu\u02D0l/", wordB: "full", ipaB: "/f\u028Al/" },
      { wordA: "Luke", ipaA: "/lu\u02D0k/", wordB: "look", ipaB: "/l\u028Ak/" },
      { wordA: "suit", ipaA: "/su\u02D0t/", wordB: "soot", ipaB: "/s\u028At/" },
      { wordA: "food", ipaA: "/fu\u02D0d/", wordB: "foot", ipaB: "/f\u028At/" },
    ],
  },
  {
    id: "sh-ch",
    phonemeA: "sh",
    phonemeB: "ch",
    label: "/\u0283/ vs /t\u0283/",
    pairs: [
      {
        wordA: "ship",
        ipaA: "/\u0283\u026Ap/",
        wordB: "chip",
        ipaB: "/t\u0283\u026Ap/",
      },
      {
        wordA: "wash",
        ipaA: "/w\u0252\u0283/",
        wordB: "watch",
        ipaB: "/w\u0252t\u0283/",
      },
      {
        wordA: "shoes",
        ipaA: "/\u0283u\u02D0z/",
        wordB: "choose",
        ipaB: "/t\u0283u\u02D0z/",
      },
      {
        wordA: "share",
        ipaA: "/\u0283e\u0259r/",
        wordB: "chair",
        ipaB: "/t\u0283e\u0259r/",
      },
      {
        wordA: "sheer",
        ipaA: "/\u0283\u026A\u0259r/",
        wordB: "cheer",
        ipaB: "/t\u0283\u026A\u0259r/",
      },
    ],
  },
  {
    id: "f-th",
    phonemeA: "f",
    phonemeB: "th",
    label: "/f/ vs /\u03B8/",
    pairs: [
      {
        wordA: "free",
        ipaA: "/fri\u02D0/",
        wordB: "three",
        ipaB: "/\u03B8ri\u02D0/",
      },
      {
        wordA: "first",
        ipaA: "/f\u025D\u02D0st/",
        wordB: "thirst",
        ipaB: "/\u03B8\u025D\u02D0st/",
      },
      { wordA: "deaf", ipaA: "/def/", wordB: "death", ipaB: "/de\u03B8/" },
      {
        wordA: "fin",
        ipaA: "/f\u026An/",
        wordB: "thin",
        ipaB: "/\u03B8\u026An/",
      },
      {
        wordA: "force",
        ipaA: "/f\u0254\u02D0rs/",
        wordB: "thought",
        ipaB: "/\u03B8\u0254\u02D0t/",
      },
    ],
  },
  {
    id: "z-dh",
    phonemeA: "z",
    phonemeB: "dh",
    label: "/z/ vs /\u00F0/",
    pairs: [
      { wordA: "zen", ipaA: "/zen/", wordB: "then", ipaB: "/\u00F0en/" },
      {
        wordA: "breeze",
        ipaA: "/bri\u02D0z/",
        wordB: "breathe",
        ipaB: "/bri\u02D0\u00F0/",
      },
      {
        wordA: "size",
        ipaA: "/sa\u026Az/",
        wordB: "scythe",
        ipaB: "/sa\u026A\u00F0/",
      },
      {
        wordA: "closing",
        ipaA: "/klo\u028Az\u026A\u014B/",
        wordB: "clothing",
        ipaB: "/klo\u028A\u00F0\u026A\u014B/",
      },
      {
        wordA: "tease",
        ipaA: "/ti\u02D0z/",
        wordB: "teethe",
        ipaB: "/ti\u02D0\u00F0/",
      },
    ],
  },
];
