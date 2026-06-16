# Support

This repository is public source code for the SpeakRight Desktop release
candidate. Please choose the right support path so user data, security reports,
and pronunciation evidence do not end up in the wrong place.

## Before Opening A Public Issue

- Use the Release EXE or installer for user-facing desktop checks. A browser tab
  at `localhost` is not the release app.
- Check `docs/INSTALLATION.md` for Windows installation and unsigned-artifact
  warnings.
- Check `docs/operations/DESKTOP_STARTUP_RUNBOOK.md` when the desktop window
  does not open or an existing `speakright.exe` process blocks a build.
- Check `docs/operations/IPA_DISPLAY_AUDIT_STRATEGY.md` before proposing
  Spanish, French, or Russian IPA changes.

## Public Issues

Use GitHub issues for:

- Download, installer, unsigned Windows artifact, source build, Release EXE
  launch, or first-launch degraded-state problems; use the
  installation/startup issue template.
- Release EXE bugs that do not expose private data.
- UI layout, text wrapping, audio playback, or scoring behavior that can be
  described without attaching private recordings.
- Missing bundled audio, wrong clickable audio sources, loudness mismatches, or
  paid-provider/quota requests that can be described without private data; use
  the audio/provider issue template.
- Feature requests that preserve the experimental-language boundary for
  Spanish, French, and Russian.
- Sourced IPA or pronunciation audit reports that include the required evidence
  and do not change `needs-review` rows by guesswork.

When reporting a user-visible bug, include:

- OS and SpeakRight version or commit.
- Launch path, ideally Release EXE or installer.
- For install/startup reports, include the artifact name or path, whether
  `speakright.exe` was already running, and whether SmartScreen, antivirus, or
  enterprise policy blocked launch.
- Language, page, sound unit, word, phrase, or sentence.
- First-launch or degraded-state context when relevant: API key state, network
  state, microphone permission/device state, and the Settings local-audio state
  such as `缺失或不可读`.
- Exact steps, expected behavior, and actual behavior.
- Screenshots only if they do not show API keys, private user data, or private
  recordings.
- Log excerpts only if they are short and redacted. Remove API keys, bearer
  tokens, private practice text, raw recording references, learning-data export
  contents, and local user-profile paths such as `C:\Users\name`.
- Full diagnostics bundles, raw microphone recordings, and private
  learning-data exports belong in a private security/support channel, not in a
  public issue.

## Private Reports

Do not open a public issue for:

- API keys, tokens, private keys, or leaked credentials.
- Real user recordings or private learning-data exports.
- Vulnerabilities, arbitrary network/file access issues, or unsafe desktop
  permissions.

Follow `SECURITY.md` for these reports.

## IPA And Pronunciation Disputes

Pronunciation review should be respectful and evidence-first. For Spanish,
French, and Russian:

- Keep the language marked experimental unless a separate evidence plan changes
  that status.
- Provide two independent sources, or one primary authority plus one
  dictionary/textbook corroboration, for `update` rows.
- Use `variant-accepted` when the current display is acceptable for a specific
  UI layer or speech style.
- Leave `needs-review` rows unchanged until stronger evidence is available.
- Treat `deck-focus-hint` rows as practice focus cues, not full sentence IPA.

## Audio And Paid Provider Boundary

Use the audio/provider issue template for missing local audio, audio that plays
the wrong source, loudness or clipping mismatches, and requests that would spend
ElevenLabs or another provider quota.

Routine support should not require paid provider calls. Do not ask contributors to generate ElevenLabs audio or spend TTS credits unless a maintainer explicitly approves that exact generation pass.

Dry-run audits such as `npm run audio:parity:dry-run` and
`npm run audio:loudness:dry-run` are safe because they do not generate audio.
