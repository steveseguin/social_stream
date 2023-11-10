
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
				// if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
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
						
						if (document.getElementById("startupbutton")){
							if (isExtensionOn){
								document.getElementById("startupbutton").style.display = "block";
							} else {
								document.getElementById("startupbutton").style.display = "none";
							}
						}
					}
					sendResponse(true);
					return;
				}
			} catch(e){}
			sendResponse(false);
		}
	);
	
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

	function getAllContentNodes(element) {
		var resp = "";
		
		if (!element.childNodes.length || !element.childNodes){
			return element.textContent || "";
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				resp += node.outerHTML;
			}
		});
		return resp;
	}
	
	function prepMessage(){
		
	  var ele = this.targetEle;
	  
	  var chatname = "";
	  try{
			  chatname = ele.querySelector("#ytd-channel-name #text").innerText.trim();
			  chatname = escapeHtml(chatname);
	  } catch(e){
			chatname = ele.querySelector("#header #author-text").innerText.trim();
			chatname = chatname.replace("@", "");
			chatname = escapeHtml(chatname);
	  }
	  
	  
	  var chatimg="";
	  try{
		 chatimg = ele.querySelector("#author-thumbnail #img[src]").src;
	  } catch(e){
	  }
	  
	  var chatmessage = "";
	  try { 
		  chatmessage = getAllContentNodes(ele.querySelector("#content #content-text"));
	  } catch(e){
		  return;
	  }
	  
	  var chatdonation = false;
	  var chatmembership = false;
	  var chatsticker = false;
	  
	  this.style.backgroundColor = "#CCC";

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";
	  data.contentimg = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "youtube";
	  
	  if (chatimg){
		  toDataURL(data.chatimg, function(base64Image){ // we upscale
				data.chatimg = data.chatimg.replace("=s32-", "=s256-");  // Increases the resolution of the image
				data.chatimg = data.chatimg.replace("=s64-", "=s256-");
				
				if (base64Image){
					data.backupChatimg = base64Image; // there's code in the index page to fallback if the larger image doens't exist
				}
				pushMessage(data);
			});
	  } else {
		pushMessage(data);
	  }
	};
	
	function checkButtons(){
		
		if (!isExtensionOn){return;}
		
		var bases = document.querySelectorAll('#contents ytd-comment-thread-renderer');
		for (var i=0;i<bases.length;i++) {
			try {
				if (!bases[i].dataset.set){
					bases[i].dataset.set=true;
					var button  = document.createElement("button");
					button.onclick = prepMessage;
					button.innerHTML = "Send to SocialStream";
					button.style = "cursor:pointer;border: 0px; transition: all 0.2s linear 0s; border-radius: 100px; padding: 5px 10px; cursor: pointer; display: inline-block; border: 1.5px black solid; background-color: white;";
					button.targetEle = bases[i]
					//bases[i].appendChild(button);
					try{
						bases[i].querySelector('#toolbar').appendChild(button);
					} catch(e){
						
					}
				}
			} catch(e){}
		}
	}
	function startup() {
		checkButtons();
		setInterval(function(){
			checkButtons();
		}, 2000);
	}

	function preStartup(){
		if (!document.getElementById("startupbutton")){
			var button  = document.createElement("button");
			button.onclick = function(){
				document.getElementById("startupbutton").remove();
				clearTimeout(preStartupInteval);
				startup();
			};
			button.id = "startupbutton";
			button.innerHTML = "SS";
			button.title = "Enable Social Stream static comment capture support. Turn off the Social stream extension to hide this button";
	
			button.style = "margin-right: 10px; transition: all 0.2s linear 0s; border-radius: 100px; cursor: pointer; display: inline-block; background-color: white;";
			
			if (!isExtensionOn){
				button.style.display = "none";
			} else {
				button.style.display = "inline-block";
			}
			
			try{
				document.querySelector('#container #buttons').prepend(button);
			} catch (e){
				
			}
		}
	}

	console.log("SOCIAL STREAM STATIC INJECTED");

	setTimeout(function(){preStartup();},1000);

	var preStartupInteval = setInterval(function(){preStartup();},5000);

})();
















