// dashboard.js - Supporting JavaScript for Social Stream Ninja background page

function dashboardTranslation(key, fallback, values) {
    if (!window.SSNPageI18n || typeof window.SSNPageI18n.t !== 'function') return fallback;
    return window.SSNPageI18n.t(key, fallback, values);
}

// Function to update connection status indicators
function updateConnectionStatus() {
    // Remote Control API WebSocket (ch 1/2) - controlled by socketserver setting
    const wsEnabled = !!(window.settings && window.settings.socketserver);
    const wsConnected = window.socketserver && window.socketserver.readyState === 1;
    const wsStatus = document.getElementById('websocket-status');
    const wsText = document.getElementById('websocket-status-text');
    if (!wsEnabled) {
        wsStatus.className = 'status-indicator status-inactive';
        wsText.textContent = dashboardTranslation('status-disabled', 'Disabled');
    } else if (wsConnected) {
        wsStatus.className = 'status-indicator status-active';
        wsText.textContent = dashboardTranslation('status-connected', 'Connected');
    } else {
        wsStatus.className = 'status-indicator status-warning';
        wsText.textContent = dashboardTranslation('status-connecting', 'Connecting...');
    }

    // Chat Relay API WebSocket (ch 3/4) - controlled by server2 setting
    const wsDockEnabled = !!(window.settings && (window.settings.server2 || window.settings.server3));
    const wsDockConnected = window.socketserverDock && window.socketserverDock.readyState === 1;
    const wsDockStatus = document.getElementById('websocket-dock-status');
    const wsDockText = document.getElementById('websocket-dock-status-text');
    if (wsDockStatus && wsDockText) {
        if (!wsDockEnabled) {
            wsDockStatus.className = 'status-indicator status-inactive';
            wsDockText.textContent = dashboardTranslation('status-disabled', 'Disabled');
        } else if (wsDockConnected) {
            wsDockStatus.className = 'status-indicator status-active';
            wsDockText.textContent = dashboardTranslation('status-connected', 'Connected');
        } else {
            wsDockStatus.className = 'status-indicator status-warning';
            wsDockText.textContent = dashboardTranslation('status-connecting', 'Connecting...');
        }
    }

    // Signaling (VDO.Ninja) and WebRTC peers
    const signalingReady = !!(
        (window.ninjaBridge && window.ninjaBridge.vdo && window.ninjaBridge.vdo.state && window.ninjaBridge.vdo.state.connected) ||
        (window.iframe)
    );
    const transportReady = (!!window.iframe) || (window.ninjaBridge && typeof window.ninjaBridge.isReady === 'function' && window.ninjaBridge.isReady());
    const peerCount = Object.keys(window.connectedPeers || {}).length;
    const webrtcConnected = transportReady && peerCount > 0;

    // Signaling row
    const sigStatusEl = document.getElementById('signaling-status');
    const sigTextEl = document.getElementById('signaling-status-text');
    if (sigStatusEl && sigTextEl) {
        if (signalingReady) {
            sigStatusEl.className = 'status-indicator status-active';
            sigTextEl.textContent = window.iframe
                ? dashboardTranslation('status-active-iframe', 'Active (iframe)')
                : dashboardTranslation('status-connected', 'Connected');
        } else {
            sigStatusEl.className = 'status-indicator status-inactive';
            sigTextEl.textContent = dashboardTranslation('status-inactive', 'Inactive');
        }
    }

    // WebRTC row: warning when transport ready but no peers
    const rtcStatus = document.getElementById('webrtc-status');
    const rtcText = document.getElementById('webrtc-status-text');
    if (transportReady) {
        if (webrtcConnected) {
            rtcStatus.className = 'status-indicator status-active';
            // Summarize peer labels
            const peerLabels = {};
            Object.values(window.connectedPeers || {}).forEach(label => { if (label) peerLabels[label] = (peerLabels[label] || 0) + 1; });
            let peerInfo = '';
            if (Object.keys(peerLabels).length > 0) {
                peerInfo = ' (' + Object.entries(peerLabels).map(([l,c]) => `${l}: ${c}`).join(', ') + ')';
            } else {
                peerInfo = ` (${dashboardTranslation('unlabeled-peer-count', '{count} unlabeled peers', { count: peerCount })})`;
            }
            rtcText.textContent = dashboardTranslation('status-connected', 'Connected') + peerInfo;
        } else {
            rtcStatus.className = 'status-indicator status-warning';
            rtcText.textContent = signalingReady
                ? dashboardTranslation('status-signaling-waiting-peers', 'Signaling connected; waiting for peers')
                : dashboardTranslation('status-waiting-transport', 'Waiting for transport');
        }
    } else {
        rtcStatus.className = 'status-indicator status-inactive';
        rtcText.textContent = dashboardTranslation('status-transport-not-initialized', 'Transport not initialized');
    }
    
    // Extension status
    const extensionActive = window.isExtensionOn;
    const extStatus = document.getElementById('extension-status');
    const extText = document.getElementById('extension-status-text');
    
    if (extensionActive) {
        extStatus.className = 'status-indicator status-active';
        extText.textContent = dashboardTranslation('status-active', 'Active');
    } else {
        extStatus.className = 'status-indicator status-inactive';
        extText.textContent = dashboardTranslation('status-inactive', 'Inactive');
    }
    
    // Session ID
    const sessionIdEl = document.getElementById('session-id');
    sessionIdEl.textContent = window.streamID || dashboardTranslation('status-not-set', 'Not set');
}

// Function to update message statistics
function updateMessageStats() {
    const messageCount = document.getElementById('message-count');
    const activeSources = document.getElementById('active-sources');
    
    // We'll use messageCounter from background.js
    if (window.messageCounter - window.messageCounterBase) {
        messageCount.textContent = window.messageCounter - window.messageCounterBase;
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

    // Spotify
    const spotifyStatus = document.getElementById('spotify-status');
    if (spotifyStatus) {
        spotifyStatus.className = 'status-indicator ' + (settings.spotifyEnabled ? 'status-active' : 'status-inactive');
    }

    // Streamer.bot
    const streamerbotStatus = document.getElementById('streamerbot-status');
    if (streamerbotStatus) {
        streamerbotStatus.className = 'status-indicator ' + (settings.streamerbot ? 'status-active' : 'status-inactive');
    }

    // Custom JS
    const customjsStatus = document.getElementById('customjs-status');
    if (customjsStatus) {
        customjsStatus.className = 'status-indicator ' + (settings.customJsEnabled ? 'status-active' : 'status-inactive');
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
    while (debugOutput.children.length > 30) {
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
        peerListContent.textContent = dashboardTranslation('no-connected-peers', 'No connected peers');
        return;
    }
    
    // Group peers by label
    const peersByLabel = {};
    Object.entries(connectedPeers).forEach(([uuid, label]) => {
        const peerLabel = label || dashboardTranslation('unlabeled-peer', 'Unlabeled');
        if (!peersByLabel[peerLabel]) {
            peersByLabel[peerLabel] = [];
        }
        // Store just first 8 chars of UUID to keep display compact
        peersByLabel[peerLabel].push(uuid.substring(0, 8) + '...');
    });
    
    // Create HTML for the peer list
    let html = `<strong>${dashboardTranslation('connected-peers-label', 'Connected Peers:')}</strong><br>`;
    
    Object.entries(peersByLabel).forEach(([label, uuids]) => {
        html += `<span style="color: var(--primary-color);">${label}</span> (${uuids.length}): `;
        if (uuids.length <= 3) {
            html += uuids.join(', ');
        } else {
            html += `${uuids.slice(0, 2).join(', ')} ${dashboardTranslation('and-more-peer-count', 'and {count} more', { count: uuids.length - 2 })}`;
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

// Intercept console logs
function setupConsoleHook() {
    const MAX_MESSAGE_LENGTH = 500; // Maximum characters per message
    
    // Helper function to stringify and trim arguments
    function formatArguments(args) {
        return Array.from(args).map(arg => {
            let str;
            if (typeof arg === 'object') {
                try {
                    // Pretty print objects with 2-space indentation
                    str = JSON.stringify(arg, null, 2);
                } catch (e) {
                    // Handle circular references or other stringify errors
                    str = String(arg);
                }
            } else {
                str = String(arg);
            }
            
            // Trim to max length if needed
            if (str.length > MAX_MESSAGE_LENGTH) {
                str = str.substring(0, MAX_MESSAGE_LENGTH) + '... (truncated)';
            }
            return str;
        }).join(' ');
    }
    
    // Create new methods that preserve the call stack
    const originalLog = console.log.bind(console);
    const originalError = console.error.bind(console);
    
    console.log = (...args) => {
        // originalLog(...args);
        const message = formatArguments(args);
        addLogMessage(message);
    };
    
    console.error = (...args) => {
        originalError(...args);
        const message = formatArguments(args);
        addLogMessage(message, true);
    };
}

function showEditorView() {
    document.getElementById("dash").style.display = 'none';
    document.getElementById("editorstyle").removeAttribute("disabled");
    
    document.getElementById("editor").style.opacity = '0';
    document.getElementById("editor").style.display = 'block';
    
    void document.getElementById("editor").offsetWidth;
    document.getElementById("editor").style.opacity = '1';
    
    document.getElementById("dashstyle").setAttribute("disabled", "true");
    
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
   
}

function showDashboardView() {
    document.getElementById("editor").style.display = 'none';
    
    document.getElementById("dashstyle").removeAttribute("disabled");
    document.getElementById("dash").style.display = 'block';
    
    document.body.style.padding = '20px';
    document.body.style.overflow = 'auto';
    
    // Close test panel if open
    if (window.testOverlay && window.testPanel) {
        window.testOverlay.style.display = 'none';
        window.testPanel.style.display = 'none';
    }
    
}

// Duplicate showEditorView removed - using the one defined earlier

function setupReturnButton() {
    const returnButton = document.getElementById('return-to-dashboard');
    if (returnButton) {
        returnButton.addEventListener('click', function() {
            showDashboardView();
        });
    }
	
	const showEditorViewButton = document.getElementById('showEditorViewButton');
    if (showEditorViewButton) {
        showEditorViewButton.addEventListener('click', function() {
            showEditorView();
        });
    }
    
    const backToDashboardButton = document.getElementById('back-to-dashboard');
    if (backToDashboardButton) {
        backToDashboardButton.addEventListener('click', function() {
            showDashboardView();
        });
    }
}
// Main initialization function
function initDashboard() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('ssapp')) {
        document.body.classList.add('ssapp');
    }
    document.getElementById("editorstyle").setAttribute("disabled", "true");
    setupConsoleHook();
    setupPeriodicUpdates();
	setupReturnButton();
	window.addEventListener('ssn-page-language-changed', function() {
		updateConnectionStatus();
		updatePeerList();
	});
	
	// Listen for postMessage from parent window (for cross-origin communication)
	window.addEventListener('message', function(event) {
		// Only handle messages with the expected structure
		if (event.data && event.data.action) {
			if (event.data.action === 'showDashboardView' && typeof showDashboardView === 'function') {
				showDashboardView();
			} else if (event.data.action === 'showEditorView' && typeof showEditorView === 'function') {
				showEditorView();
			}
		}
	});
	
	// Check if we should show the editor view initially
	if (urlParams.get('view') === 'editor') {
		// Show editor view initially
		setTimeout(() => {
			showEditorView();
		}, 100);
	}
	
	// Check if we should show editor based on hash
	if (window.location.hash === '#editor') {
		setTimeout(() => {
			showEditorView();
		}, 100);
	}
	
	// Listen for hash changes to switch views
	window.addEventListener('hashchange', function() {
		if (window.location.hash === '#editor') {
			showEditorView();
		} else if (window.location.hash === '#dashboard' || !window.location.hash) {
			showDashboardView();
		}
	});
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    // DOM is already loaded
    initDashboard();
} else {
    // DOM isn't loaded yet, wait for it
    document.addEventListener("DOMContentLoaded", initDashboard);
}
