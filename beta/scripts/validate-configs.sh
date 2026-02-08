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
  if python3 - "$file" <<'PY'; then
import json
import sys

path = sys.argv[1]


def strict_pairs(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError(f"Duplicate key '{key}'")
        obj[key] = value
    return obj


try:
    with open(path, "r", encoding="utf-8") as fh:
        json.load(fh, object_pairs_hook=strict_pairs)
except Exception as exc:
    print(f"{path}: {exc}", file=sys.stderr)
    sys.exit(1)
PY
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
