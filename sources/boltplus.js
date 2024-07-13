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
	
	async function fetchWithTimeout(URL, timeout=2000){ // ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {...{timeout:timeout}, signal: controller.signal});
			clearTimeout(timeout_id);
			return response;
		} catch(e){
			console.log(e);
			return await fetch(URL);
		}
	}
	
	var cachedUserProfiles = {};
	var lastImage = "";
	
	async function processMessage(ele){
	
		var namecolor = "";
		
		var namett="";
		try {
			var namett = escapeHtml(ele.querySelector(".chat-user-name").innerText.trim());
			try {
				namecolor = ele.querySelector(".chat-user-name").style.color;
			} catch(e){
			}
		} catch(e){
			return;
		}

		var chatimg = "";
		try{
			chatimg = ele.querySelector("img.MuiAvatar-img[src]").src;
		} catch(e){
			
		}
		
		// console.log(ele);
		
		
		var contentImg = "";
		try{
			contentImg = ele.querySelector("img.giphy-img-loaded[src]").src; // too annoying to support
		} catch(e){
		}
		
		if (lastImage && (lastImage == contentImg)){
			lastImage = "";
			return;
			
		}
		lastImage = contentImg;

		var msg="";
		try {
			msg = ele.querySelectorAll("[data-text='true']");
			if (msg.length>1){
				msg = getAllContentNodes(msg[msg.length-1]).trim();
			} else {
				msg = "";
			}
		} catch(e){
			return;
		}
		
		var chatbadges = [];
		

		if (!namett || (!contentImg && !msg)){
			if (namett){
				return true;
			}
			return;
		}
		
		var data = {};
		data.chatname = namett;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = namecolor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = contentImg;
		data.textonly = settings.textonlymode || false;
		data.type = "boltplus";
		
	
		if (lastMessages[namett] && msg && (lastMessages[namett] == namett+":"+msg)){
			return;
		} else if (lastMessages[namett] && contentImg && (lastMessages[namett] == namett+":"+contentImg)){
			return;
		}
		
		if (msg){
			lastMessages[namett] = namett+":"+msg;
		} else {
			lastMessages[namett] = namett+":"+contentImg;
		}
		
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector('.public-DraftEditor-content[ contenteditable="true"]').focus();
					
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

	var observer = null;
	
	var lastMessages = {};
	
	
	
	function onElementInserted(target) {
		if (!target){return;}
	
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					var ele = document.querySelector(".MuiAvatar-root").parentNode.parentNode.parentNode.childNodes[0];
					setTimeout(function(ele){
						processMessage(ele);
					}, 600, ele)
				}
			})
		};
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
		if (document.querySelector(".MuiAvatar-root").parentNode.parentNode.parentNode){
			if (!document.querySelector(".MuiAvatar-root").parentNode.parentNode.parentNode.marked){
				document.querySelector(".MuiAvatar-root").parentNode.parentNode.parentNode.marked=true;

				console.log("CONNECTED chat detected");

				setTimeout(function(){
					
					onElementInserted(document.querySelector(".MuiAvatar-root").parentNode.parentNode.parentNode);

				},1000);


			}
		}} catch(e){
			//console.error(e);
		}
	},2000);

})();