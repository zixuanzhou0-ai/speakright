# Browser public mirror migration

Status: implementation ready; tracked-file removal intentionally not performed
by the asset-compliance subtask.

## Canonical and generated locations

- Canonical, retained source: `public/`
- Generated Browser mirror: `apps/browser/public/`
- Generator: `scripts/sync-browser-assets.mjs`
- Rights gate: `scripts/asset-rights.mjs check`

The current Browser mirror contains 6,591 tracked duplicates grouped as:

| Generated path to remove from Git tracking | Tracked files |
| --- | ---: |
| `apps/browser/public/audio/**` | 6,249 |
| `apps/browser/public/images/**` | 132 |
| `apps/browser/public/videos/**` | 210 |

Ignored local phoneme teaching videos are also generated from the canonical
root but are not part of the tracked-removal count.

## Safe integration order

1. Preserve the current worktree backup and review the complete deletion diff.
2. Add `node ../../scripts/sync-browser-assets.mjs --write --prune` to Browser
   `predev` and `prebuild` (or invoke the equivalent root command before each
   Browser build).
3. Run `node scripts/asset-rights.mjs check` and a full Browser build from a
   clean copy.
4. Remove only the three generated subtrees above from Git tracking. Do not
   remove the canonical root `public/` tree.
5. Re-run the sync check, Browser build, and Browser E2E suite.

`apps/browser/.gitignore` already ignores the generated `public/` directory.
The sync script refuses any destination other than the exact
`apps/browser/public` path. Stale files are removed only when `--write --prune`
is explicitly supplied.
