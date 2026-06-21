(function() {
	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"message": data
			}, function(e) {});
		} catch (e) {}
	}

	// Cache avatar classification results, but keep it bounded on long sessions.
	const imageCache = new Map();
	const MAX_IMAGE_CACHE_ENTRIES = 250;

	function setImageCacheEntry(url, value) {
		if (!url) return;
		if (imageCache.has(url)) {
			imageCache.delete(url);
		}
		imageCache.set(url, value);
		if (imageCache.size > MAX_IMAGE_CACHE_ENTRIES) {
			const oldestKey = imageCache.keys().next().value;
			if (oldestKey) {
				imageCache.delete(oldestKey);
			}
		}
	}

	function getImageInfo(imgOrUrl) {
		return new Promise((resolve, reject) => {
			let url;
			if (imgOrUrl instanceof SVGImageElement) {
				url = imgOrUrl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
			} else if (typeof imgOrUrl === 'string') {
				url = imgOrUrl;
			} else {
				return reject(new Error('Invalid input'));
			}

			// Check if the image URL is already in the cache
			if (imageCache.has(url)) {
				const cachedValue = imageCache.get(url);
				imageCache.delete(url);
				imageCache.set(url, cachedValue);
				return resolve(cachedValue);
			}

			const checkImage = (blob, img) => {
				const isGeneric = img.naturalWidth === 32 && img.naturalHeight === 32 && blob.size >= 800 && blob.size <= 900;
				setImageCacheEntry(url, isGeneric);
				resolve(isGeneric);
			};

			const fetchImage = (url) => {
				fetch(url)
					.then(response => response.blob())
					.then(blob => {
						const img = new Image();
						const objectUrl = URL.createObjectURL(blob);
						const cleanupObjectUrl = () => {
							try {
								URL.revokeObjectURL(objectUrl);
							} catch (e) {}
							img.onload = null;
							img.onerror = null;
						};
						img.onload = () => {
							try {
								checkImage(blob, img);
							} finally {
								cleanupObjectUrl();
							}
						};
						img.onerror = () => {
							cleanupObjectUrl();
							setImageCacheEntry(url, false);
							reject(new Error('Failed to load image'));
						};
						img.src = objectUrl;
					})
					.catch(() => {
						setImageCacheEntry(url, false);
						reject(new Error('Failed to fetch image'));
					});
			};

			fetchImage(url);
		});
	}
	
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


	function isEmoji(char) {
		const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
		return emojiRegex.test(char);
	}
	
	function getAllContentNodes(element, textonly=false) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		if (element.ariaLabel){return "";} // this implies we're on the wrong path.
		
		if (element.skip){return "";}
		
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node, textonly)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				node.skip = true; // facebook specific need
				if (!settings.textonlymode && !textonly){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
						node.removeAttribute("width");
						node.removeAttribute("height");
					}
					resp += node.outerHTML;
				} else if (node.nodeName == "IMG"){
					if (node.alt && isEmoji(node.alt)){
						resp += escapeHtml(node.alt);
					}
				}
			}
		});
		return resp;
	}

	function normalizeFacebookText(value) {
		return (value || "").replace(/\s+/g, " ").trim();
	}

	function urlParamEnabled(name) {
		try {
			var params = new URLSearchParams(window.location.search || "");
			if (!params.has(name)) {
				return false;
			}
			var value = (params.get(name) || "").toLowerCase();
			return value !== "0" && value !== "false" && value !== "off";
		} catch (e) {
			return false;
		}
	}

	function parseFacebookStars(ele) {
		var rawText = "";
		try {
			rawText = normalizeFacebookText(ele.innerText || ele.textContent || "");
		} catch (e) {}
		if (!rawText) {
			return null;
		}
		var match = rawText.match(/(?:^|\s)(\d[\d,.]*)\s+sent(?:\s|$)/i);
		if (!match) {
			return null;
		}
		var amount = parseInt(match[1].replace(/[^\d]/g, ""), 10);
		if (!amount) {
			return null;
		}
		return {
			amount: amount,
			text: amount + " Stars"
		};
	}

	function isFacebookHighlightedMessage(ele) {
		var nodes = [];
		try {
			nodes = ele.querySelectorAll("span, div");
		} catch (e) {}
		for (var i = 0; i < nodes.length; i++) {
			var text = "";
			try {
				text = normalizeFacebookText(nodes[i].innerText || nodes[i].textContent || "");
			} catch (e) {}
			if (text.toUpperCase() === "HIGHLIGHTED") {
				return true;
			}
		}
		return false;
	}

	function extractFacebookStarsMessage(ele, name, currentMsg) {
		var currentText = normalizeFacebookText(currentMsg ? currentMsg.replace(/<[^>]*>/g, " ") : "");
		var nameText = normalizeFacebookText(name);
		var noisePattern = /(\d[\d,.]*\s+sent)|(^\d+\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)$)|(^\d+[smhd]$)|^(Like|React|Reply|See Thread|Hide or report this|HIGHLIGHTED)$|^Replying to |^Send \d[\d,.]* Stars?$/i;
		if (currentText && currentText !== nameText && !noisePattern.test(currentText)) {
			return currentMsg;
		}
		var nodes = [];
		try {
			nodes = ele.querySelectorAll('span[dir="auto"], div[dir="auto"]');
		} catch (e) {}
		var bestNode = null;
		var bestText = "";
		for (var i = 0; i < nodes.length; i++) {
			var text = "";
			try {
				text = normalizeFacebookText(nodes[i].innerText || nodes[i].textContent || "");
			} catch (e) {}
			if (!text || text === nameText || noisePattern.test(text)) {
				continue;
			}
			if (text.length > bestText.length) {
				bestText = text;
				bestNode = nodes[i];
			}
		}
		if (!bestNode) {
			return currentMsg || "";
		}
		var message = getAllContentNodes(bestNode);
		return message || escapeHtml(bestText);
	}
	
	var dupCheck2 = [];
	var isExtensionOn = true;
	
	function sleep(ms) {
	  return new Promise(resolve => setTimeout(resolve, ms));
	}

	async function processMessage(ele) {
		if (ele == window) {
			return;
		}
		
		var chatimg = "";
		
		var test = ele.querySelectorAll("div[dir='auto'] > div[role='button'][tabindex='0']")
		if (test.length ===1){
			try {
				test[0].click();
				await sleep(100);
			}catch(e){}
		}
		if (!ele.isConnected){
			delete ele.dataset.set123;
			//console.log("1");
			return;}
		try {
			var imgele = ele.childNodes[0].querySelector("image");//.href.baseVal; // xlink:href
			imgele.skip = true;
			
			chatimg = imgele.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
			if (chatimg.includes("32x32")) {
				try {
					let isGeneric = await getImageInfo(chatimg);
					if (!ele.isConnected){
						delete ele.dataset.set123;
						//console.log("2");
						return;}
					if (isGeneric){
						await sleep(200);
						if (!ele.isConnected){
							//console.log("3");
							delete ele.dataset.set123;
							return;}
						await sleep(200);
						if (!ele.isConnected){
							//console.log("4");
							delete ele.dataset.set123;
							return;}
						var imgele = ele.childNodes[0].querySelector("image");
						chatimg = imgele.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
					}
				} catch(e){
					//console.log(e);
				}
			}
		} catch (e) {
		}
		var name = "";
		try {
			var nameElement = ele.childNodes[1].childNodes[0].querySelectorAll('span[dir="auto"]')[0];
			nameElement.skip = true;
			name = escapeHtml(nameElement.innerText);
			
		} catch (e) {
			try {
				name = escapeHtml(ele.childNodes[1].childNodes[0].querySelector('a[role="link"]').innerText);
			} catch (e) {
				return;
			}
		}

		var starsInfo = parseFacebookStars(ele);
		var highlightedMessage = !starsInfo && isFacebookHighlightedMessage(ele);

		var msg = "";
		
		var msgElement = "";
		
		try {
			msgElement = ele.childNodes[1].childNodes[0].querySelectorAll('span[dir="auto"]');
			msgElement = msgElement[msgElement.length -1];
			msg = getAllContentNodes(msgElement);
		} catch(e){}


		if (!msg){
			if (!settings.textonlymode){
				try {
					msgElement = ele.querySelector("ul > li").parentNode.parentNode;
					msgElement.skip = true;
					if (msgElement.nextSibling){msgElement.nextSibling.skip = true;}
					msg = getAllContentNodes(msgElement.parentNode);
				}catch(e){}
			}
		}
		
		if (msg) {
			msg = msg.trim();
			if (name) {
				if (msg.startsWith(name)) {
					msg = msg.replace(name, '');
					msg = msg.trim();
				}
			}
		}

		if (starsInfo) {
			msg = extractFacebookStarsMessage(ele, name, msg);
			if (msg) {
				msg = msg.trim();
			}
		}
		if (highlightedMessage && normalizeFacebookText(msg ? msg.replace(/<[^>]*>/g, " ") : "").toUpperCase() === "HIGHLIGHTED") {
			msg = "";
		}
		
		var dupMessage = msg; // I dont want to include original replies in the dup check; just the message.
		var originalMessage = "";
		var replyMessage = "";
		
		try {
			if (!settings.excludeReplyingTo && msg && ele.previousSibling) {
				replyMessage = getAllContentNodes(ele.previousSibling.querySelector("div>div>span>span"), true);
				if (replyMessage) {
					originalMessage = msg;
					if (settings.textonlymode) {
						msg = replyMessage + ": " + msg;
					} else {
						msg = "<i><small>" + replyMessage + ":&nbsp;</small></i> " + msg;
					}
				}
			}
		} catch (e) {}
		
		var contentimg = "";
		if (!msg && !starsInfo && !highlightedMessage){
			try {
				contentimg = ele.querySelector('div>div>div>div>div>div>div>img[draggable="false"][width][height][class][src]').src;
				//msg = "<img src='"+msg+"' />";
			} catch(e){
				//console.log("5");
				return;
			}
		}
		
		if (!msg && !contentimg && !starsInfo && !highlightedMessage){return;}

		var badges = [];	// we do badges last, as we have already marked images as used in the msg step, so less likely of confusing baddges with images
		try {
			ele.childNodes[1].childNodes[0].querySelectorAll('div[aria-label] img[src][alt]').forEach(img=>{
				if (img.skip){return;}
				if (msgElement.contains(img)){return;} // just in case skip fails
				if (!img.src.startsWith("data:image/svg+xml,")){
					badges.push(img.src);
					img.skip = true;
				}
			});
		} catch (e) {
		}

		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = starsInfo ? starsInfo.text : "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		if (highlightedMessage) {
			data.event = "community_highlight";
			data.highlightColor = "#fff387";
		}
		
		if (replyMessage){
			data.initial = replyMessage;
		}
		if (originalMessage){
			data.reply = originalMessage;
		}
		if (window.location.href.includes("workplace.com")){
			data.type = "workplace";
		} else {
			data.type = "facebook";
		}
		
		
		var facebookRowId = "";
		if (starsInfo) {
			try {
				facebookRowId = ele.id || (ele.parentNode && ele.parentNode.id) || "";
			} catch (e) {}
		}
		var entry = starsInfo && facebookRowId ? data.type + "+stars+" + facebookRowId : data.chatname + "+" + data.hasDonation + "+" + dupMessage;
		var entryString = JSON.stringify(entry);

		if (!dupCheck2.includes(entryString)) {
			dupCheck2.push(entryString);
			
			setTimeout(() => {
				const index = dupCheck2.indexOf(entryString);
				if (index > -1) {
					dupCheck2.splice(index, 1);
				}
			}, 15000);

			//console.log(data);
		} else {
			return;
		}
	//	console.log([...dupCheck2]);
		
		//console.warn(data);
		pushMessage(data);
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			try {
				if ("getSource" == request){sendResponse("facebook");	return;	}
				if ("focusChat" == request) {
					
					if (document.querySelectorAll('div[role="textbox"][contenteditable="true"] p').length){
						var eles = document.querySelectorAll('div[role="textbox"][contenteditable="true"] > p');
					} else {
						var eles = document.querySelectorAll('div[contenteditable="true"] div[data-editor]>div[data-offset-key]');
					}
					if (eles.length) {
						var i = eles.length-1;
						while (i>=0){
							try {
								eles[i].focus();
								eles[i].focus();
								eles[i].click();
								eles[i].focus();
								break;
							} catch (e) {}
							i--;
						}
					} else if (document.querySelector('div.notranslate[contenteditable="true"] > p')){
						document.querySelector('div.notranslate[contenteditable="true"] > p').focus();
						document.querySelector('div.notranslate[contenteditable="true"] > p').focus();
						document.querySelector('div.notranslate[contenteditable="true"] > p').click();
						document.querySelector('div.notranslate[contenteditable="true"] > p').focus();
					} else if (document.querySelector("div[data-editor]>[data-offset-key]")) {
						document.querySelector("div[data-editor]>[data-offset-key]").focus();
						document.querySelector("div[data-editor]>[data-offset-key]").focus();
						document.querySelector("div[data-editor]>[data-offset-key]").click();
						document.querySelector("div[data-editor]>[data-offset-key]").focus();
					} else {
						sendResponse(true);
						return;
					}
					sendResponse(true);
					return;
				}
				
				if (typeof request === "object"){
					if ("state" in request) {
						isExtensionOn = request.state;
					}
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					}
				}
			} catch (e) {}

			sendResponse(false);
		}
	);

	var dupCheck = [];
	
	
	var lastURL = "";
	var processed = 0;
	var replayExistingMessages = urlParamEnabled("ssnreplay");
	
	console.log("LOADED SocialStream EXTENSION");
	
	var eles = document.querySelectorAll('div[contenteditable="true"] div[data-editor]>div[data-offset-key]');
	if (eles.length) {
		var i = eles.length-1;
		while (i>=0){
			try {
				eles[i].focus();
			} catch (e) {}
			i--;
		}
	}
	
	var counter=0;
	
	var ttt = setInterval(function() {
		dupCheck = dupCheck.slice(-60); // facebook seems to keep around 40 messages, so this is overkill?
		
		if (lastURL !== window.location.href){
			lastURL = window.location.href;
			processed = 0;
			replayExistingMessages = urlParamEnabled("ssnreplay");
		}  else {
			processed += 1;
		}
		try {
			if (window.location.href.includes("/live/producer/") || window.location.href.endsWith("/videos") || window.location.href.includes("/videos/") || window.location.href.includes("?v=") || window.location.href.includes("/watch/live/")) {
				var main = document.querySelectorAll("[role='article']");
				for (var j = 0; j < main.length; j++) {
					try {
						if (!main[j].dataset.set123) {
							main[j].dataset.set123 = "true";
							if (main[j].id){
								if (main[j].id.startsWith("client:")) {
									continue;
								}
								if (dupCheck.includes(main[j].id)) {
									continue;
								}
								dupCheck.push(main[j].id);
								if (processed>3 || replayExistingMessages){
									processMessage(main[j]);
								}
							} else if (main[j].parentNode && main[j].parentNode.id) {
								if (dupCheck.includes(main[j].parentNode.id)){
									continue;
								}
								if (main[j].parentNode.id.startsWith("client:")) {
									continue;
								}
								dupCheck.push(main[j].parentNode.id);
								if (processed>3 || replayExistingMessages){
									processMessage(main[j]);
								}
							} else if (main[j].parentNode && !main[j].id && !main[j].parentNode.id) {
								var id = main[j].querySelector("[id]"); // an archived video
								if (id && !(dupCheck.includes(id))) {
									dupCheck.push(id);
									if (processed>3 || replayExistingMessages){
										processMessage(main[j]);
									}
								}
							}
						}
					} catch (e) {}
				}
			}
		} catch (e) {console.error(e);}
		
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			
			if (counter%10==0){
				try {
					
					var viewerCount = document.querySelector("[data-instancekey] [role='img'][aria-label]>span[dir='auto']:not([hidden]):not(:has([hidden])):not(:is([hidden] *))");
					
					if (!viewerCount){
						viewerCount = document.querySelector("svg [d='M4.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z'").parentNode.parentNode.parentNode.parentNode.nextSibling.querySelector("div div span")
					}
					
					if (viewerCount && viewerCount.textContent.trim().length){
						if (viewerCount.textContent == parseInt(viewerCount.textContent)){
							
							chrome.runtime.sendMessage(
								chrome.runtime.id,
								({message:{
										type: 'facebook',
										event: 'viewer_update',
										meta: parseInt(viewerCount.textContent)
									}
								}),
								function (e) {}
							);
						}
					}
				} catch(e){}
			}
			counter+=1;
		}

	}, 800);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	var keepAliveInterval = null;
	var localConnection = null;
	var remoteConnection = null;
	try {
		var receiveChannelCallback = function(event) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e) {};;
			remoteConnection.datachannel.onopen = function(e) {};;
			remoteConnection.datachannel.onclose = function(e) {};;
			keepAliveInterval = setInterval(function() {
				if (document.hidden) { // only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE")
				}
			}, 800);
		}
		var errorHandle = function(e) {}
		localConnection = new RTCPeerConnection();
		remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = (e) => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function(e) {
			localConnection.sendChannel.send("CONNECTED");
		};
		localConnection.sendChannel.onclose = function(e) {};
		localConnection.sendChannel.onmessage = function(e) {};
		localConnection.createOffer()
			.then((offer) => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then((answer) => remoteConnection.setLocalDescription(answer))
			.then(() => {
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch (e) {
		console.log(e);
	}

	function cleanupFacebookResources() {
		if (ttt) {
			clearInterval(ttt);
			ttt = null;
		}
		if (keepAliveInterval) {
			clearInterval(keepAliveInterval);
			keepAliveInterval = null;
		}
		try {
			if (localConnection && localConnection.sendChannel) {
				localConnection.sendChannel.onopen = null;
				localConnection.sendChannel.onclose = null;
				localConnection.sendChannel.onmessage = null;
				localConnection.sendChannel.close();
			}
		} catch (e) {}
		try {
			if (remoteConnection && remoteConnection.datachannel) {
				remoteConnection.datachannel.onopen = null;
				remoteConnection.datachannel.onclose = null;
				remoteConnection.datachannel.onmessage = null;
				remoteConnection.datachannel.close();
			}
		} catch (e) {}
		try {
			if (localConnection) {
				localConnection.close();
			}
		} catch (e) {}
		try {
			if (remoteConnection) {
				remoteConnection.close();
			}
		} catch (e) {}
		localConnection = null;
		remoteConnection = null;
		imageCache.clear();
	}

	window.addEventListener('beforeunload', cleanupFacebookResources, { once: true });
	window.addEventListener('pagehide', cleanupFacebookResources, { once: true });


})();
