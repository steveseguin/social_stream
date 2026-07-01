(function () {

	var urlParams = new URLSearchParams(window.location.search);
	//var channelName = "";
	var isExtensionOn = true;
	var videoId = urlParams.get("v") || false;
	
	var debugmode = urlParams.has("debug") || false;
	try {
		if (!videoId){
			const parentUrl = window.top.location.href;
			const parentStudioMatch = parentUrl.match(/\/video\/([^\/]+)/);
			if (parentStudioMatch) {
				videoId = parentStudioMatch[1];
			}
		}
	} catch(e){}
	
	var channelName = "";
	var channelThumbnail = "";
	
	const getChannelInfo = async (videoId) => {
		const response = await fetch(`https://api.socialstream.ninja/youtube/channel_info?video=${videoId}`);
		const data = await response.json();

		if (data.error) {
		  throw new Error(data.error);
		}
		
		channelName = data.channelName,
		channelThumbnail =  data.channelThumbnail
	};
	
	if (videoId){
		setTimeout(function(videoId){getChannelInfo(videoId)},1000,videoId);
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

	function getCustomDonationThankYouText() {
		var customText = "";
		try {
			if (settings.customDonationThankYou && settings.customDonationThankYou.textsetting) {
				customText = settings.customDonationThankYou.textsetting.trim();
			}
		} catch(e){}
		return escapeHtml(customText || getTranslation("thank-you", "Thank you for your donation!"));
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

	function normalizeDonationText(text) {
		if (text === undefined || text === null) {
			return "";
		}
		return String(text).replace(/\s+/g, " ").trim();
	}

	function looksLikeDonationText(text) {
		text = normalizeDonationText(text);
		if (!text || !/\d/.test(text)) {
			return false;
		}
		if (/[\u0024\u20ac\u00a3\u00a5\u20b9\u20a9\u20aa\u20b1\u0e3f\u20ab\u20b4\u20a6\u20a1\u20b2\u20b5\u20ad\u20ae\u20b8\u20ba\u20bd\u20bc\u20be\u20bf]/.test(text)) {
			return true;
		}
		return /\b(USD|CAD|AUD|NZD|EUR|GBP|JPY|CNY|HKD|TWD|KRW|INR|BRL|MXN|ARS|CLP|COP|PEN|PHP|SGD|MYR|THB|IDR|VND|ILS|TRY|ZAR|SEK|NOK|DKK|CHF|PLN|CZK|HUF|RON|RUB|UAH)\b/i.test(text);
	}

	function getElementTextValue(element) {
		if (!element) {
			return "";
		}
		return normalizeDonationText(element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("title") || "");
	}

	function isYouTubePaidChatNode(ele) {
		return !!(ele && (ele.tagName == "YT-LIVE-CHAT-PAID-MESSAGE-RENDERER" || ele.tagName == "YT-LIVE-CHAT-PAID-STICKER-RENDERER"));
	}

	function getYouTubeDonationAmount(ele) {
		var selectors = [
			"#purchase-amount",
			"#purchase-amount-chip",
			"[id*='purchase-amount']",
			"[class*='purchase-amount']"
		];
		for (var i = 0; i < selectors.length; i++) {
			try {
				var matches = ele.querySelectorAll(selectors[i]);
				for (var j = 0; j < matches.length; j++) {
					var directText = getElementTextValue(matches[j]);
					if (directText) {
						return escapeHtml(directText);
					}
				}
			} catch (e) {}
		}
		if (!isYouTubePaidChatNode(ele)) {
			return "";
		}
		try {
			var labelled = ele.querySelectorAll("[aria-label], [title]");
			for (var k = 0; k < labelled.length; k++) {
				var labelText = getElementTextValue(labelled[k]);
				if (labelText.length <= 80 && looksLikeDonationText(labelText)) {
					return escapeHtml(labelText);
				}
			}
		} catch (e) {}
		try {
			var textNodes = ele.querySelectorAll("span, div, yt-formatted-string");
			for (var n = 0; n < textNodes.length; n++) {
				var text = getElementTextValue(textNodes[n]);
				if (text.length <= 40 && looksLikeDonationText(text)) {
					return escapeHtml(text);
				}
			}
		} catch (e) {}
		return "";
	}

	function getYouTubeJewelDonationNode(ele) {
		try {
			if (!ele || !ele.tagName) {
				return null;
			}
			if (ele.tagName == "YT-GIFT-MESSAGE-VIEW-MODEL") {
				return ele;
			}
			if (ele.querySelector) {
				return ele.querySelector("yt-gift-message-view-model");
			}
		} catch (e) {}
		return null;
	}

	function normalizeYouTubeGiftImageUrl(url) {
		url = normalizeDonationText(url);
		if (!url) {
			return "";
		}
		if (url.indexOf("//") === 0) {
			return "https:" + url;
		}
		return url;
	}

	function getYouTubeGiftElementText(ele, selector) {
		try {
			var node = ele.querySelector(selector);
			if (node) {
				return normalizeDonationText(node.innerText || node.textContent || node.getAttribute("aria-label") || node.getAttribute("title") || "");
			}
		} catch (e) {}
		return "";
	}

	function getYouTubeJewelDonationDetails(ele) {
		var giftNode = getYouTubeJewelDonationNode(ele) || ele;
		var textParts = [];
		function addText(value) {
			value = normalizeDonationText(value);
			if (value && textParts.indexOf(value) === -1) {
				textParts.push(value);
			}
		}
		function collectText(node) {
			if (!node) {
				return;
			}
			try {
				addText(node.innerText || node.textContent || "");
				addText(node.getAttribute("aria-label") || "");
				addText(node.getAttribute("title") || "");
			} catch (e) {}
			try {
				node.querySelectorAll("[aria-label], [title], img[alt]").forEach(function (labelled) {
					addText(labelled.getAttribute("aria-label") || "");
					addText(labelled.getAttribute("title") || "");
					addText(labelled.getAttribute("alt") || "");
				});
			} catch (e) {}
		}
		collectText(ele);
		if (giftNode !== ele) {
			collectText(giftNode);
		}

		var allText = normalizeDonationText(textParts.join(" "));
		var jewelMatch = allText.match(/([0-9][0-9,]*)\s*Jewels?\b/i);
		if (!jewelMatch && !getYouTubeJewelDonationNode(ele)) {
			return null;
		}

		var jewelAmount = jewelMatch ? jewelMatch[1].replace(/,/g, "") : "";
		var messageText = getYouTubeGiftElementText(giftNode, "#message-v2, #message, yt-attributed-string[id*='message']");
		var plainMessage = messageText || normalizeDonationText((giftNode && (giftNode.innerText || giftNode.textContent)) || (ele.innerText || ele.textContent) || allText);
		var authorName = "";
		try {
			var authorNode = giftNode.querySelector("#author-name-v2, #author-name, yt-attributed-string[id*='author-name']");
			if (authorNode) {
				authorName = normalizeDonationText(authorNode.innerText || authorNode.textContent || "");
				authorName = normalizeDonationText(authorName.replace(/^@/, ""));
			}
		} catch (e) {}
		if (!authorName) {
			var authorMatch = plainMessage.match(/^(.+?)\s+sent\b/i) || allText.match(/^(.+?)\s+sent\b/i);
			if (authorMatch && authorMatch[1]) {
				authorName = normalizeDonationText(authorMatch[1].replace(/^@/, ""));
			}
		}

		var giftName = "";
		if (messageText) {
			var messageGiftMatch = messageText.match(/\bsent\s+(.+?)$/i);
			if (messageGiftMatch && messageGiftMatch[1]) {
				giftName = normalizeDonationText(messageGiftMatch[1].replace(/^a\s+gift\s*:?\s*/i, ""));
			}
		}
		var giftPatterns = [
			/\bsent\s+(?:a\s+)?gift\s*:\s*(.+?)\s*(?:\(|for\s+[0-9,]+\s+Jewels?\b|$)/i,
			/\bsent\s+(.+?)\s+for\s+[0-9,]+\s+Jewels?\b/i,
			/\bsent\s+(.+?)\s*\(\s*[0-9,]+\s+Jewels?\s*\)/i,
			/\bsent\s+(.+?)$/i
		];
		if (!giftName) {
			for (var i = 0; i < giftPatterns.length; i++) {
				var giftMatch = allText.match(giftPatterns[i]);
				if (giftMatch && giftMatch[1]) {
					giftName = normalizeDonationText(giftMatch[1].replace(/^a\s+gift\s*:?\s*/i, ""));
					break;
				}
			}
		}

		var giftUrl = "";
		try {
			var giftImage = giftNode.querySelector("#gift-image img[src], yt-image#gift-image img[src], img[src*='/pdg/gift/assets/']");
			if (giftImage) {
				giftUrl = normalizeYouTubeGiftImageUrl(giftImage.getAttribute("src") || giftImage.src || "");
			}
		} catch (e) {}

		if (!plainMessage) {
			plainMessage = authorName ? authorName + " sent a gift" : getTranslation("youtube-gift-sent-message", "sent a gift");
			if (giftName) {
				plainMessage += ": " + giftName;
			}
			if (jewelAmount) {
				plainMessage += " (" + jewelAmount + " Jewels)";
			}
		}

		var metaGift = {};
		if (giftName) {
			metaGift.giftName = giftName;
		}
		if (jewelAmount) {
			metaGift.jewelsAmount = parseInt(jewelAmount, 10);
		}
		if (giftUrl) {
			metaGift.giftUrl = giftUrl;
		}

		return {
			chatname: authorName,
			chatmessage: escapeHtml(plainMessage),
			hasDonation: jewelAmount ? jewelAmount + " Jewels" : "1 YouTube Gift",
			giftName: giftName,
			jewelsAmount: jewelAmount ? parseInt(jewelAmount, 10) : "",
			giftUrl: giftUrl,
			meta: {
				youtubeGift: metaGift
			}
		};
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
	  return deletionObserver;
	}
	
	function deleteThis(ele) {
	  if (ele.deleted) return;
	  ele.deleted = true;
	  try {
		const chatname = ele.querySelector("#author-name");
		if (chatname) {
		  const data = {
			chatname: escapeHtml(chatname.innerText),
			type: (youtubeShorts ? "youtubeshorts" : "youtube")
		  };
		  ele.dataset.mid ? (data.id = parseInt(ele.dataset.mid)) || null : "";
		  chrome.runtime.sendMessage(chrome.runtime.id, { "delete": data }, function(e) {});
		}
	  } catch (e) {
		console.error("Error in deleteThis:", e);
	  }
	}

	const messageHistory = new Set();
	const avatarHistory = new Map();
	const removedJewelDonationSlots = new Set();
	const removedJewelDonationSlotOrder = [];
	const removedJewelDonationSlotLimit = 300;

	function getYouTubeJewelDonationHistoryText(ele) {
		try {
			var giftNode = getYouTubeJewelDonationNode(ele) || ele;
			var giftImage = giftNode && giftNode.querySelector ? giftNode.querySelector("#gift-image img, yt-image#gift-image img, img[alt]") : null;
			return normalizeDonationText(
				((giftNode && giftNode.textContent) || "") + " " +
				((giftNode && giftNode.getAttribute && giftNode.getAttribute("aria-label")) || "") + " " +
				((giftImage && giftImage.getAttribute("alt")) || "")
			);
		} catch (e) {}
		return "";
	}

	function getYouTubeJewelDonationNeighborText(node) {
		try {
			var giftNode = getYouTubeJewelDonationNode(node);
			if (giftNode) {
				return getYouTubeJewelDonationHistoryText(giftNode).substring(0, 120);
			}
			return normalizeDonationText(
				((node && node.textContent) || "") + " " +
				((node && node.getAttribute && node.getAttribute("aria-label")) || "")
			).substring(0, 120);
		} catch (e) {}
		return "";
	}

	function getYouTubeJewelDonationSlotKeyFromParts(textKey, previousText, nextText) {
		return "jd_slot_" + textKey.substring(0, 200) +
			"|p:" + (previousText || "") +
			"|n:" + (nextText || "");
	}

	function getYouTubeJewelDonationSlotKey(ele, previousSibling, nextSibling) {
		try {
			var slotNode = ele;
			var giftNode = getYouTubeJewelDonationNode(ele) || ele;
			var textKey = getYouTubeJewelDonationHistoryText(giftNode);
			if (!textKey) {
				return "";
			}
			if (previousSibling === undefined && nextSibling === undefined && slotNode.__ssnJewelDonationSlotKey) {
				return slotNode.__ssnJewelDonationSlotKey;
			}
			if (previousSibling === undefined && nextSibling === undefined && slotNode.__ssnJewelPreviousSiblingText !== undefined) {
				return getYouTubeJewelDonationSlotKeyFromParts(textKey, slotNode.__ssnJewelPreviousSiblingText, slotNode.__ssnJewelNextSiblingText);
			}
			var prevNode = previousSibling !== undefined ? previousSibling : slotNode.previousSibling;
			var nextNode = nextSibling !== undefined ? nextSibling : slotNode.nextSibling;
			return getYouTubeJewelDonationSlotKeyFromParts(
				textKey,
				getYouTubeJewelDonationNeighborText(prevNode),
				getYouTubeJewelDonationNeighborText(nextNode)
			);
		} catch (e) {}
		return "";
	}

	function rememberInsertedYouTubeJewelDonationSlot(ele, previousSibling, nextSibling) {
		try {
			var giftNode = getYouTubeJewelDonationNode(ele);
			if (!giftNode) {
				return;
			}
			ele.__ssnJewelPreviousSiblingText = getYouTubeJewelDonationNeighborText(previousSibling);
			ele.__ssnJewelNextSiblingText = getYouTubeJewelDonationNeighborText(nextSibling);
			var historyKey = getYouTubeJewelDonationSlotKey(ele, previousSibling, nextSibling);
			if (historyKey) {
				ele.__ssnJewelDonationSlotKey = historyKey;
			}
		} catch (e) {}
	}

	function isYouTubeJewelDonationProcessed(ele) {
		try {
			var giftNode = getYouTubeJewelDonationNode(ele) || ele;
			if (ele && (ele.skip || (ele.dataset && ele.dataset.mid))) {
				return true;
			}
			if (giftNode && (giftNode.skip || (giftNode.dataset && giftNode.dataset.mid))) {
				return true;
			}
		} catch (e) {}
		return false;
	}

	function rememberRemovedYouTubeJewelDonationSlot(ele, previousSibling, nextSibling) {
		try {
			var giftNode = getYouTubeJewelDonationNode(ele);
			if (!giftNode || !isYouTubeJewelDonationProcessed(ele)) {
				return;
			}
			var historyKey = getYouTubeJewelDonationSlotKey(ele, previousSibling, nextSibling);
			if (!historyKey || removedJewelDonationSlots.has(historyKey)) {
				return;
			}
			removedJewelDonationSlots.add(historyKey);
			removedJewelDonationSlotOrder.push(historyKey);
			while (removedJewelDonationSlotOrder.length > removedJewelDonationSlotLimit) {
				removedJewelDonationSlots.delete(removedJewelDonationSlotOrder.shift());
			}
		} catch (e) {}
	}

	function isKnownRemovedYouTubeJewelDonationSlot(ele) {
		var historyKey = getYouTubeJewelDonationSlotKey(ele);
		if (!historyKey) {
			return false;
		}
		return removedJewelDonationSlots.has(historyKey);
	}

	function retryYouTubeMessageWhenReady(ele, eventType) {
		try {
			if (!ele || !ele.isConnected) {
				return false;
			}
			var retryCount = parseInt(ele.dataset.ssnRetryCount || "0", 10) || 0;
			if (retryCount >= 4) {
				return false;
			}
			ele.dataset.ssnRetryCount = String(retryCount + 1);
			ele.skip = false;
			if (ele.id) {
				messageHistory.delete(ele.id);
			}
			setTimeout(function () {
				processMessage(ele, eventType);
			}, Math.max(captureDelay || 200, 500));
			return true;
		} catch (e) {
			return false;
		}
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
	
	const policy = (() => {
		if (!window.trustedTypes || typeof window.trustedTypes.createPolicy !== "function") {
			return null;
		}
		try {
			return window.trustedTypes.createPolicy("socialstream-youtube", {
				createHTML: (string) => string
			});
		} catch (error) {
			try {
				return typeof window.trustedTypes.getPolicy === "function"
					? window.trustedTypes.getPolicy("socialstream-youtube")
					: null;
			} catch (_) {}
		}
		return null;
	})();

	function toTrustedHTML(html) {
		const normalized = (typeof html === "string") ? html : ((html === undefined || html === null) ? "" : String(html));
		if (policy && typeof policy.createHTML === "function") {
			try {
				return policy.createHTML(normalized);
			} catch (e) {}
		}
		return normalized;
	}

	function setSafeHTML(element, html) {
		if (!element) {
			return false;
		}
		try {
			element.innerHTML = toTrustedHTML(html);
			return true;
		} catch (error) {}
		if (!html) {
			try {
				element.replaceChildren();
				return true;
			} catch (err) {}
		}
		return false;
	}

	function parseSafeHTMLDocument(html) {
		try {
			const parser = new DOMParser();
			return parser.parseFromString(toTrustedHTML(html), "text/html");
		} catch (error) {}
		try {
			const doc = document.implementation.createHTMLDocument("");
			if (doc && doc.body && setSafeHTML(doc.body, html)) {
				return doc;
			}
		} catch (err) {}
		return null;
	}

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
				if (!setSafeHTML(tempDiv, processedText)) {
					tempDiv.textContent = processedText;
				}
				
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
				} else if (!settings.textonlymode && node.href && (node.nodeName === "A")) {
					
					if (pendingSpace){
						result += pendingSpace;
						pendingSpace = null;
					} 
					pendingSpace = " <a href='"+node.href+"' target='_blank'>"+escapeHtml(node.textContent)+"</a> ";
					
				} else if (node.nodeName.toLowerCase() === "svg" && node.classList.contains("seventv-chat-emote")) {
					if (settings.textonlymode){
						return;
					}
					const resolvedSvg = cloneSvgWithResolvedUse(node);
					resolvedSvg.style = "";
					result += resolvedSvg.outerHTML;
				} else if (node.childNodes.length) {
					Array.from(node.childNodes).forEach(processNode);
				} else if (!settings.textonlymode && (node.nodeName.toLowerCase() === "svg")){
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

		processNode(element);

		if (pendingRegularEmote) {
			result += pendingRegularEmote;
		}
		if (pendingSpace){
			result += pendingSpace;
		}

		return result;
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

	function stripHtmlContent(html) {
		if (!html) {
			return "";
		}
		try {
			const doc = parseSafeHTMLDocument(html);
			if (doc && doc.body) {
				doc.body.querySelectorAll("img").forEach((img) => {
					const altText = img.getAttribute("alt") || img.getAttribute("title") || "";
					const textNode = doc.createTextNode(altText);
					img.replaceWith(textNode);
				});
				const text = doc.body.textContent || "";
				return text.replace(/\s+/g, " ").trim();
			}
		} catch (e) {}
		try {
			const tempDiv = document.createElement("div");
			if (!setSafeHTML(tempDiv, html)) {
				return typeof html === "string"
					? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
					: "";
			}
			const text = tempDiv.textContent || tempDiv.innerText || "";
			return text.replace(/\s+/g, " ").trim();
		} catch (err) {}
		return typeof html === "string" ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
	}

	function extractReplyDetails(ele, currentPlainMessage = "") {
		if (!ele) {
			return null;
		}

		const normalizedCurrent = typeof currentPlainMessage === "string"
			? currentPlainMessage.trim().toLowerCase()
			: "";

		const selectors = [
			'yt-live-chat-text-message-renderer #reply-message',
			'#reply-message',
			'yt-live-chat-text-message-reply-renderer',
			'yt-live-chat-text-message-reply-view-model',
			'.yt-live-chat-text-message-reply-view-model',
			'.yt-live-chat-text-message-renderer-reply',
			'[id*="reply-view-model"]',
			'[id*="reply-message"]',
			'[data-reply-message]'
		];

		for (const selector of selectors) {
			let node = null;
			try {
				node = ele.querySelector(selector);
			} catch (error) {
				node = null;
			}
			if (!node) {
				continue;
			}
			let html = "";
			try {
				html = getAllContentNodes(node);
			} catch (e) {
				html = node.textContent || "";
			}
			const text = stripHtmlContent(html);
			const label = (text || html || "").replace(/\s+/g, " ").trim();
			if (!label || label.toLowerCase() === "reply") {
				continue;
			}
			if (normalizedCurrent && label.toLowerCase() === normalizedCurrent) {
				continue;
			}
			return {
				label,
				text: text || label
			};
		}

		const dataset = ele.dataset || {};
		for (const key in dataset) {
			if (!Object.prototype.hasOwnProperty.call(dataset, key)) {
				continue;
			}
			if (!key.toLowerCase().includes("reply")) {
				continue;
			}
			const rawValue = (dataset[key] || "").toString();
			const normalizedValue = rawValue.replace(/\s+/g, " ").trim();
			if (!normalizedValue || normalizedValue.toLowerCase() === "reply") {
				continue;
			}
			if (normalizedCurrent && normalizedValue.toLowerCase() === normalizedCurrent) {
				continue;
			}
			return {
				label: normalizedValue,
				text: normalizedValue
			};
		}

		try {
			const ariaLabel = ele.getAttribute("aria-label") || "";
			const match = ariaLabel.match(/Replying to\s+([^:]+)(?::\s*(.*))?/i);
			if (match && match[1]) {
				const target = match[1].trim();
				const remainder = match[2] ? match[2].trim() : "";
				if (normalizedCurrent && remainder && remainder.toLowerCase() === normalizedCurrent) {
					return {
						label: `${getTranslation("replying-to", "Replying to")} ${target}`,
						text: remainder
					};
				}
				const parts = [];
				if (target) {
					parts.push(target);
				}
				if (remainder) {
					parts.push(remainder);
				}
				const label = parts.join(": ").replace(/\s+/g, " ").trim();
				if (!label || label.toLowerCase() === "reply") {
					return null;
				}
				return {
					label,
					text: remainder ? remainder.replace(/\s+/g, " ").trim() : label
				};
			}
		} catch (e) {}

		return null;
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
				} catch (e) {console.warn(e);}
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

	async function processMessage(ele, eventType=false) {
		if (!ele || !ele.isConnected){
			return 1;
		}
		if (ele.hasAttribute("is-deleted")) {
			deleteThis(ele)
			return 2;
		}
		if (settings.customyoutubestate) {
			return 3;
		}
		try {
			if (ele.skip) {
				return 4;
			} else if (ele.id) {
				if (messageHistory.has(ele.id)) return 5;
				messageHistory.add(ele.id);
				if (messageHistory.size > 300) { // 250 seems to be Youtube's max?
				    const iterator = messageHistory.values();
				    messageHistory.delete(iterator.next().value);	  
				}
				if (ele.id.length<40){
					setTimeout(()=>{
						if (ele.id.length<40){
							setTimeout(()=>{
								if (ele.id.length<40){
									setTimeout(()=>{
										messageHistory.add(ele.id);
									},2000);
								} else {
									messageHistory.add(ele.id);
								}
							},2000);
						} else {
							messageHistory.add(ele.id);
						}
					},2000);
				}
				//console.log(messageHistory);
			} else if (eventType == "jeweldonation"){
				if (isKnownRemovedYouTubeJewelDonationSlot(ele)) return 5;
		    } else {
				return 6; // no id.
		    }
			if (ele.querySelector("[in-banner]")) {
				//console.log("Message in-banner");
				return 7;
			}
		} catch (e) {}

		ele.skip = true;

		//console.log(ele);

		// Handle YouTube Redirects (similar to Twitch Raids)
		if (eventType === "redirect") {
			try {
				var bannerText = ele.querySelector("#banner-text");
				if (bannerText) {
					var redirector = bannerText.querySelector(".bold");
					var redirectorName = "";
					if (redirector) {
						redirectorName = escapeHtml(redirector.innerText.replace("@", "").trim());
					}
					var redirectMessage = getAllContentNodes(bannerText);

					if (redirectorName || redirectMessage) {
						var data = {};
						data.chatname = redirectorName;
						data.chatmessage = redirectMessage;
						data.membership = getTranslation("redirect", "REDIRECT");
						data.type = "youtube";
						data.event = "redirect";
						if (videoId) {
							data.videoid = videoId;
						}
						if (channelName) {
							data.sourceName = channelName;
						}
						if (channelThumbnail) {
							data.sourceImg = channelThumbnail;
						}

						chrome.runtime.sendMessage(
							chrome.runtime.id,
							{ message: data },
							(e) => {
								e.id ? (ele.dataset.mid = e.id) : "";
							}
						);
					}
				}
			} catch (e) {
				console.error("Error processing redirect:", e);
			}
			return;
		}

		var hasMembership = "";
		var subtitle = "";

		var chatmessage = "";
		var chatname = "";
		var chatimg = "";
		var nameColor = "";
		var member = false;
		var mod = false;
		
		
		var donoValue = "";

		var srcImg = ""; // what shows up as the source image; blank is default (dock decides).
		
		try {
			var nameElement = ele.querySelector("#author-name");
			chatname = escapeHtml(nameElement.innerText);
			if (!chatname){
				retryYouTubeMessageWhenReady(ele, eventType);
				return 8;
			}
			
			ele.querySelectorAll('yt-live-chat-author-badge-renderer[type]').forEach(type=>{
				if (type.getAttribute("type")=="mod"){
					mod=true;
				} else if (type.getAttribute("type")=="member"){
					member=true;
				}
			});

			if (!settings.nosubcolor) {
				if (mod || nameElement.classList.contains("moderator")) {
					nameColor = "#5e84f1";
					mod = true;
				} else if (member || nameElement.classList.contains("member")) {
					nameColor = "#107516";
					member = true;
					
					subtitle = nameElement.getAttribute("aria-label") || "";
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

		var jewelDonation = false;
		if (eventType === "jeweldonation") {
			try {
				jewelDonation = getYouTubeJewelDonationDetails(ele);
				if (jewelDonation) {
					if (!chatname && jewelDonation.chatname) {
						chatname = escapeHtml(jewelDonation.chatname);
					}
					if (!chatmessage && jewelDonation.chatmessage) {
						chatmessage = jewelDonation.chatmessage;
					}
					if (!subtitle && jewelDonation.giftName) {
						subtitle = escapeHtml(jewelDonation.giftName);
					}
				}
			} catch (e) {
				console.error("Error processing jewel donation:", e);
			}
		}


		
		// https://yt3.ggpht.com/y0njK_GOHV6k7ZlW4qQbVxTt3z3Hs1eXBi2LeYJ-7hFT7KWXXKvcsl0FhYMWsHJh2VEoQvZrsko=w48-h48-c-k-nd

		try {
			chatimg = ele.querySelector("#img[src], #author-photo img[src]").src;
			if (chatimg.startsWith("data:image/gif;base64")) { 
				await delay(500);//console.log(ele);
				chatimg = document.querySelector("#"+ele.id+" #author-photo img[src]:not([src^='data:image/gif;base64'])") || "";
				if (chatimg){
					chatimg = chatimg.src;
				}
			}
		} catch (e) {
			//console.log(e);
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
			chatdonation = getYouTubeDonationAmount(ele);
		} catch (e) {}

		var chatmembership = "";
		try {
			chatmembership = ele.querySelector(".yt-live-chat-membership-item-renderer #header-subtext").innerHTML;
			member = true;
		} catch (e) {}
		
		
/* 		var treatAsMemberChat = false;
		if (settings.allmemberchat && member) {
			treatAsMemberChat = true;
		} else if (chatmembership) {
			treatAsMemberChat = true;
		} */
		
		var treatAsMemberChat = false;
		
		if (settings.limitedyoutubememberchat && member){
			if (chatmembership) {
				treatAsMemberChat = true;
			}
		} else if (member) {
			treatAsMemberChat = true;
		} else if (chatmembership) {
			treatAsMemberChat = true;
		}
		
		var chatsticker = "";
		try {
			chatsticker = ele.querySelector(".yt-live-chat-paid-sticker-renderer #sticker>#img[src]").src;
		} catch (e) {}

		if (chatsticker) {
			try {
				chatdonation = chatdonation || getYouTubeDonationAmount(ele);
			} catch (e) {}
		}

		var isPaidChatNode = isYouTubePaidChatNode(ele);
		if (isPaidChatNode && !chatdonation) {
			if (retryYouTubeMessageWhenReady(ele, eventType)) {
				return 11;
			}
			chatdonation = getTranslation("donation", "DONATION");
		}

		var chatbadges = [];  
		try {
			ele.querySelectorAll(".yt-live-chat-author-badge-renderer img, .yt-live-chat-author-badge-renderer svg").forEach(img => {
				if (img.tagName.toLowerCase() == "img") {
					var html = {};
					
					let badgesrc = img.src.trim();
					badgesrc = badgesrc.replaceAll("=w16-h16-", "=w48-h48-"); // increases the resolution of emojis
					badgesrc = badgesrc.replaceAll("=w24-h24-", "=w64-h64-");
					badgesrc = badgesrc.replaceAll("=s16-", "=s48-");
					badgesrc = badgesrc.replaceAll("=s24-", "=s48-");
					
					html.src = badgesrc;
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
			
			ele.querySelectorAll(".yt-spec-button-shape-next--icon-leading[aria-label]").forEach(img => {
			try {
				if (img.ariaLabel.startsWith("Like")){return;}
				if (img.ariaLabel.startsWith("Reply")){return;}
				var html = {};
				html.html = `
					<svg xmlns="http://www.w3.org/2000/svg" width="28" height="16" viewBox="0 0 28 16" fill="rgb(54, 0, 140)" stroke="rgb(255,255,255)" focusable="false" aria-hidden="true" style="width: 100%; height: 100%; background-color:rgb(54, 0, 140); border-radius:3px; margin:0 2px;">
					  <g fill="rgb(54, 0, 140)" stroke="rgb(255, 255, 255)">
						<path clip-rule="evenodd" d="M4.5 6 8 2l3.5 4L15 3.5V14H1V3.5L4.5 6ZM2 12v1h12v-1H2Zm12-1H2V5.443L4.656 7.34 8 3.52l3.344 3.821L14 5.443V11Z" fill-rule="evenodd"></path>
					  </g>
					  <text x="17" y="12" font-family="Arial, sans-serif" font-size="10" font-weight="lighter" fill="rgb(255,255,255)">${img.ariaLabel}</text>
					</svg>
				`;
				html.type = "svg";
				chatbadges.push(html);
			} catch(e) {
				// Handle error
			}
		});
			
		} catch (e) {}

		var hasDonation = "";
		if (chatdonation) {
			hasDonation = chatdonation;
		}
		if (jewelDonation && jewelDonation.hasDonation) {
			hasDonation = jewelDonation.hasDonation;
		}


		var giftedmemembership = ele.querySelector("#primary-text.ytd-sponsorships-live-chat-header-renderer");

		if (treatAsMemberChat) {
			if (chatmessage) {
				//if (mod) {
				//	hasMembership = chatmembership || getTranslation("moderator-chat", "MODERATOR");
				//} else {
				hasMembership = chatmembership || getTranslation("member-chat", "MEMBERSHIP");
				//}
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
			  
			} else if (eventType === "giftpurchase") {
			  try {
				var giftedBy = ele.querySelector("#primary-text");
				if (giftedBy) {
				  var giftCount = findSingleInteger(giftedBy.innerText) || 1;
				  chatmessage = giftedBy.innerText.trim();
				  hasDonation = giftCount + " " + getTranslation("gifted-memberships", "Gifted");
				  donoValue = 5 * giftCount; // Assuming $5 per membership
				  hasMembership = getTranslation("sponsorship", "SPONSORSHIP");
				  eventType = "giftpurchase";
				}
			  } catch (e) {
				console.error("Error processing gift purchase:", e);
			  }
			} else if (eventType === "giftredemption") {
			  try {
				var messageElement = ele.querySelector("#message");
				if (messageElement) {
				  chatmessage = messageElement.innerText.trim();
				  eventType = "giftredemption";
				  var gifterElement = messageElement.querySelector(".bold.italic");
				  if (gifterElement) {
					subtitle = getTranslation("gifted-by", "Gifted by") + " " + gifterElement.innerText;
				  }
				  hasMembership = getTranslation("membership", "MEMBERSHIP");
				}
			  } catch (e) {
				console.error("Error processing gift redemption:", e);
			  }
			} else {
				// Consolidated handler for new members, renewals, and upgrades.
				try {
					const headerSubtext = ele.querySelector("#header-subtext");
					const headerText = ele.querySelector("#header-primary-text");
					
					// Check if this is specifically a new member welcome (has subtext but no message content)
					const hasEmptyMessage = !ele.querySelector("#message")?.textContent?.trim();
					const isNewMemberStructure = headerSubtext && hasEmptyMessage && 
					                            ele.hasAttribute("show-only-header") && 
					                            ele.hasAttribute("modern");

					if (headerSubtext) {
						const subtextContent = getAllContentNodes(headerSubtext);

						if (subtextContent.toLowerCase().includes("upgraded")) {
							chatmessage = subtextContent;
							hasMembership = getTranslation("member-chat", "MEMBERSHIP");
							eventType = "resub";
							const tierMatch = subtextContent.match(/to\s+(.+?)(?:\s*!)?$/i);
							if (tierMatch && tierMatch[1]) {
								subtitle = tierMatch[1].trim();
							}
						} else if (subtextContent.toLowerCase().includes("welcome to") || subtextContent.toLowerCase().includes("willkommen bei")) {
							chatmessage = subtextContent;
							hasMembership = getTranslation("member-chat", "MEMBERSHIP");
							eventType = "sponsorship";
							// Updated regex to handle both English and German patterns
							const tierMatch = subtextContent.match(/(?:welcome to|willkommen bei)\s+(.+?)(?:\s*!)?$/i);
							if (tierMatch && tierMatch[1]) {
								subtitle = tierMatch[1].trim();
							}
						} else if (isNewMemberStructure && subtextContent) {
							// Structure-based detection for new members in any language
							// Only triggers for membership items with the specific structure
							chatmessage = subtextContent;
							hasMembership = getTranslation("member-chat", "MEMBERSHIP");
							eventType = "sponsorship";
							// Try to extract channel/tier name - look for text after common prepositions
							const tierMatch = subtextContent.match(/(?:to|bei|à|a|para|для|へ|に|에|у|na|في|में)\s+(.+?)(?:\s*[!.。！])?$/i);
							if (tierMatch && tierMatch[1]) {
								subtitle = tierMatch[1].trim();
							}
						} else if (headerText) {
							chatmessage = getAllContentNodes(headerText);
							hasMembership = getTranslation("member-chat", "MEMBERSHIP");
							const monthMatch = chatmessage.match(/(\d+)\s+month/);
							if (monthMatch && monthMatch[1]) {
								const months = parseInt(monthMatch[1]);
								subtitle = months === 1 ? `${months} ${getTranslation("month", "month")}` : `${months} ${getTranslation("months", "months")}`;
							}
							if (subtextContent) {
								subtitle = (subtitle ? subtitle + " - " : "") + subtextContent;
							}
						}
					} else if (headerText) {
						chatmessage = getAllContentNodes(headerText);
						hasMembership = getTranslation("member-chat", "MEMBERSHIP");
						const monthMatch = chatmessage.match(/(\d+)\s+month/);
						if (monthMatch && monthMatch[1]) {
							const months = parseInt(monthMatch[1]);
							subtitle = months === 1 ? `${months} ${getTranslation("month", "month")}` : `${months} ${getTranslation("months", "months")}`;
						}
					}
				} catch (e) {
					console.error("Error processing membership item:", e);
				}
			}

			if (!hasMembership) {
				if (member) {
					hasMembership = getTranslation("member-chat", "MEMBERSHIP");
				} //else if (mod) {
				//	hasMembership = getTranslation("moderator-chat", "MODERATOR");
				//}
			}
		} else if (!chatmessage && giftedmemembership) {
			eventType = "sponsorship";
			chatmessage = getAllContentNodes(giftedmemembership);
			hasMembership = getTranslation("sponsorship", "SPONSORSHIP");
		} else if (!chatmessage && chatmembership) {
			chatmessage = chatmembership;
		} else if (eventType === "jeweldonation") {
			try {
				jewelDonation = jewelDonation || getYouTubeJewelDonationDetails(ele);
				if (jewelDonation) {
				  hasDonation = jewelDonation.hasDonation;
				  if (!chatmessage) {
					chatmessage = jewelDonation.chatmessage;
				  }
				  if (!chatname && jewelDonation.chatname) {
					chatname = escapeHtml(jewelDonation.chatname);
				  }
				  if (!subtitle && jewelDonation.giftName) {
					subtitle = escapeHtml(jewelDonation.giftName);
				  }
				  if (chatmessage && !settings.textonlymode){
					chatmessage += ' <svg xmlns="http://www.w3.org/2000/svg" style="fill: red;" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M19.28 3.61c-.96-.81-2.51-.81-3.47 0-.68.58-1.47 2.66-1.81 3.64-.34-.98-1.13-3.06-1.81-3.64-.96-.81-2.51-.81-3.47 0-.96.81-.96 2.13 0 2.94.62.53 2.7 1.12 3.94 1.45H5v13h14V8h-3.66c1.24-.32 3.32-.92 3.94-1.45.96-.81.96-2.13 0-2.94zM6 9h8v6H6V9zm0 11v-4h8v4H6zm12 0h-3v-4h3v4zm0-11v6h-3V9h3zM9.43 5.89c-.58-.43-.58-1.13 0-1.57.29-.21.67-.32 1.05-.32s.76.11 1.04.32c.39.29 1.02 1.57 1.48 2.68-1.48-.35-3.18-.82-3.57-1.11zm9.14 0c-.39.29-2.09.76-3.57 1.11.46-1.11 1.09-2.39 1.48-2.68.29-.21.67-.32 1.04-.32.38 0 .76.11 1.04.32.58.44.58 1.14.01 1.57z"></path></svg>';
				  }
				}
			} catch (e) {
			  console.error("Error processing jewel donation:", e);
			}
		}
		
		
		if (settings.memberchatonly && !hasMembership){
			return 9;
		}

		if (giftedmemembership && !hasDonation) {
			try {
				const match = giftedmemembership.innerText.match(/\b\d+\b/);
				hasDonation = match ? parseInt(match[0], 10) : null;
				if (hasDonation) {
					donoValue = 5*hasDonation;
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
			let donat = ele.querySelector("#text.yt-live-chat-donation-announcement-renderer");
			if (donat){
				chatmessage = getAllContentNodes(donat).trim();
				eventType = "donation";
				if (chatmessage.split(" donated ").length>=2){
					hasDonation = chatmessage.split(" donated ").pop().trim();
				}
			}
			
			if (!chatmessage){
				retryYouTubeMessageWhenReady(ele, eventType);
				return 10;
			}
		}
		
		chatmessage = chatmessage.trim();
		chatmessage = chatmessage.replaceAll("=w16-h16-", "=w48-h48-"); // increases the resolution of emojis
		chatmessage = chatmessage.replaceAll("=w24-h24-", "=w64-h64-");
		chatmessage = chatmessage.replaceAll("=s16-", "=s48-");
		chatmessage = chatmessage.replaceAll("=s24-", "=s48-");
		
		if (isHTMLElement(chatmessage)){
			//console.error(chatmessage);
			chatmessage = escapeHtml(chatmessage.textContent.trim());
		} else if (isObject(chatmessage)){
			//console.error(chatmessage);
			chatmessage = "";
		}

		var originalMessage = "";
		var replyLabel = "";
		if (!settings.excludeReplyingTo && chatmessage) {
			const baseMessagePlain = stripHtmlContent(chatmessage);
			const replyInfo = extractReplyDetails(ele, baseMessagePlain);
			if (replyInfo && replyInfo.label) {
				replyLabel = replyInfo.label;
				originalMessage = chatmessage;
				const replyPlainText = replyInfo.text || replyLabel;
				if (settings.textonlymode) {
					const prefix = replyLabel ? `${replyLabel}: ` : "";
					const combined = `${prefix}${baseMessagePlain}`.trim();
					chatmessage = combined || baseMessagePlain || replyPlainText || replyLabel || chatmessage;
				} else {
					const safeReply = escapeHtml(replyLabel);
					chatmessage = "<i><small>" + safeReply + ":&nbsp;</small></i> " + chatmessage;
				}
			}
		}
		
		if (!chatname && chatmessage.startsWith("Subscribers-only mode.")){
			return;
		}
		
		if (!chatname && !chatimg && !eventType && !hasDonation && !donoValue && !hasMembership){
			return;
		}
		
		var data = {};
		data.chatname = chatname;
		data.nameColor = nameColor;
		data.chatbadges = chatbadges;
		data.backgroundColor = backgroundColor;
		data.textColor = textColor;
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		if (replyLabel) {
			data.initial = replyLabel;
		}
		if (originalMessage) {
			data.reply = originalMessage;
		}
		data.hasDonation = hasDonation;
		if (donoValue){
			data.donoValue = donoValue;
		}
		data.membership = hasMembership;
		if (mod){
			data.mod = mod;
		}
		if (member){
			data.member = member;
		}
		data.subtitle = subtitle;
		if (videoId){
			data.videoid = videoId;
		}
		data.textonly = settings.textonlymode || false;
		data.type = "youtube"; 
		if (jewelDonation && jewelDonation.giftUrl) {
			data.contentimg = jewelDonation.giftUrl;
		}
		if (jewelDonation && jewelDonation.meta) {
			data.meta = Object.assign({}, data.meta, jewelDonation.meta);
		}
		if (ele.id) {
			data.meta = Object.assign({}, data.meta, { messageId: ele.id });
		}
		
		if (channelName){
			data.sourceName = channelName;
		}
		if (channelThumbnail){
			data.sourceImg = channelThumbnail;
		}
		
		if (youtubeShorts){
			data.type = "youtubeshorts";
		}
		
		//console.log(data);
		
		if (data.hasDonation){
			data.title = getTranslation("donation", "DONATION");
			if (!data.chatmessage){
				data.chatmessage = getCustomDonationThankYouText();
				if (!eventType){
					eventType = "thankyou";
				}
			}
		}
		
		if (eventType && eventType !== "jeweldonation") {
			data.event = eventType;
		}
		
		//if (eventType){
			//console.log(data);
		//}

		try {
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				{
					message: data
				},
				(e)=> {
					//console.log(e);
					e.id ? (ele.dataset.mid = e.id) : "";
				}
			);
		} catch (e) {}
	}
	var settings = {};
	var youtubeSettingsLoaded = false;
	var BTTV = false;
	var videosMuted = false;
	var SEVENTV = false;
	var FFZ = false;
	
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
			if ("getSource" == request){sendResponse("youtube");	return;	}
			if ("focusChat" == request) {
				const editableInput = document.querySelector('yt-live-chat-text-input-field-renderer div#input[contenteditable]');
				if (editableInput) {
					editableInput.focus();
					simulateFocus(editableInput);
					if ((editableInput.textContent && editableInput.textContent.length) || editableInput.childNodes.length) {
						editableInput.textContent = "";
						try {
							editableInput.replaceChildren();
						} catch (e) {}
						try {
							const inputEvent = new InputEvent("input", { bubbles: true, cancelable: true });
							editableInput.dispatchEvent(inputEvent);
						} catch (e) {}
					}
					sendResponse(true);
					return;
				}
				const fallbackInput = document.querySelector("div#input");
				if (fallbackInput) {
					fallbackInput.focus();
					simulateFocus(fallbackInput);
				}
				sendResponse(true);
				return;
			}
			if (typeof request === "object") {
				
				if ("state" in request) {
					isExtensionOn = request.state;
				}
				
				if ("settings" in request) {
					settings = request.settings;
					youtubeSettingsLoaded = true;
					sendResponse(true);
					if (settings.bttv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true }, function (response) {});
					}
					if (settings.seventv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true }, function (response) {});
					}
					if (settings.ffz) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true }, function (response) {});
					}
					if (settings.delayyoutube){
						captureDelay = 3200;
						//console.log(captureDelay);
					} else {
						captureDelay = 200;
						//console.log(captureDelay);
					}
					// Apply or remove larger font when settings change
					if (settings.youtubeLargerFont) {
						applyLargerFont();
					} else {
						removeLargerFont();
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
		
		if (!response){return;}
		
		if ("state" in response){
			isExtensionOn = response.state;
		}
		
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response) {
			settings = response.settings;
			youtubeSettingsLoaded = true;

			if (settings.bttv && !BTTV) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true }, function (response) {
					//	console.log(response);
				});
			}
			if (settings.seventv && !SEVENTV) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true }, function (response) {
					//	console.log(response);
				});
			}
			if (settings.ffz && !FFZ) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true }, function (response) {
					//	console.log(response);
				});
			}

			if (settings.delayyoutube){
				captureDelay = 2000;
				//console.log(captureDelay);
			} else {
				captureDelay = 200;
				//console.log(captureDelay);
			}

			// Apply larger font if enabled on startup
			if (settings.youtubeLargerFont) {
				applyLargerFont();
			}
		}
	});
	
	function checkType(ele, callback) {
	  // Handle redirect banners (YouTube Raids) specifically before skipping other banners
	  if (ele.tagName == "yt-live-chat-banner-redirect-renderer".toUpperCase()) {
		callback(ele, "redirect");
		return;
	  }
	  if (getYouTubeJewelDonationNode(ele)) {
		callback(ele, "jeweldonation");
		return;
	  }
	  if (ele && ele.classList && ele.classList.contains("yt-live-chat-banner-renderer")) {
		return;
	  } else if (ele.tagName == "yt-live-chat-text-message-renderer".toUpperCase()) {
		callback(ele);
	  } else if (ele.tagName == "yt-live-chat-paid-message-renderer".toUpperCase()) {
		callback(ele);
	  } else if (ele.tagName == "yt-live-chat-membership-item-renderer".toUpperCase()) {
		if (ele.hasAttribute("show-only-header") && ele.hasAttribute("modern")) {
		  callback(ele, "membershiprenewal");
		} else {
		  callback(ele);
		}
	  } else if (ele.tagName == "yt-live-chat-paid-sticker-renderer".toUpperCase()) {
		callback(ele);
	  } else if (ele.tagName == "ytd-sponsorships-live-chat-gift-redemption-announcement-renderer".toUpperCase()) {
		callback(ele, "giftredemption");
	  } else if (ele.tagName == "ytd-sponsorships-live-chat-gift-purchase-announcement-renderer".toUpperCase()) {
		callback(ele, "giftpurchase");
	  } else if (ele.tagName == "yt-gift-message-view-model".toUpperCase()) {
		callback(ele, "jeweldonation");
	  } else if (ele.tagName.startsWith("ytd-sponsorship") || ele.tagName.startsWith("yt-live-chat")) {
		callback(ele);
	  } else if (ele.tagName && (ele.tagName.startsWith("YTD-SPONSORSHIP") || ele.tagName.startsWith("YT-LIVE-CHAT"))) {
		callback(ele);
	  } else if (ele.tagName == "ytd-sponsorships-live-chat-header-renderer".toUpperCase()) {
		callback(ele, "sponsorship");
	  }
	}

	function onElementInserted(target, callback) {
	  //console.log(target);
	  var onMutationsObserved = function (mutations) {
		mutations.forEach(function (mutation) {
		  //console.log(mutation.addedNodes);
		  if (mutation.removedNodes.length) {
			for (var j = 0, jlen = mutation.removedNodes.length; j < jlen; j++) {
			  try {
				var previousRemovedSibling = j > 0 ? mutation.removedNodes[j - 1] : mutation.previousSibling;
				var nextRemovedSibling = (j + 1) < jlen ? mutation.removedNodes[j + 1] : mutation.nextSibling;
				rememberRemovedYouTubeJewelDonationSlot(mutation.removedNodes[j], previousRemovedSibling, nextRemovedSibling);
			  } catch (e) {}
			}
		  }
		  if (mutation.addedNodes.length) {
			for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
			  try {
				var previousAddedSibling = i > 0 ? mutation.addedNodes[i - 1] : mutation.previousSibling;
				var nextAddedSibling = (i + 1) < len ? mutation.addedNodes[i + 1] : mutation.nextSibling;
				rememberInsertedYouTubeJewelDonationSlot(mutation.addedNodes[i], previousAddedSibling, nextAddedSibling);
				checkType(mutation.addedNodes[i], callback);
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
	  return observer;
	}

	console.log("Social stream inserted");
	var marked = false;
	var largerFontApplied = false;
	var youtubeChatObserver = null;
	var youtubeDeletionObserver = null;
	var youtubeChatStructureObserver = null;
	var youtubeObservedItems = null;
	var youtubeObservedItemsHost = null;
	var youtubeChatHadMessages = false;
	var youtubeEmptySince = 0;
	var youtubeLastObserverRefreshAt = 0;
	var youtubeObserverRefreshCooldownMs = 4000;
	var youtubeLastAutoScrollAt = 0;
	var youtubeAutoScrollCooldownMs = 250;
	var youtubeAutoScrollDelayMs = 3000;
	var youtubeAutoScrollTimer = null;
	var youtubeAutoScrollOffBottomSince = 0;
	var youtubeLastChatActivityAt = Date.now();
	var youtubeLiveChatActivityCount = 0;
	var youtubeRecentChatActivityTimes = [];
	var youtubeLastResourceCount = 0;
	var youtubeResourceActivitySampled = false;
	var youtubeLastResourceActivityAt = Date.now();
	var youtubeStaleReloadMinMs = 60 * 1000;
	var youtubeStaleReloadMaxMs = 5 * 60 * 1000;
	var youtubeStaleReloadActivityWindowMs = 5 * 60 * 1000;
	var youtubeStaleReloadResourceGraceMs = 90 * 1000;
	var youtubeStaleReloadMinMessages = 3;
	var youtubeStaleReloadStorageKey = "ssn_youtube_stale_reload_times";
	var youtubeStaleReloadWindowMs = 60 * 60 * 1000;
	var youtubeStaleReloadMaxPerWindow = 60;

	try {
		if (performance && performance.setResourceTimingBufferSize) {
			performance.setResourceTimingBufferSize(10000);
		}
	} catch (e) {}

	function applyLargerFont() {
		if (!largerFontApplied) {
			var style = document.createElement("style");
			style.id = "youtube-larger-font-style";
			style.textContent = `
				yt-live-chat-text-message-renderer {
					font-size: 24px !important;
				}
			`;
			document.head.appendChild(style);
			largerFontApplied = true;
		}
	}

	function removeLargerFont() {
		if (largerFontApplied) {
			var styleElement = document.getElementById("youtube-larger-font-style");
			if (styleElement) {
				styleElement.remove();
			}
			largerFontApplied = false;
		}
	}

	function getYouTubeChatItemsElement() {
		let ele = document.querySelector("yt-live-chat-app #items.yt-live-chat-item-list-renderer");
		if (!ele && document.querySelector("iframe") && !(document.querySelector("iframe[src]") && document.querySelector("iframe[src]").src.includes("truffle.vip"))) {
			ele = document.querySelector("iframe")?.contentWindow?.document?.body?.querySelector("#chat-messages #chat #contents > #item-scroller > #item-offset > #items.yt-live-chat-item-list-renderer");
		}
		return ele || null;
	}

	function getYouTubeChatItemsHost(ele) {
		if (!ele) {
			return null;
		}
		try {
			if (ele.parentElement && ele.parentElement.id === "item-offset") {
				return ele.parentElement;
			}
		} catch (e) {}
		return ele.parentElement || null;
	}

	function getYouTubeChatScrollerElement(ele) {
		var doc = (ele && ele.ownerDocument) ? ele.ownerDocument : document;
		var scroller = null;
		try {
			if (ele && typeof ele.closest === "function") {
				scroller = ele.closest("#item-scroller");
			}
		} catch (e) {}
		if (!scroller) {
			try {
				scroller = doc.querySelector("yt-live-chat-item-list-renderer #item-scroller, #chat-messages #item-scroller, #item-scroller");
			} catch (e) {}
		}
		return scroller || null;
	}

	function shouldKeepYouTubeChatAtBottom() {
		return !!(youtubeSettingsLoaded && isExtensionOn && !settings.disableYoutubeAutoScroll);
	}

	function isYouTubeChatNearBottom(ele) {
		var scroller = getYouTubeChatScrollerElement(ele);
		var target = scroller || ele;
		try {
			return (target.scrollHeight - target.scrollTop - target.clientHeight) <= 80;
		} catch (e) {}
		return true;
	}

	function clickYouTubeShowMoreButton(ele) {
		var doc = (ele && ele.ownerDocument) ? ele.ownerDocument : document;
		var showMore = null;
		try {
			showMore = doc.querySelector("yt-live-chat-item-list-renderer #show-more button, #show-more button, #show-more");
		} catch (e) {}
		if (!showMore) {
			return false;
		}
		try {
			var wrapper = showMore.closest ? (showMore.closest("#show-more") || showMore) : showMore;
			var style = doc.defaultView && doc.defaultView.getComputedStyle ? doc.defaultView.getComputedStyle(wrapper) : null;
			if (wrapper.hidden || (style && (style.display === "none" || style.visibility === "hidden"))) {
				return false;
			}
		} catch (e) {}
		try {
			showMore.click();
			return true;
		} catch (e) {}
		return false;
	}

	function keepYouTubeChatAtBottom(ele, force) {
		if (!ele || !ele.isConnected || !shouldKeepYouTubeChatAtBottom()) {
			return;
		}
		var now = Date.now();
		if (!force && (now - youtubeLastAutoScrollAt) < youtubeAutoScrollCooldownMs) {
			return;
		}
		youtubeLastAutoScrollAt = now;
		var scroller = getYouTubeChatScrollerElement(ele);
		var target = scroller || ele;
		clickYouTubeShowMoreButton(ele);
		try {
			target.scrollTop = target.scrollHeight;
			if (typeof target.scrollTo === "function") {
				target.scrollTo(0, target.scrollHeight);
			}
			target.dispatchEvent(new Event("scroll", { bubbles: true }));
		} catch (e) {}
		try {
			if (ele.lastElementChild && typeof ele.lastElementChild.scrollIntoView === "function") {
				ele.lastElementChild.scrollIntoView(false);
			}
		} catch (e) {}
		try {
			var listRenderer = ele.closest && ele.closest("yt-live-chat-item-list-renderer");
			if (listRenderer && typeof listRenderer.scrollToBottom === "function") {
				listRenderer.scrollToBottom();
			} else if (listRenderer && typeof listRenderer.scrollToBottom_ === "function") {
				listRenderer.scrollToBottom_();
			}
		} catch (e) {}
		youtubeAutoScrollOffBottomSince = 0;
	}

	function scheduleYouTubeChatAutoScroll(ele) {
		if (!ele || !shouldKeepYouTubeChatAtBottom()) {
			return;
		}
		if (isYouTubeChatNearBottom(ele)) {
			youtubeAutoScrollOffBottomSince = 0;
			try {
				clearTimeout(youtubeAutoScrollTimer);
			} catch (e) {}
			youtubeAutoScrollTimer = null;
			return;
		}
		if (!youtubeAutoScrollOffBottomSince) {
			youtubeAutoScrollOffBottomSince = Date.now();
		}
		if (youtubeAutoScrollTimer) {
			return;
		}
		youtubeAutoScrollTimer = setTimeout(function () {
			youtubeAutoScrollTimer = null;
			if (!ele || !ele.isConnected || !shouldKeepYouTubeChatAtBottom()) {
				return;
			}
			if (isYouTubeChatNearBottom(ele)) {
				youtubeAutoScrollOffBottomSince = 0;
				return;
			}
			keepYouTubeChatAtBottom(ele, true);
		}, Math.max(0, youtubeAutoScrollDelayMs - (Date.now() - youtubeAutoScrollOffBottomSince)));
	}

	function markYouTubeChatActivity() {
		var now = Date.now();
		youtubeLastChatActivityAt = now;
		youtubeLiveChatActivityCount += 1;
		youtubeRecentChatActivityTimes.push(now);
		if (youtubeRecentChatActivityTimes.length > 30) {
			youtubeRecentChatActivityTimes.shift();
		}
	}

	function isYouTubeChatActivityNode(ele) {
		try {
			return !!(ele && ele.tagName && (
				ele.tagName.startsWith("YT-LIVE-CHAT-") ||
				ele.tagName.startsWith("YTD-SPONSORSHIPS-") ||
				ele.tagName === "YT-GIFT-MESSAGE-VIEW-MODEL"
			));
		} catch (e) {}
		return false;
	}

	function updateYouTubeResourceActivity(now) {
		try {
			if (!performance || !performance.getEntriesByType) {
				return false;
			}
			var resourceCount = performance.getEntriesByType("resource").length || 0;
			if (!youtubeResourceActivitySampled) {
				youtubeLastResourceCount = resourceCount;
				youtubeResourceActivitySampled = true;
				return false;
			}
			if (resourceCount > youtubeLastResourceCount) {
				youtubeLastResourceCount = resourceCount;
				youtubeLastResourceActivityAt = now;
				return true;
			}
		} catch (e) {}
		return false;
	}

	function getRecentYouTubeStaleReloads(now) {
		try {
			var raw = sessionStorage.getItem(youtubeStaleReloadStorageKey);
			var values = raw ? JSON.parse(raw) : [];
			if (!Array.isArray(values)) {
				values = [];
			}
			values = values
				.map(function (value) {
					return parseInt(value, 10) || 0;
				})
				.filter(function (value) {
					return value > 0 && now - value < youtubeStaleReloadWindowMs;
				});
			sessionStorage.setItem(youtubeStaleReloadStorageKey, JSON.stringify(values));
			return values;
		} catch (e) {
			return [];
		}
	}

	function recordYouTubeStaleReload(now) {
		try {
			var values = getRecentYouTubeStaleReloads(now);
			values.push(now);
			sessionStorage.setItem(youtubeStaleReloadStorageKey, JSON.stringify(values));
		} catch (e) {}
	}

	function getYouTubeStaleReloadMs(now) {
		youtubeRecentChatActivityTimes = youtubeRecentChatActivityTimes.filter(function (value) {
			return value > 0 && now - value < youtubeStaleReloadActivityWindowMs;
		});
		if (youtubeRecentChatActivityTimes.length < 5) {
			return youtubeStaleReloadMaxMs;
		}
		var gapTotal = 0;
		var gapCount = 0;
		for (var i = 1; i < youtubeRecentChatActivityTimes.length; i++) {
			var gap = youtubeRecentChatActivityTimes[i] - youtubeRecentChatActivityTimes[i - 1];
			if (gap > 0) {
				gapTotal += gap;
				gapCount += 1;
			}
		}
		if (!gapCount) {
			return youtubeStaleReloadMaxMs;
		}
		var averageGap = gapTotal / gapCount;
		return Math.min(youtubeStaleReloadMaxMs, Math.max(youtubeStaleReloadMinMs, averageGap * 6));
	}

	// YouTube live chat can stall in Electron while the page is still alive:
	// resource activity continues, but yt-live-chat-item-list-renderer stops adding chat DOM nodes.
	// Soak tests on 2026-05-24:
	// - Reloading the live_chat popout consistently restarted DOM/message flow.
	// - Trusted Electron wheel input via webContents.sendInputEvent also restarted the feed repeatedly
	//   without sending a chat message. Standalone could do this from the main process, but
	//   youtube.js cannot create that trusted input by itself, and we are not using it yet because
	//   it may steal focus from fullscreen apps/games.
	// - Synthetic WheelEvent/scroll/focus/visibility/online events from page JS did not restart it.
	// - show-more clicks, scrollTop nudges, window resize, and YouTube component requestUpdate/
	//   notifyResize/yt-resize nudges did not reliably restart it.
	// - Reinjecting this source script once appeared to coincide with recovery in a harness run, but
	//   it risks duplicate observers and does not address the underlying stalled YouTube DOM feed.
	// Keep the reload as the common extension/browser fallback until standalone has a verified
	// no-focus-steal main-process bridge for trusted wheel input.
	function maybeReloadStaleYouTubeChat(ele) {
		if (!ele || !ele.isConnected || !youtubeSettingsLoaded || !isExtensionOn) {
			return;
		}
		if (settings.disableYoutubeStaleReload) {
			return;
		}
		if (!window.location.href.includes("youtube.com/live_chat") && !window.location.href.includes("studio.youtube.com/live_chat")) {
			return;
		}
		if (youtubeLiveChatActivityCount < youtubeStaleReloadMinMessages) {
			return;
		}

		var now = Date.now();
		updateYouTubeResourceActivity(now);
		var staleReloadMs = getYouTubeStaleReloadMs(now);

		if (now - youtubeLastChatActivityAt < staleReloadMs) {
			return;
		}
		if (now - youtubeLastResourceActivityAt > youtubeStaleReloadResourceGraceMs) {
			return;
		}

		var reloads = getRecentYouTubeStaleReloads(now);
		if (reloads.length >= youtubeStaleReloadMaxPerWindow) {
			return;
		}

		console.warn("[YouTube] Live chat DOM appears stale while network activity continues; reloading chat popout.", {
			secondsSinceChatActivity: Math.round((now - youtubeLastChatActivityAt) / 1000),
			staleReloadSeconds: Math.round(staleReloadMs / 1000)
		});
		recordYouTubeStaleReload(now);
		try {
			window.location.reload();
		} catch (e) {
			try {
				window.location.href = window.location.href;
			} catch (e2) {}
		}
	}

	function disconnectYouTubeChatObservers() {
		try {
			if (youtubeChatObserver) {
				youtubeChatObserver.disconnect();
			}
		} catch (e) {}
		try {
			if (youtubeDeletionObserver) {
				youtubeDeletionObserver.disconnect();
			}
		} catch (e) {}
		try {
			if (youtubeChatStructureObserver) {
				youtubeChatStructureObserver.disconnect();
			}
		} catch (e) {}
		try {
			clearTimeout(youtubeAutoScrollTimer);
		} catch (e) {}
		youtubeAutoScrollTimer = null;
		youtubeAutoScrollOffBottomSince = 0;
		youtubeChatObserver = null;
		youtubeDeletionObserver = null;
		youtubeChatStructureObserver = null;
		youtubeObservedItems = null;
		youtubeObservedItemsHost = null;
	}

	function seedYouTubeChatItems(ele) {
		if (!ele || !ele.children) {
			return;
		}
		try {
			[...ele.children].forEach(ele4 => {
				if (debugmode) {
					checkType(ele4, processMessage);
				}
				ele4.skip = true;
				cleared = true;
				if (ele4.id) {
					messageHistory.add(ele4.id);
				}
			});
		} catch (e) {}
	}

	function observeYouTubeChatStructure(host) {
		if (!host) {
			return null;
		}
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(function () {
			try {
				var latestItems = getYouTubeChatItemsElement();
				if (latestItems && latestItems !== youtubeObservedItems) {
					bindYouTubeChatObserver(latestItems, true);
				}
			} catch (e) {}
		});
		observer.observe(host, {
			childList: true,
			subtree: false
		});
		return observer;
	}

	function bindYouTubeChatObserver(ele, forceRefresh) {
		if (!ele) {
			return;
		}
		if (!forceRefresh && youtubeObservedItems === ele && youtubeChatObserver && youtubeDeletionObserver) {
			return;
		}
		disconnectYouTubeChatObservers();
		ele.skip = true;
		youtubeObservedItems = ele;
		youtubeObservedItemsHost = getYouTubeChatItemsHost(ele);
		youtubeDeletionObserver = setupDeletionObserver(ele);
		seedYouTubeChatItems(ele);
		youtubeChatObserver = onElementInserted(ele, function (ele2, eventtype=false) {
			if (isYouTubeChatActivityNode(ele2)) {
				markYouTubeChatActivity();
			}
			scheduleYouTubeChatAutoScroll(ele);
			setTimeout(() => processMessage(ele2, eventtype), captureDelay);
		});
		youtubeChatStructureObserver = observeYouTubeChatStructure(youtubeObservedItemsHost);
		youtubeEmptySince = 0;
		youtubeLastObserverRefreshAt = Date.now();
		youtubeChatHadMessages = (ele.childElementCount || 0) > 1;
		keepYouTubeChatAtBottom(ele, true);
		scheduleYouTubeChatAutoScroll(ele);
	}

	function maybeRefreshYouTubeChatObserver(ele) {
		if (!ele) {
			return;
		}
		if (!youtubeObservedItems || youtubeObservedItems !== ele || !youtubeChatObserver || !youtubeDeletionObserver) {
			bindYouTubeChatObserver(ele, false);
			return;
		}
		if (!youtubeObservedItems.isConnected) {
			bindYouTubeChatObserver(ele, true);
			return;
		}
		var itemCount = ele.childElementCount || 0;
		if (itemCount > 1) {
			youtubeChatHadMessages = true;
			youtubeEmptySince = 0;
			scheduleYouTubeChatAutoScroll(ele);
			return;
		}
		if (itemCount > 0 || !youtubeChatHadMessages) {
			youtubeEmptySince = 0;
			return;
		}
		if (!youtubeEmptySince) {
			youtubeEmptySince = Date.now();
			return;
		}
		if ((Date.now() - youtubeEmptySince) < 1000) {
			return;
		}
		if ((Date.now() - youtubeLastObserverRefreshAt) < youtubeObserverRefreshCooldownMs) {
			return;
		}
		bindYouTubeChatObserver(ele, true);
	}

	const checkTimer = setInterval(function () {
	  let ele = getYouTubeChatItemsElement();
	  if (ele) {
		maybeRefreshYouTubeChatObserver(ele);
		scheduleYouTubeChatAutoScroll(ele);
		maybeReloadStaleYouTubeChat(ele);
	  } else if (!ele && document.querySelector("iframe#hyperchat") && !document.querySelector("iframe#hyperchat").marked) {
			try {
				var ele22 = document.querySelector("iframe#hyperchat").contentWindow.document.body.querySelector(".content");
				if (ele22 && ele22.childNodes.length){
					var onMutationsObserved2 = function (mutations) {
						mutations.forEach(function (mutation) {
							if (mutation.addedNodes.length) {
								for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
									try {
										processHyperChat(mutation.addedNodes[i]);
									} catch (e) {
										//console.log(e);
									}
								}
							}
						});
					};
					var config2 = {childList: true, subtree: false};
					var MutationObserver2 = window.MutationObserver || window.WebKitMutationObserver;
					var observer2 = new MutationObserver2(onMutationsObserved2);
					observer2.observe(ele22, config2);
					document.querySelector("iframe#hyperchat").marked = true;
				}
			} catch(e){console.log(e);}
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
				const videoId123 = input.value.trim();
				if (videoId123) {
					window.location.href = `https://www.youtube.com/live_chat?is_popout=1&v=${videoId123}`;
				} else {
					alert('Please enter a valid video ID');
				}
			});
		}
	  }
	  
	  // style-scope yt-live-chat-message-renderer
	  
	  if (settings.autoLiveYoutube && document.querySelector("#trigger") && !marked){
			marked = true;
			document.querySelector("#trigger").click()
			document.querySelector('[slot="dropdown-content"] [tabindex="0"]').click()
			var waitTilClear = setInterval(function(){
				if (document.querySelectorAll('#menu > a').length>=2){
					clearInterval(waitTilClear);
					document.querySelectorAll('#menu > a')[1].click()
					document.querySelector("yt-live-chat-header-renderer").style.maxHeight = "10px";
				}
			},100)
	  } else if (document.querySelector("#trigger") && !settings.autoLiveYoutube && marked){
		  document.querySelector("yt-live-chat-header-renderer").style.maxHeight = "unset";
		  marked = false;
	  }

	  // Apply or remove larger font based on settings
	  if (settings.youtubeLargerFont) {
		  applyLargerFont();
	  } else {
		  removeLargerFont();
	  }
	}, 1000);

	
	function processHyperChat(ele) {
		try {
			var data = {};
			data.chatname = getAllContentNodes(ele.querySelector(".text-owner-light, .text-owner-dark"));
			data.chatmessage = getAllContentNodes(ele.querySelector("span.cursor-auto.align-middle"));
			data.type = "youtube";
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				{
					message: data
				},
				(e)=> {
					//console.log(e);
					e.id ? (ele.dataset.mid = e.id) : "";
				}
			);
		} catch (e) {}
	}
	
	
	var viewerCheckInterval = null;
	var isInFallbackMode = false;
	
	function checkViewers(){
		if (videoId && isExtensionOn && (settings.showviewercount || settings.hypemode)){
			fetch('https://api.socialstream.ninja/youtube/viewers?video='+videoId)
			  .then(response => {
				// Check if response is not ok (including 400 errors)
				if (!response.ok) {
					return response.json().then(errorData => {
						// Check if it's a quota error
						if (errorData && errorData.error && errorData.error.includes("quota")) {
							console.log("API quota exceeded, falling back to page scraping");
							// Switch to fallback mode with slower interval
							if (!isInFallbackMode) {
								isInFallbackMode = true;
								// Clear existing interval and set new one for 2 minutes
								if (viewerCheckInterval) {
									clearInterval(viewerCheckInterval);
								}
								viewerCheckInterval = setInterval(function(){checkViewers()}, 118000); // 1:58 seconds
							}
							// Fallback to scraping the YouTube page
							return fetchViewerCountFromPage(videoId);
						}
						throw new Error('API request failed');
					});
				}
				// API call successful, ensure we're in normal mode
				if (isInFallbackMode) {
					isInFallbackMode = false;
					// Reset to normal 30-second interval
					if (viewerCheckInterval) {
						clearInterval(viewerCheckInterval);
					}
					viewerCheckInterval = setInterval(function(){checkViewers()}, 30000);
				}
				return response.json();
			  })
			  .then(data => {
				try {
					if (data && ("viewers" in data)){
						chrome.runtime.sendMessage(
							chrome.runtime.id,
							({message:{
									type: (youtubeShorts ? "youtubeshorts" : "youtube"),
									event: 'viewer_update',
									meta: parseInt(data.viewers)
									//chatmessage: data.data[0] + " has started following"
								}
							}),
							function (e) {}
						);
					}
				} catch (e) {
					//console.log(e);
				}
			  })
			  .catch(error => {
				console.log("Error checking viewers:", error);
				// Switch to fallback mode on any error
				if (!isInFallbackMode) {
					isInFallbackMode = true;
					// Clear existing interval and set new one for 2 minutes
					if (viewerCheckInterval) {
						clearInterval(viewerCheckInterval);
					}
					viewerCheckInterval = setInterval(function(){checkViewers()}, 118000); // 1:58 minutes
				}
				// Try fallback method on any error
				fetchViewerCountFromPage(videoId);
			  });
		}
	}
	
	function fetchViewerCountFromPage(videoId) {
		return fetch('https://www.youtube.com/watch?v=' + videoId)
			.then(response => response.text())
			.then(html => {
				let viewerCount = 0; // Default to 0 if not found
				try {
					// Look for the pattern in the HTML - matches any number in originalViewCount
					const viewerMatch = html.match(/"isLive"\s*:\s*true\s*,\s*"originalViewCount"\s*:\s*"(\d+)"/);

					if (viewerMatch && viewerMatch[1]) {
						const parsedCount = parseInt(viewerMatch[1]);

						// Validate the viewer count is reasonable
						if (!isNaN(parsedCount) && parsedCount >= 0 && parsedCount < 1000000000) {
							viewerCount = parsedCount;
							console.log("Successfully scraped viewer count:", viewerCount);
						} else {
							console.log("Invalid viewer count scraped:", parsedCount);
						}
					} else {
						console.log("Could not find viewer count in page HTML, defaulting to 0");
					}
				} catch (e) {
					console.error("Error parsing viewer count from page:", e);
				}

				// Always send the viewer count update (even if 0)
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					({message:{
							type: (youtubeShorts ? "youtubeshorts" : "youtube"),
							event: 'viewer_update',
							meta: viewerCount
						}
					}),
					function (e) {}
				);

				return { viewers: viewerCount };
			})
			.catch(error => {
				console.error("Error fetching YouTube page for viewer count:", error);

				// Send 0 on fetch error to clear stale counts
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					({message:{
							type: (youtubeShorts ? "youtubeshorts" : "youtube"),
							event: 'viewer_update',
							meta: 0
						}
					}),
					function (e) {}
				);

				return { viewers: 0 };
			});
	}
	
	setTimeout(function(){checkViewers();},2500);
	viewerCheckInterval = setInterval(function(){checkViewers()},30000);
	

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
