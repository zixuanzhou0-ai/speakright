import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  expectedReleaseAssetNames,
  resolveStagingDirectory,
  verifyReleaseStagingEntries,
} from "./verify-release-staging.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fixture(edition) {
  const assets = expectedReleaseAssetNames(edition, "1.1.0");
  const entries = new Map(
    assets.map((name) => [name, Buffer.from(`fixture:${edition}:${name}\n`)]),
  );
  entries.set(
    "SHA256SUMS.txt",
    Buffer.from(
      `${assets.map((name) => `${sha256(entries.get(name))}  ${name}`).join("\n")}\n`,
    ),
  );
  return entries;
}

for (const [edition, assetCount, checksumEntryCount] of [
  ["browser", 20, 19],
  ["desktop", 16, 15],
]) {
  const entries = fixture(edition);
  assert.deepEqual(
    verifyReleaseStagingEntries({ edition, version: "1.1.0", entries }),
    { edition, assetCount, checksumEntryCount },
  );

  const missing = new Map(entries);
  missing.delete(expectedReleaseAssetNames(edition, "1.1.0")[0]);
  assert.throws(
    () =>
      verifyReleaseStagingEntries({
        edition,
        version: "1.1.0",
        entries: missing,
      }),
    /asset set mismatch/u,
  );

  const extra = new Map(entries);
  extra.set("unexpected.txt", Buffer.from("unexpected"));
  assert.throws(
    () =>
      verifyReleaseStagingEntries({
        edition,
        version: "1.1.0",
        entries: extra,
      }),
    /asset set mismatch/u,
  );

  const corrupt = new Map(entries);
  const first = expectedReleaseAssetNames(edition, "1.1.0")[0];
  corrupt.set(first, Buffer.from("corrupt"));
  assert.throws(
    () =>
      verifyReleaseStagingEntries({
        edition,
        version: "1.1.0",
        entries: corrupt,
      }),
    /Checksum mismatch/u,
  );
}

assert.throws(
  () => expectedReleaseAssetNames("unknown", "1.1.0"),
  /Unknown release edition/u,
);
assert.throws(
  () => expectedReleaseAssetNames("browser", "9.9.9"),
  /Unexpected release version/u,
);
assert.match(
  resolveStagingDirectory("outputs/release/staging"),
  /outputs[\\/]release[\\/]staging$/u,
);
assert.throws(
  () => resolveStagingDirectory("outputs/release"),
  /must be exactly/u,
);

console.log(
  "Release staging contract passed for 20 Browser assets and 16 Desktop Preview assets.",
);
