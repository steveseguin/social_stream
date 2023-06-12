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
	
	function processMessage(ele){
		var name="";
		var xx = ele.querySelectorAll('div > span > span > span');
		name = xx[xx.length- 1].textContent
		if (name){
			name = name.trim();
		} else {
			return;
		}
		
		var chatimg = '';
		
		var msg = "";
		var nodes = ele.querySelectorAll("div > span > span")[2];
		nodes.childNodes.forEach(ee=>{
			try {
				if (ee.nodeType == Node.TEXT_NODE){
					msg += ee.textContent;
					msg = msg.trim();
				} else if (!settings.textonlymode && (ee.nodeName  == "IMG")){
					msg += "<img src='"+ee.src+"' />";
					msg = msg.trim();
				} else if (ee.childNodes){
					ee.childNodes.forEach(eee=>{
						if (eee.nodeType == Node.TEXT_NODE){
							msg += eee.textContent;
							msg = msg.trim();
						} else if (!settings.textonlymode && (eee.nodeName  == "IMG")){
							msg += "<img src='"+eee.src+"' />";
							msg = msg.trim();
						} 
					});
				}
			} catch(e){}
		});
		
		if (!msg.length){return;}
		
		
		
		var dono = "";
		//if (ele.querySelector('.chat-history--rant-price')){
		//	dono = ele.querySelector('.chat-history--rant-price').innerText;
		//}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = dono;
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "nonolive";
		
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
					document.querySelector('#create__comment').focus();
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

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].skip){return;}
							mutation.addedNodes[i].skip = true;
							console.log(mutation.addedNodes[i]);
							if (mutation.addedNodes[i].parentNode.classList.contains("message-list")){
								processMessage(mutation.addedNodes[i]);
							}
						} catch(e){}
					}
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		if (document.querySelector('#message-list-container')){
			if (!document.querySelector('#message-list-container').marked){
				document.querySelector('#message-list-container').marked=true;
				onElementInserted(document.querySelector('#message-list-container'));
			}
		}
	},1000);

})();