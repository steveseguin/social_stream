(function() {
	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"message": data
			}, function(e) {});
		} catch (e) {}
	}

	// Add this at the top of your script, outside any function
	const imageCache = new Map();

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
				return resolve(imageCache.get(url));
			}

			const checkImage = (blob, img) => {
				const isGeneric = img.naturalWidth === 32 && img.naturalHeight === 32 && blob.size >= 800 && blob.size <= 900;
				imageCache.set(url, isGeneric); // Cache the result
				resolve(isGeneric);
			};

			const fetchImage = (url) => {
				fetch(url)
					.then(response => response.blob())
					.then(blob => {
						const img = new Image();
						img.onload = () => checkImage(blob, img);
						img.onerror = () => {
							imageCache.set(url, false); // Cache as non-generic on error
							reject(new Error('Failed to load image'));
						};
						img.src = URL.createObjectURL(blob);
					})
					.catch(() => {
						imageCache.set(url, false); // Cache as non-generic on fetch error
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
	
	var dupCheck2 = [];
	var isExtensionOn = true;
	
	function sleep(ms) {
	  return new Promise(resolve => setTimeout(resolve, ms));
	}

	function getFacebookType() {
		if (window.location.href.includes("workplace.com")){
			return "workplace";
		}
		return "facebook";
	}

	function cleanFacebookText(text) {
		return (text || "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim();
	}

	function getNodeImageSource(node) {
		if (!node) {
			return "";
		}
		try {
			var image = node.querySelector("image");
			if (image) {
				image.skip = true;
				return image.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || "";
			}
		} catch (e) {}
		try {
			var img = node.querySelector("img[src]");
			if (img) {
				img.skip = true;
				return img.src || "";
			}
		} catch (e) {}
		return "";
	}

	function getFacebookMContainerMessageNode(ele) {
		try {
			var nodes = ele.querySelectorAll("[role='button'][aria-label*='interact with this comment'] [dir='auto']");
			for (var i = 0; i < nodes.length; i++) {
				if (cleanFacebookText(nodes[i].textContent)) {
					return nodes[i];
				}
			}
		} catch (e) {}
		return null;
	}

	function getFacebookMContainerName(ele) {
		try {
			var profileButton = ele.querySelector("[aria-label^='Profile, ']");
			if (profileButton && profileButton.ariaLabel) {
				return escapeHtml(cleanFacebookText(profileButton.ariaLabel.replace(/^Profile,\s*/i, "")));
			}
		} catch (e) {}
		try {
			var nameNodes = ele.querySelectorAll("[aria-hidden='true'] [dir='auto']");
			for (var i = 0; i < nameNodes.length; i++) {
				var value = cleanFacebookText(nameNodes[i].textContent);
				if (value && (value !== "Top fan") && (value !== "Subscriber")) {
					return escapeHtml(value);
				}
			}
		} catch (e) {}
		return "";
	}

	function getFacebookMContainerMembership(ele) {
		try {
			var textNodes = ele.querySelectorAll("[dir='auto']");
			for (var i = 0; i < textNodes.length; i++) {
				var value = cleanFacebookText(textNodes[i].textContent);
				if ((value === "Top fan") || (value === "Subscriber")) {
					return escapeHtml(value);
				}
			}
		} catch (e) {}
		return "";
	}

	function getFacebookMContainerDonation(ele) {
		try {
			var textNodes = ele.querySelectorAll("[dir='auto']");
			for (var i = 0; i < textNodes.length; i++) {
				var value = cleanFacebookText(textNodes[i].textContent);
				var match = value.match(/^Sent\s+(\d+)\s+Stars?$/i);
				if (match) {
					if (parseInt(match[1], 10) === 1) {
						return "1 Star";
					}
					return match[1] + " Stars";
				}
			}
		} catch (e) {}
		return "";
	}

	function isFacebookMContainerComment(ele) {
		if (!ele || !ele.matches || ele.matches("[role='article']")) {
			return false;
		}
		if (!ele.matches("div[data-tracking-duration-id][data-long-click-action-id][data-type='container'][data-mcomponent='MContainer']")) {
			return false;
		}
		if (!ele.querySelector("[aria-label^='Profile, ']")) {
			return false;
		}
		if (getFacebookMContainerMessageNode(ele)) {
			return true;
		}
		if (getFacebookMContainerDonation(ele)) {
			return true;
		}
		return false;
	}

	function getFacebookElementKey(ele) {
		if (!ele) {
			return "";
		}
		if (ele.id && !ele.id.startsWith("client:")) {
			return ele.id;
		}
		if (ele.parentNode && ele.parentNode.id && !ele.parentNode.id.startsWith("client:")) {
			return ele.parentNode.id;
		}
		if (isFacebookMContainerComment(ele)) {
			var parts = [];
			if (ele.dataset.trackingDurationId) {
				parts.push(ele.dataset.trackingDurationId);
			}
			if (ele.dataset.compId) {
				parts.push(ele.dataset.compId);
			}
			if (ele.dataset.longClickActionId) {
				parts.push(ele.dataset.longClickActionId);
			}
			if (parts.length) {
				return "mcontainer:" + parts.join(":");
			}
		}
		try {
			var idNode = ele.querySelector("[id]");
			if (idNode && idNode.id) {
				return idNode.id;
			}
		} catch (e) {}
		return "";
	}

	function getFacebookArticleName(ele) {
		try {
			var nameElement = ele.childNodes[1].childNodes[0].querySelectorAll('span[dir="auto"]')[0];
			return cleanFacebookText(nameElement ? nameElement.innerText : "");
		} catch (e) {}
		try {
			var nameLink = ele.childNodes[1].childNodes[0].querySelector('a[role="link"]');
			return cleanFacebookText(nameLink ? nameLink.innerText : "");
		} catch (e) {}
		return "";
	}

	function getFacebookArticleMessageText(ele) {
		var msg = "";
		try {
			var msgNodes = ele.childNodes[1].childNodes[0].querySelectorAll('span[dir="auto"]');
			if (msgNodes && msgNodes.length) {
				msg = cleanFacebookText(msgNodes[msgNodes.length - 1].textContent);
			}
		} catch (e) {}
		if (!msg) {
			try {
				var listNode = ele.querySelector("ul > li");
				if (listNode && listNode.parentNode && listNode.parentNode.parentNode) {
					msg = cleanFacebookText(listNode.parentNode.parentNode.textContent);
				}
			} catch (e) {}
		}
		return msg;
	}

	function getFacebookArticleContentImage(ele) {
		try {
			var contentImage = ele.querySelector('div>div>div>div>div>div>div>img[draggable="false"][width][height][class][src]');
			return contentImage ? (contentImage.src || "") : "";
		} catch (e) {}
		return "";
	}

	function getFacebookElementSignature(ele, messageKey) {
		if (!ele) {
			return "";
		}
		if (isFacebookMContainerComment(ele)) {
			var mName = cleanFacebookText(getFacebookMContainerName(ele));
			var msgNode = getFacebookMContainerMessageNode(ele);
			var mMsg = cleanFacebookText(msgNode ? msgNode.textContent : "");
			var mDonation = cleanFacebookText(getFacebookMContainerDonation(ele));
			var mMembership = cleanFacebookText(getFacebookMContainerMembership(ele));
			if (!mName && !mMsg && !mDonation && !mMembership) {
				return "";
			}
			return [messageKey || "", mName, mMsg, mDonation, mMembership].join("|");
		}
		var name = getFacebookArticleName(ele);
		var msg = getFacebookArticleMessageText(ele);
		var contentimg = msg ? "" : getFacebookArticleContentImage(ele);
		if (!name && !msg && !contentimg) {
			return "";
		}
		return [messageKey || "", name, msg, contentimg].join("|");
	}

	function pushProcessedFacebookMessage(data, dupMessage) {
		var entry = data.chatname + "+" + data.hasDonation + "+" + (dupMessage || "");
		var entryString = JSON.stringify(entry);

		if (!dupCheck2.includes(entryString)) {
			dupCheck2.push(entryString);
			
			setTimeout(() => {
				const index = dupCheck2.indexOf(entryString);
				if (index > -1) {
					dupCheck2.splice(index, 1);
				}
			}, 15000);
		} else {
			return;
		}
		
		pushMessage(data);
	}

	function processMContainerMessage(ele) {
		var msgElement = getFacebookMContainerMessageNode(ele);
		var msg = "";
		if (msgElement) {
			msg = getAllContentNodes(msgElement);
			msg = msg.trim();
		}
		
		var hasDonation = getFacebookMContainerDonation(ele);
		if (!msg && !hasDonation) {
			return false;
		}
		
		var data = {};
		data.chatname = getFacebookMContainerName(ele);
		if (!data.chatname) {
			return false;
		}
		data.chatbadges = [];
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = getNodeImageSource(ele.querySelector("[aria-label^='Profile, ']") || ele);
		data.hasDonation = hasDonation;
		data.membership = getFacebookMContainerMembership(ele);
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = getFacebookType();
		
		pushProcessedFacebookMessage(data, msg || hasDonation);
		return true;
	}

	async function processMessage(ele) {
		if (ele == window) {
			return;
		}
		
		if (isFacebookMContainerComment(ele)) {
			if (!processMContainerMessage(ele) && ele.isConnected) {
				delete ele.dataset.set123;
			}
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
		if (!msg){
			try {
				contentimg = ele.querySelector('div>div>div>div>div>div>div>img[draggable="false"][width][height][class][src]').src;
				//msg = "<img src='"+msg+"' />";
			} catch(e){
				//console.log("5");
				return;
			}
		}
		
		if (!msg && !contentimg){return;}

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
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		
		if (replyMessage){
			data.initial = replyMessage;
		}
		if (originalMessage){
			data.reply = originalMessage;
		}
		data.type = getFacebookType();
		
		pushProcessedFacebookMessage(data, dupMessage);
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
		dupCheck = dupCheck.slice(-120); // Track recent row signatures so recycled DOM rows can emit new messages.
		
		if (lastURL !== window.location.href){
			lastURL = window.location.href;
			processed = 0;
		}  else {
			processed += 1;
		}
		try {
			if (window.location.href.includes("/live/producer/") || window.location.href.endsWith("/videos") || window.location.href.includes("/videos/") || window.location.href.includes("?v=") || window.location.href.includes("/watch/live/")) {
				var main = document.querySelectorAll("[role='article'], div[data-tracking-duration-id][data-long-click-action-id][data-type='container'][data-mcomponent='MContainer']");
				for (var j = 0; j < main.length; j++) {
					try {
						if (!main[j].matches("[role='article']") && !isFacebookMContainerComment(main[j])) {
							main[j].dataset.set123 = "skip";
							continue;
						}
						var messageKey = getFacebookElementKey(main[j]);
						var messageSignature = getFacebookElementSignature(main[j], messageKey);
						if (!messageSignature) {
							delete main[j].dataset.set123;
							continue;
						}
						if (main[j].dataset.set123 === messageSignature) {
							continue;
						}
						main[j].dataset.set123 = messageSignature;
						if (processed>3){
							if (dupCheck.includes(messageSignature)) {
								continue;
							}
							dupCheck.push(messageSignature);
							processMessage(main[j]);
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
	try {
		var receiveChannelCallback = function(event) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e) {};;
			remoteConnection.datachannel.onopen = function(e) {};;
			remoteConnection.datachannel.onclose = function(e) {};;
			setInterval(function() {
				if (document.hidden) { // only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE")
				}
			}, 800);
		}
		var errorHandle = function(e) {}
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
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


})();
