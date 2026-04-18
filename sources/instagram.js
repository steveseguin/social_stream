(function () {

	var isExtensionOn = true;
	var settings = {};
	var dupCheck = [];
	var counter = 0;
	var videosMuted = false;
	var PROFILE_IMAGE_CACHE_LIMIT = 20;
	var profileImageCache = {};
	var profileImageCacheOrder = [];
	var profileImageInflight = {};

	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}

	function touchProfileImageCache(url){
		var index = profileImageCacheOrder.indexOf(url);
		if (index !== -1){
			profileImageCacheOrder.splice(index, 1);
		}
		profileImageCacheOrder.push(url);
	}

	function getCachedProfileImage(url){
		if (!url || !Object.prototype.hasOwnProperty.call(profileImageCache, url)){ return ""; }
		touchProfileImageCache(url);
		return profileImageCache[url] || "";
	}

	function rememberProfileImage(url, dataUrl){
		if (!url || !dataUrl){ return; }
		profileImageCache[url] = dataUrl;
		touchProfileImageCache(url);
		while (profileImageCacheOrder.length > PROFILE_IMAGE_CACHE_LIMIT){
			var oldestKey = profileImageCacheOrder.shift();
			if (!oldestKey){ continue; }
			delete profileImageCache[oldestKey];
		}
	}

	function flushProfileImageInflight(url, value){
		var callbacks = profileImageInflight[url];
		delete profileImageInflight[url];
		if (!callbacks || !callbacks.length){ return; }
		for (var i = 0; i < callbacks.length; i++){
			try {
				callbacks[i](value);
			} catch(e){}
		}
	}

	function releaseCanvas(canvas, context){
		try {
			if (canvas && context && canvas.width && canvas.height){
				context.clearRect(0, 0, canvas.width, canvas.height);
			}
		} catch(e){}
		try {
			if (canvas){
				canvas.width = 0;
				canvas.height = 0;
			}
		} catch(e){}
	}

	function toDataURL(url, callback, maxSizeKB, useCache) {
		maxSizeKB = maxSizeKB || 6;
		if (!url){
			callback("");
			return;
		}
		if (useCache){
			var cached = getCachedProfileImage(url);
			if (cached){
				callback(cached);
				return;
			}
			if (profileImageInflight[url]){
				profileImageInflight[url].push(callback);
				return;
			}
			profileImageInflight[url] = [callback];
		}
		var finished = false;
		var finish = function(result){
			if (finished){ return; }
			finished = true;
			result = result || url;
			if (useCache){
				if (result && (result !== url)){
					rememberProfileImage(url, result);
				}
				flushProfileImageInflight(url, result);
			} else {
				callback(result);
			}
		};
		fetch(url)
			.then(function(response){ return response.blob(); })
			.then(function(blob){
				var img = new Image();
				var objectUrl = URL.createObjectURL(blob);
				var cleanupObjectUrl = function(){
					try { URL.revokeObjectURL(objectUrl); } catch(e){}
					img.onload = null;
					img.onerror = null;
					try { img.src = ""; } catch(e){}
				};
				img.onload = function(){
					var canvas = null;
					var context = null;
					try {
						canvas = document.createElement('canvas');
						var sourceWidth = img.naturalWidth || img.width || 1;
						var sourceHeight = img.naturalHeight || img.height || 1;
						var width = sourceWidth;
						var height = sourceHeight;
						var aspectRatio = sourceWidth / sourceHeight;
						var scaleFactor = 1;
						var dataUrl = url;
						context = canvas.getContext('2d');
						if (!context){ throw new Error("canvas context unavailable"); }
						do {
							width = Math.max(1, Math.round(sourceWidth * scaleFactor));
							height = Math.max(1, Math.round(width / aspectRatio));
							canvas.width = width;
							canvas.height = height;
							context.clearRect(0, 0, width, height);
							context.drawImage(img, 0, 0, width, height);
							dataUrl = canvas.toDataURL('image/jpeg', 0.7);
							scaleFactor *= 0.9;
						} while ((dataUrl.length > maxSizeKB * 1024) && (width > 1) && (height > 1));
						finish(dataUrl);
					} catch(e){
						finish(url);
					} finally {
						releaseCanvas(canvas, context);
						cleanupObjectUrl();
					}
				};
				img.onerror = function(){
					cleanupObjectUrl();
					finish(url);
				};
				img.src = objectUrl;
			})
			.catch(function(){
				finish(url);
			});
	}

	function escapeHtml(unsafe){
		try {
			if (settings.textonlymode){
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

	function getAllContentNodes(element) {
		var resp = "";
		if (!element){ return resp; }
		if (!element.childNodes || !element.childNodes.length){
			return element.textContent ? (escapeHtml(element.textContent) || "") : "";
		}
		element.childNodes.forEach(node => {
			if (node.childNodes && node.childNodes.length){
				resp += getAllContentNodes(node);
			} else if ((node.nodeType === 3) && node.textContent && node.textContent.trim().length){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName === "IMG") && node.src){
						node.src = node.src + "";
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}

	function cleanString(input) {
		return input.replace(/#\w+\s*/g, '').replace(/\s+/g, ' ').trim();
	}

	function cleanString2(input) {
		return input.replace(/[#@]\w+\s*/g, '').trim();
	}

	function trimMessage(msg){
		if (!msg){ return ""; }
		if (msg.length > 50){ msg = cleanString(msg); }
		if (msg.length > 50){ msg = cleanString2(msg); }
		if (msg.length > 200){ msg = msg.split("\n")[0]; }
		if (msg.length > 200){ msg = msg.split("!")[0]; }
		if (msg.length > 200){ msg = msg.split(".")[0]; }
		return msg;
	}

	function hasProcessedRow(node){
		try {
			return !!(node && node.dataset && node.dataset.ssProcessed);
		} catch(e){}
		return false;
	}

	function allowLiveRowDuplicate(row){
		if (!row || !row.parentNode || !row.parentNode.children){ return false; }
		var siblings = Array.from(row.parentNode.children);
		var index = siblings.indexOf(row);
		if (index === -1){ return false; }
		var nearBottomThreshold = Math.max(3, Math.ceil(siblings.length * 0.2));
		var isNearBottom = index >= Math.max(0, siblings.length - nearBottomThreshold);
		var hasUnprocessedSiblingAfter = siblings.slice(index + 1).some(function(sibling){
			return !hasProcessedRow(sibling);
		});
		return isNearBottom || hasUnprocessedSiblingAfter;
	}

	function sendOut(data, sourceElement){
		var key = (data.chatname || "") + "::" + (data.chatmessage || "") + "::" + (data.contentimg || "");
		var allowDuplicate = (data.type === "instagramlive") && sourceElement && allowLiveRowDuplicate(sourceElement);
		if (dupCheck.includes(key) && !allowDuplicate){ return false; }
		dupCheck.push(key);
		if (dupCheck.length > 100){ dupCheck = dupCheck.slice(-100); }

		if (data.contentimg){
			toDataURL(data.contentimg, function(dataUrl){
				data.contentimg = dataUrl || data.contentimg;
				if (data.chatimg){
					toDataURL(data.chatimg, function(dataUrl2){
						data.chatimg = dataUrl2 || data.chatimg;
						pushMessage(data);
					}, 6, true);
				} else {
					pushMessage(data);
				}
			});
		} else if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl){
				data.chatimg = dataUrl || data.chatimg;
				pushMessage(data);
			}, 6, true);
		} else {
			pushMessage(data);
		}
		return true;
	}

	// ---------- Instagram Live ----------
	//
	// Parsing strategy avoids Instagram's obfuscated class names (which rotate).
	// We find comment rows by looking for profile-picture <img> elements inside
	// a <section>, then walk up to the row container. The username comes from
	// the image's alt text ("<name>'s profile picture" — stable semantic HTML),
	// and the message is whatever text follows it in the row.

	var LIVE_COMMENT_INPUT_SELECTOR = "footer textarea, footer input, footer [contenteditable='true'], [aria-label='Add a comment…']";
	var PROFILE_IMG_SELECTOR = "img[alt*='profile picture'], img[alt*='profile photo']";

	function isLivePage(){
		try {
			var path = window.location.pathname || "";
			if (path.includes("/live") || path.includes("%2Flive")){ return true; }
			if (document.querySelector("svg[aria-label='Viewer count icon']")){ return true; }
			if (document.querySelector(LIVE_COMMENT_INPUT_SELECTOR)){ return true; }
		} catch(e){}
		return false;
	}

	function nameFromAlt(img){
		if (!img || !img.alt){ return ""; }
		return (img.alt + "")
			.replace(/['’]s profile picture.*$/i, "")
			.replace(/['’]s profile photo.*$/i, "")
			.trim();
	}

	// Walk up from an element until we hit a direct child of a <section>.
	// That child is the "row" container.
	function rowFromImage(img){
		var node = img;
		while (node && node.parentElement && node.parentElement.nodeName !== "SECTION"){
			node = node.parentElement;
			if (node === document.body){ return null; }
		}
		if (!node || !node.parentElement || node.parentElement.nodeName !== "SECTION"){ return null; }
		return node;
	}

	// Reject ancestors that wrap the whole live layout (video/header/footer) or
	// that contain more than one profile picture. A real comment row holds exactly
	// one avatar and has no structural landmarks inside it.
	function looksLikeRow(node){
		if (!node || !node.querySelector){ return false; }
		if (node.querySelector("header, video, footer")){ return false; }
		var pics = node.querySelectorAll(PROFILE_IMG_SELECTOR);
		if (pics.length !== 1){ return false; }
		return true;
	}

	function findLiveRows(){
		var rows = [];
		var seen = new Set();
		var imgs = document.querySelectorAll("section " + PROFILE_IMG_SELECTOR);
		for (var i = 0; i < imgs.length; i++){
			var row = rowFromImage(imgs[i]);
			if (!row){ continue; }
			if (seen.has(row)){ continue; }
			seen.add(row);
			if (!looksLikeRow(row)){ continue; }
			rows.push(row);
		}
		return rows;
	}

	// Collect the text-leaf spans/divs in a row, skipping containers that hold
	// images. Used as a fallback when we can't split by username prefix.
	function collectTextLeaves(row){
		var leaves = [];
		var walker = row.querySelectorAll("span, div");
		for (var i = 0; i < walker.length; i++){
			var el = walker[i];
			if (el.querySelector("img")){ continue; }
			// skip if any child element has its own text (prefer the innermost)
			var childHasText = false;
			for (var c = 0; c < el.children.length; c++){
				if ((el.children[c].textContent || "").trim().length){ childHasText = true; break; }
			}
			if (childHasText){ continue; }
			var text = (el.textContent || "").trim();
			if (text){ leaves.push(el); }
		}
		return leaves;
	}

	function extractLiveBadges(row, profileImg, messageLeaf){
		var badges = [];
		var seen = {};
		try {
			row.querySelectorAll("img[src]").forEach(function(img){
				if (!img || !img.src){ return; }
				if (profileImg && (img === profileImg)){ return; }
				var alt = ((img.alt || "") + "").toLowerCase();
				if ((alt.indexOf("profile picture") !== -1) || (alt.indexOf("profile photo") !== -1)){ return; }
				if (messageLeaf){
					if ((img === messageLeaf) || (messageLeaf.contains && messageLeaf.contains(img))){ return; }
					if (img.compareDocumentPosition && window.Node){
						var position = img.compareDocumentPosition(messageLeaf);
						if (!(position & window.Node.DOCUMENT_POSITION_FOLLOWING)){ return; }
					}
				}
				var src = img.src + "";
				if (!src || seen[src]){ return; }
				seen[src] = true;
				badges.push(src);
			});
		} catch(e){}
		return badges;
	}

	function parseLiveRow(row){
		if (!row || !row.querySelector){ return null; }

		var profileImg = row.querySelector(PROFILE_IMG_SELECTOR) || row.querySelector("img[src]");
		var chatimg = profileImg ? (profileImg.src + "") : "";
		var chatname = nameFromAlt(profileImg);
		var chatmessage = "";
		var streamEvent = false;
		var messageLeaf = null;

		// Primary: row text begins with "<username>" - everything after is the
		// message. Works regardless of how Instagram wraps the spans.
		var fullText = (row.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
		if (chatname && fullText.toLowerCase().indexOf(chatname.toLowerCase()) === 0){
			var rest = fullText.slice(chatname.length).trim();
			if (rest){
				// Look for the message span so we can preserve inline HTML (emoji imgs).
				var leaves = collectTextLeaves(row);
				var msgLeaf = null;
				for (var i = leaves.length - 1; i >= 0; i--){
					var t = leaves[i].textContent.trim();
					if (t.toLowerCase() !== chatname.toLowerCase()){
						msgLeaf = leaves[i];
						break;
					}
				}
				messageLeaf = msgLeaf;
				chatmessage = msgLeaf ? getAllContentNodes(msgLeaf) : escapeHtml(rest);
			}
		}

		// Fallback: no alt-based name, or name didn't prefix the text.
		if (!chatname || !chatmessage){
			var leavesFb = collectTextLeaves(row);
			if (leavesFb.length >= 2){
				if (!chatname){ chatname = leavesFb[0].textContent.trim(); }
				if (!chatmessage){
					messageLeaf = leavesFb[leavesFb.length - 1];
					chatmessage = getAllContentNodes(messageLeaf);
				}
			} else if (leavesFb.length === 1){
				var text = leavesFb[0].textContent.trim();
				var split = text.indexOf(" ");
				if (split > 0){
					if (!chatname){ chatname = text.slice(0, split).trim(); }
					if (!chatmessage){
						messageLeaf = leavesFb[0];
						chatmessage = escapeHtml(text.slice(split + 1).trim());
						streamEvent = true;
					}
				}
			}
		}

		chatname = (chatname || "").replace(/[,:\s]+$/, "").trim();
		chatmessage = (chatmessage || "").trim();

		if (!chatname || !chatmessage){ return null; }
		if (chatname.toLowerCase() === chatmessage.toLowerCase()){ return null; }

		if (chatmessage.toLowerCase() === "joined"){
			streamEvent = "joined";
			if (!settings.capturejoinedevent){ return null; }
		}

		return {
			chatname: escapeHtml(chatname),
			chatmessage: trimMessage(chatmessage),
			chatimg: chatimg,
			badges: extractLiveBadges(row, profileImg, messageLeaf),
			streamEvent: streamEvent
		};
	}

	function processLiveRow(row){
		if (!isExtensionOn){ return false; }
		var parsed = parseLiveRow(row);
		if (!parsed){ return false; }

		var data = {};
		data.chatname = parsed.chatname;
		data.chatbadges = parsed.badges || "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = parsed.chatmessage;
		data.chatimg = parsed.chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.event = parsed.streamEvent;
		data.textonly = settings.textonlymode || false;
		data.type = "instagramlive";

		sendOut(data, row);
		return true;
	}

	function processLiveComments(){
		if (!isExtensionOn){ return; }
		findLiveRows().forEach(function(row){
			if (row.dataset && row.dataset.ssProcessed){ return; }
			if (processLiveRow(row)){
				try { row.dataset.ssProcessed = "live"; } catch(e){}
			}
		});
	}

	function checkViewers(){
		if (!(settings.showviewercount || settings.hypemode)){ return; }
		try {
			var icon = document.querySelector("svg[aria-label='Viewer count icon']");
			if (!icon){ return; }
			// Walk upward and look for a nearby numeric span in the header.
			var scope = icon.closest("header") || icon.parentElement;
			for (var depth = 0; scope && depth < 6; depth++){
				var spans = scope.querySelectorAll("span");
				for (var i = 0; i < spans.length; i++){
					var text = (spans[i].textContent || "").trim();
					if (!text){ continue; }
					if (/^\d[\d.,]*\s*[KM]?$/i.test(text)){
						var upper = text.toUpperCase();
						var multiplier = 1;
						if (upper.includes("K")){ multiplier = 1000; upper = upper.replace("K",""); }
						else if (upper.includes("M")){ multiplier = 1000000; upper = upper.replace("M",""); }
						var views = parseFloat(upper);
						if (!isNaN(views)){
							chrome.runtime.sendMessage(chrome.runtime.id, {
								message: {
									type: 'instagramlive',
									event: 'viewer_update',
									meta: views * multiplier
								}
							}, function(){});
							return;
						}
					}
				}
				scope = scope.parentElement;
			}
		} catch(e){}
	}

	function syncVideos(){
		document.querySelectorAll("video").forEach(function(v){
			if (videosMuted){
				v.muted = true;
				try { v.pause(); } catch(e){}
				v.controls = false;
			} else {
				v.controls = true;
			}
		});
	}

	// ---------- Instagram feed (non-live) ----------

	function extractProfileImg(scope){
		if (!scope){ return ""; }
		var img = scope.querySelector("img[alt*='profile picture'], img[alt*='profile photo']");
		if (img && img.src){ return img.src; }
		img = scope.querySelector("a[role='link'] img[src], [role='link'] > img[src]");
		return img ? img.src : "";
	}

	function processPost(ele){
		if (!ele || ele === window || !ele.querySelector){ return; }
		if (!isExtensionOn){ return; }
		if (ele.dataset && ele.dataset.ssProcessed){ return; }

		var name = "";
		var nameNode = ele.querySelector("header a[href][role='link'], header a[href]")
			|| ele.querySelector("a[href][role='link']");
		if (nameNode){ name = escapeHtml((nameNode.textContent || "").trim()); }
		if (!name){
			var nameImg = ele.querySelector("header img[alt*='profile picture']");
			name = nameFromAlt(nameImg);
			if (name){ name = escapeHtml(name); }
		}
		if (!name){ return; }

		var msg = "";
		var caption = ele.querySelector("h1")
			|| ele.querySelector("[data-testid='post-comment-root']")
			|| ele.querySelector("span[dir='auto']");
		if (caption){ msg = escapeHtml((caption.textContent || "").trim()); }
		msg = trimMessage(msg);

		var img = extractProfileImg(ele);

		var contentimg = "";
		var media = ele.querySelector("article img[srcset], [role='button'] img[alt][src]:not([alt*='profile'])");
		if (media && media.src){ contentimg = media.src; }

		if (ele.dataset){ ele.dataset.ssProcessed = "post"; }

		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = img;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "instagram";

		if (!data.chatmessage && !data.contentimg){ return; }
		sendOut(data);
	}

	function processComment(ele){
		if (!ele || ele === window || !ele.querySelector){ return; }
		if (!isExtensionOn){ return; }
		if (ele.dataset && ele.dataset.ssProcessed){ return; }

		var nameNode = ele.querySelector("h3, a[href][role='link']");
		var name = nameNode ? escapeHtml((nameNode.textContent || "").trim()) : "";
		if (!name){ return; }

		var msgNode = (nameNode && nameNode.nextElementSibling) || ele.querySelector("span[dir='auto']");
		var msg = msgNode ? escapeHtml((msgNode.textContent || "").trim()) : "";
		msg = trimMessage(msg);
		if (!msg){ return; }

		var img = extractProfileImg(ele);

		if (ele.dataset){ ele.dataset.ssProcessed = "comment"; }

		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = img;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "instagram";

		sendOut(data);
	}

	function processFeed(){
		if (!isExtensionOn){ return; }
		try {
			document.querySelectorAll("article").forEach(function(node){
				if (!node.dataset || !node.dataset.ssProcessed){
					setTimeout(processPost, 100, node);
				}
			});
		} catch(e){}
		try {
			document.querySelectorAll("article ul ul").forEach(function(node){
				if (!node.dataset || !node.dataset.ssProcessed){ processComment(node); }
			});
		} catch(e){}
	}

	// ---------- Settings / messaging ----------

	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError){ return; }
		response = response || {};
		if ("settings" in response){ settings = response.settings || {}; }
		if ("state" in response){ isExtensionOn = !!response.state; }
	});

	function simulateFocus(element) {
		try {
			element.dispatchEvent(new FocusEvent('focusin', { view: window, bubbles: true, cancelable: true }));
			element.dispatchEvent(new FocusEvent('focus', { view: window, bubbles: false, cancelable: true }));
		} catch(e){}
	}

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if ("getSource" === request){ sendResponse("instagram"); return; }
			if ("focusChat" === request){
				var chatInput = document.querySelector(LIVE_COMMENT_INPUT_SELECTOR)
					|| document.querySelector("textarea[class]")
					|| document.querySelector("[contenteditable='true']");
				if (!chatInput){ sendResponse(false); return; }
				chatInput.focus();
				simulateFocus(chatInput);
				sendResponse(true);
				return;
			}
			if (typeof request === "object" && request){
				if ("state" in request){ isExtensionOn = !!request.state; }
				if ("settings" in request){
					settings = request.settings || {};
					sendResponse(true);
					return;
				}
				if ("muteWindow" in request){
					videosMuted = !!request.muteWindow;
					document.querySelectorAll("video").forEach(function(v){
						if (videosMuted){ v.muted = true; try { v.pause(); } catch(e){} }
						else { v.muted = false; try { v.play(); } catch(e){} }
					});
					sendResponse(true);
					return;
				}
			}
		} catch(e){}
		sendResponse(false);
	});

	// ---------- Main loop ----------

	console.log("LOADED SocialStream EXTENSION");

	setTimeout(function(){
		setInterval(function(){
			try {
				if (isExtensionOn){
					if (isLivePage()){
						processLiveComments();
					} else {
						processFeed();
					}
				}
			} catch(e){}

			syncVideos();

			if (isExtensionOn && (counter % 20 === 0)){
				checkViewers();
			}
			counter++;
		}, 500);
	}, 1500);

})();
