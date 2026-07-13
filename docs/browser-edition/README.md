# SpeakRight Browser Edition Plan

This folder is the execution guide for turning the old browser prototype into a
real Browser Edition that matches the current Windows Desktop release without
mixing platform-specific code.

## Goal

Build a browser-runnable, open-source SpeakRight edition for Windows, macOS, and
Linux users who do not want or cannot run the Windows installer.

The Browser Edition is not a SaaS product. It should be a local/static browser
app that users can run from source or from exported files served on localhost or
HTTPS. Users bring their own provider keys. The project must not introduce a
hosted account system, hosted scoring backend, or hidden cloud storage unless a
future maintainer explicitly chooses that as a separate product.

## Source Of Truth

The feature source is the latest settled Windows Desktop app:

```text
<repository-root>
```

The browser implementation target is this repository, under a clearly separated
browser app folder:

```text
<repository-root>\apps\browser
```

The existing old web app can be used as a seed:

```text
<repository-root>\apps\web
```

Do not treat the old web app as feature-complete. It is a scaffold and asset
source only. The current feature behavior, UI polish, scoring boundary, release
evidence, multilingual behavior, and documentation tone come from the latest
desktop repository.

## Required Final Repository Shape

The finished open-source repository should make platform ownership obvious:

```text
apps/
  desktop/            Windows Desktop app. Tauri-only code is allowed here.
  browser/            Browser Edition app. No Tauri imports are allowed here.
packages/
  shared/             Optional pure shared code only: data, types, scoring
                      helpers, non-platform UI primitives, tests.
docs/
  browser-edition/    Browser Edition plan, architecture, validation, release.
  assets/             Screenshots used by README and release notes.
```

`apps/web` should not remain as an ambiguous production entry. During migration
it may exist as a temporary legacy seed, but the final README must explain its
status or remove it after the Browser Edition is stable.

## Non-Negotiable Boundaries

- Desktop and Browser Edition must live in separate app folders.
- Browser code must not import from desktop-only Tauri modules.
- Desktop code must not depend on Browser Edition runtime assumptions.
- Any shared package must be platform-neutral and must not hide Tauri/browser
  branching behind vague helpers.
- Numeric pronunciation scores must come from Azure Speech Pronunciation
  Assessment, not from LLM-generated guesses.
- LLM feedback is downstream coaching only. It may explain, summarize, and
  suggest practice from Azure evidence; it must never overwrite score numbers.
- Browser Edition must have its own smoke tests and release checklist.
- GitHub README and release notes must tell users exactly which folder and
  command belong to each edition.

## Browser Edition Scope

The Browser Edition should sync the current desktop user-facing feature set as
closely as browser constraints allow.

| Area | Browser Edition target |
| --- | --- |
| Language support | English stable baseline; Spanish, French, Russian experimental sound-unit/free-practice parity with desktop. |
| Sound practice | Language-specific list, teaching media, local demos, recording, Azure score summary, detailed analysis, Chinese coaching. |
| Free practice | Text input, standard audio when available, browser recording, Azure scoring, AI coach feedback. |
| English advanced drills | Word, sentence, contrast, perception/prosody/scenario/spontaneous routes where current desktop supports them. |
| Assessment | English diagnosis parity first; non-English diagnosis remains experimental/gated exactly like desktop. |
| Progress | Local browser storage only unless a future backend is explicitly introduced. |
| Settings | Browser-safe key storage with clear BYOK warnings and no committed credentials. |
| Media | Bundled/local public assets where legally allowed; missing media must show honest fallback UI. |

## Current and Historical Documents

- [Architecture And Separation](ARCHITECTURE_AND_SEPARATION.md): folder rules,
  allowed imports, platform adapters, storage, provider boundaries.
- [Implementation Plan](../archive/2026-06-browser-edition/IMPLEMENTATION_PLAN.md): staged migration plan from old
  web scaffold to current Browser Edition.
- [Validation And Release](VALIDATION_AND_RELEASE.md): commands, smoke tests,
  screenshots, GitHub README/release expectations.
- [Completion Audit](../archive/2026-06-browser-edition/COMPLETION_AUDIT.md): current proof map and remaining
  blockers for final release.
- [Release Notes](RELEASE_NOTES.md): Browser Edition release scope,
  validation status, and known limitations.
- [Third-Party Notices](THIRD_PARTY_NOTICES.md): API providers, bundled asset
  boundaries, and reference-source credits.
- [Next Browser Edition Goals](../archive/2026-06-browser-edition/NEXT_BROWSER_EDITION_GOALS.md):
  long-running `/goal` prompt for Codex execution.

## Recommended Execution Order

1. Freeze the latest Windows Desktop source state and record the commit SHA.
2. Create `apps/browser` as a clean Browser Edition app.
3. Move only browser-safe scaffold/assets from `apps/web`.
4. Port current desktop features into Browser Edition through explicit browser
   adapters.
5. Prove Azure scoring in browser with real pronunciation assessment.
6. Add browser smoke tests for settings, recording, scoring, multilingual pages,
   route coverage, and static export.
7. Update README, docs, screenshots, credits, release notes, and GitHub labels.
8. Remove or clearly archive ambiguous legacy folders.

## Done Means

Browser Edition is done only when a new user can clone the repository, choose
the Browser Edition path from the README, run the documented command, open the
app in a browser, configure provider keys, record pronunciation, receive a real
Azure score for the selected language, read Chinese feedback based on that score,
and understand from GitHub docs how this differs from the Windows Desktop app.
