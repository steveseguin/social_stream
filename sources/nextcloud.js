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
	
	var counter = 0;
	
	
	function processMessage(ele){
		
		
		
		var msg="";
		try {
			ele.querySelectorAll("[data-message-id]:not([data-skip])").forEach(ll=>{
				if (parseInt(ll.dataset.messageId)<=counter){
					return;
				}
				if (!parseInt(ll.dataset.messageId)){
					return;
				}
				counter = parseInt(ll.dataset.messageId);
				ll.dataset.skip = true;
				let m = ll.querySelector(".message-main__text");
				if (m && !m.skip){
					m.skip = true;
					msg += getAllContentNodes(m)+" ";
				}
			});
			if (!msg){return;}
			msg = msg.trim();
		} catch(e){
		}
		
		
		var chatimg = "";
		try{
		   chatimg = ele.querySelector(".messages__avatar img[src]").src;
		} catch(e){
			//console.error(e);
		}
		
		var name="";
		try {
			name = ele.querySelector(".messages__author").textContent.trim();
			
		} catch(e){
		}
		
		if (chatimg && name.includes(".") && name.includes("@")){
			try {
				name = chatimg.split("/avatar/")[1].split("/")[0].trim();
			} catch(e){}
		}
		
		if (name){
			name = escapeHtml(name);
		}
		
		if (!msg){
			return;
		}
		try {
			var data = {};
			
			if (ele.querySelector(".system")){
				data.event = "system";
			}
			
			data.chatname = name;
			data.chatbadges = "";
			data.backgroundColor = "";
			data.textColor = "";
			data.chatmessage = msg;
			data.chatimg = chatimg;
			data.hasDonation = "";
			data.membership = "";;
			data.contentimg = "";
			data.textonly = settings.textonlymode || false;
			data.type = "nextcloud";
			if (firstRun){
				pushMessage(data);
			}
		} catch(e){
			//console.error(e);
		}
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
				if ("getSource" == request){sendResponse("nextcloud");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('.input > input[type="text"][name^="chat_"]').focus();
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
	
	
	
	console.log("social stream injected");

	var firstRun = false;
	
	setInterval(function(){
		const allItems = document.querySelectorAll('.messages-list__scroller > .scroller__content > li');
		

		const items = [...allItems];
		
		// Get unprocessed items
		const unprocessedItems = items.filter(item => !item.dataset.done);
		
		// Get last processed item if it exists
		const processedItems = items.filter(item => item.dataset.done);
		const lastProcessedItem = processedItems.length ? processedItems[processedItems.length - 1] : null;
		
		// Create array of items to process
		const itemsToProcess = [...unprocessedItems];
		
		// Add last processed item if it exists
		if (lastProcessedItem) {
			itemsToProcess.push(lastProcessedItem);
		}
		// Process each item
		itemsToProcess.forEach(ele => {
			ele.dataset.done = true;
			processMessage(ele);
		});
		
		if (!firstRun){
			if (document.querySelector('.messages-list__scroller')){
				firstRun = true;
			}
		}
	}, 700);
	
})();