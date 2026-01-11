(function () {
	/**
	 * Social Stream Ninja - Nostr Protocol Integration (NIP-53 Live Activities)
	 * 
	 * Connects directly to Nostr relays via WebSocket to capture live streaming events:
	 * - Zap receipts (kind 9735) - Lightning donations
	 * - Live chat messages (kind 1311) - NIP-53 Live Activities
	 * 
	 * ============================================================================
	 * HOW IT WORKS (NIP-53):
	 * ============================================================================
	 * 
	 * 1. Find active live stream (kind 30311) where streamer is host (#p = pubkey)
	 * 2. Extract stream ID from "d" tag
	 * 3. Subscribe to zaps & chat using #a = "30311:<pubkey>:<stream_id>"
	 * 
	 * ============================================================================
	 * USAGE:
	 * ============================================================================
	 * 
	 * Just provide the streamer's npub:
	 * 
	 *    https://socialstream.ninja/?server=nostr&npub=npub1streamer...
	 * 
	 * The provider will automatically:
	 * - Find their active live stream
	 * - Subscribe to zaps and chat for that stream
	 * 
	 * ============================================================================
	 * URL PARAMETERS:
	 * ============================================================================
	 * 
	 * Required:
	 *   server=nostr        Activate Nostr provider
	 *   npub=npub1xxx       Streamer's npub
	 *   -OR-
	 *   pubkey=abc123...    Hex pubkey instead of npub
	 * 
	 * Optional:
	 *   relay=wss://...     Single relay URL
	 *   relays=wss://a,wss://b   Multiple relays (comma-separated)
	 *   streamid=xxx        Manual stream ID (skip auto-detection)
	 * 
	 * ============================================================================
	 * EXAMPLES:
	 * ============================================================================
	 * 
	 * Auto-detect live stream:
	 *   ?server=nostr&npub=npub1abcd1234...
	 * 
	 * Use zapstream relay:
	 *   ?server=nostr&npub=npub1xxx&relay=wss://relay.zap.stream
	 * 
	 * Manual stream ID:
	 *   ?server=nostr&npub=npub1xxx&streamid=my-stream-id
	 * 
	 * ============================================================================
	 */

	var isExtensionOn = true;
	var settings = {};
	var websockets = [];
	var seenEvents = new Set();
	var profileCache = new Map();
	var pendingProfileCallbacks = new Map(); // Store callbacks waiting for profiles

	// Default configuration
	var config = {
		relays: [
			'wss://relay.damus.io',
			'wss://nos.lol',
			'wss://relay.snort.social'
		],
		npub: '',
		pubkey: '',
		streamId: '',      // Live stream "d" tag
		aTag: '',          // Full "a" tag reference: 30311:<pubkey>:<d>
		kinds: [9735, 1311], // zaps, live chat (NIP-53)
		limit: 100
	};
	
	var liveStreamInfo = null; // Current live stream metadata

	// Parse URL parameters for configuration
	function parseConfig() {
		try {
			var urlParams = new URLSearchParams(window.location.search);
			
			// Single relay or multiple
			var relay = urlParams.get('relay') || urlParams.get('nostr_relay');
			if (relay) {
				config.relays = [relay];
			}
			
			var relays = urlParams.get('relays');
			if (relays) {
				config.relays = relays.split(',').map(r => r.trim());
			}

			// Target npub
			var npub = urlParams.get('npub') || urlParams.get('nostr_npub');
			if (npub) {
				config.npub = npub;
				config.pubkey = npubToHex(npub);
			}

			// Hex pubkey directly
			var pubkey = urlParams.get('pubkey');
			if (pubkey) {
				config.pubkey = pubkey;
			}

			// Manual stream ID (optional - skip auto-detection)
			var streamId = urlParams.get('streamid') || urlParams.get('stream_id');
			if (streamId) {
				config.streamId = streamId;
				if (config.pubkey) {
					config.aTag = '30311:' + config.pubkey + ':' + streamId;
				}
			}

			console.log("Nostr config:", config);
		} catch(e) {
			console.error("Error parsing config:", e);
		}
	}

	// Convert npub (bech32) to hex pubkey
	function npubToHex(npub) {
		if (!npub || !npub.startsWith('npub1')) {
			return npub; // Already hex or invalid
		}
		try {
			// Bech32 decode
			var ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
			var decoded = [];
			npub = npub.toLowerCase();
			
			for (var i = 5; i < npub.length - 6; i++) {
				decoded.push(ALPHABET.indexOf(npub[i]));
			}
			
			// Convert 5-bit to 8-bit
			var bytes = [];
			var acc = 0;
			var bits = 0;
			for (var i = 0; i < decoded.length; i++) {
				acc = (acc << 5) | decoded[i];
				bits += 5;
				while (bits >= 8) {
					bits -= 8;
					bytes.push((acc >> bits) & 0xff);
				}
			}
			
			return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
		} catch(e) {
			console.error("Error decoding npub:", e);
			return '';
		}
	}

	// Convert hex pubkey to npub for display
	function hexToNpub(hex) {
		if (!hex || hex.length !== 64) return hex;
		try {
			// Simplified - just return shortened hex for display
			return hex.substring(0, 8) + '...';
		} catch(e) {
			return hex.substring(0, 8);
		}
	}

	function escapeHtml(unsafe) {
		if (!unsafe) return "";
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;") || "";
	}

	// Fetch profile metadata (kind 0)
	function fetchProfile(pubkey, callback) {
		if (profileCache.has(pubkey)) {
			callback(profileCache.get(pubkey));
			return;
		}

		// Add callback to pending list
		if (!pendingProfileCallbacks.has(pubkey)) {
			pendingProfileCallbacks.set(pubkey, []);
		}
		pendingProfileCallbacks.get(pubkey).push(callback);

		// Only request if this is the first callback for this pubkey
		if (pendingProfileCallbacks.get(pubkey).length === 1) {
			// Request profile from first connected relay
			for (var ws of websockets) {
				if (ws.readyState === WebSocket.OPEN) {
					var subId = 'profile_' + pubkey.substring(0, 8);
					var filter = {
						kinds: [0],
						authors: [pubkey],
						limit: 1
					};
					ws.send(JSON.stringify(['REQ', subId, filter]));
					
					// Set timeout to use default if not found
					setTimeout(function() {
						if (!profileCache.has(pubkey) && pendingProfileCallbacks.has(pubkey)) {
							var defaultProfile = {
								name: hexToNpub(pubkey),
								picture: ''
							};
							profileCache.set(pubkey, defaultProfile);
							// Call all pending callbacks
							var callbacks = pendingProfileCallbacks.get(pubkey) || [];
							pendingProfileCallbacks.delete(pubkey);
							callbacks.forEach(function(cb) { cb(defaultProfile); });
						}
					}, 3000);
					return;
				}
			}
		} else {
			// Already requested, just wait for callback
			return;
		}
		
		// No connected relay, use default immediately
		var defaultProfile = { name: hexToNpub(pubkey), picture: '' };
		var callbacks = pendingProfileCallbacks.get(pubkey) || [];
		pendingProfileCallbacks.delete(pubkey);
		callbacks.forEach(function(cb) { cb(defaultProfile); });
	}

	// Parse Zap receipt (kind 9735)
	function parseZapReceipt(event) {
		var zapInfo = {
			amount: 0,
			message: '',
			zapper: '',
			zappee: ''
		};

		try {
			// Get bolt11 invoice from tags
			var bolt11Tag = event.tags.find(t => t[0] === 'bolt11');
			if (bolt11Tag && bolt11Tag[1]) {
				// Extract amount from bolt11
				var bolt11 = bolt11Tag[1].toLowerCase();
				var amountMatch = bolt11.match(/lnbc(\d+)([munp]?)/);
				if (amountMatch) {
					var num = parseInt(amountMatch[1], 10);
					var unit = amountMatch[2] || '';
					// Convert to millisats then to sats
					switch(unit) {
						case 'm': zapInfo.amount = num * 100000; break; // milli
						case 'u': zapInfo.amount = num * 100; break; // micro
						case 'n': zapInfo.amount = num / 10; break; // nano
						case 'p': zapInfo.amount = num / 10000; break; // pico
						default: zapInfo.amount = num * 100000000; break; // no unit = BTC
					}
					zapInfo.amount = Math.round(zapInfo.amount / 1000); // Convert msats to sats
				}
			}

			// Get zapper (sender) from description tag
			var descTag = event.tags.find(t => t[0] === 'description');
			if (descTag && descTag[1]) {
				try {
					var zapRequest = JSON.parse(descTag[1]);
					zapInfo.zapper = zapRequest.pubkey || '';
					zapInfo.message = zapRequest.content || '';
				} catch(e) {}
			}

			// Get zappee (recipient) from p tag
			var pTag = event.tags.find(t => t[0] === 'p');
			if (pTag && pTag[1]) {
				zapInfo.zappee = pTag[1];
			}

		} catch(e) {
			console.error("Error parsing zap:", e);
		}

		return zapInfo;
	}

	// Process Nostr event
	function processEvent(event) {
		if (!event || !event.id) return;
		
		// Deduplicate
		if (seenEvents.has(event.id)) return;
		seenEvents.add(event.id);
		
		// Limit seen events cache
		if (seenEvents.size > 1000) {
			var iterator = seenEvents.values();
			seenEvents.delete(iterator.next().value);
		}

		var data = {
			chatname: '',
			chatbadges: '',
			backgroundColor: '',
			textColor: '',
			chatmessage: '',
			chatimg: '',
			hasDonation: '',
			membership: '',
			contentimg: '',
			textonly: settings.textonlymode || false,
			type: 'nostr'
		};

		switch(event.kind) {
			case 0: // Profile metadata
				try {
					var profile = JSON.parse(event.content);
					var profileData = {
						name: profile.name || profile.display_name || hexToNpub(event.pubkey),
						picture: profile.picture || ''
					};
					profileCache.set(event.pubkey, profileData);
					
					// Call any pending callbacks waiting for this profile
					if (pendingProfileCallbacks.has(event.pubkey)) {
						var callbacks = pendingProfileCallbacks.get(event.pubkey);
						pendingProfileCallbacks.delete(event.pubkey);
						callbacks.forEach(function(cb) { cb(profileData); });
					}
				} catch(e) {}
				return; // Don't push profile events as messages

			case 30311: // Live stream event (NIP-53)
				// Extract stream info and subscribe to chat/zaps
				handleLiveStreamEvent(event);
				return;

			case 1311: // Live chat message (NIP-53)
				data.chatmessage = escapeHtml(event.content);
				break;

			case 9735: // Zap receipt
				var zap = parseZapReceipt(event);
				if (zap.amount > 0) {
					data.hasDonation = zap.amount.toLocaleString() + ' sats';
					data.chatmessage = zap.message ? 
						'⚡️ ' + zap.amount.toLocaleString() + ' sats: ' + escapeHtml(zap.message) :
						'⚡️ ' + zap.amount.toLocaleString() + ' sats';
					data.event = 'donation';
					data.title = 'ZAP';
					data.donoValue = zap.amount / 100; // Approximate USD value
					
					// Use zapper's pubkey for profile
					event.pubkey = zap.zapper || event.pubkey;
				} else {
					return; // Skip invalid zaps
				}
				break;

			default:
				return; // Skip unknown kinds
		}

		// Fetch profile for the event author
		fetchProfile(event.pubkey, function(profile) {
			data.chatname = profile.name || hexToNpub(event.pubkey);
			data.chatimg = profile.picture || '';
			
			if (data.chatmessage || data.hasDonation) {
				pushMessage(data);
			}
		});
	}

	// Handle live stream event (kind 30311)
	function handleLiveStreamEvent(event) {
		// Skip if we already found a live stream
		if (liveStreamInfo && liveStreamInfo.status === 'live') {
			return;
		}
		
		// Extract "d" tag (stream ID)
		var dTag = event.tags.find(t => t[0] === 'd');
		if (!dTag || !dTag[1]) {
			console.log("Live stream event missing 'd' tag");
			return;
		}
		
		var streamId = dTag[1];
		var status = '';
		var title = '';
		
		// Extract other useful tags
		event.tags.forEach(function(tag) {
			if (tag[0] === 'status') status = tag[1];
			if (tag[0] === 'title') title = tag[1];
		});
		
		console.log("Found live stream:", {
			id: streamId,
			status: status,
			title: title,
			pubkey: event.pubkey
		});
		
		// Only subscribe if stream is "live"
		if (status !== 'live') {
			console.log("Stream status is not 'live', skipping:", status);
			return;
		}
		
		// Store live stream info
		liveStreamInfo = {
			id: streamId,
			pubkey: event.pubkey,
			title: title,
			status: status,
			aTag: '30311:' + event.pubkey + ':' + streamId
		};
		
		// Update config with discovered stream
		config.streamId = streamId;
		config.aTag = liveStreamInfo.aTag;
		
		console.log("Subscribing to live stream chat/zaps with #a =", config.aTag);
		
		// Subscribe to zaps and chat for this specific stream
		subscribeToLiveChat();
	}

	// Subscribe to live chat and zaps for the current stream
	function subscribeToLiveChat() {
		if (!config.aTag) {
			console.error("No stream aTag configured");
			return;
		}
		
		for (var ws of websockets) {
			if (ws.readyState === WebSocket.OPEN) {
				// Subscribe to zaps and chat using #a tag
				var filter = {
					kinds: config.kinds, // [9735, 1311]
					'#a': [config.aTag],
					limit: config.limit
				};
				
				console.log("Subscribing to live events:", filter);
				ws.send(JSON.stringify(['REQ', 'live_' + config.streamId, filter]));
			}
		}
	}

	// Connect to Nostr relay
	function connectRelay(url) {
		console.log("Connecting to relay:", url);
		
		try {
			var ws = new WebSocket(url);
			
			ws.onopen = function() {
				console.log("Connected to relay:", url);
				
				// Step 1: Find active live stream for this pubkey
				if (config.pubkey && !config.aTag) {
					// Subscribe to live stream events (kind 30311) where this pubkey is host
					var liveStreamFilter = {
						kinds: [30311],
						authors: [config.pubkey],
						limit: 10
					};
					
					console.log("Step 1: Finding live streams for pubkey:", config.pubkey);
					ws.send(JSON.stringify(['REQ', 'find_stream', liveStreamFilter]));
				} 
				// If we already have aTag (manual streamid or already discovered)
				else if (config.aTag) {
					console.log("Using provided stream aTag:", config.aTag);
					subscribeToLiveChat();
				}
			};
			
			ws.onmessage = function(e) {
				try {
					var msg = JSON.parse(e.data);
					
					if (msg[0] === 'EVENT' && msg[2]) {
						processEvent(msg[2]);
					} else if (msg[0] === 'EOSE') {
						console.log("End of stored events for subscription:", msg[1]);
					} else if (msg[0] === 'NOTICE') {
						console.log("Relay notice:", msg[1]);
					}
				} catch(err) {
					console.error("Error parsing relay message:", err);
				}
			};
			
			ws.onerror = function(e) {
				console.error("Relay error:", url, e);
			};
			
			ws.onclose = function(e) {
				console.log("Relay closed:", url, "Reconnecting in 5s...");
				// Remove from active websockets
				var idx = websockets.indexOf(ws);
				if (idx > -1) websockets.splice(idx, 1);
				
				// Reconnect after delay
				setTimeout(function() {
					if (isExtensionOn) {
						connectRelay(url);
					}
				}, 5000);
			};
			
			websockets.push(ws);
		} catch(e) {
			console.error("Error connecting to relay:", url, e);
		}
	}

	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e) {});
		} catch(e) {
			console.error("Error sending message:", e);
		}
	}

	// Chrome extension message handling
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response) {
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if ("getSource" == request) {
				sendResponse("nostr");
				return;
			}
			if ("focusChat" == request) {
				// Try to focus any chat input on the page
				var input = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
				if (input) {
					input.focus();
					sendResponse(true);
				} else {
					sendResponse(false);
				}
				return;
			}
			if (typeof request === "object") {
				if ("settings" in request) {
					settings = request.settings;
					sendResponse(true);
					return;
				}
				// Allow runtime configuration updates
				if ("nostrConfig" in request) {
					Object.assign(config, request.nostrConfig);
					// Reconnect with new config
					websockets.forEach(ws => ws.close());
					websockets = [];
					setTimeout(initializeConnections, 1000);
					sendResponse(true);
					return;
				}
			}
		} catch(e) {}
		sendResponse(false);
	});

	function initializeConnections() {
		parseConfig();
		
		// Connect to all configured relays
		config.relays.forEach(function(relay) {
			connectRelay(relay);
		});
	}

	console.log("Social Stream Ninja - Nostr Protocol integration loaded");
	
	// Initialize after short delay
	setTimeout(initializeConnections, 1000);

	// Keep-alive trick to prevent Chrome from throttling the tab
	try {
		var receiveChannelCallback = function(e) {
			remoteConnection.datachannel = e.channel;
			remoteConnection.datachannel.onmessage = function() {};
			remoteConnection.datachannel.onopen = function() {};
			remoteConnection.datachannel.onclose = function() {};
			setInterval(function() {
				if (document.hidden) {
					remoteConnection.datachannel.send("KEEPALIVE");
				}
			}, 800);
		};
		
		var errorHandle = function(e) {};
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = (e) => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function() { localConnection.sendChannel.send("CONNECTED"); };
		localConnection.sendChannel.onclose = function() {};
		localConnection.sendChannel.onmessage = function() {};
		
		localConnection.createOffer()
			.then((offer) => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then((answer) => remoteConnection.setLocalDescription(answer))
			.then(() => {
				localConnection.setRemoteDescription(remoteConnection.localDescription);
			})
			.catch(errorHandle);
	} catch(e) {}

})();
