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

	function escapeHtml(unsafe){
		try {
			if (settings.textonlymode){ // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				 .replace(/&/g, "&amp;")
				 .replace(/</g, "&lt;")
				 .replace(/>/g, "&gt;")
				 .replace(/"/g, "&quot;")
				 .replace(/'/g, "&#039;") || "";
		} catch(e){
			return "";
		}
	}

	function getAllContentNodes(element) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}

	var lastDataIndex = -1;
	
	function processMessage(ele){
		
	  if (ele && ele.marked){
		  return;
	  } else {
		  ele.marked = true;
	  }
	  
	  console.log(ele);
	  
	  if (ele.dataset && ("listIndex" in ele.dataset) && (parseInt(ele.dataset.listIndex)<=lastDataIndex)){
		  return;
	  } else if ("listIndex" in ele.dataset){
		  lastDataIndex = parseInt(ele.dataset.listIndex);
	  }
	  
	  var chatimg = "";
	  try{
		   chatimg = ele.querySelector("img.presence-entity__image[src], img.avatar[src]").src;
		   if (chatimg.startsWith("data:image/gif;base64")){
			   chatimg="";
		   }
	  } catch(e){ }
	 
	  var name = "";
	  
	  try{
		  name = ele.querySelector(".comments-post-meta__name-text > span > span[aria-hidden='true']").textContent;
		  name = escapeHtml(name);
	  } catch(e){
		  
	  }
	  if (name){
		name = name.trim();
	  } else {
		  name = ele.querySelector(".comments-post-meta__name-text").textContent;
		  if (name){
			name = name.trim();
			name = escapeHtml(name);
		  }
	  }
	  
	  var msg = "";
	  try {
		msg = ele.querySelector('.comments-comment-item__main-content').textContent;
		msg = escapeHtml(msg);
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
	  data.textonly = settings.textonlymode || false;
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
	// settings.captureevents
	
	
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
		
		var target = document.querySelector(containerSelector);
		if (!target){return;}
		
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					target.querySelectorAll(".video-live-comments:not([data-marked]), .video-live-comments__comment-item:not([data-marked])").forEach(xx=>{
						xx.dataset.marked="true";
						setTimeout(function(eee){
							callback(eee);
						},500,xx);
						
					});
				}
			});
		};
		
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	console.log("social stream injected");
	
	var interval = setInterval(function(){
		if (window.location.pathname.startsWith("/video/live") || window.location.pathname.startsWith("/video/event")  || window.location.pathname.startsWith("/video/golive/") || window.location.pathname.startsWith("/events/")){
			
			if (document.querySelectorAll(".video-live-comments").length){
				if (!document.querySelector(".video-live-comments").dataset.marked){
					console.log("socialstream loaded");
					document.querySelector(".video-live-comments").dataset.marked="true";
					setTimeout(function(){
						document.querySelectorAll(".video-live-comments .video-live-comments__comment-item").forEach(ele=>{ // for debugging only.
							 ele.dataset.marked="true";
						});
						
						onElementInserted(".video-live-comments", function(element){
						   processMessage(element);
						});
					},3000);
				}
			}
			
		}
	},3000);

})();