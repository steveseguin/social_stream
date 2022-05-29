(function () {
	
	function getTwitchAvatarImage(username){
		fetch("https://api.socialstream.ninja/twitch/avatar?username="+encodeURIComponent(username)).then(response => {
			response.text().then(function (text) {
				if (text.startsWith("https://")){
					brandedImageURL = text;
				} 
			});
		}).catch(error => {
			//console.log("Couldn't get avatar image URL. API service down?");
		});
	}
	
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
	if (xx[0]){
		getTwitchAvatarImage(xx[0]);
	}
	
	function processMessage(ele){	// twitch
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  
	  try {
		var nameEle = ele.querySelector(".chat-author__display-name");
		var chatname = nameEle.innerText;
		try {
			nameColor = nameEle.style.color;
		} catch(e){}
	  } catch(e){return;}
	  
	  nameColor 
	  
	  var chatbadges = [];
	  
	  ele.querySelectorAll("img.chat-badge[src]").forEach(badge=>{
		chatbadges.push(badge.src);
	  });
	  
	  
	  
	  try {
		var BTT = ele.querySelectorAll('.bttv-tooltip');
		for (var i=0;i<BTT.length;i++){
			BTT[i].outerHTML = "";
		}
	  } catch(e){}
	  
	  if (!textOnlyMode){
		  try {
			if (ele.querySelector(".seventv-message-context")){
				test = ele.querySelector(".seventv-message-context").innerText.trim();
				if (test == ""){
					chatmessage = ele.querySelector(".seventv-message-context").innerHTML;
				} else {
					chatmessage = test;
				}
			} else {
				chatmessage = ele.querySelector('*[data-test-selector="chat-line-message-body"]');
				if ((chatmessage && chatmessage.children.length ===1) && (chatmessage.querySelectorAll("span.text-fragment").length)){
					test = chatmessage.innerText.trim();
					if (test == ""){
						chatmessage = chatmessage.innerHTML;
					} else {
						chatmessage = test;
					}
				} else if (chatmessage){
					chatmessage = chatmessage.innerHTML;
				}
			}
		  } catch(e){}
		  
		  
		  if (!chatmessage){
			  chatmessage="";
			  try {
				chatmessage = ele.querySelector('span.message').innerHTML; // FFZ support
			  } catch(e){
				  chatmessage="";
			  }
		  }
		  
		  if (!chatmessage){
			chatmessage = "";
			var element = ele.querySelector(".chat-line__message-container").querySelector('span[data-test-selector="chat-message-separator"]');
			while (element.nextSibling) {
				try{
				  element = element.nextSibling;
				  if (element.innerHTML){
					chatmessage += element.innerHTML;
				  }
				} catch(e){}
			}
		  }
	  } else if (ele.querySelector(".seventv-message-context")){
		    var cloned = ele.querySelector(".seventv-message-context").cloneNode(true);
			var children = cloned.querySelectorAll("[alt]");
			for (var i =0;i<children.length;i++){
				children[i].outerHTML = children[i].alt;
			}
			/* var children = cloned.querySelectorAll('[role="tooltip"]');
			for (var i =0;i<children.length;i++){
				children[i].outerHTML = "";
			} */
			chatmessage = cloned.innerText;
	  } else {
		  try{
			var cloned = ele.querySelector('*[data-test-selector="chat-line-message-body"]').cloneNode(true);
			var children = cloned.querySelectorAll("[alt]");
			for (var i =0;i<children.length;i++){
				children[i].outerHTML = children[i].alt;
			}
			/* var children = cloned.querySelectorAll('[role="tooltip"]');
			for (var i =0;i<children.length;i++){
				children[i].outerHTML = "";
			} */
			chatmessage = cloned.innerText;
		  } catch(e){}
	  }
	  
	  if (!chatmessage){
		return;
	  }

	  var donations = 0;
	  try {
		var elements = ele.querySelectorAll('.chat-line__message--cheer-amount'); // FFZ support
		
		for (var i=0;i<elements.length;i++){
			donations += parseInt(elements[i].innerText);
		}
		if (donations==1){
			donations += " bit";
		} else if (donations>1){
			donations += " bits";
		}
	  } catch(e){}

	  var hasDonation = '';
	  if (donations) {
		hasDonation = donations;
	  }

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = "";
	  data.hasDonation = hasDonation;
	  data.hasMembership = "";
	  data.type = "twitch";
	  if (brandedImageURL){
		data.sourceImg = brandedImageURL;
	  }
	  
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
	  } catch(e){
		  //
	  }
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector('[data-a-target="chat-input"]').focus();
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
				// twitch doesn't capture avatars already.
			} catch(e){}
			sendResponse(false);
		}
	);

	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
		}
	});  /////

	function onElementInsertedTwitch(containerSelector, className, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i].ignore){continue;}
						if (mutation.addedNodes[i].className && mutation.addedNodes[i].classList.contains(className)) {
							callback(mutation.addedNodes[i]);
							mutation.addedNodes[i].ignore=true;
						} else {
							try{
								var childEle = mutation.addedNodes[i].querySelector("."+className);
								if (childEle){
									callback(childEle);
									mutation.addedNodes[i].ignore=true;
									childEle.ignore=true;
								}
							} catch(e){}
						}
					}
				}
			});
		};
		var target = document.querySelectorAll(containerSelector)[0];
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

	setTimeout(function(){
		var clear = document.querySelectorAll(".chat-line__message");
		for (var i = 0;i<clear.length;i++){
			clear[i].ignore = true; // don't let already loaded messages to re-load.
		}
		onElementInsertedTwitch(".chat-scrollable-area__message-container", "chat-line__message", function(element){
		  setTimeout(function(element){processMessage(element);},10, element);
		});
	},2000);

})();