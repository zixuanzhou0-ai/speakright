# Browser Edition Validation And Release Checklist

This checklist defines the acceptance bar for the Browser Edition and the GitHub
documentation update.

## Validation Philosophy

The Browser Edition must be validated as a browser app, not as a desktop app in
a browser-shaped window. The Windows Desktop app remains validated through the
Release EXE gate in `<repository-root>`. Browser Edition needs its own
browser gate.

## Required Command Gates

Exact script names may change during implementation, but the final repository
must expose equivalent commands from the root or document app-local commands.

Browser Edition:

```bat
cd /d <repository-root>
npm run validate:browser
npm run docs:check-links
```

`validate:browser` runs Browser Edition lint, typecheck, tests, production
build, static export, and static browser smoke. `docs:check-links` verifies
public README/docs relative links and screenshot paths.

Desktop comparison gate:

```bat
cd /d <repository-root>
npm run validate:desktop
```

Do not require `validate:desktop` for every browser-only code change after the
split is complete, but use it before public docs claim parity with the latest
desktop release.

## Real Azure Scoring Gate

The Browser Edition cannot be considered complete until a real Azure scoring
pass has been recorded for browser runtime.

Minimum live checks:

| Language | Locale | Required proof |
| --- | --- | --- |
| English | `en-US` | One word or sentence score from browser recording. |
| Spanish | `es-ES` | One sound-unit/free-practice score from browser recording. |
| French | `fr-FR` | One sound-unit/free-practice score from browser recording. |
| Russian | `ru-RU` | One sound-unit/free-practice score from browser recording. |

The proof can be stored in a private/local validation log if it contains account
or environment details. Public docs should summarize pass/fail without exposing
keys, recordings, or user-specific paths.

Live-check procedure:

1. Serve Browser Edition from localhost or HTTPS, not `file://`.
2. Use the current release-validation browser profile when preserving configured
   provider keys is part of the test. Do not clear `localStorage` or
   `sessionStorage` unless reset/export behavior is the explicit scenario.
3. Configure Azure Speech Subscription Key and Region in Settings.
4. Keep API key persistence in session mode unless local persistence is being
   explicitly tested.
5. On machines with multiple audio inputs, open free practice and confirm the
   microphone selector is using the intended device, for example
   `系统默认 - Microphone (NEOM USB)`, before recording.
6. For each language, select a visible sound unit or free-practice prompt,
   record a fresh microphone sample, and confirm that total score plus detail
   scores render from Azure.
7. Record only locale, route, pass/fail, timestamp, and sanitized error text.
   Do not store keys, recordings, account identifiers, screenshots containing
   keys, or full raw Azure payloads in the public repository.


Synthetic low-cost fallback:

When repeated manual microphone samples are impractical, a release engineer may
run a clearly labeled synthetic-audio Azure gate:

1. Use already configured Browser Edition BYOK credentials in the active browser
   profile; do not print, screenshot, or write provider keys.
2. Generate only tiny ElevenLabs samples with the configured low-cost model,
   preferably `eleven_flash_v2_5`.
3. Keep the total text budget small and record it, for example `casa`, `si`, and
   `да` for 8 final characters across Spanish/French/Russian.
4. Convert generated audio to Azure-compatible WAV and send it to Azure Speech
   Pronunciation Assessment with the matching locale.
5. Record only sanitized locale, route, pass/fail, score, timestamp, recognized
   display text, model family, and text-character budget in the ignored live log.
6. Public docs must label this as synthetic-audio provider validation, not as a
   human microphone UX pass.

Use the local ignored log helper for this private evidence:

```bat
cd /d <repository-root>
npm run browser:azure-live-log
npm run browser:azure-live-log -- --record --locale en-US --route /phonemes/ee --status pass --score 86 --notes "fresh browser microphone recording rendered Azure scores"
```

The helper writes to `.runlogs/browser-azure-live-check.md`, which is ignored by
Git. It rejects obvious key/token-shaped input so provider secrets are not
accidentally written to the repository.

## Browser Smoke Coverage

Automated smoke should open the Browser Edition and verify:

- app shell loads without Tauri globals
- Settings opens and shows Browser Edition key-storage copy
- microphone permission flow can be reached
- free practice microphone selector renders and can target the intended USB input
- English phoneme detail route opens
- Spanish, French, and Russian sound-unit pages open
- free practice route opens
- English assessment route opens or correctly explains requirements
- score summary layout renders from a guarded smoke fixture
- AI coach panel can render fixture feedback without pretending it is scoring
- missing keys show Chinese guidance
- static asset URLs resolve
- no route depends on `localhost:3002` or desktop-only runtime

Manual QA should additionally record at least one real sample and verify that
the result is Azure-derived.

## Visual QA

Capture Browser Edition screenshots after the final smoke passes.

Required screenshots:

- Browser Settings
- English sound practice after score
- Free practice
- English assessment or diagnosis
- Spanish sound-unit page
- French sound-unit page
- Russian sound-unit page

Store final public screenshots under:

```text
docs/assets/screenshots/browser/
```

Keep desktop screenshots under their own path, for example:

```text
docs/assets/screenshots/desktop/
```

Do not mix desktop and browser screenshots in one unlabeled table.

## GitHub README Requirements

The final README must include:

- a short product description
- two clear entry choices:
  - Windows Desktop
  - Browser Edition
- folder map:
  - repository root / `src` / `src-tauri` for the current Windows Desktop app
  - `apps/desktop` only after a validated physical desktop-folder migration
  - `apps/browser`
  - optional `packages/shared`
- install/run commands for each edition
- screenshots labeled by edition
- language support table
- API/provider table
- scoring boundary: Azure scores, LLM feedback only
- privacy/storage notes
- current limitations
- credits and third-party notices

## GitHub Release Requirements

Release notes must have separate sections:

```text
Windows Desktop
Browser Edition
Validation
Known Limitations
Credits
```

Windows Desktop notes must not call unsigned artifacts stable or signed. For
v1.1.0 they must name the bare EXE and round-trip-validated NSIS as the only
published desktop binaries and state that MSI is not a release asset. Browser
Edition notes must not imply users can open `file://` and expect microphone
access to work. Recommend localhost or HTTPS.

## Cleanup Gate

Before final commit/push:

1. Run `git status --short --branch`.
2. Review every untracked file.
3. Remove obsolete docs only after confirming no README/link references remain.
4. Do not commit build outputs unless the release plan explicitly requires a
   static artifact.
5. Do not commit provider keys, recordings, private logs, local credential
   stores, EXE/MSI/NSIS artifacts, or generated temp screenshots.
6. Run a markdown link check or manually verify all new doc links.
7. Run a secret scan over staged changes.

## Final Acceptance

Browser Edition is releasable when:

- a clean clone can run Browser Edition from documented commands
- users can distinguish Browser Edition from Windows Desktop immediately
- recording and Azure scoring work in browser runtime
- LLM cannot fabricate numeric pronunciation scores
- English, Spanish, French, and Russian boundaries match desktop docs
- screenshots are current and labeled
- README, release notes, and credits are updated
- no ambiguous old web/desktop paths remain unexplained
