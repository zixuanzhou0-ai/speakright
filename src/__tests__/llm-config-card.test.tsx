import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmConfigCard } from "@/components/settings/llm-config-card";

const mocks = vi.hoisted(() => ({
  isTauriEnvironment: vi.fn(() => true),
  setLlmConfig: vi.fn(),
  testLlm: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLlmConfig: () => null,
}));

vi.mock("@/lib/api-client", () => ({
  testLlm: mocks.testLlm,
}));

vi.mock("@/lib/api-keys", () => ({
  setLlmConfig: mocks.setLlmConfig,
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: mocks.isTauriEnvironment,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

describe("LlmConfigCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauriEnvironment.mockReturnValue(true);
  });

  it("renders current stable provider and model chips", async () => {
    render(<LlmConfigCard />);

    await waitFor(() => {
      expect(screen.getByText("GPT")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "GPT" }));

    expect(screen.getByRole("button", { name: "gpt-5.5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "gpt-5.4" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "gpt-5.4-mini" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("o3-mini")).not.toBeInTheDocument();
  });

  it("lets unverifiable MiniMax and MiMo providers collect manual config safely", async () => {
    render(<LlmConfigCard />);

    await waitFor(() => {
      expect(screen.getByText("MiniMax")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "MiniMax" }));

    expect(screen.getByText(/MiniMax 需要以官方 API 文档填写/)).toBeInTheDocument();
    expect(screen.getByText(/桌面版不会放开任意 LLM 域名/)).toBeInTheDocument();
    expect(screen.getByLabelText("Base URL")).toBeEnabled();
    expect(screen.getByLabelText("Model")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Xiaomi MiMo" }));

    expect(
      screen.getByText(/Xiaomi MiMo 需要以官方 API 文档填写/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Base URL")).toBeEnabled();
  });

  it("keeps long provider and model chips wrap-ready instead of truncated", async () => {
    render(<LlmConfigCard />);

    await waitFor(() => {
      expect(screen.getByText("GLM / Z.ai")).toBeInTheDocument();
    });

    const providerChip = screen.getByRole("button", { name: "Xiaomi MiMo" });
    expect(providerChip).toHaveClass("break-words");

    fireEvent.click(screen.getByRole("button", { name: "GLM / Z.ai" }));

    expect(screen.getByRole("button", { name: "glm-5.1" })).toHaveClass(
      "break-all",
    );
  });
});
