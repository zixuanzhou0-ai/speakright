# Contributing To SpeakRight Desktop

Thanks for helping tighten SpeakRight Desktop. This project is a desktop
pronunciation-training app, so small correctness issues can directly affect a
learner's trust. Please prefer small, well-evidenced changes over broad edits.

## Repository

Use the current desktop repository:

```bat
cd /d E:\SpeakRightDesktopRepo
```

Do not use the older browser workspace for desktop release work.

## Development Setup

```bat
npm ci
npm run typecheck
npm run lint
npm run test
```

For desktop release-style testing, use the Release EXE path:

```bat
npm run desktop:preflight
npm run desktop:launch-release
```

Do not treat a `localhost` browser tab as release acceptance.

## Validation Before A Pull Request

Run the smallest relevant focused tests first, then the standard local gates:

```bat
npm run test
npm run typecheck
npm run lint
npm run build:desktop-frontend
```

For desktop UI, audio, release, or Tauri changes, also run:

```bat
npm run desktop:preflight
npm run desktop:ui-smoke
```

Run `npm run desktop:launch-release` for manual QA from the Release EXE.

## Audio And TTS Boundary

Do not generate ElevenLabs audio or spend TTS credits unless the maintainer has
explicitly approved that exact generation pass. Dry-run audits such as
`npm run audio:parity:dry-run` and `npm run audio:loudness:dry-run` are safe.

If bundled audio is missing, document the gap first. Do not silently replace it
with browser TTS, video audio, proxy rule audio, or an unrelated sample.

## Non-English IPA Policy

Spanish, French, and Russian are experimental. They can provide practice and
feedback, but must not claim formal mastery or `evidenceMastery`.

Use the policy in:

```text
docs/operations/IPA_DISPLAY_AUDIT_STRATEGY.md
```

Only apply IPA edits that have reliable source evidence:

- `update` rows should have two independent sources, or one primary authority
  plus one dictionary/textbook corroboration.
- `variant-accepted` rows should explain the accepted variant and the UI layer
  it belongs to.
- Rows marked `needs-review` should stay unchanged until a stronger source or
  expert review is available.
- `deck-focus-hint` rows are focus cues, not full sentence IPA, unless a later
  sourced audit explicitly promotes them.

## Pull Request Checklist

- Explain the user-facing issue and the fix.
- Mention the languages and pages affected.
- Include tests or explain why tests are not applicable.
- Confirm whether Release EXE smoke was run.
- Confirm no ElevenLabs generation was performed unless explicitly approved.
- Keep public-release claims honest: Windows artifacts remain unsigned until
  code signing is configured.

## Style

Follow existing TypeScript, React, Tauri, and Biome conventions. Avoid unrelated
refactors in release-tightening PRs.
