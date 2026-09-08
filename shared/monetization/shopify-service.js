(function (root) {
 'use strict';
 root.SSNShopifyReceiver = function (host) {
  var busy = false, next = 0, status = 'Set up Shopify on this device';
  function state() { return host.privateState.shopifyReceiver || (host.privateState.shopifyReceiver = { key: '', webhook: '', shop: '', seen: [] }); }
  async function api(path, method, value, key) {
   var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 10000);
   try {
    var response = await fetch('https://api.socialstream.ninja/v1/shopify/' + path, { method: method || 'GET', credentials: 'omit', redirect: 'error', headers: { Authorization: 'Bearer ' + (key || state().key), 'Content-Type': 'application/json' }, body: value === undefined ? undefined : JSON.stringify(value), signal: controller.signal });
    var data;
    try { data = await response.json(); } catch (_) { throw new Error('Shopify receiver unavailable. Check the SSN API setup.'); }
    if (!response.ok) throw new Error(data.error || 'Could not reach the SSN receiver.');
    return data;
   } finally { clearTimeout(timer); }
  }
  async function prepare(updated, secret) {
   var p = state();
   if (!updated.enabled && !secret) return;
   if (!updated.shop) throw new Error('Enter your store.myshopify.com domain.');
   if (p.key && p.webhook && p.shop === updated.shop && !secret) return;
   if (p.webhook && p.shop !== updated.shop) throw new Error('Disconnect Shopify before changing stores.');
   if (!p.key) {
    p.key = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    await host.store();
   }
   var result = await api('connection', 'POST', { shop: updated.shop, secret: secret || '' });
   if (!/^https:\/\/api\.socialstream\.ninja\/v1\/shopify\/webhook\/[a-f0-9]{64}$/.test(result.webhook || '')) throw new Error('Invalid receiver URL.');
   p.webhook = result.webhook; p.shop = updated.shop;
   await host.store(); next = 0;
  }
  async function disconnect() {
   if (state().key) await api('connection', 'DELETE');
   host.privateState.shopifyReceiver = { key: '', webhook: '', shop: '', seen: [] };
   await host.store(); status = 'Disconnected';
  }
  function active(key) {
   var c = host.config().shopify;
   return host.isOn() && c.enabled && state().key === key && state().shop === c.shop && state().webhook;
  }
  async function poll() {
   var p = state(), key = p.key;
   if (!active(key) || busy || Date.now() < next) return;
   busy = true; next = Date.now() + 5000;
   try {
    var result = await api('events', 'GET', undefined, key);
    if (!Array.isArray(result.events) || result.events.length > 5 || !/^[a-f0-9]{32}$/.test(result.lease || '')) throw new Error('Invalid receiver response.');
    var ack = [];
    for (var i = 0; i < result.events.length; i++) {
     if (!active(key)) return;
     var event = result.events[i];
     if (!/^[a-zA-Z0-9_-]{1,128}$/.test(event.id || '') || !event.data || event.data.type !== 'shopify' || event.data.event !== 'purchase' || event.data.hasDonation !== undefined) throw new Error('Invalid receiver event.');
     if (p.seen.indexOf(event.id) === -1) {
      await host.deliver(Object.assign({}, event.data, { id: 'shopify:' + event.id }));
      p.seen.push(event.id); p.seen = p.seen.slice(-2000);
     }
     ack.push(event.id);
    }
    if (ack.length) {
     await host.store();
     if (!active(key)) return;
     await api('ack', 'POST', { lease: result.lease, ids: ack }, key);
    }
    status = !result.received ? 'Connected; waiting for a signed Shopify event' : result.lastKind === 'test' ? 'Shopify test received; no purchase alert sent' : result.lastKind === 'skipped' ? 'Signed event received; not a current paid order' : 'Shopify purchase received';
   } catch (_) { status = 'Receiver unavailable; queued purchases will retry'; }
   finally { busy = false; }
  }
  return { prepare: prepare, disconnect: disconnect, poll: poll, snapshot: function () { return { webhook: state().webhook, status: !host.config().shopify.enabled ? 'Disabled' : !host.isOn() ? 'SSN is off; purchases can queue for 7 days' : !state().webhook ? 'Set up Shopify on this device' : status }; } };
 };
})(typeof window !== 'undefined' ? window : this);
