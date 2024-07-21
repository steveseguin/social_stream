(function () {
	
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


	function processMessage(ele){

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
		try {
			name = ele.querySelector('[data-testid="number-of-replies"]').textContent.trim();
			name = escapeHtml(name);
		} catch(e){
		//	console.warn(e);
		}

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

		if (!name || !msg){
			return;
		}
		try {
			
			
		} catch(e){}
		
		//console.log(circleUser);
		if (circleUser && circleUser.name && name == "You" && ele.querySelector("svg[class^='icon icon-host']")){
			name = circleUser.name;
		} else if (name == "You" && ele.querySelector("svg[class^='icon icon-host']")){
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
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "circle";

	//	console.log(data);

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
		if (document.querySelector('#message-scroll-view')){
			if (!document.querySelector('#message-scroll-view').marked){
				document.querySelector('#message-scroll-view').marked=true;
				console.log("CONNECTED chat detected");
				
				onElementInserted('#message-scroll-view');
				getCircleUser();
				
			}
		}} catch(e){}
	},2000);

})();
