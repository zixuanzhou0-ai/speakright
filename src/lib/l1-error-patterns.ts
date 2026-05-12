/**
 * L1 (Mandarin Chinese) interference error patterns for English pronunciation.
 * Maps target phonemes to common substitution errors and articulatory tips.
 */

export interface L1ErrorPattern {
  targetPhoneme: string;
  targetIpa: string;
  commonSubstitution: string;
  substitutionIpa: string;
  frequency: "high" | "medium";
  articulatoryTip: string;
  contrastDrill: string;
}

export const L1_ERROR_PATTERNS: L1ErrorPattern[] = [
  {
    targetPhoneme: "th",
    targetIpa: "/\u03B8/",
    commonSubstitution: "s",
    substitutionIpa: "/s/",
    frequency: "high",
    articulatoryTip:
      "\u820C\u5C16\u8981\u4F38\u51FA\u6765\u653E\u5728\u4E0A\u4E0B\u9F7F\u4E4B\u95F4\uFF0C\u6C14\u6D41\u4ECE\u820C\u5C16\u548C\u7259\u9F7F\u7684\u7F1D\u9699\u4E2D\u6324\u51FA\uFF0C\u4E0D\u8981\u7F29\u56DE\u53BB",
    contrastDrill: "think vs sink, math vs mass, path vs pass",
  },
  {
    targetPhoneme: "dh",
    targetIpa: "/\u00F0/",
    commonSubstitution: "z/d",
    substitutionIpa: "/z/ or /d/",
    frequency: "high",
    articulatoryTip:
      "\u548C /\u03B8/ \u4E00\u6837\u820C\u5C16\u4F38\u51FA\u54AC\u9F7F\uFF0C\u4F46\u58F0\u5E26\u8981\u632F\u52A8\uFF08\u6709\u58F0\uFF09",
    contrastDrill: "then vs zen, breathe vs breeze",
  },
  {
    targetPhoneme: "v",
    targetIpa: "/v/",
    commonSubstitution: "w",
    substitutionIpa: "/w/",
    frequency: "high",
    articulatoryTip:
      "\u4E0A\u9F7F\u8981\u8F7B\u8F7B\u54AC\u4F4F\u4E0B\u5507\uFF0C\u4E0D\u662F\u53CC\u5507\u5408\u62E2",
    contrastDrill: "vest vs west, vine vs wine, veil vs whale",
  },
  {
    targetPhoneme: "r",
    targetIpa: "/r/",
    commonSubstitution: "l",
    substitutionIpa: "/l/",
    frequency: "high",
    articulatoryTip:
      "\u820C\u5C16\u5377\u8D77\u6307\u5411\u786C\u816D\u4F46\u4E0D\u89E6\u78B0\u4EFB\u4F55\u90E8\u4F4D\uFF0C\u4E0D\u662F\u820C\u5C16\u62B5\u4F4F\u9F7F\u9F88",
    contrastDrill: "right vs light, grass vs glass, fry vs fly",
  },
  {
    targetPhoneme: "l",
    targetIpa: "/l/ (dark L)",
    commonSubstitution: "o/u",
    substitutionIpa: "\u7701\u7565",
    frequency: "high",
    articulatoryTip:
      "\u8BCD\u5C3E\u7684 L \u820C\u5C16\u5FC5\u987B\u62B5\u4F4F\u4E0A\u9F7F\u9F88\uFF0C\u4E0D\u80FD\u7701\u7565\u53D8\u6210\u5143\u97F3",
    contrastDrill: "feel vs fee, full vs foo, bell vs bay",
  },
  {
    targetPhoneme: "ae",
    targetIpa: "/\u00E6/",
    commonSubstitution: "eh",
    substitutionIpa: "/e/",
    frequency: "high",
    articulatoryTip:
      "\u5634\u5DF4\u8981\u5F20\u5F97\u66F4\u5927\uFF0C\u4E0B\u5DF4\u5411\u4E0B\u62C9\uFF0C\u820C\u524D\u90E8\u62AC\u9AD8",
    contrastDrill: "bad vs bed, man vs men, sat vs set",
  },
  {
    targetPhoneme: "ih",
    targetIpa: "/\u026A/",
    commonSubstitution: "ee",
    substitutionIpa: "/i\u02D0/",
    frequency: "high",
    articulatoryTip:
      "\u6BD4 /i\u02D0/ \u77ED\u4FC3\u6709\u529B\uFF0C\u5634\u5DF4\u5FAE\u5F20\uFF0C\u4E0D\u8981\u62C9\u957F",
    contrastDrill: "ship vs sheep, sit vs seat, fit vs feet",
  },
  {
    targetPhoneme: "uh",
    targetIpa: "/\u028A/",
    commonSubstitution: "oo",
    substitutionIpa: "/u\u02D0/",
    frequency: "medium",
    articulatoryTip:
      "\u6BD4 /u\u02D0/ \u77ED\u4FC3\uFF0C\u5634\u5507\u4E0D\u8981\u7A81\u51FA\u90A3\u4E48\u591A",
    contrastDrill: "pull vs pool, full vs fool, look vs Luke",
  },
  {
    targetPhoneme: "ng",
    targetIpa: "/\u014B/",
    commonSubstitution: "n",
    substitutionIpa: "/n/",
    frequency: "medium",
    articulatoryTip:
      "\u820C\u6839\u62B5\u4F4F\u8F6F\u816D\uFF08\u540E\u9F3B\u97F3\uFF09\uFF0C\u4E0D\u662F\u820C\u5C16\u62B5\u4F4F\u9F7F\u9F88\uFF08\u524D\u9F3B\u97F3\uFF09",
    contrastDrill: "sing vs sin, ring vs rin, bang vs ban",
  },
  {
    targetPhoneme: "n",
    targetIpa: "/n/",
    commonSubstitution: "l",
    substitutionIpa: "/l/",
    frequency: "medium",
    articulatoryTip:
      "\u6C14\u6D41\u4ECE\u9F3B\u5B54\u51FA\uFF08\u9F3B\u97F3\uFF09\uFF0C\u4E0D\u662F\u4ECE\u820C\u5934\u4E24\u4FA7\u51FA\uFF08\u4FA7\u97F3\uFF09\u3002\u5357\u65B9\u65B9\u8A00\u91CD\u707E\u533A",
    contrastDrill: "night vs light, no vs low, nine vs line",
  },
  {
    targetPhoneme: "z",
    targetIpa: "/z/",
    commonSubstitution: "s",
    substitutionIpa: "/s/",
    frequency: "medium",
    articulatoryTip:
      "\u548C /s/ \u820C\u4F4D\u76F8\u540C\uFF0C\u4F46\u58F0\u5E26\u8981\u632F\u52A8\uFF08\u6709\u58F0\uFF09",
    contrastDrill: "zoo vs sue, zip vs sip, buzz vs bus",
  },
  {
    targetPhoneme: "dj",
    targetIpa: "/d\u0292/",
    commonSubstitution: "zh/z",
    substitutionIpa: "/\u0292/ or /z/",
    frequency: "medium",
    articulatoryTip:
      "\u820C\u5C16\u62B5\u4F4F\u4E0A\u9F7F\u9F88\u7136\u540E\u5F39\u5F00\uFF0C\u7C7B\u4F3C\u4E2D\u6587\u201C\u77E5\u201D\u4F46\u58F0\u5E26\u632F\u52A8",
    contrastDrill: "joke vs choke, gin vs chin",
  },
];

/**
 * Match Azure phoneme errors against L1 patterns.
 * Returns matching patterns for phonemes with AccuracyScore below threshold.
 */
export function matchL1Errors(
  phonemes: Array<{ phoneme: string; accuracyScore: number }>,
  threshold = 60,
): L1ErrorPattern[] {
  const matched: L1ErrorPattern[] = [];
  const seen = new Set<string>();

  for (const ph of phonemes) {
    if (ph.accuracyScore >= threshold) continue;
    const pattern = L1_ERROR_PATTERNS.find(
      (p) => p.targetPhoneme === ph.phoneme,
    );
    if (pattern && !seen.has(pattern.targetPhoneme)) {
      seen.add(pattern.targetPhoneme);
      matched.push(pattern);
    }
  }

  return matched;
}

/**
 * Build L1 error context string for LLM prompt injection.
 */
export function buildL1ErrorContext(patterns: L1ErrorPattern[]): string {
  if (patterns.length === 0) return "";

  const lines = patterns.map(
    (p) =>
      `- ${p.targetIpa} \u2192 \u5E38\u88AB\u8BFB\u6210 ${p.substitutionIpa}\uFF1A${p.articulatoryTip}\uFF08\u5BF9\u6BD4\u7EC3\u4E60\uFF1A${p.contrastDrill}\uFF09`,
  );

  return `\n\n## \u68C0\u6D4B\u5230\u7684\u6BCD\u8BED\u8FC1\u79FB\u9519\u8BEF\uFF08\u4E2D\u56FD\u5B66\u4E60\u8005\u5178\u578B\u95EE\u9898\uFF09\n${lines.join("\n")}\n\u8BF7\u5728\u53CD\u9988\u4E2D\u91CD\u70B9\u5F3A\u8C03\u8FD9\u4E9B\u6BCD\u8BED\u8FC1\u79FB\u9519\u8BEF\uFF0C\u5E76\u7ED9\u51FA\u5177\u4F53\u7684\u53D1\u97F3\u5668\u5B98\u8C03\u6574\u5EFA\u8BAE\u3002`;
}
