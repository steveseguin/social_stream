(function () {
	 
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


	var lastMessage = {};
	
	function processMessage(ele){
		var chatimg = "";
		var msg = "";
		var name = "";
		
		try{
		   var main = ele.querySelector("img");
		   chatimg = main.src;
		} catch(e){
			try{
				if (ele.childNodes[0].childNodes[0].childNodes[0].nodeName.toLowerCase() == "svg"){
					var main = ele.childNodes[0].childNodes[0].childNodes[0];
					if (main.nextElementSibling.childNodes.length>1){
						msg = main.nextElementSibling.childNodes[1].innerText;
					} 
					name = [...main.nextElementSibling.childNodes[0].childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('');
				} else{
					msg = ele.innerText;
					name = JSON.parse(document.getElementById("app-data").innerHTML).user.display_name;
					chatimg = JSON.parse(document.getElementById("app-data").innerHTML).user.avatar_url;
				} 
			} catch(e){
				try {
					if (ele.childNodes[1].childNodes[0].childNodes[0].nodeName.toLowerCase() == "svg"){
						var main = ele.childNodes[1].childNodes[0].childNodes[0];
						if (main.nextElementSibling.childNodes.length>1){
							msg = main.nextElementSibling.childNodes[1].innerText;
						} 
						name = [...main.nextElementSibling.childNodes[0].childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('');
					} else{
						msg = ele.childNodes[1].innerText;
						name = JSON.parse(document.getElementById("app-data").innerHTML).user.display_name;
						chatimg = JSON.parse(document.getElementById("app-data").innerHTML).user.avatar_url;
					} 
				} catch(e){
				}
			}
		}
		
		try{
			if (!msg){
				if (main.nextElementSibling.childNodes.length>1){
					msg = main.nextElementSibling.childNodes[1].innerText;
				} else {
					msg = main.nextElementSibling.childNodes[0].lastChild.innerText;
				}
			}
		
			if (!name){
				name = [...main.nextElementSibling.childNodes[0].childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('');
			}
		} catch(e){
			
		}
		
		if (name){
			name = name.trim();
		} 
		
		if (!msg){return;}
		
		var data = {};
		data.chatname = name;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.hasMembership = "";;
		data.contentimg = "";
		data.type = "vimeo";
		
		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				pushMessage(data);
			});
		} else {
			pushMessage(data);
		}
	}

	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
		} catch(e){}
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
					document.querySelector('input').focus();
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
						try{
							if (mutation.addedNodes[i].tagName == "LI"){
								processMessage(mutation.addedNodes[i]);
							}
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

	setInterval(function(){
		if (document.querySelector("#live-chat-app")){
			if (!document.querySelector("#live-chat-app").marked){
				document.querySelector("#live-chat-app").marked=true;
				var eles = document.querySelector("#live-chat-app").querySelectorAll("li");
				for (var i=0; i < eles.length; i++) {
					try{
						if (eles[i].tagName == "LI"){
							processMessage(eles[i]);
						}
					} catch(e){}
				}
				onElementInserted(document.querySelector("#live-chat-app"));
			}
		}
	},1000);

})();