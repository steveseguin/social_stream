#!/bin/bash
# Prepare Firefox Add-on build
# This script:
#   - Starts from the Chrome Web Store build (filtered content)
#   - Transforms manifest.json for Firefox compatibility
#   - Removes TTS model files to stay under 200MB limit
#   - Fixes known JavaScript syntax errors

set -euo pipefail

BUILD_DIR="firefox-build"
CWS_BUILD_DIR="cws-build"

echo "=== Preparing Firefox Add-on Build ==="

# First, run the Chrome Web Store preparation if it hasn't been run
if [[ ! -d "$CWS_BUILD_DIR" ]]; then
    echo "Running Chrome Web Store preparation first..."
    chmod +x scripts/prepare-chrome-web-store.sh
    ./scripts/prepare-chrome-web-store.sh
fi

# Clean and create Firefox build directory
rm -rf "$BUILD_DIR"
cp -r "$CWS_BUILD_DIR" "$BUILD_DIR"

echo "Removing TTS model files (Firefox has 200MB limit)..."
# Remove Piper TTS voice models
rm -rf "$BUILD_DIR/thirdparty/piper/piper-voices"
# Remove Kitten TTS models
rm -rf "$BUILD_DIR/thirdparty/kitten-tts"
# Remove standalone ONNX model files
rm -f "$BUILD_DIR/thirdparty/"*.onnx

echo "Transforming manifest.json for Firefox compatibility..."

# Firefox MV3 uses background.scripts instead of service_worker
# Also need to add data_collection_permissions and remove unsupported permissions
jq '
# Transform background from service_worker to scripts (Firefox MV3)
.background = {
    "scripts": [.background.service_worker]
} |

# Add data_collection_permissions (required for Firefox)
.browser_specific_settings.gecko.data_collection_permissions = {
    "telemetry_data_collection": false,
    "telemetry_data_retention": false,
    "user_data_collection": false
} |

# Remove permissions not supported by Firefox
.permissions = [.permissions[] | select(. != "debugger" and . != "tabCapture")]
' "$BUILD_DIR/manifest.json" > "$BUILD_DIR/manifest.json.tmp"

mv "$BUILD_DIR/manifest.json.tmp" "$BUILD_DIR/manifest.json"

echo "Fixing JavaScript syntax errors for Firefox validation..."

# Fix bilibilicom.js line 214 - invalid assignment to querySelector result
# Original: document.querySelector("iframe").contentWindow.document.body.querySelector('#chat-items')=true;
# Fixed: document.querySelector("iframe").contentWindow.document.body.querySelector('#chat-items').marked=true;
if [[ -f "$BUILD_DIR/sources/bilibilicom.js" ]]; then
    sed -i "s/querySelector('#chat-items')=true;/querySelector('#chat-items').marked=true;/g" "$BUILD_DIR/sources/bilibilicom.js"
    echo "  Fixed: sources/bilibilicom.js (invalid assignment)"
fi

echo "Validating transformed manifest.json..."
if ! jq empty "$BUILD_DIR/manifest.json" 2>/dev/null; then
    echo "ERROR: Generated manifest.json is invalid!" >&2
    exit 1
fi

# Calculate build size
BUILD_SIZE=$(du -sm "$BUILD_DIR" | cut -f1)
echo ""
echo "=== Firefox Build Summary ==="
echo "Build size: ${BUILD_SIZE}MB (Firefox limit: 200MB)"
if (( BUILD_SIZE > 200 )); then
    echo "WARNING: Build size exceeds 200MB limit!" >&2
fi
echo ""
echo "Manifest transformations:"
echo "  - Changed background.service_worker to background.scripts"
echo "  - Added browser_specific_settings.gecko.data_collection_permissions"
echo "  - Removed unsupported permissions: debugger, tabCapture"
echo ""
echo "Removed TTS models:"
echo "  - thirdparty/piper/piper-voices/"
echo "  - thirdparty/kitten-tts/"
echo "  - thirdparty/*.onnx"
echo ""
echo "Firefox Add-on build ready in: $BUILD_DIR/"
