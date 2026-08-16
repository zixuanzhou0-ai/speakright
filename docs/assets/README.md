# Asset rights registry

`public/` is SpeakRight's canonical packaged-asset tree. Browser Edition uses a
generated mirror at `apps/browser/public/`; that mirror is not an independent
source of truth.

The registry stores one `AssetRightsRecord` per media family. `path` is a POSIX
glob relative to `public/`. `sha256` is a deterministic tree digest over every
matching file, ordered by relative path:

```text
SHA256("speakright-asset-rights-v1\0" +
       path + "\0" + raw_file_bytes + "\0" + ...)
```

This commits the complete membership, names, and bytes of the family without
duplicating the same legal metadata thousands of times. Removing, adding,
renaming, or modifying a file changes the digest.

When a family uses `sourceDetailsPath`, `sourceDetailsSha256` also commits the
exact source-detail document bytes. A strict `asset-file-rights-v1` manifest
additionally maps every matching packaged file to its `localFile`, source page,
creator or attribution, license, and SHA-256. The validator compares each
per-file hash to the packaged bytes. Removing an entry or changing its source,
attribution, license, or digest therefore fails the release gate.

The Russian Wikimedia Commons audio uses this strict contract in
`public/videos/language-assets/ru-RU/russian-local-pronunciation-assets.manifest.json`.
Private authorization text stays outside the repository; only opaque evidence
references belong in the public registry.

Public `evidenceRef` values are opaque identifiers. Private permission emails,
contracts, receipts, and account records must never be copied into this
directory.

Commands:

```powershell
node scripts/asset-rights.mjs check
node scripts/asset-rights.mjs update
node scripts/sync-browser-assets.mjs --check
node scripts/sync-browser-assets.mjs --write
```

`update` is intentional code generation after a reviewed asset or source-detail
change; it is not a way to approve unknown media. Update legal metadata first,
review the manifest and registry diff, then refresh the digests. Browser sync
validates rights before copying. Stale files are removed only with the explicit
`--prune` flag.
