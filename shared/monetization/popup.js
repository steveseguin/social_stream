(function () {
	'use strict';
	var panel = document.getElementById('monetization-settings');
	if (!panel) return;
	var ready = false,
		current = null;
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
	function showMode() {
		var mode = by('mode').value;
		by('wishlist-panel').hidden = mode !== 'wishlist';
		by('ninja-panel').hidden = mode !== 'ninja';
		by('throne-panel').hidden = mode !== 'throne';
		by('ebay-panel').hidden = mode !== 'ebay';
		links();
	}
	function values() {
		var config = { wishlist: {}, ninja: {}, throne: {}, ebay: {} };
		['wishlist', 'ninja', 'throne', 'ebay'].forEach(function (mode) {
			['enabled', 'qr', 'announce', 'interval'].forEach(function (key) {
				config[mode][key] = by(mode + '-' + key).checked;
			});
			config[mode].minutes = Number(by(mode + '-minutes').value);
			config[mode].position = by(mode + '-position').value;
		});
		config.wishlist.url = by('wishlist-url').value;
		config.ninja.reliable = by('ninja-delivery').value === 'reliable';
		config.ninja.username = by('ninja-username').value;
		config.throne.username = by('throne-username').value;
		config.ebay.display = by('ebay-display').value;
		config.ebay.seconds = Number(by('ebay-seconds').value);
		return config;
	}
	function links() {
		if (typeof lastResponse === 'undefined' || !lastResponse || !lastResponse.streamID) return;
		var base = document.getElementById('dock') && document.getElementById('dock').raw;
		var u;
		try {
			u = new URL(base || document.getElementById('docklink').href);
			u.pathname = u.pathname.replace(/[^/]*$/, 'monetization.html');
			u.search = '';
			u.searchParams.set('session', lastResponse.streamID);
			if (lastResponse.password) u.searchParams.set('password', lastResponse.password);
			u.searchParams.set('mode', by('mode').value);
			by('overlay').href = u.href;
			by('overlay').textContent = 'Open ' + (by('mode').value === 'ebay' ? 'eBay Showcase' : by('mode').value === 'wishlist' ? 'Wishlist Rank-Up' : by('mode').value === 'throne' ? 'Throne Gifts' : 'NinjaBacker') + ' overlay';
		} catch (_) {}
		var name = by('ninja-username').value.trim();
		by('ninja-link').value = /^[a-z0-9_-]{1,50}$/i.test(name) ? 'https://ninjabacker.com/' + name.toLowerCase() : '';
		by('preview').href = 'monetization.html?demo&mode=' + by('mode').value;
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
		var response = await request('save', { config: values(), token: by('ninja-token').value.trim(), clearToken: by('ninja-clear-token').checked, ninjaSecret: by('ninja-secret').value.trim() });
		by('ninja-token').value = '';
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
		if (ready && panel.open && (by('mode').value === 'ninja' || by('mode').value === 'throne' || by('mode').value === 'ebay'))
			request('get').then(
				function (reply) {
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
