class EventFlowSystem {
    constructor(options = {}) {
        this.flows = [];
        this.db = null;
        this.dbName = options.dbName || 'eventFlowDB';
        this.storeName = options.storeName || 'flowSettings';
        this.pointsSystem = options.pointsSystem || null;
        this.sendMessageToTabs = options.sendMessageToTabs || null;
        this.sendToDestinations = options.sendToDestinations || null;
        
        // Initialize database
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
                this.flows = request.result.map(flow => {
                    return {
                        ...flow,
                        active: flow.active !== false // Default to active if not specified
                    };
                });
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
        
        // Generate ID if not present
        if (!flowData.id) {
            flowData.id = Date.now().toString();
        }
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            
            const request = store.put(flowData);
            
            request.onsuccess = () => {
                // Update in-memory flow
                const existingIndex = this.flows.findIndex(f => f.id === flowData.id);
                if (existingIndex >= 0) {
                    this.flows[existingIndex] = flowData;
                } else {
                    this.flows.push(flowData);
                }
                resolve(flowData);
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    async deleteFlow(flowId) {
        const db = await this.ensureDB();
        
        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(flowId);
            
            request.onsuccess = () => {
                this.flows = this.flows.filter(flow => flow.id !== flowId);
                resolve({ success: true, message: "Flow deleted" });
            };
            
            request.onerror = () => {
                resolve({ success: false, message: "Error deleting flow" });
            };
        });
    }
    
    async getAllFlows() {
        return this.flows;
    }
    
    async getFlowById(flowId) {
        return this.flows.find(flow => flow.id === flowId) || null;
    }
    
    async processMessage(message) {
        if (!message) return message;
        
        let processed = { ...message };
        let blocked = false;
        
        // Process through all active flows
        for (const flow of this.flows) {
            if (!flow.active) continue;
            
            const result = await this.evaluateFlow(flow, processed);
            if (result) {
                if (result.blocked) {
                    blocked = true;
                    break;
                }
                
                if (result.modified) {
                    processed = result.message;
                }
            }
        }
        
        return blocked ? null : processed;
    }
    
    async evaluateFlow(flow, message) {
        if (!flow.nodes || !flow.connections) {
            return { modified: false, message, blocked: false };
        }

        const nodeActivationStates = {}; // Stores true/false for each trigger and logic node

        // --- Pass 1: Evaluate all base triggers ---
        for (const node of flow.nodes) {
            if (node.type === 'trigger') {
                nodeActivationStates[node.id] = await this.evaluateTrigger(node, message);
            }
        }

        // --- Pass 2: Iteratively evaluate logic nodes ---
        // This loop continues as long as new logic node states can be determined.
        // It handles dependencies where logic nodes feed into other logic nodes.
        let madeChangeInLoop = true;
        const maxIterations = flow.nodes.length + 5; // Safety break for complex or cyclic flows
        let iterations = 0;

        while (madeChangeInLoop && iterations < maxIterations) {
            madeChangeInLoop = false;
            iterations++;

            for (const node of flow.nodes) {
                if (node.type === 'logic' && !nodeActivationStates.hasOwnProperty(node.id)) {
                    const inputConnections = flow.connections.filter(conn => conn.to === node.id);
                    const inputNodeIds = inputConnections.map(conn => conn.from);

                    // Check if all direct inputs to this logic node have been evaluated
                    const allInputsEvaluated = inputNodeIds.every(inputId => nodeActivationStates.hasOwnProperty(inputId));

                    if (allInputsEvaluated) {
                        const inputValues = inputNodeIds.map(inputId => nodeActivationStates[inputId]);
                        nodeActivationStates[node.id] = await this.evaluateSpecificLogicNode(node.logicType, inputValues);
                        madeChangeInLoop = true;
                    }
                }
            }
        }
        if (iterations >= maxIterations) {
            console.warn("Flow evaluation exceeded max iterations. Check for complex dependencies or cycles involving logic nodes.");
        }


        // --- Pass 3: Execute actions ---
        let overallResult = { modified: false, message: { ...message }, blocked: false }; // Operate on a copy

        // Create a map of nodes for quick lookup
        const nodeMap = new Map(flow.nodes.map(node => [node.id, node]));

        for (const node of flow.nodes) {
            if (node.type === 'action') {
                if (overallResult.blocked) break; // Stop if a previous action blocked the message

                const inputConnections = flow.connections.filter(conn => conn.to === node.id);
                const inputNodeIds = inputConnections.map(conn => conn.from);

                // An action is triggered if any of its connected evaluated inputs (trigger or logic) is true
                const shouldExecute = inputNodeIds.some(inputId => {
                    const inputNode = nodeMap.get(inputId);
                    // Check if the input node is a trigger or logic node and its state is true
                    return inputNode && (inputNode.type === 'trigger' || inputNode.type === 'logic') && nodeActivationStates[inputId] === true;
                });

                if (shouldExecute) {
                    const actionResult = await this.executeAction(node, overallResult.message);
                    if (actionResult) { // Ensure actionResult is not null/undefined
                        if (actionResult.blocked) {
                            overallResult.blocked = true;
                            // If blocked, we might want to stop processing further actions in this flow.
                            break; 
                        }
                        if (actionResult.modified && actionResult.message) {
                            overallResult.message = { ...actionResult.message }; // Update message state
                            overallResult.modified = true;
                        }
                    }
                }
            }
        }
        return overallResult;
    }
    
    async evaluateTrigger(triggerNode, message) {
        const { triggerType, config } = triggerNode;
        
        switch (triggerType) {
            case 'messageContains':
                return message.chatmessage && message.chatmessage.includes(config.text);
                
            case 'messageStartsWith':
                return message.chatmessage && message.chatmessage.startsWith(config.text);
                
            case 'messageEquals':
                return message.chatmessage === config.text;
                
            case 'messageRegex':
                try {
                    const regex = new RegExp(config.pattern, config.flags || '');
                    return regex.test(message.chatmessage);
                } catch (e) {
                    console.error('Invalid regex in trigger:', e);
                    return false;
                }
                
            case 'fromSource':
                return message.type === config.source;
                
            case 'fromUser':
                const identifier = (message.userid || message.chatname || '').toLowerCase();
                return identifier === config.username.toLowerCase();
                
            case 'userRole':
                return message[config.role] === true; // mod, host, admin, etc.
                
            case 'hasDonation':
                return !!message.hasDonation;
                
            case 'customJs':
                try {
                    // Using Function constructor to create a function from the string
                    const evalFunction = new Function('message', config.code);
                    return evalFunction(message);
                } catch (e) {
                    console.error('Error in custom JS trigger:', e);
                    return false;
                }
                
            default:
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
        let result = { modified: false, message, blocked: false };
        
        switch (actionType) {
            case 'blockMessage':
                result.blocked = true;
                break;
                
            case 'modifyMessage':
                result.message = {
                    ...message,
                    chatmessage: config.newMessage || message.chatmessage
                };
                result.modified = true;
                break;
                
            case 'setProperty':
                result.message = {
                    ...message,
                    [config.property]: config.value
                };
                result.modified = true;
                break;
                
            case 'relay':
                if (this.sendMessageToTabs) {
                    const relayMessage = {
                        response: config.template
                            .replace('{username}', message.chatname || '')
                            .replace('{message}', message.chatmessage || '')
                    };
                    
                    if (message.tid) {
                        relayMessage.tid = message.tid;
                    }
                    
                    if (config.destination) {
                        relayMessage.destination = config.destination;
                    }
                    
                    this.sendMessageToTabs(relayMessage, config.toAll, null, false, false, config.timeout || 0);
                }
                break;
                
            case 'webhook':
                try {
                    const url = config.url;
                    if (!url) break;
                    
                    const method = config.method || 'GET';
                    const body = config.includeMessage ? JSON.stringify(message) : config.body;
                    
                    fetch(url, {
                        method,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: method !== 'GET' ? body : undefined
                    }).catch(err => console.error('Webhook error:', err));
                } catch (error) {
                    console.error('Error executing webhook action:', error);
                }
                break;
                
            case 'spendPoints':
                if (this.pointsSystem && config.amount > 0) {
                    await this.pointsSystem.spendPoints(
                        message.chatname,
                        message.type,
                        config.amount
                    );
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
                
            default:
                break;
        }
        
        return result;
    }
}