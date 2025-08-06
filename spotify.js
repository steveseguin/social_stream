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
    }

    initialize(settings, callbacks = {}) {
        this.settings = settings;
        this.callbacks = { ...this.callbacks, ...callbacks };
        
        if (!this.settings.spotifyEnabled) {
            return;
        }

        // Load saved tokens
        this.loadTokens();
        
        // Start polling if enabled
        if (this.settings.spotifyNowPlaying) {
            this.startPolling();
        }
    }

    async loadTokens() {
        try {
            // Check if chrome.storage exists
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                // Load from settings object
                const stored = await chrome.storage.sync.get(['settings']);
                if (stored.settings) {
                    if (stored.settings.spotifyAccessToken) {
                        this.accessToken = stored.settings.spotifyAccessToken;
                        this.refreshToken = stored.settings.spotifyRefreshToken;
                        this.tokenExpiry = stored.settings.spotifyTokenExpiry;
                        console.log('Loaded Spotify tokens from settings');
                    }
                }
            }
                
            // Check if token needs refresh
            if (this.refreshToken && (!this.accessToken || Date.now() >= this.tokenExpiry)) {
                await this.refreshAccessToken();
            }
        } catch (e) {
            console.warn('Failed to load Spotify tokens:', e);
        }
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
                chrome.storage.sync.get(['settings'], async (result) => {
                    const settings = result.settings || {};
                    settings.spotifyAccessToken = this.accessToken;
                    settings.spotifyRefreshToken = this.refreshToken;
                    settings.spotifyTokenExpiry = this.tokenExpiry;
                    
                    await chrome.storage.sync.set({ settings: settings });
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
                        return true;
                    }
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
            const redirectUri = 'https://socialstream.ninja/spotify.html';
            const authUrl = `https://accounts.spotify.com/authorize?client_id=${this.settings.spotifyClientId.textsetting}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(' ')}&state=${state}`;
            
            // Check if we're in Electron environment
            if (typeof ipcRenderer !== 'undefined' && ipcRenderer.sendSync) {
                console.log('Using Electron OAuth flow');
                // For now, just open in external browser in Electron
                if (typeof shell !== 'undefined' && shell.openExternal) {
                    shell.openExternal(authUrl);
                } else {
                    window.open(authUrl, 'spotify-auth', 'width=500,height=700');
                }
                
                // Store state for manual callback handling
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    await chrome.storage.local.set({ spotifyAuthState: state });
                }
                
                return true;
            } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                // For Chrome extension, use chrome.tabs.create
                chrome.tabs.create({ url: authUrl });
            } else {
                // Fallback to window.open
                window.open(authUrl, 'spotify-auth', 'width=500,height=700');
            }
            
            // Store state for manual callback handling
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({ spotifyAuthState: state });
            }
            
            return true;
        }
    }

    // Handle OAuth callback
    async handleAuthCallback(code, state) {
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

        const redirectUri = 'https://socialstream.ninja/spotify.html';
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
                chrome.storage.sync.get(['settings'], async (result) => {
                    const settings = result.settings || {};
                    settings.spotifyAccessToken = this.accessToken;
                    settings.spotifyRefreshToken = this.refreshToken;
                    settings.spotifyTokenExpiry = this.tokenExpiry;
                    
                    await chrome.storage.sync.set({ settings: settings });
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