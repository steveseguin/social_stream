// db.js
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const CACHE_SIZE = 100;
const CACHE_DURATION = 5 * 60 * 1000;

function isDatabaseSettingEnabled(value) {
    return value === true || !!(value && typeof value === 'object' && value.setting === true);
}

function getInMemoryUnlimitedDBSetting() {
    const globalSettings = typeof settings !== 'undefined' ? settings : null;
    const windowSettings = typeof window !== 'undefined' ? window.settings : null;
    const candidates = [globalSettings, windowSettings];
    let known = false;

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') continue;
        if (!Object.prototype.hasOwnProperty.call(candidate, 'unlimitedDB')) continue;
        known = true;
        if (isDatabaseSettingEnabled(candidate.unlimitedDB)) return { known: true, enabled: true };
    }

    return { known, enabled: false };
}

function isUnlimitedDBEnabled() {
    return getInMemoryUnlimitedDBSetting().enabled;
}

function getStoredMessageExpiration(message, daysToKeep = 30) {
    if (!message) return null;

    if (message.expiresAt !== undefined && message.expiresAt !== null && message.expiresAt !== '') {
        const explicitExpiration = Number(message.expiresAt);
        if (Number.isFinite(explicitExpiration)) return explicitExpiration;
    }

    const timestamp = Number(message.timestamp);
    if (!Number.isFinite(timestamp)) return null;
    return timestamp + (daysToKeep * MS_PER_DAY);
}

function isStoredMessageExpired(message, now, daysToKeep = 30) {
    if (isUnlimitedDBEnabled()) return false;
    const expiration = getStoredMessageExpiration(message, daysToKeep);
    return expiration !== null && expiration <= now;
}

function isUnlimitedDBEnabledInStorage(timeoutMs = 3000) {
    const memorySetting = getInMemoryUnlimitedDBSetting();
    if (memorySetting.enabled) return Promise.resolve(true);
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.storage.local.get) {
        if (memorySetting.known) return Promise.resolve(memorySetting.enabled);
        return Promise.reject(new Error('Unlimited DB setting is unavailable'));
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        let timeout = null;
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            if (timeout !== null) clearTimeout(timeout);
            if (error) reject(error);
            else resolve(value);
        };
        timeout = setTimeout(() => {
            finish(new Error('Timed out reading the Unlimited DB setting'));
        }, timeoutMs);

        try {
            chrome.storage.local.get(['settings'], result => {
                const runtimeError = chrome.runtime && chrome.runtime.lastError;
                if (runtimeError) {
                    finish(new Error(runtimeError.message || 'Failed to read the Unlimited DB setting'));
                    return;
                }
                if (!result || typeof result !== 'object') {
                    finish(new Error('Unlimited DB setting returned no storage result'));
                    return;
                }
                const storedSettings = result.settings;
                finish(null, getInMemoryUnlimitedDBSetting().enabled ||
                    isDatabaseSettingEnabled(storedSettings && storedSettings.unlimitedDB));
            });
        } catch (error) {
            finish(error);
        }
    });
}

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
            lastUpdate: 0,
            retentionMode: null
        };
		
		this.existenceCache = {
            entries: new Map(),
            maxSize: options.existenceCacheSize || 100,
            ttl: options.existenceCacheTTL || 30 * 60 * 1000  // 30 minutes default
        };
        
        this.initPromise = this.initDatabase();
    }

    setExistenceCache(cacheKey, { exists, lastActivity = null, cachedAt = Date.now() }) {
        this.existenceCache.entries.set(cacheKey, {
            exists,
            lastActivity,
            timestamp: cachedAt
        });

        if (this.existenceCache.entries.size > this.existenceCache.maxSize) {
            const oldestKey = this.existenceCache.entries.keys().next().value;
            if (oldestKey) {
                this.existenceCache.entries.delete(oldestKey);
            }
        }
    }

    getExistenceCacheKeys(userIdentifier, type, fallbackChatname = null) {
        const keys = [];
        [userIdentifier, fallbackChatname].forEach(value => {
            if (value === undefined || value === null || !type) return;
            const normalized = String(value).trim();
            if (!normalized) return;
            const key = `${normalized}:${type}`;
            if (!keys.includes(key)) {
                keys.push(key);
            }
        });
        return keys;
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 4);
            
            request.onupgradeneeded = event => {
                const db = event.target.result;
                let store;
                
                if (!db.objectStoreNames.contains(this.storeName)) {
                    store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('user_timestamp', ['chatname', 'timestamp']);
                    store.createIndex('user_type_timestamp', ['chatname', 'type', 'timestamp']);
                } else {
                    // Get existing store for upgrades
                    const transaction = event.currentTarget.transaction;
                    store = transaction.objectStore(this.storeName);
                }
                
                // Add userid indexes for version 4
                if (event.oldVersion < 4 && store) {
                    if (!store.indexNames.contains('user_id_timestamp')) {
                        store.createIndex('user_id_timestamp', ['userid', 'timestamp']);
                    }
                    if (!store.indexNames.contains('user_id_type_timestamp')) {
                        store.createIndex('user_id_type_timestamp', ['userid', 'type', 'timestamp']);
                    }
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

    isMessageExpired(message, now = Date.now()) {
        return isStoredMessageExpired(message, now, this.daysToKeep);
    }

    syncRetentionCacheMode() {
        const unlimited = isUnlimitedDBEnabled();
        if (this.cache.retentionMode !== null && this.cache.retentionMode !== unlimited) {
            this.cache.recent = [];
            this.cache.userMessages.clear();
            this.cache.lastUpdate = 0;
            this.clearExistenceCache();
        }
        this.cache.retentionMode = unlimited;
    }

	async addMessage(message) {
        return this.addMessageRecord(message, false);
    }

    async addMigratedMessage(message, migrationSource = null) {
        const ids = await this.addMigratedMessages([message], migrationSource);
        return ids[0];
    }

    createMessageRecord(message, preserveTimestamp, additionalFields = null) {
        const now = Date.now();
        const cloned = {...message};

        if (cloned.id){
            cloned.mid = cloned.id;
            delete cloned.id;   // Remove id as it will be auto-generated
        }
        
        const sourceTimestamp = Number(cloned.timestamp);
        const timestamp = preserveTimestamp && Number.isFinite(sourceTimestamp) ? sourceTimestamp : now;
        const messageData = {
            ...cloned,
            timestamp,
            expiresAt: timestamp + (this.daysToKeep * MS_PER_DAY)
        };

        if (additionalFields) Object.assign(messageData, additionalFields);
        return messageData;
    }

    async addMigratedMessages(messages, migrationSource = null) {
        if (!Array.isArray(messages) || messages.length === 0) return [];
        const db = await this.ensureDB();
        const marker = migrationSource ? { __ssnMigrationSource: migrationSource } : null;
        const records = messages.map(message => this.createMessageRecord(message, true, marker));

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const ids = [];

            records.forEach(record => {
                const request = store.add(record);
                request.onsuccess = () => ids.push(request.result);
            });

            tx.oncomplete = () => resolve(ids);
            tx.onerror = () => reject(tx.error || new Error('Failed to migrate message batch'));
            tx.onabort = () => reject(tx.error || new Error('Message migration batch was aborted'));
        });
    }

	async addMessageRecord(message, preserveTimestamp) {
        const db = await this.ensureDB();
        this.syncRetentionCacheMode();
        const messageData = this.createMessageRecord(message, preserveTimestamp);

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            
            const request = store.add(messageData);
            
            tx.oncomplete = () => {
                // Get the auto-generated ID from the request
                messageData.id = request.result;
                message.idx = request.result;
                this.updateCache(messageData);
                
                // Cache that this user now exists
                const cacheKeys = this.getExistenceCacheKeys(messageData.userid || messageData.chatname, messageData.type, messageData.chatname);
                cacheKeys.forEach(cacheKey => {
                    this.setExistenceCache(cacheKey, {
                        exists: true,
                        lastActivity: messageData.timestamp
                    });
                });

                resolve(request.result);
            };
            
            request.onerror = () => reject(request.error);
            tx.onerror = () => reject(tx.error || new Error('Failed to save chat message'));
            tx.onabort = () => reject(tx.error || new Error('Chat message save was aborted'));
        });
    }

	async updateMessage(idx, updatedResponse) {
		if (!idx || !updatedResponse) return null;

		const db = await this.ensureDB();
		this.syncRetentionCacheMode();

		return new Promise((resolve, reject) => {
			const tx = db.transaction(this.storeName, 'readwrite');
			const store = tx.objectStore(this.storeName);
			const getRequest = store.get(idx);
			let merged = null;

			getRequest.onsuccess = () => {
				const existing = getRequest.result;
				if (!existing) {
					return;
				}

				const timestamp = Number(existing.timestamp);
				const expiration = getStoredMessageExpiration(existing, this.daysToKeep);
				merged = {...existing, ...updatedResponse, id: idx};
				if (Number.isFinite(timestamp)) merged.timestamp = timestamp;
				if (expiration !== null) merged.expiresAt = expiration;

				const putRequest = store.put(merged);
				putRequest.onerror = () => reject(putRequest.error);
			};

			getRequest.onerror = () => reject(getRequest.error);
			tx.oncomplete = () => {
				if (merged) {
					this.clearCache();
					this.clearExistenceCache();
				}
				resolve(merged);
			};
			tx.onerror = () => reject(tx.error || new Error('Failed to update chat message'));
			tx.onabort = () => reject(tx.error || new Error('Chat message update was aborted'));
		});
	}
    updateCache(message) {
        const { recent, userMessages } = this.cache;
        
        recent.unshift(message);
        if (recent.length > this.cacheSize) recent.pop();
        
        if (!userMessages.has(message.userid || message.chatname)) {
            userMessages.set(message.userid || message.chatname, []);
        }
        
        const userCache = userMessages.get(message.userid || message.chatname);
        userCache.unshift(message);
        if (userCache.length > this.cacheSize) userCache.pop();
        
        this.cache.lastUpdate = Date.now();
    }

    async getRecentMessages(limit = 10) {
        const now = Date.now();
        this.syncRetentionCacheMode();
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
                    if (!this.isMessageExpired(msg, now)) {
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
	
	async checkUserTypeExists(userIdentifier, type, fallbackChatname = null) {
		const now = Date.now();
		this.syncRetentionCacheMode();
		const cacheKeys = this.getExistenceCacheKeys(userIdentifier, type, fallbackChatname);

		// Check cache first
        for (const cacheKey of cacheKeys) {
            if (!this.existenceCache.entries.has(cacheKey)) continue;
            const entry = this.existenceCache.entries.get(cacheKey);
            if (now - entry.timestamp < this.existenceCache.ttl) {
                return {
                    exists: entry.exists,
                    lastActivity: entry.lastActivity ?? null
                };
            }
            // Expired entry, remove from cache
            this.existenceCache.entries.delete(cacheKey);
        }

        // If database is disabled, do not mark users first-time.
        if (settings?.disableDB?.setting === true || settings?.disableDB === true) {
            return { exists: false, lastActivity: null, unavailable: true };
        }

        // Not in cache and database enabled, check database
        const db = await this.ensureDB();

        const normalizedUserIdentifier = userIdentifier === undefined || userIdentifier === null ? "" : String(userIdentifier).trim();
        const normalizedFallbackChatname = fallbackChatname === undefined || fallbackChatname === null ? "" : String(fallbackChatname).trim();
        const lookups = [];
        if (normalizedUserIdentifier) {
            lookups.push({
                indexName: 'user_id_type_timestamp',
                lower: [normalizedUserIdentifier, type, 0],
                upper: [normalizedUserIdentifier, type, now]
            });
            lookups.push({
                indexName: 'user_type_timestamp',
                lower: [normalizedUserIdentifier, type, 0],
                upper: [normalizedUserIdentifier, type, now]
            });
        }
        if (normalizedFallbackChatname && normalizedFallbackChatname !== normalizedUserIdentifier) {
            lookups.push({
                indexName: 'user_type_timestamp',
                lower: [normalizedFallbackChatname, type, 0],
                upper: [normalizedFallbackChatname, type, now]
            });
        }

        const queryIndex = lookup => new Promise(resolve => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            if (!store.indexNames.contains(lookup.indexName)) {
                resolve({ exists: false, lastActivity: null });
                return;
            }
            const index = store.index(lookup.indexName);
            const cursorRequest = index.openCursor(IDBKeyRange.bound(lookup.lower, lookup.upper), 'prev');

            cursorRequest.onsuccess = event => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve({ exists: false, lastActivity: null });
                    return;
                }

                const message = cursor.value;
                if (this.isMessageExpired(message, now)) {
                    cursor.continue();
                    return;
                }

                resolve({
                    exists: true,
                    lastActivity: message.timestamp ?? null
                });
            };

            cursorRequest.onerror = () => {
                console.error('Error checking user type records:', cursorRequest.error);
                resolve({ exists: false, lastActivity: null, unavailable: true });
            };
        });

        for (const lookup of lookups) {
            const result = await queryIndex(lookup);
            if (result.unavailable) {
                return result;
            }
            if (result.exists) {
                cacheKeys.forEach(cacheKey => {
                    this.setExistenceCache(cacheKey, {
                        exists: true,
                        lastActivity: result.lastActivity,
                        cachedAt: now
                    });
                });
                return result;
            }
        }

        return { exists: false, lastActivity: null };
    }
    clearExistenceCache() {
        this.existenceCache.entries.clear();
    }
	
	async getUserMessages(chatname, type, page = 0, pageSize = 100) {
		const db = await this.ensureDB();
		const now = Date.now();
		this.syncRetentionCacheMode();
		
		if (settings?.disableDB) return [];
		
		return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            
            // Check if this looks like a userid
            const looksLikeUserId = chatname && (
                chatname.startsWith('UC') || // YouTube channel ID
                chatname.match(/^[A-Z0-9_-]{10,}$/i) // Other platform IDs
            );
            
            // Choose the appropriate index
            let index;
            let range;
            
            if (looksLikeUserId && store.indexNames.contains('user_id_type_timestamp') && store.indexNames.contains('user_id_timestamp')) {
                index = type ? store.index('user_id_type_timestamp') : store.index('user_id_timestamp');
                range = type ?
                    IDBKeyRange.bound([chatname, type, 0], [chatname, type, now]) :
                    IDBKeyRange.bound([chatname, 0], [chatname, now]);
            } else {
                index = type ? store.index('user_type_timestamp') : store.index('user_timestamp');
                range = type ?
                    IDBKeyRange.bound([chatname, type, 0], [chatname, type, now]) :
                    IDBKeyRange.bound([chatname, 0], [chatname, now]);
            }
            
            const messages = [];
            const skip = page * pageSize;
            let count = 0;
                
            index.openCursor(range, 'prev').onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    const msg = cursor.value;
                    if (!this.isMessageExpired(msg, now)) {
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

    async cleanupExpiredMessages() {
        // Read storage as well as the in-memory setting so startup cleanup
        // cannot race settings hydration and delete unlimited history.
        let unlimitedMode;
        try {
            unlimitedMode = await isUnlimitedDBEnabledInStorage();
        } catch (error) {
            console.warn('Skipping message cleanup because retention settings are unavailable:', error);
            return 0;
        }

        if (unlimitedMode) {
            console.log('Unlimited DB mode enabled, skipping cleanup');
            return 0;
        }

        const db = await this.ensureDB();
        const now = Date.now();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const index = store.index('timestamp');
            let deleted = 0;

            index.openCursor().onsuccess = event => {
                const cursor = event.target.result;
                if (!cursor) return;
                if (this.isMessageExpired(cursor.value, now)) {
                    store.delete(cursor.primaryKey);
                    deleted++;
                }
                cursor.continue();
            };

            tx.oncomplete = () => {
                if (deleted) {
                    this.clearCache();
                    this.clearExistenceCache();
                }
                resolve(deleted);
            };
            tx.onerror = () => reject(tx.error || new Error('Failed to clean expired message history'));
            tx.onabort = () => reject(tx.error || new Error('Message history cleanup was aborted'));
        });
    }

    scheduleCleanup() {
        const cleanup = () => this.cleanupExpiredMessages().catch(error => {
            console.error('Failed to clean expired message history:', error);
        });

        cleanup();
        setInterval(cleanup, MS_PER_DAY);
    }

    async getMessagesBefore(beforeTimestamp, limit = 50, beforeId = null) {
        if (settings?.disableDB) return [];
        this.syncRetentionCacheMode();

        let normalizedBeforeTimestamp;
        if (beforeTimestamp === null || beforeTimestamp === undefined || beforeTimestamp === "") {
            normalizedBeforeTimestamp = Date.now();
        } else {
            normalizedBeforeTimestamp = Math.trunc(Number(beforeTimestamp));
            if (!Number.isFinite(normalizedBeforeTimestamp)) {
                normalizedBeforeTimestamp = Date.now();
            }
        }

        let normalizedLimit = parseInt(limit, 10);
        if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) {
            normalizedLimit = 50;
        }

        let normalizedBeforeId = null;
        if (beforeId !== null && beforeId !== undefined && beforeId !== "") {
            const parsedBeforeId = parseInt(beforeId, 10);
            if (Number.isFinite(parsedBeforeId)) {
                normalizedBeforeId = parsedBeforeId;
            }
        }

        const db = await this.ensureDB();
        return new Promise((resolve) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const index = tx.objectStore(this.storeName).index('timestamp');
            const messages = [];
            const now = Date.now();

            const cursorRequest = index.openCursor(IDBKeyRange.upperBound(normalizedBeforeTimestamp), 'prev');
            cursorRequest.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor && messages.length < normalizedLimit) {
                    const msg = cursor.value;
                    const msgTimestamp = Math.trunc(Number(msg.timestamp));
                    const msgId = parseInt(msg.id, 10);
                    if (
                        normalizedBeforeId !== null &&
                        Number.isFinite(msgTimestamp) &&
                        msgTimestamp === normalizedBeforeTimestamp &&
                        Number.isFinite(msgId) &&
                        msgId >= normalizedBeforeId
                    ) {
                        cursor.continue();
                        return;
                    }
                    if (!this.isMessageExpired(msg, now)) {
                        messages.push(msg);
                    }
                    cursor.continue();
                } else {
                    resolve(messages);
                }
            };

            cursorRequest.onerror = () => resolve([]);
        });
    }

    async clearCache() {
        this.cache.recent = [];
        this.cache.userMessages.clear();
        this.cache.lastUpdate = 0;
        this.cache.retentionMode = isUnlimitedDBEnabled();
    }

    async clearMessages() {
        const db = await this.ensureDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            let deleted = 0;

            const countRequest = store.count();
            countRequest.onsuccess = () => {
                deleted = countRequest.result || 0;
                store.clear();
            };

            tx.oncomplete = () => {
                this.clearCache();
                this.clearExistenceCache();
                resolve(deleted);
            };
            tx.onerror = () => reject(tx.error || new Error('Failed to clear message history'));
            tx.onabort = () => reject(tx.error || new Error('Message history clear was aborted'));
        });
    }
}

// Compatibility function for getMessagesBeforeDB
async function getMessagesBeforeDB(beforeTimestamp, limit, beforeId) {
    return await messageStoreDB.getMessagesBefore(beforeTimestamp, limit, beforeId);
}

// Compatibility function for getLastMessagesDB
async function getLastMessagesDB(limit = 10) {
    return await messageStoreDB.getRecentMessages(limit);
}

// Compatibility function for addMessageDB
async function addMessageDB(message) {
    if (settings?.disableDB) return null;
    return await messageStoreDB.addMessage(message);
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

// Initialize the store - I might want to use this after I no longer need the migration script
/* const messageStoreDB = new MessageStoreDB({
    dbName: 'chatMessagesDB_v3',
    storeName: 'messages',
    cacheSize: 100, // should be no smaller than the default paging size (100).
    cacheDuration: 5 * 60 * 1000, // 5 minutes
    daysToKeep: 30
}); */

/// migration addon -- remove this in late 2025

class MessageStoreMigration {
    constructor(messageStore, options = {}) {
        this.messageStore = messageStore;
        this.oldDbName = 'chatMessagesDB';
        this.oldStoreName = 'messages';
        this.migrationSource = `${this.oldDbName}:${this.oldStoreName}`;
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
                console.log('Old database could not be verified; preserving it for a later retry');
                return;
            }

            console.log(`Found valid old database (version ${oldVersion}), starting migration...`);
            const unlimitedMode = await isUnlimitedDBEnabledInStorage();
            const removedPartialRows = await this.processTaggedMigrationRows('delete');
            if (removedPartialRows) {
                console.log(`Removed ${removedPartialRows} incomplete migration rows before retry`);
            }
            const migratedCount = await this.migrateRecentData(oldVersion, unlimitedMode);
            const taggedCount = await this.processTaggedMigrationRows('count');
            if (taggedCount !== migratedCount) {
                throw new Error(`Migration verification failed: copied ${migratedCount}, found ${taggedCount}`);
            }

            console.log(migratedCount > 0 ? `Successfully migrated ${migratedCount} messages` : 'No messages to migrate');
            await this.deleteOldDatabase();
            try {
                await this.processTaggedMigrationRows('clear');
            } catch (error) {
                console.warn('Migrated messages were saved, but internal migration markers could not be cleared:', error);
            }
            this.messageStore.clearCache();
            this.messageStore.clearExistenceCache();

        } catch (error) {
            console.error('Migration failed:', error);
            console.warn('Old message database preserved because migration did not complete');
        } finally {
            this.migrationAttempted = true;
        }
    }

    async processTaggedMigrationRows(action) {
        const db = await this.messageStore.ensureDB();
        const readOnly = action === 'count';

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.messageStore.storeName, readOnly ? 'readonly' : 'readwrite');
            const store = tx.objectStore(this.messageStore.storeName);
            const request = store.openCursor();
            let matched = 0;

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (!cursor) return;
                const value = cursor.value;
                if (value && value.__ssnMigrationSource === this.migrationSource) {
                    matched++;
                    if (action === 'delete') {
                        cursor.delete();
                    } else if (action === 'clear') {
                        delete value.__ssnMigrationSource;
                        cursor.update(value);
                    }
                }
                cursor.continue();
            };

            request.onerror = () => reject(request.error || new Error('Failed to inspect migrated messages'));
            tx.oncomplete = () => {
                if (action === 'delete' && matched) {
                    this.messageStore.clearCache();
                    this.messageStore.clearExistenceCache();
                }
                resolve(matched);
            };
            tx.onerror = () => reject(tx.error || new Error('Failed to process migrated messages'));
            tx.onabort = () => reject(tx.error || new Error('Migrated message transaction was aborted'));
        });
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
				console.log('Error detecting version:', request.error);
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

    async migrateRecentData(oldVersion, unlimitedMode = false) {
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
                    const batchSize = 50;
                    let beforeKey;
                    let done = false;

                    while (!done) {
                        const batch = await this.getMigrationBatch(oldDb, oldVersion, beforeKey, unlimitedMode, batchSize);
                        if (batch.messages.length) {
                            migratedCount += await this.migrateBatch(batch.messages);
                        }
                        beforeKey = batch.lastKey;
                        done = batch.done;
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
        const ids = await this.messageStore.addMigratedMessages(messages, this.migrationSource);
        if (ids.length !== messages.length) {
            throw new Error(`Migration batch verification failed: expected ${messages.length}, saved ${ids.length}`);
        }
        return ids.length;
    }

	async getMigrationBatch(db, oldVersion, beforeKey, unlimitedMode, batchSize) {
		return new Promise((resolve, reject) => {
			const tx = db.transaction(this.oldStoreName, 'readonly');
			const store = tx.objectStore(this.oldStoreName);
			const messages = [];
			let lastKey = beforeKey;

			try {
				const range = beforeKey === undefined ? null : IDBKeyRange.upperBound(beforeKey, true);
				const cursorRequest = store.openCursor(range, 'prev');

				cursorRequest.onsuccess = event => {
					const cursor = event.target.result;
					if (!cursor) {
						resolve({ messages, lastKey, done: true });
						return;
					}

					lastKey = cursor.primaryKey;
					try {
						const message = this.normalizeMessage(cursor.value, oldVersion);
						if (unlimitedMode || new Date(message.timestamp) >= this.cutoffDate) {
							messages.push(message);
						}
					} catch (error) {
						reject(error);
						return;
					}

					if (messages.length >= batchSize) {
						resolve({ messages, lastKey, done: false });
						return;
					}

					cursor.continue();
				};

				cursorRequest.onerror = () => reject(cursorRequest.error || new Error('Failed to read old message history'));

			} catch (error) {
				reject(error);
			}

			tx.onerror = () => reject(tx.error || new Error('Old message history transaction failed'));
		});
	}


    normalizeMessage(oldMessage, oldVersion) {
        const now = Date.now();

        let timestamp;
        if (oldMessage.timestamp instanceof Date) {
            timestamp = oldMessage.timestamp.getTime();
        } else if (typeof oldMessage.timestamp === 'number' && Number.isFinite(oldMessage.timestamp)) {
            timestamp = oldMessage.timestamp;
        } else if (typeof oldMessage.timestamp === 'string') {
            timestamp = new Date(oldMessage.timestamp).getTime();
        } else {
            timestamp = now;
        }

        return {
            chatname: oldMessage.chatname || '',
			userid: oldMessage.userid || '',
            chatmessage: oldMessage.chatmessage || oldMessage.message || '',
            chatimg: oldMessage.chatimg || '',
            hasDonation: oldMessage.hasDonation || '',
            membership: oldMessage.membership || oldMessage.hasMembership || '',
            type: oldMessage.type || 'user',
            timestamp: timestamp,
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
            request.onblocked = () => reject(new Error('Old message database deletion was blocked'));
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
