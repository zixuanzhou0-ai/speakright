# SpeakRight Desktop Multilingual Phase 1

This phase restarts multilingual support without adding Japanese.

## Scope

| Language | Status | Azure locale | Training entry | Evidence mastery |
| --- | --- | --- | --- | --- |
| `en-US` | Active baseline | `en-US` | Open | Open |
| `es-ES` | Experimental seed | `es-ES` | Preparation gate only | Locked |
| `fr-FR` | Planned seed | `fr-FR` | Preparation gate only | Locked |
| `ru-RU` | Planned seed | `ru-RU` | Preparation gate only | Locked |

`ja-JP` is intentionally out of scope for this round.

## Capability Rules

English remains the only evidence-driven language. A non-English language cannot
enter formal training or update mastery until a live Azure capability probe
confirms all of these signals:

- scripted pronunciation assessment works for the locale
- word-level alignment is stable
- target segment or phoneme-level scoring is available and mappable
- low-quality recordings can be rejected before mastery updates
- spontaneous transcription can be scored without treating thin evidence as mastery

Current non-English profiles deliberately set `evidenceMasteryAllowed=false`.
The UI must show a preparation gate if a user navigates directly to a training
route such as `/drill/prosody` while a non-English language is selected.

## Data Isolation

English keeps legacy storage keys for backward compatibility. Non-English
learning data uses language-scoped keys:

```text
speakright_mastery_profile_v2:es-ES
speakright_training_sessions_v2:fr-FR
speakright_score_history:ru-RU
```

The scoped set includes diagnosis reports, mastery, sessions, review queues,
practice history, score history, usage, benchmark metadata, and coverage
benchmarks. Benchmark audio blobs live in IndexedDB and are referenced by
language-tagged metadata.

API keys are not language-scoped learning data. They remain desktop secrets and
must not appear in Git, local data exports, diagnostics bundles, or logs.

## Phase 1 Completion Bar

The phase is considered internally testable when:

- English regression tests and desktop smoke pass.
- Settings can select `en-US`, `es-ES`, `fr-FR`, and `ru-RU`.
- `es-ES` displays experimental content and a preparation path.
- `fr-FR` and `ru-RU` remain locked until capability probes pass.
- Direct drill subroutes are gated for languages whose training readiness is false.
- Data export includes learning data and benchmark metadata without API keys.
