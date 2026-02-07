(function () {
	 
	
	var isExtensionOn = true;
function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (55 * 1024)) {
		  callback(url); // Image size is larger than 25kb.
		  return;
		}

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

	function getAllContentNodes(element) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	function processMessage(ele){
		
		//console.log(ele);
		
		if (!ele || !ele.isConnected || ele.skip){
			return;
		}
		
		var name="";
		try {
			name = ele.dataset.username || "";
			
		} catch(e){
			name = "";
		}
		
		if (!name){
			try {
				var nameNode = ele.querySelector("a[href*='username=']");
				if (nameNode && nameNode.textContent){
					name = nameNode.textContent.trim();
				}
				if (!name){
					name = nameNode.href.split("username=").pop();
					
				}
			} catch(e){}
		}
		
		if (!name){
			try {
				name = escapeHtml(document.querySelector(".nameContainer > .name"));
			} catch(e){
				return;
			}
		}
		
		name = name.replace(/^@/, "").trim();
		
		if (!name){return;}
		
		ele.skip = true;
		
		var msg = "";
		try {
			var msgNode = ele.querySelector('.msg-text, .mchat__chatmessage');
			if (msgNode && msgNode.childNodes){
				msgNode.childNodes.forEach(ee=>{
					if (ee.nodeType == Node.TEXT_NODE){
						msg += escapeHtml(ee.textContent);
					} else if (settings.textonlymode && ee.alt && (ee.nodeName  == "IMG")){
						//msg += ee.alt;
					} else if (!settings.textonlymode&& (ee.nodeName  == "IMG")){
						msg += "<img src='"+ee.src+"' />";
					}  else {
						msg += escapeHtml(ee.textContent);
					}
				});
			}
		}catch(e){msg = "";}
		
		msg = msg.trim();
		
		if (!msg){
			try {
				var msgNodeNew = ele.querySelector(".chat-message-content-wrapper .wb_break-word");
				if (msgNodeNew){
					msg = getAllContentNodes(msgNodeNew).trim();
				}
			} catch(e){msg = "";}
		}
		
		var chatimg = '';
		try {
			chatimg = ele.querySelector(".pmessage__avaimg") || "";
			if (chatimg){
				chatimg = "https://cdn.locals.com/images/avatars/" + chatimg.style.cssText.split("https://cdn.locals.com/images/avatars/")[1] || "";
				chatimg = chatimg.split(".png")[0] + ".png";
			} else {
				chatimg = ele.querySelector(".ava-container img[src]") || "";
				if (chatimg){
					chatimg = chatimg.src;
				}
			}
		} catch (e){
			chatimg = "";
		}
		
		if (!chatimg){
			try {
				var avatar = ele.querySelector(".chat-message-content-wrapper .w_28px img[src]") || ele.querySelector(".chat-message-content-wrapper img[alt='User'][src]") || ele.querySelector(".chat-message-content-wrapper img[class*='bdr_50%'][src]");
				if (!avatar){
					var fallbackAvatar = ele.querySelector(".chat-message-content-wrapper img[src]");
					if (fallbackAvatar && (!fallbackAvatar.closest || (!fallbackAvatar.closest(".wb_break-word") && !fallbackAvatar.closest(".message-photo")))){
						avatar = fallbackAvatar;
					}
				}
				if (avatar){
					chatimg = avatar.src;
				}
			} catch(e){
				chatimg = "";
			}
		}
		
		var contentimg = "";
		try {
			contentimg =  ele.querySelector(".message-photo img[src]").src;
		} catch(e){
			contentimg = "";
		}
		
		var hasDonation = "";
		try {
			var donationPath = ele.querySelector("svg path[d^='M1.36193 6.26802']");
			if (donationPath){
				var donationSvg = donationPath.closest("svg");
				var donationSpan = "";
				if (donationSvg && donationSvg.nextElementSibling){
					donationSpan = donationSvg.nextElementSibling;
				} else if (donationSvg && donationSvg.parentNode){
					donationSpan = donationSvg.parentNode.querySelector("span");
				}
				if (donationSpan && donationSpan.textContent){
					hasDonation = escapeHtml(donationSpan.textContent.trim());
				}
			}
		} catch(e){
			hasDonation = "";
		}
		
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "locals";
		
		console.log(data);
		
		if (!contentimg && !msg && !hasDonation){return;}
		
		pushMessage(data);
		
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
			console.error(e);
		}
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
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("locals");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('#chat-message-value').focus();
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

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			if ( mutations[0] && mutations[0].addedNodes){
				var nodes = mutations[0].addedNodes;
				for (var i=0;i<nodes.length;i++){
					try {
						var ele = nodes[i];
						if (ele && ele.nodeName && ele.nodeName == "DIV"){
							if (!ele.skip){
								processMessage(ele);
							}
						}
					}catch(e){console.error(e)}
				}
			}
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	var counter = 0;
	console.log("social stream injected");

	setInterval(function(){
		var chatContainer = document.querySelector('#chat-history,#chatscroller, .chat-container section')
		if (chatContainer){
			if (!chatContainer.marked){
				chatContainer.marked=true;
				setTimeout(function(){
					var chatContainer = document.querySelector('#chat-history,#chatscroller,.chat-container section')
					chatContainer.childNodes.forEach(ele=>{
						if (ele && ele.nodeName && ele.nodeName == "DIV"){
							ele.skip = true;
						}
					});
					onElementInserted(chatContainer);
				},3000);
			}
			
			
			if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			
				if (counter%10==0){
					try {
						
						
						let viewerSpan = document.querySelector("svg>path[d^='M10.8176 5.85711C10.8176 6.63686 10.5052 7.38474 9.94965 7.93603C9.39408 8.4873 8.64033 8.79724 7.85447']");
						if (viewerSpan?.parentNode?.nextElementSibling?.textContent){
							let views = viewerSpan.parentNode.nextElementSibling.textContent.toUpperCase();
							let multiplier = 1;
							if (views.includes("K")){
								multiplier = 1000;
								views = views.replace("K","");
							} else if (views.includes("M")){
								multiplier = 1000000;
								views = views.replace("M","");
							}
							views = views.split(" ")[0];
							if (views == parseFloat(views)){
								views = parseFloat(views) * multiplier;
								chrome.runtime.sendMessage(
									chrome.runtime.id,
									({message:{
											type: 'locals',
											event: 'viewer_update',
											meta: views
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
			
		}
	},2000);

})();
