// new code
(function() {
	console.log("Social stream injected");
	const avatarCache = {
		_cache: {},
		MAX_SIZE: 501,
		CLEANUP_COUNT: 50,
		add(chatname, chatimg, badges = null, membership = null, nameColor = null) {
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

	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"message": data
			}, function(e) {
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

	function escapeHtml(unsafe) {
		try {
			if (settings.textonlymode) {
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
				return escapeHtml(element.textContent) || "";
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
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1) {
				if (!settings.textonlymode) {
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
			}
		});
		if (isBadge) {
			return "";
		}
		return resp;
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
		let giftMapping = {
	  "eba3a9bb85c33e017f3648eaf88d7189": {
		"name": "Rose",
		"coins": 1
	  },
	  "cb1c3e6263d4b6c08301f8798dcb5a9b": {
		"name": "Tsar",
		"coins": 100
	  },
	  "3f02fa9594bd1495ff4e8aa5ae265eef": {
		"name": "GG",
		"coins": 1
	  },
	  "20ec0eb50d82c2c445cb8391fd9fe6e2": {
		"name": "Game Controller",
		"coins": 100
	  },
	  "b199d028d5beb081fe16edcf77db0830": {
		"name": "Flame heart",
		"coins": 1
	  },
	  "a4c4dc437fd3a6632aba149769491f49": {
		"name": "Finger heart",
		"coins": 5
	  },
	  "7ee91414ca66477969b8d30831d8e5c1": {
		"name": "LIVE STAR",
		"coins": 1
	  },
	  "d9119ea9e40e68f770e8273ca0372c7e": {
		"name": "New LIVE Star",
		"coins": 5
	  },
	  "621c62c208eeaeba85761c0c5efdd32b": {
		"name": "Elite LIVE Star",
		"coins": 30
	  },
	  "eb77ead5c3abb6da6034d3cf6cfeb438": {
		"name": "Rosa",
		"coins": 10
	  },
	  "fc549cf1bc61f9c8a1c97ebab68dced7": {
		"name": "Love you so much",
		"coins": 1
	  },
	  "4e7ad6bdf0a1d860c538f38026d4e812": {
		"name": "Doughnut",
		"coins": 30
	  },
	  "91058c626f0809291e7941969e4f0d05": {
		"name": "Gamer 2025",
		"coins": 299
	  },
	  "cbd7588c53ec3df1af0ed6d041566362": {
		"name": "Super GG",
		"coins": 100
	  },
	  "6cd022271dc4669d182cad856384870f": {
		"name": "Hand hearts",
		"coins": 100
	  },
	  "20b8f61246c7b6032777bb81bf4ee055": {
		"name": "Perfume",
		"coins": 20
	  },
	  "e9cafce8279220ed26016a71076d6a8a": {
		"name": "You're awesome",
		"coins": 1
	  },
	  "d78ed6496fd57286b42ac033acbee299": {
		"name": "Mishka bear",
		"coins": 100
	  },
	  "d2a59d961490de4c72fed3690e44d1ec": {
		"name": "Music on Stage",
		"coins": 1
	  },
	  "693ed273f16deff9e947a29a423c5816": {
		"name": "Sushi Set",
		"coins": 20
	  },
	  "e033c3f28632e233bebac1668ff66a2f": {
		"name": "Friendship Necklace",
		"coins": 10
	  },
	  "802a21ae29f9fae5abe3693de9f874bd": {
		"name": "TikTok",
		"coins": 1
	  },
	  "148eef0884fdb12058d1c6897d1e02b9": {
		"name": "Corgi",
		"coins": 299
	  },
	  "e0589e95a2b41970f0f30f6202f5fce6": {
		"name": "Money Gun",
		"coins": 500
	  },
	  "485175fda92f4d2f862e915cbcf8f5c4": {
		"name": "Star",
		"coins": 99
	  },
	  "ab0a7b44bfc140923bb74164f6f880ab": {
		"name": "Love you",
		"coins": 1
	  },
	  "0f158a08f7886189cdabf496e8a07c21": {
		"name": "Paper Crane",
		"coins": 99
	  },
	  "d72381e125ad0c1ed70f6ef2aff6c8bc": {
		"name": "Little Ghost",
		"coins": 10
	  },
	  "e45927083072ffe0015253d11e11a3b3": {
		"name": "Pho",
		"coins": 10
	  },
	  "c2413f87d3d27ac0a616ac99ccaa9278": {
		"name": "Spooky Cat",
		"coins": 1200
	  },
	  "1bdf0b38142a94af0f71ea53da82a3b1": {
		"name": "Bouquet",
		"coins": 100
	  },
	  "3ac5ec732f6f4ba7b1492248bfea83d6": {
		"name": "Birthday Cake",
		"coins": 1
	  },
	  "c836c81cc6e899fe392a3d11f69fafa3": {
		"name": "Boo's Town",
		"coins": 15000
	  },
	  "d53125bd5416e6f2f6ab61da02ddd302": {
		"name": "Lucky Pig",
		"coins": 10
	  },
	  "c2cd98b5d3147b983fcbf35d6dd38e36": {
		"name": "Balloon Gift Box",
		"coins": 100
	  },
	  "79a02148079526539f7599150da9fd28": {
		"name": "Galaxy",
		"coins": 1000
	  },
	  "863e7947bc793f694acbe970d70440a1": {
		"name": "Forever Rosa",
		"coins": 399
	  },
	  "968820bc85e274713c795a6aef3f7c67": {
		"name": "Ice Cream Cone",
		"coins": 1
	  },
	  "d244d4810758c3227e46074676e33ec8": {
		"name": "Trick or Treat",
		"coins": 299
	  },
	  "c9734b74f0e4e79bdfa2ef07c393d8ee": {
		"name": "Pumpkin",
		"coins": 1
	  },
	  "ff861a220649506452e3dc35c58266ea": {
		"name": "Peach",
		"coins": 5
	  },
	  "30063f6bc45aecc575c49ff3dbc33831": {
		"name": "Star Throne",
		"coins": 7999
	  },
	  "cb909c78f2412e4927ea68d6af8e048f": {
		"name": "Boo the Ghost",
		"coins": 88
	  },
	  "0573114db41d2cf9c7dd70c8b0fab38e": {
		"name": "Okay",
		"coins": 5
	  },
	  "312f721603de550519983ca22f5cc445": {
		"name": "Shamrock",
		"coins": 10
	  },
	  "a40b91f7a11d4cbce780989e2d20a1f4": {
		"name": "Ice cream",
		"coins": 5
	  },
	  "2db38e8f2a9fb804cb7d3bd2a0ba635c": {
		"name": "Love Balloon",
		"coins": 500
	  },
	  "0183cfcfc0dac56580cdc43956b73bfe": {
		"name": "Gimme The Vote",
		"coins": 1
	  },
	  "3c5e5fc699ed9bee71e79cc90bc5ab37": {
		"name": "Drip Brewing",
		"coins": 10
	  },
	  "43e1dee87ec71c57ab578cb861bbd749": {
		"name": "Music Play",
		"coins": 1
	  },
	  "b48c69f4df49c28391bcc069bbc31b41": {
		"name": "You're Amazing",
		"coins": 500
	  },
	  "cb4e11b3834e149f08e1cdcc93870b26": {
		"name": "Confetti",
		"coins": 100
	  },
	  "909e256029f1649a9e7e339ef71c6896": {
		"name": "Potato",
		"coins": 5
	  },
	  "d4faa402c32bf4f92bee654b2663d9f1": {
		"name": "Coral",
		"coins": 499
	  },
	  "97a26919dbf6afe262c97e22a83f4bf1": {
		"name": "Swan",
		"coins": 699
	  },
	  "a03bf81f5759ed3ffb048e1ca71b2b5e": {
		"name": "Good Night",
		"coins": 10
	  },
	  "01d07ef5d45eeedce64482be2ee10a74": {
		"name": "Dumplings",
		"coins": 10
	  },
	  "90a405cf917cce27a8261739ecd84b89": {
		"name": "Phoenix Flower",
		"coins": 5
	  },
	  "2c9cec686b98281f7319b1a02ba2864a": {
		"name": "Lock and Key",
		"coins": 199
	  },
	  "d990849e0435271bc1e66397ab1dec35": {
		"name": "Singing Mic",
		"coins": 399
	  },
	  "0115cb20f6629dc50d39f6b747bddf73": {
		"name": "Wedding",
		"coins": 1500
	  },
	  "96d9226ef1c33784a24d0779ad3029d3": {
		"name": "Glowing Jellyfish",
		"coins": 1000
	  },
	  "af980f4ec9ed73f3229df8dfb583abe6": {
		"name": "Future Encounter",
		"coins": 1500
	  },
	  "4227ed71f2c494b554f9cbe2147d4899": {
		"name": "Train",
		"coins": 899
	  },
	  "1d1650cd9bb0e39d72a6e759525ffe59": {
		"name": "Watermelon Love",
		"coins": 1000
	  },
	  "ed2cc456ab1a8619c5093eb8cfd3d303": {
		"name": "Sage the Smart Bean",
		"coins": 399
	  },
	  "9494c8a0bc5c03521ef65368e59cc2b8": {
		"name": "Fireworks",
		"coins": 1088
	  },
	  "3cbaea405cc61e8eaab6f5a14d127511": {
		"name": "Rosie the Rose Bean",
		"coins": 399
	  },
	  "767d7ea90f58f3676bbc5b1ae3c9851d": {
		"name": "Rocky the Rock Bean",
		"coins": 399
	  },
	  "9f8bd92363c400c284179f6719b6ba9c": {
		"name": "Boxing Gloves",
		"coins": 299
	  },
	  "f76750ab58ee30fc022c9e4e11d25c9d": {
		"name": "Blooming Ribbons",
		"coins": 1000
	  },
	  "0e3769575f5b7b27b67c6330376961a4": {
		"name": "Jollie the Joy Bean",
		"coins": 399
	  },
	  "1153dd51308c556cb4fcc48c7d62209f": {
		"name": "Fruit Friends",
		"coins": 299
	  },
	  "fa6bd8486df33dbe732381fa5c6cf441": {
		"name": "Lovely Music",
		"coins": 999
	  },
	  "af67b28480c552fd8e8c0ae088d07a1d": {
		"name": "Under Control",
		"coins": 1500
	  },
	  "71883933511237f7eaa1bf8cd12ed575": {
		"name": "Meteor Shower",
		"coins": 3000
	  },
	  "6517b8f2f76dc75ff0f4f73107f8780e": {
		"name": "Motorcycle",
		"coins": 2988
	  },
	  "3f1945b0d96e665a759f747e5e0cf7a9": {
		"name": "Cooper Flies Home",
		"coins": 1999
	  },
	  "1ea8dbb805466c4ced19f29e9590040f": {
		"name": "Chasing the Dream",
		"coins": 1500
	  },
	  "1420cc77d628c49516b9330095101496": {
		"name": "Love Explosion",
		"coins": 1500
	  },
	  "5d456e52403cefb87d6d78c9cabb03db": {
		"name": "The Running 9",
		"coins": 1399
	  },
	  "6b103f9ea6c313b8df68be92e54202cc": {
		"name": "Shaking Drum",
		"coins": 2500
	  },
	  "e7ce188da898772f18aaffe49a7bd7db": {
		"name": "Sports Car",
		"coins": 7000
	  },
	  "1d067d13988e8754ed6adbebd89b9ee8": {
		"name": "Flying Jets",
		"coins": 5000
	  },
	  "f334260276d5fa0de91c5fb61e26d07d": {
		"name": "Lantern Road",
		"coins": 5000
	  },
	  "921c6084acaa2339792052058cbd3fd3": {
		"name": "Private Jet",
		"coins": 4888
	  },
	  "universe": {
		"name": "Universe",
		"coins": 34999
	  },
	  "lion": {
		"name": "Lion",
		"coins": 29999
	  },
	  "drama-king": {
		"name": "Drama King",
		"coins": 49999
	  },
	  "donut-tower": {
		"name": "Donut Tower",
		"coins": 4999
	  },
	  "diamond-crown": {
		"name": "Diamond Crown",
		"coins": 5999
	  },
	  "tiktok-crown": {
		"name": "TikTok Crown",
		"coins": 8999
	  },
	  "fans_starter_upgraded_gift": {
		"name": "upgraded gift"
	  }
	};


	function getIdFromUrl(url) {
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
		if (!ele || ele.dataset.skip) {
			return;
		}
		if (ele?.parentNode?.dataset.skip) {
			return;
		}
		if (ele.querySelector("[class*='DivTopGiverContainer']")) {
			return;
		}
		if (checkNextSiblingsForAttribute(ele, "data-skip")) {
			ele.dataset.skip = ++msgCount;
			return;
		}
		ele.dataset.skip = ++msgCount;
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
							chatmessage = escapeHtml(eles[i].textContent);
						} else if (settings.textonlymode) {
							chatmessage = escapeHtml(eles[i].textContent);
						} else {
							chatmessage = getAllContentNodes(eles[i]);
						}
						if (chatmessage) break;
					}
				} else if (eles.length == 1) {
					for (var i = eles[0].childNodes.length - 1; i >= 1; i--) {
						if (settings.textonlymode) {
							chatmessage = escapeHtml(eles[0].childNodes[i].textContent);
						} else {
							chatmessage = getAllContentNodes(eles[0].childNodes[i]);
						}
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
			if (chatmessage.includes("×") && chatmessage.includes("<img src=") && chatmessage.includes(".tiktokcdn.com/img/")) {
				chatmessage = chatmessage.replace("<img src=", " <img src=");
				chatmessage = chatmessage.replace('.png">×', '.png"> ×');
				chatmessage = chatmessage.replace(".png'>×", ".png'> ×");
				
				// keep original × symbol for accurate parsing
				
				if (settings.tiktokdonations || !settings.notiktokdonations) {
					// Extract image URL and quantity directly
					var imgMatch = chatmessage.match(/<img src="([^"]+\.tiktokcdn\.com\/img\/[^"]+)"[^>]*>\s*×\s*(\d+)/i);
					if (!imgMatch) {
						imgMatch = chatmessage.match(/<img src='([^']+\.tiktokcdn\.com\/img\/[^']+)'[^>]*>\s*×\s*(\d+)/i);
					}
					
					if (imgMatch) {
						var imageSrc = imgMatch[1];
						var quantity = parseInt(imgMatch[2]) || 1;
						
						// Extract gift ID from URL
						var giftidMatch = imageSrc.match(/\/([a-f0-9]{32})(?:~|\.)/);
						if (giftidMatch) {
							var giftid = giftidMatch[1];
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
			avatarCache.add(chatname, chatimg, chatbadges, membership, nameColor);
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
			if (!settings.capturelikeevent) {
				return;
			}
			ital = "liked";
			if (!chatname) {
				return;
			}
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
		let giftIndexKey = "";
		if (isGiftMessage) {
			try {
				const indexValue = ele?.dataset?.index || ele?.closest?.("[data-index]")?.dataset?.index || "";
				if (indexValue) {
					giftIndexKey = `idx=${indexValue}`;
				}
			} catch (e) {}
		}
		if ((!isGiftMessage || giftIndexKey) && messageLog?.isDuplicate(chatname, chatmessage, giftIndexKey)) {
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
		lastMessageTime = Date.now();
		pushMessage(data);
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
		if (chatmessage && (ele.classList.contains("DivGiftMessage") || ele.querySelector("[class*='SpanGiftCount']"))) {
			ital = "gift";
					try {
						// Normalize HTML entity to multiplication sign
						if (chatmessage) chatmessage = chatmessage.replace(/&times;?/g, '×');
						if ((chatmessage.includes("×")) && chatmessage.includes("<img src=") && chatmessage.includes(".tiktokcdn.com/img/")) {
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
			if (!settings.capturelikeevent) {
				return;
			}
			ital = "liked";
			if (!chatname) {
				return;
			}
		}
		let chatimg = "";
		let cachedBadges = "";
		let cachedMembership = "";
		let cachedNameColor = "";
		if (chatname) {
			const cached = avatarCache.get(chatname);
			chatimg = cached.url || "";
			cachedBadges = cached.badges || "";
			cachedMembership = cached.membership || "";
			cachedNameColor = cached.nameColor || "";
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
		lastMessageTime = Date.now();
		pushMessage(data);
	}
	var bigDUPE = false;
	let observedDomElementForObserver1 = null;
	let observedDomElementForObserver2 = null;
	var observer = false;
	var observer2 = false;
	var counter = 0;
	var lastMessageTime = Date.now();
	var observerHealthCheckInterval = 60000; // Check every minute
	
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
						let viewText = viewerCount.textContent;

						if (viewText.startsWith("· ")){
							viewText = viewText.replace("· ","");
						}

						let multiplier = 1;
						if (viewText.includes("K")) {
							multiplier = 1000;
							viewText = viewText.replace("K", "");
						} else if (viewText.includes("M")) {
							multiplier = 1000000;
							viewText = viewText.replace("M", "");
						}
						if (viewText == parseFloat(viewText)) {
							views = parseFloat(viewText) * multiplier;
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
		
		if (observer && observedDomElementForObserver1) {
			// Check if the observed element is still connected
			if (!observedDomElementForObserver1.isConnected) {
				console.log("[TikTok] Observer target disconnected, will re-establish");
				observer.disconnect();
				observer = false;
				observedDomElementForObserver1 = null;
			} else {
				//console.log("<<>");
				return;
			}
		}
		//console.log("..................");
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
				mutations.forEach((mutation) => {
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
								let msg = (node.dataset && node.dataset.e2e === "chat-message") ? node : (node.querySelector && node.querySelector('[data-e2e="chat-message"]'));
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
		const currentTargetForTimeout = target;
		setTimeout(function() {
			if (observer && observer instanceof MutationObserver && currentTargetForTimeout && currentTargetForTimeout.isConnected && isExtensionOn) {
				if (currentTargetForTimeout.children) {
					Array.from(currentTargetForTimeout.children).forEach(ele => {
						if (ele && ele.dataset && ele.isConnected) {
							ele.dataset.skip = ++msgCount;
						}
					});
				}
				document.querySelectorAll('[data-e2e="chat-message"]').forEach(ele => {
					ele.dataset.skip = ++msgCount;
				});
				observer.observe(currentTargetForTimeout, {
					childList: true,
					subtree: subtree
				});
				observedDomElementForObserver1 = currentTargetForTimeout;
				////console.log("Main observer is now observing.", currentTargetForTimeout);
			} else {
				if (observer instanceof MutationObserver) {
					observer.disconnect();
				}
				observer = false;
				observedDomElementForObserver1 = null;
				////console.log("Main observer NOT started or target/state became invalid before observe.", currentTargetForTimeout);
			}

		}, 2000);
	}

	function start2(other = false) {
		if (!isExtensionOn) {
			return;
		}
		if (observer2 && observedDomElementForObserver2) {
			// Check if the observed element is still connected
			if (!observedDomElementForObserver2.isConnected) {
				console.log("[TikTok] Observer2 target disconnected, will re-establish");
				observer2.disconnect();
				observer2 = false;
				observedDomElementForObserver2 = null;
			} else {
				return;
			}
		}
		var target2 = document.querySelector('[class*="DivBottomStickyMessageContainer"], [class="w-full h-auto overflow-hidden flex-shrink-0 max-h-[200px] min-h-32"]');
		if (!target2 && other && other.isConnected && other.nextElementSibling) {
			target2 = other.nextElementSibling;
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
