#!/usr/bin/env bash

# Lint JavaScript for syntax/basic correctness and block background.js formatting drift.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to lint JavaScript files." >&2
  exit 1
fi

if [ ! -d node_modules/eslint ] || [ ! -d node_modules/prettier ]; then
  echo "ESLint and Prettier must be installed. Run 'npm install' from the repo root." >&2
  exit 1
fi

npm run --silent lint:js
npm run --silent lint:js:background:strict
npm run --silent lint:js:background:format-audit
echo "JavaScript lint passed."
