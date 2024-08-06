(function () {
  function pushMessage(data) {
    try {
      chrome.runtime.sendMessage(
        chrome.runtime.id,
        { message: data },
        function (e) {}
      );
    } catch (e) {}
  }

  function errorlog(e) {
    //console.error(e);
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
	
	
  var messageHistory = [];
  var lastMessageID = 0;
  var lastMessage = "";
  var lastChatName = "";
  
  function processMessage(ele) {
	 
    var chatimg = "";
    var chatname = "";
    var chatmessage = "";

	if (!settings.textonlymode){
		  try {
			chatmessage = getAllContentNodes(ele.querySelector('[data-qa="message-text"]'));
		  } catch(e){}
		  
	} else {
		  try{
			//var childrens = ele.querySelector('[data-qa="message-text"]').querySelectorAll("[alt]");
			//for (var i =0;i<childrens.length;i++){
			//	childrens[i].outerHTML = childrens[i].alt;
			//}
			chatmessage = escapeHtml(ele.querySelector('[data-qa="message-text"]').innerText);
		  } catch(e){}
	}
	  
      // chatmessage = getAllContentNodes(ele.querySelector('[data-qa="message-text"]'));
	  
    if (!chatmessage) {
      return;
    }

    // Get the sender  name
    try {
      chatname = escapeHtml(ele.querySelector('[data-qa="message_sender"]').innerText.split("\n")[0]);
    } catch (e) {
	  chatname = "";
      errorlog(e);
    }
	var prev = false;
    if (!chatname) {
      // Sender name not found? Try in previous siblings
      prev = ele;
      var count = 0;
      while (chatname == "" && count < 500) {
        try {
          count++;
          prev = prev.previousElementSibling;
          chatname = escapeHtml(prev.querySelector('[data-qa="message_sender"]').innerText);
        } catch (e) {
          chatname = "";
        }
      }
	  if (!prev){
		  return;
	  }
    }
	
	if (!chatname){
		return;
	}
	
	if (ele.id){
		if (messageHistory.includes(ele.id)){
			return;
		} else if (isNaN(parseFloat(ele.id))){
			return;
		} else if (lastMessageID && (lastMessageID>parseFloat(ele.id))){
			return;
		} else if (lastMessageID && (parseFloat(ele.id) - lastMessageID<3)){
			if ((lastMessage == chatmessage) && (lastChatName == chatname)){
				return
			}
		}
		lastMessage = chatmessage;
		lastChatName = chatname;
		lastMessageID = parseFloat(ele.id);
		messageHistory.push(ele.id);
	} else {
		return;
	}
	
	messageHistory = messageHistory.slice(-500);
	
    // Get the sender avatar
    try {
      chatimg = ele.querySelector(".c-avatar").querySelector("img").src;
    } catch (e) {
      errorlog(e);
    }
    if (!chatimg && prev) {
      // Sender avatar not found? Try in previous siblings
		 try {
          chatimg = prev.querySelector(".c-avatar").querySelector("img").src;
        } catch (e) {
          chatimg = "";
        }
    }

    if (chatimg) {
      // Use higher resolution image by replacing last digits with 128
      chatimg = chatimg.replace(/-\d+$/g, "-128");
    }
    var data = {};
    data.chatname = chatname;
    data.chatbadges = "";
    data.backgroundColor = "";
    data.textColor = "";
    data.chatmessage = chatmessage;
    data.chatimg = chatimg;
    data.hasDonation = "";
    data.membership = "";
    data.contentimg = "";
    data.textonly = settings.textonlymode || false;
	data.type = "slack";

    pushMessage(data);
    return;
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
				if ("focusChat" == request){
					if (!document.querySelector('[contenteditable][role="textbox"]>p')){
						sendResponse(false);
						return;
					}
					document.querySelector('[contenteditable][role="textbox"]>p').focus();
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
			} catch(e){	}
			
			sendResponse(false);
		}
	);
  
	var giveItAtry = setInterval(function(){ // allow pre load
	  if (document.querySelector('[data-qa="slack_kit_list"]')){
			clearTimeout(giveItAtry);
      } else {
			return;
		} 
		setTimeout(function(){
			var xxx = document.querySelectorAll('[data-qa="virtual-list-item"]');
			for (var j = 0; j < xxx.length; j++) {
			  if (xxx[j].marked) {
				continue;
			  }
			  xxx[j].marked = true;
			}
		  setInterval(function () {
			var xxx = document.querySelectorAll('[data-qa="virtual-list-item"]');
			for (var j = 0; j < xxx.length; j++) {
			  if (xxx[j].marked) {
				continue;
			  }
			  xxx[j].marked = true;
			  processMessage(xxx[j]);
			}
		  }, 500);
	},3000);
  },1000);

  // Does not support sending messages in Slack
})();
