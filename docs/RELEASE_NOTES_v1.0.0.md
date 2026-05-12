# SpeakRight Desktop v1.0.0

Release date: 2026-05-13

## Highlights

- First packaged Windows desktop release.
- Desktop build now exports static Next.js assets for Tauri packaging.
- Training-pack dynamic routes are pre-generated for all 10 core courses.
- Pronunciation diagnosis includes issue evidence and training prescription.
- Deliberate practice includes deep course runner, remediation, mastery tracking, and review queue.
- Training memory panel shows active weaknesses, review rhythm, and recent target-score trends.

## Installers

- `SpeakRight_1.0.0_x64-setup.exe`
- `SpeakRight_1.0.0_x64_en-US.msi`

## Verification

Validated before release:

```powershell
npm exec tsc -- --noEmit
npm run build:desktop-frontend
npm run build
```

The Tauri build produced both NSIS and MSI bundles successfully.

## Known Notes

- The Windows installer is not code-signed yet.
- Users must configure their own Azure, ElevenLabs, and LLM API keys in Settings.
- The current product scope is American English for Chinese learners.
- Phase 1 uses local storage; no cloud account sync is included.
