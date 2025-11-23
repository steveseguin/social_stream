
(function() {
		
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
	
	var isExtensionOn = false;
	
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
		if ("state" in response){
			isExtensionOn = response.state;
			
			
			if (document.getElementById("startupbutton")){
				if (isExtensionOn){
					document.getElementById("startupbutton").style.display = "block";
				} else {
					document.getElementById("startupbutton").style.display = "none";
				}
			}
		}
	});
	
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try {
				if ("getSource" == request){sendResponse("threads");	return;	}
				//if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					// document.querySelector('textarea.comment-sender_input').focus();
					// sendResponse(true);
					// return;
				// }
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						
					}
					if ("state" in request){
						isExtensionOn = request.state;
					}
					sendResponse(true);
					return;
				}
			} catch(e){}
			sendResponse(false);
		}
	);
	
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


	function prepMessage(e){
		
		var ele = e.currentTarget.parentNode.parentNode.parentNode.parentNode.parentNode;
		console.log(ele);
		
		var chatmessage = "";
		var chatname =""
		var chatimg = ""
		
	  try{
		  chatname = escapeHtml(ele.querySelector("div>span a[role='link']").textContent);
		  try {
			chatimg = ele.childNodes[0].querySelector("div>div>div img[src]").src;
		  } catch(e){}
		  chatmessage = getAllContentNodes( e.currentTarget.parentNode.parentNode.parentNode.parentNode.querySelector("div>span[class]"));
		  
	  } catch(e){
		  console.log(e);
		  
	  }
	  
	  var chatdonation = false;
	  var chatmembership = false;
	  var chatsticker = false;
	  var contentimg = "";
	  try{
		contentimg = ele.querySelector("div>div[role='button']>img[alt][src]").src
	  } catch(e){}

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";
	  data.contentimg = contentimg;
	  data.textonly = settings.textonlymode || false;
	  data.type = "threads";
	  
	  
	  if (!contentimg && !chatmessage){return;}
	  e.preventDefault();
		e.stopPropagation();
	  
	  if (data.chatimg){
		  toDataURL(data.chatimg, function(base){
			  data.chatimg = base;
			  if (data.contentimg){
				  toDataURL(data.contentimg, function(base){
					  data.contentimg = base;
					  pushMessage(data);
				  });
			  } else {
					pushMessage(data);
			  }
		  });
	  } else {
			pushMessage(data);
	  }
	 
	  return false;
	};
	
	function checkButtons(){
		
		if (!isExtensionOn){return;}
		
		document.querySelectorAll('a:not([data-fixed="true"])[href^="https://"]').forEach(link => { // For all the Canadians
			let newLink = link.cloneNode(true);
			link.parentNode.replaceChild(newLink, link);
			if (newLink.href.startsWith("https://l.threads.net/?u=")){
				newLink.dataset.fixed = true;
				newLink.href = decodeURIComponent(newLink.href.split("?u=")[1].split("&")[0]);
			}
		});
		
		
		document.querySelectorAll('[data-pressable-container="true"]').forEach(ele=>{
			if (ele.skip){return;}
			ele.skip = true;
			try {
				var lastButton = ele.querySelector("[points='11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334']").parentNode.parentNode.parentNode.parentNode;
			} catch(e){
				return;
			}
			if (lastButton){
				lastButton.parentNode.style['grid-template-columns'] = "36px 36px 36px 36px 36px 36px";
				
				
				var cloned = lastButton.cloneNode(true);
				cloned.onmouseover = function(){
					this.style.backgroundColor = "#FFF1";
					this.style.borderRadius = "100%";
				};
				cloned.onmouseout = function(){
					this.style.backgroundColor = "#FFF0";
				};
				
				cloned.onclick = prepMessage;
				cloned.querySelector("svg").innerHTML = '<title>Send to SocalStream</title><polygon fill="currentColor" points="12 0.5, 14.8 8.6, 22 9.3, 16 14.2, 18 21.5, 12 17, 6 21.5, 8 14.2, 2 9.3, 9.2 8.6" />';
				cloned.title = "Send Thread to Social Stream";
				lastButton.parentNode.appendChild(cloned);
				
				var cloned = lastButton.cloneNode(true);
				cloned.onmouseover = function(){
					this.style.backgroundColor = "#FFF1";
					this.style.color = "red";
					this.style.borderRadius = "100%";
				};
				cloned.onmouseout = function(){
					this.style.backgroundColor = "#FFF0";
					this.style.color = "white";
				};
				
				cloned.onclick = function(e){
					var ele = e.currentTarget.parentNode.parentNode.parentNode.parentNode.parentNode;
					ele.querySelectorAll("svg circle[cx='12']")[0].parentNode.parentNode.click();
					var opacity = 1; // Initial opacity
					var interval = 10; // Interval in milliseconds to decrease opacity
					var step = interval / 500; // Amount to decrease opacity at each step

					var fading = setInterval(function(ele) {
						opacity -= step;
						ele.style.opacity = opacity;

						if (opacity <= 0) {
							clearInterval(fading);
							ele.style.display = 'none'; // Optional: hides the element completely after fade-out
						}
					}, interval,ele);
					setTimeout(function(){
						var buttons = Array.from(document.querySelectorAll('div[role="button"]>div>span'));
						
						for (var i=0;i<buttons.length;i++){
							var style = getComputedStyle(buttons[i]);
							console.log(style.color);
							if (buttons[i].textContent.length && style.color ==  'rgb(255, 48, 64)') {
								buttons[i].click();
								setTimeout(function(){
									var buttons = Array.from(document.querySelectorAll('div[role="button"]>div>span'));

									for (var i=0;i<buttons.length;i++){
										var style = getComputedStyle(buttons[i]);
										if (buttons[i].textContent.length && style.color ==  'rgb(255, 48, 64)') {
											buttons[i].click();
											ele.remove();
											break;
										}
									};
								},250);
								break;
							}
						};
						
					},250);
				};
				cloned.querySelector("svg").outerHTML = '<svg aria-label="Block this user" class="x1lliihq x1n2onr6 x1yxark7" fill="none" stroke="currentColor" height="20" role="img" viewBox="0 0 24 24" width="20"> <title>Block this user</title><circle cx="12" cy="5" r="4" stroke="currentColor" stroke-width="2.5"></circle><path d="M6.26678 23.75H19.744C21.603 23.75 22.5 23.2186 22.5 22.0673C22.5 19.3712 18.8038 15.75 13 15.75C7.19625 15.75 3.5 19.3712 3.5 22.0673C3.5 23.2186 4.39704 23.75 6.26678 23.75Z" stroke="currentColor" stroke-width="2.5"></path><line x1="0" y1="24" x2="24" y2="0" stroke-width="4" stroke="red"></line></svg>';
				cloned.title = "Block this user";
				lastButton.parentNode.appendChild(cloned);
				
			}
		});
		
	}
	
	setInterval(function(){
		checkButtons();
	}, 2000);
	
	setTimeout(function(){
		checkButtons();
	}, 500);
	
	setTimeout(function(){
		checkButtons();
	}, 100);
	
	setTimeout(function(){
		checkButtons();
	}, 1000);
	
})();
















