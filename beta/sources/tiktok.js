// new code
(function() {
	console.log("Social stream injected");
	const avatarCache = {
		_cache: {},
		MAX_SIZE: 501,
		CLEANUP_COUNT: 50,
		add(chatname, chatimg, badges = null, membership = null, nameColor = null, memberLevel = null) {
			if (!chatname) return;
			if (!this._cache[chatname]) {
				this._cache[chatname] = {
					timestamp: Date.now()
				};
			} else {
				this._cache[chatname].timestamp = Date.now();
			}
			if (chatimg) this._cache[chatname].url = chatimg;
			if (badges) this._cache[chatname].badges = badges;
			if (membership) this._cache[chatname].membership = membership;
			if (nameColor) this._cache[chatname].nameColor = nameColor;
			if (memberLevel) this._cache[chatname].memberLevel = memberLevel;
			this.cleanup();
		},
		get(chatname) {
			return this._cache[chatname] || {};
		},
		cleanup() {
			const cacheSize = Object.keys(this._cache).length;
			if (cacheSize > this.MAX_SIZE) {
				const sorted = Object.entries(this._cache).sort(([, a], [, b]) => a.timestamp - b.timestamp);
				for (let i = 0; i < this.CLEANUP_COUNT; i++) {
					if (sorted[i]) {
						delete this._cache[sorted[i][0]];
					}
				}
			}
		}
	};
	const messageLog = {
		_entries: new Map(),
		_order: [],
		_mode: 'count',
		_maxMessages: 501,
		_timeWindow: null,
		_cleanupInterval: null,
		init(options = {}) {
			this._mode = options.mode || 'count';
			this._maxMessages = options.maxMessages || 501;
			this._timeWindow = Number.isFinite(options.timeWindow) ? options.timeWindow : null;
			this.destroy();
			this._cleanupInterval = setInterval(() => this.cleanup(), 5000);
		},
		cleanup() {
			const currentTime = Date.now();
			if (this._mode === 'time' || (this._timeWindow && this._mode !== 'count')) {
				while (this._order.length) {
					const key = this._order[0];
					const entry = this._entries.get(key);
					if (!entry) {
						this._order.shift();
						continue;
					}
					if (!this._timeWindow || (currentTime - entry.time) <= this._timeWindow) {
						break;
					}
					this._entries.delete(key);
					this._order.shift();
				}
			}
			if (this._maxMessages && this._entries.size > this._maxMessages) {
				const overflow = this._entries.size - this._maxMessages;
				for (let i = 0; i < overflow && this._order.length; i++) {
					const key = this._order.shift();
					this._entries.delete(key);
				}
			}
		},
		isDuplicate(name, message, contextKey = "") {
			if (!name && !message) return true;
			const currentTime = Date.now();
			const messageKey = contextKey ? `${contextKey}:${name}:${message}` : `${name}:${message}`;
			const existing = this._entries.get(messageKey);
			if (existing) {
				if (!this._timeWindow || (currentTime - existing.time) <= this._timeWindow) {
					return true;
				}
				// The message is older than the window; drop the stale entry before continuing.
				this._entries.delete(messageKey);
				const index = this._order.indexOf(messageKey);
				if (index !== -1) {
					this._order.splice(index, 1);
				}
			}
			this._entries.set(messageKey, { time: currentTime });
			this._order.push(messageKey);
			if (this._timeWindow && this._mode === 'time') {
				this.cleanup();
			} else if (this._entries.size > this._maxMessages) {
				const overflow = this._entries.size - this._maxMessages;
				for (let i = 0; i < overflow && this._order.length; i++) {
					const key = this._order.shift();
					this._entries.delete(key);
				}
			}
			return false;
		},
		destroy() {
			if (this._cleanupInterval) {
				clearInterval(this._cleanupInterval);
				this._cleanupInterval = null;
			}
			this._entries.clear();
			this._order = [];
		},
		configure(options = {}) {
			if (options.mode !== undefined) this._mode = options.mode;
			if (options.maxMessages !== undefined) this._maxMessages = options.maxMessages;
			if (options.timeWindow !== undefined) {
				this._timeWindow = Number.isFinite(options.timeWindow) ? options.timeWindow : null;
			}
			this.cleanup();
		}
	};
	messageLog.init({
		mode: 'count',
		maxMessages: 501
	});

	function pushMessage(data, target) {
		try {
			// Parse gifts before applying the text-only presentation setting.
			// Capture contract: textonly=true means a literal chatmessage string, not HTML.
			// Do not add formatting tags or HTML-encode it; viewer-typed <i> / &amp; stays literal.
			// HTML mode may include markup for the normal relay checks. The flag applies only to chatmessage.
			// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
			if (data.textonly && data.chatmessage) {
				const message = document.createElement("div");
				message.innerHTML = data.chatmessage;
				data.chatmessage = message.textContent || "";
			}
			var payload = {
				"message": data
			};
			if (target) {
				payload.target = target;
			}
			chrome.runtime.sendMessage(chrome.runtime.id, payload, function(e) {
				// Check for chrome runtime errors
				if (chrome.runtime.lastError) {
					console.error("[TikTok] Chrome runtime error:", chrome.runtime.lastError.message);
					// Could indicate extension was reloaded or connection lost
				}
			});
		} catch (e) {
			console.error("[TikTok] Failed to send message:", e);
		}
	}

	var trackedTikTokGiftStreaks = new Map();
	var TIKTOK_GIFT_STREAK_QUIET_MS = 4500;
	var TIKTOK_GIFT_DUPLICATE_WINDOW_MS = 500;
	var tikTokGiftStreakSequence = 0;
	var tikTokGiftStreakInstanceId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

	function getTikTokGiftUpdateIdentity(data, ele) {
		if (!data || data.type !== "tiktok" || !data.hasDonation || !data.chatmessage) {
			return null;
		}

		var container = document.createElement("div");
		container.innerHTML = data.chatmessage;
		var giftImage = container.querySelector("img[src]");
		var giftImageSrc = giftImage ? (giftImage.getAttribute("src") || "") : "";
		var giftIdMatch = giftImageSrc.match(/\/([a-f0-9]{32})(?:~|\.)/i);
		var giftId = giftIdMatch ? giftIdMatch[1].toLowerCase() : giftImageSrc;
		var visibleText = container.textContent || container.innerText || "";
		var countMatch = visibleText.match(/[x\u00d7]\s*(\d+)/i);
		var quantity = countMatch ? parseInt(countMatch[1], 10) : 0;
		if (!giftId || !Number.isFinite(quantity) || quantity < 1) {
			return null;
		}

		var indexValue = "";
		try {
			indexValue = ele && ele.dataset && ele.dataset.index
				? ele.dataset.index
				: (ele && ele.closest && ele.closest("[data-index]") && ele.closest("[data-index]").dataset.index) || "";
		} catch (e) {}

		var nameKey = normalizeTikTokNameKey(data.chatname || "unknown");
		var stableIndexKey = indexValue ? "idx=" + indexValue : "";
		var nativeMeta = data.meta || {};
		var nativeKey = nativeMeta.tiktokGiftMessageId ? "message:" + nativeMeta.tiktokGiftMessageId : "";
		if (nativeMeta.groupId && String(nativeMeta.groupId) !== "0" && nativeMeta.giftId && nativeMeta.tiktokGiftSenderId) {
			nativeKey = "group:" + JSON.stringify([nativeMeta.tiktokGiftSenderId, nativeMeta.giftId, nativeMeta.groupId]);
		}
		return {
			// TikTok recycles row slots, including the shared event-banner slot.
			key: nativeKey || nameKey + ":" + giftId + (stableIndexKey ? ":" + stableIndexKey : ""),
			quantity: quantity,
			hasStableIndex: !!(nativeKey || stableIndexKey),
			repeatEnd: nativeMeta.repeatEnd === true
		};
	}

	function applyTikTokGiftDonationValue(data, ele) {
		if (!data || data.event !== "gift" || !(settings.tiktokdonations || !settings.notiktokdonations)) return;
		var meta = data.meta || {};
		var container = document.createElement("div");
		container.innerHTML = data.chatmessage || "";
		var countMatch = (container.textContent || "").match(/[x\u00d7]\s*(\d+)/i);
		var quantity = Number(meta.tiktokGiftCount) || (countMatch ? Number(countMatch[1]) : 0);
		if (!(quantity > 0) || !Number.isFinite(quantity)) return;
		var diamonds = Number(meta.diamondsPerGift);
		var coins = Number(meta.coinsPerGift);
		if (Number.isFinite(diamonds) && diamonds > 0) {
			data.hasDonation = (quantity * diamonds) + " \uD83D\uDC8E";
			data.donoValue = quantity * diamonds * 0.005;
			return;
		}
		if (!(Number.isFinite(coins) && coins > 0)) {
			// A price already found in the rendered gift panel beats a name-only estimate.
			var coinLabel = String(data.hasDonation || "").match(/^([\d,.]+)\s+coins?$/i);
			if (coinLabel) {
				data.donoValue = Number(coinLabel[1].replace(/,/g, "")) * 0.01;
				return;
			}
			var giftImage = container.querySelector("img[src]");
			var imageKey = giftImage ? getIdFromUrl(giftImage.getAttribute("src") || "") : "";
			// Message HTML omits alt text; read the matching image from the original row.
			var sourceImage = giftImage && ele && ele.querySelectorAll
				? Array.from(ele.querySelectorAll("img[alt]")).find(img => img.src === giftImage.src) : null;
			var name = String(meta.giftName || (sourceImage && sourceImage.getAttribute("alt")) ||
				(giftImage && giftImage.getAttribute("alt")) || "")
				.normalize("NFKC").replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
			var mapped = giftMapping[meta.giftId] || giftMapping[imageKey] || giftMapping["name:" + name];
			if (mapped) coins = Number(mapped.coins);
		}
		if (Number.isFinite(coins) && coins > 0) {
			data.hasDonation = (quantity * coins) + " coins";
			data.donoValue = quantity * coins * 0.01;
			return;
		}
		// Preserve the display label; an unpriced gift is estimated at one coin.
		if (!data.hasDonation) data.hasDonation = quantity + (quantity === 1 ? " gift" : " gifts");
		data.donoValue = quantity * 0.01;
	}

	function markTikTokGiftUpdate(data, ele) {
		if (data && data.type === "tiktok" && data.event === "gift") {
			try {
				var nativeGift = window.__ssnReadTikTokGift ? window.__ssnReadTikTokGift(ele) : null;
				if (!nativeGift && ele && ele.dispatchEvent) {
					ele.removeAttribute("data-ssn-tiktok-gift");
					ele.dispatchEvent(new CustomEvent("ssn-read-tiktok-gift", { bubbles: true }));
					nativeGift = JSON.parse(ele.getAttribute("data-ssn-tiktok-gift") || "null");
					ele.removeAttribute("data-ssn-tiktok-gift");
				}
				if (nativeGift) data.meta = Object.assign({}, data.meta || {}, nativeGift);
			} catch (e) {}
		}
		applyTikTokGiftDonationValue(data, ele);
		var identity = getTikTokGiftUpdateIdentity(data, ele);
		if (!identity) {
			return true;
		}

		var now = Date.now();
		var tracked = trackedTikTokGiftStreaks.get(identity.key);
		if (tracked) {
			var isSameRender =
				identity.quantity === tracked.quantity &&
				(!identity.repeatEnd || tracked.repeatEnd) &&
				(identity.hasStableIndex || (now - tracked.updatedAt) <= TIKTOK_GIFT_DUPLICATE_WINDOW_MS);
			if (isSameRender) {
				return false;
			}
			if (identity.quantity <= tracked.quantity && !(identity.quantity === tracked.quantity && identity.repeatEnd && !tracked.repeatEnd)) {
				if (tracked.timer) {
					clearTimeout(tracked.timer);
				}
				tracked = null;
			}
		}

		if (!tracked) {
			tracked = {
				id: "tiktok-gift-" + tikTokGiftStreakInstanceId + "-" + (++tikTokGiftStreakSequence),
				quantity: identity.quantity,
				repeatEnd: identity.repeatEnd,
				updatedAt: now,
				timer: null
			};
			trackedTikTokGiftStreaks.set(identity.key, tracked);
		} else {
			tracked.quantity = identity.quantity;
			tracked.repeatEnd = identity.repeatEnd;
			tracked.updatedAt = now;
			if (tracked.timer) {
				clearTimeout(tracked.timer);
			}
		}

		tracked.timer = setTimeout(function() {
			if (trackedTikTokGiftStreaks.get(identity.key) === tracked) {
				trackedTikTokGiftStreaks.delete(identity.key);
			}
		}, TIKTOK_GIFT_STREAK_QUIET_MS);

		data.meta = Object.assign({}, data.meta || {}, {
			tiktokGiftStreakId: tracked.id,
			tiktokGiftCount: identity.quantity,
			tiktokGiftQuietMs: TIKTOK_GIFT_STREAK_QUIET_MS
		});
		return true;
	}

	function sendMetaEvent(eventName, meta) {
		if (!eventName || !meta) {
			return;
		}
		pushMessage({
			type: "tiktok",
			event: eventName,
			meta: meta
		});
	}

	const tikTokStandardStatusState = {
		initAt: Date.now(),
		lastKey: "",
		lastSentAt: 0,
		connectedSent: false,
		lastConnectedAt: 0,
		pendingError: "",
		pendingErrorAt: 0
	};

	function resetTikTokStandardPendingError() {
		tikTokStandardStatusState.pendingError = "";
		tikTokStandardStatusState.pendingErrorAt = 0;
	}

	function shouldDelayTikTokStandardFatal(normalizedError, now) {
		if (!normalizedError) {
			return false;
		}

		const lower = normalizedError.toLowerCase();
		const shouldDebounce = lower.includes("did not expose a usable live chat panel")
			|| lower.includes("live chat is unavailable");
		if (!shouldDebounce) {
			resetTikTokStandardPendingError();
			return false;
		}

		if (tikTokStandardStatusState.pendingError !== normalizedError) {
			tikTokStandardStatusState.pendingError = normalizedError;
			tikTokStandardStatusState.pendingErrorAt = now;
			return true;
		}

		if (!tikTokStandardStatusState.pendingErrorAt) {
			tikTokStandardStatusState.pendingErrorAt = now;
			return true;
		}

		if ((now - tikTokStandardStatusState.pendingErrorAt) < 8000) {
			return true;
		}

		if ((now - lastMessageTime) < 20000) {
			return true;
		}

		if (tikTokStandardStatusState.lastConnectedAt && (now - tikTokStandardStatusState.lastConnectedAt) < 12000) {
			return true;
		}

		return false;
	}

	function canSendTikTokStandardStatus() {
		return !!(
			typeof chrome !== "undefined" &&
			chrome.runtime &&
			typeof chrome.runtime.sendMessage === "function" &&
			(
				window.ninjafy ||
				window.electronApi ||
				typeof window.__SSAPP_TAB_ID__ !== "undefined"
			)
		);
	}

	function sendTikTokStandardStatus(payload) {
		if (!canSendTikTokStandardStatus() || !payload || typeof payload !== "object") {
			return false;
		}
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				tiktokStatus: {
					platform: "tiktok",
					...payload
				}
			}, function() {
				if (chrome.runtime.lastError) {
					console.warn("[TikTok] Failed to send standard status:", chrome.runtime.lastError.message);
				}
			});
			return true;
		} catch (e) {
			console.warn("[TikTok] Failed to emit standard status:", e);
			return false;
		}
	}

	function markTikTokStandardConnected(connectionLabel = "Connected via standard capture") {
		if (!canSendTikTokStandardStatus()) {
			return;
		}
		resetTikTokStandardPendingError();
		tikTokStandardStatusState.lastConnectedAt = Date.now();
		if (tikTokStandardStatusState.connectedSent) {
			return;
		}
		tikTokStandardStatusState.connectedSent = true;
		tikTokStandardStatusState.lastKey = "connected";
		tikTokStandardStatusState.lastSentAt = Date.now();
		sendTikTokStandardStatus({
			status: "connected",
			connectionMethod: "Standard capture",
			connectionLabel
		});
	}

	function reportTikTokStandardFatal(error, code = "standard_blocked") {
		if (!canSendTikTokStandardStatus() || !error) {
			return;
		}
		const normalizedError = String(error).trim();
		if (!normalizedError) {
			return;
		}
		const now = Date.now();
		if (shouldDelayTikTokStandardFatal(normalizedError, now)) {
			return;
		}
		const statusKey = `${code}:${normalizedError}`;
		if (tikTokStandardStatusState.lastKey === statusKey && (now - tikTokStandardStatusState.lastSentAt) < 15000) {
			return;
		}
		resetTikTokStandardPendingError();
		tikTokStandardStatusState.lastKey = statusKey;
		tikTokStandardStatusState.lastSentAt = now;
		tikTokStandardStatusState.connectedSent = false;
		sendTikTokStandardStatus({
			status: "fatal_error",
			code,
			error: normalizedError
		});
	}

	function getTikTokStateObject() {
		try {
			const sigiStateElement = document.getElementById("SIGI_STATE");
			if (!sigiStateElement || !sigiStateElement.textContent) {
				return null;
			}
			return JSON.parse(sigiStateElement.textContent);
		} catch (e) {
			return null;
		}
	}

	function getTranslation(key, value = false) {
		if (settings.translation && settings.translation.innerHTML && (key in settings.translation.innerHTML)) {
			return settings.translation.innerHTML[key];
		} else if (settings.translation && settings.translation.miscellaneous && settings.translation.miscellaneous && (key in settings.translation.miscellaneous)) {
			return settings.translation.miscellaneous[key];
		} else if (value !== false) {
			return value;
		} else {
			return key.replaceAll("-", " ");
		}
	}

	function toDataURL(url, callback) {
		var xhr = new XMLHttpRequest();
		xhr.onload = function() {
			var blob = xhr.response;
			if (blob.size > (55 * 1024)) {
				callback(url);
				return;
			}
			var reader = new FileReader();
			reader.onloadend = function() {
				callback(reader.result);
			}
			reader.readAsDataURL(xhr.response);
		};
		xhr.open('GET', url);
		xhr.responseType = 'blob';
		xhr.send();
	}

	function escapeHtml(unsafe, force = false) {
		try {
			// Plain capture returns literal characters for text rendering; HTML mode escapes text for markup construction. Do not HTML-sanitize the plain string.
			if (settings.textonlymode && !force) {
				return unsafe;
			}
			return unsafe
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;") || "";
		} catch (e) {
			return "";
		}
	}

	function getAllContentNodes(element, old=false) {
		var resp = "";
		if (!element) {
			return resp;
		}
		if (old && element.dataset && element.dataset.skip){return "";}
		
		if (!element.children || !element.children.length) {
			if (element.textContent) {
				return escapeHtml(element.textContent, true) || "";
			} else {
				return "";
			}
		}
		let isBadge = false;
		element.childNodes.forEach(node => {
			
			if (node.childNodes.length) {
				resp += getAllContentNodes(node, true).trim() + " ";
			} else if ((node.nodeType === 3) && node.textContent) {
				if (node && node.dataset && node.dataset.skip){return;}
				resp += escapeHtml(node.textContent, true);
			} else if (node.nodeType === 1) {
				if ((node.nodeName == "IMG") && node.src) {
					if ((node.dataset && node.dataset.skip) || node.src.includes("_badge_")) {
						isBadge = true;
						return;
					}
					node.src = node.src + "";
					resp += "<img src='" + node.src + "' />";
				} else if (node.nodeName == "SVG") {
					resp += node.outerHTML;
				}
			}
		});
		if (isBadge) {
			return "";
		}
		return resp;
	}

	function normalizeTikTokText(value) {
		if (typeof value !== "string") {
			return "";
		}
		return value.replace(/\s+/g, " ").trim();
	}

	function normalizeTikTokNameKey(value) {
		return normalizeTikTokText(value).toLowerCase();
	}

	function rankToColor(rank, maxRank = 40) {
		const startColor = {
			r: 197,
			g: 204,
			b: 218
		};
		const midColor = {
			r: 100,
			g: 115,
			b: 225
		};
		const endColor = {
			r: 81,
			g: 85,
			b: 255
		};
		const midRank = parseInt(maxRank / 2);
		let colorStop;
		if (rank <= midRank) {
			const ratio = (rank - 1) / (midRank - 1);
			colorStop = {
				r: startColor.r + ratio * (midColor.r - startColor.r),
				g: startColor.g + ratio * (midColor.g - startColor.g),
				b: startColor.b + ratio * (midColor.b - startColor.b),
			};
		} else {
			const ratio = (rank - midRank) / (maxRank - midRank);
			colorStop = {
				r: midColor.r + ratio * (endColor.r - midColor.r),
				g: midColor.g + ratio * (endColor.g - midColor.g),
				b: midColor.b + ratio * (endColor.b - midColor.b),
			};
		}
		const hexColor = `#${Math.round(colorStop.r).toString(16).padStart(2, '0')}` +
			`${Math.round(colorStop.g).toString(16).padStart(2, '0')}` +
			`${Math.round(colorStop.b).toString(16).padStart(2, '0')}`;
		return hexColor;
	}
	var lut = [];
	for (var i = 1; i <= 40; i++) {
		lut.push(rankToColor(i, 40));
	}
	var savedavatars = {};
	var channelName = false;
	var msgCount = 0;

	function parseDonationMessage(message) {
		if (!validateTikTokDonationMessage(message)) return null;
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = message.trim();
		const nodes = Array.from(tempDiv.childNodes);
		const word = nodes[0].textContent.trim();
		const imageSrc = nodes[1].getAttribute('src');
		// Extract numeric quantity robustly (supports 'x5', '×5', '× 5')
		const trailingText = nodes[2].textContent.trim();
		const quantity = parseInt(trailingText.replace(/[^0-9]/g, ''), 10);
		return {
			word,
			imageSrc,
			quantity,
			isValid: Number.isFinite(quantity)
		};
	}

	function validateTikTokDonationMessage(message) {
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = message.trim();
		const nodes = Array.from(tempDiv.childNodes);
		if (nodes.length !== 3) return false;
		if (nodes[0].nodeType !== Node.TEXT_NODE) return false;
		const imgElement = nodes[1];
		if (!(imgElement instanceof HTMLImageElement)) return false;
		const imgSrc = imgElement.getAttribute('src');
		if (!imgSrc || !imgSrc.includes('tiktokcdn.com')) return false;
		const lastText = nodes[2].textContent.trim();
		const indicatorPattern = /^[x×]\s*\d+$/i; // support 'x5' or '× 5'
		if (!indicatorPattern.test(lastText)) return false;
		return true;
	}
	// Generated with scripts/update-tiktok-gifts.cjs; provenance and refresh instructions:
	// docs/agents/08-platform-sources/tiktok.md#gift-price-catalog
	let giftMapping = {
	  "5269": {"name":"TikTok","coins":1},
	  "5487": {"name":"Finger Heart","coins":5},
	  "5509": {"name":"Sunglasses","coins":199},
	  "5585": {"name":"Confetti","coins":100},
	  "5586": {"name":"Hearts","coins":199},
	  "5587": {"name":"Gold Mine","coins":1000},
	  "5655": {"name":"Rose","coins":1},
	  "5658": {"name":"Perfume","coins":20},
	  "5659": {"name":"Paper Crane","coins":99},
	  "5660": {"name":"Hand Hearts","coins":100},
	  "5661": {"name":"Air Dancer","coins":300},
	  "5731": {"name":"Coral","coins":499},
	  "5765": {"name":"Motorcycle","coins":2988},
	  "5767": {"name":"Private Jet","coins":4888},
	  "5827": {"name":"Ice Cream Cone","coins":1},
	  "5879": {"name":"Doughnut","coins":30},
	  "5897": {"name":"Swan","coins":699},
	  "5915": {"name":"Music Note","coins":169},
	  "5978": {"name":"Train","coins":899},
	  "6007": {"name":"Boxing Gloves","coins":299},
	  "6031": {"name":"Gaming Chair","coins":1200},
	  "6036": {"name":"Record Player","coins":600},
	  "6064": {"name":"GG","coins":1},
	  "6071": {"name":"Birthday Cake","coins":300},
	  "6089": {"name":"Sports Car","coins":7000},
	  "6090": {"name":"Fireworks","coins":1088},
	  "6093": {"name":"Football","coins":1},
	  "6097": {"name":"Little Crown","coins":99},
	  "6104": {"name":"Cap","coins":99},
	  "6149": {"name":"Interstellar","coins":10000},
	  "6203": {"name":"Sunset Speedway","coins":10000},
	  "6223": {"name":"Lion","coins":29999},
	  "6224": {"name":"Love Letter","coins":1},
	  "eba3a9bb85c33e017f3648eaf88d7189": {"name":"Rose","coins":1},
	  "cb1c3e6263d4b6c08301f8798dcb5a9b": {"name":"Tsar","coins":100},
	  "3f02fa9594bd1495ff4e8aa5ae265eef": {"name":"GG","coins":1},
	  "20ec0eb50d82c2c445cb8391fd9fe6e2": {"name":"Game Controller","coins":100},
	  "b199d028d5beb081fe16edcf77db0830": {"name":"Flame heart","coins":1},
	  "a4c4dc437fd3a6632aba149769491f49": {"name":"Finger heart","coins":5},
	  "7ee91414ca66477969b8d30831d8e5c1": {"name":"LIVE STAR","coins":10},
	  "d9119ea9e40e68f770e8273ca0372c7e": {"name":"New LIVE Star","coins":5},
	  "621c62c208eeaeba85761c0c5efdd32b": {"name":"Elite LIVE Star","coins":30},
	  "eb77ead5c3abb6da6034d3cf6cfeb438": {"name":"Rosa","coins":10},
	  "fc549cf1bc61f9c8a1c97ebab68dced7": {"name":"Love you so much","coins":1},
	  "4e7ad6bdf0a1d860c538f38026d4e812": {"name":"Doughnut","coins":30},
	  "91058c626f0809291e7941969e4f0d05": {"name":"Gamer 2025","coins":299},
	  "cbd7588c53ec3df1af0ed6d041566362": {"name":"Super GG","coins":100},
	  "6cd022271dc4669d182cad856384870f": {"name":"Hand hearts","coins":100},
	  "20b8f61246c7b6032777bb81bf4ee055": {"name":"Perfume","coins":20},
	  "e9cafce8279220ed26016a71076d6a8a": {"name":"You're awesome","coins":1},
	  "d78ed6496fd57286b42ac033acbee299": {"name":"Mishka bear","coins":100},
	  "d2a59d961490de4c72fed3690e44d1ec": {"name":"Music on Stage","coins":1},
	  "693ed273f16deff9e947a29a423c5816": {"name":"Sushi Set","coins":20},
	  "e033c3f28632e233bebac1668ff66a2f": {"name":"Friendship Necklace","coins":10},
	  "802a21ae29f9fae5abe3693de9f874bd": {"name":"TikTok","coins":1},
	  "148eef0884fdb12058d1c6897d1e02b9": {"name":"Corgi","coins":299},
	  "e0589e95a2b41970f0f30f6202f5fce6": {"name":"Money Gun","coins":500},
	  "485175fda92f4d2f862e915cbcf8f5c4": {"name":"Star","coins":99},
	  "ab0a7b44bfc140923bb74164f6f880ab": {"name":"Love you","coins":1},
	  "0f158a08f7886189cdabf496e8a07c21": {"name":"Paper Crane","coins":99},
	  "d72381e125ad0c1ed70f6ef2aff6c8bc": {"name":"Little Ghost","coins":10},
	  "e45927083072ffe0015253d11e11a3b3": {"name":"Pho","coins":10},
	  "c2413f87d3d27ac0a616ac99ccaa9278": {"name":"Spooky Cat","coins":1200},
	  "1bdf0b38142a94af0f71ea53da82a3b1": {"name":"Bouquet","coins":100},
	  "3ac5ec732f6f4ba7b1492248bfea83d6": {"name":"Birthday Cake","coins":1},
	  "c836c81cc6e899fe392a3d11f69fafa3": {"name":"Boo's Town","coins":15000},
	  "d53125bd5416e6f2f6ab61da02ddd302": {"name":"Lucky Pig","coins":10},
	  "c2cd98b5d3147b983fcbf35d6dd38e36": {"name":"Balloon Gift Box","coins":100},
	  "79a02148079526539f7599150da9fd28": {"name":"Galaxy","coins":1000},
	  "863e7947bc793f694acbe970d70440a1": {"name":"Forever Rosa","coins":399},
	  "968820bc85e274713c795a6aef3f7c67": {"name":"Ice Cream Cone","coins":1},
	  "d244d4810758c3227e46074676e33ec8": {"name":"Trick or Treat","coins":299},
	  "c9734b74f0e4e79bdfa2ef07c393d8ee": {"name":"Pumpkin","coins":1},
	  "ff861a220649506452e3dc35c58266ea": {"name":"Peach","coins":5},
	  "30063f6bc45aecc575c49ff3dbc33831": {"name":"Star Throne","coins":7999},
	  "cb909c78f2412e4927ea68d6af8e048f": {"name":"Boo the Ghost","coins":88},
	  "0573114db41d2cf9c7dd70c8b0fab38e": {"name":"Okay","coins":5},
	  "312f721603de550519983ca22f5cc445": {"name":"Shamrock","coins":10},
	  "a40b91f7a11d4cbce780989e2d20a1f4": {"name":"Ice cream","coins":5},
	  "2db38e8f2a9fb804cb7d3bd2a0ba635c": {"name":"Love Balloon","coins":500},
	  "0183cfcfc0dac56580cdc43956b73bfe": {"name":"Gimme The Vote","coins":1},
	  "3c5e5fc699ed9bee71e79cc90bc5ab37": {"name":"Drip Brewing","coins":10},
	  "43e1dee87ec71c57ab578cb861bbd749": {"name":"Music Play","coins":1},
	  "b48c69f4df49c28391bcc069bbc31b41": {"name":"You're Amazing","coins":500},
	  "cb4e11b3834e149f08e1cdcc93870b26": {"name":"Confetti","coins":100},
	  "909e256029f1649a9e7e339ef71c6896": {"name":"Potato","coins":5},
	  "d4faa402c32bf4f92bee654b2663d9f1": {"name":"Coral","coins":499},
	  "97a26919dbf6afe262c97e22a83f4bf1": {"name":"Swan","coins":699},
	  "a03bf81f5759ed3ffb048e1ca71b2b5e": {"name":"Good Night","coins":10},
	  "01d07ef5d45eeedce64482be2ee10a74": {"name":"Dumplings","coins":10},
	  "90a405cf917cce27a8261739ecd84b89": {"name":"Phoenix Flower","coins":5},
	  "2c9cec686b98281f7319b1a02ba2864a": {"name":"Lock and Key","coins":199},
	  "d990849e0435271bc1e66397ab1dec35": {"name":"Singing Mic","coins":399},
	  "0115cb20f6629dc50d39f6b747bddf73": {"name":"Wedding","coins":1500},
	  "96d9226ef1c33784a24d0779ad3029d3": {"name":"Glowing Jellyfish","coins":1000},
	  "af980f4ec9ed73f3229df8dfb583abe6": {"name":"Future Encounter","coins":1500},
	  "4227ed71f2c494b554f9cbe2147d4899": {"name":"Train","coins":899},
	  "1d1650cd9bb0e39d72a6e759525ffe59": {"name":"Watermelon Love","coins":1000},
	  "ed2cc456ab1a8619c5093eb8cfd3d303": {"name":"Sage the Smart Bean","coins":399},
	  "9494c8a0bc5c03521ef65368e59cc2b8": {"name":"Fireworks","coins":1088},
	  "3cbaea405cc61e8eaab6f5a14d127511": {"name":"Rosie the Rose Bean","coins":399},
	  "767d7ea90f58f3676bbc5b1ae3c9851d": {"name":"Rocky the Rock Bean","coins":399},
	  "9f8bd92363c400c284179f6719b6ba9c": {"name":"Boxing Gloves","coins":299},
	  "f76750ab58ee30fc022c9e4e11d25c9d": {"name":"Blooming Ribbons","coins":1000},
	  "0e3769575f5b7b27b67c6330376961a4": {"name":"Jollie the Joy Bean","coins":399},
	  "1153dd51308c556cb4fcc48c7d62209f": {"name":"Fruit Friends","coins":299},
	  "fa6bd8486df33dbe732381fa5c6cf441": {"name":"Lovely Music","coins":999},
	  "af67b28480c552fd8e8c0ae088d07a1d": {"name":"Under Control","coins":1500},
	  "71883933511237f7eaa1bf8cd12ed575": {"name":"Meteor Shower","coins":3000},
	  "6517b8f2f76dc75ff0f4f73107f8780e": {"name":"Motorcycle","coins":2988},
	  "3f1945b0d96e665a759f747e5e0cf7a9": {"name":"Cooper Flies Home","coins":1999},
	  "1ea8dbb805466c4ced19f29e9590040f": {"name":"Chasing the Dream","coins":1500},
	  "1420cc77d628c49516b9330095101496": {"name":"Love Explosion","coins":1500},
	  "5d456e52403cefb87d6d78c9cabb03db": {"name":"The Running 9","coins":1399},
	  "6b103f9ea6c313b8df68be92e54202cc": {"name":"Shaking Drum","coins":2500},
	  "e7ce188da898772f18aaffe49a7bd7db": {"name":"Sports Car","coins":7000},
	  "1d067d13988e8754ed6adbebd89b9ee8": {"name":"Flying Jets","coins":5000},
	  "f334260276d5fa0de91c5fb61e26d07d": {"name":"Lantern Road","coins":5000},
	  "921c6084acaa2339792052058cbd3fd3": {"name":"Private Jet","coins":4888},
	  "universe": {"name":"Universe","coins":34999},
	  "lion": {"name":"Lion","coins":29999},
	  "drama-king": {"name":"Drama King","coins":49999},
	  "donut-tower": {"name":"Donut Tower","coins":4999},
	  "diamond-crown": {"name":"Diamond Crown","coins":1499},
	  "tiktok-crown": {"name":"TikTok Crown","coins":299},
	  "fans_starter_upgraded_gift": {"name":"upgraded gift"},
	  "name:10/10": {"name":"10/10","coins":1},
	  "name:2025": {"name":"2025","coins":1},
	  "name:2025 love": {"name":"2025 Love","coins":1},
	  "name:a shard of hope": {"name":"A Shard of Hope","coins":1},
	  "name:alien pet": {"name":"Alien Pet","coins":1},
	  "name:baseball": {"name":"Baseball","coins":1},
	  "name:basketball": {"name":"Basketball","coins":1},
	  "name:bibingka": {"name":"Bibingka","coins":1},
	  "name:birthday cake": {"name":"Birthday Cake","coins":1},
	  "name:blow a kiss": {"name":"Blow a kiss","coins":1},
	  "name:blue heart": {"name":"Blue Heart","coins":1},
	  "name:blue lightning": {"name":"Blue Lightning","coins":1},
	  "name:brat": {"name":"Brat","coins":1},
	  "name:cake slice": {"name":"Cake Slice","coins":1},
	  "name:candy": {"name":"Candy","coins":1},
	  "name:cat paws": {"name":"Cat Paws","coins":1},
	  "name:charge me up": {"name":"Charge me up","coins":1},
	  "name:chequered flag": {"name":"Chequered Flag","coins":1},
	  "name:cherry": {"name":"Cherry","coins":1},
	  "name:chili": {"name":"Chili","coins":1},
	  "name:chilli pepper": {"name":"Chilli Pepper","coins":1},
	  "name:clap clap": {"name":"Clap Clap","coins":1},
	  "name:clapperboard": {"name":"Clapperboard","coins":1},
	  "name:club cheers": {"name":"Club Cheers","coins":1},
	  "name:coffee": {"name":"Coffee","coins":1},
	  "name:coldy": {"name":"coldy","coins":1},
	  "name:community gift": {"name":"Community Gift","coins":1},
	  "name:community heart": {"name":"Community Heart","coins":1},
	  "name:congratulations": {"name":"Congratulations","coins":1},
	  "name:cool": {"name":"Cool","coins":1},
	  "name:cool love": {"name":"Cool love","coins":1},
	  "name:coolman": {"name":"CoolmaN","coins":1},
	  "name:creator's cap": {"name":"Creator's Cap","coins":1},
	  "name:creeper": {"name":"Creeper","coins":1},
	  "name:cycling is life": {"name":"Cycling is life","coins":1},
	  "name:daanni": {"name":"DAANNI","coins":1},
	  "name:dates": {"name":"Dates","coins":1},
	  "name:dinosaur footprint": {"name":"Dinosaur footprint","coins":1},
	  "name:dolce vita": {"name":"Dolce Vita","coins":1},
	  "name:enjoy music": {"name":"Enjoy Music","coins":1},
	  "name:f1 austin s": {"name":"F1 Austin S","coins":1},
	  "name:f1 barcelona s": {"name":"F1 Barcelona S","coins":1},
	  "name:fairy wings": {"name":"Fairy wings","coins":1},
	  "name:familie": {"name":"Familie","coins":1},
	  "name:fan": {"name":"Fan","coins":1},
	  "name:feral realm": {"name":"Feral Realm","coins":1},
	  "name:fest pop": {"name":"Fest Pop","coins":1},
	  "name:fire": {"name":"Fire","coins":1},
	  "name:flame heart": {"name":"Flame heart","coins":1},
	  "name:flamenco": {"name":"Flamenco","coins":1},
	  "name:fluffy heart": {"name":"Fluffy Heart","coins":1},
	  "name:football": {"name":"Football","coins":1},
	  "name:football love": {"name":"Football Love","coins":1},
	  "name:freestyle": {"name":"Freestyle","coins":1},
	  "name:fried": {"name":"Fried","coins":1},
	  "name:gachetos znak": {"name":"Gachetos Znak","coins":1},
	  "name:gameboa thumbs": {"name":"Gameboa Thumbs","coins":1},
	  "name:gaspol!": {"name":"GASPOL!","coins":1},
	  "name:gg": {"name":"GG","coins":1},
	  "name:gg 2025": {"name":"GG 2025","coins":1},
	  "name:gingerbread heart": {"name":"Gingerbread Heart","coins":1},
	  "name:give it all": {"name":"Give It All","coins":1},
	  "name:glass of airan": {"name":"Glass of Airan","coins":1},
	  "name:glow stick": {"name":"Glow Stick","coins":1},
	  "name:go alami": {"name":"Go Alami","coins":1},
	  "name:go ameed": {"name":"Go Ameed","coins":1},
	  "name:go for it!": {"name":"Go for it!","coins":1},
	  "name:go fursan": {"name":"Go Fursan","coins":1},
	  "name:go lyooth": {"name":"Go lyooth","coins":1},
	  "name:go malaki": {"name":"Go Malaki","coins":1},
	  "name:go popular": {"name":"Go Popular","coins":1},
	  "name:go za'eem": {"name":"Go Za'eem","coins":1},
	  "name:goat": {"name":"GOAT","coins":1},
	  "name:gooaal": {"name":"Gooaal","coins":1},
	  "name:good job": {"name":"Good Job","coins":1},
	  "name:graduation bouquet": {"name":"Graduation Bouquet","coins":1},
	  "name:green paw": {"name":"Green Paw","coins":1},
	  "name:guardian wings": {"name":"Guardian Wings","coins":1},
	  "name:harvest festival": {"name":"Harvest Festival","coins":1},
	  "name:headphone": {"name":"Headphone","coins":1},
	  "name:heart": {"name":"Heart","coins":1},
	  "name:heart me": {"name":"Heart Me","coins":1},
	  "name:heart puff": {"name":"Heart Puff","coins":1},
	  "name:hearty talk": {"name":"Hearty Talk","coins":1},
	  "name:hello": {"name":"Hello","coins":1},
	  "name:hoşgeldin ramazan": {"name":"Hoşgeldin Ramazan","coins":1},
	  "name:house firelight": {"name":"House Firelight","coins":1},
	  "name:house nightshade": {"name":"House Nightshade","coins":1},
	  "name:house whitewind": {"name":"House Whitewind","coins":1},
	  "name:i love pe": {"name":"I LOVE PE","coins":1},
	  "name:i'm ready!": {"name":"I'm Ready!","coins":1},
	  "name:ice cream cone": {"name":"Ice Cream Cone","coins":1},
	  "name:ice cube": {"name":"Ice Cube","coins":1},
	  "name:ironoperon operania": {"name":"IronOperon Operania","coins":1},
	  "name:it's corn": {"name":"It’s corn","coins":1},
	  "name:it's match time": {"name":"It's Match Time","coins":1},
	  "name:july love": {"name":"July Love","coins":1},
	  "name:ka pai": {"name":"Ka Pai","coins":1},
	  "name:kak nad pnad": {"name":"Kak Nad PNAD","coins":1},
	  "name:ksa": {"name":"KSA","coins":1},
	  "name:light": {"name":"Light","coins":1},
	  "name:lightning bolt": {"name":"Lightning Bolt","coins":1},
	  "name:live": {"name":"LIVE","coins":1},
	  "name:love egypt": {"name":"Love Egypt","coins":1},
	  "name:love ksa": {"name":"Love KSA","coins":1},
	  "name:love letter": {"name":"Love Letter","coins":1},
	  "name:love morocco": {"name":"Love Morocco","coins":1},
	  "name:love oman": {"name":"Love Oman","coins":1},
	  "name:love you": {"name":"Love you","coins":1},
	  "name:love you so much": {"name":"Love you so much","coins":1},
	  "name:luve cheer": {"name":"LUVE Cheer","coins":1},
	  "name:luvx cheer": {"name":"LUVX Cheer","coins":1},
	  "name:mamma mia": {"name":"Mamma Mia","coins":1},
	  "name:maracas": {"name":"Maracas","coins":1},
	  "name:match star": {"name":"Match Star","coins":1},
	  "name:mate melody": {"name":"Mate Melody","coins":1},
	  "name:merfushka": {"name":"Merfushka","coins":1},
	  "name:midsummer cake": {"name":"Midsummer Cake","coins":1},
	  "name:miss you": {"name":"Miss You","coins":1},
	  "name:morning bloom": {"name":"Morning Bloom","coins":1},
	  "name:music album": {"name":"Music  Album","coins":1},
	  "name:music mic": {"name":"Music Mic","coins":1},
	  "name:music on stage": {"name":"Music on Stage","coins":1},
	  "name:music play": {"name":"Music Play","coins":1},
	  "name:my first rose": {"name":"My First Rose","coins":1},
	  "name:nasi lemak": {"name":"Nasi Lemak","coins":1},
	  "name:nice to meet you": {"name":"Nice to meet you","coins":1},
	  "name:oldies": {"name":"Oldies","coins":1},
	  "name:orange juice": {"name":"Orange Juice","coins":1},
	  "name:oranges": {"name":"Oranges","coins":1},
	  "name:osel": {"name":"OSEL","coins":1},
	  "name:ovelhas felizes": {"name":"Ovelhas Felizes","coins":1},
	  "name:paddington in peru": {"name":"Paddington in Peru","coins":1},
	  "name:parliyorsun!": {"name":"Parliyorsun!","coins":1},
	  "name:phi pro player": {"name":"PHI pro player","coins":1},
	  "name:pop": {"name":"Pop","coins":1},
	  "name:popular vote": {"name":"Popular Vote","coins":1},
	  "name:power gem": {"name":"Power Gem","coins":1},
	  "name:power hug": {"name":"Power hug","coins":1},
	  "name:power of diamond": {"name":"Power of Diamond","coins":1},
	  "name:pride": {"name":"Pride","coins":1},
	  "name:pumpkin": {"name":"Pumpkin","coins":1},
	  "name:rainbow": {"name":"Rainbow","coins":1},
	  "name:ramadan kareem": {"name":"Ramadan Kareem","coins":1},
	  "name:ramadan welcome": {"name":"Ramadan Welcome","coins":1},
	  "name:red lightning": {"name":"Red Lightning","coins":1},
	  "name:rendang chicken": {"name":"Rendang Chicken","coins":1},
	  "name:rose": {"name":"Rose","coins":1},
	  "name:sea shell": {"name":"SEA Shell","coins":1},
	  "name:shield": {"name":"Shield","coins":1},
	  "name:silver fern": {"name":"Silver Fern","coins":1},
	  "name:slay": {"name":"Slay","coins":1},
	  "name:so cute": {"name":"So Cute","coins":1},
	  "name:soccer": {"name":"Soccer","coins":1},
	  "name:spidey pin": {"name":"Spidey Pin","coins":1},
	  "name:squirrel": {"name":"Squirrel","coins":1},
	  "name:star": {"name":"Star","coins":1},
	  "name:starfish": {"name":"Starfish","coins":1},
	  "name:steven wingman": {"name":"Steven Wingman","coins":1},
	  "name:summer pass s": {"name":"Summer Pass S","coins":1},
	  "name:súper coco": {"name":"Súper Coco","coins":1},
	  "name:suprised fish": {"name":"Suprised Fish","coins":1},
	  "name:szef mitsu": {"name":"Szef Mitsu","coins":1},
	  "name:tasty gaming": {"name":"Tasty Gaming","coins":1},
	  "name:team cheers": {"name":"Team Cheers","coins":1},
	  "name:teamjupptornado": {"name":"TeamJuppTornado","coins":1},
	  "name:tennis love": {"name":"Tennis Love","coins":1},
	  "name:thumbs up": {"name":"Thumbs Up","coins":1},
	  "name:thunder hammer": {"name":"Thunder Hammer","coins":1},
	  "name:tiktok": {"name":"TikTok","coins":1},
	  "name:tom the tomato": {"name":"Tom the Tomato","coins":1},
	  "name:tortilla": {"name":"Tortilla","coins":1},
	  "name:treasure clover": {"name":"Treasure Clover","coins":1},
	  "name:tulip": {"name":"Tulip","coins":1},
	  "name:umbrella": {"name":"umbrella","coins":1},
	  "name:welcome dallah": {"name":"Welcome Dallah","coins":1},
	  "name:white dove": {"name":"White Dove","coins":1},
	  "name:white paw": {"name":"White paw","coins":1},
	  "name:white rose": {"name":"White Rose","coins":1},
	  "name:wiggle lantern": {"name":"Wiggle Lantern","coins":1},
	  "name:windvane": {"name":"Windvane","coins":1},
	  "name:wink charm": {"name":"Wink Charm","coins":1},
	  "name:wink wink": {"name":"Wink wink","coins":1},
	  "name:yalla!habibi!": {"name":"Yalla!habibi!","coins":1},
	  "name:yellow lightning": {"name":"Yellow Lightning","coins":1},
	  "name:you're awesome": {"name":"You're awesome","coins":1},
	  "name:goool": {"name":"GOOOL","coins":2},
	  "name:team bracelet": {"name":"Team Bracelet","coins":2},
	  "name:blue bead": {"name":"Blue Bead","coins":5},
	  "name:bokuao": {"name":"Bokuao","coins":5},
	  "name:boxing gloves": {"name":"Boxing Gloves","coins":5},
	  "name:brown paw": {"name":"Brown Paw","coins":5},
	  "name:choc chip cookie": {"name":"Choc Chip Cookie","coins":5},
	  "name:chocolate": {"name":"Chocolate","coins":5},
	  "name:coconut drink": {"name":"Coconut Drink","coins":5},
	  "name:cute cat": {"name":"Cute Cat","coins":5},
	  "name:duit raya": {"name":"Duit Raya","coins":5},
	  "name:embroidered heart": {"name":"Embroidered Heart","coins":5},
	  "name:encore ticket": {"name":"Encore Ticket","coins":5},
	  "name:espresso": {"name":"Espresso","coins":5},
	  "name:finger heart": {"name":"Finger Heart","coins":5},
	  "name:fireball": {"name":"Fireball","coins":5},
	  "name:fluffy penguin": {"name":"Fluffy Penguin","coins":5},
	  "name:golden player": {"name":"Golden Player","coins":5},
	  "name:green packet": {"name":"Green Packet","coins":5},
	  "name:hand held fan": {"name":"Hand held fan","coins":5},
	  "name:hello traveler": {"name":"Hello Traveler","coins":5},
	  "name:i'm blue": {"name":"I’m blue","coins":5},
	  "name:ice cream": {"name":"Ice cream","coins":5},
	  "name:jelly snakes": {"name":"Jelly Snakes","coins":5},
	  "name:ladybug": {"name":"Ladybug","coins":5},
	  "name:love guard": {"name":"Love Guard","coins":5},
	  "name:love in scent": {"name":"Love in Scent","coins":5},
	  "name:mameshiba": {"name":"Mameshiba","coins":5},
	  "name:moon sighting": {"name":"Moon sighting","coins":5},
	  "name:name shoutout": {"name":"Name shoutout","coins":5},
	  "name:new year protection": {"name":"New Year Protection","coins":5},
	  "name:okay": {"name":"Okay","coins":5},
	  "name:overreact": {"name":"Overreact","coins":5},
	  "name:padang rice": {"name":"Padang Rice","coins":5},
	  "name:pancit canton": {"name":"Pancit canton","coins":5},
	  "name:papyrus scroll": {"name":"Papyrus Scroll","coins":5},
	  "name:peach": {"name":"Peach","coins":5},
	  "name:pomegranate": {"name":"Pomegranate","coins":5},
	  "name:pumpkin pie": {"name":"Pumpkin Pie","coins":5},
	  "name:rocket": {"name":"Rocket","coins":5},
	  "name:sakura": {"name":"Sakura","coins":5},
	  "name:sampaguita": {"name":"Sampaguita","coins":5},
	  "name:seriously": {"name":"Seriously","coins":5},
	  "name:shamrock": {"name":"Shamrock","coins":5},
	  "name:spinning soccer": {"name":"Spinning Soccer","coins":5},
	  "name:support": {"name":"Support","coins":5},
	  "name:support me": {"name":"Support Me","coins":5},
	  "name:sweet potato": {"name":"Sweet Potato","coins":5},
	  "name:taho": {"name":"Taho","coins":5},
	  "name:tofu": {"name":"Tofu","coins":5},
	  "name:turkish coffee": {"name":"Turkish coffee","coins":5},
	  "name:turkish kebab": {"name":"Turkish kebab","coins":5},
	  "name:w": {"name":"W","coins":5},
	  "name:wave firework": {"name":"Wave Firework","coins":5},
	  "name:yes tiktok live": {"name":"Yes TikTok Live","coins":5},
	  "name:divine fingers": {"name":"Divine Fingers","coins":6},
	  "name:carnation": {"name":"Carnation","coins":7},
	  "name:cheer bonbon": {"name":"Cheer Bonbon","coins":7},
	  "name:whipped coffee": {"name":"Whipped Coffee","coins":8},
	  "name:applause": {"name":"Applause","coins":9},
	  "name:cheer you up": {"name":"Cheer You Up","coins":9},
	  "name:club power": {"name":"Club Power","coins":9},
	  "name:super popular": {"name":"Super Popular","coins":9},
	  "name:team power": {"name":"Team Power","coins":9},
	  "name:the lucky 9": {"name":"The Lucky 9","coins":9},
	  "name:asmr time": {"name":"ASMR Time","coins":10},
	  "name:azura card fiery": {"name":"Azura card fiery","coins":10},
	  "name:azura tranquil": {"name":"Azura tranquil","coins":10},
	  "name:baby hippo": {"name":"Baby Hippo","coins":10},
	  "name:balloons": {"name":"Balloons","coins":10},
	  "name:banana peel": {"name":"Banana Peel","coins":10},
	  "name:beach radio": {"name":"Beach Radio","coins":10},
	  "name:black paw": {"name":"Black Paw","coins":10},
	  "name:boo": {"name":"Boo","coins":10},
	  "name:cherry blossom bunny": {"name":"Cherry Blossom Bunny","coins":10},
	  "name:courage potion": {"name":"Courage potion","coins":10},
	  "name:crocodile": {"name":"Crocodile","coins":10},
	  "name:dj cactus": {"name":"DJ Cactus","coins":10},
	  "name:dj vinyl": {"name":"DJ Vinyl","coins":10},
	  "name:dolphin": {"name":"Dolphin","coins":10},
	  "name:drip brewing": {"name":"Drip Brewing","coins":10},
	  "name:ewc": {"name":"EWC","coins":10},
	  "name:fandom fan": {"name":"FANDOM Fan","coins":10},
	  "name:firelight seal": {"name":"Firelight Seal","coins":10},
	  "name:fried chicken": {"name":"Fried Chicken","coins":10},
	  "name:friendship necklace": {"name":"Friendship Necklace","coins":10},
	  "name:fukkachan": {"name":"Fukkachan","coins":10},
	  "name:furious fire": {"name":"Furious Fire","coins":10},
	  "name:go go go": {"name":"Go Go Go","coins":10},
	  "name:gold boxing gloves": {"name":"Gold Boxing Gloves","coins":10},
	  "name:gutab": {"name":"Gutab","coins":10},
	  "name:halo-halo": {"name":"Halo-Halo","coins":10},
	  "name:heart gaze": {"name":"Heart Gaze","coins":10},
	  "name:hi bear": {"name":"Hi Bear","coins":10},
	  "name:i like what i see": {"name":"I Like What I See","coins":10},
	  "name:i love you": {"name":"I love you","coins":10},
	  "name:ice lolly": {"name":"Ice Lolly","coins":10},
	  "name:intimacy": {"name":"Intimacy","coins":10},
	  "name:journey pass": {"name":"Journey Pass","coins":10},
	  "name:koala": {"name":"Koala","coins":10},
	  "name:koala refuel": {"name":"Koala Refuel","coins":10},
	  "name:league ball": {"name":"League Ball","coins":10},
	  "name:little ghost": {"name":"Little Ghost","coins":10},
	  "name:live island": {"name":"LIVE Island","coins":10},
	  "name:live ranking ticket": {"name":"LIVE Ranking Ticket","coins":10},
	  "name:live star": {"name":"LIVE Star","coins":10},
	  "name:love piggy": {"name":"Love Piggy","coins":10},
	  "name:lucky pig": {"name":"Lucky Pig","coins":10},
	  "name:lucky pony": {"name":"Lucky Pony","coins":10},
	  "name:magic feather": {"name":"Magic Feather","coins":10},
	  "name:magnifying glass": {"name":"Magnifying glass","coins":10},
	  "name:meowthumbs up": {"name":"Meowthumbs Up","coins":10},
	  "name:mind blown": {"name":"Mind Blown","coins":10},
	  "name:minecraft": {"name":"Minecraft","coins":10},
	  "name:music cloud": {"name":"Music Cloud","coins":10},
	  "name:nebaarukun": {"name":"Nebaarukun","coins":10},
	  "name:new york cab": {"name":"New York Cab","coins":10},
	  "name:nightshade seal": {"name":"Nightshade Seal","coins":10},
	  "name:nouthern zongzi": {"name":"Nouthern Zongzi","coins":10},
	  "name:panther": {"name":"Panther","coins":10},
	  "name:pork rice bowl": {"name":"Pork Rice Bowl","coins":10},
	  "name:potato with ice cream": {"name":"Potato with ice cream","coins":10},
	  "name:pumpkin latte": {"name":"Pumpkin Latte","coins":10},
	  "name:rosa": {"name":"Rosa","coins":10},
	  "name:sakura mochi": {"name":"Sakura Mochi","coins":10},
	  "name:shepherd": {"name":"Shepherd","coins":10},
	  "name:sing together": {"name":"Sing Together","coins":10},
	  "name:sisig": {"name":"Sisig","coins":10},
	  "name:slow motion": {"name":"Slow motion","coins":10},
	  "name:songs of live": {"name":"Songs of LIVE","coins":10},
	  "name:southern zongzi": {"name":"Southern Zongzi","coins":10},
	  "name:style me up": {"name":"Style Me Up","coins":10},
	  "name:tiny diny": {"name":"Tiny Diny","coins":10},
	  "name:treasure's key": {"name":"Treasure's Key","coins":10},
	  "name:udon-nou": {"name":"Udon-nou","coins":10},
	  "name:watermelon": {"name":"Watermelon","coins":10},
	  "name:whistle": {"name":"Whistle","coins":10},
	  "name:whitewind seal": {"name":"Whitewind Seal","coins":10},
	  "name:xp boost core": {"name":"XP Boost Core","coins":10},
	  "name:you're the best!": {"name":"You’re the Best!","coins":10},
	  "name:backpack": {"name":"Backpack","coins":15},
	  "name:bravo!": {"name":"Bravo!","coins":15},
	  "name:flower garland": {"name":"Flower Garland","coins":15},
	  "name:kudos for my star": {"name":"Kudos for My Star","coins":15},
	  "name:my melody & kuromi": {"name":"My Melody & Kuromi","coins":15},
	  "name:next legends": {"name":"Next Legends","coins":15},
	  "name:romanian polenta": {"name":"Romanian Polenta","coins":15},
	  "name:tiny diny in love": {"name":"Tiny Diny in Love","coins":15},
	  "name:adobo": {"name":"Adobo","coins":20},
	  "name:bouquet": {"name":"Bouquet","coins":20},
	  "name:chicago pizza": {"name":"Chicago Pizza","coins":20},
	  "name:dombra": {"name":"Dombra","coins":20},
	  "name:g.o.a.t. busker": {"name":"G.O.A.T. Busker","coins":20},
	  "name:headphone tiktok": {"name":"Headphone TikTok","coins":20},
	  "name:let 'em cook": {"name":"Let 'Em Cook","coins":20},
	  "name:little kisses": {"name":"little kisses","coins":20},
	  "name:mushroom": {"name":"Mushroom","coins":20},
	  "name:new year keyboard": {"name":"New Year Keyboard","coins":20},
	  "name:perfume": {"name":"Perfume","coins":20},
	  "name:s flowers": {"name":"S Flowers","coins":20},
	  "name:summer sun": {"name":"Summer Sun","coins":20},
	  "name:sushi set": {"name":"Sushi Set","coins":20},
	  "name:tiny diny hotdog": {"name":"Tiny Diny Hotdog","coins":20},
	  "name:traffic cone": {"name":"Traffic Cone","coins":20},
	  "name:capy summer": {"name":"Capy Summer","coins":25},
	  "name:summer star": {"name":"Summer Star","coins":25},
	  "name:trumpet": {"name":"Trumpet","coins":29},
	  "name:adventure": {"name":"Adventure","coins":30},
	  "name:bouquet flower": {"name":"Bouquet Flower","coins":30},
	  "name:bubble tea": {"name":"Bubble Tea","coins":30},
	  "name:capybara": {"name":"Capybara","coins":30},
	  "name:cheese donuts": {"name":"Cheese Donuts","coins":30},
	  "name:choco strawberries": {"name":"Choco Strawberries","coins":30},
	  "name:doughnut": {"name":"Doughnut","coins":30},
	  "name:energy capsule": {"name":"Energy Capsule","coins":30},
	  "name:energy drop": {"name":"Energy Drop","coins":30},
	  "name:kafu": {"name":"Kafu","coins":30},
	  "name:strawbs & cream": {"name":"Strawbs & Cream","coins":30},
	  "name:u make miso happy!": {"name":"U make Miso happy!","coins":30},
	  "name:warm cocoa": {"name":"Warm Cocoa","coins":30},
	  "name:witchy kitty": {"name":"Witchy Kitty","coins":30},
	  "name:woodland wonder": {"name":"Woodland Wonder","coins":30},
	  "name:you are my jam": {"name":"You are my Jam","coins":30},
	  "name:you are on a roll": {"name":"You are on a Roll","coins":30},
	  "name:bagel": {"name":"Bagel","coins":35},
	  "name:soccer ball": {"name":"Soccer Ball","coins":39},
	  "name:bouncing ball": {"name":"Bouncing Ball","coins":45},
	  "name:sign language love": {"name":"Sign language love","coins":49},
	  "name:genius": {"name":"Genius","coins":50},
	  "name:tea": {"name":"Tea","coins":50},
	  "name:single strike": {"name":"Single Strike","coins":70},
	  "name:money bag": {"name":"Money Bag","coins":80},
	  "name:boo the ghost": {"name":"Boo the Ghost","coins":88},
	  "name:butterfly": {"name":"Butterfly","coins":88},
	  "name:cendol": {"name":"Cendol","coins":88},
	  "name:december": {"name":"December","coins":88},
	  "name:harika": {"name":"Harika","coins":88},
	  "name:midsummer moose": {"name":"Midsummer Moose","coins":88},
	  "name:october": {"name":"October","coins":88},
	  "name:takoyaki": {"name":"Takoyaki","coins":88},
	  "name:chart topper": {"name":"Chart topper","coins":90},
	  "name:family": {"name":"Family","coins":90},
	  "name:fist bump": {"name":"Fist bump","coins":90},
	  "name:sending strength": {"name":"Sending strength","coins":90},
	  "name:batik bucket hat": {"name":"Batik Bucket Hat","coins":99},
	  "name:birthday crown": {"name":"Birthday Crown","coins":99},
	  "name:birthday hat": {"name":"Birthday Hat","coins":99},
	  "name:bloom melody": {"name":"Bloom Melody","coins":99},
	  "name:breakthrough star": {"name":"Breakthrough Star","coins":99},
	  "name:breeze quena": {"name":"Breeze Quena","coins":99},
	  "name:bubble gum": {"name":"Bubble Gum","coins":99},
	  "name:candy blast": {"name":"Candy Blast","coins":99},
	  "name:cap": {"name":"Cap","coins":99},
	  "name:charmer bow": {"name":"Charmer Bow","coins":99},
	  "name:club victory": {"name":"Club Victory","coins":99},
	  "name:community style": {"name":"Community Style","coins":99},
	  "name:cow-napping": {"name":"Cow-napping","coins":99},
	  "name:crescent chain": {"name":"Crescent Chain","coins":99},
	  "name:cupid's bow": {"name":"Cupid’s Bow","coins":99},
	  "name:cursed kick": {"name":"Cursed Kick","coins":99},
	  "name:fest gear": {"name":"Fest Gear","coins":99},
	  "name:fiesta accordion": {"name":"Fiesta Accordion","coins":99},
	  "name:greeting heart": {"name":"Greeting Heart","coins":99},
	  "name:groove guitar": {"name":"Groove Guitar","coins":99},
	  "name:guitar": {"name":"Guitar","coins":99},
	  "name:hat and mustache": {"name":"Hat and Mustache","coins":99},
	  "name:healing sape": {"name":"Healing Sape","coins":99},
	  "name:heart ksa": {"name":"Heart KSA","coins":99},
	  "name:heart me flex": {"name":"Heart Me Flex","coins":99},
	  "name:heart oman": {"name":"Heart Oman","coins":99},
	  "name:hot shot": {"name":"Hot Shot","coins":99},
	  "name:kiss your heart": {"name":"Kiss your Heart","coins":99},
	  "name:level-up sparks": {"name":"Level-up Sparks","coins":99},
	  "name:like-pop": {"name":"Like-Pop","coins":99},
	  "name:little crown": {"name":"Little Crown","coins":99},
	  "name:little wing": {"name":"Little Wing","coins":99},
	  "name:live on air": {"name":"LIVE On Air","coins":99},
	  "name:love chain": {"name":"Love Chain","coins":99},
	  "name:love luck": {"name":"Love Luck","coins":99},
	  "name:love painting": {"name":"Love Painting","coins":99},
	  "name:lucky star": {"name":"Lucky Star","coins":99},
	  "name:mark of love": {"name":"Mark of Love","coins":99},
	  "name:murtabak": {"name":"Murtabak","coins":99},
	  "name:noor": {"name":"Noor","coins":99},
	  "name:paper crane": {"name":"Paper Crane","coins":99},
	  "name:pearl chime": {"name":"Pearl Chime","coins":99},
	  "name:pixel gg": {"name":"Pixel GG","coins":99},
	  "name:play samba": {"name":"Play Samba","coins":99},
	  "name:ready, go!": {"name":"Ready, go!","coins":99},
	  "name:rising star": {"name":"Rising Star","coins":99},
	  "name:rock the stage": {"name":"Rock the Stage","coins":99},
	  "name:send heart": {"name":"Send Heart","coins":99},
	  "name:singing mushroom": {"name":"Singing Mushroom","coins":99},
	  "name:snow rabbit": {"name":"Snow Rabbit","coins":99},
	  "name:stabilizer": {"name":"Stabilizer","coins":99},
	  "name:sundae bowl": {"name":"Sundae Bowl","coins":99},
	  "name:team victory": {"name":"Team Victory","coins":99},
	  "name:throw tomatoes": {"name":"Throw Tomatoes","coins":99},
	  "name:winning wednesday": {"name":"Winning Wednesday","coins":99},
	  "name:wobbler": {"name":"Wobbler","coins":99},
	  "name:balloon gift box": {"name":"Balloon Gift Box","coins":100},
	  "name:chicken and cola": {"name":"Chicken and Cola","coins":100},
	  "name:compact": {"name":"Compact","coins":100},
	  "name:confetti": {"name":"Confetti","coins":100},
	  "name:fandom stamp": {"name":"FANDOM Stamp","coins":100},
	  "name:flowers": {"name":"Flowers","coins":100},
	  "name:foamy drink": {"name":"Foamy Drink","coins":100},
	  "name:game controller": {"name":"Game Controller","coins":100},
	  "name:gate to treasure": {"name":"Gate to Treasure","coins":100},
	  "name:hand heart": {"name":"Hand Heart","coins":100},
	  "name:hand hearts": {"name":"Hand Hearts","coins":100},
	  "name:heart my earthling": {"name":"Heart My Earthling","coins":100},
	  "name:heart signal": {"name":"Heart Signal","coins":100},
	  "name:infinity chain": {"name":"Infinity Chain","coins":100},
	  "name:ko!": {"name":"KO!","coins":100},
	  "name:marvelous confetti": {"name":"Marvelous Confetti","coins":100},
	  "name:match wand": {"name":"Match Wand","coins":100},
	  "name:minecraft bee": {"name":"Minecraft Bee","coins":100},
	  "name:mini star": {"name":"Mini Star","coins":100},
	  "name:mishka bear": {"name":"Mishka Bear","coins":100},
	  "name:power chip": {"name":"Power Chip","coins":100},
	  "name:rainbow ministar": {"name":"Rainbow Ministar","coins":100},
	  "name:rainbow slide": {"name":"Rainbow Slide","coins":100},
	  "name:shell energy": {"name":"Shell Energy","coins":100},
	  "name:singing magic": {"name":"Singing Magic","coins":100},
	  "name:super gg": {"name":"Super GG","coins":100},
	  "name:tsar": {"name":"Tsar","coins":100},
	  "name:wooden box": {"name":"Wooden Box","coins":100},
	  "name:wooden rod": {"name":"Wooden Rod","coins":100},
	  "name:crossette firework": {"name":"Crossette Firework","coins":129},
	  "name:balloon crown": {"name":"Balloon Crown","coins":149},
	  "name:big shout out": {"name":"Big Shout Out","coins":149},
	  "name:bowknot": {"name":"Bowknot","coins":149},
	  "name:caterpillar chaos": {"name":"Caterpillar Chaos","coins":149},
	  "name:catrina": {"name":"Catrina","coins":149},
	  "name:chatting popcorn": {"name":"Chatting Popcorn","coins":149},
	  "name:dizzy bird": {"name":"Dizzy Bird","coins":149},
	  "name:fairy hide": {"name":"Fairy Hide","coins":149},
	  "name:feather tiara": {"name":"Feather Tiara","coins":149},
	  "name:frog conductor": {"name":"Frog Conductor","coins":149},
	  "name:groove clarinet": {"name":"Groove Clarinet","coins":149},
	  "name:heart balloons": {"name":"Heart Balloons","coins":149},
	  "name:heart rain": {"name":"Heart Rain","coins":149},
	  "name:love glasses": {"name":"Love Glasses","coins":149},
	  "name:masquerade": {"name":"Masquerade","coins":149},
	  "name:mystery mask": {"name":"Mystery Mask","coins":149},
	  "name:otter with fish": {"name":"Otter with Fish","coins":149},
	  "name:raving snail": {"name":"Raving Snail","coins":149},
	  "name:santa cocoa": {"name":"Santa Cocoa","coins":149},
	  "name:tempo flute": {"name":"Tempo Flute","coins":149},
	  "name:a bubbly time": {"name":"A Bubbly Time","coins":150},
	  "name:capybara swim": {"name":"Capybara Swim","coins":150},
	  "name:kiss": {"name":"Kiss","coins":150},
	  "name:lightening board": {"name":"Lightening Board","coins":150},
	  "name:louis the cardinal": {"name":"Louis the Cardinal","coins":150},
	  "name:potato transformation": {"name":"Potato Transformation","coins":150},
	  "name:puffer fish": {"name":"Puffer Fish","coins":150},
	  "name:salentinian blossom": {"name":"Salentinian Blossom","coins":150},
	  "name:sceptre": {"name":"Sceptre","coins":150},
	  "name:song of harvest": {"name":"Song of Harvest","coins":150},
	  "name:star guard": {"name":"Star Guard","coins":150},
	  "name:watermelon slide": {"name":"Watermelon Slide","coins":150},
	  "name:bruiser": {"name":"Bruiser","coins":153},
	  "name:music note": {"name":"Music Note","coins":169},
	  "name:birthday glasses": {"name":"Birthday Glasses","coins":199},
	  "name:bloom brass": {"name":"Bloom Brass","coins":199},
	  "name:blow bubbles": {"name":"Blow Bubbles","coins":199},
	  "name:blowing bubbles": {"name":"Blowing Bubbles","coins":199},
	  "name:borneo": {"name":"Borneo","coins":199},
	  "name:bowtiful crown": {"name":"Bowtiful Crown","coins":199},
	  "name:cheer for you": {"name":"Cheer For You","coins":199},
	  "name:cheering crab": {"name":"Cheering Crab","coins":199},
	  "name:chirpy kisses": {"name":"Chirpy Kisses","coins":199},
	  "name:christmas prawn": {"name":"Christmas Prawn","coins":199},
	  "name:coconut": {"name":"Coconut","coins":199},
	  "name:coconut juice": {"name":"Coconut Juice","coins":199},
	  "name:coconut tree": {"name":"Coconut Tree","coins":199},
	  "name:coffee magic": {"name":"Coffee Magic","coins":199},
	  "name:crown": {"name":"Crown","coins":199},
	  "name:dancing hands": {"name":"Dancing Hands","coins":199},
	  "name:eye see you": {"name":"Eye See You","coins":199},
	  "name:fan cat": {"name":"Fan Cat","coins":199},
	  "name:feed chocolate": {"name":"Feed Chocolate","coins":199},
	  "name:festival fan": {"name":"Festival Fan","coins":199},
	  "name:floating octopus": {"name":"Floating Octopus","coins":199},
	  "name:flower headband": {"name":"Flower Headband","coins":199},
	  "name:forest beginnings": {"name":"Forest Beginnings","coins":199},
	  "name:gamer cat": {"name":"Gamer Cat","coins":199},
	  "name:garland headpiece": {"name":"Garland Headpiece","coins":199},
	  "name:gear": {"name":"Gear","coins":199},
	  "name:goal strike": {"name":"Goal Strike","coins":199},
	  "name:goalkeeper save": {"name":"Goalkeeper Save","coins":199},
	  "name:hampers": {"name":"Hampers","coins":199},
	  "name:hanging lights": {"name":"Hanging Lights","coins":199},
	  "name:heart hood": {"name":"Heart Hood","coins":199},
	  "name:hearts": {"name":"Hearts","coins":199},
	  "name:indoor fan": {"name":"Indoor Fan","coins":199},
	  "name:joker ball": {"name":"Joker Ball","coins":199},
	  "name:juicy smile": {"name":"Juicy Smile","coins":199},
	  "name:juicy tomato": {"name":"Juicy Tomato","coins":199},
	  "name:league countdown": {"name":"League Countdown","coins":199},
	  "name:lots of bread": {"name":"Lots of Bread","coins":199},
	  "name:love charger": {"name":"Love Charger","coins":199},
	  "name:love rain": {"name":"Love Rain","coins":199},
	  "name:massage for you": {"name":"Massage for You","coins":199},
	  "name:may you blossom": {"name":"May you blossom","coins":199},
	  "name:meerkat": {"name":"Meerkat","coins":199},
	  "name:melon juice": {"name":"Melon Juice","coins":199},
	  "name:music player": {"name":"Music Player","coins":199},
	  "name:mystic panpipes": {"name":"Mystic Panpipes","coins":199},
	  "name:night star": {"name":"Night Star","coins":199},
	  "name:panda climb": {"name":"Panda Climb","coins":199},
	  "name:panther paws": {"name":"Panther Paws","coins":199},
	  "name:party pony": {"name":"Party Pony","coins":199},
	  "name:pinch cheek": {"name":"Pinch Cheek","coins":199},
	  "name:potato in paris": {"name":"Potato in Paris","coins":199},
	  "name:prism shine": {"name":"Prism Shine","coins":199},
	  "name:ramadan moon": {"name":"Ramadan Moon","coins":199},
	  "name:restore hp": {"name":"Restore HP","coins":199},
	  "name:revive surge": {"name":"Revive Surge","coins":199},
	  "name:rhythm bot": {"name":"Rhythm Bot","coins":199},
	  "name:rose hand": {"name":"Rose Hand","coins":199},
	  "name:santa hat": {"name":"Santa Hat","coins":199},
	  "name:sending positivity": {"name":"Sending positivity","coins":199},
	  "name:shiba inu": {"name":"Shiba Inu","coins":199},
	  "name:side by side": {"name":"Side by Side","coins":199},
	  "name:smile latte": {"name":"Smile Latte","coins":199},
	  "name:sour buddy": {"name":"Sour Buddy","coins":199},
	  "name:sparklers": {"name":"Sparklers","coins":199},
	  "name:star glasses": {"name":"Star Glasses","coins":199},
	  "name:stinging bee": {"name":"Stinging Bee","coins":199},
	  "name:stroke hair": {"name":"Stroke Hair","coins":199},
	  "name:suitcase": {"name":"Suitcase","coins":199},
	  "name:sun crown": {"name":"Sun Crown","coins":199},
	  "name:sunglasses": {"name":"Sunglasses","coins":199},
	  "name:sunny side up": {"name":"Sunny Side Up","coins":199},
	  "name:take the mic": {"name":"Take the Mic","coins":199},
	  "name:talking heartbeat": {"name":"Talking Heartbeat","coins":199},
	  "name:the crown": {"name":"The Crown","coins":199},
	  "name:toucan": {"name":"Toucan","coins":199},
	  "name:twinkling star": {"name":"Twinkling Star","coins":199},
	  "name:tyubeteika": {"name":"Tyubeteika","coins":199},
	  "name:wooly hat": {"name":"Wooly Hat","coins":199},
	  "name:baglama": {"name":"Baglama","coins":200},
	  "name:bunny ears": {"name":"Bunny Ears","coins":200},
	  "name:castanets": {"name":"Castanets","coins":200},
	  "name:diamond heart necklace": {"name":"Diamond Heart necklace","coins":200},
	  "name:dino cap": {"name":"Dino cap","coins":200},
	  "name:gold medal": {"name":"Gold Medal","coins":200},
	  "name:gold necklace": {"name":"Gold necklace","coins":200},
	  "name:golden chain": {"name":"Golden Chain","coins":200},
	  "name:i love tiktok live": {"name":"I Love TikTok LIVE","coins":200},
	  "name:magic genie": {"name":"Magic Genie","coins":200},
	  "name:ramune": {"name":"Ramune","coins":200},
	  "name:rilakkuma's ear": {"name":"Rilakkuma's ear","coins":200},
	  "name:semsemia": {"name":"Semsemia","coins":200},
	  "name:tulip box": {"name":"Tulip Box","coins":200},
	  "name:rose bear": {"name":"Rose Bear","coins":214},
	  "name:cat": {"name":"Cat","coins":222},
	  "name:2025 glasses": {"name":"2025 Glasses","coins":225},
	  "name:2025 joylens": {"name":"2025 JoyLens","coins":225},
	  "name:amped up": {"name":"Amped Up","coins":249},
	  "name:blast drum": {"name":"Blast Drum","coins":249},
	  "name:bubble headphones": {"name":"Bubble Headphones","coins":249},
	  "name:candy bouquet": {"name":"Candy Bouquet","coins":249},
	  "name:cheer mic": {"name":"Cheer Mic","coins":249},
	  "name:darbuka drum": {"name":"Darbuka Drum","coins":249},
	  "name:dreamy strings": {"name":"Dreamy Strings","coins":249},
	  "name:face-pulling": {"name":"Face-pulling","coins":249},
	  "name:forest elf": {"name":"Forest Elf","coins":249},
	  "name:ice cream mic": {"name":"Ice Cream Mic","coins":249},
	  "name:melodic birds": {"name":"Melodic birds","coins":249},
	  "name:midsummer hair": {"name":"Midsummer Hair","coins":249},
	  "name:music bubbles": {"name":"Music Bubbles","coins":249},
	  "name:oud": {"name":"Oud","coins":249},
	  "name:palm breeze": {"name":"Palm Breeze","coins":249},
	  "name:party blossom": {"name":"Party Blossom","coins":249},
	  "name:pinch face": {"name":"Pinch Face","coins":249},
	  "name:poetry score": {"name":"Poetry Score","coins":249},
	  "name:singing frog": {"name":"Singing Frog","coins":249},
	  "name:snow bloom": {"name":"Snow Bloom","coins":249},
	  "name:star goggles": {"name":"Star Goggles","coins":249},
	  "name:surfing penguin": {"name":"Surfing Penguin","coins":249},
	  "name:sweet flutter": {"name":"Sweet Flutter","coins":249},
	  "name:talent burst": {"name":"Talent Burst","coins":249},
	  "name:treasured voice": {"name":"Treasured Voice","coins":249},
	  "name:tiny diny float": {"name":"Tiny Diny Float","coins":250},
	  "name:triple thunder": {"name":"Triple Thunder","coins":289},
	  "name:all star crown": {"name":"All Star Crown","coins":299},
	  "name:alpaca": {"name":"Alpaca","coins":299},
	  "name:azura horns": {"name":"Azura Horns","coins":299},
	  "name:bat headwear": {"name":"Bat Headwear","coins":299},
	  "name:bell": {"name":"Bell","coins":299},
	  "name:brazilian vibe cap": {"name":"Brazilian Vibe Cap","coins":299},
	  "name:budding heart": {"name":"Budding Heart","coins":299},
	  "name:butterfly for you": {"name":"Butterfly for You","coins":299},
	  "name:cello romance": {"name":"Cello Romance","coins":299},
	  "name:cheering towel": {"name":"Cheering Towel","coins":299},
	  "name:come on!": {"name":"Come On!","coins":299},
	  "name:corgi": {"name":"Corgi","coins":299},
	  "name:crescent lanterns": {"name":"Crescent Lanterns","coins":299},
	  "name:crystal shoe": {"name":"Crystal Shoe","coins":299},
	  "name:dancing flower": {"name":"Dancing Flower","coins":299},
	  "name:daruma": {"name":"Daruma","coins":299},
	  "name:dash": {"name":"Dash","coins":299},
	  "name:dream team": {"name":"Dream Team","coins":299},
	  "name:eid gift box": {"name":"EID Gift Box","coins":299},
	  "name:elephant trunk": {"name":"Elephant trunk","coins":299},
	  "name:falling for you": {"name":"Falling For You","coins":299},
	  "name:fest cheers": {"name":"Fest Cheers","coins":299},
	  "name:flower": {"name":"Flower","coins":299},
	  "name:french handshake": {"name":"French Handshake","coins":299},
	  "name:fruit friends": {"name":"Fruit Friends","coins":299},
	  "name:full moon": {"name":"Full moon","coins":299},
	  "name:gamer 2025": {"name":"Gamer 2025","coins":299},
	  "name:glitter cap": {"name":"Glitter Cap","coins":299},
	  "name:go hamster": {"name":"Go Hamster","coins":299},
	  "name:golden crown": {"name":"Golden Crown","coins":299},
	  "name:hawaiian lei": {"name":"Hawaiian Lei","coins":299},
	  "name:heart love plate": {"name":"Heart Love Plate","coins":299},
	  "name:hero landing": {"name":"Hero Landing","coins":299},
	  "name:hi! rosie!": {"name":"Hi! Rosie!","coins":299},
	  "name:journal": {"name":"Journal","coins":299},
	  "name:judy pose": {"name":"Judy Pose","coins":299},
	  "name:kicker challenge": {"name":"Kicker Challenge","coins":299},
	  "name:koala love": {"name":"Koala Love","coins":299},
	  "name:labor power": {"name":"Labor Power","coins":299},
	  "name:legend crown": {"name":"Legend Crown","coins":299},
	  "name:live ranking crown": {"name":"LIVE Ranking Crown","coins":299},
	  "name:live ranking headband": {"name":"LIVE Ranking Headband","coins":299},
	  "name:llama greetings": {"name":"Llama Greetings","coins":299},
	  "name:love call": {"name":"Love Call","coins":299},
	  "name:melody glasses": {"name":"Melody Glasses","coins":299},
	  "name:music mate": {"name":"Music Mate","coins":299},
	  "name:naughty chicken": {"name":"Naughty Chicken","coins":299},
	  "name:paddington hat": {"name":"Paddington Hat","coins":299},
	  "name:pawfect": {"name":"Pawfect","coins":299},
	  "name:penguin snowpal": {"name":"Penguin Snowpal","coins":299},
	  "name:play for you": {"name":"Play for You","coins":299},
	  "name:pony lantern": {"name":"Pony Lantern","coins":299},
	  "name:potato on a vespa": {"name":"Potato on a Vespa","coins":299},
	  "name:pug": {"name":"Pug","coins":299},
	  "name:puppy kisses": {"name":"Puppy Kisses","coins":299},
	  "name:rain doll": {"name":"Rain Doll","coins":299},
	  "name:ramadan crescent": {"name":"Ramadan Crescent","coins":299},
	  "name:ramazan hilali": {"name":"Ramazan Hilali","coins":299},
	  "name:rhythm crown": {"name":"Rhythm Crown","coins":299},
	  "name:rising key": {"name":"Rising Key","coins":299},
	  "name:rock star": {"name":"Rock Star","coins":299},
	  "name:rookies cup": {"name":"Rookies Cup","coins":299},
	  "name:rosie's look": {"name":"Rosie's Look","coins":299},
	  "name:sax groove": {"name":"Sax Groove","coins":299},
	  "name:scroll": {"name":"Scroll","coins":299},
	  "name:spider on web": {"name":"Spider on web","coins":299},
	  "name:spring sprout": {"name":"Spring Sprout","coins":299},
	  "name:starlight compass": {"name":"Starlight Compass","coins":299},
	  "name:super dog": {"name":"Super Dog","coins":299},
	  "name:swing cello": {"name":"Swing Cello","coins":299},
	  "name:the mullet": {"name":"The Mullet","coins":299},
	  "name:tiktok crown": {"name":"TikTok Crown","coins":299},
	  "name:tiny diny on triangle": {"name":"Tiny Diny on Triangle","coins":299},
	  "name:treasure": {"name":"Treasure","coins":299},
	  "name:trick or treat": {"name":"Trick or Treat","coins":299},
	  "name:tropical mask": {"name":"Tropical Mask","coins":299},
	  "name:united heart": {"name":"United Heart","coins":299},
	  "name:victory sign": {"name":"Victory Sign","coins":299},
	  "name:waiting frog": {"name":"Waiting Frog","coins":299},
	  "name:wakey mallow": {"name":"Wakey Mallow","coins":299},
	  "name:air dancer": {"name":"Air Dancer","coins":300},
	  "name:anniversary cake": {"name":"Anniversary Cake","coins":300},
	  "name:diamond ring of love": {"name":"Diamond ring of love","coins":300},
	  "name:feather mask": {"name":"Feather Mask","coins":300},
	  "name:galaxy's bestest": {"name":"Galaxy's Bestest","coins":300},
	  "name:music shower": {"name":"Music Shower","coins":300},
	  "name:shaun's head": {"name":"Shaun's head","coins":300},
	  "name:summer solstice": {"name":"Summer Solstice","coins":300},
	  "name:surf star": {"name":"Surf Star","coins":300},
	  "name:tambourine": {"name":"Tambourine","coins":300},
	  "name:backing monkey": {"name":"Backing Monkey","coins":349},
	  "name:batwing hat": {"name":"Batwing Hat","coins":349},
	  "name:beach maracas": {"name":"Beach Maracas","coins":349},
	  "name:become kitten": {"name":"Become Kitten","coins":349},
	  "name:butterfly vibe": {"name":"Butterfly Vibe","coins":349},
	  "name:calcaldan": {"name":"Calcaldan","coins":349},
	  "name:canyon bighorn": {"name":"Canyon Bighorn","coins":349},
	  "name:chopin in the rain": {"name":"Chopin in the Rain","coins":349},
	  "name:colorful trailing": {"name":"Colorful Trailing","coins":349},
	  "name:craft dreamer": {"name":"Craft Dreamer","coins":349},
	  "name:djembe master": {"name":"Djembe Master","coins":349},
	  "name:electro vibes": {"name":"Electro Vibes","coins":349},
	  "name:festival bracelet": {"name":"Festival Bracelet","coins":349},
	  "name:gingerbread man": {"name":"Gingerbread Man","coins":349},
	  "name:juicy cap": {"name":"Juicy Cap","coins":349},
	  "name:kitten headband": {"name":"Kitten Headband","coins":349},
	  "name:marked with love": {"name":"Marked with Love","coins":349},
	  "name:mom's bonnet": {"name":"Mom's Bonnet","coins":349},
	  "name:mystic drink": {"name":"Mystic Drink","coins":349},
	  "name:retro headset": {"name":"Retro Headset","coins":349},
	  "name:retro melody": {"name":"Retro Melody","coins":349},
	  "name:rocking shroom": {"name":"Rocking Shroom","coins":349},
	  "name:sparkle pony": {"name":"Sparkle Pony","coins":349},
	  "name:spin seal": {"name":"Spin Seal","coins":349},
	  "name:spring bouquet": {"name":"Spring Bouquet","coins":349},
	  "name:starry seal": {"name":"Starry Seal","coins":349},
	  "name:summer pass m": {"name":"Summer Pass M","coins":349},
	  "name:ukulele player": {"name":"Ukulele Player","coins":349},
	  "name:vintage flight": {"name":"Vintage flight","coins":349},
	  "name:vinyl flip": {"name":"Vinyl Flip","coins":349},
	  "name:singing frogs": {"name":"Singing frogs","coins":398},
	  "name:alien buddy": {"name":"Alien Buddy","coins":399},
	  "name:astronaut koala": {"name":"Astronaut Koala","coins":399},
	  "name:aurora groove": {"name":"Aurora Groove","coins":399},
	  "name:bairam gift box": {"name":"Bairam Gift Box","coins":399},
	  "name:baller": {"name":"Baller","coins":399},
	  "name:bbq": {"name":"BBQ","coins":399},
	  "name:beat wings": {"name":"Beat Wings","coins":399},
	  "name:blossom fairy": {"name":"Blossom Fairy","coins":399},
	  "name:cactus shuffle": {"name":"Cactus Shuffle","coins":399},
	  "name:capibara dance": {"name":"Capibara Dance","coins":399},
	  "name:confetti bear": {"name":"Confetti Bear","coins":399},
	  "name:cotton the seal": {"name":"Cotton the Seal","coins":399},
	  "name:desert survivals": {"name":"Desert Survivals","coins":399},
	  "name:dj set": {"name":"DJ Set","coins":399},
	  "name:dreamy hat": {"name":"Dreamy Hat","coins":399},
	  "name:echo mom": {"name":"Echo Mom","coins":399},
	  "name:fairy locket": {"name":"Fairy Locket","coins":399},
	  "name:fire up": {"name":"Fire up","coins":399},
	  "name:floral serenade": {"name":"Floral Serenade","coins":399},
	  "name:flower flight": {"name":"Flower Flight","coins":399},
	  "name:forever rosa": {"name":"Forever Rosa","coins":399},
	  "name:fortune cat": {"name":"Fortune Cat","coins":399},
	  "name:gaming headset": {"name":"Gaming Headset","coins":399},
	  "name:health potion": {"name":"Health Potion","coins":399},
	  "name:japanese dinner": {"name":"Japanese Dinner","coins":399},
	  "name:jollie the joy bean": {"name":"Jollie the Joy Bean","coins":399},
	  "name:jollie's community": {"name":"Jollie's Community","coins":399},
	  "name:ketupat tree": {"name":"Ketupat Tree","coins":399},
	  "name:kitten kneading": {"name":"Kitten Kneading","coins":399},
	  "name:kuromi head": {"name":"Kuromi Head","coins":399},
	  "name:league boost": {"name":"League Boost","coins":399},
	  "name:let butterfly dances": {"name":"Let butterfly dances","coins":399},
	  "name:lucky cat": {"name":"Lucky Cat","coins":399},
	  "name:magic rhythm": {"name":"Magic Rhythm","coins":399},
	  "name:melody headset": {"name":"Melody Headset","coins":399},
	  "name:open mic": {"name":"Open Mic","coins":399},
	  "name:otter kiss": {"name":"Otter Kiss","coins":399},
	  "name:panda snap": {"name":"Panda Snap","coins":399},
	  "name:papa capybara": {"name":"Papa Capybara","coins":399},
	  "name:pharaoh mask": {"name":"Pharaoh Mask","coins":399},
	  "name:pink cassette": {"name":"Pink Cassette","coins":399},
	  "name:pull rod": {"name":"Pull Rod","coins":399},
	  "name:pumpkin head": {"name":"Pumpkin head","coins":399},
	  "name:ramadan gift box": {"name":"Ramadan Gift Box","coins":399},
	  "name:relaxed goose": {"name":"Relaxed Goose","coins":399},
	  "name:rocket game": {"name":"Rocket Game","coins":399},
	  "name:rocky the rock bean": {"name":"Rocky the Rock Bean","coins":399},
	  "name:rosie the rose bean": {"name":"Rosie the Rose Bean","coins":399},
	  "name:rosie's concert": {"name":"Rosie's Concert","coins":399},
	  "name:rosie's saxophone": {"name":"Rosie's Saxophone","coins":399},
	  "name:sage the smart bean": {"name":"Sage the Smart Bean","coins":399},
	  "name:sage's slash": {"name":"Sage's Slash","coins":399},
	  "name:santa owl surprise": {"name":"Santa Owl Surprise","coins":399},
	  "name:sending luck": {"name":"Sending luck","coins":399},
	  "name:shoot the apple": {"name":"Shoot the Apple","coins":399},
	  "name:sing in sync": {"name":"Sing in Sync","coins":399},
	  "name:singing mic": {"name":"Singing Mic","coins":399},
	  "name:singing sax": {"name":"Singing Sax","coins":399},
	  "name:spartan helmet": {"name":"Spartan Helmet","coins":399},
	  "name:tiger lift": {"name":"Tiger Lift","coins":399},
	  "name:tom's hug": {"name":"Tom's Hug","coins":399},
	  "name:vocal bear": {"name":"Vocal Bear","coins":399},
	  "name:wind on kemenche": {"name":"Wind on Kemenche","coins":399},
	  "name:you are loved": {"name":"You Are Loved","coins":399},
	  "name:bear with rose": {"name":"Bear with Rose","coins":400},
	  "name:bounce speakers": {"name":"Bounce Speakers","coins":400},
	  "name:ceramic": {"name":"Ceramic","coins":400},
	  "name:cheeky pup": {"name":"Cheeky Pup","coins":400},
	  "name:crystal dreams": {"name":"Crystal Dreams","coins":400},
	  "name:dj wave": {"name":"DJ Wave","coins":400},
	  "name:fandom fever": {"name":"FANDOM Fever","coins":400},
	  "name:glorious chef": {"name":"Glorious Chef","coins":400},
	  "name:heartbeat keys": {"name":"Heartbeat Keys","coins":400},
	  "name:judges voting": {"name":"Judges voting","coins":400},
	  "name:magic accordion": {"name":"Magic Accordion","coins":400},
	  "name:mic champ": {"name":"Mic Champ","coins":400},
	  "name:neon rockstar": {"name":"Neon Rockstar","coins":400},
	  "name:pop parrot": {"name":"Pop Parrot","coins":400},
	  "name:punch cuddle": {"name":"Punch Cuddle","coins":400},
	  "name:reindeer milk": {"name":"Reindeer Milk","coins":400},
	  "name:rock cats": {"name":"Rock Cats","coins":400},
	  "name:rock idol": {"name":"Rock Idol","coins":400},
	  "name:siren's echo": {"name":"Siren's Echo","coins":400},
	  "name:snowfall": {"name":"Snowfall","coins":400},
	  "name:super dad": {"name":"Super Dad","coins":400},
	  "name:sweet scoop": {"name":"Sweet Scoop","coins":400},
	  "name:taraxacum corgi": {"name":"Taraxacum Corgi","coins":400},
	  "name:wishing cake": {"name":"Wishing Cake","coins":400},
	  "name:batting cutie": {"name":"Batting Cutie","coins":449},
	  "name:beating heart": {"name":"Beating Heart","coins":449},
	  "name:candy loot": {"name":"Candy Loot","coins":449},
	  "name:captured vocals": {"name":"Captured Vocals","coins":449},
	  "name:clown boogie": {"name":"Clown Boogie","coins":449},
	  "name:cyber strings": {"name":"Cyber Strings","coins":449},
	  "name:electronic love song": {"name":"Electronic Love Song","coins":449},
	  "name:encore clap": {"name":"Encore Clap","coins":449},
	  "name:lightning look": {"name":"Lightning Look","coins":449},
	  "name:lucky hat": {"name":"Lucky Hat","coins":449},
	  "name:meowsic trumpet": {"name":"Meowsic Trumpet","coins":449},
	  "name:pirate's treasure": {"name":"Pirate's Treasure","coins":449},
	  "name:rock and roll": {"name":"Rock and Roll","coins":449},
	  "name:space love": {"name":"Space Love","coins":449},
	  "name:terminator face": {"name":"Terminator Face","coins":449},
	  "name:xmas tree hat": {"name":"Xmas Tree Hat","coins":449},
	  "name:celebration hat": {"name":"Celebration Hat","coins":450},
	  "name:city pop": {"name":"City Pop","coins":450},
	  "name:clover hat": {"name":"Clover Hat","coins":450},
	  "name:cupid koala": {"name":"Cupid Koala","coins":450},
	  "name:fairy mask": {"name":"Fairy Mask","coins":450},
	  "name:fortune kitty": {"name":"Fortune Kitty","coins":450},
	  "name:glow chant": {"name":"Glow Chant","coins":450},
	  "name:groove straw": {"name":"Groove Straw","coins":450},
	  "name:halloween fun hat": {"name":"Halloween Fun Hat","coins":450},
	  "name:hat of joy": {"name":"Hat of Joy","coins":450},
	  "name:music conductor": {"name":"Music Conductor","coins":450},
	  "name:office penguin": {"name":"Office Penguin","coins":450},
	  "name:over the cloud": {"name":"Over the Cloud","coins":450},
	  "name:paw call": {"name":"Paw Call","coins":450},
	  "name:pink cowboy": {"name":"Pink Cowboy","coins":450},
	  "name:powerful mind": {"name":"Powerful Mind","coins":450},
	  "name:sloth peek": {"name":"Sloth Peek","coins":450},
	  "name:steady on the beam": {"name":"Steady on the Beam","coins":450},
	  "name:superwoman": {"name":"Superwoman","coins":450},
	  "name:azura red card": {"name":"Azura red card","coins":499},
	  "name:basket of spring": {"name":"Basket of Spring","coins":499},
	  "name:coral": {"name":"Coral","coins":499},
	  "name:crystal heart": {"name":"Crystal Heart","coins":499},
	  "name:eye on the ball": {"name":"Eye on the Ball","coins":499},
	  "name:fuzzy drum": {"name":"Fuzzy Drum","coins":499},
	  "name:gold microphone": {"name":"Gold Microphone","coins":499},
	  "name:hands up": {"name":"Hands Up","coins":499},
	  "name:im just a hamster": {"name":"Im Just a Hamster","coins":499},
	  "name:key master": {"name":"Key Master","coins":499},
	  "name:lollipop gift box": {"name":"Lollipop Gift Box","coins":499},
	  "name:music": {"name":"Music","coins":499},
	  "name:panda hug": {"name":"Panda Hug","coins":499},
	  "name:pink dress": {"name":"Pink Dress","coins":499},
	  "name:rose soundwave": {"name":"Rose Soundwave","coins":499},
	  "name:sakura corgi": {"name":"Sakura Corgi","coins":499},
	  "name:autumn leaves": {"name":"Autumn Leaves","coins":500},
	  "name:baby chicks": {"name":"Baby Chicks","coins":500},
	  "name:big potato": {"name":"Big Potato","coins":500},
	  "name:bubbles": {"name":"Bubbles","coins":500},
	  "name:bunny crown": {"name":"Bunny Crown","coins":500},
	  "name:bunny hat": {"name":"Bunny Hat","coins":500},
	  "name:capy surf": {"name":"Capy Surf","coins":500},
	  "name:cheeky boo": {"name":"Cheeky Boo","coins":500},
	  "name:cheeky wiggly": {"name":"Cheeky Wiggly","coins":500},
	  "name:couch potato": {"name":"Couch Potato","coins":500},
	  "name:cozy xmas set": {"name":"Cozy Xmas Set","coins":500},
	  "name:cuddle with me": {"name":"Cuddle with Me","coins":500},
	  "name:diamond microphone": {"name":"Diamond Microphone","coins":500},
	  "name:dj glasses": {"name":"DJ Glasses","coins":500},
	  "name:dragon crown": {"name":"Dragon Crown","coins":500},
	  "name:drum genius": {"name":"Drum Genius","coins":500},
	  "name:drum pop": {"name":"Drum Pop","coins":500},
	  "name:durian best friends": {"name":"Durian Best Friends","coins":500},
	  "name:f1 barcelona m": {"name":"F1 Barcelona M","coins":500},
	  "name:fish and chips": {"name":"Fish and Chips","coins":500},
	  "name:flower show": {"name":"Flower Show","coins":500},
	  "name:gem gun": {"name":"Gem Gun","coins":500},
	  "name:go galaxy": {"name":"Go Galaxy","coins":500},
	  "name:goal": {"name":"Goal","coins":500},
	  "name:goldfish": {"name":"Goldfish","coins":500},
	  "name:goldfish scooping": {"name":"Goldfish Scooping","coins":500},
	  "name:halloween ghost": {"name":"Halloween Ghost","coins":500},
	  "name:heart guitar": {"name":"Heart Guitar","coins":500},
	  "name:heart it out": {"name":"Heart It Out","coins":500},
	  "name:heartbeats": {"name":"HeartBeats","coins":500},
	  "name:hena aura": {"name":"Hena Aura","coins":500},
	  "name:henna glow": {"name":"Henna Glow","coins":500},
	  "name:honey strummer": {"name":"Honey Strummer","coins":500},
	  "name:iron anchor": {"name":"Iron Anchor","coins":500},
	  "name:jungle blitzy": {"name":"Jungle Blitzy","coins":500},
	  "name:jungle cooper": {"name":"Jungle Cooper","coins":500},
	  "name:jungle diny": {"name":"Jungle Diny","coins":500},
	  "name:jungle nyota": {"name":"Jungle Nyota","coins":500},
	  "name:jungle tom": {"name":"Jungle Tom","coins":500},
	  "name:lion's mane": {"name":"Lion’s Mane","coins":500},
	  "name:lost in your music": {"name":"Lost in Your Music","coins":500},
	  "name:love balloon": {"name":"Love Balloon","coins":500},
	  "name:magic prop": {"name":"Magic Prop","coins":500},
	  "name:make it rain": {"name":"Make it rain","coins":500},
	  "name:manifesting": {"name":"Manifesting","coins":500},
	  "name:match master": {"name":"Match Master","coins":500},
	  "name:mermaid": {"name":"Mermaid","coins":500},
	  "name:mic drop": {"name":"Mic Drop","coins":500},
	  "name:mighty sweetie": {"name":"Mighty Sweetie","coins":500},
	  "name:money gun": {"name":"Money Gun","coins":500},
	  "name:mystery box": {"name":"Mystery Box","coins":500},
	  "name:out pops jollie!": {"name":"Out Pops Jollie!","coins":500},
	  "name:oyen kebaya": {"name":"Oyen Kebaya","coins":500},
	  "name:pelita": {"name":"Pelita","coins":500},
	  "name:polaris": {"name":"Polaris","coins":500},
	  "name:pot of gold": {"name":"Pot of gold","coins":500},
	  "name:prairie blitzy": {"name":"Prairie Blitzy","coins":500},
	  "name:prairie cooper": {"name":"Prairie Cooper","coins":500},
	  "name:prairie diny": {"name":"Prairie Diny","coins":500},
	  "name:prairie nyota": {"name":"Prairie Nyota","coins":500},
	  "name:prairie tom": {"name":"Prairie Tom","coins":500},
	  "name:prince": {"name":"Prince","coins":500},
	  "name:puyo shower!": {"name":"Puyo Shower!","coins":500},
	  "name:racing helmet": {"name":"Racing Helmet","coins":500},
	  "name:roo mother": {"name":"Roo Mother","coins":500},
	  "name:roses": {"name":"Roses","coins":500},
	  "name:shell of a warrior": {"name":"Shell of a Warrior","coins":500},
	  "name:sound spell": {"name":"Sound Spell","coins":500},
	  "name:star map polaris": {"name":"Star Map Polaris","coins":500},
	  "name:starry fluff": {"name":"Starry Fluff","coins":500},
	  "name:summer of live": {"name":"Summer of LIVE","coins":500},
	  "name:trick or treat!?": {"name":"Trick or Treat!?","coins":500},
	  "name:tricycle": {"name":"Tricycle","coins":500},
	  "name:trophy": {"name":"Trophy","coins":500},
	  "name:vr goggles": {"name":"VR Goggles","coins":500},
	  "name:window basket": {"name":"Window basket","coins":500},
	  "name:xxxl flowers": {"name":"XXXL Flowers","coins":500},
	  "name:you're amazing": {"name":"You’re Amazing","coins":500},
	  "name:bubbly kiss": {"name":"Bubbly Kiss","coins":530},
	  "name:drum hamster": {"name":"Drum Hamster","coins":549},
	  "name:hive escape": {"name":"Hive Escape","coins":549},
	  "name:money magnet": {"name":"Money Magnet","coins":549},
	  "name:fruit box": {"name":"Fruit Box","coins":599},
	  "name:fruit treasure box": {"name":"fruit Treasure Box","coins":599},
	  "name:fully bloomed sakura": {"name":"Fully Bloomed Sakura","coins":599},
	  "name:league trophy": {"name":"League Trophy","coins":599},
	  "name:lucky moon blocks": {"name":"Lucky Moon Blocks","coins":599},
	  "name:ramadan mubarak": {"name":"Ramadan Mubarak","coins":599},
	  "name:rookie king": {"name":"Rookie King","coins":599},
	  "name:shining stars": {"name":"Shining Stars","coins":599},
	  "name:soccer holo": {"name":"Soccer Holo","coins":599},
	  "name:join butterflies": {"name":"Join Butterflies","coins":600},
	  "name:radiant wings": {"name":"Radiant Wings","coins":600},
	  "name:record player": {"name":"Record Player","coins":600},
	  "name:sakura-style dj": {"name":"Sakura-style DJ","coins":600},
	  "name:seahorse pop": {"name":"Seahorse Pop","coins":649},
	  "name:swan": {"name":"Swan","coins":699},
	  "name:basketball trophy": {"name":"Basketball Trophy","coins":700},
	  "name:centre stage": {"name":"Centre Stage","coins":700},
	  "name:colorful wings": {"name":"Colorful Wings","coins":700},
	  "name:cotton candy": {"name":"Cotton Candy","coins":700},
	  "name:hello shaun": {"name":"Hello Shaun","coins":700},
	  "name:sax appeal": {"name":"Sax Appeal","coins":700},
	  "name:sunset in bali": {"name":"Sunset in Bali","coins":799},
	  "name:the van cat": {"name":"The Van Cat","coins":799},
	  "name:zongzi blindbox": {"name":"Zongzi Blindbox","coins":799},
	  "name:bear blind box": {"name":"Bear Blind Box","coins":800},
	  "name:claw machine": {"name":"Claw machine","coins":800},
	  "name:epic pianist": {"name":"Epic Pianist","coins":800},
	  "name:love flight": {"name":"Love Flight","coins":800},
	  "name:penguin": {"name":"Penguin","coins":800},
	  "name:suncatcher": {"name":"Suncatcher","coins":800},
	  "name:beach date": {"name":"Beach Date","coins":899},
	  "name:box of destiny": {"name":"Box of destiny","coins":899},
	  "name:desert camp": {"name":"Desert Camp","coins":899},
	  "name:kindom of night": {"name":"Kindom of Night","coins":899},
	  "name:love u": {"name":"LOVE U","coins":899},
	  "name:ramadan blessings": {"name":"Ramadan Blessings","coins":899},
	  "name:sakura crown": {"name":"Sakura Crown","coins":899},
	  "name:shadow theatre": {"name":"Shadow Theatre","coins":899},
	  "name:sheep joy": {"name":"Sheep Joy","coins":899},
	  "name:stage wiggle": {"name":"Stage Wiggle","coins":899},
	  "name:train": {"name":"Train","coins":899},
	  "name:bearlicious sundae": {"name":"Bearlicious Sundae","coins":900},
	  "name:funky hatter": {"name":"Funky Hatter","coins":900},
	  "name:infinity surge": {"name":"Infinity Surge","coins":900},
	  "name:medium fandom": {"name":"Medium Fandom","coins":900},
	  "name:superstar": {"name":"Superstar","coins":900},
	  "name:brave wing": {"name":"Brave Wing","coins":999},
	  "name:carnival music": {"name":"Carnival Music","coins":999},
	  "name:divine flame": {"name":"Divine Flame","coins":999},
	  "name:enchanted guitar": {"name":"Enchanted Guitar","coins":999},
	  "name:flamingo floaty": {"name":"Flamingo Floaty","coins":999},
	  "name:grand show": {"name":"Grand show","coins":999},
	  "name:hot air balloon": {"name":"Hot Air Balloon","coins":999},
	  "name:kuromi stage": {"name":"Kuromi Stage","coins":999},
	  "name:lucky airdrop box": {"name":"Lucky Airdrop Box","coins":999},
	  "name:music burst": {"name":"Music Burst","coins":999},
	  "name:puyo shuffle!": {"name":"Puyo Shuffle!","coins":999},
	  "name:raining gifts": {"name":"Raining gifts","coins":999},
	  "name:rising dragon": {"name":"Rising Dragon","coins":999},
	  "name:superstriker sage": {"name":"Superstriker Sage","coins":999},
	  "name:travel with you": {"name":"Travel with You","coins":999},
	  "name:trending figure": {"name":"Trending Figure","coins":999},
	  "name:uniform": {"name":"Uniform","coins":999},
	  "name:accelerator crown": {"name":"Accelerator Crown","coins":1000},
	  "name:blooming ribbons": {"name":"Blooming Ribbons","coins":1000},
	  "name:dance with me": {"name":"Dance with me","coins":1000},
	  "name:desert blitzy": {"name":"Desert Blitzy","coins":1000},
	  "name:desert cooper": {"name":"Desert Cooper","coins":1000},
	  "name:desert diny": {"name":"Desert Diny","coins":1000},
	  "name:desert nyota": {"name":"Desert Nyota","coins":1000},
	  "name:desert tom": {"name":"Desert Tom","coins":1000},
	  "name:dinosaur": {"name":"dinosaur","coins":1000},
	  "name:disco ball": {"name":"Disco ball","coins":1000},
	  "name:drums": {"name":"Drums","coins":1000},
	  "name:feather flock": {"name":"Feather Flock","coins":1000},
	  "name:firepit blitzy": {"name":"Firepit Blitzy","coins":1000},
	  "name:firepit cooper": {"name":"Firepit Cooper","coins":1000},
	  "name:firepit diny": {"name":"Firepit Diny","coins":1000},
	  "name:firepit nyota": {"name":"Firepit Nyota","coins":1000},
	  "name:firepit tom": {"name":"Firepit Tom","coins":1000},
	  "name:flamingo groove": {"name":"Flamingo Groove","coins":1000},
	  "name:frozen": {"name":"Frozen","coins":1000},
	  "name:galaxy": {"name":"Galaxy","coins":1000},
	  "name:gerry the giraffe": {"name":"Gerry the Giraffe","coins":1000},
	  "name:giraffe": {"name":"Giraffe","coins":1000},
	  "name:glowing jellyfish": {"name":"Glowing Jellyfish","coins":1000},
	  "name:gold mine": {"name":"Gold Mine","coins":1000},
	  "name:hunting dog": {"name":"Hunting Dog","coins":1000},
	  "name:infinity gold": {"name":"Infinity Gold","coins":1000},
	  "name:iron rod": {"name":"Iron Rod","coins":1000},
	  "name:la route 66": {"name":"LA Route 66","coins":1000},
	  "name:lightning your world": {"name":"Lightning your world","coins":1000},
	  "name:live pro badge": {"name":"LIVE Pro Badge","coins":1000},
	  "name:magic cat": {"name":"Magic Cat","coins":1000},
	  "name:magic potion": {"name":"Magic Potion","coins":1000},
	  "name:match drum": {"name":"Match Drum","coins":1000},
	  "name:matchtacular!": {"name":"Matchtacular!","coins":1000},
	  "name:picnic basket": {"name":"Picnic basket","coins":1000},
	  "name:shiny air balloon": {"name":"Shiny Air Balloon","coins":1000},
	  "name:silver sports car": {"name":"Silver Sports Car","coins":1000},
	  "name:sparkle dance": {"name":"Sparkle Dance","coins":1000},
	  "name:spring picnic": {"name":"Spring Picnic","coins":1000},
	  "name:summer glass": {"name":"Summer Glass","coins":1000},
	  "name:summer picnic": {"name":"Summer Picnic","coins":1000},
	  "name:super live star": {"name":"Super LIVE Star","coins":1000},
	  "name:super star": {"name":"Super Star","coins":1000},
	  "name:the magic lamp": {"name":"The Magic Lamp","coins":1000},
	  "name:tundra blitzy": {"name":"Tundra Blitzy","coins":1000},
	  "name:tundra cooper": {"name":"Tundra Cooper","coins":1000},
	  "name:tundra diny": {"name":"Tundra Diny","coins":1000},
	  "name:tundra nyota": {"name":"Tundra Nyota","coins":1000},
	  "name:tundra tom": {"name":"Tundra Tom","coins":1000},
	  "name:watermelon love": {"name":"Watermelon Love","coins":1000},
	  "name:watermelon party": {"name":"Watermelon Party","coins":1000},
	  "name:waterslide": {"name":"Waterslide","coins":1000},
	  "name:worship me": {"name":"Worship Me","coins":1000},
	  "name:candy puffs": {"name":"Candy Puffs","coins":1030},
	  "name:joy floats": {"name":"Joy Floats","coins":1030},
	  "name:pumpkin carriage": {"name":"Pumpkin Carriage","coins":1031},
	  "name:diamond tree": {"name":"Diamond Tree","coins":1088},
	  "name:fireworks": {"name":"Fireworks","coins":1088},
	  "name:magic role": {"name":"Magic Role","coins":1088},
	  "name:diamond": {"name":"Diamond","coins":1099},
	  "name:exclusive spark": {"name":"Exclusive Spark","coins":1099},
	  "name:golden stars": {"name":"Golden Stars","coins":1099},
	  "name:arcade game": {"name":"Arcade Game","coins":1200},
	  "name:bunny dj": {"name":"Bunny DJ","coins":1200},
	  "name:fountain": {"name":"Fountain","coins":1200},
	  "name:gaming chair": {"name":"Gaming Chair","coins":1200},
	  "name:gingerbread party": {"name":"Gingerbread Party","coins":1200},
	  "name:love shelter": {"name":"Love Shelter","coins":1200},
	  "name:paddington snow": {"name":"Paddington Snow","coins":1200},
	  "name:spooky cat": {"name":"Spooky Cat","coins":1200},
	  "name:starlight sceptre": {"name":"Starlight Sceptre","coins":1200},
	  "name:take a drive": {"name":"Take a Drive","coins":1200},
	  "name:travel in the us": {"name":"Travel in the US","coins":1200},
	  "name:umbrella of love": {"name":"Umbrella of Love","coins":1200},
	  "name:frozen magic": {"name":"Frozen Magic","coins":1299},
	  "name:hydrangea sea": {"name":"Hydrangea Sea","coins":1299},
	  "name:spider web": {"name":"Spider Web","coins":1299},
	  "name:spider web 2.0": {"name":"Spider Web 2.0","coins":1299},
	  "name:autumn picnic": {"name":"Autumn Picnic","coins":1300},
	  "name:party laser": {"name":"Party Laser","coins":1300},
	  "name:moonlight flower": {"name":"Moonlight flower","coins":1400},
	  "name:streamer's setup": {"name":"Streamer’s Setup","coins":1400},
	  "name:vibrant stage": {"name":"Vibrant Stage","coins":1400},
	  "name:diamond crown": {"name":"Diamond Crown","coins":1499},
	  "name:a spark": {"name":"A Spark","coins":1500},
	  "name:astrobear": {"name":"Astrobear","coins":1500},
	  "name:champions' cup": {"name":"Champions' Cup","coins":1500},
	  "name:chasing the dream": {"name":"Chasing the Dream","coins":1500},
	  "name:cherry blossoms": {"name":"Cherry Blossoms","coins":1500},
	  "name:costumey christmas": {"name":"Costumey Christmas","coins":1500},
	  "name:diamond ring": {"name":"Diamond Ring","coins":1500},
	  "name:ewc trophy": {"name":"EWC Trophy","coins":1500},
	  "name:future encounter": {"name":"Future Encounter","coins":1500},
	  "name:galaxy globe": {"name":"Galaxy Globe","coins":1500},
	  "name:greeting card": {"name":"Greeting Card","coins":1500},
	  "name:hit the net": {"name":"Hit the Net","coins":1500},
	  "name:ignition check": {"name":"Ignition Check","coins":1500},
	  "name:level ship": {"name":"Level Ship","coins":1500},
	  "name:love explosion": {"name":"Love Explosion","coins":1500},
	  "name:lover's lock": {"name":"Lover’s Lock","coins":1500},
	  "name:merry go boo": {"name":"Merry Go Boo","coins":1500},
	  "name:merry spongemas": {"name":"Merry Spongemas","coins":1500},
	  "name:pim bear": {"name":"Pim Bear","coins":1500},
	  "name:potato eating spaghetti": {"name":"Potato eating spaghetti","coins":1500},
	  "name:potato floating": {"name":"Potato floating","coins":1500},
	  "name:racing debut": {"name":"Racing Debut","coins":1500},
	  "name:raya gift card": {"name":"Raya Gift Card","coins":1500},
	  "name:space cat": {"name":"Space Cat","coins":1500},
	  "name:spotlight": {"name":"Spotlight","coins":1500},
	  "name:time warp": {"name":"Time Warp","coins":1500},
	  "name:treasure chest": {"name":"Treasure Chest","coins":1500},
	  "name:twirl & treat": {"name":"Twirl & Treat","coins":1500},
	  "name:under control": {"name":"Under Control","coins":1500},
	  "name:valentine cake": {"name":"Valentine Cake","coins":1500},
	  "name:viking hammer": {"name":"Viking Hammer","coins":1500},
	  "name:wedding": {"name":"Wedding","coins":1500},
	  "name:wild mic": {"name":"Wild Mic","coins":1500},
	  "name:you're so fly": {"name":"You're So Fly","coins":1500},
	  "name:shooting stars": {"name":"Shooting Stars","coins":1580},
	  "name:asmr starter kit": {"name":"ASMR Starter Kit","coins":1599},
	  "name:blooming heart": {"name":"Blooming Heart","coins":1599},
	  "name:penlight": {"name":"Penlight","coins":1599},
	  "name:hug it better": {"name":"Hug It Better","coins":1600},
	  "name:lovely ride": {"name":"Lovely Ride","coins":1600},
	  "name:crystal ball": {"name":"Crystal Ball","coins":1700},
	  "name:center stage": {"name":"Center Stage","coins":1799},
	  "name:here we go": {"name":"Here We Go","coins":1799},
	  "name:fox legend": {"name":"Fox Legend","coins":1800},
	  "name:jeepney": {"name":"Jeepney","coins":1800},
	  "name:love drop": {"name":"Love Drop","coins":1800},
	  "name:nine-tailed fox": {"name":"Nine-Tailed Fox","coins":1800},
	  "name:potato to fries": {"name":"Potato to Fries","coins":1800},
	  "name:watch out": {"name":"Watch out","coins":1800},
	  "name:new year table": {"name":"New Year Table","coins":1899},
	  "name:airship": {"name":"Airship","coins":1999},
	  "name:beach cabin": {"name":"Beach Cabin","coins":1999},
	  "name:bida bida": {"name":"Bida Bida","coins":1999},
	  "name:blessing box": {"name":"Blessing Box","coins":1999},
	  "name:cable car": {"name":"Cable Car","coins":1999},
	  "name:carousel": {"name":"Carousel","coins":1999},
	  "name:catch the harvest": {"name":"Catch the Harvest","coins":1999},
	  "name:cooper flies home": {"name":"Cooper Flies Home","coins":1999},
	  "name:doll new year greeting": {"name":"Doll New Year Greeting","coins":1999},
	  "name:fall candle": {"name":"Fall Candle","coins":1999},
	  "name:getting ready": {"name":"Getting Ready","coins":1999},
	  "name:gift box": {"name":"Gift Box","coins":1999},
	  "name:let us dance": {"name":"Let Us Dance","coins":1999},
	  "name:mystery firework": {"name":"Mystery Firework","coins":1999},
	  "name:puppy sleepover": {"name":"Puppy Sleepover","coins":1999},
	  "name:ramadan blessing box": {"name":"Ramadan Blessing Box","coins":1999},
	  "name:ramadan lantern": {"name":"Ramadan Lantern","coins":1999},
	  "name:rilakkuma dance": {"name":"Rilakkuma Dance","coins":1999},
	  "name:star of red carpet": {"name":"Star of Red Carpet","coins":1999},
	  "name:wonder strikes": {"name":"Wonder Strikes","coins":1999},
	  "name:azura figurine": {"name":"Azura figurine","coins":2000},
	  "name:baby dragon": {"name":"Baby Dragon","coins":2000},
	  "name:club": {"name":"Club","coins":2000},
	  "name:club music": {"name":"Club Music","coins":2000},
	  "name:cooper picnic": {"name":"Cooper Picnic","coins":2000},
	  "name:crystal crown": {"name":"Crystal Crown","coins":2000},
	  "name:power couple": {"name":"Power Couple","coins":2000},
	  "name:ribbit ribbit": {"name":"Ribbit Ribbit","coins":2000},
	  "name:sky drift": {"name":"Sky Drift","coins":2000},
	  "name:take my rose!": {"name":"Take My Rose!","coins":2000},
	  "name:vacation live": {"name":"Vacation LIVE","coins":2000},
	  "name:victory warp gate": {"name":"Victory Warp Gate","coins":2000},
	  "name:celebrate 2025": {"name":"Celebrate 2025","coins":2025},
	  "name:extravaganza 2025": {"name":"Extravaganza 2025","coins":2025},
	  "name:whale diving": {"name":"Whale Diving","coins":2150},
	  "name:blow rosie kisses": {"name":"Blow Rosie Kisses","coins":2199},
	  "name:jetski": {"name":"Jetski","coins":2199},
	  "name:jollie's heartland": {"name":"Jollie's Heartland","coins":2199},
	  "name:lemon love booth": {"name":"Lemon Love Booth","coins":2199},
	  "name:rocky's punch": {"name":"Rocky's Punch","coins":2199},
	  "name:sage's coinbot": {"name":"Sage's Coinbot","coins":2199},
	  "name:dancing capybaras": {"name":"Dancing Capybaras","coins":2200},
	  "name:dragon boat": {"name":"Dragon Boat","coins":2200},
	  "name:haunted house": {"name":"Haunted house","coins":2200},
	  "name:romanian train": {"name":"Romanian train","coins":2200},
	  "name:ski star": {"name":"SKI STAR","coins":2200},
	  "name:stargazing": {"name":"Stargazing","coins":2200},
	  "name:stars honor": {"name":"Stars Honor","coins":2200},
	  "name:wave lights": {"name":"Wave Lights","coins":2200},
	  "name:by the glaziers": {"name":"By the Glaziers","coins":2380},
	  "name:summer pass l": {"name":"Summer Pass L","coins":2499},
	  "name:tom thunderfoot": {"name":"Tom Thunderfoot","coins":2499},
	  "name:unicorn": {"name":"Unicorn","coins":2499},
	  "name:animal band": {"name":"Animal Band","coins":2500},
	  "name:fandom cheer": {"name":"FANDOM Cheer","coins":2500},
	  "name:space dog": {"name":"Space Dog","coins":2500},
	  "name:magic stage": {"name":"Magic Stage","coins":2599},
	  "name:brown bear": {"name":"Brown Bear","coins":2800},
	  "name:celebration tape": {"name":"Celebration Tape","coins":2800},
	  "name:crownfish": {"name":"Crownfish","coins":2800},
	  "name:hiking oyen": {"name":"Hiking Oyen","coins":2800},
	  "name:stroke me": {"name":"Stroke Me","coins":2800},
	  "name:samfaring tom": {"name":"Samfaring Tom","coins":2850},
	  "name:cupid": {"name":"Cupid","coins":2888},
	  "name:bobo the clownfish": {"name":"Bobo the Clownfish","coins":2988},
	  "name:ice cream truck": {"name":"Ice Cream Truck","coins":2988},
	  "name:motorcycle": {"name":"Motorcycle","coins":2988},
	  "name:music live": {"name":"Music Live","coins":2988},
	  "name:pink dream": {"name":"Pink Dream","coins":2988},
	  "name:beach day": {"name":"Beach Day","coins":2999},
	  "name:beacon": {"name":"Beacon","coins":2999},
	  "name:bull": {"name":"Bull","coins":2999},
	  "name:community rally": {"name":"Community Rally","coins":2999},
	  "name:fame stairs": {"name":"Fame Stairs","coins":2999},
	  "name:fest party": {"name":"Fest Party","coins":2999},
	  "name:grand prix stage": {"name":"Grand Prix Stage","coins":2999},
	  "name:heart balloon": {"name":"Heart Balloon","coins":2999},
	  "name:houdini": {"name":"Houdini","coins":2999},
	  "name:jacaranda season": {"name":"Jacaranda Season","coins":2999},
	  "name:legends scroll": {"name":"Legends Scroll","coins":2999},
	  "name:lenossa's community cake": {"name":"lenossa's Community Cake","coins":2999},
	  "name:level-up spotlight": {"name":"Level-up Spotlight","coins":2999},
	  "name:live ranking medal": {"name":"LIVE Ranking Medal","coins":2999},
	  "name:love in sunset": {"name":"Love in Sunset","coins":2999},
	  "name:love lake": {"name":"Love Lake","coins":2999},
	  "name:lovely surprise": {"name":"Lovely Surprise","coins":2999},
	  "name:match maniac": {"name":"Match Maniac","coins":2999},
	  "name:ocelot chase": {"name":"Ocelot Chase","coins":2999},
	  "name:old famous car": {"name":"Old Famous Car","coins":2999},
	  "name:party bus": {"name":"Party Bus","coins":2999},
	  "name:ray serenade": {"name":"Ray Serenade","coins":2999},
	  "name:rhythmic bear": {"name":"Rhythmic Bear","coins":2999},
	  "name:ring of honor-cube": {"name":"Ring Of Honor-Cube","coins":2999},
	  "name:rosie on stage": {"name":"Rosie on Stage","coins":2999},
	  "name:shining stage": {"name":"Shining Stage","coins":2999},
	  "name:surprise baby mob": {"name":"Surprise Baby Mob","coins":2999},
	  "name:balik kampung": {"name":"Balik Kampung","coins":3000},
	  "name:car drifting": {"name":"Car Drifting","coins":3000},
	  "name:dancing bears": {"name":"Dancing Bears","coins":3000},
	  "name:meteor shower": {"name":"Meteor Shower","coins":3000},
	  "name:rainbow combining": {"name":"Rainbow Combining","coins":3000},
	  "name:rotary backpack": {"name":"Rotary Backpack","coins":3000},
	  "name:summoning horn": {"name":"Summoning Horn","coins":3000},
	  "name:tiny diny surfing": {"name":"Tiny Diny Surfing","coins":3000},
	  "name:water buffalo": {"name":"Water Buffalo","coins":3000},
	  "name:sea blitzy": {"name":"Sea Blitzy","coins":3088},
	  "name:sea cooper": {"name":"Sea Cooper","coins":3088},
	  "name:sea diny": {"name":"Sea Diny","coins":3088},
	  "name:sea nyota": {"name":"Sea Nyota","coins":3088},
	  "name:sea tom": {"name":"Sea Tom","coins":3088},
	  "name:summer vibes": {"name":"Summer Vibes","coins":3188},
	  "name:hip-hop hen": {"name":"Hip-Hop Hen","coins":3200},
	  "name:dream big": {"name":"Dream Big","coins":3350},
	  "name:look up": {"name":"Look Up","coins":3350},
	  "name:advancing planet": {"name":"Advancing Planet","coins":3999},
	  "name:giant": {"name":"Giant","coins":3999},
	  "name:go home": {"name":"Go Home","coins":3999},
	  "name:live ranking party": {"name":"LIVE Ranking Party","coins":3999},
	  "name:show time": {"name":"Show Time","coins":3999},
	  "name:soaring spirit": {"name":"Soaring Spirit","coins":3999},
	  "name:summer time": {"name":"Summer Time","coins":3999},
	  "name:sumo cat": {"name":"Sumo Cat","coins":3999},
	  "name:t-rex skeleton pup": {"name":"T-Rex skeleton pup","coins":3999},
	  "name:city of dreams": {"name":"City of Dreams","coins":4000},
	  "name:cloud dj": {"name":"Cloud DJ","coins":4000},
	  "name:firelight beast": {"name":"Firelight Beast","coins":4000},
	  "name:gaming keyboard": {"name":"Gaming Keyboard","coins":4000},
	  "name:island of love": {"name":"Island of Love","coins":4000},
	  "name:midsummer fest": {"name":"Midsummer Fest","coins":4000},
	  "name:nightshade beast": {"name":"Nightshade Beast","coins":4000},
	  "name:tiktok volcano": {"name":"TikTok Volcano","coins":4000},
	  "name:tiny diny on the drums": {"name":"Tiny Diny on the Drums","coins":4000},
	  "name:vase": {"name":"Vase","coins":4000},
	  "name:whitewind beast": {"name":"Whitewind Beast","coins":4000},
	  "name:cooper's curry": {"name":"Cooper’s Curry","coins":4088},
	  "name:gorilla explorer": {"name":"Gorilla Explorer","coins":4088},
	  "name:knight": {"name":"Knight","coins":4088},
	  "name:magic world": {"name":"Magic World","coins":4088},
	  "name:pride superstar": {"name":"Pride Superstar","coins":4088},
	  "name:shine bright": {"name":"Shine Bright","coins":4088},
	  "name:next level": {"name":"Next Level","coins":4099},
	  "name:tractor": {"name":"Tractor","coins":4099},
	  "name:your concert": {"name":"Your Concert","coins":4500},
	  "name:dynamic music": {"name":"Dynamic Music","coins":4888},
	  "name:fiery dragon": {"name":"Fiery Dragon","coins":4888},
	  "name:leon the kitten": {"name":"Leon the Kitten","coins":4888},
	  "name:private jet": {"name":"Private Jet","coins":4888},
	  "name:signature jet": {"name":"Signature Jet","coins":4888},
	  "name:sugar whiskers": {"name":"Sugar Whiskers","coins":4918},
	  "name:benny the calf": {"name":"Benny the Calf","coins":4999},
	  "name:camel's love": {"name":"Camel's Love","coins":4999},
	  "name:eid ma'amoul": {"name":"Eid Ma'amoul","coins":4999},
	  "name:guardian's pledge": {"name":"Guardian's Pledge","coins":4999},
	  "name:hero space ship": {"name":"Hero Space Ship","coins":4999},
	  "name:knock out": {"name":"Knock Out","coins":4999},
	  "name:sage's venture": {"name":"Sage’s Venture","coins":4999},
	  "name:sports car": {"name":"Sports Car","coins":4999},
	  "name:stage of ring": {"name":"Stage of ring","coins":4999},
	  "name:stage of spiderman": {"name":"Stage of SpiderMan","coins":4999},
	  "name:the trial of sea": {"name":"The Trial of Sea","coins":4999},
	  "name:tom's love": {"name":"Tom's Love","coins":4999},
	  "name:1st anniversary": {"name":"1st Anniversary","coins":5000},
	  "name:a farm for you": {"name":"A Farm for You","coins":5000},
	  "name:aqua gun": {"name":"Aqua Gun","coins":5000},
	  "name:arcane card": {"name":"Arcane Card","coins":5000},
	  "name:beach hut": {"name":"Beach Hut","coins":5000},
	  "name:big fandom": {"name":"Big Fandom","coins":5000},
	  "name:bird whisperer": {"name":"Bird Whisperer","coins":5000},
	  "name:chopin's nocturne": {"name":"Chopin's Nocturne","coins":5000},
	  "name:community power": {"name":"Community Power","coins":5000},
	  "name:crowd cheering": {"name":"Crowd Cheering","coins":5000},
	  "name:desert wolf": {"name":"Desert Wolf","coins":5000},
	  "name:diamond gun": {"name":"Diamond Gun","coins":5000},
	  "name:dj alien": {"name":"DJ Alien","coins":5000},
	  "name:dj i'm blue": {"name":"DJ I'm blue","coins":5000},
	  "name:ellie the elephant": {"name":"Ellie the Elephant","coins":5000},
	  "name:flying jets": {"name":"Flying Jets","coins":5000},
	  "name:four king": {"name":"Four King","coins":5000},
	  "name:gamer's eve": {"name":"Gamer's EVE","coins":5000},
	  "name:jack the pirate": {"name":"Jack the Pirate","coins":5000},
	  "name:league fandom": {"name":"League Fandom","coins":5000},
	  "name:leon's sigil cape": {"name":"Leon's Sigil Cape","coins":5000},
	  "name:live on holiday": {"name":"LIVE on holiday","coins":5000},
	  "name:master's crown": {"name":"Master's Crown","coins":5000},
	  "name:mystic rod": {"name":"Mystic Rod","coins":5000},
	  "name:ramadan vibes": {"name":"Ramadan Vibes","coins":5000},
	  "name:raya vibes": {"name":"Raya Vibes","coins":5000},
	  "name:seaside romance": {"name":"Seaside Romance","coins":5000},
	  "name:spirits up": {"name":"Spirits Up","coins":5000},
	  "name:unicorn fantasy": {"name":"Unicorn Fantasy","coins":5000},
	  "name:victory realm": {"name":"Victory Realm","coins":5000},
	  "name:victory wing": {"name":"Victory Wing","coins":5000},
	  "name:wanda the witch": {"name":"Wanda the Witch","coins":5000},
	  "name:yurt": {"name":"Yurt","coins":5000},
	  "name:ice cream machine": {"name":"Ice Cream Machine","coins":5288},
	  "name:fluffy buddies": {"name":"Fluffy Buddies","coins":5388},
	  "name:wolf": {"name":"Wolf","coins":5500},
	  "name:cub on clouds": {"name":"Cub on Clouds","coins":5888},
	  "name:valiant odyssey": {"name":"Valiant Odyssey","coins":5888},
	  "name:devoted heart": {"name":"Devoted Heart","coins":5999},
	  "name:my dream stage": {"name":"My Dream Stage","coins":5999},
	  "name:boo crew": {"name":"Boo Crew","coins":6000},
	  "name:chick stampede": {"name":"Chick Stampede","coins":6000},
	  "name:down we squish!": {"name":"Down We Squish!","coins":6000},
	  "name:elephant nature reserve": {"name":"Elephant Nature Reserve","coins":6000},
	  "name:future city": {"name":"Future City","coins":6000},
	  "name:goal highlight": {"name":"Goal Highlight","coins":6000},
	  "name:goal highlight-ca": {"name":"Goal Highlight-CA","coins":6000},
	  "name:goal highlight-us": {"name":"Goal Highlight-US","coins":6000},
	  "name:hands up high": {"name":"Hands up High","coins":6000},
	  "name:homecoming ode": {"name":"Homecoming Ode","coins":6000},
	  "name:kite riding": {"name":"Kite Riding","coins":6000},
	  "name:patrick's prezzie": {"name":"Patrick's Prezzie","coins":6000},
	  "name:peek-a-boo": {"name":"Peek-a-Boo","coins":6000},
	  "name:romance blossoms": {"name":"Romance Blossoms","coins":6000},
	  "name:rust reforged": {"name":"Rust Reforged","coins":6000},
	  "name:sam in new city": {"name":"Sam in New City","coins":6000},
	  "name:star beach": {"name":"Star Beach","coins":6000},
	  "name:strike a pose": {"name":"Strike a Pose","coins":6000},
	  "name:strong finish": {"name":"Strong Finish","coins":6000},
	  "name:with you": {"name":"With you","coins":6000},
	  "name:work hard play harder": {"name":"Work Hard Play Harder","coins":6000},
	  "name:zombie swarm": {"name":"Zombie Swarm","coins":6000},
	  "name:lili the leopard": {"name":"Lili the Leopard","coins":6599},
	  "name:tiktok red carpet": {"name":"TikTok Red Carpet","coins":6600},
	  "name:beast": {"name":"Beast","coins":6999},
	  "name:birthday party": {"name":"Birthday Party","coins":6999},
	  "name:celebration time": {"name":"Celebration Time","coins":6999},
	  "name:crescent sighting": {"name":"Crescent Sighting","coins":6999},
	  "name:happy party": {"name":"Happy Party","coins":6999},
	  "name:last riff roar": {"name":"Last Riff Roar","coins":6999},
	  "name:merry crust-mas": {"name":"Merry Crust-mas","coins":6999},
	  "name:ramadan night": {"name":"Ramadan Night","coins":6999},
	  "name:süper davulu": {"name":"Süper Davulu","coins":6999},
	  "name:2nd anniversary": {"name":"2nd Anniversary","coins":7000},
	  "name:black swan": {"name":"Black Swan","coins":7000},
	  "name:illumination": {"name":"Illumination","coins":7000},
	  "name:majestic hearts": {"name":"Majestic Hearts","coins":7238},
	  "name:dune car": {"name":"Dune Car","coins":7700},
	  "name:go big alpha drifter": {"name":"Go Big Alpha Drifter","coins":7700},
	  "name:alishan train": {"name":"Alishan Train","coins":7999},
	  "name:diamond shield": {"name":"Diamond Shield","coins":7999},
	  "name:leon in gondola": {"name":"Leon in Gondola","coins":7999},
	  "name:leon's journey": {"name":"Leon’s Journey","coins":7999},
	  "name:lily and hydrangea": {"name":"Lily and Hydrangea","coins":7999},
	  "name:monster truck": {"name":"Monster Truck","coins":7999},
	  "name:star throne": {"name":"Star Throne","coins":7999},
	  "name:summer fuji mountain": {"name":"Summer Fuji Mountain","coins":7999},
	  "name:bird of paradise": {"name":"Bird of Paradise","coins":8000},
	  "name:chichen itza": {"name":"Chichen Itza","coins":8000},
	  "name:honey heroic": {"name":"Honey HEROIC","coins":8000},
	  "name:maiden tower": {"name":"Maiden Tower","coins":8000},
	  "name:safari park": {"name":"Safari Park","coins":8000},
	  "name:ultimate fandom": {"name":"Ultimate FANDOM","coins":8000},
	  "name:stormwave armor": {"name":"Stormwave Armor","coins":8999},
	  "name:saxophone": {"name":"Saxophone","coins":9000},
	  "name:space jet": {"name":"Space Jet","coins":9000},
	  "name:wealth haven": {"name":"Wealth Haven","coins":9000},
	  "name:leon and lili": {"name":"Leon and Lili","coins":9699},
	  "name:beach house": {"name":"Beach House","coins":9999},
	  "name:desert glory": {"name":"Desert Glory","coins":9999},
	  "name:santa town": {"name":"Santa Town","coins":9999},
	  "name:big guy's ride": {"name":"Big Guy's Ride","coins":10000},
	  "name:crystal rod": {"name":"Crystal Rod","coins":10000},
	  "name:festival flags": {"name":"Festival Flags","coins":10000},
	  "name:henry": {"name":"Henry","coins":10000},
	  "name:interstellar": {"name":"Interstellar","coins":10000},
	  "name:luxury yacht": {"name":"Luxury Yacht","coins":10000},
	  "name:octopus": {"name":"Octopus","coins":10000},
	  "name:polar bear": {"name":"Polar Bear","coins":10000},
	  "name:sunset speedway": {"name":"Sunset Speedway","coins":10000},
	  "name:falcon": {"name":"Falcon","coins":10999},
	  "name:holiday leon": {"name":"Holiday Leon","coins":10999},
	  "name:verified glider": {"name":"Verified Glider","coins":10999},
	  "name:match arena": {"name":"Match Arena","coins":11000},
	  "name:3rd anniversary": {"name":"3rd Anniversary","coins":12000},
	  "name:aurora": {"name":"Aurora","coins":12000},
	  "name:aurora borealis": {"name":"Aurora Borealis","coins":12000},
	  "name:black bear": {"name":"Black Bear","coins":12000},
	  "name:convertible": {"name":"Convertible","coins":12000},
	  "name:convertible car": {"name":"Convertible Car","coins":12000},
	  "name:emerald prince": {"name":"Emerald Prince","coins":12000},
	  "name:gimme the mic": {"name":"Gimme The Mic","coins":12000},
	  "name:into the stadium": {"name":"Into the Stadium","coins":12000},
	  "name:lili and sakura": {"name":"Lili and Sakura","coins":12000},
	  "name:prime power 2025": {"name":"Prime Power 2025","coins":12000},
	  "name:race car": {"name":"Race Car","coins":12000},
	  "name:rilakkuma's summer vacation": {"name":"Rilakkuma's summer vacation","coins":12000},
	  "name:tiktok flight": {"name":"TikTok Flight","coins":12000},
	  "name:tiny diny show": {"name":"Tiny Diny Show","coins":12000},
	  "name:white wolf": {"name":"White Wolf","coins":12000},
	  "name:legend rider": {"name":"Legend Rider","coins":12999},
	  "name:level-up spectacle": {"name":"Level-up Spectacle","coins":12999},
	  "name:kangaroo": {"name":"Kangaroo","coins":13500},
	  "name:summer pass xl": {"name":"Summer Pass XL","coins":13500},
	  "name:voyage on": {"name":"Voyage On","coins":13500},
	  "name:corgi and night cherry": {"name":"Corgi and Night Cherry","coins":13999},
	  "name:daylight debut": {"name":"Daylight Debut","coins":13999},
	  "name:spaceship": {"name":"Spaceship","coins":13999},
	  "name:chrono rewinder": {"name":"Chrono Rewinder","coins":14999},
	  "name:crown world": {"name":"Crown World","coins":14999},
	  "name:fans cheering": {"name":"Fans Cheering","coins":14999},
	  "name:fate sphere": {"name":"Fate Sphere","coins":14999},
	  "name:holy arc": {"name":"Holy Arc","coins":14999},
	  "name:interstellar trek": {"name":"Interstellar Trek","coins":14999},
	  "name:invincible hammer": {"name":"Invincible Hammer","coins":14999},
	  "name:lucky crown": {"name":"Lucky Crown","coins":14999},
	  "name:proof of the king": {"name":"Proof of the King","coins":14999},
	  "name:scythe of justice": {"name":"Scythe of Justice","coins":14999},
	  "name:snowmoon parasol": {"name":"Snowmoon Parasol","coins":14999},
	  "name:storm blade": {"name":"Storm Blade","coins":14999},
	  "name:tidecaller trident": {"name":"Tidecaller Trident","coins":14999},
	  "name:arabian cheetah": {"name":"Arabian Cheetah","coins":15000},
	  "name:arabian stallion": {"name":"Arabian Stallion","coins":15000},
	  "name:battle champion": {"name":"Battle Champion","coins":15000},
	  "name:beach pier": {"name":"Beach Pier","coins":15000},
	  "name:black wolf": {"name":"Black Wolf","coins":15000},
	  "name:boo town": {"name":"Boo Town","coins":15000},
	  "name:boo's town": {"name":"Boo's Town","coins":15000},
	  "name:bran castle": {"name":"Bran Castle","coins":15000},
	  "name:carpathian deer": {"name":"Carpathian Deer","coins":15000},
	  "name:champion stage": {"name":"Champion Stage","coins":15000},
	  "name:cheetah": {"name":"Cheetah","coins":15000},
	  "name:community support": {"name":"Community Support","coins":15000},
	  "name:diamond stage": {"name":"Diamond Stage","coins":15000},
	  "name:dj peak": {"name":"DJ Peak","coins":15000},
	  "name:dream ride": {"name":"Dream Ride","coins":15000},
	  "name:f1 austin l": {"name":"F1 Austin L","coins":15000},
	  "name:firelight kingdom": {"name":"Firelight Kingdom","coins":15000},
	  "name:flame towers": {"name":"Flame Towers","coins":15000},
	  "name:food fair": {"name":"Food Fair","coins":15000},
	  "name:future journey": {"name":"Future Journey","coins":15000},
	  "name:gaming console": {"name":"Gaming Console","coins":15000},
	  "name:go big sky rush": {"name":"Go Big Sky Rush","coins":15000},
	  "name:go big stallion": {"name":"Go Big Stallion","coins":15000},
	  "name:golden gallop": {"name":"Golden Gallop","coins":15000},
	  "name:great barrier reef": {"name":"Great Barrier Reef","coins":15000},
	  "name:harbour bridge": {"name":"Harbour Bridge","coins":15000},
	  "name:infinity hall": {"name":"Infinity Hall","coins":15000},
	  "name:jeju island": {"name":"Jeju Island","coins":15000},
	  "name:legendary aegis": {"name":"Legendary Aegis","coins":15000},
	  "name:leopard": {"name":"Leopard","coins":15000},
	  "name:live nations cup": {"name":"LIVE NATIONS CUP","coins":15000},
	  "name:look! meteor shower": {"name":"Look! Meteor Shower","coins":15000},
	  "name:madrid": {"name":"Madrid","coins":15000},
	  "name:mammoth": {"name":"Mammoth","coins":15000},
	  "name:maro spider man": {"name":"Maro Spider Man","coins":15000},
	  "name:mystery stalker": {"name":"Mystery Stalker","coins":15000},
	  "name:nightshade kingdom": {"name":"Nightshade Kingdom","coins":15000},
	  "name:paris": {"name":"Paris","coins":15000},
	  "name:party on&on": {"name":"Party On&On","coins":15000},
	  "name:peacock": {"name":"peacock","coins":15000},
	  "name:philippine eagle": {"name":"Philippine Eagle","coins":15000},
	  "name:pirate's ship": {"name":"Pirate’s Ship","coins":15000},
	  "name:pk star": {"name":"PK star","coins":15000},
	  "name:pyramids": {"name":"Pyramids","coins":15000},
	  "name:riyadh": {"name":"Riyadh","coins":15000},
	  "name:rome": {"name":"Rome","coins":15000},
	  "name:rosa nebula": {"name":"Rosa Nebula","coins":15000},
	  "name:savanna elephants": {"name":"Savanna Elephants","coins":15000},
	  "name:singapore skyline": {"name":"Singapore Skyline","coins":15000},
	  "name:sneaky jockey": {"name":"Sneaky Jockey","coins":15000},
	  "name:snow leopard": {"name":"Snow Leopard","coins":15000},
	  "name:spookville": {"name":"Spookville","coins":15000},
	  "name:stallion": {"name":"Stallion","coins":15000},
	  "name:taiwan night market": {"name":"Taiwan Night Market","coins":15000},
	  "name:time for family": {"name":"Time for Family","coins":15000},
	  "name:to the space": {"name":"To the Space","coins":15000},
	  "name:whitewind kingdom": {"name":"Whitewind Kingdom","coins":15000},
	  "name:malayan tiger": {"name":"Malayan Tiger","coins":15999},
	  "name:stadium": {"name":"Stadium","coins":15999},
	  "name:white tiger": {"name":"White Tiger","coins":15999},
	  "name:amusement park": {"name":"Amusement Park","coins":17000},
	  "name:diamond flight": {"name":"Diamond flight","coins":18000},
	  "name:golden hall": {"name":"Golden Hall","coins":18000},
	  "name:shell castle": {"name":"Shell Castle","coins":18000},
	  "name:rust vs world": {"name":"Rust vs World","coins":18999},
	  "name:wrath of kings": {"name":"Wrath of Kings","coins":18999},
	  "name:fantastic fly love": {"name":"Fantastic Fly Love","coins":19999},
	  "name:fiesta": {"name":"Fiesta","coins":19999},
	  "name:fly love": {"name":"Fly Love","coins":19999},
	  "name:mount olympus": {"name":"Mount Olympus","coins":19999},
	  "name:party boat": {"name":"Party Boat","coins":19999},
	  "name:ramadan celebration": {"name":"Ramadan Celebration","coins":19999},
	  "name:taipei 101": {"name":"TaiPei 101","coins":19999},
	  "name:tiger": {"name":"Tiger","coins":19999},
	  "name:castle fantasy": {"name":"Castle Fantasy","coins":20000},
	  "name:corgi's drone show": {"name":"Corgi's Drone Show","coins":20000},
	  "name:gyeongbokgung": {"name":"Gyeongbokgung","coins":20000},
	  "name:premium shuttle": {"name":"Premium Shuttle","coins":20000},
	  "name:red devil corgi": {"name":"Red Devil Corgi","coins":20000},
	  "name:see the science": {"name":"See The Science","coins":20000},
	  "name:spark": {"name":"Spark","coins":20000},
	  "name:throne": {"name":"Throne","coins":20000},
	  "name:tiktok shuttle": {"name":"TikTok Shuttle","coins":20000},
	  "name:winter magic": {"name":"Winter Magic","coins":20000},
	  "name:yacht": {"name":"Yacht","coins":20000},
	  "name:dragon gate": {"name":"Dragon Gate","coins":20888},
	  "name:black tiger": {"name":"Black Tiger","coins":22000},
	  "name:siren's aria": {"name":"Siren's Aria","coins":22500},
	  "name:infinite heart": {"name":"Infinite Heart","coins":23999},
	  "name:rose carriage": {"name":"Rose Carriage","coins":25000},
	  "name:vhs player": {"name":"VHS Player","coins":25000},
	  "name:adam's dream": {"name":"Adam’s Dream","coins":25999},
	  "name:chasing glory": {"name":"Chasing Glory","coins":25999},
	  "name:cyber roar": {"name":"Cyber Roar","coins":25999},
	  "name:flamenco dancers": {"name":"Flamenco dancers","coins":25999},
	  "name:gate of trial": {"name":"Gate of Trial","coins":25999},
	  "name:greatsword temple": {"name":"Greatsword Temple","coins":25999},
	  "name:griffin": {"name":"Griffin","coins":25999},
	  "name:light castle": {"name":"Light Castle","coins":25999},
	  "name:phoenix": {"name":"Phoenix","coins":25999},
	  "name:rin the snowborn": {"name":"Rin the Snowborn","coins":25999},
	  "name:skyforge citadel": {"name":"Skyforge Citadel","coins":25999},
	  "name:solar temple": {"name":"Solar Temple","coins":25999},
	  "name:stellar ark": {"name":"Stellar Ark","coins":25999},
	  "name:t-rex": {"name":"T-rex","coins":25999},
	  "name:undersea kingdom": {"name":"Undersea Kingdom","coins":25999},
	  "name:vulcan": {"name":"Vulcan","coins":25999},
	  "name:dragon flame": {"name":"Dragon Flame","coins":26999},
	  "name:go big live legends": {"name":"Go Big LIVE Legends","coins":29999},
	  "name:golden sports car": {"name":"Golden sports car","coins":29999},
	  "name:knee sliding": {"name":"Knee Sliding","coins":29999},
	  "name:lion": {"name":"Lion","coins":29999},
	  "name:live legends": {"name":"LIVE Legends","coins":29999},
	  "name:community legends": {"name":"Community Legends","coins":30000},
	  "name:gorilla": {"name":"Gorilla","coins":30000},
	  "name:magic rod": {"name":"Magic Rod","coins":30000},
	  "name:sam the whale": {"name":"Sam the Whale","coins":30000},
	  "name:superhero fight": {"name":"Superhero fight","coins":30000},
	  "name:tiktok houses glory": {"name":"TikTok Houses Glory","coins":30000},
	  "name:crescent lion": {"name":"Crescent Lion","coins":30999},
	  "name:guardian rhino": {"name":"Guardian Rhino","coins":30999},
	  "name:ramadan lion": {"name":"Ramadan Lion","coins":30999},
	  "name:leon and lion": {"name":"Leon and Lion","coins":34000},
	  "name:zeus": {"name":"Zeus","coins":34000},
	  "name:seal and whale": {"name":"Seal and Whale","coins":34500},
	  "name:tiktok universe+": {"name":"TikTok Universe+","coins":34999},
	  "name:holiday lion": {"name":"Holiday Lion","coins":39999},
	  "name:thunder falcon": {"name":"Thunder Falcon","coins":39999},
	  "name:tiktok stars": {"name":"TikTok Stars","coins":39999},
	  "name:fire phoenix": {"name":"Fire Phoenix","coins":41999},
	  "name:arnold the warrior": {"name":"Arnold the Warrior","coins":42999},
	  "name:julius the champion": {"name":"Julius the Champion","coins":42999},
	  "name:king leonardo": {"name":"King Leonardo","coins":42999},
	  "name:king of legends": {"name":"King of Legends","coins":42999},
	  "name:legend marcellus": {"name":"Legend Marcellus","coins":42999},
	  "name:lord marcellus": {"name":"Lord Marcellus","coins":42999},
	  "name:magic marcia": {"name":"Magic Marcia","coins":42999},
	  "name:pegasus": {"name":"Pegasus","coins":42999},
	  "name:valerian's oath": {"name":"Valerian's Oath","coins":42999},
	  "name:yuki's vigilance": {"name":"Yuki's Vigilance","coins":42999},
	  "name:tiktok universe": {"name":"TikTok Universe","coins":44999},
	  "name:holiday universe": {"name":"Holiday Universe","coins":60999},
	  "name:new live star": {"name":"New LIVE Star","coins":5},
	  "name:elite live star": {"name":"Elite LIVE Star","coins":30},
	  "name:pho": {"name":"Pho","coins":10},
	  "name:gimme the vote": {"name":"Gimme The Vote","coins":1},
	  "name:potato": {"name":"Potato","coins":5},
	  "name:good night": {"name":"Good Night","coins":10},
	  "name:dumplings": {"name":"Dumplings","coins":10},
	  "name:phoenix flower": {"name":"Phoenix Flower","coins":5},
	  "name:lock and key": {"name":"Lock and Key","coins":199},
	  "name:lovely music": {"name":"Lovely Music","coins":999},
	  "name:the running 9": {"name":"The Running 9","coins":1399},
	  "name:shaking drum": {"name":"Shaking Drum","coins":2500},
	  "name:lantern road": {"name":"Lantern Road","coins":5000},
	  "name:universe": {"name":"Universe","coins":34999},
	  "name:drama king": {"name":"Drama King","coins":49999},
	  "name:donut tower": {"name":"Donut Tower","coins":4999},
	  "name:upgraded gift": {"name":"upgraded gift"},
	  "97c975dcce2483027ececde2b6719761": {"name":"Air Dancer","coins":300},
	  "934b5a10dee8376df5870a61d2ea5cb6": {"name":"Hearts","coins":199},
	  "8520d47b59c202a4534c1560a355ae06": {"name":"Interstellar","coins":10000},
	  "4fb89af2082a290b37d704e20f4fe729": {"name":"Lion","coins":29999},
	  "dee3de6d167fc70354c624c0bd647e43": {"name":"Private Jet","coins":4888},
	  "7e5d2b6404d04e798d907ddf107a39fa": {"name":"Motorcycle","coins":2988},
	  "b0b97078e33e46c8f7b7b3c321f684c3": {"name":"Music Note","coins":169},
	  "9b3d84a61aba75bd506869b46f3c573c": {"name":"Record Player","coins":600},
	  "fd53368cacaba5c02fceb38903ed8dd3": {"name":"Gaming Chair","coins":1200},
	  "2cadff123e24e328c040380c44c7ea6b": {"name":"Birthday Cake","coins":300},
	  "c043cd9e418f13017793ddf6e0c6ee99": {"name":"Football","coins":1},
	  "cf3db11b94a975417043b53401d0afe1": {"name":"Little Crown","coins":99},
	  "6c2ab2da19249ea570a2ece5e3377f04": {"name":"Cap","coins":99},
	  "df63eee488dc0994f6f5cb2e65f2ae49": {"name":"Sunset Speedway","coins":10000},
	  "58cbff1bd592ae4365a450c4bf767f3a": {"name":"Gold Mine","coins":1000},
	  "08af67ab13a8053269bf539fd27f3873": {"name":"Sunglasses","coins":199},
	  "ba096f4e01e888e6c6d60f3b6eaa12b6": {"name":"Love Letter","coins":1}
	};


	function getIdFromUrl(url) {
		const hashMatch = url.match(/\/([a-f0-9]{32})(?:~|\.)/i);
		if (hashMatch) return hashMatch[1].toLowerCase();
		let resourceMatch = url.match(/resource\/([^.]+)(?:\.png|\.webp)/);
		if (resourceMatch) return resourceMatch[1];
		resourceMatch = url.match(/webcast-sg\/([^.]+)(?:\.png|\.webp)/);
		if (resourceMatch) return resourceMatch[1];
		const directMatch = url.match(/webcast-va\/([^~.]+)/);
		return directMatch ? directMatch[1] : url;
	}

	function checkNextSiblingsForAttribute(newElement, attributeName) {
		let nextSibling = newElement.nextElementSibling
		let dig = false;
		if (!nextSibling) {
			dig = true;
			nextSibling = newElement?.parentNode?.nextElementSibling;
		}
		while (nextSibling) {
			if (nextSibling.hasAttribute(attributeName)) {
				return true;
			} else if (dig && nextSibling.querySelector("[" + attributeName + "]")) {
				return true;
			}
			nextSibling = nextSibling.nextElementSibling;
		}
		return false;
	}

	function collectEventTokens(element, maxDepth = 4) {
		const tokens = [];
		let current = element;
		let depth = 0;
		while (current && depth < maxDepth) {
			if (current.dataset && typeof current.dataset.e2e === "string" && current.dataset.e2e) {
				tokens.push(current.dataset.e2e.toLowerCase());
			}
			current = current.parentElement;
			depth += 1;
		}
		return tokens;
	}

	// NOTE: Words must be in normalized ASCII form to match after normalizeTextForJoinMatching
	const JOIN_WORDS = new Set([
		// English
		"joined",

		// Spanish (unió → unio)
		"unio",

		// Portuguese
		"entrou",
		"ingressou",

		// French
		"rejoint",

		// German
		"beigetreten",

		// Italian
		"unito",
		"unita",

		// Dutch
		"toegetreden",

		// Swedish
		"gick",

		// Norwegian
		"ble",

		// Danish
		"deltog",

		// Finnish
		"liittyi",

		// Polish (dołączył → dolaczyl, dołączyła → dolaczyla)
		"dolaczyl",
		"dolaczyla",

		// Czech (připojil → pripojil, připojila → pripojila)
		"pripojil",
		"pripojila",

		// Romanian (alăturat → alaturat)
		"alaturat",

		// Hungarian
		"csatlakozott",

		// Turkish (katıldı → katildi)
		"katildi",

		// Indonesian
		"bergabung",

		// Vietnamese
		"thamgia"
	]);

	// Non-Latin scripts checked against the raw (lowercased) message.
	const JOIN_NON_LATIN_SUBSTRINGS = [
		"加入",
		"加入了",
		"已加入",
		"参加",
		"參加",
		"進入",
		"进入",
		"參與",
		"参加しました",
		"参加中",
		"参戦",
		"참여",
		"참가",
		"입장",
		"입장했어요",
		"입장했습니다",
		"입장하셨습니다",
		"참여했습니다",
		"참여중",
		"입장중",
		"เข้าร่วม",
		"เข้ามา",
		"เข้าไลฟ์",
		"เข้าไลฟ",
		"присоединился",
		"присоединилась",
		"присоединились",
		"подключился",
		"подключилась",
		"подключились",
		"вошел",
		"вошла",
		"зашел",
		"зашла",
		"انضم",
		"انضمت"
	];

	function normalizeTextForJoinMatching(text) {
		if (!text) {
			return "";
		}
		let working = text.toLowerCase();
		// Transliterate special characters that NFD doesn't decompose
		working = working
			.replace(/ł/g, "l")   // Polish l with stroke
			.replace(/ı/g, "i")   // Turkish dotless i
			.replace(/ß/g, "ss")  // German eszett
			.replace(/ø/g, "o")   // Danish/Norwegian o with stroke
			.replace(/æ/g, "ae")  // Ligature ae
			.replace(/œ/g, "oe"); // Ligature oe
		if (typeof working.normalize === "function") {
			try {
				working = working.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
			} catch (e) {}
		}
		working = working.replace(/[^a-z0-9\s]/g, " ");
		return working.replace(/\s+/g, " ").trim();
	}

	function containsJoinKeyword(text) {
		if (!text) {
			return false;
		}
		const rawLower = text.toLowerCase();
		for (const snippet of JOIN_NON_LATIN_SUBSTRINGS) {
			if (rawLower.includes(snippet)) {
				return true;
			}
		}
		const normalized = normalizeTextForJoinMatching(text);
		if (!normalized) {
			return false;
		}
		const tokens = normalized.split(" ");
		for (const token of tokens) {
			if (JOIN_WORDS.has(token)) {
				return true;
			}
		}
		return false;
	}

	function deriveEventHints(element) {
		const tokens = collectEventTokens(element);
		if (!tokens.length) {
			return {
				hasEventIndicator: false,
				join: false,
				share: false,
				follow: false,
				like: false
			};
		}
		const normalized = tokens.join(" ");
		const compact = normalized.replace(/[^a-z]/g, "");
		const join = containsJoinKeyword(normalized);
		const share = compact.includes("share");
		const follow = compact.includes("follow");
		const like = compact.includes("like");
		const hasEventIndicator = join || share || follow || like || tokens.some(token => token.includes("social") || token.includes("system") || token.includes("event"));
		return { hasEventIndicator, join, share, follow, like };
	}

	function processMessage(ele) {
		// TikTok reuses DOM elements, so dataset.skip must never decide whether a chat message is new.
		if (!ele) return;
		if (ele.querySelector("[class*='DivTopGiverContainer']")) {
			return;
		}
		if (checkNextSiblingsForAttribute(ele, "data-tiktok-initial")) {
			return;
		}
		const eventHints = deriveEventHints(ele);
		var ital = false;
		if (ele.dataset.e2e && (ele.dataset.e2e == "social-message")) {
			ital = true;
		} else if (eventHints.hasEventIndicator) {
			ital = true;
		}
		var chatimg = "";
		try {
			chatimg = ele.children[0].querySelector("img");
			if (!chatimg) {
				chatimg = "";
			} else {
				chatimg = chatimg.src;
				chatimg.dataset.skip = true;
			}
		} catch (e) {}
		updateLastInputTime();
		var membership = "";
		var chatbadges = "";
		var rank = 0;
		var memberLevel = 0;
		var nameColor = "";
		var chatname = "";
		try {
			let chatNameEle = ele.querySelector("[data-e2e='message-owner-name']");
			if (chatNameEle) {
				if (!chatNameEle.dataset.skip) {
					chatNameEle.dataset.skip = true;
				}
				let extractedName = "";
				try {
					if (typeof chatNameEle.textContent === "string") {
						extractedName = chatNameEle.textContent;
					}
				} catch (e) {}
				if (!extractedName || !extractedName.trim()) {
					const titleAttr = chatNameEle.getAttribute && chatNameEle.getAttribute("title");
					if (titleAttr) {
						extractedName = titleAttr;
					}
				}
				if ((!extractedName || !extractedName.trim()) && (typeof chatNameEle.innerText === "string")) {
					extractedName = chatNameEle.innerText;
				}
				if (extractedName && extractedName.trim()) {
					chatname = escapeHtml(extractedName.trim());
				}
			}
		} catch (e) {}
		try {
			if (!chatname) {
				if (ele.childNodes[1].childNodes[0].children.length) {
					chatname = escapeHtml(ele.childNodes[1].childNodes[0].childNodes[0].innerText);
				} else {
					chatname = escapeHtml(ele.childNodes[1].childNodes[0].innerText);
				}
			}
		} catch (e) {}
		try {
			var cb = ele.querySelectorAll("img[class*='ImgBadgeChatMessage'], img[class*='ImgCombineBadgeIcon'], img[src*='_badge_']");
			if (!cb.length && chatBadgeAlt) {
				try {
					if (ele.childNodes[1].childNodes.length == 2) {
						cb = ele.querySelector("[data-e2e='message-owner-name']").parentNode.querySelectorAll("img[src]");
					}
				} catch (e) {}
			}
			if (cb.length) {
				chatbadges = [];
				cb.forEach(cbimg => {
					try {
						cbimg.dataset.skip = true;
						if (cbimg.src) {
							chatbadges.push(cbimg.src + "");
							if (cbimg.src.includes("/moderator_")) {
								if (!settings.nosubcolor) {
									nameColor = "#F5D5D1";
								}
							} else if (cbimg.src.includes("/moderater_")) {
								if (!settings.nosubcolor) {
									nameColor = "#F5D5D1";
								}
							} else if (cbimg.src.includes("/sub_")) {
								membership = getTranslation("subscriber", "SUBSCRIBER");
								if (!settings.nosubcolor) {
									nameColor = "#139F1D";
								}
							} else if (cbimg.src.includes("/subs_")) {
								membership = getTranslation("subscriber", "SUBSCRIBER");
								if (!settings.nosubcolor) {
									nameColor = "#139F1D";
								}
							} else if (!rank && !nameColor && cbimg.src.includes("/grade_")) {
								try {
									rank = parseInt(cbimg.nextElementSibling.innerText) || 1;
									memberLevel = rank;
									if (!settings.nosubcolor) {
										if (rank > 40) {
											rank = 40;
										}
										nameColor = lut[rank];
									}
								} catch (e) {}
							}
						}
					} catch (e) {}
				});
			}
		} catch (e) {}
		var chatmessage = "";
		try {
			let chatEle = ele.querySelector("[class*='-DivComment']");
			if (chatEle) {
				chatmessage = getAllContentNodes(chatEle);
			} else if (ele.querySelector("[class*='-DivUserInfo'],  [class*='-DivUserInfo']")?.nextElementSibling) {
				chatmessage = getAllContentNodes(ele.querySelector("[class*='-DivUserInfo'],  [class*='-DivUserInfo']").nextElementSibling);
			} else if (ele.childNodes[1].childNodes[ele.childNodes[1].childNodes.length - 1]) {
				chatmessage = getAllContentNodes(ele.childNodes[1].childNodes[ele.childNodes[1].childNodes.length - 1]);
				if (chatmessage && ele.classList.contains("DivGiftMessage")) {
					ital = "gift";
				}
			}
		} catch (e) {}
		try {
			if (!chatmessage) {
				try {
					chatmessage = getAllContentNodes(ele.querySelector(".live-shared-ui-chat-list-chat-message-comment"));
				} catch (e) {
					chatmessage = "";
				}
			}
		} catch (e) {}
		try {
			if (!chatmessage) {
				chatmessage = getAllContentNodes(ele.querySelector("[data-e2e='chat-message'] .break-words.align-middle"));
			}
		} catch (e) {}
		try {
			if (!chatmessage) {
				var eles = ele.childNodes[1].childNodes;
				if (eles.length > 1) {
					for (var i = eles.length - 1; i >= 1; i--) {
						if (eles[i].nodeName === "#text") {
							chatmessage = escapeHtml(eles[i].textContent, true);
						} else {
							chatmessage = getAllContentNodes(eles[i]);
						}
						if (chatmessage) break;
					}
				} else if (eles.length == 1) {
					for (var i = eles[0].childNodes.length - 1; i >= 1; i--) {
						chatmessage = getAllContentNodes(eles[0].childNodes[i]);
						if (chatmessage) break;
					}
				}
			}
		} catch (e) {}
		if (chatmessage == "Moderator") {
			chatmessage = "";
		}
		const ownerNameEleForFallback = ele.querySelector("[data-e2e='message-owner-name']");
		if (!chatmessage && ownerNameEleForFallback?.parentElement?.parentElement) {
			const ownerBlock = ownerNameEleForFallback.parentElement;
			const fallbackContainer = ownerNameEleForFallback.parentElement.parentElement;
			try {
				const parts = [];
				let sibling = ownerBlock.nextSibling;
				while (sibling) {
					const part = getAllContentNodes(sibling);
					if (part) {
						parts.push(part);
					}
					sibling = sibling.nextSibling;
				}
				if (parts.length) {
					chatmessage = parts.join(" ").trim();
				}
			} catch (e) {}
			if (!chatmessage) {
				chatmessage = getAllContentNodes(fallbackContainer);
				if (chatmessage) {
					chatmessage = chatmessage.trim();
					if (chatname && chatmessage.startsWith(chatname))
						chatmessage = chatmessage.slice(chatname.length + 1);
				}
			}
			if (
				fallbackContainer.classList.contains("DivGiftMessage") ||
				fallbackContainer.querySelector("[class*='SpanGiftCount']") ||
				fallbackContainer.querySelector("img[src*='tiktokcdn.com/img/']") ||
				(chatmessage && chatmessage.includes(".tiktokcdn.com/img/"))
			) {
				ital = "gift";
			} else {
				ital = true;
			}
		}
		var hasdonation = "";
		try {
			// Normalize HTML entity to multiplication sign
			if (chatmessage) chatmessage = chatmessage.replace(/&times;?/g, '×');
			if (/[x×]\s*\d+/i.test(chatmessage) && chatmessage.includes("<img src=") && chatmessage.includes(".tiktokcdn.com/img/")) {
				chatmessage = chatmessage.replace("<img src=", " <img src=");
				chatmessage = chatmessage.replace('.png">×', '.png"> ×');
				chatmessage = chatmessage.replace(".png'>×", ".png'> ×");
				
				// keep original × symbol for accurate parsing
				
				if (settings.tiktokdonations || !settings.notiktokdonations) {
					// Extract image URL and quantity directly
					var imgMatch = chatmessage.match(/<img src="([^"]+\.tiktokcdn\.com\/img\/[^"]+)"[^>]*>\s*[x×]\s*(\d+)/i);
					if (!imgMatch) {
						imgMatch = chatmessage.match(/<img src='([^']+\.tiktokcdn\.com\/img\/[^']+)'[^>]*>\s*[x×]\s*(\d+)/i);
					}
					
					if (imgMatch) {
						var imageSrc = imgMatch[1];
						var quantity = parseInt(imgMatch[2]) || 1;
						
						// Extract gift ID from URL
						var giftid = getIdFromUrl(imageSrc);
						if (giftid) {
							var giftData = giftMapping[giftid];
							
							if (giftData && giftData.coins) {
								var totalCoins = quantity * giftData.coins;
								if (totalCoins > 1) {
									hasdonation = totalCoins + " coins";
								} else {
									hasdonation = totalCoins + " coin";
								}
							} else if (giftData && giftData.name) {
								if (quantity > 1) {
									hasdonation = quantity + " " + giftData.name + "s";
								} else {
									hasdonation = quantity + " " + giftData.name;
								}
							} else {
								if (quantity > 1) {
									hasdonation = quantity + " gifts";
								} else {
									hasdonation = quantity + " gift";
								}
							}
						}
					}
				}
			}
		} catch (e) {
			console.error("Donation parsing error:", e);
		}
		if (hasdonation) ital = "gift";
		if (!chatmessage && !chatbadges) {
			return;
		} else if (chatmessage) {
			chatmessage = chatmessage.trim();
		}
		let normalizedMessage = chatmessage ? chatmessage.toLowerCase() : "";
		if (chatmessage == "Moderator") {
			return;
		}
		if (chatmessage && (chatmessage === "----")) {
			return;
		}
		if (chatmessage && (chatmessage === "**")) {
			return;
		}
		if (chatname && (chatimg || chatbadges || membership)) {
			avatarCache.add(chatname, chatimg, chatbadges, membership, nameColor, memberLevel);
		}
		const compactMessage = normalizedMessage.replace(/[^a-z]/g, "");
		const combinedJoinText = [chatmessage, normalizedMessage, ele?.textContent]
			.filter(Boolean)
			.join(" ");
		const joinFromMessage = containsJoinKeyword(combinedJoinText);
		const shareFromMessage = compactMessage.includes("share");
		const followFromMessage = compactMessage.includes("follow");
		const likeFromMessage = compactMessage.includes("like");
		const isJoinEvent = eventHints.join || ((ital === true || eventHints.hasEventIndicator) && joinFromMessage);
		const isShareEvent = eventHints.share || ((ital === true || eventHints.hasEventIndicator) && shareFromMessage);
		const isFollowEvent = eventHints.follow || ((ital === true || eventHints.hasEventIndicator) && followFromMessage);
		const isLikeEvent = eventHints.like || ((ital === true || eventHints.hasEventIndicator) && likeFromMessage);

		if (isJoinEvent) {
			if (!settings.capturejoinedevent) {
				return;
			}
			ital = "joined";
		} else if (isShareEvent) {
			return;
		} else if (isFollowEvent) {
			ital = "followed";
			if (!chatname) {
				return;
			}
		} else if (isLikeEvent) {
			ital = "liked";
		}
		if (settings.customtiktokstate) {
			var channel = window.location.pathname.split("/@");
			if (channel.length > 1) {
				channel = channel[1].split("/")[0].trim();
			}
			if (!channel) {
				return;
			}
			if (settings.customtiktokaccount && settings.customtiktokaccount.textsetting && ((settings.customtiktokaccount.textsetting.toLowerCase() !== channel.toLowerCase()) && (settings.customtiktokaccount.textsetting.toLowerCase() !== "@" + channel.toLowerCase()))) {
				return;
			} else if (!settings.customtiktokaccount) {
				return;
			}
		}
		if (!chatname) {
			chatmessage = chatmessage.replace("----", "");
		}
		if (!chatname && !chatmessage.trim()) {
			return;
		}
		if (ital && (ital === true) && !chatname) {
			return;
			if (chatmessage.includes("New Welcome")) {
				return;
			}
			if (chatmessage == "New") {
				return;
			}
		}
		
		if (chatmessage && chatmessage.startsWith("Some comments in this LIVE were filtered to protect the community’s experience")){
			return;
		}
		
		if (chatmessage && chatmessage.startsWith("Welcome to TikTok LIVE!")){
			return;
		}
		
		
		const isGiftMessage =
			ital === "gift" ||
			(!!chatmessage && chatmessage.includes(".tiktokcdn.com/img/") && chatmessage.includes("×"));
		// Gift counts repeat legitimately in later streaks on recycled DOM slots.
		// Their bounded streak tracker below handles duplicate renders instead.
		if (!isGiftMessage && messageLog?.isDuplicate(chatname, chatmessage)) {
			////console.log("duplicate message; skipping",chatname, chatmessage);
			return;
		}
		var data = {};
		data.chatname = chatname;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.nameColor = nameColor;
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = hasdonation;
		data.membership = membership;
		data.contentimg = "";
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		data.textonly = settings.textonlymode || false;
		data.type = "tiktok";
		data.event = ital;
		if (data.event && typeof data.nameColor === "string") {
			const normalizedColor = data.nameColor.trim().toLowerCase();
			const compactColor = normalizedColor.replace(/\s/g, "");
			if (
				normalizedColor === "black" ||
				normalizedColor === "#000" ||
				normalizedColor === "#000000" ||
				compactColor === "rgb(0,0,0)" ||
				compactColor === "rgba(0,0,0,1)"
			) {
				data.nameColor = "";
			}
		}
		if (!StreamState.isValid() && StreamState.getCurrentChannel()) {
			avatarCache.cleanup();
			////console.log("Has the channel changed? If so, click the page to validate it");
			return;
		}
		addTikTokEventMeta(data, memberLevel);
		addTikTokTopViewerMeta(data);
		lastMessageTime = Date.now();
		if (markTikTokGiftUpdate(data, ele)) {
			pushMessage(data);
		}
	}

	function processEvent(ele) {
		if (ele.querySelector("[class*='DivTopGiverContainer']")) {
			return;
		}
		if (ele.dataset.skip) {
			return;
		}
		if (checkNextSiblingsForAttribute(ele, "data-skip")) {
			ele.dataset.skip = ++msgCount;
			return;
		}
		var chatname = "";
		try {
			let chatNameEle = ele.querySelector("[data-e2e='message-owner-name']");
			if (chatNameEle) {
				if (!chatNameEle.dataset.skip) {
					chatNameEle.dataset.skip = true;
				}
				let extractedName = "";
				try {
					if (typeof chatNameEle.textContent === "string") {
						extractedName = chatNameEle.textContent;
					}
				} catch (e) {}
				if (!extractedName || !extractedName.trim()) {
					const titleAttr = chatNameEle.getAttribute && chatNameEle.getAttribute("title");
					if (titleAttr) {
						extractedName = titleAttr;
					}
				}
				if ((!extractedName || !extractedName.trim()) && (typeof chatNameEle.innerText === "string")) {
					extractedName = chatNameEle.innerText;
				}
				if (extractedName && extractedName.trim()) {
					chatname = escapeHtml(extractedName.trim());
				}
			}
		} catch (e) {}
		ele.dataset.skip = ++msgCount;
		var chatmessage = "";
		const eventHints = deriveEventHints(ele);
		const ownerNameEleForFallback = ele.querySelector("[data-e2e='message-owner-name']");
		if (ownerNameEleForFallback?.parentElement) {
			const ownerBlock = ownerNameEleForFallback.parentElement;
			try {
				const parts = [];
				let sibling = ownerBlock.nextSibling;
				while (sibling) {
					const part = getAllContentNodes(sibling);
					if (part) {
						parts.push(part);
					}
					sibling = sibling.nextSibling;
				}
				if (parts.length) {
					chatmessage = parts.join(" ").trim();
				}
			} catch (e) {}
		}
		if (!chatmessage && ownerNameEleForFallback) {
			let try1 = ownerNameEleForFallback?.nextElementSibling || ownerNameEleForFallback.nextSibling;
			if (try1) {
				chatmessage = getAllContentNodes(try1);
			}
		}
		try {
			if (!chatmessage) {
				chatmessage = getAllContentNodes(ele);
			}
		} catch (e) {}
		var hasdonation = "";
		var ital = true;
		// Current LIVE rows no longer carry the legacy gift/count class names.
		// Keep those variants and also accept the existing structured gift format.
		if (chatmessage && (ele.classList.contains("DivGiftMessage") || ele.querySelector("[class*='SpanGiftCount']") ||
			(chatmessage.includes(".tiktokcdn.com/img/") && validateTikTokDonationMessage(chatmessage)))) {
			ital = "gift";
					try {
						// Normalize HTML entity to multiplication sign
						if (chatmessage) chatmessage = chatmessage.replace(/&times;?/g, '×');
						if (/[x×]\s*\d+/i.test(chatmessage) && chatmessage.includes("<img src=") && chatmessage.includes(".tiktokcdn.com/img/")) {
						chatmessage = chatmessage.replace("<img src=", " <img src=");
						chatmessage = chatmessage.replace('.png">×', '.png"> ×');
						chatmessage = chatmessage.replace(".png'>×", ".png'> ×");
						// keep original × for matching and parsing
					
					if (settings.tiktokdonations || !settings.notiktokdonations) {
						if (validateTikTokDonationMessage(chatmessage)) {
							try {
							var donation = parseDonationMessage(chatmessage);
								if (donation.isValid && donation.imageSrc) {
									var giftid = getIdFromUrl(donation.imageSrc);
									if (giftid) {
										if (giftMapping[giftid]) {
											var valuea = giftMapping[giftid].coins || giftMapping[giftid].name;
										} else {
											try {
												var valuea = document.querySelector("img[src*='" + giftid + "']").parentNode.querySelector("svg").nextElementSibling.textContent.trim();
												if (parseInt(valuea) == valuea) {
													giftMapping[giftid] = {
														coins: parseInt(valuea)
													};
												}
											} catch (e) {
												if (donation.quantity > 1) {
													var valuea = "gifts";
												} else {
													var valuea = "gift";
												}
											}
										}
										if (parseInt(valuea) == valuea) {
											valuea = (donation.quantity * parseInt(valuea));
											if (valuea > 1) {
												hasdonation = valuea + " coins";
											} else {
												hasdonation = valuea + " coin";
											}
										} else {
											hasdonation = donation.quantity + " " + valuea;
										}
									}
								}
							} catch(e){
							}
						}
					}
				}
			} catch (e) {}
		}
		if (chatmessage) {
			chatmessage = chatmessage.trim();
		}
		if (!chatmessage || (chatmessage === "----")) {
			return;
		}
		if (chatmessage && (chatmessage === "**")) {
			return;
		}
		const normalizedMessage = chatmessage ? chatmessage.toLowerCase() : "";
		const compactMessage = normalizedMessage.replace(/[^a-z]/g, "");
		const combinedJoinText = [chatmessage, normalizedMessage, ele?.textContent]
			.filter(Boolean)
			.join(" ");
		const joinFromMessage = containsJoinKeyword(combinedJoinText);
		const shareFromMessage = compactMessage.includes("share");
		const followFromMessage = compactMessage.includes("follow");
		const likeFromMessage = compactMessage.includes("like");
		const isJoinEvent = eventHints.join || ((ital === true || eventHints.hasEventIndicator) && joinFromMessage);
		const isShareEvent = eventHints.share || ((ital === true || eventHints.hasEventIndicator) && shareFromMessage);
		const isFollowEvent = eventHints.follow || ((ital === true || eventHints.hasEventIndicator) && followFromMessage);
		const isLikeEvent = eventHints.like || ((ital === true || eventHints.hasEventIndicator) && likeFromMessage);

		if (isJoinEvent) {
			if (!settings.capturejoinedevent) {
				return;
			}
			ital = "joined";
		} else if (isShareEvent) {
			return;
		} else if (isFollowEvent) {
			ital = "followed";
			if (!chatname) {
				return;
			}
		} else if (isLikeEvent) {
			ital = "liked";
		}
		let chatimg = "";
		let cachedBadges = "";
		let cachedMembership = "";
		let cachedNameColor = "";
		let cachedMemberLevel = 0;
		if (chatname) {
			const cached = avatarCache.get(chatname);
			chatimg = cached.url || "";
			cachedBadges = cached.badges || "";
			cachedMembership = cached.membership || "";
			cachedNameColor = cached.nameColor || "";
			cachedMemberLevel = cached.memberLevel || 0;
		}
		var data = {};
		data.chatname = chatname;
		data.chatbadges = cachedBadges;
		data.backgroundColor = "";
		data.nameColor = cachedNameColor;
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = hasdonation;
		data.membership = cachedMembership;
		data.contentimg = "";
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		data.textonly = settings.textonlymode || false;
		data.type = "tiktok";
		data.event = ital;
		if (data.event && typeof data.nameColor === "string") {
			const normalizedColor = data.nameColor.trim().toLowerCase();
			const compactColor = normalizedColor.replace(/\s/g, "");
			if (
				normalizedColor === "black" ||
				normalizedColor === "#000" ||
				normalizedColor === "#000000" ||
				compactColor === "rgb(0,0,0)" ||
				compactColor === "rgba(0,0,0,1)"
			) {
				data.nameColor = "";
			}
		}
		if (!StreamState.isValid() && StreamState.getCurrentChannel()) {
			////console.log("Has the channel changed? If so, click the page to validate it");
			return;
		}
		addTikTokEventMeta(data, cachedMemberLevel);
		addTikTokTopViewerMeta(data);
		lastMessageTime = Date.now();
		if (markTikTokGiftUpdate(data, ele)) {
			pushMessage(data);
		}
	}
	var bigDUPE = false;
	let observedDomElementForObserver1 = null;
	let observedDomElementForObserver2 = null;
	var observer = false;
	var observer2 = false;
	var counter = 0;
	var lastMessageTime = Date.now();
	var observerHealthCheckInterval = 60000; // Check every minute
	var lastTopViewersSnapshot = "";
	var tikTokTopViewersByName = {};

	function parseTikTokViewerCountText(value) {
		if (typeof value !== "string") {
			return null;
		}
		let viewText = value.replace(/\s+/g, " ").trim();
		if (!viewText) {
			return null;
		}
		viewText = viewText.replace(/^[^\d]+/, "");
		const suffixMatch = viewText.match(/([KMB])$/i);
		let multiplier = 1;
		if (suffixMatch) {
			const suffix = suffixMatch[1].toUpperCase();
			if (suffix === "K") {
				multiplier = 1000;
			} else if (suffix === "M") {
				multiplier = 1000000;
			} else if (suffix === "B") {
				multiplier = 1000000000;
			}
			viewText = viewText.slice(0, -1).trim().replace(/,/g, ".");
			const numeric = parseFloat(viewText.replace(/[^\d.]/g, ""));
			return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : null;
		}
		const numeric = parseInt(viewText.replace(/[^\d]/g, ""), 10);
		return Number.isFinite(numeric) ? numeric : null;
	}

	function getTikTokStateViewerCount() {
		try {
			const state = getTikTokStateObject();
			if (!state) {
				return null;
			}
			const roomStats = state?.LiveRoom?.liveRoomUserInfo?.liveRoom?.liveRoomStats;
			if (!roomStats) {
				return null;
			}
			const viewerCount = roomStats.userCount ?? roomStats.user_count ?? roomStats.viewerCount ?? null;
			const numeric = parseInt(viewerCount, 10);
			return Number.isFinite(numeric) ? numeric : null;
		} catch (e) {
			return null;
		}
	}

	function findTikTokTopViewersPanel() {
		var container = document.querySelector("[data-e2e='live-chat-container']") || document;
		var labels = container.querySelectorAll("div");
		for (var i = 0; i < labels.length; i++) {
			if (normalizeTikTokText(labels[i].textContent) !== "Viewers") {
				continue;
			}
			var panel = labels[i];
			for (var depth = 0; panel && depth < 6; depth++) {
				if (panel.querySelector && panel.querySelector(".overflow-y-auto")) {
					return panel;
				}
				panel = panel.parentElement;
			}
		}
		return null;
	}

	function getTikTokTopViewersHeaderCount(panel) {
		if (!panel) {
			return null;
		}
		try {
			var countNode = panel.querySelector(".P4-Regular.text-UIText3");
			if (!countNode || !countNode.textContent) {
				return null;
			}
			return parseTikTokViewerCountText(countNode.textContent);
		} catch (e) {
			return null;
		}
	}

	function getTikTokTopViewerName(row, imageNode) {
		try {
			if (imageNode && imageNode.parentElement && imageNode.parentElement.nextElementSibling) {
				var name = normalizeTikTokText(imageNode.parentElement.nextElementSibling.textContent);
				if (name) {
					return name;
				}
			}
		} catch (e) {}
		try {
			var left = row.firstElementChild;
			if (!left || !left.children) {
				return "";
			}
			for (var i = 0; i < left.children.length; i++) {
				var child = left.children[i];
				if (child.querySelector && child.querySelector("img[src]")) {
					continue;
				}
				var text = normalizeTikTokText(child.textContent);
				if (text && !/^\d+$/.test(text)) {
					return text;
				}
			}
		} catch (e) {}
		return "";
	}

	function parseTikTokTopViewerRows(panel) {
		var viewers = [];
		if (!panel) {
			return viewers;
		}
		try {
			var list = panel.querySelector(".overflow-y-auto");
			if (!list || !list.children) {
				return viewers;
			}
			for (var i = 0; i < list.children.length && viewers.length < 3; i++) {
				var row = list.children[i];
				if (!row || !row.textContent) {
					continue;
				}
				var left = row.firstElementChild;
				var rankNode = left && left.firstElementChild ? left.firstElementChild : null;
				var rank = parseInt(normalizeTikTokText(rankNode ? rankNode.textContent : ""), 10);
				var imageNode = row.querySelector("img[src]");
				var name = getTikTokTopViewerName(row, imageNode);
				if (!name || !Number.isFinite(rank)) {
					continue;
				}
				var scoreNode = row.lastElementChild;
				var scoreText = normalizeTikTokText(scoreNode ? scoreNode.textContent : "");
				var score = parseTikTokViewerCountText(scoreText);
				var viewer = {
					rank: rank,
					chatname: escapeHtml(name),
					scoreText: scoreText
				};
				if (Number.isFinite(score)) {
					viewer.score = score;
				}
				if (imageNode && imageNode.src) {
					viewer.chatimg = imageNode.src + "";
				}
				viewers.push(viewer);
			}
		} catch (e) {}
		return viewers;
	}

	function updateTikTokTopViewersCache(topViewers) {
		tikTokTopViewersByName = {};
		if (!topViewers || !topViewers.length) {
			return;
		}
		for (var i = 0; i < topViewers.length; i++) {
			var viewer = topViewers[i];
			var key = normalizeTikTokNameKey(viewer.chatname);
			if (!key) {
				continue;
			}
			tikTokTopViewersByName[key] = {
				rank: viewer.rank,
				score: viewer.score,
				scoreText: viewer.scoreText || "",
				chatimg: viewer.chatimg || ""
			};
		}
	}

	function getTikTokTopViewerMeta(chatname) {
		var key = normalizeTikTokNameKey(chatname);
		if (!key || !tikTokTopViewersByName[key]) {
			return null;
		}
		var viewer = tikTokTopViewersByName[key];
		var meta = {
			topViewer: true,
			topViewerRank: viewer.rank
		};
		if (Number.isFinite(viewer.score)) {
			meta.topViewerScore = viewer.score;
		}
		if (viewer.scoreText) {
			meta.topViewerScoreText = viewer.scoreText;
		}
		return meta;
	}

	function addTikTokTopViewerMeta(data) {
		if (!data || !data.chatname) {
			return;
		}
		var topViewerMeta = getTikTokTopViewerMeta(data.chatname);
		if (!topViewerMeta) {
			return;
		}
		if (!data.meta) {
			data.meta = {};
		}
		for (var key in topViewerMeta) {
			if (Object.prototype.hasOwnProperty.call(topViewerMeta, key)) {
				data.meta[key] = topViewerMeta[key];
			}
		}
	}

	function addTikTokEventMeta(data, memberLevel) {
		if (!data) {
			return;
		}
		if (data.event === "followed" || memberLevel) {
			if (!data.meta) {
				data.meta = {};
			}
			if (data.event === "followed") {
				data.meta.follower = true;
			}
			if (memberLevel) {
				data.meta.memberLevel = memberLevel;
			}
		}
	}

	function createTikTokTopViewersSnapshot() {
		var panel = findTikTokTopViewersPanel();
		if (!panel) {
			return null;
		}
		var topViewers = parseTikTokTopViewerRows(panel);
		if (!topViewers.length) {
			return null;
		}
		var snapshot = {
			topViewers: topViewers
		};
		var viewerCount = getTikTokTopViewersHeaderCount(panel);
		if (Number.isFinite(viewerCount)) {
			snapshot.viewerCount = viewerCount;
		}
		return snapshot;
	}

	function checkTikTokTopViewers() {
		if (!isExtensionOn) {
			return;
		}
		if (!StreamState.isValid() && StreamState.getCurrentChannel()) {
			return;
		}
		var snapshot = createTikTokTopViewersSnapshot();
		if (!snapshot) {
			if (lastTopViewersSnapshot) {
				lastTopViewersSnapshot = "";
				updateTikTokTopViewersCache([]);
				sendMetaEvent("top_viewers_update", { topViewers: [] });
			}
			return;
		}
		updateTikTokTopViewersCache(snapshot.topViewers);
		var serialized = JSON.stringify(snapshot);
		if (serialized === lastTopViewersSnapshot) {
			return;
		}
		lastTopViewersSnapshot = serialized;
		sendMetaEvent("top_viewers_update", snapshot);
	}

	function getTikTokStandardBlockedReason() {
		const isLivePage = window.location.href.includes("livecenter") ||
			(window.location.pathname.includes("@") && window.location.pathname.includes("live"));
		if (!isLivePage) {
			return null;
		}

		const elapsed = Date.now() - tikTokStandardStatusState.initAt;
		const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim().toLowerCase();

		if (bodyText) {
			if (bodyText.includes("comments turned off") || bodyText.includes("comments are turned off")) {
				return "TikTok says comments are turned off on this page.";
			}
			if (
				bodyText.includes("verify to continue") ||
				bodyText.includes("security check") ||
				bodyText.includes("please verify") ||
				bodyText.includes("complete the puzzle") ||
				bodyText.includes("too many attempts")
			) {
				return "TikTok is showing a verification challenge in standard mode.";
			}
		}

		if (document.querySelector("[id*='captcha'], [class*='captcha'], iframe[src*='captcha'], iframe[src*='verify'], [data-e2e*='captcha']")) {
			return "TikTok is showing a verification challenge in standard mode.";
		}

		const hasChatMessageRows = !!document.querySelector('[data-e2e="chat-message"]');
		const hasSignInPrompt = /\b(log in|sign in)\b/.test(bodyText) ||
			!!document.querySelector('button[data-e2e*="login"], a[href*="/login"], [data-e2e*="login"]');
		if (hasSignInPrompt && !hasChatMessageRows && elapsed > 12000) {
			return "TikTok is asking you to sign in before standard mode can see live chat.";
		}

		const state = getTikTokStateObject();
		const liveRoom = state?.LiveRoom?.liveRoomUserInfo?.liveRoom || null;
		const currentRoom = state?.CurrentRoom || null;
		const showLiveChat = liveRoom?.showLiveChat ?? currentRoom?.showLiveChat;
		const enableChat = liveRoom?.enableChat ?? currentRoom?.enableChat;

		if ((showLiveChat === false || enableChat === false) && elapsed > 6000) {
			return "TikTok live chat is unavailable in standard mode.";
		}

		if (elapsed < 20000) {
			return null;
		}

		if (observer instanceof MutationObserver && observedDomElementForObserver1 && observedDomElementForObserver1.isConnected) {
			return null;
		}

		const hasChatSurface = !!document.querySelector('[data-e2e="chat-room"], [data-e2e="live-chat-container"], [data-e2e="public-screen-live-chat-slot"], [class*="DivChatRoomContent"], .live-shared-ui-chat-list-scrolling-list, [data-e2e="chat-message"]');
		const hasComposer = !!findTikTokChatComposer() || !!document.querySelector(".public-DraftEditorPlaceholder-inner");
		const hasDisabledComposer = !!document.querySelector("div[contenteditable='plaintext-only'][disabled][placeholder]");
		if ((!hasChatSurface && !hasComposer) || hasDisabledComposer) {
			return "TikTok standard mode did not expose a usable live chat panel.";
		}

		return null;
	}

	function monitorTikTokStandardHealth() {
		if (!canSendTikTokStandardStatus() || !isExtensionOn) {
			return;
		}
		if (!StreamState.isValid() && StreamState.getCurrentChannel()) {
			return;
		}
		const blockedReason = getTikTokStandardBlockedReason();
		if (blockedReason) {
			reportTikTokStandardFatal(blockedReason);
		} else {
			resetTikTokStandardPendingError();
		}
	}

	function findTikTokChatMessageObserverTarget() {
		var firstMessage = document.querySelector('[data-e2e="chat-message"]');
		if (!firstMessage) {
			return null;
		}

		var candidate = firstMessage.parentElement;
		for (var depth = 0; candidate && candidate !== document.body && depth < 8; depth++) {
			if (candidate.querySelectorAll && candidate.querySelectorAll('[data-e2e="chat-message"]').length) {
				var className = typeof candidate.className === "string" ? candidate.className : "";
				if (className.includes("absolute") || className.includes("relative") || candidate.children.length > 1) {
					return candidate;
				}
			}
			candidate = candidate.parentElement;
		}

		return firstMessage.parentElement || null;
	}

	function getTikTokMainObserverTarget() {
		let target = null;
		let subtree = false;
		if (window.location.href.startsWith("https://livecenter.tiktok.com/common_live_chat")) {
			target = document.querySelector('[data-e2e]');
			if (target) {
				target = target.parentNode;
			}
		} else {
			target = document.querySelector('[data-e2e="chat-room"], [class*="DivChatRoomContent"], .live-shared-ui-chat-list-scrolling-list');
			if (target) {
				subtree = true;
			}
			if (!target) {
				target = findTikTokChatMessageObserverTarget();
				if (target) {
					subtree = true;
				}
			}
			if (!target) {
				target = document.querySelector('[data-e2e="live-chat-container"], [data-e2e="public-screen-live-chat-slot"]');
				if (target) {
					subtree = true;
				}
			}
			if (!target) {
				target = document.querySelector('.live-room-container div[data-index]:not([data-index="-1"])');
				if (target) {
					target = target.parentNode;
					subtree = false;
				} else {
					target = document.querySelector('.live-room-container div.flex-1.overflow-y-scroll.overflow-x-hidden.box-border div.relative.w-full div.absolute.w-full.top-0.left-0');
					if(target){
						subtree = false;
					}
				}
			}

			if (!target) {
				let potentialTargets = document.querySelectorAll('[data-index].w-full');
				if (potentialTargets && potentialTargets.length > 3) {
					target = potentialTargets[potentialTargets.length - 1].parentNode;
					subtree = false;
				}
			}
		}
		if (!target) {
			return null;
		}
		return {
			target: target,
			subtree: subtree
		};
	}

	function getTikTokSecondaryObserverTarget(other) {
		var target2 = document.querySelector('[class*="DivBottomStickyMessageContainer"], [class="w-full h-auto overflow-hidden flex-shrink-0 max-h-[200px] min-h-32"]');
		if (!target2 && other && other.isConnected && other.nextElementSibling) {
			target2 = other.nextElementSibling;
		}
		return target2 || null;
	}

	function findTikTokChatMessageForMutationNode(node) {
		if (node && node.nodeType === 3) {
			node = node.parentElement;
		}
		if (!node || node.nodeType !== 1) {
			return null;
		}
		if (node.dataset && node.dataset.e2e === "chat-message") {
			return node;
		}
		var nestedMessage = node.querySelector && node.querySelector('[data-e2e="chat-message"]');
		if (nestedMessage) {
			return nestedMessage;
		}
		return node.closest ? node.closest('[data-e2e="chat-message"]') : null;
	}
	
	function start() {
		if (!isExtensionOn) {
			//console.log("EXTENSION OFF?");
			return;
		}
		counter+=1;
		
		if (counter > 3  && counter < 15 && document.querySelector("div[contenteditable='plaintext-only'][disabled][placeholder]")){
			const lastReload = sessionStorage.getItem('lastReload');
			const now = Date.now();

			if (!lastReload || (now - parseInt(lastReload, 10)) > 60000) {
				sessionStorage.setItem('lastReload', now);
				location.reload();
				return;
			}
		}
		
		// Health check: If no messages for over 2 minutes and observers exist, force restart
		if (observer && (Date.now() - lastMessageTime > 120000) && counter % 30 === 0) {
			console.log("[TikTok] No messages for 2+ minutes, forcing observer restart");
			if (observer) {
				observer.disconnect();
				observer = false;
				observedDomElementForObserver1 = null;
			}
			if (observer2) {
				observer2.disconnect();
				observer2 = false;
				observedDomElementForObserver2 = null;
			}
		}
		
		if (settings.showviewercount || settings.hypemode) {
			try {

				if (!StreamState.isValid() && StreamState.getCurrentChannel()) {
					// not active
				} else if (counter%15==1){
					var viewerCount = document.querySelector("[data-e2e='live-people-count'], .flex.justify-start.items-center .P4-Regular.text-UIText3");
					let views = 0; // Default to 0 if not found

					if (viewerCount && viewerCount.textContent) {
						const parsedViews = parseTikTokViewerCountText(viewerCount.textContent);
						if (Number.isFinite(parsedViews)) {
							views = parsedViews;
						}
					}
					if (!views) {
						const stateViews = getTikTokStateViewerCount();
						if (Number.isFinite(stateViews)) {
							views = stateViews;
						}
					}

					// Always send viewer update (even if 0) to clear stale counts
					chrome.runtime.sendMessage(
						chrome.runtime.id,
						({
							message: {
								type: 'tiktok',
								event: 'viewer_update',
								meta: views
							}
						}),
						function(e) {}
					);
				}
			} catch (e) {
				////console.error(e);
			}
		}
		if (counter % 15 == 1) {
			try {
				checkTikTokTopViewers();
			} catch (e) {}
		}
		monitorTikTokStandardHealth();

		var mainTargetInfo = getTikTokMainObserverTarget();
		
		if (observer && observedDomElementForObserver1) {
			// Check if the observed element is still connected
			if (!observedDomElementForObserver1.isConnected) {
				console.log("[TikTok] Observer target disconnected, will re-establish");
				observer.disconnect();
				observer = false;
				observedDomElementForObserver1 = null;
			} else if (mainTargetInfo && mainTargetInfo.target !== observedDomElementForObserver1) {
				console.log("[TikTok] Observer target changed, will re-establish");
				observer.disconnect();
				observer = false;
				observedDomElementForObserver1 = null;
			} else {
				markTikTokStandardConnected();
				//console.log("<<>");
				return;
			}
		}
		//console.log("..................");
		let target = mainTargetInfo ? mainTargetInfo.target : null;
		let subtree = mainTargetInfo ? mainTargetInfo.subtree : false;
		////console.log("target", target);
		if (!target) {
			////console.log("Start: No target found for main observer.");
			return;
		}
		if (!window.location.href.includes("livecenter") && !(window.location.pathname.includes("@") && window.location.pathname.includes("live"))) {
			return;
		}
		if (observer) {
			observer.disconnect();
			observer = false;
			observedDomElementForObserver1 = null;
		}
		if (!subtree) {
			start2(target);
		}
		
		console.log("subtree: "+subtree);
		////console.log("Attempting to start social stream on target:", target);
		observer = new MutationObserver((mutations) => {
			try {
				if (!isExtensionOn) return;
				let addedNodeCount = 0;
				mutations.forEach(mutation => {
					addedNodeCount += mutation.addedNodes.length;
				});
				if (addedNodeCount > 295) {
					console.warn("[TikTok] Ignoring oversized chat update:", addedNodeCount);
					return;
				}
				mutations.forEach((mutation) => {
					if (mutation.type === "characterData") {
						var updatedMessage = findTikTokChatMessageForMutationNode(mutation.target);
						if (updatedMessage && updatedMessage.isConnected) {
							setTimeout(processMessage, 10, updatedMessage);
						}
						return;
					}
					if (mutation.addedNodes.length) {
						//console.warn(mutation.addedNodes);
						for (let i = 0; i < mutation.addedNodes.length; i++) {
							try {
							const node = mutation.addedNodes[i];
							if (!node.isConnected) continue;
							if (!subtree) {
								if (node.dataset && node.dataset.e2e === "chat-message") {
									setTimeout(processMessage, 10, node);
								} else if (node.dataset && node.dataset.index) {
									// data-index is a recycled DOM slot (usually 0–299), not a message ID.

									setTimeout(processMessage, 10, node);
								} else {
									const chatMessageChild = node.querySelector && node.querySelector("[data-e2e='chat-message']");
									if (chatMessageChild) {
										setTimeout(processMessage, 10, chatMessageChild);
									} else {
										setTimeout(processEvent, 10, node);
									}
								}
							} else {
								let msg = findTikTokChatMessageForMutationNode(node);
								if (msg) {
									setTimeout(processMessage, 10, msg);
								} else {
									setTimeout(processEvent, 10, node);
								}
							}
						} catch (e) {}
					}
				}
			});
			} catch (err) {
				console.error("[TikTok] Observer error:", err);
				// If there's a critical error, try to restart
				if (observer) {
					observer.disconnect();
					observer = false;
					observedDomElementForObserver1 = null;
				}
			}
		});
		if (observer && observer instanceof MutationObserver && target && target.isConnected && isExtensionOn) {
			if (target.children) {
				Array.from(target.children).forEach(ele => {
					if (ele && ele.dataset && ele.isConnected) {
						ele.dataset.skip = ++msgCount;
						ele.dataset.tiktokInitial = "true";
					}
				});
			}
			document.querySelectorAll('[data-e2e="chat-message"]').forEach(ele => {
				ele.dataset.skip = ++msgCount;
				ele.dataset.tiktokInitial = "true";
			});
			observer.observe(target, {
				childList: true,
				characterData: subtree,
				subtree: subtree
			});
			observedDomElementForObserver1 = target;
			markTikTokStandardConnected();
			////console.log("Main observer is now observing.", target);
		} else {
			if (observer instanceof MutationObserver) {
				observer.disconnect();
			}
			observer = false;
			observedDomElementForObserver1 = null;
			////console.log("Main observer NOT started or target/state became invalid before observe.", target);
		}
	}

	function start2(other = false) {
		if (!isExtensionOn) {
			return;
		}
		var target2 = getTikTokSecondaryObserverTarget(other);
		if (observer2 && observedDomElementForObserver2) {
			// Check if the observed element is still connected
			if (!observedDomElementForObserver2.isConnected) {
				console.log("[TikTok] Observer2 target disconnected, will re-establish");
				observer2.disconnect();
				observer2 = false;
				observedDomElementForObserver2 = null;
			} else if (target2 && target2 !== observedDomElementForObserver2) {
				console.log("[TikTok] Observer2 target changed, will re-establish");
				observer2.disconnect();
				observer2 = false;
				observedDomElementForObserver2 = null;
			} else {
				return;
			}
		}
		if (!target2) {
			return;
		}
		if (!window.location.href.includes("livecenter") &&
			!(window.location.pathname.includes("@") && window.location.pathname.includes("live"))) {
			return;
		}
		if (observer2) {
			observer2.disconnect();
			observer2 = false;
			observedDomElementForObserver2 = null;
		}
		observer2 = new MutationObserver((mutations) => {
			try {
				if (!isExtensionOn) return;
				mutations.forEach((mutation) => {
					if (mutation.addedNodes.length) {
						for (let i = 0; i < mutation.addedNodes.length; i++) {
							try {
							const node = mutation.addedNodes[i];
							if (!node.isConnected) continue;
							if (node.nodeName === "DIV") {
								const typeOfEvent = node.dataset?.e2e || node.querySelector?.("[data-e2e]")?.dataset.e2e || "";
								const normalizedType = typeof typeOfEvent === "string" ? typeOfEvent.toLowerCase() : "";
								const isJoinNotification = containsJoinKeyword(normalizedType);
								if (!settings.capturejoinedevent && isJoinNotification) {
									continue;
								}
								processEvent(node);
							}
						} catch (e) {}
					}
				}
			});
			} catch (err) {
				console.error("[TikTok] Observer2 error:", err);
				// If there's a critical error, try to restart
				if (observer2) {
					observer2.disconnect();
					observer2 = false;
					observedDomElementForObserver2 = null;
				}
			}
		});
		if (target2.isConnected) {
			observer2.observe(target2, {
				childList: true,
				subtree: true
			});
			observedDomElementForObserver2 = target2;
			////console.log("Secondary observer is now observing.", target2);
		} else {
			observer2 = false;
			observedDomElementForObserver2 = null;
			////console.log("Secondary observer NOT started, target not connected.", target2);
		}
	}
	window.addEventListener('beforeunload', function() {
		if (observer) {
			observer.disconnect();
			observer = false;
			observedDomElementForObserver1 = null;
		}
		if (observer2) {
			observer2.disconnect();
			observer2 = false;
			observedDomElementForObserver2 = null;
		}
		if (messageLog._cleanupInterval) {
			clearInterval(messageLog._cleanupInterval);
			messageLog._cleanupInterval = null;
		}
		trackedTikTokGiftStreaks.forEach(function(tracked) {
			if (tracked && tracked.timer) {
				clearTimeout(tracked.timer);
			}
		});
		trackedTikTokGiftStreaks.clear();
		if (videosMuted) {
			clearInterval(videosMuted);
			videosMuted = null;
		}
		if (pokeMe) {
			clearInterval(pokeMe);
			pokeMe = null;
		}
	});
	setInterval(start, 2000);
	var settings = {};
	var isExtensionOn = true;
	try {
		chrome.runtime.sendMessage(chrome.runtime.id, {
			"getSettings": true,
			"tabId": chrome.runtime.id
		}, function(response) {
			if (response) {
				if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
				response = response || {};
				if ("settings" in response) settings = response.settings;
				if ("state" in response) isExtensionOn = response.state;
			}
		});
	} catch (e) {}
	
	
	let pokeTimeout = 27;
	if ((window.ninjafy || window.electronApi)) {
		pokeTimeout = 10;
	}
	var pokeMe = setInterval(function() {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"pokeMe": true
			}, function(response) {
				////console.log("POKED");
			});
		} catch (e) {}
	}, 1000 * 60 * pokeTimeout);
	var videosMuted = false;

	function findTikTokChatComposer() {
		const selectors = [
			"div[contenteditable='plaintext-only'][maxlength]",
			"div[contenteditable='plaintext-only'][placeholder]",
			"div[contenteditable][data-e2e*='chat']",
			"[data-e2e*='chat'] div[contenteditable]",
			"[contenteditable][placeholder]"
		];
		for (const selector of selectors) {
			try {
				const candidate = document.querySelector(selector);
				if (candidate && typeof candidate.focus === "function") {
					return candidate;
				}
			} catch (e) {}
		}
		try {
			const placeholder = document.querySelector(".public-DraftEditorPlaceholder-inner");
			if (placeholder && placeholder.parentElement) {
				const editableSibling = placeholder.parentElement.querySelector("[contenteditable]");
				if (editableSibling && typeof editableSibling.focus === "function") {
					return editableSibling;
				}
			}
		} catch (e) {}
		return null;
	}

	function clearTikTokChatComposer(element) {
		if (!element) {
			return;
		}
		let mutated = false;
		try {
			if (typeof element.textContent === "string" && element.textContent.length) {
				element.textContent = "";
				mutated = true;
			}
		} catch (e) {}
		try {
			if (typeof element.innerHTML === "string" && element.innerHTML.length) {
				element.innerHTML = "";
				mutated = true;
			}
		} catch (e) {}
		try {
			const eventInit = { bubbles: true, cancelable: true };
			const evt = typeof InputEvent === "function" ? new InputEvent("input", eventInit) : new Event("input", eventInit);
			element.dispatchEvent(evt);
		} catch (e) {
			try {
				element.dispatchEvent(new Event("input", { bubbles: true }));
			} catch (err) {}
		}
		if (!mutated) {
			return;
		}
		try {
			const changeEvent = new Event("change", { bubbles: true });
			element.dispatchEvent(changeEvent);
		} catch (e) {}
	}

	function restartPokeInterval() {
		clearInterval(pokeMe);
		pokeMe = setInterval(function() {
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, {
					"pokeMe": true
				}, function(response) {});
			} catch (e) {}
		}, 1000 * 60 * pokeTimeout);
	}
	try {
		chrome.runtime.onMessage.addListener(
			function(request, sender, sendResponse) {
				try {
					if ("getSource" == request) {
						sendResponse("tiktok");
						return;
					}
					if ("focusChat" == request) {
						if (!StreamState.isValid() && StreamState.getCurrentChannel()) {
							sendResponse(false);
							return;
						}
						if (settings.customtiktokstate) {
							var channel = window.location.pathname.split("/@");
							if (channel.length > 1) {
								channel = channel[1].split("/")[0].trim();
							}
							if (!channel) {
								sendResponse(false);
								return;
							}
							if (settings.customtiktokaccount && settings.customtiktokaccount.textsetting && ((settings.customtiktokaccount.textsetting.toLowerCase() !== channel.toLowerCase()) && (settings.customtiktokaccount.textsetting.toLowerCase() !== "@" + channel.toLowerCase()))) {
								sendResponse(false);
								return;
							} else if (!settings.customtiktokaccount) {
								sendResponse(false);
								return;
							}
						}
						const composer = findTikTokChatComposer();
						if (composer) {
							try {
								composer.focus();
							} catch (e) {}
							clearTikTokChatComposer(composer);
							sendResponse(true);
							restartPokeInterval();
							return;
						}
						const placeholderTarget = document.querySelector(".public-DraftEditorPlaceholder-inner");
						if (placeholderTarget) {
							placeholderTarget.focus();
							sendResponse(true);
							restartPokeInterval();
							return;
						}
						const fallbackEditable = document.querySelector("[contenteditable][placeholder]");
						if (fallbackEditable) {
							try {
								fallbackEditable.focus();
							} catch (e) {}
							clearTikTokChatComposer(fallbackEditable);
							sendResponse(true);
							restartPokeInterval();
						} else {
							sendResponse(false);
						}
						return;
					}
					if (typeof request === "object") {
						if ("state" in request) {
							isExtensionOn = request.state;
						}
						if ("settings" in request) {
							settings = request.settings;
							sendResponse(true);
							return;
						}
						if ("muteWindow" in request) {
							if (request.muteWindow) {
								clearInterval(videosMuted);
								videosMuted = setInterval(function() {
									document.querySelectorAll("video").forEach(v => {
										v.muted = true;
										v.pause();
									});
								}, 1000);
								document.querySelectorAll("video").forEach(v => {
									v.muted = true;
									v.pause();
								});
								sendResponse(true);
								return;
							} else {
								if (videosMuted) {
									clearInterval(videosMuted);
									document.querySelectorAll("video").forEach(v => {
										v.muted = false;
										v.play();
									});
								} else {
									clearInterval(videosMuted);
								}
								videosMuted = false;
								sendResponse(true);
								return;
							}
						}
					}
				} catch (e) {}
				sendResponse(false);
			}
		);
	} catch (e) {}
	const StreamState = {
		initialUrl: null,
		lastUserInteraction: 0,
		navigationTimeout: 10000,
		previousChannel: null,
		navigationCount: 0,
		init() {
			this.initialUrl = location.href;
			this.lastUserInteraction = Date.now();
			this.previousChannel = this.getCurrentChannel();
			
			// Track user interactions
			document.addEventListener('click', (e) => {
				// Reset state on user click
				this.reset();
				////console.log("Stream state reset by click");
			});
			document.addEventListener('keydown', () => {
				this.lastUserInteraction = Date.now();
			});
			document.addEventListener('touchstart', () => {
				this.lastUserInteraction = Date.now();
			});
			
			// Monitor URL changes via History API
			const originalPushState = history.pushState;
			const originalReplaceState = history.replaceState;
			
			history.pushState = function() {
				originalPushState.apply(history, arguments);
				StreamState.handleNavigation();
			};
			
			history.replaceState = function() {
				originalReplaceState.apply(history, arguments);
				StreamState.handleNavigation();
			};
			
			window.addEventListener('popstate', () => {
				this.handleNavigation();
			});
		},
		handleNavigation() {
			const currentChannel = this.getCurrentChannel();
			const timeSinceInteraction = Date.now() - this.lastUserInteraction;
			
			// If channel changed and it wasn't recent user interaction
			if (currentChannel && this.previousChannel && 
				currentChannel !== this.previousChannel && 
				timeSinceInteraction > 1000) {
				this.navigationCount++;
				console.log(`[StreamState] Automated navigation detected: ${this.previousChannel} -> ${currentChannel}`);
			}
			
			this.previousChannel = currentChannel;
		},
		isValid() {
			const currentUrl = location.href;
			const currentChannel = this.getCurrentChannel();
			
			// If URL hasn't changed, it's valid
			if (currentUrl === this.initialUrl) {
				return true;
			}
			
			// If no channel in URL (not on a live page), consider invalid
			if (!currentChannel) {
				return false;
			}
			
			// Check if this was a recent user interaction
			const timeSinceInteraction = Date.now() - this.lastUserInteraction;
			if (timeSinceInteraction <= this.navigationTimeout) {
				return true;
			}
			
			// If we've detected multiple automated navigations, be more strict
			if (this.navigationCount > 1) {
				return false;
			}
			
			// Check if we're still on the same channel
			const initialChannel = this.initialUrl.match(/@([^/]+)/)?.[1];
			return currentChannel === initialChannel;
		},
		reset() {
			this.initialUrl = location.href;
			this.lastUserInteraction = Date.now();
			this.previousChannel = this.getCurrentChannel();
			this.navigationCount = 0;
		},
		getCurrentChannel() {
			const match = location.href.match(/@([^/]+)/);
			return match ? match[1] : null;
		}
	};
	StreamState.init();
	let lastUserInputTime = Date.now();

	function updateLastInputTime() {
		lastUserInputTime = Date.now();
	}

	function checkInactivityAndClick() {
		const currentTime = Date.now();
		const timeElapsed = currentTime - lastUserInputTime;
		if (timeElapsed >= 10000) {
			const unreadTipsElement = document.querySelector("[class*='DivUnreadTipsContent']");
			if (unreadTipsElement) {
				unreadTipsElement.click();
				lastUserInputTime = currentTime;
			}
		}
	}
	window.addEventListener('wheel', updateLastInputTime);
})();
