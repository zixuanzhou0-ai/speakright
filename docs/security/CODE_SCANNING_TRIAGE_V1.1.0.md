# SpeakRight v1.1.0 code-scanning triage

Updated: 2026-08-23

Owner: [`@zixuanzhou0-ai`](https://github.com/zixuanzhou0-ai)

Status: **public static-analysis triage for the v1.1.0 candidate; not a claim
that a release has been published or that every future revision is safe**

## Scope and method

GitHub CodeQL reported 65 open alerts on public merge commit
`feb455dc86fd717fb5f55a064d2a752c3173067e`: 36 high-severity alerts and 29
medium-severity alerts. This document records the source-level review of those
alerts by finding family rather than treating a scanner label or a dismissal
state as proof.

The review checked each family's data source, sink, call site, runtime boundary,
release reachability, and existing user-facing disclosure. The disposition
**not actionable in the v1.1.0 release boundary** means that the reported path
does not cross the documented trust boundary in the reviewed revision. It does
not mean the pattern is universally safe. Any change to the referenced data
flow, packaging boundary, WebView navigation policy, local-server exposure, or
supported platform requires a new review.

GitHub dismissal metadata is administrative state only. The evidence and
reasoning below remain the basis for the disposition.

## Alert-family results

| Alerts | Severity | Reported family and reviewed boundary | Disposition and evidence |
| --- | --- | --- | --- |
| `#1-2` | Medium | Stack-trace exposure in loopback-only review servers used by maintainer evidence tooling. | Not actionable in the shipped Browser or Desktop app. These servers are local review utilities, are not packaged, and do not expose the trace through a public production endpoint. Re-review if a server becomes remotely reachable or distributable. |
| `#3` | Medium | Code/string sanitization in a local release-selection utility. | Not actionable. The selector values are repository-controlled constants and output is serialized with `JSON.stringify`; no untrusted string reaches an executable sink in the reviewed flow. Re-review if selectors accept network or user-provided input. |
| `#4-7` | High | Diagnosis-report records persisted on the learner's device. | Intentional local product behavior, not a credential or recording leak. The stored records contain structured scores and practice prescriptions, not API keys or raw audio. `PRIVACY.md` discloses local learning-data storage and the application provides a local-data reset path. Re-review if reports gain raw audio, credentials, remote synchronization, or cross-user storage. |
| `#8-10` | High | Desktop source paths that include browser-development credential fallbacks. | Not actionable in the published boundaries. Packaged Desktop uses the Tauri credential layer. Browser Edition has a separate adapter at `apps/browser/src/lib/api-keys.ts`, defaults to session-scoped storage, and requires an explicit opt-in for persistent local storage. Non-secret preferences use the ordinary settings store. Re-review if Desktop can run without the secure layer or Browser persistence becomes implicit. |
| `#11` | High | Entity decoding in an offline documentation/evidence transformation. | Not actionable. Decoded text is handled as data and has no HTML, script, shell, template, or other executable sink in the reviewed flow. Re-review if decoded output is rendered as trusted HTML or executed. |
| `#12-16` | High | Markdown-table formatting of repository and maintainer-controlled values. | Not actionable as a security sanitizer finding. The formatter escapes Markdown table delimiters and writes documentation; it is not used to sanitize untrusted HTML or code for execution. Re-review if input becomes untrusted and output is rendered with raw HTML enabled. |
| `#17-31` | High | File-system check/use races in local maintainer, evidence, and build scripts. | Not actionable across the v1.1.0 application trust boundary. The scripts run under one maintainer/runner privilege boundary and are not application features. Alert `#17` additionally uses a random temporary directory and an authenticated loopback session for the Hermes bridge. Re-review before any script is exposed as a shared service, runs against attacker-writable paths, or crosses privilege boundaries. |
| `#32-40` | Medium | Audio or text sent to configured cloud providers by validation/generation utilities. | Intentional, explicit maintainer operation rather than an implicit application exfiltration path. The utilities require provider configuration and are not included in the published runtime. Production user data flows remain governed by `PRIVACY.md`. Re-review if any utility becomes an automatic release step with real learner data. |
| `#41-48` | High | Regular-expression findings in test code and deterministic fixtures. | Test-only; not reachable from either published edition. Keep test fixtures free of real credentials and learner data. Re-review if the helper is moved into production code. |
| `#49-65` | Medium | Fixed-destination downloads and generation in maintainer-only asset scripts. | Not actionable in the shipped runtime. Destinations are repository-controlled maintenance paths, not user-selected production paths, and the scripts are not packaged. Re-review if destinations become remotely supplied, user-controlled, or privileged. |

The ranges above account for all 65 alerts exactly. No CodeQL alert in this
snapshot was found to demonstrate a confirmed cross-boundary vulnerability in
the Browser Stable or Windows Desktop Preview candidate. That conclusion is
limited to the reviewed commit and must be checked again on the final release
commit.

## Dependency hardening

The v1.1.0 candidate lockfile has been advanced as defense in depth:

| Dependency | Previous resolution | Candidate resolution | Rationale |
| --- | --- | --- | --- |
| Tauri | `2.10.3` | `2.11.1` | Includes the upstream fix for [GHSA-7gmj-67g7-phm9](https://github.com/advisories/GHSA-7gmj-67g7-phm9), an origin-confusion advisory affecting Windows/Android IPC boundaries. SpeakRight does not intentionally load remote pages in its WebView, uses the system opener for external links, and keeps `frame-src` disabled, but the boundary is upgraded rather than relying only on current reachability. |
| `@tauri-apps/api` / CLI | `2.10.x` | API `2.11.1`; CLI `2.11.x` | Keeps the JavaScript API and build CLI on the same Tauri major/minor line as the fixed Rust runtime; the isolated Desktop evidence build rejects a mismatched line. |
| `serde_with` | `3.18.x` | `3.22.0` | Removes [GHSA-7gcf-g7xr-8hxj](https://github.com/advisories/GHSA-7gcf-g7xr-8hxj) from the resolved candidate graph. SpeakRight does not use the affected `KeyValueMap` API directly. |
| `rand` | `0.8.5`, `0.9.2` | `0.8.6`, `0.9.3` | Applies the available patch releases for [GHSA-cq8v-f236-94qc](https://github.com/advisories/GHSA-cq8v-f236-94qc) in the directly updatable branches. |

These lockfile updates are not considered release-validated until the final
candidate passes locked Cargo check/test, RustSec audit, SBOM generation, the
Windows Desktop build/smoke/installer chain, and hosted dependency review.

### Tauri 2.11 NSIS template review

The installer round-trip has an explicit Tauri CLI version guard. Before
advancing it from `2.10.1` to `2.11.4`, the official templates at commits
[`9b17a7ae`](https://github.com/tauri-apps/tauri/blob/9b17a7aeae9a83222ffe829aa4e2d8a5ba6bed8c/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi)
and
[`8909f221`](https://github.com/tauri-apps/tauri/blob/8909f221d1515955fc843808032bdc5d62209c96/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi)
were compared using the
[official repository diff](https://github.com/tauri-apps/tauri/compare/9b17a7aeae9a83222ffe829aa4e2d8a5ba6bed8c...8909f221d1515955fc843808032bdc5d62209c96).

For SpeakRight's default `currentUser` install with no custom NSIS template,
hooks, or start-menu folder, the changes are limited to a verified signed-plugin
search directory, optional uninstaller branding, clearer build failures, and a
minimum-WebView-version configuration fallback that SpeakRight does not set.
The install scope, UAC level, same-user process handling, registry keys,
shortcuts, silent arguments, `WriteUninstaller`, and uninstall cleanup remain
unchanged. The guarded 18-test contract and a real NSIS install/start/exit/
uninstall round trip both passed after the review.

## Time-bounded transitive exceptions

No critical or high-severity dependency exception is accepted for v1.1.0. Two
lower-severity transitive findings cannot be removed from the current Windows
candidate without replacing or upgrading a wider build/platform chain:

| Dependency | Reachability evidence | Narrow acceptance |
| --- | --- | --- |
| [`rand 0.7.3`](https://github.com/advisories/GHSA-cq8v-f236-94qc) | Build-only chain: `phf_generator 0.8` -> `phf_codegen` -> `selectors` -> `kuchikiki` -> `tauri-utils`. It is not SpeakRight runtime randomness or an authentication primitive. | Review by `@zixuanzhou0-ai` no later than **2026-11-30**, and earlier if Tauri removes the chain, the advisory severity changes, or the package becomes runtime-reachable. |
| [`glib 0.18.5`](https://github.com/advisories/GHSA-wrw7-89jp-8q8g) | Linux-only GTK/WebKit dependency. `cargo tree --target x86_64-pc-windows-msvc -i glib@0.18.5` has no result; v1.1.0 publishes no Linux Desktop artifact. | Review by `@zixuanzhou0-ai` no later than **2026-11-30**, and before enabling any Linux Desktop build, support claim, CI target, or release artifact. |

The final dependency-review record should link this section when applying a
documented `tolerable_risk` disposition. If either package enters the supported
Windows runtime graph, gains a high/critical advisory, or no longer satisfies
the evidence above, the exception expires immediately and blocks release.

## Final release requirements

Before either v1.1.0 tag is created:

- rerun CodeQL on the exact final commit and investigate every new or changed
  alert rather than copying this disposition mechanically;
- run locked Cargo check/test, RustSec audit, Cargo SBOM generation, Windows
  production build, smoke, and installer round-trip validation;
- verify there are zero open critical alerts and no unreviewed open high alerts
  in production dependencies or code scanning;
- attach evidence-specific comments when administratively resolving scanner
  alerts, using `used in tests` only for `#41-48` and a family-specific rationale
  for all other alerts; and
- keep the Browser Stable and unsigned Windows Desktop Preview release claims
  separate, including the existing SmartScreen warning for the preview.
