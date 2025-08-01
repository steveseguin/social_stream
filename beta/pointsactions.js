class PointsActions {
    constructor(options = {}) {
        this.pointsSystem = options.pointsSystem;
        this.dbName = options.dbName || 'pointsActionsDB';
        this.storeName = options.storeName || 'commandSettings';
        this.defaultCommands = {
            '!points': { cost: 0, cooldown: 5000, description: 'Check your points balance' },
            '!leaderboard': { cost: 0, cooldown: 10000, description: 'Show points leaderboard' },
            '!spend': { cost: 0, cooldown: 1000, description: 'Spend points on a reward', isMetaCommand: true },
            '!rewards': { cost: 0, cooldown: 5000, description: 'List available rewards' }
        };
        
        // Custom commands/actions stored here
        this.customCommands = new Map();
        
        // Track command cooldowns
        this.cooldowns = new Map();
        
        // Initialize database
        this.db = null;
        this.initPromise = this.initDatabase();
    }
    
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'commandName' });
                    store.createIndex('active', 'active');
                    
                    // Add default commands
                    const tx = event.target.transaction;
                    const commandStore = tx.objectStore(this.storeName);
                    
                    Object.entries(this.defaultCommands).forEach(([cmd, settings]) => {
                        commandStore.add({
                            commandName: cmd,
                            cost: settings.cost,
                            cooldown: settings.cooldown,
                            description: settings.description,
                            active: true,
                            isDefault: true,
                            isMetaCommand: settings.isMetaCommand || false
                        });
                    });
                }
            };
            
            request.onsuccess = event => {
                this.db = event.target.result;
                this.loadCommands().then(resolve);
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    async ensureDB() {
        if (!this.db) await this.initPromise;
        return this.db;
    }
    
    async loadCommands() {
        const db = await this.ensureDB();
        
        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                this.customCommands.clear();
                request.result.forEach(cmd => {
                    if (cmd.active) {
                        this.customCommands.set(cmd.commandName.toLowerCase(), cmd);
                    }
                });
                resolve();
            };
            
            request.onerror = () => {
                console.error('Error loading commands:', request.error);
                resolve();
            };
        });
    }
    
    async saveCommand(commandData) {
        const db = await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            
            // Make sure the command is lowercase for consistent lookups
            commandData.commandName = commandData.commandName.toLowerCase();
            
            const request = store.put(commandData);
            
            request.onsuccess = () => {
                // Update in-memory map if active
                if (commandData.active) {
                    this.customCommands.set(commandData.commandName, commandData);
                } else {
                    this.customCommands.delete(commandData.commandName);
                }
                resolve(commandData);
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    async deleteCommand(commandName) {
        const db = await this.ensureDB();
        const normalizedName = commandName.toLowerCase();
        
        // Don't allow deleting default commands
        const command = this.customCommands.get(normalizedName);
        if (command && command.isDefault) {
            return { success: false, message: "Cannot delete default commands" };
        }
        
        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(normalizedName);
            
            request.onsuccess = () => {
                this.customCommands.delete(normalizedName);
                resolve({ success: true, message: "Command deleted" });
            };
            
            request.onerror = () => {
                resolve({ success: false, message: "Error deleting command" });
            };
        });
    }
    
    async getCommands() {
        return Array.from(this.customCommands.values());
    }
    
    async getCommandByName(commandName) {
        const normalizedName = commandName.toLowerCase();
        return this.customCommands.get(normalizedName) || null;
    }
    
    isOnCooldown(username, type, commandName) {
        const key = `${username}:${type}:${commandName}`;
        const cooldownUntil = this.cooldowns.get(key);
        
        if (!cooldownUntil) return false;
        
        const now = Date.now();
        return now < cooldownUntil;
    }
    
    setCooldown(username, type, commandName, duration) {
        const key = `${username}:${type}:${commandName}`;
        const now = Date.now();
        this.cooldowns.set(key, now + duration);
        
        // Cleanup expired cooldowns periodically
        setTimeout(() => {
            if (now + duration <= Date.now()) {
                this.cooldowns.delete(key);
            }
        }, duration + 1000);
    }
    
    async processCommand(message) {
        if (!message || !message.chatmessage || !message.chatname || !message.type) {
            return null;
        }
        
        const input = message.chatmessage.trim();
        const parts = input.split(' ');
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        // Check if this is a valid command
        const command = this.customCommands.get(commandName);
        if (!command) {
            return null; // Not a command
        }
        
        // Check for cooldown
        if (this.isOnCooldown(message.chatname, message.type, commandName)) {
            return { 
                success: false,
                message: "This command is on cooldown",
                commandName
            };
        }
        
        // Handle special case for !spend meta-command
        if (commandName === '!spend') {
            return this.handleSpendCommand(message, args);
        }
        
        // Process standard commands
        return this.executeCommand(message, command, args);
    }
    
    async executeCommand(message, command, args = []) {
        const { chatname, type } = message;
        
        // Check if user has enough points
        if (command.cost > 0) {
            const result = await this.pointsSystem.spendPoints(chatname, type, command.cost);
            if (!result.success) {
                return {
                    success: false,
                    message: `@${chatname}, you don't have enough points. ${result.available} available, ${command.cost} needed.`,
                    commandName: command.commandName
                };
            }
        }
        
        // Set cooldown
        this.setCooldown(chatname, type, command.commandName, command.cooldown);
        
        // Process built-in commands
        switch (command.commandName) {
            case '!points':
                return this.handlePointsCommand(message);
            case '!leaderboard':
                return this.handleLeaderboardCommand(message, args);
            case '!rewards':
                return this.handleRewardsCommand(message);
            default:
                // Process custom commands with actions
                return this.handleCustomCommand(message, command, args);
        }
    }
    
    async handleSpendCommand(message, args) {
        // Format: !spend [amount] [reward name]
        if (args.length < 2) {
            return {
                success: false,
                message: `@${message.chatname}, usage: !spend [amount] [reward name]`,
                commandName: '!spend'
            };
        }
        
        const amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount <= 0) {
            return {
                success: false,
                message: `@${message.chatname}, please provide a valid amount to spend`,
                commandName: '!spend'
            };
        }
        
        const rewardName = args.slice(1).join(' ');
        
        // TODO: Implement custom reward handling logic
        // For now, just spend the points
        const result = await this.pointsSystem.spendPoints(message.chatname, message.type, amount);
        if (!result.success) {
            return {
                success: false,
                message: `@${message.chatname}, you don't have enough points. ${result.available} available, ${amount} needed.`,
                commandName: '!spend'
            };
        }
        
        return {
            success: true,
            message: `@${message.chatname} spent ${amount} points on "${rewardName}". ${result.remaining} points remaining.`,
            commandName: '!spend',
            type: 'chat'
        };
    }
    
    async handlePointsCommand(message) {
        const { chatname, type } = message;
        const userData = await this.pointsSystem.getUserPoints(chatname, type);
        const availablePoints = userData.points - userData.pointsSpent;
        
        return {
            success: true,
            message: `@${chatname}, you have ${availablePoints} points (${userData.points} earned, ${userData.pointsSpent} spent). Current streak: ${userData.currentStreak}x`,
            commandName: '!points',
            type: 'chat'
        };
    }
    
    async handleLeaderboardCommand(message, args) {
        const limit = args[0] ? parseInt(args[0], 10) : 5;
        const validLimit = isNaN(limit) ? 5 : Math.min(Math.max(limit, 1), 10);
        
        const leaderboard = await this.pointsSystem.getLeaderboard(validLimit, message.type);
        
        let response = `Top ${validLimit} users by points:\n`;
        leaderboard.forEach((user, index) => {
            response += `${index + 1}. ${user.username}: ${user.points - user.pointsSpent} points (${user.currentStreak}x streak)\n`;
        });
        
        return {
            success: true,
            message: response,
            commandName: '!leaderboard',
            type: 'chat'
        };
    }
    
    async handleRewardsCommand(message) {
        const commands = await this.getCommands();
        const availableRewards = commands.filter(cmd => cmd.cost > 0 && !cmd.isMetaCommand);
        
        if (availableRewards.length === 0) {
            return {
                success: true,
                message: "No rewards are currently available.",
                commandName: '!rewards',
                type: 'chat'
            };
        }
        
        let response = "Available rewards:\n";
        availableRewards.forEach(reward => {
            response += `${reward.commandName} (${reward.cost} points): ${reward.description}\n`;
        });
        
        return {
            success: true,
            message: response,
            commandName: '!rewards',
            type: 'chat'
        };
    }
    
    async handleCustomCommand(message, command, args) {
        // Handle media commands
        if (command.mediaUrl) {
            // Send to the points overlay page
            const mediaPayload = {
                type: 'media',
                username: message.chatname,
                userType: message.type,
                mediaUrl: command.mediaUrl,
                mediaType: command.mediaType || 'image',
                duration: command.mediaDuration || 5000,
                cost: command.cost,
                commandName: command.commandName,
                timestamp: Date.now()
            };
            
            // Add any custom styling or position info
            if (command.mediaStyle) mediaPayload.style = command.mediaStyle;
            if (command.mediaPosition) mediaPayload.position = command.mediaPosition;
            
            // Trigger the overlay action
            sendTargetP2P(mediaPayload, "points");
            
            return {
                success: true,
                message: command.successMessage || `@${message.chatname} used ${command.commandName} for ${command.cost} points!`,
                commandName: command.commandName,
                type: 'chat',
                mediaTriggered: true
            };
        }
        
        // Handle chat message commands
        if (command.responseMessage) {
            let response = command.responseMessage;
            
            // Replace variables in the response
            response = response
                .replace('{username}', message.chatname)
                .replace('{cost}', command.cost)
                .replace('{args}', args.join(' '));
                
            return {
                success: true,
                message: response,
                commandName: command.commandName,
                type: 'chat'
            };
        }
        
        // Handle webhook or other custom actions
        if (command.actionType === 'webhook' && command.webhookUrl) {
            try {
                const webhookData = {
                    username: message.chatname,
                    userType: message.type,
                    command: command.commandName,
                    cost: command.cost,
                    args: args,
                    timestamp: Date.now()
                };
                
                fetch(command.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookData)
                }).catch(err => console.error('Webhook error:', err));
                
                return {
                    success: true,
                    message: command.successMessage || `@${message.chatname} triggered ${command.commandName}!`,
                    commandName: command.commandName,
                    type: 'chat'
                };
            } catch (error) {
                console.error('Error triggering webhook:', error);
            }
        }
        
        // Default success response
        return {
            success: true,
            message: `@${message.chatname} used ${command.commandName} for ${command.cost} points!`,
            commandName: command.commandName,
            type: 'chat'
        };
    }
    
    // Method to create a new custom command
    async createCustomCommand(commandData) {
        // Validate command data
        if (!commandData.commandName || !commandData.commandName.startsWith('!')) {
            return { success: false, message: "Command name must start with !" };
        }
        
        const normalizedName = commandData.commandName.toLowerCase();
        
        // Check if it's trying to override a default command
        const existingCommand = this.customCommands.get(normalizedName);
        if (existingCommand && existingCommand.isDefault) {
            return { success: false, message: "Cannot override default commands" };
        }
        
        // Set default values
        const command = {
            commandName: normalizedName,
            cost: commandData.cost || 0,
            cooldown: commandData.cooldown || 10000,
            description: commandData.description || '',
            active: true,
            isDefault: false,
            isMetaCommand: false,
            ...commandData
        };
        
        // Save the command
        await this.saveCommand(command);
        
        return { success: true, message: "Command created", command };
    }
    
    // Method to update an existing command
    async updateCommand(commandName, updates) {
        const normalizedName = commandName.toLowerCase();
        const existingCommand = this.customCommands.get(normalizedName);
        
        if (!existingCommand) {
            return { success: false, message: "Command not found" };
        }
        
        // Don't allow changing core properties of default commands
        if (existingCommand.isDefault) {
            const protectedProps = ['commandName', 'isDefault', 'isMetaCommand'];
            for (const prop of protectedProps) {
                if (updates[prop] !== undefined && updates[prop] !== existingCommand[prop]) {
                    return { success: false, message: `Cannot modify ${prop} of default commands` };
                }
            }
        }
        
        // Apply updates
        const updatedCommand = { ...existingCommand, ...updates };
        
        // Save the updated command
        await this.saveCommand(updatedCommand);
        
        return { success: true, message: "Command updated", command: updatedCommand };
    }
}

// Create and initialize the points actions system
const pointsActions = new PointsActions({
    pointsSystem: pointsSystem // Reference to existing points system
});

// Initialize point actions after the points system is ready
async function initializePointsActions() {
    try {
        await pointsActions.ensureDB();
        console.log('Points actions system initialized');
        
        // Hook into message processing to handle commands
        const originalAddMessage = messageStoreDB.addMessage;
        messageStoreDB.addMessage = async function(message) {
            const result = await originalAddMessage.call(this, message);
            
            // Process any points commands
            if (message && message.chatmessage && message.chatmessage.startsWith('!')) {
                const commandResult = await pointsActions.processCommand(message);
                
                // Handle command response if needed
                if (commandResult && commandResult.success && commandResult.message && commandResult.type === 'chat') {
                    // Create a response message
                    const responseMessage = {
                        chatname: 'PointsBot',
                        chatmessage: commandResult.message,
                        type: 'bot',
                        timestamp: Date.now()
                    };
                    
                    // Add to message store (which will trigger display)
                    await originalAddMessage.call(this, responseMessage);
                }
            }
            
            return result;
        };
    } catch (error) {
        console.error('Failed to initialize points actions system:', error);
    }
}

// Start initialization after points system is ready
setTimeout(initializePointsActions, 3000);

// Admin API for managing commands
window.pointsActions = {
    // Get all available commands
    getCommands: async () => {
        return await pointsActions.getCommands();
    },
    
    // Create a new command
    createCommand: async (commandData) => {
        return await pointsActions.createCustomCommand(commandData);
    },
    
    // Update an existing command
    updateCommand: async (commandName, updates) => {
        return await pointsActions.updateCommand(commandName, updates);
    },
    
    // Delete a command
    deleteCommand: async (commandName) => {
        return await pointsActions.deleteCommand(commandName);
    },
    
    // Examples of creating different types of commands
    createMediaCommand: async (name, cost, mediaUrl, options = {}) => {
        return await pointsActions.createCustomCommand({
            commandName: name,
            cost: cost,
            cooldown: options.cooldown || 30000,
            description: options.description || `Display media for ${cost} points`,
            mediaUrl: mediaUrl,
            mediaType: options.mediaType || 'image',
            mediaDuration: options.duration || 5000,
            mediaStyle: options.style,
            mediaPosition: options.position,
            successMessage: options.successMessage
        });
    },
    
    createChatCommand: async (name, cost, responseMessage, options = {}) => {
        return await pointsActions.createCustomCommand({
            commandName: name,
            cost: cost,
            cooldown: options.cooldown || 10000,
            description: options.description || `Chat response for ${cost} points`,
            responseMessage: responseMessage
        });
    },
    
    createWebhookCommand: async (name, cost, webhookUrl, options = {}) => {
        return await pointsActions.createCustomCommand({
            commandName: name,
            cost: cost,
            cooldown: options.cooldown || 60000,
            description: options.description || `Trigger webhook for ${cost} points`,
            actionType: 'webhook',
            webhookUrl: webhookUrl,
            successMessage: options.successMessage
        });
    }
};