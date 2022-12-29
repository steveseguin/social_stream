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


	var lastDataIndex = -1;
	
	function processMessage(ele){

	  if (ele && ele.marked){
		  return;
	  } else {
		  ele.marked = true;
	  }
	  
	  if (ele.dataset && ("listIndex" in ele.dataset) && (parseInt(ele.dataset.listIndex)<=lastDataIndex)){
		  return;
	  } else if ("listIndex" in ele.dataset){
		  lastDataIndex = parseInt(ele.dataset.listIndex);
	  }
	  
	  var chatimg = "";
	  try{
		   chatimg = ele.querySelector("img.presence-entity__image.avatar").src;
		   if (chatimg.startsWith("data:image/gif;base64")){
			   chatimg="";
		   }
	  } catch(e){ }
	 
	  var name = ele.querySelector(".comments-post-meta__name-text").innerText;
	  if (name){
		name = name.trim();
	  }
	  
	  var msg = "";
	  try {
		msg = ele.querySelector('.comments-comment-item__main-content').innerText;
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
	  data.type = "linkedin";
	  
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
					document.querySelector("div.editor-content.ql-container>div.ql-editor>p").focus();
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
							if (ele.NodeType==8){
								continue;
							}
							if (ele && ele.className && ele.classList.contains("video-live-comments__comment-item")) {
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
	
	var interval = setInterval(function(){
		if (window.location.pathname.startsWith("/video/live") || window.location.pathname.startsWith("/video/event")  || window.location.pathname.startsWith("/video/golive/")){
			console.log("socialstream loaded");
			if (document.querySelectorAll(".video-live-comments").length){
				if (!document.querySelector(".video-live-comments").marked){
					document.querySelector(".video-live-comments").marked=true;
					clearInterval(interval);
					onElementInserted(".video-live-comments", function(element){
					   processMessage(element);
					});
				}
			}
			
		}
	},3000);

})();