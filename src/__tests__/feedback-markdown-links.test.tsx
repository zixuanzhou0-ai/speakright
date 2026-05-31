import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackDisplay } from "@/components/feedback/feedback-display";
import { LlmFeedback } from "@/components/scoring/llm-feedback";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  writeText: vi.fn(async () => {}),
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: () => true,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

describe("feedback markdown links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("copies LLM markdown links instead of navigating the desktop WebView", async () => {
    render(
      <LlmFeedback
        feedback="参考 [练习资料](https://example.com/practice) 后再录一次。"
        isStreaming={false}
      />,
    );

    const link = screen.getByRole("link", { name: "练习资料" });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(
        "https://example.com/practice",
      );
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "已复制 AI 反馈链接，请在浏览器中打开",
    );
  });

  it("uses the same desktop-safe link handling in structured feedback", async () => {
    render(
      <FeedbackDisplay
        feedback={{
          summary: "这次只改一个动作。",
          topIssues: "",
          practiceNow: "看 [动作提示](https://example.com/cue) 再练。",
          priorityFixes: "",
          dimensions: "",
          details: "",
        }}
        isStreaming={false}
      />,
    );

    const link = screen.getByRole("link", { name: "动作提示" });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith("https://example.com/cue");
    });
  });

  it("renders non-https markdown hrefs as text", () => {
    render(
      <LlmFeedback
        feedback="不要打开 [脚本链接](javascript:alert(1)) 或 [明文链接](http://example.com)。"
        isStreaming={false}
      />,
    );

    expect(screen.getByText("脚本链接")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "脚本链接" })).toBeNull();
    expect(screen.getByText("明文链接")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "明文链接" })).toBeNull();
  });

  it("renders markdown images as alt text instead of loading image sources", () => {
    render(
      <LlmFeedback
        feedback="这里不应该加载图片：![动作示意](https://example.com/cue.png)"
        isStreaming={false}
      />,
    );

    expect(screen.getByText("动作示意")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
