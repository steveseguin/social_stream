async function startFlowSystem() {
    let eventFlowSystem;
    let editor;
    
    // Check if eventFlowSystem already exists from background.js
    if (window.eventFlowSystem) {
        console.log('[interface.js] Using existing eventFlowSystem from background.js');
        eventFlowSystem = window.eventFlowSystem;
        // Initialize editor with the existing system
        editor = new EventFlowEditor('editor-container', eventFlowSystem);
    } else {
        console.log('[interface.js] No eventFlowSystem found, creating new instance');
        // Only create a new system if one doesn't exist (shouldn't happen in the app)
        eventFlowSystem = new EventFlowSystem({
            sendMessageToTabs: window.sendMessageToTabs || null,
            sendToDestinations: window.sendToDestinations || null,
            pointsSystem: window.pointsSystem || null,
            fetchWithTimeout: window.fetchWithTimeout || null,
            sanitizeRelay: window.sanitizeRelay || null,
            checkExactDuplicateAlreadyRelayed: window.checkExactDuplicateAlreadyRelayed || null
        });

        // Wait for the database and initial flows to load
        await eventFlowSystem.initPromise;

        // Initialize editor with the new system
        editor = new EventFlowEditor('editor-container', eventFlowSystem);
        
        // Add to global scope if we created it
        window.eventFlowSystem = eventFlowSystem;
    }

    window.flowEditor = editor;

    // Initialize the test panel through the editor
    editor.initTestPanel();
}
// Wait for background.js to initialize before starting
let waitLogged = false;
let waitAttempts = 0;
const maxWaitAttempts = 20; // 2 seconds max wait

function waitForEventFlowSystem() {
    if (window.eventFlowSystem) {
        console.log('[interface.js] Found eventFlowSystem, starting editor');
        // Hide loading modal if it exists
        const loadingModal = document.getElementById('loading-modal');
        if (loadingModal) {
            loadingModal.style.display = 'none';
        }
        startFlowSystem();
    } else if (waitAttempts >= maxWaitAttempts) {
        console.log('[interface.js] No eventFlowSystem found, starting standalone editor');
        // Hide loading modal if it exists
        const loadingModal = document.getElementById('loading-modal');
        if (loadingModal) {
            loadingModal.style.display = 'none';
        }
        startFlowSystem();
    } else {
        if (!waitLogged) {
            console.log('[interface.js] Waiting for eventFlowSystem from background.js...');
            waitLogged = true;
        }
        waitAttempts++;
        setTimeout(waitForEventFlowSystem, 100);
    }
}

// Start checking for eventFlowSystem
waitForEventFlowSystem();