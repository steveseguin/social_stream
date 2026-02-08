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
	
	var userId = "";
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

	function checkFollowers(){
		userId = urlParams.get('id') || "";
		if (userId && (settings.showviewercount || settings.hypemode)){
			fetch('https://prod-api.parti.com/parti_v2/profile/livestream/heartbeat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					user_id: parseInt(userId, 10),
					token: (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2)
				})
			})
			.then(function(response){
				return response.json();
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
				hasDonation = msg.split("tipped")[1].split("🎉")[0].trim();
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
		

		var data = {};
		data.chatname = name;
		data.chatbadges = chatbadge;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "parti";
		
		
		pushMessage(data);
		
	}
	
	
	function pushMessage(data){
		try{
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
                        document.querySelector('.chat-input input[placeholder][type="text"]').focus();
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
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
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
			if (document.querySelector('#q-app main > div > div[class], .main-content-area >  [class] > [class] > [class] > div')){
				if (!document.querySelector('#q-app main > div > div[class], .main-content-area >  [class] > [class] > [class] > div').marked){
					document.querySelector('#q-app main > div > div[class], .main-content-area >  [class] > [class] > [class] > div').marked=true;
					[...document.querySelectorAll('#q-app main > div > div[class]>div, .main-content-area >  [class] > [class] > [class] > div')].forEach(ele=>{
						try {
							processMessage(ele);
							ele.marked = true;
						} catch(e){}
					});
					
					onElementInserted(document.querySelector('#q-app main > div > div[class], .main-content-area  > [class] > [class] > [class]'));
				}
			}
		} catch(e){}
	},2000);

})();
