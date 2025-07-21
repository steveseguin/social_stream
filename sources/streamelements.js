(function() {
	"use strict";

	function log(message, data = null) {
		if (data) {
			console.log(`[StreamElements Interceptor] ${message}`, data);
		} else {
			console.log(`[StreamElements Interceptor] ${message}`);
		}
	}

	// Check if we're in an iframe
	const isIframe = window !== window.top;
	console.log(`SSN injected (iframe: ${isIframe}, location: ${window.location.href})`);
	
	// Debug: Check if Socket.IO is loaded
	let checkCount = 0;
	const checkInterval = setInterval(() => {
		checkCount++;
		
		// Check for Socket.IO
		if (typeof io !== 'undefined') {
			console.log('[StreamElements] Socket.IO found after ' + (checkCount * 500) + 'ms');
			clearInterval(checkInterval);
			
			// Try to intercept Socket.IO connections
			if (io.Manager && io.Manager.prototype.open) {
				const originalOpen = io.Manager.prototype.open;
				io.Manager.prototype.open = function(...args) {
					console.log('[StreamElements] Socket.IO Manager opening connection:', this);
					console.log('[StreamElements] Manager URI:', this.uri);
					console.log('[StreamElements] Manager options:', this.opts);
					return originalOpen.apply(this, args);
				};
			}
			
			// Also intercept io() calls
			const originalIo = window.io;
			window.io = function(...args) {
				console.log('[StreamElements] io() called with:', args);
				const socket = originalIo.apply(this, args);
				console.log('[StreamElements] Socket created:', socket);
				console.log('[StreamElements] Socket URL:', socket.io?.uri || socket.uri);
				return socket;
			};
			// Copy properties
			for (let key in originalIo) {
				window.io[key] = originalIo[key];
			}
		}
		
		// Check for any socket objects in window or on Angular scope
		if (window.socket) {
			console.log('[StreamElements] Found window.socket:', window.socket);
		}
		
		// Check Angular scope if available
		if (window.angular && checkCount === 4) {
			console.log('[StreamElements] Checking Angular for sockets...');
			try {
				const elements = document.querySelectorAll('[ng-controller], [data-ng-controller]');
				elements.forEach(el => {
					const scope = window.angular.element(el).scope();
					if (scope && scope.socket) {
						console.log('[StreamElements] Found socket in Angular scope:', scope.socket);
					}
				});
			} catch (e) {
				console.log('[StreamElements] Error checking Angular:', e);
			}
		}
		
		if (checkCount >= 60) { // Stop after 30 seconds
			clearInterval(checkInterval);
			console.log('[StreamElements] Socket.IO never loaded after 30 seconds');
		}
	}, 500);
	
	// Also check for Socket.IO loading via script tags
	const scriptObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node.tagName === 'SCRIPT' && node.src && node.src.includes('socket.io')) {
					console.log('[StreamElements] Socket.IO script loading:', node.src);
				}
			}
		}
	});
	scriptObserver.observe(document.documentElement, { childList: true, subtree: true });

	// Check if we're running in Electron by looking for ninjafy object
	// The user agent might be spoofed, so check for Electron-specific APIs
	const isElectron = window.ninjafy !== undefined || (typeof process !== 'undefined' && process.versions && process.versions.electron);
	
	// Function to set up Electron WebSocket handling
	function setupElectronWebSocketHandler() {
		if (!window.ninjafy || !window.ninjafy.onWebSocketMessage) {
			return false;
		}
		
		log('Running in Electron, using WebSocket debugger');
		
		window.ninjafy.onWebSocketMessage((event) => {
			// Process based on event type
			if (event.type === 'message') {
				// Parse Socket.IO message format
				try {
					const match = event.data.match(/^(\d+)(.*)$/);
					if (match) {
						const msgType = parseInt(match[1], 10);
						const payload = match[2];
						
						if (msgType === 42 && payload) { // Socket.IO message event
							try {
								const parsed = JSON.parse(payload);
								const eventName = parsed[0];
								const eventData = parsed[1];
								
								
								const messageData = {
									type: "streamelements",
									data: eventData,
									timestamp: Date.now()
								};
								
								// Parse specific event types
								if (eventName === 'event' && eventData) {
									messageData.chatname = eventData.data?.username || eventData.data?.displayName || "";
									messageData.chatimg = eventData.data?.avatar || "";
									messageData.backgroundColor = "";
									messageData.textColor = "";
									messageData.type = eventData?.provider || "streamelements";
									messageData.nameColor = "";
									messageData.chatbadges = [];
									messageData.textonly = false;
									
									if (eventData.type === 'tip' || eventData.type === 'donation') {
										messageData.event = "donation";
										messageData.hasDonation = `$${eventData.data?.amount || 0}`;
										messageData.donoValue = eventData.data?.amount || 0;
										messageData.chatmessage = eventData.data?.message || "";
										messageData.title = "TIP";
										messageData.currency = eventData.data?.currency || "USD";
									} else if (eventData.type === 'follow') {
										messageData.event = "follow";
										messageData.chatmessage = "New follower!";
									}
									// Add more event types as needed
									
									// Send to extension
									chrome.runtime.sendMessage(chrome.runtime.id, {
										"message": messageData
									}, function(response) {
										if (chrome.runtime.lastError) {
											log('Error sending to extension:', chrome.runtime.lastError);
										}
									});
								}
							} catch (e) {
								log('Error parsing Socket.IO payload:', e);
							}
						}
					}
				} catch (e) {
					log('Error processing message:', e);
				}
			} else if (event.type === 'open') {
				chrome.runtime.sendMessage(chrome.runtime.id, {
					"message": {
						type: "streamelements",
						source: "socketio",
						event: "connection_opened",
						url: event.url,
						timestamp: Date.now()
					}
				});
			} else if (event.type === 'close') {
				chrome.runtime.sendMessage(chrome.runtime.id, {
					"message": {
						type: "streamelements",
						source: "socketio",
						event: "connection_closed",
						url: event.url,
						timestamp: Date.now()
					}
				});
			}
		});
		
		// Notify that we're ready
		chrome.runtime.sendMessage(chrome.runtime.id, {
			"message": {
				type: "streamelements",
				source: "socketio",
				event: "interceptor_initialized",
				debuggerMode: true,
				timestamp: Date.now()
			}
		});
		
		return true;
	}
	
	if (isElectron) {
		// Try to set up Electron handler
		if (setupElectronWebSocketHandler()) {
			// Successfully set up
		} else {
			// Wait for ninjafy to be available
			let retries = 0;
			const checkInterval = setInterval(() => {
				retries++;
				if (setupElectronWebSocketHandler()) {
					clearInterval(checkInterval);
				} else if (retries > 20) { // 2 seconds
					clearInterval(checkInterval);
					// Fall back to regular injection
					injectWebSocketInterceptor();
				}
			}, 100);
		}
	} else {
		// Chrome extension mode
		injectWebSocketInterceptor();
	}
	
	function injectWebSocketInterceptor() {
		// Original Chrome extension behavior - inject WebSocket interceptor
		log('Running as Chrome extension, injecting WebSocket interceptor');
		
		// Inject WebSocket interceptor script via web accessible resource
		const script = document.createElement('script');
		script.src = chrome.runtime.getURL('sources/inject/streamelements-ws.js');
		script.async = false; // Execute synchronously to ensure it runs before page scripts
		
		// Try multiple injection points for maximum coverage
		const injectScript = () => {
			const targets = [document.documentElement, document.head, document.body];
			for (const target of targets) {
				if (target && !target.querySelector('script[data-se-interceptor]')) {
					script.setAttribute('data-se-interceptor', 'true');
					target.insertBefore(script, target.firstChild);
					script.onload = function() {
						script.remove();
						log('WebSocket interceptor script injected into ' + target.tagName);
					};
					script.onerror = function() {
						log('Failed to inject WebSocket interceptor script');
					};
					return true;
				}
			}
			return false;
		};
		
		// Try to inject immediately
		if (!injectScript()) {
			// If no suitable element exists yet, wait for one
			const observer = new MutationObserver(function(mutations, obs) {
				if (injectScript()) {
					obs.disconnect();
				}
			});
			observer.observe(document, { childList: true, subtree: true });
		}
	}

	// Only listen for injected script messages in Chrome extension mode
	if (!isElectron) {
		// Listen for messages from injected script
		window.addEventListener('message', function(event) {
			if (event.source !== window) return;
			if (!event.data || event.data.source !== 'streamelements-ws-interceptor') return;

			const { type, data, url } = event.data;

			if (type === 'message') {
				log('Incoming WebSocket message:', data);
				
				try {
					// Parse Socket.IO message format
					const match = data.match(/^(\d+)(.*)$/);
					if (match) {
						const msgType = parseInt(match[1], 10);
						const payload = match[2];
						
						if (msgType === 42 && payload) { // Socket.IO message event
							try {
								const parsed = JSON.parse(payload);
								const eventName = parsed[0];
								const eventData = parsed[1];
								
								
								const messageData = {
									type: "streamelements",
									data: eventData,
									timestamp: Date.now()
								};

								// Parse specific event types
								if (eventName === 'event' && eventData) {
									
									messageData.chatname = eventData.data?.username || eventData.data?.displayName || "";
									messageData.chatimg = eventData.data?.avatar || "";
									messageData.backgroundColor = "";
									messageData.textColor = "";
									messageData.type = eventData?.provider || "streamelements",
									messageData.nameColor = "";
									messageData.chatbadges = [];
									messageData.textonly = false;
									
									if (eventData.type === 'tip' || eventData.type === 'donation') {
										messageData.event = "donation";
										messageData.hasDonation = `$${eventData.data?.amount || 0}`;
										messageData.donoValue = eventData.data?.amount || 0;
										messageData.chatmessage = eventData.data?.message || "";
										messageData.title = "TIP";
										messageData.currency = eventData.data?.currency || "USD";
										
									} else if (eventData.type === 'follow') {
										messageData.event = "follow";
										messageData.chatmessage = "New follower!";
									} else if (eventData.type === 'subscriber' || eventData.type === 'subscription') {
										messageData.event = "new-subscriber";
										messageData.membership = "SUBSCRIBER";
										messageData.subtitle = `${eventData.data?.amount || eventData.data?.months || 1} months`;
										messageData.chatmessage = eventData.data?.message || `Subscribed for ${eventData.data?.amount || 1} months!`;
										if (eventData.data?.gifted || eventData.data?.sender) {
											messageData.event = "giftredemption";
											messageData.chatmessage = `Gift subscription from ${eventData.data?.sender || 'someone'}!`;
										}
									} else if (eventData.type === 'raid' || eventData.type === 'host') {
										messageData.event = eventData.type;
										messageData.chatmessage = `${eventData.type === 'raid' ? 'Raiding' : 'Hosting'} with ${eventData.data?.viewers || eventData.data?.amount || 0} viewers!`;
										messageData.viewers = eventData.data?.viewers || eventData.data?.amount || 0;
									} else if (eventData.type === 'cheer' || eventData.type === 'bits') {
										messageData.event = "donation";
										messageData.hasDonation = `${eventData.data?.amount || 0} bits`;
										messageData.donoValue = (eventData.data?.amount || 0) / 100; // Bits to dollars
										messageData.chatmessage = eventData.data?.message || "";
										messageData.title = "CHEERS";
									} else if (eventData.type === 'message' || eventData.type === 'chat') {
										// Regular chat message
										messageData.event = false;
										messageData.chatmessage = eventData.data?.message || eventData.data?.text || "";
										messageData.userId = eventData.data?.userId || eventData.data?.providerId || "";
									} else if (eventData.type === 'redemption') {
										messageData.event = "reward";
										messageData.chatmessage = `Redeemed ${eventData.data?.redemptionName || 'reward'}`;
										messageData.hasDonation = `${eventData.data?.amount || 0} points`;
									} else if (eventData.type === 'communityGiftPurchase') {
										messageData.event = "giftpurchase";
										messageData.chatmessage = `Gifted ${eventData.data?.amount || 0} subscriptions!`;
									} else {
										// Unknown event type - capture as generic event
										messageData.event = true;
										messageData.chatmessage = `${eventData.type} event`;
									}
								} else if (eventName === 'event:update' && eventData) {
									return;
									// Updates are typically for overlay widgets, not chat
									messageData.streamElementsType = 'update';
									messageData.updateName = eventData.name;
									messageData.event = "update";
									if (eventData.data) {
										messageData.chatname = eventData.data?.name || eventData.data?.displayName || "";
										messageData.amount = eventData.data?.amount;
										messageData.chatimg = eventData.data?.avatar || "";
									}
									// Skip sending updates unless they contain useful info
									if (!eventData.data || !messageData.chatname) {
										return; // Don't send empty updates
									}
								} else if (eventName === 'authenticated') {
									return;
									// Connection event - not a chat message
									messageData.streamElementsType = 'authenticated';
									messageData.channelId = eventData.channelId;
									messageData.clientId = eventData.clientId;
									messageData.event = "connection";
									return; // Skip sending authentication messages to chat
								} else if (eventName === 'event:test') {
									return;
									// Test events from StreamElements
									messageData.event = "test";
									messageData.chatname = eventData.event?.name || "Test User";
									messageData.chatimg = eventData.event?.avatar || "";
									messageData.chatmessage = `Test ${eventData.listener || 'event'}`;
									if (eventData.listener && eventData.listener.includes('tip')) {
										messageData.hasDonation = `$${eventData.event?.amount || 0}`;
										messageData.donoValue = eventData.event?.amount || 0;
										messageData.title = "TEST TIP";
									}
								}
								
								// Send to extension
								chrome.runtime.sendMessage(chrome.runtime.id, {
									"message": messageData
								}, function(response) {
									if (chrome.runtime.lastError) {
										log('Error sending to extension:', chrome.runtime.lastError);
									}
								});
							} catch (e) {
								log('Error parsing Socket.IO payload:', e);
							}
						}
					}
				} catch (e) {
					log('Error processing message:', e);
				}
			} else if (type === 'open') {
				chrome.runtime.sendMessage(chrome.runtime.id, {
					"message": {
						type: "streamelements",
						source: "socketio",
						event: "connection_opened",
						url: url,
						timestamp: Date.now()
					}
				});
			} else if (type === 'close') {
				chrome.runtime.sendMessage(chrome.runtime.id, {
					"message": {
						type: "streamelements",
						source: "socketio",
						event: "connection_closed",
						url: url,
						timestamp: Date.now()
					}
				});
			}
		});
	}

	log('StreamElements interceptor initialized');
	log('Page URL:', window.location.href);
	
	// If we're in the main frame, monitor for iframes that might make Socket.IO connections
	if (!isIframe) {
		// Check for existing iframes on the page
		setTimeout(() => {
			const iframes = document.querySelectorAll('iframe');
			console.log(`[StreamElements] Found ${iframes.length} iframes after 2 seconds`);
			iframes.forEach((iframe, index) => {
				const src = iframe.src || 'no src';
				console.log(`[StreamElements] iframe ${index}: ${src}`);
				// If it's a StreamElements iframe, it might have the Socket.IO connection
				if (src.includes('streamelements.com')) {
					console.log(`[StreamElements] Found StreamElements iframe!`);
				}
			});
		}, 2000);
		
		// Also check again after 10 seconds
		setTimeout(() => {
			const iframes = document.querySelectorAll('iframe');
			console.log(`[StreamElements] Found ${iframes.length} iframes after 10 seconds`);
		}, 10000);
	}

	// Notify extension that interceptor is ready
	chrome.runtime.sendMessage(chrome.runtime.id, {
		"message": {
			type: "streamelements",
			source: "socketio",
			event: "interceptor_initialized",
			timestamp: Date.now()
		}
	});

})();