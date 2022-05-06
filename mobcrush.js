var soca=false;
function generateStreamID(){
	var text = "";
	var possible = "ABCEFGHJKLMNPQRSTUVWXYZabcefghijkmnpqrstuvwxyz23456789";
	for (var i = 0; i < 11; i++){
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};
var channel = generateStreamID();
var outputCounter = 0; // used to avoid doubling up on old messages if lag or whatever

var sendProperties = ["color","scale","sizeOffset","commentBottom","commentHeight","authorBackgroundColor","authorAvatarBorderColor","authorColor","commentBackgroundColor","commentColor","fontFamily","showOnlyFirstName","highlightWords"];
var alreadyPrompted = false;

function actionwtf(){ // steves personal socket server service
	if (soca){return;}

	soca = new WebSocket("wss://api.overlay.ninja");
	soca.onclose = function (){
		setTimeout(function(){soca=false;actionwtf(); },2000);
	};
	soca.onopen = function (){
		soca.send(JSON.stringify({"join":channel}));
	};
	
	soca.addEventListener('message', function (event) {
		if (event.data){
			var data = JSON.parse(event.data);
			if ("url" in data){
				if ("twitch" in data){
					if (document.getElementById("img_"+data["twitch"])){
						document.getElementById("img_"+data["twitch"]).src = data['url'];
					}
				}
			}
		}
	});
	
	chrome.storage.sync.set({
		streamID: channel
	});
}

function pushMessage(data){
	var message = {};
	message.msg = true;
	message.contents = data;
	try {
		chrome.storage.sync.get(sendProperties, function(item){
			outputCounter+=1;
			message.id = outputCounter;
			message.settings = item;
			soca.send(JSON.stringify(message));
		});
	} catch(e){
		outputCounter+=1;
		message.id = outputCounter;
		soca.send(JSON.stringify(message));
	}
}

$("body").unbind("click").on("click", ".user-message", function () { // twitch
	try {
		console.log(this);
	  var chatdonation = false;
	  var chatmembership = false;
	  var chatsticker = false;
	  
	  var chatname = this.querySelector(".username").innerText;
	  
	  var chatmessage = this.querySelector(".message-content").innerText;
	  
	  if (!chatmessage){
		   console.log("No message found");
		   return;
	  }
	  var chatimg = this.parentNode.querySelector(".profile-logo > img").src;
	  
	  this.style.backgroundColor = "#666";

	  var chatbadges = "";
	 
	  // Mark this comment as shown
	  this.classList.add("shown-comment");
	  var hasDonation = '';
	  var hasMembership = '';
	  var backgroundColor = "";
	  var textColor = "";


	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = chatbadges;
	  data.backgroundColor = backgroundColor;
	  data.textColor = textColor;
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = hasDonation;
	  data.hasMembership = hasMembership;
	  data.type = "mobcrush";
	  
	  console.log(data);
	  
	  pushMessage(data);
	} catch(e){console.log(data);}
});

$("body").on("click", ".btn-clear-twitch", function () {
  pushMessage(false);
});

$("body").on("click", ".btn-getoverlay-twitch", function () {
    alreadyPrompted=true;
    prompt("Overlay Link: https://chat.overlay.ninja?session="+channel+"\nAdd as a browser source; set height to 250px", "https://chat.overlay.ninja?session="+channel);
});

function addButtons(){
	if (document.getElementById("pushButtonOverlay")){return;}
	if (document.querySelector(".meta-messages")){
		document.querySelector(".meta-messages").innerHTML += '<button  id="pushButtonOverlay" class="btn-clear-twitch">CLEAR</button><button class="btn-getoverlay-twitch">LINK</button>';
	}
}

setTimeout(function(){addButtons();},1000);

setTimeout(function(){addButtons();},10000);

var properties = ["color","scale","streamID","sizeOffset","commentBottom","commentHeight","authorBackgroundColor","authorAvatarBorderColor","authorColor","commentBackgroundColor","commentColor","fontFamily","showOnlyFirstName","highlightWords"];

chrome.storage.sync.get(properties, function(item){
  var color = "#000";
  if(item.color) {
    color = item.color;
  }
  if (item.streamID){
    channel = item.streamID;
  } else {
	chrome.storage.sync.set({
		streamID: channel
	});
  }

  let root = document.documentElement;
  root.style.setProperty("--keyer-bg-color", color);

  if(item.authorBackgroundColor) {
    root.style.setProperty("--author-bg-color", item.authorBackgroundColor);
    root.style.setProperty("--author-avatar-border-color", item.authorBackgroundColor);
  }
  if(item.authorAvatarBorderColor) {
    root.style.setProperty("--author-avatar-border-color", item.authorAvatarBorderColor);
  }
  if(item.commentBackgroundColor) {
    root.style.setProperty("--comment-bg-color", item.commentBackgroundColor);
  }
  if(item.authorColor) {
    root.style.setProperty("--author-color", item.authorColor);
  }
  if(item.commentColor) {
    root.style.setProperty("--comment-color", item.commentColor);
  }
  if(item.fontFamily) {
    root.style.setProperty("--font-family", item.fontFamily);
  }
  if(item.scale) {
    root.style.setProperty("--comment-scale", item.scale);
  }
  if(item.commentBottom) {
    root.style.setProperty("--comment-area-bottom", item.commentBottom);
  }
  if(item.commentHeight) {
    root.style.setProperty("--comment-area-height", item.commentHeight);
  }
  if(item.sizeOffset) {
    root.style.setProperty("--comment-area-size-offset", item.sizeOffset);
  }
});





setTimeout(function(){actionwtf();},500);
