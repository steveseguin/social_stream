export function buildDockUrl(sessionId, { dockParams = '' } = {}) {
  const trimmed = (sessionId || '').trim();
  if (!trimmed) {
    return '';
  }

  const extra = dockParams ? `&${dockParams.replace(/^&+/, '')}` : '';
  return `https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=false&room=${encodeURIComponent(trimmed)}&push=${encodeURIComponent(trimmed)}&vd=0&ad=0&autostart&cleanoutput&view&label=SocialStream${extra}`;
}

export class DockMessenger {
  constructor(frame, { debug = false, onDebug = null } = {}) {
    this.frame = frame;
    this.sessionId = null;
    this.pending = [];
    this.ready = false;
    this.debug = Boolean(debug);
    this.onDebug = typeof onDebug === 'function' ? onDebug : null;

    if (!this.frame) {
      throw new Error('DockMessenger requires an iframe element.');
    }

    this.frameHidden = this.frame.hasAttribute('hidden');
    this.frame.addEventListener('load', () => {
      this.ready = true;
      this.debugLog('Dock iframe loaded', { pending: this.pending.length });
      this.flush();
    });
  }

  setSessionId(sessionId, { dockParams = '' } = {}) {
    const trimmed = (sessionId || '').trim();
    if (!trimmed) {
      this.pending = [];
      this.sessionId = null;
      this.ready = false;
      this.frame.removeAttribute('src');
      this.frame.hidden = true;
      return;
    }

    if (trimmed === this.sessionId && this.frame.src) {
      return;
    }

    this.sessionId = trimmed;
    this.pending = [];
    this.ready = false;

    const nextSrc = buildDockUrl(trimmed, { dockParams });
    this.frame.src = nextSrc;
    this.frame.hidden = this.frameHidden;
    this.debugLog('Updated dock session', { sessionId: trimmed, src: nextSrc });
  }

  getSessionId() {
    return this.sessionId;
  }

  send(message) {
    if (!this.sessionId) {
      throw new Error('Cannot send message without an active session.');
    }

    if (!this.ready || !this.frame.contentWindow) {
      this.pending.push(message);
      this.debugLog('Queued message until dock is ready', {
        pending: this.pending.length,
        message
      });
      return;
    }

    this.post(message);
  }

  post(message) {
    try {
      const payload = { sendData: { overlayNinja: message }, type: 'pcs' };
      this.debugLog('Posting message to dock iframe', { payload });
      this.frame.contentWindow.postMessage(payload, '*');

      const target = this.frame.contentWindow;
      if (target && typeof target.processInput === 'function') {
        try {
          target.processInput(message);
        } catch (err) {
          this.debugLog('Direct processInput relay failed', { error: err?.message || err });
        }
      } else if (target && typeof target.processData === 'function') {
        try {
          target.processData({ contents: message });
        } catch (err) {
          this.debugLog('Direct processData relay failed', { error: err?.message || err });
        }
      }
    } catch (err) {
      console.error('Failed to post message to dock iframe', err);
    }
  }

  flush() {
    if (!this.ready || !this.frame.contentWindow) {
      return;
    }
    if (this.pending.length > 0) {
      this.debugLog('Flushing queued messages to dock', { count: this.pending.length });
    }
    while (this.pending.length) {
      const msg = this.pending.shift();
      this.post(msg);
    }
  }

  debugLog(message, detail) {
    if (!this.debug) {
      return;
    }
    if (detail !== undefined) {
      console.debug('[DockMessenger]', message, detail);
    } else {
      console.debug('[DockMessenger]', message);
    }
    if (this.onDebug) {
      try {
        this.onDebug({
          plugin: 'system',
          message: `[debug] ${message}`,
          detail,
          timestamp: Date.now()
        });
      } catch (err) {
        console.warn('DockMessenger debug callback failed', err);
      }
    }
  }
}
