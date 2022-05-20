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
		
		xhr.onerror = function() {callback(blobUrl);}

		xhr.open('GET', blobUrl);
		xhr.send();
	};

	var lastMessage = "";
	var lastImg = "";
	var lastTimestamp = Date.now();

	function processMessage(ele){
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		//console.log(ele);

		var chatimg = "";
		try {
			chatimg = ele.children[0].children[0].children[0].querySelector("img").src;
		} catch(e){
			//console.log(e);
		}
		
        var name = "";
		try {
			name =  ele.children[0].children[0].children[1].innerText;
			name = name.trim();
		} catch(e){
			//console.log(e);
		}
		
		if (!name){
			try {
				name = ele.querySelector(".MuiTypography-subtitle2").innerText;
				name = name.trim();
				} catch(e){
				//console.log(e);
			}
		}

		var msg = "";
		try {
			msg = ele.querySelector('.chat-text-normal').innerText;
		} catch(e){
			//console.log(e);
		}
		
		if (msg){
			msg = msg.trim();
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
		data.contentimg = "";
		data.type = "restream";
		
		
		if (data.lastMessage === lastMessage){
			if (data.chatimg != lastImg){
				if (Date.now() - lastTimestamp<1000){
					lastMessage = data.lastMessage;
					lastImg = data.chatimg;
					lastTimestamp = Date.now();
					return;
				}
			}
		}
		
		lastMessage = data.lastMessage;
		lastImg = data.chatimg;
		lastTimestamp = Date.now();
		
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
		} catch(e){
			//console.log(e);
		}
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
							ele = document.querySelector("input");
							if (ele){
								ele.focus();
								sendResponse(false);
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
							if (mutation.addedNodes[i].tagName == "DIV"){
								setTimeout(function(cb, ele){cb(ele);},1000, callback, mutation.addedNodes[i]);
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


	startListener();
	
	setInterval(function(){
		try {
			if (document.querySelector('#root')){
				if (!document.querySelector('#root').marked){
					document.querySelector('#root').marked=true;
					
					onElementInserted(document.querySelector('#root'), processMessage);
					
				}
			}
		} catch(e){}
	},2000);

})();
