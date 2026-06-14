import { describe, expect, it } from "vitest";
import {
  buildLanguageFeedbackPromptContext,
  getLanguageFeedbackRules,
  matchLanguageFeedbackRules,
} from "@/lib/language-feedback-rules";

describe("language feedback rules", () => {
  it("defines Spanish guidance for vowels, r/rr, approximants, dialect, x, ny, and stress", () => {
    const ruleIds = getLanguageFeedbackRules("es-ES").map((rule) => rule.id);

    expect(ruleIds).toEqual(
      expect.arrayContaining([
        "spanish-vowel-diphthongization",
        "spanish-r-tap-trill-confusion",
        "spanish-bv-english-v",
        "spanish-approximant-too-hard",
        "spanish-theta-s-dialect",
        "spanish-x-too-weak",
        "spanish-ny-split",
        "spanish-stress-error",
      ]),
    );
    expect(
      matchLanguageFeedbackRules("es-ES", ["es-theta"])[0]?.rule.guidance,
    ).toMatch(/seseo|Castilian/);
  });

  it("defines French guidance for front rounded vowels, nasal vowels, r, and phrase rules", () => {
    const matches = matchLanguageFeedbackRules("fr-FR", [
      "fr-y",
      "fr-an",
      "fr-r",
      "fr-final-consonant-silence",
      "fr-liaison",
      "fr-elision",
    ]);
    const ids = matches.map((match) => match.rule.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "french-front-rounded-vowel-collapse",
        "french-nasal-vowel-with-n-tail",
        "french-uvular-r-replaced",
        "french-final-consonant-silence",
        "french-liaison-enchainement-elision",
      ]),
    );
    expect(buildLanguageFeedbackPromptContext("fr-FR")).toContain("nasal");
  });

  it("defines Russian guidance for stress, reduction, palatalization, devoicing, assimilation, clusters, and sh/ch/shch", () => {
    const matches = matchLanguageFeedbackRules("ru-RU", [
      "ru-stress-reduction",
      "ru-y",
      "ru-soft-t-d",
      "ru-final-devoicing",
      "ru-voicing-assimilation",
      "ru-clusters",
      "ru-shch",
    ]);
    const ids = matches.map((match) => match.rule.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "russian-missing-stress-or-reduction",
        "russian-i-vs-y-collapse",
        "russian-palatalization-missing",
        "russian-final-devoicing",
        "russian-voicing-assimilation",
        "russian-cluster-epenthesis",
        "russian-sh-zh-ch-shch-confusion",
      ]),
    );
    expect(buildLanguageFeedbackPromptContext("ru-RU")).toMatch(
      /重音|soft|clusters/,
    );

    const finalDevoicing = matches.find(
      (match) => match.rule.id === "russian-final-devoicing",
    )?.rule;
    expect(finalDevoicing?.guidance).toContain("停顿或清辅音前");
    expect(finalDevoicing?.guidance).toContain("浊辅音、响音或元音前");
    expect(finalDevoicing?.guidance).not.toContain("词尾有声辅音要清化");
    expect(finalDevoicing?.practiceCue).toContain("друг дома");
    expect(finalDevoicing?.practiceCue).toContain("снег идёт");
  });

  it("does not inject non-English rules into English feedback", () => {
    expect(matchLanguageFeedbackRules("en-US", ["th"])).toEqual([]);
    expect(buildLanguageFeedbackPromptContext("en-US")).toBe("");
  });
});
