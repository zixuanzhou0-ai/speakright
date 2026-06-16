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

For missing or unreadable local audio, include:

- Settings language-pack state: available / checking / 缺失或不可读 / unknown
- Network state during the check: online / offline / proxy or VPN / unknown
- API key state for the affected provider: not configured / configured / unknown
- Whether the UI stayed non-clickable instead of substituting browser TTS,
  teaching-video audio, proxy audio, or an unrelated word/sample:

Keep evidence minimal and redacted. Do not attach API keys, bearer tokens, raw
private recordings, private practice text, learning-data exports, or full
diagnostic bundles to a public issue. Redact local user-profile paths such as
`C:\Users\name` from screenshots and log excerpts.

## Provider Or Quota Impact

Routine support should not require paid provider calls. If this request needs
ElevenLabs or another paid provider, explain:

- Why bundled local audio or a dry-run audit is insufficient:
- Latest zero-generation audit run, if relevant:
  `npm run audio:parity:dry-run` / `npm run audio:loudness:dry-run` / not applicable
- Dry-run report path or summary, if available:
- Estimated text/character/audio scope:
- Whether maintainer approval has already been granted:

## Checks

- [ ] I tested or inspected the issue from the Release EXE or installer when it
      affects user-facing desktop behavior.
- [ ] I am not asking contributors to generate ElevenLabs audio or spend TTS
      credits without explicit maintainer approval.
- [ ] If this could spend provider quota, I included a dry-run result or explained
      why a dry-run is not applicable, plus the expected text/audio scope.
- [ ] Spanish, French, and Russian remain experimental; this request does not
      claim formal mastery or `evidenceMastery`.
