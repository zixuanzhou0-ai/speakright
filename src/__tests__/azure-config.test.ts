import { describe, expect, it } from "vitest";
import {
  getAzureRegionValidationError,
  isAzureConfigReady,
  normalizeAzureRegion,
} from "@/lib/azure-config";

describe("Azure desktop configuration", () => {
  it("normalizes valid Azure Speech regions", () => {
    expect(normalizeAzureRegion(" EastUS2 ")).toBe("eastus2");
    expect(getAzureRegionValidationError("chinaeast2")).toBeNull();
    expect(getAzureRegionValidationError("usgovvirginia")).toBeNull();
  });

  it("rejects region values that cannot safely form Azure hostnames", () => {
    expect(getAzureRegionValidationError("")).toBe("请输入 Azure region");
    expect(getAzureRegionValidationError("eastus.example.com")).toContain(
      "只能包含字母、数字和连字符",
    );
    expect(getAzureRegionValidationError("https://eastus")).toContain(
      "只能包含字母、数字和连字符",
    );
    expect(getAzureRegionValidationError("-eastus")).toContain(
      "只能包含字母、数字和连字符",
    );
  });

  it("only treats complete, valid Azure configs as desktop-ready", () => {
    expect(
      isAzureConfigReady({ subscriptionKey: "secret", region: "eastus" }),
    ).toBe(true);
    expect(isAzureConfigReady({ subscriptionKey: "", region: "eastus" })).toBe(
      false,
    );
    expect(
      isAzureConfigReady({
        subscriptionKey: "secret",
        region: "eastus.example.com",
      }),
    ).toBe(false);
  });
});
