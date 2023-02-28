
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
	
	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.streamevents
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
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
						sendResponse(true);
						return;
					}
				}
			} catch(e){}
			sendResponse(false);
		}
	);


	function prepMessage(ele){
	  if (ele == window){return;}
	  
	  if (this.targetEle){
		  ele = this.targetEle.parentNode;;
		  console.log(ele);
	  } else if (this){
		  ele = this.parentNode;
	  }
	  
	  var base = ele.querySelector("[data-testid='tweet']");
	  
	  if (!base){
		  console.log("NO BASE");
		  return;
	  }
	  
	  try{
		  var chatname = base.querySelectorAll("a[role='link']")[1].childNodes[0].childNodes[0].innerText.trim();
		  console.log(base.querySelectorAll("a")[1]);
		  console.log(chatname);
		  if (!chatname.length){
			  chatname = base.querySelectorAll("a[role='link']")[1].querySelector("[id]").childNodes[0].innerText.trim();
		  }
	  } catch(e){
		 var chatname="";
	  }
	  
	  var chatimg=false;
	  var contentimg=false;
	  try{
		 chatimg = base.childNodes[0].querySelector("img").src
	  } catch(e){}
	  
	  var chatmessage = "";
	  try { 
	  
		  chatmessage = base.parentNode.childNodes[1].childNodes[1].querySelector("[lang]");
		  if (chatmessage){
			  var links = chatmessage.querySelectorAll("a");
			  for (var i =0;i<links.length;i++){
				  if (links[i].innerText.length>15){
					links[i].innerText = links[i].innerText.substring(0, 15) + "...";
				  }
			  }
			  chatmessage = chatmessage.innerText;
		  }
		  
		  if (!chatmessage.length){
			  chatmessage =  base.parentNode.childNodes[1].childNodes[1].childNodes[1].innerText;
		  }
		  try{
			contentimg = base.parentNode.querySelector("video").getAttribute("poster");
		  } catch(e){
			  try{
				contentimg = base.parentNode.childNodes[1].childNodes[1].querySelector("[lang]").parentNode.nextElementSibling.querySelector("img").src;
			  } catch(e){
					contentimg = base.parentNode.childNodes[1].childNodes[1].querySelector("[lang]").parentNode.nextElementSibling.querySelector("img").src;
			  }
		  }
		  
	  } catch(e){
		   
		  if (!chatmessage){
			  try{
				  if (ele.parentNode.querySelectorAll("[lang]").length){
					chatmessage =  ele.parentNode.querySelector("[lang]").innerText;
				  }
			  }catch(e){}
		  } else {
		  }
			  
		   try{
			contentimg = ele.parentNode.querySelector("video").getAttribute("poster"); //tweetPhoto
		  }catch(e){
			  try{
				contentimg = ele.parentNode.querySelector("[data-testid='tweetPhoto']").querySelector("img").src;
			  } catch(e){
				  try{
					contentimg = base.parentNode.childNodes[1].childNodes[1].childNodes[1].parentNode.nextElementSibling.querySelector("img").src;
				  } catch(e){}
			}
		  }
	  }
	  
	  if (!contentimg){
		   try{
			contentimg = base.querySelector("[data-testid='card.wrapper'] img[src], [data-testid='tweetPhoto'] img[src]").src;
		} catch(e){}
	  }
	  
	  
	  if (!chatmessage ){chatmessage="";}

	  
	  var chatdonation = false;
	  var chatmembership = false;
	  var chatsticker = false;
	  
	  
	  base.style.backgroundColor = "#CCC!important";

	  ele.classList.add("shown-comment");

	  var hasDonation = '';
	 
	  var hasMembership = '';
	 
	  var backgroundColor = "";
	  var textColor = "";
	 

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = backgroundColor;
	  data.textColor = textColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  data.hasMembership = hasMembership;
	  data.contentimg = contentimg;
	  data.type = "twitter";
	  
	  pushMessage(data);
	};
	
	function checkButtons(){
		var bases = document.querySelector('main[role="main"]').querySelectorAll('article[role="article"]');
		for (var i=0;i<bases.length;i++) {
			try {
				if (!bases[i].dataset.set){
					bases[i].dataset.set=true;
					var button  = document.createElement("button");
					button.onclick = prepMessage;
					button.innerHTML = "Grab Tweet";
					button.style = " transition: all 0.2s linear; border:1px solid #0007; width: 56px; height: 56px; border-radius: 50px; padding: 4px; margin: 10px; background-color: #c7f6c7; cursor:pointer;"
					button.className = "btn-push-twitter";
					button.targetEle = bases[i]
					//bases[i].appendChild(button);
					
					try{
						bases[i].querySelector('[data-testid="Tweet-User-Avatar"]').parentNode.appendChild(button);
					} catch(e){
						try{
							bases[i].querySelector('[data-testid="tweet"]').childNodes[0].appendChild(button);
						}catch(e){
							bases[i].appendChild(button);
						}
					}
				}
			} catch(e){}
		}
	}
	function startup() {
		checkButtons();
		setInterval(function(){
			checkButtons();
		}, 2000);
	}

	function preStartup(){
		if (!document.getElementById("startupbutton")){
			var button  = document.createElement("button");
			button.onclick = function(){
				document.getElementById("startupbutton").remove();
				clearTimeout(preStartupInteval);
				startup();
			};
			button.id = "startupbutton";
			button.innerHTML = "Enable Overlay Service";
			button.style = "border: 0; width:100%; transition: all 0.2s linear; height: 51px; border-radius: 100px; padding: 4px; margin: 10px 0; background-color: lightgreen; cursor:pointer;";
			try{
				document.querySelector('header[role="banner"]').querySelectorAll('a[aria-label="Tweet"]')[0].parentNode.appendChild(button);
			} catch (e){
				var eles = document.querySelector('header[role="banner"]').querySelectorAll('a[aria-label][role="link"]');
				var ele = eles[eles.length - 1].parentNode.parentNode.appendChild(button);
			}
		}
	}

	setTimeout(function(){preStartup();},1000);

	var preStartupInteval = setInterval(function(){preStartup();},5000);

})();
















