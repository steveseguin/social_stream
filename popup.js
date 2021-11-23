var isExtensionOn = false;
console.log("STARTED");


document.addEventListener("DOMContentLoaded", function(event) {
	
	var disableButton = document.getElementById("disableButton");
	console.log("DOMContentLoaded");
	disableButton.onclick = function(){
		console.log("disableButton clicked");
		
		chrome.extension.sendMessage({cmd: "setOnOffState", data: {value: !isExtensionOn}});
		chrome.extension.sendMessage({cmd: "getOnOffState"}, function (response) {
			update(response)
			console.log("getOnOffState callbacked");
		});
	};
	
	chrome.extension.sendMessage({cmd: "getOnOffState"}, function (response) {
		update(response)
		console.log("first getOnOffState callbacked");
	});
	
	var iii = document.querySelectorAll("input[type='checkbox']");
	for (var i=0;i<iii.length;i++){
		iii[i].onchange = updateSettings;
	}
	
	checkVersion();
});
	
function update(response){
	console.log(response);
	if (response !== undefined){
		if ("state" in response){
			isExtensionOn = response.state;
			if (isExtensionOn){
				disableButton.innerHTML = "Disable streaming of chat data";
				disableButton.className = "button button3";
				disableButton.style.display = "";
				document.body.style.backgroundColor = "#9F9";
				console.log("ENABLE");
				chrome.browserAction.setIcon({path: "/icons/on.png"});
			} else {
				disableButton.innerHTML = "Enable streaming of chat data";
				disableButton.className = "button button1";
				disableButton.style.display = "";
				document.body.style.backgroundColor = "#F99";
				console.log("DISABLED?");
				chrome.browserAction.setIcon({path: "/icons/off.png"});
			}
			
		}
		if ('streamID' in response){
			document.getElementById("streamID").innerHTML = "Stream ID is : "+response.streamID;
			document.getElementById("dock").rawURL = "https://socialstream.ninja/dock.html?session="+response.streamID;
			document.getElementById("dock").innerHTML = "<a target='_blank' id='docklink' href='https://socialstream.ninja/dock.html?session="+response.streamID+"'>https://socialstream.ninja/dock.html?session="+response.streamID+"</a>";
			document.getElementById("overlay").innerHTML = "<a target='_blank' id='overlaylink' href='https://socialstream.ninja/index.html?session="+response.streamID+"'>https://socialstream.ninja/index.html?session="+response.streamID+"</a>";
			document.getElementById("overlay").rawURL = "https://socialstream.ninja/index.html?session="+response.streamID;
		}
	}
}

function checkVersion(){
	//chrome-extension://[
	fetch('https://raw.githubusercontent.com/steveseguin/social_stream/main/manifest.json').then(response => response.json()).then(data => {
		var manifestData = chrome.runtime.getManifest();
		if ("version" in data){
			if (manifestData.version !== data.version){
				document.getElementById("streamID").innerHTML= "<b>There's a new version of Social Stream <a target='_blank' href='https://github.com/steveseguin/social_stream/'>available here</a>.</b>";
			} else {
				document.getElementById("streamID").innerHTML= "<small>You're using the current version.</small>";
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


	
function updateSettings(){
	if (this.dataset.param1){
		if (this.checked){
			document.getElementById("dock").rawURL = updateURL(this.dataset.param1, document.getElementById("dock").rawURL);
		} else {
			document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace(this.dataset.param1, "");
		}
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("&&", "&");
		document.getElementById("dock").rawURL = document.getElementById("dock").rawURL.replace("?&", "?");
	} else if (this.dataset.param2){
		if (this.checked){
			document.getElementById("overlay").rawURL = updateURL(this.dataset.param2, document.getElementById("overlay").rawURL);
		} else {
			document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace(this.dataset.param2, "");
		}
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("&&", "&");
		document.getElementById("overlay").rawURL = document.getElementById("overlay").rawURL.replace("?&", "?");
	}
	
	document.getElementById("docklink").innerText = document.getElementById("dock").rawURL;
	document.getElementById("docklink").href = document.getElementById("dock").rawURL;
	
	document.getElementById("overlaylink").innerText = document.getElementById("overlay").rawURL;
	document.getElementById("overlaylink").href = document.getElementById("overlay").rawURL;
	
}












