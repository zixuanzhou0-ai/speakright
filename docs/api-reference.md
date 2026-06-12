# Desktop Integration Reference

SpeakRight Desktop is a local Tauri app. External services are called from the
desktop runtime/client layer with credentials loaded from the app's secure/local
settings layer. API keys must not be committed, exported with learning data, or
shown in release artifacts.

## Azure Speech

- Purpose: scripted pronunciation assessment, word/phoneme feedback, diagnosis.
- Required settings: Speech key and region.
- Locales currently wired:
  - `en-US` stable baseline
  - `es-ES`, `fr-FR`, `ru-RU` experimental
- Assessment granularity: phoneme where the provider returns usable alignment.
- Non-English caveat: Spanish, French, and Russian feedback must stay
  conservative until per-language probes prove specific sound-unit reliability.
- Non-English diagnosis reports must withhold trusted overall scores when Azure
  returns static/silence, partial reading, too few word-level items, text that
  does not match the target-language prompt, or no usable phoneme alignment.
  The UI should show "evidence insufficient / retest recommended / training
  reference only" instead of "no obvious issue".

## ElevenLabs

- Purpose: standard TTS/read-along when a phrase is not covered by bundled local
  audio.
- Spanish, French, and Russian word/phrase packs are bundled under
  `public/audio/language-packs/`; users do not install them in Settings.
  Each manifest item carries `audioByVoice.blue` and `audioByVoice.pink`.
- Current bundled experimental-language voices:
  - Spanish: `Marco Cruz` primary and `Lydia` secondary.
  - French: `Clément` primary and `Rachel` secondary.
  - Russian: `Valeria` primary and `Sergey` secondary.
- Missing bundled audio may fall back to ElevenLabs only when the user has
  configured a key.
- Release validation must not batch-generate ElevenLabs audio. The normal
  `desktop:live-validation` command queries usage and skips TTS smoke; optional
  smoke requires an explicit flag and is capped to a short low-cost sample.

## Dictionary Pronunciation

- Purpose: single-word replay on word cards.
- English practice words prefer bundled local audio from
  `public/audio/words/{blue,pink}/`, then fall back to Youdao online
  pronunciation.
- Non-English word cards first use bundled local audio. Dictionary APIs are only
  fallback helpers and should not be described as the source of truth.
- Retired dictionary sources must not reappear in Settings, CSP, capabilities,
  exported data, or release docs.

## LLM Feedback

- Purpose: Chinese coaching feedback based on structured scoring evidence.
- The LLM is not the acoustic scorer.
- For `es-ES`, `fr-FR`, and `ru-RU`, prompts must explicitly label evidence
  limits and avoid claiming mastery from a single recording.
- LLM feedback should treat low-evidence non-English reports as coaching hints,
  not validated diagnostic conclusions.

## Local Data

- Learning data stays local.
- API keys are excluded from learning-data export.
- Data deletion must clear learning state, diagnosis, benchmark audio, caches,
  and legacy language-pack IndexedDB entries when requested by the user.
