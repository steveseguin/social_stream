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

	function processMessagePosts(ele){ // not supported currently.  Instagram is just a bunch of reels at this point, so thats not chat
		if (ele == window){return;}
		
		
		var contentimg = "";

		var name = "";
		
		var msg="";
	
		var img = "";
		

		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = img;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "instagram";

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
	
	function processMessageComment(ele){
		if (ele == window){return;}

		var name = "";
		try {
			name = escapeHtml(ele.querySelector("h3").innerText);
		} catch(e){
			name = "";
		}

		var msg="";
		try{
		  msg = escapeHtml(ele.querySelector("h3").nextElementSibling.innerText);
		} catch(e){
		  //console.log(e);
		}

		var img = "";
		try {
		img = ele.querySelector("div > div > a > img[src]").src;
		} catch(e){}


		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = img;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "instagram";

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
	
	function processMessageIGLive(ele){
		var content = ele.childNodes[0].childNodes[0].childNodes[0];
		var chatname="";
		var streamEvent = false;
		try {
			chatname = content.childNodes[1].children[0].textContent;
			chatname = chatname.replace(/ .*/,'');
			chatname = escapeHtml(chatname);
			if (chatname && (chatname.slice(-1) == ",")){
				chatname = chatname.slice(0, -1);
				streamEvent = true;
			}
		} catch(e){
		}
		var chatmessage="";
		var badges = [];
		try{
			chatmessage = getAllContentNodes(Array.from(content.childNodes[2].querySelectorAll(":scope > span")).slice(-1)[0]);
			
			try{
				if (content.childNodes[1].querySelector("img")){
					var badge = content.childNodes[1].querySelector("img");
					badge.src = badge.src+"";
					badges.push(badge.src);
				}
			} catch(e){
			}
		} catch(e){
			chatmessage="";
			try{
				var msgs = Array.from(content.childNodes[1].querySelectorAll(":scope > span"));
				
				if (msgs.length==1){
					chatmessage = getAllContentNodes(msgs[0]);
					streamEvent = true;
				} else {
					chatmessage = getAllContentNodes(msgs.slice(-1)[0]);
				}
				
				try{
					if (content.childNodes[1].childNodes[1].querySelector("img")){
						var badge = content.childNodes[1].childNodes[1].querySelector("img");
						badge.src = badge.src+"";
						badges.push(badge.src);
					}
				} catch(e){
				}
				
			} catch(e){
				return;
			}
		}
		
		var chatimg="";
		try{
			chatimg = content.childNodes[0].querySelectorAll("img")[0].src;
		} catch(e){
		}
		
	  
	  if (!chatmessage){return;}
	  
	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = badges || "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.membership = "";;
	  data.contentimg = "";
	  data.event = streamEvent;
	  data.textonly = settings.textonlymode || false;
	  data.type = "instagramlive";
	  
		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			data.chatimg = "";
			pushMessage(data);
		}
	}
	
	setTimeout(function(){ // clear existing messages; just too much for a stream.
	
		console.log("LOADED SocialStream EXTENSION");
		
		try {
			if (window.location.pathname.includes("/live/")){
				var main =  document.querySelectorAll("div>div>section>div");
				
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
							// processMessageIGLive(main[j]);
						} 
					} catch(e){}
				}
			}
		} catch(e){  }
	
		setInterval(function(){
			try {
				if (window.location.pathname.includes("/live")){
					try {
						var main = document.querySelectorAll("div>div>section>div");
						for (var j =0;j<main.length;j++){
							try{
								if (!main[j].dataset.set123){
									main[j].dataset.set123 = "true";
									processMessageIGLive(main[j]);
								} 
							} catch(e){}
						}
					} catch(e){ }
				}
			} catch(e){}
			
			if (!window.location.pathname.includes("/live")){ // not live video
				try {
					var main = document.querySelectorAll("article");
					if (main){
						for (var j =0;j<main.length;j++){
							try{
								if (!main[j].dataset.set){
									main[j].dataset.set = true;
									processMessagePosts(main[j]);
								}
							} catch(e){
								//console.error(e);
							}
						}
					}
				} catch(e){}
				try {
					document.querySelectorAll("article ul ul").forEach(main=>{
						if (main && main.childNodes){
							if (!main.dataset.set){
								main.dataset.set = true;	
								processMessageComment(main);
							}
						}
					});
				} catch(e){}
			}
			
		},500);
		
		
	},1500);

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
					if (!document.querySelector("textarea[class]")){
						sendResponse(false);
						return;
					}
					document.querySelector("textarea[class]").focus();
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
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();