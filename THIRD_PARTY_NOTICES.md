# Third-party notices and media boundary

The MIT License in `LICENSE` covers SpeakRight source code and source-code
documentation. It does not relicense bundled third-party audio, images, video,
provider output, trademarks, or educational media.

The release source of truth is
`docs/assets/asset-rights-registry.json`. Each packaged media family has a
deterministic SHA-256 tree digest, attribution, redistribution status, and a
non-sensitive `evidenceRef`. Private emails, contracts, receipts, and account
records are retained by the maintainer and are intentionally not committed.

## Bundled media

| Source family | Bundled use | Rights boundary / attribution |
| --- | --- | --- |
| American IPA Chart / americanipachart.com | English IPA chart sounds | Bundled under the maintainer's recorded redistribution permission. The three `cup` replacements are separately attributed below. |
| Wikimedia Commons | Selected English and Russian IPA recordings | Distributed under the per-file Creative Commons terms and attribution recorded in the source manifests and registry. |
| ElevenLabs generated output | English word audio and Spanish, French, and Russian language packs | Generated through the maintainer's account. Redistribution authority is recorded by the non-public evidence referenced in the registry; the audio is not MIT-licensed. |
| Microsoft Fluent Emoji | IPA and example-word illustrations | Microsoft Fluent Emoji assets are licensed under MIT; source: https://github.com/microsoft/fluentui-emoji. The required copyright and license notice is included at `LICENSES/MICROSOFT-FLUENT-EMOJI-MIT.txt`. |
| Rachel's English | Optional maintainer-local English pronunciation teaching videos and public source reference | The 40 local clips are excluded from tracked Browser and Desktop release assets. When a local clip is unavailable, SpeakRight links to the official Rachel's English site; the videos are not MIT-licensed. |
| University of Iowa Sounds of Speech Spanish | Spanish articulation and example clips | Bundled within the separately recorded written permission boundary. Preserve source attribution. |
| Seeing Speech, University of Glasgow | French and Russian articulation media and extracted audio tracks | Preserve the original files and scholarly attribution. Any additional written redistribution permission is referenced privately by the registry. |
| Maintainer-cleared lesson videos | Selected Spanish, French, and Russian teaching clips | Each bundled family is covered by the maintainer's written redistribution record. A source-platform link alone is never treated as permission. |
| Merriam-Webster mark | Provider identification in settings | Restricted to nominative provider identification; no affiliation or endorsement is implied. |

## Exact Creative Commons derivatives

The following English `cup` files are derived from Wikimedia Commons sources.
Exact source hashes, modifications, and final hashes are documented in
`docs/operations/GUIDED_REPEAT_AUDIO_SOURCES.md`.

- `public/audio/ipa/normal/cup.mp3` and
  `public/audio/ipa/slow/cup.mp3`: `En-us-cup.ogg` by Dvortygirl,
  CC BY-SA 3.0.
- `public/audio/ipa/phoneme/cup.mp3`:
  `PR-open-mid back unrounded vowel2.ogg` by RoachPeter,
  CC BY-SA 4.0.

Russian Commons recordings retain their per-file source page, creator or
source attribution, SPDX-style license label, and SHA-256 in
`public/videos/language-assets/ru-RU/russian-local-pronunciation-assets.manifest.json`.
The registry commits that manifest's SHA-256, and the release validator checks
every listed Commons digest against the corresponding packaged audio file.

## API providers and references

Azure Speech, ElevenLabs, Youdao, Merriam-Webster, Vertex AI, Hermes, and LLM
providers are optional user-configured services governed by their own terms.
Reference pages used to check IPA or teaching content are not bundled merely
because they are cited. A reference-only source must never match a packaged
file in the asset-rights validator.

## Contributor and release rules

- Add no third-party media without a source, attribution, redistribution
  decision, SHA-256 digest, and evidence reference.
- Keep private authorization evidence outside the repository. Commit only its
  opaque evidence reference.
- Do not present a whole word, phrase, teaching track, or generated proxy as an
  isolated phoneme.
- Do not expose a speaker control unless its local or online source is
  accurately described.
- Run the rights validator before release. Missing files, changed bytes,
  unregistered media, overlapping claims, and locally bundled
  `reference-only` material are release failures.

Spanish, French, and Russian remain experimental learning modules. This status
describes pedagogical validation, not the recorded redistribution boundary.
