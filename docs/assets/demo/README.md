# SpeakRight v1.1.0 release media

This directory contains repeatable public-review media. It must not contain
real API keys, account identifiers, private recordings, user research data, or
live provider results.

## Evidence boundary

- Capture runs only against a build compiled with
  `NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES=1`.
- Both capture scripts prove that the compile-time-only score fixture is
  available before writing evidence.
- Browser capture blocks requests to every origin other than its loopback
  static server.
- Desktop capture admits only the fixed Tauri internal application origins to
  its internal-evidence allowlist. It records normalized internal responses
  only from `Network.responseReceived`, records external attempts separately,
  and fails capture if any external response succeeds.
- HTTPS and loopback provider targets are actively blocked during capture;
  fixture CSP, native HTTP, and Rust provider guards remain independent
  fail-closed boundaries.
- Example score views visibly show:
  `示例数据 / Example data — not a live Azure score`.
- The demo has no audio stream or music. English captions are burned into each
  frame and are also available as SRT and WebVTT files.

Never publish the fixture-enabled Browser or Desktop build itself. Rebuild the
publishable edition with fixtures disabled after capture.

## Capture workflow

Browser evidence requires the fixture-only static build and a local static
server. The build workspace is a sibling of the repository, so root TypeScript
and release outputs never scan or overwrite it:

```powershell
node scripts/build-browser-release-evidence.mjs
node scripts/serve-release-evidence-static.mjs --port 4273
node scripts/capture-browser-release-evidence.mjs --base-url http://127.0.0.1:4273
node scripts/release-evidence.contract.mjs --browser-artifacts
```

Desktop evidence uses a separate source workspace, Cargo target, Tauri store,
OS credential namespace, and WebView2 profile. The capture script verifies the
fixture EXE hash and refuses a normal Desktop executable:

```powershell
node scripts/build-desktop-release-evidence.mjs
node scripts/capture-desktop-release-evidence.mjs
```

Create the silent 60–90 second overview and validate all generated files:

```powershell
node scripts/build-release-demo.mjs
node scripts/release-evidence.contract.mjs --artifacts
```

## Recommended public references

These references passed
`node scripts/release-evidence.contract.mjs --artifacts` against source commit
`5fd93297ddc55c97a6c78b4568d6435411be2369` and completed maintainer visual
review on 2026-08-23. They remain candidate evidence; this statement does not
mean the GitHub tags or Releases already exist.

- [Key Browser screenshots](../screenshots/release/v1.1.0/browser/1280x800/)
- [390 × 844 Browser screenshots](../screenshots/release/v1.1.0/browser/390x844/)
- [360 × 800 Browser screenshots](../screenshots/release/v1.1.0/browser/360x800/)
- [1280 × 920 Desktop screenshots](../screenshots/release/v1.1.0/desktop/1280x920/)
- [1024 × 800 Desktop screenshots](../screenshots/release/v1.1.0/desktop/1024x800/)
- [Silent overview video](speakright-v1.1.0-overview.mp4)
- [English SRT captions](speakright-v1.1.0-overview.en.srt)
- [English WebVTT captions](speakright-v1.1.0-overview.en.vtt)
