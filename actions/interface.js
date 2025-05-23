async function startFlowSystem() {
    // Create necessary mock functions if they don't exist in this context
    if (!window.sendMessageToTabs) {
        window.sendMessageToTabs = function(message, toAll, tabId, respond, fromMain, timeout) {
            console.warn('Mock: Send message to tabs:', message, toAll, tabId, respond, fromMain, timeout);
            return true;
        };
    }
    
    if (!window.sendToDestinations) {
        window.sendToDestinations = function(data) {
            console.warn('Mock: Send to destinations:', data);
            return true;
        };
    }
    
    if (!window.checkExactDuplicateAlreadyReceived) {
        window.checkExactDuplicateAlreadyReceived = function(message, textonly, tid, type) {
            return false;
        };
    }
    
    // Initialize the event flow system
    const eventFlowSystem = new EventFlowSystem({
        // Pass references to required functions
        sendMessageToTabs: window.sendMessageToTabs || null,
        sendToDestinations: window.sendToDestinations || null,
        pointsSystem: window.pointsSystem || null
    });

    // Wait for the database and initial flows to load
    await eventFlowSystem.initPromise;
    // --------------------

    // Initialize editor AFTER the system is ready
    const editor = new EventFlowEditor('editor-container', eventFlowSystem);

    // Add the event flow system to the global scope for testing
    window.eventFlowSystem = eventFlowSystem;
    window.flowEditor = editor;

    // Initialize the test panel through the editor
    editor.initTestPanel();
}
// DOM already triggered, so manually start.
startFlowSystem();