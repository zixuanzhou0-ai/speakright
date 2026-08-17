# Privacy

Last updated: 2026-08-16

SpeakRight is a local-first, bring-your-own-key pronunciation practice project. The open-source editions documented in this repository do not include a SpeakRight-operated user account, cloud-sync, or analytics backend. Some learning features deliberately contact external providers selected and configured by the user.

This document describes the repository's current behavior. It is not a substitute for the privacy terms of Microsoft Azure, ElevenLabs, Google Cloud, xAI, a configured LLM provider, a dictionary provider, an operating system, or a browser.

## Data kept on the device

Depending on the edition and feature, SpeakRight may keep these items locally:

- language, theme, coach-mode, TTS, microphone, and other preferences
- practice history, score history, learning evidence, readiness checks, and cached dictionary/IPA data
- cached TTS or language-pack audio in browser storage
- optional benchmark recordings and their local index in IndexedDB
- user-supplied provider configuration

Windows Desktop stores secret provider configuration through the desktop credential layer when running under Tauri and keeps non-secret preferences in the Tauri settings store. Browser-like development fallbacks may use browser storage. Browser Edition stores API keys in session storage by default; persistent local storage is used only after the user explicitly selects that option.

Local storage is not the same as anonymous storage. Anyone with access to the device or browser profile may be able to inspect it. Use the Settings data controls or clear the relevant application/browser storage before transferring or sharing a device.

## Data sent to external providers

External requests occur only when a user invokes a network-backed feature or a maintainer deliberately runs a live provider check.

| Feature | Typical recipient | Data needed for the request |
| --- | --- | --- |
| Pronunciation assessment | Microsoft Azure Speech | target text, selected locale, and recorded audio |
| Standard demonstration TTS | ElevenLabs, or a configured local bridge to xAI/Grok or Vertex AI Gemini TTS | text, voice/settings, and provider authentication handled by the selected route |
| Chinese coaching feedback | the configured LLM provider | target text and structured pronunciation evidence needed to explain the result |
| Dictionary pronunciation or lookup | the configured dictionary source | the word or lookup text |

Provider billing, logging, retention, region, model-training, and deletion behavior is controlled by that provider and the user's account configuration. SpeakRight maintainers cannot delete data from a provider account they do not control.

## Microphone recordings

- Recording starts only after a user action and browser/operating-system permission.
- A scoring request sends the active recording to Azure Speech.
- Ordinary repository validation does not represent a real learner session. Synthetic or fixture-based checks must be labeled as such.
- Do not attach raw learner recordings to a public issue. Use the private path in `SECURITY.md` when a recording is necessary to investigate a sensitive problem.

## Public exports and issue reports

The app can expose locally generated reports or exports when the user explicitly requests them. Review every export before sharing it. Remove API keys, bearer tokens, account identifiers, private practice text, recordings, local user-profile paths, and any other identifying details.

The repository publishes only the narrow maintainer statement that 20 people tested SpeakRight offline. As documented in [`docs/validation/USER_TESTING_SUMMARY.md`](docs/validation/USER_TESTING_SUMMARY.md), that statement is not independently audited and includes no participant names, recordings, contact details, profile paths, task-result rates, or learning-outcome claims. Participant-level proof is not requested for release or application readiness. Any optional future aggregate publication must use real, appropriately consented, anonymized data and omit details that were not supplied.

## Retention and deletion

Local data remains until the user removes it through the available Settings controls, clears application/browser storage, or the platform evicts cached data. An ordinary uninstall may retain local learning data, preferences, and caches.

Before uninstalling, use **Settings → Data & privacy → Reset local data** and choose whether to also delete API keys. When the interactive Windows NSIS uninstaller offers **Delete app data**, select it if you want its application-data folders removed. The automated silent installer roundtrip validates installation, launch, exit, and uninstall behavior; it does not claim to validate deletion of user data. Rotate any credential that may have been exposed. Provider-side requests and retained data must be deleted separately in the relevant provider account.

## Reports and questions

- Report vulnerabilities, credential exposure, unsafe permissions, or accidental private-data disclosure through [`SECURITY.md`](SECURITY.md), not a public issue.
- Ask non-sensitive data-handling questions through [`SUPPORT.md`](SUPPORT.md).
- Do not include personal data in an initial public report.
