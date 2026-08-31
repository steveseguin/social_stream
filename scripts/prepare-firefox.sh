#!/bin/bash
# Prepare a Firefox Add-on build from the extension sources.

set -euo pipefail

BUILD_DIR="${FIREFOX_BUILD_DIR:-firefox-build}"

echo "=== Preparing Firefox Add-on Build ==="

# Stage the extension directly. The old Chrome Web Store preparation script was
# intentionally removed, so Firefox must not depend on its generated output.
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

rsync -a \
    --exclude='.git/' \
    --exclude='.github/' \
    --exclude='.gitignore' \
    --exclude='.gitattributes' \
    --exclude='.githooks/' \
    --exclude='.agents/' \
    --exclude='.claude/' \
    --exclude='.codex*/' \
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
    --exclude='artifacts/' \
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
)

for file in "${required_files[@]}"; do
    if [[ ! -f "$BUILD_DIR/$file" ]]; then
        echo "ERROR: Required Firefox package file is missing: $file" >&2
        exit 1
    fi
done

BUILD_SIZE=$(du -sm "$BUILD_DIR" | cut -f1)
echo "Firefox build size (uncompressed): ${BUILD_SIZE}MB"
echo "Firefox Add-on build ready in: $BUILD_DIR/"
