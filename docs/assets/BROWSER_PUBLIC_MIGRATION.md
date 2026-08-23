# Browser public mirror migration

Status: completed for the tracked Browser mirror.

## Canonical and generated locations

- Canonical tracked package source: Git-tracked files under `public/`
- Generated Browser mirror: `apps/browser/public/`
- Generator: `scripts/sync-browser-assets.mjs`
- Rights gate: `scripts/asset-rights.mjs check`

The former Browser mirror contained 6,591 tracked duplicates grouped as:

| Generated path to remove from Git tracking | Tracked files |
| --- | ---: |
| `apps/browser/public/audio/**` | 6,249 |
| `apps/browser/public/images/**` | 132 |
| `apps/browser/public/videos/**` | 210 |

Those generated Browser paths are no longer tracked. Ignored maintainer-local
phoneme teaching videos are not part of the public package set and are not
copied by Browser sync.

## Ongoing invariant

1. Stage and review every new canonical release asset before refreshing rights
   digests.
2. Browser `predev` and `prebuild` run
   `node ../../scripts/sync-browser-assets.mjs --write --prune`.
3. The rights gate and sync both derive their input from Git-tracked
   `public/` files, then apply the edition and redistribution policy.
4. Run the rights check, sync check, Browser build, and Browser E2E suite from
   a clean checkout before release.

`apps/browser/.gitignore` already ignores the generated `public/` directory.
The sync script refuses any destination other than the exact
`apps/browser/public` path. Stale files are removed only when `--write --prune`
is explicitly supplied.
