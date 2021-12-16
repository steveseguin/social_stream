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
	  
	  console.log(ele);
	  
	  var chatimg = "";
	  try{
		   chatimg = ele.querySelector(".avatar-s").style.backgroundImage.split(/"/)[1];
	  } catch(e){ }
	 
	  var name = ele.querySelector(".name").innerText;
	  if (name){
		name = name.trim();
	  }
	  
	  var msg = "";
	  try {
		msg = ele.querySelector('.message-content-main').innerText;
	  } catch(e){
		
	  }
	  if (msg){
		msg = msg.trim();
		if (name){
			if (msg.startsWith(name)){
				msg = msg.replace(name, '');
				msg = msg.trim();
			}
		}
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
	  data.type = "crowdcast";
	  
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

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector("textarea#input-chat").focus();
					sendResponse(true);
					return;
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
							
							if (ele.NodeType==8){
								continue;
							}
							if (ele && ele.className && ele.classList.contains("message")) {
								callback(ele);
								console.log(1);
							} else if (ele.parentNode.parentNode && ele.parentNode.parentNode.className && ele.parentNode.parentNode.classList.contains("message")) {
								callback(ele.parentNode.parentNode);
								console.log(4);
							} else if (ele.parentNode.parentNode.parentNode && ele.parentNode.parentNode.parentNode.className && ele.parentNode.parentNode.parentNode.classList.contains("message")) {
								callback(ele.parentNode.parentNode.parentNode);
								console.log(5);
							}
						} catch(e){console.error(e);}
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
	onElementInserted("div.chat-messages", function(element){
	   processMessage(element);
	});
	
	setInterval(function(){
		if (document.querySelectorAll("div.chat-messages").length){
			if (!document.querySelector("div.chat-messages").marked){
				document.querySelector("div.chat-messages").marked=true;
				onElementInserted("div.chat-messages", function(element){
				   processMessage(element);
				});
			}
		}
	},3000);

})();