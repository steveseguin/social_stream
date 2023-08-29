(function () {
	
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		var reader = new FileReader();
		reader.onloadend = function() {
		  callback(reader.result);
		}
		reader.readAsDataURL(xhr.response);
	  };
	  xhr.open('GET', url);
	  xhr.responseType = 'blob';
	  xhr.send();
	}
	
	//var channelName = "";
	
	function getTranslation(key, value=false){
		if (settings.translation && settings.translation.innerHTML && (key in settings.translation.innerHTML)){ // these are the proper translations
			return settings.translation.innerHTML[key];
		} else if (settings.translation.miscellaneous && settings.translation.miscellaneous && (key in settings.translation.miscellaneous)){ 
			return settings.translation.miscellaneous[key];
		} else if (value!==false){
			return value;
		} else {
			return key.replaceAll("-", " "); //
		}
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
	
	// escapeHtml
	// settings.textonlymode
	
	var messageHistory = [];
	
	function getAllContentNodes(element) {
		var resp = "";
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent.trim())+"";
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					resp += node.outerHTML;
				}
			} 
		});
		return resp;
	}
	
	function processMessage(ele, wss=true){
		if (ele.hasAttribute("is-deleted")) {
			//console.log("Message is deleted already");
			return;
		}

		if (settings.customyoutubestate) {
			return;
		}
		try {
			if (ele.skip){
				return;
			} else if (ele.id && messageHistory.includes(ele.id)) {
				//console.log("Message already exists");
				return;
			} else if (ele.id) {
				messageHistory.push(ele.id);
				messageHistory = messageHistory.slice(-400);
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
		var memeber = false;
		var mod = false;

		var srcImg = ""; // what shows up as the source image; blank is default (dock decides).

		try {
			var nameElement = ele.querySelector("#author-name");
			chatname = escapeHtml(nameElement.innerText);

			if (!settings.nosubcolor) {
				if (nameElement.classList.contains("member")) {
					nameColor = "#107516";
					memeber = true;
				} else if (nameElement.classList.contains("moderator")) {
					nameColor = "#5f84f1";
					mod = true;
				}
			}

		} catch (e) {}

		try {
			var BTT = ele.querySelectorAll('.bttv-tooltip');
			for (var i = 0; i < BTT.length; i++) {
				BTT[i].outerHTML = "";
			}
		} catch (e) {}

		if (!settings.textonlymode) {
			try {
				chatmessage = getAllContentNodes(ele.querySelector("#message, .seventv-yt-message-content"));
			} catch (e) {}
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
			} catch (e) {}
		}

		try {
			chatimg = ele.querySelector("#img").src;
			if (chatimg.startsWith("data:image/gif;base64")) { // document.querySelector("#panel-pages").querySelector("#img").src
				chatimg = document.querySelector("#panel-pages").querySelector("#img").src; // this is the owner
			}
		} catch (e) {}

		var chatdonation = "";
		try {
			chatdonation = escapeHtml(ele.querySelector("#purchase-amount").innerText);
		} catch (e) {}

		var chatmembership = "";
		try {
			chatmembership = ele.querySelector(".yt-live-chat-membership-item-renderer #header-subtext").innerHTML;
		} catch (e) {}



		var chatsticker = "";
		try {
			chatsticker = ele.querySelector(".yt-live-chat-paid-sticker-renderer #sticker>#img").src;
		} catch (e) {}

		if (chatsticker) {
			chatdonation = escapeHtml(ele.querySelector("#purchase-amount-chip").innerText);
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


		var hasDonation = '';
		if (chatdonation) {
			hasDonation = chatdonation
		}

		var hasMembership = '';
		var giftedmemembership = ele.querySelector("#primary-text.ytd-sponsorships-live-chat-header-renderer");

		if (chatmembership) {
			if (chatmessage) {
				hasMembership = '<div data-translate="member-chat" class="donation membership">'+getTranslation("member-chat", "MEMBERSHIP")+'</div>';
			} else if (giftedmemembership) {
				hasMembership = '<div data-translate="sponsorship" class="donation membership">'+getTranslation("sponsorship", "SPONSORSHIP")+'</div>';
				if (!settings.textonlymode) {
					chatmessage = "<i>" + giftedmemembership.innerHTML + "</i>";
				} else {
					chatmessage = giftedmemembership.textContent;
				}
			} else {
				hasMembership = '<div data-translate="new-member" class="donation membership">'+getTranslation("new-member", "NEW MEMBER!")+'</div>';
				chatmessage = "<i>" + chatmembership + "</i>";
			}
		} else if (!chatmessage && giftedmemembership) {
			if (!settings.textonlymode) {
				chatmessage = "<i>" + giftedmemembership.innerHTML + "</i>";
			} else {
				chatmessage = giftedmemembership.textContent;
			}
			hasMembership = '<div data-translate="sponsorship" class="donation membership">'+getTranslation("sponsorship", "SPONSORSHIP")+'</div>';
			// } else if (memeber){
			//	  hasMembership = '<div class="membership">MEMEBER</div>'; // Just looks too green, and doesn't highlight those using special member options.
			// } else if (mod){
			//	  hasMembership = '<div class="membership">MODERATOR</div>';
		}

		if (chatsticker) {
			if (!settings.textonlymode) {
				chatmessage = '<img class="supersticker" src="' + chatsticker + '">';
			}
		}

		var backgroundColor = "";

		var textColor = "";
		if (ele.style.getPropertyValue('--yt-live-chat-paid-message-primary-color')) {
			backgroundColor = "background-color: " + ele.style.getPropertyValue('--yt-live-chat-paid-message-primary-color') + ";";
			textColor = "color: #111;";
		}

		if (ele.style.getPropertyValue('--yt-live-chat-sponsor-color')) {
			backgroundColor = "background-color: " + ele.style.getPropertyValue('--yt-live-chat-sponsor-color') + ";";
			textColor = "color: #111;";
		}

		srcImg = document.querySelector("#input-panel");
		if (srcImg) {
			srcImg = srcImg.querySelector("#img");
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

		var data = {};
		data.chatname = chatname;
		data.nameColor = nameColor;
		data.chatbadges = chatbadges;
		data.backgroundColor = backgroundColor;
		data.textColor = textColor;
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.hasMembership = hasMembership;
		data.textonly = settings.textonlymode || false;
		data.type = "youtube";
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"message": data
			}, function() {});
		} catch(e){
		}
		
	}
	
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector("div#input").focus();
					sendResponse(true);
					return;
				} 
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					}
				}
				
			} catch(e){}
			sendResponse(false);
		}
	);
	
	var settings = {};
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try{
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
								callback(mutation.addedNodes[i]);
							} else {
								//console.error("unknown: "+mutation.addedNodes[i].tagName);
							}
						} catch(e){}
					}
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

    console.log("Social stream inserted");
	
	// document.body.querySelector("#chat-messages").querySelectorAll("yt-live-chat-text-message-renderer")
	
	var checkTimer = setInterval(function(){
		var ele = document.querySelector("yt-live-chat-app");
		if (ele){
			clearInterval(checkTimer);
			var cleared = false;
			document.querySelectorAll("yt-live-chat-text-message-renderer").forEach(ele4=>{
				cleared = true;
				ele4.skip = true;
				if (ele4.id){
					messageHistory.push(ele4.id);
				}
			});
			
			if (cleared){
				onElementInserted(ele, function(ele2){
					setTimeout(function(ele2){processMessage(ele2, false)}, 200, ele2);
				});
			} else {
				setTimeout(function(){
					onElementInserted(document.querySelector("yt-live-chat-app"), function(ele2){
						setTimeout(function(ele2){processMessage(ele2, false)}, 200, ele2);
					});
				},1000);
			}
		}
	}, 1000);

	if (window.location.href.includes("youtube.com/watch")){
		var checkTimer2 = setInterval(function(){
			var ele = document.querySelector('iframe').contentWindow.document.body.querySelector("#chat-messages");
			if (ele){
				clearInterval(checkTimer2);
				var cleared = false;
				try {
					ele.querySelectorAll("yt-live-chat-text-message-renderer").forEach(ele4=>{
						ele4.skip = true;
						cleared = true;
						if (ele4.id){
							messageHistory.push(ele4.id);
						}
					});
				} catch(e){}
				if (cleared){
					onElementInserted(ele, function(ele2){
						 setTimeout(function(ele2){processMessage(ele2, false)}, 200, ele2);
					});
				} else {
					setTimeout(function(){
						onElementInserted(document.querySelector('iframe').contentWindow.document.body.querySelector("#chat-messages"), function(ele2){
							 setTimeout(function(ele2){processMessage(ele2, false)}, 200, ele2);
						});
					},1000);
				}
			}
		},3000);
	}
	
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
		console.log(e);
	}
	
	
})();