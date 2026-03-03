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
		this.authWarning = null;
		this.lastPolicyWarning = {
			key: null,
			timestamp: 0
		};

		this.browserRedirectUri = 'https://socialstream.ninja/spotify.html';
		this.electronRedirectUri = 'http://127.0.0.1:8888/callback';
		this._isElectronEnv = undefined;
		this._electronIpc = null;
		this.identityAuthInFlight = false;
		this.pendingElectronOAuth = null;

		// Managed queue for song requests - enables !revoke functionality
		this.managedQueue = {
			entries: [],           // Array of QueueEntry objects
			currentlyPlaying: null // Currently playing track from our queue
		};
		this.managedQueueEnabled = false;
	}

    async initialize(settings, callbacks = {}) {
        this.settings = settings;
        this.callbacks = { ...this.callbacks, ...callbacks };
        this.managedQueueEnabled = !!(this.settings?.spotifyManagedQueue?.setting ?? this.settings?.spotifyManagedQueue);
        
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

    getDevelopmentModePolicyGuidance() {
        return 'Spotify Development Mode changes (new apps from February 11, 2026; existing apps from March 9, 2026) require an active Premium subscription for the app owner, allow one Development Mode Client ID per developer, and limit each client to up to five authorized users. This playback-based integration is effectively Premium-only.';
    }

    setAuthWarning(warning) {
        this.authWarning = warning || null;
    }

    consumeAuthWarning() {
        const warning = this.authWarning;
        this.authWarning = null;
        return warning;
    }

    reportPolicyRestriction(message, errorCode = 'spotify_policy_restriction') {
        const cleanMessage = (message || '').trim();
        if (!cleanMessage) {
            return;
        }

        const now = Date.now();
        const warningKey = `${errorCode}:${cleanMessage}`;
        if (
            this.lastPolicyWarning.key === warningKey &&
            (now - this.lastPolicyWarning.timestamp) < 120000
        ) {
            return;
        }

        this.lastPolicyWarning = {
            key: warningKey,
            timestamp: now
        };

        console.warn('[Spotify Policy Restriction]', cleanMessage);

        if (this.callbacks.onTrackUpdate) {
            this.callbacks.onTrackUpdate({
                track: this.currentTrack || null,
                status: 'error',
                isPlaying: false,
                progressMs: 0,
                durationMs: 0,
                receivedAt: now,
                errorCode,
                message: cleanMessage
            });
        }

        if (this.callbacks.onPolicyIssue) {
            try {
                this.callbacks.onPolicyIssue({
                    message: cleanMessage,
                    errorCode,
                    timestamp: now
                });
            } catch (error) {
                console.warn('Spotify policy callback error:', error);
            }
        }
    }

    async checkDevelopmentModeEligibility() {
        if (!this.accessToken) {
            return null;
        }

        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status === 401) {
                await this.refreshAccessToken();
                return null;
            }

            if (response.status === 403) {
                return this.parsePlaybackError(
                    response,
                    'Spotify denied playback access for this account.'
                );
            }

            return null;
        } catch (error) {
            console.warn('Spotify eligibility check failed:', error);
            return null;
        }
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

				const warning = this.consumeAuthWarning();
				this.notifySpotifyAuthResult({
					success: true,
					warning,
					message: warning
						? `Connected to Spotify, but playback access is limited: ${warning}`
						: 'Connected to Spotify!'
				});
				} catch (error) {
					const normalized = this.normalizeOAuthError(error, {
						runtime: 'extension',
						redirectUriAttempted: redirectUri
					});
					console.error('Chrome identity Spotify auth error:', normalized.errorCode, normalized.error);
					this.notifySpotifyAuthResult({
						success: false,
						errorCode: normalized.errorCode,
						error: normalized.error,
						message: normalized.message,
						redirectUriAttempted: normalized.redirectUriAttempted,
						expectedRedirectUris: normalized.expectedRedirectUris
					});
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
	            if (parsed.hostname === 'localhost' || parsed.hostname === '[::1]' || parsed.hostname === '::1') {
	                parsed.hostname = '127.0.0.1';
	                return parsed.toString();
	            }
	        } catch (_) {
	            // Fall back to simple string replacement
	        }

	        return uri
	            .replace('http://localhost:', 'http://127.0.0.1:')
	            .replace('https://localhost:', 'http://127.0.0.1:');
	    }

	    getExpectedElectronRedirectUris(redirectUriAttempted = null) {
	        const loopback = [
	            'http://127.0.0.1:8888/callback',
	            'http://127.0.0.1:8080/callback',
	            'http://127.0.0.1:8181/callback'
	        ];
	        const attempted = this.normalizeLoopbackRedirectUri(redirectUriAttempted);
	        const out = [];
	        if (attempted) {
	            out.push(attempted);
	        }
	        loopback.forEach((uri) => {
	            if (!out.includes(uri)) {
	                out.push(uri);
	            }
	        });
	        return out;
	    }

	    createOAuthError(code, message, details = {}) {
	        const error = new Error(message || 'Spotify OAuth failed');
	        if (code) {
	            error.code = code;
	        }
	        if (details && typeof details === 'object') {
	            Object.assign(error, details);
	        }
	        return error;
	    }

	    normalizeOAuthError(error, context = {}) {
	        const rawError = String(
	            error?.error ||
	            error?.message ||
	            error?.toString?.() ||
	            'Spotify authorization failed.'
	        );

	        let errorCode = String(error?.errorCode || error?.code || context.errorCode || '').toUpperCase();
	        if (!errorCode) {
	            const message = rawError.toLowerCase();
	            if (
	                message.includes('eaddrinuse') ||
	                message.includes('address already in use') ||
	                message.includes('port unavailable') ||
	                message.includes('port_in_use') ||
	                (message.includes('unable to bind') && message.includes('callback port'))
	            ) {
	                errorCode = 'PORT_IN_USE';
	            } else if (message.includes('state mismatch')) {
	                errorCode = 'STATE_MISMATCH';
	            } else if ((message.includes('redirect') && message.includes('mismatch')) || message.includes('unexpected callback uri')) {
	                errorCode = 'REDIRECT_MISMATCH';
	            } else if (message.includes('timeout')) {
	                errorCode = 'TIMEOUT';
	            } else if (message.includes('closed by user') || message.includes('auth window closed') || message.includes('interrupted')) {
	                errorCode = 'USER_CLOSED';
	            } else {
	                const explicitMatch = rawError.match(/\b(PORT_IN_USE|STATE_MISMATCH|REDIRECT_MISMATCH|TIMEOUT|USER_CLOSED)\b/i);
	                errorCode = explicitMatch ? explicitMatch[1].toUpperCase() : 'OAUTH_ERROR';
	            }
	        }

	        const runtime = context.runtime || (this.hasElectronBridge() ? 'electron' : 'extension');
	        const attemptedRedirectUri = this.normalizeLoopbackRedirectUri(
	            context.redirectUriAttempted ||
	            error?.redirectUriAttempted ||
	            error?.attemptedRedirectUri ||
	            null
	        );
	        const expectedRedirectUris = Array.isArray(context.expectedRedirectUris) && context.expectedRedirectUris.length
	            ? context.expectedRedirectUris
	            : (Array.isArray(error?.expectedRedirectUris) && error.expectedRedirectUris.length
	                ? error.expectedRedirectUris
	                : (runtime === 'electron' ? this.getExpectedElectronRedirectUris(attemptedRedirectUri) : []));

	        let message;
	        switch (errorCode) {
	            case 'PORT_IN_USE':
	                message = 'Spotify could not bind a local callback port. Close other app/browser sessions using Spotify OAuth and try again.';
	                break;
	            case 'STATE_MISMATCH':
	                message = 'Spotify callback state check failed. Re-run Spotify connect from the popup and use only the latest auth window/tab.';
	                break;
	            case 'REDIRECT_MISMATCH':
	                message = 'Spotify redirected to an unexpected callback URI. Verify your Spotify app redirect URI list matches this runtime mode.';
	                break;
	            case 'TIMEOUT':
	                message = 'Spotify login timed out before callback was received. Re-run connect and complete consent promptly.';
	                break;
	            case 'USER_CLOSED':
	                message = 'Spotify login window was closed before authorization completed.';
	                break;
	            default:
	                message = 'Spotify could not finish connecting automatically.';
	                break;
	        }

	        if (attemptedRedirectUri) {
	            message += ` Attempted redirect: ${attemptedRedirectUri}.`;
	        }

	        if (runtime === 'electron') {
	            if (expectedRedirectUris.length) {
	                message += ` Expected desktop redirect URIs include: ${expectedRedirectUris.join(', ')}.`;
	            }
	        } else if (runtime === 'extension') {
	            message += ' Extension mode expects the chromiumapp callback URI generated by chrome.identity.';
	        }

	        return {
	            errorCode,
	            error: rawError,
	            message,
	            redirectUriAttempted: attemptedRedirectUri,
	            expectedRedirectUris
	        };
	    }

	    describeElectronOAuthError(error, context = {}) {
	        return this.normalizeOAuthError(error, { ...context, runtime: 'electron' }).message;
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

    launchElectronOAuthFlow({ authUrl, redirectUri, state, scopes }) {
        const normalizedRedirect = this.normalizeLoopbackRedirectUri(redirectUri || this.electronRedirectUri);
        const request = { authUrl, redirectUri: normalizedRedirect, state };
        let electronPromise;

        try {
            electronPromise = this.invokeElectronOAuth(request);
        } catch (error) {
            throw error;
        }

	        electronPromise
	            .then((result) => this.processElectronOAuthResult(result, {
	                state,
	                redirectUri: normalizedRedirect
	            }))
	            .catch((error) => this.handleElectronOAuthError(error, { state, scopes, redirectUri: normalizedRedirect }));

        this.pendingElectronOAuth = electronPromise;
    }

    async processElectronOAuthResult(result, { state, redirectUri }) {
        if (!result) {
            return;
        }

        if (result.code) {
            try {
	                const success = await this.handleAuthCallback(
	                    result.code,
	                    result.state || state,
	                    this.normalizeLoopbackRedirectUri(result.redirectUri || redirectUri)
	                );

	                if (success) {
                        const warning = this.consumeAuthWarning();
	                    this.notifySpotifyAuthResult({
                            success: true,
                            warning,
                            message: warning
                                ? `Connected to Spotify, but playback access is limited: ${warning}`
                                : 'Connected to Spotify!'
                        });
	                } else {
	                    this.notifySpotifyAuthResult({
	                        success: false,
	                        error: 'Failed to process Spotify authorization response.'
	                    });
                }
	            } catch (error) {
	                console.error('Spotify OAuth callback processing failed:', error);
	                const normalized = this.normalizeOAuthError(error, {
	                    runtime: 'electron',
	                    redirectUriAttempted: result?.redirectUri || redirectUri
	                });
	                this.notifySpotifyAuthResult({
	                    success: false,
	                    errorCode: normalized.errorCode,
	                    error: normalized.error,
	                    message: normalized.message,
	                    redirectUriAttempted: normalized.redirectUriAttempted,
	                    expectedRedirectUris: normalized.expectedRedirectUris
	                });
	            }
	            return;
	        }

	        if (result.error || result.errorCode) {
	            const normalized = this.normalizeOAuthError(result, {
	                runtime: 'electron',
	                redirectUriAttempted: result?.redirectUriAttempted || result?.attemptedRedirectUri || redirectUri,
	                expectedRedirectUris: result?.expectedRedirectUris
	            });
	            this.notifySpotifyAuthResult({
	                success: false,
	                errorCode: normalized.errorCode,
	                error: normalized.error,
	                message: normalized.message,
	                redirectUriAttempted: normalized.redirectUriAttempted,
	                expectedRedirectUris: normalized.expectedRedirectUris
	            });
	            return;
	        }

        if (result.waitingForManualCallback || result.manualAuthUrl || result.waitingForCallback) {
            this.notifySpotifyAuthResult({
                success: false,
                waitingForManualCallback: !!result.waitingForManualCallback,
                waitingForCallback: !!result.waitingForCallback,
                manualAuthUrl: result.manualAuthUrl,
                message: result.message
            });
        }
    }

	    handleElectronOAuthError(error, { state, scopes, redirectUri }) {
	        console.error('Electron OAuth error:', error);
	        const normalized = this.normalizeOAuthError(error, {
	            runtime: 'electron',
	            redirectUriAttempted: redirectUri,
	            expectedRedirectUris: error?.expectedRedirectUris
	        });
	        const manualAuthUrl = this.buildAuthUrl({
	            redirectUri: this.browserRedirectUri,
	            scopes,
	            state
	        });
	        const offerManualCallback = normalized.errorCode !== 'USER_CLOSED';

	        this.notifySpotifyAuthResult({
	            success: false,
	            waitingForManualCallback: offerManualCallback,
	            manualAuthUrl: offerManualCallback ? manualAuthUrl : undefined,
	            errorCode: normalized.errorCode,
	            error: normalized.error,
	            message: normalized.message,
	            redirectUriAttempted: normalized.redirectUriAttempted,
	            expectedRedirectUris: normalized.expectedRedirectUris
	        });
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

    async getCurrentTrack(isRetry = false) {
        this.managedQueueEnabled = !!(this.settings?.spotifyManagedQueue?.setting ?? this.settings?.spotifyManagedQueue);
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

            if (response.status === 401 && !isRetry) {
                await this.refreshAccessToken();
                // After refresh, retry once to get the track immediately
                return this.getCurrentTrack(true);
            }

            if (response.status === 204) {
                this.currentTrack = null;
                if (this.callbacks.onTrackUpdate) {
                    this.callbacks.onTrackUpdate({
                        track: null,
                        status: 'stopped',
                        isPlaying: false,
                        progressMs: 0,
                        durationMs: 0,
                        receivedAt: Date.now()
                    });
                }
                return null;
            }

            if (response.status === 403) {
                const message = await this.parsePlaybackError(
                    response,
                    'Spotify blocked playback status for this account.'
                );
                this.reportPolicyRestriction(message, 'spotify_playback_403');
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
                
                const overlayPayload = {
                    track: newTrack,
                    status: data.is_playing ? 'playing' : 'paused',
                    isPlaying: !!data.is_playing,
                    progressMs: data.progress_ms || 0,
                    durationMs: newTrack.duration,
                    receivedAt: Date.now(),
                    device: data.device ? {
                        name: data.device.name,
                        type: data.device.type,
                        volume: data.device.volume_percent,
                        isActive: data.device.is_active
                    } : undefined,
                    contextUri: data.context?.uri || undefined
                };

                // Check if this is a new track
                if (!this.currentTrack || this.currentTrack.id !== newTrack.id) {
                    this.currentTrack = newTrack;

                    // Update managed queue state
                    if (this.managedQueueEnabled) {
                        this.onTrackChanged(newTrack);
                    }

                    // Trigger callback for new track
                    if (this.callbacks.onNewTrack && this.settings.spotifyAnnounceNewTrack) {
                        this.callbacks.onNewTrack(newTrack);
                    }
                } else {
                    this.currentTrack = newTrack;
                }

                if (this.callbacks.onTrackUpdate) {
                    this.callbacks.onTrackUpdate(overlayPayload);
                }

                return newTrack;
            }
        } catch (error) {
            console.warn('Spotify API error:', error);
        }

        return null;
    }

    /**
     * Parse Spotify API error responses into user-friendly messages
     */
    async parsePlaybackError(response, fallback) {
        let payload = null;
        try { payload = await response.json(); } catch {}
        const msg = payload?.error?.message || '';
        const lower = msg.toLowerCase();

        if (response.status === 403) {
            const policyGuidance = this.getDevelopmentModePolicyGuidance();

            if (lower.includes('premium')) {
                return `Spotify Premium is required for this Spotify Development Mode integration. ${policyGuidance}`;
            }
            if (
                lower.includes('development mode') ||
                lower.includes('authorized user') ||
                lower.includes('not authorized') ||
                lower.includes('allowlist') ||
                lower.includes('whitelist') ||
                lower.includes('quota mode')
            ) {
                return `This Spotify account is not allowed for this app's Development Mode. ${policyGuidance}`;
            }
            if (lower.includes('scope')) {
                return "Spotify permissions issue. Try disconnecting and reconnecting Spotify.";
            }
            if (lower.includes('restricted')) {
                return "This device doesn't support remote control.";
            }
            return `Spotify denied playback access for this app/account. ${policyGuidance}`;
        }

        if (response.status === 429) {
            const retry = response.headers.get('Retry-After');
            return retry
                ? `Spotify rate limited. Try again in ${retry}s.`
                : "Spotify rate limited. Try again shortly.";
        }

        if (response.status >= 500) {
            return "Spotify is having issues. Try again later.";
        }

        return fallback;
    }

    // Playback control methods
    async skip() {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/next', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status === 204 || response.ok) {
                return { success: true, message: "⏭️ Skipped to next track" };
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.skip();
            } else if (response.status === 404) {
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            } else {
                const message = await this.parsePlaybackError(response, "Failed to skip track");
                return { success: false, message };
            }
        } catch (error) {
            console.warn('Spotify skip error:', error);
            return { success: false, message: "Error skipping track" };
        }
    }

    async previous() {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/previous', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status === 204 || response.ok) {
                return { success: true, message: "⏮️ Playing previous track" };
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.previous();
            } else if (response.status === 404) {
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            } else {
                const message = await this.parsePlaybackError(response, "Failed to go to previous track");
                return { success: false, message };
            }
        } catch (error) {
            console.warn('Spotify previous error:', error);
            return { success: false, message: "Error going to previous track" };
        }
    }

    async pause() {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status === 204 || response.ok) {
                return { success: true, message: "⏸️ Playback paused" };
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.pause();
            } else if (response.status === 404) {
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            } else {
                const message = await this.parsePlaybackError(response, "Failed to pause playback");
                return { success: false, message };
            }
        } catch (error) {
            console.warn('Spotify pause error:', error);
            return { success: false, message: "Error pausing playback" };
        }
    }

    async resume() {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status === 204 || response.ok) {
                return { success: true, message: "▶️ Playback resumed" };
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.resume();
            } else if (response.status === 404) {
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            } else {
                const message = await this.parsePlaybackError(response, "Failed to resume playback");
                return { success: false, message };
            }
        } catch (error) {
            console.warn('Spotify resume error:', error);
            return { success: false, message: "Error resuming playback" };
        }
    }

    async setVolume(percent) {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        const volume = Math.max(0, Math.min(100, parseInt(percent) || 50));

        try {
            const response = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status === 204 || response.ok) {
                return { success: true, message: `🔊 Volume set to ${volume}%` };
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.setVolume(percent);
            } else if (response.status === 404) {
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            } else {
                const message = await this.parsePlaybackError(response, "Failed to set volume");
                return { success: false, message };
            }
        } catch (error) {
            console.warn('Spotify volume error:', error);
            return { success: false, message: "Error setting volume" };
        }
    }

    async toggle() {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        try {
            // Get current playback state
            const stateResponse = await fetch('https://api.spotify.com/v1/me/player', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (stateResponse.status === 401) {
                await this.refreshAccessToken();
                return this.toggle();
            }

            if (stateResponse.status === 204 || stateResponse.status === 404) {
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            }

            const state = await stateResponse.json();
            const isPlaying = state.is_playing;

            // Toggle based on current state
            if (isPlaying) {
                return this.pause();
            } else {
                return this.resume();
            }
        } catch (error) {
            console.warn('Spotify toggle error:', error);
            return { success: false, message: "Error toggling playback" };
        }
    }

    async shuffle(state = null) {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        try {
            // If state not specified, toggle current state
            if (state === null) {
                const stateResponse = await fetch('https://api.spotify.com/v1/me/player', {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                });

                if (stateResponse.status === 401) {
                    await this.refreshAccessToken();
                    return this.shuffle(state);
                }

                if (stateResponse.status === 204 || stateResponse.status === 404) {
                    return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
                }

                const playerState = await stateResponse.json();
                state = !playerState.shuffle_state;
            }

            const response = await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status === 204 || response.ok) {
                return { success: true, message: state ? "🔀 Shuffle enabled" : "➡️ Shuffle disabled" };
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.shuffle(state);
            } else if (response.status === 404) {
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            } else {
                const message = await this.parsePlaybackError(response, "Failed to set shuffle");
                return { success: false, message };
            }
        } catch (error) {
            console.warn('Spotify shuffle error:', error);
            return { success: false, message: "Error setting shuffle" };
        }
    }

    async setRepeat(mode = 'off') {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        // Valid modes: 'off', 'track', 'context'
        const validModes = ['off', 'track', 'context'];
        if (!validModes.includes(mode)) {
            mode = 'off';
        }

        try {
            const response = await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${mode}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status === 204 || response.ok) {
                const modeEmoji = mode === 'track' ? '🔂' : mode === 'context' ? '🔁' : '➡️';
                const modeText = mode === 'track' ? 'Repeat track' : mode === 'context' ? 'Repeat playlist' : 'Repeat off';
                return { success: true, message: `${modeEmoji} ${modeText}` };
            } else if (response.status === 401) {
                await this.refreshAccessToken();
                return this.setRepeat(mode);
            } else if (response.status === 404) {
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            } else {
                const message = await this.parsePlaybackError(response, "Failed to set repeat mode");
                return { success: false, message };
            }
        } catch (error) {
            console.warn('Spotify repeat error:', error);
            return { success: false, message: "Error setting repeat mode" };
        }
    }

    async getNowPlaying() {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify", track: null };
        }

        try {
            const track = await this.getCurrentTrack();
            if (track) {
                return {
                    success: true,
                    message: `🎵 Now playing: ${track.name} by ${track.artist}`,
                    track: track
                };
            } else {
                return { success: false, message: "No song currently playing", track: null };
            }
        } catch (error) {
            console.warn('Spotify now playing error:', error);
            return { success: false, message: "Error getting current track", track: null };
        }
    }

    async addToQueue(query) {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        if (!query || !query.trim()) {
            return { success: false, message: "Please specify a song to add to the queue" };
        }

        try {
            // First search for the track
            const searchResponse = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (searchResponse.status === 401) {
                await this.refreshAccessToken();
                return this.addToQueue(query);
            }

            const searchData = await searchResponse.json();

            if (!searchData.tracks || !searchData.tracks.items || searchData.tracks.items.length === 0) {
                return { success: false, message: `No track found for "${query}"` };
            }

            const track = searchData.tracks.items[0];
            const trackUri = track.uri;
            const trackName = track.name;
            const trackArtist = track.artists.map(a => a.name).join(', ');

            // Add to queue
            const queueResponse = await fetch(
                `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (queueResponse.status === 204 || queueResponse.ok) {
                return { success: true, message: `📋 Added to queue: ${trackName} by ${trackArtist}` };
            } else if (queueResponse.status === 404) {
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            } else {
                const message = await this.parsePlaybackError(queueResponse, "Failed to add track to queue");
                return { success: false, message };
            }
        } catch (error) {
            console.warn('Spotify queue error:', error);
            return { success: false, message: "Error adding to queue" };
        }
    }

    // ============================================
    // Managed Queue Methods (for !revoke support)
    // ============================================

    /**
     * Add a song to the managed queue with requester tracking
     * @param {string} query - Song search query
     * @param {object} requesterData - { requesterName, requesterKey }
     */
    async addToManagedQueue(query, requesterData = {}) {
        if (!this.accessToken) {
            return { success: false, message: "Not connected to Spotify" };
        }

        if (!query || !query.trim()) {
            return { success: false, message: "Please specify a song to add to the queue" };
        }

        try {
            // Search for the track
            const searchResponse = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (searchResponse.status === 401) {
                await this.refreshAccessToken();
                return this.addToManagedQueue(query, requesterData);
            }

            const searchData = await searchResponse.json();

            if (!searchData.tracks || !searchData.tracks.items || searchData.tracks.items.length === 0) {
                return { success: false, message: `No track found for "${query}"` };
            }

            const track = searchData.tracks.items[0];

            // Create queue entry
            const entry = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                trackUri: track.uri,
                trackName: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                requesterName: requesterData.requesterName || 'Unknown',
                requesterKey: requesterData.requesterKey || 'unknown:unknown',
                timestamp: Date.now(),
                status: 'pending'
            };

            // Add to managed queue
            this.managedQueue.entries.push(entry);

            // Calculate queue position (only pending/queued entries ahead)
            const position = this.managedQueue.entries.filter(e =>
                e.status === 'pending' || e.status === 'queued'
            ).length;

            // Try to push to Spotify if buffer is empty
            const pushResult = await this.pushNextToSpotify();

            // If this was the first song and it failed to push, remove it and return the error
            if (pushResult && !pushResult.success && !pushResult.buffered) {
                const idx = this.managedQueue.entries.indexOf(entry);
                if (idx !== -1) this.managedQueue.entries.splice(idx, 1);
                return { success: false, message: pushResult.message };
            }

            return {
                success: true,
                message: `📋 Added to queue: ${entry.trackName} by ${entry.artist} (position #${position}). Use !revoke to remove if wrong.`,
                entry: entry
            };
        } catch (error) {
            console.warn('Spotify managed queue error:', error);
            return { success: false, message: "Error adding to queue" };
        }
    }

    /**
     * Revoke (remove) the last song added by a specific user
     * @param {string} requesterKey - Composite key: platform:username
     */
    async revokeFromQueue(requesterKey) {
        // Find all entries from this user
        const userEntries = this.managedQueue.entries.filter(e => e.requesterKey === requesterKey);

        if (userEntries.length === 0) {
            return { success: false, message: "You don't have any songs in the queue to revoke." };
        }

        // Find the last PENDING entry from this user (can be revoked)
        const pendingEntries = userEntries.filter(e => e.status === 'pending');

        if (pendingEntries.length === 0) {
            // User has entries but none are pending
            const hasQueued = userEntries.some(e => e.status === 'queued');
            const hasPlaying = userEntries.some(e => e.status === 'playing');

            if (hasPlaying) {
                return { success: false, message: "Your song is currently playing! Use !skip to skip it." };
            } else if (hasQueued) {
                return { success: false, message: "Your song is already in Spotify's queue and cannot be removed. Ask a mod to !skip when it plays." };
            }
            return { success: false, message: "You don't have any songs in the queue to revoke." };
        }

        // Remove the LAST pending entry from this user
        const entryToRemove = pendingEntries[pendingEntries.length - 1];
        const index = this.managedQueue.entries.findIndex(e => e.id === entryToRemove.id);

        if (index !== -1) {
            this.managedQueue.entries.splice(index, 1);
            return {
                success: true,
                message: `↩️ Removed from queue: ${entryToRemove.trackName} by ${entryToRemove.artist}`
            };
        }

        return { success: false, message: "Error removing song from queue." };
    }

    /**
     * Push the next pending song to Spotify's actual queue
     * Maintains a buffer of 1 song in Spotify's queue
     */
    async pushNextToSpotify() {
        if (!this.accessToken) return { success: false, message: "Not connected to Spotify" };

        // Count how many songs are currently queued in Spotify
        const queuedCount = this.managedQueue.entries.filter(e => e.status === 'queued').length;

        // Only push if buffer is empty (no songs waiting in Spotify's queue)
        if (queuedCount >= 1) return { success: true, buffered: true };

        // Find the first pending entry
        const nextEntry = this.managedQueue.entries.find(e => e.status === 'pending');
        if (!nextEntry) return { success: true, noPending: true };

        try {
            // Add to Spotify's queue
            const queueResponse = await fetch(
                `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(nextEntry.trackUri)}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (queueResponse.status === 204 || queueResponse.ok) {
                nextEntry.status = 'queued';
                nextEntry.queuedAt = Date.now();
                console.log(`[Spotify] Pushed to queue: ${nextEntry.trackName}`);
                return { success: true };
            } else if (queueResponse.status === 401) {
                await this.refreshAccessToken();
                return this.pushNextToSpotify();
            } else if (queueResponse.status === 404) {
                console.warn(`[Spotify] No active device found`);
                return { success: false, message: "No active Spotify device found. Open Spotify and start playing something first." };
            } else {
                console.warn(`[Spotify] Failed to push to queue: ${queueResponse.status}`);
                const message = await this.parsePlaybackError(queueResponse, "Failed to add to Spotify queue");
                return { success: false, message };
            }
        } catch (error) {
            console.warn('[Spotify] Error pushing to queue:', error);
            return { success: false, message: "Error adding to Spotify queue" };
        }
    }

    /**
     * Called when the currently playing track changes
     * Updates queue status and pushes next song
     * @param {object} newTrack - The new track object from getCurrentTrack
     */
    onTrackChanged(newTrack) {
        if (!newTrack || !newTrack.uri) return;

        // Find if this track is in our managed queue
        const matchingEntry = this.managedQueue.entries.find(e =>
            e.trackUri === newTrack.uri && e.status === 'queued'
        );

        if (matchingEntry) {
            // Mark previous playing as played
            const previousPlaying = this.managedQueue.entries.find(e => e.status === 'playing');
            if (previousPlaying) {
                previousPlaying.status = 'played';
            }

            // Update this entry to playing
            matchingEntry.status = 'playing';
            this.managedQueue.currentlyPlaying = matchingEntry;
            console.log(`[Spotify] Now playing from queue: ${matchingEntry.trackName}`);
        }

        // Clean up old 'played' entries (keep last 5 for reference)
        const playedEntries = this.managedQueue.entries.filter(e => e.status === 'played');
        if (playedEntries.length > 5) {
            const toRemove = playedEntries.slice(0, playedEntries.length - 5);
            toRemove.forEach(entry => {
                const idx = this.managedQueue.entries.indexOf(entry);
                if (idx !== -1) this.managedQueue.entries.splice(idx, 1);
            });
        }

        // Push next song to Spotify queue
        this.pushNextToSpotify();
    }

    formatTrackMessage(track, template) {
        if (!track) return "";
        
        const format = template || "🎵 Now playing: {song} by {artist}";
        return format
            .replace('{song}', track.name)
            .replace('{artist}', track.artist)
            .replace('{album}', track.album);
    }

    // Check if user has required role for a command
    hasPermission(data, requiredRoles) {
        if (!requiredRoles || requiredRoles.length === 0) {
            return true; // No restrictions
        }

        // Host and admin always have permission
        if (data.host || data.admin) {
            return true;
        }

        for (const role of requiredRoles) {
            if (role === 'mod' && data.mod) return true;
            if (role === 'vip' && data.vip) return true;
            if (role === 'subscriber' && data.subscriber) return true;
            if (role === 'anyone') return true;
        }

        return false;
    }

    // Get command permissions from settings or use defaults
    getCommandPermissions() {
        const defaults = {
            '!song': ['anyone'],
            '!nowplaying': ['anyone'],
            '!np': ['anyone'],
            '!skip': ['mod'],
            '!next': ['mod'],
            '!previous': ['mod'],
            '!prev': ['mod'],
            '!pause': ['mod'],
            '!stop': ['mod'],
            '!play': ['mod'],
            '!resume': ['mod'],
            '!volume': ['mod'],
            '!vol': ['mod'],
            '!queue': ['anyone'],
            '!request': ['anyone'],
            '!sr': ['anyone'],
            '!revoke': ['anyone']
        };

        // Allow settings to override defaults (stored as { json: string, object: parsed })
        const savedPerms = this.settings?.spotifyCommandPermissions?.object || this.settings?.spotifyCommandPermissions;
        if (savedPerms && typeof savedPerms === 'object') {
            return { ...defaults, ...savedPerms };
        }

        return defaults;
    }

    // Check if a command is disabled
    isCommandDisabled(cmd) {
        const disabled = this.settings?.spotifyDisabledCommands?.object || this.settings?.spotifyDisabledCommands || [];
        if (Array.isArray(disabled)) {
            return disabled.includes(cmd);
        }
        return false;
    }

    // Get custom triggers mapping from settings
    // Returns: { '!song': ['!song', '!cancion'], '!skip': ['!skip'], ... }
    getCustomTriggers() {
        const customTriggers = this.settings?.spotifyCommandTriggers?.object || this.settings?.spotifyCommandTriggers || {};
        const triggerMap = {};

        // Default commands
        const defaultCommands = ['!song', '!np', '!skip', '!previous', '!pause', '!play', '!volume', '!queue', '!sr', '!revoke'];

        defaultCommands.forEach(cmd => {
            // Start with the default command as a trigger
            triggerMap[cmd] = [cmd];

            // If there's a custom trigger, parse it (supports comma-separated aliases)
            if (customTriggers[cmd]) {
                const customList = customTriggers[cmd]
                    .split(',')
                    .map(t => t.trim().toLowerCase())
                    .filter(t => t.length > 0);
                if (customList.length > 0) {
                    triggerMap[cmd] = customList;
                }
            }
        });

        return triggerMap;
    }

    // Check if incoming command matches any trigger for a given command name
    // cmd: the incoming command (e.g., "!cancion")
    // commandName: the canonical command (e.g., "!song")
    matchesTrigger(cmd, commandName) {
        const triggers = this.getCustomTriggers();
        const commandTriggers = triggers[commandName] || [commandName];
        return commandTriggers.includes(cmd.toLowerCase());
    }

    // Resolve an incoming command to its canonical command name
    // Returns: { canonical: '!song', matched: '!cancion' } or null if no match
    resolveCommand(cmd) {
        const triggers = this.getCustomTriggers();
        const lowerCmd = cmd.toLowerCase();

        for (const [canonical, triggerList] of Object.entries(triggers)) {
            if (triggerList.includes(lowerCmd)) {
                return { canonical, matched: lowerCmd };
            }
        }
        return null;
    }

    async handleCommand(command, data = {}) {
        const lowerCommand = command.toLowerCase().trim();
        const parts = lowerCommand.split(' ');
        const inputCmd = parts[0];
        const args = parts.slice(1).join(' ');

        // Resolve the command to its canonical form (handles custom triggers)
        const resolved = this.resolveCommand(inputCmd);
        const cmd = resolved ? resolved.canonical : inputCmd;

        // Check if command is disabled (use canonical command name)
        if (this.isCommandDisabled(cmd)) {
            return null; // Silent fail for disabled command
        }

        const permissions = this.getCommandPermissions();

        // !song, !np - Show current track (anyone by default)
        // Also handles !nowplaying as legacy alias
        if (cmd === "!song" || cmd === "!np" || inputCmd === "!nowplaying") {
            if (!this.hasPermission(data, permissions[cmd] || permissions['!song'])) {
                return null; // Silent fail for no permission
            }

            if (this.currentTrack) {
                return `🎵 Currently playing: ${this.currentTrack.name} by ${this.currentTrack.artist}`;
            } else {
                return "No song currently playing on Spotify";
            }
        }

        // !skip - Skip to next track (mods only by default)
        // Also handles !next as legacy alias
        if (cmd === "!skip" || inputCmd === "!next") {
            if (!this.hasPermission(data, permissions['!skip'])) {
                return null;
            }

            const result = await this.skip();
            return result.message;
        }

        // !previous - Go to previous track (mods only by default)
        // Also handles !prev as legacy alias
        if (cmd === "!previous" || inputCmd === "!prev") {
            if (!this.hasPermission(data, permissions['!previous'])) {
                return null;
            }

            const result = await this.previous();
            return result.message;
        }

        // !pause - Pause playback (mods only by default)
        // Also handles !stop as legacy alias
        if (cmd === "!pause" || inputCmd === "!stop") {
            if (!this.hasPermission(data, permissions['!pause'])) {
                return null;
            }

            const result = await this.pause();
            return result.message;
        }

        // !play - Resume playback (mods only by default)
        // Also handles !resume as legacy alias
        if (cmd === "!play" || inputCmd === "!resume") {
            if (!this.hasPermission(data, permissions['!play'])) {
                return null;
            }

            const result = await this.resume();
            return result.message;
        }

        // !volume - Set volume (mods only by default)
        // Also handles !vol as legacy alias
        if (cmd === "!volume" || inputCmd === "!vol") {
            if (!this.hasPermission(data, permissions['!volume'])) {
                return null;
            }

            if (!args) {
                return "Usage: !volume <0-100>";
            }

            const result = await this.setVolume(args);
            return result.message;
        }

        // !queue, !sr - Add song to queue (anyone by default)
        // Also handles !request as legacy alias
        if (cmd === "!queue" || cmd === "!sr" || inputCmd === "!request") {
            if (!this.hasPermission(data, permissions[cmd] || permissions['!queue'])) {
                return null;
            }

            if (!args) {
                return "Usage: !queue <song name or artist>";
            }

            this.managedQueueEnabled = !!(this.settings?.spotifyManagedQueue?.setting ?? this.settings?.spotifyManagedQueue);
            let result;
            if (this.managedQueueEnabled) {
                // Use managed queue for requester tracking and !revoke support
                result = await this.addToManagedQueue(args, {
                    requesterName: data.userid || data.chatname,
                    requesterKey: `${data.type}:${data.userid || data.chatname}`
                });
            } else {
                result = await this.addToQueue(args);
            }
            return result.message;
        }

        // !revoke - Remove user's last song from queue
        if (cmd === "!revoke") {
            this.managedQueueEnabled = !!(this.settings?.spotifyManagedQueue?.setting ?? this.settings?.spotifyManagedQueue);
            if (!this.managedQueueEnabled) {
                return "Queue revoke is disabled. Enable managed queue in Spotify settings to use !revoke.";
            }
            if (!this.hasPermission(data, permissions['!revoke'])) {
                return null;
            }

            const requesterKey = `${data.type}:${data.userid || data.chatname}`;
            const result = await this.revokeFromQueue(requesterKey);
            return result.message;
        }

        return null;
    }

	// OAuth flow methods for initial setup
	async startOAuthFlow() {
		if (!this.settings.spotifyClientId?.textsetting) {
			throw new Error("Spotify Client ID not configured");
		}

        this.setAuthWarning(null);

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
            const eligibilityWarning = await this.checkDevelopmentModeEligibility();
            this.setAuthWarning(eligibilityWarning);
            // Return success with indicator that we're already connected
            return {
                success: true,
                alreadyConnected: true,
                warning: eligibilityWarning || undefined,
                message: eligibilityWarning || undefined
            };
        }

		const generateSecureAuthState = () => {
			try {
				if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
					const bytes = new Uint8Array(16);
					crypto.getRandomValues(bytes);
					return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
				}
			} catch (stateError) {
				console.warn('Failed to generate secure Spotify OAuth state:', stateError);
			}
			return `${Date.now().toString(36)}${Math.random().toString(36).substring(2, 12)}`;
		};

		const scopes = ['user-read-currently-playing', 'user-read-playback-state', 'user-modify-playback-state'];
		const state = generateSecureAuthState();

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
	                    this.launchElectronOAuthFlow({
	                        authUrl,
	                        redirectUri: preferredRedirectUri,
	                        state,
	                        scopes
	                    });
	                } catch (electronError) {
	                    console.error('Electron OAuth error:', electronError);
	                    const normalized = this.normalizeOAuthError(electronError, {
	                        runtime: 'electron',
	                        redirectUriAttempted: preferredRedirectUri
	                    });
	                    const manualAuthUrl = this.buildAuthUrl({ redirectUri: this.browserRedirectUri, scopes, state });
	                    return {
	                        success: false,
	                        waitingForManualCallback: true,
	                        message: normalized.message,
	                        errorCode: normalized.errorCode,
	                        error: normalized.error,
	                        redirectUriAttempted: normalized.redirectUriAttempted,
	                        expectedRedirectUris: normalized.expectedRedirectUris,
	                        manualAuthUrl
	                    };
	                }

	                return {
	                    success: false,
	                    waitingForCallback: true,
	                    message: 'Please finish the Spotify login in the newly opened browser window.',
	                    redirectUriAttempted: preferredRedirectUri,
	                    expectedRedirectUris: this.getExpectedElectronRedirectUris(preferredRedirectUri)
	                };
				} else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
					chrome.tabs.create({ url: authUrl });
					fallbackStatus = {
						success: false,
			            waitingForManualCallback: true,
			            message: 'After authorizing Spotify in the newly opened tab, copy the full callback URL and paste it back into Social Stream Ninja to finish connecting.',
			            redirectUriAttempted: this.browserRedirectUri
			        };
				} else {
					window.open(authUrl, 'spotify-auth', 'width=500,height=700');
					fallbackStatus = {
						success: false,
						waitingForCallback: true,
						redirectUriAttempted: preferredRedirectUri
					};
			    }

		    return fallbackStatus;
		}
    }

    // Handle OAuth callback
	    async handleAuthCallback(code, state, redirectUriOverride = null) {
            this.setAuthWarning(null);

	        // Check state from memory or storage
	        let validState = false;
            let usedStoredState = false;
        
        if (state === this.pendingAuthState) {
            validState = true;
        } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            // Check stored state for web-based flow
            const stored = await chrome.storage.local.get(['spotifyAuthState']);
            if (stored.spotifyAuthState === state) {
                validState = true;
                usedStoredState = true;
            }
        }
        
	        if (!validState) {
	            console.error('State mismatch in OAuth callback');
	            throw this.createOAuthError('STATE_MISMATCH', 'State mismatch in OAuth callback', {
	                expectedState: this.pendingAuthState || null,
	                receivedState: state || null,
	                redirectUriAttempted: this.normalizeLoopbackRedirectUri(redirectUriOverride || this.getDefaultRedirectUri())
	            });
	        }

	        const redirectUri = this.normalizeLoopbackRedirectUri(redirectUriOverride || this.getDefaultRedirectUri());
	        await this.exchangeCodeForToken(code, redirectUri);
            this.pendingAuthState = null;

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                try {
                    await chrome.storage.local.remove(['spotifyAuthState']);
                } catch (storageError) {
                    if (usedStoredState) {
                        console.warn('Failed to clear Spotify auth state after callback:', storageError);
                    }
                }
            }

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
	                const details = {
	                    spotifyError: data.error,
	                    spotifyErrorDescription: data.error_description,
	                    redirectUriAttempted: redirectUri
	                };
	                if (data.error === 'invalid_grant') {
	                    throw this.createOAuthError(
	                        'REDIRECT_MISMATCH',
	                        `Spotify token exchange failed: ${data.error} - ${data.error_description || 'invalid_grant'}`,
	                        details
	                    );
	                }
	                throw this.createOAuthError(
	                    'TOKEN_EXCHANGE_FAILED',
	                    `Spotify token exchange failed: ${data.error} - ${data.error_description || 'unknown token exchange error'}`,
	                    details
	                );
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

                    const eligibilityWarning = await this.checkDevelopmentModeEligibility();
                    this.setAuthWarning(eligibilityWarning);
                    if (eligibilityWarning) {
                        console.warn('Spotify post-auth eligibility warning:', eligibilityWarning);
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
