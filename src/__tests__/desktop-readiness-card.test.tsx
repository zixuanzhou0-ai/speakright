import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopReadinessCard } from "@/components/drill/desktop-readiness-card";

vi.mock("@/lib/api-keys", () => ({
  getAzureConfig: () => ({ subscriptionKey: "", region: "eastus" }),
  subscribeToStorage: () => vi.fn(),
}));

function setMediaDevices(value: MediaDevices | undefined) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value,
  });
}

describe("DesktopReadinessCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    setMediaDevices(undefined);
    vi.clearAllMocks();
  });

  it("shows an actionable Chinese message when microphone checking is unsupported", async () => {
    setMediaDevices(undefined);

    render(<DesktopReadinessCard hasDiagnosis={false} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "检测麦克风" })).toBeDisabled();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Release EXE");
    expect(screen.getByRole("alert")).toHaveTextContent("Windows 麦克风权限");
  });

  it("shows an actionable Chinese message when microphone permission is denied", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError"),
    );
    setMediaDevices({ getUserMedia } as unknown as MediaDevices);

    render(<DesktopReadinessCard hasDiagnosis={false} />);

    fireEvent.click(screen.getByRole("button", { name: "检测麦克风" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Windows 隐私设置");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "允许 SpeakRight 使用麦克风",
    );
  });
});
