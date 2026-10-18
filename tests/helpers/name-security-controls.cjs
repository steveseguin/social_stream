const assert = require('node:assert/strict');
const { read } = require('./chat-security-harness.cjs');

// Serve an isolated copy with only these display checks disabled. This verifies
// each probe reaches the vulnerable sink; it never changes production files.
function positiveControl(file) {
    let source = read(file);
    source = source.replace(/\(window\.SocialStreamChatHTML \? SocialStreamChatHTML\.sanitize\((.+?)\) : fallbackEscapeHtml\(\1\)\)/g, '$1');
    if (file === 'themes/overlay-credits.html') {
        source = source.replace(/escapeCssUrlAttribute\(data.chatimg\)/g, 'cssAttributeValue(data.chatimg)');
    } else {
        source = source.replace(/escapeCssUrlAttribute\(data.chatimg\)/g, 'data.chatimg');
    }
    // Avatars are URL-validated before escaping; the control removes both layers.
    source = source.replace(/sanitizeRelayUrl\((data\.(?:chatimg|backupChatimg)), true\)/g, '$1');
    source = source.replace(/escapeCssUrlAttribute\((avatarUrl|avatarSrc|safeChatImg)\)/g, '$1');
    source = source.replace(/(?:fallbackEscapeHtml|escapeHtml)\((data\.(?:chatimg|backupChatimg|id)|imgSrc|chatimg|avatarSrc|backupImage)\)/g, '$1');
    source = source.replace('fallbackEscapeHtml(entry.chatimg || "")', '(entry.chatimg || "")');
    source = source.replace("escapeHtml(message.chatimg || 'https://socialstream.ninja/sources/images/unknown.png')", "message.chatimg || 'https://socialstream.ninja/sources/images/unknown.png'");
    source = source.replace("template.content.appendChild(document.createElement('div'))", "document.createElement('div')");
    source = source.replace("nameTemplate.content.appendChild(document.createElement('div'))", "document.createElement('div')");
    return source;
}

async function routePositiveControl(page, file) {
    const script = file === 'chathistory.html' ? 'chathistory.js' : file;
    const source = positiveControl(script);
    assert.notEqual(source, read(script), script + ': locate the display check');
    await page.route('**/' + script + '*', route => route.fulfill({
        contentType: script.endsWith('.js') ? 'text/javascript' : 'text/html', body: source
    }));
}

module.exports = { positiveControl, routePositiveControl };
