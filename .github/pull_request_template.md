## Summary

- 

## Validation

- [ ] `npm run test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build:desktop-frontend`
- [ ] `npm run desktop:preflight`
- [ ] `npm run desktop:ui-smoke`
- [ ] Release EXE manual check, if user-visible desktop behavior changed

## Release And Safety Checks

- [ ] I did not use localhost/dev server as the release acceptance path.
- [ ] I did not generate ElevenLabs audio or spend TTS credits.
- [ ] Spanish, French, and Russian remain experimental.
- [ ] Any IPA `update` has two independent sources or one primary authority plus
      one dictionary/textbook corroboration.
- [ ] Any final-corpus IPA change updates
      `docs/operations/non-english-ipa-reviewed-findings.json` and keeps its
      verdict/status contract valid.
- [ ] I did not change `needs-review` IPA rows without stronger follow-up
      evidence.
- [ ] I did not add API keys, tokens, recordings, private user data, or
      unreviewed third-party media.
- [ ] I followed `CODE_OF_CONDUCT.md` for learner, accent, IPA, and privacy
      discussion.

## Notes

Known limits or follow-up work:
