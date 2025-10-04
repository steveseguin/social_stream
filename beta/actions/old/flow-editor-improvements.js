// flow-editor-improvements.js

// Implement the tabbed interface for managing multiple flows
class FlowEditorTabs {
  constructor(editor) {
    this.editor = editor;
    this.tabs = [];
    this.activeTabIndex = -1;
    this.tabsContainer = null;
    this.tabContentContainer = null;
    
    this.init();
  }

  init() {
    const editorEl = document.querySelector('.flow-editor');
    
    // Create tabs container
    this.tabsContainer = document.createElement('div');
    this.tabsContainer.className = 'flow-tabs';
    editorEl.insertBefore(this.tabsContainer, editorEl.querySelector('.editor-main'));
    
    // Create tab content container
    this.tabContentContainer = document.createElement('div');
    this.tabContentContainer.className = 'tab-content';
    this.tabContentContainer.style.width = '100%';
    this.tabContentContainer.style.height = '100%';
    
    const canvasEl = document.getElementById('flow-canvas');
    canvasEl.parentNode.replaceChild(this.tabContentContainer, canvasEl);
    this.tabContentContainer.appendChild(canvasEl);
    
    // Update tab UI when flow list changes
    const originalPopulateFlowsList = this.editor.populateFlowsList.bind(this.editor);
    this.editor.populateFlowsList = () => {
      originalPopulateFlowsList();
      this.updateTabs();
    };
    
    // Override setCurrentFlow
    const originalSetCurrentFlow = this.editor.setCurrentFlow.bind(this.editor);
    this.editor.setCurrentFlow = (flowId) => {
      originalSetCurrentFlow(flowId);
      this.activateTab(this.tabs.findIndex(tab => tab.flowId === flowId));
    };
    
    // Add new flow button to tabs
    const newTabBtn = document.createElement('div');
    newTabBtn.className = 'flow-tab new-tab';
    newTabBtn.innerHTML = '<span>+</span>';
    newTabBtn.addEventListener('click', () => {
      this.editor.onNewFlow();
    });
    
    this.tabsContainer.appendChild(newTabBtn);
  }

  updateTabs() {
    // Clear tabs (except new tab button)
    const newTabBtn = this.tabsContainer.querySelector('.new-tab');
    this.tabsContainer.innerHTML = '';
    this.tabsContainer.appendChild(newTabBtn);
    
    // Recreate tabs from flow list
    this.tabs = Object.values(this.editor.flowSystem.flows).map(flow => ({
      flowId: flow.id,
      name: flow.name,
      active: flow.active,
      unsavedChanges: false
    }));
    
    // Create tab elements
    this.tabs.forEach((tab, index) => {
      const tabEl = document.createElement('div');
      tabEl.className = `flow-tab ${index === this.activeTabIndex ? 'active' : ''}`;
      tabEl.dataset.flowId = tab.flowId;
      
      tabEl.innerHTML = `
        <span class="tab-name">${tab.name}</span>
        <span class="tab-status ${tab.active ? 'active' : 'inactive'}">${tab.active ? 'Active' : 'Inactive'}</span>
        <span class="tab-close">×</span>
      `;
      
      tabEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) {
          this.closeTab(index);
        } else {
          this.activateTab(index);
        }
      });
      
      this.tabsContainer.insertBefore(tabEl, newTabBtn);
    });
    
    // If no active tab but have tabs, activate the first one
    if (this.activeTabIndex === -1 && this.tabs.length > 0) {
      this.activateTab(0);
    }
  }

  activateTab(index) {
    if (index < 0 || index >= this.tabs.length) return;
    
    // Deactivate current tab
    if (this.activeTabIndex !== -1) {
      const currentTabEl = this.tabsContainer.querySelector(`.flow-tab[data-flow-id="${this.tabs[this.activeTabIndex].flowId}"]`);
      if (currentTabEl) {
        currentTabEl.classList.remove('active');
      }
    }
    
    // Activate new tab
    this.activeTabIndex = index;
    const tabEl = this.tabsContainer.querySelector(`.flow-tab[data-flow-id="${this.tabs[index].flowId}"]`);
    if (tabEl) {
      tabEl.classList.add('active');
    }
    
    // Update editor with selected flow
    this.editor.setCurrentFlow(this.tabs[index].flowId);
  }

  closeTab(index) {
    const tab = this.tabs[index];
    
    if (tab.unsavedChanges) {
      if (!confirm(`Close "${tab.name}" without saving changes?`)) {
        return;
      }
    }
    
    // If the tab is active, activate another tab
    if (index === this.activeTabIndex) {
      if (index > 0) {
        this.activateTab(index - 1);
      } else if (this.tabs.length > 1) {
        this.activateTab(0);
      } else {
        this.activeTabIndex = -1;
      }
    }
    
    // Remove tab
    this.tabs.splice(index, 1);
    this.updateTabs();
  }

  markTabUnsaved(flowId, unsaved = true) {
    const tabIndex = this.tabs.findIndex(tab => tab.flowId === flowId);
    if (tabIndex !== -1) {
      this.tabs[tabIndex].unsavedChanges = unsaved;
      
      const tabEl = this.tabsContainer.querySelector(`.flow-tab[data-flow-id="${flowId}"]`);
      if (tabEl) {
        if (unsaved) {
          tabEl.classList.add('unsaved');
        } else {
          tabEl.classList.remove('unsaved');
        }
      }
    }
  }
}

// Logic node improvements for complex conditional flows
class LogicNodesExtension {
  constructor(flowSystem) {
    this.flowSystem = flowSystem;
    this.registerAdvancedLogicNodes();
  }

  registerAdvancedLogicNodes() {
    // Comparison node
    this.flowSystem.registerLogicNode('compare', {
      name: 'Compare',
      inputs: { a: 'Any', b: 'Any' },
      outputs: { equal: 'Boolean', notEqual: 'Boolean', greater: 'Boolean', less: 'Boolean' },
      config: {
        operator: { type: 'select', options: ['==', '!=', '>', '<', '>=', '<='], default: '==' }
      },
      process: function(inputs, config) {
        const a = inputs.a;
        const b = inputs.b;
        
        let equal = false;
        let notEqual = false;
        let greater = false;
        let less = false;
        
        switch(config.operator) {
          case '==':
            equal = a == b;
            notEqual = !equal;
            break;
          case '!=':
            notEqual = a != b;
            equal = !notEqual;
            break;
          case '>':
            greater = a > b;
            break;
          case '<':
            less = a < b;
            break;
          case '>=':
            greater = a >= b;
            equal = a == b;
            break;
          case '<=':
            less = a <= b;
            equal = a == b;
            break;
        }
        
        return {
          equal,
          notEqual,
          greater,
          less
        };
      }
    });

// Multi-branch switch node (continued)
    this.flowSystem.registerLogicNode('switch', {
      name: 'Switch',
      inputs: { input: 'Any' },
      outputs: { case1: 'Any', case2: 'Any', case3: 'Any', default: 'Any' },
      config: {
        case1Value: { type: 'text', default: '' },
        case2Value: { type: 'text', default: '' },
        case3Value: { type: 'text', default: '' }
      },
      process: function(inputs, config) {
        const input = inputs.input;
        const outputs = {
          case1: null,
          case2: null,
          case3: null,
          default: null
        };
        
        if (input === config.case1Value) {
          outputs.case1 = input;
        } else if (input === config.case2Value) {
          outputs.case2 = input;
        } else if (input === config.case3Value) {
          outputs.case3 = input;
        } else {
          outputs.default = input;
        }
        
        return outputs;
      }
    });

    // Message content matcher
    this.flowSystem.registerLogicNode('messageMatch', {
      name: 'Message Matcher',
      inputs: { message: 'Message' },
      outputs: { match: 'Message', noMatch: 'Message' },
      config: {
        matchType: { type: 'select', options: ['Contains', 'Starts With', 'Exact Match', 'Regex'], default: 'Contains' },
        pattern: { type: 'text', default: '' },
        caseSensitive: { type: 'select', options: ['Yes', 'No'], default: 'No' }
      },
      process: function(inputs, config) {
        const message = inputs.message;
        if (!message || !message.content) {
          return { match: null, noMatch: message };
        }
        
        let content = message.content;
        let pattern = config.pattern;
        
        if (config.caseSensitive === 'No') {
          content = content.toLowerCase();
          pattern = pattern.toLowerCase();
        }
        
        let isMatch = false;
        
        switch (config.matchType) {
          case 'Contains':
            isMatch = content.includes(pattern);
            break;
          case 'Starts With':
            isMatch = content.startsWith(pattern);
            break;
          case 'Exact Match':
            isMatch = content === pattern;
            break;
          case 'Regex':
            try {
              const regex = new RegExp(config.pattern, config.caseSensitive === 'No' ? 'i' : '');
              isMatch = regex.test(message.content);
            } catch (e) {
              console.error('Invalid regex pattern:', e);
              isMatch = false;
            }
            break;
        }
        
        return {
          match: isMatch ? message : null,
          noMatch: isMatch ? null : message
        };
      }
    });

    // Points requirement checker
    this.flowSystem.registerLogicNode('pointsCheck', {
      name: 'Points Check',
      inputs: { user: 'User' },
      outputs: { sufficient: 'User', insufficient: 'User' },
      config: {
        requiredPoints: { type: 'number', default: 100 }
      },
      process: function(inputs, config) {
        const user = inputs.user;
        if (!user || typeof user.points !== 'number') {
          return { sufficient: null, insufficient: user };
        }
        
        const hasEnoughPoints = user.points >= config.requiredPoints;
        
        return {
          sufficient: hasEnoughPoints ? user : null,
          insufficient: hasEnoughPoints ? null : user
        };
      }
    });

    // Parallel processor (fan-out)
    this.flowSystem.registerLogicNode('parallel', {
      name: 'Parallel',
      inputs: { input: 'Any' },
      outputs: { output1: 'Any', output2: 'Any', output3: 'Any' },
      process: function(inputs) {
        const input = inputs.input;
        return {
          output1: input,
          output2: input,
          output3: input
        };
      }
    });

    // Delay node for time-based operations
    this.flowSystem.registerLogicNode('delay', {
      name: 'Delay',
      inputs: { input: 'Any' },
      outputs: { output: 'Any' },
      config: {
        delayMs: { type: 'number', default: 1000 }
      },
      process: function(inputs, config) {
        const input = inputs.input;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({ output: input });
          }, config.delayMs);
        });
      }
    });
  }
}

// Enhanced Error Handling and Validation
class FlowValidation {
  constructor(editor) {
    this.editor = editor;
    this.flowSystem = editor.flowSystem;
    this.validationErrors = [];
    
    this.init();
  }

  init() {
    // Add validation to save flow
    const originalSaveFlow = this.editor.onSaveFlow.bind(this.editor);
    this.editor.onSaveFlow = () => {
      if (this.validateCurrentFlow()) {
        originalSaveFlow();
      } else {
        this.showValidationErrors();
      }
    };
    
    // Add validation panel to UI
    this.createValidationPanel();
  }

  createValidationPanel() {
    const propertiesPanel = document.querySelector('.editor-properties');
    
    const validationPanel = document.createElement('div');
    validationPanel.className = 'flow-validation';
    validationPanel.innerHTML = `
      <h3>Validation</h3>
      <div class="validation-controls">
        <button id="validate-flow-btn">Validate Flow</button>
      </div>
      <div id="validation-results" class="validation-results"></div>
    `;
    
    propertiesPanel.appendChild(validationPanel);
    
    // Add validation button event
    document.getElementById('validate-flow-btn').addEventListener('click', () => {
      if (this.validateCurrentFlow()) {
        document.getElementById('validation-results').innerHTML = '<p class="validation-success">Flow is valid!</p>';
      } else {
        this.showValidationErrors();
      }
    });
  }

  validateCurrentFlow() {
    if (!this.editor.currentFlow) {
      this.validationErrors = ['No flow selected.'];
      return false;
    }
    
    this.validationErrors = [];
    
    // Check for disconnected nodes
    this.checkDisconnectedNodes();
    
    // Check for invalid connections
    this.checkInvalidConnections();
    
    // Check for cycles
    this.checkCycles();
    
    // Check for missing configurations
    this.checkMissingConfigurations();
    
    return this.validationErrors.length === 0;
  }

  checkDisconnectedNodes() {
    const flow = this.editor.currentFlow;
    const connectedNodes = new Set();
    
    // Add all source and target nodes from connections
    flow.connections.forEach(conn => {
      connectedNodes.add(conn.source.nodeId);
      connectedNodes.add(conn.target.nodeId);
    });
    
    // Check for any nodes that aren't connected
    const disconnectedNodes = [];
    
    Object.entries(flow.nodes).forEach(([id, node]) => {
      // Skip trigger nodes (they don't need incoming connections)
      if (node.type.startsWith('trigger:')) {
        return;
      }
      
      if (!connectedNodes.has(id)) {
        disconnectedNodes.push(id);
      }
    });
    
    if (disconnectedNodes.length > 0) {
      this.validationErrors.push(`Disconnected nodes: ${disconnectedNodes.length} nodes are not connected to the flow.`);
    }
  }

  checkInvalidConnections() {
    const flow = this.editor.currentFlow;
    
    flow.connections.forEach((conn, index) => {
      const sourceNode = flow.nodes[conn.source.nodeId];
      const targetNode = flow.nodes[conn.target.nodeId];
      
      if (!sourceNode || !targetNode) {
        this.validationErrors.push(`Connection #${index + 1} refers to a non-existent node.`);
        return;
      }
      
      // Check that output port exists on source node
      const [sourceCategory, sourceType] = sourceNode.type.split(':');
      const sourceNodeDef = this.flowSystem.nodeTypes[sourceCategory][sourceType];
      
      if (!sourceNodeDef || !sourceNodeDef.outputs[conn.source.portName]) {
        this.validationErrors.push(`Connection #${index + 1} uses undefined output port "${conn.source.portName}" on ${sourceNodeDef?.name || 'unknown'} node.`);
      }
      
      // Check that input port exists on target node
      const [targetCategory, targetType] = targetNode.type.split(':');
      const targetNodeDef = this.flowSystem.nodeTypes[targetCategory][targetType];
      
      if (!targetNodeDef || !targetNodeDef.inputs[conn.target.portName]) {
        this.validationErrors.push(`Connection #${index + 1} uses undefined input port "${conn.target.portName}" on ${targetNodeDef?.name || 'unknown'} node.`);
      }
    });
  }

  checkCycles() {
    const flow = this.editor.currentFlow;
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (nodeId) => {
      if (recursionStack.has(nodeId)) {
        return true;
      }
      
      if (visited.has(nodeId)) {
        return false;
      }
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      // Find all outgoing connections
      const outgoingNodes = flow.connections
        .filter(conn => conn.source.nodeId === nodeId)
        .map(conn => conn.target.nodeId);
      
      for (const nextNode of outgoingNodes) {
        if (hasCycle(nextNode)) {
          return true;
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    // Start from trigger nodes
    const triggerNodes = Object.entries(flow.nodes)
      .filter(([id, node]) => node.type.startsWith('trigger:'))
      .map(([id]) => id);
    
    for (const triggerNode of triggerNodes) {
      if (hasCycle(triggerNode)) {
        this.validationErrors.push('Cycle detected in flow. Flows cannot contain loops.');
        break;
      }
    }
  }

  checkMissingConfigurations() {
    const flow = this.editor.currentFlow;
    
    Object.entries(flow.nodes).forEach(([id, node]) => {
      const [category, type] = node.type.split(':');
      const nodeDef = this.flowSystem.nodeTypes[category][type];
      
      if (!nodeDef || !nodeDef.config) {
        return;
      }
      
      // Check for required config properties
      Object.entries(nodeDef.config).forEach(([propName, propDef]) => {
        if (propDef.required && (!node.config || !node.config[propName])) {
          this.validationErrors.push(`Node "${nodeDef.name}" (${id}) is missing required configuration for "${propName}".`);
        }
      });
    });
  }

  showValidationErrors() {
    const resultsEl = document.getElementById('validation-results');
    
    if (this.validationErrors.length === 0) {
      resultsEl.innerHTML = '<p class="validation-success">Flow is valid!</p>';
      return;
    }
    
    let html = '<ul class="validation-errors">';
    
    this.validationErrors.forEach(error => {
      html += `<li>${error}</li>`;
    });
    
    html += '</ul>';
    
    resultsEl.innerHTML = html;
  }
}

// Debug and Testing Enhancements
class FlowDebugger {
  constructor(editor) {
    this.editor = editor;
    this.flowSystem = editor.flowSystem;
    this.debugMode = false;
    this.messageHistory = [];
    this.maxHistoryLength = 50;
    
    this.init();
  }

  init() {
    // Add debug panel to UI
    this.createDebugPanel();
    
    // Enhance execution to track message flow
    this.enhanceFlowExecution();
  }

  createDebugPanel() {
    const propertiesPanel = document.querySelector('.editor-properties');
    
    const debugPanel = document.createElement('div');
    debugPanel.className = 'flow-debugger';
    debugPanel.innerHTML = `
      <h3>Flow Debugger</h3>
      <div class="debug-controls">
        <label>
          <input type="checkbox" id="debug-mode-toggle" />
          Debug Mode
        </label>
        <button id="clear-history-btn">Clear History</button>
      </div>
      <div class="message-history">
        <h4>Message History</h4>
        <div id="message-history-list" class="history-list"></div>
      </div>
    `;
    
    propertiesPanel.appendChild(debugPanel);
    
    // Add debug toggle event
    document.getElementById('debug-mode-toggle').addEventListener('change', (e) => {
      this.debugMode = e.target.checked;
    });
    
    // Add clear history event
    document.getElementById('clear-history-btn').addEventListener('click', () => {
      this.messageHistory = [];
      this.updateHistoryList();
    });
  }

  enhanceFlowExecution() {
    // Override flow execution
    const originalExecuteFlow = this.flowSystem.executeFlow.bind(this.flowSystem);
    
    this.flowSystem.executeFlow = (flow, initialData) => {
      if (!this.debugMode) {
        return originalExecuteFlow(flow, initialData);
      }
      
      // Create debug entry
      const debugEntry = {
        timestamp: new Date(),
        flowId: flow.id,
        initialData,
        nodeActivations: {},
        result: null
      };
      
      // Track node activations
      const trackNodeActivation = (nodeId, inputs, outputs) => {
        debugEntry.nodeActivations[nodeId] = {
          inputs: JSON.parse(JSON.stringify(inputs)),
          outputs: JSON.parse(JSON.stringify(outputs)),
          timestamp: new Date()
        };
      };
      
      // Find all trigger nodes (entry points)
      const triggerNodes = Object.entries(flow.nodes)
        .filter(([id, node]) => node.type.startsWith('trigger:'))
        .map(([id]) => id);
      
      // Process each trigger node
      let flowTriggered = false;
      const nodeOutputs = {};
      
      triggerNodes.forEach(nodeId => {
        const node = flow.nodes[nodeId];
        const triggerType = node.type.split(':')[1];
        const triggerDef = this.flowSystem.nodeTypes.triggers[triggerType];
        
        if (triggerDef) {
          const output = triggerDef.process(initialData, node.config);
          if (output) {
            flowTriggered = true;
            nodeOutputs[nodeId] = output;
            
            // Track trigger activation
            trackNodeActivation(nodeId, { initialData }, output);
          }
        }
      });
      
      if (!flowTriggered) {
        // Add to history even if not triggered
        debugEntry.result = null;
        this.addToHistory(debugEntry);
        return null;
      }
      
      // Execute the flow by traversing connections
      const processedNodes = new Set(triggerNodes);
      let nodesToProcess = this.flowSystem.getConnectedNodes(flow, triggerNodes);
      
      while (nodesToProcess.length > 0) {
        const nextNodes = [];
        
        nodesToProcess.forEach(nodeId => {
          if (processedNodes.has(nodeId)) return;
          
          const node = flow.nodes[nodeId];
          const [nodeCategory, nodeType] = node.type.split(':');
          const nodeDef = this.flowSystem.nodeTypes[nodeCategory][nodeType];
          
          if (!nodeDef) return;
          
          // Get all inputs to this node
          const nodeInputs = {};
          let allInputsAvailable = true;
          
          Object.keys(nodeDef.inputs).forEach(inputName => {
            const connectedOutput = this.flowSystem.getNodeInput(flow, nodeId, inputName, nodeOutputs);
            if (connectedOutput === undefined) {
              allInputsAvailable = false;
            } else {
              nodeInputs[inputName] = connectedOutput;
            }
          });
          
          if (allInputsAvailable) {
            let output;
            if (nodeCategory === 'logic') {
              output = nodeDef.process(nodeInputs, node.config);
            } else if (nodeCategory === 'action') {
              output = nodeDef.execute(nodeInputs, node.config);
            }
            
            if (output) {
              nodeOutputs[nodeId] = output;
              
              // Track node activation
              trackNodeActivation(nodeId, nodeInputs, output);
            }
            
            processedNodes.add(nodeId);
            const connectedNodes = this.flowSystem.getConnectedNodes(flow, [nodeId]);
            nextNodes.push(...connectedNodes);
          }
        });
        
        nodesToProcess = nextNodes.filter(id => !processedNodes.has(id));
      }
      
      // Add to history
      debugEntry.result = nodeOutputs;
      this.addToHistory(debugEntry);
      
      return { flowId: flow.id, result: nodeOutputs };
    };
  }

  addToHistory(entry) {
    this.messageHistory.unshift(entry);
    
    // Limit history size
    if (this.messageHistory.length > this.maxHistoryLength) {
      this.messageHistory.pop();
    }
    
    // Update UI
    this.updateHistoryList();
    
    // Highlight nodes in flow
    this.highlightNodesInFlow(entry);
  }

  updateHistoryList() {
    const historyListEl = document.getElementById('message-history-list');
    
    if (this.messageHistory.length === 0) {
      historyListEl.innerHTML = '<p>No messages processed yet.</p>';
      return;
    }
    
    let html = '';
    
    this.messageHistory.forEach((entry, index) => {
      const time = entry.timestamp.toLocaleTimeString();
      const flowName = this.flowSystem.flows[entry.flowId]?.name || 'Unknown';
      const success = entry.result !== null;
      
      html += `
        <div class="history-item ${success ? 'success' : 'failure'}">
          <div class="history-header">
            <span class="history-time">${time}</span>
            <span class="history-flow">${flowName}</span>
            <span class="history-status">${success ? 'Triggered' : 'Not Triggered'}</span>
          </div>
          <div class="history-content">
            <pre>${JSON.stringify(entry.initialData, null, 2)}</pre>
          </div>
          <button class="view-debug-btn" data-index="${index}">View Details</button>
        </div>
      `;
    });
    
    historyListEl.innerHTML = html;
    
    // Add view details button events
    document.querySelectorAll('.view-debug-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.showDebugDetails(this.messageHistory[index]);
      });
    });
  }

  showDebugDetails(entry) {
    // Create modal for debug details
    const modal = document.createElement('div');
    modal.className = 'debug-modal';
    
    const flowName = this.flowSystem.flows[entry.flowId]?.name || 'Unknown';
    
    modal.innerHTML = `
      <div class="debug-modal-content">
        <div class="debug-modal-header">
          <h3>Debug Details - ${flowName}</h3>
          <button class="close-modal-btn">×</button>
        </div>
        <div class="debug-modal-body">
          <h4>Initial Message</h4>
          <pre>${JSON.stringify(entry.initialData, null, 2)}</pre>
          
          <h4>Node Activations</h4>
          <div class="node-activations-list">
            ${this.generateNodeActivationsHTML(entry)}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add close button event
    modal.querySelector('.close-modal-btn').addEventListener('click', () => {
      modal.remove();
    });
    
    // Allow clicking outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    // Visualize message flow in modal
    this.visualizeMessageFlow(entry, modal.querySelector('.debug-modal-body'));
  }

  generateNodeActivationsHTML(entry) {
    if (Object.keys(entry.nodeActivations).length === 0) {
      return '<p>No nodes were activated.</p>';
    }
    
    let html = '';
    
    // Order by timestamp
    const orderedActivations = Object.entries(entry.nodeActivations)
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    orderedActivations.forEach(([nodeId, activation]) => {
      const node = this.flowSystem.flows[entry.flowId]?.nodes[nodeId];
      if (!node) return;
      
      const [category, type] = node.type.split(':');
      const nodeDef = this.flowSystem.nodeTypes[category][type];
      
      html += `
        <div class="node-activation">
          <h5>${nodeDef?.name || 'Unknown Node'}</h5>
          <div class="activation-details">
            <div class="activation-inputs">
              <h6>Inputs</h6>
              <pre>${JSON.stringify(activation.inputs, null, 2)}</pre>
            </div>
            <div class="activation-outputs">
              <h6>Outputs</h6>
              <pre>${JSON.stringify(activation.outputs, null, 2)}</pre>
            </div>
          </div>
        </div>
      `;
    });
    
    return html;
  }

  visualizeMessageFlow(entry, container) {
    const visualizationEl = document.createElement('div');
    visualizationEl.className = 'flow-visualization';
    visualizationEl.innerHTML = '<h4>Message Flow Visualization</h4>';
    
    // Create SVG canvas
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '400px');
    visualizationEl.appendChild(svg);
    
    // Add visualization to container
    container.appendChild(visualizationEl);
    
    // Generate visualization (simplified version)
    const flow = this.flowSystem.flows[entry.flowId];
    if (!flow) return;
    
    // Create nodes
    const nodes = {};
    const nodeSize = { width: 120, height: 40 };
    const xSpacing = 150;
    const ySpacing = 80;
    
    // Layout nodes in levels (breadth-first)
    const orderedActivations = Object.keys(entry.nodeActivations);
    const nodeLevels = {};
    let maxLevel = 0;
    
    // Calculate node levels
    const calculateLevel = (nodeId, level = 0) => {
      if (nodeLevels[nodeId] !== undefined && nodeLevels[nodeId] >= level) {
        return;
      }
      
      nodeLevels[nodeId] = level;
      maxLevel = Math.max(maxLevel, level);
      
      // Find connected nodes
      const connectedNodes = flow.connections
        .filter(conn => conn.source.nodeId === nodeId)
        .map(conn => conn.target.nodeId);
      
      connectedNodes.forEach(nextNode => {
        calculateLevel(nextNode, level + 1);
      });
    };
    
    // Start from trigger nodes
    const triggerNodes = orderedActivations.filter(id => flow.nodes[id]?.type.startsWith('trigger:'));
    triggerNodes.forEach(nodeId => calculateLevel(nodeId));
    
    // Count nodes per level
    const nodesPerLevel = {};
    Object.values(nodeLevels).forEach(level => {
      nodesPerLevel[level] = (nodesPerLevel[level] || 0) + 1;
    });
    
    // Create node elements
    Object.entries(nodeLevels).forEach(([nodeId, level]) => {
      const node = flow.nodes[nodeId];
      if (!node) return;
      
      const [category, type] = node.type.split(':');
      const nodeDef = this.flowSystem.nodeTypes[category][type];
      
      const nodesInLevel = nodesPerLevel[level];
      const levelWidth = nodesInLevel * (nodeSize.width + 20);
      const startX = (600 - levelWidth) / 2;
      
      // Count nodes processed before this one in same level
      const nodesBeforeInLevel = Object.entries(nodeLevels)
        .filter(([id, l]) => l === level && parseInt(id) < parseInt(nodeId))
        .length;
      
      const x = startX + nodesBeforeInLevel * (nodeSize.width + 20);
      const y = 20 + level * (nodeSize.height + ySpacing);
      
      // Create group
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      // Create rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', nodeSize.width);
      rect.setAttribute('height', nodeSize.height);
      rect.setAttribute('rx', '5');
      rect.setAttribute('class', `node-vis ${category}-node`);
      g.appendChild(rect);
      
      // Create text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + nodeSize.width / 2);
      text.setAttribute('y', y + nodeSize.height / 2);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.textContent = nodeDef?.name || 'Unknown';
      g.appendChild(text);
      
      // Add to svg
      svg.appendChild(g);
      
      // Store for connections
      nodes[nodeId] = {
        x: x + nodeSize.width / 2,
        y: y + nodeSize.height / 2,
        width: nodeSize.width,
        height: nodeSize.height
      };
    });
    
    // Create connections
    flow.connections.forEach(conn => {
      const sourceNode = nodes[conn.source.nodeId];
      const targetNode = nodes[conn.target.nodeId];
      
      if (!sourceNode || !targetNode) return;
      
      // Create path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      
      // Calculate bezier curve
      const sourceX = sourceNode.x;
      const sourceY = sourceNode.y + sourceNode.height / 2;
      const targetX = targetNode.x;
      const targetY = targetNode.y - targetNode.height / 2;
      
      // Add arrow marker
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `arrow-${conn.source.nodeId}-${conn.target.nodeId}`);
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '5');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto');
      
      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      marker.appendChild(arrowPath);
      
      svg.appendChild(marker);
      
      // Path definition
      const dx = Math.abs(targetX - sourceX) * 0.5;
      const pathD = `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + dx}, ${targetX} ${targetY - dx}, ${targetX} ${targetY}`;
      
      path.setAttribute('d', pathD);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#666');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('marker-end', `url(#arrow-${conn.source.nodeId}-${conn.target.nodeId})`);
      
      // Was this connection activated?
      if (entry.nodeActivations[conn.source.nodeId] && entry.nodeActivations[conn.target.nodeId]) {
        path.setAttribute('class', 'active-connection');
      }
      
      svg.appendChild(path);
    });
  }

  highlightNodesInFlow(entry) {
    // Clear previous highlights
    document.querySelectorAll('.flow-node').forEach(node => {
      node.classList.remove('debug-active');
    });
    
    // Highlight activated nodes
    Object.keys(entry.nodeActivations).forEach(nodeId => {
      const nodeEl = document.querySelector(`.flow-node[data-node-id="${nodeId}"]`);
      if (nodeEl) {
        nodeEl.classList.add('debug-active');
      }
    });
  }
}

// Flow UI and UX Improvements (continued)
  function improveFlowEditorUI(editor) {
    // Move save controls to a more visible position
    const moveControlsToTopBar = () => {
      const editorEl = document.querySelector('.flow-editor');
      
      // Create top bar
      const topBar = document.createElement('div');
      topBar.className = 'editor-top-bar';
      
      // Move save controls
      const saveControls = document.createElement('div');
      saveControls.className = 'save-controls';
      saveControls.innerHTML = `
        <button id="new-flow-btn-top">New Flow</button>
        <button id="save-flow-btn-top" class="save-btn">Save Flow</button>
        <button id="export-flow-btn">Export</button>
        <button id="import-flow-btn">Import</button>
      `;
      
      topBar.appendChild(saveControls);
      
      // Add status indicator
      const statusIndicator = document.createElement('div');
      statusIndicator.className = 'flow-status-indicator';
      statusIndicator.innerHTML = `
        <div class="flow-name-display">No flow selected</div>
        <div class="flow-active-toggle">
          <label>
            <input type="checkbox" id="flow-active-toggle" />
            <span class="toggle-label">Active</span>
          </label>
        </div>
      `;
      
      topBar.appendChild(statusIndicator);
      
      // Insert top bar at the beginning of editor
      editorEl.insertBefore(topBar, editorEl.firstChild);
      
      // Connect new buttons to original functionality
      document.getElementById('new-flow-btn-top').addEventListener('click', editor.onNewFlow.bind(editor));
      document.getElementById('save-flow-btn-top').addEventListener('click', editor.onSaveFlow.bind(editor));
      
      // Add export/import functionality
      document.getElementById('export-flow-btn').addEventListener('click', () => {
        exportFlow(editor);
      });
      
      document.getElementById('import-flow-btn').addEventListener('click', () => {
        importFlow(editor);
      });
      
      // Update flow active toggle
      const updateFlowToggle = () => {
        const toggle = document.getElementById('flow-active-toggle');
        const nameDisplay = document.querySelector('.flow-name-display');
        
        if (editor.currentFlow) {
          nameDisplay.textContent = editor.currentFlow.name;
          toggle.checked = editor.currentFlow.active;
          toggle.disabled = false;
        } else {
          nameDisplay.textContent = 'No flow selected';
          toggle.checked = false;
          toggle.disabled = true;
        }
      };
      
      // Connect flow active toggle
      document.getElementById('flow-active-toggle').addEventListener('change', (e) => {
        if (editor.currentFlow) {
          editor.flowSystem.toggleFlowActive(editor.currentFlow.id);
          editor.populateFlowsList();
        }
      });
      
      // Override setCurrentFlow to update status
      const originalSetCurrentFlow = editor.setCurrentFlow.bind(editor);
      editor.setCurrentFlow = (flowId) => {
        originalSetCurrentFlow(flowId);
        updateFlowToggle();
      };
      
      // Initial update
      updateFlowToggle();
    };
    
    // Implement visual indicators for active/inactive flows
    const enhanceFlowStatusIndicators = () => {
      // Add visual badges to nodes to indicate their category
      document.querySelectorAll('.flow-node').forEach(node => {
        const nodeType = node.dataset.nodeType.split(':')[0];
        
        if (!node.querySelector('.node-badge')) {
          const badge = document.createElement('div');
          badge.className = `node-badge ${nodeType}-badge`;
          badge.textContent = nodeType.charAt(0).toUpperCase();
          node.appendChild(badge);
        }
      });
      
      // Improve visibility of flow active status
      const originalPopulateFlowsList = editor.populateFlowsList.bind(editor);
      editor.populateFlowsList = () => {
        originalPopulateFlowsList();
        
        // Add visual active/inactive indicators
        document.querySelectorAll('.flow-item').forEach(item => {
          const isActive = item.classList.contains('active');
          const statusLabel = item.querySelector('.toggle-flow-btn');
          
          if (statusLabel) {
            statusLabel.classList.toggle('active-status', isActive);
            statusLabel.classList.toggle('inactive-status', !isActive);
          }
        });
      };
    };
    
    // Improve node styling and layout
    const improveNodeStyling = () => {
      // Add better styling to nodes
      const originalCreateNodeElement = editor.createNodeElement.bind(editor);
      editor.createNodeElement = (id, nodeType, x, y, nodeDef, config = {}) => {
        const nodeEl = originalCreateNodeElement(id, nodeType, x, y, nodeDef, config);
        
        // Add icon to node header
        const header = nodeEl.querySelector('.node-header');
        const [category] = nodeType.split(':');
        
        let icon = '';
        switch (category) {
          case 'trigger':
            icon = '⚡';
            break;
          case 'action':
            icon = '▶';
            break;
          case 'logic':
            icon = '⚙';
            break;
        }
        
        header.innerHTML = `<span class="node-icon">${icon}</span> ${nodeDef.name}`;
        
        return nodeEl;
      };
      
      // Enhance port styling
      document.querySelectorAll('.node-port').forEach(port => {
        const portType = port.dataset.portType;
        const handle = port.querySelector('.port-handle');
        
        if (handle) {
          handle.setAttribute('title', portType);
          handle.classList.add(`${portType}-type`);
        }
      });
    };
    
    // Add grid snapping for better node alignment
    const addGridSnapping = () => {
      const gridSize = 20;
      
      // Override node dragging
      const originalDocumentMouseMove = editor.onDocumentMouseMove.bind(editor);
      editor.onDocumentMouseMove = (e) => {
        originalDocumentMouseMove(e);
        
        // Snap to grid when node is released
        if (editor.draggedNode) {
          const x = Math.round(parseInt(editor.draggedNode.style.left) / gridSize) * gridSize;
          const y = Math.round(parseInt(editor.draggedNode.style.top) / gridSize) * gridSize;
          
          editor.draggedNode.style.left = `${x}px`;
          editor.draggedNode.style.top = `${y}px`;
          
          // Update connections
          editor.updateNodeConnections(editor.draggedNode.dataset.nodeId);
        }
      };
    };
    
    // Add keyboard shortcuts
    const addKeyboardShortcuts = () => {
      document.addEventListener('keydown', (e) => {
        // Ctrl+S to save
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          editor.onSaveFlow();
        }
        
        // Delete key to remove selected node
        if (e.key === 'Delete' && editor.selectedNode) {
          e.preventDefault();
          
          if (confirm('Delete selected node?')) {
            // Remove connections to/from this node
            const nodeId = editor.selectedNode.dataset.nodeId;
            
            document.querySelectorAll(`.connection[data-source-node="${nodeId}"], .connection[data-target-node="${nodeId}"]`)
              .forEach(conn => conn.remove());
            
            // Remove node
            editor.selectedNode.remove();
            delete editor.nodes[nodeId];
            editor.selectedNode = null;
            
            // Clear properties panel
            document.getElementById('node-config').innerHTML = '';
          }
        }
      });
    };
    
    // Add zoom controls for canvas
    const addZoomControls = () => {
      const editorMain = document.querySelector('.editor-main');
      
      // Add zoom controls
      const zoomControls = document.createElement('div');
      zoomControls.className = 'zoom-controls';
      zoomControls.innerHTML = `
        <button id="zoom-in-btn">+</button>
        <span id="zoom-level">100%</span>
        <button id="zoom-out-btn">-</button>
        <button id="zoom-reset-btn">Reset</button>
      `;
      
      editorMain.appendChild(zoomControls);
      
      // Zoom functionality
      let zoomLevel = 1.0;
      const canvas = document.getElementById('flow-canvas');
      
      const updateZoom = () => {
        canvas.style.transform = `scale(${zoomLevel})`;
        canvas.style.transformOrigin = 'top left';
        document.getElementById('zoom-level').textContent = `${Math.round(zoomLevel * 100)}%`;
      };
      
      document.getElementById('zoom-in-btn').addEventListener('click', () => {
        zoomLevel = Math.min(zoomLevel + 0.1, 2.0);
        updateZoom();
      });
      
      document.getElementById('zoom-out-btn').addEventListener('click', () => {
        zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
        updateZoom();
      });
      
      document.getElementById('zoom-reset-btn').addEventListener('click', () => {
        zoomLevel = 1.0;
        updateZoom();
      });
      
      // Add mouse wheel zoom
      canvas.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          
          if (e.deltaY < 0) {
            zoomLevel = Math.min(zoomLevel + 0.05, 2.0);
          } else {
            zoomLevel = Math.max(zoomLevel - 0.05, 0.5);
          }
          
          updateZoom();
        }
      });
    };
    
    // Apply all UI improvements
    moveControlsToTopBar();
    enhanceFlowStatusIndicators();
    improveNodeStyling();
    addGridSnapping();
    addKeyboardShortcuts();
    addZoomControls();
  }

  // Export/import functionality
  function exportFlow(editor) {
    if (!editor.currentFlow) {
      alert('No flow selected to export.');
      return;
    }
    
    // Prepare export data
    const exportData = JSON.stringify(editor.currentFlow, null, 2);
    
    // Create download link
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editor.currentFlow.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
  }

  function importFlow(editor) {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const flowData = JSON.parse(event.target.result);
          
          // Validate flow data
          if (!flowData.id || !flowData.name || !flowData.nodes || !flowData.connections) {
            throw new Error('Invalid flow file format');
          }
          
          // Check if flow with same ID already exists
          if (editor.flowSystem.flows[flowData.id]) {
            const newId = 'flow_' + Date.now();
            flowData.id = newId;
            flowData.name += ' (Imported)';
          }
          
          // Add flow to system
          editor.flowSystem.flows[flowData.id] = flowData;
          editor.flowSystem.saveFlow(flowData);
          editor.populateFlowsList();
          editor.setCurrentFlow(flowData.id);
          
          alert('Flow imported successfully!');
        } catch (err) {
          alert('Error importing flow: ' + err.message);
        }
      };
      
      reader.readAsText(file);
    });
    
    input.click();
  }

// Flow templates for common patterns
class FlowTemplates {
  constructor(editor) {
    this.editor = editor;
    this.flowSystem = editor.flowSystem;
    this.templates = {};
    
    this.registerDefaultTemplates();
    this.addTemplateUI();
  }

  registerDefaultTemplates() {
    // Command handler template
    this.templates.commandHandler = {
      name: 'Command Handler',
      description: 'Handles chat commands with custom responses',
      create: () => {
        const flow = {
          id: 'flow_' + Date.now(),
          name: 'Command Handler',
          nodes: {},
          connections: [],
          active: false
        };
        
        // Create trigger node
        const triggerNodeId = 'node_' + Date.now();
        flow.nodes[triggerNodeId] = {
          id: triggerNodeId,
          type: 'trigger:commandTrigger',
          x: 100,
          y: 100,
          config: {
            command: '!help',
            platform: 'Any'
          }
        };
        
        // Create response node
        const responseNodeId = 'node_' + (Date.now() + 1);
        flow.nodes[responseNodeId] = {
          id: responseNodeId,
          type: 'action:customResponse',
          x: 300,
          y: 100,
          config: {
            responseText: 'Available commands: !help, !info, !points'
          }
        };
        
        // Connect nodes
        flow.connections.push({
          source: {
            nodeId: triggerNodeId,
            portName: 'output'
          },
          target: {
            nodeId: responseNodeId,
            portName: 'input'
          }
        });
        
        return flow;
      }
    };
    
    // Message filter template
    this.templates.messageFilter = {
      name: 'Message Filter',
      description: 'Filters messages based on content and handles accordingly',
      create: () => {
        const flow = {
          id: 'flow_' + Date.now(),
          name: 'Message Filter',
          nodes: {},
          connections: [],
          active: false
        };
        
        // Create trigger node
        const triggerNodeId = 'node_' + Date.now();
        flow.nodes[triggerNodeId] = {
          id: triggerNodeId,
          type: 'trigger:messageTrigger',
          x: 100,
          y: 100,
          config: {
            platform: 'Any',
            userType: 'Any',
            messagePattern: ''
          }
        };
        
        // Create message matcher node
        const matcherNodeId = 'node_' + (Date.now() + 1);
        flow.nodes[matcherNodeId] = {
          id: matcherNodeId,
          type: 'logic:messageMatch',
          x: 300,
          y: 100,
          config: {
            matchType: 'Contains',
            pattern: 'bad word',
            caseSensitive: 'No'
          }
        };
        
        // Create hide message node
        const hideNodeId = 'node_' + (Date.now() + 2);
        flow.nodes[hideNodeId] = {
          id: hideNodeId,
          type: 'action:hideMessage',
          x: 500,
          y: 50,
          config: {}
        };
        
        // Connect nodes
        flow.connections.push({
          source: {
            nodeId: triggerNodeId,
            portName: 'output'
          },
          target: {
            nodeId: matcherNodeId,
            portName: 'message'
          }
        });
        
        flow.connections.push({
          source: {
            nodeId: matcherNodeId,
            portName: 'match'
          },
          target: {
            nodeId: hideNodeId,
            portName: 'input'
          }
        });
        
        return flow;
      }
    };
    
    // Points redemption template
    this.templates.pointsRedemption = {
      name: 'Points Redemption',
      description: 'Handles points redemption and triggers actions',
      create: () => {
        const flow = {
          id: 'flow_' + Date.now(),
          name: 'Points Redemption',
          nodes: {},
          connections: [],
          active: false
        };
        
        // Create trigger node
        const triggerNodeId = 'node_' + Date.now();
        flow.nodes[triggerNodeId] = {
          id: triggerNodeId,
          type: 'trigger:pointsSpentTrigger',
          x: 100,
          y: 100,
          config: {
            minPoints: 100
          }
        };
        
        // Create OBS scene change node
        const obsNodeId = 'node_' + (Date.now() + 1);
        flow.nodes[obsNodeId] = {
          id: obsNodeId,
          type: 'action:changeOBSScene',
          x: 300,
          y: 100,
          config: {
            sceneName: 'Special Effect'
          }
        };
        
        // Create custom response node
        const responseNodeId = 'node_' + (Date.now() + 2);
        flow.nodes[responseNodeId] = {
          id: responseNodeId,
          type: 'action:customResponse',
          x: 500,
          y: 100,
          config: {
            responseText: 'Thanks for redeeming points! Special effect activated!'
          }
        };
        
        // Connect nodes
        flow.connections.push({
          source: {
            nodeId: triggerNodeId,
            portName: 'output'
          },
          target: {
            nodeId: obsNodeId,
            portName: 'input'
          }
        });
        
        flow.connections.push({
          source: {
            nodeId: obsNodeId,
            portName: 'output'
          },
          target: {
            nodeId: responseNodeId,
            portName: 'input'
          }
        });
        
        return flow;
      }
    };
    
    // Message relay template
    this.templates.messageRelay = {
      name: 'Message Relay',
      description: 'Relays messages from one platform to another',
      create: () => {
        const flow = {
          id: 'flow_' + Date.now(),
          name: 'Message Relay',
          nodes: {},
          connections: [],
          active: false
        };
        
        // Create trigger node
        const triggerNodeId = 'node_' + Date.now();
        flow.nodes[triggerNodeId] = {
          id: triggerNodeId,
          type: 'trigger:messageTrigger',
          x: 100,
          y: 100,
          config: {
            platform: 'Twitch',
            userType: 'Mod',
            messagePattern: ''
          }
        };
        
        // Create relay message node
        const relayNodeId = 'node_' + (Date.now() + 1);
        flow.nodes[relayNodeId] = {
          id: relayNodeId,
          type: 'action:relayMessage',
          x: 300,
          y: 100,
          config: {
            platform: 'Discord'
          }
        };
        
        // Connect nodes
        flow.connections.push({
          source: {
            nodeId: triggerNodeId,
            portName: 'output'
          },
          target: {
            nodeId: relayNodeId,
            portName: 'input'
          }
        });
        
        return flow;
      }
    };
  }

  addTemplateUI() {
    // Add templates to sidebar
    const sidebarEl = document.querySelector('.editor-sidebar');
    
    const templatesSection = document.createElement('div');
    templatesSection.className = 'flow-templates';
    templatesSection.innerHTML = `
      <h3>Templates</h3>
      <div id="templates-list" class="templates-list"></div>
    `;
    
    sidebarEl.appendChild(templatesSection);
    
    // Populate templates
    this.updateTemplatesList();
  }

  updateTemplatesList() {
    const templatesListEl = document.getElementById('templates-list');
    
    if (!templatesListEl) return;
    
    let html = '';
    
    Object.entries(this.templates).forEach(([id, template]) => {
      html += `
        <div class="template-item" data-template-id="${id}">
          <div class="template-name">${template.name}</div>
          <div class="template-description">${template.description}</div>
          <button class="use-template-btn">Use Template</button>
        </div>
      `;
    });
    
    templatesListEl.innerHTML = html;
    
    // Add click event
    document.querySelectorAll('.use-template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateId = e.target.closest('.template-item').dataset.templateId;
        this.useTemplate(templateId);
      });
    });
  }

  useTemplate(templateId) {
    const template = this.templates[templateId];
    
    if (!template) {
      alert('Template not found.');
      return;
    }
    
    if (this.editor.currentFlow && !confirm('Create new flow from template? Unsaved changes will be lost.')) {
      return;
    }
    
    // Create flow from template
    const flow = template.create();
    
    // Add to system
    this.flowSystem.flows[flow.id] = flow;
    this.flowSystem.saveFlow(flow);
    this.editor.populateFlowsList();
    this.editor.setCurrentFlow(flow.id);
  }
}

// Add tutorial mode for new users
class FlowEditorTutorial {
  constructor(editor) {
    this.editor = editor;
    this.flowSystem = editor.flowSystem;
    this.steps = [];
    this.currentStep = -1;
    
    this.setupTutorial();
    this.addTutorialUI();
  }

  setupTutorial() {
    this.steps = [
      {
        title: 'Welcome to Flow Editor',
        content: 'This tutorial will guide you through creating your first flow. Flows allow you to automate how messages are processed in your stream.',
        position: 'center'
      },
      {
        title: 'Creating a New Flow',
        content: 'Start by clicking the "New Flow" button to create a flow.',
        target: '#new-flow-btn-top',
        position: 'bottom'
      },
      {
        title: 'Adding Trigger Nodes',
        content: 'Trigger nodes are the starting points of your flow. Drag a trigger from the sidebar to the canvas.',
        target: '#trigger-nodes',
        position: 'right'
      },
      {
        title: 'Adding Action Nodes',
        content: 'Action nodes perform operations like sending messages or changing scenes. Drag an action from the sidebar.',
        target: '#action-nodes',
        position: 'right'
      },
      {
        title: 'Creating Connections',
        content: 'Connect nodes by dragging from an output port (right side) to an input port (left side).',
        target: '.flow-canvas',
        position: 'left'
      },
      {
        title: 'Configuring Nodes',
        content: 'Click on a node to select it. You can then configure its properties in the right panel.',
        target: '.node-properties',
        position: 'left'
      },
      {
        title: 'Testing Your Flow',
        content: 'Use the test panel to simulate messages and see how your flow responds.',
        target: '.flow-testing',
        position: 'left'
      },
      {
        title: 'Saving Your Flow',
        content: 'Click "Save Flow" to save your work. Make sure to also enable the flow with the toggle switch.',
        target: '#save-flow-btn-top',
        position: 'bottom'
      },
      {
        title: 'Congratulations!',
        content: 'You\'ve completed the tutorial! Explore more features or create more complex flows with logic nodes.',
        position: 'center'
      }
    ];
  }

  addTutorialUI() {
    // Add tutorial button to top bar
    const topBar = document.querySelector('.editor-top-bar');
    
    if (!topBar) return;
    
    const tutorialButton = document.createElement('button');
    tutorialButton.id = 'start-tutorial-btn';
    tutorialButton.className = 'tutorial-btn';
    tutorialButton.textContent = 'Tutorial';
    tutorialButton.title = 'Start interactive tutorial';
    
    topBar.appendChild(tutorialButton);
    
    // Add tutorial modal
    const tutorialModal = document.createElement('div');
    tutorialModal.className = 'tutorial-modal';
    tutorialModal.style.display = 'none';
    
    tutorialModal.innerHTML = `
      <div class="tutorial-content">
        <div class="tutorial-header">
          <h3 id="tutorial-title"></h3>
          <button id="close-tutorial-btn">×</button>
        </div>
        <div class="tutorial-body">
          <p id="tutorial-text"></p>
        </div>
        <div class="tutorial-footer">
          <button id="prev-tutorial-btn">Previous</button>
          <span id="tutorial-progress"></span>
          <button id="next-tutorial-btn">Next</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(tutorialModal);
    
    // Add event listeners
    document.getElementById('start-tutorial-btn').addEventListener('click', () => {
      this.startTutorial();
    });
    
    document.getElementById('close-tutorial-btn').addEventListener('click', () => {
      this.endTutorial();
    });
    
    document.getElementById('prev-tutorial-btn').addEventListener('click', () => {
      this.prevStep();
    });
    
    document.getElementById('next-tutorial-btn').addEventListener('click', () => {
      this.nextStep();
    });
  }

  startTutorial() {
    this.currentStep = 0;
    this.showStep();
  }

  endTutorial() {
    document.querySelector('.tutorial-modal').style.display = 'none';
    this.removeHighlight();
    this.currentStep = -1;
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.showStep();
    } else {
      this.endTutorial();
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.showStep();
    }
  }

  showStep() {
    const step = this.steps[this.currentStep];
    const modal = document.querySelector('.tutorial-modal');
    
    // Update content
    document.getElementById('tutorial-title').textContent = step.title;
    document.getElementById('tutorial-text').textContent = step.content;
    document.getElementById('tutorial-progress').textContent = `${this.currentStep + 1}/${this.steps.length}`;
    
    // Show modal
    modal.style.display = 'block';
    
    // Update buttons
    document.getElementById('prev-tutorial-btn').disabled = this.currentStep === 0;
    document.getElementById('next-tutorial-btn').textContent = this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next';
    
    // Position modal based on target
    this.removeHighlight();
    
    if (step.target) {
      const targetEl = document.querySelector(step.target);
      
      if (targetEl) {
        this.highlightElement(targetEl);
        this.positionModalNearTarget(modal, targetEl, step.position);
      } else {
        this.positionModalCenter(modal);
      }
    } else {
      this.positionModalCenter(modal);
    }
  }

  highlightElement(element) {
    // Add highlight overlay
    const highlight = document.createElement('div');
    highlight.className = 'tutorial-highlight';
    
    const rect = element.getBoundingClientRect();
    highlight.style.position = 'absolute';
    highlight.style.left = `${rect.left - 5}px`;
    highlight.style.top = `${rect.top - 5}px`;
    highlight.style.width = `${rect.width + 10}px`;
    highlight.style.height = `${rect.height + 10}px`;
    highlight.style.border = '2px solid #4a90e2';
    highlight.style.borderRadius = '4px';
    highlight.style.boxShadow = '0 0 0 2000px rgba(0,0,0,0.5)';
    highlight.style.zIndex = '9998';
    highlight.style.pointerEvents = 'none';
    
    document.body.appendChild(highlight);
  }

  removeHighlight() {
    const highlight = document.querySelector('.tutorial-highlight');
    if (highlight) {
      highlight.remove();
    }
  }

positionModalNearTarget(modal, target, position) {
    const modalContent = modal.querySelector('.tutorial-content');
    const rect = target.getBoundingClientRect();
    const modalRect = modalContent.getBoundingClientRect();
    
    switch (position) {
      case 'top':
        modalContent.style.left = `${rect.left + rect.width / 2 - modalRect.width / 2}px`;
        modalContent.style.top = `${rect.top - modalRect.height - 20}px`;
        break;
      case 'bottom':
        modalContent.style.left = `${rect.left + rect.width / 2 - modalRect.width / 2}px`;
        modalContent.style.top = `${rect.bottom + 20}px`;
        break;
      case 'left':
        modalContent.style.left = `${rect.left - modalRect.width - 20}px`;
        modalContent.style.top = `${rect.top + rect.height / 2 - modalRect.height / 2}px`;
        break;
      case 'right':
        modalContent.style.left = `${rect.right + 20}px`;
        modalContent.style.top = `${rect.top + rect.height / 2 - modalRect.height / 2}px`;
        break;
      default:
        this.positionModalCenter(modal);
    }
    
    // Ensure modal is within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const left = parseInt(modalContent.style.left);
    const top = parseInt(modalContent.style.top);
    
    if (left < 20) {
      modalContent.style.left = '20px';
    } else if (left + modalRect.width > viewportWidth - 20) {
      modalContent.style.left = `${viewportWidth - modalRect.width - 20}px`;
    }
    
    if (top < 20) {
      modalContent.style.top = '20px';
    } else if (top + modalRect.height > viewportHeight - 20) {
      modalContent.style.top = `${viewportHeight - modalRect.height - 20}px`;
    }
  }

  positionModalCenter(modal) {
    const modalContent = modal.querySelector('.tutorial-content');
    
    modalContent.style.left = '50%';
    modalContent.style.top = '50%';
    modalContent.style.transform = 'translate(-50%, -50%)';
  }
}

// Add additional styles for new UI components
const flowEditorImprovementStyles = `
/* Top bar styles */
.editor-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f0f0f0;
  border-bottom: 1px solid #ddd;
}

.save-controls {
  display: flex;
  gap: 10px;
}

.save-btn {
  background: #4caf50;
}

.flow-status-indicator {
  display: flex;
  align-items: center;
  gap: 15px;
}

.flow-name-display {
  font-weight: bold;
  font-size: 16px;
}

.flow-active-toggle {
  display: flex;
  align-items: center;
}

.toggle-label {
  margin-left: 5px;
}

/* Tab styles */
.flow-tabs {
  display: flex;
  background: #f0f0f0;
  border-bottom: 1px solid #ddd;
  padding: 5px 5px 0;
  overflow-x: auto;
}

.flow-tab {
  padding: 8px 15px;
  background: #e0e0e0;
  border: 1px solid #ccc;
  border-bottom: none;
  border-radius: 5px 5px 0 0;
  margin-right: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.flow-tab.active {
  background: #fff;
  border-bottom-color: #fff;
  z-index: 1;
}

.flow-tab.unsaved .tab-name::after {
  content: '*';
  color: #f44336;
}

.flow-tab .tab-status {
  font-size: 12px;
  padding: 2px 5px;
  border-radius: 3px;
}

.flow-tab .tab-status.active {
  background: #e8f5e9;
  color: #4caf50;
}

.flow-tab .tab-status.inactive {
  background: #ffebee;
  color: #f44336;
}

.flow-tab .tab-close {
  font-size: 16px;
  color: #999;
}

.flow-tab .tab-close:hover {
  color: #f44336;
}

.flow-tab.new-tab {
  padding: 5px 10px;
  background: #f5f5f5;
}

/* Node styling improvements */
.flow-node {
  box-shadow: 0 3px 6px rgba(0,0,0,0.16);
  border-radius: 6px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.flow-node:hover {
  box-shadow: 0 5px 10px rgba(0,0,0,0.2);
}

.flow-node.selected {
  box-shadow: 0 0 0 2px #4a90e2;
}

.flow-node.debug-active {
  box-shadow: 0 0 0 2px #4caf50;
}

.trigger-node {
  border-color: #b3e5fc;
}

.action-node {
  border-color: #c8e6c9;
}

.logic-node {
  border-color: #ffe0b2;
}

.trigger-node .node-header {
  background: linear-gradient(to bottom, #e1f5fe, #b3e5fc);
}

.action-node .node-header {
  background: linear-gradient(to bottom, #e8f5e9, #c8e6c9);
}

.logic-node .node-header {
  background: linear-gradient(to bottom, #fff3e0, #ffe0b2);
}

.node-icon {
  margin-right: 5px;
}

.node-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: white;
  text-align: center;
  font-size: 12px;
  line-height: 20px;
}

.trigger-badge {
  background: #03a9f4;
}

.action-badge {
  background: #4caf50;
}

.logic-badge {
  background: #ff9800;
}

.port-handle {
  transition: transform 0.2s, background 0.2s;
}

.port-handle:hover {
  transform: scale(1.2);
}

.port-handle.Message-type {
  background: #f44336;
}

.port-handle.Boolean-type {
  background: #4caf50;
}

.port-handle.Any-type {
  background: #9c27b0;
}

.port-handle.Command-type {
  background: #ff9800;
}

.port-handle.PointsEvent-type {
  background: #e91e63;
}

.port-handle.User-type {
  background: #2196f3;
}

/* Connection styling */
.connection path {
  stroke-width: 3;
  transition: stroke-width 0.2s;
}

.connection:hover path {
  stroke-width: 4;
}

.active-connection path {
  stroke: #4caf50;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { stroke-opacity: 0.6; }
  50% { stroke-opacity: 1; }
  100% { stroke-opacity: 0.6; }
}

/* Zoom controls */
.zoom-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 5px;
  display: flex;
  gap: 5px;
  z-index: 100;
}

.zoom-controls button {
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 16px;
}

#zoom-level {
  min-width: 50px;
  text-align: center;
  line-height: 30px;
}

/* Templates section */
.flow-templates {
  padding: 10px;
  border-top: 1px solid #ddd;
}

.template-item {
  background: white;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 10px;
}

.template-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.template-description {
  font-size: 12px;
  color: #666;
  margin-bottom: 10px;
}

/* Tutorial styles */
.tutorial-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
}

.tutorial-content {
  position: absolute;
  background: white;
  width: 400px;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  z-index: 10000;
}

.tutorial-header {
  padding: 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tutorial-header h3 {
  margin: 0;
}

#close-tutorial-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.tutorial-body {
  padding: 20px;
}

.tutorial-footer {
  padding: 15px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tutorial-btn {
  background: #9c27b0;
}

/* Validation styles */
.validation-errors {
  color: #f44336;
  margin: 0;
  padding-left: 20px;
}

.validation-success {
  color: #4caf50;
}

/* Debug styles */
.flow-debugger {
  margin-top: 20px;
  border-top: 1px solid #ddd;
  padding-top: 10px;
}

.debug-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.history-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 3px;
}

.history-item {
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.history-item:last-child {
  border-bottom: none;
}

.history-item.success {
  border-left: 4px solid #4caf50;
}

.history-item.failure {
  border-left: 4px solid #f44336;
}

.history-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.history-time {
  font-weight: bold;
}

.history-status {
  font-size: 12px;
  padding: 2px 5px;
  border-radius: 3px;
}

.history-item.success .history-status {
  background: #e8f5e9;
  color: #4caf50;
}

.history-item.failure .history-status {
  background: #ffebee;
  color: #f44336;
}

.history-content {
  margin-bottom: 5px;
}

.history-content pre {
  max-height: 100px;
  overflow-y: auto;
  background: #f5f5f5;
  padding: 5px;
  border-radius: 3px;
  font-size: 12px;
}

.debug-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
}

.debug-modal-content {
  background: white;
  width: 80%;
  max-width: 1000px;
  max-height: 80%;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
}

.debug-modal-header {
  padding: 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.debug-modal-body {
  padding: 20px;
  overflow-y: auto;
}

.node-activations-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.node-activation {
  background: #f5f5f5;
  border-radius: 5px;
  padding: 10px;
}

.activation-details {
  display: flex;
  gap: 20px;
}

.activation-inputs, .activation-outputs {
  flex: 1;
}

.activation-inputs h6, .activation-outputs h6 {
  margin-top: 0;
  border-bottom: 1px solid #ddd;
  padding-bottom: 5px;
}

.flow-visualization {
  margin-top: 20px;
  border-top: 1px solid #ddd;
  padding-top: 10px;
}

.node-vis {
  fill: white;
  stroke-width: 2;
}

.trigger-node.node-vis {
  stroke: #03a9f4;
  fill: #e1f5fe;
}

.action-node.node-vis {
  stroke: #4caf50;
  fill: #e8f5e9;
}

.logic-node.node-vis {
  stroke: #ff9800;
  fill: #fff3e0;
}

/* Keyboard shortcut hints */
.key-hint {
  font-size: 12px;
  color: #666;
  margin-left: 5px;
}

#save-flow-btn-top .key-hint::before {
  content: "(Ctrl+S)";
}

#open-flow-editor-btn {
  display: flex;
  align-items: center;
  gap: 5px;
}

#open-flow-editor-btn::before {
  content: "⚡";
  font-size: 16px;
}

/* Responsive design improvements */
@media (max-width: 1200px) {
  .flow-editor {
    flex-direction: column;
    height: auto;
  }
  
  .editor-sidebar {
    width: 100%;
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid #ccc;
    overflow-x: auto;
  }
  
  .editor-properties {
    width: 100%;
    border-left: none;
    border-top: 1px solid #ccc;
  }
  
  .flow-controls, .node-palette, .flow-templates {
    min-width: 250px;
  }
}

@media (max-width: 768px) {
  .editor-sidebar {
    flex-direction: column;
  }
  
  .activation-details {
    flex-direction: column;
  }
}
`;

// Add extended UI style to the document
function addFlowEditorImprovementStyles() {
  const styleEl = document.createElement('style');
  styleEl.textContent = flowEditorImprovementStyles;
  document.head.appendChild(styleEl);
}

// Initialize all improvements
function initFlowEditorImprovements(editor) {
  addFlowEditorImprovementStyles();
  
  // Create tabbed interface
  const tabs = new FlowEditorTabs(editor);
  
  // Add logic node extensions
  const logicExtensions = new LogicNodesExtension(editor.flowSystem);
  
  // Add validation
  const validation = new FlowValidation(editor);
  
  // Add debugging tools
  const debug = new FlowDebugger(editor);
  
  // Improve UI and UX
  improveFlowEditorUI(editor);
  
  // Add templates
  const templates = new FlowTemplates(editor);
  
  // Add tutorial
  const tutorial = new FlowEditorTutorial(editor);
  
  return {
    tabs,
    logicExtensions,
    validation,
    debug,
    templates,
    tutorial
  };
}

// Main integration function that sets up everything
function setupAdvancedFlowEditorSystem(containerElement) {
  // Basic initialization
  const { flowSystem, editor, messageSystem } = setupFlowSystem(containerElement);
  
  // Apply all improvements
  const improvements = initFlowEditorImprovements(editor);
  
  return {
    flowSystem,
    editor,
    messageSystem,
    improvements
  };
}