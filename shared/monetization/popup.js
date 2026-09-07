(function () {
	'use strict';
	var panel = document.getElementById('monetization-settings');
	if (!panel) return;
	var ready = false,
		current = null;
	var products = [], editingProduct = -1;
	function tr(key, fallback) { return typeof getTranslation === 'function' ? getTranslation(key, fallback) : fallback; }
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
			label.textContent = item.name + (item.amount != null ? ' - ' + SSNMonetization.money(item.amount, item.currency) : ''); row.appendChild(label);
			['show', 'edit', 'up', 'remove', 'copy'].forEach(function (action) {
				var button = document.createElement('button'); button.type = 'button';
				button.textContent = tr('commerce-' + action, { show: 'Show now', edit: 'Edit', up: 'Move up', remove: 'Remove', copy: 'Copy public link' }[action]);
				button.setAttribute('aria-label', button.textContent + ': ' + item.name);
				button.disabled = action === 'up' && index === 0;
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
					resetProductForm(); renderProducts();
				}; row.appendChild(button);
			}); rows.appendChild(row);
		});
	}
    function liveStatus(reply) {
        var live = reply.commerceLive, active = live && (!live.until || live.until > Date.now());
        by('commerce-live-status').textContent = active ? live.mode === 'hide' ? tr('commerce-hidden', 'Products hidden; activity alerts remain enabled.') : tr('commerce-showing', 'Product pinned on air.') : tr('commerce-scheduled', 'Using saved product schedule.');
        var shop = reply.publicShop || {};
        by('shop-url').value = shop.url || ''; by('shop-copy').disabled = !shop.url; by('shop-remove').disabled = !shop.published;
        by('shop-status').textContent = shop.status || (shop.published ? tr('commerce-published', 'Saved links are public. Changes update the same viewer link.') : tr('commerce-unpublished', 'Publish your saved links to get a stable viewer URL.'));
    }
    function control(command, url) {
        request('commerceControl', { command: command, url: url, seconds: Number(by('commerce-duration').value) }).then(function (reply) { liveStatus(reply); }).catch(function (error) { status(error.message); });
    }
    ['next', 'hide', 'resume'].forEach(function (command) { by('commerce-' + command).onclick = function () { control(command); }; });
    ['publish', 'remove'].forEach(function (command) {
        by('shop-' + command).onclick = function () {
            var button = this; button.disabled = true;
            request(command === 'publish' ? 'publishShop' : 'unpublishShop').then(liveStatus).catch(function (error) { by('shop-status').textContent = error.message; }).then(function () { button.disabled = false; });
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
	function status(text) {
		by('status').textContent = text;
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
        by('shopify-status').textContent = tr('shopify-status-' + (s.status || '').toLowerCase().replace(/[^a-z]+/g, '-'), s.status || 'Set up Shopify on this device');
        by('shopify-secret').placeholder = s.webhook ? tr('shopify-secret-saved', 'Saved on the SSN API') : tr('shopify-secret-placeholder', 'From Shopify Notifications > Webhooks');
        by('shopify-copy').disabled = !s.webhook;
        by('shopify-disconnect').disabled = !s.webhook;
    }
    by('shopify-copy').onclick = function () { navigator.clipboard.writeText(by('shopify-webhook').value).then(function () { status(tr('shopify-copied', 'Shopify receiver URL copied.')); }).catch(function () { by('shopify-webhook').focus(); by('shopify-webhook').select(); }); };
    by('shopify-disconnect').onclick = function () { run(function () { return request('shopifyDisconnect'); }); };
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
        by('provider-status').textContent = !s.enabled ? tr('commerce-receiver-off', 'Receiver off. Open Receiver setting to enable it.') : !s.on ? tr('commerce-ssn-off', 'Turn SSN on to receive alerts.') : s.connected ? tr('commerce-receiver-ready', 'Receiver connected. Provider delivery is confirmed only when an event arrives.') : tr('commerce-receiver-wait', 'Receiver disconnected. Check your connection.');
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
		by('commerce-add').textContent = tr('commerce-add', 'Add product or link'); renderProducts(); status(tr('commerce-unsaved', 'List updated. Click Save setup to apply.'));
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
		['view', 'style', 'scale', 'cardevery', 'cardfor', 'onlytype'].forEach(function (key) { config.presentation[key] = by(key).value; });
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
			u.search = '';
			if (keepServer) u.searchParams.set('server', serverValue || '');
			u.searchParams.set('session', lastResponse.streamID);
			if (lastResponse.password) u.searchParams.set('password', lastResponse.password);
			u.searchParams.set('mode', by('mode').value);
            ['view', 'style', 'scale', 'cardevery', 'cardfor', 'onlytype'].forEach(function (key) { if (by(key).value) u.searchParams.set(key, by(key).value); });
            if (typeof getSelectedTranslationLinkParam === 'function') { var language = new URLSearchParams(getSelectedTranslationLinkParam().replace(/^&/, '')).get('ln'); if (language) u.searchParams.set('ln', language); }
			by('overlay').href = u.href;
			by('overlay').textContent = 'Open ' + (by('mode').value === 'commerce' ? tr('commerce-title', 'Products & support links') : by('mode').value === 'ebay' ? 'eBay Showcase' : by('mode').value === 'wishlist' ? 'Wishlist Rank-Up' : by('mode').value === 'throne' ? 'Throne Gifts' : 'NinjaBacker') + ' overlay';
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
		by('ebay-status').textContent = e.status || 'Connect your seller account';
		by('ebay-connect').textContent = e.connected ? 'Reconnect eBay' : 'Connect eBay';
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
				button.textContent = name;
				button.disabled = name === 'Move up' && index === 0;
				button.setAttribute('aria-label', name + ' ' + item.name);
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
		by('throne-status').textContent = t.status || 'Disabled';
		by('throne-webhook').value = t.webhook || '';
		by('throne-rank').textContent = 'Rank ' + ((t.gifts || 0) + 1) + ' \u00b7 ' + (t.gifts || 0) + ' completed gifts';
		by('throne-reset').disabled = !t.gifts;
	}
	function render(reply) {
		if (!reply.config) return;
		reply.config = SSNMonetization.config(reply.config);
		current = reply;
        liveStatus(reply);
        by('shopify-enabled').checked = reply.config.shopify.enabled; by('shopify-shop').value = reply.config.shopify.shop; shopifyStatus(reply);
        providerStatus(reply); liveStatus(reply);
        ['view', 'style', 'scale', 'cardevery', 'cardfor', 'onlytype'].forEach(function (key) { by(key).value = reply.config.presentation[key]; });
        products = reply.config.commerce.items.slice(); editingProduct = -1; renderProducts();
        ['enabled', 'qr'].forEach(function (key) { by('commerce-' + key).checked = reply.config.commerce[key]; });
        ['position', 'display', 'seconds'].forEach(function (key) { by('commerce-' + key).value = reply.config.commerce[key]; });
		['wishlist', 'ninja', 'throne', 'ebay'].forEach(function (mode) {
			var cfg = reply.config[mode];
			['enabled', 'qr', 'announce', 'interval'].forEach(function (key) {
				by(mode + '-' + key).checked = cfg[key];
			});
			by(mode + '-minutes').value = cfg.minutes;
			by(mode + '-position').value = cfg.position;
		});
		by('wishlist-url').value = reply.config.wishlist.url;
		by('ninja-username').value = reply.config.ninja.username;
		by('ninja-delivery').value = reply.config.ninja.reliable ? 'reliable' : 'live';
		showNinjaDelivery();
		by('ninja-webhook').value = reply.ninjaReceiver && reply.ninjaReceiver.webhook || '';
		by('ninja-secret').placeholder = by('ninja-webhook').value ? 'Saved securely on the SSN API' : 'Generate in the NinjaBacker dashboard';
		by('throne-username').value = reply.config.throne.username;
		by('ebay-display').value = reply.config.ebay.display;
		by('ebay-seconds').value = reply.config.ebay.seconds;
		by('ebay-cycle').hidden = reply.config.ebay.display !== 'cycle';
		by('ninja-token').placeholder = reply.tokenSaved ? 'Saved on this device' : 'Private Tip ID';
		by('ninja-status').textContent = reply.status;
		showThroneStatus(reply);
		showEbayStatus(reply);
		by('undo').disabled = !reply.canUndo;
		by('complete').disabled = !reply.list.current;
		by('current').textContent = reply.list.current ? 'Rank ' + reply.list.rank + ' · Next: ' + reply.list.current.name : reply.list.total ? 'All ' + reply.list.total + ' items unlocked!' : 'Load your wishlist or add its items below.';
		var rows = by('items');
		rows.textContent = '';
		reply.list.items.forEach(function (item) {
			var row = document.createElement('div'),
				label = document.createElement('span'),
				remove = document.createElement('button');
			row.className = 'money-item';
			label.textContent = (item.bought ? '\u2713 ' : '') + item.name + ' · ' + SSNMonetization.money(item.amount, item.currency);
			remove.type = 'button';
			remove.textContent = 'Remove';
			remove.setAttribute('aria-label', 'Remove ' + item.name);
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
		links();
	}
	async function run(job) {
		if (!ready) return;
		panel.setAttribute('aria-busy', 'true');
		panel.querySelectorAll('button').forEach(function (b) {
			b.disabled = true;
		});
		try {
			var reply = await job();
			render(reply.config ? reply : await request('get'));
			status(reply.message || 'Saved.');
		} catch (e) {
			status(e.message);
		} finally {
			panel.removeAttribute('aria-busy');
			panel.querySelectorAll('button').forEach(function (b) {
				b.disabled = false;
			});
			if (current) {
				by('complete').disabled = !current.list.current;
				by('undo').disabled = !current.canUndo;
				by('throne-reset').disabled = !(current.throne && current.throne.gifts);
				showEbayStatus(current);
			}
		}
	}
	async function save() {
		var response = await request('save', { config: values(), token: by('ninja-token').value.trim(), clearToken: by('ninja-clear-token').checked, ninjaSecret: by('ninja-secret').value.trim(), shopifySecret: by('shopify-secret').value.trim() });
		by('ninja-token').value = '';
        by('shopify-secret').value = '';
		by('ninja-secret').value = '';
		by('ninja-clear-token').checked = false;
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
		});
	});
	by('ebay-disconnect').onclick = function () {
		run(function () {
			return request('ebayDisconnect');
		});
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
	setInterval(function () {
		if (ready && panel.open)
			request('get').then(
				function (reply) {
					providerStatus(reply); liveStatus(reply); shopifyStatus(reply);
                    by('ninja-status').textContent = reply.status;
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
