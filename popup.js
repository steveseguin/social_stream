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
			document.getElementById("dock").innerHTML = "<a target='_blank' href='https://socialstream.ninja/dock.html?session="+response.streamID+"'>https://socialstream.ninja/dock.html?session="+response.streamID+"</a>";
			document.getElementById("overlay").innerHTML = "<a target='_blank' href='https://socialstream.ninja/index.html?session="+response.streamID+"'>https://socialstream.ninja/index.html?session="+response.streamID+"</a>";
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
	













