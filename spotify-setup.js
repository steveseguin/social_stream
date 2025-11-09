// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const error = urlParams.get('error');
const state = urlParams.get('state');
const redirectUriFromLocation = window.location.origin + window.location.pathname;

// Detect environment
const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL;
const extensionId = isExtension ? chrome.runtime.id : null;

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Flash the button to indicate success
        event.target.textContent = 'Copied!';
        setTimeout(() => {
            event.target.textContent = 'Copy';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}

function showSetupInstructions() {
    const redirectUris = [];
    
    // Always include the web URI
    redirectUris.push('https://socialstream.ninja/spotify.html');

    // Add extension URI if applicable
    if (extensionId) {
        redirectUris.push('https://' + extensionId + '.chromiumapp.org/spotify');
    }

    // Localhost URI is required for the standalone desktop app (SSAPP)
    redirectUris.push('http://localhost:8888/callback');

    // Build the redirect URIs HTML
    let redirectUrisHtml = '';
    for (let i = 0; i < redirectUris.length; i++) {
        const uri = redirectUris[i];
        redirectUrisHtml += '<div class="uri-item">';
        redirectUrisHtml += '<span class="uri-text">' + uri + '</span>';
        redirectUrisHtml += '<button class="copy-button" data-uri="' + uri + '">Copy</button>';
        redirectUrisHtml += '</div>';
    }

    const extensionNote = isExtension ? 
        '<div class="info-box" style="background-color: #282828; border-left-color: #ff6b35;">' +
        '<strong>Chrome Extension Users:</strong><br>' +
        'Make sure you\'ve added the extension-specific redirect URI shown above. The extension ID (' + extensionId + ') is unique to your installation.' +
        '</div>' : '';

    const desktopNote = '<div class="info-box" style="background-color: #1b2b3a; border-left-color: #1db954;">' +
        '<strong>Standalone Desktop App Users:</strong><br>' +
        'Add http://localhost:8888/callback to your Spotify app. The SSAPP OAuth flow uses a local callback server, so this URI must be whitelisted even if you also use the browser extension.' +
        '</div>';

    document.getElementById('content').innerHTML = 
        '<h1>🎵 Spotify Integration Setup</h1>' +
        '<p>Follow these steps to connect your Spotify account to Social Stream Ninja!</p>' +
        
        '<div class="info-box">' +
        '<strong>Why do I need my own Spotify app?</strong><br>' +
        'Spotify requires each application to register separately. This ensures your listening data stays private and you control your own integration.' +
        '</div>' +
        
        '<h2>Step 1: Create a Spotify App</h2>' +
        '<div class="step">' +
        '<div class="step-number">1</div>' +
        '<p>First, you\'ll need to create your own Spotify app to get credentials:</p>' +
        '<a href="https://developer.spotify.com/dashboard" target="_blank" class="button">Open Spotify Dashboard →</a>' +
        '<p style="margin-top: 15px;">Log in with your Spotify account and click "Create app"</p>' +
        '</div>' +
        
        '<h2>Step 2: Configure Your App</h2>' +
        '<div class="step">' +
        '<div class="step-number">2</div>' +
        '<p>Fill in the following details:</p>' +
        '<ul>' +
        '<li><strong>App name:</strong> Social Stream Ninja</li>' +
        '<li><strong>App description:</strong> Integration for streaming current playing track</li>' +
        '<li><strong>Website:</strong> https://socialstream.ninja</li>' +
        '<li><strong>Redirect URIs:</strong> Add ALL of these URIs:</li>' +
        '</ul>' +
        
        '<div id="redirect-uri-list">' +
        redirectUrisHtml +
        '</div>' +
        
        '<div class="warning">' +
        '⚠️ Important: You must add ALL redirect URIs shown above to your Spotify app!' +
        '</div>' +
        '</div>' +
        
        '<h2>Step 3: Get Your Credentials</h2>' +
        '<div class="step">' +
        '<div class="step-number">3</div>' +
        '<p>After creating your app:</p>' +
        '<ol style="list-style: decimal; padding-left: 20px;">' +
        '<li>Click on your app in the dashboard</li>' +
        '<li>Go to "Settings"</li>' +
        '<li>Find your <strong>Client ID</strong> and <strong>Client Secret</strong></li>' +
        '<li>Copy these values - you\'ll need them in the next step</li>' +
        '</ol>' +
        '<p style="margin-top: 15px;">' +
        '<strong>Note:</strong> Keep your Client Secret private! Never share it publicly.' +
        '</p>' +
        '</div>' +
        
        '<h2>Step 4: Configure Social Stream</h2>' +
        '<div class="step">' +
        '<div class="step-number">4</div>' +
        '<p>Return to Social Stream Ninja and:</p>' +
        '<ol style="list-style: decimal; padding-left: 20px;">' +
        '<li>Open the Social Stream settings (' + (isExtension ? 'click the extension icon' : 'open the menu') + ')</li>' +
        '<li>Find the "🎵 Spotify Integration" section</li>' +
        '<li>Enter your Client ID and Client Secret</li>' +
        '<li>Click "Connect to Spotify"</li>' +
        '</ol>' +
        '</div>' +
        
        '<div class="info-box" style="margin-top: 30px;">' +
        '<strong>Features available after connecting:</strong>' +
        '<ul>' +
        '<li>Automatic "Now Playing" updates in chat</li>' +
        '<li>Chat commands: !song, !nowplaying, !np</li>' +
        '<li>Configurable polling interval (3-60 seconds)</li>' +
        '<li>Coming soon: Song queue functionality</li>' +
        '</ul>' +
        '</div>' +
        
        extensionNote + desktopNote;
    
    // Add event listeners to copy buttons
    const copyButtons = document.querySelectorAll('.copy-button');
    copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const uri = this.getAttribute('data-uri');
            navigator.clipboard.writeText(uri).then(() => {
                this.textContent = 'Copied!';
                setTimeout(() => {
                    this.textContent = 'Copy';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy to clipboard');
            });
        });
    });
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
