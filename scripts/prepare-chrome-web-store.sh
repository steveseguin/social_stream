#!/bin/bash
# Prepare a Chrome Web Store release by staging a policy-reduced extension build.
#
# This script intentionally trims features that are risky or not needed for the
# Chrome Web Store package. It also writes a policy audit report so the generated
# branch/zip can be reviewed before upload.

set -euo pipefail

BUILD_DIR="${CWS_BUILD_DIR:-cws-build}"
REPORT_FILE="${CWS_REPORT_FILE:-cws-policy-report.txt}"
STRICT="${CWS_STRICT:-1}"

BLOCKERS=0
WARNINGS=0

: > "$REPORT_FILE"

report() {
    printf '%s\n' "$*" | tee -a "$REPORT_FILE"
}

section() {
    report ""
    report "=== $* ==="
}

warn() {
    WARNINGS=$((WARNINGS + 1))
    report "WARNING: $*"
}

blocker() {
    BLOCKERS=$((BLOCKERS + 1))
    report "BLOCKER: $*"
}

remove_path() {
    local path="$1"
    if [[ -e "$BUILD_DIR/$path" ]]; then
        rm -rv "$BUILD_DIR/$path" | tee -a "$REPORT_FILE"
    fi
}

scan_blocker() {
    local title="$1"
    local pattern="$2"
    shift 2

    local tmp
    tmp="$(mktemp)"
    if grep -RInE "$pattern" "$@" > "$tmp"; then
        blocker "$title"
        cat "$tmp" | tee -a "$REPORT_FILE"
    fi
    rm -f "$tmp"
}

scan_warning() {
    local title="$1"
    local pattern="$2"
    shift 2

    local tmp
    tmp="$(mktemp)"
    if grep -RInE "$pattern" "$@" > "$tmp"; then
        warn "$title"
        cat "$tmp" | tee -a "$REPORT_FILE"
    fi
    rm -f "$tmp"
}

section "Preparing Chrome Web Store build"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

report "Copying files to $BUILD_DIR..."
rsync -a \
    --exclude='.git/' \
    --exclude='.github/' \
    --exclude='.gitignore' \
    --exclude='.gitattributes' \
    --exclude='.githooks/' \
    --exclude='.codex/' \
    --exclude='.codex-tmp/' \
    --exclude='docs/' \
    --exclude='games/' \
    --exclude='lite/' \
    --exclude='tests/' \
    --exclude='scripts/' \
    --exclude='themes/' \
    --exclude='sources/graveyard/' \
    --exclude='cws-build/' \
    --exclude='web-ext-artifacts/' \
    --exclude='node_modules/' \
    --exclude='tmp/' \
    --exclude='local-tts-bridge/' \
    --exclude='*.md' \
    --exclude="$REPORT_FILE" \
    --exclude='package.json' \
    --exclude='package-lock.json' \
    --exclude='eslint.config.js' \
    --exclude='.prettierrc' \
    --exclude='.htmlhintrc' \
    ./ "$BUILD_DIR/"

# Domains/files that have triggered or are likely to trigger mature-content
# policy review. This branch should not include adult streaming integrations.
ADULT_DOMAIN_PATTERNS=(
    "chaturbate\\.com"
    "cherry\\.tv"
    "myfreecams\\.com"
    "camsoda\\.com"
    "fansly\\.com"
    "simps\\.com"
    "stripchat\\.com"
    "bongacams\\.com"
    "cam4\\.com"
    "onlyfans\\.com"
)

ADULT_SOURCE_FILES=(
    "sources/chaturbate.js"
    "sources/cherrytv.js"
    "sources/myfreecams.js"
    "sources/camsoda.js"
    "sources/fansly.js"
    "sources/simps.js"
    "sources/stripchat.js"
    "sources/bongacams.js"
    "sources/cam4.js"
)

ADULT_SITE_NAMES=(
    "chaturbate"
    "cherrytv"
    "myfreecams"
    "camsoda"
    "fansly"
    "simps"
    "stripchat"
    "bongacams"
    "cam4"
    "onlyfans"
)

# Files with exact or near-exact remotely hosted script issues from prior
# Chrome Web Store feedback. Do not remove broad overlay surfaces here unless
# their in-package links are also hidden; missing advertised pages can trigger a
# separate non-functional rejection.
KNOWN_REMOTE_CODE_FILES=(
    "sources/websocket/bilibil.html"
    "streamelements-importer.html"
    "streamelements-importer.js"
)

# Extension pages/features that are policy-sensitive in the Web Store build
# unless they are audited and explicitly re-enabled.
POLICY_SENSITIVE_FILES=(
    "aiprompt.html"
    "aioverlay.html"
    "cohost-overlay.html"
    "message-ai-export.html"
    "message-ai-export.js"
    "local-browser-model-worker.js"
    "cohost-local-qwen-worker.js"
    "shared/ai"
    "shared/aiPrompt"
    "thirdparty/models"
    "thirdparty/transformersjs"
    "thirdparty/kitten-tts"
    "thirdparty/kitten_tts_nano_v0_1.onnx"
    "thirdparty/kokoro-bundle.es.ext.js"
    "thirdparty/kokoro-bundle.es.js"
    "thirdparty/kokoro-ort-wasm-simd-threaded.jsep.wasm"
    "thirdparty/kokoro-ort-wasm-simd.wasm"
    "thirdparty/kokoro-ort-wasm.wasm"
    "thirdparty/tf.min.js"
    "thirdparty/model.json"
    "thirdparty/metadata.json"
    "thirdparty/group1-shard1of1"
    "thirdparty/group2-shard1of1"
    "thirdparty/group3-shard1of1"
    "thirdparty/group4-shard1of3"
    "thirdparty/group4-shard2of3"
    "thirdparty/group4-shard3of3"
)

MISC_FILES_TO_REMOVE=(
    "badwords_sample.txt"
    "sample_midi_messages.txt"
    "robots.txt"
    "CNAME"
)

section "Removing excluded files"

for file in "${ADULT_SOURCE_FILES[@]}"; do
    remove_path "$file"
done

for file in "${KNOWN_REMOTE_CODE_FILES[@]}"; do
    remove_path "$file"
done

for file in "${POLICY_SENSITIVE_FILES[@]}"; do
    remove_path "$file"
done

for file in "${MISC_FILES_TO_REMOVE[@]}"; do
    remove_path "$file"
done

section "Cleaning policy-sensitive string references"

ADULT_NAMES_PATTERN=$(printf '%s\n' "${ADULT_SITE_NAMES[@]}" | paste -sd'|' -)

if [[ -f "$BUILD_DIR/actions/EventFlowEditor.js" ]]; then
    sed -i -E "/\{[[:space:]]*value:[[:space:]]*'($ADULT_NAMES_PATTERN)'/d" "$BUILD_DIR/actions/EventFlowEditor.js"
    for site in "${ADULT_SITE_NAMES[@]}"; do
        sed -i -E "s/'$site',[[:space:]]*//g; s/,[[:space:]]*'$site'//g" "$BUILD_DIR/actions/EventFlowEditor.js"
    done
    report "Cleaned actions/EventFlowEditor.js adult dropdown entries."
fi

if [[ -f "$BUILD_DIR/libs/colours.js" ]]; then
    sed -i -E "/case ['\"]($ADULT_NAMES_PATTERN)['\"]:/d" "$BUILD_DIR/libs/colours.js"
    report "Cleaned libs/colours.js adult colour cases."
fi

if [[ -f "$BUILD_DIR/events.html" ]]; then
    sed -i -E "/\\.($ADULT_NAMES_PATTERN)-event/d" "$BUILD_DIR/events.html"
    report "Cleaned events.html adult event styles."
fi

if [[ -f "$BUILD_DIR/thirdparty/lunr.js" ]]; then
    sed -i -E '/pulled from:[[:space:]]*https:\/\/unpkg\.com\/lunr\/lunr\.js/d' "$BUILD_DIR/thirdparty/lunr.js"
    report "Removed remote-source comment from thirdparty/lunr.js."
fi

if [[ -f "$BUILD_DIR/thirdparty/sentiment.js" ]]; then
    cat > "$BUILD_DIR/thirdparty/sentiment.js" <<'EOF'
/* Chrome Web Store build: local sentiment model assets are stripped. */
async function loadSentimentAnalysis() {
    if (typeof sentimentAnalysisLoaded !== "undefined") {
        sentimentAnalysisLoaded = false;
    }
    return false;
}

function inferSentiment() {
    return undefined;
}
EOF
    report "Replaced thirdparty/sentiment.js with Web Store no-op shim."
fi

section "Repairing kept Web Store pages"

if [[ -f "$BUILD_DIR/giveaway.html" ]]; then
    sed -i -E '/cdn\.tailwindcss\.com/d' "$BUILD_DIR/giveaway.html"
    sed -i -E '/tailwind\.config[[:space:]]*=/,/<\/script>/d' "$BUILD_DIR/giveaway.html"
    report "Removed remote Tailwind runtime from kept giveaway.html."
fi

if [[ -f "$BUILD_DIR/sampleoverlay.html" ]]; then
    sed -i -E 's#https://socialstream\.ninja/libs/colours\.js#./libs/colours.js#g' "$BUILD_DIR/sampleoverlay.html"
    report "Repointed sampleoverlay.html colours script to bundled libs/colours.js."
fi

if [[ -f "$BUILD_DIR/sampleapi.html" ]]; then
    sed -i -E '/https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\//d' "$BUILD_DIR/sampleapi.html"
    report "Removed remote CSS links from kept sampleapi.html."
fi

if [[ -f "$BUILD_DIR/popup.html" ]]; then
    sed -i -E '/streamelements-importer\.html/d' "$BUILD_DIR/popup.html"
    sed -i -E '/<option value="local(gemma|qwen)"/d' "$BUILD_DIR/popup.html"
    sed -i -E 's/qwen3\.5-0\.8b-onnx/Web Store local model stripped/g; s/gemma4-e2b-it-onnx/Web Store local model stripped/g' "$BUILD_DIR/popup.html"
    sed -i -E 's/Local Qwen[^"<]*/Web Store local model stripped/g; s/Local Gemma[^"<]*/Web Store local model stripped/g' "$BUILD_DIR/popup.html"
    sed -i -E 's|</head>|<style id="cws-stripped-features">.wrapper:has(#wrapper-chatbot-ai-prompt-options),.wrapper:has(#wrapper-chatbot-ai-overlay-options),div:has(>label.switch>input[data-param1="badkarma"]),div:has(>label.switch>input[data-setting="addkarma"]),#localgemmahost,#localbrowserhelp,#localgemmamodel,#localqwenmodel{display:none!important;}</style></head>|' "$BUILD_DIR/popup.html"
    report "Hid stripped AI prompt/overlay, local browser model, and sentiment controls and removed StreamElements importer link from popup.html."
fi

if [[ -f "$BUILD_DIR/popup.js" ]]; then
    sed -i -E '/id:[[:space:]]*"aiprompt"/d; /id:[[:space:]]*"aioverlay"/d' "$BUILD_DIR/popup.js"
    report "Removed stripped AI prompt/overlay page mappings from popup.js."
fi

if [[ -f "$BUILD_DIR/cohost.html" ]]; then
    sed -i -E '/<option value="local(gemma|qwen)"/d' "$BUILD_DIR/cohost.html"
    sed -i -E 's#thirdparty/models/(gemma4-e2b-it-onnx|qwen3\.5-0\.8b-onnx)#web-store-local-model-stripped#g; s/qwen3\.5-0\.8b-onnx/web-store-local-model-stripped/g; s/gemma4-e2b-it-onnx/web-store-local-model-stripped/g' "$BUILD_DIR/cohost.html"
    sed -i -E 's/Local Qwen[^"<]*/Web Store local model stripped/g; s/Local Gemma[^"<]*/Web Store local model stripped/g' "$BUILD_DIR/cohost.html"
    report "Removed selectable local browser model providers from cohost.html."
fi

section "Filtering manifest.json"

ADULT_DOMAIN_PATTERN=$(printf '%s\n' "${ADULT_DOMAIN_PATTERNS[@]}" | paste -sd'|' -)

jq --arg adult_pattern "$ADULT_DOMAIN_PATTERN" '
    .homepage_url = "https://socialstream.ninja/" |
    .permissions = ((.permissions // []) - ["activeTab"]) |
    .content_scripts = [
        (.content_scripts // [])[] |
        select((.matches // []) | all(test($adult_pattern; "i") | not))
    ] |
    .host_permissions = [
        (.host_permissions // [])[] |
        select(
            (test($adult_pattern; "i") | not) and
            (test("localhost"; "i") | not) and
            (test("127\\.0\\.0\\.1"; "i") | not) and
            (test("^file:"; "i") | not)
        )
    ] |
    .web_accessible_resources = [
        (.web_accessible_resources // [])[] |
        .resources = [
            (.resources // [])[] |
            select(
                test("^(shared/ai|shared/aiPrompt|local-browser-model-worker\\.js|cohost-local-qwen-worker\\.js)"; "i") | not
            )
        ] |
        select((.resources // []) | length > 0)
    ]
' "$BUILD_DIR/manifest.json" > "$BUILD_DIR/manifest.json.tmp"

mv "$BUILD_DIR/manifest.json.tmp" "$BUILD_DIR/manifest.json"

if ! jq empty "$BUILD_DIR/manifest.json" 2>/dev/null; then
    blocker "Generated manifest.json is invalid."
fi

section "Manifest summary"

ORIGINAL_CONTENT_SCRIPTS=$(jq '.content_scripts | length' manifest.json)
FILTERED_CONTENT_SCRIPTS=$(jq '.content_scripts | length' "$BUILD_DIR/manifest.json")
ORIGINAL_HOST_PERMS=$(jq '.host_permissions | length' manifest.json)
FILTERED_HOST_PERMS=$(jq '.host_permissions | length' "$BUILD_DIR/manifest.json")
FILTERED_PERMISSIONS=$(jq -r '.permissions | join(", ")' "$BUILD_DIR/manifest.json")
FILTERED_DESCRIPTION=$(jq -r '.description // ""' "$BUILD_DIR/manifest.json")

report "Content scripts: $ORIGINAL_CONTENT_SCRIPTS -> $FILTERED_CONTENT_SCRIPTS (removed $((ORIGINAL_CONTENT_SCRIPTS - FILTERED_CONTENT_SCRIPTS)))"
report "Host permissions: $ORIGINAL_HOST_PERMS -> $FILTERED_HOST_PERMS (removed $((ORIGINAL_HOST_PERMS - FILTERED_HOST_PERMS)))"
report "Permissions: $FILTERED_PERMISSIONS"
report "Description: $FILTERED_DESCRIPTION"

section "Hard policy scans"

scan_blocker \
    "Remote executable script tag remains in staged package." \
    '<script[^>]+src=["'\'']https?://' \
    "$BUILD_DIR"

scan_blocker \
    "Known CDN JavaScript URL remains in staged package." \
    'https://(cdnjs\.cloudflare\.com|ajax\.googleapis\.com|cdn\.jsdelivr\.net|unpkg\.com)/[^"'\'' )<>]+\.js' \
    "$BUILD_DIR"

scan_blocker \
    "Adult provider reference remains in manifest." \
    'stripchat|bongacams|cam4|chaturbate|cherry\.tv|myfreecams|camsoda|fansly|simps|onlyfans' \
    "$BUILD_DIR/manifest.json"

scan_blocker \
    "Adult provider reference remains in staged package." \
    'stripchat|bongacams|cam4|chaturbate|cherrytv|cherry\.tv|myfreecams|camsoda|fansly|simps|onlyfans' \
    "$BUILD_DIR"

scan_blocker \
    "Manifest still requests activeTab, which was previously rejected as unused." \
    '"activeTab"' \
    "$BUILD_DIR/manifest.json"

section "Review warnings"

scan_warning \
    "Dynamic JavaScript or obfuscation-sensitive strings remain; inspect each match before release." \
    'base64js|jsbase64|jsb64|new Function|eval\(|atob\(|customJS|uploadCustomJs' \
    "$BUILD_DIR"

scan_warning \
    "Broad or sensitive permissions remain; ensure dashboard privacy-field justifications match." \
    '"(debugger|tabs|tabCapture|identity)"|http://\*/\*|https://\*/\*|<all_urls>' \
    "$BUILD_DIR/manifest.json"

scan_warning \
    "Remote CDN/resource URL remains; inspect whether it is executable code, CSS, or data and bundle/remove if practical." \
    'https?://[^"'\'' <>]*(cdnjs\.cloudflare\.com|ajax\.googleapis\.com|cdn\.jsdelivr\.net|cdn\.tailwindcss\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)|<script[^>]+src=["'\'']https?://' \
    "$BUILD_DIR"

scan_warning \
    "Listing-sensitive claims remain; verify or remove from Web Store metadata/screenshots." \
    'Capture live chat|100\+ supported|disable chat services|Sound volume' \
    "$BUILD_DIR"

scan_warning \
    "References to stripped Web Store pages/features remain; remove UI links or restore audited files." \
    'aiprompt\.html|aioverlay\.html|cohost-overlay\.html|streamelements-importer|message-ai-export|local-browser-model-worker|cohost-local-qwen-worker|shared/ai|shared/aiPrompt|thirdparty/transformersjs' \
    "$BUILD_DIR"

section "Final result"

report "Blockers: $BLOCKERS"
report "Warnings: $WARNINGS"
report "Build directory: $BUILD_DIR"
report "Audit report: $REPORT_FILE"

if [[ "$STRICT" == "1" && "$BLOCKERS" -gt 0 ]]; then
    report "Strict mode is enabled; refusing to publish a Web Store build with blockers."
    exit 1
fi

report "Chrome Web Store build ready."
