(function () {
	'use strict';
	var M = SSNMonetization,
		privateState = { token: '', list: { url: '', items: [] }, seen: [] },
		ready = false,
		source = null,
		sourceKey = '',
		status = 'Disabled',
		lastBroadcast = 0,
		next = { wishlist: 0, ninja: 0, throne: 0, ebay: 0 },
		previousConfig = '',
		wasOn = false,
		queue = Promise.resolve(),
		lastPurchase = null,
		throneSource = null,
		throneSourceKey = '',
		throneStatus = 'Disabled';
	var ebay = SSNEbayService({
		privateState: function () {
			return privateState;
		},
		store: store,
		config: function () {
			return cfg().ebay;
		},
		enabled: function () {
			return ready && isExtensionOn;
		},
		broadcast: broadcast,
		serialize: function (job) {
			var result = queue.then(job);
			queue = result.catch(function () {});
			return result;
		},
		deliver: function (data) {
			return processIncomingMessage(data);
		},
		chat: function (text) {
			if (isExtensionOn) sendMessageToTabs({ response: text, outgoingOrigin: 'chatbot' }, false, null, false, true, false);
		}
	});
	function store() {
		return new Promise(function (resolve, reject) {
			chrome.storage.local.set({ monetizationPrivate: privateState, settings: settings }, function () {
				var error = chrome.runtime.lastError;
				error ? reject(new Error('Could not save monetization settings.')) : resolve();
			});
		});
	}
	function cfg() {
		return M.config(settings.monetization);
	}
	function list() {
		return M.ladder(privateState.list, cfg().wishlist.url);
	}
	function publicState() {
		var c = cfg(),
			l = list();
		return { ebay: ebay.publicState(), throne: { enabled: c.throne.enabled, username: c.throne.username, qr: c.throne.qr, position: c.throne.position, url: c.throne.username ? 'https://throne.com/' + encodeURIComponent(c.throne.username) : '', rank: thronePrivate().gifts + 1, gifts: thronePrivate().gifts }, wishlist: { enabled: c.wishlist.enabled, qr: c.wishlist.qr, position: c.wishlist.position, rank: l.rank, total: l.total, item: l.current ? { name: l.current.name, amount: l.current.amount, currency: l.current.currency, image: l.current.image, url: M.purchaseURL(l.current, l.url) } : null, url: l.url }, ninja: { enabled: c.ninja.enabled, qr: c.ninja.qr, position: c.ninja.position, username: c.ninja.username, url: c.ninja.username ? 'https://ninjabacker.com/' + encodeURIComponent(c.ninja.username) : '' } };
	}
	function broadcast(purchase) {
		if (!ready || !isExtensionOn) return;
		var data = { event: 'monetization_update', type: 'socialstream', platform: 'socialstream', meta: { monetization: publicState() } };
		if (purchase) data.meta.wishlistPurchase = purchase;
		sendDataP2P(data);
		lastBroadcast = Date.now();
	}
	function announce(mode) {
		var c = cfg(),
			l = list(),
			text = '';
		if (!isExtensionOn || !c[mode].enabled) return false;
		if (mode === 'wishlist' && l.current) text = 'Help the stream reach rank ' + (l.rank + 1) + ': ' + l.current.name + ' (' + M.money(l.current.amount, l.current.currency) + '). Buy through the wishlist: ' + M.purchaseURL(l.current, l.url);
		if (mode === 'ninja' && c.ninja.username) text = 'Support the stream on NinjaBacker: https://ninjabacker.com/' + c.ninja.username + ' — optional tips, always appreciated!';
		if (mode === 'throne' && c.throne.username) text = 'Send a gift and help the stream rank up: https://throne.com/' + c.throne.username;
		if (mode === 'ebay') {
			var item = M.ebayCurrent(ebay.publicState().items, c.ebay, Date.now());
			if (item) text = 'On eBay: ' + item.name + ' ' + item.url;
		}
		if (!text) return false;
		sendMessageToTabs({ response: text, outgoingOrigin: 'chatbot' }, false, null, false, true, false);
		return true;
	}
	function idleStatus(c) {
		return !c.ninja.enabled ? 'Disabled' : !isExtensionOn ? 'Turn SSN on to listen' : 'Add your username and private Tip ID';
	}
	async function verifyNinja(username, token) {
		var controller = new AbortController(),
			timer = setTimeout(function () {
				controller.abort();
			}, 10000);
		try {
			var options = { credentials: 'omit', redirect: 'error', signal: controller.signal };
			var results = await Promise.all([fetch('https://ninjabacker.com/v1/tips/' + encodeURIComponent(token), options), fetch('https://ninjabacker.com/v1/public/performer/' + encodeURIComponent(token), options)]);
			if (!results[0].ok || !results[1].ok) throw new Error('Check the private Tip ID in your NinjaBacker dashboard.');
			var owner = await results[1].json();
			if (String(owner.username || '').toLowerCase() !== username.toLowerCase()) throw new Error('This Tip ID belongs to a different NinjaBacker username.');
		} catch (e) {
			if (e.name === 'AbortError' || e instanceof TypeError) throw new Error('Could not verify NinjaBacker. Check your connection and retry.');
			throw e;
		} finally {
			clearTimeout(timer);
		}
	}
	function connect() {
		var c = cfg(),
			key = isExtensionOn && c.ninja.enabled && c.ninja.username && privateState.token ? c.ninja.username + '|' + privateState.token : '';
		if (key === sourceKey) {
			if (!key) status = idleStatus(c);
			return;
		}
		if (source) {
			source.close();
			source = null;
		}
		sourceKey = key;
		status = key ? 'Connecting to NinjaBacker' : idleStatus(c);
		if (!key) return;
		var activeKey = key;
		source = new EventSource('https://ninjabacker.com/v1/subscribe/' + encodeURIComponent(privateState.token));
		source.onopen = function () {
			if (sourceKey === activeKey) status = 'Listening for tips';
		};
		source.onerror = function () {
			if (sourceKey === activeKey) status = 'Reconnecting to NinjaBacker';
		};
		source.onmessage = function (event) {
			if (sourceKey !== activeKey || !isExtensionOn || event.data.length > 16000) return;
			try {
				var incoming = JSON.parse(event.data);
				if (incoming.type === 'tip' && incoming.isTest === true) {
					sendDataP2P({ event: 'monetization_test', type: 'socialstream', platform: 'socialstream', meta: { ninjabackerTest: { id: 'ninja-test-' + String(incoming.timestamp || Date.now()), at: Date.now() } } });
					return;
				}
				var tip = M.tip(incoming);
				if (!tip || privateState.seen.indexOf(tip.id) !== -1) return;
				privateState.seen.push(tip.id);
				privateState.seen = privateState.seen.slice(-100);
				chrome.storage.local.set({ monetizationPrivate: privateState });
				Promise.resolve(processIncomingMessage(tip)).catch(function () {
					status = 'Could not deliver the tip to SSN';
				});
			} catch (_) {}
		};
	}
	async function importList() {
		var url = cfg().wishlist.url;
		if (!url) throw new Error('Enter a public Amazon wishlist URL first.');
		var controller = new AbortController(),
			timer = setTimeout(function () {
				controller.abort();
			}, 15000);
		try {
			var response = await fetch(url, { credentials: 'omit', redirect: 'error', signal: controller.signal });
			if (!response.ok) throw new Error('Amazon did not allow this list to be read. Add items manually below.');
			var html = await response.text();
			var imported = M.parseList(html, url, document),
				previous = M.ladder(privateState.list, url);
			imported.items.forEach(function (i) {
				var old = previous.items.find(function (o) {
					return o.id === i.id;
				});
				if (old) {
					i.bought = old.bought;
					i.supporter = old.supporter;
				}
			});
			previous.items.forEach(function (i) {
				if (
					!imported.items.some(function (n) {
						return n.id === i.id;
					})
				)
					imported.items.push(i);
			});
			if (
				imported.items.some(function (i) {
					return i.currency !== imported.items[0].currency;
				})
			)
				throw new Error('Use the same currency for every item.');
			var oldId = previous.current && previous.current.id;
			privateState.list = { url: url, items: imported.items.slice(0, 100) };
			await store();
			broadcast();
			if (cfg().wishlist.announce && list().current && list().current.id !== oldId) announce('wishlist');
			return 'Loaded ' + imported.items.length + ' items. Review prices; missing items are never treated as purchases.';
		} catch (e) {
			if (e.name === 'AbortError') throw new Error('Amazon took too long. Add items manually or retry later.');
			throw e;
		} finally {
			clearTimeout(timer);
		}
	}
	function thronePrivate() {
		if (!privateState.throne) privateState.throne = { key: '', hook: '', username: '', gifts: 0, seen: [] };
		return privateState.throne;
	}
	async function prepareThrone(updated, old) {
		if (!updated.enabled) return;
		if (!updated.username) throw new Error('Enter your Throne username.');
		var p = thronePrivate();
		if (old.enabled && old.username === updated.username && p.key) return;
		var controller = new AbortController(),
			timer = setTimeout(function () {
				controller.abort();
			}, 10000);
		try {
			var r = await fetch('https://api.socialstream.ninja/v1/throne/status', { credentials: 'omit', redirect: 'error', signal: controller.signal });
			if (!r.ok || (await r.json()).protocol !== 'ssn-throne-1') throw new Error();
		} catch (_) {
			throw new Error('The Throne connection service is not available yet. Your setup has not changed.');
		} finally {
			clearTimeout(timer);
		}
		if (!p.key || p.username !== updated.username) {
			var bytes = new Uint8Array(32);
			crypto.getRandomValues(bytes);
			var key = Array.from(bytes)
				.map(function (n) {
					return n.toString(16).padStart(2, '0');
				})
				.join('');
			var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ssn-throne:' + key));
			var hook = Array.from(new Uint8Array(digest))
				.map(function (n) {
					return n.toString(16).padStart(2, '0');
				})
				.join('');
			privateState.throne = { key: key, hook: hook, username: updated.username, gifts: 0, seen: [] };
		}
	}
	function connectThrone() {
		var c = cfg().throne,
			p = thronePrivate(),
			key = isExtensionOn && c.enabled && c.username === p.username && p.key ? p.key : '';
		if (!key) {
			throneStatus = !c.enabled ? 'Disabled' : !isExtensionOn ? 'Turn SSN on to listen' : 'Save setup to connect';
		}
		if (key === throneSourceKey) return;
		if (throneSource) {
			throneSource.close();
			throneSource = null;
		}
		throneSourceKey = key;
		if (!key) return;
		throneStatus = 'Connecting to Throne';
		throneSource = new EventSource('https://api.socialstream.ninja/v1/throne/events?key=' + key + '&creator=' + encodeURIComponent(c.username));
		throneSource.onopen = function () {
			if (key === throneSourceKey) throneStatus = 'Connected; waiting for a verified gift';
		};
		throneSource.onerror = function () {
			if (key === throneSourceKey) throneStatus = 'Reconnecting to the gift service';
		};
		throneSource.onmessage = function (event) {
			if (key !== throneSourceKey || !isExtensionOn || event.data.length > 16384) return;
			var data;
			try {
				data = JSON.parse(event.data);
			} catch (_) {
				return;
			}
			var gift = M.throne(data);
			if (!gift) return;
			var job = queue.then(async function () {
				var current = cfg().throne,
					p = thronePrivate();
				if (key !== throneSourceKey || !current.enabled || !isExtensionOn || gift.meta.throne.creator !== current.username || p.seen.indexOf(gift.id) !== -1) return;
				var oldGifts = p.gifts;
				p.seen.push(gift.id);
				if (gift.meta.throne.completed) p.gifts++;
				try {
					await store();
				} catch (e) {
					p.seen.pop();
					p.gifts = oldGifts;
					throneStatus = 'Could not save gift; reconnect to retry';
					throw e;
				}
				p.seen = p.seen.slice(-1000);
				throneStatus = 'Gift received';
				broadcast();
				await processIncomingMessage(gift);
				if (current.announce) sendMessageToTabs({ response: (gift.event === 'giftfunded' ? 'Community funded ' : gift.chatname + (gift.event === 'giftcontribution' ? ' contributed to ' : ' gifted ')) + gift.subtitle + '!' + (gift.meta.throne.completed ? ' Rank ' + (p.gifts + 1) + ' unlocked.' : '') + ' https://throne.com/' + current.username, outgoingOrigin: 'chatbot' }, false, null, false, true, false);
			});
			queue = job.catch(function () {});
		};
	}
	async function action(request) {
		if (!ready) throw new Error('Settings are still loading.');
		var c = cfg();
		if (request.action.indexOf('ebay') === 0) {
			var result = await ebay.action(request);
			if (request.action === 'ebayDisconnect') {
				c.ebay.enabled = false;
				settings.monetization = { json: JSON.stringify(c) };
				await store();
				broadcast();
			}
			return Object.assign(snapshot(), result);
		}
		if (request.action === 'save') {
			var updated = M.config(request.config);
			if (request.config && request.config.wishlist && request.config.wishlist.url && !updated.wishlist.url) throw new Error('Use the full public Amazon wishlist URL.');
			if (request.config && request.config.ninja && request.config.ninja.username && !updated.ninja.username) throw new Error('Use your NinjaBacker username, without a URL.');
			var token = request.clearToken ? '' : request.token || privateState.token;
			if (token && !/^[a-zA-Z0-9_-]{8,128}$/.test(token)) throw new Error('Paste the private Tip ID from your NinjaBacker dashboard.');
			if (updated.ninja.enabled && updated.ninja.username && token && (!c.ninja.enabled || token !== privateState.token || updated.ninja.username !== c.ninja.username)) await verifyNinja(updated.ninja.username, token);
			if (updated.ebay.enabled && !c.ebay.enabled && !(await ebay.verify())) throw new Error('Finish connecting eBay before enabling the showcase.');
			await prepareThrone(updated.throne, c.throne);
			privateState.token = token;
			settings.monetization = { json: JSON.stringify(updated) };
			await store();
			connect();
			connectThrone();
			broadcast();
			if (updated.wishlist.enabled && updated.wishlist.announce && !c.wishlist.enabled) announce('wishlist');
			if (updated.ninja.enabled && updated.ninja.announce && (!c.ninja.enabled || c.ninja.username !== updated.ninja.username)) announce('ninja');
			next.wishlist = Date.now() + updated.wishlist.minutes * 60000;
			next.ninja = Date.now() + updated.ninja.minutes * 60000;
			next.throne = Date.now() + updated.throne.minutes * 60000;
			next.ebay = Date.now() + updated.ebay.minutes * 60000;
		} else if (request.action === 'throneReset') {
			thronePrivate().gifts = 0;
			await store();
			broadcast();
		} else if (request.action === 'import') return { message: await importList() };
		else if (request.action === 'add') {
			if (!c.wishlist.url) throw new Error('Save a wishlist URL first.');
			var l = list(),
				entry = M.item(request.item);
			if (!entry) throw new Error('Enter an item name and a positive price.');
			if (l.items.length >= 100) throw new Error('The ladder supports up to 100 items.');
			if (l.items.length && entry.currency !== l.items[0].currency) throw new Error('Use the same currency for every item.');
			entry.id = 'manual-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
			var oldId = l.current && l.current.id;
			l.items.push(entry);
			privateState.list = { url: l.url, items: l.items };
			await store();
			broadcast();
			if (c.wishlist.announce && list().current && list().current.id !== oldId) announce('wishlist');
		} else if (request.action === 'complete') {
			var l = list();
			if (!l.current || l.current.id !== request.id) throw new Error('The current item changed. Refresh and check it first.');
			l.current.bought = true;
			l.current.supporter = String(request.supporter || '')
				.trim()
				.slice(0, 60);
			lastPurchase = l.current.id;
			privateState.list = { url: l.url, items: l.items };
			await store();
			var purchase = { id: 'wishlist-' + Date.now(), name: l.current.name, supporter: l.current.supporter, at: Date.now() };
			broadcast(purchase);
			if (c.wishlist.enabled && c.wishlist.announce) {
				if (isExtensionOn) sendMessageToTabs({ response: (l.current.supporter ? l.current.supporter + ' bought ' : 'Purchased: ') + l.current.name + '! Rank ' + (l.rank + 1) + ' unlocked.', outgoingOrigin: 'chatbot' }, false, null, false, true, false);
				announce('wishlist');
			}
		} else if (request.action === 'undo') {
			var l = list(),
				entry = l.items.find(function (i) {
					return i.id === lastPurchase;
				});
			if (!entry) throw new Error('No purchase from this session to undo.');
			entry.bought = false;
			entry.supporter = '';
			lastPurchase = null;
			privateState.list = { url: l.url, items: l.items };
			await store();
			broadcast();
		} else if (request.action === 'remove') {
			var l = list();
			privateState.list = {
				url: l.url,
				items: l.items.filter(function (i) {
					return i.id !== request.id;
				})
			};
			await store();
			broadcast();
		}
		return snapshot();
	}
	function snapshot() {
		return { ebay: ebay.snapshot(), throne: { status: throneStatus, gifts: thronePrivate().gifts, webhook: thronePrivate().hook ? 'https://api.socialstream.ninja/v1/throne/webhook/' + thronePrivate().hook : '' }, config: cfg(), list: list(), tokenSaved: !!privateState.token, status: status, canUndo: !!lastPurchase };
	}
	window.handleMonetizationRequest = function (request, sender) {
		if (sender && sender.tab && sender.tab.id !== null && sender.tab.id !== undefined) return Promise.resolve({ error: 'Use the SSN popup to configure monetization.' });
		var job = queue.then(function () {
			return request.action === 'get' ? snapshot() : action(request);
		});
		queue = job.catch(function () {});
		return job.catch(function (e) {
			return { error: e.message || 'Monetization action failed.' };
		});
	};
	chrome.storage.local.get(['monetizationPrivate'], function (saved) {
		var p = saved.monetizationPrivate;
		if (p && typeof p === 'object') {
			if (p.ebay && (p.ebay.key === '' || /^[a-f0-9]{64}$/.test(p.ebay.key || '')) && Array.isArray(p.ebay.items) && Array.isArray(p.ebay.seen)) privateState.ebay = { key: p.ebay.key, items: p.ebay.items.slice(0, 20), seen: p.ebay.seen.slice(-10000), cursor: Number(p.ebay.cursor) || 0 };
			if (p.throne && /^[a-f0-9]{64}$/.test(p.throne.key || '') && /^[a-f0-9]{64}$/.test(p.throne.hook || ''))
				privateState.throne = {
					key: p.throne.key,
					hook: p.throne.hook,
					username: String(p.throne.username || ''),
					gifts: Math.max(0, Math.min(1000000, Number(p.throne.gifts) || 0)),
					seen: Array.isArray(p.throne.seen)
						? p.throne.seen
								.filter(function (id) {
									return typeof id === 'string';
								})
								.slice(-1000)
						: []
				};
			privateState.token = typeof p.token === 'string' ? p.token : '';
			privateState.list = p.list && typeof p.list === 'object' ? p.list : { url: '', items: [] };
			privateState.seen = Array.isArray(p.seen)
				? p.seen
						.filter(function (s) {
							return typeof s === 'string';
						})
						.slice(-100)
				: [];
		}
		ready = true;
	});
	setInterval(function () {
		if (!ready || !loadedFirst) return;
		ebay.poll();
		connect();
		connectThrone();
		var c = cfg(),
			now = Date.now(),
			key = JSON.stringify(c);
		if (key !== previousConfig) {
			previousConfig = key;
			next.wishlist = now + c.wishlist.minutes * 60000;
			next.ninja = now + c.ninja.minutes * 60000;
			next.throne = now + c.throne.minutes * 60000;
			next.ebay = now + c.ebay.minutes * 60000;
			broadcast();
		}
		if (!isExtensionOn) {
			wasOn = false;
			return;
		}
		if (!wasOn) {
			wasOn = true;
			next.wishlist = now + c.wishlist.minutes * 60000;
			next.ninja = now + c.ninja.minutes * 60000;
			next.throne = now + c.throne.minutes * 60000;
			next.ebay = now + c.ebay.minutes * 60000;
		}
		if ((c.wishlist.enabled || c.ninja.enabled || c.throne.enabled || c.ebay.enabled) && now - lastBroadcast > 10000) broadcast();
		['wishlist', 'ninja', 'throne', 'ebay'].forEach(function (mode) {
			if (c[mode].enabled && c[mode].interval && now >= next[mode]) {
				next[mode] = now + c[mode].minutes * 60000;
				announce(mode);
			}
		});
	}, 1000);
})();
