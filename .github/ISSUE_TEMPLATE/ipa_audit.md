---
name: IPA or pronunciation audit
about: Report a sourced IPA, pronunciation, audio, or scoring-alignment issue
title: "[IPA]: "
labels: ipa-audit
assignees: ""
---

## Language

- [ ] Spanish `es-ES`
- [ ] French `fr-FR`
- [ ] Russian `ru-RU`
- [ ] English `en-US`

## Affected Item

- Unit slug:
- Word, phrase, or sentence:
- Audit role, if copied from `non-english-ipa-audit-input.json`:
  - [ ] `ipa-transcription`
  - [ ] `deck-focus-hint`
- Current IPA:
- Proposed IPA:

## Source Evidence

Please provide two independent source URLs for `update` rows, or one primary
authority plus one dictionary/textbook corroboration. If you cannot source the
change to that level, choose `needs-review` instead of guessing.

1.
2.

## Suggested Verdict

- [ ] `update`
- [ ] `variant-accepted`
- [ ] `needs-review`

## Notes

Explain whether this is a dictionary/phoneme layer issue, a connected-speech
issue, or a training-realization issue.

For `variant-accepted`, name the accepted variant, the UI layer it belongs to,
and the source that makes the current learner-facing display acceptable.

For `deck-focus-hint`, explain whether the hint is misleading as a focus cue;
do not treat it as a full sentence IPA unless a later sourced audit explicitly
promotes it.
