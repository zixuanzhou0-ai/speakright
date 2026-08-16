# User Testing Summary

Status: **awaiting maintainer-provided real, consented, anonymized aggregate fields**（待维护者补充真实、经同意、匿名化的聚合数据）.

Updated: 2026-08-16

No participant count, task-success rate, retention figure, satisfaction score, or learning-outcome result is supported by the public repository at this snapshot. An empty field below means “not supplied,” not zero. Do not replace it with an estimate.

## Required study fields

| Field | Value |
| --- | --- |
| Study owner | `<pending maintainer input>` |
| Study window, with dates and timezone | `<pending maintainer input>` |
| Recruitment source and inclusion criteria | `<pending maintainer input>` |
| Consent method and approved data uses | `<pending maintainer input>` |
| Participants invited | `<pending maintainer input>` |
| Participants who consented | `<pending maintainer input>` |
| Consented adult Chinese-speaking learners (age 18+) | `<pending maintainer input>` |
| Participants who completed each task | `<pending maintainer input>` |
| Desktop vs Browser participant distribution | `<pending maintainer input>` |
| Edition, commit/release, OS, and browser mix | `<pending maintainer input>` |
| Device and microphone environment categories, with a count for each | `<pending maintainer input>` |
| Languages and learner-background categories | `<pending maintainer input>` |
| Tasks and predeclared success criteria | `<pending maintainer input>` |
| Task results as numerator/denominator, not percentage alone | `<pending maintainer input>` |
| Blocking defects and severity definitions | `<pending maintainer input>` |
| Qualitative themes, with theme counts or marked unquantified | `<pending maintainer input>` |
| Exclusions, dropouts, missing data, and reasons | `<pending maintainer input>` |
| Known sampling and measurement limitations | `<pending maintainer input>` |
| Independent review 1: reviewer, date, scope, and outcome | `<pending maintainer input>` |
| Independent review 2: reviewer, date, scope, and outcome | `<pending maintainer input>` |
| Location of private source evidence and access owner | `<pending maintainer input; do not publish the private path or data>` |

## Publication gate

Publish aggregated results only after all applicable items are true:

- [ ] A maintainer has verified that the observations came from real participants rather than automated tests, developer sessions, or synthetic audio.
- [ ] Participants consented to the documented testing and aggregate reporting.
- [ ] At least 20 consented adult Chinese-speaking learners completed the documented required tasks.
- [ ] At least three distinct device or microphone environment categories are documented with non-zero participant counts.
- [ ] Two independent reviews are documented with reviewer, date, scope, and outcome; neither review is inferred from an automated test run.
- [ ] Counts have a defined unit, denominator, study window, and deduplication rule.
- [ ] Raw recordings, free-text responses, account identifiers, IP addresses, API keys, and local profile paths are excluded from the public file.
- [ ] Small cells that could identify a participant are suppressed or combined.
- [ ] Quotes are omitted unless separately consented and de-identified.
- [ ] A reviewer recalculated reported percentages from the source counts.
- [ ] Limitations and adverse findings are reported alongside positive findings.
- [ ] The summary does not convert usability observations into causal learning-efficacy claims.

Until every checkbox is supported by the private source evidence and the public aggregate fields above, this file is a pending template and the v1.1.0 application-readiness gate remains open. Do not mark the release candidate or Codex for Open Source application as user-evidence complete.

## Future aggregate summary template

Do not complete this section until the gate above is satisfied.

> Between `<start date>` and `<end date>`, `<consented participant count>` consented participants evaluated `<edition/version>` on `<documented device mix>`. They attempted `<task list>`. `<numerator>/<denominator>` completed `<predeclared criterion>`. The most frequent anonymized themes were `<themes with counts or unquantified labels>`. Results are limited by `<sampling, device, language, and study-design limits>` and do not establish clinical or causal learning efficacy.

## What must not be counted as a user

- a test file, fixture, snapshot, route, or automated browser worker
- a GitHub star, clone, view, workflow run, release download, or provider request
- a maintainer opening the app repeatedly during development
- a synthetic or generated audio sample
- an invited person who did not consent or did not begin the documented task

If real anonymous aggregate data is unavailable, the correct public statement is that no supported user-testing metric is available yet.
