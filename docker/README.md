# Docker — build & serve the GROW theme in real Adapt

A one-command Adapt framework environment so you can actually **`grunt build`**
and view the GROW theme rendering a course — the runtime step the cloud session
couldn't run.

## Run

```bash
docker compose up --build
```

Then open **http://localhost:8080**.

Shell scripts use LF line endings via `.gitattributes`. The image build also
normalizes the entrypoint to LF so existing Windows CRLF checkouts work. If you
see `/usr/bin/env: 'bash\r': No such file or directory`, rebuild with
`docker compose up --build`; no framework volume reset is needed.

- **First run** clones `adapt_framework`, `npm install`s it, and runs
  `adapt install` to pull the core + contrib plugins. This is slow and needs
  GitHub access. It's stored in the `adapt_framework` named volume and reused.
- On every start the entrypoint **re-syncs `grow-ct` from the repo**
  into the framework, sets the course's `_theme` to it, builds, and serves.

## Modes

```bash
# one-shot build, then serve (no watch)
ADAPT_MODE=build docker compose up --build

# build a different theme folder
THEME=grow-ct docker compose up --build
```

## What it does (docker/entrypoint.sh)

1. first run: clone `adapt_framework` → `npm install` → `adapt install`
   (framework's default course + plugin set);
2. copy `theme/$THEME` from the repo into `src/theme/$THEME`;
3. set `src/course/config.json → _theme: $THEME` (default course, GROW theme);
4. `grunt build`; serve `build/` on `:8080` (dev mode also runs `grunt dev` watch).

## Notes

- Port is bound to **loopback** (127.0.0.1:8080) — it's a dev server.
- The default Adapt sample course is used so there's content to see; swap in the
  GROW example lesson JSON (`grow-ct/examples/lesson.example.json`)
  or your own `src/course` to view the lesson structure.
- Reset everything: `docker compose down -v` (removes the framework volume;
  next run re-installs).
- This is the environment to confirm the two runtime-pending pieces: the
  `themeBlockView` column routing and the authoring-tool schema merge.
