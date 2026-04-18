
(function () {
	
	var isExtensionOn = true;
	var PROCESSED_ATTR = "data-ss-processed";
	var LIVE_COMMENT_SELECTOR = "section [data-set='live']";
	var LIVE_COMMENT_INPUT_SELECTOR = "footer textarea, footer input, footer [contenteditable='true']";
	var INSTAGRAM_LIVE_FALLBACK_SCAN_TICKS = 10;
	var INSTAGRAM_VIDEO_SYNC_TICKS = 6;
	var instagramLiveState = {
		section: null,
		observer: null,
		observerSection: null,
		pendingNodes: [],
		lastVideoSyncTick: -1,
		lastVideoMutedState: null
	};
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
	function isNodeAttached(node) {
		try {
			return !!(node && ((node.isConnected === true) || document.contains(node)));
		} catch(e){}
		return false;
	}
	function collectInstagramLiveNodesFromSection(section) {
		var nodes = [];
		if (!section){
			return nodes;
		}
		try {
			Array.from(section.children || []).forEach(function(child){
				if (isInstagramLiveCommentNode(child)){
					addUniqueNode(nodes, child);
					return;
				}
				var button = getInstagramLiveButton(child);
				if (button){
					addUniqueNode(nodes, getDirectChildAncestor(button, section) || child);
				}
			});
		} catch(e){}
		if (nodes.length){
			return nodes.filter(isInstagramLiveCommentNode);
		}
		try {
			section.querySelectorAll("div[role='button']").forEach(function(button){
				if (isInstagramLiveButton(button)){
					addUniqueNode(nodes, getDirectChildAncestor(button, section) || button);
				}
			});
		} catch(e){}
		return nodes.filter(isInstagramLiveCommentNode);
	}
	function isInstagramLiveSection(section) {
		try {
			return !!(section && (((section.tagName || "") + "").toUpperCase() === "SECTION") && collectInstagramLiveNodesFromSection(section).length);
		} catch(e){}
		return false;
	}
	function findInstagramLiveSection() {
		var candidates = [];
		try {
			document.querySelectorAll(LIVE_COMMENT_INPUT_SELECTOR).forEach(function(input){
				var footer = input.closest("footer");
				var section = getLiveSectionBeforeFooter(footer);
				if (section){
					addUniqueNode(candidates, section);
				}
			});
		} catch(e){}
		for (var i = 0; i < candidates.length; i++){
			if (isInstagramLiveSection(candidates[i])){
				return candidates[i];
			}
		}
		try {
			var sections = document.querySelectorAll("section");
			for (var j = 0; j < sections.length; j++){
				if (isInstagramLiveSection(sections[j])){
					return sections[j];
				}
			}
		} catch(e){}
		return null;
	}
	function resolveInstagramLiveSection(forceRefresh) {
		if (!forceRefresh && isNodeAttached(instagramLiveState.section) && isInstagramLiveSection(instagramLiveState.section)){
			return instagramLiveState.section;
		}
		instagramLiveState.section = findInstagramLiveSection();
		return instagramLiveState.section;
	}
	function getInstagramLiveSections() {
		var sections = [];
		var section = resolveInstagramLiveSection();
		if (section){
			addUniqueNode(sections, section);
		}
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
		var section = resolveInstagramLiveSection();
		if (section){
			nodes = collectInstagramLiveNodesFromSection(section);
		}
		try {
			document.querySelectorAll(LIVE_COMMENT_SELECTOR).forEach(function(node){
				if (isInstagramLiveCommentNode(node)){
					addUniqueNode(nodes, node);
				}
			});
		} catch(e){}
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
	  if (!element || !element.parentNode || !element.parentNode.children){
		return false;
	  }
	  const siblings = Array.from(element.parentNode.children);
	  const index = siblings.indexOf(element);
	  const nearBottomThreshold = Math.max(3, Math.ceil(siblings.length * 0.2));
	  const isNearBottom = index >= Math.max(0, siblings.length - nearBottomThreshold);
	  const hasUnattributedSiblingAfter = siblings.slice(index + 1).some(sibling => !hasProcessedMarker(sibling));
	  return isNearBottom || hasUnattributedSiblingAfter;
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
	function sendInstagramViewerCount(views) {
		try {
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
		} catch(e){}
	}
	function getInstagramViewerSpan() {
		try {
			var icon = document.querySelector("svg[aria-label='Viewer count icon']");
			if (!icon){
				return null;
			}
			var current = icon.parentElement;
			for (var depth = 0; current && (depth < 6); depth++){
				var sibling = current.nextElementSibling;
				while (sibling){
					var spans = sibling.querySelectorAll("span");
					for (var i = 0; i < spans.length; i++){
						if (spans[i] && spans[i].textContent && spans[i].textContent.trim()){
							return spans[i];
						}
					}
					sibling = sibling.nextElementSibling;
				}
				current = current.parentElement;
			}
		} catch(e){}
		return null;
	}
	function queueInstagramLiveNode(node) {
		if (!node || hasProcessedMarker(node) || !isInstagramLiveCommentNode(node)){
			return;
		}
		addUniqueNode(instagramLiveState.pendingNodes, node);
	}
	function queueInstagramLiveMutationNode(node, section) {
		try {
			if (!node || (node.nodeType !== 1)){
				return;
			}
			var directNode = section ? (getDirectChildAncestor(node, section) || ((node.parentNode === section) ? node : null)) : null;
			if (directNode){
				queueInstagramLiveNode(directNode);
				return;
			}
			if (isInstagramLiveCommentNode(node)){
				queueInstagramLiveNode(node);
				return;
			}
			if (!node.querySelectorAll){
				return;
			}
			node.querySelectorAll("div[role='button']").forEach(function(button){
				if (isInstagramLiveButton(button)){
					queueInstagramLiveNode(section ? (getDirectChildAncestor(button, section) || button) : button);
				}
			});
		} catch(e){}
	}
	function disconnectInstagramLiveObserver() {
		try {
			if (instagramLiveState.observer){
				instagramLiveState.observer.disconnect();
			}
		} catch(e){}
		instagramLiveState.observer = null;
		instagramLiveState.observerSection = null;
	}
	function stopInstagramLiveTracking() {
		disconnectInstagramLiveObserver();
		instagramLiveState.pendingNodes.length = 0;
		instagramLiveState.section = null;
	}
	function ensureInstagramLiveObserver(forceRefresh) {
		var section = resolveInstagramLiveSection(forceRefresh);
		if (!section){
			disconnectInstagramLiveObserver();
			return null;
		}
		if (instagramLiveState.observer && (instagramLiveState.observerSection === section)){
			return section;
		}
		disconnectInstagramLiveObserver();
		instagramLiveState.section = section;
		try {
			instagramLiveState.observer = new MutationObserver(function(mutations){
				mutations.forEach(function(mutation){
					if (!mutation || (mutation.type !== "childList") || !mutation.addedNodes){
						return;
					}
					mutation.addedNodes.forEach(function(node){
						queueInstagramLiveMutationNode(node, section);
					});
				});
			});
			instagramLiveState.observer.observe(section, { childList: true, subtree: true });
			instagramLiveState.observerSection = section;
		} catch(e){
			instagramLiveState.observer = null;
			instagramLiveState.observerSection = null;
		}
		return section;
	}
	function processInstagramLiveNodes(processExisting) {
		try {
			var main = getInstagramLiveNodes();
			for (var j = 0; j < main.length; j++){
				try {
					if (!hasProcessedMarker(main[j])){
						markProcessed(main[j], processExisting ? "live" : "true");
						if (processExisting){
							processMessageIGLive(main[j]);
						}
					}
				} catch(e){}
			}
		} catch(e){}
	}
	function flushInstagramLiveNodeQueue() {
		if (!instagramLiveState.pendingNodes.length){
			return;
		}
		var nodes = instagramLiveState.pendingNodes.slice();
		instagramLiveState.pendingNodes.length = 0;
		nodes.forEach(function(node){
			try {
				if (!hasProcessedMarker(node) && isInstagramLiveCommentNode(node)){
					markProcessed(node, "live");
					processMessageIGLive(node);
				}
			} catch(e){}
		});
	}
	function syncInstagramVideos(force) {
		if (!force && (instagramLiveState.lastVideoMutedState === videosMuted) && ((counter - instagramLiveState.lastVideoSyncTick) < INSTAGRAM_VIDEO_SYNC_TICKS)){
			return;
		}
		instagramLiveState.lastVideoMutedState = videosMuted;
		instagramLiveState.lastVideoSyncTick = counter;
		document.querySelectorAll("video").forEach(function(v){
			if (videosMuted){
				v.muted = true;
				v.pause();
				v.controls = false;
			} else {
				v.controls = true;
			}
		});
	}
	function isLikelyInstagramLivePage() {
		try {
			if (window.location.pathname.includes("/live") || window.location.pathname.includes("%2Flive")){
				return true;
			}
			if (document.querySelector(LIVE_COMMENT_SELECTOR)){
				return true;
			}
			if (document.querySelector(LIVE_COMMENT_INPUT_SELECTOR) && resolveInstagramLiveSection()){
				return true;
			}
			if (document.querySelector("svg[aria-label='Viewer count icon']")){
				return true;
			}
		} catch(e){}
		return false;
	}
	
	var counter = 0;
	
	function checkViewers(){
		if (settings.showviewercount || settings.hypemode){
			try {
				let viewerSpan = getInstagramViewerSpan();
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
						sendInstagramViewerCount(views);
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
				ensureInstagramLiveObserver(true);
				processInstagramLiveNodes(false);
			}
		} catch(e){  }
	
		setInterval(function(){
			
			if (!isOn){
				return;
			}
			var isLivePage = false;
		
			try {
				isLivePage = isLikelyInstagramLivePage();
				if (isLivePage){
					ensureInstagramLiveObserver((counter % INSTAGRAM_LIVE_FALLBACK_SCAN_TICKS) === 0);
					flushInstagramLiveNodeQueue();
					if ((counter % INSTAGRAM_LIVE_FALLBACK_SCAN_TICKS) === 0){
						processInstagramLiveNodes(true);
					}
				} else {
					stopInstagramLiveTracking();
				}
			} catch(e){}
			
			if (!isLivePage){ // not live video
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
			
			syncInstagramVideos(false);
			
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
