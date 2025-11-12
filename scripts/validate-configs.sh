#!/usr/bin/env bash

# Validate all settings/config*.json files contain well-formed JSON.
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to validate config JSON files." >&2
  exit 1
fi

shopt -s nullglob
files=(settings/config*.json)

if [ ${#files[@]} -eq 0 ]; then
  echo "No matching files under settings/config*.json"
  exit 0
fi

failed=0
for file in "${files[@]}"; do
  if python3 -m json.tool "$file" >/dev/null; then
    echo "Validated $file"
  else
    echo "Invalid JSON: $file" >&2
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "All config JSON files are valid."
