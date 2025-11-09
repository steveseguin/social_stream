// Electron Main Process Spotify OAuth Handler
// Add this to your Electron app's main.js file

const { BrowserWindow, ipcMain, shell } = require('electron');
const http = require('http');
const url = require('url');

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

// Method 1: Local HTTP Server (Recommended)
// Add to your Spotify app: http://127.0.0.1:8888/callback
function setupSpotifyOAuthWithLocalServer(mainWindow) {
    const handler = async (event, { authUrl, redirectUri, state }) => {
        if (activeSession && typeof activeSession.fail === 'function') {
            console.warn('[Spotify OAuth] Aborting previous pending session in favor of the new request.');
            activeSession.fail(new Error('Previous Spotify authentication was interrupted by a new request.'));
        }

        return new Promise((resolve, reject) => {
            let timeoutId = null;
            let settled = false;
            let server;
            let session = null;

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

            // Create a temporary local server to catch the callback
            server = http.createServer((req, res) => {
                const query = url.parse(req.url, true).query;
                
                if (query.code) {
                    // Success - got the authorization code
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
                        redirectUri: 'http://127.0.0.1:8888/callback'
                    });
                } else if (query.error) {
                    // User denied or error
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

            // Start server on port 8888
            server.listen(8888, () => {
                console.log('OAuth callback server listening on http://127.0.0.1:8888');
                Promise.resolve(shell.openExternal(authUrl, { activate: true }))
                    .then(() => {
                        console.log('[Spotify OAuth] Opening auth URL in default browser');
                    })
                    .catch((shellError) => {
                        console.error('[Spotify OAuth] Failed to launch default browser:', shellError);
                        fail(shellError);
                    });
            });
            
            // Timeout after 5 minutes
            timeoutId = setTimeout(() => {
                fail(new Error('OAuth timeout'));
            }, 300000);
        });
    };

    registerDefaultChannels(handler);
}

// Method 3: Intercept Navigation (Simple but less secure)
function setupSpotifyOAuthWithIntercept(mainWindow) {
    const handler = async (event, { authUrl, redirectUri }) => {
        return new Promise((resolve, reject) => {
            const authWindow = new BrowserWindow({
                width: 800,
                height: 600,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });
            
            authWindow.loadURL(authUrl);
            
            // Intercept navigation to callback URL
            authWindow.webContents.on('will-redirect', (event, url) => {
                handleCallback(url);
            });
            
            authWindow.webContents.on('will-navigate', (event, url) => {
                handleCallback(url);
            });
            
            function handleCallback(url) {
                if (url.startsWith(redirectUri) || url.startsWith('http://127.0.0.1:8888/callback')) {
                    const urlParts = new URL(url);
                    const code = urlParts.searchParams.get('code');
                    const state = urlParts.searchParams.get('state');
                    const error = urlParts.searchParams.get('error');
                    
                    if (code) {
                        authWindow.close();
                    resolve({ success: true, code, state, redirectUri });
                    } else if (error) {
                        authWindow.close();
                        reject(new Error(error));
                    }
                }
            }
            
            authWindow.on('closed', () => {
                reject(new Error('Auth window closed by user'));
            });
        });
    };

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
