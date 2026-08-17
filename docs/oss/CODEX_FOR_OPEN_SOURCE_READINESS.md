# Codex For Open Source Readiness

Updated: 2026-08-16

This is a public readiness record for a possible SpeakRight application. It is not an application, an acceptance notice, an eligibility determination, or evidence that OpenAI has endorsed SpeakRight.

## Official program context

The current [OpenAI Codex for Open Source page](https://developers.openai.com/community/codex-for-oss) says open-source maintainers can apply for API credits, six months of ChatGPT Pro with Codex, and conditional Codex Security access. It invites core maintainers and maintainers of widely used public projects, while also allowing projects that play an important ecosystem role to explain that role.

At the 2026-08-16 review, the official page did not state a 20-person user-testing minimum or require a detailed participant-evidence package. SpeakRight therefore does not treat either condition as a release or application prerequisite.

Program details and form fields can change. A maintainer should re-open the official page and the linked program terms immediately before submitting. This repository does not restate private form fields or assume acceptance.

## SpeakRight public project facts

| Area | Evidence-backed statement |
| --- | --- |
| Purpose | Open-source pronunciation practice for Chinese-speaking learners, with Chinese learner-facing UI. |
| Public repository | [github.com/zixuanzhou0-ai/speakright](https://github.com/zixuanzhou0-ai/speakright) |
| Runtime surfaces | Windows Desktop at the repository root and a separated Browser Edition under `apps/browser`. |
| Language boundary | `en-US` is the stable baseline; `es-ES`, `fr-FR`, and `ru-RU` are experimental. |
| Scoring boundary | Azure Speech supplies numeric pronunciation evidence; configured LLMs explain evidence downstream. |
| Distribution boundary | Source builds and controlled testing are documented; Windows artifacts remain unsigned unless a later release explicitly says otherwise. |
| Governance | Public contribution, conduct, support, maintainer, privacy, and security documents are linked from the README. |
| User/adoption evidence | The maintainer reports that 20 people tested SpeakRight offline. This statement is not independently audited and does not establish active-user adoption, task success, retention, satisfaction, or learning efficacy. |
| Current candidate | `v1.1.0` Browser Stable and `v1.1.0-desktop-preview.1` remain release candidates until their exact tags, gates, and public Releases exist. |

The source for each product statement is mapped in [`docs/validation/CLAIMS_AND_EVIDENCE.md`](../validation/CLAIMS_AND_EVIDENCE.md).

## Why Codex is relevant

The repository has two runtime surfaces, shared learning logic, multilingual content ledgers, provider integrations, Windows packaging, and a large validation surface. These create maintenance work that benefits from repository-scale inspection, focused implementation, regression tests, documentation/source alignment, and security review.

This readiness pass used Codex to inspect the repository, compare public claims with source and scripts, identify stale repository links, draft bounded documentation, and run review checks. That is maintainer-workflow evidence; it is not a productivity percentage or a user-impact metric.

Potential supported work, if an application is accepted, includes:

- review and triage across desktop/browser parity changes
- focused regression tests for recording, scoring, storage, and provider failures
- source-backed language-content and IPA audits with human review
- documentation, dependency, release, and security-readiness maintenance
- contributor onboarding and issue reproduction without exposing credentials or recordings

These are intended workflows, not promises of a release date, a specific volume of contributions, or a measured productivity gain.

## Pre-submission readiness checklist

- [x] Public canonical repository and English README entry
- [x] Simplified Chinese README for the target learner/contributor community
- [x] Public license plus an explicit third-party media boundary
- [x] Contribution guide, code of conduct, support routing, and issue templates
- [ ] Security and privacy reporting boundaries documented; the repository
      owner must still enable and verify GitHub private vulnerability reporting
      (or publish another verified private contact) before release
- [x] Public maintainer and CODEOWNERS routing
- [x] Documented, versioned documentation, readiness, lint, test, and build commands
- [x] Stable-versus-experimental language boundary
- [x] Claims/evidence map and a privacy-safe maintainer-attestation gate
- [x] Maintainer-reported offline testing documented without participant-level
      proof, personal data, invented study details, or an independently audited
      outcome claim
- [ ] Public unsigned Desktop Preview containing only the bare EXE and
      round-trip-validated NSIS setup, with an explicit SmartScreen warning,
      checksum, SBOM, and validation report
- [ ] Public Browser Stable release, current screenshot matrices, and the
      validated 60–90 second overview demo
- [ ] Public `main`, release tags, repository settings, and signed-out evidence
      links verified against the final release commit

Unchecked items are deliberately not inferred from source activity, automated tests, stars, clones, downloads, or synthetic audio.

## Post-submission tracking

These are outcomes after readiness, not prerequisites for deciding whether the
application package is ready:

- [ ] Program application submitted by an authorized maintainer
- [ ] Program decision received

## Application-data boundary

Keep the private draft in an ignored local location such as `outputs/private/codex-oss-application.md`. Before submission:

1. Confirm the submitter has authority for the repository and any account named in the form.
2. Recheck the official program page and terms.
3. Identify the source class for every number. The offline-testing count is a
   maintainer attestation, not an independently audited metric; omit any detail
   that was not actually supplied.
4. Keep each form answer within the portal's current character limit.
5. Do not include API keys, billing identifiers, private recordings, personal learner data, or confidential security findings.
6. Run `git status --short` and `git check-ignore -v` so the private draft cannot be committed accidentally.
