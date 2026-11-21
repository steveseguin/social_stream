const FALLBACK_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function encodeHtmlFallback(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => FALLBACK_ENTITIES[char] || char);
}

function createScratchElement(tagName = 'div') {
  if (typeof document !== 'undefined' && document?.createElement) {
    return document.createElement(tagName);
  }
  return null;
}

export function safeHtml(value) {
  const scratch = createScratchElement();
  if (!scratch) {
    return encodeHtmlFallback(value);
  }
  scratch.textContent = value ?? '';
  return scratch.innerHTML;
}

export function htmlToText(html) {
  // Template contents stay inert: even a detached div can run image handlers.
  const scratch = createScratchElement('template');
  if (!scratch) {
    if (html == null) {
      return '';
    }
    return String(html).replace(/<[^>]*>/g, '');
  }
  scratch.innerHTML = html ?? '';
  return scratch.content.textContent || '';
}

export function getChatPreviewText(message) {
  if (!message) {
    return '';
  }
  // A supplied preview is already plain text, including literal tags/entities.
  if (message.previewText != null) {
    return String(message.previewText);
  }
  const body = String(message.chatmessage ?? '');
  // Preserve the chatmessage format: textonly=true is literal text, without HTML parsing/filtering; false/missing permits HTML checked at its ingress boundary.
  return message.textonly ? body : htmlToText(body);
}
