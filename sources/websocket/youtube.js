
// --- APPEND-ONLY: YouTube WSS status hooks (non-invasive) ---
(function(){
  try {
    if (window.__YT_WSS_STATUS_PATCH__) return; // idempotent
    window.__YT_WSS_STATUS_PATCH__ = true;

    var TAB_ID = (typeof window.__SSAPP_TAB_ID__ !== 'undefined') ? window.__SSAPP_TAB_ID__ : null;

    function __ssNotifyApp(status, message){
      try {
        var payload = { wssStatus: { platform: 'youtube', status: status, message: message } };
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
          window.chrome.runtime.sendMessage(window.chrome.runtime.id, payload, function(){});
        } else if (window.ninjafy && window.ninjafy.sendMessage) {
          window.ninjafy.sendMessage(null, payload, null, TAB_ID);
        } else {
          // Plain postMessage fallback
          var data = Object.assign({}, payload);
          if (TAB_ID !== null) data.__tabID__ = TAB_ID;
          window.postMessage(data, '*');
        }
      } catch(e) { /* noop */ }
    }

    // Optional: expose for upstream usage
    window.ssWssNotify = __ssNotifyApp;

    // 1) Initial sign-in check
    function initialCheck(){
      try {
        var hasToken = !!localStorage.getItem('youtubeOAuthToken');
        if (!hasToken) __ssNotifyApp('signin_required','Sign in with YouTube to continue');
      } catch(_){}
    }

    // 2) Watch for live chat connect/disconnect via global liveChatId
    function watchLiveChat(){
      try {
        var prev = null;
        setInterval(function(){
          try {
            var cur = (typeof window.liveChatId !== 'undefined') ? window.liveChatId : null;
            if (cur && !prev) __ssNotifyApp('connected','Connected to YouTube live chat');
            if (!cur && prev) __ssNotifyApp('disconnected','Disconnected from YouTube live chat');
            prev = cur;
          } catch(_){}
        }, 1500);
      } catch(_){}
    }

    // 3) Patch fetch for YouTube Data API errors and forward as error status
    function patchFetchErrors(){
      try {
        if (window.__ss_fetch_patched__) return; window.__ss_fetch_patched__ = true;
        var _orig = window.fetch;
        if (typeof _orig !== 'function') return;
        var lastAt = 0;
        var throttle = 3000; // 3s
        var ping = function(status, msg){
          var now = Date.now();
          if (now - lastAt > throttle) { __ssNotifyApp('error', msg || ('YouTube API error: ' + status)); lastAt = now; }
        };
        window.fetch = async function(input, init){
          try {
            var res = await _orig(input, init);
            var url = (typeof input === 'string') ? input : (input && input.url) || '';
            if (url.indexOf('googleapis.com/youtube') !== -1 || url.indexOf('youtube.googleapis.com') !== -1){
              if (!res.ok){
                var msg = 'YouTube API ' + res.status;
                try {
                  var body = await res.clone().json().catch(function(){ return null; });
                  if (body && body.error) {
                    var emsg = body.error.message || '';
                    var reason = (body.error.errors && body.error.errors[0] && body.error.errors[0].reason) || '';
                    if (emsg) msg = emsg;
                    if (reason) msg += ' (' + reason + ')';
                  }
                } catch(e){}
                ping(res.status, msg);
              }
            }
            return res;
          } catch(e){
            ping('network_error', (e && e.message) ? e.message : 'Network error');
            throw e;
          }
        };
      } catch(_){}
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(initialCheck, 0);
    } else {
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(initialCheck, 0); });
    }
    watchLiveChat();
    patchFetchErrors();
  } catch(e){}
})();
// --- END APPEND-ONLY BLOCK ---

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

window.addEventListener('youtubeDelete', function(e) {
	if (!e.detail) {
		return;
	}
	try {
		chrome.runtime.sendMessage(chrome.runtime.id, { delete: e.detail }, function() {
			if (chrome.runtime.lastError) {
				console.warn('Runtime error forwarding delete to Social Stream:', chrome.runtime.lastError.message);
			}
		});
	} catch (err) {
		console.error('Error forwarding delete event:', err);
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
