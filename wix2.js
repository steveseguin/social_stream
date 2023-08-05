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
	
	function escapeHtml(unsafe){
		try {
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
		var name="";
		try {
			name = ele.dataset.username || "";
			
		} catch(e){
			name = "";
		}
		
		if (!name){
			name = escapeHtml(document.querySelector(".annoto-comment-author-name").innerText);
		}
		
		var msg = "";
		try {
			ele.querySelector('.annoto-comment-body').childNodes.forEach(ee=>{
				if (ee.nodeType == Node.TEXT_NODE){
					msg += escapeHtml(ee.textContent);
				} else if (settings.textonlymode && ee.alt && (ee.nodeName  == "IMG")){
				//	msg += ee.alt;
				} else if (!settings.textonlymode&& (ee.nodeName  == "IMG")){
					msg += "<img src='"+ee.src+"' />";
				}  else {
					msg += escapeHtml(ee.textContent);
				}
			});
		}catch(e){msg = "";}
		
		msg = msg.trim();
		
		var chatimg = '';
		try {
			chatimg = ele.querySelector(".annoto-avatar .annoto-photo") || "";
			if (chatimg){
				chatimg = chatimg.style.cssText.split('background-image: url("')[1] || "";
				chatimg = chatimg.split('");')[0];
			} else {
				chatimg = ele.querySelector(".annoto-photo img[src]") || "";
				if (chatimg){
					chatimg = chatimg.src;
				}
			}
		} catch (e){
			chatimg = "";
		}
		
		var contentimg = "";
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = contentimg;
		data.type = "wix";
		
		console.log(data);
		
		if (!contentimg && !msg){return;}
		
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
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('textarea').focus();
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
						console.log(ele);
						if (ele && ele.nodeName && ele.nodeName == "LI"){
							if (!ele.skip){
								ele.skip = true;
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
	
	console.log("social stream injected");

	setInterval(function(){
		var chatContainer = document.querySelector('ol[slot="content"]')
		if (chatContainer){
			if (!chatContainer.marked){
				chatContainer.marked=true;
				setTimeout(function(){
					var chatContainer = document.querySelector('ol[slot="content"]')
					chatContainer.childNodes.forEach(ele=>{
						if (ele && ele.nodeName && ele.nodeName == "DIV"){
							ele.skip = true;
						}
					});
					onElementInserted(chatContainer);
				},3000);
			}
		}
	},1000);

})();