# SpeakRight Browser And Legacy Web

## Recommended Browser Edition

Use `apps/browser`.

```bat
cd /d <repository-root>
npm --prefix apps/browser install
npm run dev:browser
```

Browser Edition is the cross-platform local browser app. It must not import
Tauri, depend on the desktop port, or use Windows installer scripts.

Validation:

```bat
npm run lint:browser
npm run typecheck:browser
npm run test:browser
npm run build:browser
npm run browser:smoke
```

## Legacy Web Scaffold

No production `apps/web` folder is tracked in the public repository. If a local
checkout still has an ignored `apps/web` directory, treat it as a historical
scaffold only. It is not the recommended Browser Edition entry.

Do not add new Browser Edition work to `apps/web`. Use `apps/browser`, or create
a separately reviewed migration/archival change before touching legacy web
files.

## Browser Rules

- Serve from localhost or HTTPS for microphone permissions.
- API keys are BYOK and session-first. Users may enable local persistence on a
  trusted personal browser; release validation must not clear storage unless the
  test explicitly covers reset/export behavior.
- Free practice includes a microphone selector. On Chrome machines with several
  inputs, choose the intended USB microphone such as
  `系统默认 - Microphone (NEOM USB)` instead of a Bluetooth speaker endpoint.
- Azure Speech provides numeric pronunciation scores.
- LLM providers provide Chinese coaching only.
- Youdao online pronunciation fallback can be affected by network or CORS
  behavior. Bundled local practice audio remains available when the online
  fallback is unavailable.
- English is stable; Spanish, French, and Russian are experimental.
