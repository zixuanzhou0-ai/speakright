# Installation

The canonical guide is `docs/INSTALLATION.md`.

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
Windows artifacts remain controlled-test builds, not stable public downloads.