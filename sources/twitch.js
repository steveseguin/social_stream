(function () {
	var isExtensionOn = true;

	async function fetchWithTimeout(URL, timeout = 8000) {
		// ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {
				...{
					timeout: timeout
				},
				signal: controller.signal
			});
			clearTimeout(timeout_id);
			return response;
		} catch (e) {
			errorlog(e);
			return await fetch(URL); // iOS 11.x/12.0
		}
	}

	function getTranslation(key, value = false) {
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
	}

	const hideContentInParentheses = str => str.replace(/\(.*?\)/g, "");

	function getTwitchAvatarImage(username) {
		fetchWithTimeout("https://api.socialstream.ninja/twitch/avatar?username=" + encodeURIComponent(username))
			.then(response => {
				response.text().then(function (text) {
					if (text.startsWith("https://")) {
						brandedImageURL = text;
					}
				});
			})
			.catch(error => {
				//console.log("Couldn't get avatar image URL. API service down?");
			});
	}
	var channelName = "";
	var brandedImageURL = "";
	var xx = window.location.pathname.split("/");
	xx = xx.filter(segment => !['chat', 'u', 'moderator', 'dashboard', '', 'popout'].includes(segment));
	if (xx[0]) {
		channelName = xx[0];
		getTwitchAvatarImage(xx[0]);
	}

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

	function stripHtmlContent(html) {
		if (!html) {
			return "";
		}
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = html;
		tempDiv.querySelectorAll("img").forEach(img => {
			const altText = img.getAttribute("alt") || img.getAttribute("title") || "";
			if (altText) {
				const textNode = document.createTextNode(altText);
				img.parentNode.replaceChild(textNode, img);
			} else {
				img.remove();
			}
		});
		return (tempDiv.textContent || tempDiv.innerText || "").trim();
	}

	function sanitizeReplyMarkup(html) {
		if (!html) {
			return "";
		}
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = html;
		tempDiv.querySelectorAll("svg").forEach(svg => svg.remove());
		return tempDiv.innerHTML.trim();
	}

	function getReplyTarget(ele) {
		try {
			const ariaLabel = ele?.getAttribute?.("aria-label") || "";
			if (!ariaLabel) {
				return "";
			}
			const match = ariaLabel.match(/Replying to\s+([^,]+)/i);
			if (match && match[1]) {
				return match[1].trim();
			}
		} catch (e) {}
		return "";
	}

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

	function isEmbeddedPopout() {
		try {
			// Twitch sets referrer to the popout URL even for standalone tabs now.
			// Use frame context to detect actual embedding and avoid double-processing only when framed.
			return window.self !== window.top || !!window.frameElement;
		} catch (e) {
			return true;
		}
	}
	
	const SELECTORS = {
		displayName: ".chat-author__display-name, .chatter-name, .seventv-chat-user-username,  [data-test-selector='extension-message-name'], .seventv-chat-user-username",
		messageBody: ".seventv-chat-message-body, .seventv-message-context, [data-test-selector='chat-line-message-body'], [data-a-target='chat-line-message-body'], .message,  [data-a-target='chat-message-text']",
		chatBadges: "img.chat-badge[src], img.chat-badge[srcset], .seventv-chat-badge>img[src], .seventv-chat-badge>img[srcset], .ffz-badge, .user-pronoun, img.chat-badge[src]",
		messageContainer: ".chat-line__message, .seventv-message, .paid-pinned-chat-message-content-wrapper, .room-message"
	};

	const KNOCK_PRIMARY_PATTERNS = [/wants to collaborate/i];
	const KNOCK_FALLBACK_PATTERNS = [/stream together/i, /co-?stream/i];
	
	const emoteRegex = /(?<=^|\s)(\S+?)(?=$|\s)/g;
	
	function replaceEmotesWithImages(text) {
		if (!EMOTELIST) {
			return text;
		}
		
		return text.replace(emoteRegex, (match, emoteMatch) => {
			const emote = EMOTELIST[emoteMatch];
			if (!emote) return match;
			
			const escapedMatch = escapeHtml(emoteMatch);
			const isZeroWidth = typeof emote !== "string" && emote.zw;
			return `<img src="${typeof emote === 'string' ? emote : emote.url}" alt="${escapedMatch}" title="${escapedMatch}" class="${isZeroWidth ? 'zero-width-emote-centered' : 'regular-emote'}"/>`;
		});
	}
	

	function getAllContentNodes(element,type="message") {
		let result = '';
		let pendingRegularEmote = null;
		let pendingSpace = "";

		function processNode(node, checkIgnore=true) {
			if (!node) return;
    
			if (checkIgnore && node.dataset?.ignore) return;
			
			if (node.nodeType === 3) { // Text node
				if (node.textContent.length === 0) return;
				
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
				try {
					tempDiv.innerHTML = processedText;
				} catch(e){}
				
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
				
				if (type == "event" && (node.classList.contains("seventv-message") || node.classList.contains("chat-line__message") || node.classList.contains("paid-pinned-chat-message-content-wrapper"))){
					return;
				}
				node.dataset.ignore = type;
				
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
				} else if (node.nodeName.toLowerCase() === "svg"){
					if (settings.textonlymode){
						if (pendingSpace){
							result += pendingSpace;
							pendingSpace = null;
						} 
						pendingSpace = " ";
						return;
					}
					if (pendingSpace){
						result += pendingSpace;
						pendingSpace = null;
					}
					const resolvedSvg = cloneSvgWithResolvedUse(node);
					resolvedSvg.style="width:24px;height:24px"
					resolvedSvg.removeAttribute("width");
					resolvedSvg.removeAttribute("height");
					pendingSpace = " " + resolvedSvg.outerHTML + " " ;
				} else if (node.childNodes.length) {
					Array.from(node.childNodes).forEach(processNode);
				}
			}
		}
		
		const baseUrl = `${window.location.protocol}//${window.location.host}`;
		
		function getAbsoluteSrc(imgNode) {
		  if (imgNode.src.startsWith('http')) {
			return imgNode.src;
		  } else if (imgNode.src.startsWith('/')) {
			return baseUrl + imgNode.src;
		  } else {
			return `${baseUrl}/${imgNode.src}`;
		  }
		}

		function processEmote(emoteNode) {
			if (settings.textonlymode){
				if (emoteNode.alt){
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
					
					const newImageURL = getAbsoluteSrc(emoteNode);
					newImgAttributes += ` src="${newImageURL.replace('/1.0', '/2.0')}"`;
				}
				if (emoteNode.srcset) {
					let newSrcset = emoteNode.srcset.replace(/^[^,]+,\s*/, ''); // remove first low-res srcset.
					if (newSrcset) {
						newImgAttributes += ` srcset="${newSrcset}"`;
					}
				}
				
				if (emoteNode.alt) {
					newImgAttributes += ` alt="${emoteNode.alt}" title="${emoteNode.alt}"`;
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

		processNode(element, false);

		if (pendingRegularEmote) {
			result += pendingRegularEmote;
		}
		if (pendingSpace){
			result += pendingSpace;
		}

		return result;
	}
	
	function getTextWithSpaces(element) {
	  let textArray = [];
	  
	  function traverse(node) {
		if (node.nodeType === Node.TEXT_NODE) {
		  const trimmed = node.textContent.trim();
		  if (trimmed) {
			textArray.push(trimmed);
		  }
		} else if (node.nodeType === Node.ELEMENT_NODE) {
		  if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
			for (const child of node.childNodes) {
			  traverse(child);
			}
		  }
		}
	  }
	  
	  traverse(element);
		return textArray;
	}

	function findKnockMessageNode(root, patterns) {
		if (!root || !root.querySelectorAll) {
			return null;
		}
		const nodes = root.querySelectorAll("p, span");
		for (const node of nodes) {
			const text = node.textContent ? node.textContent.trim() : "";
			if (!text) {
				continue;
			}
			for (const pattern of patterns) {
				if (pattern.test(text)) {
					return node;
				}
			}
		}
		return null;
	}

	function extractKnockMessage(root) {
		const primaryNode = findKnockMessageNode(root, KNOCK_PRIMARY_PATTERNS);
		if (primaryNode) {
			return { node: primaryNode, text: primaryNode.textContent.trim() };
		}
		const fallbackNode = findKnockMessageNode(root, KNOCK_FALLBACK_PATTERNS);
		if (fallbackNode) {
			return { node: fallbackNode, text: fallbackNode.textContent.trim() };
		}
		return null;
	}

	function findKnockAlertContainer(node) {
		if (!node || node.nodeType !== 1) {
			return null;
		}
		let anchor = null;
		let current = node;
		for (let depth = 0; depth < 3 && current; depth++) {
			const messageMatch = extractKnockMessage(current);
			const openCallNode = current.matches?.("[class*='openCallingAlert']") ? current : current.querySelector?.("[class*='openCallingAlert']");
			anchor = messageMatch?.node || openCallNode;
			if (anchor) {
				break;
			}
			current = current.parentNode;
		}
		if (!anchor) {
			return null;
		}
		const queueRoot = anchor.closest?.("[data-a-target='chat-alert-queue']");
		if (!queueRoot) {
			return null;
		}
		const container = anchor.closest("[class*='engagement--']") || anchor.closest("[class*='expanded--']") || anchor;
		if (!container || container.dataset.ignore) {
			return null;
		}
		return container;
	}

	function processKnockAlert(container) {
		if (!container || container.dataset.ignore) {
			return;
		}
		container.dataset.ignore = true;

		const messageMatch = extractKnockMessage(container);
		if (!messageMatch || !messageMatch.text) {
			return;
		}
		const messageText = messageMatch.text.trim();
		if (!messageText) {
			return;
		}

		const now = Date.now();
		if (messageText === lastKnockMessage && now - lastKnockAt < 5000) {
			return;
		}
		lastKnockMessage = messageText;
		lastKnockAt = now;

		let chatname = "";
		const nameMatch = messageText.match(/^(.+?)\s+wants to collaborate/i);
		if (nameMatch && nameMatch[1]) {
			chatname = nameMatch[1].trim();
		}

		let avatarSrc = "";
		const avatarImg = container.querySelector("img[alt]");
		if (avatarImg) {
			if (!chatname) {
				chatname = avatarImg.getAttribute("alt") || "";
			}
			avatarSrc = avatarImg.getAttribute("src") || "";
		}

		var data = {};
		data.chatname = escapeHtml(chatname);
		data.chatbadges = [];
		data.nameColor = "";
		data.chatmessage = escapeHtml(messageText);
		data.chatimg = avatarSrc;
		data.hasDonation = "";
		data.membership = "";
		data.type = "twitch";
		data.textonly = settings.textonlymode || false;
		data.event = "knock";

		if (brandedImageURL) {
			data.sourceImg = brandedImageURL;
		}
		if (channelName){
			data.sourceName = channelName;
		}

		try {
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				{
					message: data
				},
				function (e) {}
			);
		} catch (e) {
			//
		}
	}

	const SUBSCRIBER_PATTERNS = [
		{ keyword: "subscriber", label: "Subscriber" },
		{ keyword: "suscriptor", label: "Suscriptor" },
		{ keyword: "abonné", label: "Abonné" },
		{ keyword: "abonnent", label: "Abonnent" },
		{ keyword: "abbonato", label: "Abbonato" },
		{ keyword: "assinante", label: "Assinante" },
		{ keyword: "abonnee", label: "Abonnee" },
		{ keyword: "prenumerant", label: "Prenumerant" },
		{ keyword: "подписчик", label: "Подписчик" },
		{ keyword: "订阅者", label: "订阅者" },
		{ keyword: "購読者", label: "購読者" },
		{ keyword: "구독자", label: "구독자" }
	];

	const SUBSCRIBER_SET_IDS = new Set(["subscriber"]);

	function matchSubscriberKeyword(text) {
		if (!text) {
			return null;
		}
		const lower = text.toLowerCase();
		for (const pattern of SUBSCRIBER_PATTERNS) {
			if (lower.includes(pattern.keyword)) {
				return pattern.label;
			}
		}
		return null;
	}

	function isSubscriptionNoticeText(text) {
		if (!text) {
			return false;
		}
		if (matchSubscriberKeyword(text)) {
			return true;
		}
		return /\bresub(?:scribed)?\b|\bsubscribed\b|\bsubbed\b|\bprime\s+sub\b|\bsubscription\b|\bgift(?:ed|ing)\s+\d*\s*sub(?:s)?\b/i.test(text);
	}

	function buildSubscriberSubtitle(text, label) {
		if (!text) {
			return "";
		}
		let cleaned = text.replace(/\s*\([^)]*\)/g, "");
		if (label) {
			try {
				const labelRegex = new RegExp(label, "i");
				cleaned = cleaned.replace(labelRegex, "");
			} catch (e) {
				cleaned = cleaned.replace(label, "");
			}
		}
		cleaned = cleaned.replace(/badge/i, "");
		cleaned = cleaned.replace(/\s+/g, " ").trim();
		if (!cleaned) {
			return "";
		}
		if (cleaned.endsWith("-Month") && cleaned !== "1-Month") {
			cleaned += "s";
		}
		return cleaned;
	}

	function getSubscriberInfoFromBadge(badge) {
		const textCandidates = new Set();

		if (badge.alt) {
			textCandidates.add(badge.alt);
		}

		const ariaLabel = badge.getAttribute("aria-label");
		if (ariaLabel) {
			textCandidates.add(ariaLabel);
		}

		const title = badge.getAttribute("title");
		if (title) {
			textCandidates.add(title);
		}

		if (badge.dataset) {
			const datasetKeys = ["aBadge", "badge", "badgeId", "aBadgeId", "badgeTooltip", "aBadgeTooltip"];
			for (const key of datasetKeys) {
				if (badge.dataset[key]) {
					textCandidates.add(badge.dataset[key]);
				}
			}

			const badgeData = badge.dataset.aBadgeData || badge.dataset.badgeData;
			if (badgeData) {
				try {
					const parsed = JSON.parse(badgeData);
					const setId = (parsed.setID || parsed.setId || parsed.badgeID || parsed.badgeId || "").toLowerCase();

					if (setId && SUBSCRIBER_SET_IDS.has(setId)) {
						const display = parsed.title || parsed.tooltip || parsed.badgeId || parsed.badgeID || "Subscriber";
						return {
							label: "Subscriber",
							text: display
						};
					}

					const parsedKeys = ["title", "tooltip", "badgeID", "badgeId", "setID", "setId"];
					for (const key of parsedKeys) {
						if (parsed[key]) {
							textCandidates.add(String(parsed[key]));
						}
					}
				} catch (e) {}
			}
		}

		for (const text of textCandidates) {
			const label = matchSubscriberKeyword(text);
			if (label) {
				return {
					label: label,
					text: text
				};
			}
		}

		const srcCandidates = [badge.src, badge.getAttribute("data-src")];
		for (const src of srcCandidates) {
			if (!src) {
				continue;
			}
			const lowerSrc = src.toLowerCase();
			for (const id of SUBSCRIBER_SET_IDS) {
				if (lowerSrc.includes(id)) {
					return {
						label: "Subscriber",
						text: ""
					};
				}
			}
		}

		return null;
	}

	var lastMessage = "";
	var lastUser = "";
	var lastEle = null;
	var lastKnockMessage = "";
	var lastKnockAt = 0;
	//var midList = [];
	
	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}


	async function processMessage(ele, event=false) {
		
		ele.dataset.ignore = true;
		
		if (settings.delaytwitch){
		  await sleep(3000);
		  if (!ele){return;}
		  if (ele.querySelector(".deleted, [data-a-target='chat-deleted-message-placeholder']")) {
			  // already deleted.
			  return;  
		  }
	    }
	  
	    if (!ele.isConnected){
			return;}
		
		if (ele.classList.contains("chat-line__unpublished-message-body") || ele.querySelector(".chat-line__unpublished-message-body")){
			return;
		}

		var chatsticker = false;
		var chatmessage = "";
		var nameColor = "";
		var donations = 0;
		var highlightColor = "";
		
		try { 
			var displayNameEle = ele.querySelector(SELECTORS.displayName); 
			var displayName = displayNameEle.innerText;
			var username = displayName;
			var usernameEle = ele.querySelector(".chat-author__intl-login");
			if (usernameEle) {
				username = usernameEle.innerText.slice(2, -1);
			}

			username = escapeHtml(username);
			displayName = escapeHtml(displayName);

			displayName = hideContentInParentheses(displayName);

			try {
				nameColor = displayNameEle.style.color || ele.querySelector(".seventv-chat-user, .chat-line__username").style.color;
			} catch (e) {}
		} catch (e) {}

		var chatbadges = [];
		var subscriber = "";
		var subtitle = "";
		var eventtype = ""; 
		var crossChat = "";
		
		var mod = false;
		var vip = false;
		
		try {
			const badges = ele.querySelectorAll(SELECTORS.chatBadges);
			for (const badge of badges) {
				if (!subscriber) {
					const subscriberInfo = getSubscriberInfoFromBadge(badge);
					if (subscriberInfo) {
						subscriber = subscriberInfo.label;
						const subtitleSource = subscriberInfo.text || badge.alt || badge.getAttribute("aria-label") || "";
						subtitle = buildSubscriberSubtitle(subtitleSource, subscriber);
					}
				}

				const badgeText = (badge.alt || badge.getAttribute("aria-label") || badge.getAttribute("title") || "").trim();
				const loweredBadgeText = badgeText.toLowerCase();

				if (badgeText && badgeText.includes(", ")) {
					const name11 = badgeText.split(", ").pop();
					if (name11) {
						crossChat = "https://api.socialstream.ninja/twitch/?username=" + encodeURIComponent(name11);
					}
				}

				if (!mod && loweredBadgeText === "moderator") {
					mod = true;
				}
				if (!vip && loweredBadgeText === "vip") {
					vip = true;
				}

				if (badge.srcset) {
					let bb = badge.srcset.split("https://").pop();
					if (bb) {
						bb = "https://" + bb.split(" ")[0];
						if (!chatbadges.includes(bb)) {
							chatbadges.push(bb);
						}
					}
				} else if (badge.src && !chatbadges.includes(badge.src)) {
					chatbadges.push(badge.src);
				} else if (badge.classList && badge.classList.contains("ffz-badge")) {
					try {
						var computed = getComputedStyle(badge);
						if (computed.backgroundImage) {
							var bage = {};
							bage.src = computed.backgroundImage.split('"')[1].split('"')[0];
							bage.type = "img";
							if (computed.backgroundColor) {
								bage.bgcolor = computed.backgroundColor;
							}
							if (computed) {
								chatbadges.push(bage);
							}
						}
					} catch (e) {}
				}
				/* else if (badge.classList.contains("user-pronoun")) { // I'm doing this via the official API now instead
					var bage = {};
					bage.text = escapeHtml(badge.textContent);
					bage.type = "text";
					bage.bgcolor = "#000";
					bage.color = "#FFF";
					chatbadges.push(bage);
				} */
			}
		} catch (e) {}
		
		const hasEventPill = !!ele.querySelector(".message-event-pill");
		const isNoticeAttachment = hasEventPill || (typeof ele.closest === "function" && !!ele.closest(".user-notice-line, [data-test-selector='user-notice-line']"));
		const markSubscriberAsMembership = !!subscriber && (!settings.limitedtwitchmemberchat || isNoticeAttachment);

		if (settings.memberchatonly && !markSubscriberAsMembership){
			return;
		}

		try {
			var BTT = ele.querySelectorAll(".bttv-tooltip");
			for (var i = 0; i < BTT.length; i++) {
				BTT[i].outerHTML = "";
			}
		} catch (e) {}
		
		let crossChatChannelIcon = ele.querySelector(".tw-image-avatar[src]");
		if (crossChatChannelIcon){
			crossChatChannelIcon = crossChatChannelIcon.src;
		}

		var contentimg = ele.querySelector("img[src].chat-line__message--emote-gigantified") || "";
		
		if (contentimg){
			contentimg = contentimg.src;
			
			if (lastMessage === contentimg && lastUser === username && (!lastEle || !lastEle.isConnected)) {
				lastMessage = "";
				username = "";
				return;
			} else {
				lastMessage = contentimg;
				lastUser = username;
				lastEle = ele;
			}
			
		} else {
			try {
				if (event){
					var eleContent = ele.childNodes[0];
				} else {
					var eleContent = ele.querySelector(SELECTORS.messageBody);
				}

				chatmessage = getAllContentNodes(eleContent);

				if (!highlightColor && chatmessage && eleContent.querySelector(".chat-message-mention, .mention-fragment--recipient[data-a-target='chat-message-mention']")) {
					highlightColor = "rgba(225, 20, 20, 0.3)";
				}
			} catch (e) {}

			if (!chatmessage && !event) {
				try {
					var eleContent = ele.querySelector("span.message");
					chatmessage = getAllContentNodes(eleContent);
					if (!highlightColor && chatmessage && eleContent.querySelector(".chat-message-mention, .mention-fragment--recipient[data-a-target='chat-message-mention']")) {
						highlightColor = "rgba(225, 20, 20, 0.3)";
					}
				} catch (e) {}
			}

			if (!chatmessage && !event) {
				try {
					var eleContent = ele.querySelector(".chat-line__message-container .chat-line__username-container").nextElementSibling.nextElementSibling;
					chatmessage = getAllContentNodes(eleContent);
					eleContent = eleContent.nextElementSibling;
					var count = 0;
					while (eleContent) {
						count++;
						chatmessage += getAllContentNodes(eleContent);
						eleContent = eleContent.nextElementSibling;
						if (count > 20) {
							break;
						}
					}
					if (!highlightColor && chatmessage && eleContent.querySelector(".chat-message-mention, .mention-fragment--recipient[data-a-target='chat-message-mention']")) {
						highlightColor = "rgba(225, 20, 20, 0.3)";
					}
				} catch (e) {}
			}

			if (!chatmessage && !event) {
				try {
					var eleContent = ele.querySelector(".paid-pinned-chat-message-content-container").childNodes;

					if (eleContent.length > 1) {
						chatmessage = getAllContentNodes(eleContent[0]);
						donations = escapeHtml(eleContent[1].textContent);
					} else {
						donations = escapeHtml(eleContent[0].textContent);
					}
				} catch (e) {}
			}

			if (chatmessage) {
				chatmessage = chatmessage.trim();
			}
			
			if (lastMessage === chatmessage && lastUser === username && (!lastEle || !lastEle.isConnected)) {
				lastMessage = "";
				username = "";
				return;
			} else {
				lastMessage = chatmessage;
				lastUser = username;
				lastEle = ele;
			}
			if (chatmessage && chatmessage.includes(" (Deleted by ")) {
				return; // I'm assuming this is a deleted message
			}

			if (chatmessage && chatmessage.includes(" Timeout by ")) {
				return; // I'm assuming this is a timed out message
			}

			if (chatmessage && chatmessage.includes(" (Banned by ")) {
				return; // I'm assuming this is a banning message
			}
		}
		
		if (channelName && settings.customtwitchstate) {
			if (settings.customtwitchaccount && settings.customtwitchaccount.textsetting && settings.customtwitchaccount.textsetting.toLowerCase() !== channelName.toLowerCase()) {
				return;
			} else if (!settings.customtwitchaccount) {
				return;
			}
		}

		try {
			if (!donations) {
				var elements = ele.querySelectorAll(".chat-line__message--cheer-amount"); // FFZ support

				for (var i = 0; i < elements.length; i++) {
					donations += parseInt(elements[i].innerText);
				}
				if (donations == 1) {
					donations += " " + getTranslation("bit");
				} else if (donations > 1) {
					donations += " " + getTranslation("bits");
				}
			}
		} catch (e) {}

		if (!donations) {
			try {
				var elements = ele.querySelectorAll(".paid-pinned-chat-message-content-container")[1]; // FFZ support
				donations = escapeHtml(elements.textContent);
			} catch (e) {}
		}
		

		var hasDonation = "";
		if (donations) {
			hasDonation = donations;
		}

		
		if (!chatmessage && !contentimg) {
			try {
				chatmessage = getAllContentNodes(ele.querySelector(".seventv-reward-message-container")).trim();
				eventtype = "reward";
			} catch (e) {}
		}

		if (eventtype && chatmessage) {
			// pass
		} else if (!chatmessage && !hasDonation && !username && !contentimg) {
			return;
		}
		
		var originalMessage = "";
	    var ReplyMessage = "";
		var replyMessage = "";
		var rawReplyMarkup = "";
		var replyTarget = "";
		var hasReply = false;

		try {
			if (!settings.excludeReplyingTo && chatmessage) {
				try {
					var t = ele.querySelector(".chat-line__message-container [title], .seventv-reply-message-part");
					if (t){
						rawReplyMarkup = getAllContentNodes(t).trim();
					}
					if (!rawReplyMarkup && ele.querySelector(".reply-line--mentioned")) {
						rawReplyMarkup = getAllContentNodes(ele.querySelector(".reply-line--mentioned").parentNode).trim();
					}
					if (!rawReplyMarkup) {
						let l = ele.querySelector('path[d="M11 8h2v2h-2V8zM9 8H7v2h2V8z"]');
						if (l){
							rawReplyMarkup = getAllContentNodes(l.parentNode.parentNode.parentNode).trim();
						}
					}
				} catch (e) {
					try {
						rawReplyMarkup = getAllContentNodes(ele.querySelector(".reply-line--mentioned").parentNode).trim();
					} catch (ee) {
					}
				}

					replyTarget = getReplyTarget(ele);
					if (rawReplyMarkup) {
						replyMessage = sanitizeReplyMarkup(rawReplyMarkup);
					}

					if (replyTarget) {
						const normalizedTarget = replyTarget.startsWith("@") ? replyTarget : "@" + replyTarget;
						const replyText = stripHtmlContent(replyMessage);
						if (!replyMessage || !replyText || replyText.toLowerCase() === replyTarget.toLowerCase() || replyText.toLowerCase() === normalizedTarget.toLowerCase()) {
							replyMessage = getTranslation("replying-to", "Replying to") + " " + escapeHtml(normalizedTarget);
						}
					}

				if (!replyMessage && rawReplyMarkup) {
					const fallbackText = stripHtmlContent(rawReplyMarkup);
					if (fallbackText) {
						replyMessage = escapeHtml(fallbackText);
					}
				}

				if (replyMessage) {
					ReplyMessage = replyMessage;
					originalMessage = chatmessage;
					hasReply = true;
					if (settings.textonlymode) {
						var replyTextOnly = stripHtmlContent(replyMessage);
						if (!replyTextOnly && replyTarget) {
							const normalizedTarget = replyTarget.startsWith("@") ? replyTarget : "@" + replyTarget;
							replyTextOnly = getTranslation("replying-to", "Replying to") + " " + normalizedTarget;
						}
						if (!replyTextOnly && rawReplyMarkup) {
							replyTextOnly = stripHtmlContent(rawReplyMarkup);
						}
						replyTextOnly = replyTextOnly || getTranslation("replying-to", "Replying to");
						chatmessage = replyTextOnly + ": " + chatmessage;
					} else {
						chatmessage = "<i><small>" + replyMessage + ":&nbsp;</small></i> " + chatmessage;
					}
				}
			}
		} catch (e) {}

		try {
			if (!highlightColor) {
				var computed = getComputedStyle(ele);
				highlightColor = computed.backgroundColor;
				if (highlightColor == "rgba(0, 0, 0, 0)") {
					highlightColor = "";
				}
				if (!highlightColor) {
					if (computed.borderWidth != "0px") {
						highlightColor = computed.borderColor;
						if (highlightColor == "rgba(0, 0, 0, 0)") {
							highlightColor = "";
						}
					}
				}
				if (!highlightColor) {
					let hlele = ele.querySelector(".has-highlight");
					if (hlele) {
						computed = getComputedStyle(hlele);
						highlightColor = computed.backgroundColor;
						if (highlightColor == "rgba(0, 0, 0, 0)") {
							highlightColor = "";
						}
						if (!highlightColor) {
							if (computed.borderWidth != "0px") {
								highlightColor = computed.borderColor;
								if (highlightColor == "rgba(0, 0, 0, 0)") {
									highlightColor = "";
								}
							}
						}
					}
				}
			}
		} catch (e) {}
			
			
			if (!hasReply && !contentimg && ele.querySelector(".message-event-pill")){
				if (!settings.textonlymode){
					chatmessage = "<i class='event-pill'>"+getAllContentNodes(ele.querySelector(".message-event-pill")) + "</i> " + chatmessage;
				} else {
					chatmessage = getAllContentNodes(ele.querySelector(".message-event-pill")) + "  " + chatmessage;
				}
			}

		var data = {};
		
		if (ReplyMessage){
			data.initial = ReplyMessage;
		}
	    if (originalMessage){
			data.reply = originalMessage;
		}
		
		data.contentimg = contentimg;
		data.chatname = displayName;
		data.username = username;
		data.chatbadges = chatbadges;
		data.nameColor = nameColor;
		data.chatmessage = chatmessage;
		data.highlightColor = highlightColor;
		data.event = eventtype;
		try {
			data.chatimg = "https://api.socialstream.ninja/twitch/?username=" + encodeURIComponent(username); // this is CORS restricted to socialstream, but this is to ensure reliability for all
		} catch (e) {
			data.chatimg = "";
		}
		data.hasDonation = hasDonation;
		data.membership = markSubscriberAsMembership ? subscriber : "";
		data.subtitle = subtitle;
		data.textonly = settings.textonlymode || false;
		data.type = "twitch";
		
		if (mod){
			data.mod = true;
		}
		if (vip){
			data.vip = true;
		}


		if (brandedImageURL) {
			data.sourceImg = brandedImageURL;
		}
		if (crossChat){
			data.sourceImg = crossChat;
		}
		if (crossChatChannelIcon){
			data.sourceImg = crossChatChannelIcon;
		}
		
		if (data.hasDonation){
			data.title = getTranslation("cheers", "CHEERS");
		}

		try {
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				{
					message: data
				},
				function (e) {
					if (e?.id){
						ele.dataset.mid = e.id;
					}
				}
			);
		} catch (e) {
			//
		}
	}
	
	var settings = {};
	var BTTV = false;
	var SEVENTV = false;
	var FFZ = false;
	// settings.textonlymode
	// settings.captureevents

	if (chrome && chrome.runtime) {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			try {
				if ("getSource" === request) {
					sendResponse("twitch");
					return;
				}
				if ("focusChat" == request) {
					// console.log("FOCUS");
					if (!isExtensionOn || isEmbeddedPopout()) {
						return;
					}
						
					document.querySelector('[data-a-target="chat-input"]').focus();
					simulateFocus(document.querySelector('[data-a-target="chat-input"]'));
					
					sendResponse(true);
					return;
				}
				
				if (typeof request === "object") {
					if ("state" in request) {
						isExtensionOn = request.state;
					}
					if ("settings" in request) {
						settings = request.settings;
						sendResponse(true);
						//console.log(settings);
						if (settings.bttv) {
							chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true, channel: channelName ? channelName.toLowerCase() : null, type:"twitch" }, function (response) {});
						}
						if (settings.seventv) {
							chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true, channel: channelName ? channelName.toLowerCase() : null, type:"twitch" }, function (response) {});
						}
						if (settings.ffz) {
							chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true, channel: channelName ? channelName.toLowerCase() : null, type:"twitch"}, function (response) {});
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
					if ("FFZ" in request) {
						FFZ = request.FFZ;
						//console.log(FFZ);
						sendResponse(true);
						mergeEmotes();
						return;
					}
				}

				// twitch doesn't capture avatars already.
			} catch (e) {console.error(e);}
			sendResponse(false);
		});

		chrome.runtime.sendMessage(
			chrome.runtime.id, {getSettings: true},	function (response) {
				// {"state":isExtensionOn,"streamID":channel, "settings":settings}
				//console.log(response, response.settings);
				
				if (response && "settings" in response) {
					settings = response.settings;
					//console.log({...settings});
					if (settings.bttv && !BTTV) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true, channel: channelName ? channelName.toLowerCase() : null, type:"twitch" }, function (response) {
								//console.log(response);
						});
					}
					if (settings.seventv && !SEVENTV) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true, channel: channelName ? channelName.toLowerCase() : null, type:"twitch" }, function (response) {
								//console.log(response);
						});
					}
					if (settings.ffz && !FFZ) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true, channel: channelName ? channelName.toLowerCase() : null, type:"twitch" }, function (response) {
								//console.log(response);
						});
					}
				}
				if (response && "state" in response) {
					
					isExtensionOn = response.state;
					
					checkFollowers();
				}
			}
		);
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
		if (FFZ) {
			//console.log(FFZ);
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
		
		// for testing.
 		//EMOTELIST = deepMerge({
		//	 "ASSEMBLE0":{url:"https://cdn.7tv.app/emote/641f651b04bb57ba4db57e1d/2x.webp","zw":true},
		//	 "oEDM": {url:"https://cdn.7tv.app/emote/62127910041f77b2480365f4/2x.webp","zw":true},
		//	 "widepeepoHappy": "https://cdn.7tv.app/emote/634493ce05c2b2cd864d5f0d/2x.webp"
		// }, EMOTELIST);
		//console.log(EMOTELIST);
	}

	function processEvent(ele) {
		
		ele.dataset.ignore = true;
		
		var data = {};
		var displayName = "";
		var displayNameEle = ele.querySelector(SELECTORS.displayName); 
		if (displayNameEle){
			displayName = displayNameEle.innerText;
			if (displayName){
				displayName = escapeHtml(displayName);
				displayName = hideContentInParentheses(displayName).trim();
			}
		}
		data.chatname = displayName;
		data.chatbadges = [];
		data.nameColor = "";
		data.chatmessage = getAllContentNodes(ele,"event");
		data.chatimg = "";
		data.hasDonation = "";
		data.membership = "";
		data.type = "twitch";
		data.textonly = settings.textonlymode || false;
		data.event = true;
		
		if (!data.chatmessage) {
			return;
		}
		
		// channel-points-reward-line__icon
		if (ele.querySelector("[class*='channel-points-reward']")){
			data.event = "reward";
		} else if (data.chatmessage.includes(" gifting ") && data.chatmessage.includes(" Sub")) {
			data.event = "giftpurchase";
		} else if (data.chatmessage.includes(" gifted ") && data.chatmessage.includes(" Sub")) {
			data.event = "sponsorship";
		}

		if (settings.limitedtwitchmemberchat) {
			const isMembershipNotice = (data.event === "giftpurchase") || (data.event === "sponsorship") || isSubscriptionNoticeText(data.chatmessage);
			if (isMembershipNotice) {
				data.membership = getTranslation("subscriber", "SUBSCRIBER");
			}
		}
		

		if (brandedImageURL) {
			data.sourceImg = brandedImageURL;
		}
		if (channelName){
			data.sourceName = channelName;
		}

		try {
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				{
					message: data
				},
				function (e) {}
			);
		} catch (e) {
			//
		}
	}

	function deleteThis(ele) {
		try {
			ele.dataset.ignore = true;
			if (ele.deleted) {
				return;
			}
			ele.deleted = true;
			
			var chatname = ele.querySelector(SELECTORS.displayName);
			if (chatname) {
				var data = {};
				data.chatname = escapeHtml(chatname.innerText);
				data.type = "twitch";
				ele.dataset.mid ? (data.id = parseInt(ele.dataset.mid)) || null : "";
				
				try {
					chrome.runtime.sendMessage(
						chrome.runtime.id,
						{
							delete: data
						},
						function (e) {}
					);
				} catch (e) {
					//
				}
				return;
			}
			chatname = ele.parentNode.querySelector(SELECTORS.displayName);
			if (chatname) {
				ele.parentNode.dataset.ignore = true;
				if (ele.parentNode.deleted) {
					return;
				}
				ele.parentNode.deleted = true;
				var data = {};
				data.chatname = escapeHtml(chatname.innerText);
				data.type = "twitch";
				try {
					chrome.runtime.sendMessage(
						chrome.runtime.id,
						{
							delete: data
						},
						function (e) {}
					);
				} catch (e) {
					//
				}
				return;
			}
		} catch (e) {}
	}
	
	function checkMessage(ele){
		if (ele.classList.contains("seventv-message") || ele.classList.contains("chat-line__message") || ele.classList.contains("paid-pinned-chat-message-content-wrapper")){
			checkList.push([processMessage,(ele)]);
		} else {
			let nextElement = ele.querySelector(SELECTORS.messageContainer);
			if (nextElement){
				if (nextElement.dataset.ignore) {
					return;
				}
				checkList.push([processMessage,(nextElement)]); // good
			}
		}
	}
					
	function onElementInsertedTwitch(target) {
		var onMutationsObserved = function(mutations) {
			if (!isExtensionOn || isEmbeddedPopout()) {
				return;
			}
			
			const len = mutations.length;
			for (let i = 0; i < len; i++) {
				const mutation = mutations[i];
				
				if (mutation.target === target) continue;
				
				if (mutation.type === "attributes") {
					if (mutation.attributeName === "class" && mutation.target.classList.contains("deleted")) {
						deleteThis(mutation.target);
					} else if (mutation.attributeName === "data-a-target" && 
							  mutation.target.data?.aTarget === "chat-deleted-message-placeholder") {
						deleteThis(mutation.target);
					}
					continue;
				}
				
				if (mutation.type !== "childList" || !mutation.addedNodes.length) continue;
				
				const nodes = mutation.addedNodes;
				const nodesLen = nodes.length;
				
				for (let j = 0; j < nodesLen; j++) {
					const node = nodes[j];
					if (!node || !node.dataset || node.nodeType === 3) continue;
					
					try {
						if ((node.dataset?.aTarget === "chat-deleted-message-placeholder") || 
							node.querySelector('[data-a-target="chat-deleted-message-placeholder"]')) {
							deleteThis(node);
							continue;
						}

						const knockElement = findKnockAlertContainer(node);
						if (knockElement){
							checkList.push([processKnockAlert, knockElement]);
							continue;
						}

						// Always capture stream events (resubs, etc.)
						nextElement = node.querySelector('.user-notice-line, [data-test-selector="user-notice-line"]');
						if (nextElement){
							if (nextElement.dataset.ignore) {
								continue;
							}
							checkMessage(node);
							checkList.push([processEvent,(nextElement)]);

						} else if ((node.dataset.testSelector == "user-notice-line") || node.classList.contains("user-notice-line")) {
							checkMessage(node);
							checkList.push([processEvent,(node)]);

						} else if ((node.parentNode.dataset.testSelector == "user-notice-line") || node.parentNode.classList.contains("user-notice-line")) {
							if (node.parentNode.dataset.ignore){
								continue;
							}
							checkMessage(node.parentNode);
							checkList.push([processEvent,(node.parentNode)]);

						} else if ((node.parentNode.parentNode.dataset.testSelector == "user-notice-line") || node.parentNode.parentNode.classList.contains("user-notice-line")) {
							if (node.parentNode.parentNode.dataset.ignore){
								continue;
							}
							checkMessage(node.parentNode.parentNode);
							checkList.push([processEvent,(node.parentNode.parentNode)]);
						} else {
							checkMessage(node);
						}
					} catch (e) {
						console.error(e);
					}
				}
				checkNextList();
			};
		}

		if (document.querySelector("seventv-container")) {
			var config = {
				childList: true, // Observe the addition of new child nodes
				subtree: true, // Observe the target node and its descendants
				attributes: true, // Observe attributes changes
				attributeOldValue: true, // Optionally capture the old value of the attribute
				attributeFilter: ["data-a-target", "class"] // Only observe changes to 'is-deleted' attribute
			};
		} else {
			var config = {
				childList: true, // Observe the addition of new child nodes
				subtree: true, // Observe the target node and its descendants
				attributes: true, // Observe attributes changes
				attributeOldValue: true, // Optionally capture the old value of the attribute
				attributeFilter: ["data-a-target"] // Only observe changes to 'is-deleted' attribute
			};
		}
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

	console.log("Social Stream injected");

	var counter = 0;
	var checkElement = ".chat-list--other, .chat-list--default, .chat-room__content";
	
	var checkList = [];
	var checkListTimer = null;
	var processingCheckList = false;

	function checkNextList() {
		if (processingCheckList) return;
		
		clearTimeout(checkListTimer);
		checkListTimer = setTimeout(() => {
			processingCheckList = true;
			
			try {
				// Process one item at a time to maintain original behavior
				while (checkList.length) {
					const func = checkList[0];
					if (func[1] && !func[1].dataset.ignore && func[1].isConnected) {
						func[0](func[1]);
						break; // Process one item then wait
					}
					checkList.shift();
				}
			} catch(e) {
				console.error(e);
			}
			
			processingCheckList = false;
			
			if (checkList.length) {
				checkNextList(); // Schedule next batch after 20ms
			}
		}, 20);
	}

	var checkReady = null;

	function startChatWatcher() {
		return setInterval(function () {
			counter += 1;
			
			if (counter == 10) {
				checkElement = ".chat-list--other, .chat-list--default, .chat-room__content, #root";
			}
			
			const initialTarget = document.querySelector(checkElement);
			
			if (initialTarget) {
				// just in case
				console.log("Social Stream Start");
				clearInterval(checkReady);
				setTimeout(function () {
					var clear = document.querySelectorAll("seventv-container, .seventv-message, .chat-line__message, .paid-pinned-chat-message-content-wrapper");
					for (var i = 0; i < clear.length; i++) {
						clear[i].dataset.ignore = true; // don't let already loaded messages to re-load.
					}
					console.log("Social Stream ready to go");

					let target = initialTarget.isConnected ? initialTarget : document.querySelector(checkElement);
					if (!target) {
						console.warn("Social Stream: chat container missing, retrying…");
						checkReady = startChatWatcher();
						return;
					}

					onElementInsertedTwitch(target);

					if (document.querySelector('[data-a-target="consent-banner-accept"]')) {
						document.querySelector('[data-a-target="consent-banner-accept"]').click();
						if (document.querySelector(".consent-banner")) {
							document.querySelector(".consent-banner").remove();
						}
					}
				}, 3000);
			}

			if (document.querySelector('[data-a-target="consent-banner-accept"]')) {
				document.querySelector('[data-a-target="consent-banner-accept"]').click();
				if (document.querySelector(".consent-banner")) {
					document.querySelector(".consent-banner").remove();
				}
			}
		}, 500);
	}

	checkReady = startChatWatcher();
	
	function checkFollowers(){
		if (channelName && isExtensionOn && (settings.showviewercount || settings.hypemode)){
			fetch('https://api.socialstream.ninja/twitch/viewers?username='+channelName)
			  .then(response => response.text())
			  .then(count => {
				let viewerCount = 0; // Default to 0 if invalid
				try {
					if (count == parseInt(count)){
						viewerCount = parseInt(count);
					}
				} catch (e) {
					//console.log(e);
				}

				// Always send viewer update (even if 0) to clear stale counts
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					({message:{
							type: 'twitch',
							event: 'viewer_update',
							meta: viewerCount
						}
					}),
					function (e) {}
				);
				  //console.log('Viewer count:', viewerCount);
			  })
			  .catch(error => {
				// Send 0 on fetch error to clear stale counts
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					({message:{
							type: 'twitch',
							event: 'viewer_update',
							meta: 0
						}
					}),
					function (e) {}
				);
			  });
		}
		
		if (isExtensionOn && document.querySelector(".community-highlight")){
			let message = getTextWithSpaces(document.querySelector(".community-highlight"));
			
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				({message:{ 
						type: 'twitch',
						event: 'community_highlight',
						meta: message
					}
				}),
				function (e) {}
			);
		}
	}
	
	setInterval(function(){checkFollowers()},30000);
	

	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function (event) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function (e) {};
			remoteConnection.datachannel.onopen = function (e) {};
			remoteConnection.datachannel.onclose = function (e) {};
			setInterval(function () {
				remoteConnection.datachannel.send("KEEPALIVE");
			}, 1000);
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
	
	function simulateFocus(element) {
		// Create and dispatch focusin event
		const focusInEvent = new FocusEvent('focusin', {
			view: window,
			bubbles: true,
			cancelable: true
		});
		element.dispatchEvent(focusInEvent);

		// Create and dispatch focus event
		const focusEvent = new FocusEvent('focus', {
			view: window,
			bubbles: false,
			cancelable: true
		});
		element.dispatchEvent(focusEvent);
	}
	
	function preventBackgroundThrottling() {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.mozHidden = false;
		document.webkitHidden = false;
		
		document.hasFocus = () => true;
		window.onFocus = () => true;

		Object.defineProperties(document, {
			mozHidden: { value: false, configurable: true },
			msHidden: { value: false, configurable: true },
			webkitHidden: { value: false, configurable: true },
			hidden: { value: false, configurable: true, writable: true },
			visibilityState: { 
				get: () => "visible",
				configurable: true
			}
		});
	}

	const events = [
		"visibilitychange",
		"webkitvisibilitychange",
		"blur",
		"mozvisibilitychange",
		"msvisibilitychange"
	];

	events.forEach(event => {
		window.addEventListener(event, (e) => {
			e.stopImmediatePropagation();
			e.preventDefault();
		}, true);
	});

	setInterval(preventBackgroundThrottling, 200);

})();
