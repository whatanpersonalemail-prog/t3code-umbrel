# Base image

The final image layers launcher.mjs onto a base image that provides Node and the
`t3` CLI (and, optionally, agent CLIs such as claude and codex).

Build it with:

    docker build -t t3code-umbrel-base ./base

Pass the resulting image as BASE_IMAGE when building the final image. T3 Code
has no official Docker image; agent CLIs must be installed and authenticated in
the persisted home (/home/t3code) or in an extended base image.
