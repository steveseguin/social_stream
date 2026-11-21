(() => {
  if (!(window.ninjafy || window.electronApi)) return;
  
  console.log("Disable autogain code injected");

  const setMediaConstraint = (constraint, name, value) => {
    if (!constraint) return;
    
    if (constraint.advanced?.find(opt => name in opt)) {
      constraint.advanced.find(opt => name in opt)[name] = value;
      return;
    }

    if (constraint.mandatory?.[name]) {
      constraint.mandatory[name] = value;
      return;
    }

    if (constraint.optional?.find(opt => name in opt)) {
      constraint.optional.find(opt => name in opt)[name] = value;
      return;
    }

    constraint.optional = constraint.optional || [];
    constraint.optional.push({ [name]: value });
  };

  const disableAutogain = constraints => {
    if (!constraints?.audio || typeof constraints.audio !== 'object') return constraints;

    const audio = constraints.audio;
    const autoGainSettings = {
      autoGainControl: false,
      googAutoGainControl: false,
      googAutoGainControl2: false
    };

    if (audio.optional || audio.mandatory) {
      Object.entries(autoGainSettings).forEach(([key, value]) => 
        setMediaConstraint(audio, key, value)
      );
    } else {
      audio.autoGainControl = false;
    }
    return constraints;
  };

  const patchMediaFunction = (object, name, wrapper) => {
    if (!(name in object)) return;
    const original = object[name];
    object[name] = wrapper(original);
  };

  // Patch modern getUserMedia
  patchMediaFunction(navigator.mediaDevices, 'getUserMedia', original => 
    async function getUserMedia(constraints) {
      return original.call(this, disableAutogain({ ...constraints }));
    }
  );

  // Patch legacy getUserMedia variants
  const patchLegacyGetUserMedia = original =>
    function getUserMedia(constraints, success, error) {
      return original.call(this, disableAutogain({ ...constraints }), success, error);
    };

  ['getUserMedia', 'mozGetUserMedia', 'webkitGetUserMedia'].forEach(method => 
    patchMediaFunction(navigator, method, patchLegacyGetUserMedia)
  );

  // Patch applyConstraints
  patchMediaFunction(MediaStreamTrack.prototype, 'applyConstraints', original =>
    function applyConstraints(constraints) {
      return original.call(this, disableAutogain({ ...constraints }));
    }
  );
})();

(function () {

	
	var isExtensionOn = true;
	var lastName = "";
	var lastImage = "";
	var messageHistory = new Set();
	var chatInitialized = false;
	var meetingScope = "";
	var observedChatContainers = new WeakSet();


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
			// Capture contract: textonly=true means a literal chatmessage string, not HTML.
			// Do not add formatting tags or HTML-encode it; viewer-typed <i> / &amp; stays literal.
			// HTML mode may include markup for the normal relay checks. The flag applies only to chatmessage.
			// Plain capture returns literal characters for text rendering; HTML mode escapes text for markup construction. Do not HTML-sanitize the plain string.
			if (settings.textonlymode){ // Literal text stays unencoded at capture; escape only when a renderer constructs HTML.
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


	function pushMessage(data){
		try{
			//console.log(data);
			//console.log(window.self !== window.top);
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
	}
	
	var settings = {};
	// textonlymode capture contract: literal chatmessage string, no app-added markup; render as text, not HTML.
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
				if ("getSource" == request){sendResponse("zoom");	return;	}
				if ("focusChat" == request){
					//console.log("Focusing");
					var sent=false;
					//console.log(window.self !== window.top);
					document.querySelectorAll('iframe').forEach( item =>{
						if (sent){return;}
						if (item && item.contentWindow && item.contentWindow.document && item.contentWindow.document.body.querySelector("textarea.chat-box__chat-textarea.window-content-bottom, .chat-rtf-box__chat-textarea-wrapper div[contenteditable='true']")){
							sent = true;
							//console.log("iframe sent")
							item.contentWindow.document.body.querySelector("textarea.chat-box__chat-textarea.window-content-bottom, .chat-rtf-box__chat-textarea-wrapper div[contenteditable='true']").focus();
						}
					});
					if (!sent && document.querySelector("textarea.chat-box__chat-textarea.window-content-bottom, .chat-rtf-box__chat-textarea-wrapper div[contenteditable='true']")){
						document.querySelector("textarea.chat-box__chat-textarea.window-content-bottom, .chat-rtf-box__chat-textarea-wrapper div[contenteditable='true']").focus();
						//console.log("main sent")
						sent=true;
					}
					//console.log("sent: "+sent);
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
	var lastHTML = "";
	function streamPollRAW(element){
		var html = element.outerHTML;       
		var data = { html: html }; 
		data.type = "zoom_poll";
		var json = JSON.stringify(data);
		if (lastHTML === json){ // prevent duplicates, as zoom is prone to it.
			return;
		}
		lastHTML = json;
		pushMessage(data);
	}
	
	var questionList = [];
	function processQuestion(ele){
		var question = getAllContentNodes(ele.querySelector(".q-a-question__question-content"));
		var name = ele.querySelector(".q-a-question__q-owner-name").innerText;
		
		var hash = name+":"+question;
		hash = hash.slice(0, 500);
		if (questionList.includes(hash)){
			return;
		} else {
			questionList.push(hash);
		}
		
		questionList = questionList.slice(-100);
		
		var chatimg = ele.querySelector(".q-a-question__avatar img[src]") || ""
		if (chatimg){
			chatimg = chatimg.src;
		}
		
		if (chatimg === "https://us02st1.zoom.us/web_client/enuunvk/image/default-avatar.png"){
			chatimg = "";
		}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = question;
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		data.textonly = settings.textonlymode || false;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";;
		data.contentimg = "";
		data.question = true;
		data.type = "zoom";
		
		pushMessage(data);
	}
	
	function processMessage(ele, skip=false) {
	  if (!ele || ele.nodeType !== 1 || !ele.isConnected) return;
	  // Mutations may identify a list wrapper, a message, or one of its children.
	  // Always read the same message row, never its changing list position.
	  ele = ele.closest(".chat-item-container") ||
		ele.closest(".new-chat-message__container, .chat-message__container");
	  if (!ele) return;
	  const body = ele.querySelector('.new-chat-message__text-box[id], .chat-message__text-content[id]');
	  const id = ele.getAttribute("data-id") || (body && body.id) || ele.id;
	  if (!id || messageHistory.has(id)) return;
	  if (skip) {
		messageHistory.add(id);
		return;
	  }

	  // Get the avatar image - works with both layouts
	  let img = false;
	  let chatimg = "";
	  try {
		chatimg = ele.querySelector(".chat-item__user-avatar").src;
		img = true;
	  } catch(e) {
		// Silent fail
	  }
	  
	  // Get sender name - works with both layouts
	  let name = "";
	  if (ele.querySelector(".chat-item__sender")) {
		name = ele.querySelector(".chat-item__sender").innerText;
		if (name) {
		  name = name.trim();
		  name = escapeHtml(name);
		}
	  }
	  
	  // Try to get name from previous messages if not found
	  if (!name) {
		try {
		  let prev = ele.previousElementSibling;
		  for (var i = 0; i < 50; i++) {
			if (prev.querySelector('.chat-item__sender')) {
			  break;
			} else {
			  prev = prev.previousElementSibling;
			}
		  }
		  
		  try {
			if (prev.querySelector(".chat-item__sender")) {
			  name = prev.querySelector(".chat-item__sender").innerText;
			  if (name) {
				name = name.trim();
				name = escapeHtml(name);
			  }
			  
			  chatimg = prev.querySelector(".chat-item__user-avatar") || "";
			  if (chatimg) {
				chatimg = chatimg.src;
			  }
			}
		  } catch(e) {}
		} catch(e) {}
	  }
	  
	  // Get message content - supports both old and new layouts
	  let msg = "";
	  try {
		// Try multiple selectors to cover both old and new layouts
		const possibleSelectors = [
		  // New UI selectors
		  '.chat-rtf-box__display ._rtfEditor_1n3rs_1',
		  '._rtfEditor_1n3rs_1',
		  '.new-chat-message__text-box ._rtfEditor_1n3rs_1',
		  // Original selectors
		  '.chat-rtf-box__display',
		  '.new-chat-message__text-box',
		  '.new-chat-message__text-content',
		  '.chat-message__text-content',
		  '.new-chat-message__content'
		];
		
		// Try each selector until we find content
		for (const selector of possibleSelectors) {
		  const element = ele.querySelector(selector);
		  if (element) {
			msg = getAllContentNodes(element);
			if (msg && msg.trim().length > 0) {
			  break;
			}
		  }
		}
		
		// If still no content, try the original method as fallback
		if (!msg || msg.trim().length === 0) {
		  msg = getAllContentNodes(ele.querySelector('.chat-rtf-box__display, .new-chat-message__text-box, .new-chat-message__text-content, .chat-message__text-content, .new-chat-message__content'));
		}
	  } catch(e) {
		//console.log("Error extracting message content:", e);
	  }
	  
	  if (msg) {
		msg = msg.trim();
		if (name) {
		  if (msg.startsWith(name)) {
			msg = msg.replace(name, '');
			msg = msg.trim();
		  }
		}
	  }
	  
	  // Store last sender name and image
	  if (name) {
		lastName = name;
		lastImage = chatimg;
	  } else if (lastName) {
		name = lastName;
		chatimg = lastImage;
	  }
	  
	  // Get content image if any
	  let ctt = ele.querySelector(".chat-image-preview-wrapper img[src]") || "";
	  if (ctt) {
		ctt = ctt.src;
	  }
	  
	  // Prepare message data
	  const data = {
		chatname: name,
		chatbadges: "",
		backgroundColor: "",
		textColor: "",
		chatmessage: msg,
		chatimg: chatimg,
		hasDonation: "",
		membership: "",
		contentimg: "", // ctt
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		textonly: settings.textonlymode || false,
		type: "zoom"
	  };
	  
	  // Incomplete rows and reply editors are not messages. Retry when they hydrate.
	  if (!msg) return;
	  messageHistory.add(id);

	  // Handle content images
	  if (data.contentimg) {
		try {
		  toDataURL(data.contentimg, function(dataUrl) {
			data.contentimg = dataUrl;
			pushMessage(data);
			return;
		  });
		} catch(e) {}
	  } else {
		pushMessage(data);
	  }
	}

	// Updated getAllContentNodes to handle both old and new DOM structures
	function getAllContentNodes(element, flattenListText) {
	  let resp = "";
	  
	  if (!element) {
		return resp;
	  }

	  // Keep lists as one chat message, with punctuation between items.
	  if (element.nodeName === "OL" || element.nodeName === "UL") {
		const items = [];
		element.childNodes.forEach(node => {
		  if (node.nodeName === "LI") {
			const item = getAllContentNodes(node, true).trim();
			if (item) {
			  items.push(item);
			}
		  }
		});
		return items.length ? items.join("; ") + " " : "";
	  }
	  
	  
	  element.childNodes.forEach(node => {
		if (node.nodeName == "BUTTON") {
		  return;
		}
		
		
		if (node.childNodes.length) {
		  resp += getAllContentNodes(node, flattenListText);
		} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)) {
		  const text = flattenListText ? node.textContent.replace(/\s+/g, " ").trim() : node.textContent.trim();
		  resp += escapeHtml(text) + " ";
		} else if (node.nodeType === 1) {
		  // textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
		  if (!settings.textonlymode) {
			if ((node.nodeName == "IMG") && node.src) {
				// Create a clean image element with only necessary attributes
				let imgHtml = '<img';
				
				// Always include src (we already checked it exists)
				imgHtml += ` src="${escapeHtml(node.src)}"`;
				
				// Include alt if present (for accessibility and emoji equivalents)
				if (node.alt) {
					imgHtml += ` alt="${escapeHtml(node.alt)}" title="${escapeHtml(node.alt)}"`;
				}
				
				// Include srcset if present (for responsive images)
				if (node.srcset) {
					imgHtml += ` srcset="${escapeHtml(node.srcset)}"`;
				}
				
				imgHtml += '>';
				resp += imgHtml + " ";
			}
		  } else {
			// In text-only mode, just use the alt text if available
			if ((node.nodeName == "IMG") && node.alt) {
				const alt = flattenListText ? node.alt.replace(/\s+/g, " ").trim() : node.alt;
				resp += escapeHtml(alt) + " ";
			}
		  }
		}
	  });
	  return resp;
	}

	function processChatNode(node, skip=false) {
		if (!node) return;
		if (node.nodeType === 3) node = node.parentElement;
		if (!node || !node.querySelectorAll) return;
		if (node.nodeType === 1) processMessage(node, skip);
		node.querySelectorAll('.chat-item-container, .new-chat-message__container, .chat-message__container')
			.forEach(row => processMessage(row, skip));
		const scanShadow = element => {
			if (!element.shadowRoot) return;
			processChatNode(element.shadowRoot, skip);
			onElementInserted(element.shadowRoot);
		};
		scanShadow(node);
		node.querySelectorAll('*').forEach(scanShadow);
	}

	function onElementInserted(target) {
		if (observedChatContainers.has(target)) return;
		observedChatContainers.add(target);
		// Zoom batches row replacements; scan that batch once, including hydrated rows.
		const observer = new MutationObserver(() => processChatNode(target));
		observer.observe(target, { childList: true, subtree: true, characterData: true });
	}

	console.log("social stream injected");

	setInterval(function() {
			const meeting = window.location.pathname.match(/\/(?:wc|j)\/(\d+)/);
			const scope = meeting ? meeting[1] : window.location.pathname;
			if (scope !== meetingScope) {
				meetingScope = scope;
				messageHistory.clear();
				chatInitialized = false;
				lastName = "";
				lastImage = "";
			}

			const processChatContainer = container => {
				if (!container) return;
				// Exclude history only on first attachment, not every list rebuild.
				processChatNode(container, !chatInitialized);
				chatInitialized = true;
				onElementInserted(container);
			};

			// Scan for chat containers in main DOM
			if (document.getElementById("chat-list-content")) {
				processChatContainer(document.getElementById("chat-list-content"));
				
			} else if (document.querySelector('[data-testid="virtuoso-item-list"]')) {
				processChatContainer(document.querySelector('[data-testid="virtuoso-item-list"]'));
				
			} else if (document.querySelector('.chat-container__chat-list, .chat-container')) {
				processChatContainer(document.querySelector('.chat-container__chat-list,  .chat-container'));
			}

			// Scan for shadow DOM elements
			document.querySelectorAll('*').forEach(element => {
				if (element.shadowRoot) {
				  // Look for chat containers in shadow DOM
				  const shadowChatContainer = element.shadowRoot.querySelector('#chat-list-content, [data-testid="virtuoso-item-list"], .chat-container__chat-list,  .chat-container');
				  if (shadowChatContainer) {
					processChatContainer(shadowChatContainer, true);
				  }
				}
			});

			// Continue with iframe checking (existing code)
			if (document.querySelectorAll('iframe').length) {
				document.querySelectorAll('iframe').forEach(item => {
				  try {
					if (item && item.contentWindow && item.contentWindow.document && 
						(item.contentWindow.document.body.querySelector('#chat-list-content') || 
						 item.contentWindow.document.body.querySelector('[data-testid="virtuoso-item-list"]') || 
						 item.contentWindow.document.body.querySelector('.chat-container__chat-list .chat-container') 
						)) {
					  
					  const chatContainer = item.contentWindow.document.body.querySelector('#chat-list-content') || 
									   item.contentWindow.document.body.querySelector('[data-testid="virtuoso-item-list"]') ||
									   item.contentWindow.document.body.querySelector('.chat-container__chat-list, .chat-container');
					  
					  //
					  processChatContainer(chatContainer);
					}
					
					// Additionally check for shadow DOM within iframes
					if (item && item.contentWindow && item.contentWindow.document) {
					  item.contentWindow.document.querySelectorAll('*').forEach(frameElement => {
						if (frameElement.shadowRoot) {
						  const shadowChatContainer = frameElement.shadowRoot.querySelector('#chat-list-content, [data-testid="virtuoso-item-list"], .chat-container__chat-list .chat-container');
						  if (shadowChatContainer) {
							processChatContainer(shadowChatContainer, true);
						  }
						}
					  });
					}
				  } catch(e) {
					// Silent fail for iframes
				  }
				});
			}

			// Rest of your existing interval code
			if (document.getElementById("poll__body")){
				streamPollRAW(document.getElementById("poll__body"));
			}

			// Process reactions in regular DOM
			querySelectorAllIncludingShadow('[class^="animation-reactions/"]:not([data-skip])').forEach(reaction => {
				reaction.dataset.skip = true;
				var data = {};
				data.chatname = "";
				data.chatmessage = reaction.querySelector("svg,img")?.outerHTML;
				if (!data.chatmessage) return;
				data.event = "reaction";
				data.type = "zoom";
				// HTML-mode chatmessage may contain formatting/emotes; keep its normal HTML sanitization boundary.
				data.textonly = false;
				pushMessage(data);
			});

			  // Process reactions in regular DOM
			document.querySelectorAll('[class^="animation-reactions/"]:not([data-skip])').forEach(reaction=>{

					//console.warn("34");
					var data = {};
					data.chatname = "";
					data.chatmessage = reaction.querySelector("svg,img")?.outerHTML;
					if (!data.chatmessage) return;
					data.event = "reaction";
					data.type = "zoom";
					// HTML-mode chatmessage may contain formatting/emotes; keep its normal HTML sanitization boundary.
					data.textonly = false;
					pushMessage(data);
			});

			document.querySelectorAll('[class^="animation-reactions/"]:not([data-skip])').forEach(reaction=>{
				reaction.dataset.skip = true;
				
				var data = {};
				data.chatname = "";
				data.chatmessage = reaction.querySelector("svg,img").outerHTML;
				if (!data.chatmessage){return;}
				data.event = "reaction";
				data.type = "zoom";
				// HTML-mode chatmessage may contain formatting/emotes; keep its normal HTML sanitization boundary.
				data.textonly = false;
				////console.log(data);
				pushMessage(data);
				
			});

			document.querySelectorAll('iframe').forEach( item =>{
				if (item && item.contentWindow && item.contentWindow.document && item.contentWindow.document.body){
					item.contentWindow.document.body.querySelectorAll('[class^="animation-reactions/"]:not([data-skip])').forEach(reaction=>{
						reaction.dataset.skip = true;
						var data = {};
						data.chatname = "";
						data.chatmessage = reaction.querySelector("svg,img").outerHTML;
						if (!data.chatmessage){return;}
						data.event = "reaction";
						data.type = "zoom";
						// HTML-mode chatmessage may contain formatting/emotes; keep its normal HTML sanitization boundary.
						data.textonly = false;
						////console.log(data);
						pushMessage(data);
					});
					
					if (item.contentWindow.document.body.querySelector("#q-a-container-window")){
						item.contentWindow.document.body.querySelectorAll("#q-a-container-window .q-a-question").forEach(ele=>{
							if (ele.ignore){return;}
							ele.ignore = true;
							processQuestion(ele);
							
						});
					}
				}
			});


			if (document.getElementById('chat-list-content')) {
				// prevent chat box from stop scrolling, which makes messages stop appearing
				document.getElementById('chat-list-content').scrollTop = document.getElementById('chat-list-content').scrollTop + 1000
			}

			if (document.querySelector('[aria-label="open the chat pane"]')) { // prevent chat box from being closed after screen-share by keeping it always open
				document.querySelector('[aria-label="open the chat pane"]').click()
			}

			if (document.querySelector("#q-a-container-window")){
				document.querySelectorAll("#q-a-container-window .q-a-question").forEach(ele=>{
					if (ele.ignore){return;}
					ele.ignore = true;
					processQuestion(ele);
					
				});
			}
		
	},1000);
	
	
	/////
	// Helper function to query elements inside shadow DOM and regular DOM
	function querySelectorAllIncludingShadow(selector, root = document) {
		  // Start with regular DOM query
		  let elements = Array.from(root.querySelectorAll(selector));
		  
		  // Query shadow DOM if present
		  const shadowRoots = [];
		  
		  // Get all elements that might have shadowRoot
		  const allElements = root.querySelectorAll('*');
		  allElements.forEach(el => {
			if (el.shadowRoot) {
			  shadowRoots.push(el.shadowRoot);
			  // Recursive search in shadow DOM
			  elements = elements.concat(Array.from(el.shadowRoot.querySelectorAll(selector)));
			}
		  });
		  
		  // Do the same recursively for any nested shadow roots
		  shadowRoots.forEach(shadowRoot => {
			elements = elements.concat(querySelectorAllIncludingShadow(selector, shadowRoot));
		  });
		  
		  return elements;
	}
	
	
	///////// the following is a loopback webrtc trick to get chrome to not throttle this tab when not visible.
	try {
		var receiveChannelCallback = function (event) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function (e) {};
			remoteConnection.datachannel.onopen = function (e) {};
			remoteConnection.datachannel.onclose = function (e) {};
			setInterval(function () {
				remoteConnection.datachannel.send("KEEPALIVE");
			}, 1000);
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
				//console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch (e) {
		//console.log(e);
	}

	try {
		window.onblur = null;
		window.blurred = false;
		document.hidden = false;
		document.visibilityState = "visible";
		document.mozHidden = false;
		document.webkitHidden = false;
	} catch (e) {}

	try {
		document.hasFocus = function () {
			return true;
		};
		window.onFocus = function () {
			return true;
		};

		Object.defineProperty(document, "mozHidden", { value: false });
		Object.defineProperty(document, "msHidden", { value: false });
		Object.defineProperty(document, "webkitHidden", { value: false });
		Object.defineProperty(document, "visibilityState", {
			get: function () {
				return "visible";
			},
			value: "visible",
			writable: true
		});
		Object.defineProperty(document, "hidden", { value: false, writable: true });

		setInterval(function () {
			window.onblur = null;
			window.blurred = false;
			document.hidden = false;
			document.visibilityState = "visible";
			document.mozHidden = false;
			document.webkitHidden = false;
			document.dispatchEvent(new Event("visibilitychange"));
		}, 200);
	} catch (e) {}

	try {
		document.onvisibilitychange = function () {
			window.onFocus = function () {
				return true;
			};
		};
	} catch (e) {}

	try {
		for (event_name of [
			"visibilitychange",
			"webkitvisibilitychange",
			"blur", // may cause issues on some websites
			"mozvisibilitychange",
			"msvisibilitychange"
		]) {
			try {
				window.addEventListener(
					event_name,
					function (event) {
						event.stopImmediatePropagation();
						event.preventDefault();
					},
					true
				);
			} catch (e) {}
		}
	} catch (e) {}
	
})();
