
function processMessage(ele = false){	// twitch
  var chatdonation = false;
  var chatsticker = false;
  
  if (!ele){
	  ele = this;
  } 
  
  var chatname = ele.querySelector(".chat-author__display-name").innerText;
  
  try {
	var BTT = ele.querySelectorAll('.bttv-tooltip');
	for (var i=0;i<BTT.length;i++){
		BTT[i].outerHTML = "";
	}
  } catch(e){}
  
  try {
	var chatmessage = ele.querySelector('*[data-test-selector="chat-line-message-body"').innerHTML;
  } catch(e){}
  
  if (!chatmessage){
	  try {
		chatmessage = ele.querySelector('span.message').innerHTML; // FFZ support
	  } catch(e){return;}
  }
  
  if (!chatmessage){
	  try {
		chatdonation = ele.querySelector('.chat-line__message--cheer-amount').innerHTML; // FFZ support
	  } catch(e){}
	  if (chatdonation){
		 chatmessage = "";
		 chatdonation = 0;
		 $(ele).find(".chat-line__message-container").find('span[data-test-selector="chat-message-separator"]').nextAll().each(function(index){
			if (this.querySelector('.chat-line__message--cheer-amount').innerHTML){
				chatdonation += parseInt(this.querySelector('.chat-line__message--cheer-amount').innerHTML);
			}
			chatmessage += $(this).html();
		});
		if (chatdonation==1){
			chatdonation += " bit";
		} else if (chatdonation>1){
			chatdonation += " bits";
		}
	  }
  }
  
  if (!chatmessage){
	   console.log($(ele));
	   console.log("No message found");
	   return;
  }
	
  var hasDonation = '';
  if(chatdonation) {
    hasDonation = chatdonation;
  }

  var data = {};
  data.chatname = chatname;
  data.chatbadges = "";
  data.chatmessage = chatmessage;
  data.chatimg = "";
  data.hasDonation = hasDonation;
  data.hasMembership = "";
  data.type = "twitch";
  
  try {
	chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){console.log(e);});
  } catch(e){
	  //
  }
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
		console.log(request);
		try{
			if ("focusChat" == request){
				document.querySelector('[data-a-target="chat-input"]').focus();
			}
		} catch(e){}
		sendResponse(document.querySelector('[data-a-target="chat-input"]').innerHTML);
	}
);


function onElementInsertedTwitch(containerSelector, className, callback) {
	var onMutationsObserved = function(mutations) {
		mutations.forEach(function(mutation) {
			if (mutation.addedNodes.length) {
				for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
					if(mutation.addedNodes[i].className == className) {
						callback(mutation.addedNodes[i]);
					}
				}
			}
		});
	};
	var target = document.querySelectorAll(containerSelector)[0];
	var config = { childList: true, subtree: true };
	var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
	var observer = new MutationObserver(onMutationsObserved);
	observer.observe(target, config);
	
}

onElementInsertedTwitch(".chat-scrollable-area__message-container", "chat-line__message", function(element){
  setTimeout(function(element){processMessage(element);},10, element);
});

