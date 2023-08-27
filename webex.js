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

	  if (ele && ele.marked){
		  return;
	  } else {
		  ele.marked = true;
	  }
	  
	  var chatimg = "";
	 // try{
		//   chatimg = ele.querySelector("img.presence-entity__image.avatar").src;
		//   if (chatimg.startsWith("data:image/gif;base64")){
		//	   chatimg="";
		//   }
	 // } catch(e){ }
	 
	  var name = ele.querySelector("[class^='style-chat-label-']").innerText;
	  if (name){
		if (name.startsWith("from ")){
			name = name.replace("from ","");
			name = name.replace(" to Everyone","");
		}
		name = name.trim();
		name = escapeHtml(name);
	  }
	  
	  var msg = "";
	  try {
		msg = ele.querySelector('[class^="style-chat-msg-"]').innerText;
		msg = msg.trim();
		msg = escapeHtml(msg);
	  } catch(e){
		
	  }
	  var data = {};
	  data.chatname = name;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = msg;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";;
	  data.contentimg = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "webex";
	  
	   if (data.contentimg){
		  toDataURL(contentimg, function(dataUrl) {
			  data.contentimg = dataUrl;
			  if (data.chatimg){
					toDataURL(data.chatimg, function(dataUrl) {
						data.chatimg = dataUrl;
						pushMessage(data);
					});
			  } else {
				   pushMessage(data);
			  }
		  });
		} else if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
	  
	}

	function pushMessage(data){
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
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
					document.querySelector("div[class^='style-text-container-']>textarea").focus();
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

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					var xxx = mutation.addedNodes;
					for (var i = 0; i< xxx.length; i++) {
						try {
							var ele = xxx[i];
							if (ele.NodeType==8){
								continue;
							}
							console.log(ele);
							if (ele && ele.className && ele.className.includes("style-item-not-first")) {
								callback(ele);
							} else if (ele && ele.tagName=="SECTION"){
								callback(ele);
							} 
						} catch(e){}
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
	
	document.querySelectorAll('iframe').forEach( item =>{
		try{
			if (item.contentWindow.document.body.querySelectorAll("#chat-panel").length){
				var ele = item.contentWindow.document.body.querySelector("#chat-panel");
				if (!ele.marked){
					ele.marked=true;
					onElementInserted(ele, function(element){
					   processMessage(element);
					});
				}
			}
		} catch(e){}
	});
	
	setInterval(function(){
		document.querySelectorAll('iframe').forEach( item =>{
			try{
				if (item.contentWindow.document.body.querySelectorAll("#chat-panel").length){
					var ele = item.contentWindow.document.body.querySelector("#chat-panel");
					if (!ele.marked){
						ele.marked=true;
						onElementInserted(ele, function(element){
						   processMessage(element);
						});
					}
				}
			} catch(e){}
		});
	},3000);

})();