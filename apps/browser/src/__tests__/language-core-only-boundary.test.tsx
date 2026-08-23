import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageCoreOnlyBoundary } from "@/components/common/language-core-only-boundary";

const languageMock = vi.hoisted(() => ({
  languageId: "fr-FR" as "en-US" | "es-ES" | "fr-FR" | "ru-RU",
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: languageMock.languageId }),
}));

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("LanguageCoreOnlyBoundary", () => {
  it("shows only core public actions for non-English hidden modules", () => {
    languageMock.languageId = "ru-RU";

    render(
      <LanguageCoreOnlyBoundary moduleName="发音诊断">
        <div>hidden assessment body</div>
      </LanguageCoreOnlyBoundary>,
    );

    expect(screen.getByText(/俄语公开版先聚焦核心练习/)).toBeInTheDocument();
    expect(screen.getByText("去音标练习")).toBeInTheDocument();
    expect(screen.getByText("去自由练习")).toBeInTheDocument();
    expect(
      screen.queryByText("hidden assessment body"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/暂不展示未完成训练、诊断或 mastery 证据/),
    ).toBeInTheDocument();
  });

  it("allows non-English routes declared as Labs by the central policy", () => {
    languageMock.languageId = "es-ES";

    render(
      <LanguageCoreOnlyBoundary
        moduleName="发音诊断"
        capabilityRoute="diagnosis"
      >
        <div>spanish labs body</div>
      </LanguageCoreOnlyBoundary>,
    );

    expect(screen.getByText("spanish labs body")).toBeInTheDocument();
    expect(screen.queryByText("去音标练习")).not.toBeInTheDocument();
  });
  it("does not wrap English completed modules", () => {
    languageMock.languageId = "en-US";

    render(
      <LanguageCoreOnlyBoundary moduleName="刻意练习">
        <div>english drill body</div>
      </LanguageCoreOnlyBoundary>,
    );

    expect(screen.getByText("english drill body")).toBeInTheDocument();
    expect(screen.queryByText("去音标练习")).not.toBeInTheDocument();
  });

  it("wires Labs routes through policy-aware layouts and keeps formal progress isolated", () => {
    expect(readProjectFile("src/app/drill/layout.tsx")).toContain(
      "LanguageCoreOnlyBoundary",
    );
    expect(readProjectFile("src/app/assessment/layout.tsx")).toContain(
      "LanguageCoreOnlyBoundary",
    );
    const progressPage = readProjectFile("src/app/progress/page.tsx");
    expect(progressPage).toContain(
      'data-smoke="progress-experimental-blocker"',
    );
    expect(progressPage).not.toContain("LanguageCoreOnlyBoundary");
  });
});
