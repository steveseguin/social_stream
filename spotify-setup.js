// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const error = urlParams.get('error');
const state = urlParams.get('state');

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
        
        extensionNote;
    
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
        // Send the authorization code to the background script
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                cmd: "spotifyAuthCallback",
                code: code,
                state: state
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
                    state: state
                }, '*');
                updateStatus('Successfully connected to Spotify! 🎵');
                setTimeout(() => window.close(), 2000);
            } else {
                updateStatus('Authorization code received. Please return to Social Stream Ninja.');
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