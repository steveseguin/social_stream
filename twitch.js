(function() {
	var isExtensionOn = true;

	async function fetchWithTimeout(URL, timeout = 8000) { // ref: https://dmitripavlutin.com/timeout-fetch-request/
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
		if (settings.translation && settings.translation.innerHTML && (key in settings.translation.innerHTML)) { // these are the proper translations
			return settings.translation.innerHTML[key];
		} else if (settings.translation && settings.translation.miscellaneous && settings.translation.miscellaneous && (key in settings.translation.miscellaneous)) {
			return settings.translation.miscellaneous[key];
		} else if (value !== false) {
			return value;
		} else {
			return key.replaceAll("-", " "); //
		}
	}

	const hideContentInParentheses = (str) => str.replace(/\(.*?\)/g, '');

	function getTwitchAvatarImage(username) {
		fetchWithTimeout("https://api.socialstream.ninja/twitch/avatar?username=" + encodeURIComponent(username)).then(response => {
			response.text().then(function(text) {
				if (text.startsWith("https://")) {
					brandedImageURL = text;
				}
			});
		}).catch(error => {
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
			if (settings.textonlymode) { // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				.replace(/&/g, "&amp;") // i guess this counts as html
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;") || "";
		} catch (e) {
			return "";
		}
	}
	
	
	function cloneSvgWithResolvedUse(svgElement) {
		const clonedSvg = svgElement.cloneNode(true);

		const useElements = clonedSvg.querySelectorAll('use');
		useElements.forEach((use) => {
			const refId = use.getAttribute('href') || use.getAttribute('xlink:href');
			if (refId) {
				const id = refId.startsWith('#') ? refId.slice(1) : refId;
				const referencedElement = document.getElementById(id);
				if (referencedElement) {
					const clonedReferencedElement = referencedElement.cloneNode(true);
					use.parentNode.replaceChild(clonedReferencedElement, use);
				}
			}
		});

		return clonedSvg;
	}


	function getAllContentNodes(element) { // takes an element.
		var resp = "";
		if (!element) {
			return resp;
		}

		if (!element.childNodes || !element.childNodes.length) {
			if (element.textContent) {
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}

		element.childNodes.forEach(node => {
			if (node.childNodes.length) {
				if (node.nodeName.toLowerCase() == "svg"){
					if (node.classList.contains("seventv-chat-emote")){
						const resolvedSvg = cloneSvgWithResolvedUse(node);
						resolvedSvg.style = "";
						resp += resolvedSvg.outerHTML;
					}
					return;
				} else if (node.classList.contains("seventv-chat-user-username")){
					resp += escapeHtml(node.textContent.trim()) + " ";
				} else {
					resp += getAllContentNodes(node)
				}
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)) {
				
				if (settings.textonlymode){
					resp += escapeHtml(node.textContent.trim()) + " ";
				} else {
					resp += replaceEmotesWithImages(escapeHtml(node.textContent).trim()) + " ";
				}
				
			} else if (node.nodeType === 1) {
				if (!settings.textonlymode) {
					if (node.nodeName === "IMG") {
						var srcset = node.getAttribute('srcset');
						if (srcset) {
							var sources = srcset.split(',');
							var image2xSource = sources.find(function(source) {
								return source.trim().endsWith(' 2x');
							});
							if (image2xSource) {
								var imageUrl = image2xSource.trim().split(' ')[0];
								if (imageUrl) {
									if (node.classList.contains("zero-width-emote")) {
										resp += `<span class='zero-width-parent'><img src='${imageUrl}' /></span>`;
									} else {
										resp += `<img src='${imageUrl}' />`;
									}
									return; 
								}
							}
						}
					}
					
					if (node.nodeName.toLowerCase() == "svg"){
						if (node.classList.contains("seventv-chat-emote")){
							const resolvedSvg = cloneSvgWithResolvedUse(node);
							resolvedSvg.style = "";
							resp += resolvedSvg.outerHTML;
						}
						return;
					} else if ((node.nodeName == "SPAN") && !node.textContent.length){
						return;
					} else if (node && node.classList && node.classList.contains("zero-width-emote")) {
						resp += "<span class='zero-width-parent'>" + node.outerHTML + "</span>";
					} else {
						resp += node.outerHTML;
					}
				}
			}
		});
		return resp;
	}

	var lastMessage = "";
	var lastUser = "";
	var lastEle = null;
	//var midList = [];

	function processMessage(ele) { // twitch
	
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
		try {
			ele.querySelectorAll("img.chat-badge[src], img.chat-badge[srcset], .seventv-chat-badge>img[src], .seventv-chat-badge>img[srcset], .ffz-badge").forEach(badge => {
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
							if (computed.backgroundColor){
								bage.bgcolor = computed.backgroundColor;
							}
							if (computed) {
								chatbadges.push(bage);
							}
						}
					} catch (e) {}
				}
			});

		} catch (e) {}

		try {
			var BTT = ele.querySelectorAll('.bttv-tooltip');
			for (var i = 0; i < BTT.length; i++) {
				BTT[i].outerHTML = "";
			}
		} catch (e) {}

		try {
			var eleContent = ele.querySelector(".seventv-chat-message-body") || ele.querySelector(".seventv-message-context") || ele.querySelector('*[data-test-selector="chat-line-message-body"]') || ele.querySelector('*[data-a-target="chat-line-message-body"]');
			
			chatmessage = getAllContentNodes(eleContent);
			
			if (!highlightColor && chatmessage && eleContent.querySelector(".chat-message-mention, .mention-fragment--recipient[data-a-target='chat-message-mention']")){
				highlightColor = "rgba(225, 20, 20, 0.3)";
			}
			
		} catch (e) {}

		if (!chatmessage) {
			try {
				var eleContent = ele.querySelector('span.message');
				chatmessage = getAllContentNodes(eleContent);
				if (!highlightColor && chatmessage && eleContent.querySelector(".chat-message-mention, .mention-fragment--recipient[data-a-target='chat-message-mention']")){
					highlightColor = "rgba(225, 20, 20, 0.3)";
				}
			} catch (e) {}
		}

		if (!chatmessage) {
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
						break
					}
				}
				if (!highlightColor && chatmessage && eleContent.querySelector(".chat-message-mention, .mention-fragment--recipient[data-a-target='chat-message-mention']")){
					highlightColor = "rgba(225, 20, 20, 0.3)";
				}
			} catch (e) {}
		}

		if (!chatmessage) {
			try {
				var eleContent = ele.querySelector('.paid-pinned-chat-message-content-container').childNodes;

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

		if ((lastMessage === chatmessage) && (lastUser === username) && (!lastEle || !lastEle.isConnected)) {
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
			if (settings.customtwitchaccount && settings.customtwitchaccount.textsetting && (settings.customtwitchaccount.textsetting.toLowerCase() !== channelName.toLowerCase())) {
				return;
			} else if (!settings.customtwitchaccount) {
				return;
			}
		}
		
		
		try {

			if (!donations) {
				var elements = ele.querySelectorAll('.chat-line__message--cheer-amount'); // FFZ support

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
				var elements = ele.querySelectorAll('.paid-pinned-chat-message-content-container')[1]; // FFZ support
				donations = escapeHtml(elements.textContent);
			} catch (e) {}
		}

		var hasDonation = '';
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
		if (!chatmessage){
			try {
				chatmessage = getAllContentNodes(ele.querySelector(".seventv-reward-message-container")).trim();
				eventtype = "reward";
			} catch(e){}
		}
		
		
		if (eventtype && chatmessage){
			// pass
		} else if (!chatmessage && !hasDonation && !username) {
			return;
		}
		
		try {
			if (settings.replyingto && chatmessage){
				try {
					var replyMessage = getAllContentNodes(ele.querySelector(".chat-line__message-container [title], .seventv-reply-message-part"));
					replyMessage = replyMessage.split(":")[0].trim();
					if (!replyMessage){
						replyMessage = getAllContentNodes(ele.querySelector(".reply-line--mentioned").parentNode);
						replyMessage = replyMessage.split(":")[0].trim();
					}
				} catch(e){
					//console.log(e);
					try {
						var replyMessage = getAllContentNodes(ele.querySelector(".reply-line--mentioned").parentNode);
						replyMessage = replyMessage.split(":")[0].trim();
					} catch(ee){
						//console.log(ee);
					}
				}
				
				if (replyMessage){
					if (settings.textonlymode) {
						chatmessage = replyMessage + ": "+chatmessage;
					} else {
						chatmessage = "<i><small>"+replyMessage + ":&nbsp;</small></i> "+chatmessage;
					}
				}
			}
		} catch(e){
			
		}
		
		
		

		try {
			if (!highlightColor){
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
				if (!highlightColor){
					let hlele =  ele.querySelector(".has-highlight");
					if (hlele){
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
		data.membership = "";
		data.textonly = settings.textonlymode || false;
		data.type = "twitch";
		
		// console.log(data);
		
		if (brandedImageURL) {
			data.sourceImg = brandedImageURL;
		}
		
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"message": data
			}, function(e) {
				if ("mid" in e) {
					ele.dataset.mid = e.mid;
					//midList.push(e.mid);
				}
			});
		} catch (e) {
			//
		}
	}
	
	function replaceEmotesWithImages(text) {
		if (!BTTV){return text;}
		if (!settings.bttv){return text;}
		try {
			/* if (BTTV.globalEmotes){ // we'll handle globals in the extension.
				BTTV.globalEmotes.forEach(emote => {
					const emoteCode = emote.code;
					const emoteId = emote.id;
					const imageUrl = `https://cdn.betterttv.net/emote/${emoteId}/1x`;
					const imageTag = `<img src="${imageUrl}" alt="${emoteCode}"/>`;

					text = text.split(emoteCode).join(imageTag);
				});
			} */
			if (BTTV.channelEmotes){
				BTTV.channelEmotes.forEach(emote => {
					const emoteCode = emote.code;
					const emoteId = emote.id;
					const imageUrl = `https://cdn.betterttv.net/emote/${emoteId}/1x`;
					const imageTag = `<img src="${imageUrl}" alt="${emoteCode}"/>`;

					text = text.split(emoteCode).join(imageTag);
				});
			}
			if (BTTV.sharedEmotes){
				BTTV.sharedEmotes.forEach(emote => {
					const emoteCode = emote.code;
					const emoteId = emote.id;
					const imageUrl = `https://cdn.betterttv.net/emote/${emoteId}/1x`;
					const imageTag = `<img src="${imageUrl}" alt="${emoteCode}"/>`;

					text = text.split(emoteCode).join(imageTag);
				});
			}
		} catch(e){
		}
		return text;
	}

	var settings = {};
	var BTTV = false;
	// settings.textonlymode
	// settings.captureevents

	if (chrome && chrome.runtime) {
		chrome.runtime.onMessage.addListener(
			function(request, sender, sendResponse) {
				try {
					//console.log("REQUEST");
					//console.log(request);
					if ("focusChat" == request) {

						if (!isExtensionOn || document.referrer.includes("twitch.tv/popout/")) {
							return;
						}

						document.querySelector('[data-a-target="chat-input"]').focus();
						sendResponse(true);
						return;
					}
					if (typeof request === "object") {
						if ("state" in request) {
							isExtensionOn = request.state;
						}
						if ("settings" in request){
							settings = request.settings;
							sendResponse(true);
							//console.log(settings);
							if (settings.bttv && !BTTV){
								chrome.runtime.sendMessage(chrome.runtime.id, { "getBTTV": true }, function(response){});
							}
							return;
						} 
						if ("BTTV" in request){
							BTTV = request.BTTV;
							//console.log(BTTV);
							sendResponse(true);
							return;
						}
					}
						
					// twitch doesn't capture avatars already.
				} catch (e) {}
				sendResponse(false);
			}
		);


		chrome.runtime.sendMessage(chrome.runtime.id, {
			"getSettings": true
		}, function(response) { // {"state":isExtensionOn,"streamID":channel, "settings":settings}
			//console.log(response);
			if ("settings" in response) {
				settings = response.settings;
				if (settings.bttv && !BTTV){
					chrome.runtime.sendMessage(chrome.runtime.id, { "getBTTV": true }, function(response){
					//	console.log(response);
					});
				}
			}
			if ("state" in response) {
				isExtensionOn = response.state;
			}
		});
	}

	function processEvent(ele) {
		var data = {};
		data.chatname = "";
		data.chatbadges = "";
		data.nameColor = "";;
		data.chatmessage = getAllContentNodes(ele);
		data.chatimg = "";
		data.hasDonation = "";
		data.membership = "";
		data.type = "twitch";
		data.textonly = settings.textonlymode || false;
		data.event = true;

		if (!data.chatmessage) {
			return;
		}

		if (brandedImageURL) {
			data.sourceImg = brandedImageURL;
		}


		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"message": data
			}, function(e) {});
		} catch (e) {
			//
		}
	}

	function deleteThis(ele) {
		try {
			
			ele.ignore = true;
			if (ele.deleted){return;}
			ele.deleted = true;
			
			var chatname = ele.querySelector(".chat-author__display-name, .chatter-name, .seventv-chat-user-username");
			if (chatname) {
				var data = {};
				data.chatname = escapeHtml(chatname.innerText);
				data.type = "twitch";
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
	
	function onElementInsertedTwitch(target, callback) {
		var onMutationsObserved = function(mutations) {
			if (!isExtensionOn || document.referrer.includes("twitch.tv/popout/")) {
				return;
			}
			mutations.forEach(function(mutation) {
				if (mutation.target === target) {
					return;
				} else if (mutation.type === 'attributes'){
					if ((mutation.attributeName == "class") && mutation.target.classList.contains("deleted")){
						deleteThis(mutation.target);
					} else if ((mutation.attributeName == "data-a-target") && mutation && mutation.target && mutation.target.data && mutation.target.data.aTarget  && (mutation.target.data.aTarget == "chat-deleted-message-placeholder")){
						deleteThis(mutation.target);
					}
					
				} else if (mutation.type === 'childList' && mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].dataset.aTarget == "chat-deleted-message-placeholder") {
								deleteThis(mutation.addedNodes[i]);
								continue;
							} else if (mutation.addedNodes[i].querySelector('[data-a-target="chat-deleted-message-placeholder"]')) {
								deleteThis(mutation.addedNodes[i]);
								continue;
							} 
							
							if (mutation.addedNodes[i].ignore) {
								continue;
							}
							
							mutation.addedNodes[i].ignore = true;
							
							if (mutation.addedNodes[i].className && (mutation.addedNodes[i].classList.contains("seventv-message") || mutation.addedNodes[i].classList.contains("chat-line__message") || (mutation.addedNodes[i].querySelector && mutation.addedNodes[i].querySelector(".paid-pinned-chat-message-content-wrapper")))) {
								mutation.addedNodes[i].ignore = true;
								callback(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].querySelector(".chat-line__message")) {
								var ele = mutation.addedNodes[i].querySelector(".chat-line__message");
								if (ele.ignore) {
									continue;
								} else {
									ele.ignore = true;
									callback(ele);
								}
							} else if (settings.captureevents && mutation.addedNodes[i].dataset && (mutation.addedNodes[i].dataset.testSelector == "user-notice-line")) {
								processEvent(mutation.addedNodes[i]);
							} else if (settings.captureevents && mutation.addedNodes[i].className && (mutation.addedNodes[i].classList.contains("user-notice-line"))) {
								processEvent(mutation.addedNodes[i]);
							}

						} catch (e) {}
					}
				}
			});
		};

		if (document.querySelector("seventv-container")){
			var config = {
				childList: true, // Observe the addition of new child nodes
				subtree: true, // Observe the target node and its descendants
				attributes: true, // Observe attributes changes
				attributeOldValue: true, // Optionally capture the old value of the attribute
				attributeFilter: ['data-a-target', 'class'] // Only observe changes to 'is-deleted' attribute
			};

		} else {
			var config = {
				childList: true, // Observe the addition of new child nodes
				subtree: true, // Observe the target node and its descendants
				attributes: true, // Observe attributes changes
				attributeOldValue: true, // Optionally capture the old value of the attribute
				attributeFilter: ['data-a-target'] // Only observe changes to 'is-deleted' attribute
			};
		}
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

	console.log("Social Stream injected");

	var counter = 0;
	var checkElement = ".chat-list--default";
	
	var checkReady = setInterval(function() {
		counter+=1;
		
		if (counter>3){
			checkElement = ".chat-room__content";
			console.log("checkElement wasn't found; trying alternative");
		}
		if (document.querySelector(checkElement)) { // just in case 
			console.log("Social Stream Start");
			clearInterval(checkReady);
			setTimeout(function() {
				var clear = document.querySelectorAll("seventv-container, .seventv-message, .chat-line__message, .paid-pinned-chat-message-content-wrapper");
				for (var i = 0; i < clear.length; i++) {
					clear[i].ignore = true; // don't let already loaded messages to re-load.
				}
				console.log("Social Stream ready to go");
				onElementInsertedTwitch(document.querySelector(checkElement), function(element) {
					setTimeout(function(element) {
						if (element && element.isConnected){
							processMessage(element);
						}
					}, 20, element); // 20ms to give it time to load the message, rather than just the container
				});

				if (document.querySelector('[data-a-target="consent-banner-accept"]')) {
					document.querySelector('[data-a-target="consent-banner-accept"]').click();
					if (document.querySelector('.consent-banner')) {
						document.querySelector('.consent-banner').remove();
					}
				}
			}, 4500);
		}

		if (document.querySelector('[data-a-target="consent-banner-accept"]')) {
			document.querySelector('[data-a-target="consent-banner-accept"]').click();
			if (document.querySelector('.consent-banner')) {
				document.querySelector('.consent-banner').remove();
			}
		}


	}, 500);

	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function(e){
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e){};;
			remoteConnection.datachannel.onopen = function(e){};;
			remoteConnection.datachannel.onclose = function(e){};;
			setInterval(function(){
				remoteConnection.datachannel.send("KEEPALIVE")
			}, 1000);
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
		console.log(e);
	}
	
	
	
	try {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.visibilityState = "visible";
		document.mozHidden = false;
		document.webkitHidden = false;
	} catch(e){	}

	try {
		document.hasFocus = function () {return true;};
		window.onFocus = function () {return true;};
		
		Object.defineProperty(document, "mozHidden", { value : false});
		Object.defineProperty(document, "msHidden", { value : false});
		Object.defineProperty(document, "webkitHidden", { value : false});
		Object.defineProperty(document, 'visibilityState', { get: function () { return "visible"; }, value: 'visible', writable: true});
		Object.defineProperty(document, 'hidden', {value: false, writable: true});
		
		setInterval(function(){
			window.onblur = null;
			window.blurred = false;
			document.hidden = false;
			document.visibilityState = "visible";
			document.mozHidden = false;
			document.webkitHidden = false;
			document.dispatchEvent(new Event("visibilitychange"));
		},200);
	} catch(e){	}

	try {
		document.onvisibilitychange = function(){
			window.onFocus = function () {return true;};
			
		};
	} catch(e){	}

	try {
		for (event_name of ["visibilitychange",
			"webkitvisibilitychange",
			"blur", // may cause issues on some websites
			"mozvisibilitychange",
			"msvisibilitychange"]) {
				try{
					window.addEventListener(event_name, function(event) {
						event.stopImmediatePropagation();
						event.preventDefault();
					}, true);
				} catch(e){}
		}
	} catch(e){	}

})();