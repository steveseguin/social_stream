(function() {
	"use strict";

	function log(message, data = null) {
		if (data) {
			console.log(`[StreamElements Interceptor] ${message}`, data);
		} else {
			console.log(`[StreamElements Interceptor] ${message}`);
		}
	}

	// Inject WebSocket interceptor script via web accessible resource
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('sources/inject/streamelements-ws.js');
	
	// Inject at the earliest possible moment
	if (document.documentElement) {
		document.documentElement.appendChild(script);
		script.onload = function() {
			script.remove();
			log('WebSocket interceptor script injected');
		};
		script.onerror = function() {
			log('Failed to inject WebSocket interceptor script');
		};
	} else {
		// If documentElement doesn't exist yet, wait for it
		const observer = new MutationObserver(function(mutations, obs) {
			if (document.documentElement) {
				document.documentElement.appendChild(script);
				script.onload = function() {
					script.remove();
					log('WebSocket interceptor script injected (delayed)');
				};
				obs.disconnect();
			}
		});
		observer.observe(document, { childList: true, subtree: true });
	}

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
							
							log(`Socket.IO Event: ${eventName}`, eventData);
							
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
					} else if (msgType === 0) { // Connect
						log('Socket.IO Connected');
					} else if (msgType === 40) { // Socket.IO Connect
						log('Socket.IO Engine Connected');
					} else if (msgType === 2) { // Ping
						log('Socket.IO Ping');
					} else if (msgType === 3) { // Pong
						log('Socket.IO Pong');
					}
				}
			} catch (e) {
				log('Error processing message:', e);
			}
		} else if (type === 'open') {
			log('WebSocket opened:', url);
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
			log('WebSocket closed:', url);
			chrome.runtime.sendMessage(chrome.runtime.id, {
				"message": {
					type: "streamelements",
					source: "socketio",
					event: "connection_closed",
					url: url,
					timestamp: Date.now()
				}
			});
		} else if (type === 'send') {
			log('Outgoing message:', data);
		}
	});

	log('StreamElements interceptor initialized');
	log('Page URL:', window.location.href);

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