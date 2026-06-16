# Issue Routing

Use this guide before choosing a public GitHub issue template. If a report
includes credentials, private recordings, exported learning data, or a security
vulnerability, do not open a public issue; follow `SECURITY.md` instead.

| Report type | Use this path |
| --- | --- |
| Download, installer, unsigned Windows artifact, source build, Release EXE launch, or first-launch degraded state | `Installation or startup help` |
| UI layout, Settings, scoring, drill, free practice, or assessment behavior after the app opens | `Bug report` |
| Missing bundled audio, wrong clickable audio source, loudness/clipping mismatch, or provider/quota-impacting work | `Audio gap or provider request` |
| Spanish, French, Russian, or English IPA/pronunciation dispute with sources | `IPA or pronunciation audit` |
| Product, language-learning, or desktop workflow improvement | `Feature request` |
| Vulnerability, leaked API key, private recording, local-data export, unsafe desktop permission, or arbitrary file/network access | `SECURITY.md` private report |
| Unsure where it belongs | `SUPPORT.md` |

Public issue reports should use evidence from the Release EXE or installer when
they describe user-facing desktop behavior. A localhost/dev-server tab is not
release acceptance.

Keep public evidence minimal and redacted. Before posting screenshots or log
excerpts, remove API keys, bearer tokens, private practice text, local
user-profile paths such as `C:\Users\name`, and any learning-data export
contents. Full diagnostics bundles and raw microphone recordings belong in a
private report, not a public issue.

Do not ask contributors to generate ElevenLabs audio or spend TTS credits unless
a maintainer explicitly approves that exact generation pass. Use
`audio:parity:dry-run` and `audio:loudness:dry-run` for zero-generation audio
audits.

Spanish, French, and Russian remain experimental modules. Public issues and pull
requests must not claim formal mastery or `evidenceMastery` for those languages.
