#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d node_modules/wrangler ]]; then
  npm install
fi

npm run deploy
