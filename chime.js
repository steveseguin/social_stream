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
  
  

  function processMessage(ele) {
    var chatimg = "";
    var chatname = "";
    var chatmessage = "";

    // Get the chat message
    try {
      chatmessage = ele.querySelector('[class="Linkify"]').innerText;
    } catch (e) {
      errorlog(e);
    }
    if (!chatmessage) {
      return;
    }

    // Get the sender  name
    try {
	  var chatele = ele.querySelector('[class="ChatMessage__sender"]') || ele.querySelector('[data-testid="chat-bubble-sender-name"]')
      chatname = chatele.innerText;
    } catch (e) {
      errorlog(e);
    }
    if (!chatname) {
      // Sender name not found? Try in previous siblings
      var prev = ele;
      var count = 0;
      while (chatname == "" && count < 20) {
        try {
          count++;
          prev = prev.previousElementSibling;
          var chatele = prev.querySelector('[class="ChatMessage__sender"]') || prev.querySelector('[data-testid="chat-bubble-sender-name"]')
		  chatname = chatele.innerText;
        } catch (e) {
          chatname = "";
        }
      }
    }
    chatname = chatname.match(/‹(.+)›/) ? chatname.match(/‹(.+)›/)[1] : chatname;

    var data = {};
    data.chatname = chatname;
    data.chatbadges = "";
    data.backgroundColor = "";
    data.textColor = "";
    data.chatmessage = chatmessage;
    data.chatimg = "";
    data.hasDonation = "";
    data.hasMembership = "";
    data.contentimg = "";
    data.type = "chime";

    pushMessage(data);
    return;
  }

  console.log("Social Stream injected");

  var oldRun = false;
  var delay = 3000;
  
  setInterval(function () {
		if (!oldRun){
			if (document.querySelectorAll('.ChatMessageList__messagesWrapper').length || document.querySelectorAll("div.chatBubbleContainer").length){
				
				oldRun = true;
				delay = 800;
				
				var xxx = document.querySelectorAll('[class="ChatMessageList__messageContainer"]');
				for (var j = 0; j < xxx.length; j++) {
				  xxx[j].marked = true;
				}
				
				var xxx = document.querySelectorAll("div.chatBubbleContainer");
				for (var j = 0; j < xxx.length; j++) {
				  xxx[j].marked = true;
				}
				
			}
		} else {
			var xxx = document.querySelectorAll('[class="ChatMessageList__messageContainer"]');
			for (var j = 0; j < xxx.length; j++) {
			  if (xxx[j].marked) {
				continue;
			  }
			  xxx[j].marked = true;
			  processMessage(xxx[j]);
			}
			
			var xxx = document.querySelectorAll('div.chatBubbleContainer');
			for (var j = 0; j < xxx.length; j++) {
			  if (xxx[j].marked) {
				continue;
			  }
			  xxx[j].marked = true;
			  processMessage(xxx[j]);
			}
		}
  }, delay);
  
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

  // Does not support sending messages in Chime
})();
