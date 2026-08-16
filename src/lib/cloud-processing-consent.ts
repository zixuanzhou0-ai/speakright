"use client";

export const CLOUD_PROCESSING_NOTICE_KEY =
  "speakright_cloud_processing_notice_v1";
export const CLOUD_PROCESSING_REQUEST_EVENT =
  "speakright:cloud-processing-request";

export type CloudProcessingPurpose = "azure-assessment";

export interface CloudProcessingRequestDetail {
  purpose: CloudProcessingPurpose;
  handled: boolean;
  resolve: (accepted: boolean) => void;
}

declare global {
  interface WindowEventMap {
    [CLOUD_PROCESSING_REQUEST_EVENT]: CustomEvent<CloudProcessingRequestDetail>;
  }
}

export function hasAcknowledgedCloudProcessing(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CLOUD_PROCESSING_NOTICE_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function acknowledgeCloudProcessing(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLOUD_PROCESSING_NOTICE_KEY, "accepted");
}

export function requestCloudProcessingConsent(
  purpose: CloudProcessingPurpose = "azure-assessment",
): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (hasAcknowledgedCloudProcessing()) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const detail: CloudProcessingRequestDetail = {
      purpose,
      handled: false,
      resolve: (accepted) => {
        if (settled) return;
        settled = true;
        resolve(accepted);
      },
    };

    window.dispatchEvent(
      new CustomEvent<CloudProcessingRequestDetail>(
        CLOUD_PROCESSING_REQUEST_EVENT,
        { detail },
      ),
    );

    // A missing disclosure host must fail closed instead of silently sending
    // learner audio to a cloud provider.
    if (!detail.handled) detail.resolve(false);
  });
}
