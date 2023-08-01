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

	function processMessagePosts(ele){ // not supported currently.  Instagram is just a bunch of reels at this point, so thats not chat
		if (ele == window){return;}
		
		
		var contentimg = "";

		var name = "";
		
		var msg="";
	
		var img = "";
		

		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = img;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = contentimg;
		data.type = "instagram";

		if (data.contentimg){
			toDataURL(contentimg, function(dataUrl) {
			  data.contentimg = dataUrl;
			  if (data.chatimg){
					toDataURL(data.chatimg, function(dataUrl) {
						data.chatimg = dataUrl;
						pushMessage(data);
					});
			  } else {
				   pushMessage(data);
			  }
			});
		} else if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
		   pushMessage(data);
		}
	}
	
	function processMessageComment(ele){
		if (ele == window){return;}

		var name = "";
		try {
			name = ele.querySelector("h3").innerText;
		} catch(e){
			name = "";
		}

		var msg="";
		try{
		  msg = ele.querySelector("h3").nextElementSibling.innerText;
		} catch(e){
		  //console.log(e);
		}

		var img = "";
		try {
		img = ele.querySelector("div > div > a > img[src]").src;
		} catch(e){}


		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = img;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "instagram";

		if (data.contentimg){
			toDataURL(contentimg, function(dataUrl) {
			  data.contentimg = dataUrl;
			  if (data.chatimg){
					toDataURL(data.chatimg, function(dataUrl) {
						data.chatimg = dataUrl;
						pushMessage(data);
					});
			  } else {
				   pushMessage(data);
			  }
			});
		} else if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
		   pushMessage(data);
		}
	}
	
	function processMessageIGLive(ele){
		var content = ele.childNodes[0].childNodes[0];
		var chatname="";
		try {
			chatname = content.childNodes[0].childNodes[1].children[0].textContent;
			chatname = chatname.replace(/ .*/,'');
		} catch(e){
		}
		var chatmessage="";
		var badges = [];
		try{
			 if (settings.textonlymode){
				chatmessage = content.childNodes[0].childNodes[2].children[1].innerText;
			 } else {
				chatmessage = content.childNodes[0].childNodes[2].children[1].innerHTML;
			 }
			 
			 if (content.childNodes[0].childNodes[1].querySelector("img")){
				var badge = content.childNodes[0].childNodes[1].querySelector("img");
				badge.src = badge.src+"";
				badges.push(badge.src);
			}
		} catch(e){
			chatmessage="";
			try{
				 if (settings.textonlymode){
					chatmessage = content.childNodes[0].childNodes[1].children[1].innerText;
				 } else {
					chatmessage = content.childNodes[0].childNodes[1].children[1].innerHTML;
				 }
			} catch(e){
				return;
			}
		}
		
		

		

		var chatimg="";
		try{
			chatimg = content.childNodes[0].childNodes[0].querySelectorAll("img")[0].src;
		} catch(e){
		}
		
		
	  

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = badges || "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";;
	  data.contentimg = "";
	  data.type = "instagramlive";
	  
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
	
		setInterval(function(){
			try {
				if (window.location.pathname.includes("/live/")){
					try {
						var main = document.querySelectorAll("div>div>section>div");
						for (var j =0;j<main.length;j++){
							try{
								if (!main[j].dataset.set123){
									main[j].dataset.set123 = "true";
									processMessageIGLive(main[j]);
								} 
							} catch(e){}
						}
					} catch(e){ }
				}
			} catch(e){}
			
			if (!window.location.pathname.includes("/live/")){ // not live video
				try {
					var main = document.querySelectorAll("article");
					if (main){
						for (var j =0;j<main.length;j++){
							try{
								if (!main[j].dataset.set){
									main[j].dataset.set = true;
									processMessagePosts(main[j]);
								}
							} catch(e){
								//console.error(e);
							}
						}
					}
				} catch(e){}
				try {
					document.querySelectorAll("article ul ul").forEach(main=>{
						if (main && main.childNodes){
							if (!main.dataset.set){
								main.dataset.set = true;	
								processMessageComment(main);
							}
						}
					});
				} catch(e){}
			}
			
		},500);
		
		
	},1500);

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
					if (!document.querySelector("textarea[class]")){
						sendResponse(false);
						return;
					}
					document.querySelector("textarea[class]").focus();
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

	
})();