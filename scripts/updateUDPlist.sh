#!/usr/bin/env bash
# Update DNS list (TSV -> JSON) and reload the app.
#
# The list is read from disk on each request (/api/udp-hosts). You do NOT need next build
# for a hosts/udp6540_latest.tsv-only change. Sync + PM2 restart is enough.
#
# Usage (from project root):
#   ./scripts/updateUDPlist.sh              # sync + pm2 restart
#   ./scripts/updateUDPlist.sh --build      # also next build (code changed / first deploy)
#   ./scripts/updateUDPlist.sh --no-reload  # sync only (no PM2 restart)
#
set -euo pipefail
cd "$(dirname "$0")/.."

RELOAD=1
DO_BUILD=0
for a in "$@"; do
  case "$a" in
    --no-reload) RELOAD=0 ;;
    --build) DO_BUILD=1 ;;
    -h|--help)
      echo "Usage: $0 [--build] [--no-reload]"
      echo ""
      echo "  Default: npm run sync:udp6540 -> pm2 restart node-map"
      echo "  --build      also run next build (code changes or full artifact deploy)"
      echo "  --no-reload  sync only, no pm2"
      echo ""
      echo "Full app deploy: ./deploy.sh"
      exit 0
      ;;
  esac
done

echo "==> sync: TSV -> src/data/udp6540-hosts.json"
npm run sync:udp6540

if [[ "$DO_BUILD" -eq 1 ]]; then
  echo "==> next build"
  if [[ ! -x ./node_modules/.bin/next ]]; then
    echo "Missing ./node_modules/.bin/next; run: npm install" >&2
    exit 1
  fi
  ./node_modules/.bin/next build
fi

if [[ "$RELOAD" -eq 1 ]]; then
  if command -v pm2 >/dev/null 2>&1; then
    echo "==> pm2 restart node-map"
    pm2 restart node-map
  else
    echo "pm2 not in PATH; restart the app manually." >&2
  fi
fi

echo "Done."
