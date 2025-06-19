class EventFlowEditor {
    constructor(container, eventFlowSystem) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.eventFlowSystem = eventFlowSystem;
        this.currentFlow = {
            id: null,
            name: 'New Flow',
            description: '',
            active: true,
            nodes: [],
            connections: []
        };
		this.draggedFlowItem = null;
        this.selectedNode = null;
        this.draggedNode = null;
        this.draggedConnection = null;
        this.dragOffset = { x: 0, y: 0 };
        this.unsavedChanges = false;
		
        // Initialize all node type definitions here
        this.triggerTypes = [
            { id: 'messageContains', name: 'Message Contains' },
            { id: 'messageStartsWith', name: 'Message Starts With' },
            { id: 'messageEquals', name: 'Message Equals' },
            { id: 'messageRegex', name: 'Message Regex' },
            { id: 'fromSource', name: 'From Source' },
            { id: 'fromChannelName', name: 'From Channel Name' },
            { id: 'fromUser', name: 'From User' },
            { id: 'userRole', name: 'User Role' },
            { id: 'hasDonation', name: 'Has Donation' },
            { id: 'customJs', name: 'Custom JavaScript' }
        ];

		this.actionTypes = [
			{ id: 'blockMessage', name: 'Block Message' },
			{ id: 'modifyMessage', name: 'Modify Message' },
			{ id: 'setProperty', name: 'Set Property' },
			{ id: 'relay', name: 'Relay Message' },
			{ id: 'webhook', name: 'Call Webhook' },
			{ id: 'spendPoints', name: 'Spend Points' },
			{ id: 'playTenorGiphy', name: 'Play TENOR/GIPHY' }, // <-- New Action
			{ id: 'triggerOBSScene', name: 'Trigger OBS Scene' }, // <-- New Action
			{ id: 'playAudioClip', name: 'Play Audio Clip' },   // <-- New Action
			{ id: 'customJs', name: 'Custom JavaScript' }
		];

        // Ensure logicNodeTypes is initialized HERE
        this.logicNodeTypes = [
            { id: 'AND', name: 'AND Gate', type: 'logic', logicType: 'AND' }, // Added type/logicType for consistency if needed elsewhere
            { id: 'OR', name: 'OR Gate', type: 'logic', logicType: 'OR' },
            { id: 'NOT', name: 'NOT Gate', type: 'logic', logicType: 'NOT' }
        ];

        this.init(); // init() will call createEditorLayout()
    }

    init() {
        this.createEditorLayout(); // Now this.logicNodeTypes will be defined
        this.initEventListeners();
        this.loadFlowList();
    }

    createEditorLayout() {
        this.container.innerHTML = `
            <div class="flow-editor-container">
                <div class="flow-sidebar">
                    <div class="flow-list-container">
                        <h3>Flows</h3>
                        <div class="flow-list" id="flow-list"></div>
                        <button id="new-flow-btn" class="btn">Create New Flow</button>
                    </div>
                    <div class="node-palette">
                        <h3>Triggers</h3>
                        <div class="node-list" id="trigger-list">
                            ${this.triggerTypes.map(trigger => `
                                <div class="node-item trigger" data-nodetype="trigger" data-subtype="${trigger.id}" draggable="true">
                                    ${trigger.name}
                                </div>
                            `).join('')}
                        </div>
                        <h3>Actions</h3>
                        <div class="node-list" id="action-list">
                            ${this.actionTypes.map(action => `
                                <div class="node-item action" data-nodetype="action" data-subtype="${action.id}" draggable="true">
                                    ${action.name}
                                </div>
                            `).join('')}
                        </div>
                        <h3>Logic Gates</h3>
                        <div class="node-list" id="logic-list">
                            ${this.logicNodeTypes.map(logicNode => `
                                <div class="node-item logic" data-nodetype="logic" data-subtype="${logicNode.id}" draggable="true">
                                    ${logicNode.name}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="flow-editor">
                    <div class="flow-editor-header">
						<input type="text" id="flow-name" placeholder="Flow Name">
						<div class="flow-controls">
							<button id="save-flow-btn" class="btn btn-primary">Save Flow</button>
							<button id="duplicate-flow-btn" class="btn">Duplicate</button>
							<label class="flow-active-toggle">
								<input type="checkbox" id="flow-active">
								<span class="slider round"></span>
								Active
							</label>
						</div>
					</div>
                    <div class="flow-canvas-container">
                        <div class="flow-canvas" id="flow-canvas"></div>
                    </div>
                </div>
                <div class="node-properties" id="node-properties">
                    <h3>Node Properties</h3>
                    <div class="node-properties-content" id="node-properties-content">
                        <p>Select a node to view properties</p>
                    </div>
                </div>
            </div>
        `;
		const saveButton = document.getElementById('save-flow-btn');
		if (saveButton) {
			saveButton.classList.add('disabled'); // Start with disabled state
		}
    }

    initEventListeners() {
        document.getElementById('new-flow-btn').addEventListener('click', () => this.createNewFlow());
        document.getElementById('save-flow-btn').addEventListener('click', () => this.saveCurrentFlow());
        document.getElementById('duplicate-flow-btn').addEventListener('click', () => this.duplicateCurrentFlow());

        document.getElementById('flow-active').addEventListener('change', (e) => {
            if (this.currentFlow) {
                this.currentFlow.active = e.target.checked;
                this.markUnsavedChanges(true);
            }
        });
		document.getElementById('flow-name').addEventListener('input', (e) => {
			if (this.currentFlow) {
				// Update the internal name value WITHOUT the asterisk
				const inputValue = e.target.value;
				this.currentFlow.name = inputValue.endsWith('*') ? inputValue.slice(0, -1) : inputValue;
				
				// Only mark as unsaved if the name has actually changed
				if (this.currentFlow.id && this.currentFlow.name !== this.originalFlowName) {
					this.markUnsavedChanges(true);
				}
			}
		});

        const triggerItems = document.querySelectorAll('#trigger-list .node-item');
        triggerItems.forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleNodeDragStart(e, 'trigger', item.dataset.subtype)); // Changed to subtype
        });
        const actionItems = document.querySelectorAll('#action-list .node-item');
        actionItems.forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleNodeDragStart(e, 'action', item.dataset.subtype)); // Changed to subtype
        });
		const logicItems = document.querySelectorAll('#logic-list .node-item');
        logicItems.forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleNodeDragStart(e, 'logic', item.dataset.subtype));
        });
		
        const canvas = document.getElementById('flow-canvas');
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        canvas.addEventListener('drop', (e) => this.handleCanvasDrop(e));
        canvas.addEventListener('click', (e) => {
            if (e.target === canvas) {
                this.selectNode(null);
            }
        });

        ['input', 'change'].forEach(eventType => {
            this.container.addEventListener(eventType, (e) => {
                if (e.target.closest('.node-properties') || e.target.closest('.flow-canvas')) {
                    // More specific checks might be needed if this is too broad
                    // For now, assume direct interaction implies a change
                    if (this.currentFlow && this.currentFlow.id) { // Only mark if a flow is loaded
                        this.markUnsavedChanges(true);
                    }
                }
            });
        });
    }
    
	markUnsavedChanges(hasChanges) {
		this.unsavedChanges = hasChanges;
		const flowNameInput = document.getElementById('flow-name');
		const saveButton = document.getElementById('save-flow-btn');
		
		if (!flowNameInput || !saveButton || !this.currentFlow) return;

		// Get the base name without any asterisks
		let baseName = flowNameInput.value;
		while (baseName.endsWith('*')) {
			baseName = baseName.slice(0, -1);
		}
		
		// Set the input value with or without asterisk
		flowNameInput.value = hasChanges ? baseName + '*' : baseName;
		
		// Update save button appearance
		if (hasChanges) {
			saveButton.classList.remove('disabled');
		} else {
			saveButton.classList.add('disabled');
		}
	}

    async loadFlowList() {
        const flows = await this.eventFlowSystem.getAllFlows(); // Should be pre-sorted by order
        const flowListEl = document.getElementById('flow-list');
        flowListEl.innerHTML = ''; // Clear previous list

        flows.forEach(flow => {
            const item = document.createElement('div');
            item.className = `flow-item ${this.currentFlow && this.currentFlow.id === flow.id ? 'selected-flow' : ''}`;
            item.dataset.id = flow.id;
            item.dataset.order = flow.order; // Store order for reference if needed
            item.draggable = true;

            item.innerHTML = `
                <span class="drag-handle">⠿</span>
                <div class="flow-item-name">${flow.name || 'Unnamed Flow'}</div>
                <div class="flow-item-controls">
                    <span class="flow-item-status ${flow.active ? 'active' : 'inactive'}" title="${flow.active ? 'Active' : 'Inactive'}">
                        ${flow.active ? '✓' : '◯'}
                    </span>
                    <span class="flow-item-delete" data-id="${flow.id}" title="Delete Flow">×</span>
                </div>
            `;
            flowListEl.appendChild(item);

            // Event listeners for each item
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('flow-item-delete') || (e.target.parentElement && e.target.parentElement.classList.contains('flow-item-delete'))) {
                    return; // Deletion handled by its own listener
                }
                if (e.target.classList.contains('drag-handle')) return; // Don't load if interacting with drag handle
                this.loadFlow(item.dataset.id);
            });

            item.addEventListener('dragstart', this.handleFlowDragStart.bind(this));
            item.addEventListener('dragover', this.handleFlowDragOver.bind(this));
            item.addEventListener('dragleave', this.handleFlowDragLeave.bind(this));
            item.addEventListener('drop', this.handleFlowDrop.bind(this));
            item.addEventListener('dragend', this.handleFlowDragEnd.bind(this));
        });

        flowListEl.querySelectorAll('.flow-item-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFlow(button.dataset.id); // Calls system's deleteFlow
            });
        });
    }
	
	handleFlowDragStart(e) {
        const targetItem = e.target.closest('.flow-item');
        if (!targetItem) return;
        this.draggedFlowItem = targetItem;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', targetItem.dataset.id);
        targetItem.classList.add('dragging');
    }
	
	handleFlowDragOver(e) {
        e.preventDefault();
        const targetItem = e.target.closest('.flow-item');
        if (!targetItem || targetItem === this.draggedFlowItem) return;
        
        targetItem.classList.remove('drag-over-top', 'drag-over-bottom'); // Clear previous
        const rect = targetItem.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        if (offsetY < rect.height / 2) {
            targetItem.classList.add('drag-over-top');
        } else {
            targetItem.classList.add('drag-over-bottom');
        }
    }
	
	handleFlowDragLeave(e) {
        const targetItem = e.target.closest('.flow-item');
        if (targetItem) {
            targetItem.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    }

    async handleFlowDrop(e) {
        e.preventDefault();
        if (!this.draggedFlowItem) return;

        const targetItem = e.target.closest('.flow-item');
        if (targetItem) {
            targetItem.classList.remove('drag-over-top', 'drag-over-bottom');
        }
        
        if (!targetItem || targetItem === this.draggedFlowItem) {
            this.draggedFlowItem.classList.remove('dragging');
            this.draggedFlowItem = null;
            return;
        }

        const flowListEl = document.getElementById('flow-list');
        const rect = targetItem.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;

        if (offsetY < rect.height / 2) {
            flowListEl.insertBefore(this.draggedFlowItem, targetItem);
        } else {
            flowListEl.insertBefore(this.draggedFlowItem, targetItem.nextSibling);
        }
        
        this.draggedFlowItem.classList.remove('dragging');

        // Get the new order of flow IDs from the DOM
        const orderedFlowElements = Array.from(flowListEl.querySelectorAll('.flow-item'));
        const orderedFlowIds = orderedFlowElements.map(item => item.dataset.id);

        try {
            const result = await this.eventFlowSystem.updateFlowsOrder(orderedFlowIds);
            if (result.success) {
                console.log('Flows reordered and saved successfully.');
            } else {
                console.error("Failed to save new flow order:", result.message, result.error || '');
                // Optionally, show an alert to the user.
            }
        } catch (error) {
            console.error('Error during flow order update process:', error);
        } finally {
            this.draggedFlowItem = null;
            await this.loadFlowList(); // Refresh list from the source of truth (system)
                                       // to ensure UI consistency with DB state.
        }
    }

    handleFlowDragEnd(e) {
        if (this.draggedFlowItem) {
            this.draggedFlowItem.classList.remove('dragging');
        }
        document.querySelectorAll('.flow-item.drag-over-top, .flow-item.drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        this.draggedFlowItem = null;
    }

    async loadFlow(flowId) {
        if (this.unsavedChanges) {
            if (!confirm("You have unsaved changes. Are you sure you want to load another flow? Your current changes will be lost.")) {
                return;
            }
        }
        const flow = await this.eventFlowSystem.getFlowById(flowId);
        if (!flow) return;

        this.currentFlow = JSON.parse(JSON.stringify(flow)); // Deep copy
        document.getElementById('flow-name').value = this.currentFlow.name || '';
        document.getElementById('flow-active').checked = this.currentFlow.active;

        document.querySelectorAll('.flow-item').forEach(item => {
            item.classList.toggle('selected-flow', item.dataset.id === flowId);
        });
        this.originalFlowName = this.currentFlow.name || '';
        this.markUnsavedChanges(false);
        this.renderFlow();
        this.selectNode(null);
    }

    createNewFlow() {
        if (this.unsavedChanges) {
            if (!confirm("Create a new flow? Any unsaved changes to the current flow will be lost.")) {
                return;
            }
        }
        
        // Determine the next order number
        // getAllFlows() from the system should give the current, sorted list
        const currentFlows = this.eventFlowSystem.flows; // Access the internal, sorted array
        let maxOrder = -1;
        if (currentFlows && currentFlows.length > 0) {
             currentFlows.forEach(f => {
                if (typeof f.order === 'number' && f.order > maxOrder) {
                    maxOrder = f.order;
                }
            });
        }
        const newOrder = (currentFlows.length > 0 && maxOrder > -1) ? maxOrder + 1 : 0;

        this.currentFlow = {
            id: null, 
            name: 'New Flow', 
            description: '', 
            active: true, 
            nodes: [], 
            connections: [],
            order: newOrder // Assign new order
        };
        this.markUnsavedChanges(false); 
		this.originalFlowName = 'New Flow';
		this.markUnsavedChanges(false); 

        document.getElementById('flow-name').value = this.currentFlow.name;
        document.getElementById('flow-active').checked = this.currentFlow.active;
        document.querySelectorAll('.flow-item.selected-flow').forEach(item => item.classList.remove('selected-flow'));
        
        this.renderFlow();
        this.selectNode(null);
    }

    async generateFlowName() {
        if (!this.currentFlow || !this.currentFlow.nodes) {
            return `Untitled Flow - ${new Date().toLocaleTimeString()}`;
        }

        const firstTrigger = this.currentFlow.nodes.find(node => node.type === 'trigger');
        let firstActionOrLogic = this.currentFlow.nodes.find(node => node.type === 'action' || node.type === 'logic');

        let baseName = "";
        if (firstTrigger) {
            baseName += `${this.getNodeTitle(firstTrigger).replace('Message ', '')}`; // Shorten
            if (firstActionOrLogic) {
                 // Try to find an action/logic connected to this trigger
                const findConnectedNode = (startNodeId) => {
                    const connection = this.currentFlow.connections.find(c => c.from === startNodeId);
                    if (connection) {
                        return this.currentFlow.nodes.find(n => n.id === connection.to && (n.type === 'action' || n.type === 'logic'));
                    }
                    return null;
                };
                const connectedActionLogic = findConnectedNode(firstTrigger.id);
                if (connectedActionLogic) {
                    firstActionOrLogic = connectedActionLogic;
                }
                baseName += ` to ${this.getNodeTitle(firstActionOrLogic)}`;
            }
        } else if (firstActionOrLogic) { // No trigger, but has action/logic
            baseName += `${this.getNodeTitle(firstActionOrLogic)}`;
        } else { // Empty flow
            baseName = `Untitled Flow`;
        }
        
        // Ensure name is not overly long
        if (baseName.length > 50) {
            baseName = baseName.substring(0, 47) + "...";
        }

        // Ensure uniqueness
        const allFlows = await this.eventFlowSystem.getAllFlows();
        let finalName = baseName;
        let counter = 1;
        // Check against current name too if it's an edit of an existing flow but name was cleared
        while (allFlows.some(flow => flow.name === finalName && (!this.currentFlow.id || flow.id !== this.currentFlow.id))) {
            finalName = `${baseName} ${counter}`;
            counter++;
        }
        return finalName;
    }


    async saveCurrentFlow() {
        if (!this.currentFlow) {
            alert('No flow is currently active to save.'); return;
        }

        // Auto-generate name if current name is empty, whitespace, or the default "New Flow"
        let currentNameTrimmed = this.currentFlow.name ? this.currentFlow.name.trim() : '';
        if (currentNameTrimmed === '' || currentNameTrimmed === 'New Flow' || currentNameTrimmed === 'New Flow*') {
            this.currentFlow.name = await this.generateFlowName();
            document.getElementById('flow-name').value = this.currentFlow.name; // Update UI immediately
            // No asterisk needed yet as it's a "new" name until saved
        } else if (document.getElementById('flow-name').value.trim() === '') { // User manually cleared the name
            this.currentFlow.name = await this.generateFlowName();
            document.getElementById('flow-name').value = this.currentFlow.name;
        }


        let flowToSave = JSON.parse(JSON.stringify(this.currentFlow)); // Deep copy
        
        // Remove trailing asterisk if present, as that's a UI indicator for unsaved changes
        if (flowToSave.name.endsWith('*')) {
            flowToSave.name = flowToSave.name.slice(0, -1);
        }
        // Ensure the name in currentFlow (internal state) also doesn't have the asterisk
        if (this.currentFlow.name.endsWith('*')) {
             this.currentFlow.name = this.currentFlow.name.slice(0, -1);
        }


        try {
            const savedFlow = await this.eventFlowSystem.saveFlow(flowToSave);
            this.currentFlow.id = savedFlow.id; // Update current flow with ID from DB
            this.currentFlow.name = savedFlow.name; // Reflect cleaned name from DB (e.g. if system modified it)
            
            document.getElementById('flow-name').value = this.currentFlow.name; // Update input field without asterisk AFTER save
            this.markUnsavedChanges(false); // Reset flag AFTER successful save

           // alert('Flow saved successfully!');
            await this.loadFlowList(); // Refresh list
            
            // Notify background instance to reload flows
            if (window.parent && window.parent.eventFlowSystem && window.parent.eventFlowSystem !== this.eventFlowSystem) {
                console.log('[EventFlowEditor] Notifying parent window to reload flows after save');
                window.parent.eventFlowSystem.reloadFlows();
            }
            
            // Re-select the current flow in the list
            document.querySelectorAll('.flow-item').forEach(item => {
                item.classList.toggle('selected-flow', item.dataset.id === this.currentFlow.id);
            });
        } catch (error) {
            console.error('Error saving flow:', error);
            alert('Failed to save flow. Check console for details.');
        }
    }

    async duplicateCurrentFlow() {
        if (!this.currentFlow || !this.currentFlow.id) {
            alert('Please save the current flow first or select a flow to duplicate.'); return;
        }
        if (this.unsavedChanges) {
            if (!confirm("You have unsaved changes. Duplicate the saved version of the flow? Current unsaved changes will be lost from the new duplicated flow's perspective.")) {
                return;
            }
        }
        try {
            const duplicatedFlow = await this.eventFlowSystem.duplicateFlow(this.currentFlow.id);
            if (duplicatedFlow) {
                await this.loadFlowList();
                this.loadFlow(duplicatedFlow.id); // This will reset unsavedChanges flag
               // alert('Flow duplicated successfully!');
            } else {
                alert('Error duplicating flow.');
            }
        } catch (error) {
            console.error('Error duplicating flow:', error);
            alert('Failed to duplicate flow. Check console for details.');
        }
    }

    async deleteFlow(flowId) {
        if (!confirm('Are you sure you want to delete this flow? This action cannot be undone.')) return;
        try {
            await this.eventFlowSystem.deleteFlow(flowId);
            if (this.currentFlow && flowId === this.currentFlow.id) {
                this.createNewFlow(); // Will ask for confirmation if current flow has unsaved changes
            }
            this.loadFlowList();
           // alert('Flow deleted successfully.');
           
            // Notify background instance to reload flows
            if (window.parent && window.parent.eventFlowSystem && window.parent.eventFlowSystem !== this.eventFlowSystem) {
                console.log('[EventFlowEditor] Notifying parent window to reload flows');
                window.parent.eventFlowSystem.reloadFlows();
            }
        } catch (error) {
            console.error('Error deleting flow:', error);
            alert('Failed to delete flow. Check console for details.');
        }
    }

    renderFlow() {
        const canvas = document.getElementById('flow-canvas');
        canvas.innerHTML = '';
        if (!this.currentFlow || !this.currentFlow.nodes) return;
        this.currentFlow.nodes.forEach(node => this.renderNode(node));
        this.currentFlow.connections.forEach(connection => this.renderConnection(connection));
    }

	renderNode(node) {
		const canvas = document.getElementById('flow-canvas');
		
		// It's good practice to remove the old element if re-rendering a specific node
		// However, if renderNode is always called as part of a full renderFlow that clears the canvas, this might not be strictly necessary.
		// For robustness if you later call renderNode to update a single node:
		const existingNodeEl = canvas.querySelector(`.node[data-id="${node.id}"]`);
		if (existingNodeEl) {
			existingNodeEl.remove();
		}

		const nodeEl = document.createElement('div');
		// Add 'logic' class for general styling of logic nodes if node.type is 'logic'
		nodeEl.className = `node ${node.type}`; 
		if (this.selectedNode === node.id) {
			nodeEl.classList.add('selected');
		}
		nodeEl.dataset.id = node.id;
		nodeEl.style.left = `${node.x}px`;
		nodeEl.style.top = `${node.y}px`;

		let inputPointsHTML = '';
		let outputPointsHTML = '';

		if (node.type === 'trigger') {
			outputPointsHTML = '<div class="connection-point output" data-point-type="output"></div>';
		} else if (node.type === 'action') {
			inputPointsHTML = '<div class="connection-point input" data-point-type="input"></div>';
			// outputPointsHTML = '<div class="connection-point output" data-point-type="output"></div>'; // If actions can lead to other nodes
		} else if (node.type === 'logic') {
			let pointClasses = "connection-point input"; // Base classes for the input point
			
			// Check for AND/OR gates and count incoming connections
			if (node.logicType === 'AND' || node.logicType === 'OR') {
				let incomingConnectionsCount = 0;
				if (this.currentFlow && this.currentFlow.connections) {
					incomingConnectionsCount = this.currentFlow.connections.filter(conn => conn.to === node.id).length;
				}

				if (incomingConnectionsCount > 1) {
					pointClasses += " logic-input-multiple"; // Add class for multiple connections
				} else {
					pointClasses += " logic-input-single"; // Class for single or zero connections
				}
			} else if (node.logicType === 'NOT') {
				pointClasses += " logic-input-single"; // NOT gates expect a single input
			}
			
			inputPointsHTML = `<div class="${pointClasses}" data-point-type="input" data-logic-type="${node.logicType}"></div>`;
			outputPointsHTML = '<div class="connection-point output" data-point-type="output"></div>';
		}

		nodeEl.innerHTML = `
			<div class="node-header">
				<div class="node-title">${this.getNodeTitle(node)}</div>
				<div class="node-delete" title="Delete Node">×</div>
			</div>
			<div class="node-body">${this.getNodeDescription(node)}</div>
			${inputPointsHTML}
			${outputPointsHTML}
		`;
		canvas.appendChild(nodeEl);

		// Attach event listeners for the new node
		nodeEl.addEventListener('mousedown', (e) => {
			if (e.target.classList.contains('node-delete')) {
				this.deleteNode(node.id);
				return;
			}
			if (e.target.classList.contains('connection-point')) {
				 if (e.target.dataset.pointType === 'output') { // Only start dragging from output points
					this.startConnection(node.id, e.target.dataset.pointType, e);
				 }
				return;
			}
			this.selectNode(node.id);

			if (!e.target.classList.contains('connection-point') && !e.target.classList.contains('node-delete')) {
				this.draggedNode = node.id;
				const rect = nodeEl.getBoundingClientRect();
				this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
				document.addEventListener('mousemove', this.handleNodeDragMove);
				document.addEventListener('mouseup', this.handleNodeDragEnd);
			}
		});
	}

    getNodeTitle(node) {
        let typesArray;
        let subtypeField;

        if (node.type === 'trigger') {
            typesArray = this.triggerTypes;
            subtypeField = 'triggerType';
        } else if (node.type === 'action') {
            typesArray = this.actionTypes;
            subtypeField = 'actionType';
        } else if (node.type === 'logic') { // NEW
            typesArray = this.logicNodeTypes;
            subtypeField = 'logicType';
        } else {
            return 'Unknown Type';
        }
        const typeDef = typesArray.find(t => t.id === node[subtypeField]);
        return typeDef ? typeDef.name : 'Unknown Node';
    }

    getNodeDescription(node) {
        if (!node.config) node.config = {}; // Ensure config exists
        if (node.type === 'trigger') {
            switch (node.triggerType) {
                case 'messageContains': return `Text: "${(node.config.text || '').substring(0,15)}${(node.config.text || '').length > 15 ? '...' : ''}"`;
                case 'messageStartsWith': return `Text: "${(node.config.text || '').substring(0,15)}${(node.config.text || '').length > 15 ? '...' : ''}"`;
                case 'messageEquals': return `Text: "${(node.config.text || '').substring(0,15)}${(node.config.text || '').length > 15 ? '...' : ''}"`;
                case 'messageRegex': return `Pattern: "${(node.config.pattern || '').substring(0,15)}${(node.config.pattern || '').length > 15 ? '...' : ''}"`;
                case 'fromSource': return `Source: ${node.config.source || 'Any'}`;
                case 'fromChannelName': return `Channel: ${node.config.channelName || 'Any'}`;
                case 'fromUser': return `User: ${node.config.username || 'Any'}`;
                case 'userRole': return `Role: ${node.config.role || 'Any'}`;
                case 'hasDonation': return 'Has donation';
                case 'customJs': return 'Custom JS';
                default: return `${this.getNodeTitle(node)}`;
            }
        } else if (node.type === 'action') {
             switch (node.actionType) {
                case 'blockMessage': return 'Block this message';
                case 'modifyMessage': return `New: "${(node.config.newMessage || '').substring(0,15)}${(node.config.newMessage || '').length > 15 ? '...' : ''}"`;
                case 'relay': return `To: ${node.config.destination || 'All'}`;
                default: return `${this.getNodeTitle(node)}`;
            }
        } else if (node.type === 'logic') { // NEW
            switch (node.logicType) {
                case 'AND': return 'All inputs must be true.';
                case 'OR': return 'Any input can be true.';
                case 'NOT': return 'Inverts the input signal.';
                default: return 'Logic Gate';
            }
        }
        return '';
    }

    renderConnection(connection) {
        const canvas = document.getElementById('flow-canvas');
        if (!this.currentFlow || !this.currentFlow.nodes) return;
        const sourceNodeData = this.currentFlow.nodes.find(n => n.id === connection.from);
        const targetNodeData = this.currentFlow.nodes.find(n => n.id === connection.to);
        if (!sourceNodeData || !targetNodeData) return;

        const sourceNodeEl = document.querySelector(`.node[data-id="${connection.from}"]`);
        const targetNodeEl = document.querySelector(`.node[data-id="${connection.to}"]`);
        if (!sourceNodeEl || !targetNodeEl) return;

        const sourcePoint = sourceNodeEl.querySelector('.connection-point.output');
        const targetPoint = targetNodeEl.querySelector('.connection-point.input');
        if (!sourcePoint || !targetPoint) return;
        
        const canvasRect = canvas.getBoundingClientRect();
        const sourceRect = sourcePoint.getBoundingClientRect();
        const targetRect = targetPoint.getBoundingClientRect();

        const startX = (sourceRect.left + sourceRect.width / 2) - canvasRect.left + canvas.scrollLeft;
        const startY = (sourceRect.top + sourceRect.height / 2) - canvasRect.top + canvas.scrollTop;
        const endX = (targetRect.left + targetRect.width / 2) - canvasRect.left + canvas.scrollLeft;
        const endY = (targetRect.top + targetRect.height / 2) - canvasRect.top + canvas.scrollTop;

        let svgEl = canvas.querySelector(`svg.connection[data-from="${connection.from}"][data-to="${connection.to}"]`);
        if (svgEl) svgEl.remove();

        svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('class', 'connection');
        svgEl.dataset.from = connection.from;
        svgEl.dataset.to = connection.to;
        svgEl.style.position = 'absolute';
        svgEl.style.left = '0'; svgEl.style.top = '0';
        svgEl.style.width = canvas.scrollWidth + 'px'; 
        svgEl.style.height = canvas.scrollHeight + 'px';
        svgEl.style.pointerEvents = 'none';

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const controlYOffset = Math.max(50, Math.abs(endY - startY) * 0.3);
        path.setAttribute('d', `M ${startX},${startY} C ${startX},${startY + controlYOffset} ${endX},${endY - controlYOffset} ${endX},${endY}`);
        path.setAttribute('stroke', 'var(--primary-color)');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        svgEl.appendChild(path);
        canvas.insertBefore(svgEl, canvas.firstChild);
    }

    handleNodeDragStart(e, nodeType, nodeSubtype) { // Added nodeType and nodeSubtype parameters
        e.dataTransfer.setData('text/plain', JSON.stringify({
            type: nodeType, // Use the passed nodeType
            subtype: nodeSubtype, // Use the passed nodeSubtype
            name: e.target.textContent.trim() 
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }

    handleCanvasDrop(e) { // For dropping new nodes from palette
        e.preventDefault();
        const dataString = e.dataTransfer.getData('text/plain'); // Reverted to text/plain
        if (!dataString) return;
        try {
            const nodeInfo = JSON.parse(dataString);
            const canvas = document.getElementById('flow-canvas');
            const canvasRect = canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left + canvas.scrollLeft;
            const y = e.clientY - canvasRect.top + canvas.scrollTop;
            this.createNode(nodeInfo.type, nodeInfo.subtype, x, y);
            // No need to markUnsavedChanges here, createNode does it.
        } catch (err) {
            console.error('Error dropping node:', err);
        }
    }
	
	runTestFlow(testMessage) {
		if (!this.currentFlow) {
			alert('No flow is currently active. Please create or select a flow to test.');
			return { success: false, message: 'No active flow' };
		}

		// Create a temporary copy of the flow for testing
		const testFlow = JSON.parse(JSON.stringify(this.currentFlow));
		
		// Ensure it's active for testing
		testFlow.active = true;
		
		let testResult = { success: false, message: 'Test not run' };
		
		// Determine if we should test just this flow or all flows
		const testAllActiveFlows = document.getElementById('test-all-active-flows').checked;
		
		if (testAllActiveFlows) {
			// Test against all active flows in the system
			this.eventFlowSystem.processMessage(testMessage)
				.then(result => {
					testResult = { 
						success: true, 
						message: result ? 'Message was processed successfully' : 'Message was blocked', 
						result: result 
					};
					this.displayTestResults(testResult);
				});
		} else {
			// Create a standalone copy of the flow system just for testing this flow
			const tempFlowSystem = {
				flows: [testFlow],
				processMessage: this.eventFlowSystem.processMessage.bind(this.eventFlowSystem),
				evaluateFlow: this.eventFlowSystem.evaluateFlow.bind(this.eventFlowSystem),
				evaluateTrigger: this.eventFlowSystem.evaluateTrigger.bind(this.eventFlowSystem),
				evaluateSpecificLogicNode: this.eventFlowSystem.evaluateSpecificLogicNode.bind(this.eventFlowSystem),
				executeAction: this.eventFlowSystem.executeAction.bind(this.eventFlowSystem)
			};
			
			// Process the message through just this flow
			tempFlowSystem.evaluateFlow(testFlow, testMessage)
				.then(result => {
					testResult = { 
						success: true, 
						message: result.blocked ? 'Message was blocked by this flow' : 
								 result.modified ? 'Message was modified by this flow' : 
								 'Flow triggered but no actions affected the message',
						result: result 
					};
					this.displayTestResults(testResult);
				});
		}
		
		return testResult;
	}
	
	initTestPanel() {
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
			testPanel.style.display = 'flex';
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
		runTestBtn.addEventListener('click', () => {
			// Show warning if flow has unsaved changes
			document.getElementById('unsaved-flow-warning').style.display = 
				this.unsavedChanges ? 'block' : 'none';
			
			// Create test message from form inputs
			const testMessage = {
				type: document.getElementById('test-source').value,
				chatname: document.getElementById('test-username').value,
				userid: document.getElementById('test-username').value.toLowerCase(),
				chatmessage: document.getElementById('test-message').value,
				mod: document.getElementById('test-mod').checked,
				vip: document.getElementById('test-vip').checked,
				admin: document.getElementById('test-admin').checked,
				hasDonation: document.getElementById('test-donation').checked,
				// Add other required properties
				timestamp: Date.now(),
			};
			
			// Add donation amount if donation checkbox is checked
			if (testMessage.hasDonation) {
				testMessage.donationAmount = document.getElementById('test-donation-amount').value;
			}
			
			// Run the test
			this.runTestFlow(testMessage);
		});
	}

	displayTestResults(testResult) {
		const resultsEl = document.getElementById('test-results');
		if (!resultsEl) return;
		
		let html = `<h4>Test Results</h4>`;
		
		if (!testResult.success) {
			html += `<p class="test-error">${testResult.message}</p>`;
		} else {
			const result = testResult.result;
			
			if (result === null) {
				html += `<p class="test-blocked">Message was BLOCKED by a flow.</p>`;
			} else if (result.blocked) {
				html += `<p class="test-blocked">Message was BLOCKED by this flow.</p>`;
			} else if (result.modified) {
				html += `
					<p class="test-modified">Message was MODIFIED.</p>
					<div class="test-result-detail">
						<strong>New Message:</strong> ${result.message.chatmessage}
					</div>
				`;
				
				// Show any properties that were modified
				const originalKeys = Object.keys(testMessage);
				const modifiedKeys = Object.keys(result.message).filter(key => 
					!originalKeys.includes(key) || result.message[key] !== testMessage[key]
				);
				
				if (modifiedKeys.length > 0) {
					html += `<div class="test-result-detail"><strong>Modified Properties:</strong><ul>`;
					modifiedKeys.forEach(key => {
						html += `<li>${key}: ${JSON.stringify(result.message[key])}</li>`;
					});
					html += `</ul></div>`;
				}
			} else {
				html += `<p class="test-passed">Flow was triggered but did not modify or block the message.</p>`;
			}
		}
		
		resultsEl.innerHTML = html;
	}

    createNode(type, subtype, x, y) {
        const id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const node = { id, type, x: Math.round(x), y: Math.round(y), config: {} };

        if (type === 'trigger') {
            node.triggerType = subtype;
            switch (subtype) { /* Populate default configs */ 
                case 'messageContains': node.config = { text: 'keyword' }; break;
                case 'messageStartsWith': node.config = { text: '!' }; break;
                case 'messageEquals': node.config = { text: 'hello' }; break;
                case 'messageRegex': node.config = { pattern: 'pattern', flags: 'i' }; break;
                case 'fromSource': node.config = { source: '*' }; break;
                case 'fromChannelName': node.config = { channelName: '' }; break;
                case 'fromUser': node.config = { username: 'user' }; break;
                case 'userRole': node.config = { role: 'mod' }; break;
                case 'hasDonation': node.config = {}; break;
                case 'customJs': node.config = { code: 'return message.chatmessage.includes("test");' }; break;
            }
        } else if (type === 'action') {
            node.actionType = subtype;
            switch (subtype) { /* Populate default configs */
                case 'blockMessage':
					node.config = {}; break;
                case 'modifyMessage':
					node.config = { newMessage: 'modified text' }; break;
                case 'setProperty':
					node.config = { property: 'chatmessage', value: 'new value' }; break;
                case 'relay':
					node.config = { destination: 'discord', template: '[{source}] {username}: {message}', toAll: false, timeout: 0 }; break;
                case 'webhook':
					node.config = { url: 'https://example.com/hook', method: 'POST', body: '{}', includeMessage: true }; break;
                case 'spendPoints':
					node.config = { amount: 100 }; break;
                case 'customJs': 
					node.config = { code: 'message.chatmessage += " (edited)";\nreturn { modified: true, message };' }; break;
				case 'playTenorGiphy':
					node.config = { mediaUrl: 'https://giphy.com/embed/X9izlczKyCpmCSZu0l', mediaType: 'iframe', duration: 10000 };
					break;
				case 'triggerOBSScene':
					node.config = { sceneName: 'Your Scene Name' };
					break;
				case 'playAudioClip':
					node.config = { audioUrl: 'https://example.com/path/to/sound.mp3', volume: 1.0 };
					break;
            }
        } else if (type === 'logic') { // NEW
            node.logicType = subtype; // subtype will be 'AND', 'OR', 'NOT'
            // Logic nodes might not need specific default configs beyond their type
        }
        this.currentFlow.nodes.push(node);
        this.renderNode(node);
        this.selectNode(id);
        this.markUnsavedChanges(true);
    }

    deleteNode(nodeId) {
        if (!this.currentFlow) return;
        this.currentFlow.nodes = this.currentFlow.nodes.filter(node => node.id !== nodeId);
        this.currentFlow.connections = this.currentFlow.connections.filter(
            conn => conn.from !== nodeId && conn.to !== nodeId
        );
        this.markUnsavedChanges(true);
        this.renderFlow();
        if (this.selectedNode === nodeId) {
            this.selectNode(null);
        }
    }

    startConnection(nodeId, connPointType, event) {
        if (!this.currentFlow || connPointType !== 'output') return; // Only drag from output

        this.draggedConnection = { from: nodeId, tempLine: null };
        const canvas = document.getElementById('flow-canvas');
        
        const sourcePointEl = event.target; // The output connection point element
        const sourceRect = sourcePointEl.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        const initialX = sourceRect.left + sourceRect.width / 2; 
        const initialY = sourceRect.top + sourceRect.height / 2;

        this.draggedConnection.tempLine = this.createTemporaryLine(canvas, initialX, initialY, event.clientX, event.clientY);

        document.addEventListener('mousemove', this.handleConnectionDragMove);
        document.addEventListener('mouseup', this.handleConnectionDragEnd);
        event.stopPropagation();
    }
    
    createTemporaryLine(canvas, x1, y1, x2, y2) {
        let svg = canvas.querySelector('svg.temp-connection');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'temp-connection');
            Object.assign(svg.style, { position: 'absolute', left: '0px', top: '0px', width: canvas.scrollWidth + 'px', height: canvas.scrollHeight + 'px', pointerEvents: 'none', zIndex: '100'});
            canvas.appendChild(svg);
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const canvasRect = canvas.getBoundingClientRect();
        const relativeX1 = x1 - canvasRect.left + canvas.scrollLeft;
        const relativeY1 = y1 - canvasRect.top + canvas.scrollTop;
        const relativeX2 = x2 - canvasRect.left + canvas.scrollLeft;
        const relativeY2 = y2 - canvasRect.top + canvas.scrollTop;
        const controlYOffset = Math.max(30, Math.abs(relativeY2 - relativeY1) * 0.3);
        path.setAttribute('d', `M ${relativeX1},${relativeY1} C ${relativeX1},${relativeY1 + controlYOffset} ${relativeX2},${relativeY2 - controlYOffset} ${relativeX2},${relativeY2}`);
        Object.assign(path, { stroke: 'var(--secondary-color)', 'stroke-width': '2', fill: 'none', 'stroke-dasharray': '5,5' });
        svg.innerHTML = ''; 
        svg.appendChild(path);
        return svg;
    }

    handleConnectionDragMove = (e) => {
        if (!this.draggedConnection || !this.draggedConnection.tempLine) return;
        const canvas = document.getElementById('flow-canvas');
        const sourceNodeEl = document.querySelector(`.node[data-id="${this.draggedConnection.from}"] .connection-point.output`);
        if(!sourceNodeEl) return;
        const sourceRect = sourceNodeEl.getBoundingClientRect();
        const startX = sourceRect.left + sourceRect.width / 2;
        const startY = sourceRect.top + sourceRect.height / 2;
        this.createTemporaryLine(canvas, startX, startY, e.clientX, e.clientY);
    };

    handleConnectionDragEnd = (e) => {
        document.removeEventListener('mousemove', this.handleConnectionDragMove);
        document.removeEventListener('mouseup', this.handleConnectionDragEnd);
        if (this.draggedConnection && this.draggedConnection.tempLine) {
            this.draggedConnection.tempLine.remove();
        }

        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        if (targetElement && targetElement.classList.contains('connection-point') && targetElement.dataset.pointType === 'input') {
            const targetNodeElement = targetElement.closest('.node');
            if (targetNodeElement) {
                const toNodeId = targetNodeElement.dataset.id;
                const fromNodeId = this.draggedConnection.from;
                
                if (fromNodeId !== toNodeId) {
                    const fromNodeData = this.currentFlow.nodes.find(n => n.id === fromNodeId);
                    const toNodeData = this.currentFlow.nodes.find(n => n.id === toNodeId);

                    let isValidConnection = false;
                    if (fromNodeData && toNodeData) {
                        if ((fromNodeData.type === 'trigger' || fromNodeData.type === 'logic') &&
                            (toNodeData.type === 'action' || toNodeData.type === 'logic')) {
                            isValidConnection = true;
                        }
                        // Prevent connecting action output to trigger input (if actions had outputs and triggers inputs)
                        // Or more simply, rely on points: output can only go to input.
                    }
                    
                    if (isValidConnection) {
                         this.createConnection(fromNodeId, toNodeId);
                    }
                }
            }
        }
        this.draggedConnection = null;
    };

    createConnection(fromNodeId, toNodeId) {
        if (!this.currentFlow) return;
        const existing = this.currentFlow.connections.find(c => c.from === fromNodeId && c.to === toNodeId);
        if (existing || fromNodeId === toNodeId) return;
        this.currentFlow.connections.push({
            id: `conn_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            from: fromNodeId, to: toNodeId
        });
        this.markUnsavedChanges(true);
        this.renderFlow();
    }

    selectNode(nodeId) {
        const previouslySelected = document.querySelector('.node.selected');
        if (previouslySelected) previouslySelected.classList.remove('selected');
        this.selectedNode = nodeId; // Store ID
        if (!nodeId) {
            document.getElementById('node-properties-content').innerHTML = '<p>Select a node to view its properties.</p>';
            return;
        }
        const nodeEl = document.querySelector(`.node[data-id="${nodeId}"]`);
        if (nodeEl) nodeEl.classList.add('selected');
        const nodeData = this.currentFlow.nodes.find(n => n.id === nodeId);
        if (!nodeData) {
             document.getElementById('node-properties-content').innerHTML = '<p>Error: Node data not found.</p>';
            return;
        }
        this.showNodeProperties(nodeData);
    }

	showNodeProperties(node) {
		const propertiesContent = document.getElementById('node-properties-content');
		let html = `<h4>${this.getNodeTitle(node)} Properties</h4>
					<input type="hidden" id="node-id-prop" value="${node.id}">`;

		let typeArray, subtypeField; // Use subtypeField to get the specific type (triggerType, actionType, logicType)
		
		if (node.type === 'trigger') {
			typeArray = this.triggerTypes;
			subtypeField = 'triggerType';
		} else if (node.type === 'action') {
			typeArray = this.actionTypes;
			subtypeField = 'actionType';
		} else if (node.type === 'logic') {
			typeArray = this.logicNodeTypes; // Ensure this.logicNodeTypes is defined in your constructor
			subtypeField = 'logicType';
		} else {
			propertiesContent.innerHTML = '<p>Unknown node type selected.</p>';
			return;
		}

		// Dropdown to change the subtype of the node (e.g., change a 'messageContains' to 'messageStartsWith')
		html += `<div class="property-group">
					<label class="property-label">Type</label>
					<select class="property-input" id="node-subtype-prop" data-nodetype="${node.type}">
						${typeArray.map(opt => `<option value="${opt.id}" ${node[subtypeField] === opt.id ? 'selected' : ''}>${opt.name}</option>`).join('')}
					</select></div>`;

		if (!node.config) {
			node.config = {}; // Ensure config object exists
		}

		// Use node[subtypeField] for the switch, as it holds the actual subtype id like 'messageContains', 'AND', etc.
		switch (node[subtypeField]) {
			// --- Trigger Cases ---
			case 'messageContains':
			case 'messageStartsWith':
			case 'messageEquals':
				html += `<div class="property-group"><label class="property-label">Text to Match</label><input type="text" class="property-input" id="prop-text" value="${node.config.text || ''}"></div>`;
				break;
			case 'messageRegex':
				html += `<div class="property-group"><label class="property-label">Regex Pattern</label><input type="text" class="property-input" id="prop-pattern" value="${node.config.pattern || ''}"></div>
						 <div class="property-group"><label class="property-label">Regex Flags</label><input type="text" class="property-input" id="prop-flags" value="${node.config.flags || 'i'}"></div>`;
				break;
			case 'fromSource':
				html += `<div class="property-group"><label class="property-label">Source Platform</label><select class="property-input" id="prop-source">
						   <option value="*" ${node.config.source === '*' ? 'selected' : ''}>Any Source</option>
						   ${['twitch', 'youtube', 'facebook', 'kick', 'tiktok', 'instagram', 'discord', 'slack', 'other'].map(s => `<option value="${s}" ${node.config.source === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
						 </select></div>`;
				break;
			case 'fromChannelName':
				html += `<div class="property-group"><label class="property-label">Channel Name</label><input type="text" class="property-input" id="prop-channelName" value="${node.config.channelName || ''}" placeholder="Enter channel name"></div>
						 <div class="property-help">Match messages from a specific channel name or host username</div>`;
				break;
			case 'fromUser':
				html += `<div class="property-group"><label class="property-label">Username</label><input type="text" class="property-input" id="prop-username" value="${node.config.username || ''}"></div>`;
				break;
			case 'userRole':
				html += `<div class="property-group"><label class="property-label">User Role</label><select class="property-input" id="prop-role">
						   ${['mod', 'vip', 'admin', 'subscriber', 'follower'].map(r => `<option value="${r}" ${node.config.role === r ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('')}
						 </select></div>`;
				break;
			case 'hasDonation': // Trigger type
				html += `<p class="property-help">Fires if the message includes donation information.</p>`;
				break;
			// --- Custom JS Trigger ---
			case 'customJs': // Assuming 'customJs' can be a trigger, action, or logic type based on context
				if (node.type === 'trigger') {
					 html += `<div class="property-group"><label class="property-label">JavaScript Code</label><textarea class="property-input" id="prop-code" rows="10" spellcheck="false">${node.config.code || 'return message.chatmessage.includes("test");'}</textarea>
							 <div class="property-help">Return true/false. \`message\` object is available.</div></div>`;
				} else if (node.type === 'action') { // Custom JS Action
					 html += `<div class="property-group"><label class="property-label">JavaScript Code</label><textarea class="property-input" id="prop-code" rows="10" spellcheck="false">${node.config.code || 'message.chatmessage += " (edited)";\nreturn { modified: true, message };'}</textarea>
							 <div class="property-help">\`message\` and \`result\` objects are available. Return an object like \`{ modified: boolean, message: object, blocked: boolean }\`.</div></div>`;
				}
				// Potentially add a case for customJs if it were a logic node type
				break;

			// --- Action Cases ---
			case 'blockMessage':
				html += `<p class="property-help">Blocks the current message from further processing or display.</p>`;
				break;
			case 'modifyMessage':
				html += `<div class="property-group"><label class="property-label">New Message Content</label><textarea class="property-input" id="prop-newMessage" rows="3">${node.config.newMessage || ''}</textarea><div class="property-help">Placeholders like {username}, {message}, etc. can be used.</div></div>`;
				break;
			case 'setProperty':
				html += `<div class="property-group"><label class="property-label">Property Name</label><input type="text" class="property-input" id="prop-propertyName" value="${node.config.property || 'chatmessage'}"><div class="property-help">e.g., chatmessage, userColor, customFlag</div></div>
						 <div class="property-group"><label class="property-label">Property Value</label><input type="text" class="property-input" id="prop-propertyValue" value="${node.config.value || ''}"><div class="property-help">The new value for the property. Can be string, number, or boolean.</div></div>`;
				break;
			case 'relay':
				html += `<div class="property-group"><label class="property-label">Destination</label><input type="text" class="property-input" id="prop-destination" value="${node.config.destination || ''}"><div class="property-help">e.g., 'discord', 'channel_name'. Empty for all integrated platforms.</div></div>
						 <div class="property-group"><label class="property-label">Message Template</label><textarea class="property-input" id="prop-template" rows="3">${node.config.template || '[{source}] {username}: {message}'}</textarea></div>
						 <div class="property-group"><label class="property-label"><input type="checkbox" id="prop-toAll" ${node.config.toAll ? 'checked' : ''}> Send to all instances/tabs</label></div>
						 <div class="property-group"><label class="property-label">Timeout (ms)</label><input type="number" class="property-input" id="prop-timeout" value="${node.config.timeout || 0}"><div class="property-help">Delay before sending (0 for immediate).</div></div>`;
				break;
			case 'webhook':
				html += `<div class="property-group"><label class="property-label">URL</label><input type="url" class="property-input" id="prop-url" value="${node.config.url || ''}"></div>
						 <div class="property-group"><label class="property-label">Method</label><select class="property-input" id="prop-method">${['POST', 'GET', 'PUT', 'DELETE', 'PATCH'].map(m => `<option value="${m}" ${node.config.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
						 <div class="property-group"><label class="property-label"><input type="checkbox" id="prop-includeMessage" ${node.config.includeMessage !== false ? 'checked' : ''}> Include full message object as JSON body</label></div>
						 <div class="property-group" id="webhook-body-group" style="${node.config.includeMessage !== false ? 'display: none;' : ''};"><label class="property-label">Custom Body (JSON)</label><textarea class="property-input" id="prop-body" rows="5">${node.config.body || '{}'}</textarea><div class="property-help">Used if "Include full message" is unchecked.</div></div>`;
				break;
			case 'spendPoints':
				html += `<div class="property-group"><label class="property-label">Amount to Spend</label><input type="number" class="property-input" id="prop-amount" value="${node.config.amount || 100}" min="0"></div>`;
				break;
			
			// --- Logic Node Cases ---
			case 'AND':
				html += `<p class="property-help">This gate outputs TRUE only if all of its connected inputs are TRUE.</p>`;
				// Future enhancement: List connected input nodes.
				break;
			case 'OR':
				html += `<p class="property-help">This gate outputs TRUE if at least one of its connected inputs is TRUE.</p>`;
				// Future enhancement: List connected input nodes.
				break;
			case 'NOT':
				html += `<p class="property-help">This gate inverts its single input. It outputs TRUE if the input is FALSE, and FALSE if the input is TRUE.</p>`;
				break;
			case 'playTenorGiphy': // This is node.actionType if node.type is 'action'
				html += `<div class="property-group">
							 <label class="property-label">Media URL (TENOR/GIPHY)</label>
							 <input type="url" class="property-input" id="prop-mediaUrl" value="${node.config.mediaUrl || ''}">
							 <div class="property-help">Direct URL to the GIF or video. For GIPHY, use the embed link or direct GIF link.</div>
						 </div>
						 <div class="property-group">
							 <label class="property-label">Media Type</label>
							 <select class="property-input" id="prop-mediaType">
								 <option value="iframe" ${node.config.mediaType === 'iframe' ? 'selected' : ''}>Video/Embed (iframe)</option>
								 <option value="image" ${node.config.mediaType === 'image' ? 'selected' : ''}>Image (direct GIF/image link)</option>
							 </select>
						 </div>
						 <div class="property-group">
							<label class="property-label">Duration (ms, 0 for manual close)</label>
							<input type="number" class="property-input" id="prop-duration" value="${node.config.duration || 10000}" min="0">
							<div class="property-help">How long the media stays on screen. 0 means it stays until the next 'play_media' action or manual intervention.</div>
						</div>`;
				break;

			case 'triggerOBSScene':
				html += `<div class="property-group">
							 <label class="property-label">OBS Scene Name</label>
							 <input type="text" class="property-input" id="prop-sceneName" value="${node.config.sceneName || ''}">
							 <div class="property-help">The exact name of the OBS scene to switch to.</div>
						 </div>`;
				break;

			case 'playAudioClip':
				html += `<div class="property-group">
							 <label class="property-label">Audio File URL</label>
							 <input type="url" class="property-input" id="prop-audioUrl" value="${node.config.audioUrl || ''}">
						 </div>
						 <div class="property-group">
							<label class="property-label">Volume (0.0 to 1.0)</label>
							<input type="number" class="property-input" id="prop-volume" value="${node.config.volume || 1.0}" min="0" max="1" step="0.1">
						</div>`;
				break;

			default:
				html += `<p class="property-help">This node type (${node[subtypeField]}) has no specific configurable properties.</p>`;
		}

		propertiesContent.innerHTML = html;
		this.addPropertiesEventListeners(node.id); // Pass node.id to correctly re-attach listeners
	}

    addPropertiesEventListeners(nodeId) {
        const nodeData = this.currentFlow.nodes.find(n => n.id === nodeId);
        if (!nodeData) return;

        const subtypeSelect = document.getElementById('node-subtype-prop');
        if (subtypeSelect) {
            subtypeSelect.addEventListener('change', (e) => {
                const newSubtype = e.target.value;
                const nodeType = e.target.dataset.nodetype; // Should be 'trigger', 'action', or 'logic'
                
                if (nodeType === 'trigger') nodeData.triggerType = newSubtype;
                else if (nodeType === 'action') nodeData.actionType = newSubtype;
                else if (nodeType === 'logic') nodeData.logicType = newSubtype;
                
                nodeData.config = {}; // Reset config when subtype changes
                // TODO: Populate with default config for newSubtype if applicable
                this.markUnsavedChanges(true);
                this.showNodeProperties(nodeData); // Rerender properties for the new subtype
                this.renderNodeOnCanvas(nodeData.id); // Rerender the node itself on canvas
            });
        }
        document.querySelectorAll('#node-properties-content .property-input').forEach(input => {
            const propId = input.id.replace('prop-', '');
            input.addEventListener('input', (e) => { // 'change' for select/checkbox, 'input' for text/textarea
                if (e.target.type === 'checkbox') {
                    nodeData.config[propId] = e.target.checked;
                    if (propId === 'includeMessage' && document.getElementById('webhook-body-group')) {
                        document.getElementById('webhook-body-group').style.display = e.target.checked ? 'none' : 'block';
                    }
                } else if (e.target.type === 'number') {
                    nodeData.config[propId] = parseFloat(e.target.value) || 0;
                } else {
                    nodeData.config[propId] = e.target.value;
                }
                this.markUnsavedChanges(true);
                this.renderNodeOnCanvas(nodeData.id);
            });
             if (input.type === 'checkbox' || input.tagName === 'SELECT') { // Also listen for change for these
                input.addEventListener('change', (e) => { // Ensure changes are captured
                    if (e.target.type === 'checkbox') nodeData.config[propId] = e.target.checked;
                    else nodeData.config[propId] = e.target.value;
                     if (propId === 'includeMessage' && document.getElementById('webhook-body-group')) {
                        document.getElementById('webhook-body-group').style.display = e.target.checked ? 'none' : 'block';
                    }
                    this.markUnsavedChanges(true);
                    this.renderNodeOnCanvas(nodeData.id);
                });
            }
        });
    }
    
    renderNodeOnCanvas(nodeId) {
        const nodeData = this.currentFlow.nodes.find(n => n.id === nodeId);
        if (!nodeData) return;
        const existingNodeEl = document.querySelector(`.node[data-id="${nodeId}"]`);
        if (existingNodeEl) {
            const titleEl = existingNodeEl.querySelector('.node-title');
            if (titleEl) titleEl.textContent = this.getNodeTitle(nodeData);
            const bodyEl = existingNodeEl.querySelector('.node-body');
            if (bodyEl) bodyEl.innerHTML = this.getNodeDescription(nodeData);
        }
    }

    handleNodeDragMove = (e) => {
        if (!this.draggedNode || !this.currentFlow) return; // draggedNode is an ID
        const nodeEl = document.querySelector(`.node[data-id="${this.draggedNode}"]`);
        if (!nodeEl) return;

        const canvas = document.getElementById('flow-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        let newX = e.clientX - canvasRect.left + canvas.scrollLeft - this.dragOffset.x;
        let newY = e.clientY - canvasRect.top + canvas.scrollTop - this.dragOffset.y;
        
        // Optional: Add boundary checks here if needed
        // newX = Math.max(0, Math.min(newX, canvas.scrollWidth - nodeEl.offsetWidth));
        // newY = Math.max(0, Math.min(newY, canvas.scrollHeight - nodeEl.offsetHeight));

        nodeEl.style.left = `${newX}px`;
        nodeEl.style.top = `${newY}px`;

        const nodeData = this.currentFlow.nodes.find(n => n.id === this.draggedNode);
        if (nodeData) {
            nodeData.x = newX;
            nodeData.y = newY;
        }
        // No need to mark unsaved changes on every move, do it on dragEnd
        this.redrawConnectionsForNode(this.draggedNode);
    };

    redrawConnectionsForNode(nodeId) {
        if (!this.currentFlow || !this.currentFlow.connections) return;
        this.currentFlow.connections.forEach(conn => {
            if (conn.from === nodeId || conn.to === nodeId) {
                const oldSvg = document.querySelector(`svg.connection[data-from="${conn.from}"][data-to="${conn.to}"]`);
                if (oldSvg) oldSvg.remove();
                this.renderConnection(conn);
            }
        });
    }

    handleNodeDragEnd = () => {
        document.removeEventListener('mousemove', this.handleNodeDragMove);
        document.removeEventListener('mouseup', this.handleNodeDragEnd);
        if (this.draggedNode) { // draggedNode is an ID
            const nodeData = this.currentFlow.nodes.find(n => n.id === this.draggedNode);
            const nodeEl = document.querySelector(`.node[data-id="${this.draggedNode}"]`);
            if (nodeData && nodeEl) { // Ensure both data and element exist
                nodeData.x = parseInt(nodeEl.style.left, 10);
                nodeData.y = parseInt(nodeEl.style.top, 10);
                this.markUnsavedChanges(true); // Mark changes at the end of drag
            }
        }
        this.draggedNode = null;
    };
}