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


	  if (ele.dataset && ele.dataset.testid && (ele.dataset.testid=="MessageRow")){
		  ele = ele.parentNode.parentNode.parentNode.parentNode;
	  }
	  
	  var chatimg = "";
	  try{
		   chatimg = ele.querySelector("[data-testid='MessageClusterIncoming']").querySelector('img').src;
	  } catch(e){ 
		try{
		   chatimg = ele.querySelector("[data-testid='MessageClusterOutgoing']").querySelector('img').src;
		} catch(e){ }
	  }
	  
	  if (chatimg){
		  chatimg = chatimg.split("?")[0] + "?max_width=256&square=true";
	  }
	  var name = "";
	  
	  try{
		  name = ele.querySelector("[data-testid='MessageSenderName']").innerText;
		  if (name){
			name = name.trim();
		  }
	  } catch(e){
		  try {
			  if (ele.querySelector("[data-testid='MessageClusterOutgoing']")){
				 name = document.querySelector(".nav-shortened-name").innerText;
			  }
		  } catch(e){}
	  }
	  
	  var msg = ""; // TextMessage
	  try {
		  var msgs = ele.querySelectorAll("[data-testid='TextMessage']");
		  for (var i = 0;i<msgs.length;i++){
			  try {
				if (msgs[i].checked){continue;}
				msgs[i].checked = true;
				msg = msgs[i].innerText;
				break;
			  } catch(e){ }
		  }
	  } catch(e){}
	  if (msg){
		msg = msg.trim();
	  }
	
	  if (!msg){
		  return;
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
	  data.type = "amazon";
	  
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
					document.querySelector("textarea").focus();
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
						console.log(xxx[i]);
						try {
							setTimeout(function(eee){callback(eee);},1000,xxx[i]);
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
		var target = document.querySelector("[class*='chatContainer']");
		if (target && !target.marked){
			target.marked=true;
			onElementInserted(target, function(element){
			   processMessage(element);
			});
		}
		
	},3000);

})();