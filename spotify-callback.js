// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const error = urlParams.get('error');
const state = urlParams.get('state');
const redirectUriFromLocation = window.location.origin + window.location.pathname;

// Detect environment
const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL;
const extensionId = isExtension ? chrome.runtime.id : null;

function showSetupInstructions() {
    const isElectronApp = typeof window !== 'undefined' &&
        ((window.location && window.location.search && window.location.search.includes('ssapp')) || window.ninjafy);
    const environmentLabel = isElectronApp ? 'the Social Stream app' : 'the browser extension popup';

    document.getElementById('content').innerHTML = 
        '<h1>🎵 Finish connecting Spotify</h1>' +
        '<p>If this page opened after you granted Spotify permissions, Social Stream Ninja just needs the URL from your address bar to finish signing in.</p>' +
        '<ol style="list-style: decimal; padding-left: 20px;">' +
        '<li>Copy the entire URL from your browser (it should contain <code>code=</code> and <code>state=</code>).</li>' +
        '<li>Return to ' + environmentLabel + ' and paste that URL into the "Paste callback URL" field.</li>' +
        '<li>Click <strong>Complete Auth</strong>.</li>' +
        '</ol>' +
        '<div class="info-box" style="background-color:#1b2b3a; border-left-color:#1db954;">' +
        '<strong>Why this extra step?</strong><br>' +
        'Some environments block embedded login windows or label them as insecure. Copying the callback URL lets the app finish the secure token exchange without ever seeing your Spotify password.' +
        '</div>' +
        '<p style="margin-top:20px;">After the app confirms the connection, you can close this tab. If it still says "waiting", click Reconnect to Spotify and try again.</p>';
}

function showAuthCallback() {
    document.getElementById('content').innerHTML = 
        '<div class="auth-container">' +
        '<h1>🎵 Spotify Authorization</h1>' +
        '<div class="loader"></div>' +
        '<p id="status">Processing authorization...</p>' +
        '</div>';

    function updateStatus(message, isError) {
        const statusDiv = document.getElementById('status');
        statusDiv.innerHTML = 
            '<p class="' + (isError ? 'error' : 'success') + '">' + message + '</p>' +
            (isError ? '' : '<p>You can close this window.</p>');
    }

    if (error) {
        updateStatus('Authorization failed: ' + error, true);
    } else if (code) {
        // Check if we're in the Electron app with IPC support
        const isElectronApp = typeof window.ninjafy !== 'undefined' && window.ninjafy.sendMessage;
        
        if (isElectronApp) {
            // Use Electron IPC mechanism (same as popup.js)
            console.log('Sending Spotify auth callback via Electron IPC');
            
            // Use the authenticated postMessage method that background.js will receive
            const messageData = {
                cmd: "spotifyAuthCallback",
                code: code,
                state: state,
                redirectUri: redirectUriFromLocation,
                _authToken: window.ninjafy._authToken // Include auth token for security
            };
            
            // Send via postMessage which will be intercepted by preload.js
            window.postMessage(messageData, '*');
            
            // Also try the direct method as a fallback
            window.ninjafy.sendMessage(null, {
                cmd: "spotifyAuthCallback",
                code: code,
                state: state,
                redirectUri: redirectUriFromLocation
            }, function(response) {
                if (response && response.success) {
                    updateStatus('Successfully connected to Spotify! 🎵');
                    // Close the window after 2 seconds
                    setTimeout(() => window.close(), 2000);
                } else {
                    // Don't show error immediately, wait for postMessage response
                    setTimeout(() => {
                        if (document.getElementById('status').textContent.includes('Processing')) {
                            updateStatus('Authorization received. You can close this window.', false);
                        }
                    }, 2000);
                }
            });
        } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            // Chrome extension environment
            chrome.runtime.sendMessage({
                cmd: "spotifyAuthCallback",
                code: code,
                state: state,
                redirectUri: redirectUriFromLocation
            }, function(response) {
                if (response && response.success) {
                    updateStatus('Successfully connected to Spotify! 🎵');
                    // Close the window after 2 seconds
                    setTimeout(() => window.close(), 2000);
                } else {
                    updateStatus('Failed to complete authorization. Please try again.', true);
                }
            });
        } else {
            // For web version, post message to parent or redirect
            if (window.opener) {
                window.opener.postMessage({
                    type: 'spotifyAuthCallback',
                    code: code,
                    state: state,
                    redirectUri: redirectUriFromLocation
                }, '*');
                updateStatus('Successfully connected to Spotify! 🎵');
                setTimeout(() => window.close(), 2000);
            } else {
                updateStatus('Authorization code received. Copy this page\'s full URL and paste it into the Social Stream Ninja settings panel to finish connecting.');
            }
        }
    } else {
        updateStatus('No authorization code received.', true);
    }
}

// Decide what to show based on URL parameters
if (code || error) {
    showAuthCallback();
} else {
    showSetupInstructions();
}
