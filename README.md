# t3code-umbrel

Unofficial Umbrel App Store packaging of [T3 Code](https://github.com/pingdotgg/t3code),
a control surface for coding agents such as Claude Code, Codex and OpenCode.

This repository is community packaging. It is not affiliated with or endorsed by
the T3 Code authors.

## What this is

Umbrel wraps the T3 Code server in an `app_proxy`-protected browser app. Because
T3 Code's pairing flow normally needs a terminal, this package ships a small
launcher (`launcher.mjs`) that runs `t3 serve` on loopback and mints a one-time
pairing code on a browser's first visit to `/`, redirecting to
`/pair#token=<code>`.

## Architecture

- Umbrel `app_proxy` (with login) -> launcher on container port 3000
- launcher reverse-proxies HTTP and WebSockets to `t3 serve` on
  `127.0.0.1:3773` inside the container
- T3 state lives in `~/.t3` under the persisted home (`/home/t3code`)

## Build and push the image

The GitHub Actions workflow (`.github/workflows/build.yml`) builds a multi-arch
(`linux/amd64`, `linux/arm64`) image and pushes it to GHCR on tag push (`v*`)
or manual dispatch.

1. Push a tag, for example `v0.1.7`, or run the workflow manually.
2. Copy the image reference printed in the job summary into
   `umbrel-app/docker-compose.yml` as `image: ghcr.io/<owner>/t3code-umbrel:<version>@sha256:<digest>`.

To build locally instead:

    docker build --build-arg BASE_IMAGE=node:22-bookworm -t t3code-umbrel .
    mkdir -p ./home && sudo chown -R 1000:1000 ./home
    docker run -p 3000:3000 -v ./home:/home/t3code t3code-umbrel

The base image must provide Node and the `t3` CLI (and the agent CLIs you want).
See `base/` for a minimal base build.

## Test locally

    mkdir -p ./home && sudo chown -R 1000:1000 ./home
    docker run -p 3000:3000 -v ./home:/home/t3code t3code-umbrel
    # open http://localhost:3000 and confirm you land in T3 already paired

Do not publish port 3773 and do not disable Umbrel's login outside of local
testing.

## Test on umbrel-dev or a Pi

Add the package folder from `umbrel-app/` to a local umbrel-apps checkout (or
point umbrel-dev at it) and install. The manifest uses port 30033 for the
Umbrel launch URL.

## Submit to the Umbrel App Store

1. Fork `getumbrel/umbrel-apps`.
2. Copy the contents of `umbrel-app/` into `t3code/` in the fork.
3. Open a pull request titled `App Submission: T3 Code`.

Fill in the remaining TODOs in `umbrel-app/umbrel-app.yml` (gallery, submitter,
submission) and the image digest in `docker-compose.yml` first.

## Agent login

Users have no console. After install, drive an agent CLI once to log in, for
example:

    claude   # then /login
    codex login --device-auth

T3 Code will then use the authenticated agent.

## SECURITY

The launcher auto-pairs whoever reaches it. Treat the app as giving full
terminal and agent access to its container home.

- Keep Umbrel's app login enabled.
- Never set `PROXY_AUTH_ADD` to `false`.
- Never publish ports 3000 or 3773 to the host or the internet.
- Run only behind Umbrel's `app_proxy`.

## License

MIT. See `LICENSE`.
