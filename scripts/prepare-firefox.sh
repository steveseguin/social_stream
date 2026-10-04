#!/bin/bash
# Prepare a Firefox Add-on build from the extension sources.

set -euo pipefail

BUILD_DIR="${FIREFOX_BUILD_DIR:-firefox-build}"

echo "=== Preparing Firefox Add-on Build ==="

# Stage the extension directly. The old Chrome Web Store preparation script was
# intentionally removed, so Firefox must not depend on its generated output.
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Omit unused legacy Kokoro WASM variants, the unused Transformers JSEP
# runtime (the worker selects asyncify), and the original full emoji font.
# Keep the active Kokoro JSEP runtime, Piper WASM fallbacks, Transformers
# asyncify/standard runtimes, and the subset font used by the overlays.
rsync -a \
    --exclude='.git/' \
    --exclude='.github/' \
    --exclude='.gitignore' \
    --exclude='.gitattributes' \
    --exclude='.githooks/' \
    --exclude='.agents/' \
    --exclude='.claude/' \
    --exclude='.codex*/' \
    --exclude='/.codex-tmp-*.diff' \
    --exclude='.playwright-mcp/' \
    --exclude='.npm-cache/' \
    --include='docs/' \
    --include='docs/css/' \
    --include='docs/js/' \
    --include='docs/images/' \
    --include='docs/images/guides/' \
    --include='docs/images/kick-channel-points-event-flow/' \
    --include='docs/event-reference.html' \
    --include='docs/media-hosting-event-flow.html' \
    --include='docs/source-types-guide.html' \
    --include='docs/css/event-reference.css' \
    --include='docs/css/guides.css' \
    --include='docs/css/styles.css' \
    --include='docs/js/main.js' \
    --include='docs/images/guides/guide-event-flow-overview.png' \
    --include='docs/images/guides/guide-standalone-source-modes.png' \
    --include='docs/images/kick-channel-points-event-flow/event-flow-media-action-values.png' \
    --exclude='docs/***' \
    --exclude='lite/' \
    --exclude='tests/' \
    --exclude='scripts/' \
    --exclude='node_modules/' \
    --exclude='tmp/' \
    --exclude='/tmp-*' \
    --exclude='/tmp_*' \
    --exclude='/.tmp_*' \
    --exclude='artifacts/' \
    --exclude='playwright-report/' \
    --exclude='test-results/' \
    --exclude='/%SystemDrive%/' \
    --exclude='/face-preview.png' \
    --exclude='*.log' \
    --exclude='local-tts-bridge/' \
    --exclude='ssn-streamdeck/' \
    --exclude='electron_app_reference/' \
    --exclude='cws-build/' \
    --exclude='firefox-build/' \
    --exclude='web-ext-artifacts/' \
    --exclude='thirdparty/models/' \
    --exclude='thirdparty/piper/piper-voices/' \
    --exclude='thirdparty/kitten-tts/' \
    --exclude='thirdparty/*.onnx' \
    --exclude='/thirdparty/kokoro-ort-wasm.wasm' \
    --exclude='/thirdparty/kokoro-ort-wasm-simd.wasm' \
    --exclude='/thirdparty/transformersjs/ort/ort-wasm-simd-threaded.jsep.mjs' \
    --exclude='/thirdparty/transformersjs/ort/ort-wasm-simd-threaded.jsep.wasm' \
    --exclude='/thirdparty/NotoColorEmoji.full.ttf' \
    --exclude='*.md' \
    --exclude='package.json' \
    --exclude='package-lock.json' \
    --exclude='eslint.config.js' \
    --exclude='.prettierrc' \
    --exclude='.htmlhintrc' \
    ./ "$BUILD_DIR/"

echo "Transforming manifest.json for Firefox compatibility..."

jq '
# Firefox MV3 uses an event page rather than an extension service worker.
.background = {
    "scripts": [.background.service_worker]
} |

# Firefox 140+ provides the built-in data-consent prompt used by this build.
.browser_specific_settings.gecko.strict_min_version = "142.0" |
.browser_specific_settings.gecko.data_collection_permissions = {
    "required": ["personallyIdentifyingInfo", "authenticationInfo", "personalCommunications", "websiteContent"],
    "optional": []
} |

# Fix legacy content-script key spelling if it appears.
.content_scripts = (.content_scripts | map(if has("runs_at") then .run_at = .runs_at | del(.runs_at) else . end)) |

# These Chrome APIs are not implemented by Firefox. Runtime code already
# feature-detects tabCapture; debugger-backed automation remains unavailable.
.permissions = [.permissions[] | select(. != "debugger" and . != "tabCapture")]
' "$BUILD_DIR/manifest.json" > "$BUILD_DIR/manifest.json.tmp"

mv "$BUILD_DIR/manifest.json.tmp" "$BUILD_DIR/manifest.json"

# Fix the known parser error in this legacy source without changing Chrome's
# source file. This can be removed once the shared source is corrected.
if [[ -f "$BUILD_DIR/sources/bilibilicom.js" ]]; then
    sed -i "s/querySelector('#chat-items')=true;/querySelector('#chat-items').marked=true;/g" "$BUILD_DIR/sources/bilibilicom.js"
fi

echo "Validating generated manifest and required entry points..."
jq empty "$BUILD_DIR/manifest.json"

required_files=(
    "manifest.json"
    "service_worker.js"
    "background.html"
    "background.js"
    "popup.html"
    "popup.js"
    "settings/options.html"
    "thirdparty/NotoColorEmoji.ttf"
    "thirdparty/kokoro-ort-wasm-simd-threaded.jsep.wasm"
    "thirdparty/ort-wasm-simd-threaded.jsep.mjs"
    "thirdparty/ort-wasm.wasm"
    "thirdparty/ort-wasm-simd.wasm"
    "thirdparty/piper/piper_phonemize.wasm"
    "thirdparty/piper/piper_phonemize.data"
    "thirdparty/transformersjs/ort/ort-wasm-simd-threaded.asyncify.mjs"
    "thirdparty/transformersjs/ort/ort-wasm-simd-threaded.asyncify.wasm"
    "thirdparty/transformersjs/ort/ort-wasm-simd-threaded.mjs"
    "thirdparty/transformersjs/ort/ort-wasm-simd-threaded.wasm"
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$BUILD_DIR/$file" ]]; then
        echo "ERROR: Required Firefox package file is missing: $file" >&2
        exit 1
    fi
done

# Match AMO's archive checks before uploading or retrying a rejected build.
# https://github.com/mozilla/addons-server/blob/master/src/olympia/lib/settings_base.py
python3 - "$BUILD_DIR" <<'PY'
from pathlib import Path
import sys

files = [(path, path.stat().st_size) for path in Path(sys.argv[1]).rglob('*') if path.is_file()]
total = sum(size for _, size in files)
print(f"Firefox build size (uncompressed): {total / 1024 / 1024:.2f} MiB")
if total >= 250 * 1024 * 1024 or any(size > 100 * 1024 * 1024 for _, size in files):
    print("ERROR: Firefox package exceeds AMO's 250 MiB total or 100 MiB per-file limit.", file=sys.stderr)
    for path, size in sorted(files, key=lambda item: item[1], reverse=True)[:10]:
        print(f"  {size / 1024 / 1024:.2f} MiB {path}", file=sys.stderr)
    sys.exit(1)
PY
echo "Firefox Add-on build ready in: $BUILD_DIR/"
