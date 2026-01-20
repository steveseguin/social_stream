// NinjaBridge: lightweight wrapper to use VDONinjaSDK for data-channel transport
// Falls back to iframe logic in callers when not instantiated.

(function () {
  class NinjaBridge extends EventTarget {
    constructor(opts = {}) {
      super();
      if (typeof VDONinjaSDK === 'undefined') {
        throw new Error('VDONinjaSDK not available. Ensure sources/grabvideo.js is loaded.');
      }

      this.opts = Object.assign(
        {
          debug: false,
          // Use VDO.Ninja's signaling server (same as vdo.socialstream.ninja iframe)
          wss: 'wss://wss.socialstream.ninja',
          label: 'SocialStream',
          announce: true,
        },
        opts
      );

      this.vdo = null;
      this.room = null;
      this.password = false;
      this.streamID = null;
      this.connected = false;

      // uuid -> label mapping (eg. 'dock', 'ticker', ...)
      this.labelsByUUID = {};
      // Track remote streams we've attempted to view
      this._viewedStreams = new Set();
    }

    async init({ room, password, streamID }) {
      this.room = room;
      this.password = password && password !== 'false' ? password : false;
      this.streamID = streamID || null;

      this.vdo = new VDONinjaSDK({
        wss: this.opts.wss,
        debug: !!this.opts.debug,
        password: this.password !== false ? this.password : false,
        // Ensure VDO.Ninja salt behaviour
        salt: 'vdo.ninja',
        // Default our identity label for downstream connections
        label: this.opts.label || 'SocialStream',
        // Be kind to infra: conservative reconnects with exponential backoff
        maxReconnectAttempts: 7,
        reconnectDelay: 2000,
      });

      this._bindEvents();
      // Set up auto-view handlers before we join so we don't miss initial listing
      this._enableAutoView();
      await this.vdo.connect();

      // Join the room
      await this.vdo.joinRoom({ room, password: this.password || false });

      if (this.opts.announce) {
        // Publish a data-only stream. If streamID provided, use it (for main extension).
        // If not provided, SDK will generate a random one (for dock/overlays).
        try {
          const announceOpts = {
            label: this.opts.label || 'SocialStream',
            allowchunked: true,
            iframe: false,
            widget: false,
          };
          if (this.streamID) {
            announceOpts.streamID = this.streamID;
          }
          const actualStreamID = await this.vdo.announce(announceOpts);
          // Track the actual streamID (important for random IDs so we don't auto-view ourselves)
          if (!this.streamID && actualStreamID) {
            this.streamID = actualStreamID;
          }
        } catch (e) {
          // If publish fails (older SDK), continue with DC-only viewer below
          if (this.opts.debug) console.warn('NinjaBridge: publish failed; continuing', e);
        }
      }

      // Auto-view handlers already enabled above

      this.connected = true;
      this._syncGlobalPeers();
      this.dispatchEvent(new CustomEvent('ready'));
      return true;
    }

    _bindEvents() {
      // Track peers and their labels as they appear in listings/updates
      const labelHandler = (e) => {
        const { uuid, label } = e.detail || {};
        if (!uuid) return;
        if (label) {
          this.labelsByUUID[uuid] = label;
          this._syncGlobalPeers();
          this.dispatchEvent(
            new CustomEvent('peerLabel', { detail: { uuid, label } })
          );
        }
      };
      // Try a few likely event names for broad SDK compatibility
      this.vdo.addEventListener('peerListing', labelHandler);
      this.vdo.addEventListener('peerUpdated', labelHandler);
      this.vdo.addEventListener('peerConnected', labelHandler);
      // Full SDK emits granular listing and info events as well
      this.vdo.addEventListener('listing', labelHandler);
      // Peer info carries label under detail.info.label
      this.vdo.addEventListener('peerInfo', (e) => {
        const d = e.detail || {};
        const uuid = d.uuid;
        const label = d.info && d.info.label;
        if (uuid && label) {
          this.labelsByUUID[uuid] = label;
          this._syncGlobalPeers();
          this.dispatchEvent(new CustomEvent('peerLabel', { detail: { uuid, label } }));
        }
      });

      // If connection object already has a label, record it
      this.vdo.addEventListener('peerConnected', (e) => {
        const { uuid, connection } = e.detail || {};
        if (uuid && connection && connection.info && connection.info.label) {
          this.labelsByUUID[uuid] = connection.info.label;
          this._syncGlobalPeers();
          this.dispatchEvent(new CustomEvent('peerLabel', { detail: { uuid, label: connection.info.label } }));
        }
      });

      // Cleanup on disconnects
      this.vdo.addEventListener('peerDisconnected', (e) => {
        const { uuid } = e.detail || {};
        if (uuid && this.labelsByUUID[uuid]) {
          delete this.labelsByUUID[uuid];
          this._syncGlobalPeers();
          this.dispatchEvent(
            new CustomEvent('peerRemoved', { detail: { uuid } })
          );
        }
      });

      this.vdo.addEventListener('disconnected', () => {
        this.connected = false;
      });

      // Route data payloads from peers
      const dataHandler = (ev) => {
        try {
          if (this.opts.debug) console.log('NinjaBridge: raw data event', ev);
          const pkt = ev.detail && (ev.detail.data || ev.detail);
          const uuid = ev.detail && (ev.detail.uuid || ev.detail.peer || ev.detail.id);
          const data = pkt && (pkt.detail?.data || pkt.data || pkt);
          if (this.opts.debug) console.log('NinjaBridge: parsed data', { uuid, data });
          if (!data) return;
          // Pass through data as-is; let handlers check for overlayNinja
          this.dispatchEvent(
            new CustomEvent('data', { detail: { uuid, data } })
          );
        } catch (e) {
          if (this.opts.debug) console.warn('NinjaBridge: data handler error', e);
        }
      };
      // Try both event names used across SDK versions
      this.vdo.addEventListener('dataReceived', dataHandler);
      this.vdo.addEventListener('data', dataHandler);
    }

    _enableAutoView() {
      const maybeView = (streamID) => {
        try {
          if (!streamID) return;
          // Don't view our own published stream
          if (this.streamID && streamID === this.streamID) return;
          // Also check SDK's internal streamID (in case it was set after init)
          if (this.vdo && this.vdo.state && this.vdo.state.streamID === streamID) return;
          if (this._viewedStreams.has(streamID)) return;
          this._viewedStreams.add(streamID);
          if (this.opts.debug) console.log('NinjaBridge: auto-viewing stream', streamID);
          this.vdo.view(streamID, { audio: false, video: false, label: this.opts.label || 'SocialStream' }).catch((e) => {
            if (this.opts.debug) console.warn('NinjaBridge: auto-view failed', streamID, e);
            // Allow retry later by removing from set
            this._viewedStreams.delete(streamID);
          });
        } catch (e) { if (this.opts.debug) console.warn('NinjaBridge: maybeView error', e); }
      };

      // Handle complete listings and per-item listings
      this.vdo.addEventListener('listing', (e) => {
        const d = e.detail || {};
        if (Array.isArray(d.list)) {
          d.list.forEach((item) => {
            const streamID = typeof item === 'string' ? item : item && item.streamID;
            if (streamID) maybeView(streamID);
          });
        } else if (d.streamID) {
          maybeView(d.streamID);
        }
      });

      // Handle new streams announced
      this.vdo.addEventListener('streamAdded', (e) => {
        const { streamID } = e.detail || {};
        if (streamID) maybeView(streamID);
      });
      this.vdo.addEventListener('videoaddedtoroom', (e) => {
        const { streamID } = e.detail || {};
        if (streamID) maybeView(streamID);
      });
    }

    _syncGlobalPeers() {
      try {
        // Keep background.js' global mapping in sync if it exists
        if (typeof window !== 'undefined' && window.connectedPeers) {
          // Overwrite keys without replacing the object reference
          const target = window.connectedPeers;
          const selfUUID = (this.vdo && this.vdo.state && this.vdo.state.uuid) ? this.vdo.state.uuid : null;
          // Remove missing
          for (const k of Object.keys(target)) {
            if (!(k in this.labelsByUUID)) delete target[k];
          }
          // Add/update
          for (const [k, v] of Object.entries(this.labelsByUUID)) {
            if (selfUUID && k === selfUUID) continue;
            target[k] = v;
          }
        }
      } catch (e) {
        console.warn('NinjaBridge: failed to sync global peers', e);
      }
    }

    isReady() {
      return !!(this.vdo && this.connected);
    }

    getPeers() {
      return Object.assign({}, this.labelsByUUID);
    }

    // Send to a specific UUID or broadcast to all peers with an optional label filter
    async send(data, uuid = null) {
      if (!this.isReady()) throw new Error('NinjaBridge not ready');
      const payload = { overlayNinja: data };
      if (uuid) {
        try {
          await this.vdo.sendData(payload, { uuid, preference: 'all', allowFallback: true });
          return true;
        } catch (e) {
          console.warn('NinjaBridge send error (uuid)', e);
          return false;
        }
      }

      // Default broadcast to all peers
      try {
        await this.vdo.sendData(payload, { preference: 'all', allowFallback: true });
        return true;
      } catch (e) {
        console.warn('NinjaBridge broadcast error', e);
        return false;
      }
    }

    async sendToLabel(data, label) {
      if (!this.isReady()) throw new Error('NinjaBridge not ready');
      const targets = Object.keys(this.labelsByUUID).filter(
        (uuid) => this.labelsByUUID[uuid] === label
      );
      const payload = { overlayNinja: data };
      let ok = true;
      for (const uuid of targets) {
        try {
          await this.vdo.sendData(payload, { uuid, preference: 'all', allowFallback: true });
        } catch (e) {
          console.warn('NinjaBridge sendToLabel error', label, uuid, e);
          ok = false;
        }
      }
      return ok;
    }

    async destroy() {
      try {
        if (this.vdo) {
          try { this.vdo.stopPublishing && this.vdo.stopPublishing(); } catch(e){}
          await this.vdo.leaveRoom();
        }
      } catch (e) {
        // ignore
      } finally {
        this.vdo = null;
        this.connected = false;
        this.labelsByUUID = {};
        this._syncGlobalPeers();
      }
    }
  }

  window.NinjaBridge = NinjaBridge;
})();
