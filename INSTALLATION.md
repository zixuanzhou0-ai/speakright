# Installation

The canonical installation guide lives at:

```text
docs/INSTALLATION.md
```

Use that guide for controlled-test downloads, source builds, first-launch
expectations, API key privacy, and unsigned Windows artifact warnings.

Release-style acceptance must launch the desktop Release EXE, not a browser
`localhost` tab:

```bat
cd /d E:\SpeakRightDesktopRepo
npm run desktop:preflight
npm run desktop:launch-release
```

The expected Release EXE path is:

```text
E:\SpeakRightDesktopRepo\src-tauri\target\release\speakright.exe
```
