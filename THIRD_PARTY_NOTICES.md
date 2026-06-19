# Third-Party Notices And Asset Boundary

SpeakRight Desktop includes source code, documentation, local audio assets, and
local teaching media. The MIT license in `LICENSE` applies to source code and
source-code documentation unless a file says otherwise. It does not
automatically relicense bundled third-party media.

Before redistributing packaged builds publicly, review the origin, license,
attribution, and redistribution rights for each bundled media source. When a
source or license is uncertain, document it as a release blocker or an asset
gap instead of presenting it as a final public redistribution grant.

## Bundled Or Referenced Media

The repository may include or reference:

- English IPA chart audio and images.
- English word-card audio in `public/audio/words/`.
- Spanish, French, and Russian local language-pack audio in
  `public/audio/language-packs/`.
- Local sound-unit header clips in `public/audio/language-assets/`.
- Pronunciation teaching videos and articulation assets in `public/videos/`.
- Generated, downloaded, or source-ledger images used by the UI.

These assets are included for the current desktop learning experience and
release-candidate validation. They are not automatically covered by the MIT
source-code license.

## Source Notes And Credits

- **Rachel's English**: English pronunciation teaching videos and source-ledger
  references are credited where used. Keep bundled or mirrored usage within the
  verified rights boundary before public redistribution.
- **American IPA Chart / americanipachart.com**: English IPA chart audio/source
  references inform the local IPA chart clips. Treat these media files as
  third-party educational assets, not MIT-licensed source code.
- **University of Iowa Sounds of Speech Spanish**: Spanish articulation assets
  and references are used where exact local Spanish mouth/tongue animations are
  available.
- **Seeing Speech / University of Glasgow**: Selected phonetics and articulation
  references, including IPA-chart style media, inform some local source-ledger
  entries and pronunciation guidance.
- **EasyPronunciation and similar pronunciation resources**: Used as reference
  or source-verification context where noted. Do not describe reference-only
  pages as bundled assets or redistribution licenses.
- **Microsoft Fluent Emoji-style images**: English phoneme-card images are
  treated as third-party visual assets with their own licensing boundary.
- **Azure Speech, ElevenLabs, Youdao, Merriam-Webster, and LLM providers**:
  Online capabilities depend on user-configured provider accounts and the
  providers' own terms. Azure Speech is the source of numeric pronunciation
  scoring; LLM providers only generate coaching explanations from that evidence.

## Contributor Rules

- Do not add paid, generated, downloaded, or third-party media without recording
  its source and usage constraints.
- Do not add new ElevenLabs-generated audio without explicit maintainer
  approval.
- Do not replace an exact pronunciation asset with proxy video, unrelated word
  audio, browser TTS, or rule explanation audio.
- Do not make a speaker button clickable unless the target has a verified local
  short audio source.
- If an asset is uncertain, document it as a gap instead of presenting it as an
  exact pronunciation reference.

## Current Release Note

Spanish, French, and Russian are experimental modules. Their bundled audio and
IPA data are under active audit and should not be described as final mastery
evidence. Controlled-test artifacts may include third-party media for validation;
public redistribution still requires a rights review and Windows code signing.
