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
	
	var lastMessage = "";
	var lastName = "";
	var timer = null;
	
	function processMessage(ele){
		var name="";
		try {
			name = ele.dataset.username || "";
			
		} catch(e){
			name = "";
		}
		
		if (!name){
			name = ele.childNodes[0].childNodes[1].innerText;
		}
		
		var msg = "";
		try {
			ele.childNodes[1].childNodes.forEach(ee=>{
				if (ee.nodeType == Node.TEXT_NODE){
					msg += ee.textContent;
				} else if (settings.textonlymode && ee.alt && (ee.nodeName  == "IMG")){
				//	msg += ee.alt;
				} else if (!settings.textonlymode&& (ee.nodeName  == "IMG")){
					msg += "<img src='"+ee.src+"' />";
				}  else {
					msg += ee.textContent;
				}
			});
		}catch(e){msg = "";}
		
		msg = msg.trim();
		
		var chatimg = '';
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "wix";
		
		if ((lastMessage == msg) && (lastName == name)){
			return;
		}
		lastMessage = msg;
		lastName = name;
		clearTimeout(timer);
		timer = setTimeout(function(){
			lastMessage = null;
			lastName = null;
		},2000);
		
		if (!msg){return;}
		
		pushMessage(data);
		
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
			console.error(e);
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
					if (window.location.pathname.includes("live-video")){
						document.querySelector('textarea').focus();
						sendResponse(true);
						return;
					}
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
			if ( mutations[0] && mutations[0].addedNodes){
				var nodes = mutations[0].addedNodes;
				for (var i=0;i<nodes.length;i++){
					try {
						var ele = nodes[i];
						if (ele && ele.parentNode && (ele.parentNode.dataset.hook=="MESSAGES_CONTAINER")){
							if (!ele.skip){
								ele.skip = true;
								processMessage(ele);
							}
						}
					}catch(e){console.error(e)}
				}
			}
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		if (window.location.pathname.includes("live-video")){
			var chatContainer = document.querySelector('[data-hook="MESSAGES_CONTAINER"]')
			if (chatContainer){
				if (!chatContainer.marked){
					console.log("social stream activated");
					chatContainer.marked=true;
					chatContainer.childNodes.forEach(ele=>{
						if (ele && ele.nodeName && ele.nodeName == "DIV"){
							ele.skip = true;
						}
					});
					onElementInserted(chatContainer);
				}
			}
		}
	},1000);

})();