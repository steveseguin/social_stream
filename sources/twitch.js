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
	var index = xx.indexOf("chat");
	if (index > -1) {
		xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("u");
	if (index > -1) {
		xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("moderator");
	if (index > -1) {
		xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("dashboard");
	if (index > -1) {
		xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("");
	if (index > -1) {
		xx.splice(index, 1); // 2nd parameter means remove one item only
	}
	index = xx.indexOf("popout");
	if (index > -1) {
		xx.splice(index, 1); // 2nd parameter means remove one item only
	}
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
	

	function getAllContentNodes(element) {
		let result = '';
		let pendingRegularEmote = null;
		let pendingSpace = "";

		function processNode(node) {
			if (node.nodeType === 3 && node.textContent.length > 0) { // text node
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
	
	var lastMessage = "";
	var lastUser = "";
	var lastEle = null;
	//var midList = [];
	
	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}


	async function processMessage(ele, event=false) {
		// twitch
		
		//console.log(ele);
		
		if (!ele){return;}
		
		if (settings.delaytwitch){
		  await sleep(3000);
		  if (!ele){return;}
		  if (ele.querySelector(".deleted, [data-a-target='chat-deleted-message-placeholder']")) {
			  // already deleted.
			  return;  
		  }
	    }
	  
	    if (!ele.isConnected){return;}
		
		if (ele.classList.contains("chat-line__unpublished-message-body") || ele.querySelector(".chat-line__unpublished-message-body")){
			return;
		}

		var chatsticker = false;
		var chatmessage = "";
		var nameColor = "";
		var donations = 0;
		var highlightColor = "";
		
		try {
			var displayNameEle = ele.querySelector(".chat-author__display-name, .chatter-name") || ele.querySelector(".seventv-chat-user-username");
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
		try {
			ele.querySelectorAll("img.chat-badge[src], img.chat-badge[srcset], .seventv-chat-badge>img[src], .seventv-chat-badge>img[srcset], .ffz-badge, .user-pronoun").forEach(badge => {
				if (badge.alt && badge.alt.includes("Subscriber")){
					subscriber = "Subscriber";
					subtitle = badge.alt.replace(/\s*\([^)]*\)/g, '');
					subtitle = subtitle.replace("Subscriber","").trim();
					if (subtitle && subtitle.endsWith("-Month") && (subtitle!=="1-Month")){
						subtitle+="s";
					}
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
			});
		} catch (e) {}
		
		if (settings.memberchatonly && !subscriber){
			return;
		}

		try {
			var BTT = ele.querySelectorAll(".bttv-tooltip");
			for (var i = 0; i < BTT.length; i++) {
				BTT[i].outerHTML = "";
			}
		} catch (e) {}

		try {
			if (event){
				var eleContent = ele.childNodes[0];
			} else {
				var eleContent = ele.querySelector(".seventv-chat-message-body") || ele.querySelector(".seventv-message-context") || ele.querySelector('*[data-test-selector="chat-line-message-body"]') || ele.querySelector('*[data-a-target="chat-line-message-body"]');
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

		/* var eventtype = ele.querySelector("[data-highlight-label]");
		if (eventtype){
			try {
				eventtype = escapeHtml(eventtype.dataset.highlightLabel) || "";
			} catch(e){
				eventtype = "";
			}
		} */
		var eventtype = "";
		if (!chatmessage) {
			try {
				chatmessage = getAllContentNodes(ele.querySelector(".seventv-reward-message-container")).trim();
				eventtype = "reward";
			} catch (e) {}
		}

		if (eventtype && chatmessage) {
			// pass
		} else if (!chatmessage && !hasDonation && !username) {
			return;
		}

		try {
			if (settings.replyingto && chatmessage) {
				try {
					var replyMessage = getAllContentNodes(ele.querySelector(".chat-line__message-container [title], .seventv-reply-message-part"));
					replyMessage = replyMessage.split(":")[0].trim();
					if (!replyMessage) {
						replyMessage = getAllContentNodes(ele.querySelector(".reply-line--mentioned").parentNode);
						replyMessage = replyMessage.split(":")[0].trim();
					}
				} catch (e) {
					//console.log(e);
					try {
						var replyMessage = getAllContentNodes(ele.querySelector(".reply-line--mentioned").parentNode);
						replyMessage = replyMessage.split(":")[0].trim();
					} catch (ee) {
						//console.log(ee);
					}
				}

				if (replyMessage) {
					if (settings.textonlymode) {
						chatmessage = replyMessage + ": " + chatmessage;
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

		var data = {};
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
		data.membership = subscriber;
		data.subtitle = subtitle;
		data.textonly = settings.textonlymode || false;
		data.type = "twitch";

		// console.log(data);

		if (brandedImageURL) {
			data.sourceImg = brandedImageURL;
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
					if ("mid" in e) {
						ele.dataset.mid = e.mid;
						//midList.push(e.mid);
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
				//console.log("REQUEST", request);
				if ("focusChat" == request) {
					if (!isExtensionOn || document.referrer.includes("twitch.tv/popout/")) {
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
				//console.log(response);
				if ("settings" in response) {
					settings = response.settings;
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
				if ("state" in response) {
					isExtensionOn = response.state;
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
		
		var data = {};
		data.chatname = "";
		data.chatbadges = "";
		data.nameColor = "";
		data.chatmessage = getAllContentNodes(ele);
		data.chatimg = "";
		data.hasDonation = "";
		data.membership = "";
		data.type = "twitch";
		data.textonly = settings.textonlymode || false;
		data.event = true;
		
		// channel-points-reward-line__icon
		if (ele.querySelector("[class*='channel-points-reward']")){
			data.event = "reward";
		}

		if (!data.chatmessage) {
			return;
		}

		if (brandedImageURL) {
			data.sourceImg = brandedImageURL;
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
			ele.ignore = true;
			if (ele.deleted) {
				return;
			}
			ele.deleted = true;
			
			var chatname = ele.querySelector(".chat-author__display-name, .chatter-name, .seventv-chat-user-username");
			if (chatname) {
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
			chatname = ele.parentNode.querySelector(".chat-author__display-name, .chatter-name, .seventv-chat-user-username");
			if (chatname) {
				ele.parentNode.ignore = true;
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
	
		
	
	//<div class="Layout-sc-1xcs6mc-0"><div data-test-selector="user-notice-line" class="InjectLayout-sc-1i43xsx-0 iwRBzz user-notice-line"><div class="Layout-sc-1xcs6mc-0 jjAyLi"><div class="ScFigure-sc-wkgzod-0 caxXaW tw-svg"><svg width="20" height="20" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11 4.5 9 2 4.8 6.9A7.48 7.48 0 0 0 3 11.77C3 15.2 5.8 18 9.23 18h1.65A6.12 6.12 0 0 0 17 11.88c0-1.86-.65-3.66-1.84-5.1L12 3l-1 1.5ZM6.32 8.2 9 5l2 2.5L12 6l1.62 2.07A5.96 5.96 0 0 1 15 11.88c0 2.08-1.55 3.8-3.56 4.08.36-.47.56-1.05.56-1.66 0-.52-.18-1.02-.5-1.43L10 11l-1.5 1.87c-.32.4-.5.91-.5 1.43 0 .6.2 1.18.54 1.64A4.23 4.23 0 0 1 5 11.77c0-1.31.47-2.58 1.32-3.57Z" clip-rule="evenodd"></path></svg></div><div class="Layout-sc-1xcs6mc-0 grvhen"><div class="Layout-sc-1xcs6mc-0 jjAyLi"><span class="chatter-name chatter-name--no-outline" role="button" tabindex="0"><span class="CoreText-sc-1txzju1-0 ffeswd"><span class="CoreText-sc-1txzju1-0 blwagE">EVARATE</span></span></span><div class="Layout-sc-1xcs6mc-0 dAPRYJ"><p class="CoreText-sc-1txzju1-0">+</p><div class="Layout-sc-1xcs6mc-0 gfgICc channel-points-icon channel-points-icon--small"><img class="channel-points-icon__image tw-image" alt="Lunas" srcset="https://static-cdn.jtvnw.net/channel-points-icons/541084545/d7f411ea-e742-471c-8262-932cd3213413/icon-1.png 1x,https://static-cdn.jtvnw.net/channel-points-icons/541084545/d7f411ea-e742-471c-8262-932cd3213413/icon-2.png 2x,https://static-cdn.jtvnw.net/channel-points-icons/541084545/d7f411ea-e742-471c-8262-932cd3213413/icon-4.png 4x" src="https://static-cdn.jtvnw.net/channel-points-icons/541084545/d7f411ea-e742-471c-8262-932cd3213413/icon-1.png"></div><p class="CoreText-sc-1txzju1-0">350</p></div></div><div class="Layout-sc-1xcs6mc-0"><p class="CoreText-sc-1txzju1-0"><span class="CoreText-sc-1txzju1-0 jkurzn">Watch Streak reached!:</span> EVARATE is currently on a 3-stream streak!</p></div></div></div><div class="Layout-sc-1xcs6mc-0 fAVISI"><div class="chat-line--inline chat-line__message" data-a-target="chat-line-message" data-a-user="evarate" tabindex="0" align-items="center"><div class="Layout-sc-1xcs6mc-0 cwtKyw"><div class="Layout-sc-1xcs6mc-0 cwtKyw chat-line__message-container"><div class="Layout-sc-1xcs6mc-0"></div><div class="Layout-sc-1xcs6mc-0"><div class="Layout-sc-1xcs6mc-0 cVmNmw chat-line__no-background"><div class="Layout-sc-1xcs6mc-0 jCLQvB"><span class="chat-line__timestamp" data-a-target="chat-timestamp" data-test-selector="chat-timestamp">1:36</span><div class="Layout-sc-1xcs6mc-0 plvaC chat-line__username-container chat-line__username-container--hoverable"><span><div class="InjectLayout-sc-1i43xsx-0 jbmPmA"><button data-a-target="chat-badge"><img alt="GLHF Pledge" aria-label="GLHF Pledge badge" class="chat-badge" src="https://static-cdn.jtvnw.net/badges/v1/3158e758-3cb4-43c5-94b3-7639810451c5/1" srcset="https://static-cdn.jtvnw.net/badges/v1/3158e758-3cb4-43c5-94b3-7639810451c5/1 1x, https://static-cdn.jtvnw.net/badges/v1/3158e758-3cb4-43c5-94b3-7639810451c5/2 2x, https://static-cdn.jtvnw.net/badges/v1/3158e758-3cb4-43c5-94b3-7639810451c5/3 4x"></button></div></span><span class="chat-line__username" role="button" tabindex="0"><span><span class="chat-author__display-name" data-a-target="chat-message-username" data-a-user="evarate" data-test-selector="message-username" style="color: rgb(97, 173, 254);">EVARATE</span></span></span></div><span aria-hidden="true">: </span><span class="" data-a-target="chat-line-message-body"><span class="text-fragment" data-a-target="chat-message-text">my hangover needs this so bad. thank you</span></span></div></div></div></div><div class="Layout-sc-1xcs6mc-0 bbwsyT chat-line__icons"></div></div></div></div></div></div>

	function onElementInsertedTwitch(target, callback) {
		var onMutationsObserved = function (mutations) {
			if (!isExtensionOn || document.referrer.includes("twitch.tv/popout/")) {
				return;
			}
			mutations.forEach(function (mutation) {
				if (mutation.target === target) {
					return;
				} else if (mutation.type === "attributes") {
					if (mutation.attributeName == "class" && mutation.target.classList.contains("deleted")) {
						deleteThis(mutation.target);
					} else if (mutation.attributeName == "data-a-target" && mutation && mutation.target && mutation.target.data && mutation.target.data.aTarget && mutation.target.data.aTarget == "chat-deleted-message-placeholder") {
						deleteThis(mutation.target);
					}
				} else if (mutation.type === "childList" && mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (!mutation.addedNodes[i]){continue;}
						if (mutation.addedNodes[i].nodeType === 3){continue;}
						try {
							if ((mutation.addedNodes[i].dataset && mutation.addedNodes[i].dataset.aTarget == "chat-deleted-message-placeholder") || mutation.addedNodes[i].querySelector('[data-a-target="chat-deleted-message-placeholder"]')){
								deleteThis(mutation.addedNodes[i]);
								continue;
							}

							if (mutation.addedNodes[i].ignore) {
								continue;
							}
							mutation.addedNodes[i].ignore = true;
							
							console.log(mutation.addedNodes[i]);
							
							if (settings.captureevents){
								if (mutation.addedNodes[i].dataset.testSelector == "user-notice-line") {
									console.log("a");
									processEvent(mutation.addedNodes[i]);
									console.log("a.");
									continue;
								} else if (mutation.addedNodes[i].classList.contains("user-notice-line")) {
									console.log("b");
									processEvent(mutation.addedNodes[i]);
									console.log("b.");
									continue;
								} else if (mutation.addedNodes[i].classList.contains("user-notice-line")) {
									console.log("c");
									processEvent(mutation.addedNodes[i]);
									console.log("c.");
									continue;
								}
								console.log(".");
							}
							
							if (mutation.addedNodes[i].classList.contains("seventv-message") || mutation.addedNodes[i].classList.contains("chat-line__message") || mutation.addedNodes[i].classList.contains("paid-pinned-chat-message-content-wrapper")){
								console.log("1");
								callback(mutation.addedNodes[i]);
								console.log("1.");
								continue;
							}
							
							let nextElement = mutation.addedNodes[i].querySelector('.user-notice-line, [data-test-selector="user-notice-line"]');
							if (nextElement){
								console.log("2");
								if (!nextElement.ignore){
									nextElement.ignore = true;
									processEvent(nextElement);
								}
								console.log("2,");
								continue;
							}
							
							nextElement = mutation.addedNodes[i].querySelector(".chat-line__message, .seventv-message, .paid-pinned-chat-message-content-wrapper");
							if (nextElement){
								console.log("3.");
								if (!nextElement.ignore){
									nextElement.ignore = true;
									callback(nextElement);
								}
								console.log("3");
								continue
							}
							console.log(settings.captureevents);
							console.log(
								settings.captureevents ,
								mutation.addedNodes[i].parentNode, 
								mutation.addedNodes[i].parentNode.parentNode , 
								mutation.addedNodes[i].parentNode.parentNode.dataset.testSelector, 
								(mutation.addedNodes[i].parentNode.parentNode.dataset.testSelector == "user-notice-line")
							);
							
							if (settings.captureevents && mutation.addedNodes[i].parentNode && mutation.addedNodes[i].parentNode.dataset.testSelector && (mutation.addedNodes[i].parentNode.dataset.testSelector == "user-notice-line")){
								if (!mutation.addedNodes[i].parentNode.ignore){
									mutation.addedNodes[i].parentNode.ignore = true;
									console.log("4");
									processEvent(mutation.addedNodes[i]);
								}
							} else if (settings.captureevents && mutation.addedNodes[i].parentNode && mutation.addedNodes[i].parentNode.parentNode && mutation.addedNodes[i].parentNode.parentNode.dataset.testSelector && (mutation.addedNodes[i].parentNode.parentNode.dataset.testSelector == "user-notice-line")){
								if (!mutation.addedNodes[i].parentNode.ignore && !mutation.addedNodes[i].parentNode.parentNode.ignore){
									mutation.addedNodes[i].parentNode.parentNode.ignore = true;
									mutation.addedNodes[i].parentNode.ignore = true;
									console.log("5");
									processEvent(mutation.addedNodes[i]);
								}
							}
						} catch (e) {
							console.error(e);
						}
					}
				}
			});
		};

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

	var checkReady = setInterval(function () {
		counter += 1;
		
		if (counter == 10) {
			checkElement = ".chat-list--other, .chat-list--default, .chat-room__content, #root";
		}
		
		if (document.querySelector(checkElement)) {
			// just in case
			console.log("Social Stream Start");
			clearInterval(checkReady);
			setTimeout(function () {
				var clear = document.querySelectorAll("seventv-container, .seventv-message, .chat-line__message, .paid-pinned-chat-message-content-wrapper");
				for (var i = 0; i < clear.length; i++) {
					clear[i].ignore = true; // don't let already loaded messages to re-load.
				}
				console.log("Social Stream ready to go");
				onElementInsertedTwitch(document.querySelector(checkElement), function (element) {
					setTimeout(
						function (element) {
							if (element && element.isConnected) {
								processMessage(element);
							}
						},
						20,
						element
					); // 20ms to give it time to load the message, rather than just the container
				});

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
	
	function checkFollowers(){
		if (channelName && isExtensionOn && (settings.showviewercount || settings.hypemode)){
			fetch('https://api.socialstream.ninja/twitch/viewers?username='+channelName)
			  .then(response => response.text())
			  .then(count => {
				try {
					if (count == parseInt(count)){
						chrome.runtime.sendMessage(
							chrome.runtime.id,
							({message:{
									type: 'twitch',
									event: 'viewer_update',
									meta: parseInt(count)
									//chatmessage: data.data[0] + " has started following"
								}
							}),
							function (e) {}
						);
					}
				} catch (e) {
					//console.log(e);
				}				
				  //console.log('Viewer count:', count);
			  });
		}
	}
	
	setTimeout(function(){checkFollowers();},2500);
	setInterval(function(){checkFollowers()},60000);

	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function (e) {
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