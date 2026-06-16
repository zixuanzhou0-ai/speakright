# Desktop Startup Runbook

The canonical startup runbook lives at:

```text
docs/operations/DESKTOP_STARTUP_RUNBOOK.md
```

Use that runbook for release-style startup checks, first-launch degraded-state
QA, and recovery steps when `speakright.exe` is already running.

Start from the current desktop repository and Release EXE:

```bat
cd /d E:\SpeakRightDesktopRepo
git status --short --branch
npm run desktop:preflight
npm run desktop:launch-release
```

Do not use the older `E:\SpeakRight` workspace or a `localhost` browser tab for
release acceptance.
