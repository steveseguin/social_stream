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
      chatmessage = ele.innerText;
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
