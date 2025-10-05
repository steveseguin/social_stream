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
      controls = {},
      icon = null
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
    this.icon = icon;

    this.state = 'idle';
    this.card = null;
    this.statusNode = null;
    this.bodyNode = null;
    this.connectBtn = null;
    this.disconnectBtn = null;
    this.primaryNode = null;
    this.settingsNode = null;
    this.settingsToggle = null;
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

    const identity = document.createElement('div');
    identity.className = 'source-card__identity';

    if (this.icon) {
      const icon = document.createElement('img');
      icon.className = 'source-card__icon';
      icon.src = this.icon;
      icon.alt = `${this.name || this.id} icon`;
      icon.loading = 'lazy';
      icon.decoding = 'async';
      identity.appendChild(icon);
    }

    const title = document.createElement('div');
    title.className = 'source-card__title';
    title.textContent = this.name;
    identity.appendChild(title);

    const headerControls = document.createElement('div');
    headerControls.className = 'source-card__header-controls';

    const status = document.createElement('div');
    status.className = 'source-card__status';
    status.dataset.state = this.state;
    status.textContent = STATE_LABEL[this.state] || this.state;

    const settingsButton = createSettingsButton(`Show ${this.name} options`);

    headerControls.append(status, settingsButton);
    header.append(identity, headerControls);

    const body = document.createElement('div');
    body.className = 'source-card__body';

    const primary = document.createElement('div');
    primary.className = 'source-card__primary';

    const settings = document.createElement('div');
    const settingsId = `${this.id}-settings`;
    settings.id = settingsId;
    settings.className = 'source-card__settings';
    settings.hidden = true;

    settingsButton.setAttribute('aria-controls', settingsId);

    if (this.description) {
      const desc = document.createElement('p');
      desc.className = 'source-card__description';
      desc.innerHTML = safeHtml(this.description);
      primary.appendChild(desc);
    }

    if (typeof this.renderPrimary === 'function') {
      const renderResult = this.renderPrimary(primary);
      if (renderResult && renderResult !== primary) {
        primary.append(renderResult);
      }
    } else if (typeof this.renderBody === 'function') {
      const legacyResult = this.renderBody(primary);
      if (legacyResult && legacyResult !== primary) {
        primary.append(legacyResult);
      }
    }

    if (typeof this.renderSettings === 'function') {
      const settingsResult = this.renderSettings(settings);
      if (settingsResult && settingsResult !== settings) {
        settings.append(settingsResult);
      }
    }

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
      primary.append(actions);
    }

    if (!settings.hasChildNodes()) {
      settingsButton.hidden = true;
      settingsButton.disabled = true;
    } else {
      settingsButton.addEventListener('click', () => {
        this.toggleSettings();
      });
    }

    body.append(primary);
    body.append(settings);

    wrapper.append(header, body);

    this.card = wrapper;
    this.bodyNode = body;
    this.statusNode = status;
    this.primaryNode = primary;
    this.settingsNode = settings;
    this.settingsToggle = settingsButton;

    container.appendChild(wrapper);
  }

  renderBody() {
    // Legacy hook; subclasses should override renderPrimary / renderSettings instead.
    return null;
  }

  toggleSettings(forceState) {
    if (!this.settingsNode || !this.settingsToggle || this.settingsToggle.disabled) {
      return;
    }
    const expandedAttr = this.settingsToggle.getAttribute('aria-expanded');
    const expanded = expandedAttr === 'true';
    const next = typeof forceState === 'boolean' ? forceState : !expanded;
    this.settingsToggle.setAttribute('aria-expanded', String(next));
    this.settingsNode.hidden = !next;
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

const GEAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm9.46 3-1.07-.83a7.07 7.07 0 0 0 0-1.34l1.07-.83a1 1 0 0 0 .24-1.3l-1.9-3.3a1 1 0 0 0-1.25-.44l-1.26.5a7.13 7.13 0 0 0-1.16-.67l-.19-1.35a1 1 0 0 0-1-.86h-3.8a1 1 0 0 0-1 .86l-.19 1.35a7.13 7.13 0 0 0-1.16.67l-1.26-.5a1 1 0 0 0-1.25.44l-1.9 3.3a1 1 0 0 0 .24 1.3l1.07.83a6.8 6.8 0 0 0 0 1.34l-1.07.83a1 1 0 0 0-.24 1.3l1.9 3.3a1 1 0 0 0 1.25.44l1.26-.5c.37.26.76.49 1.16.67l.19 1.35a1 1 0 0 0 1 .86h3.8a1 1 0 0 0 1-.86l.19-1.35a7.13 7.13 0 0 0 1.16-.67l1.26.5a1 1 0 0 0 1.25-.44l1.9-3.3a1 1 0 0 0-.24-1.3z"/></svg>';

function createSettingsButton(label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-button';
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `<span class="sr-only">${label}</span>${GEAR_SVG}`;
  return btn;
}
