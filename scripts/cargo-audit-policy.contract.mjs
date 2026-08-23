import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const policyPath = ".cargo/audit.toml";
const triagePath = "docs/security/CODE_SCANNING_TRIAGE_V1.1.0.md";
const candidatePath = "docs/validation/V1.1.0_RELEASE_CANDIDATE.md";

const expectedAllowedAdvisories = [
  "RUSTSEC-2024-0370",
  "RUSTSEC-2024-0411",
  "RUSTSEC-2024-0412",
  "RUSTSEC-2024-0413",
  "RUSTSEC-2024-0414",
  "RUSTSEC-2024-0415",
  "RUSTSEC-2024-0416",
  "RUSTSEC-2024-0417",
  "RUSTSEC-2024-0418",
  "RUSTSEC-2024-0419",
  "RUSTSEC-2024-0420",
  "RUSTSEC-2024-0429",
  "RUSTSEC-2025-0057",
  "RUSTSEC-2025-0075",
  "RUSTSEC-2025-0080",
  "RUSTSEC-2025-0081",
  "RUSTSEC-2025-0098",
  "RUSTSEC-2025-0100",
  "RUSTSEC-2026-0097",
].sort();

const patchedAdvisories = ["RUSTSEC-2026-0190", "RUSTSEC-2026-0221"];
const allowedPackages = [
  ["atk", "0.18.2"],
  ["atk-sys", "0.18.2"],
  ["fxhash", "0.2.1"],
  ["gdk", "0.18.2"],
  ["gdk-sys", "0.18.2"],
  ["gdkwayland-sys", "0.18.2"],
  ["gdkx11", "0.18.2"],
  ["gdkx11-sys", "0.18.2"],
  ["glib", "0.18.5"],
  ["gtk", "0.18.2"],
  ["gtk-sys", "0.18.2"],
  ["gtk3-macros", "0.18.2"],
  ["proc-macro-error", "1.0.4"],
  ["rand", "0.7.3"],
  ["unic-char-property", "0.9.0"],
  ["unic-char-range", "0.9.0"],
  ["unic-common", "0.9.0"],
  ["unic-ucd-ident", "0.9.0"],
  ["unic-ucd-version", "0.9.0"],
];
const reviewDeadline = new Date("2026-11-30T23:59:59.999Z");
const policy = readFileSync(policyPath, "utf8");
const triage = readFileSync(triagePath, "utf8");
const candidate = readFileSync(candidatePath, "utf8");
const cargoLock = readFileSync("src-tauri/Cargo.lock", "utf8");

const policyIds = [...policy.matchAll(/RUSTSEC-\d{4}-\d{4}/gu)]
  .map(([id]) => id)
  .sort();

assert.deepEqual(
  policyIds,
  expectedAllowedAdvisories,
  "RustSec ignore set changed without an explicit policy review",
);
assert.match(
  policy,
  /informational_warnings\s*=\s*\["unmaintained", "unsound"\]/u,
);
assert.match(policy, /deny\s*=\s*\["warnings"\]/u);

for (const id of expectedAllowedAdvisories) {
  assert.match(
    triage,
    new RegExp(id, "u"),
    `${id} is missing from public triage`,
  );
}
for (const id of patchedAdvisories) {
  assert.doesNotMatch(
    policy,
    new RegExp(id, "u"),
    `${id} must be patched, not ignored`,
  );
  assert.match(
    triage,
    new RegExp(id, "u"),
    `${id} patch is missing from public triage`,
  );
}

for (const [name, version] of allowedPackages) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  assert.match(
    cargoLock,
    new RegExp(
      `name = "${escapedName}"\\r?\\nversion = "${escapedVersion}"`,
      "u",
    ),
    `${name} ${version} no longer matches the reviewed RustSec exception`,
  );
}

assert.match(cargoLock, /name = "anyhow"\r?\nversion = "1\.0\.103"/u);
assert.match(cargoLock, /name = "event-listener"\r?\nversion = "5\.4\.2"/u);
assert.match(triage, /19 allowed informational warnings/u);
assert.match(triage, /Owner:.*@zixuanzhou0-ai/u);
assert.match(triage, /2026-11-30/u);
assert.match(candidate, /19 allowed informational warnings/u);
assert.ok(
  new Date() <= reviewDeadline,
  "RustSec exception review expired on 2026-11-30; re-review and update the policy before continuing",
);

console.log(
  "RustSec policy contract passed: 19 reviewed warnings are explicit; all new warnings are denied.",
);
