
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
						
						if (document.getElementById("startupbutton")){
							if (isExtensionOn){
								document.getElementById("startupbutton").style.display = "block";
							} else {
								document.getElementById("startupbutton").style.display = "none";
							}
						}
					}
					sendResponse(true);
					return;
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
		
		if (!isExtensionOn){return;}
		
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
			
			if (!isExtensionOn){
				button.style.display = "none";
			}
			
			try{
				document.querySelector('header[role="banner"]').querySelectorAll('a[aria-label="Tweet"]')[0].parentNode.appendChild(button);
			} catch (e){
				try{
					var eles = document.querySelector('header[role="banner"]').querySelectorAll('a[aria-label][role="link"]');
					var ele = eles[eles.length - 1].parentNode.parentNode.appendChild(button);
				} catch (e){
					
				}
			}
			
			
			var button2  = document.createElement("button");
			button2.onclick = function(){
				document.getElementById("adbutton").remove();
				
				const styleEl = document.createElement("style");
				document.head.appendChild(styleEl);
				styleEl.sheet.insertRule("div[data-testid='Dropdown']{ height:0; opacity:0; }", 0);
				styleEl.sheet.insertRule("article div[data-testid='caret'] svg{ height:0; opacity:0; }", 0);
				styleEl.sheet.insertRule("[data-testid='confirmationSheetConfirm'] div{ height:0; opacity:0; }", 0);
				styleEl.sheet.insertRule("#layers [role='alert'], #layers [role='alertdialog']{ height:0; opacity:0; z-Index:0;}", 0);

				setInterval(function(){
					try {
						document.querySelector("[data-testid='confirmationSheetConfirm'] div").click();
						console.log("Blocked an ad");
					} catch(e){
						try {
							document.querySelector("[data-testid='block'] div span").click();
						} catch(e){
							try {
								document.querySelectorAll("[data-testid='placementTracking'] article div[data-testid='caret'] svg")[0].parentNode.click();
								setTimeout(function(){
									try {
										document.querySelector("[data-testid='block'] div span").click();
									} catch(e){}
								},250);
							} catch(e){}
						}
					}
				},500);
			};
			button2.id = "adbutton";
			button2.innerHTML = "Block Promoted Tweets";
			button2.style = "border: 0; width:100%; transition: all 0.2s linear; height: 51px; border-radius: 100px; padding: 4px; background-color: #dfdfdf; cursor:pointer;";
			
			if (!isExtensionOn){
				button2.style.display = "none";
			}
			
			try{
				document.querySelector('header[role="banner"]').querySelectorAll('a[aria-label="Tweet"]')[0].parentNode.appendChild(button2);
			} catch (e){
				try{
					var eles = document.querySelector('header[role="banner"]').querySelectorAll('a[aria-label][role="link"]');
					var ele = eles[eles.length - 1].parentNode.parentNode.appendChild(button2);
				} catch (e){
					
				}
			}

		}
	}

	setTimeout(function(){preStartup();},1000);

	var preStartupInteval = setInterval(function(){preStartup();},5000);

})();
















