# SpeakRight vNext Product Requirements

Status: implementation baseline
Last reviewed: 2026-07-13

## Product outcome

SpeakRight helps adult Chinese-speaking learners become easier to understand.
The product optimizes for perceptual discrimination, controllable articulation,
transfer to untrained speech, delayed retention, and self-correction. It does
not optimize for eliminating an accent or maximizing one provider score.

## Primary learning loop

1. Establish recording quality and a baseline.
2. Discriminate the target contrast with varied speakers and contexts.
3. Apply one minimal articulation cue.
4. Produce controlled syllables, words, contrasts, and short sentences.
5. Review raw observations and an uncertainty-aware next action.
6. Vary speaker, position, neighboring sounds, and speed.
7. Test transfer on untrained material.
8. Retest after 1, 7, and 21 days.

## Evidence contract

- Provider scores are observations from a noisy instrument, not ground truth.
- A single recording cannot establish mastery, a lasting habit, or a specific
  substitution.
- Observations, possible causes, and learning evidence are stored separately.
- Promotion requires usable recording quality, target alignment, enough
  samples and contexts, and the matching locale capability.
- Historical evidence keeps the calibration version that produced it.
- LLM coaching may explain evidence but may not rewrite numeric observations.

## Product boundaries

- English (en-US) is the stable evidence baseline.
- Spanish, French, and Russian expose stable core practice plus explicit Labs.
- Labs do not claim English-equivalent phoneme diagnosis or formal mastery.
- Japanese, accounts, cloud sync, social, and payment systems are out of scope.
- Windows desktop remains primary; browser and phone-width layouts must still
  complete the core flow.

## Experience requirements

- The training home has one primary action: start today's training.
- A new learner can begin effective practice within three clicks.
- Mobile content uses the full viewport after closing navigation.
- Every empty and error state offers a recoverable next action.
- Basic settings are separated from service connections, data/privacy, and Labs.
- Reduced motion, keyboard navigation, 200% zoom, and 360-1920 px layouts are
  release requirements.

## Release evidence

Release gates cover lint, type checking, unit and contract tests, production
