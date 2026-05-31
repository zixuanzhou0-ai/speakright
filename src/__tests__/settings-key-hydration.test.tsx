import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  secureStore: new Map<string, unknown>(),
  store: new Map<string, unknown>(),
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: () => true,
}));

vi.mock("@/lib/secure-store", () => ({
  secureStoreGet: vi.fn(async (key: string) => mocks.secureStore.get(key) ?? null),
  secureStoreSet: vi.fn(async (key: string, value: unknown) => {
    mocks.secureStore.set(key, value);
  }),
  secureStoreDelete: vi.fn(async (key: string) => {
    mocks.secureStore.delete(key);
  }),
}));

vi.mock("@/lib/tauri-store", () => ({
  storeGet: vi.fn(async (key: string) => mocks.store.get(key) ?? null),
  storeSet: vi.fn(async (key: string, value: unknown) => {
    mocks.store.set(key, value);
  }),
  storeDelete: vi.fn(async (key: string) => {
    mocks.store.delete(key);
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("settings key hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.secureStore.clear();
    mocks.store.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("updates the Azure settings card when desktop secure-store hydration completes", async () => {
    const { AzureConfigCard } = await import(
      "@/components/settings/azure-config-card"
    );
    const { hydrateKeys, clearItem } = await import("@/lib/api-keys");
    mocks.secureStore.set("speakright_azure_config", {
      subscriptionKey: "desktop-hydrated-key",
      region: "westus",
    });

    render(<AzureConfigCard />);

    expect(screen.getByLabelText("Subscription Key")).toHaveValue("");

    await act(async () => {
      await hydrateKeys();
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Subscription Key")).toHaveValue(
        "desktop-hydrated-key",
      );
      expect(screen.getByLabelText("Region")).toHaveValue("westus");
    });
    expect(localStorage.getItem("speakright_azure_config")).toBeNull();

    await act(async () => {
      await clearItem("speakright_azure_config");
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Subscription Key")).toHaveValue("");
      expect(screen.getByLabelText("Region")).toHaveValue("eastus");
    });
  });
});
