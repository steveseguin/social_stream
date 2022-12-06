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
		try {
			name = ele.dataset.username;
		} catch(e){
			return;
		}
		
		var msg = "";
		try {
			ele.querySelector('.msg-text').childNodes.forEach(ee=>{
				if (ee.nodeType == Node.TEXT_NODE){
					msg += ee.textContent;
				} else if (textOnlyMode && ee.alt && (ee.nodeName  == "IMG")){
					msg += ee.alt;
				} else if (!textOnlyMode&& (ee.nodeName  == "IMG")){
					msg += "<img src='"+ee.src+"' />";
				}  else {
					msg += ee.textContent;
				}
			});
		}catch(e){msg = "";}
		
		var chatimg = '';
		try {
			chatimg = ele.querySelector(".pmessage__avaimg");
			chatimg = "https://cdn.locals.com/images/avatars/" + chatimg.style.cssText.split("https://cdn.locals.com/images/avatars/")[1];
			chatimg = chatimg.split(".png")[0] + ".png";
		} catch (e){
			chatimg = "";
		}
		
		var contentimg = "";
		try {
			contentimg =  ele.querySelector(".message-photo img[src]").src;
		} catch(e){
			contentimg = "";
		}
		
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = contentimg;
		data.type = "locals";
		
		console.log(data);
		
		if (!contentimg && !msg){return;}
		
		pushMessage(data);
		
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
			console.error(e);
		}
	}
	
	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('#chat-message-value').focus();
					sendResponse(true);
					return;
				}
				if ("textOnlyMode" == request){
					textOnlyMode = true;
					sendResponse(true);
					return;
				} else if ("richTextMode" == request){
					textOnlyMode = false;
					sendResponse(true);
					return;
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
						console.log(ele);
						if (ele && ele.nodeName && ele.nodeName == "DIV"){
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
		if (document.getElementById('chat-history')){
			if (!document.getElementById('chat-history').marked){
				document.getElementById('chat-history').marked=true;
				setTimeout(function(){
					document.getElementById('chat-history').childNodes.forEach(ele=>{
						if (ele && ele.nodeName && ele.nodeName == "DIV"){
							ele.skip = true;
						}
					});
					onElementInserted(document.getElementById('chat-history'));
				},3000);
			}
		}
	},1000);

})();