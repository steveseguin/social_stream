
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
	 
	  
	  var name = ele.childNodes[1].querySelector('a[role="link"]').innerText;
	  if (name){
		name = name.trim();
	  }
	  
	  var msg = "";
	  
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
	  
	  if (data.type === "facebook"){
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
				data.chatimg = "";
				pushMessage(data);
			}
	  } else {
		  pushMessage(data);
	  }
	}
	setTimeout(function(){ // clear existing messages; just too much for a stream.
		try {
			var main = document.querySelector("div[role='complementary']").querySelectorAll("div[role='article']");
			for (var j =0;j<main.length;j++){
				try{
					if (!main[j].dataset.set){
						main[j].dataset.set = "true";
					} 
				} catch(e){}
			}
		} catch(e){  }
	},1600);
	
	var ttt = setInterval(function(){
		try {
			var main = document.querySelector("div[role='complementary']").querySelectorAll("div[role='article']");
			for (var j =0;j<main.length;j++){
				try{
					if (!main[j].dataset.set){
						main[j].dataset.set = "true";
						processMessage(main[j]);
					} 
				} catch(e){}
			}
		} catch(e){ }
	},2000);

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				console.log(request);
				if ("focusChat" == request){
					document.querySelector('[contenteditable="true"]').childNodes[0].childNodes[0].childNodes[0].focus();
				}
			} catch(e){}
			
			sendResponse(document.querySelector('[contenteditable="true"]').childNodes[0].childNodes[0].childNodes[0].childNodes[0].childNodes[0].innerHTML);
		}
	);

	
