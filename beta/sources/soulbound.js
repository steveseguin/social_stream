(function () {
	 
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

	function escapeHtml(unsafe){ // when goofs be trying to hack me
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
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
				resp += escapeHtml(node.textContent)+" ";
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
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	var channelName = "";
	
	function processMessage(ele){
		
		var chatimg = "";

		try {
			const avatarImg = ele.querySelector(".rounded-full.overflow-hidden img");
			if (avatarImg && avatarImg.src) {
				chatimg = avatarImg.src;
			}
		} catch(e){
		}
		
		var name = "";
		var namecolor = "";
		try {
			const nameElement = ele.querySelector("a[style]");
			if (nameElement) {
				name = escapeHtml(nameElement.textContent);
				namecolor = nameElement.style.color;
			}
		} catch(e){
		}
		
		var event  = "";
		var donation = "";
		var msg = "";
		try {
			let msgElement = ele.querySelector(".text-white.text-sm.break-words");
			if (msgElement) {
				msg = getAllContentNodes(msgElement).trim();
			} else {
				msgElement = ele.querySelector(".text-sm.break-words.font-blenderPro.text-amber-400");
				if (msgElement) {
					msg = getAllContentNodes(msgElement).trim();
					event = true;
					if (msg.includes("tipped")){
						try {
							var tmp = msg.split("tipped ")[1].split(" ")
							tmp.pop()
							donation = tmp.join(" ");
						} catch(e){}
					}
					
				} else {
					msgElement = ele.querySelector(".text-sm.break-words.font-blenderPro.text-red-400");
					if (msgElement) {
						msg = getAllContentNodes(msgElement).trim();
						event = true;
					}
				}
			}
		} catch(e){
		}
		
		
		if (!msg || !(name || event)){
			return;
		}
		
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = donation;
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "soulbound";
		data.event = event;
		
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	
	function checkViewers(){
			if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
				try {
					let viewerSpan = document.querySelector("svg>polygon[points='6 3 20 12 6 21 6 3']");
					if (viewerSpan?.parentNode?.nextSibling?.textContent){
						let views = viewerSpan.parentNode.nextSibling.textContent.toUpperCase();
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
										type: 'soulbound',
										event: 'viewer_update',
										meta: views
									}
								}),
								function (e) {}
							);
						}
					}
				} catch (e) {
				}
			}
		}

	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isExtensionOn = response.state;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					const chatInput = document.querySelector('[contenteditable][data-placeholder="Chat"]');
					if (chatInput) {
						chatInput.focus();
					}
					sendResponse(true);
					return;
				}
				if ("getSource" == request){
					sendResponse("soulbound");
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
				
			} catch(e){}
			sendResponse(false);
		}
	);

	var lastURL =  "";
	var observer = null;
	
	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].skip){continue;}

							mutation.addedNodes[i].skip = true;
							
							processMessage(mutation.addedNodes[i]);
							
						} catch(e){}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
			// Find the chat container by looking for the main chat list container
			var container = document.querySelector(".no-scrollbar > .custom-scrollbar");;
			
			if (container && !container.marked){
				container.marked = true;

				console.log("CONNECTED chat detected");

				setTimeout(function(){
					onElementInserted(container);
				}, 2000);
			}
			checkViewers();
		} catch(e){}
	}, 2000);

})();