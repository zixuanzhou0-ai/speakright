import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export const TAURI_UNKNOWN_BUNDLE_MARKER = "__TAURI_BUNDLE_TYPE_VAR_UNK";
export const TAURI_NSIS_BUNDLE_MARKER = "__TAURI_BUNDLE_TYPE_VAR_NSS";

const unknownMarker = Buffer.from(TAURI_UNKNOWN_BUNDLE_MARKER, "ascii");
const nsisMarker = Buffer.from(TAURI_NSIS_BUNDLE_MARKER, "ascii");

export class TauriBundleExecutableIdentityError extends Error {
  constructor(message) {
    super(message);
    this.name = "TauriBundleExecutableIdentityError";
    this.code = "invalid-tauri-bundle-marker";
  }
}

function fail(message) {
  throw new TauriBundleExecutableIdentityError(message);
}

export async function hashTauriNsisExecutableVariant(
  filePath,
  { highWaterMark = 64 * 1024 } = {},
) {
  if (!Number.isInteger(highWaterMark) || highWaterMark <= 0) {
    fail("bundle identity chunk size must be a positive integer");
  }
  if (unknownMarker.length !== nsisMarker.length) {
    fail("reviewed Tauri bundle markers must have equal byte lengths");
  }

  const releaseHash = createHash("sha256");
  const expectedNsisHash = createHash("sha256");
  let pending = Buffer.alloc(0);
  let consumedBytes = 0;
  let totalBytes = 0;
  let markerCount = 0;
  let markerOffset = -1;

  for await (const chunk of createReadStream(filePath, { highWaterMark })) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    releaseHash.update(bytes);
    totalBytes += bytes.length;
    pending = pending.length === 0 ? bytes : Buffer.concat([pending, bytes]);

    while (pending.length >= unknownMarker.length) {
      const index = pending.indexOf(unknownMarker);
      if (index === -1) {
        const flushLength = pending.length - unknownMarker.length + 1;
        expectedNsisHash.update(pending.subarray(0, flushLength));
        consumedBytes += flushLength;
        pending = pending.subarray(flushLength);
        break;
      }

      markerCount += 1;
      if (markerCount > 1) {
        fail("release executable contains multiple unknown bundle markers");
      }
      markerOffset = consumedBytes + index;
      expectedNsisHash.update(pending.subarray(0, index));
      expectedNsisHash.update(nsisMarker);
      consumedBytes += index + unknownMarker.length;
      pending = pending.subarray(index + unknownMarker.length);
    }
  }

  expectedNsisHash.update(pending);
  if (markerCount !== 1) {
    fail("release executable must contain exactly one unknown bundle marker");
  }

  return {
    bytes: totalBytes,
    markerOffset,
    releaseSha256: releaseHash.digest("hex"),
    expectedNsisSha256: expectedNsisHash.digest("hex"),
  };
}
