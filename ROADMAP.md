# Roadmap

This roadmap describes direction, not a release promise. Priorities may change after source review, provider changes, security findings, or real learner feedback. Dates are intentionally omitted until maintainers can support them.

## Current focus

- Keep American English (`en-US`) as the evidence-backed stable baseline.
- Keep Spanish (`es-ES`), French (`fr-FR`), and Russian (`ru-RU`) visibly experimental until language-specific evidence gates exist.
- Maintain clear separation between Windows Desktop and Browser Edition while sharing only platform-neutral logic deliberately.
- Preserve the scoring boundary: Azure supplies numeric pronunciation evidence; LLMs explain evidence but do not invent scores.
- Make privacy, third-party asset provenance, security reporting, and release limitations reviewable from the public repository.

## Next evidence milestones

- Collect consented usability feedback and publish only anonymized aggregates with denominators, dates, tasks, and limitations.
- Complete signed Windows release readiness before describing an installer as a stable public download.
- Strengthen browser and desktop parity checks for recording, TTS, scoring, storage failure, and offline/degraded states.
- Add language-specific review gates before promoting any experimental module or mastery claim.
- Continue source-backed IPA and bundled-audio audits without spending provider quota unless a maintainer approves the exact run.

## Longer-term possibilities

- Contributor-friendly language review packs with reproducible evidence ledgers.
- More accessible keyboard, screen-reader, caption, and reduced-motion flows.
- Safer optional provider adapters that keep credentials out of browser-visible code where possible.
- Reproducible learning studies, if maintainers can establish consent, privacy, methodology, and enough real observations.

## Explicit non-commitments

- No public user, download, institution, or learning-outcome target is claimed here.
- No date is promised for code signing, hosted service, mobile apps, or promotion of experimental languages.
- A passing automated test, synthetic-audio provider check, GitHub star, clone, or download is not a learner-success metric.

See [`docs/validation/README.md`](docs/validation/README.md) for evidence classes and [`docs/validation/USER_TESTING_SUMMARY.md`](docs/validation/USER_TESTING_SUMMARY.md) for the privacy-safe maintainer attestation and its claim limits.
