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
	
	var messageHistory = [];
	
	
	function processMessage(ele){
		
		var chatimg = ""

		try {
			chatimg = ele.querySelector("img.rounded-full").src;
		} catch(e){
		}
		var nameColor = "";
		var name="";
		try {
			name = escapeHtml(ele.querySelector(".message-body-inner").childNodes[0].textContent.trim());
			try {
				nameColor = getComputedStyle(ele.querySelector(".message-body-inner").childNodes[0].querySelector("span")).color || "";
			} catch(e){}
		} catch(e){
		}

		var msg="";
		try {
			msg = getAllContentNodes(ele.querySelector(".message-body-inner").childNodes[1]).trim();
		} catch(e){
		}
		
		var contentimg = "";
		try {
			contentimg = ele.querySelector(".chat_sticker").style.backgroundImage.split('"')[1].trim();
		} catch(e){
		}
		
		var chatbadges = [];
		try {
			ele.querySelector(".message-body-inner").childNodes[0].querySelectorAll("img[src], svg").forEach(badge=>{
				try {
					if (badge && badge.nodeName == "IMG"){
						var tmp = {};
						tmp.src = badge.src;
						tmp.type = "img";
						chatbadges.push(tmp);
					} else if (badge && badge.nodeName.toLowerCase() == "svg"){
						var tmp = {};
						try {
							badge.style.width = "18px";
							badge.style.height = "18px";
							badge.style.padding = "0";
							badge.style.margin = "0";
							badge.style.backgroundColor = getComputedStyle(badge).backgroundColor || "";
							badge.style.color = getComputedStyle(badge).color || "";
						} catch(e){console.log(e);}
						tmp.html = badge.outerHTML;
						tmp.type = "svg";
						chatbadges.push(tmp);
					}
				} catch(e){  }
			});
		} catch(e){  }

		if ((!msg && !contentimg) || !name ){
			return;
		}
		
		if (messageHistory.includes(name+"_"+msg+contentimg)) {
			//console.log("Message already exists");
			return;
		} else {
			messageHistory.push(name+"_"+msg+contentimg);
			setTimeout(function(){
				messageHistory = messageHistory.slice(1);
			},5000);
		}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = chatbadges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = contentimg;
		data.type = "cozy";
		
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
	
	
	function onElementInserted(target) {
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
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
			document.querySelectorAll('.flex.scrollbar-pretty.text-base').forEach(container=>{ // more than one #message .. tsk ;)
				if (!container.marked){
					container.marked=true;

					console.log("CONNECTED chat detected");

					setTimeout(function(){

						[...container.childNodes].forEach(ele=>{
							ele.skip=true;
							//processMessage(ele);
						});
						onElementInserted(container);

					},1000);
				}
			});
		} catch(e){}
	},2000);

})();