# GitHub release settings checklist

Updated: 2026-08-16

This checklist records repository settings that cannot be proven by source
files alone. It is intentionally written as a pending owner action: do not
mark an item complete until the public repository shows the setting to a
signed-out visitor or the GitHub API confirms it.

## Current read-only snapshot

Checked against `zixuanzhou0-ai/speakright` on 2026-08-16 before the v1.1.0
branch was pushed:

- repository visibility: public
- default branch: `main`
- GitHub license classification: `Other` (the public branch still has the old
  non-canonical license text)
- topics: none
- `main` branch protection: disabled
- private vulnerability reporting: disabled

These are observations, not completed v1.1.0 claims.

## Owner actions after the final PR is public

- [ ] Confirm `main` contains the exact standard MIT `LICENSE` from the
      v1.1.0 release commit and GitHub classifies it as MIT.
- [ ] Add accurate topics such as `pronunciation`, `language-learning`,
      `speech-assessment`, `tauri`, `nextjs`, `typescript`, `rust`, and
      `azure-speech`.
- [ ] Let the new workflows complete once, then protect `main` with the actual
      successful check names. Require pull requests, required status checks,
      resolved review conversations, and block force pushes and branch
      deletion. Do not invent a required check name before GitHub has created
      it.
- [ ] Enable private vulnerability reporting and verify that `SECURITY.md`
      points reporters to the private channel.
- [ ] Confirm Dependabot recognizes the npm root, Browser npm, Cargo, and
      GitHub Actions update entries.
- [ ] Confirm the repository homepage, description, and public release links
      describe Browser Stable and unsigned Desktop Preview accurately.
- [ ] Open the README, release assets, SBOMs, checksums, validation reports,
      screenshots, demo, and OSS-readiness page in a signed-out browser.

## Publication boundary

Changing repository settings, merging, tagging, creating a GitHub Release, or
submitting the Codex for Open Source form is an external action. Perform those
steps only after the maintainer reviews the final diff and explicitly approves
publication.
