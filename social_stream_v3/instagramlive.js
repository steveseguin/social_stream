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

	function processMessage(ele){
		var content = ele.childNodes[0].childNodes[0];
		var chatname="";
		try {
			chatname = content.childNodes[0].childNodes[1].children[0].textContent;
			chatname = chatname.replace(/ .*/,'');
		} catch(e){
		}
		var chatmessage="";
		try{
			 if (textOnlyMode){
				chatmessage = content.childNodes[0].childNodes[1].children[1].innerText;
			 } else {
				chatmessage = content.childNodes[0].childNodes[1].children[1].innerHTML;
			 }
		} catch(e){
			return;}

		var chatimg="";
		try{
			chatimg = content.childNodes[0].childNodes[0].querySelectorAll("img")[0].src;
		} catch(e){
		}
	  

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";;
	  data.contentimg = "";
	  data.type = "instagram";
	  
		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			data.chatimg = "";
			pushMessage(data);
		}
	  
	}
	setTimeout(function(){ // clear existing messages; just too much for a stream.
	
		console.log("LOADED SocialStream EXTENSION");
		
		try {
			if (window.location.pathname.includes("/live/")){
				var main =  document.querySelectorAll("div>div>section>div");
				
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
						} 
					} catch(e){}
				}
			}
		} catch(e){  }
	
		var ttt = setInterval(function(){
			if (window.location.pathname.includes("/live/")){
				try {
					var main = document.querySelectorAll("div>div>section>div");
					for (var j =0;j<main.length;j++){
						try{
							if (!main[j].dataset.set123){
								main[j].dataset.set123 = "true";
								processMessage(main[j]);
							} 
						} catch(e){}
					}
				} catch(e){ }
			}
		},1000);
	},1500);

	var textOnlyMode = false;
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			if ("textonlymode" in response.settings){
				textOnlyMode = response.settings.textonlymode;
			}
		}
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					if (!document.querySelector("textarea[class]")){
						sendResponse(false);
						return;
					}
					document.querySelector("textarea[class]").focus();
					sendResponse(true);
					return;
				}
				if ("textOnlyMode" == request){
					textOnlyMode = true;
					sendResponse(true);
					return;
				} else if ("richTextMode" == request){
					textOnlyMode = false;
					sendResponse(true);
					return;
				}
			} catch(e){	}
			
			sendResponse(false);
		}
	);

	
})();