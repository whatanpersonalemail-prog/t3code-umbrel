# Layer the auto-pairing launcher on top of a base T3 Code image.
# BASE_IMAGE must provide Node, the `t3` CLI, and the agent CLIs.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}

WORKDIR /app
COPY launcher.mjs /opt/t3code/launcher.mjs

RUN chmod +x /opt/t3code/launcher.mjs \
  && (id -u t3code >/dev/null 2>&1 || useradd -m -d /home/t3code -s /bin/bash t3code)

ENV HOME=/home/t3code
WORKDIR /home/t3code
USER t3code

EXPOSE 3000
ENTRYPOINT ["node", "/opt/t3code/launcher.mjs"]
