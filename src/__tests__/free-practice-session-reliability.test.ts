import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bindFreePracticeValue,
  getFreePracticeTextFingerprint,
  isCurrentFreePracticeRequest,
  normalizeFreePracticeText,
  readBoundFreePracticeValue,
} from "@speakright/core/training/free-practice-session";
import { describe, expect, it } from "vitest";

describe("free-practice session reliability", () => {
  it("treats presentation-only whitespace as the same text", () => {
    expect(normalizeFreePracticeText("  Think\n  clearly.  ")).toBe(
      "Think clearly.",
    );
    expect(getFreePracticeTextFingerprint("Think   clearly.")).toBe(
      getFreePracticeTextFingerprint(" Think clearly. "),
    );
    expect(getFreePracticeTextFingerprint("Think clearly!")).not.toBe(
      getFreePracticeTextFingerprint("Think clearly."),
    );
  });

  it("restores only values explicitly bound to the current text", () => {
    const current = getFreePracticeTextFingerprint("Current sentence.");
    const other = getFreePracticeTextFingerprint("Old sentence.");
    const value = { pronunciationScore: 91 };

    expect(
      readBoundFreePracticeValue(
        bindFreePracticeValue(current, value),
        current,
      ),
    ).toEqual(value);
    expect(
      readBoundFreePracticeValue(bindFreePracticeValue(other, value), current),
    ).toBeNull();
    expect(readBoundFreePracticeValue(value, current)).toBeNull();
  });

  it("rejects delayed assessment results after text or request changes", () => {
    const oldText = getFreePracticeTextFingerprint("Old sentence.");
    const newText = getFreePracticeTextFingerprint("New sentence.");

    expect(
      isCurrentFreePracticeRequest({
        requestId: 4,
        currentRequestId: 4,
        textFingerprint: oldText,
        currentTextFingerprint: newText,
      }),
    ).toBe(false);
    expect(
      isCurrentFreePracticeRequest({
        requestId: 3,
        currentRequestId: 4,
        textFingerprint: newText,
        currentTextFingerprint: newText,
      }),
    ).toBe(false);
    expect(
      isCurrentFreePracticeRequest({
        requestId: 4,
        currentRequestId: 4,
        textFingerprint: newText,
        currentTextFingerprint: newText,
      }),
    ).toBe(true);
  });

  it("stops every playback source before opening the microphone", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/sentences/page.tsx"),
      "utf8",
    );
    const start = source.indexOf("const handleRecordStart");
    const end = source.indexOf("const handleRecordStop", start);
    const handler = source.slice(start, end);
    const microphoneStart = handler.indexOf("recorder.startRecording()");

    expect(start).toBeGreaterThanOrEqual(0);
    expect(microphoneStart).toBeGreaterThanOrEqual(0);
    for (const stopCall of [
      "playback.stop()",
      "tts.reset()",
      "wordAudio.stop()",
      "recorder.reset()",
    ]) {
      expect(handler.indexOf(stopCall), stopCall).toBeGreaterThanOrEqual(0);
      expect(handler.indexOf(stopCall), stopCall).toBeLessThan(microphoneStart);
    }
  });

  it("invalidates every text-bound result when practice text changes", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/sentences/page.tsx"),
      "utf8",
    );
    const start = source.indexOf("const invalidatePracticeForTextChange");
    const end = source.indexOf("const handleSentenceChange", start);
    const invalidator = source.slice(start, end);

    for (const resetAction of [
      "recorder.reset()",
      "recordingQuality.reset()",
      "azure.reset()",
      "llm.reset()",
      "setRecordingTextFingerprint(null)",
      "setAzureResultTextFingerprint(null)",
      "setLlmTextFingerprint(null)",
      "setSelectedWord(null)",
      "setTransferSummary(null)",
    ]) {
      expect(invalidator, resetAction).toContain(resetAction);
    }
  });
});
