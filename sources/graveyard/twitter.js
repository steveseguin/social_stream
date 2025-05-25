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
						node.src.startsWith('http') || (node.src = node.src + "");
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	function isColorVeryDark(color) {
		const rgb = color.match(/\d+/g).map(Number);

		const R = rgb[0] / 255;
		const G = rgb[1] / 255;
		const B = rgb[2] / 255;

		const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;

		const darkThreshold = 0.2; 

		return luminance < darkThreshold;
	}
	
	function processMessage(ele){
		var chatname="";
		var msg="";
		var chatimg = "";
		//console.log(ele);
		
		try {
			var nameElement = ele.childNodes[0].childNodes[1].childNodes[0];
			chatname = escapeHtml(nameElement.textContent.trim());
			chatname = chatname.split(":")[0];
			
			try {
				chatimg = ele.childNodes[0].childNodes[0].querySelector("img[src]").src;
			} catch(e){
			}
			
		} catch(e){	
			try {
				var nameElement = ele.childNodes[0].childNodes[0].childNodes[0];
				chatname = escapeHtml(nameElement.textContent.trim());
				chatname = chatname.split(":")[0];
			} catch(e){	
				return;
			}
		}
		try {
			try {
				var node = ele.childNodes[0].childNodes[1].childNodes[1];
				msg = getAllContentNodes(node);
			} catch(e){
				//console.error(e);return;
			}
			msg = msg.trim();

		} catch(e){
			////console.log(e);
			return;
		}
		
		var nameColor = "";
		try {
			nameColor = getComputedStyle(nameElement.querySelector("div>span>span>span").parentNode.parentNode).color;
			if (nameColor){
				 if (isColorVeryDark(nameColor)){ // we want to exclude very dark names.
					 nameColor = "";
				 }
			}
		} catch(e){
			//console.log(e);
		}
		if (chatname.startsWith("This broadcast has ended")){
			return;
		}

		//console.log(msg);
		//console.log(chatname);
		if (!msg || !chatname){
			return;
		}
		
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
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		
		//console.log(data);
		
		if (settings.detweet){
			data.type = "twitter";
		} else {
			data.type = "x";
		}
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
				if ("getSource" == request){sendResponse("twitter");	return;	}
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
	var messageHistory = [];
	
	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					try {
						for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
							if (mutation.addedNodes[i].tagName && (mutation.addedNodes[i].tagName == "DIV") && mutation.addedNodes[i].childNodes && mutation.addedNodes[i].parentNode && (mutation.addedNodes[i].parentNode.tagName == "DIV")){
								setTimeout(function(ele){
									processMessage(ele);
								},500,mutation.addedNodes[i]);
							}
						}
					} catch(e){}
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
	
	try {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.visibilityState = "visible";
		document.mozHidden = false;
		document.webkitHidden = false;
	} catch(e){	}

	try {
		document.hasFocus = function () {return true;};
		window.onFocus = function () {return true;};
		
		Object.defineProperty(document, "mozHidden", { value : false});
		Object.defineProperty(document, "msHidden", { value : false});
		Object.defineProperty(document, "webkitHidden", { value : false});
		Object.defineProperty(document, 'visibilityState', { get: function () { return "visible"; }, value: 'visible', writable: true});
		Object.defineProperty(document, 'hidden', {value: false, writable: true});
		
		setInterval(function(){
			console.log("set visibility");
			window.onblur = null;
			window.blurred = false;
			document.hidden = false;
			document.visibilityState = "visible";
			document.mozHidden = false;
			document.webkitHidden = false;
			document.dispatchEvent(new Event("visibilitychange"));
		},200);
	} catch(e){	}

	try {
		document.onvisibilitychange = function(){
			window.onFocus = function () {return true;};
			
		};
	} catch(e){	}

	try {
		for (event_name of ["visibilitychange",
			"webkitvisibilitychange",
			"blur", // may cause issues on some websites
			"mozvisibilitychange",
			"msvisibilitychange"]) {
				try{
					window.addEventListener(event_name, function(event) {
						event.stopImmediatePropagation();
						event.preventDefault();
					}, true);
				} catch(e){}
		}
	} catch(e){	}


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