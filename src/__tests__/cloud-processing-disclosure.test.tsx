import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CloudProcessingDisclosure } from "@/components/common/cloud-processing-disclosure";
import {
  CLOUD_PROCESSING_NOTICE_KEY,
  requestCloudProcessingConsent,
} from "@/lib/cloud-processing-consent";

describe("CloudProcessingDisclosure", () => {
  beforeEach(() => localStorage.clear());

  it("blocks the first Azure request until the learner acknowledges it", async () => {
    render(<CloudProcessingDisclosure />);

    let decision: Promise<boolean> | undefined;
    await act(async () => {
      decision = requestCloudProcessingConsent("azure-assessment");
    });

    expect(screen.getByText("在云端评分前确认")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "同意并继续评分" }));

    await expect(decision).resolves.toBe(true);
    expect(localStorage.getItem(CLOUD_PROCESSING_NOTICE_KEY)).toBe("accepted");
  });

  it("fails closed and keeps the notice unacknowledged when declined", async () => {
    render(<CloudProcessingDisclosure />);

    let decision: Promise<boolean> | undefined;
    await act(async () => {
      decision = requestCloudProcessingConsent("azure-assessment");
    });
    fireEvent.click(screen.getByRole("button", { name: "暂不发送" }));

    await expect(decision).resolves.toBe(false);
    expect(localStorage.getItem(CLOUD_PROCESSING_NOTICE_KEY)).toBeNull();
  });
});
