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

		this.browserRedirectUri = 'https://socialstream.ninja/spotify_callback.html';
		this.electronRedirectUri = 'http://127.0.0.1:8888/callback';
		this._isElectronEnv = undefined;
		this._electronIpc = null;
		this.identityAuthInFlight = false;
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
        this.startPolling();
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

    getElectronIpc() {
        if (this._electronIpc) {
            return this._electronIpc;
        }

        try {
            if (typeof ipcRenderer !== 'undefined' && typeof ipcRenderer.invoke === 'function') {
                this._electronIpc = ipcRenderer;
                return this._electronIpc;
            }
        } catch (_) {}

        if (typeof window !== 'undefined') {
            if (window.ipcRenderer && typeof window.ipcRenderer.invoke === 'function') {
                this._electronIpc = window.ipcRenderer;
                return this._electronIpc;
            }

            if (typeof window.require === 'function') {
                try {
                    const electronModule = window.require('electron');
                    if (electronModule && typeof electronModule.ipcRenderer?.invoke === 'function') {
                        this._electronIpc = electronModule.ipcRenderer;
                        return this._electronIpc;
                    }
                } catch (_) {}
            }
        }

        return null;
    }

    hasElectronBridge() {
        return !!this.getElectronIpc();
    }

    isElectronEnvironment() {
        if (typeof this._isElectronEnv === 'boolean') {
            return this._isElectronEnv;
        }

        let detected = false;
        try {
            if (typeof window !== 'undefined') {
                if (window.ninjafy || window.ssapp === true) {
                    detected = true;
                } else if (window.location && typeof window.location.search === 'string' && window.location.search.includes('ssapp')) {
                    detected = true;
                } else if (window.process && window.process.versions && window.process.versions.electron) {
                    detected = true;
                }
            }

            if (!detected && typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Electron')) {
                detected = true;
            }
        } catch (_) {}

        if (!detected && this.hasElectronBridge()) {
            detected = true;
        }

        this._isElectronEnv = detected;
        return detected;
    }

    getDefaultRedirectUri() {
        return this.hasElectronBridge()
            ? this.normalizeLoopbackRedirectUri(this.electronRedirectUri)
            : this.browserRedirectUri;
    }

    buildAuthUrl({ redirectUri, scopes, state }) {
        return `https://accounts.spotify.com/authorize?client_id=${this.settings.spotifyClientId.textsetting}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}`;
    }

	notifySpotifyAuthResult(result) {
		if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
			return;
		}

		try {
			chrome.runtime.sendMessage({ forPopup: { spotifyAuthResult: result } }, () => {
				// Swallow errors when popup isn't open
				if (chrome.runtime.lastError) {
					console.debug('Spotify auth result delivery status:', chrome.runtime.lastError.message);
				}
			});
		} catch (err) {
			console.warn('Failed to send Spotify auth result to popup:', err);
		}
	}

	async launchChromeIdentityFlow({ authUrl, redirectUri, state }) {
		if (this.identityAuthInFlight) {
			console.log('Spotify Chrome identity flow already running');
			return;
		}

		this.identityAuthInFlight = true;

		try {
			const responseUrl = await chrome.identity.launchWebAuthFlow({
				url: authUrl,
				interactive: true
			});

			if (!responseUrl) {
				throw new Error('Spotify authorization did not complete.');
			}

			const url = new URL(responseUrl);
			const code = url.searchParams.get('code');
			const returnedState = url.searchParams.get('state');
			const errorParam = url.searchParams.get('error');

			if (returnedState !== state) {
				throw new Error('State mismatch in OAuth callback');
			}

			if (errorParam) {
				throw new Error(`Spotify authorization failed: ${errorParam}`);
			}

			if (!code) {
				throw new Error('Spotify authorization did not complete.');
			}

			const success = await this.handleAuthCallback(code, returnedState, redirectUri);
			if (!success) {
				throw new Error('Failed to process Spotify authorization response.');
			}

			this.notifySpotifyAuthResult({ success: true, message: 'Connected to Spotify!' });
		} catch (error) {
			const message = error?.message || error?.toString() || 'Spotify authorization failed.';
			console.error('Chrome identity Spotify auth error:', message);
			this.notifySpotifyAuthResult({ success: false, error: message });
		} finally {
			this.identityAuthInFlight = false;
		}
	}

    normalizeLoopbackRedirectUri(uri) {
        if (!uri || typeof uri !== 'string') {
            return uri;
        }

        try {
            const parsed = new URL(uri);
            if ((parsed.hostname === 'localhost' || parsed.hostname === '[::1]' || parsed.hostname === '::1') && parsed.port === '8888') {
                parsed.hostname = '127.0.0.1';
                return parsed.toString();
            }
        } catch (_) {
            // Fall back to simple string replacement
        }

        return uri.replace('http://localhost:8888', 'http://127.0.0.1:8888')
                  .replace('https://localhost:8888', 'http://127.0.0.1:8888');
    }

    describeElectronOAuthError(error) {
        const message = (error?.message || '').toLowerCase();
        if (message.includes('eaddrinuse')) {
            return 'Spotify login is already running. Close the existing browser window or wait a few seconds, then try again or paste the callback URL below.';
        }
        if (message.includes('timeout')) {
            return 'Spotify did not finish signing in within five minutes. If the browser is still waiting, finish the login and paste the callback URL into Social Stream.';
        }
        if (message.includes('auth window closed')) {
            return 'The Spotify login window closed before we received a response. Re-run the login or paste the callback URL below after finishing in your browser.';
        }
        return 'Spotify could not finish connecting automatically. Authorize the app in your regular browser and paste the callback URL into Social Stream Ninja.';
    }

    async invokeElectronOAuth({ authUrl, redirectUri, state }) {
        const electronIpc = this.getElectronIpc();
        if (!electronIpc) {
            throw new Error('IPC handler not available');
        }

        const channels = ['spotify-oauth', 'spotifyOAuth'];
        let lastError = null;

        for (const channel of channels) {
            try {
                const result = await electronIpc.invoke(channel, { authUrl, redirectUri, state });
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

        if (!this.settings?.spotifyEnabled) {
            return;
        }

        // Get polling interval from settings (default 5 seconds, min 3, max 60)
        const interval = Math.max(3, Math.min(60, this.settings.spotifyPollingInterval?.numbersetting || 5)) * 1000;
        console.log(`Starting Spotify polling with ${interval/1000}s interval`);

        const tick = () => {
            if (!this.settings?.spotifyEnabled) {
                this.stopPolling();
                return;
            }

            if (!this.accessToken) {
                return;
            }

            // Refresh token if needed
            if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
                this.refreshAccessToken();
                return;
            }

            this.getCurrentTrack();
        };

        // Poll at specified interval
        this.pollingInterval = setInterval(tick, interval);

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
                    if (this.settings?.spotifyEnabled) {
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

		const persistAuthState = () => {
			if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
				try {
					chrome.storage.local.set({ spotifyAuthState: state });
				} catch (storageError) {
					console.warn('Failed to persist Spotify auth state:', storageError);
				}
			}
		};

		// Try different approaches based on environment
		try {
			// Check if we have chrome.identity available
			if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getRedirectURL) {
				if (this.identityAuthInFlight) {
					return {
						success: false,
						waitingForCallback: true,
						message: 'Spotify login is already running. Please finish the existing authorization window.'
					};
				}

				this.pendingAuthState = state;
				persistAuthState();

				// Use Chrome Identity API - it generates its own redirect URL
				const redirectUri = chrome.identity.getRedirectURL('spotify');
				console.log('Chrome extension redirect URI:', redirectUri);
				// This will be something like: https://EXTENSION_ID.chromiumapp.org/spotify
				
				const authUrl = `https://accounts.spotify.com/authorize?client_id=${this.settings.spotifyClientId.textsetting}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(' ')}&state=${state}`;
				
				if (chrome.identity.launchWebAuthFlow) {
					console.log('Starting Chrome identity OAuth flow (async)');
					this.launchChromeIdentityFlow({ authUrl, redirectUri, state });
					return {
						success: false,
						waitingForCallback: true,
						message: 'Please finish the Spotify login in the newly opened window. This popup will update after Spotify responds.'
					};
				} else {
					throw new Error('chrome.identity.launchWebAuthFlow not available');
				}
			} else {
				throw new Error('Chrome identity API not available, using fallback');
			}
		} catch (error) {
			console.log('Chrome identity approach failed:', error.message);
			console.log('Using web-based OAuth flow instead');
			this.pendingAuthState = state;
			persistAuthState();
			
			const hasElectronBridge = this.hasElectronBridge();
			let preferredRedirectUri = hasElectronBridge ? this.electronRedirectUri : this.browserRedirectUri;
			preferredRedirectUri = this.normalizeLoopbackRedirectUri(preferredRedirectUri);
			let authUrl = this.buildAuthUrl({ redirectUri: preferredRedirectUri, scopes, state });
			let fallbackStatus = { success: false, waitingForCallback: true };

			if (hasElectronBridge) {
				console.log('Using Electron OAuth flow with IPC handler');

		        if (preferredRedirectUri !== this.electronRedirectUri) {
		            preferredRedirectUri = this.normalizeLoopbackRedirectUri(this.electronRedirectUri);
		            authUrl = this.buildAuthUrl({ redirectUri: preferredRedirectUri, scopes, state });
                }
                
                try {
                    const result = await this.invokeElectronOAuth({ authUrl, redirectUri: preferredRedirectUri, state });
                    
                    if (result && result.code) {
                        console.log('OAuth code received from Electron IPC handler');
                        const success = await this.handleAuthCallback(
                            result.code,
                            result.state,
                            this.normalizeLoopbackRedirectUri(result.redirectUri || preferredRedirectUri)
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
                    } else if (result && (result.waitingForCallback || result.waitingForManualCallback)) {
                        return result;
                    } else {
                        console.log('OAuth flow exited without a result');
                        return { success: false, error: 'Authentication cancelled' };
                    }
                } catch (electronError) {
                    console.error('Electron OAuth error:', electronError);
                    const manualAuthUrl = this.buildAuthUrl({ redirectUri: this.browserRedirectUri, scopes, state });
                    return {
                        success: false,
                        waitingForManualCallback: true,
                        message: this.describeElectronOAuthError(electronError),
                        error: electronError?.message,
                        manualAuthUrl
                    };
                }
			} else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
				chrome.tabs.create({ url: authUrl });
				fallbackStatus = {
					success: false,
		            waitingForManualCallback: true,
		            message: 'After authorizing Spotify in the newly opened tab, copy the full callback URL and paste it back into Social Stream Ninja to finish connecting.'
		        };
			} else {
				window.open(authUrl, 'spotify-auth', 'width=500,height=700');
				fallbackStatus = { success: false, waitingForCallback: true };
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

        const redirectUri = this.normalizeLoopbackRedirectUri(redirectUriOverride || this.getDefaultRedirectUri());
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
                if (this.settings?.spotifyEnabled) {
                    this.startPolling();
                }
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
