class PointsSystem {
    constructor(options = {}) {
        this.dbName = options.dbName || 'pointsSystemDB';
        this.storeName = options.storeName || 'userPoints';
        this.pointsPerEngagement = options.pointsPerEngagement || 1;
        this.engagementWindow = options.engagementWindow || 15 * MS_PER_MINUTE;
        this.streakWindow = options.streakWindow || MS_PER_HOUR;
        this.streakBreakTime = options.streakBreakTime || MS_PER_HOUR;
        this.streakMultiplierBase = options.streakMultiplierBase || 0.1;
        this.streakCap = options.streakCap || 10;
        this.messageStore = options.messageStore;
        
        this.db = null;
        this.cache = new Map();
        this.initPromise = this.initDatabase();
        this.migrationComplete = false;
        this.migrationInProgress = false;
    }
    
    // Generate a unique key for a user based on username and type
    getUserKey(username, type) {
        return `${username}:${type || 'default'}`;
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'userKey' });
                    store.createIndex('points', 'points');
                    store.createIndex('lastActive', 'lastActive');
                    store.createIndex('username', 'username');
                    store.createIndex('type', 'type');
                    store.createIndex('username_type', ['username', 'type']);
                }
            };
            
            request.onsuccess = event => {
                this.db = event.target.result;
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async ensureDB() {
        if (!this.db) await this.initPromise;
        return this.db;
    }

    async getUserPoints(username, type = 'default') {
        const userKey = this.getUserKey(username, type);
        
        if (this.cache.has(userKey)) {
            return this.cache.get(userKey);
        }

        const db = await this.ensureDB();
        
        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(userKey);
            
            request.onsuccess = () => {
                const userData = request.result || this.createDefaultUserData(username, type);
                this.cache.set(userKey, userData);
                resolve(userData);
            };
            
            request.onerror = () => {
                const userData = this.createDefaultUserData(username, type);
                this.cache.set(userKey, userData);
                resolve(userData);
            };
        });
    }

    createDefaultUserData(username, type = 'default') {
        const userKey = this.getUserKey(username, type);
        return {
            userKey,
            username,
            type,
            points: 0,
            pointsSpent: 0,
            lastEngagement: 0,
            currentStreak: 0,
            lastActive: 0,
            engagementHistory: []
        };
    }

    async saveUserPoints(userData) {
        const db = await this.ensureDB();
        const userKey = userData.userKey || this.getUserKey(userData.username, userData.type);
        this.cache.set(userKey, userData);
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.put(userData);
            
            request.onsuccess = () => resolve(userData);
            request.onerror = () => reject(request.error);
        });
    }

    async recordEngagement(username, type = 'default', timestamp = Date.now()) {
        if (!username) return null;
        
        const userData = await this.getUserPoints(username, type);
        const now = timestamp;
        
        // Check if this engagement is in a new window from the last one
        const timeSinceLastEngagement = now - userData.lastEngagement;
        
        if (timeSinceLastEngagement >= this.engagementWindow) {
            // Award points for a new engagement
            userData.points += this.pointsPerEngagement;
            
            // Update streak logic
            if (timeSinceLastEngagement <= this.streakBreakTime) {
                // Continue streak
                userData.currentStreak++;
                
                // Calculate streak bonus capped at streakCap
                const streakMultiplier = Math.min(userData.currentStreak * this.streakMultiplierBase, this.streakCap);
                const streakBonus = Math.floor(this.pointsPerEngagement * streakMultiplier);
                
                // Add streak bonus if applicable
                if (streakBonus > 0) {
                    userData.points += streakBonus;
                }
            } else {
                // Break streak if too much time has passed
                userData.currentStreak = 1;
            }
            
            // Keep track of engagement for history
            userData.engagementHistory.push(now);
            
            // Trim history to keep only last 100 entries
            if (userData.engagementHistory.length > 100) {
                userData.engagementHistory = userData.engagementHistory.slice(-100);
            }
        }
        
        userData.lastEngagement = now;
        userData.lastActive = now;
        
        await this.saveUserPoints(userData);
        return userData;
    }

    async addPoints(username, type = 'default', amount) {
        if (amount <= 0) return { success: false, message: "Amount must be positive" };
        
        const userData = await this.getUserPoints(username, type);
        
        userData.points += amount;
        userData.lastActive = Date.now();
        await this.saveUserPoints(userData);
        
        return { 
            success: true, 
            message: "Points added successfully", 
            added: amount,
            points: userData.points,
            available: userData.points - userData.pointsSpent
        };
    }
    
    async spendPoints(username, type = 'default', amount) {
        if (amount <= 0) return { success: false, message: "Amount must be positive" };
        
        const userData = await this.getUserPoints(username, type);
        
        // Calculate available points
        const availablePoints = userData.points - userData.pointsSpent;
        
        if (availablePoints < amount) {
            return { 
                success: false, 
                message: "Not enough points", 
                available: availablePoints,
                requested: amount
            };
        }
        
        userData.pointsSpent += amount;
        await this.saveUserPoints(userData);
        
        return { 
            success: true, 
            message: "Points spent successfully", 
            spent: amount,
            remaining: userData.points - userData.pointsSpent
        };
    }

    async getLeaderboard(limit = 10, type = null) {
        const db = await this.ensureDB();
        
        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const index = store.index('points');
            const users = [];
            
            index.openCursor(null, 'prev').onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && users.length < limit) {
                    const userData = cursor.value;
                    
                    // Filter by type if specified
                    if (type && userData.type !== type) {
                        cursor.continue();
                        return;
                    }
                    
                    users.push({
                        username: userData.username,
                        type: userData.type,
                        points: userData.points,
                        pointsSpent: userData.pointsSpent,
                        available: userData.points - userData.pointsSpent,
                        currentStreak: userData.currentStreak
                    });
                    cursor.continue();
                } else {
                    resolve(users);
                }
            };
        });
    }
    
    // Get users with the same name across different platforms
    async getUsersWithSameName(username) {
        const db = await this.ensureDB();
        
        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const index = store.index('username');
            const range = IDBKeyRange.only(username);
            const results = [];
            
            index.openCursor(range).onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
        });
    }

    async checkIfMigrationNeeded() {
        if (this.migrationComplete || this.migrationInProgress || !this.messageStore) {
            return false;
        }
        
        // Check if we need to migrate (if the store is empty)
        const leaderboard = await this.getLeaderboard(1);
        return leaderboard.length === 0;
    }

    async migrateFromMessageStore() {
        if (this.migrationComplete || this.migrationInProgress || !this.messageStore) {
            return false;
        }
        
        const migrationNeeded = await this.checkIfMigrationNeeded();
        if (!migrationNeeded) {
            this.migrationComplete = true;
            return false;
        }

        this.migrationInProgress = true;
        console.log('Starting points migration from message history...');
        
        try {
            // Get all message history - increased limit to ensure we get more historical data
            const recentMessages = await this.messageStore.getRecentMessages(50000);
            
            // Group messages by username, type and timestamp
            const userEngagements = {};
            
            for (const message of recentMessages) {
                if (!message.chatname) continue;
                
                const username = message.chatname;
                const type = message.type || 'default';
                const timestamp = message.timestamp;
                
                const key = `${username}:${type}`;
                if (!userEngagements[key]) {
                    userEngagements[key] = {
                        username,
                        type,
                        timestamps: []
                    };
                }
                
                userEngagements[key].timestamps.push(timestamp);
            }
            
            // Process each user's engagements
            let processedCount = 0;
            for (const key in userEngagements) {
                const { username, type, timestamps } = userEngagements[key];
                
                // Sort timestamps chronologically
                timestamps.sort((a, b) => a - b);
                
                let lastEngagementTime = 0;
                let currentStreak = 0;
                let totalPoints = 0;
                let engagementHistory = [];
                
                for (const timestamp of timestamps) {
                    const timeSince = timestamp - lastEngagementTime;
                    
                    if (timeSince >= this.engagementWindow || lastEngagementTime === 0) {
                        // New engagement window
                        totalPoints += this.pointsPerEngagement;
                        engagementHistory.push(timestamp);
                        
                        if (timeSince <= this.streakBreakTime || lastEngagementTime === 0) {
                            // Continue or start streak
                            currentStreak++;
                            
                            // Calculate streak bonus
                            const streakMultiplier = Math.min(currentStreak * this.streakMultiplierBase, this.streakCap);
                            const streakBonus = Math.floor(this.pointsPerEngagement * streakMultiplier);
                            
                            if (streakBonus > 0) {
                                totalPoints += streakBonus;
                            }
                        } else {
                            // Break streak
                            currentStreak = 1;
                        }
                        
                        lastEngagementTime = timestamp;
                    }
                }
                
                // Only save if user has points
                if (totalPoints > 0) {
                    const userData = this.createDefaultUserData(username, type);
                    userData.points = totalPoints;
                    userData.lastEngagement = lastEngagementTime;
                    userData.lastActive = lastEngagementTime;
                    userData.currentStreak = currentStreak;
                    
                    // Keep only the last 100 engagements in history
                    userData.engagementHistory = engagementHistory.slice(-100);
                    
                    await this.saveUserPoints(userData);
                    processedCount++;
                    
                    // Log progress intermittently
                    if (processedCount % 50 === 0) {
                        console.log(`Processed ${processedCount} users so far...`);
                    }
                }
            }
            
            console.log(`Points migration complete! Processed ${processedCount} users.`);
            this.migrationComplete = true;
            this.migrationInProgress = false;
            return true;
            
        } catch (error) {
            console.error('Points migration failed:', error);
            this.migrationInProgress = false;
            return false;
        }
    }

    async forceMigration() {
        if (this.migrationInProgress) {
            console.log('Migration already in progress');
            return false;
        }
        
        this.migrationComplete = false;
        return await this.migrateFromMessageStore();
    }

	async processNewMessage(message) {
		if (!message || !message.chatname) return null;
		if (message.chatname === 'PointsBot') return null;
		
		const type = message.type || 'default';
        const username = message.chatname;
        const timestamp = message.timestamp || Date.now();
        
        return await this.recordEngagement(username, type, timestamp);
    }
}

function getActiveSettings() {
	if (typeof settings !== 'undefined' && settings) {
		return settings;
	}
	if (typeof window !== 'undefined' && window.settings) {
		return window.settings;
	}
	return null;
}

function resolveBooleanSetting(value, defaultValue = false) {
	if (value === undefined || value === null) {
		return defaultValue;
	}
	if (typeof value === 'object') {
		if ('setting' in value) {
			return resolveBooleanSetting(value.setting, defaultValue);
		}
		if ('value' in value) {
			return resolveBooleanSetting(value.value, defaultValue);
		}
		if ('checked' in value) {
			return resolveBooleanSetting(value.checked, defaultValue);
		}
	}
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (!normalized) {
			return defaultValue;
		}
		if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) {
			return false;
		}
		if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) {
			return true;
		}
		return defaultValue;
	}
	return !!value;
}

function isPointsSystemEnabled() {
	const activeSettings = getActiveSettings();
	return resolveBooleanSetting(activeSettings?.enablePointsSystem, false);
}

const pointsCommandToggleMap = {
	'!points': 'enablePointsCommand',
	'!leaderboard': 'enableLeaderboardCommand',
	'!rewards': 'enableRewardsCommand',
	'!spend': 'enableRewardsCommand'
};

function isPointsCommandAllowed(commandName) {
	if (!isPointsSystemEnabled()) {
		return false;
	}
	if (!commandName) {
		return false;
	}
	const normalizedName = commandName.toLowerCase();
	const activeSettings = getActiveSettings();
	const toggleKey = pointsCommandToggleMap[normalizedName];
	if (!toggleKey) {
		return true;
	}
	return resolveBooleanSetting(activeSettings?.[toggleKey], true);
}

if (typeof window !== 'undefined') {
	window.isPointsSystemEnabled = isPointsSystemEnabled;
	window.isPointsCommandAllowed = isPointsCommandAllowed;
}

let pointsSystemHookInstalled = false;

// Create the points system instance
const pointsSystem = new PointsSystem({
    pointsPerEngagement: 1,
    engagementWindow: 15 * MS_PER_MINUTE,  // 15 minutes
    streakWindow: MS_PER_HOUR,             // 1 hour window for streaks
    streakBreakTime: MS_PER_HOUR,          // Break streak if no activity for 1 hour
    streakMultiplierBase: 0.1,             // 10% bonus per streak hour, so 10 hours = 2x points
    streakCap: 10,                         // Cap multiplier at 10x (100% bonus)
    messageStore: messageStoreDB           // Link to existing message store
});

async function initializePointsSystem() {
    try {
        await pointsSystem.ensureDB();
        
        // Attempt migration if needed, but don't block initialization
        const migrationNeeded = await pointsSystem.checkIfMigrationNeeded();
        if (migrationNeeded) {
            console.log('Migration needed, starting in background...');
            setTimeout(() => pointsSystem.migrateFromMessageStore(), 3000);
        } else {
            console.log('No migration needed, points system ready');
        }
        
		// Hook into message database to automatically record points
		if (!pointsSystemHookInstalled) {
			const originalAddMessage = messageStoreDB.addMessage;
			messageStoreDB.addMessage = async function(message) {
				const result = await originalAddMessage.call(this, message);
				if (isPointsSystemEnabled() && message?.chatname !== 'PointsBot') {
					await pointsSystem.processNewMessage(message);
				}
				return result;
			};
			pointsSystemHookInstalled = true;
		}
        
        console.log('Points system initialized');
    } catch (error) {
        console.error('Failed to initialize points system:', error);
    }
}

// Initialize points system after message store is ready
setTimeout(initializePointsSystem, 2000);

// Command handler functions
async function handlePointsCommand(username, type = 'default') {
    const userData = await pointsSystem.getUserPoints(username, type);
    const availablePoints = userData.points - userData.pointsSpent;
    
    return {
        username,
        type,
        pointsTotal: userData.points,
        pointsSpent: userData.pointsSpent,
        pointsAvailable: availablePoints,
        currentStreak: userData.currentStreak
    };
}

async function checkMigrationStatus() {
    return {
        migrationComplete: pointsSystem.migrationComplete,
        migrationInProgress: pointsSystem.migrationInProgress
    };
}
// Diagnostic functions for the points system

// Function to check if migration ran successfully
async function checkMigrationStatus() {
    return {
        migrationComplete: pointsSystem.migrationComplete,
        migrationInProgress: pointsSystem.migrationInProgress
    };
}

// Function to search for similar usernames (case insensitive)
async function searchSimilarUsernames(partialName) {
    const db = await pointsSystem.ensureDB();
    
    return new Promise((resolve) => {
        const tx = db.transaction(pointsSystem.storeName, 'readonly');
        const store = tx.objectStore(pointsSystem.storeName);
        const users = [];
        
        // We need to scan all records since we're doing a partial/case-insensitive match
        store.openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                const userData = cursor.value;
                // Case insensitive search
                if (userData.username.toLowerCase().includes(partialName.toLowerCase())) {
                    users.push({
                        userKey: userData.userKey,
                        username: userData.username,
                        type: userData.type,
                        points: userData.points,
                        pointsSpent: userData.pointsSpent,
                        lastActive: new Date(userData.lastActive),
                        currentStreak: userData.currentStreak
                    });
                }
                cursor.continue();
            } else {
                resolve(users);
            }
        };
    });
}

// Function to check for recent messages from a specific user
async function checkRecentMessagesForUser(username, type = null, limit = 10) {
    if (!messageStoreDB) {
        return { error: "Message store not available" };
    }
    
    try {
        // First check if we can find messages for this exact user
        let messages;
        if (type) {
            messages = await messageStoreDB.getUserMessages(username, type, 0, limit);
        } else {
            // Try to get any messages from this username regardless of type
            messages = await messageStoreDB.getRecentMessages(500);
            messages = messages.filter(msg => 
                msg.chatname && msg.chatname.toLowerCase() === username.toLowerCase()
            ).slice(0, limit);
        }
        
        return {
            messagesFound: messages.length,
            sampleMessages: messages.map(msg => ({
                id: msg.id,
                chatname: msg.chatname,
                type: msg.type,
                timestamp: new Date(msg.timestamp),
                message: msg.chatmessage ? msg.chatmessage.substring(0, 30) + '...' : '[no message]'
            }))
        };
    } catch (error) {
        return { error: error.toString() };
    }
}

async function searchSimilarUsernames(partialName) {
    const db = await pointsSystem.ensureDB();
    
    return new Promise((resolve) => {
        const tx = db.transaction(pointsSystem.storeName, 'readonly');
        const store = tx.objectStore(pointsSystem.storeName);
        const users = [];
        
        // We need to scan all records since we're doing a partial/case-insensitive match
        store.openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                const userData = cursor.value;
                // Case insensitive search
                if (userData.username.toLowerCase().includes(partialName.toLowerCase())) {
                    users.push({
                        userKey: userData.userKey,
                        username: userData.username,
                        type: userData.type,
                        points: userData.points,
                        pointsSpent: userData.pointsSpent,
                        lastActive: new Date(userData.lastActive),
                        currentStreak: userData.currentStreak
                    });
                }
                cursor.continue();
            } else {
                resolve(users);
            }
        };
    });
}

async function handleSearchUsersByName(username) {
    return await pointsSystem.getUsersWithSameName(username);
}

async function handleSpendPointsCommand(username, amount, type = 'default') {
    return await pointsSystem.spendPoints(username, type, amount);
}

async function handleLeaderboardCommand(limit = 10, type = null) {
    return await pointsSystem.getLeaderboard(limit, type);
}

async function handleForceMigration() {
    return await pointsSystem.forceMigration();
}

async function listAllUsers(limit = 100) {
    const db = await pointsSystem.ensureDB();
    
    return new Promise((resolve) => {
        const tx = db.transaction(pointsSystem.storeName, 'readonly');
        const store = tx.objectStore(pointsSystem.storeName);
        const users = [];
        
        store.openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (cursor && users.length < limit) {
                const userData = cursor.value;
                users.push({
                    userKey: userData.userKey,
                    username: userData.username, 
                    type: userData.type,
                    points: userData.points,
                    lastActive: new Date(userData.lastActive)
                });
                cursor.continue();
            } else {
                resolve(users);
            }
        };
    });
}

// Function to manually award points to a user
async function manuallyAwardPoints(username, type, points) {
    const userData = await pointsSystem.getUserPoints(username, type);
    userData.points += points;
    userData.lastActive = Date.now();
    await pointsSystem.saveUserPoints(userData);
    return userData;
}

// Function to force a re-process of historical messages for a specific user
async function reprocessUserHistory(username, type = null) {
    if (!messageStoreDB) {
        return { error: "Message store not available" };
    }
    
    try {
        // Get messages for this user
        let messages = await messageStoreDB.getRecentMessages(5000);
        
        // Filter for the specific user
        messages = messages.filter(msg => {
            if (!msg.chatname) return false;
            
            const nameMatch = msg.chatname.toLowerCase() === username.toLowerCase();
            const typeMatch = type ? msg.type === type : true;
            
            return nameMatch && typeMatch;
        });
        
        console.log(`Found ${messages.length} messages for ${username} ${type ? `(${type})` : ''}`);
        
        // Sort by timestamp ascending
        messages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Process each message
        let processed = 0;
        for (const message of messages) {
            await pointsSystem.processNewMessage(message);
            processed++;
        }
        
        return {
            processed,
            messagesFound: messages.length
        };
    } catch (error) {
        return { error: error.toString() };
    }
}

// Add diagnostic functions to window for console use
window.pointsDiagnostic = {
    checkMigrationStatus,
    searchSimilarUsernames,
    checkRecentMessagesForUser,
    listAllUsers,
    manuallyAwardPoints,
    reprocessUserHistory
};
