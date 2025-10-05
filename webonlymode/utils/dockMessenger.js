export class DockMessenger {
  constructor(frame) {
    this.frame = frame;
    this.sessionId = null;
    this.pending = [];
    this.ready = false;

    if (!this.frame) {
      throw new Error('DockMessenger requires an iframe element.');
    }

    this.frameHidden = this.frame.hasAttribute('hidden');
    this.frame.addEventListener('load', () => {
      this.ready = true;
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
    const params = new URLSearchParams({ session: trimmed, liteRelay: '1', cleanoutput: '1' });
    const base = '../dock.html';
    const extra = dockParams ? `&${dockParams.replace(/^&+/, '')}` : '';
    const nextSrc = `${base}?${params.toString()}${extra}`;

    this.frame.src = nextSrc;
    this.frame.hidden = this.frameHidden;
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
      return;
    }

    this.post(message);
  }

  post(message) {
    try {
      const payload = { sendData: { overlayNinja: message }, type: 'pcs' };
      this.frame.contentWindow.postMessage(payload, '*');
    } catch (err) {
      console.error('Failed to post message to dock iframe', err);
    }
  }

  flush() {
    if (!this.ready || !this.frame.contentWindow) {
      return;
    }
    while (this.pending.length) {
      const msg = this.pending.shift();
      this.post(msg);
    }
  }
}
