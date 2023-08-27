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

  function processMessage(ele) {
    var chatimg = "";
    var chatname = "";
    var chatmessage = "";

    // Get the chat message
    try {
      chatmessage = escapeHtml(ele.innerText);
    } catch (e) {
      errorlog(e);
    }
    if (!chatmessage) {
      return;
    }

	chatname = ele.parentNode.parentNode.dataset.senderName;
	
	if (chatname === "You"){
		chatname = Hostname;
		chatimg = Hostimg;
	}

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
	data.type = "meet";


	console.log(data);
	
    pushMessage(data);
    return;
  }

  console.log("Social Stream injected");


  var Hostname = false;
  var Hostimg = false;
  
  if (document.querySelectorAll("div[title]").length){
		Hostname = document.querySelectorAll("div[title]")[0].title;
		if (document.querySelectorAll("div[title]")[0].parentNode.previousSibling){
			Hostimg = document.querySelectorAll("div[title]")[0].parentNode.previousSibling.src || false;
			toDataURL(Hostimg, function(dataUrl) {
				Hostimg = dataUrl;
			});
		}
  }
  
  
  var settings = {};
  
  chrome.runtime.onMessage.addListener(
	function (request, sender, sendResponse) {
		try{
			if ("focusChat" == request){
				document.querySelector('.DraftEditor-editorContainer .public-DraftStyleDefault-block[data-offset-key]').click();
				document.querySelector('.DraftEditor-editorContainer .public-DraftStyleDefault-block[data-offset-key]').focus();
				
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
			// twitch doesn't capture avatars already.
		} catch(e){}
		sendResponse(false);
	}
  );
  
  setInterval(function () {
	  
	if (!Hostname && document.querySelectorAll("div[title]").length){
		Hostname = document.querySelectorAll("div[title]")[0].title;
		if (document.querySelectorAll("div[title]")[0].parentNode.previousSibling){
			Hostimg = document.querySelectorAll("div[title]")[0].parentNode.previousSibling.src || false;
			toDataURL(Hostimg, function(dataUrl) {
				Hostimg = dataUrl;
			});
		}
	}
	  
	var xxx = document.querySelectorAll('[data-message-text]');
	for (var j = 0; j < xxx.length; j++) {
	  if (xxx[j].marked) {
		continue;
	  }
	  xxx[j].marked = true;
	  processMessage(xxx[j]);
	}
  }, 1000);

  // Does not support sending messages in Chime
})();
