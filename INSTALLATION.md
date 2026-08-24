# Installation

The canonical guide is [`docs/INSTALLATION.md`](docs/INSTALLATION.md).

## Release downloads

Both v1.1.0 release pages and their assets were publicly verified on 2026-08-24:

- [Browser Stable `v1.1.0`](https://github.com/zixuanzhou0-ai/speakright/releases/tag/v1.1.0)
- [Unsigned Windows Desktop Preview `v1.1.0-desktop-preview.1`](https://github.com/zixuanzhou0-ai/speakright/releases/tag/v1.1.0-desktop-preview.1)

The
[release-verification record](docs/validation/V1.1.0_RELEASE_VERIFICATION.md)
contains the exact Release IDs, tag commit, asset metadata, checksum results,
and signed-out access results. The Browser ZIP must be served from localhost or
HTTPS after extraction. The Windows preview is unsigned and may trigger
SmartScreen; it is not Desktop Stable.

Before using any downloaded asset, download `SHA256SUMS.txt` from the same
Release, calculate the file's SHA-256 locally, and compare the complete digest.
Do not use an asset if its name or digest is absent from the manifest.

From the repository root, install the locked dependencies and validate the
frontend before producing a desktop artifact:

```bat
npm ci
npm run lint
npm run typecheck
npm run test
npm run desktop:build
npm run desktop:preflight
npm run desktop:launch-release
```

Release-style desktop acceptance uses the built Release EXE. Browser and mobile
width acceptance uses the Browser Edition static smoke and E2E gates. Do not
commit API keys, recordings, calibration data, or local user paths. Unsigned
Windows artifacts remain community-preview builds, not stable public downloads.
