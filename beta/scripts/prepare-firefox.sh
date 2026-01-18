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

# Fix typo in content_scripts (runs_at -> run_at)
.content_scripts = (.content_scripts | map(if has("runs_at") then .run_at = .runs_at | del(.runs_at) else . end)) |

# Add data_collection_permissions (required for Firefox 140+)
# "none" means the extension does not collect/transmit personal data
.browser_specific_settings.gecko.data_collection_permissions = {
    "required": ["none"],
    "optional": []
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

echo "Adding Firefox messaging compatibility shim to background.js..."
# Firefox MV3 handles async message responses differently than Chrome.
# In Chrome, 'return true' keeps the message channel open for async sendResponse.
# In Firefox MV3 with background scripts, we need to return a Promise instead.
# This shim wraps chrome.runtime.onMessage.addListener to handle this difference.
FIREFOX_SHIM='// Firefox MV3 messaging compatibility shim
// Firefox returns the raw return value (true/Promise) to the caller instead of waiting for sendResponse
// This shim ensures async responses work correctly
(function() {
    const isFirefox = typeof browser !== "undefined" && browser.runtime && browser.runtime.id;
    if (!isFirefox) {
        return;
    }

    console.log("[Firefox Shim] Applying messaging compatibility fix");
    const wrapAddListener = function(target) {
        if (!target || !target.onMessage || !target.onMessage.addListener) {
            console.warn("[Firefox Shim] onMessage not available", target);
            return;
        }

        const original = target.onMessage.addListener.bind(target.onMessage);
        target.onMessage.addListener = function(listener) {
            original(function(request, sender, sendResponse) {
                let responded = false;
                const wrappedSendResponse = function(response) {
                    responded = true;
                    sendResponse(response);
                };
                const result = listener(request, sender, wrappedSendResponse);
                // If result is a Promise, return it for Firefox async handling
                if (result && typeof result.then === "function") {
                    return result.then(function(val) {
                        // If sendResponse was called, return undefined to let it handle response
                        // Otherwise return the resolved value
                        return responded ? undefined : val;
                    });
                }
                // Keep channel open if sendResponse might be called later
                if (result === true) {
                    return new Promise(function() {});
                }
                return result;
            });
        };
    };

    if (typeof browser !== "undefined" && browser.runtime) {
        wrapAddListener(browser.runtime);
    }
    if (typeof chrome !== "undefined" && chrome.runtime && chrome !== browser) {
        wrapAddListener(chrome.runtime);
    }
})();
'

# Prepend the shim to background.js
if [[ -f "$BUILD_DIR/background.js" ]]; then
    echo "$FIREFOX_SHIM" | cat - "$BUILD_DIR/background.js" > "$BUILD_DIR/background.js.tmp"
    mv "$BUILD_DIR/background.js.tmp" "$BUILD_DIR/background.js"
    echo "  Fixed: background.js (Firefox messaging compatibility)"
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
