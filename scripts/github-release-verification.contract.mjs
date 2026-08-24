import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateGithubReleaseMetadata } from "./verify-github-release.mjs";
import { expectedReleaseAssetNames } from "./verify-release-staging.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fixture(edition, draft) {
  const version = "1.1.0";
  const tag = edition === "browser" ? "v1.1.0" : "v1.1.0-desktop-preview.1";
  const names = [
    ...expectedReleaseAssetNames(edition, version),
    "SHA256SUMS.txt",
  ].sort();
  const localEntries = new Map(
    names.map((name) => [name, Buffer.from(`fixture:${edition}:${name}\n`)]),
  );
  const release = {
    id: edition === "browser" ? 101 : 202,
    tag_name: tag,
    name:
      edition === "browser"
        ? "SpeakRight 1.1.0 — Browser Stable"
        : "SpeakRight 1.1.0 — Unsigned Desktop Preview",
    draft,
    prerelease: edition === "desktop",
    published_at: draft ? null : "2026-08-23T18:00:00Z",
    assets: names.map((name, index) => ({
      id: 1000 + index,
      name,
      state: "uploaded",
      size: localEntries.get(name).length,
      digest: `sha256:${sha256(localEntries.get(name))}`,
      browser_download_url: `https://github.com/zixuanzhou0-ai/speakright/releases/download/${tag}/${encodeURIComponent(name)}`,
    })),
  };
  return {
    edition,
    version,
    tag,
    releaseId: release.id,
    draft,
    release,
    localEntries,
  };
}

for (const edition of ["browser", "desktop"]) {
  for (const draft of [true, false]) {
    const input = fixture(edition, draft);
    assert.deepEqual(validateGithubReleaseMetadata(input), {
      releaseId: input.release.id,
      assetCount: edition === "browser" ? 20 : 16,
      draft,
    });

    const wrongDigest = structuredClone(input.release);
    wrongDigest.assets[0].digest = `sha256:${"0".repeat(64)}`;
    assert.throws(
      () => validateGithubReleaseMetadata({ ...input, release: wrongDigest }),
      /digest mismatch/u,
    );

    const missing = structuredClone(input.release);
    missing.assets.pop();
    assert.throws(
      () => validateGithubReleaseMetadata({ ...input, release: missing }),
      /asset set mismatch/u,
    );

    const wrongState = structuredClone(input.release);
    wrongState.assets[0].state = "starter";
    assert.throws(
      () => validateGithubReleaseMetadata({ ...input, release: wrongState }),
      /not fully uploaded/u,
    );

    const wrongSize = structuredClone(input.release);
    wrongSize.assets[0].size += 1;
    assert.throws(
      () => validateGithubReleaseMetadata({ ...input, release: wrongSize }),
      /size mismatch/u,
    );
  }
}

const browser = fixture("browser", true);
assert.throws(
  () =>
    validateGithubReleaseMetadata({
      ...browser,
      draft: false,
    }),
  /draft state mismatch/u,
);
const wrongTag = structuredClone(browser.release);
wrongTag.tag_name = "v9.9.9";
assert.throws(
  () => validateGithubReleaseMetadata({ ...browser, release: wrongTag }),
  /tag mismatch/u,
);
assert.throws(
  () =>
    validateGithubReleaseMetadata({
      ...browser,
      releaseId: browser.releaseId + 1,
    }),
  /ID mismatch/u,
);

const browserReleaseWorkflow = readFileSync(
  ".github/workflows/release-browser.yml",
  "utf8",
);
const browserTagTrigger = browserReleaseWorkflow.slice(
  browserReleaseWorkflow.indexOf("  push:"),
  browserReleaseWorkflow.indexOf("  workflow_dispatch:"),
);
assert.match(browserTagTrigger, /- "v\*"/u);
assert.match(browserTagTrigger, /- "!v\*-desktop-preview\.\*"/u);
assert.ok(
  browserTagTrigger.indexOf('- "v*"') <
    browserTagTrigger.indexOf('- "!v*-desktop-preview.*"'),
  "The Browser Stable workflow must exclude Desktop Preview tags after its inclusive tag pattern.",
);

const docsWorkflow = readFileSync(".github/workflows/docs.yml", "utf8");
const docsPullRequestTrigger = docsWorkflow.slice(
  docsWorkflow.indexOf("  pull_request:"),
  docsWorkflow.indexOf("  push:"),
);
assert.equal(
  docsPullRequestTrigger.trim(),
  "pull_request:",
  "The required Docs Check must run for every pull request without path filtering.",
);

for (const [workflowPath, edition] of [
  [".github/workflows/release-browser.yml", "browser"],
  [".github/workflows/release-desktop-preview.yml", "desktop"],
]) {
  const workflow = readFileSync(workflowPath, "utf8");
  const publish = workflow.slice(workflow.indexOf("\n  publish:"));
  assert.match(publish, /ref: \$\{\{ needs\.build\.outputs\.commit_sha \}\}/u);
  assert.match(publish, /persist-credentials: false/u);
  assert.doesNotMatch(
    publish,
    /ref: \$\{\{ needs\.build\.outputs\.release_tag \}\}/u,
  );
  assert.ok(
    publish.indexOf(
      "Verify remote tag identity before running repository code",
    ) < publish.indexOf("node scripts/verify-release-staging.mjs"),
  );
  assert.match(publish, /\$headSha = \(git rev-parse HEAD\)\.Trim\(\)/u);
  assert.match(publish, /\$headSha -cne \$env:BUILT_COMMIT_SHA/u);
  assert.match(
    publish,
    /git merge-base --is-ancestor \$tagSha refs\/remotes\/origin\/main/u,
  );
  assert.ok((publish.match(/Assert-RemoteIdentity/gu) ?? []).length >= 4);
  assert.ok(
    publish.indexOf("GH_TOKEN:") >
      publish.indexOf("Verify remote tag identity"),
  );
  assert.match(publish, /\$createArgs = @\(/u);
  assert.match(publish, /"api", "--method", "POST"/u);
  assert.match(publish, /"-f", "target_commitish=\$env:BUILT_COMMIT_SHA"/u);
  assert.match(publish, /"-F", "draft=true"/u);
  assert.match(publish, /\$releaseId = \[long\]\$releaseIdText/u);
  assert.match(publish, /\$release = .*\| ConvertFrom-Json/u);
  assert.match(publish, /\$release\.upload_url/u);
  assert.doesNotMatch(publish, /gh release upload /u);
  assert.match(publish, /function Send-ReleaseAssetsById/u);
  assert.match(publish, /\[System\.Uri\]::EscapeDataString\(\$asset\.Name\)/u);
  assert.doesNotMatch(publish, /"--hostname", "uploads\.github\.com"/u);
  assert.match(
    publish,
    /https:\/\/uploads\.github\.com\/repos\/\$env:GITHUB_REPOSITORY\/releases\/\$ReleaseId\/assets\{\?name,label\}/u,
  );
  assert.match(
    publish,
    /\$endpoint = "\$\{uploadBaseUrl\}\?name=\$encodedName"/u,
  );
  assert.match(
    publish,
    /Send-ReleaseAssetsById -ReleaseId \$releaseId -UploadTemplate \$releaseUploadUrl -Directory "outputs\/release\/staging"/u,
  );
  assert.match(
    publish,
    new RegExp(
      `verify-github-release\\.mjs --edition ${edition} .*--release-id "\\$releaseId" --draft true --download true`,
      "u",
    ),
  );
  assert.match(publish, /\$publishArgs = @\(/u);
  assert.match(publish, /"api", "--method", "PATCH"/u);
  assert.match(publish, /"-F", "draft=false"/u);
  assert.match(
    publish,
    new RegExp(
      `verify-github-release\\.mjs --edition ${edition} .*--release-id "\\$releaseId" --draft false --download false`,
      "u",
    ),
  );
  assert.match(
    publish,
    /gh api --method DELETE "repos\/\$env:GITHUB_REPOSITORY\/releases\/\$releaseId"/u,
  );
  assert.doesNotMatch(publish, /\$published/u);
}

const verifierSource = readFileSync(
  "scripts/verify-github-release.mjs",
  "utf8",
);
assert.match(
  verifierSource,
  /repos\/\$\{repository\}\/releases\/\$\{releaseId\}/u,
);
assert.doesNotMatch(verifierSource, /releases\/tags/u);

console.log(
  "GitHub Release verification contract passed for draft and published Browser/Desktop releases.",
);
