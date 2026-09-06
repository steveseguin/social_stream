class EventFlowSystem {
    constructor(options = {}) {
        this.flows = [];
        this.db = null;
        this.dbName = options.dbName || 'eventFlowDB';
        this.storeName = options.storeName || 'flowSettings';
        this.userMemoryStoreName = options.userMemoryStoreName || 'userMemoryState';
        this.pointsSystem = options.pointsSystem || null;
        // Prefer helpers from background.js when available so both surfaces share behavior
        this.sendMessageToTabs = options.sendMessageToTabs || window.sendMessageToTabs || null;
        this.sendToDestinations = options.sendToDestinations || window.sendToDestinations || null;
        this.fetchWithTimeout = options.fetchWithTimeout || window.fetchWithTimeout || window.fetch; // Fallback to window.fetch if not provided
        this.sanitizeRelay = options.sanitizeRelay || window.sanitizeRelay || null;
		this.checkExactDuplicateAlreadyRelayed = options.checkExactDuplicateAlreadyRelayed || window.checkExactDuplicateAlreadyRelayed || null;
		this.sendTargetP2P = options.sendTargetP2P || window.sendTargetP2P || null;
		this.printThermal = options.printThermal || window.printThermal || null;
		// For sending messages to background.js (e.g., Spotify actions)
		this.sendMessageToBackground = options.sendMessageToBackground || ((msg) => {
			if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
				chrome.runtime.sendMessage(msg).catch(err => console.warn('[EventFlow] sendMessageToBackground error:', err));
			}
		});
		this.messageStore = options.messageStore || window.messageStore || {}; // Share message store from background.js
		this.handleMessageStore = options.handleMessageStore || window.handleMessageStore || null; // Function to handle message storage
		this.allowEvalCustomJs = (typeof options.allowEvalCustomJs === 'boolean')
			? options.allowEvalCustomJs
			: this.detectCustomJsEvalSupport();
		this.customJsEvalSupported = this.allowEvalCustomJs; // alias used by EventFlowEditor
		this.customJsEvalWarningShown = false;
		
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

        // Named User Memory state. Each USER_MEMORY node owns an isolated set of users.
        this.userMemoryStates = new Map();
        this.userMemoryResetTimers = new Map();
        this.userMemorySaveTimers = new Map();
        this.userMemoryBroadcastTimers = new Map();
        this.userMemoryListeners = new Set();
        this.userMemoryInstanceId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        this.userMemoryChannel = null;
        this.setupUserMemorySync();
        
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

    parseDonationNumericValue(value) {
        if (value === undefined || value === null || value === '') return null;
        if (typeof value === 'number') return isFinite(value) ? value : null;

        const text = String(value).replace(/,/g, '');
        const match = text.match(/[+-]?(?:\d+\.?\d*|\.\d+)/);
        if (!match) return null;

        const parsed = parseFloat(match[0]);
        return isFinite(parsed) ? parsed : null;
    }

    getDonationValueConverter() {
        try {
            if (typeof convertToUSD === 'function') return convertToUSD;
        } catch (e) {}

        try {
            if (typeof window !== 'undefined' && typeof window.convertToUSD === 'function') {
                return window.convertToUSD;
            }
        } catch (e) {}

        return null;
    }

    parseDonationLabelValue(value, source) {
        if (value === undefined || value === null || value === '') return null;
        if (typeof value === 'number') return isFinite(value) ? value : null;

        // Donation values are derived only from normalized amount labels such as "$5",
        // "500 bits", or "cheer100"; never from prose in chatmessage.
        const text = String(value);
        if (!/[+-]?(?:\d+\.?\d*|\.\d+)/.test(text.replace(/,/g, ''))) {
            return null;
        }

        const converter = this.getDonationValueConverter();
        if (converter) {
            try {
                const converted = converter(text, String(source || '').toLowerCase());
                if (typeof converted === 'number' && isFinite(converted)) {
                    return converted;
                }
            } catch (e) {}
        }

        return this.parseDonationNumericValue(value);
    }

    getDonationNumericValue(message) {
        if (!message) return null;

        const explicitValue = this.parseDonationNumericValue(message.donoValue);
        if (explicitValue !== null) return explicitValue;

        const legacyValue = this.parseDonationLabelValue(message.donationAmount, message.type);
        if (legacyValue !== null) return legacyValue;

        const labelValue = this.parseDonationLabelValue(message.hasDonation, message.type);
        if (labelValue !== null) return labelValue;

        return null;
    }

	detectCustomJsEvalSupport() {
		try {
			if (typeof isSSAPP !== 'undefined' && isSSAPP) return true;
			if (typeof window !== 'undefined' && (
				window.ssapp === true ||
				window.ninjafy ||
				window.electronApi
			)) return true;
			if (typeof window !== 'undefined' && window.location && typeof window.location.search === 'string') {
				const params = new URLSearchParams(window.location.search || '');
				if (params.has('ssapp')) return true;
			}
		} catch (error) {
			// ignore and continue to extension detection
		}

		// MV3 extension pages do not allow dynamic eval/new Function under default CSP.
		try {
			if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
				return false;
			}
		} catch (error) {
			// If this check fails, fall through to default allow.
		}

		return true;
	}

	warnCustomJsEvalDisabled(scope = 'customJs') {
		if (this.customJsEvalWarningShown) return;
		this.customJsEvalWarningShown = true;
		console.warn(`[EventFlowSystem] ${scope} is disabled in extension context due CSP (unsafe-eval not allowed). Use SSApp/Electron or a runtime addon.`);
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

		// Clear existing listeners - store input reference to ensure proper cleanup
		this.midiListeners.forEach((listenerData, key) => {
			const { input, eventType, listener } = listenerData;
			// Try to remove from the stored input reference (works even if device still connected)
			try {
				if (input && typeof input.removeListener === 'function') {
					input.removeListener(eventType, 'all', listener);
				}
			} catch (e) {
				console.debug('Could not remove MIDI listener:', e);
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
				let eventType = null;
				const listenerKey = `${node.config.deviceId}|${node.triggerType}`;

				switch (node.triggerType) {
					case 'midiNoteOn':
						eventType = 'noteon';
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
						input.addListener(eventType, 'all', listener);
						break;

					case 'midiNoteOff':
						eventType = 'noteoff';
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
						input.addListener(eventType, 'all', listener);
						break;

					case 'midiCC':
						eventType = 'controlchange';
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
						input.addListener(eventType, 'all', listener);
						break;
				}

				if (listener && eventType) {
					// Store input reference along with listener for proper cleanup
					this.midiListeners.set(listenerKey, { input, eventType, listener });
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
	
	async evaluateSpecificLogicNode(logicType, inputValues, nodeConfig, message = null) {
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
                const probability = (nodeConfig && nodeConfig.probability) ?? 50;
                const roll = Math.random() * 100;

                // Pass the input through if roll succeeds, otherwise block it
                return roll < probability;
            case 'CHECK_BAD_WORDS':
                // Check if message contains bad words (set by background.js)
                // Only evaluate if we have an active input (message is flowing through)
                if (!inputValues.some(v => v === true)) return false;
                if (!message) return false;
                return !!message.containsBadWords;
            default:
                return false;
        }
    }
    
    setupUserMemorySync() {
        if (typeof BroadcastChannel === 'undefined') return;

        try {
            this.userMemoryChannel = new BroadcastChannel(`social-stream-event-flow-state:${this.dbName}`);
            this.userMemoryChannel.onmessage = event => {
                const data = event && event.data;
                if (!data || data.sourceInstanceId === this.userMemoryInstanceId) return;

                if (data.kind === 'request-user-memory-state') {
                    this.userMemoryStates.forEach(state => {
                        this.userMemoryChannel.postMessage({
                            kind: 'user-memory-state',
                            sourceInstanceId: this.userMemoryInstanceId,
                            targetInstanceId: data.sourceInstanceId,
                            snapshot: this.serializeUserMemoryState(state)
                        });
                    });
                    return;
                }

                if (data.kind !== 'user-memory-state') return;
                if (data.targetInstanceId && data.targetInstanceId !== this.userMemoryInstanceId) return;
                this.applyUserMemorySnapshot(data.snapshot);
            };

            setTimeout(() => this.requestUserMemorySnapshots(), 0);
        } catch (error) {
            this.userMemoryChannel = null;
            console.warn('[UserMemory] State synchronization is unavailable:', error && error.message ? error.message : error);
        }
    }

    requestUserMemorySnapshots() {
        if (!this.userMemoryChannel) return;
        try {
            this.userMemoryChannel.postMessage({
                kind: 'request-user-memory-state',
                sourceInstanceId: this.userMemoryInstanceId
            });
        } catch (error) {
            console.warn('[UserMemory] Unable to request state snapshots:', error && error.message ? error.message : error);
        }
    }

    subscribeUserMemory(listener) {
        if (typeof listener !== 'function') return () => {};
        this.userMemoryListeners.add(listener);
        return () => this.userMemoryListeners.delete(listener);
    }

    notifyUserMemoryListeners(state, reason) {
        const snapshot = this.serializeUserMemoryState(state);
        this.userMemoryListeners.forEach(listener => {
            try {
                listener(snapshot, reason || 'update');
            } catch (error) {
                console.warn('[UserMemory] State listener failed:', error && error.message ? error.message : error);
            }
        });
    }

    getUserMemoryStateKey(flowOrId, nodeId) {
        const flowId = typeof flowOrId === 'object' && flowOrId
            ? flowOrId.id
            : flowOrId;
        return `${flowId || 'draft'}::${nodeId}`;
    }

    resolveUserMemoryTarget(targetNodeId, flow = null) {
        if (!targetNodeId) return null;

        if (flow && Array.isArray(flow.nodes)) {
            const node = flow.nodes.find(candidate => candidate.id === targetNodeId && candidate.type === 'state' && candidate.stateType === 'USER_MEMORY');
            if (node) {
                return { node, flow, flowId: flow.id || 'draft' };
            }
        }

        for (const candidateFlow of this.flows || []) {
            if (!candidateFlow || !Array.isArray(candidateFlow.nodes)) continue;
            const node = candidateFlow.nodes.find(candidate => candidate.id === targetNodeId && candidate.type === 'state' && candidate.stateType === 'USER_MEMORY');
            if (node) {
                return { node, flow: candidateFlow, flowId: candidateFlow.id || 'draft' };
            }
        }

        return null;
    }

    createUserMemoryState(target) {
        const config = target.node.config || {};
        return {
            id: this.getUserMemoryStateKey(target.flowId, target.node.id),
            flowId: target.flowId,
            nodeId: target.node.id,
            name: config.name || 'User Memory',
            persistence: config.persistence === 'persistent' ? 'persistent' : 'session',
            resetAfterMs: Math.max(0, Number(config.resetAfterMs) || 0),
            entries: new Map(),
            lastActivity: 0,
            lastResetAt: 0,
            updatedAt: 0,
            loaded: config.persistence !== 'persistent',
            loadPromise: null
        };
    }

    serializeUserMemoryState(state) {
        if (!state) return null;
        return {
            id: state.id,
            flowId: state.flowId,
            nodeId: state.nodeId,
            name: state.name || 'User Memory',
            persistence: state.persistence === 'persistent' ? 'persistent' : 'session',
            resetAfterMs: Math.max(0, Number(state.resetAfterMs) || 0),
            entries: Array.from(state.entries instanceof Map ? state.entries.values() : []),
            count: state.entries instanceof Map ? state.entries.size : 0,
            lastActivity: Number(state.lastActivity) || 0,
            lastResetAt: Number(state.lastResetAt) || 0,
            updatedAt: Number(state.updatedAt) || 0
        };
    }

    applyUserMemorySnapshot(snapshot) {
        if (!snapshot || !snapshot.id || !snapshot.nodeId) return null;

        let state = this.userMemoryStates.get(snapshot.id);
        if (state && Number(state.updatedAt) > Number(snapshot.updatedAt || 0)) {
            return state;
        }

        if (!state) {
            state = {
                id: snapshot.id,
                flowId: snapshot.flowId || 'draft',
                nodeId: snapshot.nodeId,
                entries: new Map(),
                loaded: true,
                loadPromise: null
            };
            this.userMemoryStates.set(snapshot.id, state);
        }

        const entries = new Map();
        if (Array.isArray(snapshot.entries)) {
            snapshot.entries.forEach(entry => {
                if (!entry || !entry.key) return;
                entries.set(String(entry.key), { ...entry, key: String(entry.key) });
            });
        }

        state.flowId = snapshot.flowId || state.flowId || 'draft';
        state.nodeId = snapshot.nodeId;
        state.name = snapshot.name || state.name || 'User Memory';
        state.persistence = snapshot.persistence === 'persistent' ? 'persistent' : 'session';
        state.resetAfterMs = Math.max(0, Number(snapshot.resetAfterMs) || 0);
        state.entries = entries;
        state.lastActivity = Number(snapshot.lastActivity) || 0;
        state.lastResetAt = Number(snapshot.lastResetAt) || 0;
        state.updatedAt = Number(snapshot.updatedAt) || 0;
        state.loaded = true;

        this.scheduleUserMemoryReset(state);
        this.notifyUserMemoryListeners(state, 'sync');
        return state;
    }

    async loadPersistentUserMemoryState(state) {
        try {
            const db = await this.ensureDB();
            if (!db || !db.objectStoreNames || !db.objectStoreNames.contains(this.userMemoryStoreName)) return null;

            return await new Promise(resolve => {
                const transaction = db.transaction(this.userMemoryStoreName, 'readonly');
                const request = transaction.objectStore(this.userMemoryStoreName).get(state.id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            });
        } catch (error) {
            console.warn('[UserMemory] Unable to load saved state:', error && error.message ? error.message : error);
            return null;
        }
    }

    async savePersistentUserMemoryState(state) {
        if (!state || state.persistence !== 'persistent') return;

        try {
            const db = await this.ensureDB();
            if (!db || !db.objectStoreNames || !db.objectStoreNames.contains(this.userMemoryStoreName)) return;
            const record = this.serializeUserMemoryState(state);

            await new Promise(resolve => {
                const transaction = db.transaction(this.userMemoryStoreName, 'readwrite');
                transaction.objectStore(this.userMemoryStoreName).put(record);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => resolve();
                transaction.onabort = () => resolve();
            });
        } catch (error) {
            console.warn('[UserMemory] Unable to save state:', error && error.message ? error.message : error);
        }
    }

    async deletePersistentUserMemoriesForFlow(flowId) {
        if (!flowId) return;
        try {
            const db = await this.ensureDB();
            if (!db || !db.objectStoreNames || !db.objectStoreNames.contains(this.userMemoryStoreName)) return;
            await new Promise(resolve => {
                const transaction = db.transaction(this.userMemoryStoreName, 'readwrite');
                const store = transaction.objectStore(this.userMemoryStoreName);
                const request = store.openCursor();
                request.onsuccess = event => {
                    const cursor = event.target.result;
                    if (!cursor) return;
                    if (cursor.value && String(cursor.value.flowId) === String(flowId)) {
                        cursor.delete();
                    }
                    cursor.continue();
                };
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => resolve();
                transaction.onabort = () => resolve();
            });
        } catch (error) {
            console.warn('[UserMemory] Unable to remove saved flow state:', error && error.message ? error.message : error);
        }
    }

    queueUserMemorySave(state) {
        if (!state || state.persistence !== 'persistent') return;
        if (this.userMemorySaveTimers.has(state.id)) {
            clearTimeout(this.userMemorySaveTimers.get(state.id));
        }
        const timer = setTimeout(() => {
            this.userMemorySaveTimers.delete(state.id);
            this.savePersistentUserMemoryState(state);
        }, 150);
        this.userMemorySaveTimers.set(state.id, timer);
    }

    queueUserMemoryBroadcast(state) {
        if (!this.userMemoryChannel || !state) return;
        if (this.userMemoryBroadcastTimers.has(state.id)) {
            clearTimeout(this.userMemoryBroadcastTimers.get(state.id));
        }
        const timer = setTimeout(() => {
            this.userMemoryBroadcastTimers.delete(state.id);
            try {
                this.userMemoryChannel.postMessage({
                    kind: 'user-memory-state',
                    sourceInstanceId: this.userMemoryInstanceId,
                    snapshot: this.serializeUserMemoryState(state)
                });
            } catch (error) {
                console.warn('[UserMemory] Unable to synchronize state:', error && error.message ? error.message : error);
            }
        }, 30);
        this.userMemoryBroadcastTimers.set(state.id, timer);
    }

    commitUserMemoryState(state, reason) {
        if (!state) return;
        state.updatedAt = Date.now();
        this.scheduleUserMemoryReset(state);
        this.queueUserMemorySave(state);
        this.queueUserMemoryBroadcast(state);
        this.notifyUserMemoryListeners(state, reason || 'update');
    }

    scheduleUserMemoryReset(state) {
        if (!state) return;
        if (this.userMemoryResetTimers.has(state.id)) {
            clearTimeout(this.userMemoryResetTimers.get(state.id));
            this.userMemoryResetTimers.delete(state.id);
        }

        const resetAfterMs = Math.max(0, Number(state.resetAfterMs) || 0);
        if (!resetAfterMs || !state.lastActivity) return;

        const remaining = Math.max(0, resetAfterMs - (Date.now() - state.lastActivity));
        const timer = setTimeout(() => {
            this.userMemoryResetTimers.delete(state.id);
            this.clearUserMemoryState(state, 'inactivity');
        }, remaining);
        this.userMemoryResetTimers.set(state.id, timer);
    }

    async ensureUserMemoryState(target) {
        if (!target || !target.node) return null;
        const key = this.getUserMemoryStateKey(target.flowId, target.node.id);
        let state = this.userMemoryStates.get(key);
        if (!state) {
            state = this.createUserMemoryState(target);
            this.userMemoryStates.set(key, state);
        }

        const config = target.node.config || {};
        state.name = config.name || state.name || 'User Memory';
        state.persistence = config.persistence === 'persistent' ? 'persistent' : 'session';
        state.resetAfterMs = Math.max(0, Number(config.resetAfterMs) || 0);

        if (state.persistence === 'persistent' && !state.loaded) {
            if (!state.loadPromise) {
                state.loadPromise = this.loadPersistentUserMemoryState(state).then(record => {
                    if (record && Number(record.updatedAt || 0) >= Number(state.updatedAt || 0)) {
                        this.applyUserMemorySnapshot(record);
                    }
                    const current = this.userMemoryStates.get(key) || state;
                    current.loaded = true;
                    current.loadPromise = null;
                    return current;
                });
            }
            state = await state.loadPromise;
        } else {
            state.loaded = true;
        }

        if (state.resetAfterMs > 0 && state.lastActivity && Date.now() - state.lastActivity >= state.resetAfterMs) {
            await this.clearUserMemoryState(state, 'inactivity');
        } else {
            this.scheduleUserMemoryReset(state);
        }

        return state;
    }

    normalizeUserMemoryEntry(message) {
        if (!message || typeof message !== 'object') return null;
        const meta = message.meta && typeof message.meta === 'object' && !Array.isArray(message.meta) ? message.meta : {};
        const displayName = String(message.chatname || message.displayname || message.username || '').trim();
        const rawUserId = message.userid ?? message.username ?? meta.uniqueId ?? meta.userId ?? meta.userid ?? displayName;
        const normalizedUserId = String(rawUserId || '').trim().replace(/^@/, '').toLowerCase();
        if (!normalizedUserId) return null;

        const source = String(message.type || message.platform || 'unknown').trim().toLowerCase() || 'unknown';
        return {
            key: `${source}:${normalizedUserId}`,
            userid: String(rawUserId || '').trim(),
            chatname: displayName || String(rawUserId || '').trim(),
            type: source,
            chatimg: String(message.chatimg || ''),
            event: typeof message.event === 'string' ? message.event : '',
            firstSeenAt: Date.now(),
            lastSeenAt: Date.now(),
            participationCount: 1,
            reason: ''
        };
    }

    async rememberUserInMemory(targetNodeId, message, flow = null, reason = '') {
        const target = this.resolveUserMemoryTarget(targetNodeId, flow);
        if (!target) return { success: false, error: 'User Memory target not found' };
        const entry = this.normalizeUserMemoryEntry(message);
        if (!entry) return { success: false, error: 'The event does not include a user identity' };

        const state = await this.ensureUserMemoryState(target);
        const existing = state.entries.get(entry.key);
        const now = Date.now();
        const cleanReason = String(reason || '').trim().slice(0, 500);

        if (existing) {
            state.entries.set(entry.key, {
                ...existing,
                chatname: entry.chatname || existing.chatname,
                userid: entry.userid || existing.userid,
                chatimg: entry.chatimg || existing.chatimg,
                event: entry.event || existing.event,
                lastSeenAt: now,
                participationCount: (Number(existing.participationCount) || 1) + 1,
                reason: cleanReason || existing.reason || ''
            });
        } else {
            state.entries.set(entry.key, {
                ...entry,
                firstSeenAt: now,
                lastSeenAt: now,
                reason: cleanReason
            });
        }

        state.lastActivity = now;
        this.commitUserMemoryState(state, existing ? 'remember-again' : 'remember');
        const storedEntry = state.entries.get(entry.key);
        return {
            success: true,
            added: !existing,
            entry: { ...storedEntry },
            count: state.entries.size,
            name: state.name
        };
    }

    async forgetUserFromMemory(targetNodeId, message, flow = null) {
        const target = this.resolveUserMemoryTarget(targetNodeId, flow);
        if (!target) return { success: false, error: 'User Memory target not found' };
        const entry = this.normalizeUserMemoryEntry(message);
        if (!entry) return { success: false, error: 'The event does not include a user identity' };

        const state = await this.ensureUserMemoryState(target);
        const removed = state.entries.delete(entry.key);
        if (removed) {
            state.lastActivity = Date.now();
            this.commitUserMemoryState(state, 'forget');
        }
        return { success: true, removed, count: state.entries.size, name: state.name };
    }

    async clearUserMemoryState(state, reason = 'clear') {
        if (!state) return { success: false, error: 'User Memory state not found' };
        const clearedCount = state.entries instanceof Map ? state.entries.size : 0;
        if (!(state.entries instanceof Map)) state.entries = new Map();
        state.entries.clear();
        state.lastActivity = 0;
        state.lastResetAt = Date.now();
        this.commitUserMemoryState(state, reason);
        return { success: true, clearedCount, count: 0, name: state.name };
    }

    async clearUserMemory(targetNodeId, flow = null, reason = 'clear') {
        const target = this.resolveUserMemoryTarget(targetNodeId, flow);
        if (!target) return { success: false, error: 'User Memory target not found' };
        const state = await this.ensureUserMemoryState(target);
        return this.clearUserMemoryState(state, reason);
    }

    async isUserRemembered(targetNodeId, message, flow = null) {
        const target = this.resolveUserMemoryTarget(targetNodeId, flow);
        if (!target) return false;
        const entry = this.normalizeUserMemoryEntry(message);
        if (!entry) return false;
        const state = await this.ensureUserMemoryState(target);
        return state.entries.has(entry.key);
    }

    getSecureRandomIndex(length) {
        const size = Math.max(0, Math.floor(Number(length) || 0));
        if (!size) return -1;

        try {
            const cryptoApi = typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function'
                ? crypto
                : (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function' ? window.crypto : null);
            if (cryptoApi) {
                const range = 0x100000000;
                const limit = range - (range % size);
                const values = new Uint32Array(1);
                do {
                    cryptoApi.getRandomValues(values);
                } while (values[0] >= limit);
                return values[0] % size;
            }
        } catch (error) {}

        return Math.floor(Math.random() * size);
    }

    async pickRandomUserFromMemory(targetNodeId, flow = null, removeSelected = false) {
        const target = this.resolveUserMemoryTarget(targetNodeId, flow);
        if (!target) return { success: false, error: 'User Memory target not found' };
        const state = await this.ensureUserMemoryState(target);
        const entries = Array.from(state.entries.values());
        if (!entries.length) {
            return { success: false, empty: true, error: 'User Memory is empty', count: 0, name: state.name };
        }

        const selected = entries[this.getSecureRandomIndex(entries.length)];
        if (removeSelected && selected) {
            state.entries.delete(selected.key);
            state.lastActivity = Date.now();
            this.commitUserMemoryState(state, 'pick-and-remove');
        }

        return {
            success: true,
            entry: { ...selected },
            removed: !!removeSelected,
            count: state.entries.size,
            name: state.name
        };
    }

    getUserMemorySummary(targetNodeId, flow = null) {
        const target = this.resolveUserMemoryTarget(targetNodeId, flow);
        if (!target) return null;
        const key = this.getUserMemoryStateKey(target.flowId, target.node.id);
        const state = this.userMemoryStates.get(key);
        if (!state) {
            return {
                id: key,
                flowId: target.flowId,
                nodeId: target.node.id,
                name: target.node.config?.name || 'User Memory',
                count: 0,
                loaded: target.node.config?.persistence !== 'persistent'
            };
        }
        return { ...this.serializeUserMemoryState(state), loaded: state.loaded !== false };
    }

    async resetUserMemoriesForEvent(message) {
        const eventType = String(message && message.event || '').toLowerCase();
        const isStart = eventType === 'stream_started' || eventType === 'stream_online';
        const isStop = eventType === 'stream_stopped' || eventType === 'stream_offline';
        if (!isStart && !isStop) return;

        const resets = [];
        for (const flow of this.flows || []) {
            if (!flow || !Array.isArray(flow.nodes)) continue;
            for (const node of flow.nodes) {
                if (!node || node.type !== 'state' || node.stateType !== 'USER_MEMORY') continue;
                const config = node.config || {};
                if ((isStart && config.resetOnStreamStart) || (isStop && config.resetOnStreamStop)) {
                    resets.push(this.clearUserMemory(node.id, flow, isStart ? 'stream-start' : 'stream-stop'));
                }
            }
        }
        await Promise.all(resets);
    }

    // Evaluate state nodes (Gate, Queue, Semaphore, etc.)
    async evaluateStateNode(node, message, inputActive, flow = null) {
        const nodeId = node.id;
        const stateType = node.stateType;
        const config = node.config || {};

        // USER_MEMORY is a shared state resource. It is queried through the
        // User Is Remembered trigger and changed by User Memory actions.
        if (stateType === 'USER_MEMORY') {
            const target = {
                node,
                flow,
                flowId: flow && flow.id ? flow.id : 'draft'
            };
            await this.ensureUserMemoryState(target);
            return { active: false, passMessage: false, modifiedMessage: null };
        }
        
        // Initialize state if it doesn't exist
        const stateStore = stateType === 'SEMAPHORE' ? this.semaphoreStates
            : stateType === 'THROTTLE' ? this.throttleStates : this.nodeStates;
        if (!stateStore.has(nodeId)) {
            this.initializeStateNode(nodeId, stateType, config);
        }

		// Keep editable counter settings current without resetting the live count.
		// Previously, target/mode changes only took effect after creating a new node.
		if (stateType === 'COUNTER') {
			const counterState = this.nodeStates.get(nodeId);
			if (counterState) {
				counterState.targetCount = config.targetCount !== undefined ? config.targetCount : 10;
				counterState.resetOnTarget = config.resetOnTarget !== false;
				counterState.mode = config.mode || 'INCREMENT';
			}
		}
        
        // Return object includes both activation state and whether to pass message
        let result = { active: false, passMessage: false, modifiedMessage: null };
        
        switch (stateType) {
            case 'GATE':
                result = this.evaluateGateNode(nodeId, config, message, inputActive);
                break;
                
            case 'QUEUE':
                result = this.evaluateQueueNode(nodeId, config, message, inputActive, flow);
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
        this.clearStateNode(nodeId);
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
    evaluateQueueNode(nodeId, config, message, inputActive, flow = null) {
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
                        return { active: false, passMessage: false };
                    case 'DROP_RANDOM':
                        const randomIndex = Math.floor(Math.random() * queue.length);
                        queue.splice(randomIndex, 1);
                        break;
                    default:
                        return { active: false, passMessage: false };
                }
            }
            
            // Add message with timestamp
            queue.push({
                message: { ...message },
                timestamp: Date.now()
            });
            this.messageQueues.set(nodeId, queue);
        }
        
        if (config.autoDequeue && !state.processing && !this.stateTimers.has(nodeId)
            && Date.now() - state.lastProcessTime >= (Number(config.processingDelayMs) || 0)) {
            const item = this.takeQueueMessage(nodeId, config);
            if (item) {
                state.lastProcessTime = Date.now();
                this.scheduleQueueDrain(nodeId, config, flow, state);
                return { active: true, passMessage: true, modifiedMessage: item.message };
            }
        }
        this.scheduleQueueDrain(nodeId, config, flow, state);
        return { active: false, passMessage: false };
    }

    takeQueueMessage(nodeId, config) {
        const queue = this.messageQueues.get(nodeId) || [];
        const ttl = Number(config.ttlMs);
        while (queue.length) {
            const item = queue.shift();
            if (!(ttl > 0) || Date.now() - item.timestamp < ttl) return item;
        }
        return null;
    }

    // Resume only this queue's downstream branch; never replay the original triggers.
    scheduleQueueDrain(nodeId, config, flow, state) {
        if (!flow || !config.autoDequeue || state.processing || this.stateTimers.has(nodeId)
            || !this.messageQueues.get(nodeId)?.length) return;
        const delay = Math.max(0, (Number(config.processingDelayMs) || 0) - (Date.now() - state.lastProcessTime));
        const timer = setTimeout(async () => {
            this.stateTimers.delete(nodeId);
            if (this.nodeStates.get(nodeId) !== state) return;
            const currentFlow = this.flows.find(candidate => candidate.id === flow.id) || flow;
            const node = currentFlow.nodes?.find(candidate => candidate.id === nodeId && candidate.stateType === 'QUEUE');
            if (currentFlow.active === false || !node || !node.config?.autoDequeue) {
                this.clearStateNode(nodeId);
                return;
            }
            const item = this.takeQueueMessage(nodeId, node.config);
            if (!item) return;
            state.processing = true;
            state.lastProcessTime = Date.now();
            try {
                await this.evaluateFlow(currentFlow, item.message, nodeId);
            } catch (error) {
                console.warn('[EventFlow] Queued message failed:', error);
            } finally {
                state.processing = false;
                if (this.nodeStates.get(nodeId) === state) this.scheduleQueueDrain(nodeId, node.config, currentFlow, state);
            }
        }, delay);
        this.stateTimers.set(nodeId, timer);
    }

    clearStateNode(nodeId) {
        clearTimeout(this.stateTimers.get(nodeId));
        this.stateTimers.delete(nodeId);
        for (const timer of this.semaphoreStates.get(nodeId)?.activeOperations || []) clearTimeout(timer);
        this.nodeStates.delete(nodeId);
        this.messageQueues.delete(nodeId);
        this.semaphoreStates.delete(nodeId);
        this.throttleStates.delete(nodeId);
    }

    reconcileFlowState(nextFlows) {
        for (const flow of this.flows) {
            const next = nextFlows.find(candidate => candidate.id === flow.id);
            if (!next) {
                this.cleanupStateNodes(flow.id);
                continue;
            }
            if (next.active === false) this.cancelFlowExecutions(flow.id);
            for (const node of flow.nodes || []) {
                const replacement = next.nodes?.find(candidate => candidate.id === node.id);
                if (!replacement || replacement.stateType !== node.stateType
                    || (node.stateType === 'QUEUE' && (next.active === false || !replacement.config?.autoDequeue))) {
                    this.clearStateNode(node.id);
                }
            }
        }
    }

    // Clean up using the flow's actual node IDs, which need not contain the flow ID.
    cleanupStateNodes(flowId) {
        this.cancelFlowExecutions(flowId);
        const flow = this.flows.find(candidate => candidate.id === flowId);
        for (const node of flow?.nodes || []) this.clearStateNode(node.id);

        const memoryPrefix = `${flowId || 'draft'}::`;
        this.userMemoryStates.forEach((state, stateId) => {
            if (!stateId.startsWith(memoryPrefix)) return;
            if (this.userMemoryResetTimers.has(stateId)) {
                clearTimeout(this.userMemoryResetTimers.get(stateId));
                this.userMemoryResetTimers.delete(stateId);
            }
            if (this.userMemorySaveTimers.has(stateId)) {
                clearTimeout(this.userMemorySaveTimers.get(stateId));
                this.userMemorySaveTimers.delete(stateId);
            }
            if (this.userMemoryBroadcastTimers.has(stateId)) {
                clearTimeout(this.userMemoryBroadcastTimers.get(stateId));
                this.userMemoryBroadcastTimers.delete(stateId);
            }
            this.userMemoryStates.delete(stateId);
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
                const timer = setTimeout(() => {
                    state.activeOperations = state.activeOperations.filter(active => active !== timer);
                    if (state.currentCount > 0) {
                        state.currentCount--;
                    }
                }, config.timeoutMs);
                state.activeOperations.push(timer);
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
                const timer = setTimeout(() => {
                    this.stateTimers.delete(nodeId);
                    state.triggered = false;
                }, config.autoResetMs);
                this.stateTimers.set(nodeId, timer);
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
        
        // Fractional rates need a longer window (0.1/sec = one every 10 seconds).
        const windowMs = config.messagesPerSecond > 0 && config.messagesPerSecond < 1
            ? 1000 / config.messagesPerSecond : 1000;
        state.messageTimestamps = state.messageTimestamps.filter(
            timestamp => now - timestamp < windowMs
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
        
        const counterRemaining = Math.max(0, (Number(state.targetCount) || 0) - (Number(state.count) || 0));

        // Add count to message for downstream nodes
        const modifiedMessage = {
            ...message,
            counterValue: state.count,
            counterTarget: state.targetCount,
            counterRemaining: counterRemaining,
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
            const request = indexedDB.open(this.dbName, 2);
            
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(this.userMemoryStoreName)) {
                    db.createObjectStore(this.userMemoryStoreName, { keyPath: 'id' });
                }
            };
            
            request.onsuccess = event => {
                this.db = event.target.result;
                this.loadFlows().then(resolve);
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    cloneFlowWithFreshNodeIds(flow) {
        const newFlow = JSON.parse(JSON.stringify(flow));
        const idMap = new Map();
        const usedNodeIds = new Set();

        for (const existingFlow of this.flows || []) {
            for (const node of existingFlow.nodes || []) {
                if (node && node.id) usedNodeIds.add(node.id);
            }
        }

        (newFlow.nodes || []).forEach((node, index) => {
            if (!node || !node.id) return;

            const oldId = node.id;
            let attempt = 0;
            let newId;
            do {
                newId = `node_${Date.now()}_${Math.floor(Math.random() * 1000000)}_${index}_${attempt++}`;
            } while (usedNodeIds.has(newId));

            idMap.set(oldId, newId);
            usedNodeIds.add(newId);
            node.id = newId;
        });

        newFlow.connections = (newFlow.connections || []).map(connection => ({
            ...connection,
            from: idMap.get(connection.from) || connection.from,
            to: idMap.get(connection.to) || connection.to
        }));

        (newFlow.nodes || []).forEach(node => {
            if (!node || !node.config || !node.config.targetNodeId) return;
            node.config.targetNodeId = idMap.get(node.config.targetNodeId) || node.config.targetNodeId;
        });

        newFlow.id = null;
        return newFlow;
    }

    async duplicateFlow(flowId) {
        const flow = await this.getFlowById(flowId);
        if (!flow) return null;

        const newFlow = this.cloneFlowWithFreshNodeIds(flow);
        newFlow.name = `${flow.name} (Copy)`;
        
        return this.saveFlow(newFlow);
    }
    
    async exportFlow(flowId) {
        const flow = await this.getFlowById(flowId);
        if (!flow) return null;
        
        return JSON.stringify(flow, null, 2);
    }
    
    async importFlow(flowData) {
        try {
            const flow = this.cloneFlowWithFreshNodeIds(
                typeof flowData === 'string' ? JSON.parse(flowData) : flowData
            );
            
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
					
					this.reconcileFlowState(flowsFromDB);
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
			// Imports can save multiple flows in the same millisecond.
			flowData.id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
				this.reconcileFlowState(existingFlowIndex === -1 ? [...this.flows, flowData]
					: this.flows.map(flow => flow.id === flowData.id ? flowData : flow));
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

        // Build order map
        const idToNewOrderMap = new Map();
        orderedFlowIds.forEach((id, index) => idToNewOrderMap.set(id, index));

        // Prepare flow updates for DB (don't modify in-memory yet)
        const flowUpdates = [];
        this.flows.forEach(flow => {
            if (idToNewOrderMap.has(flow.id)) {
                // Create a copy with updated order for DB storage
                const updatedFlow = { ...flow, order: idToNewOrderMap.get(flow.id) };
                flowUpdates.push(updatedFlow);
                store.put(updatedFlow);
            }
        });

        return new Promise((resolveOuter, rejectOuter) => {
            transaction.oncomplete = () => {
                // Transaction succeeded - NOW update in-memory state
                this.flows.forEach(flow => {
                    if (idToNewOrderMap.has(flow.id)) {
                        flow.order = idToNewOrderMap.get(flow.id);
                    }
                });
                this.flows.sort((a, b) => (a.order || 0) - (b.order || 0));
                resolveOuter({ success: true, message: "Flows reordered successfully." });
            };
            transaction.onerror = (event) => {
                console.error("Transaction error during flow reorder:", event.target.error);
                // Transaction failed and rolled back - in-memory state unchanged (consistent)
                rejectOuter({ success: false, message: "Transaction error during flow reorder.", error: event.target.error });
            };
        });
    }

    async deleteFlow(flowId) {
        const db = await this.ensureDB();
        
        return new Promise((resolve, reject) => { // Changed to reject for errors
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(flowId);
            
            request.onsuccess = () => {
                this.cleanupStateNodes(flowId);
                this.flows = this.flows.filter(flow => flow.id !== flowId);
                this.deletePersistentUserMemoriesForFlow(flowId);
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
	
	isMetaOnlyPayload(message) {
		if (!message || typeof message !== 'object') return false;
		if (this.isObsEventPayload(message)) return false;
		if (!("meta" in message)) return false;
		const hasChatFields = this.hasChatLikeFields(message);
		return !hasChatFields;
	}

	isCounterEventPayload(message) {
		if (!this.isMetaOnlyPayload(message)) return false;
		const eventType = String(message.event || '').trim().toLowerCase();
		return ['viewer_update', 'likes_update', 'follower_update', 'subscriber_update'].includes(eventType);
	}

	isObsEventPayload(message) {
		return !!(message && typeof message === 'object' && (message.type || '').toLowerCase() === 'obs' && message.event);
	}

	hasChatLikeFields(message) {
		return !!(message && (message.chatname || message.chatmessage || message.hasDonation || message.contentimg));
	}

	isTikTokTeamMember(message) {
		if (!message || String(message.type || '').toLowerCase() !== 'tiktok') return false;

		const meta = message.meta && typeof message.meta === 'object' && !Array.isArray(message.meta)
			? message.meta
			: {};
		const levelCandidates = [
			meta.memberLevel,
			meta.teamMemberLevel,
			meta.fanLevel,
			message.memberLevel,
			message.teamMemberLevel,
			message.fanLevel
		];
		if (levelCandidates.some(level => Number(level) > 0)) return true;

		const badges = Array.isArray(message.chatbadges)
			? message.chatbadges
			: (message.chatbadges ? [message.chatbadges] : []);
		return badges.some(badge => {
			if (typeof badge === 'string') {
				return /(?:fans?_badge|grade_badge)/i.test(badge);
			}
			try {
				return /(?:fans?_badge|grade_badge)/i.test(JSON.stringify(badge));
			} catch (e) {
				return false;
			}
		});
	}
    
    async processMessage(message) {
        
        if (!message) {
            ////console.log("[RELAY DEBUG - ProcessMessage] Message is null/undefined at start.");
            return message;
        }

        // Automatic User Memory resets happen before flows evaluate the stream event.
        await this.resetUserMemoriesForEvent(message);
        
		// Counter payloads may continue only to explicit matching event triggers.
		// Other meta-only traffic remains excluded from Event Flow.
		if (this.isMetaOnlyPayload(message) && !this.isCounterEventPayload(message)) {
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

                // Return immediately if returnNow is set - skip remaining flows
                if (result.returnNow) {
                  //console.log(`[ProcessMessage] Flow "${flow.name}" requested IMMEDIATE RETURN. Skipping remaining flows.`);
                    break;
                }
            }
        }

      //console.log(`[ProcessMessage] Final result: ${blocked ? 'BLOCKED (returning null)' : 'NOT BLOCKED (returning message)'}`);
        return blocked ? null : processed;
    }
    
    cancelFlowExecutions(flowId) {
        const execution = this.flowExecutions && this.flowExecutions.get(flowId);
        if (!execution) return;
        execution.cancelled = true;
        for (const finish of execution.delays) finish();
        this.flowExecutions.delete(flowId);
    }

    waitForFlowDelay(delayMs, execution) {
        if (!execution) return new Promise(resolve => setTimeout(resolve, delayMs));
        if (execution.cancelled) return Promise.resolve();
        return new Promise(resolve => {
            const finish = () => {
                clearTimeout(timer);
                execution.delays.delete(finish);
                resolve();
            };
            const timer = setTimeout(finish, delayMs);
            execution.delays.add(finish);
        });
    }

    async evaluateFlow(flow, message, resumeNodeId = null) {
      //console.log(`[EvaluateFlow "${flow.name}"] Starting evaluation with message:`, JSON.stringify(message));
        if (!flow.nodes || !flow.connections) {
          //console.log(`[EvaluateFlow "${flow.name}"] Flow has no nodes or connections.`);
            return { modified: false, message, blocked: false };
        }

        if (!this.flowExecutions) this.flowExecutions = new Map();
        if (!this.flowExecutions.has(flow.id)) {
            this.flowExecutions.set(flow.id, { cancelled: false, delays: new Set() });
        }
        const execution = this.flowExecutions.get(flow.id);
        const canContinue = () => !execution.cancelled
            && (this.flows.find(candidate => candidate.id === flow.id) || flow).active !== false;
        const nodeActivationStates = {}; 
        if (resumeNodeId) {
            const downstream = new Set([resumeNodeId]);
            const pending = [resumeNodeId];
            while (pending.length) {
                const id = pending.shift();
                for (const connection of flow.connections) {
                    if (connection.from === id && !downstream.has(connection.to)) {
                        downstream.add(connection.to);
                        pending.push(connection.to);
                    }
                }
            }
            for (const node of flow.nodes) {
                if (!downstream.has(node.id) || node.type === 'trigger') nodeActivationStates[node.id] = false;
            }
            nodeActivationStates[resumeNodeId] = true;
        }

        // --- Pass 1: Evaluate all base triggers ---
      //console.log(`[EvaluateFlow "${flow.name}"] Pass 1: Evaluating Triggers`);
        for (const node of flow.nodes) {
            if (node.type === 'trigger' && !resumeNodeId) {
              //console.log(`[EvaluateFlow "${flow.name}"] Evaluating Trigger Node ID: ${node.id}, Type: ${node.triggerType}`);
                nodeActivationStates[node.id] = await this.evaluateTrigger(node, message, flow);
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
                        const result = await this.evaluateSpecificLogicNode(node.logicType, inputValues, node.config, message);
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
                        const result = await this.evaluateStateNode(node, message, inputActive, flow);
                        
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
        // Ensure we always have a mutable message object even when running on scheduler ticks (message can be null)
        const baseMessage = message ? { ...message } : {};
        let overallResult = { modified: false, message: baseMessage, blocked: false }; 
        const nodeMap = new Map(flow.nodes.map(node => [node.id, node]));
        const executedActions = new Set(); // Track which actions have been executed

        // Process actions in topological order (following connections)
        const executeActionChain = async (actionId) => {
            if (!canContinue()) return;
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
            const actionResult = await this.executeAction(node, overallResult.message, flow, execution);
            if (!canContinue()) return;
            
            if (actionResult) {
                // Handle returnNow - mark message for immediate return
                if (actionResult.returnNow) {
                    overallResult.returnNow = true;
                  //console.log(`[EvaluateFlow "${flow.name}"] Action Node ID: ${node.id} RETURN NOW - message will be returned immediately.`);
                }

                if (actionResult.blocked) {
                    overallResult.blocked = true;
                  //console.log(`[EvaluateFlow "${flow.name}"] Action Node ID: ${node.id} BLOCKED the message.`);
                }

                if (actionResult.modified && actionResult.message) {
                    overallResult.message = { ...actionResult.message };
                    overallResult.modified = true;
                  //console.log(`[EvaluateFlow "${flow.name}"] Action Node ID: ${node.id} MODIFIED the message.`);
                }

                // Handle async continuation - schedule downstream and return immediately
                if (actionResult.continueAsync) {
                    let downstreamConnections = flow.connections.filter(conn => conn.from === actionId);
                    if (downstreamConnections.length > 0) {
                        // Capture current state for async execution
                        let asyncMessage = { ...overallResult.message };

                        // Schedule downstream actions to run asynchronously
                        setTimeout(async () => {
                            // Create a separate execution context for async chain
                            const asyncExecutedActions = new Set(executedActions);
                            let asyncBlocked = false;

                            const executeAsyncChain = async (asyncActionId) => {
                                if (!canContinue()) return;
                                if (asyncExecutedActions.has(asyncActionId)) return;
                                if (asyncBlocked) return; // Stop if blocked

                                const asyncNode = nodeMap.get(asyncActionId);
                                if (!asyncNode || asyncNode.type !== 'action') return;

                                asyncExecutedActions.add(asyncActionId);
                                const asyncResult = await this.executeAction(asyncNode, asyncMessage, flow, execution);
                                if (!canContinue()) return;

                                // Handle action results - mirror synchronous behavior
                                if (asyncResult) {
                                    if (asyncResult.blocked) {
                                        asyncBlocked = true;
                                        return; // Stop processing this branch
                                    }
                                    if (asyncResult.modified && asyncResult.message) {
                                        asyncMessage = { ...asyncResult.message };
                                    }
                                    // If this action also wants to continue async, it will spawn its own setTimeout
                                    if (asyncResult.continueAsync) {
                                        // Already running async, so just continue normally
                                        // but could implement nested async here if needed
                                    }
                                }

                                // Continue to downstream actions
                                const asyncDownstream = flow.connections.filter(conn => conn.from === asyncActionId);
                                for (const conn of asyncDownstream) {
                                    if (asyncBlocked) return;
                                    const downNode = nodeMap.get(conn.to);
                                    if (downNode && downNode.type === 'action') {
                                        await executeAsyncChain(conn.to);
                                    }
                                }
                            };

                            for (const conn of downstreamConnections) {
                                if (asyncBlocked) break;
                                const downstreamNode = nodeMap.get(conn.to);
                                if (downstreamNode && downstreamNode.type === 'action') {
                                    await executeAsyncChain(conn.to);
                                }
                            }
                        }, 0);
                    }
                    return; // Return immediately, downstream runs async
                }
            }

            // Find and execute downstream actions (synchronous path)
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
                    case 'rememberUser':
                    case 'forgetUser':
                    case 'clearUserMemory':
                    case 'pickRandomUser':
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

    normalizeEventType(eventType) {
        const normalized = typeof eventType === 'string' ? eventType.toLowerCase().trim() : '';
        // Backward compatibility alias: legacy Twitch ad event spelling.
        if (normalized === 'adbreak') {
            return 'ad_break';
        }
        // Backward compatibility alias: legacy Twitch websocket channel point name.
        if (normalized === 'channel_points') {
            return 'reward';
        }
        return normalized;
    }

    eventTypeMatches(targetEventType, messageEventType) {
        const normalizedTarget = this.normalizeEventType(targetEventType);
        const normalizedMessage = this.normalizeEventType(messageEventType);
        return !!normalizedTarget && normalizedMessage === normalizedTarget;
    }

    looksLikeRewardRedemption(message) {
        if (!message || typeof message !== 'object') {
            return false;
        }

        const directRewardName = String(message.rewardTitle || message.rewardName || '').trim();
        if (directRewardName) {
            return true;
        }

        const shouldUseTextHeuristics = message.type === 'kick' || message.event === true;
        if (!shouldUseTextHeuristics) {
            return false;
        }

        const text = String(message.chatmessage || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) {
            return false;
        }

        const rewardPatterns = [
            /^(?:has redeemed|redeemed)\b/,
            /^(?:ha canjeado|canjeo)\b/,
            /^(?:rescatou|resgatou)\b/,
            /^(?:ha riscattato)\b/,
            /^(?:a echange|a rachete)\b/,
            /^hat .+ eingelost\b/,
            /^heeft .+ ingewisseld\b/
        ];

        return rewardPatterns.some(pattern => pattern.test(text));
    }
    
    async evaluateTrigger(triggerNode, message, flow = null) {
        const { triggerType, config } = triggerNode;
        // Boolean activity markers are valid payloads, but are not named events.
        const messageEvent = message && typeof message.event === 'string' ? message.event.toLowerCase() : '';
        // Scheduler ticks have no chat payload. Do not match message filters or
        // advance message counters; preserve explicitly message-free triggers.
        if (message == null && triggerType !== 'timeInterval' && triggerType !== 'timeOfDay'
            && triggerType !== 'customJs'
            && !(triggerType === 'randomChance' && config && config.requireMessage === false)) {
            return false;
        }
        // console.log(`[EvaluateTrigger] Node: ${triggerNode.id}, Type: ${triggerType}, Config: ${JSON.stringify(config)}, Message: ${message.chatmessage}`);
        let match = false;
		
		// Known counters may match only an explicit Event Type trigger. This keeps
		// them out of Any Message and other generic chat-oriented triggers.
		if (this.isMetaOnlyPayload(message) && (triggerType !== 'eventOther' || !this.isCounterEventPayload(message))){
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
                return this.hasChatLikeFields(message);
                
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

            case 'userMemoryContains':
                return this.isUserRemembered(config && config.targetNodeId, message, flow);
                
            case 'userRole':
                if (config && config.role === 'tiktokTeamMember') {
                    return this.isTikTokTeamMember(message);
                }
                match = message && config && message[config.role] === true; 
              ////console.log(`[EvaluateTrigger - userRole] Config Role: "${config.role}", Message Role Value: ${message[config.role]}, Match: ${match}`);
                return match;
                
            case 'hasDonation':
                match = !!message.hasDonation; // Assuming hasDonation is a truthy value if donation exists
              ////console.log(`[EvaluateTrigger - hasDonation] Message hasDonation: "${message.hasDonation}", Match: ${match}`);
                return match;

            case 'channelPointRedemption':
                // Check if this is a reward/redemption event
                if (!this.eventTypeMatches('reward', message.event) && !this.looksLikeRewardRedemption(message)) {
                    return false;
                }
                // If a specific reward name is configured, check it
                if (config.rewardName && config.rewardName.trim()) {
                    // Check if the message contains the reward name (case-insensitive)
                    const rewardName = config.rewardName.toLowerCase().trim();
                    const msgText = (message.chatmessage || '').toLowerCase();
                    // Also check if there's a rewardTitle property
                    const rewardTitle = (message.rewardTitle || message.rewardName || '').toLowerCase();
                    match = msgText.includes(rewardName) || rewardTitle.includes(rewardName);
                } else {
                    // Any redemption matches
                    match = true;
                }
                return match;

            case 'eventType':
                // Check if the event type matches
                const targetEvent = config.eventType || '';
                const msgEvent = message.event || '';
                match = this.eventTypeMatches(targetEvent, msgEvent);
                return match;

            // === NEW DEDICATED EVENT TRIGGERS ===
            case 'eventNewFollower': {
                const eventMatch = messageEvent === 'new_follower';
                const sourceMatch = !config.sources?.length || config.sources.includes(message.type);
                return eventMatch && sourceMatch;
            }

            case 'eventNewSubscriber': {
                const event = messageEvent;
                const eventMatch = event === 'new_subscriber' || event === 'sponsorship';
                const sourceMatch = !config.sources?.length || config.sources.includes(message.type);
                return eventMatch && sourceMatch;
            }

            case 'eventResub': {
                const eventMatch = messageEvent === 'resub';
                const sourceMatch = !config.sources?.length || config.sources.includes(message.type);
                return eventMatch && sourceMatch;
            }

            case 'eventGiftSub': {
                const event = messageEvent;
                const eventMatch = event === 'subscription_gift' || event === 'giftpurchase';
                const sourceMatch = !config.sources?.length || config.sources.includes(message.type);
                return eventMatch && sourceMatch;
            }

            case 'eventDonation': {
                const event = messageEvent;
				const eventMatch = !!message.hasDonation || event === 'superchat' || event === 'donation' || event === 'cheer' || event === 'supersticker' || event === 'jeweldonation';
                const sourceMatch = !config.sources?.length || config.sources.includes(message.type);

                // Check minimum amount if specified
                let amountMatch = true;
                if (config.minAmount > 0) {
                    const amount = this.getDonationNumericValue(message) || 0;
                    amountMatch = amount >= config.minAmount;
                }

                return eventMatch && sourceMatch && amountMatch;
            }

            case 'eventRaid': {
                const eventMatch = messageEvent === 'raid';
                const sourceMatch = !config.sources?.length || config.sources.includes(message.type);

                // Check minimum viewers if specified
                let viewerMatch = true;
                if (config.minViewers > 0) {
                    const viewers = Number(message.meta?.viewers ?? message.viewers);
                    viewerMatch = Number.isFinite(viewers) && viewers >= config.minViewers;
                }

                return eventMatch && sourceMatch && viewerMatch;
            }

            case 'eventCheer': {
                const eventMatch = messageEvent === 'cheer';
                const sourceMatch = !config.sources?.length || config.sources.includes(message.type);

                // Check minimum bits if specified
                let bitsMatch = true;
                if (config.minBits > 0) {
                    const bits = Number(message.meta?.bits ?? message.bits);
                    bitsMatch = Number.isFinite(bits) && bits >= config.minBits;
                }

                return eventMatch && sourceMatch && bitsMatch;
            }

            case 'eventOther': {
                const targetEventType = config.eventType || '';
                const msgEventType = message.event || '';
                return this.eventTypeMatches(targetEventType, msgEventType);
            }

            case 'eventCustom': {
                const targetEventType = config.eventType || '';
                const msgEventType = message.event || '';
                const eventMatch = this.eventTypeMatches(targetEventType, msgEventType);

                // If there's a custom condition, evaluate it
                if (eventMatch && config.customCondition) {
                    try {
                        // Create a safe evaluation context
                        const data = message;
                        const result = new Function('data', `return ${config.customCondition}`)(data);
                        return !!result;
                    } catch (e) {
                        console.warn('Custom condition evaluation failed:', e);
                        return false;
                    }
                }

                return eventMatch;
            }

            case 'obsStreamStarted': {
                if ((message.type || '').toLowerCase() !== 'obs') return false;
                const event = messageEvent;
                return event === 'stream_started';
            }

            case 'obsStreamStopped': {
                if ((message.type || '').toLowerCase() !== 'obs') return false;
                const event = messageEvent;
                return event === 'stream_stopped';
            }

            case 'obsRecordingStarted': {
                if ((message.type || '').toLowerCase() !== 'obs') return false;
                const event = messageEvent;
                return event === 'recording_started' || event === 'obs_recording_started';
            }

            case 'obsRecordingStopped': {
                if ((message.type || '').toLowerCase() !== 'obs') return false;
                const event = messageEvent;
                return event === 'recording_stopped' || event === 'obs_recording_stopped';
            }

            case 'obsSceneChanged': {
                if ((message.type || '').toLowerCase() !== 'obs') return false;
                const event = messageEvent;
                return event === 'scene_changed' || event === 'obs_scene_changed';
            }

            case 'obsMediaEnded': {
                if ((message.type || '').toLowerCase() !== 'obs') return false;
                const event = messageEvent;
                if (event !== 'media_ended' && event !== 'obs_media_ended') return false;
                const configuredSource = String(config.sourceName || '').trim().toLowerCase();
                if (!configuredSource) return true;
                const eventSource = String(message.meta?.inputName || message.inputName || '').trim().toLowerCase();
                return eventSource === configuredSource;
            }

            case 'obsReplaybufferSaved': {
                // Matches OBS obs-browser's official replay-buffer event casing.
                if ((message.type || '').toLowerCase() !== 'obs') return false;
                const event = messageEvent;
                return event === 'replay_buffer_saved' || event === 'obs_replay_buffer_saved';
            }

            case 'compareProperty': {
                const prop = config.property || 'donoValue';
                const operator = config.operator || 'gt';
                const rawCompareValue = config.value;

                // Get the property value from the message
                let msgValue = message[prop];

                // Handle special cases for message length and word count
                if (prop === 'donationAmount' || prop === 'donoValue' ||
                    (prop === 'hasDonation' && ['gt', 'gte', 'lt', 'lte'].includes(operator))) {
                    msgValue = this.getDonationNumericValue(message);
                } else if (prop === 'messageLength' && message.chatmessage) {
                    msgValue = message.chatmessage.length;
                } else if (prop === 'wordCount' && message.chatmessage) {
                    msgValue = message.chatmessage.trim().split(/\s+/).filter(w => w.length > 0).length;
                }

                // If property doesn't exist or is null/undefined, return false
                if (msgValue === undefined || msgValue === null) {
                    return false;
                }

                const compareValueText = String(rawCompareValue ?? '').trim();
                const msgValueText = String(msgValue).trim();
                const isStrictNumericString = value => /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value);
                const canCompareNumerically =
                    compareValueText !== '' &&
                    msgValueText !== '' &&
                    isStrictNumericString(msgValueText) &&
                    isStrictNumericString(compareValueText);
                const numValue = canCompareNumerically ? Number(msgValueText) : null;
                const compareValue = canCompareNumerically ? Number(compareValueText) : null;

                if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
                    if (!canCompareNumerically) {
                        return false;
                    }

                    switch (operator) {
                        case 'gt': return numValue > compareValue;
                        case 'lt': return numValue < compareValue;
                        case 'gte': return numValue >= compareValue;
                        case 'lte': return numValue <= compareValue;
                        default: return false;
                    }
                }

                if (canCompareNumerically) {
                    switch (operator) {
                        case 'eq': return numValue === compareValue;
                        case 'ne': return numValue !== compareValue;
                        default: return false;
                    }
                }

                const normalizedMsgValue = msgValueText.toLowerCase();
                const normalizedCompareValue = compareValueText.toLowerCase();

                switch (operator) {
                    case 'eq': return normalizedMsgValue === normalizedCompareValue;
                    case 'ne': return normalizedMsgValue !== normalizedCompareValue;
                    default: return false;
                }
            }

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
                // Older editor versions saved this comma-separated field as a string.
                const configuredTimes = Array.isArray(config.times) ? config.times
                    : typeof config.times === 'string' ? config.times.split(',') : [];
                
                const currentTime = new Date();
                const currentHour = currentTime.getHours();
                const currentMinute = currentTime.getMinutes();
                const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
                
                // Check if current time matches any configured time
                match = configuredTimes.some(time => {
                    if (typeof time === 'string' && time.includes(':')) {
                        return time.trim() === currentTimeString;
                    }
                    return false;
                });
                
                // Prevent triggering multiple times in the same minute
                const todNodeState = `timeOfDay_${triggerNode.id}_lastTriggered`;
                const currentMinuteId = Math.floor(currentTime.getTime() / 60000);
                if (match) {
                    if (this[todNodeState] === currentMinuteId) {
                        return false; // Already triggered this minute
                    }
                    this[todNodeState] = currentMinuteId;
                }
                return match;
                
            case 'midiNoteOn':
            case 'midiNoteOff':
            case 'midiCC':
                // MIDI triggers are handled by listeners, not evaluated per message
                // They'll be set up when flows are loaded/saved
                return false;
                
            case 'customJs':
                if (!this.allowEvalCustomJs) {
                    this.warnCustomJsEvalDisabled('customJs trigger');
                    return false;
                }
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
                
                // Determine counter key (sanitize to prevent prototype pollution)
                const sanitizeKey = (key) => {
                    if (typeof key !== 'string') return String(key);
                    const dangerous = ['__proto__', 'constructor', 'prototype'];
                    return dangerous.includes(key.toLowerCase()) ? `_safe_${key}` : key;
                };
                let counterKey = 'global';
                if (countType === 'perUser' && message.userid) {
                    counterKey = `user_${sanitizeKey(message.userid)}`;
                } else if (countType === 'perSource' && message.type) {
                    counterKey = `source_${sanitizeKey(message.type)}`;
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
                    poolName: config.poolName || 'default',
                    maxUsers: config.maxUsers || 10,
                    requireEntry: config.requireEntry !== false, // Default true
                    entryKeyword: config.entryKeyword || '!enter',
                    resetOnFull: config.resetOnFull || false,
                    resetAfterMs: config.resetAfterMs || 0,
                    allowReentry: config.allowReentry || false,
                    scope: config.scope || 'global' // global, perSource
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
                    accumulatorName: config.accumulatorName || 'default',
                    threshold: config.threshold || 100,
                    propertyName: config.propertyName || 'amount',
                    operation: config.operation || 'sum', // sum, avg, max, min
                    triggerMode: config.triggerMode || 'gte', // gte, exact, lte
                    autoReset: config.autoReset || false,
                    scope: config.scope || 'global', // global, perUser, perSource
                    resetAfterMs: config.resetAfterMs || 0
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
                const { requiredProperties = [], forbiddenProperties = [], requireAll = true, lastActivityFilter = {} } = config;
                
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
                let requiredPass = true;
                if (requiredProperties.length > 0) {
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
                        requiredPass = requiredProperties.every(checkProperty);
                    } else {
                        // ANY required property must exist
                        requiredPass = requiredProperties.some(checkProperty);
                    }
                }
                
                if (!requiredPass) return false;
                
                if (lastActivityFilter.enabled) {
                    const amount = parseFloat(lastActivityFilter.amount) || 0;
                    const unit = lastActivityFilter.unit || 'minutes';
                    const mode = lastActivityFilter.mode === 'older' ? 'older' : 'within';
                    const unitMap = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 };
                    const windowMs = Math.max(0, amount) * (unitMap[unit] || unitMap.minutes);
                    const lastActivityRaw = message.lastactivity || message.lastActivity || null;

                    const normalizeLastActivityMs = (value) => {
                        const num = Number(value);
                        if (!Number.isFinite(num) || num <= 0) return null;
                        if (num < 1e10) return Math.round(num * 1000); // likely seconds
                        if (num > 1e15) return Math.round(num / 1000); // likely microseconds
                        return Math.round(num); // assume milliseconds
                    };

                    const lastActivityTs = normalizeLastActivityMs(lastActivityRaw);

                    // Require a valid last activity timestamp when filter is enabled
                    if (!lastActivityTs || windowMs === 0) {
                        return false;
                    }

                    const age = Date.now() - lastActivityTs;
                    if (age < 0) {
                        return false; // Future timestamps are treated as invalid
                    }

                    if (mode === 'older') {
                        if (age < windowMs) return false;
                    } else {
                        if (age > windowMs) return false;
                    }
                }

                return true;
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
                const actionResult = await this.executeAction(node, currentMessage, flow);
                
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

	/**
	 * Replace template variables in text with values from the message object.
	 * Supports core aliases ({username}, {message}, {source}, {donation}) plus
	 * extended fields ({event}, {membership}, {hasDonation}, {meta}, etc.).
	 * @param {string} text - Template text containing {variable} placeholders
	 * @param {Object} message - Message object with field values
	 * @returns {string} Text with placeholders replaced
	 */
	replaceTemplateVars(text, message) {
		if (!text) return text || '';
		if (!message) return text;

		const donationNumericValue = this.getDonationNumericValue(message);
		const donationAmountValue = donationNumericValue !== null ? donationNumericValue : (message.donationAmount || message.donoValue || '');

		// Build lookup map with all supported variables (lowercase keys for case-insensitive matching)
		const messageData = {
			// Core aliases for backward compatibility
			username: message.chatname || message.displayname || '',
			message: message.chatmessage || '',
			source: (message.type || '').charAt(0).toUpperCase() + (message.type || '').slice(1),
			donation: message.hasDonation || '',
			// Direct field mappings
			chatname: message.chatname || '',
			displayname: message.displayname || '',
			chatmessage: message.chatmessage || '',
			type: message.type || '',
			hasdonation: message.hasDonation || '',
			donationamount: donationAmountValue,
			donovalue: donationAmountValue,
			event: message.event || '',
			membership: message.membership || '',
			subtitle: message.subtitle || '',
			userid: message.userid || '',
			chatimg: message.chatimg || '',
			contentimg: message.contentimg || '',
			rewardtitle: message.rewardTitle || '',
			meta: message.meta || ''
		};

		// Expose any top-level message field so state/control actions can feed
		// values into downstream templates without new hardcoded placeholders.
		Object.keys(message).forEach((key) => {
			const normalizedKey = String(key || '').toLowerCase();
			if (!normalizedKey) return;
			if (!Object.prototype.hasOwnProperty.call(messageData, normalizedKey)) {
				messageData[normalizedKey] = message[key];
			}
		});

		// Convenience value for cooldown/countdown flows.
		if (!Object.prototype.hasOwnProperty.call(messageData, 'counterremaining')) {
			const counterValue = Number(messageData.countervalue);
			const counterTarget = Number(messageData.countertarget);
			if (Number.isFinite(counterValue) && Number.isFinite(counterTarget)) {
				messageData.counterremaining = Math.max(0, counterTarget - counterValue);
			}
		}

		return text.replace(/\{(\w+)\}/gi, (match, key) => {
			const val = messageData[key.toLowerCase()];
			if (val === undefined || val === null) return '';
			if (typeof val === 'object') {
				try {
					return JSON.stringify(val);
				} catch (e) {
					return '';
				}
			}
			return String(val);
		});
	}

	escapeThermalPrintText(value) {
		return String(value ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	renderThermalPrintText(template, message, weight) {
		const render = text => this.escapeThermalPrintText(this.replaceTemplateVars(text, message));
		if (weight !== 'selected') return render(template);
		// Parse only the host's template. Buyer/item text cannot introduce formatting or HTML.
		return template.split(/(\*\*[\s\S]+?\*\*)/g).map(part => {
			if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
				return `<strong>${render(part.slice(2, -2))}</strong>`;
			}
			return render(part);
		}).join('');
	}

	resolveThermalPrinter() {
		if (typeof this.printThermal === 'function') return this.printThermal;
		try {
			if (typeof window.printThermal === 'function') return window.printThermal;
		} catch (e) {}
		try {
			if (window.ninjafy && typeof window.ninjafy.printThermal === 'function') {
				return window.ninjafy.printThermal.bind(window.ninjafy);
			}
		} catch (e) {}
		return null;
	}

	/**
	 * Render Event Flow variables inside JSON string values for a webhook body.
	 * Bodies without template variables are returned unchanged.
	 * @param {string} template - Custom webhook JSON body
	 * @param {Object} message - Message object with field values
	 * @returns {string} Rendered JSON body
	 */
	renderWebhookBody(template, message) {
		if (typeof template !== 'string' || !/\{\w+\}/i.test(template)) {
			return template;
		}

		const parsed = JSON.parse(template);
		return JSON.stringify(parsed, (_key, value) => {
			return typeof value === 'string' ? this.replaceTemplateVars(value, message) : value;
		});
	}

	sanitizeSendMessage(text, textonly = false, alt = false, mode = 'safe') {
		if (!text || !text.trim()) {
			return alt || text;
		}

		// Prefer the shared relay sanitizer (from background.js) so editor + background behave identically
		// Only use it in 'safe' mode since it applies full sanitization
		if (typeof this.sanitizeRelay === 'function' && mode === 'safe') {
			try {
				const cleaned = this.sanitizeRelay(text, textonly, alt);
				if (cleaned || !alt) {
					return cleaned;
				}
				// fall through to return alt if provided and cleaned is empty
			} catch (e) {
				console.warn('[EventFlowSystem] sanitizeRelay failed, falling back to local sanitizer:', e);
			}
		}

		// Fallback: minimal sanitizer that mirrors the background behavior (including emoji alt preservation)
		const emojiMap = new Map();
		if (!textonly) {
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = text;

			const localIsEmoji = (char) => {
				if (!char) return false;
				const trimmed = char.trim();
				const asciiEmoticonRegex = /^[:;=8BxX][-^\'"]?[)(DPOop3/\\|]+$/;
				if (asciiEmoticonRegex.test(trimmed) || /^<3+$/.test(trimmed)) {
					return true;
				}
				try {
					const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
					return emojiRegex.test(trimmed);
				} catch (err) {
					return false;
				}
			};

			const imgElements = tempDiv.querySelectorAll('img');
			imgElements.forEach((img, index) => {
				const altText = img.getAttribute('alt');
				if (altText && localIsEmoji(altText)) {
					const placeholder = `__EMOJI_PLACEHOLDER_${index}__`;
					emojiMap.set(placeholder, altText);
					img.outerHTML = placeholder;
				}
			});

			text = tempDiv.innerHTML;

			const textArea = document.createElement('textarea');
			textArea.innerHTML = text;
			text = textArea.value;
		}

		// HTML stripping always runs (XSS prevention)
		text = text.replace(/(<([^>]+)>)/gi, "");

		if (mode === 'safe') {
			// Full sanitization (current behavior)
			text = text.replace(/[!#@]/g, "");
			text = text.replace(/cheer\d+/gi, " ");
			text = text.replace(/\.(?=\S)/g, (match, offset, str) => {
				const prev = offset > 0 ? str[offset - 1] : "";
				const next = str[offset + 1] || "";
				if (/\S/.test(prev) && /\S/.test(next)) {
					return ".";
				}
				return " ";
			});
		} else if (mode === 'preserveUrls') {
			// Strip commands but preserve dots for URLs
			text = text.replace(/[!#@]/g, "");
			text = text.replace(/cheer\d+/gi, " ");
			// Dots preserved - no replacement
		}
		// 'raw' mode: Only HTML stripped above

		emojiMap.forEach((emoji, placeholder) => {
			text = text.replace(placeholder, emoji);
		});

		if (!text.trim() && alt) {
			return alt;
		}
		return text.trim();
	}
    
    async executeAction(actionNode, message, flow = null, execution = null) {
        const { actionType, config } = actionNode;
        //console.log(`[ExecuteAction] Node: ${actionNode.id}, Type: ${actionType}, Config: ${JSON.stringify(config)}`);
        let result = { modified: false, message, blocked: false };
        
        switch (actionType) {
            case 'blockMessage':
                result.blocked = true;
                result.continueAsync = true; // Continue processing downstream actions asynchronously
              //console.log(`[ExecuteAction - blockMessage] Set result.blocked to true.`);
                break;

            case 'returnMessage':
                result.returnNow = true; // Signal to return message immediately
                result.continueAsync = true; // Continue processing downstream actions asynchronously
                break;

            case 'continueAsync':
                result.continueAsync = true; // Fork: continue this flow async, let other flows proceed
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
                        if (typeof this.sanitizeRelay === 'function') {
                            // Use the shared sanitizer so emote images collapse to text consistently
                            basis = this.sanitizeRelay(message.chatmessage, false) || '';
                        } else if (typeof this.sanitizeSendMessage === 'function') {
                            basis = this.sanitizeSendMessage(message.chatmessage, false) || '';
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

            case 'featureMessage': {
                const currentMeta = (message && typeof message.meta === 'object' && message.meta !== null && !Array.isArray(message.meta))
                    ? { ...message.meta }
                    : (message && message.meta !== undefined ? { value: message.meta } : {});

                currentMeta.featured = true;
                result.message = {
                    ...(message || {}),
                    meta: currentMeta
                };
                result.modified = true;
                break;
            }

            case 'pinMessage': {
                const actionConfig = config || {};
                const mode = actionConfig.mode || 'pin';
                const target = (actionConfig.target || '').toString().trim();
                const sendDockPayload = async (payload) => {
                    if (!payload || typeof payload !== 'object') return;
                    const dockPayload = target ? { ...payload, target } : payload;
                    if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                        this.sendTargetP2P(dockPayload, 'dock');
                        return;
                    }
                    console.warn('[EventFlow pinMessage] Dock messaging is not available.');
                };

                if (mode === 'nextPinned') {
                    await sendDockPayload({ action: 'nextPinned' });
                    break;
                }

                const currentMeta = (message && typeof message.meta === 'object' && message.meta !== null && !Array.isArray(message.meta))
                    ? { ...message.meta }
                    : (message && message.meta !== undefined ? { value: message.meta } : {});
                const idTemplate = actionConfig.messageId || '{id}';
                const usesTriggerId = String(idTemplate).trim().toLowerCase() === '{id}';
                const messageId = (usesTriggerId && message && message.id !== undefined && message.id !== null)
                    ? message.id
                    : this.replaceTemplateVars(idTemplate, message || {}).trim();

                if (mode === 'unpin') {
                    if (usesTriggerId || (message && messageId !== undefined && messageId !== null && String(messageId) === String(message.id))) {
                        currentMeta.pinned = false;
                        delete currentMeta.pinnedTarget;
                        result.message = {
                            ...(message || {}),
                            meta: currentMeta
                        };
                        result.modified = true;
                    }
                    if (messageId !== undefined && messageId !== null && messageId !== '') {
                        await sendDockPayload({ action: 'unpin', value: messageId });
                    }
                    break;
                }

                const pinsTriggerMessage = usesTriggerId || (message && messageId !== undefined && messageId !== null && String(messageId) === String(message.id));
                if (pinsTriggerMessage) {
                    currentMeta.pinned = true;
                    if (target) {
                        currentMeta.pinnedTarget = target;
                    } else {
                        delete currentMeta.pinnedTarget;
                    }
                    result.message = {
                        ...(message || {}),
                        meta: currentMeta
                    };
                    result.modified = true;
                }
                if (messageId !== undefined && messageId !== null && messageId !== '') {
                    await sendDockPayload({ action: 'pin', value: messageId });
                }
                break;
            }
                
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
                
                // Process template using the shared replacement utility
                let processedTemplate = this.replaceTemplateVars(config.template || 'Hello from {source}!', message);

                // Sanitize the message based on configured mode
                const sanitizeMode = config.sanitizeMode || 'safe';
                let sanitizedSendMessage = this.sanitizeSendMessage(processedTemplate, false, false, sanitizeMode).trim();
                
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
                
                const timeout = config.timeout ?? 1000;
                
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
                
                // Process relay template using the shared replacement utility
                let relayTemplate = this.replaceTemplateVars(config.template || '[{source}] {username}: {message}', message);
                
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
                
                const timeout = config.timeout ?? 1000;
                
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
					const webhookTimeout = config.timeout || 8000;

					// Prepare fetch options
					const fetchOpts = { method, headers };
					if (method !== 'GET' && method !== 'HEAD') {
						try {
							fetchOpts.body = config.includeMessage
								? JSON.stringify(message)
								: this.renderWebhookBody(config.body || '{}', message);
						} catch (error) {
							const errorMessage = `Invalid custom webhook JSON: ${error.message}`;
							console.error(`[ExecuteAction - webhook] ${errorMessage} for node ${actionNode.id}`);
							result.message = { ...message, webhookError: errorMessage };
							result.modified = true;
							if (config.syncMode && config.blockOnFailure) {
								result.blocked = true;
							}
							break;
						}
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
				try {
					if (!this.pointsSystem && typeof window !== 'undefined' && typeof window.pointsSystemReady === 'function') {
						await window.pointsSystemReady();
						this.pointsSystem = window.pointsSystem || this.pointsSystem;
					}
					const system = this.pointsSystem;
					if (system && config.amount > 0) {
						const addResult = await system.addPoints(
							message.chatname,
							message.type,
							config.amount
						);
						
						if (addResult.success) {
							result.message = { ...message, pointsTotal: addResult.points };
							result.modified = true;
							if (typeof window !== 'undefined' && typeof window.requestPointsLeaderboardBroadcast === 'function') {
								window.requestPointsLeaderboardBroadcast('action-add', { immediate: true });
							}
						}
					}
				} catch (e) {
					console.warn('[ExecuteAction - addPoints] failed', e);
				}
				break;
                
            case 'spendPoints':
				try {
					if (!this.pointsSystem && typeof window !== 'undefined' && typeof window.pointsSystemReady === 'function') {
						await window.pointsSystemReady();
						this.pointsSystem = window.pointsSystem || this.pointsSystem;
					}
					const system = this.pointsSystem;
					if (system && config.amount > 0) {
						const spendResult = await system.spendPoints( // Capture the result
							message.chatname,
							message.type,
							config.amount
						);

						if (!spendResult.success) {
							result.blocked = true; // This will stop subsequent actions in this flow path.
							result.message = { ...message, pointsSpendError: spendResult.message };
							result.modified = true;
						} else if (typeof window !== 'undefined' && typeof window.requestPointsLeaderboardBroadcast === 'function') {
							window.requestPointsLeaderboardBroadcast('action-spend', { immediate: true });
						}
					}
				} catch (e) {
					console.warn('[ExecuteAction - spendPoints] failed', e);
				}
				break;
                
            case 'customJs':
                if (!this.allowEvalCustomJs) {
                    this.warnCustomJsEvalDisabled('customJs action');
                    break;
                }
                try {
                    const evalFunction = new Function('message', 'result', config.code);
                    const customResult = await Promise.resolve(evalFunction(message, { ...result }));
                    
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

			case 'printThermal': {
				const printer = this.resolveThermalPrinter();
				let printResult;
				if (!printer) {
					printResult = {
						success: false,
						code: 'SSAPP_PRINT_UNAVAILABLE',
						error: 'Thermal printing requires the Social Stream standalone app.'
					};
				} else {
					const renderedText = this.renderThermalPrintText(config.text || '{username}', message || {}, config.fontWeight);
					const fontSize = Math.max(6, Math.min(96, Number(config.fontSize) || 18));
					const lineHeight = Math.max(0.8, Math.min(3, Number(config.lineHeight) || 1.15));
					const fontWeight = ['normal', 'selected'].includes(config.fontWeight) ? 'normal' : 'bold';
					const textAlign = ['left', 'center', 'right'].includes(config.textAlign) ? config.textAlign : 'center';
					const fontFamily = String(config.fontFamily || 'monospace').replace(/[^\w\s,'"-]/g, '') || 'monospace';
					const html = `<div style="white-space:pre-wrap;font-family:${fontFamily};font-size:${fontSize}pt;font-weight:${fontWeight};line-height:${lineHeight};text-align:${textAlign}">${renderedText}</div>`;
					const printOptions = {
						copies: Math.max(1, Math.min(99, Math.floor(Number(config.copies) || 1)))
					};
					if (String(config.printerName || '').trim()) printOptions.printerName = String(config.printerName).trim();
					if (Number(config.labelHeight) > 0) printOptions.height = `${Math.max(20, Math.min(4000, Number(config.labelHeight)))}mm`;
					try {
						printResult = await printer(html, printOptions);
					} catch (error) {
						printResult = {
							success: false,
							code: error?.code || 'SSAPP_PRINT_FAILED',
							error: error?.message || String(error)
						};
					}
				}
				if (message?.meta != null && (typeof message.meta !== 'object' || Array.isArray(message.meta))) {
					// Counter events use numeric meta; printing must not reshape those events.
					result.thermalPrintResult = printResult;
				} else {
					result.message = {
						...(message || {}),
						meta: { ...(message?.meta || {}), thermalPrintResult: printResult }
					};
					result.modified = true;
				}
				break;
			}
				
			case 'playTenorGiphy':
				if (config.mediaUrl || (config.sourceType === 'local' && config.localAssetId)) {
					const actionPayload = {
						actionType: 'play_media', // This corresponds to the 'actionType' in actions.html
						url: config.sourceType === 'local' && config.localAssetId ? '' : config.mediaUrl,
						sourceType: config.sourceType === 'local' && config.localAssetId ? 'local' : 'url',
						localAssetId: config.sourceType === 'local' && config.localAssetId ? config.localAssetId : undefined,
						localAssetName: config.sourceType === 'local' && config.localAssetId ? config.localAssetName : undefined,
						mediaType: config.sourceType === 'local' && config.localAssetId ? (config.localMediaType || config.mediaType || 'image') : (config.mediaType || 'iframe'),
						duration: config.duration ?? 10000, // Pass duration to actions.html
						// Positioning and sizing (percent-based)
						width: (typeof config.width === 'number') ? config.width : undefined,
						height: (typeof config.height === 'number') ? config.height : undefined,
						x: (typeof config.x === 'number') ? config.x : undefined,
						y: (typeof config.y === 'number') ? config.y : undefined,
						randomX: !!config.randomX,
						randomY: !!config.randomY,
						// Layer system options
						useLayer: !!config.useLayer,
						clearFirst: config.clearFirst !== false
					};
					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
					} else if (this.sendMessageToTabs) {
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true);
					} else {
						console.warn('[ExecuteAction - playTenorGiphy] No function available to send message to actions page.');
					}
				} else {
					console.warn('[ExecuteAction - playTenorGiphy] Media URL not configured.');
				}
				break;

			case 'showAvatar':
				{
					const actionPayload = {
						actionType: 'show_avatar',
						avatarUrl: config.avatarUrl || '',
						width: config.width ?? 15,
						height: config.height ?? 15,
						x: config.x ?? 5,
						y: config.y ?? 5,
						randomX: !!config.randomX,
						randomY: !!config.randomY,
						borderRadius: config.borderRadius ?? 50,
						borderWidth: config.borderWidth ?? 3,
						borderColor: config.borderColor || '#ffffff',
						shadow: config.shadow !== false,
						duration: config.duration ?? 5000,
						clearFirst: !!config.clearFirst,
						messageData: {
							chatimg: message.chatimg || '',
							chatname: message.chatname || message.displayname || ''
						}
					};
					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
					} else if (this.sendMessageToTabs) {
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true);
					} else {
						console.warn('[ExecuteAction - showAvatar] No function available to send message to actions page.');
					}
				}
				break;

			case 'showText':
				{
					const actionPayload = {
						actionType: 'show_text',
						text: this.replaceTemplateVars(config.text ?? 'Hello {username}!', message),
						textProcessed: true,
						x: config.x ?? 50,
						y: config.y ?? 50,
						width: config.width ?? 80,
						fontSize: config.fontSize ?? 48,
						fontFamily: config.fontFamily || 'Arial',
						fontWeight: config.fontWeight || 'bold',
						textAlign: config.textAlign || 'center',
						color: config.color || '#ffffff',
						backgroundColor: config.backgroundColor || 'rgba(0,0,0,0.5)',
						padding: config.padding ?? 20,
						borderRadius: config.borderRadius ?? 10,
						outlineWidth: config.outlineWidth ?? 2,
						outlineColor: config.outlineColor || '#000000',
						animation: config.animation || 'fadeIn',
						animationDuration: config.animationDuration ?? 500,
						duration: config.duration ?? 5000,
						clearFirst: !!config.clearFirst
					};
					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
					} else if (this.sendMessageToTabs) {
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true);
					} else {
						console.warn('[ExecuteAction - showText] No function available to send message to actions page.');
					}
				}
				break;

			case 'clearLayer':
				{
					const actionPayload = {
						actionType: 'clear_layer',
						layer: config.layer || 'all'
					};
					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
					} else if (this.sendMessageToTabs) {
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true);
					} else {
						console.warn('[ExecuteAction - clearLayer] No function available to send message to actions page.');
					}
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
				if (config.audioUrl || (config.sourceType === 'local' && config.localAssetId)) {
					const actionPayload = {
						actionType: 'play_audio',
						audioUrl: config.sourceType === 'local' && config.localAssetId ? '' : config.audioUrl,
						sourceType: config.sourceType === 'local' && config.localAssetId ? 'local' : 'url',
						localAssetId: config.sourceType === 'local' && config.localAssetId ? config.localAssetId : undefined,
						localAssetName: config.sourceType === 'local' && config.localAssetId ? config.localAssetName : undefined,
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
                    await this.waitForFlowDelay(config.delayMs, execution);
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
                        visible: config.visible,
                        sceneName: config.sceneName || '',
                        groupName: config.groupName || ''
                    };
                    
                    if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
                        this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
                    } else {
                        console.warn('[OBS] sendTargetP2P not available on this instance');
                    }
                }
                break;

			case 'obsSetText':
				if (config.sourceName) {
					const textTemplate = config.text === undefined ? '{message}' : String(config.text);
					const actionPayload = {
						actionType: 'obsSetText',
						sourceName: config.sourceName,
						text: this.replaceTemplateVars(textTemplate, message)
					};

					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
					} else {
						console.warn('[OBS] sendTargetP2P not available on this instance');
					}
				}
				break;

			case 'obsMediaControl':
				if (config.sourceName) {
					const actionPayload = {
						actionType: 'obsMediaControl',
						sourceName: config.sourceName,
						operation: config.operation || 'restart'
					};

					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
					} else {
						console.warn('[OBS] sendTargetP2P not available on this instance');
					}
				}
				break;

			case 'obsSetVolume':
				if (config.sourceName) {
					const actionPayload = {
						actionType: 'obsSetVolume',
						sourceName: config.sourceName,
						volumeDb: Number(config.volumeDb ?? 0)
					};

					if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
						this.sendTargetP2P({ overlayNinja: actionPayload }, 'actions');
					} else {
						console.warn('[OBS] sendTargetP2P not available on this instance');
					}
				}
				break;

			case 'obsRefreshBrowser':
				if (config.sourceName) {
					const actionPayload = {
						actionType: 'obsRefreshBrowser',
						sourceName: config.sourceName
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

			case 'obsReplayBufferControl':
				const replayBufferControlPayload = {
					actionType: 'obsReplayBufferControl',
					operation: config.operation || 'start'
				};

				if (this.sendTargetP2P && typeof this.sendTargetP2P === 'function') {
					this.sendTargetP2P({ overlayNinja: replayBufferControlPayload }, 'actions');
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

            // Spotify Actions
            case 'spotifySkip':
                if (this.sendMessageToBackground) {
                    this.sendMessageToBackground({ spotifyAction: 'skip' });
                }
                break;

            case 'spotifyPrevious':
                if (this.sendMessageToBackground) {
                    this.sendMessageToBackground({ spotifyAction: 'previous' });
                }
                break;

            case 'spotifyPause':
                if (this.sendMessageToBackground) {
                    this.sendMessageToBackground({ spotifyAction: 'pause' });
                }
                break;

            case 'spotifyResume':
                if (this.sendMessageToBackground) {
                    this.sendMessageToBackground({ spotifyAction: 'resume' });
                }
                break;

            case 'spotifyVolume':
                if (this.sendMessageToBackground && config.volume !== undefined) {
                    this.sendMessageToBackground({
                        spotifyAction: 'volume',
                        volume: config.volume
                    });
                }
                break;

            case 'spotifyQueue':
                if (this.sendMessageToBackground) {
                    // Use the chat message as query if configured, otherwise use the static query
                    let query = config.query || '';
                    if (config.useMessageText && message.chatmessage) {
                        // Strip command prefix if present (e.g., "!sr song name" -> "song name")
                        query = message.chatmessage.replace(/^!\w+\s*/, '').trim();
                    }
                    if (query) {
                        this.sendMessageToBackground({
                            spotifyAction: 'queue',
                            query: query
                        });
                    }
                }
                break;

            case 'spotifyToggle':
                if (this.sendMessageToBackground) {
                    this.sendMessageToBackground({ spotifyAction: 'toggle' });
                }
                break;

            case 'spotifyNowPlaying':
                if (this.sendMessageToBackground) {
                    // Get current track and format announcement
                    this.sendMessageToBackground({
                        spotifyAction: 'nowPlaying',
                        format: config.format || '🎵 Now playing: {song} by {artist}',
                        sendToDock: config.sendToDock !== false
                    });
                }
                break;

            case 'spotifyShuffle':
                if (this.sendMessageToBackground) {
                    let shuffleState = config.state;
                    // Convert 'toggle' to null so spotify.js knows to toggle
                    if (shuffleState === 'toggle' || shuffleState === undefined) {
                        shuffleState = null;
                    } else if (shuffleState === 'true') {
                        shuffleState = true;
                    } else if (shuffleState === 'false') {
                        shuffleState = false;
                    }
                    this.sendMessageToBackground({
                        spotifyAction: 'shuffle',
                        state: shuffleState
                    });
                }
                break;

            case 'spotifyRepeat':
                if (this.sendMessageToBackground) {
                    this.sendMessageToBackground({
                        spotifyAction: 'repeat',
                        mode: config.mode || 'off'
                    });
                }
                break;

            // TTS Actions
            case 'ttsSpeak': {
                let ttsText = config.text || '';
                if (config.useMessageText && message.chatmessage) {
                    ttsText = message.chatmessage;
                } else {
                    ttsText = this.replaceTemplateVars(ttsText, message);
                }
                if (ttsText && this.sendTargetP2P) {
                    this.sendTargetP2P({
                        overlayNinja: {
                            actionType: 'tts',
                            text: ttsText,
                            voice: typeof config.voice === 'string' ? config.voice.trim() : '',
                            force: config.force || false
                        }
                    }, 'actions');
                }
                break;
            }

            case 'ttsToggle': {
                if (this.sendTargetP2P) {
                    let enabled = config.enabled;
                    // Convert string values to appropriate types
                    if (enabled === 'true') enabled = true;
                    else if (enabled === 'false') enabled = false;
                    else if (enabled === 'toggle') enabled = undefined; // toggle behavior

                    this.sendTargetP2P({
                        overlayNinja: {
                            actionType: 'toggleTTS',
                            enabled: enabled
                        }
                    }, 'actions');
                }
                break;
            }

            case 'ttsSkip':
                if (this.sendTargetP2P) {
                    this.sendTargetP2P({
                        overlayNinja: { actionType: 'skipTTS' }
                    }, 'actions');
                }
                break;

            case 'ttsClear':
                if (this.sendTargetP2P) {
                    this.sendTargetP2P({
                        overlayNinja: { actionType: 'clearTTS' }
                    }, 'actions');
                }
                break;

            case 'ttsVolume':
                if (this.sendTargetP2P && config.volume !== undefined) {
                    this.sendTargetP2P({
                        overlayNinja: {
                            actionType: 'setTTSVolume',
                            volume: config.volume
                        }
                    }, 'actions');
                }
                break;

            case 'midiSendNote':
                if (!this.midiEnabled || !config.deviceId || !config.note) break;
                
                const noteOutput = this.getMIDIOutputDevice(config.deviceId);
                if (noteOutput) {
                    const velocity = config.velocity ?? 127;
                    const duration = config.duration || 100;
                    const channel = config.channel || 1;
                    
                    try {
                        noteOutput.playNote(config.note, {
                            channels: channel,
                            attack: velocity / 127,
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

            case 'rememberUser': {
                const reason = this.replaceTemplateVars(config.reason || '', message || {});
                const memoryResult = await this.rememberUserInMemory(config.targetNodeId, message, flow, reason);
                if (!memoryResult.success) {
                    console.warn(`[UserMemory] Remember User skipped: ${memoryResult.error}`);
                    break;
                }
                result.message = {
                    ...(message || {}),
                    userMemoryName: memoryResult.name,
                    userMemoryCount: memoryResult.count,
                    userMemoryAdded: memoryResult.added,
                    userMemoryEntryCount: memoryResult.entry.participationCount
                };
                result.modified = true;
                break;
            }

            case 'forgetUser': {
                const memoryResult = await this.forgetUserFromMemory(config.targetNodeId, message, flow);
                if (!memoryResult.success) {
                    console.warn(`[UserMemory] Forget User skipped: ${memoryResult.error}`);
                    break;
                }
                result.message = {
                    ...(message || {}),
                    userMemoryName: memoryResult.name,
                    userMemoryCount: memoryResult.count,
                    userMemoryRemoved: memoryResult.removed
                };
                result.modified = true;
                break;
            }

            case 'clearUserMemory': {
                const memoryResult = await this.clearUserMemory(config.targetNodeId, flow, 'action');
                if (!memoryResult.success) {
                    console.warn(`[UserMemory] Clear User Memory skipped: ${memoryResult.error}`);
                    break;
                }
                result.message = {
                    ...(message || {}),
                    userMemoryName: memoryResult.name,
                    userMemoryCount: 0,
                    userMemoryCleared: true,
                    userMemoryClearedCount: memoryResult.clearedCount
                };
                result.modified = true;
                break;
            }

            case 'pickRandomUser': {
                const memoryResult = await this.pickRandomUserFromMemory(config.targetNodeId, flow, config.removeSelected === true);
                if (!memoryResult.success) {
                    result.message = {
                        ...(message || {}),
                        userMemoryName: memoryResult.name || '',
                        userMemoryCount: memoryResult.count || 0,
                        userMemoryEmpty: memoryResult.empty === true
                    };
                    result.modified = true;
                    break;
                }
                result.message = {
                    ...(message || {}),
                    userMemoryName: memoryResult.name,
                    userMemoryCount: memoryResult.count,
                    userMemoryPicked: true,
                    selectedUser: memoryResult.entry.chatname || memoryResult.entry.userid || '',
                    selectedUserId: memoryResult.entry.userid || '',
                    selectedUserSource: memoryResult.entry.type || '',
                    selectedUserAvatar: memoryResult.entry.chatimg || '',
                    selectedUserParticipationCount: memoryResult.entry.participationCount || 1,
                    selectedUserReason: memoryResult.entry.reason || '',
                    selectedUserRemoved: memoryResult.removed
                };
                result.modified = true;
                break;
            }
                
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
                    const allFlows = flow ? [flow, ...(this.flows || []).filter(candidate => candidate !== flow)] : (this.flows || []);
                    let targetNode = null;
                    let targetFlow = null;
                    
                    for (const candidateFlow of allFlows) {
                        targetNode = candidateFlow.nodes?.find(n => n.id === config.targetNodeId);
                        if (targetNode) {
                            targetFlow = candidateFlow;
                            break;
                        }
                    }
                    
                    if (targetNode && targetNode.type === 'state') {
                        if (targetNode.stateType === 'USER_MEMORY') {
                            await this.clearUserMemory(config.targetNodeId, targetFlow, 'reset-state-node');
                        } else {
                            this.initializeStateNode(config.targetNodeId, targetNode.stateType, targetNode.config || {});
                        }
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
                        const counterRemaining = Math.max(0, (Number(counterState.targetCount) || 0) - (Number(counterState.count) || 0));
                        // Add counter info to message
                        result.message = {
                            ...message,
                            counterValue: counterState.count,
                            counterTarget: counterState.targetCount,
                            counterRemaining: counterRemaining
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
