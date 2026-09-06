#!/usr/bin/env bash

# Lint JavaScript for syntax/basic correctness and block background.js formatting drift.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if ! command -v npm >/dev/null 2>&1 || [ ! -f package.json ] || [ ! -d node_modules/eslint ] || [ ! -d node_modules/prettier ]; then
  echo "Skipping optional local JavaScript lint (private npm tooling is not installed)."
  exit 0
fi

npm run --silent lint:js
npm run --silent lint:js:background:strict
npm run --silent lint:js:background:format-audit
echo "JavaScript lint passed."
