import { formatTime, safeHtml } from '../utils/helpers.js';

const STATE_LABEL = {
  idle: 'Idle',
  connecting: 'Connecting...',
  connected: 'Connected',
  error: 'Error',
  disabled: 'Disabled'
};

export class BasePlugin {
  constructor(options) {
    const {
      id,
      name,
      description = '',
      messenger,
      onActivity = () => {},
      onStatus = () => {},
      autoConnect = false,
      controls = {}
    } = options || {};

    if (!id || !messenger) {
      throw new Error('BasePlugin requires an id and messenger');
    }

    this.id = id;
    this.name = name || id;
    this.description = description;
    this.messenger = messenger;
    this.onActivity = onActivity;
    this.onStatus = onStatus;

    this.autoConnect = Boolean(autoConnect);
    const defaultControls = { connect: true, disconnect: true };
    this.controls = { ...defaultControls, ...controls };

    this.state = 'idle';
    this.card = null;
    this.statusNode = null;
    this.bodyNode = null;
    this.connectBtn = null;
    this.disconnectBtn = null;
  }

  mount(container) {
    if (this.card) {
      container.appendChild(this.card);
      return;
    }

    const wrapper = document.createElement('article');
    wrapper.className = 'source-card';
    wrapper.setAttribute('role', 'listitem');
    wrapper.dataset.pluginId = this.id;

    const header = document.createElement('div');
    header.className = 'source-card__header';

    const title = document.createElement('div');
    title.className = 'source-card__title';
    title.textContent = this.name;

    const status = document.createElement('div');
    status.className = 'source-card__status';
    status.dataset.state = this.state;
    status.textContent = STATE_LABEL[this.state] || this.state;

    header.append(title, status);

    const body = document.createElement('div');
    body.className = 'source-card__body';

    if (this.description) {
      const desc = document.createElement('p');
      desc.className = 'source-card__description';
      desc.innerHTML = safeHtml(this.description);
      body.appendChild(desc);
    }

    const custom = this.renderBody(body) || null;

    let actions = null;
    if (this.controls.connect || this.controls.disconnect) {
      actions = document.createElement('div');
      actions.className = 'source-card__actions';
    }

    if (this.controls.connect && actions) {
      const connect = document.createElement('button');
      connect.type = 'button';
      connect.className = 'btn';
      connect.textContent = 'Connect';
      connect.addEventListener('click', () => this.handleConnect());
      actions.appendChild(connect);
      this.connectBtn = connect;
    }

    if (this.controls.disconnect && actions) {
      const disconnect = document.createElement('button');
      disconnect.type = 'button';
      disconnect.className = 'btn btn--ghost';
      disconnect.textContent = 'Disconnect';
      disconnect.disabled = true;
      disconnect.hidden = true;
      disconnect.addEventListener('click', () => this.handleDisconnect());
      actions.appendChild(disconnect);
      this.disconnectBtn = disconnect;
    }

    if (actions && actions.childNodes.length > 0) {
      body.append(actions);
    }

    wrapper.append(header, body);

    this.card = wrapper;
    this.bodyNode = body;
    this.statusNode = status;

    container.appendChild(wrapper);
  }

  renderBody() {
    // Subclasses can override to append extra controls.
    return null;
  }

  setState(next, meta) {
    if (this.state === next && !meta) {
      return;
    }

    this.state = next;
    if (this.statusNode) {
      this.statusNode.dataset.state = next;
      this.statusNode.textContent = STATE_LABEL[next] || next;
    }

    if (this.connectBtn) {
      this.connectBtn.disabled = next === 'connecting' || next === 'connected';
      this.connectBtn.hidden = next === 'connected';
    }
    if (this.disconnectBtn) {
      const showDisconnect = next === 'connected';
      this.disconnectBtn.disabled = !showDisconnect;
      this.disconnectBtn.hidden = !showDisconnect;
    }

    this.onStatus({ plugin: this.id, state: next, meta });

    if (typeof this.refreshStatus === 'function') {
      this.refreshStatus();
    }
  }

  handleConnect() {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }
    try {
      this.setState('connecting');
      this.enable();
    } catch (err) {
      this.reportError(err);
    }
  }

  handleDisconnect() {
    try {
      this.disable();
    } catch (err) {
      console.error(`${this.id} disconnect failed`, err);
    } finally {
      this.setState('idle');
    }
  }

  publish(payload, options = {}) {
    const { silent = false, note } = options;
    try {
      this.messenger.send(payload);
      if (!silent) {
        const summary = {
          id: payload?.id || null,
          preview: (payload?.chatmessage || '')
            .toString()
            .replace(/\s+/g, ' ')
            .slice(0, 80)
        };
        this.log(note || 'Message relayed', summary);
      }
    } catch (err) {
      this.reportError(err);
    }
  }

  log(message, detail) {
    this.onActivity({
      plugin: this.id,
      message,
      detail,
      timestamp: Date.now()
    });
  }

  reportError(error) {
    console.error(`${this.id} plugin error`, error);
    const description = error && error.message ? error.message : 'Unexpected error';
    this.setState('error', { message: description });
    this.log(`Error: ${description}`);
  }

  enable() {
    throw new Error('enable() must be implemented by subclass');
  }

  disable() {
    throw new Error('disable() must be implemented by subclass');
  }

  handleOAuthCallback() {
    // Optional override.
  }

  handleSessionStarted(sessionId) {
    if (!this.autoConnect) {
      return;
    }
    if (!this.shouldAutoConnect(sessionId)) {
      return;
    }
    this.handleConnect();
  }

  shouldAutoConnect() {
    return this.state === 'idle' && Boolean(this.messenger.getSessionId());
  }
}
