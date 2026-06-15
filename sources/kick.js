(async function () {
	
	// Function to rewrite old Kick URLs to new format
	function rewriteKickUrl(url) {
		const parsed = parseKickUrl(url);
		if (!parsed || parsed.variant !== 'chatroom') {
			return url; // Not an old chatroom URL
		}

		const localeSegment = parsed.locale ? `${encodeURIComponent(parsed.locale)}/` : '';
		const encodedUsername = encodeURIComponent(parsed.username);
		const search = parsed.url.search || '';
		const hash = parsed.url.hash || '';
		const newUrl = `${parsed.url.origin}/${localeSegment}popout/${encodedUsername}/chat${search}${hash}`;

		if (newUrl !== url) {
			console.log(`[Social Stream] Rewriting old Kick URL: ${url} -> ${newUrl}`);
		}

		return newUrl;
	}

	function parseKickUrl(url) {
		try {
			const baseOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://kick.com';
			const parsedUrl = new URL(url, baseOrigin);
			if (!parsedUrl.hostname || !parsedUrl.hostname.toLowerCase().endsWith('kick.com')) {
				return null;
			}

			const rawSegments = parsedUrl.pathname.split('/').filter(Boolean);
			if (!rawSegments.length) {
				return null;
			}

			const lowerSegments = rawSegments.map(seg => seg.toLowerCase());
			const lastSegment = lowerSegments[lowerSegments.length - 1];

			let variant = null;
			let username = null;
			let locale = null;

			if (lastSegment === 'chat') {
				const popoutIndex = lowerSegments.lastIndexOf('popout');
				if (popoutIndex === -1 || popoutIndex + 1 >= rawSegments.length) {
					return null;
				}
				variant = 'popout';
				username = rawSegments[popoutIndex + 1];
				if (popoutIndex === 1) {
					locale = rawSegments[0];
				} else if (popoutIndex > 1) {
					return null; // Unexpected extra path segments before popout
				}
			} else if (lastSegment === 'chatroom') {
				variant = 'chatroom';
				if (rawSegments.length < 2) {
					return null;
				}
				username = rawSegments[rawSegments.length - 2];
				if (rawSegments.length === 3) {
					locale = rawSegments[0];
				} else if (rawSegments.length > 3) {
					return null; // Unsupported structure
				}
			} else {
				return null;
			}

			if (!username) {
				return null;
			}

			try {
				username = decodeURIComponent(username);
			} catch (e) {}

			if (locale) {
				try {
					locale = decodeURIComponent(locale);
				} catch (e) {}
			}

			return {
				url: parsedUrl,
				variant,
				username,
				locale
			};
		} catch (e) {
			return null;
		}
	}
	
	// Check and redirect if needed, but only once
	try {
		const currentUrl = window.location.href;
		const rewrittenUrl = rewriteKickUrl(currentUrl);
		
		// Only redirect if URL needs rewriting and we haven't already tried
		if (rewrittenUrl !== currentUrl && !sessionStorage.getItem('kick_redirect_attempted')) {
			// Mark that we've attempted a redirect to prevent loops
			sessionStorage.setItem('kick_redirect_attempted', 'true');
			window.location.replace(rewrittenUrl); // Use replace to avoid history issues
			// Stop all execution
			throw new Error('Redirecting to new Kick URL format');
		}
		
		// Clear the flag if we're on the correct URL
		if (currentUrl.includes('/popout/') && currentUrl.includes('/chat')) {
			sessionStorage.removeItem('kick_redirect_attempted');
		}
	} catch (e) {
		if (e.message !== 'Redirecting to new Kick URL format') {
			console.error('[Social Stream] Error in URL rewrite:', e);
		} else {
			return; // Stop execution for redirect
		}
	}
	
	var EMOTELIST = false;
	var BTTV = false;
	var SEVENTV = false;
	var FFZ = false;
	


	function mergeEmotes() { // BTTV takes priority over 7TV in this all.
		EMOTELIST = {};
		if (BTTV) {
			if (settings.bttv) {
				try {
					if (BTTV.channelEmotes) {
						EMOTELIST = BTTV.channelEmotes;
					}
					if (BTTV.sharedEmotes) {
						EMOTELIST = deepMerge(BTTV.sharedEmotes, EMOTELIST);
					}
					if (BTTV.globalEmotes) {
						EMOTELIST = deepMerge(BTTV.globalEmotes, EMOTELIST);
					}
				} catch (e) {}
			}
		}
		if (SEVENTV) {
			if (settings.seventv) {
				try {
					if (SEVENTV.channelEmotes) {
						EMOTELIST = deepMerge(SEVENTV.channelEmotes, EMOTELIST);
					}
				} catch (e) {}
				try {
					if (SEVENTV.globalEmotes) {
						EMOTELIST = deepMerge(SEVENTV.globalEmotes, EMOTELIST);
					}
				} catch (e) {}
			}
		}
		if (FFZ) {
			if (settings.ffz) {
				try {
					if (FFZ.channelEmotes) {
						EMOTELIST = deepMerge(FFZ.channelEmotes, EMOTELIST);
					}
				} catch (e) {}
				try {
					if (FFZ.globalEmotes) {
						EMOTELIST = deepMerge(FFZ.globalEmotes, EMOTELIST);
					}
				} catch (e) {}
			}
		}
	}

	function deepMerge(target, source) {
		for (let key in source) {
			if (source.hasOwnProperty(key)) {
				if (typeof source[key] === 'object' && source[key] !== null) {
					target[key] = target[key] || {};
					deepMerge(target[key], source[key]);
				} else {
					target[key] = source[key];
				}
			}
		}
		return target;
	}

	function replaceEmotesWithImages(text) {
		if (!EMOTELIST) {
			return text;
		}
		
		return text.replace(/(?<=^|\s)(\S+?)(?=$|\s)/g, (match, emoteMatch) => {
			const emote = EMOTELIST[emoteMatch];
			if (!emote) return match;
			
			const escapedMatch = escapeHtml(emoteMatch);
			const isZeroWidth = typeof emote !== "string" && emote.zw;
			return `<img src="${typeof emote === 'string' ? emote : emote.url}" alt="${escapedMatch}" title="${escapedMatch}" class="${isZeroWidth ? 'zero-width-emote' : 'regular-emote'}"/>`;
		});
	}
	
	// Implement LRU cache for user profiles to prevent memory leaks
	var cachedUserProfiles = new Map();
	var maxCachedProfiles = 10000; // Limit to 10,000 profiles
	var processedMessages = new Set();
	var maxTrackedMessages = 600;
	var pastMessages = [];
	var trackedKickMessageIds = new Map();
	var maxTrackedKickMessageIds = 500;
	var kickChatLastDomActivityAt = Date.now();
	var kickTransportObserved = false;
	var kickTransportOpenCount = 0;
	var kickTransportLastActivityAt = Date.now();
	var kickTransportLastRecoveryAt = 0;
	var kickTransportWatchdogTimer = null;
	var kickTransportReloadHistoryKey = "ss_kick_transport_reload_history";
	var kickTransportStartedAt = Date.now();
	var KICK_TRANSPORT_CLOSED_RECOVERY_MS = 2 * 60 * 1000;
	var KICK_TRANSPORT_STALE_RECOVERY_MS = 4 * 60 * 1000;
	var KICK_TRANSPORT_STARTUP_GRACE_MS = 5 * 60 * 1000;
	var KICK_TRANSPORT_RECOVERY_COOLDOWN_MS = 2 * 60 * 1000;
	var KICK_TRANSPORT_HARD_RELOAD_GRACE_MS = 15 * 60 * 1000;
	var KICK_TRANSPORT_RELOAD_WINDOW_MS = 30 * 60 * 1000;
	var KICK_TRANSPORT_RELOAD_LIMIT = 2;
	var kickDebugEnabled = false;
	var kickDebugLastLogAt = {};
	var kickDebugTransportFrameCount = 0;
	try {
		var kickDebugParams = new URLSearchParams(window.location.search || "");
		kickDebugEnabled = kickDebugParams.has("debugkick")
			|| kickDebugParams.has("kickdebug")
			|| kickDebugParams.get("debug") === "kick"
			|| localStorage.getItem("ss_kick_debug") === "1"
			|| sessionStorage.getItem("ss_kick_debug") === "1";
	} catch (e) {}

	function kickDebugLog(label, details) {
		if (!kickDebugEnabled) {
			return;
		}
		try {
			if (typeof details !== "undefined") {
				console.log("[Social Stream][Kick Debug] " + label, details);
			} else {
				console.log("[Social Stream][Kick Debug] " + label);
			}
		} catch (e) {}
	}

	function kickDebugLogThrottled(key, interval, label, details) {
		if (!kickDebugEnabled) {
			return;
		}
		var now = Date.now();
		if (kickDebugLastLogAt[key] && now - kickDebugLastLogAt[key] < interval) {
			return;
		}
		kickDebugLastLogAt[key] = now;
		kickDebugLog(label, typeof details === "function" ? details() : details);
	}

	function getKickDebugRowInfo(ele) {
		if (!kickDebugEnabled) {
			return null;
		}
		try {
			var row = getKickMessageContainer(ele) || (ele && ele.nodeType === 1 ? ele : null);
			if (!row) {
				return {
					nodeName: ele && ele.nodeName ? ele.nodeName : "",
					hasParent: Boolean(ele && ele.parentElement)
				};
			}
			var dataset = {};
			if (row.dataset) {
				Object.keys(row.dataset).forEach(function(key) {
					dataset[key] = row.dataset[key];
				});
			}
			return {
				nodeName: row.nodeName || "",
				className: typeof row.className === "string" ? row.className.slice(0, 180) : "",
				connected: row.isConnected,
				dataset: dataset,
				transform: row.style && row.style.transform ? row.style.transform : "",
				text: normalizeKickText(row.textContent || "").slice(0, 180),
				deleted: Boolean(row.deleted)
			};
		} catch (e) {
			return {
				error: e && e.message ? e.message : String(e)
			};
		}
	}

	kickDebugLog("debug enabled", {
		url: window.location.href,
		isPopoutChat: window.location.href.indexOf("/popout/") !== -1
	});

	// Persistent cache configuration
	const CACHE_KEY = 'kick_user_profiles_cache';
	const CACHE_EXPIRY_DAYS = 7;
	const CACHE_EXPIRY_MS = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

	function normalizeCacheEntry(entry) {
		if (!entry) {
			return null;
		}
		if (typeof entry === 'string') {
			return {
				profilePic: entry,
				timestamp: 0,
				pending: false
			};
		}
		if (typeof entry === 'object') {
			return {
				profilePic: typeof entry.profilePic === 'string' ? entry.profilePic : '',
				timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : 0,
				pending: Boolean(entry.pending)
			};
		}
		return null;
	}

	function isCacheEntryFresh(entry) {
		if (!entry) {
			return false;
		}
		if (!entry.profilePic) {
			return false;
		}
		if (!entry.timestamp) {
			return false;
		}
		return (Date.now() - entry.timestamp) < CACHE_EXPIRY_MS;
	}

	function isKickChatTransportUrl(url) {
		var value = String(url || "").toLowerCase();
		if (value.indexOf("pusher") !== -1 || value.indexOf("kick-bridge") !== -1) {
			return true;
		}
		return value.indexOf("kick.com") !== -1
			&& (value.indexOf("chat") !== -1 || value.indexOf("chatroom") !== -1 || value.indexOf("ws") !== -1);
	}

	function readKickTransportReloadHistory(now) {
		try {
			var raw = sessionStorage.getItem(kickTransportReloadHistoryKey) || "[]";
			var parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				return [];
			}
			return parsed
				.map(function(value) {
					return parseInt(value, 10) || 0;
				})
				.filter(function(value) {
					return value && now - value < KICK_TRANSPORT_RELOAD_WINDOW_MS;
				});
		} catch (e) {
			return [];
		}
	}

	function markKickTransportReload(now) {
		try {
			var history = readKickTransportReloadHistory(now);
			history.push(now);
			sessionStorage.setItem(kickTransportReloadHistoryKey, JSON.stringify(history));
			return true;
		} catch (e) {
			return true;
		}
	}

	function markKickChatDomActivity() {
		kickChatLastDomActivityAt = Date.now();
	}

	function requestKickTransportRecovery(reason) {
		var now = Date.now();
		if (now - kickTransportStartedAt < KICK_TRANSPORT_STARTUP_GRACE_MS) {
			kickDebugLogThrottled("transport-startup-grace", 30000, "transport recovery skipped during startup grace", {
				reason: reason,
				ageMs: now - kickTransportStartedAt
			});
			return;
		}
		if (now - kickTransportLastRecoveryAt < KICK_TRANSPORT_RECOVERY_COOLDOWN_MS) {
			kickDebugLogThrottled("transport-recovery-cooldown", 30000, "transport recovery skipped during cooldown", {
				reason: reason,
				cooldownRemainingMs: KICK_TRANSPORT_RECOVERY_COOLDOWN_MS - (now - kickTransportLastRecoveryAt)
			});
			return;
		}
		kickTransportLastRecoveryAt = now;
		var observerReady = false;
		try {
			observerReady = refreshKickChatObserver();
		} catch (e) {}
		if (observerReady) {
			kickDebugLog("transport recovery refreshed observer", {
				reason: reason,
				target: getKickDebugRowInfo(kickChatObserverTarget)
			});
			console.warn("[Social Stream] Kick chat transport looks idle; refreshed chat observer without reloading. Reason: " + reason);
			return;
		}
		if (now - kickTransportStartedAt < KICK_TRANSPORT_HARD_RELOAD_GRACE_MS) {
			kickDebugLog("transport recovery waiting before reload", {
				reason: reason,
				ageMs: now - kickTransportStartedAt
			});
			console.warn("[Social Stream] Kick chat transport looks idle and chat target is missing; waiting before reload. Reason: " + reason);
			return;
		}
		var history = readKickTransportReloadHistory(now);
		if (history.length >= KICK_TRANSPORT_RELOAD_LIMIT) {
			kickDebugLog("transport recovery reload limit reached", {
				reason: reason,
				history: history
			});
			return;
		}
		markKickTransportReload(now);
		kickDebugLog("transport recovery reloading window", {
			reason: reason,
			history: history
		});
		console.warn("[Social Stream] Kick chat transport stalled and chat target is missing; reloading source window. Reason: " + reason);
		try {
			window.location.reload();
		} catch (e) {}
	}

	function startKickTransportWatchdog() {
		try {
			if (!window.ninjafy || typeof window.ninjafy.onWebSocketMessage !== "function" || kickTransportWatchdogTimer) {
				kickDebugLogThrottled("transport-watchdog-not-started", 30000, "transport watchdog not started", {
					hasNinjafy: Boolean(window.ninjafy),
					hasWebSocketHook: Boolean(window.ninjafy && typeof window.ninjafy.onWebSocketMessage === "function"),
					alreadyStarted: Boolean(kickTransportWatchdogTimer)
				});
				return;
			}
			kickDebugLog("transport watchdog started");
			window.ninjafy.onWebSocketMessage(function(event) {
				if (!event || !isKickChatTransportUrl(event.url)) {
					return;
				}
				var now = Date.now();
				kickTransportObserved = true;
				if (event.type === "open") {
					kickTransportOpenCount++;
					kickTransportLastActivityAt = now;
					kickDebugLog("transport open", {
						url: event.url,
						openCount: kickTransportOpenCount
					});
				} else if (event.type === "close") {
					kickTransportOpenCount = Math.max(0, kickTransportOpenCount - 1);
					kickTransportLastActivityAt = now;
					kickDebugLog("transport close", {
						url: event.url,
						openCount: kickTransportOpenCount
					});
				} else if (event.type === "message" || event.type === "send") {
					kickDebugTransportFrameCount++;
					kickTransportLastActivityAt = now;
					kickDebugLogThrottled("transport-frames", 15000, "transport frames observed", {
						type: event.type,
						url: event.url,
						totalFrames: kickDebugTransportFrameCount,
						openCount: kickTransportOpenCount
					});
				}
			});
			kickTransportWatchdogTimer = setInterval(function() {
				if (!kickTransportObserved) {
					kickDebugLogThrottled("transport-not-observed", 60000, "transport not observed yet");
					return;
				}
				var lastActivityAt = Math.max(kickTransportLastActivityAt, kickChatLastDomActivityAt);
				var idleMs = Date.now() - lastActivityAt;
				kickDebugLogThrottled("transport-watchdog-state", 60000, "transport watchdog state", {
					openCount: kickTransportOpenCount,
					idleMs: idleMs,
					transportIdleMs: Date.now() - kickTransportLastActivityAt,
					domIdleMs: Date.now() - kickChatLastDomActivityAt
				});
				if (kickTransportOpenCount <= 0 && idleMs > KICK_TRANSPORT_CLOSED_RECOVERY_MS) {
					requestKickTransportRecovery("no open Kick websocket for " + Math.round(idleMs / 1000) + "s");
				} else if (idleMs > KICK_TRANSPORT_STALE_RECOVERY_MS) {
					requestKickTransportRecovery("no Kick websocket frames for " + Math.round(idleMs / 1000) + "s");
				}
			}, 30000);
		} catch (e) {}
	}
	
	// Load cached profiles from localStorage on startup
	function loadCachedProfiles() {
		try {
			const stored = localStorage.getItem(CACHE_KEY);
			if (stored) {
				const data = JSON.parse(stored);
				const now = Date.now();
				
				// Filter out expired entries and convert back to Map
				Object.entries(data).forEach(([username, entry]) => {
					const cachedEntry = normalizeCacheEntry(entry);
					if (!cachedEntry || !cachedEntry.profilePic) {
						return;
					}
					if (cachedEntry.timestamp && (now - cachedEntry.timestamp) < CACHE_EXPIRY_MS) {
						cachedUserProfiles.set(username, {
							profilePic: cachedEntry.profilePic,
							timestamp: cachedEntry.timestamp,
							pending: false
						});
					}
				});
				
				console.log(`[Social Stream] Loaded ${cachedUserProfiles.size} cached user profiles from localStorage`);
			}
		} catch (e) {
			console.error('[Social Stream] Error loading cached profiles:', e);
		}
	}
	
	// Save cached profiles to localStorage
	function saveCachedProfiles() {
		try {
			const data = {};
			const now = Date.now();
			
			// Convert Map to object with timestamps
			cachedUserProfiles.forEach((value, username) => {
				const cachedEntry = normalizeCacheEntry(value);
				if (!cachedEntry || !cachedEntry.profilePic || cachedEntry.pending) {
					return;
				}
				const entryTimestamp = cachedEntry.timestamp && cachedEntry.timestamp > 0 ? cachedEntry.timestamp : now;
				data[username] = {
					profilePic: cachedEntry.profilePic,
					timestamp: entryTimestamp
				};
			});
			
			localStorage.setItem(CACHE_KEY, JSON.stringify(data));
		} catch (e) {
			console.error('[Social Stream] Error saving cached profiles:', e);
			// If storage is full, clear old cache and try again
			if (e.name === 'QuotaExceededError') {
				localStorage.removeItem(CACHE_KEY);
				try {
					localStorage.setItem(CACHE_KEY, JSON.stringify({}));
				} catch (e2) {
					console.error('[Social Stream] Failed to clear cache:', e2);
				}
			}
		}
	}
	
	// Debounce saving to localStorage to avoid excessive writes
	let saveTimeout = null;
	let lastSaveTime = Date.now();
	const DEBOUNCE_DELAY = 5000; // 5 seconds of inactivity
	const MAX_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes max between saves
	
	function debouncedSaveCachedProfiles() {
		const now = Date.now();
		const timeSinceLastSave = now - lastSaveTime;
		
		// Clear existing timeout
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		
		// If it's been more than 5 minutes, save immediately
		if (timeSinceLastSave >= MAX_SAVE_INTERVAL) {
			saveCachedProfiles();
			lastSaveTime = now;
		} else {
			// Otherwise, save after 5 seconds of inactivity
			saveTimeout = setTimeout(() => {
				saveCachedProfiles();
				lastSaveTime = Date.now();
			}, DEBOUNCE_DELAY);
		}
	}
	
	// Load cached profiles on startup
	loadCachedProfiles();
	
	// Periodic cleanup of expired cache entries
	function cleanupExpiredCache() {
		try {
			const stored = localStorage.getItem(CACHE_KEY);
			if (stored) {
				const data = JSON.parse(stored);
				const now = Date.now();
				let hasExpired = false;
				
				// Remove expired entries
				Object.entries(data).forEach(([username, entry]) => {
					const cachedEntry = normalizeCacheEntry(entry);
					const isExpired = !cachedEntry || !cachedEntry.timestamp || (now - cachedEntry.timestamp) >= CACHE_EXPIRY_MS;
					const isEmpty = !cachedEntry || !cachedEntry.profilePic;
					if (isExpired || isEmpty) {
						delete data[username];
						hasExpired = true;
						// Also remove from memory cache if present
						cachedUserProfiles.delete(username);
					} else {
						data[username] = {
							profilePic: cachedEntry.profilePic,
							timestamp: cachedEntry.timestamp
						};
					}
				});
				
				// Save cleaned data if any entries were removed
				if (hasExpired) {
					localStorage.setItem(CACHE_KEY, JSON.stringify(data));
					console.log('[Social Stream] Cleaned up expired cache entries');
				}
			}
		} catch (e) {
			console.error('[Social Stream] Error cleaning up cache:', e);
		}
	}
	
	// Run cleanup on startup and periodically (every hour)
	cleanupExpiredCache();
	setInterval(cleanupExpiredCache, 60 * 60 * 1000);
	
	// Also ensure periodic saves every 5 minutes in case of continuous activity
	setInterval(() => {
		const now = Date.now();
		if (now - lastSaveTime >= MAX_SAVE_INTERVAL) {
			saveCachedProfiles();
			lastSaveTime = now;
		}
	}, 60 * 1000); // Check every minute
	
	function escapeHtml(unsafe){
		try {
			if (settings.textonlymode){ // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				 .replace(/&/g, "&amp;")
				 .replace(/</g, "&lt;")
				 .replace(/>/g, "&gt;")
				 .replace(/"/g, "&quot;")
				 .replace(/'/g, "&#039;") || "";
		} catch(e){
			return "";
		}
	}
		
	function extractKickUsername(url) {
		const parsed = parseKickUrl(url);
		if (parsed && parsed.username) {
			return parsed.username;
		}
		return false;
	}

	function extractKickLocale(url) {
		const parsed = parseKickUrl(url);
		if (parsed && parsed.locale) {
			return parsed.locale;
		}
		return false;
	}
	
	// Determine if we're on the new popout chat or the old chatroom
	var isPopoutChat = window.location.href.includes("/popout/") && window.location.href.includes("/chat");
	var isOldChatroom = window.location.href.includes("/chatroom");
	var isExtensionOn = true;
	var lastMessage = "";
	var settings = {};
	var runtimeMessageHandler = function (request, sender, sendResponse) {
		try {
			if ("getSource" == request) {
				sendResponse("kick");
				return;
			}
			if ("focusChat" == request) {
				var input = isPopoutChat ? document.querySelector('[data-input="true"]') : document.querySelector('#message-input');
				if (input && input.focus) {
					input.focus();
					sendResponse(true);
					return;
				}
				sendResponse(false);
				return;
			}
		} catch (e) {}
		sendResponse(false);
	};

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			return runtimeMessageHandler(request, sender, sendResponse);
		}
	);

	try {
		var kickUserID = false;
		var kickUsername = extractKickUsername(window.location.href);
		if (kickUsername){
			kickUserID = await getKickUserIdByUsername();
		}
	} catch(e){}

	var channelImg = "";
	  
	try {
		if (kickUsername){
			channelImg = await getKickAvatarImage(kickUsername, kickUsername) || "https://kick.com/img/default-profile-pictures/default2.jpeg";
		}
	} catch(e){}
	
	//console.log(channelImg, kickUsername);
	
	async function getKickViewerCount(username) {
		try {
			const response = await fetch(`https://kick.com/api/v2/channels/${username}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			if (data.livestream) {
				return data.livestream.viewer_count || 0;
			}

			return 0;

		} catch (error) {
			console.log(error);
			return 0;
		}
	}
	
	async function getKickUserIdByUsername() {
		try {
			const response = await fetch(`https://kick.com/api/v2/channels/${kickUsername}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch user data: ${response.status}`);
			}
			const data = await response.json();
			return data.user_id;
		} catch (error) {
			console.error(`Error fetching Kick user ID: ${error.message}`);
			return null;
		}
	}
	
	async function checkViewers(){
		if (kickUsername && isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				var viewers = await getKickViewerCount(kickUsername) || 0;
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					({message:{
							type: "kick",
							event: 'viewer_update',
							meta: viewers
						}
					}),
					function (e) {}
				);
			} catch (e) {
				console.log(e);
			}
		}
	}
	
	setTimeout(function(){checkViewers();},2500);
	setInterval(function(){checkViewers()},30000);
	
	function getAllContentNodes(element) {
		var resp = "";
		
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		if (settings.textonlymode) {
			element.childNodes.forEach(node=>{
				if (isKickIgnoredContentNode(node)) {
					return;
				}
				if (node.childNodes.length){
					resp += getAllContentNodes(node);
				} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
					resp += escapeHtml(node.textContent);
				} else if (node.nodeType === 1){
					resp += node.textContent || "";
				}
			});
			return resp;
		}
		
		
		element.childNodes.forEach(node=>{
			if (isKickIgnoredContentNode(node)) {
				return;
			}
			if (node.childNodes.length){
				if (node.classList && node.classList.contains("seventv-painted-content")){
					resp += node.outerHTML;
				} else if (node && (node.tagName == "A")){
					resp += " " + getAllContentNodes(node).trim() + " ";
				} else {
					resp += getAllContentNodes(node);
				}
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				if (EMOTELIST) {
					resp += replaceEmotesWithImages(escapeHtml(node.textContent));
				} else {
					resp += escapeHtml(node.textContent);
				}
			} else if (node.nodeType === 1){
				if (node && node.classList && node.classList.contains("zero-width-emote")){
					resp += "<span class='zero-width-parent'>"+node.outerHTML+"</span>";
				} else if (node && (node.tagName == "A")){
					resp += " " + node.outerHTML.trim() + " ";
				} else {
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	
	async function fetchWithTimeout(URL, timeout=2000){ // ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {...{timeout:timeout}, signal: controller.signal});
			clearTimeout(timeout_id);
			return response;
		} catch(e){
			console.error(e);
			return null;
		}
	}
	
	async function getKickAvatarImage(username, channelname){
		// Check if username exists in cache
		if (cachedUserProfiles.has(username)){
			const cachedEntry = normalizeCacheEntry(cachedUserProfiles.get(username));
			if (cachedEntry){
				if (cachedEntry.pending){
					return cachedEntry.profilePic || "";
				}
				if (isCacheEntryFresh(cachedEntry)){
					// Move to end (most recently used) without mutating timestamp
					cachedUserProfiles.delete(username);
					cachedUserProfiles.set(username, {
						profilePic: cachedEntry.profilePic,
						timestamp: cachedEntry.timestamp,
						pending: false
					});
					return cachedEntry.profilePic;
				}
				// Entry is stale; remove before refetching
				cachedUserProfiles.delete(username);
				debouncedSaveCachedProfiles();
			}
		}
		
		// Evict oldest entry if cache is full
		if (cachedUserProfiles.size >= maxCachedProfiles) {
			const firstKey = cachedUserProfiles.keys().next().value;
			cachedUserProfiles.delete(firstKey);
			debouncedSaveCachedProfiles(); // Save after eviction
		}
		
		// Add placeholder immediately to prevent duplicate requests
		cachedUserProfiles.set(username, {
			profilePic: "",
			timestamp: 0,
			pending: true
		});
		
		return await fetchWithTimeout("https://kick.com/channels/"+encodeURIComponent(channelname)+"/"+encodeURIComponent(username)).then(async response => {
			if (!response || !response.ok) {
				cachedUserProfiles.delete(username);
				debouncedSaveCachedProfiles();
				return "";
			}
			return await response.json().then(function (data) {
				if (data && data.profilepic){
					// Update cache with actual profile pic
					cachedUserProfiles.set(username, {
						profilePic: data.profilepic,
						timestamp: Date.now(),
						pending: false
					});
					debouncedSaveCachedProfiles(); // Save after adding new profile
					return data.profilepic;
				}
				// No profile pic returned; clear placeholder to allow future retries
				cachedUserProfiles.delete(username);
				debouncedSaveCachedProfiles();
			});
		}).catch(error => {
			cachedUserProfiles.delete(username);
			debouncedSaveCachedProfiles();
			//console.log("Couldn't get avatar image URL. API service down?");
		});
	}
	
	function clearMessageTracking() {
		processedMessages.clear();
	}

	function rememberKickProcessedMessage(messageId) {
		if (!messageId || processedMessages.has(messageId)) {
			return false;
		}
		processedMessages.add(messageId);
		while (processedMessages.size > maxTrackedMessages) {
			processedMessages.delete(processedMessages.values().next().value);
		}
		return true;
	}

	function markKickExistingMessagesProcessed(target) {
		if (!target || !target.querySelectorAll) {
			return 0;
		}
		var marked = 0;
		var nodes = [];
		try {
			if (target.matches && target.matches(KICK_MESSAGE_CONTAINER_SELECTOR)) {
				nodes.push(target);
			}
		} catch (e) {}
		try {
			target.querySelectorAll(KICK_MESSAGE_CONTAINER_SELECTOR).forEach(function(ele) {
				nodes.push(ele);
			});
		} catch (e) {}
		nodes.forEach(function(ele) {
			try {
				var text = (ele.textContent || "").replace(/\s+/g, " ").trim();
				var hasImage = ele.querySelector && ele.querySelector("img");
				if (!text && !hasImage) {
					return;
				}
				var messageId = getKickMessageKey(ele);
				if (rememberKickProcessedMessage(messageId)) {
					marked++;
				}
			} catch (e) {}
		});
		kickDebugLog("marked existing Kick popout messages processed", {
			count: marked,
			size: processedMessages.size
		});
		return marked;
	}
	
	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	// Kick popout uses [data-index] only as a virtual-list row slot. It starts
	// reusing those row slots around 270-299, so never use data-index as a
	// message ID, dedupe key, or proof that a chat message was already handled.
	const KICK_MESSAGE_CONTAINER_SELECTOR = "[data-index], [data-chat-entry]";
	const KICK_DELETE_TEXTS = new Set(["deleted by a moderator", "(deleted)"]);
	const KICK_BADGE_SELECTOR = ".badge-tooltip img[src], .badge-tooltip svg, .base-badge img[src], .base-badge svg, .badge img[src], .badge svg, div[data-state] img[src], div[data-state] svg";
	const KICK_MESSAGE_CONTENT_SELECTOR = ".chat-entry-content, .chat-emote-container, .break-all, seventv-container, .seventv-painted-content, span[class*='font-normal'], div[class*='font-normal']";
	const KICK_MOD_ACTIONS_SELECTOR = "[style*='chatroom-mod-actions-display'], button[aria-label='Delete'], button[aria-label='Pin'], button[aria-label='Reply'], button[aria-label='Ban'], button[aria-label='Timeout'], button[aria-label='Block']";
	const KICK_MOD_ACTIONS_CLOSEST_SELECTOR = "button[aria-label='Delete'], button[aria-label='Pin'], button[aria-label='Reply'], button[aria-label='Ban'], button[aria-label='Timeout'], button[aria-label='Block']";

	function getKickUsernameButton(ele) {
		return ele.querySelector("button.inline.font-bold[data-prevent-expand]")
			|| ele.querySelector("button[title]")
			|| ele.querySelector("button.font-bold.inline");
	}

	function isKickIgnoredContentNode(node) {
		if (!node || node.nodeType !== 1) {
			return false;
		}
		if (node.matches && node.matches(KICK_MOD_ACTIONS_SELECTOR)) {
			return true;
		}
		return Boolean(node.closest && node.closest(KICK_MOD_ACTIONS_CLOSEST_SELECTOR));
	}

	function isKickMessageTextNode(node) {
		if (!node || node.nodeType !== 1 || isKickIgnoredContentNode(node)) {
			return false;
		}
		if (node.closest && node.closest("button")) {
			return false;
		}
		return Boolean(node.matches && node.matches(".chat-entry-content, .chat-emote-container, .break-all, seventv-container, .seventv-painted-content, span[class*='font-normal'], div[class*='font-normal']"));
	}

	function getKickInlineMessageNode(ele) {
		var usernameBtn = getKickUsernameButton(ele);
		var current = usernameBtn ? usernameBtn.parentElement : null;
		while (current && current !== ele) {
			var separator = current.nextElementSibling;
			var content = separator ? separator.nextElementSibling : null;
			if (separator && content && isKickMessageTextNode(content)) {
				return content;
			}
			current = current.parentElement;
		}
		var nodes = ele.querySelectorAll("span[class*='font-normal'], div[class*='font-normal']");
		for (var i = 0; i < nodes.length; i++) {
			if (isKickMessageTextNode(nodes[i])) {
				return nodes[i];
			}
		}
		return null;
	}

	function getKickReplyLabel(ele) {
		if (!ele || !ele.querySelectorAll) {
			return "";
		}
		var buttons = ele.querySelectorAll("button");
		for (var i = 0; i < buttons.length; i++) {
			var button = buttons[i];
			if (!button || button.getAttribute("aria-label") || isKickIgnoredContentNode(button)) {
				continue;
			}
			var text = normalizeKickText(button.textContent || "");
			var className = typeof button.className === "string" ? button.className : "";
			if (text && (text.indexOf("Replying to") === 0 || className.indexOf("text-xs") !== -1)) {
				return escapeHtml(text);
			}
		}
		return "";
	}

	function getKickBadgeScope(ele) {
		var identity = ele && ele.querySelector ? ele.querySelector(".chat-message-identity") : null;
		if (identity) {
			return identity;
		}
		var usernameBtn = getKickUsernameButton(ele);
		var current = usernameBtn ? usernameBtn.parentElement : null;
		while (current && current !== ele) {
			if (current.querySelector(KICK_BADGE_SELECTOR) && !current.querySelector(KICK_MESSAGE_CONTENT_SELECTOR)) {
				return current;
			}
			current = current.parentElement;
		}
		return null;
	}

	function collectKickBadges(ele) {
		var chatbadges = [];
		var member = false;
		var mod = false;
		var seen = new Set();
		var badgeRoot = getKickBadgeScope(ele);
		if (!badgeRoot || !badgeRoot.querySelectorAll) {
			return {
				chatbadges: chatbadges,
				member: member,
				mod: mod
			};
		}
		badgeRoot.querySelectorAll(KICK_BADGE_SELECTOR).forEach(badge=>{
			try {
				if (!badge) {
					return;
				}
				if (badge.closest && badge.closest(KICK_MESSAGE_CONTENT_SELECTOR)) {
					return;
				}
				if (badge.matches && badge.matches("img[alt='sticker'][src], img.regular-emote, img.zero-width-emote, img.zero-width-emote-centered")) {
					return;
				}
				if ((badge.nodeName == "IMG") && badge.src && badge.src.includes("/emotes/")) {
					return;
				}
				var signature = "";
				if (badge.nodeName == "IMG") {
					signature = "img:" + badge.src;
				} else if (badge.nodeName && (badge.nodeName.toLowerCase() == "svg")) {
					signature = "svg:" + badge.outerHTML;
				}
				if (signature) {
					if (seen.has(signature)) {
						return;
					}
					seen.add(signature);
				}
				if (badge.nodeName == "IMG"){
					var tmp = {};
					tmp.src = badge.src;
					tmp.type = "img";
					if (badge.src.includes("subscriber")){
						member = badge.getAttribute("alt") || "Subscriber";
					}
					chatbadges.push(tmp);
				} else if (badge.nodeName && (badge.nodeName.toLowerCase() == "svg")){
					var tmp = {};
					tmp.html = badge.outerHTML;
					tmp.type = "svg";
					if (badge.querySelector('[d="M23.5 2.5v3h-3v3h-3v3h-3v3h-3v-3h-6v6h3v3h-3v3h-3v6h6v-3h3v-3h3v3h6v-6h-3v-3h3v-3h3v-3h3v-3h3v-6h-6Z"]')){
						mod = true;
					}
					if (settings.hidecertainbadges && badge.querySelector('[d="M15.6773 22.1533C17.3698 22.1533 18.8182 21.5507 20.0233 20.3461C21.2282 19.1415 21.8307 17.6924 21.8307 16V6.15401C21.8307 4.46162 21.2286 3.01305 20.0233 1.80784C18.8182 0.602907 17.3698 0 15.6773 0C13.9849 0 12.5363 0.602907 11.3311 1.80784C10.1259 3.01285 9.52344 4.46162 9.52344 6.15401V16C9.52344 17.6923 10.1262 19.1415 11.3311 20.3461C12.5361 21.5507 13.9849 22.1533 15.6773 22.1533Z"]')){
						return;
					}
					chatbadges.push(tmp);
				}
			} catch(e){  }
		});
		return {
			chatbadges: chatbadges,
			member: member,
			mod: mod
		};
	}

	function normalizeKickText(text) {
		return (text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
	}

	function normalizeKickChatname(name) {
		name = name || "";
		name = name.replace("Channel Host", "");
		name = name.replace(":", "");
		return name.trim();
	}

	function getKickMessageContainer(ele) {
		const base = ele?.nodeType === 1 ? ele : ele?.parentElement;
		if (!base) {
			return null;
		}
		if (base.matches?.(KICK_MESSAGE_CONTAINER_SELECTOR)) {
			return base;
		}
		return base.closest?.(KICK_MESSAGE_CONTAINER_SELECTOR) || null;
	}

	function getKickMessageSignature(ele) {
		if (!ele || !ele.querySelectorAll) {
			return "";
		}
		var usernameButton = getKickUsernameButton(ele) || null;
		var username = usernameButton ? normalizeKickText(usernameButton.textContent) : "";
		var messageNode = getKickInlineMessageNode(ele) || ele.querySelector("span[aria-hidden] ~ span, div span[class*='font-normal']");
		var rowPosition = ele.style && ele.style.transform ? ele.style.transform : "";
		var replyLabel = getKickReplyLabel(ele);
		var messageText = messageNode ? normalizeKickText(messageNode.textContent) : normalizeKickText(ele.textContent || "");
		if (messageText.length > 220) {
			messageText = messageText.slice(0, 220);
		}
		var imgSrcs = [];
		var imageScope = messageNode && messageNode.querySelectorAll ? messageNode : ele;
		var images = imageScope.querySelectorAll("img");
		for (var i = 0; i < images.length; i++) {
			var src = images[i] && images[i].src ? images[i].src : "";
			if (!src) {
				continue;
			}
			imgSrcs.push((images[i].alt || "") + ":" + src);
			if (imgSrcs.length >= 3) {
				break;
			}
		}
		return rowPosition + "|" + username + "|" + replyLabel + "|" + messageText + "|" + imgSrcs.join(",");
	}

	function getKickMessageKey(ele) {
		const messageEle = getKickMessageContainer(ele) || (ele?.nodeType === 1 ? ele : null);
		if (!messageEle?.dataset) {
			return "";
		}
		if (messageEle.dataset.chatEntry) {
			return `entry:${messageEle.dataset.chatEntry}`;
		}
		if (messageEle.dataset.index) {
			// data-index is recycled by Kick's virtualized chat, so only use a
			// content/position fingerprint for dedupe and delete ID lookup.
			return getKickMessageSignature(messageEle);
		}
		return "";
	}

	function clearKickMessageTrackingState(ele) {
		if (!ele || !ele.dataset) {
			return;
		}
		kickDebugLog("clearing row tracking state", getKickDebugRowInfo(ele));
		delete ele.dataset.matched;
		delete ele.dataset.ssMessageKey;
		delete ele.dataset.mid;
		delete ele.deleted;
	}

	function rememberKickTrackedMessageId(ele, id) {
		if (!ele || !id) {
			return;
		}
		ele.dataset.mid = id;
		const key = getKickMessageKey(ele);
		if (!key) {
			kickDebugLog("message id not tracked; empty key", {
				id: id,
				row: getKickDebugRowInfo(ele)
			});
			return;
		}
		if (trackedKickMessageIds.has(key)) {
			trackedKickMessageIds.delete(key);
		}
		trackedKickMessageIds.set(key, id);
		kickDebugLog("message id tracked", {
			id: id,
			key: key,
			trackedSize: trackedKickMessageIds.size,
			row: getKickDebugRowInfo(ele)
		});
		if (trackedKickMessageIds.size > maxTrackedKickMessageIds) {
			const oldestKey = trackedKickMessageIds.keys().next().value;
			if (oldestKey) {
				trackedKickMessageIds.delete(oldestKey);
			}
		}
	}

	function getKickTrackedMessageId(ele) {
		const source = ele?.dataset?.mid
			? ele
			: ele?.querySelector?.("[data-mid]") || ele?.closest?.("[data-mid]") || null;
		if (source?.dataset?.mid) {
			const parsedId = parseInt(source.dataset.mid, 10);
			return isNaN(parsedId) ? null : parsedId;
		}
		const key = getKickMessageKey(ele);
		if (!key || !trackedKickMessageIds.has(key)) {
			kickDebugLog("delete id lookup missed", {
				key: key,
				trackedSize: trackedKickMessageIds.size,
				row: getKickDebugRowInfo(ele)
			});
			return null;
		}
		const parsedId = parseInt(trackedKickMessageIds.get(key), 10);
		return isNaN(parsedId) ? null : parsedId;
	}

	function getKickDeleteChatname(ele) {
		const btn = getKickUsernameButton(ele);
		const rawName =
			btn?.innerText ||
			ele?.querySelector?.(".chat-entry-username")?.innerText ||
			"";
		return escapeHtml(normalizeKickChatname(rawName));
	}

	function hasKickDeletedLabel(ele) {
		return Array.from(ele?.querySelectorAll?.("span.font-semibold") || []).some((node) => {
			const label = normalizeKickText(node.textContent).toLowerCase();
			return KICK_DELETE_TEXTS.has(label);
		});
	}

	function isDeletedKickMessage(ele) {
		const messageEle = getKickMessageContainer(ele);
		if (!messageEle) {
			return false;
		}
		if (messageEle.querySelector("[class^='deleted-message']")) {
			return true;
		}
		if (messageEle.querySelector(".line-through")) {
			return true;
		}
		return hasKickDeletedLabel(messageEle);
	}
	
	function deleteThis(ele){
		// MutationObserver targets can be the chat list wrapper; only act on actual message rows.
		const messageEle = getKickMessageContainer(ele);
		if (!messageEle || !isDeletedKickMessage(messageEle)) {
			return false;
		}
		if (messageEle.deleted) {
			kickDebugLog("delete skipped; row already marked deleted", getKickDebugRowInfo(messageEle));
			return true;
		}
		messageEle.deleted = true;
		try {
			var data = {};
			const chatname = getKickDeleteChatname(messageEle) || getKickDeleteChatname(ele);
			if (chatname) {
				data.chatname = chatname;
			}
			const parsedId = getKickTrackedMessageId(messageEle);
			if (parsedId !== null) {
				data.id = parsedId;
			}
			data.type = "kick";
			if (!data.id && !data.chatname) {
				kickDebugLog("delete skipped; no id or chatname", getKickDebugRowInfo(messageEle));
				return true;
			}
			if (!data.id) {
				data.onlyLast = true;
			}
			kickDebugLog("delete sending", {
				data: data,
				row: getKickDebugRowInfo(messageEle)
			});
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				{
					delete: data
				},
				function (e) {
					if (chrome.runtime && chrome.runtime.lastError) {
						kickDebugLog("delete send failed", chrome.runtime.lastError.message);
						return;
					}
					kickDebugLog("delete send response", e);
				}
			);
		} catch (e) {
			kickDebugLog("delete exception", e && e.message ? e.message : String(e));
		}
		return true;
	}

	function looksLikeKickRewardMessage(messageText) {
		if (!messageText || typeof messageText !== "string") {
			return false;
		}

		const normalized = messageText
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/\s+/g, " ")
			.trim();

		if (!normalized) {
			return false;
		}

		const rewardPatterns = [
			/^(?:has redeemed|redeemed)\b/,
			/^(?:ha canjeado|canjeo)\b/,
			/^(?:rescatou|resgatou)\b/,
			/^(?:ha riscattato)\b/,
			/^(?:a echange|a rachete)\b/,
			/^hat .+ eingelost\b/,
			/^heeft .+ ingewisseld\b/
		];

		return rewardPatterns.some(pattern => pattern.test(normalized));
	}
	
	async function processMessageOld(ele){	// old chatroom format
	
	  if (settings.delaykick){
		  await sleep(3000);
	  }
	
	  if (!ele){return;}
	  if (deleteThis(ele)){return;}
	  
	  if (!ele.isConnected){return;}
	  
	  if (settings.customkickstate) {
		return;
	  }
		
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  var chatname = "";
	  var name ="";
	  var chatbadges = [];
	  
	  
	  try {
		chatname = escapeHtml(ele.querySelector(".chat-entry-username").innerText);
		
	  } catch(e){
		  return;
	  }
	  try {
		nameColor = ele.querySelector(".chat-entry-username").style.color;
	  } catch(e){}
	  
	  // settings.excludeReplyingTo
	  
	  if (!settings.textonlymode){
		  try {
			var chatNodes = ele.querySelectorAll("seventv-container"); // 7tv support, as of june 20th
			
			if (!chatNodes.length){
				chatNodes = ele.querySelectorAll(".chat-entry-content, .chat-emote-container, .break-all");
			} else {
				chatNodes = ele.querySelectorAll("seventv-container, .chat-emote-container, .seventv-painted-content"); // 7tv support, as of june 20th
				
			}
			for (var i=0;i<chatNodes.length;i++){
				chatmessage += getAllContentNodes(chatNodes[i])+" ";
			}
			chatmessage = chatmessage.trim();
		  } catch(e){
		  }
	  } else {
		  try{
			chatmessage = escapeHtml(ele.querySelector(".chat-entry-content").innerText);
		  } catch(e){}
	  }
	  
	  if (!chatmessage){return;}
	  
	  var originalMessage = "";
	  var replyMessage = "";
	  
	  if (!settings.excludeReplyingTo){
		  let reply = ele.querySelector(".chat-entry");
		  if (reply?.children.length == 2){
				reply = escapeHtml(reply.children[0].textContent);
				if (reply){
					replyMessage = reply;
					originalMessage = chatmessage;
					if (settings.textonlymode) {
						chatmessage = reply + ": " + chatmessage;
					} else {
						chatmessage = "<i><small>"+reply + ":&nbsp;</small></i> " + chatmessage;
					}
				}
		  }
	  }
	  
	  var member = false;
	  var mod = false;
	  ele.querySelector(".chat-message-identity").querySelectorAll(".badge-tooltip img[src], .badge-tooltip svg, .base-badge img[src], .base-badge svg, .badge img[src], .badge svg").forEach(badge=>{
		try {
			if (badge && badge.nodeName == "IMG"){
				var tmp = {};
				tmp.src = badge.src;
				tmp.type = "img";
				if (badge.src.includes("subscriber")){
					member = badge.getAttribute("alt") || "Subscriber";
				}
				chatbadges.push(tmp);
			} else if (badge && badge.nodeName.toLowerCase() == "svg"){
				var tmp = {};
				tmp.html = badge.outerHTML;
				tmp.type = "svg";
				if (badge.querySelector('[d="M23.5 2.5v3h-3v3h-3v3h-3v3h-3v-3h-6v6h3v3h-3v3h-3v6h6v-3h3v-3h3v3h6v-6h-3v-3h3v-3h3v-3h3v-3h3v-6h-6Z"]')){
					mod = true;
				}
				if (settings.hidecertainbadges && badge.querySelector('[d="M15.6773 22.1533C17.3698 22.1533 18.8182 21.5507 20.0233 20.3461C21.2282 19.1415 21.8307 17.6924 21.8307 16V6.15401C21.8307 4.46162 21.2286 3.01305 20.0233 1.80784C18.8182 0.602907 17.3698 0 15.6773 0C13.9849 0 12.5363 0.602907 11.3311 1.80784C10.1259 3.01285 9.52344 4.46162 9.52344 6.15401V16C9.52344 17.6923 10.1262 19.1415 11.3311 20.3461C12.5361 21.5507 13.9849 22.1533 15.6773 22.1533Z"]')){
					return;
				}
				
				chatbadges.push(tmp);
			}
		} catch(e){  }
	  });


	  var hasDonation = '';
	
	  
	  chatname = normalizeKickChatname(chatname);
	  
	  var chatimg = "";
	  
	  if (kickUsername && chatname){
		  chatimg = await getKickAvatarImage(chatname, kickUsername) || "";
	  }
	  
	  var data = {};
	  
	  if (replyMessage){
			data.initial = replyMessage;
		}
	   if (originalMessage){
			data.reply = originalMessage;
		}
		
	  if (looksLikeKickRewardMessage(chatmessage)) {
		data.event = "reward";
	  }
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  data.membership = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "kick";
	  
	  if (!chatmessage && !hasDonation){
		return;
	  }
	  
	  if (member){
		data.membership = membership;
	  }
	  if (mod){
		  data.mod = true;
	  }
	  
	  if (kickUsername){
		  data.sourceName = kickUsername;
	  }
	  if (channelImg){
		  data.sourceImg = channelImg;
	  }
	//	console.log(data);
	  
	  //if (brandedImageURL){
	  //  data.sourceImg = brandedImageURL;
	  //}
	  
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, (e)=>{
			if (ele && e && e.id){
				rememberKickTrackedMessageId(ele, e.id);
			}
		});
	  } catch(e){
		  //
	  }
	}
	
	var signedInUser = false;
	
	
	function getAuthenticatedUsername() {
		try {
			const scripts = document.querySelectorAll('script');
			
			for (const script of scripts) {
				const content = script.textContent || '';
				
				// Check if this script contains Next.js push data
				if (content.includes('self.__next_f.push') && content.includes('authenticated')) {
					
					let splitit = content.split("channelId").pop();
					// Look for username pattern - simpler regex that handles escaped content
					const usernameMatch = splitit.match(/username\\":\\"([^"\\]+)\\"/);
					
					if (usernameMatch && usernameMatch[1]) {
						return usernameMatch[1];
					}
					
					// Fallback: try without escaping
					const fallbackMatch = splitit.match(/username":"([^"]+)"/);
					if (fallbackMatch && fallbackMatch[1]) {
						return fallbackMatch[1];
					}
				}
			}
		} catch (e) {
			console.error('[Social Stream] Error extracting authenticated username:', e);
		}
		
		return null;
	}
	
	async function processMessageNew(ele){	// new popout format
	
	  if (!ele || !ele.isConnected) {
		kickDebugLog("process:new skipped; missing or disconnected row", getKickDebugRowInfo(ele));
		return;
	  }
	  
	  var chatname = "";
	  let messageId = "";
	  var eventName = "";
	  try {
		  var usernameBtn = getKickUsernameButton(ele);
		  if (usernameBtn){
			chatname = escapeHtml(usernameBtn.innerText);
		  } else {
			chatname = escapeHtml(ele.querySelector("button.font-bold").innerText);
			eventName = true;
		  }

	  } catch(e){
		  kickDebugLog("process:new skipped; username not found", {
			error: e && e.message ? e.message : String(e),
			row: getKickDebugRowInfo(ele)
		  });
		  return;
	  }
	  

	  try {
		messageId = getKickMessageKey(ele);
		if (!messageId){
			const content = ele.textContent || "";
			const imgSrcs = Array.from(ele.querySelectorAll('img')).map(img => img.src).join(' ');
			messageId = `${chatname}|${content.slice(0, 100)}${imgSrcs ? ' ' + imgSrcs : ''}`;
			kickDebugLog("process:new used fallback message key", {
				messageId: messageId,
				row: getKickDebugRowInfo(ele)
			});
		}
		if (deleteThis(ele)) return;
		if (ele.dataset.matched && ele.dataset.ssMessageKey === messageId){
			kickDebugLog("process:new skipped; row already matched same key", {
				messageId: messageId,
				row: getKickDebugRowInfo(ele)
			});
			return;
		}

		let sibling = ele.nextElementSibling;
		let nextCount = 0;
		while(sibling) {
			nextCount++;
			if (nextCount>5){
				kickDebugLog("process:new skipped; no matched sibling within lookahead", {
					messageId: messageId,
					row: getKickDebugRowInfo(ele)
				});
				return;
			}
			if (sibling.dataset && sibling.dataset.matched){
				kickDebugLog("process:new skipped; later sibling already matched", {
					messageId: messageId,
					sibling: getKickDebugRowInfo(sibling),
					row: getKickDebugRowInfo(ele)
				});
				return;
			}
			sibling = sibling.nextElementSibling;
		}

		if (processedMessages.has(messageId)) {
			kickDebugLog("process:new skipped; processedMessages duplicate", {
				messageId: messageId,
				size: processedMessages.size,
				row: getKickDebugRowInfo(ele)
			});
			return;
		}

		ele.dataset.matched = true;
		ele.dataset.ssMessageKey = messageId;
		kickDebugLog("process:new row marked", {
			messageId: messageId,
			row: getKickDebugRowInfo(ele)
		});

		rememberKickProcessedMessage(messageId);
		kickDebugLog("process:new accepted key", {
			messageId: messageId,
			size: processedMessages.size,
			row: getKickDebugRowInfo(ele)
		});
	  } catch(e) {
		console.error(e);
		kickDebugLog("process:new keying exception", {
			error: e && e.message ? e.message : String(e),
			row: getKickDebugRowInfo(ele)
		});
		return;
	  }
		
	  if (settings.delaykick){
		  await sleep(3000);
	  }
	  if (!ele || !ele.isConnected) {
		kickDebugLog("process:new skipped after delay; row disconnected", getKickDebugRowInfo(ele));
		return;
	  }
	  if (deleteThis(ele)) return;
	  
	  if (settings.customkickstate) {
		return;
	  }
		
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  var name ="";
	  var chatbadges = [];
	  var chatNodes = [];
	  
	  
	  try {
		var colorBtn = getKickUsernameButton(ele);
		if (colorBtn) { nameColor = colorBtn.style.color; }
	  } catch(e){}
	  
	   
	  if (!settings.textonlymode){
		  try {
			var inlineMessageNode = getKickInlineMessageNode(ele);
			if (inlineMessageNode) {
				chatmessage = getAllContentNodes(inlineMessageNode).trim();
			}
			chatNodes = chatmessage ? [] : ele.querySelectorAll("seventv-container"); // 7tv support, as of june 20th
			
			if (!chatNodes.length){
				chatNodes = chatmessage ? [] : ele.querySelectorAll(".chat-entry-content, .chat-emote-container, .break-all");
			} else {
				chatNodes = ele.querySelectorAll("seventv-container, .chat-emote-container, .seventv-painted-content"); // 7tv support, as of june 20th
			}
			
			if (!chatmessage && !chatNodes.length){
				let tmp = ele.querySelector("span[aria-hidden] ~ span, div span[class*='font-normal']");
				if (tmp){
					chatmessage = getAllContentNodes(tmp);
					chatmessage = chatmessage.trim();
				}
			} 
		  } catch(e){
		  }
	  } else {
		let tmp = getKickInlineMessageNode(ele) || ele.querySelector("span[aria-hidden] ~ span, div span[class*='font-normal']");
		if (tmp){
			chatmessage = getAllContentNodes(tmp);
			chatmessage = chatmessage.trim();
		}
	  }
	  if (chatNodes.length){
		for (var i=0;i<chatNodes.length;i++){
			chatmessage += getAllContentNodes(chatNodes[i])+" ";
		}
		chatmessage = chatmessage.trim();
	  }
	  
	  var contentImg = "";
	  var hasDonation = '';
	  
	  if (!chatmessage && chatname && ele.querySelector("img[alt='sticker'][src]")){
		  try {
			  chatmessage = getAllContentNodes(ele.querySelector("div.flex-shrink-0.break-normal"));
			  chatmessage = chatmessage.replace(chatname,"").trim();
			  contentImg = ele.querySelector("img[alt='sticker'][src]").src;
			  
			  hasDonation = parseInt(ele.querySelector("svg path[d^='M7.67318 0.0611465L3.07733 1.75287C2.86614']").parentNode.nextElementSibling.textContent);
			  if (hasDonation===1){
				  hasDonation = hasDonation + " KICK";
			  } else if (hasDonation){
				  hasDonation = hasDonation + " KICKs";
			  } else {
				  hasDonation = "";
			  }
			  eventName = "gift";
		  } catch(e){
		  }
	  }
	  
	  if (!chatmessage){
		kickDebugLog("process:new skipped; empty message", {
			messageId: messageId,
			chatname: chatname,
			row: getKickDebugRowInfo(ele)
		});
		return;
	  }
	  
	  var originalMessage = "";
	  var replyMessage = "";
	  
	  
	  if (!settings.excludeReplyingTo){
		  let reply = getKickReplyLabel(ele);
		  if (reply){
				replyMessage = reply;
				originalMessage = chatmessage;
				if (settings.textonlymode) {
					chatmessage = reply + ": " + chatmessage;
				} else {
					chatmessage = "<i><small>"+reply + ":&nbsp;</small></i> " + chatmessage;
				}
		  }
	  }
	  
	  var badgeDetails = collectKickBadges(ele);
	  var member = badgeDetails.member;
	  var mod = badgeDetails.mod;
	  chatbadges = badgeDetails.chatbadges;


	 
	  
	  chatname = normalizeKickChatname(chatname);
	  
	  var chatimg = "";
	  
	  if (kickUsername && chatname){
		  chatimg = await getKickAvatarImage(chatname, kickUsername) || "";
	  }
	  
	  var data = {};
	  
	    if (replyMessage){
			data.initial = replyMessage;
		}
	    if (originalMessage){
			data.reply = originalMessage;
		}
		
		if (looksLikeKickRewardMessage(chatmessage)){
			eventName = "reward";
		}
	  data.event = eventName;
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  if (contentImg){
		data.contentimg = contentImg;
	  }
	  if (member){
		data.membership = member;
	  }
	  if (mod){
		  data.mod = true;
	  }
	  data.textonly = settings.textonlymode || false;
	  data.type = "kick";
	  
	  
	  
	  if (!chatmessage && !hasDonation){
		kickDebugLog("process:new skipped; no message or donation", {
			messageId: messageId,
			chatname: chatname,
			row: getKickDebugRowInfo(ele)
		});
		return;
	  }
	  if (kickUsername){
		  data.sourceName = kickUsername;
	  }
	  if (channelImg){
		  data.sourceImg = channelImg;
	  }
	  
	  //console.log(data);
	  
	  //if (brandedImageURL){
	  //  data.sourceImg = brandedImageURL;
	  //}
	  
	  try {
		kickDebugLog("process:new sending message", {
			messageId: messageId,
			chatname: data.chatname,
			event: data.event,
			textLength: data.chatmessage ? data.chatmessage.length : 0,
			hasDonation: data.hasDonation,
			badgeCount: data.chatbadges ? data.chatbadges.length : 0,
			row: getKickDebugRowInfo(ele)
		});
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, (e)=>{
			if (chrome.runtime && chrome.runtime.lastError) {
				kickDebugLog("process:new send failed", {
					messageId: messageId,
					error: chrome.runtime.lastError.message
				});
				return;
			}
			kickDebugLog("process:new send response", {
				messageId: messageId,
				response: e
			});
			if (e && ele){
				rememberKickTrackedMessageId(ele, e?.id);
			}
		});
	  } catch(e){
		kickDebugLog("process:new send exception", {
			messageId: messageId,
			error: e && e.message ? e.message : String(e)
		});
	  }
	}

	// Route to the appropriate processMessage function based on the URL
	var processMessage = isPopoutChat ? processMessageNew : processMessageOld;

	runtimeMessageHandler = function (request, sender, sendResponse) {
		try {
			if ("getSource" == request) {
				sendResponse("kick");
				return;
			}
			if ("focusChat" == request) {
				var input = isPopoutChat ? document.querySelector('[data-input="true"]') : document.querySelector('#message-input');
				if (input && input.focus) {
					input.focus();
					sendResponse(true);
					return;
				}
				sendResponse(false);
				return;
			}
			if (typeof request === "object") {
				if ("state" in request) {
					if (request.state !== null) {
						isExtensionOn = request.state;
					}
				}
				if ("settings" in request) {
					settings = request.settings;
					kickDebugLog("settings updated", {
						textonlymode: Boolean(settings.textonlymode),
						delaykick: Boolean(settings.delaykick),
						customkickstate: Boolean(settings.customkickstate),
						excludeReplyingTo: Boolean(settings.excludeReplyingTo),
						bttv: Boolean(settings.bttv),
						seventv: Boolean(settings.seventv),
						ffz: Boolean(settings.ffz)
					});
					sendResponse(true);
					if (settings.bttv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true, userid: kickUserID, channel: kickUsername ? kickUsername.toLowerCase() : null, type: "kick" }, function (response) {});
					}
					if (settings.seventv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true, userid: kickUserID, channel: kickUsername ? kickUsername.toLowerCase() : null, type: "kick" }, function (response) {});
					}
					if (settings.ffz) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true, userid: kickUserID, channel: kickUsername ? kickUsername.toLowerCase() : null, type: "kick" }, function (response) {});
					}
					return;
				}
				if ("SEVENTV" in request) {
					SEVENTV = request.SEVENTV;
					sendResponse(true);
					mergeEmotes();
					return;
				}
				if ("BTTV" in request) {
					BTTV = request.BTTV;
					sendResponse(true);
					mergeEmotes();
					return;
				}
				if ("FFZ" in request) {
					FFZ = request.FFZ;
					sendResponse(true);
					mergeEmotes();
					return;
				}
			}
		} catch (e) {}
		sendResponse(false);
	};
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (response){
			if ("state" in response){
				if (response.state !== null){
					isExtensionOn = response.state;
				}
			}
			if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
			response = response || {};
			if ("settings" in response){
				settings = response.settings;
				kickDebugLog("settings loaded", {
					textonlymode: Boolean(settings.textonlymode),
					delaykick: Boolean(settings.delaykick),
					customkickstate: Boolean(settings.customkickstate),
					excludeReplyingTo: Boolean(settings.excludeReplyingTo),
					bttv: Boolean(settings.bttv),
					seventv: Boolean(settings.seventv),
					ffz: Boolean(settings.ffz)
				});
				
				if (settings.bttv && !BTTV) {
					chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true, userid: kickUserID, channel: kickUsername ? kickUsername.toLowerCase() : null, type: "kick" }, function (response) {});
				}
				if (settings.seventv && !SEVENTV) {
					chrome.runtime.sendMessage(chrome.runtime.id, {getSEVENTV: true, userid: kickUserID, channel: kickUsername ? kickUsername.toLowerCase() : null, type: "kick" }, function (response) {});
				}
				if (settings.ffz && !FFZ) {
					chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true, userid: kickUserID, channel: kickUsername ? kickUsername.toLowerCase() : null, type: "kick" }, function (response) {});
				}
			}
		}
	});

	function onElementInsertedOld(target) {
		var onMutationsObserved = function(mutations) {
			kickDebugLogThrottled("observer-old-mutations", 5000, "observer:old mutations", {
				count: mutations.length,
				target: getKickDebugRowInfo(target)
			});
			mutations.forEach(function(mutation) {
				markKickChatDomActivity();
				if (mutation.type === "attributes" || mutation.type === "characterData") {
					deleteThis(mutation.target);
					return;
				}
				if (deleteThis(mutation.target)) {
					return;
				}
				if (mutation.addedNodes.length) {
					for (var i = 0; i < mutation.addedNodes.length; i++) {
						try {
							if (deleteThis(mutation.addedNodes[i])) {
								continue;
							}
							if (mutation.addedNodes[i].dataset && mutation.addedNodes[i].dataset.chatEntry){
								if (pastMessages.includes(mutation.addedNodes[i].dataset.chatEntry)){continue;}
							
								pastMessages.push(mutation.addedNodes[i].dataset.chatEntry)
								pastMessages = pastMessages.slice(-300);
								
								if (SevenTV){
									setTimeout(function(ele){
										processMessage(ele);
									}, 300, mutation.addedNodes[i]); // give seventv time to load, before parsing the message
								} else {
									processMessage(mutation.addedNodes[i]);
								}
								
							} else if (mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner")){
								let ele = mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner");
								
								processMessage(ele);
							}
						} catch(e){}
					}
				}
			});
		};
		var config = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] };
		replaceKickChatObserver(target, "old", true, onMutationsObserved, config);
	}
	
	function onElementInsertedNew(target, subtree=false) {
		var onMutationsObserved = function(mutations) {
			kickDebugLogThrottled("observer-new-mutations", 5000, "observer:new mutations", function() {
				var added = 0;
				var removed = 0;
				var attributes = 0;
				for (var x = 0; x < mutations.length; x++) {
					added += mutations[x].addedNodes ? mutations[x].addedNodes.length : 0;
					removed += mutations[x].removedNodes ? mutations[x].removedNodes.length : 0;
					if (mutations[x].type === "attributes") {
						attributes++;
					}
				}
				return {
					count: mutations.length,
					added: added,
					removed: removed,
					attributes: attributes,
					target: getKickDebugRowInfo(target)
				};
			});
			mutations.forEach(function(mutation) {
				markKickChatDomActivity();
				if (mutation.type === "attributes" || mutation.type === "characterData") {
					deleteThis(mutation.target);
					return;
				}
				if (deleteThis(mutation.target)) {
					return;
				}
				if (mutation.removedNodes.length) {
					const row = getKickMessageContainer(mutation.target);
					if (row) {
						clearKickMessageTrackingState(row);
					}
					if (row && row.dataset.index){
						kickDebugLog("observer:new processing row after removal", getKickDebugRowInfo(row));
						processMessage(row);
					}
				} else if (mutation.target == target || subtree){
					if (mutation.addedNodes.length) {
						for (var i = 0; i < mutation.addedNodes.length; i++) {
							try {
								if (deleteThis(mutation.addedNodes[i])) {
									continue;
								}
								if (mutation.addedNodes[i].dataset && mutation.addedNodes[i].dataset.index){
									kickDebugLog("observer:new added data-index row", getKickDebugRowInfo(mutation.addedNodes[i]));
									if (SevenTV){
										setTimeout(function(ele){
											kickDebugLog("observer:new processing delayed 7tv row", getKickDebugRowInfo(ele));
											processMessage(ele);
										}, 300, mutation.addedNodes[i]); // give seventv time to load, before parsing the message
									} else {
										processMessage(mutation.addedNodes[i]);
									}
									
								} else if (mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner")){
									let ele = mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner");
									
									kickDebugLog("observer:new added banner", getKickDebugRowInfo(ele));
									processMessage(ele);
								}
							} catch(e){}
						}
					}
				} 
			});
		};
		var config = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] };
		replaceKickChatObserver(target, "new", subtree, onMutationsObserved, config);
	}

	var kickChatObserver = null;
	var kickChatObserverTarget = null;
	var kickChatObserverMode = "";
	var kickChatObserverSubtree = false;
	var kickChatObserverWatchdog = null;

	function replaceKickChatObserver(target, mode, subtree, onMutationsObserved, config) {
		if (!target) {
			kickDebugLog("observer replace skipped; missing target", {
				mode: mode,
				subtree: subtree
			});
			return false;
		}
		subtree = Boolean(subtree);
		if (kickChatObserver && kickChatObserverTarget === target && kickChatObserverMode === mode && kickChatObserverSubtree === subtree && target.isConnected) {
			kickDebugLogThrottled("observer-reuse-" + mode, 10000, "observer already attached", {
				mode: mode,
				subtree: subtree,
				target: getKickDebugRowInfo(target)
			});
			return true;
		}
		if (kickChatObserver) {
			try {
				kickDebugLog("observer disconnecting previous target", {
					mode: kickChatObserverMode,
					subtree: kickChatObserverSubtree,
					target: getKickDebugRowInfo(kickChatObserverTarget)
				});
				kickChatObserver.disconnect();
			} catch(e) {}
		}
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		kickChatObserver = new MutationObserver(onMutationsObserved);
		kickChatObserver.observe(target, config);
		kickChatObserverTarget = target;
		kickChatObserverMode = mode;
		kickChatObserverSubtree = subtree;
		kickDebugLog("observer attached", {
			mode: mode,
			subtree: subtree,
			childCount: target.children ? target.children.length : null,
			target: getKickDebugRowInfo(target)
		});
		return true;
	}

	function getKickCurrentChatTarget() {
		if (isPopoutChat) {
			var targets = document.querySelectorAll("#chatroom-messages > div");
			if (!targets.length) {
				kickDebugLogThrottled("observer-no-popout-target", 5000, "observer target missing for popout", {
					chatroomMessages: Boolean(document.querySelector("#chatroom-messages"))
				});
				return null;
			}
			return {
				mode: "new",
				target: targets.length > 1 ? targets[1] : targets[0],
				subtree: true
			};
		}
		var oldTarget = document.getElementById("chatroom");
		if (!oldTarget) {
			kickDebugLogThrottled("observer-no-old-target", 5000, "observer target missing for old chatroom");
			return null;
		}
		return {
			mode: "old",
			target: oldTarget,
			subtree: true
		};
	}

	function refreshKickChatObserver() {
		var current = getKickCurrentChatTarget();
		if (!current || !current.target) {
			kickDebugLogThrottled("observer-refresh-no-target", 5000, "observer refresh failed; no target");
			return false;
		}
		if (kickChatObserver && kickChatObserverTarget === current.target && kickChatObserverMode === current.mode && kickChatObserverSubtree === Boolean(current.subtree) && current.target.isConnected) {
			kickDebugLogThrottled("observer-refresh-current", 10000, "observer refresh found current target", {
				mode: current.mode,
				subtree: current.subtree,
				target: getKickDebugRowInfo(current.target)
			});
			return true;
		}
		kickDebugLog("observer refresh attaching target", {
			mode: current.mode,
			subtree: current.subtree,
			target: getKickDebugRowInfo(current.target)
		});
		if (current.mode === "new") {
			markKickExistingMessagesProcessed(current.target);
			onElementInsertedNew(current.target, current.subtree);
		} else {
			onElementInsertedOld(current.target);
		}
		return true;
	}

	function startKickChatObserverWatchdog() {
		if (kickChatObserverWatchdog) {
			kickDebugLog("observer watchdog already started");
			return;
		}
		kickDebugLog("observer watchdog started");
		kickChatObserverWatchdog = setInterval(function() {
			refreshKickChatObserver();
		}, 1000);
	}
	
	var SevenTV = false;
	
	console.log("Social stream injected - " + (isPopoutChat ? "new popout" : "old chatroom"));
	kickDebugLog("startup", {
		isPopoutChat: isPopoutChat,
		isOldChatroom: isOldChatroom,
		kickUsername: kickUsername,
		kickUserID: kickUserID,
		channelImg: channelImg,
		url: window.location.href
	});
	startKickTransportWatchdog();
	
	var xxx = setInterval(async function(){ 
		if (isPopoutChat) {
			// New popout chat
			if (document.querySelectorAll("#chatroom-messages > div").length){
				clearInterval(xxx);
				setTimeout(function(){
					if (document.getElementById("seventv-extension")){
						SevenTV = true;
					}
					refreshKickChatObserver();
					startKickChatObserverWatchdog();
				},3000);
			}
			if (!signedInUser){
				signedInUser = getAuthenticatedUsername();
			}
		} else {
			// Old chatroom
			if (document.getElementById("chatroom")){
				clearInterval(xxx);
				setTimeout(function(){
					if (document.getElementById("seventv-extension")){
						SevenTV = true;
					}
					var clear = document.querySelectorAll("div[data-chat-entry]");
					for (var i = 0;i<clear.length;i++){
						pastMessages.push(clear[i].dataset.chatEntry);
					}
					refreshKickChatObserver();
					startKickChatObserverWatchdog();
				},3000);
			}
		}
		
		try {
			const currentUrl = window.location.href;
			const kickLocale = extractKickLocale(currentUrl);
			const localeSegment = kickLocale ? `${encodeURIComponent(kickLocale)}/` : '';
			const buildPopoutUrl = (username) => {
				return `${window.location.origin}/${localeSegment}popout/${encodeURIComponent(username)}/chat?popout=`;
			};

			const kickUsername = extractKickUsername(currentUrl);
			if (kickUsername && document.querySelector('[data-testid="not-found"]')) {
				if (kickUsername.includes("_")) {
					const normalized = kickUsername.replaceAll("_", "-").toLowerCase();
					window.location.replace(buildPopoutUrl(normalized)); // Use replace to avoid history issues
					throw new Error('Redirecting to new Kick URL format');
				} else if (kickUsername.includes("-")) {
					const normalized = kickUsername.replaceAll("-", "_").toLowerCase();
					window.location.replace(buildPopoutUrl(normalized)); // Use replace to avoid history issues
					throw new Error('Redirecting to new Kick URL format');
				} else if (kickUsername.toLowerCase() !== kickUsername) {
					const normalized = kickUsername.toLowerCase();
					window.location.replace(buildPopoutUrl(normalized)); // Use replace to avoid history issues
					throw new Error('Redirecting to new Kick URL format');
				}
			}
		} catch(e){
			console.error(e);
		}
		
	},1000);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function(event){
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e){};;
			remoteConnection.datachannel.onopen = function(e){};;
			remoteConnection.datachannel.onclose = function(e){};;
			setInterval(function(){
				if (document.hidden){ // only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE")
				}
			}, 800);
		}
		var errorHandle = function(e){}
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = (e) => !e.candidate ||	remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function(e){localConnection.sendChannel.send("CONNECTED");};
		localConnection.sendChannel.onclose =  function(e){};
		localConnection.sendChannel.onmessage = function(e){};
		localConnection.createOffer()
			.then((offer) => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then((answer) => remoteConnection.setLocalDescription(answer))
			.then(() =>	{
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch(e){
	}

})();
