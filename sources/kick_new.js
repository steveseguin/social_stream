(async function () {
	
	// Function to rewrite old Kick URLs to new format
	function rewriteKickUrl(url) {
		// Check if it's an old Kick chatroom URL (case-insensitive)
		const oldKickPattern = /^https:\/\/kick\.com\/([^\/]+)\/chatroom$/i;
		const match = url.match(oldKickPattern);
		
		if (match) {
			// Validate and sanitize username
			const username = match[1];
			if (!username || username.length === 0) {
				return url; // Invalid username, don't redirect
			}
			
			// Rewrite to new format
			const newUrl = `https://kick.com/popout/${encodeURIComponent(username)}/chat`;
			console.log(`[Social Stream] Rewriting old Kick URL: ${url} -> ${newUrl}`);
			return newUrl;
		}
		
		// Return original URL if no rewriting needed
		return url;
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
	var maxTrackedMessages = 40;
	var pastMessages = [];
	
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
		const pattern = /kick\.com\/(?:popout\/)?([^/]+)(?:\/(?:chat|chatroom))?$/i;
		const match = url.match(pattern);
		if (match) {
			return match[1];
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
		
		// Handle emotes if they exist
		if (EMOTELIST) {
			let textContent = "";
			element.childNodes.forEach(node => {
				if (node.nodeType === 3 && node.textContent && node.textContent.trim().length > 0) {
					textContent += escapeHtml(node.textContent);
				}
			});
			
			if (textContent) {
				return replaceEmotesWithImages(textContent);
			}
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
				resp += escapeHtml(node.textContent);
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
			// Move to end (most recently used)
			const value = cachedUserProfiles.get(username);
			cachedUserProfiles.delete(username);
			cachedUserProfiles.set(username, value);
			return value;
		}
		
		// Evict oldest entry if cache is full
		if (cachedUserProfiles.size >= maxCachedProfiles) {
			const firstKey = cachedUserProfiles.keys().next().value;
			cachedUserProfiles.delete(firstKey);
		}
		
		// Add placeholder immediately to prevent duplicate requests
		cachedUserProfiles.set(username, "");
		
		return await fetchWithTimeout("https://kick.com/channels/"+encodeURIComponent(channelname)+"/"+encodeURIComponent(username)).then(async response => {
			return await response.json().then(function (data) {
				if (data && data.profilepic){
					// Update cache with actual profile pic
					cachedUserProfiles.set(username, data.profilepic);
					return data.profilepic;
				}
			});
		}).catch(error => {
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
	  
	  ele.querySelector(".chat-message-identity").querySelectorAll(".badge-tooltip img[src], .badge-tooltip svg, .base-badge img[src], .base-badge svg, .badge img[src], .badge svg").forEach(badge=>{
		try {
			if (badge && badge.nodeName == "IMG"){
				var tmp = {};
				tmp.src = badge.src;
				tmp.type = "img";
				chatbadges.push(tmp);
			} else if (badge && badge.nodeName.toLowerCase() == "svg"){
				var tmp = {};
				tmp.html = badge.outerHTML;
				tmp.type = "svg";
				chatbadges.push(tmp);
			}
		} catch(e){  }
	  });


	  var hasDonation = '';
	
	  
	  chatname = chatname.replace("Channel Host", "");
	  chatname = chatname.replace(":", "");
	  chatname = chatname.trim();
	  
	  var chatimg = "";
	  var channelName = window.location.pathname.split("/")[1];
	  
	  if (channelName && chatname){
		  chatimg = await getKickAvatarImage(chatname, channelName) || "";
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
	  
	  //if (brandedImageURL){
	  //  data.sourceImg = brandedImageURL;
	  //}
	  
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, (e)=>{
			console.warn(e);
			if (ele && e && e.id){
				ele.dataset.mid = e.id;
			}
		});
	  } catch(e){
		  //
	  }
	}
	
	async function processMessageNew(ele){	// new popout format
	
	  if (!ele || !ele.isConnected) return;
	  
	  if (ele.querySelector(".line-through")){
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
	  
	  let messageId = "";
	  try {
		  const content = ele.textContent || "";
		  messageId = `${content.slice(0, 100)}`;
		
		if (processedMessages.has(messageId)) return;
		
		processedMessages.add(messageId);
		
		if (processedMessages.size > maxTrackedMessages) {
		  const entriesToRemove = processedMessages.size - maxTrackedMessages;
		  const entries = Array.from(processedMessages);
		  for (let i = 0; i < entriesToRemove; i++) {
			processedMessages.delete(entries[i]);
		  }
		}
		
	  } catch(e) {
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
	  var chatname = "";
	  var name ="";
	  var chatbadges = [];
	  
	  
	  try {
		chatname = escapeHtml(ele.querySelector("button[title]").innerText);
		
	  } catch(e){
		  return;
	  }
	  try {
		nameColor = ele.querySelector("button[title]").style.color;
	  } catch(e){}
	  
	   
	  if (!settings.textonlymode){
		  try {
			var chatNodes = ele.querySelectorAll("seventv-container"); // 7tv support, as of june 20th
			
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
		  if (!chatNodes.length){
			let tmp = ele.querySelector("div span[class^='font-normal']");
			if (tmp){
				chatmessage = getAllContentNodes(tmp);
				chatmessage = chatmessage.trim();
			}
		  }
	  }
	  if (chatNodes.length){
		for (var i=0;i<chatNodes.length;i++){
			chatmessage += getAllContentNodes(chatNodes[i])+" ";
		}
		chatmessage = chatmessage.trim();
	  }
	  
	  if (!chatmessage){return;}
	  
	  var originalMessage = "";
	  var replyMessage = "";
	  
	  if (!settings.excludeReplyingTo){
		  let reply = ele.querySelector(".text-xs button");
		  if (reply){
				reply = getAllContentNodes(reply).trim();
				if (reply){
					replyMessage = reply;
					originalMessage = chatmessage;
					if (settings.textonlymode) {
						chatmessage = "@"+reply + ": " + chatmessage;
					} else {
						chatmessage = "<i><small>@"+reply + ":&nbsp;</small></i> " + chatmessage;
					}
				}
		  }
	  }
	  
	  
	  ele.querySelectorAll("div > div > div > div > div > div[data-state] img[src], div > div > div > div > div > div[data-state] svg").forEach(badge=>{
		try {
			if (badge && badge.nodeName == "IMG"){
				var tmp = {};
				tmp.src = badge.src;
				tmp.type = "img";
				chatbadges.push(tmp);
			} else if (badge && badge.nodeName.toLowerCase() == "svg"){
				var tmp = {};
				tmp.html = badge.outerHTML;
				tmp.type = "svg";
				chatbadges.push(tmp);
			}
		} catch(e){  }
	  });


	  var hasDonation = '';
	
	  
	  chatname = chatname.replace("Channel Host", "");
	  chatname = chatname.replace(":", "");
	  chatname = chatname.trim();
	  
	  var chatimg = "";
	  var channelName = window.location.pathname.split("/")[2];
	  
	  if (channelName && chatname){
		  chatimg = await getKickAvatarImage(chatname, channelName) || "";
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
	
	var xxx = setInterval(function(){
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
	},1000);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function(e){
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
