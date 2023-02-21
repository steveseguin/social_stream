var isExtensionOn = false;
document.addEventListener("DOMContentLoaded", async function(event) {
	
	var disableButton = document.getElementById("disableButton");
	disableButton.onclick = function(){
		chrome.runtime.sendMessage({cmd: "setOnOffState", data: {value: !isExtensionOn}});
		chrome.runtime.sendMessage({cmd: "getOnOffState"}, function (response) {
			update(response);
		});
	};
	
	chrome.runtime.sendMessage({cmd: "getSettings"}, function (response) {
		update(response);
	});
	
	chrome.runtime.sendMessage({cmd: "getOnOffState"}, function (response) {
		update(response);
	});
	
	var iii = document.querySelectorAll("input[type='checkbox']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}
	
	var iii = document.querySelectorAll("input[type='text']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}
	
	var iii = document.querySelectorAll("button[data-action]");
	for (var i=0;i<iii.length;i++){
		iii[i].onclick = function(){
			var msg = {};
			msg.cmd = this.dataset.action;
			msg.value = this.dataset.value || null;
			chrome.runtime.sendMessage(msg, function (response) { // actions have callbacks? maybe
				update(response);
			});
		};
	}
	
	
	document.getElementById("ytcopy").onclick = async function(){
		document.getElementById("ytcopy").innerHTML = "Copying..";
		var YoutubeChannel = document.querySelector('input[data-textsetting="youtube_username"]').value;
		if (!YoutubeChannel){return;}
		
		if (!YoutubeChannel.startsWith("@")){
			YoutubeChannel = "@"+YoutubeChannel;
		}
		
		fetch("https://www.youtube.com/c/"+YoutubeChannel+"/live").then((response) => response.text()).then((data) => {
			document.getElementById("ytcopy").innerHTML = "Copying...";
			try{
				var videoID = data.split('{"videoId":"')[1].split('"')[0];
				console.log(videoID);
				if (videoID){
					navigator.clipboard.writeText(videoID).then(() => {
						document.getElementById("ytcopy").innerHTML = "Copied";
					}, () => {
						document.getElementById("ytcopy").innerHTML = "Failed to copy";
					});
				}
			} catch(e){
				document.getElementById("ytcopy").innerHTML = "Video not found";
			}
		});
	};
	
	checkVersion();
});
	
function update(response){
	if (response !== undefined){
		if ("state" in response){
			isExtensionOn = response.state;
			if (isExtensionOn){
				document.body.className = "extension-enabled";
				document.getElementById("disableButtonText").innerHTML = "⚡ Extension active";
				disableButton.style.display = "";
				document.getElementById("extensionState").checked = true;
				chrome.browserAction.setIcon({path: "/icons/on.png"});
			} else {
				document.getElementById("disableButtonText").innerHTML = "🔌 Extension Disabled";
				document.body.className = "extension-disabled";
				disableButton.style.display = "";
				chrome.browserAction.setIcon({path: "/icons/off.png"});
				document.getElementById("extensionState").checked = null;
			}
		}
		
		var password = "";
		if ('password' in response && response.password){
			password = "&password="+response.password;
		}
		
		if ('streamID' in response){
			//document.getElementById("version").innerHTML = "Stream ID is : "+response.streamID;
			document.getElementById("dock").rawURL = "https://socialstream.ninja/dock.html?session="+response.streamID+password;
			document.getElementById("dock").innerHTML = "<a target='_blank' id='docklink' href='https://socialstream.ninja/dock.html?session="+response.streamID+password+"'>https://socialstream.ninja/dock.html?session="+response.streamID+password+"</a>";
			
			document.getElementById("overlay").innerHTML = "<a target='_blank' id='overlaylink' href='https://socialstream.ninja/index.html?session="+response.streamID+password+"'>https://socialstream.ninja/index.html?session="+response.streamID+password+"</a>";
			document.getElementById("overlay").rawURL = "https://socialstream.ninja/index.html?session="+response.streamID+password;
			
			document.getElementById("emoteswall").innerHTML = "<a target='_blank' id='emoteswalllink' href='https://socialstream.ninja/emotes.html?session="+response.streamID+password+"'>https://socialstream.ninja/emotes.html?session="+response.streamID+password+"</a>";
			document.getElementById("emoteswall").rawURL = "https://socialstream.ninja/emotes.html?session="+response.streamID+password;
			
			document.getElementById("remote_control_url").href='https://socialstream.ninja/sampleapi.html?session='+response.streamID;
		}
		
		if ('settings' in response){
			for (var key in response.settings){
				
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
							updateSettings(ele);
						}
					}
					if ("param2" in response.settings[key]){
						var ele = document.querySelector("input[data-param2='"+key+"']");
						if (ele){
							ele.checked = response.settings[key].param2;
							updateSettings(ele);
						}
					}
					if ("param3" in response.settings[key]){
						var ele = document.querySelector("input[data-param3='"+key+"']");
						if (ele){
							ele.checked = response.settings[key].param3;
							updateSettings(ele);
						}
					}
					if ("both" in response.settings[key]){
						var ele = document.querySelector("input[data-both='"+key+"']");
						if (ele){
							ele.checked = response.settings[key].both;
							updateSettings(ele);
						}
					} 
					if ("setting" in response.settings[key]){
						var ele = document.querySelector("input[data-setting='"+key+"']");
						if (ele){
							ele.checked = response.settings[key].setting;
							updateSettings(ele);
						}
					} 
					if ("textsetting" in response.settings[key]){
						var ele = document.querySelector("input[data-textsetting='"+key+"']");
						if (ele){
							ele.value = response.settings[key].textsetting;
							updateSettings(ele);
						}
					} 
					if ("textparam1" in response.settings[key]){
						var ele = document.querySelector("input[data-textparam1='"+key+"']");
						if (ele){
							ele.value = response.settings[key].textparam1;
							updateSettings(ele);
						}
					}
				
				} else { // obsolete method
					var ele = document.querySelector("input[data-setting='"+key+"'], input[data-param1='"+key+"'], input[data-param2='"+key+"']");
					if (ele){
						ele.checked = response.settings[key];
						updateSettings(ele);
					}
					var ele = document.querySelector("input[data-textsetting='"+key+"'], input[data-textparam1='"+key+"']");
					if (ele){
						ele.value = response.settings[key];
						updateSettings(ele);
					}
				}
			}
		}
	}
}

function checkVersion(){
	try {
		fetch('https://raw.githubusercontent.com/steveseguin/social_stream/main/manifest.json').then(response => response.json()).then(data => {
			var manifestData = chrome.runtime.getManifest();
			if ("version" in data){
				if (manifestData.version !== data.version){
					document.getElementById("newVersion").classList.add('show')
					document.getElementById("newVersion").innerHTML = `There's a <a target='_blank' style='text-decoration: underline;' title="Download the latest version as a zip" href='https://github.com/steveseguin/social_stream/archive/refs/heads/main.zip'>new version available</a><p class="installed"><span>Installed: ${manifestData.version}</span><span>Available: ${data.version}</span><a title="See the list of recent code changes" href="https://github.com/steveseguin/social_stream/commits/main" target='_blank' style='text-decoration: underline;'>[change log]</a>`;
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
	
function updateSettings(ele){
	if (ele.target){
		ele = this;
	}
	if (ele.dataset.param1){
		if (ele.checked){
			document.getElementById("dock").rawURL = updateURL(ele.dataset.param1, document.getElementById("dock").rawURL);
			
			if (ele.dataset.param1 == "darkmode"){
				var key = "lightmode";
				var ele = document.querySelector("input[data-param1='"+key+"']");
				if (ele && ele.checked){
					ele.checked = false;
					updateSettings(ele);
				}
				
			} else if (ele.dataset.param1 == "lightmode"){
				var key = "darkmode";
				var ele = document.querySelector("input[data-param1='"+key+"']");
				if (ele && ele.checked){
					ele.checked = false;
					updateSettings(ele);
				}
			}
			
		} else {
			document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace(ele.dataset.param1, "");
		}
		
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("&&", "&");
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("?&", "?");
		chrome.runtime.sendMessage({cmd: "saveSetting",  type: "param1", setting: ele.dataset.param1, "value": ele.checked}, function (response) {});
		
	} else if (ele.dataset.textparam1){
		if (ele.value){
			document.getElementById("dock").rawURL = updateURL(ele.dataset.textparam1+"="+encodeURIComponent(ele.value), document.getElementById("dock").rawURL);
		} else {
			var tmp = document.getElementById("dock").rawURL.split("&"+ele.dataset.textparam1);
			if (tmp.length>1){
				var tt = tmp[1].split("&");
				if (tt.length){
					tt.shift();
				}
				tt = tt.join("&");
				document.getElementById("dock").rawURL = tmp[0] + tt;
			} else {
				document.getElementById("dock").rawURL = tmp[0];
			}
		}
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("&&", "&");
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("?&", "?");
		chrome.runtime.sendMessage({cmd: "saveSetting", type: "textparam1", setting: ele.dataset.textparam1, "value": ele.value}, function (response) {});
		
	} else if (ele.dataset.param2){
		if (ele.checked){
			document.getElementById("overlay").rawURL = updateURL(ele.dataset.param2, document.getElementById("overlay").rawURL);
		} else {
			document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace(ele.dataset.param2, "");
		}
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("&&", "&");
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("?&", "?");
		chrome.runtime.sendMessage({cmd: "saveSetting", type: "param2", setting: ele.dataset.param2, "value": ele.checked}, function (response) {});
		
	} else if (ele.dataset.param3){
		if (ele.checked){
			document.getElementById("emoteswall").rawURL = updateURL(ele.dataset.param3, document.getElementById("emoteswall").rawURL);
		} else {
			document.getElementById("emoteswall").rawURL = document.getElementById("emoteswall").rawURL.replace(ele.dataset.param3, "");
		}
		document.getElementById("emoteswall").rawURL = document.getElementById("emoteswall").rawURL.replace("&&", "&");
		document.getElementById("emoteswall").rawURL = document.getElementById("emoteswall").rawURL.replace("?&", "?");
		chrome.runtime.sendMessage({cmd: "saveSetting", type: "param3", setting: ele.dataset.param3, "value": ele.checked}, function (response) {});	
		
	} else if (ele.dataset.both){
		if (ele.checked){
			document.getElementById("overlay").rawURL = updateURL(ele.dataset.both, document.getElementById("overlay").rawURL);
			document.getElementById("dock").rawURL = updateURL(ele.dataset.both, document.getElementById("dock").rawURL);
		} else {
			document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace(ele.dataset.both, "");
			document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace(ele.dataset.both, "");
		}
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("&&", "&");
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("?&", "?");
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("&&", "&");
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("?&", "?");
		chrome.runtime.sendMessage({cmd: "saveSetting",  type: "both", setting: ele.dataset.both, "value": ele.checked}, function (response) {});
		
	} else if (ele.dataset.setting){
		chrome.runtime.sendMessage({cmd: "saveSetting",  type: "setting", setting: ele.dataset.setting, "value": ele.checked}, function (response) {});
		return;
		
	} else if (ele.dataset.textsetting){
		chrome.runtime.sendMessage({cmd: "saveSetting", type: "textsetting", setting: ele.dataset.textsetting, "value": ele.value}, function (response) {});
		return;
	}
	
	document.getElementById("docklink").innerText = document.getElementById("dock").rawURL;
	document.getElementById("docklink").href = document.getElementById("dock").rawURL;
	
	document.getElementById("overlaylink").innerText = document.getElementById("overlay").rawURL;
	document.getElementById("overlaylink").href = document.getElementById("overlay").rawURL;
	
	document.getElementById("emoteswalllink").innerText = document.getElementById("emoteswall").rawURL;
	document.getElementById("emoteswalllink").href = document.getElementById("emoteswall").rawURL;
}












