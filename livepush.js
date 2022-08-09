(function () {
	function pushMessage(data){	  
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){}
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
	
	function sleep(ms = 0) {
		return new Promise(r => setTimeout(r, ms)); // LOLz!
	}

	async function processMessage(ele){
		try {
		  var chatdonation = false;
		  var chatmembership = false;
		  var chatsticker = false;
		  try {
		     var chatname = ele.querySelector(".author-name").innerText;
		  } catch(e){
			  return;
		  }
		  var chatmessage = ele.querySelector(".message").innerText;
		  
		  if (!chatmessage){
			   return;
		  }
		  var chatimg = "";
		  var chatbadges = "";
		  var hasDonation = '';
		  var hasMembership = '';
		  var backgroundColor = "";
		  var textColor = "";
		  var source = "";
		  
		  source = ele.querySelector(".chat-client>img");
		  if(source && source.src){
			  if (source.src.includes("twitch.png")){
				  source = "twitch";
			  } else if (source.src.includes("youtube.png")){
				  source = "youtube";
			  }  else if (source.src.includes("facebook.png")){
				  source = "facebook";
			  } else {
				  source = "livepush";
			  }
		  } else {
			source = "livepush";
		  }

		  var data = {};
		  data.chatname = chatname;
		  data.chatbadges = chatbadges;
		  data.backgroundColor = backgroundColor;
		  data.textColor = textColor;
		  data.chatmessage = chatmessage;
		  data.chatimg = chatimg;
		  data.hasDonation = hasDonation;
		  data.hasMembership = hasMembership;
		  data.type = source;
		  
		  pushMessage(data);
		} catch(e){
			//console.error(e);
		}
	}
	
	
	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						if (!mutation.addedNodes[i].children || !mutation.addedNodes[i].children.length){continue;}
						
						if (!mutation.addedNodes[i].classList.contains("chat-item")){
							continue;
						}
						try {
						
							if (mutation.addedNodes[i].dataset.set123){continue;}
							mutation.addedNodes[i].dataset.set123 = "true";
							callback(mutation.addedNodes[i]);
							
						} catch(e){}
					}
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}
	
	console.log("social stream injected");
	
	try {
		onElementInserted(document.getElementById("chatlist"), function(element){
			processMessage(element);
		});
	} catch(e){}
	

	
})();