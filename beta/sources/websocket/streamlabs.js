(function () {
  const SOCKET_HOST = 'https://sockets.streamlabs.com';
  const STORAGE_KEYS = {
    token: 'streamlabs:socketToken',
    webhook: 'streamlabs:webhookUrl',
    autoConnect: 'streamlabs:autoConnect',
    forwardEnabled: 'streamlabs:forwardEnabled'
  };

  const elements = {
    tokenInput: document.getElementById('socket-token'),
    webhookInput: document.getElementById('webhook-url'),
    autoConnectToggle: document.getElementById('auto-connect'),
    enableWebhookToggle: document.getElementById('enable-webhook'),
    webhookBlock: document.getElementById('webhook-block'),
    connectBtn: document.getElementById('connect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    connectionChip: document.getElementById('connection-chip'),
    statusDetail: document.getElementById('status-detail'),
    lastEvent: document.getElementById('last-event'),
    forwardCount: document.getElementById('forward-count'),
    webhookCount: document.getElementById('webhook-count'),
    errorCount: document.getElementById('error-count'),
    log: document.getElementById('event-log'),
    instructionsBlock: document.getElementById('instructions-block')
  };

  const state = {
    socket: null,
    status: 'disconnected',
    forwardCount: 0,
    webhookCount: 0,
    errorCount: 0
  };

  function readFromStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('Streamlabs storage read failed', error);
      return null;
    }
  }

  function writeToStorage(key, value) {
    try {
      if (value === null || typeof value === 'undefined') {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('Streamlabs storage write failed', error);
    }
  }

  function logEvent(message, extra, level = 'info') {
    if (!elements.log) return;
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `[${time}] ${level.toUpperCase()}: ${message}${
      extra ? `<span> ${extra}</span>` : ''
    }`;
    elements.log.appendChild(entry);
    elements.log.scrollTop = elements.log.scrollHeight;
    const maxEntries = 200;
    while (elements.log.childNodes.length > maxEntries) {
      elements.log.removeChild(elements.log.firstChild);
    }
  }

  function setStatus(status, detail) {
    state.status = status;
    const chip = elements.connectionChip;
    chip.className = 'status-chip';
    if (status === 'connected') chip.classList.add('connected');
    if (status === 'connecting') chip.classList.add('connecting');
    if (status === 'error') chip.classList.add('error');
    chip.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    if (elements.statusDetail) {
      elements.statusDetail.textContent = detail || '';
    }
    if (elements.connectBtn && elements.disconnectBtn) {
      elements.connectBtn.disabled = status === 'connecting' || status === 'connected';
      elements.disconnectBtn.disabled = status === 'disconnected';
    }
    notifyStatus(status, detail);
    updateInstructionsVisibility();
  }

  function updateStats() {
    if (elements.forwardCount) elements.forwardCount.textContent = String(state.forwardCount);
    if (elements.webhookCount) elements.webhookCount.textContent = String(state.webhookCount);
    if (elements.errorCount) elements.errorCount.textContent = String(state.errorCount);
  }

  function getActiveToken() {
    return (elements.tokenInput?.value || '').trim();
  }

  function getWebhookUrl() {
    if (!elements.enableWebhookToggle?.checked) return '';
    return (elements.webhookInput?.value || '').trim();
  }

  function updateInstructionsVisibility() {
    if (!elements.instructionsBlock) return;
    const hasToken = !!getActiveToken();
    const isConnected = state.status === 'connected';
    elements.instructionsBlock.classList.toggle('hidden', hasToken || isConnected);
  }

  function ensureSocketClient() {
    if (typeof window.io === 'function') return true;
    const msg = 'Socket.io client not loaded. Check that ../lite/vendor/socket.io.min.js is reachable.';
    logEvent(msg, null, 'error');
    setStatus('error', 'Socket.io client missing');
    return false;
  }

  function disconnectSocket(reason) {
    if (!state.socket) return;
    try {
      state.socket.off('event', handleStreamlabsEvent);
      state.socket.disconnect();
    } catch (error) {
      console.warn('Streamlabs socket cleanup failed', error);
    }
    state.socket = null;
    setStatus('disconnected', reason || 'Disconnected');
  }

  function connectSocket() {
    if (!ensureSocketClient()) return;
    const token = getActiveToken();
    if (!token) {
      logEvent('No socket token provided', null, 'error');
      setStatus('error', 'Add your Socket API token first');
      return;
    }
    writeToStorage(STORAGE_KEYS.token, token);
    const url = `${SOCKET_HOST}?token=${encodeURIComponent(token)}`;
    try {
      disconnectSocket('Reconnecting');
      setStatus('connecting', 'Opening Streamlabs socket…');
      const socket = window.io(url, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5
      });
      state.socket = socket;
      socket.on('connect', () => {
        setStatus('connected', 'Live events will appear below');
        logEvent('Connected to Streamlabs socket');
      });
      socket.on('connect_error', (error) => {
        state.errorCount += 1;
        updateStats();
        setStatus('error', error?.message || 'Connect error');
        logEvent('Streamlabs connection failed', error?.message, 'error');
      });
      socket.on('disconnect', (reason) => {
        setStatus('disconnected', reason || 'Socket closed');
        logEvent('Streamlabs socket closed', reason || '');
      });
      socket.on('event', handleStreamlabsEvent);
    } catch (error) {
      state.errorCount += 1;
      updateStats();
      logEvent('Failed to start Streamlabs socket', error?.message, 'error');
      setStatus('error', 'Could not start socket');
    }
  }

  function notifyStatus(status, message) {
    const payload = { wssStatus: { platform: 'streamlabs', status, message } };
    relayPayload(payload, false);
  }

  function sanitizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function sanitizeString(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value.trim();
    return String(value).trim();
  }

  function normalizeEventType(baseType, entry) {
    const normalized = (baseType || '').toLowerCase();
    if (normalized === 'subscription' && entry?.type) {
      const entryType = String(entry.type).toLowerCase();
      if (entryType.includes('resub')) return 'resub';
      if (entryType.includes('gift')) return 'gift';
    }
    return normalized || 'event';
  }

  function deriveDonationValue(baseType, entry) {
    if (baseType !== 'donation') return '';
    if (entry?.formatted_amount) return sanitizeString(entry.formatted_amount);
    if (entry?.amount) {
      const amount = sanitizeString(entry.amount);
      const currency = sanitizeString(entry.currency || '');
      return currency ? `${amount} ${currency}` : amount;
    }
    return '';
  }

  function normalizeStreamlabsEvent(payload) {
    if (!payload || typeof payload !== 'object') return [];
    const baseType = payload.type || '';
    const platformTag = payload.for || '';
    const messages = Array.isArray(payload.message) ? payload.message : [payload.message];
    const events = [];

    messages.forEach((entryRaw) => {
      if (!entryRaw) return;
      const entry = typeof entryRaw === 'object' ? entryRaw : {};
      const type = normalizeEventType(baseType, entry);
      const name =
        entry.from ||
        entry.name ||
        entry.display_name ||
        entry.username ||
        entry.user ||
        'Someone';
      const donation = deriveDonationValue(baseType, entry);
      const msg =
        sanitizeString(entry.message || entry.body || entry.text || entry.alert_message) ||
        (donation ? 'Thank you for your support!' : sanitizeString(baseType));

      const numericAmount = sanitizeNumber(entry.amount);
      const meta = cleanMeta({
        rawType: baseType || null,
        sourcePlatform: platformTag || null,
        alertType: entry.type || null,
        currency: entry.currency || null,
        amount: numericAmount,
        formattedAmount: donation || entry.formatted_amount || null,
        months: entry.months || entry.streak_months || entry.cumulative_months || null,
        plan: entry.plan || entry.sub_plan || entry.tier || null,
        item: entry.item || entry.product || null,
        quantity: entry.quantity || null,
        viewers: entry.viewers || entry.raiders || entry.raider_viewers || null,
        isTest: !!(payload.isTest || entry.isTest || entry.is_test),
        alertId: entry.id || entry._id || payload.event_id || null,
        createdAt: payload.created_at || entry.created_at || null
      });

      const normalized = {
        platform: 'streamlabs',
        type,
        event: type,
        chatname: sanitizeString(name) || 'Someone',
        chatmessage: msg,
        chatimg:
          entry.image ||
          entry.image_href ||
          entry.avatar ||
          entry.profile_image ||
          entry.picture ||
          '',
        hasDonation: donation,
        meta
      };

      if (numericAmount !== null && donation) {
        normalized.donoValue = numericAmount;
      }
      events.push(normalized);
    });

    return events;
  }

  function cleanMeta(meta) {
    const output = {};
    Object.keys(meta).forEach((key) => {
      const value = meta[key];
      if (value === undefined || value === null || value === '') return;
      output[key] = value;
    });
    return output;
  }

  function relayPayload(payload, bumpForwardCount = true) {
    try {
      if (window.chrome?.runtime?.id) {
        window.chrome.runtime.sendMessage(window.chrome.runtime.id, payload, () => {});
      } else if (window.ninjafy?.sendMessage) {
        window.ninjafy.sendMessage(
          null,
          payload,
          null,
          typeof window.__SSAPP_TAB_ID__ !== 'undefined' ? window.__SSAPP_TAB_ID__ : null
        );
      } else {
        const fallback = { ...payload };
        if (typeof window.__SSAPP_TAB_ID__ !== 'undefined') {
          fallback.__tabID__ = window.__SSAPP_TAB_ID__;
        }
        window.postMessage(fallback, '*');
      }
      if (bumpForwardCount) {
        state.forwardCount += Array.isArray(payload.messages)
          ? payload.messages.length
          : payload.message
            ? 1
            : 0;
        updateStats();
      }
    } catch (error) {
      state.errorCount += 1;
      updateStats();
      logEvent('Relay failed', error?.message, 'error');
    }
  }

  async function forwardWebhook(events) {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;
    const payload = Array.isArray(events) ? events : [events];
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'streamlabs', events: payload })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      state.webhookCount += 1;
      updateStats();
    } catch (error) {
      state.errorCount += 1;
      updateStats();
      logEvent('Webhook post failed', error?.message || '', 'error');
    }
  }

  async function handleStreamlabsEvent(payload) {
    const events = normalizeStreamlabsEvent(payload);
    if (!events.length) {
      logEvent('Received unrecognized Streamlabs payload', JSON.stringify(payload), 'warn');
      return;
    }

    state.lastEvent = Date.now();
    if (elements.lastEvent) {
      elements.lastEvent.textContent = new Date().toLocaleTimeString();
    }

    const relayPayloadShape = events.length === 1 ? { message: events[0] } : { messages: events };
    relayPayload(relayPayloadShape, true);
    forwardWebhook(events);

    events.forEach((event) => {
      const summary = `${event.chatname || 'Someone'} → ${event.type}${
        event.hasDonation ? ` (${event.hasDonation})` : ''
      }`;
      logEvent('Streamlabs event', summary);
    });
  }

  function applyStoredSettings() {
    const params = new URLSearchParams(window.location.search);
    const storedToken = params.get('token') || readFromStorage(STORAGE_KEYS.token);
    if (storedToken && elements.tokenInput) {
      elements.tokenInput.value = storedToken;
    }

    const storedWebhook = params.get('webhook') || readFromStorage(STORAGE_KEYS.webhook);
    if (storedWebhook && elements.webhookInput) {
      elements.webhookInput.value = storedWebhook;
      elements.enableWebhookToggle.checked = true;
      toggleWebhookVisibility(true);
    }

    const autoParam = params.get('autoconnect');
    const shouldAutoConnect =
      autoParam !== null ? autoParam !== '0' : readFromStorage(STORAGE_KEYS.autoConnect) === 'true';
    if (elements.autoConnectToggle) {
      elements.autoConnectToggle.checked = shouldAutoConnect;
    }

    const forwardEnabledParam = params.get('forward');
    if (forwardEnabledParam !== null) {
      elements.enableWebhookToggle.checked = forwardEnabledParam !== '0';
    } else {
      elements.enableWebhookToggle.checked =
        readFromStorage(STORAGE_KEYS.forwardEnabled) === 'true' || !!storedWebhook;
    }
    toggleWebhookVisibility(elements.enableWebhookToggle.checked);

    if (shouldAutoConnect && storedToken) {
      connectSocket();
    } else {
      setStatus('disconnected', 'Waiting for a token.');
    }
    updateInstructionsVisibility();
  }

  function toggleWebhookVisibility(enabled) {
    if (!elements.webhookBlock) return;
    elements.webhookBlock.classList.toggle('hidden', !enabled);
  }

  function wireControls() {
    elements.connectBtn?.addEventListener('click', () => connectSocket());
    elements.disconnectBtn?.addEventListener('click', () => disconnectSocket('Manual disconnect'));
    elements.tokenInput?.addEventListener('input', updateInstructionsVisibility);
    elements.autoConnectToggle?.addEventListener('change', (event) => {
      writeToStorage(STORAGE_KEYS.autoConnect, event.target.checked ? 'true' : 'false');
    });
    elements.enableWebhookToggle?.addEventListener('change', (event) => {
      const enabled = event.target.checked;
      toggleWebhookVisibility(enabled);
      writeToStorage(STORAGE_KEYS.forwardEnabled, enabled ? 'true' : 'false');
    });
    elements.webhookInput?.addEventListener('change', (event) => {
      const value = (event.target.value || '').trim();
      if (value) {
        writeToStorage(STORAGE_KEYS.webhook, value);
      } else {
        writeToStorage(STORAGE_KEYS.webhook, null);
      }
    });
  }

  wireControls();
  applyStoredSettings();
  window.addEventListener('beforeunload', () => disconnectSocket('Page closed'));
})(); 
