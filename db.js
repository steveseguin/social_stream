const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CACHE_SIZE = 100;
const CACHE_DURATION = 5 * 60 * 1000;
const SUMMARY_AGE = 30 * 60 * 1000;
const MAX_TOKENS = 8000;
const MAX_SUMMARY_MESSAGES = CACHE_SIZE;


class MessageStoreDB {
    constructor(options = {}) {
        this.dbName = options.dbName || 'chatMessagesDB_v3';
        this.storeName = options.storeName || 'messages';
        this.cacheSize = options.cacheSize || 100;
        this.cacheDuration = options.cacheDuration || 5 * 60 * 1000;
        this.daysToKeep = options.daysToKeep || 30;
        
        this.db = null;
        this.cache = {
            recent: [],
            userMessages: new Map(),
            lastUpdate: 0
        };
        
        this.initPromise = this.initDatabase();
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 3);
            
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('user_timestamp', ['chatname', 'timestamp']);
                    store.createIndex('user_type_timestamp', ['chatname', 'type', 'timestamp']);
                }
            };
            
            request.onsuccess = event => {
                this.db = event.target.result;
                this.scheduleCleanup();
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async ensureDB() {
        if (!this.db) await this.initPromise;
        return this.db;
    }

    async addMessage(message) {
        const db = await this.ensureDB();
        const now = Date.now();
		
		delete message.id; // this will conflict with the id in the database if we include it.
        
        const messageData = {
            ...message,
            timestamp: now,
            expiresAt: now + (this.daysToKeep * MS_PER_DAY)
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            
            const request = store.add(messageData);
            
            request.onsuccess = () => {
                this.updateCache(messageData);
                resolve(messageData);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    updateCache(message) {
        const { recent, userMessages } = this.cache;
        
        recent.unshift(message);
        if (recent.length > this.cacheSize) recent.pop();
        
        if (!userMessages.has(message.chatname)) {
            userMessages.set(message.chatname, []);
        }
        
        const userCache = userMessages.get(message.chatname);
        userCache.unshift(message);
        if (userCache.length > this.cacheSize) userCache.pop();
        
        this.cache.lastUpdate = Date.now();
    }

    async getRecentMessages(limit = 10) {
        const now = Date.now();
        if (this.cache.recent.length >= limit && 
            (now - this.cache.lastUpdate) < this.cacheDuration) {
            return this.cache.recent.slice(0, limit);
        }

        const db = await this.ensureDB();
        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const index = tx.objectStore(this.storeName).index('timestamp');
            const messages = [];
            
            index.openCursor(IDBKeyRange.upperBound(now), 'prev').onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && messages.length < limit) {
                    const msg = cursor.value;
                    if (!msg.expiresAt || msg.expiresAt > now) {
                        messages.push(msg);
                    }
                    cursor.continue();
                } else {
                    this.cache.recent = messages;
                    this.cache.lastUpdate = now;
                    resolve(messages);
                }
            };
        });
    }

    async getUserMessages(chatname, type, page = 0, pageSize = 100) {
        const db = await this.ensureDB();
        const now = Date.now();
        
        if (page === 0 && this.cache.userMessages.has(chatname)) {
            const cached = this.cache.userMessages.get(chatname);
            if (cached.length >= pageSize && (now - this.cache.lastUpdate) < this.cacheDuration) {
                return cached.slice(0, pageSize);
            }
        }
		
		if (settings?.disableDB) return [];

        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const index = tx.objectStore(this.storeName).index(
                type ? 'user_type_timestamp' : 'user_timestamp'
            );
            const messages = [];
            const skip = page * pageSize;
            let count = 0;
            
            const range = type ?
                IDBKeyRange.bound([chatname, type, 0], [chatname, type, now]) :
                IDBKeyRange.bound([chatname, 0], [chatname, now]);
                
            index.openCursor(range, 'prev').onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    const msg = cursor.value;
                    if (!msg.expiresAt || msg.expiresAt > now) {
                        if (count >= skip && messages.length < pageSize) {
                            messages.push(msg);
                        }
                        count++;
                    }
                    cursor.continue();
                } else {
                    if (page === 0) {
                        this.cache.userMessages.set(chatname, messages);
                        this.cache.lastUpdate = now;
                    }
                    resolve(messages);
                }
            };
        });
    }

    scheduleCleanup() {
        const cleanup = async () => {
            const db = await this.ensureDB();
            const now = Date.now();
            
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const index = store.index('timestamp');
            
            index.openCursor().onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    const message = cursor.value;
                    if (message.expiresAt && message.expiresAt < now) {
                        store.delete(cursor.primaryKey);
                    }
                    cursor.continue();
                }
            };
        };

        cleanup();
        setInterval(cleanup, MS_PER_DAY);
    }

    async clearCache() {
        this.cache.recent = [];
        this.cache.userMessages.clear();
        this.cache.lastUpdate = 0;
    }
}
// Compatibility function for getLastMessagesDB
async function getLastMessagesDB(limit = 10) {
    return await messageStoreDB.getRecentMessages(limit);
}

// Compatibility function for addMessageDB
async function addMessageDB(message) {
    if (settings?.disableDB) return;
    await messageStoreDB.addMessage(message);
}

// Compatibility function for getMessagesDB
async function getMessagesDB(chatname, type, page = 0, pageSize = 100, callback) {
    if (settings?.disableDB) {
        if (callback) callback([]);
        return [];
    }

    const messages = await messageStoreDB.getUserMessages(chatname, type, page, pageSize);
    
    if (callback) {
        callback(messages);
    }
    
    return messages;
}

// Compatibility function for getRecentMessages
async function getRecentMessages(chatname, limit, timeWindow) {
    const messages = await messageStoreDB.getUserMessages(chatname, null, 0, limit);
    
    if (timeWindow) {
        const cutoffTime = Date.now() - timeWindow;
        return messages.filter(msg => msg.timestamp >= cutoffTime);
    }
    
    return messages;
}

const ChatContextManager = {
    needsSummary() {
        return !this.summary || this.messageCount >= 40 || (Date.now() - this.summaryTime) > SUMMARY_AGE;
    },

    async getContext(data) {
        const [recentMessages, userHistory] = await Promise.all([
            messageStoreDB.getRecentMessages(10),
            data.chatname && data.type ? messageStoreDB.getUserMessages(data.chatname, data.type, 0, 10) : []
        ]);

        let summary = null;
        if (settings?.llmsummary && this.needsSummary()) {
            summary = await this.getSummary();
        }

        const processedContext = {
            recentMessages: this.messageToLLMString(recentMessages),
            userHistory: this.messageToLLMString(userHistory, true),
            chatSummary: summary
        };

        return this.trimToTokenLimit(processedContext);
    },

    trimToTokenLimit(context) {
        const estimateTokens = text => {
            if (!text) return 0;
            return (typeof text === 'string' ? text : JSON.stringify(text))
                .split(/\s+/).length * 1.5;
        };

        const partSizes = {
            chatSummary: estimateTokens(context.chatSummary),
            userHistory: estimateTokens(context.userHistory),
            recentMessages: estimateTokens(context.recentMessages)
        };

        let totalTokens = Object.values(partSizes).reduce((a, b) => a + b, 0);
        
        if (totalTokens <= MAX_TOKENS) return context;

        // Trim recentMessages first, then userHistory, then summary
        const trimOrder = ['recentMessages', 'userHistory', 'chatSummary'];
        
        for (const part of trimOrder) {
            if (totalTokens <= MAX_TOKENS) break;
            
            if (context[part]) {
                const lines = context[part].split('\n');
                while (lines.length && totalTokens > MAX_TOKENS) {
                    const line = lines.shift();
                    totalTokens -= estimateTokens(line);
                }
                context[part] = lines.join('\n');
                if (!lines.length) context[part] = null;
            }
        }

        return context;
    },

    messageToLLMString(messages, shorten=false) {
        if (!Array.isArray(messages) || !messages.length) return '';
        
        return messages
            .map((msg, index) => {
                if (!msg || msg.bot || (msg.event && !msg.hasDonation)) return '';
                
                const timeAgo = this.getTimeAgo(msg.timestamp);
                const donation = msg.hasDonation ? ` (Donated ${msg.hasDonation})` : '';
                const message = this.sanitizeMessage(msg, index > 20);
                
                if (!message && !donation) return '';
                
				if (shorten){
					 return `\n${message}${donation} - ${timeAgo}`;
				}
				return `\n${msg.chatname} of ${msg.type}${donation} said ${timeAgo}: ${message}`;
               
            })
            .filter(Boolean)
            .join('');
    },

    sanitizeMessage(msg, heavy = false) {
        const message = msg.textonly ? (msg.chatmessage || msg.message) : this.stripHTML((msg.chatmessage || msg.message), heavy);
        return message ? message.trim() : '';
    },

    stripHTML(html, heavy = false) {
        if (!html) return '';
        
        return html
            .replace(/<svg[^>]*?>[\s\S]*?<\/svg>/gi, heavy ? ' ' : '[svg]')
            .replace(/<img[^>]+>/g, heavy ? ' ' : '[img]')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim();
    },
    
    getTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
        if (hours > 0) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;
        if (minutes > 0) return `${minutes} ${minutes === 1 ? 'min' : 'mins'} ago`;
        return 'moments ago';
    },

    updateSummary(summary) {
        this.summary = summary;
        this.summaryTime = Date.now();
        this.messageCount = 0;
    },
	
	async getSummary() {
	  const recentMessages = await messageStoreDB.getRecentMessages(MAX_SUMMARY_MESSAGES); 
	  let chatSummary = await this.generateSummary(recentMessages);
	  if (chatSummary.length>120){
		chatSummary = chatSummary.split(":").pop();
	  }
	  if (chatSummary.length>120){
		chatSummary = chatSummary.split("\n").pop();
	  }
	  if (chatSummary.length>120){
		chatSummary = chatSummary.split("* ").pop();
	  }
	  if (chatSummary){
		this.updateSummary(chatSummary);
	  }
	  return chatSummary;
	},

    async generateSummary(messages) {
		let textString = this.messageToLLMString(messages.slice(-MAX_SUMMARY_MESSAGES));
        let prompt = `The following is a log of a live social media platform interactions.\n ${textString.slice(0, Math.max(40,MAX_TOKENS-40))} ⇒ → [📝 summarize discussion in the chat] → Fewer words used the better.`;
        
        try {
            return await callOllamaAPI(prompt);
        } catch (error) {
            console.warn("Summary generation error:", error);
            return null;
        }
    }
};

// Initialize the store
/* const messageStoreDB = new MessageStoreDB({
    dbName: 'chatMessagesDB_v3',
    storeName: 'messages',
    cacheSize: 100, // should be no smaller than the default paging size (100).
    cacheDuration: 5 * 60 * 1000, // 5 minutes
    daysToKeep: 30
}); */

/// migration addon

class MessageStoreMigration {
    constructor(messageStore, options = {}) {
        this.messageStore = messageStore;
        this.oldDbName = 'chatMessagesDB';
        this.oldStoreName = 'messages';
        this.maxMessages = options.maxMessages || 10000;
        this.cutoffDate = options.cutoffDate || new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
        this.migrationAttempted = false;
    }

    async checkAndMigrate() {
        if (this.migrationAttempted) return;
        
        try {
            const oldVersion = await this.detectDatabaseVersion();
            if (!oldVersion) {
                console.log('No old database found');
                return;
            }

            const hasValidStore = await this.verifyObjectStore(oldVersion);
            if (!hasValidStore) {
                console.log('Old database found but store is invalid, cleaning up...');
                await this.deleteOldDatabase();
                return;
            }
            
            console.log(`Found valid old database (version ${oldVersion}), starting migration...`);
            const migratedCount = await this.migrateRecentData(oldVersion);
            
            if (migratedCount > 0) {
                console.log(`Successfully migrated ${migratedCount} messages`);
                await this.deleteOldDatabase();
            } else {
                console.log('No messages to migrate');
                await this.deleteOldDatabase();
            }
            
        } catch (error) {
            console.error('Migration failed:', error);
            await this.cleanupFailedMigration();
        } finally {
            this.migrationAttempted = true;
        }
    }

	async verifyObjectStore(version) {
		return new Promise((resolve) => {
			console.log(`Attempting to verify database version ${version}`);
			const request = indexedDB.open(this.oldDbName, version);
			
			request.onerror = () => {
				console.error('Error during store verification:', request.error);
				resolve(false);
			};
			
			request.onupgradeneeded = (event) => {
				console.log('Database upgrade needed during verification');
				event.target.transaction.abort();
				resolve(false);
			};
			
			request.onsuccess = event => {
				const db = event.target.result;
				console.log('Successfully opened old database');
				
				if (!db.objectStoreNames.contains(this.oldStoreName)) {
					console.log('Store name not found:', this.oldStoreName);
					db.close();
					resolve(false);
					return;
				}

				try {
					const tx = db.transaction(this.oldStoreName, 'readonly');
					const store = tx.objectStore(this.oldStoreName);
					
					console.log('Store indexes:', Array.from(store.indexNames));
					
					const countRequest = store.count();
					
					countRequest.onsuccess = () => {
						const count = countRequest.result;
						console.log('Store record count:', count);
						db.close();
						resolve(true);  // Changed to always resolve true if we can access the store
					};
					
					countRequest.onerror = (error) => {
						console.error('Error counting records:', error);
						db.close();
						resolve(false);
					};
					
				} catch (e) {
					console.error('Error during store transaction:', e);
					db.close();
					resolve(false);
				}
			};
		});
	}

	async detectDatabaseVersion() {
		return new Promise((resolve) => {
			console.log('Detecting database version...');
			let wasUpgradeNeeded = false;
			const request = indexedDB.open(this.oldDbName);
			
			request.onerror = () => {
				// If error is from our intentional abort, treat as "no database"
				if (wasUpgradeNeeded) {
					resolve(null);
					return;
				}
				console.error('Error detecting version:', request.error);
				resolve(null);
			};
			
			request.onsuccess = event => {
				const db = event.target.result;
				const version = db.version;
				console.log('Detected database version:', version);
				db.close();
				resolve(version);
			};
			
			request.onupgradeneeded = event => {
				console.log('Database upgrade needed during version detection');
				wasUpgradeNeeded = true;
				const db = event.target.result;
				db.close();
				resolve(null);
			};
		});
	}

    async migrateRecentData(oldVersion) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.oldDbName, oldVersion);
            
            request.onerror = () => {
                console.error('Error opening old database for migration:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = async event => {
                const oldDb = event.target.result;
                let migratedCount = 0;
                
                try {
                    const messages = await this.getRecentMessages(oldDb, oldVersion);
                    console.log(`Found ${messages.length} messages to migrate`);
                    
                    if (messages.length === 0) {
                        oldDb.close();
                        resolve(0);
                        return;
                    }
                    
                    const batchSize = 50;
                    for (let i = 0; i < messages.length; i += batchSize) {
                        const batch = messages.slice(i, i + batchSize);
                        const batchResults = await this.migrateBatch(batch);
                        migratedCount += batchResults.filter(Boolean).length;
                    }
                    
                    oldDb.close();
                    resolve(migratedCount);
                } catch (error) {
                    console.error('Error during migration:', error);
                    oldDb.close();
                    reject(error);
                }
            };
        });
    }

    async migrateBatch(messages) {
        return Promise.all(messages.map(async (message) => {
            try {
                await this.messageStore.addMessage(message);
                return true;
            } catch (error) {
                console.error("Failed to migrate message:", message, error);
                return false;
            }
        }));
    }
	
	async getRecentMessages(db, oldVersion) {
		return new Promise((resolve, reject) => {
			console.log(`Getting messages from version ${oldVersion} database`);
			const tx = db.transaction(this.oldStoreName, 'readonly');
			const store = tx.objectStore(this.oldStoreName);
			const messages = [];
			
			let cursorRequest;
			
			try {
				// Try to get cursor from store directly first
				cursorRequest = store.openCursor(null, 'prev');
				
				cursorRequest.onsuccess = event => {
					const cursor = event.target.result;
					if (cursor && messages.length < this.maxMessages) {
						console.log('Processing message:', cursor.value);
						
						try {
							const message = this.normalizeMessage(cursor.value, oldVersion);
							const messageDate = new Date(message.timestamp);
							
							if (messageDate >= this.cutoffDate) {
								messages.push(message);
							}
							
							cursor.continue();
						} catch (e) {
							console.error('Error processing message:', e);
							cursor.continue();
						}
					} else {
						console.log(`Retrieved ${messages.length} messages`);
						resolve(messages);
					}
				};
				
				cursorRequest.onerror = (error) => {
					console.error('Error during cursor operation:', error);
					resolve(messages); // Resolve with whatever we got
				};
				
			} catch (error) {
				console.error('Error setting up cursor:', error);
				resolve(messages);
			}
			
			tx.onerror = () => {
				console.error('Transaction error:', tx.error);
				resolve(messages);
			};
		});
	}
	
	async cleanupFailedMigration() {
        try {
            // Attempt to delete the old database
            await this.deleteOldDatabase();
            console.log('Cleaned up old database after failed migration');
        } catch (error) {
            console.error('Failed to cleanup after migration:', error);
        }
    }
	

    normalizeMessage(oldMessage, oldVersion) {
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        let timestamp;
        if (oldMessage.timestamp instanceof Date) {
            timestamp = oldMessage.timestamp.getTime();
        } else if (typeof oldMessage.timestamp === 'string') {
            timestamp = new Date(oldMessage.timestamp).getTime();
        } else {
            timestamp = now;
        }

        return {
            chatname: oldMessage.chatname || '',
            chatmessage: oldMessage.chatmessage || oldMessage.message || '',
            chatimg: oldMessage.chatimg || '',
            hasDonation: oldMessage.hasDonation || '',
            membership: oldMessage.membership || oldMessage.hasMembership || '',
            type: oldMessage.type || 'user',
            timestamp: timestamp,
            expiresAt: now + thirtyDays,
            backgroundColor: oldMessage.backgroundColor || '',
            chatbadges: oldMessage.chatbadges || '',
            event: oldMessage.event || '',
            nameColor: oldMessage.nameColor || '',
            textColor: oldMessage.textColor || ''
        };
    }
	
	async deleteOldDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.oldDbName);
            request.onsuccess = () => {
                console.log('Successfully deleted old database');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
}
				
class MessageStoreWithMigration extends MessageStoreDB {
    constructor(options = {}) {
        super(options);
        this.migration = new MessageStoreMigration(this);
    }

    async init() {
        await this.initPromise;
        await this.migration.checkAndMigrate();
        return this;
    }
}

// Initialize the store
const messageStoreDB = new MessageStoreWithMigration({
    dbName: 'chatMessagesDB_v3', // Use a new name to avoid conflicts
    storeName: 'messages',
    cacheSize: CACHE_SIZE,
    cacheDuration: CACHE_DURATION,
    daysToKeep: 30
});

async function initializeMessageStore() {
    try {
        await messageStoreDB.init();
        console.log('Message store initialized and migration completed if needed');
    } catch (error) {
        console.error('Failed to initialize message store:', error);
    }
}

initializeMessageStore();
