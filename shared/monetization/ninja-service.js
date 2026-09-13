(function (root) {
 'use strict';
 root.SSNNinjaReceiver = function (host) {
  var busy = false, next = 0, status = 'Set up reliable delivery';
  function state() { return host.privateState.receiver || (host.privateState.receiver = { key: '', webhook: '', username: '', seen: [] }); }
  async function api(path, method, value, key) {
   var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 10000);
   try {
    var response = await fetch('https://api.socialstream.ninja/v1/ninjabacker/' + path, { method: method || 'GET', credentials: 'omit', redirect: 'error', headers: { Authorization: 'Bearer ' + (key || state().key), 'Content-Type': 'application/json' }, body: value === undefined ? undefined : JSON.stringify(value), signal: controller.signal });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not reach the SSN receiver.');
    return data;
   } finally { clearTimeout(timer); }
  }
  async function prepare(updated, old, token, secret) {
   var p = state();
   if (!updated.reliable) {
    if (p.key) { await api('connection', 'DELETE'); host.privateState.receiver = { key: '', webhook: '', username: '', seen: [] }; await host.store(); }
    return;
   }
   if (!updated.username || !token) throw new Error('Enter your username and private Tip ID for reliable delivery.');
   if (p.key && p.webhook && p.username === updated.username && !secret && token === host.privateState.token) return;
   if (!p.key) {
    p.key = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    await host.store(); // Preserve access even if the setup request is interrupted.
   }
   var result = await api('connection', 'POST', { username: updated.username, token: token, secret: secret || '' });
   if (!/^https:\/\/api\.socialstream\.ninja\/v1\/ninjabacker\/webhook\/[a-f0-9]{64}$/.test(result.webhook || '')) throw new Error('Invalid receiver URL.');
   p.webhook = result.webhook; p.username = updated.username;
   await host.store(); next = 0;
  }
  function active(key) {
   var c = host.config().ninja;
   return host.isOn() && c.enabled && c.reliable && state().key === key && state().username === c.username && state().webhook;
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
     if (!/^[a-zA-Z0-9_-]{1,128}$/.test(event.id || '') || !event.data || event.data.type !== 'tip') throw new Error('Invalid receiver event.');
     if (p.seen.indexOf(event.id) === -1) {
      await host.deliver(Object.assign({}, event.data, { id: 'delivery:' + event.id }));
      p.seen.push(event.id); p.seen = p.seen.slice(-2000);
     }
     ack.push(event.id);
    }
    if (ack.length) {
     await host.store();
     if (!active(key)) return;
     await api('ack', 'POST', { lease: result.lease, ids: ack }, key);
    }
    status = result.received ? 'Reliable delivery connected' : 'Waiting for a NinjaBacker dashboard test tip';
   } catch (_) { status = 'Receiver unavailable; queued tips will retry'; }
   finally { busy = false; }
  }
  return { prepare: prepare, poll: poll, snapshot: function () { return { webhook: state().webhook, status: !host.config().ninja.enabled ? 'Disabled' : !host.isOn() ? 'SSN is off; tips can queue for 7 days' : !state().webhook ? 'Set up reliable delivery on this device' : status }; } };
 };
})(typeof window !== 'undefined' ? window : this);
