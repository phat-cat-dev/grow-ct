# grow-ct — containerised GROW theme

> **Snapshot:** `2026-10-18` · repo `phat-cat-dev/grow-ct`

---

## ✅ This project is containerised

`grow-ct` is a standalone, token-driven **Adapt theme** that builds and serves
from a container — **no local Node, Adapt CLI or Grunt install required**. One
command:

```sh
docker compose up --build        # → http://localhost:8080
```

### What's in the box

| File | Role |
|---|---|
| `Dockerfile` | `node:20-bookworm-slim` + `git` + `ca-certificates` + global `adapt-cli` and `grunt-cli`. The image is just the toolchain. |
| `compose.yaml` | Service `adapt`: builds the image, bind-mounts the repo **read-only** at `/repo`, keeps the Adapt framework in the named volume `adapt_framework`, publishes **loopback-only** `127.0.0.1:8080`. |
| `docker/entrypoint.sh` | On start: clones the Adapt framework into the volume (first run only), installs plugins, copies the `grow-ct` plugin out of the repo into `src/theme/grow-ct`, sets `_theme`, runs the Grunt build, then serves (and watch-rebuilds in `dev`). |
| `.github/workflows/docker-image.yml` | CI: builds the Docker image on push / PR to `main`. |
| `.dockerignore` | Keeps `node_modules`, build output and the framework clone out of the build context. |

### Dials (environment variables)

| Var | Default | Effect |
|---|---|---|
| `THEME` | `grow-ct` | which plugin folder to build as the theme |
| `ADAPT_MODE` | `dev` | `dev` = build + serve + watch-rebuild · `build` = one-shot build then serve |

```sh
ADAPT_MODE=build docker compose up --build    # one-shot build, then serve
```

The framework clone is **persisted** in the `adapt_framework` volume, so first
run is slow (it pulls the framework + plugins from GitHub) and every run after
is fast. The repo is mounted read-only — you edit on the host, the entrypoint
re-syncs the theme and rebuilds inside the container.

See [`docker/README.md`](docker/README.md) for the full runbook.

---

## The plugin

```
grow-ct/        the Adapt theme plugin — token engine (hue + fluid type/space),
                the _grow frontmatter/data layer, role-based BEM, growMeta.js.
                Renamed from adapt-grow-base. npm + bower manifests.
packages/grow-core-base/   the 'adab' style-tier assembly + a buildable course config
docs/ gallery/  the architecture/mapping specs and the standalone previews
```

`grow-ct` is **GPL-3.0** (a fork of `adapt-contrib-vanilla`; vanilla's shell
painting is re-driven by the GROW token engine). The relational-knowledge layer
(**KNOW**) lives in the separate `know-ct` project, not here.

---

## Status

- [x] Theme compiles against real `adapt-contrib-core` LESS (verified with `lessc` 4.2)
- [x] Containerised build/serve environment (`docker compose up --build`)
- [x] npm + bower manifests
- [ ] Verify the **live `grunt build`** inside the container (themeBlockView column routing + schema merge)
- [ ] Tag & publish **v1.0.0**
