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
                    // This helper is not a routeable chat source. Do not answer getSource here
                    // or it can override sources/twitch.js and break targeted sendChat routing.
                    if ("getSource" == request) { return; }
					if ("focusChat" == request) {
                        return;
                    }
                } catch(e) {}
                sendResponse(false);
            }
        );
        chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
            if (response && "settings" in response) {
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
					if (ele && ele.length == 2) {
						ele[0].parentNode.style = "margin-left: 10px;cursor:pointer;";
						ele[0].parentNode.title = "Clip this video";
						
						const existingElement = document.querySelector("[data-target='channel-header-right'] [data-added]");
						if (existingElement) {
							existingElement.remove();
						}
						
						ele[0].parentNode.dataset.added = true;
						document.querySelector("[data-target='channel-header-right']").appendChild(ele[0].parentNode);
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
	data.event = "ad_break";
	data.chatimg = "./sources/images/twitch.png";
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
