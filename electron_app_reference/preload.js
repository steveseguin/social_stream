var { ipcRenderer, contextBridge } = require('electron');

const WARN_FILTER_PATTERNS = [
    /Potential permissions policy violation/i,
    /Unrecognized feature/i,
    /Electron Security Warning/i
];

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
    try {
        const message = args.map((part) => {
            if (typeof part === 'string') return part;
            if (part instanceof Error && part.message) return part.message;
            return JSON.stringify(part);
        }).join(' ');

        if (WARN_FILTER_PATTERNS.some((pattern) => pattern.test(message))) {
            return;
        }
    } catch (_) {
        // Fall through to original handler on parsing issues
    }
    return originalConsoleWarn(...args);
};

// Debug flag for troubleshooting
const PRELOAD_DEBUG = false; // Set to true for debugging

// Get the random flag for this session
let INJECTED_SCRIPT_FLAG = null;
(async () => {
    INJECTED_SCRIPT_FLAG = await ipcRenderer.invoke('get-injected-script-flag');
    if (PRELOAD_DEBUG) {
        console.log('[Preload] Got injected script flag:', INJECTED_SCRIPT_FLAG);
    }
})();

window.addEventListener('DOMContentLoaded', () => {
	const replaceText = (selector, text) => {
		const element = document.getElementById(selector)
		if (element) element.innerText = text
	}
	for (const type of ['chrome', 'node', 'electron']) {
		replaceText(`${type}-version`, process.versions[type])
	}
})

// Generate a unique token for this session
const MESSAGE_AUTH_TOKEN = 'ssn_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

// Security: Only accept messages from our injected scripts with proper authentication
window.addEventListener('message', (event) => {
	// The injected scripts run in the same window, so we can't filter by source
	// We rely on authentication tokens and message structure validation instead
	
	// Check if the message has our expected structure
	const { data } = event;
	if (!data || typeof data !== 'object') {
		return;
	}
	
	
	// Debug logging
	if (PRELOAD_DEBUG && (data._authToken || data.message || data.getSettings)) {
		console.log('[Preload] Received postMessage:', { 
			hasAuthToken: !!data._authToken, 
			authTokenPrefix: data._authToken ? data._authToken.substring(0, 20) : 'none',
			hasMessage: !!data.message,
			hasGetSettings: !!data.getSettings,
			keys: Object.keys(data)
		});
	}
	
    // Fast-path: forward lightweight WSS status messages (no token required)
    if (data && data.wssStatus) {
        try { ipcRenderer.send('postMessage', data); } catch(_) {}
        return;
    }

    // Check for authentication token (for new secure messages)
    if (data._authToken === MESSAGE_AUTH_TOKEN) {
		// Remove token before forwarding
		const messageData = { ...data };
		delete messageData._authToken;
		
		// Check if this message needs a response
		const needsResponse = messageData._needsResponse;
		const messageId = messageData._messageId;
		delete messageData._needsResponse;
		delete messageData._messageId;
		
		if (needsResponse && messageId) {
			// Send with callback expectation
			const response = ipcRenderer.sendSync('postMessage', messageData);
			
			// Send response back via postMessage
			window.postMessage({
				_isResponse: true,
				_messageId: messageId,
				response: response
			}, '*');
		} else {
			// Send without expecting response
			ipcRenderer.send('postMessage', messageData);
		}
		return;
	}
	
	// Support for injected scripts that can't access contextBridge
	if (INJECTED_SCRIPT_FLAG && data[INJECTED_SCRIPT_FLAG]) {
		// Remove the flag before forwarding
		delete data[INJECTED_SCRIPT_FLAG];
		
		// Extract tab ID if provided
		const tabID = data.__tabID__;
		delete data.__tabID__;
		
		// Re-add tabID if it was present
		if (tabID !== undefined && tabID !== null) {
			data.__tabID__ = tabID;
		}
		
		// Send the message
		ipcRenderer.send('postMessage', data);
		return;
	}
	
    // Legacy support: Only forward messages that have our expected properties
    // This prevents arbitrary messages from the page being forwarded
    // TODO: Eventually remove this once all scripts are updated to use auth tokens
    if (data.wssStatus || data.message || data.delete || data.getSettings || data.getBTTV || 
        data.getSEVENTV || data.getFFZ || data.cmd || data.type === 'toBackground') {
        ipcRenderer.send('postMessage', data);
    }
});

window.addEventListener('error', (event) => {
  console.error('Script error:', event.error);
});

/* window.alert = alert = function(title, val){
	log("window.alert");
	return ipcRenderer.send('alert', {title, val}); // call if needed in the future
}; */

var actualHandler = null;
var doSomethingInWebApp = function(callback){
	//console.log("doSomethingInWebApp registration called with:", typeof callback);
	if (callback){
		//console.log("Registering handler - success!");
		actualHandler = callback;
	}
};

// Create a wrapper that always delegates to the current handler
var doSomethingInWebAppWrapper = function(message, sender, sendResponse) {
	if (actualHandler) {
		actualHandler(message, sender, sendResponse);
	} else {
		console.warn("doSomethingInWebApp: No handler registered yet, message dropped:", message);
	}
};
function configureContextBridge(){
	try {
		const effectiveLocale = process.env.SSAPP_LOCALE_EFFECTIVE || 'en-US';
		const acceptLanguageHeader = process.env.SSAPP_ACCEPT_LANGUAGE || 'en-US,en;q=0.9';
		const localeSource = process.env.SSAPP_LOCALE_SOURCE || 'system';
		// Always expose to main world, regardless of whether it exists in isolated context
		contextBridge.exposeInMainWorld('ninjafy', {
			
		  // Expose the auth token directly as a property
		  _authToken: MESSAGE_AUTH_TOKEN,
		  
		  exposeDoSomethingInWebApp: doSomethingInWebApp,
		  
		  checkUrlMatching: (url) => {
			// checkSupported is not available in preload context
			return false;
		  },
		  
		  sendMessage: function(ignore=null, data=null, callback=false, tabID=false) {
			// Add authentication token to messages
			const authenticatedData = { ...data, _authToken: MESSAGE_AUTH_TOKEN };
			
			// Add tabID if provided (maintaining security - only injected scripts have access to valid tabIDs)
			if (tabID !== false && tabID !== null && tabID !== undefined) {
				authenticatedData.__tabID__ = tabID;
			}
			
			if (callback) {
			  const response = ipcRenderer.sendSync('postMessage', authenticatedData);
			  callback(response);
			} else {
			  ipcRenderer.send('postMessage', authenticatedData);
			}
		  },
		  
		  // Expose auth token getter for injected scripts that use window.postMessage directly
		  getAuthToken: () => MESSAGE_AUTH_TOKEN,
		  _authToken: MESSAGE_AUTH_TOKEN,
		  
		  // Expose the injected script flag
		  getInjectedScriptFlag: () => INJECTED_SCRIPT_FLAG,
			  
			  closeFileStream: async () => {
				await ipcRenderer.invoke('close-file-stream');
			  },
			  
			  onCloseFileStream: (callback) => {
				  ipcRenderer.on('close-file-stream', async () => {
					callback();
				  });
			  },
			  
			  tts: async (text, settings) => {
				return await ipcRenderer.invoke('tts', {text, settings});
			  },
			  
			  onSendToTab: (callback) => {
				ipcRenderer.on('sendToTab', (event, ...args) => {
				  callback(args[0]);
				});
			  },
			  
			  onPostMessage: (callback) => {
				ipcRenderer.on('postMessage', (event, ...args) => {
				  callback(args[0]);
				});
			  },
			  
			  onWebSocketMessage: (callback) => {
				ipcRenderer.on('websocket-message', (event, data) => {
				  callback(data);
				});
			  },
			  
			  sendDeviceList: (response) => {
				ipcRenderer.send('deviceList', response);
			  },
			  
			 'updateVersion' : function (version) { // window.ninjafy.updateVersion(session.version);
				 console.log("Version: "+version);
			  },
			  
			  'updatePPT' : function (PPTHotkey) {},
			  
			  noCORSFetch: (args) => {},
			  
			  readStreamChunk: (streamId) => {},
			  
			  closeStream: (streamId) => {},
			  
			  // Performance monitoring
			  requestPerformanceData: async () => {
				return await ipcRenderer.invoke('getPerformanceMetrics');
			  },
			  
			  onPerformanceData: (callback) => {
				ipcRenderer.on('performance-data', (event, data) => {
				  callback(data);
				});
			  }
			});
		contextBridge.exposeInMainWorld('ssappLocale', {
			locale: effectiveLocale,
			acceptLanguage: acceptLanguageHeader,
			source: localeSource,
			getLocale: () => effectiveLocale,
			getAcceptLanguage: () => acceptLanguageHeader,
			getSource: () => localeSource
		});
	} catch(e){
		// Silently fail if context isolation is disabled - this is expected
		if (!e.message || !e.message.includes('contextBridge API can only be used when contextIsolation is enabled')) {
			console.error('[Preload] Error configuring context bridge:', e);
		}
		throw e; // Re-throw to be caught by outer try-catch
	}
}
// Only configure context bridge if context isolation is enabled
// When context isolation is disabled, we can access window directly
try {
	// Try to use contextBridge - this will throw if contextIsolation is false
	configureContextBridge();
} catch (e) {
	if (e.message && e.message.includes('contextBridge API can only be used when contextIsolation is enabled')) {
		// Context isolation is disabled - expose ninjafy directly on window
		window.ninjafy = {
			// Expose the auth token directly as a property
			_authToken: MESSAGE_AUTH_TOKEN,
			
			getInjectedScriptFlag: () => INJECTED_SCRIPT_FLAG,
			
			sendMessage: (a, b, c, tabID) => {
				const messageData = b || a;
				
				// When tabID is provided, this is a message that should be routed to the background
				// via postMessage handler, not directly to a tab
				const outgoingData = { ...messageData };
				if (tabID !== undefined && tabID !== null && tabID !== false) {
					outgoingData.__tabID__ = tabID;
				}
				
				// If callback is provided, use synchronous IPC to get response
				if (c) {
					const response = ipcRenderer.sendSync('postMessage', outgoingData);
					c(response);
				} else {
					// No callback, send asynchronously
					ipcRenderer.send('postMessage', outgoingData);
				}
			},
			
			onWebSocketMessage: (callback) => {
				ipcRenderer.on('websocket-message', (event, data) => {
				  callback(data);
				});
			},
			
			// Add other necessary methods
			exposeDoSomethingInWebApp: (callback) => {
				window.doSomethingInWebApp = callback;
			},
			
			sendDeviceList: (response) => {
				ipcRenderer.send('deviceList', response);
			},
			
			updateVersion: function (version) {
				console.log("Version: "+version);
			}
		};
		window.ssappLocale = {
			locale: process.env.SSAPP_LOCALE_EFFECTIVE || 'en-US',
			acceptLanguage: process.env.SSAPP_ACCEPT_LANGUAGE || 'en-US,en;q=0.9',
			source: process.env.SSAPP_LOCALE_SOURCE || 'system',
			getLocale() { return this.locale; },
			getAcceptLanguage() { return this.acceptLanguage; },
			getSource() { return this.source; }
		};
	} else {
		console.error('[Preload] Unexpected error configuring context bridge:', e);
	}
}


// Handle sendToTab-request messages that expect a response
ipcRenderer.on('sendToTab-request', (event, data) => {
	//console.log("SEND TO TAB REQUEST", data);
	const { message, requestId } = data;
	
	// Call the handler and send back the response
	doSomethingInWebAppWrapper(message, null, function(response) {
		// Send the response back to main process
		ipcRenderer.send(`sendToTab-response-${requestId}`, response);
	});
});

// Handle regular sendToTab messages (no response expected)
ipcRenderer.on('sendToTab', (event, ...args) => {
	//console.log("SEND TO TAB 2");
	doSomethingInWebAppWrapper(args[0], null, function(response){});
});

ipcRenderer.on('postMessage', (event, ...args) => { // GOT MESSAGE FROM MAIN.JS
	try {
		
		if ("doSomething" in args[0]){
			if (args[0].node){ // run it directly, using NODE mode.
			} else { // run it in the page via Electron API
				var fauxEvent = {};
				fauxEvent.data = {};
				fauxEvent.data.doSomething = true;
				doSomethingInWebAppWrapper(fauxEvent, null, function(){});
			}
			return;
		}
		
		if ("eval" in args[0]){
			if (args[0].node){
				eval(args[0].eval);
			} else {
				var fauxEvent = {};
				fauxEvent.data = {};
				fauxEvent.data.eval = args[0].eval;
				doSomethingInWebAppWrapper(fauxEvent, null, function(){});
			}
			return;
		}
		
		if ("getDeviceList" in args[0]) {
			
			var response = {};
			
			if (typeof enumerateDevices === "function"){
				enumerateDevices().then(function(deviceInfos) {
					response.deviceInfos = deviceInfos;
					response = JSON.parse(JSON.stringify(response));
					ipcRenderer.send('deviceList', response);
				})
			} else {
				requestOutputAudioStream().then(function(deviceInfos) {
					
					response.deviceInfos = deviceInfos;
					response = JSON.parse(JSON.stringify(response));
					ipcRenderer.send('deviceList', response);
					
				})
			}
		}
		
	} catch(e){
		console.error(e);
	}
})


function setSink(ele, id){
	ele.setSinkId(id).then(() => {
		console.log("New Output Device:" + id);
	}).catch(error => {
		console.error(error);
	});
}


var hello  = true;

function changeAudioOutputDeviceByIdThirdParty(deviceID){
	console.log("Output deviceID: "+deviceID);
	
	document.querySelectorAll("audio, video").forEach(ele=>{
		try {
			if (ele.manualSink){
				setSink(ele,ele.manualSink);
			} else {
				setSink(ele,deviceID);
			}
		} catch(e){}
	});
	document.querySelectorAll('iframe').forEach( item =>{
		try{
			item.contentWindow.document.body.querySelectorAll("audio, video").forEach(ele=>{
				try {
					if (ele.manualSink){
						setSink(ele,ele.manualSink);
					} else {
						setSink(ele,deviceID);
					}
				} catch(e){}
			});
		} catch(e){}
	});	
	
}

function enumerateDevicesThirdParty() {
	if (typeof navigator.enumerateDevices === "function") {
		return navigator.enumerateDevices();
	} else if (typeof navigator.mediaDevices === "object" && typeof navigator.mediaDevices.enumerateDevices === "function") {
		return navigator.mediaDevices.enumerateDevices();
	} else {
		return new Promise((resolve, reject) => {
			try {
				if (window.MediaStreamTrack == null || window.MediaStreamTrack.getSources == null) {
					throw new Error();
				}
				window.MediaStreamTrack.getSources((devices) => {
					resolve(devices
						.filter(device => {
							return device.kind.toLowerCase() === "video" || device.kind.toLowerCase() === "videoinput";
						})
						.map(device => {
							return {
								deviceId: device.deviceId != null ? device.deviceId : ""
								, groupId: device.groupId
								, kind: "videoinput"
								, label: device.label
								, toJSON: /*  */ function() {
									return this;
								}
							};
						}));
				});
			} catch (e) {}
		});
	}
}

function requestOutputAudioStream() {
	console.log("requestOutputAudioStream");
	return navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(function(stream) { // Apple needs thi to happen before I can access EnumerateDevices. 
		return enumerateDevicesThirdParty().then(function(deviceInfos) {
			console.log("enumerateDevicesThirdParty");
			stream.getTracks().forEach(function(track) { // We don't want to keep it without audio; so we are going to try to add audio now.
				track.stop(); // I need to do this after the enumeration step, else it breaks firefox's labels
			});
			console.log(deviceInfos);
			return deviceInfos;
		});
	});
}
