# Installation Guide

## Unsigned Community Preview Boundary

SpeakRight may publish a Windows package only as an explicitly labelled
**unsigned community preview**. It is not the signed Desktop Stable channel.
Use only the filename named by the current GitHub pre-release, verify its
published SHA-256 checksum, and read the release-specific validation report.

An installer is valid only when its release notes name it and its checksum,
SBOM, commit, and validation evidence match the artifact being evaluated.

The community-preview build is not code-signed. Windows SmartScreen may warn or
block it. Never bypass antivirus or organization policy; build from source or
wait for a future signed Desktop Stable release if an unsigned executable is
not acceptable. Published assets can lag behind `main`, so treat the release
tag and release notes—not the working branch—as the artifact source of truth.

The planned v1.1.0 preview asset set contains one installer: the versioned NSIS
setup that passed the automated install/start/exit/uninstall round-trip. It also
contains the bare Release EXE for transparent inspection and portable
evaluation. Exact checksums are populated by the release. Expected binary names
are:

```text
SpeakRight_1.1.0_x64-setup.exe
```

```text
speakright.exe
```

The Tauri build may also produce an MSI, and local CI may inspect its metadata.
That MSI has not passed the real installation round-trip used for the preview,
so it is intentionally excluded from the v1.1.0 release report, staging
directory, checksum manifest, and GitHub pre-release assets. Do not redistribute
it as an official v1.1.0 preview installer.

## Install on Windows

1. Once published, run the `SpeakRight_1.1.0_x64-setup.exe` NSIS installer.
2. If Windows SmartScreen appears, stop and confirm this is the expected
   unsigned community-preview build from the project GitHub pre-release before choosing any
   bypass option on a personal/test machine where policy permits it. Do not
   bypass antivirus or enterprise policy on managed devices; record the exact
   blocker in an installation/startup issue instead.
3. Launch SpeakRight.
4. Open **Settings** and configure API keys.

## Build From Source

Use this path when you are testing a source checkout instead of a downloaded
installer. Run it from the current desktop repository only:

```bat
cd /d <repository-root>
npm ci
npm run desktop:build
npm run desktop:preflight
npm run desktop:launch-release
```

The Release EXE should open from:

```text
<repository-root>\src-tauri\target\release\speakright.exe
```

Do not use a browser `localhost` tab as release acceptance. `npm run
desktop:dev` is for code debugging only.

If you run `npm run build:desktop-frontend` or change UI/source files after a
Release EXE was built, rebuild the desktop package before validation:
`npm run desktop:build`. The preflight and launch scripts reject a Release EXE
that is older than the static export in `out/`, so an old executable cannot be
used as a substitute for the current source tree.

## Required Configuration

SpeakRight can open without API keys, but scoring and AI feedback require external services.

### Azure Speech

Used for pronunciation assessment.

Required values:

- Azure Speech key
- Azure region

### ElevenLabs

Used for standard pronunciation demos and read-along audio that are not already
covered by bundled local resources.

Required value:

- ElevenLabs API key

English word-card audio is bundled in the desktop app under `audio/words` and
uses the online dictionary only as a fallback. Spanish, French, and Russian
word/phrase audio is already bundled in the desktop app. Users do not install
language audio packs separately.

Spanish, French, and Russian are bundled at the current 24-item-per-sound-unit
learning-density target with two local voice variants per item. The parity
dry-run is still useful as a zero-cost audit: it does not call ElevenLabs and
should report no missing language-pack audio.

Release validation is intentionally conservative with ElevenLabs credits:
normal validation checks the usage endpoint only and does not generate fresh
audio. Free-form read-along TTS can still use ElevenLabs after the user enters a
key, but bundled word and language-pack audio should work without spending
additional ElevenLabs credits.

### LLM Provider

Used for Chinese AI coach feedback.

Supported desktop providers are the preset providers shown in Settings:
Claude, GPT, Gemini-compatible, DeepSeek, Qwen, GLM, Kimi, and Doubao.
Custom endpoints are disabled in the desktop build until their domains are added
to the Tauri allowlist and CSP.

Required values:

- Provider
- API key
- Model
- Base URL is managed by the selected preset provider in the desktop build

## Local Data

This release stores user data locally. API keys are stored through the desktop
credential store where supported; learning data stays local to the app.

- usage tracking
- pronunciation history
- diagnosis results
- training mastery profile
- training sessions and review queue

No cloud backend is required for this release.
If local storage is full or blocked, pronunciation scoring should still show the
current result. Phoneme detail, free practice, and drill practice surfaces show a
Chinese warning if the local score trend, practice history, or transfer evidence
for that attempt could not be saved.

## First Launch Expectations

The desktop app should open even when no API keys have been configured yet.
Settings should show the missing-key state instead of blocking startup.

If the network is unavailable, local pages and bundled audio should still load
where the desktop bundle includes the relevant assets. Azure scoring, AI coach
feedback, online dictionary fallback, and non-bundled TTS should show
actionable Chinese network/provider messages rather than raw English exceptions
or silent loading states.

If microphone permission is denied, the microphone is missing, or another app is
using the device, recording controls should show an inline Chinese recovery
message and should not leave the learner stuck in a recording/scoring state.

If bundled local audio is missing or unreadable, Settings should say that the
app did not read the bundled demo audio and should offer a reinstall or Release
EXE feedback hint. Practice pages should avoid pretending that browser TTS,
teaching-video audio, proxy rule audio, or unrelated samples are verified local
single-sound audio.

Installation verification should not generate ElevenLabs audio or spend TTS
credits. Use the dry-run audio audits when you need to inspect bundled audio
coverage.

## v1.1.0 Desktop Preview status

`v1.1.0-desktop-preview.1` is an unsigned community-preview track, not Desktop
Stable. The release workflow may publish only:

- the bare Release EXE after the production-fixture guard and desktop smoke
- the NSIS setup whose installed EXE matches that Release EXE by byte count and
  SHA-256 and whose install/start/exit/uninstall round trip passes
- checksums, SBOMs, the versioned validation report, and the NSIS round-trip
  report

The locally generated MSI is still checked for metadata consistency, but it is
not part of the v1.1.0 public report, checksum set, workflow artifact, or GitHub
Pre-release. Do not imply that MSI completed the NSIS round trip.

The final v1.1.0 result belongs in the current release-candidate validation
record, not in the archived June audit. Files under
`docs/archive/2026-06-desktop-release/` remain historical evidence only and
must not be quoted as current test totals.

Before publishing the preview, all source, dependency, asset-rights, desktop
build, Release EXE smoke, NSIS round-trip, report, and preview-gate checks must
pass from the same clean commit. The round-trip script refuses to mutate a
machine that already has SpeakRight registration, shortcuts, startup entries,
default install directories, or a running `speakright.exe`; it does not stop a
user process for you. Test credentials, WebView data, logs, and settings are
isolated under a one-run temporary sandbox and removed after the run.

Recommended developer launch order for release-style testing:

```bat
cd /d <repository-root>
npm run desktop:preflight
npm run desktop:launch-release
```

If `desktop:preflight` reports that `speakright.exe` is already running, close
the app window first. The preflight command is intentionally non-destructive and
does not stop the process for you.
`desktop:launch-release` has the same non-destructive duplicate-process guard:
it refuses to open another Release EXE, prints the running PID list, and leaves
the existing SpeakRight window untouched.
On a normal launch it prints the Release EXE path, the child process PID, and a
reminder that the command does not start localhost or the Next dev server.
If the static export in `out/` is newer than the Release EXE, both
`desktop:preflight` and `desktop:launch-release` stop with a clear message to
run `npm run desktop:build` first.

## Troubleshooting

For developer startup issues, especially `localhost refused`, first check
`docs/archive/2026-06-desktop-release/DESKTOP_STARTUP_RUNBOOK.md` and confirm you are using
`<repository-root>`. For release-style testing, use
`npm run desktop:launch-release` or `npm run desktop:run-release`; do not treat a
browser `localhost` tab as the desktop app.

For automated release-window smoke, run:

```bat
npm run desktop:ui-smoke
```

The UI smoke opens the Release EXE, checks key pages, verifies the runtime is
not `localhost`, and does not record audio or call ElevenLabs TTS.

If `npm run desktop:build` fails with a Rust/LLVM out-of-memory error on a
Windows workstation, retry the same command after closing other memory-heavy
apps. The project build wrapper already defaults `CARGO_BUILD_JOBS=1` on
Windows; advanced users can override that environment variable explicitly when a
larger CI runner can tolerate more parallel Rust jobs.

If recording does not work:

- Read the in-app Chinese error message first. It distinguishes denied
  permission, missing microphone, device-busy startup failure, unsupported
  recorder runtime, and generic startup failure.
- The first-run checklist also shows a Chinese microphone-check hint for
  unsupported desktop microphone access, denied permission, low input signal,
  or a sample that was too short to trust.
- Check Windows microphone permission and confirm SpeakRight is allowed to use
  the microphone.
- If the device is busy, close other apps that may be using the microphone.
- Restart SpeakRight after changing microphone permissions or reconnecting the
  microphone.

If pronunciation scoring fails:

- Read the in-app Chinese error message first. It distinguishes missing speech,
  invalid key/region, unreachable network/proxy, timeout, quota/rate-limit, and
  temporary Azure service failure.
- If a Settings test button fails, the status line should keep the same
  actionable Chinese reason instead of a generic "network error" or raw English
  exception.
- Confirm Azure key and region match the same Azure Speech resource.
- Confirm network access and proxy/firewall settings.
- Try a short word first.

If AI coach feedback fails:

- Read the in-app Chinese error message first. It distinguishes missing LLM
  key, desktop endpoint policy blocks, invalid key/provider/model, unreachable
  network/proxy, timeout, quota/rate-limit, and temporary provider failure.
- The Settings test button preserves actionable Chinese provider errors and
  keeps long messages wrap-ready in narrow windows.
- Confirm the selected provider, model, and API key match the same provider.
- For desktop builds, custom arbitrary LLM domains are blocked until the domain
  is added to the Tauri allowlist and CSP.
- Scoring can still work without AI coach feedback because Azure Speech provides
  the numeric assessment.

If TTS fails:

- Read the in-app Chinese error message first. It distinguishes missing
  ElevenLabs configuration, invalid key, unavailable voice/model, network/proxy
  failure, timeout, quota/rate-limit, service failure, and too-long text.
- The Settings test button preserves actionable Chinese provider errors; raw
  English fetch exceptions are replaced with a Chinese network/proxy hint.
- Confirm ElevenLabs key.
- Check quota/usage in Settings.
- Confirm the installed desktop build includes `audio/words` and
  `audio/language-packs` assets.
- Try a short bundled word before testing a long free-form sentence.
- Online dictionary fallback for English words can fail separately; when it
  does, bundled local word audio and bundled language-pack audio are still the
  first-choice resources.
