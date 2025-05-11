// Initialize system when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
	// Create necessary mock functions if they don't exist in this context
	if (!window.sendMessageToTabs) {
		window.sendMessageToTabs = function(message, toAll, tabId, respond, fromMain, timeout) {
			console.log('Mock: Send message to tabs:', message, toAll, tabId, respond, fromMain, timeout);
			return true;
		};
	}
	
	if (!window.sendToDestinations) {
		window.sendToDestinations = function(data) {
			console.log('Mock: Send to destinations:', data);
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


	// Setup test panel functionality
	const testOverlay = document.getElementById('test-overlay');
	const testPanel = document.getElementById('test-panel');
	const openTestBtn = document.getElementById('open-test-panel');
	const closeTestBtn = document.getElementById('close-test-btn');
	const runTestBtn = document.getElementById('run-test-btn');
	const donationCheckbox = document.getElementById('test-donation');
	const donationAmountField = document.getElementById('donation-amount');

	// Show/hide donation amount field based on checkbox
	donationCheckbox.addEventListener('change', function() {
		donationAmountField.style.display = this.checked ? 'block' : 'none';
	});

	// Open test panel
	openTestBtn.addEventListener('click', function() {
		testOverlay.style.display = 'block';
		testPanel.style.display = 'block';
	});

	// Close test panel
	closeTestBtn.addEventListener('click', function() {
		testOverlay.style.display = 'none';
		testPanel.style.display = 'none';
	});

	// Click outside to close
	testOverlay.addEventListener('click', function() {
		testOverlay.style.display = 'none';
		testPanel.style.display = 'none';
	});

	// Run test
	runTestBtn.addEventListener('click', async function() {
		const source = document.getElementById('test-source').value;
		const username = document.getElementById('test-username').value;
		const message = document.getElementById('test-message').value;
		const isMod = document.getElementById('test-mod').checked;
		const isVIP = document.getElementById('test-vip').checked;
		const isAdmin = document.getElementById('test-admin').checked;
		const hasDonation = document.getElementById('test-donation').checked;
		const donationAmount = hasDonation ? document.getElementById('test-donation-amount').value : '';

		// Create test message
		const testMessage = {
			chatname: username,
			chatmessage: message,
			type: source,
			mod: isMod,
			vip: isVIP,
			admin: isAdmin,
			hasDonation: donationAmount,
			id: Date.now()
		};

		// Display original message
		console.log('Test message:', testMessage);

		// Process through the current flow only
		let result = null;
		
		if (editor.currentFlow && editor.currentFlow.id) {
			const flow = await eventFlowSystem.getFlowById(editor.currentFlow.id);
			if (flow) {
				result = await eventFlowSystem.evaluateFlow(flow, testMessage);
			} else {
				alert('Please select a flow to test');
				return;
			}
		} else {
			alert('Please select a flow to test');
			return;
		}

		// Display results
		const resultsEl = document.getElementById('test-results');
		
		if (result && result.blocked) {
			resultsEl.innerHTML = `
				<h4>Result: Message Blocked</h4>
				<p>The flow system blocked this message.</p>
				<h4>Original Message:</h4>
				<pre>${JSON.stringify(testMessage, null, 2)}</pre>
			`;
		} else if (result && result.modified) {
			resultsEl.innerHTML = `
				<h4>Result: Message Modified</h4>
				<h4>Original Message:</h4>
				<pre>${JSON.stringify(testMessage, null, 2)}</pre>
				<h4>Modified Message:</h4>
				<pre>${JSON.stringify(result.message, null, 2)}</pre>
			`;
		} else {
			resultsEl.innerHTML = `
				<h4>Result: No Changes</h4>
				<p>The message passed through the flow without changes.</p>
				<h4>Message:</h4>
				<pre>${JSON.stringify(testMessage, null, 2)}</pre>
			`;
		}
	});
});