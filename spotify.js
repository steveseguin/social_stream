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
            const stored = await chrome.storage.local.get(['spotifyAccessToken', 'spotifyRefreshToken', 'spotifyTokenExpiry']);
            if (stored.spotifyAccessToken) {
                this.accessToken = stored.spotifyAccessToken;
                this.refreshToken = stored.spotifyRefreshToken;
                this.tokenExpiry = stored.spotifyTokenExpiry;
                
                // Check if token needs refresh
                if (this.refreshToken && (!this.accessToken || Date.now() >= this.tokenExpiry)) {
                    await this.refreshToken();
                }
            }
        } catch (e) {
            console.warn('Failed to load Spotify tokens:', e);
        }
    }

    async refreshToken() {
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
                
                // Save tokens
                await chrome.storage.local.set({
                    spotifyAccessToken: this.accessToken,
                    spotifyRefreshToken: this.refreshToken,
                    spotifyTokenExpiry: this.tokenExpiry
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

        // Poll every 5 seconds
        this.pollingInterval = setInterval(() => {
            if (!this.settings.spotifyNowPlaying || !this.accessToken) {
                this.stopPolling();
                return;
            }

            // Refresh token if needed
            if (Date.now() >= this.tokenExpiry) {
                this.refreshToken();
                return;
            }

            this.getCurrentTrack();
        }, 5000);

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

            if (response.status === 204) {
                this.currentTrack = null;
                return null;
            }

            if (response.status === 401) {
                await this.refreshToken();
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

        // Use the appropriate redirect URI based on environment
        let redirectUri;
        redirectUri = 'https://socialstream.ninja/spotify.html';
        

        const scopes = ['user-read-currently-playing', 'user-read-playback-state'];
        const state = Math.random().toString(36).substring(7); // Generate random state for security
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${this.settings.spotifyClientId.textsetting}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(' ')}&state=${state}`;

        // Store state for verification
        this.pendingAuthState = state;

        if (chrome && chrome.identity && chrome.identity.launchWebAuthFlow) {
            // Chrome extension using identity API
            try {
                const responseUrl = await chrome.identity.launchWebAuthFlow({
                    url: authUrl,
                    interactive: true
                });

                const code = new URL(responseUrl).searchParams.get('code');
                if (code) {
                    await this.exchangeCodeForToken(code, redirectUri);
                    return true;
                }
            } catch (error) {
                console.error('Spotify OAuth error:', error);
                return false;
            }
        } else {
            // Open in new window for web/electron
            window.open(authUrl, 'spotify-auth', 'width=500,height=700');
            return true; // The callback will be handled separately
        }
    }

    // Handle OAuth callback
    async handleAuthCallback(code, state) {
        if (state !== this.pendingAuthState) {
            console.error('State mismatch in OAuth callback');
            return false;
        }

        let redirectUri;
        redirectUri = 'https://socialstream.ninja/spotify.html';
        

        await this.exchangeCodeForToken(code, redirectUri);
        return true;
    }

    async exchangeCodeForToken(code, redirectUri) {
        const authString = btoa(`${this.settings.spotifyClientId.textsetting}:${this.settings.spotifyClientSecret.textsetting}`);
        
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`
        });

        const data = await response.json();
        
        if (data.access_token) {
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
            
            // Save tokens
            await chrome.storage.local.set({
                spotifyAccessToken: this.accessToken,
                spotifyRefreshToken: this.refreshToken,
                spotifyTokenExpiry: this.tokenExpiry
            });
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