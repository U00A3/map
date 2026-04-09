#!/usr/bin/env bash
# Full deploy of node-map on the server:
#   optional git pull -> npm install -> npm run build (includes prebuild + UDP sync) -> pm2 restart
#
# Usage:
#   ./deploy.sh              # install + build + PM2 restart
#   ./deploy.sh --no-install # faster: build + restart only (no npm install)
#   ./deploy.sh --pull       # git pull --ff-only first (when repo exists)
#
set -euo pipefail
cd "$(dirname "$0")"

DO_INSTALL=1
DO_PULL=0
for a in "$@"; do
  case "$a" in
    --no-install) DO_INSTALL=0 ;;
    --pull) DO_PULL=1 ;;
    -h|--help)
      echo "Usage: $0 [--pull] [--no-install]"
      echo ""
      echo "  Default: npm install -> npm run build -> pm2 restart node-map"
      echo "  --pull       if .git exists: git pull --ff-only before install"
      echo "  --no-install skip npm install (faster when only code changed)"
      echo ""
      echo "DNS list only (TSV -> sync + restart, no build): ./scripts/updateUDPlist.sh"
      exit 0
      ;;
    *)
      echo "Unknown option: $a (use --help)" >&2
      exit 1
      ;;
  esac
done

if [[ "$DO_PULL" -eq 1 ]]; then
  if [[ -d .git ]]; then
    echo "==> git pull --ff-only"
    git pull --ff-only
  else
    echo "==> no .git directory, skipping --pull" >&2
  fi
fi

if [[ "$DO_INSTALL" -eq 1 ]]; then
  echo "==> npm install"
  npm install
fi

echo "==> npm run build (prebuild: UDP sync from hosts/udp6540_latest.tsv)"
npm run build

if command -v pm2 >/dev/null 2>&1; then
  echo "==> pm2 restart node-map"
  pm2 restart node-map
else
  echo "pm2 not found; start manually: npm run start (port 3101)" >&2
fi

echo "Deploy finished."
