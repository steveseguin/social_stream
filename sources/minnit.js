(async function () {
	try {
	
	async function toDataURL(blobUrl) {
		var res = null;
		var rej = null;
		var promise = new Promise((resolve, reject) => {
			res = resolve;
			rej = reject;
		});
		
		
		var xhr = new XMLHttpRequest;
		xhr.responseType = 'blob';

		xhr.onload = function() {
		   var recoveredBlob = xhr.response;

		   var reader = new FileReader;

		   reader.onload = function() {
			 res(reader.result);
		   };
		   
		   reader.onerror = function(){
			   rej(false);
		   }

		   reader.readAsDataURL(recoveredBlob);
		};
		
		xhr.onerror = function(){
			rej(false);
		}

		xhr.open('GET', blobUrl);
		xhr.send();
	};

	console.log("social stream injected");
	
	function convertEmoji(ele){ // eles[i]
		var chatmessage = "";
		var emoji = ele.textContent.trim();
		emoji = escapeHtml(emoji);
		switch(emoji) {
			case ":smile:":
				chatmessage += "😀";
				break;
			case ":frown:":
				chatmessage += "☹️";
				break;
			case ":biggrin:":
				chatmessage += "😄";
				break;
			case ":eek:":
				chatmessage += "😱";
				break;
			case ":tongue:":
				chatmessage += "😝";
				break;
			case ":sleep:":
				chatmessage += "😴";
				break;
			case ":biggrin:":
				chatmessage += "😄";
				break;
			case ":mad:":
				chatmessage += "😡";
				break;
			case ":cry:":
				chatmessage += "😢";
				break;
			case ":love:":
				chatmessage += "😍";
				break; 
			case ":love:":
				chatmessage += "😍";
				break; 
			case ":xd:":
				chatmessage += "😝";
				break;
			case ":sleep:":
				chatmessage += "😴";
				break;
			case ":wink:":
				chatmessage += "😉";
				break;
			case ":clap:":
				chatmessage += "👏";
				break;
			case ":nod:":
				chatmessage += "😌";
				break; 
			case ":smh:":
				chatmessage += "😒";
				break;
			case ":evil:":
				chatmessage += "🤪";
				break;
			case ":lol:":
				chatmessage += "😂";
				break;
			case ":uncertain:":
				chatmessage += "😐";
				break;
			case ":bye:":
				chatmessage += "👋";
				break; 
			case ":smirk:":
				chatmessage += "😏";
				break;
			case ":really:":
				chatmessage += "😳";
				break;
			case ":sideeye:":
				chatmessage += "🤨";
				break;
			case ":glare:":
				chatmessage += "😠";
				break;
			case ":greed:":
				chatmessage += "🤑";
				break;
			case ":confused:":
				chatmessage += "😕";
				break;
			case ":meh:":
				chatmessage += "😕";
				break;
			case ":dead:":
				chatmessage += "😵";
				break;
			case ":groove:":
				chatmessage += "🎶";
				break;
			case ":blush:":
				chatmessage += "☺️";
				break; 
			case ":speechless:":
				chatmessage += "😶";
				break;
			case ":ill:":
				chatmessage += "🤮";
				break;
			case ":annoyed:":
				chatmessage += "😡";
				break;
			case ":swear:":
				chatmessage += "🤬";
				break;
			case ":emo:":
				chatmessage += "😍";
				break; 
			case ":yum:":
				chatmessage += "🤤";
				break;
			case ":bashful:":
				chatmessage += "😌";
				break;
			case ":ticked:":
				chatmessage += "😒";
				break;
			case ":kiss:":
				chatmessage += "😘";
				break;
			case ":roll:":
				chatmessage += "🙄";
				break; 
			case ":hug:":
				chatmessage += "🤗";
				break;
			case ":party:":
				chatmessage += "🥳";
				break;
			case ":awkward:":
				chatmessage += "😬";
				break;
			case ":love:":
				chatmessage += "😍";
				break;
			case ":whine:":
				chatmessage += "😢";
				break; 
			case ":angel:":
				chatmessage += "😇";
				break;
			case ":cool:":
				chatmessage += "😎";
				break;
			case ":dealwithit:":
				chatmessage += "😎";
				break;
			case ":dance:":
				chatmessage += "💃";
				break;
			case ":thumbsup:":
				chatmessage += "👍";
				break; 
			case ":thumbsdown:":
				chatmessage += "👎";
				break;
			case ":heart:":
				chatmessage += "❤️";
				break;
			case ":brokenheart:":
				chatmessage += "💔";
				break;
			case ":wink:":
				chatmessage += "😉";
				break;
			case ":cry:":
				chatmessage += "😭";
				break;
			case ":xd:":
				chatmessage += "😝";
				break;
			/// and whatever more you want to add
			default:
				break;
		}
		return chatmessage;
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
	
	async function processMessage(ele){
		
		if (ele.marked){return;}
		ele.marked = true;
		
		var chatimg = "";
		try{
			chatimg = ele.querySelector('.msgPic').querySelector("img").src;
		} catch(e){
			
		}
		
        var name = "";
		try {
			name = escapeHtml(ele.querySelector(".msgNick").innerText);
		} catch(e){}
		

		var chatmessage="";
		try{
			// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
			if (settings.textonlymode){
				var eles = ele.querySelector(".msgTextOnly").childNodes;
				for (var i = 0; i<eles.length; i++){
					if (eles[i].nodeName == "#text"){
						chatmessage += escapeHtml(eles[i].textContent.trim());
					} else if (!eles[i].classList.contains("minnit-tooltip")){
						chatmessage += convertEmoji(eles[i]);
					}
				}
			} else {
				var eles = ele.querySelector(".msgTextOnly").childNodes;
				for (var i = 0; i<eles.length; i++){
					if (eles[i].querySelector && eles[i].querySelector("canvas")){ // converts the canvas into an actual image.
						var png = eles[i].querySelector("canvas").toDataURL();
						chatmessage += "<img src='"+png+"'/>";
					} else if (eles[i].classList && eles[i].classList.contains("minnit-tooltip")){
						chatmessage += convertEmoji(eles[i]);
					} else if (eles[i].nodeName == "#text"){
						chatmessage += escapeHtml(eles[i].textContent.trim());
					}
				}
			}
		} catch(e){
			console.error(e);
			return;
		}
		
		if (chatmessage){
			chatmessage = chatmessage.trim();
		}
		
		if (!chatmessage){return;}

		var data = {};
		data.chatname = name;
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
		data.type = "minnit";

		pushMessage(data);
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
	}
	var listener = false;
	var keepAlive = null;
	
	function startListener(){
		if (listener){return;}
		listener = true;
		chrome.runtime.onMessage.addListener(
			function (request, sender, sendResponse) {
				try{
					if ("getSource" == request){sendResponse("minnit");	return;	}
					if ("focusChat" == request){
						try {
							var ele = document.querySelector('iframe').contentWindow.document.body.querySelector("#textbox");
							if (ele){
								ele.focus();
								ele.innerHTML = "";
								sendResponse(true);
								return;
							} 
						} catch(e){}
						
						
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
		clearInterval(keepAlive);
		keepAlive = setInterval(function(){
			
	var isExtensionOn = true;
console.log("KEEP ALIVE");
			chrome.runtime.sendMessage(chrome.runtime.id, { "keepAlive": true }, function(response){});
		},3000000);
	}
	
	document.onkeydown = function(){
		clearInterval(keepAlive);
		keepAlive = setInterval(function(){
			console.log("KEEP ALIVE");
			chrome.runtime.sendMessage(chrome.runtime.id, { "keepAlive": true }, function(response){});
		},3000000);
	};

	
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

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].dataset.muuid && (mutation.addedNodes[i].dataset.muuid !== "undefined")){
								
								callback(mutation.addedNodes[i]);
							}
						} catch(e){}
					}
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	

	var timer = setInterval(function(){
		document.querySelectorAll('iframe').forEach( item =>{
			
			if (item && item.contentWindow.document.body.querySelector('#chat')){
				if (item.contentWindow.document.body.querySelector('#loadingscreen') && (item.contentWindow.document.body.querySelector('#loadingscreen').style.display != "none")){
					return;
				}
				clearInterval(timer);
				setTimeout(function(ele){onElementInserted(ele, processMessage);},1000, item.contentWindow.document.body.querySelector('#chat'));
					
				startListener();
				return;
			} 
		});
		
	},1000);
	
	} catch(e){
	}
})();
