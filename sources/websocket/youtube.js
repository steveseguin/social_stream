(function () {
	var settings = {};

	// Message queue and throttling
	var messageQueue = [];
	var isProcessingQueue = false;
	var BATCH_SIZE = 5;
	var BATCH_DELAY = 100; // ms between batches

	var isExtensionOn = true;
	var EMOTELIST = false;
	var BTTV = false;
	var SEVENTV = false;
	var FFZ = false;
	var currentVideoId = null;
	var currentChannelId = null;

	function requestEmotesForVideo(videoId, channelId) {
		if (!settings || !chrome.runtime || !chrome.runtime.id) return;
		
		// Store current IDs
		currentVideoId = videoId;
		currentChannelId = channelId;
		
		// Reset emotes when video changes
		EMOTELIST = false;
		BTTV = false;
		SEVENTV = false;
		FFZ = false;
		
		if (settings.bttv) {
			chrome.runtime.sendMessage(chrome.runtime.id, { 
				getBTTV: true,
				url: "https://youtube.com/?v="+videoId,
				videoId: videoId,
				channelId: channelId
			}, function (response) {
				if (chrome.runtime.lastError) {
					console.log('BTTV request error:', chrome.runtime.lastError.message);
				}
			});
		}
		if (settings.seventv) {
			chrome.runtime.sendMessage(chrome.runtime.id, { 
				getSEVENTV: true,
				videoId: videoId,
				url: "https://youtube.com/?v="+videoId,
				channelId: channelId
			}, function (response) {
				if (chrome.runtime.lastError) {
					console.log('7TV request error:', chrome.runtime.lastError.message);
				}
			});
		}
		if (settings.ffz) {
			chrome.runtime.sendMessage(chrome.runtime.id, { 
				getFFZ: true,
				videoId: videoId,
				url: "https://youtube.com/?v="+videoId,
				channelId: channelId
			}, function (response) {
				if (chrome.runtime.lastError) {
					console.log('FFZ request error:', chrome.runtime.lastError.message);
				}
			});
		}
	}

	function processMessageQueue() {
		if (isProcessingQueue || messageQueue.length === 0) {
			return;
		}
		
		isProcessingQueue = true;
		
		// Get a batch of messages
		var batch = messageQueue.splice(0, BATCH_SIZE);
		
		try {
			// Send batch or single message based on size
			var payload = batch.length === 1 ? 
				{ "message": batch[0] } : 
				{ "messages": batch };
				
			chrome.runtime.sendMessage(chrome.runtime.id, payload, function(response) {
				// Check for errors
				if (chrome.runtime.lastError) {
					console.warn('Runtime error:', chrome.runtime.lastError.message);
					// Log dropped messages but don't retry to avoid duplicates
					console.warn('Dropping messages due to error:', batch.length, 'messages');
				}
				
				isProcessingQueue = false;
				
				// Process next batch if there are more messages
				if (messageQueue.length > 0) {
					setTimeout(processMessageQueue, BATCH_DELAY);
				}
			});
		} catch(e) {
			console.error('Error sending message batch to socialstream:', e);
			// Log dropped messages but don't retry to avoid duplicates
			console.warn('Dropping messages due to exception:', batch.length, 'messages');
			isProcessingQueue = false;
			
			// Continue processing remaining messages
			if (messageQueue.length > 0) {
				setTimeout(processMessageQueue, BATCH_DELAY);
			}
		}
	}

	window.addEventListener('youtubeMessage', function(e) {
		if (e.detail) {
			// Add to queue instead of sending immediately
			messageQueue.push(e.detail);
			
			// Start processing if not already running
			if (!isProcessingQueue) {
				// Small delay to allow more messages to accumulate
				setTimeout(processMessageQueue, 10);
			}
		}
	});
	window.addEventListener('youtubeVideoChanged', function(e) {
		if (e.detail && (e.detail.videoId || e.detail.channelId)) {
			console.log('Video changed:', e.detail);
			requestEmotesForVideo(e.detail.videoId, e.detail.channelId);
		}
	});

	function deepMerge(target, source) {
	  for (let key in source) {
		if (source.hasOwnProperty(key)) {
		  if (typeof source[key] === 'object' && source[key] !== null) {
			target[key] = target[key] || {};
			deepMerge(target[key], source[key]);
		  } else {
			target[key] = source[key];
		  }
		}
	  }
	  return target;
	}


	function mergeEmotes() { // BTTV takes priority over 7TV in this all.
		EMOTELIST = {};
		
		if (BTTV) {
			if (settings.bttv) {
				try {
					if (BTTV.channelEmotes) {
						EMOTELIST = BTTV.channelEmotes;
					}
					if (BTTV.sharedEmotes) {
						EMOTELIST = deepMerge(BTTV.sharedEmotes, EMOTELIST);
					}
					if (BTTV.globalEmotes) {
						EMOTELIST = deepMerge(BTTV.globalEmotes, EMOTELIST);
					}
				} catch (e) {console.warn(e);}
			}
		}
		if (SEVENTV) {
			if (settings.seventv) {
				try {
					if (SEVENTV.channelEmotes) {
						EMOTELIST = deepMerge(SEVENTV.channelEmotes, EMOTELIST);
					}
				} catch (e) {}
				try {
					if (SEVENTV.globalEmotes) {
						EMOTELIST = deepMerge(SEVENTV.globalEmotes, EMOTELIST);
					}
				} catch (e) {}
			}
		}
		if (FFZ) {
			if (settings.ffz) {
				try {
					if (FFZ.channelEmotes) {
						EMOTELIST = deepMerge(FFZ.channelEmotes, EMOTELIST);
					}
				} catch (e) {}
				try {
					if (FFZ.globalEmotes) {
						EMOTELIST = deepMerge(FFZ.globalEmotes, EMOTELIST);
					}
				} catch (e) {}
			}
		}
		if (EMOTELIST){
			window.dispatchEvent(new CustomEvent('settingsChanged', {
				detail: { EMOTELIST: EMOTELIST },
				bubbles: true
			}));
		}
	}


	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if ("getSource" == request) {
				sendResponse("youtube");
				return;
			}
			if ("focusChat" == request) {
				document.querySelector('#input-text').focus();
				sendResponse(true);
				return;
			}
			if (typeof request === "object") {
				if ("state" in request) {
					isExtensionOn = request.state;
				}
				if ("settings" in request) {
					settings = request.settings;
					
					// Send all settings to the page
					window.dispatchEvent(new CustomEvent('settingsChanged', {
						detail: settings,
						bubbles: true
					}));
					
					sendResponse(true);
					
					if (settings.bttv && !BTTV) {
						chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true }, function (response) {
							if (chrome.runtime.lastError) {
								console.log('BTTV request error:', chrome.runtime.lastError.message);
							}
						});
					}
					if (settings.seventv && !SEVENTV) {
						chrome.runtime.sendMessage(chrome.runtime.id,  { getSEVENTV: true }, function (response) {
							if (chrome.runtime.lastError) {
								console.log('7TV request error:', chrome.runtime.lastError.message);
							}
						});
					}
					if (settings.ffz && !FFZ) {
						chrome.runtime.sendMessage(chrome.runtime.id,  { getFFZ: true }, function (response) {
							if (chrome.runtime.lastError) {
								console.log('FFZ request error:', chrome.runtime.lastError.message);
							}
						});
					}
					return;
				}
				if ("SEVENTV" in request) {
					SEVENTV = request.SEVENTV;
					sendResponse(true);
					mergeEmotes();
					return;
				}
				if ("BTTV" in request) {
					BTTV = request.BTTV;
					sendResponse(true);
					mergeEmotes();
					return;
				}
				if ("FFZ" in request) {
					FFZ = request.FFZ;
					sendResponse(true);
					mergeEmotes();
					return;
				}
			}
		} catch(e) {
			console.error('Error handling Chrome message:', e);
		}
		sendResponse(false);
	});

	try {
		chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
			console.log(response);
			if (chrome.runtime.lastError) {
				console.log('getSettings error:', chrome.runtime.lastError.message);
				return;
			}
			if (!response) return;
			
			if ("settings" in response) {
				settings = response.settings;
				
				// Send all settings to the page
				window.dispatchEvent(new CustomEvent('settingsChanged', {
					detail: { settings: settings },
					bubbles: true
				}));

				if (settings.bttv && !BTTV) {
					chrome.runtime.sendMessage(chrome.runtime.id, { getBTTV: true }, function (response) {
						if (chrome.runtime.lastError) {
							console.log('BTTV request error:', chrome.runtime.lastError.message);
						}
					});
				}
				if (settings.seventv && !SEVENTV) {
					chrome.runtime.sendMessage(chrome.runtime.id, { getSEVENTV: true }, function (response) {
						if (chrome.runtime.lastError) {
							console.log('7TV request error:', chrome.runtime.lastError.message);
						}
					});
				}
				if (settings.ffz && !FFZ) {
					chrome.runtime.sendMessage(chrome.runtime.id, { getFFZ: true }, function (response) {
						if (chrome.runtime.lastError) {
							console.log('FFZ request error:', chrome.runtime.lastError.message);
						}
					});
				}
			}
			if ("state" in response) {
				isExtensionOn = response.state;
			}
		});
	} catch(e) {
		console.error('Error requesting settings from extension:', e);
	}

	console.log("INJECTED YOUTUBE INTEGRATION");
});