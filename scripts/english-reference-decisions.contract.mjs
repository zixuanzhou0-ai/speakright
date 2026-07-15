#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildEnglishReferenceDecisionPlan,
  countIndependentReferenceGroups,
  isPlausibleEnglishIpaToken,
} from "./lib/english-reference-decision-core.mjs";

let assertions = 0;
function check(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function fixture({
  canonicalIpa = "ʃɪp",
  targetUnits = ["/ʃ/"],
  relationshipIssues = [],
  thirdReason = "unresolved-reference",
  cmu = ["SH IH1 P"],
  kaikkiIpas = ["/ʃɪp/"],
  kaikkiGroup = "wiktionary",
} = {}) {
  const sourceAsset = {
    sourceAssetId: "asset-1",
    languageId: "en-US",
    text: "ship",
    canonicalIpa,
    targetUnits,
    phonemePageIds: ["sh"],
    relationshipIssues,
  };
  return {
    basePlan: { sourceAssets: [sourceAsset] },
    thirdPlan: {
      blockedCount: 1,
      blocked: [{ sourceAssetId: "asset-1", reason: thirdReason }],
    },
    kaikkiObservations: {
      entries: [
        {
          languageId: "en-US",
          text: "ship",
          status: "structured-ipa-observed",
          ipas: kaikkiIpas,
          htmlSha256: "a".repeat(64),
          source: {
            name: "Kaikki.org structured Wiktionary extract",
            sourceUrl:
              "https://kaikki.org/dictionary/English/meaning/s/sh/ship.html",
            independenceGroup: kaikkiGroup,
            dumpDate: "2026-07-06",
          },
        },
      ],
    },
    cmuReference: {
      entries: new Map([["ship", cmu]]),
      revision: "cmu-revision",
      sha256: "b".repeat(64),
    },
  };
}

const exact = buildEnglishReferenceDecisionPlan(fixture());
check(exact.confirmedAssetCount, 1, "exact reference should confirm the asset");
check(exact.confirmedWordCount, 1, "exact reference should confirm the word");
check(exact.blockedWordCount, 0, "exact reference should not be blocked");
check(
  exact.decisions[0].status,
  "two-source-confirmed",
  "confirmed decision must use the formal status",
);
check(
  countIndependentReferenceGroups(exact.decisions[0].sources),
  2,
  "CMUdict and Kaikki/Wiktionary must be two independent groups",
);
check(
  exact.decisions[0].sources.map((source) => source.independenceGroup),
  ["cmudict", "wiktionary"],
  "source independence must remain explicit",
);

check(
  countIndependentReferenceGroups([
    { name: "Wiktionary", independenceGroup: "wiktionary" },
    { name: "Kaikki", independenceGroup: "wiktionary" },
  ]),
  1,
  "Kaikki and Wiktionary must never count as independent sources",
);
check(isPlausibleEnglishIpaToken("/ten/"), true, "ASCII IPA may be valid");
check(
  isPlausibleEnglishIpaToken("[General-American]"),
  false,
  "accent labels must not be treated as IPA",
);
check(
  isPlausibleEnglishIpaToken("[Scotland]"),
  false,
  "single-word accent labels must not be treated as IPA",
);
check(
  isPlausibleEnglishIpaToken("[tʰɛn]"),
  true,
  "phonetic bracket notation should remain eligible",
);

const noKaikki = buildEnglishReferenceDecisionPlan(
  fixture({ kaikkiIpas: ["/ʃiːp/"] }),
);
check(
  noKaikki.confirmedWordCount,
  0,
  "Kaikki conflict must block confirmation",
);
check(
  noKaikki.blocked[0].blockers.includes("project-ipa-not-confirmed-by-kaikki"),
  true,
  "Kaikki mismatch must be traceable",
);

const cmuAlternateOnly = buildEnglishReferenceDecisionPlan(
  fixture({
    canonicalIpa: "θɜrdi",
    cmu: ["TH ER1 T IY2"],
    kaikkiIpas: ["/θɝti/"],
  }),
);
check(
  cmuAlternateOnly.confirmedWordCount,
  0,
  "a different two-source variant must not replace the project canonical by guesswork",
);
check(
  cmuAlternateOnly.blocked[0].blockers.includes(
    "project-ipa-not-confirmed-by-cmudict",
  ),
  true,
  "project/CMU conflict must remain blocked",
);

const missingTarget = buildEnglishReferenceDecisionPlan(
  fixture({ targetUnits: ["/θ/"] }),
);
check(
  missingTarget.confirmedWordCount,
  0,
  "missing page target must block confirmation",
);
check(
  missingTarget.blocked[0].blockers,
  ["target-not-in-canonical:/θ/"],
  "target relationship blocker must be exact",
);

const relationshipIssue = buildEnglishReferenceDecisionPlan(
  fixture({ relationshipIssues: ["target-not-in-current-ipa:/ʃ/"] }),
);
check(
  relationshipIssue.confirmedWordCount,
  0,
  "existing relationship issues must block confirmation",
);
check(
  relationshipIssue.blocked[0].blockers.includes("relationship-issues-present"),
  true,
  "relationship blocker must be traceable",
);

const wrongIndependence = buildEnglishReferenceDecisionPlan(
  fixture({ kaikkiGroup: "cmudict" }),
);
check(
  wrongIndependence.confirmedWordCount,
  0,
  "a mislabeled Kaikki independence group must block confirmation",
);
check(
  wrongIndependence.blocked[0].blockers.includes(
    "invalid-kaikki-independence-group",
  ),
  true,
  "independence-group blocker must be traceable",
);

const nonReferenceBlocker = buildEnglishReferenceDecisionPlan(
  fixture({ thirdReason: "relationship-issues" }),
);
check(
  nonReferenceBlocker.confirmedWordCount,
  0,
  "the decision tool cannot bypass another third-round blocker",
);

const deterministicA = buildEnglishReferenceDecisionPlan(fixture());
const deterministicB = buildEnglishReferenceDecisionPlan(fixture());
check(
  deterministicA.planSha256,
  deterministicB.planSha256,
  "the plan digest must be deterministic",
);
check(deterministicA.networkRequestsMade, 0, "the tool must remain offline");
check(deterministicA.paidCallsMade, 0, "the tool must never make paid calls");

console.log(
  `English reference decision contract passed (${assertions} assertions).`,
);
