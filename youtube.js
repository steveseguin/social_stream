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
	
	function processMessage(ele, wss=true){
		  if(ele.hasAttribute("is-deleted")) {
			return;
		  }
		  
		  var chatmessage = "";
		  var chatname = "";
		  var chatimg = "";
		  var nameColor = "";
		  
		  var srcImg = ""; // what shows up as the source image; blank is default (dock decides).
		  
		  try{
			var nameElement = ele.querySelector("#author-name");
			chatname = nameElement.innerText;
			
			if (nameElement.classList.contains("member")){
				nameColor = "#107516";
			} else if (nameElement.classList.contains("moderator")){
				nameColor = "#5f84f1";
			}
			
		  } catch(e){}
		  
		  if (!textOnlyMode){
			  try{
				chatmessage = ele.querySelector("#message").innerHTML;
			  } catch(e){}
		  } else {
			  try{
				var cloned = ele.querySelector("#message").cloneNode(true);
				var children = cloned.querySelectorAll("[alt]");
				for (var i =0;i<children.length;i++){
					children[i].outerHTML = children[i].alt;
				}
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
			chatdonation = ele.querySelector("#purchase-amount").innerHTML;
		  } catch(e){}
		  
		  var chatmembership = "";
		  try{
			chatmembership = ele.querySelector(".yt-live-chat-membership-item-renderer #header-subtext").innerHTML;
		  } catch(e){}
		  
		  var chatsticker = "";
		  try{
			chatsticker = ele.querySelector(".yt-live-chat-paid-sticker-renderer #img").src;
		  } catch(e){}
		  
		  if (chatsticker) {
			chatdonation = ele.querySelector("#purchase-amount-chip").innerHTML;
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
		  
		  if (chatmembership) {
			  if (chatmessage){
				  hasMembership = '<div class="donation membership">MEMBER CHAT</div>';
			  } else {
				hasMembership = '<div class="donation membership">NEW MEMBER!</div>';
				chatmessage = chatmembership;
			  }
		  }

		  if (chatsticker) {
			chatmessage = '<img src="'+chatsticker+'">';
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
		if (data.chatimg && avatars){
			//data.chatimg = data.chatimg.replace("=s32-", "=s128-");  // this is all for HD by default.  Too much CPU usage though
			//data.chatimg = data.chatimg.replace("=s64-", "=s128-");
			//
			//toDataURL(data.chatimg, function(dataUrl) {
			//	data.chatimg = dataUrl;
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
			} catch(e){}
			//});
		} else {
			data.chatimg = "";
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
			} catch(e){}
		}
	}
	
	var avatars = true;
	var textOnlyMode = false;
	
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector("div#input").focus();
					sendResponse(true);
					return;
				} 
				if ("textOnlyMode" == request){
					textOnlyMode = true;
					sendResponse(true);
					return;
				} else if ("richTextMode" == request){
					textOnlyMode = false;
					sendResponse(true);
					return;
				}
				
				if ("noAvatars" == request){
					avatars = false;
					sendResponse(true);
					return;
				} else if ("sendAvatars" == request){
					avatars = true;
					sendResponse(true);
					return;
				}
			} catch(e){}
			sendResponse(false);
		}
	);
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
		}
		if ("settings" in response){
			if ("noavatars" in response.settings){
				avatars = !response.settings.noavatars;
			}
		}
	});  /////

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].tagName == "yt-live-chat-text-message-renderer".toUpperCase()) {
							callback(mutation.addedNodes[i]);
						} else if (mutation.addedNodes[i].tagName == "yt-live-chat-paid-message-renderer".toUpperCase()) {
							callback(mutation.addedNodes[i]);
						} else if (mutation.addedNodes[i].tagName == "yt-live-chat-membership-item-renderer".toUpperCase()) {
							callback(mutation.addedNodes[i]);
						} else if (mutation.addedNodes[i].tagName == "yt-live-chat-paid-sticker-renderer".toUpperCase()) {
							callback(mutation.addedNodes[i]);
						}
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
		      setTimeout(function(element){processMessage(element, false);},1000,element);
		});
	}
	
	if (window.location.href.includes("youtube.com/watch")){
		setTimeout(function(){
			var ele = document.querySelector('iframe').contentWindow.document.body.querySelector("#chat-messages");
			if (ele){
				onElementInserted(ele, function(element){
				     setTimeout(function(element){processMessage(element, false);},1000,element);
				});
			}
		},3000);
	}
	
	
})();