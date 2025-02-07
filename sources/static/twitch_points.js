(function () {
    var settings = {};
    var checkReady = null;
    let videoEventListeners = new Map();
    let lastKnownVolume = 1.0; // Store the last known volume of the main video
    
    // Callback functions for ad state changes
    const adCallbacks = {
        onAdStart: null,
        onAdEnd: null
    };

    // Function to set ad callbacks
    function setAdCallbacks(callbacks) {
        if (callbacks.onAdStart) adCallbacks.onAdStart = callbacks.onAdStart;
        if (callbacks.onAdEnd) adCallbacks.onAdEnd = callbacks.onAdEnd;
    }
    
    if (chrome && chrome.runtime) {
        chrome.runtime.onMessage.addListener(
            function (request, sender, sendResponse) {
                try {
                    if (typeof request === "object") {
                        if ("settings" in request) {
                            settings = request.settings;
                            sendResponse(true);
                            if (settings.collecttwitchpoints) {
                                startCheck();
                            }
                            return;
                        }
                    }
                    if ("focusChat" == request) {
                        return;
                    }
                } catch(e) {}
                sendResponse(false);
            }
        );
        chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
            if ("settings" in response) {
                settings = response.settings;
                if (settings.collecttwitchpoints) {
                    startCheck();
                }
            }
        });
    }
    
    document.addEventListener('DOMContentLoaded', (ee) => {
        document.body.addEventListener("play", (event) => {
            addVideoEventListeners();
        }, true);
        
        function addVideoEventListeners() {
            const videoEvents = [
                'abort', 'play', 'volumechange'
            ];
            
            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                if (videoEventListeners.has(video)) {
                    let listeners = videoEventListeners.get(video);
                    for (let eventType in listeners) {
                        video.removeEventListener(eventType, listeners[eventType]);
                    }
                }
                
                let listeners = {};
                videoEvents.forEach(eventType => {
                    const listener = event => {
                        const mainVideo = document.querySelector("video[id]");
                        const adVideo = document.querySelector("video:not([id])");
                        
                        if (eventType === "volumechange" && event.target === mainVideo) {
                            // Store the volume only when it's manually changed (not during ad playback)
                            if (!adVideo) {
                                lastKnownVolume = mainVideo.volume;
                            }
                        }
                        
                        if (eventType === "play") {
							
                            if (!settings.twichadmute) {
                                // Still trigger callbacks even if muting is disabled
                                if (adVideo && adCallbacks.onAdStart && settings.twichadannounce) {
                                    adCallbacks.onAdStart();
                                }
								
                                return;
                            }
                            
                            if (mainVideo) {
                                if (mainVideo.paused) {
                                    event.target.muted = false;
                                } else {
                                    if (adVideo) {
                                        // Use stored volume instead of ad video's volume
                                        mainVideo.volume = lastKnownVolume;
                                        adVideo.muted = true;
                                        
                                        // Trigger ad start callback
                                        if (adCallbacks.onAdStart && settings.twichadannounce) {
                                            adCallbacks.onAdStart();
                                        }
                                    }
                                    mainVideo.muted = false;
                                }
                            }
                        } else if (eventType === 'abort') {
							
                            if (!settings.twichadmute) {
                                // Still trigger callbacks even if muting is disabled
                                if (mainVideo && adCallbacks.onAdEnd && settings.twichadannounce) {
                                    adCallbacks.onAdEnd();
                                }
                                return;
                            }
                            
                            if (mainVideo) {
                                if (adVideo) {
                                    adVideo.muted = false;
                                    mainVideo.muted = true;
                                }
                                
                                // Trigger ad end callback
                                if (adCallbacks.onAdEnd && settings.twichadannounce) {
                                    adCallbacks.onAdEnd();
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
			console.log("Socialstream static injected");
			if (settings.collecttwitchpoints){
				try {
					var channelPoints = document.querySelectorAll('[data-test-selector="community-points-summary"] button');
					if (channelPoints.length === 2){
						[...channelPoints].pop().click();
					}
				} catch(e){}
			}
			checkReady = setInterval(function(){
				try {
					var ele = document.querySelectorAll(".player-controls__right-control-group button[class^='ScCoreButton'][aria-label] .tw-core-button-icon");
						if (ele && ele.length==2){
							ele[0].parentNode.style = "margin-left: 10px;cursor:pointer;";
							ele[0].parentNode.title = "Clip this video";
							
							if (!document.querySelector("[data-target='channel-header-right'] [data-added]")){
								ele[0].parentNode.dataset.added = true;
								document.querySelector("[data-target='channel-header-right']").appendChild(ele[0].parentNode);
							}
						}
					} catch(e){
				}
				
				if (settings.collecttwitchpoints){
					var channelPoints = document.querySelectorAll('[data-test-selector="community-points-summary"] button');
					if (channelPoints.length === 2){
						[...channelPoints].pop().click();
					}
				} else {
					clearInterval(checkReady);
				}
			},10000);
	}}
	var data = {};
	data.chatname = "Ad Alert";
	data.nameColor = "#F33";
	data.chatmessage = ""
	data.event = "adbreak";
	data.chatimg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgeD0iMiIgeT0iNCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjE2IiBmaWxsPSIjOTkwMDAwIiBzdHJva2U9IiM5OTAwMDAiIHN0cm9rZS13aWR0aD0iMiIgcng9IjIiLz48dGV4dCB4PSI1LjUiIHk9IjE1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtd2VpZ2h0PSJib2xkIiBmb250LXNpemU9IjgiIGZpbGw9IndoaXRlIj5BRDwvdGV4dD48Y2lyY2xlIGN4PSIxOSIgY3k9IjciIHI9IjIiIGZpbGw9IndoaXRlIi8+PC9zdmc+";
	data.textonly = true;
	data.type = "twitch";
	
	
	setAdCallbacks({
		onAdStart: function() {
			console.log('Ad started playing');
			data.chatmessage = "An ad break is starting..";
			try {
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					{
						message: data
					},
					function (e) {
						
					}
				);
			} catch (e) {
				//
			}
			
		},
		onAdEnd: function() {
			console.log('Ad finished playing');
			data.chatmessage = "An ad break is stopping.";
			try {
				chrome.runtime.sendMessage(
					chrome.runtime.id,
					{
						message: data
					},
					function (e) {
						
					}
				);
			} catch (e) {
				console.log(e);
			}
		}
	});
    
})();
	