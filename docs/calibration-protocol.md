# Pronunciation Assessment Calibration Protocol

Status: protocol ready; human data collection not yet performed
Last reviewed: 2026-07-13

## Purpose

Calibrate task- and sound-group-specific decision boundaries without treating
one global Azure score as a scientific standard.

## Minimum sample

- At least 20 adult Chinese-speaking learners who give explicit consent.
- At least three microphone/environment classes.
- All ten English training packs.
- Trained words, untrained words, sentences, and guided expression.
- Two independent human reviewers per sample.

## Human annotations

Each reviewer records:

- recording quality: unusable, limited, usable;
- intelligibility: 1-5;
- whether the target contrast is perceptually maintained;
- whether the target token is alignable;
- optional suspected cause, explicitly marked as a hypothesis;
- reviewer confidence and adjudication notes.

Reviewers must not see each other's labels during independent review. Conflicts
are adjudicated after inter-rater agreement is computed.

## Data handling

- Store consent records separately from recordings.
- Replace names with random participant IDs.
- Do not commit recordings, transcripts tied to identity, consent forms,
  credentials, or reviewer exports to Git.
- Keep the local `calibration-data/` directory ignored.
- Record deletion and withdrawal procedures before recruitment.
- Publish only aggregated, non-identifying results.

## Analysis

1. Stratify by task type, training pack, recording quality, and environment.
2. Compare provider observations with human intelligibility and contrast labels.
3. Report false promotion and false remediation rates, not only correlation.
4. Reject thresholds that depend on unusable or unaligned samples.
5. Prefer conservative low-confidence states when sample coverage is sparse.
6. Validate selected boundaries on held-out participants and untrained material.

## Versioning

Every released boundary has an immutable `calibrationVersion` and records:

- sample manifest hash;
- task and sound-group scope;
- locale and provider configuration;
- decision rule;
- validation metrics and confidence interval;
