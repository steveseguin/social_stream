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

function processMessage(ele = false, wss=true){

  if (!ele){
	  ele = this;
  } 

  if(ele.hasAttribute("is-deleted")) {
    console.log("Not showing deleted message");
    return;
  }

  var chatname = $(ele).find("#author-name").text();

  var chatmessage = $(ele).find("#message").html();
  var chatimg = $(ele).find("#img").attr('src');
  chatimg = chatimg.replace("32", "128");
  var chatdonation = $(ele).find("#purchase-amount").html();
  var chatmembership = $(ele).find(".yt-live-chat-membership-item-renderer #header-subtext").html();
  var chatsticker = $(ele).find(".yt-live-chat-paid-sticker-renderer #img").attr("src");

  if(chatsticker) {
    chatdonation = $(ele).find("#purchase-amount-chip").html();
  }

  var chatbadges = "";
  if($(ele).find("#chat-badges .yt-live-chat-author-badge-renderer img").length > 0) {
    chatbadges = $(ele).find("#chat-badges .yt-live-chat-author-badge-renderer img").parent().html();
  }

  var hasDonation = '';
  if(chatdonation) {
    hasDonation = chatdonation
  }

  var hasMembership = '';
  if(chatmembership) {
    hasMembership = '<div class="donation membership">NEW MEMBER!</div>';
    chatmessage = chatmembership;
  }

  if(chatsticker) {
    chatmessage = '<img src="'+chatsticker+'">';
  }

  var data = {};
  data.chatname = chatname;
  data.chatbadges = chatbadges;
  data.chatmessage = chatmessage;
  data.chatimg = chatimg;
  data.hasDonation = hasDonation;
  data.hasMembership = hasMembership;
  data.type = "youtube";
  
	if (data.chatimg){
		toDataURL(data.chatimg, function(dataUrl) {
			data.chatimg = dataUrl;
			try {
				chrome.runtime.sendMessage('oojehjgmkppocfckhpamkbieiaeehgkp', { "message": data }, function(){});
			} catch(e){}
		});
	} else {
		try {
			chrome.runtime.sendMessage('oojehjgmkppocfckhpamkbieiaeehgkp', { "message": data }, function(){});
		} catch(e){}
	}
}

function onElementInserted(containerSelector, tagName, callback) {
    var onMutationsObserved = function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
                    if(mutation.addedNodes[i].tagName == tagName.toUpperCase()) {
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

onElementInserted(".yt-live-chat-item-list-renderer#items", "yt-live-chat-text-message-renderer", function(element){
  processMessage(element, false);
});