var isExtensionOn = false;
var iframe = null;
var channel = null;

function generateStreamID(){
	var text = "";
	var possible = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
	for (var i = 0; i < 10; i++){
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};


var properties = ["streamID"];
channel = generateStreamID();

chrome.storage.sync.get(properties, function(item){
	if (item.streamID){
		channel = item.streamID;
	} else {
		chrome.storage.sync.set({
			streamID: channel
		});
	}
});
						
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
		try{
			if (request.cmd && request.cmd === "setOnOffState") {
				isExtensionOn = request.data.value;
				
				if (isExtensionOn){
					if (iframe==null){
						loadIframe(channel);
						console.log("LOAD IFRAME");
					} else {
						console.log("IFRAME ALREADY LOADED");
					}
				} else {
					console.log("STOP IFRAME");
					if (iframe.src){
						iframe.src = null;
					}
					iframe.remove();
					iframe = null;
				}
				sendResponse({"state":isExtensionOn,"streamID":channel});
			} else if (request.cmd && request.cmd === "getOnOffState") {
				sendResponse({"state":isExtensionOn,"streamID":channel});
			} else if ("message" in request) {
				sendDataP2P(request.message);
				sendResponse({"state":isExtensionOn});
			}
		} catch(e){console.log(e);}
    }
);

function sendDataP2P(data){
	var msg = {};
	msg.overlayNinja = {};
	msg.overlayNinja = data;
	try {
		console.log(msg);
		iframe.contentWindow.postMessage({"sendData":msg, "type": "pcs"}, '*'); // send only to 'viewers' of this stream
	} catch(e){console.log("Not connected yet?");}
}
	
console.log(document);
function loadIframe(channel){  // this is pretty important if you want to avoid camera permission popup problems.  You can also call it automatically via: <body onload=>loadIframe();"> , but don't call it before the page loads.
	iframe = document.createElement("iframe");
	iframe.src = "https://vdo.ninja/?room="+channel+"&push="+channel+"&vd=0&ad=0&autostart&cleanoutput&view"; // don't listen to any inbound events
	console.log(iframe.src);
	document.body.appendChild(iframe);
	
}
	
