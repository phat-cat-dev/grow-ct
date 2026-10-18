#!/usr/bin/env bash
# ============================================================================
#  Sets up an Adapt framework build in a named volume, drops the GROW theme in,
#  points the course at it, builds, and serves build/ on :8080.
#  Idempotent: the framework is cloned/installed only on first run; the GROW
#  theme + config are re-synced from the repo on every start.
# ============================================================================
set -euo pipefail

FW=/work/framework
REPO=/repo
THEME="${THEME:-grow-ct}"
MODE="${ADAPT_MODE:-dev}"

if [ ! -d "$FW/node_modules" ]; then
  echo "[grow] first run — cloning the Adapt framework + installing (this is slow)…"
  rm -rf "$FW"
  git clone --depth 1 https://github.com/adaptlearning/adapt_framework.git "$FW"
  cd "$FW"
  npm install
  # install the framework's default plugin set (core + contrib components + a theme)
  npx adapt install || echo "[grow] 'adapt install' reported issues — continuing"
fi

cd "$FW"

echo "[grow] syncing $THEME from the repo → src/theme/$THEME"
rm -rf "src/theme/$THEME"
cp -r "$REPO/$THEME" "src/theme/$THEME"

echo "[grow] pointing the course at _theme: $THEME"
node -e "const f='src/course/config.json';const fs=require('fs');const c=JSON.parse(fs.readFileSync(f,'utf8'));c._theme=process.env.THEME;fs.writeFileSync(f,JSON.stringify(c,null,2));"

echo "[grow] grunt build…"
npx grunt build

serve_build () { npx --yes serve --no-clipboard -l tcp://0.0.0.0:8080 build; }

if [ "$MODE" = "build" ]; then
  echo "[grow] serving build/ at http://localhost:8080 (one-shot build)"
  serve_build
else
  echo "[grow] serving build/ at http://localhost:8080 + watching src for rebuilds"
  serve_build &
  # re-sync + rebuild on any change under the theme (simple watch loop; grunt dev also works)
  npx grunt dev 2>/dev/null || true
  wait
fi
