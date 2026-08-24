# Changelog

This changelog records user- and contributor-visible changes from the point it was introduced. Earlier history is available through Git tags and commit history; it is not reconstructed here from memory.

## 1.1.0

Released: **2026-08-24** from
`61c506af5c1f0b9b8397c74f69470c0da1e9f382`.

Public release pages:

- [Browser Stable `v1.1.0`](https://github.com/zixuanzhou0-ai/speakright/releases/tag/v1.1.0)
- [Unsigned Desktop Preview `v1.1.0-desktop-preview.1`](https://github.com/zixuanzhou0-ai/speakright/releases/tag/v1.1.0-desktop-preview.1)
- [Post-publication verification record](docs/validation/V1.1.0_RELEASE_VERIFICATION.md)

Both Release objects, tag identities, workflow runs, exact asset sets,
checksums, and signed-out URLs were verified; see the linked record.

### Practice and feedback

- Added guided-repeat intensity modes that keep the full word set, phase-safe
  replay/repeat/finish controls, and an exit summary that does not equate
  practice completion with mastery.
- Kept ElevenLabs word-timed highlighting and added honest sentence-level
  playback feedback for Hermes/xAI and Vertex AI when word timing is absent.
- Hardened free-practice recording, assessment, playback, replay, provider
  switching, and session restoration against stale requests and callbacks.
- Kept diagnosis baseline scores limited to independent first attempts; samples
  recorded after a demonstration remain available for comparison but are not
  counted as independent evidence.
- Fixed long-text, replay-control, scroll, reduced-motion, repeated-word, and
  narrow-viewport layout behavior across Desktop and Browser Edition.

### Privacy, security, and release integrity

- Added a first-use cloud-processing disclosure, a public privacy document, and
  local-data export/deletion controls for browser storage, IndexedDB caches,
  desktop settings, and optional credential deletion.
- Isolated desktop validation credentials, settings, logs, and WebView data in
  one-run temporary sandboxes; invalid overrides fail closed.
- Added versioned Browser Stable and unsigned Desktop Preview release metadata,
  dependency/security workflows, SBOM and checksum generation, fixture guards,
  and tag/commit/artifact integrity checks.
- Limited public Desktop Preview binaries to the bare Release EXE and the NSIS
  setup bound to install/start/exit/uninstall round-trip evidence. MSI remains a
  local metadata-smoke input and is not published for v1.1.0.
- Updated Next.js to 16.3.1 and resolved current production npm audit findings.

### Open-source and media governance

- Restored a standard MIT root license and separated third-party media notices
  from the source-code license.
- Added a SHA-256-bound media-rights registry and per-file attribution checks;
  private permission records stay outside Git and appear only as opaque
  evidence references.
- Made root `public/` the canonical media tree; Browser media is generated and
  checked from that source instead of storing a second tracked copy.
- Added an English-first README with a Simplified Chinese entry, five-minute
  Browser start, versioned Browser/Desktop screenshot and 60–90 second demo
  entry points, current governance/security/privacy documents,
  application-readiness evidence, and a bounded maintainer-reported offline
  testing attestation without participant data or audited adoption/outcome
  claims. Current source-bound release media passed its artifact contract and
  maintainer visual review. The tag workflows independently verify the exact
  commit, gates, and staged artifacts before creating a GitHub Release.

## Historical releases

The repository contains historical tags including `v1.0.0`, `v1.0.1`, and `v1.0.1-rc.20260619`. Those tags predate this systematic changelog. Consult each tag and its release notes for its exact contents; the current working tree must not be described solely from the package version.
