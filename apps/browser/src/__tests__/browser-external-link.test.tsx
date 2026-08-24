import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserExternalLink } from "@/components/common/browser-external-link";

describe("BrowserExternalLink", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens external links in a new tab", () => {
    render(
      <BrowserExternalLink href="https://example.com/docs">
        example.com
      </BrowserExternalLink>,
    );

    const link = screen.getByRole("link", { name: "example.com" });
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("consumes copyMessage instead of forwarding it to the DOM", () => {
    render(
      <BrowserExternalLink
        href="https://example.com/docs"
        copyMessage="Link copied"
      >
        example.com
      </BrowserExternalLink>,
    );

    const link = screen.getByRole("link", { name: "example.com" });
    expect(link).not.toHaveAttribute("copyMessage");
    expect(link).not.toHaveAttribute("copymessage");
  });
});
