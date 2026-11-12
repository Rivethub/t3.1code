<p align="center">
  <a href="https://github.com/Rivethub/t3.1code">
    <img src="./assets/prod/t3-black-web-icon-192x192.png" width="80" height="80" alt="T3.1 Code logo" />
  </a>
</p>

<h1 align="center">T3.1 Code</h1>

<p align="center">An experimental, upstream-tracked line of <a href="https://github.com/pingdotgg/t3code">T3 Code</a>.</p>

<p align="center">
  <a href="./docs/README.md">Docs</a> ·
  <a href="./CONTRIBUTING.md">Contributing</a> ·
  <a href="https://github.com/pingdotgg/t3code">Upstream T3 Code</a>
</p>

## This is not a hard fork

**T3.1 Code** (`Rivethub/t3.1code`) stays aligned with [pingdotgg/t3code](https://github.com/pingdotgg/t3code). We use this repo to prototype ideas, ship experimental builds, and pressure-test changes before (or while) they land upstream.

Anyone can use it. Anyone can open PRs here. The usual intention is:

- **Backport** fixes and some features to upstream T3 Code when they prove out.
- **Keep room** here for experiments that would be too noisy, early, or speculative for the main project.
- **Keep trust separate.** Vouch lists, triage exemptions, and approval norms in this repo are Rivethub’s, not upstream’s. Upstream trust does not transfer here, and the reverse is also true.

If you want the stable product, install [upstream T3 Code](https://t3.codes/download). If you want to try leading-edge ideas or help shape them, you are in the right place.

## What T3 Code is

T3 Code runs coding agents on your machine and gives them one fast interface. Desktop, web, and phone share the same threads. It drives agents you already pay for (Claude Code, Codex, Cursor, OpenCode, and others) instead of reselling tokens.

T3.1 Code is that same codebase, labeled and governed for experimental work.

## Install from this fork

Build from source with the [development runbook](./docs/operations/development.md#first-checkout). Package names, CLI (`t3`), and many technical IDs still match upstream on purpose so merges stay tractable. User-facing labels use **T3.1**.

Official desktop, mobile, and `curl | sh` installs still come from [upstream](https://t3.codes/download) unless this fork publishes its own artifacts.

## Documentation

- [Install and first run](./docs/user/install.md) (upstream-oriented; paths apply here too)
- [Remote access](./docs/user/remote-access.md)
- [Architecture overview](./docs/internals/overview.md)
- [All docs](./docs/README.md)

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md). Short version: PRs are welcome here for prototypes and fixes; expect that good work may be proposed upstream; this repo’s vouch and review rules are independent of `pingdotgg/t3code`.

## License

[MIT](./LICENSE), same as upstream.
