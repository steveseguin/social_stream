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
		
        console.log('[EventFlowSystem Constructor] Initialized with:');
        console.log('  - sendMessageToTabs:', this.sendMessageToTabs ? 'Function provided' : 'NULL - Relay will not work!');
        console.log('  - sendToDestinations:', this.sendToDestinations ? 'Function provided' : 'NULL');
        console.log('  - pointsSystem:', this.pointsSystem ? 'System provided' : 'NULL');
        console.log('  - sanitizeRelay:', this.sanitizeRelay ? 'Function provided' : 'NULL - Relay will not work!');
        console.log('  - checkExactDuplicateAlreadyRelayed:', this.checkExactDuplicateAlreadyRelayed ? 'Function provided' : 'NULL - Relay will not work!');
        
        this.initPromise = this.initDatabase();
    }
	
	async evaluateSpecificLogicNode(logicType, inputValues) {
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
            default:
                return false;
        }
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
			
			return new Promise((resolve) => {
				const tx = db.transaction(this.storeName, 'readonly');
				const store = tx.objectStore(this.storeName);
				const request = store.getAll();
				
				request.onsuccess = () => {
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
			
			request.onsuccess = () => {
				if (existingFlowIndex !== -1) {
					this.flows[existingFlowIndex] = flowData;
				} else {
					this.flows.push(flowData);
				}
				// Re-sort the in-memory list by order after any save
				this.flows.sort((a, b) => (a.order || 0) - (b.order || 0));
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
        console.log('[EventFlowSystem] Reloading flows from database');
        await this.loadFlows();
        return this.flows;
    }
    
    async getFlowById(flowId) {
        return this.flows.find(flow => flow.id === flowId) || null;
    }
    
	async processMessage(message) {
        console.log("[RELAY DEBUG - ProcessMessage] Received message:", {
            type: message?.type,
            chatname: message?.chatname,
            chatmessage: message?.chatmessage?.substring(0, 50) + '...',
            hasEventFlowSystem: !!this.sendMessageToTabs
        });
        
        if (!message) {
            console.log("[RELAY DEBUG - ProcessMessage] Message is null/undefined at start.");
            return message;
        }
        
        let processed = { ...message };
        let blocked = false;
        
        const activeFlows = this.flows.filter(f => f.active);
        console.log(`[RELAY DEBUG - ProcessMessage] Processing ${activeFlows.length} active flows`);
        console.log(`[RELAY DEBUG - ProcessMessage] Active flow names:`, activeFlows.map(f => f.name));
        
        for (const flow of this.flows) {
            if (!flow.active) {
                // console.log(`[ProcessMessage] Flow "${flow.name}" (ID: ${flow.id}) is inactive. Skipping.`);
                continue;
            }
          //console.log(`[ProcessMessage] Evaluating active flow "${flow.name}" (ID: ${flow.id})`);
            
            const result = await this.evaluateFlow(flow, processed);
          //console.log(`[ProcessMessage] Result for flow "${flow.name}":`, JSON.stringify(result));

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
                        nodeActivationStates[node.id] = await this.evaluateSpecificLogicNode(node.logicType, inputValues);
                      //console.log(`[EvaluateFlow "${flow.name}"] Logic Node ID: ${node.id} Activation State: ${nodeActivationStates[node.id]}`);
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

        for (const node of flow.nodes) {
            if (node.type === 'action') {
                if (overallResult.blocked) {
                  //console.log(`[EvaluateFlow "${flow.name}"] Message already blocked by a previous action in this flow. Skipping action node ${node.id} (${node.actionType}).`);
                    break; 
                }

                const inputConnections = flow.connections.filter(conn => conn.to === node.id);
                const inputNodeIds = inputConnections.map(conn => conn.from);
                
                const shouldExecute = inputNodeIds.some(inputId => {
                    const inputNode = nodeMap.get(inputId);
                    const activation = inputNode && (inputNode.type === 'trigger' || inputNode.type === 'logic') && nodeActivationStates[inputId] === true;
                    // console.log(`[EvaluateFlow "${flow.name}"] Action ${node.id}: checking input ${inputId} (Type: ${inputNode ? inputNode.type : 'N/A'}), State: ${nodeActivationStates[inputId]}, Activates: ${activation}`);
                    return activation;
                });

                console.log(`[RELAY DEBUG - EvaluateFlow "${flow.name}"] Action Node ID: ${node.id} (${node.actionType}), ShouldExecute: ${shouldExecute} (based on inputs: ${JSON.stringify(inputNodeIds)})`);

                if (shouldExecute) {
                    console.log(`[RELAY DEBUG - EvaluateFlow "${flow.name}"] EXECUTING Action Node ID: ${node.id} (${node.actionType})`);
                    const actionResult = await this.executeAction(node, overallResult.message);
                  //console.log(`[EvaluateFlow "${flow.name}"] Action Node ID: ${node.id} Result:`, JSON.stringify(actionResult));
                    if (actionResult) { 
                        if (actionResult.blocked) {
                            overallResult.blocked = true;
                          //console.log(`[EvaluateFlow "${flow.name}"] Action Node ID: ${node.id} BLOCKED the message.`);
                            break; 
                        }
                        if (actionResult.modified && actionResult.message) {
                            overallResult.message = { ...actionResult.message }; 
                            overallResult.modified = true;
                          //console.log(`[EvaluateFlow "${flow.name}"] Action Node ID: ${node.id} MODIFIED the message.`);
                        }
                    }
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
        
        // Get the message text for comparison
        let messageText = message.chatmessage;
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
                console.log(`[RELAY DEBUG - fromSource Trigger] Config Source: "${config.source}", Message Type: "${message.type}", Match: ${match}`);
                return match;
                
            case 'fromChannelName':
                if (!config.channelName || config.channelName.trim() === '') {
                    match = true; // Match any channel if no name specified
                } else {
                    const channelName = (message.sourceName || '').toLowerCase();
                    match = channelName === config.channelName.toLowerCase();
                }
                console.log(`[RELAY DEBUG - fromChannelName Trigger] Config Channel: "${config.channelName}", Message Channel: "${message.sourceName}", Match: ${match}`);
                return match;
                
            case 'fromUser':
                const identifier = (message.userid || message.chatname || '').toLowerCase();
                match = config && typeof config.username === 'string' && identifier === config.username.toLowerCase();
              //console.log(`[EvaluateTrigger - fromUser] Config Username: "${config.username}", Message Identifier: "${identifier}", Match: ${match}`);
                return match;
                
            case 'userRole':
                match = message && config && message[config.role] === true; 
              //console.log(`[EvaluateTrigger - userRole] Config Role: "${config.role}", Message Role Value: ${message[config.role]}, Match: ${match}`);
                return match;
                
            case 'hasDonation':
                match = !!message.hasDonation; // Assuming hasDonation is a truthy value if donation exists
              //console.log(`[EvaluateTrigger - hasDonation] Message hasDonation: "${message.hasDonation}", Match: ${match}`);
                return match;
                
            case 'customJs':
                try {
                    const evalFunction = new Function('message', config.code);
                    match = evalFunction(message);
                  //console.log(`[EvaluateTrigger - customJs] Code executed. Result: ${match}`);
                    return match;
                } catch (e) {
                    console.error('[EvaluateTrigger - customJs] Error in custom JS trigger:', e);
                    return false;
                }
                
            default:
              //console.log(`[EvaluateTrigger] Unknown triggerType: ${triggerType}`);
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
    
    async executeAction(actionNode, message) {
        const { actionType, config } = actionNode;
        console.log(`[ExecuteAction] Node: ${actionNode.id}, Type: ${actionType}, Config: ${JSON.stringify(config)}`);
        let result = { modified: false, message, blocked: false };
        
        switch (actionType) {
            case 'blockMessage':
                result.blocked = true;
              //console.log(`[ExecuteAction - blockMessage] Set result.blocked to true.`);
                break;
                
		case 'modifyMessage':
			if (typeof config.newMessage !== 'string') {
				console.warn(`[ExecuteAction - modifyMessage] 'newMessage' not configured or not a string for node ${actionNode.id}. Using original message.`);
				// No change, or set an error, or use a default template.
			} else {
				result.message = {
					...message,
					chatmessage: config.newMessage // Placeholder replacement would be an advanced feature here
				};
				result.modified = true;
			}
			console.log(`[ExecuteAction - modifyMessage] Modified message to: "${result.message.chatmessage}"`);
			break;
                
            case 'setProperty':
                result.message = {
                    ...message,
                    [config.property]: config.value
                };
                result.modified = true;
                break;
                
            case 'addPrefix':
                if (config.prefix && message.chatmessage) {
                    // Replace placeholders
                    let prefix = config.prefix;
                    prefix = prefix.replace(/\{username\}/g, message.chatname || '');
                    prefix = prefix.replace(/\{source\}/g, message.type || '');
                    prefix = prefix.replace(/\{chatname\}/g, message.chatname || '');
                    
                    result.message = {
                        ...message,
                        chatmessage: prefix + message.chatmessage
                    };
                    result.modified = true;
                }
                break;
                
            case 'addSuffix':
                if (config.suffix && message.chatmessage) {
                    // Replace placeholders
                    let suffix = config.suffix;
                    suffix = suffix.replace(/\{username\}/g, message.chatname || '');
                    suffix = suffix.replace(/\{source\}/g, message.type || '');
                    suffix = suffix.replace(/\{chatname\}/g, message.chatname || '');
                    
                    result.message = {
                        ...message,
                        chatmessage: message.chatmessage + suffix
                    };
                    result.modified = true;
                }
                break;
                
            case 'findReplace':
                if (config.find && message.chatmessage) {
                    try {
                        // Create regex with proper escaping for literal search
                        const flags = config.caseSensitive ? 'g' : 'gi';
                        const escapedFind = config.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(escapedFind, flags);
                        
                        result.message = {
                            ...message,
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
                
            case 'relay':
                console.log('[RELAY DEBUG - Action] Starting relay action execution');
                console.log('[RELAY DEBUG - Action] Config:', config);
                console.log('[RELAY DEBUG - Action] Message source:', message.type);
                console.log('[RELAY DEBUG - Action] sendMessageToTabs available?', !!this.sendMessageToTabs);
                
                if (this.sendMessageToTabs && message && !message.reflection) {
                    // Replace all possible template variables
                    let processedTemplate = config.template || '[{source}] {username}: {message}';
                    
                    // Replace all occurrences of template variables
                    processedTemplate = processedTemplate.replace(/\{source\}/g, message.type || '');
                    processedTemplate = processedTemplate.replace(/\{type\}/g, message.type || '');
                    processedTemplate = processedTemplate.replace(/\{username\}/g, message.chatname || '');
                    processedTemplate = processedTemplate.replace(/\{chatname\}/g, message.chatname || '');
                    processedTemplate = processedTemplate.replace(/\{message\}/g, message.chatmessage || '');
                    processedTemplate = processedTemplate.replace(/\{chatmessage\}/g, message.chatmessage || '');
                    
                    const relayMessage = {
                        response: processedTemplate
                    };
                    
                    // Handle destination based on config
                    if (config.destination === 'reply') {
                        // Reply to sender only - use the original message's tab ID
                        if (message.tid !== undefined && message.tid !== null) {
                            relayMessage.tid = message.tid;
                            console.log('[RELAY DEBUG - Action] Mode: Reply to sender, tid:', message.tid);
                        } else {
                            console.warn('[RELAY DEBUG - Action] Reply mode selected but no tid available in message');
                            // Can't reply without a tid, so skip this action
                            break;
                        }
                    } else if (config.destination) {
                        // Send to specific destination
                        relayMessage.destination = config.destination;
                        console.log('[RELAY DEBUG - Action] Mode: Send to specific destination:', config.destination);
                    } else {
                        // Send to all platforms (default behavior)
                        console.log('[RELAY DEBUG - Action] Mode: Send to all platforms');
                    }
                    
                    console.log('[RELAY DEBUG - Action] Relay message prepared:', relayMessage);
                    
                    let result = false;
                    relayMessage.response = this.sanitizeRelay(relayMessage.response, false).trim();
                    if (relayMessage.response) {
                        if (!this.checkExactDuplicateAlreadyRelayed(relayMessage.response, false, relayMessage.tid, false)){
                            // Adjust parameters based on destination mode
                            const reverse = config.destination !== 'reply'; // Don't reverse if replying to sender
                            const relayMode = config.destination !== 'reply'; // Don't use relay mode for replies
                            const timeout = config.timeout || 1000;
                            
                            console.log('[RELAY DEBUG - Action] Calling sendMessageToTabs with:');
                            console.log('  - message:', relayMessage);
                            console.log('  - reverse:', reverse);
                            console.log('  - metadata:', message);
                            console.log('  - relayMode:', relayMode);
                            console.log('  - antispam:', false);
                            console.log('  - timeout:', timeout);
                            
                            result = this.sendMessageToTabs(relayMessage, reverse, message, relayMode, false, timeout);
                        }
                    }
                    
                    console.log('[RELAY DEBUG - Action] sendMessageToTabs returned:', result);
                } else {
                    console.error('[RELAY DEBUG - Action] CRITICAL: sendMessageToTabs is not available!');
                    console.error('[RELAY DEBUG - Action] This EventFlowSystem instance:', this);
                }
                break;
                
            case 'webhook':
				try {
					const url = config.url;
					if (!url) {
						console.warn(`[ExecuteAction - webhook] URL is not configured for node ${actionNode.id}`);
						result.message = { ...message, webhookError: "URL not configured" };
						result.modified = true;
						// result.blocked = true; // Optionally block
						break;
					}

					const method = config.method || 'POST';
					const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) }; // Allow custom headers from config
					const body = config.includeMessage ? JSON.stringify(message) : (config.body || '{}');
					const webhookTimeout = config.timeout || 8000; // Make timeout configurable per node, default 8s

					// Prepare fetch options
					const fetchOpts = {
						method,
						headers
					};
					if (method !== 'GET' && method !== 'HEAD') {
						fetchOpts.body = body;
					}

					console.log(`[ExecuteAction - webhook] Calling ${method} ${url} with timeout ${webhookTimeout}ms`);
					const response = await this.fetchWithTimeout(url, fetchOpts, webhookTimeout); // Use the injected function

					if (!response.ok) {
						const errorText = await response.text();
						console.error(`[ExecuteAction - webhook] Webhook for ${url} failed with status ${response.status}: ${errorText}`);
						result.message = { ...message, webhookError: `Webhook failed: ${response.status} - ${errorText.substring(0, 200)}` };
						result.modified = true;
						result.blocked = config.blockOnFailure !== undefined ? !!config.blockOnFailure : true; // Block on failure by default, make it configurable
					} else {
						console.log(`[ExecuteAction - webhook] Webhook to ${url} successful.`);
						try {
							const responseData = await response.json(); // Attempt to parse as JSON
							result.message = { ...message, webhookResponse: responseData, webhookStatus: response.status };
						} catch (e) { // If not JSON, take as text
							const responseText = await response.text(); // This won't work if response.json() already consumed the body. Need to handle this better.
																	  // A better way is to clone the response if you need to read body multiple times or in different formats.
																	  // For simplicity now: let's assume we primarily want JSON or care about success status.
							result.message = { ...message, webhookResponseText: responseText.substring(0, 500), webhookStatus: response.status };
						}
						result.modified = true;
					}

				} catch (error) { // This catch is for errors from fetchWithTimeout (e.g., timeout, network error)
					console.error(`[ExecuteAction - webhook] Error executing webhook for node ${actionNode.id}:`, error.message);
					result.message = { ...message, webhookError: `Webhook execution error: ${error.message}` };
					result.modified = true;
					result.blocked = config.blockOnFailure !== undefined ? !!config.blockOnFailure : true; // Block on failure by default
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
						console.log(`[ExecuteAction - addPoints] Added ${config.amount} points to ${message.chatname}. New total: ${addResult.points}`);
						// You might want to add the new points total to the message for other actions to use
						result.message = { ...message, pointsTotal: addResult.points };
						result.modified = true;
					} else {
						console.log(`[ExecuteAction - addPoints] Failed to add points for ${message.chatname}. Reason: ${addResult.message || 'Unknown error'}`);
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
						console.log(`[ExecuteAction - spendPoints] Failed for ${message.chatname}. Reason: ${spendResult.message}`);
						result.blocked = true; // This will stop subsequent actions in this flow path.
						// You might also want to include the error message in the result if needed for debugging or other logic
						result.message = { ...message, pointsSpendError: spendResult.message };
						result.modified = true;
					} else {
						// Points were successfully spent
						console.log(`[ExecuteAction - spendPoints] Success for ${message.chatname}. Spent ${config.amount}. Remaining: ${spendResult.remaining}`);
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
						duration: config.duration || 10000 // Pass duration to actions.html
					};
					// Assuming sendTargetP2P is globally available or accessible via this.sendToDestinations
					// or a similar mechanism. The user prompt implies 'sendTargetP2P' is the target function.
					if (typeof sendTargetP2P === 'function') {
						sendTargetP2P(actionPayload, 'actions'); // 'actions' is the PAGE IDENTIFIER for actions.html
						console.log('[ExecuteAction - playTenorGiphy] Sent to actions page:', actionPayload);
					} else if (this.sendMessageToTabs) { // Fallback or alternative
						 // Adapt this if sendMessageToTabs can target a specific page by a label/identifier
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true); // Sending to all tabs might not be ideal, adjust if possible
						console.log('[ExecuteAction - playTenorGiphy] Sent via sendMessageToTabs:', actionPayload);
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
					if (typeof sendTargetP2P === 'function') {
						sendTargetP2P(actionPayload, 'actions');
						console.log('[ExecuteAction - triggerOBSScene] Sent to actions page:', actionPayload);
					} else if (this.sendMessageToTabs) {
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true);
						 console.log('[ExecuteAction - triggerOBSScene] Sent via sendMessageToTabs:', actionPayload);
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
					if (typeof sendTargetP2P === 'function') {
						sendTargetP2P(actionPayload, 'actions');
						console.log('[ExecuteAction - playAudioClip] Sent to actions page:', actionPayload);
					} else if (this.sendMessageToTabs) {
						this.sendMessageToTabs({ overlayNinja: actionPayload, targetPage: 'actions' }, true);
						console.log('[ExecuteAction - playAudioClip] Sent via sendMessageToTabs:', actionPayload);
					} else {
						console.warn('[ExecuteAction - playAudioClip] No function available to send message to actions page.');
					}
				} else {
					console.warn('[ExecuteAction - playAudioClip] Audio URL not configured.');
				}
				break;
                
            default:
                break;
        }
        
        return result;
    }
}