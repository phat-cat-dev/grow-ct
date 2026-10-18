# ============================================================================
#  Adapt framework build/dev environment for the GROW theme layer.
#  Image = Node + git + the Adapt CLI + grunt CLI. The framework itself is set
#  up at runtime into a named volume, and the GROW theme/config are bind-mounted
#  in from the repo — so you edit here and rebuild in the container. See
#  docker/README.md.
# ============================================================================
FROM node:20-bookworm-slim

# git: `adapt install` pulls plugins from GitHub. ca-certificates for TLS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Adapt authoring CLI + grunt CLI, installed globally.
RUN npm install -g adapt-cli grunt-cli

WORKDIR /work

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
