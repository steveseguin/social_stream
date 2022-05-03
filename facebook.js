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
	  if (ele == window){return;}
	  var chatimg = "";
	  try{
		   chatimg = ele.childNodes[0].querySelector("img").src;
	  } catch(e){
		  try{
		   chatimg = ele.childNodes[0].querySelector("image").href.baseVal;
		  } catch(e){
			  //
		  }
	  }
	try{
		var name = ele.childNodes[1].querySelector('a[role="link"]').innerText;
	} catch(e){
		return;
	}
	  if (name){
		name = name.trim();
	  }
	  
	  var msg = "";
	  
	  if (textOnlyMode){
		  try {
			ele.childNodes[1].querySelector('a[role="link"]').parentNode.parentNode.parentNode.querySelector('span[lang]').querySelectorAll('*').forEach(function(node) {
				
				if (node.nodeName == "IMG"){
					//msg+=node.outerHTML;
				} else {
					node.childNodes.forEach(function(nn){
						try{
							if (nn.nodeName === "#text"){
								msg+=nn.textContent;
							}
						}catch(e){}
					});
				}
			});
		  } catch(e){
			  try{
				ele.childNodes[1].querySelector('a[role="link"]').parentNode.parentNode.parentNode.querySelectorAll('*').forEach(function(node) {
					if (node.nodeName == "IMG"){
						//msg+=node.outerHTML;
					} else {
						node.childNodes.forEach(function(nn){
							try{
								if (nn.nodeName === "#text"){
									msg+=nn.textContent;
								}
							}catch(e){}
						});
					}
				});
			  } catch(e){}
		  }
	  } else {
		  try {
			ele.childNodes[1].querySelector('a[role="link"]').parentNode.parentNode.parentNode.querySelector('span[lang]').querySelectorAll('*').forEach(function(node) {
				
				if (node.nodeName == "IMG"){
					msg+=node.outerHTML;
				} else {
					node.childNodes.forEach(function(nn){
						try{
							if (nn.nodeName === "#text"){
								msg+=nn.textContent;
							}
						}catch(e){}
					});
				}
			});
		  } catch(e){
			  try{
				ele.childNodes[1].querySelector('a[role="link"]').parentNode.parentNode.parentNode.querySelectorAll('*').forEach(function(node) {
					if (node.nodeName == "IMG"){
						msg+=node.outerHTML;
					} else {
						node.childNodes.forEach(function(nn){
							try{
								if (nn.nodeName === "#text"){
									msg+=nn.textContent;
								}
							}catch(e){}
						});
					}
				});
			  } catch(e){}
		  }
	  }
	  
	  if (msg){
		msg = msg.trim();
		if (name){
			if (msg.startsWith(name)){
				msg = msg.replace(name, '');
				msg = msg.trim();
			}
		}
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
	  data.type = "facebook";
	  
	  
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
	
	var dupCheck = [];
	
	setTimeout(function(){ // clear existing messages; just too much for a stream.
		try {
			if (window.location.href.includes("facebook.com/live/producer/")){
				var main = document.querySelectorAll("[role='article']");
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
							dupCheck.push(main[j].id);
						} else if(main[j].children[0].id && !(main[j].children[0].id in dupCheck)){
							dupCheck.push(main[j].children[0].id);
							processMessage(main[j]);
						}
					} catch(e){}
				}
			} else if (window.location.href.includes("/videos/")){
				var main = document.querySelectorAll("div[role='article']");
				for (var j =0;j<main.length;j++){
					try{
						if (!main[j].dataset.set123){
							main[j].dataset.set123 = "true";
							dupCheck.push(main[j].id);
						} else if(main[j].parentNode.id && !(main[j].parentNode.id in dupCheck)){
							dupCheck.push(main[j].parentNode.id);
							processMessage(main[j]);
						}
					} catch(e){}
				}
			}
		} catch(e){  }
	
		console.log("LOADED SocialStream EXTENSION");
	
		var ttt = setInterval(function(){
			dupCheck = dupCheck.slice(-100);
			try {
				if (window.location.href.includes("facebook.com/live/producer/")){
					var main = document.querySelectorAll("[role='article']");
					for (var j =0;j<main.length;j++){
						try{
							if (!main[j].dataset.set123){
								console.log(main[j].parentNode);
								main[j].dataset.set123 = "true";
								if (main[j].id && !(main[j].id in dupCheck)){
									dupCheck.push(main[j].id);
									if (main[j].id.startsWith("client:")){continue;}
									processMessage(main[j]);
								} else if (main[j].parentNode && main[j].parentNode.id && !(main[j].parentNode.id in dupCheck)){
									dupCheck.push(main[j].parentNode.id);
									if (main[j].parentNode.id.startsWith("client:")){continue;}
									processMessage(main[j]);
								}
							} 
						} catch(e){}
					}
				} else if (window.location.href.includes("/videos/")){
					var main = document.querySelectorAll("div[role='article']");
					for (var j =0;j<main.length;j++){
						try{
							if (!main[j].dataset.set123){
								console.log(main[j].parentNode);
								main[j].dataset.set123 = "true";
								if (main[j].id && !(main[j].id in dupCheck)){
									dupCheck.push(main[j].id);
									if (main[j].id.startsWith("client:")){continue;}
									processMessage(main[j]);
								} else if (main[j].parentNode && main[j].parentNode.id && !(main[j].parentNode.id in dupCheck)){
									dupCheck.push(main[j].parentNode.id);
									if (main[j].parentNode.id.startsWith("client:")){continue;}
									processMessage(main[j]);
								}
							}
						} catch(e){}
					}
				}
			} catch(e){  }
		},800);
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
					
					var eles= document.querySelectorAll('[contenteditable="true"]');
					if (eles.length){
						for (var i =0;i<eles.length;i++){
							try {
								eles[i].childNodes[0].childNodes[0].childNodes[0].focus();
							} catch(e){
								if (document.querySelector("[data-editor]>[data-offset-key]")){
									document.querySelector("[data-editor]>[data-offset-key]").focus();
									continue;
								}
								try {
									eles[i].childNodes[0].focus();
								} catch(e){
									try{
										eles[i].querySelector("p").focus();
									}catch(e){}
								}
							}
						}
					} else if (document.querySelector("[data-editor]>[data-offset-key]")){
						document.querySelector("[data-editor]>[data-offset-key]").focus();
					} else {
						sendResponse(true);
						return;
					}
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