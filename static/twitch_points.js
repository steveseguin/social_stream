(function () {
	
	var settings = {};
	var checkReady = null;
	
	if (chrome && chrome.runtime){
		chrome.runtime.onMessage.addListener(
			function (request, sender, sendResponse) {
				try{
					if (typeof request === "object"){
						if ("settings" in request){
							settings = request.settings;
							sendResponse(true);
							if (settings.collecttwitchpoints){
								startCheck();
							}
							return;
						}
					}
					// twitch doesn't capture avatars already.
				} catch(e){}
				sendResponse(false);
			}
		);
		chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
			if ("settings" in response){
				settings = response.settings;
				if (settings.collecttwitchpoints){
					startCheck();
				}
			}
		});
	}
	
	console.log("Social Stream (TWITCH POINTS COLLECTION) injected");
	
	function startCheck(){
		if (!checkReady){
			if (settings.collecttwitchpoints){
				try {
					var channelPoints = document.querySelectorAll('[data-test-selector="community-points-summary"] button');
					if (channelPoints.length === 2){
						[...channelPoints].pop().click();
					}
				} catch(e){}
			}
			checkReady = setInterval(function(){
				if (settings.collecttwitchpoints){
					var channelPoints = document.querySelectorAll('[data-test-selector="community-points-summary"] button');
					if (channelPoints.length === 2){
						[...channelPoints].pop().click();
					}
				} else {
					clearInterval(checkReady);
				}
			},10000);
		}
	}
})();