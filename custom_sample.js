function applyCustomActions(data){
	var tid = false;
	if (data.tid){tid = data.tid;}
	
	if (urlParams.has("auto1")){
		if (data.chatmessage === "1"){
			if (Date.now() - messageTimeout > 60000){ // respond to "1" with a "1" automatically; at most 1 time per minute.
				messageTimeout = Date.now();
				if (data.chatname.toLowerCase() === "pykamusic"){
					respondP2P("1 <3 <3 <3", tid);
				} else if (data.chatname.toLowerCase() !== "evarate"){
					respondP2P("1", tid);
				}
			}
		}
	}
}