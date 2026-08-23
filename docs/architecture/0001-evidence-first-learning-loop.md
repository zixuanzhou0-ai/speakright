# ADR 0001: Evidence-first pronunciation learning loop

Date: 2026-07-13

## Status

Accepted for the SpeakRight vNext upgrade.

## Decision

SpeakRight optimizes for intelligibility, transfer, retention, and learner
self-correction. It does not optimize for accent elimination or a single high
automatic score.

Azure Pronunciation Assessment results are treated as fallible observations.
They may support a learning hypothesis, but a single recording cannot prove a
specific substitution, a persistent learner habit, or mastery. Progression that
claims transfer or retention requires qualified evidence from varied or delayed
tasks.

English (`en-US`) remains the stable baseline. Spanish, French, and Russian
remain experimental and expose stable sound-unit/free-practice capabilities plus
clearly labelled Labs. They do not inherit English-only mastery claims.

The existing teal brand, typography, shadcn components, and desktop navigation
remain the visual baseline. Responsive fixes extend that system instead of
replacing it.

## Quality gates

- Mobile widths must not retain the fixed 260px desktop sidebar.
- Low-quality or unaligned recordings cannot advance learning evidence.
- Locale-specific Azure capabilities are displayed only where supported.
- Raw automatic scores remain traceable and are never rewritten by an LLM.
- New business rules should be shared by desktop and browser implementations.

## Rollback

The pre-upgrade baseline is the annotated tag
`pre-pronunciation-upgrade-2026-07-13`. Recovery must use a new branch from that
tag; failed upgrade branches are not overwritten.
