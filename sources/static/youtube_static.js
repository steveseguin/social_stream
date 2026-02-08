
(function() {
		
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		var reader = new FileReader();
		reader.onloadend = function() {
		  callback(reader.result);
		}
		reader.readAsDataURL(xhr.response);
	  };
	  xhr.open('GET', url);
	  xhr.responseType = 'blob';
	  xhr.send();
	}
	
	var isExtensionOn = false;
	
	function pushMessage(data){
		try{
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(e){});
		} catch(e){
		}
	}
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response){
			settings = response.settings;
			applyAudioPickerSetting();
		}
		if ("state" in response){
			isExtensionOn = response.state;
			
			
			if (document.getElementById("startupbutton")){
				if (isExtensionOn){
					document.getElementById("startupbutton").style.display = "block";
				} else {
					document.getElementById("startupbutton").style.display = "none";
				}
			}
			
			if (settings.hidePaidPromotion){
				var style = document.createElement("style");
				style.innerHTML = `
				  .ytp-paid-content-overlay, .ytmPaidContentOverlayLink {
					  display:none!important;
				  }
				`;
				document.head.appendChild(style);
			}
	
		}
	});
	
	
	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try {
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						applyAudioPickerSetting();
					}
					if ("state" in request){
						isExtensionOn = request.state;
						
						if (document.getElementById("startupbutton")){
							if (isExtensionOn){
								document.getElementById("startupbutton").style.display = "block";
							} else {
								document.getElementById("startupbutton").style.display = "none";
							}
						}
						applyAudioPickerSetting();
					}
					sendResponse(true);
					return;
				}
				if ("getSource" == request){sendResponse("youtube");	return;	}
				if ("focusChat" == request){ 
					return;
				}
			} catch(e){}
			sendResponse(false);
		}
	);
	
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		var reader = new FileReader();
		reader.onloadend = function() {
		  callback(reader.result);
		}
		reader.readAsDataURL(xhr.response);
	  };
	  xhr.open('GET', url);
	  xhr.responseType = 'blob';
	  xhr.send();
	}

	function escapeHtml(unsafe){
		try {
			if (settings.textonlymode){ // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				 .replace(/&/g, "&amp;")
				 .replace(/</g, "&lt;")
				 .replace(/>/g, "&gt;")
				 .replace(/"/g, "&quot;")
				 .replace(/'/g, "&#039;") || "";
		} catch(e){
			return "";
		}
	}

	function getAllContentNodes(element) {
		var resp = "";
		
		if (!element.childNodes.length || !element.childNodes){
			return element.textContent || "";
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				resp += node.outerHTML;
			}
		});
		return resp;
	}
	
	function prepMessage(){
		
	  var ele = this.targetEle;
	  
	  var chatname = "";
	  try{
			  chatname = ele.querySelector("#ytd-channel-name #text").innerText.trim();
			  chatname = escapeHtml(chatname);
	  } catch(e){
			chatname = ele.querySelector("#header #author-text").innerText.trim();
			chatname = chatname.replace("@", "");
			chatname = escapeHtml(chatname);
	  }
	  
	  
	  var chatimg="";
	  try{
		 chatimg = ele.querySelector("#author-thumbnail #img[src]").src;
	  } catch(e){
	  }
	  
	  var chatmessage = "";
	  try { 
		  chatmessage = getAllContentNodes(ele.querySelector("#content #content-text"));
	  } catch(e){
		  return;
	  }
	  
	  var chatdonation = false;
	  var chatmembership = false;
	  var chatsticker = false;
	  
	  this.style.backgroundColor = "#CCC";

	  var data = {};
	  data.chatname = chatname;
	  data.chatbadges = "";
	  data.backgroundColor = "";
	  data.textColor = "";
	  data.chatmessage = chatmessage;
	  data.chatimg = chatimg;
	  data.hasDonation = "";
	  data.hasMembership = "";
	  data.contentimg = "";
	  data.textonly = settings.textonlymode || false;
	  data.type = "youtube";
	  
	  if (chatimg){
		  toDataURL(data.chatimg, function(base64Image){ // we upscale
				data.chatimg = data.chatimg.replace("=s32-", "=s256-");  // Increases the resolution of the image
				data.chatimg = data.chatimg.replace("=s64-", "=s256-");
				
				if (base64Image){
					data.backupChatimg = base64Image; // there's code in the index page to fallback if the larger image doens't exist
				}
				pushMessage(data);
			});
	  } else {
		pushMessage(data);
	  }
	};
	
	function checkButtons(){
		
		if (!isExtensionOn){return;}
		
		
		var bases = document.querySelectorAll('#contents ytd-comment-thread-renderer');
		for (var i=0;i<bases.length;i++) {
			try {
				if (!bases[i].dataset.set){
					bases[i].dataset.set=true;
					var button  = document.createElement("button");
					button.onclick = prepMessage;
					button.innerHTML = "Send to SocialStream";
					button.style = "cursor:pointer;border: 0px; transition: all 0.2s linear 0s; border-radius: 100px; padding: 5px 10px; cursor: pointer; display: inline-block; border: 1.5px black solid; background-color: white;";
					button.targetEle = bases[i]
					//bases[i].appendChild(button);
					try{
						bases[i].querySelector('#toolbar').appendChild(button);
					} catch(e){
						
					}
				}
			} catch(e){}
		}
	}
	function startup() {
		checkButtons();
		setInterval(function(){
			checkButtons();
		}, 2000);
	}

	const AUDIO_OUTPUT_BUTTON_ID = "ssn-audio-output-picker";
	const AUDIO_OUTPUT_PANEL_ID = "ssn-audio-output-panel";
	const AUDIO_OUTPUT_SELECT_ID = "ssn-audio-output-select";
	const AUDIO_OUTPUT_STATUS_ID = "ssn-audio-output-status";
	let isPickingAudioOutput = false;
	let hasVisibilityListeners = false;

	function removeAudioOutputButton() {
		const existing = document.getElementById(AUDIO_OUTPUT_BUTTON_ID);
		if (existing) {
			existing.remove();
		}

		const panel = document.getElementById(AUDIO_OUTPUT_PANEL_ID);
		if (panel) {
			panel.remove();
		}
	}

	function getActiveVideo() {
		return document.querySelector(".html5-main-video") || document.querySelector("video");
	}

	function renderAudioOutputPanel(outputs, selectedId) {
		let panel = document.getElementById(AUDIO_OUTPUT_PANEL_ID);
		if (!panel) {
			panel = document.createElement("div");
			panel.id = AUDIO_OUTPUT_PANEL_ID;
			panel.style = "position: fixed; right: 18px; bottom: 70px; z-index: 2147483647; background: #0f0f0f; color: #fff; border: 1px solid #3ea6ff; border-radius: 10px; padding: 10px; box-shadow: 0 6px 14px rgba(0,0,0,0.35); font-size: 13px; font-family: inherit; min-width: 240px;";

			const header = document.createElement("div");
			header.style = "display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px;";
			const title = document.createElement("span");
			title.textContent = "Audio output";
			const close = document.createElement("button");
			close.type = "button";
			close.textContent = "✕";
			close.style = "background: transparent; border: none; color: #fff; cursor: pointer; font-size: 14px; padding: 0 4px;";
			close.addEventListener("click", () => panel.remove());
			header.appendChild(title);
			header.appendChild(close);
			panel.appendChild(header);

			const select = document.createElement("select");
			select.id = AUDIO_OUTPUT_SELECT_ID;
			select.style = "width: 100%; margin-bottom: 6px; background: #121212; color: #fff; border: 1px solid #3ea6ff; border-radius: 6px; padding: 6px;";
			panel.appendChild(select);

			const status = document.createElement("div");
			status.id = AUDIO_OUTPUT_STATUS_ID;
			status.style = "opacity: 0.85;";
			panel.appendChild(status);

			(document.body || document.documentElement).appendChild(panel);
		}

		const selectEl = panel.querySelector("#" + AUDIO_OUTPUT_SELECT_ID);
		const statusEl = panel.querySelector("#" + AUDIO_OUTPUT_STATUS_ID);

		selectEl.innerHTML = "";
		const defaultOpt = document.createElement("option");
		defaultOpt.value = "default";
		defaultOpt.textContent = "System default";
		selectEl.appendChild(defaultOpt);

		outputs.forEach((device, idx) => {
			const opt = document.createElement("option");
			opt.value = device.deviceId;
			opt.textContent = device.label || `Audio output ${idx + 1}`;
			selectEl.appendChild(opt);
		});

		if (selectedId && selectEl.querySelector(`option[value="${selectedId}"]`)) {
			selectEl.value = selectedId;
		} else {
			selectEl.value = "default";
		}

		statusEl.textContent = selectEl.value === "default" ? "Using system default" : `Using ${selectEl.options[selectEl.selectedIndex].textContent}`;

		selectEl.onchange = () => {
			const chosenId = selectEl.value;
			statusEl.textContent = "Switching...";
			applyAudioOutput(chosenId, outputs).then(() => {
				const label = selectEl.options[selectEl.selectedIndex].textContent;
				statusEl.textContent = chosenId === "default" ? "Using system default" : `Using ${label}`;
			}).catch((err) => {
				console.warn("Failed to switch audio output", err);
				statusEl.textContent = err && err.message ? err.message : "Failed to switch output";
			});
		};

		return { panel, selectEl, statusEl };
	}

	async function applyAudioOutput(deviceId, outputs) {
		const video = getActiveVideo();
		if (!video) {
			throw new Error("No video element found on this page.");
		}
		if (typeof video.setSinkId !== "function") {
			throw new Error("Audio output selection is not supported in this browser.");
		}
		await video.setSinkId(deviceId || "default");
	}

	async function listAudioOutputsWithPermission() {
		if (!navigator.mediaDevices) {
			throw new Error("Media devices API is unavailable.");
		}

		let devices = [];
		try {
			devices = await navigator.mediaDevices.enumerateDevices();
		} catch (err) {
			console.warn("enumerateDevices failed before permission", err);
		}

		const hasAudioOutputs = devices.some((d) => d.kind === "audiooutput" && d.deviceId);
		if (!hasAudioOutputs) {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			stream.getTracks().forEach((track) => track.stop());
			devices = await navigator.mediaDevices.enumerateDevices();
		}

		return devices.filter((d) => d.kind === "audiooutput" && d.deviceId);
	}

	function isFullPlayerMode() {
		if (document.fullscreenElement) {
			return true;
		}
		const player = document.querySelector(".html5-video-player");
		// Only hide in actual fullscreen, not theater/cinema mode (which also has ytp-big-mode)
		return !!(player && player.classList.contains("ytp-fullscreen"));
	}

	function syncAudioPickerVisibility() {
		const hide = isFullPlayerMode();
		const button = document.getElementById(AUDIO_OUTPUT_BUTTON_ID);
		const panel = document.getElementById(AUDIO_OUTPUT_PANEL_ID);
		if (button) {
			button.style.display = hide ? "none" : "block";
		}
		if (panel) {
			panel.style.display = hide ? "none" : "";
		}
	}

	function applyAudioPickerSetting() {
		const onWatchPage = window.location.href.startsWith("https://www.youtube.com/watch");
		if (!isExtensionOn || !settings.youtubeAudioPicker || !onWatchPage) {
			removeAudioOutputButton();
			return;
		}
		ensureAudioOutputButton();
	}

	async function pickAudioOutputForCurrentVideo(buttonEl) {
		if (isPickingAudioOutput) {
			return;
		}

		const video = getActiveVideo();
		if (!video) {
			throw new Error("No video element found on this page.");
		}
		if (typeof video.setSinkId !== "function") {
			throw new Error("Audio output selection is not supported in this browser.");
		}
		if (!navigator.mediaDevices) {
			throw new Error("Media devices API is unavailable.");
		}

		isPickingAudioOutput = true;
		const defaultLabel = "Pick audio output";
		buttonEl.disabled = true;
		buttonEl.textContent = "Requesting...";

		try {
			let selectedDeviceId = null;
			if (navigator.mediaDevices.selectAudioOutput) {
				try {
					const selection = await navigator.mediaDevices.selectAudioOutput();
					selectedDeviceId = selection && selection.deviceId;
				} catch (err) {
					console.warn("selectAudioOutput failed or was dismissed", err);
				}
			}

			const outputs = await listAudioOutputsWithPermission();

			if (selectedDeviceId) {
				await applyAudioOutput(selectedDeviceId, outputs);
				buttonEl.textContent = selectedDeviceId === "default" ? "Using system default" : "Audio output set";
				renderAudioOutputPanel(outputs, selectedDeviceId);
				return;
			}

			if (!outputs.length) {
				throw new Error("No audio outputs exposed by the browser.");
			}

			const panel = renderAudioOutputPanel(outputs);
			// Immediately apply the current selection (default) to refresh status.
			await applyAudioOutput(panel.selectEl.value, outputs);
			panel.statusEl.textContent = panel.selectEl.value === "default" ? "Using system default" : `Using ${panel.selectEl.options[panel.selectEl.selectedIndex].textContent}`;
			buttonEl.textContent = "Picker ready";
		} finally {
			isPickingAudioOutput = false;
			buttonEl.disabled = false;
			setTimeout(() => {
				if (buttonEl && buttonEl.isConnected) {
					buttonEl.textContent = defaultLabel;
				}
			}, 2000);
		}
	}

	function ensureAudioOutputButton() {
		if (document.getElementById(AUDIO_OUTPUT_BUTTON_ID)) {
			syncAudioPickerVisibility();
			return;
		}

		const button = document.createElement("button");
		button.id = AUDIO_OUTPUT_BUTTON_ID;
		button.type = "button";
		button.textContent = "Pick audio output";
		button.title = "Select where this tab's audio should play";
		button.style = "position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; background: #0f0f0f; color: #fff; border: 1px solid #3ea6ff; border-radius: 10px; padding: 10px 12px; box-shadow: 0 6px 14px rgba(0,0,0,0.35); cursor: pointer; font-size: 13px; font-family: inherit;";
		button.addEventListener("click", function (event) {
			event.preventDefault();
			pickAudioOutputForCurrentVideo(button).catch((err) => {
				console.warn("Audio output selection failed", err);
				button.textContent = err && err.message ? err.message : "Selection failed";
				setTimeout(() => {
					if (button && button.isConnected) {
						button.textContent = "Pick audio output";
					}
				}, 2500);
			});
		});

		(document.body || document.documentElement).appendChild(button);
		syncAudioPickerVisibility();

		if (!hasVisibilityListeners) {
			hasVisibilityListeners = true;
			document.addEventListener("fullscreenchange", syncAudioPickerVisibility, false);
			window.addEventListener("resize", syncAudioPickerVisibility, false);
		}
	}

	function preStartup(){
		
		applyAudioPickerSetting();
		
		if (!isExtensionOn){
			return;
		}
		
		if (!window.location.href.startsWith("https://www.youtube.com/watch")){
			return;
		}
		
		if (settings.flipYoutube){
			if (document.getElementById("secondary") && !document.getElementById("secondary").done){
				document.getElementById("secondary").done = true;
				
				document.getElementById("below").prepend(document.getElementById("secondary-inner"));
				document.getElementById("secondary-inner").style.position = "unset";
				//document.getElementById("below").appendChild(document.getElementById("bottom-grid"));
				document.getElementById("secondary").style.display = "none";
				
				var style = document.createElement("style");
				style.innerHTML = `
				  ytd-ad-slot-renderer{
					  display:none!important;
				  }
				  #content{ 
					overflow:hidden;
				  }
				  #below {
					display: flex;
					justify-content: space-evenly;
					align-items: flex-start;
					flex-direction: row;
					flex-wrap: nowrap;
				  }
				  .ytd-watch-grid {
					  margin: 0 auto!important;
				  }
				  #below > div {
					  width: 48%;  
					  padding: 0 0 0 2px; 
					  border: 0;
				  }
				  ytd-merch-shelf-renderer{
					  display:none;
				  }
				  #secondary-inner {
					  max-width: 48%;
				  }
				  .html5-video-container{
					  width:100%!important;
					  height:100%!important;
				  }
				  .html5-video-container video {
					   width:100%!important;
					   height:100%!important;
				   }
				`;
				document.head.appendChild(style);
				
			}
		}
		
		if (!document.getElementById("startupbutton")){
			var button  = document.createElement("button");
			button.onclick = function(){
				document.getElementById("startupbutton").remove();
				clearTimeout(preStartupInteval);
				startup();
			};
			button.id = "startupbutton";
			button.innerHTML = "SS";
			button.title = "Enable Social Stream static comment capture support. Turn off the Social stream extension to hide this button";
	
			button.style = "margin-right: 10px; transition: all 0.2s linear 0s; border-radius: 100px; cursor: pointer; display: inline-block; background-color: #FFFA;";
			
			if (!isExtensionOn){
				button.style.display = "none";
			} else {
				button.style.display = "inline-block";
			}
			
			try{
				document.querySelector('#container #buttons').prepend(button);
			} catch (e){
				
			}
		}
	}

	console.log("SOCIAL STREAM STATIC INJECTED");
	

	setTimeout(function(){preStartup();},1000);

	var preStartupInteval = setInterval(function(){preStartup();},5000);

})();







