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
	

	
	function processMessage(ele){
		
		console.log(ele);
		
		var chatname="";
		var msg="";
		
		try {
			var nameElement = ele.querySelector('span');
			chatname = escapeHtml(nameElement.textContent.trim());
			let node = nameElement.nextElementSibling;
			var msg = "";
			while (node) {
				if (node.childNodes.length){
					msg += getAllContentNodes(node)
				} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
					msg += escapeHtml(node.textContent)+" ";
				} else if (node.nodeType === 1){
					if (!settings.textonlymode){ 
						if ((node.nodeName == "IMG") && node.src){
							node.src = node.src+"";
						}
						msg += node.outerHTML;
					}
				}
				node = node.nextElementSibling;
			}
			
			msg = msg.trim();

		} catch(e){
			return;
		}
		
		var nameColor = "";
		try {
			if (nameElement.children && nameElement.children.length){
				nameElement = nameElement.children[0];
			}
			if (nameElement.children && nameElement.children.length){
				nameElement = nameElement.children[0];
			}
			nameColor = getComputedStyle(nameElement).color;
		} catch(e){
			
		}

		if (!msg || !chatname){
			return;
		}
		
		var chatimg = ""
		if (messageHistory.includes(chatname+"_"+msg)) {
			//console.log("Message already exists");
			return;
		} else {
			messageHistory.push(chatname+"_"+msg);
			messageHistory = messageHistory.slice(-10);
		}
		
		var data = {};
		data.chatname = chatname;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		if (settings.detweet){
			data.type = "twitter";
		} else {
			data.type = "x";
		}
		console.log(data);
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
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
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
							if (mutation.addedNodes[i].tagName && (mutation.addedNodes[i].tagName == "DIV") && mutation.addedNodes[i].childNodes && mutation.addedNodes[i].parentNode && (mutation.addedNodes[i].parentNode.tagName == "DIV")){
								processMessage(mutation.addedNodes[i]);
							}
						}
					} catch(e){console.error(e);}
				}
			});
		};
		
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	function findElementByAttributeAndChildren(parentQuery, childAttrs) {
	  const potentialParents = document.querySelectorAll(parentQuery);
	  for (let parent of potentialParents) {
		let allChildrenMatch = true;
		for (let attr of childAttrs) {
		  if (!parent.querySelector(attr)) {
			allChildrenMatch = false;
			break;
		  }
		}
		if (allChildrenMatch) {
		  return parent;
		}
	  }
	  return null;
	}


	const pattern = new RegExp('^https://(www\\.)?twitter\\.com/i/broadcasts/.*$', 'i');
	setInterval(function(){
		try {
			if (pattern.test(window.location.href)){
				var container = findElementByAttributeAndChildren("[tabIndex='0']",["textarea[inputmode='text']"]);
				if (!container.marked){
					container.marked=true;

					setTimeout(function(container){
						if (container){
							onElementInserted(container);
						}

					},1000, container);
				}
			}
		} catch(e){}
	},2000);

})();