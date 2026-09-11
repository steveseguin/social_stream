(function () {
  'use strict';

  var MAX_LAYERS = 8;
  var MAX_CONFIG_LENGTH = 100000;
  var STORAGE_KEY = 'ssn.combine.v1';
  var TRANSPARENT_PAGES = ['dock.html', 'featured.html', 'multi-alerts.html', 'minecraft.html'];
  var encodedConfig = { json: '', hash: '' };
  var layers = [];
  var nextId = 0;
  var editor = document.getElementById('editor');
  var list = document.getElementById('layers');
  var output = document.getElementById('output');
  var preview = document.getElementById('preview-stage');
  var previewEmpty = document.getElementById('preview-empty');
  var status = document.getElementById('status');
  var linkPanel = document.getElementById('link-panel');
  var linkField = document.getElementById('combined-url');
  var qrPanel = document.getElementById('qr-panel');
  var qrCode = document.getElementById('qr-code');
  var saveStatus = document.getElementById('save-status');

  function draftConfig() {
    return { v: 1, layers: layers.map(function (layer) {
      return { url: layer.url, interactive: layer.interactive, transparent: layer.transparent };
    }) };
  }

  function saveDraft(config) {
    try {
      var json = JSON.stringify(config);
      if (json.length > MAX_CONFIG_LENGTH) throw new Error('Setup too large');
      localStorage.setItem(STORAGE_KEY, json);
      saveStatus.textContent = 'Saved in this browser. Scan the QR code to open on another device.';
    } catch (_) {
      saveStatus.textContent = 'Browser saving is unavailable. Keep your combined link or QR code.';
    }
  }

  function loadDraft() {
    try {
      var json = localStorage.getItem(STORAGE_KEY);
      if (!json || json.length > MAX_CONFIG_LENGTH) return null;
      var config = JSON.parse(json);
      validateConfig(config, false);
      saveStatus.textContent = 'Restored your saved setup from this browser.';
      return config;
    } catch (_) {
      return null;
    }
  }

  function setStatus(message, error) {
    status.textContent = message;
    status.classList.toggle('error', !!error);
  }

  function makeLayer(url, interactive, transparent) {
    return { id: ++nextId, url: url || '', interactive: !!interactive, transparent: transparent !== false };
  }

  function parseOverlayUrl(value) {
    var url;
    try {
      url = new URL(value.trim());
    } catch (_) {
      throw new Error('Paste a complete link starting with https:// or http://.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Use an https:// or http:// link.');
    }
    if (url.username || url.password) {
      throw new Error('Use a link without a username or password before the site address.');
    }
    if (url.pathname.split('/').pop() === 'combine.html') {
      throw new Error('Paste an individual overlay link rather than another combined link.');
    }
    if (location.protocol === 'https:' && url.protocol === 'http:') {
      throw new Error('This page needs an https:// overlay link.');
    }
    return url;
  }

  function supportsTransparency(url) {
    return TRANSPARENT_PAGES.some(function (name) {
      var local = new URL(name, location.href);
      return (url.origin === local.origin && url.pathname === local.pathname) ||
        ((url.hostname === 'socialstream.ninja' || url.hostname === 'www.socialstream.ninja') &&
          (url.pathname === '/' + name || url.pathname === '/beta/' + name));
    });
  }

  function frameUrl(layer) {
    var url = parseOverlayUrl(layer.url);
    if (layer.transparent && supportsTransparency(url)) {
      url.searchParams.set('transparent', '1');
    }
    return url.href;
  }

  function collectConfig(reportError) {
    var valid = true;
    var firstInvalid = null;
    var config = { v: 1, layers: [] };
    layers.forEach(function (layer, index) {
      var input = document.getElementById('url-' + layer.id);
      try {
        var url = parseOverlayUrl(layer.url);
        config.layers.push({ url: url.href, interactive: layer.interactive, transparent: layer.transparent });
        if (input) input.removeAttribute('aria-invalid');
      } catch (error) {
        valid = false;
        if (reportError && !firstInvalid) {
          firstInvalid = input;
          setStatus('Layer ' + (index + 1) + ': ' + error.message, true);
        }
        if (reportError && input) input.setAttribute('aria-invalid', 'true');
      }
    });
    if (firstInvalid) firstInvalid.focus();
    if (JSON.stringify(config).length > MAX_CONFIG_LENGTH) {
      if (reportError) setStatus('These overlay links are too long. Use shorter links or fewer layers.', true);
      valid = false;
    }
    return valid ? config : null;
  }

  // Compress the complete layout for easier QR transfer; no server stores the links.
  function configHash(config) {
    var json = JSON.stringify(config);
    if (json === encodedConfig.json) return encodedConfig.hash;
    var hash = encodeURIComponent(json);
    if (window.pako) {
      var compressed = pako.deflate(json);
      var binary = '';
      for (var i = 0; i < compressed.length; i++) binary += String.fromCharCode(compressed[i]);
      hash = 'v1=' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    encodedConfig = { json: json, hash: hash };
    return hash;
  }

  function combinedUrl(config, edit) {
    var url = new URL(location.href);
    url.search = edit ? '?edit=1' : '';
    url.hash = configHash(config);
    return url.href;
  }

  function updateLinks() {
    var config = collectConfig(false);
    linkPanel.hidden = !config;
    linkField.value = config ? combinedUrl(config, false) : '';
    ['open-link', 'edit-link'].forEach(function (id) {
      var link = document.getElementById(id);
      if (config) link.href = combinedUrl(config, id === 'edit-link');
      else link.removeAttribute('href');
    });
    return config;
  }

  function changed() {
    preview.textContent = '';
    previewEmpty.hidden = false;
    qrPanel.hidden = true;
    qrCode.textContent = '';
    setStatus('');
    saveDraft(draftConfig());
    updateLinks();
  }

  function button(text, label, handler) {
    var element = document.createElement('button');
    element.type = 'button';
    element.textContent = text;
    element.setAttribute('aria-label', label);
    element.addEventListener('click', handler);
    return element;
  }

  function option(layer, key, text) {
    var label = document.createElement('label');
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = layer[key];
    checkbox.dataset.option = key;
    checkbox.addEventListener('change', function () {
      layer[key] = checkbox.checked;
      changed();
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(text));
    return label;
  }

  function moveLayer(index, offset) {
    var layer = layers.splice(index, 1)[0];
    layers.splice(index + offset, 0, layer);
    renderEditor();
    changed();
    document.getElementById('url-' + layer.id).focus();
  }

  function renderEditor() {
    list.textContent = '';
    layers.forEach(function (layer, index) {
      var row = document.createElement('li');
      row.className = 'layer';
      var header = document.createElement('div');
      header.className = 'layer-header';
      var title = document.createElement('span');
      title.className = 'layer-title';
      title.textContent = 'Layer ' + (index + 1) + (index === 0 ? ' · Bottom' : index === layers.length - 1 ? ' · Top' : '');
      var tools = document.createElement('div');
      tools.className = 'layer-tools';
      var lower = button('↓', 'Move layer ' + (index + 1) + ' behind', function () { moveLayer(index, -1); });
      var higher = button('↑', 'Move layer ' + (index + 1) + ' in front', function () { moveLayer(index, 1); });
      lower.disabled = index === 0;
      higher.disabled = index === layers.length - 1;
      var remove = button('Remove', 'Remove layer ' + (index + 1), function () {
        layers.splice(index, 1);
        renderEditor();
        changed();
        document.getElementById('url-' + layers[Math.min(index, layers.length - 1)].id).focus();
      });
      remove.disabled = layers.length === 1;
      tools.appendChild(lower);
      tools.appendChild(higher);
      tools.appendChild(remove);
      header.appendChild(title);
      header.appendChild(tools);
      row.appendChild(header);

      var label = document.createElement('label');
      label.className = 'url-label';
      label.htmlFor = 'url-' + layer.id;
      label.textContent = 'Overlay URL';
      var input = document.createElement('input');
      input.id = label.htmlFor;
      input.className = 'url-input';
      input.type = 'url';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = index === 0 ? 'Paste your chat URL' : 'Paste your alerts or other overlay URL';
      input.value = layer.url;
      input.addEventListener('input', function () {
        layer.url = input.value;
        changed();
      });
      row.appendChild(label);
      row.appendChild(input);
      var options = document.createElement('div');
      options.className = 'layer-options';
      options.appendChild(option(layer, 'transparent', 'Transparent SSN background'));
      options.appendChild(option(layer, 'interactive', 'Allow taps and scrolling on this layer'));
      row.appendChild(options);
      list.appendChild(row);
    });
    document.getElementById('add-layer').disabled = layers.length >= MAX_LAYERS;
  }

  function mountFrames(target, config) {
    target.textContent = '';
    config.layers.forEach(function (layer, index) {
      var frame = document.createElement('iframe');
      frame.className = 'overlay-frame' + (layer.interactive ? '' : ' pass-through');
      frame.title = 'Overlay layer ' + (index + 1) + ': ' + new URL(layer.url).hostname;
      frame.style.zIndex = String(index);
      frame.setAttribute('allow', 'autoplay; fullscreen');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads');
      if (!layer.interactive) frame.tabIndex = -1;
      frame.src = frameUrl(layer);
      target.appendChild(frame);
    });
  }

  function validateConfig(config, checkUrls) {
    if (!config || config.v !== 1 || !Array.isArray(config.layers) || !config.layers.length || config.layers.length > MAX_LAYERS) {
      throw new Error('This combined link needs between 1 and ' + MAX_LAYERS + ' overlay URLs.');
    }
    config.layers.forEach(function (layer) {
      if (!layer || typeof layer.url !== 'string' || typeof layer.interactive !== 'boolean' || typeof layer.transparent !== 'boolean') {
        throw new Error('This combined link contains an invalid layer.');
      }
      if (checkUrls) parseOverlayUrl(layer.url);
    });
  }

  function decodeConfig(hash) {
    if (hash.indexOf('v1=') !== 0) return decodeURIComponent(hash);
    if (!window.pako) throw new Error('The link decoder could not load. Refresh the page and try again.');
    var binary = atob(hash.slice(3).replace(/-/g, '+').replace(/_/g, '/'));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var json = '';
    var inflater = new pako.Inflate({ to: 'string', chunkSize: 8192 });
    inflater.onData = function (chunk) {
      if (json.length + chunk.length > MAX_CONFIG_LENGTH) throw new Error('Setup too large');
      json += chunk;
    };
    inflater.push(bytes, true);
    if (inflater.err || !inflater.ended) throw new Error('Invalid compressed link');
    return json;
  }

  function loadConfig() {
    if (!location.hash || location.hash === '#') return null;
    if (location.hash.length > MAX_CONFIG_LENGTH) throw new Error('This combined link is too long.');
    var config;
    try {
      config = JSON.parse(decodeConfig(location.hash.slice(1)));
    } catch (_) {
      throw new Error('This combined link is incomplete or invalid. Paste your overlay URLs below to rebuild it.');
    }
    validateConfig(config, true);
    return config;
  }

  function initialize() {
    var config = null;
    var errorMessage = '';
    try { config = loadConfig(); }
    catch (error) { errorMessage = error.message; }
    var editing = !config || new URLSearchParams(location.search).has('edit');
    document.documentElement.classList.toggle('viewing', !editing);
    document.body.classList.toggle('editing', editing);
    editor.hidden = !editing;
    output.hidden = editing;
    output.textContent = '';
    preview.textContent = '';
    previewEmpty.hidden = false;
    qrPanel.hidden = true;
    if (config) saveDraft(config);
    if (!editing) {
      mountFrames(output, config);
      return;
    }
    var draft = config || loadDraft();
    layers = draft ? draft.layers.map(function (layer) {
      return makeLayer(layer.url, layer.interactive, layer.transparent);
    }) : [makeLayer('', true), makeLayer('', false)];
    renderEditor();
    updateLinks();
    setStatus(errorMessage, !!errorMessage);
  }

  document.getElementById('add-layer').addEventListener('click', function () {
    if (layers.length >= MAX_LAYERS) return;
    var layer = makeLayer('', false);
    layers.push(layer);
    renderEditor();
    changed();
    document.getElementById('url-' + layer.id).focus();
  });
  document.getElementById('clear-saved').addEventListener('click', function () {
    try {
      localStorage.removeItem(STORAGE_KEY);
      saveStatus.textContent = 'Saved setup cleared.';
    } catch (_) {
      saveStatus.textContent = 'Browser storage could not be cleared.';
    }
    layers = [makeLayer('', true), makeLayer('', false)];
    history.replaceState(null, '', location.pathname);
    renderEditor();
    preview.textContent = '';
    previewEmpty.hidden = false;
    qrPanel.hidden = true;
    updateLinks();
    setStatus('');
    document.getElementById('url-' + layers[0].id).focus();
  });
  document.getElementById('show-qr').addEventListener('click', function () {
    var config = collectConfig(true);
    if (!config) return;
    updateLinks();
    qrCode.textContent = '';
    qrPanel.hidden = false;
    var qrStatus = document.getElementById('qr-status');
    try {
      if (!window.QRCode) throw new Error('QR library unavailable');
      var qr = new QRCode(document.createElement('div'), { text: linkField.value, width: 320, height: 320,
        colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      // Use the bundled encoder's matrix with whole-pixel cells and a four-cell
      // quiet zone. Fractional canvas cells can be hard for phone cameras to read.
      var model = qr._oQRCode;
      var count = model.getModuleCount();
      var cell = Math.max(1, Math.floor(Math.min(384, qrPanel.clientWidth) / (count + 8)));
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = (count + 8) * cell;
      var context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#000';
      for (var row = 0; row < count; row++) {
        for (var column = 0; column < count; column++) {
          if (model.isDark(row, column)) context.fillRect((column + 4) * cell, (row + 4) * cell, cell, cell);
        }
      }
      qrCode.appendChild(canvas);
      qrStatus.textContent = 'Bookmark the combined view on your phone to reopen it later. Generate a new code after changing the layout.';
      setStatus('QR code ready.');
    } catch (_) {
      qrCode.textContent = '';
      qrStatus.textContent = 'A QR code could not be made for this link. Copy the combined link instead, or use fewer or shorter overlay URLs.';
      setStatus('Use the combined link below to transfer this setup.');
    }
  });
  document.getElementById('preview-button').addEventListener('click', function () {
    var config = collectConfig(true);
    if (!config) return;
    mountFrames(preview, config);
    previewEmpty.hidden = true;
    setStatus('Preview opened. Live overlays may stay empty until a message or alert arrives.');
  });
  document.getElementById('copy-link').addEventListener('click', async function () {
    var config = collectConfig(true);
    if (!config) return;
    updateLinks();
    var value = linkField.value;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setStatus('Copied. Open this link on your phone or paste it into a browser source.');
    } catch (_) {
      linkField.focus();
      linkField.select();
      linkField.setSelectionRange(0, value.length);
      var copied = false;
      try { copied = document.execCommand('copy'); } catch (_) {}
      setStatus(copied ? 'Combined link copied.' : 'Select and copy the combined link below.');
    }
  });
  window.addEventListener('hashchange', initialize);
  initialize();
})();
