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
	
	var messageHistory = [];
	
	function processMessage(ele, wss=true){
		  if(ele.hasAttribute("is-deleted")) {
			return;
		  }
		  
		  if (settings.customyoutubestate){
			  return;
		  }
		  
		  
		  if (ele.id && messageHistory.includes(ele.id)){
			  return;
		  } else if (ele.id){
			  messageHistory.push(ele.id);
			  messageHistory = messageHistory.slice(-200);
		  }
		  if (ele.querySelector("[in-banner]")){
			  return;
		  }
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
		  
		  try{
			var nameElement = ele.querySelector("#author-name");
			chatname = nameElement.innerText;
			
			if (!settings.nosubcolor){
				if (nameElement.classList.contains("member")){
					nameColor = "#107516";
					memeber = true;
				} else if (nameElement.classList.contains("moderator")){
					nameColor = "#5f84f1";
					mod = true;
				}
			}
			
		  } catch(e){}
		  
		   try {
			var BTT = ele.querySelectorAll('.bttv-tooltip');
			for (var i=0;i<BTT.length;i++){
				BTT[i].outerHTML = "";
			}
		  } catch(e){}
	  
		  if (!settings.textonlymode){
			  try{
				chatmessage = ele.querySelector("#message, .seventv-yt-message-content").innerHTML;
			  } catch(e){}
		  } else {
			  try{
				var cloned = ele.querySelector("#message, .seventv-yt-message-content").cloneNode(true);
				//var children = cloned.querySelectorAll("[alt]");
				//for (var i =0;i<children.length;i++){
				//	children[i].outerHTML = children[i].alt;
				//}
				var children = cloned.querySelectorAll('[role="tooltip"]');
				for (var i =0;i<children.length;i++){
					children[i].outerHTML = "";
				}
				chatmessage = cloned.innerText;
			  } catch(e){}
		  }
		  
		  try{
			chatimg = ele.querySelector("#img").src;
			if (chatimg.startsWith("data:image/gif;base64") || (ele.getAttribute("author-type")=="owner")){
				chatimg = document.querySelector("#panel-pages").querySelector("#img").src; // this is the owner
			}
		  } catch(e){}
		  
		  var chatdonation = "";
		  try{
			chatdonation = ele.querySelector("#purchase-amount").innerText;
		  } catch(e){}
		  
		  var chatmembership = "";
		  try{
			chatmembership = ele.querySelector(".yt-live-chat-membership-item-renderer #header-subtext").innerHTML;
		  } catch(e){}
		  
		 
		  
		  var chatsticker = "";
		  try{
			chatsticker = ele.querySelector(".yt-live-chat-paid-sticker-renderer #sticker>#img").src;
		  } catch(e){}
		  
		  if (chatsticker) {
				chatdonation = ele.querySelector("#purchase-amount-chip").innerText;
		  }

		  var chatbadges = [];
		  try{ 
			ele.querySelectorAll(".yt-live-chat-author-badge-renderer img, .yt-live-chat-author-badge-renderer svg").forEach(img=>{
				if (img.tagName.toLowerCase()=="img"){
					var html = {};
					html.src = img.src;
					html.type = "img";
					chatbadges.push(html);
				} else if (img.tagName.toLowerCase()=="svg"){
					var html = {};
					img.style.fill = window.getComputedStyle(img).color;
					html.html = img.outerHTML;
					html.type = "svg";
					chatbadges.push(html);
				}
			});
			
		  } catch(e){}
		  

		  var hasDonation = '';
		  if (chatdonation) {
			hasDonation = chatdonation
		  }

		  var hasMembership = '';
		  var giftedmemembership = ele.querySelector("#primary-text.ytd-sponsorships-live-chat-header-renderer");
		  
		  if (chatmembership) {
			  if (chatmessage){
				hasMembership = '<div class="donation membership">MEMBER CHAT</div>';
			  } else if (giftedmemembership){
				hasMembership = '<div class="donation membership">SPONSORSHIP</div>';
				chatmessage = "<i>"+giftedmemembership.innerHTML+"</i>";
			  } else {
				hasMembership = '<div class="donation membership">NEW MEMBER!</div>';
				chatmessage = "<i>"+chatmembership+"</i>";
			  }
		  } else if (!chatmessage && giftedmemembership){
				chatmessage = "<i>"+giftedmemembership.innerHTML+"</i>";
				hasMembership = '<div class="donation membership">SPONSORSHIP</div>';
		 // } else if (memeber){
		//	  hasMembership = '<div class="membership">MEMEBER</div>'; // Just looks too green, and doesn't highlight those using special member options.
		 // } else if (mod){
		//	  hasMembership = '<div class="membership">MODERATOR</div>';
		  }

		  if (chatsticker) {
			chatmessage = '<img class="supersticker" src="'+chatsticker+'">';
		  }
		  
		  var backgroundColor = "";
		  
		  var textColor = "";
		  if (ele.style.getPropertyValue('--yt-live-chat-paid-message-primary-color')) {
			backgroundColor = "background-color: "+ele.style.getPropertyValue('--yt-live-chat-paid-message-primary-color')+";";
			textColor = "color: #111;";
		  }

		  if (ele.style.getPropertyValue('--yt-live-chat-sponsor-color')) {
			backgroundColor = "background-color: "+ele.style.getPropertyValue('--yt-live-chat-sponsor-color')+";";
			textColor = "color: #111;";
		  }
		  
		  srcImg = document.querySelector("#input-panel");
		  if (srcImg){
			  srcImg = srcImg.querySelector("#img");
			  if (srcImg){
				  srcImg = srcImg.src || "";
			  } else {
				  srcImg = "";
			  }
		  } else {
			  srcImg = "";
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
		data.type = "youtube";
		
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
		
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
							}
						} catch(e){console.error(e);}
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
	
    var ele = document.querySelector("yt-live-chat-app");
	if (ele){
		onElementInserted(ele, function(element){
		      processMessage(element, false);
		});
	}
	
	if (window.location.href.includes("youtube.com/watch")){
		setTimeout(function(){
			var ele = document.querySelector('iframe').contentWindow.document.body.querySelector("#chat-messages");
			if (ele){
				onElementInserted(ele, function(element){
				     processMessage(element, false);
				});
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