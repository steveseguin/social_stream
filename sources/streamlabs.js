(function () {
  const SOURCE_TYPE = 'streamlabs';
  const IFRAME_ID = 'sl_frame';
  let lastSignature = null;
  let activeObserver = null;

  function sanitizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function sendToApp(message) {
    try {
      if (window.chrome?.runtime?.id) {
        window.chrome.runtime.sendMessage(window.chrome.runtime.id, { message }, function () {});
        return;
      }
    } catch (error) {
      console.warn('[Streamlabs] Failed to send via chrome.runtime', error);
    }
    try {
      if (window.ninjafy?.sendMessage) {
        window.ninjafy.sendMessage(null, { message }, null, window.__SSAPP_TAB_ID__ || null);
        return;
      }
    } catch (error) {
      console.warn('[Streamlabs] Failed to send via ninjafy', error);
    }
    try {
      const payload = Object.assign({ message }, window.__SSAPP_TAB_ID__ !== undefined ? { __tabID__: window.__SSAPP_TAB_ID__ } : {});
      window.postMessage(payload, '*');
    } catch (error) {
      console.warn('[Streamlabs] Failed to postMessage payload', error);
    }
  }

  function detectEventType(messageText, tokens) {
    const text = (messageText || '').toLowerCase();
    if (text.includes('following')) return 'follow';
    if (text.includes('cheer') || text.includes('bits')) return 'cheer';
    if (text.includes('raiding') || text.includes('raid')) return 'raid';
    if (text.includes('redeemed')) return 'redeem';
    if (text.includes('bought')) return 'merch';
    if (text.includes('gifted') && text.includes('membership')) return 'gift';
    if (text.includes('sponsor')) return 'sponsor';
    if (text.includes('super chat')) return 'superchat';
    if (text.includes('donated')) return 'donation';
    if (text.includes('subscribed')) return 'subscription';
    if (text.includes('tip')) return 'donation';
    if (tokens?.product) return 'merch';
    return 'event';
  }

  function deriveDonation(tokens, messageText, eventType) {
    const amountToken = sanitizeText(tokens?.amount || tokens?.currency || '');
    const currencyToken = sanitizeText(tokens?.currency || '');
    const message = sanitizeText(messageText || '');

    // Bits / cheers
    if (eventType === 'cheer' && amountToken) {
      return { hasDonation: `${amountToken} bits`, donoValue: Number(amountToken) || null };
    }

    // Monetary amounts
    const amountMatch = amountToken || (message.match(/[$€£¥]\s*\d+([\.,]\d+)?/i) || [])[0];
    if (amountMatch) {
      const hasDonation = currencyToken ? `${amountMatch} ${currencyToken}` : amountMatch;
      const numeric = Number.parseFloat(amountMatch.replace(/[^0-9.]+/g, ''));
      return { hasDonation, donoValue: Number.isFinite(numeric) ? numeric : null };
    }
    return { hasDonation: '', donoValue: null };
  }

  function buildPayload(snapshot) {
    const { messageTemplate, userMessage, imageSrc, tokens, messageText } = snapshot || {};
    if (!messageTemplate && !userMessage && !imageSrc && !messageText) return null;

    const chatmessage = sanitizeText(userMessage || messageTemplate || messageText || 'Alert');
    const eventType = detectEventType(messageText || messageTemplate || '', tokens);
    const nameToken = sanitizeText(tokens?.name || tokens?.gifter || '');
    const { hasDonation, donoValue } = deriveDonation(tokens, messageTemplate || messageText, eventType);

    const filteredTokens = {};
    Object.entries(tokens || {}).forEach(([key, value]) => {
      const normalizedKey = (key || '').toLowerCase();
      if (['name', 'gifter', 'amount', 'currency'].includes(normalizedKey)) return;
      filteredTokens[key] = value;
    });

    const meta = {};
    if (Object.keys(filteredTokens).length) {
      meta.tokens = filteredTokens;
    }

    const payload = {
      type: SOURCE_TYPE,
      event: eventType,
      chatname: nameToken || 'Streamlabs Alert',
      chatmessage,
      contentimg: imageSrc || '',
      meta
    };
    if (hasDonation) {
      payload.hasDonation = hasDonation;
      if (donoValue !== null) {
        payload.donoValue = donoValue;
      }
    }
    return payload;
  }

  function snapshotFromDocument(doc) {
    if (!doc) return null;
    const messageEl = doc.querySelector('#alert-message');
    const userMessageEl = doc.querySelector('#alert-user-message');
    const imageEl =
      doc.querySelector('#alert-image img') ||
      doc.querySelector('#alert-image-wrap img') ||
      doc.querySelector('#alert-image');

    const messageTemplate = messageEl ? sanitizeText(messageEl.textContent) : '';
    const userMessage = userMessageEl ? sanitizeText(userMessageEl.textContent) : '';
    const messageText = sanitizeText(messageEl ? messageEl.innerText || messageEl.textContent : '');
    const tokens = {};
    doc.querySelectorAll('[data-token]').forEach((node) => {
      const key = sanitizeText(node.getAttribute('data-token'));
      if (key) tokens[key] = sanitizeText(node.textContent);
    });
    let imageSrc = '';
    if (imageEl) {
      imageSrc = sanitizeText(imageEl.getAttribute('src') || imageEl.style?.backgroundImage || imageEl.textContent);
      if (imageSrc.startsWith('url(')) {
        imageSrc = imageSrc.replace(/^url\(["']?/, '').replace(/["']?\)$/, '').trim();
      }
    }
    return { messageTemplate, userMessage, imageSrc, tokens, messageText };
  }

  function handleSnapshot(doc) {
    const snapshot = snapshotFromDocument(doc);
    const payload = buildPayload(snapshot);
    if (!payload) return;
    const signature = JSON.stringify([
      payload.chatmessage,
      payload.contentimg,
      snapshot.messageTemplate,
      snapshot.userMessage,
      payload.event,
      payload.hasDonation
    ]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    sendToApp(payload);
  }

  function observeDocument(doc) {
    if (!doc || !doc.documentElement) return;
    if (doc.__SS_STREAMLABS_OBSERVED) return;
    try {
      doc.__SS_STREAMLABS_OBSERVED = true;
    } catch (error) {
      // ignore if we cannot mark the document
    }
    handleSnapshot(doc);
    try {
      if (activeObserver) {
        activeObserver.disconnect();
      }
      activeObserver = new MutationObserver(function () {
        handleSnapshot(doc);
      });
      activeObserver.observe(doc.documentElement, { childList: true, subtree: true });
    } catch (error) {
      console.warn('[Streamlabs] Mutation observer failed', error);
    }
  }

  function initInsideFrame() {
    observeDocument(document);
  }

  function initFromTop() {
    const iframe = document.getElementById(IFRAME_ID) || document.querySelector('iframe[src*="alertbox"]');
    if (!iframe) {
      setTimeout(initFromTop, 800);
      return;
    }
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
      observeDocument(iframe.contentDocument);
    }
    iframe.addEventListener('load', function () {
      if (iframe.contentDocument) {
        observeDocument(iframe.contentDocument);
      }
    });
  }

  if (window.self !== window.top) {
    initInsideFrame();
  } else {
    initFromTop();
  }
})();
