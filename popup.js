// popup.js

// Listen for language change messages from parent window
window.addEventListener('message', function(event) {
	// Check if this is a language change message
	if (event.data && event.data.type === 'changeLanguage') {
		console.log('Received language change message:', event.data.language);
		
		// Update the language selector if it exists
		const languageSelect = document.querySelector('select[data-optionsetting="translationlanguage"]');
		if (languageSelect && languageSelect.value !== event.data.language) {
			// Save the new language setting
			chrome.runtime.sendMessage({
				cmd: "saveSetting",
				type: "optionsetting",
				setting: "translationlanguage",
				value: event.data.language
			}, function(response) {
				console.log("Language setting saved, reloading page");
				// Reload the page to apply the new language
				window.location.reload();
			});
		}
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
ssapp = urlParams.has("ssapp") || ssapp;

var isExtensionOn = false;
var ssapp = false;
var USERNAMES = [];

// Function to open Event Flow Editor
function openEventFlowEditor() {
    // For all contexts, just open actions/index.html
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
			
			// Create promise with timeout
			const promise = new Promise((resolve) => {
				// Store callback with timeout
				const timeoutId = setTimeout(() => {
					pendingCallbacks.delete(callbackId);
					// If timeout, get sync response as fallback
					const response = ipcRenderer.sendSync('fromPopup', data);
					resolve(response);
				}, 500);
				
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
	// Find the closest .link container
	const linkContainer = event.target.closest('.link');
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

async function populateFontDropdown() {
    const fonts = ["Roboto", "Tahoma",  "Arial", "Verdana", "Helvetica", "Serif", "Trebuchet MS", "Times New Roman", "Georgia", "Garamond", "Courier New", "Brush Script MT"];
	
    var select = document.querySelector("[data-optionparam1='font']");
    fonts.forEach(font => {
        if (isFontAvailable(font)) {
            let option = document.createElement("option");
            option.value = font;
			option.style="font-family:'"+font+"'";
            option.innerText = font + " abc123XYZ";
            select.appendChild(option);
        }
    });
	
	select = document.querySelector("[data-optionparam2='font']");
    fonts.forEach(font => {
        if (isFontAvailable(font)) {
            let option = document.createElement("option");
            option.value = font;
			option.style="font-family:'"+font+"'";
            option.innerText = font + " abc123XYZ";
            select.appendChild(option);
        }
    });
	
	select = document.querySelector("[data-optionparam4='font']");
    fonts.forEach(font => {
        if (isFontAvailable(font)) {
            let option = document.createElement("option");
            option.value = font;
			option.style="font-family:'"+font+"'";
            option.innerText = font + " abc123XYZ";
            select.appendChild(option);
        }
    });
	
	select = document.querySelector("[data-optionparam5='font']");
    fonts.forEach(font => {
        if (isFontAvailable(font)) {
            let option = document.createElement("option");
            option.value = font;
			option.style="font-family:'"+font+"'";
            option.innerText = font + " abc123XYZ";
            select.appendChild(option);
        }
    });
	
	select = document.querySelector("[data-optionparam1='font']");
    fonts.forEach(font => {
        if (isFontAvailable(font)) {
            let option = document.createElement("option");
            option.value = font;
			option.style="font-family:'"+font+"'";
            option.innerText = font + " abc123XYZ";
            select.appendChild(option);
        }
    });
	
	select = document.querySelector("[data-optionparam17='font']");
    fonts.forEach(font => {
        if (isFontAvailable(font)) {
            let option = document.createElement("option");
            option.value = font;
			option.style="font-family:'"+font+"'";
            option.innerText = font + " abc123XYZ";
            select.appendChild(option);
        }
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
    
    if (sourcesList && sourcesList.size > 0) {
        addContainer.innerHTML = `
            <select id="new${inputId}Type">
                <option value="" selected>Select Sources</option>
                ${Array.from(sourcesList).sort().map(source => 
                    `<option value="${source}">${source.charAt(0).toUpperCase() + source.slice(1)}</option>`
                ).join('')}
            </select>
            <button id="add${inputId}">Add</button>
        `;
    } else {
        addContainer.innerHTML = `
            <input type="text" id="new${inputId}Type" placeholder="Source type">
            <button id="add${inputId}">Add</button>
        `;
    }
    
    container.parentNode.classList.add("isolate");
    container.parentNode.insertBefore(listContainer, container.nextSibling);
    container.parentNode.insertBefore(addContainer, listContainer.nextSibling);
    
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
          <input type="text" id="botReplyMessageCommand${id}" maxlength="200" class="textInput" autocomplete="off" placeholder="Triggering command" data-textsetting="botReplyMessageCommand${id}">
          <label for="botReplyMessageCommand${id}">&gt; Triggering command. eg: !discord</label>
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
          <input type="text" id="chatcommand${id}" class="textInput" autocomplete="off" placeholder="!someevent${id}" data-textsetting="chatcommand${id}">
          <label for="chatcommand${id}">&gt; Chat Command</label>
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
		const id = key.replace(prefix, '');
		if (settings[key]?.setting !== undefined || 
			settings[key]?.textsetting !== undefined || 
			settings[key]?.optionsetting !== undefined || 
			settings[key]?.numbersetting !== undefined) {
		  events.add(parseInt(id));
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
const userTypes = ['botnamesext', 'modnamesext', 'viplistusers', 'adminnames', 'hostnamesext', 'blacklistusers', 'whitelistusers'];
const sourcesList = new Set();


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
  const containers = ['botReplyMessages', 'chatCommands', 'timedMessages', 'midiCommands'];
  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; // Clear existing content
  });

  // Track existing events for each type
  const existingEvents = {
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
  });

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

function setupPageLinks(hideLinks, baseURL, streamID, password) {
  // Get any custom parameters from the current URL
  let customParams = "";
  try {
    const currentUrl = new URL(window.location.href);
    
    // List of parameters to ignore (TTS-related and standard ones)
    const ignoreParams = ['session', 'password', 'localserver'];
    const ttsRelatedParams = [
      'ttsprovider', 'lang', 'voice', 'rate', 'pitch',
      'elevenlabskey', 'elevenlabsmodel', 'elevenlabsvoice', 'elevenlatency', 'elevenstability', 
      'elevensimilarity', 'elevenstyle', 'elevenspeakerboost', 'elevenrate',
      'googleapikey', 'googlevoice', 'googleaudioprofile', 'googlerate', 'googlelang',
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
  
  let versionParam = "";
  try {
    const manifestData = chrome.runtime.getManifest();
    if (manifestData && manifestData.version) {
      versionParam = `&v=${manifestData.version}`;
    }
  } catch (e) {
    console.error("Error getting version from manifest:", e);
  }
  
  // Configuration array with all page details
  const pages = [
    { id: "dock", path: "dock.html" },
    { id: "overlay", path: "featured.html" },
    { id: "emoteswall", path: "emotes.html" },
    { id: "hypemeter", path: "hype.html" },
    { id: "waitlist", path: "waitlist.html" },
    { id: "tipjar", path: "tipjar.html" },
	{ id: "leaderboard", path: "leaderboard.html" },
	{ id: "games", path: "games.html" },
    { id: "ticker", path: "ticker.html" },
    { id: "wordcloud", path: "wordcloud.html" },
    { id: "poll", path: "poll.html" },
    { id: "battle", path: "battle.html" },
    { id: "chatbot", path: "bot.html", linkPath: "chatbot.html" },
    { id: "cohost", path: "cohost.html" },
    { id: "giveaway", path: "giveaway.html" },
    { id: "credits", path: "credits.html" },
    { id: "privatechatbot", path: "chatbot.html", style: "color:lightblue;" },
    { id: "eventsdashboard", path: "events.html" },
	{ id: "flowactions", path: "actions.html" },
	{ id: "custom-gif-commands", path: "gif.html" },
	{ id: "scoreboard", path: "scoreboard.html"}
	
  ];
  
  // Process all standard pages
  pages.forEach(page => {
    // Skip dock update if a preset is selected
    if (page.id === "dock") {
      const overlaySelector = document.getElementById('overlay-preset-select');
      if (overlaySelector && overlaySelector.value) {
        return; // Skip updating dock when preset is active
      }
    }
    
    // Skip featured overlay update if a preset is selected
    if (page.id === "overlay") {
      const featuredPresetSelector = document.getElementById('featured-preset-select');
      if (featuredPresetSelector && featuredPresetSelector.value) {
        return; // Skip updating featured overlay when preset is active
      }
    }
    
    const linkPath = page.linkPath || page.path;
    const fullURL = `${baseURL}${page.path}?session=${streamID}${password}${customParams}${versionParam}`;
    const element = document.getElementById(page.id);
    
    if (element) {
      const linkStyle = page.style ? `style="${page.style}"` : "";
      element.innerHTML = hideLinks 
        ? "Click to open link" 
        : `<a target='_blank' ${linkStyle} id='${page.id}link' href='${fullURL}'>${baseURL}${linkPath}?session=${streamID}${password}${customParams}${versionParam}</a>`;
      element.raw = fullURL;
    }
  });
  
  // Update sample overlay and remote control URLs too
  const sampleOverlay = document.getElementById("sampleoverlay");
  if (sampleOverlay) {
    sampleOverlay.href = `${baseURL}sampleoverlay.html?session=${streamID}${password}${customParams}${versionParam}`;
  }
  
  const remoteControlUrl = document.getElementById("remote_control_url");
  if (remoteControlUrl) {
    remoteControlUrl.href = `${baseURL}sampleapi.html?session=${streamID}${password}${customParams}${versionParam}`;
  }
}

function removeTTSProviderParams(url, selectedProvider=null) {
  if (!url) return url;
  
  // Map of all provider-specific parameters
  const providerParams = {
    system: ['lang', 'voice', 'rate', 'pitch'],
    elevenlabs: ['elevenlabskey', 'elevenlabsmodel', 'elevenlabsvoice', 'elevenlatency','elevenstability','elevensimilarity','elevenstyle','elevenspeakerboost','elevenrate','voice11'],
    google: ['googleapikey', 'googlevoice','googleaudioprofile','googlerate','googlelang'],
    speechify: ['speechifykey', 'speechifyvoice','voicespeechify' ,'speechifymodel','speechifylang','speechifyspeed'],
    kokoro: ['kokorokey', 'voicekokoro', 'kokorospeed'],
    kitten: ['kittenvoice', 'kittenspeed', 'kittensamplerate'],
    openai: ['openaikey', 'openaiendpoint', 'voiceopenai', 'openaimodel', 'openaispeed', 'openaiformat', 'openaicustomvoice', 'openaicustommodelx']
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
  
  // Get all parameters except those for the selected provider
  const paramsToRemove = Object.keys(providerParams)
    .filter(provider => provider !== selectedProvider)
    .flatMap(provider => providerParams[provider]);
	
  if (selectedProvider=="system"){
	  paramsToRemove.push("ttsprovider");
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
        if (response.settings?.ttskey?.textparam1) ttsService = "google";
        else if (response.settings?.googleAPIKey?.textparam1) ttsService = "google";
        else if (response.settings?.elevenlabskey?.textparam1) ttsService = "elevenlabs";
        else if (response.settings?.speechifykey?.textparam1) ttsService = "speechify";
        else if (response.settings?.openaikey?.textparam1) ttsService = "openai";
        
        if (!response.settings.ttsProvider) {
            response.settings.ttsProvider = {};
        }
        response.settings.ttsProvider.optionsetting = ttsService;
    }
    
    // Handle featured TTS provider (for param2)
    if (!response.settings?.ttsProvider?.optionsetting2) {
        let ttsService = "system";
        if (response.settings?.ttskey?.textparam2) ttsService = "google";
        else if (response.settings?.googleAPIKey?.textparam2) ttsService = "google";
        else if (response.settings?.elevenlabskey?.textparam2) ttsService = "elevenlabs";
        else if (response.settings?.speechifykey?.textparam2) ttsService = "speechify";
        else if (response.settings?.openaikey?.textparam2) ttsService = "openai";
        
        if (!response.settings.ttsProvider) {
            response.settings.ttsProvider = {};
        }
        response.settings.ttsProvider.optionsetting2 = ttsService;
    }
    
    // Handle secondary TTS provider (for param10)
    if (!response.settings?.ttsProvider?.optionsetting10) {
        let ttsService = "system";
        if (response.settings?.ttskey?.textparam10) ttsService = "google";
        else if (response.settings?.googleAPIKey?.textparam10) ttsService = "google";
        else if (response.settings?.elevenlabskey?.textparam10) ttsService = "elevenlabs";
        else if (response.settings?.speechifykey?.textparam10) ttsService = "speechify";
        else if (response.settings?.openaikey?.textparam10) ttsService = "openai";
        
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
            }
        }

        // Process option parameters
        const optionParamKey = `optionparam${paramNum}`;
        if (optionParamKey in settingObj) {
            const ele = document.querySelector(`select[data-${optionParamKey}='${key}']`);
            if (ele) {
                let storedValue = settingObj[optionParamKey];
                
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
                updateSettings(ele, sync);

                if (key == "ttsprovider" && paramNum == 2) { 
                    handleTTSProvider2Visibility(ele.value); 
                } else if (key == "ttsprovider" && paramNum == 10) { // Ensure paramNum is compared as number or string consistently
                    handleTTSProvider10Visibility(ele.value); 
                }

                const paramEle = document.querySelector(`input[data-param${paramNum}='${key}']`);
                if (paramEle && paramEle.checked) {
                    updateSettings(paramEle, false, settingObj[optionParamKey]);
                }
                
                // Handle OpenAI custom voice/model dropdowns
                if (key === 'voiceopenai' && storedValue === 'custom') {
                    // Show custom voice input for the appropriate section
                    const customInputId = paramNum === 1 ? 'openaiCustomVoice' : 
                                       paramNum === 2 ? 'openaiCustomVoice2' : 
                                       paramNum === 10 ? 'openaiCustomVoice10' : null;
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
                                       paramNum === 10 ? 'openaiCustomModel10' : null;
                    if (customInputId) {
                        const customInput = document.getElementById(customInputId);
                        if (customInput) {
                            customInput.style.display = 'inline-block';
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
            // For fields that default to "all/none" when empty, don't load saved values
            const defaultToEmptyFields = ['eventsSources', 'ttssources', 'relaytargets'];
            if (defaultToEmptyFields.includes(key)) {
                ele.value = ''; // Always start with empty for these fields
            } else {
                ele.value = valueToSet; // valueToSet is settingObj.textsetting
            }

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
            }
        }
    }

    if ("optionsetting" in settingObj) {
        const ele = document.querySelector(`select[data-optionsetting='${key}']`);
        if (ele) {
            if (key == "midiOutputDevice" || key.startsWith("mididevice")) {
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

            ele.value = settingObj.optionsetting;
            updateSettings(ele, sync);

            if (key == "aiProvider") {
                handleAIProviderVisibility(ele.value);
            } else if (key == "ttsProvider") {
                handleTTSProviderVisibility(ele.value);
            } else if (key == "featuredOverlayStyle" ) {
				document.querySelectorAll('.wrapper:has(.options_group.single_message)').forEach(wrapper => {
					wrapper.style.display = 'none';
				});
			 } else if (key == "overlayPreset") {
				// Update the dock URL to match the saved overlay preset
				const dockDiv = document.getElementById('dock');
				const dockLink = document.querySelector('#dock a, a[href*="dock.html"]');
				
				if (dockDiv && ele.value) {
					// An overlay is selected, update the URL
					const overlayUrl = baseURL + ele.value;
					
					// Extract existing parameters from current dock URL
					let existingParams = '';
					if (dockDiv.raw && dockDiv.raw.includes('?')) {
						existingParams = dockDiv.raw.split('?')[1];
					}
					
					// Build new URL with overlay
					let newUrl = overlayUrl;
					if (existingParams) {
						newUrl += '?' + existingParams;
					}
					
					// Update the dock URL
					dockDiv.raw = newUrl;
					if (dockLink) {
						dockLink.href = newUrl;
						dockLink.innerText = document.body.classList.contains("hidelinks") ? "Click to open link" : newUrl;
					}
					
					// Hide classic dock customization options
					document.querySelectorAll('.wrapper:has(.options_group.streaming_chat)').forEach(wrapper => {
						wrapper.style.display = 'none';
					});
				} else {
					// Show classic dock customization options when no overlay is selected
					document.querySelectorAll('.wrapper:has(.options_group.streaming_chat)').forEach(wrapper => {
						wrapper.style.display = '';
					});
				}
			 }
        }
    }

    if ("optionsetting2" in settingObj) {
        const ele = document.querySelector(`select[data-optionsetting2='${key}']`);
        if (ele) {
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
                    commandsList.appendChild(createCommandEntry(cmd.command, cmd.url)); // Assuming createCommandEntry is defined
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

            if ('settings' in response) {
                setupTtsProviders(response); // Handle TTS provider setting initialization

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
            }

            createTabsFromSettings(response); // Assuming createTabsFromSettings is defined

            // Check if MIDI is enabled and initialize if needed
            const midiCheckbox = document.querySelector('input[data-setting="midi"]');
            if (midiCheckbox && midiCheckbox.checked) {
                // MIDI was enabled in settings, initialize the dropdown
                handleMidiToggle(true);
            }

            // Refresh all page links.
            refreshLinks();

            try {
                // Define your link configurations: { linkId: 'idOfLinkElement', sourcePropertyProvider: () => document.getElementById('sourceElementId')?.raw || document.getElementById('idOfLinkElement').href }
                // A more robust way is if refreshLinks stores the raw URLs on the elements or returns them.
                // For now, let's assume link elements have an href that needs cleaning.
                const linkIdsToClean = [
                    'docklink', 'cohostlink', 'privatechatbotlink', 'chatbotlink',
                    'overlaylink', 'emoteswalllink', 'hypemeterlink', 'waitlistlink',
                    'tipjarlink', 'tickerlink', 'wordcloudlink', 'polllink', 'flowactionslink',
                    'battlelink', 'custom-gif-commandslink', 'creditslink', 'giveawaylink', 'gameslink', 'leaderboardlink', 'scoreboard',
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
    let ele = document.querySelector(`input[data-${paramKey}='${key}']`);
    if (!ele) return;

    ele.checked = settingObj[paramKey]; // Set the checked state based on loaded setting.

    // Call updateSettings with the element. handleElementParam will figure out the value.
    updateSettings(ele, sync);
}

// Handle legacy settings format
function processLegacySetting(key, value, sync) {
    // Process simple settings
    var ele = document.querySelector(`input[data-setting='${key}'], input[data-param1='${key}'], input[data-param2='${key}']`);
    if (ele) {
        ele.checked = value;
        updateSettings(ele, sync);
    }
    
    // Process text settings
    var ele = document.querySelector(`input[data-textsetting='${key}'], input[data-textparam1='${key}'], textarea[data-textsetting='${key}'], textarea[data-textparam1='${key}']`);
    if (ele) {
        ele.value = value;
        updateSettings(ele, sync);
    }
}

// Handle AI provider visibility
function handleAIProviderVisibility(provider) {
    // Hide all provider-specific elements first
    [
        "ollamamodel", "ollamaendpoint", "chatgptApiKey", "ollamaKeepAlive",
        "geminiApiKey", "geminimodel", "xaiApiKey", "xaimodel", "chatgptmodel",
        "deepseekApiKey", "deepseekmodel", "customAIEndpoint", "customAIModel",
        "openrouterApiKey", "openroutermodel", "bedrockAccessKey", "bedrockSecretKey",
        "bedrockRegion", "bedrockmodel"
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
    } else if (provider == "openrouter") {
        document.getElementById("openrouterApiKey").classList.remove("hidden");
        document.getElementById("openroutermodel").classList.remove("hidden");
    }
}

// Handle TTS provider visibility
function handleTTSProviderVisibility(provider) {
    // Hide all TTS elements
    ["systemTTS", "elevenlabsTTS", "googleTTS", "speechifyTTS", "kokoroTTS", "kittenTTS", "openaiTTS"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });
    
    // Show element based on selected provider
    if (provider == "system") {
        document.getElementById("systemTTS").classList.remove("hidden");
    } else if (provider == "elevenlabs") {
        document.getElementById("elevenlabsTTS").classList.remove("hidden");
    } else if (provider == "google") {
        document.getElementById("googleTTS").classList.remove("hidden");
    } else if (provider == "speechify") {
        document.getElementById("speechifyTTS").classList.remove("hidden");
    } else if (provider == "kokoro") {
        document.getElementById("kokoroTTS").classList.remove("hidden");
    } else if (provider == "kitten") {
        document.getElementById("kittenTTS").classList.remove("hidden");
    } else if (provider == "openai") {
        document.getElementById("openaiTTS").classList.remove("hidden");
    }
}

// Handle secondary TTS provider visibility
function handleTTSProvider10Visibility(provider) {
    // Hide all TTS10 elements
    ["systemTTS10", "elevenlabsTTS10", "googleTTS10", "speechifyTTS10", "kokoroTTS10", "kittenTTS10", "openaiTTS10"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });
    
    // Show element based on selected provider
    if (provider == "system") {
        document.getElementById("systemTTS10").classList.remove("hidden");
    } else if (provider == "elevenlabs") {
        document.getElementById("elevenlabsTTS10").classList.remove("hidden");
    } else if (provider == "google") {
        document.getElementById("googleTTS10").classList.remove("hidden");
    } else if (provider == "speechify") {
        document.getElementById("speechifyTTS10").classList.remove("hidden");
    } else if (provider == "kokoro") {
        document.getElementById("kokoroTTS10").classList.remove("hidden");
    } else if (provider == "kitten") {
        document.getElementById("kittenTTS10").classList.remove("hidden");
    } else if (provider == "openai") {
        document.getElementById("openaiTTS10").classList.remove("hidden");
    }
}

// Handle featured TTS provider visibility (param2)
function handleTTSProvider2Visibility(provider) {
    // Hide all TTS2 elements
    ["systemTTS2", "elevenlabsTTS2", "googleTTS2", "speechifyTTS2", "kokoroTTS2", "kittenTTS2", "openaiTTS2", "piperTTS2", "espeakTTS2"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });
    
    // Show element based on selected provider
    if (provider == "system") {
        document.getElementById("systemTTS2").classList.remove("hidden");
    } else if (provider == "elevenlabs") {
        document.getElementById("elevenlabsTTS2").classList.remove("hidden");
    } else if (provider == "google") {
        document.getElementById("googleTTS2").classList.remove("hidden");
    } else if (provider == "speechify") {
        document.getElementById("speechifyTTS2").classList.remove("hidden");
    } else if (provider == "kokoro") {
        document.getElementById("kokoroTTS2").classList.remove("hidden");
    } else if (provider == "kitten") {
        document.getElementById("kittenTTS2").classList.remove("hidden");
    } else if (provider == "openai") {
        document.getElementById("openaiTTS2").classList.remove("hidden");
    } else if (provider == "piper") {
        document.getElementById("piperTTS2").classList.remove("hidden");
    } else if (provider == "espeak") {
        document.getElementById("espeakTTS2").classList.remove("hidden");
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
        
        if (manifestData && manifestData.content_scripts) {
            // Extract source filenames from content_scripts
            manifestData.content_scripts.forEach(script => {
                if (script.js && script.js.length > 0) {
                    script.js.forEach(jsFile => {
                        if (jsFile.startsWith('./sources/') && jsFile.endsWith('.js')) {
                            // Extract just the filename without path and extension
                            const sourceName = jsFile.replace('./sources/', '').replace('.js', '');
                            sourcesList.add(sourceName);
                        }
                    });
                }
            });
        }
    } catch (e) {
        console.error("Error processing manifest data:", e);
        document.getElementById("newVersion").classList.add('show');
        document.getElementById("newVersion").innerHTML = `<small class="error-note" style="display:block;color:#f44336">⚠️ Error processing version info: ${e.message}</small>`;
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
        'overlay': 2,
        'emoteswall': 3,
        'hypemeter': 4,
        'waitlist': 5,
        'ticker': 6,
        'wordcloud': 7,
        'battle': 8,
        'custom-gif-commands': 9,
        'chatbot': 10,
        'cohost': 11,
        'tipjar': 12,
        'credits': 13,
        'giveaway': 14,
		'leaderboard': 19,
		'games': 20,
        'privatechatbot': 15,
		'poll': 16,
		'eventsdashboard': 17,
		'flowactions': 18,
		'scoreboard': 21
    };
}
function handleElementParam(ele, targetId, paramType, sync, value = null) {
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return false;

    const paramAttr = `data-${paramType}`;
    const paramValue = ele.dataset[paramType]; // e.g., 'scale=0.77' or 'darkmode'
    if (!paramValue) return false;

    const paramNum = paramType.match(/\d+$/) ? paramType.match(/\d+$/)[0] : '';
    const parts = paramValue.split('=');
    const keyOnly = parts[0]; // e.g., 'scale' or 'darkmode'
    const valueInAttr = parts.length > 1 ? parts[1] : undefined; // e.g., '0.77' or undefined

    if (ele.checked) {
        // Remove any existing instance of this parameter based on the key part
        targetElement.raw = removeQueryParamWithValue(targetElement.raw, keyOnly);

        if (valueInAttr !== undefined) {
            // If the value is embedded in the data attribute (like 'scale=0.77'), use the full paramValue
            targetElement.raw = updateURL(paramValue, targetElement.raw);
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
                        targetElement.raw = updateURL(`${keyOnly}=${encodeURIComponent(associatedInput.value)}`, targetElement.raw);
                    }
                } else {
                    // Standard select without language/voice data
                    targetElement.raw = updateURL(`${keyOnly}=${encodeURIComponent(associatedInput.value)}`, targetElement.raw);
                }
            } else if (associatedInput && associatedInput.code !== undefined && associatedInput.code !== '') {
                targetElement.raw = updateURL(`${keyOnly}=${associatedInput.code}`, targetElement.raw);
            } else if (associatedInput && associatedInput.value !== undefined && associatedInput.value !== '') {
                targetElement.raw = updateURL(`${keyOnly}=${encodeURIComponent(associatedInput.value)}`, targetElement.raw);
            } else {
                // Simple flag parameter
                targetElement.raw = updateURL(keyOnly, targetElement.raw);
            }
        }

        // Handle special case exclusions
        handleExclusiveCases(ele, paramType, paramValue, sync);
    } else { // ele.checked is false
        // If checkbox is unchecked, remove the parameter from URL based on the key part
        targetElement.raw = removeQueryParamWithValue(targetElement.raw, keyOnly);
        
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
    const paramPrefix = paramValue.split('=')[0];
    // Only handle siblings if the param contains '=' (like scale=2, opacity=0.3) or the bare key itself
    if (paramValue.includes('=') || paramValue === paramPrefix) {
        // Select only inputs that control the same key for this param group, excluding the current element
        const selector = `input[data-${paramType}^='${paramPrefix}='], input[data-${paramType}='${paramPrefix}']`;
        document.querySelectorAll(selector).forEach(ele1 => {
            if (ele1 !== ele && ele1.checked) {
                ele1.checked = false;
                updateSettings(ele1, sync);
            }
        });
    }

    return true;
}
function handleExclusiveCases(ele, paramType, paramValue, sync) {
    if (paramType !== 'param1' && paramType !== 'param5') return;
    
    // Handle exclusive settings like darkmode/lightmode
    const exclusiveMap = {
        param1: {
            'darkmode': 'lightmode',
            'lightmode': 'darkmode',
            'onlytwitch': 'hidetwitch',
            'hidetwitch': 'onlytwitch'
        },
        param5: {
            'alignright': 'aligncenter',
            'aligncenter': 'alignright'
        }
    };
    
    if (exclusiveMap[paramType][paramValue]) {
        const oppositeKey = exclusiveMap[paramType][paramValue];
        const oppositeEle = document.querySelector(`input[data-${paramType}='${oppositeKey}']`);
        if (oppositeEle && oppositeEle.checked) {
            oppositeEle.checked = false;
            updateSettings(oppositeEle, sync);
        }
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
    
    return true;
}

function handleOptionParam(ele, targetId, paramType, sync) {
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return false;
    
    const paramValue = ele.dataset[paramType];
    if (!paramValue) return false;
    
    targetElement.raw = removeQueryParamWithValue(targetElement.raw, paramValue);
    
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
                    targetElement.raw = updateURL(`${paramValue}=${langValue}`, targetElement.raw);
                    targetElement.raw = updateURL(`voice${prefix}=${voiceValue}`, targetElement.raw);
                } else {
                    // Not a language parameter, use standard value
                    targetElement.raw = updateURL(`${paramValue}=${ele.value}`, targetElement.raw);
                }
            } else {
                // Standard select without language/voice data
                targetElement.raw = updateURL(`${paramValue}=${ele.value}`, targetElement.raw);
            }
        } else {
            // Not a select element, use standard value
            targetElement.raw = updateURL(`${paramValue}=${ele.value}`, targetElement.raw);
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
    const elements = Object.keys(getTargetMap());

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
    
    // Handle MIDI toggle
    if (ele.dataset.setting === "midi") {
        handleMidiToggle(ele.checked);
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
    if (!ele.dataset.optionsetting && !ele.dataset.optionsetting2 && !ele.dataset.optionsetting10) return false;
    
    const settingType = ele.dataset.optionsetting ? 'optionsetting' : 
                       (ele.dataset.optionsetting2 ? 'optionsetting2' : 'optionsetting10');
    const settingValue = ele.dataset[settingType];
    
    // Handle poll type
    if (settingValue === "pollType") {
        if (ele.value === "multiple") {
            document.getElementById("multipleChoiceOptions").classList.remove("hidden");
        } else {
            document.getElementById("multipleChoiceOptions").classList.add("hidden");
        }
    }
    
    // Handle AI Provider settings
    if (settingValue === "aiProvider") {
        // Hide all AI provider-specific elements
		const aiProviderElements = [
			'bedrockAccessKey', 'bedrockSecretKey', 'bedrockRegion', 'bedrockmodel',
			'chatgptApiKey', 'geminiApiKey', 'geminimodel', 'xaiApiKey', 'xaimodel',
			'chatgptmodel', 'deepseekApiKey', 'deepseekmodel', 'customAIEndpoint',
			'customAIModel', 'ollamamodel', 'ollamaendpoint', 'ollamaKeepAlive',
			'openrouterApiKey', 'openroutermodel'
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
            case 'custom':
                document.getElementById("customAIEndpoint").classList.remove("hidden");
                document.getElementById("customAIModel").classList.remove("hidden");
                break;
        }
    }
    
    // Handle TTS Provider settings
    if (settingValue === "ttsProvider") {
		
        const suffix = settingType === 'optionsetting2' ? '2' : (settingType === 'optionsetting10' ? '10' : '');
        const ttsProviderElements = [
            `systemTTS${suffix}`, `elevenlabsTTS${suffix}`, `googleTTS${suffix}`, 
            `speechifyTTS${suffix}`, `kokoroTTS${suffix}`, `kittenTTS${suffix}`, `openaiTTS${suffix}`, `piperTTS${suffix}`, `espeakTTS${suffix}`
        ];
        
        ttsProviderElements.forEach(id => {
            if (document.getElementById(id)) {
                document.getElementById(id).classList.add("hidden");
            }
        });
        
        // Show elements relevant to the selected TTS provider
        const selectedProvider = `${ele.value}TTS${suffix}`;
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
        const checkbox = document.querySelector(`input[${paramAttr}='${settingValue}']`);
        if (checkbox && checkbox.checked) {
            const targetElement = document.getElementById(targetId);
            targetElement.raw = removeQueryParamWithValue(targetElement.raw, settingValue);
            targetElement.raw = updateURL(`${settingValue}=${ele.value}`, targetElement.raw);
        }
        
        return true;
    }
    
    return false;
}

function handleColorAndPalette(ele) {
    if (ele.dataset.color) {
        const colorEle = document.getElementById(ele.dataset.color);
        if (colorEle) {
            colorEle.value = ele.value;
            updateSettings(colorEle, true);
            return true;
        }
    } else if (ele.dataset.palette) {
        const paletteEle = document.getElementById(ele.dataset.palette);
        if (paletteEle) {
            paletteEle.value = ele.value;
            // updateSettings(paletteEle, true); // the palette is just the picker, not the value holder
            return true;
        }
    }
    
    return false;
}

function handleCustomGifCommand(ele, sync) {
    if (!ele.closest('.custom-gif-command-entry')) return false;
    
    const commands = Array.from(document.querySelectorAll('.custom-gif-command-entry')).map(entry => ({
        command: entry.querySelector('.custom-command').value,
        url: entry.querySelector('.custom-media-url').value
    }));
    
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
        // For fields that default to "all/none" when empty, don't save empty values
        const defaultToEmptyFields = ['eventsSources', 'ttssources', 'relaytargets'];
        if (defaultToEmptyFields.includes(ele.dataset.textsetting) && !ele.value.trim()) {
            // Don't save empty values for these fields
            return;
        }
        
        chrome.runtime.sendMessage({
            cmd: "saveSetting",
            type: "textsetting",
            target: target,
            setting: ele.dataset.textsetting,
            value: ele.value
        }, function (response) {});
        return;
    }
    
    // Handle number settings
    if (handleNumberSetting(ele, sync)) {
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

function refreshLinks(){
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
  try {
    const linkIdToDivIdMap = {
      'docklink': 'dock',
      'overlaylink': 'overlay',
      'emoteswalllink': 'emoteswall',
      'hypemeterlink': 'hypemeter',
      'waitlistlink': 'waitlist',
      'tipjarlink': 'tipjar',
	  'leaderboardlink': 'leaderboard',
	  'gameslink': 'games',
      'tickerlink': 'ticker',
      'wordcloudlink': 'wordcloud',
      'polllink': 'poll',
      'flowactionslink': 'flowactions',
      'battlelink': 'battle',
      'chatbotlink': 'chatbot',
      'cohostlink': 'cohost',
      'giveawaylink': 'giveaway',
      'creditslink': 'credits',
      'privatechatbotlink': 'privatechatbot',
      'eventsdashboardlink': 'eventsdashboard',
      'custom-gif-commandslink': 'custom-gif-commands',
	  'scoreboardlink': 'scoreboard'
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
}

if (!chrome.browserAction){
	chrome.browserAction = {};
	
	if (chrome.action && chrome.action.setIcon){
		chrome.browserAction.setIcon = chrome.action.setIcon
	} else {
		chrome.browserAction.setIcon = function (icon) {};
	}
	
	function sendMessageToBackground(message, timeout = 15000) {
	  return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
		  reject(new Error('Response timeout'));
		}, timeout);

		chrome.runtime.sendMessage({type: 'toBackground', data: message}, response => { 
		  clearTimeout(timeoutId);
		  if (chrome.runtime.lastError) {
			reject(chrome.runtime.lastError);
		  } else {
			resolve(response);
		  }
		});
	  });
	}

	sendMessageToBackground({cmd: "getSettings"}, 20000).then(response => {
		log("Received response:", response);
		update(response, false);
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

function createCommandEntry(command = '', url = '') {
    function encodeHTML(str) {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }

    const entry = document.createElement('div');
    entry.className = 'custom-gif-command-entry';
    entry.innerHTML = `
        <div class="textInputContainer" style="width: 90%;">
            <input type="text" class="textInput custom-command" value="${encodeHTML(command)}" autocomplete="off" placeholder="!command" data-textsetting="customGifCommand" />
            <label><span data-translate="chat-command">&gt; Chat Command</span></label>
        </div>
        <div class="textInputContainer" style="width: 90%;">
            <input type="text" class="textInput custom-media-url" value="${encodeHTML(url)}" autocomplete="off" placeholder="https://media.giphy.com/media/..." data-textsetting="customGifUrl" />
            <label><span data-translate="media-url">&gt; Media URL (GIF, image, or video)</span></label>
        </div>
        <button class="removeCustomGifCommand" style="width: auto; min-width: 60px; padding: 0 5px;">
            <span data-translate="remove">Remove</span>
        </button>
    `;
    
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
    feedbackTimeout: null,
    
    init(voices) {
        this.voices = voices;
        if (!this.audio) {
            this.audio = document.createElement("audio");
            this.audio.onended = () => this.finishedAudio();
        }
        const menuWrapper = document.querySelector('#ttsButton');
        if (menuWrapper) {
            const container = document.createElement('div');
            container.className = 'tts-test-container';
            
            const testButton = document.createElement('button');
            testButton.textContent = "Test";
            testButton.className = "tts-test-button";
            testButton.onclick = () => this.testTTS();
            
            const feedback = document.createElement('div');
            feedback.className = 'tts-feedback hidden';
            feedback.id = 'ttsFeedback';
            
            container.appendChild(testButton);
            container.appendChild(feedback);
            menuWrapper.replaceWith(container);
			
			if (document.getElementById("listElevenLabsVoicesBtn")){
				document.getElementById('listElevenLabsVoicesBtn')?.addEventListener('click', async (e) => {
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
                `;
                document.head.appendChild(style);
            }
        }
    },
	

    getSettings() {
        const settings = {
            // Global settings
            speech: document.querySelector('[data-param1="speech"]')?.checked,
            volume: document.querySelector('[data-param1="volume"]').checked ?  parseFloat(document.querySelector('[data-numbersetting="volume"]')?.value) || 1.0 : 1.0,
			service: document.getElementById('ttsProvider').value || "system",
            
            // System TTS settings
            system: {
                lang: document.getElementById('systemLanguageSelect')?.selectedOptions[0]?.dataset.lang || 'en-US',
                voice: document.getElementById('systemLanguageSelect')?.selectedOptions[0]?.dataset.name,
                rate: document.querySelector('[data-param1="rate"]').checked ?  parseFloat(document.querySelector('[data-numbersetting="rate"]')?.value) || 1.0 : 1.0,
                pitch: document.querySelector('[data-param1="pitch"]').checked ? (parseFloat(document.querySelector('[data-numbersetting="pitch"]')?.value) || 1.0) : 1.0
            },
			
			// Kokoro TTS settings
            kokoro: {
                voice: document.getElementById('kokoroVoiceSelect')?.selectedOptions[0]?.value || "af_aoede",
                rate: document.querySelector('[data-param1="kokorospeed"]').checked ?  parseFloat(document.querySelector('[data-numbersetting="kokorospeed"]')?.value) || 1.0 : 1.0,
            },
            
            // Kitten TTS settings
            kitten: {
                voice: document.getElementById('kittenVoiceSelect')?.selectedOptions[0]?.value || "expr-voice-4-f",
                speed: document.querySelector('[data-param1="kittenspeed"]')?.checked ?  
                    parseFloat(document.querySelector('[data-numbersetting="kittenspeed"]')?.value) || 1.0 : 1.0,
                sampleRate: 24000  // Fixed value - not configurable in new library
            },
            
            // Google Cloud TTS settings
            google: {
                key: document.getElementById('googleAPIKey')?.value || document.getElementById('ttskey')?.value,
                voice: document.getElementById('googleVoiceName')?.value,
                lang:  document.querySelector('[data-param1="googlelang"]').checked ?  document.querySelector('[data-optionparam1="googlelang"]')?.value || 'en-US' : "en-US",
                rate: document.querySelector('[data-param1="googlerate"]').checked ? parseFloat(document.querySelector('[data-numbersetting="googlerate"]')?.value) || 1.0 : 1.0,
                pitch: document.querySelector('[data-param1="googlepitch"]').checked ? parseFloat(document.querySelector('[data-numbersetting="googlepitch"]')?.value) || 0 : 0,
                audioProfile: document.querySelector('[data-param1="googlepitch"]').checked ? document.querySelector('[data-optionparam1="googleaudioprofile"]')?.value : false
            },
            
            // ElevenLabs settings
			elevenLabs: {
				key: document.getElementById('elevenLabsKey')?.value,
				voice: document.getElementById('elevenLabsVoiceID')?.value,
				model: document.querySelector('[data-param1="elevenlabsmodel"]').checked ? 
					document.querySelector('[data-optionparam1="elevenlabsmodel"]')?.value || 'eleven_multilingual_v2' : 'eleven_multilingual_v2',
				latency: document.querySelector('[data-param1="elevenlatency"]').checked ? 
					parseInt(document.querySelector('[data-numbersetting="elevenlatency"]')?.value) || 0 : 4,
				stability: document.querySelector('[data-param1="elevenstability"]').checked ? 
					parseFloat(document.querySelector('[data-numbersetting="elevenstability"]')?.value) || 0.5 : 0.5,
				similarityBoost: document.querySelector('[data-param1="elevensimilarity"]').checked ? 
					parseFloat(document.querySelector('[data-numbersetting="elevensimilarity"]')?.value) || 0.75 : 0.75,
				style: document.querySelector('[data-param1="elevenstyle"]').checked ? 
					parseFloat(document.querySelector('[data-numbersetting="elevenstyle"]')?.value) || 0.5 : 0.5,
				speakerBoost: document.querySelector('[data-param1="elevenspeakerboost"]')?.checked || false,
				speakingRate: document.querySelector('[data-param1="elevenrate"]').checked ? 
					parseFloat(document.querySelector('[data-numbersetting="elevenrate"]')?.value) || 1.0 : 1.0
			},
            
            // Speechify settings
            speechify: {
                key: document.getElementById('speechifyAPIKey')?.value,
                voice: document.getElementById('speechifyVoiceID')?.value,
                lang: document.querySelector('[data-param1="speechifylang"]').checked ? document.querySelector('[data-optionparam1="speechifylang"]')?.value || 'en-US' : 'en-US',
                speed: document.querySelector('[data-param1="speechifyspeed"]').checked ? parseFloat(document.querySelector('[data-numbersetting="speechifyspeed"]')?.value) || 1.0 : 1.0,
                model: document.querySelector('[data-param1="speechifymodel"]').checked ? document.querySelector('[data-optionparam1="speechifymodel"]')?.value || 'simba-english' : 'simba-english'
            },
            
            // OpenAI settings
            openai: {
                key: document.getElementById('openaiAPIKey')?.value,
                endpoint: document.getElementById('openaiEndpoint')?.value || "https://api.openai.com/v1/audio/speech",
                voice: (() => {
                    const voiceSelect = document.getElementById('openaiVoiceSelect');
                    if (voiceSelect?.value === 'custom') {
                        const customVoice = document.getElementById('openaiCustomVoice')?.value;
                        return customVoice || 'alloy';
                    }
                    return voiceSelect?.value || 'alloy';
                })(),
                model: (() => {
                    if (document.querySelector('[data-param1="openaimodel"]').checked) {
                        const modelSelect = document.querySelector('[data-optionparam1="openaimodel"]');
                        if (modelSelect?.value === 'custom') {
                            const customModel = document.getElementById('openaiCustomModel')?.value;
                            return customModel || 'tts-1';
                        }
                        return modelSelect?.value || 'tts-1';
                    }
                    return 'tts-1';
                })(),
                speed: document.querySelector('[data-param1="openaispeed"]').checked ? 
                    parseFloat(document.querySelector('[data-numbersetting="openaispeed"]')?.value) || 1.0 : 1.0,
                format: document.querySelector('[data-param1="openaiformat"]').checked ? 
                    document.querySelector('[data-optionparam1="openaiformat"]')?.value || 'mp3' : 'mp3'
            }
        };
        
        return settings;
    },
    
    showFeedback(message, type = 'info') {
        const feedback = document.getElementById('ttsFeedback');
        if (feedback) {
            feedback.textContent = message;
            feedback.className = `tts-feedback ${type}`;
            
            if (this.feedbackTimeout) {
                clearTimeout(this.feedbackTimeout);
            }
            
            this.feedbackTimeout = setTimeout(() => {
                feedback.className = 'tts-feedback hidden';
            }, 5000);
        }
    },
	
    getServiceName() {
        const settings = this.getSettings();
		if (settings.service) {
            const provider = document.getElementById('ttsProvider');
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
    
    testTTS() {
        const testPhrase = "The quick brown fox jumps over the lazy dog";
        const serviceName = this.getServiceName();
        
        // Check if the provider supports testing
        const provider = document.getElementById('ttsProvider').value || "system";
        if (provider === 'piper' || provider === 'espeak') {
            let warningMsg = getTranslation("tts-test-not-available", "Testing is not available for {provider}. This TTS provider works during streaming only.");
            warningMsg = warningMsg.replace('{provider}', serviceName);
            this.showFeedback(warningMsg, 'error');
            return;
        }
        
        if (provider === 'kitten') {
            let warningMsg = getTranslation("tts-test-limited", "Testing for {provider} requires significant browser resources. Works best during streaming.");
            warningMsg = warningMsg.replace('{provider}', serviceName);
            this.showFeedback(warningMsg, 'warning');
            // Continue with test despite warning
        }
        
        this.showFeedback(`Testing ${serviceName}...`, 'info');
        
        const originalOnEnded = this.audio?.onended;
        const settings = this.getSettings();

        // Add success feedback after audio plays
        if (this.audio) {
            this.audio.onended = () => {
                this.showFeedback(`${serviceName} test completed successfully`, 'success');
                this.audio.onended = originalOnEnded;
                this.finishedAudio();
            };
        }

        try {
            // Check for required API keys if using premium services
            if (serviceName === 'Google Cloud TTS' && !settings.google.key) {
                throw new Error('Google Cloud API key is required');
            }
            if (serviceName === 'ElevenLabs TTS' && !settings.elevenLabs.key) {
                throw new Error('ElevenLabs API key is required');
            }
            if (serviceName === 'Speechify TTS' && !settings.speechify.key) {
                throw new Error('Speechify API key is required');
            }
            if (serviceName === 'OpenAI TTS' && !settings.openai.key) {
                throw new Error('OpenAI API key is required');
            }

            this.speak(testPhrase, true);
        } catch (error) {
            this.showFeedback(`${serviceName} Error: ${error.message}`, 'error');
            console.error(error);
        }
    },
	
	async speak(text, allow = false) {
        const settings = this.getSettings();
        
        if (!settings.speech && !allow) return;
        if (!text) return;
        
        try {
            if ((settings.service == "google") && settings.google.key) {
                if (!this.premiumQueueActive) {
                    await this.googleTTS(text, settings);
                } 
            } else if ((settings.service == "elevenlabs") && settings.elevenLabs.key) {
                if (!this.premiumQueueActive) {
                    await this.elevenLabsTTS(text, settings);
                } 
            } else if ((settings.service == "speechify") && settings.speechify.key) {
                if (!this.premiumQueueActive) {
                    await this.speechifyTTS(text, settings);
                }
            } else if ((settings.service == "openai") && settings.openai.key) {
                if (!this.premiumQueueActive) {
                    await this.openaiTTS(text, settings);
                }
			} else if (settings.service == "kokoro") {
                if (!this.premiumQueueActive) {
                    await this.kokoroTTS(text, settings);
                }
            } else if (settings.service == "kitten") {
                if (!this.premiumQueueActive) {
                    await this.kittenTTS(text, settings);
                }
            } else if (!settings.service || (settings.service == "system")) {
                this.systemTTS(text, settings);
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
	
	async kokoroTTS(text, settings) {
		try {
			if (ssapp){
				try {
					// Get WAV buffer directly from main process
					
					const wavBuffer = await ipcRenderer.invoke("tts", {text, settings: (settings?.kokoro || {} )});
					
					// Create blob from buffer
					const audioBlob = new Blob([wavBuffer], { type: "audio/wav" });
					
					// Play the audio
					const audioElement = document.createElement("audio");
					audioElement.src = URL.createObjectURL(audioBlob);
					audioElement.onended = this.finishedAudio;
					
					// Set volume if needed
					//const settings = { volume: 0.8 }; // Replace with your actual settings
					//if (settings.volume) audioElement.volume = settings.volume;
					
					audioElement.play();
					return;
			  } catch (error) {
				console.error("Error playing TTS:", error);
				throw new Error("Error playing TTS. Try upgrading your app or perhaps your system ins't compatible");
			  }
			}
			
			if (!kokoroTtsInstance) {
				const initialized = await initKokoro();
				if (!initialized) {
					this.finishedAudio();
					return;
				}
			}
			premiumQueueActive = true;
			const streamer = new TextSplitterStream();
			streamer.push(text);
			streamer.close();
			
			const audioElement = document.createElement("audio");
			audioElement.onended = this.finishedAudio;
			
			const stream = kokoroTtsInstance.stream(streamer, { 
				voice: settings.kokoro.voice || "af_aoede",
				speed: settings.kokoro.rate || 1.0,
				streamAudio: false 
			});

			for await (const { audio } of stream) {
				if (!audio) {
					this.finishedAudio();
					return;
				}
				
				const audioBlob = audio.toBlob();
				audioElement.src = URL.createObjectURL(audioBlob);
				if (settings.volume) audioElement.volume = settings.volume;
				
				try {
					await audioElement.play();
				} catch (e) {
					this.finishedAudio();
					console.error(e);
					errorlog("REMEMBER TO CLICK THE PAGE FIRST - audio won't play until you do");
				}
			}
		} catch (e) {
			console.error("Kokoro TTS error:", e);
			this.finishedAudio();
		}
	},
    
    async kittenTTS(text, settings) {
        try {
            // Load ONNX Runtime first if not loaded
            if (typeof ort === 'undefined') {
                const ortScript = document.createElement('script');
                ortScript.src = './thirdparty/ort.min.js';
                await new Promise((resolve, reject) => {
                    ortScript.onload = resolve;
                    ortScript.onerror = reject;
                    document.head.appendChild(ortScript);
                });
                
                // Configure WASM paths after loading ONNX Runtime
                if (typeof ort !== 'undefined' && ort.env && ort.env.wasm) {
                    ort.env.wasm.wasmPaths = './thirdparty/';
                    ort.env.wasm.numThreads = 1;
                    ort.env.wasm.simd = false;
                    console.log("Configured ONNX Runtime WASM paths for popup");
                }
            }
            
            // Load Kitten TTS module if not loaded
            if (!window.kittenTtsInstance) {
                // Use absolute URL for chrome extension context
                const baseUrl = chrome.runtime.getURL('');
                const moduleUrl = baseUrl + 'thirdparty/kitten-tts/kitten-tts-lib.js';
                
                const { KittenTTS } = await import(moduleUrl);
                
                window.kittenTtsInstance = new KittenTTS();
                
                // Initialize with model, voices, and WASM paths using absolute URLs
                const modelUrl = baseUrl + 'thirdparty/kitten-tts/kitten_tts_nano_v0_1.onnx';
                const voicesUrl = baseUrl + 'thirdparty/kitten-tts/voices.json';
                // Don't set WASM path - let ONNX runtime use its default
                await window.kittenTtsInstance.init(modelUrl, voicesUrl);
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
        
        const data = {
            model: settings.openai.model,
            input: text,
            voice: settings.openai.voice,
            response_format: settings.openai.format,
            speed: settings.openai.speed
        };
        
        this.fetchAudioContent(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.openai.key}`
            },
            body: JSON.stringify(data)
        }, 'blob');
    },
    
    async fetchAudioContent(url, options, type) {
		try {
			const response = await fetch(url, options);
			
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
			this.showFeedback(`Audio fetch error: ${error.message}`, 'error');
			console.error("Error fetching audio:", error);
			this.finishedAudio();
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
    
    finishedAudio() {
        this.premiumQueueActive = false;
    },
};

var TextSplitterStream = null;
var KokoroTTS = false;
var kokoroDownloadInProgress  = null;
var kokoroTtsInstance = null;

async function initKokoro() {
	if (ssapp) return false;
	if (kokoroDownloadInProgress) return false;
	
	if (!KokoroTTS) {
	
		async function openDB() {
			return new Promise((resolve, reject) => {
				const request = indexedDB.open('kokoroTTS', 1);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result);
				request.onupgradeneeded = (event) => {
					const db = event.target.result;
					if (!db.objectStoreNames.contains('models')) {
						db.createObjectStore('models');
					}
				};
			});
		}

		async function getCachedModel() {
			const db = await openDB();
			return new Promise((resolve, reject) => {
				const transaction = db.transaction('models', 'readonly');
				const store = transaction.objectStore('models');
				const request = store.get('kokoro-82M-v1.0');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result);
			});
		}

		async function cacheModel(modelData) {
			const db = await openDB();
			return new Promise((resolve, reject) => {
				const transaction = db.transaction('models', 'readwrite');
				const store = transaction.objectStore('models');
				const request = store.put(modelData, 'kokoro-82M-v1.0');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve();
			});
		}
	
		try {
			kokoroDownloadInProgress = true;
			console.log("Loading Kokoro dependencies...");
			const module = window.location.href.startsWith("chrome-extension://") ? await import('./thirdparty/kokoro-bundle.es.ext.js') : await import('./thirdparty/kokoro-bundle.es.js');
			KokoroTTS = module.KokoroTTS;
			TextSplitterStream = module.TextSplitterStream;
			const detectWebGPU = module.detectWebGPU;
			
			// Initialize IndexedDB handling
			const DB_NAME = 'kokoroTTS';
			const STORE_NAME = 'models';
			const MODEL_KEY = 'kokoro-82M-v1.0';
			
			let device = (await detectWebGPU()) ? "webgpu" : "wasm";
			console.log("Using device:", device);
			
			// Check cache first
			console.log("Checking cache for model...");
			let modelData = await getCachedModel();
			
			if (!modelData) {
				console.log("Downloading model...");
				const modelUrl = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx';
				const response = await fetch(modelUrl);
				const total = +response.headers.get('Content-Length');
				let loaded = 0;
				
				const reader = response.body.getReader();
				const chunks = [];
				
				while (true) {
					const {done, value} = await reader.read();
					if (done) break;
					
					chunks.push(value);
					loaded += value.length;
					
					const percentage = (loaded / total) * 100;
					console.log(`Downloading model: ${percentage.toFixed(1)}%`);
				}
				
				const modelBlob = new Blob(chunks);
				modelData = new Uint8Array(await modelBlob.arrayBuffer());
				
				console.log("Caching model...");
				await cacheModel(modelData);
			} else {
				console.log("Loading model from cache");
			}
			
			console.log("Initializing Kokoro TTS...");
			try {
				const customLoadFn = async () => modelData;
				kokoroTtsInstance = await KokoroTTS.from_pretrained(
					"onnx-community/Kokoro-82M-v1.0-ONNX",
					{
						dtype: device === "wasm" ? "q8" : "fp32",
						device,
						load_fn: customLoadFn
					}
				);

			} catch(e){
				console.error(e);
				if (device === "webgpu"){
					device = "wasm";
					try {
						const customLoadFn = async () => modelData;
						kokoroTtsInstance = await KokoroTTS.from_pretrained(
							"onnx-community/Kokoro-82M-v1.0-ONNX",
							{
								dtype: device === "wasm" ? "q8" : "fp32",
								device,
								load_fn: customLoadFn
							}
						);
					} catch(e){
						console.error(e);
						device = "auto";
						const customLoadFn = async () => modelData;
						kokoroTtsInstance = await KokoroTTS.from_pretrained(
							"onnx-community/Kokoro-82M-v1.0-ONNX",
							{
								dtype: "q8", //device === "wasm" ? "q8" : "fp16",
								device,
								load_fn: customLoadFn
							}
						);
					}
				}
			}
			
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
            pollStyle: document.querySelector('[data-optionsetting="pollStyle"]').value,
            pollTimer: document.querySelector('[data-numbersetting="pollTimer"]').value,
            pollTimerState: document.querySelector('[data-setting="pollTimerState"]').checked,
            pollTally: document.querySelector('[data-setting="pollTally"]').checked,
            pollSpam: document.querySelector('[data-setting="pollSpam"]').checked
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
            pollStyle: 'default',
            pollTimer: 60,
            pollTimerState: false,
            pollTally: false,
            pollSpam: false
        };

        const elements = {
            '[data-optionsetting="pollType"]': defaultSettings.pollType,
            '[data-textsetting="pollQuestion"]': defaultSettings.pollQuestion,
            '[data-textsetting="multipleChoiceOptions"]': defaultSettings.multipleChoiceOptions,
            '[data-optionsetting="pollStyle"]': defaultSettings.pollStyle,
            '[data-numbersetting="pollTimer"]': defaultSettings.pollTimer,
            '[data-setting="pollTimerState"]': defaultSettings.pollTimerState,
            '[data-setting="pollTally"]': defaultSettings.pollTally,
            '[data-setting="pollSpam"]': defaultSettings.pollSpam
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
            '[data-optionsetting="pollStyle"]': poll.settings.pollStyle,
            '[data-numbersetting="pollTimer"]': poll.settings.pollTimer,
            '[data-setting="pollTimerState"]': poll.settings.pollTimerState,
            '[data-setting="pollTally"]': poll.settings.pollTally,
            '[data-setting="pollSpam"]': poll.settings.pollSpam
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


document.addEventListener("DOMContentLoaded", async function(event) {
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
	
	// Add event listener for save profile button
	const saveProfileBtn = document.querySelector('button[data-action="saveProfile"]');
	if (saveProfileBtn) {
		saveProfileBtn.addEventListener('click', function() {
			ProfileManager.saveCurrentProfile();
		});
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
	
	// Setup for all three sections
	setupOpenAICustomInputs('openaiVoiceSelect', 'openaiModelSelect', 'openaiCustomVoice', 'openaiCustomModel');
	setupOpenAICustomInputs('openaiVoiceSelect2', 'openaiModelSelect2', 'openaiCustomVoice2', 'openaiCustomModel2');
	setupOpenAICustomInputs('openaiVoiceSelect10', 'openaiModelSelect10', 'openaiCustomVoice10', 'openaiCustomModel10');
	
	// Language selector handling
	const languageIcon = document.getElementById('languageIcon');
	const languageSelector = document.getElementById('language-selector-container');
	
	// Hide language icon if &ln parameter is present
	if (urlParams.has("ln")) {
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
		// Get reference to the select element first
		const sourceSelector = document.getElementById('source-selector');
		
		// Check if the element exists
		if (!sourceSelector) {
		  console.error("Could not find source-selector element");
		  return;
		}
		
		const manifestData = chrome.runtime.getManifest();
		
		if (manifestData && manifestData.content_scripts) {
		  // Set to store unique source files
		  
		  
		  // Extract source filenames from content_scripts
		  manifestData.content_scripts.forEach(script => {
			if (script.js && script.js.length > 0) {
			  script.js.forEach(jsFile => {
				if (jsFile.startsWith('./sources/') && jsFile.endsWith('.js')) {
				  // Extract just the filename without path and extension
				  const sourceName = jsFile.replace('./sources/', '').replace('.js', '');
				  sourcesList.add(sourceName);
				}
			  });
			}
		  });
		  
		  // Create and add options for each source
		  Array.from(sourcesList).sort().forEach(source => {
			const option = document.createElement('option');
			option.value = source;
			// Capitalize first letter for display
			option.textContent = source.charAt(0).toUpperCase() + source.slice(1);
			sourceSelector.appendChild(option);
		  });
		}
		
		document.getElementById("custominject").classList.remove("hidden");
		document.getElementById('inject-button').addEventListener('click', function() {
		  const source = document.getElementById('source-selector').value;
		  
		  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			chrome.runtime.sendMessage({
			  type: 'injectCustomSource', // Changed 'type' to 'action' to match service_worker listener
			  source: source,
			  tabId: tabs[0].id
			});
		  });
		});
	}
	
	document.getElementById('addCustomGifCommand').addEventListener('click', function() {
		const commandsList = document.getElementById('customGifCommandsList');
		const newCommandEntry = createCommandEntry();
		commandsList.appendChild(newCommandEntry);
		updateSettings(newCommandEntry, true);
	});
	
	document.querySelectorAll("[data-copy]").forEach(ele=>{
		ele.onclick = copyToClipboard;
	});
	
	
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
			
			// Replace text input with select dropdown if sourcesList is available
			if (sourcesList && sourcesList.size > 0) {
			  addContainer.innerHTML = `
				<input type="text" id="new${id}" placeholder="Add username">
				<select id="new${id}Type">
				  <option value="" selected>Select Sources</option>
				  ${Array.from(sourcesList).sort().map(source => 
					`<option value="${source}">${source.charAt(0).toUpperCase() + source.slice(1)}</option>`
				  ).join('')}
				</select>
				<button id="add${id}">Add</button>
			  `;
			} else {
			  addContainer.innerHTML = `
				<input type="text" id="new${id}" placeholder="Add username">
				<input type="text" id="new${id}Type" placeholder="Source type (optional)">
				<button id="add${id}">Add</button>
			  `;
			}
			
			container.parentNode.classList.add("isolate");
			container.parentNode.insertBefore(listContainer, container.nextSibling);
			container.parentNode.insertBefore(addContainer, listContainer.nextSibling);
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
				
				// Replace text input with select dropdown if sourcesList is available
				if (sourcesList && sourcesList.size > 0) {
				  addContainer.innerHTML = `
					<select id="new${id}Type">
					  <option value="" selected>Select Sources</option>
					  ${Array.from(sourcesList).sort().map(source => 
						`<option value="${source}">${source.charAt(0).toUpperCase() + source.slice(1)}</option>`
					  ).join('')}
					</select>
					<button id="add${id}">Add</button>
				  `;
				} else {
				  addContainer.innerHTML = `
					<input type="text" id="new${id}Type" placeholder="Source type">
					<button id="add${id}">Add</button>
				  `;
				}
				
				container.parentNode.classList.add("isolate");
				container.parentNode.insertBefore(listContainer, container.nextSibling);
				container.parentNode.insertBefore(addContainer, listContainer.nextSibling);
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
	
	setTimeout(function(){
		populateFontDropdown(); 
		if (typeof PollManager !== 'undefined') {
			PollManager.init();
		}
	},1000);
	
	// populate language drop down
	if (speechSynthesis){
		async function populateVoices() {
			const voices = createUniqueVoiceIdentifiers(speechSynthesis.getVoices());

			voices.sort((a, b) => {
				if (a.default) {
					return -1; // a is the default, move a to the front
				} else if (b.default) {
					return 1; // b is the default, move b to the front
				} else {
					return 0; // neither a nor b is the default, keep original order
				}
			});

			const populateDropdown = (dropdownId) => {
				const dropdown = document.getElementById(dropdownId);
				if (!dropdown) return;

				const existingOptions = new Set(Array.from(dropdown.options).map(option => option.textContent));

				voices.forEach(voice => {
					const voiceText = `${voice.name} (${voice.lang})`;
					if (!existingOptions.has(voiceText)) {
						const option = document.createElement('option');
						option.textContent = voiceText;
						option.value = voice.code; // This sets the value attribute
						option.code = voice.code;   // <--- THIS IS THE CRUCIAL LINE THAT WAS MISSING
						option.setAttribute('data-lang', voice.lang);
						option.setAttribute('data-name', voice.name);
						dropdown.appendChild(option);
					}
				});
			};

			populateDropdown('systemLanguageSelect');
			populateDropdown('languageSelect2');
			populateDropdown('systemLanguageSelect10');

			if (typeof TTSManager !== 'undefined') {
				try {
					TTSManager.init(voices)
				} catch(e){
					console.error(e);
				}
			}
		}
		speechSynthesis.onvoiceschanged = populateVoices;
		
		document.getElementById('searchInput').addEventListener('keyup', function(e) {
			// Handle escape key to close search
			if (e.key === 'Escape') {
				this.value = '';
				this.style.display = 'none';
				this.style.width = '0';
				// Reset all visibility
				document.querySelectorAll('input.collapsible-input').forEach(ele => {
					ele.checked = null;
				});
				document.querySelectorAll('.wrapper').forEach(ele => {
					ele.style.display = "";
				});
				document.querySelectorAll('.options_group > div').forEach(ele => {
					ele.style.display = "";
				});
				return;
			}
			
			var searchQuery = this.value.toLowerCase();
			
			if (searchQuery){
				document.querySelectorAll('input.collapsible-input').forEach(ele=>{
					ele.checked = true
				});
				document.querySelectorAll('.wrapper').forEach(w=>{
					var menuItems = w.querySelectorAll('.options_group > div');
					var matches = 0;
					menuItems.forEach(function(item) {
						var text = item.textContent.toLowerCase();
						
						if (item.querySelector("[title]")){
							text += " " + item.querySelector("[title]").title.toLowerCase();
						}
						
						// Include data-keywords for better searchability
						if (item.dataset.keywords) {
							text += " " + item.dataset.keywords.toLowerCase();
						}
						
						if (item.querySelector("input")){
							[...item.querySelector("input").attributes].forEach(att=>{
								if (att.name.startsWith("data-")){
									text += " " + att.value.toLowerCase();
								}
							});
						}
						if (text.includes(searchQuery)) {
							item.style.display = '';
							matches += 1;
						} else {
							item.style.display = 'none';
						}
					});
					if (!matches){
						w.style.display = "none";
					} else {
						w.style.display = "";
					}
				});
			} else {
				document.querySelectorAll('input.collapsible-input').forEach(ele=>{
					ele.checked = null
				});
				document.querySelectorAll('.wrapper').forEach(ele=>{
					ele.style.display = "";
				});
				document.querySelectorAll('.options_group > div').forEach(ele=>{
					ele.style.display = "";
				});
			}
		});
	}
	
	document.getElementById('searchIcon').addEventListener('click', function() {
		var searchInput = document.getElementById('searchInput');
		if (searchInput.style.display === 'none' || searchInput.style.display === '') {
			searchInput.style.display = 'block';
			searchInput.style.width = 'calc(100% - 35px)'; // Match this with your CSS width
			searchInput.focus(); // Optional: Focus on the input field when it's shown
		} else {
			searchInput.style.display = 'none';
			searchInput.style.width = '0';
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
						alert(`Successfully ${action === 'set' ? 'set' : action + 'ed'} ${points} points ${action === 'subtract' ? 'from' : 'for'} ${username}. New balance: ${response.newBalance}`);
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
			// Open leaderboard in new tab
			chrome.tabs.create({
				url: chrome.runtime.getURL('leaderboard.html')
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
	
	// Save on input change
	if (spotifyClientIdInput) {
		spotifyClientIdInput.addEventListener('change', saveSpotifyCredentials);
		spotifyClientIdInput.addEventListener('blur', saveSpotifyCredentials);
	}
	
	if (spotifyClientSecretInput) {
		spotifyClientSecretInput.addEventListener('change', saveSpotifyCredentials);
		spotifyClientSecretInput.addEventListener('blur', saveSpotifyCredentials);
	}
	
	// Spotify Auth Button
	const spotifyAuthButton = document.getElementById('spotifyAuthButton');
	const spotifyAuthStatus = document.getElementById('spotifyAuthStatus');
	const spotifySignOutButton = document.getElementById('spotifySignOutButton');
	
	if (spotifyAuthButton) {
		// Check if already authenticated (tokens are stored in settings object)
		chrome.storage.local.get(['settings'], function(result) {
			if (result.settings && result.settings.spotifyAccessToken) {
				spotifyAuthStatus.style.display = 'inline';
				spotifyAuthButton.querySelector('span').textContent = '🔄 Reconnect to Spotify';
				if (spotifySignOutButton) {
					spotifySignOutButton.style.display = 'inline-block';
				}
			}
		});
		
		// Add manual callback handler for Electron app (ssapp)
		if (window.ssapp) {
			// Add a text input for manual callback URL
			const callbackDiv = document.createElement('div');
			callbackDiv.style.marginTop = '10px';
			callbackDiv.style.display = 'none';
			callbackDiv.id = 'spotifyCallbackDiv';
			callbackDiv.innerHTML = `
				<input type="text" id="spotifyCallbackInput" placeholder="Paste callback URL here" style="width: 100%; padding: 5px; margin: 5px 0;">
				<button id="spotifyCallbackSubmit" class="button">Complete Auth</button>
			`;
			spotifyAuthButton.parentElement.appendChild(callbackDiv);
			
			// Only show callback input as a fallback if automatic auth fails
			// Don't show it immediately anymore since we have automatic detection
			
			// Handle callback submission
			document.getElementById('spotifyCallbackSubmit')?.addEventListener('click', function() {
				const callbackUrl = document.getElementById('spotifyCallbackInput').value;
				if (callbackUrl && callbackUrl.includes('code=')) {
					chrome.runtime.sendMessage({
						cmd: "spotifyManualCallback",
						url: callbackUrl
					}, response => {
						console.log("Manual callback result:", response);
						if (response && response.success) {
							spotifyAuthStatus.style.display = 'inline';
							spotifyAuthButton.querySelector('span').textContent = '🔄 Reconnect to Spotify';
							if (spotifySignOutButton) {
								spotifySignOutButton.style.display = 'inline-block';
							}
							callbackDiv.style.display = 'none';
							document.getElementById('spotifyCallbackInput').value = '';
							alert('Spotify connected successfully!');
						} else {
							alert('Failed to process callback: ' + (response?.error || 'Unknown error'));
						}
					});
				} else {
					alert('Please paste the complete callback URL');
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
			
			// Try to open the background page directly if needed
			try {
				// First, try to communicate normally
				chrome.runtime.sendMessage({cmd: "spotifyAuth"}, function(response) {
					// Check for Chrome runtime errors
					if (chrome.runtime.lastError) {
						console.error('Chrome runtime error:', chrome.runtime.lastError);
						// If communication failed, try opening background page directly
						chrome.tabs.create({
							url: chrome.runtime.getURL('background.html'),
							active: false
						}, function(tab) {
							// Wait a bit for background page to load, then retry
							setTimeout(() => {
								chrome.runtime.sendMessage({cmd: "spotifyAuth"}, function(retryResponse) {
									handleSpotifyAuthResponse(retryResponse);
								});
							}, 2000);
						});
						return;
					}
					
					handleSpotifyAuthResponse(response);
				});
			} catch (error) {
				console.error('Error during Spotify auth:', error);
				spotifyAuthButton.disabled = false;
				spotifyAuthButton.querySelector('span').textContent = '🔗 Connect to Spotify';
				alert('Failed to initiate Spotify connection. Please try again.');
			}
			
			function handleSpotifyAuthResponse(response) {
				console.log('Spotify auth response received:', response);
				spotifyAuthButton.disabled = false;
				const callbackDiv = document.getElementById('spotifyCallbackDiv');
				
				if (response && response.success) {
					spotifyAuthStatus.style.display = 'inline';
					spotifyAuthButton.querySelector('span').textContent = '🔄 Reconnect to Spotify';
					if (spotifySignOutButton) {
						spotifySignOutButton.style.display = 'inline-block';
					}
					// Hide manual callback input on success
					if (window.ssapp && callbackDiv) {
						callbackDiv.style.display = 'none';
						document.getElementById('spotifyCallbackInput').value = '';
					}
					// Show success message if already connected
					if (response.alreadyConnected) {
						console.log('Already connected to Spotify');
					} else if (response.message && response.message.includes('authorization')) {
						// For SSAPP, the OAuth window opened - wait for callback
						console.log('OAuth window opened - waiting for authorization');
						spotifyAuthButton.querySelector('span').textContent = '⏳ Waiting for authorization...';
						// Show manual input as backup after 5 seconds
						if (window.ssapp && callbackDiv) {
							setTimeout(() => {
								if (!spotifyAuthStatus.style.display || spotifyAuthStatus.style.display === 'none') {
									callbackDiv.style.display = 'block';
									console.log('If the authorization window is stuck, you can paste the callback URL manually.');
								}
							}, 5000);
						}
					}
				} else {
					spotifyAuthButton.querySelector('span').textContent = '🔗 Connect to Spotify';
					const errorMsg = response?.error || 'Unknown error';
					console.error('Spotify auth failed:', errorMsg);
					
					// Show manual callback input only if in Electron and auth failed
					if (window.ssapp && callbackDiv && (response?.needsManualCallback || response?.waitingForManualCallback)) {
						callbackDiv.style.display = 'block';
						console.log('Please paste the callback URL manually.');
					}
					
					// Only show alert if not already connected
					if (errorMsg !== 'Already connected') {
						alert('Failed to connect to Spotify. Error: ' + errorMsg + '\n\nPlease ensure:\n1. Spotify integration is enabled\n2. Client ID and Secret are filled in\n3. Your redirect URIs are configured in Spotify app settings');
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
				chrome.runtime.sendMessage({cmd: "spotifySignOut"}, function(response) {
					if (chrome.runtime.lastError) {
						console.error('Error signing out:', chrome.runtime.lastError);
						alert('Failed to sign out. Please try again.');
						return;
					}
					
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

	let initialSetup = setInterval(()=>{
		log("pop up asking main for settings yet again..");
		chrome.runtime.sendMessage({cmd: "getSettings"}, (response) => {
			chrome.runtime.lastError;
			log("getSettings response",response);
			if ((response == undefined) || (!response.streamID)){
				
			} else {
				clearInterval(initialSetup);
				update(response, false); // we dont want to sync things
			}
		});
	}, 500);
	
	log("pop up asking main for settings");
	chrome.runtime.sendMessage({cmd: "getSettings"}, (response) => {
		chrome.runtime.lastError;
		log("getSettings response",response);
		if ((response == undefined) || (!response.streamID)){
			
		} else {
			clearInterval(initialSetup);
			update(response, false); // we dont want to sync things
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
			// Save the setting directly
			chrome.runtime.sendMessage({
				cmd: "saveSetting",
				type: "optionsetting",
				setting: "translationlanguage",
				value: this.value
			}, function(response) {
				console.log("Setting saved, reloading page");
				// Reload after the setting is saved
				window.location.reload();
			});
		};
	} else {
		console.log("Language selector NOT found!");
	}
	
	// Handle featured preset selector
	const presetSelector = document.getElementById('featured-preset-select');
	if (presetSelector) {
		presetSelector.addEventListener('change', function() {
			const overlayDiv = document.getElementById('overlay');
			const overlayLink = document.getElementById('overlaylink');
			
			if (!overlayDiv || !overlayLink) return;
			
			// Hide all preset configuration sections first
			document.querySelectorAll('.preset-config-section').forEach(section => {
				section.style.display = 'none';
			});
			
			if (this.value) {
				// A preset is selected - use the preset URL
				const presetUrl = baseURL + this.value;
				
				// Get the current parameters from the classic featured.html
				const currentParams = overlayDiv.raw?.split('?')[1] || '';
				
				// Extract session/room parameter
				const urlParams = new URLSearchParams(currentParams);
				const session = urlParams.get('session') || urlParams.get('room') || '';
				
				// Build the new URL with session parameter
				let newUrl = presetUrl;
				if (session) {
					newUrl += (presetUrl.includes('?') ? '&' : '?') + 'session=' + session;
				}
				
				// Update the display
				overlayDiv.raw = newUrl;
				overlayLink.href = newUrl;
				overlayLink.innerText = document.body.classList.contains("hidelinks") ? "Click to open link" : newUrl;
				
				// Hide classic customization options
				document.querySelectorAll('.wrapper:has(.options_group.single_message)').forEach(wrapper => {
					wrapper.style.display = 'none';
				});
				
				// Show the specific preset configuration based on selection
				const presetType = this.value.match(/featured-(\w+)\.html/)?.[1];
				if (presetType) {
					const presetConfigSection = document.getElementById(`preset-config-${presetType}`);
					if (presetConfigSection) {
						presetConfigSection.style.display = 'block';
					}
				}
			} else {
				// Classic mode selected - restore featured.html
				const currentParams = overlayDiv.raw?.split('?')[1] || '';
				const classicUrl = baseURL + 'featured.html' + (currentParams ? '?' + currentParams : '');
				
				overlayDiv.raw = classicUrl;
				overlayLink.href = classicUrl;
				overlayLink.innerText = document.body.classList.contains("hidelinks") ? "Click to open link" : classicUrl;
				
				// Show classic customization options
				document.querySelectorAll('.wrapper:has(.options_group.single_message)').forEach(wrapper => {
					wrapper.style.display = '';
				});
			}
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
			
			if (this.value) {
				// A game was selected
				const gameUrl = baseURL + this.value;
				
				// Extract existing parameters from current URL
				let existingParams = '';
				if (overlayDiv.raw && overlayDiv.raw.includes('?')) {
					existingParams = overlayDiv.raw.split('?')[1];
				}
				
				// Extract session parameter to preserve it
				let sessionParam = '';
				if (existingParams) {
					const params = new URLSearchParams(existingParams);
					const session = params.get('session') || params.get('s');
					if (session) {
						sessionParam = session;
					}
				}
				
				// Construct new URL with game
				let newUrl = gameUrl;
				if (sessionParam) {
					newUrl += '?session=' + sessionParam;
				}
				
				// Update the overlay URL
				overlayDiv.raw = newUrl;
				overlayLink.href = newUrl;
				overlayLink.innerText = document.body.classList.contains("hidelinks") ? "Click to open link" : newUrl;
				
				// Show game-specific config section
				const gameType = this.value.match(/games\/(\w+)\.html/);
				if (gameType && gameType[1]) {
					const configSection = document.getElementById(gameType[1] + '-config');
					if (configSection) {
						configSection.style.display = 'block';
					}
				}
				
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
			const dockDiv = document.getElementById('dock');
			const dockLink = document.querySelector('#dock a, a[href*="dock.html"]');
			
			if (!dockDiv) return;
			
			// Hide all overlay config sections (if we add them later)
			document.querySelectorAll('.overlay-config-section').forEach(section => {
				section.style.display = 'none';
			});
			
			if (this.value) {
				// An overlay theme was selected
				const overlayUrl = baseURL + this.value;
				
				// Extract existing parameters from current dock URL
				let existingParams = '';
				if (dockDiv.raw && dockDiv.raw.includes('?')) {
					existingParams = dockDiv.raw.split('?')[1];
				}
				
				// Preserve ALL parameters, not just session
				let newUrl = overlayUrl;
				if (existingParams) {
					newUrl += '?' + existingParams;
				}
				
				// Update the dock URL
				dockDiv.raw = newUrl;
				if (dockLink) {
					dockLink.href = newUrl;
					dockLink.innerText = document.body.classList.contains("hidelinks") ? "Click to open link" : newUrl;
				}
				
				// Show overlay-specific config section (for future use)
				let overlayType = '';
				if (this.value.includes('themes/overlay-')) {
					// Handle new animated overlays in themes folder
					overlayType = this.value.replace('themes/', '').replace('.html', '');
				} else if (this.value.match(/themes\/(\w+)\//)) {
					// Handle theme folders like themes/Neutron/
					overlayType = this.value.match(/themes\/(\w+)\//)[1];
				} else {
					// Handle other files
					overlayType = this.value.replace('.html', '');
				}
				
				const configSection = document.getElementById(overlayType + '-overlay-config');
				if (configSection) {
					configSection.style.display = 'block';
				}
				
				// Hide classic dock options when an overlay theme is selected
				document.querySelectorAll('.wrapper:has(.options_group.streaming_chat)').forEach(wrapper => {
					wrapper.style.display = 'none';
				});
			} else {
				// Classic dock.html selected - restore all parameters
				let existingParams = '';
				if (dockDiv.raw && dockDiv.raw.includes('?')) {
					existingParams = dockDiv.raw.split('?')[1];
				}
				
				let newUrl = baseURL + 'dock.html';
				if (existingParams) {
					newUrl += '?' + existingParams;
				}
				
				// Update the dock URL back to classic
				dockDiv.raw = newUrl;
				if (dockLink) {
					dockLink.href = newUrl;
					dockLink.innerText = document.body.classList.contains("hidelinks") ? "Click to open link" : newUrl;
				}
				
				// Show classic dock customization options
				document.querySelectorAll('.wrapper:has(.options_group.streaming_chat)').forEach(wrapper => {
					wrapper.style.display = '';
				});
			}
		});
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
			if (msg.cmd == "fakemsg"){
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
			// Open the media hosting service in a popup window
			const popup = window.open('https://fileuploads.socialstream.ninja/popup/upload', 'uploadBeep', 'width=640,height=640');
			
			// Listen for message from the popup
			window.addEventListener('message', function handleMessage(event) {
				// Verify the origin for security
				if (event.origin !== 'https://fileuploads.socialstream.ninja') return;
				
				// Check if this is our media upload message
				if (event.data && event.data.type === 'media-uploaded') {
					// Fill the custom beep input with the uploaded URL
					const customBeepInput = document.getElementById('custombeep');
					if (customBeepInput) {
						customBeepInput.value = event.data.url;
						// Trigger change event to save the value
						customBeepInput.dispatchEvent(new Event('input', { bubbles: true }));
						customBeepInput.dispatchEvent(new Event('change', { bubbles: true }));
					}
					
					// Remove this specific listener
					window.removeEventListener('message', handleMessage);
				}
			});
		};
	}

	// Handle second custom beep upload button
	const uploadBeepBtn2 = document.getElementById('uploadBeepBtn2');
	if (uploadBeepBtn2) {
		uploadBeepBtn2.onclick = function() {
			// Open the media hosting service in a popup window
			const popup = window.open('https://fileuploads.socialstream.ninja/popup/upload', 'uploadBeep2', 'width=640,height=640');
			
			// Listen for message from the popup
			window.addEventListener('message', function handleMessage(event) {
				// Verify the origin for security
				if (event.origin !== 'https://fileuploads.socialstream.ninja') return;
				
				// Check if this is our media upload message
				if (event.data && event.data.type === 'media-uploaded') {
					// Fill the second custom beep input with the uploaded URL
					const customBeepInput2 = document.getElementById('custombeep2');
					if (customBeepInput2) {
						customBeepInput2.value = event.data.url;
						// Trigger change event to save the value
						customBeepInput2.dispatchEvent(new Event('input', { bubbles: true }));
						customBeepInput2.dispatchEvent(new Event('change', { bubbles: true }));
					}
					
					// Remove this specific listener
					window.removeEventListener('message', handleMessage);
				}
			});
		};
	}
});
