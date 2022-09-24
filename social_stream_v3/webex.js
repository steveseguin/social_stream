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

	  if (ele && ele.marked){
		  return;
	  } else {
		  ele.marked = true;
	  }
	  
	  var chatimg = "";
	 // try{
		//   chatimg = ele.querySelector("img.presence-entity__image.avatar").src;
		//   if (chatimg.startsWith("data:image/gif;base64")){
		//	   chatimg="";
		//   }
	 // } catch(e){ }
	 
	  var name = ele.querySelector("[class^='style-chat-label-']").innerText;
	  if (name){
		if (name.startsWith("from ")){
			name = name.replace("from ","");
			name = name.replace(" to Everyone","");
		}
		name = name.trim();
	  }
	  
	  var msg = "";
	  try {
		msg = ele.querySelector('[class^="style-chat-msg-"]').innerText;
	  } catch(e){
		
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
	  data.type = "webex";
	  
	   if (data.contentimg){
		  toDataURL(contentimg, function(dataUrl) {
			  data.contentimg = dataUrl;
			  if (data.chatimg){
					toDataURL(data.chatimg, function(dataUrl) {
						data.chatimg = dataUrl;
						pushMessage(data);
					});
			  } else {
				   pushMessage(data);
			  }
		  });
		} else if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
	  
	}

	function pushMessage(data){
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
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
				if ("focusChat" == request){
					document.querySelector("div[class^='style-text-container-']>textarea").focus();
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

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					var xxx = mutation.addedNodes;
					for (var i = 0; i< xxx.length; i++) {
						try {
							var ele = xxx[i];
							if (ele.NodeType==8){
								continue;
							}
							console.log(ele);
							if (ele && ele.className && ele.className.includes("style-item-not-first")) {
								callback(ele);
							} else if (ele && ele.tagName=="SECTION"){
								callback(ele);
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
	
	document.querySelectorAll('iframe').forEach( item =>{
		try{
			if (item.contentWindow.document.body.querySelectorAll("#chat-panel").length){
				var ele = item.contentWindow.document.body.querySelector("#chat-panel");
				if (!ele.marked){
					ele.marked=true;
					onElementInserted(ele, function(element){
					   processMessage(element);
					});
				}
			}
		} catch(e){}
	});
	
	setInterval(function(){
		document.querySelectorAll('iframe').forEach( item =>{
			try{
				if (item.contentWindow.document.body.querySelectorAll("#chat-panel").length){
					var ele = item.contentWindow.document.body.querySelector("#chat-panel");
					if (!ele.marked){
						ele.marked=true;
						onElementInserted(ele, function(element){
						   processMessage(element);
						});
					}
				}
			} catch(e){}
		});
	},3000);

})();