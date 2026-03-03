// Electron Main Process Spotify OAuth Handler

const { BrowserWindow, ipcMain, shell } = require('electron');
const http = require('http');
const url = require('url');

const LOOPBACK_HOST = '127.0.0.1';
const LOOPBACK_PORTS = [8888, 8080, 8181];
const LOOPBACK_CALLBACK_PATH = '/callback';
const DEFAULT_LOOPBACK_REDIRECT = `http://${LOOPBACK_HOST}:${LOOPBACK_PORTS[0]}${LOOPBACK_CALLBACK_PATH}`;
const OAUTH_TIMEOUT_MS = 300000;

const registeredChannels = new Set();
let activeSession = null;

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createOAuthError(code, message, details = {}) {
    const error = new Error(message || 'Spotify OAuth failed');
    if (code) {
        error.code = code;
    }
    if (details && typeof details === 'object') {
        Object.assign(error, details);
    }
    return error;
}

function isLoopbackHostname(hostname = '') {
    const value = String(hostname || '').trim().toLowerCase();
    return value === '127.0.0.1' || value === 'localhost' || value === '::1' || value === '[::1]';
}

function parseUrlSafe(value) {
    try {
        return new URL(value);
    } catch (_) {
        return null;
    }
}

function uniqueStrings(values = []) {
    const out = [];
    const seen = new Set();
    for (const value of values) {
        if (!value || typeof value !== 'string') continue;
        if (seen.has(value)) continue;
        seen.add(value);
        out.push(value);
    }
    return out;
}

function resolveRedirectTargets(redirectUri) {
    const parsed = parseUrlSafe(redirectUri);
    const hasLoopbackRedirect = !!parsed && isLoopbackHostname(parsed.hostname);
    const callbackPath = hasLoopbackRedirect && parsed.pathname && parsed.pathname !== '/'
        ? parsed.pathname
        : LOOPBACK_CALLBACK_PATH;
    const explicitPort = hasLoopbackRedirect ? Number.parseInt(parsed.port, 10) : NaN;

    const orderedPorts = [...LOOPBACK_PORTS];
    if (Number.isFinite(explicitPort) && explicitPort > 0) {
        const idx = orderedPorts.indexOf(explicitPort);
        if (idx !== -1) orderedPorts.splice(idx, 1);
        orderedPorts.unshift(explicitPort);
    }

    const loopbackRedirects = orderedPorts.map((port) => `http://${LOOPBACK_HOST}:${port}${callbackPath}`);
    const preferredRedirectUri = parsed
        ? (hasLoopbackRedirect
            ? loopbackRedirects[0]
            : `${parsed.origin}${parsed.pathname || '/'}`)
        : loopbackRedirects[0];

    const allowedRedirects = uniqueStrings([
        preferredRedirectUri,
        ...(redirectUri ? [redirectUri] : []),
        ...loopbackRedirects,
        DEFAULT_LOOPBACK_REDIRECT
    ]);

    return {
        preferredRedirectUri,
        allowedRedirects,
        loopbackRedirects,
        callbackPath,
        ports: orderedPorts
    };
}

function withAuthRedirect(authUrl, redirectUri, state) {
    try {
        const parsed = new URL(authUrl);
        if (redirectUri) {
            parsed.searchParams.set('redirect_uri', redirectUri);
        }
        if (state) {
            parsed.searchParams.set('state', state);
        }
        return parsed.toString();
    } catch (_) {
        return authUrl;
    }
}

function getRedirectOriginPath(targetUrl) {
    const parsed = parseUrlSafe(targetUrl);
    if (!parsed) return null;
    return `${parsed.origin}${parsed.pathname || '/'}`;
}

function hasOAuthCallbackParams(targetUrl = '') {
    if (!targetUrl || typeof targetUrl !== 'string') return false;
    if (!targetUrl.includes('?')) return false;
    // Ignore intermediate OAuth pages that may include only state; treat
    // non-matching URLs as redirect attempts only when code/error is present.
    return targetUrl.includes('code=') || targetUrl.includes('error=');
}

function shouldFallbackToIntercept(error) {
    if (!error) return false;
    if (error.code === 'PORT_IN_USE' || error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        return true;
    }
    const message = (error.message || '').toLowerCase();
    return message.includes('port_in_use') ||
        message.includes('eaddrinuse') ||
        message.includes('eacces') ||
        message.includes('address already in use');
}

function registerSpotifyHandler(channel, handler) {
    if (registeredChannels.has(channel)) {
        console.warn(`[Spotify OAuth] Handler for "${channel}" already registered. Skipping duplicate registration.`);
        return;
    }
    ipcMain.handle(channel, handler);
    registeredChannels.add(channel);
}

function registerDefaultChannels(handler) {
    registerSpotifyHandler('spotify-oauth', handler);
    registerSpotifyHandler('spotifyOAuth', handler);
}

function runInterceptOAuthFlow({ authUrl, redirectUri, state }) {
    const redirectTargets = resolveRedirectTargets(redirectUri);
    const requestedRedirectUri = redirectTargets.preferredRedirectUri;
    const allowedRedirects = redirectTargets.allowedRedirects;
    const authUrlWithRedirect = withAuthRedirect(authUrl, requestedRedirectUri, state);

    return new Promise((resolve, reject) => {
        const authWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        let settled = false;
        let timeoutId = null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (!authWindow.isDestroyed()) {
                authWindow.removeAllListeners('closed');
                const { webContents } = authWindow;
                webContents.removeListener('will-redirect', handleRedirect);
                webContents.removeListener('will-navigate', handleRedirect);
                authWindow.close();
            }
        };

        const complete = (payload) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(payload);
        };

        const fail = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        };

        const handleCallback = (targetUrl) => {
            const matchedRedirect = allowedRedirects.find((allowed) => typeof allowed === 'string' && targetUrl.startsWith(allowed));
            if (!matchedRedirect) {
                if (hasOAuthCallbackParams(targetUrl)) {
                    const attemptedRedirectUri = getRedirectOriginPath(targetUrl);
                    fail(createOAuthError(
                        'REDIRECT_MISMATCH',
                        `Spotify redirected to an unexpected callback URI: ${attemptedRedirectUri || 'unknown'}`,
                        {
                            attemptedUrl: targetUrl,
                            attemptedRedirectUri,
                            redirectUriAttempted: requestedRedirectUri,
                            expectedRedirectUris: allowedRedirects
                        }
                    ));
                }
                return;
            }

            try {
                const urlParts = new URL(targetUrl);
                const code = urlParts.searchParams.get('code');
                const returnedState = urlParts.searchParams.get('state');
                const error = urlParts.searchParams.get('error');

                if (code) {
                    complete({
                        success: true,
                        code,
                        state: returnedState,
                        redirectUri: matchedRedirect,
                        redirectUriAttempted: requestedRedirectUri,
                        authMode: 'intercept'
                    });
                } else if (error) {
                    fail(createOAuthError(
                        'SPOTIFY_AUTH_ERROR',
                        `Spotify authorization failed: ${error}`,
                        {
                            spotifyError: error,
                            attemptedUrl: targetUrl,
                            attemptedRedirectUri: getRedirectOriginPath(targetUrl),
                            redirectUriAttempted: requestedRedirectUri,
                            expectedRedirectUris: allowedRedirects
                        }
                    ));
                } else {
                    fail(createOAuthError(
                        'REDIRECT_MISMATCH',
                        'Spotify callback missing authorization code.',
                        {
                            attemptedUrl: targetUrl,
                            attemptedRedirectUri: getRedirectOriginPath(targetUrl),
                            redirectUriAttempted: requestedRedirectUri,
                            expectedRedirectUris: allowedRedirects
                        }
                    ));
                }
            } catch (err) {
                fail(err);
            }
        };

        const handleRedirect = (event, navigationUrl) => {
            handleCallback(navigationUrl);
        };

        authWindow.webContents.on('will-redirect', handleRedirect);
        authWindow.webContents.on('will-navigate', handleRedirect);
        authWindow.on('closed', () => {
            fail(createOAuthError('USER_CLOSED', 'Auth window closed by user', {
                redirectUriAttempted: requestedRedirectUri,
                expectedRedirectUris: allowedRedirects
            }));
        });

        timeoutId = setTimeout(() => {
            fail(createOAuthError('TIMEOUT', 'Spotify OAuth timed out before receiving callback', {
                redirectUriAttempted: requestedRedirectUri,
                expectedRedirectUris: allowedRedirects
            }));
        }, OAUTH_TIMEOUT_MS);

        authWindow.loadURL(authUrlWithRedirect);
    });
}

function runLoopbackOAuthSession({ authUrl, redirectUri, state }) {
    return new Promise((resolve, reject) => {
        let timeoutId = null;
        let settled = false;
        let server = null;
        let session = null;

        const redirectTargets = resolveRedirectTargets(redirectUri);
        const loopbackRedirects = redirectTargets.loopbackRedirects.length
            ? redirectTargets.loopbackRedirects
            : [DEFAULT_LOOPBACK_REDIRECT];
        const attemptedPorts = [];
        const expectedState = state || null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (server) {
                try {
                    server.close();
                } catch (_) { }
                server = null;
            }

            if (activeSession === session) {
                activeSession = null;
            }
        };

        const complete = (payload) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(payload);
        };

        const fail = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        };

        session = { fail };
        activeSession = session;

        const tryListenOnPort = (index) => {
            if (settled) return;

            if (index >= loopbackRedirects.length) {
                fail(createOAuthError(
                    'PORT_IN_USE',
                    'Unable to bind any configured Spotify OAuth callback port.',
                    {
                        attemptedPorts,
                        expectedRedirectUris: loopbackRedirects,
                        redirectUriAttempted: loopbackRedirects[0]
                    }
                ));
                return;
            }

            const currentRedirect = loopbackRedirects[index];
            const parsedCurrentRedirect = new URL(currentRedirect);
            const currentPort = Number.parseInt(parsedCurrentRedirect.port, 10);
            const currentPath = parsedCurrentRedirect.pathname || LOOPBACK_CALLBACK_PATH;
            attemptedPorts.push(currentPort);

            const candidateServer = http.createServer((req, res) => {
                const parsedReq = url.parse(req.url, true);
                const reqPath = parsedReq.pathname || '/';
                const query = parsedReq.query || {};
                const attemptedRedirectUri = `http://${LOOPBACK_HOST}:${currentPort}${reqPath}`;

                if (query.code) {
                    if (reqPath !== currentPath) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<html><body><h1>Redirect URI Mismatch</h1><p>The callback URI did not match the expected redirect.</p><script>window.close();</script></body></html>');
                        fail(createOAuthError(
                            'REDIRECT_MISMATCH',
                            `Spotify redirected to ${attemptedRedirectUri}, but expected ${currentRedirect}.`,
                            {
                                attemptedRedirectUri,
                                redirectUriAttempted: currentRedirect,
                                expectedRedirectUris: loopbackRedirects
                            }
                        ));
                        return;
                    }

                    if (expectedState && query.state !== expectedState) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<html><body><h1>State Mismatch</h1><p>Possible CSRF attack. Please try again.</p><script>window.close();</script></body></html>');
                        fail(createOAuthError(
                            'STATE_MISMATCH',
                            'State mismatch - possible CSRF attack',
                            {
                                expectedState,
                                receivedState: query.state || null,
                                attemptedRedirectUri,
                                redirectUriAttempted: currentRedirect,
                                expectedRedirectUris: loopbackRedirects
                            }
                        ));
                        return;
                    }

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <body>
                                <h1>Success!</h1>
                                <p>You can close this window and return to Social Stream.</p>
                                <script>window.close();</script>
                            </body>
                        </html>
                    `);

                    complete({
                        success: true,
                        code: query.code,
                        state: query.state,
                        redirectUri: currentRedirect,
                        redirectUriAttempted: currentRedirect,
                        authMode: 'loopback'
                    });
                } else if (query.error) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <body>
                                <h1>Authorization Failed</h1>
                                <p>Error: ${escapeHtml(query.error)}</p>
                                <script>window.close();</script>
                            </body>
                        </html>
                    `);

                    fail(createOAuthError(
                        'SPOTIFY_AUTH_ERROR',
                        `Spotify authorization failed: ${query.error}`,
                        {
                            spotifyError: query.error,
                            attemptedRedirectUri,
                            redirectUriAttempted: currentRedirect,
                            expectedRedirectUris: loopbackRedirects
                        }
                    ));
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <body>
                                <h1>Waiting...</h1>
                                <p>You can close this window after Spotify redirects you here.</p>
                                <script>window.close();</script>
                            </body>
                        </html>
                    `);
                }
            });

            candidateServer.once('error', (err) => {
                const shouldTryNext = err && (err.code === 'EADDRINUSE' || err.code === 'EACCES');
                if (shouldTryNext) {
                    try {
                        candidateServer.close();
                    } catch (_) { }
                    tryListenOnPort(index + 1);
                    return;
                }

                console.error('[Spotify OAuth] Local server error:', err);
                fail(createOAuthError(
                    err && err.code ? err.code : 'LOOPBACK_SERVER_ERROR',
                    `[Spotify OAuth] Local server error: ${err && err.message ? err.message : String(err)}`,
                    {
                        attemptedPorts,
                        redirectUriAttempted: currentRedirect,
                        expectedRedirectUris: loopbackRedirects,
                        cause: err
                    }
                ));
            });

            candidateServer.listen(currentPort, LOOPBACK_HOST, () => {
                server = candidateServer;
                const authUrlWithRedirect = withAuthRedirect(authUrl, currentRedirect, expectedState);
                console.log(`[Spotify OAuth] Loopback server listening on ${currentRedirect}`);
                Promise.resolve(shell.openExternal(authUrlWithRedirect, { activate: true }))
                    .then(() => {
                        console.log('[Spotify OAuth] Opening auth URL in default browser');
                    })
                    .catch((shellError) => {
                        console.error('[Spotify OAuth] Failed to launch default browser:', shellError);
                        fail(createOAuthError(
                            'BROWSER_OPEN_FAILED',
                            `Failed to launch Spotify authorization URL: ${shellError && shellError.message ? shellError.message : shellError}`,
                            {
                                redirectUriAttempted: currentRedirect,
                                expectedRedirectUris: loopbackRedirects,
                                cause: shellError
                            }
                        ));
                    });
            });
        };

        timeoutId = setTimeout(() => {
            fail(createOAuthError(
                'TIMEOUT',
                'Spotify OAuth timed out before receiving callback',
                {
                    attemptedPorts,
                    redirectUriAttempted: loopbackRedirects[0],
                    expectedRedirectUris: loopbackRedirects
                }
            ));
        }, OAUTH_TIMEOUT_MS);

        tryListenOnPort(0);
    });
}

// Method 1: Local HTTP Server (Recommended)
// Add these to your Spotify app:
// http://127.0.0.1:8888/callback
// http://127.0.0.1:8080/callback
// http://127.0.0.1:8181/callback
function setupSpotifyOAuthWithLocalServer(options = {}) {
    const { fallbackToIntercept = true } = options;

    const handler = async (event, payload = {}) => {
        if (activeSession && typeof activeSession.fail === 'function') {
            console.warn('[Spotify OAuth] Aborting previous pending session in favor of the new request.');
            activeSession.fail(createOAuthError(
                'USER_CLOSED',
                'Previous Spotify authentication was interrupted by a new request.'
            ));
        }

        try {
            return await runLoopbackOAuthSession(payload);
        } catch (error) {
            if (fallbackToIntercept && shouldFallbackToIntercept(error)) {
                console.warn('[Spotify OAuth] Loopback ports unavailable; falling back to intercept handler.');
                return runInterceptOAuthFlow(payload);
            }
            const wrappedError = createOAuthError(
                error && error.code ? error.code : 'SPOTIFY_OAUTH_FAILED',
                `[Spotify OAuth] Loopback handler failed: ${error && error.message ? error.message : error}`,
                {
                    redirectUriAttempted: error && error.redirectUriAttempted ? error.redirectUriAttempted : payload.redirectUri || DEFAULT_LOOPBACK_REDIRECT,
                    expectedRedirectUris: error && error.expectedRedirectUris ? error.expectedRedirectUris : resolveRedirectTargets(payload.redirectUri).allowedRedirects
                }
            );
            wrappedError.cause = error;
            throw wrappedError;
        }
    };

    registerDefaultChannels(handler);
}

// Method 3: Intercept Navigation (Simple but less secure)
function setupSpotifyOAuthWithIntercept() {
    const handler = async (event, payload = {}) => runInterceptOAuthFlow(payload);
    registerDefaultChannels(handler);
}

module.exports = {
    setupSpotifyOAuthWithLocalServer,
    setupSpotifyOAuthWithIntercept
};
