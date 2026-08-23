# Guided Repeat Audio Source Ledger

Last updated: 2026-07-14

This ledger records third-party or derived audio used by the offline
guided-repeat experience. It supplements `THIRD_PARTY_NOTICES.md`.

## English `cup` example-word recordings

These two files demonstrate the word `cup`. They are not the isolated `/ʌ/`
phoneme anchor used by guided repeat.

- Source title: `En-us-cup.ogg`
- Source page: https://commons.wikimedia.org/wiki/File:En-us-cup.ogg
- Original media URL:
  https://upload.wikimedia.org/wikipedia/commons/5/57/En-us-cup.ogg
- Creator: Dvortygirl
- Source date: 2006-03-04
- Downloaded: 2026-07-14
- Language/accent: United States English
- License selected for redistribution: Creative Commons
  Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)
- License URL: https://creativecommons.org/licenses/by-sa/3.0/
- Downloaded transcode SHA-256:
  `0C5112F9EA11174C074F166CCAF1A2A3D10AC3062F2E4E0C8611CE3068AE4413`

Bundled derivatives:

| Asset | Modification | SHA-256 |
|---|---|---|
| `public/audio/ipa/normal/cup.mp3` | Trimmed to the spoken token, converted to 44.1 kHz mono MP3, faded at edit boundaries, and level-matched to the IPA example-word family. | `6FFEE82988D90E607F59EBE12D290452887873D9F691F77912F82B1A5E3DD6E2` |
| `public/audio/ipa/slow/cup.mp3` | Derived from the normal example-word asset with pitch-preserving 0.78x time stretching and post-stretch level matching. | `9DD4255CB53B1743C63190AD66D81A6D4C05D775DBB4C0C2C97CC8FC699D135B` |

The same byte-identical derivatives are mirrored under
`apps/browser/public/audio/ipa/`. Cambridge Dictionary and Rachel's English
were used only as listening references; their audio was not downloaded,
extracted, or redistributed.

## Standalone English `/ʌ/` phoneme recording

This is the single isolated phoneme source used twice at the start of every
English guided-repeat word cycle.

- Source title: `PR-open-mid back unrounded vowel2.ogg`
- Source page:
  https://commons.wikimedia.org/wiki/File:PR-open-mid_back_unrounded_vowel2.ogg
- Creator: RoachPeter
- Source date: 2016-04-15
- Downloaded: 2026-07-14
- Description: isolated open-mid back unrounded vowel with falling pitch
- License: Creative Commons Attribution-ShareAlike 4.0 International
  (CC BY-SA 4.0)
- License URL: https://creativecommons.org/licenses/by-sa/4.0/
- Downloaded official MP3 transcode SHA-256:
  `EC55254C33740CBF34C71E48EC8DED833B8528EFB5B3AED81C2381E2EE584444`

Bundled derivative:

| Asset | Modification | SHA-256 |
|---|---|---|
| `public/audio/ipa/phoneme/cup.mp3` | Converted to 44.1 kHz mono MP3, shortened with pitch-preserving 1.35x time compression, and faded at edit boundaries. | `AAD0B34212A5AAA122E818A4FCBD82E27C8A98718746FFC2B3BAC940DF3D2BCD` |

The byte-identical derivative is mirrored at
`apps/browser/public/audio/ipa/phoneme/cup.mp3`.