(function (root) {
 'use strict';
 root.SSNPatreonReceiver = function (host) {
  var busy = false, changing = false, next = 0, generation = 0, status = 'Set up Patreon alerts', received = 0;
  function state() { return host.privateState.patreonReceiver || (host.privateState.patreonReceiver = { key: '', webhook: '', secretSaved: false, seen: [] }); }
  async function api(path, method, value, key) {
   var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 10000);
   try {
    var response = await fetch('https://api.socialstream.ninja/v1/patreon/' + path, { method: method || 'GET', credentials: 'omit', redirect: 'error', headers: { Authorization: 'Bearer ' + (key || state().key), 'Content-Type': 'application/json' }, body: value === undefined ? undefined : JSON.stringify(value), signal: controller.signal });
    var data;
    try { data = await response.json(); } catch (_) { throw new Error('Patreon receiver unavailable. Try again later.'); }
    if (!response.ok) throw new Error(data.message || data.error || 'Could not reach the Patreon receiver.');
    return data;
   } finally { clearTimeout(timer); }
  }
  async function setup(value) {
   var p = state();
   if (!p.key) {
    p.key = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    await host.store();
   }
   var result = await api('connection', 'POST', value);
   if (!/^https:\/\/api\.socialstream\.ninja\/v1\/patreon\/webhook\/[a-f0-9]{64}$/.test(result.webhook || '')) throw new Error('Invalid Patreon receiver URL.');
   p.webhook = result.webhook; p.secretSaved = result.secretSaved === true;
   await host.store(); next = 0;
  }
  async function reserve() {
   if (changing) throw new Error('Please wait for the current Patreon setup to finish.');
   changing = true;
   try { if (!state().webhook) await setup({}); }
   finally { changing = false; }
  }
  async function prepare(updated, old, secret) {
   if (!secret && updated.enabled === old.enabled) return;
   if (!state().webhook && !updated.enabled && !secret) return;
   if (changing) throw new Error('Please wait for the current Patreon setup to finish.');
   changing = true; generation++;
   try { await setup({ enabled: updated.enabled, secret: secret || '' }); status = 'Waiting for a verified Patreon event'; }
   finally { changing = false; }
  }
  async function disconnect() {
   if (changing) throw new Error('Please wait for the current Patreon setup to finish.');
   changing = true; generation++;
   try {
    if (state().key) await api('connection', 'DELETE');
    host.privateState.patreonReceiver = { key: '', webhook: '', secretSaved: false, seen: [] };
    await host.store(); received = 0; status = 'Disconnected';
   } finally { changing = false; }
  }
  function active(key, version) { return !changing && generation === version && host.isOn() && host.config().patreon.enabled && state().key === key && state().webhook && state().secretSaved; }
  async function poll() {
   var p = state(), key = p.key, version = generation;
   if (!active(key, version) || busy || Date.now() < next) return;
   busy = true; next = Date.now() + 5000;
   try {
    var result = await api('events', 'GET', undefined, key);
    if (!Array.isArray(result.events) || result.events.length > 5 || !/^[a-f0-9]{32}$/.test(result.lease || '')) throw new Error('Invalid receiver response.');
    var ack = [];
    for (var i = 0; i < result.events.length; i++) {
     if (!active(key, version)) return;
     var event = result.events[i], data = event.data;
     if (!/^[a-f0-9]{64}$/.test(event.id || '') || !data || data.id !== 'patreon:' + event.id || data.type !== 'patreon' || data.event !== 'new_subscriber' || data.hasDonation !== undefined || data.donoValue !== undefined) throw new Error('Invalid Patreon event.');
     if (p.seen.indexOf(event.id) === -1) {
      await host.deliver(data);
      p.seen.push(event.id); p.seen = p.seen.slice(-2000);
     }
     ack.push(event.id);
    }
    if (ack.length) {
     await host.store();
     if (!active(key, version)) return;
     await api('ack', 'POST', { lease: result.lease, ids: ack }, key);
    }
    if (!active(key, version)) return;
    received = Number(result.received) || 0;
    status = !result.enabled ? 'Receiver disabled. Enable Patreon alerts and save again.' : !received ? 'Waiting for a verified Patreon event' : result.lastKind === 'pledge' ? 'Verified Patreon pledge received' : 'Verified event received; no eligible new pledge';
   } catch (_) { if (active(key, version)) status = 'Receiver unavailable; queued pledges will retry'; }
   finally { busy = false; }
  }
  return { reserve: reserve, prepare: prepare, disconnect: disconnect, poll: poll, snapshot: function () {
   var p = state();
   return { webhook: p.webhook, secretSaved: p.secretSaved, received: received, status: !p.webhook ? 'Set up Patreon alerts' : !p.secretSaved ? 'Paste the Patreon signing secret and save setup' : !host.config().patreon.enabled ? 'Disabled; new pledges are not queued' : !host.isOn() ? 'SSN is off; pledges can queue for 7 days' : status };
  } };
 };
})(typeof window !== 'undefined' ? window : this);
