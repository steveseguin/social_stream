(function () {
	
	var isExtensionOn = true;
function toDataURL(blobUrl, callback) {
		var xhr = new XMLHttpRequest;
		xhr.responseType = 'blob';

		xhr.onload = function() {
		   var recoveredBlob = xhr.response;

		   var reader = new FileReader;

		   reader.onload = function() {
			 callback(reader.result);
		   };

		   reader.readAsDataURL(recoveredBlob);
		};
		
		xhr.onerror = function() {callback(blobUrl);}

		xhr.open('GET', blobUrl);
		xhr.send();
	};
	
	var names = {};
	var DUPLICATE_WINDOW_MS = 1500;
	var recentlySeenMessages = new Map();
	
	
	
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

	function buildMessageData(name, msg, nameColor, chatimg, chatbadge, hasDonation, extras){
		var data = {};
		data.chatname = name;
		data.chatbadges = chatbadge || "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor || "";
		data.chatmessage = msg || "";
		data.chatimg = chatimg || "";
		data.hasDonation = hasDonation || "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "parti";
		extras = extras || {};
		if (extras.event){
			data.event = extras.event;
		}
		if (extras.meta){
			data.meta = extras.meta;
		}
		if (typeof extras.donoValue !== "undefined"){
			data.donoValue = extras.donoValue;
		}
		return data;
	}

	function shouldSkipDuplicate(data, rowSignature){
		var now = Date.now();
		var key = rowSignature || [
			data.event || "",
			data.chatname || "",
			data.chatmessage || "",
			data.hasDonation || ""
		].join("\u00b6");
		var previousSeenAt = recentlySeenMessages.get(key);
		recentlySeenMessages.set(key, now);

		if (recentlySeenMessages.size > 200){
			recentlySeenMessages.forEach(function(timestamp, cacheKey){
				if ((now - timestamp) > (DUPLICATE_WINDOW_MS * 2)){
					recentlySeenMessages.delete(cacheKey);
				}
			});
		}

		return !!previousSeenAt && ((now - previousSeenAt) < DUPLICATE_WINDOW_MS);
	}

	function getRowSignature(ele){
		try {
			var index = ele && ele.parentNode && ele.parentNode.children ? Array.prototype.indexOf.call(ele.parentNode.children, ele) : -1;
			return index + "|" + (ele.textContent || "");
		} catch(e){
			return ele && ele.textContent ? ele.textContent : "";
		}
	}

	function getDonationDetails(amountText){
		var cleanAmountText = (amountText || "").replace(/\s+/g, " ").trim();
		var meta = {
			amountText: cleanAmountText,
			source: "dom"
		};
		var amountMatch = cleanAmountText.match(/^([$\u20ac\u00a3])?\s*([0-9][0-9,.]*)\s*([A-Za-z]{2,10})?$/);
		var amount = "";
		var currency = "";
		var symbol = "";

		if (amountMatch){
			symbol = amountMatch[1] || "";
			amount = parseFloat((amountMatch[2] || "").replace(/,/g, ""));
			currency = (amountMatch[3] || "").toUpperCase();
			if (!currency && symbol === "$"){ currency = "USD"; }
			if (!currency && symbol === "\u20ac"){ currency = "EUR"; }
			if (!currency && symbol === "\u00a3"){ currency = "GBP"; }
			if (amount === amount){
				meta.amount = amount;
			}
			if (currency){
				meta.currency = currency;
			}
		}

		return {
			meta: meta,
			donoValue: currency === "USD" && amount === amount ? amount : undefined
		};
	}

	function isTimestampNode(node){
		try {
			if (!node || node.nodeType !== 1){return false;}
			var text = (node.textContent || "").trim();
			if (!text || !/^\d{1,2}:\d{2}$/.test(text)){return false;}
			var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
			return !style || parseFloat(style.fontSize) <= 12;
		} catch(e){
			return false;
		}
	}

	function parseNewPartiRow(ele){
		if (!ele || !ele.classList || !ele.classList.contains("ccs-row")){
			return null;
		}

		var userLink = ele.querySelector("a[href]");
		var name = "";
		var nameColor = "";
		var msg = "";
		var hasDonation = "";
		var donationDetails = null;

		if (userLink){
			name = escapeHtml((userLink.textContent || "").replace(/^@/, "").trim());
			nameColor = userLink.style ? userLink.style.color : "";

			var foundUser = false;
			for (var i = 0; i < ele.childNodes.length; i++){
				var node = ele.childNodes[i];
				if (node === userLink){
					foundUser = true;
					continue;
				}
				if (!foundUser){continue;}
				if (isTimestampNode(node)){continue;}
				if (node.nodeType === 3){
					msg += escapeHtml(node.textContent || "");
				} else if (node.nodeType === 1){
					msg += getAllContentNodes(node);
				}
			}
			msg = msg.trim();
		} else {
			msg = ((ele.innerText || ele.textContent || "") + "").trim();
			var tippedText = " has tipped ";
			var tippedIndex = msg.indexOf(tippedText);
			if (tippedIndex > -1){
				name = escapeHtml(msg.slice(0, tippedIndex).trim());
				hasDonation = msg.slice(tippedIndex + tippedText.length).trim();
				var donationMatch = hasDonation.match(/^(.+?)\s+[^\x00-\x7F]+$/);
				if (donationMatch){
					hasDonation = donationMatch[1].trim();
				}
				donationDetails = getDonationDetails(hasDonation);
				try {
					if (names[name]){
						var cached = names[name];
						return buildMessageData(name, escapeHtml(msg), "", cached[0] || "", cached[1] || "", hasDonation, {
							event: "donation",
							meta: donationDetails.meta,
							donoValue: donationDetails.donoValue
						});
					}
				} catch(e){}
			}
		}

		if (!name){
			return null;
		}

		return buildMessageData(name, msg, nameColor, "", "", hasDonation, donationDetails ? {
			event: "donation",
			meta: donationDetails.meta,
			donoValue: donationDetails.donoValue
		} : null);
	}
	
	var userId = "";
	var heartbeatToken = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2);
	const urlParams = new URLSearchParams(window.location.search);

	function sendViewerCount(count) {
		chrome.runtime.sendMessage(
			chrome.runtime.id,
			({message:{
					type: 'parti',
					event: 'viewer_update',
					meta: parseInt(count)
				}
			}),
			function (e) {}
		);
	}

	function requestHeartbeat(endpoint, payload){
		return fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		})
		.then(function(response){
			if (!response.ok){
				throw new Error("Parti heartbeat HTTP " + response.status);
			}
			return response.json();
		});
	}

	function checkFollowers(){
		userId = urlParams.get('id') || "";
		if (isExtensionOn && userId && (settings.showviewercount || settings.hypemode)){
			var parsedUserId = parseInt(userId, 10);
			if (parsedUserId !== parsedUserId){
				return;
			}
			var heartbeatPayload = {
				user_id: parsedUserId,
				token: heartbeatToken
			};
			requestHeartbeat('https://api.parti.com/parti_v2/profile/livestream/heartbeat', heartbeatPayload)
			.catch(function(){
				return requestHeartbeat('https://prod-api.parti.com/parti_v2/profile/livestream/heartbeat', heartbeatPayload);
			})
			.then(function(data){
				console.log('Parti heartbeat response:', data);
				if (data && typeof data.viewer_count !== 'undefined') {
					sendViewerCount(data.viewer_count);
				}
			})
			.catch(function(e){
				console.log('Parti heartbeat error:', e);
			});
		}
	}

	setInterval(function(){checkFollowers()},60000);


	function processMessage(ele){
		if (ele && ele.marked){
		  return;
		} else {
		  ele.marked = true;
		}
		
		//console.log(ele);

		var newData = parseNewPartiRow(ele);
		if (newData){
			if (newData.chatname && !newData.hasDonation){
				names[newData.chatname] = [newData.chatimg || "", newData.chatbadges || ""];
			}
			if (shouldSkipDuplicate(newData, getRowSignature(ele))){
				return;
			}
			pushMessage(newData);
			return;
		}

		var nameColor = "";
        var name = "";
		
		try {
			name = escapeHtml(ele.querySelector("span.username > h6").innerText);
			name = name.trim();
			nameColor = ele.querySelector("span.username > h6").style.color;
		} catch(e){
			//console.log(e);
		}
		
		var chatbadge = "";
		try {
			if (ele.querySelector("img.q-img__image[src^='data:image/svg']")){
				chatbadge = [];
				chatbadge.push(ele.querySelector("img.q-img__image[src^='data:image/svg']").src);
			}
		} catch(e){}
		
		
		var chatimg = "";
		try {
			chatimg = ele.querySelector("img.q-img__image[src]:not([src^='data:image/svg'])").src;
		} catch(e){}
		//data.sourceImg = brandedImageURL;
		
		var msg = "";
		var hasDonation = "";
		
		if (!name){
			msg = ele.querySelector(".bi-coin").parentNode.nextSibling.textContent;
			try {
				hasDonation = msg.split("tipped")[1].split(/[^\x00-\x7F]+/)[0].trim();
			} catch(e){
				
			}
			
			try {
				name = msg.split("has tipped ")[0].trim();
				chatimg = names[name][0] || "";
				chatbadge = names[name][1] || "";
			} catch(e){
				
			}
			
		} else if (chatimg){
			names[name] = [chatimg,chatbadge];
		}
		
		if (!name){
			return;
		}

		try {
			if (!msg){
				msg = getAllContentNodes(ele.querySelector("span.username").nextSibling);
			}
			msg = msg.trim();
		} catch(e){
			return;
		}
		

		var data = buildMessageData(name, msg, nameColor, chatimg, chatbadge, hasDonation);
		if (data.hasDonation){
			var oldDonationDetails = getDonationDetails(data.hasDonation);
			data.event = "donation";
			data.meta = oldDonationDetails.meta;
			if (typeof oldDonationDetails.donoValue !== "undefined"){
				data.donoValue = oldDonationDetails.donoValue;
			}
		}
		if (shouldSkipDuplicate(data, getRowSignature(ele))){
			return;
		}
		
		
		pushMessage(data);
		
	}
	
	
	function pushMessage(data){
		try{
			if (!isExtensionOn){return;}
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){
			//console.log(e);
		}
	}
	
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("parti");	return;	}
				if ("focusChat" == request) {
                        var input = document.querySelector('.chat-input input[placeholder][type="text"], .creator-chat-sidebar input[placeholder], .creator-chat-sidebar textarea[placeholder]');
                        if (input){input.focus();}
                        sendResponse(true);
                        return;
                    }
				if (typeof request === "object"){
					var stateUpdated = false;
					if ("state" in request){
						isExtensionOn = request.state;
						stateUpdated = true;
					}
					if ("settings" in request){
						settings = request.settings;
						checkFollowers();
						sendResponse(true);
						return;
					}
					if (stateUpdated){
						checkFollowers();
						sendResponse(true);
						return;
					}
				}
			} catch(e){}
			sendResponse(false);
		}
	);
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("state" in response){
			isExtensionOn = response.state;
		}
		if ("settings" in response){
			settings = response.settings;
			checkFollowers();
		}
	});

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							processMessage(mutation.addedNodes[i]);
						} catch(e){}
					}
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);

	}
	console.log("social stream injected");

	setInterval(function(){
		try {
			if (document.querySelector('.creator-chat-stream, #q-app main > div > div[class], .main-content-area >  [class] > [class] > [class] > div')){
				if (!document.querySelector('.creator-chat-stream, #q-app main > div > div[class], .main-content-area >  [class] > [class] > [class] > div').marked){
					document.querySelector('.creator-chat-stream, #q-app main > div > div[class], .main-content-area >  [class] > [class] > [class] > div').marked=true;
					[...document.querySelectorAll('.creator-chat-stream > .ccs-row, #q-app main > div > div[class]>div, .main-content-area >  [class] > [class] > [class] > div')].forEach(ele=>{
						try {
							processMessage(ele);
							ele.marked = true;
						} catch(e){}
					});
					
					onElementInserted(document.querySelector('.creator-chat-stream, #q-app main > div > div[class], .main-content-area  > [class] > [class] > [class]'));
				}
			}
		} catch(e){}
	},2000);

})();
