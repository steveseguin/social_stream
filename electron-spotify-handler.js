// Electron Main Process Spotify OAuth Handler
// Add this to your Electron app's main.js file

const { BrowserWindow, ipcMain } = require('electron');
const http = require('http');
const url = require('url');

const registeredChannels = new Set();

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
// Add to your Spotify app: http://localhost:8888/callback
function setupSpotifyOAuthWithLocalServer(mainWindow) {
    const handler = async (event, { authUrl, redirectUri, state }) => {
        return new Promise((resolve, reject) => {
            // Create a temporary local server to catch the callback
            const server = http.createServer((req, res) => {
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
                    
                    server.close();
                    resolve({
                        success: true,
                        code: query.code,
                        state: query.state,
                        redirectUri: 'http://localhost:8888/callback'
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
                    
                    server.close();
                    reject(new Error(query.error));
                }
            });
            
            server.on('error', (err) => {
                console.error('[Spotify OAuth] Local server error:', err);
                server.close();
                reject(err);
            });

            // Start server on port 8888
            server.listen(8888, () => {
                console.log('OAuth callback server listening on http://localhost:8888');
                
                // Open auth URL in a new window
                const authWindow = new BrowserWindow({
                    width: 800,
                    height: 600,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                });
                
                authWindow.loadURL(authUrl);
                
                // Clean up if window is closed
                authWindow.on('closed', () => {
                    server.close();
                    reject(new Error('Auth window closed by user'));
                });
            });
            
            // Timeout after 5 minutes
            setTimeout(() => {
                server.close();
                reject(new Error('OAuth timeout'));
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
                if (url.startsWith(redirectUri) || url.startsWith('http://localhost:8888/callback')) {
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
