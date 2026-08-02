#!/usr/bin/env bash

# Validate all settings/config*.json files contain well-formed JSON.
set -euo pipefail

python_cmd=()
for candidate in python3 python py; do
  if ! command -v "$candidate" >/dev/null 2>&1; then
    continue
  fi
  if [ "$candidate" = "py" ]; then
    if py -3 -c "import json" >/dev/null 2>&1; then
      python_cmd=(py -3)
      break
    fi
  elif "$candidate" -c "import json" >/dev/null 2>&1; then
    python_cmd=("$candidate")
    break
  fi
done

if [ ${#python_cmd[@]} -eq 0 ]; then
  echo "python3, python, or py is required to validate config JSON files." >&2
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
  if "${python_cmd[@]}" - "$file" <<'PY'; then
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
