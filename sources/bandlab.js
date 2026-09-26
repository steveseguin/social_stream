(function () {
	 
	
	var isExtensionOn = true;
function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (25 * 1024)) {
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

	function escapeHtml(unsafe){ // success is when goofs be trying to hack me
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}
	function getAllContentNodes(element) {
		var resp = "";
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.nodeType===3){
				return escapeHtml(element.textContent) || "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				if (!node.classList.contains("comment-see-more")){
					resp += getAllContentNodes(node)
				}
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
		
		
		var chatimg = "";
		try{
		   chatimg = "https://"+ele.querySelector(".comment-header>a>img[srcset]").srcset.split("https://").pop().split(" ")[0]
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector(".comment-author-name, .live-message-body-author").textContent.trim());
		} catch(e){
		}
		
		var userid="";
		try {
			userid = ele.querySelector(".live-message-body-author").href.split("/")[1];
		} catch(e){
		}
		
		var msg="";
		try {
			ele.querySelector(".live-message-body").childNodes.forEach(xx=>{
				if (xx.classList && (xx.classList.contains("comment-author-name") || xx.classList.contains("live-message-body-author") || xx.classList.contains("live-message-body-author"))){
					
				} else if (xx.querySelector && xx.querySelector(".comment-author-name, .live-message-body-author, .live-message-body-author")){
					
				} else {
					msg+= getAllContentNodes(xx);
				}
			});
			msg = msg.trim();
		} catch(e){
		}
		
		
		var contentimg = "";
		
		try{
			contentimg = ele.querySelector(".comment-content img[src]").src;
		} catch(e){
		}
		
		if (!msg && !contentimg){return;}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.userid = userid;
		
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "bandlab";
		
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
				if ("getSource" == request){sendResponse("bandlab");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('textarea#commentField').focus();
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
	
	
	function onElementInserted(containerSelector) {
		var target = document.querySelector(containerSelector);
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
		if (document.querySelector('.comments, .live-chat-block, .comment-list-container>div').children.length){
			if (!document.querySelector('.comments, .live-chat-block, .comment-list-container>div').marked){
				document.querySelector('.comments, .live-chat-block, .comment-list-container>div').marked=true;
				onElementInserted('.comments, .live-chat-block, .comment-list-container>div');
			}
		}} catch(e){}
	},2000);

})();