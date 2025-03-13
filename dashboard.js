// dashboard.js - Supporting JavaScript for Social Stream Ninja background page
// This file contains all the functionality that was previously inline in the HTML

// Function to update connection status indicators
function updateConnectionStatus() {
    // These values would be populated by the actual background.js state
    const wsConnected = window.socketserver && window.socketserver.readyState === 1;
    const wsStatus = document.getElementById('websocket-status');
    const wsText = document.getElementById('websocket-status-text');
    
    if (wsConnected) {
        wsStatus.className = 'status-indicator status-active';
        wsText.textContent = 'Connected';
    } else {
        wsStatus.className = 'status-indicator status-inactive';
        wsText.textContent = 'Disconnected';
    }
    
    // WebRTC status depends on iframe and connectedPeers
    const hasIframe = !!window.iframe;
    const peerCount = Object.keys(window.connectedPeers || {}).length;
    const webrtcConnected = hasIframe && peerCount > 0;
    const rtcStatus = document.getElementById('webrtc-status');
    const rtcText = document.getElementById('webrtc-status-text');
    
    if (hasIframe) {
        if (webrtcConnected) {
            rtcStatus.className = 'status-indicator status-active';
            
            // Get the peer labels
            const peerLabels = {};
            Object.values(window.connectedPeers || {}).forEach(label => {
                if (label) {
                    peerLabels[label] = (peerLabels[label] || 0) + 1;
                }
            });
            
            // Format the peer label information
            let peerInfo = '';
            if (Object.keys(peerLabels).length > 0) {
                peerInfo = ' (';
                peerInfo += Object.entries(peerLabels)
                    .map(([label, count]) => `${label}: ${count}`)
                    .join(', ');
                peerInfo += ')';
            } else {
                peerInfo = ` (${peerCount} unlabeled peers)`;
            }
            
            rtcText.textContent = 'Connected' + peerInfo;
        } else {
            rtcStatus.className = 'status-indicator status-inactive';
            rtcText.textContent = 'Waiting for peers (iframe active)';
        }
    } else {
        rtcStatus.className = 'status-indicator status-inactive';
        rtcText.textContent = 'Iframe not initialized';
    }
    
    // Extension status
    const extensionActive = window.isExtensionOn;
    const extStatus = document.getElementById('extension-status');
    const extText = document.getElementById('extension-status-text');
    
    if (extensionActive) {
        extStatus.className = 'status-indicator status-active';
        extText.textContent = 'Active';
    } else {
        extStatus.className = 'status-indicator status-inactive';
        extText.textContent = 'Inactive';
    }
    
    // Session ID
    const sessionIdEl = document.getElementById('session-id');
    sessionIdEl.textContent = window.streamID || 'Not set';
}

// Function to update message statistics
function updateMessageStats() {
    const messageCount = document.getElementById('message-count');
    const activeSources = document.getElementById('active-sources');
    
    // We'll use messageCounter from background.js
    if (window.messageCounter) {
        messageCount.textContent = window.messageCounter;
    }
    
    // Count active sources from tabs or metadata
    if (window.metaDataStore) {
        activeSources.textContent = window.metaDataStore.size || 0;
    }
}

// Function to update feature status
function updateFeatureStatus() {
    const settings = window.settings || {};
    
    // MIDI status
    const midiStatus = document.getElementById('midi-status');
    midiStatus.className = 'status-indicator ' + (settings.midi ? 'status-active' : 'status-inactive');
    
    // Sentiment Analysis
    const sentimentStatus = document.getElementById('sentiment-status');
    sentimentStatus.className = 'status-indicator ' + (settings.addkarma ? 'status-active' : 'status-inactive');
    
    // Waitlist Mode
    const waitlistStatus = document.getElementById('waitlist-status');
    waitlistStatus.className = 'status-indicator ' + (settings.waitlistmode ? 'status-active' : 'status-inactive');
    
    // Hype Mode
    const hypeStatus = document.getElementById('hype-status');
    hypeStatus.className = 'status-indicator ' + (settings.hypemode ? 'status-active' : 'status-inactive');
}

// Function to add a message to the recent messages list
function addMessage(message) {
    const messageList = document.getElementById('message-list');
    const emptyMessage = messageList.querySelector('.empty-message');
    
    if (emptyMessage) {
        messageList.removeChild(emptyMessage);
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    
    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    
    const messageSource = document.createElement('span');
    messageSource.className = 'message-source';
    messageSource.textContent = message.source || 'Unknown';
    
    const messageTime = document.createElement('span');
    messageTime.className = 'message-time';
    messageTime.textContent = new Date().toLocaleTimeString();
    
    messageHeader.appendChild(messageSource);
    messageHeader.appendChild(messageTime);
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message.content || '';
    
    messageElement.appendChild(messageHeader);
    messageElement.appendChild(messageContent);
    
    messageList.insertBefore(messageElement, messageList.firstChild);
    
    // Keep only the last 5 messages
    while (messageList.children.length > 5) {
        messageList.removeChild(messageList.lastChild);
    }
}

// Function to add a log message
function addLogMessage(message, isError = false) {
    const debugOutput = document.getElementById('debugOutput');
    
    const logElement = document.createElement('div');
    logElement.className = isError ? 'error-message' : 'log-message';
    logElement.textContent = message;
    
    debugOutput.appendChild(logElement);
    
    // Auto-scroll to bottom
    debugOutput.scrollTop = debugOutput.scrollHeight;
    
    // Keep only the last 10 messages
    while (debugOutput.children.length > 10) {
        debugOutput.removeChild(debugOutput.firstChild);
    }
}

// Function to update the detailed peer list
function updatePeerList() {
    const peerListContent = document.getElementById('peer-list-content');
    if (!peerListContent) return;

    const connectedPeers = window.connectedPeers || {};
    const peerCount = Object.keys(connectedPeers).length;
    
    if (peerCount === 0) {
        peerListContent.innerHTML = 'No connected peers';
        return;
    }
    
    // Group peers by label
    const peersByLabel = {};
    Object.entries(connectedPeers).forEach(([uuid, label]) => {
        const peerLabel = label || 'Unlabeled';
        if (!peersByLabel[peerLabel]) {
            peersByLabel[peerLabel] = [];
        }
        // Store just first 8 chars of UUID to keep display compact
        peersByLabel[peerLabel].push(uuid.substring(0, 8) + '...');
    });
    
    // Create HTML for the peer list
    let html = '<strong>Connected Peers:</strong><br>';
    
    Object.entries(peersByLabel).forEach(([label, uuids]) => {
        html += `<span style="color: var(--primary-color);">${label}</span> (${uuids.length}): `;
        if (uuids.length <= 3) {
            html += uuids.join(', ');
        } else {
            html += `${uuids.slice(0, 2).join(', ')} and ${uuids.length - 2} more`;
        }
        html += '<br>';
    });
    
    peerListContent.innerHTML = html;
}

// Set up periodically updated data
function setupPeriodicUpdates() {
    // Initial update
    setTimeout(function() {
        updateConnectionStatus();
        updateMessageStats();
        updateFeatureStatus();
        updatePeerList();
        
        // Set up regular updates
        setInterval(function() {
            updateConnectionStatus();
            updateMessageStats();
            updateFeatureStatus();
            updatePeerList();
        }, 5000);
    }, 1000);
}

// Hook into processIncomingMessage to display messages
function setupMessageHook() {
    if (window.processIncomingMessage) {
        const originalProcessIncomingMessage = window.processIncomingMessage;
        window.processIncomingMessage = function(message, sender) {
            // Call the original function
            const result = originalProcessIncomingMessage(message, sender);
            
            // Update our UI
            if (message && message.chatmessage) {
                // Safely get plaintext message content
                let plainTextMessage = message.chatmessage;
                if (!message.textonly) {
                    // Try to convert HTML to plain text
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = message.chatmessage;
                    plainTextMessage = tempDiv.textContent || tempDiv.innerText || message.chatmessage;
                }
                
                addMessage({
                    source: message.type || 'Unknown',
                    content: plainTextMessage
                });
            }
            
            updateMessageStats();
            return result;
        };
    }
}

// Intercept console logs
function setupConsoleHook() {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    console.log = function() {
        originalConsoleLog.apply(console, arguments);
        const message = Array.from(arguments).join(' ');
        addLogMessage(message);
    };
    
    console.error = function() {
        originalConsoleError.apply(console, arguments);
        const message = Array.from(arguments).join(' ');
        addLogMessage(message, true);
    };
}

// Main initialization function
function initDashboard() {
    setupConsoleHook();
    setupPeriodicUpdates();
    
    // Wait for background.js to load then hook into message processing
    window.addEventListener('load', function() {
        // Allow some time for background.js to initialize
        setTimeout(function() {
            setupMessageHook();
        }, 2000);
    });
}

// Start dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', initDashboard);