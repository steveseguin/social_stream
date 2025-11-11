(function () {
	 
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (25 * 1024)) {
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
			console.error(e);
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
				resp += getAllContentNodes(node);
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
						resp += node.outerHTML;
					} else {
						resp += node.textContent;
					}
				}
			}
		});
		return resp;
	}
	
	function processMessage(ele){
		
		var name="";
		if (ele.querySelector('.chat-history--username, [data-js="raid_owner_name"]')){
		  if (ele.parentNode.id !== "chat-history-list"){return;}
		  name = ele.querySelector('.chat-history--username, [data-js="raid_owner_name"]').innerText;
		  if (name){
			name = name.trim();
			name = escapeHtml(name);
		  }
		  
		} else if (ele.querySelector('.chat-history--rant-username')){
		  name = ele.querySelector('.chat-history--rant-username').innerText;
		  if (name){
			name = name.trim();
			name = escapeHtml(name);
		  }
		} else {
			return;
		}
		
		var nameColor = "";
		try {
			nameColor = ele.querySelector('.chat-history--username[style], .chat-history--username [style]').style.color || "";
		}catch(e){
			
		}
		
		var eventType = "";
		if (ele.classList.contains("chat-history__incoming-raid-container")){
			eventType = "raid";
		}
		
		
		var chatimg = "";
		if (ele.querySelector('img.chat-history--user-avatar[src], img.chat-history__incoming-raid-avatar[src]')){
			try {
				chatimg = ele.querySelector('img.chat-history--user-avatar[src], img.chat-history__incoming-raid-avatar[src]').src;
			} catch(e){
				chatimg = "";
			}
		}

		var msg = "";
		
		if (ele.querySelector('.chat-history--message, .chat-history__incoming-raid-content-message > span, .chat-history--rant-text')){
			try {
				msg = getAllContentNodes(ele.querySelector('.chat-history__incoming-raid-content-message > span, .chat-history--message, .chat-history--rant-text'));
			} catch(e){}
		} 
		
		var dono = "";
		try {
			if (ele.querySelector('.chat-history--rant-price')){
				dono = escapeHtml(ele.querySelector('.chat-history--rant-price').innerText);
			}
		} catch(e){
		}
		
		if (msg){
			msg = msg.trim();
		}
		
		var contentimg = "";
		try {
			contentimg = ele.querySelector('img.chat-history__incoming-raid-bg-img[src]').src;
		} catch(e){}
		
		
		var brandedImg = document.querySelector(".media-by-wrap .user-image") || "";
		try {
			if (brandedImg){
				try {
					brandedImg = getComputedStyle(document.querySelector(".media-by-wrap .user-image")).backgroundImage
					brandedImg = "https://"+brandedImg.split("https://")[1];
					brandedImg = brandedImg.split('")')[0];
				} catch(e){
					console.error(e);
					brandedImg = "";
				}
			}
		} catch(e){
		}
		try {
			var badges = [];
			ele.querySelectorAll(".chat-history--user-badge[src]").forEach(badge=>{
				badges.push(badge.src);
			});
		} catch(e){
		}
		
		

		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = dono;
		data.membership = "";
		data.contentimg = contentimg;
		data.event = eventType;
		data.textonly = settings.textonlymode || false;
		data.type = "rumble";
		
		if (brandedImg){
			data.sourceImg = brandedImg;
			try {
				toDataURL(data.sourceImg, function(dataUrl) {
					data.sourceImg = dataUrl;
					if (data.chatimg){
						toDataURL(data.chatimg, function(dataUrl) {
							pushMessage(data);
						});
					} else {
						pushMessage(data);
					}
				});
			} catch(e){
				pushMessage(data);
			}
		} else {
			if (data.chatimg){
				try {
					toDataURL(data.chatimg, function(dataUrl) {
						data.chatimg = dataUrl;
						pushMessage(data);
					});
				} catch(e){
					pushMessage(data);
				}
				
			} else {
				pushMessage(data);
			}
		}
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	var isExtensionOn = true;
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (response && "settings" in response){
			settings = response.settings;
		}
		if (response && "state" in response) {
			isExtensionOn = response.state;
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request && isExtensionOn){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('#chat-message-text-input').focus();
					sendResponse(true);
					return;
				}
				if (typeof request === "object"){
					if ("state" in request) {
						isExtensionOn = request.state;
					}
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
							if (mutation.addedNodes[i] && mutation.addedNodes[i].className && mutation.addedNodes[i].className.includes("chat-history--rant-sticky")){return;}
							processMessage(mutation.addedNodes[i]);
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
	
	

	

	var count = -1;

	
	function checkViewers(){ 
		if (isExtensionOn && (settings.showviewercount || settings.hypemode)){
			
			try {
				var video_id = parseInt(document.querySelector("[data-video-fid]").dataset.videoFid);
			} catch(e){
				return;
			}
			
			var URL = "https://wn0.rumble.com/service.php?video_id="+video_id+"&name=video.watching-now&included_js_libs=main%2Cweb_services%2Cevents%2Cerror%2Cfacebook_events%2Chtmx.org%2Cnavigation-state%2Cmodal-base%2Cdarkmode%2Crandom%2Clocal_storage%2Cnotify%2Cpopout%2Ctooltip%2Ccontext-menus%2Cprovider%2Cswipe-slider%2Cui%2Cads%2Csearch-bar%2Cui_header%2Cmain-menu-item-hover%2Cpremium-popup&included_css_libs=global";
			
			
			fetch(URL, {
			  method: 'GET',
			  credentials: 'include', // This sends all cookies automatically
			  headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			  }
			})
			.then(response => response.json())
			.then(data => {
				
			  try {
				//console.log(data);
				let viewr = data.viewer_count || data.num_watching_now || data?.data.viewer_count || data?.data.num_watching_now;
				viewr = parseInt(viewr);
				if (isNaN(viewr)){return;}
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					({message:{
					  type: 'rumble',
					  event: 'viewer_update', 
					  meta: viewr
					}}),
					function (e) {}
				);
				
			  } catch (e) {
				//console.log(e);
			  }       
			});
		}
	}
	
	setInterval(function(){
		checkViewers();
	},10000);

	setInterval(function(){
		if (document.querySelector('.chat--height')){
			if (!document.querySelector('.chat--height').marked){
				document.querySelector('.chat--height').marked=true;
				
				onElementInserted(document.querySelector('.chat--height'));
				checkViewers();
				//document.querySelectorAll(".chat-history--row").forEach(ele=>{
				//	processMessage(ele);
				//});
			} 
			if (!document.querySelector('img[src="/img/astronaut-404.png"]') && window.location.href.endsWith("/live") && document.querySelector('[data-video-id]')){
				window.location.href = "https://rumble.com/chat/popup/"+document.querySelector('[data-video-id]').dataset.videoId;
			}
			
		} else {
			if (window.location.href.endsWith("/live") && document.querySelector('img[src="/img/astronaut-404.png"]')){
				if (window.location.href.includes("/user/")){
					window.location.href = window.location.href.replace("/user/","/");
				} else if (window.location.href.includes("/c/")){
					window.location.href = window.location.href.replace("/c/","/user/");
				}
				
			} else if (!document.querySelector('img[src="/img/astronaut-404.png"]') && window.location.href.endsWith("/live") && document.querySelector('[data-video-id]')){
				window.location.href = "https://rumble.com/chat/popup/"+document.querySelector('[data-video-id]').dataset.videoId;
			}
		}
		
		
		if (document.querySelector('video') && !document.querySelector('video').p && document.querySelector('video').played){
			document.querySelector('video').p = "true";
			document.querySelector('video').pause();
		}
	},1000);

})();