// popup.js

var isExtensionOn = false;
var ssapp = false;
var usernames = [];

function log(msg,a,b){
	console.log(msg,a,b);
}

if (typeof(chrome.runtime)=='undefined'){
	
	chrome = {};
	chrome.browserAction = {};
	chrome.browserAction.setIcon = function(icon){}
	chrome.runtime = {}
	chrome.runtime.id = 1;
	
	log("pop up started");
	
	if (typeof require !== "undefined"){
		var { ipcRenderer, contextBridge } = require("electron");
		
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
	
	chrome.runtime.sendMessage = async function(data, callback){ // every single response, is either nothing, or update()
		let response = await ipcRenderer.sendSync('fromPopup',data);
		if (typeof(callback) == "function"){
			callback(response);
		}
	};
	chrome.runtime.getManifest = function(){
		return false; // I'll need to add version info eventually
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
}


function copyToClipboard(event) {
	console.log(event);
   
	if (event.target.parentNode.parentNode.querySelector("[data-raw] a[href]")){
		navigator.clipboard.writeText(event.target.parentNode.querySelector("[data-raw] a[href]").href).then(function() {
			console.log('Link copied to clipboard!');
			event.target.classList.add("flashing");
			setTimeout(()=>{
				event.target.classList.remove("flashing");
			},500);
		}, function(err) {
			console.error('Could not copy text: ', err);
		});
	} else if (event.target.parentNode.parentNode.parentNode.querySelector("[data-raw] a[href]")){
		navigator.clipboard.writeText(event.target.parentNode.parentNode.parentNode.querySelector("[data-raw] a[href]").href).then(function() {
			console.log('Link copied to clipboard!');
			event.target.classList.add("flashing");
			setTimeout(()=>{
				event.target.classList.remove("flashing");
			},500);
		}, function(err) {
			console.error('Could not copy text: ', err);
		});
	} else if (event.target.parentNode.parentNode.parentNode.parentNode.querySelector("[data-raw] a[href]")){
		navigator.clipboard.writeText(event.target.parentNode.parentNode.parentNode.parentNode.querySelector("[data-raw] a[href]").href).then(function() {
			console.log('Link copied to clipboard!');
			event.target.classList.add("flashing");
			setTimeout(()=>{
				event.target.classList.remove("flashing");
			},500);
		}, function(err) {
			console.error('Could not copy text: ', err);
		});
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
			var key = ele2.placeholder.toLowerCase().replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/[\n\t\r]/g, '').trim().replaceAll(" ","-");;
			if (key in translation.placeholders) {
				ele2.placeholder = translation.placeholders[key];
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

function populateFontDropdown() {
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
}

function createUniqueVoiceIdentifiers(voices) {
    let uniqueIdentifiersByLang = {};

    // Group voices by language
    voices.forEach(voiceObj => {
        if (!uniqueIdentifiersByLang[voiceObj.lang]) {
            uniqueIdentifiersByLang[voiceObj.lang] = [];
        }
        uniqueIdentifiersByLang[voiceObj.lang].push(voiceObj);
    });

    // Find unique identifiers within each language group
    for (let lang in uniqueIdentifiersByLang) {
        let voicesInLang = uniqueIdentifiersByLang[lang];

        voicesInLang.forEach(voiceObj => {
            const words = voiceObj.name.split(' ');
            for (let i = 0; i < words.length; i++) {
                let potentialIdentifier = words[i];
                if (voicesInLang.filter(v => v.name.includes(potentialIdentifier)).length === 1) {
                    voiceObj.code = `${lang}&voice=${potentialIdentifier}`;
                    return;
                }
            }
            // Fallback if no unique word is found
            voiceObj.code = lang+"&voice="+`${voiceObj.name.replace(/[^a-zA-Z0-9]/g, '')}`;
        });
    }


	var voicesOutput = [];
	for (var voice in uniqueIdentifiersByLang){
		uniqueIdentifiersByLang[voice].forEach(v=>{
			voicesOutput.push(v);
		});
	}
    return voicesOutput;
}

document.addEventListener("DOMContentLoaded", async function(event) {
	if (ssapp){
		document.getElementById("disableButtonText").innerHTML = "🔌 Services Loading";
	} else {
		document.getElementById("disableButtonText").innerHTML = "🔌 Extension Loading";
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
		document.getElementById('usernameList').addEventListener('click', (e) => {
			if (e.target.classList.contains('remove-username')) {
				removeUsername(e.target.dataset.username);
			}
		});

		document.getElementById('addUsername').addEventListener('click', () => {
			const newUsernameInput = document.getElementById('newUsername');
			const newUsername = newUsernameInput.value.trim();
			if (newUsername) {
				addUsername(newUsername);
				newUsernameInput.value = '';
			}
		});
	} catch(e){
		console.error(e);
	}
	
	
	populateFontDropdown();
	
	PollManager.init();
	
	// populate language drop down
	if (speechSynthesis){
		function populateVoices() {
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
			
			var voicesDropdown = document.getElementById('languageSelect1');
			var existingOptions = Array.from(voicesDropdown.options).map(option => option.textContent);

			voices.forEach(voice => {
				const voiceText = voice.name + ' (' + voice.lang + ')';

				if (!existingOptions.includes(voiceText)) {
					const option = document.createElement('option');
					option.textContent = voiceText;
					option.value = voice.code;
					option.setAttribute('data-lang', voice.lang);
					option.setAttribute('data-name', voice.name);
					voicesDropdown.appendChild(option);
				}
			});
			
			var voicesDropdown = document.getElementById('languageSelect2');
			var existingOptions = Array.from(voicesDropdown.options).map(option => option.textContent);

			voices.forEach(voice => {
				const voiceText = voice.name + ' (' + voice.lang + ')';

				if (!existingOptions.includes(voiceText)) {
					const option = document.createElement('option');
					option.textContent = voiceText;
					option.value = voice.code;
					option.setAttribute('data-lang', voice.lang);
					option.setAttribute('data-name', voice.name);
					voicesDropdown.appendChild(option);
				}
			});
			
			try {
				TTSManager.init(voices)
			} catch(e){
				console.error(e);
			}
			
		}
		speechSynthesis.onvoiceschanged = populateVoices;
		
		document.getElementById('searchInput').addEventListener('keyup', function() {
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
						if (item.querySelector("[title]")){
							text += " " + item.querySelector("[title]").title.toLowerCase();
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
			searchInput.style.width = 'calc(100% - 29px)'; // Match this with your CSS width
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

	
	for (var i=1;i<=20;i++){
		var chat = document.createElement("div");
		chat.innerHTML = '<label class="switch" style="vertical-align: top; margin: 26px 0 0 0">\
				<input type="checkbox" data-setting="chatevent'+ i +'">\
				<span class="slider round"></span>\
			</label>\
			<div style="display:inline-block">\
				<div class="textInputContainer" style="width: 235px">\
					<input type="text" id="chatcommand'+ i +'" class="textInput" autocomplete="off" placeholder="!someevent'+ i +'" data-textsetting="chatcommand'+ i +'">\
					<label for="chatcommand'+ i +'">&gt; Chat Command</label>\
				</div>\
				<div class="textInputContainer" style="width: 235px">\
					<input type="text" id="chatwebhook'+ i +'" class="textInput" autocomplete="off" placeholder="Provide full URL" data-textsetting="chatwebhook'+ i +'">\
					<label for="chatwebhook'+ i +'">&gt; Webhook URL</label>\
				</div>\
			</div>';
		document.getElementById("chatCommands").appendChild(chat);
	}
	

	for (var i=1;i<=10;i++){
		var chat = document.createElement("div");
		chat.innerHTML = '<label class="switch" style="vertical-align: top; margin: 26px 0 0 0">\
				<input type="checkbox" data-setting="timemessageevent'+ i +'">\
				<span class="slider round"></span>\
			</label>\
			<div style="display:inline-block">\
				<div class="textInputContainer" style="width: 235px">\
					<input type="text" id="timemessagecommand'+ i +'" maxlength="200" class="textInput" autocomplete="off" placeholder="Message to send to chat at an interval" data-textsetting="timemessagecommand'+ i +'">\
					<label for="timemessagecommand'+ i +'">&gt; Message to broadcast</label>\
				</div>\
				<div class="textInputContainer" style="width: 235px">\
					<input type="number" id="timemessageinterval'+ i +'" class="textInput" value="15" min="0"  autocomplete="off" title="Interval offset in minutes; 0 to issue just once." data-numbersetting="timemessageinterval'+ i +'">\
					<label for="timemessageinterval'+ i +'">&gt; Interval between broadcasts in minutes</label>\
				</div>\
				<div class="textInputContainer" style="width: 235px">\
					<input type="number" id="timemessageoffset'+ i +'" value="0" min="0" class="textInput" autocomplete="off" title="Starting offset in minutes" data-numbersetting="timemessageoffset'+ i +'">\
					<label for="timemessageoffset'+ i +'">&gt; Starting time offset</label>\
				</div>\
			</div>';
		document.getElementById("timedMessages").appendChild(chat);
	}
	
	for (var i=1;i<=10;i++){
		var chat = document.createElement("div");
		chat.innerHTML = '<label class="switch" style="vertical-align: top; margin: 26px 0 0 0">\
				<input type="checkbox" data-setting="botReplyMessageEvent'+ i +'">\
				<span class="slider round"></span>\
			</label>\
			<div style="display:inline-block">\
				<div class="textInputContainer" style="width: 235px">\
					<input type="text" id="botReplyMessageCommand'+ i +'" maxlength="200" class="textInput" autocomplete="off" placeholder="Triggering command" data-textsetting="botReplyMessageCommand'+ i +'">\
					<label for="botReplyMessageCommand'+ i +'">&gt; Triggering command. eg: !discord</label>\
				</div>\
				<div class="textInputContainer" style="width: 235px">\
					<input type="text" id="botReplyMessageValue'+ i +'" maxlength="200" class="textInput" autocomplete="off" placeholder="Message to respond with" data-textsetting="botReplyMessageValue'+ i +'">\
					<label for="botReplyMessageValue'+ i +'">&gt; Message to respond with.</label>\
				</div>\
				<div class="textInputContainer" style="width: 235px">\
					<input type="number" id="botReplyMessageTimeout'+ i +'" class="textInput" min="0" autocomplete="off" placeholder="Timeout needed between responses" data-numbersetting="botReplyMessageTimeout'+ i +'">\
					<label for="botReplyMessageTimeout'+ i +'">&gt; Trigger timeout (ms)</label>\
				</div>\
				<div class="textInputContainer" style="width: 235px" title="If a source is provided, limit the response to this source. Comma-separated" >\
					<input type="text" id="botReplyMessageSource'+ i +'" class="textInput" min="0" autocomplete="off" placeholder="ie: youtube,twitch (comma separated)" data-textsetting="botReplyMessageSource'+ i +'">\
					<label for="botReplyMessageSource'+ i +'">&gt; Limit to specific sites</label>\
				</div>\
				<span data-translate="reply-to-all">\
					Reply to all instead of just the source\
				</span>\
				<label class="switch">\
					<input type="checkbox" data-setting="botReplyAll'+ i +'">\
					<span class="slider round"></span>\
				</label>\
			</div>';
		document.getElementById("botReplyMessages").appendChild(chat);
	}
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
				console.log(msg);
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
});
var streamID = false;
function update(response, sync=true){
	log("update-> response: ",response);
	if (response !== undefined){
		
		if (response.documents){
			updateDocumentList(response.documents);
		}
		
		if (response.streamID){
			streamID = true;
			var password = "";
			if ('password' in response && response.password){
				password = "&password="+response.password;
			}
			
			var baseURL = "https://socialstream.ninja/";
			if (devmode){
				baseURL = "file:///C:/Users/steve/Code/social_stream/";
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
			
			
			document.getElementById("sessionid").value = response.streamID;
			document.getElementById("sessionpassword").value = response.password || "";
			
			document.getElementById("dock").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='docklink' href='"+baseURL+"dock.html?session="+response.streamID+password+"'>"+baseURL+"dock.html?session="+response.streamID+password+"</a>";
			document.getElementById("dock").raw = baseURL+"dock.html?session="+response.streamID+password;

			document.getElementById("overlay").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='overlaylink' href='"+baseURL+"featured.html?session="+response.streamID+password+"'>"+baseURL+"featured.html?session="+response.streamID+password+"</a>";
			document.getElementById("overlay").raw = baseURL+"featured.html?session="+response.streamID+password;

			document.getElementById("emoteswall").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='emoteswalllink' href='"+baseURL+"emotes.html?session="+response.streamID+password+"'>"+baseURL+"emotes.html?session="+response.streamID+password+"</a>";
			document.getElementById("emoteswall").raw = baseURL+"emotes.html?session="+response.streamID+password;
			
			document.getElementById("hypemeter").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='hypemeterlink' href='"+baseURL+"hype.html?session="+response.streamID+password+"'>"+baseURL+"hype.html?session="+response.streamID+password+"</a>";
			document.getElementById("hypemeter").raw = baseURL+"hype.html?session="+response.streamID+password;
			
			document.getElementById("waitlist").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='waitlistlink' href='"+baseURL+"waitlist.html?session="+response.streamID+password+"'>"+baseURL+"waitlist.html?session="+response.streamID+password+"</a>";
			document.getElementById("waitlist").raw = baseURL+"waitlist.html?session="+response.streamID+password;
			
			document.getElementById("ticker").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='tickerlink' href='"+baseURL+"ticker.html?session="+response.streamID+password+"'>"+baseURL+"ticker.html?session="+response.streamID+password+"</a>";
			document.getElementById("ticker").raw = baseURL+"ticker.html?session="+response.streamID+password;
			
			document.getElementById("wordcloud").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='wordcloudlink' href='"+baseURL+"wordcloud.html?session="+response.streamID+password+"'>"+baseURL+"wordcloud.html?session="+response.streamID+password+"</a>";
			document.getElementById("wordcloud").raw = baseURL+"wordcloud.html?session="+response.streamID+password;
			
			document.getElementById("poll").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='polllink' href='"+baseURL+"poll.html?session="+response.streamID+password+"'>"+baseURL+"poll.html?session="+response.streamID+password+"</a>";
			document.getElementById("poll").raw = baseURL+"poll.html?session="+response.streamID+password;
			
			document.getElementById("battle").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='battlelink' href='"+baseURL+"battle.html?session="+response.streamID+password+"'>"+baseURL+"battle.html?session="+response.streamID+password+"</a>";
			document.getElementById("battle").raw = baseURL+"battle.html?session="+response.streamID+password;
			
			document.getElementById("chatbotlink").outerHTML = "<a target='_blank' style='color:lightblue;' id='chatbotlink' href='"+baseURL+"chatbot.html?session="+response.streamID+password+"'>[LINK TO CHAT BOT]</a>";
			
			document.getElementById("custom-gif-commands").innerHTML = hideLinks ? "Click to open link" : "<a target='_blank' id='custom-gif-commands-link' href='"+baseURL+"gif.html?session="+response.streamID+password+"'>"+baseURL+"gif.html?session="+response.streamID+password+"</a>";
			document.getElementById("custom-gif-commands").raw = baseURL+"gif.html?session="+response.streamID+password;
			
			document.getElementById("remote_control_url").href = "https://socialstream.ninja/sampleapi.html?session="+response.streamID+password;
			
			document.getElementById("botlink").href = "https://socialstream.ninja/bot.html?session="+response.streamID+password;
			
		
			hideLinks = false;
			
			if ('settings' in response){
				for (var key in response.settings){
					try {
						if (key === "midiConfig"){
							if (response.settings[key]){
								document.getElementById("midiConfig").classList.add("pressed");
								document.getElementById("midiConfig").innerText = " Config Loaded";
							} else {
								document.getElementById("midiConfig").classList.remove("pressed");
								document.getElementById("midiConfig").innerText = " Load Config";
							}
						}
						if (typeof response.settings[key] == "object"){ // newer method
							if ("param1" in response.settings[key]){
								var ele = document.querySelector("input[data-param1='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].param1;
									if (!key.includes("=")){
										if ("numbersetting" in response.settings[key]){
											updateSettings(ele, sync, parseFloat(response.settings[key].numbersetting));
										} else if (document.querySelector("input[data-numbersetting='"+key+"']")){
											updateSettings(ele, sync, parseFloat(document.querySelector("input[data-numbersetting='"+key+"']").value));
										} else {
											updateSettings(ele, sync); 
										}
									} else {
										updateSettings(ele, sync);
									}
								} else if (key.includes("=")){
									var keys = key.split('=');
									ele = document.querySelector("input[data-param1='"+keys[0]+"']");
									if (ele){
										ele.checked = response.settings[key].param1;
										if (keys[1]){
											var ele2 = document.querySelector("input[data-numbersetting='"+keys[0]+"']");
											if (ele2){
												ele2.value = parseFloat(keys[1], keys[1]);
											}
											updateSettings(ele, sync, parseFloat(keys[1]));
										} else{
											updateSettings(ele, sync);
										}
									}
								}
							}
							if ("param2" in response.settings[key]){
								var ele = document.querySelector("input[data-param2='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].param2;
									if (!key.includes("=")){
										if ("numbersetting2" in response.settings[key]){
											updateSettings(ele, sync, parseFloat(response.settings[key].numbersetting2));
										} else if (document.querySelector("input[data-numbersetting2='"+key+"']")){
											updateSettings(ele, sync, parseFloat(document.querySelector("input[data-numbersetting2='"+key+"']").value));
										} else {
											updateSettings(ele, sync); 
										}
									} else {
										updateSettings(ele, sync);
									}
								} else if (key.includes("=")){
									var keys = key.split('=');
									ele = document.querySelector("input[data-param2='"+keys[0]+"']");
									log(keys);
									log(response.settings);
									if (ele){
										ele.checked = response.settings[key].param2;
										if (keys[1]){
											var ele2 = document.querySelector("input[data-numbersetting2='"+keys[0]+"']");
											if (ele2){
												ele2.value = parseFloat(keys[1], keys[1]);
											}
											updateSettings(ele, sync, parseFloat(keys[1]));
										} else{
											updateSettings(ele, sync);
										}
									}
								}
							}
							if ("param3" in response.settings[key]){
								var ele = document.querySelector("input[data-param3='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].param3;
									updateSettings(ele, sync);
								}
							}
							if ("param4" in response.settings[key]){
								var ele = document.querySelector("input[data-param4='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].param4;
									updateSettings(ele, sync);
								}
							}
							if ("param5" in response.settings[key]){
								var ele = document.querySelector("input[data-param5='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].param5;
									updateSettings(ele, sync);
								}
							}
							if ("param6" in response.settings[key]){
								var ele = document.querySelector("input[data-param6='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].param6;
									updateSettings(ele, sync);
								}
							}
							if ("param7" in response.settings[key]){
								var ele = document.querySelector("input[data-param7='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].param7;
									updateSettings(ele, sync);
								}
							}
							if ("param8" in response.settings[key]){
								var ele = document.querySelector("input[data-param8='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].param8;
									updateSettings(ele, sync);
								}
							}
							if ("param9" in response.settings[key]){
								var ele = document.querySelector("input[data-param9='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].param9;
									if (!key.includes("=")){
										if ("numbersetting9" in response.settings[key]){
											updateSettings(ele, sync, parseFloat(response.settings[key].numbersetting9));
										} else if (document.querySelector("input[data-numbersetting9='"+key+"']")){
											updateSettings(ele, sync, parseFloat(document.querySelector("input[data-numbersetting9='"+key+"']").value));
										} else {
											updateSettings(ele, sync); 
										}
									} else {
										updateSettings(ele, sync);
									}
								} else if (key.includes("=")){
									var keys = key.split('=');
									ele = document.querySelector("input[data-param9='"+keys[0]+"']");
									log(keys);
									log(response.settings);
									if (ele){
										ele.checked = response.settings[key].param9;
										if (keys[1]){
											var ele2 = document.querySelector("input[data-numbersetting9='"+keys[0]+"']");
											if (ele2){
												ele2.value = parseFloat(keys[1], keys[1]);
											}
											updateSettings(ele, sync, parseFloat(keys[1]));
										} else{
											updateSettings(ele, sync);
										}
									}
								}
							}
							if ("both" in response.settings[key]){
								var ele = document.querySelector("input[data-both='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].both;
									updateSettings(ele, sync);
								}
							}
							if ("setting" in response.settings[key]){
								var ele = document.querySelector("input[data-setting='"+key+"']");
								if (ele){
									ele.checked = response.settings[key].setting;
									updateSettings(ele, sync);
								}
								
								if (key == "sentiment"){ // i'm deprecating sentiment
									try{
										var ele1 = document.querySelector("input[data-param1='badkarma']");
										if (ele1 && !ele1.checked){
											ele1.checked = true;
											updateSettings(ele1, true);
										}
										chrome.runtime.sendMessage({cmd: "saveSetting", type: "setting", setting: "sentiment", "value": false}, function (response) {}); // delete sentiment
									} catch(e){console.error(e);}
								} else if (key == "hideyourlinks"){
									document.body.classList.add("hidelinks");
									hideLinks = true;
								} else if (key == "ollamaRagEnabled"){
									document.getElementById('ragFileManagement').style.display = 'block';
								}
								
							}
							if ("textsetting" in response.settings[key]){
								var ele = document.querySelector("input[data-textsetting='"+key+"'],textarea[data-textsetting='"+key+"']");
								if (ele){
									ele.value = response.settings[key].textsetting;
									
									if (ele.dataset.palette){
										try {
											document.getElementById(ele.dataset.palette).value = ele.value;
										} catch(e){
											log(e);
										}
									}
									
									updateSettings(ele, sync);
									
									if (key == "blacklistusers"){
										log(ele.value);
										usernames = ele.value.split(',').map(u => u.trim()).filter(u => u);
										updateUsernameList();
									}
								}
								
							}
							if ("optionsetting" in response.settings[key]){
								var ele = document.querySelector("select[data-optionsetting='"+key+"']");
								if (ele){
									ele.value = response.settings[key].optionsetting;
									updateSettings(ele, sync);
								}
								
								if (key == "aiProvider"){
									if (ele.value == "ollama"){
										document.getElementById("ollamamodel").classList.remove("hidden");
										document.getElementById("ollamaendpoint").classList.remove("hidden");
										document.getElementById("chatgptApiKey").classList.add("hidden");
										document.getElementById("geminiApiKey").classList.add("hidden");
										document.getElementById("geminimodel").classList.add("hidden");
										document.getElementById("chatgptmodel").classList.add("hidden");
									} else if (ele.value == "chatgpt"){
										document.getElementById("chatgptApiKey").classList.remove("hidden");
										document.getElementById("ollamamodel").classList.add("hidden");
										document.getElementById("ollamaendpoint").classList.add("hidden");
										document.getElementById("geminiApiKey").classList.add("hidden");
										document.getElementById("geminimodel").classList.add("hidden");
										document.getElementById("chatgptmodel").classList.remove("hidden");
									} else if (ele.value == "gemini"){
										document.getElementById("geminiApiKey").classList.remove("hidden");
										document.getElementById("ollamamodel").classList.add("hidden");
										document.getElementById("ollamaendpoint").classList.add("hidden");
										document.getElementById("chatgptApiKey").classList.add("hidden");
										document.getElementById("geminimodel").classList.remove("hidden");
										document.getElementById("chatgptmodel").classList.add("hidden");
									} else {
										document.getElementById("ollamamodel").classList.add("hidden");
										document.getElementById("ollamaendpoint").classList.add("hidden");
										document.getElementById("chatgptApiKey").classList.add("hidden");
										document.getElementById("geminiApiKey").classList.add("hidden");
										document.getElementById("geminimodel").classList.add("hidden");
										document.getElementById("chatgptmodel").classList.add("hidden");
									}
								}
								
							}
							if ("numbersetting" in response.settings[key]){
								var ele = document.querySelector("input[data-numbersetting='"+key+"']");
								if (ele){
									ele.value = response.settings[key].numbersetting;
									updateSettings(ele, sync);
									
									var ele = document.querySelector("input[data-param1='"+key+"']");
									if (ele && ele.checked){
										updateSettings(ele, false, parseFloat(response.settings[key].numbersetting));
									}
								}
							}
							if ("numbersetting2" in response.settings[key]){
								var ele = document.querySelector("input[data-numbersetting2='"+key+"']");
								if (ele){
									ele.value = response.settings[key].numbersetting2;
									updateSettings(ele, sync);
									
									var ele = document.querySelector("input[data-param2='"+key+"']");
									if (ele && ele.checked){
										updateSettings(ele, false, parseFloat(response.settings[key].numbersetting2));
									}
								}
							}
							if ("numbersetting9" in response.settings[key]){
								var ele = document.querySelector("input[data-numbersetting9='"+key+"']");
								if (ele){
									ele.value = response.settings[key].numbersetting9;
									updateSettings(ele, sync);
									
									var ele = document.querySelector("input[data-param9='"+key+"']");
									if (ele && ele.checked){
										updateSettings(ele, false, parseFloat(response.settings[key].numbersetting9));
									}
								}
							}
							if ("textparam1" in response.settings[key]){
								var ele = document.querySelector("input[data-textparam1='"+key+"'],textarea[data-textparam1='"+key+"']");
								console.log(ele);
								if (ele){
									ele.value = response.settings[key].textparam1;
									updateSettings(ele, sync);
								}
							}
							if ("textparam2" in response.settings[key]){
								var ele = document.querySelector("input[data-textparam2='"+key+"'],textarea[data-textparam2='"+key+"']");
								if (ele){
									ele.value = response.settings[key].textparam2;
									updateSettings(ele, sync);
								}
							}
							if ("textparam3" in response.settings[key]){
								var ele = document.querySelector("input[data-textparam3='"+key+"']");
								if (ele){
									ele.value = response.settings[key].textparam3;
									updateSettings(ele, sync);
								}
							}
							if ("textparam4" in response.settings[key]){
								var ele = document.querySelector("input[data-textparam4='"+key+"']");
								if (ele){
									ele.value = response.settings[key].textparam4;
									updateSettings(ele, sync);
								}
							}
							if ("textparam5" in response.settings[key]){
								var ele = document.querySelector("input[data-textparam5='"+key+"']");
								if (ele){
									ele.value = response.settings[key].textparam5;
									updateSettings(ele, sync);
								}
							}
							if ("textparam6" in response.settings[key]){
								var ele = document.querySelector("input[data-textparam6='"+key+"']");
								if (ele){
									ele.value = response.settings[key].textparam6;
									updateSettings(ele, sync);
								}
							}
							if ("textparam7" in response.settings[key]){
								var ele = document.querySelector("input[data-textparam7='"+key+"']");
								if (ele){
									ele.value = response.settings[key].textparam7;
									updateSettings(ele, sync);
								}
							}
							if ("optionparam1" in response.settings[key]){
								var ele = document.querySelector("select[data-optionparam1='"+key+"']");
								if (ele){
									ele.value = response.settings[key].optionparam1;
									updateSettings(ele, sync);
								}
							}
							if ("optionparam2" in response.settings[key]){
								var ele = document.querySelector("select[data-optionparam2='"+key+"']");
								if (ele){
									ele.value = response.settings[key].optionparam2;
									updateSettings(ele, sync);
								}
							}
							if ("optionparam3" in response.settings[key]){
								var ele = document.querySelector("select[data-optionparam3='"+key+"']");
								if (ele){
									ele.value = response.settings[key].optionparam3;
									updateSettings(ele, sync);
								}
							}
							if ("optionparam4" in response.settings[key]){
								var ele = document.querySelector("select[data-optionparam4='"+key+"']");
								if (ele){
									ele.value = response.settings[key].optionparam4;
									updateSettings(ele, sync);
								}
							}
							if ("optionparam5" in response.settings[key]){
								var ele = document.querySelector("select[data-optionparam5='"+key+"']");
								if (ele){
									ele.value = response.settings[key].optionparam5;
									updateSettings(ele, sync);
								}
							}
							if ("optionparam6" in response.settings[key]){
								var ele = document.querySelector("select[data-optionparam6='"+key+"']");
								if (ele){
									ele.value = response.settings[key].optionparam6;
									updateSettings(ele, sync);
								}
							}
							if ("optionparam7" in response.settings[key]){
								var ele = document.querySelector("select[data-optionparam7='"+key+"']");
								if (ele){
									ele.value = response.settings[key].optionparam7;
									updateSettings(ele, sync);
								}
							}
							if (('customGifCommands' in response.settings) && response.settings.customGifCommands.json) {
								const commands = JSON.parse(response.settings.customGifCommands.json || '[]');
								const commandsList = document.getElementById('customGifCommandsList');
								commandsList.innerHTML = '';
								commands.forEach(cmd => {
									commandsList.appendChild(createCommandEntry(cmd.command, cmd.url));
								});
							}
							if (('savedPolls' in response.settings) && response.settings.savedPolls.json) {
								PollManager.savedPolls = JSON.parse(response.settings.savedPolls.json || '[]');
								PollManager.updatePollsList();
							}

						} else { // obsolete method
							var ele = document.querySelector("input[data-setting='"+key+"'], input[data-param1='"+key+"'], input[data-param2='"+key+"']");
							if (ele){
								ele.checked = response.settings[key];
								updateSettings(ele, sync);
							}
							var ele = document.querySelector("input[data-textsetting='"+key+"'], input[data-textparam1='"+key+"'], textarea[data-textsetting='"+key+"'], textarea[data-textparam1='"+key+"'],");
							if (ele){
								ele.value = response.settings[key];
								updateSettings(ele, sync);
							}
						}
					} catch(e){
						console.error(e);
					}
				}
				if ("translation" in response.settings){
					translation = response.settings["translation"];
					miniTranslate(document.body);
				}
			}
			
			
			if (hideLinks){
				document.body.classList.add("hidelinks");
			} else {
				document.body.classList.remove("hidelinks");
			}
			
			try {
				document.getElementById("docklink").innerText = hideLinks ? "Click to open link" : document.getElementById("dock").raw;
				document.getElementById("docklink").href = document.getElementById("dock").raw;

				document.getElementById("overlaylink").innerText = hideLinks ? "Click to open link" : document.getElementById("overlay").raw;
				document.getElementById("overlaylink").href = document.getElementById("overlay").raw;

				document.getElementById("emoteswalllink").innerText = hideLinks ? "Click to open link" : document.getElementById("emoteswall").raw;
				document.getElementById("emoteswalllink").href = document.getElementById("emoteswall").raw;
				
				document.getElementById("hypemeterlink").innerText = hideLinks ? "Click to open link" : document.getElementById("hypemeter").raw;
				document.getElementById("hypemeterlink").href = document.getElementById("hypemeter").raw;
				
				document.getElementById("waitlistlink").innerText = hideLinks ? "Click to open link" : document.getElementById("waitlist").raw;
				document.getElementById("waitlistlink").href = document.getElementById("waitlist").raw;
				
				document.getElementById("tickerlink").innerText = hideLinks ? "Click to open link" : document.getElementById("ticker").raw;
				document.getElementById("tickerlink").href = document.getElementById("ticker").raw;
				
				document.getElementById("wordcloudlink").innerText = hideLinks ? "Click to open link" : document.getElementById("wordcloud").raw;
				document.getElementById("wordcloudlink").href = document.getElementById("wordcloud").raw;
				
				document.getElementById("polllink").innerText = hideLinks ? "Click to open link" : document.getElementById("poll").raw;
				document.getElementById("polllink").href = document.getElementById("poll").raw;
				
				document.getElementById("battlelink").innerText = hideLinks ? "Click to open link" : document.getElementById("battle").raw;
				document.getElementById("battlelink").href = document.getElementById("battle").raw;
				
				document.getElementById("custom-gif-commands-link").innerText = hideLinks ? "Click to open link" : document.getElementById("custom-gif-commands").raw;
				document.getElementById("custom-gif-commands-link").href = document.getElementById("custom-gif-commands").raw;
			} catch(e){}
		
		}
		
		if (("state" in response) && streamID){
			isExtensionOn = response.state;
			if (isExtensionOn){
				document.body.classList.add("extension-enabled");
				document.body.classList.remove("extension-disabled");
				
				if (ssapp){
					document.getElementById("disableButtonText").innerHTML = "⚡ Service Active";
				} else {
					document.getElementById("disableButtonText").innerHTML = "⚡ Extension active";
				}
				document.getElementById("disableButton").style.display = "";
				document.getElementById("extensionState").checked = true;
				chrome.browserAction.setIcon({path: "/icons/on.png"});
			} else {
				if (ssapp){
					document.getElementById("disableButtonText").innerHTML = "🔌 Service Disabled";
				} else {
					document.getElementById("disableButtonText").innerHTML = "🔌 Extension Disabled";
				}
				document.body.classList.remove("extension-enabled");
				document.body.classList.add("extension-disabled");
				
				document.getElementById("disableButton").style.display = "";
				chrome.browserAction.setIcon({path: "/icons/off.png"});
				document.getElementById("extensionState").checked = null;
			}
		}
		
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
			
function checkVersion(){
	try {
		fetch('https://raw.githubusercontent.com/steveseguin/social_stream/main/manifest.json').then(response => response.json()).then(data => {
			var manifestData = chrome.runtime.getManifest();
			if ("version" in data){
				if (manifestData && (compareVersions(manifestData.version, data.version)==-1)){
					document.getElementById("newVersion").classList.add('show')
					document.getElementById("newVersion").innerHTML = `There's a <a target='_blank' class='downloadLink' title="Download the latest version as a zip" href='https://github.com/steveseguin/social_stream/archive/refs/heads/main.zip'>new version available 💾</a><p class="installed"><span>Installed: ${manifestData.version}</span><span>Available: ${data.version}</span><a title="See the list of recent code changes" href="https://github.com/steveseguin/social_stream/commits/main" target='_blank' style='text-decoration: underline;'>[change log]</a>`;
					
				} else {
					document.getElementById("newVersion").classList.remove('show')
					document.getElementById("newVersion").innerHTML = "";
				}
			}
		});
	} catch(e){}
}


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
ssapp = urlParams.has("ssapp") || ssapp;

if (ssapp){
	const style = document.createElement('style');
	style.textContent = '.ssapp { display: none !important; }';
	style.id = 'hide-ssapp-style';
	document.head.appendChild(style);
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

function updateSettings(ele, sync=true, value=null){
	
	if (ele.target){
		ele = this;
	}
	
	var target = null;
	if (ele.dataset.target){
		target = ele.dataset.target;
	}
	
	if (ele.closest('.custom-gif-command-entry')) {
        const commands = Array.from(document.querySelectorAll('.custom-gif-command-entry')).map(entry => ({
            command: entry.querySelector('.custom-command').value,
            url: entry.querySelector('.custom-media-url').value
        }));

        if (sync) {
            chrome.runtime.sendMessage({cmd: "saveSetting", type: "json", setting: "customGifCommands", value: JSON.stringify(commands)}, function (response) {});
        }
    }
	if (sync && ele.closest('.options_group.poll') && PollManager.currentPollId) {
        PollManager.savePollsToStorage();
	}
	
	if (ele.dataset.param1){
		if (ele.checked){
			
			if (value!==null){
				document.getElementById("dock").raw = updateURL(ele.dataset.param1+"="+value, document.getElementById("dock").raw);
			} else if (document.querySelector("input[data-numbersetting='"+ele.dataset.param1+"']")){
				
				value = document.querySelector("input[data-numbersetting='"+ele.dataset.param1+"']").value;
				
				document.getElementById("dock").raw = removeQueryParamWithValue(document.getElementById("dock").raw, ele.dataset.param1);
				document.getElementById("dock").raw = updateURL(ele.dataset.param1+"="+value, document.getElementById("dock").raw);
			} else {
				document.getElementById("dock").raw = updateURL(ele.dataset.param1, document.getElementById("dock").raw);
			}

			if (ele.dataset.param1 == "darkmode"){
				var key = "lightmode";
				var ele1 = document.querySelector("input[data-param1='"+key+"']");
				if (ele1 && ele1.checked){
					ele1.checked = false;
					updateSettings(ele1, sync);
				}

			} else if (ele.dataset.param1 == "lightmode"){
				var key = "darkmode";
				var ele1 = document.querySelector("input[data-param1='"+key+"']");
				if (ele1 && ele1.checked){
					ele1.checked = false;
					updateSettings(ele1, sync);
				}
			}
			
			if (ele.dataset.param1 == "badkarma"){
				var ele1 = document.querySelector("input[data-setting='addkarma']");
				if (ele1 && !ele1.checked){
					ele1.checked = true;
					updateSettings(ele1, sync);
				}
			}
			
			if (ele.dataset.param1 == "onlytwitch"){
				var key = "hidetwitch";
				var ele1 = document.querySelector("input[data-param1='"+key+"']");
				if (ele1 && ele1.checked){
					ele1.checked = false;
					updateSettings(ele1, sync);
				}

			} else if (ele.dataset.param1 == "hidetwitch"){
				var key = "onlytwitch";
				var ele1 = document.querySelector("input[data-param1='"+key+"']");
				if (ele1 && ele1.checked){
					ele1.checked = false;
					updateSettings(ele1, sync);
				}
			}
			
			document.querySelectorAll("input[data-param1^='"+ele.dataset.param1.split("=")[0]+"=']:not([data-param1='"+ele.dataset.param1+"']), input[data-param1='"+ele.dataset.param1.split("=")[0]+"']:not([data-param1='"+ele.dataset.param1+"'])").forEach(ele1=>{
				if (ele1 && ele1.checked){
					ele1.checked = false;
					updateSettings(ele1, sync);
				}
			});
			
		} else {
			//document.getElementById("dock").raw = document.getElementById("dock").raw.replace(ele.dataset.param1, "");
			document.getElementById("dock").raw = removeQueryParamWithValue(document.getElementById("dock").raw, ele.dataset.param1);
		}
		
		if (ele.dataset.param1 == "compact"){ // duplicate
			var key = "compact";
			document.querySelectorAll("input[data-param1='"+key+"']").forEach(EL=>{ // sync
				EL.checked = ele.checked;
			});
		}

		document.getElementById("dock").raw = document.getElementById("dock").raw.replace("&&", "&");
		document.getElementById("dock").raw = document.getElementById("dock").raw.replace("?&", "?");
		
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting",  type: "param1", target:target, setting: ele.dataset.param1, "value": ele.checked}, function (response) {});
		}

	} else if (ele.dataset.textparam1){
		
		document.getElementById("dock").raw = removeQueryParamWithValue(document.getElementById("dock").raw, ele.dataset.textparam1);
		
		if (ele.value && ele.dataset.textparam1 == "cssb64"){
			document.getElementById("dock").raw = updateURL(ele.dataset.textparam1+"="+btoa(encodeURIComponent(ele.value)), document.getElementById("dock").raw);
		} else if (ele.value){
			document.getElementById("dock").raw = updateURL(ele.dataset.textparam1+"="+encodeURIComponent(ele.value), document.getElementById("dock").raw);
		}
		document.getElementById("dock").raw = document.getElementById("dock").raw.replace("&&", "&");
		document.getElementById("dock").raw = document.getElementById("dock").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "textparam1",  target:target, setting: ele.dataset.textparam1, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.textparam2){
		document.getElementById("overlay").raw = removeQueryParamWithValue(document.getElementById("overlay").raw, ele.dataset.textparam2);
		
		if (ele.value && ele.dataset.textparam2 == "cssb64"){
			document.getElementById("overlay").raw = updateURL(ele.dataset.textparam2+"="+btoa(encodeURIComponent(ele.value)), document.getElementById("overlay").raw);
		} else if (ele.value){
			document.getElementById("overlay").raw = updateURL(ele.dataset.textparam2+"="+encodeURIComponent(ele.value), document.getElementById("overlay").raw);
		}
		document.getElementById("overlay").raw = document.getElementById("overlay").raw.replace("&&", "&");
		document.getElementById("overlay").raw = document.getElementById("overlay").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "textparam2",  target:target, setting: ele.dataset.textparam2, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.textparam3){
		document.getElementById("emoteswall").raw = removeQueryParamWithValue(document.getElementById("emoteswall").raw, ele.dataset.textparam3);
		
		if (ele.value){
			document.getElementById("emoteswall").raw = updateURL(ele.dataset.textparam3+"="+encodeURIComponent(ele.value), document.getElementById("emoteswall").raw);
		}
		document.getElementById("emoteswall").raw = document.getElementById("emoteswall").raw.replace("&&", "&");
		document.getElementById("emoteswall").raw = document.getElementById("emoteswall").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "textparam3",  target:target, setting: ele.dataset.textparam3, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.textparam4){
		document.getElementById("hypemeter").raw = removeQueryParamWithValue(document.getElementById("hypemeter").raw, ele.dataset.textparam4);
		
		if (ele.value){
			document.getElementById("hypemeter").raw = updateURL(ele.dataset.textparam4+"="+encodeURIComponent(ele.value), document.getElementById("hypemeter").raw);
		}
		document.getElementById("hypemeter").raw = document.getElementById("hypemeter").raw.replace("&&", "&");
	} else if (ele.dataset.textparam4){
		document.getElementById("hypemeter").raw = removeQueryParamWithValue(document.getElementById("hypemeter").raw, ele.dataset.textparam4);
		
		if (ele.value){
			document.getElementById("hypemeter").raw = updateURL(ele.dataset.textparam4+"="+encodeURIComponent(ele.value), document.getElementById("hypemeter").raw);
		}
		document.getElementById("hypemeter").raw = document.getElementById("hypemeter").raw.replace("&&", "&");
		document.getElementById("hypemeter").raw = document.getElementById("hypemeter").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "textparam4",  target:target, setting: ele.dataset.textparam4, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.textparam5){
		document.getElementById("waitlist").raw = removeQueryParamWithValue(document.getElementById("waitlist").raw, ele.dataset.textparam5);
		
		if (ele.value){
			document.getElementById("waitlist").raw = updateURL(ele.dataset.textparam5+"="+encodeURIComponent(ele.value), document.getElementById("waitlist").raw);
		}
		document.getElementById("waitlist").raw = document.getElementById("waitlist").raw.replace("&&", "&");
		document.getElementById("waitlist").raw = document.getElementById("waitlist").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "textparam5",  target:target, setting: ele.dataset.textparam5, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.textparam6){
		document.getElementById("ticker").raw = removeQueryParamWithValue(document.getElementById("ticker").raw, ele.dataset.textparam6);
		
		if (ele.value){
			document.getElementById("ticker").raw = updateURL(ele.dataset.textparam6+"="+encodeURIComponent(ele.value), document.getElementById("ticker").raw);
		}
		document.getElementById("ticker").raw = document.getElementById("ticker").raw.replace("&&", "&");
		document.getElementById("ticker").raw = document.getElementById("ticker").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "textparam6",  target:target, setting: ele.dataset.textparam6, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.textparam7){
		document.getElementById("wordcloud").raw = removeQueryParamWithValue(document.getElementById("wordcloud").raw, ele.dataset.textparam7);
		
		if (ele.value){
			document.getElementById("wordcloud").raw = updateURL(ele.dataset.textparam7+"="+encodeURIComponent(ele.value), document.getElementById("wordcloud").raw);
		}
		document.getElementById("wordcloud").raw = document.getElementById("wordcloud").raw.replace("&&", "&");
		document.getElementById("wordcloud").raw = document.getElementById("wordcloud").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "textparam7",  target:target, setting: ele.dataset.textparam7, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.optionparam1){
		document.getElementById("dock").raw = removeQueryParamWithValue(document.getElementById("dock").raw, ele.dataset.optionparam1);
		
		
		if (ele.value){
			ele.value.split("&").forEach(rem=>{
				if (rem.includes("=")){ // this isn't covering all cases, but good enough for the existing values
					document.getElementById("dock").raw = removeQueryParamWithValue(document.getElementById("dock").raw, rem.split("=")[0]);
				}
			});
			document.getElementById("dock").raw = updateURL(ele.dataset.optionparam1+"="+encodeURIComponent(ele.value).replace(/%26/g, '&').replace(/%3D/g, '='), document.getElementById("dock").raw);
		}
		
		document.getElementById("dock").raw = document.getElementById("dock").raw.replace("&&", "&");
		document.getElementById("dock").raw = document.getElementById("dock").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "optionparam1", target:target,  setting: ele.dataset.optionparam1, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.optionparam2){
		document.getElementById("overlay").raw = removeQueryParamWithValue(document.getElementById("overlay").raw, ele.dataset.optionparam2);
		
		if (ele.value){
			ele.value.split("&").forEach(rem=>{
				if (rem.includes("=")){
					document.getElementById("overlay").raw = removeQueryParamWithValue(document.getElementById("overlay").raw, rem.split("=")[0]);
				}
			});
			document.getElementById("overlay").raw = updateURL(ele.dataset.optionparam2+"="+encodeURIComponent(ele.value).replace(/%26/g, '&').replace(/%3D/g, '='), document.getElementById("overlay").raw);
		}
		
		document.getElementById("overlay").raw = document.getElementById("overlay").raw.replace("&&", "&");
		document.getElementById("overlay").raw = document.getElementById("overlay").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "optionparam2", target:target,  setting: ele.dataset.optionparam2, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.optionparam6){
		document.getElementById("ticker").raw = removeQueryParamWithValue(document.getElementById("ticker").raw, ele.dataset.optionparam6);
		
		if (ele.value){
			document.getElementById("ticker").raw = updateURL(ele.dataset.optionparam6+"="+encodeURIComponent(ele.value), document.getElementById("ticker").raw);
		}
		
		document.getElementById("ticker").raw = document.getElementById("ticker").raw.replace("&&", "&");
		document.getElementById("ticker").raw = document.getElementById("ticker").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "optionparam6", target:target,  setting: ele.dataset.optionparam6, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.optionparam7){
		document.getElementById("wordcloud").raw = removeQueryParamWithValue(document.getElementById("wordcloud").raw, ele.dataset.optionparam7);
		
		if (ele.value){
			document.getElementById("wordcloud").raw = updateURL(ele.dataset.optionparam7+"="+encodeURIComponent(ele.value), document.getElementById("wordcloud").raw);
		}
		
		document.getElementById("wordcloud").raw = document.getElementById("wordcloud").raw.replace("&&", "&");
		document.getElementById("wordcloud").raw = document.getElementById("wordcloud").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "optionparam7", target:target,  setting: ele.dataset.optionparam7, "value": ele.value}, function (response) {});
		}
	} else if (ele.dataset.param2){
		if (ele.checked){
			if (value!==null){
				document.getElementById("overlay").raw = updateURL(ele.dataset.param2+"="+value, document.getElementById("overlay").raw);
			} else if (document.querySelector("input[data-numbersetting2='"+ele.dataset.param2+"']")){
				value = document.querySelector("input[data-numbersetting2='"+ele.dataset.param2+"']").value;
				
				document.getElementById("overlay").raw = removeQueryParamWithValue(document.getElementById("overlay").raw, ele.dataset.param2);
				document.getElementById("overlay").raw = updateURL(ele.dataset.param2+"="+value, document.getElementById("overlay").raw);
			} else {
				document.getElementById("overlay").raw = updateURL(ele.dataset.param2, document.getElementById("overlay").raw);
			}
		}  else {
			document.getElementById("overlay").raw = removeQueryParamWithValue(document.getElementById("overlay").raw, ele.dataset.param2);
		}
			
		document.getElementById("overlay").raw = document.getElementById("overlay").raw.replace("&&", "&");
		document.getElementById("overlay").raw = document.getElementById("overlay").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "param2",  target:target, setting: ele.dataset.param2, "value": ele.checked}, function (response) {});
		}
		
		document.querySelectorAll("input[data-param2^='"+ele.dataset.param2.split("=")[0]+"']:not([data-param2='"+ele.dataset.param2+"'])").forEach(ele1=>{
			if (ele1 && ele1.checked){
				ele1.checked = false;
				updateSettings(ele1, sync);
			}
		});

	} else if (ele.dataset.param3){
		if (ele.checked){
			document.getElementById("emoteswall").raw = updateURL(ele.dataset.param3, document.getElementById("emoteswall").raw);
		} else {
			//document.getElementById("emoteswall").raw = document.getElementById("emoteswall").raw.replace(ele.dataset.param3, "");
			document.getElementById("emoteswall").raw = removeQueryParamWithValue(document.getElementById("emoteswall").raw, ele.dataset.param3);
		}
		document.getElementById("emoteswall").raw = document.getElementById("emoteswall").raw.replace("&&", "&");
		document.getElementById("emoteswall").raw = document.getElementById("emoteswall").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "param3",  target:target, setting: ele.dataset.param3, "value": ele.checked}, function (response) {});
		}
		
		document.querySelectorAll("input[data-param3^='"+ele.dataset.param3.split("=")[0]+"']:not([data-param3='"+ele.dataset.param3+"'])").forEach(ele1=>{
			if (ele1 && ele1.checked){
				ele1.checked = false;
				updateSettings(ele1, sync);
			}
		});
		
	} else if (ele.dataset.param4){
		if (ele.checked){
			document.getElementById("hypemeter").raw = updateURL(ele.dataset.param4, document.getElementById("hypemeter").raw);
		} else {
			//document.getElementById("hypemeter").raw = document.getElementById("hypemeter").raw.replace(ele.dataset.param4, "");
			document.getElementById("hypemeter").raw = removeQueryParamWithValue(document.getElementById("hypemeter").raw, ele.dataset.param4);
		}
		document.getElementById("hypemeter").raw = document.getElementById("hypemeter").raw.replace("&&", "&");
		document.getElementById("hypemeter").raw = document.getElementById("hypemeter").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "param4",  target:target, setting: ele.dataset.param4, "value": ele.checked}, function (response) {});
		}
		
		document.querySelectorAll("input[data-param4^='"+ele.dataset.param4.split("=")[0]+"']:not([data-param4='"+ele.dataset.param4+"'])").forEach(ele1=>{
			if (ele1 && ele1.checked){
				ele1.checked = false;
				updateSettings(ele1, sync);
			}
		});
		
	} else if (ele.dataset.param8){
		if (ele.checked){
			document.getElementById("battle").raw = updateURL(ele.dataset.param8, document.getElementById("battle").raw);
		} else {
			//document.getElementById("battle").raw = document.getElementById("battle").raw.replace(ele.dataset.param8, "");
			document.getElementById("battle").raw = removeQueryParamWithValue(document.getElementById("battle").raw, ele.dataset.param8);
		}
		document.getElementById("battle").raw = document.getElementById("battle").raw.replace("&&", "&");
		document.getElementById("battle").raw = document.getElementById("battle").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "param8",  target:target, setting: ele.dataset.param8, "value": ele.checked}, function (response) {});
		}
		
		document.querySelectorAll("input[data-param8^='"+ele.dataset.param8.split("=")[0]+"']:not([data-param8='"+ele.dataset.param8+"'])").forEach(ele1=>{
			if (ele1 && ele1.checked){
				ele1.checked = false;
				updateSettings(ele1, sync);
			}
		});
	} else if (ele.dataset.param9){
		if (ele.checked){
			if (value!==null){
				document.getElementById("custom-gif-commands").raw = updateURL(ele.dataset.param9+"="+value, document.getElementById("custom-gif-commands").raw);
			} else if (document.querySelector("input[data-numbersetting9='"+ele.dataset.param9+"']")){
				value = document.querySelector("input[data-numbersetting9='"+ele.dataset.param9+"']").value;
				
				document.getElementById("custom-gif-commands").raw = removeQueryParamWithValue(document.getElementById("custom-gif-commands").raw, ele.dataset.param9);
				document.getElementById("custom-gif-commands").raw = updateURL(ele.dataset.param9+"="+value, document.getElementById("custom-gif-commands").raw);
			} else {
				document.getElementById("custom-gif-commands").raw = updateURL(ele.dataset.param9, document.getElementById("custom-gif-commands").raw);
			}
		}  else {
			document.getElementById("custom-gif-commands").raw = removeQueryParamWithValue(document.getElementById("custom-gif-commands").raw, ele.dataset.param9);
		}
			
		document.getElementById("custom-gif-commands").raw = document.getElementById("custom-gif-commands").raw.replace("&&", "&");
		document.getElementById("custom-gif-commands").raw = document.getElementById("custom-gif-commands").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "param9",  target:target, setting: ele.dataset.param9, "value": ele.checked}, function (response) {});
		}
		
		document.querySelectorAll("input[data-param9^='"+ele.dataset.param9.split("=")[0]+"']:not([data-param9='"+ele.dataset.param9+"'])").forEach(ele1=>{
			if (ele1 && ele1.checked){
				ele1.checked = false;
				updateSettings(ele1, sync);
			}
		});
		
	} else if (ele.dataset.param5){
		
		
		if (ele.checked){
			document.getElementById("waitlist").raw = updateURL(ele.dataset.param5, document.getElementById("waitlist").raw);
		} else {
			//document.getElementById("waitlist").raw = document.getElementById("waitlist").raw.replace(ele.dataset.param5, "");
			document.getElementById("waitlist").raw = removeQueryParamWithValue(document.getElementById("waitlist").raw, ele.dataset.param5);
		}
		document.getElementById("waitlist").raw = document.getElementById("waitlist").raw.replace("&&", "&");
		document.getElementById("waitlist").raw = document.getElementById("waitlist").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "param5",  target:target, setting: ele.dataset.param5, "value": ele.checked}, function (response) {});
		}
		
		
		if (ele.dataset.param5 == "alignright"){
			var key = "aligncenter";
			var ele1 = document.querySelector("input[data-param5='"+key+"']");
			if (ele1 && ele1.checked){
				ele1.checked = false;
				updateSettings(ele1, sync);
			}

		} else if (ele.dataset.param5 == "aligncenter"){
			var key = "alignright";
			var ele1 = document.querySelector("input[data-param5='"+key+"']");
			if (ele1 && ele1.checked){
				ele1.checked = false;
				updateSettings(ele1, sync);
			}
		}
		
		document.querySelectorAll("input[data-param5^='"+ele.dataset.param5.split("=")[0]+"']:not([data-param5='"+ele.dataset.param5+"'])").forEach(ele1=>{
			if (ele1 && ele1.checked){
				ele1.checked = false;
				updateSettings(ele1, sync);
			}
		});
		
		
	} else if (ele.dataset.both){
		if (ele.checked){
			document.getElementById("overlay").raw = updateURL(ele.dataset.both, document.getElementById("overlay").raw);
			document.getElementById("dock").raw = updateURL(ele.dataset.both, document.getElementById("dock").raw);
			document.getElementById("emoteswall").raw = updateURL(ele.dataset.both, document.getElementById("emoteswall").raw);
			document.getElementById("waitlist").raw = updateURL(ele.dataset.both, document.getElementById("waitlist").raw);
			document.getElementById("hypemeter").raw = updateURL(ele.dataset.both, document.getElementById("hypemeter").raw);
		} else {
			document.getElementById("overlay").raw = removeQueryParamWithValue(document.getElementById("overlay").raw, ele.dataset.both);
			document.getElementById("dock").raw = removeQueryParamWithValue(document.getElementById("dock").raw, ele.dataset.both);
			document.getElementById("emoteswall").raw = removeQueryParamWithValue(document.getElementById("emoteswall").raw, ele.dataset.both);
			document.getElementById("waitlist").raw = removeQueryParamWithValue(document.getElementById("waitlist").raw, ele.dataset.both);
			document.getElementById("hypemeter").raw = removeQueryParamWithValue(document.getElementById("hypemeter").raw, ele.dataset.both);
		}
		
		document.getElementById("overlay").raw = document.getElementById("overlay").raw.replace("&&", "&");
		document.getElementById("overlay").raw = document.getElementById("overlay").raw.replace("?&", "?");
		document.getElementById("dock").raw = document.getElementById("dock").raw.replace("&&", "&");
		document.getElementById("dock").raw = document.getElementById("dock").raw.replace("?&", "?");
		document.getElementById("emoteswall").raw = document.getElementById("emoteswall").raw.replace("&&", "&");
		document.getElementById("emoteswall").raw = document.getElementById("emoteswall").raw.replace("?&", "?");
		document.getElementById("waitlist").raw = document.getElementById("waitlist").raw.replace("&&", "&");
		document.getElementById("waitlist").raw = document.getElementById("waitlist").raw.replace("?&", "?");
		document.getElementById("hypemeter").raw = document.getElementById("hypemeter").raw.replace("&&", "&");
		document.getElementById("hypemeter").raw = document.getElementById("hypemeter").raw.replace("?&", "?");
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting",  type: "both",  target:target, setting: ele.dataset.both, "value": ele.checked}, function (response) {});
		}

	} else if (ele.dataset.setting){
		if (ele.dataset.setting == "addkarma"){
			if (!ele.checked){ // if unchecked
				var ele1 = document.querySelector("input[data-param1='badkarma']"); // then also uncheck the karma filter
				if (ele1 && ele1.checked){
					ele1.checked = false;
					updateSettings(ele1, sync);
				}
			}
		}
		
		if (ele.dataset.setting == "drawmode"){
			if (ele.checked){
				document.getElementById("drawmode").classList.remove("hidden");
				document.getElementById("queuemode").classList.add("hidden");
			} else {
				document.getElementById("drawmode").classList.add("hidden");
				document.getElementById("queuemode").classList.remove("hidden");
			}
		}
		if (ele.dataset.setting == "waitlistmode"){
			if (ele.checked){
				document.getElementById("waitlistbuttons").classList.remove("hidden");
			} else {
				document.getElementById("waitlistbuttons").classList.add("hidden");
			}
		}
		
		if (ele.dataset.setting == "hideyourlinks"){
			if (ele.checked){
				refreshLinks();
			} else {
				refreshLinks();
			}
		}
		
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting",  type: "setting",  target:target, setting: ele.dataset.setting, "value": ele.checked}, function (response) {});
		}
		return;
	} else if (ele.dataset.optionsetting){
		
		if (ele.dataset.optionsetting == "pollType"){
			if (ele.value == "multiple"){
				document.getElementById("multipleChoiceOptions").classList.remove("hidden");
			} else {
				document.getElementById("multipleChoiceOptions").classList.add("hidden");
			}
		}
		if (ele.dataset.optionsetting == "aiProvider"){
			if (ele.value == "ollama"){
				document.getElementById("ollamamodel").classList.remove("hidden");
				document.getElementById("ollamaendpoint").classList.remove("hidden");
				document.getElementById("chatgptApiKey").classList.add("hidden");
				document.getElementById("geminiApiKey").classList.add("hidden");
				document.getElementById("geminimodel").classList.add("hidden");
				document.getElementById("chatgptmodel").classList.add("hidden");
			} else if (ele.value == "chatgpt"){
				document.getElementById("chatgptApiKey").classList.remove("hidden");
				document.getElementById("ollamamodel").classList.add("hidden");
				document.getElementById("ollamaendpoint").classList.add("hidden");
				document.getElementById("geminiApiKey").classList.add("hidden");
				document.getElementById("geminimodel").classList.add("hidden");
				document.getElementById("chatgptmodel").classList.remove("hidden");
			} else if (ele.value == "gemini"){
				document.getElementById("geminiApiKey").classList.remove("hidden");
				document.getElementById("ollamamodel").classList.add("hidden");
				document.getElementById("ollamaendpoint").classList.add("hidden");
				document.getElementById("chatgptApiKey").classList.add("hidden");
				document.getElementById("geminimodel").classList.remove("hidden");
				document.getElementById("chatgptmodel").classList.add("hidden");
			} else {
				document.getElementById("ollamamodel").classList.add("hidden");
				document.getElementById("ollamaendpoint").classList.add("hidden");
				document.getElementById("chatgptApiKey").classList.add("hidden");
				document.getElementById("geminiApiKey").classList.add("hidden");
				document.getElementById("geminimodel").classList.add("hidden");
				document.getElementById("chatgptmodel").classList.add("hidden");
			}
		}
		
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting",  type: "optionsetting", target:target,  setting: ele.dataset.optionsetting, "value": ele.value}, function (response) {});
		}
		return;
	} else if (ele.dataset.textsetting){
		
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "textsetting", target:target,  setting: ele.dataset.textsetting, "value": ele.value}, function (response) {});
		}
		return;
	} else if (ele.dataset.numbersetting){ 
		
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "numbersetting",  target:target, setting: ele.dataset.numbersetting, "value": ele.value}, function (response) {});
		}
		
		if (document.querySelector("input[data-param1='"+ele.dataset.numbersetting+"']") && document.querySelector("input[data-param1='"+ele.dataset.numbersetting+"']").checked){
			document.getElementById("dock").raw = removeQueryParamWithValue(document.getElementById("dock").raw,ele.dataset.numbersetting);
			document.getElementById("dock").raw = updateURL(ele.dataset.numbersetting+"="+ ele.value, document.getElementById("dock").raw);
		} else {
			return;
		}
	} else if (ele.dataset.numbersetting2){ 
		
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "numbersetting2",  target:target, setting: ele.dataset.numbersetting2, "value": ele.value}, function (response) {});
		}
		
		if (document.querySelector("input[data-param2='"+ele.dataset.numbersetting2+"']") && document.querySelector("input[data-param2='"+ele.dataset.numbersetting2+"']").checked){
			document.getElementById("overlay").raw = removeQueryParamWithValue(document.getElementById("overlay").raw,ele.dataset.numbersetting2);
			document.getElementById("overlay").raw = updateURL(ele.dataset.numbersetting2+"="+ ele.value, document.getElementById("overlay").raw);
		} else {
			return;
		}
	} else if (ele.dataset.numbersetting9){ 
		
		if (sync){
			chrome.runtime.sendMessage({cmd: "saveSetting", type: "numbersetting9",  target:target, setting: ele.dataset.numbersetting9, "value": ele.value}, function (response) {});
		}
		
		if (document.querySelector("input[data-param9='"+ele.dataset.numbersetting9+"']") && document.querySelector("input[data-param9='"+ele.dataset.numbersetting9+"']").checked){
			document.getElementById("custom-gif-commands").raw = removeQueryParamWithValue(document.getElementById("custom-gif-commands").raw,ele.dataset.numbersetting9);
			document.getElementById("custom-gif-commands").raw = updateURL(ele.dataset.numbersetting9+"="+ ele.value, document.getElementById("custom-gif-commands").raw);
		} else {
			return;
		}		
	} else if (ele.dataset.special){
		
		if (ele.dataset.special==="session"){
			
			let xsx = validateRoomId(ele.value);
			if (!xsx){
				alert("Invalid session ID.");
			} else {
				ele.value = xsx;
				if (chrome && chrome.storage && chrome.storage.sync && chrome.storage.sync.set){
					chrome.storage.sync.set({
						streamID: xsx
					});
				}
				chrome.runtime.sendMessage({cmd: "sidUpdated",  target:target, streamID: xsx}, function (response) {log("streamID updated");});
			}
			
		} else if (ele.dataset.special==="password"){
			if (chrome && chrome.storage && chrome.storage.sync && chrome.storage.sync.set){
				chrome.storage.sync.set({
					password: ele.value
				});
			}
			chrome.runtime.sendMessage({cmd: "sidUpdated",  target:target, password: ele.value || ""}, function (response) {log("Password updated");});
		}
	} else if (ele.dataset.color){
		
		var ele2 = document.getElementById(ele.dataset.color);
		if (ele2){
			ele2.value = ele.value
			updateSettings(ele2, sync);
			return;
		}
		
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
		document.getElementById("docklink").innerText = hideLinks ? "Click to open link" : document.getElementById("dock").raw;
		document.getElementById("docklink").href = document.getElementById("dock").raw;

		document.getElementById("overlaylink").innerText = hideLinks ? "Click to open link" : document.getElementById("overlay").raw;
		document.getElementById("overlaylink").href = document.getElementById("overlay").raw;

		document.getElementById("emoteswalllink").innerText = hideLinks ? "Click to open link" : document.getElementById("emoteswall").raw;
		document.getElementById("emoteswalllink").href = document.getElementById("emoteswall").raw;
		
		document.getElementById("hypemeterlink").innerText = hideLinks ? "Click to open link" : document.getElementById("hypemeter").raw;
		document.getElementById("hypemeterlink").href = document.getElementById("hypemeter").raw;
		
		document.getElementById("waitlistlink").innerText = hideLinks ? "Click to open link" : document.getElementById("waitlist").raw;
		document.getElementById("waitlistlink").href = document.getElementById("waitlist").raw;
		
		document.getElementById("tickerlink").innerText = hideLinks ? "Click to open link" : document.getElementById("ticker").raw;
		document.getElementById("tickerlink").href = document.getElementById("ticker").raw;
		
		document.getElementById("wordcloudlink").innerText = hideLinks ? "Click to open link" : document.getElementById("wordcloud").raw;
		document.getElementById("wordcloudlink").href = document.getElementById("wordcloud").raw;
		
		document.getElementById("polllink").innerText = hideLinks ? "Click to open link" : document.getElementById("poll").raw;
		document.getElementById("polllink").href = document.getElementById("poll").raw;
		
		document.getElementById("battlelink").innerText = hideLinks ? "Click to open link" : document.getElementById("battle").raw;
		document.getElementById("battlelink").href = document.getElementById("battle").raw;
		
		document.getElementById("custom-gif-commands-link").innerText = hideLinks ? "Click to open link" : document.getElementById("custom-gif-commands").raw;
		document.getElementById("custom-gif-commands-link").href = document.getElementById("custom-gif-commands").raw;
	} catch(e){}
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


function updateUsernameList(save=false) {
	const usernameList = document.getElementById('usernameList');
	usernameList.innerHTML = '';
	usernames.forEach(username => {
		const item = document.createElement('div');
		item.className = 'username-item';
		item.innerHTML = `
			<span class="remove-username" data-username="${username}" title="Remove user from block-list">×</span>
			<span>${username}</span>
		`;
		usernameList.appendChild(item);
	});
	var ele = document.querySelector("input[data-textsetting='blacklistusers'],textarea[data-textsetting='blacklistusers']");
	if (ele){
		ele.value = usernames.join(',');
		log(ele.value);
		
		if (save){
			updateSettings(ele);
		}
	}
}

function addUsername(username) {
	if (username && !usernames.includes(username)) {
		usernames.push(username);
		updateUsernameList(true);
	}
}

function removeUsername(username) {
	usernames = usernames.filter(u => u !== username);
	updateUsernameList(true);
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
      const reader = new FileReader();
      reader.onload = (e) => {
        const contents = e.target.result;
		console.log({cmd: 'uploadBadwords', data: contents});
        chrome.runtime.sendMessage({cmd: 'uploadBadwords', data: contents}, (response) => {
		  console.log(response);
          if (response.success) {
            alert('Badwords file uploaded successfully.');
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
      } else {
        alert('Failed to delete badwords file.');
      }
    });
  }
}

// TTS Module for direct integration with settings menu
const TTSManager = {
    audio: null,
    speech: false,
    voice: null,
    voices: null,
    premiumQueueTTS: [],
    premiumQueueActive: false,
    
    // Initialize the TTS system
    init(voices) {
		this.voices = voices;
		if (!this.audio){
			this.audio = document.createElement("audio");
			this.audio.onended = () => this.finishedAudio();
		}
		const menuWrapper = document.querySelector('#ttsButton');
        if (menuWrapper){
			// Add test button to the menu
			const testButton = document.createElement('button');
			testButton.textContent = "Test";
			testButton.className = "tts-test-button";
			testButton.onclick = () => this.testTTS();
			
			menuWrapper.replaceWith(testButton);
		}
    },
    
    // Get current settings from the menu
    getSettings() {
        return {
            speech: document.querySelector('[data-param1="speech"]').checked,
            lang: document.getElementById('languageSelect1').selectedOptions[0].dataset.lang || document.getElementById('languageSelect1').value || 'en-US',
			name: document.getElementById('languageSelect1').selectedOptions[0].dataset.name || '',
            rate: parseFloat(document.querySelector('[data-numbersetting="rate"]').value) || 1.0,
            volume: document.getElementById('volumeSlider')?.value / 100 || 1.0,
            
            // API Keys
            googleKey: document.getElementById('googleAPIKey').value,
            elevenLabsKey: document.getElementById('elevenLabsKey').value,
            speechifyKey: document.getElementById('speechifyAPIKey').value,
            
            // Voice settings
            googleVoice: document.getElementById('googleVoiceName').value,
            elevenLabsVoice: document.getElementById('elevenLabsVoiceID').value,
            speechifyVoice: document.getElementById('speechifyVoiceID').value,
            
            // Other options
            latency: parseInt(document.querySelector('[data-numbersetting="latency"]')?.value) || 0
        };
    },
    
    // Test TTS functionality
    testTTS() {
        const testPhrase = "The quick brown fox jumps over the lazy dog";
        this.speak(testPhrase, true);
    },
    
    // Main speak function
    speak(text, allow = false) {
		//console.log("speak: "+text);
        const settings = this.getSettings();
		//console.log("settings: "+settings);
        if (!settings.speech && !allow) return;
        if (!text) return;
		//console.log("GOOD!?");
        
        // Handle different TTS services based on available API keys
        if (settings.googleKey) {
            if (!this.premiumQueueActive) {
                this.googleTTS(text, settings);
            } else {
                this.premiumQueueTTS.push(text);
            }
        } else if (settings.elevenLabsKey) {
            if (!this.premiumQueueActive) {
                this.elevenLabsTTS(text, settings);
            } else {
                this.premiumQueueTTS.push(text);
            }
        } else if (settings.speechifyKey) {
            if (!this.premiumQueueActive) {
                this.speechifyTTS(text, settings);
            } else {
                this.premiumQueueTTS.push(text);
            }
        } else {
            this.systemTTS(text, settings);
        }
    },
    
    // Built-in system TTS
    systemTTS(text, settings) {
        if (!window.speechSynthesis) return;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = settings.lang;
        utterance.rate = settings.rate;
        utterance.volume = settings.volume;
        
        // Find the specific voice based on both name and language
        if (this.voices && settings.name) {
            const matchingVoice = this.voices.find(v => 
                v.name === settings.name && v.lang === settings.lang
            );
            if (matchingVoice) {
                utterance.voice = matchingVoice;
            }
        }
        
        window.speechSynthesis.speak(utterance);
    },
    
    // Google Cloud TTS
    googleTTS(text, settings) {
        this.premiumQueueActive = true;
        const url = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${settings.googleKey}`;
        
        const data = {
            input: { text },
            voice: {
                languageCode: settings.lang.toLowerCase(),
                name: settings.googleVoice || "en-GB-Standard-A"
            },
            audioConfig: {
                audioEncoding: "MP3",
                speakingRate: settings.rate
            }
        };
        
        this.fetchAudioContent(url, {
            method: "POST",
            headers: { "content-type": "application/json; charset=UTF-8" },
            body: JSON.stringify(data)
        }, 'base64');
    },
    
    // ElevenLabs TTS
    elevenLabsTTS(text, settings) {
        this.premiumQueueActive = true;
        const voiceId = settings.elevenLabsVoice || "VR6AewLTigWG4xSOukaG";
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=${settings.latency}`;
        
        const data = {
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
                stability: 0,
                similarity_boost: 0,
                style: 0.5,
                use_speaker_boost: false
            }
        };
        
        this.fetchAudioContent(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "xi-api-key": settings.elevenLabsKey
            },
            body: JSON.stringify(data)
        }, 'blob');
    },
    
    // Speechify TTS
    speechifyTTS(text, settings) {
        this.premiumQueueActive = true;
        const url = "https://api.sws.speechify.com/v1/audio/speech";
        
        const data = {
            input: `<speak>${text}</speak>`,
            voice_id: settings.speechifyVoice || "henry",
            model: settings.lang.startsWith('en') ? "simba-english" : "simba-multilingual",
            audio_format: "mp3"
        };
        
        this.fetchAudioContent(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${settings.speechifyKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }, 'base64');
    },
    
    // Helper function for fetching and playing audio
    async fetchAudioContent(url, options, type) {
        try {
            const response = await fetch(url, options);
            let audioData;
            
            if (type === 'base64') {
                const json = await response.json();
                this.playAudio(`data:audio/mp3;base64,${json.audioContent || json.audio_data}`);
            } else if (type === 'blob') {
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                this.playAudio(blobUrl);
            }
        } catch (error) {
            console.error("Error fetching audio:", error);
            this.finishedAudio();
        }
    },
    
    // Play audio helper
    playAudio(src) {
        if (!this.audio) {
            this.audio = document.createElement("audio");
            this.audio.onended = () => this.finishedAudio();
        }
        
        this.audio.src = src;
        this.audio.volume = this.getSettings().volume;
        
        try {
            this.audio.play();
        } catch (e) {
            console.error("Audio playback failed:", e);
            this.finishedAudio();
        }
    },
    
    // Queue management
    finishedAudio() {
        this.premiumQueueActive = false;
        if (this.premiumQueueTTS.length) {
            this.speak(this.premiumQueueTTS.shift());
        }
    }
};

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

    saveCurrentPoll() {
        const pollName = prompt("Enter a name for this poll preset:", document.querySelector('[data-textsetting="pollQuestion"]').value.trim());
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
