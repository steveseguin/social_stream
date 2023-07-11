
(function() {
		
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
	
	var isExtensionOn = false;
	
	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
		if ("isExtensionOn" in response){
			isExtensionOn = response.isExtensionOn;
			
			
			if (document.getElementById("startupbutton")){
				if (isExtensionOn){
					document.getElementById("startupbutton").style.display = "block";
				} else {
					document.getElementById("startupbutton").style.display = "none";
				}
			}
		}
	});
	
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try {
				// if ("focusChat" == request){ // if (prev.querySelector('[id^="message-username-"]')){ //slateTextArea-
					// document.querySelector('textarea.comment-sender_input').focus();
					// sendResponse(true);
					// return;
				// }
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						
					}
					if ("isExtensionOn" in request){
						isExtensionOn = request.isExtensionOn;
					}
					sendResponse(true);
					return;
				}
			} catch(e){}
			sendResponse(false);
		}
	);


	function prepMessage(e){
		
		var ele = e.target.targetEle;
		if (!ele){
			if (!e.target.parentNode.targetEle){
				return
			} else {
				ele = e.target.parentNode.targetEle;
			}
		}
		var chatmessage = "";
		var chatname =""
		var chatimg = ""
		
	  try{
		  chatname = ele.querySelector("div>span>a[role='link']").textContent;
		  chatimg = ele.querySelector("div>div>div>a[role='link']>div>img[src]").src;
		  chatmessage = ele.querySelector("div>div>div>div>p>span").parentNode.parentNode.textContent;
		  
	  } catch(e){}
	  
	  var chatdonation = false;
	  var chatmembership = false;
	  var chatsticker = false;
	  var contentimg = "";
	  try{
		contentimg = ele.querySelector("div>div[role='button']>img[alt][src]").src
	  } catch(e){}

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";
	  data.contentimg = contentimg;
	  data.type = "threads";
	  
	  
	  if (!contentimg && !chatmessage){return;}
	  e.preventDefault();
		e.stopPropagation();
	  
	  if (data.chatimg){
		  toDataURL(data.chatimg, function(base){
			  data.chatimg = base;
			  if (data.contentimg){
				  toDataURL(data.contentimg, function(base){
					  data.contentimg = base;
					  pushMessage(data);
				  });
			  } else {
					pushMessage(data);
			  }
		  });
	  } else {
			pushMessage(data);
	  }
	 
	  return false;
	};
	
	function checkButtons(){
		
		if (!isExtensionOn){return;}
		
		document.querySelectorAll('[data-pressable-container="true"]').forEach(ele=>{
			if (ele.skip){return;}
			ele.skip = true;
			var lastButton = ele.querySelectorAll("div>div>div>div>div>div[role='button']>svg");
			if (lastButton.length){
				lastButton = lastButton[lastButton.length - 1].parentNode.parentNode;
				var cloned = lastButton.cloneNode(true);
				cloned.onclick = prepMessage;
				cloned.querySelector("svg").innerHTML = '<title>Send to SocalStream</title><line fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2" x1="22" x2="9.218" y1="3" y2="10.083"></line><polygon fill="none" points="11.35,1.13 4.5,22.5 21.6,8.9 1.137,8.86 18.1,1.0" stroke="currentColor" stroke-linejoin="round" stroke-width="2"></polygon>';
				cloned.querySelector("svg").targetEle = ele;
				cloned.querySelector("svg").onclick = prepMessage;
				cloned.title = "Send Thread to Social Stream";
				cloned.targetEle = ele;
				lastButton.parentNode.appendChild(cloned);
				lastButton.title = "Send Thread to Social Stream";
				
				lastButton.parentNode.style['grid-template-columns'] = "36px 36px 36px 36px 36px";
			}
		});
		
	}
	
	setInterval(function(){
		checkButtons();
	}, 2000);
	
	setTimeout(function(){
		checkButtons();
	}, 500);
	
	setTimeout(function(){
		checkButtons();
	}, 100);
	
	setTimeout(function(){
		checkButtons();
	}, 1000);
	
})();
















