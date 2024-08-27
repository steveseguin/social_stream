(function () {
	
	function pushMessage(data) {
	  try {
		  
		// Create a unique key for the message
		const messageKey = `${data.chatname}:${data.chatmessage}:${data.contentimg}`;

		// Check if this message already exists in the history
		if (!messageHistory.includes(messageKey)) {
		  // If it's a new message, add it to the history
		  messageHistory.push(messageKey);

		  // Keep only the most recent 100 messages
		  if (messageHistory.length > 100) {
			messageHistory = messageHistory.slice(-100);
		  }
		  
		  chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(response) {
			if (chrome.runtime.lastError) {
			  //console.error('Error sending message:', chrome.runtime.lastError);
			}
		  });
		} else {
		 // console.log('Duplicate message filtered out:', messageKey);
		}
	  } catch (e) {
		//console.error('Error in pushMessage:', e);
	  }
	}

	// Make sure to initialize messageHistory if it's not already defined
	if (typeof messageHistory === 'undefined') {
	  var messageHistory = [];
	}

	function toDataURL(url, callback, maxSizeKB = 6) {
	  fetch(url)
		.then(response => response.blob())
		.then(blob => {
		  const img = new Image();
		  img.onload = function() {
			const canvas = document.createElement('canvas');
			let width = img.width;
			let height = img.height;
			
			// Calculate aspect ratio
			let aspectRatio = width / height;
			
			// Resize logic
			let scaleFactor = 1;
			do {
			  width = img.width * scaleFactor;
			  height = width / aspectRatio;
			  
			  canvas.width = width;
			  canvas.height = height;
			  
			  const ctx = canvas.getContext('2d');
			  ctx.drawImage(img, 0, 0, width, height);
			  
			  scaleFactor *= 0.9;
			} while (canvas.toDataURL('image/jpeg', 0.7).length > maxSizeKB * 1024);

			const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
			callback(resizedDataUrl);
		  };
		  img.src = URL.createObjectURL(blob);
		})
		.catch(error => {
		  //console.error('Error:', error);
		  callback(null);
		});
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
		try {
			contentimg = ele.childNodes[0].childNodes[1].querySelector("div > div[role='button'] > div div > img[alt][src][class][style]").src;
		}catch(e){
		}
		try {
			ele.querySelector("article ul ul").dataset.set = "subpost";
		}catch(e){}
		
		var name = "";
		
		try {
			name = escapeHtml(ele.childNodes[0].childNodes[0].querySelector("div > span > span div > a[href] div > span").textContent.trim());
		}catch(e){
			
		}
		
		var msg="";
		
		try {
			msg = escapeHtml(ele.childNodes[0].childNodes[2].childNodes[0].childNodes[0].childNodes[2].childNodes[1].textContent.trim());
		}catch(e){
			
		}
	
		var img = "";
		
		try {
			img = ele.childNodes[0].childNodes[0].childNodes[0].querySelector("[role='link'] > img[src]").src;
		}catch(e){
			
		}
		
		if (!name){return;}
		
		if (msg.length > 50){
		  msg = cleanString(msg);
	    }
		if (msg.length > 50){
		  msg = cleanString2(msg);
	    }
		if (msg.length > 200){
		  msg = msg.split("\n")[0]
	    }
		if (msg.length > 200){
		  msg = msg.split("!")[0]
	    }
		if (msg.length > 200){
		  msg = msg.split(".")[0]
	    }

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
			toDataURL(contentimg, (dataUrl)=>{
			  data.contentimg = dataUrl;
			  if (data.chatimg){
					toDataURL(data.chatimg, (dataUrl2)=>{
						data.chatimg = dataUrl2;
						pushMessage(data);
					});
			  } else {
				   pushMessage(data);
			  }
			});
		} else if (data.chatimg){
			toDataURL(data.chatimg, (dataUrl)=>{
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
		   pushMessage(data);
		}
	}
	
	function processMessageSingle(ele){ // not supported currently.  Instagram is just a bunch of reels at this point, so thats not chat
		if (ele == window){return;}
		
		var contentimg = "";
		try {
			contentimg = ele.querySelector("div > div[role='button'] > div div > img[alt][src][class][style]").src;
		}catch(e){
		}
		
		var name = "";
		
		try {
			name = escapeHtml(ele.childNodes[0].childNodes[0].querySelector("div > span > span div > a[href] div > span").textContent.trim());
		}catch(e){
			
		}
		var msg="";
		try {
			var named = ele.querySelector("hr").nextElementSibling.childNodes[0].childNodes[0].querySelector("span span").textContent;
			if (named == name){
				try {
					msg = escapeHtml(ele.querySelector("hr").nextElementSibling.childNodes[0].childNodes[0].querySelector("span > div > span").textContent.trim());
				}catch(e){
					
				}
			}
		
		
		}catch(e){
			
		}
	
		var img = "";
		try {
			img = ele.querySelector("hr").nextElementSibling.childNodes[0].childNodes[0].querySelector("[role='link'] > img[src]").src;
		}catch(e){
			
		}
		
		if (!name){return;}
		
		if (msg.length > 50){
		  msg = cleanString(msg);
	    }
		if (msg.length > 50){
		  msg = cleanString2(msg);
	    }
		if (msg.length > 200){
		  msg = msg.split("\n")[0]
	    }
		if (msg.length > 200){
		  msg = msg.split("!")[0]
	    }
		if (msg.length > 200){
		  msg = msg.split(".")[0]
	    }

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
			toDataURL(contentimg, (dataUrl)=>{
			  data.contentimg = dataUrl;
			  if (data.chatimg){
					toDataURL(data.chatimg, (dataUrl2)=>{
						data.chatimg = dataUrl2;
						pushMessage(data);
					});
			  } else {
				   pushMessage(data);
			  }
			});
		} else if (data.chatimg){
			toDataURL(data.chatimg, (dataUrl)=>{
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
			name = name.trim();
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
		
		if (!name){return;}

		if (msg.length > 50){
		  msg = cleanString(msg);
	    }
		if (msg.length > 50){
		  msg = cleanString2(msg);
	    }
		if (msg.length > 200){
		  msg = msg.split("\n")[0]
	    }
		if (msg.length > 200){
		  msg = msg.split("!")[0]
	    }
		if (msg.length > 200){
		  msg = msg.split(".")[0]
	    }

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
	//	console.log(ele);
		try {
			var content = ele.childNodes[0].childNodes[0].childNodes[0];
		} catch(e){
			return;
		}
		var chatname="";
		var streamEvent = false;
		try {
			chatname = content.childNodes[1].children[0].textContent;
			
			if (content.childNodes[1].children.length==1){
				streamEvent = true;
				if (!settings.captureevents){return;}
			}
			
			let tt = chatname.split(" ");
			if (tt.length == 2){
				if (tt[1] == "joined"){
					streamEvent = "joined";
					if (!settings.capturejoinedevent){
						return;
					}
					if (!settings.captureevents){
						return;
					}
				}
			}
			
			chatname = chatname.replace(/ .*/,'');
			chatname = escapeHtml(chatname);
			
			if (chatname && (chatname.slice(-1) == ",")){
				chatname = chatname.slice(0, -1);
				streamEvent = true;
				if (!settings.captureevents){return;}
			}
			
		} catch(e){
		}
		var chatmessage="";
		var badges = [];
		try{
			try {
				chatmessage = getAllContentNodes(Array.from(content.childNodes[2].querySelectorAll(":scope > span")).slice(-1)[0]);
			} catch(e){
				chatmessage = getAllContentNodes(Array.from(content.querySelectorAll("div > span")).slice(-1)[0]);
			}
			
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
					if (!settings.captureevents){return;}
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
				//console.log(e);
				return;
			}
		}
		
		var chatimg="";
		try{
			chatimg = content.childNodes[0].querySelectorAll("img")[0].src;
		} catch(e){
		}
		
	//	console.log(chatmessage);
	  
	  if (!chatmessage){return;}
	  
	  if (!chatname){return;}
	  
	  if (chatmessage.length > 50){
		  chatmessage = cleanString(chatmessage);
	  }
	  if (chatmessage.length > 50){
		  chatmessage = cleanString2(chatmessage);
	  }
	  if (chatmessage.length > 200){
		  chatmessage = chatmessage.split("\n")[0]
	  }
	  if (chatmessage.length > 200){
		  chatmessage = chatmessage.split("!")[0]
	  }
	  if (chatmessage.length > 200){
		  chatmessage = chatmessage.split(".")[0]
	    }
	  
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
			try{
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
			} catch(e){
				//console.log(e);
			}
		} else {
			data.chatimg = "";
			pushMessage(data);
		}
	}
	
	var isOn = false;
	
	function cleanString(input) {
	  return input
		.replace(/#\w+\s*/g, '')  // Remove hashtags and their associated words
		.replace(/\s+/g, ' ')     // Replace multiple spaces with a single space
		.trim();                  // Remove leading and trailing spaces
	}
	
	function cleanString2(input) {
	  return input
		.replace(/[#@]\w+\s*/g, '')  // Remove hashtags, at-mentions, and their associated words
		.trim();                     // Remove leading and trailing spaces
	}
	
	setTimeout(function(){ // clear existing messages; just too much for a stream.
		
		console.log("LOADED SocialStream EXTENSION");
		
		try {
			if (window.location.pathname.includes("/live/")  || (window.location.pathname==="/")){
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
			
			if (!isOn){
				return;
			}
		
			try {
				if (window.location.pathname.includes("/live") || (window.location.pathname.endsWith("/") || document.querySelector("video") || document.querySelector("textarea")) || (window.location.pathname==="/")){
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
									main[j].dataset.set = "post";
									main[j].querySelectorAll("div[role='button']").forEach(xx=>{
										if (xx.textContent === "more"){
											//xx.click();
										}
									});
									setTimeout(function(node){
										processMessagePosts(node);
									},100, main[j])
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
								main.dataset.set = "comment";	
								processMessageComment(main);
							}
						}
					});
				} catch(e){}
				try {
					document.querySelectorAll("div > section > main[role='main']").forEach(main=>{
						if (main && main.childNodes){
							if (!main.dataset.set){
								main.dataset.set = "single";	
								processMessageSingle(main);
							}
						}
					});
				} catch(e){}
				
			}
			
			document.querySelectorAll("video").forEach(v=>{
				if (videosMuted){
					v.muted = true;
					v.pause();
					v.controls = false;
				} else {
					v.controls = true;
				}
				
			});
			
		},500);
		
		
	},1500);

	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isOn = response.state;
		}
	});
	
	var videosMuted = false;

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
					
					if ("muteWindow" in request){
						if (request.muteWindow){
							clearInterval(videosMuted);
							videosMuted =  setInterval(function(){
								document.querySelectorAll("video").forEach(v=>{
									v.muted = true;
									v.pause();
								});
							},1000);
							document.querySelectorAll("video").forEach(v=>{
								v.muted = true;
								v.pause();
							});
							sendResponse(true);
							return;
						} else {
							if (videosMuted){
								clearInterval(videosMuted);
								document.querySelectorAll("video").forEach(v=>{
									v.muted = false;
									v.play();
								});
							} else {
								clearInterval(videosMuted);
							}
							videosMuted = false;
							sendResponse(true);
							return;
						}
					}
					
				}
			} catch(e){	}
			
			sendResponse(false);
		}
	);
	
})();