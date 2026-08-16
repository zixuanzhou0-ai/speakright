# Contributing To SpeakRight

Thanks for helping improve SpeakRight. The repository contains a Windows
Desktop app and a deliberately separated Browser Edition. Small correctness
issues in either surface can directly affect a learner's trust, so prefer
focused, well-evidenced changes over broad edits. All project participation
follows `CODE_OF_CONDUCT.md`.

## Repository

Use the canonical repository root:

```bat
cd /d <repository-root>
```

Windows Desktop lives in the repository root under `src` and `src-tauri`.
Browser Edition lives under `apps/browser`. Do not import Tauri or Windows
release behavior into Browser Edition, and do not use a browser localhost tab
as Release EXE evidence.
Use `SUPPORT.md` when you are unsure whether a report belongs in a public issue,
an IPA audit issue, or a private security report.

## Triage Routing

Use the narrowest public or private path for the report:

| Report type | Route |
| --- | --- |
| Download, installer, unsigned Windows artifact, source build, Release EXE startup, or first-launch degraded-state problem | `Installation or startup help` issue template |
| Settings, UI layout, scoring, drill, free practice, or diagnosis bug after the app opens | `Bug report` issue template |
| IPA dispute, pronunciation dispute, or sourced Spanish/French/Russian audit finding | `IPA or pronunciation audit` issue template |
| Missing bundled audio, wrong clickable audio source, loudness mismatch, or any quota-impacting provider work | `Audio gap or provider request` issue template |
| API key, token, private recording, private learning-data export, vulnerability, or unsafe desktop permission | `SECURITY.md` private report |
| Unsure or mixed report | `SUPPORT.md` routing guide |

Do not ask contributors to generate ElevenLabs audio or spend TTS credits in a
public issue unless a maintainer has already approved that exact generation
pass. If bundled audio is missing, document the gap first.

## Development Setup

Install and validate the Windows Desktop workspace:

```bat
npm ci
npm run typecheck
npm run lint
npm run test
```

For Browser Edition work, also install and validate its isolated workspace:

```bat
npm --prefix apps/browser install
npm run lint:browser
npm run typecheck:browser
npm run test:browser
npm run build:browser
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

For Browser Edition changes, run the Browser commands above and the smallest
relevant smoke check. Record the exact browser and localhost/static route used;
do not report it as Desktop acceptance.

## Audio And TTS Boundary

Do not generate ElevenLabs audio or spend TTS credits unless the maintainer has
explicitly approved that exact generation pass. Dry-run audits such as
`npm run audio:parity:dry-run` and `npm run audio:loudness:dry-run` are safe.
Before asking for quota-impacting work, include the latest dry-run result or a
clear reason why dry-run evidence is not applicable, plus the expected
text/audio scope and approval owner.

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
- If an IPA change touches the final learner-facing corpus, update
  `docs/operations/non-english-ipa-reviewed-findings.json` in the same PR and
  keep the ledger verdict/status contract documented in the audit strategy.

## Community And Privacy

Pronunciation review can be personal. Keep feedback about accents and learner
recordings respectful, evidence-based, and scoped to the product issue.

Do not post API keys, raw private recordings, private learning-data exports, or
vulnerability details in public issues or pull requests. Use `SECURITY.md` for
private vulnerability or credential reports. Review `PRIVACY.md` before adding
a new provider, storage key, export field, or recording-retention path.

## Pull Request Checklist

- Explain the user-facing issue and the fix.
- Name the affected edition: Windows Desktop, Browser Edition, or shared logic.
- Mention the languages and pages affected.
- Include tests or explain why tests are not applicable.
- Confirm whether Release EXE smoke was run.
- Confirm no ElevenLabs generation was performed unless explicitly approved.
- Keep public-release claims honest: Windows artifacts remain unsigned until
  code signing is configured.

## Style

Follow existing TypeScript, React, Tauri, and Biome conventions. Avoid unrelated
refactors in release-tightening PRs.
