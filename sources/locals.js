(function () {
	 
	
	var isExtensionOn = true;
function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (55 * 1024)) {
		  callback(url); // Image size is larger than 25kb.
		  return;
		}

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

	function parseCountText(rawText){
		try {
			if (!rawText){return null;}
			let text = (rawText + "").trim();
			if (!text){return null;}
			if (/[$\u20AC\u00A3]/.test(text)){return null;}
			let match = text.match(/([0-9]+(?:[.,][0-9]+)?)(\s*[KMB])?/i);
			if (!match){return null;}
			let value = parseFloat((match[1] + "").replace(/,/g, ""));
			if (!isFinite(value)){return null;}
			let suffix = ((match[2] || "") + "").trim().toUpperCase();
			if (suffix === "K"){
				value *= 1000;
			} else if (suffix === "M"){
				value *= 1000000;
			} else if (suffix === "B"){
				value *= 1000000000;
			}
			return Math.max(0, Math.round(value));
		} catch(e){
			return null;
		}
	}

	function parseNumericValue(rawText){
		try {
			if (!rawText){return null;}
			let text = (rawText + "").trim();
			if (!text){return null;}
			let match = text.match(/([0-9]+(?:[.,][0-9]+)?)/);
			if (!match){return null;}
			let value = parseFloat((match[1] + "").replace(/,/g, ""));
			if (!isFinite(value)){return null;}
			return value;
		} catch(e){
			return null;
		}
	}

	function normalizeMembershipLabel(label){
		try {
			return (label || "")
				.replace(/[_-]+/g, " ")
				.replace(/\s+/g, " ")
				.trim();
		} catch(e){
			return "";
		}
	}

	function extractBadgeData(ele){
		let badges = [];
		let membership = "";
		try {
			let badgeImages = ele.querySelectorAll(".chat-message-content-wrapper .flex_1 img[src]");
			badgeImages.forEach(img=>{
				if (!img || !img.src){return;}
				if (img.closest(".w_28px")){return;}
				if (img.closest(".wb_break-word")){return;}
				let alt = (img.alt || "").trim();
				let src = img.src;
				let isLikelyBadge = /badge|supporter|member|subscriber|moderator|admin/i.test(src) || /supporter|member|subscriber|moderator|admin/i.test(alt);
				if (!isLikelyBadge){return;}
				if (!badges.includes(src)){
					badges.push(src);
				}
				if (!membership && alt && /supporter|member|subscriber/i.test(alt)){
					membership = normalizeMembershipLabel(alt);
				}
			});
			if (!membership){
				for (let i=0;i<badges.length;i++){
					let fileName = (badges[i].split("?")[0].split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
					if (/supporter|member|subscriber/i.test(fileName)){
						membership = normalizeMembershipLabel(fileName);
						break;
					}
				}
			}
		} catch(e){}
		return { badges, membership };
	}

	function extractDonationDetails(ele){
		let donationText = "";
		let donationValue = "";
		try {
			var donationPath = ele.querySelector("svg path[d^='M1.36193 6.26802']");
			if (donationPath){
				var donationSvg = donationPath.closest("svg");
				var donationSpan = "";
				if (donationSvg && donationSvg.nextElementSibling){
					donationSpan = donationSvg.nextElementSibling;
				} else if (donationSvg && donationSvg.parentNode){
					donationSpan = donationSvg.parentNode.querySelector("span");
				}
				if (donationSpan && donationSpan.textContent){
					donationText = donationSpan.textContent.trim();
				}
			}
		} catch(e){}

		if (!donationText){
			try {
				var donationFooter = ele.querySelector(".chat-message-content-wrapper > .d_flex.ai_center.gap_1");
				if (donationFooter){
					var donationFooterValue = donationFooter.querySelector("span");
					if (donationFooterValue && donationFooterValue.textContent){
						donationText = donationFooterValue.textContent.trim();
					}
				}
			} catch(e){}
		}

		if (!donationText){
			return { hasDonation: "", donoValue: "" };
		}

		let parsedValue = parseNumericValue(donationText);
		if (parsedValue !== null){
			donationValue = parsedValue;
			if (!/[A-Za-z$]/.test(donationText)){
				let prettyValue = Number.isInteger(parsedValue) ? parsedValue : parsedValue.toFixed(2);
				donationText = prettyValue + " coins";
			}
		}

		return {
			hasDonation: escapeHtml(donationText.trim()),
			donoValue: donationValue
		};
	}

	function extractReplyMeta(ele){
		try {
			let replyCard = ele.querySelector(".chat-message-content-wrapper [class*='bg-c_background.30']");
			if (!replyCard){return null;}

			let replyUser = "";
			try {
				let replyUserNode = replyCard.querySelector("a[href*='username=']");
				if (replyUserNode && replyUserNode.textContent){
					replyUser = replyUserNode.textContent.replace(/^@/, "").trim();
				}
				if (!replyUser && replyUserNode && replyUserNode.href){
					replyUser = replyUserNode.href.split("username=").pop().split("&")[0].trim();
				}
			} catch(e){}

			let replyText = "";
			try {
				let replyTextNodes = replyCard.querySelectorAll(".wb_break-word");
				if (replyTextNodes && replyTextNodes.length){
					replyText = (replyTextNodes[replyTextNodes.length-1].textContent || "").trim();
				}
			} catch(e){}

			let replyImage = "";
			try {
				let replyStyleImage = replyCard.querySelector("[style*='background-image']");
				if (replyStyleImage && replyStyleImage.getAttribute("style")){
					let styleValue = replyStyleImage.getAttribute("style");
					let match = styleValue.match(/background-image:\s*url\((['"]?)(.*?)\1\)/i);
					if (match && match[2]){
						replyImage = match[2].trim();
					}
				}
				if (!replyImage){
					let replyImageNode = replyCard.querySelector("img[src]");
					if (replyImageNode && replyImageNode.src){
						replyImage = replyImageNode.src;
					}
				}
			} catch(e){}

			if (!replyUser && !replyText && !replyImage){
				return null;
			}

			let replyMeta = {};
			if (replyUser){replyMeta.chatname = replyUser;}
			if (replyText){replyMeta.chatmessage = replyText;}
			if (replyImage){replyMeta.contentimg = replyImage;}
			return replyMeta;
		} catch(e){
			return null;
		}
	}

	function extractPrimaryMessageNode(ele){
		try {
			let directBlocks = ele.querySelectorAll(".chat-message-content-wrapper .flex_1 > .fs_14px.lh_18px, .chat-message-content-wrapper .flex_1 > div[class*='fs_14px'][class*='lh_18px']");
			for (let i=0; i<directBlocks.length; i++){
				let block = directBlocks[i];
				if (!block){continue;}
				if (block.closest("[class*='bg-c_background.30']")){continue;}
				if (block.closest("[class*='c_text.secondary']")){continue;}
				let node = block.querySelector(".wb_break-word");
				if (node){
					return node;
				}
			}
		} catch(e){}

		try {
			let msgNodeList = ele.querySelectorAll(".chat-message-content-wrapper .wb_break-word");
			let msgNodeNew = null;
			if (msgNodeList && msgNodeList.length){
				for (let i=0;i<msgNodeList.length;i++){
					let candidate = msgNodeList[i];
					if (candidate.closest("[class*='bg-c_background.30']")){continue;}
					if (candidate.closest("[class*='c_text.secondary']")){continue;}
					msgNodeNew = candidate;
				}
				if (!msgNodeNew){
					msgNodeNew = msgNodeList[msgNodeList.length-1];
				}
			}
			return msgNodeNew;
		} catch(e){}
		return null;
	}

	function extractContentImage(ele){
		try {
			let images = ele.querySelectorAll(".chat-message-content-wrapper img[src]");
			for (let i=0; i<images.length; i++){
				let img = images[i];
				if (!img || !img.src){continue;}
				if (img.closest(".w_28px")){continue;}
				if (img.closest("[class*='bg-c_background.30']")){continue;}
				let altText = (img.alt || "").toLowerCase();
				let inAttachmentWrap = img.closest("[class*='max-h_80dvh']") || img.closest("[class*='min-w_300px']");
				if (altText.indexOf("comment attached") !== -1 || altText.indexOf("attached photo") !== -1 || inAttachmentWrap){
					return img.src;
				}
			}
		} catch(e){}

		try {
			let legacyImage = ele.querySelector(".message-photo img[src]");
			if (legacyImage && legacyImage.src){
				return legacyImage.src;
			}
		} catch(e){}
		return "";
	}

	function extractViewerCount(){
		try {
			let viewerPath = document.querySelector("svg>path[d^='M10.8176 5.85711C10.8176 6.63686 10.5052 7.38474 9.94965 7.93603C9.39408 8.4873 8.64033 8.79724 7.85447']");
			if (viewerPath && viewerPath.parentNode && viewerPath.parentNode.nextElementSibling){
				let directCount = parseCountText(viewerPath.parentNode.nextElementSibling.textContent);
				if (directCount !== null){
					return directCount;
				}
			}

			let metricsRow = document.querySelector(".chat-container header .d_flex.gap_2");
			if (metricsRow){
				let metricItems = metricsRow.querySelectorAll(":scope > div");
				for (let i=0; i<metricItems.length; i++){
					let item = metricItems[i];
					if (!item){continue;}
					let countTextNode = item.querySelector(".fs_13px, .lh_17px, div, span");
					let countText = "";
					if (countTextNode && countTextNode.textContent && countTextNode.textContent.trim()){
						countText = countTextNode.textContent;
					} else {
						countText = item.textContent;
					}
					let parsed = parseCountText(countText);
					if (parsed !== null){
						return parsed;
					}
				}
			}
		} catch(e){}
		return null;
	}

	var lastViewerCount = null;
	var messageRetryCounts = new WeakMap();

	function emitViewerCount(viewerCount){
		try {
			if (!isFinite(viewerCount)){return;}
			viewerCount = Math.max(0, Math.round(viewerCount));
			if (lastViewerCount === viewerCount){return;}
			lastViewerCount = viewerCount;
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				({message:{
						type: 'locals',
						event: 'viewer_update',
						meta: viewerCount
					}
				}),
				function (e) {}
			);
		} catch(e){}
	}
	
	function processMessage(ele){
		
		//console.log(ele);
		
		if (!ele || !ele.isConnected || ele.skip){
			return;
		}
		
		var name="";
		try {
			name = ele.dataset.username || "";
			
		} catch(e){
			name = "";
		}
		
		if (!name){
			try {
				var nameNode = ele.querySelector("a[href*='username=']");
				if (nameNode && nameNode.textContent){
					name = nameNode.textContent.trim();
				}
				if (!name){
					name = nameNode.href.split("username=").pop();
					
				}
			} catch(e){}
		}
		
		if (!name){
			try {
				name = escapeHtml((document.querySelector(".nameContainer > .name") || {}).textContent || "");
			} catch(e){
				return;
			}
		}
		
		name = name.replace(/^@/, "").trim();
		
		if (!name){
			try {
				if (ele && ele.isConnected){
					let nameAttempts = (messageRetryCounts.get(ele) || 0) + 1;
					messageRetryCounts.set(ele, nameAttempts);
					if (nameAttempts <= 10){
						scheduleProcessMessage(ele, 300);
					}
				}
			} catch(e){}
			return;
		}
		
		var msg = "";
		try {
			var msgNode = ele.querySelector('.msg-text, .mchat__chatmessage');
			if (msgNode && msgNode.childNodes){
				msgNode.childNodes.forEach(ee=>{
					if (ee.nodeType == Node.TEXT_NODE){
						msg += escapeHtml(ee.textContent);
					} else if (settings.textonlymode && ee.alt && (ee.nodeName  == "IMG")){
						//msg += ee.alt;
					} else if (!settings.textonlymode&& (ee.nodeName  == "IMG")){
						msg += "<img src='"+ee.src+"' />";
					}  else {
						msg += escapeHtml(ee.textContent);
					}
				});
			}
		}catch(e){msg = "";}
		
		msg = msg.trim();
		
		if (!msg){
			try {
				let msgNodeNew = extractPrimaryMessageNode(ele);
				if (msgNodeNew){
					msg = getAllContentNodes(msgNodeNew).trim();
				}
			} catch(e){msg = "";}
		}
		
		var chatimg = '';
		
		if (!chatimg){
			try {
				var avatar = ele.querySelector(".chat-message-content-wrapper .w_28px img[src]") || ele.querySelector(".chat-message-content-wrapper img[alt='User'][src]") || ele.querySelector(".chat-message-content-wrapper img[class*='bdr_50%'][src]");
				if (!avatar){
					try {
						var fallbackAvatar = ele.querySelector(".chat-message-content-wrapper img[src]");
						if (fallbackAvatar && (!fallbackAvatar.closest || (!fallbackAvatar.closest(".wb_break-word") && !fallbackAvatar.closest(".message-photo")))){
							avatar = fallbackAvatar;
							chatimg = avatar.src;
						}
						if (!chatimg){
							fallbackAvatar = ele.querySelector(".pmessage__avaimg[style]");
							if (fallbackAvatar){
								chatimg = fallbackAvatar.style.background.split("url(")[1].split('"')[1];
							}
						}
					} catch(e){}
				} else {
					chatimg = avatar.src;
				}
			} catch(e){
				chatimg = "";
			}
		}
		
		var contentimg = extractContentImage(ele);
		
		var badgeData = extractBadgeData(ele);
		var donationData = extractDonationDetails(ele);
		var replyMeta = extractReplyMeta(ele);
		var hasDonation = donationData.hasDonation || "";
		
		
		
		var data = {};
		data.chatname = name;
		data.chatbadges = badgeData.badges.length ? badgeData.badges : "";
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = badgeData.membership || "";
		if (donationData.donoValue !== ""){
			data.donoValue = donationData.donoValue;
		}
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "locals";
		if (replyMeta){
			data.meta = { reply: replyMeta };
		}
		
		if (!contentimg && !msg && !hasDonation){
			try {
				if (ele && ele.isConnected){
					let attempts = (messageRetryCounts.get(ele) || 0) + 1;
					messageRetryCounts.set(ele, attempts);
					if (attempts <= 10){
						scheduleProcessMessage(ele, 300);
					}
				}
			} catch(e){}
			return;
		}
		
		messageRetryCounts.delete(ele);
		ele.skip = true;
		
		pushMessage(data);
		
	}

	var pendingMessageNodes = new WeakSet();

	function scheduleProcessMessage(ele, delay){
		try {
			if (!ele || ele.nodeType !== 1){return;}
			if (ele.skip){return;}
			if (pendingMessageNodes.has(ele)){return;}
			pendingMessageNodes.add(ele);
			setTimeout(function(){
				pendingMessageNodes.delete(ele);
				if (!ele || !ele.isConnected || ele.skip){return;}
				processMessage(ele);
			}, typeof delay === "number" ? delay : 300);
		} catch(e){}
	}

	function scanChatMessages(chatContainer){
		try {
			if (!chatContainer || !chatContainer.querySelectorAll){return;}
			let rows = chatContainer.querySelectorAll("div[id^='chat-message-']");
			for (let i=0; i<rows.length; i++){
				let row = rows[i];
				if (!row || row.skip){continue;}
				scheduleProcessMessage(row, 300);
			}
		} catch(e){}
	}

	function markExistingMessagesAsSkipped(chatContainer){
		try {
			if (!chatContainer || !chatContainer.querySelectorAll){return;}
			let rows = chatContainer.querySelectorAll("div[id^='chat-message-']");
			for (let i=0; i<rows.length; i++){
				let row = rows[i];
				if (!row){continue;}
				row.skip = true;
				try { pendingMessageNodes.delete(row); } catch(e){}
				try { messageRetryCounts.delete(row); } catch(e){}
			}
		} catch(e){}
	}

	function resolveChatContainer(){
		try {
			let directContainer = document.querySelector("#chat-history, #chatscroller");
			if (directContainer){
				return directContainer;
			}

			let row = document.querySelector("div[id^='chat-message-']");
			if (row && row.parentElement){
				return row.parentElement;
			}

			let scopedSection = document.querySelector(".chat-container section.flex_1, .chat-container section[class*='ov-y_auto'], .chat-container section");
			if (scopedSection){
				return scopedSection;
			}
		} catch(e){}
		return null;
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
			console.error(e);
		}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("locals");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('#chat-message-value').focus();
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

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			try {
				for (let m=0; m<mutations.length; m++){
					let mutation = mutations[m];
					if (!mutation || !mutation.addedNodes || !mutation.addedNodes.length){continue;}
					let nodes = mutation.addedNodes;
					for (let i=0;i<nodes.length;i++){
						let node = nodes[i];
						if (!node || node.nodeType !== 1){continue;}
						if (node.matches && node.matches("div[id^='chat-message-']")){
							if (!node.skip){
								scheduleProcessMessage(node, 300);
							}
							continue;
						}
						let nested = node.querySelectorAll ? node.querySelectorAll("div[id^='chat-message-']") : [];
						for (let j=0; j<nested.length; j++){
							let messageNode = nested[j];
							if (!messageNode.skip){
								scheduleProcessMessage(messageNode, 300);
							}
						}
					}
				}
			} catch(e){
				console.error(e);
			}
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	var counter = 0;
	console.log("social stream injected");

	setInterval(function(){
		var chatContainer = resolveChatContainer();
		if (chatContainer){
			if (!chatContainer.marked){
				chatContainer.marked=true;
				chatContainer.bootstrapComplete = false;
				setTimeout(function(){
					var chatContainer = resolveChatContainer();
					if (!chatContainer){return;}
					markExistingMessagesAsSkipped(chatContainer);
					onElementInserted(chatContainer);
					chatContainer.bootstrapComplete = true;
				},3000);
			}
			if (chatContainer.bootstrapComplete){
				scanChatMessages(chatContainer);
			}
			
			
			if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			
				if (counter%10==0){
					try {
						let viewerCount = extractViewerCount();
						if (viewerCount !== null){
							emitViewerCount(viewerCount);
						}
					} catch(e){}
				}
				counter+=1;
			}
			
		}
	},2000);

})();
