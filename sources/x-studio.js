(function () {
	var MESSAGE_TYPE = "socialstream-x-studio-broadcasts";
	var lastPayload = "";

	function findBroadcasts() {
		var broadcasts = [];
		var seen = {};
		var scripts = document.scripts || [];
		for (var i = 0; i < scripts.length; i++) {
			var text = scripts[i].textContent || "";
			if (text.indexOf("broadcastId") === -1) {
				continue;
			}
			text = text.replace(/\\"/g, '"');
			var pattern = /"broadcastId":"([A-Za-z0-9_-]+)"[\s\S]{0,2000}?"stateName":"([^"]+)"[\s\S]{0,2000}?"ownerScreenName":"([^"]+)"/g;
			var match;
			while ((match = pattern.exec(text))) {
				if (!seen[match[1]]) {
					seen[match[1]] = true;
					broadcasts.push({
						broadcastId: match[1],
						stateName: match[2],
						ownerScreenName: match[3]
					});
				}
			}
		}
		return broadcasts;
	}

	function reportBroadcasts() {
		var broadcasts = findBroadcasts();
		if (!broadcasts.length) {
			return;
		}
		var payload = JSON.stringify(broadcasts);
		if (payload === lastPayload) {
			return;
		}
		lastPayload = payload;
		window.top.postMessage({type: MESSAGE_TYPE, broadcasts: broadcasts}, "*");
	}

	reportBroadcasts();
	var observer = new MutationObserver(reportBroadcasts);
	observer.observe(document.documentElement, {childList: true, subtree: true});
	setTimeout(reportBroadcasts, 1000);
	setTimeout(reportBroadcasts, 3000);
})();
