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
        console.log('Event Flow System initialized for Social Stream Ninja');

        // Create reference to the original applyBotActions function
        const originalapplyBotActions = window.applyBotActions || function(message) { return message; };

        // Replace with enhanced version that applies flows
        window.applyBotActions = async function(message) { // The input is 'message'
            
            if (!window.isExtensionOn){
				return null;
			}
           
		   
			let processedMessage = await originalapplyBotActions(message); // Initialize processedMessage with the input message
			
			if (!processedMessage) {
				return null; // Or return undefined, depending on how the rest of the system handles it
			}
				
			try {
				// Apply the event flow actions
				processedMessage = await eventFlowSystem.processMessage(processedMessage); // Now use the declared processedMessage
				console.log(processedMessage);
				// If message was blocked by the flow system, it will be null, but the parent function will handle that.
				if (!processedMessage) {
					console.log("returned null 2");
					return null; // Or return undefined, depending on how the rest of the system handles it
				}
			} catch (e) {
				console.warn('Error in event flow processing:', e);
				// Decide if you want to return the original message or null in case of error
				// For now, it will continue with potentially unprocessed/partially processed message
			}

            // It's important that this function *always* returns the message object
            // (or null/undefined if intentionally blocked),
            // especially if it's part of a chain or if other parts of the application expect a return value.
            // The original `applyBotActions` (before override) might have been called for its return value.

            return processedMessage; // Return the (potentially) modified message
        };

        // Add button to access Event Flow Editor from main dashboard
        // This part is from social-stream-ninja-flow-integration-fixed.js and is good for UI integration
        function addEventFlowMenuItem() {
            if (document.getElementById('open-flow-editor-btn')) {
                return; // Button already exists
            }
            // Create button for accessing the editor
            const editorButton = document.createElement('button');
            editorButton.id = 'open-flow-editor-btn';
            editorButton.textContent = 'Event Flow Editor';
            editorButton.title = 'Open visual flow editor';
            // Applying basic styles directly. Consider moving to a CSS file or using existing classes.
            editorButton.style.position = 'fixed';
            editorButton.style.bottom = '20px';
            editorButton.style.right = '20px';
            editorButton.style.padding = '10px 15px';
            editorButton.style.background = 'var(--primary-color, #9d46ff)'; // Use CSS variable if available
            editorButton.style.color = '#fff';
            editorButton.style.border = 'none';
            editorButton.style.borderRadius = 'var(--radius-md, 5px)'; // Use CSS variable
            editorButton.style.cursor = 'pointer';
            editorButton.style.boxShadow = 'var(--shadow-md, 0 2px 5px rgba(0,0,0,0.2))'; // Use CSS variable
            editorButton.style.zIndex = '1000'; // Ensure it's above other elements

            // Add button to page if we're on the main dashboard and not in the editor itself
            if (window.location.pathname && !window.location.pathname.includes('event-flow-editor.html')) {
                 // Check if body exists, useful for early script execution scenarios
                if (document.body) {
                    document.body.appendChild(editorButton);
                } else {
                    // Wait for the body to be available
                    document.addEventListener('DOMContentLoaded', () => {
                        if (document.body) { // Double check after DOMContentLoaded
                           document.body.appendChild(editorButton);
                        }
                    });
                }


                // Open editor on click
                editorButton.addEventListener('click', function() {
                    window.open('actions/event-flow-editor.html', '_blank');
                });
            }
        }

        // Add the menu item when DOM is ready or immediately if already ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addEventFlowMenuItem);
        } else {
            addEventFlowMenuItem();
        }

        // Add the event flow system to the global scope for the admin UI or other debugging tools
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