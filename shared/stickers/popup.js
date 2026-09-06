(function () {
    'use strict';
    var panel = document.getElementById('sticker-rewards-settings');
    if (!panel) return;
    var config = SSNStickers.config({}), ready = false;
    var status = document.getElementById('sticker-settings-status');
    function save() {
        if (!ready) return;
        config.enabled = panel.querySelector('[name="sticker-enabled"]').checked;
        config.reply = panel.querySelector('[name="sticker-replies"]').checked;
        config.packs = [];
        panel.querySelectorAll('[data-sticker-pack]').forEach(function (input) { if (input.checked) config.packs.push(input.dataset.stickerPack); });
        panel.querySelectorAll('[data-sticker-price]').forEach(function (input) { config.prices[input.dataset.stickerPrice] = Number(input.value); });
        ['duration', 'userCooldown', 'stickerCooldown', 'gap'].forEach(function (key) { config[key] = Number(panel.querySelector('[name="sticker-' + key + '"]').value); });
        config = SSNStickers.config(config);
        // Keep the focused control alive while normalizing the saved values.
        panel.querySelectorAll('[data-sticker-price]').forEach(function (input) { input.value = config.prices[input.dataset.stickerPrice]; });
        ['duration', 'userCooldown', 'stickerCooldown', 'gap'].forEach(function (key) { panel.querySelector('[name="sticker-' + key + '"]').value = config[key]; });
        chrome.runtime.sendMessage({ cmd: 'saveSetting', setting: 'stickerRewards', type: 'json', value: JSON.stringify(config) }, function () {
            status.textContent = chrome.runtime.lastError ? 'Could not save sticker settings.' : 'Saved. Loyalty points and an open sticker overlay are required.';
        });
    }
    function render() {
        panel.querySelector('[name="sticker-enabled"]').checked = config.enabled;
        panel.querySelector('[name="sticker-replies"]').checked = config.reply;
        var list = document.getElementById('sticker-pack-options'); list.textContent = '';
        SSNStickers.packs.forEach(function (pack) {
            var row = document.createElement('div'), label = document.createElement('label'), checkbox = document.createElement('input'), price = document.createElement('input');
            checkbox.type = 'checkbox'; checkbox.dataset.stickerPack = pack.id; checkbox.checked = config.packs.indexOf(pack.id) >= 0;
            label.appendChild(checkbox); label.appendChild(document.createTextNode(' ' + pack.name + ' '));
            price.type = 'number'; price.min = '1'; price.max = '1000000'; price.value = config.prices[pack.id] || pack.cost;
            price.dataset.stickerPrice = pack.id; price.setAttribute('aria-label', pack.name + ' points per sticker'); price.style.width = '85px';
            row.style.margin = '8px 0'; row.appendChild(label); row.appendChild(price); row.appendChild(document.createTextNode(' points each')); list.appendChild(row);
        });
        ['duration', 'userCooldown', 'stickerCooldown', 'gap'].forEach(function (key) { panel.querySelector('[name="sticker-' + key + '"]').value = config[key]; });
        var custom = document.getElementById('sticker-custom-list'); custom.textContent = '';
        config.custom.forEach(function (item, index) {
            var row = document.createElement('div'), remove = document.createElement('button');
            row.textContent = '!sticker ' + item.id + ' · ' + item.cost + ' points ';
            remove.type = 'button'; remove.textContent = 'Remove'; remove.onclick = function () { config.custom.splice(index, 1); render(); save(); };
            row.appendChild(remove); custom.appendChild(row);
        });
    }
    // Reuse the popup's normal asynchronous hydration, including Electron startup retries.
    window.updateStickerRewardSettings = function (settings) {
        if (!settings) return;
        var incoming = SSNStickers.config(settings.stickerRewards);
        if (ready && JSON.stringify(incoming) === JSON.stringify(config)) return;
        config = incoming; render(); ready = true;
    };
    if (typeof lastResponse !== 'undefined' && lastResponse && lastResponse.settings) window.updateStickerRewardSettings(lastResponse.settings);
    panel.addEventListener('change', function (event) { if (!event.target.closest('#sticker-custom-form')) save(); });
    document.getElementById('sticker-custom-add').addEventListener('click', function () {
        if (!ready) return;
        var name = document.getElementById('sticker-custom-name').value.trim();
        var code = document.getElementById('sticker-custom-code').value.trim().toLowerCase();
        var url = SSNStickers.mediaUrl(document.getElementById('sticker-custom-url').value);
        var cost = Number(document.getElementById('sticker-custom-cost').value);
        var id = 'custom-' + code;
        if (!name || !/^[a-z0-9-]{1,32}$/.test(code) || !url || !Number.isSafeInteger(cost) || cost < 1 || cost > 1000000 || config.custom.length >= 12 || config.custom.some(function (r) { return r.id === id; })) {
            status.textContent = 'Use a unique short code, a name, a direct HTTPS image/GIF URL, and a positive whole-number price. Maximum 12 custom stickers.'; return;
        }
        config.custom.push({ id: id, name: name, url: url, cost: cost, motion: 'still' }); render(); save();
        status.textContent = 'Added. Chat command: !sticker ' + id;
    });
})();
