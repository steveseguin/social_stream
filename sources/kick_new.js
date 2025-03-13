(function () {
	
	var cachedUserProfiles = {};
	var processedMessages = new Set(); // Add this line
	var maxTrackedMessages = 40;

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
	
	// 
	
	function extractKickUsername(url) {
		const pattern = /kick\.com\/(?:popout\/)?([^/]+)(?:\/chat)?$/i;
		const match = url.match(pattern);
		if (match) {
			return  match[1]
		}
		return false;
	}
	
	try {
		var kickUsername = extractKickUsername(window.location.href);
	} catch(e){}

	var isExtensionOn = true;
	
	async function getKickViewerCount(username) {
		try {
			const response = await fetch(`https://kick.com/api/v2/channels/${username}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			
			if (data.livestream) {
				return data.livestream.viewer_count || 0;
			}

			return 0;

		} catch (error) {
			console.log(error);
			return 0;
		}
	}
	
	async function checkViewers(){
		if (kickUsername && isExtensionOn && (settings.showviewercount || settings.hypemode)){
			try {
				var viewers = await getKickViewerCount(kickUsername) || 0;
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					({message:{
							type: "kick",
							event: 'viewer_update',
							meta: viewers
						}
					}),
					function (e) {}
				);
			} catch (e) {
				console.log(e);
			}
		}
	}
	
	setTimeout(function(){checkViewers();},2500);
	setInterval(function(){checkViewers()},65000);
	
	
	function getAllContentNodes(element) {
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
				if (node.classList && node.classList.contains("seventv-painted-content")){
					resp += node.outerHTML;
				} else if (node && (node.tagName == "A")){
					resp += " " + getAllContentNodes(node).trim() + " ";
				} else {
					resp += getAllContentNodes(node)
				}
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (node && node.classList && node.classList.contains("zero-width-emote")){
					resp += "<span class='zero-width-parent'>"+node.outerHTML+"</span>";
				} else if (node && (node.tagName == "A")){
					resp += " " + node.outerHTML.trim() + " ";
				} else {
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}
	
	
	async function fetchWithTimeout(URL, timeout=2000){ // ref: https://dmitripavlutin.com/timeout-fetch-request/
		try {
			const controller = new AbortController();
			const timeout_id = setTimeout(() => controller.abort(), timeout);
			const response = await fetch(URL, {...{timeout:timeout}, signal: controller.signal});
			clearTimeout(timeout_id);
			return response;
		} catch(e){
			errorlog(e);
			return await fetch(URL);
		}
	}
	
	async function getKickAvatarImage(username, channelname){
		
		if (username in cachedUserProfiles){
			return cachedUserProfiles[username];
		} 
		cachedUserProfiles[username] = "";
		
		return await fetchWithTimeout("https://kick.com/channels/"+encodeURIComponent(channelname)+"/"+encodeURIComponent(username)).then(async response => {
			return await response.json().then(function (data) {
				if (data && data.profilepic){
					cachedUserProfiles[username] = data.profilepic;
					return data.profilepic;
				}
			});
		}).catch(error => {
			//console.log("Couldn't get avatar image URL. API service down?");
		});
	}
	
	function clearMessageTracking() {
	  processedMessages.clear();
	}
	
	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	
	var counter = 1;
	
	async function processMessage(ele){	// twitch
	
	  if (!ele || !ele.isConnected) return;
	  
	  if (ele.querySelector(".line-through")){
		  console.log("DELETEED");
		  try {
				var data = {};
				data.chatname = escapeHtml(ele.querySelector("button[title]").innerText);
				data.chatname = data.chatname.replace("Channel Host", "");
				data.chatname = data.chatname.replace(":", "");
				data.chatname = data.chatname.trim();
				ele.dataset.mid ? (data.id = parseInt(ele.dataset.mid)) || null : "";
				data.type = "kick";
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					{
						delete: data
					},
					function (e) {}
				);
			} catch (e) {
			}
		return;
	  }
	  
	  if (ele.dataset.matched){return;}
	  ele.dataset.matched = true;
	  let sibling = ele.nextElementSibling;
	  let nextCount = 0;
	  while(sibling) {
		nextCount++;
		if (nextCount>5){return;}
		if (sibling.dataset.matched){return;}
		sibling = sibling.nextElementSibling;
	  }
	  
	  let messageId = "";
	  try {
		  const content = ele.textContent || "";
		  messageId = `${content.slice(0, 100)}`;
		
		if (processedMessages.has(messageId)) return;
		
		processedMessages.add(messageId);
		
		if (processedMessages.size > maxTrackedMessages) {
		  const entriesToRemove = processedMessages.size - maxTrackedMessages;
		  const entries = Array.from(processedMessages);
		  for (let i = 0; i < entriesToRemove; i++) {
			processedMessages.delete(entries[i]);
		  }
		}
		
	  } catch(e) {
		return;
	  }
		
	  if (settings.delaykick){
		  await sleep(3000);
	  }
	  
	  if (settings.customkickstate) {
		return;
	  }
		
	  var chatsticker = false;
	  var chatmessage = "";
	  var nameColor = "";
	  var chatname = "";
	  var name ="";
	  var chatbadges = [];
	  
	  
	  try {
		chatname = escapeHtml(ele.querySelector("button[title]").innerText);
		
	  } catch(e){
		  return;
	  }
	  try {
		nameColor = ele.querySelector("button[title]").style.color;
	  } catch(e){}
	  
	  
	  
	  if (!settings.textonlymode){
		  try {
			var chatNodes = ele.querySelectorAll("seventv-container"); // 7tv support, as of june 20th
			
			if (!chatNodes.length){
				chatNodes = ele.querySelectorAll(".chat-entry-content, .chat-emote-container, .break-all");
			} else {
				chatNodes = ele.querySelectorAll("seventv-container, .chat-emote-container, .seventv-painted-content"); // 7tv support, as of june 20th
			}
			
			if (!chatNodes.length){
				let tmp = ele.querySelector("div span[class^='font-normal']");
				if (tmp){
					chatmessage = getAllContentNodes(tmp);
					chatmessage = chatmessage.trim();
				}
			} 
		  } catch(e){
		  }
	  } else {
		  if (!chatNodes.length){
			let tmp = ele.querySelector("div span[class^='font-normal']");
			if (tmp){
				chatmessage = getAllContentNodes(tmp);
				chatmessage = chatmessage.trim();
			}
		  }
	  }
	  if (chatNodes.length){
		for (var i=0;i<chatNodes.length;i++){
			chatmessage += getAllContentNodes(chatNodes[i])+" ";
		}
		chatmessage = chatmessage.trim();
	  }
	  
	  if (!chatmessage){return;}
	  
	  
	  ele.querySelectorAll("div > div > div > div > div > div[data-state] img[src], div > div > div > div > div > div[data-state] svg").forEach(badge=>{
		try {
			if (badge && badge.nodeName == "IMG"){
				var tmp = {};
				tmp.src = badge.src;
				tmp.type = "img";
				chatbadges.push(tmp);
			} else if (badge && badge.nodeName.toLowerCase() == "svg"){
				var tmp = {};
				tmp.html = badge.outerHTML;
				tmp.type = "svg";
				chatbadges.push(tmp);
			}
		} catch(e){  }
	  });


	  var hasDonation = '';
	
	  
	  chatname = chatname.replace("Channel Host", "");
	  chatname = chatname.replace(":", "");
	  chatname = chatname.trim();
	  
	  var chatimg = "";
	  var channelName = window.location.pathname.split("/")[1];
	  
	  if (channelName && chatname){
		  chatimg = await getKickAvatarImage(chatname, channelName) || "";
	  }
	  
	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.nameColor = nameColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  data.membership = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "kick";
	  
	  if (!chatmessage && !hasDonation){
		return;
	  }
	  
	  //if (brandedImageURL){
	  //  data.sourceImg = brandedImageURL;
	  //}
	  
	  try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, (e)=>{
			if (e){
				ele.dataset.mid = e?.id;
			}
		});
	  } catch(e){
		  //
	  }
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector('[data-input="true"]').focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("state" in request){
						isExtensionOn = request.state;
					}
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					} 
				}
				// twitch doesn't capture avatars already.
			} catch(e){}
			sendResponse(false);
		}
	);
	
	var lastMessage = "";
	var settings = {};
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (response){
			if ("state" in response){
				isExtensionOn = response.state;
			}
			if ("settings" in response){
				settings = response.settings;
			}
		}
	});

	function onElementInserted(target, subtree=false) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.removedNodes.length) {
					if (mutation.target.parentNode && mutation.target.parentNode.dataset.index){
						processMessage(mutation.target.parentNode);
					}
				} else if (mutation.target == target || subtree){
					if (mutation.addedNodes.length) {
						for (var i = 0; i < mutation.addedNodes.length; i++) {
							try {
								if (mutation.addedNodes[i].dataset && mutation.addedNodes[i].dataset.index){
									if (SevenTV){
										setTimeout(function(ele){
											processMessage(ele);
										}, 300, mutation.addedNodes[i]); // give seventv time to load, before parsing the message
									} else {
										processMessage(mutation.addedNodes[i]);
									}
									
								} else if (mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner")){
									let ele = mutation.addedNodes[i].classList.contains("chatroom-banner") || mutation.addedNodes[i].querySelector(".chatroom-banner");
									
									processMessage(ele);
								}
							} catch(e){}
						}
					}
				} 
			});
		};
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	//var pastMessages = [];
	var SevenTV = false;
	
	console.log("Social stream injected");
	var xxx = setInterval(function(){
		if (document.querySelectorAll("#chatroom-messages > div").length){
			clearInterval(xxx);
			setTimeout(function(){
				clearMessageTracking();
				if (document.getElementById("seventv-extension")){
					SevenTV = true;
				}
				var clear = document.querySelectorAll("div[data-chat-entry]");
				//for (var i = 0;i<clear.length;i++){
				//	pastMessages.push(clear[i].dataset.chatEntry);
				//}
				onElementInserted(document.querySelectorAll("#chatroom-messages > div")[0], false);
				if (document.querySelectorAll("#chatroom-messages > div").length>1){
					onElementInserted(document.querySelectorAll("#chatroom-messages > div")[1], true);
				}
			},3000);
		}
	},1000);
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function(e){
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e){};;
			remoteConnection.datachannel.onopen = function(e){};;
			remoteConnection.datachannel.onclose = function(e){};;
			setInterval(function(){
				if (document.hidden){ // only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE")
				}
			}, 800);
		}
		var errorHandle = function(e){}
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = (e) => !e.candidate ||	remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function(e){localConnection.sendChannel.send("CONNECTED");};
		localConnection.sendChannel.onclose =  function(e){};
		localConnection.sendChannel.onmessage = function(e){};
		localConnection.createOffer()
			.then((offer) => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then((answer) => remoteConnection.setLocalDescription(answer))
			.then(() =>	{
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch(e){
	}

})();