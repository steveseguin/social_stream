// flow-integration.js
// This file integrates the Event Flow System with Social Stream Ninja

// Initialize the event flow system for Social Stream Ninja
function initializeEventFlowSystem() {
    const eventFlowSystem = new EventFlowSystem({
        sendMessageToTabs: window.sendMessageToTabs || null,
        sendToDestinations: window.sendToDestinations || null,
        pointsSystem: window.pointsSystem || null,
        fetchWithTimeout: window.fetchWithTimeout // Assuming fetchWithTimeout is on window from background.js
    });
	
    eventFlowSystem.initPromise.then(() => {
        window.eventFlowSystem = eventFlowSystem;
    }).catch(error => {
        console.error('Failed to initialize Event Flow System for Social Stream Ninja:', error);
    });

    return eventFlowSystem; // Return the instance
}

// Create a message generator for testing flows
function createTestMessage(options = {}) {
    return {
        chatname: options.chatname || "TestUser",
        chatmessage: options.chatmessage || "This is a test message",
        textonly: options.textonly || (options.chatmessage ? options.chatmessage.replace(/<[^>]*>?/gm, '') : "This is a test message"), // Basic textonly extraction
        type: options.type || "twitch", // Example: 'twitch', 'youtube', etc.
        mod: options.mod === true,
        admin: options.admin === true, // Or 'host', 'owner' depending on platform specifics
        vip: options.vip === true,
        subscriber: options.subscriber === true, // Added common roles
        follower: options.follower === true,
        hasDonation: options.hasDonation || "", // e.g., "$5.00" or amount as number
        donationAmount: options.donationAmount || 0, // Numerical donation amount
        membership: options.membership || "", // e.g., "Tier 1"
        chatimg: options.chatimg || "", // URL to user's avatar
        userid: options.userid || `testuser_${Date.now()}`, // Unique user ID
        badges: options.badges || {}, // e.g., { subscriber: '1', moderator: '1'}
        id: options.id || `msg_${Date.now()}` // Unique message ID
        // Add any other properties your flows might expect or that are common in your message objects
    };
}

// Automatically initialize the system when this script is loaded.
// Ensure EventFlowSystem class is defined before this script runs.
// Also, ensure this script runs after the main application has set up any necessary global functions
// like window.sendMessageToTabs, window.sendToDestinations, etc.
document.addEventListener('DOMContentLoaded', () => {
	if (typeof EventFlowSystem !== 'undefined') {
		initializeEventFlowSystem();
	} else {
		console.error('EventFlowSystem class is not defined. Make sure EventFlowSystem.js is loaded before flow-integration.js.');
	}
});