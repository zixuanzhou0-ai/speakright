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

  it("labels desktop app preference storage failures accurately", () => {
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
});
