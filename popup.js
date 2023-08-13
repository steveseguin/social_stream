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
	

	var iii = document.querySelectorAll("input[type='checkbox']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}

	var iii = document.querySelectorAll("input[type='text']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}
	
	var iii = document.querySelectorAll("input[type='number']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}
	
	var iii = document.querySelectorAll("select");
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
				console.log(videoID);
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
			
			document.getElementById("hypemeter").innerHTML = "<a target='_blank' id='hypemeterlink' href='https://socialstream.ninja/hype.html?session="+response.streamID+password+"'>https://socialstream.ninja/hype.html?session="+response.streamID+password+"</a>";
			document.getElementById("hypemeter").rawURL = "https://socialstream.ninja/hype.html?session="+response.streamID+password;

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
					if ("param4" in response.settings[key]){
						var ele = document.querySelector("input[data-param4='"+key+"']");
						if (ele){
							ele.checked = response.settings[key].param4;
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
					if ("numbersetting" in response.settings[key]){
						var ele = document.querySelector("input[data-numbersetting='"+key+"']");
						console.log(ele);
						if (ele){
							ele.value = response.settings[key].numbersetting;
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
					if ("optionparam1" in response.settings[key]){
						var ele = document.querySelector("select[data-optionparam1='"+key+"']");
						if (ele){
							ele.value = response.settings[key].optionparam1;
							updateSettings(ele);
						}
					}
					if ("optionparam2" in response.settings[key]){
						var ele = document.querySelector("select[data-optionparam2='"+key+"']");
						if (ele){
							ele.value = response.settings[key].optionparam2;
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
				if (compareVersions(manifestData.version, data.version)==-1){
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
				var ele1 = document.querySelector("input[data-param1='"+key+"']");
				if (ele1 && ele1.checked){
					ele1.checked = false;
					updateSettings(ele1);
				}

			} else if (ele.dataset.param1 == "lightmode"){
				var key = "darkmode";
				var ele1 = document.querySelector("input[data-param1='"+key+"']");
				if (ele1 && ele1.checked){
					ele1.checked = false;
					updateSettings(ele1);
				}
			}
		} else {
			document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace(ele.dataset.param1, "");
		}
		
		if (ele.dataset.param1 == "compact"){ // duplicate
			var key = "compact";
			document.querySelectorAll("input[data-param1='"+key+"']").forEach(EL=>{ // sync
				EL.checked = ele.checked;
			});
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
	} else if (ele.dataset.optionparam1){
		
		var tmp = document.getElementById("dock").rawURL.split("&"+ele.dataset.optionparam1);
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
		document.getElementById("dock").rawURL = updateURL(ele.dataset.optionparam1+"="+encodeURIComponent(ele.value), document.getElementById("dock").rawURL);
		
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("&&", "&");
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("?&", "?");
		chrome.runtime.sendMessage({cmd: "saveSetting", type: "optionparam1", setting: ele.dataset.optionparam1, "value": ele.value}, function (response) {});
	} else if (ele.dataset.optionparam2){
		
		var tmp = document.getElementById("overlay").rawURL.split("&"+ele.dataset.optionparam2);
		if (tmp.length>1){
			var tt = tmp[1].split("&");
			if (tt.length){
				tt.shift();
			}
			tt = tt.join("&");
			document.getElementById("overlay").rawURL = tmp[0] + tt;
		} else {
			document.getElementById("overlay").rawURL = tmp[0];
		}
		document.getElementById("overlay").rawURL = updateURL(ele.dataset.optionparam2+"="+encodeURIComponent(ele.value), document.getElementById("overlay").rawURL);
		
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("&&", "&");
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("?&", "?");
		chrome.runtime.sendMessage({cmd: "saveSetting", type: "optionparam2", setting: ele.dataset.optionparam2, "value": ele.value}, function (response) {});
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
	} else if (ele.dataset.param4){
		if (ele.checked){
			document.getElementById("hypemeter").rawURL = updateURL(ele.dataset.param4, document.getElementById("hypemeter").rawURL);
		} else {
			document.getElementById("hypemeter").rawURL = document.getElementById("hypemeter").rawURL.replace(ele.dataset.param4, "");
		}
		document.getElementById("hypemeter").rawURL = document.getElementById("hypemeter").rawURL.replace("&&", "&");
		document.getElementById("hypemeter").rawURL = document.getElementById("hypemeter").rawURL.replace("?&", "?");
		chrome.runtime.sendMessage({cmd: "saveSetting", type: "param4", setting: ele.dataset.param4, "value": ele.checked}, function (response) {});
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
	} else if (ele.dataset.numbersetting){
		console.log("saving: "+ele.dataset.numbersetting);
		chrome.runtime.sendMessage({cmd: "saveSetting", type: "numbersetting", setting: ele.dataset.numbersetting, "value": ele.value}, function (response) {});
		return;
	}

	document.getElementById("docklink").innerText = document.getElementById("dock").rawURL;
	document.getElementById("docklink").href = document.getElementById("dock").rawURL;

	document.getElementById("overlaylink").innerText = document.getElementById("overlay").rawURL;
	document.getElementById("overlaylink").href = document.getElementById("overlay").rawURL;

	document.getElementById("emoteswalllink").innerText = document.getElementById("emoteswall").rawURL;
	document.getElementById("emoteswalllink").href = document.getElementById("emoteswall").rawURL;
	
	document.getElementById("hypemeterlink").innerText = document.getElementById("hypemeter").rawURL;
	document.getElementById("hypemeterlink").href = document.getElementById("hypemeter").rawURL;
}












