// Check if we're in Electron app or Chrome extension
const isSSAPP = typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined' || !chrome.runtime.id;

// Global variable for IPC in Electron
let ipcRenderer = null;

// Shim for Electron app
if (isSSAPP) {
    console.log('Running in Electron app mode');
    
    if (typeof chrome === 'undefined') {
        window.chrome = {};
    }
    
    // Check if we have ipcRenderer available
    ipcRenderer = window.ipcRenderer || null;
    
    if (!ipcRenderer && typeof require !== 'undefined') {
        try {
            const { ipcRenderer: ipc } = require('electron');
            ipcRenderer = ipc;
            console.log('Electron IPC loaded successfully via require');
        } catch(e) {
            console.warn('Could not load electron ipcRenderer:', e);
            // Try alternative approach
            try {
                ipcRenderer = require('electron').ipcRenderer;
                console.log('Electron IPC loaded via alternative method');
            } catch(e2) {
                console.warn('Alternative method also failed:', e2);
            }
        }
    }
    
    if (ipcRenderer) {
        console.log('IPC Renderer is available');
    } else {
        console.warn('IPC Renderer not available - Electron replay will be limited');
        // Show a message to the user about limitations
        const electronWarning = document.createElement('div');
        electronWarning.style.cssText = 'background: #fffacd; border: 1px solid #daa520; padding: 10px; margin-bottom: 20px; border-radius: 4px;';
        electronWarning.innerHTML = '<strong>Note:</strong> Message replay in the Electron app has limited functionality. For full replay features, please use the Chrome extension version.';
        document.querySelector('.container').insertBefore(electronWarning, document.querySelector('.info').nextSibling);
    }
    
    // Shim chrome.runtime.sendMessage
    chrome.runtime = chrome.runtime || {};
    chrome.runtime.sendMessage = async function(data, callback) {
        console.log('Electron sendMessage called with:', data);
        
        if (ipcRenderer) {
            try {
                // For replay actions, we need to ensure they get forwarded properly
                if (data.action && data.action.includes('Replay')) {
                    // Add a cmd property to ensure it gets forwarded
                    data.cmd = data.action;
                }
                
                console.log('Sending to main process:', data);
                const response = await ipcRenderer.sendSync('fromPopup', data);
                console.log('Received response:', response);
                
                // The Electron main process might just return cached state
                // For replay, we'll handle it locally for Electron
                if (data.action === 'startReplay' && response && response.state !== undefined) {
                    // Without IPC, we can't send messages properly
                    console.warn('Replay not fully supported in Electron without IPC');
                    if (typeof callback === 'function') {
                        callback({ 
                            error: 'Replay functionality is limited in the Electron app. Please use the Chrome extension for full replay features.',
                            messageCount: 0 
                        });
                    }
                } else if (typeof callback === 'function') {
                    callback(response);
                }
            } catch(e) {
                console.error('IPC error:', e);
                if (typeof callback === 'function') {
                    callback({ error: 'IPC communication failed: ' + e.message });
                }
            }
        } else {
            console.warn('No IPC renderer available');
            if (typeof callback === 'function') {
                callback({ error: 'Not connected to background process' });
            }
        }
    };
    
    // Shim chrome.runtime.onMessage
    chrome.runtime.onMessage = chrome.runtime.onMessage || {};
    chrome.runtime.onMessage.addListener = function(callback) {
        if (ipcRenderer) {
            ipcRenderer.on('fromBackground', (event, ...args) => {
                const sender = { tab: { id: null } };
                callback(args[0], sender, function(response) {
                    // Response handler if needed
                });
            });
        }
    };
}

// Set default start time to 24 hours ago
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
document.getElementById('startTime').value = yesterday.toISOString().slice(0, 16);

// Show timezone info
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const offset = new Date().getTimezoneOffset();
const offsetHours = Math.floor(Math.abs(offset) / 60);
const offsetMinutes = Math.abs(offset) % 60;
const offsetSign = offset <= 0 ? '+' : '-';
const offsetString = `UTC${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;

// Add timezone info to the page
const startTimeLabel = document.querySelector('label[for="startTime"]');
if (startTimeLabel) {
    startTimeLabel.innerHTML += ` <small style="color: #666;">(${timeZone} ${offsetString})</small>`;
}

// Playback state
let isPlaying = false;
let isPaused = false;
let playbackSpeed = 1;
let replaySessionId = null;

// UI elements
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const messageCountDiv = document.getElementById('messageCount');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const currentTimeDiv = document.getElementById('currentTime');
const debugInfo = document.getElementById('debugInfo');

// Speed control
speedSlider.addEventListener('input', (e) => {
    playbackSpeed = parseFloat(e.target.value);
    speedValue.textContent = playbackSpeed + 'x';
    
    // Update playback speed if currently playing
    if (isPlaying && !isPaused) {
        chrome.runtime.sendMessage({
            action: 'updateReplaySpeed',
            sessionId: replaySessionId,
            speed: playbackSpeed
        });
    }
});

// Play button
playBtn.addEventListener('click', async () => {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    if (!startTime) {
        alert('Please select a start time');
        return;
    }

    const startTimestamp = new Date(startTime).getTime();
    const endTimestamp = endTime ? new Date(endTime).getTime() : null;

    if (endTimestamp && endTimestamp <= startTimestamp) {
        alert('End time must be after start time');
        return;
    }

    // Generate session ID for this replay
    replaySessionId = Date.now().toString();

    // Update UI
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    statusText.textContent = 'Starting replay...';
    progressBar.style.display = 'block';
    isPlaying = true;
    isPaused = false;

    // Clear debug info when starting
    debugInfo.style.display = 'none';
    
    // Store start and end times for timer display
    window.replayStartTime = startTimestamp;
    window.replayEndTime = endTimestamp || Date.now();
    window.replayStartedAt = Date.now();
    
    // Start the timer immediately for user feedback
    statusText.textContent = 'Starting replay...';
    startPlaybackTimer();
    
    chrome.runtime.sendMessage({
        action: 'startReplay',
        sessionId: replaySessionId,
        startTimestamp: startTimestamp,
        endTimestamp: endTimestamp,
        speed: playbackSpeed
    }, (response) => {
        if (!isSSAPP && chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            // Check if it's just the extension being off
            statusText.textContent = 'Please ensure Social Stream is ON';
            messageCountDiv.textContent = 'Enable the extension in the popup menu';
            // Don't reset controls - let the timer keep running
        } else if (response && response.error) {
            statusText.textContent = response.error;
            messageCountDiv.textContent = '';
            resetControls();
        } else if (response && response.messageCount !== undefined) {
            if (response.messageCount === 0) {
                statusText.textContent = 'No messages found';
                currentTimeDiv.textContent = 'Selected time range is empty';
                resetControls();
            } else {
                statusText.textContent = `Replaying ${response.messageCount} messages`;
                messageCountDiv.textContent = `${response.messageCount} messages queued`;
                // Timer is already running
            }
        } else {
            // Response received but no specific data
            statusText.textContent = 'Replay started';
            // Timer is already running
        }
    });
});

// Pause button
pauseBtn.addEventListener('click', () => {
    if (!isPlaying) return;

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    
    if (isPaused) {
        // Store where we paused
        window.pausedAtElapsed = (Date.now() - window.replayStartedAt) * playbackSpeed;
        clearInterval(playbackTimer);
        statusText.textContent = 'Paused';
    } else {
        // Resume from where we paused
        window.replayStartedAt = Date.now() - (window.pausedAtElapsed / playbackSpeed);
        startPlaybackTimer();
        statusText.textContent = `Replaying`;
    }
    
    // Handle pause/resume for Electron differently
    if (isSSAPP && window.electronReplaySessions && window.electronReplaySessions[replaySessionId]) {
        window.electronReplaySessions[replaySessionId].isPaused = isPaused;
    } else {
        chrome.runtime.sendMessage({
            action: isPaused ? 'pauseReplay' : 'resumeReplay',
            sessionId: replaySessionId
        });
    }
});

// Stop button
stopBtn.addEventListener('click', () => {
    if (!isPlaying) return;

    // Handle stop for Electron differently
    if (isSSAPP && window.electronReplaySessions && window.electronReplaySessions[replaySessionId]) {
        // Clear all timeouts
        const session = window.electronReplaySessions[replaySessionId];
        session.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
        delete window.electronReplaySessions[replaySessionId];
    } else {
        chrome.runtime.sendMessage({
            action: 'stopReplay',
            sessionId: replaySessionId
        });
    }

    statusText.textContent = 'Replay stopped';
    resetControls();
});

// Timer functionality
let playbackTimer = null;

function startPlaybackTimer() {
    // Clear any existing timer
    if (playbackTimer) {
        clearInterval(playbackTimer);
    }
    
    // Update timer every 100ms for smooth display
    playbackTimer = setInterval(updatePlaybackTime, 100);
    updatePlaybackTime(); // Initial update
}

function updatePlaybackTime() {
    if (!window.replayStartTime || !isPlaying) return;
    
    const elapsed = (Date.now() - window.replayStartedAt) * playbackSpeed;
    const currentTimestamp = window.replayStartTime + elapsed;
    
    // Don't go past end time
    const effectiveEndTime = window.replayEndTime;
    if (currentTimestamp > effectiveEndTime) {
        currentTimeDiv.textContent = `Playback complete`;
        clearInterval(playbackTimer);
        return;
    }
    
    // Format the current playback time
    const currentDate = new Date(currentTimestamp);
    const timeStr = currentDate.toLocaleTimeString();
    const dateStr = currentDate.toLocaleDateString();
    
    // Calculate progress percentage based on time
    const totalDuration = effectiveEndTime - window.replayStartTime;
    const progress = Math.min(100, (elapsed / totalDuration) * 100);
    
    currentTimeDiv.textContent = `Playback time: ${dateStr} ${timeStr}`;
    
    // Update progress bar based on time if we don't have message-based progress
    if (!window.messageBasedProgress) {
        progressFill.style.width = progress + '%';
    }
}

// Reset UI controls
function resetControls() {
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    pauseBtn.textContent = 'Pause';
    progressBar.style.display = 'none';
    progressFill.style.width = '0%';
    isPlaying = false;
    isPaused = false;
    replaySessionId = null;
    currentTimeDiv.textContent = '';
    
    // Clear timer
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
    
    // Clear stored times
    window.replayStartTime = null;
    window.replayEndTime = null;
    window.replayStartedAt = null;
    window.messageBasedProgress = false;
}

// Electron-specific replay handler
async function handleElectronReplay(data, callback) {
    console.log('Starting Electron replay handler...');
    
    try {
        // Open the database directly
        const DB_NAME = 'chatMessagesDB_v3';
        const STORE_NAME = 'messages';
        
        const detectRequest = indexedDB.open(DB_NAME);
        
        detectRequest.onsuccess = async (event) => {
            const detectedDb = event.target.result;
            const currentVersion = detectedDb.version;
            detectedDb.close();
            
            const request = indexedDB.open(DB_NAME, currentVersion);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const index = store.index('timestamp');
                
                let range;
                if (data.endTimestamp) {
                    range = IDBKeyRange.bound(data.startTimestamp, data.endTimestamp);
                } else {
                    range = IDBKeyRange.lowerBound(data.startTimestamp);
                }
                
                const messages = [];
                const cursorRequest = index.openCursor(range);
                
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        messages.push(cursor.value);
                        cursor.continue();
                    } else {
                        // All messages collected
                        console.log(`Found ${messages.length} messages to replay`);
                        
                        if (messages.length === 0) {
                            callback({ messageCount: 0 });
                            return;
                        }
                        
                        // Sort messages by timestamp
                        messages.sort((a, b) => a.timestamp - b.timestamp);
                        
                        // Store replay session for pause/stop control
                        const sessionId = data.sessionId;
                        window.electronReplaySessions = window.electronReplaySessions || {};
                        window.electronReplaySessions[sessionId] = {
                            messages: messages,
                            timeouts: [],
                            isPaused: false,
                            currentIndex: 0
                        };
                        
                        // Schedule message sending
                        const originalStartTime = data.startTimestamp;
                        const speed = data.speed || 1;
                        
                        messages.forEach((message, index) => {
                            const messageOffsetFromStart = message.timestamp - originalStartTime;
                            const scaledDelay = messageOffsetFromStart / speed;
                            
                            if (scaledDelay < 0) return; // Skip messages before start time
                            
                            const timeoutId = setTimeout(() => {
                                const session = window.electronReplaySessions[sessionId];
                                if (session && !session.isPaused) {
                                    // Send to dock 
                                    delete message.mid; // Remove database-specific fields
                                    
                                    // For Electron without IPC, we'll use a different approach
                                    // Post the message to the opener window (popup.html)
                                    if (window.opener) {
                                        window.opener.postMessage({
                                            action: 'replayMessage',
                                            message: message
                                        }, '*');
                                    } else {
                                        console.warn('No opener window to send messages to');
                                    }
                                    
                                    session.currentIndex = index + 1;
                                    
                                    // Simulate progress update
                                    const progress = ((index + 1) / messages.length) * 100;
                                    window.postMessage({
                                        action: 'replayProgress',
                                        sessionId: sessionId,
                                        progress: progress,
                                        currentMessage: index + 1,
                                        totalMessages: messages.length,
                                        currentTimestamp: message.timestamp
                                    }, '*');
                                    
                                    if (index === messages.length - 1) {
                                        delete window.electronReplaySessions[sessionId];
                                    }
                                }
                            }, scaledDelay);
                            
                            window.electronReplaySessions[sessionId].timeouts.push(timeoutId);
                        });
                        
                        callback({ messageCount: messages.length });
                    }
                };
                
                cursorRequest.onerror = (event) => {
                    console.error('Database cursor error:', event);
                    callback({ error: 'Failed to read messages from database' });
                };
            };
            
            request.onerror = (event) => {
                console.error('Failed to open database:', event);
                callback({ error: 'Failed to open database' });
            };
        };
        
        detectRequest.onerror = (event) => {
            console.error('Failed to detect database version:', event);
            callback({ error: 'Failed to detect database version' });
        };
        
    } catch (error) {
        console.error('Electron replay error:', error);
        callback({ error: error.message });
    }
}

// Listen for progress updates
if (isSSAPP) {
    // For Electron, listen to postMessage events
    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.action === 'replayProgress' && message.sessionId === replaySessionId) {
            // Use message-based progress when available
            window.messageBasedProgress = true;
            progressFill.style.width = message.progress + '%';
            messageCountDiv.textContent = `Sent: ${message.currentMessage} / ${message.totalMessages}`;
            
            // Update the stored current timestamp for more accurate timer
            if (message.currentTimestamp) {
                window.replayStartTime = message.currentTimestamp;
                window.replayStartedAt = Date.now();
            }
            
            if (message.progress >= 100) {
                statusText.textContent = 'Replay completed!';
                currentTimeDiv.textContent = 'All messages sent';
                resetControls();
            }
        }
    });
}

// Listen for progress updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'replayProgress' && message.sessionId === replaySessionId) {
        // Use message-based progress when available
        window.messageBasedProgress = true;
        progressFill.style.width = message.progress + '%';
        messageCountDiv.textContent = `Sent: ${message.currentMessage} / ${message.totalMessages}`;
        
        // Update the stored current timestamp for more accurate timer
        if (message.currentTimestamp) {
            window.replayStartTime = message.currentTimestamp;
            window.replayStartedAt = Date.now();
        }
        
        if (message.progress >= 100) {
            statusText.textContent = 'Replay completed!';
            currentTimeDiv.textContent = 'All messages sent';
            resetControls();
        }
    } else if (message.action === 'replayError' && message.sessionId === replaySessionId) {
        statusText.textContent = 'Error occurred';
        currentTimeDiv.textContent = '';
        resetControls();
    }
});