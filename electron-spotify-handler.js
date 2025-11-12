// Electron Main Process Spotify OAuth Handler
// Add this to your Electron app's main.js file

const { BrowserWindow, ipcMain, shell } = require('electron');
const http = require('http');
const url = require('url');

const LOOPBACK_HOST = '127.0.0.1';
const LOOPBACK_PORT = 8888;
const DEFAULT_LOOPBACK_REDIRECT = `http://${LOOPBACK_HOST}:${LOOPBACK_PORT}/callback`;

const registeredChannels = new Set();
let activeSession = null;

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

function shouldFallbackToIntercept(error) {
    if (!error) {
        return false;
    }
    if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        return true;
    }
    const message = (error.message || '').toLowerCase();
    return message.includes('eaddrinuse') ||
        message.includes('eacces') ||
        message.includes('address already in use');
}

function runInterceptOAuthFlow({ authUrl, redirectUri }) {
    const redirects = [redirectUri, DEFAULT_LOOPBACK_REDIRECT].filter(Boolean);

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

        const cleanup = () => {
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
            if (!redirects.some((allowed) => typeof allowed === 'string' && targetUrl.startsWith(allowed))) {
                return;
            }

            try {
                const urlParts = new URL(targetUrl);
                const code = urlParts.searchParams.get('code');
                const state = urlParts.searchParams.get('state');
                const error = urlParts.searchParams.get('error');

                if (code) {
                    complete({ success: true, code, state, redirectUri: redirects[0] || DEFAULT_LOOPBACK_REDIRECT });
                } else if (error) {
                    fail(new Error(error));
                } else {
                    fail(new Error('Spotify callback missing authorization code.'));
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
        authWindow.on('closed', () => fail(new Error('Auth window closed by user')));

        authWindow.loadURL(authUrl);
    });
}

function runLoopbackOAuthSession({ authUrl, redirectUri, state }) {
    return new Promise((resolve, reject) => {
        let timeoutId = null;
        let settled = false;
        let server;
        let session = null;
        const resolvedRedirect = redirectUri || DEFAULT_LOOPBACK_REDIRECT;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (server) {
                try {
                    server.close();
                } catch (_) {}
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

        server = http.createServer((req, res) => {
            const query = url.parse(req.url, true).query;

            if (query.code) {
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
                    redirectUri: resolvedRedirect
                });
            } else if (query.error) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <body>
                            <h1>Authorization Failed</h1>
                            <p>Error: ${query.error}</p>
                            <script>window.close();</script>
                        </body>
                    </html>
                `);

                fail(new Error(query.error));
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

        server.on('error', (err) => {
            console.error('[Spotify OAuth] Local server error:', err);
            fail(err);
        });

        server.listen(LOOPBACK_PORT, LOOPBACK_HOST, () => {
            console.log(`[Spotify OAuth] Loopback server listening on ${DEFAULT_LOOPBACK_REDIRECT}`);
            Promise.resolve(shell.openExternal(authUrl, { activate: true }))
                .then(() => {
                    console.log('[Spotify OAuth] Opening auth URL in default browser');
                })
                .catch((shellError) => {
                    console.error('[Spotify OAuth] Failed to launch default browser:', shellError);
                    fail(shellError);
                });
        });

        timeoutId = setTimeout(() => {
            fail(new Error('OAuth timeout'));
        }, 300000);
    });
}

// Method 1: Local HTTP Server (Recommended)
// Add to your Spotify app: http://127.0.0.1:8888/callback
function setupSpotifyOAuthWithLocalServer(options = {}) {
    const { fallbackToIntercept = false } = options;

    const handler = async (event, payload = {}) => {
        if (activeSession && typeof activeSession.fail === 'function') {
            console.warn('[Spotify OAuth] Aborting previous pending session in favor of the new request.');
            activeSession.fail(new Error('Previous Spotify authentication was interrupted by a new request.'));
        }

        try {
            return await runLoopbackOAuthSession(payload);
        } catch (error) {
            if (fallbackToIntercept && shouldFallbackToIntercept(error)) {
                console.warn('[Spotify OAuth] Loopback port unavailable; falling back to intercept handler.');
                return runInterceptOAuthFlow(payload);
            }
            const wrappedError = new Error(`[Spotify OAuth] Loopback handler failed: ${error.message || error}`);
            wrappedError.code = error.code || wrappedError.code;
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

// Export the setup function to be called from main.js
module.exports = {
    setupSpotifyOAuthWithLocalServer,
    setupSpotifyOAuthWithIntercept
};

// Example usage in your main.js:
/*
const { setupSpotifyOAuthWithLocalServer } = require('./electron-spotify-handler');

app.whenReady().then(() => {
    createWindow();
    setupSpotifyOAuthWithLocalServer(mainWindow);
});
*/
