---
name: Installation or startup help
about: Report download, build, unsigned Windows artifact, or Release EXE startup problems
title: "[Install]: "
labels: install, startup
assignees: ""
---

## Summary

What failed during download, installation, source build, or first launch?

## Launch Path

- [ ] Downloaded installer or Release EXE
- [ ] Built from source
- [ ] Existing local Release EXE
- [ ] Unsure

If built from source, include the exact command:

```text
npm run desktop:build
```

## Environment

- Windows version:
- SpeakRight version, commit, or release artifact name:
- Artifact path, if relevant:
- Was there already a running `speakright.exe` process? yes / no / unknown
- Did Windows SmartScreen, antivirus, or enterprise policy block the app? yes / no / unknown

## First-Launch State

Please include only what is relevant:

- API keys configured: none / partial / all required for this flow / unknown
- Network state: online / offline / proxy or VPN / unknown
- Microphone permission/device: allowed / denied / missing / busy / unknown
- Settings local-audio state: available / checking / 缺失或不可读 / unknown
- Did the UI show a Chinese inline error or warning? If yes, paste the exact text.

## Expected Behavior

What should have happened?

## Actual Behavior

What happened instead?

## Evidence

Use Release EXE or installer evidence when reporting user-facing startup behavior.
A localhost/dev-server tab is not release acceptance.

Keep evidence minimal and redacted. Do not attach API keys, bearer tokens, raw
microphone recordings, private practice text, learning-data exports, or full
diagnostics bundles to a public issue. Redact local user-profile paths such as
`C:\Users\name` from screenshots and logs.

## Checks

- [ ] I used the Release EXE or installer for user-facing startup evidence.
- [ ] I did not include API keys, recordings, diagnostic bundles, or private user data.
- [ ] This does not require new ElevenLabs generation or paid-provider calls.
- [ ] Spanish, French, and Russian remain experimental; this report does not claim formal mastery or `evidenceMastery`.
