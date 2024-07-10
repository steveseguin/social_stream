(function () {
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
	
	function processMessage(content){
		
		var chatname="";
		try {
			chatname = escapeHtml(content.querySelector(".display-name").textContent);
			chatname = chatname.trim();
			chatname = escapeHtml(chatname);
		} catch(e){
			return;
		}
		
		var chatmessage="";
		try{
			 if (settings.textonlymode){
				chatmessage = escapeHtml(content.querySelector(".message-text").innerText);
			 } else {
				var ele2 = content.querySelector(".message-text");
				ele2.childNodes.forEach(ele3=>{
					if (ele3.nodeName == "IMG"){
						if (ele3.src){
							chatmessage += "<img src='"+ele3.src+"'/>";
						}
					} else if (ele3.nodeName == "#text"){
						chatmessage += escapeHtml(ele3.textContent.trim());
					} else {
						chatmessage += escapeHtml(ele3.innerText.trim());
					}
				});
			 }
		} catch(e){
			return;
		}

		var chatimg ="" ;// lame
	  

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
		data.type = "stageten";

		pushMessage(data);
	}
	
	
	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (mutation.addedNodes[i] && (mutation.addedNodes[i].tagName == "LI")) {
							if (!mutation.addedNodes[i].dataset.set123){
								mutation.addedNodes[i].dataset.set123 = "true";
								callback(mutation.addedNodes[i]);
							}
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
	console.log("social stream injected");
	
	
	setInterval(function(){ // clear existing messages; just too much for a stream.
	
		if (document.querySelector("ol")){
			if (!document.querySelector("ol").set123){
				document.querySelector("ol").set123 = true;
				console.log("LOADED SocialStream EXTENSION");
				try {
					var main = document.querySelectorAll("li");
					for (var j =0;j<main.length;j++){
						try{
							if (!main[j].dataset.set123){
								main[j].dataset.set123 = "true";
								//processMessage(main[j]);
							} 
						} catch(e){}
					}
				} catch(e){ }
				
				onElementInserted(document.querySelector("ol"), function(element){
					processMessage(element, false);
				});
			}
		}
		
	},1500);

	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});
	
	function getCurrentTime() {
	  var now = new Date();
	  var hours = now.getHours();
	  var minutes = now.getMinutes();
	  var amOrPm = hours >= 12 ? 'PM' : 'AM';
	  var formattedHours = hours % 12 || 12;
	  var formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
	  return `${formattedHours}:${formattedMinutes} ${amOrPm}`;
	}
	
	var cssStylesheet = document.createElement('style');
	cssStylesheet.innerHTML = "\
		.ss{\
			position: relative;\
			overflow: visible;\
			display: inline-block;\
			margin: 0px 6px 0 0;\
		}\
		.ss img {\
			min-width: 15px;\
			min-height: 15px;\
			width: 24px;\
			height: 24px;\
			border-radius: 100%;\
		}\
		.s1 {\
			width: inherit;\
			padding: 10px;\
			line-height: 1.2;\
			background: rgb(220, 220, 220);\
			color: rgb(51, 51, 51);\
			border-radius: 15px;\
			list-style-type: none;\
			font-size: 0.92rem;\
			display: flex;\
			flex-direction: row;\
			flex-wrap: nowrap;\
			align-content: stretch;\
			justify-content: space-evenly;\
			align-items: flex-end;\
		}\
		.s3 {\
			display: flex;\
			border-radius: 100%;\
			flex-direction: row;\
			flex-wrap: nowrap;\
			align-content: stretch;\
			justify-content: flex-start;\
		}\
		.message-text {\
			margin: 6px 0 0 0;\
		}\
		.timestamp  {\
			font-size: 90%;\
			margin-left: 10px;\
		}\
		.message-data {\
			display: flex;\
			flex-direction: row;\
			flex-wrap: wrap;\
			align-content: stretch;\
			justify-content: flex-start;\
			align-items: center;\
			margin: 6px;\
		}\
	";
	document.getElementsByTagName('head')[0].appendChild(cssStylesheet);

	function injectFancyChat(data){
		
		console.log(data);
		try {
			var ele = document.createElement("span");
				ele.innerHTML = '<li data-align-right="true" class="sc-bPyhqo evxXzp" data-set123="true"><div class="sc-fWIMVQ cejOrE"><div data-view="default" data-pull-right="true" class="sc-gITdmR s1"><div class="s3"><div class="message-data"><div class="ss"><img class="chatimg" src="https://socialstream.ninja/sources/images/unknown.png" onerror="this.style.display = \'none\';"></div><span class="ss"><img onerror="this.style.display = \'none\';" class="sourcetype"></span><span class=""><span class="display-name"></span></span><span class="timestamp"></span><p class="message-text"></p></div></div></div></div></li>';
			if (data.chatname){
				ele.querySelector(".message-text").innerText = data.chatmessage;
			}
			if (data.chatname){
				ele.querySelector(".display-name").innerText = data.chatname;
			}
			if (data.timestamp){
				ele.querySelector(".display-name").innerText = getCurrentTime();
			}
			if (data.chatimg){
				ele.querySelector(".chatimg").src = data.chatimg;
			}
			if (data.type){
				ele.querySelector(".sourcetype").src = "https://socialstream.ninja/sources/images/"+data.type+".png";
			}
			
			document.querySelector("main ol").appendChild(ele.childNodes[0]);
		} catch(e){
			console.error(e);
		}
	}
	
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					if (!document.querySelector("form>div>input")){
						sendResponse(false);
						return;
					}
					document.querySelector("form>div>input").focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					}
					if ("metadata" in request){
						if (!document.querySelector("form>div>input")){
							sendResponse(false);
							return;
						}
						
						injectFancyChat(request.metadata)
						
						sendResponse(true);
						return;
					}
					
				}
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();