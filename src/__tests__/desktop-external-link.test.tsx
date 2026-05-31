import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isTauri: true,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  writeText: vi.fn(async () => {}),
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: () => mocks.isTauri,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

describe("DesktopExternalLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauri = true;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: mocks.writeText,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("copies external links instead of navigating inside the Tauri WebView", async () => {
    const { DesktopExternalLink } = await import(
      "@/components/common/desktop-external-link"
    );

    render(
      <DesktopExternalLink href="https://dictionaryapi.com/register/index">
        dictionaryapi.com
      </DesktopExternalLink>,
    );

    const link = screen.getByRole("link", { name: "dictionaryapi.com" });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(event);

    expect(link).toHaveAttribute(
      "href",
      "https://dictionaryapi.com/register/index",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(
        "https://dictionaryapi.com/register/index",
      );
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "已复制链接，请在浏览器中打开",
    );
  });

  it("leaves normal browser links untouched outside Tauri", async () => {
    mocks.isTauri = false;
    const { DesktopExternalLink } = await import(
      "@/components/common/desktop-external-link"
    );

    render(
      <DesktopExternalLink href="https://dictionaryapi.com/register/index">
        dictionaryapi.com
      </DesktopExternalLink>,
    );

    const link = screen.getByRole("link", { name: "dictionaryapi.com" });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(mocks.writeText).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("keeps the desktop window on the app when clipboard copy fails", async () => {
    mocks.writeText.mockRejectedValueOnce(new Error("clipboard denied"));
    const { DesktopExternalLink } = await import(
      "@/components/common/desktop-external-link"
    );

    render(
      <DesktopExternalLink href="https://dictionaryapi.com/register/index">
        dictionaryapi.com
      </DesktopExternalLink>,
    );

    const link = screen.getByRole("link", { name: "dictionaryapi.com" });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "请手动打开：https://dictionaryapi.com/register/index",
      );
    });
  });

  it("keeps release card download links inside the desktop app", async () => {
    const { ReleaseCard } = await import("@/components/settings/release-card");
    const { DESKTOP_RELEASE_INFO } = await import("@/lib/release-info");

    render(<ReleaseCard />);

    const downloadLink = screen.getAllByRole("link", { name: /下载/ })[0];
    const downloadEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    downloadLink.dispatchEvent(downloadEvent);

    expect(downloadLink).toHaveAttribute("target", "_blank");
    expect(downloadLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(downloadEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(
        DESKTOP_RELEASE_INFO.installers[0].downloadUrl,
      );
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Windows 安装程序下载链接已复制，请在浏览器中打开",
    );

    const releaseLink = screen.getByRole("link", { name: /当前 Release/ });
    const releaseEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    releaseLink.dispatchEvent(releaseEvent);

    expect(releaseEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(
        DESKTOP_RELEASE_INFO.releaseUrl,
      );
    });
  });
});
