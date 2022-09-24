function saveOptions(e) {
  e.preventDefault();
  chrome.storage.sync.set({
	streamID: document.querySelector("#streamID").value,
	password: document.querySelector("#password").value,
  });
  
  chrome.runtime.sendMessage({cmd: "sidUpdated", streamID: document.querySelector("#streamID").value, password: document.querySelector("#password").value}, function (response) {});
  
  document.querySelector("#savedButton").innerHTML = "Saved";
}
function generateStreamID(){
	var text = "";
	var possible = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
	for (var i = 0; i < 10; i++){
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	chrome.storage.sync.set({
		streamID: text
	});
	return text;
};
function restoreOptions() {
  var properties = ["streamID", "password"];
  chrome.storage.sync.get(properties, function(result){
	try{
		document.querySelector("#streamID").value = result.streamID || generateStreamID();
	} catch(e){console.error(e);}
	
	try{
		if (result.password){
			document.querySelector("#password").value = result.password;
		} else {
			document.querySelector("#password").value = "";
		}
	} catch(e){console.error(e);}
  });

}

function editedOptions(){
	document.querySelector("#savedButton").innerHTML = "Save";
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
document.querySelector("form").addEventListener("input", editedOptions);