import type { AzureConfig } from "@/types/api-keys";

const AZURE_REGION_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function normalizeAzureRegion(region: string): string {
  return region.trim().toLowerCase();
}

export function getAzureRegionValidationError(region: string): string | null {
  const normalized = normalizeAzureRegion(region);
  if (!normalized) return "请输入 Azure region";
  if (!AZURE_REGION_PATTERN.test(normalized)) {
    return "Azure region 只能包含字母、数字和连字符";
  }
  return null;
}

export function assertAzureRegion(region: string): string {
  const error = getAzureRegionValidationError(region);
  if (error) throw new Error(error);
  return normalizeAzureRegion(region);
}

export function isAzureConfigReady(config: AzureConfig | null): boolean {
  return (
    !!config?.subscriptionKey?.trim() &&
    !getAzureRegionValidationError(config.region)
  );
}
