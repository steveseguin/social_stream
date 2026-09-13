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

	function isLikelyUserAvatarSrc(src){
		try {
			src = (src || "").toLowerCase();
			return src.indexOf("/avatars/") !== -1 || src.indexOf("/avatar/") !== -1 || src.indexOf("default-avatars") !== -1;
		} catch(e){
			return false;
		}
	}

	function isLikelyBadgeSrc(src){
		try {
			src = (src || "").toLowerCase();
			return src.indexOf("/badge/") !== -1 || src.indexOf("supporter") !== -1 || src.indexOf("member") !== -1;
		} catch(e){
			return false;
		}
	}

	function isLikelyMemberProfileHref(href){
		try {
			href = (href || "").trim();
			if (!href){return false;}
			return /(?:^\/member\/|https?:\/\/[^/]*locals\.com\/member\/|[?&]username=)/i.test(href);
		} catch(e){
			return false;
		}
	}

	function closestMemberProfileLink(node){
		try {
			let probe = node;
			while (probe && probe.nodeType === 1){
				if ((probe.tagName || "").toUpperCase() === "A"){
					let href = probe.getAttribute("href") || probe.href || "";
					if (isLikelyMemberProfileHref(href)){
						return probe;
					}
				}
				probe = probe.parentElement;
			}
		} catch(e){}
		return null;
	}

	function findMemberProfileLinks(root){
		try {
			if (!root || !root.querySelectorAll){return [];}
			return Array.from(root.querySelectorAll("a[href]")).filter(link=>{
				let href = "";
				try {
					href = link.getAttribute("href") || link.href || "";
				} catch(e){}
				return isLikelyMemberProfileHref(href);
			});
		} catch(e){}
		return [];
	}

	function findFirstMemberProfileLink(root){
		try {
			let links = findMemberProfileLinks(root);
			return links.length ? links[0] : null;
		} catch(e){}
		return null;
	}

	function extractUsernameFromLink(link){
		try {
			if (!link){return "";}
			let text = (link.textContent || "").replace(/\s+/g, " ").trim();
			let textHandle = text.match(/@([A-Za-z0-9_.-]+)/);
			if (textHandle && textHandle[1]){
				return textHandle[1].trim();
			}
			let href = link.getAttribute("href") || link.href || "";
			let match = href.match(/\/member\/([^/?#]+)/i);
			if (match && match[1]){
				return decodeURIComponent(match[1]).trim();
			}
			let legacyMatch = href.match(/[?&]username=([^&#]+)/i);
			if (legacyMatch && legacyMatch[1]){
				return decodeURIComponent(legacyMatch[1]).trim();
			}
		} catch(e){}
		return "";
	}

	function isClockTimestampText(text){
		try {
			text = (text || "").replace(/\s+/g, " ").trim();
			if (!text){return false;}
			return /^\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)?$/i.test(text);
		} catch(e){
			return false;
		}
	}

	function getMessageContentRoot(ele){
		try {
			if (!ele || !ele.children || !ele.children.length){return ele;}
			for (let i=0; i<ele.children.length; i++){
				let child = ele.children[i];
				if (!child || (child.tagName || "").toUpperCase() !== "DIV"){continue;}
				if (findFirstMemberProfileLink(child)){return child;}
				if (child.querySelector && child.querySelector(".msg-text, .message-attachments, img[src]")){
					return child;
				}
			}
		} catch(e){}
		return ele;
	}

	function findReplyPreviewRoot(root){
		try {
			if (!root || !root.querySelectorAll){return null;}
			let probeNodes = Array.from(root.querySelectorAll("div, p, span")).reverse();
			for (let i=0; i<probeNodes.length; i++){
				let node = probeNodes[i];
				let text = (node.textContent || "").replace(/\s+/g, " ").trim();
				if (/^replying to\b/i.test(text)){
					return node;
				}
			}
		} catch(e){}
		return null;
	}

	function isLikelyMessageRow(ele){
		try {
			if (!ele || ele.nodeType !== 1){return false;}
			let directId = (ele.id || "").trim();
			if (/^chat-message-/i.test(directId)){return true;}
			let messageId = (ele.getAttribute("data-message-id") || ele.getAttribute("data-chat-message-id") || "").trim();
			if (messageId){return true;}
			let uuid = (ele.getAttribute("data-uuid") || "").trim();
			let senderUuid = (ele.getAttribute("data-sender-unique-id") || "").trim();
			let userUuid = (ele.getAttribute("data-user-uuid") || "").trim();
			if (uuid && (senderUuid || userUuid)){return true;}
		} catch(e){}
		return false;
	}

	function extractLastUsefulText(root){
		try {
			if (!root || !root.querySelectorAll){return "";}
			let last = "";
			let leaves = root.querySelectorAll("*");
			for (let i=0; i<leaves.length; i++){
				let node = leaves[i];
				if (!node || (node.children && node.children.length)){continue;}
				let tag = (node.tagName || "").toUpperCase();
				if (tag === "TIME" || tag === "BUTTON" || tag === "SVG" || tag === "PATH" || tag === "IMG"){continue;}
				if ((node.closest && node.closest("button")) || closestMemberProfileLink(node)){continue;}
				let text = (node.textContent || "").replace(/\s+/g, " ").trim();
				if (!text){continue;}
				if (/^(this minute|\d+\s+(seconds?|minutes?|hours?|days?)\s+ago)$/i.test(text)){continue;}
				if (isClockTimestampText(text)){continue;}
				if (text.charAt(0) === "@" && text.length <= 80){continue;}
				if (/^replying to\b/i.test(text)){continue;}
				last = text;
			}
			return last;
		} catch(e){
			return "";
		}
	}

	function extractBadgeData(ele){
		let badges = [];
		let membership = "";
		try {
			let badgeImages = ele.querySelectorAll("img[src]");
			badgeImages.forEach(img=>{
				if (!img || !img.src){return;}
				let alt = (img.alt || "").trim();
				let src = img.src;
				if (isLikelyUserAvatarSrc(src)){return;}
				if (/\/images\/answers\//i.test(src)){return;}
				let isLikelyBadge = isLikelyBadgeSrc(src) || /supporter|member|subscriber|moderator|admin/i.test(alt);
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
			let textNodes = ele.querySelectorAll("div, span, p");
			for (let i=0; i<textNodes.length; i++){
				let node = textNodes[i];
				let text = (node.textContent || "").replace(/\s+/g, " ").trim();
				if (!text){continue;}
				let match = text.match(/sent a\s+(.+?)\s+tip!?$/i);
				if (!match || !match[1]){continue;}
				donationText = match[1].trim();
				break;
			}
		} catch(e){}

		if (!donationText){
			try {
				let rowText = (ele.textContent || "").replace(/\s+/g, " ").trim();
				let rowMatch = rowText.match(/sent a\s+(.+?)\s+tip!?/i);
				if (rowMatch && rowMatch[1]){
					donationText = rowMatch[1].trim();
				}
			} catch(e){}
		}

		try {
			var donationPath = ele.querySelector("svg path[d^='M1.36193 6.26802']");
			if (!donationText && donationPath){
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
			let contentRoot = getMessageContentRoot(ele);
			let replyCard = findReplyPreviewRoot(contentRoot);
			if (!replyCard){return null;}

			let replyUser = "";
			try {
				replyUser = extractUsernameFromLink(findFirstMemberProfileLink(replyCard));
				if (!replyUser){
					let replyMatch = ((replyCard.textContent || "").replace(/\s+/g, " ").trim()).match(/Replying to\s+@?([A-Za-z0-9_.-]+)/i);
					if (replyMatch && replyMatch[1]){
						replyUser = replyMatch[1].trim();
					}
				}
			} catch(e){}

			let replyText = "";
			try {
				replyText = extractLastUsefulText(replyCard.parentElement || replyCard);
			} catch(e){}

			let replyImage = "";
			try {
				let replyImages = replyCard.querySelectorAll("img[src]");
				for (let i=0; i<replyImages.length; i++){
					let replyImageNode = replyImages[i];
					if (replyImageNode && replyImageNode.src && !isLikelyUserAvatarSrc(replyImageNode.src) && !isLikelyBadgeSrc(replyImageNode.src)){
						replyImage = replyImageNode.src;
						break;
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
			let msgNodeLegacy = ele.querySelector(".msg-text, .mchat__chatmessage");
			if (msgNodeLegacy){
				return msgNodeLegacy;
			}
		} catch(e){}

		try {
			let contentRoot = getMessageContentRoot(ele);
			let replyPreviewRoot = findReplyPreviewRoot(contentRoot);
			let donationContainer = null;
			try {
				let donPath = ele.querySelector("svg path[d^='M1.36193 6.26802']");
				if (donPath){
					let donSvg = donPath.closest("svg");
					if (donSvg && donSvg.parentElement){
						donationContainer = donSvg.parentElement;
					}
				}
			} catch(e){}

			let leaves = contentRoot.querySelectorAll("*");
			let bestNode = null;
			for (let i=0; i<leaves.length; i++){
				let candidate = leaves[i];
				if (!candidate || (candidate.children && candidate.children.length)){continue;}
				let tag = (candidate.tagName || "").toUpperCase();
				if (tag === "TIME" || tag === "BUTTON" || tag === "SVG" || tag === "PATH" || tag === "IMG"){continue;}
				if ((candidate.closest && candidate.closest("button")) || closestMemberProfileLink(candidate)){continue;}
				if (replyPreviewRoot && replyPreviewRoot.contains(candidate)){continue;}
				let text = (candidate.textContent || "").replace(/\s+/g, " ").trim();
				if (!text){continue;}
				if (/^(this minute|\d+\s+(seconds?|minutes?|hours?|days?)\s+ago)$/i.test(text)){continue;}
				if (isClockTimestampText(text)){continue;}
				if (text.charAt(0) === "@" && text.length <= 80){continue;}
				if (donationContainer && donationContainer.contains(candidate)){continue;}
				bestNode = candidate;
			}
			return bestNode;
		} catch(e){}
		return null;
	}

	function extractContentImage(ele){
		var firstCandidate = "";
		try {
			let contentRoot = getMessageContentRoot(ele);
			let replyPreviewRoot = findReplyPreviewRoot(contentRoot);
			let images = contentRoot.querySelectorAll("img[src]");
			for (let i=0; i<images.length; i++){
				let img = images[i];
				if (!img || !img.src){continue;}
				if (isLikelyUserAvatarSrc(img.src)){continue;}
				if (isLikelyBadgeSrc(img.src)){continue;}
				if (closestMemberProfileLink(img)){continue;}
				if (replyPreviewRoot && replyPreviewRoot.contains(img)){continue;}
				let altText = (img.alt || "").toLowerCase();
				if (/\/images\/answers\//i.test(img.src)){
					return img.src;
				}
				if (altText.indexOf("comment attached") !== -1 || altText.indexOf("attached photo") !== -1 || altText.indexOf("attached") !== -1){
					return img.src;
				}
				if (!firstCandidate && img.closest && img.closest('[role="button"]')){
					firstCandidate = img.src;
				}
			}
		} catch(e){}

		if (firstCandidate){
			return firstCandidate;
		}

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

			let headings = document.querySelectorAll("h1, h2, [role='heading']");
			for (let i=0; i<headings.length; i++){
				let heading = headings[i];
				let headingText = ((heading && heading.textContent) || "").trim().toLowerCase();
				if (headingText.indexOf("live chat") === -1){continue;}
				let header = heading.closest("header") || heading.parentElement;
				if (!header || !header.querySelectorAll){continue;}
				let metricItems = header.querySelectorAll("span, div");
				for (let j=0; j<metricItems.length; j++){
					let item = metricItems[j];
					if (!item || !item.textContent){continue;}
					if (item.querySelector && item.querySelector("time")){continue;}
					let raw = item.textContent.trim();
					if (!raw || raw.length > 10){continue;}
					let parsed = parseCountText(raw);
					if (parsed !== null){
						return parsed;
					}
				}
			}

			let liveChatBlock = document.querySelector("#live-chat-block");
			if (liveChatBlock){
				let explicitViewerNodes = liveChatBlock.querySelectorAll(".pcountusers__num, .pcountusers, [class*='countusers'] [class*='num'], [class*='countusers']");
				for (let i=0; i<explicitViewerNodes.length; i++){
					let explicitNode = explicitViewerNodes[i];
					if (!explicitNode || !explicitNode.textContent){continue;}
					let explicitCount = parseCountText(explicitNode.textContent);
					if (explicitCount !== null){
						return explicitCount;
					}
				}

				let headerRoots = [];
				let child = liveChatBlock.firstElementChild;
				while (child){
					if (child.id === "chat-window"){break;}
					headerRoots.push(child);
					child = child.nextElementSibling;
				}
				if (!headerRoots.length){
					headerRoots.push(liveChatBlock);
				}
				for (let i=0; i<headerRoots.length; i++){
					let nodes = headerRoots[i].querySelectorAll("span, div");
					for (let j=0; j<nodes.length; j++){
						let node = nodes[j];
						if (!node || !node.textContent){continue;}
						let raw = node.textContent.replace(/\s+/g, " ").trim();
						if (!raw || raw.length > 10){continue;}
						let parsed = parseCountText(raw);
						if (parsed !== null){
							return parsed;
						}
					}
				}
			}
		} catch(e){}
		return null;
	}

	var lastViewerCount = null;
	var messageRetryCounts = new WeakMap();
	var seenMessageIds = new Set();
	var maxSeenMessageIds = 6000;

	function rememberMessageId(messageId){
		try {
			messageId = (messageId || "").trim();
			if (!messageId){return;}
			if (seenMessageIds.has(messageId)){return;}
			seenMessageIds.add(messageId);
			if (seenMessageIds.size > maxSeenMessageIds){
				let oldest = seenMessageIds.values().next();
				if (!oldest.done){
					seenMessageIds.delete(oldest.value);
				}
			}
		} catch(e){}
	}

	function hasSeenMessageId(messageId){
		try {
			messageId = (messageId || "").trim();
			return !!messageId && seenMessageIds.has(messageId);
		} catch(e){
			return false;
		}
	}

	function getMessageRowId(ele){
		try {
			if (!ele || ele.nodeType !== 1){return "";}
			let dataUuid = (ele.getAttribute("data-uuid") || "").trim();
			if (dataUuid){return dataUuid;}
			let directId = (ele.id || "").trim();
			if (directId){return directId;}
			let dataId = (ele.getAttribute("data-message-id") || ele.getAttribute("data-chat-message-id") || "").trim();
			return dataId;
		} catch(e){
			return "";
		}
	}

	function getMessageRows(root){
		let rows = [];
		try {
			if (!root || !root.querySelectorAll){return rows;}
			let selector = "[data-uuid], div[id^='chat-message-'], [data-message-id], [data-chat-message-id]";
			if (root.matches && root.matches(selector) && isLikelyMessageRow(root)){
				rows.push(root);
			}
			let found = root.querySelectorAll(selector);
			for (let i=0; i<found.length; i++){
				if (isLikelyMessageRow(found[i])){
					rows.push(found[i]);
				}
			}
			if (!rows.length && root.id === "chat-history" && root.children){
				for (let i=0; i<root.children.length; i++){
					if (isLikelyMessageRow(root.children[i])){
						rows.push(root.children[i]);
					}
				}
			}
			rows = Array.from(new Set(rows));
		} catch(e){}
		return rows;
	}

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
		
		if (!ele || !ele.isConnected){
			return;
		}

		var messageId = getMessageRowId(ele);
		if (hasSeenMessageId(messageId)){
			return;
		}
		if (!messageId && ele.skip){
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
				var nameNode = findFirstMemberProfileLink(getMessageContentRoot(ele));
				name = extractUsernameFromLink(nameNode);
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
				let avatar = "";
				let avatarFromProfile = null;
				let profileLinks = findMemberProfileLinks(ele);
				for (let i=0; i<profileLinks.length; i++){
					let probe = profileLinks[i].querySelector("img[src]");
					if (probe && probe.src){
						avatarFromProfile = probe;
						break;
					}
				}
				if (avatarFromProfile && avatarFromProfile.src){
					avatar = avatarFromProfile.src;
				}
				if (!avatar){
					let images = ele.querySelectorAll("img[src]");
					for (let i=0; i<images.length; i++){
						let img = images[i];
						if (!img || !img.src){continue;}
						if (isLikelyBadgeSrc(img.src)){continue;}
						if (/\/images\/answers\//i.test(img.src)){continue;}
						let isAvatarLike = isLikelyUserAvatarSrc(img.src) || ((img.alt || "").toLowerCase() === "user");
						if (isAvatarLike){
							avatar = img.src;
							break;
						}
					}
				}
				if (!avatar){
					let legacyStyleAvatar = ele.querySelector(".pmessage__avaimg[style]");
					if (legacyStyleAvatar && legacyStyleAvatar.style && legacyStyleAvatar.style.background){
						avatar = legacyStyleAvatar.style.background.split("url(")[1].split('"')[1];
					}
				}
				chatimg = avatar || "";
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
		
		var needsRetry = false;
		if (!contentimg && !msg && !hasDonation){
			needsRetry = true;
		}
		if (!needsRetry && !contentimg){
			try {
				var hasImageContainer = ele.querySelector('div[role="button"], [class*="max-h_80dvh"], img[alt*="attached"]');
				if (hasImageContainer){
					needsRetry = true;
				}
			} catch(e){}
		}
		if (!needsRetry && !hasDonation){
			try {
				var hasDonationSvg = ele.querySelector("svg path[d^='M1.36193 6.26802']");
				if (hasDonationSvg){
					needsRetry = true;
				}
			} catch(e){}
		}
		if (needsRetry){
			try {
				if (ele && ele.isConnected){
					let attempts = (messageRetryCounts.get(ele) || 0) + 1;
					messageRetryCounts.set(ele, attempts);
					if (attempts <= 10){
						scheduleProcessMessage(ele, 300);
						return;
					}
				}
			} catch(e){}
			if (!msg && !contentimg && !hasDonation){
				return;
			}
		}
		
		messageRetryCounts.delete(ele);
		if (messageId){
			rememberMessageId(messageId);
		} else {
			ele.skip = true;
		}
		
		pushMessage(data);
		
	}

	var pendingMessageNodes = new WeakSet();

	function scheduleProcessMessage(ele, delay){
		try {
			if (!ele || ele.nodeType !== 1){return;}
			let rowId = getMessageRowId(ele);
			if (!rowId && ele.skip){return;}
			if (rowId && hasSeenMessageId(rowId)){return;}
			if (pendingMessageNodes.has(ele)){return;}
			pendingMessageNodes.add(ele);
			setTimeout(function(){
				pendingMessageNodes.delete(ele);
				if (!ele || !ele.isConnected){return;}
				let delayedId = getMessageRowId(ele);
				if (!delayedId && ele.skip){return;}
				if (delayedId && hasSeenMessageId(delayedId)){return;}
				processMessage(ele);
			}, typeof delay === "number" ? delay : 300);
		} catch(e){}
	}

	function scanChatMessages(chatContainer){
		try {
			if (!chatContainer || !chatContainer.querySelectorAll){return;}
			let rows = getMessageRows(chatContainer);
			for (let i=0; i<rows.length; i++){
				let row = rows[i];
				if (!row){continue;}
				let rowId = getMessageRowId(row);
				if (hasSeenMessageId(rowId)){continue;}
				if (!rowId && row.skip){continue;}
				scheduleProcessMessage(row, 300);
			}
		} catch(e){}
	}

	function markExistingMessagesAsSkipped(chatContainer){
		try {
			if (!chatContainer || !chatContainer.querySelectorAll){return;}
			let rows = getMessageRows(chatContainer);
			for (let i=0; i<rows.length; i++){
				let row = rows[i];
				if (!row){continue;}
				let rowId = getMessageRowId(row);
				if (rowId){
					rememberMessageId(rowId);
				} else {
					row.skip = true;
				}
				try { pendingMessageNodes.delete(row); } catch(e){}
				try { messageRetryCounts.delete(row); } catch(e){}
			}
		} catch(e){}
	}

	function bootstrapRecentMessages(chatContainer){
		try {
			if (!chatContainer || !chatContainer.querySelectorAll){return;}
			let rows = getMessageRows(chatContainer);
			if (!rows.length){return;}
			let recentLimit = 15;
			let startIndex = Math.max(0, rows.length - recentLimit);
			for (let i=0; i<rows.length; i++){
				let row = rows[i];
				if (!row){continue;}
				let rowId = getMessageRowId(row);
				if (i < startIndex){
					if (rowId){
						rememberMessageId(rowId);
					} else {
						row.skip = true;
					}
					try { pendingMessageNodes.delete(row); } catch(e){}
					try { messageRetryCounts.delete(row); } catch(e){}
					continue;
				}
				scheduleProcessMessage(row, 100 + ((i - startIndex) * 25));
			}
		} catch(e){}
	}

	function resolveLiveChatSection(){
		try {
			let directLiveChat = document.querySelector("#live-chat-block");
			if (directLiveChat && getMessageRows(directLiveChat).length){
				return directLiveChat;
			}

			let headings = document.querySelectorAll("h1, h2, [role='heading']");
			for (let i=0; i<headings.length; i++){
				let heading = headings[i];
				let text = ((heading && heading.textContent) || "").trim().toLowerCase();
				if (text.indexOf("live chat") === -1){continue;}
				let scope = heading.closest("section, aside, div");
				if (!scope){continue;}
				if (getMessageRows(scope).length){
					return scope;
				}
				let innerSection = scope.querySelector("section");
				if (innerSection && getMessageRows(innerSection).length){
					return innerSection;
				}
			}

			let row = document.querySelector("[data-uuid], div[id^='chat-message-'], [data-message-id], [data-chat-message-id]");
			if (row){
				let section = row.closest("#chat-history, #chat-window, #live-chat-block, section, #chatscroller");
				if (section){
					return section;
				}
				if (row.parentElement){
					return row.parentElement;
				}
			}
		} catch(e){}
		return null;
	}

	function resolveChatContainer(){
		try {
			let liveChatSection = resolveLiveChatSection();
			if (liveChatSection){
				return liveChatSection;
			}

			let directContainer = document.querySelector("#chat-history, #chat-window, #live-chat-block, #chatscroller");
			if (directContainer){
				return directContainer;
			}

			let row = document.querySelector("[data-uuid], div[id^='chat-message-'], [data-message-id], [data-chat-message-id]");
			if (row && row.parentElement){
				let rowSection = row.closest("#chat-history, #chat-window, #live-chat-block, section");
				return rowSection || row.parentElement;
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
					let chatInput = document.querySelector("#chat-message-value, textarea, [contenteditable='true']");
					if (chatInput && chatInput.focus){
						chatInput.focus();
						sendResponse(true);
						return;
					}
					sendResponse(false);
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
						let rows = getMessageRows(node);
						for (let j=0; j<rows.length; j++){
							let messageNode = rows[j];
							scheduleProcessMessage(messageNode, 300);
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
	var lastLocalsUrl = window.location.href;

	function isLikelyLocalsChatUrl(){
		try {
			let href = ((window.location && window.location.href) || "").toLowerCase();
			if (!href){return false;}
			let looksLikeLocalsHost = (href.indexOf("://locals.com/") !== -1) || (href.indexOf(".locals.com/") !== -1);
			if (!looksLikeLocalsHost){return false;}
			if (href.indexOf("/feed") !== -1){return true;}
			if (href.indexOf("/post/") !== -1 || href.indexOf("/posts/") !== -1){return true;}
			if (href.indexOf("/live") !== -1){return true;}
			if (href.indexOf("?post=") !== -1){return true;}
		} catch(e){}
		return false;
	}

	function shouldCheckForChat(){
		if (isLikelyLocalsChatUrl()){
			return true;
		}
		try {
			return !!document.querySelector("#live-chat-block, #chat-history, #chat-window, #chatscroller, [data-uuid], div[id^='chat-message-'], [data-message-id], [data-chat-message-id]");
		} catch(e){}
		return false;
	}

	function handleSoftNavigation(){
		try {
			let currentUrl = window.location.href;
			if (currentUrl === lastLocalsUrl){return;}
			lastLocalsUrl = currentUrl;
			counter = 0;
			lastViewerCount = null;
			seenMessageIds = new Set();
		} catch(e){}
	}

	console.log("social stream injected");

	setInterval(function(){
		handleSoftNavigation();
		if (!shouldCheckForChat()){
			return;
		}

		var chatContainer = resolveChatContainer();
			if (chatContainer){
				if (!chatContainer.marked){
					chatContainer.marked=true;
					chatContainer.bootstrapComplete = false;
					setTimeout(function(){
						var chatContainer = resolveChatContainer();
						if (!chatContainer){return;}
						bootstrapRecentMessages(chatContainer);
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
