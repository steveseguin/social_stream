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

	function getMessageElement(ele){
		if (!ele || ele.nodeType !== 1){return false;}
		if (ele.matches && ele.matches('[data-testid="message-item"]')){return ele;}
		if (ele.closest){
			var closestMessage = ele.closest('[data-testid="message-item"]');
			if (closestMessage){return closestMessage;}
		}
		if (ele.querySelector && ele.querySelector('[data-testid="message-text"]')){return ele;}
		return false;
	}

	function getText(ele){
		return (ele && ele.textContent || "").trim();
	}

	function getCircleMessageName(ele){
		var nameEle = ele.querySelector('[data-testid="open-profile-drawer"]');
		var name = getText(nameEle);
		
		if (!name){
			try {
				name = getText(ele.querySelector('[data-testid="number-of-replies"]'));
			} catch(e){}
		}
		
		if (!name){
			var profileButton = ele.querySelector('button[aria-label^="Open "][aria-label$=" profile"]');
			var label = profileButton ? profileButton.getAttribute("aria-label") : "";
			var match = label.match(/^Open (.*)'s profile$/);
			if (match && match[1]){
				name = match[1].trim();
			}
		}
		
		return escapeHtml(name || "");
	}

	function processAddedNode(node){
		if (!node || node.nodeType !== 1){return;}
		
		var messages = [];
		if (node.matches && node.matches('[data-testid="message-item"]')){
			messages.push(node);
		} else if (node.querySelectorAll){
			messages = Array.prototype.slice.call(node.querySelectorAll('[data-testid="message-item"]'));
		}
		
		if (messages.length){
			messages.forEach(function(message){
				processMessage(message);
			});
		} else {
			processMessage(node);
		}
	}


	function processMessage(ele){

		ele = getMessageElement(ele);
		if (!ele || ele.skip){return;}
		
		if (ele.querySelector('[data-testid="number-of-replies"]')?.parentElement?.textContent?.includes('Sending...')) {
		  // Ignore because it is still sending the message
		  return
		}

		//console.log(ele);
		var chatimg = "";
		try{
		   chatimg = ele.querySelector('[data-testid="user-image-element"]').src;
		} catch(e){
		//	console.warn(e);
		}

		var name="";
		name = getCircleMessageName(ele);

		var userid="";
		try {
			userid = ele.querySelector('[data-testid="number-of-replies"]').textContent.trim();
			userid = userid.replace("/","");
		} catch(e){
		//	console.warn(e);
		}
		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector('[data-testid="message-text"]'));
		} catch(e){
		//	console.warn(e);
		}

		var contentimg = "";
		if (!settings.textonlymode){
			try {
				var contentImage = ele.querySelector('[data-testid="message-text"] img[src]');
				contentimg = contentImage ? contentImage.src : "";
			} catch(e){}
		}

		if (!name || (!msg && !contentimg)){
			return;
		}
		try {
			
			
		} catch(e){}
		
		//console.log(circleUser);
		if (circleUser && circleUser.name && (name == "You")){
			name = circleUser.name;
		} else if ((name == "You") && ele.querySelector("svg[class^='icon icon-host']")){
			name = "Host";
		}

		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.userid = userid;
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "circle";

	//	console.log(data);
		pushMessage(data);
		ele.skip = true;
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
				if ("getSource" == request){
					sendResponse("circle");
					return;
				}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
				
					var chatInput = document.querySelector('#tiptapMessageTextBox [contenteditable="true"], div.tiptap.ProseMirror[contenteditable="true"], textarea');
					if (chatInput){chatInput.focus();}
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
	
	var enabledState = false;
	
	
	function checkUrlAndRunScript(e=false) {
		if (window.location.href.includes("/live/")){
			enabledState = true;
		} else {
			enabledState = false;
		}
		return enabledState;
	}

	window.addEventListener('popstate', checkUrlAndRunScript);


	function onElementInserted(target) {

		var onMutationsObserved = function(mutations) {
			
			if (!checkUrlAndRunScript()){return;}
			
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							processAddedNode(mutation.addedNodes[i]);
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

	function getCircleUser() {
	  const script = document.createElement('script');
	  script.textContent = `
		const circleUser = window.circleUser;
		document.dispatchEvent(new CustomEvent('GET_CIRCLE_USER', { detail: circleUser }));
	  `;
	  (document.head || document.documentElement).appendChild(script);
	  script.remove();
	}
	
	var circleUser = false;
	document.addEventListener('GET_CIRCLE_USER', function(event) {
	  if (event.detail && event.detail.name){
		circleUser = event.detail;
	  }
	  console.log(circleUser);
	});
	
	setInterval(function(){
		try {
			if (!checkUrlAndRunScript()){return;}
			var messageScrollViews = document.querySelectorAll('#message-scroll-view');
			if (messageScrollViews.length){
				Array.prototype.forEach.call(messageScrollViews, function(messageScrollView){
					if (!messageScrollView.marked){
						messageScrollView.marked=true;
						console.log("CONNECTED chat detected");
					
						onElementInserted(messageScrollView);
						getCircleUser();
					
					}
				});
			}
		} catch(e){}
	},2000);

})();
