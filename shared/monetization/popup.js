(function () {
	'use strict';
	var panel = document.getElementById('monetization-settings');
	if (!panel) return;
	var ready = false,
		current = null;
	var products = [], editingProduct = -1;
    var boardsPanel = document.createElement('details'); boardsPanel.className = 'popup-subsection commerce-board-controls';
    panel.appendChild(boardsPanel);
    window.SSNCommerceBoardControls(boardsPanel, request, function () {
        links(); return by('overlay').href;
    });
	var feedbackUntil = {};
	var saveLabel = by('save').textContent;
	function tr(key, fallback) { return typeof getTranslation === 'function' ? getTranslation(key, fallback) : fallback; }
    function moneyText(text, values) {
        text = String(text || '');
        var shared = { 'Disabled': 'shopify-status-disabled', 'Disconnected': 'shopify-status-disconnected', 'Set up reliable delivery': 'shopify-status-set-up-reliable-delivery' };
        if (text.indexOf('Sandbox test mode. ') === 0) return moneyText('Sandbox test mode.') + ' ' + moneyText(text.slice(19));
        var key = shared[text] || 'money-' + text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return tr(key, text).replace(/\{(\w+)\}/g, function (match, name) { return values && Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match; });
    }
    function refreshPlaceholders() {
        var defaults = { 'shopify-webhook': 'Save setup to generate', 'ninja-username': 'Your username', 'ninja-webhook': 'Save setup to generate', 'throne-username': 'Your Throne username', 'throne-webhook': 'Enable and save to create your connection', buyer: 'Optional' };
        var entries = typeof translation !== 'undefined' && translation.placeholders || {};
        Object.keys(defaults).forEach(function (id) {
            var fallback = defaults[id], key = fallback.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/ /g, '-');
            by(id).placeholder = Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : fallback;
        });
    }
    // Merge only edits made in this popup; backend changes still apply to untouched fields.
    function mergeDraft(saved, baseline, draft) {
        if (draft && typeof draft === 'object' && !Array.isArray(draft)) {
            var result = Object.assign({}, saved);
            Object.keys(draft).forEach(function (key) {
                result[key] = mergeDraft(saved && saved[key], baseline && baseline[key], draft[key]);
            });
            return result;
        }
        return JSON.stringify(draft) !== JSON.stringify(baseline) ? draft : saved;
    }
    function updateSaveLabel() {
        if (!ready || !current) return;
        var dirty = JSON.stringify(mergeDraft(current.config, current.config, values())) !== JSON.stringify(current.config);
        dirty = dirty || ['ninja-token', 'ninja-secret', 'shopify-secret'].some(function (id) { return !!by(id).value.trim(); }) || by('ninja-clear-token').checked;
        saveLabel = '\uD83D\uDCBE ' + tr('money-save-setup', 'Save setup');
        by('save').textContent = dirty ? saveLabel + ' - ' + tr('commerce-draft', 'Unsaved') : saveLabel;
    }
    panel.addEventListener('input', updateSaveLabel);
    panel.addEventListener('change', updateSaveLabel);
    function feedbackTarget(element) {
        if (!element) return 'status';
        var id = element.id || '';
        var targets = { 'shop-': 'shop-status', 'shopify-': 'shopify-status', 'provider-': 'provider-status', 'fourthwall-': 'fourthwall-status', 'ninja-': 'ninja-status', 'ebay-': 'ebay-status', 'throne-': 'throne-status' };
        var prefixes = Object.keys(targets);
        for (var i = 0; i < prefixes.length; i++) {
            if (id.indexOf('money-' + prefixes[i]) === 0) return targets[prefixes[i]];
        }
        return element.closest('#money-commerce-panel') ? 'commerce-live-status' : 'status';
    }
    function setStatus(id, text) {
        if (!feedbackUntil[id] || feedbackUntil[id] < Date.now()) by(id).textContent = moneyText(text);
    }
	function resetProductForm() {
        editingProduct = -1;
        ['name', 'url', 'image', 'price'].forEach(function (key) { by('commerce-' + key).value = ''; });
        by('commerce-add').textContent = tr('commerce-add', 'Add product or link');
        by('commerce-cancel').hidden = true;
    }
	function renderProducts() {
		var rows = by('commerce-items'); rows.textContent = '';
		products.forEach(function (item, index) {
			var row = document.createElement('div'), label = document.createElement('span'); row.className = 'money-item';
			var saved = current && current.config.commerce.items.some(function (entry) { return JSON.stringify(entry) === JSON.stringify(item); });
            label.textContent = item.name + (saved ? '' : ' (' + tr('commerce-draft', 'Unsaved') + ')') + (item.amount != null ? ' - ' + SSNMonetization.money(item.amount, item.currency) : ''); row.appendChild(label);
			['show', 'edit', 'up', 'remove', 'copy'].forEach(function (action) {
				var button = document.createElement('button'); button.type = 'button';
				button.textContent = tr('commerce-' + action, { show: 'Show now', edit: 'Edit', up: 'Move up', remove: 'Remove', copy: 'Copy public link' }[action]);
				button.setAttribute('aria-label', button.textContent + ': ' + item.name);
				button.disabled = (action === 'up' && index === 0) || (action === 'show' && (!saved || !current.config.commerce.enabled));
                if (action === 'show' && !saved) button.title = tr('commerce-save-first', 'Save setup before showing this product.');
				button.onclick = function () {
					if (action === 'show') { control('show', item.url); return; }
                    if (action === 'copy') { navigator.clipboard.writeText(item.url).then(function () { status(tr('commerce-copied', 'Public link copied.')); }).catch(function () { status(item.url); }); return; }
					if (action === 'edit') {
						editingProduct = index; by('commerce-cancel').hidden = false;
						['name', 'url', 'image', 'currency', 'purpose'].forEach(function (key) { by('commerce-' + key).value = item[key]; });
						setProductCurrency(item.currency); by('commerce-price').value = item.amount == null ? '' : item.amount;
						by('commerce-add').textContent = tr('commerce-update', 'Update product or link'); by('commerce-name').focus(); return;
					}
					if (action === 'remove') products.splice(index, 1);
					else { var previous = products[index - 1]; products[index - 1] = item; products[index] = previous; }
					resetProductForm(); renderProducts(); updateSaveLabel();
				}; row.appendChild(button);
			}); rows.appendChild(row);
		});
	}
    function liveStatus(reply) {
        var state = reply.commerceState || {}, name = state.selected && state.selected.name;
        var labels = { offline: tr('commerce-offline-state', 'SSN is off'), disabled: tr('commerce-disabled-state', 'Products disabled'), hidden: tr('commerce-hidden-state', 'Products hidden; activity alerts continue'), pinned: tr('commerce-selected-state', 'Selected product'), scheduled: tr('commerce-scheduled-state', 'Using saved schedule') };
        var text = labels[state.mode] || labels.scheduled;
        if (name && state.mode !== 'hidden') text += ': ' + name;
        if (state.remainingSeconds != null && state.remainingSeconds > 0) text += ' (' + state.remainingSeconds + 's)';
        setStatus('commerce-live-status', text);
        var shop = reply.publicShop || {};
        by('shop-url').value = shop.url || ''; by('shop-copy').disabled = !shop.url; by('shop-remove').disabled = !shop.published;
        setStatus('shop-status', state.publicPage && state.publicPage.syncing ? tr('commerce-syncing-state', 'Updating public page; local controls are ready.') : shop.status || (shop.published ? tr('commerce-published', 'Saved links are public. Changes update the same viewer link.') : tr('commerce-unpublished', 'Publish your saved links to get a stable viewer URL.')));
    }
    function control(command, url) {
        delete feedbackUntil['commerce-live-status'];
        request('commerceControl', { command: command, url: url, seconds: Number(by('commerce-duration').value) }).then(function (reply) { liveStatus(reply); }).catch(function (error) { status(error.message, 'commerce-live-status'); });
    }
    ['next', 'hide', 'resume'].forEach(function (command) { by('commerce-' + command).onclick = function () { control(command); }; });
    ['publish', 'remove'].forEach(function (command) {
        by('shop-' + command).onclick = function () {
            var button = this; button.disabled = true;
            delete feedbackUntil['shop-status'];
            request(command === 'publish' ? 'publishShop' : 'unpublishShop').then(liveStatus).catch(function (error) { status(error.message, 'shop-status'); }).then(function () { button.disabled = command === 'remove' && !by('shop-url').value; });
        };
    });
    by('shop-copy').onclick = function () { navigator.clipboard.writeText(by('shop-url').value).then(function () { status(tr('commerce-copied', 'Public link copied.')); }).catch(function () { by('shop-url').focus(); by('shop-url').select(); }); };
    by('product-import').onclick = function () {
        var button = this; button.disabled = true;
        request('productImport', { url: by('commerce-url').value }).then(function (reply) {
            by('commerce-name').value = reply.item.name; by('commerce-image').value = reply.item.image;
            by('commerce-price').value = '';
            status(tr('commerce-import-price', 'Details loaded. Check the price and purpose, add the product, then save setup.'));
        }).catch(function (error) { status(error.message); }).then(function () { button.disabled = false; });
    };
	function by(id) {
		return document.getElementById('money-' + id);
	}
	function status(text, target) {
        text = moneyText(text);
        target = target || feedbackTarget(document.activeElement);
        by('status').textContent = text;
        var actions = document.activeElement && document.activeElement.closest('.money-actions');
        if (target === 'status' && actions && panel.contains(actions)) actions.insertAdjacentElement('afterend', by('status'));
        if (target !== 'status') {
            feedbackUntil[target] = Date.now() + 10000;
            by(target).textContent = text;
        }
	}
	function request(action, extra) {
		return new Promise(function (resolve, reject) {
			var timer = setTimeout(
				function () {
					reject(new Error('Could not reach SSN.'));
				},
				action === 'get' ? 3000 : 20000
			);
			chrome.runtime.sendMessage(Object.assign({ cmd: 'monetization', action: action }, extra || {}), function (reply) {
				clearTimeout(timer);
				if (chrome.runtime.lastError || !reply || reply.error || (action === 'get' && !reply.config)) reject(new Error((reply && reply.error) || 'Could not reach SSN.'));
				else resolve(reply);
			});
		});
	}

    function setProductCurrency(value) {
        var select = by('commerce-currency');
        if (!Array.prototype.some.call(select.options, function (option) { return option.value === value; })) {
            var option = document.createElement('option'); option.value = value; option.textContent = value; select.appendChild(option);
        }
        select.value = value;
    }
    function shopifyStatus(reply) {
        var s = reply.shopify || {};
        by('shopify-webhook').value = s.webhook || '';
        setStatus('shopify-status', tr('shopify-status-' + (s.status || '').toLowerCase().replace(/[^a-z]+/g, '-'), s.status || 'Set up Shopify on this device'));
        by('shopify-secret').placeholder = s.webhook ? tr('shopify-secret-saved', 'Saved on the SSN API') : tr('shopify-secret-placeholder', 'From Shopify Notifications > Webhooks');
        by('shopify-copy').disabled = !s.webhook;
        by('shopify-disconnect').disabled = !s.webhook;
    }
    by('shopify-copy').onclick = function () { navigator.clipboard.writeText(by('shopify-webhook').value).then(function () { status(tr('shopify-copied', 'Shopify receiver URL copied.')); }).catch(function () { by('shopify-webhook').focus(); by('shopify-webhook').select(); }); };
    by('shopify-disconnect').onclick = function () { run(function () { return request('shopifyDisconnect'); }, ['shopify']); };
    by('shopify-import').onclick = function () {
        var button = this; button.disabled = true;
        by('shopify-import-status').textContent = tr('commerce-import-loading', 'Loading product...');
        request('shopifyImport', { shop: by('shopify-shop').value, url: by('shopify-product').value, token: by('shopify-token').value }).then(function (reply) {
            var item = reply.item; resetProductForm();
            ['name', 'url', 'image', 'purpose'].forEach(function (key) { by('commerce-' + key).value = item[key]; });
            setProductCurrency(item.currency); by('commerce-price').value = item.amount == null ? '' : item.amount;
            by('shopify-import-status').textContent = tr('commerce-import-review', 'Details loaded. Review below, add the product, then save setup.');
            by('commerce-panel').open = true; by('commerce-name').focus();
        }).catch(function (error) { by('shopify-import-status').textContent = error.message; }).then(function () { button.disabled = false; by('shopify-token').value = ''; });
    };
    var providerSnapshot = {};
    function providerLinks() {
        var provider = by('provider').value;
        by('provider-url').value = typeof lastResponse !== 'undefined' && lastResponse && lastResponse.streamID ? 'https://io.socialstream.ninja/' + encodeURIComponent(lastResponse.streamID) + '/' + provider : '';
        by('provider-guide').href = 'docs/creator-store-setup.html#' + provider;
        var preview = new URL('monetization.html', location.href);
        preview.search = '?demo&mode=commerce&view=alerts&provider=' + provider;
        if (typeof getSelectedTranslationLinkParam === 'function') preview.search += getSelectedTranslationLinkParam();
        by('provider-preview').href = preview.href;
        var s = providerSnapshot;
        setStatus('provider-status', !s.enabled ? tr('commerce-receiver-off', 'Receiver off. Open Receiver setting to enable it.') : !s.on ? tr('commerce-ssn-off', 'Turn SSN on to receive alerts.') : s.connected ? tr('commerce-receiver-ready', 'Receiver connected. Provider delivery is confirmed only when an event arrives.') : tr('commerce-receiver-wait', 'Receiver disconnected. Check your connection.'));
        if (new URLSearchParams(location.search).has('localserver')) {
            setStatus('provider-status', tr('commerce-receiver-local', 'Local Server is selected. These public webhook URLs need the hosted API receiver; turn off Local Server to receive them here.'));
        }
        var seen = s.providers && s.providers[provider];
        by('provider-seen').textContent = seen ? tr('commerce-last-event', 'Last event received:') + ' ' + new Date(seen.at).toLocaleTimeString() + ' (' + tr(seen.accepted ? 'commerce-event-accepted' : 'commerce-event-skipped', seen.accepted ? 'accepted' : 'test, private or unsupported event skipped') + ')' : tr('commerce-no-event', 'No event received in this app session.');
    }
    function providerStatus(reply) { providerSnapshot = reply.receiver || {}; providerLinks(); }
    by('provider').addEventListener('change', providerLinks);
    by('provider-copy').onclick = function () {
        if (!by('provider-url').value) return;
        navigator.clipboard.writeText(by('provider-url').value).then(function () { status(tr('commerce-webhook-copied', 'Private webhook URL copied.')); }).catch(function () { by('provider-url').type = 'text'; by('provider-url').focus(); by('provider-url').select(); });
    };
    by('provider-url').onblur = function () { this.type = 'password'; };
    by('provider-setting').onclick = function () {
        var input = document.querySelector('input[data-setting="socketserver"]');
        if (!input) return;
        var filter = document.getElementById('activeIcon'); if (filter && filter.getAttribute('aria-pressed') === 'true') filter.click();
        for (var parent = input.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
        if (typeof scrollToSetting === 'function') scrollToSetting('wrapper-global-connections-integrations-options', 'socketserver');
        else input.closest('div').scrollIntoView({ block: 'center' });
        var label = input.closest('label'); label.tabIndex = -1; label.focus();
    };
    by('fourthwall-import').onclick = function () {
        var button = this; button.disabled = true;
        by('fourthwall-status').textContent = tr('commerce-import-loading', 'Loading product...');
        request('fourthwallImport', { url: by('fourthwall-url').value, token: by('fourthwall-token').value }).then(function (reply) {
            var item = reply.item; resetProductForm();
            ['name', 'url', 'image', 'purpose'].forEach(function (key) { by('commerce-' + key).value = item[key]; });
            setProductCurrency(item.currency); by('commerce-price').value = item.amount == null ? '' : item.amount;
            by('fourthwall-status').textContent = tr('commerce-import-review', 'Details loaded. Review below, add the product, then save setup.');
            by('commerce-name').focus();
        }).catch(function (error) { by('fourthwall-status').textContent = error.message; }).then(function () { button.disabled = false; by('fourthwall-token').value = ''; });
    };
	by('commerce-cancel').onclick = resetProductForm;
	by('commerce-add').onclick = function () {
		var raw = { name: by('commerce-name').value, url: by('commerce-url').value, image: by('commerce-image').value, amount: by('commerce-price').value, currency: by('commerce-currency').value, purpose: by('commerce-purpose').value };
		var item = SSNMonetization.commerce({ items: [raw] }).items[0];
		if (!item || (raw.image && !item.image) || (raw.amount !== '' && item.amount == null)) { status(tr('commerce-invalid', 'Enter a name, public HTTPS links, and a valid price or leave the price blank.')); return; }
		if (editingProduct >= 0) products[editingProduct] = item;
		else if (products.length < 20) products.push(item);
		else { status(tr('commerce-limit', 'You can add up to 20 products or links.')); return; }
		resetProductForm();
		by('commerce-add').textContent = tr('commerce-add', 'Add product or link'); renderProducts(); updateSaveLabel(); status(tr('commerce-unsaved', 'List updated. Click Save setup to apply.'));
	};
	['view', 'style', 'scale', 'cardevery', 'cardfor', 'onlytype'].forEach(function (key) { by(key).addEventListener('input', links); });
	function showMode() {
		links();
	}
	function values() {
		var config = { shopify: { enabled: by("shopify-enabled").checked, shop: by("shopify-shop").value }, wishlist: {}, ninja: {}, throne: {}, ebay: {}, commerce: { enabled: by("commerce-enabled").checked, qr: by("commerce-qr").checked, position: by("commerce-position").value, display: by("commerce-display").value, seconds: Number(by("commerce-seconds").value), items: products } };
		['wishlist', 'ninja', 'throne', 'ebay'].forEach(function (mode) {
			['enabled', 'qr', 'announce', 'interval'].forEach(function (key) {
				config[mode][key] = by(mode + '-' + key).checked;
			});
			config[mode].minutes = Number(by(mode + '-minutes').value);
			config[mode].position = by(mode + '-position').value;
		});
		config.presentation = {};
		['view', 'style', 'scale', 'cardevery', 'cardfor', 'onlytype'].forEach(function (key) { config.presentation[key] = ['scale', 'cardevery', 'cardfor'].indexOf(key) !== -1 ? Number(by(key).value) : by(key).value; });
		config.wishlist.url = by('wishlist-url').value;
		config.ninja.reliable = by('ninja-delivery').value === 'reliable';
		config.ninja.username = by('ninja-username').value;
		config.throne.username = by('throne-username').value;
		config.ebay.display = by('ebay-display').value;
		config.ebay.seconds = Number(by('ebay-seconds').value);
		return config;
	}
	function links() {
        providerLinks();
		if (typeof lastResponse === 'undefined' || !lastResponse || !lastResponse.streamID) return;
		var base = document.getElementById('dock') && document.getElementById('dock').raw;
		var u;
		try {
			u = new URL(base || document.getElementById('docklink').href);
			u.pathname = u.pathname.replace(/[^/]*$/, 'monetization.html');
			var keepServer = u.searchParams.has('server'), serverValue = u.searchParams.get('server');
			var connectionParams = new URLSearchParams(u.search);
			u.search = '';
			if (keepServer) u.searchParams.set('server', serverValue || '');
			if (connectionParams.has('server2')) u.searchParams.set('server2', connectionParams.get('server2'));
			if (connectionParams.has('localserver')) {
				['localserver', 'localserverport', 'server2'].forEach(function (key) {
					if (connectionParams.has(key)) u.searchParams.set(key, connectionParams.get(key));
				});
			}
			u.searchParams.set('session', lastResponse.streamID);
			if (lastResponse.password) u.searchParams.set('password', lastResponse.password);
			u.searchParams.set('mode', by('mode').value);
            ['view', 'style', 'scale', 'cardevery', 'cardfor', 'onlytype'].forEach(function (key) { if (by(key).value) u.searchParams.set(key, by(key).value); });
            if (typeof getSelectedTranslationLinkParam === 'function') { var language = new URLSearchParams(getSelectedTranslationLinkParam().replace(/^&/, '')).get('ln'); if (language) u.searchParams.set('ln', language); }
			var control = new URL('obs-control-dock.html', u.href);
			['localserver', 'localserverport'].forEach(function (key) {
				if (connectionParams.has('localserver') && connectionParams.has(key)) control.searchParams.set(key, connectionParams.get(key));
			});
            control.searchParams.set('session', lastResponse.streamID);
            control.searchParams.set('commerce', '');
            if (language) control.searchParams.set('ln', language);
            if (serverValue && /^wss?:\/\//i.test(serverValue)) control.searchParams.set('server', serverValue);
            by('control-dock').href = control.href;
            by('overlay').href = u.href;
			by('overlay').textContent = tr('money-open-overlay', 'Open overlay') + ': ' + by('mode').options[by('mode').selectedIndex].textContent;
		} catch (_) {}
		var name = by('ninja-username').value.trim();
		by('ninja-link').value = /^[a-z0-9_-]{1,50}$/i.test(name) ? 'https://ninjabacker.com/' + name.toLowerCase() : '';
		var preview = new URL('monetization.html', location.href); preview.searchParams.set('demo', ''); preview.searchParams.set('mode', by('mode').value);
        ['view', 'style', 'scale', 'cardevery', 'cardfor', 'onlytype'].forEach(function (key) { if (by(key).value) preview.searchParams.set(key, by(key).value); });
        if (typeof language !== 'undefined' && language) preview.searchParams.set('ln', language);
        by('preview').href = preview.href;
	}
	function showEbayStatus(reply) {
		var e = reply.ebay || {};
		by('ebay-environment').value = e.environment || 'production';
		setStatus('ebay-status', e.status || 'Connect your seller account');
		by('ebay-connect').textContent = moneyText(e.connected ? 'Reconnect eBay' : 'Connect eBay');
		if (e.connected) by('ebay-auth').hidden = true;
		var rows = by('ebay-items');
		rows.textContent = '';
		(e.items || []).forEach(function (item, index) {
			var row = document.createElement('div'),
				label = document.createElement('span');
			row.className = 'money-item';
			label.textContent = (item.bought ? '\u2713 ' : '') + item.name + ' \u00b7 ' + SSNMonetization.money(item.amount, item.currency);
			row.appendChild(label);
			['Move up', 'Remove'].forEach(function (name) {
				var button = document.createElement('button');
				button.type = 'button';
				button.textContent = tr(name === 'Move up' ? 'commerce-up' : 'commerce-remove', name);
				button.disabled = name === 'Move up' && index === 0;
				button.setAttribute('aria-label', button.textContent + ': ' + item.name);
				button.onclick = function () {
					run(function () {
						return request(name === 'Remove' ? 'ebayRemove' : 'ebayMove', { id: item.id });
					});
				};
				row.appendChild(button);
			});
			rows.appendChild(row);
		});
	}
	function showThroneStatus(reply) {
		var t = reply.throne || {};
		setStatus('throne-status', t.status || 'Disabled');
		by('throne-webhook').value = t.webhook || '';
		by('throne-rank').textContent = moneyText('Rank {rank} · {gifts} completed gifts', { rank: (t.gifts || 0) + 1, gifts: t.gifts || 0 });
		by('throne-reset').disabled = !t.gifts;
	}
	function render(reply, baseline, resetKeys) {
		if (!reply.config) return;
        refreshPlaceholders();
		reply.config = SSNMonetization.config(reply.config);
        var displayConfig = ready ? mergeDraft(reply.config, baseline || current.config, values()) : reply.config;
        (resetKeys || []).forEach(function (key) {
            var parts = key.split('.');
            if (parts.length === 1) displayConfig[key] = reply.config[key];
            else displayConfig[parts[0]][parts[1]] = reply.config[parts[0]][parts[1]];
        });
		current = reply;
        liveStatus(reply);
        by('shopify-enabled').checked = displayConfig.shopify.enabled; by('shopify-shop').value = displayConfig.shopify.shop; shopifyStatus(reply);
        providerStatus(reply); liveStatus(reply);
        ['view', 'style', 'scale', 'cardevery', 'cardfor', 'onlytype'].forEach(function (key) { by(key).value = displayConfig.presentation[key]; });
        products = displayConfig.commerce.items.slice(); renderProducts();
        ['enabled', 'qr'].forEach(function (key) { by('commerce-' + key).checked = displayConfig.commerce[key]; });
        ['position', 'display', 'seconds'].forEach(function (key) { by('commerce-' + key).value = displayConfig.commerce[key]; });
		['wishlist', 'ninja', 'throne', 'ebay'].forEach(function (mode) {
			var cfg = displayConfig[mode];
			['enabled', 'qr', 'announce', 'interval'].forEach(function (key) {
				by(mode + '-' + key).checked = cfg[key];
			});
			by(mode + '-minutes').value = cfg.minutes;
			by(mode + '-position').value = cfg.position;
		});
		by('wishlist-url').value = displayConfig.wishlist.url;
		by('ninja-username').value = displayConfig.ninja.username;
		by('ninja-delivery').value = displayConfig.ninja.reliable ? 'reliable' : 'live';
		showNinjaDelivery();
		by('ninja-webhook').value = reply.ninjaReceiver && reply.ninjaReceiver.webhook || '';
		by('ninja-secret').placeholder = moneyText(by('ninja-webhook').value ? 'Saved securely on the SSN API' : 'Generate in the NinjaBacker dashboard');
		by('throne-username').value = displayConfig.throne.username;
		by('ebay-display').value = displayConfig.ebay.display;
		by('ebay-seconds').value = displayConfig.ebay.seconds;
		by('ebay-cycle').hidden = displayConfig.ebay.display !== 'cycle';
		by('ninja-token').placeholder = moneyText(reply.tokenSaved ? 'Saved on this device' : 'Private Tip ID');
		setStatus('ninja-status', reply.status);
		showThroneStatus(reply);
		showEbayStatus(reply);
		by('undo').disabled = !reply.canUndo;
		by('complete').disabled = !reply.list.current;
		by('current').textContent = reply.list.current ? moneyText('Rank {rank} · Next: {name}', { rank: reply.list.rank, name: reply.list.current.name }) : reply.list.total ? moneyText('All {total} items unlocked!', { total: reply.list.total }) : moneyText('Load your wishlist or add its items below.');
		var rows = by('items');
		rows.textContent = '';
		reply.list.items.forEach(function (item) {
			var row = document.createElement('div'),
				label = document.createElement('span'),
				remove = document.createElement('button');
			row.className = 'money-item';
			label.textContent = (item.bought ? '\u2713 ' : '') + item.name + ' · ' + SSNMonetization.money(item.amount, item.currency);
			remove.type = 'button';
			remove.textContent = tr('commerce-remove', 'Remove');
			remove.setAttribute('aria-label', remove.textContent + ': ' + item.name);
			remove.onclick = function () {
				run(function () {
					return request('remove', { id: item.id });
				});
			};
			row.appendChild(label);
			row.appendChild(remove);
			rows.appendChild(row);
		});
		ready = true;
		updateSaveLabel();
		links();
	}
    async function run(job, resetKeys) {
        if (!ready || panel.hasAttribute('aria-busy')) return;
        var target = feedbackTarget(document.activeElement);
        delete feedbackUntil[target];
        var buttons = Array.prototype.map.call(panel.querySelectorAll('button'), function (button) {
            return { button: button, disabled: button.disabled };
        });
        function unlock() { buttons.forEach(function (entry) { entry.button.disabled = entry.disabled; }); }
        panel.setAttribute('aria-busy', 'true');
        buttons.forEach(function (entry) { entry.button.disabled = true; });
        try {
            var reply = await job();
            var snapshot = reply.config ? reply : await request('get');
            unlock();
            render(snapshot, null, resetKeys);
            status(reply.message || 'Saved.', target);
        } catch (e) {
            unlock();
            // A save may have succeeded before a later import failed.
            if (current) render(current);
            status(e.message, target);
        } finally {
            panel.removeAttribute('aria-busy');
            updateSaveLabel();
        }
    }
    async function save() {
        var submitted = JSON.parse(JSON.stringify(values()));
        var secrets = {};
        ['ninja-token', 'ninja-secret', 'shopify-secret'].forEach(function (id) { secrets[id] = by(id).value; });
        var clearToken = by('ninja-clear-token').checked;
        var response = await request('save', { config: submitted, token: secrets['ninja-token'].trim(), clearToken: clearToken, ninjaSecret: secrets['ninja-secret'].trim(), shopifySecret: secrets['shopify-secret'].trim() });
        ['ninja-token', 'ninja-secret', 'shopify-secret'].forEach(function (id) { if (by(id).value === secrets[id]) by(id).value = ''; });
        if (by('ninja-clear-token').checked === clearToken) by('ninja-clear-token').checked = false;
        render(response, submitted);
        panel.querySelectorAll('button').forEach(function (button) { button.disabled = true; });
        return response;
    }
	by('save').onclick = function () {
		run(save);
	};
	by('load').onclick = function () {
		run(async function () {
			await save();
			return request('import');
		});
	};
	by('add').onclick = function () {
		run(async function () {
			await save();
			var result = await request('add', { item: { name: by('item-name').value, amount: Number(by('item-price').value), currency: by('item-currency').value, url: by('item-url').value, image: by('item-image').value } });
			by('item-name').value = '';
			by('item-price').value = '';
			by('item-url').value = '';
			by('item-image').value = '';
			return result;
		});
	};
	by('complete').onclick = function () {
		if (current && current.list.current)
			run(function () {
				return request('complete', { id: current.list.current.id, supporter: by('buyer').value }).then(function (reply) {
					by('buyer').value = '';
					return reply;
				});
			});
	};
	by('undo').onclick = function () {
		run(function () {
			return request('undo');
		});
	};
	by('ebay-display').addEventListener('change', function () {
		by('ebay-cycle').hidden = by('ebay-display').value !== 'cycle';
	});
	by('ebay-connect').onclick = function () {
		run(async function () {
			var reply = await request('ebayConnect');
			by('ebay-auth').href = reply.url;
			by('ebay-auth').hidden = false;
			if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: reply.url });
			reply.message = 'Finish connecting on eBay, then enable the showcase and save setup.';
			return reply;
		});
	};
	by('ebay-environment').addEventListener('change', function () {
		var environment = by('ebay-environment').value;
		run(async function () {
			var reply = await request('ebayEnvironment', { environment: environment });
			by('ebay-auth').hidden = true;
			reply.message = 'Environment changed. Each environment keeps its own connection and products. Enable the showcase when ready.';
			return reply;
		}, ['ebay.enabled']);
	});
	by('ebay-disconnect').onclick = function () {
		run(function () {
			return request('ebayDisconnect');
		}, ['ebay.enabled']);
	};
	by('ebay-add').onclick = function () {
		run(async function () {
			var reply = await request('ebayAdd', { url: by('ebay-url').value });
			by('ebay-url').value = '';
			return reply;
		});
	};
	by('throne-copy').onclick = function () {
		var url = by('throne-webhook').value;
		if (!url) {
			status('Enable Throne and save setup first.');
			return;
		}
		if (!navigator.clipboard) {
			by('throne-webhook').select();
			status('Copy the selected URL.');
			return;
		}
		navigator.clipboard.writeText(url).then(
			function () {
				status('Webhook URL copied. Paste it into Throne.');
			},
			function () {
				by('throne-webhook').select();
				status('Copy the selected URL.');
			}
		);
	};
	by('throne-reset').onclick = function () {
		run(function () {
			return request('throneReset');
		});
	};
	by('mode').addEventListener('change', showMode);
	function showNinjaDelivery() { var reliable = by('ninja-delivery').value === 'reliable'; by('ninja-reliable-panel').hidden = !reliable; by('ninja-live-help').hidden = reliable; }
	by('ninja-delivery').addEventListener('change', showNinjaDelivery);
	by('ninja-webhook').addEventListener('click', function () { this.select(); });
	by('ninja-username').addEventListener('input', links);
	by('copy').onclick = function () {
		var url = by('overlay').href;
		if (!url || !url.includes('session=')) {
			status('Wait for your SSN session to load.');
			return;
		}
		if (!navigator.clipboard) {
			status('Open the overlay and copy its address.');
			return;
		}
		navigator.clipboard.writeText(url).then(
			function () {
				status('OBS link copied.');
			},
			function () {
				status('Open the overlay and copy its address.');
			}
		);
	};
	window.updateMonetizationLinks = links;
    window.updateMonetizationLanguage = function () {
        if (current && !panel.hasAttribute('aria-busy')) render(current);
    };
	setInterval(function () {
		if (ready && panel.open && !panel.hasAttribute('aria-busy'))
			request('get').then(
				function (reply) {
                    if (panel.hasAttribute('aria-busy')) return;
					providerStatus(reply); liveStatus(reply); shopifyStatus(reply);
                    setStatus('ninja-status', reply.status);
					showThroneStatus(reply);
					showEbayStatus(reply);
				},
				function () {}
			);
	}, 5000);
	function hydrate(attempt) {
		request('get').then(
			function (reply) {
				render(reply);
				showMode();
			},
			function () {
				if (attempt < 12)
					setTimeout(function () {
						hydrate(attempt + 1);
					}, 1000);
				else status('Could not load setup. Reopen the popup.');
			}
		);
	}
	hydrate(0);
})();
