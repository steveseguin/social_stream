// Social Stream Chat Integration for Social Stream Ninja (WebSocket Source)
// Connects to chat.socialstream.ninja to receive messages and forward them to SSN
try {
    let wsClient = null;
    let currentRoomId = null;
    let currentToken = null;
    let reconnectTimeout = null;
    let reconnectAttempts = 0;
    let connectionStartTime = null;
    let messageCount = 0;
    let settings = {};
    let isExtensionOn = true;

    const MAX_RECONNECT_ATTEMPTS = 10;
    const RECONNECT_BASE_DELAY = 1000;

    // Check if we're running in the extension context
    const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

    // Listen for messages from the extension if running in that context
    if (isExtension) {
        window.addEventListener('socialstreamchatMessage', function(e) {
            if (e.detail) {
                pushMessage(e.detail);
            }
        });

        // Handle extension messages
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            try {
                if (request === "getSource") {
                    sendResponse("socialstreamchat");
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

            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
            response = response || {};
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

    async function mintGuestToken(roomId, apiBase) {
        try {
            const response = await fetch(`${apiBase}/rooms/${roomId}/tokens`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: "SSN Viewer",
                    role: "viewer"
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.token;
        } catch (error) {
            console.error('Error minting guest token:', error);
            return null;
        }
    }

    function updateUI(element, value) {
        const el = document.getElementById(element);
        if (el) el.textContent = value;
    }

    function updateConnectionStatus(connected) {
        const wsStatus = document.getElementById('ws-status');
        const roomStatus = document.getElementById('room-status');

        if (wsStatus) {
            wsStatus.textContent = connected ? 'Connected' : 'Disconnected';
            wsStatus.className = connected ? 'status-connected' : 'status-disconnected';
        }

        if (roomStatus) {
            roomStatus.textContent = connected ? currentRoomId : 'Not connected';
            roomStatus.className = connected ? 'status-connected' : 'status-disconnected';
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
            messageDiv.style.color = '#38bdf8';
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

    async function connect(roomId, token = null) {
        if (!roomId) {
            console.error('No room ID provided');
            addToChat('System', 'Please enter a room ID', true);
            return;
        }

        // Disconnect if already connected
        if (wsClient) {
            disconnect();
        }

        currentRoomId = roomId;
        updateUI('current-room', `Connecting to ${roomId}...`);
        addToChat('System', `Connecting to room ${roomId}...`, true);

        try {
            const wsBase = localStorage.getItem('ssc_ws_base') || 'wss://chat.socialstream.ninja/ws';
            const apiBase = localStorage.getItem('ssc_api_base') || 'https://chat.socialstream.ninja';

            // Mint a guest token if none provided
            if (!token) {
                addToChat('System', 'Minting guest token...', true);
                token = await mintGuestToken(roomId, apiBase);
                if (!token) {
                    throw new Error('Failed to mint guest token - room may require authentication');
                }
            }

            currentToken = token;

            // Connect to WebSocket
            const wsUrl = `${wsBase}/${roomId}?token=${encodeURIComponent(token)}`;
            wsClient = new WebSocket(wsUrl);

            wsClient.onopen = function() {
                console.log('Connected to Social Stream Chat');
                connectionStartTime = Date.now();
                messageCount = 0;
                reconnectAttempts = 0;

                updateUI('current-room', roomId);
                updateUI('message-count', '0');
                updateConnectionStatus(true);
                addToChat('System', `Connected to room ${roomId}`, true);
                addEvent(`Connected to room ${roomId}`);

                // Start uptime counter
                setInterval(updateUptime, 1000);
            };

            wsClient.onmessage = function(event) {
                try {
                    const envelope = JSON.parse(event.data);
                    handleMessage(envelope);
                } catch (e) {
                    console.error('Error parsing message:', e);
                }
            };

            wsClient.onclose = function(event) {
                console.log('WebSocket closed:', event.code, event.reason);
                updateConnectionStatus(false);
                addToChat('System', 'Disconnected from chat', true);
                addEvent(`Disconnected: ${event.reason || 'Connection closed'}`);

                // Auto-reconnect unless it was a clean close or auth error
                if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003) {
                    scheduleReconnect();
                } else if (event.code === 4001 || event.code === 4003) {
                    addToChat('System', 'Authentication failed - check your token or room settings', true);
                }
            };

            wsClient.onerror = function(error) {
                console.error('WebSocket error:', error);
                addEvent('Connection error');
            };

        } catch (error) {
            console.error('Connection error:', error);
            updateUI('current-room', 'Connection failed');
            updateConnectionStatus(false);
            addToChat('System', `Failed to connect: ${error.message}`, true);
            addEvent(`Connection failed: ${error.message}`);
        }
    }

    function scheduleReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            addToChat('System', 'Max reconnection attempts reached', true);
            return;
        }

        reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1);

        addToChat('System', `Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, true);

        reconnectTimeout = setTimeout(() => {
            if (currentRoomId) {
                connect(currentRoomId, currentToken);
            }
        }, delay);
    }

    function disconnect() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        if (wsClient) {
            wsClient.close(1000, 'User disconnected');
            wsClient = null;
        }

        currentRoomId = null;
        currentToken = null;
        connectionStartTime = null;
        reconnectAttempts = 0;

        updateUI('current-room', 'Not connected');
        updateUI('message-count', '0');
        updateUI('uptime', '0:00');
        updateConnectionStatus(false);

        addToChat('System', 'Disconnected from chat', true);
        addEvent('Disconnected from chat');
    }

    function handleMessage(envelope) {
        try {
            // Handle different message types
            const msgType = envelope.msg_type || envelope.type;

            if (msgType === 'presence') {
                addEvent(`Presence update: ${envelope.payload?.count || 0} users`);
                return;
            }

            // Process chat and event messages
            if (msgType !== 'chat' && msgType !== 'event') {
                return;
            }

            const user = envelope.user || {};
            const payload = envelope.payload || {};
            const meta = envelope.meta || {};
            const text = payload.text || '';
            const displayName = payload.displayName || user.name || 'Anonymous';

            // Events without text are still valid
            if (!text && !payload.event) return;

            messageCount++;
            updateUI('message-count', messageCount.toString());

            // Display in local chat
            if (payload.event) {
                addToChat('Event', `[${payload.event}] ${displayName}: ${text || payload.title || ''}`, true);
            } else {
                addToChat(displayName, text);
            }

            // Determine the source icon
            let sourceIcon = payload.sourceIcon || '';
            if (!sourceIcon && payload.source) {
                sourceIcon = `https://socialstream.ninja/sources/images/${payload.source}.png`;
            }

            // Build the full SSN message object
            const ssnMessage = {
                // Core fields
                chatname: displayName,
                chatmessage: escapeHtml(text),
                chatimg: payload.avatar || user.avatar || "",
                userid: payload.userId || user.id || "",
                type: "socialstreamchat",
                textonly: settings.textonlymode || false,

                // Badges - pass through as-is
                chatbadges: payload.badges || "",

                // Donation fields
                hasDonation: payload.donation || "",
                donoValue: payload.donationValue || "",
                backgroundColor: payload.backgroundColor || "",
                textColor: payload.textColor || "",

                // Membership
                membership: payload.membership || "",

                // Event info
                event: payload.event || "",
                title: payload.title || "",

                // Additional display info
                subtitle: payload.subtitle || "",
                nameColor: payload.nameColor || "",

                // Moderator flag
                mod: payload.isModerator || false,

                // Content image (stickers, etc.)
                contentimg: payload.contentImage || "",

                // Reply info
                initial: payload.replyTo || "",
                reply: payload.replyText || "",

                // Source info
                sourceName: payload.sourceName || "",
                sourceImg: payload.sourceImage || "",
                sourceIcon: sourceIcon,

                // Meta passthrough for custom fields
                meta: meta
            };

            // Send to SSN extension
            pushMessage(ssnMessage);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    async function sendMessage(text) {
        if (!wsClient || wsClient.readyState !== WebSocket.OPEN || !text.trim()) {
            return false;
        }

        try {
            const message = {
                type: "chat",
                payload: {
                    text: text
                }
            };

            wsClient.send(JSON.stringify(message));
            addToChat("You", text);
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }

    // Initialize UI event handlers
    document.addEventListener('DOMContentLoaded', function() {
        // Get room ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlRoomId = urlParams.get('room') || urlParams.get('roomId') || urlParams.get('id');
        const urlToken = urlParams.get('token');

        // Get last saved room ID from localStorage
        const savedRoomId = localStorage.getItem('ssc_last_room_id');

        // Initial connect button
        const initialConnectButton = document.getElementById('initial-connect-button');
        const initialRoomInput = document.getElementById('initial-room-input');
        const initialTokenInput = document.getElementById('initial-token-input');

        if (initialRoomInput) {
            if (urlRoomId) {
                initialRoomInput.value = urlRoomId;
                if (urlToken && initialTokenInput) {
                    initialTokenInput.value = urlToken;
                }
                // Auto-connect after a short delay
                setTimeout(() => {
                    if (initialConnectButton) {
                        initialConnectButton.click();
                    }
                }, 100);
            } else if (savedRoomId) {
                initialRoomInput.value = savedRoomId;
            }
        }

        if (initialConnectButton) {
            initialConnectButton.addEventListener('click', function() {
                const roomId = initialRoomInput.value.trim();
                const token = initialTokenInput ? initialTokenInput.value.trim() : null;
                if (roomId) {
                    localStorage.setItem('ssc_last_room_id', roomId);
                    document.querySelector('.auth').classList.add('hidden');
                    document.querySelectorAll('.socket').forEach(el => el.classList.remove('hidden'));
                    connect(roomId, token || null);
                } else {
                    addToChat('System', 'Please enter a room ID', true);
                }
            });
        }

        if (initialRoomInput) {
            initialRoomInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    initialConnectButton.click();
                }
            });
        }

        // Main connect/disconnect button
        const connectButton = document.getElementById('connect-button');
        const roomInput = document.getElementById('room-input');

        if (roomInput && savedRoomId) {
            roomInput.value = savedRoomId;
        }

        if (connectButton) {
            connectButton.addEventListener('click', function() {
                if (wsClient) {
                    disconnect();
                } else {
                    const roomId = roomInput.value.trim();
                    if (roomId) {
                        localStorage.setItem('ssc_last_room_id', roomId);
                        connect(roomId);
                    } else {
                        addToChat('System', 'Please enter a room ID', true);
                    }
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

    console.log("Social Stream Chat integration loaded");

} catch(e) {
    console.error('Social Stream Chat integration error:', e);
}
