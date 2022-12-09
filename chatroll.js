(function () {
	function toDataURL(blobUrl, callback) {
		var xhr = new XMLHttpRequest;
		xhr.responseType = 'blob';

		xhr.onload = function() {
		   var recoveredBlob = xhr.response;

		   var reader = new FileReader;

		   reader.onload = function() {
			 callback(reader.result);
		   };

		   reader.readAsDataURL(recoveredBlob);
		};

		xhr.open('GET', blobUrl);
		xhr.send();
	};

	var lastMessage = {};
	var lastName = "";
	var lastImage = "";

	function processMessage(ele){
		if (!ele){return;}
		
		var chatimg = "";
		try{
			chatimg = ele.querySelector(".profile-icon-image");
			chatimg = chatimg.style.backgroundImage.split("'")[1];
			chatimg = chatimg.split("'")[0];
		} catch(e){
		}
		
        var name = "";
		try {
			var tmp = ele.querySelector(".message-profile-name");
			tmp.childNodes.forEach(ele=>{
				if (ele.nodeName == "#text"){
					name = ele.textContent;
				} else if (ele.nodeName == "A"){
					name = ele.textContent;
				}
			});
		} catch(e){}
		

		if (name){
			name = name.replace("(Guest)","");
			name = name.trim();
	    }

		var msg = "";
		try {
			msg = ele.querySelector(".message-text").innerText;
		} catch(e){}
		
		if (msg){
			msg = msg.trim();
		}
		
		if (!msg){return;}

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
		data.type = "chatroll";

		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
	}
	var listener = false;
	
	function startListener(){
		if (listener){return;}
		listener = true;
		chrome.runtime.onMessage.addListener(
			function (request, sender, sendResponse) {
				try{
					if ("focusChat" == request){
						try {
							var ele = document.body.querySelector(".chat-input");
							if (ele){
								ele.focus();
								sendResponse(true);
								return;
							} 
						} catch(e){}
						
						sendResponse(false);
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
	}
	
	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
		}
	});

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].classList.contains("message")){  // ui-chat__item--message
								callback(mutation.addedNodes[i]);
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
		var tmp = document.body.querySelector('.chat-messages');
		if (tmp){
			if (!tmp.marked){
				tmp.marked=true;
				console.log("social stream started");
				setTimeout(function(ele){onElementInserted(ele, processMessage);},1000, tmp);
				startListener();
			}
		} 
	},2000);

})();
