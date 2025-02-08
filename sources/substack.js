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

	function escapeHtml(unsafe){ // success is when goofs be trying to hack me
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;") || "";
	}
	function getAllContentNodes(element) {
		var resp = "";
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.nodeType===3){
				return escapeHtml(element.textContent) || "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				if (!node.classList.contains("comment-see-more")){
					resp += getAllContentNodes(node)
				}
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
	
	
	//<div class="pencraft pc-display-flex pc-flexDirection-column pc-alignSelf-stretch pc-reset border-left-detail-v66rUa sizing-border-box-DggLA4 chatContainer-LWn5Rp"><h4 class="pencraft pc-padding-16 pc-reset userSelect-none-oDUy26 border-bottom-detail-k1F6C4 line-height-24-jnGwiv font-display-nhmvtD size-20-P_cSRT weight-bold-DmI9lw reset-IxiVJZ">Live Chat</h4><div class="pencraft pc-display-flex pc-flexDirection-column-reverse pc-position-relative flexGrow-tjePuI pc-reset overflow-auto-7WTsTi scrollBar-hidden-HcAIpI"><div class="pencraft pc-display-flex pc-flexDirection-column pc-padding-16 pc-gap-16 pc-reset"><div class="pencraft pc-display-flex pc-gap-12 pc-reset message-lU6Uj5"><a href="https://substack.com/@swollenjustice" target="_blank" utmsource="live-stream-chat" class="pencraft pc-display-contents pc-reset"><div class="pencraft pc-display-flex pc-width-24 pc-height-24 pc-justifyContent-center pc-alignItems-center pc-position-relative flexAuto-Bzdrdy pc-reset bg-secondary-UUD3_J animate-XFJxE4 outline-detail-vcQLyr pc-borderRadius-full overflow-hidden-WdpwT6 sizing-border-box-DggLA4 pressable-sm-YIJFKJ showFocus-sk_vEm container-TAtrWj interactive-UkK0V6" tabindex="0" style="--scale: 24px;"><div class="pencraft pc-display-flex pc-width-24 pc-height-24 pc-justifyContent-center pc-alignItems-center pc-position-relative flexAuto-Bzdrdy pc-reset bg-secondary-UUD3_J outline-detail-vcQLyr pc-borderRadius-full overflow-hidden-WdpwT6 sizing-border-box-DggLA4 container-TAtrWj" title="Swollen Justice" style="--scale: 24px;"><picture><source type="image/webp" srcset="https://substackcdn.com/image/fetch/w_24,h_24,c_fill,f_webp,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc9ec27a7-607c-48aa-8aae-cc1e8c628e25_1024x1022.jpeg 24w, https://substackcdn.com/image/fetch/w_48,h_48,c_fill,f_webp,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc9ec27a7-607c-48aa-8aae-cc1e8c628e25_1024x1022.jpeg 48w, https://substackcdn.com/image/fetch/w_72,h_72,c_fill,f_webp,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc9ec27a7-607c-48aa-8aae-cc1e8c628e25_1024x1022.jpeg 72w" sizes="24px"><img class="img-OACg1c pencraft pc-reset" src="https://substackcdn.com/image/fetch/w_24,h_24,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc9ec27a7-607c-48aa-8aae-cc1e8c628e25_1024x1022.jpeg" sizes="24px" alt="" srcset="https://substackcdn.com/image/fetch/w_24,h_24,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc9ec27a7-607c-48aa-8aae-cc1e8c628e25_1024x1022.jpeg 24w, https://substackcdn.com/image/fetch/w_48,h_48,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc9ec27a7-607c-48aa-8aae-cc1e8c628e25_1024x1022.jpeg 48w, https://substackcdn.com/image/fetch/w_72,h_72,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc9ec27a7-607c-48aa-8aae-cc1e8c628e25_1024x1022.jpeg 72w" width="24" height="24" draggable="false"></picture></div></div></a><div class="pencraft pc-display-flex pc-flexDirection-column pc-gap-4 flexGrow-tjePuI pc-reset"><span class="pencraft pc-reset line-height-20-t4M0El font-text-qe4AeH size-15-Psle70 weight-regular-mUq6Gb reset-IxiVJZ"><span class="pencraft pc-display-inline-block pc-reset line-height-20-t4M0El font-text-qe4AeH size-15-Psle70 weight-medium-fw81nC reset-IxiVJZ"><a class="pencraft pc-reset decoration-hover-underline-ClDVRM reset-IxiVJZ" href="https://substack.com/@swollenjustice?utm_source=live-stream-chat" target="_blank">Swollen Justice</a></span></span><span class="pencraft pc-opacity-90 pc-reset line-height-20-t4M0El font-text-qe4AeH size-15-Psle70 weight-regular-mUq6Gb reset-IxiVJZ">Shits rough. Sorry I brought it up</span></div></div><div class="pencraft pc-display-flex pc-gap-12 pc-reset message-lU6Uj5"><a href="https://substack.com/@meredithmccown" target="_blank" utmsource="live-stream-chat" class="pencraft pc-display-contents pc-reset"><div class="pencraft pc-display-flex pc-width-24 pc-height-24 pc-justifyContent-center pc-alignItems-center pc-position-relative flexAuto-Bzdrdy pc-reset bg-secondary-UUD3_J animate-XFJxE4 outline-detail-vcQLyr pc-borderRadius-full overflow-hidden-WdpwT6 sizing-border-box-DggLA4 pressable-sm-YIJFKJ showFocus-sk_vEm container-TAtrWj interactive-UkK0V6" tabindex="0" style="--scale: 24px;"><div class="pencraft pc-display-flex pc-width-24 pc-height-24 pc-justifyContent-center pc-alignItems-center pc-position-relative flexAuto-Bzdrdy pc-reset bg-secondary-UUD3_J outline-detail-vcQLyr pc-borderRadius-full overflow-hidden-WdpwT6 sizing-border-box-DggLA4 container-TAtrWj" title="Meredith McCown (Merwhoo)" style="--scale: 24px;"><picture><source type="image/webp" srcset="https://substackcdn.com/image/fetch/w_24,h_24,c_fill,f_webp,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5b121331-6563-4ff3-b321-b339852f6c72_96x96.jpeg 24w, https://substackcdn.com/image/fetch/w_48,h_48,c_fill,f_webp,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5b121331-6563-4ff3-b321-b339852f6c72_96x96.jpeg 48w, https://substackcdn.com/image/fetch/w_72,h_72,c_fill,f_webp,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5b121331-6563-4ff3-b321-b339852f6c72_96x96.jpeg 72w" sizes="24px"><img class="img-OACg1c pencraft pc-reset" src="https://substackcdn.com/image/fetch/w_24,h_24,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5b121331-6563-4ff3-b321-b339852f6c72_96x96.jpeg" sizes="24px" alt="" srcset="https://substackcdn.com/image/fetch/w_24,h_24,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5b121331-6563-4ff3-b321-b339852f6c72_96x96.jpeg 24w, https://substackcdn.com/image/fetch/w_48,h_48,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5b121331-6563-4ff3-b321-b339852f6c72_96x96.jpeg 48w, https://substackcdn.com/image/fetch/w_72,h_72,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5b121331-6563-4ff3-b321-b339852f6c72_96x96.jpeg 72w" width="24" height="24" draggable="false"></picture></div></div></a><div class="pencraft pc-display-flex pc-flexDirection-column pc-gap-4 flexGrow-tjePuI pc-reset"><span class="pencraft pc-reset line-height-20-t4M0El font-text-qe4AeH size-15-Psle70 weight-regular-mUq6Gb reset-IxiVJZ"><span class="pencraft pc-display-inline-block pc-reset line-height-20-t4M0El font-text-qe4AeH size-15-Psle70 weight-medium-fw81nC reset-IxiVJZ"><a class="pencraft pc-reset decoration-hover-underline-ClDVRM reset-IxiVJZ" href="https://substack.com/@meredithmccown?utm_source=live-stream-chat" target="_blank">Meredith McCown (Merwhoo)</a></span></span><span class="pencraft pc-opacity-90 pc-reset line-height-20-t4M0El font-text-qe4AeH size-15-Psle70 weight-regular-mUq6Gb reset-IxiVJZ">That's awful/sad ...</span></div></div></div></div><div class="pencraft pc-display-contents pc-reset elevatedTheme-fBklGV"><div class="pencraft pc-display-flex pc-reset bg-primary-zk6FDl pc-borderRadius-full jumpButton-AIaH5l hidden-jcjp2w"><button type="button" class="pencraft pc-reset pencraft iconButton2-DvFP7w iconButtonBase-dJGHgN buttonBase-GK1x3M buttonNew-KfJF0Q size_md-gCDS3o priority_secondary-outline-MgyjoK rounded-SYxRdz" tabindex="0"><svg role="img" style="height: 20px; width: 20px;" width="20" height="20" viewBox="0 0 20 20" fill="var(--color-fg-primary)" stroke-width="1.8" stroke="none" xmlns="http://www.w3.org/2000/svg"><g><title></title><path d="M5.72845 8.252C5.25083 7.59067 5.72336 6.6665 6.53913 6.6665H13.461C14.2767 6.6665 14.7493 7.59067 14.2716 8.25199L10.8107 13.044C10.4116 13.5967 9.58852 13.5967 9.18936 13.044L5.72845 8.252Z" stroke="none"></path></g></svg></button></div></div><div class="pencraft pc-display-flex pc-padding-16 pc-reset border-top-detail-bzjFmN"><div class="pencraft pc-display-flex pc-minWidth-0 pc-position-relative flexGrow-tjePuI pc-reset"><input placeholder="Write message..." value="" class="input-y4v6N4 inputText-pV_yWb" maxlength="256"></div><button class="pencraft pc-reset pencraft iconButton2-DvFP7w iconButtonBase-dJGHgN buttonBase-GK1x3M buttonNew-KfJF0Q size_md-gCDS3o priority_quaternary-kpMibu" tabindex="0" type="button"><div class="pencraft pc-display-flex pc-position-relative pc-reset"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg></div></button><button class="pencraft pc-reset pencraft iconButton2-DvFP7w iconButtonBase-dJGHgN buttonBase-GK1x3M buttonNew-KfJF0Q size_md-gCDS3o priority_quaternary-kpMibu" tabindex="0" type="button" id="trigger5" aria-expanded="false" aria-haspopup="dialog" aria-controls="dialog6" aria-label="View share options"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" x2="12" y1="2" y2="15"></line></svg></button></div></div>
	
	function processMessage(ele){
		
		console.log(ele);
		
		let eventType = "";
		if (ele.className.includes("joinedText")){
			eventType = "joined";
		}
		
		var chatimg = "";
		try{
		   chatimg = ele.querySelector(".pc-borderRadius-full source")?.srcset.split(" ")[0].replace("w_24,h_24","w_144,h_144") || "";
		} catch(e){
		}
		
		var name="";
		try {
			name = escapeHtml(ele.querySelector("div > span a[href^='https://substack.com/@']")?.textContent.trim());
		} catch(e){
		}
		
		
		var msg="";
		try {
			if (eventType){
				msg = getAllContentNodes(ele);
			} else {
				msg = getAllContentNodes(ele.querySelector(".pencraft.pc-opacity-90"));
			}
		} catch(e){
		}
		
		
		
		
		var contentimg = "";
		
		
		if (!msg && !contentimg){return;}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = contentimg;
		data.textonly = settings.textonlymode || false;
		data.type = "substack";
		
		pushMessage(data);
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
				if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					document.querySelector('input[class^="input-"], textarea, input[type="text"]').focus();
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

	var lastURL =  "";
	var observer = null;
	
	
	function onElementInserted(target) {
		if (!target){return;}
		
		
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					console.log(mutation.addedNodes);
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							if (mutation.addedNodes[i].skip){continue;}
							mutation.addedNodes[i].skip = true;
							processMessage(mutation.addedNodes[i]);
						} catch(e){}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: false };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		
		observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");

	setInterval(function(){
		try {
		if (document.querySelector('h4')?.nextSibling.childNodes.length){
			if (!document.querySelector('h4').marked){
				document.querySelector('h4').marked=true;
				onElementInserted(document.querySelector('h4').nextSibling.childNodes[0]);
			}
		}} catch(e){}
	},2000);

})();