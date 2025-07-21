// This script is injected into the page context to intercept WebSocket connections
(function() {
	const originalWebSocket = window.WebSocket;
	let socketCount = 0;
	
	window.WebSocket = function(...args) {
		const url = args[0];
		socketCount++;
		console.log('[SE-WS] WebSocket #' + socketCount + ' connection to:', url);
		
		const socket = new originalWebSocket(...args);
		
		if (url && url.includes('realtime.streamelements.com')) {
			console.log('[SE-WS] Intercepting StreamElements Socket.IO connection');
			
			socket.addEventListener('message', function(event) {
				// Forward to content script
				window.postMessage({
					source: 'streamelements-ws-interceptor',
					type: 'message',
					data: event.data,
					url: url
				}, '*');
			});
			
			socket.addEventListener('open', function() {
				window.postMessage({
					source: 'streamelements-ws-interceptor',
					type: 'open',
					url: url
				}, '*');
			});
			
			socket.addEventListener('close', function() {
				window.postMessage({
					source: 'streamelements-ws-interceptor',
					type: 'close',
					url: url
				}, '*');
			});
			
			// Intercept send
			const originalSend = socket.send.bind(socket);
			socket.send = function(data) {
				window.postMessage({
					source: 'streamelements-ws-interceptor',
					type: 'send',
					data: data,
					url: url
				}, '*');
				return originalSend(data);
			};
		}
		
		return socket;
	};
	
	// Copy WebSocket properties
	for (let prop in originalWebSocket) {
		if (prop !== 'prototype') {
			try {
				window.WebSocket[prop] = originalWebSocket[prop];
			} catch(e) {}
		}
	}
	window.WebSocket.prototype = originalWebSocket.prototype;
	
	console.log('[SE-WS] WebSocket interceptor installed');
})();