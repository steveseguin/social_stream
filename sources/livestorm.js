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
				//if (!settings.textonlymode){ // screw it. text only mode.
				//	if ((node.nodeName == "IMG") && node.src){
				//		node.src = node.src+"";
				//	}
				//	resp += node.outerHTML;
				//}
			}
		});
		return resp;
	}
	
	
	function processMessage(ele){

		var chatimg = ""

		try {
			chatimg = ele.querySelector("figure.user-avatar").style.backgroundImage.split('url("')[1].split('"')[0];
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector(".item-identity>.name").textContent.trim());
		} catch(e){
		}

		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector("[data-testid='msg']")).trim();
		} catch(e){
		}
		

		if (!msg || !name){
			return;
		}
		
		
		if (messageHistory.includes(name+"_"+msg)) {
			//console.log("Message already exists");
			return;
		} else {
			messageHistory.push(name+"_"+msg);
			messageHistory = messageHistory.slice(-100);
		}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "livestorm";
		
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
				if ("getSource" == request){sendResponse("livestorm");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('input').focus();
					document.querySelector('input').click();
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
	var messageHistory = [];
	
	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					try {
						
						for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
							var arrayList = Array.from(mutation.addedNodes[i].parentNode.children);
							if (arrayList.length - arrayList.indexOf(mutation.addedNodes[i])<10){
								processMessage(mutation.addedNodes[i]);
							}
						}
					} catch(e){console.error(e);}
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
			document.querySelectorAll('.vue-recycle-scroller__item-wrapper').forEach(container=>{ // more than one #message .. tsk ;)
				if (!container.marked){
					container.marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(){

						container.querySelectorAll(".vue-recycle-scroller__item-view").forEach(ele=>{
							processMessage(ele);
						});
						
						onElementInserted(document.querySelector(".vue-recycle-scroller__item-wrapper"));

					},1000);
				}
			});
		} catch(e){}
	},2000);

})();