
(function () {
	
	var isExtensionOn = true;
	var PROCESSED_ATTR = "data-ss-processed";
	var LIVE_COMMENT_SELECTOR = "section [data-set='live']";
	var LIVE_COMMENT_INPUT_SELECTOR = "footer textarea, footer input, footer [contenteditable='true']";
	function getInstagramLiveTextSpans(scope) {
		try {
			return Array.from(scope.querySelectorAll("span[dir='auto']")).filter(function(span){
				return span && span.textContent && span.textContent.trim();
			});
		} catch(e){}
		return [];
	}
	function getInstagramLiveProfileImage(scope) {
		try {
			var images = Array.from(scope.querySelectorAll("img[src]"));
			if (!images.length){
				return null;
			}
			for (var i = 0; i < images.length; i++){
				var alt = ((images[i].alt || "") + "").toLowerCase();
				if ((alt.indexOf("profile picture") !== -1) || (alt.indexOf("profile photo") !== -1)){
					return images[i];
				}
			}
			return images[0];
		} catch(e){}
		return null;
	}
	function isInstagramLiveButton(button) {
		try {
			if (!button || !button.matches || !button.matches("div[role='button']")){
				return false;
			}
			if (button.closest("[role='tablist']")){
				return false;
			}
			var spans = getInstagramLiveTextSpans(button);
			if (!spans.length){
				return false;
			}
			if (!getInstagramLiveProfileImage(button)){
				return false;
			}
			var text = ((button.textContent || "") + "").replace(/\s+/g, " ").trim();
			if (!text){
				return false;
			}
			var ariaLabel = ((button.getAttribute("aria-label") || "") + "").toLowerCase();
			if (ariaLabel && /^(comment|follow|following|like|liked|reply|send|share|more|menu|close|mute|unmute|play|pause|next|previous)/.test(ariaLabel)){
				return false;
			}
			if ((spans.length === 1) && (text.split(/\s+/).length < 2)){
				return false;
			}
			return true;
		} catch(e){}
		return false;
	}
	function getInstagramLiveButton(node) {
		try {
			if (!node){
				return null;
			}
			if (isInstagramLiveButton(node)){
				return node;
			}
			if (!node.querySelectorAll){
				return null;
			}
			var buttons = node.querySelectorAll("div[role='button']");
			for (var i = 0; i < buttons.length; i++){
				if (isInstagramLiveButton(buttons[i])){
					return buttons[i];
				}
			}
		} catch(e){}
		return null;
	}
	function addUniqueNode(list, node) {
		if (node && (list.indexOf(node) === -1)){
			list.push(node);
		}
	}
	function hasProcessedMarker(element) {
		try {
			return !!(element && element.hasAttribute && element.hasAttribute(PROCESSED_ATTR));
		} catch(e){
			return false;
		}
	}
	function markProcessed(element, value) {
		try {
			if (element && element.setAttribute){
				element.setAttribute(PROCESSED_ATTR, value || "true");
			}
		} catch(e){}
	}
	function getDirectChildAncestor(node, ancestor) {
		try {
			while (node && node.parentNode && (node.parentNode !== ancestor)){
				node = node.parentNode;
			}
			if (node && node.parentNode === ancestor){
				return node;
			}
		} catch(e){}
		return null;
	}
	function getLiveSectionBeforeFooter(footer) {
		try {
			var current = footer ? footer.previousElementSibling : null;
			while (current){
				if ((current.tagName || "").toUpperCase() === "SECTION"){
					return current;
				}
				current = current.previousElementSibling;
			}
		} catch(e){}
		return null;
	}
	function getInstagramLiveSections() {
		var sections = [];
		try {
			document.querySelectorAll(LIVE_COMMENT_INPUT_SELECTOR).forEach(function(input){
				var footer = input.closest("footer");
				var section = getLiveSectionBeforeFooter(footer);
				if (section){
					addUniqueNode(sections, section);
				}
			});
		} catch(e){}
		try {
			document.querySelectorAll("section").forEach(function(section){
				var matchCount = 0;
				section.querySelectorAll("div[role='button']").forEach(function(button){
					if (isInstagramLiveButton(button)){
						matchCount += 1;
					}
				});
				if (matchCount >= 2){
					addUniqueNode(sections, section);
				}
			});
		} catch(e){}
		return sections;
	}
	function isInstagramLiveCommentNode(node) {
		try {
			var button = getInstagramLiveButton(node);
			if (!button){
				return false;
			}
			return !!getInstagramLiveTextSpans(button).length;
		} catch(e){}
		return false;
	}
	function getInstagramLiveNodes() {
		var nodes = [];
		try {
			getInstagramLiveSections().forEach(function(section){
				section.querySelectorAll("div[role='button']").forEach(function(button){
					if (isInstagramLiveButton(button)){
						addUniqueNode(nodes, getDirectChildAncestor(button, section) || button);
					}
				});
			});
		} catch(e){}
		nodes = nodes.filter(isInstagramLiveCommentNode);
		try {
			document.querySelectorAll(LIVE_COMMENT_SELECTOR).forEach(function(node){
				if (isInstagramLiveCommentNode(node)){
					addUniqueNode(nodes, node);
				}
			});
		} catch(e){}
		if (!nodes.length){
			try {
				document.querySelectorAll("div[role='button']").forEach(function(button){
					if (isInstagramLiveButton(button)){
						var section = button.closest("section");
						var node = section ? (getDirectChildAncestor(button, section) || button) : button;
						if (isInstagramLiveCommentNode(node)){
							addUniqueNode(nodes, node);
						}
					}
				});
			} catch(e){}
		}
		return nodes;
	}
	function getInstagramNameFromProfileImage(img) {
		try {
			var alt = (img && img.alt) ? (img.alt + "") : "";
			if (!alt){
				return "";
			}
			return alt.replace(/['’]s profile picture.*$/i, "").trim();
		} catch(e){}
		return "";
	}
	function parseInstagramLiveRow(ele) {
		try {
			var button = getInstagramLiveButton(ele) || ele;
			var spans = getInstagramLiveTextSpans(button);
			if (!spans.length){
				return false;
			}
			var profileImage = getInstagramLiveProfileImage(button);
			var images = Array.from(button.querySelectorAll("img[src]"));
			var chatimg = profileImage ? (profileImage.src + "") : (images.length ? (images[0].src + "") : "");
			var chatname = spans[0].textContent.trim();
			var chatmessage = "";
			var streamEvent = false;

			if (profileImage){
				var imgName = getInstagramNameFromProfileImage(profileImage);
				if (imgName){
					chatname = imgName;
				}
			}

			if (spans.length > 1){
				chatmessage = getAllContentNodes(spans[spans.length - 1]);
			} else {
				var soloText = spans[0].textContent.trim();
				var splitPoint = soloText.indexOf(" ");
				if (splitPoint > 0){
					chatname = soloText.slice(0, splitPoint).trim();
					chatmessage = escapeHtml(soloText.slice(splitPoint + 1).trim());
					streamEvent = true;
				}
			}

			chatname = (chatname || "").replace(/[,:\s]+$/, "").trim();
			chatmessage = (chatmessage || "").trim();

			if (!chatname || !chatmessage){
				return false;
			}
			if (chatmessage.toLowerCase() === "joined"){
				streamEvent = "joined";
				if (!settings.capturejoinedevent){
					return false;
				}
			}

			return {
				chatname: escapeHtml(chatname),
				chatmessage: chatmessage,
				chatimg: chatimg,
				badges: [],
				streamEvent: streamEvent
			};
		} catch(e){}
		return false;
	}
function checkConditions(element) {
	  // Get all siblings of the element
	  const siblings = Array.from(element.parentNode.children);
	  const index = siblings.indexOf(element);

	  // Condition 1: Closer to the bottom than the top
	  const isCloserToBottom = index > siblings.length / 2;

	  // Condition 2: Any sibling after it hasn't been processed by Social Stream yet
	  const hasUnattributedSiblingAfter = siblings.slice(index + 1).some(sibling => !hasProcessedMarker(sibling));

	  // Condition 3: Less than 99 siblings
	  const hasLessThan99Siblings = siblings.length < 99; // this probably could be increased

	  // Return true if any condition is met
	  return isCloserToBottom || hasUnattributedSiblingAfter || hasLessThan99Siblings;
	}
	
	function pushMessage(data, ele =false) {
	  try {
		  
		// Create a unique key for the message
		const messageKey = `${data.chatname}:${data.chatmessage}:${data.contentimg}`;

		// Check if this message already exists in the history
		if (!messageHistory.includes(messageKey) || (ele && checkConditions(ele))) {
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
		  //console.log('Duplicate message filtered out:', messageKey);
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
		  const objectUrl = URL.createObjectURL(blob);
		  const cleanupObjectUrl = function() {
			try {
				URL.revokeObjectURL(objectUrl);
			} catch (e) {}
			img.onload = null;
			img.onerror = null;
		  };
		  img.onload = function() {
			try {
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
			} finally {
				cleanupObjectUrl();
			}
		  };
		  img.onerror = function() {
			cleanupObjectUrl();
			callback(null);
		  };
		  img.src = objectUrl;
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
			markProcessed(ele.querySelector("article ul ul"), "subpost");
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
		var chatname="";
		var streamEvent = false;
		var chatmessage="";
		var badges = [];
		var chatimg="";
		var parsed = parseInstagramLiveRow(ele);
		if (parsed){
			chatname = parsed.chatname;
			streamEvent = parsed.streamEvent;
			chatmessage = parsed.chatmessage;
			badges = parsed.badges;
			chatimg = parsed.chatimg;
		} else {
			try {
				var content = ele.childNodes[0].childNodes[0].childNodes[0];
			} catch(e){
				return;
			}
			try {
				chatname = content.childNodes[1].children[0].textContent;
				
				if (content.childNodes[1].children.length==1){
					streamEvent = true;
				}

				let tt = chatname.split(" ");
				if (tt.length == 2){
					if (tt[1] == "joined"){
						streamEvent = "joined";
						if (!settings.capturejoinedevent){
							return;
						}
					}
				}

				chatname = chatname.replace(/ .*/,'');
				chatname = escapeHtml(chatname);

				if (chatname && (chatname.slice(-1) == ",")){
					chatname = chatname.slice(0, -1);
					streamEvent = true;
				}
				
			} catch(e){
			}
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
			
			try{
				chatimg = content.childNodes[0].querySelectorAll("img")[0].src;
			} catch(e){
			}
		}
	  
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
			toDataURL(data.chatimg, (dataUrl) =>{
				data.chatimg = dataUrl;
				pushMessage(data, ele);
			});
			} catch(e){
				//console.log(e);
			}
		} else {
			data.chatimg = "";
			pushMessage(data, ele);
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
	function isLikelyInstagramLivePage() {
		try {
			if (window.location.pathname.includes("/live") || window.location.pathname.includes("%2Flive")){
				return true;
			}
			if (document.querySelector(LIVE_COMMENT_SELECTOR)){
				return true;
			}
			if (document.querySelector(LIVE_COMMENT_INPUT_SELECTOR) && getInstagramLiveSections().length){
				return true;
			}
			if (document.querySelector("video") && getInstagramLiveNodes().length){
				return true;
			}
		} catch(e){}
		return false;
	}
	
	var counter = 0;
	
	function checkViewers(){
		if (settings.showviewercount || settings.hypemode){
			console.log(counter);
			try {
				let viewerSpan = document.querySelector("svg path[d='M3.267 24.652C8.32 14.772 15.156 9.94 23.905 9.94c8.761 0 15.768 4.847 21.136 14.745a1.47 1.47 0 1 0 2.583-1.401C41.774 12.496 33.83 7 23.905 7 13.97 7 6.175 12.51.651 23.314a1.47 1.47 0 0 0 2.616 1.338Z']").parentNode.parentNode.parentNode.parentNode.nextElementSibling;
				console.log( viewerSpan.textContent);
				if (viewerSpan && viewerSpan.textContent){
					let views = viewerSpan.textContent.toUpperCase();
					let multiplier = 1;
					if (views.includes("K")){
						multiplier = 1000;
						views = views.replace("K","");
					} else if (views.includes("M")){
						multiplier = 1000000;
						views = views.replace("M","");
					}
					views = views.split(" ")[0];
					if (views == parseFloat(views)){
						views = parseFloat(views) * multiplier;
						chrome.runtime.sendMessage(
							chrome.runtime.id,
							({message:{
									type: 'instagramlive',
									event: 'viewer_update',
									meta: views
								}
							}),
							function (e) {}
						);
					}
				}
			} catch (e) {
			}
		}
	}	
	
	setTimeout(function(){ // clear existing messages; just too much for a stream.
		
		console.log("LOADED SocialStream EXTENSION");
		
		try {
			if (isLikelyInstagramLivePage()){
				var main = getInstagramLiveNodes();
				
				for (var j =0;j<main.length;j++){
					try{
						if (!hasProcessedMarker(main[j])){
							markProcessed(main[j], "true");
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
				if (isLikelyInstagramLivePage()){
					try {
						var main = getInstagramLiveNodes();
						for (var j =0;j<main.length;j++){
							try{
								if (!hasProcessedMarker(main[j])){
									markProcessed(main[j], "live");
									processMessageIGLive(main[j]);
								} 
							} catch(e){}
						}
					} catch(e){ }
				}
			} catch(e){}
			
			if (!isLikelyInstagramLivePage()){ // not live video
				try {
					var main = document.querySelectorAll("article");
					if (main){
						for (var j =0;j<main.length;j++){
							try{
								if (!hasProcessedMarker(main[j])){
									markProcessed(main[j], "post");
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
							if (!hasProcessedMarker(main)){
								markProcessed(main, "comment");	
								processMessageComment(main);
							}
						}
					});
				} catch(e){}
				try {
					document.querySelectorAll("div > section > main[role='main']").forEach(main=>{
						if (main && main.childNodes){
							if (!hasProcessedMarker(main)){
								markProcessed(main, "single");	
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
			
			if (counter%20==0){
				checkViewers();
			}
			counter+=1;
		},500);
		
	},1500);

	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response){
			isOn = response.state;
		}
	});
	
	var videosMuted = false;
	
	
	function simulateFocus(element) {
		// Create and dispatch focusin event
		const focusInEvent = new FocusEvent('focusin', {
			view: window,
			bubbles: true,
			cancelable: true
		});
		element.dispatchEvent(focusInEvent);

		// Create and dispatch focus event
		const focusEvent = new FocusEvent('focus', {
			view: window,
			bubbles: false,
			cancelable: true
		});
		element.dispatchEvent(focusEvent);
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("instagram");	return;	}
				if ("focusChat" == request){
					var chatInput = document.querySelector(LIVE_COMMENT_INPUT_SELECTOR) || document.querySelector("textarea[class]");
					if (!chatInput){
						sendResponse(false);
						return;
					}
					chatInput.focus();
					simulateFocus(chatInput);
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
