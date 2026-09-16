import { BasePlugin } from './basePlugin.js';
import { storage } from '../utils/storage.js';

const AUTH_KEY = 'facebookApiAuth';
const API_VERSION = 'v25.0'; // Matches sources/websocket/facebook.js.
const POLL_MS = 3000;

export function facebookVideoId(value) {
  const raw = String(value || '').trim();
  if (!raw || /^\d+$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !/(^|\.)facebook\.com$/i.test(url.hostname)) return '';
    const match = url.pathname.match(/\/(?:videos|reel)\/(\d+)(?:\/|$)/);
    const id = url.searchParams.get('v') || (match && match[1]) || '';
    return /^\d+$/.test(id) ? id : '';
  } catch (_) { return ''; }
}

// Same fields as the API source; Lite sends plain text, never comment HTML.
export function facebookComment(entry, videoId, pageId) {
  const from = entry.from || {};
  const attachment = entry.attachment;
  const image = attachment && attachment.media && attachment.media.image;
  const contentimg = image && typeof image.src === 'string' && /^https?:\/\//i.test(image.src) ? image.src : '';
  const body = entry.message || (attachment && (attachment.title || attachment.description)) ||
    (attachment && !contentimg ? '[Attachment]' : '');
  const payload = {
    platform: 'facebook', type: 'facebook', chatname: from.name || 'Facebook User',
    chatmessage: String(body),
    chatimg: from.id ? `https://graph.facebook.com/${encodeURIComponent(from.id)}/picture?type=normal` : '',
    contentimg, chatbadges: '', backgroundColor: '', textColor: '', hasDonation: '', membership: '', textonly: true,
    meta: { messageId: entry.id || '', permalink: entry.permalink_url || '', videoId: videoId || '', pageId: pageId || '' }
  };
  if (from.id) payload.userid = String(from.id);
  const timestamp = Date.parse(entry.created_time);
  if (Number.isFinite(timestamp)) payload.timestamp = timestamp;
  return payload;
}

export class FacebookPlugin extends BasePlugin {
  constructor(options) {
    super({ ...options, id: 'facebook', name: 'Facebook',
      description: 'Choose a Page in Options, or enter a video URL, then connect.' });
    this.generation = 0;
    this.timer = null;
    this.controller = null;
    this.pages = [];
    this.fieldCount = 0;
    this.onAuthStorage = event => {
      if (event.key === AUTH_KEY || event.key === null) {
        this.disable();
        this.readAuth();
      }
    };
    this.onAuthFocus = () => {
      if (this.state !== 'connected' && this.state !== 'connecting') this.readAuth();
    };
  }

  field(container, title, type = 'text') {
    const label = document.createElement('label');
    label.className = 'field';
    const span = document.createElement('span');
    span.className = 'field__label';
    span.id = `facebook-field-${++this.fieldCount}`;
    span.textContent = title;
    const input = document.createElement(type === 'select' ? 'select' : 'input');
    if (type !== 'select') input.type = type;
    input.setAttribute('aria-labelledby', span.id);
    input.autocomplete = 'off';
    label.append(span, input);
    container.append(label);
    return input;
  }

  renderPrimary(container) {
    const signIn = document.createElement('button');
    signIn.type = 'button';
    signIn.className = 'btn btn--ghost';
    signIn.textContent = 'Link Facebook';
    signIn.addEventListener('click', () => {
      const url = new URL('../sources/websocket/facebook.html?autoconnect=0', window.location.href);
      const popup = window.open(url.href, 'ssn-lite-facebook-auth', 'popup,width=720,height=800');
      this.authHint.textContent = popup
        ? 'Click Sign in with Facebook in the new window. Then return here and choose your Page in Options.'
        : 'Allow popups for this site, then click Link Facebook again.';
    });
    this.authHint = document.createElement('p');
    this.authHint.className = 'source-card__subtext';
    this.authHint.setAttribute('role', 'status');
    container.append(signIn, this.authHint);
    window.addEventListener('storage', this.onAuthStorage);
    window.addEventListener('focus', this.onAuthFocus);
  }

  renderSettings(container) {
    this.pageSelect = this.field(container, 'Facebook Page', 'select');
    this.pageSelect.addEventListener('change', () => {
      this.disable();
      storage.set('facebook.pageId', this.pageSelect.value);
    });
    this.videoInput = this.field(container, 'Facebook video URL or ID (optional)');
    this.videoInput.value = storage.get('facebook.video', '');
    this.videoInput.addEventListener('change', () => {
      this.disable();
      storage.set('facebook.video', this.videoInput.value.trim());
    });
    const hint = document.createElement('p');
    hint.className = 'source-card__subtext';
    hint.textContent = 'Leave the video blank to find the selected Page’s current live video. Only new comments are relayed. A video ID does not bypass Facebook permissions.';
    container.append(hint);
    const advanced = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Advanced: manual Page access';
    advanced.append(summary);
    container.append(advanced);
    this.manualPage = this.field(advanced, 'Manual Page ID (optional)');
    this.manualPage.value = storage.get('facebook.manualPageId', '');
    this.manualToken = this.field(advanced, 'Page access token (this tab only)', 'password');
    this.manualToken.spellcheck = false;
    this.manualPage.addEventListener('change', () => {
      this.disable();
      storage.set('facebook.manualPageId', this.manualPage.value.trim());
    });
    this.manualToken.addEventListener('change', () => this.disable());
    this.readAuth();
  }

  readAuth() {
    let auth = {};
    try { auth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}') || {}; } catch (_) {}
    this.pages = Array.isArray(auth.authPages) ? auth.authPages.filter(page => page && page.id && page.accessToken) : [];
    if (!this.pageSelect) return;
    const selected = this.pageSelect.value || storage.get('facebook.pageId', '') || auth.selectedPageId;
    this.pageSelect.textContent = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Choose a linked Page';
    this.pageSelect.append(empty);
    this.pages.forEach(page => {
      const option = document.createElement('option');
      option.value = String(page.id);
      option.textContent = page.name || String(page.id);
      this.pageSelect.append(option);
    });
    if (this.pages.some(page => String(page.id) === String(selected))) this.pageSelect.value = String(selected);
    else if (this.pages.length === 1) this.pageSelect.value = String(this.pages[0].id);
    if (this.authHint) this.authHint.textContent = this.pages.length
      ? 'Linked Pages are available in Options.' : 'Link Facebook to select a Page, or use manual Page access in Options.';
  }

  configuration() {
    const page = this.pages.find(item => String(item.id) === this.pageSelect.value);
    const manualToken = this.manualToken.value.trim();
    return {
      token: manualToken || (page && page.accessToken) || '',
      pageId: manualToken ? this.manualPage.value.trim() : (page ? String(page.id) : ''),
      videoId: facebookVideoId(this.videoInput.value)
    };
  }

  shouldAutoConnect() {
    const config = this.configuration();
    return super.shouldAutoConnect() && Boolean(config.token && (config.pageId || config.videoId));
  }

  async request(path, params, run) {
    const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`);
    Object.keys(params).forEach(key => url.searchParams.set(key, String(params[key])));
    // Keep tokens out of URLs, activity logs, and relay payloads.
    const controller = new AbortController();
    const cancel = () => controller.abort();
    run.controller.signal.addEventListener('abort', cancel);
    if (run.controller.signal.aborted) cancel();
    const timeout = setTimeout(cancel, 30000);
    try {
      const response = await fetch(url.href, { signal: controller.signal,
        headers: { Authorization: `Bearer ${run.token}` } });
      const data = await response.json();
      if (!response.ok || !data || data.error) {
        const error = new Error('Facebook request failed.');
        error.code = data && data.error && Number(data.error.code);
        error.status = response.status;
        throw error;
      }
      return data;
    } finally {
      clearTimeout(timeout);
      run.controller.signal.removeEventListener('abort', cancel);
    }
  }

  async enable() {
    this.disable();
    this.setState('connecting');
    const config = this.configuration();
    if (!config.token || (!config.pageId && !config.videoId) ||
        (this.videoInput.value.trim() && !config.videoId) || (config.pageId && !/^\d+$/.test(config.pageId))) {
      this.setState('error', { message: 'Choose a linked Page or supply a Page token and valid video/Page ID.' });
      return;
    }
    const run = { ...config, generation: this.generation, controller: new AbortController(),
      started: Date.now(), watermark: 0, maxTime: 0, seen: new Set(), primed: false,
      after: '', stream: true, failures: 0 };
    this.controller = run.controller;
    try {
      if (!run.videoId) {
        const data = await this.request(`${encodeURIComponent(run.pageId)}/live_videos`, {
          fields: 'id,title,permalink_url,status,creation_time', broadcast_status: JSON.stringify(['LIVE'])
        }, run);
        if (run.generation !== this.generation) return;
        const entry = Array.isArray(data.data) && data.data[0];
        if (!entry || !entry.id) {
          this.disable();
          this.setState('error', { message: 'No live video found. Enter a video URL or ID in Options.' });
          return;
        }
        run.videoId = String(entry.id);
      }
      await this.poll(run);
    } catch (error) { this.failed(error, run); }
  }

  async poll(run) {
    if (run.generation !== this.generation) return;
    try {
      const params = { fields: 'id,from{name,id},message,created_time,permalink_url,attachment', limit: 50,
        since: Math.max(0, Math.floor(Math.max(run.started, run.watermark) / 1000) - 1) };
      if (run.stream) params.live_filter = 'stream';
      else params.order = 'chronological';
      if (run.after) params.after = run.after;
      const data = await this.request(`${encodeURIComponent(run.videoId)}/comments`, params, run);
      if (run.generation !== this.generation) return;
      if (!Array.isArray(data.data)) throw new Error('Invalid Facebook response.');
      data.data.slice().sort((a, b) => Date.parse(a.created_time) - Date.parse(b.created_time)).forEach(entry => {
        if (!entry.id || run.seen.has(entry.id)) return;
        run.seen.add(entry.id);
        while (run.seen.size > 2000) run.seen.delete(run.seen.values().next().value);
        const timestamp = Date.parse(entry.created_time);
        if (Number.isFinite(timestamp)) run.maxTime = Math.max(run.maxTime, timestamp);
        if (!run.primed || !Number.isFinite(timestamp) || timestamp <= Math.max(run.started, run.watermark)) return;
        const payload = facebookComment(entry, run.videoId, run.pageId);
        if (payload.chatmessage || payload.contentimg) this.publish(payload);
      });
      const paging = data.paging;
      const after = paging && paging.next && paging.cursors && paging.cursors.after;
      run.after = after && after !== run.after ? after : '';
      if (!run.after) {
        run.primed = true;
        // Retain one second of overlap for comments with identical timestamps.
        run.watermark = Math.max(run.watermark, run.maxTime - 1000);
      }
      run.failures = 0;
      this.setState('connected');
      this.schedule(run, run.after ? 250 : POLL_MS);
    } catch (error) { this.failed(error, run); }
  }

  schedule(run, delay) {
    if (run.generation !== this.generation) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.poll(run), delay);
  }

  failed(error, run) {
    if (run.generation !== this.generation) return;
    if (error.code === 100 && run.stream) {
      run.stream = false;
      run.after = '';
      this.schedule(run, POLL_MS);
      return;
    }
    if ([10, 190, 200].includes(error.code) || error.status === 401 || error.status === 403) {
      this.disable();
      this.setState('error', { message: 'Facebook access expired or lacks permission. Link Facebook again and check Page access.' });
      return;
    }
    run.failures += 1;
    if (run.failures >= 5) {
      this.disable();
      this.setState('error', { message: 'Facebook could not be reached. Check the video and connection, then reconnect.' });
      return;
    }
    this.log('Facebook connection interrupted; retrying.');
    this.schedule(run, Math.min(30000, POLL_MS * Math.pow(2, run.failures)));
  }

  disable() {
    this.generation += 1;
    clearTimeout(this.timer);
    this.timer = null;
    if (this.controller) this.controller.abort();
    this.controller = null;
    this.setState('idle');
  }

  destroy() {
    this.disable();
    window.removeEventListener('storage', this.onAuthStorage);
    window.removeEventListener('focus', this.onAuthFocus);
    if (this.card) this.card.remove();
    this.card = null;
  }
}
