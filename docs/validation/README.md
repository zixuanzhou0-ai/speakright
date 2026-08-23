# Validation And Evidence

Updated: 2026-08-16

SpeakRight uses separate evidence layers. A result from one layer must not be promoted into a stronger claim from another layer.

## Evidence layers

| Layer | What it can show | What it cannot show |
| --- | --- | --- |
| Static and repository checks | files exist, links resolve, code follows lint/type rules, tests pass against defined fixtures | that a real learner completed a task or improved |
| Runtime smoke and visual checks | routes open, controls render, packaged/static runtimes satisfy scripted assertions | provider quality, broad hardware compatibility, or real-user usability |
| Live provider checks | a configured provider returned a response for a recorded test case | learning efficacy, human microphone UX when synthetic audio was used, or provider-wide reliability |
| Maintainer attestation | the narrow fact and aggregate count directly reported by the maintainer | independent verification, participant attributes, task success, adoption, satisfaction, retention, or learning efficacy |
| Consented user testing | observed behavior for the documented participants, tasks, devices, and study window | universal outcomes, causal learning effects without a suitable study, or populations not sampled |

## Core local checks

Run from the repository root:

```bat
npm run docs:check-links
npx vitest run src/__tests__/open-source-readiness.test.ts
npm run lint
```

The broader source gates are:

```bat
npm run typecheck
npm run test
npm run build:desktop-frontend
npm run lint:browser
npm run typecheck:browser
npm run test:browser
npm run build:browser
```

Desktop release acceptance and Browser Edition smoke have additional commands in [`README.md`](../../README.md). Some checks require Windows packaging, an already built artifact, microphone permission, or deliberately configured external providers. A local pass in a dirty shared worktree is a development snapshot; merged CI or a release evidence record is the stronger source.

## Provider and paid-work boundary

Routine documentation and repository checks must not generate TTS or spend provider quota. A live Azure, TTS, LLM, or dictionary check must be explicit about:

- provider and model/service
- locale and input type
- whether audio is human-recorded, synthetic, or a fixture
- date, command, and environment boundary
- billing/quota impact
- redactions and private evidence kept outside the repository

Synthetic audio can validate a provider integration but cannot stand in for a human microphone usability test.

## Public claims

Use [`CLAIMS_AND_EVIDENCE.md`](CLAIMS_AND_EVIDENCE.md) before changing README, release, application, or marketing language. If the evidence does not support a number or maturity claim, lower the claim or leave it out.

The project's narrow maintainer attestation and its claim limits are published in [`USER_TESTING_SUMMARY.md`](USER_TESTING_SUMMARY.md). The reported offline count is not independently audited and must not be converted into an active-user, task-success, satisfaction, retention, or learning-outcome metric. Publishing a more detailed aggregate study is optional and is not a release or application prerequisite. Repository activity, automated test cases, contributors, stars, clones, release downloads, and provider calls are not interchangeable with people who tested the product.

The current v1.1.0 source, runtime, CI, and owner-controlled gate ledger is
[`V1.1.0_RELEASE_CANDIDATE.md`](V1.1.0_RELEASE_CANDIDATE.md). It remains a
candidate record until every applicable item is tied to the final commit.
