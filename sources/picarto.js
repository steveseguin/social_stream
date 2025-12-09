(function () {
	
	var isExtensionOn = true;
function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}

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
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
	}
	
	async function processMessage(first, ele){
		var content = ele;
		
		var chatname="";
		try {
			chatname = content.querySelector("[class*='ChannelDisplayName__Name']").textContent;
			chatname = chatname.trim();
			chatname = escapeHtml(chatname);
		} catch(e){
			try {
				chatname = first.querySelector("[class*='ChannelDisplayName__Name']").textContent;
				chatname = chatname.trim();
				chatname = escapeHtml(chatname);
			} catch(e){
				return;
			}
		}
		
		var chatmessage="";
		try{
			 if (settings.textonlymode){
				chatmessage = escapeHtml(content.querySelector("[class*='Message__StyledSpan']").textContent);
			 } else {
				 
				if (content.querySelector("[class*='Message__StyledSpan']").querySelector("img")){
					await sleep(500); // allow time for the image to load, else it will be transparent.png, which is worthless.
				}
				 
				content.querySelector("[class*='Message__StyledSpan']").childNodes.forEach(ele2=>{
					if (ele2.nodeType == Node.TEXT_NODE){
						chatmessage += escapeHtml(ele2.textContent);
					} else if (ele2.querySelector("img")){
						chatmessage += "<img src='"+ele2.querySelector("img").src+"'/>";
					} else {
						chatmessage += escapeHtml(ele2.textContent);
					}
				});
				chatmessage = chatmessage.trim();
			 }
		} catch(e){
			return;
		}

		var chatimg="";
		try{
			chatimg = content.querySelector("span[class*='AvatarIcon__']>img").src;
		} catch(e){
			try {
				chatimg = first.querySelector("span[class*='AvatarIcon__']>img").src;
			} catch(e){
				chatimg = "";
			}
		}
		if (chatimg == "https://images.picarto.tv/ptvimages/avatar.jpg"){
			chatimg = "";
		}

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.membership = "";;
	  data.contentimg = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "picarto";
	  pushMessage(data);
	}
	
	
	function onElementInserted(containerSelector, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (!mutation.addedNodes[i].children.length){continue;}
							
							if (mutation.addedNodes[i].dataset.set123){continue;}
							mutation.addedNodes[i].dataset.set123 = "true";
							
							if (mutation.addedNodes[i].nextSibling && mutation.addedNodes[i].nextSibling.innerText.length){continue;}
							
							if (mutation.addedNodes[i].className.includes("ChannelChat__MessageBoxWrapper")){
								callback(mutation.addedNodes[i], mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].className.includes("StandardTypeMessagecontainer__BlockRow")){
								if (mutation.addedNodes[i].parentNode.parentNode.parentNode.className.includes("ChannelChat__MessageBoxWrapper")){
									callback(mutation.addedNodes[i].parentNode.parentNode.parentNode, mutation.addedNodes[i]);
								} else if (mutation.addedNodes[i].parentNode.parentNode.className.includes("ChannelChat__MessageBoxWrapper")){
									callback(mutation.addedNodes[i].parentNode.parentNode, mutation.addedNodes[i]);
								} else if (mutation.addedNodes[i].parentNode.className.includes("ChannelChat__MessageBoxWrapper")){
									callback(mutation.addedNodes[i].parentNode, mutation.addedNodes[i]);
								} else if (mutation.addedNodes[i].parentNode.parentNode.parentNode.parentNode.className.includes("ChannelChat__MessageBoxWrapper")){
									callback(mutation.addedNodes[i].parentNode.parentNode.parentNode.parentNode, mutation.addedNodes[i]);
								} 
							}
						} catch(e){}
					}
				}
			});
		};
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	console.log("social stream injected");
	
	
	setInterval(function(){ // clear existing messages; just too much for a stream.
		
		
		if (document.querySelector("[class*='styled__ChatContainer']") && !document.querySelector("[class*='styled__ChatContainer']").marked){
			document.querySelector("[class*='styled__ChatContainer']").marked = true;
			console.log("LOADED SocialStream EXTENSION");
			
			try { 
				var main = document.querySelectorAll("[class*='ChannelChat__MessageBoxWrapper']");
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
							//processMessage(main[j]);
						} 
					} catch(e){}
				}
				var main = document.querySelectorAll("[class*='StandardTypeMessagecontainer__BlockRow']");
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
							//processMessage(main[j]);
						} 
					} catch(e){}
				}
			} catch(e){ }
			
			onElementInserted("[class*='styled__ChatContainer']", function(first, element){
				processMessage(first, element);
			});
		}
		
		
	},4000);

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
				if ("getSource" == request){sendResponse("picarto");	return;	}
				if ("focusChat" == request){
					if (!document.querySelector("textarea[placeholder]")){
						sendResponse(false);
						return;
					}
					document.querySelector("textarea[placeholder]").focus();
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
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();