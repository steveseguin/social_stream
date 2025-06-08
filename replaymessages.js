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
        if (chrome.runtime.lastError) {
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
    
    chrome.runtime.sendMessage({
        action: isPaused ? 'pauseReplay' : 'resumeReplay',
        sessionId: replaySessionId
    });
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