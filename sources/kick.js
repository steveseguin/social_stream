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
	var maxTrackedMessages = 3;
	var pastMessages = [];

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

	try {
		var kickUserID = false;
		var kickUsername = extractKickUsername(window.location.href);
		if (kickUsername){
			kickUserID = await getKickUserIdByUsername();
		}
	} catch(e){}

	var isExtensionOn = true;
	
	var channelImg = "";
	  
	if (kickUsername){
		channelImg = await getKickAvatarImage(kickUsername, kickUsername) || "https://kick.com/img/default-profile-pictures/default2.jpeg";
	}
	
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
			return await fetch(URL);
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
	
	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	
	function deleteThis(ele){
		if (ele.querySelector("[class^='deleted-message']")){
		  console.log("DELETEED");
		  try {
				var data = {};
				data.chatname = escapeHtml(ele.querySelector(".chat-entry-username").innerText);
				data.chatname = data.chatname.replace("Channel Host", "");
				data.chatname = data.chatname.replace(":", "");
				data.chatname = data.chatname.trim();

				if (ele.dataset.mid) {
					const parsedId = parseInt(ele.dataset.mid);
					if (!isNaN(parsedId)) {
						data.id = parsedId;
					}
				}
				data.type = "kick";
				
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					{
						delete: data
					},
					function (e) {}
				);
			} catch (e) {
			}
		 }
	}
	
	async function processMessageOld(ele){	// old chatroom format
	
	  if (settings.delaykick){
		  await sleep(3000);
	  }
	
	  if (!ele){return;}
	  
	  if (!ele.isConnected){return;}
	  
	  if (settings.customkickstate) {
		return;
	  }
	  
	   if (ele.querySelector("[class^='deleted-message']")){
		  console.log("DELETEED");
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
	
	  
	  chatname = chatname.replace("Channel Host", "");
	  chatname = chatname.replace(":", "");
	  chatname = chatname.trim();
	  
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
				ele.dataset.mid = e.id;
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
	
	  if (!ele || !ele.isConnected) return;
	  
	  if (ele.querySelector(".line-through, .text-neutral>.font-semibold")){
		 // console.log("DELETEED");
		  try {
				var data = {};
				data.chatname = escapeHtml(ele.querySelector("button[title]").innerText);
				data.chatname = data.chatname.replace("Channel Host", "");
				data.chatname = data.chatname.replace(":", "");
				data.chatname = data.chatname.trim();
				ele.dataset.mid ? (data.id = parseInt(ele.dataset.mid)) || null : "";
				data.type = "kick";
				
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					{
						delete: data
					},
					function (e) {}
				);
			} catch (e) {
			}
		return;
	  }
	  
	  if (ele.dataset.matched){return;}
	  ele.dataset.matched = true;
	  let sibling = ele.nextElementSibling;
	  let nextCount = 0;
	  while(sibling) {
		nextCount++;
		if (nextCount>5){return;}
		if (sibling.dataset.matched){return;}
		sibling = sibling.nextElementSibling;
	  }
	  
	  var chatname = "";
	  let messageId = "";
	  var eventName = "";
	  try {
		  if (ele.querySelector("button[title]")){
			chatname = escapeHtml(ele.querySelector("button[title]").innerText);
		  } else {
			chatname = escapeHtml(ele.querySelector("button.font-bold.inline.text-white").innerText);
			eventName = true;
		  }
		
	  } catch(e){
		  return;
	  }
	  
	  
	  try {
		 //console.log(signedInUser);
		if (signedInUser && signedInUser==chatname){
			const content = ele.textContent || "";
			const imgSrcs = Array.from(ele.querySelectorAll('img')).map(img => img.src).join(' ');
			messageId = `${content.slice(0, 100)}${imgSrcs ? ' ' + imgSrcs : ''}`;
			
			if (processedMessages.has(messageId)) return;
			
			processedMessages.add(messageId);
			
			if (processedMessages.size > maxTrackedMessages) {
			  const entriesToRemove = processedMessages.size - maxTrackedMessages;
			  const entries = Array.from(processedMessages);
			  for (let i = 0; i < entriesToRemove; i++) {
				processedMessages.delete(entries[i]);
			  }
			}
		}
	  } catch(e) {
		  console.error(e);
		return;
	  }
		
	  if (settings.delaykick){
		  await sleep(3000);
	  }
	  
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
		nameColor = ele.querySelector("button[title]").style.color;
	  } catch(e){}
	  
	   
	  if (!settings.textonlymode){
		  try {
			chatNodes = ele.querySelectorAll("seventv-container"); // 7tv support, as of june 20th
			
			if (!chatNodes.length){
				chatNodes = ele.querySelectorAll(".chat-entry-content, .chat-emote-container, .break-all");
			} else {
				chatNodes = ele.querySelectorAll("seventv-container, .chat-emote-container, .seventv-painted-content"); // 7tv support, as of june 20th
			}
			
			if (!chatNodes.length){
				let tmp = ele.querySelector("div span[class^='font-normal']");
				if (tmp){
					chatmessage = getAllContentNodes(tmp);
					chatmessage = chatmessage.trim();
				}
			} 
		  } catch(e){
		  }
	  } else {
		let tmp = ele.querySelector("div span[class^='font-normal']");
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
	  
	  if (!chatmessage){return;}
	  
	  var originalMessage = "";
	  var replyMessage = "";
	  
	  
	  if (!settings.excludeReplyingTo){
		  let reply = ele.querySelector(".text-xs button");
		  if (reply){
				reply = getAllContentNodes(reply.parentNode).trim();
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
	  ele.querySelectorAll("div > div > div > div > div > div[data-state] img[src], div > div > div > div > div > div[data-state] svg").forEach(badge=>{
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


	 
	  
	  chatname = chatname.replace("Channel Host", "");
	  chatname = chatname.replace(":", "");
	  chatname = chatname.trim();
	  
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
		
		if (eventName){
			if (chatmessage.startsWith("has redeemed ")){
				eventName = "reward";
			}
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
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, (e)=>{
			if (e && ele){
				ele.dataset.mid = e?.id;
			}
		});
	  } catch(e){
		  //
	  }
	}

	// Route to the appropriate processMessage function based on the URL
	var processMessage = isPopoutChat ? processMessageNew : processMessageOld;

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("kick");	return;	}
				if ("focusChat" == request){
					if (isPopoutChat) {
						document.querySelector('[data-input="true"]').focus();
					} else {
						document.querySelector('#message-input').focus();
					}
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("state" in request){
						if (request.state !== null){
							isExtensionOn = request.state;
						}
					}
					if ("settings" in request){
						settings = request.settings;
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
				// twitch doesn't capture avatars already.
			} catch(e){}
			sendResponse(false);
		}
	);
	
	var lastMessage = "";
	var settings = {};
	
	
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
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0; i < mutation.addedNodes.length; i++) {
						try {
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
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	function onElementInsertedNew(target, subtree=false) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.removedNodes.length) {
					if (mutation.target.parentNode && mutation.target.parentNode.dataset.index){
						processMessage(mutation.target.parentNode);
					}
				} else if (mutation.target == target || subtree){
					if (mutation.addedNodes.length) {
						for (var i = 0; i < mutation.addedNodes.length; i++) {
							try {
								if (mutation.addedNodes[i].dataset && mutation.addedNodes[i].dataset.index){
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
				} 
			});
		};
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	var SevenTV = false;
	
	console.log("Social stream injected - " + (isPopoutChat ? "new popout" : "old chatroom"));
	
	var xxx = setInterval(async function(){ 
		if (isPopoutChat) {
			// New popout chat
			if (document.querySelectorAll("#chatroom-messages > div").length){
				clearInterval(xxx);
				setTimeout(function(){
					clearMessageTracking();
					if (document.getElementById("seventv-extension")){
						SevenTV = true;
					}
					var clear = document.querySelectorAll("div[data-chat-entry]");
					
					if (document.querySelectorAll("#chatroom-messages > div").length>1){
						onElementInsertedNew(document.querySelectorAll("#chatroom-messages > div")[1], true);
					} else {
						onElementInsertedNew(document.querySelectorAll("#chatroom-messages > div")[0], false);
					}
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
					onElementInsertedOld(document.getElementById("chatroom"));
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
