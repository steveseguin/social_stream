(function () {
	function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}

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
	
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
	}
	
	function digInto(eles){
		var chatmessage = "";
		eles.forEach(ele2=>{
			try {
				if (ele2.nodeType == Node.TEXT_NODE){
					chatmessage += escapeHtml(ele2.textContent);
				} else if (ele2 && ele2.querySelector && ele2.querySelector("img[src]")){
					chatmessage += "<img src='"+ele2.querySelector("img[src]").src+"'/>";
				} else {
					chatmessage += digInto(ele2.childNodes);
				}
			} catch(e){}
		});
		return chatmessage;
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
	
	async function processMessage(content){
		
		
		var buttons = content.querySelectorAll("button");
		
		var chatname="";
		try{
			chatname = escapeHtml(buttons[1].textContent);
		} catch(e){
			chatname = "";
		}
		
		var chatimg="";
		try{
			chatimg = buttons[0].querySelector("img").src;
		} catch(e){
			chatimg = "";
		}
		
		
		
		var chatmessage="";
		try{
			 if (settings.textonlymode){
				chatmessage = escapeHtml(buttons[1].nextSibling.textContent);
			 } else {
				chatmessage = digInto(buttons[1].nextSibling.childNodes)
			 }
		} catch(e){
			return;
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
	  data.type = "piczel";
	  
	  if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
			
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
							
							callback(mutation.addedNodes[i]);
								
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
		if (document.querySelector("#PiczelChat") && !document.querySelector("#PiczelChat").marked){
			document.querySelector("#PiczelChat").marked = true;
			console.log("LOADED SocialStream EXTENSION");
			
			try{
				document.querySelectorAll("nav button").forEach(ele=>{
					ele.disabled = true;
				});
			} catch(e){}
			
			try { 
				var main = document.querySelector("#PiczelChat").childNodes[0].childNodes[0].childNodes[3].childNodes[0].childNodes[0].childNodes;
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
							//processMessage(main[j]);
						} 
					} catch(e){}
				}
			} catch(e){ }
			
			onElementInserted("#PiczelChat", function(first){
				processMessage(first);
			});
		}
		
	},2000);

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
					if (!document.querySelector("[class='cm-line']")){
						sendResponse(false);
						return;
					}
					document.querySelector("[class='cm-line']").focus();
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