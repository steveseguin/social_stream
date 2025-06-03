// Stage TEN Chat Integration for Social Stream Ninja (Standalone WebSocket Version)
try {
    // Configuration
    const ENVIRONMENT = "app";
    const PLUGIN_SERVICE_URL = `https://${ENVIRONMENT}.stageten.tv/apis/plugin-service/graphql`;
    const PUBNUB_PUBLISH_KEY = "pub-c-ea234664-95de-41ed-818f-ddc24ab1d416";
    const PUBNUB_SUBSCRIBE_KEY = "sub-c-e68f9ce2-f0ae-11eb-a38f-7e76ce3f98e8";
    
    let pubnubClient = null;
    let currentChannelId = null;
    let currentCredentials = null;
    let tokenRefreshTimeout = null;
    let connectionStartTime = null;
    let messageCount = 0;
    let activeUsers = new Set();
    let settings = {};
    let isExtensionOn = true;

    // Check if we're running in the extension context
    const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

    // Listen for messages from the extension if running in that context
    if (isExtension) {
        window.addEventListener('stagetenMessage', function(e) {
            if (e.detail) {
                pushMessage(e.detail);
            }
        });

        // Handle extension messages
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            try {
                if (request === "getSource") {
                    sendResponse("stageten");
                    return;
                }
                
                if (request === "focusChat") {
                    const inputElement = document.getElementById('input-text');
                    if (inputElement) {
                        inputElement.focus();
                        sendResponse(true);
                    } else {
                        sendResponse(false);
                    }
                    return;
                }
                
                if (typeof request === "object") {
                    if ("state" in request) {
                        isExtensionOn = request.state;
                    }
                    if ("settings" in request) {
                        settings = request.settings;
                        sendResponse(true);
                        return;
                    }
                }
            } catch(e) {
                console.error('Error handling Chrome message:', e);
            }
            sendResponse(false);
        });

        // Get initial settings
        chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response) {
            if (!response) return;
            
            if ("settings" in response) {
                settings = response.settings;
            }
            if ("state" in response) {
                isExtensionOn = response.state;
            }
        });
    }

    function pushMessage(data) {
        if (isExtension) {
            try {
                chrome.runtime.sendMessage(chrome.runtime.id, { 
                    "message": data 
                }, function(response) {
                    // Handle response if needed
                });
            } catch(e) {
                console.error('Error sending message to socialstream:', e);
            }
        } else {
            // In standalone mode, just log the message
            console.log('Chat message:', data);
        }
    }

    function escapeHtml(unsafe) {
        try {
            if (settings.textonlymode) {
                return unsafe;
            }
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;") || "";
        } catch (e) {
            return "";
        }
    }

    async function getChatCredentials(channelId) {
        try {
            const response = await fetch(PLUGIN_SERVICE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-s10-channel-id": channelId,
                },
                body: JSON.stringify({
                    operationName: "getPublicChatAccess",
                    variables: {},
                    query: `query getPublicChatAccess {
                        chat_publicChatAccess {
                            userId
                            pubnubAccessToken
                            roomKey
                        }
                    }`
                }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data?.data?.chat_publicChatAccess;
        } catch (error) {
            console.error('Error fetching chat credentials:', error);
            return null;
        }
    }

    function scheduleTokenRefresh(client, credentials) {
        try {
            const parsedToken = client.parseToken(credentials.pubnubAccessToken);
            const tokenExpirationDate = new Date(
                parsedToken.timestamp * 1000 + parsedToken.ttl * 1000 * 60
            );
            
            const now = new Date();
            const timeUntilExpiration = tokenExpirationDate.getTime() - now.getTime();
            
            // Refresh 5 minutes before expiration
            const refreshTime = Math.max(0, timeUntilExpiration - 5 * 60 * 1000);
            
            if (tokenRefreshTimeout) {
                clearTimeout(tokenRefreshTimeout);
            }
            
            tokenRefreshTimeout = setTimeout(async () => {
                console.log("Refreshing PubNub token...");
                await refreshToken();
            }, refreshTime);
            
            // Update UI with token expiry
            updateTokenExpiry(tokenExpirationDate);
            
            console.log(`Token will be refreshed in ${Math.floor(refreshTime / 1000 / 60)} minutes`);
        } catch (error) {
            console.error('Error scheduling token refresh:', error);
        }
    }

    async function refreshToken() {
        if (!currentChannelId) return;
        
        const newCredentials = await getChatCredentials(currentChannelId);
        if (newCredentials && pubnubClient) {
            currentCredentials = newCredentials;
            pubnubClient.setToken(newCredentials.pubnubAccessToken);
            scheduleTokenRefresh(pubnubClient, newCredentials);
            console.log("Token refreshed successfully");
        } else {
            console.error("Failed to refresh token");
            disconnect();
        }
    }

    function updateUI(element, value) {
        const el = document.getElementById(element);
        if (el) el.textContent = value;
    }

    function updateConnectionStatus(connected) {
        const pubnubStatus = document.getElementById('pubnub-status');
        const channelStatus = document.getElementById('channel-status');
        
        if (pubnubStatus) {
            pubnubStatus.textContent = connected ? 'Connected' : 'Disconnected';
            pubnubStatus.className = connected ? 'status-connected' : 'status-disconnected';
        }
        
        if (channelStatus) {
            channelStatus.textContent = connected ? currentChannelId : 'Not connected';
            channelStatus.className = connected ? 'status-connected' : 'status-disconnected';
        }
    }

    function updateTokenExpiry(expiryDate) {
        const tokenExpiry = document.getElementById('token-expiry');
        if (tokenExpiry) {
            tokenExpiry.textContent = expiryDate.toLocaleTimeString();
        }
    }

    function updateUptime() {
        if (!connectionStartTime) return;
        
        const now = Date.now();
        const uptimeMs = now - connectionStartTime;
        const uptimeMinutes = Math.floor(uptimeMs / 60000);
        const uptimeSeconds = Math.floor((uptimeMs % 60000) / 1000);
        
        updateUI('uptime', `${uptimeMinutes}:${uptimeSeconds.toString().padStart(2, '0')}`);
    }

    function addToChat(authorName, message, isSystem = false) {
        const textarea = document.getElementById('textarea');
        if (!textarea) return;
        
        const messageDiv = document.createElement('div');
        if (isSystem) {
            messageDiv.style.color = '#00d4aa';
            messageDiv.style.fontStyle = 'italic';
            messageDiv.textContent = message;
        } else {
            messageDiv.innerHTML = `<strong>${escapeHtml(authorName)}</strong>: ${escapeHtml(message)}`;
        }
        
        textarea.appendChild(messageDiv);
        
        // Keep only last 100 messages
        while (textarea.children.length > 100) {
            textarea.removeChild(textarea.firstChild);
        }
        
        // Auto-scroll to bottom
        textarea.scrollTop = textarea.scrollHeight;
    }

    function addEvent(text) {
        const eventsList = document.getElementById('events-list');
        if (!eventsList) return;
        
        const event = document.createElement('div');
        event.className = 'event-item';
        event.textContent = text;
        eventsList.insertBefore(event, eventsList.firstChild);
        
        // Keep only last 10 events
        while (eventsList.children.length > 10) {
            eventsList.removeChild(eventsList.lastChild);
        }
    }

    async function connect(channelId) {
        if (!channelId) {
            console.error('No channel ID provided');
            addToChat('System', 'Please enter a channel ID', true);
            return;
        }
        
        // Disconnect if already connected
        if (pubnubClient) {
            disconnect();
        }
        
        currentChannelId = channelId;
        updateUI('current-channel', `Connecting to ${channelId}...`);
        addToChat('System', `Connecting to channel ${channelId}...`, true);
        
        try {
            // Get chat credentials
            const credentials = await getChatCredentials(channelId);
            if (!credentials) {
                throw new Error('Failed to get chat credentials');
            }
            
            currentCredentials = credentials;
            
            // Initialize PubNub client
            pubnubClient = new PubNub({
                userId: credentials.userId,
                publishKey: PUBNUB_PUBLISH_KEY,
                subscribeKey: PUBNUB_SUBSCRIBE_KEY,
            });
            
            // Set the access token
            pubnubClient.setToken(credentials.pubnubAccessToken);
            
            // Subscribe to the channel
            pubnubClient.subscribe({ channels: [credentials.roomKey] });
            
            // Register listeners
            pubnubClient.addListener({
                message: handleMessage,
                messageAction: handleMessageAction,
                status: handleStatus,
            });
            
            // Schedule token refresh
            scheduleTokenRefresh(pubnubClient, credentials);
            
            // Update UI
            connectionStartTime = Date.now();
            messageCount = 0;
            activeUsers.clear();
            updateUI('current-channel', channelId);
            updateUI('message-count', '0');
            updateUI('user-count', '0');
            updateConnectionStatus(true);
            addToChat('System', `Connected to channel ${channelId}`, true);
            addEvent(`Connected to channel ${channelId}`);
            
            // Start uptime counter
            setInterval(updateUptime, 1000);
            
            // Change connect button to disconnect
            const connectButton = document.getElementById('connect-button');
            if (connectButton) {
                connectButton.textContent = 'Disconnect';
                connectButton.classList.add('disconnect-button');
            }
            
        } catch (error) {
            console.error('Connection error:', error);
            updateUI('current-channel', 'Connection failed');
            updateConnectionStatus(false);
            addToChat('System', `Failed to connect: ${error.message}`, true);
            addEvent(`Connection failed: ${error.message}`);
        }
    }

    function disconnect() {
        if (pubnubClient && currentCredentials) {
            pubnubClient.unsubscribe({ channels: [currentCredentials.roomKey] });
            pubnubClient.removeListener({
                message: handleMessage,
                messageAction: handleMessageAction,
                status: handleStatus,
            });
            pubnubClient = null;
        }
        
        if (tokenRefreshTimeout) {
            clearTimeout(tokenRefreshTimeout);
            tokenRefreshTimeout = null;
        }
        
        currentChannelId = null;
        currentCredentials = null;
        connectionStartTime = null;
        activeUsers.clear();
        
        updateUI('current-channel', 'Not connected');
        updateUI('message-count', '0');
        updateUI('user-count', '0');
        updateUI('uptime', '0:00');
        updateConnectionStatus(false);
        updateUI('token-expiry', 'N/A');
        
        addToChat('System', 'Disconnected from chat', true);
        addEvent('Disconnected from chat');
        
        // Change disconnect button back to connect
        const connectButton = document.getElementById('connect-button');
        if (connectButton) {
            connectButton.textContent = 'Connect';
            connectButton.classList.remove('disconnect-button');
        }
    }

    function handleMessage(message) {
        try {
            const messageData = message.message;
            
            // Skip if it's our own message
            if (currentCredentials && message.publisher === currentCredentials.userId) {
                return;
            }
            
            // Process chat message
            if (messageData.text && messageData.displayName) {
                messageCount++;
                activeUsers.add(message.publisher);
                
                updateUI('message-count', messageCount.toString());
                updateUI('user-count', activeUsers.size.toString());
                
                addToChat(messageData.displayName, messageData.text);
                
                // Send to extension if available
                pushMessage({
                    chatname: messageData.displayName,
                    chatbadges: "",
                    backgroundColor: "",
                    textColor: "",
                    chatmessage: escapeHtml(messageData.text),
                    chatimg: "",
                    hasDonation: "",
                    membership: "",
                    textonly: settings.textonlymode || false,
                    type: "stageten"
                });
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    function handleMessageAction(messageAction) {
        try {
            console.log('Message action:', messageAction);
            // Handle message actions like reactions, deletions, etc.
            if (messageAction.data && messageAction.data.type === 'deleted') {
                addEvent(`Message deleted by ${messageAction.publisher}`);
            }
        } catch (error) {
            console.error('Error handling message action:', error);
        }
    }

    function handleStatus(status) {
        console.log('PubNub status:', status);
        
        if (status.statusCode === 403) {
            console.error('Permission error - refreshing token');
            refreshToken();
        } else if (status.category === 'PNConnectedCategory') {
            console.log('Successfully connected to PubNub');
        } else if (status.category === 'PNDisconnectedCategory') {
            console.log('Disconnected from PubNub');
            updateConnectionStatus(false);
        }
    }

    async function sendMessage(text) {
        if (!pubnubClient || !currentCredentials || !text.trim()) {
            return false;
        }
        
        try {
            await pubnubClient.publish({
                channel: currentCredentials.roomKey,
                message: {
                    displayName: "Social Stream User",
                    text: text,
                    environment: ENVIRONMENT,
                    sourceName: "stageten",
                },
                customMessageType: "chat",
            });
            
            // Add our own message to the chat
            addToChat("You", text);
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }

    // Initialize UI event handlers
    document.addEventListener('DOMContentLoaded', function() {
        // Get channel ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlChannelId = urlParams.get('channel') || urlParams.get('channelId') || urlParams.get('id');
        
        // Get last saved channel ID from localStorage
        const savedChannelId = localStorage.getItem('stageten_last_channel_id');
        
        // Initial connect button
        const initialConnectButton = document.getElementById('initial-connect-button');
        const initialChannelInput = document.getElementById('initial-channel-input');
        
        if (initialChannelInput) {
            // If URL has channel ID, use it and auto-connect
            if (urlChannelId) {
                initialChannelInput.value = urlChannelId;
                // Auto-connect after a short delay to ensure UI is ready
                setTimeout(() => {
                    if (initialConnectButton) {
                        initialConnectButton.click();
                    }
                }, 100);
            } 
            // Otherwise, if we have a saved channel ID, populate the field but don't auto-connect
            else if (savedChannelId) {
                initialChannelInput.value = savedChannelId;
            }
        }
        
        if (initialConnectButton) {
            initialConnectButton.addEventListener('click', function() {
                const channelId = initialChannelInput.value.trim();
                if (channelId) {
                    // Save channel ID to localStorage
                    localStorage.setItem('stageten_last_channel_id', channelId);
                    
                    document.querySelector('.auth').classList.add('hidden');
                    document.querySelectorAll('.socket').forEach(el => el.classList.remove('hidden'));
                    connect(channelId);
                } else {
                    addToChat('System', 'Please enter a channel ID', true);
                }
            });
        }
        
        if (initialChannelInput) {
            initialChannelInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    initialConnectButton.click();
                }
            });
        }
        
        // Main connect/disconnect button
        const connectButton = document.getElementById('connect-button');
        const channelInput = document.getElementById('channel-input');
        
        if (channelInput) {
            // Also populate the main channel input with saved or URL channel ID
            if (urlChannelId) {
                channelInput.value = urlChannelId;
            } else if (savedChannelId) {
                channelInput.value = savedChannelId;
            }
        }
        
        if (connectButton) {
            connectButton.addEventListener('click', function() {
                if (pubnubClient) {
                    disconnect();
                } else {
                    const channelId = channelInput.value.trim();
                    if (channelId) {
                        // Save channel ID to localStorage
                        localStorage.setItem('stageten_last_channel_id', channelId);
                        connect(channelId);
                    } else {
                        addToChat('System', 'Please enter a channel ID', true);
                    }
                }
            });
        }
        
        if (channelInput) {
            channelInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !pubnubClient) {
                    connectButton.click();
                }
            });
        }
        
        // Disconnect button
        const disconnectButton = document.getElementById('disconnect-button');
        if (disconnectButton) {
            disconnectButton.addEventListener('click', disconnect);
        }
        
        // Send message functionality
        const sendButton = document.getElementById('sendmessage');
        const inputText = document.getElementById('input-text');
        
        if (sendButton) {
            sendButton.addEventListener('click', function() {
                const text = inputText.value.trim();
                if (text && sendMessage(text)) {
                    inputText.value = '';
                }
            });
        }
        
        if (inputText) {
            inputText.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendButton.click();
                }
            });
        }
    });

    console.log("Stage TEN chat integration loaded");

} catch(e) {
    console.error('Stage TEN integration error:', e);
}