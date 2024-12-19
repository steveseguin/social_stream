// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 
// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 
// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 
// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 
// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 
// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 
// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 
// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 
// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 
// THIS FILE IS OBSOLETE - UPDATE YOUR SOCIAL STREAM 




















(function () {
	function toDataURL(url, callback) {
		var xhr = new XMLHttpRequest();
		xhr.onload = function () {
			var blob = xhr.response;

			if (blob.size > 55 * 1024) {
				callback(url); // Image size is larger than 25kb.
				return;
			}

			var reader = new FileReader();

			reader.onloadend = function () {
				callback(reader.result);
			};
			reader.readAsDataURL(xhr.response);
		};
		xhr.open("GET", url);
		xhr.responseType = "blob";
		xhr.send();
	}

	//var channelName = "";

	function getTranslation(key, value = false) {
		if (settings.translation && settings.translation.innerHTML && key in settings.translation.innerHTML) {
			// these are the proper translations
			return settings.translation.innerHTML[key];
		} else if (settings.translation && settings.translation.miscellaneous && settings.translation.miscellaneous && key in settings.translation.miscellaneous) {
			return settings.translation.miscellaneous[key];
		} else if (value !== false) {
			return value;
		} else {
			return key.replaceAll("-", " "); //
		}
	}

	function escapeHtml(unsafe) {
		try {
			if (settings.textonlymode) {
				return unsafe;
			}
			return unsafe.replace(/[&<>"']/g, function(m) {
				return {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#039;'
				}[m];
			}) || "";
		} catch (e) {
			return "";
		}
	}

	var messageHistory = [];

	const emoteRegex = /(?<=^|\s)(\S+?)(?=$|\s)/g;
	
	function replaceEmotesWithImages2(message, emotesMap, zw = false) {
	  return message.replace(emoteRegex, (match, emoteMatch) => {
		const emote = emotesMap[emoteMatch];
		if (emote) {
		  const escapedMatch = escapeHtml(match);
		  if (!zw || typeof emote === "string") {
			return `<img src="${emote}" alt="${escapedMatch}" class='zero-width-friendly'/>`;
		  } else if (emote.url) {
			return `<span class="zero-width-span"><img src="${emote.url}" alt="${escapedMatch}" class="zero-width-emote" /></span>`;
		  }
		}
		return match;
	  });
	}

	function replaceEmotesWithImages(text) {
		if (BTTV) {
			if (settings.bttv) {
				try {
					if (BTTV.channelEmotes) {
						text = replaceEmotesWithImages2(text, BTTV.channelEmotes, false);
					}
					if (BTTV.sharedEmotes) {
						text = replaceEmotesWithImages2(text, BTTV.sharedEmotes, false);
					}
				} catch (e) {}
			}
		}
		if (SEVENTV) {
			if (settings.seventv) {
				try {
					if (SEVENTV.channelEmotes) {
						text = replaceEmotesWithImages2(text, SEVENTV.channelEmotes, true);
					}
				} catch (e) {}
			}
		}
		return text;
	}

	function extractYouTubeRedirectUrl(youtubeUrl) {
		const url = new URL(youtubeUrl);
		if (url.hostname === "www.youtube.com" && url.pathname === "/redirect") {
			const actualUrl = url.searchParams.get("q");
			if (actualUrl) {
				return actualUrl.replace(/\&/g, "&amp;");
			} else {
				return youtubeUrl;
			}
		} else {
			return youtubeUrl;
		}
	}
	
	function isEmoji(char) {
		const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
		return emojiRegex.test(char);
	}

	function getAllContentNodes(element) {
		var resp = "";
		element.childNodes.forEach(node => {
			if (node.childNodes.length) {
				if (!settings.textonlymode && node.nodeName === "A" && node.href && node.childNodes.length === 1) {
					resp += extractYouTubeRedirectUrl(node.href);
				} else {
					resp += getAllContentNodes(node);
				}
			} else if (node.nodeType === 3 && node.textContent) {
				// ah, so I was skipping the spaces before. that's breaking arabic. well, w/e
				if (settings.textonlymode) {
					resp += escapeHtml(node.textContent) + "";
				} else {
					resp += replaceEmotesWithImages(escapeHtml(node.textContent)) + "";
				}
			} else if (node.nodeType === 1) {
				if (!settings.textonlymode) {
					resp += node.outerHTML;
				} else if (node.nodeName == "IMG"){
					if (node.alt && isEmoji(node.alt)){
						resp += escapeHtml(node.alt);
					}
				}
			}
		});
		return resp;
	}

	function findSingleInteger(input) {
		// Ensure the input is a string
		const str = String(input);

		const matches = str.match(/\d+/g);
		if (matches && matches.length === 1) {
			return parseInt(matches[0], 10);
		} else {
			return false;
		}
	}

	function processMessage(ele, wss = true) {
		if (ele.hasAttribute("is-deleted")) {
			//console.log("Message is deleted already");
			return;
		}

		if (settings.customyoutubestate) {
			return;
		}
		try {
			if (ele.skip) {
				return;
			} else if (ele.id && messageHistory.includes(ele.id)) {
				//console.log("Message already exists");
				return;
			} else if (ele.id) {
				messageHistory.push(ele.id);
				messageHistory = messageHistory.slice(-400);
			} else {
				return; // no id.
			}
			if (ele.querySelector("[in-banner]")) {
				//console.log("Message in-banner");
				return;
			}
		} catch (e) {}

		ele.skip = true;

		//if (channelName && settings.customyoutubestate){
		//if (settings.customyoutubeaccount && settings.customyoutubeaccount.textsetting && (settings.customyoutubeaccount.textsetting.toLowerCase() !== channelName.toLowerCase())){
		//	return;
		//} else if (!settings.customyoutubeaccount){
		//	return;
		//}
		//  }

		var chatmessage = "";
		var chatname = "";
		var chatimg = "";
		var nameColor = "";
		var member = false;
		var mod = false;

		var srcImg = ""; // what shows up as the source image; blank is default (dock decides).

		try {
			var nameElement = ele.querySelector("#author-name");
			chatname = escapeHtml(nameElement.innerText);

			if (!settings.nosubcolor) {
				if (nameElement.classList.contains("member")) {
					nameColor = "#107516";
					member = true;
				} else if (nameElement.classList.contains("moderator")) {
					nameColor = "#5f84f1";
					mod = true;
				}
			}
		} catch (e) {}

		try {
			var BTT = ele.querySelectorAll(".bttv-tooltip");
			for (var i = 0; i < BTT.length; i++) {
				BTT[i].outerHTML = "";
			}
		} catch (e) {}

		if (!settings.textonlymode) {
			try {
				chatmessage = getAllContentNodes(ele.querySelector("#message, .seventv-yt-message-content"));
			} catch (e) {
				//console.warn(ele);
				//console.error(e);
			}
		} else {
			try {
				var cloned = ele.querySelector("#message, .seventv-yt-message-content").cloneNode(true);
				//var children = cloned.querySelectorAll("[alt]");
				//for (var i =0;i<children.length;i++){
				//	children[i].outerHTML = children[i].alt;
				//}
				var children = cloned.querySelectorAll('[role="tooltip"]');
				for (var i = 0; i < children.length; i++) {
					children[i].outerHTML = "";
				}
				chatmessage = getAllContentNodes(cloned);
			} catch (e) {
				//console.error(e);
			}
		}

		chatmessage = chatmessage.trim();

		chatmessage = chatmessage.replaceAll("=w16-h16-", "=w48-h48-"); // increases the resolution of emojis
		chatmessage = chatmessage.replaceAll("=w24-h24-", "=w64-h64-");
		chatmessage = chatmessage.replaceAll("=s16-", "=s48-");
		chatmessage = chatmessage.replaceAll("=s24-", "=s48-");

		try {
			chatimg = ele.querySelector("#img").src;
			if (chatimg.startsWith("data:image/gif;base64")) {
				// document.querySelector("#panel-pages").querySelector("#img").src
				chatimg = document.querySelector("#panel-pages").querySelector("#img").src; // this is the owner
			}
			chatimg = chatimg.replace("=s32-", "=s64-"); // double the resolution of avatars
		} catch (e) {}

		var chatdonation = "";
		try {
			chatdonation = escapeHtml(ele.querySelector("#purchase-amount").innerText);
		} catch (e) {}

		var chatmembership = "";

		try {
			chatmembership = ele.querySelector(".yt-live-chat-membership-item-renderer #header-subtext").innerHTML;
		} catch (e) {}

		var treatAsMemberChat = false;
		if (!chatmembership && settings.allmemberchat) {
			if (ele.hasAttribute("author-type")) {
				if (ele.getAttribute("author-type") === "member") {
					//chatmembership = chatmessage;
					treatAsMemberChat = true;
					member = true;
				} else if (ele.getAttribute("author-type") === "moderator") {
					//chatmembership = chatmessage;
					treatAsMemberChat = true;
					mod = true;
				}
			}
		} else if (chatmembership) {
			treatAsMemberChat = true;
		}
		
		var chatsticker = "";
		try {
			chatsticker = ele.querySelector(".yt-live-chat-paid-sticker-renderer #sticker>#img").src;
		} catch (e) {}

		if (chatsticker) {
			try {
				chatdonation = escapeHtml(ele.querySelector("#purchase-amount-chip").innerText);
			} catch (e) {}
		}

		var chatbadges = [];
		try {
			ele.querySelectorAll(".yt-live-chat-author-badge-renderer img, .yt-live-chat-author-badge-renderer svg").forEach(img => {
				if (img.tagName.toLowerCase() == "img") {
					var html = {};
					html.src = img.src;
					html.type = "img";
					chatbadges.push(html);
				} else if (img.tagName.toLowerCase() == "svg") {
					var html = {};
					img.style.fill = window.getComputedStyle(img).color;
					html.html = img.outerHTML;
					html.type = "svg";
					chatbadges.push(html);
				}
			});
		} catch (e) {}

		var hasDonation = "";
		if (chatdonation) {
			hasDonation = chatdonation;
		}

		var hasMembership = "";

		var subtitle = "";

		var giftedmemembership = ele.querySelector("#primary-text.ytd-sponsorships-live-chat-header-renderer");
		
		var eventType = false;

		if (treatAsMemberChat) {
			if (chatmessage) {
				if (mod) {
					hasMembership = chatmembership || getTranslation("moderator-chat", "MODERATOR");
				} else {
					hasMembership = chatmembership || getTranslation("member-chat", "MEMBERSHIP");
				}
				var membershipLength = ele.querySelector("#header-subtext.yt-live-chat-membership-item-renderer, #header-primary-text.yt-live-chat-membership-item-renderer") || false;
				if (membershipLength) {
					membershipLength = getAllContentNodes(membershipLength);
					membershipLength = findSingleInteger(membershipLength);
				}
				if (membershipLength) {
					if (membershipLength == 1) {
						subtitle = membershipLength + " " + getTranslation("month", "month");
					} else {
						subtitle = membershipLength + " " + getTranslation("months", "months");
					}
				}
			} else if (giftedmemembership) {
				hasMembership = getTranslation("sponsorship", "SPONSORSHIP");
				chatmessage = getAllContentNodes(giftedmemembership);
				eventType = "sponsorship";
			} else {
				hasMembership = getTranslation("new-member", "NEW MEMBER");
				eventType = "newmember";
				
				if (chatmembership){
					chatmessage =  chatmembership;
				} else {
					chatmessage = getTranslation("new-membership", "Joined as a member");
				}
			}

			if (!hasMembership) {
				if (member) {
					hasMembership = getTranslation("member-chat", "MEMBERSHIP");
				} else if (mod) {
					hasMembership = getTranslation("moderator-chat", "MODERATOR");
				}
			}
		} else if (!chatmessage && giftedmemembership) {
			eventType = "sponsorship";
			chatmessage = getAllContentNodes(giftedmemembership);
			hasMembership = getTranslation("sponsorship", "SPONSORSHIP");
		}
		
		if (settings.memberchatonly && !hasMembership){
			return;
		}

		if (giftedmemembership && !hasDonation) {
			try {
				const match = giftedmemembership.innerText.match(/\b\d+\b/);
				hasDonation = match ? parseInt(match[0], 10) : null;
				if (hasDonation) {
					if (hasDonation==1){
						hasDonation += " " + getTranslation("gifted-membership", "Gifted");
					} else {
						hasDonation += " " + getTranslation("gifted-memberships", "Gifted");
					}
				}
			} catch (e) {
				hasDonation = "";
			}
		}
		

		if (chatsticker) {
			if (!settings.textonlymode) {
				chatmessage = '<img class="supersticker" src="' + chatsticker + '">';
			}
		}

		var backgroundColor = "";

		var textColor = "";
		if (ele.style.getPropertyValue("--yt-live-chat-paid-message-primary-color")) {
			backgroundColor = ele.style.getPropertyValue("--yt-live-chat-paid-message-primary-color");
			textColor = "#111;";
		}

		if (ele.style.getPropertyValue("--yt-live-chat-sponsor-color")) {
			backgroundColor = ele.style.getPropertyValue("--yt-live-chat-sponsor-color");
			textColor = "#111;";
		}

		srcImg = document.querySelector("#input-panel");
		if (srcImg) {
			srcImg = srcImg.querySelector("#img");
			if (srcImg) {
				srcImg = srcImg.src || "";
			} else {
				srcImg = "";
			}
		} else {
			srcImg = "";
		}

		if (!chatmessage && !hasDonation) {
			//console.error("No message or donation");
			return;
		}

		var data = {};
		data.chatname = chatname;
		data.nameColor = nameColor;
		data.chatbadges = chatbadges;
		data.backgroundColor = backgroundColor;
		data.textColor = textColor;
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = hasMembership;
		data.subtitle = subtitle;
		data.textonly = settings.textonlymode || false;
		data.type = "youtube";
		
		if (youtubeShorts){
			data.type = "youtubeshorts";
		}
		
		if (data.hasDonation){
			data.title = getTranslation("donation", "DONATION");
			if (!data.chatmessage){
				data.chatmessage = getTranslation("thank-you", "Thank you for your donation!");
				if (!data.event){
					data.event = "thankyou";
				}
			}
		}
		
		data.event = eventType;
		
		//if (eventType){
		//	console.log(data);
		//}

		try {
			chrome.runtime.sendMessage(
				chrome.runtime.id,
				{
					message: data
				},
				function () {}
			);
		} catch (e) {}
	}
	var settings = {};
	var BTTV = false;
	var videosMuted = false;
	var SEVENTV = false;
	
	function containsShorts(url) {
		const urlObj = new URL(url);
		const searchParams = new URLSearchParams(urlObj.search);
		const hasShortsParam = searchParams.has('shorts');
		const hasShortsPath = urlObj.pathname.includes('/shorts');
		return hasShortsParam || hasShortsPath;
	}
	
	var youtubeShorts = false;
	if (containsShorts(window.location.href)){
		youtubeShorts = true;
	}

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if ("focusChat" == request) {
				document.querySelector("div#input").focus();
				sendResponse(true);
				return;
			}
			if (typeof request === "object") {
				if ("settings" in request) {
					settings = request.settings;
					sendResponse(true);
					if (settings.bttv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true }, function (response) {});
					}
					if (settings.seventv) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true }, function (response) {});
					}
					return;
				}
				if ("BTTV" in request) {
					BTTV = request.BTTV;
					console.log(BTTV);
					sendResponse(true);
					return;
				}
				if ("SEVENTV" in request) {
					SEVENTV = request.SEVENTV;
					console.log(SEVENTV);
					sendResponse(true);
					return;
				}
				if ("muteWindow" in request) {
					if (request.muteWindow) {
						clearInterval(videosMuted);
						videosMuted = setInterval(function () {
							document.querySelectorAll("video").forEach(v => {
								v.muted = true;
								v.pause();
							});
						}, 1000);
						document.querySelectorAll("video").forEach(v => {
							v.muted = true;
							v.pause();
						});
						sendResponse(true);
						return;
					} else {
						if (videosMuted) {
							clearInterval(videosMuted);
							document.querySelectorAll("video").forEach(v => {
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
		} catch (e) {}
		sendResponse(false);
	});

	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		// {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response) {
			settings = response.settings;
			if (settings.bttv && !BTTV) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true }, function (response) {});
			}
			if (settings.seventv && !SEVENTV) {
				chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true }, function (response) {});
			}
		}
	});

	function onElementInserted(target, callback) {
		var onMutationsObserved = function (mutations) {
			mutations.forEach(function (mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i] && mutation.addedNodes[i].classList && mutation.addedNodes[i].classList.contains("yt-live-chat-banner-renderer")) {
								continue;
							} else if (mutation.addedNodes[i].tagName == "yt-live-chat-text-message-renderer".toUpperCase()) {
								callback(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].tagName == "yt-live-chat-paid-message-renderer".toUpperCase()) {
								callback(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].tagName == "yt-live-chat-membership-item-renderer".toUpperCase()) {
								callback(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].tagName == "yt-live-chat-paid-sticker-renderer".toUpperCase()) {
								callback(mutation.addedNodes[i]);
							} else if (mutation.addedNodes[i].tagName == "ytd-sponsorships-live-chat-gift-purchase-announcement-renderer".toUpperCase()) {
								callback(mutation.addedNodes[i]);
							} else {
								//console.error("unknown: "+mutation.addedNodes[i].tagName);
							}
						} catch (e) {}
					}
				}
			});
		};
		if (!target) {
			return;
		}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

	console.log("Social stream inserted");

	// document.body.querySelector("#chat-messages").querySelectorAll("yt-live-chat-text-message-renderer")

	var checkTimer = setInterval(function () {
		var ele = document.querySelector("yt-live-chat-app");
		if (ele) {
			clearInterval(checkTimer);
			var cleared = false;
			document.querySelectorAll("yt-live-chat-text-message-renderer").forEach(ele4 => {
				cleared = true;
				ele4.skip = true;
				if (ele4.id) {
					messageHistory.push(ele4.id);
				}
			});

			if (cleared) {
				onElementInserted(ele, function (ele2) {
					setTimeout(
						function (ele2) {
							processMessage(ele2, false);
						},
						200,
						ele2
					);
				});
			} else {
				setTimeout(function () {
					onElementInserted(document.querySelector("yt-live-chat-app"), function (ele2) {
						setTimeout(
							function (ele2) {
								processMessage(ele2, false);
							},
							200,
							ele2
						);
					});
				}, 1000);
			}
		}
	}, 1000);

	if (window.location.href.includes("youtube.com/watch")) {
		var checkTimer2 = setInterval(function () {
			try {
				if (document.querySelector("iframe[src]") && !document.querySelector("iframe[src]").src.includes("truffle.vip")) {
					var ele = document.querySelector("iframe").contentWindow.document.body.querySelector("#chat-messages");
				} else {
					var ele = false;
				}
			} catch (e) {}
			if (ele) {
				clearInterval(checkTimer2);
				var cleared = false;
				try {
					ele.querySelectorAll("yt-live-chat-text-message-renderer").forEach(ele4 => {
						ele4.skip = true;
						cleared = true;
						if (ele4.id) {
							messageHistory.push(ele4.id);
						}
					});
				} catch (e) {}
				if (cleared) {
					onElementInserted(ele, function (ele2) {
						setTimeout(
							function (ele2) {
								processMessage(ele2, false);
							},
							200,
							ele2
						);
					});
				} else {
					setTimeout(function () {
						onElementInserted(document.querySelector("iframe").contentWindow.document.body.querySelector("#chat-messages"), function (ele2) {
							setTimeout(
								function (ele2) {
									processMessage(ele2, false);
								},
								200,
								ele2
							);
						});
					}, 1000);
				}
			}
		}, 3000);
	}

	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function (e) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function (e) {};
			remoteConnection.datachannel.onopen = function (e) {};
			remoteConnection.datachannel.onclose = function (e) {};
			setInterval(function () {
				if (document.hidden) {
					// only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE");
				}
			}, 800);
		};
		var errorHandle = function (e) {};
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = e => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = e => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function (e) {
			localConnection.sendChannel.send("CONNECTED");
		};
		localConnection.sendChannel.onclose = function (e) {};
		localConnection.sendChannel.onmessage = function (e) {};
		localConnection
			.createOffer()
			.then(offer => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then(answer => remoteConnection.setLocalDescription(answer))
			.then(() => {
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch (e) {
		console.log(e);
	}
})();
