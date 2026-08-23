# Browser Edition Validation Log

Date: 2026-06-23

## Passed Locally

From `<repository-root>`:

```text
npm run validate:browser
```

Observed results:

- Lint passed: Biome checked 363 files with no fixes applied.
- TypeScript passed.
- Vitest passed: 112 files, 637 tests.
- Next static export passed: 197 static/SSG routes.
- Static browser smoke passed for 9 routes and 2 media assets at
  `http://127.0.0.1:4173`.
- Browser screenshots were captured with empty key fields and stored under
  `docs/assets/screenshots/browser/`:
  - `settings.png`
  - `phoneme-english-scored.png`
  - `free-practice.png`
  - `assessment.png`
  - `phoneme-spanish.png`
  - `phoneme-french.png`
  - `phoneme-russian.png`

Additional local release checks:

```text
npm run docs:check-links
npm run browser:azure-live-log
```

- Markdown relative links passed across the public README/docs set.
- Browser Azure live-check log helper created or verified the ignored private
  `.runlogs/browser-azure-live-check.md` template.
- Browser Azure live-check log helper rejected key-shaped input in notes before
  writing.
- Browser source isolation scan found no Tauri imports, desktop port dependency,
  desktop secure-store dependency, or desktop release-script dependency. The only
  desktop tokens in Browser Edition source are defensive/public-copy references
  such as "Browser Edition does not need EXE/MSI/NSIS" and smoke checks for
  forbidden Tauri markers.
- Text secret scan over Browser Edition source/scripts/docs plus public entry
  docs found no Azure/OpenAI/ElevenLabs/Gemini-style key literals.

Official Microsoft source check:

- Microsoft Learn/API docs confirm Browser JavaScript pronunciation assessment
  uses `PronunciationAssessmentConfig.applyTo(recognizer)`.
- Microsoft Learn/API docs confirm pronunciation scores can be extracted from a
  speech recognition result with `PronunciationAssessmentResult.fromResult` and
  detailed JSON can be read from `SpeechServiceResponse_JsonResult`.
- Azure Speech SDK browser samples confirm `AudioConfig.fromWavFileInput`,
  microphone input, and `recognizeOnceAsync` are supported JavaScript/browser
  SDK surfaces.
- Installed Microsoft Speech SDK 1.50.0 source/types expose sentence prosody
  as a boolean setter, so Browser Edition uses
  `pronunciationConfig.enableProsodyAssessment = isSentence(referenceText)`.

See [Completion Audit](COMPLETION_AUDIT.md) for the requirement-by-requirement
proof map and the remaining release blockers.

## 2026-06-23 Browser Settings And Microphone Tightening

Release tightening checks were run without clearing Browser Edition
`localStorage` or `sessionStorage`.

Commands from `<repository-root>\apps\browser`:

```text
npm.cmd run test -- --run src/__tests__/browser-api-keys-storage.test.ts src/__tests__/settings-api-key-save.test.tsx src/__tests__/use-recorder.test.tsx
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
PORT=4174 npm.cmd run browser:smoke:static
```

Observed results:

- Targeted regression tests passed: 3 files, 25 tests.
- TypeScript passed.
- Biome lint passed: 364 files checked.
- Next static export passed: 197 static/SSG routes.
- Static browser smoke passed for 9 routes and 2 assets at
  `http://127.0.0.1:4174`.
- Playwright light check against the existing validation profile confirmed Azure,
  ElevenLabs, and LLM keys were still present in local browser storage; no secret
  values were read or logged.
- Free practice microphone selector rendered and selected
  `系统默认 - Microphone (NEOM USB)`, not the `EDIFIER M230` endpoint.
- The page did not enter the Error Boundary and did not show React #185.

## 2026-06-23 Follow-Up SDK And Release Gate Rerun

Commands from `<repository-root>`:

```text
npm.cmd run validate:browser
PORT=4174 npm.cmd --prefix apps/browser run browser:smoke:static
npm.cmd run docs:check-links
```

Observed results:

- Browser validation passed: Biome lint, TypeScript, 112 Vitest files / 637
  tests, Next production build, and static smoke.
- Next production build generated 197 static/SSG routes.
- Static browser smoke passed for 9 routes and 2 assets. The default 4173
  validation path was already occupied by an existing local Browser Edition
  service, so the follow-up clean smoke was rerun on `http://127.0.0.1:4174`.
- Markdown relative links passed after the Browser/Desktop separation docs were
  updated.
- Targeted Azure scoring-boundary tests passed after verifying the installed
  Microsoft Speech SDK 1.50.0 `enableProsodyAssessment` boolean setter shape.
- Text secret scan over tracked Browser Edition source, public docs, Browser
  package metadata, and `scripts/browser-azure-live-log.mjs` found no
  Azure/OpenAI/ElevenLabs/Gemini-style key literals.
- `node --check scripts/browser-azure-live-log.mjs` passed, and a temporary
  repo-shaped copy verified that live-log `--record` updates the locale
  checklist row while also appending a sanitized history entry.

## 2026-06-23 Root Lint And Generated Output Exclusion

Commands from `<repository-root>`:

```text
npm.cmd run lint
npm.cmd run docs:check-links
```

Observed results:

- Root Biome lint passed without diagnostics after `biome.json` was tightened to exclude generated and local-only output folders such as `.next`, `out`, `node_modules`, `.runlogs`, `src-tauri/target`, the ignored local `apps/desktop` sandbox, nested Browser app config parsed by its own app-local Biome, and generated IPA audit input JSON files.
- The root lint check now scans the tracked source/docs surface instead of build artifacts, nested app-local tool configs, or generated audit payloads.
- Markdown relative links passed after the lint-scope change.

## 2026-06-23 Goal Continuation Gate Rerun

Commands from `<repository-root>`:

```text
node --check scripts/browser-azure-live-log.mjs
git diff --check
npm.cmd run docs:check-links
npm.cmd run lint
npm.cmd run lint:browser
npm.cmd run typecheck:browser
npm.cmd --prefix apps/browser run test -- --run src/__tests__/azure-scoring-boundary.test.ts src/__tests__/api-client-azure.test.ts
npm.cmd run validate:browser
```

Observed results:

- Live-log helper syntax check passed.
- Diff whitespace check passed; only normal Windows LF-to-CRLF warnings were
  reported.
- Markdown relative links passed.
- Root Biome lint passed: 773 files checked with no diagnostics.
- Browser Biome lint passed: 362 files checked with no diagnostics.
- Browser TypeScript passed.
- Targeted Azure boundary/API tests passed after rerunning outside the sandbox:
  2 files, 17 tests. The first sandboxed attempt was blocked by a Vite startup
  `spawn EPERM`, not by a test failure.
- Full Browser validation passed: Browser lint, TypeScript, 112 Vitest files /
  637 tests, Next production build with 197 static/SSG routes, and static smoke
  for 9 routes plus 2 media assets.
- Static smoke passed against the existing local Browser Edition service at
  `http://127.0.0.1:4173`. A trailing `EADDRINUSE` message was emitted when the
  helper attempted to bind an already occupied 4173 server after the successful
  smoke run; the command still exited successfully.
- Changed-file secret scan passed for the 11 currently modified tracked files.


## 2026-06-23 Partial Azure Live Evidence

The current Playwright MCP browser page at `http://127.0.0.1:4173/sentences?micFix=4`
showed a completed Browser Edition pronunciation result without a smoke-score
query flag:

- Total score: 100
- Word score: `hello` 100
- AI coach feedback rendered: `完美。没有问题。`

This was recorded in the ignored local live-check log as `en-US` pass. No keys,
recordings, account identifiers, raw Azure payloads, or screenshots containing
settings were stored in Git.


## 2026-06-23 Low-Cost Synthetic Azure Live Evidence

Per the updated release-validation plan, the remaining multilingual Azure checks
were run with extremely short ElevenLabs-generated samples instead of repeated
manual microphone recordings. The browser page kept the configured provider keys
in local browser storage; the validation code used the keys in-page and returned
only sanitized result metadata.

Model and cost guard:

- ElevenLabs model: `eleven_flash_v2_5`
- Final multilingual run text budget: 8 characters total (`casa`, `si`, `да`)
- Including two Spanish probes and one UTF-8 header rerun, the whole synthetic
  pass was about 24 short text characters.
- No provider keys, recordings, raw Azure payloads, account IDs, or key-bearing
  screenshots were written to Git.

Ignored live-log results:

| Locale | Text | Azure path | Score | Recognition |
| --- | --- | --- | --- | --- |
| `es-ES` | `casa` | Azure REST pronunciation assessment | 89 | `Casa.` |
| `fr-FR` | `si` | Azure REST pronunciation assessment | 10 | `Si.` |
| `ru-RU` | `да` | Azure REST pronunciation assessment | 100 | `Да.` |

This proves the live provider/key/locale/scoring path for all public languages.
It does not claim that synthetic samples are the same evidence as a human
microphone UX pass.

## Release Notes Caveat

- The Azure live-scoring provider path is now recorded for all four public
  locales: `en-US` via current Browser Edition page evidence, and `es-ES`,
  `fr-FR`, `ru-RU` via low-cost ElevenLabs synthetic audio scored by Azure REST.
- Final GitHub release notes should describe the synthetic checks honestly and
  avoid claiming they replace a human microphone UX pass.
- Follow-up scoring validation was committed and pushed to GitHub `main` as
  `3e900c3 Validate browser Azure scoring release gate`.


## 2026-06-23 Final Synthetic Gate And Browser Validation

After the low-cost synthetic Azure pass and REST parser fallback, final local
Browser gates were rerun from `<repository-root>`:

```text
npm.cmd --prefix apps/browser run test -- --run src/__tests__/azure-speech.test.ts src/__tests__/azure-scoring-boundary.test.ts src/__tests__/api-client-azure.test.ts
npm.cmd run typecheck:browser
npm.cmd run lint:browser
npm.cmd run docs:check-links
npm.cmd run lint
git diff --check
npm.cmd run validate:browser
PORT=4174 npm.cmd --prefix apps/browser run browser:smoke:static
```

Observed results:

- Targeted Azure/parser tests passed: 3 files, 19 tests.
- Browser TypeScript passed.
- Browser Biome lint passed: 363 files checked.
- Root Biome lint passed: 774 files checked.
- Markdown relative links passed.
- Diff whitespace check passed with only normal Windows line-ending warnings.
- Changed-file secret scan passed for 12 modified tracked files.
- Full Browser validation passed: 113 Vitest files / 639 tests, Next production
  build with 197 static/SSG routes, and static smoke for 9 routes plus 2 media
  assets.
- The default 4173 static smoke passed, then emitted the known `EADDRINUSE`
  cleanup noise because an existing local Browser Edition service already owned
  4173. A clean follow-up static smoke on `http://127.0.0.1:4174` passed without
  that port-conflict noise.
## Privacy Notes

- Public screenshot attempts must use a fresh/redacted browser profile, or first
  verify that password inputs are empty before writing image files.
- Release validation that depends on already configured provider keys must not
  clear `localStorage` or `sessionStorage` unless reset/export behavior is the
  explicit scenario.
- Do not store Azure keys, recordings, account IDs, or private validation logs in
  the repository.
