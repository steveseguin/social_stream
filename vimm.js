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
		name = ele.querySelector('b').innerText;
		if (name){
			name = name.trim();
		} else {
			name = "";
		}
		
		
		var chatimg = "https://www.vimm.tv/"+name+"/avatar";
		
		var msg = "";
		var start = true;
		ele.querySelector(".chatmessagerow").childNodes.forEach(ee=>{
			if (ee.nodeType == Node.TEXT_NODE){
				if (start){
					var t = ee.textContent.split(":");
					if (t.length>1){
						start = false;
					}
					t.shift();
					msg += t.join(":");
				} else {
					msg += ee.textContent;
				}
				msg = msg.trim();
			} else if (!textOnlyMode && (ee.nodeName  == "IMG")){
				msg += "<img src='"+ee.src+"' />";
				start = false;
				msg = msg.trim();
			} 
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
		data.type = "vimm";
		
		pushMessage(data);
		console.log(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
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
					document.querySelector('#chat-message-input').focus();
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
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].skip){return;}
							mutation.addedNodes[i].skip = true;
							processMessage(mutation.addedNodes[i]);
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
		if (document.querySelector('#chat-log')){
			if (!document.querySelector('#chat-log').marked){
				document.querySelector('#chat-log').marked=true;
				onElementInserted(document.querySelector('#chat-log'));
			}
		}
	},1000);

})();