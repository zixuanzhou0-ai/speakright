# Next Chat Handoff

Date: 2026-07-13
Workspace: this repository root
Branch: `codex/pronunciation-learning-upgrade`
Safe rollback tag: `pre-pronunciation-upgrade-2026-07-13`

## Current objective

Implement the evidence-first SpeakRight vNext plan. English is the stable
baseline. Spanish, French, and Russian expose stable core practice plus clearly
labelled Labs. Japanese is out of scope.

## Product invariants

- Optimize for intelligibility, transfer, retention, and self-correction, not
  accent elimination.
- Azure results are noisy observations. A single recording cannot establish a
  substitution, lasting habit, or mastery.
- Keep raw observations, possible causes, and learning-stage evidence separate.
- Do not use overall word or pronunciation scores as target-phoneme evidence.
- Non-English locales must not expose en-US-only phoneme or prosody semantics.
- LLM coaching cannot invent or overwrite numeric provider observations.
- Do not generate paid TTS, upload recordings, or install dependencies without
  the required user approval.

## Current implementation

- Responsive desktop/mobile shell and mobile drawer navigation.
- `LearningEvidenceV3`, legacy read migration, evidence-stage summaries, and
  target-alignment boundaries.
- Evidence-aware diagnosis and structured LLM coaching.
- One-action training home, evidence-ladder progress, simplified settings, and
  explicit experimental-language capability policy.
- High-risk English content corrections and source/review metadata.
- Initial shared core for evidence, languages, training boundaries, and content.

## Required release work

1. Keep root and browser lint, typecheck, tests, and builds green.
2. Add Playwright responsive/audio/evidence flows only after install approval.
3. Run static browser smoke and desktop frontend/adapter checks.
4. Review staged diffs and run secret/path scans before each commit.
5. Treat the human calibration study in `docs/calibration-protocol.md` as an
   external evidence requirement; never fabricate participant results.

## Canonical documents

- `docs/PRD.md`
- `docs/architecture/0001-evidence-first-learning-loop.md`
- `docs/pronunciation-content-policy.md`
- `docs/calibration-protocol.md`

Historical browser and release documents describe earlier repository states and
must not override these current documents.