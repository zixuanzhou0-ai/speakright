import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyHydrator } from "@/components/layout/key-hydrator";

const mocks = vi.hoisted(() => ({
  hydrateKeys: vi.fn(async () => {}),
  runLocalDataMigrations: vi.fn(() => ({ quarantinedKeys: [] as string[] })),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock("@/lib/api-keys", () => ({
  API_KEY_STORAGE_ERROR_EVENT: "speakright:api-key-storage-error",
  API_KEY_STORAGE_KEYS: [
    "speakright_azure_config",
    "speakright_elevenlabs_config",
    "speakright_minimax_tts_config",
    "speakright_mimo_tts_config",
    "speakright_llm_config",
  ],
  APP_PREFERENCE_STORAGE_KEYS: ["speakright_coach_mode"],
  hydrateKeys: mocks.hydrateKeys,
}));

vi.mock("@/lib/local-data-migrations", () => ({
  runLocalDataMigrations: mocks.runLocalDataMigrations,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    warning: mocks.toastWarning,
  },
}));

function dispatchStorageError(detail: {
  key: string;
  operation: "save" | "delete" | "hydrate";
  message: string;
}) {
  window.dispatchEvent(
    new CustomEvent("speakright:api-key-storage-error", { detail }),
  );
}

describe("KeyHydrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("labels API key storage failures accurately", () => {
    render(<KeyHydrator />);

    dispatchStorageError({
      key: "speakright_azure_config",
      operation: "save",
      message: "keychain unavailable",
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "API key 保存失败：keychain unavailable",
    );
  });

  it("labels browser app preference storage failures accurately", () => {
    render(<KeyHydrator />);

    dispatchStorageError({
      key: "speakright_coach_mode",
      operation: "save",
      message: "settings store unavailable",
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "本机设置保存失败：settings store unavailable",
    );
  });

  it("warns when corrupt local data is quarantined during startup", () => {
    mocks.runLocalDataMigrations.mockReturnValueOnce({
      quarantinedKeys: ["speakright_usage"],
    });

    render(<KeyHydrator />);

    expect(mocks.toastWarning).toHaveBeenCalledWith(
      "已隔离 1 个损坏的本地数据项",
    );
    expect(mocks.hydrateKeys).toHaveBeenCalled();
  });

  it("keeps startup hydration running when local data migration fails", () => {
    mocks.runLocalDataMigrations.mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });

    render(<KeyHydrator />);

    expect(mocks.toastError).toHaveBeenCalledWith(
      "本机学习数据检查失败：本机存储暂时不可用。应用会继续启动；如果设置页仍显示异常，请导出诊断包或重置本机数据后重试。",
    );
    expect(mocks.hydrateKeys).toHaveBeenCalled();
  });
});
