(function (root) {
	'use strict';
	// Private reader credentials stay in extension storage, never in overlay snapshots.
	root.SSNEbayService = function (hooks) {
		var status = 'Connect your eBay seller account',
			busy = false,
			nextPoll = 0,
			connected = false;
		function state() {
			var p = hooks.privateState();
			if (!p.ebay) p.ebay = { key: '', items: [], seen: [], cursor: 0 };
			return p.ebay;
		}
		async function api(path, method) {
			var p = state();
			if (!p.key) {
				p.key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
					.map(function (b) {
						return b.toString(16).padStart(2, '0');
					})
					.join('');
				await hooks.store();
			}
			var controller = new AbortController(),
				timer = setTimeout(function () {
					controller.abort();
				}, 15000);
			try {
				var route = p.environment === 'sandbox' ? 'ebay-sandbox' : 'ebay';
				var response = await fetch('https://api.socialstream.ninja/v1/' + route + '/' + path, { method: method || 'GET', headers: { Authorization: 'Bearer ' + p.key }, credentials: 'omit', redirect: 'error', signal: controller.signal });
				if (response.status === 503) {
					var problem = await response.json().catch(function () { return {}; });
					if (problem.code === 'EBAY_NOT_CONFIGURED') throw new Error('eBay needs application credentials configured on the SSN API.');
				}
				if (!response.ok) throw new Error(response.status === 404 ? 'eBay connections are not available on this server yet.' : response.status === 401 ? 'Connect your eBay seller account first.' : 'Could not update eBay. Check your connection and API access.');
				return await response.json();
			} finally {
				clearTimeout(timer);
			}
		}
		function publicState() {
			return Object.assign({}, hooks.config(), {
				environment: state().environment || 'production',
				items: state().items.map(function (i) {
					return { id: i.id, name: i.name, amount: i.amount, currency: i.currency, image: i.image, url: i.url, auction: i.auction, startingBid: i.startingBid, endsAt: i.endsAt, available: i.available, bought: i.bought, updatedAt: i.updatedAt };
				})
			});
		}
		function useEnvironment(value) {
			var environment = value || 'production', p = state();
			if (environment !== 'sandbox' && environment !== 'production') throw new Error('Invalid eBay environment.');
			if ((p.environment || 'production') !== environment) {
				throw new Error('The eBay service does not match the selected environment.');
			}
			p.environment = environment;
		}
		async function verify() {
			var reply = await api('status');
			connected = false;
			useEnvironment(reply.environment);
			await hooks.store();
			connected = reply.protocol === 'ssn-ebay-1' && reply.connected === true;
			status = connected ? (state().environment === 'sandbox' ? 'Connected to eBay Sandbox (test purchases only)' : 'Connected to eBay') : 'Finish connecting your seller account';
			return connected;
		}
		async function action(request) {
			var p = state();
			if (request.action === 'ebayEnvironment') {
				if (!['sandbox', 'production'].includes(request.environment)) throw new Error('Invalid eBay environment.');
				if (busy) throw new Error('Wait for the current eBay update before switching environments.');
				if ((p.environment || 'production') === request.environment) return {};
				var privateData = hooks.privateState();
				var before = JSON.stringify(privateData);
				if (!privateData.ebayProfiles) privateData.ebayProfiles = {};
				privateData.ebayProfiles[p.environment || 'production'] = p;
				privateData.ebay = privateData.ebayProfiles[request.environment] || { key: '', items: [], seen: [], cursor: 0, environment: request.environment };
				try { await hooks.store(); } catch (e) {
					var previous = JSON.parse(before);
					privateData.ebay = previous.ebay;
					privateData.ebayProfiles = previous.ebayProfiles;
					throw e;
				}
				connected = false;
				nextPoll = 0;
				status = 'Environment changed. Connect or check your seller account before enabling the showcase.';
				return {};
			}
			if (request.action === 'ebayConnect') {
				var reply = await api('connect', 'POST'),
					url = new URL(reply.url);
				var environment = reply.environment || 'production';
				if (url.origin !== (environment === 'sandbox' ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com') || url.pathname !== '/oauth2/authorize' || url.username || url.password) throw new Error('Invalid eBay connection link.');
				useEnvironment(environment);
				await hooks.store();
				return { url: url.href };
			}
			if (request.action === 'ebayStatus') {
				await verify();
				return {};
			}
			if (request.action === 'ebayDisconnect') {
				await api('connection', 'DELETE');
				connected = false;
				p.key = '';
				status = 'Disconnected';
			} else if (request.action === 'ebayAdd') {
				var id = SSNMonetization.ebayId(request.url);
				if (!id) throw new Error('Paste a full eBay item URL.');
				await verify();
				var sandboxURL = /^(?:www\.)?sandbox\.ebay\.com$/.test(new URL(request.url).hostname);
				if (sandboxURL !== (p.environment === 'sandbox')) throw new Error('Use an eBay listing URL matching the connected sandbox or production environment.');
				if (p.items.length >= 20) throw new Error('The showcase supports up to 20 products.');
				if (
					p.items.some(function (i) {
						return i.id === id;
					})
				)
					throw new Error('This product is already on your list.');
				var item = await api('item/' + id);
				if (item.id !== id || !item.name || !Number.isFinite(item.amount) || !/^[A-Z]{3}$/.test(item.currency)) throw new Error('eBay returned an incomplete product.');
				if (p.items.length && p.items[0].currency !== item.currency) throw new Error('Use the same currency for all showcase products.');
				item.addedAt = Date.now();
				item.bought = false;
				p.items.push(item);
				if (!p.cursor) p.cursor = item.addedAt;
			} else if (request.action === 'ebayRemove') {
				p.items = p.items.filter(function (i) {
					return i.id !== request.id;
				});
			} else if (request.action === 'ebayMove') {
				var at = p.items.findIndex(function (i) {
					return i.id === request.id;
				});
				if (at > 0) p.items.splice(at - 1, 0, p.items.splice(at, 1)[0]);
			}
			await hooks.store();
			hooks.broadcast();
			return {};
		}
		async function poll() {
			if (busy || Date.now() < nextPoll || !hooks.enabled() || !hooks.config().enabled || !state().key || !state().items.length) return;
			busy = true;
			nextPoll = Date.now() + 60000;
			try {
				await hooks.serialize(async function () {
					await verify();
					if (!connected) throw new Error('Connect your eBay seller account first.');
					var p = state(),
						since = Math.max(p.cursor - 120000, Date.now() - 29 * 86400000),
						result = await api('sales?since=' + Math.floor(since));
					if (!Array.isArray(result.sales) || !Number.isFinite(result.through)) throw new Error('Incomplete eBay sales response.');
					if (!hooks.enabled() || !hooks.config().enabled) return;
					var alerts = [],
						before = JSON.stringify(p);
					result.sales.forEach(function (sale) {
						var item = p.items.find(function (i) {
							return i.id === sale.itemId;
						});
						if (!item || !/^[a-f0-9]{64}$/.test(sale.id) || p.seen.indexOf(sale.id) !== -1 || (sale.paidAt || sale.createdAt) < item.addedAt) return;
						p.seen.push(sale.id);
						item.bought = true;
						alerts.push({ platform: 'ebay', type: 'ebay', event: 'purchase', id: 'ebay-' + sale.id, chatname: p.environment === 'sandbox' ? 'eBay Sandbox buyer' : 'eBay buyer', chatmessage: (p.environment === 'sandbox' ? 'Sandbox test purchase: ' : 'Purchased ') + item.name, textonly: true, subtitle: item.name, contentimg: SSNMonetization.imageURL(item.image), meta: { commerce: { quantity: Math.max(1, Math.min(100000, Number(sale.quantity) || 1)) }, ebayPurchase: { itemId: item.id, itemName: item.name, quantity: Math.max(1, Math.min(100000, Number(sale.quantity) || 1)), url: item.url } } });
					});
					p.cursor = result.through;
					p.seen = p.seen.slice(-10000);
					try {
						await hooks.store();
					} catch (e) {
						hooks.privateState().ebay = JSON.parse(before);
						throw e;
					}
					hooks.broadcast();
					for (var a = 0; a < alerts.length; a++) {
						await hooks.deliver(alerts[a]);
						if (hooks.config().announce) hooks.chat(alerts[a].chatmessage + '!');
					}
					// Refresh listings independently: a removed listing must not suppress paid-sale alerts.
					var stale = 0;
					await Promise.all(
						p.items.map(async function (item) {
							if (item.bought || !hooks.enabled() || !hooks.config().enabled) return;
							try {
								var updated = await api('item/' + item.id);
								if (updated.id !== item.id || updated.currency !== item.currency) throw new Error('Listing changed');
								Object.assign(item, updated);
							} catch (_) {
								stale++;
							}
						})
					);
					await hooks.store();
					hooks.broadcast();
					connected = true;
					status = (p.environment === 'sandbox' ? 'Sandbox test mode. ' : '') + (stale ? 'Sales checked; some listing prices could not refresh' : 'Connected; checks about once a minute');
				});
			} catch (e) {
				status = e.message;
			} finally {
				busy = false;
			}
		}
		return {
			action: action,
			verify: verify,
			poll: poll,
			publicState: publicState,
			snapshot: function () {
				return { status: status, connected: connected, environment: state().environment || 'production', items: publicState().items };
			}
		};
	};
})(typeof window !== 'undefined' ? window : this);
