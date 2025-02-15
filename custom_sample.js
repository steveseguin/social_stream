// To use, rename custom_sample.js to custom.js



// You'll need to open the locally hosted dock.html file, such as:
// file:///C:/Users/XXXXXXXXXX/Downloads/social_stream/dock.html?session=xxxxxxxxxx&auto1
//
// This will not work if you try to run the dock from https://socialstream.ninja/dock.html
// You can however host the code on your own domain, or run it off github as a fork, instead though
// This specific function is triggered in the dock.html page only
function applyCustomActions(data){
	var tid = false;
	if (data.tid){tid = data.tid;}
	
	if (urlParams.has("auto1")){
		if (data.chatmessage === "1"){
			if (Date.now() - messageTimeout > 60000){ // respond to "1" with a "1" automatically; at most 1 time per minute.
				messageTimeout = Date.now();
				if (data.chatname.toLowerCase() === "pyka"){
					respondP2P("1 <3 <3 <3", tid);
				} else if (data.chatname.toLowerCase() !== "evarate"){
					respondP2P("1", tid);
				}
			}
		}
	}
	
	return data; // return the data, if you want to modify it. If you return "null", it will stop the processing. (also false works, but I'll deprecate that I think)
}

///////

// this next example is specific for the featured chat overlay, instead of the dock
// file:///C:/Users/XXXXXXXXXX/Downloads/social_stream/featured.html?session=xxxxxxxxxx
function applyCustomFeatureActions(data){
	var tid = false;
	if (data.tid){tid = data.tid;}
	
	if (!tid) {
	   console.log("Featured overlay cleared.");
	} else {
	   console.log("Message from " + data.chatname + " was featured." );
	}
}
