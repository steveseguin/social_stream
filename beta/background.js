try {
	if (document.title=="Keep Open - Social Stream Ninja"){
		window.close();
	}
	if (document.title == "Close me - Social Stream Ninja"){
		window.close();
	}
} catch(e){}

var isExtensionOn = false;
var iframe = null;

var settings = {};
var messageTimeout = {};
var lastSentMessage = "";
var lastSentTimestamp = 0;
var lastMessageCounter = 0;
var sentimentAnalysisLoaded = false;

var messageCounterBase = Math.floor(Math.random() * 90000);
var messageCounter = messageCounterBase;
var lastAntiSpam = 0;

var connectedPeers = {};
var isSSAPP = false;

var urlParams = new URLSearchParams(window.location.search);
var devmode = urlParams.has("devmode") || false;

var FacebookDupes = "";
var FacebookDupesTime = null;

var fetchNode = false;
var postNode = false;
var putNode = false;

var properties = ["streamID", "password", "state", "settings"];
var streamID = false;
var password = false;

function log(msg, msg2 = null) {
	if (devmode) {
		if (msg2 !== null) {
			console.log(msg, msg2);
		} else {
			console.log(msg);
		}
	}
}
function warnlog(msg) {
  console.warn(msg);
}
function errorlog(msg) {
  console.error(msg);
}
var priorityTabs = new Set();

function generateStreamID() {
	var text = "";
	var possible = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
	for (var i = 0; i < 10; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	try {
		text = text.replaceAll("AD", "vDAv"); // avoiding adblockers
		text = text.replaceAll("Ad", "vdAv");
		text = text.replaceAll("ad", "vdav");
		text = text.replaceAll("aD", "vDav");
	} catch (e) {}
	return text;
}

if (typeof chrome.runtime == "undefined") {
	if (typeof require !== "undefined"){
		var { ipcRenderer, contextBridge } = require("electron");
		isSSAPP = true;
	} else {
		var ipcRenderer = {};
		ipcRenderer.sendSync = function(){};
		ipcRenderer.invoke = function(){};
		ipcRenderer.on = function(){};
		console.warn("This isn't a functional mode; not yet at least.");
	}
	
	chrome = {};
	chrome.browserAction = {};
	chrome.browserAction.setIcon = function (icon) {}; // there is no icon in the ssapp
	chrome.runtime = {};
	chrome.runtime.lastError = false;
	//chrome.runtime.lastError.message = "";

	chrome.runtime.sendMessage = async function(data, callback){ // uncomment if I need to use it.
		let response = await ipcRenderer.sendSync('fromBackground',data);
		if (typeof(callback) == "function"){
			callback(response);
			log(response);
		}
	};

	chrome.runtime.getManifest = function () {
		return false; // I'll need to add version info eventually
	};
	chrome.storage = {};
	chrome.storage.sync = {};
	chrome.storage.sync.set = function (data) {
		ipcRenderer.sendSync("storageSave", data);
		log("ipcRenderer.sendSync('storageSave',data);");
	};
	chrome.storage.sync.get = async function (arg, callback) {
		var response = await ipcRenderer.sendSync("storageGet", arg);
		callback(response);
	};
	chrome.storage.sync.remove = async function (arg, callback) {
		// only used for upgrading; not important atm.
		callback({});
	};

	chrome.storage.local = {};
	chrome.storage.local.get = async function (arg, callback) {
		log("LOCAL SYNC GET");
		var response = await ipcRenderer.sendSync("storageGet", arg);
		callback(response);
	};
	chrome.storage.local.set = function (data) {
		log("LOCAL SYNC SET", data);
		ipcRenderer.sendSync("storageSave", data);
		log("ipcRenderer.sendSync('storageSave',data);");
	};

	chrome.tabs = {};
	chrome.tabs.query = async function (a, callback) {
		var response = await ipcRenderer.sendSync("getTabs", {});

		log("chrome.tabs.query");
		log(response);
		if (callback) {
			callback(response);
		}
	};

	chrome.debugger = {};
	chrome.debugger.detach = function (a = null, b = null, c = null) {};
	chrome.debugger.onDetach = {};
	chrome.debugger.onDetach.addListener = function () {};
	chrome.debugger.attach = function (a, b, c) {
		log("chrome.debugger.attach", c);
		c();
	};

	chrome.tabs.sendMessage = async function (tab = null, message = null, callback = null) {
		var response = await ipcRenderer.sendSync("sendToTab", { message: message, tab: tab });
		if (callback) {
			callback(response);
		}
	};

	chrome.debugger.sendCommand = async function (a = null, b = null, c = null, callback = null) {
	  if (!c || !a?.tabId) {
		log("Missing required parameters");
		return;
	  }

	  const eventData = {
		...c,
		tab: a.tabId
	  };

	  // Preserve the exact Input.dispatchKeyEvent type
	  if (b === "Input.dispatchKeyEvent") {
		const response = await ipcRenderer.sendSync("sendInputToTab", eventData);
		callback?.(response);
	  } else {
		c.tab = a.tabId;
		const response = await ipcRenderer.sendSync("sendInputToTab", c); // sendInputToTab
		callback?.(response);
	  }
	};

	chrome.runtime.onMessage = {};

	chrome.notifications = {};
	chrome.notifications.create = function (data) {
		alert(data.message);
	};

	window.showSaveFilePicker = async function (opts) {
		const filePath = await ipcRenderer.invoke("show-save-dialog", opts);
		//console.log(filePath);
		return filePath;
	};

	var onMessageCallback = function (a, b, c) {};

	chrome.runtime.onMessage.addListener = function (callback) {
		onMessageCallback = callback;
	};

	ipcRenderer.on("fromMain", (event, ...args) => {
		log("FROM MAIN", args);

		var sender = {};
		sender.tab = {};
		sender.tab.id = null;

		if (args[0]) {
			// Handle batch messages
			if (args[0].messages && Array.isArray(args[0].messages)) {
				// Process batch messages from TikTok
				args[0].messages.forEach(message => {
					onMessageCallback({ message }, sender, function (response) {
						// Individual responses for batch messages
					});
				});
				if (event.returnValue) {
					event.returnValue = { success: true, count: args[0].messages.length };
				}
			} else {
				// Handle single message (backward compatibility)
				onMessageCallback(args[0], sender, function (response) {
					if (event.returnValue) {
						event.returnValue = response;
					}
					ipcRenderer.send("fromBackgroundResponse", response);
				});
			}
		}
	});
	ipcRenderer.on("fromMainSender", (event, args) => {
		log("FROM MAINS SENDER", args);

		if (args.length) {
			if (args[1]) {
				var sender = args[1];
			} else {
				var sender = {};
				sender.tab = {};
				sender.tab.id = null;
			}
			onMessageCallback(args[0], sender, function (response) {
				if (event.returnValue) {
					event.returnValue = response;
				}
				ipcRenderer.send("fromBackgroundResponse", response);
			});
		}
	});

	ipcRenderer.on("fromPopup", (event, ...args) => {
		//log("FROM POP UP (redirected)", args[0]);
		var sender = {};
		sender.tab = {};
		sender.tab.id = null;
		const request = args[0];
		const callbackId = request ? request.callbackId : null;
		
		onMessageCallback(request, sender, function (response) {
			// (request, sender, sendResponse)
			//log("sending response to pop up:",response);
			// Preserve callbackId in response if it exists
			if (callbackId && response) {
				response.callbackId = callbackId;
			}
			ipcRenderer.send("fromBackgroundPopupResponse", response);
		});
	});

	fetchNode = function (URL, headers = {}, method = 'GET', body = null) {
		return ipcRenderer.sendSync("nodefetch", {
			url: URL,
			headers: headers,
			method: method,
			body: body
		});
	};

	/* 	ipcMain.on('nodepost', function(eventRet, args2) {
		log("NODE POSTING!");
		fetch(args2.url, {
			method: 'POST',
			headers: args2.headers,
			body: JSON.stringify(args2.body) 
		})
		.then(response => response.text())
		.then(data => {
			eventRet.returnValue = data;
		})
		.catch(error => {
			eventRet.returnValue = null;
		});
	}); */

	postNode = async function (URL, body, headers = {}) {
		return await ipcRenderer.sendSync("nodepost", {
			url: URL,
			body: body,
			headers: headers
		});
	};

	putNode = async function (URL, body, headers = {}) {
		return await ipcRenderer.sendSync("nodepost", {
			url: URL,
			body: body,
			headers: headers
		});
	};

	window.showOpenFilePicker = async function (a = null, c = null) {
		var importFile = await ipcRenderer.sendSync("showOpenDialog", "");
		return importFile;
	}; 

	//ipcRenderer.send('backgroundLoaded');

	//chrome.runtime.onMessage.addListener(
	//async function (request, sender, sendResponse) {
} else {
	window.alert = alert = function (msg) {
		console.warn(new Date().toUTCString() + " : " + msg);
	};
	if (!chrome.browserAction){
		chrome.browserAction = {};
		chrome.browserAction.setIcon = function (icon) {};
	}
}

log("isSSAPP: " + isSSAPP);

function generateVariations(word) {
  // Skip empty words
  if (!word || !word.trim()) return [word];
  
  // Limit word length to prevent memory issues
  const maxLength = 20;
  if (word.length > maxLength) return [word];
  
  let variations = [word];
  
  // Limit total variations to prevent exponential growth
  const maxVariations = 100;
  
  for (let i = 0; i < word.length && variations.length < maxVariations; i++) {
    const char = word[i].toLowerCase();
    if (alternativeChars.hasOwnProperty(char)) {
      const charVariations = alternativeChars[char];
      const newVariations = [];
      
      // Only process a reasonable number of existing variations
      const variationsToProcess = variations.slice(0, 10);
      
      for (const variation of variationsToProcess) {
        for (const altChar of charVariations) {
          if (newVariations.length + variations.length >= maxVariations) break;
          const newWord = variation.slice(0, i) + altChar + variation.slice(i + 1);
          newVariations.push(newWord);
        }
      }
      variations.push(...newVariations);
    }
  }
  
  // Limit final result size
  return variations.slice(0, maxVariations).filter(word => !word.match(/[A-Z]/));
}

function generateVariationsList(words) {
  // Cap input size
  const maxWordList = 1000;
  const wordsTrimmed = words.slice(0, maxWordList);
  
  const variationsList = [];
  const maxTotalVariations = 10000;
  
  for (const word of wordsTrimmed) {
    if (variationsList.length >= maxTotalVariations) break;
    const wordVariations = generateVariations(word);
    
    // Add variations up to the limit
    const remainingSlots = maxTotalVariations - variationsList.length;
    variationsList.push(...wordVariations.slice(0, remainingSlots));
  }
  
  return variationsList.filter(word => word && !word.match(/[A-Z]/));
}

function createProfanityHashTable(profanityVariationsList) {
  // Limit size to prevent memory issues
  const maxEntries = 20000;
  const limitedList = profanityVariationsList.slice(0, maxEntries);
  
  const hashTable = {};
  for (let word of limitedList) {
    word = word.trim().toLowerCase();
    if (!word) continue;
    
    const firstChar = word.charAt(0);
    if (!hashTable[firstChar]) {
      hashTable[firstChar] = {};
    }
    hashTable[firstChar][word] = true;
  }
  return hashTable;
}
function isProfanity(word) {
	if (!profanityHashTable) {
		return false;
	}
	const wordLower = word.toLowerCase();
	const firstChar = wordLower[0];
	const words = profanityHashTable[firstChar];
	if (!words) {
		return false;
	}
	return Boolean(words[wordLower]);
}

function filterProfanity(sentence) {
    let filteredSentence = sentence;
    
    // Handle multi-word phrases first
    if (profanityHashTable) {
        Object.values(profanityHashTable)
            .flatMap(obj => Object.keys(obj))
            .filter(word => word.includes(' '))
            .sort((a, b) => b.length - a.length)
            .forEach(phrase => {
                const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const phraseRegex = new RegExp(escapedPhrase, 'gi');
                filteredSentence = filteredSentence.replace(phraseRegex, match => '*'.repeat(match.length));
            });
    }
    
    // Handle single words
    const words = filteredSentence.split(/[\s\.\-_!?,]+/);
    const uniqueWords = [...new Set(words)];
    
    for (let word of uniqueWords) {
        if (word && isProfanity(word)) {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Updated regex to handle punctuation
            const wordRegex = new RegExp(`(?<!\\w)(${escapedWord}(?:${escapedWord})*?)(?:[\\s\\.,!\\?]|$)`, 'gi');
            filteredSentence = filteredSentence.replace(wordRegex, match => '*'.repeat(match.length));
        }
    }
    
    return filteredSentence;
}

var profanityHashTable = false;

function initialLoadBadWords() {
  try {
    if (isSSAPP) {
      // Use Node.js file system in Electron environment
	  log("checking for badwords.txt on local disk");
      const fs = require('fs');
      const path = require('path');
      
      try {
		
        // Read from local file system using Node.js fs
        const filePath = path.join(__dirname, 'badwords.txt');
        const text = fs.readFileSync(filePath, 'utf8');
        let customBadWords = text.split(/\r?\n|\r|\n/g);
        customBadWords = generateVariationsList(customBadWords);
        profanityHashTable = createProfanityHashTable(customBadWords);
		log("badwords Worked");
      } catch (fileError) {
        // Fallback if file read fails
        try {
          const customBadwords = localStorage.getItem('customBadwords');
          if (customBadwords) {
			log("badwords from local storage instead");
            let customBadWordsList = customBadwords.split(/\r?\n|\r|\n/g);
            customBadWordsList = generateVariationsList(customBadWordsList);
            profanityHashTable = createProfanityHashTable(customBadWordsList);
          } else {
			log("using default badwords list");
            badWords = generateVariationsList(badWords);
            profanityHashTable = createProfanityHashTable(badWords);
          }
        } catch (e) {
		  log("failed to load badwords; loading backups");
          badWords = generateVariationsList(badWords);
          profanityHashTable = createProfanityHashTable(badWords);
        }
      }
    } else {
      // Original web browser approach using fetch
      fetch("./badwords.txt")
        .then(response => response.text())
        .then(text => {
          let customBadWords = text.split(/\r?\n|\r|\n/g);
          customBadWords = generateVariationsList(customBadWords);
          profanityHashTable = createProfanityHashTable(customBadWords);
        })
        .catch(error => {
          try {
            const customBadwords = localStorage.getItem('customBadwords');
            if (customBadwords) {
              let customBadWordsList = customBadwords.split(/\r?\n|\r|\n/g);
              customBadWordsList = generateVariationsList(customBadWordsList);
              profanityHashTable = createProfanityHashTable(customBadWordsList);
            } else {
              badWords = generateVariationsList(badWords);
              profanityHashTable = createProfanityHashTable(badWords);
            }
          } catch (e) {
            badWords = generateVariationsList(badWords);
            profanityHashTable = createProfanityHashTable(badWords);
          }
        });
    }
  } catch (e) {
    badWords = generateVariationsList(badWords);
    profanityHashTable = createProfanityHashTable(badWords);
  }
}

initialLoadBadWords();

/////// end of bad word filter


var goodWordsHashTable = false;
function isGoodWord(word) {
	const wordLower = word.toLowerCase();
	const firstChar = wordLower[0];
	const words = goodWordsHashTable[firstChar];
	if (!words) {
		return false;
	}
	return Boolean(words[wordLower]);
}
function passGoodWords(sentence) {
	let words = sentence.toLowerCase().split(/[\s\.\-_!?,]+/);
	const uniqueWords = new Set(words);
	for (let word of uniqueWords) {
		if (!isGoodWord(word)) {
			sentence = sentence.replace(new RegExp("\\b" + word + "\\b", "gi"), "*".repeat(word.length));
		}
	}
	return sentence;
}

try {
  if (isSSAPP) {
    // Use Node.js file system in Electron environment
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Read from local file system using Node.js fs
      const filePath = path.join(__dirname, 'goodwords.txt');
      const text = fs.readFileSync(filePath, 'utf8');
      let customGoodWords = text.split(/\r?\n|\r|\n/g);
      goodWordsHashTable = createProfanityHashTable(customGoodWords);
    } catch (fileError) {
      // no file found or error
    }
  } else {
    // Original web browser approach using fetch
    fetch("./goodwords.txt")
      .then(response => response.text())
      .then(text => {
        let customGoodWords = text.split(/\r?\n|\r|\n/g);
        goodWordsHashTable = createProfanityHashTable(customGoodWords);
      })
      .catch(error => {
        // no file found or error
      });
  }
} catch (e) {}

///////////////////
// Add this placeholder function to background.js
window.customUserFunction = function(data) {
    // This is a placeholder function that can be overridden by custom user JavaScript
    console.log("Default customUserFunction - no custom implementation loaded");
    // Return false to indicate no custom processing was done
    return data;
};

function loadCustomJs(code) {
    try {
        // Instead of trying to evaluate the code, we'll extract the function
        // and manually assign it to window.customUserFunction
        
        // Extract just the function body from the code
        const functionBodyMatch = code.match(/window\.customUserFunction\s*=\s*function\s*\(\s*data\s*\)\s*\{([\s\S]*?)\}\s*;/);
        
        if (!functionBodyMatch || !functionBodyMatch[1]) {
            console.error("Could not extract function body from code");
            return false;
        }
        
        // Get the function body
        const functionBody = functionBodyMatch[1];
        
        // Create a new function using the Function constructor
        // We can't use this directly because of CSP, but we'll use it as a template
        const functionTemplate = `
            window.customUserFunction = function(data) {
                // Custom implementation
                const processedData = window.processCustomFunctionBody(data);
                return processedData;
            };
            
            // Extract and define any helper functions
            ${code.replace(functionBodyMatch[0], '')}
        `;
        
        // Now implement a function that will process data according to the extracted body
        // This will be called by our wrapper function
        window.processCustomFunctionBody = function(data) {
            // Here you would implement logic to process the data according to the function body
            // Since we can't eval the code directly, you'll need to implement specific behaviors
            
            // Log that we're using the custom implementation
            console.log("Custom implementation processing data");
            
            // Simple implementation that modifies data in a predetermined way
            // Replace this with your actual custom logic
            if (data.chatmessage) {
                // Example custom processing
                if (data.chatmessage.startsWith("!")) {
                    // Handle commands
                    const commandParts = data.chatmessage.split(" ");
                    const command = commandParts[0].toLowerCase();
                    
                    if (command === "!hello") {
                        console.log("Command processed: hello");
                        // Custom command handling
                        // You'd implement sendCustomReply here
                    }
                }
                
                // Other custom processing
                // ...
            }
            
            return data;
        };
        
        // Create a script tag to hold the template
        const script = document.createElement('script');
        script.id = 'custom-user-js';
        script.textContent = functionTemplate;
        
        // Remove any existing script
        const existingScript = document.getElementById('custom-user-js');
        if (existingScript) {
            existingScript.remove();
        }
        
        // Add the script to the page
        document.body.appendChild(script);
        
        console.log("Custom JavaScript loaded successfully");
        return true;
    } catch (error) {
        console.error("Error loading custom JavaScript:", error);
        return false;
    }
}
// Function to reset the custom function to default
function resetCustomJs() {
    // Remove any existing custom script
    const existingScript = document.getElementById('custom-user-js');
    if (existingScript) {
        existingScript.remove();
    }
    
    // Reset to default function
    window.customUserFunction = function(data) {
        console.log("Default customUserFunction - no custom implementation loaded");
        return false;
    };
    
    console.log("Custom JavaScript function reset to default");
}
//////////////
function printThermal(htmlContent, options = {}) {  // --kiosk --kiosk-printing
  // Default options
  const defaultOptions = {
    width: '58mm',
    margin: '0mm',
    fontSize: '10pt',
    fontFamily: 'monospace',
    lineHeight: '1.2',
    printerName: settings.printerName?.textsetting || null 
  };
  
  // Merge provided options with defaults
  const printOptions = {...defaultOptions, ...options};
  
  // Create an iframe to handle the print job
  const printFrame = document.createElement('iframe');
  
  // Make iframe invisible
  printFrame.style.position = 'fixed';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  printFrame.style.opacity = '0';
  
  document.body.appendChild(printFrame);
  
  // Get iframe's document object
  const frameDoc = printFrame.contentWindow.document;
  
  // Open document and write HTML
  frameDoc.open();
  
  // Create style for printing
  const printStyles = `
    @page {
      size: ${printOptions.width} auto;
      margin: ${printOptions.margin};
    }
    body {
      width: ${printOptions.width};
      font-family: ${printOptions.fontFamily};
      font-size: ${printOptions.fontSize};
      line-height: ${printOptions.lineHeight};
      margin: 0;
      padding: 0;
    }
    * {
      box-sizing: border-box;
    }
  `;
  
  // Write HTML to iframe with styles
  frameDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print</title>
        <style>${printStyles}</style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  
  frameDoc.close();
  
  // Wait for content to load before printing
  printFrame.onload = function() {
    const printWindow = printFrame.contentWindow;
    
    // If a specific printer name is provided, attempt to use it
    if (printOptions.printerName) {
      // Use the print API with specific printer
      const printOpts = {
        printer: printOptions.printerName,
        silent: true
      };
      
      // Print with specified options
      if (printWindow.navigator && printWindow.navigator.serviceWorker) {
        printWindow.print(printOpts).catch(error => {
          console.warn('Failed to select printer:', error);
          // Fallback to default print
          printWindow.print();
        });
      } else {
        // Fallback to default print
        printWindow.print();
      }
    } else {
      // Use default print dialog
      printWindow.print();
    }
    
    // Remove iframe after printing is complete
    setTimeout(() => {
      document.body.removeChild(printFrame);
    }, 1000);
  };
}
////////

function replaceURLsWithSubstring(text, replacement = "[Link]") {
  if (typeof text !== "string") return text;
  
  try {
    // First pattern for traditional URLs
    const urlPattern = /\b(?:https?:\/\/)?(?![\d.]+\b(?!\.[a-z]))[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?/g;
    
    // Second pattern specifically for IP addresses
    const ipPattern = /\b(?:https?:\/\/)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d+)?(?:\/[^\s]*)?/g;
    
    // Apply both replacements
    return text
      .replace(urlPattern, (match) => {
        if (match.startsWith('http://') || match.startsWith('https://')) {
          return replacement;
        }
        const parts = match.split('.');
        const potentialTLD = parts[parts.length - 1].split(/[/?#]/)[0];
        if (match.includes('/') || isValidTLD(potentialTLD)) {
          return replacement;
        }
        return match;
      })
      .replace(ipPattern, replacement);
  } catch (e) {
    console.error(e);
    return text;
  }
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
var relaytargets = false;
var loadedFirst = false;

function loadSettings(item, resave = false) {
	log("loadSettings (or saving new settings)", item);
	let reloadNeeded = false;

	if (item && item.streamID) {
		if (streamID != item.streamID) {
			streamID = item.streamID;
			streamID = validateRoomId(streamID);
			if (!streamID){
				try {
					chrome.notifications.create({
						type: "basic",
						iconUrl: "./icons/icon-128.png",
						title: "Invalid session ID",
						message: "Your session ID is invalid.\n\nPlease correct it to continue"
					});
					throw new Error('Invalid session ID');
				} catch (e) {
					console.error(e);
					throw new Error('Invalid session ID');
				}
			}
			reloadNeeded = true;
			chrome.storage.sync.set({ streamID});
			chrome.runtime.lastError;
		}
	} else if (!streamID) {
		
		streamID = generateStreamID(); // not stream ID, so lets generate one; then lets save it.
		streamID = validateRoomId(streamID);
		if (!streamID){
			streamID = generateStreamID();
		}
		streamID = validateRoomId(streamID);
		if (!streamID){
			try {
				chrome.notifications.create({
					type: "basic",
					iconUrl: "./icons/icon-128.png",
					title: "Invalid session ID",
					message: "Your session ID is invalid.\n\nPlease correct it to continue"
				});
				throw new Error('Invalid session ID');
			} catch (e) {
				console.error(e);
				throw new Error('Invalid session ID');
			}
		}
		
		if (item) {
			item.streamID = streamID;
		} else {
			item = {};
			item.streamID = streamID;
		}
		
		reloadNeeded = true;
		chrome.storage.sync.set({ streamID});
		chrome.runtime.lastError;
	}

	if (item && "password" in item) {
		if (password != item.password) {
			password = item.password;
			
			reloadNeeded = true;
			chrome.storage.sync.set({ password});
			chrome.runtime.lastError;
		}
	}

	if (item && item.settings) {
		settings = item.settings;
		
		Object.keys(patterns).forEach(pattern=>{
			settings[pattern] = findExistingEvents(pattern,{ settings });
		})
	}

	if (item && "state" in item) {
		if (isExtensionOn != item.state) {
			isExtensionOn = item.state;
			reloadNeeded = true;
			// we're saving below instead
		}
	}
	if (reloadNeeded) {
		updateExtensionState(false);
	}
	
	try {
		if (isSSAPP && ipcRenderer) {
			ipcRenderer.sendSync("fromBackground", { streamID, password, settings, state: isExtensionOn }); 
			//ipcRenderer.send('backgroundLoaded');
			if (resave && settings){
				chrome.storage.sync.set({ settings});
				chrome.runtime.lastError;
			}
		}
	} catch (e) {
		console.error(e);
	}

	toggleMidi();

	if (settings.addkarma) {
		if (!sentimentAnalysisLoaded) {
			loadSentimentAnalysis();
		}
	}

	const timedMessage = settings['timedMessage'] || [];
	for (const i of timedMessage) {
		if (settings["timemessageevent" + i]) {
			if (settings["timemessagecommand" + i]) {
				checkIntervalState(i);
			}
		}
	}
	
	if (settings.hypemode) {
		// Initialize hype mode if it's enabled on startup
		if (!hypeInterval) {
			hypeInterval = setInterval(processHype2, 10000);
		}
	}
	
	if (settings.relaytargets && settings.relaytargets.textsetting){
		relaytargets = settings.relaytargets.textsetting
			.split(",")
			.map(item => item.trim().toLowerCase())
			.filter(item => item !== "");
		if (!relaytargets.length){
			relaytargets = false;
		}
	} else {
		relaytargets = false;
	}

	if (settings.translationlanguage) {
		changeLg(settings.translationlanguage.optionsetting);
	}
	/////
    const customJs = localStorage.getItem('customJavaScript');
    const isEnabled = settings.customJsEnabled || false;
    
    if (customJs && isEnabled) {
        loadCustomJs(customJs);
    } else {
        resetCustomJs();
    }
	/////////
	
	setupSocket();
	setupSocketDock();
	handleStreamerBotSettingsChange();
	loadedFirst = true;
}
////////////

var miscTranslations = {
	// we won't use after the first load
	start: "START",
	said: " said: ",
	someonesaid: "Someone said: ",
	someone: "Someone"
};
// In background.js or a shared utility file
async function fetchWithTimeout(url, options = {}, timeout = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const fetchOptions = {
        ...options, // User-provided options (method, headers, body)
        signal: controller.signal
    };

    try {
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId); // Ensure timeout is cleared on error too
        if (error.name === 'AbortError') {
            console.warn(`[fetchWithTimeout] Request to ${url} timed out after ${timeout}ms.`);
            // You might want to throw a specific timeout error or return a custom object
            // For now, re-throwing to let the caller handle it.
            throw new Error(`Timeout: Request to ${url} aborted after ${timeout}ms.`);
        }
        // Assuming errorlog is defined elsewhere
        if (typeof errorlog === 'function') {
            errorlog(`[fetchWithTimeout] Fetch error for ${url}:`, error);
        } else {
            console.error(`[fetchWithTimeout] Fetch error for ${url}:`, error);
        }
        throw error; // Re-throw the original error for the caller to handle
    }
}
// Make it globally available if needed by other parts of background.js, or export if using modules
window.fetchWithTimeout = fetchWithTimeout;

async function changeLg(lang) {
	log("changeLg: " + lang);
	if (!lang) {
		log("DISABLING TRANSLATIONS");
		settings.translation = false;
		chrome.storage.local.set({
			settings: settings
		});
		chrome.runtime.lastError;
		pushSettingChange();
		return;
	}
	return await fetchWithTimeout("./translations/" + lang + ".json", 2000)
		.then(async function (response) {
			try {
				if (response.status !== 200) {
					return;
				}
				await response
					.json()
					.then(function (data) {
						if (data.miscellaneous) {
							Object.keys(data.miscellaneous).forEach(key => {
								miscTranslations[key] = data.miscellaneous[key];
							});
						}
						data.miscellaneous = miscTranslations;
						settings.translation = data;
						chrome.storage.local.set({
							settings: settings
						});
						chrome.runtime.lastError;
						pushSettingChange();
					})
					.catch(function (e) {
						log(e);
					});
			} catch (e) {
				log(e);
			}
		})
		.catch(function (err) {
			log(err);
		});
}
//////
function checkIntervalState(i) {
	if (intervalMessages[i]) {
		clearInterval(intervalMessages[i]);
	}

	if (!isExtensionOn) {
		return;
	}
	if (!i){
		return;
	}

	var offset = 0;
	if (settings["timemessageoffset" + i]) {
		offset = settings["timemessageoffset" + i].numbersetting;
	}

	intervalMessages[i] = setTimeout(
		function (i) {
			let antispam = true;
			
			if ("timemessageinterval" + i in settings) {
				if (settings["timemessageinterval" + i].numbersetting == 0) {
					if (!isExtensionOn) {
						return;
					}
					if (!settings["timemessagecommand" + i] || !settings["timemessagecommand" + i].textsetting) {
						return;
					} // failsafe
					if (!settings["timemessageevent" + i]) {
						return;
					} // failsafe
					//messageTimeout = Date.now();
					var msg = {};
					msg.response = settings["timemessagecommand" + i].textsetting;
					//sendMessageToTabs(msg, false, null, false, antispam);
					sendMessageToTabs(msg, false, null, false, antispam, false);
					
				} else if (settings["timemessageinterval" + i].numbersetting) {
					clearInterval(intervalMessages[i]);
					intervalMessages[i] = setInterval(
						function (i) {
							if (!isExtensionOn) {
								return;
							}
							if (!settings["timemessagecommand" + i] || !settings["timemessagecommand" + i].textsetting) {
								return;
							} // failsafe
							if (!settings["timemessageevent" + i]) {
								return;
							} // failsafe
							//messageTimeout = Date.now();
							var msg = {};
							msg.response = settings["timemessagecommand" + i].textsetting;
							//sendMessageToTabs(msg, false, null, false, antispam);
							sendMessageToTabs(msg, false, null, false, antispam, false);
						},
						settings["timemessageinterval" + i].numbersetting * 60000,
						i
					);
				}
			} else {
				clearInterval(intervalMessages[i]);
				intervalMessages[i] = setInterval(
					function (i) {
						if (!isExtensionOn) {
							return;
						}
						if (!settings["timemessagecommand" + i] || !settings["timemessagecommand" + i].textsetting) {
							return;
						} // failsafe
						if (!settings["timemessageevent" + i]) {
							return;
						} // failsafe
						//messageTimeout = Date.now();
						var msg = {};
						msg.response = settings["timemessagecommand" + i].textsetting;
						sendMessageToTabs(msg, false, null, false, antispam, false);
					},
					15 * 60000,
					i
				);
			}
		},
		offset * 60000 || 0,
		i
	);
}

function pushSettingChange() {
	chrome.tabs.query({}, function (tabs) {
		chrome.runtime.lastError;
		for (var i = 0; i < tabs.length; i++) {
			if (!tabs[i].url) {
				continue;
			}
			chrome.tabs.sendMessage(tabs[i].id, { settings: settings, state: isExtensionOn }, function (response = false) {
				chrome.runtime.lastError;
			});
		}
	});
}

function sleep(ms = 0) {
	return new Promise(r => setTimeout(r, ms)); // LOLz!
}
async function loadmidi() {
	const opts = {
		types: [
			{
				description: "JSON file",
				accept: { "text/plain": [".json", ".txt", ".data", ".midi"] }
			}
		]
	};
	var midiConfigFile = await window.showOpenFilePicker();

	try {
		midiConfigFile = await midiConfigFile[0].getFile();
		midiConfigFile = await midiConfigFile.text();
	} catch (e) {}

	try {
		settings.midiConfig = JSON.parse(midiConfigFile);
	} catch (e) {
		settings.midiConfig = false;
		log(e);
		messagePopup({alert: "File does not contain a valid JSON structure"});
	}
	chrome.storage.local.set({
		settings: settings
	});
	chrome.runtime.lastError;
}

var newFileHandle = false;
async function overwriteFile(data = false) {
    if (data == "setup") {
        const opts = {
            types: [
                {
                    description: "JSON data",
                    accept: { "text/plain": [".txt"], "application/json": [".json"] }
                }
            ]
        };
        if (!window.showSaveFilePicker) {
            console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
        }
        newFileHandle = await window.showSaveFilePicker(opts);
        
        // Store file path when isSSAPP is true
        if (isSSAPP && typeof newFileHandle === "string") {
            localStorage.setItem("savedFilePath", newFileHandle);
        }
    } else if (newFileHandle && data) {
        if (typeof newFileHandle == "string") {
            ipcRenderer.send("write-to-file", { filePath: newFileHandle, data: data });
        } else {
            const writableStream = await newFileHandle.createWritable();
            await writableStream.write(data);
            await writableStream.close();
        }
    }
}

var newSavedNamesFileHandle = false;
var uniqueNameSet = [];
async function overwriteSavedNames(data = false) {
    if (data == "setup") {
        uniqueNameSet = [];
        const opts = {
            types: [
                {
                    description: "Text file",
                    accept: { "text/plain": [".txt"] }
                }
            ]
        };
        if (!window.showSaveFilePicker) {
            console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
        }
        newSavedNamesFileHandle = await window.showSaveFilePicker(opts);
        
        // Store file path when isSSAPP is true
        if (isSSAPP && typeof newSavedNamesFileHandle === "string") {
            localStorage.setItem("savedNamesFilePath", newSavedNamesFileHandle);
        }
    } else if (data == "clear") {
        uniqueNameSet = [];
    } else if (data == "stop") {
        newSavedNamesFileHandle = false;
        uniqueNameSet = [];
        
        // Clear saved path
        if (isSSAPP) {
            localStorage.removeItem("savedNamesFilePath");
        }
    } else if (newSavedNamesFileHandle && data) {
        if (uniqueNameSet.includes(data)) {
            return;
        }
        uniqueNameSet.push(data);
        if (typeof newSavedNamesFileHandle == "string") {
            ipcRenderer.send("write-to-file", { filePath: newSavedNamesFileHandle, data: uniqueNameSet.join("\r\n") });
        } else {
            const writableStream = await newSavedNamesFileHandle.createWritable();
            await writableStream.write(uniqueNameSet.join("\r\n"));
            await writableStream.close();
        }
    }
}

/* var newFileHandleExcel = false;
async function overwriteFileExcel(data=false) {
  if (data=="setup"){
	  newFileHandleExcel = await window.showSaveFilePicker();
  } else if (newFileHandleExcel && data){
	  const size = (await newFileHandleExcel.getFile()).size;
	  const writableStream = await newFileHandleExcel.createWritable();
	  await writableStream.write( type: "write",
		  data: data,
		  position: size // Set the position to the current file size.
	  });
	  await writableStream.close();
  }
} */

var workbook = false;
var worksheet = false;
var table = [];

var newFileHandleExcel = false;
async function overwriteFileExcel(data = false) {
	if (data == "setup") {
		const opts = {
			types: [
				{
					description: "Excel file",
					accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
				}
			]
		};
		if (!window.showSaveFilePicker) {
			console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
		}
		newFileHandleExcel = await window.showSaveFilePicker(opts);
		workbook = XLSX.utils.book_new();

		data = [];

		worksheet = XLSX.utils.aoa_to_sheet(data);
		workbook.SheetNames.push("SocialStream-" + streamID);
		workbook.Sheets["SocialStream-" + streamID] = worksheet;

		var xlsbin = XLSX.write(workbook, {
			bookType: "xlsx",
			type: "binary"
		});

		var buffer = new ArrayBuffer(xlsbin.length),
			array = new Uint8Array(buffer);
		for (var i = 0; i < xlsbin.length; i++) {
			array[i] = xlsbin.charCodeAt(i) & 0xff;
		}
		var xlsblob = new Blob([buffer], { type: "application/octet-stream" });
		delete array;
		delete buffer;
		delete xlsbin;

		if (typeof newFileHandleExcel == "string") {
			ipcRenderer.send("write-to-file", { filePath: newFileHandleExcel, data: xlsblob });
		} else {
			const writableStream = await newFileHandleExcel.createWritable();
			await writableStream.write(xlsblob);
			await writableStream.close();
		}
	} else if (newFileHandleExcel && data) {
		for (var key in data) {
			if (!table.includes(key)) {
				table.push(key);
			}
		}
		var column = [];
		table.forEach(key => {
			if (key in data) {
				if (data[key] === undefined) {
					column.push("");
				} else if (typeof data[key] === "object") {
					column.push(JSON.stringify(data[key]));
				} else {
					column.push(data[key]);
				}
			} else {
				column.push("");
			}
		});

		XLSX.utils.sheet_add_aoa(worksheet, [table], { origin: 0 }); // replace header
		XLSX.utils.sheet_add_aoa(worksheet, [column], { origin: -1 }); // append new line

		var xlsbin = XLSX.write(workbook, {
			bookType: "xlsx",
			type: "binary"
		});

		var buffer = new ArrayBuffer(xlsbin.length),
			array = new Uint8Array(buffer);
		for (var i = 0; i < xlsbin.length; i++) {
			array[i] = xlsbin.charCodeAt(i) & 0xff;
		}
		var xlsblob = new Blob([buffer], { type: "application/octet-stream" });
		delete array;
		delete buffer;
		delete xlsbin;

		const writableStream = await newFileHandleExcel.createWritable();
		await writableStream.write(xlsblob);
		await writableStream.close();
	}
}

async function resetSettings(item = false) {
	log("reset settings");
	//alert("Settings reset");
	chrome.storage.sync.get(properties, async function (item) {
		if (!item) {
			item = {};
		}
		item.settings = {};
		loadSettings(item, true);
		// window.location.reload()
	});
}

async function exportSettings() {
	chrome.storage.sync.get(properties, async function (item) {
		item.settings = settings;
		const opts = {
			types: [
				{
					description: "Data file",
					accept: { "application/data": [".data"] }
				}
			]
		};
		if (!window.showSaveFilePicker) {
			console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
		}
		fileExportHandler = await window.showSaveFilePicker(opts);

		if (typeof fileExportHandler == "string") {
			ipcRenderer.send("write-to-file", { filePath: fileExportHandler, data: JSON.stringify(item) });
		} else {
			const writableStream = await fileExportHandler.createWritable();
			await writableStream.write(JSON.stringify(item));
			await writableStream.close();
		}
	});
}

async function importSettings(item = false) {
	/* const opts = {
		types: [{
		  description: 'JSON file',
		  accept: {'text/plain': ['.data']},
		}],
	}; */

	var importFile = await window.showOpenFilePicker();
	log(importFile);
	try {
		importFile = await importFile[0].getFile();
		importFile = await importFile.text(); // fail if IPC
	} catch (e) {}

	try {
		loadSettings(JSON.parse(importFile), true);
	} catch (e) {
		messagePopup({alert: "File does not contain a valid JSON structure"});
	}
}

var Url2ChannelImg = {};
var vid2ChannelImg = {};

function getYoutubeAvatarImageFallback(videoid, url) {
	// getting it from scraping youtube as fallback
	log("getYoutubeAvatarImageFallback triggered");
	fetch("https://www.youtube.com/watch?v=" + videoid)
		.then(response => response.text())
		.then(data => {
			try {
				let avatarURL = data.split('thumbnails":[{"url":"')[1].split('"')[0];
				if (avatarURL.startsWith("https://")) {
					Url2ChannelImg[url] = avatarURL;
					vid2ChannelImg[videoid] = avatarURL;
					log("getYoutubeAvatarImageFallback: " + avatarURL);
				}
			} catch (e) {}
		})
		.catch(error => {});
}

function getYoutubeAvatarImageMain(videoid, url) {
	// steves api server
	const xhttp = new XMLHttpRequest();
	xhttp.onload = function () {
		if (this.responseText.startsWith("https://")) {
			Url2ChannelImg[url] = this.responseText;
			vid2ChannelImg[videoid] = this.responseText;
			log("getYoutubeAvatarImageMain: " + this.responseText);
		} else {
			getYoutubeAvatarImageFallback(videoid, url);
		}
	};
	xhttp.onerror = function () {
		getYoutubeAvatarImageFallback(videoid, url);
	};
	xhttp.open("GET", "https://api.socialstream.ninja/youtube/channel?video=" + encodeURIComponent(videoid), true);
	xhttp.send();
}

function getYoutubeAvatarImage(url, skip = false) {
	try {
		if (url in Url2ChannelImg) {
			return Url2ChannelImg[url];
		}
		Url2ChannelImg[url] = ""; // prevent spamming of the API

		var videoid = YouTubeGetID(url);
		log("videoid: " + videoid);
		if (videoid) {
			if (videoid in vid2ChannelImg) {
				return vid2ChannelImg[videoid];
			}
			vid2ChannelImg[videoid] = "";

			getYoutubeAvatarImageMain(videoid, url);

			if (skip) {
				return;
			}

			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			} // a hacky/lazy way to wait for the response to complete
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
			sleep(200);
			if (vid2ChannelImg[videoid]) {
				return vid2ChannelImg[videoid];
			}
		}
	} catch (e) {
		console.error(e);
	}
	return false;
}

function YouTubeGetID(url) {
	var ID = "";
	url = url.replace(/(>|<)/gi, "").split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
	if (url[2] !== undefined) {
		ID = url[2].split(/[^0-9a-z_\-]/i);
		ID = ID[0];
	}
	return ID;
}







var intervalMessages = {};

function updateExtensionState(sync = true) {
	log("updateExtensionState", isExtensionOn);
	
	document.title = "Keep Open - Social Stream Ninja";

	if (isExtensionOn) {
		
		if (chrome.browserAction && chrome.browserAction.setIcon){
			chrome.browserAction.setIcon({ path: "/icons/on.png" });
		}
		if (chrome.action && chrome.action.setIcon){
			chrome.action.setIcon({ path: "/icons/on.png" });
		}
		if (streamID) {
			loadIframe(streamID, password);
		}
		setupSocket();
		setupSocketDock();
	} else {
		
		// document.title = "Idle - Social Stream Ninja";
		
		if (iframe) {
			iframe.src = null;
			iframe.remove();
			iframe = null;
		}

		if (socketserver) {
			socketserver.close();
		}

		if (socketserverDock) {
			socketserverDock.close();
		}

		if (intervalMessages) {
			for (i in intervalMessages) {
				clearInterval(intervalMessages[i]);
			}
		}
		if (chrome.browserAction && chrome.browserAction.setIcon){
			chrome.browserAction.setIcon({ path: "/icons/off.png" });
		}
		if (chrome.action && chrome.action.setIcon){
			chrome.action.setIcon({ path: "/icons/off.png" });
		}
	}

	if (sync) {
		chrome.storage.sync.set({
			state: isExtensionOn
		});
		chrome.runtime.lastError;
	}

	toggleMidi();
	pushSettingChange();
}

function setItemWithExpiry(key, value, expiryInMinutes = 1440) {
	const now = new Date();
	const item = {
		value: value,
		expiry: now.getTime() + expiryInMinutes * 60000
	};
	localStorage.setItem(key, JSON.stringify(item));
}

function getItemWithExpiry(key) {
	const itemStr = localStorage.getItem(key);

	if (!itemStr) {
		return null;
	}

	const item = JSON.parse(itemStr);
	const now = new Date();

	if (now.getTime() > item.expiry) {
		localStorage.removeItem(key);
		return null;
	}

	return item.value;
}

function clearAllWithPrefix(prefix) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key);
	  //console.log("Cleared "+key);
      i--;
    }
  }
}

var Pronouns = false;
async function getPronouns() {
    if (!Pronouns) {
		try{
			Pronouns = getItemWithExpiry("Pronouns");

			if (!Pronouns) {
				Pronouns = await fetch("https://api.pronouns.alejo.io/v1/pronouns")
					.then(response => {
						const cacheControl = response.headers.get('Cache-Control');
						let maxAge = 3600; // Default to 60 minutes

						if (cacheControl) {
							const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
							if (maxAgeMatch && maxAgeMatch[1]) {
								maxAge = parseInt(maxAgeMatch[1]);
							}
						}

						return response.json().then(result => {
							for (const key in result) {
								if (result.hasOwnProperty(key)) {
									const { subject, object } = result[key];
									result[key] = `${subject}/${object}`;
									
									result[key] = result[key]
									.replace(/&/g, "&amp;") // i guess this counts as html
									.replace(/</g, "&lt;")
									.replace(/>/g, "&gt;")
									.replace(/"/g, "&quot;")
									.replace(/'/g, "&#039;") || ""
								}
							}
							
							setItemWithExpiry("Pronouns", result, maxAge / 60);
							return result;
						});
					})
					.catch(err => {
						// console.error(err);
						return {};
					});

				if (!Pronouns) {
					Pronouns = {};
				}
			} else {
				log("Pronouns recovered from storage");
			}
		} catch(e){
			Pronouns = {};
		}
    }
}
var PronounsNames = {};

async function getPronounsNames(username = "") {
    if (!username) {
        return false;
    }
	try{
		if (!(username in PronounsNames)) {
			PronounsNames[username] = getItemWithExpiry("Pronouns:" + username);

			if (!PronounsNames[username]) {
				PronounsNames[username] = await fetch("https://api.pronouns.alejo.io/v1/users/" + username)
					.then(response => {
						const cacheControl = response.headers.get('Cache-Control');
						let maxAge = 3600; // Default to 60 minutes

						if (cacheControl) {
							const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
							if (maxAgeMatch && maxAgeMatch[1]) {
								maxAge = parseInt(maxAgeMatch[1]);
							}
						}
						//console.log(response);
						return response.json().then(result => {
							//console.log(result);
							setItemWithExpiry("Pronouns:" + username, result, maxAge / 60);
							return result;
						});
					})
					.catch(err => {
						//console.error(err);
						return false;
					});

				if (!PronounsNames[username]) {
					PronounsNames[username] = false;
				}
			}
		}
	} catch(e){
		 return false;
	}
    return PronounsNames[username];
}

var Globalbttv = false;
var Globalseventv = false;
var Globalffz = false;

async function getBTTVEmotes(url = false, type=null, channel=null) {
	var bttv = {};
	var userID = false;
	// console.log(url, type, channel);
	try {
		if (type){
			type = type.toLowerCase();
		} else if (url && url.includes("youtube.com/")) {
			type = "youtube";
		} else if (url && url.includes("twitch.tv/")) {
			type = "twitch";
		}

		if (type == "youtube") {
			var vid = false;
			if (url) {
				vid = YouTubeGetID(url);
			}

			if (vid) {
				console.log("YouTube video ID extracted:", vid);
				userID = localStorage.getItem("vid2uid:" + vid);
				
				if (!userID) {
					console.log("Fetching user ID for video:", vid);
					userID = await fetch("https://api.socialstream.ninja/youtube/user?video=" + vid)
						.then(result => {
							return result.text();
						})
						.then(result => {
							console.log("User ID received:", result);
							return result;
						})
						.catch(err => {
							console.error("Error fetching user ID:", err);
							//	log(err);
						});
					if (userID) {
						localStorage.setItem("vid2uid:" + vid, userID);
					} else {
						console.log("No user ID found for video:", vid);
						return false;
					}
				} else {
					console.log("User ID from cache:", userID);
				}
				if (userID) {
					bttv = getItemWithExpiry("uid2bttv2.youtube:" + userID);

					if (!bttv) {
						bttv = await fetch("https://api.betterttv.net/3/cached/users/youtube/" + userID)
							.then(result => {
								return result.json();
							})
							.then(result => {
								return result;
							})
							.catch(err => {
								//	log(err);
							});
						if (bttv) {
							console.log("BTTV raw response for YouTube channel:", bttv);
							if (bttv.channelEmotes) {
								console.log("BTTV channel emotes found:", bttv.channelEmotes.length);
								bttv.channelEmotes = bttv.channelEmotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
									acc[emote.code] = imageUrl;
									console.log("Added channel emote:", emote.code);
									return acc;
								}, {});
							}
							if (bttv.sharedEmotes) {
								console.log("BTTV shared emotes found:", bttv.sharedEmotes.length);
								bttv.sharedEmotes = bttv.sharedEmotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
									acc[emote.code] = imageUrl;
									return acc;
								}, {});
							}
							setItemWithExpiry("uid2bttv2.youtube:" + userID, bttv);
						} else {
							bttv = {};
						}
					} else {
						log("bttv recovererd from storage");
					}
				}
			}
		} else if (type == "twitch") {
			try {
			var username = "";
			if (channel){
				username = channel;
			} else if (url && url.startsWith("https://dashboard.twitch.tv/popout/u/")){
				username = url.replace("https://dashboard.twitch.tv/popout/u/","").split("/")[0];
			} else if (url){
				username =  url.split("popout/");
				if (username.length > 1) {
					username = username[1].split("/")[0];
				} else {
					username = "";
				}
			}
			} catch(e){errorlog(e);}

			if (username) {
				bttv = getItemWithExpiry("uid2bttv2.twitch:" + username.toLowerCase());
				log("BTTV2", bttv);
				if (!bttv || bttv.message) {
					bttv = {};
					userID = localStorage.getItem("twitch2uid." + username.toLowerCase());
					if (!userID) {
						const response = await fetch("https://api.socialstream.ninja/twitch/user?username=" + username);

						if (!response.ok) {
							return {};
						}
						const data = await response.json();

						//log(data);
						if (data && data.data && data.data[0] && data.data[0].id) {
							userID = data.data[0].id;

							if (userID) {
								localStorage.setItem("twitch2uid." + username.toLowerCase(), userID);
							}
						} else {
							userID = false;
						}
					}
					if (userID) {
						bttv = await fetch("https://api.betterttv.net/3/cached/users/twitch/" + userID)
							.then(result => {
								return result.json();
							})
							.then(result => {
								return result;
							})
							.catch(err => {
								console.error(err);
							});
						if (bttv) {
							if (bttv.channelEmotes) {
								bttv.channelEmotes = bttv.channelEmotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
									acc[emote.code] = imageUrl;
									return acc;
								}, {});
							}
							if (bttv.sharedEmotes) {
								bttv.sharedEmotes = bttv.sharedEmotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
									acc[emote.code] = imageUrl;
									return acc;
								}, {});
							}
							setItemWithExpiry("uid2bttv2.twitch:" + username.toLowerCase(), bttv);
						} else {
							bttv = {};
						}
						log("BTTV", bttv);
					}
				} else {
					log("bttv recovererd from storage");
				}
			}
		}

		if (!Globalbttv) {
			Globalbttv = getItemWithExpiry("globalbttv2");

			if (!Globalbttv) {
				Globalbttv = await fetch("https://api.betterttv.net/3/cached/emotes/global")
					.then(result => {
						return result.json();
					})
					.then(result => {
						return result;
					})
					.catch(err => {
						//log(err);
					});
				if (Globalbttv) {
					Globalbttv = Globalbttv.reduce((acc, emote) => {
						const imageUrl = `https://cdn.betterttv.net/emote/${emote.id}/2x`;
						acc[emote.code] = imageUrl;
						return acc;
					}, {});
					setItemWithExpiry("globalbttv2", Globalbttv);
				} else {
					Globalbttv = [];
				}
			} else {
				log("Globalbttv recovererd from storage");
			}
			
		}
		
		if (Globalbttv){
			if (!bttv){bttv = {};}
			bttv.globalEmotes = Globalbttv;
		}
		bttv.url = url;
		bttv.type = type;
		bttv.user = userID;
		//log(Globalbttv);
	} catch (e) {
		console.error(e);
	}
	return bttv;
}

async function getKickUserIdByUsername(kickUsername) {
  try {
	const response = await fetch(`https://kick.com/api/v2/channels/${kickUsername}`);
	if (!response.ok) {
	  throw new Error(`Failed to fetch user data: ${response.status}`);
	}
	const data = await response.json();
	return data.user_id ;
  } catch (error) {
	console.error(`Error fetching Kick user ID: ${error.message}`);
	return null;
  }
}
  
  
async function getSEVENTVEmotes(url = false, type=null, channel=null, userID=false) {
	var seventv = {};

	try {
		if (type){
			type = type.toLowerCase();
		} else if (url && url.includes("youtube.com/")) {
			type = "youtube";
		} else if (url && url.includes("twitch.tv/")) {
			type = "twitch";
		} else if (url && url.includes("kick.com/")) {
			type = "kick";
		}

		if (type == "youtube") {
			var vid = false;
			if (url) {
				vid = YouTubeGetID(url);
			}

			if (vid) {
				userID = localStorage.getItem("vid2uid:" + vid);

				if (!userID) {
					userID = await fetch("https://api.socialstream.ninja/youtube/user?video=" + vid)
						.then(result => {
							return result.text();
						})
						.then(result => {
							return result;
						})
						.catch(err => {
							console.error(err);
						});
					if (userID) {
						localStorage.setItem("vid2uid:" + vid, userID);
					} else {
						return false;
					}
				}
				if (userID) {
					seventv = getItemWithExpiry("uid2seventv.youtube:" + userID);
					if (!seventv) {
						seventv = await fetch("https://7tv.io/v3/users/youtube/" + userID)
							.then(result => {
								return result.json();
							})
							.then(result => {
								return result;
							})
							.catch(err => {
								console.error(err);
							});

						if (seventv) {
							if (seventv.emote_set && seventv.emote_set.emotes) {
								seventv.channelEmotes = seventv.emote_set.emotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`;
									if ((emote.data && emote.data.flags) || emote.flags) {
										acc[emote.name] = { url: imageUrl, zw: true };
									} else {
										acc[emote.name] = imageUrl;
									}
									return acc;
								}, {});
							}

							setItemWithExpiry("uid2seventv.youtube:" + userID, seventv);
						}
					}
				}
			}
		} else if (type == "twitch") {
			
			var username = "";
			if (channel){
				username = channel;
			} else if (url && url.startsWith("https://dashboard.twitch.tv/popout/u/")){
				username = url.replace("https://dashboard.twitch.tv/popout/u/","").split("/")[0];
			} else if (url){
				username =  url.split("popout/");
				if (username.length > 1) {
					username = username[1].split("/")[0];
				} else {
					username = "";
				}
			}

			log("username: " + username);
			if (username) {
				seventv = getItemWithExpiry("uid2seventv.twitch:" + username.toLowerCase());
				log("SEVENTV2", seventv);
				if (!seventv || seventv.message) {
					seventv = {};
					userID = localStorage.getItem("twitch2uid." + username.toLowerCase());
					if (!userID) {
						const response = await fetch("https://api.socialstream.ninja/twitch/user?username=" + username);

						if (!response.ok) {
							return {};
						}
						const data = await response.json();

						if (data && data.data && data.data[0] && data.data[0].id) {
							userID = data.data[0].id;

							if (userID) {
								localStorage.setItem("twitch2uid." + username.toLowerCase(), userID);
							}
						} else {
							userID = false;
						}
					}
					if (userID) {
						seventv = await fetch("https://7tv.io/v3/users/twitch/" + userID)
							.then(result => {
								return result.json();
							})
							.then(result => {
								return result;
							})
							.catch(err => {
								console.error(err);
							});
						if (seventv) {
							if (seventv.emote_set && seventv.emote_set.emotes) {
								seventv.channelEmotes = seventv.emote_set.emotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`;
									if ((emote.data && emote.data.flags) || emote.flags) {
										acc[emote.name] = { url: imageUrl, zw: true };
									} else {
										acc[emote.name] = imageUrl;
									}
									return acc;
								}, {});
							}

							setItemWithExpiry("uid2seventv.twitch:" + username.toLowerCase(), seventv);
						} else {
							seventv = {};
						}
						log("SEVENTV", seventv);
					}
				} else {
					log("seventv recovererd from storage");
				}
			}
		} else if (type == "kick") {
			var username = "";
			if (channel) {
				username = channel;
			} else if (url) {
				username = url.replace("https://kick.com/", "").split("/")[0].split("?")[0];
				if (username == "popout"){
					username = url.replace("https://kick.com/popout/", "").split("/")[0].split("?")[0];
				}
			}
			
			log("kick username: " + username);
			if (username) {
				seventv = getItemWithExpiry("uid2seventv.kick:" + username.toLowerCase());
				if (!seventv || seventv.message) {
					seventv = {};
					userID = userID || localStorage.getItem("kick2uid." + username.toLowerCase());
					if (!userID) {
						userID = await getKickUserIdByUsername(username) || false;

						if (userID) {
							localStorage.setItem("kick2uid." + username.toLowerCase(), userID);
						}
					}
					if (userID) {
						seventv = await fetch("https://7tv.io/v3/users/kick/" + userID)
							.then(result => {
								return result.json();
							})
							.then(result => {
								return result;
							})
							.catch(err => {
								console.error(err);
							});
						if (seventv) {
							if (seventv.emote_set && seventv.emote_set.emotes) {
								seventv.channelEmotes = seventv.emote_set.emotes.reduce((acc, emote) => {
									const imageUrl = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`;
									if ((emote.data && emote.data.flags) || emote.flags) {
										acc[emote.name] = { url: imageUrl, zw: true };
									} else {
										acc[emote.name] = imageUrl;
									}
									return acc;
								}, {});
							}

							setItemWithExpiry("uid2seventv.kick:" + username.toLowerCase(), seventv);
						} else {
							seventv = {};
						}
						log("KICK SEVENTV", seventv);
					}
				} else {
					log("kick seventv recovered from storage");
				}
			}
		}

		if (!Globalseventv) {
			Globalseventv = getItemWithExpiry("globalseventv");

			if (!Globalseventv) {
				Globalseventv = await fetch("https://7tv.io/v3/emote-sets/global")
					.then(result => {
						return result.json();
					})
					.then(result => {
						return result;
					})
					.catch(err => {
						console.error(err);
					});
				if (Globalseventv && Globalseventv.emotes) {
					Globalseventv = Globalseventv.emotes.reduce((acc, emote) => {
						const imageUrl = `https://cdn.7tv.app/emote/${emote.id}/2x.webp`;
						if (emote.flags) {
							acc[emote.name] = { url: imageUrl, zw: true };
						} else {
							acc[emote.name] = imageUrl;
						}
						return acc;
					}, {});
					setItemWithExpiry("globalseventv", Globalseventv);
				} else {
					Globalseventv = [];
				}
			} else {
				log("Globalseventv recovererd from storage");
			}
		}
		if (Globalseventv){
			if (!seventv){seventv = {};}
			seventv.globalEmotes = Globalseventv;
		}
		seventv.url = url;
		seventv.type = type;
		seventv.user = userID;
	} catch (e) {
		console.error(e);
	}
	return seventv;
}

async function getFFZEmotes(url = false, type=null, channel=null) {
	var ffz = {};
	var userID = false;

	try {
		if (type){
			type = type.toLowerCase();
		} else if (url && url.includes("youtube.com/")) {
			type = "youtube";
		} else if (url && url.includes("twitch.tv/")) {
			type = "twitch";
		}

		if (type == "youtube") {
			// YouTube functionality remains largely the same
			var vid = false;
			if (url) {
				vid = YouTubeGetID(url);
			}

			if (vid) {
				userID = localStorage.getItem("vid2uid:" + vid);

				if (!userID) {
					userID = await fetch("https://api.socialstream.ninja/youtube/user?video=" + vid)
						.then(result => result.text())
						.catch(err => {
							console.error(err);
						});
					if (userID) {
						localStorage.setItem("vid2uid:" + vid, userID);
					} else {
						return false;
					}
				}
				if (userID) {
					ffz = getItemWithExpiry("uid2ffz.youtube:" + userID);
					if (!ffz) {
						// Use FFZ API to get user's emotes
						ffz = await fetch(`https://api.frankerfacez.com/v1/room/yt/${userID}`)
							.then(result => result.json())
							.catch(err => {
								console.error(err);
							});

						if (ffz && ffz.sets) {
							ffz.channelEmotes = Object.values(ffz.sets).flatMap(set => 
								set.emoticons.map(emote => ({
									[emote.name]: {
										url: emote.urls["1"], // Use 1x size as default
										zw: emote.modifier // FFZ uses 'modifier' flag for zero-width emotes
									}
								}))
							).reduce((acc, curr) => Object.assign(acc, curr), {});

							setItemWithExpiry("uid2ffz.youtube:" + userID, ffz);
						}
					}
				}
			}
		} else if (type == "twitch") {
			
			var username = "";
			if (channel){
				username = channel;
			} else if (url && url.startsWith("https://dashboard.twitch.tv/popout/u/")){
				username = url.replace("https://dashboard.twitch.tv/popout/u/","").split("/")[0];
			} else if (url){
				username =  url.split("popout/");
				if (username.length > 1) {
					username = username[1].split("/")[0];
				} else {
					username = "";
				}
			}

			log("username: " + username);
			if (username) {
				ffz = getItemWithExpiry("uid2ffz.twitch:" + username.toLowerCase());
				log("FFZ2", ffz);
				if (!ffz || ffz.message) {
					// Use FFZ API to get user's emotes
					ffz = await fetch(`https://api.frankerfacez.com/v1/room/${username}`)
						.then(result => result.json())
						.catch(err => {
							console.error(err);
						});

					if (ffz && ffz.sets) {
						ffz.channelEmotes = Object.values(ffz.sets).flatMap(set => 
							set.emoticons.map(emote => ({
								[emote.name]: {
									url: emote.urls["3"] || emote.urls["2"] || emote.urls["1"], // Use 1x size as default
									zw: emote.modifier // FFZ uses 'modifier' flag for zero-width emotes
								}
							}))
						).reduce((acc, curr) => Object.assign(acc, curr), {});

						setItemWithExpiry("uid2ffz.twitch:" + username.toLowerCase(), ffz);
					} else {
						ffz = {};
					}
					log("FFZ", ffz);
				} else {
					log("ffz recovered from storage");
				}
			}
		}

		if (!Globalffz) {
			Globalffz = getItemWithExpiry("globalffz");

			if (!Globalffz) {
				// Use FFZ API to get global emotes
				Globalffz = await fetch("https://api.frankerfacez.com/v1/set/global")
					.then(result => result.json())
					.catch(err => {
						console.error(err);
					});
				if (Globalffz && Globalffz.sets) {
					Globalffz = Object.values(Globalffz.sets).flatMap(set => 
						set.emoticons.map(emote => ({
							[emote.name]: {
								url: emote.urls["1"], // Use 1x size as default
								zw: emote.modifier // FFZ uses 'modifier' flag for zero-width emotes
							}
						}))
					).reduce((acc, curr) => Object.assign(acc, curr), {});
					setItemWithExpiry("globalffz", Globalffz);
				} else {
					Globalffz = {};
				}
			} else {
				log("Globalffz recovered from storage");
			}
		}
		if (Globalffz){
			if (!ffz){ffz = {};}
			ffz.globalEmotes = Globalffz;
		}
		ffz.url = url;
		ffz.type = type;
		ffz.user = userID;
	} catch (e) {
		console.error(e);
	}
	return ffz;
}

const emoteRegex = /(?<=^|\s)(\S+?)(?=$|\s)/g;

function replaceEmotesWithImages(message, emotesMap, zw = false) {
  return message.replace(emoteRegex, (match, emoteMatch) => {
	const emote = emotesMap[emoteMatch];
	if (emote) {
	  const escapedMatch = escapeHtml(match);
	  if (!zw || typeof emote === "string") {
		return `<img src="${emote}" alt="${escapedMatch}" class='zero-width-friendly'/>`;
	  } else if (emote.url) {
		return `<span class="zero-width-span"><img src="${emote.url}" alt="${escapedMatch}" class="zero-width-emote" /></span>`;
	  }
	}
	return match;
  });
}
	

class CheckDuplicateSources { // doesn't need to be text-only, as from the same source / site, so expected the same formating
  constructor() {
    this.messages = new Map();
    this.expireTime = 6000;
  }

  generateKey(channel, user, text) {
    return `${channel}-${user}-${text}`;
  }

  isDuplicate(channel, user, text) {
    const currentTime = Date.now();
    const key = this.generateKey(channel, user, text);

    if (this.messages.has(key)) {
      const lastTime = this.messages.get(key);
      if (currentTime - lastTime < this.expireTime) {
        return true;
      }
    }

    this.messages.set(key, currentTime);
    this.cleanUp(currentTime);

    return false;
  }

  cleanUp(currentTime) {
    for (const [key, time] of this.messages.entries()) {
      if (currentTime - time > this.expireTime) {
        this.messages.delete(key);
      }
    }
  }
}



function extractVideoId(url) {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname.replace(/\/+$/, '');
    const searchParams = urlObj.searchParams;
    
    // Standard YouTube domains
    if (!['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com', 'studio.youtube.com'].includes(hostname)) {
      return null;
    }
    
    // Handle youtu.be short links
    if (hostname === 'youtu.be') {
      return pathname.split('/')[1]?.split('?')[0] || null;
    }
    
    // Handle /live/ format
    if (pathname.startsWith('/live/')) {
      return pathname.split('/live/')[1]?.split('?')[0] || null;
    }
    
    // Handle /watch?v= format
    if (pathname === '/watch') {
      return searchParams.get('v');
    }
    
    // Handle /embed/ format
    if (pathname.startsWith('/embed/')) {
      return pathname.split('/embed/')[1]?.split('?')[0] || null;
    }
    
    // Handle studio.youtube.com/video/ format
    if (pathname.startsWith('/video/')) {
      return pathname.split('/video/')[1]?.split('/')[0] || null;
    }
    
    // Get v parameter regardless of URL structure
    const vParam = searchParams.get('v');
    if (vParam) return vParam;
    
    return null;
  } catch (e) {
    console.warn('Error extracting video ID:', e);
    return null;
  }
}

// The rest of your active chat sources code remains the same
let activeChatSources = new Map();
try {
  if (chrome.tabs.onRemoved){
    chrome.tabs.onRemoved.addListener((tabId) => {
      for (let key of activeChatSources.keys()) {
        if (key.startsWith(`${tabId}-`)) {
          activeChatSources.delete(key);
        }
      }
    });
  }
  if (chrome.tabs.onUpdated){
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        const videoId = extractVideoId(tab.url);
        if (videoId && (
          tab.url.includes('https://studio.youtube.com/live_chat?') ||
          tab.url.includes('https://www.youtube.com/live_chat?') ||
          tab.url.includes('https://www.youtube.com/live/')
        )) {
          const isPopout = tab.url.includes('live_chat?is_popout=1');
          activeChatSources.set(`${tabId}-0`, { url: tab.url, videoId: videoId, isPopout: isPopout });
        } else {
          for (let key of activeChatSources.keys()) {
            if (key.startsWith(`${tabId}-`)) {
              activeChatSources.delete(key);
            }
          }
        }
      }
    });
  }
} catch(e){
  console.warn(e);
}

function shouldAllowYouTubeMessage(tabId, tabUrl, msg, frameId = 0) {
  const videoId = msg.videoid || extractVideoId(tabUrl);
  if (!videoId) return true;

  const sourceId = `${tabId}-${frameId}`;
  
  const isPopout = tabUrl.includes('live_chat?is_popout=1');
  
  activeChatSources.set(sourceId, { 
    url: tabUrl, 
    videoId: videoId, 
    isPopout: isPopout
  });

  const sourcesForThisVideo = Array.from(activeChatSources.entries())
    .filter(([, data]) => data.videoId === videoId);

  if (sourcesForThisVideo.length === 1) {
    return true; 
  }

  const hasPopout = sourcesForThisVideo.some(([, data]) => data.isPopout);

  if (hasPopout) {
    return isPopout; 
  }

  return sourceId === sourcesForThisVideo[0][0];
}

const checkDuplicateSources = new CheckDuplicateSources();

async function processIncomingMessage(message, sender=null){
	
	try {
		if (sender?.tab){
			message.tid = sender.tab.id; // including the source (tab id) of the social media site the data was pulled from
		}
	} catch (e) {}

	if (isExtensionOn && message?.type) {
		if (!checkIfAllowed(message.type)) {
			return;
		}

		if (settings.filtercommands && message.chatmessage && message.chatmessage.startsWith("!")) {
			return;
		}

		if (settings.filtercommandscustomtoggle && message.chatmessage && settings.filtercommandscustomwords && settings.filtercommandscustomwords.textsetting) {
			if (settings.filtercommandscustomwords.textsetting.split(",").some(v => v.trim() && message.chatmessage.startsWith(v.trim()))) {
				return;
			}
		}
		
		let reflection = false;
		
		// checkExactDuplicateAlreadyReceived only does work if there was a message responsein the last 10 seconds.
		reflection = checkExactDuplicateAlreadyReceived(message.chatmessage, message.textonly, message.tid, message.type);
		if (reflection && (settings.firstsourceonly || settings.hideallreplies || settings.thissourceonly)){
			return;
		}
		
		if (reflection===null){
			reflection = true;
		}
		
		if (reflection){
			message.reflection = true;
		}
		
		if (settings.noduplicates && // filters echos if same TYPE, USERID, and MESSAGE 
			checkDuplicateSources.isDuplicate(message.type, (message.userid || message.chatname), 
				(message.chatmessage || message.hasDonation || (message.membership && message.event)))) {
					return;
		} 
		
		if ((message.type == "youtube") || (message.type == "youtubeshorts")){
			if (settings.blockpremiumshorts && (message.type == "youtubeshorts")){
				if (message.hasDonation || (message.membership && message.event)){
					return;
				}
			}
			try {
				if (sender?.tab && ("iframeId" in sender)){
					const shouldAllowMessage = shouldAllowYouTubeMessage(sender.tab.id, sender.tab.url, message, sender.frameId);
					if (!shouldAllowMessage) {
					  return;
					}
				}
			  } catch(e) {
				//console.warn("Error in shouldAllowYouTubeMessage:", e);
			  }
			
			if (sender?.tab?.url) {
				var brandURL = getYoutubeAvatarImage(sender.tab.url); // query my API to see if I can resolve the Channel avatar from the video ID
				if (brandURL) {
					message.sourceImg = brandURL;
				}
			}
		} 

		if (message.type == "facebook") {
			// since Facebook dupes are a common issue
			if (sender?.tab?.url) {
				if (message.chatname && message.chatmessage) {
					clearInterval(FacebookDupesTime);
					if (FacebookDupes == message.chatname + ":" + message.chatmessage) {
						return;
					} else {
						FacebookDupes = message.chatname + ":" + message.chatmessage;
						FacebookDupesTime = setTimeout(function () {
							FacebookDupes = "";
						}, 15000);
					}
				}
			}
		}
		
		if (!message.id) {
			messageCounter += 1;
			message.id = messageCounter; 
		}
		
		try {
			message = await applyBotActions(message, sender?.tab); // perform any immediate actions
		} catch (e) {
			console.warn(e);
		}
		if (!message) {
			return message;
		}
		
		try {
			message = await window.eventFlowSystem.processMessage(message); // perform any immediate actions
		} catch (e) {
			console.warn(e);
		}
		if (!message) {
			return message;
		}
		
		sendToDestinations(message); // send the data to the dock
	}
	return message;
}

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponseReal) {
	var response = {};
	var alreadySet = false;
	
	function sendResponse(msg) {
		if (alreadySet) {
		  console.error("Shouldn't run sendResponse twice");
		} else if (sendResponseReal) {
		  alreadySet = true;
		  // Always include current state in responses
		  if (typeof msg == "object"){
			msg.state = isExtensionOn;
		  }
		  sendResponseReal(msg);
		}
		response = msg;
	}
	
	if (!loadedFirst){
		for (var i = 0 ;i < 100;i++){
			await sleep(100);
			if (loadedFirst){
				break;
			}
		}
		// add a stall here instead if this actually happens
		if (!loadedFirst){
			sendResponse({"tryAgain":true});
			return response;
		}
	}
	
	try {
		if (typeof request !== "object") {
			sendResponse({"state": isExtensionOn});
			return response;
		}

		if (request.cmd && request.cmd === "setOnOffState") {
			// toggle the IFRAME (stream to the remote dock) on or off
			isExtensionOn = request.data.value;

			updateExtensionState();
			sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings });
		} else if (request.cmd && request.cmd === "getOnOffState") {
			sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings });
		} else if (request.cmd && request.cmd === "getSettings") {
			try { 
				sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings, documents: documentsRAG});
			} catch(e){
				sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings});
			}
		} else if (request.cmd && request.cmd === "saveSetting") {
			if (typeof settings[request.setting] == "object") {
				if (!request.value) {
					// pretty risky if something shares the same name.
					delete settings[request.setting];
				} else {
					settings[request.setting][request.type] = request.value;
					if (request.type == "json"){
						settings[request.setting]["object"] = JSON.parse(request.value); // convert to object for use
					}
				}
			} else if ("type" in request) {
				if (!request.value) {
					delete settings[request.setting];
				} else {
					settings[request.setting] = {};
					settings[request.setting][request.type] = request.value;
					if (request.type == "json"){
						settings[request.setting]["object"] = JSON.parse(request.value); // convert to object for use
					}
					//settings[request.setting].value = request.value; // I'll use request.value instead
				}
			} else {
				settings[request.setting] = request.value;
			}
			
			Object.keys(patterns).forEach(pattern=>{
				settings[pattern] = findExistingEvents(pattern,{ settings });
			})

			chrome.storage.local.set({
				settings: settings
			});
			chrome.runtime.lastError;

			sendResponse({ state: isExtensionOn });
			
			if (request.target){
				sendTargetP2P(request, request.target);
			}

			if (request.setting == "midi") {
				toggleMidi();
			}
			
			// if (request.setting == "customGifCommands") {
				// if (request.setting["customGifCommands"].array){
					// request.setting["customGifCommands"].array
				// }
			// }

			if (request.setting == "socketserver") {
				if (request.value) {
					if (!socketserver) {
						setupSocket();
					}
				} else {
					if (socketserver) {
						socketserver.close();
					}
				}
			}

			if (request.setting == "lanonly") {
				if (request.value) {
					if (iframe) {
						if (iframe.src) {
							iframe.src = null;
						}

						iframe.remove();
						iframe = null;
					}
					if (isExtensionOn) {
						loadIframe(streamID, password);
					}
				} else {
					if (iframe) {
						if (iframe.src) {
							iframe.src = null;
						}

						iframe.remove();
						iframe = null;
					}
					if (isExtensionOn) {
						loadIframe(streamID, password);
					}
				}
			}

			if (request.setting == "server2") {
				if (request.value) {
					if (!socketserverDock) {
						setupSocketDock();
					}
				} else {
					if (socketserverDock && !settings.server3) {
						// server 3 also needs to be off
						socketserverDock.close();
					}
				}
			} else if (request.setting == "server3") {
				if (request.value) {
					if (!socketserverDock) {
						setupSocketDock();
					}
				} else {
					if (socketserverDock && !settings.server2) {
						// server 2 also needs to be off
						socketserverDock.close();
					}
				}
			}
			if (request.setting == "textonlymode") { 
				pushSettingChange();
			}
			if (request.setting == "vdoninjadiscord") { 
				pushSettingChange();
			}
			if (request.setting == "ignorealternatives") {
				pushSettingChange();
			}
			if (request.setting == "tiktokdonations") {
				pushSettingChange();
			}
			if (request.setting == "notiktokdonations") {
				pushSettingChange();
			}
			if (request.setting == "twichadmute") { 
				pushSettingChange();
			} 
			if (request.setting == "twichadannounce") {
				pushSettingChange();
			}
			if (request.setting == "autoLiveYoutube") {
				pushSettingChange();
			}
			if (request.setting == "relaytargets") {	
				if (settings.relaytargets && settings.relaytargets.textsetting){
					relaytargets = settings.relaytargets.textsetting
						.split(",")
						.map(item => item.trim().toLowerCase())
						.filter(item => item !== "");
					if (!relaytargets.length){
						relaytargets = false;
					}
				} else {
					relaytargets = false;
				}
			}
			
			if (request.setting == "ticker") {
				try {
					await loadFileTicker();
				} catch(e){}
			}
			if (request.setting == "discord") {
				pushSettingChange();
			}
			if (request.setting == "customdiscordchannel") {
				pushSettingChange();
			}
			if (request.setting == "flipYoutube") {
				pushSettingChange();
			}
			if (request.setting == "hidePaidPromotion") {
				pushSettingChange();
			}
			if (request.setting == "fancystageten") {
				pushSettingChange();
			}
			if (request.setting == "allmemberchat") {
				pushSettingChange();
			}
			if (request.setting == "limitedyoutubememberchat") {
				pushSettingChange();
			}
			if (request.setting == "drawmode") {
				sendWaitlistConfig(null, true);
			}
			if (request.setting == "collecttwitchpoints") {
				pushSettingChange();
			}
			if (request.setting == "detweet") {
				pushSettingChange();
			}
			if (request.setting == "xcapture") {
				pushSettingChange();
			}
			if (request.setting == "memberchatonly") {
				pushSettingChange();
			}
			if (request.setting == "customtwitchstate") {
				pushSettingChange();
			}
			if (request.setting == "streamerbot") {
				handleStreamerBotSettingsChange();
			}
			if (request.setting == "streamerbotendpoint") {
				handleStreamerBotSettingsChange();
			}
			if (request.setting == "streamerbotpassword") {
				handleStreamerBotSettingsChange();
			}
			if (request.setting == "replyingto") {
				pushSettingChange();
			}
			if (request.setting == "delayyoutube") {
				pushSettingChange();
			}
			if (request.setting == "delaykick") {
				pushSettingChange();
			}
			if (request.setting == "delaytwitch") {
				pushSettingChange();
			}
			if (request.setting == "customtwitchaccount") {
				pushSettingChange();
			}
			if (request.setting == "customtiktokstate") {
				pushSettingChange();
			}
			if (request.setting == "customtiktokaccount") {
				pushSettingChange();
			}
			if (request.setting == "customyoutubestate") {
				pushSettingChange();
			}
			if (request.setting == "customkickstate") {
				pushSettingChange();
			}
			if (request.setting == "customriversidestate") {
				pushSettingChange();
			}
			if (request.setting == "customlivespacestate") {
				pushSettingChange();
			}
			if (request.setting == "customlivespaceaccount") {
				pushSettingChange();
			}
			if (request.setting == "customyoutubeaccount") {
				pushSettingChange();
			}
			//if (request.setting == "mynameext") {
			//	request.setting = "hostnamesext"
			//}
			if (request.setting == "hostnamesext") {
				pushSettingChange();
			}
			if (request.setting == "nosubcolor") {
				pushSettingChange();
			}
			if (request.setting == "captureevents") {
				pushSettingChange();
			}
			if (request.setting == "capturejoinedevent") {
				pushSettingChange();
			} 
			if (request.setting == "bttv") {
				if (settings.bttv) {
					clearAllWithPrefix("uid2bttv2.twitch:");
					clearAllWithPrefix("uid2bttv2.youtube:");
					await getBTTVEmotes();
				}
				pushSettingChange();
			}
			if (request.setting == "seventv") {
				if (settings.seventv) {
					clearAllWithPrefix("uid2seventv.twitch:");
					clearAllWithPrefix("uid2seventv.youtube:");
					clearAllWithPrefix("uid2seventv.kick:");
					await getSEVENTVEmotes();
				}
				pushSettingChange();
			}
			if (request.setting == "ffz") {
				if (settings.ffz) {
					clearAllWithPrefix("uid2ffz.twitch:");
					clearAllWithPrefix("uid2ffz.youtube:");
					await getFFZEmotes();
				}
				pushSettingChange();
			}
			if (request.setting == "pronouns") {
				if (settings.pronouns) {
					clearAllWithPrefix("Pronouns");
					Pronouns = false;
					await getPronouns();
				}
			}
			if (request.setting == "addkarma") {
				if (request.value) {
					if (!sentimentAnalysisLoaded) {
						loadSentimentAnalysis();
					}
				}
			}
			
			if (request.setting == "hypemode") {
				if (!request.value) {
					processHype2(); // stop hype and clear old hype
				}
				pushSettingChange();
			} 
			if (request.setting == "showviewercount") {
				pushSettingChange();
			}
			
			if (request.setting == "waitlistmode") {
				initializeWaitlist();
			}
			
			if (request.setting == "pollEnabled") {
				initializePoll();
			}
			
			//if (request.setting == "ollamatts") {
			//	sendTargetP2P({settings:settings}, "bot");
			//}
			
			if (request.setting == "wordcloud") {
				setWordcloud(request.value);
			}

			if (request.setting == "customwaitlistmessagetoggle" || request.setting == "customwaitlistmessage" || request.setting == "customwaitlistcommand") {
				sendWaitlistConfig(null, true); // stop hype and clear old hype
			}

			if (request.setting == "translationlanguage") {
				// After saving, the value is stored in settings[translationlanguage].optionsetting
				if (settings.translationlanguage && settings.translationlanguage.optionsetting) {
					changeLg(settings.translationlanguage.optionsetting);
				} else {
					changeLg(request.value);
				}
			}

			if (request.setting.startsWith("timemessage")) {
				if (request.setting.startsWith("timemessageevent")) {
					var i = parseInt(request.setting.split("timemessageevent")[1]);
					if (i){
						if (!request.value) {
							// turn off
							if (intervalMessages[i]) {
								clearInterval(intervalMessages[i]);
								delete intervalMessages[i];
							}
						} else {
							checkIntervalState(i);
						}
					}
				} else {
					var i = 0;
					if (request.setting.startsWith("timemessageoffset")) {
						i = parseInt(request.setting.split("timemessageoffset")[1]);
					} else if (request.setting.startsWith("timemessagecommand")) {
						i = parseInt(request.setting.split("timemessagecommand")[1]);
					} else if (request.setting.startsWith("timemessageinterval")) {
						i = parseInt(request.setting.split("timemessageinterval")[1]);
					}
					if (i) {
						checkIntervalState(i);
					}
				}
			}

			if (isExtensionOn) {
				if (request.setting == "blacklistuserstoggle" || request.setting == "blacklistusers") {
					if (settings.blacklistusers && settings.blacklistuserstoggle) {
						settings.blacklistusers.textsetting.split(",").forEach(user => {
							user = user.trim();
							sendToDestinations({ delete: { chatname: user } });
						});
					}
				}
				// if ((request.setting == "viplistuserstoggle") || (request.setting == "viplistusers")){
				// if (settings.viplistusers && settings.viplistuserstoggle){
				// settings.viplistusers.textsetting.split(",").forEach(user=>{
				// user = user.trim();
				// sendToDestinations({"vipUser": {chatname:user}});
				// });
				// }
				// }
			}
		} else if ("inject" in request) {
			if (request.inject == "mobcrush") {
				chrome.webNavigation.getAllFrames({ tabId: sender.tab.id }, frames => {
					frames.forEach(f => {
						if (f.frameId && f.frameType === "sub_frame" && f.url.includes("https://www.mobcrush.com/")) {
							chrome.tabs.executeScript(sender.tab.id, {
								frameId: f.frameId,
								file: "mobcrush.js"
							});
						}
					});
				});
			}
			sendResponse({ state: isExtensionOn });
		} else if ("delete" in request) {
			sendResponse({ state: isExtensionOn });
			if (isExtensionOn && (request.delete.type || request.delete.chatname || request.delete.id)) {
				sendToDestinations({ delete: request.delete });
			}
		} else if ("message" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			
			if (request?.message && !request.message.id) {
				messageCounter += 1;
				request.message.id = messageCounter;
				sendResponse({ state: isExtensionOn, id: request.message.id });
			} else {
				sendResponse({ state: isExtensionOn});
			}
			var letsGo = await processIncomingMessage(request.message, sender);
			
		} else if ("messages" in request) {
			// Handle batch messages from YouTube and TikTok
			sendResponse({ state: isExtensionOn });
			if (Array.isArray(request.messages)) {
				// Process messages in parallel for better performance
				await Promise.all(request.messages.map(message => 
					processIncomingMessage(message, sender).catch(error => {
						console.error('Error processing message:', error);
						// Continue processing other messages even if one fails
					})
				));
			}
		} else if ("getBTTV" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			console.log("BTTV request received:", JSON.stringify(request));
			sendResponse({ state: isExtensionOn });
			if (sender.tab.url || request.url) {
				// Use request.url if provided (for specific video/channel), otherwise fall back to sender.tab.url
				var urlToUse = request.url || sender.tab.url;
				console.log("Using URL for BTTV:", urlToUse);
				var BTTV2 = await getBTTVEmotes(urlToUse, request.type, request.channel); // query my API to see if I can resolve the Channel avatar from the video ID
				if (BTTV2) {
					console.log("BTTV emotes found, sending to tab:", sender.tab.id);
					//console.log(BTTV2);
					chrome.tabs.sendMessage(sender.tab.id, { BTTV: BTTV2 }, function (response = false) {
						chrome.runtime.lastError;
					});
				} else {
					console.log("No BTTV emotes found");
				}
			}
		} else if ("getSEVENTV" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			//console.log("getSEVENTV");
			sendResponse({ state: isExtensionOn });
			if (sender.tab.url || request.url) {
				// Use request.url if provided (for specific video/channel), otherwise fall back to sender.tab.url
				var urlToUse = request.url || sender.tab.url;
				var SEVENTV2 = await getSEVENTVEmotes(urlToUse, request.type, request?.channel, request?.userid); // query my API to see if I can resolve the Channel avatar from the video ID
				if (SEVENTV2) {
					//	//console.logsender);
					//	//console.logSEVENTV2);
					chrome.tabs.sendMessage(sender.tab.id, { SEVENTV: SEVENTV2 }, function (response = false) {
						chrome.runtime.lastError;
					});
				}
			}
		} else if ("getFFZ" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			////console.log"getFFZ");
			sendResponse({ state: isExtensionOn });
			if (sender.tab.url || request.url) {
				// Use request.url if provided (for specific video/channel), otherwise fall back to sender.tab.url
				var urlToUse = request.url || sender.tab.url;
				var FFZ2 = await getFFZEmotes(urlToUse, request.type, request.channel); // query my API to see if I can resolve the Channel avatar from the video ID
				if (FFZ2) {
					//	//console.logsender);
					//	//console.logFFZ2);
					chrome.tabs.sendMessage(sender.tab.id, { FFZ: FFZ2 }, function (response = false) {
						chrome.runtime.lastError;
					});
				}
			}
		} else if ("getSettings" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			sendResponse({ state: isExtensionOn, streamID: streamID, password: password, settings: settings }); // respond to Youtube/Twitch/Facebook with the current state of the plugin; just as possible confirmation.
			try {
				priorityTabs.add(sender.tab.id);
			} catch (e) {
				console.error(e);
			}
		} else if ("pokeMe" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			sendResponse({ state: isExtensionOn }); // respond to Youtube/Twitch/Facebook with the current state of the plugin; just as possible confirmation.
			pokeSite(sender.tab.url, sender.tab.id);
		} else if ("keepAlive" in request) {
			// forwards messages from Youtube/Twitch/Facebook to the remote dock via the VDO.Ninja API
			var action = {};
			action.tid = sender.tab.id; // including the source (tab id) of the social media site the data was pulled from
			action.response = ""; // empty response, as we just want to keep alive
			//sendMessageToTabs(action);
			sendMessageToTabs(action, false, null, false, false, false);
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "tellajoke") {
			tellAJoke();
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "enableYouTube") {
			enableYouTube();
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "openchat") {
			openchat(request.value, true);
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "startgame") {
			//startgame(request.value, true);
			sendDataP2P({startgame:true}); 
			sendResponse({ state: isExtensionOn });	
		} else if (request.cmd && request.cmd === "singlesave") {
			sendResponse({ state: isExtensionOn });
			overwriteFile("setup");
		} else if (request.cmd && request.cmd === "excelsave") {
			sendResponse({ state: isExtensionOn });
			overwriteFileExcel("setup");
		} else if (request.cmd && request.cmd === "loadtickerfile") {
			sendResponse({ state: isExtensionOn });
			selectTickerFile();
		} else if (request.cmd && request.cmd === "savenames") {
			sendResponse({ state: isExtensionOn });
			overwriteSavedNames("setup");
		} else if (request.cmd && request.cmd === "savenamesStop") {
			sendResponse({ state: isExtensionOn });
			overwriteSavedNames("stop");
		} else if (request.cmd && request.cmd === "savenamesClear") {
			sendResponse({ state: isExtensionOn });
			overwriteSavedNames("clear");
		} else if (request.cmd && request.cmd === "loadmidi") {
			await loadmidi();
			sendResponse({ settings: settings, state: isExtensionOn });
		} else if (request.cmd && request.cmd === "export") {
			sendResponse({ state: isExtensionOn });
			await exportSettings();
		} else if (request.cmd && request.cmd === "import") {
			sendResponse({ state: isExtensionOn });
			await importSettings();
		} else if (request.cmd && request.cmd === "bigwipe") {
			sendResponse({ state: isExtensionOn });
			await resetSettings();
		} else if (request.cmd && request.cmd === "excelsaveStop") {
			sendResponse({ state: isExtensionOn });
			newFileHandleExcel = false;
		} else if (request.cmd && request.cmd === "singlesaveStop") {
			sendResponse({ state: isExtensionOn });
			newFileHandle = false;
		} else if (request.cmd && request.cmd === "selectwinner") {
			////console.logrequest);
			if ("value" in request) {
				resp = selectRandomWaitlist(parseInt(request.value) || 1);
			} else {
				resp = selectRandomWaitlist();
			}
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "resetwaitlist") {
			resetWaitlist();
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "stopentries") {
			toggleEntries(false);
			sendResponse({ state: isExtensionOn });	
		} else if (request.cmd && request.cmd === "removefromwaitlist") {
			removeWaitlist(parseInt(request.value) || 0);
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "highlightwaitlist") {
			highlightWaitlist(parseInt(request.value) || 0);
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "downloadwaitlist") {
			downloadWaitlist();
			sendResponse({ state: isExtensionOn });
		} else if (request.cmd && request.cmd === "cleardock") {
			sendResponse({ state: isExtensionOn });
			var data = {};
			data.action = "clearAll";
			if (request.ctrl) {
				data.ctrl = true;
			}
			try {
				sendDataP2P(data);
			} catch (e) {
				console.error(e);
			}
		} else if (request.cmd && request.cmd === "uploadRAGfile") {
			sendResponse({ state: isExtensionOn });
			await importSettingsLLM(request.enhancedProcessing || false);
			try {
				messagePopup({documents: documentsRAG});
			} catch(e){}
		} else if (request.cmd && request.cmd === "clearRag") {
			sendResponse({ state: isExtensionOn });
			try {
				await clearLunrDatabase();
				messagePopup({documents: documentsRAG});
			} catch(e){}
		} else if (request.cmd === "deleteRAGfile") {
			sendResponse({ state: isExtensionOn });
			try {
				await deleteDocument(request.docId);
				messagePopup({documents: documentsRAG});
			} catch(e){}
		} else if (request.cmd && request.cmd === "fakemsg") {
			sendResponse({ state: isExtensionOn });
			
			triggerFakeRandomMessage();
			
		} else if (request.action === "startReplay") {
			// Handle replay messages from timestamp
			console.log('Received startReplay request:', request);
			
			// Check if extension is on
			if (!isExtensionOn) {
				sendResponse({ error: 'Social Stream is not enabled. Please turn it on first.' });
				return;
			}
			
			handleReplayMessages(request, sendResponse);
			return true; // async response
		} else if (request.action === "pauseReplay") {
			pauseReplay(request.sessionId);
			sendResponse({success: true, state: isExtensionOn});
		} else if (request.action === "resumeReplay") {
			resumeReplay(request.sessionId);
			sendResponse({success: true, state: isExtensionOn});
		} else if (request.action === "stopReplay") {
			stopReplay(request.sessionId);
			sendResponse({success: true, state: isExtensionOn});
		} else if (request.action === "updateReplaySpeed") {
			updateReplaySpeed(request.sessionId, request.speed);
			sendResponse({success: true, state: isExtensionOn});
		} else if (request.cmd && request.cmd === "sidUpdated") {
			if (request.streamID) {
				streamID = request.streamID;
				
				streamID = validateRoomId(streamID);
				if (!streamID){
					try {
						chrome.notifications.create({
							type: "basic",
							iconUrl: "./icons/icon-128.png",
							title: "Invalid session ID",
							message: "Your session ID is invalid.\n\nPlease correct it to continue"
						});
						throw new Error('Invalid session ID');
					} catch (e) {
						console.error(e);
						throw new Error('Invalid session ID');
					}
				}
				
				if (isSSAPP) {
					if (chrome && chrome.storage && chrome.storage.sync && chrome.storage.sync.set) {
						chrome.storage.sync.set({
							streamID: streamID || ""
						});
					}
				}
			}
			if ("password" in request) {
				password = request.password;
				if (isSSAPP) {
					if (chrome && chrome.storage && chrome.storage.sync && chrome.storage.sync.set) {
						chrome.storage.sync.set({
							password: password || ""
						});
					}
				}
			}

			if ("state" in request) {
				isExtensionOn = request.state;
			}
			if (iframe) {
				if (iframe.src) {
					iframe.src = null;
				}

				iframe.remove();
				iframe = null;
			}
			if (isExtensionOn) {
				loadIframe(streamID, password);
			}
			
			if (isSSAPP){
				sendResponse({ state: isExtensionOn});
			} else {
				sendResponse({ state: isExtensionOn, streamID: streamID, password: password });
			}
		} else if (request.cmd && (request.cmd === 'uploadCustomJs')) {
			localStorage.setItem('customJavaScript', request.data);
			try {
				// Load the custom JavaScript immediately using script injection
				const success = loadCustomJs(request.data);
				if (success) {
					sendResponse({success: true, state: isExtensionOn });
				} else {
					throw new Error("Failed to load custom JavaScript");
				}
			} catch(e){
				console.error("Custom JS loading error:", e);
				sendResponse({success: false, error: e.message, state: isExtensionOn });
			}
		} else if (request.cmd && (request.cmd === 'deleteCustomJs')) {
			localStorage.removeItem('customJavaScript');
			// Reset the custom function to default
			resetCustomJs();
			sendResponse({success: true, state: isExtensionOn });
		} else if (request.cmd && (request.cmd === 'uploadBadwords')) {
			localStorage.setItem('customBadwords', request.data);
			try {
				let customBadWordsList = request.data.split(/\r?\n|\r|\n/g);
				customBadWordsList = generateVariationsList(customBadWordsList);
				profanityHashTable = createProfanityHashTable(customBadWordsList);
				sendResponse({success: true, state: isExtensionOn });
			} catch(e){
				sendResponse({success: false, state: isExtensionOn });
			}
		} else if (request.cmd && (request.cmd === 'deleteBadwords')) {
			localStorage.removeItem('customBadwords');
			initialLoadBadWords();
			sendResponse({success: true, state: isExtensionOn });
		} else if (request.cmd && request.target){
			sendResponse({ state: isExtensionOn });
			sendTargetP2P(request, request.target);
		} else {
			sendResponse({ state: isExtensionOn });
		}
	} catch (e) {
		console.warn(e);
	}
	return true;
});

const randomDigits = () => {
  const length = Math.floor(Math.random() * 21) + 5;
  const firstDigit = Math.floor(Math.random() * 9) + 1;
  const remainingDigits = Array(length - 1).fill().map(() => Math.floor(Math.random() * 10));
  return parseInt([firstDigit, ...remainingDigits].join(''));
};

function verifyOriginalNewIncomingMessage(msg, cleaned=false) {
	
	if (Date.now() - lastSentTimestamp > 5000) {
		// 2 seconds has passed; assume good.
		return true;
	}
	
	// //console.logmsg,lastSentMessage);
	
	try {
		if (!cleaned){
			msg = decodeAndCleanHtml(msg);
		}
		
		var score = fastMessageSimilarity(msg, lastSentMessage);
		// //console.logmsg, score);
		if (score > 0.5) { // same message
			
			lastMessageCounter += 1;
			if (lastMessageCounter>1) {
				// //console.log"1");
				return false;
			}
			if (settings.hideallreplies){
				// //console.log"2");
				return false;
			}
		}
	} catch(e){
		errorlog(e);
	}
		
	return true;
	
}

function fastMessageSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const normalize = str => str
        .toLowerCase()
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/\s+/g, '')
        .trim();

    const normA = normalize(a);
    const normB = normalize(b);
    
    // Handle exact match after normalization
    if (normA === normB) return 1;
    
    const maxLen = Math.max(normA.length, normB.length);
    const minLen = Math.min(normA.length, normB.length);
    
    // Check if one is prefix of the other
    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length < normB.length ? normB : normA;
    
    // For messages > 50 chars, if one is a prefix of the other
    // and covers at least 90% of the shorter message, consider it similar
    if (maxLen > 50 && longer.startsWith(shorter) && minLen / maxLen > 0.9) {
        return 0.95;
    }

    // For very short strings
    if (maxLen < 10) {
        const matched = [...normA].filter(char => normB.includes(char)).length;
        return matched / maxLen;
    }

    // Compute similarity based on character matches for position-sensitive comparison
    let matches = 0;
    const compareLen = Math.min(normA.length, normB.length);
    
    for (let i = 0; i < compareLen; i++) {
        if (normA[i] === normB[i]) matches++;
    }

    return matches / maxLen;
}

function ajax(object2send, url, ajaxType = "PUT", type = "application/json; charset=utf-8") {
	try {
		if (ajaxType == "PUT" && putNode) {
			putNode(url, object2send, (headers = { "Content-Type": type }));
		} else if (ajaxType == "POST" && postNode) {
			postNode(url, object2send, (headers = { "Content-Type": type }));
		} else {
			var xhttp = new XMLHttpRequest();
			xhttp.onreadystatechange = function () {
				if (this.readyState == 4 && this.status == 200) {
					// success
				} else {
				}
			};
			xhttp.open(ajaxType, url, true); // async = true
			xhttp.setRequestHeader("Content-Type", type);
			xhttp.send(JSON.stringify(object2send));
		}
	} catch (e) {}
}

const metaDataStore = new Map(); // Using Map instead of {} for better cleanup
let cleanUpLastTabs;

async function sendToDestinations(message) {
	if (typeof message == "object") {
		
		if (message.chatname) {
			message.chatname = filterXSS(message.chatname); // I do escapeHtml at the point of capture instead
		}

		if (message.chatmessage) {
			if (!message.textonly) {
				if (settings.bttv) {
					if (!Globalbttv) {
						await getBTTVEmotes();
					}
					if (Globalbttv) {
						message.chatmessage = replaceEmotesWithImages(message.chatmessage, Globalbttv);
					}
				}
				if (settings.seventv) {
					if (!Globalseventv) {
						await getSEVENTVEmotes();
					}
					if (Globalseventv) {
						message.chatmessage = replaceEmotesWithImages(message.chatmessage, Globalseventv, true);
					}
				}
				if (settings.ffz) {
					if (!Globalffz) {
						await getFFZEmotes();
					}
					if (Globalffz) {
						message.chatmessage = replaceEmotesWithImages(message.chatmessage, Globalffz, true);
					}
				}
				message.chatmessage = filterXSS(message.chatmessage);
			} //else {
			// replaceEmotesWithImagesText( ...  ); // maybe someday
			//}
		}
		
		
		if (settings.pronouns && (message.type == "twitch") && message.chatname) {
			let pronoun = await getPronounsNames(message.chatname);
			if (!Pronouns && pronoun){
				await getPronouns();
			}
			if (Pronouns && pronoun && pronoun.pronoun_id){
				if (pronoun.pronoun_id in Pronouns){
					if (!message.chatbadges){
						message.chatbadges = [];
					}
					var bage = {};
					bage.text = Pronouns[pronoun.pronoun_id];
					bage.type = "text";
					bage.bgcolor = "#000";
					bage.color = "#FFF";
					message.chatbadges.push(bage);
				}
			}
		}
		
		if (settings.colorofsourcebg && message && message.chatname) {
			message.backgroundColor = getColorFromType(message.type);
		}

		if (settings.randomcolor && message && !message.nameColor && message.chatname) {
			message.nameColor = getColorFromName(message.chatname, settings);
		} else if (settings.randomcolorall && message && message.chatname) {
			message.nameColor = getColorFromName(message.chatname, settings);
		} else if (settings.colorofsource && message && message.chatname) {
			message.nameColor = getColorFromType(message.type);
		}
		if (message.nameColor && settings.lightencolorname){
			message.nameColor = adjustColorForOverlay(message.nameColor)
		}

		if (settings.filtereventstoggle && settings.filterevents && settings.filterevents.textsetting && message.chatmessage && message.event) {
			const messageText = message.textContent || message.chatmessage;
			if (settings.filterevents.textsetting.split(",").some(v => (v.trim() && messageText.includes(v)))) {
				return false;
			}
		}
		
		if (message.event && message.tid && ("meta" in message)) {
			if (["viewer_update", "follower_update"].includes(message.event)) {
				let tabData = metaDataStore.get(message.tid);
				if (!tabData) {
				  tabData = {};
				  metaDataStore.set(message.tid, tabData);
				}
				
				tabData[message.event] = message;
				
				if (!cleanUpLastTabs) {
				  cleanUpLastTabs = setTimeout(() => {
					cleanUpLastTabs = null;
					chrome.tabs.query({}, (tabs) => {
					  const activeTabIds = new Set(
						tabs
						  .map(tab => tab.id)
						  .filter(Boolean)
					  );61000

					  // Cleanup closed tabs
					  for (const [tabId] of metaDataStore) {
						if (!activeTabIds.has(tabId)) {
						  metaDataStore.delete(tabId);
						}
					  }
					});
				  }, 61000); 
				}
				
				if (message.event === 'viewer_update') {
					var viewerCounts = {};
					for (const [tid, tabData] of metaDataStore) {
						if (tabData.viewer_update && tabData.viewer_update.type){
							let count = parseInt(tabData.viewer_update.meta) || 0;
							
							// Pump the numbers if enabled
							if (settings.pumpTheNumbers) {
								count = Math.round(count * 1.75);
							}
							
							viewerCounts[tabData.viewer_update.type] = (viewerCounts[tabData.viewer_update.type] || 0) + count;
						}
					}
					if (settings.hypemode) {
						updateViewerCount({event: "viewer_updates", meta: viewerCounts}); // updateViewerCount already calls combineHypeData and sends
					}
					
					sendDataP2P({event: "viewer_updates", meta: viewerCounts});
				}
				
				return true;
			}
		}
	}
	
	try {
		sendDataP2P(message); 
	} catch (e) {
		console.error(e);
	}
	try {
		if (settings.pollEnabled){
			sendTargetP2P(message, "poll");
		}
	} catch (e) {
		console.error(e);
	}
	
	try {
		if (settings.wordcloud){
			sendTargetP2P(message, "wordcloud");
		}
	} catch (e) {
		console.error(e);
	}
	
	try {
		if (settings.enableCustomGifCommands && settings["customGifCommands"]){
			// settings.enableCustomGifCommands.object = JSON.stringify([{command,url},{command,url},{command,url})
			settings["customGifCommands"]["object"].forEach(values=>{
				if (message && message.chatmessage && values.url && values.command && (message.chatmessage.split(" ")[0] === values.command)){
					//  || "https://picsum.photos/1280/720?random="+values.command
					sendTargetP2P({...message,...{contentimg: values.url}}, "gif"); // overwrite any existing contentimg. leave the rest of the meta data tho
				}
			});
		}
	} catch (e) {
		console.error(e);
	}

	sendToDisk(message);
	sendToH2R(message);
	sendToPost(message);
	sendToDiscord(message);  // donos only
	sendToStreamerBot(message);
	if (message.chatmessage || message.hasDonation || message.chatname){
		message.idx = await addMessageDB(message);
	}
	return true;
}

async function replayMessagesFromTimestamp(startTimestamp, endTimestamp = null, speed = 1, sessionId = null) {
    const db = await messageStoreDB.ensureDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([messageStoreDB.storeName], "readonly");
        const store = transaction.objectStore(messageStoreDB.storeName);
        const index = store.index("timestamp");
        const messages = [];
        
        let range;
        if (endTimestamp) {
            range = IDBKeyRange.bound(startTimestamp, endTimestamp);
        } else {
            range = IDBKeyRange.lowerBound(startTimestamp);
        }
        
        const cursorRequest = index.openCursor(range);
        
        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                messages.push(cursor.value);
                cursor.continue();
            } else {
                if (messages.length === 0) {
                    resolve({ messageCount: 0, messages: [] });
                    return;
                }

                messages.sort((a, b) => a.timestamp - b.timestamp);
                
                // Calculate when replay should start relative to now
                const replayStartTime = Date.now();
                const originalStartTime = startTimestamp;
                
                // Store session info for control
                if (sessionId) {
                    replaySessions[sessionId] = {
                        messages: messages,
                        currentIndex: 0,
                        isPaused: false,
                        speed: speed,
                        timeouts: [],
                        startTime: replayStartTime,
                        originalStartTime: originalStartTime
                    };
                }

                // Log first and last message times for debugging
                if (messages.length > 0) {
                    console.log('Replay timeline:', {
                        requestedStart: new Date(originalStartTime).toLocaleString(),
                        firstMessage: new Date(messages[0].timestamp).toLocaleString(),
                        lastMessage: new Date(messages[messages.length - 1].timestamp).toLocaleString(),
                        totalDuration: ((messages[messages.length - 1].timestamp - originalStartTime) / 1000 / 60).toFixed(1) + ' minutes',
                        messageCount: messages.length
                    });
                }

                messages.forEach((message, index) => {
                    // Calculate delay from the requested start time, not from first message
                    const messageOffsetFromStart = message.timestamp - originalStartTime;
                    const scaledDelay = messageOffsetFromStart / speed;
                    
                    // Skip messages that would have negative delay (shouldn't happen with proper range query)
                    if (scaledDelay < 0) {
                        console.warn('Skipping message with negative delay:', message);
                        return;
                    }
                    
                    // Log timing for first few messages
                    if (index < 3) {
                        console.log(`Message ${index + 1} will play after ${(scaledDelay / 1000).toFixed(1)}s - "${message.chatmessage?.substring(0, 50)}..."`);
                    }
                    
                    delete message.mid; // only found in messages restored from db.
                    
                    const timeoutId = setTimeout(() => {
                        if (sessionId && replaySessions[sessionId]) {
                            if (!replaySessions[sessionId].isPaused) {
                                sendDataP2P(message);
                                replaySessions[sessionId].currentIndex = index + 1;
                                
                                // Send progress update
                                const progress = ((index + 1) / messages.length) * 100;
                                // Send to all extension pages
                                chrome.runtime.sendMessage({
                                    action: 'replayProgress',
                                    sessionId: sessionId,
                                    progress: progress,
                                    currentMessage: index + 1,
                                    totalMessages: messages.length,
                                    currentTimestamp: message.timestamp,
                                    messageDetails: {
                                        chatname: message.chatname,
                                        chatmessage: message.chatmessage
                                    }
                                }).catch(() => {
                                    // Ignore errors if no listeners
                                });
                                
                                // Clean up if this was the last message
                                if (index === messages.length - 1) {
                                    delete replaySessions[sessionId];
                                }
                            }
                        } else {
                            sendDataP2P(message);
                        }
                    }, scaledDelay);
                    
                    if (sessionId && replaySessions[sessionId]) {
                        replaySessions[sessionId].timeouts.push(timeoutId);
                    }
                });

                resolve({ messageCount: messages.length, messages: messages });
            }
        };
        
        cursorRequest.onerror = (event) => reject(event.target.error);
    });
}

// Replay session management
const replaySessions = {};

async function handleReplayMessages(request, sendResponse) {
    try {
        console.log('Starting replay with params:', {
            start: new Date(request.startTimestamp),
            end: request.endTimestamp ? new Date(request.endTimestamp) : 'none',
            speed: request.speed
        });
        
        // Make sure we have the database
        if (!messageStoreDB) {
            sendResponse({ error: 'Database not initialized' });
            return;
        }
        
        const result = await replayMessagesFromTimestamp(
            request.startTimestamp,
            request.endTimestamp || null,
            request.speed || 1,
            request.sessionId
        );
        
        console.log('Replay started successfully:', result);
        sendResponse(result);
    } catch (error) {
        console.error('Error in handleReplayMessages:', error);
        sendResponse({ error: error.message || 'Unknown error occurred' });
    }
}

function pauseReplay(sessionId) {
    if (replaySessions[sessionId]) {
        replaySessions[sessionId].isPaused = true;
    }
}

function resumeReplay(sessionId) {
    if (replaySessions[sessionId]) {
        replaySessions[sessionId].isPaused = false;
    }
}

function stopReplay(sessionId) {
    if (replaySessions[sessionId]) {
        // Clear all pending timeouts
        replaySessions[sessionId].timeouts.forEach(timeoutId => clearTimeout(timeoutId));
        delete replaySessions[sessionId];
    }
}

function updateReplaySpeed(sessionId, newSpeed) {
    if (replaySessions[sessionId]) {
        // This would require re-calculating timeouts, which is complex
        // For now, just update the speed for future reference
        replaySessions[sessionId].speed = newSpeed;
    }
}


function unescapeHtml(safe) {
	return safe
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'");
}

function escapeHtml(unsafe) {
	try {
		return unsafe.replace(/[&<>"']/g, function(m) {
			return {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#039;'
			}[m];
		}) || "";
	} catch (e) {
		return "";
	}
}

function sendToH2R(data) {
    if (settings.h2r && settings.h2rserver && settings.h2rserver.textsetting) {
        try {
            var postServer = "http://127.0.0.1:4001/data/";
            if (settings.h2rserver.textsetting.startsWith("http")) {
                // full URL provided
                postServer = settings.h2rserver.textsetting;
            } else if (settings.h2rserver.textsetting.startsWith("127.0.0.1")) {
                // missing the HTTP, so assume what they mean
                postServer = "http://" + settings.h2rserver.textsetting;
            } else {
                postServer += settings.h2rserver.textsetting; // Just going to assume they gave the token
            }
            var msg = {};
            if ("id" in data) {
                msg.id = data.id;
            }
            if (data.timestamp) {
                msg.timestamp = data.timestamp;
            }
            if (!data.textonly) {
                data.chatmessage = unescapeHtml(data.chatmessage);
            }
            msg.snippet = {};
            msg.snippet.displayMessage = sanitizeRelay(data.chatmessage, data.textonly) || "";
            if (!msg.snippet.displayMessage) {
                return;
            }
            msg.authorDetails = {};
            msg.authorDetails.displayName = data.chatname || "";
            if (data.type && (data.type == "twitch") && !data.chatimg && data.chatname) {
                msg.authorDetails.profileImageUrl = "https://api.socialstream.ninja/twitch/large?username=" + encodeURIComponent(data.chatname); // 150x150
            } else if (data.type && ((data.type == "youtube") || (data.type == "youtubeshorts")) && data.chatimg) {
                let chatimg = data.chatimg.replace("=s32-", "=s256-");
                msg.authorDetails.profileImageUrl = chatimg.replace("=s64-", "=s256-");
            } else {
                msg.authorDetails.profileImageUrl = data.chatimg || "https://socialstream.ninja/sources/images/unknown.png";
            }
            if (data.type && data.sourceImg && data.type == "restream") {
                msg.platform = {};
                msg.platform.name = data.type || "";
                if (data.sourceImg === "restream.png") {
                    msg.platform.logoUrl = "https://socialstream.ninja/sources/images/" + data.sourceImg;
                } else {
                    msg.platform.logoUrl = data.sourceImg;
                }
            } else if (data.type) {
                msg.platform = {};
                msg.platform.name = data.type || "";
                msg.platform.logoUrl = "https://socialstream.ninja/sources/images/" + data.type + ".png";
            }
            var h2r = {};
            h2r.messages = [];
            h2r.messages.push(msg);
            ajax(h2r, postServer, "POST");
        } catch (e) {
            console.warn(e);
        }
    }
}
function sanitizeRelay(text, textonly=false, alt = false) {
    if (!text || !text.trim()) {
        return alt || text;
    }
    
    // Extract all emojis from image alt attributes before stripping HTML
    const emojiMap = new Map();
    if (!textonly) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        
        // Collect all image elements with alt text that appears to be an emoji
        const imgElements = tempDiv.querySelectorAll('img');
        imgElements.forEach((img, index) => {
            const altText = img.getAttribute('alt');
            if (altText && isEmoji(altText)) {
                const placeholder = `__EMOJI_PLACEHOLDER_${index}__`;
                emojiMap.set(placeholder, altText);
                img.outerHTML = placeholder;
            }
        });
        
        // Get the potentially modified HTML
        text = tempDiv.innerHTML;
        
        // Convert to text from html
        var textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        text = textArea.value;
    }
    
    // Strip HTML and other unwanted characters
    text = text.replace(/(<([^>]+)>)/gi, "");
    text = text.replace(/[!#@]/g, "");
    text = text.replace(/cheer\d+/gi, " ");
    text = text.replace(/\.(?=\S(?!$))/g, " ");
    
    // Replace all emoji placeholders with their actual emojis
    emojiMap.forEach((emoji, placeholder) => {
        text = text.replace(placeholder, emoji);
    });
    
    if (!text.trim() && alt) {
        return alt;
    }
    return text.trim();
}

// Add the isEmoji function from your original code
function isEmoji(char) {
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
    return emojiRegex.test(char);
}

const messageStore = {};
function checkExactDuplicateAlreadyRelayed(msg, sanitized=true, tabid=false, save=true) { // FOR RELAY PURPOSES ONLY.

	const now = Date.now();
	if (!save){
		if (now - lastSentTimestamp > 10000) { // 10 seconds has passed; assume good.
			return false;
		}
	}
	
	if (!sanitized){
		var textArea = document.createElement('textarea');
		textArea.innerHTML = msg;
		msg = textArea.value.replace(/\s\s+/g, " ").trim();
	} else {
		msg = msg.replace(/<\/?[^>]+(>|$)/g, ""); // clean up; remove HTML tags, etc.
		msg = msg.replace(/\s\s+/g, " ").trim();
	}
	
	if (save){
		return msg;
	}
	
	if (!msg || !tabid) {
		return false;
	}
	
	if (!messageStore[tabid]){
		return false;
	}
	
    while (messageStore[tabid].length > 0 && now - messageStore[tabid][0].timestamp > 10000) {
        messageStore[tabid].shift();
    }
	
	return messageStore[tabid].some(entry => entry.message === msg && entry.relayMode);
}

// settings.firstsourceonly || settings.hideallreplies


var alreadyCaptured = [];
function checkExactDuplicateAlreadyReceived(msg, sanitized=true, tabid=false, type=null) { // FOR RELAY PURPOSES ONLY.

	if (!msg){
		return false;
	}
	
	const now = Date.now();
	if (now - lastSentTimestamp > 10000) {// 10 seconds has passed; assume good.
		return false;
	}

	if (!sanitized){
		var textArea = document.createElement('textarea');
		textArea.innerHTML = msg;
		msg = textArea.value.replace(/\s\s+/g, " ").trim();
	} else {
		msg = msg.replace(/<\/?[^>]+(>|$)/g, ""); // clean up; remove HTML tags, etc.
		msg = msg.replace(/\s\s+/g, " ").trim();
	}
	
	if (!msg || !tabid) {
		return false;
	}
	
	if (!messageStore[tabid]){
		return false;
	}
	
	if (settings.thissourceonly && !settings.hideallreplies){
		for (var mm in alreadyCaptured){
			if (now - alreadyCaptured[mm] > 10000){
				delete alreadyCaptured[mm];
			}
		}
		while (messageStore[tabid].length > 0 && (now - messageStore[tabid][0].timestamp > 10000)) {
			messageStore[tabid].shift();
		}
		if (messageStore[tabid].some(entry => entry.message === msg)){
			if (alreadyCaptured[msg]){
				return true;
			} else if (type && (settings.thissourceonlytype && type === (settings.thissourceonlytype.optionsetting)) || (!settings.thissourceonlytype && type === "twitch")){ // twitch is the default
				alreadyCaptured[msg] = now;
				return null;
			} else {
				return true;
			}
		} else {
			return false;
		}
	} else if (settings.firstsourceonly && !settings.hideallreplies){
		for (var mm in alreadyCaptured){
			if (now - alreadyCaptured[mm] > 10000){
				delete alreadyCaptured[mm];
			}
		}
		while (messageStore[tabid].length > 0 && (now - messageStore[tabid][0].timestamp > 10000)) {
			messageStore[tabid].shift();
		}
		if (messageStore[tabid].some(entry => entry.message === msg)){
			if (alreadyCaptured[msg]){
				return true;
			}
			alreadyCaptured[msg] = now;
			return null; // null !== false
		} else {
			return false;
		}
	}
	
    while (messageStore[tabid].length > 0 && now - messageStore[tabid][0].timestamp > 10000) {
        messageStore[tabid].shift();
    }
	return messageStore[tabid].some(entry => entry.message === msg);
}

function sendToS10(data, fakechat=false, relayed=false) {
	//console.log"sendToS10",data);
	if (settings.s10 && settings.s10apikey && settings.s10apikey.textsetting) {
		try {
			// msg =  '{
				// "userId": "my-external-id",
				// "displayName": "Tyler",
				// "messageBody": "Testing 123",
				// "sourceName": "twitch",
				// "sourceIconUrl": "https://cdn.shopify.com/app-store/listing_images/715abff73d9178aa7f665d7feadf7edf/icon/CPTw1Y2Mp4UDEAE=.png"
			// }';
			
			if (data.type && data.type === "stageten") {
				return;
			}
			
			const checkMessage = data.textContent || data.chatmessage;
			if (checkMessage.includes(miscTranslations.said)){
				return null;
			}

			let cleaned = data.chatmessage;
			if (data.textonly){
				cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, ""); // keep a cleaned copy
				cleaned = cleaned.replace(/\s\s+/g, " "); 
			} else {
				cleaned = decodeAndCleanHtml(cleaned);
			}
			if (!cleaned){
				return;
			}
			
			// Store the cleaned text content for reuse elsewhere
			data.textContent = cleaned;
			
			if (relayed && !verifyOriginalNewIncomingMessage(cleaned, true)){
				if (data.bot) {
					return null;
				}
				////console.log".");
				// checkExactDuplicateAlreadyRelayed(msg, sanitized=true, tabid=false, save=true) 
				if (checkExactDuplicateAlreadyRelayed(cleaned, data.textonly, data.tid, false)){
					////console.log"--");
					return;
				}
			} else if (!fakechat && checkExactDuplicateAlreadyRelayed(cleaned, data.textonly, data.tid, false)){
				return null;
			}
			
			if (fakechat){
				lastSentMessage = cleaned; 
				lastSentTimestamp = Date.now();
				lastMessageCounter = 0;
			}
			
			let botname = "🤖💬";
			if (settings.ollamabotname && settings.ollamabotname.textsetting){
				botname = settings.ollamabotname.textsetting.trim();
			}
			
			let username = "";
			let isBot = false;
			if (!settings.noollamabotname && cleaned.startsWith(botname+":")){
				cleaned = cleaned.replace(botname+":","").trim();
				username = botname;
				isBot = true;
			}
			
			var msg = {};
			msg.sourceName = data.type || "stageten";
			msg.sourceIconUrl = "https://socialstream.ninja/sources/images/"+msg.sourceName+".png";
			msg.displayName = username || data.chatname || data.userid || "Host⚡";
			msg.userId = "socialstream";
			msg.messageBody = cleaned;
			
			if (isBot){
				msg.sourceIconUrl = "https://socialstream.ninja/icons/bot.png";
			}
			
			if (false){ // this is a backup, just in case.
				if (data.type == "stageten"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/stageten_200x200.png";
				}
				if (data.type == "youtube"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/youtube_200x200.png";
				}
				if (data.type == "youtubeshorts"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/youtubeshorts_200x200.png";
				}
				if (data.type == "twitch"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/twitch_200x200.png";
				}
				if (data.type == "twitch"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/twitch_200x200.png";
				}
				if (data.type == "socialstream"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/socialstream_200x200.png";
				}
				if (data.type == "twitch"){
					msg.sourceIconUrl = "https://cdn.shopify.com/s/files/1/0463/6753/9356/files/twitch_200x200.png";
				}
			}
			
			// console.error(msg, fakechat);
			try {
				let xhr = new XMLHttpRequest();
				xhr.open("POST", "https://demo.stageten.tv/apis/plugin-service/chat/message/send");
				xhr.setRequestHeader("content-type", "application/json");
				xhr.setRequestHeader("x-s10-chat-api-key", settings.s10apikey.textsetting);
				//xhr.withCredentials = true;
				xhr.onload = function () {
					//log(xhr.response);
				};
				xhr.onerror = function (e) {
					//log("error sending to stageten");
				};
				xhr.send(JSON.stringify(msg));
			} catch(e){}
			
			try {
				let xhr2 = new XMLHttpRequest();
				xhr2.open("POST", "https://app.stageten.tv/apis/plugin-service/chat/message/send");
				xhr2.setRequestHeader("content-type", "application/json");
				xhr2.setRequestHeader("x-s10-chat-api-key", settings.s10apikey.textsetting);
				xhr2.onload = function () {
					//log(xhr2.response);
				};
				xhr2.onerror = function (e) {
					//log("error sending to stageten");
				};
				xhr2.send(JSON.stringify(msg));
			} catch(e){}
			
		} catch (e) {
			console.warn(e);
		}
	}
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
let streamerbotClient = null;
class StreamerbotWebsocketClient {
  constructor(options = {}) {
    // Configuration
    this.url = options.url || 'ws://127.0.0.1:8080';
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.debug = options.debug || false;
    
    // State
    this.socket = null;
    this.enabled = false;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.messageQueue = [];
    this.isAuthenticated = false;
    this.subscribedEvents = new Set();
    this.sessionId = null;
    
    // Auth
    this.password = options.password || '';
    
    // Callbacks
    this.onConnected = options.onConnected || (() => {});
    this.onDisconnected = options.onDisconnected || (() => {});
    this.onError = options.onError || (() => {});
    this.onMessage = options.onMessage || (() => {});
    this.onReconnecting = options.onReconnecting || (() => {});
    this.onAuthenticated = options.onAuthenticated || (() => {});
    this.onAuthFailed = options.onAuthFailed || (() => {});
  }

  log(...args) {
    if (this.debug) {
      console.log('[StreamerbotWS]', ...args);
    }
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      this.log('Already connected or connecting');
      return;
    }

    this.enabled = true;
    this.reconnectAttempts = 0;
    this._connect();
  }

  _connect() {
    try {
      this.log(`Connecting to ${this.url}...`);
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = this._handleOpen.bind(this);
      this.socket.onclose = this._handleClose.bind(this);
      this.socket.onerror = this._handleError.bind(this);
      this.socket.onmessage = this._handleMessage.bind(this);
    } catch (error) {
      this.log('Connection error:', error);
      this._scheduleReconnect();
    }
  }

  disconnect() {
    this.enabled = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.log('Disconnecting...');
      try {
        this.socket.close(1000, 'Disconnect requested');
      } catch (error) {
        this.log('Error during disconnect:', error);
      }
      this.socket = null;
      this.isAuthenticated = false;
      this.sessionId = null;
    }
  }

  _handleOpen() {
    this.log('Connected to Streamer.bot WebSocket');
    this.reconnectAttempts = 0;
    this.onConnected();
  }

 async _handleMessage(event) {
  try {
    const data = JSON.parse(event.data);
    this.log('Received message:', data);
    
    // Handle initial handshake with challenge-based authentication
    if (data.request === "Hello") {
      this.sessionId = data.session;
      
      if (data.authentication) {
        // Modern Streamer.bot uses challenge-based auth
        this.log('Authentication required with challenge.');
        
        // First try to handle auth-free mode 
        const getInfoPayload = {
          request: 'GetInfo',
          id: 'info-' + Date.now()
        };
        
        this.log('Checking if authentication is required...');
        this.socket.send(JSON.stringify(getInfoPayload));
        return;
      } else {
        // No authentication required
        this.isAuthenticated = true;
        this.onAuthenticated();
        this._processQueue();
        this._subscribeToEvents();
      }
      return;
    }
    
    // Handle GetInfo response
    if (data.id && data.id.startsWith('info-')) {
      if (data.status === "ok") {
        this.log('No authentication required');
        this.isAuthenticated = true;
        this.onAuthenticated();
        this._processQueue();
        this._subscribeToEvents();
      } else {
        // Auth is required, handle it properly
        this.log('Authentication required, attempting...');
        
        // Simple password auth (no challenge)
        const authPayload = {
          request: 'Authenticate',
          id: 'auth-' + Date.now(),
          authentication: this.password
        };
        
        this.log('Sending password auth');
        this.socket.send(JSON.stringify(authPayload));
      }
      return;
    }
    
    // Handle authentication response
    if (data.id && data.id.startsWith('auth-')) {
      if (data.status === "ok" || (data.status && data.status.code === 200)) {
        this.log('Authentication successful');
        this.isAuthenticated = true;
        this.onAuthenticated();
        this._processQueue();
        this._subscribeToEvents();
      } else {
        this.log('Authentication failed:', data);
        this.isAuthenticated = false;
        this.onAuthFailed(data);
      }
      return;
    }
    
    // Process regular messages
    this.onMessage(data);
  } catch (error) {
    this.log('Error processing message:', error, event.data);
  }
}

  _handleClose(event) {
    this.isAuthenticated = false;
    this.sessionId = null;
    this.log(`WebSocket closed: ${event.code} ${event.reason}`);
    this.onDisconnected(event);
    
    if (this.enabled && this.autoReconnect) {
      this._scheduleReconnect();
    }
  }

  _handleError(error) {
    this.log('WebSocket error:', error);
    this.onError(error);
  }

  _scheduleReconnect() {
    if (!this.enabled || !this.autoReconnect) return;
    
    this.reconnectAttempts++;
    
    if (this.maxReconnectAttempts > 0 && this.reconnectAttempts > this.maxReconnectAttempts) {
      this.log(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached, giving up`);
      return;
    }
    
    const delay = this.reconnectInterval;
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.onReconnecting(this.reconnectAttempts);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this._connect();
    }, delay);
  }

  _processQueue() {
    if (!this.isAuthenticated || this.messageQueue.length === 0) return;
    
    this.log(`Processing queued messages (${this.messageQueue.length})`);
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this._sendMessage(message);
    }
  }

  _sendMessage(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.log('Socket not open, queueing message');
      this.messageQueue.push(message);
      
      if (this.enabled && (!this.socket || this.socket.readyState !== WebSocket.CONNECTING)) {
        this._connect();
      }
      return false;
    }
    
    if (!this.isAuthenticated && message.request !== "GetInfo" && message.request !== "Authenticate") {
      this.log('Not authenticated, queueing message');
      this.messageQueue.push(message);
      return false;
    }
    
    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      this.log('Sending message:', message);
      this.socket.send(payload);
      return true;
    } catch (error) {
      this.log('Error sending message:', error);
      return false;
    }
  }
  
 _subscribeToEvents() {
  if (this.subscribedEvents.size === 0) return;
  
  const eventsArray = Array.from(this.subscribedEvents);
  this.log('Subscribing to events:', eventsArray);
  
  // Build the correct events format
  const eventsByCategory = {};
  
  for (const event of eventsArray) {
    const [category, type] = event.includes('.') ? event.split('.', 2) : ['Raw', event];
    
    if (!eventsByCategory[category]) {
      eventsByCategory[category] = [];
    }
    
    eventsByCategory[category].push(type);
  }
  
  this.log('Events by category:', eventsByCategory);
  
  // Send subscription request
  const subscribePayload = {
    request: 'Subscribe',
    id: 'subscribe-' + Date.now(),
    events: eventsByCategory
  };
  
  this._sendMessage(subscribePayload);
}
  // Public API methods remain the same
  subscribe(events) {
    const eventList = Array.isArray(events) ? events : [events];
    let newEvents = false;
    
    for (const event of eventList) {
      if (!this.subscribedEvents.has(event)) {
        this.subscribedEvents.add(event);
        newEvents = true;
      }
    }
    
    if (newEvents && this.isAuthenticated && this.socket?.readyState === WebSocket.OPEN) {
      this._subscribeToEvents();
    }
  }
  
  unsubscribe(events) {
    const eventList = Array.isArray(events) ? events : [events];
    
    for (const event of eventList) {
      this.subscribedEvents.delete(event);
    }
    
    if (this.isAuthenticated && this.socket?.readyState === WebSocket.OPEN) {
      // Convert to object format with categories
      const eventsByCategory = {};
      
      for (const event of eventList) {
        const [category, type] = event.includes('.') ? event.split('.', 2) : ['Raw', event];
        
        if (!eventsByCategory[category]) {
          eventsByCategory[category] = [];
        }
        
        if (type) {
          eventsByCategory[category].push(type);
        }
      }
      
      const unsubscribePayload = {
        request: 'Unsubscribe',
        id: 'unsubscribe-' + Date.now(),
        events: eventsByCategory
      };
      
      this._sendMessage(unsubscribePayload);
    }
  }
sendChatMessage(chatData, fakechat = false, relayed = false) {
  if (!chatData) return false;
  
  try {
    // Make sure we have a valid message
    let message = chatData.chatmessage;
    if (!message) return false;
    
    // Clean message if needed
    if (chatData.textonly) {
      message = message.replace(/<\/?[^>]+(>|$)/g, "");
      message = message.replace(/\s\s+/g, " ");
    } else if (typeof message === 'string') {
      message = message.replace(/<[^>]*>/g, "");
    }
    
    // Format platform prefix if needed
    if (chatData.type && chatData.type !== "Chat") {
      message = `[${chatData.type}] ${message}`;
    }
    
    // Create the proper chat message payload format for Streamer.bot
    const payload = {
      request: "ChatMessage",
      id: "chat-" + Date.now(),
      data: {
        message: message,
        userName: chatData.chatname || chatData.userid || "SocialStream",
        userId: chatData.userid || chatData.chatname || "socialstream",
        // It appears "Chat" works as a valid platform when testing
        platform: "Chat",
        color: chatData.nameColor || "#FFFFFF",
        badges: chatData.chatbadges ? [chatData.chatbadges] : [],
        avatar: chatData.chatimg || null,
        isBot: chatData.isBot || false,
        isAction: false
      }
    };
    
    return this._sendMessage(payload);
  } catch (error) {
    this.log('Error sending to chat system:', error);
    return false;
  }
}
  
 sendToChatSystem(chatData) {
  if (!chatData) return false;
  
  try {
    // Use "Chat" as a platform that Streamer.bot definitely supports
    const payload = {
      request: "ChatMessage",
      id: "chat-system-" + Date.now(),
      data: {
        message: chatData.chatmessage,
        userName: chatData.chatname || "Viewer",
        userId: chatData.userid || chatData.chatname || "unknown",
        platforms: ["Chat"], // Use "Chat" as the platform for better compatibility
        color: chatData.nameColor || "#FFFFFF",
        badges: chatData.chatbadges ? [chatData.chatbadges] : [],
        avatar: chatData.chatimg || null,
        isBot: chatData.isBot || false,
        isAction: false,
        source: "SocialStream.Ninja"
      }
    };
    
    // If you want to show the original platform, add it to the message
    if (chatData.type && chatData.type !== "Chat") {
      payload.data.message = `[${chatData.type}] ${payload.data.message}`;
    }
    
    return this._sendMessage(payload);
  } catch (error) {
    this.log('Error sending to chat system:', error);
    return false;
  }
}
  
  doAction(actionId, args = {}) {
    // Method remains the same
    if (!actionId) {
      this.log('No action ID provided');
      return false;
    }
    
    const payload = {
      request: "DoAction",
      id: "action-" + Date.now(),
      action: {
        id: actionId
      },
      args: args
    };
    
    return this._sendMessage(payload);
  }
  
  getActions() {
    // Method remains the same
    return new Promise((resolve, reject) => {
      const id = "get-actions-" + Date.now();
      
      const handler = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id === id) {
            this.socket.removeEventListener('message', handler);
            
            if (data.status && data.status.code === 200) {
              resolve(data.actions || []);
            } else {
              reject(new Error(`Failed to get actions: ${data.status?.description || 'Unknown error'}`));
            }
          }
        } catch (error) {
          // Ignore other messages
        }
      };
      
      this.socket.addEventListener('message', handler);
      
      const payload = {
        request: "GetActions",
        id: id
      };
      
      const sent = this._sendMessage(payload);
      if (!sent) {
        this.socket.removeEventListener('message', handler);
        reject(new Error('Failed to send GetActions request'));
      }
    });
  }
}


function sendToStreamerBot(data, fakechat = false, relayed = false) {
  // Initialize if needed
  if (!streamerbotClient && settings.streamerbot) {
    initializeStreamerbot();
  }

  // If not initialized or disabled, exit
  if (!streamerbotClient || !streamerbotClient.enabled || !streamerbotClient.isAuthenticated) {
    // Added checks for enabled and authenticated state
    if (settings.streamerbot) {
         console.log("Streamer.bot client not ready (enabled:", streamerbotClient?.enabled, "authenticated:", streamerbotClient?.isAuthenticated, "), queuing or skipping message.");
         // You might want to queue messages here if the client is expected to connect soon
    }
    return;
  }

  try {
    // Skip streamerbot messages to avoid loops
    if (data.type && data.type === "streamerbot") {
      return;
    }

    // Skip messages that contain certain translations or empty messages
    const checkMessage = data.textContent || data.chatmessage;
    if (!data.chatmessage ||
        (checkMessage.includes && checkMessage.includes(miscTranslations.said))) {
      return null;
    }

    // Clean the message
    let cleaned = data.chatmessage;
    if (data.textonly) {
      cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, "");
      cleaned = cleaned.replace(/\s\s+/g, " ");
    } else if (typeof cleaned === 'string') {
      cleaned = decodeAndCleanHtml(cleaned); // Assuming decodeAndCleanHtml is defined elsewhere
    }

    if (!cleaned) {
      return;
    }
    
    // Store the cleaned text content for reuse elsewhere
    data.textContent = cleaned;

    // Duplicate message handling logic (assuming functions are defined elsewhere)
    if (relayed && typeof verifyOriginalNewIncomingMessage === 'function' && !verifyOriginalNewIncomingMessage(cleaned, true)) {
       if (data.bot) {
         return null;
       }
       if (typeof checkExactDuplicateAlreadyRelayed === 'function' && checkExactDuplicateAlreadyRelayed(cleaned, data.textonly, data.tid, false)) {
         return;
       }
    } else if (!fakechat && typeof checkExactDuplicateAlreadyRelayed === 'function' && checkExactDuplicateAlreadyRelayed(cleaned, data.textonly, data.tid, false)) {
       return null;
    }

    // Bot handling
    let botname = "🤖💬";
    if (settings.ollamabotname && settings.ollamabotname.textsetting) {
      botname = settings.ollamabotname.textsetting.trim();
    }

    let username = "";
    let isBot = false;
    // Make sure cleaned is a string before calling startsWith
    if (typeof cleaned === 'string' && !settings.noollamabotname && cleaned.startsWith(botname + ":")) {
        cleaned = cleaned.replace(botname + ":", "").trim();
        username = botname;
        isBot = true;
    }

    // Prepare the data payload to be sent
    // It's good practice to create a new object to avoid modifying the original `data` object directly
    // unless intended.
    const payloadData = {
        ...data, // Copy original data
        chatname: username || data.chatname || data.userid || "Host⚡",
        isBot: isBot,
        chatmessage: cleaned,
        // Add any other relevant info Streamer.bot action might need
        source: "SocialStream.Ninja", // Explicitly add source
        originalPlatform: data.type || "unknown" // Preserve original platform info
    };


    console.log(`Sending message event to Streamer.bot: ${payloadData.chatmessage} (from ${payloadData.chatname})`);

    // --- CORE CHANGE HERE ---
    // Always use the DoAction method if an Action ID is provided.
    if (settings?.streamerbotactionid?.textsetting) {
      const actionId = settings.streamerbotactionid.textsetting;
      console.log(`Triggering Streamer.bot Action ID: ${actionId}`);

      // Pass the prepared chat data as an argument named 'chatData' to the action
      const args = {
          chatData: payloadData
      };

      return streamerbotClient.doAction(actionId, args);

    } else {
       // If no Action ID is set, log a warning and do nothing.
       // Direct chat injection via 'ChatMessage' request is unreliable.
       console.warn("Streamer.bot Action ID is not set in SocialStream.Ninja settings. Cannot process message in Streamer.bot.");
       // Optional: You could attempt the ChatMessage request here, but include a warning that it likely won't work as expected.
       // console.log("Attempting direct ChatMessage injection (experimental, may not display in SB chat):", payloadData);
       // return streamerbotClient.sendToChatSystem(payloadData); // This is the function that sends `request: "ChatMessage"`
       return false; // Indicate message wasn't processed via Action
    }
  } catch (e) {
    console.warn("Error in sendToStreamerBot:", e);
    return false;
  }
}

function initializeStreamerbot() {
  // Only initialize if settings are configured
  if (!settings.streamerbot) {
    return;
  }
  
  // Close any existing connection
  if (streamerbotClient) {
    streamerbotClient.disconnect();
  }
  
  // Get configuration from settings
  const wsUrl = settings?.streamerbotendpoint?.textsetting || 'ws://127.0.0.1:8080';
  const password = settings?.streamerbotpassword?.textsetting || '';
  
  console.log(`Initializing Streamer.bot with URL: ${wsUrl} (password ${password ? 'provided' : 'not provided'})`);
  
  // Create new client with debug enabled during troubleshooting
  streamerbotClient = new StreamerbotWebsocketClient({
    url: wsUrl,
    password: password,
    debug: true, // Enable debug logging while troubleshooting
    autoReconnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 3, // Limit reconnect attempts to prevent excessive logging
    
    onConnected: () => {
      console.log("Connected to Streamer.bot");
    },
    onDisconnected: (event) => {
      console.log(`Disconnected from Streamer.bot: ${event?.code} ${event?.reason}`);
    },
    onAuthenticated: () => {
      console.log("Authenticated with Streamer.bot");
      
      // Subscribe to events after successful authentication
      streamerbotClient.subscribe([
        'Twitch.ChatMessage',
        'YouTube.ChatMessage',
        'Raw'
      ]);
    },
    onAuthFailed: (data) => {
      console.warn("Authentication with Streamer.bot failed:", data);
    },
    onMessage: (data) => {
      console.log("Received message from Streamer.bot:", data);
    }
  });
  
  // Connect to the WebSocket server
  streamerbotClient.connect();
  
  return streamerbotClient;
}


function handleStreamerBotSettingsChange() {
  console.log("Streamer.bot settings changed:", {
    enabled: settings.streamerbot,
    endpoint: settings?.streamerbotendpoint?.textsetting,
    password: settings?.streamerbotpassword?.textsetting ? '(password set)' : '(no password)',
    actionID: settings?.streamerbotactionid?.textsetting
  });
  
  if (settings.streamerbot) {
    initializeStreamerbot();
  } else if (streamerbotClient) {
    streamerbotClient.disconnect();
    streamerbotClient = null;
  }
}

function sendAllToDiscord(data) {
	
    if (!settings.postalldiscord || !settings.postallserverdiscord) {
        return;
    }
	if (!data.chatmessage){
		return;
	}

    try {
        let postServerDiscord = normalizeWebhookUrl(settings.postallserverdiscord.textsetting);
        
        const avatarUrl = validateImageUrl(data.chatimg);
        
        const payload = {
            username: (data.chatname || "Unknown") + " @ "+capitalizeFirstLetter(data.type), // Custom webhook name
            avatar_url: avatarUrl || "https://socialstream.ninja/sources/images/unknown.png", 
            embeds: [{
                description: decodeAndCleanHtml(data.chatmessage||""),
                color: 0xFFFFFF, // Green color for donations
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: data.type ? `https://socialstream.ninja/sources/images/${data.type}.png` : null
                },
                fields: []
            }]
        };
        fetch(postServerDiscord, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        }).catch(error => console.warn('Discord webhook error:', error));

    } catch (e) {
        console.warn('Error sending Discord webhook:', e);
    }
}
function sendToDiscord(data) {
	
	sendAllToDiscord(data); // << generic
	//.. donations only .. vv
	
    if (!settings.postdiscord || !settings.postserverdiscord) {
        return;
    }
	if (!data.hasDonation && !data.donation){
		return;
	}
	console.log(data);
    try {
        let postServerDiscord = normalizeWebhookUrl(settings.postserverdiscord.textsetting);
        
        const avatarUrl = validateImageUrl(data.chatimg);
        
        const payload = {
            username: "Donation Alert", // Custom webhook name
            avatar_url: "https://socialstream.ninja/icons/bot.png", 
            embeds: [{
                title: formatTitle(data),
                description: formatDescription(data),
                color: 0x00ff00, // Green color for donations
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: data.type ? `https://socialstream.ninja/sources/images/${data.type}.png` : null
                },
                author: {
                    name: data.chatname,
                    icon_url: avatarUrl || undefined
                },
                fields: buildFields(data)
            }]
        };
        fetch(postServerDiscord, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        }).catch(error => console.warn('Discord webhook error:', error));

    } catch (e) {
        console.warn('Error sending Discord webhook:', e);
    }
}
function normalizeWebhookUrl(url) {
    if (!url) return null;
    
    if (url.startsWith("http")) {
        return url;
    } else if (url.startsWith("127.0.0.1")) {
        return "http://" + url;
    }
    return "https://" + url;
}

function validateImageUrl(url) {
    if (!url) return null;
    
    // Reject data URLs
    if (url.startsWith('data:')) return null;
    
    // Allowed image domains
    const allowedDomains = [
        // Original domains
        'cdn.discordapp.com',
        'i.imgur.com',
        'socialstream.ninja',
        'static-cdn.jtvnw.net', // Twitch CDN
        
        // YouTube domains
        'yt3.ggpht.com',        // YouTube profile pictures
        'i.ytimg.com',          // YouTube thumbnails
        'img.youtube.com',
        
        // Facebook domains
        'scontent.xx.fbcdn.net',    // Facebook CDN
        'platform-lookaside.fbsbx.com',
        'graph.facebook.com',
        
        // Google domains
        'lh3.googleusercontent.com', // Google user content (including profile pictures)
        'storage.googleapis.com',
		
		// socialstream
		'socialstream.ninja',
        
        // Kick domains
        'files.kick.com',
        'images.kick.com',
        'stream.kick.com'
    ];
    
    try {
        const urlObj = new URL(url);
        if (allowedDomains.some(domain => urlObj.hostname.endsWith(domain))) {
            return url;
        }
    } catch (e) {
        return null;
    }
    
    return null;
}
function formatTitle(data, type="donation") {
    if (data.title) {
        return data.title;
    }
    return `New ${type} from ${(data.type.charAt(0).toUpperCase() + data.type.slice(1)) || 'unknown'}!`;
}
function formatDescription(data) {
    let description = '';
    
    if (data.chatmessage) { 
        if (!data.textonly) {
            // Convert HTML to plain text
            description += `>>> ${decodeAndCleanHtml(data.chatmessage)}\n\n`;
        } else {
            description += `>>> ${data.chatmessage.trim()}\n\n`;
        }
    }
    
    return description || undefined;
}

function buildFields(data) {
    const fields = [];
    
    if (data.hasDonation || data.donation) {
        fields.push({
            name: '💰 Donation Amount',
            value: data.hasDonation || data.donation,
            inline: true
        });
    }
    
    if (data.membership) {
        fields.push({
            name: '🌟 Membership',
            value: data.membership,
            inline: true
        });
    }
    
    if (data.subtitle) {
        fields.push({
            name: '📝 Details',
            value: data.subtitle,
            inline: true
        });
    }
    
    return fields;
}

function sendToPost(data) {
	if (settings.post) {
		try {
			var postServer = "http://127.0.0.1:80";

			if (settings.postserver && settings.postserver.textsetting && settings.postserver.textsetting.startsWith("http")) {
				// full URL provided
				postServer = settings.postserver.textsetting;
			} else if (settings.postserver && settings.postserver.textsetting && settings.postserver.textsetting.startsWith("127.0.0.1")) {
				// missing the HTTP, so assume what they mean
				postServer = "http://" + settings.postserver.textsetting;
			} else if (settings.postserver && settings.postserver.textsetting && settings.postserver.textsetting){
				postServer = "https://"+settings.postserver.textsetting; // Just going to assume they meant https
			}

			if (data.type && !data.chatimg && (data.type == "twitch") && data.chatname) {
				data.chatimg = "https://api.socialstream.ninja/twitch/large?username=" + encodeURIComponent(data.chatname); // 150x150
			} else if (data.type && ((data.type == "youtube") || (data.type == "youtubeshorts")) && data.chatimg) {
				let chatimg = data.chatimg.replace("=s32-", "=s256-");
				data.chatimg = chatimg.replace("=s64-", "=s256-");
			} else {
				data.chatimg = data.chatimg || "https://socialstream.ninja/sources/images/unknown.png";
			}

			if (data.type) {
				data.logo = "https://socialstream.ninja/sources/images/" + data.type + ".png";
			}

			ajax(data, postServer, "POST");
		} catch (e) {
			console.warn(e);
		}
	}
}

var socketserverDock = false;
var serverURLDock = urlParams.has("localserver") ? "ws://127.0.0.1:3000" : "wss://io.socialstream.ninja/dock";
var conConDock = 0; 
var reconnectionTimeoutDock = null;

function setupSocketDock() {
	if (!settings.server2 && !settings.server3) {
		return;
	} else if (!isExtensionOn) {
		return;
	}
	
	if (reconnectionTimeoutDock) {
		clearTimeout(reconnectionTimeoutDock);
		reconnectionTimeoutDock = null;
	}

	if (socketserverDock) {
		socketserverDock.onclose = null;
		socketserverDock.close();
		socketserverDock = null;
	}

	socketserverDock = new WebSocket(serverURLDock);

	socketserverDock.onerror = function (error) {
		console.error("WebSocket error:", error);
		socketserverDock.close();
	};

	socketserverDock.onclose = function () {
		if ((settings.server2 || settings.server3) && isExtensionOn) {
			reconnectionTimeoutDock = setTimeout(function () {
				if ((settings.server2 || settings.server3) && isExtensionOn) {
					conConDock += 1;
					socketserverDock = new WebSocket(serverURLDock);
					setupSocketDock();
				} else {
					socketserverDock = false;
				}
			}, 100 * conConDock);
		} else {
			socketserverDock = false;
		}
	};
	socketserverDock.onopen = function () {
		conConDock = 0;
		socketserverDock.send(JSON.stringify({ join: streamID, out: 4, in: 3 }));
	};
	socketserverDock.addEventListener("message", async function (event) {
		if (event.data) {
			try {
				if (settings.server3 && isExtensionOn) {
					try {
						var data = JSON.parse(event.data);
						processIncomingRequest(data);
					} catch (e) {
						console.error(e);
					}
				}
			} catch (e) {
				log(e);
			}
		}
	});
}
//

var socketserver = false;
var serverURL = urlParams.has("localserver") ? "ws://127.0.0.1:3000" : "wss://io.socialstream.ninja/api";
var conCon = 0;
var reconnectionTimeout = null;

function setupSocket() {
	if (!settings.socketserver) {
		return;
	} else if (!isExtensionOn) {
		return;
	}
	
	if (reconnectionTimeout) {
		clearTimeout(reconnectionTimeout);
		reconnectionTimeout = null;
	}

	if (socketserver) {
		socketserver.onclose = null;
		socketserver.close();
		socketserver = null;
	}

	socketserver = new WebSocket(serverURL);

	socketserver.onerror = function (error) {
		console.error("WebSocket error:", error);
		socketserver.close();
	};

	socketserver.onclose = function () {
		if (settings.socketserver && isExtensionOn) {
			reconnectionTimeout = setTimeout(function () {
				if (settings.socketserver && isExtensionOn) {
					conCon += 1;
					setupSocket();
				} else {
					socketserver = false;
				}
			}, 100 * conCon);
		} else {
			socketserver = false;
		}
	};
	socketserver.onopen = function () {
		conCon = 0;
		socketserver.send(JSON.stringify({ join: streamID, out: 2, in: 1 }));
	};
	socketserver.addEventListener("message", async function (event) {
		if (event.data) {
			var resp = false;

			try {
				var data = JSON.parse(event.data);
			} catch (e) {
				console.error(e);
				return;
			}
			
			if (data.target && (data.target==='null')){
				data.target = "";
			}
			
			console.log(data.kofi);

			if (data.action && data.action === "sendChat" && data.value) {
				var msg = {};
				msg.response = data.value;
				if (data.target) {
					msg.destination = data.target;
				}
				resp = sendMessageToTabs(msg, false, null, false, false, false);
			} else if (data.action && data.action === "sendEncodedChat" && data.value) {
				var msg = {};
				msg.response = decodeURIComponent(data.value);
				if (data.target) {
					msg.destination = decodeURIComponent(data.target);
				}
				resp = sendMessageToTabs(msg, false, null, false, false, false);
			} else if (data.action && data.action === "blockUser" && data.value) {
				var msg = {};
				let source = data.target.trim().toLowerCase() || "*";
				let username = data.value.trim();
				resp = blockUser({chatname:username, type:source});
			} else if (!data.action && data?.extContent) {
				try {
					if (!data.extContent.type){
						resp  = ({ state: isExtensionOn, error: "Must include message type"});
					} else {
						var letsGo = await processIncomingMessage(data.extContent, false);
						if (letsGo && letsGo.id){
							resp  = ({ state: isExtensionOn, id: letsGo.id });
						} else{
							resp  = ({ state: isExtensionOn});
						}
					}
				} catch (e) {
					console.error(e);
					resp  = ({ state: isExtensionOn, error:"exception"});
				}
			} else if (data.action && data.action === "extContent" && data.value) {
				// flattened
				try {
					let msg = JSON.parse(data.value);
					msg = await applyBotActions(msg); // perform any immediate actions, including modifying the message before sending it out
					
					if (msg){
						try {
							msg = await window.eventFlowSystem.processMessage(msg); // perform any immediate actions
						} catch (e) {
							console.warn(e);
						}
						
						if (msg) {
							resp = await sendToDestinations(msg);
						}
					}
				} catch (e) {
					console.error(e);
				}
			} else if (data.action && data.action === "removefromwaitlist") {
				removeWaitlist(parseInt(data.value) || 0);
				resp = true;
			} else if (data.action && data.action === "highlightwaitlist") {
				highlightWaitlist(parseInt(data.value) || 0);
				resp = true;
			} else if (data.action && data.action === "resetwaitlist") {
				resetWaitlist();
				resp = true;
			} else if (data.action && data.action === "resetpoll") {
				sendTargetP2P({cmd:"resetpoll"},"poll");
				resp = true;
			} else if (data.action && data.action === "closepoll") {
				sendTargetP2P({cmd:"closepoll"},"poll");
				resp = true;
			} else if (data.action && data.action === "loadpoll") {
				// Load a saved poll preset by ID
				if (data.value && data.value.pollId) {
					loadPollPreset(data.value.pollId);
					resp = true;
				}
			} else if (data.action && data.action === "setpollsettings") {
				// Directly set poll settings via API
				if (data.value && typeof data.value === 'object') {
					updatePollSettings(data.value);
					resp = true;
				}
			} else if (data.action && data.action === "getpollpresets") {
				// Return list of saved poll presets
				getPollPresets(function(presets) {
					if (data.get && e.data.UUID) {
						var ret = {};
						ret.callback = {};
						ret.callback.get = data.get;
						ret.callback.result = presets;
						socketserver.send(JSON.stringify(ret));
					}
				});
				resp = true;
			} else if (data.action && data.action === "createpoll") {
				// Create a new poll with specific settings
				if (data.value && data.value.settings) {
					createNewPoll(data.value.settings);
					resp = true;
				}
			} else if (data.action && data.action === "stopentries") {
				toggleEntries(false);
				resp = true;
				//sendResponse({ state: isExtensionOn });
			} else if (data.action && data.action === "downloadwaitlist") {
				downloadWaitlist();
				resp = true;
			} else if (data.action && data.action === "selectwinner") {
				////console.logdata);
				if ("value" in data) {
					resp = selectRandomWaitlist(parseInt(data.value) || 1);
				} else {
					resp = selectRandomWaitlist();
				}
			} else if (data.action){
				try {
					if (data.target && (data.target.toLowerCase!=="null")){
						sendTargetP2P(data, data.target);
					} else {
						sendDataP2P(data);
					}
					resp = true;
				} catch (e) {
					console.error(e);
				}
			} else if ("stripe" in data) {
				try {
					if (data.stripe.type !== "checkout.session.completed") {
						return false;
					}
					
					console.log(data.stripe);

					var message = {};
					message.chatname = "";
					message.chatmessage = "";
					
					var foundCustomField = false;

					data.stripe.data.object.custom_fields.forEach(xx => {
						if (xx.key == "displayname") {
							message.chatname = xx.text.value;
							foundCustomField = true;
							
						} else if (typeof xx.key === 'string' && xx.key.toLowerCase() == "pseudo") {
							message.chatname = xx.text.value;
							foundCustomField = true;
							
						} else if (xx.key == "tonpseudo") {
							message.chatname = xx.text.value;
							foundCustomField = true;
							
						} else if (xx.key == "username") {
							message.chatname = xx.text.value;
							foundCustomField = true;
							
						} else if (xx.key == "message") {
							message.chatmessage = xx.text.value;
							
						} else if (xx.key == "messagetchat") {
							message.chatmessage = xx.text.value;
							
						} else if (!message.chatname && xx.label && typeof xx.label === 'string' && xx.label.toLowerCase() == "display name") {
							message.chatname = xx.text.value;
							foundCustomField = true;
							
						} else if (!message.chatname && xx.label && typeof xx.label === 'string' && xx.label.toLowerCase() == "name") {
							message.chatname = xx.text.value;
							foundCustomField = true;
							
						} else if (!message.chatmessage && xx.label && typeof xx.label === 'string' && xx.label.toLowerCase() == "message") {
							message.chatmessage = xx.text.value;
							
						} else if (!message.chatname && xx.label && typeof xx.label === 'string' && xx.label.toLowerCase() == "pseudo") {
							message.chatname = xx.text.value;
							foundCustomField = true;
							
						} else if (!message.chatname && xx.key && typeof xx.key === 'string' && xx.key.toLowerCase() == "name") {
							foundCustomField = true;
							if (xx.text && xx.text.value && typeof xx.text.value === 'string' ){
								message.chatname = xx.text.value;
							}
						}
					});
					
					if (!foundCustomField){
						console.warn("No custom name / custom display-name field found. We will skip this incoming stripe api webhook");
						return;
					}

					var currency = "";

					try {
						currency = data.stripe.data.object.currency.toLowerCase() || "";
					} catch (e) {
						console.error(e);
					}

					var symbol = {};
					if (currency && currency in Currencies) {
						symbol = Currencies[currency];
						if (symbol.d) {
							data.stripe.data.object.amount_total = parseFloat(data.stripe.data.object.amount_total) / Math.pow(10, parseInt(symbol.d));
						}
					}

					if (data.stripe.data.object.amount_total) {
						try {
							if (symbol.s && (data.stripe.data.object.currency.toUpperCase() == "EUR")){
								message.hasDonation = (symbol.s || "") + (data.stripe.data.object.amount_total || "");
							} else {
								message.hasDonation = (symbol.s || "") + (data.stripe.data.object.amount_total || "") + " " + (data.stripe.data.object.currency.toUpperCase() || "");
							}
							message.hasDonation = message.hasDonation.trim();
						} catch (e) {
							console.error(e);
						}
					}
					message.id = parseInt(Math.random() * 100000 + 1000000);
					message.chatbadges = "";
					message.backgroundColor = "";
					message.textColor = "";
					message.nameColor = "";
					message.chatimg = "";
					message.membership = "";
					message.contentimg = "";
					message.type = "stripe";

					data = message; // replace inbound stripe message with new message
					
					try {
						data = await applyBotActions(data); // perform any immediate actions, including modifying the message before sending it out
						
						if (data){
							try {
								data = await window.eventFlowSystem.processMessage(data); // perform any immediate actions
							} catch (e) {
								console.warn(e);
							}
							
							if (data) {
								resp = await sendToDestinations(data);
							}
						}
					} catch (e) {
						console.error(e);
					}
					
				} catch (e) {
					console.error(e);
					return;
				}
			} else if ("kofi" in data) {
				try {
					
					if (!data.kofi.data) {
						return false;
					}
					try {
						var kofi = JSON.parse(decodeURIComponent(data.kofi.data).replace(/\+/g, " "));
					} catch (e) {
						console.error(e);
						return;
					}

					if (kofi.type !== "Donation") {
						return false;
					} else if (!kofi.is_public) {
						return false;
					}

					var message = {};
					message.chatname = decodeURIComponent(kofi.from_name) || "Anonymous";
					message.chatmessage = decodeURIComponent(kofi.message);

					var currency = "";

					try {
						currency = kofi.currency.toLowerCase() || "";
					} catch (e) {}

					var symbol = {};
					if (currency && currency in Currencies) {
						symbol = Currencies[currency];
					}

					if (kofi.amount) {
						message.hasDonation = (symbol.s || "") + (kofi.amount || "") + " " + (kofi.currency.toUpperCase() || "");
						message.hasDonation = message.hasDonation.trim();
					}
					message.id = parseInt(Math.random() * 100000 + 1000000);
					message.chatbadges = "";
					message.backgroundColor = "";
					message.textColor = "";
					message.nameColor = "";
					message.chatimg = "";
					message.membership = "";
					message.contentimg = "";
					message.type = "kofi";

					data = message; // replace inbound stripe message with new message
					
					try {
						data = await applyBotActions(data); // perform any immediate actions, including modifying the message before sending it out
						
						if (data){
							try {
								data = await window.eventFlowSystem.processMessage(data); // perform any immediate actions
							} catch (e) {
								console.warn(e);
							}
							
							if (data) {
								resp = await sendToDestinations(data);
							}
						}
					} catch (e) {
						console.error(e);
					}
				} catch (e) {
					console.error(e);
					return;
				}

			
			} else if ("bmac" in data) { // Buy Me a Coffe New Membership and Donation detection 
				try {
					if (!data.bmac) {
						return false;
					}
					else {
						var bmac = data.bmac; 
						var message = {};
						if (bmac.type === "membership.started") {
							message.chatname = bmac.data.supporter_name || "Anonymous"; 
							message.chatmessage = bmac.data.support_note.trim(); 
							//We use the donation badge from Kofi to feature the membership level name
							message.hasDonation = bmac.data.membership_level_name; 
					
						}
						if (bmac.type === "donation.created") {
							var currency = "";
							try {
								currency = kofi.currency.toLowerCase() || "";
							} catch (e) {}

							var symbol = {};
							if (currency && currency in Currencies) {
								symbol = Currencies[currency];
							}		
							message.chatmessage = (bmac.data.message + " - " + "<em>" + bmac.data.support_note + "</em>").trim();
							message.hasDonation = (symbol.s || "") + (bmac.data.amount || "") + " " + (bmac.data.currency.toUpperCase() || "");
							message.hasDonation = message.hasDonation.trim();			
						}
						message.contentimg = "";
						message.id = parseInt(Math.random() * 100000 + 1000000);
						message.chatbadges = "";
						message.backgroundColor = "";
						message.textColor = "";
						message.nameColor = "";
						message.chatimg = "";
						message.membership = "";
						message.type = "bmac";
						data = message; // replace inbound stripe message with new message
					
						try {
							data = await applyBotActions(data); // perform any immediate actions, including modifying the message before sending it out
							
							if (data){
								try {
									data = await window.eventFlowSystem.processMessage(data); // perform any immediate actions
								} catch (e) {
									console.warn(e);
								}
								
								if (data) {
									resp = await sendToDestinations(data);
								}
							}
						} catch (e) {
							console.error(e);
						}

					} 
				} catch (e) {
					return;
				}	
			} else if ("fourthwall" in data) { // Dorthwall
			  try {
				if (!data.fourthwall.data || data.fourthwall.type !== "ORDER_PLACED") {
				  return false;
				}
				
				const fourthwallData = data.fourthwall.data;
				
				var message = {};
				message.chatname = fourthwallData.username || 
								   (fourthwallData.billing?.address?.name || "Anonymous");
				message.chatmessage = fourthwallData.message || "";
				
				var currency = "";
				try {
				  currency = fourthwallData.amounts.total.currency.toLowerCase() || "";
				} catch (e) {
				  console.error(e);
				}
				
				var symbol = {};
				if (currency && currency in Currencies) {
				  symbol = Currencies[currency];
				}
				
				if (fourthwallData.amounts && fourthwallData.amounts.total) {
				  message.hasDonation = (symbol.s || "") + 
									   (fourthwallData.amounts.total.value || "") + 
									   " " + (fourthwallData.amounts.total.currency || "");
				  message.hasDonation = message.hasDonation.trim();
				}
				
				// Add product info to the subtitle
				if (fourthwallData.offers && fourthwallData.offers.length) {
				  let productInfo = [];
				  fourthwallData.offers.forEach(offer => {
					if (offer.name && offer.variant && offer.variant.quantity) {
					  productInfo.push(`${offer.variant.quantity}× ${offer.name}`);
					}
				  });
				  
				  if (productInfo.length) {
					message.subtitle = productInfo.join(", ");
				  }
				}
				
				message.id = parseInt(Math.random() * 100000 + 1000000);
				message.chatbadges = "";
				message.backgroundColor = "";
				message.textColor = "";
				message.nameColor = "";
				message.chatimg = "";
				message.membership = "";
				message.contentimg = "";
				message.type = "fourthwall";
				
				data = message; // replace inbound fourthwall message with new message
			  } catch (e) {
				console.error(e);
				return;
			  }
			}

			if (typeof resp == "object") {
				resp = true;
			}
			if (data.get) {
				var ret = {};
				ret.callback = {};
				ret.callback.get = data.get;
				ret.callback.result = resp;
				socketserver.send(JSON.stringify(ret));
			}
		}
	});
}

function enableYouTube() {
	// function to send data to the DOCk via the VDO.Ninja API
	try {
		iframe.contentWindow.postMessage({ enableYouTube: settings.youtubeapikey.textsetting }, "*"); // send only to 'viewers' of this stream
	} catch (e) {
		console.error(e);
	}
}

const pendingRequests = new Map();

// Helper to clean up old pending requests
function cleanupPendingRequests() {
    const now = Date.now();
    for (const [url, timestamp] of pendingRequests.entries()) {
        if (now - timestamp > 10000) { // 10 seconds timeout
            pendingRequests.delete(url);
        }
    }
}

async function openchat(target = null, force = false) {
    if (!settings.openchat && !target && !force) {
        console.log("Open Chat is toggled off - no auto open all");
        return;
    }

    // Clean up old pending requests first
    cleanupPendingRequests();

    var res;
    var promise = new Promise((resolve, reject) => {
        res = resolve;
    });

    chrome.tabs.query({}, function(tabs) {
        if (chrome.runtime.lastError) {
            //console.warn(chrome.runtime.lastError.message);
        }
        let urls = [];
        tabs.forEach(tab => {
            if (tab.url) {
                urls.push(tab.url);
            }
        });
        res(urls);
    });

    var activeurls = await promise;
    log(activeurls);

    function openURL(input, newWindow = false, poke = false) {
        // Check if URL is already pending or active
        if (pendingRequests.has(input)) {
            console.log(`Request for ${input} is already pending`);
            return;
        }

        var matched = false;
        activeurls.forEach(url2 => {
            if (url2.startsWith(input)) {
                matched = true;
            }
        });

        if (!matched) {
            // Add to pending requests before opening
            pendingRequests.set(input, Date.now());

            try {
                if (newWindow) {
                    var popup = window.open(input, "_blank", "toolbar=0,location=0,menubar=0,fullscreen=0");
                    popup.moveTo(0, 0);
                    popup.resizeTo(100, 100);
                } else {
                    window.open(input, "_blank");
                }

                if (poke) {
                    setTimeout(() => pokeSite(input), 3000);
                    setTimeout(() => pokeSite(input), 6000);
                }

                // Remove from pending after a short delay to ensure window is opened
                setTimeout(() => {
                    pendingRequests.delete(input);
                }, 2000);
            } catch (error) {
                // Remove from pending if there's an error
                pendingRequests.delete(input);
                console.error(`Error opening ${input}:`, error);
            }
        }
    }
	
	
	async function openYouTubeLiveChats(settings) {
		// Ensure username starts with @
		if (!settings.youtube_username.textsetting.startsWith("@")) {
			settings.youtube_username.textsetting = "@" + settings.youtube_username.textsetting;
		}

		try {
			// Try our API first
			const response = await fetch(`https://api.socialstream.ninja/youtube/streams?username=${encodeURIComponent(settings.youtube_username.textsetting)}`);
			const data = await response.json();

			if (response.ok && Array.isArray(data) && data.length > 0) {
				// We found live streams, open chat for each one
				data.forEach(stream => {
					if (stream.videoId) {
						let url = "https://www.youtube.com/live_chat?is_popout=1&v=" + stream.videoId;
						if (stream.isShort) {
							url += "&shorts";
						}
						openURL(url, true);
					}
				});
				return; // Successfully handled via API
			}

			// If API returns error or no streams, fall back to old method
			await fallbackYouTubeLiveChat(settings);

		} catch (error) {
			console.error("API Error:", error);
			// API failed, fall back to old method
			await fallbackYouTubeLiveChat(settings);
		}
	}

	async function fallbackYouTubeLiveChat(settings) {
		try {
			// Try first URL format
			const response1 = await fetch("https://www.youtube.com/c/" + settings.youtube_username.textsetting + "/live");
			const data1 = await response1.text();
			const videoID = data1.split('{"videoId":"')[1].split('"')[0];
			
			if (videoID) {
				let url = "https://www.youtube.com/live_chat?is_popout=1&v=" + videoID;
				openURL(url, true);
				return;
			}
		} catch (e) {
			try {
				// Try second URL format
				const response2 = await fetch("https://www.youtube.com/" + settings.youtube_username.textsetting + "/live");
				const data2 = await response2.text();
				const videoID = data2.split('{"videoId":"')[1].split('"')[0];
				
				if (videoID) {
					let url = "https://www.youtube.com/live_chat?is_popout=1&v=" + videoID;
					openURL(url, true);
					return;
				}
			} catch (e) {
				console.log("No live streams found");
			}
		}
	}


	if ((target == "twitch" || !target) && settings.twitch_username) {
		let url = "https://www.twitch.tv/popout/" + settings.twitch_username.textsetting + "/chat?popout=";
		openURL(url, true);
	}

	if ((target == "kick" || !target) && settings.kick_username) {
		let url = "https://kick.com/" + settings.kick_username.textsetting + "/chatroom";
		openURL(url);
	}

	if ((target == "instagramlive" || !target) && settings.instagramlive_username && settings.instagramlive_username.textsetting) {
		let url = "https://www.instagram.com/" + settings.instagramlive_username.textsetting + "/live/";
		try {
			fetch(url, { method: "GET", redirect: "error" })
				.then(response => response.text())
				.then(data => {
					openURL(url, false, true);
				})
				.catch(error => {
					// not live?
				});
		} catch (e) {
			// not live
		}
	}

	if ((target == "facebook" || !target) && settings.facebook_username) {
		let url = "https://www.facebook.com/" + settings.facebook_username.textsetting + "/live";
		openURL(url);
	}

	if ((target == "discord" || !target) && settings.discord_serverid && settings.discord_channelid && settings.discord_serverid.textsetting && settings.discord_channelid.textsetting) {
		openURL("https://discord.com/channels/" + settings.discord_serverid.textsetting + "/" + settings.discord_channelid.textsetting);
	}

	// Opened in new window

	if (((target == "youtube") || (target == "youtubeshorts") || !target) && settings.youtube_username) {
		await openYouTubeLiveChats(settings);
	}

	if ((target == "tiktok" || !target) && settings.tiktok_username) {
		if (!settings.tiktok_username.textsetting.startsWith("@")) {
			settings.tiktok_username.textsetting = "@" + settings.tiktok_username.textsetting;
		}
		let url = "https://www.tiktok.com/" + settings.tiktok_username.textsetting + "/live";
		openURL(url, true);
	}

	if ((target == "trovo" || !target) && settings.trovo_username) {
		let url = "https://trovo.live/chat/" + settings.trovo_username.textsetting;
		openURL(url, true);
	}

	if ((target == "picarto" || !target) && settings.picarto_username) {
		let url = "https://picarto.tv/chatpopout/" + settings.picarto_username.textsetting + "/public";
		openURL(url, true);
	}

	if ((target == "dlive" || !target) && settings.dlive_username) {
		let url = "https://dlive.tv/c/" + settings.dlive_username.textsetting + "/" + settings.dlive_username.textsetting;
		openURL(url, true);
	}

	if ((target == "custom1" || !target) && settings.custom1_url) {
		let url = settings.custom1_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom1_url_newwindow);
	}

	if ((target == "custom2" || !target) && settings.custom2_url) {
		let url = settings.custom2_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom2_url_newwindow);
	}

	if ((target == "custom3" || !target) && settings.custom3_url) {
		let url = settings.custom3_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom3_url_newwindow);
	}

	if ((target == "custom4" || !target) && settings.custom4_url) {
		let url = settings.custom4_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom4_url_newwindow);
	}

	if ((target == "custom5" || !target) && settings.custom5_url) {
		let url = settings.custom5_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom5_url_newwindow);
	}

	if ((target == "custom6" || !target) && settings.custom6_url) {
		let url = settings.custom6_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom6_url_newwindow);
	}

	if ((target == "custom7" || !target) && settings.custom7_url) {
		let url = settings.custom7_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom7_url_newwindow);
	}

	if ((target == "custom8" || !target) && settings.custom8_url) {
		let url = settings.custom8_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom8_url_newwindow);
	}

	if ((target == "custom9" || !target) && settings.custom9_url) {
		let url = settings.custom9_url.textsetting;
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		openURL(url, settings.custom9_url_newwindow);
	}
}

function sendDataP2P(data, UUID = false) {
	// function to send data to the DOCk via the VDO.Ninja API

	if (!UUID && settings.server2 && socketserverDock && (socketserverDock.readyState===1)) {
		try {
			if (data.out){
				delete data.out;
			}
			socketserverDock.send(JSON.stringify(data));
			return;
		} catch (e) {
			console.error(e);
			// lets try to send it via P2P as a backup option
		}
	}

	var msg = {};
	msg.overlayNinja = data;

	if (iframe) {
		if (UUID && connectedPeers) {
			try {
				iframe.contentWindow.postMessage({ sendData: { overlayNinja: data }, type: "pcs", UUID: UUID }, "*");
			} catch (e) {
				console.error(e);
			}
		} else if (connectedPeers) {
			var keys = Object.keys(connectedPeers);
			for (var i = 0; i < keys.length; i++) {
				try {
					UUID = keys[i];
					var label = connectedPeers[UUID] || false;
					if (!label || label === "dock") {
						iframe.contentWindow.postMessage({ sendData: { overlayNinja: data }, type: "pcs", UUID: UUID }, "*"); // the docks and emotes page are VIEWERS, since backend is PUSH-only
					}
				} catch (e) {
					console.error(e);
				}
			}
		} else {
			iframe.contentWindow.postMessage({ sendData: msg, type: "pcs" }, "*"); // send only to 'viewers' of this stream
		}
	}
}
/////
var users = {};
var hype = {};
var viewerCounts = {};
var lastUpdated = {};
var activeViewerSources = {}; // Track sources that have received viewer updates
var hypeInterval = null;


function processHype(data) { // data here should be a chat message
    if (!settings.hypemode) {
        return;
    }

    if (!hypeInterval) {
        hypeInterval = setInterval(processHype2, 10000);
    }

    // Handle viewer count updates separately
    if (data.event === 'viewer_update' && data.meta) {
        updateViewerCount(data); // This updates viewers and sends combined data via its own path
        return; // Return here so it doesn't process as a chatter
    }
	
    // If it's not a viewer_update, proceed to process as a chatter
    const sourceType = data.type;
	
    let newSource = false;
	
    if (users[sourceType] && data.chatname) { // Site exists
        if (!users[sourceType][data.chatname]) { // New user for this site
            if (hype[sourceType]) {
                hype[sourceType] += 1;
            } else {
                hype[sourceType] = 1; // If hype[sourceType] is undefined, it becomes 1
				newSource = true;
            }
        }
        users[sourceType][data.chatname] = Date.now() + 60000 * 5;
    } else if (data.chatname){ // New site
        var site = {};
        site[data.chatname] = Date.now() + 60000 * 5;
        users[sourceType] = site;
        hype[sourceType] = 1;
		newSource = true;
    } else if (!(sourceType in hype)){
		hype[sourceType] = 0;
		newSource = true;
	}
    
	if (newSource){
		const combinedData = combineHypeData();
		sendHypeP2P(combinedData);
	}
}


function updateViewerCount(data) {
    // Handle new aggregated viewer_updates format
    if (data.event === "viewer_updates" && data.meta && typeof data.meta === "object") {
        // Clear old viewer counts since we're getting aggregated data
        viewerCounts = {};
        lastUpdated = {};
        activeViewerSources = {};
        
        // Process each platform's viewer count
        Object.keys(data.meta).forEach(type => {
            viewerCounts[type] = parseInt(data.meta[type]) || 0;
            lastUpdated[type] = Date.now();
            if (viewerCounts[type] > 0) {
                activeViewerSources[type] = true;
            }
        });
    } 
    // Handle legacy single viewer_update format
    else if (data.type && ("meta" in data)) {
        const sourceKey = data.tid ? `${data.type}-${data.tid}` : data.type;
        viewerCounts[sourceKey] = parseInt(data.meta) || 0;
        lastUpdated[sourceKey] = Date.now();
        if (viewerCounts[sourceKey] > 0) {
            activeViewerSources[sourceKey] = true;
        }
    }
    
    // Combine and send the updated counts
    const combinedData = combineHypeData();
    sendHypeP2P(combinedData);
}

function processHype2() {
    if (!settings.hypemode) {
        if (hypeInterval) clearInterval(hypeInterval);
        hypeInterval = null;
        return;
    }

    hype = {}; // Reset active chatters counts for this interval's calculation
    var now = Date.now();

    // Track sources with actual viewer data (>0)
    var sourcesWithActualViewers = {};
    for (const sourceKey in viewerCounts) {
        if (viewerCounts[sourceKey] > 0) {
            sourcesWithActualViewers[sourceKey] = true;
        }
    }

    // Process active chatters from `users`
    var currentActiveUsersPerSource = {}; // Temporary object to build fresh `hype` counts
    var activeUsersSites = Object.keys(users);
    for (var i = 0; i < activeUsersSites.length; i++) {
        const sourceName = activeUsersSites[i];
        var chatterNames = Object.keys(users[sourceName]);
        let liveChattersForThisSource = 0;
        let hasLiveChatters = false;
        for (var j = 0; j < chatterNames.length; j++) {
            const chatterName = chatterNames[j];
            if (users[sourceName][chatterName] < now) { // User expired
                delete users[sourceName][chatterName];
            } else {
                liveChattersForThisSource++;
                hasLiveChatters = true;
            }
        }
        if (hasLiveChatters) {
            currentActiveUsersPerSource[sourceName] = liveChattersForThisSource;
        } else {
            // If no live chatters, remove the source from users if it's empty
            if (Object.keys(users[sourceName]).length === 0) {
                delete users[sourceName];
            }
        }
    }
    hype = currentActiveUsersPerSource; // `hype` is now rebuilt

    const combinedData = combineHypeData();
    sendHypeP2P(combinedData);
}

function combineHypeData() {
    const result = { chatters: {}, viewers: {}, combined: {} };
    
    // Copy active chatters data
    for (const sourceType in hype) {
        result.chatters[sourceType] = hype[sourceType];
        if (!result.combined[sourceType]) result.combined[sourceType] = { chatters: 0, viewers: 0 };
        result.combined[sourceType].chatters = hype[sourceType];
    }
    
	for (const sourceType in viewerCounts) {
		// Include all sources that have viewer data, even if 0
		result.viewers[sourceType] = viewerCounts[sourceType];
		if (!result.combined[sourceType]) {
			result.combined[sourceType] = { chatters: 0, viewers: 0 };
		}
		result.combined[sourceType].viewers = viewerCounts[sourceType];
	}

    
    // Add unique ID if specified
    if (settings.hypeUniqueId) {
        result.uniqueId = settings.hypeUniqueId;
    }
    
    return result;
}
function sendHypeP2P(data, uid = null) {
  // function to send data to the DOCK via the VDO.Ninja API
  if (iframe) {
    if (!uid) {
      var keys = Object.keys(connectedPeers);
      for (var i = 0; i < keys.length; i++) {
        try {
          var UUID = keys[i];
          var label = connectedPeers[UUID];
          if (label === "hype") {
            iframe.contentWindow.postMessage({ sendData: { overlayNinja: { hype: data } }, type: "pcs", UUID: UUID }, "*");
          }
        } catch (e) {}
      }
    } else {
      var label = connectedPeers[uid];
      if (label === "hype") {
        iframe.contentWindow.postMessage({ sendData: { overlayNinja: { hype: data } }, type: "pcs", UUID: uid }, "*");
      }
    }
  }
}
//////
function sendTargetP2P(data, target) {
	// function to send data to the DOCk via the VDO.Ninja API

	if (iframe) {
		var keys = Object.keys(connectedPeers);
		for (var i = 0; i < keys.length; i++) {
			try {
				var UUID = keys[i];
				var label = connectedPeers[UUID];
				if (label === target) {
					iframe.contentWindow.postMessage({ sendData: { overlayNinja: data }, type: "pcs", UUID: UUID }, "*");
				}
			} catch (e) {}
		}
	
	}
}
function sendTickerP2P(data, uid = null) {
	// function to send data to the DOCk via the VDO.Ninja API

	if (iframe) {
		if (!uid) {
			var keys = Object.keys(connectedPeers);
			for (var i = 0; i < keys.length; i++) {
				try {
					var UUID = keys[i];
					var label = connectedPeers[UUID];
					if (label === "ticker") {
						iframe.contentWindow.postMessage({ sendData: { overlayNinja: { ticker: data } }, type: "pcs", UUID: UUID }, "*");
					}
				} catch (e) {}
			}
		} else {
			var label = connectedPeers[uid];
			if (label === "ticker") {
				iframe.contentWindow.postMessage({ sendData: { overlayNinja: { ticker: data } }, type: "pcs", UUID: uid }, "*");
			}
		}
	}
}

//////////

var drawListCount = 0;
var allowNewEntries = true;
var waitListUsers = {};
var waitlist = [];

function processWaitlist(data) {
	try {
		if (!allowNewEntries){
			return;
		}
		if (settings.waitlistmembersonly && !(data.membership || data.hasMembership)){
			return;
		}
		var trigger = "!join";
		if (settings.customwaitlistcommand && settings.customwaitlistcommand.textsetting.trim()) {
			trigger = settings.customwaitlistcommand.textsetting.trim() || trigger;
		}
		if (!data.chatmessage || !data.chatmessage.trim().toLowerCase().startsWith(trigger.toLowerCase())) {
			return;
		}
		var update = false;
		if (waitListUsers[data.type]) {
			if (!waitListUsers[data.type][data.chatname]) {
				update = true;
				waitListUsers[data.type][data.chatname] = Date.now();
				waitlist.push(data);
			}
		} else {
			var site = {};
			site[data.chatname] = Date.now();
			waitListUsers[data.type] = site;
			waitlist.push(data);
			update = true;
		}
		if (update){
			drawListCount+=1;
			
			if (settings.drawmode){
				var keys = Object.keys(connectedPeers);
				for (var i = 0; i < keys.length; i++) {
					try {
						var UUID = keys[i];
						var label = connectedPeers[UUID];
						if (label === "waitlist") {
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: { "drawPoolSize":drawListCount } }, type: "pcs", UUID: UUID }, "*");
						}
					} catch (e) {}
				}
			} else {
				sendWaitlistConfig(waitlist, false);
			}
			
		}
	} catch (e) {
		console.error(e);
	}
}

function setWordcloud(state=true) {
	try {
		if (isExtensionOn){
			sendTargetP2P({state:state}, "wordcloud");
		}
	} catch (e) {}
}

function initializePoll() {
	try {
		//if (!settings.pollEnabled) { // stop and clear
		//	return;
		//}
		if (isExtensionOn){
			//console.log("initializePoll");
			sendTargetP2P({settings:settings}, "poll");
		}
	} catch (e) {}
}

function loadPollPreset(pollId) {
	chrome.storage.local.get(['savedPolls'], function(result) {
		if (result.savedPolls) {
			try {
				const savedPolls = JSON.parse(result.savedPolls);
				const poll = savedPolls.find(p => p.id === pollId);
				if (poll && poll.settings) {
					// Update settings with the loaded poll
					Object.keys(poll.settings).forEach(key => {
						if (settings.hasOwnProperty(key)) {
							settings[key] = poll.settings[key];
						}
					});
					// Send updated settings to poll overlay
					sendTargetP2P({settings:settings}, "poll");
					// Save updated settings
					chrome.storage.local.set({settings: settings});
				}
			} catch (e) {
				log("Error loading poll preset: " + e.message);
			}
		}
	});
}

function updatePollSettings(newSettings) {
	try {
		// Update poll-related settings
		const pollKeys = ['pollType', 'pollQuestion', 'multipleChoiceOptions', 
						 'pollStyle', 'pollTimer', 'pollTimerState', 'pollTally', 'pollSpam'];
		
		pollKeys.forEach(key => {
			if (newSettings.hasOwnProperty(key)) {
				settings[key] = newSettings[key];
			}
		});
		
		// Send updated settings to poll overlay
		sendTargetP2P({settings:settings}, "poll");
		// Save settings
		chrome.storage.local.set({settings: settings});
	} catch (e) {
		log("Error updating poll settings: " + e.message);
	}
}

function getPollPresets(callback) {
	chrome.storage.local.get(['savedPolls'], function(result) {
		try {
			if (result.savedPolls) {
				const savedPolls = JSON.parse(result.savedPolls);
				// Return simplified list with id and name
				const presets = savedPolls.map(poll => ({
					id: poll.id,
					name: poll.name
				}));
				callback(presets);
			} else {
				callback([]);
			}
		} catch (e) {
			log("Error getting poll presets: " + e.message);
			callback([]);
		}
	});
}

function createNewPoll(pollSettings) {
	try {
		// Reset to default poll settings
		const defaultSettings = {
			pollType: 'freeform',
			pollQuestion: '',
			multipleChoiceOptions: '',
			pollStyle: 'default',
			pollTimer: '60',
			pollTimerState: false,
			pollTally: true,
			pollSpam: false
		};
		
		// Merge with provided settings
		const finalSettings = {...defaultSettings, ...pollSettings};
		updatePollSettings(finalSettings);
	} catch (e) {
		log("Error creating new poll: " + e.message);
	}
}

function initializeWaitlist() {
	try {
		if (!settings.waitlistmode) { // stop and clear
			waitlist = [];
			waitListUsers = {};
			
			drawListCount = 0;

			sendWaitlistConfig(false, true);
			return;
		}
		//log("initializeWaitlist");
		sendWaitlistConfig(waitlist, true);
	} catch (e) {}
}
function removeWaitlist(n = 0) {
	log("removeWaitlist");
	try {
		var cc = 1;
		for (var i = 0; i < waitlist.length; i++) {
			if (waitlist[i].waitStatus !== 1) {
				if (n == 0) {
					waitlist[i].waitStatus = 1;
					sendWaitlistConfig(waitlist, true);
					break;
				} else if (cc == n) {
					waitlist[i].waitStatus = 1;
					sendWaitlistConfig(waitlist, true);
					break;
				} else {
					cc += 1;
				}
			}
		}
	} catch (e) {}
}
function highlightWaitlist(n = 0) {
	log("highlightWaitlist");
	try {
		var cc = 1;
		for (var i = 0; i < waitlist.length; i++) {
			if (waitlist[i].waitStatus !== 1) {
				if (n == 0) {
					if (waitlist[i].waitStatus !== 2) {
						// selected
						waitlist[i].waitStatus = 2;
						sendWaitlistConfig(waitlist, true);
						break;
					}
				} else if (cc == n) {
					waitlist[i].waitStatus = 2;
					sendWaitlistConfig(waitlist, true);
					break;
				} else {
					cc += 1;
				}
			}
		}
	} catch (e) {}
}
function shuffle(array) {
	// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
	var currentIndex = array.length,
		randomIndex;
	while (currentIndex > 0) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}
	return array;
}
function selectRandomWaitlist(n = 1) {
	log("selectRandomWaitlist: "+n);
	try {
		var cc = 1;
		var selectable = [];
		for (var i = 0; i < waitlist.length; i++) {
			if (waitlist[i].waitStatus !== 1) {
				// removed form wait list already
				if (!waitlist[i].randomStatus) {
					waitlist[i].randomStatus = 0; // not yet a winner
					selectable.push(i);
				} else if (waitlist[i].randomStatus === 1) {
					// already selected
					waitlist[i].randomStatus = 2;
				}
			}
		}
		shuffle(selectable);
		var winners = [];
		//console.log(selectable);
		let count = Math.min(selectable.length,n);
		for (var i = 0; i < count; i++) {
			try {
				if (waitlist[selectable[i]]) {
					waitlist[selectable[i]].randomStatus = 1;
					winners.push({...waitlist[selectable[i]]});
				}
			} catch(e){
				console.log(e);
			}
		}
		//console.log("SENDING WINNDERS");
		//console.log(winners);
		
		drawListCount = selectable.length - count;
		sendWaitlistConfig(winners, true);
		return winners;
		
	} catch (e) {}
	return false;
}

function resetWaitlist() {
	waitListUsers = {};
	waitlist = [];
	drawListCount = 0;
	allowNewEntries = true;
	sendWaitlistConfig(waitlist, true, true);
}

function toggleEntries(state=false){
	allowNewEntries = state;
	sendWaitlistConfig();
}
function objectArrayToCSV(data, delimiter = ",") {
	if (!data || !Array.isArray(data) || data.length === 0) {
		return "";
	}
	const header = Object.keys(data[0]).join(delimiter);

	const rows = data.map(obj =>
		Object.values(obj)
			.map(value => (typeof value === "string" && value.includes(delimiter) ? `"${value}"` : value))
			.join(delimiter)
	);

	return [header, ...rows].join("\n");
}

async function downloadWaitlist() {
	const opts = {
		types: [
			{
				description: "Data file",
				accept: { "application/data": [".tsv"] }
			}
		]
	};
	if (!window.showSaveFilePicker) {
		console.warn("Open `brave://flags/#file-system-access-api` and enable to use the File API");
	}
	fileExportHandler = await window.showSaveFilePicker(opts);
	var filesContent = objectArrayToCSV(waitlist, "\t");

	if (typeof fileExportHandler == "string") {
		ipcRenderer.send("write-to-file", { filePath: fileExportHandler, data: filesContent });
	} else {
		const writableStream = await fileExportHandler.createWritable();
		await writableStream.write(filesContent);
		await writableStream.close();
	}
}

function sendWaitlistConfig(data = null, sendMessage = true, clear=false) {
	//console.warn("sendWaitlistConfig");
	if (iframe) {
		if (sendMessage) {
			var trigger = "!join";
			if (settings.customwaitlistcommand && settings.customwaitlistcommand.textsetting.trim()) {
				trigger = settings.customwaitlistcommand.textsetting.trim();
			}
			var message = "Type " + trigger + " to join this wait list";
			if (settings.drawmode) {
				if (!allowNewEntries){
					message = "No new entries allowed";
				} else {
					message = "Type " + trigger + " to join the random draw";
				}
			}
			if (settings.customwaitlistmessagetoggle) {
				if (settings.customwaitlistmessage) {
					message = settings.customwaitlistmessage.textsetting.trim();
					message = message.replace(/{trigger}/g, trigger);
				} else {
					message = "";
				}
			}
		}

		//console.log(data);

		var keys = Object.keys(connectedPeers);
		for (var i = 0; i < keys.length; i++) {
			try {
				var UUID = keys[i];
				var label = connectedPeers[UUID];
				if (label === "waitlist") {
					if (sendMessage) {
						if (data === null) {
							if (settings.drawmode){
								iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
									waitlistmessage: message, 
									drawPoolSize: drawListCount,
									drawmode: true,
									clearWinner:clear,
								} }, type: "pcs", UUID: UUID}, "*");
							} else {
								iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
									waitlistmessage: message, 
									drawmode: false
								} }, type: "pcs", UUID: UUID}, "*");
							}
						} else if (settings.drawmode){
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
								waitlistmessage: message, 
								winlist: data,
								drawPoolSize: drawListCount,
								drawmode: true,
								clearWinner:clear
							}}, type: "pcs", UUID: UUID }, "*");
						} else {
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
								waitlist: data, 
								waitlistmessage: message, 
								drawmode: false
							}}, type: "pcs", UUID: UUID }, "*");
						}
					} else if (data !== null) {
						
						if (settings.drawmode){
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: {
								drawPoolSize: drawListCount,
								drawmode: true,
								clearWinner:clear,
								waitlist: data
							} }, type: "pcs", UUID: UUID }, "*");
						} else {
							iframe.contentWindow.postMessage({ sendData: { overlayNinja: { 
								drawmode: false,
								waitlist: data
							} }, type: "pcs", UUID: UUID }, "*");
						}
					}
				}
			} catch (e) {}
		}
	}
}

///

function sendToDisk(data) {
	if (newFileHandle) {
		try {
			if (typeof data == "object") {
				data.timestamp = data.timestamp || (new Date().getTime());

				if (data.type && data.chatimg && ((data.type == "youtube") || (data.type == "youtubeshorts"))) {
					data.chatimg = data.chatimg.replace("=s32-", "=s512-"); // high, but meh.
					data.chatimg = data.chatimg.replace("=s64-", "=s512-");
				}

				if (data.type && (data.type == "twitch") && !data.chatimg && data.chatname) {
					data.chatimg = "https://api.socialstream.ninja/twitch/large?username=" + encodeURIComponent(data.chatname); // 150x150
				}

				overwriteFile(JSON.stringify(data));
			}
		} catch (e) {}
	}
	if (newFileHandleExcel) {
		try {
			if (typeof data == "object") {
				data.timestamp = data.timestamp || (new Date().getTime());

				if (data.type && data.chatimg && ((data.type == "youtube") || (data.type == "youtubeshorts"))) {
					data.chatimg = data.chatimg.replace("=s32-", "=s256-");
					data.chatimg = data.chatimg.replace("=s64-", "=s256-");
				}

				if (data.type && (data.type == "twitch") && !data.chatimg && data.chatname) {
					data.chatimg = "https://api.socialstream.ninja/twitch/large?username=" + encodeURIComponent(data.chatname); // 150x150
				}
				overwriteFileExcel(data);
			}
		} catch (e) {}
	}

	if (newSavedNamesFileHandle && data.chatname) {
		overwriteSavedNames(data.chatname);
	}
}

function loadIframe(streamID, pass = false) {
	// this is pretty important if you want to avoid camera permission popup problems.  You can also call it automatically via: <body onload=>loadIframe();"> , but don't call it before the page loads.
	log("LOAD IFRAME VDON BG");

	var lanonly = "";
	if (settings["lanonly"]) {
		lanonly = "&lanonly";
	}

	if (iframe) {
		if (!pass) {
			pass = "false";
		}
		//iframe.allow = "document-domain;encrypted-media;sync-xhr;usb;web-share;cross-origin-isolated;accelerometer;midi;geolocation;autoplay;camera;microphone;fullscreen;picture-in-picture;display-capture;";
		iframe.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" + pass + lanonly + "&room=" + streamID + "&push=" + streamID + "&vd=0&ad=0&autostart&cleanoutput&view&label=SocialStream"; // don't listen to any inbound events
	} else {
		iframe = document.createElement("iframe");
		//iframe.allow =  "document-domain;encrypted-media;sync-xhr;usb;web-share;cross-origin-isolated;accelerometer;midi;geolocation;autoplay;camera;microphone;fullscreen;picture-in-picture;display-capture;";
		if (!pass) {
			pass = "false";
		}
		iframe.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" + pass + lanonly + "&room=" + streamID + "&push=" + streamID + "&vd=0&ad=0&autostart&cleanoutput&view&label=SocialStream"; // don't listen to any inbound events
		document.body.appendChild(iframe);
	}
}

var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent"; // lets us listen to the VDO.Ninja IFRAME API; ie: lets us talk to the dock
var eventer = window[eventMethod];
var messageEvent = eventMethod === "attachEvent" ? "onmessage" : "message";
var commandCounter = 0;

const debuggerState = {
  attachments: {}, // Track active debugger attachments
  timeouts: {}    // Track detach timeouts
};


function safeDebuggerAttach(tabId, version, callback) {
  if (debuggerState.attachments[tabId]) {
    // Already attached, just call the callback
    callback();
    return;
  }

  // Clear any pending detach timeout
  if (debuggerState.timeouts[tabId]) {
    clearTimeout(debuggerState.timeouts[tabId]);
    delete debuggerState.timeouts[tabId];
  }

  try {
    chrome.debugger.attach({ tabId: tabId }, version, () => {
      if (chrome.runtime.lastError) {
        //console.log'Debugger attach error:', chrome.runtime.lastError);
        callback(chrome.runtime.lastError);
        return;
      }
      debuggerState.attachments[tabId] = true;
      callback();
    });
  } catch(e) {
    //console.log'Debugger attach exception:', e);
    callback(e);
  }
}

function onDetach(debuggeeId) {
    try {
        chrome.runtime.lastError;
    } catch(e) {}

    if (debuggeeId.tabId) {
        // Clear any existing timeout
        if (debuggerState.timeouts[debuggeeId.tabId]) {
            clearTimeout(debuggerState.timeouts[debuggeeId.tabId]);
            delete debuggerState.timeouts[debuggeeId.tabId];
        }
        
        // Clear the attachment state
        debuggerState.attachments[debuggeeId.tabId] = false;
	}
}

try {
	chrome.debugger.onDetach.addListener(onDetach);
} catch (e) {
	log("'chrome.debugger' not supported by this browser");
}


async function processIncomingRequest(request, UUID = false) { // from the dock or chat bot, etc.
	if (settings.disablehost) {
		return;
	}

	if ("response" in request) {
		// we receieved a response from the dock
		//sendMessageToTabs(request);
		sendMessageToTabs(request, false, null, false, false, false);
	} else if ("action" in request) {
		if (request.action === "openChat") {
			openchat(request.value || null);
		} else if (request.action === "skipTTS") {
			// Skip the currently playing TTS message
			chrome.tabs.query({}, function(tabs) {
				tabs.forEach(tab => {
					chrome.tabs.sendMessage(tab.id, {skipTTS: true}, function() {
						if (chrome.runtime.lastError) {
							// Tab doesn't have content script loaded, ignore
						}
					});
				});
			});
		} else if (request.action === "getUserHistory" && request.value && request.value.chatname && request.value.type) {
			if (isExtensionOn) {
				getMessagesDB(request.value.userid || request.value.chatname, request.value.type, (page = 0), (pageSize = 100), function (response) {
					if (isExtensionOn) {
						sendDataP2P({ userHistory: response }, UUID);
					}
				});
			}
		} else if (request.action === "getRecentHistory" && request.value) {
			if (isExtensionOn) {
				var res = await getLastMessagesDB(request.value);
				if (isExtensionOn) {
					sendDataP2P({ recentHistory: res }, UUID);
				}
			}
		} else if (request.action === "toggleVIPUser" && request.value && request.value.chatname && request.value.type) {
			// Initialize viplist settings if not present
			if (!settings.viplistusers) {
				settings.viplistusers = { textsetting: "" };
			}

			const viplist = settings.viplistusers.textsetting.split(",").map(user => {
				const parts = user.split(":").map(part => part.trim());
				return { username: parts[0], type: parts[1] || "" };
			}); 
			
			var altSourceType = request.value.type || "";
			if (altSourceType == "youtubeshorts"){
				altSourceType = "youtube";
			}

			const userToVIP = { username: (request.value.userid || request.value.chatname), type: altSourceType };
			const isAlreadyVIP = viplist.some(({ username, type }) => userToVIP.username === username && (userToVIP.type === type || type === ""));

			if (!isAlreadyVIP) {
				settings.viplistusers.textsetting += (settings.viplistusers.textsetting ? "," : "") + userToVIP.username + ":" + userToVIP.type;
				chrome.storage.local.set({ settings: settings });
				// Check for errors in chrome storage operations
				if (chrome.runtime.lastError) {
					console.error("Error updating settings:", chrome.runtime.lastError.message);
				}
			}

			if (isExtensionOn) {
				sendToDestinations({ vipUser: userToVIP });
			}
		} else if (request.action === "markUser" && request.value && request.value.chatname && request.value.type && request.value.role) {
			if (request.value.role=="bot"){
				if (!settings.botnamesext) {
					settings.botnamesext = { textsetting: "" };
				}
				const markedlist = settings.botnamesext.textsetting.split(",").map(user => {
					const parts = user.split(":").map(part => part.trim());
					return { username: parts[0], type: parts[1] || "" };
				}); 
				
				var altSourceType = request.value.type || "";
				if (altSourceType == "youtubeshorts"){
					altSourceType = "youtube";
				}
				
				const userToMark = { username: (request.value.userid || request.value.chatname), type: altSourceType };
				const isAlreadyMarked = markedlist.some(({ username, type }) => userToMark.username === username && (userToMark.type === type || type === ""));
				
				if (!isAlreadyMarked) {
					settings.botnamesext.textsetting += (settings.botnamesext.textsetting ? "," : "") + userToMark.username + ":" + userToMark.type;
					chrome.storage.local.set({ settings: settings });
					// Check for errors in chrome storage operations
					if (chrome.runtime.lastError) {
						console.error("Error updating settings:", chrome.runtime.lastError.message);
					}
				}
			} else if (request.value.role=="mod"){
				if (!settings.modnamesext) {
					settings.modnamesext = { textsetting: "" };
				}
				const markedlist = settings.modnamesext.textsetting.split(",").map(user => {
					const parts = user.split(":").map(part => part.trim());
					return { username: parts[0], type: parts[1] || "" };
				}); 
				
				var altSourceType = request.value.type || "";
				if (altSourceType == "youtubeshorts"){
					altSourceType = "youtube";
				}
				
				const userToMark = { username: (request.value.userid || request.value.chatname), type: altSourceType };
				const isAlreadyMarked = markedlist.some(({ username, type }) => userToMark.username === username && (userToMark.type === type || type === ""));
				
				if (!isAlreadyMarked) {
					settings.modnamesext.textsetting += (settings.modnamesext.textsetting ? "," : "") + userToMark.username + ":" + userToMark.type;
					chrome.storage.local.set({ settings: settings });
					// Check for errors in chrome storage operations
					if (chrome.runtime.lastError) {
						console.error("Error updating settings:", chrome.runtime.lastError.message);
					}
				}
			}
		} else if (request.action === "getChatSources") {
			if (isExtensionOn && chrome.debugger) {
				chrome.tabs.query({}, function (tabs) {
					chrome.runtime.lastError;
					var tabsList = [];
					for (var i = 0; i < tabs.length; i++) {
						try {
							if (!tabs[i].url) {
								continue;
							}
							if (tabs[i].url.startsWith("https://socialstream.ninja/")) {
								continue;
							}
							if (tabs[i].url.startsWith("https://www.youtube.com/watch") && !tabs[i].url.includes("&socialstream")) {
								continue;
							}
							if (tabs[i].url.startsWith("https://twitch.tv") && !tabs[i].url.startsWith("https://twitch.tv/popout/")) {
								continue;
							}
							if (tabs[i].url.startsWith("https://www.twitch.tv") && !tabs[i].url.startsWith("https://www.twitch.tv/popout/")) {
								continue;
							}
							if (tabs[i].url.startsWith("file://") && tabs[i].url.includes("dock.html?")) {
								continue;
							}
							if (tabs[i].url.startsWith("file://") && tabs[i].url.includes("index.html?")) {
								continue;
							}
							if (tabs[i].url.startsWith("chrome-extension")) {
								continue;
							}
							if (tabs[i].id && priorityTabs.has(tabs[i].id)) {
								tabsList.unshift(tabs[i]);
							} else {
								tabsList.push(tabs[i]);
							}
						} catch (e) {}
					}
					
					let ttsTab = {};
					ttsTab.url = "";
					ttsTab.id = "TTS";
					ttsTab.title = "Text to Speech your message";
					ttsTab.favIconUrl = "./icons/tts_incoming_messages_on.png";
					
					tabsList.push(ttsTab)

					sendDataP2P({ tabsList: tabsList }, UUID);
				});
			}
		} else if (request.action === "blockUser") {
			blockUser(request.value);
		} else if (request.action === "obsCommand") {
			if (isExtensionOn){
				fowardOBSCommand(request);
			}
		} else if (request.value && ("target" in request) && UUID && request.action === "chatbot"){ // target is the callback ID
			if (isExtensionOn && settings.allowChatBot){ // private chat bot
				
				try {
				  // ollama run technobyte/Llama-3.3-70B-Abliterated:IQ2_XS
				  // let model = "technobyte/Llama-3.3-70B-Abliterated:IQ2_XS"
				  let prompt = request.value || "";
				  if (request.turbo) {
						prompt = "You're an AI assistant. Keep responses limited to a few sentences.\n" + prompt;
				  }
				  let model = request.model || null;
				  const controller = new AbortController();
				  
				  callLLMAPI(prompt, model, (chunk) => {
					sendDataP2P({ chatbotChunk: {value: chunk, target: request.target}}, UUID);
				  }, controller, UUID, (request.images || null)).then((fullResponse) => {
					sendDataP2P({ chatbotResponse: {value: fullResponse, target: request.target}}, UUID);
				  }).catch((error) => {
					console.error('Error in callLLMAPI:', error);
					sendDataP2P({ chatbotResponse: {value: JSON.stringify(error), target: request.target}}, UUID);
				  });
				} catch(e) {
				  console.error('Unexpected error:', e);
				  sendDataP2P({ chatbotResponse: {value: JSON.stringify(e), target: request.target}}, UUID);
				}
			}
		}
	}
}

function fowardOBSCommand(data){
	// data.value = {value:{action: 'setCurrentScene', value: sceneName}}
	if (isExtensionOn && data.value) {
		sendToDestinations({obsCommand: data.value});
	}
}

function blockUser(data){
	// Initialize blacklist settings if not present
	
	if (!(data && data.chatname && data.type)){
		console.warn("Block request doesn't contain chatname and type. '*' can be used for all types.");
		return false;
	}
	try {
		if (!settings.blacklistusers) {
			settings.blacklistusers = { textsetting: "" };
		}
		let resave = false;
		if (!settings.blacklistuserstoggle){
			settings.blacklistuserstoggle = {};
			settings.blacklistuserstoggle.setting = true;
			resave = true;
		}

		const blacklist = settings.blacklistusers.textsetting.split(",").map(user => {
			const parts = user.split(":").map(part => part.trim());
			return { username: parts[0], type: parts[1] || "*" };
		});
		
		var altSourceType = data.type || "";
		if (altSourceType == "youtubeshorts"){
			altSourceType = "youtube";
		}

		const userToBlock = { username: (data.userid || data.chatname), type: altSourceType };
		
		if (data.chatimg && !data.chatimg.endsWith("/unknown.png")){
			userToBlock.chatimg = data.chatimg;
		}
		
		const isAlreadyBlocked = blacklist.some(({ username, type }) => userToBlock.username === username && (userToBlock.type === type || type === "*"));

		if (!isAlreadyBlocked) {
			// Update blacklist settings
			settings.blacklistusers.textsetting += (settings.blacklistusers.textsetting ? "," : "") + userToBlock.username + ":" + userToBlock.type;
			chrome.storage.local.set({ settings: settings });
			// Check for errors in chrome storage operations
			if (chrome.runtime.lastError) {
				console.error("Error updating settings:", chrome.runtime.lastError.message);
			}
		} else if (resave){
			chrome.storage.local.set({ settings: settings });
		}

		if (isExtensionOn) {
			sendToDestinations({ blockUser: userToBlock });
		}
	} catch(e){
		console.error(e);
		return false;
	}
	
	return true;
}

eventer(messageEvent, async function (e) {
	// iframe wno't be enabled if isExtensionOn is off, so allow this.
	if (!iframe) {
		return;
	}
	if (e.source != iframe.contentWindow) {
		return;
	}
	if (e.data && typeof e.data == "object") {
		if ("dataReceived" in e.data && "overlayNinja" in e.data.dataReceived) {
			processIncomingRequest(e.data.dataReceived.overlayNinja, e.data.UUID);
		} else if ("action" in e.data) {
			if (e.data.action == "view-stats-updated") {
				return;
			} else if (e.data.UUID && e.data.value && e.data.action == "push-connection-info") {
				// flip this
				if ("label" in e.data.value) {
					connectedPeers[e.data.UUID] = e.data.value.label;
					if (connectedPeers[e.data.UUID] == "hype") {
						processHype2();
					} else if (connectedPeers[e.data.UUID] == "ticker") {
						processTicker();
					} else if (connectedPeers[e.data.UUID] == "waitlist") {
						initializeWaitlist();
					} else if (connectedPeers[e.data.UUID] == "poll") {
						initializePoll();
					}
				}
			} else if (e.data.UUID && e.data.value && e.data.action == "view-connection-info") {
				// flip this
				if ("label" in e.data.value) {
					connectedPeers[e.data.UUID] = e.data.value.label;
					if (connectedPeers[e.data.UUID] == "hype") {
						processHype2();
					} else if (connectedPeers[e.data.UUID] == "ticker") {
						processTicker();
					} else if (connectedPeers[e.data.UUID] == "waitlist") {
						initializeWaitlist();
					} else if (connectedPeers[e.data.UUID] == "poll") {
						initializePoll();
					}
				}
			} else if (e.data.UUID && "value" in e.data && !e.data.value && e.data.action == "push-connection") {
				// flip this
				if (e.data.UUID in connectedPeers) {
					delete connectedPeers[e.data.UUID];
				}
				//log(connectedPeers);
			} else if (e.data.UUID && "value" in e.data && !e.data.value && e.data.action == "view-connection") {
				// flip this
				if (e.data.UUID in connectedPeers) {
					delete connectedPeers[e.data.UUID];
				}
			} else if (e.data.action === "alert") {
				if (e.data.value && e.data.value == "Stream ID is already in use.") {
					document.title = "Close me? - Social Stream Ninja";
					isExtensionOn = false;
					updateExtensionState();
					try {
						chrome.notifications.create({
							type: "basic",
							iconUrl: "./icons/icon-128.png",
							title: "Cannot enable Social Stream",
							message: "Your specified Session ID is already in use.\n\nDisable Social Stream elsewhere if already in use first, or change your session ID to something unique."
						});
						messagePopup({alert: "Your specified Session ID is already in use.\n\nDisable Social Stream elsewhere if already in use first, or change your session ID to something unique."});
					} catch (e) {
						console.error(e);
					}
					if (!isSSAPP){
						window.close();
					}
				}
			}
		}
	}
});

function checkIfAllowed(sitename) {
	if (isSSAPP){return true;}
	
	if (!settings.discord) {
		try {
			if (sitename == "discord") {
				return false;
			}
			if (sitename.startsWith("https://discord.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.slack) {
		try {
			if (sitename == "slack") {
				return false;
			}
			if (sitename.startsWith("https://app.slack.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.teams) {
		try {
			if (sitename == "teams") {
				return false;
			}
			if (sitename.startsWith("https://teams.microsoft.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.openai) {
		try {
			if (sitename == "openai") {
				return false;
			}
			if (sitename.startsWith("https://chat.openai.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.chime) {
		try {
			if (sitename == "chime") {
				return false;
			}
			if (sitename.startsWith("https://app.chime.aws/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.meet) {
		try {
			if (sitename == "meet") {
				return false;
			}
			if (sitename.startsWith("https://meet.google.com/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.telegram) { 
		try {
			if (sitename == "telegram") {
				return false;
			}
			if (sitename.includes(".telegram.org/")) {
				return false;
			}
		} catch (e) {}
	}
	if (!settings.whatsapp) {
		try {
			if (sitename == "whatsapp") {
				return false;
			}
			if (sitename.startsWith("https://web.whatsapp.com/")) {
				return false;
			}
		} catch (e) {}
	}

	if (!settings.instagram) {
		try {
			if (sitename == "instagram") {
				// "instagram live" is allowed still, just not comments
				return false;
			}
			//if (sitename.startsWith("https://www.instagram.com/") && !sitename.includes("/live/")) {
			//	return false;
			//}
		} catch (e) {}
	}
	return true;
}

function messagePopup(data) {
    const popupMessage = {
        forPopup: data
    };
    chrome.runtime.sendMessage(popupMessage, function(response) {
        if (chrome.runtime.lastError) {
            // console.warn("Error sending message:", chrome.runtime.lastError.message);
        } else {
            // //console.log"Message sent successfully:", response);
        }
    });
    return true;
}

function pokeSite(url = false, tabid = false) {
    if (!chrome.debugger) {
        return false;
    }
    if (!isExtensionOn) {
        return false;
    }

    chrome.tabs.query({}, function (tabs) {
        if (chrome.runtime.lastError) {
            //console.warn(chrome.runtime.lastError.message);
        }
        var published = {};
        for (var i = 0; i < tabs.length; i++) {
            try {
                const currentTab = tabs[i];
                
                if (!currentTab.url) continue;
                if (currentTab.url.startsWith("chrome://")) continue;  // Add this line
                if (currentTab.url in published) continue;
                if (currentTab.url.startsWith("https://socialstream.ninja/")) continue;
                if (currentTab.url.startsWith("chrome-extension")) continue;
                // if (!checkIfAllowed((currentTab.url))){continue;}
                
                published[currentTab.url] = true;
                
                if (tabid && tabid == currentTab.id) {
                    safeDebuggerAttach(currentTab.id, "1.3", (error) => {
                        if (error) {
                            console.warn(`Failed to attach debugger to tab ${currentTab.id}:`, error);
                            return;
                        }
                        generalFakePoke(currentTab.id);
                    });
                } else if (url) {
                    if (currentTab.url.startsWith(url)) {
                        safeDebuggerAttach(currentTab.id, "1.3", (error) => {
                            if (error) {
                                console.warn(`Failed to attach debugger to tab ${currentTab.id}:`, error);
                                return;
                            }
                            generalFakePoke(currentTab.id);
                        });
                    }
                }
            } catch (e) {
                chrome.runtime.lastError;
            }
        }
    });
    return true;
}

function generalFakePoke(tabid) {
	// fake a user input
	try {
		chrome.debugger.sendCommand(
			{ tabId: tabid },
			"Input.dispatchKeyEvent",
			{
				type: "keyDown",
				key: "Enter",
				code: "Enter",
				nativeVirtualKeyCode: 13,
				windowsVirtualKeyCode: 13
			},
			function (e) {
				chrome.debugger.sendCommand(
					{ tabId: tabid },
					"Input.dispatchKeyEvent",
					{
						type: "keyUp",
						key: "Enter",
						code: "Enter",
						nativeVirtualKeyCode: 13,
						windowsVirtualKeyCode: 13
					},
					function (e) {
						chrome.debugger.sendCommand(
							{ tabId: tabid },
							"Input.dispatchMouseEvent",
							{
								type: "mousePressed",
								x: 1,
								y: 1,
								button: "left",
								clickCount: 1
							},
							function (e) {
								chrome.debugger.sendCommand(
									{ tabId: tabid },
									"Input.dispatchMouseEvent",
									{
										type: "mouseReleased",
										x: 1,
										y: 1,
										button: "left",
										clickCount: 1
									},
									(e) => {
										delayedDetach(tabid);
									}
								);
							}
						);
					}
				);
			}
		);
	} catch (e) {
		//console.loge);
		delayedDetach(tabid);
	}
}

function delayedDetach(tabid) {
  try {
    chrome.runtime.lastError;
  } catch(e) {}
  
  // Clear any existing timeout
  if (debuggerState.timeouts[tabid]) {
    clearTimeout(debuggerState.timeouts[tabid]);
  }
  
  // Set new timeout
  debuggerState.timeouts[tabid] = setTimeout(function(tabid) {
    try {
      debuggerState.attachments[tabid] = false;
      chrome.debugger.detach({ tabId: tabid }, onDetach.bind(null, { tabId: tabid }));
    } catch(e) {
      errorlog(e);
    }
  }, 1000, tabid);
}

async function sendMessageToTabs(data, reverse = false, metadata = null, relayMode = false, antispam = false, overrideTimeout = 3500) {
    console.log('[RELAY DEBUG - sendMessageToTabs] Called with:', {
        data: data,
        reverse: reverse,
        metadata: metadata,
        relayMode: relayMode,
        antispam: antispam,
        overrideTimeout: overrideTimeout,
        isExtensionOn: isExtensionOn,
        disablehost: settings.disablehost
    });
    
    if (!chrome.debugger || !isExtensionOn || settings.disablehost) {
        console.log('[RELAY DEBUG - sendMessageToTabs] Early return - Extension off or host disabled');
        return false;
    }

	if (!data.response){
		console.log('[RELAY DEBUG - sendMessageToTabs] Early return - No response in data');
		return false;
	}
    if (antispam && settings["dynamictiming"] && lastAntiSpam + 10 > messageCounter) {
        return false;
    }
    
    if (antispam && settings["dynamictiming"]) {
        if (lastAntiSpam + 10 > messageCounter) {
            return;
        }
    }
    const now = Date.now();
    
    if (!reverse && !overrideTimeout && data.tid) { // we do this early to avoid the blue bar if not needed
        if (data.tid in messageTimeout) {
            if (now - messageTimeout[data.tid] < overrideTimeout) {
                return;
            }
        }
    }
    
    lastAntiSpam = messageCounter;
    
    var msg2Save = checkExactDuplicateAlreadyRelayed(data.response, false, false, true);  // this might be more efficient if I do it after, rather than before
    
	if (settings.s10apikey && settings.s10) {
		try {
			handleStageTen(data, metadata);
		} catch(e){}
	}
	
    try {
		
        const tabs = await new Promise(resolve => chrome.tabs.query({}, resolve));
        console.log(`[RELAY DEBUG - sendMessageToTabs] Found ${tabs.length} tabs`);
        var published = {};
        let processedAnyTab = false;  // Track if we processed any tabs with destination filter
        
        // Helper function to process a tab
        const processTab = async (tab) => {
            console.log(`[RELAY DEBUG - sendMessageToTabs] Processing valid tab ${tab.id}: ${tab.url?.substring(0, 50)}...`);
            processedAnyTab = true;  // Mark that we found at least one valid tab

            // Handle message store
            if (msg2Save) {  
                handleMessageStore(tab.id, msg2Save, now, relayMode);
            }

            published[tab.url] = true;
                
            // Handle different site types
            if (tab.url.includes(".stageten.tv") && settings.s10apikey && settings.s10) {
                // we will handle this on its own.
                return;
            } else if (tab.url.startsWith("https://www.twitch.tv/popout/")) {
                let restxt = data.response.length > 500 ? data.response.substring(0, 500) : data.response;
                await attachAndChat(tab.id, restxt, false, true, false, false, overrideTimeout);
            } else if (tab.url.startsWith("https://boltplus.tv/")) {
                await attachAndChat(tab.id, data.response, false, true, true, true, overrideTimeout);
            } else if (tab.url.startsWith("https://rumble.com/")) {
                await attachAndChat(tab.id, data.response, true, true, false, false, overrideTimeout);
            } else if (tab.url.startsWith("https://app.chime.aws/meetings/")) {
                await attachAndChat(tab.id, data.response, false, true, true, false, overrideTimeout);
            } else if (tab.url.startsWith("https://kick.com/")) {
                let restxt = data.response.length > 500 ? data.response.substring(0, 500) : data.response;
                if (isSSAPP){
                    await attachAndChat(tab.id, " "+restxt, false, true, true, false, overrideTimeout);
                } else {
                    await attachAndChat(tab.id, restxt, false, true, true, false, overrideTimeout);
                }
            } else if (tab.url.startsWith("https://app.slack.com")) {
                await attachAndChat(tab.id, data.response, true, true, true, false, overrideTimeout); 
            } else if (tab.url.startsWith("https://app.zoom.us/")) {
                await attachAndChat(tab.id, data.response, false, true, false, false, overrideTimeout, zoomFakeChat);
                return;
            } else {
                // Generic handler
                if (tab.url.includes("youtube.com/live_chat")) {
                    getYoutubeAvatarImage(tab.url, true);
                    let restxt = data.response;
                    
                    if (restxt.length > 200){
                        restxt = restxt.substring(0, 200);
                        var ignore = checkExactDuplicateAlreadyRelayed(restxt, false, false, true); 
                        if (ignore) {  
                            handleMessageStore(tab.id, ignore, now, relayMode);
                        }
                    }
                    
                    await attachAndChat(tab.id, restxt, true, true, false, false, overrideTimeout);
                    return;
                }
                
                if (tab.url.includes("tiktok.com")) {
                    let tiktokMessage = data.response;
                    
                    if (settings.notiktoklinks){
                        tiktokMessage = replaceURLsWithSubstring(tiktokMessage, "");
                    }
                    let restxt = tiktokMessage.length > 150 ? tiktokMessage.substring(0, 150) : tiktokMessage;
                    
                    if (restxt!==data.response){
                        var ignore = checkExactDuplicateAlreadyRelayed(restxt, false, false, true); 
                        if (ignore) {  
                            handleMessageStore(tab.id, ignore, now, relayMode);
                        }
                    }
                    
                    await attachAndChat(tab.id, restxt, true, true, false, false, overrideTimeout);
                    return;
                }
                
                await attachAndChat(tab.id, data.response, true, true, false, false, overrideTimeout);
            }
        };
        
        // First pass: try with source type matching
        for (const tab of tabs) {
            try {
                // Skip invalid tabs
                let isValid = await isValidTab(tab, data, reverse, published, now, overrideTimeout, relayMode);
                if (!isValid) {
                    console.log(`[RELAY DEBUG - sendMessageToTabs] Tab ${tab.id} (${tab.url?.substring(0, 50)}...) is invalid, skipping`);
                    continue;
                }
                await processTab(tab);
            } catch (e) {
                chrome.runtime.lastError;
                console.log(`[RELAY DEBUG - sendMessageToTabs] Error processing tab ${tab.id}:`, e);
            }
        }
        
        // If we have a destination filter and didn't process any tabs, try URL matching as fallback
        if (data.destination && !processedAnyTab) {
            console.log(`[RELAY DEBUG - sendMessageToTabs] No tabs matched destination '${data.destination}' by source type, trying URL matching fallback`);
            
            // Reset published to allow retrying
            published = {};
            
            // Create a modified data object that bypasses source type checking
            const fallbackData = {...data};
            
            for (const tab of tabs) {
                try {
                    // Skip basic invalid checks
                    if (!tab.url) continue;
                    if (tab.url.startsWith("chrome://")) continue;
                    if (tab.url.startsWith("chrome-extension")) continue;
                    if (tab.url.startsWith("https://socialstream.ninja/")) continue;
                    if (tab.url in published) continue;
                    if (!checkIfAllowed(tab.url)) continue;
                    
                    // Check TID conditions
                    if ("tid" in data && data.tid !== false && data.tid !== null) {
                        if (typeof data.tid == "object") {
                            if (reverse && data.tid.includes(tab.id.toString())) continue;
                            if (!reverse && !data.tid.includes(tab.id.toString())) continue;
                        } else {
                            if (reverse) {
                                if (data.tid === tab.id) continue;
                                if (data.url && tab.url && data.url === tab.url) continue;
                            } else if (data.tid !== tab.id) continue;
                        }
                    }
                    
                    // Try URL matching for the destination
                    if (!tab.url.includes(data.destination)) {
                        console.log(`[RELAY DEBUG - sendMessageToTabs FALLBACK] Tab ${tab.id} URL doesn't include '${data.destination}', skipping`);
                        continue;
                    }
                    
                    console.log(`[RELAY DEBUG - sendMessageToTabs FALLBACK] Processing tab ${tab.id} via URL match: ${tab.url?.substring(0, 50)}...`);
                    await processTab(tab);
                } catch (e) {
                    chrome.runtime.lastError;
                    console.log(`[RELAY DEBUG - sendMessageToTabs FALLBACK] Error processing tab ${tab.id}:`, e);
                }
            }
        }
    } catch (error) {
        //console.log('Error in sendMessageToTabs:', error);
        return false;
    }
    
    return true;
}

// Helper function to check if a tab is valid for processing
async function isValidTab(tab, data, reverse, published, now, overrideTimeout, relayMode) {
    // First check URLs that we can't or shouldn't process
    if (!tab.url) return false;
    if (tab.url.startsWith("chrome://")) return false;  // Add this line
    if (tab.url.startsWith("chrome-extension")) return false;
    if (tab.url.startsWith("https://socialstream.ninja/")) return false;
    if (tab.url in published) return false;
    if (!checkIfAllowed(tab.url)) return false;
    
    // Check TID conditions
    if ("tid" in data && data.tid !== false && data.tid !== null) {
        if (typeof data.tid == "object") {
            if (reverse && data.tid.includes(tab.id.toString())) return false;
            if (!reverse && !data.tid.includes(tab.id.toString())) return false;
        } else {
            if (reverse) {
                if (data.tid === tab.id) return false;
                if (data.url && tab.url && data.url === tab.url) return false;
            } else if (data.tid !== tab.id) return false;
        }
    }
    
    // Check destination - match against tab's source type instead of URL
    if (data.destination) {
        // Ensure tab.id exists before trying to get source type
        if (!tab.id) {
            console.log('[RELAY DEBUG - isValidTab] No tab.id available, cannot check source type');
            // Fall back to URL matching if we have a URL
            if (tab.url && !tab.url.includes(data.destination)) {
                return false;
            }
            return true; // If no tab.id and no URL, allow it through
        }
        
        const sourceType = await getSourceType(tab.id);
        console.log('[RELAY DEBUG - isValidTab] Tab source type:', sourceType, 'Expected destination:', data.destination);
        
        // If we couldn't get the source type, fall back to URL matching for custom destinations
        if (!sourceType) {
            // For custom destinations like channel names, still use URL matching
            if (!tab.url.includes(data.destination)) {
                console.log('[RELAY DEBUG - isValidTab] No source type, URL check failed');
                return false;
            }
        } else {
            // For platform destinations, match exact source type (already lowercase from getSourceType)
            if (sourceType !== data.destination.toLowerCase()) {
                console.log('[RELAY DEBUG - isValidTab] Source type mismatch');
                // Don't return false here - we'll check this in sendMessageToTabs for fallback
                return false;
            }
        }
    }
    if (reverse && !overrideTimeout && tab.id) {
        if (tab.id in messageTimeout && now - messageTimeout[tab.id] < overrideTimeout) {
            return false;
        }
    }
	
	if (relayMode && relaytargets){
		let sourceType = await getSourceType(tab.id);
		if (!sourceType || !relaytargets.includes(sourceType)){
			return false;
		}
	}
	
    return true;
}

// Helper function to handle message store
function handleMessageStore(tabId, msg2Save, now, relayMode) {
    try {
        if (!messageStore[tabId]) {
            messageStore[tabId] = [];
        } else {
            while (messageStore[tabId].length > 0 && now - messageStore[tabId][0].timestamp > 10000) {
                messageStore[tabId].shift();
            }
        }
        messageStore[tabId].push({
            message: msg2Save,
            timestamp: now,
            relayMode: relayMode
        });
    } catch(e) {
        errorlog(e);
    }
}
function messageExistsInTimeWindow(tabId, messageToFind, timeWindowMs = 1000) {
    try {
        if (!messageStore[tabId]) {
            return false;
        }

        const now = Date.now();
        
        return messageStore[tabId].some(entry => {
            const isWithinTimeWindow = (now - entry.timestamp) <= timeWindowMs;
            const messageMatches = entry.message === messageToFind;
            
            return isWithinTimeWindow && messageMatches;
        });
    } catch(e) {
        errorlog(e);
        return false;
    }
}


// Helper function to handle StageTen
function handleStageTen(data, metadata) {
    if (!data.response) return;
    if (metadata) {
        sendToS10(metadata, true);
    } else {
        var msg = {
            chatmessage: data.response,
            type: "socialstream",
            chatimg: "https://socialstream.ninja/icons/icon-128.png"
        };
        sendToS10(msg, true);
    }
}

// Helper function to attach debugger and send chat
async function attachAndChat(tabId, message, middle, keypress, backspace, delayedPress, overrideTimeout, chatFunction = generalFakeChat) {
    return new Promise((resolve, reject) => {
        safeDebuggerAttach(tabId, "1.3", (error) => {
            if (error) {
                console.warn(`Failed to attach debugger to tab ${tabId}:`, error);
                reject(error);
                return;
            }
            chatFunction(tabId, message, middle, keypress, backspace, delayedPress, overrideTimeout);
            resolve();
        });
    });
}
 
function zoomFakeChat(tabid, message, middle = false, keypress = true, backspace = false) {
    chrome.tabs.sendMessage(tabid, "focusChat", function (response = false) {
        try {
            chrome.runtime.lastError; // Clear any runtime errors
            
            if (!response) {
                delayedDetach(tabid);
                return;
            }

            // Check if debugger is still attached before sending commands
            if (!debuggerState.attachments[tabid]) {
                console.warn(`Debugger not attached for tab ${tabid}`);
                return;
            }

            chrome.debugger.sendCommand({ tabId: tabid }, "Input.insertText", { text: message }, function (e) {
                if (chrome.runtime.lastError) {
                    console.warn(`Error inserting text for tab ${tabid}:`, chrome.runtime.lastError);
                    delayedDetach(tabid);
                    return;
                }

                chrome.debugger.sendCommand(
                    { tabId: tabid },
                    "Input.dispatchKeyEvent",
                    {
                        type: "keyDown",
                        key: "Enter",
                        code: "Enter",
                        nativeVirtualKeyCode: 13,
                        windowsVirtualKeyCode: 13
                    },
                    (e) => {
                        if (chrome.runtime.lastError) {
                            console.warn(`Error sending keyDown for tab ${tabid}:`, chrome.runtime.lastError);
                        }
                        delayedDetach(tabid);
                    }
                );
            });
        } catch (e) {
            console.error(`Error in zoomFakeChat for tab ${tabid}:`, e);
            delayedDetach(tabid);
        }
    });
}

function limitString(string, maxLength) {
	let count = 0;
	let result = "";

	for (let i = 0; i < string.length; ) {
		let char = string[i];
		let charCode = string.charCodeAt(i);

		if (charCode >= 0xd800 && charCode <= 0xdbff) {
			i++;
			char += string[i];
		}

		let charLength = char.length;

		if (count + charLength <= maxLength) {
			result += char;
			count += charLength;
			i++;
		} else {
			break;
		}
	}
	return result;
}
const KEY_EVENTS = {
  ENTER: {
    key: "Enter",
    code: "Enter",
    nativeVirtualKeyCode: 13,
    windowsVirtualKeyCode: 13,
    isComposing: false,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false
  },
  BACKSPACE: {
    key: "Backspace",
    code: "Backspace", 
    nativeVirtualKeyCode: 8,
    windowsVirtualKeyCode: 8,
    text: "",
    unmodifiedText: ""
  }
};

async function sendKeyEvent(tabId, type, keyConfig) {
  await chrome.debugger.sendCommand(
    { tabId },
    "Input.dispatchKeyEvent",
    { type, ...keyConfig }
  );
}

async function insertText(tabId, text) {
  await chrome.debugger.sendCommand(
    { tabId },
    "Input.insertText",
    { text }
  );
}

async function focusChat(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, "focusChat", (response = false) => {
      chrome.runtime.lastError;
      resolve(response);
    });
  });
}

async function getSourceType(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, "getSource", (response) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(response || false);
    });
  });
}

async function generalFakeChat(tabId, message, middle = true, keypress = true, backspace = false, delayedPress = false, overrideTimeout = false) {
  try {
    if (!overrideTimeout && messageTimeout[tabId]) {
      if (Date.now() - messageTimeout[tabId] < overrideTimeout) {
        return;
      }
    }

    const isFocused = await focusChat(tabId);
    if (!isFocused) {
      await delayedDetach(tabId);
      return;
    }

    lastSentMessage = message.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s\s+/g, " ");
    lastSentTimestamp = Date.now();
    lastMessageCounter = 0;
    messageTimeout[tabId] = Date.now();

    if (settings.limitcharactersstate) {
      const limit = settings.limitcharacters?.numbersetting || 200;
      message = limitString(message, limit);
    }

    if (backspace) {
      await sendKeyEvent(tabId, "rawKeyDown", KEY_EVENTS.BACKSPACE);
    }

    await insertText(tabId, message);

	if (keypress) {
	  await sendKeyEvent(tabId, "keyDown", KEY_EVENTS.ENTER);
	  await new Promise(resolve => setTimeout(resolve, 10));
	}

	if (middle) {
	  await sendKeyEvent(tabId, "char", { ...KEY_EVENTS.ENTER, text: "\r" });
	}

	if (keypress) {
	  await sendKeyEvent(tabId, "keyUp", KEY_EVENTS.ENTER);
	}
	
	if (delayedPress) {
        await sendKeyEvent(tabId, "keyDown", KEY_EVENTS.ENTER);
		await new Promise(resolve => setTimeout(resolve, 500));
		if (middle){
			await sendKeyEvent(tabId, "char", { ...KEY_EVENTS.ENTER, text: "\r" });
		}
        await sendKeyEvent(tabId, "keyUp", KEY_EVENTS.ENTER);
    }
	
	if (backspace) {
      await sendKeyEvent(tabId, "rawKeyDown", KEY_EVENTS.BACKSPACE);
    }

    await delayedDetach(tabId);

  } catch (e) {
    chrome.runtime.lastError;
    log(e);
    await delayedDetach(tabId);
  }
}

function createTab(url) {
	return new Promise(resolve => {
		chrome.windows.create({ focused: false, height: 200, width: 400, left: 0, top: 0, type: "popup", url: url }, async tab => {
			if (chrome.tabs.onUpdated){
				chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
					if (info.status === "complete" && tabId === tab.id) {
						chrome.tabs.onUpdated.removeListener(listener);
						resolve(tab);
					}
				});
			}
	 					  
		});
	});
}




const commandLastExecuted = {};
/* 
function extractBskyUsername(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Clean up the input text but preserve case for pattern matching
  const cleanText = text.trim();

  // Handle various URL patterns
  const patterns = [
    // bsky.app/profile/username.domain format
    {
      pattern: /(?:https?:\/\/)?(?:www\.)?bsky\.app\/profile\/([a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]+)*)/i,
      transform: (match) => match[1].includes('.') ? match[1] : `${match[1]}.bsky.social`
    },
    // bsky.app/username.domain format (without /profile/)
    {
      pattern: /(?:https?:\/\/)?(?:www\.)?bsky\.app\/([a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]+)*)/i,
      transform: (match) => match[1].includes('.') ? match[1] : `${match[1]}.bsky.social`
    },
    // username.bsky.app format
    {
      pattern: /\b([a-zA-Z0-9-_]+)\.bsky\.app\b/i,
      transform: (match) => `${match[1]}.bsky.social`
    },
    // Just "Bsky.app" text (common in descriptions)
    {
      pattern: /\b(?:on\s+)?bsky\.app\b/i,
      transform: () => false
    },
    // @username format (matches even within text)
    {
      pattern: /\B@([a-zA-Z0-9-_]+)\b/i,
      transform: (match) => `${match[1].toLowerCase()}.bsky.social`
    },
    // username@bsky.social format
    {
      pattern: /\b([a-zA-Z0-9-_]+)@bsky\.social\b/i,
      transform: (match) => `${match[1].toLowerCase()}.bsky.social`
    }
  ];

  // Try each pattern in order
  for (const { pattern, transform } of patterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const result = transform(match);
      // Skip if transform returned false (for ignored patterns)
      if (result === false) continue;
      
      // Validate the final result
      if (/^[a-z0-9-_]+(?:\.[a-z0-9-_]+)+$/.test(result.toLowerCase())) {
        return result.toLowerCase();
      }
    }
  }

  return false;
}
 */
/* var BSky = {};
try {
	BSky = localStorage.getItem("x2bsky")
	if (BSky){
		BSky = JSON.parse(BSky);
		BSky = JSON.parse(BSky);
	}
} catch(e){}

 */
 
class HostMessageFilter {
  constructor() {
    this.messages = new Map();
    this.expireTime = 60000; // 20 seconds in milliseconds
  }

  sanitizeMessage(message) {
    if (!message || typeof message !== 'string') return '';
    
    // Strip HTML tags and normalize whitespace
    return message.replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/\s\s+/g, " ")
      .trim();
  }

  isHostDuplicate(message) {
    if (!message || !message.host) return false;
    
    const currentTime = Date.now();
    
    // Determine message content based on available fields
    let messageContent = '';
    if (message.textonly) {
      messageContent = message.chatmessage;
    } else if (message.chatmessage !== undefined) {
      messageContent = this.sanitizeMessage(message.chatmessage);
    } else if (message.hasDonation || (message.membership && message.event)) {
      // Handle empty messages with special events
      messageContent = `${message.hasDonation ? 'donation' : ''}${message.membership && message.event ? 'membership' : ''}`;
    }
    
    // Clean up expired messages
    this.cleanUp(currentTime);
    
    // Check if this is a duplicate
    for (const [existingContent, timestamp] of this.messages.entries()) {
      if (messageContent === existingContent && (currentTime - timestamp < this.expireTime)) {
        return true;
      }
    }
    
    // Not a duplicate, store this message
    this.messages.set(messageContent, currentTime);
    return false;
  }

  cleanUp(currentTime) {
    for (const [content, timestamp] of this.messages.entries()) {
      if (currentTime - timestamp > this.expireTime) {
        this.messages.delete(content);
      }
    }
  }
}

// Create an instance
const hostMessageFilter = new HostMessageFilter();


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
	  prefixes: ['midievent', 'midicommand', 'midinote',  'mididevice'],
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
			settings[key]?.numbersetting !== undefined) {
		  events.add(parseInt(id));
		}
	  }
	});
  });

  return Array.from(events).sort((a, b) => a - b);
}

// expects an object; not False/Null/undefined
async function applyBotActions(data, tab = false) {
	
	if (!data.id) {
		messageCounter += 1;
		data.id = messageCounter;
	}

	try {
		
		if (settings.memberchatonly && !(data.membership || data.hasMembership)) {
			return false;
		}
		
		var altSourceType = data.type || "";
		if (altSourceType == "youtubeshorts"){
			altSourceType = "youtube";
		}

		
		if (settings.blacklistuserstoggle && settings.blacklistusers?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return null;

				const blacklist = settings.blacklistusers.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				const isBlocked = blacklist.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});

				if (isBlocked) {
					return null;
				}
			} catch(e) {
				errorlog(e);
				return null;
			}
		}
		
		if (settings.whitelistuserstoggle && settings.whitelistusers?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return null;

				const whitelist = settings.whitelistusers.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				const isWhitelisted = whitelist.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});

				if (!isWhitelisted) {
					return null;
				}
			} catch(e) {
				errorlog(e);
				return null;
			}
		}

		if (settings.mynameext){
			if (!settings.botnamesext){
				settings.botnamesext = settings.mynameext;
			}
			delete settings.mynameext;
		}
		if (!data.bot && settings.botnamesext?.textsetting && (data.chatname || data.userid)) { 
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const bots = settings.botnamesext.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.bot = bots.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
				data.bot = false;
			}
		}
		if (data.bot && settings.hidebotsext) {
			return false;
		}
		if (data.bot && data.chatname && settings.hidebotnamesext) {
			data.chatname = "";
		}
		
		if (!data.host && settings.hostnamesext?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const hosts = settings.hostnamesext.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.host = hosts.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
				data.host = false;
			}
		}
		if (data.host && settings.hidehostsext) {
			return false;
		}
		
		if (data.host && data.reflection && settings.nohostreflections){
			return false;
		}
		
		if (settings.hostFirstSimilarOnly && data.host && hostMessageFilter.isHostDuplicate(data)) {
			return false;
		}
		
		if (data.host && data.chatname && settings.hidehostnamesext) {
			data.chatname = "";
		}
		
		if (!data.mod && settings.modnamesext?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const mods = settings.modnamesext.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.mod = mods.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
				data.mod = false;
			}
		}
		
		if (data.mod && settings.hidemodsext) {
			return false;
		}
		if (data.mod && data.chatname && settings.hidemodnamesext) {
			data.chatname = "";
		}
		
		if (!data.admin && settings.adminnames?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const admins = settings.adminnames.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.admin = admins.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
			}
		}
		
		if (!data.vip && settings.viplistusers?.textsetting && (data.chatname || data.userid)) {
			try {
				const userIdentifier = (data.userid || data.chatname || "").toLowerCase().trim();
				if (!userIdentifier) return;

				const vips = settings.viplistusers.textsetting
					.toLowerCase()
					.split(",")
					.map(entry => entry.trim())
					.filter(entry => entry);

				data.vip = vips.some(entry => {
					const [name, type] = entry.split(":").map(part => part.trim());
					if (!name) return false;
					
					return type ? 
						name === userIdentifier && type === altSourceType :
						name === userIdentifier;
				});
			} catch(e) {
				errorlog(e);
			}
		}

		if (settings.removeContentImage) {
			data.contentimg = "";
			if (!data.chatmessage && !data.hasDonation) {
				// there's no content worth sending I'm assuming
				return false;
			}
		}
		
		//
		var skipRelay = false;
		
		if (!data.timestamp) {
			data.timestamp = Date.now();
		}
		
		
		if (settings.normalizeText && data.chatmessage){
			data.chatmessage = normalizeText(data.chatmessage, data.textonly || false)
		}
		
		if (settings.firsttimers && data.chatname && data.type){
			try {
				let exists = await messageStoreDB.checkUserTypeExists((data.userid || data.chatname), data.type);
				if (!exists){
					data.firsttime = true;
				}
			} catch (e) {
				console.error("Error checking first timer:", e);
			}
		}
		
		if (settings.joke && data.chatmessage && data.chatmessage.toLowerCase() === "!joke") {
			////console.log".");
			//if (Date.now() - messageTimeout > 5100) {
				var score = parseInt(Math.random() * 378);
				var joke = jokes[score];

				//messageTimeout = Date.now();
				var msg = {};
				
				if (data.reflection){
					msg.response = joke["setup"];
					sendMessageToTabs(msg, false, null, true, false, 5100);
					
					var dashboardMsg = {
						chatname: data.chatname,
						chatmessage: joke["setup"],
						chatimg: data.chatimg,
						type: data.type,
						tid: data.tid
					};
					setTimeout(
						function (dashboardMsg) {
							sendToDestinations(dashboardMsg);
						},
						100,
						dashboardMsg
					);
					
				} else {
					if (data.tid){
						msg.tid = data.tid;
					}
					msg.response = "@" + data.chatname + ", " + joke["setup"];
					sendMessageToTabs(msg, false, null, false, false, 5100);
				}
				
				skipRelay= true; // lets not relay "!joke"
				
				let punch = "@" + data.chatname + ".. " + joke["punchline"];
				
				
				if (data.reflection){
					punch =  ".. " + joke["punchline"];
					var dashboardMsg = {
						chatname: data.chatname,
						chatmessage: punch,
						chatimg: data.chatimg,
						type: data.type,
						tid: data.tid
					};
					setTimeout(
						function (dashboardMsg) {
							sendToDestinations(dashboardMsg);
						},
						5000,
						dashboardMsg
					);
				}
				
				setTimeout(
					function (tId, punchline, reflection) {
						var message = {};
						if (tId && !reflection){
							message.tid = tId;
						}
						message.response = punchline;
						sendMessageToTabs(message, false, null, reflection, false, false);
					},
					5000,
					data.tid,
					punch,
					data.reflection
				);
			//}
		}
		
		if (settings.autohi && data.chatname && data.chatmessage && !data.reflection) {
			if (["hi", "sup", "hello", "hey", "yo", "hi!", "hey!"].includes(data.chatmessage.toLowerCase())) {
				var msg = {};
				if (data.tid){
					msg.tid = data.tid;
				}
				msg.response = "Hi, @" + data.chatname + " !";
				sendMessageToTabs(msg, false, null, false, false, 60000); 
			}
		}
		
		if (settings.queuecommand && data.chatmessage && data.chatmessage.startsWith("!queue ")) {
			try {
				data.chatmessage = data.chatmessage.split("!queue ")[1].trim();
				data.queueme = true;
			} catch (e) {
				errorlog(e);
			}
		}
		
		// Question identification logic
		if (settings.identifyQuestions && data.chatmessage) {
			// Default keywords to identify questions
			const questionKeywords = settings.questionKeywords?.textsetting?.split(",").map(k => k.trim()) || ["?", "Q:", "question:", "Question:", "how", "what", "when", "where", "why", "who", "which", "could", "would", "should", "can", "will"];
			
			// Check if message contains any question keywords
			const messageText = data.chatmessage.toLowerCase();
			const isQuestion = questionKeywords.some(keyword => {
				const keywordLower = keyword.toLowerCase();
				if (keywordLower === "?") {
					return messageText.includes(keywordLower);
				}
				// For word-based keywords, check word boundaries
				const wordRegex = new RegExp(`\\b${keywordLower}\\b`);
				return wordRegex.test(messageText);
			});
			
			if (isQuestion) {
				data.question = true;
			}
		}
		
		if (settings.dice && data.chatname && data.chatmessage && (data.chatmessage.toLowerCase().startsWith("!dice ") || data.chatmessage.toLowerCase() === "!dice")) {
			//	//console.log"dice detected");
			//if (Date.now() - messageTimeout > 5100) {
				
			let maxRoll = data.chatmessage.toLowerCase().split(" ");
			if (maxRoll.length == 1) {
				maxRoll = 6;
			} else {
				maxRoll = parseInt(maxRoll[1]) || 6;
			}
			
			let roll = Math.floor(Math.random() * maxRoll) + 1;

			//messageTimeout = Date.now();
			var msg = {};
			
			if (data.tid){
				msg.tid = data.tid;
				msg.response = "@" + data.chatname + ", the bot rolled you a " + roll +".";
				sendMessageToTabs(msg, false, null, true, false, 5100); 
			}
			
			var msg2 = {};
			if (data.tid){
				msg2.tid = data.tid;
			}
			msg2.response = data.chatname +" was rolled a "+roll+" (out of "+maxRoll+")";
			sendMessageToTabs(msg2, true, null, true, false, 5100);  
			skipRelay = true;
			
			if (data.reflection){
				setTimeout(()=>{
					let diceBotMessage = {};
					diceBotMessage.chatmessage = data.chatname +" was rolled a "+roll+" (out of "+maxRoll+")";
					diceBotMessage.chatimg = "https://socialstream.ninja/icons/bot.png";
					diceBotMessage.bot = "dice";
					diceBotMessage.type = "socialstream";
					diceBotMessage.chatname = "🎲 Dice Roll";
					sendToDestinations(diceBotMessage);
				},50);
			}
			// if we send the normal messages, it will screw things up.
			//}
		}
		
		
		const messageToCheck = data.textContent || data.chatmessage;
		if (settings.relayall && data.chatmessage && !data.event && tab && messageToCheck.includes(miscTranslations.said)){
			//console.log("1");
			return null;
			
		} else if (settings.relayall && !data.reflection && !skipRelay && data.chatmessage && !data.event && tab) {
			//console.log("2");
			if (checkExactDuplicateAlreadyRelayed(data.chatmessage, data.textonly, tab.id, false)) { 
				return null;
			}
			
			if (!data.bot && (!settings.relayhostonly || data.host)) {
				//console.log("3");
				//messageTimeout = Date.now();
				var msg = {};
				
				if (data.tid){
					msg.tid = data.tid;
				}
				// this should be ideall HTML stripped
				if (tab) {
					msg.url = tab.url;
				} 

				let tmpmsg = sanitizeRelay(data.chatmessage, data.textonly).trim();
				if (tmpmsg) {  
					if (settings.nosaid){
						msg.response = tmpmsg;
					} else if (data.chatname){
						msg.response = sanitizeRelay(data.chatname, true, miscTranslations.someone) + miscTranslations.said + tmpmsg; 
					} else if (data.type){
						msg.response = data.type.replace(/\b\w/g, c => c.toUpperCase())+": " + tmpmsg;
					} else {
						msg.response = miscTranslations.someonesaid + tmpmsg;
					}
					sendMessageToTabs(msg, true, data, true, false, 1000); // this should be the first and only message
				}
			} else {
				sendToDestinations(data);
				return null;
			}
		} else if (settings.s10relay && !data.bot && data.chatmessage && data.chatname && !data.event){
			sendToS10(data, false, true); // we'll handle the relay logic here instead
		}
		//console.logdata);
		
		if (settings.forwardcommands2twitch && data.type && (data.type !== "twitch") && !data.reflection && !skipRelay && data.chatmessage && data.chatname && !data.event && tab && data.tid) {
			if (!data.bot && data.chatmessage.startsWith("!")) {
				//messageTimeout = Date.now();
				var msg = {};
				
				msg.tid = data.tid;
				msg.url = tab.url;
				
				msg.destination = "twitch.tv"; // sent to twitch tabs only

				msg.response =  data.chatmessage;
				
				if (!data.textonly){
					var textArea = document.createElement('textarea');
					textArea.innerHTML = msg.response;
					msg.response = textArea.value;
				}
				msg.response = msg.response.replace(/(<([^>]+)>)/gi, "");
				msg.response = msg.response.replace(/[#@]/g, "");
				msg.response = msg.response.replace(/\.(?=\S(?!$))/g, " ");
				msg.response = msg.response.trim();
				
				if (msg.response){
					sendMessageToTabs(msg, true, data, true, false, 1000);
				}
				
			} 
		} else if (settings.forwardcommands2twitch && data.type && (data.type === "twitch") && data.reflection && !skipRelay && data.chatmessage && data.chatname && !data.event && tab && data.tid) {
			if (!data.bot && data.chatmessage.startsWith("!")) {
				return null;
			}
		}

		if (data.chatmessage) {
			const botReplyEvents = settings['botReply'] || [];
			for (const id of botReplyEvents) {
				const event = settings[`botReplyMessageEvent${id}`];
				const command = settings[`botReplyMessageCommand${id}`]?.textsetting;
				const response = settings[`botReplyMessageValue${id}`]?.textsetting;
				
				if (!event?.setting || !command || !response) continue;
				
				const isFullMatch = settings.botReplyMessageFull;
				const messageText = data.textContent || data.chatmessage;
				const messageMatches = isFullMatch ? 
				  messageText === command :
				  messageText.includes(command);
				  
				if (!messageMatches) continue;
				
				// Check source restrictions
				const sources = settings[`botReplyMessageSource${id}`]?.textsetting;
				if (sources?.trim()) {
				  const sourceList = sources.split(',').map(s => s.trim().toLowerCase());
				  if (!sourceList.includes(data.type?.trim().toLowerCase())) {
					continue;
				  }
				}
				
				// Send response
				const timeout = settings[`botReplyMessageTimeout${id}`]?.numbersetting || 0;
				const msg = {
				  response,
				  ...(data.tid && !settings[`botReplyAll${id}`] && { tid: data.tid })
				};
				
				sendMessageToTabs(msg, false, null, false, false, timeout);
				break; // Stop after first match
			}
			  
			const midiEvents = settings['midiCommand'] || [];
			for (const id of midiEvents) {
				const event = settings[`midievent${id}`];
				const command = settings[`midicommand${id}`]?.textsetting;
				const note = settings[`midinote${id}`]?.numbersetting;
				const device = settings[`mididevice${id}`]?.numbersetting || "";
				
				if (!event?.setting || !command || !note) continue;
				
				const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const regex = new RegExp(`^${escapedCommand}\\b|\\s${escapedCommand}\\b`, 'i');
				
				if (regex.test(data.chatmessage)) {
					triggerMidiNote(parseInt(note), device);
					break;
				}
			}
		}

		if (settings.blacklist && data.chatmessage) {
			try {
				data.chatmessage = filterProfanity(data.chatmessage);
			} catch (e) {
				console.error(e);
			}
		}
		if (settings.blacklistname && data.chatname) {
			try {
				data.chatname = filterProfanity(data.chatname);
			} catch (e) {
				console.error(e);
			}
		}

		if (settings.goodwordslist) {
			if (goodWordsHashTable) {
				try {
					data.chatmessage = passGoodWords(data.chatmessage);
				} catch (e) {
					console.error(e);
				}
			}
		}
		
		if (settings.highlightevent && settings.highlightevent.textsetting.trim() && data.chatmessage && data.event) {
			const eventTexts = settings.highlightevent.textsetting.split(',').map(text => text.trim());
			const messageText = data.textContent || data.chatmessage;
			if (eventTexts.some(text => messageText.includes(text))) {
				data.highlightColor = "#fff387";
			}
		}

		if (settings.highlightword && settings.highlightword.textsetting.trim() && data.chatmessage) {
			const wordTexts = settings.highlightword.textsetting.split(',').map(text => text.trim());
			const messageText = data.textContent || data.chatmessage;
			if (wordTexts.some(text => messageText.includes(text))) {
				data.highlightColor = "#fff387";
			}
		}

		if (settings.relaydonos && data.hasDonation && data.chatname && data.type) {
			//if (Date.now() - messageTimeout > 100) {
				// respond to "1" with a "1" automatically; at most 1 time per 100ms.

				const messageText = data.textContent || data.chatmessage;
				if (messageText.includes(". Thank you") && messageText.includes(" donated ")) {
					return null;
				} // probably a reply

				//messageTimeout = Date.now();
				var msg = {};
				if (data.tid){
					msg.tid = data.tid;
				}
				if (tab) {
					msg.url = tab.url;
				}

				msg.response = sanitizeRelay(data.chatname, true, "Someone") + " on " + data.type + " donated " + sanitizeRelay(data.hasDonation, true) + ". Thank you";
				sendMessageToTabs(msg, true, null, false, false, 100);
			//}
		}
		

		if (settings.giphyKey && settings.giphyKey.textsetting && settings.giphy && data.chatmessage && data.chatmessage.indexOf("!giphy") != -1 && !data.contentimg) {
			var searchGif = data.chatmessage;
			searchGif = searchGif.replaceAll("!giphy", "").trim();
			if (searchGif) {
				var order = 0;
				if (settings.randomgif) {
					order = parseInt(Math.random() * 15);
				}
				var gurl = await fetch("https://api.giphy.com/v1/gifs/search?q=" + encodeURIComponent(searchGif) + "&api_key=" + settings.giphyKey.textsetting + "&limit=1&offset=" + order)
					.then(response => response.json())
					.then(response => {
						try {
							return response.data[0].images.downsized_large.url;
						} catch (e) {
							console.error(e);
							return false;
						}
					});
				if (gurl) {
					data.contentimg = gurl;
					if (settings.hidegiphytrigger) {
						data.chatmessage = "";
					}
				} else if (!data.hasDonation && !data.contentimg) {
					return false;
				}
			}
		} else if (settings.giphyKey && settings.giphyKey.textsetting && settings.giphy2 && data.chatmessage && data.chatmessage.indexOf("#") != -1 && !data.contentimg) {
			const messageText = data.textContent || data.chatmessage;
			var xx = messageText.split(" ");
			for (var i = 0; i < xx.length; i++) {
				var word = xx[i];
				if (!word.startsWith("#")) {
					continue;
				}
				word = word.replaceAll("#", " ").trim();
				if (word) {
					var order = 0;
					if (i + 1 < xx.length) {
						order = parseInt(xx[i + 1]) || 0;
					}

					if (settings.hidegiphytrigger) {
						if (messageText.includes("#" + word + " " + order)) {
							data.chatmessage = data.chatmessage.replace("#" + word + " " + order, "");
						} else if (messageText.includes("#" + word + " ")) {
							data.chatmessage = data.chatmessage.replace("#" + word + " ", "");
						} else {
							data.chatmessage = data.chatmessage.replace("#" + word, "");
						}
						data.chatmessage = data.chatmessage.trim();
					}

					if (settings.randomgif) {
						order = parseInt(Math.random() * 15);
					}
					var gurl = await fetch("https://api.giphy.com/v1/gifs/search?q=" + encodeURIComponent(word) + "&api_key=" + settings.giphyKey.textsetting + "&limit=1&offset=" + order)
						.then(response => response.json())
						.then(response => {
							try {
								return response.data[0].images.downsized_large.url;
							} catch (e) {
								return false;
							}
						});

					if (gurl) {
						data.contentimg = gurl;
						break;
					}

					if (!data.contentimg && !data.chatmessage && !data.hasDonation) {
						return false;
					}
				}
			}
			// curl "https://tenor.googleapis.com/v2/search?q=excited&key=&client_key=my_test_app&limit=8"
		} else if (settings.tenorKey && settings.tenorKey.textsetting && settings.tenor && data.chatmessage && data.chatmessage.indexOf("!tenor") != -1 && !data.contentimg) {
			var searchGif = data.chatmessage;
			searchGif = searchGif.replaceAll("!tenor", "").trim();
			if (searchGif) {
				var order = 1;
				if (settings.randomgif) {
					order = parseInt(Math.random() * 15) + 1;
				}
				var gurl = await fetch("https://tenor.googleapis.com/v2/search?media_filter=tinygif,tinywebp_transparent&q=" + encodeURIComponent(searchGif) + "&key=" + settings.tenorKey.textsetting + "&limit=" + order)
					.then(response => response.json())
					.then(response => {
						try {
							if (response.results.length < order - 1) {
								order = response.results.length;
							}
							if (response.results[order - 1].media_formats.tinywebp_transparent) {
								return response.results[order - 1].media_formats.tinywebp_transparent.url;
							} else if (response.results[order - 1].media_formats.tinygif) {
								return response.results[order - 1].media_formats.tinygif.url;
							} else {
								return false;
							}
						} catch (e) {
							console.error(e);
							return false;
						}
					});
				if (gurl) {
					data.contentimg = gurl;
					if (settings.hidegiphytrigger) {
						data.chatmessage = "";
					}
				} else if (!data.hasDonation && !data.contentimg) {
					return false;
				}
			}
		} else if (settings.tenorKey && settings.tenorKey.textsetting && settings.giphy2 && data.chatmessage && data.chatmessage.indexOf("##") != -1 && !data.contentimg) {
			var xx = data.chatmessage.split(" ");
			for (var i = 0; i < xx.length; i++) {
				var word = xx[i];
				if (!word.startsWith("##")) {
					continue;
				}
				word = word.trim();
				search_word = word.replace(/[-_]/g, " ");
				search_word = search_word.replace(/[^\w\s]/g, "");

				if (word) {
					var order = 1; // Start from 1
					if (i + 1 < xx.length) {
						order = parseInt(xx[i + 1]) || 1;
					}

					if (settings.hidegiphytrigger) {
						var re = new RegExp(word + " " + order, "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						re = new RegExp(word + " ", "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						re = new RegExp(word, "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						data.chatmessage = data.chatmessage.trim();
					}
					var skip = false;
					if (i + 1 < xx.length) {
						if (xx[i + 1] == order) {
							skip = true;
						}
					}
					if (!skip && settings.randomgif) {
						order = parseInt(Math.random() * 8) + 1; // Adjust for 1-based indexing and 8 stickers randomization, because less actual amount
					}
					if (order > 40) {
						order = 40;
					}
					var gurl = await fetch("https://tenor.googleapis.com/v2/search?&searchfilter=sticker&media_filter=tinygif,tinywebp_transparent&q=" + encodeURIComponent(search_word) + "&key=" + settings.tenorKey.textsetting + "&limit=" + order)
						.then(response => response.json())
						.then(response => {
							try {
								if (response.results.length < order - 1) {
									order = response.results.length;
								}
								if (response.results[order - 1].media_formats.tinywebp_transparent) {
									return response.results[order - 1].media_formats.tinywebp_transparent.url;
								} else if (response.results[order - 1].media_formats.tinygif) {
									return response.results[order - 1].media_formats.tinygif.url;
								} else {
									return false;
								}
							} catch (e) {
								console.error(e);
								return false;
							}
						});

					if (gurl) {
						data.contentimg = gurl;
						break;
					}

					if (!data.contentimg && !data.chatmessage && !data.hasDonation) {
						return false;
					}
				}
			}
		} else if (settings.tenorKey && settings.tenorKey.textsetting && settings.giphy2 && data.chatmessage && data.chatmessage.indexOf("#") != -1 && !data.contentimg) {
			var xx = data.chatmessage.split(" ");
			for (var i = 0; i < xx.length; i++) {
				var word = xx[i];
				if (!word.startsWith("#")) {
					continue;
				}
				word = word.trim();
				search_word = word.replace(/[-_]/g, " ");
				search_word = search_word.replace(/[^\w\s]/g, "");

				if (word) {
					var order = 1; // Start from 1
					if (i + 1 < xx.length) {
						order = parseInt(xx[i + 1]) || 1;
					}

					if (settings.hidegiphytrigger) {
						var re = new RegExp(word + " " + order, "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						re = new RegExp(word + " ", "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						re = new RegExp(word, "g");
						data.chatmessage = data.chatmessage.replace(re, "");
						data.chatmessage = data.chatmessage.trim();
					}
					var skip = false;
					if (i + 1 < xx.length) {
						if (xx[i + 1] == order) {
							skip = true;
						}
					}
					if (!skip && settings.randomgif) {
						order = parseInt(Math.random() * 15) + 1; // Adjust for 1-based indexing
					}
					if (order > 40) {
						order = 40;
					}
					var gurl = await fetch("https://tenor.googleapis.com/v2/search?media_filter=tinygif,tinywebp_transparent&q=" + encodeURIComponent(search_word) + "&key=" + settings.tenorKey.textsetting + "&limit=" + order)
						.then(response => response.json())
						.then(response => {
							try {
								if (response.results.length < order - 1) {
									order = response.results.length;
								}
								if (response.results[order - 1].media_formats.tinywebp_transparent) {
									return response.results[order - 1].media_formats.tinywebp_transparent.url;
								} else if (response.results[order - 1].media_formats.tinygif) {
									return response.results[order - 1].media_formats.tinygif.url;
								} else {
									return false;
								}
							} catch (e) {
								console.error(e);
								return false;
							}
						});

					if (gurl) {
						data.contentimg = gurl;
						break;
					}

					if (!data.contentimg && !data.chatmessage && !data.hasDonation) {
						return false;
					}
				}
			}
		}


	} catch (e) {
		console.error(e);
	}

	if (settings.addkarma) {
		try {
			if (!sentimentAnalysisLoaded) {
				loadSentimentAnalysis();
				data.karma = inferSentiment(data.chatmessage);
			} else {
				data.karma = inferSentiment(data.chatmessage);
			}
		} catch (e) {}
	}

	if (settings.comment_background) {
		if (!data.backgroundColor) {
			data.backgroundColor = settings.comment_background.textsetting;
		}
	}
	if (settings.comment_color) {
		if (!data.textColor) {
			data.textColor = settings.comment_color.textsetting;
		}
	}
	if (settings.name_background) {
		if (!data.backgroundNameColor) {
			data.backgroundNameColor = "background-color:" + settings.name_background.textsetting + ";";
		}
	}
	if (settings.name_color) {
		if (!data.textNameColor) {
			data.textNameColor = "color:" + settings.name_color.textsetting + ";";
		}
	}

	if (settings.defaultavatar) {
		if (settings.defaultavatar.textsetting && !data.chatimg) {
			data.chatimg = settings.defaultavatar.textsetting;
		}
	}

	try {
		// webhook for configured custom chat commands
		// 'chatevent', 'chatcommand', 'chatwebhook', 'chatcommandtimeout'
		const chatCommand = settings['chatCommand'] || [];
		for (const i of chatCommand) {
			if (data.chatmessage && settings["chatevent" + i] && settings["chatcommand" + i] && settings["chatwebhook" + i]) {
				let matches = false;
				if (settings.chatwebhookstrict && (data.chatmessage === settings["chatcommand" + i].textsetting)) {
					matches = true;
				} else if (!settings.chatwebhookstrict && (data.chatmessage.toLowerCase().startsWith(settings["chatcommand" + i].textsetting.toLowerCase()))) {
					matches = true;
				}
				
				if (matches) {
					const now = Date.now();
					const commandTimeout = settings["chatcommandtimeout" + i] ? parseInt(settings["chatcommandtimeout" + i].numbersetting) : 0; 
					
					// Check if enough time has passed since last execution
					if (!commandLastExecuted[i] || (now - commandLastExecuted[i] >= commandTimeout)) {
						// Update last execution time
						commandLastExecuted[i] = now;
						
						let URL = settings["chatwebhook" + i].textsetting;
						if (settings.chatwebhookpost) {
							if (!URL.startsWith("http")) {
								if (!URL.includes("://")) {
									URL = "https://" + URL;
								}
							}
							ajax(data, URL, "POST");
						} else {
							if (!URL.startsWith("http")) {
								if (!URL.includes("://")) {
									URL = "https://" + URL;
									fetch(URL).catch(console.error);
								} else {
									window.open(URL, "_blank");
								}
							} else {
								fetch(URL).catch(console.error);
							}
						}
					}
				}
			}
		}
	} catch (e) {
		console.error(e);
	}
	try {
		if (settings.hypemode) {
			processHype(data);
		}
	} catch (e) {
		console.error(e);
	}
	try {
		if (settings.waitlistmode) {
			processWaitlist(data);
		}
	} catch (e) {
		console.error(e);
	}
	try {
		
		if (settings.allowLLMSummary && data.chatmessage && data.chatmessage.startsWith("!summary")){
			if (settings.modLLMonly){
				if (data.mod){
					return await processSummary(data);
				}
			} else {
				return await processSummary(data);
			}
		}
		if (settings.ollamaCensorBot){
			try{
				if (settings.ollamaCensorBotBlockMode){
					let good = false;
					if (data.chatmessage && data.chatmessage.length <= 3) {
						// For very short messages, use the history-aware censoring
						//try {
							good = await censorMessageWithLLM(data); // # TODO: IMPROVE AND FIX.
							//good = await censorMessageWithHistory(data);
						//} catch(e){
						//	good = await censorMessageWithLLM(data);
						//}
					} else {
						// For longer messages, use the existing single-message censoring
						good = await censorMessageWithLLM(data);
					}					
					
					if (!good){
						return false;
					}
				} else {
					censorMessageWithLLM(data);
				}
			} catch(e){
				console.log(e); // ai.js file missing?
			}
		}
		if (settings.ollama){
			try{
				if (settings.modLLMonly){
					if (data.mod){
						processMessageWithOllama(data);
					}
				} else {
					processMessageWithOllama(data);
				}
			} catch(e){
				console.log(e); // ai.js file missing?
			}
		}
		
		if (settings.customJsEnabled){
			data = customUserFunction(data);
		}
		
	} catch (e) {
		console.error(e);
	}
	
	return data;
}

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function ensureFunction(functionName, scriptUrl) {
    if (typeof window[functionName] === 'function') {
        return Promise.resolve();
    }
    
    return loadScript(scriptUrl).then(() => {
        if (typeof window[functionName] !== 'function') {
            throw new Error(`Function ${functionName} not found after loading script`);
        }
    });
}


function decodeAndCleanHtml(input, spaces=false) {
    var doc = new DOMParser().parseFromString(input, 'text/html');
    doc.querySelectorAll('img[alt]').forEach(img => {
        var alt = img.getAttribute('alt');
        img.parentNode.replaceChild(doc.createTextNode(alt), img);
    });
	if (spaces){
		doc.querySelectorAll('br').forEach(br => {
			br.replaceWith(doc.createTextNode('\n'));
		});
	}
    var decodedInput = doc.body.textContent || "";
    return decodedInput.replace(/\s\s+/g, " ").trim();
}

var store = [];

var MidiInit = false;

try {
	function setupMIDI(MidiInput = false) {
		// setting up MIDI hotkey support.
		var midiChannel = 1;
		if (MidiInput) {
			MidiInput.addListener("controlchange", function (e) {
				midiHotkeysCommand(e.controller.number, e.rawValue);
			});

			MidiInput.addListener("noteon", function (e) {
				var note = e.note.name + e.note.octave;
				var velocity = e.velocity || false;
				midiHotkeysNote(note, velocity);
			});
		} else {
			for (var i = 0; i < WebMidi.inputs.length; i++) {
				MidiInput = WebMidi.inputs[i];

				MidiInput.addListener("controlchange", function (e) {
					if (settings.midi && isExtensionOn) {
						midiHotkeysCommand(e.controller.number, e.rawValue);
					}
				});

				MidiInput.addListener("noteon", function (e) {
					if (settings.midi && isExtensionOn) {
						var note = e.note.name + e.note.octave;
						var velocity = e.velocity || false;
						midiHotkeysNote(note, velocity);
					}
				});
			}
		}
	}

	function toggleMidi() {
		if (!("midi" in settings)) {
			return;
		}
		if (settings.midi) {
			if (MidiInit === false) {
				MidiInit = true;

				WebMidi.enable().then(() => {
					setupMIDI();
					WebMidi.addListener("connected", function (e) {
						setupMIDI(e.target._midiInput);
					});
					WebMidi.addListener("disconnected", function (e) {});
					// Your MIDI outputs are now ready for triggering
				});
			} else {
				try {
					WebMidi.enable();
				} catch (e) {}
			}
		} else if (MidiInit) {
			try {
				WebMidi.disable();
			} catch (e) {}
		}
	}
} catch (e) {
	log(e);
}

function triggerMidiNote(note = 64, device=false) {
    if (!WebMidi.enabled) {
		try {
			WebMidi.enable();
			console.log("Midi enabled");
		} catch (e) {
			console.warn(e);
		}
	}
    try {
		if (settings.midiDeviceSelect?.optionsetting || device){
			const selectedOutput = WebMidi.outputs.find(
				(output) => output.name === (device || settings.midiDeviceSelect.optionsetting)
			);
			if (selectedOutput) {
				selectedOutput.send([0x90, note, 127]);  // Note On
				selectedOutput.send([0x80, note, 0]);    // Note Off
			} else {
				console.warn("MIDI device not found: "+(device || settings.midiDeviceSelect.optionsetting));
			}
		} else {
			WebMidi.outputs.forEach(output => {
				//output.playNote(note);
				output.send([0x90, note, 127]);  // Note On
				output.send([0x80, note, 0]);    // Note Off
			});
		}
	} catch(e){
		console.warn(e);
	}
}

function midiHotkeysCommand(number, value) {
	// MIDI control change commands
	if (number == 102 && value == 1) {
		respondToAll("1");
	} else if (number == 102 && value == 2) {
		respondToAll("LUL");
	} else if (number == 102 && value == 3) {
		tellAJoke();
	} else if (number == 102 && value == 4) {
		var msg = {};
		msg.forward = false; // clears our featured chat overlay
		sendDataP2P(msg);
	} else if (number == 102 && value == 5) {
        selectRandomWaitlist();
	} else if (number == 102) {
		if (settings.midiConfig && value + "" in settings.midiConfig) {
			var msg = settings.midiConfig[value + ""];
			respondToAll(msg);
		}
	}
}

function respondToAll(msg, timeout=false) {
	//messageTimeout = Date.now();
	var data = {};
	data.response = msg;
	sendMessageToTabs(data, false, null, false, false, timeout);
	//sendMessageToTabs(data);
}

function midiHotkeysNote(note, velocity) {
	// In case you want to use NOTES instead of Control Change commands; like if you have a MIDI piano
}

function tellAJoke() { 
	var score = parseInt(Math.random() * 378);
	var joke = jokes[score];
	//messageTimeout = Date.now();
	var data = {};
	data.response = joke["setup"] + "..  " + joke["punchline"] + " LUL";
	//sendMessageToTabs(data);
	sendMessageToTabs(data, false, null, false, false, false);
}

if (chrome.browserAction && chrome.browserAction.setIcon){
	chrome.browserAction.setIcon({ path: "/icons/off.png" });
}
if (chrome.action && chrome.action.setIcon){
	chrome.action.setIcon({ path: "/icons/off.png" });
}

async function fetchData(url, useLocalFs = false) {
  try {
    // Use local file system if explicitly requested or if in Electron and path is local
    if ((useLocalFs || (isSSAPP && !url.startsWith('http'))) && isSSAPP) {
      const fs = require('fs');
      const path = require('path');
      
      try {
        const filePath = path.join(__dirname, url);
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      } catch (fsError) {
        return false;
      }
    } else {
      // Use standard fetch for remote resources or when local access not requested
      const response = await fetch(url);
      if (!response.ok) {
        return false;
      }
      return await response.json();
    }
  } catch (error) {
    return false;
  }
}

// Example usage in window.onload:
window.onload = async function () {
	// Pass true as second parameter to force local file system in Electron
	let programmedSettings = await fetchData("settings.json", true);
	if (programmedSettings && typeof programmedSettings === "object") {
		log("Loading override settings via settings.json");
		loadSettings(programmedSettings, true);
    } else {
        log("Loading settings from the main file into the background.js");
        chrome.storage.sync.get(properties, function (item) {
            if (isSSAPP && item) {
                loadSettings(item, false); 
                
                // Initialize file handles after settings are loaded
                initializeFileHandles();
                return;
            }
            
            if (item?.settings) {
                alert("upgrading from old storage structure format to new...");
                chrome.storage.sync.remove(["settings"], function (Items) {
                    log("upgrading from sync to local storage");
                });
                chrome.storage.local.get(["settings"], function (item2) {
                    if (item2?.settings){
                        item = [...item, ...item2];
                    }
                    if (item?.settings){
                        chrome.storage.local.set({
                            settings: item.settings
                        });
                    }
                    if (item){
                        loadSettings(item, false);
                        
                        // Initialize file handles after settings are loaded
                        if (isSSAPP) {
                            initializeFileHandles();
                        }
                    }
                });
                
            } else {
                loadSettings(item, false);
                chrome.storage.local.get(["settings"], function (item2) {
                    if (item2){
                        loadSettings(item2, false);
                        
                        // Initialize file handles after settings are loaded
                        if (isSSAPP) {
                            initializeFileHandles();
                        }
                    }
                });
            }
        });
    }
};

let fileHandleTicker;
let fileContentTicker = "";
let fileSizeTicker = 0;
let monitorInterval = null;

async function selectTickerFile() {
    fileHandleTicker = await window.showOpenFilePicker({
        types: [{
            description: 'Text Files',
            accept: {'text/plain': ['.txt']},
        }],
    });
    
    if (!isSSAPP) {
        fileHandleTicker = fileHandleTicker[0];
    } else if (typeof fileHandleTicker === "string") {
        // Store file path when isSSAPP is true
        localStorage.setItem("tickerFilePath", fileHandleTicker);
    }
     
    try {
        await loadFileTicker();
    } catch(e){}
}
async function initializeFileHandles() {
    if (!isSSAPP) return;
    
    // Restore main file handle
    const savedFilePath = localStorage.getItem("savedFilePath");
    if (savedFilePath) {
        newFileHandle = savedFilePath;
    }
    
    // Restore saved names file handle
    const savedNamesFilePath = localStorage.getItem("savedNamesFilePath");
    if (savedNamesFilePath) {
        newSavedNamesFileHandle = savedNamesFilePath;
        try {
            // Load the existing names
            const data = await ipcRenderer.invoke("read-from-file", savedNamesFilePath);
            if (data) {
                uniqueNameSet = data.split("\r\n").filter(name => name.trim() !== "");
            }
        } catch(e) {
            console.warn("Could not load saved names file:", e);
        }
    }
    
    // Restore ticker file handle
    const tickerFilePath = localStorage.getItem("tickerFilePath");
    if (tickerFilePath && settings.ticker) {
        fileHandleTicker = tickerFilePath;
        try {
            await loadFileTicker();
        } catch(e) {
            console.warn("Could not load ticker file:", e);
        }
    }
}

function processTicker(){ 
	if (fileContentTicker && settings.ticker){
		sendTickerP2P([fileContentTicker]);
	} else {
		sendTickerP2P([]);
	}
}

async function loadFileTicker(file=null) {
	if (!settings.ticker) {
		clearInterval(monitorInterval);
		if (fileContentTicker){
			fileContentTicker = "";
			sendTickerP2P([]);
		}
		return;
	}
	if (fileHandleTicker) {
		if (!isSSAPP){
			if (!file){
				file = await fileHandleTicker.getFile();
			}
			fileContentTicker = await file.text();
		} else {
			fileContentTicker = fileHandleTicker;
		}
		sendTickerP2P([fileContentTicker]);
		fileSizeTicker = file.size;
		if (!isSSAPP){
			monitorFileChanges();
		}
	} else {
		selectTickerFile();
	}
}

function monitorFileChanges() {
	clearInterval(monitorInterval);
	monitorInterval = setInterval(async () => {
		if (fileHandleTicker) {
			const newFile = await fileHandleTicker.getFile();
			if (newFile.size !== fileSizeTicker) {
				fileSizeTicker = newFile.size;
				try {
					await loadFileTicker(newFile);
				} catch(e){}
			}
		}
	}, 1000); // Check for changes every second
}
// Add this variable at the top of your script file, outside any functions
let lastRandomTestMessageData = null;

async function triggerFakeRandomMessage(){
	var data = {};
	let attempts = 0;
	const maxAttempts = 5;
	
	// Keep generating new messages until we get one that's different from the last one
	// or until we've tried a reasonable number of times
	do {
		data = {};
		data.chatname = "John Doe";
		data.nameColor = "";
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = "Looking good! 😘😘😊  This is a test message. 🎶🎵🎵🔨 ";
		data.chatimg = "";
		data.type = "youtube";
		
		if (Math.random() > 0.9) {
			data.hasDonation = "2500 gold";
			data.membership = "";
			data.chatname = "Bob";
			data.chatbadges = [];
			var html = {};
			html.html = '<svg viewBox="0 0 16 16" preserveAspectRatio="xMidYMid meet" focusable="false" class="style-scope yt-icon" style="pointer-events: none; display: block; width: 100%; height: 100%; fill: rgb(95, 132, 241);"><g class="style-scope yt-icon"><path d="M9.64589146,7.05569719 C9.83346524,6.562372 9.93617022,6.02722257 9.93617022,5.46808511 C9.93617022,3.00042984 7.93574038,1 5.46808511,1 C4.90894765,1 4.37379823,1.10270499 3.88047304,1.29027875 L6.95744681,4.36725249 L4.36725255,6.95744681 L1.29027875,3.88047305 C1.10270498,4.37379824 1,4.90894766 1,5.46808511 C1,7.93574038 3.00042984,9.93617022 5.46808511,9.93617022 C6.02722256,9.93617022 6.56237198,9.83346524 7.05569716,9.64589147 L12.4098057,15 L15,12.4098057 L9.64589146,7.05569719 Z" class="style-scope yt-icon"></path></g></svg>';
			html.type = "svg";
			data.chatbadges.push(html);
		} else if (Math.random() > 0.8 ){
			data.hasDonation = "3 hearts";
			data.membership = "";
			data.chatmessage = "";
			data.chatimg = parseInt(Math.random() * 2) ? "" : "https://static-cdn.jtvnw.net/jtv_user_pictures/52f459a5-7f13-4430-8684-b6b43d1e6bba-profile_image-50x50.png";
			data.chatname = "Lucy";
			data.type = "youtubeshorts";
		} else if (Math.random() > 0.7) {
			data.hasDonation = "";
			data.membership = "";
			data.chatimg = "https://static-cdn.jtvnw.net/jtv_user_pictures/52f459a5-7f13-4430-8684-b6b43d1e6bba-profile_image-50x50.png";
			data.chatname = "vdoninja";
			data.type = "twitch";
			data.event = "test";
			var score = parseInt(Math.random() * 378);
			data.chatmessage = jokes[score]["setup"] + "..  " + jokes[score]["punchline"] + " 😊";
		} else if (Math.random() > 0.6) {
			data.hasDonation = "";
			data.membership = "";
			data.chatimg = "https://socialstream.ninja/media/sampleavatar.png";
			data.chatname = "Steve";
			
			data.vip = true;
			var score = parseInt(Math.random() * 378);
			data.chatmessage = '<img src="https://github.com/steveseguin/social_stream/raw/main/icons/icon-128.png">😁 🇨🇦 https://vdo.ninja/';
		} else if (Math.random() > 0.5) {
			data.hasDonation = "";
			data.nameColor = "#107516";
			data.membership = "SPONSORSHIP";
			data.chatimg = parseInt(Math.random() * 2) ? "" : "https://socialstream.ninja/media/sampleavatar.png";
			data.chatname = "Steve_" + randomDigits();
			data.type = parseInt(Math.random() * 2) ? "slack" : "facebook";
			data.chatmessage = "!join The only way 2 do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle. As with all matters of the heart, you'll know when you find it.";
		} else if (Math.random() > 0.4) {
			data.hasDonation = "";
			data.highlightColor = "pink";
			data.nameColor = "lightblue";
			data.chatname = "NewGuest";
			data.type = "twitch";
			data.chatmessage = "hi";
			data.chatbadges = ["https://vdo.ninja/media/icon.png","https://yt4.ggpht.com/ytc/AL5GRJVWK__Edij5fA9Gh-aD7wSBCe_zZOI4jjZ1RQ=s32-c-k-c0x00ffffff-no-rj","https://socialstream.ninja/icons/announcement.png"];
		} else if (Math.random() > 0.30) {
			data.membership = "Coffee Addiction";
			data.hasDonation = "";
			data.subtitle = "32 Years";
			data.highlightColor = "pink";
			data.nameColor = "";
			data.private = true;
			data.chatname = "Sir Drinks-a-lot";
			data.type = "discord";
			data.chatmessage = "☕☕☕ COFFEE!";
			data.chatbadges = ["https://socialstream.ninja/icons/bot.png","https://socialstream.ninja/icons/announcement.png"];
		} else if (Math.random() > 0.2) {
			data.hasDonation = "";
			data.membership = "";
			data.chatmessage = "";
			data.contentimg = "https://socialstream.ninja/media/logo.png";
			data.chatname = "User123";
			data.chatimg = "https://socialstream.ninja/media/user1.jpg";
			data.type = "youtube";
		} else if (Math.random() > 0.1) {
			data.hasDonation = "";
			data.membership = "";
			data.question = true;
			data.chatmessage = "Is this a test question?  🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓🤓";
			data.chatname = "Nich Lass";
			data.chatimg = "https://yt4.ggpht.com/ytc/AL5GRJVWK__Edij5fA9Gh-aD7wSBCe_zZOI4jjZ1RQ=s32-c-k-c0x00ffffff-no-rj";
			data.type = "zoom";
		} else {
			data.hasDonation = "";
			data.membership = "SPONSORSHIP";
		}
		
		attempts++;
	} while (isEqualMessage(data, lastRandomTestMessageData) && attempts < maxAttempts);


	data = await applyBotActions(data); // perform any immediate (custom) actions, including modifying the message before sending it out
	if (!data) {
		return response;
	}
	
	try {
		data = await window.eventFlowSystem.processMessage(data); // perform any immediate actions
	} catch (e) {
		console.warn(e);
	}
	if (!data) {
		return response;
	}
	
	lastRandomTestMessageData = JSON.parse(JSON.stringify(data)); // Store a deep copy of the current message
	sendToDestinations(data);
}

// Helper function to compare if two messages are effectively the same
function isEqualMessage(message1, message2) {
	if (!message1 || !message2) return false;
	
	// Compare the key properties that would make messages look the same
	return message1.chatname === message2.chatname &&
		   message1.chatmessage === message2.chatmessage &&
		   message1.chatimg === message2.chatimg &&
		   message1.type === message2.type &&
		   message1.hasDonation === message2.hasDonation &&
		   message1.membership === message2.membership;
}

// Expose functions to window for EventFlowSystem
window.sendMessageToTabs = sendMessageToTabs;
window.sendToDestinations = sendToDestinations;
window.fetchWithTimeout = fetchWithTimeout;
window.sanitizeRelay = sanitizeRelay;
window.checkExactDuplicateAlreadyRelayed = checkExactDuplicateAlreadyRelayed;

console.log('[EventFlow Init] Checking sendMessageToTabs function:', typeof window.sendMessageToTabs, window.sendMessageToTabs ? window.sendMessageToTabs.toString().substring(0, 100) : 'null');
console.log('[EventFlow Init] Checking sanitizeRelay function:', typeof window.sanitizeRelay);
console.log('[EventFlow Init] Checking checkExactDuplicateAlreadyRelayed function:', typeof window.checkExactDuplicateAlreadyRelayed);

let tmp = new EventFlowSystem({
	sendMessageToTabs: window.sendMessageToTabs || null,
	sendToDestinations: window.sendToDestinations || null,
	pointsSystem: window.pointsSystem || null,
	fetchWithTimeout: window.fetchWithTimeout || null, // Assuming fetchWithTimeout is on window from background.js
	sanitizeRelay: window.sanitizeRelay || null,
	checkExactDuplicateAlreadyRelayed: window.checkExactDuplicateAlreadyRelayed || null,
});


tmp.initPromise.then(() => {
	window.eventFlowSystem = tmp;
	console.log('[EventFlow Init] EventFlowSystem initialized successfully');
	console.log('[EventFlow Init] sendMessageToTabs in system:', typeof tmp.sendMessageToTabs, tmp.sendMessageToTabs ? 'Function present' : 'Function missing');
}).catch(error => {
	console.error('Failed to initialize Event Flow System for Social Stream Ninja:', error);
});

window.addEventListener('beforeunload', async function() {
  document.title = "Close me - Social Stream Ninja";
});

window.addEventListener('unload', async function() {
  document.title = "Close me - Social Stream Ninja";
});
