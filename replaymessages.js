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

    // Send message to background script
    debugInfo.textContent = `Sending replay request - Start: ${new Date(startTimestamp).toLocaleString()}, End: ${endTimestamp ? new Date(endTimestamp).toLocaleString() : 'None'}`;
    
    chrome.runtime.sendMessage({
        action: 'startReplay',
        sessionId: replaySessionId,
        startTimestamp: startTimestamp,
        endTimestamp: endTimestamp,
        speed: playbackSpeed
    }, (response) => {
        console.log('Replay response:', response);
        debugInfo.textContent += ` | Response received`;
        
        if (chrome.runtime.lastError) {
            statusText.textContent = 'Error: ' + chrome.runtime.lastError.message;
            debugInfo.textContent = 'Chrome runtime error: ' + chrome.runtime.lastError.message;
            resetControls();
        } else if (response && response.error) {
            statusText.textContent = 'Error: ' + response.error;
            debugInfo.textContent = 'Response error: ' + response.error;
            resetControls();
        } else if (response && response.messageCount !== undefined) {
            if (response.messageCount === 0) {
                statusText.textContent = 'No messages found in the selected time range';
                debugInfo.textContent = `No messages between ${new Date(startTimestamp).toLocaleString()} and ${endTimestamp ? new Date(endTimestamp).toLocaleString() : 'now'}`;
                resetControls();
            } else {
                statusText.textContent = `Replaying ${response.messageCount} messages...`;
                messageCountDiv.textContent = `Total messages: ${response.messageCount}`;
                currentTimeDiv.textContent = `Starting from: ${new Date(startTimestamp).toLocaleString()}`;
            }
        } else {
            statusText.textContent = 'Unexpected response from background script';
            debugInfo.textContent = 'Response: ' + JSON.stringify(response);
            resetControls();
        }
    });
});

// Pause button
pauseBtn.addEventListener('click', () => {
    if (!isPlaying) return;

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    
    chrome.runtime.sendMessage({
        action: isPaused ? 'pauseReplay' : 'resumeReplay',
        sessionId: replaySessionId
    });

    statusText.textContent = isPaused ? 'Replay paused' : 'Replay resumed';
});

// Stop button
stopBtn.addEventListener('click', () => {
    if (!isPlaying) return;

    chrome.runtime.sendMessage({
        action: 'stopReplay',
        sessionId: replaySessionId
    });

    statusText.textContent = 'Replay stopped';
    resetControls();
});

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
}

// Listen for progress updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'replayProgress' && message.sessionId === replaySessionId) {
        progressFill.style.width = message.progress + '%';
        messageCountDiv.textContent = `Messages sent: ${message.currentMessage} / ${message.totalMessages}`;
        
        // Update current timestamp display
        if (message.currentTimestamp) {
            const currentDate = new Date(message.currentTimestamp);
            currentTimeDiv.textContent = `Current message time: ${currentDate.toLocaleString()}`;
            
            // Show last message details in debug
            if (message.messageDetails && message.messageDetails.chatname) {
                debugInfo.textContent = `Last: ${message.messageDetails.chatname}: ${(message.messageDetails.chatmessage || '').substring(0, 50)}...`;
            }
        }
        
        if (message.progress >= 100) {
            statusText.textContent = 'Replay completed!';
            currentTimeDiv.textContent = 'Finished replaying all messages';
            resetControls();
        }
    } else if (message.action === 'replayError' && message.sessionId === replaySessionId) {
        statusText.textContent = 'Error: ' + message.error;
        debugInfo.textContent = 'Error details: ' + message.error;
        resetControls();
    }
});