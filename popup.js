var isExtensionOn = false;

document.addEventListener("DOMContentLoaded", function(event) {
	

	console.log("asdf");
	var disableButton = document.getElementById("disableButton");

	disableButton.onclick = function(){
		chrome.extension.sendMessage({cmd: "setOnOffState", data: {value: !isExtensionOn}});
		
		chrome.extension.sendMessage({cmd: "getOnOffState"}, function (response) {
			update(response)
		});
	};
	
	chrome.extension.sendMessage({cmd: "getOnOffState"}, function (response) {
		update(response)
	});
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
			} else {
				disableButton.innerHTML = "Enable streaming of chat data";
				disableButton.className = "button button1";
				disableButton.style.display = "";
				document.body.style.backgroundColor = "#F99";
			}
		}
		if ('streamID' in response){
			document.getElementById("streamID").innerHTML = "Stream ID is : "+response.streamID;
			document.getElementById("dock").innerHTML = "https://social.overlay.ninja/dock.html?session="+response.streamID;
			document.getElementById("overlay").innerHTML = "https://social.overlay.ninja/?session="+response.streamID;
		}
	}
}