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

	chatname = escapeHtml(ele.childNodes[0].childNodes[0].textContent);
    // Get the chat message
    try {
	  var ele = ele.lastChild.lastChild;
	  if (ele.skip){
		  return;
	  }
	  ele.skip = true;
      chatmessage = getAllContentNodes(ele);
    } catch (e) {
      errorlog(e);
    }
    if (!chatmessage) {
      return;
    }

	try {
		if (chatname === "You"){
			if (settings && settings.myname && settings.myname.textparam1){
				chatname = settings.myname.textparam1.split(",")[0];
			}
		}
	} catch(e){}

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
	data.type = "meet";


    pushMessage(data);
    return;
  }


  function getParticipantImage(name) {
     if (name === 'You') {
      var owner = document.querySelector('[data-layout=no-crop]');
      if (owner) {
        var img = owner.querySelector('img');
        return (img && img.src) || '';
      }
    }
    var allSenders = document.querySelectorAll('[data-participant-id]');
    for(var i=0; i<allSenders.length; i++) {
      var nameEl = allSenders[i].querySelector('[data-self-name]');
      if (nameEl && nameEl.querySelector('[jsslot]') && nameEl.querySelector('[jsslot]').firstChild.innerText === name) {
        var img = allSenders[i].querySelector('img');
        return (img && img.src) || '';
      }
    }
    return '';
  }

  function processSender(sender) {
    var chatname = sender.dataset.senderName;
	if (chatname == "You"){
	  try {
        chatname = document.querySelector('[data-self-name="You"] [role="tooltip"]').textContent;
      } catch(e){}
	}
    var messages = Array.prototype.slice.call(sender.querySelectorAll('[data-is-tv]'));
    messages.forEach(function(message) {
      if(message.marked) return;
      message.marked = true;
      var data = {};
      var chatmessage = escapeHtml(message.innerText);
      var chatimg = getParticipantImage(chatname);
      data.chatname = escapeHtml(chatname);
      data.chatbadges = "";
      data.backgroundColor = "";
      data.textColor = "";
      data.chatmessage = chatmessage;
      data.chatimg = chatimg;
      data.hasDonation = "";
      data.membership = "";
      data.contentimg = "";
      data.textonly = settings.textonlymode || false;
      data.type = "meet";
      pushMessage(data);
    });
  }

  console.log("Social Stream injected");

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
							if (mutation.addedNodes[i].ignore){continue;}
							mutation.addedNodes[i].ignore=true;
							let ele = mutation.addedNodes[i];
							for (var j = 0;j<6;j++){
								if (ele.parentNode == document.querySelector("[data-panel-container-id='sidePanel2subPanel0'] [aria-live]")){
									processMessage(ele);
									break;
								} else if (ele.parentNode){
									ele = ele.parentNode;
								} else {
									break;
								}
							}
								
						} catch(e){}
					}
				}
			});
		};
		
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	setInterval(function(){
		var ready = document.querySelector("[data-panel-container-id='sidePanel2subPanel0'] [aria-live]");
		if (ready && !ready.ready){
			console.log("Social Stream ready to go");
			ready.ready = true;
			onElementInserted( document.querySelector("[data-panel-container-id='sidePanel2subPanel0'] [aria-live]"));
		}
	},1000);

  // Does not support sending messages in Chime
})();
