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
		console.log(ele);
		var chatimg = "";
		var msg = "";
		var name = "";
		
		try{
		   var main = ele.querySelector("img");
		   chatimg = main.src;
		} catch(e){
			try{
			    main = ele.querySelector("svg");
			    if (!main){
					try {
						msg = ele.innerText;
						name = JSON.parse(document.getElementById("app-data").innerHTML).user.display_name;
						chatimg = JSON.parse(document.getElementById("app-data").innerHTML).user.avatar_url;
					} catch(e){
						console.error(e);
						return;
					}
				} else {
					console.log("SVG FOUND?");
				}
			} catch(e){}
		}
		
		try{
			if (!msg){
				msg = main.nextElementSibling.childNodes[1].innerText;
			}
			if (!name && !chatimg){
				name = [...main.nextElementSibling.childNodes[0].childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('');
			}
		} catch(e){
			console.error(e);
			if (!msg){return;}
		}
		
		if (name){
			name = name.trim();
		} 
		
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
		
		console.log(data);
		
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

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					document.querySelector('input').focus();
					sendResponse(true);
					return;
				}
			} catch(e){}
			sendResponse(false);
		}
	);

	function onElementInserted(target) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					console.log(mutation.addedNodes);
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
				onElementInserted(document.querySelector("#live-chat-app"));
			}
		}
	},1000);

})();