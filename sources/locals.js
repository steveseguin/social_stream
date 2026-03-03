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

	function parseCountText(rawText){
		try {
			if (!rawText){return null;}
			let text = (rawText + "").trim();
			if (!text){return null;}
			if (/[$€£]/.test(text)){return null;}
			let match = text.match(/([0-9]+(?:[.,][0-9]+)?)(\s*[KMB])?/i);
			if (!match){return null;}
			let value = parseFloat((match[1] + "").replace(/,/g, ""));
			if (!isFinite(value)){return null;}
			let suffix = ((match[2] || "") + "").trim().toUpperCase();
			if (suffix === "K"){
				value *= 1000;
			} else if (suffix === "M"){
				value *= 1000000;
			} else if (suffix === "B"){
				value *= 1000000000;
			}
			return Math.max(0, Math.round(value));
		} catch(e){
			return null;
		}
	}

	function extractViewerCount(){
		try {
			let viewerPath = document.querySelector("svg>path[d^='M10.8176 5.85711C10.8176 6.63686 10.5052 7.38474 9.94965 7.93603C9.39408 8.4873 8.64033 8.79724 7.85447']");
			if (viewerPath && viewerPath.parentNode && viewerPath.parentNode.nextElementSibling){
				let directCount = parseCountText(viewerPath.parentNode.nextElementSibling.textContent);
				if (directCount !== null){
					return directCount;
				}
			}

			let metricsRow = document.querySelector(".chat-container header .d_flex.gap_2");
			if (metricsRow){
				let metricItems = metricsRow.querySelectorAll(":scope > div");
				for (let i=0; i<metricItems.length; i++){
					let item = metricItems[i];
					if (!item){continue;}
					let countTextNode = item.querySelector(".fs_13px, .lh_17px, div, span");
					let countText = "";
					if (countTextNode && countTextNode.textContent && countTextNode.textContent.trim()){
						countText = countTextNode.textContent;
					} else {
						countText = item.textContent;
					}
					let parsed = parseCountText(countText);
					if (parsed !== null){
						return parsed;
					}
				}
			}
		} catch(e){}
		return null;
	}

	var lastViewerCount = null;

	function emitViewerCount(viewerCount){
		try {
			if (!isFinite(viewerCount)){return;}
			viewerCount = Math.max(0, Math.round(viewerCount));
			if (lastViewerCount === viewerCount){return;}
			lastViewerCount = viewerCount;
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				({message:{
						type: 'locals',
						event: 'viewer_update',
						meta: viewerCount
					}
				}),
				function (e) {}
			);
		} catch(e){}
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
				var msgNodeNew = ele.querySelector(".chat-message-content-wrapper .fs_14px.lh_18px.w_100% .wb_break-word");
				if (!msgNodeNew){
					let msgNodeList = ele.querySelectorAll(".chat-message-content-wrapper .wb_break-word");
					if (msgNodeList && msgNodeList.length){
						msgNodeNew = msgNodeList[msgNodeList.length-1];
					}
				}
				if (msgNodeNew){
					msg = getAllContentNodes(msgNodeNew).trim();
				}
			} catch(e){msg = "";}
		}
		
		var chatimg = '';
		
		if (!chatimg){
			try {
				var avatar = ele.querySelector(".chat-message-content-wrapper .w_28px img[src]") || ele.querySelector(".chat-message-content-wrapper img[alt='User'][src]") || ele.querySelector(".chat-message-content-wrapper img[class*='bdr_50%'][src]");
				if (!avatar){
					try {
						var fallbackAvatar = ele.querySelector(".chat-message-content-wrapper img[src]");
						if (fallbackAvatar && (!fallbackAvatar.closest || (!fallbackAvatar.closest(".wb_break-word") && !fallbackAvatar.closest(".message-photo")))){
							avatar = fallbackAvatar;
							chatimg = avatar.src;
						}
						if (!chatimg){
							fallbackAvatar = ele.querySelector(".pmessage__avaimg[style]");
							if (fallbackAvatar){
								chatimg = fallbackAvatar.style.background.split("url(")[1].split('"')[1];
							}
						}
					} catch(e){}
				} else {
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
						let viewerCount = extractViewerCount();
						if (viewerCount !== null){
							emitViewerCount(viewerCount);
						}
					} catch(e){}
				}
				counter+=1;
			}
			
		}
	},2000);

})();
