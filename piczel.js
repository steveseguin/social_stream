(function () {
	function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}

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
	
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
	}
	
	function digInto(eles){
		var chatmessage = "";
		eles.forEach(ele2=>{
			try {
				if (ele2.nodeType == Node.TEXT_NODE){
					chatmessage += ele2.textContent;
				} else if (ele2 && ele2.querySelector && ele2.querySelector("img[src]")){
					chatmessage += "<img src='"+ele2.querySelector("img[src]").src+"'/>";
				} else {
					chatmessage += digInto(ele2.childNodes);
				}
			} catch(e){}
		});
		return chatmessage;
	}
	
	async function processMessage(content){
		
		
		var buttons = content.querySelectorAll("button");
		
		var chatname="";
		try{
			chatname = buttons[1].textContent;
		} catch(e){
			chatname = "";
		}
		
		var chatimg="";
		try{
			chatimg = buttons[0].querySelector("img").src;
		} catch(e){
			chatimg = "";
		}
		
		
		
		var chatmessage="";
		try{
			 if (textOnlyMode){
				chatmessage = buttons[1].nextSibling.textContent;
			 } else {
				chatmessage = digInto(buttons[1].nextSibling.childNodes)
			 }
		} catch(e){
			return;
		}

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";;
	  data.contentimg = "";
	  data.type = "piczel";
	  
	  if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
			
	}
	
	
	function onElementInserted(containerSelector, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (!mutation.addedNodes[i].children.length){continue;}
							if (mutation.addedNodes[i].dataset.set123){continue;}
							mutation.addedNodes[i].dataset.set123 = "true";
							
							callback(mutation.addedNodes[i]);
								
						} catch(e){}
					}
				}
			});
		};
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	console.log("social stream injected");
	
	
	setInterval(function(){ // clear existing messages; just too much for a stream.
		if (document.querySelector("#PiczelChat") && !document.querySelector("#PiczelChat").marked){
			document.querySelector("#PiczelChat").marked = true;
			console.log("LOADED SocialStream EXTENSION");
			
			try { 
				var main = document.querySelector("#PiczelChat").childNodes[0].childNodes[0].childNodes[3].childNodes[0].childNodes[0].childNodes;
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
							//processMessage(main[j]);
						} 
					} catch(e){}
				}
			} catch(e){ }
			
			onElementInserted("#PiczelChat", function(first){
				processMessage(first);
			});
		}
		
	},2000);

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
				if ("focusChat" == request){
					if (!document.querySelector("[class='cm-line']")){
						sendResponse(false);
						return;
					}
					document.querySelector("[class='cm-line']").focus();
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
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();