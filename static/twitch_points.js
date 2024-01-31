(function () {
	
	var settings = {};
	var checkReady = null;
	let videoEventListeners = new Map();
	
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
					if ("focusChat" == request){ 
						return;
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
	document.addEventListener('DOMContentLoaded', (ee) => {
		document.body.addEventListener("play", (event)=>{ // fix for adblock
			addVideoEventListeners();
		},true);
		
		
		function addVideoEventListeners() {
			const videoEvents = [
				'abort','play'
			];
			//'timeupdate', 'volumechange',  'progress', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 
			//	'ended', 'error', 'loadeddata', 'loadedmetadata', 'loadstart', 
			//	'pause', 'playing', 'ratechange', 'seeked', 
			//	'seeking', 'stalled', 'suspend', 'waiting'

			const videos = document.querySelectorAll('video');

			videos.forEach(video => {
				if (videoEventListeners.has(video)) {
					let listeners = videoEventListeners.get(video);
					for (let eventType in listeners) {
						video.removeEventListener(eventType, listeners[eventType]);
					}
				}
				
				if (!settings.twichadmute){return;} // this way I can disable old triggers and stop future triggers if needed.

				let listeners = {};

				videoEvents.forEach(eventType => {
					const listener = event => {
						if (eventType == "play"){
							if (!settings.twichadmute){return;}
							if (document.querySelector("video[id]")){
								if (document.querySelector("video[id]").paused){
									event.target.muted = false;
								} else {
									if (document.querySelector("video:not([id])")){
										document.querySelector("video[id]").volume = document.querySelector("video:not([id])").volume;
										document.querySelector("video:not([id])").muted = true;
									}
									document.querySelector("video[id]").muted = false;
								}
								
							}
						} else if (['abort'].includes(eventType)){
							if (!settings.twichadmute){return;}
							if (document.querySelector("video[id]")){
								if (document.querySelector("video:not([id])")){
									document.querySelector("video:not([id])").muted = false;
									document.querySelector("video[id]").muted = true;
								}
								
							}
						}
						
					};

					video.addEventListener(eventType, listener);
					listeners[eventType] = listener;
				});
				videoEventListeners.set(video, listeners);
			});
		}
		addVideoEventListeners();
	});
	
	
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