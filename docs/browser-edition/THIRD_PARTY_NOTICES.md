# Browser Edition third-party notices

This document applies the repository-wide media boundary in
`THIRD_PARTY_NOTICES.md` to SpeakRight Browser Edition.

## Runtime providers

| Provider | Browser role |
| --- | --- |
| Azure Speech | User-configured Pronunciation Assessment provider and the only source of numeric pronunciation scores. |
| ElevenLabs | Optional user-configured standard-demonstration TTS provider. |
| MiniMax Speech | Optional user-configured standard-demonstration TTS provider with word-level subtitle timing when returned by the service. |
| Xiaomi MiMo TTS | Optional user-configured standard-demonstration TTS provider; the current integration uses honest sentence-level playback because the API does not return word timing. |
| LLM providers | Optional Chinese coaching explanation generated from Azure evidence; not an independent scoring source. |
| Youdao | Dictionary-pronunciation fallback used when a bundled local word recording is unavailable. |
| Hermes and Vertex AI local bridges | Loopback-only development/local-browser integrations. They are not a capability of a remotely hosted static build. |

Credentialed providers use credentials supplied by the user; Youdao's fallback
does not require a key. Browser Edition has no SpeakRight first-party scoring or
credential service. Keys must not be committed, logged, placed in URLs, or
included in screenshots. Each provider remains governed by its own service
terms and privacy policy.

## Generated packaged-asset mirror

The repository-root `public/` directory is the canonical asset tree.
`apps/browser/public/` is generated from that tree by
`scripts/sync-browser-assets.mjs`; it is not an independent source or rights
record.

The sync runs only after `scripts/asset-rights.mjs check` succeeds. A media
family is eligible for Browser Edition only when its registry record:

- matches the committed tree digest and file count;
- names `browser` in `editions`; and
- has `redistribution` set to `approved` or `restricted-bundle`.

A `reference-only` record is never copied. Missing, modified, unregistered, or
multiply claimed media blocks the build instead of becoming a silent missing
asset or an unsupported redistribution claim.

Only files tracked by Git under the canonical `public/` tree are considered
packaged inputs. Ignored or untracked maintainer-local files cannot satisfy a
rights record and are never copied into Browser Edition. In particular, the
optional Rachel's English phoneme clips are `reference-only`; Browser Edition
uses the official-source fallback card instead of bundling them.

Current Browser asset families include the English IPA audio, generated word
and multilingual audio, Fluent Emoji illustrations, approved articulation and
lesson media, and the SpeakRight-authored poster described in
`docs/assets/asset-rights-registry.json`. Their MIT, Creative Commons,
provider-output, written-permission, and attribution boundaries remain
unchanged by being copied into Browser Edition.

Private authorization documents are retained by the maintainer. Public files
contain only opaque, non-sensitive `evidenceRef` identifiers; a source URL or
platform link by itself is never treated as permission.

## References are not bundled rights

Rachel's English, American IPA Chart, University of Iowa Sounds of Speech,
Seeing Speech, EasyPronunciation, Wiktionary, Forvo, and other phonetics
resources may also be cited as teaching or verification references. Citation
does not grant redistribution rights. Only the exact asset families mapped by
the registry are packaged.

No listed provider, creator, university, dictionary, or platform sponsors or
endorses SpeakRight unless an explicit statement says otherwise.
