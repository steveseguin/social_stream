(function () {
	
	console.log("Social Stream injected");
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "cmd": "getOnOffState"}, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		try{
			if (typeof response === "object"){
				if (response.streamID){ // this won't update if the stream ID changes, without a page reload at least
					var check = confirm("This page is requesting access to your Social Stream chat session ID.\n\nWould you like to give it access?\n\nIt will be able to read and write to your chat streams while the extension is on.");
					if (check){
						window.chatID  = response.streamID;
						console.log("window chatID updated");
						if (window.updatedChatID){
							window.updatedChatID();
						}
					}
				}
				
				sendResponse(true);
				return;
			}
		} catch(e){}
	});

	
})();