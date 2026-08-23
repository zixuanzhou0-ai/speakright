# Security Policy

## Supported Scope

The public repository tracks Windows Desktop and Browser Edition. Security
fixes should target `main` unless a maintainer has created a dedicated release
branch. Historical tags and unsigned controlled-test artifacts may not receive
backports.

## Reporting A Vulnerability

Please do not open a public issue for vulnerabilities, leaked credentials, or
private user data.

Use [GitHub private vulnerability reporting](https://github.com/zixuanzhou0-ai/speakright/security/advisories/new)
or contact the repository owner through GitHub with:

- a short description of the issue
- affected files or versions
- reproduction steps
- likely impact
- any suggested mitigation

We will acknowledge valid reports as soon as possible and prioritize issues
that could expose API keys, microphone recordings, local learning data, desktop
permissions, or arbitrary network access.

No public response-time or remediation-time guarantee is currently offered.
Please avoid including secrets or personal learner data in the initial report;
maintainers can request the minimum additional evidence through a private path.

## Secrets And User Data

Do not commit API keys, tokens, private keys, real user recordings, or exported
learning data. The desktop app stores user-provided service credentials through
the desktop credential layer where supported. `.env.example` is documentation
only and must not contain real credentials.

## Release Security Boundary

Windows artifacts are currently unsigned. A public artifact may appear only on
the explicitly labelled community-preview channel with a SmartScreen warning,
checksums, SBOMs, and the required validation reports. Code signing remains a
requirement before any future release can be called Desktop Stable.

The Tauri allowlist and CSP should remain narrow. Pull requests that add new
network origins, file access, shell access, or plugin permissions must include
a short justification and tests when possible.

The public source-level disposition for the v1.1.0 CodeQL baseline and its
time-bounded transitive dependency exceptions is recorded in
[`docs/security/CODE_SCANNING_TRIAGE_V1.1.0.md`](docs/security/CODE_SCANNING_TRIAGE_V1.1.0.md).
Scanner dismissal metadata is not treated as evidence by itself; release
decisions use the source analysis and revalidation requirements in that record.

Browser Edition changes that add a network destination, persistent credential
path, local bridge, cross-origin permission, or recording/export behavior need
the same review. See `PRIVACY.md` for the public data-flow boundary.
