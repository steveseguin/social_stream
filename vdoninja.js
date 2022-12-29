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
	  var name = "";
	  try {
		name = ele.querySelector(".chat_name").innerText;
		if (name){
			name = name.trim();
		}
	 } catch(e){}
	  
	  var msg = "";
	  try {
		msg = ele.querySelector('.chat_message ').innerText;
	  } catch(e){
		return;
	  }
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
	  data.chatimg = "";
	  data.hasDonation = "";
	  data.hasMembership = "";;
	  data.contentimg = "";
	  data.type = "vdoninja";
	  
	  pushMessage(data);
	}

	function pushMessage(data){
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
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
				if ("focusChat" == request){
					document.querySelector("#chatInput").focus();
					sendResponse(true);
					return;
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

	function onElementInserted(containerSelector, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					var xxx = mutation.addedNodes;
					for (var i = 0; i< xxx.length; i++) {
						try {
							var ele = xxx[i];
							if (ele && ele.className && (ele.classList.contains("outMessage") || ele.classList.contains("inMessage"))){
								callback(ele);
							} 
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
	
	if (document.querySelectorAll("#chatBody").length){
		if (!document.querySelector("#chatBody").marked){
			document.querySelector("#chatBody").marked=true;
			onElementInserted("#chatBody", function(element){
			   processMessage(element);
			});
		}
	}
	
	setInterval(function(){
		if (document.querySelectorAll("#chatBody").length){
			if (!document.querySelector("#chatBody").marked){
				document.querySelector("#chatBody").marked=true;
				onElementInserted("#chatBody", function(element){
				   processMessage(element);
				});
			}
		}
	},3000);

})();