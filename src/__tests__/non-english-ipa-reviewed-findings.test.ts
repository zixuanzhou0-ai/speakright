import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildNonEnglishIpaAuditRows } from "@/lib/non-english-ipa-audit";

type Verdict = "ok" | "update" | "needs-review" | "variant-accepted";
type AuditRole = "ipa-transcription" | "deck-focus-hint";
type IpaType =
  | "phoneme"
  | "dictionary"
  | "training-realization"
  | "connected-speech"
  | "variant";
type ImplementationStatus =
  | "applied"
  | "accepted-current"
  | "confirmed-current"
  | "guarded-final-corpus"
  | "unchanged-needs-review";

interface ReviewedFinding {
  languageId: string;
  unitSlug: string;
  text: string;
  auditRole: AuditRole;
  verdict: Verdict;
  ipaType: IpaType;
  implementationStatus: ImplementationStatus;
  expectedCurrentIpa: string;
  forbiddenFinalIpa?: string[];
  blockedCandidateIpa?: string[];
  notes: string;
  sources: Array<{ name: string; url: string }>;
}

interface ReviewedFindingsFile {
  reviewedAt: string;
  purpose: string;
  policy: Record<string, string>;
  findings: ReviewedFinding[];
}

function loadReviewedFindings(): ReviewedFindingsFile {
  const path = resolve(
    process.cwd(),
    "docs",
    "operations",
    "non-english-ipa-reviewed-findings.json",
  );

  return JSON.parse(readFileSync(path, "utf8")) as ReviewedFindingsFile;
}

describe("non-English IPA reviewed findings ledger", () => {
  it("keeps high-risk IPA review decisions source-backed and actionable", () => {
    const reviewed = loadReviewedFindings();

    expect(reviewed.reviewedAt).toBe("2026-06-14");
    expect(reviewed.purpose).toContain("Machine-readable ledger");
    expect(reviewed.policy.spanish).toContain("phoneme-first");
    expect(reviewed.policy.french).toContain("connected-speech");
    expect(reviewed.policy.russian).toContain("needs-review");

    const identities = new Set<string>();

    for (const finding of reviewed.findings) {
      const identity = [
        finding.languageId,
        finding.unitSlug,
        finding.text,
        finding.auditRole,
      ].join("\u0000");

      expect(identities.has(identity), identity).toBe(false);
      identities.add(identity);
      expect(["ok", "update", "needs-review", "variant-accepted"]).toContain(
        finding.verdict,
      );
      expect(["ipa-transcription", "deck-focus-hint"]).toContain(
        finding.auditRole,
      );
      expect(
        [
          "phoneme",
          "dictionary",
          "training-realization",
          "connected-speech",
          "variant",
        ],
      ).toContain(finding.ipaType);
      expect(
        [
          "applied",
          "accepted-current",
          "confirmed-current",
          "guarded-final-corpus",
          "unchanged-needs-review",
        ],
      ).toContain(finding.implementationStatus);
      expect(finding.expectedCurrentIpa, identity).toMatch(/^\/.+\/$/);
      expect(finding.notes.trim(), identity).not.toBe("");
      expect(finding.sources.length, identity).toBeGreaterThanOrEqual(2);
      expect(
        new Set(finding.sources.map((source) => source.name)).size,
        identity,
      ).toBe(finding.sources.length);

      for (const source of finding.sources) {
        expect(source.name.trim(), identity).not.toBe("");
        expect(source.url, identity).toMatch(/^https:\/\//);
      }
    }
  });

  it("keeps verdicts and implementation statuses in a reviewable state machine", () => {
    const reviewed = loadReviewedFindings();

    for (const finding of reviewed.findings) {
      const label = `${finding.languageId}:${finding.unitSlug}:${finding.text}`;

      for (const forbidden of finding.forbiddenFinalIpa ?? []) {
        expect(forbidden, label).toMatch(/^\/.+\/$/);
      }

      for (const blocked of finding.blockedCandidateIpa ?? []) {
        expect(blocked, label).toMatch(/^\/.+\/$/);
      }

      switch (finding.verdict) {
        case "ok":
          expect(finding.implementationStatus, label).toBe("confirmed-current");
          break;
        case "update":
          expect(["applied", "guarded-final-corpus"], label).toContain(
            finding.implementationStatus,
          );
          expect(finding.forbiddenFinalIpa?.length ?? 0, label).toBeGreaterThan(0);
          break;
        case "variant-accepted":
          expect(finding.implementationStatus, label).toBe("accepted-current");
          expect(finding.ipaType, label).toBe("variant");
          break;
        case "needs-review":
          expect(finding.implementationStatus, label).toBe("unchanged-needs-review");
          expect(finding.blockedCandidateIpa?.length ?? 0, label).toBeGreaterThan(
            0,
          );
          break;
      }
    }
  });

  it("keeps applied update and accepted-variant rows aligned with the final UI audit corpus", () => {
    const rows = buildNonEnglishIpaAuditRows();
    const reviewed = loadReviewedFindings();
    const verifiedStatuses: ImplementationStatus[] = [
      "applied",
      "accepted-current",
      "confirmed-current",
      "guarded-final-corpus",
    ];

    for (const finding of reviewed.findings.filter((item) =>
      verifiedStatuses.includes(item.implementationStatus),
    )) {
      const matches = rows.filter(
        (row) =>
          row.languageId === finding.languageId &&
          row.unitSlug === finding.unitSlug &&
          row.text === finding.text &&
          row.auditRole === finding.auditRole,
      );
      const currentIpaValues = matches.map((row) => row.currentIpa);
      const label = `${finding.languageId}:${finding.unitSlug}:${finding.text}`;

      expect(currentIpaValues, label).toContain(finding.expectedCurrentIpa);

      for (const forbidden of finding.forbiddenFinalIpa ?? []) {
        expect(currentIpaValues, label).not.toContain(forbidden);
      }
    }
  });

  it("keeps needs-review IPA rows unchanged until stronger evidence is recorded", () => {
    const rows = buildNonEnglishIpaAuditRows();
    const reviewed = loadReviewedFindings();
    const needsReviewFindings = reviewed.findings.filter(
      (finding) => finding.implementationStatus === "unchanged-needs-review",
    );

    expect(needsReviewFindings.length).toBeGreaterThan(0);

    for (const finding of needsReviewFindings) {
      const matches = rows.filter(
        (row) =>
          row.languageId === finding.languageId &&
          row.unitSlug === finding.unitSlug &&
          row.text === finding.text &&
          row.auditRole === finding.auditRole,
      );
      const currentIpaValues = matches.map((row) => row.currentIpa);
      const label = `${finding.languageId}:${finding.unitSlug}:${finding.text}`;

      expect(currentIpaValues, label).toContain(finding.expectedCurrentIpa);

      for (const blocked of finding.blockedCandidateIpa ?? []) {
        expect(currentIpaValues, label).not.toContain(blocked);
      }
    }
  });
});
