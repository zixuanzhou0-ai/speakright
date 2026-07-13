import { describe, expect, it } from "vitest";
import {
  choosePreferredMicrophoneDeviceId,
  toMicrophoneDeviceOptions,
} from "@/lib/microphone-device";

function device(
  deviceId: string,
  label: string,
  kind: MediaDeviceKind = "audioinput",
): MediaDeviceInfo {
  return {
    deviceId,
    groupId: "group",
    kind,
    label,
    toJSON: () => ({}),
  };
}

describe("microphone device preference", () => {
  it("keeps only audio inputs and identifies Windows default devices", () => {
    expect(
      toMicrophoneDeviceOptions([
        device("default", "默认 - USB 麦克风"),
        device("speaker", "扬声器", "audiooutput"),
      ]),
    ).toEqual([
      expect.objectContaining({
        deviceId: "default",
        isSystemDefault: true,
      }),
    ]);
  });

  it("prefers the saved device, then the system default", () => {
    const devices = toMicrophoneDeviceOptions([
      device("default", "默认 - USB 麦克风"),
      device("studio", "Studio Mic"),
    ]);

    expect(choosePreferredMicrophoneDeviceId(devices, "studio")).toBe("studio");
    expect(choosePreferredMicrophoneDeviceId(devices, "missing")).toBe(
      "default",
    );
  });
});
