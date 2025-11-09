// Spotify Integration Module for Social Stream

class SpotifyIntegration {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.currentTrack = null;
        this.pollingInterval = null;
        this.settings = null;
        this.callbacks = {
            onNewTrack: null,
            onCommandResponse: null
        };

        this.browserRedirectUri = 'https://socialstream.ninja/spotify.html';
        this.electronRedirectUri = 'http://localhost:8888/callback';
    }

    async initialize(settings, callbacks = {}) {
        this.settings = settings;
        this.callbacks = { ...this.callbacks, ...callbacks };
        
        if (!this.settings.spotifyEnabled) {
            return;
        }

        // Load saved tokens from settings first
        if (this.settings.spotifyAccessToken) {
            this.accessToken = this.settings.spotifyAccessToken;
            this.refreshToken = this.settings.spotifyRefreshToken;
            this.tokenExpiry = this.settings.spotifyTokenExpiry;
            console.log('Loaded Spotify tokens from settings during initialization');
        }

        // Also try loading from storage
        await this.loadTokens();
        
        // Start polling if enabled
        if (this.settings.spotifyNowPlaying) {
            this.startPolling();
        }
    }

    async loadTokens() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const stored = await chrome.storage.local.get(['settings']);
                const storedSettings = stored?.settings;
                
                if (storedSettings?.spotifyAccessToken) {
                    this.accessToken = storedSettings.spotifyAccessToken;
                    this.refreshToken = storedSettings.spotifyRefreshToken;
                    this.tokenExpiry = storedSettings.spotifyTokenExpiry;
                    console.log('Loaded Spotify tokens from settings');
                }
            }

            if (this.refreshToken && (!this.accessToken || Date.now() >= this.tokenExpiry)) {
                await this.refreshAccessToken();
            }
        } catch (e) {
            console.warn('Failed to load Spotify tokens:', e);
        }
    }

    isElectronEnvironment() {
        try {
            if (typeof window !== 'undefined') {
                if (window.ssapp) {
                    return true;
                }
                if (window.process && window.process.versions && window.process.versions.electron) {
                    return true;
                }
            }
        } catch (e) {}
        return typeof ipcRenderer !== 'undefined';
    }

    getDefaultRedirectUri() {
        return this.isElectronEnvironment() ? this.electronRedirectUri : this.browserRedirectUri;
    }

    buildAuthUrl({ redirectUri, scopes, state }) {
        return `https://accounts.spotify.com/authorize?client_id=${this.settings.spotifyClientId.textsetting}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`;
    }

    async invokeElectronOAuth({ authUrl, redirectUri, state }) {
        if (typeof ipcRenderer === 'undefined' || !ipcRenderer.invoke) {
            throw new Error('IPC handler not available');
        }

        const channels = ['spotify-oauth', 'spotifyOAuth'];
        let lastError = null;

        for (const channel of channels) {
            try {
                const result = await ipcRenderer.invoke(channel, { authUrl, redirectUri, state });
                if (result) {
                    return result;
                }
            } catch (error) {
                lastError = error;
                const message = error?.message || '';
                if (!message.toLowerCase().includes('no handler registered')) {
                    throw error;
                }
            }
        }

        throw lastError || new Error('No Spotify OAuth IPC handler registered');
    }

    async refreshAccessToken() {
        if (!this.refreshToken || !this.settings.spotifyClientId?.textsetting || !this.settings.spotifyClientSecret?.textsetting) {
            return;
        }

        try {
            const authString = btoa(`${this.settings.spotifyClientId.textsetting}:${this.settings.spotifyClientSecret.textsetting}`);
            
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `grant_type=refresh_token&refresh_token=${this.refreshToken}`
            });

            const data = await response.json();
            
            if (data.access_token) {
                this.accessToken = data.access_token;
                this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 minute before expiry
                if (data.refresh_token) {
                    this.refreshToken = data.refresh_token;
                }
                
                // Save tokens to settings object
                chrome.storage.local.get(['settings'], async (result) => {
                    const settings = result.settings || {};
                    settings.spotifyAccessToken = this.accessToken;
                    settings.spotifyRefreshToken = this.refreshToken;
                    settings.spotifyTokenExpiry = this.tokenExpiry;
                    
                    await chrome.storage.local.set({ settings: settings });
                    console.log('Refreshed Spotify tokens saved to settings');
                });
            }
        } catch (error) {
            console.warn('Spotify token refresh error:', error);
        }
    }

    startPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        // Get polling interval from settings (default 5 seconds, min 3, max 60)
        const interval = Math.max(3, Math.min(60, this.settings.spotifyPollingInterval?.numbersetting || 5)) * 1000;
        console.log(`Starting Spotify polling with ${interval/1000}s interval`);

        // Poll at specified interval
        this.pollingInterval = setInterval(() => {
            if (!this.settings.spotifyNowPlaying || !this.accessToken) {
                this.stopPolling();
                return;
            }

            // Refresh token if needed
            if (Date.now() >= this.tokenExpiry) {
                this.refreshAccessToken();
                return;
            }

            this.getCurrentTrack();
        }, interval);

        // Get initial track
        this.getCurrentTrack();
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async getCurrentTrack() {
        if (!this.accessToken) {
            return null;
        }

        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || '30';
                console.warn(`Spotify rate limit hit. Waiting ${retryAfter} seconds`);
                
                // Stop polling temporarily
                this.stopPolling();
                
                // Resume after the retry period
                setTimeout(() => {
                    if (this.settings.spotifyNowPlaying) {
                        this.startPolling();
                    }
                }, parseInt(retryAfter) * 1000);
                
                return null;
            }

            if (response.status === 204) {
                this.currentTrack = null;
                return null;
            }

            if (response.status === 401) {
                await this.refreshAccessToken();
                return null;
            }

            const data = await response.json();
            
            if (data && data.item) {
                const newTrack = {
                    name: data.item.name,
                    artist: data.item.artists.map(a => a.name).join(', '),
                    album: data.item.album.name,
                    imageUrl: data.item.album.images[0]?.url,
                    isPlaying: data.is_playing,
                    progress: data.progress_ms,
                    duration: data.item.duration_ms,
                    uri: data.item.uri,
                    id: data.item.id
                };

                // Check if this is a new track
                if (!this.currentTrack || this.currentTrack.id !== newTrack.id) {
                    this.currentTrack = newTrack;
                    
                    // Trigger callback for new track
                    if (this.callbacks.onNewTrack && this.settings.spotifyAnnounceNewTrack) {
                        this.callbacks.onNewTrack(newTrack);
                    }
                }

                return newTrack;
            }
        } catch (error) {
            console.warn('Spotify API error:', error);
        }

        return null;
    }

    formatTrackMessage(track, template) {
        if (!track) return "";
        
        const format = template || "🎵 Now playing: {song} by {artist}";
        return format
            .replace('{song}', track.name)
            .replace('{artist}', track.artist)
            .replace('{album}', track.album);
    }

    handleCommand(command) {
        const lowerCommand = command.toLowerCase().trim();
        
        if (lowerCommand === "!song" || lowerCommand === "!nowplaying" || lowerCommand === "!np") {
            if (this.currentTrack) {
                return `🎵 Currently playing: ${this.currentTrack.name} by ${this.currentTrack.artist}`;
            } else {
                return "No song currently playing on Spotify";
            }
        }

        // Future queue commands
        if (lowerCommand.startsWith("!queue ") || lowerCommand.startsWith("!request ")) {
            return "Song queue feature coming soon!";
        }

        return null;
    }

    // OAuth flow methods for initial setup
    async startOAuthFlow() {
        if (!this.settings.spotifyClientId?.textsetting) {
            throw new Error("Spotify Client ID not configured");
        }

        // Ensure tokens are loaded from settings
        if (!this.accessToken && this.settings.spotifyAccessToken) {
            this.accessToken = this.settings.spotifyAccessToken;
            this.refreshToken = this.settings.spotifyRefreshToken;
            this.tokenExpiry = this.settings.spotifyTokenExpiry;
            console.log("Loaded tokens from settings in startOAuthFlow");
        }

        // Check if we're already authenticated
        if (this.accessToken && this.refreshToken) {
            console.log("Already authenticated with Spotify");
            // Check if token needs refresh
            if (Date.now() >= this.tokenExpiry) {
                console.log("Token expired, refreshing...");
                await this.refreshAccessToken();
            }
            // Return success with indicator that we're already connected
            return { success: true, alreadyConnected: true };
        }

        const scopes = ['user-read-currently-playing', 'user-read-playback-state'];
        const state = Math.random().toString(36).substring(7); // Generate random state for security
        
        // Store state for verification
        this.pendingAuthState = state;

        // Try different approaches based on environment
        try {
            // Check if we have chrome.identity available
            if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getRedirectURL) {
                // Use Chrome Identity API - it generates its own redirect URL
                const redirectUri = chrome.identity.getRedirectURL('spotify');
                console.log('Chrome extension redirect URI:', redirectUri);
                // This will be something like: https://EXTENSION_ID.chromiumapp.org/spotify
                
                const authUrl = `https://accounts.spotify.com/authorize?client_id=${this.settings.spotifyClientId.textsetting}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(' ')}&state=${state}`;
                
                if (chrome.identity.launchWebAuthFlow) {
                    const responseUrl = await chrome.identity.launchWebAuthFlow({
                        url: authUrl,
                        interactive: true
                    });

                    const urlParams = new URL(responseUrl).searchParams;
                    const code = urlParams.get('code');
                    const returnedState = urlParams.get('state');
                    
                    if (returnedState !== state) {
                        throw new Error('State mismatch in OAuth callback');
                    }
                    
                    if (code) {
                        await this.exchangeCodeForToken(code, redirectUri);
                        return { success: true };
                    }

                    const errorParam = urlParams.get('error');
                    if (errorParam) {
                        throw new Error(`Spotify authorization failed: ${errorParam}`);
                    }

                    throw new Error('Spotify authorization did not complete.');
                } else {
                    throw new Error('chrome.identity.launchWebAuthFlow not available');
                }
            } else {
                throw new Error('Chrome identity API not available, using fallback');
            }
        } catch (error) {
            console.log('Chrome identity approach failed:', error.message);
            console.log('Using web-based OAuth flow instead');
            
            // Fallback to web-based flow
            const preferredRedirectUri = this.getDefaultRedirectUri();
            let authUrl = this.buildAuthUrl({ redirectUri: preferredRedirectUri, scopes, state });
            let fallbackStatus = { success: false, waitingForCallback: true };
            
            // Check if we're in Electron environment
            if (this.isElectronEnvironment() && typeof ipcRenderer !== 'undefined' && ipcRenderer.invoke) {
                console.log('Using Electron OAuth flow with IPC handler');
                
                // Store state for callback validation
                this.pendingAuthState = state;
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    await chrome.storage.local.set({ spotifyAuthState: state });
                }
                
                // Use the Electron main process handler that can intercept navigation
                try {
                    const result = await this.invokeElectronOAuth({ authUrl, redirectUri: preferredRedirectUri, state });
                    
                    if (result && result.code) {
                        console.log('OAuth code received from Electron IPC handler');
                        // Process the callback directly
                        const success = await this.handleAuthCallback(
                            result.code,
                            result.state,
                            result.redirectUri || preferredRedirectUri
                        );
                        
                        if (success) {
                            console.log('OAuth callback processed successfully');
                            return { success: true, message: 'Connected to Spotify!' };
                        } else {
                            throw new Error('Failed to process OAuth callback');
                        }
                    } else if (result && result.error) {
                        console.error('OAuth error from Electron:', result.error);
                        throw new Error(`OAuth failed: ${result.error}`);
                    } else if (result && result.waitingForCallback) {
                        return result;
                    } else {
                        // Window closed without auth
                        console.log('OAuth window closed without completing authentication');
                        return { success: false, error: 'Authentication cancelled' };
                    }
                } catch (error) {
                    console.error('Electron OAuth error:', error);
                    const manualAuthUrl = this.buildAuthUrl({ redirectUri: this.browserRedirectUri, scopes, state });
                    window.open(manualAuthUrl, 'spotify-auth', 'width=500,height=700');
                    return { success: false, waitingForManualCallback: true };
                }
            } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                // For Chrome extension, open the auth page in a new tab
                chrome.tabs.create({ url: authUrl });
                fallbackStatus = {
                    success: false,
                    waitingForManualCallback: true,
                    message: 'After authorizing Spotify in the newly opened tab, copy the full callback URL and paste it back into Social Stream Ninja to finish connecting.'
                };
            } else {
                // Fallback to window.open
                window.open(authUrl, 'spotify-auth', 'width=500,height=700');
                fallbackStatus = { success: false, waitingForCallback: true };
            }

            // Store state for manual callback handling
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({ spotifyAuthState: state });
            }

            return fallbackStatus;
        }
    }

    // Handle OAuth callback
    async handleAuthCallback(code, state, redirectUriOverride = null) {
        // Check state from memory or storage
        let validState = false;
        
        if (state === this.pendingAuthState) {
            validState = true;
        } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            // Check stored state for web-based flow
            const stored = await chrome.storage.local.get(['spotifyAuthState']);
            if (stored.spotifyAuthState === state) {
                validState = true;
                // Clean up stored state
                await chrome.storage.local.remove(['spotifyAuthState']);
            }
        }
        
        if (!validState) {
            console.error('State mismatch in OAuth callback');
            return false;
        }

        const redirectUri = redirectUriOverride || this.getDefaultRedirectUri();
        await this.exchangeCodeForToken(code, redirectUri);
        return true;
    }

    async exchangeCodeForToken(code, redirectUri) {
        const authString = btoa(`${this.settings.spotifyClientId.textsetting}:${this.settings.spotifyClientSecret.textsetting}`);
        
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`Spotify token exchange failed: ${data.error} - ${data.error_description}`);
            }
            
            if (data.access_token) {
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
                this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
                
                // Save tokens to settings object
                chrome.storage.local.get(['settings'], async (result) => {
                    const settings = result.settings || {};
                    settings.spotifyAccessToken = this.accessToken;
                    settings.spotifyRefreshToken = this.refreshToken;
                    settings.spotifyTokenExpiry = this.tokenExpiry;
                    
                    await chrome.storage.local.set({ settings: settings });
                    console.log('Spotify tokens saved to settings successfully');
                });
                
                console.log('Spotify tokens saved successfully');
            } else {
                throw new Error('No access token received from Spotify');
            }
        } catch (error) {
            console.error('Token exchange error:', error);
            throw error;
        }
    }

    cleanup() {
        this.stopPolling();
    }
}

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpotifyIntegration;
} else {
    window.SpotifyIntegration = SpotifyIntegration;
}
