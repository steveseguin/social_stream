(function () {


	//var channelName = "";
	var videoId = false;
	try {
		const parentUrl = window.top.location.href;
		const parentStudioMatch = parentUrl.match(/\/video\/([^\/]+)/);
		if (parentStudioMatch) {
			videoId = parentStudioMatch[1];
		}
	} catch(e){}

/* 	function getTranslation(key, value = false) {
		if (settings.translation && settings.translation.innerHTML && key in settings.translation.innerHTML) {
			// these are the proper translations
			return settings.translation.innerHTML[key];
		} else if (settings.translation && settings.translation.miscellaneous && settings.translation.miscellaneous && key in settings.translation.miscellaneous) {
			return settings.translation.miscellaneous[key];
		} else if (value !== false) {
			return value;
		} else {
			return key.replaceAll("-", " "); //
		}
	} */
	
	const getTranslation = (() => {
	  const cache = new Map();
	  return (key, value = false) => {
		if (cache.has(key)) return cache.get(key);
		let result;
		if (settings.translation && settings.translation.innerHTML && key in settings.translation.innerHTML) {
		  result = settings.translation.innerHTML[key];
		} else if (settings.translation && settings.translation.miscellaneous && key in settings.translation.miscellaneous) {
		  result = settings.translation.miscellaneous[key];
		} else if (value !== false) {
		  result = value;
		} else {
		  result = key.replaceAll("-", " ");
		}
		cache.set(key, result);
		return result;
	  };
	})();

	function escapeHtml(unsafe) {
		try {
			if (settings.textonlymode) {
				return unsafe;
			}
			return unsafe.replace(/[&<>"']/g, function(m) {
				return {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#039;'
				}[m];
			}) || "";
		} catch (e) {
			return "";
		}
	}

	function setupDeletionObserver(target) {
	  const deletionObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
		  if (mutation.type === 'attributes' && mutation.attributeName === 'is-deleted') {
			deleteThis(mutation.target);
		  }
		});
	  });

	  deletionObserver.observe(target, {
		attributes: true,
		attributeFilter: ['is-deleted'],
		subtree: true
	  });
	}
	
	function deleteThis(ele) {
	  if (ele.deleted) return;
	  ele.deleted = true;
	  try {
		const chatname = ele.querySelector("#author-name");
		if (chatname) {
		  const data = {
			chatname: escapeHtml(chatname.innerText),
			type: "youtube"
		  };
		  chrome.runtime.sendMessage(chrome.runtime.id, { "delete": data }, function(e) {});
		}
	  } catch (e) {
		console.error("Error in deleteThis:", e);
	  }
	}

	const messageHistory = new Set();
	const avatarHistory = new Map();
	
	function cloneSvgWithResolvedUse(svgElement) {
		const clonedSvg = svgElement.cloneNode(true);

		const useElements = clonedSvg.querySelectorAll("use");
		useElements.forEach(use => {
			const refId = use.getAttribute("href") || use.getAttribute("xlink:href");
			if (refId) {
				const id = refId.startsWith("#") ? refId.slice(1) : refId;
				const referencedElement = document.getElementById(id);
				if (referencedElement) {
					const clonedReferencedElement = referencedElement.cloneNode(true);
					use.parentNode.replaceChild(clonedReferencedElement, use);
				}
			}
		});

		return clonedSvg;
	}
	
	function replaceEmotesWithImages(text) {
		if (!EMOTELIST) {
			return text;
		}
		
		return text.replace(/(?<=^|\s)(\S+?)(?=$|\s)/g, (match, emoteMatch) => {
			const emote = EMOTELIST[emoteMatch];
			if (emote) {
				const escapedMatch = escapeHtml(emoteMatch);
				const isZeroWidth = typeof emote !== "string" && emote.zw;
				return `<img src="${typeof emote === 'string' ? emote : emote.url}" alt="${escapedMatch}" title="${escapedMatch}" class="${isZeroWidth ? 'zero-width-emote-centered' : 'regular-emote'}"/>`;
			}
			return match;
		});
	}
	
	function isEmoji(char) {
		const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
		return emojiRegex.test(char);
	}
	
	const policy = trustedTypes.createPolicy("myTrustedPolicy", {
	  createHTML: (string) => string
	});

	function getAllContentNodes(element) {
		let result = '';
		let pendingRegularEmote = null;
		let pendingSpace = "";

		function processNode(node) {
			if (node.nodeType === 3 && node.textContent.length > 0) {
				// Text node
				if (settings.textonlymode){
					result += node.textContent;
					return;
				}
				if (!EMOTELIST){
					if (pendingRegularEmote && node.textContent.trim()) {
						result += pendingRegularEmote;
						pendingRegularEmote = null;
						
					}
					if (pendingSpace){
						result += pendingSpace;
						pendingSpace = null;
					} 
					pendingSpace = escapeHtml(node.textContent);
					return;
				}
				const processedText = replaceEmotesWithImages(escapeHtml(node.textContent)); 
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = policy.createHTML(processedText);
				
				Array.from(tempDiv.childNodes).forEach(child => {
					if (child.nodeType === 3) {
						
						if (pendingRegularEmote && child.textContent.trim()) {
							result += pendingRegularEmote;
							pendingRegularEmote = null;
						}
						
						if (pendingSpace){
							result += pendingSpace;
							pendingSpace = null;
						} 
						pendingSpace = escapeHtml(child.textContent);
						
					} else if (child.nodeName === 'IMG') {
						processEmote(child);
					}
				});
			} else if (node.nodeType === 1) {
				// Element node
				if (node.nodeName === "IMG") {
					processEmote(node);
				} else if (node.nodeName.toLowerCase() === "svg" && node.classList.contains("seventv-chat-emote")) {
					if (settings.textonlymode){
						return;
					}
					const resolvedSvg = cloneSvgWithResolvedUse(node);
					resolvedSvg.style = "";
					result += resolvedSvg.outerHTML;
				} else if (node.childNodes.length) {
					Array.from(node.childNodes).forEach(processNode);
				} else if (!settings.textonlymode){
					result += node.outerHTML;
				}
			}
		}

		function processEmote(emoteNode) {
			if (settings.textonlymode){
				if (emoteNode.alt && isEmoji(emoteNode.alt)){
					result += escapeHtml(emoteNode.alt);
				}
				return;
			}
			const isZeroWidth = emoteNode.classList.contains("zero-width-emote") || 
								emoteNode.classList.contains("zero-width-emote-centered");
								
			if (isZeroWidth && pendingRegularEmote) {
				result += `<span class="emote-container">${pendingRegularEmote}${emoteNode.outerHTML}</span>`;
				pendingRegularEmote = null;
				if (pendingSpace){
					result += pendingSpace;
					pendingSpace = null;
				}
			} else if (!isZeroWidth) {
				if (pendingRegularEmote) {
					result += pendingRegularEmote;
					pendingRegularEmote = null;
				}
				if (pendingSpace){
					result += pendingSpace;
					pendingSpace = null;
				}
				
				let newImgAttributes = 'class="regular-emote"';
				if (emoteNode.src) {
					newImgAttributes += ` src="${emoteNode.src.replace('/1.0', '/2.0')}"`;
				}
				if (emoteNode.srcset) {
					let newSrcset = emoteNode.srcset.replace(/^[^,]+,\s*/, ''); // remove first low-res srcset.
					if (newSrcset) {
						newImgAttributes += ` srcset="${newSrcset}"`;
					}
				}
				
				pendingRegularEmote = `<img ${newImgAttributes}>`;
			} else {
				if (pendingSpace){
					result += pendingSpace;
					pendingSpace = null;
				}
				emoteNode.classList.add("regular-emote");
				result += emoteNode.outerHTML;
			}
		}

		processNode(element);

		if (pendingRegularEmote) {
			result += pendingRegularEmote;
		}
		if (pendingSpace){
			result += pendingSpace;
		}

		return result;
	}
	
	function deleteThis(ele) {
		if (ele.deleted){
			return;
		}
		ele.deleted = true;
		try {
			var chatname = ele.querySelector("#author-name");
			if (chatname) {
				var data = {};
				data.chatname = escapeHtml(chatname.innerText);
				data.type = "youtube";
				try {
					chrome.runtime.sendMessage(chrome.runtime.id, {
						"delete": data
					}, function(e) {});
				} catch (e) {
					//
				}
			}
		} catch (e) {}
	}

	var EMOTELIST = false;
	function mergeEmotes(){ // BTTV takes priority over 7TV in this all.
		
		EMOTELIST = {};
		
		if (BTTV) {
			//console.log(BTTV);
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
					// for testing.
					// EMOTELIST = deepMerge({"ASSEMBLE0":{url:"https://cdn.7tv.app/emote/641f651b04bb57ba4db57e1d/1x.webp","zw":true}}, EMOTELIST);
					
				} catch (e) {}
			}
		}
		if (SEVENTV) {
			//console.log(SEVENTV);
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
		//console.log(EMOTELIST);
	}

	function extractYouTubeRedirectUrl(youtubeUrl) {
		const url = new URL(youtubeUrl);
		if (url.hostname === "www.youtube.com" && url.pathname === "/redirect") {
			const actualUrl = url.searchParams.get("q");
			if (actualUrl) {
				return actualUrl.replace(/\&/g, "&amp;");
			} else {
				return youtubeUrl;
			}
		} else {
			return youtubeUrl;
		}
	}

	function getAllContentNodes2(element) {
		var resp = "";
		element.childNodes.forEach(node => {
			if (node.childNodes.length) {
				resp += getAllContentNodes(node);
			} else if (node.nodeType === 3) {
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1) {
				if (node.nodeName === "IMG" && node.src) {
					resp += `<img src="${node.src}">`;
				} else {
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}


	function findSingleInteger(input) {
		// Ensure the input is a string
		const str = String(input);

		const matches = str.match(/\d+/g);
		if (matches && matches.length === 1) {
			return parseInt(matches[0], 10);
		} else {
			return false;
		}
	}
	
	function isHTMLElement(variable) {
	  return variable instanceof HTMLElement || variable instanceof Node;
	}

	function isObject(variable) {
	  return typeof variable === 'object' && variable !== null && !isHTMLElement(variable);
	}
	
	function delay(ms) {
	  return new Promise(resolve => setTimeout(resolve, ms));
	}

	async function processMessage(ele, wss = true) {
		if (!ele || !ele.isConnected){
			return;
		}
		if (ele.hasAttribute("is-deleted")) {
			deleteThis(ele)
			return;
		}
	

		if (settings.customyoutubestate) {
			return;
		}
		try {
			if (ele.skip) {
				return;
			} else if (ele.id) {
				if (messageHistory.has(ele.id)) return;
				messageHistory.add(ele.id);
				if (messageHistory.size > 255) { // 250 seems to be Youtube's max?
				  const iterator = messageHistory.values();
				  messageHistory.delete(iterator.next().value);
				}
		    } else {
				return; // no id.
		    }
			if (ele.querySelector("[in-banner]")) {
				//console.log("Message in-banner");
				return;
			}
		} catch (e) {}

		ele.skip = true;

		//if (channelName && settings.customyoutubestate){
		//if (settings.customyoutubeaccount && settings.customyoutubeaccount.textsetting && (settings.customyoutubeaccount.textsetting.toLowerCase() !== channelName.toLowerCase())){
		//	return;
		//} else if (!settings.customyoutubeaccount){
		//	return;
		//}
		//  }

		var chatmessage = "";
		var chatname = "";
		var chatimg = "";
		var nameColor = "";
		var member = false;
		var mod = false;

		var srcImg = ""; // what shows up as the source image; blank is default (dock decides).

		try {
			var nameElement = ele.querySelector("#author-name");
			chatname = escapeHtml(nameElement.innerText);
			if (!chatname){
				return;
			}

			if (!settings.nosubcolor) {
				if (nameElement.classList.contains("member")) {
					nameColor = "#107516";
					member = true;
				} else if (nameElement.classList.contains("moderator")) {
					nameColor = "#5f84f1";
					mod = true;
				}
			}
		} catch (e) {}

		try {
			var BTT = ele.querySelectorAll(".bttv-tooltip");
			for (var i = 0; i < BTT.length; i++) {
				BTT[i].outerHTML = "";
			}
		} catch (e) {}

		if (!settings.textonlymode) {
			try {
				chatmessage = getAllContentNodes(ele.querySelector("#message, .seventv-yt-message-content"));
			} catch (e) {
				//console.warn(ele);
				//console.error(e);
			}
		} else {
			try {
				var cloned = ele.querySelector("#message, .seventv-yt-message-content").cloneNode(true);
				//var children = cloned.querySelectorAll("[alt]");
				//for (var i =0;i<children.length;i++){
				//	children[i].outerHTML = children[i].alt;
				//}
				var children = cloned.querySelectorAll('[role="tooltip"]');
				for (var i = 0; i < children.length; i++) {
					children[i].outerHTML = "";
				}
				chatmessage = getAllContentNodes(cloned);
			} catch (e) {
				//console.error(e);
			}
		}

		chatmessage = chatmessage.trim();
		chatmessage = chatmessage.replaceAll("=w16-h16-", "=w48-h48-"); // increases the resolution of emojis
		chatmessage = chatmessage.replaceAll("=w24-h24-", "=w64-h64-");
		chatmessage = chatmessage.replaceAll("=s16-", "=s48-");
		chatmessage = chatmessage.replaceAll("=s24-", "=s48-");

		try {
			chatimg = ele.querySelector("#img[src], #author-photo img[src]").src;
			if (chatimg.startsWith("data:image/gif;base64")) { 
				await delay(500);console.log(ele);
				chatimg = document.querySelector("#"+ele.id+" #author-photo img[src]:not([src^='data:image/gif;base64'])") || "";
				if (chatimg){
					chatimg = chatimg.src;
				}
			}
		} catch (e) {
			console.log(e);
			chatimg = "";
		}
		
		if (chatimg){
			chatimg = chatimg.replace("=s32-", "=s64-"); 
			avatarHistory.set(chatname, chatimg);
		} else {
			chatimg = avatarHistory.get(chatname) || "";
			// console.log("no image..", chatimg);
		}

		var chatdonation = "";
		try {
			chatdonation = escapeHtml(ele.querySelector("#purchase-amount").innerText);
		} catch (e) {}

		var chatmembership = "";

		try {
			chatmembership = ele.querySelector(".yt-live-chat-membership-item-renderer #header-subtext").innerHTML;
		} catch (e) {}

		var treatAsMemberChat = false;
		if (!chatmembership && settings.allmemberchat) {
			if (ele.hasAttribute("author-type")) {
				if (ele.getAttribute("author-type") === "member") {
					//chatmembership = chatmessage;
					treatAsMemberChat = true;
					member = true;
				} else if (ele.getAttribute("author-type") === "moderator") {
					//chatmembership = chatmessage;
					treatAsMemberChat = true;
					mod = true;
				}
			}
		} else if (chatmembership) {
			treatAsMemberChat = true;
		}
		
		var chatsticker = "";
		try {
			chatsticker = ele.querySelector(".yt-live-chat-paid-sticker-renderer #sticker>#img[src]").src;
		} catch (e) {}

		if (chatsticker) {
			try {
				chatdonation = escapeHtml(ele.querySelector("#purchase-amount-chip").innerText);
			} catch (e) {}
		}

		var chatbadges = [];
		try {
			ele.querySelectorAll(".yt-live-chat-author-badge-renderer img, .yt-live-chat-author-badge-renderer svg").forEach(img => {
				if (img.tagName.toLowerCase() == "img") {
					var html = {};
					html.src = img.src;
					html.type = "img";
					chatbadges.push(html);
				} else if (img.tagName.toLowerCase() == "svg") {
					var html = {};
					img.style.fill = window.getComputedStyle(img).color;
					html.html = img.outerHTML;
					html.type = "svg";
					chatbadges.push(html);
				}
			});
		} catch (e) {}

		var hasDonation = "";
		if (chatdonation) {
			hasDonation = chatdonation;
		}

		var hasMembership = "";

		var subtitle = "";

		var giftedmemembership = ele.querySelector("#primary-text.ytd-sponsorships-live-chat-header-renderer");
		
		var eventType = false;

		if (treatAsMemberChat) {
			if (chatmessage) {
				if (mod) {
					hasMembership = chatmembership || getTranslation("moderator-chat", "MODERATOR");
				} else {
					hasMembership = chatmembership || getTranslation("member-chat", "MEMBERSHIP");
				}
				var membershipLength = ele.querySelector("#header-subtext.yt-live-chat-membership-item-renderer, #header-primary-text.yt-live-chat-membership-item-renderer") || false;
				if (membershipLength) {
					membershipLength = getAllContentNodes(membershipLength);
					membershipLength = findSingleInteger(membershipLength);
				}
				if (membershipLength) {
					if (membershipLength == 1) {
						subtitle = membershipLength + " " + getTranslation("month", "month");
					} else {
						subtitle = membershipLength + " " + getTranslation("months", "months");
					}
				}
			} else if (giftedmemembership) {
				hasMembership = getTranslation("sponsorship", "SPONSORSHIP");
				chatmessage = getAllContentNodes(giftedmemembership);
				eventType = "sponsorship";
			} else {
				hasMembership = getTranslation("new-member", "NEW MEMBER");
				eventType = "newmember";
				
				if (chatmembership){
					chatmessage =  chatmembership;
				} else {
					chatmessage = getTranslation("new-membership", "Joined as a member");
				}
			}

			if (!hasMembership) {
				if (member) {
					hasMembership = getTranslation("member-chat", "MEMBERSHIP");
				} else if (mod) {
					hasMembership = getTranslation("moderator-chat", "MODERATOR");
				}
			}
		} else if (!chatmessage && giftedmemembership) {
			eventType = "sponsorship";
			chatmessage = getAllContentNodes(giftedmemembership);
			hasMembership = getTranslation("sponsorship", "SPONSORSHIP");
		}
		
		if (settings.memberchatonly && !hasMembership){
			return;
		}

		if (giftedmemembership && !hasDonation) {
			try {
				const match = giftedmemembership.innerText.match(/\b\d+\b/);
				hasDonation = match ? parseInt(match[0], 10) : null;
				if (hasDonation) {
					if (hasDonation==1){
						hasDonation += " " + getTranslation("gifted-membership", "Gifted");
					} else {
						hasDonation += " " + getTranslation("gifted-memberships", "Gifted");
					}
				}
			} catch (e) {
				hasDonation = "";
			}
		}
		
		if (chatsticker) {
			if (!settings.textonlymode) {
				chatmessage = '<img class="supersticker" src="' + chatsticker + '">';
			}
		}

		var backgroundColor = "";

		var textColor = "";
		if (ele.style.getPropertyValue("--yt-live-chat-paid-message-primary-color")) {
			backgroundColor = ele.style.getPropertyValue("--yt-live-chat-paid-message-primary-color");
			textColor = "#111;";
		}

		if (ele.style.getPropertyValue("--yt-live-chat-sponsor-color")) {
			backgroundColor = ele.style.getPropertyValue("--yt-live-chat-sponsor-color");
			textColor = "#111;";
		}

		srcImg = document.querySelector("#input-panel");
		if (srcImg) {
			srcImg = srcImg.querySelector("#img[src]");
			if (srcImg) {
				srcImg = srcImg.src || "";
			} else {
				srcImg = "";
			}
		} else {
			srcImg = "";
		}

		if (!chatmessage && !hasDonation) {
			//console.error("No message or donation");
			return;
		}
		
		if (isHTMLElement(chatmessage)){
			//console.error(chatmessage);
			chatmessage = escapeHtml(chatmessage.textContent.trim());
		} else if (isObject(chatmessage)){
			//console.error(chatmessage);
			chatmessage = "";
		}
		

		var data = {};
		data.chatname = chatname;
		data.nameColor = nameColor;
		data.chatbadges = chatbadges;
		data.backgroundColor = backgroundColor;
		data.textColor = textColor;
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = hasMembership;
		data.subtitle = subtitle;
		if (videoId){
			data.videoid = videoId;
		}
		data.textonly = settings.textonlymode || false;
		data.type = "youtube";
		
		if (youtubeShorts){
			data.type = "youtubeshorts";
		}
		
		if (data.hasDonation){
			data.title = getTranslation("donation", "DONATION");
			if (!data.chatmessage){
				data.chatmessage = getTranslation("thank-you", "Thank you for your donation!");
				if (!data.event){
					data.event = "thankyou";
				}
			}
		}
		
		data.event = eventType;
		
		//if (eventType){
		//	console.log(data);
		//}

		try {
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				{
					message: data
				},
				function () {}
			);
		} catch (e) {}
	}
	var settings = {};
	var BTTV = false;
	var videosMuted = false;
	var SEVENTV = false;
	
	function containsShorts(url) {
		const urlObj = new URL(url);
		const searchParams = new URLSearchParams(urlObj.search);
		const hasShortsParam = searchParams.has('shorts');
		const hasShortsPath = urlObj.pathname.includes('/shorts');
		return hasShortsParam || hasShortsPath;
	}
	
	var youtubeShorts = false;
	if (containsShorts(window.location.href)){
		youtubeShorts = true;
	}
	
	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if ("focusChat" == request) {
				document.querySelector("div#input").focus();
				sendResponse(true);
				return;
			}
			if (typeof request === "object") {
				if ("settings" in request) {
					settings = request.settings;
					sendResponse(true);
					if (settings.bttv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true }, function (response) {});
					}
					if (settings.seventv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true }, function (response) {});
					}
					if (settings.delayyoutube){
						captureDelay = 3200;
						//console.log(captureDelay);
					} else {
						captureDelay = 200;
						//console.log(captureDelay);
					}
					return;
				}
				if ("SEVENTV" in request) {
					SEVENTV = request.SEVENTV;
					//console.log(SEVENTV);
					sendResponse(true);
					mergeEmotes();
					return;
				}
				if ("BTTV" in request) {
					BTTV = request.BTTV;
					//console.log(BTTV);
					sendResponse(true);
					mergeEmotes();
					return;
				}

				if ("muteWindow" in request) {
					if (request.muteWindow) {
						clearInterval(videosMuted);
						videosMuted = setInterval(function () {
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
	});

	var captureDelay = 200;

	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		// {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response) {
			settings = response.settings;
			if (settings.bttv && !BTTV) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true }, function (response) {});
			}
			if (settings.seventv && !SEVENTV) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true }, function (response) {});
			}
			if (settings.delayyoutube){
				captureDelay = 2000;
				//console.log(captureDelay);
			} else {
				captureDelay = 200;
				//console.log(captureDelay);
			}
		}
	});

	function onElementInserted(target, callback) {
		var onMutationsObserved = function (mutations) {
			mutations.forEach(function (mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i] && mutation.addedNodes[i].classList && mutation.addedNodes[i].classList.contains("yt-live-chat-banner-renderer")) {
								continue;
							} else if (mutation.addedNodes[i].tagName == "yt-live-chat-text-message-renderer".toUpperCase()) {
								callback(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].tagName == "yt-live-chat-paid-message-renderer".toUpperCase()) {
								callback(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].tagName == "yt-live-chat-membership-item-renderer".toUpperCase()) {
								callback(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].tagName == "yt-live-chat-paid-sticker-renderer".toUpperCase()) {
								callback(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].tagName == "ytd-sponsorships-live-chat-gift-purchase-announcement-renderer".toUpperCase()) {
								// ytd-sponsorships-live-chat-gift-purchase-announcement-renderer
								callback(mutation.addedNodes[i]);
							} else {
								//console.error("unknown: "+mutation.addedNodes[i].tagName);
							}
						} catch (e) {}
					}
				}
			});
		};
		if (!target) {
			return;
		}
		var config = {childList: true, subtree: false};
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

	console.log("Social stream inserted");

	const checkTimer = setInterval(function () {
	  const ele = document.querySelector("yt-live-chat-app #items.yt-live-chat-item-list-renderer");
	  if (ele && !ele.skip) {
		ele.skip = true;
		setupDeletionObserver(ele);
		onElementInserted(ele, function (ele2) {
			setTimeout(() => processMessage(ele2, false), captureDelay);
		});
	  } else if (!ele){
		 const message = document.querySelector("yt-live-chat-app yt-formatted-string.yt-live-chat-message-renderer");
		if (message && !document.getElementById("videoIdInput")) {
			message.innerText = 
				"It doesn't seem like we've been able to find any active live Youtube chat.\n\n" +
				"➡️ Your Youtube stream must be already Live, active, and public for this option to work.\n\n" +
				"Please stop and reactivate this Youtube option once your video is public and live.\n\n\n\n\n" +
				"For unlisted videos, you can use a specific video ID instead.\n\n" +
				"If you know the video ID, you can try loading it specifically below:\n\n\n";

			// Create input element
			const input = document.createElement('input');
			input.type = 'text';
			input.id = 'videoIdInput';
			input.placeholder = 'Enter video ID';
			message.parentNode.insertBefore(input, message.nextSibling);

			// Create button element
			const button = document.createElement('button');
			button.id = 'loadChatButton';
			button.textContent = 'Load Chat';
			message.parentNode.insertBefore(button, input.nextSibling);

			// Add event listener to the button
			button.addEventListener('click', () => {
				const videoId = input.value.trim();
				if (videoId) {
					window.location.href = `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;
				} else {
					alert('Please enter a valid video ID');
				}
			});
		}
	  }
	  // style-scope yt-live-chat-message-renderer
	  
	}, 1000);

	if (window.location.href.includes("youtube.com/watch")) {
		var checkTimer2 = setInterval(function () {
			try {
				if (document.querySelector("iframe[src]") && !document.querySelector("iframe[src]").src.includes("truffle.vip")) {
					var ele = document.querySelector("iframe").contentWindow.document.body.querySelector("#chat-messages");
				} else {
					var ele = false;
				}
			} catch (e) {}
			if (ele) {
				clearInterval(checkTimer2);
				var cleared = false;
				try {
					ele.querySelectorAll("yt-live-chat-text-message-renderer").forEach(ele4 => {
						ele4.skip = true;
						cleared = true;
						if (ele4.id) {
							messageHistory.add(ele4.id);
						}
					});
				} catch (e) {}
				if (cleared) {
					onElementInserted(ele, function (ele2) {
						setTimeout(
							function (ele2) {
								processMessage(ele2, false);
							},
							captureDelay,
							ele2
						);
					});
				} else {
					setTimeout(function () {
						onElementInserted(document.querySelector("iframe").contentWindow.document.body.querySelector("#chat-messages"), function (ele2) {
							setTimeout(
								function (ele2) {
									processMessage(ele2, false);
								},
								captureDelay,
								ele2
							);
						});
					}, 1000);
				}
			}
		}, 3000);
	}
	

	try {
		var receiveChannelCallback = function (e) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function (e) {};
			remoteConnection.datachannel.onopen = function (e) {};
			remoteConnection.datachannel.onclose = function (e) {};
			setInterval(function () {
				if (document.hidden) {
					// only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE");
				}
			}, 800);
		};
		var errorHandle = function (e) {};
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = e => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = e => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function (e) {
			localConnection.sendChannel.send("CONNECTED");
		};
		localConnection.sendChannel.onclose = function (e) {};
		localConnection.sendChannel.onmessage = function (e) {};
		localConnection
			.createOffer()
			.then(offer => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then(answer => remoteConnection.setLocalDescription(answer))
			.then(() => {
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch (e) {
		console.log(e);
	}
})();
