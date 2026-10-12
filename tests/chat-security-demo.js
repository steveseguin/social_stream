(function () {
  'use strict';
  var probe = 'SSN_LOCAL_PROBE <img id="local-chat-probe" src="data:image/png;base64,broken" onerror="window.__probeHits=(window.__probeHits||0)+1">';
  var targets = {
    'dock-tts': { file: 'dock.html', query: '&tts', label: 'Dock + TTS' },
    'featured-tts': { file: 'featured.html', query: '&tts', label: 'Featured + TTS' },
    'dock': { file: 'dock.html', query: '', label: 'Dock default' },
    'featured': { file: 'featured.html', query: '', label: 'Featured default' },
    'dock-normalize': { file: 'dock.html', query: '&normalize', label: 'Dock + normalize' }
  };
  var active = null;
  window.demoResults = [];
  document.getElementById('probe').textContent = probe;
  function show(id, value) { document.getElementById(id).textContent = value; }
  function status(text, state) { show('status', text); document.getElementById('status').dataset.state = state || ''; }
  function post(role, kind, detail) {
    active.frames[role].contentWindow.postMessage({ chatSecurityDemo: true, run: active.id, kind: kind, detail: detail }, location.origin);
  }
  function frame(role, src) {
    var slot = document.getElementById(role + '-slot');
    slot.textContent = '';
    var element = document.createElement('iframe');
    element.id = role + '-frame'; element.title = role + ' test stage'; element.src = src;
    slot.appendChild(element);
    return element;
  }
  function record(result) {
    window.demoResult = result;
    window.demoResults.push(result);
    var row = document.createElement('tr');
    [targets[result.target].label, String(result.textonly), String(result.relay.sanitizerCalls), result.receiver.hits ? 'EXECUTED (' + result.receiver.hits + ')' : 'No execution'].forEach(function (value) {
      var cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
    });
    document.getElementById('results').appendChild(row);
  }
  function stop(error) {
    if (!active || active.done) return;
    active.done = true;
    clearTimeout(active.timeout);
    window.demoError = String(error.message || error);
    status('ERROR: ' + window.demoError, 'error');
    active.reject(error);
  }
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!active || active.done || event.origin !== location.origin || !data || !data.chatSecurityDemo || data.run !== active.id) return;
    var child = active.frames[data.role];
    if (!child || event.source !== child.contentWindow) return;
    if (data.kind === 'error') return stop(Error(data.role + ': ' + data.detail));
    if (data.kind === 'ready') {
      active.ready[data.role] = true;
      if (active.ready.source && active.ready.relay && active.ready.receiver && !active.injected) {
        active.injected = true;
        status('Capturing literal text through sources/twitch.js…');
        post('source', 'inject', probe);
      }
    } else if (data.kind === 'captured') {
      active.result.source = data.detail;
      show('captured', JSON.stringify(data.detail.payload, null, 2));
      show('source-html', data.detail.sourceHTML);
      show('source-state', 'Source execution counter: ' + data.detail.hits);
      if (data.detail.hits) return stop(Error('Probe executed at the source; downstream proof is invalid'));
      post('relay', 'relay', data.detail.payload);
    } else if (data.kind === 'relayed') {
      active.result.relay = data.detail;
      show('relayed', JSON.stringify(data.detail.payload, null, 2));
      show('relay-state', 'Body filterXSS calls: ' + data.detail.sanitizerCalls + ' · Relay execution counter: ' + data.detail.hits);
      if (data.detail.hits) return stop(Error('Probe executed in the relay; downstream proof is invalid'));
      status('Delivered through the production iframe listener; waiting for rendering…');
      post('receiver', 'deliver', data.detail.payload);
    } else if (data.kind === 'result') {
      active.done = true; clearTimeout(active.timeout);
      active.result.receiver = data.detail;
      active.result.source.hitsAfterDelivery = window.__probeHits;
      show('receiver-state', 'Message rendered · Execution counter: ' + data.detail.hits + ' · TTS calls: ' + data.detail.spoken.length);
      show('evidence', JSON.stringify({ spoken: data.detail.spoken, htmlAssignments: data.detail.parses }, null, 2));
      status(data.detail.hits ? 'REPRODUCED: viewer text executed JavaScript in ' + targets[active.result.target].label + '.' : 'CONTROL: message rendered with no probe execution in ' + targets[active.result.target].label + '.', data.detail.hits ? 'executed' : 'safe');
      record(active.result);
      active.resolve(active.result);
    }
  });
  function runCase(target, textonly) {
    window.demoResult = null; window.demoError = null;
    show('captured', 'Waiting'); show('relayed', 'Waiting'); show('evidence', 'Waiting'); show('source-state', 'Waiting'); show('relay-state', 'Waiting'); show('receiver-state', 'Waiting');
    document.getElementById('target').value = target;
    document.getElementById('mode').value = String(textonly);
    status('Loading source, relay, and ' + targets[target].label + '…');
    return new Promise(function (resolve, reject) {
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      active = { id: id, ready: {}, frames: {}, resolve: resolve, reject: reject, result: { target: target, textonly: textonly } };
      active.timeout = setTimeout(function () { stop(Error('Test timed out; no safety conclusion')); }, 25000);
      active.frames.relay = frame('relay', '/__chat-security/relay.html?run=' + id);
      active.frames.source = { contentWindow: window };
      active.frames.receiver = frame('receiver', '/' + targets[target].file + '?session=LOCAL_SECURITY_DEMO&securityDemo=1&run=' + id + targets[target].query);
      post('source', 'configure', textonly);
    });
  }
  function busy(value) {
    ['run', 'compare', 'target', 'mode'].forEach(function (id) { document.getElementById(id).disabled = value; });
  }
  document.getElementById('run').addEventListener('click', async function () {
    busy(true);
    try { await runCase(document.getElementById('target').value, document.getElementById('mode').value === 'true'); }
    catch (error) { status('ERROR: ' + error.message, 'error'); }
    finally { busy(false); }
  });
  document.getElementById('compare').addEventListener('click', async function () {
    busy(true); window.demoResults = []; document.getElementById('results').textContent = '';
    var cases = [['dock', true], ['featured', true], ['dock-tts', false], ['featured-tts', false], ['dock-normalize', false], ['dock-normalize', true], ['featured-tts', true], ['dock-tts', true]];
    try {
      for (var i = 0; i < cases.length; i++) await runCase(cases[i][0], cases[i][1]);
    } catch (error) { status('ERROR: ' + error.message, 'error'); }
    finally { busy(false); }
  });
})();
