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
		
		try {
			ele = ele.childNodes[0];
		} catch(e){
			return;
		}

		var chatimg = ""

		
		var name="";
		try {
			name = escapeHtml(ele.childNodes[0].childNodes[0].querySelector("button").textContent.trim());
		} catch(e){
			return;
		}

		var msg="";
		try {
			msg = getAllContentNodes(ele.childNodes[0].childNodes[2]);
		} catch(e){
			return;
		}
		
		var chatbadges = [];
		ele.childNodes[0].childNodes[0].querySelectorAll("img[src]").forEach(img=>{
			img.src = img.src+"";
			chatbadges.push(img.src);
		});
		

		if (!msg || !name){
			return;
		}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "vstream";
		
		//console.log(data);
		
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
					document.querySelector('form div[contenteditable="true"] > p').focus();
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
		
		var config = { childList: true, subtree: false }; // sub tree turned off; only children, no grand children
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
		if (document.querySelector('#root')){
			if (!document.querySelector('#root').marked){
				document.querySelector('#root').marked=true;

				console.log("CONNECTED chat detected");

				setTimeout(function(){

					document.querySelectorAll(".w-full > .max-h-full > div").forEach(ele=>{
						ele.skip=true;
						//processMessage(ele);
					});

					onElementInserted('.w-full > .max-h-full');

				},1000);


			}
		}} catch(e){}
	},2000);

})();