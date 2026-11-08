# Layer the auto-pairing launcher on top of a base T3 Code image.
# BASE_IMAGE must provide Node, the `t3` CLI, and the agent CLIs.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}

WORKDIR /app

# Base T3 Code tooling. Agent CLIs that need native install scripts
# (cursor, opencode, grok, fx) can be added in the persisted home later.
RUN npm install -g \
  t3@0.1.7 \
  @anthropic-ai/claude-code@2.1.319 \
  @openai/codex

COPY launcher.mjs /opt/t3code/launcher.mjs

RUN chmod +x /opt/t3code/launcher.mjs \
  && mkdir -p /home/t3code \
  && chown -R 1000:1000 /home/t3code

ENV HOME=/home/t3code
WORKDIR /home/t3code
USER 1000:1000

EXPOSE 3000
ENTRYPOINT ["node", "/opt/t3code/launcher.mjs"]
