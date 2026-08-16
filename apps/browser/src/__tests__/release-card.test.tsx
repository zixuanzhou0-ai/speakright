import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReleaseCard } from "@/components/settings/release-card";
import { BROWSER_RELEASE_INFO } from "@/lib/release-info";

describe("Browser ReleaseCard", () => {
  it("exposes release, governance, privacy, and license destinations", () => {
    render(<ReleaseCard />);

    const expectedLinks = [
      ["源码仓库", BROWSER_RELEASE_INFO.repositoryUrl],
      ["Release 说明", BROWSER_RELEASE_INFO.releaseUrl],
      ["问题反馈", BROWSER_RELEASE_INFO.issuesUrl],
      ["隐私说明", BROWSER_RELEASE_INFO.privacyUrl],
      ["开源许可证", BROWSER_RELEASE_INFO.licenseUrl],
    ] as const;

    for (const [name, href] of expectedLinks) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveClass("whitespace-normal");
    }
  });
});
