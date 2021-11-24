var isExtensionOn = false;
console.log("STARTED");


document.addEventListener("DOMContentLoaded", function(event) {
	
	var disableButton = document.getElementById("disableButton");
	console.log("DOMContentLoaded");
	disableButton.onclick = function(){
		console.log("disableButton clicked");
		chrome.extension.sendMessage({cmd: "setOnOffState", data: {value: !isExtensionOn}});
		chrome.extension.sendMessage({cmd: "getOnOffState"}, function (response) {
			update(response);
		});
	};
	
	chrome.extension.sendMessage({cmd: "getSettings"}, function (response) {
		update(response);
	});
	
	chrome.extension.sendMessage({cmd: "getOnOffState"}, function (response) {
		update(response);
	});
	
	var iii = document.querySelectorAll("input[type='checkbox']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}
	
	checkVersion();
});
	
function update(response){
	if (response !== undefined){
		if ("state" in response){
			isExtensionOn = response.state;
			if (isExtensionOn){
				disableButton.innerHTML = "🔌 Disable extension";
				disableButton.className = "button button3";
				disableButton.style.display = "";
				document.body.style.backgroundColor = "#9F9";
				console.log("ENABLE");
				chrome.browserAction.setIcon({path: "/icons/on.png"});
			} else {
				disableButton.innerHTML = "⚡ Enable extension";
				disableButton.className = "button button1";
				disableButton.style.display = "";
				document.body.style.backgroundColor = "#F99";
				console.log("DISABLED?");
				chrome.browserAction.setIcon({path: "/icons/off.png"});
			}
			
		}
		if ('streamID' in response){
			//document.getElementById("version").innerHTML = "Stream ID is : "+response.streamID;
			document.getElementById("dock").rawURL = "https://socialstream.ninja/dock.html?session="+response.streamID;
			document.getElementById("dock").innerHTML = "<a target='_blank' id='docklink' href='https://socialstream.ninja/dock.html?session="+response.streamID+"'>https://socialstream.ninja/dock.html?session="+response.streamID+"</a>";
			document.getElementById("overlay").innerHTML = "<a target='_blank' id='overlaylink' href='https://socialstream.ninja/index.html?session="+response.streamID+"'>https://socialstream.ninja/index.html?session="+response.streamID+"</a>";
			document.getElementById("overlay").rawURL = "https://socialstream.ninja/index.html?session="+response.streamID;
		}
		if ('settings' in response){
			console.log(response);
			for (var key in response.settings){
				var ele = document.querySelector("input[data-setting='"+key+"'], input[data-param1='"+key+"'], input[data-param2='"+key+"']");
				if (ele){
					ele.checked = response.settings[key];
					updateSettings(ele);
				}
			}
		}
	}
}

function checkVersion(){
	//chrome-extension://[
	fetch('https://raw.githubusercontent.com/steveseguin/social_stream/main/manifest.json').then(response => response.json()).then(data => {
		var manifestData = chrome.runtime.getManifest();
		if ("version" in data){
			if (manifestData.version !== data.version){
				document.getElementById("newVersion").innerHTML = "<b>There's a new version of Social Stream <a target='_blank' href='https://github.com/steveseguin/social_stream/'>available here</a>.</b>";
			} else {
				document.getElementById("newVersion").innerHTML = "";
			}
		}
		console.log(data)
	});
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
		} else {
			document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace(ele.dataset.param1, "");
		}
		
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("&&", "&");
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("?&", "?");
		chrome.extension.sendMessage({cmd: "saveSetting", setting: ele.dataset.param1, "value": ele.checked}, function (response) {});
	} else if (ele.dataset.param2){
		if (ele.checked){
			document.getElementById("overlay").rawURL = updateURL(ele.dataset.param2, document.getElementById("overlay").rawURL);
		} else {
			document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace(ele.dataset.param2, "");
		}
		
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("&&", "&");
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("?&", "?");
		chrome.extension.sendMessage({cmd: "saveSetting", setting: ele.dataset.param2, "value": ele.checked}, function (response) {});
	} else if (ele.dataset.setting){
		chrome.extension.sendMessage({cmd: "saveSetting", setting: ele.dataset.setting, "value": ele.checked}, function (response) {});
		return;
	}
	
	document.getElementById("docklink").innerText = document.getElementById("dock").rawURL;
	document.getElementById("docklink").href = document.getElementById("dock").rawURL;
	
	document.getElementById("overlaylink").innerText = document.getElementById("overlay").rawURL;
	document.getElementById("overlaylink").href = document.getElementById("overlay").rawURL;
	
}












