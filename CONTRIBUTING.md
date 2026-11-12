# Contributing to T3.1 Code

This repository is **Rivethub’s T3.1 Code** line: a tracked, experimental fork of
[pingdotgg/t3code](https://github.com/pingdotgg/t3code). It is not a hard fork and not a
replacement for upstream.

## Intent

- Prototype ideas and run experimental builds that can lead T3 Code.
- Backport fixes and some features upstream when they are ready.
- Keep a separate trust and review surface (see `.github/VOUCHED.td` and
  `.github/TRIAGE_EXEMPTIONS.td`). Upstream vouch or denouncement does not apply here.

Anyone may use this fork. Anyone may open PRs here. If your change belongs in the stable
product, we will often ask you (or help you) to take it upstream after it proves out here.

For the upstream project’s contribution policy, read
[pingdotgg/t3code CONTRIBUTING.md](https://github.com/pingdotgg/t3code/blob/main/CONTRIBUTING.md).
Do not assume that a PR accepted here will be accepted there, or the reverse.

## What we want here

- Bug fixes and performance improvements.
- Experiments and features that need a place to live before upstream is ready for them.
- Documentation that clarifies fork vs upstream behavior.

## What to avoid

- Drive-by churn that does not help a prototype or a fix.
- Silently diverging packaging, bundle IDs, or protocol shapes when a label change would do.
- Copying upstream trust lists or fighting upstream governance inside this repo.

## PR habits

- Prefer one problem (or one coherent experiment) per PR.
- Say what you tried and what you saw. UI changes need screenshots or a short video on the PR.
- Keep the branch mergeable with this repo’s default branch.
- Open PR limits and conflict windows follow the workflows in `.github/`; vouched logins in
  `.github/VOUCHED.td` are exempt from the open-PR limit and conflict auto-close here.

## Setup

See the [development runbook](docs/operations/development.md#first-checkout).

## Syncing with upstream

Treat `pingdotgg/t3code` as upstream. Merge or rebase regularly. Prefer small, reviewable
divergences. Branding and trust-list files in this fork are expected to differ; almost
everything else should stay easy to merge.
