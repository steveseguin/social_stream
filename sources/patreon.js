(function () {
	 
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
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
						node.style = "";
						node.className = "";
						resp += node.outerHTML;
					}
					// resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	var channelName = "";
	var messageHistory = [];
	
	var lastMg = {};
	var mxchat = 0;
	
	function processMessage(ele){
		//console.log(ele);
		if (!ele || !ele.isConnected){return;}
		
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		if (ele.dataset.knownSize){
			if (!parseInt(ele.dataset.knownSize)){
				console.log("no knownSize");
				return;
			}
		}
		
		var id = false
		if (ele.dataset){
			id = ele.dataset?.index;
		}
		
		if (id!==false){
			if (messageHistory.includes(id)){
				return;
			}
			messageHistory = messageHistory.slice(-5000);
			messageHistory.push(id);
		} else {
			return;
		}
		
		
		var chatimg = ""
		try {
			chatimg = escapeHtml(ele.querySelector("picture img[src]").src);
		} catch(e){
			//console.error(e);
		}
		
		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector('[data-tag="chat-message-text-content"]')).trim()
			
		} catch(e){
			//console.error(e);
		}
		
		
		var name="";
		
			while (!name && ele){
				try {
					name = escapeHtml(ele.querySelector("strong").textContent);
				} catch(e){
					//console.error(e);
				}
				if (name){break;}
				if (!ele.previousSibling){break;}
				ele = ele.previousSibling;
			}
		
		
		
		var badges=[];
		
		var contentImg = "";
		
		try {
			contentImg = escapeHtml(ele.querySelector("picture img[src][alt='User posted image']").src);
		} catch(e){}
		
		if (!(msg || contentImg)){
			console.error("SIP");
			return;
		}
		
		
		var data = {};
		data.chatname = name || lastMg.chatname;
		data.chatbadges = badges;
		data.chatmessage = msg;
		if (!name && lastMg.chatname){
			data.chatimg = chatimg || lastMg.chatimg;
		} else {
			data.chatimg = chatimg;
		}
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = contentImg;
		data.textonly = settings.textonlymode || false;
		data.type = "patreon";
		
		lastMg = data;
		
		if (id!==false){
			if (parseInt(id)<mxchat){
				return;
			} else {
				mxchat = parseInt(id);
			}
		}
		
		
		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	
	function checkViewers(){
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				let viewerSpan = [...document.querySelectorAll("number-flow-react.tabular-nums[role='img']")].pop().ariaLabel;
				if (viewerSpan){
					let views = viewerSpan.toUpperCase();
					let multiplier = 1;
					if (views.includes("K")){
						multiplier = 1000;
						views = views.replace("K","");
					} else if (views.includes("M")){
						multiplier = 1000000;
						views = views.replace("M","");
					}
					views = views.split(" ")[0];
					if (views == parseFloat(views)){
						views = parseFloat(views) * multiplier;
						chrome.runtime.sendMessage(
							chrome.runtime.id,
							({message:{
									type: 'patreon',
									event: 'viewer_update',
									meta: views
								}
							}),
							function (e) {}
						);
					}
				}
			} catch (e) {
			}
		}
	}


	// OnlineViewers_root_orkvv
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isExtensionOn = response.state;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("patreon");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('div.tiptap[contenteditable]>p[data-placeholder]').focus();
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
							if (!mutation.addedNodes[i].dataset.index){continue;}

							setTimeout(function(ee){
									processMessage(ee); // maybe here
							}, 300, mutation.addedNodes[i]);
							
						} catch(e){}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");


	var container = "";
	setInterval(function(){
		try {
			if (container){return;};
			
			container = document.querySelector('[data-index][data-known-size');
			
			if (!container.parentNode.marked){
				container.parentNode.marked=true;

				console.log("CONNECTED chat detected");

				setTimeout(function(xx){
					onElementInserted(xx);
				},2000, container.parentNode);
			}
			// checkViewers();
		} catch(e){}
	},2000);

})();
