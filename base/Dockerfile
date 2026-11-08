# Base image for t3code-umbrel: Node + t3 CLI.
# Agent CLIs (claude, codex, ...) are intentionally not baked in here; install
# and authenticate them inside the persisted home or extend this image.
FROM node:22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# T3 Code CLI. Pin to a released version (override with --build-arg).
ARG T3_VERSION=0.1.7
RUN npm install -g "t3@${T3_VERSION}"

RUN useradd -m -d /home/t3code -s /bin/bash t3code
WORKDIR /home/t3code
USER t3code
