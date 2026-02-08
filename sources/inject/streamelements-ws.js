// Simple WebSocket interceptor for StreamElements - minimal version
(function() {
    
    // Store the original WebSocket constructor
    const originalWebSocket = window.WebSocket;
    
    // Create intercepted WebSocket constructor
    window.WebSocket = function(...args) {
        const url = args[0];
        
        // Create the actual WebSocket
        const socket = new originalWebSocket(...args);
        
        // Only intercept StreamElements connections
        if (url && url.includes('streamelements.com')) {
            
            // Intercept incoming messages
            socket.addEventListener('message', function(event) {
                window.postMessage({
                    source: 'streamelements-ws-interceptor',
                    type: 'message',
                    data: event.data,
                    url: url
                }, '*');
            });
            
            // Intercept connection events
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
            
            // Intercept outgoing messages
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
})();