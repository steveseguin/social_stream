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
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}

		var chatimg = "";
		try{
			chatimg = ele.querySelector('[data-tid="message-avatar"]').querySelector("img").src;
		} catch(e){
			
			if (!chatimg){
				try {
					chatimg = document.querySelector("profile-picture>.user-picture").src;
				} catch(e){
					//console.error(e);
				}
			}
				
		}
		
		
        var name = "";
		if (ele.querySelector(".ui-chat__message__author")){
			name = ele.querySelector(".ui-chat__message__author").innerText;
		} 

		if (!chatimg){
			try {
				var prev = ele;
				for (var i=0; i<50;i++){
					if (prev.querySelector('.ui-chat__message__timestamp')){
						if (window.getComputedStyle(prev.querySelector('.ui-chat__message__timestamp')).width != "1px"){
							break;
						} else {
							prev = prev.previousElementSibling;
						}
					} else {
						prev = prev.previousElementSibling;
					}
				}
				chatimg = prev.querySelector('[data-tid="message-avatar"]').querySelector("img").src
				name = prev.querySelector(".ui-chat__message__author").innerText;
				
			} catch(e){} 
		}
		
		if (name){
		  name = name.trim();
	    }

		var msg = "";
		try {
			msg = ele.querySelector('.ui-chat__message__content, .ui-chat__messagecontent').innerText;
		} catch(e){}
		
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
		data.type = "teams";

		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
	}
	
	function processMessage2(mainEle){
		if (mainEle && mainEle.marked){
		  return;
		} else {
		  mainEle.marked = true;
		}
		var ele = mainEle.querySelector('.message-body');
		if (!ele){return;}
		
		var chatimg = "";
		try{
			chatimg = mainEle.querySelector('profile-picture').querySelector("img").src;
		} catch(e){
			
		}
		
        var name = "";
		try {
			name = ele.querySelector("div[data-tid='threadBodyDisplayName']").innerText;
		} catch(e){}
		

		if (!chatimg){
			try {
				var prev = mainEle;
				for (var i=0; i<50;i++){
					if (prev.querySelector('.timestamp-column')){ //  ts-message-list-item
						if (window.getComputedStyle(prev.querySelector('.timestamp-column')).width != "1px"){
							break;
						} else {
							prev = prev.previousElementSibling;
						}
					} else {
						prev = prev.previousElementSibling;
					}
				}
				chatimg = prev.querySelector('profile-picture').querySelector("img").src
				name = prev.querySelector("div[data-tid='threadBodyDisplayName']").innerText;
				
			} catch(e){} 
		}
		
		if (name){
		  name = name.replace("(Guest)","");
		  name = name.trim();
	    }

		var msg = "";
		try {
			msg = ele.querySelector("div[data-tid='messageBodyContent']").innerText;
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
		data.type = "teams";

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
							var ele = document.querySelector('iframe').contentWindow.document.body.querySelector(".cke_textarea_inline[contenteditable='true']");
							if (ele){
								ele.focus();
								sendResponse(true);
								return;
							} 
						} catch(e){}
						
						try {
							ele = document.body.querySelector(".cke_textarea_inline[contenteditable='true']");
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
							if (mutation.addedNodes[i].classList.contains("ui-chat__item--message")){  // ui-chat__item--message
								setTimeout(function(eee){callback(eee);},300, mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].classList.contains("ts-message-list-item")){  // ui-chat__item--message
								setTimeout(function(eee){callback(eee);},300, mutation.addedNodes[i]);
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
		
		document.querySelectorAll('iframe').forEach( item =>{
			if (item && item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]')){
				if (!item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]').marked){
					lastName = "";
					lastImage = "";
					item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]').marked=true;
					
					setTimeout(function(ele){onElementInserted(ele, processMessage);},1000, item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]'));
					
					startListener();
				}
			} 
		});
		try{
			if (document.querySelector('context-message-pane')){
				if (!document.querySelector('context-message-pane').marked){
					lastName = "";
					lastImage = "";
					document.querySelector('context-message-pane').marked=true;
					setTimeout(function(ele){onElementInserted(ele, processMessage2);},1000, document.querySelector('context-message-pane'));
					
					startListener();
				}
			}
		} catch(e){}
	},1000);

})();
