# Open-Source Readiness

Updated: 2026-08-24

This directory collects public, reviewable evidence about SpeakRight as an open-source project. It does not contain private application answers, account details, user recordings, provider credentials, or unsupported adoption metrics.

## Evidence index

| Topic | Public evidence |
| --- | --- |
| Project entry and edition boundary | [`README.md`](../../README.md) and [`README.zh-CN.md`](../../README.zh-CN.md) |
| License and third-party boundary | [`LICENSE`](../../LICENSE), [`NOTICE.md`](../../NOTICE.md), and [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) |
| Contribution and conduct | [`CONTRIBUTING.md`](../../CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](../../CODE_OF_CONDUCT.md) |
| Maintainer ownership | [`MAINTAINERS.md`](../../MAINTAINERS.md) and [`.github/CODEOWNERS`](../../.github/CODEOWNERS) |
| Privacy and security | [`PRIVACY.md`](../../PRIVACY.md) and [`SECURITY.md`](../../SECURITY.md) |
| Support routing | [`SUPPORT.md`](../../SUPPORT.md) and [issue templates](../../.github/ISSUE_TEMPLATE/README.md) |
| Direction and history | [`ROADMAP.md`](../../ROADMAP.md) and [`CHANGELOG.md`](../../CHANGELOG.md) |
| Claims and validation | [`docs/validation/README.md`](../validation/README.md) and [`CLAIMS_AND_EVIDENCE.md`](../validation/CLAIMS_AND_EVIDENCE.md) |
| v1.1.0 candidate gates | [`V1.1.0_RELEASE_CANDIDATE.md`](../validation/V1.1.0_RELEASE_CANDIDATE.md) |
| v1.1.0 Release objects, tags, workflows, assets, and signed-out checks | [`V1.1.0_RELEASE_VERIFICATION.md`](../validation/V1.1.0_RELEASE_VERIFICATION.md) — public Releases, full-history security follow-up, and independent read-only documentation review verified |
| Versioned screenshots and overview demo | [`docs/assets/demo/README.md`](../assets/demo/README.md) |
| Privacy-safe user-testing attestation and claim boundary | [`USER_TESTING_SUMMARY.md`](../validation/USER_TESTING_SUMMARY.md) |
| Codex program readiness | [`CODEX_FOR_OPEN_SOURCE_READINESS.md`](CODEX_FOR_OPEN_SOURCE_READINESS.md) |
| GitHub publication settings | [`GITHUB_RELEASE_CHECKLIST.md`](GITHUB_RELEASE_CHECKLIST.md) |

## Current public boundary

- The repository is public at [github.com/zixuanzhou0-ai/speakright](https://github.com/zixuanzhou0-ai/speakright).
- Source code and source documentation use the repository license; bundled or referenced third-party media keeps its separate rights boundary.
- American English is the stable baseline. Spanish, French, and Russian remain experimental.
- [`v1.1.0` Browser Stable](https://github.com/zixuanzhou0-ai/speakright/releases/tag/v1.1.0)
  and the unsigned
  [`v1.1.0-desktop-preview.1` Desktop Preview](https://github.com/zixuanzhou0-ai/speakright/releases/tag/v1.1.0-desktop-preview.1)
  are public and were anonymously verified on 2026-08-24. Both annotated tags
  peel to commit `61c506af5c1f0b9b8397c74f69470c0da1e9f382`.
- The Desktop track is an unsigned pre-release, not Desktop Stable. Its public
  binaries are the bare EXE and NSIS setup; no MSI is published.
- Repository checks and synthetic/provider checks are not presented as real-user adoption or learning efficacy.
- No public user count, institution count, download count, or learning-outcome percentage is claimed without a dated, reviewable source.

## Application hygiene

Public evidence belongs here. Private form answers, contact details, account identifiers, screenshots of application portals, and unpublished user research do not.

If a maintainer creates a local application draft, use an already ignored location such as `outputs/private/codex-oss-application.md` and confirm it is ignored with:

```bat
git check-ignore -v outputs/private/codex-oss-application.md
```

Do not add an exception that makes that draft trackable. Copy only non-sensitive, source-backed facts into the public files above.
