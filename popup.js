// popup.js

function normalizePopupTranslationLanguage(lang) {
	if (!lang || typeof lang !== "string") return "";
	const trimmed = lang.trim();
	if (!trimmed) return "";
	const lower = trimmed.toLowerCase();
	if (lower === "test") return "test";
	if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans") return "zh-CN";
	if (lower === "zh-tw" || lower === "zh-hk" || lower === "zh-hant") return "zh-TW";
	if (lower === "en-gb" || lower === "en-uk") return "en-uk";
	if (lower === "en" || lower.startsWith("en-")) return "en-us";
	if (lower === "pt-br" || lower.startsWith("pt")) return "pt-br";
	if (lower.startsWith("es")) return "es";
	if (lower.startsWith("de")) return "de";
	if (lower.startsWith("cs")) return "cs";
	if (lower.startsWith("th")) return "th";
	if (lower.startsWith("tr")) return "tr";
	if (lower.startsWith("uk")) return "uk";
	return "";
}

let pendingExternalTranslationLanguage = "";
let latestExternalTranslationApply = "";
let requestedImmediateTranslationLanguage = "";
let appliedImmediateTranslationLanguage = "";

function refreshPopupSettingsAfterLanguageSave() {
	if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
		return false;
	}
	chrome.runtime.sendMessage({ cmd: "getSettings" }, function(response) {
		if (response && response.settings) {
			update(response, false);
		}
	});
	return true;
}

function applyPopupTranslationLanguageImmediately(lang) {
	const normalized = normalizePopupTranslationLanguage(lang);
	if (!normalized || typeof fetch !== "function") return false;
	if (requestedImmediateTranslationLanguage === normalized || appliedImmediateTranslationLanguage === normalized) return true;
	requestedImmediateTranslationLanguage = normalized;
	const applyToken = `${normalized}:${Date.now()}:${Math.random()}`;
	latestExternalTranslationApply = applyToken;
	fetch(`./translations/${encodeURIComponent(normalized)}.json`, { cache: "no-store" })
		.then(function(response) {
			if (!response || response.status !== 200) return null;
			return response.json();
		})
		.then(function(data) {
			if (!data || latestExternalTranslationApply !== applyToken) return;
			translation = data;
			appliedImmediateTranslationLanguage = normalized;
			requestedImmediateTranslationLanguage = "";
			if (lastResponse && lastResponse.settings) {
				lastResponse.settings.translation = data;
			}
			miniTranslate(document.body);
		})
		.catch(function(error) {
			if (requestedImmediateTranslationLanguage === normalized) {
				requestedImmediateTranslationLanguage = "";
			}
			console.warn("Failed to apply popup translation immediately:", error && error.message ? error.message : error);
		});
	return true;
}

function savePopupTranslationLanguage(lang, options = {}) {
	const normalized = normalizePopupTranslationLanguage(lang);
	if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
		return false;
	}
	chrome.runtime.sendMessage({
		cmd: "saveSetting",
		type: "optionsetting",
		setting: "translationlanguage",
		value: normalized
	}, function() {
		console.log("Language setting saved", normalized || "default");
		if (typeof options.onSaved === "function") {
			options.onSaved(normalized);
		}
		if (options.reload !== false) {
			window.location.reload();
		} else if (options.refreshSettings !== false) {
			refreshPopupSettingsAfterLanguageSave();
		}
	});
	return true;
}

function applyExternalTranslationLanguage(lang, options = {}) {
	const normalized = normalizePopupTranslationLanguage(lang);
	const languageSelect = document.querySelector('select[data-optionsetting="translationlanguage"]');
	if (!languageSelect) return false;
	const current = normalizePopupTranslationLanguage(languageSelect.value);
	if (current === normalized) {
		if (options.reload !== true) {
			applyPopupTranslationLanguageImmediately(normalized);
		}
		return false;
	}
	languageSelect.value = normalized;
	if (options.reload !== true && pendingExternalTranslationLanguage === normalized) return false;
	if (options.reload !== true) {
		pendingExternalTranslationLanguage = normalized;
		applyPopupTranslationLanguageImmediately(normalized);
	}
	const saveStarted = savePopupTranslationLanguage(normalized, {
		reload: options.reload === true,
		refreshSettings: true,
		onSaved: function(savedLanguage) {
			if (pendingExternalTranslationLanguage === savedLanguage) {
				pendingExternalTranslationLanguage = "";
			}
		}
	});
	if (!saveStarted && pendingExternalTranslationLanguage === normalized) {
		pendingExternalTranslationLanguage = "";
	}
	return saveStarted;
}

// Listen for language change messages from parent window
window.addEventListener('message', function(event) {
	if (event.data && event.data.type === 'changeLanguage') {
		console.log('Received language change message:', event.data.language);
		applyExternalTranslationLanguage(event.data.language, { reload: false });
	}
});

(function (w) {
	w.URLSearchParams = w.URLSearchParams || function (searchString) {
		var self = this;
		self.searchString = searchString;
		self.get = function (name) {
			var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(self.searchString);
			if (results == null) {
				return null;
			} else {
				return decodeURI(results[1]) || 0;
			}
		};
	};

})(window);

var urlParams = new URLSearchParams(window.location.search);
const devmode = urlParams.has("devmode");
var sourcemode = urlParams.get("sourcemode") || false;
var ssapp = false;

if (urlParams.has("ssapp")) {
	ssapp = true;
}

if (typeof window !== "undefined") {
	window.ssapp = ssapp;
}

var isExtensionOn = false;
var USERNAMES = [];

const HANDLE_STATUS_STATES = {
	ACTIVE: "active",
	READY: "ready",
	MISSING: "missing",
	NEEDS_PERMISSION: "needs-permission",
	ERROR: "error"
};
const HANDLE_STATUS_KEYS = ["ticker", "chatLog", "savedNames"];
const HANDLE_STATUS_LABELS = {
	ticker: "Ticker source",
	chatLog: "Last message file",
	savedNames: "Names log"
};
const HANDLE_STATUS_HELP = {
	ticker: "Select a ticker source file to stream text",
	chatLog: "Choose where the last message should be saved",
	savedNames: "Choose where unique chat names should be stored"
};
const popupHandleStatusState = {};
HANDLE_STATUS_KEYS.forEach((key) => {
	popupHandleStatusState[key] = createPopupHandleStatus();
});

function createPopupHandleStatus(overrides = {}) {
	return Object.assign({
		name: null,
		status: HANDLE_STATUS_STATES.MISSING,
		detail: "",
		persisted: false
	}, overrides);
}

function areHandleStatusEntriesEqual(a = {}, b = {}) {
	const fields = ["name", "status", "detail", "persisted"];
	return fields.every((field) => (a[field] || null) === (b[field] || null));
}

function mergeHandleStatusFromBackground(statusMap = {}) {
	let changed = false;
	Object.keys(statusMap || {}).forEach((key) => {
		if (!popupHandleStatusState[key]) {
			popupHandleStatusState[key] = createPopupHandleStatus();
		}
		const existing = popupHandleStatusState[key];
		const incoming = statusMap[key] || {};
		const merged = { ...existing, ...incoming };
		if (!areHandleStatusEntriesEqual(existing, merged)) {
			popupHandleStatusState[key] = merged;
			changed = true;
		}
	});
	if (changed) {
		renderHandleStatus();
	}
}

function getHandleStatusLabel(key, entry) {
	const fallback = HANDLE_STATUS_LABELS[key] || "Selected file";
	const fileName = entry.name || fallback;
	switch (entry.status) {
		case HANDLE_STATUS_STATES.ACTIVE:
			return `Active: ${fileName}`;
		case HANDLE_STATUS_STATES.READY:
			return `Ready: ${fileName}`;
		case HANDLE_STATUS_STATES.NEEDS_PERMISSION:
			return entry.name ? `Needs permission: ${entry.name}` : "Needs permission";
		case HANDLE_STATUS_STATES.ERROR:
			return entry.name ? `Error: ${entry.name}` : "File error";
		default:
			return "No file selected";
	}
}

function getHandleStatusDetail(key, entry) {
	if (entry.detail) {
		return entry.detail;
	}
	if (entry.status === HANDLE_STATUS_STATES.MISSING) {
		return HANDLE_STATUS_HELP[key] || "";
	}
	if (!entry.persisted && (entry.status === HANDLE_STATUS_STATES.ACTIVE || entry.status === HANDLE_STATUS_STATES.READY)) {
		return "Needs to be selected again after reloading.";
	}
	return "";
}

function renderHandleStatus() {
	document.querySelectorAll("[data-handle-status]").forEach((node) => {
		const key = node.dataset.handleStatus;
		const entry = popupHandleStatusState[key] || createPopupHandleStatus();
		const status = entry.status || HANDLE_STATUS_STATES.MISSING;
		node.dataset.status = status;
		node.dataset.persisted = entry.persisted ? "true" : "false";
		const labelNode = node.querySelector(".status-label");
		if (labelNode) {
			labelNode.textContent = getHandleStatusLabel(key, entry);
		}
		const detailNode = node.querySelector(".status-detail");
		if (detailNode) {
			const detailText = getHandleStatusDetail(key, entry);
			detailNode.textContent = detailText;
			detailNode.style.display = detailText ? "" : "none";
		}
	});
}

if (document.readyState === "complete" || document.readyState === "interactive") {
	renderHandleStatus();
} else {
	document.addEventListener("DOMContentLoaded", renderHandleStatus);
}

// Function to open Event Flow Editor
function openEventFlowEditor() {
    if (ssapp) {
        // In ssapp context, the remote actions/index.html is disconnected from the local context
        // Try to tell ssapp to switch to the editor view via postMessage
        try {
            window.parent.postMessage({ action: 'switchToEventFlowEditor' }, '*');
        } catch (e) {
            console.warn('Could not send postMessage to parent:', e);
        }
        // Also show message for older ssapp versions that don't have the listener yet
        alert('In the desktop app, use the 🪤 Event Flow Editor option in the navigation menu.');
        return;
    }
    // For extension context, open actions/index.html
    window.open('actions/index.html', '_blank');
}
// Make function available globally
window.openEventFlowEditor = openEventFlowEditor;
var WebMidi = null;
var webMidiInitialized = false;
var webMidiScriptLoaded = false;

function log(msg,a,b){
	console.log(msg,a,b);
}

function showSpotifyAuthToast(level, title, message) {
	const normalizedLevel = ['error', 'warning', 'info', 'success'].includes(level) ? level : 'info';
	try {
		if (typeof Toast !== 'undefined' && typeof Toast[normalizedLevel] === 'function') {
			Toast[normalizedLevel](title, message);
			return true;
		}
	} catch (_) {}
	try {
		if (window.parent && window.parent !== window && window.parent.Toast && typeof window.parent.Toast[normalizedLevel] === 'function') {
			window.parent.Toast[normalizedLevel](title, message);
			return true;
		}
	} catch (_) {}
	return false;
}

function getSpotifyAuthTroubleshootingText(result = null) {
	let text = 'Please ensure:\n'
		+ '1. Spotify integration is enabled\n'
		+ '2. Client ID and Secret are filled in\n'
		+ '3. Your redirect URIs are configured in Spotify app settings\n'
		+ '4. The app owner has active Premium, the playback account is Premium, and that account is listed as an authorized Development Mode user (new app limits began February 11, 2026; existing app limits began March 9, 2026).';
	if (result?.errorCode) {
		text += `\n5. OAuth error code: ${result.errorCode}`;
	}
	if (result?.redirectUriAttempted) {
		text += `\n6. Redirect URI attempted: ${result.redirectUriAttempted}`;
	}
	if (Array.isArray(result?.expectedRedirectUris) && result.expectedRedirectUris.length) {
		text += `\n7. Expected redirect URIs:\n- ${result.expectedRedirectUris.join('\n- ')}`;
	}
	return text;
}

function getSpotifyAuthErrorMessage(result) {
	if (!result || typeof result !== 'object') {
		return 'Unknown error';
	}
	return result.message || result.error || 'Unknown error';
}

function handleSpotifyAuthResultFromBackground(result) {
	const spotifyAuthButton = document.getElementById('spotifyAuthButton');
	if (!spotifyAuthButton) {
		return;
	}

	const spotifyAuthStatus = document.getElementById('spotifyAuthStatus');
	const spotifySignOutButton = document.getElementById('spotifySignOutButton');
	const callbackDiv = document.getElementById('spotifyCallbackDiv');
	const manualLinkContainer = document.getElementById('spotifyManualLinkContainer');
	const manualLinkField = document.getElementById('spotifyManualAuthUrl');
	const callbackInput = document.getElementById('spotifyCallbackInput');

	console.log('Spotify auth result from background:', result);
	if (result?.waitingForManualCallback || result?.waitingForCallback) {
		spotifyAuthButton.disabled = true;
		if (spotifyAuthButton.querySelector('span')) {
			spotifyAuthButton.querySelector('span').textContent = '⏳ Waiting for authorization...';
		}

		if (callbackDiv) {
			const waitingForManual = !!result.waitingForManualCallback;
			callbackDiv.style.display = waitingForManual ? 'block' : 'none';
			if (!waitingForManual && callbackInput) {
				callbackInput.value = '';
			}
		}

		if (manualLinkContainer) {
			if (result?.manualAuthUrl && result.waitingForManualCallback) {
				manualLinkContainer.style.display = 'block';
				if (manualLinkField) {
					manualLinkField.value = result.manualAuthUrl;
				}
			} else {
				manualLinkContainer.style.display = 'none';
				if (manualLinkField) {
					manualLinkField.value = '';
				}
			}
		}

		if (result?.message) {
			console.log(result.message);
			if (result.waitingForManualCallback) {
				if (!showSpotifyAuthToast('info', 'Spotify OAuth', result.message)) {
					alert(result.message);
				}
			}
		}

		return;
	}

	spotifyAuthButton.disabled = false;
	if (spotifyAuthButton.querySelector('span')) {
		spotifyAuthButton.querySelector('span').textContent = result?.success
			? '🔄 Reconnect to Spotify'
			: '🔗 Connect to Spotify';
	}

	if (result?.success) {
		if (spotifyAuthStatus) {
			spotifyAuthStatus.style.display = 'inline';
		}
		if (spotifySignOutButton) {
			spotifySignOutButton.style.display = 'inline-block';
		}
		if (callbackDiv) {
			callbackDiv.style.display = 'none';
		}
		if (callbackInput) {
			callbackInput.value = '';
		}
		if (manualLinkContainer) {
			manualLinkContainer.style.display = 'none';
		}
		if (manualLinkField) {
			manualLinkField.value = '';
		}
		console.log('Spotify connected successfully.');
        if (result?.warning) {
            alert('Spotify connected, but playback access is limited:\n\n' + result.warning);
        }
		} else {
			const errorCode = result?.errorCode || 'SPOTIFY_OAUTH_ERROR';
			const errorMsg = getSpotifyAuthErrorMessage(result);
			console.error(`Spotify auth failed (async result) [${errorCode}]:`, errorMsg, result);
			const composed = `[${errorCode}] ${errorMsg}`;
			showSpotifyAuthToast('error', 'Spotify OAuth Error', composed);
			alert('Failed to connect to Spotify. Error: ' + composed + '\n\n' + getSpotifyAuthTroubleshootingText(result));
		}
	}

window.handleSpotifyAuthResultFromBackground = handleSpotifyAuthResultFromBackground;

// MIDI-related functions
async function loadWebMidiScript(callback) {
	const script = document.createElement("script");
	script.type = "text/javascript";
	script.src = "./thirdparty/webmidi3.js";
	script.onload = callback; // Run the callback once the script loads
	script.onerror = () => {
		console.error("Failed to load WebMidi script.");
	};
	document.body.appendChild(script);
}

async function initializeMIDIDropdown() {
	try {
		await WebMidi.enable();
		console.log("WebMidi enabled!");
		webMidiInitialized = true;
		
		// Initial population of all MIDI selects
		updateAllMidiSelects();
		
		// Handle device changes
		WebMidi.addListener("connected", updateAllMidiSelects);
		WebMidi.addListener("disconnected", updateAllMidiSelects);
		
	} catch(e) {
		console.log("Failed to initialize WebMidi:", e);
	}
}

async function disableWebMidi() {
	if (webMidiInitialized && WebMidi) {
		try {
			console.log("Disabling WebMidi...");
			
			// Remove listeners
			WebMidi.removeListener("connected");
			WebMidi.removeListener("disconnected");
			
			// Disable WebMidi to release all MIDI devices
			await WebMidi.disable();
			webMidiInitialized = false;
			
			// Don't clear the MIDI device selects - preserve user's selections
			// The dropdowns will be repopulated when MIDI is re-enabled
			
			console.log("WebMidi disabled successfully");
		} catch (e) {
			console.error("Failed to disable WebMidi:", e);
		}
	}
}

async function handleMidiToggle(enabled) {
	if (enabled) {
		if (!webMidiScriptLoaded) {
			// Load WebMidi script first
			loadWebMidiScript(async () => {
				webMidiScriptLoaded = true;
				await initializeMIDIDropdown();
			});
		} else if (!webMidiInitialized) {
			// Script already loaded, just initialize
			await initializeMIDIDropdown();
		}
	} else {
		// Disable WebMidi to release devices
		await disableWebMidi();
	}
}

if (typeof(chrome.runtime)=='undefined'){
	
	chrome = {};
	chrome.browserAction = {};
	chrome.browserAction.setIcon = function(icon){}
	chrome.runtime = {}
	chrome.runtime.id = 1;
	
	// Add chrome.storage API for Electron
	chrome.storage = {
		local: {
			get: function(keys, callback) {
				// Use localStorage as a fallback for Electron
				if (typeof callback === 'function') {
					const result = {};
					const keysArray = Array.isArray(keys) ? keys : [keys];
					keysArray.forEach(key => {
						const value = localStorage.getItem('chrome_storage_' + key);
						if (value !== null) {
							try {
								result[key] = JSON.parse(value);
							} catch (e) {
								result[key] = value;
							}
						}
					});
					setTimeout(() => callback(result), 0);
				}
			},
			set: function(items, callback) {
				// Use localStorage as a fallback for Electron
				Object.keys(items).forEach(key => {
					localStorage.setItem('chrome_storage_' + key, JSON.stringify(items[key]));
				});
				if (typeof callback === 'function') {
					setTimeout(() => callback(), 0);
				}
			},
			remove: function(keys, callback) {
				const keysArray = Array.isArray(keys) ? keys : [keys];
				keysArray.forEach(key => {
					localStorage.removeItem('chrome_storage_' + key);
				});
				if (typeof callback === 'function') {
					setTimeout(() => callback(), 0);
				}
			}
		},
		sync: {
			get: function(keys, callback) {
				// Use local storage for sync in Electron
				chrome.storage.local.get(keys, callback);
			},
			set: function(items, callback) {
				// Use local storage for sync in Electron
				chrome.storage.local.set(items, callback);
			},
			remove: function(keys, callback) {
				// Use local storage for sync in Electron
				chrome.storage.local.remove(keys, callback);
			}
		}
	};
	
	log("pop up started");
	
	if (typeof require !== "undefined"){
		var { ipcRenderer, contextBridge, shell } = require("electron");
		window.shell = shell;
		
		ssapp = true;
		if (typeof window !== "undefined") {
			window.ssapp = true;
		}
		
		try {
			window.showOpenFilePicker = async function (a = null, c = null) {
				var importFile = await ipcRenderer.sendSync("showOpenDialog", "");
				return importFile;
			}; 
		} catch(e){}
	
	} else {
		var ipcRenderer = {};
		ipcRenderer.sendSync = function(){};
		ipcRenderer.invoke = function(){};
		ipcRenderer.on = function(){};
		console.warn("This isn't a functional mode; not yet at least.");
	}
	
	
	try {
		
		var onMessageCallback = function (a, b, c) {};

		chrome.runtime.onMessage = {};
		chrome.runtime.onMessage.addListener = function (callback) {
			onMessageCallback = callback;
		};

		ipcRenderer.on("fromMain", (event, ...args) => {
			log("FROM MAIN", args);
			
			var sender = {};
			sender.tab = {};
			sender.tab.id = null;

			// Check if this is a callback response
			if (args[0] && args[0].callbackId && pendingCallbacks.has(args[0].callbackId)) {
				const { callback, timeoutId } = pendingCallbacks.get(args[0].callbackId);
				clearTimeout(timeoutId);
				pendingCallbacks.delete(args[0].callbackId);
				callback(args[0]);
				return;
			}

			if (args[0] && args[0].forPopup) {
				log("for pop up");
				onMessageCallback(args[0], sender, function (response) {
					if (event.returnValue) {
						event.returnValue = response;
					}
					ipcRenderer.send("fromMainResponse", response);
				});
			} else {
				log("some returned promise probably");
				update(args[0], false);
			}
		});
		
		ipcRenderer.on("fromBackground", (event, ...args) => {
			log("FROM BACKGROUND", args);

			var sender = {};
			sender.tab = {};
			sender.tab.id = null;

			if (args[0]) {
				onMessageCallback(args[0], sender, function (response) {
					if (event.returnValue) {
						event.returnValue = response;
					}
					ipcRenderer.send("fromBackgroundResponse", response);
				});
			}
		});
		
	} catch(e){
		console.error(e);
	}
	
	// Store callbacks with unique IDs
	const pendingCallbacks = new Map();
	let callbackIdCounter = 0;
	
		chrome.runtime.sendMessage = async function(data, callback){ // every single response, is either nothing, or update()
			if (typeof(callback) == "function") {
				// Generate unique callback ID
				const callbackId = ++callbackIdCounter;
				const isGetSettingsRequest = !!(data && data.cmd === "getSettings");
				const timeoutMs = isGetSettingsRequest ? 3000 : 500;
				
				// Create promise with timeout
				const promise = new Promise((resolve) => {
					// Store callback with timeout
					const timeoutId = setTimeout(() => {
						pendingCallbacks.delete(callbackId);
						if (isGetSettingsRequest) {
							// For startup hydration, avoid forcing a synchronous fallback from potentially stale cache.
							// Let periodic retries continue, and allow late async callback responses to update the UI.
							resolve(undefined);
							return;
						}
						// For other messages, keep sync fallback behavior.
						const response = ipcRenderer.sendSync('fromPopup', data);
						resolve(response);
					}, timeoutMs);
				
				pendingCallbacks.set(callbackId, { 
					callback: resolve, 
					timeoutId 
				});
			});
			
			// Send message with callback ID
			ipcRenderer.send('fromPopup', { ...data, callbackId });
			
			// Wait for response
			const response = await promise;
			callback(response);
		} else {
			// No callback, use sync as before
			let response = await ipcRenderer.sendSync('fromPopup',data);
		}
	};
	chrome.runtime.getManifest = function(){
		return false; // I'll need to add version info eventually
	}
	
	chrome.runtime.getURL = function(path){
		// In Electron, construct URL relative to the app's base path
		// Remove leading slash if present
		if (path.startsWith('/')) {
			path = path.substring(1);
		}
		// Get the current window location and construct relative URL
		const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
		return baseUrl + path;
	}
	
	// Add chrome.tabs API for Electron
	chrome.tabs = {
		create: function(options) {
			// In Electron, open in default browser or new window
			if (options && options.url) {
				if (typeof require !== "undefined" && window.shell) {
					// Use Electron's shell to open external links
					window.shell.openExternal(options.url);
				} else {
					// Fallback to window.open
					window.open(options.url, '_blank');
				}
			}
		}
	}
	
	try {
		window.prompt = async function(title, val, message=""){
			log("window.prompt");
			return ipcRenderer.sendSync('prompt', {title, val, message}); // call if needed in the future
		};
	} catch(err) {
		console.error(err);
	}
	
	new Promise((resolve, reject) => {
	   try {
		  `+text+`
	   } catch(err) {
		   try {
		  throw { name: err.name, message: err.message, stack: err.stack }
		   } catch(e){}
	   }
	})
} else {
	window.prompt = async function(message, defaultValue = "") {
		return await new Promise(resolve => {
		  const modal = document.createElement("div");
		  modal.className = "arc-modal";
		  
		  const dialog = document.createElement("div");
		  dialog.className = "arc-dialog";
		  
		  const text = document.createElement("p");
		  text.textContent = message;
		  
		  const input = document.createElement("input");
		  input.type = "text";
		  input.value = defaultValue;
		  input.className = "arc-input";
		  
		  const buttonContainer = document.createElement("div");
		  buttonContainer.className = "arc-button-container";
		  
		  const cancelBtn = document.createElement("button");
		  cancelBtn.textContent = "Cancel";
		  cancelBtn.className = "arc-button arc-cancel-button";
		  cancelBtn.onclick = () => {
			document.body.removeChild(modal);
			resolve(null);
		  };
		  
		  const okBtn = document.createElement("button");
		  okBtn.textContent = "OK";
		  okBtn.className = "arc-button arc-ok-button";
		  okBtn.onclick = () => {
			document.body.removeChild(modal);
			resolve(input.value);
		  };
		  
		  buttonContainer.appendChild(cancelBtn);
		  buttonContainer.appendChild(okBtn);
		  
		  dialog.appendChild(text);
		  dialog.appendChild(input);
		  dialog.appendChild(buttonContainer);
		  modal.appendChild(dialog);
		  document.body.appendChild(modal);
		  
		  input.focus();
		  input.select();
		  
		  input.addEventListener("keydown", e => {
			if (e.key === "Enter") {
			  okBtn.click();
			} else if (e.key === "Escape") {
			  cancelBtn.click();
			}
		  });
		});
	}
}

function copyToClipboard(event) {
	
	// if (event.target.parentNode.parentNode.querySelector("[data-raw] a[href]")){ // DEPRECATED data-raw
	// Find the closest link container
	const linkContainer = event.target.closest('[data-link-container], .link');
	if (!linkContainer) {
		console.error('Could not find .link container');
		return;
	}
	
	// Find the div with the .raw property within this container
	const linkOwnerDiv = linkContainer.querySelector('[data-raw]');
	if (linkOwnerDiv && linkOwnerDiv.raw) {
		navigator.clipboard.writeText(linkOwnerDiv.raw).then(function() {
			event.target.classList.add("flashing");
			setTimeout(()=>{
				event.target.classList.remove("flashing");
			}, 500);
		}, function(err) {
			console.error('Could not copy text: ', err);
		});
	} else {
		console.error('Could not find element with raw URL to copy');
	}
}
var translation = {};

function getTranslation(key, value=false){ 
	if (translation.innerHTML && (key in translation.innerHTML)){ // these are the proper translations
		return translation.innerHTML[key];
	} else if (translation.miscellaneous && (key in translation.miscellaneous)){ 
		return translation.miscellaneous[key];
	} else if (value!==false){
		return value;
	} else {
		return key.replaceAll("-", " "); //
	}
}
function miniTranslate(ele, ident = false, direct=false) {
	
	if (ident){
		if (translation.innerHTML && (ident in translation.innerHTML)){
			if (ele.querySelector('[data-translate]')){
				ele.querySelector('[data-translate]').innerHTML = translation.innerHTML[ident];
				ele.querySelector('[data-translate]').dataset.translate = ident;
			} else {
				ele.innerHTML = translation.innerHTML[ident];
				ele.dataset.translate = ident;
			}
			return;
		} else if (direct){
			if (ele.querySelector('[data-translate]')){
				ele.querySelector('[data-translate]').innerHTML = direct;
				ele.querySelector('[data-translate]').dataset.translate = ident;
			} else {
				ele.dataset.translate = ident;
				ele.innerHTML = direct;
			}
			return;
		} else {
			log(ident + ": not found in translation file");
			
			if (!translation.miscellaneous || !(ident in translation.miscellaneous)){ 
				var value = ident.replaceAll("-", " "); // lets use the key as the translation
			} else {
				var value = translation.miscellaneous[ident]; // lets use a miscellaneous translation as backup?
			}
			
			if (ele.querySelector('[data-translate]')){
				ele.querySelector('[data-translate]').innerHTML = value;
				ele.querySelector('[data-translate]').dataset.translate = ident;
			} else {
				ele.innerHTML = value;
				ele.dataset.translate = ident;
			}
			return;
		}
	}
	
	var allItems = ele.querySelectorAll('[data-translate]');
	allItems.forEach(function(ele2) {
		if (translation.innerHTML  && (ele2.dataset.translate in translation.innerHTML)){
			ele2.innerHTML = translation.innerHTML[ele2.dataset.translate];
		} else if (translation.miscellaneous && (ele2.dataset.translate in translation.miscellaneous)){
			ele2.innerHTML = translation.miscellaneous[ele2.dataset.translate];
		}
	});
	if (ele.dataset){
		if (translation.innerHTML && (ele.dataset.translate in translation.innerHTML)){
			ele.innerHTML = translation.innerHTML[ele.dataset.translate];
		} else if (translation.miscellaneous && (ele.dataset.translate in translation.miscellaneous)){
			ele.innerHTML = translation.miscellaneous[ele.dataset.translate];
		}
	}
	if (translation.titles){
		var allTitles = ele.querySelectorAll('[title]');
		allTitles.forEach(function(ele2) {
			var key = ele2.title.toLowerCase().replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/[\n\t\r]/g, '').trim().replaceAll(" ","-");;
			if (key in translation.titles) {
				ele2.title = translation.titles[key];
			}
		});
		if (ele.title){
			var key = ele.title.toLowerCase().replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/[\n\t\r]/g, '').trim().replaceAll(" ","-");;
			if (key in translation.titles) {
				ele.title = translation.titles[key];
			}
		}
	}
	if (translation.placeholders){
		var allPlaceholders = ele.querySelectorAll('[placeholder]');
		allPlaceholders.forEach(function(ele2) {
			if (ele2.placeholder) {
				var key = ele2.placeholder.toLowerCase().replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/[\n\t\r]/g, '').trim().replaceAll(" ","-");;
				if (key in translation.placeholders) {
					ele2.placeholder = translation.placeholders[key];
				}
			}
		});
		
		if (ele.placeholder){
			var key = ele.placeholder.toLowerCase().replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/[\n\t\r]/g, '').trim().replaceAll(" ","-");;
			if (key in translation.placeholders) {
				ele.placeholder = translation.placeholders[key];
			}
		}
	}
	var obsTransparentNotes = ele.querySelectorAll('.obs-transparent-note');
	obsTransparentNotes.forEach(function(ele2) {
		ele2.innerHTML = getTranslation(
			"obs-browser-source-is-already-transparent-by-default",
			" (OBS Browser Source is already transparent by default)"
		);
	});
	if (ele.classList && ele.classList.contains("obs-transparent-note")){
		ele.innerHTML = getTranslation(
			"obs-browser-source-is-already-transparent-by-default",
			" (OBS Browser Source is already transparent by default)"
		);
	}
}

if (urlParams.has("ln")) {
	const initialExternalLanguage = normalizePopupTranslationLanguage(urlParams.get("ln"));
	const initialLanguageSelect = document.querySelector('select[data-optionsetting="translationlanguage"]');
	if (initialExternalLanguage && initialLanguageSelect) {
		initialLanguageSelect.value = initialExternalLanguage;
		applyPopupTranslationLanguageImmediately(initialExternalLanguage);
	}
}

function isFontAvailable(fontName) {
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");

    context.font = "72px monospace"; // Use a large font size for better accuracy
    const widthMonospace = context.measureText("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789").width;

    context.font = `72px '${fontName}', monospace`;
    const widthTest = context.measureText("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789").width;

    return widthMonospace !== widthTest;
}

const popupFontCandidates = [
    'Segoe UI', 'Segoe UI Variable', 'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Symbol', 'Bahnschrift', 'Ebrima', 'Gadugi', 'Javanese Text', 'Leelawadee UI', 'Lucida Sans Unicode', 'Malgun Gothic', 'Meiryo', 'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft Uighur', 'Microsoft YaHei', 'Microsoft Yi Baiti', 'MingLiU-ExtB', 'Mongolian Baiti', 'MS Gothic', 'MS PGothic', 'MS UI Gothic', 'NSimSun', 'PMingLiU-ExtB', 'SimSun', 'SimSun-ExtB', 'Yu Gothic', 'Yu Gothic UI',
    'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Franklin Gothic Medium', 'Gabriola', 'Georgia', 'Impact', 'Palatino Linotype', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Symbol', 'Webdings', 'Wingdings', 'Wingdings 2', 'Wingdings 3', 'Sitka Banner', 'Sitka Display', 'Sitka Heading', 'Sitka Small', 'Sitka Subheading', 'Sitka Text', 'Lucida Console',
    'Cascadia Code', 'Cascadia Mono', 'Fira Code', 'Fira Mono', 'JetBrains Mono', 'Source Code Pro', 'IBM Plex Mono', 'Ubuntu Mono', 'Inconsolata', 'Monaspace Neon', 'Monaspace Argon',
    'Inter', 'Roboto', 'Open Sans', 'Noto Sans', 'Noto Serif', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Serif JP', 'Noto Naskh Arabic', 'Lato', 'Montserrat', 'Poppins', 'Oswald', 'Raleway', 'Nunito', 'Merriweather', 'Playfair Display', 'PT Sans', 'PT Serif', 'Source Sans 3', 'Source Serif 4', 'Source Sans Pro', 'Source Serif Pro', 'IBM Plex Sans', 'IBM Plex Serif', 'Ubuntu', 'Work Sans', 'Sora', 'Avenir', 'Avenir Next', 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', 'Helvetica', 'Gill Sans',
    'Book Antiqua', 'Century Gothic', 'Garamond', 'Didot', 'Bodoni MT', 'Perpetua', 'Rockwell', 'Goudy Old Style', 'Copperplate', 'Brush Script MT'
];
var popupAvailableFontCache = null;

function getPopupAvailableFonts() {
    if (!popupAvailableFontCache) {
        popupAvailableFontCache = popupFontCandidates.filter(isFontAvailable);
    }
    return popupAvailableFontCache;
}

function populateFontDropdown(select) {
    if (!select) return;
    if (select.dataset.fontOptionsLoaded === "true") return;

    const currentValue = select.value;
    const existingValues = new Set(Array.from(select.options).map(option => option.value));
    getPopupAvailableFonts().forEach(font => {
        if (existingValues.has(font)) return;
        let option = document.createElement("option");
        option.value = font;
        option.style = "font-family:'" + font + "'";
        option.innerText = font + " abc123XYZ";
        select.appendChild(option);
    });
    if (currentValue) {
        select.value = currentValue;
    }
    select.dataset.fontOptionsLoaded = "true";
}

function setupLazyFontDropdowns() {
    document.querySelectorAll("select[data-optionparam1='font'], select[data-optionparam2='font'], select[data-optionparam4='font'], select[data-optionparam5='font'], select[data-optionparam6='font'], select[data-optionparam7='font'], select[data-optionparam13='font'], select[data-optionparam17='font'], select[data-optionparam21='font']").forEach(function(select) {
        if (select.dataset.lazyFonts === "true") return;
        select.dataset.lazyFonts = "true";
        const load = function() {
            populateFontDropdown(select);
        };
        select.addEventListener("focus", load);
        select.addEventListener("mousedown", load);
        select.addEventListener("touchstart", load);
        select.addEventListener("keydown", load);
    });
}

function createUniqueVoiceIdentifiers(voices) {
    // Helper to get a clean voice name for use in parameters
    const getCleanVoiceName = (name) => name.replace(/[^a-zA-Z0-9\s]/g, '').trim().replaceAll(' ', '_');

    // Group voices by language
    const voicesByLang = voices.reduce((acc, voiceObj) => {
        if (!acc[voiceObj.lang]) {
            acc[voiceObj.lang] = [];
        }
        acc[voiceObj.lang].push(voiceObj);
        return acc;
    }, {});

    // Assign unique identifiers within each language group
    for (const lang in voicesByLang) {
        const voicesInLang = voicesByLang[lang];

        voicesInLang.forEach(voiceObj => {
            let uniquePart = '';

            // Attempt to find a unique word within the voice name for this language
            const words = voiceObj.name.split(' ').filter(word => word.length > 0);
            for (let i = 0; i < words.length; i++) {
                const potentialIdentifier = words[i];
                if (voicesInLang.filter(v => v.name.includes(potentialIdentifier)).length === 1) {
                    uniquePart = potentialIdentifier;
                    break;
                }
            }

            // Fallback to a cleaned full name if no unique word is found
            if (!uniquePart) {
                uniquePart = getCleanVoiceName(voiceObj.name);
            }

            // Construct the code using separate lang and voice parameters
            voiceObj.code = `lang=${voiceObj.lang}&voice=${encodeURIComponent(uniquePart)}`;
            voiceObj.lang = voiceObj.lang; // Ensure lang is explicitly available
            voiceObj.name = voiceObj.name; // Ensure name is explicitly available
            voiceObj.voiceId = uniquePart; // Store just the voice identifier separately
        });
    }

    // Flatten the grouped voices back into a single array
    return Object.values(voicesByLang).flat();
}

var popupSpeechVoiceCache = null;
var popupSpeechVoiceDropdownsLoaded = false;
var popupSpeechVoiceSelectIds = ['systemLanguageSelect', 'languageSelect2', 'systemLanguageSelect10', 'systemLanguageSelect18'];

function getPopupSpeechVoices() {
    if (popupSpeechVoiceCache) return popupSpeechVoiceCache;
    if (!window.speechSynthesis) return [];
    const voices = speechSynthesis.getVoices();
    if (!voices || !voices.length) return [];

    popupSpeechVoiceCache = createUniqueVoiceIdentifiers(voices);
    popupSpeechVoiceCache.sort((a, b) => {
        if (a.default) return -1;
        if (b.default) return 1;
        return 0;
    });
    return popupSpeechVoiceCache;
}

function populateSystemVoiceDropdown(dropdown, voices) {
    if (!dropdown || !voices || !voices.length) return;
    const currentValue = dropdown.value;
    const existingValues = new Set(Array.from(dropdown.options).map(option => option.value));

    voices.forEach(voice => {
        const voiceText = `${voice.name} (${voice.lang})`;
        if (!existingValues.has(voice.code)) {
            const option = document.createElement('option');
            option.textContent = voiceText;
            option.value = voice.code;
            option.code = voice.code;
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            dropdown.appendChild(option);
            existingValues.add(voice.code);
        }
    });

    if (currentValue) {
        dropdown.value = currentValue;
    }
}

function populateSystemVoiceDropdowns() {
    const voices = getPopupSpeechVoices();
    if (!voices.length) return voices;

    popupSpeechVoiceSelectIds.forEach(id => {
        populateSystemVoiceDropdown(document.getElementById(id), voices);
    });

    if (typeof TTSManager !== 'undefined') {
        TTSManager.voices = voices;
    }
    popupSpeechVoiceDropdownsLoaded = true;
    return voices;
}

function setupLazySystemVoiceDropdowns() {
    popupSpeechVoiceSelectIds.forEach(id => {
        const dropdown = document.getElementById(id);
        if (!dropdown || dropdown.dataset.lazySystemVoices === "true") return;
        dropdown.dataset.lazySystemVoices = "true";
        const load = function() {
            populateSystemVoiceDropdowns();
        };
        dropdown.addEventListener("focus", load);
        dropdown.addEventListener("mousedown", load);
        dropdown.addEventListener("touchstart", load);
        dropdown.addEventListener("keydown", load);
    });

    if (window.speechSynthesis) {
        speechSynthesis.onvoiceschanged = function() {
            popupSpeechVoiceCache = null;
            if (popupSpeechVoiceDropdownsLoaded) {
                populateSystemVoiceDropdowns();
            }
        };
    }
}

function addUsername(username, type='blacklistusers') {
  const input = document.querySelector(`[data-textsetting="${type}"]`);
  if (!input) return;
  
  const usernames = input.value.split(',').map(u => u.trim()).filter(u => u);
  let sourceType = document.getElementById(`new${type}Type`).value.toLowerCase().trim();
  
  if (sourceType == "youtubeshorts"){
	sourceType = "youtube";
  }
  
  const newEntry = sourceType ? `${username}:${sourceType}` : username;
  
  if (!usernames.some(entry => {
    const [name] = entry.split(':');
    return name === username;
  })) {
    usernames.push(newEntry);
    input.value = usernames.join(', ');
    updateUsernameList(type);
    updateSettings(input);
  }
}

function removeUsername(username, sourceType='', type='blacklistusers') {
  const input = document.querySelector(`[data-textsetting="${type}"]`);
  if (!input) return;
  
  const usernames = input.value.split(',').map(u => u.trim()).filter(u => u);
  const index = usernames.findIndex(entry => {
    const [name, type] = entry.split(':');
    return name === username && (!sourceType || type === sourceType);
  });
  
  if (index > -1) {
    usernames.splice(index, 1);
    input.value = usernames.join(', ');
    updateUsernameList(type);
    updateSettings(input);
  }
}

function updateUsernameList(type = 'blacklistusers') {
	
	if (!userTypes.includes(type)) return;
	
  const input = document.querySelector(`[data-textsetting="${type}"]`);
  const list = document.getElementById(`${type}List`);
  
  if (!input || !list) return;
  
  const usernames = input.value.split(',')
    .map(u => u.trim())
    .filter(u => u)
    .map(entry => {
      const parts = entry.split(':').map(part => part.trim());
      const name = parts[0];
      const sourceType = parts[1] || ''; 
      return { name, sourceType };
    });

  list.innerHTML = usernames.map(({ name, sourceType }) => `
    <div class="username-tag">
      <span>${name}${sourceType ? `<span class="source-type"><img class="icon" src="./sources/images/${sourceType}.png" /></span>` : ''}</span>
      <button class="remove-username" data-username="${name}" data-source-type="${sourceType || ''}">×</button>
    </div>
  `).join('');
}

function addSourceType(sourceType, type) {
    let input = document.getElementById(type);
    if (!input) {
        input = document.querySelector(`[data-textsetting="${type}"]`);
    }
    if (!input) return;
    
    const sources = input.value.split(',').map(t => t.trim()).filter(t => t);
    
    if (!sources.includes(sourceType)) {
        sources.push(sourceType);
        input.value = sources.join(', ');
        updateSourceTypeList(type);
        updateSettings(input);
    }
}

function removeSourceType(sourceType, type) {
    let input = document.getElementById(type);
    if (!input) {
        input = document.querySelector(`[data-textsetting="${type}"]`);
    }
    if (!input) return;
    
    const sources = input.value.split(',').map(t => t.trim()).filter(t => t);
    const index = sources.indexOf(sourceType);
    
    if (index > -1) {
        sources.splice(index, 1);
        input.value = sources.join(', ');
        updateSourceTypeList(type);
        updateSettings(input);
    }
}

function updateSourceTypeList(type) {
    let input = document.getElementById(type);
    if (!input) {
        input = document.querySelector(`[data-textsetting="${type}"]`);
    }
    const list = document.getElementById(`${type}List`);
    if (!input || !list) return;
    
    const sources = input.value.split(',')
        .map(t => t.trim())
        .filter(t => t);
    
    list.innerHTML = sources.map(source => `
        <div class="username-tag">
            <span>${source}<span class="source-type"><img class="icon" src="./sources/images/${source}.png" /></span></span>
            <button class="remove-source" data-source-type="${source}">×</button>
        </div>
    `).join('');
}

function normalizeCommaValues(value) {
    return value
        .split(',')
        .map(item => item.trim())
        .filter(item => item);
}

const commaTagPresetOptions = {
    events: [
        // Cross-platform
        { value: 'new_follower', label: 'new_follower - Follow' },
        { value: 'new_subscriber', label: 'new_subscriber - New sub' },
        { value: 'resub', label: 'resub - Renewal/upgrade' },
        { value: 'subscription_gift', label: 'subscription_gift - Gift subs' },
        { value: 'donation', label: 'donation - Donation/Super Chat' },
        { value: 'raid', label: 'raid - Raid' },
        // Twitch
        { value: 'cheer', label: 'cheer - Bits/Cheers (Twitch)' },
        { value: 'channel_points', label: 'channel_points - Channel points (Twitch)' },
        // YouTube
        { value: 'sponsorship', label: 'sponsorship - New member (YouTube)' },
        { value: 'membermilestone', label: 'membermilestone - Member milestone (YouTube)' },
        { value: 'giftpurchase', label: 'giftpurchase - Gift purchase (YouTube)' },
        { value: 'giftredemption', label: 'giftredemption - Gift redemption (YouTube)' },
        { value: 'supersticker', label: 'supersticker - Super Sticker (YouTube)' },
        // TikTok
        { value: 'gift', label: 'gift - Gift (TikTok/Kick DOM)' },
        { value: 'joined', label: 'joined - Join (TikTok)' },
        { value: 'liked', label: 'liked - Like (TikTok)' },
        // Status/system
        { value: 'stream_online', label: 'stream_online - Stream online' },
        { value: 'stream_offline', label: 'stream_offline - Stream offline' },
        { value: 'viewer_update', label: 'viewer_update - Viewer count' },
        { value: 'follower_update', label: 'follower_update - Follower count' },
        { value: 'subscriber_update', label: 'subscriber_update - Subscriber count' },
        { value: 'reward', label: 'reward - Redemption (Twitch/Kick DOM)' }
    ]
};

function getCommaTagInput(inputId) {
    let input = document.getElementById(inputId);
    if (!input) {
        input = document.querySelector(`[data-textsetting="${inputId}"]`);
    }
    return input;
}

function refreshCommaTagInput(inputOrKey) {
    if (!inputOrKey) {
        return;
    }
    const input = typeof inputOrKey === 'string' ? getCommaTagInput(inputOrKey) : inputOrKey;
    if (!input) {
        return;
    }
    const inputId = input.id || input.dataset.textsetting;
    if (inputId) {
        updateCommaTagList(inputId);
    }
}

function updateCommaTagList(inputId) {
    const input = getCommaTagInput(inputId);
    const list = document.getElementById(`${inputId}List`);
    if (!input || !list) return;

    const values = normalizeCommaValues(input.value);
    list.style.display = values.length ? '' : 'none';
    list.innerHTML = values.map(value => `
        <div class="username-tag">
            <span>${escapeHtml(value)}</span>
            <button class="remove-source" data-value="${escapeHtml(value)}">×</button>
        </div>
    `).join('');
}

function addCommaTagValue(inputId, value) {
    const input = getCommaTagInput(inputId);
    if (!input || !value) return;

    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    const values = normalizeCommaValues(input.value);
    if (values.some(existing => existing.toLowerCase() === trimmedValue.toLowerCase())) {
        return;
    }

    values.push(trimmedValue);
    input.value = values.join(', ');
    updateCommaTagList(inputId);
    updateSettings(input);
}

function removeCommaTagValue(inputId, value) {
    const input = getCommaTagInput(inputId);
    if (!input || !value) return;

    const values = normalizeCommaValues(input.value);
    const updated = values.filter(existing => existing.toLowerCase() !== value.toLowerCase());
    input.value = updated.join(', ');
    updateCommaTagList(inputId);
    updateSettings(input);
}

function setupCommaTagInput(inputId) {
    const input = getCommaTagInput(inputId);
    if (!input) return;

    const container = input.closest('.textInputContainer');
    if (!container) return;

    container.classList.add('tag-input-container');

    if (document.getElementById(`${inputId}List`)) {
        updateCommaTagList(inputId);
        return;
    }

    input.classList.add('hidden');

    const listContainer = document.createElement('div');
    listContainer.className = 'source-list-container';
    listContainer.id = `${inputId}List`;

    const addContainer = document.createElement('div');
    addContainer.className = 'add-source-container';
    const presetOptions = commaTagPresetOptions[input.dataset.tagPresets] || [];
    const presetMarkup = presetOptions.length ? `
        <select id="preset${inputId}Tag">
            <option value="" selected>Common events</option>
            ${presetOptions.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
        </select>
        <button id="addPreset${inputId}Tag">Add preset</button>
    ` : '';
    addContainer.innerHTML = `
        <input type="text" id="new${inputId}Tag" placeholder="Add value">
        <button id="add${inputId}Tag">Add</button>
        ${presetMarkup}
    `;

    container.parentNode.classList.add('isolate');
    container.parentNode.insertBefore(listContainer, container.nextSibling);
    container.parentNode.insertBefore(addContainer, listContainer.nextSibling);

    listContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-source')) {
            removeCommaTagValue(inputId, event.target.dataset.value);
        }
    });

    const addButton = addContainer.querySelector(`#add${inputId}Tag`);
    const addInput = addContainer.querySelector(`#new${inputId}Tag`);
    if (addButton && addInput) {
        addButton.addEventListener('click', () => {
            addCommaTagValue(inputId, addInput.value);
            addInput.value = '';
        });

        addInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addCommaTagValue(inputId, addInput.value);
                addInput.value = '';
            }
        });
    }

    const addPresetButton = addContainer.querySelector(`#addPreset${inputId}Tag`);
    const presetSelect = addContainer.querySelector(`#preset${inputId}Tag`);
    if (addPresetButton && presetSelect) {
        addPresetButton.addEventListener('click', () => {
            addCommaTagValue(inputId, presetSelect.value);
            presetSelect.value = '';
        });
    }

    updateCommaTagList(inputId);
}

// Blocked words tag system functions
function updateBlockedWordsList() {
    const input = document.getElementById('blockedwordsInput');
    const list = document.getElementById('blockedwordsList');
    if (!input || !list) return;

    const words = input.value.split(',')
        .map(w => w.trim())
        .filter(w => w);

    list.innerHTML = words.map(word => `
        <div class="username-tag">
            <span>${escapeHtml(word)}</span>
            <button class="remove-blockedword" data-word="${escapeHtml(word)}">×</button>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const DEFAULT_CUSTOM_URL_SLOT_COUNT = 9;
let highestRenderedCustomUrlSlot = DEFAULT_CUSTOM_URL_SLOT_COUNT;
let pendingCustomUrlSettings = null;

function getCustomUrlSlotFromKey(key) {
    const match = String(key || '').match(/^custom(\d+)_url(?:_newwindow)?$/);
    if (!match) return 0;
    const index = parseInt(match[1], 10);
    return Number.isFinite(index) ? index : 0;
}

function attachCustomUrlRowHandlers(row) {
    const checkbox = row.querySelector("input[type='checkbox']");
    if (checkbox) {
        checkbox.onchange = updateSettings;
    }

    const textInput = row.querySelector("input[type='text']");
    if (textInput) {
        textInput.onchange = updateSettings;
    }

    const openButton = row.querySelector("button[data-action='openchat']");
    if (openButton) {
        openButton.onclick = function(e) {
            chrome.runtime.sendMessage({
                cmd: this.dataset.action,
                ctrl: e.ctrlKey || false,
                value: this.dataset.value || null
            }, function() {
                log("ignore callback for this action");
            });
        };
    }
}

function ensureCustomUrlSlot(index) {
    index = parseInt(index, 10);
    if (!Number.isFinite(index) || index <= 0) return;
    highestRenderedCustomUrlSlot = Math.max(highestRenderedCustomUrlSlot, index);
    if (index <= DEFAULT_CUSTOM_URL_SLOT_COUNT || document.getElementById("custom" + index + "_url")) return;

    const container = document.getElementById("custom-url-dynamic-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "custom-url-entry";
    row.dataset.customUrlIndex = String(index);
    row.innerHTML = `
        <div>
            <label class="switch">
                <input type="checkbox" id="custom${index}_url_newwindow" data-setting="custom${index}_url_newwindow" />
                <span class="slider round"></span>
            </label>
            <span> Open custom URL ${index} on new window </span>
        </div>
        <div class="textInputContainer" style="width: 95%;">
            <input type="text" id="custom${index}_url" class="textInput" autocomplete="off" placeholder="eg: https://somedomain/chat/popup" data-textsetting="custom${index}_url" />
            <label for="custom${index}_url"><span>&gt; Custom URL ${index}</span></label>
        </div>
        <center>
            <button class="glowingButton" style="margin-top: 4px; margin-left: 0px;" data-action="openchat" data-value="custom${index}">
                <span><span data-translate="open-chat">Open chat</span></span>
            </button>
        </center>
    `;
    container.appendChild(row);
    attachCustomUrlRowHandlers(row);
}

function renderSavedCustomUrlSlots(savedSettings) {
    pendingCustomUrlSettings = savedSettings || pendingCustomUrlSettings;
    if (!document.getElementById("custom-url-dynamic-container")) return;

    let highest = DEFAULT_CUSTOM_URL_SLOT_COUNT;
    Object.keys(savedSettings || {}).forEach(function(key) {
        const index = getCustomUrlSlotFromKey(key);
        if (index > highest) highest = index;
    });
    for (let index = DEFAULT_CUSTOM_URL_SLOT_COUNT + 1; index <= highest; index++) {
        ensureCustomUrlSlot(index);
    }
}

function setupDynamicCustomUrlControls() {
    const addButton = document.getElementById("addCustomUrl");
    if (!addButton || addButton.dataset.bound) return;
    addButton.dataset.bound = "true";
    addButton.onclick = function() {
        const nextIndex = highestRenderedCustomUrlSlot + 1;
        ensureCustomUrlSlot(nextIndex);
        const input = document.getElementById("custom" + nextIndex + "_url");
        if (input) {
            input.focus();
        }
    };
    if (pendingCustomUrlSettings) {
        renderSavedCustomUrlSlots(pendingCustomUrlSettings);
    }
}

function addBlockedWord(word) {
    const input = document.getElementById('blockedwordsInput');
    if (!input || !word) return;

    const words = input.value.split(',').map(w => w.trim()).filter(w => w);
    const trimmedWord = word.trim();

    if (trimmedWord && !words.some(w => w.toLowerCase() === trimmedWord.toLowerCase())) {
        words.push(trimmedWord);
        input.value = words.join(', ');
        updateBlockedWordsList();
        updateSettings(input);
    }
}

function removeBlockedWord(word) {
    const input = document.getElementById('blockedwordsInput');
    if (!input) return;

    const words = input.value.split(',').map(w => w.trim()).filter(w => w);
    const index = words.findIndex(w => w.toLowerCase() === word.toLowerCase());

    if (index > -1) {
        words.splice(index, 1);
        input.value = words.join(', ');
        updateBlockedWordsList();
        updateSettings(input);
    }
}

function setupBlockedWordsInput() {
    const list = document.getElementById('blockedwordsList');
    const addBtn = document.getElementById('addBlockedWord');
    const newWordInput = document.getElementById('newBlockedWord');

    if (!list || !addBtn || !newWordInput) return;

    // Handle clicking remove button on tags
    list.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-blockedword')) {
            removeBlockedWord(e.target.dataset.word);
        }
    });

    // Handle add button click
    addBtn.addEventListener('click', () => {
        const word = newWordInput.value.trim();
        if (word) {
            addBlockedWord(word);
            newWordInput.value = '';
        }
    });

    // Handle Enter key in input
    newWordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const word = newWordInput.value.trim();
            if (word) {
                addBlockedWord(word);
                newWordInput.value = '';
            }
        }
    });

    // Initialize the list from any existing value
    updateBlockedWordsList();
}

// Function to setup source selection for a given input
function setupSourceSelection(inputId, isSettingBased = false) {
    const input = isSettingBased ? 
        document.querySelector(`[data-textsetting="${inputId}"]`) : 
        document.getElementById(inputId);
    
    if (!input) return;
    
    const container = input.closest('.textInputContainer');
    if (!container || container.querySelector('.source-list-container')) return; // Already setup
    
    input.classList.add('hidden');
    
    const listContainer = document.createElement('div');
    listContainer.className = 'source-list-container';
    listContainer.id = `${inputId}List`;
    
    const addContainer = document.createElement('div');
    addContainer.className = 'add-source-container';
    
    addContainer.innerHTML = `
        <input type="text" id="new${inputId}Type" placeholder="Source type" list="popupSourceTypesList">
        <button id="add${inputId}">Add</button>
    `;
    
    container.parentNode.classList.add("isolate");
    container.parentNode.insertBefore(listContainer, container.nextSibling);
    container.parentNode.insertBefore(addContainer, listContainer.nextSibling);
    
    setupLazySourceInput(document.getElementById(`new${inputId}Type`));

    // Add event listeners
    listContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-source')) {
            removeSourceType(e.target.dataset.sourceType, inputId);
        }
    });
    
    document.getElementById(`add${inputId}`).addEventListener('click', () => {
        const selectInput = document.getElementById(`new${inputId}Type`);
        const sourceType = selectInput.value.trim();
        if (sourceType) {
            addSourceType(sourceType, inputId);
            selectInput.value = '';
        }
    });
    
    // Update the list with existing values
    updateSourceTypeList(inputId);
}

// Templates for different event types
const eventTemplates = {
  botReply: (id) => `
    <div class="event-container">
      <label class="switch" style="vertical-align: top; margin: 26px 0 0 0">
        <input type="checkbox" data-setting="botReplyMessageEvent${id}">
        <span class="slider round"></span>
      </label>
      <div style="display:inline-block">
        <div class="textInputContainer" style="width: 235px">
          <input type="text" id="botReplyMessageCommand${id}" maxlength="200" class="textInput" autocomplete="off" placeholder="!discord, !ds, !disc" data-textsetting="botReplyMessageCommand${id}">
          <label for="botReplyMessageCommand${id}">&gt; Triggering command(s)</label>
        </div>
        <div class="textInputContainer" style="width: 235px">
          <input type="text" id="botReplyMessageValue${id}" maxlength="200" class="textInput" autocomplete="off" placeholder="Message to respond with" data-textsetting="botReplyMessageValue${id}">
          <label for="botReplyMessageValue${id}">&gt; Message to respond with.</label>
        </div>
        <div class="textInputContainer" style="width: 235px">
          <input type="number" id="botReplyMessageTimeout${id}" class="textInput" min="0" autocomplete="off" placeholder="Timeout needed between responses" data-numbersetting="botReplyMessageTimeout${id}">
          <label for="botReplyMessageTimeout${id}">&gt; Trigger timeout (ms)</label>
        </div>
        <div class="textInputContainer" style="width: 235px" title="If a source is provided, limit the response to this source. Comma-separated">
          <input type="text" id="botReplyMessageSource${id}" class="textInput" min="0" autocomplete="off" placeholder="ie: youtube,twitch (comma separated)" data-textsetting="botReplyMessageSource${id}">
          <label for="botReplyMessageSource${id}">&gt; Limit to specific sites</label>
        </div>
        <span data-translate="reply-to-all">Reply to all instead of just the source</span>
        <label class="switch">
          <input type="checkbox" data-setting="botReplyAll${id}">
          <span class="slider round"></span>
        </label>
      </div>
    </div>
  `,
  
  chatCommand: (id) => `
    <div class="event-container">
      <label class="switch" style="vertical-align: top; margin: 26px 0 0 0">
        <input type="checkbox" data-setting="chatevent${id}">
        <span class="slider round"></span>
      </label>
      <div style="display:inline-block">
        <div class="textInputContainer" style="width: 235px">
          <input type="text" id="chatcommand${id}" class="textInput" autocomplete="off" placeholder="!someevent${id}, !alias${id}" data-textsetting="chatcommand${id}">
          <label for="chatcommand${id}">&gt; Chat Command(s)</label>
        </div>
        <div class="textInputContainer" style="width: 235px">
          <input type="text" id="chatwebhook${id}" class="textInput" autocomplete="off" placeholder="Provide full URL" data-textsetting="chatwebhook${id}">
          <label for="chatwebhook${id}">&gt; Webhook URL</label>
        </div>
        <div class="textInputContainer" style="width: 235px">
          <input type="number" id="chatcommandtimeout${id}" class="textInput" min="0" autocomplete="off" placeholder="Timeout between triggers" data-numbersetting="chatcommandtimeout${id}">
          <label for="chatcommandtimeout${id}">&gt; Trigger Timeout (ms)</label>
        </div>
      </div>
    </div>
  `,

  webhookRelay: (id) => {
    const suffix = id === 1 ? '' : id;
    const inputId = `webhookrelayurl${suffix}`;
    const settingKey = id === 1 ? 'webhookrelayurl' : `webhookrelayurl${id}`;

    return `
    <div class="event-container">
      <div class="textInputContainer" style="width: 235px">
        <input type="text" id="${inputId}" class="textInput" autocomplete="off" placeholder="https://thirdparty.com/api" data-textsetting="${settingKey}">
        <label for="${inputId}">&gt; Webhook URL</label>
      </div>
    </div>
  `;
  },
  
  timedMessage: (id) => `
    <div class="event-container">
      <label class="switch" style="vertical-align: top; margin: 26px 0 0 0">
        <input type="checkbox" data-setting="timemessageevent${id}">
        <span class="slider round"></span>
      </label>
      <div style="display:inline-block">
        <div class="textInputContainer" style="width: 235px">
          <input type="text" id="timemessagecommand${id}" maxlength="200" class="textInput" autocomplete="off" placeholder="Message to send to chat at an interval" data-textsetting="timemessagecommand${id}">
          <label for="timemessagecommand${id}">&gt; Message to broadcast</label>
        </div>
        <div class="textInputContainer" style="width: 235px">
          <input type="number" id="timemessageinterval${id}" class="textInput" value="15" min="0" autocomplete="off" title="Interval offset in minutes; 0 to issue just once." data-numbersetting="timemessageinterval${id}">
          <label for="timemessageinterval${id}">&gt; Interval between broadcasts in minutes</label>
        </div>
        <div class="textInputContainer" style="width: 235px">
          <input type="number" min="0" max="127" id="timemessageoffset${id}" value="0" min="0" class="textInput" autocomplete="off" title="Starting offset in minutes" data-numbersetting="timemessageoffset${id}">
          <label for="timemessageoffset${id}">&gt; Starting time offset</label>
        </div>
      </div>
    </div>
  `,
  
  midiCommand: (id) => `
    <div class="event-container">
      <label class="switch" style="vertical-align: top; margin: 26px 0 0 0">
        <input type="checkbox" data-setting="midievent${id}">
        <span class="slider round"></span>
      </label>
      <div style="display:inline-block">
        <div class="textInputContainer" style="width: 235px">
          <input type="text" id="midicommand${id}" class="textInput" autocomplete="off" placeholder="!someevent${id}" data-textsetting="midicommand${id}">
          <label for="midicommand${id}">&gt; Triggering !command</label>
        </div>
        <div class="textInputContainer" style="width: 235px">
          <input type="number" id="midinote${id}" class="textInput" autocomplete="off" placeholder="MIDI Note that will be triggered; 127-velocity" data-numbersetting="midinote${id}">
          <label for="midinote${id}">MIDI Note to Trigger</label>
        </div>
		<div class="textInputContainer" style="width: 235px">
          <select id="mididevice${id}" class="textInput" autocomplete="off" placeholder="MIDI default device used if left unspecified" data-optionsetting="mididevice${id}"></select>
          <label for="mididevice${id}">MIDI Device</label>
        </div>
      </div>
    </div>
  `,
};


function initializeInputHandlers(container) {
  container.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.onchange = updateSettings;
  });

  container.querySelectorAll('input[type="text"], input[type="number"], input[type="password"], select').forEach(input => {
    input.onchange = updateSettings;
  });

  container.querySelectorAll('input[type="text"][class*="instant"]').forEach(input => {
    input.oninput = updateSettings;
  });
}

  const patterns = {
	botReply: {
	  prefixes: ['botReplyMessageEvent', 'botReplyMessageCommand', 'botReplyMessageValue', 'botReplyMessageTimeout', 'botReplyMessageSource', 'botReplyAll'],
	  type: 'botReply'
	},
	chatCommand: {
	  prefixes: ['chatevent', 'chatcommand', 'chatwebhook', 'chatcommandtimeout'],
	  type: 'chatCommand'
	},
	webhookRelay: {
	  prefixes: ['webhookrelayurl'],
	  type: 'webhookRelay'
	},
	timedMessage: {
	  prefixes: ['timemessageevent', 'timemessagecommand', 'timemessageinterval', 'timemessageoffset'],
	  type: 'timedMessage'
	},
	midiCommand: {
	  prefixes: ['midievent', 'midicommand', 'midinote', 'mididevice'],
	  type: 'midiCommand'
	},
  };
  
function findExistingEvents(eventType, response) {
  const events = new Set();
  const settings = response?.settings || {};
  const pattern = patterns[eventType];
  if (!pattern) return [];

  // Check all possible settings for this event type
  Object.keys(settings).forEach(key => {
	pattern.prefixes.forEach(prefix => {
	  if (key.startsWith(prefix)) {
		const suffix = key.slice(prefix.length);
		let eventId = 1;
		if (suffix) {
		  const parsed = parseInt(suffix, 10);
		  if (Number.isNaN(parsed)) {
			return;
		  }
		  eventId = parsed;
		}
		if (settings[key]?.setting !== undefined || 
			settings[key]?.textsetting !== undefined || 
			settings[key]?.optionsetting !== undefined || 
			settings[key]?.numbersetting !== undefined) {
		  events.add(eventId);
		}
	  }
	});
  });

  return Array.from(events).sort((a, b) => a - b);
}
function updateAllMidiSelects() {
  document.querySelectorAll("select[data-optionsetting^='mididevice'], select[data-optionsetting='midiOutputDevice']").forEach(select => {
    const currentValue = select.value;
    
    // Repopulate the select
    populateMidiDeviceSelect(select);
    
    // Restore previous selection if it was set
    if (currentValue) {
      const option = Array.from(select.options).find(opt => opt.value === currentValue);
      if (!option && currentValue) {
        // Device not found, add it as disconnected
        const disconnectedOption = document.createElement('option');
        disconnectedOption.textContent = currentValue;
        disconnectedOption.value = currentValue;
        disconnectedOption.style.color = 'red';
        select.appendChild(disconnectedOption);
        disconnectedOption.selected = true;
      } else if (option) {
        option.selected = true;
      }
    }
  });
}
function populateMidiDeviceSelect(select) {
  if (!select) return;
  
  // Clear existing options
  select.innerHTML = '';
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.textContent = 'Default MIDI Device';
  defaultOption.value = '';
  select.appendChild(defaultOption);
  
  // Add available devices if WebMidi is enabled
  if (window.WebMidi?.enabled) {
    WebMidi.outputs.forEach(output => {
      const option = document.createElement('option');
      option.textContent = output.name;
      option.value = output.name;
      select.appendChild(option);
    });
  }
}
function initializeTabSystem(containerId, eventType, existingEventIds = [], response = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Create tab container structure
  const tabSystem = document.createElement('div');
  tabSystem.className = 'tab-container';
  tabSystem.innerHTML = `
    <div class="tab-header">
      <button class="add-new-tab">+ Add New</button>
    </div>
    <div class="tab-content-container"></div>
  `;
  
  container.innerHTML = '';
  container.appendChild(tabSystem);

  const tabHeader = tabSystem.querySelector('.tab-header');
  const contentContainer = tabSystem.querySelector('.tab-content-container');
  
  // Find all existing events from settings
  const activeEvents = findExistingEvents(eventType, response); 
  const deletedIds = new Set();
  let tabCount = activeEvents.length > 0 ? Math.max(...activeEvents) : 0;

	function createNewTab(tabId) {
	  const tabButton = document.createElement('div');
	  tabButton.className = 'tab-button';
	  tabButton.setAttribute('data-tab', tabId);
	  tabButton.innerHTML = `Event ${tabId}<span class="delete-tab">&times;</span>`;
	  tabHeader.insertBefore(tabButton, tabHeader.lastChild);

	  const tabContent = document.createElement('div');
	  tabContent.className = 'tab-content';
	  tabContent.setAttribute('data-tab', tabId);
	  tabContent.innerHTML = eventTemplates[eventType](tabId);

	  // Only initialize with settings if it's an existing tab being restored
	  if (response?.settings && activeEvents.includes(tabId)) {
		tabContent.querySelectorAll('input,select').forEach(input => {
		  const settingKey = input.getAttribute('data-setting') || 
							input.getAttribute('data-textsetting') || 
							input.getAttribute('data-optionsetting') || 
							input.getAttribute('data-numbersetting');
							
		  
		  if (settingKey && response.settings[settingKey]) {
			if (input.type === 'checkbox') {
			  input.checked = response.settings[settingKey]?.setting || false;
			} else if (input.type === 'text' || input.type === 'number') {
			  input.value = response.settings[settingKey]?.textsetting || response.settings[settingKey]?.numbersetting || '';
			} else if (input.tagName === 'SELECT') {
				
				const value = response.settings[settingKey]?.optionsetting;
				
				var deviceFound = false;
				if (WebMidi && (!deviceFound && settingKey.startsWith('mididevice'))){
					const defaultOption = document.createElement("option");
					defaultOption.textContent = "Default MIDI Device";
					defaultOption.value = "";
					input.appendChild(defaultOption);
					WebMidi.outputs.forEach((output) => {
					  const option = document.createElement("option");
					  option.textContent = output.name;
					  option.value = output.name;
					  if (value === output.name){
						  option.selected = true;
						  deviceFound = true;
					  }
					  input.appendChild(option);
					});
				}
				
			  
			  if (value) {
				input.value = value;
				// Ensure MIDI device exists in dropdown
				if (!deviceFound && settingKey.startsWith('mididevice') && !Array.from(input.options).some(opt => opt.value === value)) {
				  const option = document.createElement('option');
				  option.value = value;
				  option.textContent = value;
				  option.style.color = 'red';
				  input.appendChild(option);
				  option.selected = true;
				}
			  }
			}
		  }
		});
		
	  } else {
		if (eventType === 'midiCommand') {
		  const midiSelect = tabContent.querySelector(`select#mididevice${tabId}`);
		  if (midiSelect) {
			populateMidiDeviceSelect(midiSelect);
		  }
		}
	  }

	  contentContainer.appendChild(tabContent);
	  initializeInputHandlers(tabContent);
	  return { button: tabButton, content: tabContent };
	}

  tabSystem.querySelector('.add-new-tab').addEventListener('click', () => {
    // Reuse the lowest available deleted ID, or increment tabCount
    let newTabId;
    if (deletedIds.size > 0) {
      newTabId = Math.min(...deletedIds);
      deletedIds.delete(newTabId);
    } else {
      newTabId = ++tabCount;
    }
    const { button, content } = createNewTab(newTabId); 
    activateTab(newTabId);
  });

  tabSystem.addEventListener('click', (e) => {
    const tabButton = e.target.closest('.tab-button');
    if (tabButton) {
      const deleteBtn = e.target.closest('.delete-tab');
      if (deleteBtn) {
        const tabId = tabButton.getAttribute('data-tab');
        deleteTab(tabId);
      } else {
        const tabId = tabButton.getAttribute('data-tab');
        activateTab(tabId);
      }
    }
  });

	function activateTab(tabId) {
	  const previousActive = tabSystem.querySelector('.tab-button.active');
	  const newActive = tabSystem.querySelector(`.tab-button[data-tab="${tabId}"]`);
	  
	  if (previousActive === newActive) return;
	  
	  tabSystem.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
	  tabSystem.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
	  
	  newActive?.classList.add('active');
	  const newContent = tabSystem.querySelector(`.tab-content[data-tab="${tabId}"]`);
	  newContent?.classList.add('active');
	  
	  // Ensure MIDI devices are populated in the newly activated tab
	  if (eventType === 'midiCommand') {
		const midiSelect = newContent?.querySelector(`select#mididevice${tabId}`);
		if (midiSelect) {
		  populateMidiDeviceSelect(midiSelect);
		}
	  }
	}

	function deleteTab(tabId) {
	  const button = tabSystem.querySelector(`.tab-button[data-tab="${tabId}"]`);
	  const content = tabSystem.querySelector(`.tab-content[data-tab="${tabId}"]`);
	  
	  deletedIds.add(parseInt(tabId));
	  
	  if (button.classList.contains('active')) {
		const nextTab = button.nextElementSibling;
		const prevTab = button.previousElementSibling;
		if (nextTab && !nextTab.classList.contains('add-new-tab')) {
		  activateTab(nextTab.getAttribute('data-tab'));
		} else if (prevTab) {
		  activateTab(prevTab.getAttribute('data-tab'));
		}
	  }

	  // Clear all associated settings for this tab ID
	  const settingsToDelete = [];
	  const prefixes = patterns[eventType].prefixes;
	  
	  content.querySelectorAll('input').forEach(input => {
		const settingKey = input.getAttribute('data-setting') || 
						  input.getAttribute('data-textsetting') || 
						  input.getAttribute('data-optionsetting') || 
						  input.getAttribute('data-numbersetting');
		
		if (settingKey) {
		  // Remove from response settings if they exist
		  if (response?.settings?.[settingKey]) {
			delete response.settings[settingKey];
		  }
		  
		  // Clear the input value
		  if (input.type === 'checkbox') {
			input.checked = false;
		  } else {
			input.value = '';
		  }
		  
		  // Trigger change event to update settings
		  input.dispatchEvent(new Event('change'));
		}
	  });

	  button.remove();
	  content.remove();
	}
  
	 if (activeEvents.length > 0) {
		activeEvents.forEach((eventId, index) => {
		  const newTab = createNewTab(eventId);
		  if (index === 0) {
			newTab.button.classList.add('active');
			newTab.content.classList.add('active');
		  }
		});
	  } else {
		// Create initial tab if no existing events
		const newTab = createNewTab(1);
		newTab.button.classList.add('active');
		newTab.content.classList.add('active');
		tabCount = 1;
	  }
}

const sourceTypes = ['relaytargets','eventsSources','ttssources'];
const commaTagInputs = ['questionKeywords', 'filtercommandscustomwords', 'bottriggerwords', 'filterevents', 'dockfilterevents', 'featuredfilterevents'];
const userTypes = ['botnamesext', 'modnamesext', 'viplistusers', 'adminnames', 'hostnamesext', 'blacklistusers', 'whitelistusers'];
const sourcesList = new Set();
var sortedSourcesListCache = null;
var popupSourceDatalistLoaded = false;

function formatSourceLabel(source) {
    source = String(source || "");
    return source ? source.charAt(0).toUpperCase() + source.slice(1) : "";
}

function getSortedSourcesList() {
    if (!sortedSourcesListCache) {
        sortedSourcesListCache = Array.from(sourcesList).sort();
    }
    return sortedSourcesListCache;
}

function loadSourcesListFromRuntimeManifest() {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
            const manifest = chrome.runtime.getManifest();
            return collectSourcesFromManifest(manifest) > 0;
        }
    } catch (error) {
        console.warn('Unable to load sources from chrome.runtime manifest:', error);
    }
    return sourcesList.size > 0;
}

function appendSourceOptions(select) {
    if (!select || select.dataset.sourceOptionsLoaded === "true") return;
    const currentValue = select.value;
    getSortedSourcesList().forEach(source => {
        const option = document.createElement('option');
        option.value = source;
        option.textContent = formatSourceLabel(source);
        select.appendChild(option);
    });
    if (currentValue) {
        select.value = currentValue;
    }
    select.dataset.sourceOptionsLoaded = "true";
}

function populateSourceDatalist() {
    const datalist = document.getElementById("popupSourceTypesList") || (function() {
        const list = document.createElement("datalist");
        list.id = "popupSourceTypesList";
        document.body.appendChild(list);
        return list;
    })();

    if (popupSourceDatalistLoaded) return datalist;

    datalist.innerHTML = "";
    getSortedSourcesList().forEach(source => {
        const option = document.createElement("option");
        option.value = source;
        option.label = formatSourceLabel(source);
        datalist.appendChild(option);
    });
    popupSourceDatalistLoaded = true;
    return datalist;
}

function ensureLazySourcesLoaded(callback) {
    if (sourcesList.size > 0 || loadSourcesListFromRuntimeManifest()) {
        if (callback) callback();
        return Promise.resolve(true);
    }
    return ensureSourcesListLoaded().then(function(loaded) {
        if (loaded && callback) callback();
        return loaded;
    });
}

function setupLazySourceSelect(select) {
    if (!select || select.dataset.lazySourceSelect === "true") return;
    select.dataset.lazySourceSelect = "true";
    const load = function() {
        ensureLazySourcesLoaded(function() {
            appendSourceOptions(select);
        });
    };
    select.addEventListener("focus", load);
    select.addEventListener("mousedown", load);
    select.addEventListener("touchstart", load);
    select.addEventListener("keydown", load);
}

function setupLazySourceInput(input) {
    if (!input || input.dataset.lazySourceInput === "true") return;
    input.dataset.lazySourceInput = "true";
    input.setAttribute("list", "popupSourceTypesList");
    const load = function() {
        ensureLazySourcesLoaded(function() {
            populateSourceDatalist();
        });
    };
    input.addEventListener("focus", load);
    input.addEventListener("mousedown", load);
    input.addEventListener("touchstart", load);
    input.addEventListener("keydown", load);
}

function ensureSelectValueOption(select, value, label) {
    if (!select || value === undefined || value === null || value === "") return;
    value = String(value);
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === value) return;
    }

    const option = document.createElement("option");
    option.value = value;
    option.textContent = label || value;
    if (value.indexOf("lang=") !== -1) {
        try {
            const params = new URLSearchParams(value);
            const lang = params.get("lang");
            const voice = params.get("voice");
            if (lang) option.setAttribute("data-lang", lang);
            if (voice) option.setAttribute("data-name", voice);
        } catch (e) {}
    }
    option.dataset.lazyStoredValue = "true";
    select.appendChild(option);
}

function collectSourcesFromManifest(manifestData) {
    if (!manifestData || !Array.isArray(manifestData.content_scripts)) {
        return 0;
    }

    let added = 0;
    try {
        manifestData.content_scripts.forEach(script => {
            if (!script || !Array.isArray(script.js)) {
                return;
            }
            script.js.forEach(jsFile => {
                if (typeof jsFile !== 'string') {
                    return;
                }
                const normalized = jsFile.trim();
                if (!normalized.startsWith('./sources/') || !normalized.endsWith('.js')) {
                    return;
                }
                const sourceName = normalized.replace('./sources/', '').replace('.js', '');
                if (sourceName) {
                    const previousSize = sourcesList.size;
                    sourcesList.add(sourceName);
                    if (sourcesList.size > previousSize) {
                        added++;
                    }
                }
            });
        });
    } catch (error) {
        console.warn('Failed to collect sources from manifest:', error);
    }
    if (added) {
        sortedSourcesListCache = null;
        popupSourceDatalistLoaded = false;
    }
    return added;
}

async function ensureSourcesListLoaded(options = {}) {
    if (sourcesList.size > 0) {
        return true;
    }

    if (loadSourcesListFromRuntimeManifest()) {
        return true;
    }

    if (window.ssappFallback && typeof window.ssappFallback.readJson === 'function') {
        try {
            const branch = options.branch || urlParams.get('branch') || 'main';
            const manifestData = await window.ssappFallback.readJson('manifest.json', { branch });
            if (collectSourcesFromManifest(manifestData)) {
                return true;
            }
        } catch (error) {
            console.warn('Unable to load sources via ssapp fallback manifest:', error);
        }
    }

    try {
        const manifestUrl = new URL('manifest.json', window.location.href).toString();
        const response = await fetch(manifestUrl);
        if (response.ok) {
            const manifestData = await response.json();
            if (collectSourcesFromManifest(manifestData)) {
                return true;
            }
        }
    } catch (error) {
        console.warn('Unable to fetch manifest.json for sources list:', error);
    }

    return sourcesList.size > 0;
}


// Function to handle custom JS file upload
function uploadCustomJsFile() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.js';
  
  fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size before reading (1MB limit)
    if (file.size > 1 * 1024 * 1024) {
      alert('File is too large. Maximum size is 1MB.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const contents = e.target.result;
      // Limit content size
      const maxLength = 100000;
      const truncatedContents = contents.length > maxLength ? 
        contents.substring(0, maxLength) : contents;
        
      chrome.runtime.sendMessage({
        cmd: 'uploadCustomJs', 
        data: truncatedContents
      }, function(response) {
        if (response && response.success) {
          alert('Custom JavaScript file uploaded and activated successfully.');
          // Update the UI to show the file is now active
          document.getElementById('customJsEnabled').checked = true;
          updateSettings(document.getElementById('customJsEnabled'), true);
        } else {
          alert('Failed to upload custom JavaScript file: ' + (response && response.error ? response.error : 'Unknown error'));
        }
      });
    };
    
    reader.onerror = function() {
      alert('Error reading file.');
    };
    
    reader.readAsText(file);
  });
  
  fileInput.click();
}

function deleteCustomJsFile() {
  if (confirm('Are you sure you want to delete the custom JavaScript file?')) {
    chrome.runtime.sendMessage({cmd: 'deleteCustomJs'}, function(response) {
      if (response && response.success) {
        alert('Custom JavaScript file deleted and deactivated successfully.');
        // Update the UI to show the file is now inactive
        document.getElementById('customJsEnabled').checked = false;
        updateSettings(document.getElementById('customJsEnabled'), true);
      } else {
        alert('Failed to delete custom JavaScript file.');
      }
    });
  }
}

let tabsInitialized = false;

function createTabsFromSettings(response) {
  if (!response || !response.settings) return;

  // Clear existing tabs first
  const containers = ['webhookRelayUrls', 'botReplyMessages', 'chatCommands', 'timedMessages', 'midiCommands'];
  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; // Clear existing content
  });

  // Track existing events for each type
  const existingEvents = {
    webhookRelay: new Set(),
    botReply: new Set(),
    chatCommand: new Set(),
    timedMessage: new Set(),
	midiCommand: new Set()
  };

  // Scan settings for event configurations
  Object.keys(response.settings).forEach(key => {
    // Bot Reply Messages
    if (key.startsWith('botReplyMessageEvent')) {
      const id = key.replace('botReplyMessageEvent', '');
      if (response.settings[key].setting || 
          response.settings[`botReplyMessageCommand${id}`]?.textsetting ||
          response.settings[`botReplyMessageValue${id}`]?.textsetting) {
        existingEvents.botReply.add(parseInt(id));
      }
    }
    // Chat Commands
    else if (key.startsWith('chatevent')) {
      const id = key.replace('chatevent', '');
      if (response.settings[key].setting || 
          response.settings[`chatcommand${id}`]?.textsetting ||
          response.settings[`chatwebhook${id}`]?.textsetting) {
        existingEvents.chatCommand.add(parseInt(id));
      }
    }
    // Timed Messages
    else if (key.startsWith('timemessageevent')) {
      const id = key.replace('timemessageevent', '');
      if (response.settings[key].setting || response.settings[`timemessagecommand${id}`]?.textsetting) {
        existingEvents.timedMessage.add(parseInt(id));
      }
    }
	// MIDI Messages
	else if (key.startsWith('midicommandevent')) {
      const id = key.replace('midicommandevent', '');
      if (response.settings[key].setting || response.settings[`midicommand${id}`]?.textsetting || response.settings[`midinote${id}`]?.numbersetting || response.settings[`mididevice${id}`]?.optionsetting){
        existingEvents.midiCommand.add(parseInt(id));
      }
    }
    // Webhook relay destinations
    else if (key.startsWith('webhookrelayurl')) {
      const entry = response.settings[key];
      const value = typeof entry === 'string' ? entry : entry?.textsetting;
      if (typeof value === 'string' && value.trim()) {
        const suffix = key.replace('webhookrelayurl', '');
        let id = 1;
        if (suffix && /^\d+$/.test(suffix)) {
          id = parseInt(suffix, 10);
        }
        existingEvents.webhookRelay.add(id);
      }
    }
  });

  if (existingEvents.webhookRelay.size > 0) {
    initializeTabSystem('webhookRelayUrls', 'webhookRelay', Array.from(existingEvents.webhookRelay), response);
  } else {
    initializeTabSystem('webhookRelayUrls', 'webhookRelay', [1], response);
  }

  // Initialize tab systems with found events
  if (existingEvents.botReply.size > 0) {
    initializeTabSystem('botReplyMessages', 'botReply', Array.from(existingEvents.botReply), response);
  } else {
    initializeTabSystem('botReplyMessages', 'botReply', [1], response);
  }

  if (existingEvents.chatCommand.size > 0) {
    initializeTabSystem('chatCommands', 'chatCommand', Array.from(existingEvents.chatCommand), response);
  } else {
    initializeTabSystem('chatCommands', 'chatCommand', [1], response);
  }
  
  if (existingEvents.timedMessage.size > 0) {
    initializeTabSystem('timedMessages', 'timedMessage', Array.from(existingEvents.timedMessage), response);
  } else {
    initializeTabSystem('timedMessages', 'timedMessage', [1], response);
  }
  
  if (existingEvents.midiCommand.size > 0) {
    initializeTabSystem('midiCommands', 'midiCommand', Array.from(existingEvents.midiCommand), response);
  } else {
    initializeTabSystem('midiCommands', 'midiCommand', [1], response);
  }
}

var streamID = false;
var lastResponse = false;

function getPopupVersionParam() {
  try {
    const manifestData = chrome.runtime.getManifest();
    if (manifestData && manifestData.version) {
      return `&v=${manifestData.version}`;
    }
  } catch (e) {
    console.error("Error getting version from manifest:", e);
  }
  return "";
}

function getAiOverlayControlValue(id, fallback = "") {
  const ele = document.getElementById(id);
  if (!ele) return fallback;
  if (ele.type === "checkbox") {
    return ele.checked;
  }
  const value = (ele.value || "").trim();
  return value || fallback;
}

function getAiOverlayPasswordParam(response) {
  let password = "";
  if (response && response.password) {
    password = "&password=" + response.password;
  }
  if (urlParams.has("localserver")) {
    password += "&localserver";
  }
  return password;
}

function updateAiOverlayGeneratedLinks(hideLinks, baseURL, streamID, password, versionParam = "") {
  const label = getAiOverlayControlValue("aiOverlayLabel", "cohost-overlay");
  const name = getAiOverlayControlValue("aiOverlayName", "");
  const avatar = getAiOverlayControlValue("aiOverlayAvatar", "");
  const position = getAiOverlayControlValue("aiOverlayPosition", "bottom-right");
  const scale = getAiOverlayControlValue("aiOverlayScale", "1");
  const tts = !!getAiOverlayControlValue("aiOverlayTts", false);
  const params = [
    "session=" + encodeURIComponent(streamID),
    "label=" + encodeURIComponent(label),
    "position=" + encodeURIComponent(position)
  ];
  if (password) {
    password.split("&").filter(Boolean).forEach(part => params.push(part));
  }
  if (name) params.push("name=" + encodeURIComponent(name));
  if (avatar) params.push("avatar=" + encodeURIComponent(avatar));
  if (scale && scale !== "1") params.push("scale=" + encodeURIComponent(scale));
  if (tts) params.push("tts");
  if (versionParam) {
    versionParam.split("&").filter(Boolean).forEach(part => params.push(part));
  }

  const overlayUrl = baseURL + "cohost-overlay.html?" + params.join("&");
  const overlayElement = document.getElementById("aioverlay");
  const overlayLink = document.getElementById("aioverlaylink");
  if (overlayElement) overlayElement.raw = overlayUrl;
  if (overlayLink) {
    overlayLink.href = overlayUrl;
    overlayLink.innerText = hideLinks ? "Click to open link" : overlayUrl;
  }

  const cohostElement = document.getElementById("cohost");
  const cohostLink = document.getElementById("cohostlink");
  if (cohostElement && typeof cohostElement.raw === "string" && cohostElement.raw) {
    let cohostUrl = removeQueryParamWithValue(cohostElement.raw, "aioverlay");
    cohostUrl = updateURL("aioverlay=" + encodeURIComponent(label), cohostUrl);
    cohostElement.raw = cleanURL(cohostUrl);
    if (cohostLink) {
      cohostLink.href = cohostElement.raw;
      cohostLink.innerText = hideLinks ? "Click to open link" : cohostElement.raw;
    }
  }
}

function updateAiOverlayLinksFromCurrentState() {
  if (!lastResponse || !lastResponse.streamID) return;
  updateAiOverlayGeneratedLinks(
    document.body.classList.contains("hidelinks"),
    baseURL,
    lastResponse.streamID,
    getAiOverlayPasswordParam(lastResponse),
    getPopupVersionParam()
  );
}

function getSelectedTranslationLinkParam() {
  let lang = "";
  try {
    const languageSelect = document.querySelector('select[data-optionsetting="translationlanguage"]');
    lang = languageSelect && languageSelect.value ? languageSelect.value : "";
  } catch (e) {}
  try {
    if (!lang && lastResponse && lastResponse.settings && lastResponse.settings.translationlanguage) {
      lang = lastResponse.settings.translationlanguage.optionsetting || "";
    }
  } catch (e) {}
  lang = (lang || "").trim();
  return lang ? `&ln=${encodeURIComponent(lang)}` : "";
}

const DEFAULT_CHAT_OVERLAY_TEMPLATE = "sampleoverlay.html";
// Theme-specific (flavor) option sections. Only themes with a real, theme-unique
// toggle appear here. The shared common-params section is handled separately via
// CHAT_OVERLAY_COMMON_SUPPORT below.
const CHAT_OVERLAY_TEMPLATE_CONFIGS = {
  "sampleoverlay.html": "sampleoverlay-overlay-config",
  "themes/compact-classic.html": "compact-overlay-config",
  "themes/compact-clean.html": "compact-overlay-config",
  "themes/compact-glass.html": "compact-overlay-config",
  "themes/overlay-neon-cyberpunk.html": "overlay-neon-cyberpunk-overlay-config",
  "themes/overlay-particles.html": "overlay-particles-overlay-config",
  "themes/overlay-typewriter.html": "overlay-typewriter-overlay-config",
  "themes/overlay-bubbles.html": "overlay-bubbles-overlay-config",
  "themes/overlay-cards.html": "overlay-cards-overlay-config",
  "themes/horizontal.html": "horizontal-overlay-config",
  "themes/overlay-ticker-news.html": "ticker-news-overlay-config",
  "themes/overlay-danmaku.html": "danmaku-overlay-config",
  "themes/Neutron/chatOnly.html": "Neutron-overlay-config",
  "themes/Neutron/stream.html": "Neutron-overlay-config",
  "themes/Windows3.1/index.html": "Windows3-overlay-config",
  "themes/t3nk3y/index.html": "t3nk3y-overlay-config"
};

// Themes that support the shared common tweaks (hide bots, chroma key, font size,
// font family). The compact themes carry their own richer section, so they are
// intentionally excluded here (their section already covers these).
const CHAT_OVERLAY_COMMON_SUPPORT = new Set([
  "themes/overlay-neon-cyberpunk.html",
  "themes/overlay-particles.html",
  "themes/overlay-typewriter.html",
  "themes/overlay-bubbles.html",
  "themes/overlay-cards.html",
  "themes/overlay-comic-pop.html",
  "themes/overlay-comic-classic.html",
  "themes/horizontal.html",
  "themes/overlay-ticker-news.html",
  "themes/overlay-danmaku.html",
  "themes/overlay-xacception.html",
  "themes/pretty.html",
  "themes/Windows3.1/index.html",
  "themes/deuks_overlay/overlay1.html",
  "themes/deuks_overlay/overlay2.html",
  "themes/rainbowpuke/index.html",
  "themes/t3nk3y/index.html",
  "themes/LuckyLootTube/luckyloottube.html"
]);

function getSelectedChatOverlayTemplatePath() {
  const selector = document.getElementById("overlay-preset-select");
  if (selector && selector.value) {
    return selector.value;
  }
  return DEFAULT_CHAT_OVERLAY_TEMPLATE;
}

function getKnownSessionParamValue() {
  const sessionInput = document.getElementById("sessionid");
  if (sessionInput && sessionInput.value) {
    return encodeURIComponent(sessionInput.value);
  }
  if (lastResponse && lastResponse.streamID) {
    return encodeURIComponent(lastResponse.streamID);
  }
  return "";
}

function getGeneratedLinkParams(primaryElement, fallbackElement) {
  let raw = "";
  if (primaryElement && primaryElement.raw && primaryElement.raw.indexOf("?") !== -1) {
    raw = primaryElement.raw;
  } else if (fallbackElement && fallbackElement.raw && fallbackElement.raw.indexOf("?") !== -1) {
    raw = fallbackElement.raw;
  }

  if (raw) {
    let params = raw.split("?")[1] || "";
    // Some raw URLs (e.g. theme option-only states) can carry a query string without a
    // session. Always guarantee a valid session so generated overlay links work.
    if (!/(^|&)session=[^&]+/.test(params)) {
      const knownSession = getKnownSessionParamValue();
      if (knownSession) {
        params = params
          .split("&")
          .filter(function (part) { return part && part.indexOf("session=") !== 0; })
          .join("&");
        params = "session=" + knownSession + (params ? "&" + params : "");
      }
    }
    return params;
  }

  const knownSession = getKnownSessionParamValue();
  if (knownSession) {
    return "session=" + knownSession;
  }

  return "";
}

function setGeneratedLink(element, url) {
  if (!element) return;
  element.raw = cleanURL(url);

  const linkId = element.id + "link";
  let link = document.getElementById(linkId);
  if (!link) {
    link = element.querySelector("a");
  }
  if (!link) {
    element.innerHTML = `<a target='_blank' id='${linkId}' href='${element.raw}'>${document.body.classList.contains("hidelinks") ? "Click to open link" : element.raw}</a>`;
    return;
  }

  link.href = element.raw;
  link.innerText = document.body.classList.contains("hidelinks") ? "Click to open link" : element.raw;
}

function moveChatOverlayThemeOptions() {
  const templateElement = document.getElementById("chatoverlaytemplate");
  const templateSection = templateElement ? templateElement.closest(".link") : null;
  const optionsWrapper = document.getElementById("chatOverlayThemeOptionsWrapper");
  if (templateSection && optionsWrapper && optionsWrapper.previousElementSibling !== templateSection) {
    templateSection.insertAdjacentElement("afterend", optionsWrapper);
  }
  const designNote = document.querySelector(".chat-overlay-design-note");
  if (designNote && optionsWrapper && designNote.previousElementSibling !== optionsWrapper) {
    optionsWrapper.insertAdjacentElement("afterend", designNote);
  }
}

function moveHypetrainOptionsIntoMetaSection() {
  const hypetrainWrapper = document.getElementById("wrapper-hypetrain-options")?.closest(".wrapper");
  const metaWrapper = document.getElementById("wrapper-meta-options")?.closest(".wrapper");
  if (!hypetrainWrapper || !metaWrapper) return;

  let anchor = document.getElementById("hype-train-bar");
  if (!anchor) {
    anchor = document.createElement("a");
    anchor.href = "";
    anchor.id = "hype-train-bar";
  }

  if (hypetrainWrapper.previousElementSibling !== anchor) {
    metaWrapper.insertAdjacentElement("afterend", hypetrainWrapper);
    metaWrapper.insertAdjacentElement("afterend", anchor);
  }
}

function syncChatOverlayTemplateConfig(templatePath) {
  moveChatOverlayThemeOptions();
  const optionsWrapper = document.getElementById("chatOverlayThemeOptionsWrapper");
  let activeSection = null;
  const normalizedPath = (templatePath || DEFAULT_CHAT_OVERLAY_TEMPLATE).split("?")[0];
  const configId = CHAT_OVERLAY_TEMPLATE_CONFIGS[normalizedPath] || "";

  document.querySelectorAll(".overlay-config-section").forEach(function(section) {
    section.style.display = "none";
  });

  let anyShown = false;

  // Shared common-tweaks section (hide bots, chroma, font size, font family),
  // shown for any theme that supports those params.
  const commonSection = document.getElementById("common-overlay-config");
  if (commonSection && CHAT_OVERLAY_COMMON_SUPPORT.has(normalizedPath)) {
    commonSection.style.display = "block";
    anyShown = true;
  }

  if (configId) {
    activeSection = document.getElementById(configId);
    if (activeSection) {
      activeSection.style.display = "block";
      anyShown = true;
    }
  }

  if (optionsWrapper) {
    optionsWrapper.style.display = anyShown ? "" : "none";
  }
}

function applyChatOverlayTemplatePreset(presetValue, options) {
  options = options || {};
  const templateElement = document.getElementById("chatoverlaytemplate");
  if (!templateElement) return;

  const selector = document.getElementById("overlay-preset-select");
  let templatePath = presetValue || DEFAULT_CHAT_OVERLAY_TEMPLATE;
  if (selector) {
    const hasMatchingOption = Array.prototype.some.call(selector.options, function(option) {
      return option.value === templatePath;
    });
    if (!hasMatchingOption) {
      templatePath = DEFAULT_CHAT_OVERLAY_TEMPLATE;
    }
    if (selector.value !== templatePath) {
      selector.value = templatePath;
    }
  }

  const dockElement = document.getElementById("dock");
  const params = options.preferDockParams ? getGeneratedLinkParams(dockElement, templateElement) : getGeneratedLinkParams(templateElement, dockElement);
  let templateUrl = baseURL + (templatePath || DEFAULT_CHAT_OVERLAY_TEMPLATE);
  if (params) {
    templateUrl += (templateUrl.indexOf("?") === -1 ? "?" : "&") + params;
  }

  setGeneratedLink(templateElement, templateUrl);
  syncChatOverlayTemplateConfig(templatePath);
  if (!options.skipRefresh) {
    refreshLinks();
  }
}

function syncChatOverlayTemplateLinkFromDock() {
  const templateElement = document.getElementById("chatoverlaytemplate");
  if (!templateElement) return;
  applyChatOverlayTemplatePreset(getSelectedChatOverlayTemplatePath(), {
    skipRefresh: true
  });
}

function setupPageLinks(hideLinks, baseURL, streamID, password) {
  // Get any custom parameters from the current URL
  let customParams = getSelectedTranslationLinkParam();
  try {
    const currentUrl = new URL(window.location.href);
    
    // List of parameters to ignore (TTS-related and standard ones)
    const ignoreParams = ['session', 'password', 'localserver'];
  const ttsRelatedParams = [
    'ttsprovider', 'lang', 'voice', 'rate', 'pitch',
    'elevenlabskey', 'elevenlabsmodel', 'elevenlabsvoice', 'elevenlatency', 'elevenstability', 
    'elevensimilarity', 'elevenstyle', 'elevenspeakerboost', 'elevenrate',
    'googleapikey', 'googlevoice', 'googleaudioprofile', 'googlerate', 'googlelang',
    'geminikey', 'geminimodel', 'voicegemini', 'geminilang', 'geministyle', 'geminiprompt',
    'speechifykey', 'speechifyvoice', 'voicespeechify', 'speechifymodel', 'speechifylang', 'speechifyspeed',
    'kokorokey', 'voicekokoro', 'kokorospeed'
  ];
    
    // Combine all params to ignore
    const allIgnoreParams = [...ignoreParams, ...ttsRelatedParams];
    
    // Add all custom parameters that are not in the ignore list
    //currentUrl.searchParams.forEach((value, key) => {
    //  if (!allIgnoreParams.includes(key)) {
   //     customParams += `&${key}=${encodeURIComponent(value)}`;
   //   }
   // });
  } catch (e) {
    console.error("Error getting custom params:", e);
  }
  
  let versionParam = getPopupVersionParam();
  
  // Configuration array with all page details
  const pages = [
    { id: "dock", path: "dock.html" },
    { id: "chatoverlaytemplate", path: getSelectedChatOverlayTemplatePath() },
    { id: "overlay", path: "featured.html" },
    { id: "multialerts", path: "multi-alerts.html" },
    { id: "emoteswall", path: "emotes.html" },
    { id: "hypemeter", path: "hype.html" },
    { id: "hypetrain", path: "meta.html", defaultParams: "&hype" },
    { id: "meta", path: "meta.html" },
    { id: "waitlist", path: "waitlist.html" },
    { id: "tipjar", path: "tipjar.html" },
	{ id: "leaderboard", path: "leaderboard.html" },
	{ id: "games", path: "games.html" },
    { id: "ticker", path: "ticker.html" },
    { id: "wordcloud", path: "wordcloud.html" },
    { id: "poll", path: "poll.html" },
    { id: "chatbot", path: "bot.html", linkPath: "chatbot.html" },
	{ id: "cohost", path: "cohost.html" },
    { id: "giveaway", path: "giveaway.html" },
    { id: "credits", path: "credits.html" },
    { id: "privatechatbot", path: "chatbot.html", style: "color:lightblue;" },
    { id: "aiprompt", path: "aiprompt.html" },
    { id: "aioverlay", path: "cohost-overlay.html" },
    { id: "eventsdashboard", path: "events.html" },
	{ id: "reactions", path: "reactions.html" },
	{ id: "flowactions", path: "actions.html" },
	{ id: "custom-gif-commands", path: "gif.html" },
	{ id: "spotify", path: "spotify-overlay.html" },
	{ id: "scoreboard", path: "scoreboard.html"},
	{ id: "map", path: "map.html" },
	{ id: "timer", path: "timer.html" },
	
  ];
  
  // Process all standard pages
  pages.forEach(page => {
    // Skip featured overlay update if a preset is selected
    if (page.id === "overlay") {
      const featuredPresetSelector = document.getElementById('featured-preset-select');
      if (featuredPresetSelector && featuredPresetSelector.value) {
        return; // Skip updating featured overlay when preset is active
      }
    }
    
    const linkPath = page.linkPath || page.path;
    const pageDefaultParams = page.defaultParams || "";
    const fullURL = `${baseURL}${page.path}?session=${streamID}${password}${customParams}${pageDefaultParams}${versionParam}`;
    const displayURL = `${baseURL}${linkPath}?session=${streamID}${password}${customParams}${pageDefaultParams}${versionParam}`;
    const element = document.getElementById(page.id);
    
    if (element) {
      const linkStyle = page.style ? `style="${page.style}"` : "";
      element.innerHTML = hideLinks 
        ? "Click to open link" 
        : `<a target='_blank' ${linkStyle} id='${page.id}link' href='${fullURL}'>${displayURL}</a>`;
      element.raw = fullURL;
    }
  });

  syncChatOverlayTemplateLinkFromDock();
  updateAiOverlayGeneratedLinks(hideLinks, baseURL, streamID, password, versionParam);
  
  // Update sample overlay and remote control URLs too
  const sampleOverlay = document.getElementById("sampleoverlay");
  if (sampleOverlay) {
    sampleOverlay.href = `${baseURL}sampleoverlay.html?session=${streamID}${password}${customParams}${versionParam}`;
  }
  
  const remoteControlUrl = document.getElementById("remote_control_url");
  if (remoteControlUrl) {
    remoteControlUrl.href = `${baseURL}sampleapi.html?session=${streamID}${password}${customParams}${versionParam}`;
  }

  syncAllOverlayPreviews();
}

function applyFeaturedOverlayPreset(presetValue) {
	const overlayDiv = document.getElementById('overlay');
	const overlayLink = document.getElementById('overlaylink');
	const presetSelector = document.getElementById('featured-preset-select');

	if (!overlayDiv || !overlayLink) {
		return;
	}

	if (typeof presetValue === 'string' && presetSelector && presetSelector.value !== presetValue) {
		presetSelector.value = presetValue;
	}

	document.querySelectorAll('.preset-config-section').forEach(section => {
		section.style.display = 'none';
	});

	const toggleClassicOptions = (show) => {
		document.querySelectorAll('.wrapper:has(.options_group.single_message)').forEach(wrapper => {
			wrapper.style.display = show ? '' : 'none';
		});
	};

	if (presetValue) {
		const presetUrl = baseURL + presetValue;
		let currentParams = overlayDiv.raw?.split('?')[1] || '';
		let session = '';

		if (currentParams) {
			const params = new URLSearchParams(currentParams);
			session = params.get('session') || params.get('room') || '';
		}

		if (!session) {
			const sessionInput = document.getElementById('sessionid');
			if (sessionInput && sessionInput.value) {
				session = sessionInput.value;
			}
		}

		let newUrl = presetUrl;
		if (session) {
			newUrl += (presetUrl.includes('?') ? '&' : '?') + 'session=' + session;
		}

		overlayDiv.raw = newUrl;
		overlayLink.href = newUrl;
		overlayLink.innerText = document.body.classList.contains('hidelinks') ? 'Click to open link' : newUrl;

		toggleClassicOptions(false);

		const presetType = presetValue.match(/featured-(\w+)\.html/)?.[1];
		if (presetType) {
			const presetConfigSection = document.getElementById(`preset-config-${presetType}`);
			if (presetConfigSection) {
				presetConfigSection.style.display = 'block';
			}
		}
	} else {
		let currentParams = overlayDiv.raw?.split('?')[1] || '';

		if (!currentParams) {
			const sessionInput = document.getElementById('sessionid');
			if (sessionInput && sessionInput.value) {
				currentParams = 'session=' + sessionInput.value;
			}
		}

		const classicUrl = baseURL + 'featured.html' + (currentParams ? '?' + currentParams : '');

		overlayDiv.raw = classicUrl;
		overlayLink.href = classicUrl;
		overlayLink.innerText = document.body.classList.contains('hidelinks') ? 'Click to open link' : classicUrl;

		toggleClassicOptions(true);
	}

	refreshLinks();
}

function removeTTSProviderParams(url, selectedProvider=null) {
  if (!url) return url;

  const rawSelectedProvider = (selectedProvider || "").toString().toLowerCase();
  const providerAliases = {
      custom: "openai",
      customtts: "openai",
      local: "openai",
      localtts: "openai",
      node: "openai",
      nodejs: "openai",
      connector: "openai"
  };
  
  // Map of all provider-specific parameters
    const providerParams = {
        system: ['lang', 'voice', 'rate', 'pitch'],
        elevenlabs: ['elevenlabskey', 'elevenlabsmodel', 'elevenlabsvoice', 'elevenlatency','elevenstability','elevensimilarity','elevenstyle','elevenspeakerboost','elevenrate','voice11'],
        google: ['googleapikey', 'googlevoice','googleaudioprofile','googlerate','googlelang'],
        gemini: ['geminikey', 'geminimodel', 'voicegemini', 'geminilang', 'geministyle', 'geminiprompt'],
        speechify: ['speechifykey', 'speechifyvoice','voicespeechify' ,'speechifymodel','speechifylang','speechifyspeed'],
        kokoro: ['kokorokey', 'voicekokoro', 'kokorospeed'],
        kitten: ['kittenvoice', 'kittenspeed', 'kittensamplerate'],
        openai: ['openaikey', 'customttskey', 'localttskey', 'openaiendpoint', 'customttsendpoint', 'localttsendpoint', 'voiceopenai', 'customttsvoice', 'localttsvoice', 'openaimodel', 'customttsmodel', 'localttsmodel', 'openaispeed', 'customttsspeed', 'localttsspeed', 'openaiformat', 'customttsformat', 'localttsformat', 'openaicustomvoice', 'openaicustommodelx']
    };
  
  if (selectedProvider === null) {
    try {
      const tmpUrl = new URL(url);
      const urlParams2 = new URLSearchParams(tmpUrl.search);
      selectedProvider = urlParams2.get("ttsprovider") || "system";
      if (!selectedProvider) return url;
    } catch (e) {
      return url; // Invalid URL
    }
  }
  const selectedProviderValue = (selectedProvider || "").toString().toLowerCase();
  selectedProvider = providerAliases[(selectedProvider || "").toString().toLowerCase()] || selectedProvider;
  
  // Get all parameters except those for the selected provider
  const paramsToRemove = Object.keys(providerParams)
    .filter(provider => provider !== selectedProvider)
    .flatMap(provider => providerParams[provider]);
	
  if (selectedProvider=="system"){
	  paramsToRemove.push("ttsprovider");
  }
  const selectedProviderForCleanup = rawSelectedProvider || selectedProviderValue;
  if (selectedProviderForCleanup !== "openai" && providerAliases[selectedProviderForCleanup] === "openai") {
	  paramsToRemove.push("openaikey");
  }
  
  // Remove each parameter
  let cleanedUrl = url;
  for (const param of paramsToRemove) {
    cleanedUrl = removeQueryParamWithValue(cleanedUrl, param);
  }
  
  return cleanedUrl;
}


function setupTtsProviders(response) {
    // Handle main TTS provider
    if (!response.settings?.ttsProvider?.optionsetting) {
        let ttsService = "system";
        if (response.settings?.geminikey?.textparam1) ttsService = "gemini";
        else if (response.settings?.ttskey?.textparam1) ttsService = "google";
        else if (response.settings?.googleAPIKey?.textparam1) ttsService = "google";
        else if (response.settings?.elevenlabskey?.textparam1) ttsService = "elevenlabs";
        else if (response.settings?.speechifykey?.textparam1) ttsService = "speechify";
        else if (response.settings?.openaikey?.textparam1) ttsService = "openai";
        else if (response.settings?.openaiendpoint?.textparam1) ttsService = "customtts";
        
        if (!response.settings.ttsProvider) {
            response.settings.ttsProvider = {};
        }
        response.settings.ttsProvider.optionsetting = ttsService;
    }
    
    // Handle featured TTS provider (for param2)
    if (!response.settings?.ttsProvider?.optionsetting2) {
        let ttsService = "system";
        if (response.settings?.geminikey?.textparam2) ttsService = "gemini";
        else if (response.settings?.ttskey?.textparam2) ttsService = "google";
        else if (response.settings?.googleAPIKey?.textparam2) ttsService = "google";
        else if (response.settings?.elevenlabskey?.textparam2) ttsService = "elevenlabs";
        else if (response.settings?.speechifykey?.textparam2) ttsService = "speechify";
        else if (response.settings?.openaikey?.textparam2) ttsService = "openai";
        else if (response.settings?.openaiendpoint?.textparam2) ttsService = "customtts";
        
        if (!response.settings.ttsProvider) {
            response.settings.ttsProvider = {};
        }
        response.settings.ttsProvider.optionsetting2 = ttsService;
    }
    
    // Handle secondary TTS provider (for param10)
    if (!response.settings?.ttsProvider?.optionsetting10) {
        let ttsService = "system";
        if (response.settings?.geminikey?.textparam10) ttsService = "gemini";
        else if (response.settings?.ttskey?.textparam10) ttsService = "google";
        else if (response.settings?.googleAPIKey?.textparam10) ttsService = "google";
        else if (response.settings?.elevenlabskey?.textparam10) ttsService = "elevenlabs";
        else if (response.settings?.speechifykey?.textparam10) ttsService = "speechify";
        else if (response.settings?.openaikey?.textparam10) ttsService = "openai";
        else if (response.settings?.openaiendpoint?.textparam10) ttsService = "customtts";
        
        if (!response.settings.ttsProvider) {
            response.settings.ttsProvider = {};
        }
        response.settings.ttsProvider.optionsetting10 = ttsService;
    }
}

// Process parameter settings from objects with a consistent approach
function processObjectSetting(key, settingObj, sync, paramNums, response) { // Added 'response'
    // Process all the different param types dynamically using the paramNums array
    paramNums.forEach(paramNum => {
        // Process basic param settings
        const paramKey = `param${paramNum}`;
        if (paramKey in settingObj) {
            processParam(key, paramNum, settingObj, sync);
        }

        // Process number settings
        // Special case: for param 1, the stored key is 'numbersetting' and the DOM attribute is 'data-numbersetting'
        const isParamOne = String(paramNum) === '1';
        const storedNumKey = isParamOne ? 'numbersetting' : `numbersetting${paramNum}`;
        const attrNumSuffix = isParamOne ? '' : String(paramNum);
        if (storedNumKey in settingObj) {
            const ele = document.querySelector(`input[data-numbersetting${attrNumSuffix}='${key}']`);
            if (ele) {
                ele.value = settingObj[storedNumKey];
                updateSettings(ele, sync);

                const paramEle = document.querySelector(`input[data-param${paramNum}='${key}']`);
                if (paramEle && paramEle.checked) {
                    updateSettings(paramEle, false, parseFloat(settingObj[storedNumKey]));
                }
            }
        }

        // Process text parameters
        const textParamKey = `textparam${paramNum}`;
        if (textParamKey in settingObj) {
            const ele = document.querySelector(`input[data-${textParamKey}='${key}'],textarea[data-${textParamKey}='${key}']`);
            if (ele) {
                ele.value = settingObj[textParamKey];
                updateSettings(ele, sync);

                const paramEle = document.querySelector(`input[data-param${paramNum}='${key}']`);
                if (paramEle && paramEle.checked) {
                    updateSettings(paramEle, false, settingObj[textParamKey]);
                }

                // Refresh blocked words tag list if this is the blockedwords input
                if (key === 'blockedwords') {
                    updateBlockedWordsList();
                }
                if (commaTagInputs.includes(ele.id) || commaTagInputs.includes(key)) {
                    refreshCommaTagInput(ele.id || key);
                }
            }
        }

        // Process option parameters
        const optionParamKey = `optionparam${paramNum}`;
        if (optionParamKey in settingObj) {
            let ele = document.querySelector(`[data-${optionParamKey}='${key}']`);
            if (!ele && typeof key === 'string') {
                const lowerKey = key.toLowerCase();
                ele = document.querySelector(`[data-${optionParamKey}='${lowerKey}']`);
            }
            if (ele) {
                let storedValue = settingObj[optionParamKey];
                const isSelect = ele.tagName === 'SELECT';

                if (isSelect) {
                    ensureSelectValueOption(ele, storedValue);

                    // Backward compatibility: if stored value doesn't have 'lang=' prefix but contains '&voice=',
                    // it's likely an old format. Try to find a matching option.
                    if (storedValue && storedValue.includes('&voice=') && !storedValue.includes('lang=')) {
                        // Try to find an option that matches when we add the 'lang=' prefix
                        const compatValue = `lang=${storedValue}`;
                        // Check if this value exists in the options
                        const hasCompatOption = Array.from(ele.options).some(opt => opt.value === compatValue);
                        if (hasCompatOption) {
                            storedValue = compatValue;
                        }
                    }

                    ele.value = storedValue;

                    if (key == "ttsprovider" && paramNum == 2) {
                        handleTTSProvider2Visibility(ele.value);
                    } else if (key == "ttsprovider" && paramNum == 10) {
                        handleTTSProvider10Visibility(ele.value);
                    } else if (key == "ttsprovider" && paramNum == 18) {
                        handleTTSProvider18Visibility(ele.value);
                    }
                } else if (storedValue !== undefined) {
                    ele.value = storedValue;
                }

                updateSettings(ele, sync);

                const paramEle = document.querySelector(`input[data-param${paramNum}='${key}']`);
                if (paramEle && paramEle.checked) {
                    updateSettings(paramEle, false, settingObj[optionParamKey]);
                }
                
                if (isSelect) {
                    // Handle OpenAI custom voice/model dropdowns
                    if (key === 'voiceopenai' && storedValue === 'custom') {
                        // Show custom voice input for the appropriate section
                        const customInputId = paramNum === 1 ? 'openaiCustomVoice' : 
                                           paramNum === 2 ? 'openaiCustomVoice2' : 
                                           paramNum === 10 ? 'openaiCustomVoice10' :
                                           paramNum === 18 ? 'openaiCustomVoice18' : null;
                        if (customInputId) {
                            const customInput = document.getElementById(customInputId);
                            if (customInput) {
                                customInput.style.display = 'inline-block';
                            }
                        }
                    } else if (key === 'openaimodel' && storedValue === 'custom') {
                        // Show custom model input for the appropriate section
                        const customInputId = paramNum === 1 ? 'openaiCustomModel' : 
                                           paramNum === 2 ? 'openaiCustomModel2' : 
                                           paramNum === 10 ? 'openaiCustomModel10' :
                                           paramNum === 18 ? 'openaiCustomModel18' : null;
                        if (customInputId) {
                            const customInput = document.getElementById(customInputId);
                            if (customInput) {
                                customInput.style.display = 'inline-block';
                            }
                        }
                    } else if (key === 'voiceopenai' && storedValue !== 'custom') {
                        const customInputId = paramNum === 1 ? 'openaiCustomVoice' : 
                                           paramNum === 2 ? 'openaiCustomVoice2' : 
                                           paramNum === 10 ? 'openaiCustomVoice10' :
                                           paramNum === 18 ? 'openaiCustomVoice18' : null;
                        if (customInputId) {
                            const customInput = document.getElementById(customInputId);
                            if (customInput) {
                                customInput.style.display = 'none';
                            }
                        }
                    } else if (key === 'openaimodel' && storedValue !== 'custom') {
                        const customInputId = paramNum === 1 ? 'openaiCustomModel' : 
                                           paramNum === 2 ? 'openaiCustomModel2' : 
                                           paramNum === 10 ? 'openaiCustomModel10' :
                                           paramNum === 18 ? 'openaiCustomModel18' : null;
                        if (customInputId) {
                            const customInput = document.getElementById(customInputId);
                            if (customInput) {
                                customInput.style.display = 'none';
                            }
                        }
                    }
                }
            }
        }
    });

    if ("both" in settingObj) {
        const ele = document.querySelector(`input[data-both='${key}']`);
        if (ele) {
            ele.checked = settingObj.both;
            updateSettings(ele, sync);
        }
    }

    if ("setting" in settingObj) {
        const ele = document.querySelector(`input[data-setting='${key}']`);
        if (ele) {
            ele.checked = settingObj.setting;
            updateSettings(ele, sync);

            if (key == "sentiment") {
                handleDeprecatedSentiment();
            } else if (key == "hideyourlinks") {
                // Class is added/removed based on checkbox state; refreshLinks should handle text
                if (ele.checked) {
                    document.body.classList.add("hidelinks");
                } else {
                    document.body.classList.remove("hidelinks");
                }
            } else if (key == "ollamaRagEnabled") {
                document.getElementById('ragFileManagement').style.display = ele.checked ? 'block' : 'none'; // Show/hide based on check
            }
        }
    }

    if ("textsetting" in settingObj) {
        let currentKey = key; // Use a local variable for the key to query with
        let valueToSet = settingObj.textsetting;

        if (key === "mynameext") {
            if (response && response.settings && !response.settings["botnamesext"]) { // Check original response
                // If botnamesext is not in the original response, we are migrating mynameext
                if (response.settings["mynameext"]) { // Ensure mynameext exists
                    if (!response.settings["botnamesext"]) response.settings["botnamesext"] = {}; // Create if not exists
                    response.settings["botnamesext"].textsetting = response.settings["mynameext"].textsetting; // Migrate the value
                }
                currentKey = "botnamesext"; // Intend to query and update using botnamesext from now on if applicable
                                          // This change of 'currentKey' will affect the querySelector below
                                          // However, the element might still be data-textsetting='mynameext'
                                          // If the data attribute is also changing, this is more complex.
                                          // For now, let's assume the element is found by original 'key' but data is also put in 'botnamesext'
                                          // The original code would have modified `key` and thus queried for `botnamesext`.
                                          // To replicate:
                if (!response.settings["botnamesext"]) { // if still no botnamesext in modified response
                   // This logic means mynameext is processed as botnamesext
                   // The value is from settingObj.textsetting which is response.settings.mynameext.textsetting
                } else { // botnamesext was already present in the original response.settings
                  return; // skip, as per original logic's `else { continue; }`
                }
                // If we are here, it means mynameext is active, and botnamesext was not in original response.
                // The original 'key' was "mynameext"
                // The element will be found by document.querySelector(`...[data-textsetting='mynameext']`)
                // And its value set. The `response.settings.botnamesext` is also populated.
            } else if (response && response.settings && response.settings["botnamesext"]) {
                 // if original key is mynameext AND botnamesext is already in response, then we should skip mynameext
                 return;
            }
        }
        // If key was 'mynameext' and we fell through, we process 'mynameext' elements.
        // If key was 'mynameext' and we returned, this part is skipped.
        // If key was 'botnamesext' from the start, it's processed here.

        const ele = document.querySelector(`input[data-textsetting='${key}'],textarea[data-textsetting='${key}']`);
        if (ele) {
            ele.value = valueToSet; // valueToSet is settingObj.textsetting

            if (ele.dataset.palette) {
                try {
                    document.getElementById(ele.dataset.palette).value = ele.value;
                } catch (e) {
                    log(e);
                }
            }
            updateSettings(ele, sync);
            if (userTypes.includes(key)) {
                updateUsernameList(key);
            } else if (sourceTypes.includes(key)) {
                updateSourceTypeList(key);
            } else if (commaTagInputs.includes(key)) {
                updateCommaTagList(key);
            } else if (commaTagInputs.includes(ele.id)) {
                refreshCommaTagInput(ele.id);
            }
        }
    }

    if ("optionsetting" in settingObj) {
        const ele = document.querySelector(`select[data-optionsetting='${key}']`);
        if (ele) {
            if (key == "midiOutputDevice" || key.startsWith("mididevice") || key == "opencodemodel") {
                if (settingObj.optionsetting && (ele.value !== settingObj.optionsetting)) {
                    // Check if option already exists
                    let optionExists = false;
                    for (let i = 0; i < ele.options.length; i++) {
                        if (ele.options[i].value === settingObj.optionsetting) {
                            optionExists = true;
                            break;
                        }
                    }
                    if (!optionExists) {
                        const option = document.createElement("option");
                        option.textContent = settingObj.optionsetting;
                        option.value = settingObj.optionsetting;
                        ele.appendChild(option);
                    }
                    // ele.value will set it to selected below
                }
            }

            ensureSelectValueOption(ele, settingObj.optionsetting);
            ele.value = settingObj.optionsetting;
            updateSettings(ele, sync);

            if (key == "aiProvider") {
                handleAIProviderVisibility(ele.value);
            } else if (key == "ttsProvider") {
                handleTTSProviderVisibility(ele.value);
            } else if (key == "featuredOverlayStyle" ) {
				applyFeaturedOverlayPreset(ele.value);
			 } else if (key == "overlayPreset") {
				applyChatOverlayTemplatePreset(ele.value);
			 }
        }
    }

    if ("optionsetting2" in settingObj) {
        const ele = document.querySelector(`select[data-optionsetting2='${key}']`);
        if (ele) {
            ensureSelectValueOption(ele, settingObj.optionsetting2);
            ele.value = settingObj.optionsetting2;
            updateSettings(ele, sync);
            if (key == "ttsProvider") {
                handleTTSProvider2Visibility(ele.value);
            }
        }
    }

    if ("optionsetting10" in settingObj) {
        const ele = document.querySelector(`select[data-optionsetting10='${key}']`);
        if (ele) {
            ensureSelectValueOption(ele, settingObj.optionsetting10);
            ele.value = settingObj.optionsetting10;
            updateSettings(ele, sync);
            // Note: handleTTSProvider10Visibility is called from processObjectSetting's main loop for optionparam10
            // if key is "ttsprovider", which seems to be the case where optionsetting10 is used.
        }
    }

    if (key === 'customGifCommands' && settingObj.json) {
        try {
            const commands = JSON.parse(settingObj.json || '[]');
            const commandsList = document.getElementById('customGifCommandsList');
            if (commandsList) {
                commandsList.innerHTML = '';
                commands.forEach(cmd => {
                    commandsList.appendChild(createCommandEntry(cmd.command, cmd.url, cmd.id)); // Assuming createCommandEntry is defined
                });
            }
        } catch(e) { console.error("Error parsing customGifCommands JSON:", e); }
    } else if (key === 'savedPolls' && settingObj.json) {
        try {
            PollManager.savedPolls = JSON.parse(settingObj.json || '[]'); // Assuming PollManager is defined
            PollManager.updatePollsList();
        } catch(e) { console.error("Error parsing savedPolls JSON:", e); }
    }
}


function update(response, sync = true) {
    log("update-> response: ", response);
    
    // Skip update if we're loading a poll
    if (window.isLoadingPoll) {
        log("Skipping update during poll load");
        return;
    }
    
    if (response !== undefined) {
        applyPopupBeginnerMode(getPopupBeginnerMode(response));

        // Load profiles if they weren't loaded during init (e.g., due to startup timing)
        if (typeof ProfileManager !== 'undefined' && ProfileManager.loadProfilesFromResponse) {
            ProfileManager.loadProfilesFromResponse(response);
        }

        if (response.handleStatus) {
            mergeHandleStatusFromBackground(response.handleStatus);
        }

        if (response.documents) {
            updateDocumentList(response.documents);
        }

        if (response.streamID) {
            lastResponse = response;
            streamID = true;

            var password = "";
            if ('password' in response && response.password) {
                password = "&password=" + response.password;
            }

            var localServer = urlParams.has("localserver") ? "&localserver" : "";
            password += localServer;

            // Determine hideLinks status initially
            let hideLinksInitial = false;
            document.querySelectorAll("input[data-setting='hideyourlinks']").forEach(x => {
                if (x.checked) {
                    hideLinksInitial = true;
                }
            });

            if (hideLinksInitial) {
                document.body.classList.add("hidelinks");
            } else {
                document.body.classList.remove("hidelinks");
            }

            document.getElementById("sessionid").value = response.streamID;
            document.getElementById("sessionpassword").value = response.password || "";

            setupPageLinks(hideLinksInitial, baseURL, response.streamID, password); // Pass current hideLinks state

			
			if (document.getElementById("sampleoverlay")){
				document.getElementById("sampleoverlay").href = baseURL + "sampleoverlay.html?session=" + response.streamID + password;
			}
			
            document.getElementById("remote_control_url").href = baseURL + "sampleapi.html?session=" + response.streamID + password;
            // The hideLinks variable is not reset to false globally here, its state is managed by the checkbox and classList.

            // Refresh all page links.
            refreshLinks();
			const aipromptUrl = baseURL + "aiprompt.html?session=" + response.streamID + password + "&v=" + chrome.runtime.getManifest().version;
			if (document.getElementById("aiprompt") && document.getElementById("aipromptlink")) document.getElementById("aiprompt").raw = document.getElementById("aipromptlink").href = document.getElementById("aipromptlink").innerText = aipromptUrl;

            try {
                // Define your link configurations: { linkId: 'idOfLinkElement', sourcePropertyProvider: () => document.getElementById('sourceElementId')?.raw || document.getElementById('idOfLinkElement').href }
                // A more robust way is if refreshLinks stores the raw URLs on the elements or returns them.
                // For now, let's assume link elements have an href that needs cleaning.
                const linkIdsToClean = [
                    'docklink', 'cohostlink', 'privatechatbotlink', 'chatbotlink', 'aipromptlink', 'aioverlaylink',
                    'overlaylink', 'emoteswalllink', 'hypemeterlink', 'hypetrainlink', 'metalink', 'waitlistlink',
                    'tipjarlink', 'tickerlink', 'wordcloudlink', 'polllink', 'flowactionslink',
                    'custom-gif-commandslink', 'creditslink', 'giveawaylink', 'gameslink', 'leaderboardlink', 'scoreboard',
					'spotifylink','maplink'
                    // Add other link IDs that are generated and need cleaning
                ];

                // Get current hideLinks status as it might have been changed by settings
                const currentHideLinks = document.body.classList.contains("hidelinks");

                linkIdsToClean.forEach(linkId => {
                    const linkElement = document.getElementById(linkId);
                    if (linkElement && typeof linkElement.href === 'string' && linkElement.href.startsWith('http')) {
                        const originalHref = linkElement.href; // Or from a 'data-raw-url' attribute if refreshLinks sets one
                        const cleanedUrl = removeTTSProviderParams(originalHref);
                        linkElement.href = cleanedUrl;
                        if (linkElement.innerText !== "Click to open link" || !currentHideLinks) { // Avoid overwriting "Click to open" if links are hidden
                           linkElement.innerText = currentHideLinks ? "Click to open link" : cleanedUrl;
                        }
                        // If your old `sourceElement.raw` was important, you might need to update a similar attribute
                        // if (linkElement.raw) linkElement.raw = cleanedUrl;
                    }
                });

                // Also clean the remote_control_url if it can have TTS params (usually not)
                const remoteCtrlUrlElement = document.getElementById("remote_control_url");
                if (remoteCtrlUrlElement && remoteCtrlUrlElement.href) {
                   remoteCtrlUrlElement.href = removeTTSProviderParams(remoteCtrlUrlElement.href);
                }

            } catch (e) {
                console.error("Error cleaning TTS params from links:", e);
            }
        }

        if ('settings' in response && (response.streamID || ssapp)) {
            const shouldBatchLinkRefresh = sync === false;
            if (shouldBatchLinkRefresh) {
                beginPopupLinkRefreshBatch();
            }
            try {
                setupTtsProviders(response); // Handle TTS provider setting initialization
                renderSavedCustomUrlSlots(response.settings);

                const targetMap = getTargetMap(); // Assuming getTargetMap() is defined
                const paramNums = Object.values(targetMap);

                for (var key in response.settings) {
                    try {
                        if (key === "midiConfig") {
                            if (response.settings[key]) {
                                document.getElementById("midiConfig").classList.add("pressed");
                                document.getElementById("midiConfig").innerText = " Config Loaded";
                            } else {
                                document.getElementById("midiConfig").classList.remove("pressed");
                                document.getElementById("midiConfig").innerText = " Load Config";
                            }
                            continue; // Continue to next setting
                        }

                        if (typeof response.settings[key] == "object") {
                            // Pass 'response' to handle 'mynameext' correctly within processObjectSetting
                            processObjectSetting(key, response.settings[key], sync, paramNums, response);
                        } else {
                            processLegacySetting(key, response.settings[key], sync);
                        }
                    } catch (e) {
                        console.error(`Error processing setting ${key}:`, e);
                    }
                }

                if ("translation" in response.settings) {
                    translation = response.settings["translation"];
                    miniTranslate(document.body); // Assuming miniTranslate is defined
                }

                createTabsFromSettings(response); // Assuming createTabsFromSettings is defined
                updateAiOverlayLinksFromCurrentState();
                if (urlParams.has("ln")) {
                    applyExternalTranslationLanguage(urlParams.get("ln"), { reload: false });
                }

                // Check if MIDI is enabled and initialize if needed
                const midiCheckbox = document.querySelector('input[data-setting="midi"]');
                if (midiCheckbox && midiCheckbox.checked) {
                    // MIDI was enabled in settings, initialize the dropdown
                    handleMidiToggle(true);
                }
                updateFirstTimerUiState();
            } finally {
                if (shouldBatchLinkRefresh) {
                    endPopupLinkRefreshBatch();
                }
            }
        }

        if (("state" in response) && streamID) {
            isExtensionOn = response.state;
            if (isExtensionOn) {
                document.body.classList.add("extension-enabled");
                document.body.classList.remove("extension-disabled");
                document.getElementById("disableButtonText").innerHTML = ssapp ? "⚡ Service Active" : "⚡ Extension active"; // Assuming ssapp is defined
                document.getElementById("disableButton").style.display = "";
                document.getElementById("extensionState").checked = true;
                if (typeof chrome !== 'undefined' && chrome.browserAction) {
                    chrome.browserAction.setIcon({ path: "/icons/on.png" });
                }
            } else {
                document.getElementById("disableButtonText").innerHTML = ssapp ? "🔌 Service Disabled" : "🔌 Extension Disabled";
                document.body.classList.remove("extension-enabled");
                document.body.classList.add("extension-disabled");
                document.getElementById("disableButton").style.display = "";
                if (typeof chrome !== 'undefined' && chrome.browserAction) {
                    chrome.browserAction.setIcon({ path: "/icons/off.png" });
                }
                document.getElementById("extensionState").checked = false; // Use false for unchecked state
            }
        }
    }
}

function processParam(key, paramNum, settingObj, sync) {
    let paramKey = `param${paramNum}`;
    let ele = document.querySelector(`input[data-${paramKey}='${key}'], select[data-${paramKey}='${key}']`);

    if (!ele && paramNum === 1 && key.startsWith('chroma=')) {
        const rawValue = key.split('=')[1] || '';
        const isTranslucentValue = /^(?:0{3}[0-9a-fA-F]|0{6}[0-9a-fA-F]{2})$/.test(rawValue);
        if (isTranslucentValue) {
            const compatKey = 'chromaalpha';
            ele = document.querySelector(`input[data-${paramKey}='${compatKey}']`);
            if (ele) {
                const slider = document.querySelector(`input[data-numbersetting='${compatKey}']`);
                if (slider) {
                    const derivedPercent = getPercentFromChromaValue(rawValue);
                    if (derivedPercent !== null) {
                        slider.value = derivedPercent;
                        updateSettings(slider, sync);
                    }
                }
            }
        }
    }

    if (!ele && paramNum === 3 && key.startsWith('limit=')) {
        const legacyValue = parseInt(key.split('=')[1], 10);
        ele = document.querySelector(`input[data-${paramKey}='limit']`);
        if (ele && !Number.isNaN(legacyValue)) {
            const suffix = paramNum === 1 ? '' : paramNum;
            const numberInput = document.querySelector(`input[data-numbersetting${suffix}='limit']`);
            if (numberInput) {
                numberInput.value = legacyValue;
            }
        }
    }

    if (!ele) return;

    if (ele.tagName && ele.tagName.toLowerCase() === 'select') {
        if (settingObj[paramKey] !== undefined) {
            ele.value = settingObj[paramKey];
        }
    } else {
        ele.checked = !!settingObj[paramKey]; // Set the checked state based on loaded setting.
    }

    // Call updateSettings with the element. handleElementParam will figure out the value.
    updateSettings(ele, sync);
}

// Handle legacy settings format
function processLegacySetting(key, value, sync) {
    // Process simple settings
    var ele = document.querySelector(`input[data-setting='${key}']`);
    if (!ele) {
        ele = document.querySelector(`input[data-param1='${key}'], input[data-param2='${key}']`);
    }
    if (ele) {
        ele.checked = value;
        updateSettings(ele, sync);
    }
    
    // Process text settings
    ele = document.querySelector(`input[data-textsetting='${key}'], textarea[data-textsetting='${key}']`);
    if (!ele) {
        ele = document.querySelector(`input[data-textparam1='${key}'], textarea[data-textparam1='${key}']`);
    }
    if (ele) {
        ele.value = value;
        updateSettings(ele, sync);
        if (commaTagInputs.includes(ele.id) || commaTagInputs.includes(key)) {
            refreshCommaTagInput(ele.id || key);
        }
    }
}

const OPENCODE_ZEN_MODELS_URL = "https://opencode.ai/zen/v1/models";
const OPENCODE_ZEN_FREE_MODEL_ORDER = [
    "big-pickle",
    "deepseek-v4-flash-free",
    "mimo-v2.5-free",
    "qwen3.6-plus-free",
    "minimax-m3-free",
    "nemotron-3-ultra-free",
    "nemotron-3-super-free"
];
const OPENCODE_ZEN_MODEL_CACHE_MS = 60 * 60 * 1000;
let openCodeModelLoadInFlight = null;
let openCodeModelCache = {
    fetchedAt: 0,
    models: null
};

function isOpenCodeFreeModelId(modelId) {
    modelId = String(modelId || "").toLowerCase();
    return modelId === "big-pickle" || /-free$/.test(modelId);
}

function getOpenCodeFreeModelRank(modelId) {
    const lower = String(modelId || "").toLowerCase();
    const index = OPENCODE_ZEN_FREE_MODEL_ORDER.indexOf(lower);
    return index === -1 ? OPENCODE_ZEN_FREE_MODEL_ORDER.length : index;
}

function isOpenCodeChatCompletionsModel(modelId) {
    const value = String(modelId || "").trim().toLowerCase();
    return isOpenCodeFreeModelId(value) ||
        value === "big-pickle" ||
        value.indexOf("deepseek-") === 0 ||
        value.indexOf("minimax-") === 0 ||
        value.indexOf("glm-") === 0 ||
        value.indexOf("kimi-") === 0 ||
        value.indexOf("mimo-") === 0 ||
        value.indexOf("nemotron-") === 0 ||
        value.indexOf("grok-build") === 0;
}

function sortOpenCodeModelIds(modelIds) {
    return modelIds.slice().sort(function (a, b) {
        const aFree = isOpenCodeFreeModelId(a);
        const bFree = isOpenCodeFreeModelId(b);
        if (aFree !== bFree) return aFree ? -1 : 1;
        if (aFree && bFree) {
            const rankDiff = getOpenCodeFreeModelRank(a) - getOpenCodeFreeModelRank(b);
            if (rankDiff) return rankDiff;
        }
        return String(a).localeCompare(String(b));
    });
}

function setOpenCodeModelStatus(message, color) {
    const status = document.getElementById("opencodeModelStatus");
    if (!status) return;
    status.textContent = message || "";
    status.style.color = color || "";
}

function populateOpenCodeModelSelect(modelIds) {
    const select = document.getElementById("opencodeModelSelect");
    if (!select) return;
    const currentValue = select.value || "auto";
    select.innerHTML = "";

    const autoOption = document.createElement("option");
    autoOption.value = "auto";
    autoOption.textContent = "Auto - free models only";
    select.appendChild(autoOption);

    sortOpenCodeModelIds((modelIds || []).filter(isOpenCodeChatCompletionsModel)).forEach(function (id) {
        if (!id) return;
        const option = document.createElement("option");
        option.value = id;
        option.textContent = isOpenCodeFreeModelId(id) ? id + " (free)" : id;
        select.appendChild(option);
    });

    const hasCurrent = Array.prototype.some.call(select.options, function (option) {
        return option.value === currentValue;
    });
    select.value = hasCurrent ? currentValue : "auto";
}

function getOpenCodeApiKeyFromPopup() {
    const input = document.querySelector("[data-textsetting='opencodeApiKey']");
    return input && input.value ? input.value.trim() : "";
}

async function loadOpenCodeModels(force) {
    const providerSelect = document.getElementById("aiProvider");
    if (!force && providerSelect && providerSelect.value !== "opencode") return;
    if (openCodeModelLoadInFlight) return openCodeModelLoadInFlight;

    const now = Date.now();
    if (!force && openCodeModelCache.models && now - openCodeModelCache.fetchedAt < OPENCODE_ZEN_MODEL_CACHE_MS) {
        populateOpenCodeModelSelect(openCodeModelCache.models);
        setOpenCodeModelStatus("Loaded cached OpenCode model list.", "#7ad37a");
        return;
    }

    setOpenCodeModelStatus("Loading OpenCode models...", "#bbb");
    openCodeModelLoadInFlight = (async function () {
        try {
            const headers = { "Accept": "application/json" };
            const apiKey = getOpenCodeApiKeyFromPopup();
            if (apiKey) headers.Authorization = "Bearer " + apiKey;
            const response = await fetch(OPENCODE_ZEN_MODELS_URL, {
                method: "GET",
                headers: headers,
                cache: "no-store"
            });
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            const payload = await response.json();
            const models = Array.isArray(payload && payload.data)
                ? payload.data.map(function (entry) { return entry && entry.id ? String(entry.id) : ""; }).filter(Boolean)
                : [];
            if (!models.length) {
                throw new Error("No models returned");
            }
            const compatibleModels = models.filter(isOpenCodeChatCompletionsModel);
            const modelList = compatibleModels.length ? compatibleModels : OPENCODE_ZEN_FREE_MODEL_ORDER;
            openCodeModelCache = {
                fetchedAt: Date.now(),
                models: modelList
            };
            populateOpenCodeModelSelect(modelList);
            const freeCount = compatibleModels.filter(isOpenCodeFreeModelId).length;
            setOpenCodeModelStatus("Loaded " + (compatibleModels.length || OPENCODE_ZEN_FREE_MODEL_ORDER.length) + " chat-compatible models" + (freeCount ? " (" + freeCount + " free)." : "."), "#7ad37a");
        } catch (error) {
            openCodeModelCache = {
                fetchedAt: Date.now(),
                models: OPENCODE_ZEN_FREE_MODEL_ORDER.slice()
            };
            populateOpenCodeModelSelect(OPENCODE_ZEN_FREE_MODEL_ORDER);
            setOpenCodeModelStatus("Could not load live model list; using built-in free defaults.", "#ffcc66");
            console.warn("[OpenCode Zen] Model list load failed:", error);
        } finally {
            openCodeModelLoadInFlight = null;
        }
    }());
    return openCodeModelLoadInFlight;
}

// Handle AI provider visibility
function handleAIProviderVisibility(provider) {
    // Hide all provider-specific elements first
    [
        "ollamamodel", "ollamaendpoint", "chatgptApiKey", "ollamaKeepAlive",
        "geminiApiKey", "geminimodel", "xaiApiKey", "xaimodel", "chatgptmodel",
        "deepseekApiKey", "deepseekmodel", "customAIEndpoint", "customAIModel",
        "openrouterApiKey", "openroutermodel", "bedrockAccessKey", "bedrockSecretKey",
        "bedrockRegion", "bedrockmodel", "groqApiKey", "groqmodel", "customAIApiKey",
        "opencodeInfo", "opencodeApiKey", "opencodemodel",
        "localgemmahost", "localbrowserhelp", "localgemmamodel", "localqwenmodel",
        "hostedLLMInfo", "hostedLLMToken", "hostedLLMEndpoint", "hostedLLMModel"
    ].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });
    
    // Show elements based on selected provider
    if (provider == "ollama") {
        document.getElementById("ollamamodel").classList.remove("hidden");
        document.getElementById("ollamaKeepAlive").classList.remove("hidden");
        document.getElementById("ollamaendpoint").classList.remove("hidden");
    } else if (provider == "chatgpt") {
        document.getElementById("chatgptApiKey").classList.remove("hidden");
        document.getElementById("chatgptmodel").classList.remove("hidden");
    } else if (provider == "xai") {
        document.getElementById("xaiApiKey").classList.remove("hidden");
        document.getElementById("xaimodel").classList.remove("hidden");
    } else if (provider == "gemini") {
        document.getElementById("geminiApiKey").classList.remove("hidden");
        document.getElementById("geminimodel").classList.remove("hidden");
    } else if (provider == "deepseek") {
        document.getElementById("deepseekApiKey").classList.remove("hidden");
        document.getElementById("deepseekmodel").classList.remove("hidden");
    } else if (provider == "bedrock") {
        document.getElementById('bedrockAccessKey').classList.remove('hidden');
        document.getElementById('bedrockSecretKey').classList.remove('hidden');
        document.getElementById('bedrockRegion').classList.remove('hidden');
        document.getElementById('bedrockmodel').classList.remove('hidden');
    } else if (provider == "custom") {
        document.getElementById("customAIEndpoint").classList.remove("hidden");
        document.getElementById("customAIModel").classList.remove("hidden");
        document.getElementById("customAIApiKey").classList.remove("hidden");
    } else if (provider == "openrouter") {
        document.getElementById("openrouterApiKey").classList.remove("hidden");
        document.getElementById("openroutermodel").classList.remove("hidden");
    } else if (provider == "groq") {
        document.getElementById("groqApiKey").classList.remove("hidden");
        document.getElementById("groqmodel").classList.remove("hidden");
    } else if (provider == "opencode") {
        document.getElementById("opencodeInfo").classList.remove("hidden");
        document.getElementById("opencodeApiKey").classList.remove("hidden");
        document.getElementById("opencodemodel").classList.remove("hidden");
        loadOpenCodeModels(false);
    } else if (provider == "hostedllm") {
        document.getElementById("hostedLLMInfo").classList.remove("hidden");
        document.getElementById("hostedLLMToken").classList.remove("hidden");
        document.getElementById("hostedLLMEndpoint").classList.remove("hidden");
        document.getElementById("hostedLLMModel").classList.remove("hidden");
    } else if (provider == "localgemma") {
        document.getElementById("localgemmahost").classList.remove("hidden");
        document.getElementById("localbrowserhelp").classList.remove("hidden");
        document.getElementById("localgemmamodel").classList.remove("hidden");
    } else if (provider == "localqwen") {
        document.getElementById("localgemmahost").classList.remove("hidden");
        document.getElementById("localbrowserhelp").classList.remove("hidden");
        document.getElementById("localqwenmodel").classList.remove("hidden");
    }
}

var popupStartupSettingsHydrated = false;

function hasUsablePopupSettingsResponse(response) {
	const hasSession = !!(response && response.streamID);
	const hasSettingsPayload = !!(response && response.settings);
	return hasSession || (ssapp && hasSettingsPayload);
}

function hydratePopupFromStartupSettings(response) {
	if (!hasUsablePopupSettingsResponse(response)) {
		return false;
	}
	if (popupStartupSettingsHydrated) {
		return true;
	}
	popupStartupSettingsHydrated = true;
	update(response, false);
	return true;
}

function getPopupBeginnerMode(response) {
	if (!response) return false;
	if (response.beginnerMode !== undefined) {
		return !!response.beginnerMode;
	}
	return !!(response.settings && response.settings.beginnerMode && response.settings.beginnerMode.setting === true);
}

var BEGINNER_ADVANCED_OPTION_SELECTORS = {
	"wrapper-additional-chat-services-options": [
		'[data-setting="xcapture"]',
		'[data-setting="openai"]',
		'[data-textsetting="customdiscordchannel"]',
		'[data-setting="customtwitchstate"]',
		'[data-textsetting="customtwitchaccount"]',
		'[data-setting="customtiktokstate"]',
		'[data-textsetting="customtiktokaccount"]',
		'[data-setting="collecttwitchpoints"]',
		'[data-setting="twichadmute"]',
		'[data-setting="twichadannounce"]',
		'[data-setting="detweet"]',
		'[data-setting="streamlabsExclusive"]',
		'[data-setting="vdoninjadiscord"]',
		'[data-setting="flipYoutube"]',
		'[data-setting="youtubeAudioPicker"]',
		'[data-setting="kickchatroomscout"]',
		'[data-setting="hidePaidPromotion"]',
		'#custominject'
	],
	"wrapper-chat-overlay-options": [
		'[data-param1="opacity"]',
		'[data-param1="chromaalpha"]',
		'[data-param1="chroma=fff"]',
		'[data-param1="showbitrate"]',
		'[data-param1="viewerbarbg"]',
		'[data-textparam1="viewerbarbg"]',
		'[data-param1="remote"]'
	],
	"wrapper-chat-message-mechanics-options": [
		'[data-param1="debug"]',
		'[data-param1="deleteonlylast"]',
		'[data-param1="alignbottom"]',
		'[data-param1="dropdown"]',
		'[data-param1="reverse"]',
		'[data-param1="random"]',
		'[data-param1="alignright"]',
		'[data-param1="rtl"]',
		'[data-param1="dissolve"]',
		'[data-param1="beepfirsttime"]',
		'[data-textparam1="custombeep"]',
		'[data-param1="btkeepalive"]',
		'[data-param1="overlapbeep"]',
		'[data-param1="reload"]',
		'[data-param1="altselect"]',
		'[data-param1="stripdonations"]',
		'[data-param1="skipdonations"]',
		'[data-textsetting="customDonationThankYou"]',
		'[data-param1="autoshowdonos"]',
		'[data-param1="autoshowmembers"]',
		'[data-param1="autoshowcontentimages"]',
		'[data-param1="autoyoutubememberchat"]',
		'[data-param1="autopinquestions"]',
		'[data-param1="autoqueuequestions"]',
		'[data-param1="autopindonations"]',
		'[data-param1="autoqueuedonations"]',
		'[data-param1="sync"]',
		'[data-param1="featuredmode"]',
		'[data-param1="pinnedonly"]',
		'[data-param1="cycle"]',
		'[data-param1="viewonly"]',
		'[data-param1="chatmode"]',
		'[data-param1="helpermode"]',
		'[data-param1="lanonly"]',
		'[data-textparam1="selfqueue"]'
	],
	"wrapper-chat-message-styling-options": [
		'[data-param1="donationright"]',
		'[data-param1="nooutline"]',
		'[data-param1="bolder"]',
		'[data-param1="thinner"]',
		'[data-textparam1="fontweight"]',
		'[data-textparam1="outlinecolor"]',
		'[data-textparam1="outlinewidth"]',
		'[data-textparam1="strokecolor"]',
		'[data-textparam1="strokewidth"]',
		'[data-param1="textglow"]',
		'[data-textparam1="glowcolor"]',
		'[data-textparam1="glowwidth"]',
		'[data-param1="split"]',
		'[data-param1="namebubble"]',
		'[data-textparam1="namebubblecolor"]',
		'[data-textparam1="namebubbletext"]',
		'[data-textparam1="namebubbleradius"]',
		'[data-textparam1="namebubblepadding"]',
		'[data-param1="bubbleopacity"]',
		'[data-param1="horizontal"]',
		'[data-param1="horizontalreverse"]',
		'[data-param1="trim=200"]',
		'[data-param1="normalize"]',
		'[data-param1="fixed"]',
		'[data-textparam1="cssb64"]',
		'[data-textparam1="jsb64"]',
		'[data-textparam1="googlefont"]'
	],
	"wrapper-global-mechanics-options": [
		'[data-setting="disableDB"]',
		'[data-setting="unlimitedDB"]',
		'[data-setting="notiktoklinks"]',
		'[data-setting="capturejoinedevent"]',
		'[data-setting="capturelikeevent"]',
		'[data-setting="notiktokdonations"]',
		'[data-setting="disabletiktokpoke"]',
		'[data-setting="blockpremiumshorts"]',
		'[data-setting="delayyoutube"]',
		'[data-setting="delaykick"]',
		'[data-setting="delaytwitch"]',
		'[data-setting="pronounscombined"]',
		'[data-setting="discordmemberships"]',
		'[data-setting="limitedyoutubememberchat"]',
		'[data-setting="limitedtwitchmemberchat"]',
		'[data-setting="addkarma"]',
		'[data-setting="pumpTheNumbers"]',
		'[data-textsetting="printerName"]',
		'[data-setting="sharestreamid"]',
		'[data-setting="disableRelayThrottle"]',
		'[data-setting="disablehost"]',
		'[data-setting="socketserver"]',
		'[data-setting="lanonly"]',
		'[data-setting="ssc"]',
		'[data-textsetting="sscapikey"]',
		'[data-setting="videostatspoller"]',
		'[data-textsetting="videostatsurl"]',
		'[data-textsetting="videostatspublisher"]',
		'[data-textsetting="videostatsapplication"]',
		'[data-textsetting="videostatskey"]',
		'[data-textsetting="videostatsapikey"]',
		'[data-textsetting="videostatsusername"]',
		'[data-textsetting="videostatspassword"]',
		'[data-numbersetting="videostatsinterval"]',
		'[data-textsetting="videostatslabel"]',
		'[data-setting="streamerbot"]',
		'[data-textsetting="streamerbotendpoint"]',
		'[data-textsetting="streamerbotpassword"]',
		'[data-textsetting="streamerbotactionid"]',
		'[data-setting="h2r"]',
		'[data-textsetting="h2rserver"]',
		'[data-setting="post"]',
		'[data-textsetting="postserver"]',
		'[data-setting="postalldiscord"]',
		'[data-textsetting="postallserverdiscord"]',
		'[data-setting="postdiscord"]',
		'[data-textsetting="postserverdiscord"]',
		'[data-setting="webhookrelay"]',
		'[data-setting="enablePointsSystem"]',
		'[data-numbersetting="pointsPerEngagement"]',
		'[data-numbersetting="engagementWindow"]',
		'[data-setting="enablePointsCommand"]',
		'[data-setting="enableLeaderboardCommand"]',
		'[data-setting="enableRewardsCommand"]',
		'[data-setting="autohi"]',
		'[data-setting="relaydonos"]',
		'[data-setting="relayall"]',
		'[data-setting="blockChannelPointRelays"]',
		'[data-textsetting="relaytargets"]',
		'[data-textsetting="relayaccountroles"]',
		'[data-textsetting="blockrelayaccountroles"]',
		'[data-textsetting="botreplyaccountroles"]',
		'[data-setting="nosaid"]',
		'[data-setting="relayhostonly"]',
		'[data-setting="nohostreflections"]',
		'[data-setting="hostFirstSimilarOnly"]',
		'[data-setting="forwardcommands2twitch"]',
		'[data-setting="forwardcommands2kick"]',
		'[data-setting="forwardcommands2youtube"]',
		'[data-setting="limitcharactersstate"]',
		'[data-numbersetting="limitcharacters"]',
		'[data-setting="joke"]',
		'[data-action="tellajoke"]',
		'[data-setting="dice"]',
		'[data-setting="questionKeywords"]',
		'[data-textsetting="questionKeywords"]',
		'[data-setting="customJsEnabled"]',
		'[data-setting="giphy"]',
		'[data-setting="tenor"]',
		'[data-setting="giphy2"]',
		'[data-setting="hidegiphytrigger"]',
		'[data-setting="randomgif"]',
		'[data-textsetting="giphyKey"]',
		'[data-textsetting="tenorKey"]',
		'[data-setting="chatwebhookpost"]',
		'[data-setting="chatwebhookstrict"]',
		'#chatCommands',
		'#timedMessages',
		'[data-setting="dynamictiming"]',
		'[data-setting="botReplyMessageFull"]',
		'#botReplyMessages',
		'[data-setting="midi"]',
		'#midiConfig',
		'#midiCommands'
	],
	"wrapper-global-message-visibility-options": [
		'[data-setting="hideallreplies"]',
		'[data-setting="firstsourceonly"]',
		'[data-setting="thissourceonly"]',
		'[data-setting="noduplicates"]',
		'[data-setting="ignorealternatives"]',
		'[data-setting="goodwordslist"]',
		'[data-setting="memberchatonly"]',
		'[data-setting="filtercommandscustomtoggle"]',
		'[data-textsetting="filtercommandscustomwords"]',
		'[data-setting="textonlymode"]',
		'[data-setting="emoteonlymode"]'
	],
	"wrapper-global-message-styling-options": [
		'[data-setting="colorofsourcebg"]',
		'[data-setting="randomcolorall"]',
		'[data-numbersetting="totalcolors"]',
		'[data-numbersetting="colorseed"]',
		'[data-setting="nosubcolor"]',
		'[data-textsetting="highlightword"]',
		'[data-textsetting="defaultavatar"]'
	]
};

var BEGINNER_ADVANCED_OPTION_HEADINGS = {
	"wrapper-chat-message-styling-options": ["Text Glow"],
	"wrapper-global-mechanics-options": ["Printer Control"]
};

var BEGINNER_ADVANCED_OPTION_HEADING_SECTIONS = {
	"wrapper-global-message-visibility-options": ["Message doubling / echos / duplicates / relayed"],
	"wrapper-global-mechanics-options": [
		"Custom JavaScript",
		"Giphy/Tenor support",
		"Trigger webhook URL by a !command",
		"Send fixed messages at intervals",
		"Auto-responder",
		"Trigger MIDI note on command"
	]
};

function markBeginnerAdvancedOptionRow(element, scope) {
	if (!element || !element.closest) return;
	var row = element.closest(".colorInputRow");
	if (!row) row = element.closest(".alphaInput");
	if (!row) row = element.closest(".textInputContainer");
	if (!row) row = element.closest("div");
	if (row && row.classList.contains("textInputContainer") && row.parentElement && row.parentElement.tagName === "DIV" && !row.parentElement.classList.contains("options_group") && !row.parentElement.classList.contains("colorInputRow")) {
		row = row.parentElement;
	}
	if (row && row !== scope) {
		row.classList.add("beginner-advanced-option");
	}
}

function markBeginnerAdvancedOptions() {
	document.querySelectorAll(".beginner-advanced-option").forEach(function(element) {
		element.classList.remove("beginner-advanced-option");
	});

	Object.keys(BEGINNER_ADVANCED_OPTION_SELECTORS).forEach(function(wrapperId) {
		var wrapperInput = document.getElementById(wrapperId);
		var scope = wrapperInput && wrapperInput.closest ? wrapperInput.closest(".wrapper") : null;
		if (!scope) return;

		BEGINNER_ADVANCED_OPTION_SELECTORS[wrapperId].forEach(function(selector) {
			scope.querySelectorAll(selector).forEach(function(element) {
				markBeginnerAdvancedOptionRow(element, scope);
			});
		});

		var headingLabels = BEGINNER_ADVANCED_OPTION_HEADINGS[wrapperId] || [];
		if (headingLabels.length) {
			scope.querySelectorAll("h3").forEach(function(heading) {
				var text = (heading.textContent || "").replace(/\s+/g, " ").trim();
				if (headingLabels.indexOf(text) !== -1) {
					heading.classList.add("beginner-advanced-option");
				}
			});
		}

		var sectionHeadingLabels = BEGINNER_ADVANCED_OPTION_HEADING_SECTIONS[wrapperId] || [];
		if (sectionHeadingLabels.length) {
			scope.querySelectorAll("h3").forEach(function(heading) {
				var text = (heading.textContent || "").replace(/\s+/g, " ").trim();
				if (sectionHeadingLabels.indexOf(text) === -1) return;
				heading.classList.add("beginner-advanced-option");
				var sibling = heading.nextElementSibling;
				while (sibling && sibling.tagName !== "H3") {
					sibling.classList.add("beginner-advanced-option");
					sibling = sibling.nextElementSibling;
				}
			});
		}
	});
}

function markBeginnerAdvancedSections() {
	document.querySelectorAll(".beginner-basic").forEach(function(section) {
		if (section) section.classList.remove("beginner-advanced");
	});
	document.querySelectorAll(".wrapper:not(.beginner-basic)").forEach(function(wrapper) {
		if (wrapper) wrapper.classList.add("beginner-advanced");
	});
	document.querySelectorAll(".link:not(.beginner-basic), .generic_category_title:not(.beginner-basic)").forEach(function(section) {
		section.classList.add("beginner-advanced");
	});
	markBeginnerAdvancedOptions();
}

function applyPopupBeginnerMode(enabled) {
	markBeginnerAdvancedSections();
	document.body.classList.toggle("beginner-mode", !!enabled);
	if (typeof checkImportantChanges === "function" && popupImportantChangesReady === true) {
		checkImportantChanges();
	}
}

function disablePopupBeginnerMode() {
	applyPopupBeginnerMode(false);
	chrome.runtime.sendMessage({
		cmd: "saveSetting",
		type: "setting",
		setting: "beginnerMode",
		value: false
	}, function () {});
}

function sendRuntimeCommandMessage(message, timeout, proxyToBackground) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Response timeout'));
        }, timeout);

        chrome.runtime.sendMessage(proxyToBackground ? { type: 'toBackground', data: message } : message, response => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message || String(chrome.runtime.lastError)));
            } else {
                resolve(response);
            }
        });
    });
}

function isBackgroundProxyError(response) {
    const message = response && response.error ? String(response.error) : "";
    return /background page|background service|communicate with background|open background/i.test(message);
}

async function sendPopupBackgroundCommand(message, timeout = 45000) {
    let directError = null;
    try {
        const directResponse = await sendRuntimeCommandMessage(message, timeout, false);
        if (directResponse && !isBackgroundProxyError(directResponse)) {
            return directResponse;
        }
    } catch (error) {
        directError = error;
    }

    const proxyResponse = await sendRuntimeCommandMessage(message, timeout, true);
    if (!proxyResponse && directError) {
        throw directError;
    }
    return proxyResponse;
}

function collectLLMProviderTestSettings() {
    const override = {
        aiProvider: {
            optionsetting: document.getElementById('aiProvider')?.value || 'ollama'
        }
    };

    [
        'ollamaendpoint', 'ollamamodel', 'chatgptApiKey', 'chatgptmodel',
        'geminiApiKey', 'geminimodel', 'xaiApiKey', 'xaimodel',
        'deepseekApiKey', 'deepseekmodel', 'groqApiKey', 'groqmodel',
        'openrouterApiKey', 'openroutermodel', 'opencodeApiKey', 'customAIEndpoint',
        'customAIModel', 'customAIApiKey', 'bedrockAccessKey',
        'bedrockSecretKey', 'bedrockRegion', 'bedrockmodel',
        'localgemmahost', 'localgemmamodel', 'localqwenmodel',
        'hostedLLMToken', 'hostedLLMEndpoint', 'hostedLLMModel'
    ].forEach(key => {
        const input = document.querySelector(`[data-textsetting='${key}']`);
        if (input) {
            override[key] = { textsetting: input.value.trim() };
        }
    });

    const opencodeModelSelect = document.querySelector("[data-optionsetting='opencodemodel']");
    if (opencodeModelSelect) {
        override.opencodemodel = { optionsetting: opencodeModelSelect.value || "auto" };
    }

    const keepAliveInput = document.querySelector("[data-numbersetting='ollamaKeepAlive']");
    if (keepAliveInput) {
        override.ollamaKeepAlive = { numbersetting: keepAliveInput.value };
    }

    return override;
}

function formatLLMProviderTestError(error) {
    if (!error) {
        return 'Unknown error';
    }
    if (typeof error === 'string') {
        return error;
    }

    const parts = [];
    if (error.provider) {
        parts.push(`Provider: ${error.provider}`);
    }
    if (error.status !== undefined && error.status !== null) {
        parts.push(`Status: ${error.status}`);
    }
    if (error.code) {
        parts.push(`Code: ${error.code}`);
    }
    if (error.message) {
        parts.push(`Message: ${error.message}`);
    }
    if (error.hint) {
        parts.push(`Hint: ${error.hint}`);
    }

    return parts.join('\n') || 'Unknown error';
}

async function testSelectedLLMProvider() {
    const button = document.getElementById('testSelectedLLMProvider');
    const status = document.getElementById('testSelectedLLMProviderStatus');
    const output = document.getElementById('testSelectedLLMProviderOutput');
    if (!button || !status || !output) {
        return;
    }

    const originalLabel = button.querySelector('span')?.textContent || button.textContent;
    const providerLabel = document.getElementById('aiProvider')?.selectedOptions?.[0]?.textContent || 'selected provider';

    button.disabled = true;
    if (button.querySelector('span')) {
        button.querySelector('span').textContent = 'Testing...';
    } else {
        button.textContent = 'Testing...';
    }
    status.textContent = `Testing ${providerLabel}...`;
    status.style.color = '#bbb';
    output.style.display = 'none';
    output.textContent = '';

    try {
        const response = await sendPopupBackgroundCommand({
            cmd: 'testLLMProvider',
            prompt: 'Reply with one short sentence confirming this chatbot connection works.',
            settingsOverride: collectLLMProviderTestSettings()
        }, 60000);

        if (response && response.success) {
            status.textContent = 'Connected';
            status.style.color = '#7ad37a';
            output.textContent = response.response || 'The provider replied without any text.';
        } else {
            status.textContent = 'Failed';
            status.style.color = '#ff8a8a';
            output.textContent = formatLLMProviderTestError(response?.error || response?.message || response);
            console.error('[LLM Test] Provider test failed:', response?.error || response?.message || response);
        }
    } catch (error) {
        status.textContent = 'Failed';
        status.style.color = '#ff8a8a';
        output.textContent = error?.message || String(error);
        console.error('[LLM Test] Provider test threw:', error);
    } finally {
        output.style.display = 'block';
        button.disabled = false;
        if (button.querySelector('span')) {
            button.querySelector('span').textContent = originalLabel;
        } else {
            button.textContent = originalLabel;
        }
    }
}

function isOpenAITTSProvider(provider) {
    provider = (provider || "").toString().toLowerCase();
    return provider === "openai" || provider === "customtts" || provider === "custom" || provider === "localtts" || provider === "local" || provider === "node" || provider === "nodejs" || provider === "connector";
}

// Handle TTS provider visibility
function handleTTSProviderVisibility(provider) {
    // Hide all TTS elements
    ["systemTTS", "elevenlabsTTS", "googleTTS", "geminiTTS", "speechifyTTS", "kokoroTTS", "kittenTTS", "openaiTTS"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });
    
    // Show element based on selected provider
    if (provider == "system") {
        document.getElementById("systemTTS").classList.remove("hidden");
    } else if (provider == "elevenlabs") {
        document.getElementById("elevenlabsTTS").classList.remove("hidden");
    } else if (provider == "google") {
        document.getElementById("googleTTS").classList.remove("hidden");
    } else if (provider == "gemini") {
        document.getElementById("geminiTTS").classList.remove("hidden");
    } else if (provider == "speechify") {
        document.getElementById("speechifyTTS").classList.remove("hidden");
    } else if (provider == "kokoro") {
        document.getElementById("kokoroTTS").classList.remove("hidden");
    } else if (provider == "kitten") {
        document.getElementById("kittenTTS").classList.remove("hidden");
    } else if (isOpenAITTSProvider(provider)) {
        document.getElementById("openaiTTS").classList.remove("hidden");
    }
}

// Handle secondary TTS provider visibility
function handleTTSProvider10Visibility(provider) {
    // Hide all TTS10 elements
    ["systemTTS10", "elevenlabsTTS10", "googleTTS10", "geminiTTS10", "speechifyTTS10", "kokoroTTS10", "kittenTTS10", "openaiTTS10"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });
    
    // Show element based on selected provider
    if (provider == "system") {
        document.getElementById("systemTTS10").classList.remove("hidden");
    } else if (provider == "elevenlabs") {
        document.getElementById("elevenlabsTTS10").classList.remove("hidden");
    } else if (provider == "google") {
        document.getElementById("googleTTS10").classList.remove("hidden");
    } else if (provider == "gemini") {
        document.getElementById("geminiTTS10").classList.remove("hidden");
    } else if (provider == "speechify") {
        document.getElementById("speechifyTTS10").classList.remove("hidden");
    } else if (provider == "kokoro") {
        document.getElementById("kokoroTTS10").classList.remove("hidden");
    } else if (provider == "kitten") {
        document.getElementById("kittenTTS10").classList.remove("hidden");
    } else if (isOpenAITTSProvider(provider)) {
        document.getElementById("openaiTTS10").classList.remove("hidden");
    }
}

// Handle featured TTS provider visibility (param2)
function handleTTSProvider2Visibility(provider) {
    // Hide all TTS2 elements
    ["systemTTS2", "elevenlabsTTS2", "googleTTS2", "geminiTTS2", "speechifyTTS2", "kokoroTTS2", "kittenTTS2", "openaiTTS2", "piperTTS2", "espeakTTS2"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });
    
    // Show element based on selected provider
    if (provider == "system") {
        document.getElementById("systemTTS2").classList.remove("hidden");
    } else if (provider == "elevenlabs") {
        document.getElementById("elevenlabsTTS2").classList.remove("hidden");
    } else if (provider == "google") {
        document.getElementById("googleTTS2").classList.remove("hidden");
    } else if (provider == "gemini") {
        document.getElementById("geminiTTS2").classList.remove("hidden");
    } else if (provider == "speechify") {
        document.getElementById("speechifyTTS2").classList.remove("hidden");
    } else if (provider == "kokoro") {
        document.getElementById("kokoroTTS2").classList.remove("hidden");
    } else if (provider == "kitten") {
        document.getElementById("kittenTTS2").classList.remove("hidden");
    } else if (isOpenAITTSProvider(provider)) {
        document.getElementById("openaiTTS2").classList.remove("hidden");
    } else if (provider == "piper") {
        document.getElementById("piperTTS2").classList.remove("hidden");
    } else if (provider == "espeak") {
        document.getElementById("espeakTTS2").classList.remove("hidden");
    }
}

// Handle Flow Actions TTS provider visibility (param18)
function handleTTSProvider18Visibility(provider) {
    // Hide all TTS18 elements
    ["systemTTS18", "elevenlabsTTS18", "googleTTS18", "geminiTTS18", "speechifyTTS18", "kokoroTTS18", "kittenTTS18", "openaiTTS18"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });

    // Show element based on selected provider
    if (provider == "system") {
        document.getElementById("systemTTS18")?.classList.remove("hidden");
    } else if (provider == "elevenlabs") {
        document.getElementById("elevenlabsTTS18")?.classList.remove("hidden");
    } else if (provider == "google") {
        document.getElementById("googleTTS18")?.classList.remove("hidden");
    } else if (provider == "gemini") {
        document.getElementById("geminiTTS18")?.classList.remove("hidden");
    } else if (provider == "speechify") {
        document.getElementById("speechifyTTS18")?.classList.remove("hidden");
    } else if (provider == "kokoro") {
        document.getElementById("kokoroTTS18")?.classList.remove("hidden");
    } else if (provider == "kitten") {
        document.getElementById("kittenTTS18")?.classList.remove("hidden");
    } else if (isOpenAITTSProvider(provider)) {
        document.getElementById("openaiTTS18")?.classList.remove("hidden");
    }
}

// Handle the deprecated sentiment setting
function handleDeprecatedSentiment() {
    try {
        var ele1 = document.querySelector("input[data-param1='badkarma']");
        if (ele1 && !ele1.checked) {
            ele1.checked = true;
            updateSettings(ele1, true);
        }
        chrome.runtime.sendMessage({cmd: "saveSetting", type: "setting", setting: "sentiment", "value": false}, function (response) {});
    } catch(e) {
        console.error(e);
    }
}

function compareVersions(a, b) { // https://stackoverflow.com/a/6832706
    if (a === b) {
       return 0;
    }

    var a_components = a.split(".");
    var b_components = b.split(".");

    var len = Math.min(a_components.length, b_components.length);

    // loop while the components are equal
    for (var i = 0; i < len; i++) {
        // A bigger than B
        if (parseInt(a_components[i]) > parseInt(b_components[i])) {
            return 1;
        }

        // B bigger than A
        if (parseInt(a_components[i]) < parseInt(b_components[i])) {
            return -1;
        }
    }

    // If one's a prefix of the other, the longer one is greater.
    if (a_components.length > b_components.length) {
        return 1;
    }

    if (a_components.length < b_components.length) {
        return -1;
    }

    // Otherwise they are the same.
    return 0;
}

var Beta = false;
var cachedManifestData = null; // Store the last successful manifest data

async function checkVersion() {
    const WEBSTORE_ID = "cppibjhfemifednoimlblfcmjgfhfjeg"; // our webstore ID
    
    if (chrome.runtime.id === WEBSTORE_ID) { // don't show version info if the webstore version
        document.getElementById("newVersion").classList.remove('show');
        document.getElementById("newVersion").innerHTML = "";
        return;
    }
    
    try {
        const manifestData = chrome.runtime.getManifest();
        
        // Try to load cached manifest from localStorage on startup
        if (!cachedManifestData) {
            try {
                const storedManifest = localStorage.getItem('cachedManifestData');
                if (storedManifest) {
                    cachedManifestData = JSON.parse(storedManifest);
                    console.log("Loaded cached manifest data from localStorage");
                }
            } catch (e) {
                console.error("Error loading cached manifest:", e);
                localStorage.removeItem('cachedManifestData'); // Clear invalid cache
            }
        }
        
        // Try to fetch the latest manifest
        fetch('https://socialstream.ninja/manifest.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Cache the successfully fetched manifest
            cachedManifestData = data;
            localStorage.setItem('cachedManifestData', JSON.stringify(data));
            processManifestData(data, manifestData);
        })
        .catch(error => {
            console.warn("Error fetching manifest:", error.message);
            
            // Use the cached data if fetch failed
            if (cachedManifestData) {
                console.log("Using cached manifest data");
                processManifestData(cachedManifestData, manifestData);
                
                // Add a note that we're using cached data
                const versionElement = document.getElementById("newVersion");
                if (versionElement.classList.contains('show')) {
                    versionElement.innerHTML += `<small class="cache-note" style="display:block;opacity:0.7"><br>⚠️ Using cached version info - couldn't connect to GitHub</small>`;
                } else {
                    versionElement.classList.add('show');
                    versionElement.innerHTML = `<small class="cache-note" style="display:block;opacity:0.7">⚠️ Couldn't check for new versions - using cached data</small>`;
                }
            } else {
                // No cache available - show error
                document.getElementById("newVersion").classList.add('show');
                document.getElementById("newVersion").innerHTML = `<small class="error-note" style="display:block;color:#f44336">⚠️ Couldn't check for updates: ${error.message}</small>`;
                console.warn("No cached manifest data available");
            }
        });
    } catch(e) {
        console.error("Version check error:", e);
        document.getElementById("newVersion").classList.add('show');
        document.getElementById("newVersion").innerHTML = `<small class="error-note" style="display:block;color:#f44336">⚠️ Error checking version: ${e.message}</small>`;
    }
}

// Function to process the manifest data (extracted to avoid code duplication)
function processManifestData(data, manifestData) {
    if (!data || !("version" in data)) {
        console.error("Invalid manifest data:", data);
        document.getElementById("newVersion").classList.add('show');
        document.getElementById("newVersion").innerHTML = `<small class="error-note" style="display:block;color:#f44336">⚠️ Invalid manifest data received</small>`;
        return;
    }
    
    try {
        if (manifestData && (compareVersions(manifestData.version, data.version) == -1)) {
            document.getElementById("newVersion").classList.add('show');
            document.getElementById("newVersion").innerHTML = `There's a <a target='_blank' class='downloadLink' title="Download the latest version as a zip" href='https://github.com/steveseguin/social_stream/archive/refs/heads/main.zip'>new version available 💾</a><p class="installed"><span>Installed: ${manifestData.version}</span><span>Available: ${data.version}</span><a title="See the list of recent code changes" href="https://github.com/steveseguin/social_stream/commits/main" target='_blank' style='text-decoration: underline;'>[change log]</a>`;
        } else if (manifestData && (compareVersions(manifestData.version, data.version) == 1)) { // beta
            document.getElementById("newVersion").classList.add('show');
            document.getElementById("newVersion").innerHTML = `You're using a BETA version. Thank you!<small><br><br>ℹ️ Note: The below overlay links point to their newest beta versions</small>`;
            Beta = true;
            if (Beta) {
                if (baseURL == "https://socialstream.ninja/") {
                    baseURL = "https://beta.socialstream.ninja/";
                    if (lastResponse) {
                        update(lastResponse, false);
                    }
                }
            }
        } else {
            document.getElementById("newVersion").classList.remove('show');
            document.getElementById("newVersion").innerHTML = "";
        }
        
        collectSourcesFromManifest(manifestData);
    } catch (e) {
        console.error("Error processing manifest data:", e);
        document.getElementById("newVersion").classList.add('show');
        document.getElementById("newVersion").innerHTML = `<small class="error-note" style="display:block;color:#f44336">⚠️ Error processing version info: ${e.message}</small>`;
    }
}

// Important Changes Notification System
var popupImportantChangesReady = false;
const importantChanges = [];
popupImportantChangesReady = true;

function shouldShowBeginnerChromeVideoGuide() {
    try {
        return !ssapp && typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getManifest === "function" && !!chrome.runtime.getManifest();
    } catch (e) {
        return false;
    }
}

function renderBeginnerWelcomeBanner(container) {
    container = container || document.getElementById("importantChanges");
    if (!container) return;

    const videoGuideText = shouldShowBeginnerChromeVideoGuide() ? ` If stuck getting started, check out this <a href="https://www.youtube.com/watch?v=Zql6Q5H2Eqw" target="_blank" rel="noopener noreferrer">video guide</a>.` : "";

    container.classList.add('show', 'beginner-welcome');
    container.innerHTML = `
        <div class="beginner-welcome-card">
            <strong>Welcome to Social Stream Ninja</strong>
            <small>You are in beginner mode, so only the most common setup options are shown.${videoGuideText}</small>
            <button type="button" id="beginnerWelcomeAdvanced">Switch to full mode</button>
        </div>
    `;

    const advancedButton = document.getElementById("beginnerWelcomeAdvanced");
    if (advancedButton) {
        advancedButton.addEventListener('click', function() {
            disablePopupBeginnerMode();
        });
    }
}

function checkImportantChanges() {
    const container = document.getElementById("importantChanges");
    if (!container) return;

    // Get current extension version
    let currentVersion = "0.0.0";
    try {
        const manifestData = chrome.runtime.getManifest();
        if (manifestData && manifestData.version) {
            currentVersion = manifestData.version;
        }
    } catch (e) {
        console.error("Error getting extension version:", e);
        return; // Can't determine version, don't show notifications
    }

    // Get dismissed changes from localStorage
    let dismissedChanges = [];
    try {
        const stored = localStorage.getItem('dismissedImportantChanges');
        if (stored) {
            dismissedChanges = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error loading dismissed changes:", e);
    }

    // Filter changes: not dismissed AND user's version >= minVersion
    const activeChanges = importantChanges.filter(change => {
        if (dismissedChanges.includes(change.id)) return false;
        if (change.minVersion && compareVersions(currentVersion, change.minVersion) < 0) return false;
        return true;
    });

    if (activeChanges.length === 0) {
        if (document.body.classList.contains("beginner-mode")) {
            renderBeginnerWelcomeBanner(container);
            return;
        }
        container.classList.remove('show', 'beginner-welcome');
        container.innerHTML = '';
        return;
    }

    // Build notification HTML (dismiss button now at bottom right)
    let html = '';
    activeChanges.forEach(change => {
        html += `
            <div class="important-change" data-change-id="${change.id}">
                <strong>${change.title}</strong><br>
                <small>${change.message}</small><br>
                <a href="#" class="change-action-link" data-target-section="${change.targetSection}" data-target-setting="${change.targetSetting}">${change.actionText}</a>
                <button class="dismiss-btn" data-change-id="${change.id}" title="Dismiss">&times;</button>
            </div>
        `;
    });

    container.innerHTML = html;
    container.classList.remove('beginner-welcome');
    container.classList.add('show');

    // Add event listeners for dismiss buttons
    container.querySelectorAll('.dismiss-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const changeId = this.dataset.changeId;
            dismissImportantChange(changeId);
        });
    });

    // Add event listeners for action links
    container.querySelectorAll('.change-action-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.dataset.targetSection;
            const targetSetting = this.dataset.targetSetting;
            scrollToSetting(targetSection, targetSetting);
        });
    });
}

function dismissImportantChange(changeId) {
    let dismissedChanges = [];
    try {
        const stored = localStorage.getItem('dismissedImportantChanges');
        if (stored) {
            dismissedChanges = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error loading dismissed changes:", e);
    }

    if (!dismissedChanges.includes(changeId)) {
        dismissedChanges.push(changeId);
        localStorage.setItem('dismissedImportantChanges', JSON.stringify(dismissedChanges));
    }

    // Re-check to update the display
    checkImportantChanges();
}

function scrollToSetting(targetSection, targetSetting) {
    // Find the collapsible section
    const sectionCheckbox = document.getElementById(targetSection);
    if (sectionCheckbox) {
        // Expand the collapsible if collapsed
        sectionCheckbox.checked = true;
    }

    // Find the setting element
    const settingElement = document.querySelector(`[data-setting="${targetSetting}"]`);
    if (settingElement) {
        // Scroll to the setting
        settingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add a brief highlight effect
        const parentDiv = settingElement.closest('div');
        if (parentDiv) {
            parentDiv.style.transition = 'background-color 0.3s';
            parentDiv.style.backgroundColor = 'rgba(255, 193, 7, 0.3)';
            setTimeout(() => {
                parentDiv.style.backgroundColor = '';
            }, 2000);
        }
    }
}

// Language parameter handling removed - use the translation dropdown instead


var baseURL = "https://socialstream.ninja/";

// First check if we're on a beta URL (either subdomain or path)
if (location.href.includes("/beta/") || location.hostname === "beta.socialstream.ninja"){
    Beta = true;
    baseURL = "https://beta.socialstream.ninja/";
}

if (sourcemode){
	baseURL = sourcemode;
} else if (devmode) {
    if (location.protocol === "file:") {
        baseURL = location.href.substring(0, location.href.lastIndexOf('/') + 1);
    } else {
        baseURL = "file:///C:/Users/steve/Code/social_stream/";
    }
} else if (location.hostname === "cache.socialstream.ninja") {
    baseURL = Beta ? "https://beta.socialstream.ninja/" : "https://socialstream.ninja/";
} else if (location.protocol !== "chrome-extension:" && !Beta) {
    // Only set baseURL from location if we're not already in beta mode
    baseURL = `${location.protocol}//${location.host}/`;
}




function updateURL(param, href) {
    href = href.replace("??", "?");
    var arr = href.split('?');
    var newurl;
    if (arr.length > 1 && arr[1] !== '') {
        newurl = href + '&' + param;
    } else {
        newurl = href + '?' + param;
    }
    newurl = newurl.replace("?&", "?");
    return newurl;
}

function removeQueryParamWithValue(url, paramWithValue) {
    let [baseUrl, queryString] = url.split('?');
    if (!queryString) {
        return url;
    }
    let [param, value] = paramWithValue.includes('=') ? paramWithValue.split('=') : [paramWithValue, null];
    let queryParams = queryString.split('&');
    queryParams = queryParams.filter(qp => {
        let [key, val] = qp.split('=');
        return !(key === param && (value === null || val === value));
    });
    let modifiedQueryString = queryParams.join('&');
    let modifiedUrl = baseUrl + (modifiedQueryString ? '?' + modifiedQueryString : '');
    return modifiedUrl;
}

function cleanURL(url) {
    return url.replace("&&", "&").replace("?&", "?");
}

function getTargetMap() {
    return {
        'dock': 1,
        'chatoverlaytemplate': 30,
        'overlay': 2,
        'emoteswall': 3,
        'hypemeter': 4,
        'waitlist': 5,
        'ticker': 6,
        'wordcloud': 7,
        'custom-gif-commands': 9,
        'chatbot': 10,
        'cohost': 11,
        'aioverlay': 28,
        'tipjar': 12,
        'credits': 13,
        'giveaway': 14,
		'leaderboard': 19,
		'games': 20,
        'privatechatbot': 15,
		'poll': 16,
		'eventsdashboard': 17,
		'flowactions': 18,
		'scoreboard': 21,
		'spotify': 22,
        'map': 23,
        'meta': 24,
        'multialerts': 25,
        'timer': 26,
		'reactions': 27,
        'hypetrain': 29,
    };
}

function showPopupToast(level, title, message) {
    const normalizedLevel = ['error', 'warning', 'info', 'success'].includes(level) ? level : 'info';
    try {
        if (typeof Toast !== 'undefined' && typeof Toast[normalizedLevel] === 'function') {
            Toast[normalizedLevel](title, message);
            return true;
        }
    } catch (_) {}
    try {
        if (window.parent && window.parent !== window && window.parent.Toast && typeof window.parent.Toast[normalizedLevel] === 'function') {
            window.parent.Toast[normalizedLevel](title, message);
            return true;
        }
    } catch (_) {}
    return false;
}

function updateFirstTimerUiState() {
    const disableDb = document.querySelector("input[data-setting='disableDB']");
    const firstTimers = document.querySelector("input[data-setting='firsttimers']");
    const dockBeep = document.querySelector("input[data-param1='beepfirsttime']");
    const dockWarning = document.getElementById("firstTimerDockBeepWarning");

    const databaseDisabled = !!(disableDb && disableDb.checked);
    const trackingEnabled = !!(firstTimers && firstTimers.checked);
    const dockBeepEnabled = !!(dockBeep && dockBeep.checked);

    if (dockWarning) {
        dockWarning.style.display = dockBeepEnabled && (!trackingEnabled || databaseDisabled) ? "inline" : "none";
    }
}

function enableFirstTimerDatabase(sync) {
    const disableDb = document.querySelector("input[data-setting='disableDB']");
    if (disableDb && disableDb.checked) {
        disableDb.checked = false;
        updateSettings(disableDb, sync);
        showPopupToast("info", "First-time chatters", "Local database enabled so first-time chatter detection can work.");
    }
    updateFirstTimerUiState();
}

function ensureFirstTimerTrackingForBeep(sync) {
    if (!sync) {
        updateFirstTimerUiState();
        return true;
    }

    const firstTimers = document.querySelector("input[data-setting='firsttimers']");
    if (firstTimers && !firstTimers.checked) {
        firstTimers.checked = true;
        updateSettings(firstTimers, sync);
    }

    enableFirstTimerDatabase(sync);
    updateFirstTimerUiState();
    return true;
}

function setupFirstTimerControls() {
    const enableRequirements = document.getElementById("enableFirstTimerDockRequirements");
    if (enableRequirements) {
        enableRequirements.onclick = function (event) {
            event.preventDefault();
            ensureFirstTimerTrackingForBeep(true);
        };
    }

    const showDatabaseSetting = document.getElementById("showFirstTimerDockDatabaseSetting");
    if (showDatabaseSetting) {
        showDatabaseSetting.onclick = function (event) {
            const databaseRow = document.getElementById("databaseSettingsRow");
            if (databaseRow) {
                event.preventDefault();
                databaseRow.scrollIntoView();
            }
        };
    }

    updateFirstTimerUiState();
}

function handleElementParam(ele, targetId, paramType, sync, value = null) {
    const paramAttr = `data-${paramType}`;
    const paramValue = ele.dataset[paramType]; // e.g., 'scale=0.77' or 'darkmode'
    if (!paramValue) return false;

    const targetElement = document.getElementById(targetId);
    if (!targetElement) return false;

    const paramNum = paramType.match(/\d+$/) ? paramType.match(/\d+$/)[0] : '';
    const parts = paramValue.split('=');
    const keyOnly = parts[0]; // e.g., 'scale' or 'darkmode'
    const valueInAttr = parts.length > 1 ? parts[1] : undefined; // e.g., '0.77' or undefined
    const effectiveKey = normalizeParamKey(keyOnly);

    if (ele.checked) {
        // Remove any existing instance of this parameter based on the key part
        targetElement.raw = removeQueryParamWithValue(targetElement.raw, effectiveKey);

        if (valueInAttr !== undefined) {
            // If the value is embedded in the data attribute (like 'scale=0.77'), use the full paramValue
            if (keyOnly === 'chromaalpha') {
                targetElement.raw = updateURL(`${effectiveKey}=${valueInAttr}`, targetElement.raw);
            } else {
                targetElement.raw = updateURL(paramValue, targetElement.raw);
            }
        } else {
			 // Determine the correct suffix for associated input attributes.
			// Only numbersetting strips the '1' (e.g., "data-numbersetting" not "data-numbersetting1")
			// textparam and optionparam keep the number (e.g., "data-textparam1", "data-optionparam1")
			const numberSettingSuffix = paramNum === '1' ? '' : paramNum;
			const otherSuffix = paramNum || '';

			const numberSettingSelector = `[data-numbersetting${numberSettingSuffix}='${keyOnly}']`;
			const optionSettingSelector = `[data-optionparam${otherSuffix}='${keyOnly}']`;
			const textSettingSelector = `[data-textparam${otherSuffix}='${keyOnly}']`;

			// Query for each type and take the first one found.
			const associatedNumberInput = document.querySelector(numberSettingSelector);
			const associatedOptionInput = document.querySelector(optionSettingSelector);
			const associatedTextInput = document.querySelector(textSettingSelector);

			const associatedInput = associatedNumberInput || associatedOptionInput || associatedTextInput;

            // Check if this is a select element with language/voice options
            if (associatedInput && associatedInput.tagName === 'SELECT' && associatedInput.selectedOptions.length > 0) {
                const selectedOption = associatedInput.selectedOptions[0];
                
                // Check if this is a language dropdown with voice data
                if (selectedOption.hasAttribute('data-lang') && selectedOption.value && selectedOption.value.includes('=')) {
                    // Parse the value to extract language and voice
                    const params = new URLSearchParams(selectedOption.value);
                    const langValue = params.get('lang') || selectedOption.getAttribute('data-lang');
                    const voiceValue = params.get('voice');
                    
                    // Handle language parameters specially
                    if (keyOnly === 'googlelang') {
                        // Remove existing parameters first to avoid duplicates
                        targetElement.raw = removeQueryParamWithValue(targetElement.raw, 'googlelang');
                        targetElement.raw = removeQueryParamWithValue(targetElement.raw, 'voicegoogle');
                        // Add new parameters
                        targetElement.raw = updateURL(`googlelang=${langValue}`, targetElement.raw);
                        targetElement.raw = updateURL(`voicegoogle=${voiceValue}`, targetElement.raw);
                    } else if (keyOnly === 'lang' || keyOnly === 'systemlang') {
                        // Remove existing parameters first to avoid duplicates
                        targetElement.raw = removeQueryParamWithValue(targetElement.raw, 'lang');
                        targetElement.raw = removeQueryParamWithValue(targetElement.raw, 'voice');
                        // Add new parameters
                        targetElement.raw = updateURL(`lang=${langValue}`, targetElement.raw);
                        targetElement.raw = updateURL(`voice=${voiceValue}`, targetElement.raw);
                    } else if (keyOnly === 'speechifylang') {
                        // Remove existing parameter first
                        targetElement.raw = removeQueryParamWithValue(targetElement.raw, 'voicespeechify');
                        // Speechify only uses voice parameter
                        targetElement.raw = updateURL(`voicespeechify=${voiceValue}`, targetElement.raw);
                    } else if (keyOnly.endsWith('lang')) {
                        // Generic handling for other *lang parameters
                        const prefix = keyOnly.slice(0, -4);
                        // Remove existing parameters first
                        targetElement.raw = removeQueryParamWithValue(targetElement.raw, keyOnly);
                        targetElement.raw = removeQueryParamWithValue(targetElement.raw, `voice${prefix}`);
                        // Add new parameters
                        targetElement.raw = updateURL(`${keyOnly}=${langValue}`, targetElement.raw);
                        targetElement.raw = updateURL(`voice${prefix}=${voiceValue}`, targetElement.raw);
                    } else {
                        // Not a language parameter, use standard handling
                        const valueToUse = keyOnly === 'chromaalpha'
                            ? formatChromaValueFromPercent((value !== null && value !== undefined) ? value : associatedInput.value)
                            : associatedInput.value;
                        targetElement.raw = updateURL(`${effectiveKey}=${encodeURIComponent(valueToUse)}`, targetElement.raw);
                    }
                } else {
                    // Standard select without language/voice data
                    const valueToUse = keyOnly === 'chromaalpha'
                        ? formatChromaValueFromPercent((value !== null && value !== undefined) ? value : associatedInput.value)
                        : associatedInput.value;
                    targetElement.raw = updateURL(`${effectiveKey}=${encodeURIComponent(valueToUse)}`, targetElement.raw);
                }
            } else if (associatedInput && associatedInput.code !== undefined && associatedInput.code !== '') {
                targetElement.raw = updateURL(`${effectiveKey}=${associatedInput.code}`, targetElement.raw);
            } else if (associatedInput && associatedInput.value !== undefined && associatedInput.value !== '') {
                let associatedValue = associatedInput.value;
                if (keyOnly === 'chromaalpha') {
                    const percentSource = (value !== null && value !== undefined) ? value : associatedValue;
                    associatedValue = formatChromaValueFromPercent(percentSource);
                }
                targetElement.raw = updateURL(`${effectiveKey}=${encodeURIComponent(associatedValue)}`, targetElement.raw);
            } else {
                // Simple flag parameter
                targetElement.raw = updateURL(effectiveKey, targetElement.raw);
            }
        }

        // Handle related number settings (e.g., rotate checkbox with rotatecount/rotatetime)
        const relatedSettingsAttr = `relatedSettings${paramNum}`;
        const relatedSettings = ele.dataset[relatedSettingsAttr];
        if (relatedSettings) {
            const numSuffix = paramNum === '1' ? '' : paramNum;
            relatedSettings.split(',').forEach(settingName => {
                const relatedInput = document.querySelector(`[data-numbersetting${numSuffix}='${settingName}']`);
                if (relatedInput && relatedInput.value) {
                    targetElement.raw = updateURL(`${settingName}=${encodeURIComponent(relatedInput.value)}`, targetElement.raw);
                }
            });
        }

        // Handle special case exclusions
        handleExclusiveCases(ele, paramType, paramValue, sync);
    } else { // ele.checked is false
        // If checkbox is unchecked, remove the parameter from URL based on the key part
        targetElement.raw = removeQueryParamWithValue(targetElement.raw, effectiveKey);

        // Remove related settings when checkbox is unchecked
        const relatedSettingsAttr = `relatedSettings${paramNum}`;
        const relatedSettings = ele.dataset[relatedSettingsAttr];
        if (relatedSettings) {
            relatedSettings.split(',').forEach(settingName => {
                targetElement.raw = removeQueryParamWithValue(targetElement.raw, settingName);
            });
        }
        
        // Special handling for language parameters - also remove associated voice parameter
        if (keyOnly === 'googlelang') {
            targetElement.raw = removeQueryParamWithValue(targetElement.raw, 'voicegoogle');
        } else if (keyOnly === 'lang' || keyOnly === 'systemlang') {
            targetElement.raw = removeQueryParamWithValue(targetElement.raw, 'voice');
        } else if (keyOnly === 'speechifylang') {
            targetElement.raw = removeQueryParamWithValue(targetElement.raw, 'voicespeechify');
        } else if (keyOnly.endsWith('lang')) {
            // Generic handling for other *lang parameters
            const prefix = keyOnly.slice(0, -4);
            targetElement.raw = removeQueryParamWithValue(targetElement.raw, `voice${prefix}`);
        }
    }

    targetElement.raw = cleanURL(targetElement.raw);

    if (sync) {
        // Still save the checkbox state using the full paramValue
        chrome.runtime.sendMessage({
            cmd: "saveSetting",
            type: paramType,
            target: ele.dataset.target || null,
            setting: paramValue, // Save the full paramValue ('scale=0.77')
            value: ele.checked
        }, function (response) {});

        // Save associated text/number/option value if applicable, using the key part
        const numberSettingSuffixSave = paramNum === '1' ? '' : paramNum;
        const associatedInput = document.querySelector(
            `[data-numbersetting${numberSettingSuffixSave}='${keyOnly}'], ` +
            `[data-optionparam${paramNum}='${keyOnly}'], ` +
            `[data-textparam${paramNum}='${keyOnly}']`
        );
        if (associatedInput && (associatedInput.value !== undefined || associatedInput.code !== undefined)) {
            const isNum = associatedInput.hasAttribute(`data-numbersetting${numberSettingSuffixSave}`);
            const isOpt = associatedInput.hasAttribute(`data-optionparam${paramNum}`);
            const inputType = isNum
                ? (paramNum === '1' ? 'numbersetting' : `numbersetting${paramNum}`)
                : (isOpt ? `optionparam${paramNum}` : `textparam${paramNum}`);
            chrome.runtime.sendMessage({
                cmd: "saveSetting",
                type: inputType,
                target: ele.dataset.target || null,
                setting: keyOnly,
                value: associatedInput.code || associatedInput.value
            }, function (response) {});
        }
    }

    // Handle "siblings" with the same param prefix
    // Only uncheck related toggles that control the same key (e.g., opacity=..., scale=...)
    const paramPrefixRaw = paramValue.split('=')[0];
    const normalizedPrefix = normalizeParamKey(paramPrefixRaw);
    // Only handle siblings if the param contains '=' (like scale=2, opacity=0.3) or the bare key itself
    if (paramValue.includes('=') || paramValue === paramPrefixRaw) {
        // Select only inputs that control the same key for this param group, excluding the current element
        const selector = `input[data-${paramType}^='${normalizedPrefix}='], input[data-${paramType}='${normalizedPrefix}'], input[data-${paramType}='${paramPrefixRaw}']`;
        document.querySelectorAll(selector).forEach(ele1 => {
            if (ele1 !== ele && ele1.checked) {
                ele1.checked = false;
                updateSettings(ele1, sync);
            }
        });
    }

    if (paramType === "param1" && paramValue === "beepfirsttime") {
        updateFirstTimerUiState();
    }

    return true;
}
function handleExclusiveCases(ele, paramType, paramValue, sync) {
    const exclusiveTypes = ['param1', 'param2', 'param4', 'param5', 'param13', 'param25'];
    if (!exclusiveTypes.includes(paramType)) return;

    // Handle exclusive settings like darkmode/lightmode
    const exclusiveMap = {
        param1: {
            'darkmode': 'lightmode',
            'lightmode': 'darkmode',
            'onlytwitch': 'hidetwitch',
            'hidetwitch': 'onlytwitch'
        },
        param2: {
            'transparent': 'chroma',
            'chroma': 'transparent'
        },
        param4: {
            'alignright': 'align=center',
            'align=center': 'alignright',
            'transparent': 'pagebg',
            'pagebg': 'transparent'
        },
        param5: {
            'alignright': 'aligncenter',
            'aligncenter': 'alignright',
            'transparent': 'pagebg',
            'pagebg': 'transparent'
        },
        param13: {
            'nobg': 'pagebg',
            'pagebg': 'nobg'
        },
        param25: {
            'alignright': 'align=center',
            'align=center': 'alignright',
            'transparent': ['pagebg', 'chroma=00ff00'],
            'pagebg': 'transparent',
            'chroma=00ff00': 'transparent'
        }
    };

    if (exclusiveMap[paramType] && exclusiveMap[paramType][paramValue]) {
        const oppositeKeys = [].concat(exclusiveMap[paramType][paramValue]);
        oppositeKeys.forEach(oppositeKey => {
            const oppositeEle = document.querySelector(`input[data-${paramType}='${oppositeKey}']`);
            if (oppositeEle && oppositeEle.checked) {
                oppositeEle.checked = false;
                updateSettings(oppositeEle, sync);
            }
        });
    }
    
    // Handle special case for 'badkarma'
    if (paramValue === 'badkarma') {
        const karmaEle = document.querySelector("input[data-setting='addkarma']");
        if (karmaEle && !karmaEle.checked) {
            karmaEle.checked = true;
            updateSettings(karmaEle, sync);
        }
    }
    
    // Handle compact sync
    if (paramValue === 'compact') {
        document.querySelectorAll("input[data-param1='compact']").forEach(el => {
            el.checked = ele.checked;
        });
    }
}

function handleTextParam(ele, targetId, paramType, sync) {
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return false;
    
    const paramValue = ele.dataset[paramType];
    if (!paramValue) return false;
    
    // Get the param number (e.g., "10" from "textparam10")
    const paramNum = paramType.match(/\d+$/) ? paramType.match(/\d+$/)[0] : '';
    
    // Check if there's a corresponding checkbox
    const checkboxSelector = `input[data-param${paramNum}='${paramValue}']`;
    const checkbox = document.querySelector(checkboxSelector);

    // For color text params with paired checkboxes, auto-toggle so users don't need two steps.
    if (sync && checkbox && (paramValue === 'viewerbarbg' || paramValue === 'pagebg' || paramValue === 'bgcolor')) {
        const hasTextValue = Boolean((ele.value || '').trim());
        if (checkbox.checked !== hasTextValue) {
            checkbox.checked = hasTextValue;
            updateSettings(checkbox, sync);
        }
    }
    
    // Only modify URL if there's no checkbox, or if checkbox exists and is checked
    if (!checkbox || checkbox.checked) {
        // First remove any existing instance of this parameter
        targetElement.raw = removeQueryParamWithValue(targetElement.raw, paramValue);
        
        if (ele.value) {
            // If there's a value, add the parameter with value
            if (paramValue === 'cssb64') {
                targetElement.raw = updateURL(`${paramValue}=${btoa(encodeURIComponent(ele.value))}`, targetElement.raw);
            } else {
                targetElement.raw = updateURL(`${paramValue}=${encodeURIComponent(ele.value)}`, targetElement.raw);
            }
        } else if (checkbox && checkbox.checked) {
            // If value is empty but checkbox is checked, add the parameter without a value
            targetElement.raw = updateURL(paramValue, targetElement.raw);
        }
        
        targetElement.raw = cleanURL(targetElement.raw);
    }
    
    // Always save the text parameter value regardless of checkbox state
    if (sync) {
        chrome.runtime.sendMessage({
            cmd: "saveSetting",
            type: paramType,
            target: ele.dataset.target || null,
            setting: paramValue,
            value: ele.value
        }, function (response) {});
    }
    
    // Keep any linked color picker synchronized with the text value
    handleColorAndPalette(ele);
    
    return true;
}

function refreshTtsProviderParamControls(paramNum, providerValue) {
    paramNum = paramNum || '1';
    const suffix = paramNum === '1' ? '' : String(paramNum);
    const providerKey = isOpenAITTSProvider(providerValue) ? 'openai' : providerValue;
    const section = document.getElementById(`${providerKey}TTS${suffix}`);
    if (!section) return;

    if (typeof beginPopupLinkRefreshBatch === "function") {
        beginPopupLinkRefreshBatch();
    }
    try {
        section.querySelectorAll(`input[data-param${paramNum}]`).forEach(function(input) {
            if (input.checked) {
                updateSettings(input, false);
            }
        });
        section.querySelectorAll(`input[data-textparam${paramNum}], textarea[data-textparam${paramNum}], select[data-optionparam${paramNum}]`).forEach(function(input) {
            updateSettings(input, false);
        });
    } finally {
        if (typeof endPopupLinkRefreshBatch === "function") {
            endPopupLinkRefreshBatch();
        } else {
            refreshLinks();
        }
    }
}

function handleOptionParam(ele, targetId, paramType, sync) {
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return false;
    
    const paramValue = ele.dataset[paramType];
    if (!paramValue) return false;
    
    const isMapTarget = targetId === 'map';
    const paramKey = isMapTarget ? paramValue.toLowerCase() : paramValue;

    // Remove both the original and normalized keys to avoid duplicates
    targetElement.raw = removeQueryParamWithValue(targetElement.raw, paramValue);
    if (paramKey !== paramValue) {
        targetElement.raw = removeQueryParamWithValue(targetElement.raw, paramKey);
    }
    
    // Check if this option should be active based on its related checkbox
    // Extract the number from paramType (e.g., "10" from "optionparam10")
    const paramNum = paramType.match(/\d+$/) ? paramType.match(/\d+$/)[0] : '';
    const preEleSelector = `[data-param${paramNum}='${paramValue}']`;
    const preEle = document.querySelector(preEleSelector);
    
    if (ele.value && (!preEle || preEle.checked)) {
        // Remove any conflicting parameters first
        ele.value.split("&").forEach(rem => {
            if (rem.includes("=")) {
                targetElement.raw = removeQueryParamWithValue(targetElement.raw, rem.split("=")[0]);
            }
        });
        
        // Special handling for TTS provider
        if (paramValue === 'ttsprovider') {
            // Clean TTS provider-specific parameters when changing providers
            targetElement.raw = removeTTSProviderParams(targetElement.raw, ele.value);

            // Handle visibility for TTS provider options based on paramNum
            if (paramNum === '18') {
                handleTTSProvider18Visibility(ele.value);
            } else if (paramNum === '10') {
                handleTTSProvider10Visibility(ele.value);
            } else if (paramNum === '2') {
                handleTTSProvider2Visibility(ele.value);
            } else if (paramNum === '' || paramNum === '1') {
                handleTTSProviderVisibility(ele.value);
            }
            refreshTtsProviderParamControls(paramNum || '1', ele.value);
        }
        
        // Check if this is a select element with language/voice options
        if (ele.tagName === 'SELECT' && ele.selectedOptions.length > 0) {
            const selectedOption = ele.selectedOptions[0];
            
            // Check if this is a language dropdown with voice data
            if (selectedOption.hasAttribute('data-lang') && selectedOption.value && selectedOption.value.includes('=')) {
                // Parse the value to extract language and voice
                const params = new URLSearchParams(selectedOption.value);
                const langValue = params.get('lang') || selectedOption.getAttribute('data-lang');
                const voiceValue = params.get('voice');
            
                // Determine the correct parameter names based on the paramValue
                if (paramValue === 'googlelang') {
                    targetElement.raw = updateURL(`googlelang=${langValue}`, targetElement.raw);
                    targetElement.raw = updateURL(`voicegoogle=${voiceValue}`, targetElement.raw);
                } else if (paramValue === 'speechifylang') {
                    // Speechify doesn't use separate lang param, just voice
                    targetElement.raw = updateURL(`voicespeechify=${voiceValue}`, targetElement.raw);
                } else if (paramValue === 'lang' || paramValue === 'systemlang') {
                    // System TTS uses generic lang and voice
                    targetElement.raw = updateURL(`lang=${langValue}`, targetElement.raw);
                    targetElement.raw = updateURL(`voice=${voiceValue}`, targetElement.raw);
                } else if (paramValue.endsWith('lang')) {
                    // Generic handling for other *lang parameters
                    const prefix = paramValue.slice(0, -4);
                    targetElement.raw = updateURL(`${paramKey}=${langValue}`, targetElement.raw);
                    targetElement.raw = updateURL(`voice${prefix}=${voiceValue}`, targetElement.raw);
                } else {
                    // Not a language parameter, use standard value
                    targetElement.raw = updateURL(`${paramKey}=${encodeURIComponent(ele.value)}`, targetElement.raw);
                }
            } else {
                // Standard select without language/voice data
                targetElement.raw = updateURL(`${paramKey}=${encodeURIComponent(ele.value)}`, targetElement.raw);
            }
        } else {
            // Not a select element, use standard value
            targetElement.raw = updateURL(`${paramKey}=${encodeURIComponent(ele.value)}`, targetElement.raw);
        }
    }
    
    targetElement.raw = cleanURL(targetElement.raw);
    
    if (sync) {
        chrome.runtime.sendMessage({
            cmd: "saveSetting",
            type: paramType,
            target: ele.dataset.target || null,
            setting: paramValue,
            value: ele.value
        }, function (response) {});
    }
    
    return true;
}


function handleDelParam(ele, sync) {
    // Get the target map to determine which indices are valid
    const targetMap = getTargetMap();
    const invertedMap = {};
    
    // Create an inverted map to look up target by index
    Object.entries(targetMap).forEach(([target, index]) => {
        invertedMap[index] = target;
    });
    
    // Handle data-del1, data-del2, etc. attributes
    for (let i = 1; i <= Object.keys(targetMap).length; i++) {
        const delAttr = `del${i}`;
        if (ele.dataset[delAttr]) {
            const targetId = invertedMap[i];
            
            if (targetId) {
                ele.dataset[delAttr].split(",").forEach(target => {
                    document.getElementById(targetId).raw = removeQueryParamWithValue(
                        document.getElementById(targetId).raw, target.trim()
                    );
                });
                return true;
            }
        }
    }
    return false;
}

function handleBothParam(ele, sync) {
    if (!ele.dataset.both) return false;
    
    // Use the same list of targets as defined in the targetMap
    const elements = Object.keys(getTargetMap()).filter(id => id !== "chatoverlaytemplate");

    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.raw = ele.checked 
                ? updateURL(ele.dataset.both, element.raw)
                : removeQueryParamWithValue(element.raw, ele.dataset.both);
                
            element.raw = cleanURL(element.raw);
        }
    });

    if (sync) {
        chrome.runtime.sendMessage({
            cmd: "saveSetting",
            type: "both",
            target: ele.dataset.target || null,
            setting: ele.dataset.both,
            value: ele.checked
        }, function (response) {});
    }
    
    return true;
}

function updateVideoStatsSettingsVisibility(sourceValue) {
    const sourceSelect = document.querySelector('select[data-optionsetting="videostatssource"]');
    const source = sourceValue || (sourceSelect ? sourceSelect.value : "srt-live-server");
    const usesPublisher = source === "srt-live-server" || source === "belabox-cloud";
    const usesAppKey = source === "nginx-rtmp" || source === "node-media-server";
    const usesApiKey = source === "srt-live-server";
    const usesBasicAuth = source === "node-media-server";

    document.querySelectorAll(".video-stats-publisher-field").forEach(ele => {
        ele.classList.toggle("hidden", !usesPublisher);
    });
    document.querySelectorAll(".video-stats-app-field").forEach(ele => {
        ele.classList.toggle("hidden", !usesAppKey);
    });
    document.querySelectorAll(".video-stats-api-key-field").forEach(ele => {
        ele.classList.toggle("hidden", !usesApiKey);
    });
    document.querySelectorAll(".video-stats-basic-auth-field").forEach(ele => {
        ele.classList.toggle("hidden", !usesBasicAuth);
    });
}

function handleSetting(ele, sync) {
    if (!ele.dataset.setting) return false;
    
    // Handle special cases for settings
    if (ele.dataset.setting === "addkarma" && !ele.checked) {
        const ele1 = document.querySelector("input[data-param1='badkarma']");
        if (ele1 && ele1.checked) {
            ele1.checked = false;
            updateSettings(ele1, sync);
        }
    }
    
    if (ele.dataset.setting === "drawmode") {
        if (ele.checked) {
            document.getElementById("drawmode").classList.remove("hidden");
            document.getElementById("queuemode").classList.add("hidden");
        } else {
            document.getElementById("drawmode").classList.add("hidden");
            document.getElementById("queuemode").classList.remove("hidden");
        }
    }
    
    if (ele.dataset.setting === "waitlistmode") {
        if (ele.checked) {
            document.getElementById("waitlistbuttons").classList.remove("hidden");
        } else {
            document.getElementById("waitlistbuttons").classList.add("hidden");
        }
    }
    
    if (ele.dataset.setting === "hideyourlinks") {
        refreshLinks();
    }

    if (ele.dataset.setting === "aiOverlayTts") {
        updateAiOverlayLinksFromCurrentState();
    }
    
    // Handle MIDI toggle
    if (ele.dataset.setting === "midi") {
        handleMidiToggle(ele.checked);
    }

    if (ele.dataset.setting === "videostatspoller") {
        updateVideoStatsSettingsVisibility();
    }

    if (ele.dataset.setting === "firsttimers" && ele.checked && sync) {
        enableFirstTimerDatabase(sync);
    }

    if ((ele.dataset.setting === "beepreturning" || ele.dataset.setting === "firsttimerbadge") && ele.checked && !ensureFirstTimerTrackingForBeep(sync)) {
        ele.checked = false;
        return true;
    }
    
    if (sync) {
        chrome.runtime.sendMessage({
            cmd: "saveSetting",
            type: "setting",
            target: ele.dataset.target || null,
            setting: ele.dataset.setting,
            value: ele.checked
        }, function (response) {});
    }

    if (ele.dataset.setting === "disableDB" || ele.dataset.setting === "firsttimers" || ele.dataset.setting === "beepreturning" || ele.dataset.setting === "firsttimerbadge") {
        updateFirstTimerUiState();
    }
    
    return true;
}

function handleSpecialSettings(ele, sync) {
    if (!ele.dataset.special) return false;
    
    if (ele.dataset.special === "session") {
        let xsx = validateRoomId(ele.value);
        if (!xsx) {
            alert("Invalid session ID.");
        } else {
            ele.value = xsx;
            if (chrome && chrome.storage && chrome.storage.sync && chrome.storage.sync.set) {
                chrome.storage.sync.set({ streamID: xsx });
            }
            chrome.runtime.sendMessage({
                cmd: "sidUpdated",
                target: ele.dataset.target || null,
                streamID: xsx
            }, function (response) { 
				log("Password updated");
				if (response.streamID || response.password){
					update(response, false);
				}
			});
        }
    } else if (ele.dataset.special === "password") {
        if (chrome && chrome.storage && chrome.storage.sync && chrome.storage.sync.set) {
            chrome.storage.sync.set({ password: ele.value });
        }
        chrome.runtime.sendMessage({
            cmd: "sidUpdated",
            target: ele.dataset.target || null,
            password: ele.value || ""
        }, function (response) {
			log("Password updated");
			if (response.streamID || response.password){
				update(response, false);
			}
		});
    }
    
    return true;
}

function handleOptionSetting(ele, sync) {
    if (!ele.dataset.optionsetting && !ele.dataset.optionsetting2 && !ele.dataset.optionsetting10 && !ele.dataset.optionsetting18) return false;
    
    const settingType = ele.dataset.optionsetting ? 'optionsetting' : 
                       (ele.dataset.optionsetting2 ? 'optionsetting2' :
                       (ele.dataset.optionsetting10 ? 'optionsetting10' : 'optionsetting18'));
    const settingValue = ele.dataset[settingType];
    
    // Handle poll type
    if (settingValue === "pollType") {
        if (ele.value === "multiple") {
            document.getElementById("multipleChoiceOptions").classList.remove("hidden");
        } else {
            document.getElementById("multipleChoiceOptions").classList.add("hidden");
        }
    }

    if (settingValue === "videostatssource") {
        updateVideoStatsSettingsVisibility(ele.value);
    }

    if (settingValue === "aiOverlayPosition") {
        updateAiOverlayLinksFromCurrentState();
    }
    
    // Handle AI Provider settings
    if (settingValue === "aiProvider") {
        // Hide all AI provider-specific elements
		const aiProviderElements = [
			'bedrockAccessKey', 'bedrockSecretKey', 'bedrockRegion', 'bedrockmodel',
			'chatgptApiKey', 'geminiApiKey', 'geminimodel', 'xaiApiKey', 'xaimodel',
			'chatgptmodel', 'deepseekApiKey', 'deepseekmodel', 'customAIEndpoint',
			'customAIModel', 'ollamamodel', 'ollamaendpoint', 'ollamaKeepAlive',
			'openrouterApiKey', 'openroutermodel', 'groqApiKey', 'groqmodel',
			'opencodeInfo', 'opencodeApiKey', 'opencodemodel',
			'customAIApiKey', 'localgemmahost', 'localbrowserhelp', 'localgemmamodel', 'localqwenmodel',
			'hostedLLMInfo', 'hostedLLMToken', 'hostedLLMEndpoint', 'hostedLLMModel'
		];
        
        aiProviderElements.forEach(id => {
            document.getElementById(id).classList.add("hidden");
        });
        
		// Show elements relevant to the selected AI provider
        switch (ele.value) {
            case 'ollama':
                document.getElementById("ollamamodel").classList.remove("hidden");
                document.getElementById("ollamaendpoint").classList.remove("hidden");
                document.getElementById("ollamaKeepAlive").classList.remove("hidden");
                break;
            case 'chatgpt':
                document.getElementById("chatgptApiKey").classList.remove("hidden");
                document.getElementById("chatgptmodel").classList.remove("hidden");
                break;
            case 'gemini':
                document.getElementById("geminiApiKey").classList.remove("hidden");
                document.getElementById("geminimodel").classList.remove("hidden");
                break;
            case 'deepseek':
                document.getElementById("deepseekApiKey").classList.remove("hidden");
                document.getElementById("deepseekmodel").classList.remove("hidden");
                break;
            case 'xai':
                document.getElementById("xaiApiKey").classList.remove("hidden");
                document.getElementById("xaimodel").classList.remove("hidden");
                break;
            case 'bedrock':
                document.getElementById('bedrockAccessKey').classList.remove('hidden');
                document.getElementById('bedrockSecretKey').classList.remove('hidden');
                document.getElementById('bedrockRegion').classList.remove('hidden');
                document.getElementById('bedrockmodel').classList.remove('hidden');
                break;
			case 'openrouter':
				document.getElementById("openrouterApiKey").classList.remove("hidden");
				document.getElementById("openroutermodel").classList.remove("hidden");
				break;
            case 'groq':
                document.getElementById("groqApiKey").classList.remove("hidden");
                document.getElementById("groqmodel").classList.remove("hidden");
                break;
            case 'opencode':
                document.getElementById("opencodeInfo").classList.remove("hidden");
                document.getElementById("opencodeApiKey").classList.remove("hidden");
                document.getElementById("opencodemodel").classList.remove("hidden");
                loadOpenCodeModels(false);
                break;
            case 'hostedllm':
                document.getElementById("hostedLLMInfo").classList.remove("hidden");
                document.getElementById("hostedLLMToken").classList.remove("hidden");
                document.getElementById("hostedLLMEndpoint").classList.remove("hidden");
                document.getElementById("hostedLLMModel").classList.remove("hidden");
                break;
            case 'localgemma':
                document.getElementById("localgemmahost").classList.remove("hidden");
                document.getElementById("localbrowserhelp").classList.remove("hidden");
                document.getElementById("localgemmamodel").classList.remove("hidden");
                break;
            case 'localqwen':
                document.getElementById("localgemmahost").classList.remove("hidden");
                document.getElementById("localbrowserhelp").classList.remove("hidden");
                document.getElementById("localqwenmodel").classList.remove("hidden");
                break;
            case 'custom':
                document.getElementById("customAIEndpoint").classList.remove("hidden");
                document.getElementById("customAIModel").classList.remove("hidden");
                document.getElementById("customAIApiKey").classList.remove("hidden");
                break;
        }
    }
    
    // Handle TTS Provider settings
    if (settingValue === "ttsProvider") {
		
        const suffix = settingType === 'optionsetting2' ? '2' : (settingType === 'optionsetting10' ? '10' : (settingType === 'optionsetting18' ? '18' : ''));
        const ttsProviderElements = [
            `systemTTS${suffix}`, `elevenlabsTTS${suffix}`, `googleTTS${suffix}`, `geminiTTS${suffix}`,
            `speechifyTTS${suffix}`, `kokoroTTS${suffix}`, `kittenTTS${suffix}`, `openaiTTS${suffix}`, `piperTTS${suffix}`, `espeakTTS${suffix}`
        ];
        
        ttsProviderElements.forEach(id => {
            if (document.getElementById(id)) {
                document.getElementById(id).classList.add("hidden");
            }
        });
        
        // Show elements relevant to the selected TTS provider
        const providerKey = isOpenAITTSProvider(ele.value) ? "openai" : ele.value;
        const selectedProvider = `${providerKey}TTS${suffix}`;
        if (document.getElementById(selectedProvider)) {
            document.getElementById(selectedProvider).classList.remove("hidden");
        }
    }
    
    if (sync) {
        chrome.runtime.sendMessage({
            cmd: "saveSetting",
            type: settingType,
            target: ele.dataset.target || null,
            setting: settingValue,
            value: ele.value
        }, function (response) {});
    }
    
    return true;
}

function updateRangeDisplay(ele) {
    if (!ele || ele.type !== 'range') {
        return;
    }

    const displayId = ele.dataset.rangeDisplay;
    if (!displayId) {
        return;
    }

    const displayEle = document.getElementById(displayId);
    if (!displayEle) {
        return;
    }

    const suffix = ele.dataset.rangeSuffix || '';
    const rawValue = parseFloat(ele.value);
    if (Number.isNaN(rawValue)) {
        return;
    }

    let formattedValue;
    if (suffix === '%') {
        formattedValue = `${Math.round(rawValue)}${suffix}`;
    } else {
        formattedValue = rawValue.toFixed(2);
        if (suffix) {
            formattedValue += suffix;
        }
    }
	if (formattedValue){
		displayEle.textContent = formattedValue;
	}
}

function formatChromaValueFromPercent(percentValue) {
    const numericValue = parseFloat(percentValue);
    if (Number.isNaN(numericValue)) {
        return '0000';
    }

    const clampedPercent = Math.max(0, Math.min(100, numericValue));
    const alphaNibble = Math.round((clampedPercent / 100) * 15);
    return `000${alphaNibble.toString(16)}`;
}

function getPercentFromChromaValue(chromaValue) {
    if (!chromaValue) {
        return null;
    }

    const sanitized = chromaValue.replace('#', '').trim();
    if (!sanitized) {
        return null;
    }

    let alphaHex;
    let divisor;

    if (sanitized.length >= 8) {
        alphaHex = sanitized.slice(-2);
        divisor = 255;
    } else {
        alphaHex = sanitized.slice(-1);
        divisor = 15;
    }

    const alphaDecimal = parseInt(alphaHex, 16);
    if (Number.isNaN(alphaDecimal)) {
        return null;
    }

    const percent = Math.round((alphaDecimal / divisor) * 100);
    return Math.max(0, Math.min(100, percent));
}

function normalizeParamKey(key) {
    return key === 'chromaalpha' ? 'chroma' : key;
}

function handleNumberSetting(ele, sync) {
    // Get the target map to determine which indices are valid
    const targetMap = getTargetMap();
    const invertedMap = {};

    // Create an inverted map to look up target by index
    Object.entries(targetMap).forEach(([target, index]) => {
        invertedMap[index] = target;
    });
    
    // Handle numbersetting, numbersetting2, etc.
    for (let i = 1; i <= Object.keys(targetMap).length; i++) {
        const settingType = i === 1 ? 'numbersetting' : `numbersetting${i}`;
        if (!ele.dataset[settingType]) continue;
        
        const settingValue = ele.dataset[settingType];
        
        if (sync) {
            chrome.runtime.sendMessage({
                cmd: "saveSetting",
                type: settingType,
                target: ele.dataset.target || null,
                setting: settingValue,
                value: ele.value
            }, function (response) {});
        }
        
        // Get corresponding target element from the map
        const targetId = invertedMap[i];
        if (!targetId) continue;
        
        const paramAttr = `data-param${i}`;

        // Update URL parameter if corresponding checkbox is checked
        let checkbox = document.querySelector(`input[${paramAttr}='${settingValue}']`);

        // If no direct checkbox, check for a parent checkbox that has this as a related setting
        if (!checkbox) {
            const relatedAttr = `data-related-settings${i}`;
            checkbox = document.querySelector(`input[${relatedAttr}*='${settingValue}']`);
        }

        if (checkbox && checkbox.checked) {
            const targetElement = document.getElementById(targetId);
            const effectiveKey = normalizeParamKey(settingValue);
            targetElement.raw = removeQueryParamWithValue(targetElement.raw, effectiveKey);
            let valueForParam = ele.value;
            if (settingValue === 'chromaalpha') {
                valueForParam = formatChromaValueFromPercent(valueForParam);
            }
            targetElement.raw = updateURL(`${effectiveKey}=${encodeURIComponent(valueForParam)}`, targetElement.raw);
        }
        
        if (ele.type === 'range') {
            ele.dataset.rangePrevValue = ele.value;
        }
        updateRangeDisplay(ele);
        return true;
    }
    
    return false;
}

function clampAlphaPercent(alphaValue, fallback = 100) {
    const numeric = parseFloat(alphaValue);
    if (Number.isNaN(numeric)) {
        return fallback;
    }
    return Math.max(0, Math.min(100, numeric));
}

function toHexComponent(value) {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
}

function parseColorValue(colorValue) {
    if (!colorValue) {
        return null;
    }
    const normalized = String(colorValue).trim();
    const hexMatch = normalized.match(/^#?([a-fA-F0-9]{3,4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3 || hex.length === 4) {
            hex = hex.split('').map((ch) => ch + ch).join('');
        }
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return { r, g, b, a };
    }

    const rgbaMatch = normalized.match(/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9]*\.?[0-9]+))?\s*\)$/i);
    if (rgbaMatch) {
        const r = Math.max(0, Math.min(255, parseInt(rgbaMatch[1], 10)));
        const g = Math.max(0, Math.min(255, parseInt(rgbaMatch[2], 10)));
        const b = Math.max(0, Math.min(255, parseInt(rgbaMatch[3], 10)));
        const a = rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1;
        return { r, g, b, a };
    }

    return null;
}

function formatHexColor(rgbColor) {
    if (!rgbColor) {
        return null;
    }
    return `#${toHexComponent(rgbColor.r)}${toHexComponent(rgbColor.g)}${toHexComponent(rgbColor.b)}`;
}

function mergeColorWithAlpha(baseColor, alphaPercent) {
    const parsedBase = parseColorValue(baseColor);
    if (!parsedBase) {
        return null;
    }
    const alphaByte = Math.round((clampAlphaPercent(alphaPercent) / 100) * 255);
    const baseHex = formatHexColor(parsedBase);
    if (!baseHex) {
        return null;
    }
    return alphaByte >= 255 ? baseHex : `${baseHex}${toHexComponent(alphaByte)}`;
}

function getAlphaSliderForInput(inputEle) {
    if (!inputEle?.id) {
        return null;
    }
    return document.querySelector(`input[type='range'][data-alpha-target='${inputEle.id}']`);
}

function getLinkedPaletteElement(inputEle) {
    if (!inputEle?.dataset?.palette) {
        return null;
    }
    return document.getElementById(inputEle.dataset.palette);
}

function resolveBaseColor(inputEle, paletteEle) {
    const parsed = parseColorValue(inputEle?.value);
    if (parsed) {
        return formatHexColor(parsed);
    }
    if (paletteEle && paletteEle.value) {
        return paletteEle.value;
    }
    return '#000000';
}

function syncColorHelpers(inputEle, parsedColor = null) {
    if (!inputEle) {
        return;
    }
    const paletteEle = getLinkedPaletteElement(inputEle);
    const sliderEle = getAlphaSliderForInput(inputEle);
    const colorInfo = parsedColor || parseColorValue(inputEle.value);
    if (paletteEle && colorInfo) {
        paletteEle.value = formatHexColor(colorInfo);
    }
    if (sliderEle && colorInfo) {
        const alphaPercent = clampAlphaPercent(Math.round(colorInfo.a * 100));
        sliderEle.value = alphaPercent;
        sliderEle.dataset.rangePrevValue = alphaPercent;
        updateRangeDisplay(sliderEle);
    }
}

function handleColorAndPalette(ele) {
    if (ele.dataset.alphaTarget) {
        const targetInput = document.getElementById(ele.dataset.alphaTarget);
        if (targetInput) {
            const paletteEle = getLinkedPaletteElement(targetInput);
            const mergedColor = mergeColorWithAlpha(resolveBaseColor(targetInput, paletteEle), ele.value);
            if (mergedColor) {
                targetInput.value = mergedColor;
            }
            syncColorHelpers(targetInput);
            updateSettings(targetInput, true);
            return true;
        }
    }
    if (ele.dataset.color) {
        const colorEle = document.getElementById(ele.dataset.color);
        if (colorEle) {
            const sliderEle = getAlphaSliderForInput(colorEle);
            const alphaValue = sliderEle ? sliderEle.value : 100;
            const mergedColor = mergeColorWithAlpha(ele.value, alphaValue);
            colorEle.value = mergedColor || ele.value;
            syncColorHelpers(colorEle);
            updateSettings(colorEle, true);
            return true;
        }
    } else if (ele.dataset.palette) {
        syncColorHelpers(ele);
        return true;
    }
    
    return false;
}

const CUSTOM_GIF_COMMAND_LIMIT = 20;

function getCustomGifCommandEntryId(command, url, id) {
    if (id) return String(id);
    const source = String(command || '') + '|' + String(url || '');
    if (source === '|') {
        return 'gif_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    }
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
        hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    }
    return 'gif_' + Math.abs(hash);
}

function getCustomGifCommandAliases(command) {
    return String(command || '').split(',').map(alias => alias.trim()).filter(Boolean);
}

function getCustomGifCommandSourceUrl(entry) {
    const sourceDiv = document.getElementById('custom-gif-commands');
    let url = sourceDiv && sourceDiv.raw ? sourceDiv.raw : '';
    if (!url) {
        alert('Main GIF overlay link is not ready yet.');
        return '';
    }

    const commandInput = entry?.querySelector('.custom-command');
    const mediaUrlInput = entry?.querySelector('.custom-media-url');
    const command = commandInput?.value?.trim() || '';
    const id = getCustomGifCommandEntryId(command, mediaUrlInput?.value?.trim() || '', entry?.dataset.commandId);
    if (entry) entry.dataset.commandId = id;

    url = removeQueryParamWithValue(url, 'gifid');
    url = removeQueryParamWithValue(url, 'gifcommand');
    url = updateURL('gifid=' + encodeURIComponent(id), url);
    const aliases = getCustomGifCommandAliases(command);
    if (aliases.length) {
        url = updateURL('gifcommand=' + encodeURIComponent(aliases.join(',')), url);
    }
    return cleanURL(url);
}

function copyCustomGifCommandSource(entry, button) {
    const command = entry?.querySelector('.custom-command')?.value?.trim() || '';
    if (!command) {
        alert('Add a chat command first.');
        entry?.querySelector('.custom-command')?.focus();
        return;
    }

    const url = getCustomGifCommandSourceUrl(entry);
    if (!url) return;

    navigator.clipboard.writeText(url).then(function() {
        button?.classList.add('flashing');
        setTimeout(() => button?.classList.remove('flashing'), 500);
    }, function(err) {
        console.error('Could not copy text: ', err);
    });
}

function handleCustomGifCommand(ele, sync) {
    if (!ele.closest('.custom-gif-command-entry')) return false;
    
    const commands = Array.from(document.querySelectorAll('.custom-gif-command-entry')).map(entry => {
        const command = entry.querySelector('.custom-command')?.value?.trim() || '';
        const url = entry.querySelector('.custom-media-url')?.value?.trim() || '';
        const id = getCustomGifCommandEntryId(command, url, entry.dataset.commandId);
        entry.dataset.commandId = id;
        return { id, command, url };
    });
    
    if (sync) {
        chrome.runtime.sendMessage({
            cmd: "saveSetting", 
            type: "json", 
            setting: "customGifCommands", 
            value: JSON.stringify(commands)
        }, function (response) {});
    }
    
    return true;
}

function handlePollSettings(ele, sync) {
    if (!ele.closest('.options_group.poll') || !sync || !PollManager.currentPollId) return false;
    
    PollManager.savePollsToStorage();
    return true;
}

function updateSettings(ele, sync = true, value = null) {
    if (ele.target) {
        ele = this;
    }
	
    
    const target = ele.dataset.target || null;
	
    // Handle custom gif commands
    if (handleCustomGifCommand(ele, sync)) return;
	
    // Handle poll settings
    if (handlePollSettings(ele, sync)) return;
	
    // Handle delete parameters
    if (handleDelParam(ele, sync)) {
        // Continue with other settings
    }
    
    // Get all targets with their indices
    const targetMap = getTargetMap();
    
    // Auto-generate parameter targets from the map
    const paramTargets = Object.entries(targetMap).map(([targetName, index]) => ({
        type: `param${index}`,
        target: targetName
    }));
    
    // Try all regular parameter handlers
    for (const { type, target } of paramTargets) {
        if (handleElementParam(ele, target, type, sync, value)) {
            refreshLinks();
            return;
        }
    }
    
    // Auto-generate text parameter targets for all targets
    // This ensures we support all potential text params, even if they're not currently used
    const textParamTargets = Object.entries(targetMap).map(([targetName, index]) => ({
        type: `textparam${index}`,
        target: targetName
    }));
    
    for (const { type, target } of textParamTargets) {
        if (handleTextParam(ele, target, type, sync)) {
            refreshLinks();
            return;
        }
    }
    
    // Auto-generate option parameter targets for all targets
    // This ensures we support all potential options, even if they're not currently used
    const optionParamTargets = Object.entries(targetMap).map(([targetName, index]) => ({
        type: `optionparam${index}`,
        target: targetName
    }));
    
    for (const { type, target } of optionParamTargets) {
        if (handleOptionParam(ele, target, type, sync)) {
            refreshLinks();
            //return;
        }
    }
    
    // Handle "both" parameters (apply to all targets)
    if (handleBothParam(ele, sync)) {
        refreshLinks();
        return;
    }
    
    // Handle setting toggle
    if (handleSetting(ele, sync)) {
        return;
    }
    
    // Handle option settings (for UI controls)
    if (handleOptionSetting(ele, sync)) {
        return;
    }
    
    // Handle text settings
    if (ele.dataset.textsetting && sync) {
        chrome.runtime.sendMessage({
            cmd: "saveSetting",
            type: "textsetting",
            target: target,
            setting: ele.dataset.textsetting,
            value: ele.value
        }, function (response) {});
        if (/^aiOverlay/.test(ele.dataset.textsetting)) {
            updateAiOverlayLinksFromCurrentState();
        }
        return;
    }
    
    // Handle number settings
    if (handleNumberSetting(ele, sync)) {
        if (ele.dataset.numbersetting === "aiOverlayScale") {
            updateAiOverlayLinksFromCurrentState();
        }
        refreshLinks();
        return;
    }
    
    // Handle special settings
    if (handleSpecialSettings(ele, sync)) {
        return;
    }
    
    // Handle color and palette settings
    if (handleColorAndPalette(ele)) {
        return;
    }
    
    refreshLinks();
}

function validateRoomId(roomId) {
	if (roomId == null || roomId === '') {
		return false;
	}
	let sanitizedId = String(roomId).trim();

	if (sanitizedId.length < 1) {
		return false;
	}
	const reservedValues = [
		'undefined',
		'null',
		'false',
		'true',
		'NaN',
		'default',
		'room',
		'lobby',
		'test',
		'nothing',
		'0',
		'1',
		'none'
	];
	if (reservedValues.includes(sanitizedId.toLowerCase())) {
		return false;
	}
	sanitizedId = sanitizedId.replace(/[^a-zA-Z0-9]/g, '_');
	if (/^_+$/.test(sanitizedId)) {
		return false;
	}
	if (sanitizedId.length < 2) {
		return false;
	}
	const MAX_LENGTH = 80;
	if (sanitizedId.length > MAX_LENGTH) {
		return false;
	}
	// throw new Error('Invalid room ID');
	return sanitizedId;
}

let overlayPreviewSequence = 0;

const overlayPreviewConfigs = Object.freeze({
    multialerts: {
        frameId: 'multi-alerts-preview-frame',
        divId: 'multialerts',
        localPath: 'multi-alerts.html',
        previewUrlSource: 'local',
        messageKey: 'multiAlertsPreview'
    }
});

const overlayPreviewState = {
    multialerts: { pending: null, timer: null, muted: false }
};

function getLocalOverlayUrl(path) {
    try {
        if (chrome?.runtime?.getURL) {
            return chrome.runtime.getURL(path);
        }
    } catch (error) {
        console.warn('Unable to build local overlay URL via chrome.runtime.getURL', error);
    }
    try {
        return new URL(path, window.location.href).toString();
    } catch (error) {
        console.warn('Unable to build local overlay URL via URL()', error);
        return path;
    }
}

function nextOverlayPreviewId(prefix) {
    overlayPreviewSequence += 1;
    return `${prefix}_${Date.now()}_${overlayPreviewSequence}`;
}

function createPreviewAvatarDataUri(label, bgColor, textColor = '#ffffff') {
    const source = String(label || 'SS');
    const initials = source
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'SS';
    const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">',
        `<rect width="128" height="128" rx="64" fill="${bgColor}"/>`,
        `<text x="64" y="76" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="${textColor}">${initials}</text>`,
        '</svg>'
    ].join('');
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createPreviewMediaDataUri(label, bgColor) {
    const safeLabel = String(label || 'Preview').slice(0, 18);
    const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">',
        '<defs>',
        `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`,
        `<stop offset="0%" stop-color="${bgColor}" stop-opacity="0.95"/>`,
        '<stop offset="100%" stop-color="#05070d" stop-opacity="1"/>',
        '</linearGradient>',
        '</defs>',
        '<rect width="320" height="180" rx="22" fill="url(#bg)"/>',
        '<circle cx="58" cy="46" r="18" fill="rgba(255,255,255,0.18)"/>',
        '<circle cx="112" cy="124" r="26" fill="rgba(255,255,255,0.12)"/>',
        '<path d="M240 42l34 18v30l-34 18-34-18V60z" fill="rgba(255,255,255,0.18)"/>',
        '<rect x="28" y="122" width="126" height="14" rx="7" fill="rgba(255,255,255,0.18)"/>',
        '<rect x="28" y="144" width="176" height="10" rx="5" fill="rgba(255,255,255,0.12)"/>',
        `<text x="214" y="138" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff">${safeLabel}</text>`,
        '</svg>'
    ].join('');
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildChatOverlayPreviewPayload(kind, overrides = {}) {
    const presetMap = {
        chat: {
            type: 'youtube',
            platform: 'youtube',
            chatname: 'SapheusOwO',
            chatmessage: 'This is how your overlay styling reads during a live chat moment.',
            subtitle: 'First time chatter',
            accent: '#ff4e45'
        },
        donation: {
            type: 'twitch',
            platform: 'twitch',
            chatname: 'campa',
            chatmessage: 'Keep up the great work!',
            hasDonation: '$10.00',
            subtitle: 'Sent from Twitch',
            accent: '#14b8a6'
        },
        member: {
            type: 'youtube',
            platform: 'youtube',
            chatname: 'steve',
            chatmessage: 'Happy to be here for another stream.',
            membership: 'New Member',
            subtitle: 'Tier 1 membership',
            accent: '#8b5cf6'
        },
        image: {
            type: 'kick',
            platform: 'kick',
            chatname: 'pixelbot',
            chatmessage: 'Media attachments and GIF-style content will appear like this.',
            contentimg: createPreviewMediaDataUri('HYPE', '#38bdf8'),
            subtitle: 'Shared a media reaction',
            accent: '#38bdf8'
        }
    };

    const preset = presetMap[kind] || presetMap.chat;
    const accent = overrides.accent || preset.accent;
    return {
        id: overrides.id || nextOverlayPreviewId(kind),
        timestamp: Date.now(),
        chatimg: overrides.chatimg || createPreviewAvatarDataUri(overrides.chatname || preset.chatname, accent),
        ...preset,
        ...overrides
    };
}

function buildOverlayPreviewPayload(previewKey, descriptor) {
    if (descriptor === false) {
        return false;
    }

    if (previewKey === 'multialerts') {
        return descriptor;
    }

    const normalizedDescriptor =
        typeof descriptor === 'string'
            ? { kind: descriptor }
            : descriptor || { kind: 'chat' };

    return buildChatOverlayPreviewPayload(
        normalizedDescriptor.kind || normalizedDescriptor.type || 'chat',
        normalizedDescriptor.overrides || {}
    );
}

function buildOverlayPreviewUrl(previewKey) {
    const config = overlayPreviewConfigs[previewKey];
    if (!config) {
        return '';
    }

    const sourceDiv = document.getElementById(config.divId);
    const rawUrl = typeof sourceDiv?.raw === 'string' ? sourceDiv.raw : '';
    let rawPreviewUrl = null;
    let rawParams = new URLSearchParams();

    if (rawUrl) {
        try {
            rawPreviewUrl = new URL(rawUrl, window.location.href);
            rawParams = new URLSearchParams(rawPreviewUrl.search);
        } catch (error) {
            console.warn('Unable to parse overlay preview raw URL', rawUrl, error);
        }
    }

    let previewUrl = null;
    if (config.previewUrlSource === 'raw' && rawPreviewUrl) {
        previewUrl = new URL(rawPreviewUrl.toString());
    } else {
        previewUrl = new URL(getLocalOverlayUrl(config.localPath));
    }

    rawParams.set('preview', '1');
    rawParams.set('embedded', '1');
    if (!rawParams.get('session')) {
        rawParams.set('session', 'preview');
    }

    previewUrl.hash = '';
    previewUrl.search = rawParams.toString();
    return previewUrl.toString();
}

function syncOverlayPreview(previewKey) {
    const config = overlayPreviewConfigs[previewKey];
    if (!config) {
        return;
    }

    const frame = document.getElementById(config.frameId);
    if (!frame) {
        return;
    }

    const nextUrl = buildOverlayPreviewUrl(previewKey);
    if (frame.dataset.currentPreviewUrl === nextUrl) {
        replayOverlayPreview(previewKey, { silent: true });
        return;
    }

    frame.dataset.currentPreviewUrl = nextUrl;
    frame.src = nextUrl;
}

function replayOverlayPreview(previewKey, options = {}) {
    const config = overlayPreviewConfigs[previewKey];
    const state = overlayPreviewState[previewKey];
    if (!config || !state) {
        return;
    }

    const frame = document.getElementById(config.frameId);
    if (!frame || !frame.contentWindow || state.pending === null) {
        return;
    }

    if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
    }

    const payload = buildOverlayPreviewPayload(previewKey, state.pending);
    frame.contentWindow.postMessage({ [config.messageKey]: false }, '*');
    state.timer = setTimeout(() => {
        if (frame.contentWindow) {
            const messagePayload =
                payload === false
                    ? false
                    : {
                        __multiAlertsPreviewEnvelope: true,
                        payload,
                        silent: Boolean(options.silent) || Boolean(state.muted)
                    };
            frame.contentWindow.postMessage({ [config.messageKey]: messagePayload }, '*');
        }
        state.timer = null;
    }, 40);
}

function sendOverlayPreview(previewKey, descriptor) {
    const config = overlayPreviewConfigs[previewKey];
    const state = overlayPreviewState[previewKey];
    if (!config || !state) {
        return;
    }

    const frame = document.getElementById(config.frameId);
    if (!frame) {
        return;
    }

    state.pending = descriptor;
    if (descriptor === false) {
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        if (frame.contentWindow) {
            frame.contentWindow.postMessage({ [config.messageKey]: false }, '*');
        }
        return;
    }

    replayOverlayPreview(previewKey, { silent: false });
}

function syncMultiAlertsPreview() {
    syncOverlayPreview('multialerts');
}

function replayMultiAlertsPreview() {
    replayOverlayPreview('multialerts');
}

function sendMultiAlertsPreview(payload) {
    sendOverlayPreview('multialerts', payload);
}

const MULTI_ALERT_PREVIEW_PLATFORMS = Object.freeze({
    tiktok: {
        type: 'tiktok',
        platform: 'tiktok',
        accent: '#fe2c55',
        avatarLabel: 'RW',
        chatname: 'Riftwalker',
        subscriptionLabel: 'Creator Subscriber',
        subscriptionSubtitle: 'Subscriber badge unlocked',
        donationAmount: '100 Diamonds',
        donationValue: 0.5,
        donationMessage: 'Sent Rose x100',
        donationMediaLabel: 'ROSE',
        bitsAmount: '350 Diamonds',
        bitsMessage: 'Diamond shower incoming!',
        raidMessage: 'Dropped in with 42 viewers!'
    },
    twitch: {
        type: 'twitch',
        platform: 'twitch',
        accent: '#9146ff',
        avatarLabel: 'TW',
        chatname: 'CaptainSquawk',
        subscriptionLabel: 'Tier 1',
        subscriptionSubtitle: 'Tier 1 subscription',
        donationAmount: '$10.00',
        donationValue: 10,
        donationMessage: 'Keep up the great work!',
        donationMediaLabel: 'HYPE',
        bitsAmount: '500 bits',
        bitsMessage: 'Cheer train incoming!',
        raidMessage: 'Raiding with 42 viewers!'
    },
    youtube: {
        type: 'youtube',
        platform: 'youtube',
        accent: '#ff3b30',
        avatarLabel: 'YT',
        chatname: 'StudioPixel',
        subscriptionLabel: 'New Member',
        subscriptionSubtitle: 'Channel membership joined',
        donationAmount: '$10.00',
        donationValue: 10,
        donationMessage: 'Sent a Super Chat to support the stream!',
        donationMediaLabel: 'LIVE',
        bitsAmount: '500 cheers',
        bitsMessage: 'The live chat is popping off!',
        raidMessage: 'Sending 42 viewers over from live chat!'
    },
    kick: {
        type: 'kick',
        platform: 'kick',
        accent: '#53fc18',
        avatarLabel: 'KK',
        chatname: 'GreenRoom',
        subscriptionLabel: 'Kick Subscriber',
        subscriptionSubtitle: 'Channel support renewed',
        donationAmount: '$10.00',
        donationValue: 10,
        donationMessage: 'Tipped to keep the stream rolling!',
        donationMediaLabel: 'TIP',
        bitsAmount: '500 hype',
        bitsMessage: 'Hype meter kicked up a notch!',
        raidMessage: 'Rolling in with 42 viewers!'
    }
});

function getMultiAlertPreviewPlatformKey() {
    return document.getElementById('multi-alert-preview-platform')?.value || 'tiktok';
}

function buildMultiAlertPreviewDescriptor(category) {
    const platformKey = getMultiAlertPreviewPlatformKey();
    const profile = MULTI_ALERT_PREVIEW_PLATFORMS[platformKey] || MULTI_ALERT_PREVIEW_PLATFORMS.tiktok;
    const commonOverrides = {
        type: profile.type,
        platform: profile.platform,
        chatname: profile.chatname,
        chatimg: createPreviewAvatarDataUri(profile.avatarLabel, profile.accent)
    };

    switch (category) {
        case 'follow':
            return {
                category,
                overrides: {
                    ...commonOverrides,
                    event: 'new_follower',
                    chatmessage: `${profile.chatname} has started following`
                }
            };
        case 'subscription':
            return {
                category,
                overrides: {
                    ...commonOverrides,
                    event: 'new_subscriber',
                    membership: profile.subscriptionLabel,
                    subtitle: profile.subscriptionSubtitle,
                    chatmessage: 'Welcome to the squad!'
                }
            };
        case 'donation':
            return {
                category,
                overrides: {
                    ...commonOverrides,
                    event: platformKey === 'tiktok' ? 'gift' : 'donation',
                    hasDonation: profile.donationAmount,
                    donoValue: profile.donationValue,
                    chatmessage: profile.donationMessage,
                    contentimg: createPreviewMediaDataUri(profile.donationMediaLabel, profile.accent),
                    title: platformKey === 'tiktok' ? 'Rose' : ''
                }
            };
        case 'bits':
            return {
                category,
                overrides: {
                    ...commonOverrides,
                    event: 'cheer',
                    hasDonation: profile.bitsAmount,
                    chatmessage: profile.bitsMessage,
                    contentimg: createPreviewMediaDataUri('500', profile.accent),
                    meta: { bits: 500 }
                }
            };
        case 'raid':
            return {
                category,
                overrides: {
                    ...commonOverrides,
                    event: 'raid',
                    chatmessage: profile.raidMessage,
                    contentimg: createPreviewMediaDataUri('RAID', profile.accent),
                    meta: { viewers: 42 }
                }
            };
        case 'auction':
            // Auction wins come from live-shopping platforms; the overlay mock fills in the meta snapshot.
            return {
                category,
                overrides: {
                    type: 'whatnot',
                    platform: 'whatnot',
                    chatname: profile.chatname
                }
            };
        case 'hype':
            return {
                category,
                overrides: {
                    type: 'twitch',
                    platform: 'twitch'
                }
            };
        default:
            return null;
    }
}

function buildTestAlertPayload(category, overrides = {}) {
    const payloads = {
        follow: {
            type: 'twitch',
            event: 'new_follower',
            chatname: 'Jess',
            chatimg: 'https://socialstream.ninja/media/user1.jpg',
            chatmessage: 'Jess has started following'
        },
        subscription: {
            type: 'twitch',
            event: 'new_subscriber',
            chatname: 'Markus',
            chatimg: 'https://socialstream.ninja/media/user2.jpg',
            chatmessage: 'Welcome to the squad!',
            membership: 'Tier 1',
            subtitle: 'Tier 1 subscription'
        },
        donation: {
            type: 'twitch',
            event: 'donation',
            chatname: 'Priya',
            chatimg: 'https://socialstream.ninja/media/user3.jpg',
            chatmessage: 'Keep up the great work!',
            hasDonation: '$10.00'
        },
        bits: {
            type: 'twitch',
            event: 'cheer',
            chatname: 'Ava',
            chatimg: 'https://socialstream.ninja/media/user4.png',
            chatmessage: 'Cheer train incoming!',
            hasDonation: '500 bits',
            meta: { bits: 500 }
        },
        raid: {
            type: 'twitch',
            event: 'raid',
            chatname: 'CaptainSquawk',
            chatimg: 'https://socialstream.ninja/media/user5.jpg',
            chatmessage: 'Raiding with 42 viewers!',
            meta: { viewers: 42 }
        }
    };
    const payload = payloads[category];
    if (!payload) {
        return null;
    }

    return {
        ...payload,
        ...overrides,
        meta: {
            ...(payload.meta || {}),
            ...(overrides.meta || {})
        }
    };
}

function buildTipJarTestDonationPayload(kind) {
    const payloads = {
        'facebook-stars': {
            type: 'facebook',
            platform: 'facebook',
            chatname: 'Star Supporter',
            chatmessage: 'Testing Facebook Stars',
            hasDonation: '500 Stars',
            donoValue: 5,
            chatimg: createPreviewAvatarDataUri('FB', '#1877f2')
        },
        'youtube-superchat': {
            type: 'youtube',
            platform: 'youtube',
            event: 'donation',
            chatname: 'SuperChat Fan',
            chatmessage: 'Testing a Super Chat donation',
            hasDonation: '$10.00',
            donoValue: 10,
            chatimg: createPreviewAvatarDataUri('YT', '#ff0033')
        },
        'twitch-bits': {
            type: 'twitch',
            platform: 'twitch',
            event: 'cheer',
            chatname: 'Bits Tester',
            chatmessage: 'Testing Twitch bits',
            hasDonation: '500 bits',
            donoValue: 5,
            chatimg: createPreviewAvatarDataUri('TW', '#9146ff'),
            meta: { bits: 500 }
        },
        'tiktok-hearts': {
            type: 'tiktok',
            platform: 'tiktok',
            event: 'gift',
            chatname: 'Heart Sender',
            chatmessage: 'Testing TikTok hearts',
            hasDonation: '100 hearts',
            donoValue: 1,
            chatimg: createPreviewAvatarDataUri('TT', '#fe2c55'),
            meta: { giftName: 'Hearts', giftCount: 100 }
        }
    };

    const payload = payloads[kind];
    if (!payload) {
        return null;
    }

    return {
        ...payload,
        id: nextOverlayPreviewId('tipjar_test'),
        timestamp: Date.now()
    };
}

function attachTipJarTestDonationButtons() {
    document.querySelectorAll('[data-tipjar-test]').forEach(function(button) {
        button.addEventListener('click', function() {
            const payload = buildTipJarTestDonationPayload(button.getAttribute('data-tipjar-test'));
            if (!payload) {
                return;
            }
            chrome.runtime.sendMessage({ cmd: 'testAlert', payload }, function() {
                log('ignore callback for this action');
            });
        });
    });
}

function attachOverlayPreviewControls(previewKey, buttonConfigs = []) {
    const config = overlayPreviewConfigs[previewKey];
    if (!config) {
        return;
    }

    const frame = document.getElementById(config.frameId);
    if (frame) {
        frame.addEventListener('load', () => {
            replayOverlayPreview(previewKey, { silent: true });
        });
    }

    buttonConfigs.forEach(({ id, descriptor }) => {
        const button = document.getElementById(id);
        if (!button) {
            return;
        }
        button.addEventListener('click', () => {
            const resolvedDescriptor =
                typeof descriptor === 'function'
                    ? descriptor()
                    : descriptor;

            sendOverlayPreview(previewKey, resolvedDescriptor);
            if (previewKey === 'multialerts') {
                if (resolvedDescriptor && resolvedDescriptor.category) {
                    const payload = buildTestAlertPayload(resolvedDescriptor.category, resolvedDescriptor.overrides || {});
                    if (payload) {
                        chrome.runtime.sendMessage({ cmd: 'testAlert', payload });
                    }
                } else if (resolvedDescriptor === false) {
                    chrome.runtime.sendMessage({ cmd: 'clearAlerts' });
                }
            }
        });
    });
}

function syncAllOverlayPreviews() {
    syncOverlayPreview('multialerts');
}

var popupLinkRefreshBatchDepth = 0;
var popupLinkRefreshPending = false;

function beginPopupLinkRefreshBatch() {
	popupLinkRefreshBatchDepth++;
}

function endPopupLinkRefreshBatch() {
	if (popupLinkRefreshBatchDepth > 0) {
		popupLinkRefreshBatchDepth--;
	}
	if (popupLinkRefreshBatchDepth === 0 && popupLinkRefreshPending) {
		popupLinkRefreshPending = false;
		refreshLinks();
	}
}

function refreshLinks(){
  if (popupLinkRefreshBatchDepth > 0) {
    popupLinkRefreshPending = true;
    return;
  }

  let hideLinks = false;
  document.querySelectorAll("input[data-setting='hideyourlinks']").forEach(x=>{
    if (x.checked){
      hideLinks = true;
    }
  });
  
  if (hideLinks){
    document.body.classList.add("hidelinks");
  } else {
    document.body.classList.remove("hidelinks");
  }
  syncChatOverlayTemplateLinkFromDock();
  try {
    const linkIdToDivIdMap = {
      'docklink': 'dock',
      'chatoverlaytemplatelink': 'chatoverlaytemplate',
      'overlaylink': 'overlay',
      'multialertslink': 'multialerts',
      'emoteswalllink': 'emoteswall',
      'hypemeterlink': 'hypemeter',
      'hypetrainlink': 'hypetrain',
      'metalink': 'meta',
      'waitlistlink': 'waitlist',
      'tipjarlink': 'tipjar',
	  'leaderboardlink': 'leaderboard',
	  'gameslink': 'games',
      'tickerlink': 'ticker',
      'wordcloudlink': 'wordcloud',
      'polllink': 'poll',
      'flowactionslink': 'flowactions',
      'chatbotlink': 'chatbot',
      'cohostlink': 'cohost',
      'aioverlaylink': 'aioverlay',
      'giveawaylink': 'giveaway',
      'creditslink': 'credits',
      'privatechatbotlink': 'privatechatbot',
      'aipromptlink': 'aiprompt',
      'eventsdashboardlink': 'eventsdashboard',
      'reactionslink': 'reactions',
      'custom-gif-commandslink': 'custom-gif-commands',
	  'scoreboardlink': 'scoreboard',
	  'spotifylink': 'spotify',
	  'maplink': 'map',
	  'timerlink': 'timer'
    };
    const linkIdsToClean = Object.keys(linkIdToDivIdMap);

    const currentHideLinks = document.body.classList.contains("hidelinks");

    linkIdsToClean.forEach(linkId => {
      const linkElement = document.getElementById(linkId);
      const divId = linkIdToDivIdMap[linkId];
      const divElement = document.getElementById(divId);

      if (linkElement && divElement && typeof divElement.raw === 'string' && (divElement.raw.startsWith('http') || divElement.raw.startsWith('file://'))) {
        const urlToClean = divElement.raw; // Use .raw as the source of truth
        const cleanedUrl = removeTTSProviderParams(urlToClean);

        divElement.raw = cleanedUrl; // Update the .raw property
        linkElement.href = cleanedUrl; // Update the link's href

        // Update link's text based on hideLinks status
        linkElement.innerText = currentHideLinks ? "Click to open link" : cleanedUrl;
      }
    });

    const remoteCtrlUrlElement = document.getElementById("remote_control_url");
    if (remoteCtrlUrlElement && remoteCtrlUrlElement.href) {
      remoteCtrlUrlElement.href = removeTTSProviderParams(remoteCtrlUrlElement.href);
    }
  } catch (e) {
    console.error("Error cleaning TTS params from links:", e);
  }

  syncAllOverlayPreviews();
}

function flushDeferredCustomCssSettings() {
	const cssTextareas = document.querySelectorAll("textarea[data-textparam1='cssb64'], textarea[data-textparam2='cssb64']");
	for (var i = 0; i < cssTextareas.length; i++) {
		const ele = cssTextareas[i];
		if (ele.dataset.pendingSave !== "1") {
			continue;
		}
		const paramType = ele.dataset.textparam1 ? "textparam1" : (ele.dataset.textparam2 ? "textparam2" : null);
		const setting = paramType ? ele.dataset[paramType] : null;
		if (!paramType || !setting) {
			continue;
		}
		try {
			chrome.runtime.sendMessage({
				cmd: "saveSetting",
				type: paramType,
				target: ele.dataset.target || null,
				setting: setting,
				value: ele.value || ""
			});
			ele.dataset.lastCommittedValue = ele.value || "";
			delete ele.dataset.pendingSave;
		} catch (e) {
			console.warn("Failed to flush deferred custom CSS setting", e);
		}
	}
}

function setupDeferredCustomCssFlush() {
	const cssTextareas = document.querySelectorAll("textarea[data-textparam1='cssb64'], textarea[data-textparam2='cssb64']");
	for (var i = 0; i < cssTextareas.length; i++) {
		const ele = cssTextareas[i];
		ele.addEventListener("input", function () {
			this.dataset.pendingSave = "1";
		});
		ele.addEventListener("change", function () {
			this.dataset.lastCommittedValue = this.value || "";
			delete this.dataset.pendingSave;
		});
	}

	window.addEventListener("pagehide", flushDeferredCustomCssSettings);
	window.addEventListener("beforeunload", flushDeferredCustomCssSettings);
	document.addEventListener("visibilitychange", function () {
		if (document.hidden) {
			flushDeferredCustomCssSettings();
		}
	});
}

function handleRangeInput(event) {
    const rangeEle = event?.target || this;
    if (!rangeEle) {
        return;
    }

    updateRangeDisplay(rangeEle);

    const currentValue = rangeEle.value;
    const lastValue = rangeEle.dataset.rangePrevValue;
    const shouldSync = !event || event.type !== 'change' || lastValue !== currentValue;

    if (shouldSync) {
        updateSettings.call(rangeEle, event);
    }

    rangeEle.dataset.rangePrevValue = currentValue;
}

if (!chrome.browserAction){
	chrome.browserAction = {};
	
	if (chrome.action && chrome.action.setIcon){
		chrome.browserAction.setIcon = chrome.action.setIcon
	} else {
		chrome.browserAction.setIcon = function (icon) {};
	}
	
	function sendMessageToBackground(message, timeout = 15000) {
	  return sendPopupBackgroundCommand(message, timeout);
	}

		sendMessageToBackground({cmd: "getSettings"}, 20000).then(response => {
			log("Received response:", response);
			hydratePopupFromStartupSettings(response);
		  })
		  .catch(error => {
			console.error("Error:", error);
		  });
	  
}


function updateDocumentList(documents = []) {
    const fileList = document.getElementById('ragFileList');
    fileList.innerHTML = '';

    documents.forEach(doc => {
        const docElement = document.createElement('div');
        docElement.innerHTML = `
            <span>${doc.title}</span>
            <span>${doc.status}</span>
            ${doc.progress !== undefined ? `<progress value="${doc.progress}" max="100"></progress>` : ''}
            ${doc.status !== 'Deleting' && doc.status !== 'Uploading' ? 
                `<button data-action="deleteDocument" data-id="${doc.id}" ${doc.status === 'Deleting' ? 'disabled' : ''}>Delete</button>` : 
                ''
            }
        `;
        fileList.appendChild(docElement);
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('[data-action="deleteDocument"]').forEach(button => {
        button.addEventListener('click', function() {
            const docId = this.getAttribute('data-id');
            chrome.runtime.sendMessage({cmd: "deleteRAGfile", docId: docId});
        });
    });
}

try {
	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			log("INCOMING MESSAGE--------------------------");
		if (request.forPopup) {
			log("Message received in popup:", request.forPopup);
			if (request.forPopup.documents){
				updateDocumentList(request.forPopup.documents);
			}

			if (request.forPopup.handleStatus) {
				mergeHandleStatusFromBackground(request.forPopup.handleStatus);
			}

			if (request.forPopup.spotifyAuthResult) {
				handleSpotifyAuthResultFromBackground(request.forPopup.spotifyAuthResult);
			}

			if (request.forPopup.settingsImported) {
				sendResponse({status: "Reloading popup after settings import"});
				setTimeout(function() {
					window.location.reload();
				}, 0);
				return;
			}
			
			if (request.forPopup.alert){
				alert(request.forPopup.alert);
			}
				// Handle the message data here
				sendResponse({status: "Message received in popup"});
			}
		}
	);
} catch(e){
	log(e);
}

function applyHostedMediaUploadResult(inputElement, uploadData, onUploaded) {
    const uploadedUrl = typeof uploadData === 'string' ? uploadData : uploadData && uploadData.url;
    if (!inputElement || !uploadedUrl) {
        return false;
    }

    inputElement.value = uploadedUrl;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof onUploaded === 'function') {
        onUploaded(uploadedUrl, uploadData);
    }
    return true;
}

async function openHostedMediaUploadForInput(inputElement, popupName = 'uploadMedia', onUploaded) {
    if (!inputElement) {
        return;
    }

    if (window.ninjafy && typeof window.ninjafy.startMediaUpload === 'function') {
        try {
            const result = await window.ninjafy.startMediaUpload({ popupName });
            if (result && result.success && result.url) {
                applyHostedMediaUploadResult(inputElement, result, onUploaded);
            }
        } catch (error) {
            console.warn('Hosted media upload failed:', error && error.message ? error.message : error);
        }
        return;
    }

    window.open('https://fileuploads.socialstream.ninja/popup/upload', popupName, 'width=640,height=640');

    const handler = (event) => {
        if (event.origin !== 'https://fileuploads.socialstream.ninja') return;
        if (!event.data || event.data.type !== 'media-uploaded' || !event.data.url) return;

        applyHostedMediaUploadResult(inputElement, event.data, onUploaded);
        window.removeEventListener('message', handler);
    };

    window.addEventListener('message', handler);
}

function triggerCustomGifPreview(entry) {
    const commandInput = entry?.querySelector('.custom-command');
    const mediaUrlInput = entry?.querySelector('.custom-media-url');
    const command = commandInput?.value?.trim() || '!preview';
    const mediaUrl = mediaUrlInput?.value?.trim();
    const id = getCustomGifCommandEntryId(command, mediaUrl, entry?.dataset.commandId);
    if (entry) entry.dataset.commandId = id;

    if (!mediaUrl) {
        alert('Add or upload a GIF, image, or video URL first.');
        mediaUrlInput?.focus();
        return;
    }

    const payload = {
        cmd: 'previewCustomGif',
        target: 'gif',
        type: 'popup',
        chatname: 'GIF Test',
        chatmessage: command,
        contentimg: mediaUrl,
        meta: {
            customGifCommandId: id,
            customGifCommand: getCustomGifCommandAliases(command)[0] || command,
            customGifCommands: getCustomGifCommandAliases(command)
        }
    };
    chrome.runtime.sendMessage(payload, function () {});
    chrome.runtime.sendMessage(Object.assign({}, payload, { target: id }), function () {});
}

function createCommandEntry(command = '', url = '', id = '') {
    function encodeHTML(str) {
        return String(str ?? '').replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }

    const entry = document.createElement('div');
    entry.className = 'custom-gif-command-entry';
    entry.dataset.commandId = getCustomGifCommandEntryId(command, url, id);
    entry.innerHTML = `
        <div class="textInputContainer" style="width: 90%;">
            <input type="text" class="textInput custom-command" value="${encodeHTML(command)}" autocomplete="off" placeholder="!command, !alias" data-textsetting="customGifCommand" />
            <label><span data-translate="chat-command">&gt; Chat Command(s)</span></label>
        </div>
        <div class="textInputContainer" style="width: 90%;">
            <input type="text" class="textInput custom-media-url" value="${encodeHTML(url)}" autocomplete="off" placeholder="https://media.giphy.com/media/..." data-textsetting="customGifUrl" />
            <label><span data-translate="media-url">&gt; Media URL (GIF, image, or video)</span></label>
        </div>
        <div class="custom-gif-command-actions">
            <button class="uploadCustomGifMedia" type="button" title="Upload your own GIF, image, or video file">
                <span>Upload</span>
            </button>
            <button class="testCustomGifCommand" type="button" title="Preview this media in the gif.html overlay">
                <span>Test</span>
            </button>
            <button class="copyCustomGifCommandSource" type="button" title="Copy a browser-source link for only this command">
                <span>Copy Source</span>
            </button>
            <button class="removeCustomGifCommand" type="button">
                <span data-translate="remove">Remove</span>
            </button>
        </div>
    `;
    
    entry.querySelector('.uploadCustomGifMedia').addEventListener('click', function() {
        openHostedMediaUploadForInput(entry.querySelector('.custom-media-url'), 'uploadCustomGifMedia');
    });

    entry.querySelector('.testCustomGifCommand').addEventListener('click', function() {
        triggerCustomGifPreview(entry);
    });

    entry.querySelector('.copyCustomGifCommandSource').addEventListener('click', function() {
        copyCustomGifCommandSource(entry, this);
    });

    entry.querySelector('.removeCustomGifCommand').addEventListener('click', function() {
        entry.remove();
        updateSettings(entry, true);
    });
    
    entry.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', function() {
            updateSettings(this, true);
        });
    });
    
    return entry;
}

//bad words upload code
/// Add these functions to handle file upload and deletion
function uploadBadwordsFile() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt';
  fileInput.onchange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size before reading (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('File is too large. Maximum size is 5MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const contents = e.target.result;
        // Limit content size
        const maxLength = 500000;
        const truncatedContents = contents.length > maxLength ? 
          contents.substring(0, maxLength) : contents;
          
        chrome.runtime.sendMessage({cmd: 'uploadBadwords', data: truncatedContents}, (response) => {
          if (response.success) {
				alert('Badwords file uploaded successfully.');
          } else if (response.streamID) {
			  // derp.
          } else {
			  alert('Failed to upload badwords file.');
		  }
        });
      };
      reader.readAsText(file);
    }
  };
  fileInput.click();
}

function deleteBadwordsFile() {
  if (confirm('Are you sure you want to delete the custom badwords file?')) {
    chrome.runtime.sendMessage({cmd: 'deleteBadwords'}, (response) => {
      if (response.success) {
        alert('Badwords file deleted successfully.');
	  } else if (response.streamID) {
	    // derp.
      } else {
        alert('Failed to delete badwords file.');
      }
    });
  }
}

const TTSManager = {  // this is for testing the audio I think; not for managing settings
    audio: null,
    speech: false,
    voice: null,
    voices: null,
    premiumQueueActive: false,
    currentTtsSection: "",
    feedbackTimeouts: {},
    kokoroCacheDownloads: {},
    cancelRequested: false,
    activeAudioElement: null,
    activeAudioUrl: null,
    
    init(voices) {
        this.voices = voices;
        if (!this.audio) {
            this.audio = document.createElement("audio");
            this.audio.onended = () => this.finishedAudio();
        }
        this.addTestButton("");
        this.addTestButton("2");
        this.addTestButton("10");
        this.addTestButton("18");
		
		const listElevenLabsVoicesBtn = document.getElementById("listElevenLabsVoicesBtn");
		if (listElevenLabsVoicesBtn && !listElevenLabsVoicesBtn.dataset.ttsListenerAttached){
			listElevenLabsVoicesBtn.dataset.ttsListenerAttached = "true";
			listElevenLabsVoicesBtn.addEventListener('click', async (e) => {
				this.listElevenLabsVoices();
			});
		}
        
        // Add styles if they don't exist
        if (!document.getElementById('ttsFeedbackStyles')) {
            const style = document.createElement('style');
            style.id = 'ttsFeedbackStyles';
            style.textContent = `
                .tts-test-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin: 10px 0;
                }
                .tts-feedback {
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 14px;
                    transition: opacity 0.3s ease;
                }
                .tts-feedback.hidden {
                    display: none;
                    opacity: 0;
                }
                .tts-feedback.info {
                    background: #fff3cd;
                    border: 1px solid #ffeeba;
                    color: #856404;
                }
                .tts-feedback.warning {
                    background: #fff3cd;
                    border: 1px solid #ffeeba;
                    color: #856404;
                }
                .tts-feedback.error {
                    background: #f8d7da;
                    border: 1px solid #f5c6cb;
                    color: #721c24;
                }
                .tts-feedback.success {
                    background: #d4edda;
                    border: 1px solid #c3e6cb;
                    color: #155724;
                }
                .tts-test-actions {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .tts-test-button[disabled],
                .tts-test-cancel-button[disabled] {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                .tts-test-cancel-button.hidden {
                    display: none;
                }
                .tts-kokoro-cache-controls {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 8px;
                    border: 1px solid rgba(0, 0, 0, 0.12);
                    border-radius: 4px;
                    background: rgba(0, 0, 0, 0.03);
                }
                .tts-kokoro-cache-controls.hidden {
                    display: none;
                }
                .tts-cache-actions {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .tts-cache-button,
                .tts-cache-cancel-button,
                .tts-cache-clear-button {
                    padding: 3px 8px 2px 6px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    color: white;
                    background-color: #5b667a;
                }
                .tts-cache-button {
                    background-color: #198754;
                }
                .tts-cache-cancel-button {
                    background-color: #dc3545;
                }
                .tts-cache-clear-button {
                    background-color: #6c757d;
                }
                .tts-cache-button[disabled],
                .tts-cache-cancel-button[disabled],
                .tts-cache-clear-button[disabled] {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                .tts-cache-cancel-button.hidden {
                    display: none;
                }
                .tts-cache-status {
                    font-size: 13px;
                    line-height: 1.35;
                    color: inherit;
                }
                .tts-cache-status.error {
                    color: #721c24;
                }
                .tts-cache-status.success {
                    color: #155724;
                }
            `;
            document.head.appendChild(style);
        }

        this.updateAllKokoroCacheControls();
    },
	
	getSectionKey(section) {
        return section ? String(section) : "1";
    },

    getFeedbackId(section) {
        return section ? `ttsFeedback${section}` : 'ttsFeedback';
    },

    getProviderSelect(section) {
        return document.getElementById(`ttsProvider${section || ""}`);
    },

    isOpenAICompatibleProvider(provider) {
        return typeof isOpenAITTSProvider === "function" ? isOpenAITTSProvider(provider) : provider === "openai";
    },

    isOfficialOpenAIEndpoint(endpoint) {
        const value = (endpoint || "https://api.openai.com/v1/audio/speech").trim();
        try {
            return new URL(value).hostname.toLowerCase() === "api.openai.com";
        } catch (e) {
            return value.toLowerCase().indexOf("api.openai.com") !== -1;
        }
    },

    addTestButton(section) {
        const provider = this.getProviderSelect(section);
        if (!provider) return;

        const containerId = section ? `ttsTestContainer${section}` : 'ttsTestContainer';
        if (document.getElementById(containerId)) return;

        let menuWrapper = document.querySelector(`#ttsButton${section || ""}`);
        if (!menuWrapper) {
            menuWrapper = document.createElement('div');
            menuWrapper.id = `ttsButton${section || ""}`;
            const providerWrapper = provider.closest('.textInputContainer') || provider.parentElement;
            if (!providerWrapper) return;
            providerWrapper.insertAdjacentElement('afterend', menuWrapper);
        }

        const container = document.createElement('div');
        container.className = 'tts-test-container';
        container.id = containerId;
        
        const testButton = document.createElement('button');
        testButton.textContent = "Test";
        testButton.className = "tts-test-button";
        testButton.onclick = () => this.testTTS(section);

        const cancelButton = document.createElement('button');
        cancelButton.textContent = "Cancel";
        cancelButton.className = "tts-test-cancel-button hidden";
        cancelButton.onclick = () => this.cancelTest(section);

        const actions = document.createElement('div');
        actions.className = 'tts-test-actions';
        actions.appendChild(testButton);
        actions.appendChild(cancelButton);
        
        const feedback = document.createElement('div');
        feedback.className = 'tts-feedback hidden';
        feedback.id = this.getFeedbackId(section);

        const kokoroCacheControls = this.createKokoroCacheControls(section);
        
        container.appendChild(actions);
        container.appendChild(feedback);
        container.appendChild(kokoroCacheControls);
        menuWrapper.replaceWith(container);

        if (!provider.dataset.kokoroCacheListenerAttached) {
            provider.dataset.kokoroCacheListenerAttached = "true";
            provider.addEventListener('change', () => this.updateKokoroCacheControls(section));
        }

        const voiceSelect = document.getElementById(`kokoroVoiceSelect${section || ""}`);
        if (voiceSelect && !voiceSelect.dataset.kokoroCacheListenerAttached) {
            voiceSelect.dataset.kokoroCacheListenerAttached = "true";
            voiceSelect.addEventListener('change', () => this.refreshKokoroCacheState(section));
        }

        this.updateKokoroCacheControls(section);
    },

    getTestContainer(section = "") {
        return document.getElementById(section ? `ttsTestContainer${section}` : 'ttsTestContainer');
    },

    getTestButton(section = "") {
        const container = this.getTestContainer(section);
        return container ? container.querySelector('.tts-test-button') : null;
    },

    getCancelButton(section = "") {
        const container = this.getTestContainer(section);
        return container ? container.querySelector('.tts-test-cancel-button') : null;
    },

    setTestRunning(section = "", running = false, label = "") {
        const testButton = this.getTestButton(section);
        const cancelButton = this.getCancelButton(section);
        if (testButton) {
            testButton.disabled = !!running;
            testButton.textContent = running ? (label || "Testing...") : "Test";
        }
        if (cancelButton) {
            cancelButton.classList.toggle('hidden', !running);
            cancelButton.disabled = !running;
        }
    },

    createKokoroCacheControls(section = "") {
        const container = document.createElement('div');
        container.className = 'tts-kokoro-cache-controls hidden';
        container.dataset.section = section || "";

        const actions = document.createElement('div');
        actions.className = 'tts-cache-actions';

        const cacheButton = document.createElement('button');
        cacheButton.type = "button";
        cacheButton.textContent = "Cache Kokoro model";
        cacheButton.className = "tts-cache-button";
        cacheButton.onclick = () => this.cacheKokoroModel(section);

        const cancelButton = document.createElement('button');
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel download";
        cancelButton.className = "tts-cache-cancel-button hidden";
        cancelButton.onclick = () => this.cancelKokoroCacheDownload(section);

        const clearButton = document.createElement('button');
        clearButton.type = "button";
        clearButton.textContent = "Clear Kokoro cache";
        clearButton.className = "tts-cache-clear-button";
        clearButton.onclick = () => this.clearKokoroCache(section);

        const status = document.createElement('div');
        status.className = 'tts-cache-status';
        status.textContent = "Kokoro can be cached before testing to avoid a large first-use download.";

        actions.appendChild(cacheButton);
        actions.appendChild(cancelButton);
        actions.appendChild(clearButton);
        container.appendChild(actions);
        container.appendChild(status);

        return container;
    },

    getKokoroCacheControls(section = "") {
        const container = this.getTestContainer(section)?.querySelector('.tts-kokoro-cache-controls');
        if (!container) return null;
        return {
            container,
            cacheButton: container.querySelector('.tts-cache-button'),
            cancelButton: container.querySelector('.tts-cache-cancel-button'),
            clearButton: container.querySelector('.tts-cache-clear-button'),
            status: container.querySelector('.tts-cache-status')
        };
    },

    getKokoroSelectedVoice(section = "") {
        return document.getElementById(`kokoroVoiceSelect${section || ""}`)?.value || "af_aoede";
    },

    getKokoroCacheDtype() {
        const assets = getKokoroAssets();
        const device = navigator.gpu ? "webgpu" : "wasm";
        return typeof assets.getPreferredDtype === "function" ? assets.getPreferredDtype(device) : (device === "webgpu" ? "fp16" : "q8");
    },

    getKokoroDtypeLabel(dtype) {
        if (dtype === "fp16") return "fp16 model (~156 MB)";
        if (dtype === "q8") return "q8 model (~88 MB)";
        if (dtype === "fp32") return "fp32 model";
        return dtype + " model";
    },

    getKokoroCacheAssets(section = "") {
        const assets = getKokoroAssets();
        const dtype = this.getKokoroCacheDtype(section);
        const resolveBase = typeof assets.getResolveBase === "function" ? assets.getResolveBase() : "https://largefiles.socialstream.ninja/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/";
        const modelFile = typeof assets.getModelFile === "function" ? assets.getModelFile(dtype) : (dtype === "q8" ? "onnx/model_quantized.onnx" : `onnx/model_${dtype}.onnx`);
        const voice = this.getKokoroSelectedVoice(section);
        const modelUrl = typeof assets.getModelUrl === "function" ? assets.getModelUrl(dtype) : resolveBase + modelFile;
        const voiceUrl = typeof assets.getVoiceUrl === "function" ? assets.getVoiceUrl(voice) : resolveBase + "voices/" + voice + ".bin";

        return {
            dtype,
            dtypeLabel: this.getKokoroDtypeLabel(dtype),
            voice,
            files: [
                { url: resolveBase + "config.json", cacheName: "transformers-cache", label: "config.json" },
                { url: resolveBase + "tokenizer.json", cacheName: "transformers-cache", label: "tokenizer.json" },
                { url: resolveBase + "tokenizer_config.json", cacheName: "transformers-cache", label: "tokenizer_config.json" },
                { url: modelUrl, cacheName: "transformers-cache", label: modelFile },
                { url: voiceUrl, cacheName: "kokoro-voices", label: voice + ".bin" }
            ]
        };
    },

    setKokoroCacheStatus(section = "", message = "", type = "") {
        const controls = this.getKokoroCacheControls(section);
        if (!controls?.status) return;
        controls.status.textContent = message;
        controls.status.className = `tts-cache-status${type ? " " + type : ""}`;
    },

    setKokoroCacheBusy(section = "", busy = false) {
        const controls = this.getKokoroCacheControls(section);
        if (!controls) return;
        if (controls.cacheButton) controls.cacheButton.disabled = !!busy;
        if (controls.clearButton) controls.clearButton.disabled = !!busy;
        if (controls.cancelButton) {
            controls.cancelButton.classList.toggle('hidden', !busy);
            controls.cancelButton.disabled = !busy;
        }

        const testButton = this.getTestButton(section);
        if (testButton && !this.premiumQueueActive) {
            testButton.disabled = !!busy;
        }
    },

    updateAllKokoroCacheControls() {
        ["", "2", "10", "18"].forEach(section => this.updateKokoroCacheControls(section));
    },

    updateKokoroCacheControls(section = "") {
        const controls = this.getKokoroCacheControls(section);
        if (!controls) return;
        const provider = this.getProviderSelect(section)?.value || "system";
        const showControls = provider === "kokoro" && !ssapp;
        controls.container.classList.toggle('hidden', !showControls);
        if (showControls) {
            this.refreshKokoroCacheState(section);
        }
    },

    async refreshKokoroCacheState(section = "") {
        const sectionKey = this.getSectionKey(section);
        if (this.kokoroCacheDownloads[sectionKey]) return;

        const controls = this.getKokoroCacheControls(section);
        if (!controls || controls.container.classList.contains('hidden')) return;

        if (!("caches" in window)) {
            this.setKokoroCacheStatus(section, "Browser cache storage is unavailable here. Kokoro will download during first use.", "error");
            if (controls.cacheButton) controls.cacheButton.disabled = true;
            if (controls.clearButton) controls.clearButton.disabled = true;
            return;
        }

        try {
            const assetSet = this.getKokoroCacheAssets(section);
            let cached = 0;
            for (const file of assetSet.files) {
                const cache = await caches.open(file.cacheName);
                if (await cache.match(file.url)) {
                    cached++;
                }
            }

            if (controls.cacheButton) controls.cacheButton.disabled = false;
            if (controls.clearButton) controls.clearButton.disabled = cached === 0;

            if (cached === assetSet.files.length) {
                this.setKokoroCacheStatus(section, `Kokoro ${assetSet.dtypeLabel} and ${assetSet.voice} voice are cached locally.`, "success");
            } else if (cached > 0) {
                this.setKokoroCacheStatus(section, `Kokoro cache is partial (${cached}/${assetSet.files.length}). Cache again to finish the current model and voice.`);
            } else {
                this.setKokoroCacheStatus(section, `Not cached yet. First Kokoro use will download the ${assetSet.dtypeLabel} and selected voice.`);
            }
        } catch (error) {
            console.error("Failed to check Kokoro cache:", error);
            this.setKokoroCacheStatus(section, "Unable to check the Kokoro cache state.", "error");
        }
    },

    async requestKokoroPersistentStorage(section = "") {
        if (!navigator.storage?.persist) return;
        try {
            const persisted = await navigator.storage.persist();
            if (!persisted) {
                this.setKokoroCacheStatus(section, "Downloading Kokoro model. Browser storage may still be cleared automatically later.");
            }
        } catch (error) {
            console.warn("Unable to request persistent Kokoro storage:", error);
        }
    },

    cloneResponseHeaders(response) {
        const headers = new Headers();
        try {
            response.headers.forEach((value, key) => {
                if (/^(content-encoding|content-length|transfer-encoding)$/i.test(key)) {
                    return;
                }
                headers.set(key, value);
            });
        } catch (_) { }
        return headers;
    },

    formatKokoroBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "";
        if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
        return bytes + " B";
    },

    async fetchAndCacheKokoroAsset(file, signal, onProgress) {
        const cache = await caches.open(file.cacheName);
        if (await cache.match(file.url)) {
            return { skipped: true, loaded: 0, total: 0 };
        }

        const response = await fetch(file.url, { signal });
        if (!response.ok) {
            throw new Error(`Download failed for ${file.label} (${response.status})`);
        }

        const total = parseInt(response.headers.get("content-length") || "0", 10) || 0;
        let loaded = 0;
        let blob = null;

        if (response.body?.getReader) {
            const reader = response.body.getReader();
            const chunks = [];
            while (true) {
                const result = await reader.read();
                if (result.done) break;
                chunks.push(result.value);
                loaded += result.value?.byteLength || 0;
                if (onProgress) onProgress(loaded, total);
            }
            blob = new Blob(chunks);
        } else {
            blob = await response.blob();
            loaded = blob.size || total;
            if (onProgress) onProgress(loaded, total);
        }

        if (signal.aborted) {
            throw new DOMException("Download cancelled", "AbortError");
        }

        await cache.put(file.url, new Response(blob, {
            status: response.status,
            statusText: response.statusText,
            headers: this.cloneResponseHeaders(response)
        }));

        return { skipped: false, loaded, total };
    },

    async cacheKokoroModel(section = "") {
        if (!("caches" in window)) {
            this.setKokoroCacheStatus(section, "Browser cache storage is unavailable here. Kokoro will download during first use.", "error");
            return;
        }

        const sectionKey = this.getSectionKey(section);
        if (this.kokoroCacheDownloads[sectionKey]) {
            this.setKokoroCacheStatus(section, "Kokoro model download is already running.");
            return;
        }

        const controller = new AbortController();
        this.kokoroCacheDownloads[sectionKey] = controller;
        this.setKokoroCacheBusy(section, true);
        let wasCancelled = false;

        try {
            await this.requestKokoroPersistentStorage(section);
            const assetSet = this.getKokoroCacheAssets(section);
            this.setKokoroCacheStatus(section, `Caching Kokoro ${assetSet.dtypeLabel} and ${assetSet.voice} voice...`);

            for (let i = 0; i < assetSet.files.length; i++) {
                const file = assetSet.files[i];
                const prefix = `Caching ${i + 1}/${assetSet.files.length}: ${file.label}`;
                this.setKokoroCacheStatus(section, prefix + "...");
                const result = await this.fetchAndCacheKokoroAsset(file, controller.signal, (loaded, total) => {
                    if (total) {
                        this.setKokoroCacheStatus(section, `${prefix} ${Math.round((loaded / total) * 100)}% (${this.formatKokoroBytes(loaded)} / ${this.formatKokoroBytes(total)})`);
                    } else {
                        this.setKokoroCacheStatus(section, `${prefix} ${this.formatKokoroBytes(loaded)}`);
                    }
                });

                if (result.skipped) {
                    this.setKokoroCacheStatus(section, `${prefix} already cached.`);
                }
            }

            this.setKokoroCacheStatus(section, `Kokoro ${assetSet.dtypeLabel} and ${assetSet.voice} voice are cached locally.`, "success");
        } catch (error) {
            if (error?.name === "AbortError") {
                wasCancelled = true;
                this.setKokoroCacheStatus(section, "Kokoro model download cancelled.");
            } else {
                console.error("Failed to cache Kokoro model:", error);
                this.setKokoroCacheStatus(section, "Kokoro model cache failed: " + (error?.message || error), "error");
            }
        } finally {
            delete this.kokoroCacheDownloads[sectionKey];
            this.setKokoroCacheBusy(section, false);
            if (!wasCancelled) {
                this.refreshKokoroCacheState(section);
            }
        }
    },

    cancelKokoroCacheDownload(section = "") {
        const controller = this.kokoroCacheDownloads[this.getSectionKey(section)];
        if (controller) {
            controller.abort();
        }
    },

    async clearKokoroCache(section = "") {
        if (!("caches" in window)) {
            this.setKokoroCacheStatus(section, "Browser cache storage is unavailable here.", "error");
            return;
        }

        const sectionKey = this.getSectionKey(section);
        if (this.kokoroCacheDownloads[sectionKey]) {
            this.cancelKokoroCacheDownload(section);
        }

        try {
            const assetSet = this.getKokoroCacheAssets(section);
            for (const file of assetSet.files) {
                const cache = await caches.open(file.cacheName);
                await cache.delete(file.url);
            }
            this.setKokoroCacheStatus(section, `Cleared Kokoro ${assetSet.dtypeLabel} and ${assetSet.voice} voice cache.`);
            this.refreshKokoroCacheState(section);
        } catch (error) {
            console.error("Failed to clear Kokoro cache:", error);
            this.setKokoroCacheStatus(section, "Unable to clear the Kokoro cache.", "error");
        }
    },

    getSettings(section = "") {
        const sectionKey = this.getSectionKey(section);
        const numberSuffix = section ? section : "";
        const getId = (base) => document.getElementById(`${base}${section || ""}`);
        const getParam = (key) => document.querySelector(`input[data-param${sectionKey}="${key}"]`)?.checked;
        const getNumber = (key, fallback) => {
            let ele = document.querySelector(`input[data-numbersetting${numberSuffix}="${key}"]`);
            if (!ele && section) {
                ele = document.querySelector(`input[data-numbersetting="${key}"]`);
            }
            const value = parseFloat(ele?.value);
            return Number.isFinite(value) ? value : fallback;
        };
        const getInt = (key, fallback) => {
            let ele = document.querySelector(`input[data-numbersetting${numberSuffix}="${key}"]`);
            if (!ele && section) {
                ele = document.querySelector(`input[data-numbersetting="${key}"]`);
            }
            const value = parseInt(ele?.value);
            return Number.isFinite(value) ? value : fallback;
        };
        const getOption = (key, fallback = "") => {
            const ele = document.querySelector(`[data-optionparam${sectionKey}="${key}"]`);
            return ele ? ele.value : fallback;
        };
        const getText = (key, fallback = "") => {
            const ele = document.querySelector(`input[data-textparam${sectionKey}="${key}"],textarea[data-textparam${sectionKey}="${key}"]`);
            return ele ? ele.value : fallback;
        };
        const getTextAny = (keys, fallback = "") => {
            for (let i = 0; i < keys.length; i++) {
                const value = getText(keys[i]);
                if (value) return value;
            }
            return fallback;
        };
        const getOptionAny = (keys, fallback = "") => {
            for (let i = 0; i < keys.length; i++) {
                const value = getOption(keys[i]);
                if (value) return value;
            }
            return fallback;
        };
        const systemLanguageSelect = section === "2" ? document.getElementById('languageSelect2') : getId('systemLanguageSelect');
        const systemLanguageEnabled = getParam('lang');
        const openaiVoiceSelect = getId('openaiVoiceSelect');
        const openaiModelSelect = document.querySelector(`[data-optionparam${sectionKey}="openaimodel"]`);
        const settings = {
            // Global settings
            speech: getParam('speech'),
            volume: getParam('volume') ? getNumber('volume', 1.0) : 1.0,
			service: this.getProviderSelect(section)?.value || "system",
            
            // System TTS settings
            system: {
                lang: systemLanguageEnabled ? systemLanguageSelect?.selectedOptions[0]?.dataset.lang || 'en-US' : 'en-US',
                voice: systemLanguageEnabled ? systemLanguageSelect?.selectedOptions[0]?.dataset.name : null,
                rate: getParam('rate') ? getNumber('rate', 1.0) : 1.0,
                pitch: getParam('pitch') ? getNumber('pitch', 1.0) : 1.0
            },
			
			// Kokoro TTS settings
            kokoro: {
                voice: getId('kokoroVoiceSelect')?.selectedOptions[0]?.value || "af_aoede",
                rate: getParam('kokorospeed') ? getNumber('kokorospeed', 1.0) : 1.0,
            },
            
            // Kitten TTS settings
            kitten: {
                voice: getId('kittenVoiceSelect')?.selectedOptions[0]?.value || "expr-voice-4-f",
                speed: getParam('kittenspeed') ? getNumber('kittenspeed', 1.0) : 1.0,
                sampleRate: 24000  // Fixed value - not configurable in new library
            },
            
            // Google Cloud TTS settings
            google: {
                key: getId('googleAPIKey')?.value || getText('ttskey') || document.getElementById('ttskey')?.value,
                voice: getId('googleVoiceName')?.value || getText('voicegoogle'),
                lang: getParam('googlelang') ? getOption('googlelang', 'en-US') : "en-US",
                rate: getParam('googlerate') ? getNumber('googlerate', 1.0) : 1.0,
                pitch: getParam('googlepitch') ? getNumber('googlepitch', 0) : 0,
                audioProfile: getParam('googlepitch') ? getOption('googleaudioprofile', false) : false
            },

            // Gemini TTS settings
            gemini: {
                key: getId('geminiAPIKey')?.value || getText('geminikey'),
                model: getId('geminiModelSelect')?.value || getOption('geminimodel', 'gemini-2.5-flash-preview-tts'),
                voice: getId('geminiVoiceSelect')?.value || getOption('voicegemini', 'Kore'),
                lang: getId('geminiLangSelect')?.value || getOption('geminilang', ''),
                style: getId('geminiStyleInstructions')?.value || getText('geministyle'),
                sampleRate: 24000
            },
            
            // ElevenLabs settings
			elevenLabs: {
				key: getId('elevenLabsKey')?.value || getText('elevenlabskey'),
				voice: getId('elevenLabsVoiceID')?.value || getText('voice11'),
				model: getParam('elevenlabsmodel') ? getOption('elevenlabsmodel', 'eleven_multilingual_v2') : 'eleven_multilingual_v2',
				latency: getParam(section === "2" ? 'latency' : 'elevenlatency') ? getInt(section === "2" ? 'latency' : 'elevenlatency', 0) : 4,
				stability: getParam('elevenstability') ? getNumber('elevenstability', 0.5) : 0.5,
				similarityBoost: getParam('elevensimilarity') ? getNumber('elevensimilarity', 0.75) : 0.75,
				style: getParam('elevenstyle') ? getNumber('elevenstyle', 0.5) : 0.5,
				speakerBoost: getParam('elevenspeakerboost') || false,
				speakingRate: getParam('elevenrate') ? getNumber('elevenrate', 1.0) : 1.0
			},
            
            // Speechify settings
            speechify: {
                key: getId('speechifyAPIKey')?.value || getText('speechifykey'),
                voice: getId('speechifyVoiceID')?.value || getText('voicespeechify'),
                lang: getParam('speechifylang') ? getOption('speechifylang', 'en-US') : 'en-US',
                speed: getParam('speechifyspeed') ? getNumber('speechifyspeed', 1.0) : 1.0,
                model: getParam('speechifymodel') ? getOption('speechifymodel', 'simba-english') : 'simba-english'
            },
            
            // OpenAI settings
            openai: {
                key: getId('openaiAPIKey')?.value || getTextAny(['openaikey', 'customttskey', 'localttskey']),
                endpoint: getId('openaiEndpoint')?.value || getTextAny(['openaiendpoint', 'customttsendpoint', 'localttsendpoint'], "https://api.openai.com/v1/audio/speech"),
                voice: (() => {
                    if (openaiVoiceSelect?.value === 'custom') {
                        const customVoice = getId('openaiCustomVoice')?.value || getTextAny(['openaicustomvoice', 'customttsvoice', 'localttsvoice']);
                        return customVoice || 'alloy';
                    }
                    return openaiVoiceSelect?.value || getOptionAny(['voiceopenai', 'customttsvoice', 'localttsvoice'], 'alloy');
                })(),
                model: (() => {
                    if (getParam('openaimodel') || getParam('customttsmodel') || getParam('localttsmodel')) {
                        if (openaiModelSelect?.value === 'custom') {
                            const customModel = getId('openaiCustomModel')?.value || getTextAny(['openaicustommodelx', 'customttsmodel', 'localttsmodel']);
                            return customModel || 'tts-1';
                        }
                        return openaiModelSelect?.value || getOptionAny(['openaimodel', 'customttsmodel', 'localttsmodel'], 'tts-1');
                    }
                    return 'tts-1';
                })(),
                speed: getParam('openaispeed') ? getNumber('openaispeed', 1.0) : 1.0,
                format: getParam('openaiformat') ? getOptionAny(['openaiformat', 'customttsformat', 'localttsformat'], 'mp3') : 'mp3'
            }
        };
        
        return settings;
    },

    showFeedback(message, type = 'info', section = this.currentTtsSection || "", autoHideMs = 5000) {
        const feedback = document.getElementById(this.getFeedbackId(section));
        if (feedback) {
            feedback.textContent = message;
            feedback.className = `tts-feedback ${type}`;
            
            const sectionKey = this.getSectionKey(section);
            if (this.feedbackTimeouts[sectionKey]) {
                clearTimeout(this.feedbackTimeouts[sectionKey]);
                this.feedbackTimeouts[sectionKey] = null;
            }
            
            if (autoHideMs > 0) {
                this.feedbackTimeouts[sectionKey] = setTimeout(() => {
                    feedback.className = 'tts-feedback hidden';
                    this.feedbackTimeouts[sectionKey] = null;
                }, autoHideMs);
            }
        }
    },
	
    getServiceName(section = "") {
        const settings = this.getSettings(section);
		if (settings.service) {
            const provider = this.getProviderSelect(section);
            if (provider && provider.selectedIndex >= 0) {
                return provider.options[provider.selectedIndex].innerText;
            }
        }
        if (settings.google.key) return 'Google Cloud TTS';
        if (settings.elevenLabs.key) return 'ElevenLabs TTS';
        if (settings.speechify.key) return 'Speechify TTS';
        if (settings.openai.key) return 'OpenAI TTS';
        return 'System TTS';
    },
    
    testTTS(section = "") {
        const testPhrase = "The quick brown fox jumps over the lazy dog";
        const serviceName = this.getServiceName(section);
        
        // Check if the provider supports testing
        const provider = this.getProviderSelect(section)?.value || "system";
        if (this.premiumQueueActive) {
            this.showFeedback("A TTS test is already running. Cancel it before starting another test.", 'warning', section, 0);
            return;
        }
        if (provider === 'piper' || provider === 'espeak') {
            let warningMsg = getTranslation("tts-test-not-available", "Testing is not available for {provider}. This TTS provider works during streaming only.");
            warningMsg = warningMsg.replace('{provider}', serviceName);
            this.showFeedback(warningMsg, 'error', section);
            return;
        }
        
        if (provider === 'kitten' || provider === 'kokoro') {
            let warningMsg = getTranslation("tts-test-limited", "Testing for {provider} requires significant browser resources. Works best during streaming.");
            warningMsg = warningMsg.replace('{provider}', serviceName);
            this.showFeedback(warningMsg, 'warning', section, provider === 'kokoro' ? 0 : 5000);
            // Continue with test despite warning
        }
        
        this.cancelRequested = false;
        this.showFeedback(`Testing ${serviceName}...`, 'info', section, provider === 'kokoro' ? 0 : 5000);
        
        const originalOnEnded = this.audio?.onended;
        const settings = this.getSettings(section);

        // Add success feedback after audio plays
        if (this.audio) {
            this.audio.onended = () => {
                this.showFeedback(`${serviceName} test completed successfully`, 'success', section);
                this.audio.onended = originalOnEnded;
                this.finishedAudio();
            };
        }

        try {
            // Check for required API keys if using premium services
            if (provider === 'google' && !settings.google.key) {
                throw new Error('Google Cloud API key is required');
            }
            if (provider === 'elevenlabs' && !settings.elevenLabs.key) {
                throw new Error('ElevenLabs API key is required');
            }
            if (provider === 'speechify' && !settings.speechify.key) {
                throw new Error('Speechify API key is required');
            }
            if (provider === 'gemini' && !settings.gemini.key) {
                throw new Error('Gemini API key is required');
            }
            if (this.isOpenAICompatibleProvider(provider) && this.isOfficialOpenAIEndpoint(settings.openai.endpoint) && !settings.openai.key) {
                if (provider !== 'openai') {
                    throw new Error('Enter a Custom / Local TTS Endpoint URL or run the local TTS bridge first');
                }
                throw new Error('OpenAI API key is required');
            }

            this.speak(testPhrase, true, section);
        } catch (error) {
            this.showFeedback(`${serviceName} Error: ${error.message}`, 'error', section);
            console.error(error);
        }
    },
	
	async speak(text, allow = false, section = "") {
        this.currentTtsSection = section;
        const settings = this.getSettings(section);
        
        if (!settings.speech && !allow) return;
        if (!text) return;
        
        try {
            if ((settings.service == "google") && settings.google.key) {
                if (!this.premiumQueueActive) {
                    await this.googleTTS(text, settings, section);
                } 
            } else if ((settings.service == "elevenlabs") && settings.elevenLabs.key) {
                if (!this.premiumQueueActive) {
                    await this.elevenLabsTTS(text, settings, section);
                } 
            } else if ((settings.service == "speechify") && settings.speechify.key) {
                if (!this.premiumQueueActive) {
                    await this.speechifyTTS(text, settings, section);
                }
            } else if (this.isOpenAICompatibleProvider(settings.service) && (settings.openai.key || !this.isOfficialOpenAIEndpoint(settings.openai.endpoint))) {
                if (!this.premiumQueueActive) {
                    await this.openaiTTS(text, settings, section);
                }
            } else if ((settings.service == "gemini") && settings.gemini.key) {
                if (!this.premiumQueueActive) {
                    await this.geminiTTS(text, settings, section);
                }
			} else if (settings.service == "kokoro") {
                if (!this.premiumQueueActive) {
                    await this.kokoroTTS(text, settings, section);
                }
            } else if (settings.service == "kitten") {
                if (!this.premiumQueueActive) {
                    await this.kittenTTS(text, settings, section);
                }
            } else if (!settings.service || (settings.service == "system")) {
                this.systemTTS(text, settings);
            } else if (allow) {
                this.showFeedback(`${this.getServiceName(section)} is not configured for testing`, 'error', section);
                this.finishedAudio();
            }
        } catch (error) {
            this.showFeedback(`Error: ${error.message}`, 'error');
            this.finishedAudio();
            console.error(error);
        }
    },
    
    systemTTS(text, settings) {
        if (!window.speechSynthesis) return;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = settings.system.lang;
        utterance.rate = settings.system.rate;
        utterance.volume = settings.volume;
        utterance.pitch = settings.system.pitch;
        
        if (this.voices && settings.system.voice) {
            const matchingVoice = this.voices.find(v => v.name === settings.system.voice);
            if (matchingVoice) {
                utterance.voice = matchingVoice;
            }
        }
        
        window.speechSynthesis.speak(utterance);
    },
	
	async kokoroTTS(text, settings, section = this.currentTtsSection || "") {
		try {
            this.premiumQueueActive = true;
            this.cancelRequested = false;
            this.setTestRunning(section, true, "Loading...");
			if (ssapp){
				try {
                    this.setTestRunning(section, true, "Generating...");
                    this.showFeedback("Generating Kokoro test audio in the desktop app...", 'info', section, 0);
					// Get WAV buffer directly from main process
					
					const wavBuffer = await ipcRenderer.invoke("tts", {text, settings: (settings?.kokoro || {} )});
                    if (this.cancelRequested) {
                        return;
                    }
					
					// Create blob from buffer
					const audioBlob = new Blob([wavBuffer], { type: "audio/wav" });
					
					// Play the audio
					const audioElement = document.createElement("audio");
					this.activeAudioElement = audioElement;
                    this.activeAudioUrl = URL.createObjectURL(audioBlob);
					audioElement.src = this.activeAudioUrl;
					audioElement.onended = () => {
                        this.showFeedback("Kokoro TTS test completed successfully", 'success', section);
                        this.finishedAudio(section);
                    };
					
					// Set volume if needed
					//const settings = { volume: 0.8 }; // Replace with your actual settings
					//if (settings.volume) audioElement.volume = settings.volume;
					
					await audioElement.play();
					return;
			  } catch (error) {
				console.error("Error playing TTS:", error);
				throw new Error("Error playing TTS. Try upgrading your app or perhaps your system ins't compatible");
			  }
			}
			
			if (!kokoroTtsInstance) {
                this.showFeedback("Loading Kokoro TTS. First use may download a large model and can take a while.", 'warning', section, 0);
				const initialized = await initKokoro();
                if (this.cancelRequested) {
                    return;
                }
				if (!initialized) {
					this.finishedAudio(section);
					return;
				}
			}
            this.setTestRunning(section, true, "Generating...");
            this.showFeedback("Generating Kokoro test audio...", 'info', section, 0);
			const streamer = new TextSplitterStream();
			streamer.push(text);
			streamer.close();
			
			const audioElement = document.createElement("audio");
            this.activeAudioElement = audioElement;
			audioElement.onended = () => {
                this.showFeedback("Kokoro TTS test completed successfully", 'success', section);
                this.finishedAudio(section);
            };
			
			const stream = kokoroTtsInstance.stream(streamer, { 
				voice: settings.kokoro.voice || "af_aoede",
				speed: settings.kokoro.rate || 1.0,
				streamAudio: false 
			});

			for await (const { audio } of stream) {
                if (this.cancelRequested) {
                    return;
                }
				if (!audio) {
					this.finishedAudio(section);
					return;
				}
				
				const audioBlob = audio.toBlob();
                if (this.activeAudioUrl) {
                    try {
                        URL.revokeObjectURL(this.activeAudioUrl);
                    } catch (e) {}
                }
                this.activeAudioUrl = URL.createObjectURL(audioBlob);
				audioElement.src = this.activeAudioUrl;
				if (settings.volume) audioElement.volume = settings.volume;
				
				try {
                    this.setTestRunning(section, true, "Playing...");
					await audioElement.play();
				} catch (e) {
					this.finishedAudio(section);
					console.error(e);
					errorlog("REMEMBER TO CLICK THE PAGE FIRST - audio won't play until you do");
				}
			}
            if (!this.activeAudioUrl && !this.cancelRequested) {
                this.finishedAudio(section);
            }
		} catch (e) {
			console.error("Kokoro TTS error:", e);
			this.finishedAudio(section);
		}
	},
    
    async kittenTTS(text, settings) {
        try {
            const baseUrl = chrome.runtime.getURL('');

            // Load ONNX Runtime first if not loaded
            if (typeof ort === 'undefined') {
                const ortScript = document.createElement('script');
                ortScript.src = './thirdparty/ort.min.js';
                await new Promise((resolve, reject) => {
                    ortScript.onload = resolve;
                    ortScript.onerror = reject;
                    document.head.appendChild(ortScript);
                });
            }

            // Configure WASM paths now that ONNX Runtime is available
            if (typeof ort !== 'undefined' && ort.env && ort.env.wasm) {
                ort.env.wasm.wasmPaths = baseUrl + 'thirdparty/kitten-tts/';
                ort.env.wasm.numThreads = 1;
                ort.env.wasm.simd = false;
                console.log("Configured ONNX Runtime WASM paths for popup");
            }

            // Load Kitten TTS module if not loaded
            if (!window.kittenTtsInstance) {
                // Use absolute URL for chrome extension context
                const moduleUrl = baseUrl + 'thirdparty/kitten-tts/kitten-tts-lib.js';

                const { KittenTTS } = await import(moduleUrl);

                window.kittenTtsInstance = new KittenTTS();

                // Initialize with model, voices, and explicit WASM path using absolute URLs
                const modelUrl = baseUrl + 'thirdparty/kitten-tts/kitten_tts_nano_v0_1.onnx';
                const voicesUrl = baseUrl + 'thirdparty/kitten-tts/voices.json';
                const wasmPaths = { wasm: baseUrl + 'thirdparty/kitten-tts/ort-wasm-simd-threaded.jsep.wasm' };
                await window.kittenTtsInstance.init(modelUrl, voicesUrl, wasmPaths);
            }
            
            this.premiumQueueActive = true;
            
            // Generate speech with selected voice and speed
            const audioBlob = await window.kittenTtsInstance.generateSpeech(
                text, 
                settings.kitten.voice || 'expr-voice-4-f',
                settings.kitten.speed || 1.0
            );
            
            // Play audio
            if (!this.audio) {
                this.audio = document.createElement("audio");
                this.audio.onended = () => this.finishedAudio();
            }
            
            this.audio.src = URL.createObjectURL(audioBlob);
            if (settings.volume) {
                this.audio.volume = settings.volume;
            }
            
            await this.audio.play().catch(e => {
                console.error("Audio playback failed:", e);
                this.finishedAudio();
            });
            
        } catch (error) {
            console.error("Kitten TTS error:", error);
            this.showFeedback(`Kitten TTS Error: ${error.message}`, 'error');
            this.finishedAudio();
        }
    },
    
    googleTTS(text, settings) {
        this.premiumQueueActive = true;
        const url = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${settings.google.key}`;
        
        const data = {
            input: { text },
            voice: {
                languageCode: settings.google.lang.toLowerCase(),
                name: settings.google.voice || "en-GB-Standard-A"
            },
            audioConfig: {
                audioEncoding: "MP3",
                speakingRate: settings.google.rate,
                pitch: settings.google.pitch
            }
        };

        if (settings.google.audioProfile) {
            data.audioConfig.audioProfile = settings.google.audioProfile;
        }
        
        this.fetchAudioContent(url, {
            method: "POST",
            headers: { "content-type": "application/json; charset=UTF-8" },
            body: JSON.stringify(data)
        }, 'base64');
    },

    buildGeminiTtsText(text, settings) {
        const style = (settings.gemini.style || "").trim();
        if (!style) {
            return text;
        }
        return style + "\n\n" + text;
    },

    pcm16ToWav(pcmBytes, sampleRate = 24000, numChannels = 1) {
        const bytesPerSample = 2;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataLength = pcmBytes.length;
        const buffer = new ArrayBuffer(44);
        const view = new DataView(buffer);
        const writeString = function(offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bytesPerSample * 8, true);
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);

        return new Blob([view.buffer, pcmBytes], { type: "audio/wav" });
    },

    async geminiTTS(text, settings) {
        this.premiumQueueActive = true;
        const model = settings.gemini.model || "gemini-2.5-flash-preview-tts";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const speechConfig = {
            voiceConfig: {
                prebuiltVoiceConfig: {
                    voiceName: settings.gemini.voice || "Kore"
                }
            }
        };

        if (settings.gemini.lang) {
            speechConfig.languageCode = settings.gemini.lang;
        }

        const data = {
            model,
            contents: [{ parts: [{ text: this.buildGeminiTtsText(text, settings) }]}],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig
            }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "content-type": "application/json; charset=UTF-8",
                    "x-goog-api-key": settings.gemini.key
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type") || "";
                if (contentType.includes("application/json")) {
                    const errorData = await response.json();
                    throw new Error(errorData?.error?.message || errorData?.message || `Gemini TTS HTTP ${response.status}`);
                }
                throw new Error(`Gemini TTS HTTP ${response.status} ${response.statusText}`);
            }

            const json = await response.json();
            const inlinePart = json?.candidates?.[0]?.content?.parts?.find(part => part.inlineData && part.inlineData.data);
            const base64Audio = inlinePart?.inlineData?.data;
            const mimeType = inlinePart?.inlineData?.mimeType || "";
            if (!base64Audio) {
                throw new Error("No audio content returned from Gemini");
            }

            const pcmBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
            const audioBlob = mimeType.includes("wav")
                ? new Blob([pcmBytes], { type: mimeType })
                : this.pcm16ToWav(pcmBytes, settings.gemini.sampleRate || 24000, 1);
            const blobUrl = URL.createObjectURL(audioBlob);
            this.playAudio(blobUrl);
        } catch (error) {
            this.showFeedback(`Gemini TTS Error: ${error.message}`, 'error');
            console.error("Gemini TTS error:", error);
            this.finishedAudio();
        }
    },
    
	elevenLabsTTS(text, settings) {
		this.premiumQueueActive = true;
		const voiceId = settings.elevenLabs.voice || "VR6AewLTigWG4xSOukaG";
		const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=${settings.elevenLabs.latency}`;
		
		const data = {
			text,
			model_id: settings.elevenLabs.model,
			voice_settings: {
				stability: settings.elevenLabs.stability,
				similarity_boost: settings.elevenLabs.similarityBoost,
				style: settings.elevenLabs.style,
				use_speaker_boost: settings.elevenLabs.speakerBoost,
				speaking_rate: settings.elevenLabs.speakingRate
			}
		};
		
		this.fetchAudioContent(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"xi-api-key": settings.elevenLabs.key,
				"accept": "*/*"
			},
			body: JSON.stringify(data)
		}, 'blob');
	},
		
	async getElevenLabsVoices(settings) {
		if (!settings?.elevenLabs?.key) {
			console.error("No ElevenLabs API key provided");
			console.log(settings);
			return [];
		}
		
		try {
			const response = await fetch("https://api.elevenlabs.io/v1/voices", {
				headers: {
					"xi-api-key": settings.elevenLabs.key,
					"accept": "application/json"
				}
			});
			
			if (!response.ok) {
				throw new Error(`API error: ${response.status} ${response.statusText}`);
			}
			
			const data = await response.json();
			return data.voices || [];
		} catch (error) {
			console.error("Failed to fetch ElevenLabs voices:", error);
			return [];
		}
	},

	listElevenLabsVoices() {
		const settings = this.getSettings();
		if (!settings?.elevenLabs?.key) {
			this.showFeedback("No ElevenLabs API key provided. Please enter your API key first.", 'error');
			return;
		}
		
		const voicesList = document.getElementById('elevenLabsVoicesList');
		if (!voicesList) return;
		
		voicesList.innerHTML = '<div style="text-align:center">Loading voices...</div>';
		voicesList.style.display = 'block';
		
		this.getElevenLabsVoices(settings).then(voices => {
			if (!voices || voices.length === 0) {
				voicesList.innerHTML = '<div style="text-align:center">No voices found in your ElevenLabs account</div>';
				return;
			}
			
			voicesList.innerHTML = '';
			
			voices.forEach(voice => {
				const voiceItem = document.createElement('div');
				voiceItem.className = 'voice-item';
				voiceItem.style.padding = '8px';
				voiceItem.style.borderBottom = '1px solid #444';
				voiceItem.style.cursor = 'pointer';
				voiceItem.style.transition = 'background-color 0.2s';
				
				voiceItem.innerHTML = `
					<div style="font-weight:bold">${voice.name}</div>
					<div style="font-size:0.9em;opacity:0.8">ID: ${voice.voice_id}</div>
					<div style="font-size:0.9em;opacity:0.8">Category: ${voice.category || 'Unknown'}</div>
				`;
				
				voiceItem.addEventListener('mouseover', () => {
					voiceItem.style.backgroundColor = 'rgba(255,255,255,0.1)';
				});
				
				voiceItem.addEventListener('mouseout', () => {
					voiceItem.style.backgroundColor = 'transparent';
				});
				
				voiceItem.addEventListener('click', () => {
					document.getElementById('elevenLabsVoiceID').value = voice.voice_id;
					this.showFeedback(`Voice "${voice.name}" selected`, 'success');
					voicesList.style.display = 'none';
				});
				
				voicesList.appendChild(voiceItem);
			});
		}).catch(err => {
			voicesList.innerHTML = `<div style="text-align:center;color:#f8d7da">Error: ${err.message}</div>`;
			console.error("Error fetching voices:", err);
		});
	},

    
    speechifyTTS(text, settings) {
        this.premiumQueueActive = true;
        const url = "https://api.sws.speechify.com/v1/audio/speech";
        
        const data = {
            input: `<speak>${text}</speak>`,
            voice_id: settings.speechify.voice || "henry",
            model: settings.speechify.model,
            audio_format: "mp3",
            speed: settings.speechify.speed,
            language: settings.speechify.lang
        };
        
        this.fetchAudioContent(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${settings.speechify.key}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }, 'base64');
    },
    
    openaiTTS(text, settings) {
        this.premiumQueueActive = true;
        const url = settings.openai.endpoint || "https://api.openai.com/v1/audio/speech";
        const headers = {
            "Content-Type": "application/json"
        };
        
        const data = {
            model: settings.openai.model,
            input: text,
            voice: settings.openai.voice,
            response_format: settings.openai.format,
            speed: settings.openai.speed
        };

        if (settings.openai.key) {
            headers.Authorization = `Bearer ${settings.openai.key}`;
        }
        
        this.fetchAudioContent(url, {
            method: "POST",
            headers,
            body: JSON.stringify(data)
        }, 'blob');
    },
    
    async fetchAudioContent(url, options, type) {
        const fetchOptions = Object.assign({}, options || {});
        let timeoutId = null;
        if (typeof AbortController !== "undefined" && !fetchOptions.signal) {
            const controller = new AbortController();
            fetchOptions.signal = controller.signal;
            timeoutId = setTimeout(() => controller.abort(), 8000);
        }

		try {
			const response = await fetch(url, fetchOptions);
			
			if (!response.ok) {
				//console.log(response);
				// Try to get detailed error message from response
				const contentType = response.headers.get("content-type");
				//console.log(contentType);
				if (contentType && contentType.includes("application/json")) {
					const errorData = await response.json();
					//console.log(errorData);
					throw new Error(errorData?.message || errorData?.detail?.message || errorData?.error?.message || errorData?.error || `HTTP error! status: ${response.status}`);
				}
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			if (type === 'base64') {
				const json = await response.json();
				if (!json.audioContent && !json.audio_data) {
					throw new Error('No audio data received');
				}
				this.playAudio(`data:audio/mp3;base64,${json.audioContent || json.audio_data}`);
			} else if (type === 'blob') {
				const blob = await response.blob();
				const blobUrl = URL.createObjectURL(blob);
				this.playAudio(blobUrl);
			}
		} catch (error) {
			const message = error && error.name === "AbortError" ? "Request timed out. Check that the TTS server is running." : error.message;
			this.showFeedback(`Audio fetch error: ${message}`, 'error');
			console.error("Error fetching audio:", error);
			this.finishedAudio();
		} finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
		}
	},
    
    playAudio(src) {
        if (!this.audio) {
            this.audio = document.createElement("audio");
            this.audio.onended = () => this.finishedAudio();
        }
        
        this.audio.src = src;
        this.audio.volume = this.getSettings().volume;
        
        try {
            this.audio.play().catch(e => {
                console.error("Audio playback failed:", e);
                this.finishedAudio();
            });
        } catch (e) {
            console.error("Audio playback failed:", e);
            this.finishedAudio();
        }
    },

    cancelTest(section = this.currentTtsSection || "") {
        if (!this.premiumQueueActive) return;
        this.cancelRequested = true;
        try {
            if (this.activeAudioElement) {
                this.activeAudioElement.pause();
                this.activeAudioElement.currentTime = 0;
            }
        } catch (e) {}
        try {
            if (this.audio) {
                this.audio.pause();
                this.audio.currentTime = 0;
            }
        } catch (e) {}
        this.showFeedback("TTS test cancelled. If Kokoro is still loading, the browser may finish its current model step first.", 'warning', section);
        this.finishTtsTest(section, true);
    },

    finishTtsTest(section = this.currentTtsSection || "", keepCancelFlag = false) {
        if (this.activeAudioUrl) {
            try {
                URL.revokeObjectURL(this.activeAudioUrl);
            } catch (e) {}
        }
        this.activeAudioElement = null;
        this.activeAudioUrl = null;
        this.premiumQueueActive = false;
        if (!keepCancelFlag) {
            this.cancelRequested = false;
        }
        this.setTestRunning(section, false);
    },

    finishedAudio(section = this.currentTtsSection || "") {
        this.finishTtsTest(section);
    },
};

var TextSplitterStream = null;
var KokoroTTS = false;
var kokoroDownloadInProgress  = null;
var kokoroTtsInstance = null;

function getKokoroAssets() {
	return window.SSNKokoroAssets || {
		modelId: "onnx-community/Kokoro-82M-v1.0-ONNX",
		getRemoteHost: function() {
			return "https://largefiles.socialstream.ninja/";
		},
		getPreferredDtype: function(device) {
			return device === "wasm" ? "q8" : "fp32";
		}
	};
}

function logKokoroProgress(progress) {
	if (!progress) {
		return;
	}
	let percentage = null;
	if (typeof progress.progress === "number") {
		percentage = progress.progress <= 1 ? progress.progress * 100 : progress.progress;
	} else if ((progress.status === "progress_total" || progress.status === "progress") && progress.total) {
		percentage = (progress.loaded / progress.total) * 100;
	}
	if (percentage !== null) {
		console.log("Kokoro download:", percentage.toFixed(1) + "%");
        if (typeof TTSManager !== "undefined" && TTSManager.premiumQueueActive) {
            TTSManager.setTestRunning(TTSManager.currentTtsSection || "", true, "Downloading...");
            TTSManager.showFeedback("Downloading Kokoro model... " + percentage.toFixed(1) + "%", 'info', TTSManager.currentTtsSection || "", 0);
        }
	}
}

async function createKokoroTtsInstance(device) {
	const kokoroAssets = getKokoroAssets();
	return KokoroTTS.from_pretrained(kokoroAssets.modelId, {
		dtype: kokoroAssets.getPreferredDtype(device),
		device,
		progress_callback: logKokoroProgress
	});
}

async function initKokoroWithFallback(preferredDevice) {
	const attempts = [preferredDevice];
	let lastError = null;

	if (preferredDevice === "webgpu") {
		attempts.push("wasm", "auto");
	}

	for (const device of attempts) {
		try {
			console.log("Initializing Kokoro TTS with device:", device);
			return await createKokoroTtsInstance(device);
		} catch (error) {
			lastError = error;
			console.error(error);
		}
	}

	throw lastError || new Error("Unable to initialize Kokoro TTS");
}

async function initKokoro() {
	if (ssapp) return false;
	if (kokoroDownloadInProgress) return false;
	
	if (!KokoroTTS) {
		try {
			const kokoroAssets = getKokoroAssets();
			kokoroDownloadInProgress = true;
			window.SSN_KOKORO_REMOTE_HOST = kokoroAssets.getRemoteHost();
			console.log("Loading Kokoro dependencies...");
			console.log("Using Kokoro asset host:", window.SSN_KOKORO_REMOTE_HOST);
			const module = window.location.href.startsWith("chrome-extension://") ? await import('./thirdparty/kokoro-bundle.es.ext.js') : await import('./thirdparty/kokoro-bundle.es.js');
			KokoroTTS = module.KokoroTTS;
			TextSplitterStream = module.TextSplitterStream;
			const detectWebGPU = module.detectWebGPU;
			let device = (await detectWebGPU()) ? "webgpu" : "wasm";
			console.log("Using device:", device);
			kokoroTtsInstance = await initKokoroWithFallback(device);
			
			console.log("Kokoro TTS ready!");
			kokoroDownloadInProgress = false;
			return true;
		} catch (error) {
			console.error('Failed to initialize Kokoro:', error);
			kokoroDownloadInProgress = false;
			return false;
		}
	}
	return true;
}

const PollManager = {
    savedPolls: [],
    currentPollId: null,

    init() {
        // Add event delegation for the savedPollsList
        document.getElementById('savedPollsList').addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('delete-poll')) {
                const pollItem = target.closest('.saved-poll-item');
                const pollId = parseInt(pollItem.dataset.pollId);
                if (confirm('Are you sure you want to delete this preset?')) {
                    this.savedPolls = this.savedPolls.filter(p => p.id !== pollId);
                    if (this.currentPollId === pollId) {
                        this.currentPollId = null;
                    }
                    this.updatePollsList();
                    this.savePollsToStorage();
                }
            } else {
                const pollItem = target.closest('.saved-poll-item');
                if (!pollItem) return;
                const pollId = parseInt(pollItem.dataset.pollId);
                this.loadPoll(pollId);
            }
        });
    },

    getCurrentSettings() {
        return {
            pollType: document.querySelector('[data-optionsetting="pollType"]').value,
            pollQuestion: document.querySelector('[data-textsetting="pollQuestion"]').value,
            multipleChoiceOptions: document.querySelector('[data-textsetting="multipleChoiceOptions"]').value,
            pollMatchMode: document.querySelector('[data-optionsetting="pollMatchMode"]')?.value || 'exact',
            pollStyle: document.querySelector('[data-optionsetting="pollStyle"]').value,
            pollTimer: document.querySelector('[data-numbersetting="pollTimer"]').value,
            pollTimerState: document.querySelector('[data-setting="pollTimerState"]').checked,
            pollTally: document.querySelector('[data-setting="pollTally"]').checked,
            pollSpam: document.querySelector('[data-setting="pollSpam"]').checked,
            pollDonationWeighted: document.querySelector('[data-setting="pollDonationWeighted"]')?.checked || false
        };
    },

    async saveCurrentPoll() {
		const pollName = await prompt("Enter a name for this poll preset:", document.querySelector('[data-textsetting="pollQuestion"]').value.trim());
		
        if (!pollName) return;

        const newPoll = {
            id: Date.now(),
            name: pollName,
            settings: this.getCurrentSettings()
        };

        this.savedPolls.push(newPoll);
        this.currentPollId = newPoll.id;
        this.updatePollsList();
        this.savePollsToStorage();
    },

    createNewPoll() {
        const defaultSettings = {
            pollType: 'freeform',
            pollQuestion: '',
            multipleChoiceOptions: '',
            pollMatchMode: 'exact',
            pollStyle: 'default',
            pollTimer: 60,
            pollTimerState: false,
            pollTally: false,
            pollSpam: false,
            pollDonationWeighted: false
        };

        const elements = {
            '[data-optionsetting="pollType"]': defaultSettings.pollType,
            '[data-textsetting="pollQuestion"]': defaultSettings.pollQuestion,
            '[data-textsetting="multipleChoiceOptions"]': defaultSettings.multipleChoiceOptions,
            '[data-optionsetting="pollMatchMode"]': defaultSettings.pollMatchMode,
            '[data-optionsetting="pollStyle"]': defaultSettings.pollStyle,
            '[data-numbersetting="pollTimer"]': defaultSettings.pollTimer,
            '[data-setting="pollTimerState"]': defaultSettings.pollTimerState,
            '[data-setting="pollTally"]': defaultSettings.pollTally,
            '[data-setting="pollSpam"]': defaultSettings.pollSpam,
            '[data-setting="pollDonationWeighted"]': defaultSettings.pollDonationWeighted
        };

        for (const [selector, value] of Object.entries(elements)) {
            const element = document.querySelector(selector);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
                updateSettings(element, true);
            }
        }

        this.currentPollId = null;
        this.updatePollsList();
    },

    loadPoll(pollId) {
        const poll = this.savedPolls.find(p => p.id === pollId);
        if (!poll) return;

        // Set flag to prevent update() from reverting values
        window.isLoadingPoll = true;

        // Update all form elements with the poll's settings
        const elements = {
            '[data-optionsetting="pollType"]': poll.settings.pollType,
            '[data-textsetting="pollQuestion"]': poll.settings.pollQuestion,
            '[data-textsetting="multipleChoiceOptions"]': poll.settings.multipleChoiceOptions,
            '[data-optionsetting="pollMatchMode"]': poll.settings.pollMatchMode || 'exact',
            '[data-optionsetting="pollStyle"]': poll.settings.pollStyle,
            '[data-numbersetting="pollTimer"]': poll.settings.pollTimer,
            '[data-setting="pollTimerState"]': poll.settings.pollTimerState,
            '[data-setting="pollTally"]': poll.settings.pollTally,
            '[data-setting="pollSpam"]': poll.settings.pollSpam,
            '[data-setting="pollDonationWeighted"]': poll.settings.pollDonationWeighted || false
        };

        for (const [selector, value] of Object.entries(elements)) {
            const element = document.querySelector(selector);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
                updateSettings(element, true);
            }
        }

        this.currentPollId = pollId;
        this.updatePollsList();
        
        // Clear flag after a short delay to ensure all updates have been processed
        setTimeout(() => {
            window.isLoadingPoll = false;
        }, 500);
    },

    updatePollsList() {
        const container = document.getElementById('savedPollsList');
        container.innerHTML = '';

        this.savedPolls.forEach(poll => {
            const pollElement = document.createElement('div');
            pollElement.className = 'saved-poll-item';
            pollElement.dataset.pollId = poll.id;
            pollElement.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 5px; margin: 5px 0; background: rgba(0,0,0,0.1); border-radius: 4px; cursor: pointer;';
            
            if (this.currentPollId === poll.id) {
                pollElement.style.background = 'rgba(0,255,0,0.1)';
            }

            pollElement.innerHTML = `
                <div class="poll-name" style="flex-grow: 1;">${poll.name}</div>
                <button class="delete-poll" style="background: none; border: none; color: #ff4444; cursor: pointer; padding: 0 5px;">×</button>
            `;
            container.appendChild(pollElement);
        });
    },

    savePollsToStorage() {
        chrome.runtime.sendMessage({
            cmd: "saveSetting",
            type: "json",
            setting: "savedPolls",
            value: JSON.stringify(this.savedPolls)
        });
    }
};

// Hotkey system for quick actions
const DEFAULT_HOTKEYS = {
    'Ctrl+Shift+E': 'closepoll',
    'Ctrl+Shift+W': 'selectwinner',
    'Ctrl+Shift+S': 'stopentries',
    'Ctrl+Shift+R': 'resetpoll',
    'Ctrl+Shift+X': 'resetwaitlist',
    'Ctrl+Shift+C': 'cleardock'
};

function buildKeyCombo(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.key.length === 1) parts.push(e.key.toUpperCase());
    else parts.push(e.key);
    return parts.join('+');
}

function initHotkeys() {
    chrome.storage.sync.get(['hotkeys'], (result) => {
        const hotkeys = result.hotkeys || DEFAULT_HOTKEYS;

        document.addEventListener('keydown', (e) => {
            // Don't trigger if typing in input/textarea/select
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
            if (e.target.isContentEditable) return;

            const combo = buildKeyCombo(e);
            const action = hotkeys[combo];
            if (action) {
                e.preventDefault();
                chrome.runtime.sendMessage({ cmd: action });
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", async function(event) {
    loadSourcesListFromRuntimeManifest();
    setupDynamicCustomUrlControls();

    // Initialize hotkey system
    initHotkeys();
	// Add event listener for Event Flow Editor link
	const eventFlowLink = document.getElementById('open-event-flow-editor-link');
	if (eventFlowLink) {
		eventFlowLink.addEventListener('click', function(e) {
			e.preventDefault();
			openEventFlowEditor();
			return false;
		});
	}
	
	// Initialize ProfileManager after DOM is ready
	ProfileManager.init();

	// Initialize blocked words tag input
	setupBlockedWordsInput();
	commaTagInputs.forEach((inputId) => {
		setupCommaTagInput(inputId);
	});

	// Add event listener for save profile button
	const saveProfileBtn = document.querySelector('button[data-action="saveProfile"]');
	if (saveProfileBtn) {
		saveProfileBtn.addEventListener('click', function() {
			ProfileManager.saveCurrentProfile();
		});
	}

	// Add event listeners for credits roll buttons and trigger mode
	const creditsStartBtn = document.getElementById('creditsStartBtn');
	const creditsPreviewBtn = document.getElementById('creditsPreviewBtn');
	const creditsResetBtn = document.getElementById('creditsResetBtn');
	const creditsTriggerMode = document.querySelector('select[data-optionparam13="triggermode"]');
	const creditsActionsDiv = document.querySelector('.credits-actions');
	const creditsOptionsGroup = document.querySelector('.options_group.credits');
	const setCreditsPresetParams = function(paramsToEnable, paramsToDisable) {
		const findCreditsParamInput = function(paramName) {
			const selector = `input[data-param13="${paramName}"]`;
			return (creditsOptionsGroup && creditsOptionsGroup.querySelector(selector)) || document.querySelector(selector);
		};
		if (typeof beginPopupLinkRefreshBatch === "function") {
			beginPopupLinkRefreshBatch();
		}
		try {
			(paramsToDisable || []).forEach(function(paramName) {
				const input = findCreditsParamInput(paramName);
				if (input && input.checked) {
					input.checked = false;
					updateSettings(input, true);
				}
			});
			(paramsToEnable || []).forEach(function(paramName) {
				const input = findCreditsParamInput(paramName);
				if (input && !input.checked) {
					input.checked = true;
					updateSettings(input, true);
				}
			});
		} finally {
			if (typeof endPopupLinkRefreshBatch === "function") {
				endPopupLinkRefreshBatch();
			} else {
				refreshLinks();
			}
		}
	};

	document.querySelectorAll('[data-credits-preset]').forEach(function(button) {
		button.addEventListener('click', function() {
			const preset = button.getAttribute('data-credits-preset');
			if (preset === 'supporters') {
				setCreditsPresetParams(
					['loop', 'persistcredits', 'onlysupporters', 'donationpriority', 'showamounts'],
					['onlydonors']
				);
			} else if (preset === 'donors') {
				setCreditsPresetParams(
					['loop', 'persistcredits', 'onlydonors', 'showamounts'],
					['onlysupporters', 'donationpriority']
				);
			}
		});
	});

	if (creditsStartBtn) {
		creditsStartBtn.addEventListener('click', function() {
			chrome.runtime.sendMessage({ cmd: "creditsStart" });
		});
	}

	if (creditsPreviewBtn) {
		creditsPreviewBtn.addEventListener('click', function() {
			chrome.runtime.sendMessage({ cmd: "creditsPreview" });
		});
	}

	if (creditsResetBtn) {
		creditsResetBtn.addEventListener('click', function() {
			chrome.runtime.sendMessage({ cmd: "creditsReset" });
		});
	}

	// Show/hide credits buttons based on trigger mode
	if (creditsTriggerMode && creditsActionsDiv) {
		const updateCreditsButtonsVisibility = () => {
			creditsActionsDiv.style.display = creditsTriggerMode.value === 'manual' ? 'flex' : 'none';
		};
		creditsTriggerMode.addEventListener('change', updateCreditsButtonsVisibility);
		updateCreditsButtonsVisibility(); // Set initial state
	}

	// Add event listeners for OpenAI custom voice/model dropdowns
	const setupOpenAICustomInputs = (voiceSelectId, modelSelectId, customVoiceId, customModelId) => {
		const voiceSelect = document.getElementById(voiceSelectId);
		const modelSelect = document.getElementById(modelSelectId);
		const customVoiceInput = document.getElementById(customVoiceId);
		const customModelInput = document.getElementById(customModelId);
		
		if (voiceSelect && customVoiceInput) {
			voiceSelect.addEventListener('change', function() {
				if (this.value === 'custom') {
					customVoiceInput.style.display = 'inline-block';
					customVoiceInput.focus();
				} else {
					customVoiceInput.style.display = 'none';
					customVoiceInput.value = '';
				}
				updateSettings();
			});
			
			customVoiceInput.addEventListener('input', updateSettings);
		}
		
		if (modelSelect && customModelInput) {
			modelSelect.addEventListener('change', function() {
				if (this.value === 'custom') {
					customModelInput.style.display = 'inline-block';
					customModelInput.focus();
				} else {
					customModelInput.style.display = 'none';
					customModelInput.value = '';
				}
				updateSettings();
			});
			
			customModelInput.addEventListener('input', updateSettings);
		}
	};
	
	// Setup for all four sections
	setupOpenAICustomInputs('openaiVoiceSelect', 'openaiModelSelect', 'openaiCustomVoice', 'openaiCustomModel');
	setupOpenAICustomInputs('openaiVoiceSelect2', 'openaiModelSelect2', 'openaiCustomVoice2', 'openaiCustomModel2');
	setupOpenAICustomInputs('openaiVoiceSelect10', 'openaiModelSelect10', 'openaiCustomVoice10', 'openaiCustomModel10');
	setupOpenAICustomInputs('openaiVoiceSelect18', 'openaiModelSelect18', 'openaiCustomVoice18', 'openaiCustomModel18');
	
	// Language selector handling
	const languageIcon = document.getElementById('languageIcon');
	const languageSelector = document.getElementById('language-selector-container');
	
	// The standalone app owns language selection; the extension popup keeps this control.
	if (ssapp || urlParams.has("ln")) {
		if (languageIcon) {
			languageIcon.style.display = 'none';
		}
		if (languageSelector) {
			languageSelector.style.display = 'none';
		}
	} else {
		// Add click handler for language icon
		if (languageIcon) {
			languageIcon.addEventListener('click', function(e) {
				e.stopPropagation();
				if (languageSelector.style.display === 'none' || languageSelector.style.display === '') {
					languageSelector.style.display = 'block';
				} else {
					languageSelector.style.display = 'none';
				}
			});
		}
		
		// Hide language selector when clicking outside
		document.addEventListener('click', function(e) {
			if (languageSelector && !languageSelector.contains(e.target) && e.target !== languageIcon) {
				languageSelector.style.display = 'none';
			}
		});
	}
	if (urlParams.has("ln")) {
		applyExternalTranslationLanguage(urlParams.get("ln"), { reload: false });
	}
	if (ssapp){
		document.getElementById("disableButtonText").innerHTML = "🔌 Services Loading";
		const basePath = decodeURIComponent(urlParams.get('basePath'));
 		if (basePath){
 			document.getElementById("chathistory").href = basePath  + "/chathistory.html?href="+encodeURIComponent(window.location.href);
 		}
	} else {
		document.getElementById("disableButtonText").innerHTML = "🔌 Extension Loading";
	}
	
	if (ssapp && urlParams.get("ssapp")){
		document.body.classList.add('ssapp');
	}
	if (ssapp){
		const style = document.createElement('style');
		style.textContent = 'body .ssapp { display: none !important; }';
		style.id = 'hide-ssapp-style';
		document.head.appendChild(style);
	}

	
	const uploadCustomJsButton = document.getElementById('uploadCustomJsButton');
	const deleteCustomJsButton = document.getElementById('deleteCustomJsButton');

	if (uploadCustomJsButton) {
	  uploadCustomJsButton.addEventListener('click', uploadCustomJsFile);
	}

	if (deleteCustomJsButton) {
	  deleteCustomJsButton.addEventListener('click', deleteCustomJsFile);
	}
	
	//document.body.className = "extension-disabled";
	document.getElementById("disableButton").style.display = "";
	//chrome.browserAction.setIcon({path: "/icons/off.png"});
	document.getElementById("extensionState").checked = null;
	
	document.getElementById("disableButton").onclick = function(event){
		event.stopPropagation()
		chrome.runtime.sendMessage({cmd: "setOnOffState", data: {value: !isExtensionOn}}, function (response) {
			chrome.runtime.lastError;
			update(response);
		});
		return false;
	};
	if (!ssapp) {
		const sourceSelector = document.getElementById('source-selector');
		
		if (!sourceSelector) {
		  console.error("Could not find source-selector element");
		} else {
			setupLazySourceSelect(sourceSelector);
		}
		
		const customInject = document.getElementById("custominject");
		if (customInject) {
			customInject.classList.remove("hidden");
		}
		const injectButton = document.getElementById('inject-button');
		if (injectButton) {
			injectButton.addEventListener('click', function() {
			  const sourceDropdown = document.getElementById('source-selector');
			  ensureLazySourcesLoaded(function() {
				  appendSourceOptions(sourceDropdown);
				  const source = sourceDropdown ? sourceDropdown.value : '';

				  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
					chrome.runtime.sendMessage({
					  type: 'injectCustomSource',
					  source: source,
					  tabId: tabs[0].id
					});
				  });
			  });
			});
		}
	}
	
	document.getElementById('addCustomGifCommand').addEventListener('click', function() {
		const commandsList = document.getElementById('customGifCommandsList');
		if (commandsList && commandsList.querySelectorAll('.custom-gif-command-entry').length >= CUSTOM_GIF_COMMAND_LIMIT) {
			alert('Custom GIF Commands are limited to 20 entries.');
			return;
		}
		const newCommandEntry = createCommandEntry();
		commandsList.appendChild(newCommandEntry);
		updateSettings(newCommandEntry, true);
	});
	
	document.querySelectorAll("[data-copy]").forEach(ele=>{
		ele.onclick = copyToClipboard;
	});

	moveChatOverlayThemeOptions();
	syncChatOverlayTemplateConfig(getSelectedChatOverlayTemplatePath());
	moveHypetrainOptionsIntoMetaSection();

	attachOverlayPreviewControls('multialerts', [
		{ id: 'multi-alert-preview-follow', descriptor: () => buildMultiAlertPreviewDescriptor('follow') },
		{ id: 'multi-alert-preview-sub', descriptor: () => buildMultiAlertPreviewDescriptor('subscription') },
		{ id: 'multi-alert-preview-dono', descriptor: () => buildMultiAlertPreviewDescriptor('donation') },
		{ id: 'multi-alert-preview-bits', descriptor: () => buildMultiAlertPreviewDescriptor('bits') },
		{ id: 'multi-alert-preview-raid', descriptor: () => buildMultiAlertPreviewDescriptor('raid') },
		{ id: 'multi-alert-preview-auction', descriptor: () => buildMultiAlertPreviewDescriptor('auction') },
		{ id: 'multi-alert-preview-hype', descriptor: () => buildMultiAlertPreviewDescriptor('hype') },
		{ id: 'multi-alert-preview-clear', descriptor: false }
	]);
	attachTipJarTestDonationButtons();

	var previewPlatformSelect = document.getElementById('multi-alert-preview-platform');
	if (previewPlatformSelect) {
		previewPlatformSelect.addEventListener('change', function() {
			var state = overlayPreviewState.multialerts;
			if (state?.pending && state.pending.category) {
				sendOverlayPreview('multialerts', buildMultiAlertPreviewDescriptor(state.pending.category));
			}
		});
	}

	var muteBtn = document.getElementById('multi-alert-preview-mute');
	if (muteBtn) {
		muteBtn.addEventListener('click', function() {
			var state = overlayPreviewState.multialerts;
			state.muted = !state.muted;
			muteBtn.textContent = state.muted ? '🔇' : '🔊';
			muteBtn.style.opacity = state.muted ? '1' : '0.6';
		});
	}
	
	
	try {
		
		
		const textInputs = document.querySelectorAll('.textInputContainer');
		textInputs.forEach(container => {
		  const input = container.querySelector('.textInput');
		  if (!input) return;
		  
		  const id = input.id;
		  if (userTypes.includes(id)) {
			input.classList.add('hidden');
			
			const listContainer = document.createElement('div');
			listContainer.className = 'username-list-container';
			listContainer.id = `${id}List`;
			
			const addContainer = document.createElement('div');
			addContainer.className = 'add-username-container';
			
			addContainer.innerHTML = `
				<input type="text" id="new${id}" placeholder="Add username">
				<input type="text" id="new${id}Type" placeholder="Source type (optional)" list="popupSourceTypesList">
				<button id="add${id}">Add</button>
			`;
			
			container.parentNode.classList.add("isolate");
			container.parentNode.insertBefore(listContainer, container.nextSibling);
			container.parentNode.insertBefore(addContainer, listContainer.nextSibling);
			setupLazySourceInput(document.getElementById(`new${id}Type`));
		  }
		});
		
		userTypes.forEach(type => {
		  try {
			document.getElementById(`${type}List`).addEventListener('click', (e) => {
			  if (e.target.classList.contains('remove-username')) {
				removeUsername(
				  e.target.dataset.username,
				  e.target.dataset.sourceType,
				  type
				);
			  }
			});

			document.getElementById(`add${type}`).addEventListener('click', () => {
			  const input = document.getElementById(`new${type}`);
			  const username = input.value.trim();
			  if (username) {
				addUsername(username, type);
				input.value = '';
				const sourceInput = document.getElementById(`new${type}Type`);
				if (sourceInput) {
				  sourceInput.value = '';
				}
			  }
			});
		  } catch(e) {
			console.error(e);
		  }
		});
		
	} catch(e){
		console.error(e);
	}

	try {
		
		const textInputs = document.querySelectorAll('.textInputContainer');
		textInputs.forEach(container => {
			const input = container.querySelector('.textInput');
			if (!input) return;
			
			const id = input.id;
			if (sourceTypes.includes(id)) {
				input.classList.add('hidden');
				
				const listContainer = document.createElement('div');
				listContainer.className = 'source-list-container';
				listContainer.id = `${id}List`;
				
				const addContainer = document.createElement('div');
				addContainer.className = 'add-source-container';
				
				addContainer.innerHTML = `
					<input type="text" id="new${id}Type" placeholder="Source type" list="popupSourceTypesList">
					<button id="add${id}">Add</button>
				`;
				
				container.parentNode.classList.add("isolate");
				container.parentNode.insertBefore(listContainer, container.nextSibling);
				container.parentNode.insertBefore(addContainer, listContainer.nextSibling);
				setupLazySourceInput(document.getElementById(`new${id}Type`));
			}
		});
		
		sourceTypes.forEach(type => {
			try {
				document.getElementById(`${type}List`).addEventListener('click', (e) => {
					if (e.target.classList.contains('remove-source')) {
						removeSourceType(
							e.target.dataset.sourceType,
							type
						);
					}
				});
				document.getElementById(`add${type}`).addEventListener('click', () => {
					const input = document.getElementById(`new${type}Type`);
					const sourceType = input.value.trim();
					if (sourceType) {
						addSourceType(sourceType, type);
						input.value = '';
					}
				});
			} catch(e) {
				console.error(e);
			}
		});
		
	} catch(e){
		console.error(e);
	}
	
	// Setup source selection for bot reply inputs - simple approach without MutationObserver
	try {
		// Just setup any existing bot reply source inputs on page load
		setTimeout(() => {
			document.querySelectorAll('[id^="botReplyMessageSource"]').forEach(input => {
				if (input.id) {
					setupSourceSelection(input.id);
				}
			});
		}, 200);
		
	} catch(e) {
		console.error("Error setting up bot reply source selection:", e);
	}
	
	// Initialize existing username lists
/* 	userTypes.forEach(type => {
	  try {
		updateUsernameList(type);
	  } catch(e) {
		console.error(e);
	  }
	});
	
	// Initialize existing source type lists
	sourceTypes.forEach(type => {
		try {
			updateSourceTypeList(type);
		} catch(e) {
			console.error(e);
		}
	}); */
	
	setupLazyFontDropdowns();
	setTimeout(function(){
		if (typeof PollManager !== 'undefined') {
			PollManager.init();
		}
	},1000);
	
	if (typeof TTSManager !== 'undefined') {
		try {
			TTSManager.init([]);
		} catch(e){
			console.error(e);
		}
	}

	setupLazySystemVoiceDropdowns();

	var popupSearchInput = document.getElementById('searchInput');
	var popupSearchHiddenClass = 'popup-search-hidden';
	var popupSearchOpenState = null;
	var popupSearchLockedWidth = null;
	var popupSearchIndex = null;
	var popupSearchTimer = null;

	function normalizePopupSearchText(value) {
		return String(value || '').toLowerCase().replace(/[_\-\u2010-\u2015]+/g, ' ').replace(/\s+/g, ' ').trim();
	}

	function getPopupSearchTerms(value) {
		var normalized = normalizePopupSearchText(value);
		return normalized ? normalized.split(' ') : [];
	}

	function addPopupSearchPart(parts, value) {
		value = normalizePopupSearchText(value);
		if (value) {
			parts.push(value);
		}
	}

	function addPopupSearchVisibleText(parts, element) {
		if (!element) {
			return;
		}
		var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
		var node;
		while ((node = walker.nextNode())) {
			if (node.parentElement && !shouldSkipPopupSearchText(node.parentElement) && !isPopupSearchNormallyHidden(node.parentElement)) {
				addPopupSearchPart(parts, node.nodeValue);
			}
		}
	}

	function shouldSkipPopupSearchText(element) {
		if (!element) {
			return true;
		}
		if (/^(script|style|template|option|br)$/i.test(element.tagName || '')) {
			return true;
		}
		return !!(element.closest && element.closest('.link-help-content, option, script, style, template'));
	}

	function addPopupSearchSynonyms(parts) {
		var text = parts.join(' ');
		var synonyms = [];
		if (/\bstroke\b|\boutline\b|\bborder\b|\bline\b/.test(text)) {
			synonyms.push('stroke outline border line edge');
		}
		if (/\bshadow\b|\bglow\b|\bhalo\b|\bdepth\b/.test(text)) {
			synonyms.push('shadow glow halo depth');
		}
		if (/\bcolor\b|\bcolour\b|\bhue\b|\bbackground\b|\bpagebg\b|\bchroma\b|\btextcolor\b|\bnamecolor\b|\bstroke\b|\bglow\b/.test(text)) {
			synonyms.push('color colour hue background foreground fill text page chroma stroke glow');
		}
		if (synonyms.length) {
			parts.push(synonyms.join(' '));
		}
	}

	function addPopupSearchAttributes(parts, element) {
		if (!element || !element.attributes) {
			return;
		}
		for (var i = 0; i < element.attributes.length; i++) {
			var attr = element.attributes[i];
			if (!attr || attr.name === 'style' || attr.name === 'class') {
				continue;
			}
			if (attr.name === 'data-keywords' || attr.name === 'data-search') {
				addPopupSearchPart(parts, attr.value);
				continue;
			}
			if (attr.name === 'title' || attr.name === 'aria-label' || attr.name === 'alt' || attr.name === 'placeholder') {
				if (attr.name === 'title' && /(must first interact|lookup first)/i.test(attr.value || '')) {
					continue;
				}
				addPopupSearchPart(parts, attr.value);
			}
		}
	}

	function getPopupSearchText(element) {
		var parts = [];
		if (!element) {
			return '';
		}
		addPopupSearchVisibleText(parts, element);
		addPopupSearchAttributes(parts, element);

		var searchable = element.querySelectorAll('[title], [aria-label], [alt], [data-keywords], [data-search], input, textarea, select, label, img');
		searchable.forEach(function(child) {
			addPopupSearchAttributes(parts, child);
		});
		addPopupSearchSynonyms(parts);
		return parts.join(' ');
	}

	function getPopupSectionSearchText(wrapper) {
		var parts = [];
		var label = wrapper ? wrapper.querySelector('.collapsible-label') : null;
		if (label) {
			addPopupSearchPart(parts, label.textContent);
			addPopupSearchAttributes(parts, label);
		}
		return parts.join(' ');
	}

	function popupSearchEscapeRegex(value) {
		return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function popupSearchTextHasTerm(searchText, term) {
		if (/^[a-z0-9]+$/.test(term)) {
			return new RegExp('(^|[^a-z0-9])' + popupSearchEscapeRegex(term)).test(searchText);
		}
		return searchText.indexOf(term) !== -1;
	}

	function popupSearchTextMatches(searchText, terms) {
		for (var i = 0; i < terms.length; i++) {
			if (!popupSearchTextHasTerm(searchText, terms[i])) {
				return false;
			}
		}
		return true;
	}

	function clearPopupSearchHidden() {
		document.querySelectorAll('.' + popupSearchHiddenClass).forEach(function(element) {
			element.classList.remove(popupSearchHiddenClass);
		});
	}

	function setPopupSearchHidden(element, hidden) {
		if (!element) {
			return;
		}
		if (hidden) {
			element.classList.add(popupSearchHiddenClass);
		} else {
			element.classList.remove(popupSearchHiddenClass);
		}
	}

	function isPopupSearchNormallyHidden(element) {
		var node = element;
		while (node && node !== document.body) {
			if (node.classList && node.classList.contains(popupSearchHiddenClass)) {
				node = node.parentElement;
				continue;
			}
			if (window.getComputedStyle(node).display === 'none') {
				return true;
			}
			node = node.parentElement;
		}
		return false;
	}

	function savePopupSearchOpenState() {
		if (popupSearchOpenState) {
			return;
		}
		popupSearchOpenState = [];
		document.querySelectorAll('input.collapsible-input').forEach(function(input) {
			popupSearchOpenState.push({
				input: input,
				checked: input.checked
			});
		});
	}

	function openPopupSearchSections() {
		document.querySelectorAll('input.collapsible-input').forEach(function(input) {
			input.checked = true;
		});
	}

	function restorePopupSearchOpenState() {
		if (!popupSearchOpenState) {
			return;
		}
		popupSearchOpenState.forEach(function(state) {
			if (state.input) {
				state.input.checked = state.checked;
			}
		});
		popupSearchOpenState = null;
	}

	function lockPopupSearchWidth() {
		if (popupSearchLockedWidth) {
			return;
		}
		popupSearchLockedWidth = Math.ceil(document.documentElement.getBoundingClientRect().width || document.body.getBoundingClientRect().width);
		if (popupSearchLockedWidth) {
			document.documentElement.style.minWidth = popupSearchLockedWidth + 'px';
			document.body.style.minWidth = popupSearchLockedWidth + 'px';
		}
	}

	function unlockPopupSearchWidth() {
		if (!popupSearchLockedWidth) {
			return;
		}
		document.documentElement.style.minWidth = '';
		document.body.style.minWidth = '';
		popupSearchLockedWidth = null;
	}

	function getPopupSearchRows(wrapper) {
		var rows = wrapper.querySelectorAll('.options_group > *, .options_group > span > *, .options > :not(.options_group), .options > .overlay-config-section > *, .options_group > .game-config-section > *, .collapsible-text > :not(.options)');
		var filtered = [];
		function addRow(row) {
			if (!row.classList || row.classList.contains('options_group') || row.classList.contains('options') || /^(script|style|template|br)$/i.test(row.tagName || '')) {
				return;
			}
			if (filtered.indexOf(row) === -1) {
				filtered.push(row);
			}
		}
		rows.forEach(addRow);
		wrapper.querySelectorAll('.options_group > div').forEach(function(container) {
			if (container.querySelector(':scope > label.switch')) {
				return;
			}
			container.querySelectorAll(':scope > div, :scope > h3, :scope > p, :scope > span').forEach(addRow);
		});
		return filtered;
	}

	function createPopupSearchIndex() {
		var index = {
			links: [],
			wrappers: [],
			topLevel: []
		};

		document.querySelectorAll('.link').forEach(function(link) {
			if (!isPopupSearchNormallyHidden(link)) {
				index.links.push({
					element: link,
					text: getPopupSearchText(link)
				});
			}
		});

		document.querySelectorAll('.wrapper').forEach(function(wrapper) {
			if (isPopupSearchNormallyHidden(wrapper)) {
				return;
			}
			var rowElements = getPopupSearchRows(wrapper).filter(function(row) {
				return !isPopupSearchNormallyHidden(row);
			});
			var rows = rowElements.map(function(row) {
				return {
					element: row,
					text: getPopupSearchText(row),
					containerOnly: false
				};
			});
			rows.forEach(function(rowRecord) {
				rowRecord.containerOnly = rows.some(function(otherRecord) {
					return rowRecord.element !== otherRecord.element && rowRecord.element.contains(otherRecord.element);
				});
			});
			index.wrappers.push({
				element: wrapper,
				sectionText: getPopupSectionSearchText(wrapper),
				rows: rows
			});
		});

		document.querySelectorAll('.container > *').forEach(function(element) {
			if (element.classList && (element.classList.contains('wrapper') || element.classList.contains('link'))) {
				return;
			}
			if (!isPopupSearchNormallyHidden(element)) {
				index.topLevel.push({
					element: element,
					text: getPopupSearchText(element)
				});
			}
		});

		return index;
	}

	function preparePopupSearchIndex() {
		if (popupSearchIndex) {
			return;
		}
		clearPopupSearchHidden();
		var openStates = [];
		document.querySelectorAll('input.collapsible-input').forEach(function(input) {
			openStates.push({
				input: input,
				checked: input.checked
			});
			input.checked = true;
		});
		popupSearchIndex = createPopupSearchIndex();
		openStates.forEach(function(state) {
			state.input.checked = state.checked;
		});
	}

	function popupSearchRecordMatches(record, terms) {
		return popupSearchTextMatches(record.text || '', terms);
	}

	function updatePopupSearchGroups(wrapper) {
		wrapper.querySelectorAll('.options_group').forEach(function(group) {
			if (isPopupSearchNormallyHidden(group)) {
				return;
			}
			var visibleRows = 0;
			group.querySelectorAll(':scope > div').forEach(function(row) {
				if (!isPopupSearchNormallyHidden(row) && !row.classList.contains(popupSearchHiddenClass)) {
					visibleRows += 1;
				}
			});
			setPopupSearchHidden(group, visibleRows === 0);
		});
	}

	function updatePopupSearchTopLevel(terms) {
		if (!popupSearchIndex) {
			return 0;
		}
		var matched = 0;
		popupSearchIndex.topLevel.forEach(function(record) {
			var isMatch = popupSearchRecordMatches(record, terms);
			setPopupSearchHidden(record.element, !isMatch);
			if (isMatch) {
				matched += 1;
			}
		});
		return matched;
	}

	function setPopupSearchActive(active, empty) {
		document.body.classList.toggle('popup-searching', !!active);
		document.body.classList.toggle('popup-search-empty', !!active && !!empty);
	}

	function applyPopupSearchNow(value) {
		var terms = getPopupSearchTerms(value);
		clearPopupSearchHidden();

		if (!terms.length) {
			setPopupSearchActive(false, false);
			restorePopupSearchOpenState();
			unlockPopupSearchWidth();
			return;
		}

		setPopupSearchActive(true, false);
		savePopupSearchOpenState();
		lockPopupSearchWidth();
		openPopupSearchSections();
		if (!popupSearchIndex) {
			popupSearchIndex = createPopupSearchIndex();
		}

		var totalMatches = 0;

		popupSearchIndex.links.forEach(function(record) {
			var isMatch = popupSearchRecordMatches(record, terms);
			setPopupSearchHidden(record.element, !isMatch);
			if (isMatch) {
				totalMatches += 1;
			}
		});

		popupSearchIndex.wrappers.forEach(function(wrapperRecord) {
			var wrapper = wrapperRecord.element;
			var rows = wrapperRecord.rows;
			var matchedRows = [];
			var sectionMatches = popupSearchTextMatches(wrapperRecord.sectionText, terms);
			rows.forEach(function(rowRecord) {
				if (!rowRecord.containerOnly && popupSearchRecordMatches(rowRecord, terms)) {
					matchedRows.push(rowRecord);
				}
			});
			rows.forEach(function(rowRecord) {
				var keep = matchedRows.indexOf(rowRecord) !== -1;
				for (var i = 0; !keep && i < matchedRows.length; i++) {
					keep = rowRecord.element.contains(matchedRows[i].element);
				}
				setPopupSearchHidden(rowRecord.element, !keep);
			});
			matchedRows.forEach(function(rowRecord) {
				var parent = rowRecord.element.parentElement;
				while (parent && parent !== wrapper) {
					parent.classList.remove(popupSearchHiddenClass);
					parent = parent.parentElement;
				}
			});
			updatePopupSearchGroups(wrapper);

			var wrapperVisible = !(matchedRows.length === 0 && !(rows.length === 0 && sectionMatches));
			setPopupSearchHidden(wrapper, !wrapperVisible);
			if (wrapperVisible) {
				totalMatches += 1;
			}
		});
		totalMatches += updatePopupSearchTopLevel(terms);

		setPopupSearchActive(true, totalMatches === 0);
	}

	function applyPopupSearch(value) {
		if (popupSearchTimer) {
			clearTimeout(popupSearchTimer);
		}
		popupSearchTimer = setTimeout(function() {
			popupSearchTimer = null;
			applyPopupSearchNow(value);
		}, 60);
	}

	function closePopupSearch() {
		if (popupSearchTimer) {
			clearTimeout(popupSearchTimer);
			popupSearchTimer = null;
		}
		if (popupSearchInput) {
			popupSearchInput.value = '';
			popupSearchInput.style.display = 'none';
			popupSearchInput.style.width = '0';
		}
		clearPopupSearchHidden();
		setPopupSearchActive(false, false);
		restorePopupSearchOpenState();
		unlockPopupSearchWidth();
		popupSearchIndex = null;
	}

	if (popupSearchInput) {
		popupSearchInput.addEventListener('input', function() {
			applyPopupSearch(this.value);
		});
		popupSearchInput.addEventListener('keyup', function(e) {
			if (e.key === 'Escape') {
				closePopupSearch();
			}
		});
	}
	
	document.getElementById('searchIcon').addEventListener('click', function() {
		var searchInput = popupSearchInput || document.getElementById('searchInput');
		if (searchInput.style.display === 'none' || searchInput.style.display === '') {
			searchInput.style.display = 'block';
			searchInput.style.width = 'calc(100% - 35px)'; // Match this with your CSS width
			searchInput.focus(); // Optional: Focus on the input field when it's shown
			setTimeout(preparePopupSearchIndex, 0);
		} else {
			closePopupSearch();
		}
	});
	
	var activeToggle = false;
	document.getElementById('activeIcon').addEventListener('click', function() {
		activeToggle = !activeToggle;
		if (activeToggle) {
			// Open all collapsible sections
			document.querySelectorAll('input.collapsible-input').forEach(ele => {
				ele.checked = true;
			});
			
			document.querySelectorAll('button:not(.showalways)').forEach(function(item) {
				item.style.display = 'none';
			});

			document.querySelectorAll('.wrapper').forEach(w => {
				var menuItems = w.querySelectorAll('.options_group > div');
				var matches = 0;
				menuItems.forEach(function(item) {
					var checkbox = item.querySelector('input[type="checkbox"]');
					var textInput = item.querySelector('input[type="text"], input[type="password"], input[type="number"]');
					
					var isActive = false;

					if (checkbox && checkbox.checked) {
						isActive = true;
					} else if (textInput) {
						var associatedToggle = item.querySelector('input[type="checkbox"]');
						if (associatedToggle && associatedToggle.checked && textInput.value.trim() !== '') {
							isActive = true;
						} else if (!associatedToggle && textInput.value.trim() !== '') {
							isActive = true;
						}
					}

					if (isActive) {
						matches += 1;
						item.style.display = '';
					} else {
						item.style.display = 'none';
					}
				});
				
				if (!matches) {
					w.style.display = "none";
				} else {
					w.style.display = "";
				}
			});
		} else {
			
			document.querySelectorAll('button:not(.showalways)').forEach(function(item) {
				item.style.display = '';
			});
			// Reset to original state
			document.querySelectorAll('input.collapsible-input').forEach(ele => {
				ele.checked = false;
			});
			document.querySelectorAll('.wrapper').forEach(ele => {
				ele.style.display = "";
			});
			document.querySelectorAll('.options_group > div').forEach(ele => {
				ele.style.display = "";
			});
		}
	});
	
	const uploadBadwordsButton = document.getElementById('uploadBadwordsButton');
	const deleteBadwordsButton = document.getElementById('deleteBadwordsButton');
	if (uploadBadwordsButton) {
		uploadBadwordsButton.addEventListener('click', uploadBadwordsFile);
	}
	if (deleteBadwordsButton) {
		deleteBadwordsButton.addEventListener('click', deleteBadwordsFile);
	}

	const testSelectedLLMProviderButton = document.getElementById('testSelectedLLMProvider');
	if (testSelectedLLMProviderButton) {
		testSelectedLLMProviderButton.addEventListener('click', testSelectedLLMProvider);
	}
	const refreshOpenCodeModelsButton = document.getElementById('refreshOpenCodeModels');
	if (refreshOpenCodeModelsButton) {
		refreshOpenCodeModelsButton.addEventListener('click', function() {
			loadOpenCodeModels(true);
		});
	}
	const opencodeApiKeyInput = document.querySelector("[data-textsetting='opencodeApiKey']");
	if (opencodeApiKeyInput) {
		opencodeApiKeyInput.addEventListener('change', function() {
			loadOpenCodeModels(true);
		});
	}
	
	const ragEnabledCheckbox = document.getElementById('ollamaRagEnabled');
	const ragFileManagement = document.getElementById('ragFileManagement');

	ragEnabledCheckbox.addEventListener('change', function() {
		ragFileManagement.style.display = this.checked ? 'block' : 'none';
	});

	// Points System button handlers
	const manageUserPointsBtn = document.getElementById('manageUserPoints');
	if (manageUserPointsBtn) {
		manageUserPointsBtn.addEventListener('click', async function() {
			const username = await prompt("Enter username to manage points for:");
			if (!username) return;
			
			const action = await prompt("Enter action (add/subtract/set):");
			if (!action || !['add', 'subtract', 'set'].includes(action.toLowerCase())) {
				alert("Invalid action. Please use 'add', 'subtract', or 'set'.");
				return;
			}
			
			const pointsStr = await prompt(`Enter points to ${action}:`);
			const points = parseInt(pointsStr);
			if (isNaN(points)) {
				alert("Invalid points value. Please enter a number.");
				return;
			}
			
				if (confirm(`Are you sure you want to ${action} ${points} points ${action === 'subtract' ? 'from' : 'to'} ${username}?`)) {
					chrome.runtime.sendMessage({
						cmd: "manageUserPoints",
						username: username,
						action: action.toLowerCase(),
						points: points
					}, function(response) {
						if (response && response.success) {
							const available = Number.isFinite(response?.available) ? response.available : undefined;
							const total = Number.isFinite(response?.points) ? response.points : undefined;
							let summary = `Successfully ${action === 'set' ? 'set' : action + 'ed'} ${points} points ${action === 'subtract' ? 'from' : 'for'} ${username}.`;
							if (available !== undefined) summary += ` Available: ${available}`;
							if (total !== undefined) summary += ` | Total: ${total}`;
							alert(summary);
						} else {
							alert(response.error || 'Failed to manage points. Please try again.');
						}
					});
				}
		});
	}

		const viewPointsLeaderboardBtn = document.getElementById('viewPointsLeaderboard');
		if (viewPointsLeaderboardBtn) {
			viewPointsLeaderboardBtn.addEventListener('click', function() {
				const leaderboardLink = document.getElementById('leaderboardlink');
				const leaderboardContainer = document.getElementById('leaderboard');
				const fallbackUrl = chrome.runtime.getURL('leaderboard.html');
				const baseHref = leaderboardLink?.href || leaderboardContainer?.raw || fallbackUrl;
				let resolvedUrl;

				try {
					resolvedUrl = new URL(baseHref, fallbackUrl);
				} catch (error) {
					resolvedUrl = new URL(fallbackUrl);
				}

				resolvedUrl.searchParams.set('rankby', 'loyalty');
				if (!resolvedUrl.searchParams.has('title')) {
					resolvedUrl.searchParams.set('title', 'Points Leaderboard');
				}

				chrome.tabs.create({
					url: resolvedUrl.toString()
				});
			});
		}

		const resetPointsBtn = document.getElementById('resetPoints');
	if (resetPointsBtn) {
		resetPointsBtn.addEventListener('click', async function() {
			if (confirm('Are you sure you want to reset all user points? This cannot be undone.')) {
				chrome.runtime.sendMessage({
					cmd: "resetAllPoints"
				}, function(response) {
					if (response && response.success) {
						alert('All user points have been reset.');
					} else {
						alert('Failed to reset points. Please try again.');
					}
				});
			}
		});
	}

	// Export Points Data
	const exportPointsBtn = document.getElementById('exportPointsData');
	if (exportPointsBtn) {
		exportPointsBtn.addEventListener('click', async function() {
			exportPointsBtn.disabled = true;
			exportPointsBtn.textContent = 'Exporting...';

			chrome.runtime.sendMessage({
				cmd: "exportPointsData"
			}, function(response) {
				exportPointsBtn.disabled = false;
				exportPointsBtn.textContent = 'Export Points';

				if (response && response.success && response.data) {
					// Create and trigger download
					const blob = new Blob([response.data], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `points-backup-${new Date().toISOString().split('T')[0]}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					const data = JSON.parse(response.data);
					alert(`Exported ${data.userCount} users successfully!`);
				} else {
					alert('Failed to export points data: ' + (response?.error || 'Unknown error'));
				}
			});
		});
	}

	// Import Points Data
	const importPointsBtn = document.getElementById('importPointsData');
	const importPointsFile = document.getElementById('importPointsFile');

	if (importPointsBtn && importPointsFile) {
		importPointsBtn.addEventListener('click', function() {
			importPointsFile.click();
		});

		importPointsFile.addEventListener('change', async function(e) {
			const file = e.target.files[0];
			if (!file) return;

			// Ask for import mode
			const mode = confirm(
				'Import Mode:\n\n' +
				'OK = Merge (keep higher point values)\n' +
				'Cancel = Replace (overwrite all data)\n\n' +
				'Choose your import mode:'
			) ? 'merge' : 'replace';

			if (mode === 'replace') {
				if (!confirm('WARNING: Replace mode will overwrite all existing points data. Are you sure?')) {
					importPointsFile.value = '';
					return;
				}
			}

			importPointsBtn.disabled = true;
			importPointsBtn.textContent = 'Importing...';

			const reader = new FileReader();
			reader.onload = function(event) {
				chrome.runtime.sendMessage({
					cmd: "importPointsData",
					data: event.target.result,
					mode: mode
				}, function(response) {
					importPointsBtn.disabled = false;
					importPointsBtn.textContent = 'Import Points';
					importPointsFile.value = '';

					if (response && response.success) {
						alert(`Import complete!\n\nImported: ${response.imported}\nSkipped: ${response.skipped}\nErrors: ${response.errors || 0}`);
					} else {
						alert('Failed to import points data: ' + (response?.error || response?.message || 'Unknown error'));
					}
				});
			};

			reader.onerror = function() {
				importPointsBtn.disabled = false;
				importPointsBtn.textContent = 'Import Points';
				importPointsFile.value = '';
				alert('Failed to read file');
			};

			reader.readAsText(file);
		});
	}

	// Initialize Spotify section inputs and handle manual saving
	const spotifyClientIdInput = document.getElementById('spotifyClientId');
	const spotifyClientSecretInput = document.getElementById('spotifyClientSecret');
	
	// Manual save function for Spotify credentials
	function saveSpotifyCredentials() {
		const clientId = spotifyClientIdInput?.value?.trim();
		const clientSecret = spotifyClientSecretInput?.value?.trim();
		
		if (clientId || clientSecret) {
			chrome.runtime.sendMessage({
				cmd: "saveSetting",
				type: "textsetting",
				setting: "spotifyClientId",
				value: clientId
			});
			
			chrome.runtime.sendMessage({
				cmd: "saveSetting",  
				type: "textsetting",
				setting: "spotifyClientSecret",
				value: clientSecret
			});
			
			console.log('Spotify credentials saved');
		}
	}

	function sendSpotifyCommand(message, timeout = 20000) {
		return new Promise((resolve) => {
			let resolved = false;
			const skipTimeout = message?.cmd === 'spotifyAuth';
			let timer = null;
			if (!skipTimeout && typeof timeout === 'number' && timeout > 0) {
				timer = setTimeout(() => {
					if (!resolved) {
						resolved = true;
						resolve({ success: false, error: 'Command timed out' });
					}
				}, timeout);
			}

			chrome.runtime.sendMessage({ type: 'toBackground', data: message }, (response) => {
				if (!resolved) {
					resolved = true;
					if (timer) {
						clearTimeout(timer);
					}
					if (chrome.runtime.lastError) {
						console.error('Spotify command failed:', chrome.runtime.lastError);
						resolve({ success: false, error: chrome.runtime.lastError.message });
					} else {
						resolve(response);
					}
				}
			});
		});
	}

	// Save on input change
	if (spotifyClientIdInput) {
		spotifyClientIdInput.addEventListener('change', saveSpotifyCredentials);
		spotifyClientIdInput.addEventListener('blur', saveSpotifyCredentials);
	}
	
	if (spotifyClientSecretInput) {
		spotifyClientSecretInput.addEventListener('change', saveSpotifyCredentials);
		spotifyClientSecretInput.addEventListener('blur', saveSpotifyCredentials);
	}

	// Spotify Command Permissions
	function initSpotifyCommandSettings() {
		const commandRows = document.querySelectorAll('.spotify-command-row');
		if (!commandRows.length) return;

		// Load saved settings
		chrome.storage.local.get(['settings'], function(result) {
			// Settings stored as { json: string, object: parsed } - access .object
			const permissions = result.settings?.spotifyCommandPermissions?.object || {};
			const disabledCommands = result.settings?.spotifyDisabledCommands?.object || [];
			const customTriggers = result.settings?.spotifyCommandTriggers?.object || {};

			commandRows.forEach(row => {
				const command = row.dataset.command;
				const enabledCheckbox = row.querySelector('.spotify-cmd-enabled');
				const roleCheckboxes = row.querySelectorAll('.spotify-cmd-roles input[type="checkbox"]');
				const triggerInput = row.querySelector('.spotify-cmd-trigger');

				// Apply enabled state (default enabled unless explicitly disabled)
				if (enabledCheckbox) {
					enabledCheckbox.checked = !disabledCommands.includes(command);
				}

				// Apply role permissions (defaults from data attribute when not saved)
				const savedRoles = permissions[command] && permissions[command].length > 0 ? permissions[command] : null;
				const defaultRoles = row.dataset.defaultRoles ? row.dataset.defaultRoles.split(',') : [];
				const rolesToApply = savedRoles || defaultRoles;
				roleCheckboxes.forEach(cb => {
					cb.checked = rolesToApply.includes(cb.value);
				});

				// Apply custom triggers (fallback to default command)
				if (triggerInput) {
					triggerInput.value = customTriggers[command] || triggerInput.value || command;
				}
			});

		});

		// Save on change
		commandRows.forEach(row => {
			const enabledCheckbox = row.querySelector('.spotify-cmd-enabled');
			const roleCheckboxes = row.querySelectorAll('.spotify-cmd-roles input[type="checkbox"]');
			const triggerInput = row.querySelector('.spotify-cmd-trigger');

			if (enabledCheckbox) {
				enabledCheckbox.addEventListener('change', () => saveSpotifyCommandSettings());
			}
			roleCheckboxes.forEach(cb => {
				cb.addEventListener('change', () => saveSpotifyCommandSettings());
			});

			// Handle trigger input changes
			if (triggerInput) {
				const defaultTrigger = row.dataset.command;

				// On blur: revert to default if empty, then save
				triggerInput.addEventListener('blur', () => {
					const value = triggerInput.value.trim();
					if (!value) {
						triggerInput.value = defaultTrigger;
					}
					saveSpotifyCommandSettings();
				});

				// On Enter key: blur to trigger save
				triggerInput.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') {
						triggerInput.blur();
					}
				});
			}
		});
	}

	function saveSpotifyCommandSettings() {
		const commandRows = document.querySelectorAll('.spotify-command-row');
		const permissions = {};
		const disabledCommands = [];
		const customTriggers = {};

		commandRows.forEach(row => {
			const command = row.dataset.command;
			const enabledCheckbox = row.querySelector('.spotify-cmd-enabled');
			const roleCheckboxes = row.querySelectorAll('.spotify-cmd-roles input[type="checkbox"]:checked');
			const triggerInput = row.querySelector('.spotify-cmd-trigger');

			if (enabledCheckbox && !enabledCheckbox.checked) {
				disabledCommands.push(command);
			}

			// Collect all checked roles
			const roles = [];
			roleCheckboxes.forEach(cb => roles.push(cb.value));

			// If no roles selected, use default from data attribute
			if (roles.length === 0) {
				const defaultRoles = row.dataset.defaultRoles;
				if (defaultRoles) {
					roles.push(...defaultRoles.split(','));
				}
			}

			permissions[command] = roles;

			// Collect custom triggers (normalize: trim, lowercase, handle comma-separated)
			if (triggerInput) {
				const triggerValue = triggerInput.value.trim();
				// Only store if different from default
				if (triggerValue && triggerValue !== command) {
					customTriggers[command] = triggerValue;
				}
			}
		});

		// Save to storage
		chrome.runtime.sendMessage({
			cmd: "saveSetting",
			type: "json",
			setting: "spotifyCommandPermissions",
			value: JSON.stringify(permissions)
		});

		chrome.runtime.sendMessage({
			cmd: "saveSetting",
			type: "json",
			setting: "spotifyDisabledCommands",
			value: JSON.stringify(disabledCommands)
		});

		chrome.runtime.sendMessage({
			cmd: "saveSetting",
			type: "json",
			setting: "spotifyCommandTriggers",
			value: JSON.stringify(customTriggers)
		});

		console.log('Spotify command settings saved:', { permissions, disabledCommands, customTriggers });
	}

	// Initialize on page load
	initSpotifyCommandSettings();

	// Spotify Auth Button
	const spotifyAuthButton = document.getElementById('spotifyAuthButton');
	const spotifyAuthStatus = document.getElementById('spotifyAuthStatus');
	const spotifySignOutButton = document.getElementById('spotifySignOutButton');
	
	if (spotifyAuthButton) {
		// Check if already authenticated (tokens are stored in settings object)
		chrome.storage.local.get(['settings'], function(result) {
			if (result.settings && result.settings.spotifyAccessToken) {
				spotifyAuthStatus.style.display = 'inline';
				spotifyAuthButton.querySelector('span').textContent = '🔄 Reconnect';
				if (spotifySignOutButton) {
					spotifySignOutButton.style.display = 'inline-block';
				}
			}
		});
		
		// Manual callback helper (SSAPP primary, extension fallback when chrome.identity is unavailable)
		const callbackDiv = document.createElement('div');
		callbackDiv.style.marginTop = '10px';
		callbackDiv.style.display = 'none';
		callbackDiv.id = 'spotifyCallbackDiv';
		callbackDiv.innerHTML = `
			<p class="spotify-callback-helper" style="margin:6px 0; color:#bbb; font-size:0.9em;">
				If the authorization window doesn't close automatically, copy the entire URL you were redirected to (it contains <code>code=</code>) and paste it below.
			</p>
			<input type="text" id="spotifyCallbackInput" placeholder="Paste callback URL here" style="width: 100%; padding: 5px; margin: 5px 0;">
			<button id="spotifyCallbackSubmit" class="button">Complete Auth</button>
			<div id="spotifyManualLinkContainer" style="display:none; margin-top:10px;">
				<p style="color:#bbb; font-size:0.85em; margin-bottom:6px;">
					If no browser opened, copy this login link into Chrome/Edge, finish signing in, then paste the callback URL above:
				</p>
				<textarea id="spotifyManualAuthUrl" readonly style="width:100%; min-height:60px; resize:vertical; padding:5px; font-size:0.85em;"></textarea>
				<button id="spotifyManualCopy" type="button" class="button" style="margin-top:6px;">Copy Login Link</button>
			</div>
		`;
		spotifyAuthButton.parentElement.appendChild(callbackDiv);
		
		// Handle callback submission
		document.getElementById('spotifyCallbackSubmit')?.addEventListener('click', function() {
			const callbackUrl = document.getElementById('spotifyCallbackInput').value;
			if (callbackUrl && callbackUrl.includes('code=')) {
				let redirectUri = null;
				try {
					const parsed = new URL(callbackUrl);
					redirectUri = `${parsed.origin}${parsed.pathname}`;
				} catch (e) {
					console.warn('Failed to parse redirect URI from callback', e);
				}
				sendSpotifyCommand({
					cmd: "spotifyManualCallback",
					url: callbackUrl,
					redirectUri
					}).then(response => {
						console.log("Manual callback result:", response);
						if (response && response.success) {
							spotifyAuthStatus.style.display = 'inline';
							spotifyAuthButton.querySelector('span').textContent = '🔄 Reconnect';
						if (spotifySignOutButton) {
							spotifySignOutButton.style.display = 'inline-block';
							}
							callbackDiv.style.display = 'none';
							document.getElementById('spotifyCallbackInput').value = '';
							showSpotifyAuthToast('success', 'Spotify Connected', 'Spotify callback completed successfully.');
							alert('Spotify connected successfully!');
						} else {
							const errorCode = response?.errorCode || 'SPOTIFY_OAUTH_ERROR';
							const errorMsg = getSpotifyAuthErrorMessage(response);
							console.error(`Manual Spotify callback failed [${errorCode}]:`, errorMsg, response);
							const composed = `[${errorCode}] ${errorMsg}`;
							showSpotifyAuthToast('error', 'Spotify Callback Error', composed);
							alert('Failed to process callback: ' + composed + '\n\n' + getSpotifyAuthTroubleshootingText(response));
						}
					});
			} else {
				alert('Please paste the complete callback URL');
			}
		});
		
		const manualCopyButton = document.getElementById('spotifyManualCopy');
		if (manualCopyButton) {
			manualCopyButton.addEventListener('click', async () => {
				const manualUrlField = document.getElementById('spotifyManualAuthUrl');
				if (!manualUrlField || !manualUrlField.value) {
					alert('A manual login link is not available yet. Try reconnecting first.');
					return;
				}
				try {
					if (navigator.clipboard && navigator.clipboard.writeText) {
						await navigator.clipboard.writeText(manualUrlField.value);
					} else {
						manualUrlField.select();
						document.execCommand('copy');
					}
					alert('Login link copied! Paste it into your regular browser to continue.');
				} catch (err) {
					console.error('Failed to copy Spotify login link:', err);
					alert('Copy failed. Please select and copy the link manually.');
				}
			});
		}
		
		spotifyAuthButton.addEventListener('click', async function() {
			// Prevent multiple clicks
			if (spotifyAuthButton.disabled) {
				console.log('Spotify auth already in progress');
				return;
			}
			
			// Disable button during auth
			spotifyAuthButton.disabled = true;
			spotifyAuthButton.querySelector('span').textContent = '⏳ Connecting...';
			
			console.log('Attempting Spotify auth...');
			
			const response = await sendSpotifyCommand({ cmd: "spotifyAuth" });
			handleSpotifyAuthResponse(response);
			
				function handleSpotifyAuthResponse(response) {
					console.log('Spotify auth response received:', response);
					spotifyAuthButton.disabled = false;
					const callbackDiv = document.getElementById('spotifyCallbackDiv');
					const manualLinkContainer = document.getElementById('spotifyManualLinkContainer');
					const manualLinkField = document.getElementById('spotifyManualAuthUrl');

					if (response && response.success) {
						spotifyAuthStatus.style.display = 'inline';
						spotifyAuthButton.querySelector('span').textContent = '🔄 Reconnect';
						if (spotifySignOutButton) {
							spotifySignOutButton.style.display = 'inline-block';
						}

						if (callbackDiv) {
							callbackDiv.style.display = 'none';
							document.getElementById('spotifyCallbackInput').value = '';
							if (manualLinkContainer) {
								manualLinkContainer.style.display = 'none';
							}
							if (manualLinkField) {
								manualLinkField.value = '';
							}
						}

						if (response.alreadyConnected) {
							console.log('Already connected to Spotify');
						} else if (response.message && response.message.includes('authorization')) {
							// For SSAPP, the OAuth window opened - wait for callback.
							console.log('OAuth window opened - waiting for authorization');
							spotifyAuthButton.querySelector('span').textContent = '⏳ Waiting for authorization...';
							if (window.ssapp && callbackDiv) {
								setTimeout(() => {
									if (!spotifyAuthStatus.style.display || spotifyAuthStatus.style.display === 'none') {
										callbackDiv.style.display = 'block';
										console.log('If the authorization window is stuck, you can paste the callback URL manually.');
									}
								}, 5000);
							}
						}

						if (response?.warning) {
							alert('Spotify connected, but playback access is limited:\n\n' + response.warning);
						}
					} else if (response?.waitingForManualCallback || response?.waitingForCallback) {
						spotifyAuthButton.disabled = true;
						const waitingForManual = !!response.waitingForManualCallback;
						spotifyAuthButton.querySelector('span').textContent = '⏳ Waiting for authorization...';

						if (callbackDiv) {
							callbackDiv.style.display = waitingForManual ? 'block' : 'none';
							if (!waitingForManual) {
								const callbackInput = document.getElementById('spotifyCallbackInput');
								if (callbackInput) {
									callbackInput.value = '';
								}
							}
						}

						if (manualLinkContainer) {
							if (response?.manualAuthUrl && waitingForManual) {
								manualLinkContainer.style.display = 'block';
								if (manualLinkField) {
									manualLinkField.value = response.manualAuthUrl;
								}
							} else {
								manualLinkContainer.style.display = 'none';
								if (manualLinkField) {
									manualLinkField.value = '';
								}
							}
						}

						const waitMessage = response.message || (waitingForManual
							? 'After authorizing Spotify in the browser window, paste the callback URL into Social Stream Ninja.'
							: 'Please finish the Spotify login in the newly opened tab.');

						console.log(waitMessage);
						showSpotifyAuthToast('info', 'Spotify OAuth', waitMessage);
						if (waitingForManual) {
							alert(waitMessage);
						}
					} else {
						spotifyAuthButton.querySelector('span').textContent = '🔗 Connect to Spotify';
						const errorCode = response?.errorCode || 'SPOTIFY_OAUTH_ERROR';
						const errorMsg = getSpotifyAuthErrorMessage(response);
						console.error(`Spotify auth failed [${errorCode}]:`, errorMsg, response);

						// Show manual callback input if the background specifically asked for manual completion.
						if (callbackDiv && (response?.needsManualCallback || response?.waitingForManualCallback)) {
							callbackDiv.style.display = 'block';
							console.log('Please paste the callback URL manually.');
						}

						if (manualLinkContainer) {
							if (response?.manualAuthUrl) {
								manualLinkContainer.style.display = 'block';
								if (manualLinkField) {
									manualLinkField.value = response.manualAuthUrl;
								}
							} else {
								manualLinkContainer.style.display = 'none';
								if (manualLinkField) {
									manualLinkField.value = '';
								}
							}
						}

						if (errorMsg !== 'Already connected') {
							const composed = `[${errorCode}] ${errorMsg}`;
							showSpotifyAuthToast('error', 'Spotify OAuth Error', composed);
							alert('Failed to connect to Spotify. Error: ' + composed + '\n\n' + getSpotifyAuthTroubleshootingText(response));
						}
					}
				}
			});
	}
	
	// Spotify Sign Out Button
	if (spotifySignOutButton) {
		spotifySignOutButton.addEventListener('click', function() {
			if (confirm('Are you sure you want to sign out of Spotify?')) {
				// Send message to background script to clear Spotify tokens
				sendSpotifyCommand({ cmd: "spotifySignOut" }).then(response => {
					if (response && response.success) {
						// Update UI
						spotifyAuthStatus.style.display = 'none';
						spotifySignOutButton.style.display = 'none';
						spotifyAuthButton.querySelector('span').textContent = '🔗 Connect to Spotify';
						
						// Clear any manual callback inputs if present
						const callbackDiv = document.getElementById('spotifyCallbackDiv');
						if (callbackDiv) {
							callbackDiv.style.display = 'none';
							const callbackInput = document.getElementById('spotifyCallbackInput');
							if (callbackInput) {
								callbackInput.value = '';
							}
						}
						
						console.log('Successfully signed out of Spotify');
						alert('Successfully signed out of Spotify');
					} else {
						alert('Failed to sign out: ' + (response?.error || 'Unknown error'));
					}
				});
			}
		});
	}
	
	// Spotify Setup Guide Button
	const spotifySetupGuide = document.getElementById('spotifySetupGuide');
	if (spotifySetupGuide) {
		spotifySetupGuide.addEventListener('click', function() {
			// Open spotify.html in a new tab to show setup instructions
			const spotifyGuideUrl = chrome.runtime.getURL('spotify.html');
			chrome.tabs.create({ url: spotifyGuideUrl });
		});
	}

	let retryCount = 0;
	const MAX_RETRIES = 60; // 30 seconds at 500ms intervals

	let initialSetup = setInterval(()=>{
		if (retryCount++ > MAX_RETRIES) {
			clearInterval(initialSetup);
			log("getSettings gave up after max retries");
			return;
		}
		log("pop up asking main for settings yet again..");
		chrome.runtime.sendMessage({cmd: "getSettings"}, (response) => {
			chrome.runtime.lastError;
			log("getSettings response",response);
			if (!hydratePopupFromStartupSettings(response)){
				// keep polling
			} else {
				clearInterval(initialSetup);
			}
		});
	}, 500);
	
	log("pop up asking main for settings");
	chrome.runtime.sendMessage({cmd: "getSettings"}, (response) => {
		chrome.runtime.lastError;
		log("getSettings response",response);
		if (!hydratePopupFromStartupSettings(response)){
			
		} else {
			clearInterval(initialSetup);
		}
	});

	//botReplyAll
	var iii = document.querySelectorAll("input[type='checkbox']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}

	var iii = document.querySelectorAll("input[type='text'],textarea");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}
	var iii = document.querySelectorAll("input[type='text'][class*='instant']");
	for (var i=0;i<iii.length;i++){
		iii[i].oninput = updateSettings;
	}
	
	var iii = document.querySelectorAll("input[type='range']");
	for (var i=0;i<iii.length;i++){
		updateRangeDisplay(iii[i]);
		iii[i].dataset.rangePrevValue = iii[i].value;
		iii[i].oninput = handleRangeInput;
		iii[i].onchange = handleRangeInput;
	}
	
	var iii = document.querySelectorAll("input[type='number']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}
	var iii = document.querySelectorAll("input[type='password']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}
	var iii = document.querySelectorAll("input[type='color']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings; 
	}
	
	var iii = document.querySelectorAll("select");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}

	updateVideoStatsSettingsVisibility();
	setupFirstTimerControls();

	setupDeferredCustomCssFlush();
	
	// Override the language selector handler to reload the page
	const languageSelectOverride = document.querySelector('select[data-optionsetting="translationlanguage"]');
	if (languageSelectOverride) {
		console.log("Language selector found, attaching handler");
		languageSelectOverride.onchange = function(e) {
			console.log("Language changed to:", this.value);
			// Show a message that the page needs to reload
			const small = this.parentElement.querySelector('small');
			if (small) {
				small.style.color = '#ff0';
				small.style.fontWeight = 'bold';
			}
			savePopupTranslationLanguage(this.value);
		};
	} else {
		console.log("Language selector NOT found!");
	}
	
	// Handle featured preset selector
	const presetSelector = document.getElementById('featured-preset-select');
	if (presetSelector) {
		presetSelector.addEventListener('change', function() {
			applyFeaturedOverlayPreset(this.value);
		});
	}

	// Games preset selector handler
	const gamesSelector = document.getElementById('games-preset-select');
	if (gamesSelector) {
		gamesSelector.addEventListener('change', function() {
			const overlayDiv = document.getElementById('games');
			const overlayLink = document.getElementById('gameslink');
			
			if (!overlayDiv || !overlayLink) return;
			
			// Hide all game config sections
			document.querySelectorAll('.game-config-section').forEach(section => {
				section.style.display = 'none';
			});

			const battleOptionsWrapper = document.getElementById('battle-options-wrapper');
			const gamesOptionsToggle = document.getElementById('wrapper-games-general-options');
			const gamesOptionsWrapper = gamesOptionsToggle ? gamesOptionsToggle.closest('.wrapper') : null;
			if (battleOptionsWrapper) {
				battleOptionsWrapper.style.display = 'none';
			}
			if (gamesOptionsWrapper) {
				gamesOptionsWrapper.style.display = '';
			}
			overlayLink.style.display = '';

			const getGameBaseParams = function(rawUrl) {
				const keepParams = ['session', 'room', 'password', 'server', 'v'];
				const cleanParams = new URLSearchParams();
				if (rawUrl && rawUrl.includes('?')) {
					const params = new URLSearchParams(rawUrl.split('?')[1]);
					keepParams.forEach(function(key) {
						params.getAll(key).forEach(function(value) {
							cleanParams.append(key, value);
						});
					});
				}
				return cleanParams.toString();
			};

			const updateGamesLink = function() {
				overlayLink.href = overlayDiv.raw;
				overlayLink.innerText = document.body.classList.contains("hidelinks") ? "Click to open link" : overlayDiv.raw;
			};

			const applyCheckedGameParams = function(container) {
				if (!container) return;
				container.querySelectorAll('input[data-param20]:checked').forEach(function(input) {
					const paramValue = input.dataset.param20;
					if (!paramValue) return;
					const paramKey = normalizeParamKey(paramValue.split('=')[0]);
					overlayDiv.raw = removeQueryParamWithValue(overlayDiv.raw, paramKey);
					overlayDiv.raw = updateURL(paramValue, overlayDiv.raw);
				});
			};
			
			if (this.value) {
				// A game was selected
				const gameUrl = baseURL + this.value;

				const existingParams = getGameBaseParams(overlayDiv.raw);

				// Construct new URL preserving only shared connection/version parameters
				let newUrl = gameUrl;
				if (existingParams) {
					newUrl += '?' + existingParams;
				}
				
				// Update the overlay URL
				overlayDiv.raw = newUrl;
				
				// Show game-specific config section
				const gameType = this.value.match(/games\/(\w+)\.html/);
				let activeConfigSection = null;
				if (this.value === 'games.html') {
					activeConfigSection = document.getElementById('game-config');
					if (activeConfigSection) {
						activeConfigSection.style.display = 'block';
					}
				} else if (gameType && gameType[1]) {
					const configSection = document.getElementById(gameType[1] + '-config');
					if (configSection) {
						configSection.style.display = 'block';
						activeConfigSection = configSection;
					}
				}

				if (this.value === 'battle.html' && battleOptionsWrapper) {
					battleOptionsWrapper.style.display = 'block';
					if (gamesOptionsWrapper) {
						gamesOptionsWrapper.style.display = 'none';
					}
					activeConfigSection = battleOptionsWrapper;
				}

				applyCheckedGameParams(activeConfigSection);
				updateGamesLink();
				
				// Hide general game config when a specific game is selected
				const generalConfig = document.getElementById('general-game-config');
				if (generalConfig) {
					generalConfig.style.display = 'none';
				}
			} else {
				// No game selected - show general options
				const generalConfig = document.getElementById('general-game-config');
				if (generalConfig) {
					generalConfig.style.display = 'block';
				}
				
				// Reset URL to basic games.html (or remove the games parameter)
				// This would need to be implemented based on how you want to handle "no game selected"
			}
		});
	}

	// Overlay preset selector handler
	const overlaySelector = document.getElementById('overlay-preset-select');
	if (overlaySelector) {
		overlaySelector.addEventListener('change', function() {
			applyChatOverlayTemplatePreset(this.value);
		});
	}

	var serverFallbackUndoState = null;

	function getServerFallbackInputState() {
		return {
			server2: !!(document.getElementById("server2") && document.getElementById("server2").checked),
			server3: !!(document.getElementById("server3") && document.getElementById("server3").checked)
		};
	}

	function setServerFallbackInputState(state) {
		["server2", "server3"].forEach(function (id) {
			var input = document.getElementById(id);
			if (input && input.checked !== !!state[id]) {
				input.checked = !!state[id];
				updateSettings(input, true);
			}
		});
		refreshLinks();
	}

	function undoServerFallbackForDockLinks() {
		if (!serverFallbackUndoState) {
			return;
		}
		setServerFallbackInputState(serverFallbackUndoState);
		serverFallbackUndoState = null;
		showServerFallbackBanner(null, "Server Fallback was undone. Your previous dock/overlay link settings are restored.", true);
	}

	function enableServerFallbackForDockLinks() {
		if (!confirm("Server Fallback changes your dock and overlay links. After enabling, copy the updated links into OBS or reload/re-add those sources. Continue?")) {
			return;
		}
		serverFallbackUndoState = getServerFallbackInputState();
		["server2", "server3"].forEach(function (id) {
			var input = document.getElementById(id);
			if (input && !input.checked) {
				input.checked = true;
				updateSettings(input, true);
			}
		});
		refreshLinks();
		showServerFallbackBanner(null, "Server Fallback is enabled. Copy the updated dock/overlay links into OBS, then reload those sources.", true, false, true);
	}

	function getServerFallbackBanner() {
		var banner = document.getElementById("serverFallbackTestNotice");
		if (!banner) {
			return null;
		}
		return banner;
	}

	function showServerFallbackBanner(health, customMessage, success, hideEnableButton, showUndoButton) {
		var banner = getServerFallbackBanner();
		if (!banner) {
			return;
		}
		var messageNode = banner.querySelector('[data-role="message"]');
		var enableButton = banner.querySelector('[data-role="enable"]');
		var undoButton = banner.querySelector('[data-role="undo"]');
		var dismissButton = banner.querySelector('[data-role="dismiss"]');
		var message = customMessage || (health && !health.webRTCSupported
			? "This browser does not appear to support WebRTC. If the fake test message did not appear, Server Fallback may help."
			: "No active WebRTC dock or overlay connection was found. If the fake test message did not appear, Server Fallback may help.");

		if (messageNode) {
			messageNode.textContent = message;
		}
		if (enableButton) {
			enableButton.style.display = success || hideEnableButton ? "none" : "";
			if (!enableButton.dataset.boundServerFallback) {
				enableButton.dataset.boundServerFallback = "1";
				enableButton.onclick = function () {
					enableServerFallbackForDockLinks();
				};
			}
		}
		if (undoButton) {
			undoButton.style.display = showUndoButton && serverFallbackUndoState ? "" : "none";
			if (!undoButton.dataset.boundServerFallback) {
				undoButton.dataset.boundServerFallback = "1";
				undoButton.onclick = function () {
					undoServerFallbackForDockLinks();
				};
			}
		}
		if (dismissButton) {
			var dismissLabel = dismissButton.querySelector("span") || dismissButton;
			dismissLabel.textContent = success ? "OK" : "Not now";
			if (!dismissButton.dataset.boundServerFallback) {
				dismissButton.dataset.boundServerFallback = "1";
				dismissButton.onclick = function () {
					banner.classList.remove("show");
				};
			}
		}
		if (success) {
			banner.classList.add("success");
		} else {
			banner.classList.remove("success");
		}
		banner.classList.add("show");
	}

	function maybePromptServerFallbackAfterFakeMessage(response) {
		var health = response && response.dockTransportHealth;
		if (!health) {
			return;
		}
		if (!health.extensionOn) {
			showServerFallbackBanner(health, "The extension is currently disabled. Enable it first, then press the fake test message button again.", false, true);
			return;
		}
		if (health.fakeMessageTransportReady) {
			return;
		}
		if (health.serverFallbackEnabled) {
			showServerFallbackBanner(health, "Server Fallback is enabled, but the fallback connection is not ready yet. Wait a moment, then reload your dock/overlays and test again.", false, true);
			return;
		}

		if (health.canOfferServerFallback) {
			showServerFallbackBanner(health, "A dock or overlay was detected on signaling, but WebRTC is not connected. If the fake test message did not appear, Server Fallback may help.");
			return;
		}
		if (!health.webRTCSupported) {
			showServerFallbackBanner(health, "This browser does not appear to support WebRTC. Open or reload your dock/overlay link first; Server Fallback is only offered after SSN detects an overlay.", false, true);
			return;
		}
		if (health.recentP2PFailure) {
			showServerFallbackBanner(health, "A WebRTC failure was detected, but no dock or overlay is currently visible on signaling. Reload your dock/overlay link, then test again.", false, true);
			return;
		}
		if (health.everHadP2PPeer) {
			showServerFallbackBanner(health, "A dock or overlay was connected before, but none are connected now. Reload your dock or overlay, then test again.", false, true);
			return;
		}

		showServerFallbackBanner(health, "No dock or overlay connection was found. Open or reload your dock/overlay link, then press the fake test message button again.", false, true);
	}

	var iii = document.querySelectorAll("button[data-action]");
	for (var i=0;i<iii.length;i++){
		iii[i].onclick = function(e){
			var msg = {};
			msg.cmd = this.dataset.action;
			msg.ctrl = e.ctrlKey || false;
			
			if (this.dataset.target){
				msg.target = this.dataset.target;
			}
			
			msg.value = this.dataset.value || null;
			if (this.dataset.valueSource){
				var valueSource = document.getElementById(this.dataset.valueSource);
				msg.value = valueSource ? valueSource.value : null;
			}
			if (msg.cmd == "fakemsg"){
				chrome.runtime.sendMessage(msg, function (response) {
					maybePromptServerFallbackAfterFakeMessage(response);
				});
			} else if (msg.cmd == "fakemeta"){
				chrome.runtime.sendMessage(msg, function (response) {
					// actions have callbacks? maybe
				});
			} else if (msg.cmd == "uploadRAGfile"){
				chrome.runtime.sendMessage({cmd: "uploadRAGfile", enhancedProcessing: document.getElementById('enhancedProcessing').checked}, function (response) {
				});
			} else if (msg.cmd == "savePoll"){
				
				PollManager.saveCurrentPoll();
			} else if (msg.cmd == "createNewPoll"){
				
				PollManager.createNewPoll();
			} else if (msg.cmd == "bigwipe"){
				var confirmit = confirm("Are you sure you want to reset all your settings?");
				if (confirmit){
					chrome.runtime.sendMessage(msg, function (response) { // actions have callbacks? maybe
						setTimeout(function(){
							window.location.reload();
						},100);
					});
				}
			} else if (msg.cmd == "resettipjar"){
				var confirmResetTipJar = confirm("Reset the connected Tip Jar/Goal amount to $0?");
				if (confirmResetTipJar){
					chrome.runtime.sendMessage(msg, function (response) {
						log("ignore callback for this action");
					});
				}
			} else if (msg.cmd == "settipjaramount"){
				var tipjarAmount = parseFloat(msg.value);
				if (isNaN(tipjarAmount) || tipjarAmount < 0){
					alert("Enter a current amount first.");
					return;
				}
				var tipjarSourceSelect = document.querySelector('[data-optionparam12="tipjarsource"]');
				var tipjarTypeSelect = document.querySelector('[data-optionparam12="tipjartype"]');
				if (tipjarSourceSelect && tipjarSourceSelect.value) {
					msg.tipjarsource = tipjarSourceSelect.value;
				}
				if (tipjarTypeSelect && tipjarTypeSelect.value) {
					msg.tipjartype = tipjarTypeSelect.value;
				}
				chrome.runtime.sendMessage(msg, function (response) {
					log("ignore callback for this action");
				});
			} else {
				//console.log(msg);
				chrome.runtime.sendMessage(msg, function (response) { // actions have callbacks? maybe
					log("ignore callback for this action");
					// update(response);  
				});
			}
		};
	}


	document.getElementById("ytcopy").onclick = async function(){
		document.getElementById("ytcopy").innerHTML = "📎";
		var YoutubeChannel = document.querySelector('input[data-textsetting="youtube_username"]').value;
		if (!YoutubeChannel){return;}

		if (!YoutubeChannel.startsWith("@")){
			YoutubeChannel = "@"+YoutubeChannel;
		}

		fetch("https://www.youtube.com/c/"+YoutubeChannel+"/live").then((response) => response.text()).then((data) => {
			document.getElementById("ytcopy").innerHTML = "🔄";
			try{
				var videoID = data.split('{"videoId":"')[1].split('"')[0];
				log(videoID);
				if (videoID){
					navigator.clipboard.writeText(videoID).then(() => {
						document.getElementById("ytcopy").innerHTML = "✔️"; // Video ID copied to clipboard
						setTimeout(function(){
							document.getElementById("ytcopy").innerHTML = "📎";
						},1000);
					}, () => {
						document.getElementById("ytcopy").innerHTML = "❌"; // Failed to copy to clipboard
					});
				}
			} catch(e){
				document.getElementById("ytcopy").innerHTML = "❓"; // Video not found
			}
		});
	};

	checkVersion();
	checkImportantChanges();

	let hideLinks = false;
	document.querySelectorAll("input[data-setting='hideyourlinks']").forEach(x=>{
		if (x.checked){
			hideLinks = true;
		}
	});
	
	if (hideLinks){
		document.body.classList.add("hidelinks");
	} 
	
	
	
	document.body.classList.add('loaded');

    // Don't automatically initialize WebMidi - wait for user to enable it
	console.log("WebMidi initialization deferred until MIDI hotkeys are enabled");
	
	// Handle games selector initial state
	const gamesSelectorInit = document.getElementById('games-preset-select');
	if (gamesSelectorInit && gamesSelectorInit.value) {
		// Trigger change event to show correct config
		gamesSelectorInit.dispatchEvent(new Event('change'));
	} else {
		// Show general config by default
		const generalConfig = document.getElementById('general-game-config');
		if (generalConfig) {
			generalConfig.style.display = 'block';
		}
	}


	// Handle custom beep upload buttons
	const uploadBeepBtn = document.getElementById('uploadBeepBtn');
	if (uploadBeepBtn) {
		uploadBeepBtn.onclick = function() {
			openHostedMediaUploadForInput(document.getElementById('custombeep'), 'uploadBeep');
		};
	}

	// Handle second custom beep upload button
	const uploadBeepBtn2 = document.getElementById('uploadBeepBtn2');
	if (uploadBeepBtn2) {
		uploadBeepBtn2.onclick = function() {
			openHostedMediaUploadForInput(document.getElementById('custombeep2'), 'uploadBeep2');
		};
	}

	const uploadTimerSoundBtn = document.getElementById('uploadTimerSoundBtn');
	if (uploadTimerSoundBtn) {
		uploadTimerSoundBtn.onclick = function() {
			openHostedMediaUploadForInput(document.getElementById('timerCustomSound'), 'uploadTimerSound');
		};
	}

	// Handle per-type alert sound upload buttons
	const alertSoundUploads = [
		{ btnId: 'uploadMultiAlertSoundBtn', inputId: 'multi-alert-custombeep' },
		{ btnId: 'uploadFollowSoundBtn', inputId: 'multi-alert-followsound' },
		{ btnId: 'uploadSubSoundBtn', inputId: 'multi-alert-subsound' },
		{ btnId: 'uploadDonoSoundBtn', inputId: 'multi-alert-donosound' },
		{ btnId: 'uploadBitsSoundBtn', inputId: 'multi-alert-bitssound' },
		{ btnId: 'uploadRaidSoundBtn', inputId: 'multi-alert-raidsound' },
		{ btnId: 'uploadAuctionSoundBtn', inputId: 'multi-alert-auctionsound' },
		{ btnId: 'uploadHypeSoundBtn', inputId: 'multi-alert-hypesound' }
	];
	alertSoundUploads.forEach(({ btnId, inputId }) => {
		const btn = document.getElementById(btnId);
		if (btn) {
			btn.onclick = function() {
				openHostedMediaUploadForInput(document.getElementById(inputId), btnId);
			};
		}
	});

	const hostedMediaUploads = [
		{ btnId: 'uploadDefaultAvatarBtn', inputId: 'default_avatar' },
		{ btnId: 'uploadAiOverlayAvatarBtn', inputId: 'aiOverlayAvatar' },
		{ btnId: 'uploadStreamGoalJarImageBtn', inputId: 'streamGoalJarImage' },
		{ btnId: 'uploadWaitlistSoundBtn', inputId: 'customsound' }
	];
	hostedMediaUploads.forEach(({ btnId, inputId }) => {
		const btn = document.getElementById(btnId);
		if (btn) {
			btn.onclick = function() {
				openHostedMediaUploadForInput(document.getElementById(inputId), btnId);
			};
		}
	});

	const uploadFeaturedFallbackBtn = document.getElementById('uploadFeaturedFallbackBtn');
	if (uploadFeaturedFallbackBtn) {
		uploadFeaturedFallbackBtn.onclick = function() {
			openHostedMediaUploadForInput(document.getElementById('featuredFallbackImage'), 'uploadFeaturedFallback', function() {
				const fallbackToggle = document.querySelector('input[data-param2="fallbackimg"]');
				if (fallbackToggle && !fallbackToggle.checked) {
					fallbackToggle.checked = true;
					fallbackToggle.dispatchEvent(new Event('change', { bubbles: true }));
				}
			});
		};
	}
});
