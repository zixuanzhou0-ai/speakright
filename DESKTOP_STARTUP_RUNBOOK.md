# Desktop Startup Runbook

The previous 2026-06 runbook is archived at
`docs/archive/2026-06-desktop-release/DESKTOP_STARTUP_RUNBOOK.md`.

Current acceptance starts from the repository root:

```bat
git status --short --branch
npm run desktop:preflight
npm run desktop:launch-release
```

Use `npm run desktop:dev` only for debugging. The desktop release path must not
depend on a localhost tab. Current branch and rollback details live in
`docs/operations/NEXT_CHAT_HANDOFF.md`.