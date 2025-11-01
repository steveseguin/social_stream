(function () {
	 
	
	var isExtensionOn = true;
function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
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
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
	}
	
	var namePhotoList = {};
	
	
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
	
	async function processMessage(ele){
		
		if (!ele || !ele.classList || !ele.classList.contains('row')){return;}
		
		try {
			var name="";
			var img="";
			try {
				name = ele.querySelector('.v-avatar').querySelector('.v-image').ariaLabel.replace("avatar","").trim();
			} catch(e){
				return; // no name, no game.
			}
			
			try {	
				img = ele.querySelector('.v-avatar').querySelector('.v-image').querySelector('.v-image__image--cover').style.backgroundImage.split('url("')[1].split('")')[0];
			} catch(e){
				img = "";
				await sleep(300)
				try {	
					img = ele.querySelector('.v-avatar').querySelector('.v-image').querySelector('.v-image__image--cover').style.backgroundImage.split('url("')[1].split('")')[0];
				} catch(e){
					await sleep(300)
					try {	
						img = ele.querySelector('.v-avatar').querySelector('.v-image').querySelector('.v-image__image--cover').style.backgroundImage.split('url("')[1].split('")')[0];
					} catch(e){
						await sleep(300)
						try {	
							img = ele.querySelector('.v-avatar').querySelector('.v-image').querySelector('.v-image__image--cover').style.backgroundImage.split('url("')[1].split('")')[0];
						} catch(e){
							await sleep(300)
							try {	
								img = ele.querySelector('.v-avatar').querySelector('.v-image').querySelector('.v-image__image--cover').style.backgroundImage.split('url("')[1].split('")')[0];
							} catch(e){
								// check to see if there is a saved image..  I do this after a delay time out as I don't want to give someone an easy opportunity to hijack a guest's photo with a spoofed name
								img = namePhotoList[name] || "";
								if (img){
									console.log("Name list used:"+ img);
								}
								// give up after 1.5-seconds of delay otherwise
							}
						}
					}
				}
			}
			
			if (img){
				namePhotoList[name] = img; // saving the image to the name list, just in case.
			}
			
			
			var msg = "";
			ele.querySelectorAll('.message-body').forEach(ee=>{
				if (ee.nodeType == Node.TEXT_NODE){
					msg += escapeHtml(ee.textContent);
					msg = msg.trim();
				} else if ( (ee.nodeName  == "IMG")){
					msg += "<img src='"+ee.src+"' />";
					msg = msg.trim();
				}  else {
					msg += escapeHtml(ee.textContent);
					msg = msg.trim();
				}
			});

			if (!msg.length){return;}
			
			
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
			data.type = "buzzit";
			
			pushMessage(data);
		} catch(e){
			console.error(e);
		}
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("getSource" == request){sendResponse("buzzit");	return;	}
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('textarea').focus();
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
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].skip){return;}
							mutation.addedNodes[i].skip = true;
							setTimeout(function(node){ // let the image load async
								processMessage(node);
							},300,mutation.addedNodes[i]);
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
	
	console.log("social stream injected");

	var timer = setInterval(function(){
		if (document.querySelector('#messageList')){
			if (!document.querySelector('#messageList').marked){
				document.querySelector('#messageList').marked=true;
				clearInterval(timer);
				onElementInserted(document.querySelector('#messageList'));
			}
		}
	},3000);

})();
