(function () {
	
	var isExtensionOn = true;
	var viewerRequest = null;
	function viewerChannel() {
		if (!/^(www\.)?picarto\.tv$/.test(location.hostname)) { return ""; }
		var match = location.pathname.match(/^\/chatpopout\/([^/]+)(?:\/public)?\/?$/);
		return match ? match[1] : "";
	}
	function checkViewers() {
		var channel = viewerChannel();
		if (!channel || viewerRequest || !isExtensionOn || !(settings.showviewercount || settings.hypemode)) { return; }
		var xhr = new XMLHttpRequest();
		viewerRequest = xhr;
		xhr.open("GET", "https://api.picarto.tv/api/v1/channel/name/" + channel);
		xhr.timeout = 10000;
		xhr.onload = function () {
			if (xhr.status !== 200 || channel !== viewerChannel() || !isExtensionOn || !(settings.showviewercount || settings.hypemode)) { return; }
			try {
				var stream = JSON.parse(xhr.responseText);
				if (typeof stream.name !== "string" || stream.name.toLowerCase() !== decodeURIComponent(channel).toLowerCase() || typeof stream.online !== "boolean") { return; }
				var count = stream.online ? stream.viewers : 0;
				if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) { return; }
				pushMessage({ type: "picarto", event: "viewer_update", meta: count });
			} catch (e) {}
		};
		xhr.onloadend = function () { if (viewerRequest === xhr) { viewerRequest = null; } };
		xhr.send();
	}
function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
	}

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
				// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
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
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
	}
	
	async function processMessage(first, ele){
		var content = ele;
		var messageElement = content.querySelector("[class*='Message__StyledSpan']");
		if (!messageElement || messageElement.ssnCaptured || messageElement.ssnPending) { return; }
		
		var chatname="";
		try {
			chatname = content.querySelector("[class*='ChannelDisplayName__Name']").textContent;
			chatname = chatname.trim();
			chatname = escapeHtml(chatname);
		} catch(e){
			try {
				chatname = first.querySelector("[class*='ChannelDisplayName__Name']").textContent;
				chatname = chatname.trim();
				chatname = escapeHtml(chatname);
			} catch(e){
				return;
			}
		}
		
		if (!chatname || (!messageElement.textContent.trim() && !messageElement.querySelector("img"))) { return; }
		messageElement.ssnPending = true;
		var chatmessage="";
		try{
			 // textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
			 if (settings.textonlymode){
				var plainMessage = messageElement.cloneNode(true);
				plainMessage.querySelectorAll("br").forEach(function (br) {
					br.replaceWith(document.createTextNode("\n"));
				});
				chatmessage = plainMessage.textContent;
			 } else {
				 
				if (content.querySelector("[class*='Message__StyledSpan']").querySelector("img")){
					await sleep(500); // allow time for the image to load, else it will be transparent.png, which is worthless.
				}
				 
				content.querySelector("[class*='Message__StyledSpan']").childNodes.forEach(ele2=>{
					if (ele2.nodeType == Node.TEXT_NODE){
						chatmessage += escapeHtml(ele2.textContent);
					} else if (ele2.nodeName === "BR"){
						chatmessage += "<br>";
					} else if (ele2.querySelector("img")){
						chatmessage += "<img src='"+ele2.querySelector("img").src+"'/>";
					} else {
						chatmessage += escapeHtml(ele2.textContent);
					}
				});
				chatmessage = chatmessage.trim();
			 }
		} catch(e){
			messageElement.ssnPending = false;
			return;
		}
		messageElement.ssnPending = false;
		if (!chatmessage) { return; }
		messageElement.ssnCaptured = true;

		var chatimg="";
		try{
			chatimg = content.querySelector("span[class*='AvatarIcon__']>img").src;
		} catch(e){
			try {
				chatimg = first.querySelector("span[class*='AvatarIcon__']>img").src;
			} catch(e){
				chatimg = "";
			}
		}
		if (chatimg == "https://images.picarto.tv/ptvimages/avatar.jpg"){
			chatimg = "";
		}

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.membership = "";;
	  data.contentimg = "";
	  // Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
	  data.textonly = settings.textonlymode || false;
	  data.type = "picarto";
	  pushMessage(data);
	}
	
	
	function onElementInserted(containerSelector, callback) {
		var target = document.querySelector(containerSelector);
		if (!target) { return; }
		function inspect(node) {
			if (!node || node.nodeType !== 1) { return; }
			var messages = [];
			var closest = node.closest("[class*='Message__StyledSpan']");
			if (closest) { messages.push(closest); }
			node.querySelectorAll("[class*='Message__StyledSpan']").forEach(function (message) { messages.push(message); });
			if (!messages.length) {
				var authorGroup = node.closest("[class*='ChannelChat__MessageBoxWrapper']");
				if (authorGroup) { authorGroup.querySelectorAll("[class*='Message__StyledSpan']").forEach(function (message) { messages.push(message); }); }
			}
			messages.forEach(function (message) {
				var group = message.closest("[class*='ChannelChat__MessageBoxWrapper']");
				if (group) { callback(group, message.parentElement); }
			});
		}
		var observer = new (window.MutationObserver || window.WebKitMutationObserver)(function (mutations) {
			mutations.forEach(function (mutation) {
				inspect(mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement);
				mutation.addedNodes.forEach(inspect);
			});
		});
		observer.observe(target, { childList: true, subtree: true, characterData: true });
	}
		console.log("social stream injected");
	
	
	setInterval(function(){ // clear existing messages; just too much for a stream.
		
		
		if (document.querySelector("[class*='styled__ChatContainer']") && !document.querySelector("[class*='styled__ChatContainer']").marked){
			document.querySelector("[class*='styled__ChatContainer']").marked = true;
			document.querySelectorAll("[class*='styled__ChatContainer'] [class*='Message__StyledSpan']").forEach(function (message) { message.ssnCaptured = true; });
			console.log("LOADED SocialStream EXTENSION");
			
			try { 
				var main = document.querySelectorAll("[class*='ChannelChat__MessageBoxWrapper']");
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
							//processMessage(main[j]);
						} 
					} catch(e){}
				}
				var main = document.querySelectorAll("[class*='StandardTypeMessagecontainer__BlockRow']");
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
							//processMessage(main[j]);
						} 
					} catch(e){}
				}
			} catch(e){ }
			
			onElementInserted("[class*='styled__ChatContainer']", function(first, element){
				processMessage(first, element);
			});
		}
		
		
	},4000);

	var settings = {};
	// textonlymode capture contract: literal chatmessage string, no app-added markup; render as text, not HTML.
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
		}
		if ("state" in response) { isExtensionOn = response.state; }
		checkViewers();
	});
	setInterval(checkViewers, 30000);

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("picarto");	return;	}
				if ("focusChat" == request){
					if (!document.querySelector("textarea[placeholder]")){
						sendResponse(false);
						return;
					}
					document.querySelector("textarea[placeholder]").focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						if ("state" in request) { isExtensionOn = request.state; }
						checkViewers();
						sendResponse(true);
						return;
					}
					if ("state" in request) {
						isExtensionOn = request.state;
						checkViewers();
						sendResponse(true);
						return;
					}
				}
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();
