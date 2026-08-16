# Claims And Evidence Map

Updated: 2026-08-16

This map keeps public descriptions tied to reviewable repository evidence. It is a claim-control document, not a release certificate.

| Public claim | Primary repository evidence | Required boundary |
| --- | --- | --- |
| SpeakRight has separate Windows Desktop and Browser Edition surfaces | [`README.md`](../../README.md), [`apps/browser/README.md`](../../apps/browser/README.md), and [`docs/browser-edition/ARCHITECTURE_AND_SEPARATION.md`](../browser-edition/ARCHITECTURE_AND_SEPARATION.md) | Browser localhost/static behavior is not Desktop Release EXE acceptance. |
| The learner-facing experience is designed for Chinese-speaking learners | [`README.md`](../../README.md) and the Chinese strings in the application source | An English GitHub entry does not imply an English-only UI. |
| `en-US` is stable; `es-ES`, `fr-FR`, and `ru-RU` are experimental | [`src/lib/language-profiles.ts`](../../src/lib/language-profiles.ts) and [`apps/browser/src/lib/language-profiles.ts`](../../apps/browser/src/lib/language-profiles.ts) | Experimental modules cannot claim formal mastery or language-wide validation. |
| Azure Speech is the numeric scoring authority | [`README.md`](../../README.md) and [`src/lib/api-client.ts`](../../src/lib/api-client.ts) | LLM feedback is downstream explanation and must not overwrite provider scores. |
| Browser Edition is BYOK and session-first for API-key storage | [`apps/browser/src/lib/api-keys.ts`](../../apps/browser/src/lib/api-keys.ts) | Local persistence occurs only after the user selects it; local device access remains a privacy risk. |
| Windows Desktop uses a desktop credential path for secrets | [`src/lib/api-keys.ts`](../../src/lib/api-keys.ts) and [`src/lib/secure-store.ts`](../../src/lib/secure-store.ts) | Browser-like development fallbacks may use browser storage; do not describe every runtime as OS-secured. |
| Source and source documentation are open under the repository license | [`LICENSE`](../../LICENSE) | Bundled/referenced third-party media and provider services keep separate terms; see [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md). |
| Windows artifacts are currently unsigned | [`README.md`](../../README.md), [`SECURITY.md`](../../SECURITY.md), and [`docs/INSTALLATION.md`](../INSTALLATION.md) | Only the explicitly labelled community-preview channel may publish them; do not call it Desktop Stable. |
| The project has public governance and support routes | [`CONTRIBUTING.md`](../../CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](../../CODE_OF_CONDUCT.md), [`SUPPORT.md`](../../SUPPORT.md), [`SECURITY.md`](../../SECURITY.md), and [`MAINTAINERS.md`](../../MAINTAINERS.md) | Private reports and learner data must not be redirected into public issues. |
| Automated quality commands are available | [`package.json`](../../package.json) and [`.github/workflows`](../../.github/workflows) | Command availability or a test pass is not a user count, adoption metric, or learning outcome. |
| Real user-testing results are not yet published | [`USER_TESTING_SUMMARY.md`](USER_TESTING_SUMMARY.md) | Keep quantitative user claims absent until real, consented, anonymized aggregates are supplied and the evidence gate passes. |

## Unsupported claims at this snapshot

The public repository does not currently establish:

- number of active, registered, unique, or paying users
- number of schools, teachers, classes, or institutions using SpeakRight
- download-to-user conversion or retention
- measured pronunciation improvement caused by SpeakRight
- clinical, therapeutic, examination, or certification validity
- completion of a signed stable public Windows release
- acceptance into the Codex for Open Source program

Do not derive these from GitHub activity, automated fixtures, provider usage, local development sessions, or informal anecdotes.

## Update rule

When a public claim changes, update the source evidence first, run the relevant checks, then update this map and the public wording together. If evidence conflicts, publish the narrower claim and record the unresolved question.
