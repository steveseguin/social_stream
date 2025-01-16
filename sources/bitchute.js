(function () {
	
	console.log("social stream injected");

	 
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
	
	const IframeManager = {
		disabledIframes: new Map(),
		
		init() {
			this.handleExistingIframes();
			this.startObserver();
		},

		handleExistingIframes() {
			document.querySelectorAll('iframe').forEach(iframe => this.disable(iframe));
		},

		startObserver() {
			const observer = new MutationObserver(mutations => {
				mutations.forEach(mutation => {
					mutation.addedNodes.forEach(node => {
						if (node.nodeName === 'IFRAME') {
							this.disable(node);
						}
						if (node.querySelectorAll) {
							node.querySelectorAll('iframe').forEach(iframe => this.disable(iframe));
						}
					});
				});
			});

			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
		},

		disable(iframe) {
			if (!iframe) return;
			
			if (!iframe.src.startsWith("https://www.bitchute.com/api")){
				iframe.remove();
				delete iframe;
			} 
		},

	};

	var cachedUserProfiles = {};
	var lastImage = "";
	
	async function processMessage(ele){
	
		var namecolor = "";
		
		var namett="";
		try {
			namett = escapeHtml(ele.querySelector(".q-item__label .text-caption.text-weight-bold").innerText.split(":")[0].trim());
		} catch(e){
			return;
		}

		var chatimg = "";
		try{
			chatimg = ele.querySelector(".q-avatar img[src]").src;
		} catch(e){
			
		}
		
		// console.log(ele);
		
		
		var contentImg = "";
		try{
			contentImg = ele.querySelector(".img.q-mb-none .q-img__container img.q-img__image[src]").src; // too annoying to support
		} catch(e){
		}
		
		if (lastImage && (lastImage == contentImg)){
			lastImage = "";
			return;
			
		}
		lastImage = contentImg;

		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector(".q-item__label .text-caption.text-weight-regular")).trim();
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
		data.type = "bitchute";
		
		
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
	
	var isExtensionOn = true;
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in request) {
			isExtensionOn = request.state;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector('textarea[tabindex="0"], textarea').focus();
					
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
			} catch(e){}
			sendResponse(false);
		}
	);

	var observer = null;
	
	
	function onElementInserted(target) {
		if (!target){return;}
	
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
			})
		};
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	IframeManager.init();
	
	setInterval(function(){
		try {
		if (document.querySelector("#right_column .q-list")){
			if (!document.querySelector("#right_column .q-list").marked){
				document.querySelector("#right_column .q-list").marked=true;
				
				console.log("CONNECTED chat detected");

				setTimeout(function(){
					
					[...document.querySelector("#right_column .q-list").childNodes].forEach(ele=>{
						try {
							if (ele.skip){return;}
							ele.skip = true;
							
							//processMessage(ele);
						} catch(e){}
					});
					onElementInserted(document.querySelector("#right_column .q-list"));

				},2000);


			}
		}} catch(e){
			//console.error(e);
		}
	},2000);
	
	
	

})();