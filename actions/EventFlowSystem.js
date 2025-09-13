class EventFlowSystem {
    constructor(options = {}) {
        this.flows = [];
        this.db = null;
        this.dbName = options.dbName || 'eventFlowDB';
        this.storeName = options.storeName || 'flowSettings';
        this.pointsSystem = options.pointsSystem || null;
        this.sendMessageToTabs = options.sendMessageToTabs || null;
        this.sendToDestinations = options.sendToDestinations || null;
        this.fetchWithTimeout = options.fetchWithTimeout || window.fetch; // Fallback to window.fetch if not provided
        this.sanitizeRelay = options.sanitizeRelay || null;
		this.checkExactDuplicateAlreadyRelayed = options.checkExactDuplicateAlreadyRelayed || null;
		this.sendTargetP2P = options.sendTargetP2P || null;
		this.messageStore = options.messageStore || {}; // Share message store from background.js
		this.handleMessageStore = options.handleMessageStore || null; // Function to handle message storage
		
		// MIDI properties
		this.midiEnabled = false;
		this.midiInputs = [];
		this.midiOutputs = [];
		this.midiListeners = new Map(); // Store listeners for cleanup
		
		// Delay gate management
		this.delayTimers = new Map(); // Store active delay timers
		this.delayedSignals = new Map(); // Store delayed signal states
		
		// State node management for flow control
		this.nodeStates = new Map(); // Persistent state storage for state nodes
		this.stateTimers = new Map(); // Timeout management for auto-resets
		this.messageQueues = new Map(); // Queue storage for queue nodes
		this.semaphoreStates = new Map(); // Track concurrent operations for semaphore nodes
        this.throttleStates = new Map(); // Track rate limiting for throttle nodes
        
        // Reflection control (per Event Flow) for "allow-first" windows
        this.reflectionSeen = new Map();

        // Internal scheduler for time-based triggers
        this._tickHandle = null;
        this._tickRunning = false;
        this._tickMs = options.tickFrequencyMs || 1000; // default 1s
		
        //console.log('[EventFlowSystem Constructor] Initialized with:');
        //console.log('  - sendMessageToTabs:', this.sendMessageToTabs ? 'Function provided' : 'NULL - Relay will not work!');
        //console.log('  - sendToDestinations:', this.sendToDestinations ? 'Function provided' : 'NULL');
        //console.log('  - pointsSystem:', this.pointsSystem ? 'System provided' : 'NULL');
        //console.log('  - sanitizeRelay:', this.sanitizeRelay ? 'Function provided' : 'NULL - Relay will not work!');
        //console.log('  - checkExactDuplicateAlreadyRelayed:', this.checkExactDuplicateAlreadyRelayed ? 'Function provided' : 'NULL - Relay will not work!');
        //console.log('  - messageStore:', this.messageStore ? 'Object provided' : 'NULL - Duplicate detection may not work!');
        //console.log('  - handleMessageStore:', this.handleMessageStore ? 'Function provided' : 'NULL');
        
        this.initPromise = this.initDatabase();
    }

    // Start periodic evaluation for time-based triggers (timeInterval/timeOfDay)
    startScheduler() {
        if (this._tickHandle) return; // already running
        this._tickHandle = setInterval(() => this._runTimeBasedTick(), this._tickMs);
    }

    // Stop periodic evaluation
    stopScheduler() {
        if (this._tickHandle) {
            clearInterval(this._tickHandle);
            this._tickHandle = null;
        }
    }

    // Determine if a flow has any time-based triggers
    _flowHasTimeBasedTriggers(flow) {
        if (!flow || !Array.isArray(flow.nodes)) return false;
        return flow.nodes.some(n => n.type === 'trigger' && (n.triggerType === 'timeInterval' || n.triggerType === 'timeOfDay'));
    }

    // Tick handler: evaluate only flows with time-based triggers, with a null message context
    async _runTimeBasedTick() {
        if (this._tickRunning) return; // avoid overlapping ticks
        this._tickRunning = true;
        try {
            // Ensure flows are loaded
            if (!this.flows || this.flows.length === 0) {
                // no-op
            } else {
                const activeTimeFlows = this.flows.filter(f => f && f.active && this._flowHasTimeBasedTriggers(f));
                // Evaluate each candidate flow with a null message so only time-based triggers can fire
                for (const flow of activeTimeFlows) {
                    try {
                        await this.evaluateFlow(flow, null);
                    } catch (e) {
                        console.warn('[EventFlowSystem] Time-based tick evaluation error:', e);
                    }
                }
            }
        } finally {
            this._tickRunning = false;
        }
    }
	
	// MIDI Methods
	async initializeMIDI() {
		if (this.midiEnabled || typeof WebMidi === 'undefined') return;
		
		return new Promise((resolve, reject) => {
			WebMidi.enable((err) => {
				if (err) {
					console.error('[EventFlowSystem] Failed to enable WebMIDI:', err);
					reject(err);
					return;
				}
				
				this.midiEnabled = true;
				this.updateMIDIDevices();
				
				// Listen for device changes
				WebMidi.addListener("connected", () => this.updateMIDIDevices());
				WebMidi.addListener("disconnected", () => this.updateMIDIDevices());
				
				console.log('[EventFlowSystem] WebMIDI enabled successfully');
				resolve();
			});
		});
	}
	
	updateMIDIDevices() {
		this.midiInputs = WebMidi.inputs.map(input => ({
			id: input.id,
			name: input.name,
			manufacturer: input.manufacturer
		}));
		
		this.midiOutputs = WebMidi.outputs.map(output => ({
			id: output.id,
			name: output.name,
			manufacturer: output.manufacturer
		}));
	}
	
	getMIDIInputDevice(deviceId) {
		if (!this.midiEnabled) return null;
		return WebMidi.getInputById(deviceId);
	}
	
	getMIDIOutputDevice(deviceId) {
		if (!this.midiEnabled) return null;
		return WebMidi.getOutputById(deviceId);
	}
	
	// Check if MIDI needs to be initialized based on flows
	async checkMIDIRequirement() {
		const needsMIDI = this.flows.some(flow => {
			if (!flow.active) return false;
			
			return flow.nodes.some(node => {
				const isMIDITrigger = ['midiNoteOn', 'midiNoteOff', 'midiCC'].includes(node.triggerType);
				const isMIDIAction = ['midiSendNote', 'midiSendCC'].includes(node.actionType);
				return isMIDITrigger || isMIDIAction;
			});
		});
		
		if (needsMIDI && !this.midiEnabled) {
			try {
				await this.initializeMIDI();
			} catch (err) {
				console.error('[EventFlowSystem] Failed to initialize MIDI:', err);
			}
		}
	}
	
	// Set up MIDI listeners for trigger nodes
	setupMIDIListeners() {
		if (!this.midiEnabled) return;
		
		// Clear existing listeners
		this.midiListeners.forEach((listener, key) => {
			const [deviceId, eventType] = key.split('|');
			const input = this.getMIDIInputDevice(deviceId);
			if (input) {
				input.removeListener(eventType, 'all', listener);
			}
		});
		this.midiListeners.clear();
		
		// Set up new listeners for active flows
		this.flows.forEach(flow => {
			if (!flow.active) return;
			
			flow.nodes.forEach(node => {
				if (!node.config || !node.config.deviceId) return;
				
				const input = this.getMIDIInputDevice(node.config.deviceId);
				if (!input) return;
				
				let listener = null;
				const listenerKey = `${node.config.deviceId}|${node.triggerType}`;
				
				switch (node.triggerType) {
					case 'midiNoteOn':
						listener = (e) => {
							// Check if note matches config (if specified)
							if (!node.config.note || node.config.note === e.note.identifier) {
								this.processMIDITrigger(flow, node, {
									type: 'midiNoteOn',
									note: e.note.identifier,
									velocity: e.velocity,
									channel: e.channel
								});
							}
						};
						input.addListener('noteon', 'all', listener);
						break;
						
					case 'midiNoteOff':
						listener = (e) => {
							if (!node.config.note || node.config.note === e.note.identifier) {
								this.processMIDITrigger(flow, node, {
									type: 'midiNoteOff',
									note: e.note.identifier,
									velocity: e.velocity,
									channel: e.channel
								});
							}
						};
						input.addListener('noteoff', 'all', listener);
						break;
						
					case 'midiCC':
						listener = (e) => {
							if (!node.config.controller || node.config.controller === e.controller.number) {
								this.processMIDITrigger(flow, node, {
									type: 'midiCC',
									controller: e.controller.number,
									value: e.value,
									channel: e.channel
								});
							}
						};
						input.addListener('controlchange', 'all', listener);
						break;
				}
				
				if (listener) {
					this.midiListeners.set(listenerKey, listener);
				}
			});
		});
	}
	
	// Process MIDI trigger events
	async processMIDITrigger(flow, triggerNode, midiData) {
		// Create a synthetic message for MIDI events
		const midiMessage = {
			type: 'midi',
			midiData: midiData,
			timestamp: Date.now()
		};
		
		// Process the flow with this MIDI message
		await this.evaluateFlow(flow, midiMessage);
	}
	
	async evaluateSpecificLogicNode(logicType, inputValues, nodeConfig) {
        if (!Array.isArray(inputValues)) return false;

        switch (logicType) {
            case 'AND':
                if (inputValues.length === 0) return false; // Or true, depending on convention for empty AND
                return inputValues.every(v => v === true);
            case 'OR':
                if (inputValues.length === 0) return false;
                return inputValues.some(v => v === true);
            case 'NOT':
                // NOT node should ideally have exactly one input value
                return inputValues.length > 0 ? !inputValues[0] : false; // Default to false if no input
            case 'RANDOM':
                // RANDOM gate: probabilistic filter that passes or blocks the input signal
                // If no active input, output false
                const hasActiveInput = inputValues.some(v => v === true);
                if (!hasActiveInput) return false;
                
                // Get probability from config (0-100), default to 50%
                const probability = (nodeConfig && nodeConfig.probability) || 50;
                const roll = Math.random() * 100;
                
                // Pass the input through if roll succeeds, otherwise block it
                return roll < probability;
            default:
                return false;
        }
    }
    
    // Evaluate state nodes (Gate, Queue, Semaphore, etc.)
    async evaluateStateNode(node, message, inputActive) {
        const nodeId = node.id;
        const stateType = node.stateType;
        const config = node.config || {};
        
        // Initialize state if it doesn't exist
        if (!this.nodeStates.has(nodeId)) {
            this.initializeStateNode(nodeId, stateType, config);
        }
        
        // Return object includes both activation state and whether to pass message
        let result = { active: false, passMessage: false, modifiedMessage: null };
        
        switch (stateType) {
            case 'GATE':
                result = this.evaluateGateNode(nodeId, config, message, inputActive);
                break;
                
            case 'QUEUE':
                result = this.evaluateQueueNode(nodeId, config, message, inputActive);
                break;
                
            case 'SEMAPHORE':
                result = this.evaluateSemaphoreNode(nodeId, config, message, inputActive);
                break;
                
            case 'LATCH':
                result = this.evaluateLatchNode(nodeId, config, message, inputActive);
                break;
                
            case 'THROTTLE':
                result = this.evaluateThrottleNode(nodeId, config, message, inputActive);
                break;
                
            case 'SEQUENCER':
                result = this.evaluateSequencerNode(nodeId, config, message, inputActive);
                break;
                
            case 'COUNTER':
                result = this.evaluateCounterNode(nodeId, config, message, inputActive);
                break;
                
            default:
                result = { active: false, passMessage: false };
        }
        
        return result;
    }
    
    // Initialize state for a state node
    initializeStateNode(nodeId, stateType, config) {
        switch (stateType) {
            case 'GATE':
                this.nodeStates.set(nodeId, { 
                    state: config.defaultState || 'ALLOW' 
                });
                break;
                
            case 'QUEUE':
                this.messageQueues.set(nodeId, []);
                this.nodeStates.set(nodeId, { 
                    processing: false,
                    lastProcessTime: 0
                });
                break;
                
            case 'SEMAPHORE':
                this.semaphoreStates.set(nodeId, {
                    currentCount: 0,
                    activeOperations: []
                });
                break;
                
            case 'LATCH':
                this.nodeStates.set(nodeId, { 
                    triggered: false 
                });
                break;
                
            case 'THROTTLE':
                this.throttleStates.set(nodeId, {
                    messageTimestamps: [],
                    lastResetTime: Date.now()
                });
                break;
                
            case 'SEQUENCER':
                this.nodeStates.set(nodeId, {
                    sequence: [],
                    lastActivity: Date.now()
                });
                break;
                
            case 'COUNTER':
                this.nodeStates.set(nodeId, {
                    count: config.initialCount || 0,
                    targetCount: config.targetCount || 10,
                    resetOnTarget: config.resetOnTarget !== false,
                    mode: config.mode || 'INCREMENT' // INCREMENT, DECREMENT, or MATCH
                });
                break;
        }
    }
    
    // Gate node: Allow/Block/Toggle state
    evaluateGateNode(nodeId, config, message, inputActive) {
        if (!inputActive) return { active: false, passMessage: false };
        
        const state = this.nodeStates.get(nodeId);
        
        // Handle control signals (would come from special control connections)
        // For now, just use the current state
        
        if (state.state === 'ALLOW') {
            // Check for auto-reset
            if (config.autoResetMs > 0) {
                // Clear existing timer
                if (this.stateTimers.has(nodeId)) {
                    clearTimeout(this.stateTimers.get(nodeId));
                }
                // Set new timer to reset to BLOCK
                const timer = setTimeout(() => {
                    state.state = 'BLOCK';
                    this.stateTimers.delete(nodeId);
                }, config.autoResetMs);
                this.stateTimers.set(nodeId, timer);
            }
            // Pass the message through unchanged
            return { active: true, passMessage: true, modifiedMessage: message };
        }
        
        // Block the message
        return { active: false, passMessage: false };
    }
    
    // Queue node: FIFO message queue with overflow strategies
    evaluateQueueNode(nodeId, config, message, inputActive) {
        if (!inputActive) return { active: false, passMessage: false };
        
        const queue = this.messageQueues.get(nodeId) || [];
        const state = this.nodeStates.get(nodeId);
        
        // Add message to queue
        if (message) {
            // Check queue size limit
            if (queue.length >= config.maxSize) {
                // Apply overflow strategy
                switch (config.overflowStrategy) {
                    case 'DROP_OLDEST':
                        queue.shift(); // Remove oldest
                        break;
                    case 'DROP_NEWEST':
                        return false; // Don't add new message
                    case 'DROP_RANDOM':
                        const randomIndex = Math.floor(Math.random() * queue.length);
                        queue.splice(randomIndex, 1);
                        break;
                    default:
                        return false; // Block by default
                }
            }
            
            // Add message with timestamp
            queue.push({
                message: message,
                timestamp: Date.now()
            });
            this.messageQueues.set(nodeId, queue);
        }
        
        // Check if we should dequeue
        if (config.autoDequeue && !state.processing) {
            const now = Date.now();
            const timeSinceLastProcess = now - state.lastProcessTime;
            
            if (timeSinceLastProcess >= config.processingDelayMs && queue.length > 0) {
                // Check TTL and remove expired messages
                const filteredQueue = queue.filter(item => {
                    return (now - item.timestamp) < config.ttlMs;
                });
                this.messageQueues.set(nodeId, filteredQueue);
                
                if (filteredQueue.length > 0) {
                    // Dequeue next message
                    const item = filteredQueue.shift();
                    state.processing = true;
                    state.lastProcessTime = now;
                    
                    // Reset processing flag after delay
                    setTimeout(() => {
                        state.processing = false;
                    }, config.processingDelayMs);
                    
                    // Return the dequeued message (async - doesn't return original)
                    return { active: true, passMessage: false, modifiedMessage: item.message };
                }
            }
        }
        
        // Message queued but not released yet
        return { active: false, passMessage: false };
    }
    
    // Cleanup state nodes when flow is deactivated
    cleanupStateNodes(flowId) {
        // Clear all timers for this flow's nodes
        this.stateTimers.forEach((timer, nodeId) => {
            if (nodeId.startsWith(flowId)) {
                clearTimeout(timer);
                this.stateTimers.delete(nodeId);
            }
        });
        
        // Clear state storage
        this.nodeStates.forEach((state, nodeId) => {
            if (nodeId.startsWith(flowId)) {
                this.nodeStates.delete(nodeId);
            }
        });
        
        // Clear message queues
        this.messageQueues.forEach((queue, nodeId) => {
            if (nodeId.startsWith(flowId)) {
                this.messageQueues.delete(nodeId);
            }
        });
        
        // Clear semaphore states
        this.semaphoreStates.forEach((state, nodeId) => {
            if (nodeId.startsWith(flowId)) {
                this.semaphoreStates.delete(nodeId);
            }
        });
        
        // Clear throttle states
        this.throttleStates.forEach((state, nodeId) => {
            if (nodeId.startsWith(flowId)) {
                this.throttleStates.delete(nodeId);
            }
        });
    }
    
    // Simplified implementations for other state nodes (to be expanded)
    evaluateSemaphoreNode(nodeId, config, message, inputActive) {
        if (!inputActive) return { active: false, passMessage: false };
        
        const state = this.semaphoreStates.get(nodeId);
        if (state.currentCount < config.maxConcurrent) {
            state.currentCount++;
            
            // Auto-release after timeout
            if (config.timeoutMs > 0) {
                setTimeout(() => {
                    if (state.currentCount > 0) {
                        state.currentCount--;
                    }
                }, config.timeoutMs);
            }
            
            // Allow message through
            return { active: true, passMessage: true, modifiedMessage: message };
        }
        
        // Block message - semaphore full
        return { active: false, passMessage: false };
    }
    
    evaluateLatchNode(nodeId, config, message, inputActive) {
        if (!inputActive) return { active: false, passMessage: false };
        
        const state = this.nodeStates.get(nodeId);
        if (!state.triggered) {
            state.triggered = true;
            
            // Auto-reset after timeout
            if (config.autoResetMs > 0) {
                setTimeout(() => {
                    state.triggered = false;
                }, config.autoResetMs);
            }
            
            // First trigger - pass message through
            return { active: true, passMessage: true, modifiedMessage: message };
        }
        
        // Already triggered - block
        return { active: false, passMessage: false };
    }
    
    evaluateThrottleNode(nodeId, config, message, inputActive) {
        if (!inputActive) return { active: false, passMessage: false };
        
        const state = this.throttleStates.get(nodeId);
        const now = Date.now();
        
        // Remove timestamps older than 1 second
        state.messageTimestamps = state.messageTimestamps.filter(
            timestamp => now - timestamp < 1000
        );
        
        if (state.messageTimestamps.length < config.messagesPerSecond) {
            state.messageTimestamps.push(now);
            // Within rate limit - pass through
            return { active: true, passMessage: true, modifiedMessage: message };
        }
        
        // Rate limit exceeded - block
        return { active: false, passMessage: false };
    }
    
    evaluateSequencerNode(nodeId, config, message, inputActive) {
        if (!inputActive) return { active: false, passMessage: false };
        
        const state = this.nodeStates.get(nodeId);
        const now = Date.now();
        
        // Check for timeout
        if (config.resetOnTimeout && (now - state.lastActivity) > config.timeoutMs) {
            state.sequence = [];
        }
        
        state.sequence.push(now);
        state.lastActivity = now;
        
        // Sequencer delays messages - async operation
        return { active: true, passMessage: false, modifiedMessage: message };
    }
    
    // Counter node: Counts messages and triggers at target
    evaluateCounterNode(nodeId, config, message, inputActive) {
        if (!inputActive) return { active: false, passMessage: false };
        
        const state = this.nodeStates.get(nodeId);
        
        // Increment/decrement counter based on mode
        if (state.mode === 'INCREMENT') {
            state.count++;
        } else if (state.mode === 'DECREMENT') {
            state.count--;
        }
        
        // Check if we've reached the target
        const targetReached = (state.mode === 'MATCH' && state.count === state.targetCount) ||
                            (state.mode === 'INCREMENT' && state.count >= state.targetCount) ||
                            (state.mode === 'DECREMENT' && state.count <= state.targetCount);
        
        let shouldPass = false;
        
        if (targetReached) {
            shouldPass = true;
            
            // Reset counter if configured to do so
            if (state.resetOnTarget) {
                state.count = config.initialCount || 0;
            }
        }
        
        // Add count to message for downstream nodes
        const modifiedMessage = {
            ...message,
            counterValue: state.count,
            counterTarget: state.targetCount,
            counterTriggered: targetReached
        };
        
        console.log(`[Counter ${nodeId}] Count: ${state.count}/${state.targetCount}, Pass: ${shouldPass}`);
        
        return { 
            active: shouldPass, 
            passMessage: shouldPass, 
            modifiedMessage: modifiedMessage 
        };
    }
    
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            
            request.onsuccess = event => {
                this.db = event.target.result;
                this.loadFlows().then(resolve);
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    async duplicateFlow(flowId) {
        const flow = await this.getFlowById(flowId);
        if (!flow) return null;
        
        const newFlow = {
            ...flow,
            id: null,
            name: `${flow.name} (Copy)`,
        };
        
        return this.saveFlow(newFlow);
    }
    
    async exportFlow(flowId) {
        const flow = await this.getFlowById(flowId);
        if (!flow) return null;
        
        return JSON.stringify(flow, null, 2);
    }
    
    async importFlow(flowData) {
        try {
            const flow = typeof flowData === 'string' ? JSON.parse(flowData) : flowData;
            flow.id = null; // Force new ID on import
            
            return this.saveFlow(flow);
        } catch (e) {
            console.error('Error importing flow:', e);
            return null;
        }
    }
    
    async enableAllFlows(enabled) {
        for (const flow of this.flows) {
            flow.active = enabled;
            await this.saveFlow(flow);
        }
        
        return { success: true, message: `All flows ${enabled ? 'enabled' : 'disabled'}` };
    }
    
    async toggleFlowActive(flowId) {
        const flow = await this.getFlowById(flowId);
        if (!flow) return { success: false, message: "Flow not found" };
        
        flow.active = !flow.active;
        await this.saveFlow(flow);
        
        return { 
            success: true, 
            message: `Flow ${flow.active ? 'enabled' : 'disabled'}`,
            active: flow.active
        };
    }
    
    async ensureDB() {
        if (!this.db) await this.initPromise;
        return this.db;
    }
    
	async loadFlows() {
			const db = await this.ensureDB();
			
			return new Promise(async (resolve) => {
				const tx = db.transaction(this.storeName, 'readonly');
				const store = tx.objectStore(this.storeName);
				const request = store.getAll();
				
				request.onsuccess = async () => {
					let flowsFromDB = request.result.map(flow => {
						return {
							...flow,
							active: flow.active !== false, // Default to active if not specified
							// Ensure 'order' is a number for sorting, default to a high value for unsorted items
							order: (typeof flow.order === 'number' && !isNaN(flow.order)) ? flow.order : Infinity 
						};
					});

					// Sort flows by the order property
					flowsFromDB.sort((a, b) => a.order - b.order);

					// Optional: Re-assign sequential order if there are gaps or Infinity values from old data
					// This ensures a clean, sequential order in memory and upon next save cycle.
					let needsResaveForOrder = false;
					flowsFromDB.forEach((flow, index) => {
						if (flow.order !== index) {
							flow.order = index;
							// If you want to automatically fix orders in DB, you'd queue a save here.
							// For now, this just cleans the in-memory order. Saving will solidify it.
							// needsResaveForOrder = true; // Flag to indicate a resave might be good.
						}
					});
					
					this.flows = flowsFromDB;
					
					// Check if MIDI is required and set up listeners
					await this.checkMIDIRequirement();
					this.setupMIDIListeners();
					
					resolve(this.flows);
				};
				
				request.onerror = () => {
					console.error('Error loading flows:', request.error);
					resolve([]);
				};
			});
		}
    
	async saveFlow(flowData) {
		const db = await this.ensureDB();
		
		if (!flowData.id) {
			flowData.id = Date.now().toString(); // Generate ID if not present
		}

		const existingFlowIndex = this.flows.findIndex(f => f.id === flowData.id);

		// Assign or ensure 'order' property
		if (typeof flowData.order !== 'number' || isNaN(flowData.order)) {
			if (existingFlowIndex !== -1 && typeof this.flows[existingFlowIndex].order === 'number') {
				flowData.order = this.flows[existingFlowIndex].order; // Preserve existing order if valid
			} else {
				// Assign a new order: append to the end of the current list
				let maxOrder = -1;
				this.flows.forEach(f => {
					if (typeof f.order === 'number' && f.order > maxOrder) {
						maxOrder = f.order;
					}
				});
				flowData.order = (this.flows.length > 0 && maxOrder > -1) ? maxOrder + 1 : 0;
			}
		}
		
		return new Promise((resolve, reject) => {
			const tx = db.transaction(this.storeName, 'readwrite');
			const store = tx.objectStore(this.storeName);
			
			const request = store.put(flowData); // flowData now includes 'order'
			
			request.onsuccess = async () => {
				if (existingFlowIndex !== -1) {
					this.flows[existingFlowIndex] = flowData;
				} else {
					this.flows.push(flowData);
				}
				// Re-sort the in-memory list by order after any save
				this.flows.sort((a, b) => (a.order || 0) - (b.order || 0));
				
				// Check if MIDI is required and update listeners
				await this.checkMIDIRequirement();
				this.setupMIDIListeners();
				
				resolve(flowData);
			};
			
			request.onerror = (event) => {
				console.error('Error saving flow:', event.target.error);
				reject(event.target.error);
			};
		});
	}
	
	async updateFlowsOrder(orderedFlowIds) {
        if (!Array.isArray(orderedFlowIds)) {
            console.error("updateFlowsOrder expects an array of flow IDs");
            return { success: false, message: "Invalid input for reordering." };
        }

        const db = await this.ensureDB();
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const promises = [];

        // Update order in memory first to get the correct flow objects
        const idToNewOrderMap = new Map();
        orderedFlowIds.forEach((id, index) => idToNewOrderMap.set(id, index));

        // Create a new array for this.flows to ensure proper update
        const newOrderedFlows = [];

        this.flows.forEach(flow => {
            if (idToNewOrderMap.has(flow.id)) {
                flow.order = idToNewOrderMap.get(flow.id);
            }
            // If a flow was somehow not in orderedFlowIds, it will retain its old order,
            // which might cause issues. It's better if orderedFlowIds is comprehensive.
            // For now, we assume orderedFlowIds contains all relevant flows for reordering.
        });
        
        // Sort based on new order and push promises for DB update
        this.flows.sort((a,b) => (a.order || 0) - (b.order || 0));

        this.flows.forEach(flow => {
            // We only need to update flows whose order might have changed
            // or to ensure all flows in the list get a sequential order.
            // The orderedFlowIds implies the complete new order for those IDs.
            if (idToNewOrderMap.has(flow.id)) { // Check if this flow was part of the reorder list
                 promises.push(new Promise((resolve, reject) => {
                    const request = store.put(flow);
                    request.onsuccess = () => resolve();
                    request.onerror = (event) => {
                        console.error(`Error updating order for flow ${flow.id}:`, event.target.error);
                        reject(event.target.error);
                    };
                }));
            }
            newOrderedFlows.push(flow); // Build the new in-memory list
        });
        
        this.flows = newOrderedFlows; // Update the main flows array

        return new Promise((resolveOuter, rejectOuter) => {
            transaction.oncomplete = () => {
                // All puts succeeded
                this.flows.sort((a,b) => (a.order || 0) - (b.order || 0)); // Final sort of in-memory
                resolveOuter({ success: true, message: "Flows reordered successfully." });
            };
            transaction.onerror = (event) => {
                console.error("Transaction error during flow reorder:", event.target.error);
                // If transaction fails, IndexedDB rolls back. The in-memory this.flows might be partially updated.
                // It would be best to reload from DB to ensure consistency or revert in-memory changes.
                // For simplicity now, just reject.
                rejectOuter({ success: false, message: "Transaction error during flow reorder.", error: event.target.error });
            };

            // If using individual promises (not strictly necessary with transaction.oncomplete)
            // Promise.all(promises)
            //     .then(() => {
            //         // This block is effectively handled by transaction.oncomplete
            //     })
            //     .catch(error => {
            //         // This block is effectively handled by transaction.onerror
            //     });
        });
    }

    async deleteFlow(flowId) {
        const db = await this.ensureDB();
        
        return new Promise((resolve, reject) => { // Changed to reject for errors
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(flowId);
            
            request.onsuccess = () => {
                this.flows = this.flows.filter(flow => flow.id !== flowId);
                // Re-order remaining flows
                this.flows.sort((a, b) => (a.order || 0) - (b.order || 0));
                this.flows.forEach((flow, index) => {
                    if (flow.order !== index) {
                        flow.order = index;
                        // Asynchronously save the re-ordered flows without waiting here
                        // to avoid complicating the deleteFlow promise.
                        // This could be a separate cleanup task or handled more explicitly.
                        this.saveFlow(flow).catch(err => console.error("Error re-saving flow after delete:", err));
                    }
                });
                resolve({ success: true, message: "Flow deleted" });
            };
            
            request.onerror = (event) => { // Handle error
                console.error("Error deleting flow:", event.target.error);
                reject({ success: false, message: "Error deleting flow", error: event.target.error });
            };
        });
    }
    
    async getAllFlows() {
        // Ensure flows are loaded and sorted before returning
        if (this.flows.length === 0 && this.db) { // If db is initialized but flows array is empty
            await this.loadFlows();
        }
        // The internal this.flows should always be sorted by 'order' due to loadFlows and saveFlow
        return this.flows;
    }
    
    async reloadFlows() {
        // Force reload flows from database
        //console.log('[EventFlowSystem] Reloading flows from database');
        await this.loadFlows();
        return this.flows;
    }
    
    async getFlowById(flowId) {
        return this.flows.find(flow => flow.id === flowId) || null;
    }
    
    async processMessage(message) {
        
        if (!message) {
            ////console.log("[RELAY DEBUG - ProcessMessage] Message is null/undefined at start.");
            return message;
        }
        
        let processed = { ...message };
        let blocked = false;
        
        const activeFlows = this.flows.filter(f => f.active);
        ////console.log(`[RELAY DEBUG - ProcessMessage] Processing ${activeFlows.length} active flows`);
        ////console.log(`[RELAY DEBUG - ProcessMessage] Active flow names:`, activeFlows.map(f => f.name));
        
        for (const flow of this.flows) {
            if (!flow.active) {
                // //console.log(`[ProcessMessage] Flow "${flow.name}" (ID: ${flow.id}) is inactive. Skipping.`);
                continue;
            }
          ////console.log(`[ProcessMessage] Evaluating active flow "${flow.name}" (ID: ${flow.id})`);
            
            const result = await this.evaluateFlow(flow, processed);
          ////console.log(`[ProcessMessage] Result for flow "${flow.name}":`, JSON.stringify(result));

            if (result) {
                if (result.blocked) {
                  //console.log(`[ProcessMessage] Flow "${flow.name}" BLOCKED the message. No further flows will be processed.`);
                    blocked = true;
                    break; 
                }
                
                if (result.modified) {
                  //console.log(`[ProcessMessage] Flow "${flow.name}" MODIFIED the message.`);
                    processed = result.message;
                }
            }
        }
        
      //console.log(`[ProcessMessage] Final result: ${blocked ? 'BLOCKED (returning null)' : 'NOT BLOCKED (returning message)'}`);
        return blocked ? null : processed;
    }
    
    async evaluateFlow(flow, message) {
      //console.log(`[EvaluateFlow "${flow.name}"] Starting evaluation with message:`, JSON.stringify(message));
        if (!flow.nodes || !flow.connections) {
          //console.log(`[EvaluateFlow "${flow.name}"] Flow has no nodes or connections.`);
            return { modified: false, message, blocked: false };
        }

        const nodeActivationStates = {}; 

        // --- Pass 1: Evaluate all base triggers ---
      //console.log(`[EvaluateFlow "${flow.name}"] Pass 1: Evaluating Triggers`);
        for (const node of flow.nodes) {
            if (node.type === 'trigger') {
              //console.log(`[EvaluateFlow "${flow.name}"] Evaluating Trigger Node ID: ${node.id}, Type: ${node.triggerType}`);
                nodeActivationStates[node.id] = await this.evaluateTrigger(node, message);
              //console.log(`[EvaluateFlow "${flow.name}"] Trigger Node ID: ${node.id} Activation State: ${nodeActivationStates[node.id]}`);
            }
        }

        // --- Pass 2: Iteratively evaluate logic nodes ---
      //console.log(`[EvaluateFlow "${flow.name}"] Pass 2: Evaluating Logic Nodes`);
        let madeChangeInLoop = true;
        const maxIterations = flow.nodes.length + 5; 
        let iterations = 0;

        while (madeChangeInLoop && iterations < maxIterations) {
            madeChangeInLoop = false;
            iterations++;
            // console.log(`[EvaluateFlow "${flow.name}"] Logic Iteration: ${iterations}`);

            for (const node of flow.nodes) {
                if (node.type === 'logic' && !nodeActivationStates.hasOwnProperty(node.id)) {
                    const inputConnections = flow.connections.filter(conn => conn.to === node.id);
                    const inputNodeIds = inputConnections.map(conn => conn.from);
                    
                    const allInputsEvaluated = inputNodeIds.every(inputId => nodeActivationStates.hasOwnProperty(inputId));

                    if (allInputsEvaluated) {
                        const inputValues = inputNodeIds.map(inputId => nodeActivationStates[inputId]);
                      //console.log(`[EvaluateFlow "${flow.name}"] Evaluating Logic Node ID: ${node.id} (${node.logicType}) with inputs: ${JSON.stringify(inputValues)} from nodes: ${JSON.stringify(inputNodeIds)}`);
                        const result = await this.evaluateSpecificLogicNode(node.logicType, inputValues, node.config);
                        nodeActivationStates[node.id] = result;
                        
                      //console.log(`[EvaluateFlow "${flow.name}"] Logic Node ID: ${node.id} Activation State: ${nodeActivationStates[node.id]}`);
                        madeChangeInLoop = true;
                    }
                } else if (node.type === 'state' && !nodeActivationStates.hasOwnProperty(node.id)) {
                    const inputConnections = flow.connections.filter(conn => conn.to === node.id);
                    const inputNodeIds = inputConnections.map(conn => conn.from);
                    
                    const allInputsEvaluated = inputNodeIds.every(inputId => nodeActivationStates.hasOwnProperty(inputId));

                    if (allInputsEvaluated) {
                        const inputActive = inputNodeIds.some(inputId => nodeActivationStates[inputId] === true);
                      //console.log(`[EvaluateFlow "${flow.name}"] Evaluating State Node ID: ${node.id} (${node.stateType}) with input active: ${inputActive}`);
                        const result = await this.evaluateStateNode(node, message, inputActive);
                        
                        // State nodes return an object with activation and pass-through info
                        nodeActivationStates[node.id] = result.active;
                        
                        // If the state node modifies or passes the message, update it
                        if (result.passMessage && result.modifiedMessage) {
                            // Update the message for downstream nodes
                            message = result.modifiedMessage;
                        }
                        
                      //console.log(`[EvaluateFlow "${flow.name}"] State Node ID: ${node.id} Activation State: ${nodeActivationStates[node.id]}`);
                        madeChangeInLoop = true;
                    }
                }
            }
        }
        if (iterations >= maxIterations) {
            console.warn(`[EvaluateFlow "${flow.name}"] Flow evaluation exceeded max iterations for logic nodes.`);
        }

        // --- Pass 3: Execute actions ---
      //console.log(`[EvaluateFlow "${flow.name}"] Pass 3: Executing Actions. Current node states:`, JSON.stringify(nodeActivationStates));
        let overallResult = { modified: false, message: { ...message }, blocked: false }; 
        const nodeMap = new Map(flow.nodes.map(node => [node.id, node]));
        const executedActions = new Set(); // Track which actions have been executed

        // Process actions in topological order (following connections)
        const executeActionChain = async (actionId) => {
            if (executedActions.has(actionId)) {
                return; // Already executed this action
            }
            
            const node = nodeMap.get(actionId);
            if (!node || node.type !== 'action') {
                return;
            }
            
            if (overallResult.blocked) {
              //console.log(`[EvaluateFlow "${flow.name}"] Message already blocked. Skipping action node ${node.id} (${node.actionType}).`);
                return; 
            }
            
            // Execute this action
            executedActions.add(actionId);
            const actionResult = await this.executeAction(node, overallResult.message);
            
            if (actionResult) { 
                if (actionResult.blocked) {
                    overallResult.blocked = true;
                  //console.log(`[EvaluateFlow "${flow.name}"] Action Node ID: ${node.id} BLOCKED the message.`);
                    return; 
                }
                if (actionResult.modified && actionResult.message) {
                    overallResult.message = { ...actionResult.message }; 
                    overallResult.modified = true;
                  //console.log(`[EvaluateFlow "${flow.name}"] Action Node ID: ${node.id} MODIFIED the message.`);
                }
            }
            
            // Find and execute downstream actions
            let downstreamConnections = flow.connections.filter(conn => conn.from === actionId);
            // Prioritize lightweight/control actions before heavy ones (e.g., delay)
            const priorityOf = (node) => {
                if (!node || node.type !== 'action') return 50;
                switch (node.actionType) {
                    case 'setGateState':
                    case 'resetStateNode':
                    case 'setCounter':
                    case 'incrementCounter':
                    case 'checkCounter':
                        return 0; // control/state updates first
                    case 'delay':
                        return 100; // run after immediate controls
                    default:
                        return 50; // normal actions
                }
            };
            downstreamConnections.sort((a, b) => {
                const an = nodeMap.get(a.to);
                const bn = nodeMap.get(b.to);
                return priorityOf(an) - priorityOf(bn);
            });
            for (const conn of downstreamConnections) {
                const downstreamNode = nodeMap.get(conn.to);
                if (downstreamNode && downstreamNode.type === 'action') {
                    await executeActionChain(conn.to);
                }
            }
        };

        // Start execution from actions connected to activated triggers/logic/state
        for (const node of flow.nodes) {
            if (node.type === 'action' && !executedActions.has(node.id)) {
                const inputConnections = flow.connections.filter(conn => conn.to === node.id);
                const inputNodeIds = inputConnections.map(conn => conn.from);
                
                const shouldExecute = inputNodeIds.some(inputId => {
                    const inputNode = nodeMap.get(inputId);
                    // Allow actions to be driven by triggers, logic, or state nodes
                    return (
                        inputNode &&
                        (inputNode.type === 'trigger' || inputNode.type === 'logic' || inputNode.type === 'state') &&
                        nodeActivationStates[inputId] === true
                    );
                });

                if (shouldExecute) {
                    await executeActionChain(node.id);
                }
            }
        }
      //console.log(`[EvaluateFlow "${flow.name}"] Finished. Overall Result:`, JSON.stringify(overallResult));
        return overallResult;
    }
    
    stripHtml(html) {
        // Simple HTML stripping function that preserves emoji alt text
        if (!html || typeof html !== 'string') return html;
        
        // Create a temporary element to use browser's HTML parsing
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        
        // Replace img tags with their alt text (especially for emojis)
        tmp.querySelectorAll('img[alt]').forEach(img => {
            const alt = img.getAttribute('alt');
            img.replaceWith(document.createTextNode(alt));
        });
        
        // Get text content and clean up extra whitespace
        const text = tmp.textContent || tmp.innerText || '';
        return text.replace(/\s\s+/g, ' ').trim();
    }
    
    async evaluateTrigger(triggerNode, message) {
        const { triggerType, config } = triggerNode;
        // console.log(`[EvaluateTrigger] Node: ${triggerNode.id}, Type: ${triggerType}, Config: ${JSON.stringify(config)}, Message: ${message.chatmessage}`);
        let match = false;
		
		// If message is null/undefined (scheduler tick), avoid property access
		if (message && message.event && ("meta" in message) && !message.chatname && !message.chatmessage){
			return false;
		}
		
        // Get the message text for comparison
        let messageText = message && message.chatmessage;
        if (message && messageText && typeof messageText === 'string') {
            // If textonly flag is set, the message is already plain text
            if (!message.textonly) {
                // Check if we've already cleaned this message (cache the result)
                if (!message.textContent) {
                    message.textContent = this.stripHtml(messageText);
                }
                messageText = message.textContent;
            }
        }
        
        switch (triggerType) {
            case 'anyMessage':
                // Trigger on any message regardless of content
                // Ensure we return a strict boolean so downstream checks using === true work
                return !!message;
                
            case 'messageContains':
                // Ensure properties exist before trying to access them
                match = message && messageText && typeof messageText === 'string' &&
                           config && typeof config.text === 'string' &&
                           messageText.includes(config.text);
              //console.log(`[EvaluateTrigger - messageContains] Config Text: "${config.text}", Message Text: "${messageText}", Match: ${match}`);
                return match;
                
            case 'messageStartsWith':
                match = message && messageText && typeof messageText === 'string' &&
                           config && typeof config.text === 'string' &&
                           messageText.startsWith(config.text);
              //console.log(`[EvaluateTrigger - messageStartsWith] Config Text: "${config.text}", Message Text: "${messageText}", Match: ${match}`);
                return match;
                
            case 'messageEndsWith':
                match = message && messageText && typeof messageText === 'string' &&
                           config && typeof config.text === 'string' &&
                           messageText.endsWith(config.text);
                return match;
                
            case 'messageEquals':
                match = message && typeof messageText === 'string' &&
                           config && typeof config.text === 'string' &&
                           messageText === config.text;
              //console.log(`[EvaluateTrigger - messageEquals] Config Text: "${config.text}", Message Text: "${messageText}", Match: ${match}`);
                return match;
                
            case 'messageRegex':
                try {
                    const regex = new RegExp(config.pattern, config.flags || '');
                    match = regex.test(messageText);
                  //console.log(`[EvaluateTrigger - messageRegex] Pattern: "${config.pattern}", Flags: "${config.flags}", Message: "${messageText}", Match: ${match}`);
                    return match;
                } catch (e) {
                    console.error('[EvaluateTrigger - messageRegex] Invalid regex:', e);
                    return false;
                }
                
            case 'messageLength':
                const msgLength = messageText ? messageText.length : 0;
                const targetLength = config.length || 100;
                switch (config.comparison) {
                    case 'gt': return msgLength > targetLength;
                    case 'lt': return msgLength < targetLength;
                    case 'eq': return msgLength === targetLength;
                    default: return msgLength > targetLength; // Default to greater than
                }
                
            case 'wordCount':
                const words = messageText ? messageText.trim().split(/\s+/).length : 0;
                const targetWords = config.count || 5;
                switch (config.comparison) {
                    case 'gt': return words > targetWords;
                    case 'lt': return words < targetWords;
                    case 'eq': return words === targetWords;
                    default: return words > targetWords;
                }
                
            case 'containsEmoji':
                // Basic emoji detection regex
                const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
                return messageText ? emojiRegex.test(messageText) : false;
                
            case 'containsLink':
                // Simple URL detection - matches http://, https://, or www.
                const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/i;
                return messageText ? urlRegex.test(messageText) : false;
                
            case 'fromSource':
                if (config.source === '*') {
                    match = true; // Match any source
                } else {
                    match = message && message.type === config.source;
                }
                //console.log(`[RELAY DEBUG - fromSource Trigger] Config Source: "${config.source}", Message Type: "${message.type}", Match: ${match}`);
                return match;
                
            case 'fromChannelName':
                if (!config.channelName || config.channelName.trim() === '') {
                    match = true; // Match any channel if no name specified
                } else {
                    const channelName = (message.sourceName || '').toLowerCase();
                    match = channelName === config.channelName.toLowerCase();
                }
                //console.log(`[RELAY DEBUG - fromChannelName Trigger] Config Channel: "${config.channelName}", Message Channel: "${message.sourceName}", Match: ${match}`);
                return match;
                
            case 'fromUser':
                const identifier = (message.userid || message.chatname || '').toLowerCase();
                match = config && typeof config.username === 'string' && identifier === config.username.toLowerCase();
              ////console.log(`[EvaluateTrigger - fromUser] Config Username: "${config.username}", Message Identifier: "${identifier}", Match: ${match}`);
                return match;
                
            case 'userRole':
                match = message && config && message[config.role] === true; 
              ////console.log(`[EvaluateTrigger - userRole] Config Role: "${config.role}", Message Role Value: ${message[config.role]}, Match: ${match}`);
                return match;
                
            case 'hasDonation':
                match = !!message.hasDonation; // Assuming hasDonation is a truthy value if donation exists
              ////console.log(`[EvaluateTrigger - hasDonation] Message hasDonation: "${message.hasDonation}", Match: ${match}`);
                return match;
                
            case 'timeInterval':
                // Trigger at regular intervals (in seconds)
                if (!config.interval || config.interval <= 0) return false;
                
                const nodeState = `timeInterval_${triggerNode.id}`;
                const now = Date.now();
                const lastTriggered = this[nodeState] || 0;
                const intervalMs = config.interval * 1000;
                
                if (now - lastTriggered >= intervalMs) {
                    this[nodeState] = now;
                    return true;
                }
                return false;
                
            case 'timeOfDay':
                // Trigger at specific times of day
                if (!config.times || !Array.isArray(config.times)) return false;
                
                const currentTime = new Date();
                const currentHour = currentTime.getHours();
                const currentMinute = currentTime.getMinutes();
                const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
                
                // Check if current time matches any configured time
                match = config.times.some(time => {
                    if (typeof time === 'string' && time.includes(':')) {
                        return time === currentTimeString;
                    }
                    return false;
                });
                
                // Prevent triggering multiple times in the same minute
                const todNodeState = `timeOfDay_${triggerNode.id}_lastTriggered`;
                if (match) {
                    if (this[todNodeState] === currentTimeString) {
                        return false; // Already triggered this minute
                    }
                    this[todNodeState] = currentTimeString;
                }
                return match;
                
            case 'midiNoteOn':
            case 'midiNoteOff':
            case 'midiCC':
                // MIDI triggers are handled by listeners, not evaluated per message
                // They'll be set up when flows are loaded/saved
                return false;
                
            case 'customJs':
                try {
                    const evalFunction = new Function('message', config.code);
                    match = evalFunction(message);
                  ////console.log(`[EvaluateTrigger - customJs] Code executed. Result: ${match}`);
                    return match;
                } catch (e) {
                    console.error('[EvaluateTrigger - customJs] Error in custom JS trigger:', e);
                    return false;
                }
                
            case 'counter': {
                const {
                    threshold = 10,
                    countType = 'global', // 'global', 'perUser', 'perSource'
                    resetOnTrigger = true,
                    resetAfterMs = 0, // Auto-reset after time (0 = never)
                    countProperty = null // Count specific property (e.g., 'hasDonation')
                } = config;
                
                // Initialize state
                if (!this.triggerState) this.triggerState = {};
                const counterId = `counter_${triggerNode.id}`;
                
                if (!this.triggerState[counterId]) {
                    this.triggerState[counterId] = {
                        counts: {},
                        lastReset: Date.now()
                    };
                }
                
                const counterState = this.triggerState[counterId];
                const now = Date.now();
                
                // Auto-reset if time expired
                if (resetAfterMs > 0 && now - counterState.lastReset > resetAfterMs) {
                    counterState.counts = {};
                    counterState.lastReset = now;
                }
                
                // Determine counter key
                let counterKey = 'global';
                if (countType === 'perUser' && message.userid) {
                    counterKey = `user_${message.userid}`;
                } else if (countType === 'perSource' && message.type) {
                    counterKey = `source_${message.type}`;
                }
                
                // Skip if counting specific property that doesn't exist
                if (countProperty && !message[countProperty]) {
                    return false;
                }
                
                // Increment counter
                if (!counterState.counts[counterKey]) {
                    counterState.counts[counterKey] = 0;
                }
                counterState.counts[counterKey]++;
                
                // Check threshold
                const triggered = counterState.counts[counterKey] >= threshold;
                
                if (triggered && resetOnTrigger) {
                    counterState.counts[counterKey] = 0;
                }
                
                return triggered;
            }
            
            case 'userPool': {
                const poolConfig = {
                    poolName: trigger.config.poolName || 'default',
                    maxUsers: trigger.config.maxUsers || 10,
                    requireEntry: trigger.config.requireEntry !== false, // Default true
                    entryKeyword: trigger.config.entryKeyword || '!enter',
                    resetOnFull: trigger.config.resetOnFull || false,
                    resetAfterMs: trigger.config.resetAfterMs || 0,
                    allowReentry: trigger.config.allowReentry || false,
                    scope: trigger.config.scope || 'global' // global, perSource
                };
                
                // Initialize pool storage if needed
                if (!this.userPools) {
                    this.userPools = {};
                }
                
                // Create pool key based on scope
                const poolKey = poolConfig.scope === 'perSource' 
                    ? `${poolConfig.poolName}_${message.type || 'unknown'}`
                    : poolConfig.poolName;
                
                // Initialize this pool if it doesn't exist
                if (!this.userPools[poolKey]) {
                    this.userPools[poolKey] = {
                        users: [],
                        lastActivity: Date.now(),
                        resetTimeout: null
                    };
                }
                
                const pool = this.userPools[poolKey];
                const userId = message.userid || message.chatname;
                
                // Clear reset timeout if pool is active
                if (pool.resetTimeout) {
                    clearTimeout(pool.resetTimeout);
                    pool.resetTimeout = null;
                }
                
                // Check if pool should reset due to inactivity
                if (poolConfig.resetAfterMs > 0 && 
                    Date.now() - pool.lastActivity > poolConfig.resetAfterMs) {
                    pool.users = [];
                }
                
                // Update last activity
                pool.lastActivity = Date.now();
                
                // Check if user needs to enter the pool
                if (poolConfig.requireEntry) {
                    const messageText = (message.chatmessage || '').toLowerCase().trim();
                    const keyword = poolConfig.entryKeyword.toLowerCase();
                    
                    if (!messageText.includes(keyword)) {
                        return false; // User hasn't entered with keyword
                    }
                }
                
                // Check if user is already in pool
                const userInPool = pool.users.includes(userId);
                
                // Handle reentry logic
                if (userInPool && !poolConfig.allowReentry) {
                    return false; // User already in pool and reentry not allowed
                }
                
                // Add user to pool if not already there
                if (!userInPool) {
                    pool.users.push(userId);
                }
                
                // Check if pool is full
                const poolFull = pool.users.length >= poolConfig.maxUsers;
                
                if (poolFull) {
                    // Trigger when pool becomes full
                    if (poolConfig.resetOnFull) {
                        // Schedule reset after triggering
                        setTimeout(() => {
                            pool.users = [];
                        }, 100);
                    }
                    return true;
                }
                
                // Set up inactivity reset if configured
                if (poolConfig.resetAfterMs > 0) {
                    pool.resetTimeout = setTimeout(() => {
                        pool.users = [];
                    }, poolConfig.resetAfterMs);
                }
                
                return false;
            }
            
            case 'accumulator': {
                const accConfig = {
                    accumulatorName: trigger.config.accumulatorName || 'default',
                    threshold: trigger.config.threshold || 100,
                    propertyName: trigger.config.propertyName || 'amount',
                    operation: trigger.config.operation || 'sum', // sum, avg, max, min
                    triggerMode: trigger.config.triggerMode || 'gte', // gte, exact, lte
                    autoReset: trigger.config.autoReset || false,
                    scope: trigger.config.scope || 'global', // global, perUser, perSource
                    resetAfterMs: trigger.config.resetAfterMs || 0
                };
                
                // Initialize accumulator storage if needed
                if (!this.accumulators) {
                    this.accumulators = {};
                }
                
                // Create accumulator key based on scope
                let accKey = accConfig.accumulatorName;
                if (accConfig.scope === 'perUser') {
                    accKey += `_${message.userid || message.chatname}`;
                } else if (accConfig.scope === 'perSource') {
                    accKey += `_${message.type || 'unknown'}`;
                } else if (accConfig.scope === 'perUserPerSource') {
                    accKey += `_${message.userid || message.chatname}_${message.type || 'unknown'}`;
                }
                
                // Initialize this accumulator if it doesn't exist
                if (!this.accumulators[accKey]) {
                    this.accumulators[accKey] = {
                        value: 0,
                        count: 0,
                        max: -Infinity,
                        min: Infinity,
                        lastUpdate: Date.now(),
                        resetTimeout: null
                    };
                }
                
                const acc = this.accumulators[accKey];
                
                // Clear reset timeout if accumulator is active
                if (acc.resetTimeout) {
                    clearTimeout(acc.resetTimeout);
                    acc.resetTimeout = null;
                }
                
                // Check if accumulator should reset due to inactivity
                if (accConfig.resetAfterMs > 0 && 
                    Date.now() - acc.lastUpdate > accConfig.resetAfterMs) {
                    acc.value = 0;
                    acc.count = 0;
                    acc.max = -Infinity;
                    acc.min = Infinity;
                }
                
                // Get the value to accumulate
                const valueToAccumulate = parseFloat(message[accConfig.propertyName]) || 0;
                
                // Only accumulate if there's a value
                if (valueToAccumulate !== 0 || accConfig.operation === 'count') {
                    acc.lastUpdate = Date.now();
                    acc.count++;
                    
                    switch (accConfig.operation) {
                        case 'sum':
                            acc.value += valueToAccumulate;
                            break;
                        case 'avg':
                            acc.value = ((acc.value * (acc.count - 1)) + valueToAccumulate) / acc.count;
                            break;
                        case 'max':
                            acc.max = Math.max(acc.max, valueToAccumulate);
                            acc.value = acc.max;
                            break;
                        case 'min':
                            acc.min = Math.min(acc.min, valueToAccumulate);
                            acc.value = acc.min;
                            break;
                        case 'count':
                            acc.value = acc.count;
                            break;
                    }
                }
                
                // Check if trigger condition is met
                let accTriggered = false;
                switch (accConfig.triggerMode) {
                    case 'gte':
                        accTriggered = acc.value >= accConfig.threshold;
                        break;
                    case 'exact':
                        accTriggered = acc.value === accConfig.threshold;
                        break;
                    case 'lte':
                        accTriggered = acc.value <= accConfig.threshold;
                        break;
                }
                
                // Reset if triggered and auto-reset is enabled
                if (accTriggered && accConfig.autoReset) {
                    setTimeout(() => {
                        acc.value = 0;
                        acc.count = 0;
                        acc.max = -Infinity;
                        acc.min = Infinity;
                    }, 100);
                }
                
                // Set up inactivity reset if configured
                if (accConfig.resetAfterMs > 0) {
                    acc.resetTimeout = setTimeout(() => {
                        acc.value = 0;
                        acc.count = 0;
                        acc.max = -Infinity;
                        acc.min = Infinity;
                    }, accConfig.resetAfterMs);
                }
                
                return accTriggered;
            }
                
            case 'randomChance': {
                const { 
                    probability = 0.5, 
                    cooldownMs = 0,
                    maxPerMinute = 0,
                    requireMessage = true 
                } = config;
                
                // Skip if no message when required
                if (requireMessage && (!message.chatmessage || !message.chatmessage.trim())) {
                    return false;
                }
                
                // Initialize trigger state if needed
                if (!this.triggerState) this.triggerState = {};
                const triggerId = `random_${triggerNode.id}`;
                
                if (!this.triggerState[triggerId]) {
                    this.triggerState[triggerId] = {
                        lastTriggered: 0,
                        minuteCounter: [],
                        cooldownUntil: 0
                    };
                }
                
                const state = this.triggerState[triggerId];
                const now = Date.now();
                
                // Check cooldown
                if (cooldownMs > 0 && now < state.cooldownUntil) {
                    return false;
                }
                
                // Check rate limit (max per minute)
                if (maxPerMinute > 0) {
                    // Clean old entries
                    state.minuteCounter = state.minuteCounter.filter(t => now - t < 60000);
                    
                    if (state.minuteCounter.length >= maxPerMinute) {
                        return false;
                    }
                }
                
                // Random check
                const randomValue = Math.random();
                const triggered = randomValue < probability;
                
                if (triggered) {
                    // Update state
                    state.lastTriggered = now;
                    state.cooldownUntil = now + cooldownMs;
                    if (maxPerMinute > 0) {
                        state.minuteCounter.push(now);
                    }
                }
                
                return triggered;
            }
                
            case 'messageProperties': {
                const { requiredProperties = [], forbiddenProperties = [], requireAll = true } = config;
                
                // Check forbidden properties first (immediate fail)
                for (const prop of forbiddenProperties) {
                    // Special handling for karma thresholds
                    if (prop === 'lowKarma' && message.karma !== undefined && message.karma < 0.3) {
                        return false;
                    }
                    // Check if property exists and is truthy (not false, null, undefined, 0, or empty string)
                    if (prop !== 'lowKarma' && message[prop]) {
                        return false; // Forbidden property exists and is truthy
                    }
                }
                
                // If no required properties, pass
                if (requiredProperties.length === 0) return true;
                
                // Check required properties
                const checkProperty = (prop) => {
                    // Special handling for karma thresholds
                    if (prop === 'highKarma') {
                        return message.karma !== undefined && message.karma >= 0.7;
                    }
                    // Special handling for arrays
                    if (prop === 'chatbadges') {
                        return Array.isArray(message.chatbadges) && message.chatbadges.length > 0;
                    }
                    // Check if property exists and is truthy
                    return message[prop] && message[prop] !== false;
                };
                
                if (requireAll) {
                    // ALL required properties must exist
                    return requiredProperties.every(checkProperty);
                } else {
                    // ANY required property must exist
                    return requiredProperties.some(checkProperty);
                }
            }
                
            default:
              ////console.log(`[EvaluateTrigger] Unknown triggerType: ${triggerType}`);
                return false;
        }
    }
    
    async processFlowFromNode(flow, nodeId, message) {  //  this is obsolete now, or at least replaced partially?
        const visited = new Set();
        let currentMessage = { ...message };
        let blocked = false;
        let modified = false;
        
        // Find all outgoing connections from this node
        const processNode = async (nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            
            const node = flow.nodes.find(n => n.id === nodeId);
            if (!node) return;
            
            // Process action node
            if (node.type === 'action') {
                const actionResult = await this.executeAction(node, currentMessage);
                
                if (actionResult) {
                    if (actionResult.blocked) {
                        blocked = true;
                        return;
                    }
                    
                    if (actionResult.modified) {
                        currentMessage = actionResult.message;
                        modified = true;
                    }
                }
            }
            
            // Find connections from this node
            const outgoingConnections = flow.connections.filter(conn => conn.from === nodeId);
            
            // Process all connected nodes
            for (const connection of outgoingConnections) {
                if (!blocked) {
                    await processNode(connection.to);
                }
            }
        };
        
        await processNode(nodeId);
        
        return {
            modified,
            message: currentMessage,
            blocked
        };
    }
	
	sanitizeSendMessage(text, textonly = false, alt = false) {
		if (!text || !text.trim()) {
			return alt || text;
		}

		// Extract all emojis from image alt attributes before stripping HTML
		const emojiMap = new Map();
		if (!textonly) {
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = text;

			// Collect all image elements with alt text that appears to be an emoji
			const imgElements = tempDiv.querySelectorAll('img');
			imgElements.forEach((img, index) => {
				const altText = img.getAttribute('alt');
				if (altText && isEmoji(altText)) {
					const placeholder = `__EMOJI_PLACEHOLDER_${index}__`;
					emojiMap.set(placeholder, altText);
					img.outerHTML = placeholder;
				}
			});

			// Get the potentially modified HTML
			text = tempDiv.innerHTML;

			// Convert to text from HTML
			const textArea = document.createElement('textarea');
			textArea.innerHTML = text;
			text = textArea.value;
		}

		// Strip HTML and other unwanted characters
		text = text.replace(/(<([^>]+)>)/gi, "");
		text = text.replace(/[!#@]/g, "");
		text = text.replace(/cheer\d+/gi, " ");

		// Replace periods unless surrounded by non-space characters
		// (so URLs like example.com are preserved)
		text = text.replace(/\.(?=\S)/g, (match, offset, str) => {
			const prev = offset > 0 ? str[offset - 1] : "";
			const next = str[offset + 1] || "";
			if (/\S/.test(prev) && /\S/.test(next)) {
				return "."; // keep the period (inside URL/word)
			}
			return " "; // replace with space otherwise
		});

		// Replace all emoji placeholders with their actual emojis
		emojiMap.forEach((emoji, placeholder) => {
			text = text.replace(placeholder, emoji);
		});

		if (!text.trim() && alt) {
			return alt;
		}
		return text.trim();
	}
    
    async executeAction(actionNode, message) {
        const { actionType, config } = actionNode;
        //console.log(`[ExecuteAction] Node: ${actionNode.id}, Type: ${actionType}, Config: ${JSON.stringify(config)}`);
        let result = { modified: false, message, blocked: false };
        
        switch (actionType) {
            case 'blockMessage':
                result.blocked = true;
              //console.log(`[ExecuteAction - blockMessage] Set result.blocked to true.`);
                break;

            case 'reflectionFilter': {
                // Apply only to reflected messages
                if (!message || !message.reflection) {
                    break;
                }

                const policy = config.policy || 'block-all'; // 'block-all' | 'allow-first' | 'allow-all'
                const sourceMode = config.sourceMode || 'none'; // 'none' | 'allow' | 'block'
                const rawTypes = (config.sourceTypes || '').toString();
                const typeList = rawTypes
                    .split(',')
                    .map(t => t.trim().toLowerCase())
                    .filter(Boolean);
                const msgType = (message.type || '').toLowerCase();

                // Source-type allow/block pre-filter
                if (sourceMode === 'block' && typeList.length && typeList.includes(msgType)) {
                    result.blocked = true;
                    break;
                }
                if (sourceMode === 'allow' && typeList.length && !typeList.includes(msgType)) {
                    result.blocked = true;
                    break;
                }

                if (policy === 'allow-all') {
                    // Never block reflections via this node
                    break;
                }

                if (policy === 'block-all') {
                    result.blocked = true;
                    break;
                }

                // allow-first
                const windowMs = parseInt(config.windowMs || 10000, 10) || 10000;
                let basis = '';
                try {
                    // Use sanitized text basis for matching
                    if (message.chatmessage) {
                        if (typeof this.sanitizeSendMessage === 'function') {
                            basis = this.sanitizeSendMessage(message.chatmessage, true) || '';
                        } else if (typeof this.sanitizeRelay === 'function') {
                            basis = this.sanitizeRelay(message.chatmessage, true) || '';
                        } else {
                            basis = (message.chatmessage || '').toString();
                        }
                    }
                } catch (e) {
                    basis = (message.chatmessage || '').toString();
                }
                basis = basis.trim().toLowerCase();
                if (!basis) {
                    // No content to compare; treat as first (allow)
                    break;
                }

                const now = Date.now();
                // Cleanup old entries
                try {
                    for (const [k, ts] of this.reflectionSeen) {
                        if (now - ts > Math.max(10000, windowMs)) {
                            this.reflectionSeen.delete(k);
                        }
                    }
                } catch (e) {}

                const lastSeen = this.reflectionSeen.get(basis);
                if (!lastSeen || (now - lastSeen > windowMs)) {
                    // Allow first occurrence in window, record it
                    this.reflectionSeen.set(basis, now);
                    // Not blocked
                } else {
                    // Within window and seen already → block
                    result.blocked = true;
                }
                break;
            }
                
            case 'modifyMessage':
                if (typeof config.newMessage !== 'string') {
                    console.warn(`[ExecuteAction - modifyMessage] 'newMessage' not configured or not a string for node ${actionNode.id}. Using original message.`);
                    // No change, or set an error, or use a default template.
                } else {
                    result.message = {
                        ...(message || {}),
                        chatmessage: config.newMessage // Placeholder replacement would be an advanced feature here
                    };
                    result.modified = true;
                }
                //console.log(`[ExecuteAction - modifyMessage] Modified message to: "${result.message.chatmessage}"`);
                break;
                
            case 'setProperty':
                // Process value with template variables
                let processedValue = config.value || '';
                
                // Replace template variables if value is a string
                if (typeof processedValue === 'string') {
                    const _src = (message && message.type) || '';
                    const _uname = (message && message.chatname) || '';
                    const _msg = (message && message.chatmessage) || '';
                    processedValue = processedValue.replace(/\{source\}/g, _src);
                    processedValue = processedValue.replace(/\{type\}/g, _src);
                    processedValue = processedValue.replace(/\{username\}/g, _uname);
                    processedValue = processedValue.replace(/\{chatname\}/g, _uname);
                    processedValue = processedValue.replace(/\{message\}/g, _msg);
                    processedValue = processedValue.replace(/\{chatmessage\}/g, _msg);
                }
                
                result.message = {
                    ...(message || {}),
                    [config.property]: processedValue
                };
                result.modified = true;
                break;
                
            case 'addPrefix':
                if (config.prefix && message && message.chatmessage) {
                    // Replace placeholders
                    let prefix = config.prefix;
                    const _src = (message && message.type) || '';
                    const _uname = (message && message.chatname) || '';
                    prefix = prefix.replace(/\{username\}/g, _uname);
                    prefix = prefix.replace(/\{source\}/g, _src);
                    prefix = prefix.replace(/\{chatname\}/g, _uname);
                    
                    result.message = {
                        ...(message || {}),
                        chatmessage: prefix + message.chatmessage
                    };
                    result.modified = true;
                }
                break;
                
            case 'addSuffix':
                if (config.suffix && message && message.chatmessage) {
                    // Replace placeholders
                    let suffix = config.suffix;
                    const _src = (message && message.type) || '';
                    const _uname = (message && message.chatname) || '';
                    suffix = suffix.replace(/\{username\}/g, _uname);
                    suffix = suffix.replace(/\{source\}/g, _src);
                    suffix = suffix.replace(/\{chatname\}/g, _uname);
                    
                    result.message = {
                        ...(message || {}),
                        chatmessage: message.chatmessage + suffix
                    };
                    result.modified = true;
                }
                break;
                
            case 'findReplace':
                if (config.find && message && message.chatmessage) {
                    try {
                        // Create regex with proper escaping for literal search
                        const flags = config.caseSensitive ? 'g' : 'gi';
                        const escapedFind = config.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(escapedFind, flags);
                        
                        result.message = {
                            ...(message || {}),
                            chatmessage: message.chatmessage.replace(regex, config.replace || '')
                        };
                        
                        // Only mark as modified if something actually changed
                        if (result.message.chatmessage !== message.chatmessage) {
                            result.modified = true;
                        }
                    } catch (e) {
                        console.error('[ExecuteAction - findReplace] Error:', e);
                    }
                }
                break;
                
            case 'sendMessage': {
                //console.log('[SEND MESSAGE - Action] Starting send message action execution');
                //console.log('[SEND MESSAGE - Action] Config:', config);
                //console.log('[SEND MESSAGE - Action] Message source:', message.type);
                
                // Don't process reflections to prevent loops
                if (message && message.reflection) {
                    //console.log('[SEND MESSAGE - Action] Skipping - message is a reflection');
                    break;
                }
                
                // Check if we have the required functions
                if (!this.sendMessageToTabs) {
                    console.error('[SEND MESSAGE - Action] CRITICAL: sendMessageToTabs is not available!');
                    break;
                }
                
                // Process template - this can use any message properties, not just chatmessage
                let processedTemplate = config.template || 'Hello from {source}!';
                
                // Replace all occurrences of template variables
                const _src = (message && message.type) || '';
                const _uname = (message && message.chatname) || '';
                const _msg = (message && message.chatmessage) || '';
                processedTemplate = processedTemplate.replace(/\{source\}/g, _src);
                processedTemplate = processedTemplate.replace(/\{type\}/g, _src);
                processedTemplate = processedTemplate.replace(/\{username\}/g, _uname);
                processedTemplate = processedTemplate.replace(/\{chatname\}/g, _uname);
                processedTemplate = processedTemplate.replace(/\{message\}/g, _msg);
                processedTemplate = processedTemplate.replace(/\{chatmessage\}/g, _msg);
                
                // Sanitize the message
                let sanitizedSendMessage = this.sanitizeSendMessage(processedTemplate, true).trim();
                
                // Check if sanitized message is empty
                if (!sanitizedSendMessage) {
                    //console.log('[SEND MESSAGE - Action] Skipping - message empty after processing');
                    break;
                }
                
                // Build message with reflection flag to prevent loops
                const sendMsg = {
                    response: sanitizedSendMessage,
                    reflection: true  // Mark to prevent loops
                };
                
                // Determine send parameters based on destination config
                let reverse = false;
                let relayMode = false;
                
                if (config.destination === 'reply') {
                    // Reply to source: send back to the tab that triggered the event
                    if (message && message.tid !== undefined && message.tid !== null) {
                        sendMsg.tid = message.tid;
                        reverse = false;  // Don't exclude source, we're replying to it
                        relayMode = false;  // Not a broadcast
                        //console.log('[SEND MESSAGE - Action] Mode: Reply to source, tid:', message.tid);
                    } else {
                        console.warn('[SEND MESSAGE - Action] Reply mode selected but no tid available');
                        break;
                    }
                } else if (config.destination === 'all') {
                    // Send to all platforms INCLUDING source
                    reverse = false;  // Don't exclude any tabs
                    relayMode = true;  // This is a broadcast
                    //console.log('[SEND MESSAGE - Action] Mode: Send to all platforms (including source)');
                } else if (config.destination === 'all-except-source') {
                    // Send to all platforms EXCLUDING source
                    reverse = true;  // Exclude source tab
                    relayMode = true;  // This is a broadcast
                    if (message && message.tid) {
                        sendMsg.tid = message.tid;  // Pass source tid for exclusion
                    }
                    //console.log('[SEND MESSAGE - Action] Mode: Send to all platforms (excluding source)');
                } else if (config.destination) {
                    // Send to specific platform/destination
                    sendMsg.destination = config.destination;
                    reverse = true;  // Exclude source tab by default for platform sends
                    relayMode = true;  // This is a broadcast
                    if (message && message.tid) {
                        sendMsg.tid = message.tid;  // Pass source tid for exclusion
                    }
                    //console.log('[SEND MESSAGE - Action] Mode: Send to platform:', config.destination);
                }
                
                const timeout = config.timeout || 1000;
                
                //console.log('[SEND MESSAGE - Action] Calling sendMessageToTabs with:');
                //console.log('  - message:', sendMsg);
                //console.log('  - reverse:', reverse);
                //console.log('  - metadata:', message);
                //console.log('  - relayMode:', relayMode);
                //console.log('  - timeout:', timeout);
                
                const sendResult = this.sendMessageToTabs(sendMsg, reverse, message, relayMode, false, timeout);
                //console.log('[SEND MESSAGE - Action] sendMessageToTabs returned:', sendResult);
                break;
            }
                
            case 'relay': {
                //console.log('[RELAY DEBUG - Action] Starting relay action execution');
                //console.log('[RELAY DEBUG - Action] Config:', config);
                //console.log('[RELAY DEBUG - Action] Message source:', message.type);
                
                // Relay is strictly for forwarding chat messages - MUST have chatmessage
                if (!message || !message.chatmessage || !message.chatmessage.trim()) {
                    //console.log('[RELAY DEBUG - Action] Skipping relay - no chatmessage to relay');
                    break;
                }
                
                // Don't relay reflections to prevent loops
                if (message.reflection) {
                    //console.log('[RELAY DEBUG - Action] Skipping relay - message is a reflection');
                    break;
                }
                
                // Check if we have required functions
                if (!this.sendMessageToTabs) {
                    console.error('[RELAY DEBUG - Action] CRITICAL: sendMessageToTabs is not available!');
                    break;
                }
                
                // Process relay template - focused on forwarding the chat message
                let relayTemplate = config.template || '[{source}] {username}: {message}';
                
                // Replace all occurrences of template variables
                relayTemplate = relayTemplate.replace(/\{source\}/g, message.type || '');
                relayTemplate = relayTemplate.replace(/\{type\}/g, message.type || '');
                relayTemplate = relayTemplate.replace(/\{username\}/g, message.chatname || '');
                relayTemplate = relayTemplate.replace(/\{chatname\}/g, message.chatname || '');
                relayTemplate = relayTemplate.replace(/\{message\}/g, message.chatmessage || '');
                relayTemplate = relayTemplate.replace(/\{chatmessage\}/g, message.chatmessage || '');
                
                // Sanitize the message
                let sanitizedRelayMessage = this.sanitizeRelay ? this.sanitizeRelay(relayTemplate, false).trim() : relayTemplate.trim();
                
                // Check if sanitized message is empty
                if (!sanitizedRelayMessage) {
                    //console.log('[RELAY DEBUG - Action] Skipping relay - message empty after sanitization');
                    break;
                }
                
                // Build relay message with reflection flag to prevent loops
                const relayMessage = {
                    response: sanitizedRelayMessage,
                    reflection: true  // Mark as relayed to prevent infinite loops
                };
                
                // Relay ALWAYS excludes source (never relay back to where it came from)
                let reverse = true;  // Always exclude source
                let relayMode = true;  // Always in relay mode
                
                if (config.destination && config.destination !== 'all') {
                    // Relay to specific platform/destination
                    relayMessage.destination = config.destination;
                    // Pass source tid so reverse=true can exclude the source tab
                    if (message.tid) {
                        relayMessage.tid = message.tid;
                    }
                    //console.log('[RELAY DEBUG - Action] Mode: Relay to specific platform:', config.destination);
                } else {
                    // Relay to all platforms (excluding source)
                    // CRITICAL: Must pass tid for source exclusion to work with reverse=true
                    if (message.tid) {
                        relayMessage.tid = message.tid;
                    }
                    //console.log('[RELAY DEBUG - Action] Mode: Relay to all platforms (excluding source)');
                }
                
                //console.log('[RELAY DEBUG - Action] Relay message prepared:', relayMessage);
                
                const timeout = config.timeout || 1000;
                
                //console.log('[RELAY DEBUG - Action] Calling sendMessageToTabs with:');
                //console.log('  - message:', relayMessage);
                //console.log('  - reverse:', reverse);
                //console.log('  - metadata:', message);
                //console.log('  - relayMode:', relayMode);
                //console.log('  - timeout:', timeout);
                
                const result = this.sendMessageToTabs(relayMessage, reverse, message, relayMode, false, timeout);
                //console.log('[RELAY DEBUG - Action] sendMessageToTabs returned:', result);
                break;
            }
                
            case 'webhook':
				try {
					const url = config.url;
					if (!url) {
						console.warn(`[ExecuteAction - webhook] URL is not configured for node ${actionNode.id}`);
						result.message = { ...message, webhookError: "URL not configured" };
						result.modified = true;
						break;
					}

					const method = config.method || 'POST';
					const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
					const body = config.includeMessage ? JSON.stringify(message) : (config.body || '{}');
					const webhookTimeout = config.timeout || 8000;

					// Prepare fetch options
					const fetchOpts = { method, headers };
					if (method !== 'GET' && method !== 'HEAD') {
						fetchOpts.body = body;
					}

					if (config.syncMode) {
						// Synchronous mode: await and optionally block on failure
						try {
							const response = await this.fetchWithTimeout(url, fetchOpts, webhookTimeout);
							let responseText = '';
							try { responseText = await response.text(); } catch (e) { responseText = ''; }

							if (!response.ok) {
								console.error(`[ExecuteAction - webhook] Webhook for ${url} failed with status ${response.status}: ${responseText}`);
								result.message = { ...message, webhookError: `Webhook failed: ${response.status} - ${responseText.substring(0, 200)}` };
								result.modified = true;
								if (config.blockOnFailure) {
									result.blocked = true;
								}
							} else {
								// Try parse JSON from text; if fails, keep text
								let parsed = null;
								try { parsed = responseText ? JSON.parse(responseText) : null; } catch (e) { parsed = null; }
								if (parsed !== null) {
									result.message = { ...message, webhookResponse: parsed, webhookStatus: response.status };
								} else {
									result.message = { ...message, webhookResponseText: responseText.substring(0, 500), webhookStatus: response.status };
								}
								result.modified = true;
							}
						} catch (err) {
							console.error(`[ExecuteAction - webhook] Error executing webhook for node ${actionNode.id}:`, err.message);
							result.message = { ...message, webhookError: `Webhook execution error: ${err.message}` };
							result.modified = true;
							if (config.blockOnFailure) {
								result.blocked = true;
							}
						}
					} else {
						// Asynchronous mode: fire-and-forget; do not block message processing
						this.fetchWithTimeout(url, fetchOpts, webhookTimeout)
							.then(async (response) => {
								let responseText = '';
								try { responseText = await response.text(); } catch (e) { responseText = ''; }
								if (!response.ok) {
									console.error(`[ExecuteAction - webhook] Webhook for ${url} failed with status ${response.status}: ${responseText}`);
									return;
								}
								// Optionally parse for logging
								try { JSON.parse(responseText); } catch (e) {}
							})
							.catch((error) => {
								console.error(`[ExecuteAction - webhook] Error executing webhook for node ${actionNode.id}:`, error.message);
							});
						// Do not modify or block in async mode
					}

				} catch (error) {
					console.error(`[ExecuteAction - webhook] Unexpected error preparing webhook for node ${actionNode.id}:`, error.message);
				}
				break;
                
            case 'addPoints':
				if (this.pointsSystem && config.amount > 0) {
					const addResult = await this.pointsSystem.addPoints(
						message.chatname,
						message.type,
						config.amount
					);
					
					if (addResult.success) {
						//console.log(`[ExecuteAction - addPoints] Added ${config.amount} points to ${message.chatname}. New total: ${addResult.points}`);
						// You might want to add the new points total to the message for other actions to use
						result.message = { ...message, pointsTotal: addResult.points };
						result.modified = true;
					} else {
						//console.log(`[ExecuteAction - addPoints] Failed to add points for ${message.chatname}. Reason: ${addResult.message || 'Unknown error'}`);
					}
				}
				break;
                
            case 'spendPoints':
				if (this.pointsSystem && config.amount > 0) {
					const spendResult = await this.pointsSystem.spendPoints( // Capture the result
						message.chatname,
						message.type,
						config.amount
					);

					if (!spendResult.success) {
						// If spending points failed (e.g., insufficient points)
						//console.log(`[ExecuteAction - spendPoints] Failed for ${message.chatname}. Reason: ${spendResult.message}`);
						result.blocked = true; // This will stop subsequent actions in this flow path.
						// You might also want to include the error message in the result if needed for debugging or other logic
						result.message = { ...message, pointsSpendError: spendResult.message };
						result.modified = true;
					} else {
						// Points were successfully spent
						//console.log(`[ExecuteAction - spendPoints] Success for ${message.chatname}. Spent ${config.amount}. Remaining: ${spendResult.remaining}`);
						// Optionally, you can add information about the successful transaction to the message
						// result.message = { ...message, pointsSpentSuccessfully: true, pointsRemaining: spendResult.remaining };
						// result.modified = true;
					}
				}
				break;
                
            case 'customJs':
                try {
                    const evalFunction = new Function('message', 'result', config.code);
                    const customResult = evalFunction(message, { ...result });
                    
                    if (customResult && typeof customResult === 'object') {
                        result = {
                            ...result,
                            ...customResult
                        };
                    }
                } catch (e) {
                    console.error('Error in custom JS action:', e);
                }
                break;
				
			case 'playTenorGiphy':
				if (config.mediaUrl) {
					const actionPayload = {
						actionType: 'play_media', // This corresponds to the 'actionType' in actions.html
						url: config.mediaUrl,
						mediaType: config.mediaType || 'iframe',
						duration: config.duration || 10000, // Pass duration to actions.html
						// Positioning and sizing (percent-based)
						width: (typeof config.width === 'number') ? config.width : undefined,
						height: (typeof config.height === 'number') ? config.height : undefined,
						x: (typeof config.x === 'number') ? config.x : undefined,
						y: (typeof config.y === 'number') ? config.y : undefined,
						randomX: !!config.randomX,
						randomY: !!config.randomY
					};
					// Assuming sendTargetP2P is globally available or accessible via this.sendToDestinations
					// or a similar mechanism. The user prompt implies 'sendTargetP2P' is the target function.
					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions'); // 'actions' is the PAGE IDENTIFIER for actions.html
						//console.log('[ExecuteAction - playTenorGiphy] Sent to actions page:', actionPayload);
					} else if (this.sendMessageToTabs) { // Fallback or alternative
						 // Adapt this if sendMessageToTabs can target a specific page by a label/identifier
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true); // Sending to all tabs might not be ideal, adjust if possible
						//console.log('[ExecuteAction - playTenorGiphy] Sent via sendMessageToTabs:', actionPayload);
					} else {
						console.warn('[ExecuteAction - playTenorGiphy] No function available to send message to actions page.');
					}
					// This action usually doesn't modify the message or block it.
					// result.modified = false; result.blocked = false;
				} else {
					console.warn('[ExecuteAction - playTenorGiphy] Media URL not configured.');
				}
				break;

			case 'triggerOBSScene':
				if (config.sceneName) {
					const actionPayload = {
						actionType: 'obs_scene_change',
						sceneName: config.sceneName
					};
					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
						//console.log('[ExecuteAction - triggerOBSScene] Sent to actions page:', actionPayload);
					} else if (this.sendMessageToTabs) {
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true);
						 //console.log('[ExecuteAction - triggerOBSScene] Sent via sendMessageToTabs:', actionPayload);
					} else {
						console.warn('[ExecuteAction - triggerOBSScene] No function available to send message to actions page.');
					}
				} else {
					console.warn('[ExecuteAction - triggerOBSScene] OBS Scene Name not configured.');
				}
				break;

			case 'playAudioClip':
				if (config.audioUrl) {
					const actionPayload = {
						actionType: 'play_audio',
						audioUrl: config.audioUrl,
						volume: config.volume !== undefined ? config.volume : 1.0
					};
					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
						//console.log('[ExecuteAction - playAudioClip] Sent to actions page:', actionPayload);
					} else if (this.sendMessageToTabs) {
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true);
						//console.log('[ExecuteAction - playAudioClip] Sent via sendMessageToTabs:', actionPayload);
					} else {
						console.warn('[ExecuteAction - playAudioClip] No function available to send message to actions page.');
					}
				} else {
					console.warn('[ExecuteAction - playAudioClip] Audio URL not configured.');
				}
				break;
                
            case 'delay':
                // Delay the message by specified milliseconds
                if (config.delayMs && typeof config.delayMs === 'number') {
                    await new Promise(resolve => setTimeout(resolve, config.delayMs));
                }
                break;
            
            // OBS Browser Source API Actions
            case 'obsChangeScene':
                if (config.sceneName) {
                    const actionPayload = {
                        actionType: 'obsChangeScene',
                        sceneName: config.sceneName
                    };
                    
                    if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                        this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
                    } else {
                        console.warn('[OBS] sendTargetP2P not available on this instance');
                    }
                }
                break;
                
            case 'obsToggleSource':
                if (config.sourceName) {
                    const actionPayload = {
                        actionType: 'obsToggleSource',
                        sourceName: config.sourceName,
                        visible: config.visible
                    };
                    
                    if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                        this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
                    } else {
                        console.warn('[OBS] sendTargetP2P not available on this instance');
                    }
                }
                break;
            
            case 'obsSetSourceFilter':
                if (config.sourceName && config.filterName) {
                    const actionPayload = {
                        actionType: 'obsSetSourceFilter',
                        sourceName: config.sourceName,
                        filterName: config.filterName,
                        enabled: config.enabled
                    };
                    
                    if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                        this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
                    } else {
                        console.warn('[OBS] sendTargetP2P not available on this instance');
                    }
                }
                break;
            
            case 'obsMuteSource':
                if (config.sourceName) {
                    const actionPayload = {
                        actionType: 'obsMuteSource',
                        sourceName: config.sourceName,
                        muted: config.muted
                    };
                    
                    if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                        this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
                    } else {
                        console.warn('[OBS] sendTargetP2P not available on this instance');
                    }
                }
                break;
                
            case 'obsStartRecording':
                const startRecordingPayload = {
                    actionType: 'obsStartRecording'
                };
                
                if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                    this.sendTargetP2P({ overlayNinja: startRecordingPayload }, 'actions');
                } else {
                    console.warn('[OBS] sendTargetP2P not available');
                }
                break;
                
            case 'obsStopRecording':
                const stopRecordingPayload = {
                    actionType: 'obsStopRecording'
                };
                
                if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                    this.sendTargetP2P({ overlayNinja: stopRecordingPayload }, 'actions');
                } else {
                    console.warn('[OBS] sendTargetP2P not available');
                }
                break;
                
            case 'obsStartStreaming':
                const startStreamingPayload = {
                    actionType: 'obsStartStreaming'
                };
                
                if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                    this.sendTargetP2P({ overlayNinja: startStreamingPayload }, 'actions');
                } else {
                    console.warn('[OBS] sendTargetP2P not available');
                }
                break;
                
            case 'obsStopStreaming':
                const stopStreamingPayload = {
                    actionType: 'obsStopStreaming'
                };
                
                if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                    this.sendTargetP2P({ overlayNinja: stopStreamingPayload }, 'actions');
                } else {
                    console.warn('[OBS] sendTargetP2P not available');
                }
                break;
                
            case 'obsReplayBuffer':
                const replayBufferPayload = {
                    actionType: 'obsReplayBuffer'
                };
                
                if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                    this.sendTargetP2P({ overlayNinja: replayBufferPayload }, 'actions');
                } else {
                    console.warn('[OBS] sendTargetP2P not available');
                }
                break;
                
            case 'midiSendNote':
                if (!this.midiEnabled || !config.deviceId || !config.note) break;
                
                const noteOutput = this.getMIDIOutputDevice(config.deviceId);
                if (noteOutput) {
                    const velocity = config.velocity || 127;
                    const duration = config.duration || 100;
                    const channel = config.channel || 1;
                    
                    try {
                        noteOutput.playNote(config.note, channel, {
                            velocity: velocity / 127,
                            duration: duration
                        });
                        console.log(`[MIDI] Sent note ${config.note} to device ${config.deviceId}`);
                    } catch (err) {
                        console.error('[MIDI] Error sending note:', err);
                    }
                }
                break;
                
            case 'midiSendCC':
                if (!this.midiEnabled || !config.deviceId || config.controller === undefined) break;
                
                const ccOutput = this.getMIDIOutputDevice(config.deviceId);
                if (ccOutput) {
                    const value = config.value || 0;
                    const channel = config.channel || 1;
                    
                    try {
                        ccOutput.sendControlChange(config.controller, value, channel);
                        console.log(`[MIDI] Sent CC ${config.controller}:${value} to device ${config.deviceId}`);
                    } catch (err) {
                        console.error('[MIDI] Error sending CC:', err);
                    }
                }
                break;
                
            case 'setGateState':
                // Set the state of a gate node (ALLOW or BLOCK)
                if (config.targetNodeId && config.state) {
                    const targetState = this.nodeStates.get(config.targetNodeId);
                    if (targetState) {
                        targetState.state = config.state; // 'ALLOW' or 'BLOCK'
                        console.log(`[SetGateState] Gate ${config.targetNodeId} set to ${config.state}`);
                    }
                }
                break;
                
            case 'resetStateNode':
                // Reset any state node to its initial state
                if (config.targetNodeId) {
                    // Find the node to get its type
                    const allFlows = this.flows || [];
                    let targetNode = null;
                    
                    for (const flow of allFlows) {
                        targetNode = flow.nodes?.find(n => n.id === config.targetNodeId);
                        if (targetNode) break;
                    }
                    
                    if (targetNode && targetNode.type === 'state') {
                        this.initializeStateNode(config.targetNodeId, targetNode.stateType, targetNode.config || {});
                        console.log(`[ResetStateNode] State node ${config.targetNodeId} reset`);
                    }
                }
                break;
                
            case 'setCounter':
                // Set counter to specific value
                if (config.targetNodeId && config.value !== undefined) {
                    const counterState = this.nodeStates.get(config.targetNodeId);
                    if (counterState && counterState.hasOwnProperty('count')) {
                        counterState.count = config.value;
                        console.log(`[SetCounter] Counter ${config.targetNodeId} set to ${config.value}`);
                    }
                }
                break;
                
            case 'incrementCounter':
                // Increment or decrement counter
                if (config.targetNodeId) {
                    const counterState = this.nodeStates.get(config.targetNodeId);
                    if (counterState && counterState.hasOwnProperty('count')) {
                        const delta = config.delta || 1;
                        counterState.count += delta;
                        console.log(`[IncrementCounter] Counter ${config.targetNodeId} changed by ${delta} to ${counterState.count}`);
                    }
                }
                break;
                
            case 'checkCounter':
                // Check counter value and optionally modify message
                if (config.targetNodeId) {
                    const counterState = this.nodeStates.get(config.targetNodeId);
                    if (counterState && counterState.hasOwnProperty('count')) {
                        // Add counter info to message
                        result.message = {
                            ...message,
                            counterValue: counterState.count,
                            counterTarget: counterState.targetCount
                        };
                        result.modified = true;
                        console.log(`[CheckCounter] Counter ${config.targetNodeId} value: ${counterState.count}`);
                    }
                }
                break;
                
            case 'removeText':
                if (message.chatmessage && config.removeType) {
                    let newMessage = message.chatmessage;
                    
                    switch (config.removeType) {
                        case 'removeFirst':
                            // Remove first character only
                            if (config.count && typeof config.count === 'number') {
                                newMessage = newMessage.substring(config.count);
                            } else {
                                newMessage = newMessage.substring(1);
                            }
                            break;
                            
                        case 'removeCommand':
                            // Remove entire first word (command)
                            const firstSpaceIndex = newMessage.indexOf(' ');
                            if (firstSpaceIndex !== -1) {
                                newMessage = newMessage.substring(firstSpaceIndex + 1);
                            } else {
                                // If no space, remove entire message (it's just the command)
                                newMessage = '';
                            }
                            break;
                            
                        case 'removeUntil':
                            // Remove everything up to and including a specific string
                            if (config.untilText) {
                                const index = newMessage.indexOf(config.untilText);
                                if (index !== -1) {
                                    newMessage = newMessage.substring(index + config.untilText.length);
                                }
                            }
                            break;
                            
                        case 'removePrefix':
                            // Remove a specific prefix if it exists
                            if (config.prefix && newMessage.startsWith(config.prefix)) {
                                newMessage = newMessage.substring(config.prefix.length);
                            }
                            break;
                            
                        case 'trimWhitespace':
                            // Remove leading/trailing whitespace
                            newMessage = newMessage.trim();
                            break;
                    }
                    
                    result.message = {
                        ...message,
                        chatmessage: newMessage
                    };
                    result.modified = true;
                }
                break;
                
            default:
                break;
        }
        
        return result;
    }
}
