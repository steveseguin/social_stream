
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
			deTweet();
		}
		if ("state" in response){
			isExtensionOn = response.state;
			if (document.getElementById("startupbutton")){
				if (isExtensionOn){
					document.getElementById("startupbutton").style.display = "block";
				} else {
					document.getElementById("startupbutton").style.display = "none";
				}
			}
		}
	});
	
	var grabbedTweets = localStorage.getItem('grabbedTweets') || false;
	if (grabbedTweets){
		try{
			grabbedTweets = JSON.parse(grabbedTweets);
		} catch(e){
			grabbedTweets = [];
		}
	} else {
		grabbedTweets = [];
	}
	
	var enabledSSN = localStorage.getItem('enabledSSN') === 'true';
	console.log("enabledSSN :"+enabledSSN);
	
	if (enabledSSN){
		var autoGrabTweets = localStorage.getItem('autoGrabTweets') === 'true';
		console.log("autoGrabTweets :"+autoGrabTweets);
	} else {
		var autoGrabTweets = false;
		localStorage.setItem('autoGrabTweets', "false");
	}
	
	var blockingAds = localStorage.getItem('blockingAds') === 'true';
	
	localStorage.setItem('blockingAds', blockingAds.toString());
	
	
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
						deTweet();
					}
					if ("state" in request){
						isExtensionOn = request.state;
						
						if (document.getElementById("startupbutton")){
							if (isExtensionOn){
								document.getElementById("startupbutton").style.display = "block";
								document.getElementById("adbutton").style.display = "block";
							} else {
								document.getElementById("startupbutton").style.display = "none";
								document.getElementById("adbutton").style.display = "none";
							}
							if (enabledSSN){
								document.getElementById("startupbutton").innerHTML = "Disable Overlay Service"
								document.getElementById("startupbutton").style.backgroundColor = "#af5454";
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
	
	function escapeHtml(unsafe){
		try {
			if (settings.textonlymode){ // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				 .replace(/&/g, "&amp;")
				 .replace(/</g, "&lt;")
				 .replace(/>/g, "&gt;")
				 .replace(/"/g, "&quot;")
				 .replace(/'/g, "&#039;") || "";
		} catch(e){
			return "";
		}
	}

	function getAllContentNodes(element) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}


	function prepMessage(ele){
	  if (ele == window){return;}
	  
	  if (this.targetEle){
		  ele = this.targetEle.parentNode;;
		  var base = ele.querySelector("[data-testid='tweet']");
	  } else if (this && this.parentNode){
		  ele = this.parentNode;
		  var base = ele.querySelector("[data-testid='tweet']");
	  } else {
		  base = ele;
	  }
	  
	  if (!base){
		   console.log("no base");
		   return;
	  }
	  
	  try{
		  var chatname = base.querySelectorAll("a[role='link']")[1].childNodes[0].childNodes[0].innerText.trim();
		  
		  if (!chatname.length){
			  chatname = base.querySelectorAll("a[role='link']")[1].querySelector("[id]").childNodes[0].innerText.trim();
		  }
	  } catch(e){
		 var chatname="";
	  }
	  
	  
	  if (!chatname){
		  try {
			   if (base.querySelectorAll("a[role='link']")[0].id){
				  chatname = base.querySelectorAll("a[role='link']")[2].childNodes[0].childNodes[0].innerText.trim();
		  
				  if (!chatname.length){
					  chatname = base.querySelectorAll("a[role='link']")[2].querySelector("[id]").childNodes[0].innerText.trim();
				  }
			   }
		  } catch(e){
			  chatname="";
		  }
	  }
	  
	  var chatimg=false;
	  var contentimg=false;
	  try{
		 chatimg = base.childNodes[0].querySelector("img").src
	  } catch(e){}
	  
	  var chatmessage = "";
	  try { 
	  
		  chatmessage = base.querySelector("[lang]");
		  if (chatmessage){
			  var links = chatmessage.querySelectorAll("a");
			  for (var i =0;i<links.length;i++){
				  if (links[i].innerText.length>15){
					links[i].innerText = links[i].innerText.substring(0, 15) + "...";
				  }
			  }
			  chatmessage = escapeHtml(chatmessage.innerText);
		  }
		  
		  if (!chatmessage.length){
			  chatmessage =  escapeHtml(base.childNodes[1].childNodes[1].childNodes[1].innerText);
		  }
		  try{
			contentimg = base.querySelector("video").getAttribute("poster");
		  } catch(e){
			  
			  try{
					contentimg = base.querySelector("[lang]").parentNode.nextElementSibling.querySelector("img").src;
			  } catch(e){
					contentimg = "";
			  }
		  }
		  
	  } catch(e){
		  if (!chatmessage){
			  try{
				  if (ele.parentNode.querySelectorAll("[lang]").length){
					chatmessage =  escapeHtml(ele.parentNode.querySelector("[lang]").innerText);
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
	  
	  try {
		var msglink = ele.querySelector("a[href] > time").parentNode.href;
		if (autoGrabTweets){
			if (grabbedTweets.includes(msglink)){
				return;
			}
		}
		grabbedTweets.push(msglink);
		grabbedTweets = grabbedTweets.slice(-250);
		localStorage.setItem('grabbedTweets', JSON.stringify(grabbedTweets));
	  } catch(e){
		  if (autoGrabTweets){
			  return;
		  }
	  }
	 

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
	  data.textonly = settings.textonlymode || false;
	  
	  if (settings.detweet){
			data.type = "twitter";
	  } else {
			data.type = "x";
	  }
	  
	  
	  pushMessage(data);
	};
	
	document.addEventListener('keydown', function(event) {
		if (event.ctrlKey && event.altKey && event.shiftKey && event.key === 'V') {
			console.log('Ctrl + Alt + Shift + V pressed!');
			downloadCurrentVideo();
		}
	});
	function downloadCurrentVideo(){
		let videoElement = document.querySelector('video');
		let recorder;
		let data = [];
		function createRecorder() {
			let stream = videoElement.captureStream();
			recorder = new MediaRecorder(stream);
			recorder.ondataavailable = event => data.push(event.data);
			recorder.onstop = downloadVideo;
		}
		function isVideoPlaying(video) {
			return !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
		}
		function downloadVideo() {
			console.log("finished saving video");
			
			let blob = new Blob(data, { type: 'video/mp4' });
			let url = URL.createObjectURL(blob);
			let a = document.createElement("a");
			a.href = url;
			let segments = location.href.split('/');
			let filename = segments[segments.length - 1];
			a.download = filename+'.mp4';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
			recorder = null;
			data = [];
			videoElement.pause();
		}
		
		['pause', 'ended', 'error'].forEach(event => {
			videoElement.addEventListener(event, () => {
				if (recorder && recorder.state === 'recording') {
					recorder.stop();
				}
			});
		});
		
		data = [];
		createRecorder();
		videoElement.currentTime = 0;
		console.log("started saving video");
		if (!isVideoPlaying(videoElement)){
			videoElement.play().then(() => {
				recorder.start();
			});
		} else {
			recorder.start();
		}
		
	}
	
	function checkButtons(){
		
		if (!isExtensionOn || !enabledSSN){return;}
		
		var bases = document.querySelector('main[role="main"]').querySelectorAll('article[role="article"]');
		bases = [...bases].reverse();
		
		for (var i=0;i<bases.length;i++) {
			
			try {
				if (autoGrabTweets){
					prepMessage(bases[i]);
				} else {
					if (!bases[i].dataset.set){
						bases[i].dataset.set=true;
						var button  = document.createElement("button");
						button.onclick = prepMessage;
						button.innerHTML = "Grab Tweet";
						button.style = " transition: all 0.2s linear; border:1px solid #0007; width: 56px; height: 56px; border-radius: 50px; padding: 4px; margin: 10px; background-color: rgb(117 153 117); cursor:pointer;"
						button.className = "btn-push-twitter";
						button.targetEle = bases[i];
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
			
			clearTimeout(preStartupInteval);
			startup();
			
			var eles = document.querySelector('header[role="banner"]').querySelectorAll('a[aria-label][role="link"]');
			try {
				eles[eles.length - 1].querySelector("a > div > span > div > div > span > span").innerText = "Tweet";
			} catch(e){}
					
			var button  = document.createElement("button");
			button.onclick = function(){
				//document.getElementById("startupbutton").remove();
				
				enabledSSN = !enabledSSN;
				localStorage.setItem('enabledSSN', enabledSSN.toString());
				
				if (enabledSSN){
					document.getElementById("startupbutton").innerHTML = "Disable Overlay Service"
					document.getElementById("startupbutton").style.backgroundColor = "#af5454";
					document.getElementById("grabmodebutton").style.display = "block";
					
				} else {
					document.getElementById("startupbutton").innerHTML = "Enable Overlay Service";
					document.getElementById("startupbutton").style.backgroundColor = "#54af54";
					
					document.querySelectorAll(".btn-push-twitter").forEach(ele=>{
						ele.style.display = "none";
					});
					
				}
			};
			button.id = "startupbutton";
			button.innerHTML = "Enable Overlay Service";
			button.style = "border: 0; width:90%;transition: all 0.2s linear; height: 51px; border-radius: 100px; padding: 4px; margin-top: 10px; background-color: #54af54; cursor:pointer;";
			
			if (!isExtensionOn){
				button.style.display = "none";
			}
			
			if (enabledSSN){
				button.innerHTML = "Disable Overlay Service"
				button.style.backgroundColor = "#af5454";
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
			
			var button  = document.createElement("button");
			button.onclick = function(){
				autoGrabTweets = !autoGrabTweets;
				console.log("switch to auto mode: " +autoGrabTweets.toString());
				
				localStorage.setItem('autoGrabTweets', autoGrabTweets.toString());
				if (!autoGrabTweets){
					this.innerHTML = "Auto-grab Mode";
					
					document.querySelectorAll(".btn-push-twitter").forEach(ele=>{
						ele.style.display = "inline-block";
					});
					
					
				} else {
					this.innerHTML = "Manual Mode";
					
					document.querySelectorAll(".btn-push-twitter").forEach(ele=>{
						ele.click();
						ele.style.display = "none";
					});
					
				}
			};
			
			button.id = "grabmodebutton";
			if (!autoGrabTweets){
				button.innerHTML = "Auto-grab Mode";
			} else {
				button.innerHTML = "Manual Mode";
			}
			button.style = "border: 0; width:90%;transition: all 0.2s linear; height: 51px; border-radius: 100px; padding: 4px; margin-top: 10px; background-color: #6254af; cursor:pointer;";
			
			if (!isExtensionOn || !enabledSSN){
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
				
				blockingAds = !blockingAds;
				localStorage.setItem('blockingAds', blockingAds.toString());
				
				const styleEl = document.createElement("style");
				document.head.appendChild(styleEl);
				styleEl.sheet.insertRule("div[data-testid='Dropdown']{ height:0; opacity:0; }", 0);
				styleEl.sheet.insertRule("article div[data-testid='caret']{ height:0; opacity:0; }", 0);
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
			button2.style = "border: 0; margin-top: 10px;width:90%;transition: all 0.2s linear; height: 51px; border-radius: 100px; padding: 4px; background-color: rgb(151 151 151); cursor:pointer;";
			
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
	var observer = null;
	function monitorTitle(){
		if (observer){return;}
		document.title = document.title.replace("/ X","/ Twitter");
		observer = new MutationObserver(function(mutations) {
			if (observer){
				observer.disconnect();
				observer = null;
			}
			document.title = document.title.replace("/ X","/ Twitter");
			setTimeout(function(){
				monitorTitle();},50);
		});
		observer.observe(
			document.querySelector('title'),
			{ subtree: true, characterData: true, childList: true }
		);
	}

	var checkTwitter = null;
	
	
	
	function deTweet(){
		if (!settings.detweet){
			if (observer){
				observer.disconnect();
				observer = null;
			}
			return;
		}
		monitorTitle();
		
		try {
			document.querySelector("header div > h1[role='heading'] > a[href='/home'] svg").outerHTML = '\
				<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 248 204">\
				  <path fill="#1d9bf0" d="M221.95 51.29c.15 2.17.15 4.34.15 6.53 0 66.73-50.8 143.69-143.69 143.69v-.04c-27.44.04-54.31-7.82-77.41-22.64 3.99.48 8 .72 12.02.73 22.74.02\ 44.83-7.61 62.72-21.66-21.61-.41-40.56-14.5-47.18-35.07 7.57 1.46 15.37 1.16 22.8-.87-23.56-4.76-40.51-25.46-40.51-49.5v-.64c7.02 3.91 14.88 6.08 22.92 6.32C11.58 63.31\ 4.74 33.79 18.14 10.71c25.64 31.55 63.47 50.73 104.08 52.76-4.07-17.54 1.49-35.92 14.61-48.25 20.34-19.12 52.33-18.14 71.45 2.19 11.31-2.23 22.15-6.38 32.07-12.26-3.77 11.69-11.66 21.62-22.2 27.93 10.01-1.18 19.79-3.86 29-7.95-6.78 10.16-15.32 19.01-25.2 26.16z"/>\
				</svg>\
			';
			
			var link = document.querySelector("link[rel~='icon']");
			if (!link) {
				link = document.createElement('link');
				link.rel = 'icon';
				document.head.appendChild(link);
			}
			link.href = "data:image/png;base64,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";
			
			clearInterval(checkTwitter);
		} catch(e){
			checkTwitter = setInterval(function(){
				try {
					document.querySelector("header div > h1[role='heading'] > a[href='/home'] svg").outerHTML = '\
						<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 248 204">\
						  <path fill="#1d9bf0" d="M221.95 51.29c.15 2.17.15 4.34.15 6.53 0 66.73-50.8 143.69-143.69 143.69v-.04c-27.44.04-54.31-7.82-77.41-22.64 3.99.48 8 .72 12.02.73 22.74.02\ 44.83-7.61 62.72-21.66-21.61-.41-40.56-14.5-47.18-35.07 7.57 1.46 15.37 1.16 22.8-.87-23.56-4.76-40.51-25.46-40.51-49.5v-.64c7.02 3.91 14.88 6.08 22.92 6.32C11.58 63.31\ 4.74 33.79 18.14 10.71c25.64 31.55 63.47 50.73 104.08 52.76-4.07-17.54 1.49-35.92 14.61-48.25 20.34-19.12 52.33-18.14 71.45 2.19 11.31-2.23 22.15-6.38 32.07-12.26-3.77 11.69-11.66 21.62-22.2 27.93 10.01-1.18 19.79-3.86 29-7.95-6.78 10.16-15.32 19.01-25.2 26.16z"/>\
						</svg>\
					';
					
					var link = document.querySelector("link[rel~='icon']");
					if (!link) {
						link = document.createElement('link');
						link.rel = 'icon';
						document.head.appendChild(link);
					}
					link.href = "data:image/png;base64,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";
					
					clearInterval(checkTwitter);
				} catch(e){
					
				}
			},1000);
		}
	}

	setTimeout(function(){preStartup();},1000);

	var preStartupInteval = setInterval(function(){preStartup();},5000);

})();
















