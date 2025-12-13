(function () {
	 
	
	var isExtensionOn = true;
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
	
	async function fetchWithTimeout(URL, timeout=2000){ // ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {...{timeout:timeout}, signal: controller.signal});
			clearTimeout(timeout_id);
			return response;
		} catch(e){
			return await fetch(URL);
		}
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
	
	var dataindex = 0;
	
	function extractLargestSrc(srcset) {
		const sources = srcset.split(',').map(src => {
			const parts = src.trim().split(' ');
			return {
				url: parts[0],
				size: parseInt(parts[1]) || 0
			};
		});
		
		return sources.reduce((largest, current) => {
			return current.size > largest.size ? current : largest;
		}, sources[0]).url;
	}
	
	async function processMessage(ele){
		
		
		if (ele.dataset.index){
			let ind = parseInt(ele.dataset.index);
			if (ind<dataindex){return;}
			dataindex = ind;
		}
		
		
		var chatimg = ""
		var chatbadges = [];
		
		try {
			chatimg = ele.querySelectorAll("img[srcset],img[src]");
			
			if (chatimg.length >= 1) {
				// Process all images to find badges and main images
				let mainImages = [];
				
				for (let img of chatimg) {
					if (img.src.includes('badge') || img.src.includes('Badge')) {
						if (!chatbadges.includes(img.src)){
							chatbadges.push(img.src);
						}
					} else if (img.srcset.includes('badge') || img.srcset.includes('Badge')) {
						let ii = extractLargestSrc(img.srcset);
						if (!chatbadges.includes(ii)){
							chatbadges.push(ii);
						}
					} else {
						// Handle srcset or src
						if (img.srcset) {
							mainImages.push(extractLargestSrc(img.srcset));
						} else {
							mainImages.push(img.src);
						}
					}
				}
				
				// Set chatimg to the first non-badge image if available
				chatimg = mainImages.length > 0 ? mainImages[0] : "";
			} else {
				chatimg = "";
			}
		} catch(e) {
			console.error(e);
		}


		
		var name="";
		try {
			name = escapeHtml(ele.childNodes[1].childNodes[0].childNodes[0].textContent.trim());
		} catch(e){
			try {
				name = escapeHtml(ele.querySelector("a").nextSibling.children[0].children[0].textContent.trim());
			} catch(e){
				//console.error(e);
			}
		}

		var msg="";
		try {
			msg = getAllContentNodes(ele.childNodes[1].childNodes[0].childNodes[1]).trim();
		} catch(e){
			try {
				msg = getAllContentNodes(ele.querySelector("a").nextSibling.children[1]).trim();
			} catch(e){
			}
		}
		
		
		
		try {
			ele.childNodes[1].childNodes[0].childNodes[0].querySelectorAll("img[alt][src]").forEach(img=>{
				chatbadges.push(img.src);
			});
		} catch(e){
			try {
				ele.querySelector("a").nextSibling.children[0].children[1].querySelectorAll("img[alt][src]").forEach(img=>{
					chatbadges.push(img.src);
				});
			} catch(e){
			}
			
			//ele.querySelector("a").nextSibling.children[0].children[0]
		}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.type = "whatnot";
		
		if (msg == "joined 👋"){
			data.event = true;
		} else {
			data.event = false;
		}
		
		if (!msg && !name){
			return;
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
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("whatnot");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector(".chatInput").focus();
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

							if (mutation.addedNodes[i].dataset.index || mutation.addedNodes[i].children.length ){
								setTimeout(function(xx){
									if (xx.isConnected){
										processMessage(xx);
									}
								},200,mutation.addedNodes[i]);
							}							
							
						} catch(e){}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
			if (document.querySelector("#app, #«rn», [data-testid='virtuoso-item-list']")){
				if (!document.querySelector("#app, #«rn», [data-testid='virtuoso-item-list']").marked){
					document.querySelector("#app, #«rn», [data-testid='virtuoso-item-list']").marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(){

						onElementInserted(document.querySelector("#app, #«rn», [data-testid='virtuoso-item-list']"));

					},3000);
				}
			};
		} catch(e){}
	},2000);

})();