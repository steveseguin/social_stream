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
			//document.querySelector("iframe").contentWindow.document.body.querySelectorAll("img")[document.querySelector("iframe").contentWindow.document.body.querySelectorAll("img").length-1].src;
		} catch(e){
			
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
			msg = ele.querySelector('.ui-chat__message__content').innerText;
		} catch(e){
		}
		if (msg){
			msg = msg.trim();
			/* if (name){
				if (msg.startsWith(name)){
					msg = msg.replace(name, '');
					msg = msg.trim();
				}
			} */
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
						document.querySelector('iframe').contentWindow.document.body.querySelector(".cke_textarea_inline[contenteditable='true']").focus();
						sendResponse(true);
						return;
					}
				} catch(e){}
				sendResponse(false);
			}
		);
	}

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].classList.contains("ui-chat__item--message")){  // ui-chat__item--message
								setTimeout(function(eee){processMessage(eee);},300, mutation.addedNodes[i]);
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
			if (item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]')){
				if (!item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]').marked){
					lastName = "";
					lastImage = "";
					item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]').marked=true;
					
					setTimeout(function(ele){onElementInserted(ele);},6000, item.contentWindow.document.body.querySelector('[data-view="message-pane-list-viewport"]'));
					
					startListener();
				}
			} 
		});
	},1000);

})();
