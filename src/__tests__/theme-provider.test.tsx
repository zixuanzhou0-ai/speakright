import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/components/layout/theme-provider";

function ThemeProbe() {
  const { resolvedTheme, setTheme, theme } = useTheme();

  return (
    <div>
      <p data-testid="theme">{theme}</p>
      <p data-testid="resolved-theme">{resolvedTheme}</p>
      <button onClick={() => setTheme("dark")} type="button">
        Use dark theme
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark", "light");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove("dark", "light");
  });

  it("falls back to system when theme storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("updates the live theme even when theme storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use dark theme" }));

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
