import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrainingEvidencePage from "@/app/drill/evidence/page";
import type {
  EvidenceCard,
  PatternEvidence,
  RemediationEvidence,
  TrainingEvidenceBook,
} from "@/lib/training-evidence";
import type { MasteryProfile } from "@/types/training";

const mocks = vi.hoisted(() => ({
  languageId: "en-US",
  loadMasteryProfile: vi.fn<() => MasteryProfile | null>(() => null),
  getMasteryProfileStorageWarning: vi.fn<() => string | null>(() => null),
  buildTrainingEvidenceBook: vi.fn<() => TrainingEvidenceBook>(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: mocks.languageId }),
}));

vi.mock("@/lib/mastery-profile", () => ({
  getMasteryProfileStorageWarning: mocks.getMasteryProfileStorageWarning,
  loadMasteryProfile: mocks.loadMasteryProfile,
}));

vi.mock("@/lib/training-evidence", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/training-evidence")>();
  return {
    ...actual,
    buildTrainingEvidenceBook: mocks.buildTrainingEvidenceBook,
  };
});

function evidenceCard(index: number): EvidenceCard {
  return {
    id: `card-${index}`,
    packId: "s-th",
    packTitle: "把 think 读出 /θ/",
    levelId: "word-ladder",
    levelTitle: "单词控制",
    text: `evidence target ${index}`,
    targetPhonemes: ["th"],
    patternIds: ["tongue-between-teeth"],
    patternTitles: ["舌尖没有到齿间"],
    attempts: index,
    worstTargetScore: 50,
    bestTargetScore: 72,
    latestTargetScore: 60 + index,
    latestOverallScore: 80,
    scoreGap: 18,
    firstSeenAt: 1_718_000_000_000,
    lastSeenAt: 1_718_000_000_000 + index,
    nextCue: `第 ${index} 条证据的下一次只改提示需要完整显示`,
    severity: index % 2 === 0 ? "major" : "critical",
  };
}

function patternEvidence(index: number): PatternEvidence {
  return {
    patternId: `pattern-${index}`,
    title: `pattern title ${index}`,
    packId: "s-th",
    packTitle: "把 think 读出 /θ/",
    levelId: "articulation",
    seenCount: index,
    stuckCount: index - 1,
    failedItemCount: index,
    lastSeenAt: 1_718_000_000_000 + index,
    cue: `pattern cue ${index}`,
    explanation: `pattern explanation ${index}`,
    severity: index % 2 === 0 ? "major" : "critical",
  };
}

function remediationEvidence(index: number): RemediationEvidence {
  return {
    id: `remediation-${index}`,
    packId: "s-th",
    packTitle: "把 think 读出 /θ/",
    pathId: `path-${index}`,
    text: `remediation text ${index}`,
    attempts: index,
    passedCount: index - 1,
    failedCount: 1,
    bestImprovement: index,
    latestTargetScore: 70 + index,
    latestPassed: index % 2 === 0,
    lastSeenAt: 1_718_000_000_000 + index,
  };
}

function evidenceBook(): TrainingEvidenceBook {
  return {
    generatedAt: 1_718_000_000_000,
    totalSessions: 9,
    totalEvidence: 9,
    criticalCount: 5,
    activePatternCount: 7,
    remediationFailedCount: 7,
    dueReviewCount: 0,
    cards: Array.from({ length: 9 }, (_, index) => evidenceCard(index + 1)),
    patterns: Array.from({ length: 7 }, (_, index) =>
      patternEvidence(index + 1),
    ),
    remediations: Array.from({ length: 7 }, (_, index) =>
      remediationEvidence(index + 1),
    ),
    reviewQueue: [],
  };
}

describe("TrainingEvidencePage evidence visibility", () => {
  beforeEach(() => {
    mocks.languageId = "en-US";
    mocks.loadMasteryProfile.mockReset().mockReturnValue(null);
    mocks.getMasteryProfileStorageWarning.mockReset().mockReturnValue(null);
    mocks.buildTrainingEvidenceBook.mockReset().mockReturnValue(evidenceBook());
  });

  it("renders every generated evidence, pattern, and remediation row", () => {
    render(<TrainingEvidencePage />);

    expect(document.querySelectorAll('[data-smoke="evidence-card-row"]')).toHaveLength(
      9,
    );
    expect(
      document.querySelectorAll('[data-smoke="evidence-pattern-row"]'),
    ).toHaveLength(7);
    expect(
      document.querySelectorAll('[data-smoke="evidence-remediation-row"]'),
    ).toHaveLength(7);
    expect(screen.getByText("evidence target 9")).toBeInTheDocument();
    expect(screen.getByText("pattern title 7")).toBeInTheDocument();
    expect(screen.getByText("remediation text 7")).toBeInTheDocument();
  });
});
