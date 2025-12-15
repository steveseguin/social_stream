#!/bin/bash
# Prepare Chrome Web Store release by filtering out restricted content
# This script removes:
#   - Adult site content scripts and related files
#   - The docs/ folder
#   - Development/localhost references
#   - External CDN resource references where needed

set -euo pipefail

BUILD_DIR="cws-build"

# Adult site patterns to filter
ADULT_DOMAINS=(
    "chaturbate.com"
    "cherry.tv"
    "myfreecams.com"
    "www.myfreecams.com"
    "camsoda.com"
    "www.camsoda.com"
    "fansly.com"
    "simps.com"
)

ADULT_SOURCE_FILES=(
    "sources/chaturbate.js"
    "sources/cherrytv.js"
    "sources/myfreecams.js"
    "sources/camsoda.js"
    "sources/fansly.js"
    "sources/simps.js"
)

# Website-hosted files (accessed via https://socialstream.ninja, not chrome-extension://)
# These are overlay/widget pages intended for OBS browser sources, not extension UI
WEBSITE_HOSTED_FILES=(
    "dock.html"
    "featured.html"
    "events.html"
    "actions.html"
    "poll.html"
    "hype.html"
    "wordcloud.html"
    "waitlist.html"
    "tipjar.html"
    "ticker.html"
    "sampleoverlay.html"
    "samplefeatured.html"
    "sampleemote.html"
)

# Misc files not needed for extension
MISC_FILES_TO_REMOVE=(
    "badwords_sample.txt"
    "sample_midi_messages.txt"
    "robots.txt"
)

echo "=== Preparing Chrome Web Store Build ==="

# Clean and create build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "Copying files to build directory..."
# Copy everything except excluded folders and files
rsync -av \
    --exclude='.git/' \
    --exclude='.github/' \
    --exclude='.gitignore' \
    --exclude='.gitattributes' \
    --exclude='.githooks/' \
    --exclude='docs/' \
    --exclude='games/' \
    --exclude='lite/' \
    --exclude='tests/' \
    --exclude='scripts/' \
    --exclude='cws-build/' \
    --exclude='web-ext-artifacts/' \
    --exclude='node_modules/' \
    --exclude='*.md' \
    ./ "$BUILD_DIR/"

echo "Removing adult site source files..."
for file in "${ADULT_SOURCE_FILES[@]}"; do
    if [[ -f "$BUILD_DIR/$file" ]]; then
        rm -v "$BUILD_DIR/$file"
    fi
done

echo "Removing website-hosted files (OBS overlay pages)..."
for file in "${WEBSITE_HOSTED_FILES[@]}"; do
    if [[ -f "$BUILD_DIR/$file" ]]; then
        rm -v "$BUILD_DIR/$file"
    fi
done

echo "Removing misc unnecessary files..."
for file in "${MISC_FILES_TO_REMOVE[@]}"; do
    if [[ -f "$BUILD_DIR/$file" ]]; then
        rm -v "$BUILD_DIR/$file"
    fi
done

echo "Filtering manifest.json..."

# Build jq filter for adult domains
# Filter content_scripts entries that match adult sites
# Filter host_permissions that match adult sites or dev patterns

ADULT_DOMAIN_PATTERN=$(printf '%s\n' "${ADULT_DOMAINS[@]}" | paste -sd'|' -)

jq --arg adult_pattern "$ADULT_DOMAIN_PATTERN" '
# Filter content_scripts - remove entries matching adult sites
.content_scripts = [
    .content_scripts[] |
    select(
        (.matches | all(test($adult_pattern) | not))
    )
] |

# Filter host_permissions - remove adult sites and dev patterns
.host_permissions = [
    .host_permissions[] |
    select(
        (test($adult_pattern) | not) and
        (test("localhost") | not) and
        (test("127\\.0\\.0\\.1") | not) and
        (test("^file:") | not)
    )
]
' "$BUILD_DIR/manifest.json" > "$BUILD_DIR/manifest.json.tmp"

mv "$BUILD_DIR/manifest.json.tmp" "$BUILD_DIR/manifest.json"

echo "Validating filtered manifest.json..."
if ! jq empty "$BUILD_DIR/manifest.json" 2>/dev/null; then
    echo "ERROR: Generated manifest.json is invalid!" >&2
    exit 1
fi

# Count what was filtered
ORIGINAL_CONTENT_SCRIPTS=$(jq '.content_scripts | length' manifest.json)
FILTERED_CONTENT_SCRIPTS=$(jq '.content_scripts | length' "$BUILD_DIR/manifest.json")
ORIGINAL_HOST_PERMS=$(jq '.host_permissions | length' manifest.json)
FILTERED_HOST_PERMS=$(jq '.host_permissions | length' "$BUILD_DIR/manifest.json")

echo ""
echo "=== Build Summary ==="
echo "Content scripts: $ORIGINAL_CONTENT_SCRIPTS -> $FILTERED_CONTENT_SCRIPTS (removed $((ORIGINAL_CONTENT_SCRIPTS - FILTERED_CONTENT_SCRIPTS)))"
echo "Host permissions: $ORIGINAL_HOST_PERMS -> $FILTERED_HOST_PERMS (removed $((ORIGINAL_HOST_PERMS - FILTERED_HOST_PERMS)))"
echo ""
echo "Excluded folders: docs/, games/, lite/, tests/, scripts/, .github/, .githooks/"
echo "Excluded patterns: *.md (markdown files)"
echo "Removed adult site files: ${#ADULT_SOURCE_FILES[@]} source files"
echo "Removed website-hosted files: ${#WEBSITE_HOSTED_FILES[@]} overlay pages"
echo "Removed misc files: ${#MISC_FILES_TO_REMOVE[@]} files"
echo ""
echo "Chrome Web Store build ready in: $BUILD_DIR/"
