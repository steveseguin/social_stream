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

var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
var eventer = window[eventMethod];
var messageEvent = eventMethod === "attachEvent" ? "onmessage" : "message";
var debuggerEnabled = {};
var commandCounter = 0;

function onDetach(debuggeeId) {
	debuggerEnabled[debuggeeId.tabId] = false;
}
chrome.debugger.onDetach.addListener(onDetach);

function onAttach(debuggeeId) {
	console.log("debuggeeId "+debuggeeId.tabId);
  if (chrome.runtime.lastError) {
    console.warn(chrome.runtime.lastError.message);
    return;
  }
  debuggerEnabled[debuggeeId.tabId] = true;
}

eventer(messageEvent, function (e) {
  if ("dataReceived" in e.data){ // raw data 
	if ("overlayNinja" in e.data.dataReceived){
		if ("response" in e.data.dataReceived.overlayNinja){
			console.log(e.data.dataReceived);
			chrome.tabs.query({}, function(tabs) {
			    for (var i=0;i<tabs.length;i++){
					try {
						if ("url" in tabs[i]){
							console.log(tabs[i]);
							if (tabs[i].url.startsWith("https://www.twitch.tv/popout/")){
								console.log(debuggerEnabled[tabs[i].id]);
								
								if (!debuggerEnabled[tabs[i].id]){
									debuggerEnabled[tabs[i].id]=false;
									chrome.debugger.attach( { tabId: tabs[i].id },  "1.3", onAttach.bind(null,  { tabId: tabs[i].id }));
								}
								
								setTimeout(function(tabid, message){
									try{
										
										chrome.tabs.sendMessage(tabid, "focusChat", function(response=null) {
											console.log(response);
											
											chrome.debugger.sendCommand({ tabId:tabid }, "Input.insertText", { text: message }, function (e) {});
											
											chrome.debugger.sendCommand({ tabId:tabid }, "Input.dispatchKeyEvent", { 
												"type": "keyDown",
												"key": "Enter",
												"code": "Enter",
												"nativeVirtualKeyCode": 13,
												"windowsVirtualKeyCode": 13
											}, function (e) {
													console.log('dispatchKeyEvent', e);
												}
											);
											
											chrome.debugger.sendCommand({ tabId:tabid }, "Input.dispatchKeyEvent", {
												"type": "keyUp",
												"key": "Enter",
												"code": "Enter",
												"nativeVirtualKeyCode": 13,
												"windowsVirtualKeyCode": 13
											 }, function (e) {
													console.log('insertText', e);
													if (debuggerEnabled[tabid]){
														chrome.debugger.detach({ tabId: tabid }, onDetach.bind(null, { tabId: tabid }));
													}
												}
											);
											
										});
										
									} catch(e){
										console.error(e);
									}
								},0,tabs[i].id, e.data.dataReceived.overlayNinja.response);
							}
							
							if (tabs[i].url.startsWith("https://www.youtube.com/live_chat")){
								console.log(debuggerEnabled[tabs[i].id]);
								if (!debuggerEnabled[tabs[i].id]){
									debuggerEnabled[tabs[i].id]=false;
									chrome.debugger.attach( { tabId: tabs[i].id },  "1.3", onAttach.bind(null,  { tabId: tabs[i].id }));
								}
								setTimeout(function(tabid, message){
									try{
										
										chrome.tabs.sendMessage(tabid, "focusChat", function(response=null) {
											console.log(response);
											console.log("tabid:"+tabid);
											
											chrome.debugger.sendCommand({ tabId:tabid }, "Input.insertText", { text: message }, function (e) {});
											
												chrome.debugger.sendCommand({ tabId:tabid }, "Input.dispatchKeyEvent", {
													"type": "keyDown",
													"key": "Enter",
													"code": "Enter",
													"text": "\r",
													"nativeVirtualKeyCode": 13,
													"windowsVirtualKeyCode": 13
												}, function (e) {
													console.log("done enter down");
													
												});
											
												chrome.debugger.sendCommand({ tabId:tabid }, "Input.dispatchKeyEvent", {
													"type": "char",
													"key": "Enter",
													"text": "\r",
													"code": "Enter",
													"nativeVirtualKeyCode": 13,
													"windowsVirtualKeyCode": 13
												}, function (e) {
													console.log("done enter down");
													
												});
											
												chrome.debugger.sendCommand({ tabId:tabid }, "Input.dispatchKeyEvent", { 
													"type": "keyUp",
													"key": "Enter",
													"code": "Enter",
													"text": "\r",
													"nativeVirtualKeyCode": 13,
													"windowsVirtualKeyCode": 13
												 }, function (e) {
														console.log("done enter up");
														console.log(debuggerEnabled[tabid]+"");
														if (debuggerEnabled[tabid]){
															console.log("Detatching");
															chrome.debugger.detach({ tabId: tabid }, onDetach.bind(null, { tabId: tabid }));
														}
													}
												);
										});
										
									} catch(e){
										console.error(e);
									}
								},0,tabs[i].id, e.data.dataReceived.overlayNinja.response);
							}
						}
					} catch(e){console.error(e);}
			    }
			});
			
		}
	}
  }
});

////////////////////




