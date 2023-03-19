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
		
		var msg = ele.textContent;
		
		
		var data = {};
		data.chatname = "";
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = "";
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "tellonym";
		
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
	// settings.streamevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
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
						if (ele){
							var ttt = ele.querySelector("div>div>div>div>span");
							if (ttt && !ttt.skip){
								ttt.skip = true;
								processMessage(ttt);
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
		var chatContainer = document.querySelector('#root')
		if (chatContainer){
			if (!chatContainer.marked){
				console.log("social stream activated");
				chatContainer.marked=true;
				chatContainer.querySelectorAll("div>div>div>div>span").forEach(ele=>{
					ele.skip = true;
				//	processMessage(ele); // we don't want to process existing messages.
				});
				onElementInserted(chatContainer);
			}
			}
	},1000);

})();