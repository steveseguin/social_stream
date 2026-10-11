#!/bin/bash
# Prepare a Firefox Add-on build from the extension sources.

set -euo pipefail

BUILD_DIR="${FIREFOX_BUILD_DIR:-firefox-build}"

echo "=== Preparing Firefox Add-on Build ==="

# Stage the extension directly. The old Chrome Web Store preparation script was
# intentionally removed, so Firefox must not depend on its generated output.
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Firefox includes browser voices, eSpeak, and API-based AI/TTS. Larger local
# engines and models are omitted to stay within the add-on size limit.
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
    --exclude='/thirdparty/models/' \
    --exclude='/thirdparty/transformersjs/' \
    --exclude='/thirdparty/neural-tts/' \
    --exclude='/thirdparty/piper/' \
    --exclude='/thirdparty/kitten-tts/' \
    --exclude='/thirdparty/kokoro*' \
    --exclude='/thirdparty/ort-wasm*' \
    --exclude='thirdparty/*.onnx' \
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

# Keep unavailable choices visible for saved settings, but prevent new selections.
python3 - "$BUILD_DIR" <<'PY'
from pathlib import Path
import json
import re
import sys

root = Path(sys.argv[1])
# The legacy eSpeak loader evaluates a constant expression to create Module.
# Initialize it directly in Firefox staging without relaxing extension CSP.
worker_path = root / 'thirdparty/espeakng.worker.js'
worker = worker_path.read_text(encoding='utf-8')
bootstrap = 'Module=eval("(function() { try { return Module || {} } catch(e) { return {} } })()")'
if worker.count(bootstrap) != 1:
    raise SystemExit('Unexpected eSpeak bootstrap; review Firefox CSP compatibility.')
worker_path.write_bytes(worker.replace(bootstrap, 'Module={}').encode('utf-8'))

unavailable = {'kokoro', 'kitten', 'piper', 'localgemma', 'localqwen', 'localqwen2b', 'ibm', 'qwen', 'semantic'}

def disable_option(match):
    attrs, label = match.groups()
    value = re.search(r'\bvalue="([^"]+)"', attrs)
    if not value or value.group(1) not in unavailable:
        return match.group()
    return '<option' + attrs + ' disabled>' + label + ' (not included in Firefox)</option>'

for page in ('popup.html', 'cohost.html'):
    path = root / page
    source = path.read_text(encoding='utf-8')
    source = re.sub(r'<option([^>]*)>([^<]*)</option>', disable_option, source)
    path.write_bytes(source.encode('utf-8'))

manifest_path = root / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for group in manifest.get('web_accessible_resources', []):
    group['resources'] = [resource for resource in group['resources']
                          if not resource.startswith(('thirdparty/models/', 'thirdparty/neural-tts/', 'thirdparty/piper/'))]
manifest_path.write_bytes((json.dumps(manifest, indent=2) + '\n').encode('utf-8'))
PY

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
    "thirdparty/espeak-ng-real.js"
    "thirdparty/espeakng-simple.js"
    "thirdparty/espeakng.worker.js"
    "thirdparty/espeakng.worker.data"
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
