(function () {
	
	
	
	var isExtensionOn = true;
function removeStorage(cname){
		localStorage.removeItem(cname);
	}

	function clearStorage(){
		localStorage.clear();
		if (!session.cleanOutput){
			warnUser("The local storage and saved settings have been cleared", 1000);
		}
	}

	function setStorage(cname, cvalue, hours=9999){ // not actually a cookie
		var now = new Date();
		var item = {
			value: cvalue,
			expiry: now.getTime() + (hours * 60 * 60 * 1000),
		};
		try{
			localStorage.setItem(cname, JSON.stringify(item));
		}catch(e){errorlog(e);}
	}

	function getStorage(cname) {
		try {
			var itemStr = localStorage.getItem(cname);
		} catch(e){
			errorlog(e);
			return;
		}
		if (!itemStr) {
			return "";
		}
		var item = JSON.parse(itemStr);
		var now = new Date();
		if (now.getTime() > item.expiry) {
			localStorage.removeItem(cname);
			return "";
		}
		return item.value;
	}
	
	console.log("Social Stream injected");
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "cmd": "getOnOffState"}, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		try{
			if (typeof response === "object"){
				if (response.streamID){ // this won't update if the stream ID changes, without a page reload at least
					if (response.settings && response.settings.sharestreamid){ // okay, this is true
						//setStorage("roomID", response.streamID);
						document.getElementById("roomId").value = response.streamID;
						
						console.log("roomID updated - auto approved");
						if (document.getElementById("roomId").updatedChatID){
							document.getElementById("roomId").updatedChatID();
						}
					} else {
						var check = confirm("This page is requesting access to your Social Stream chat session ID.\n\nWould you like to give it access?\n\nIt will be able to read and write to your chat streams while the extension is on.");
						if (check){
							//setStorage("roomID", response.streamID);
							document.getElementById("roomId").value = response.streamID;
							console.log("roomID updated");
							if (document.getElementById("roomId").updatedChatID){
								document.getElementById("roomId").updatedChatID();
							}
							chrome.runtime.sendMessage(chrome.runtime.id, {cmd: "saveSetting",  type: "setting", setting: "sharestreamid", "value": true}, function (response) {});
						}
					}
				}
				
				sendResponse(true);
				return;
			}
		} catch(e){}
	});

	
})();
