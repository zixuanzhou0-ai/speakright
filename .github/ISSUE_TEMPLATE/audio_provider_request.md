---
name: Audio gap or provider request
about: Report missing bundled audio, audio-policy drift, or a paid-provider need
title: "[Audio]: "
labels: audio, provider-review
assignees: ""
---

## Request Type

- [ ] Missing bundled local audio
- [ ] Audio plays the wrong source or should be non-clickable
- [ ] Loudness or clipping mismatch
- [ ] Paid provider or quota-impacting request

## Affected Area

- Language: English / Spanish / French / Russian
- Page or flow:
- Sound unit, word, phrase, or sentence:
- Expected local source, if known:
- Actual source or behavior:

## Evidence

Describe what you checked from the Release EXE or installer. For audio policy
issues, note whether the speaker used bundled local audio, browser TTS, proxy
audio, teaching-video audio, or no clickable audio.

Do not attach API keys, raw private recordings, or private learning-data
exports.

## Provider Or Quota Impact

Routine support should not require paid provider calls. If this request needs
ElevenLabs or another paid provider, explain:

- Why bundled local audio or a dry-run audit is insufficient:
- Estimated text/character/audio scope:
- Whether maintainer approval has already been granted:

## Checks

- [ ] I tested or inspected the issue from the Release EXE or installer when it
      affects user-facing desktop behavior.
- [ ] I am not asking contributors to generate ElevenLabs audio or spend TTS
      credits without explicit maintainer approval.
- [ ] Spanish, French, and Russian remain experimental; this request does not
      claim formal mastery or `evidenceMastery`.
