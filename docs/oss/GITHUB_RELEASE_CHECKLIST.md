# GitHub release settings checklist

Updated: 2026-08-24

This checklist separates observed repository settings, completed public
publication/security evidence, and completed independent read-only review. A
workflow definition or local tag alone is not evidence that a public Release
exists.

## Verified repository-settings snapshot

The repository/API review completed before v1.1.0 publication recorded:

- [x] repository visibility is public and the default branch is `main`
- [x] repository description names pronunciation practice plus the Windows
      Desktop and cross-platform Browser editions; the homepage points to the
      canonical README
- [x] GitHub's repository-license endpoint recognizes the canonical root
      license as MIT
- [x] repository topics are `azure-speech`, `english-learning`,
      `language-learning`, `nextjs`, `pronunciation`, `pronunciation-training`,
      `rust`, `speech-assessment`, `tauri`, and `typescript`
- [x] Dependabot version updates and security updates are enabled for the
      configured dependency ecosystems
- [x] private vulnerability reporting is enabled and `SECURITY.md` routes
      sensitive reports away from public issues
- [x] secret scanning and push protection are enabled
- [x] the reviewed Dependabot, secret-scanning, and CodeQL alert queues contained
      no open release-blocking alert at the dated snapshot
- [x] `main` blocks force pushes and deletion, requires resolved conversations,
      and uses strict required status checks
- [x] `main` requires pull requests with zero mandatory approving reviews and
      applies branch protection to administrators; this preserves the PR audit
      trail without inventing an unavailable external-approval requirement

The required check contexts observed at this snapshot are:

1. `CodeQL`
2. `JavaScript and TypeScript analysis`
3. `Production npm audit`
4. `RustSec cargo audit`
5. `Secret history scan`
6. `build`
7. `dependency-review`
8. `docs`
9. `playwright`

An empty alert queue is a dated observation, not a promise that future commits
or dependencies are vulnerability-free. Repository settings can also change;
recheck them immediately before submitting an external application.

## Verified release publication

- [x] At publication, `main` and both release tags resolved to reviewed commit
      `61c506af5c1f0b9b8397c74f69470c0da1e9f382`; at the 2026-08-24
      verification, both release tags still peeled to that commit.
- [x] Annotated tag `v1.1.0` peels to that exact commit and triggers only
      the Browser Stable workflow.
- [x] Annotated tag `v1.1.0-desktop-preview.1` peels to that exact commit
      and triggers only the unsigned Desktop Preview workflow.
- [x] At the 2026-08-24 verification, Browser Release ID `375494273` was public,
      non-draft, non-prerelease, selected by `/releases/latest`, and contained
      exactly the 20 contracted assets.
- [x] At the 2026-08-24 verification, Desktop Release ID `375511263` was public,
      non-draft, prerelease, not selected by `/releases/latest`, and contained
      exactly the 16 contracted assets.
- [x] Both checksum manifests and all assets were downloaded; every SHA-256
      digest matched the GitHub API metadata, manifest entry, and downloaded
      bytes where applicable.
- [x] Browser assets include the static ZIP, three SBOMs, validation and
      rights evidence, screenshot/demo manifests, captions, and overview video.
- [x] Desktop assets include only the bare `speakright.exe` and validated NSIS
      setup as binaries; MSI is absent. The three SBOMs, validation report,
      release report, round-trip report, checksums, and rights evidence are
      present.
- [x] Both Release pages and every asset URL opened anonymously without an
      authorization header.
- [x] The completed
      [`V1.1.0_RELEASE_VERIFICATION.md`](../validation/V1.1.0_RELEASE_VERIFICATION.md)
      records the observed Release IDs, timestamps, workflow runs, tag objects,
      peeled commit, asset metadata/digests, and anonymous-access results.
- [x] README, installation, changelog, Browser release notes, evidence index,
      claims map, and Codex readiness checklist describe the observed public
      release result.

The exact observations, including all 36 asset rows, are in the verification
record. A separate read-only Codex reviewer cross-checked them against public
GitHub evidence and anonymous-verification outputs.

## Completed security follow-up and independent review

- [x] Resolve and record the final result after full-history Supply Chain workflow
      dispatch
      [`32701637827`](https://github.com/zixuanzhou0-ai/speakright/actions/runs/32701637827).
      This first run failed on seven historical fake-value or
      documentation-placeholder findings classified as false positives.
      PR-candidate run
      [`32703718691`](https://github.com/zixuanzhou0-ai/speakright/actions/runs/32703718691)
      validated the exact-fingerprint, fail-closed contract. After merge,
      main-push run
      [`32707268266`](https://github.com/zixuanzhou0-ai/speakright/actions/runs/32707268266)
      repeated complete-history traversal at `defa16a570513a323b16c20f2290f73cdf9d2445`
      with zero unreviewed findings and zero-result redacted SARIF. This
      follow-up is distinct from successful release-commit Supply Chain run
      [`32693926778`](https://github.com/zixuanzhou0-ai/speakright/actions/runs/32693926778).
- [x] Independent reviewer confirms the release-verification document against
      the public Release APIs, tag objects, workflows, manifests, and downloads.

## Final branch-protection recheck

After the release-verification documentation PR is merged, re-read branch
protection through the GitHub API. Confirm it still requires pull requests with
zero mandatory approving reviews, applies to administrators, preserves the nine
real required checks in strict mode, requires resolved conversations, and keeps
force-push and deletion protection. Record only settings actually returned by
GitHub; do not infer them from workflow files or this dated snapshot.

## Application boundary

The Codex for Open Source application is separate from repository publication.
Application submission and program decision remain unchecked until an authorized
maintainer performs them. Do not place contact details, account identifiers,
private recordings, credentials, or unpublished participant data in this file.
