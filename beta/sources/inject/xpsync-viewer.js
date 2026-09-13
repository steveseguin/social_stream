(function () {
	if (window.__SSN_XPSYNC_VIEWER_BRIDGE__){return;}
	window.__SSN_XPSYNC_VIEWER_BRIDGE__ = true;

	var activeVideoId = "";
	var pendingViewerCount = null;
	var publicViewerCount = null;

	function parseCount(value){
		if (typeof value === "number" && isFinite(value)){
			return Math.max(0, Math.floor(value));
		}
		if (typeof value === "string"){
			var parsed = parseInt(value.replace(/[^0-9.-]/g, ""), 10);
			if (!isNaN(parsed)){return Math.max(0, parsed);}
		}
		return null;
	}

	function publish(){
		var root = document.documentElement;
		if (!root || publicViewerCount === null){return;}
		if (publicViewerCount === false){
			root.setAttribute("data-ssn-xpsync-viewer-count", "0");
			root.setAttribute("data-ssn-xpsync-viewer-hidden", "true");
			try { document.dispatchEvent(new CustomEvent("ssn-xpsync-viewer-count", {detail: "0"})); } catch(e){}
			return;
		}
		if (pendingViewerCount === null){return;}
		root.setAttribute("data-ssn-xpsync-viewer-count", String(pendingViewerCount));
		root.removeAttribute("data-ssn-xpsync-viewer-hidden");
		try { document.dispatchEvent(new CustomEvent("ssn-xpsync-viewer-count", {detail: String(pendingViewerCount)})); } catch(e){}
	}

	function recordsFrom(payload){
		if (Array.isArray(payload)){return payload;}
		if (payload && typeof payload === "object"){return [payload];}
		return [];
	}

	function rememberVideo(record){
		if (!record || typeof record !== "object" || !Object.prototype.hasOwnProperty.call(record, "view_count")){return;}
		if (activeVideoId && record.id && String(record.id) !== activeVideoId){return;}
		if (record.id){activeVideoId = String(record.id);}
		pendingViewerCount = record.is_live === false ? 0 : parseCount(record.view_count);
		publish();
	}

	function rememberProfile(record){
		if (!record || typeof record !== "object" || !Object.prototype.hasOwnProperty.call(record, "show_live_viewer_count")){return;}
		publicViewerCount = record.show_live_viewer_count !== false;
		publish();
	}

	function inspectPayload(url, payload){
		url = String(url || "");
		if (url.indexOf("/rest/v1/videos") > -1){
			recordsFrom(payload).forEach(rememberVideo);
		} else if (url.indexOf("/rest/v1/profiles") > -1){
			recordsFrom(payload).forEach(rememberProfile);
		}
	}

	function inspectResponse(url, response){
		if (!response || typeof response.clone !== "function"){return;}
		if (String(url).indexOf("/rest/v1/videos") === -1 && String(url).indexOf("/rest/v1/profiles") === -1){return;}
		try {
			response.clone().json().then(function(payload){inspectPayload(url, payload);}).catch(function(){});
		} catch(e){}
	}

	if (typeof window.fetch === "function"){
		var originalFetch = window.fetch;
		window.fetch = function(){
			var request = arguments[0];
			var url = request && request.url ? request.url : request;
			return originalFetch.apply(this, arguments).then(function(response){
				inspectResponse(url, response);
				return response;
			});
		};
	}

	if (typeof window.WebSocket === "function"){
		var OriginalWebSocket = window.WebSocket;
		var WrappedWebSocket = function(url, protocols){
			var socket = arguments.length > 1 ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
			try {
				socket.addEventListener("message", function(event){
					if (typeof event.data !== "string" || event.data.indexOf("view_count") === -1 || event.data.indexOf("videos") === -1){return;}
					try {
						var message = JSON.parse(event.data);
						var payload = message && message.payload;
						var data = payload && payload.data ? payload.data : payload;
						var table = data && data.table ? data.table : payload && payload.table;
						if (table !== "videos"){return;}
						rememberVideo(data.record || data.new || payload.record || payload.new);
					} catch(e){}
				});
			} catch(e){}
			return socket;
		};
		WrappedWebSocket.prototype = OriginalWebSocket.prototype;
		["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function(key){
			try { WrappedWebSocket[key] = OriginalWebSocket[key]; } catch(e){}
		});
		window.WebSocket = WrappedWebSocket;
	}
})();
